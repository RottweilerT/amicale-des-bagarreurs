/* Appli Amicale des Bagarreurs : données, onglets, calendrier, combats, salle, notes, notifications, minuteur (Q-08 : sorti d'index.html) */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lsGet=k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseYmd=s=>{const[a,b,c]=s.split('-').map(Number);return new Date(a,b-1,c)};
const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const DAYS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const CFG=window.ADB_CONFIG;  /* config.js : vocabulaire commun appli / serveur */
const ONGLETS=CFG.onglets.map(o=>o.id);
const COURSE=Object.fromEntries(Object.entries(CFG.cours).map(([k,v])=>[k,v.nom]));
const courseCls=t=>(CFG.cours[t]||{}).classe||'o';
const METHODS={PTS:'aux points',KO:'par KO',ARB:"par arrêt de l'arbitre",ABD:'par abandon',DQ:'par disqualification',NUL:'Match nul'};

const S={members:new Map(),fights:new Map(),courses:new Map(),attendance:new Map()};
const loaded={members:false,fights:false,courses:false,attendance:false};
let NOTES=new Map();
let SEANCES=new Map();  /* cours du Minuteur partagés avec le groupe (documents « courses » de kind « seance ») */
const localF=new Map(), fTimer={}, Q={};
let db=null, canWrite=true, connected=false;
const today=ymd(new Date());
let ui={tab:'membres',fightId:null,round:0,month:new Date(new Date().getFullYear(),new Date().getMonth(),1),day:today,appel:null,confirm:null};
let me=lsGet('adb-me');
let chrono={running:false,start:0,elapsed:0};

/* ---------- plumbing ---------- */
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)}
function banner(msg){const b=$('#banner');b.hidden=!msg;b.textContent=msg||''}
function applyRO(){document.querySelectorAll('[data-w]').forEach(el=>{el.disabled=!canWrite||!connected})}
function handleErr(e){
  const c=e&&e.code;
  console.warn('Firestore',c,e&&e.message);
  if(c==='permission-denied')toast("Modification refusée par la base : elle n'a pas été enregistrée.");
  else if(c==='resource-exhausted')toast("Limite gratuite du jour atteinte : la modification n'est pas enregistrée. Réessaie après 9 h.");
  else if(c==='invalid-argument'||c==='failed-precondition'||c==='not-found')toast("Modification refusée : elle n'a pas été enregistrée.");
  else if(c==='unavailable'||c==='deadline-exceeded'||!navigator.onLine)toast("Pas de réseau : la modification partira dès le retour de la connexion.");
  else toast("Problème inattendu : la modification n'a peut-être pas été enregistrée. Vérifie et réessaie.");
}
function enqueue(path,fn){Q[path]=(Q[path]||Promise.resolve()).then(fn).catch(handleErr);return Q[path]}
const setDoc=(path,data)=>enqueue(path,()=>db.doc(path).set(data));
const delDoc=path=>enqueue(path,()=>db.doc(path).delete());
const newId=col=>db.collection(col).doc().id;

function member(id){return S.members.get(id)}
function mName(id,short){const m=member(id);if(!m)return 'Membre supprimé';return short?m.first+' '+(m.last||'').charAt(0)+'.':m.first+' '+m.last}
function sortedMembers(){return [...S.members.entries()].sort((a,b)=>(a[1].last+a[1].first).localeCompare(b[1].last+b[1].first,'fr'))}
function getFight(id){return localF.get(id)||S.fights.get(id)}

/* ---------- boot ---------- */
async function boot(){
  if(!window.firebase){banner("Impossible de joindre la base de données. Vérifie ta connexion internet puis recharge la page.");renderAll();return}
  if(!FIREBASE_CONFIG.apiKey||FIREBASE_CONFIG.apiKey==='COLLE_ICI'||!FIREBASE_CONFIG.projectId){banner("Configuration manquante : colle la configuration Firebase en haut du fichier.");renderAll();return}
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    if(APPCHECK_SITE_KEY&&firebase.appCheck){try{const ac=firebase.appCheck();ac.activate(firebase.appCheck.ReCaptchaV3Provider?new firebase.appCheck.ReCaptchaV3Provider(APPCHECK_SITE_KEY):APPCHECK_SITE_KEY,true)}catch(e){console.warn('App Check',e)}}
    db=firebase.firestore();
    db.settings({ignoreUndefinedProperties:true,merge:true});
    db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
  }catch(e){banner("La configuration Firebase est invalide.");renderAll();return}
  connected=true;
  for(const col of Object.keys(S)){
    db.collection(col).onSnapshot(snap=>{
      const m=new Map();snap.docs.forEach(d=>m.set(d.id,d.data()));
      if(col==='fights'){for(const [id,l] of localF){const s=m.get(id);if(s&&s.rev===l.rev)localF.delete(id)}}
      if(col==='courses'){const n=new Map(),sl=new Map(),se=new Map();for(const [id,d] of m){if(d&&d.kind==='note')n.set(id,d);else if(d&&(d.kind==='salle'||d.kind==='salle-saison'))sl.set(id,d);else if(d&&d.kind==='seance')se.set(id,d);else continue;m.delete(id)}NOTES=n;SALLE=sl;SEANCES=se;if(window.tmRefresh)tmRefresh()}
      S[col]=m;loaded[col]=true;renderAll();if(col==='members'&&window.splashDone)splashDone();
    },handleErr);
  }
  applyRO();
}

/* ---------- tabs ---------- */
function showTab(t){
  ui.tab=t;
  document.querySelectorAll('nav.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t))
  for(const id of ONGLETS)$('#tab-'+id).hidden=id!==t;
  try{history.replaceState(null,'','#'+t)}catch(e){}
}
document.querySelector('nav.tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)showTab(b.dataset.tab)});
{const h=(location.hash||'').slice(1);if(ONGLETS.includes(h))showTab(h)}
/* ouverture depuis une notification alors que l'appli est déjà ouverte : seul le #onglet change */
addEventListener('hashchange',()=>{const h=(location.hash||'').slice(1);if(ONGLETS.includes(h)&&h!==ui.tab)showTab(h)});

/* ---------- identity ---------- */
function fillMemberSelect(sel,placeholder,keep){
  const v=keep??sel.value;
  sel.innerHTML=`<option value="">${esc(placeholder)}</option>`+sortedMembers().map(([id,m])=>`<option value="${id}">${esc(m.first+' '+m.last)}</option>`).join('');
  if(v&&S.members.has(v))sel.value=v;
}
async function hashPin(id,pin){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('adb:'+id+':'+pin));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
let gateResolve=null,gateId=null;
function askPin(id,why){
  const m=member(id);if(!m||!m.pin)return Promise.resolve(true);
  gateId=id;$('#gateTitle').textContent='Code de '+m.first;$('#gateLabel').textContent=why||'Entre le code d\u2019accès de ce profil';
  $('#gatePin').value='';$('#gateErr').hidden=true;$('#gate').hidden=false;setTimeout(()=>$('#gatePin').focus(),30);
  return new Promise(r=>{gateResolve=r});
}
function closeGate(ok){$('#gate').hidden=true;const r=gateResolve;gateResolve=null;gateId=null;if(r)r(ok)}
$('#gateCancel').addEventListener('click',()=>closeGate(false));
$('#gate').addEventListener('click',e=>{if(e.target.id==='gate')closeGate(false)});
$('#gateForm').addEventListener('submit',async e=>{
  e.preventDefault();const m=member(gateId);if(!m){closeGate(false);return}
  const h=await hashPin(gateId,$('#gatePin').value.trim());
  if(h===m.pin)closeGate(true);else{$('#gateErr').hidden=false;$('#gatePin').select()}
});
$('#me').addEventListener('change',async e=>{
  const v=e.target.value;e.target.value=me||'';
  if(v&&!(await askPin(v,'Entre ton code pour te connecter')))return;
  me=v;lsSet('adb-me',me);e.target.value=me;renderAll();
});

/* ---------- members ---------- */
/* ----- Classement Elo ----- */
const ELO_START=1200;
let eloDisc='all',eloCache=null,eloKey='';
function fightOrder(a,b){return (a[1].date||'').localeCompare(b[1].date||'')||((a[1].createdAt||0)-(b[1].createdAt||0))}
function computeElo(disc){
  const r={},n={},hist={},per={};
  const done=[...S.fights.entries()].filter(([,f])=>f.status==='fini'&&f.result&&f.red&&f.blue&&f.red!==f.blue&&(disc==='all'||(f.disc||'BA')===disc)).sort(fightOrder);
  for(const [id,f] of done){
    const ra=r[f.red]??ELO_START,rb=r[f.blue]??ELO_START,na=n[f.red]||0,nb=n[f.blue]||0;
    const ea=1/(1+Math.pow(10,(rb-ra)/400));
    const w=f.result.winner,sa=w==='r'?1:w==='b'?0:.5,m=f.result.method;
    let mult=1;
    if(w&&(m==='KO'||m==='ARB'||m==='ABD'))mult=1.25;
    else if(w&&m==='PTS'){const t=totals(f);mult=1+Math.min(.3,Math.abs(t.r-t.b)/30)}
    const ka=na<10?40:24,kb=nb<10?40:24;
    const da=Math.round(ka*mult*(sa-ea)),db=Math.round(kb*mult*((1-sa)-(1-ea)));
    r[f.red]=ra+da;r[f.blue]=rb+db;n[f.red]=na+1;n[f.blue]=nb+1;
    (hist[f.red]=hist[f.red]||[ELO_START]).push(r[f.red]);(hist[f.blue]=hist[f.blue]||[ELO_START]).push(r[f.blue]);
    per[id]={ra,rb,da,db,pa:ea};
  }
  return {r,n,hist,per};
}
function elo(disc){
  const key=[...S.fights.entries()].map(([id,f])=>id+(f.status||'')+(f.result?f.result.method+f.result.winner:'')+(f.date||'')+f.disc+f.red+f.blue+JSON.stringify(totals(f))).join(',');
  if(!eloCache||eloKey!==key){eloCache={};eloKey=key}
  return eloCache[disc]||(eloCache[disc]=computeElo(disc));
}
function eloOf(id,disc){const E=elo(disc);return {r:E.r[id]??ELO_START,n:E.n[id]||0}}
function winProb(redId,blueId,disc){const a=eloOf(redId,disc).r,b=eloOf(blueId,disc).r;return 1/(1+Math.pow(10,(b-a)/400))}
function spark(h){
  if(!h||h.length<2)return '';
  const lo=Math.min(...h),hi=Math.max(...h),sp=Math.max(hi-lo,1),W=64,H=22;
  const pts=h.map((v,i)=>`${(i/(h.length-1)*(W-4)+2).toFixed(1)},${(H-3-(v-lo)/sp*(H-6)).toFixed(1)}`).join(' ');
  const last=pts.split(' ').pop().split(',');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--blue)" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.4" fill="var(--red)"/></svg>`;
}
function renderElo(){
  const E=elo(eloDisc);
  const rows=Object.keys(E.r).filter(id=>S.members.has(id)).sort((a,b)=>E.r[b]-E.r[a]||E.n[b]-E.n[a]);
  const unranked=S.members.size-rows.length;
  $('#eloCount').textContent=rows.length?rows.length+' classé'+(rows.length>1?'s':''):'';
  const el=$('#eloList');
  if(!rows.length){el.innerHTML=`<div class="empty">Aucun combat terminé${eloDisc==='all'?'':' dans cette discipline'} pour l’instant. Le classement apparaîtra dès le premier combat arbitré jusqu’au bout dans l’onglet Combats.</div>`;return}
  el.innerHTML=rows.map((id,i)=>{const m=member(id),h=E.hist[id]||[],d=h.length>1?h[h.length-1]-h[h.length-2]:0,st=memberStats(id);
    return `<div class="elo-row p${i+1}"><span class="rk">${i+1}</span>
      <div style="min-width:0"><div class="nm">${esc(m.first)} ${esc(m.last)}${id===me?' <span class="pill">toi</span>':''}</div><div class="sub">${E.n[id]} combat${E.n[id]>1?'s':''}${E.n[id]<5?' · provisoire':''}${eloDisc==='all'?` · ${st.w} V – ${st.l} D`:''}</div></div>
      ${spark(h)}
      <div><span class="val">${E.r[id]}</span><span class="dl ${d>0?'up':d<0?'down':''}">${d>0?'+':''}${d||'='}</span></div></div>`}).join('')
    +(unranked>0?`<p class="hint" style="margin:4px 0 0">${unranked} membre${unranked>1?'s':''} pas encore classé${unranked>1?'s':''} : il${unranked>1?'s démarreront':' démarrera'} à ${ELO_START}.</p>`:'');
}
$('#eloFilter').addEventListener('click',e=>{const b=e.target.closest('button[data-d]');if(!b)return;eloDisc=b.dataset.d;[...$('#eloFilter').children].forEach(x=>x.setAttribute('aria-selected',x===b));renderElo()});

function memberStats(id){
  let w=0,l=0,n=0,p=0;
  for(const f of S.fights.values()){if(f.status!=='fini')continue;if(f.red!==id&&f.blue!==id)continue;n++;const win=f.result&&f.result.winner;if(win==='r'&&f.red===id||win==='b'&&f.blue===id)w++;else if(win==='r'||win==='b')l++}
  for(const a of S.attendance.values())if(a.memberId===id&&a.status==='present'&&S.courses.has(a.courseId)&&S.courses.get(a.courseId).date<=today)p++;
  return {w,l,n,p};
}
/* Profil activé / désactivé (champ « off » de la fiche) : un profil désactivé n'est pas attendu pour les présences
   (il ne compte pas dans « sans réponse » et ne reçoit pas le rappel du samedi), mais il peut toujours répondre. */
const isOff=m=>!!(m&&m.off);
async function setOff(id,off){const m=member(id);if(!m||!db)return;m.off=off;renderAll();
  try{await db.doc('members/'+id).set({off},{merge:true});toast(m.first+' '+m.last+(off?' : profil désactivé':' : profil activé'))}
  catch(e){m.off=!off;renderAll();toast('Enregistrement impossible, réessaie.')}}
$('#bxActive').addEventListener('change',e=>{if(me)setOff(me,!e.target.checked)});
/* Notifications activées par ce membre (tous ses appareils), d'après sa fiche publique */
const NCOURT={annonces:'Annonces',changements:'Cours modifiés',nouveaux:'Nouveaux cours',rappel:'Rappel présences',combats:'Combats'};
function notifLine(m){
  const devs=m.notifs&&typeof m.notifs==='object'?Object.values(m.notifs).filter(x=>x&&Array.isArray(x.cats)):[];
  if(!devs.length)return Array.isArray(m.push)&&m.push.length?'<div class="nt-line on">🔔 Notifications activées</div>':'<div class="nt-line">🔕 Notifications non activées</div>';
  const c=new Set(devs.flatMap(d=>d.cats));const l=Object.keys(NCOURT).filter(k=>c.has(k));
  return `<div class="nt-line on" title="Notifications activées sur ${devs.length} appareil${devs.length>1?'s':''}">🔔 ${l.length?l.map(k=>`<span class="nt-cat">${NCOURT[k]}</span>`).join(''):'Activées, aucune catégorie cochée'}${devs.length>1?` <small>(${devs.length} appareils)</small>`:''}</div>`;
}
function renderMembers(){
  renderReg();
  const list=sortedMembers();
  {const off=list.filter(([,m])=>isOff(m)).length;$('#mCount').textContent=list.length?list.length+' inscrit'+(list.length>1?'s':'')+(off?' · '+off+' désactivé'+(off>1?'s':''):''):'';}
  const el=$('#membersList');
  if(!loaded.members&&connected){el.innerHTML='<div class="empty">Chargement du groupe…</div>';return}
  if(!list.length){el.innerHTML='<div class="empty"><strong>Personne sur le ring</strong>Les inscrits apparaîtront ici avec leur poids, leur taille, leur bilan de combats et leurs présences. Remplis le formulaire pour être le premier.</div>';return}
  el.innerHTML='<div class="members">'+list.map(([id,m])=>{
    const s=memberStats(id);
    const conf=ui.confirm==='m:'+id;
    return `<div class="member${isOff(m)?' off':''}"><div class="name">${esc(m.first)} ${esc(m.last)}${id===me?' <span class="pill">toi</span>':''}${isOff(m)?' <span class="pill offp">désactivé</span>':''}</div>${m.pin?'<div class="lock">Protégé par un code</div>':''}
      <div class="hint num">${esc(m.weight)} kg · ${esc(m.height)} cm</div>
      ${notifLine(m)}
      <div class="stats"><span><b>${s.w}</b>V</span><span><b>${s.l}</b>D</span><span><b>${s.n-s.w-s.l}</b>N</span><span><b>${s.p}</b>cours</span></div>
      <div class="acts">${conf?`<button class="btn danger small" data-w data-act="mDelYes" data-id="${id}">Confirmer la suppression</button><button class="btn ghost small" data-act="noConfirm">Garder</button>`:`<button class="btn ghost small" data-w data-act="mEdit" data-id="${id}">Modifier</button><button class="btn ghost small" data-w data-act="mOff" data-id="${id}">${isOff(m)?'Activer':'Désactiver'}</button><button class="btn ghost small" data-w data-act="mDel" data-id="${id}">Supprimer</button>`}</div></div>`}).join('')+'</div>';
}
/* ----- Inscription : même écran que FC St Léon et Apnée ----- */
let pickId=null,pinFails=0,pinLockUntil=0;
const LEAD_NEW='Une seule fois, depuis ton téléphone. Ensuite tu indiques tes présences aux cours et tu montes sur le ring.';
function openMemberForm(id){
  const m=id?member(id):null;resetFields();ui.regForm=true;
  if(m){$('#mId').value=id;$('#mFirst').value=m.first;$('#mLast').value=m.last;$('#mWeight').value=m.weight;$('#mHeight').value=m.height}
  renderReg();$('#fMember').scrollIntoView({block:'start',behavior:'smooth'});$('#mFirst').focus({preventScroll:true});
}
function resetFields(){$('#fMember').reset();$('#mId').value='';$('#mErr').hidden=true;$('#mPinOff').checked=false}
function resetMemberForm(){resetFields();ui.regForm=false;renderReg()}
$('#mCancel').addEventListener('click',resetMemberForm);
$('#bxEdit').addEventListener('click',()=>openMemberForm(me));
$('#bxOther').addEventListener('click',()=>openMemberForm(null));
$('#bxForget').addEventListener('click',()=>{me='';lsSet('adb-me','');ui.confirm=null;renderAll()});
$('#bxDel').addEventListener('click',()=>{
  if(ui.confirm!=='me'){ui.confirm='me';renderReg();setTimeout(()=>{if(ui.confirm==='me'){ui.confirm=null;renderReg()}},4000);return}
  ui.confirm=null;delDoc('members/'+me);S.members.delete(me);me='';lsSet('adb-me','');toast('Tu es désinscrit.');renderAll();
});
function pickAs(id){me=id;lsSet('adb-me',id);pickId=null;toast('Bonjour '+member(id).first+' !');renderAll()}
$('#bxPick').addEventListener('change',e=>{
  const v=e.target.value,m=v&&member(v);$('#bxPinAsk').hidden=true;$('#bxPinMsg').hidden=true;pickId=null;
  if(!m)return;if(!m.pin){pickAs(v);return}
  pickId=v;$('#bxPinAsk').hidden=false;$('#bxPinMsg').hidden=false;$('#bxPinMsg').textContent='Cette fiche est protégée : entre son code d’accès.';$('#bxPinInput').value='';$('#bxPinInput').focus();
});
$('#bxPinAsk').addEventListener('submit',async e=>{
  e.preventDefault();const m=member(pickId);if(!m)return;
  if(Date.now()<pinLockUntil){$('#bxPinMsg').textContent='Trop d’essais : réessaie dans 30 secondes.';return}
  if(await hashPin(pickId,$('#bxPinInput').value.trim())===m.pin){pinFails=0;pickAs(pickId);return}
  if(++pinFails>=5){pinFails=0;pinLockUntil=Date.now()+30000}
  $('#bxPinMsg').textContent=Date.now()<pinLockUntil?'Trop d’essais : réessaie dans 30 secondes.':'Code incorrect.';$('#bxPinInput').value='';
});
function renderReg(){
  const mine=me&&member(me),editId=$('#mId').value,edited=editId?member(editId):null,showForm=!mine||ui.regForm;
  $('#bxMe').hidden=showForm;$('#fMember').hidden=!showForm;
  $('#bxPickRow').hidden=!!mine||ui.regForm||!S.members.size;
  if(!mine&&!pickId)fillMemberSelect($('#bxPick'),'Choisis ton nom…','');
  if(mine&&!showForm){const m=mine,s=memberStats(me);
    $('#bxAvatar').textContent=((m.first||'?')[0]+((m.last||'')[0]||'')).toUpperCase();$('#bxName').textContent=m.first+' '+m.last;
    $('#bxProf').textContent=m.weight+' kg · '+m.height+' cm';
    $('#bxStats').textContent=`${s.w} victoire${s.w>1?'s':''} · ${s.l} défaite${s.l>1?'s':''} · ${s.n-s.w-s.l} nul${s.n-s.w-s.l>1?'s':''} · ${s.p} cours`;
    $('#bxLock').textContent=m.pin?'Protégé par un code':'Sans code d’accès';
    $('#bxActive').checked=!isOff(m);$('#bxActiveT').textContent=isOff(m)?'Profil désactivé':'Profil activé';
    $('#bxActiveH').textContent=isOff(m)?'On n\u2019attend pas ta présence aux cours et tu ne reçois plus le rappel du samedi. Tu peux quand même t\u2019inscrire.':'On compte sur ta réponse pour chaque cours. Désactive ton profil si tu fais une pause (blessure, vacances…).';
    const armed=ui.confirm==='me';$('#bxDel').textContent=armed?'Confirmer la désinscription':'Me désinscrire';$('#bxDel').classList.toggle('armed',armed);$('#bxDelNote').hidden=!armed;}
  if(showForm){
    const self=editId&&editId===me;
    $('#fMemberTitle').textContent=edited?(self?'Modifier mon inscription':'Modifier la fiche de '+edited.first):(mine?'Inscrire quelqu’un':'Je m’inscris');
    $('#fMemberLead').textContent=edited?'Change ce que tu veux puis enregistre.':(mine?'Pour un membre qui n’a pas le lien : il pourra ensuite retrouver sa fiche sur son téléphone.':LEAD_NEW);
    $('#mSubmit').textContent=edited?'Enregistrer':(mine?'Inscrire':'Je m’inscris');$('#mCancel').hidden=!ui.regForm;
    const hasPin=!!(edited&&edited.pin);
    $('#mPinLabel').textContent=hasPin?'Nouveau code':'Code d’accès';$('#mPin').placeholder=hasPin?'Laisse vide pour garder':'Facultatif';$('#mPinOffRow').hidden=!hasPin;
    $('#mPinHint').textContent=hasPin?'Il y a déjà un code : laisse vide pour le garder, ou tape un nouveau code (4 à 8 chiffres).':'4 à 8 chiffres. Le code évite qu’un autre membre ouvre ou modifie ta fiche par erreur depuis l’appli. Ce n’est pas un mot de passe : ne réutilise pas un code important.';
  }
  $('#telCard').hidden=!(mine&&!showForm);Tel.render();Tel.sync();
}
const PUSH={vapid:'BJB53XBL72om9F12Ifu5uy46_DFg7Cbl9k71iqviMunQtKZEixFqh1y2O9Ozbj-eQULoHoJj3TFzWCYP9kAwyVo',me:()=>me&&member(me)?me:''};
/* ----- Notifications push (Firebase Cloud Messaging) — voir NOTIFICATIONS.md -----
   Chaque appareil abonné a une fiche privée push_subs/<identifiant aléatoire> : jeton FCM, catégories, profil (facultatif),
   dates. Les règles Firestore interdisent toute lecture depuis l'appli ; seule la GitHub Action « Notifications » les lit.
   (L'ancien rangement, jeton dans la fiche du membre, a été retiré le 20/11/2026 : plus aucun appareil ne l'utilisait.) */
const NCATS=CFG.notifications;
const NLINKS=Object.fromEntries(CFG.onglets.map(o=>[o.id,o.nom]));
const Notif=(()=>{
  const LS={pub:'adb-push-pub',id:'adb-push-id',tok:'push-token',who:'push-who',cats:'adb-push-cats',since:'adb-push-since',sync:'adb-push-sync',key:'adb-push-key',mode:'adb-push-mode'};
  const get=k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}};
  const put=(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}};
  const el=id=>document.getElementById(id);
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const supported=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&!!(window.firebase&&firebase.messaging);
  const messaging=()=>{try{return firebase.messaging()}catch(e){return null}};
  const FV=()=>firebase.firestore.FieldValue;
  const memberId=()=>PUSH.me()||null;
  const timeout=(pr,ms=15000)=>Promise.race([pr,new Promise((_,j)=>setTimeout(()=>j(Object.assign(new Error('délai dépassé'),{code:'timeout'})),ms))]);
  let busy=false,syncing=false,msgT,catT;
  function cats(){try{const v=JSON.parse(get(LS.cats));if(Array.isArray(v))return v.filter(k=>NCATS.some(c=>c.k===k))}catch(e){}return NCATS.map(c=>c.k)}
  function subId(){let id=get(LS.id);if(!/^[a-f0-9]{32}$/.test(id)){const a=new Uint8Array(16);crypto.getRandomValues(a);id=[...a].map(x=>x.toString(16).padStart(2,'0')).join('');put(LS.id,id)}return id}
  const active=()=>!!(get(LS.tok)&&'Notification' in window&&Notification.permission==='granted');
  function state(){
    if(!PUSH.vapid)return 'noconfig';
    if(ios()&&!standalone())return 'ios';
    if(!supported())return 'unsupported';
    if(Notification.permission==='denied')return 'denied';
    return active()?'on':'off';
  }
  async function token(){const reg=await navigator.serviceWorker.ready;return messaging().getToken({vapidKey:PUSH.vapid,serviceWorkerRegistration:reg})}
  /* (l'ancien rangement des jetons dans la fiche membre a été retiré : plus aucun appareil ne l'utilisait) */
    /* Fiche visible dans les profils (aucun jeton) : members/<profil>.notifs.<clé de l'appareil> = {cats, at}.
     La clé est dérivée de l'identifiant privé de l'appareil, sans permettre de le retrouver. */
  async function pubKey(){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subId()));return 'd'+[...new Uint8Array(b)].slice(0,6).map(x=>x.toString(16).padStart(2,'0')).join('')}
  async function publish(on){
    try{
      const k=await pubKey(),prev=get(LS.pub),cur=on?memberId():null;
      if(prev&&prev!==cur)await timeout(db.doc('members/'+prev).set({notifs:{[k]:FV().delete()}},{merge:true})).catch(()=>{});
      if(cur)await timeout(db.doc('members/'+cur).set({notifs:{[k]:{cats:cats(),at:Date.now()}}},{merge:true}));
      put(LS.pub,cur);
    }catch(e){console.warn('notifications (profil)',e)}
  }
  async function save(t){
    if(!db)throw Object.assign(new Error('pas de base'),{code:'unavailable'});
    let since=Number(get(LS.since));if(!since){since=Date.now();put(LS.since,String(since))}
    await timeout(db.doc('push_subs/'+subId()).set({token:t,cats:cats(),active:true,member:memberId(),createdAt:since,updatedAt:FV().serverTimestamp()}));
    put(LS.mode,'prive');put(LS.who,null);
    put(LS.tok,t);put(LS.sync,String(Date.now()));put(LS.key,(memberId()||'')+'|prive2|'+cats().join(','));
    await publish(true);
  }
  function msg(t,id='npMsg'){const m=el(id);if(!m)return;m.textContent=t||'';m.hidden=!t;clearTimeout(msgT);if(t&&id==='npMsg')msgT=setTimeout(()=>{m.hidden=true},9000)}
  function errText(e){
    if(e&&e.code==='need-profile')return 'Choisis d’abord ton nom en haut de la page, puis réessaie.';
    if(e&&e.code==='timeout'||!navigator.onLine)return 'Pas de connexion pour l’instant : réessaie quand tu as du réseau.';
    if(e&&e.code==='permission-denied')return 'La base a refusé l’enregistrement de l’abonnement. Préviens l’organisateur.';
    if(e&&/permission|blocked/i.test(String(e.code||e.message)))return 'Le navigateur a bloqué les notifications : autorise-les dans ses réglages pour ce site.';
    return 'Impossible d’activer les notifications pour l’instant. Réessaie dans un moment.';
  }
  async function on(){
    if(busy)return;busy=true;render();msg('');
    try{
      const p=await Notification.requestPermission();
      if(p!=='granted'){msg(p==='denied'?'Tu as refusé les notifications. Pour changer d’avis : réglages du navigateur (ou du téléphone) → Notifications → autoriser ce site, puis reviens ici.':'Notifications pas activées : il faut accepter la demande du navigateur.');return}
      const t=await token();if(!t)throw new Error('jeton vide');
      await save(t);
      msg('C’est activé sur cet appareil 👊');
    }catch(e){console.error('notifications',e);msg(errText(e))}
    finally{busy=false;render()}
  }
  async function off(){
    if(busy)return;busy=true;render();
    const t=get(LS.tok);
    try{
      if(db){await timeout(db.doc('push_subs/'+subId()).delete()).catch(()=>{});await publish(false)}
      const m=supported()&&messaging();if(m)await timeout(m.deleteToken(),8000).catch(()=>{});
    }finally{[LS.tok,LS.who,LS.sync,LS.key,LS.mode,LS.id,LS.since,LS.pub].forEach(k=>put(k,null));busy=false;msg('Tu es désabonné : plus aucune notification sur cet appareil.');render()}
  }
  function setCat(k,v){
    const c=new Set(cats());v?c.add(k):c.delete(k);put(LS.cats,JSON.stringify(NCATS.map(x=>x.k).filter(x=>c.has(x))));
    render();if(!active())return;
    clearTimeout(catT);catT=setTimeout(async()=>{try{await save(get(LS.tok));msg('Choix enregistrés.')}catch(e){msg(errText(e))}},600);
  }
  /* À chaque ouverture : jeton à jour, profil à jour, passage à la fiche privée (au plus une fois par semaine si rien n'a changé). */
  async function sync(){
    if(syncing||busy||!db||!active()||!supported())return;
    const key=(memberId()||'')+'|prive2|'+cats().join(',');
    if(get(LS.mode)==='prive'&&get(LS.key)===key&&Date.now()-Number(get(LS.sync)||0)<7*864e5)return;
    syncing=true;
    try{const t=await token();if(t)await save(t)}catch(e){console.warn('notifications',e)}finally{syncing=false;render()}
  }
  const TXT={
    on:['Activées sur cet appareil','Tu peux choisir ci-dessous ce qui te concerne, ou te désabonner à tout moment.'],
    off:['Désactivées','Active-les pour être prévenu, même quand l’appli est fermée. Tu choisis ensuite ce qui t’intéresse.'],
    denied:['Refusées','Les notifications sont bloquées pour ce site. Pour les autoriser : réglages du navigateur (ou du téléphone) → Notifications → ce site, puis reviens ici.'],
    ios:['À installer d’abord','Sur iPhone et iPad (iOS 16.4 ou plus récent), les notifications ne marchent que dans l’appli installée : dans Safari, touche Partager (le carré avec une flèche), puis « Sur l’écran d’accueil ». Ouvre ensuite l’appli depuis son icône et reviens ici.'],
    unsupported:['Pas compatible ici','Ce navigateur ne gère pas les notifications web. Elles marchent avec Chrome, Edge ou Firefox (Android, Windows, Mac), Safari sur Mac, et l’appli installée sur iPhone.'],
    noconfig:['Bientôt disponibles','Les notifications ne sont pas encore configurées.']};
  function render(){
    const st=state(),[t,h]=TXT[st];
    const bell=el('notifBtn');if(bell){bell.dataset.state=st;bell.title='Notifications : '+t.toLowerCase();bell.setAttribute('aria-label','Notifications ('+t.toLowerCase()+')')}
    const pt=el('telPushTxt');if(pt)pt.textContent=st==='on'?'🔔 Notifications activées sur ce téléphone.':st==='off'?'Reçois une notification quand un cours change, est ajouté ou annulé, et un rappel pour tes présences.':'Notifications : '+t.toLowerCase()+'.';
    if(el('np').hidden)return;
    el('npState').dataset.state=st;el('npStateT').textContent=t;el('npHelp').textContent=h;
    el('npOn').hidden=st!=='off';el('npOff').hidden=!(st==='on'||get(LS.tok));el('npOn').disabled=el('npOff').disabled=busy;
    el('npBtns').hidden=el('npOn').hidden&&el('npOff').hidden;
    const c=cats(),fs=el('npCats');fs.disabled=busy||!(st==='on'||st==='off');
    fs.querySelectorAll('input').forEach(i=>{i.checked=c.includes(i.value)});
  }
  function open(){el('np').hidden=false;render();loadHist();setTimeout(()=>el('npClose').focus(),30)}
  function close(){el('np').hidden=true;el('notifBtn').focus()}
  /* ----- espace admin ----- */
  function preview(){el('naPT').textContent=el('naTitle').value.trim()||'Titre de la notification';el('naPB').textContent=el('naBody').value.trim()||'Message…'}
  async function loadHist(){
    const box=el('naHist');if(!el('npAdmin').open)return;
    try{
      const r=await fetch('notifications/historique.json',{cache:'no-store'});if(!r.ok)throw 0;
      const h=(await r.json()).slice(-15).reverse();
      box.innerHTML=h.length?h.map(x=>{const d=new Date(x.date);return `<div><b>${esc(x.titre)}</b> — ${esc(x.message)}<small>${esc(d.toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))} · ${esc((NCATS.find(c=>c.k===x.categorie)||{t:x.categorie}).t)} · ${x.envoyes} appareil${x.envoyes>1?'s':''}${x.echecs?` · ${x.echecs} échec${x.echecs>1?'s':''}`:''}</small></div>`}).join(''):'<p class="hint">Aucun envoi pour l’instant.</p>';
    }catch(e){box.innerHTML='<p class="hint">Historique indisponible pour l’instant.</p>'}
  }
  async function adminSend(e){
    e.preventDefault();msg('','naMsg');
    const d={title:el('naTitle').value.trim(),body:el('naBody').value.trim(),cat:el('naCat').value,link:el('naLink').value,code:el('naCode').value.trim()};
    if(!d.title||!d.body)return msg('Indique un titre et un message.','naMsg');
    if(!d.code)return msg('Indique le code admin.','naMsg');
    if(!db)return msg('Pas de connexion à la base pour l’instant.','naMsg');
    el('naSend').disabled=true;
    try{
      await timeout(db.collection('push_requests').add(Object.assign(d,{at:FV().serverTimestamp()})));
      el('naTitle').value=el('naBody').value=el('naCode').value='';preview();
      msg('Demande enregistrée. Si le code admin est bon, la notification partira au prochain passage du serveur, puis apparaîtra dans « Derniers envois ».','naMsg');
    }catch(err){msg(err&&err.code==='permission-denied'?'Le serveur n’accepte pas encore les envois depuis l’appli (règles Firestore à mettre à jour, voir NOTIFICATIONS.md).':errText(err),'naMsg')}
    finally{el('naSend').disabled=false}
  }
  // construction du panneau
  el('npCats').insertAdjacentHTML('beforeend',NCATS.map(c=>`<label class="np-cat"><input type="checkbox" value="${c.k}"><span>${c.t}</span><small>${c.h}</small></label>`).join(''));
  el('npCats').addEventListener('change',e=>{if(e.target.matches('input'))setCat(e.target.value,e.target.checked)});
  el('naCat').innerHTML=NCATS.map(c=>`<option value="${c.k}">${c.t}</option>`).join('');
  el('naLink').innerHTML=Object.entries(NLINKS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('');
  el('naTitle').addEventListener('input',preview);el('naBody').addEventListener('input',preview);preview();
  el('naForm').addEventListener('submit',adminSend);el('npAdmin').addEventListener('toggle',loadHist);
  el('npOn').addEventListener('click',on);el('npOff').addEventListener('click',off);
  el('notifBtn').addEventListener('click',open);el('telOn').addEventListener('click',open);el('npClose').addEventListener('click',close);
  el('np').addEventListener('click',e=>{if(e.target.id==='np')close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('np').hidden)close()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
  return {render,sync,open,state};
})();
/* ----- Sur ton téléphone : installation de l'appli (les notifications passent par Notif) ----- */
const Tel=(()=>{
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let installEvt=null;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;render()});
  addEventListener('appinstalled',()=>{installEvt=null;render()});
  const el=id=>document.getElementById(id);
  function render(){
    const card=el('telCard');if(!card||card.hidden)return;
    const it=el('telInstallTxt'),ir=el('telInstallRow');ir.hidden=true;
    if(standalone())it.textContent='✓ L’appli est installée sur ce téléphone.';
    else if(installEvt){it.textContent='Ajoute l’appli à ton écran d’accueil pour l’ouvrir en un geste, comme une vraie appli.';ir.hidden=false}
    else if(ios())it.textContent='Sur iPhone : dans Safari, touche Partager (le carré avec une flèche), puis « Sur l’écran d’accueil ». Ouvre ensuite l’appli depuis son icône.';
    else it.textContent='Pour l’installer : menu ⋮ du navigateur, puis « Installer l’appli » ou « Ajouter à l’écran d’accueil ».';
    Notif.render();
  }
  el('telInstall').addEventListener('click',async()=>{if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice}catch(e){}installEvt=null;render()});
  return {render,sync:()=>Notif.sync()};
})();
$('#fMember').addEventListener('submit',async e=>{
  e.preventDefault();if(!db)return;
  const err=t=>{$('#mErr').textContent=t;$('#mErr').hidden=false};$('#mErr').hidden=true;
  const data={first:$('#mFirst').value.trim().replace(/\s+/g,' '),last:$('#mLast').value.trim().replace(/\s+/g,' '),weight:Number($('#mWeight').value),height:Number($('#mHeight').value)};
  if(!data.first||!data.last)return err('Indique ton prénom et ton nom.');
  if(!(data.weight>=30&&data.weight<=200))return err('Le poids doit être entre 30 et 200 kg.');
  if(!(data.height>=120&&data.height<=230))return err('La taille doit être entre 120 et 230 cm.');
  const pin=$('#mPin').value.trim(),pin2=$('#mPin2').value.trim();
  if(pin&&!/^\d{4,8}$/.test(pin))return err('Le code doit contenir 4 à 8 chiffres.');
  if(pin!==pin2)return err('Les deux codes ne sont pas identiques.');
  const id=$('#mId').value||newId('members');
  const prev=S.members.get(id);data.createdAt=prev?.createdAt||Date.now();
  if(prev&&Array.isArray(prev.push))data.push=prev.push;
  if(prev&&prev.notifs&&typeof prev.notifs==='object')data.notifs=prev.notifs;
  if(prev&&prev.off)data.off=true;
  data.pin=pin?await hashPin(id,pin):($('#mPinOff').checked?null:(prev?.pin||null));
  setDoc('members/'+id,data);S.members.set(id,data);
  if(!prev&&!me){me=id;lsSet('adb-me',id)}
  toast(prev?'Fiche mise à jour':'Inscription enregistrée');resetMemberForm();renderAll();
});

/* ---------- fights ---------- */
function emptyRound(){const c=()=>({poing:0,pied:0,genou:0,coude:0,bal:0,kd:0,warn:0});return {r:c(),b:c(),win:null}}
const DISC={BA:{label:'Boxe anglaise',short:'Anglaise',cls:'ba'},BF:{label:'Boxe française',short:'Française',cls:'bf'},BT:{label:'Boxe thaï',short:'Thaï',cls:'bt'}};
const disc=f=>DISC[f.disc]||DISC.BA;
const cnt=(side,k)=>side[k]||0;
const touches=side=>cnt(side,'poing')+cnt(side,'pied')+cnt(side,'genou')+cnt(side,'coude');
function roundPts(rd){
  if(!rd.win)return null;
  let r=rd.win==='b'?9:10,b=rd.win==='r'?9:10;
  r-=rd.r.kd+rd.r.warn;b-=rd.b.kd+rd.b.warn;
  return {r:Math.max(r,5),b:Math.max(b,5)};
}
function totals(f){let r=0,b=0,n=0;for(const rd of f.scores){const p=roundPts(rd);if(p){r+=p.r;b+=p.b;n++}}return {r,b,n}}
function updateDiff(){
  const r=member($('#fRed').value),b=member($('#fBlue').value),el=$('#fDiff');
  if(!r||!b||$('#fRed').value===$('#fBlue').value){el.hidden=true;return}
  const dw=Math.abs(r.weight-b.weight),dh=Math.abs(r.height-b.height);
  el.hidden=false;el.className='diff'+(dw>5?' warn':'');
  const disc=$('#fDisc').value,p=winProb($('#fRed').value,$('#fBlue').value,disc),er=eloOf($('#fRed').value,disc).r,eb=eloOf($('#fBlue').value,disc).r;
  el.textContent=`Écart : ${dw.toFixed(1).replace('.',',')} kg et ${dh} cm`+(dw>5?' — gros écart de poids, adaptez l’intensité.':'')+` · Elo ${er} contre ${eb} : chances estimées ${Math.round(p*100)} % rouge, ${100-Math.round(p*100)} % bleu.`;
}
$('#fDisc').addEventListener('change',updateDiff);
['#fRed','#fBlue'].forEach(s=>$(s).addEventListener('change',updateDiff));
$('#fDate').value=today;
$('#fFight').addEventListener('submit',e=>{
  e.preventDefault();if(!db)return;
  const red=$('#fRed').value,blue=$('#fBlue').value;
  if(!red||!blue){toast('Choisis un boxeur dans chaque coin.');return}
  if(red===blue){toast('Il faut deux boxeurs différents.');return}
  const n=Number($('#fRounds').value);
  const id=newId('fights');
  const data={disc:$('#fDisc').value,red,blue,rounds:n,dur:Number($('#fDur').value),ref:$('#fRef').value.trim(),date:$('#fDate').value||today,
    status:'prevu',scores:Array.from({length:n},emptyRound),log:[],result:null,createdAt:Date.now(),rev:Date.now()};
  setDoc('fights/'+id,data);localF.set(id,data);
  $('#fRef').value='';openFight(id);
});
function fightStatusPill(f){return f.status==='fini'?'<span class="pill done">Terminé</span>':f.status==='live'?'<span class="pill live">En cours</span>':'<span class="pill">Prévu</span>'}
function renderFightList(){
  const all=[...new Set([...S.fights.keys(),...localF.keys()])].map(id=>[id,getFight(id)]).filter(x=>x[1]).sort((a,b)=>(b[1].date||'').localeCompare(a[1].date||'')||b[1].createdAt-a[1].createdAt);
  $('#fCount').textContent=all.length?all.length+' combat'+(all.length>1?'s':''):'';
  const el=$('#fightsList');
  if(!all.length){el.innerHTML='<div class="empty"><strong>Aucun combat</strong>Chaque combat créé apparaîtra ici avec ses deux coins et le score. Ouvre-le pour arbitrer reprise par reprise.</div>';return}
  el.innerHTML=all.map(([id,f])=>{const t=totals(f);const d=f.date?parseYmd(f.date):null;
    return `<button class="fcard" data-act="open" data-id="${id}">
      <div class="side r">${esc(mName(f.red))}</div>
      <div class="mid"><span class="score">${t.n?t.r+' – '+t.b:'vs'}</span></div>
      <div class="side b">${esc(mName(f.blue))}</div>
      <div class="meta">${fightStatusPill(f)}<span class="pill ${disc(f).cls}"><i class="ic ${disc(f).cls}"></i>${disc(f).short}</span><span class="num">${f.rounds} × ${f.dur/60>=1?String(f.dur/60).replace('.',','):f.dur/60} min</span>${d?`<span>${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}</span>`:''}${f.status==='fini'&&f.result?`<span>· ${esc(resultText(f))}</span>`:''}</div>
    </button>`}).join('');
}
function resultText(f){
  const r=f.result;if(!r)return '';
  if(r.method==='NUL'||!r.winner)return 'Match nul';
  return 'Victoire de '+mName(r.winner==='r'?f.red:f.blue,true)+' '+METHODS[r.method];
}
function openFight(id){ui.fightId=id;ui.round=0;const f=getFight(id);if(f){const i=f.scores.findIndex(r=>!r.win);ui.round=i<0?f.rounds-1:i}chrono={running:false,start:0,elapsed:0};renderFights();window.scrollTo({top:0})}
function mutateFight(fn){
  const id=ui.fightId,cur=getFight(id);if(!cur||!db)return;
  if(!canWrite){toast('Lecture seule.');return}
  const f=structuredClone(cur);fn(f);f.rev=Date.now()+Math.random();
  localF.set(id,f);renderFights();
  clearTimeout(fTimer[id]);
  fTimer[id]=setTimeout(()=>enqueue('fights/'+id,()=>{const l=localF.get(id);return l?db.doc('fights/'+id).set(l):undefined}),350);
}
const EV={poing:'touche poing',pied:'touche pied',genou:'touche genou',coude:'touche coude',bal:'balayage / déséquilibre',kd:'compté',warn:'avertissement'};
function fmt(sec){sec=Math.max(0,Math.floor(sec));return Math.floor(sec/60)+':'+pad(sec%60)}
function chronoSec(){return (chrono.elapsed+(chrono.running?Date.now()-chrono.start:0))/1000}
function renderBout(){
  const f=getFight(ui.fightId),el=$('#bout');
  if(!f){ui.fightId=null;return false}
  const t=totals(f),rd=f.scores[ui.round]||emptyRound(),bf=f.disc==='BF',bt=f.disc==='BT',done=f.status==='fini',conf=ui.confirm==='f:'+ui.fightId;
  const R=member(f.red),B=member(f.blue);
  const ctr=(c,k,label)=>`<div class="ctr"><span>${label}</span><button data-w data-act="dec" data-c="${c}" data-k="${k}" aria-label="Retirer ${label}" ${done?'disabled':''}>−</button><span class="v">${cnt(rd[c],k)}</span><button class="plus" data-w data-act="inc" data-c="${c}" data-k="${k}" aria-label="Ajouter ${label}" ${done?'disabled':''}>+</button></div>`;
  const col=c=>`<div class="jcol ${c}"><div class="eyebrow">${c==='r'?'Coin rouge':'Coin bleu'} · reprise ${ui.round+1}</div>
    ${ctr(c,'poing','Touches poing')}${bf||bt?ctr(c,'pied','Touches pied'):''}${bt?ctr(c,'genou','Touches genou')+ctr(c,'coude','Touches coude')+ctr(c,'bal','Balayage / déséquilibre'):''}${ctr(c,'kd','Compté (au sol)')}${ctr(c,'warn','Avertissement (−1)')}</div>`;
  const pts=roundPts(rd);
  const touchR=touches(rd.r),touchB=touches(rd.b);
  const suggestWin=t.r>t.b?'r':t.b>t.r?'b':'';
  el.innerHTML=`
  <div class="row" style="align-items:center"><button class="btn ghost small" data-act="back" style="flex:0 0 auto">‹ Tous les combats</button><span style="flex:1 1 auto" class="hint">${disc(f).label} · ${f.rounds} reprise${f.rounds>1?'s':''} de ${fmt(f.dur)}${f.ref?' · arbitre '+esc(f.ref):''}</span>${fightStatusPill(f)}</div>
  <div class="bout-head">
    <div class="corner r"><div class="sub">Coin rouge</div><div class="nm">${esc(mName(f.red))}</div><div class="sub num">${R?R.weight+' kg · '+R.height+' cm':''}</div></div>
    <div class="tot"><div class="num"><span style="color:var(--red)">${t.r}</span> – <span style="color:var(--blue)">${t.b}</span></div><div class="hint">${t.n}/${f.rounds} notée${t.n>1?'s':''}</div></div>
    <div class="corner b"><div class="sub">Coin bleu</div><div class="nm">${esc(mName(f.blue))}</div><div class="sub num">${B?B.weight+' kg · '+B.height+' cm':''}</div></div>
  </div>
  ${done?`<div class="panel"><div class="result">${esc(resultText(f))}</div>${(()=>{const pf=elo('all').per[ui.fightId];if(!pf)return '';const sg=v=>(v>0?'+':'')+v;return `<div class="elo-change"><span style="color:var(--red)">${esc(mName(f.red,true))} : ${pf.ra} → ${pf.ra+pf.da} (${sg(pf.da)})</span><span style="color:var(--blue)">${esc(mName(f.blue,true))} : ${pf.rb} → ${pf.rb+pf.db} (${sg(pf.db)})</span></div><p class="hint" style="margin:0">Classement Elo général · chances estimées avant le combat : ${Math.round(pf.pa*100)} % rouge.</p>`})()}<div class="row"><button class="btn ghost small" data-w data-act="reopen" style="flex:0 0 auto">Rouvrir le combat</button></div></div>`:''}
  <div class="rounds">${f.scores.map((r,i)=>{const p=roundPts(r);return `<button data-act="round" data-i="${i}" aria-pressed="${i===ui.round}">R${i+1}<small>${p?p.r+'-'+p.b:'—'}</small></button>`}).join('')}</div>
  ${done?'':`<div class="chrono"><span class="clock ${chronoSec()>=f.dur?'over':''}" id="clock">${fmt(chronoSec())}</span><span class="hint">/ ${fmt(f.dur)}</span>
    <button class="btn small" data-act="chrono">${chrono.running?'Pause':chronoSec()>0?'Reprendre':'Box !'}</button><button class="btn ghost small" data-act="chronoReset">Remettre à zéro</button></div>`}
  <div class="judge">${col('r')}${col('b')}</div>
  <div class="panel">
    <div class="cal-head"><h3>Qui gagne la reprise ${ui.round+1} ?</h3><span class="hint num">Touches ${touchR} – ${touchB}</span></div>
    <div class="win">
      <button class="r" data-w data-act="win" data-v="r" aria-pressed="${rd.win==='r'}" ${done?'disabled':''}>Rouge</button>
      <button class="e" data-w data-act="win" data-v="=" aria-pressed="${rd.win==='='}" ${done?'disabled':''}>Égalité</button>
      <button class="b" data-w data-act="win" data-v="b" aria-pressed="${rd.win==='b'}" ${done?'disabled':''}>Bleu</button>
    </div>
    <div class="hint">${pts?`Carte de la reprise : <b class="num" style="color:var(--red)">${pts.r}</b> – <b class="num" style="color:var(--blue)">${pts.b}</b>. Chaque compté et chaque avertissement retire un point.`:'Le gagnant de la reprise marque 10, l’autre 9. Les comptés et avertissements retirent un point chacun.'}</div>
    ${!done&&ui.round<f.rounds-1&&rd.win?`<button class="btn ghost small" data-act="round" data-i="${ui.round+1}" style="justify-self:start">Reprise suivante ›</button>`:''}
  </div>
  <div class="panel card-tbl"><h3>Carte de pointage</h3>
    <table><thead><tr><th>Coin</th>${f.scores.map((_,i)=>`<th>R${i+1}</th>`).join('')}<th>Total</th></tr></thead><tbody>
    <tr><td class="r">Rouge</td>${f.scores.map(r=>{const p=roundPts(r);return `<td>${p?p.r:'–'}</td>`}).join('')}<td class="r">${t.r}</td></tr>
    <tr><td class="b">Bleu</td>${f.scores.map(r=>{const p=roundPts(r);return `<td>${p?p.b:'–'}</td>`}).join('')}<td class="b">${t.b}</td></tr>
    <tr><td class="hint">Touches</td>${f.scores.map(r=>`<td class="hint">${touches(r.r)}-${touches(r.b)}</td>`).join('')}<td></td></tr>
    </tbody></table></div>
  ${done?'':`<form class="panel" id="fEnd"><h3>Fin du combat</h3>
    <div class="row">
      <label for="endMethod">Décision<select id="endMethod">${Object.entries({PTS:'Aux points',KO:'KO',ARB:"Arrêt de l'arbitre",ABD:'Abandon',DQ:'Disqualification',NUL:'Match nul'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label for="endWinner">Vainqueur<select id="endWinner"><option value="r" ${suggestWin==='r'?'selected':''}>Rouge · ${esc(mName(f.red,true))}</option><option value="b" ${suggestWin==='b'?'selected':''}>Bleu · ${esc(mName(f.blue,true))}</option></select></label>
    </div>
    <button class="btn" data-w type="submit" style="justify-self:start">Terminer le combat</button></form>`}
  <div class="panel"><h3>Journal de l'arbitre</h3>
    <div class="log">${f.log.length?f.log.slice().reverse().map(l=>`<div><span class="dot ${l.c}"></span><span class="num hint">R${l.round+1} ${l.t||''}</span><span>${esc(mName(l.c==='r'?f.red:f.blue,true))} : ${EV[l.k]||l.k}${l.undo?' (annulé)':''}</span></div>`).join(''):'<span class="hint">Chaque touche, compté et avertissement noté apparaîtra ici.</span>'}</div>
  </div>
  <div class="row">${conf?`<button class="btn danger small" data-w data-act="fDelYes" style="flex:0 0 auto">Confirmer la suppression</button><button class="btn ghost small" data-act="noConfirm" style="flex:0 0 auto">Garder</button>`:`<button class="btn ghost small" data-w data-act="fDel" style="flex:0 0 auto">Supprimer ce combat</button>`}</div>`;
  return true;
}
function renderFights(){
  fillMemberSelect($('#fRed'),'Choisir…');fillMemberSelect($('#fBlue'),'Choisir…');updateDiff();
  const open=ui.fightId&&renderBout();
  $('#bout').hidden=!open;$('#fightList').hidden=!!open;
  if(!open)renderFightList();
  applyRO();
}
setInterval(()=>{if(!chrono.running)return;const c=$('#clock');const f=getFight(ui.fightId);if(c&&f){c.textContent=fmt(chronoSec());c.classList.toggle('over',chronoSec()>=f.dur)}},250);

$('#tab-combats').addEventListener('submit',e=>{
  if(e.target.id!=='fEnd')return;e.preventDefault();
  const method=$('#endMethod').value,winner=method==='NUL'?null:$('#endWinner').value;
  mutateFight(f=>{f.status='fini';f.result={method,winner}});chrono.running=false;toast('Combat terminé');
});

/* ---------- calendar ---------- */
function attOf(courseId){const m=new Map();for(const a of S.attendance.values())if(a.courseId===courseId&&S.members.has(a.memberId))m.set(a.memberId,a.status);return m}
/* F-04 : places limitées. Au-delà de « places », une nouvelle inscription passe en liste d'attente (statut « attente »),
   par ordre d'arrivée ; quand un inscrit se retire, le premier en attente prend sa place. */
function attWaiting(courseId){return [...S.attendance.values()].filter(a=>a.courseId===courseId&&a.status==='attente'&&S.members.has(a.memberId)).sort((a,b)=>(a.at||0)-(b.at||0))}
function courseFull(courseId){const c=S.courses.get(courseId);if(!c||!c.places)return false;let n=0;for(const v of attOf(courseId).values())if(v==='present')n++;return n>=c.places}
function attToggle(id,mid,v){
  const cur=attOf(id).get(mid);
  if(v==='present'&&(cur==='present'||cur==='attente')){setAtt(id,mid,null);if(cur==='present')promote(id,mid);return}
  if(v==='present'&&courseFull(id)){setAtt(id,mid,'attente');toast('Cours complet : tu es en liste d’attente (n° '+(attWaiting(id).length+1)+').');return}
  if(v==='absent'&&cur==='absent'){setAtt(id,mid,null);return}
  setAtt(id,mid,v);if(cur==='present'&&v!=='present')promote(id,mid);
}
function promote(id,leaving){const w=attWaiting(id).filter(a=>a.memberId!==leaving)[0];if(w){setAtt(id,w.memberId,'present');toast(mName(w.memberId,true)+' passe de la liste d’attente aux inscrits.')}}
function coursesOn(d){return [...S.courses.entries()].filter(([,c])=>c.date===d).sort((a,b)=>a[1].time.localeCompare(b[1].time))}
function courseHtml(id,c,showDate){
  const att=attOf(id),mine=me&&att.get(me),pres=[...att].filter(x=>x[1]==='present'),abs=[...att].filter(x=>x[1]==='absent');
  const d=parseYmd(c.date),endMin=Number(c.time.slice(0,2))*60+Number(c.time.slice(3))+(c.dur||90);
  const end=pad(Math.floor(endMin/60)%24)+':'+pad(endMin%60);
  const appel=ui.appel===id,conf=ui.confirm==='c:'+id,past=c.date<today;
  return `<div class="course ${courseCls(c.type)}">
    <div class="top"><span class="when num">${showDate?`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} · `:''}${esc(c.time)}–${end}</span><span class="pill ${courseCls(c.type)}"><i class="ic ${courseCls(c.type)}"></i>${esc(COURSE[c.type]||c.type)}</span></div>
    <div class="hint">${[c.place,c.coach?'coach '+c.coach:''].filter(Boolean).map(esc).join(' · ')||'&nbsp;'}</div>
    <div class="pres">${me&&S.members.has(me)?`<button class="btn small ghost yes" data-w data-act="att" data-id="${id}" data-v="present" aria-pressed="${mine==='present'}">${past?'J’étais là':'Je serai là'}</button><button class="btn small ghost no" data-w data-act="att" data-id="${id}" data-v="absent" aria-pressed="${mine==='absent'}">Absent</button>`:'<span class="hint">Choisis ton nom en haut de la page pour indiquer ta présence.</span>'}
      <span class="hint num" style="margin-left:auto">${pres.length} présent${pres.length>1?'s':''}${abs.length?' · '+abs.length+' absent'+(abs.length>1?'s':''):''}</span></div>
    ${appel?`<div class="chips">${sortedMembers().map(([mid])=>{const s=att.get(mid);return `<button class="chip ${s==='present'?'p':s==='absent'?'a':''}${isOff(member(mid))?' offc':''}" data-w data-act="appel" data-id="${id}" data-m="${mid}">${esc(mName(mid,true))}${isOff(member(mid))?' (désactivé)':''}</button>`}).join('')||'<span class="hint">Aucun membre inscrit.</span>'}</div><div class="hint">Touche un nom : présent, puis absent, puis sans réponse.</div>`
      :(pres.length||abs.length?`<div class="chips">${pres.map(([m])=>`<span class="chip p">${esc(mName(m,true))}</span>`).join('')}${abs.map(([m])=>`<span class="chip a">${esc(mName(m,true))}</span>`).join('')}</div>`:'')}
    <div class="row">
      <button class="btn ghost small" data-act="appelToggle" data-id="${id}" style="flex:0 0 auto">${appel?'Fermer l’appel':'Faire l’appel'}</button>
      ${conf?`<button class="btn danger small" data-w data-act="cDelYes" data-id="${id}" style="flex:0 0 auto">Supprimer ce cours</button>${c.serie?`<button class="btn danger small" data-w data-act="cDelSerie" data-id="${id}" style="flex:0 0 auto">Toute la série à venir</button>`:''}<button class="btn ghost small" data-act="noConfirm" style="flex:0 0 auto">Garder</button>`:`<button class="btn ghost small" data-w data-act="cEdit" data-id="${id}" style="flex:0 0 auto">Modifier</button><button class="btn ghost small" data-w data-act="cDel" data-id="${id}" style="flex:0 0 auto">Supprimer</button>`}
    </div></div>`;
}
/* ---------- Vue semaine : du dimanche au samedi ----------
   Pour chaque jour : les cours, qui est inscrit, et si l'on peut encore indiquer sa présence. */
const wkSun=s=>{const d=parseYmd(s);d.setDate(d.getDate()-d.getDay());return ymd(d)};
const wkAdd=(s,n)=>{const d=parseYmd(s);d.setDate(d.getDate()+n);return ymd(d)};
function renderSemaine(){
  if(!ui.wk)ui.wk=wkSun(today);
  if(!ui.wkOpen)ui.wkOpen=new Set();
  const a=parseYmd(ui.wk),b=parseYmd(wkAdd(ui.wk,6)),M=m=>new Date(2000,m,1).toLocaleDateString('fr-FR',{month:'short'});
  $('#wkTitle').textContent=a.getMonth()===b.getMonth()?`Du ${a.getDate()} au ${b.getDate()} ${MONTHS[b.getMonth()]}`:`Du ${a.getDate()} ${M(a.getMonth())} au ${b.getDate()} ${M(b.getMonth())}`;
  $('#wkToday').hidden=ui.wk===wkSun(today);
  const mine=me&&S.members.has(me);let h='',n=0,rep=0,open=0;
  for(let i=0;i<7;i++){
    const s=wkAdd(ui.wk,i),d=parseYmd(s);
    for(const [id,c] of coursesOn(s)){
      n++;
      const att=attOf(id),pres=sortedMembers().filter(([m])=>att.get(m)==='present'),abs=sortedMembers().filter(([m])=>att.get(m)==='absent');
      const nr=sortedMembers().filter(([m2,mm])=>!att.get(m2)&&!isOff(mm)).length,past=c.date<today,my=mine?att.get(me):null;
      if(!past){open++;if(my)rep++}
      const endMin=Number(c.time.slice(0,2))*60+Number(c.time.slice(3))+(c.dur||90),end=pad(Math.floor(endMin/60)%24)+':'+pad(endMin%60);
      const act=mine?'att':'needMe',dis=past?' disabled':' data-w',ex=ui.wkOpen.has(id);
      h+=`<div class="wkrow ${courseCls(c.type)}${s===today?' today':''}${past?' past':''}${my?' r-'+my:''}">
        <div class="wkr-day"><b>${DAYS[d.getDay()].slice(0,3)}</b><span class="num">${d.getDate()}</span></div>
        <button class="wkr-info" type="button" data-act="wkMore" data-id="${id}" aria-expanded="${ex}" aria-label="${esc(COURSE[c.type]||'Cours')} ${esc(DAYS[d.getDay()])} ${d.getDate()} à ${esc(c.time)}${c.place?', '+esc(c.place):''} : détails">
          <span class="wkr-t num"><i class="ic ${courseCls(c.type)}"></i>${esc(c.time.replace(':','h'))}</span><span class="wkr-p">${esc(c.place||COURSE[c.type]||'')}</span></button>
        <span class="wkr-n num${c.places&&pres.length>=c.places?' full':''}" title="${pres.length} inscrit${pres.length>1?'s':''}${c.places?' sur '+c.places+' places':''}">${pres.length}${c.places?'<small>/'+c.places+'</small>':'<small>✓</small>'}</span>
        <button class="wkr-b yes" type="button" data-act="${act}" data-id="${id}" data-v="present" aria-pressed="${my==='present'||my==='attente'}" aria-label="${my==='attente'?'En liste d’attente':'Je serai là'}"${dis}>${my==='attente'?'⏳':'✓'}</button>
        <button class="wkr-b no" type="button" data-act="${act}" data-id="${id}" data-v="absent" aria-pressed="${my==='absent'}" aria-label="Absent"${dis}>✕</button>
        ${ex?`<div class="wkr-more"><b>${esc(COURSE[c.type]||c.type)}</b> · ${esc(c.time)}–${end}${c.place?' · '+esc(c.place):''}${c.coach?' · '+esc(c.coach):''}<br>
          <span class="ok">${past?'Présents':'Inscrits'} (${pres.length})</span> : ${pres.length?pres.map(([m])=>esc(mName(m,true))).join(', '):'personne'}<br>
          ${c.places?`Places : ${pres.length}/${c.places}${attWaiting(id).length?` · <b>En attente (${attWaiting(id).length})</b> : ${attWaiting(id).map(a=>esc(mName(a.memberId,true))).join(', ')}`:''}<br>`:''}<span class="ko">Absents (${abs.length})</span>${abs.length?' : '+abs.map(([m])=>esc(mName(m,true))).join(', '):''} · ${Math.max(0,nr)} sans réponse${past?' · cours passé':''}</div>`:''}
      </div>`;
    }
  }
  const head=n?(mine?(open?`<p class="wksum">Tu as répondu à <b>${rep}/${open}</b> cours à venir · ✓ je serai là · ✕ absent</p>`:''):`<p class="wksum">Choisis ton nom en haut de la page pour t’inscrire.</p>`):'';
  const share=n?`<div class="row wkshare"><button class="btn ghost small" type="button" data-act="wkShare" data-k="sondage">📲 Partager le sondage</button><button class="btn ghost small" type="button" data-act="wkShare" data-k="inscrits">📋 Partager les inscrits</button></div>`:'';
  $('#wkDays').innerHTML=n?head+'<div class="wklist">'+h+'</div>'+share:'<p class="wknone" style="padding:8px 0">Pas de cours cette semaine.</p>';
}
/* Partage WhatsApp (F-01) : le sondage de la semaine avec le lien, ou le récapitulatif des inscrits.
   Feuille de partage du téléphone si elle existe (WhatsApp, Messages…), sinon lien WhatsApp direct. */
function wkShareText(k){
  const a=parseYmd(ui.wk||wkSun(today)),b=parseYmd(wkAdd(ui.wk||wkSun(today),6)),j=d=>`${DAYS[d.getDay()].slice(0,3)}. ${pad(d.getDate())}/${pad(d.getMonth()+1)}`;
  const lines=[];
  for(let i=0;i<7;i++){const s=wkAdd(ui.wk||wkSun(today),i),d=parseYmd(s);for(const [id,c] of coursesOn(s)){
    const where=`${j(d)} ${c.time.replace(':','h')}${c.place?' · '+c.place:''}`;
    if(k==='sondage')lines.push(`• ${where} (${COURSE[c.type]||'cours'})`);
    else{const att=attOf(id),pres=sortedMembers().filter(([m])=>att.get(m)==='present').map(([m])=>member(m).first);lines.push(`• ${where} : ${pres.length} inscrit${pres.length>1?'s':''}${pres.length?' — '+pres.join(', '):''}`)}
  }}
  const url=location.origin+location.pathname+'#calendrier',per=`du ${a.getDate()}/${pad(a.getMonth()+1)} au ${b.getDate()}/${pad(b.getMonth()+1)}`;
  return k==='sondage'?`🥊 *Cours de la semaine ${per}*\nDis-nous si tu viens :\n${lines.join('\n')}\n\n👉 Réponds en un appui (✓ / ✕) : ${url}`
    :`🥊 *Inscrits de la semaine ${per}*\n${lines.join('\n')}\n\nPas encore répondu ? 👉 ${url}`;
}
async function wkShare(k){
  const text=wkShareText(k);
  if(navigator.share){try{await navigator.share({text});return}catch(e){if(e&&e.name==='AbortError')return}}
  window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');
}
function wkGo(s){const el=$('#wkDays');ui.wk=s;el.classList.add('wkfade');setTimeout(()=>{renderSemaine();applyRO();el.classList.remove('wkfade')},120)}
$('#wkPrev').addEventListener('click',()=>wkGo(wkAdd(ui.wk||wkSun(today),-7)));
$('#wkNext').addEventListener('click',()=>wkGo(wkAdd(ui.wk||wkSun(today),7)));
$('#wkToday').addEventListener('click',()=>wkGo(wkSun(today)));
function renderCalendar(){
  renderSemaine();
  fillMemberSelect($('#me'),'Choisis ton nom',me);
  const m=ui.month,y=m.getFullYear(),mo=m.getMonth();
  $('#calTitle').textContent=MONTHS[mo]+' '+y;
  const first=new Date(y,mo,1),offset=(first.getDay()+6)%7,start=new Date(y,mo,1-offset);
  const byDate={};for(const c of S.courses.values())(byDate[c.date]=byDate[c.date]||[]).push(c);
  let h=['L','M','M','J','V','S','D'].map(d=>`<div class="dow">${d}</div>`).join('');
  const weeks=Math.ceil((offset+new Date(y,mo+1,0).getDate())/7);
  for(let i=0;i<weeks*7;i++){
    const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i),s=ymd(d),cs=byDate[s]||[];
    h+=`<button data-act="day" data-d="${s}" class="${d.getMonth()!==mo?'out':''} ${s===today?'today':''}" aria-pressed="${s===ui.day}" aria-label="${d.getDate()} ${MONTHS[d.getMonth()]}, ${cs.length} cours"><span>${d.getDate()}</span><span class="dots">${cs.slice(0,4).map(c=>`<i class="${courseCls(c.type)}"></i>`).join('')}</span></button>`;
  }
  $('#cal').innerHTML=h;
  const dd=parseYmd(ui.day);
  $('#dayTitle').textContent=`${DAYS[dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]}`;
  const day=coursesOn(ui.day);
  $('#dayList').innerHTML=day.length?day.map(([id,c])=>courseHtml(id,c,false)).join(''):`<div class="empty">Pas de cours ce jour-là. Ajoute-le avec le formulaire${ui.day>=today?' : la date est déjà remplie.':'.'}</div>`;
  if(!$('#cDate').value||$('#cDate').dataset.auto==='1'){$('#cDate').value=ui.day;$('#cDate').dataset.auto='1'}
  applyRO();
}
$('#cDate').addEventListener('input',e=>e.target.dataset.auto='0');
$('#calPrev').addEventListener('click',()=>{ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()-1,1);renderCalendar()});
$('#calNext').addEventListener('click',()=>{ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()+1,1);renderCalendar()});
/* Modifier un cours (ou la suite de sa série) : mêmes champs que l'ajout ; l'identifiant ne change pas, donc les présences restent. */
function courseFormReset(){
  ui.cEdit=null;$('#fCourse').reset();$('#cTitle').textContent='Ajouter un cours';$('#cSubmit').textContent='Ajouter au calendrier';
  $('#cCancel').hidden=$('#cScopeRow').hidden=$('#cEditHint').hidden=true;$('#cUntilRow').hidden=false;$('#cDate').dataset.auto='1';$('#cDate').value=ui.day;
}
function courseEdit(id){
  const c=S.courses.get(id);if(!c)return;ui.cEdit=id;
  $('#cType').value=c.type;$('#cDate').value=c.date;$('#cDate').dataset.auto='0';$('#cTime').value=c.time;$('#cPlace').value=c.place||'';$('#cCoach').value=c.coach||'';$('#cPlaces').value=c.places||'';
  const dur=String(c.dur||90);if(![...$('#cDurMin').options].some(o=>o.value===dur))$('#cDurMin').insertAdjacentHTML('beforeend',`<option value="${dur}">${Math.floor(dur/60)} h ${pad(dur%60)}</option>`);$('#cDurMin').value=dur;
  const serie=c.serie&&[...S.courses.values()].some(x=>x.serie===c.serie&&x.date>c.date);
  $('#cScopeRow').hidden=!serie;$('#cScope').value='one';$('#cUntilRow').hidden=true;$('#cEditHint').hidden=false;$('#cCancel').hidden=false;
  $('#cTitle').textContent='Modifier le cours';$('#cSubmit').textContent='Enregistrer';
  $('#fCourse').scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#cTime').focus({preventScroll:true}),300);
}
$('#cCancel').addEventListener('click',courseFormReset);
$('#fCourse').addEventListener('submit',async e=>{
  e.preventDefault();if(!db)return;
  const base={type:$('#cType').value,time:$('#cTime').value,dur:Number($('#cDurMin').value),place:$('#cPlace').value.trim(),coach:$('#cCoach').value.trim(),places:Math.max(0,parseInt($('#cPlaces').value)||0)||null};
  if(ui.cEdit){
    const id=ui.cEdit,c=S.courses.get(id);if(!c){toast('Ce cours a été supprimé entre-temps.');courseFormReset();return}
    const ids=$('#cScope').value==='serie'&&c.serie?[...S.courses].filter(([,x])=>x.serie===c.serie&&x.date>=c.date).map(([k])=>k):[id];
    $('#cSubmit').disabled=true;
    for(const k of ids)await enqueue('courses/'+k,()=>db.doc('courses/'+k).set(k===id?{...base,date:$('#cDate').value||c.date}:base,{merge:true}));
    $('#cSubmit').disabled=false;toast(ids.length>1?ids.length+' cours modifiés':'Cours modifié');
    const d0=$('#cDate').value||c.date;courseFormReset();ui.day=d0;const dd=parseYmd(d0);ui.month=new Date(dd.getFullYear(),dd.getMonth(),1);renderCalendar();return;
  }
  const d0=$('#cDate').value,until=$('#cUntil').value;if(!d0)return;
  const dates=[d0];
  if(until&&until>d0){let d=parseYmd(d0);while(dates.length<60){d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+7);const s=ymd(d);if(s>until)break;dates.push(s)}}
  const serie=dates.length>1?newId('courses'):null;
  $('#cSubmit').disabled=true;
  for(const date of dates){await setDoc('courses/'+newId('courses'),{...base,date,serie,createdAt:Date.now()})}
  $('#cSubmit').disabled=false;$('#cUntil').value='';
  toast(dates.length>1?dates.length+' cours ajoutés':'Cours ajouté');
  ui.day=d0;const dd=parseYmd(d0);ui.month=new Date(dd.getFullYear(),dd.getMonth(),1);renderCalendar();
});
async function deleteCourse(id){
  for(const [aid,a] of S.attendance)if(a.courseId===id)delDoc('attendance/'+aid);
  await delDoc('courses/'+id);
}
function setAtt(courseId,memberId,status){
  const path='attendance/'+courseId+'_'+memberId;
  if(!status)delDoc(path);else setDoc(path,{courseId,memberId,status,at:Date.now()});
}

/* ---------- notes (tickets) ---------- */
const NCAT={idee:'Idée',tache:'À faire',probleme:'Problème',info:'Info'};
const NSTAT={open:'Ouvert',doing:'En cours',done:'Résolu'};
let ntFilter='open',ntEditing=null,armedNt=null;
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
$('#ntFilter').addEventListener('click',e=>{const b=e.target.closest('button[data-f]');if(!b)return;ntFilter=b.dataset.f;[...$('#ntFilter').children].forEach(x=>x.setAttribute('aria-selected',x===b));renderNotes()});
function ntSubjectSet(t){const sel=$('#ntSubject');sel.querySelectorAll('option[data-legacy]').forEach(o=>o.remove());
  if(t&&![...sel.options].some(o=>o.value===t)){const o=document.createElement('option');o.textContent=t;o.dataset.legacy='1';sel.appendChild(o)}
  sel.value=t||''}
function ntReset(){ntEditing=null;$('#ntForm').reset();ntSubjectSet('');$('#ntTitle').textContent='Nouveau ticket';$('#ntSubmit').textContent='Créer le ticket';$('#ntCancel').hidden=true}
$('#ntCancel').addEventListener('click',()=>{ntReset();renderNotes()});
$('#ntForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!db)return;const title=$('#ntSubject').value.trim();if(!title)return;
  const mm=me&&member(me);
  const base={kind:'note',title,body:$('#ntBody').value.trim(),cat:$('#ntCat').value,prio:+$('#ntPrio').value,updated:new Date().toISOString()};
  if(ntEditing){const old=NOTES.get(ntEditing)||{};await setDoc('courses/'+ntEditing,Object.assign({},old,base));toast('Ticket modifié')}
  else{await setDoc('courses/n-'+rid(),Object.assign(base,{status:'open',at:new Date().toISOString(),author:mm?mm.first+' '+mm.last:'',authorId:mm?me:''}));toast('Ticket créé')}
  ntReset();renderNotes();
});
$('#ntList').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;const id=b.dataset.nid;const n=NOTES.get(id);if(!n)return;
  if(b.dataset.st){await setDoc('courses/'+id,Object.assign({},n,{status:b.dataset.st,updated:new Date().toISOString()}));return}
  if(b.dataset.nact==='edit'){ntEditing=id;ntSubjectSet(n.title||'');$('#ntBody').value=n.body||'';$('#ntCat').value=n.cat||'idee';$('#ntPrio').value=String(n.prio??1);
    $('#ntTitle').textContent='Modifier le ticket';$('#ntSubmit').textContent='Enregistrer';$('#ntCancel').hidden=false;window.scrollTo({top:0});$('#ntSubject').focus();return}
  if(b.dataset.nact==='del'){if(armedNt!==id){armedNt=id;renderNotes();setTimeout(()=>{if(armedNt===id){armedNt=null;renderNotes()}},3000);return}
    armedNt=null;await delDoc('courses/'+id);toast('Ticket supprimé')}
});
$('#ntCopy').addEventListener('click',async()=>{
  const l=[...NOTES.values()].filter(n=>n.status!=='done').sort((a,b)=>((b.prio??1)-(a.prio??1))||(a.at||'').localeCompare(b.at||''));
  if(!l.length){toast('Aucun ticket en cours.');return}
  const txt='Tickets Amicale des Bagarreurs en cours ('+l.length+') :\n\n'+l.map((n,i)=>`${i+1}. [${NCAT[n.cat]||'Note'}${n.prio===2?', priorité haute':''}] ${n.title}${n.body?'\n   '+n.body.replace(/\n/g,'\n   '):''}\n   (${n.author||'Anonyme'}, ${NSTAT[n.status]||'Ouvert'})`).join('\n\n');
  try{await navigator.clipboard.writeText(txt);toast('Tickets copiés : colle-les dans ta conversation avec Claude')}
  catch(err){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Tickets copiés')}catch(_){toast('Copie impossible sur ce téléphone.')}ta.remove()}
});
function renderNotes(){
  const mm=me&&member(me);
  $('#ntAuthor').textContent=mm?'Signé : '+mm.first+' '+mm.last:'Choisis ton nom en haut de la page pour signer tes tickets (sinon : anonyme).';
  const all=[...NOTES.entries()].map(([id,n])=>({id,...n})).sort((a,b)=>((b.status!=='done')-(a.status!=='done'))||((b.prio??1)-(a.prio??1))||(b.at||'').localeCompare(a.at||''));
  const list=all.filter(n=>ntFilter==='all'||(ntFilter==='done'?n.status==='done':n.status!=='done'));
  const nOpen=all.filter(n=>n.status!=='done').length;
  $('#ntCount').textContent=nOpen+' en cours · '+(all.length-nOpen)+' résolu'+(all.length-nOpen>1?'s':'');
  const el=$('#ntList');
  if(!connected){el.innerHTML='<div class="empty">Notes indisponibles pour le moment.</div>';return}
  if(!list.length){el.innerHTML=`<div class="empty">${all.length?'Aucun ticket dans ce filtre.':'<strong>Aucun ticket</strong>Écris le premier : une idée, une chose à faire, un problème…'}</div>`;return}
  el.innerHTML=list.map(n=>{const d=n.at?new Date(n.at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    return `<div class="ticket st-${n.status||'open'}">
      <div class="tk-top"><span class="pill ${esc(n.cat||'info')}">${NCAT[n.cat]||'Note'}</span>${n.prio===2?'<span class="pill live">Priorité haute</span>':n.prio===0?'<span class="pill">Basse</span>':''}<span class="tk-st">${NSTAT[n.status]||'Ouvert'}</span></div>
      <div class="tk-title">${esc(n.title)}</div>
      ${n.body?`<p class="tk-body">${esc(n.body)}</p>`:''}
      <p class="hint" style="margin:0">${esc(n.author||'Anonyme')} · ${esc(d)}</p>
      <div class="row">${['open','doing','done'].filter(k=>k!==(n.status||'open')).map(k=>`<button class="btn ghost small" data-w data-st="${k}" data-nid="${esc(n.id)}" style="flex:0 0 auto">${k==='done'?'Marquer résolu':k==='doing'?'Passer en cours':'Rouvrir'}</button>`).join('')}<button class="btn ghost small" data-w data-nact="edit" data-nid="${esc(n.id)}" style="flex:0 0 auto">Modifier</button><button class="btn ${armedNt===n.id?'danger':'ghost'} small" data-w data-nact="del" data-nid="${esc(n.id)}" style="flex:0 0 auto">${armedNt===n.id?'Confirmer ?':'Supprimer'}</button></div>
    </div>`}).join('');
  applyRO();
}

/* ---------- la salle : idées classées par ♥, part de chacun, achats (documents « courses » de kind « salle » / « salle-saison ») ---------- */
let SALLE=new Map();
/* Saisons sans partage des frais (2025-2026 : saison de démarrage, achats faits avant l'onglet) */
const SL_SANS_PART=['2025-2026'];
const SL={saison:'',f1:'all',edit:null,armed:null};
const saisonDe=d=>{const y=d.getFullYear();return d.getMonth()>=8?y+'-'+(y+1):(y-1)+'-'+y};
const saisonSuivante=s=>{const y=+s.slice(0,4)+1;return y+'-'+(y+1)};
const euros=n=>n==null||isNaN(n)?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:Math.round(n*100)%100?2:0,maximumFractionDigits:2}).format(n);
const slNum=v=>{v=String(v??'').replace(/\s|€/g,'').replace(',','.');if(!v)return null;const n=Number(v);return isFinite(n)&&n>=0?Math.round(n*100)/100:NaN};
const slItems=sec=>[...SALLE.entries()].filter(([,x])=>x.kind==='salle'&&x.saison===SL.saison&&x.sec===sec).map(([id,x])=>({id,...x}));
const slSaisonDoc=s=>SALLE.get('s-saison-'+s)||{};
const slQte=x=>x.qte>1?' ×'+x.qte:'';
const slMe=()=>{const m=me&&member(me);return m?{auteur:m.first+' '+m.last,auteurId:me}:{auteur:'',auteurId:''}};
const initiales=m=>((m.first||'?')[0]+((m.last||'')[0]||'')).toUpperCase();
/* Participants de la saison : profils actifs, sauf ceux décochés pour cette saison. */
function slParticipants(){const ex=new Set(slSaisonDoc(SL.saison).exclus||[]);return sortedMembers().filter(([id,m])=>!isOff(m)&&!ex.has(id)).map(([id])=>id)}
/* Une idée est « réalisée » quand elle a déjà été achetée ; sinon c'est un projet, classé selon ses ♥. */
function slEtat(x){return x.statut==='realise'?'done':'idea'}
const slLikes=x=>(x.soutiens||[]).filter(i=>S.members.has(i));
function slSaisons(){
  const s=new Set([saisonDe(new Date())]);
  for(const x of SALLE.values())if(/^\d{4}-\d{4}$/.test(x.saison||''))s.add(x.saison);
  return [...s].sort().reverse();
}
const slForm=sec=>document.getElementById('slF'+sec);
const SL_ADD={besoin:'slAdd1',achat:'slAdd3'};
const SL_BTN={besoin:'Proposer',achat:'Inscrire l’achat'};
function slResetForm(sec){const f=slForm(sec);f.reset();f.querySelector('[type=submit]').textContent=SL_BTN[sec];f.querySelector('[data-cancel]').hidden=true;if(SL.edit&&SL.edit.sec===sec)SL.edit=null;delete f.dataset.besoin}
function slFill(sec,x,editId){
  const f=slForm(sec);slResetForm(sec);
  for(const k of ['titre','qte','montant','desc','jour'])if(f.elements[k])f.elements[k].value=x[k]==null?(k==='qte'?1:''):String(k==='montant'?String(x[k]).replace('.',','):x[k]);
  if(x.besoinId)f.dataset.besoin=x.besoinId;
  if(editId){SL.edit={sec,id:editId};f.querySelector('[type=submit]').textContent='Enregistrer'}
  f.querySelector('[data-cancel]').hidden=false;
  const d=document.getElementById(SL_ADD[sec]);d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>f.elements.titre.focus(),250);
}
async function slSubmit(e){
  e.preventDefault();if(!db)return;
  const f=e.target,sec=f.dataset.sec,v=n=>f.elements[n]?f.elements[n].value.trim():'';
  const titre=v('titre');if(!titre){toast('Indique de quoi il s’agit.');f.elements.titre.focus();return}
  const montant=slNum(v('montant'));if(Number.isNaN(montant)){toast('Prix invalide : écris juste un nombre, par ex. 49,90.');f.elements.montant.focus();return}
  const data={titre,montant,desc:v('desc'),updated:new Date().toISOString()};
  if(f.elements.qte)data.qte=Math.min(999,Math.max(1,parseInt(v('qte'))||1));
  if(f.elements.jour)data.jour=v('jour');
  if(f.dataset.besoin)data.besoinId=f.dataset.besoin;
  const ed=SL.edit&&SL.edit.sec===sec?SL.edit.id:null;
  if(ed){const old=SALLE.get(ed);if(!old){toast('Cette ligne a été supprimée entre-temps.');slResetForm(sec);return}await setDoc('courses/'+ed,Object.assign({},old,data));toast('Modifié')}
  else{
    const base={kind:'salle',saison:SL.saison,sec,at:new Date().toISOString(),...slMe()};
    if(sec==='besoin'){base.statut='propose';base.soutiens=me&&member(me)?[me]:[]}
    await setDoc('courses/s-'+rid(),Object.assign(base,data));
    toast(sec==='besoin'?'Idée proposée, merci !':'Achat inscrit');
  }
  slResetForm(sec);document.getElementById(SL_ADD[sec]).open=false;renderSalle();
}
['besoin','achat'].forEach(sec=>{const f=slForm(sec);f.addEventListener('submit',slSubmit);f.querySelector('[data-cancel]').addEventListener('click',()=>{slResetForm(sec);document.getElementById(SL_ADD[sec]).open=false})});
$('#slSaison').addEventListener('change',e=>{SL.saison=e.target.value;['besoin','achat'].forEach(slResetForm);renderSalle()});
$('#slNext').addEventListener('click',async()=>{
  const s=saisonSuivante(slSaisons()[0]);
  if(+s.slice(0,4)>new Date().getFullYear()+1){toast('La saison '+slSaisons()[0]+' est déjà la prochaine.');return}
  await setDoc('courses/s-saison-'+s,{kind:'salle-saison',saison:s,exclus:[],payes:[],updated:new Date().toISOString()});
  SL.saison=s;toast('Saison '+s+' créée');renderSalle();
});
async function slSaisonArray(champ,id,on){
  const FV=firebase.firestore.FieldValue;
  try{await db.doc('courses/s-saison-'+SL.saison).set({kind:'salle-saison',saison:SL.saison,[champ]:on?FV.arrayUnion(id):FV.arrayRemove(id),updated:new Date().toISOString()},{merge:true})}catch(err){handleErr(err)}
}
$('#slPeople').addEventListener('click',e=>{const b=e.target.closest('button[data-pay]');if(!b||b.disabled||!db)return;slSaisonArray('payes',b.dataset.pay,!b.closest('.sl-person').classList.contains('paid'))});
$('#slPeople').addEventListener('change',e=>{const i=e.target.closest('input[data-part]');if(!i||!db)return;slSaisonArray('exclus',i.dataset.part,!i.checked)});
$('#tab-salle').addEventListener('click',async e=>{
  const b=e.target.closest('button[data-sl]');if(!b||b.disabled)return;
  const id=b.dataset.id,x=SALLE.get(id);if(!x)return;const a=b.dataset.sl;
  if(a==='edit')return slFill(x.sec,x,id);
  if(a==='buy')return slFill('achat',{titre:x.titre,montant:x.montant,qte:x.qte||1,jour:today,desc:'',besoinId:id});
  if(a==='del'){if(SL.armed!==id){SL.armed=id;renderSalle();setTimeout(()=>{if(SL.armed===id){SL.armed=null;renderSalle()}},3000);return}
    SL.armed=null;await delDoc('courses/'+id);toast('Supprimé');return}
  if(a==='vote'){
    if(!me||!member(me)){toast('Choisis ton nom en haut de la page pour aimer une idée.');return}
    const on=(x.soutiens||[]).includes(me),FV=firebase.firestore.FieldValue;
    try{await db.doc('courses/'+id).set({soutiens:on?FV.arrayRemove(me):FV.arrayUnion(me)},{merge:true})}catch(err){handleErr(err)}
  }
});
function slKpi(cls,label,val,sub){return `<div class="sl-kpi ${cls}"><span>${label}</span><b>${val}</b><small>${sub}</small></div>`}
function renderSalle(){
  const all=slSaisons();if(!SL.saison||!all.includes(SL.saison))SL.saison=all.includes(saisonDe(new Date()))?saisonDe(new Date()):all[0];
  $('#slSaison').innerHTML=all.map(s=>`<option value="${s}"${s===SL.saison?' selected':''}>Saison ${s}${s===saisonDe(new Date())?' (en cours)':''}</option>`).join('');
  document.querySelectorAll('.sl-sign').forEach(p=>{const m=me&&member(me);p.textContent=m?'Proposé par '+m.first+' '+m.last+' (ton ♥ est compté d’office)':'Choisis ton nom en haut de la page pour signer ta proposition (sinon : anonyme).'});
  const sum=l=>Math.round(l.reduce((t,x)=>t+(Number(x.montant)||0),0)*100)/100,sansPrix=l=>l.filter(x=>x.montant==null).length;
  const B=slItems('besoin'),A=slItems('achat'),S0=slSaisonDoc(SL.saison);
  const parts=slParticipants(),np=parts.length,pset=new Set(parts);
  const val=B;
  const total=sum(val),part=np?Math.round(total/np*100)/100:0;
  const payes=new Set((S0.payes||[]).filter(i=>pset.has(i))),collecte=Math.round(payes.size*part*100)/100,dep=sum(A);
  const off=!connected?'<div class="empty">Données indisponibles pour le moment.</div>':null;
  const sansPart=SL_SANS_PART.includes(SL.saison);$('#slH2').closest('section').hidden=sansPart;
  $('#slKpis').innerHTML=slKpi('k1','Total des projets',euros(total),`${val.length} projet${val.length>1?'s':''}${sansPrix(val)?` · ${sansPrix(val)} sans prix`:''}`)
    +(sansPart?slKpi('k2','Saison de démarrage','—','Pas de partage des frais cette saison'):slKpi('k2','Part par personne',euros(part),`${np} participant${np>1?'s':''} · ${payes.size} ${payes.size>1?'ont':'a'} payé`))
    +slKpi('k3','Dépensé',euros(dep),`${A.length} achat${A.length>1?'s':''}${sansPrix(A)?` · ${sansPrix(A)} prix à venir`:''}`);
  // 1. idées et projets : les plus aimées d'abord, les déjà achetées à la fin
  const lb=B.slice().sort((a,b)=>((slEtat(a)==='done')-(slEtat(b)==='done'))||(slLikes(b).length-slLikes(a).length)||(a.at||'').localeCompare(b.at||''));
  const maxL=Math.max(0,...lb.filter(b=>slEtat(b)!=='done').map(b=>slLikes(b).length));
  $('#slSum1').innerHTML=`<span>Total : <b>${euros(total)}</b>${sansPrix(val)?` <span class="hint">(+ ${sansPrix(val)} sans prix)</span>`:''}</span><span>${B.length} idée${B.length>1?'s':''}</span>`;
  const achatsDe=new Set(A.map(a=>a.besoinId).filter(Boolean));
  $('#slList1').innerHTML=off||(lb.length?lb.map((b,i)=>{
    const st=slEtat(b),vs=slLikes(b),mine=me&&vs.includes(me),d=b.at?new Date(b.at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'';
    const top=st!=='done'&&maxL>0&&vs.length===maxL;
    const pill=st==='done'?'<span class="pill done">Réalisée</span>':top?'<span class="pill live">♥ La plus aimée</span>':'';
    const faces=vs.map(i=>{const m=member(i);return `<span class="sl-face${i===me?' me':''}" title="${esc(m.first+' '+m.last)}">${esc(initiales(m))}</span>`}).join('');
    return `<div class="sl-item st-${st}${top?' st-top':''}"><div class="sl-it-top">${pill}<span class="sl-amt">${b.montant==null?'<span class="hint">prix ?</span>':euros(b.montant)}</span></div>
      <div class="tk-title">${esc(b.titre)}${slQte(b)}</div>${b.desc?`<p class="tk-body">${esc(b.desc)}</p>`:''}
      ${b.montant!=null&&np&&!sansPart?`<p class="hint">soit ${euros(Math.round(b.montant/np*100)/100)} par personne</p>`:''}
      ${vs.length?`<div class="sl-faces" aria-hidden="true">${faces}</div><p class="hint">♥ Aimée par ${esc(vs.map(i=>member(i).first).join(', '))}</p>`:st==='done'?'':'<p class="hint">Pas encore de ♥.</p>'}
      <p class="hint">${b.auteur?'Proposée par '+esc(b.auteur):st==='done'?'Achat de la saison':'Proposée anonymement'}${d&&st!=='done'?' · '+esc(d):''}</p>
      <div class="row"><button class="sl-like${mine?' on':''}" type="button" data-w data-sl="vote" data-id="${esc(b.id)}" aria-pressed="${mine?'true':'false'}" aria-label="${mine?'Je n’aime plus':'J’aime'} (${vs.length})"><span aria-hidden="true">${mine?'♥':'♡'}</span> ${vs.length}</button>${st!=='done'?`<button class="btn ghost small" data-w data-sl="buy" data-id="${esc(b.id)}">${achatsDe.has(b.id)?'✓ Acheté · autre achat':'Inscrire l’achat'}</button>`:''}<button class="btn ghost small" data-w data-sl="edit" data-id="${esc(b.id)}">Modifier</button><button class="btn ${SL.armed===b.id?'danger':'ghost'} small" data-w data-sl="del" data-id="${esc(b.id)}">${SL.armed===b.id?'Confirmer ?':'Supprimer'}</button></div></div>`}).join('')
    :`<div class="empty"><strong>Aucune idée pour l’instant</strong>Propose la première idée de la saison ci-dessous.</div>`);
  // 2. participation
  $('#slShare').innerHTML=`<div><span>Total des projets</span><b>${euros(total)}</b></div><div><span>Participants</span><b>${np}</b></div><div class="big"><span>À payer par personne</span><b>${euros(part)}</b></div>`
    +`<div><span>Déjà payé</span><b>${payes.size} / ${np}</b></div><div><span>Collecté</span><b>${euros(collecte)}</b></div><div><span>Reste à collecter</span><b>${euros(Math.max(0,Math.round((total-collecte)*100)/100))}</b></div>`;
  const ex=new Set(S0.exclus||[]);
  $('#slPeople').innerHTML=off||sortedMembers().filter(([,m])=>!isOff(m)).map(([id,m])=>{const inn=!ex.has(id),paid=inn&&payes.has(id);
    return `<div class="sl-person${inn?'':' out'}${paid?' paid':''}"><span class="sl-face${id===me?' me':''}" aria-hidden="true">${esc(initiales(m))}</span><span class="nm">${esc(m.first+' '+m.last)}</span>`
      +`<label title="Participe cette saison"><input type="checkbox" data-w data-part="${id}"${inn?' checked':''}>Participe</label>`
      +(inn?`<button class="sl-pay" type="button" data-w data-pay="${id}" aria-pressed="${paid}">${paid?'✓ Payé':'À payer'}</button>`:'')+'</div>'}).join('');
  // 3. achats
  const reste=Math.round((collecte-dep)*100)/100;
  $('#slSum3').innerHTML=`<span>Dépensé : <b>${euros(dep)}</b>${sansPrix(A)?` <span class="hint">(+ ${sansPrix(A)} prix à venir)</span>`:''}</span>`+(sansPart?'':`<span>Collecté : <b>${euros(collecte)}</b></span><span>${reste>=0?'En caisse':'Avancé (à rembourser)'} : <b class="${reste>=0?'sl-pos':'sl-neg'}">${euros(Math.abs(reste))}</b></span>`);
  $('#slList3').innerHTML=off||(A.length?A.sort((a,b)=>(b.jour||'').localeCompare(a.jour||'')||(a.at||'').localeCompare(b.at||'')).map(x=>{const d=x.jour?parseYmd(x.jour).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'';
    return `<div class="sl-item"><div class="sl-it-top">${x.montant==null?'<span class="pill idee">Prix à venir</span>':''}<span class="sl-amt">${x.montant==null?'':euros(Number(x.montant))}</span></div>
      <div class="tk-title">${esc(x.titre)}${slQte(x)}</div>${x.desc||d?`<p class="hint">${[d,esc(x.desc||'')].filter(Boolean).join(' · ')}</p>`:''}
      <div class="row"><button class="btn ghost small" data-w data-sl="edit" data-id="${esc(x.id)}">${x.montant==null?'Indiquer le prix':'Modifier'}</button><button class="btn ${SL.armed===x.id?'danger':'ghost'} small" data-w data-sl="del" data-id="${esc(x.id)}">${SL.armed===x.id?'Confirmer ?':'Supprimer'}</button></div></div>`}).join('')
    :'<div class="empty">Aucun achat inscrit pour cette saison.</div>');
  applyRO();
}

/* ---------- global clicks ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const a=b.dataset.act,id=b.dataset.id;
  switch(a){
    case 'noConfirm':ui.confirm=null;renderAll();break;
    case 'mOff':{const m=member(id);if(!m)break;if(id!==me&&!(await askPin(id,'Entre le code de ce profil pour l\u2019activer ou le désactiver')))break;setOff(id,!isOff(m));break}
    case 'mEdit':{const m=member(id);if(!m)break;if(id!==me&&!(await askPin(id,'Entre le code de ce profil pour le modifier')))break;openMemberForm(id);break}
    case 'mDel':if(id!==me&&!(await askPin(id,'Entre le code de ce profil pour le supprimer')))break;ui.confirm='m:'+id;renderMembers();break;
    case 'mDelYes':delDoc('members/'+id);if(me===id){me='';lsSet('adb-me','')}ui.confirm=null;toast('Membre supprimé');break;
    case 'open':openFight(id);break;
    case 'back':ui.fightId=null;ui.confirm=null;chrono.running=false;renderFights();break;
    case 'round':ui.round=Number(b.dataset.i);chrono={running:false,start:0,elapsed:0};renderFights();break;
    case 'chrono':if(chrono.running){chrono.elapsed+=Date.now()-chrono.start;chrono.running=false}else{chrono.start=Date.now();chrono.running=true;const f=getFight(ui.fightId);if(f&&f.status==='prevu')mutateFight(x=>{x.status='live'})}renderFights();break;
    case 'chronoReset':chrono={running:false,start:0,elapsed:0};renderFights();break;
    case 'inc':case 'dec':{const c=b.dataset.c,k=b.dataset.k,up=a==='inc';
      mutateFight(f=>{const rd=f.scores[ui.round];if(!up&&cnt(rd[c],k)===0)return;rd[c][k]=cnt(rd[c],k)+(up?1:-1);if(f.status==='prevu')f.status='live';
        f.log.push({round:ui.round,c,k,t:fmt(chronoSec()),undo:!up||undefined});if(f.log.length>300)f.log=f.log.slice(-300)});break}
    case 'win':mutateFight(f=>{const rd=f.scores[ui.round];rd.win=rd.win===b.dataset.v?null:b.dataset.v;if(f.status==='prevu')f.status='live'});break;
    case 'reopen':mutateFight(f=>{f.status='live';f.result=null});break;
    case 'fDel':ui.confirm='f:'+ui.fightId;renderFights();break;
    case 'fDelYes':{const fid=ui.fightId;clearTimeout(fTimer[fid]);localF.delete(fid);delDoc('fights/'+fid);ui.fightId=null;ui.confirm=null;toast('Combat supprimé');renderFights();break}
    case 'day':ui.day=b.dataset.d;const dd=parseYmd(ui.day);if(dd.getMonth()!==ui.month.getMonth())ui.month=new Date(dd.getFullYear(),dd.getMonth(),1);$('#cDate').dataset.auto='1';renderCalendar();break;
    case 'needMe':toast('Choisis ton nom en haut de la page pour t’inscrire.');break;
    case 'wkShare':wkShare(b.dataset.k);break;
    case 'wkMore':ui.wkOpen.has(id)?ui.wkOpen.delete(id):ui.wkOpen.add(id);renderSemaine();applyRO();break;
    case 'att':attToggle(id,me,b.dataset.v);break;
    case 'appelToggle':ui.appel=ui.appel===id?null:id;renderCalendar();break;
    case 'appel':{const cur=attOf(id).get(b.dataset.m);setAtt(id,b.dataset.m,!cur?'present':cur==='present'?'absent':null);break}
    case 'cEdit':courseEdit(id);break;
    case 'cDel':ui.confirm='c:'+id;renderCalendar();break;
    case 'cDelYes':deleteCourse(id);ui.confirm=null;toast('Cours supprimé');break;
    case 'cDelSerie':{const c=S.courses.get(id);if(c&&c.serie){for(const [cid,x] of S.courses)if(x.serie===c.serie&&x.date>=c.date)deleteCourse(cid)}ui.confirm=null;toast('Série supprimée');break}
  }
});

/* ---------- minuteur boxe ---------- */
(()=>{
const BUILTIN=[{name:'Boxe',rounds:6,work:180,rest:60},{name:'Amateur',rounds:3,work:120,rest:60},{name:'Tabata',rounds:8,work:20,rest:10},{name:'Sac',rounds:10,work:60,rest:30}];
const DEF={preset:'Boxe',rounds:6,work:180,rest:60,warmOn:false,warm:300,coolOn:false,cool:300,vol:100,voice:false,coach:false,coachEvery:6,vib:true,snd:{start:'bell',restEnd:'bell',workEnd:'triple_bell',count:'beep',interval:'double_beep',last10:'clapper',end:'fanfare'}};
const PH={prep:'Prêt ?',warm:'Échauffement',work:'Effort',rest:'Repos',cool:'Retour au calme'};
const COMBOS=['Jab','Double jab','Jab – cross','Jab – cross – crochet','Jab – cross – crochet – cross','Crochet – uppercut','Uppercut – crochet','Jab au corps – cross','Cross – crochet – cross','Esquive – cross','Esquive – crochet','Rotation – crochet – cross','Parade – contre','Jab – esquive – cross','Double uppercut – crochet','Pas de côté – jab – cross'];
const PREP=6;
const jget=(k,d)=>{try{const v=JSON.parse(lsGet(k)||'null');return v??d}catch(e){return d}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
let cfg=Object.assign({},DEF,jget('adb-tm-cfg',{}));
cfg.vol=100; // volume toujours au maximum à l'ouverture
cfg.snd=Object.assign({},DEF.snd,cfg.snd||{});
let mine=jget('adb-tm-presets',[]);if(!Array.isArray(mine))mine=[];
/* Exercices par round : catalogue (exercices.js) + exercices ajoutés sur ce téléphone */
const EXOS=window.ADB_EXOS||{};
let perso=jget('adb-tm-exos-perso',[]);if(!Array.isArray(perso))perso=[];
if(!Array.isArray(cfg.exos))cfg.exos=[];
const exoAt=i=>(cfg.exos[i]||'');
const exoOptions=v=>`<option value="">— Pas d’exercice —</option>`+Object.entries(EXOS).map(([g,l])=>`<optgroup label="${esc(g)}">${l.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')
  +(perso.length?`<optgroup label="Mes exercices">${perso.map(x=>`<option${x===v?' selected':''}>${esc(x)}</option>`).join('')}</optgroup>`:'')
  +(v&&!Object.values(EXOS).flat().includes(v)&&!perso.includes(v)?`<option selected>${esc(v)}</option>`:'');
let hist=jget('adb-tm-hist',[]);if(!Array.isArray(hist))hist=[];
let run=null,armedDel=null,armedHist=false,lastCombo='';
const saveCfg=()=>lsSet('adb-tm-cfg',JSON.stringify(cfg));
const fmtT=sec=>{sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?h+':'+pad(m)+':'+pad(s):m+':'+pad(s)};
const fmtS=sec=>sec<60?sec+' s':sec%60?fmtT(sec):sec/60+' min';

/* sons (Web Audio, aucun fichier) */
let ac=null,master=null;
function audio(){
  try{
    if(!ac){
      /* iPhone : jouer même quand l'interrupteur silencieux est activé (Safari 16.4+) */
      try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ac=new C({latencyHint:'interactive'});
      /* chaîne « volume maximum » : compresseur qui remonte les sons faibles, gain, puis limiteur pour ne pas saturer */
      master=ac.createGain();master.gain.value=1;
      const comp=ac.createDynamicsCompressor();comp.threshold.value=-26;comp.knee.value=6;comp.ratio.value=10;comp.attack.value=.002;comp.release.value=.12;
      const boost=ac.createGain();boost.gain.value=2.6;
      const lim=ac.createDynamicsCompressor();lim.threshold.value=-1;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.001;lim.release.value=.05;
      master.connect(comp);comp.connect(boost);boost.connect(lim);lim.connect(ac.destination);
    }
    if(ac.state==='suspended')ac.resume().catch(()=>{});
    return ac;
  }catch(e){return null}
}
function tone(f,dur,at,type,g){
  const a=audio();if(!a)return;
  const t=a.currentTime+(at||0)+.01,o=a.createOscillator(),v=a.createGain();
  o.type=type||'sine';o.frequency.value=f;g=g||.6;
  v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.01);
  v.gain.setValueAtTime(g,Math.max(t+.012,t+dur-.03));v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.03);
}
function ring(f,dur,at,g,type){
  const a=audio();if(!a)return;
  const t=a.currentTime+(at||0)+.01,o=a.createOscillator(),v=a.createGain();
  o.type=type||'sine';o.frequency.value=f;g=g||.5;
  v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.006);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.05);
}
let noiseBuf=null;
function noise(dur,at,freq,g){
  const a=audio();if(!a)return;
  if(!noiseBuf){noiseBuf=a.createBuffer(1,a.sampleRate*.5,a.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const t=a.currentTime+(at||0)+.01,src=a.createBufferSource(),bp=a.createBiquadFilter(),v=a.createGain();
  src.buffer=noiseBuf;bp.type='bandpass';bp.frequency.value=freq||1800;bp.Q.value=4;
  v.gain.setValueAtTime(g||1,t);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(bp);bp.connect(v);v.connect(master);src.start(t);src.stop(t+dur+.02);
}
function whistle(dur,at){
  // sifflet d'arbitre à bille : note aiguë, trille rapide (fréquence + volume) et souffle
  const a=audio();if(!a)return;
  const t=a.currentTime+(at||0)+.01,end=t+dur;
  const lfo=a.createOscillator();lfo.type='sine';lfo.frequency.value=34;
  const fm=a.createGain();fm.gain.value=170;lfo.connect(fm);
  const amD=a.createGain();amD.gain.value=.42;lfo.connect(amD);
  const am=a.createGain();am.gain.value=.58;amD.connect(am.gain);
  const env=a.createGain();env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(1,t+.012);env.gain.setValueAtTime(1,end-.04);env.gain.exponentialRampToValueAtTime(.0001,end);
  const o=a.createOscillator();o.type='sine';o.frequency.value=3250;fm.connect(o.frequency);
  const o2=a.createOscillator();o2.type='sine';o2.frequency.value=6500;const g2=a.createGain();g2.gain.value=.12;fm.connect(o2.frequency);o2.connect(g2);
  if(!noiseBuf){noiseBuf=a.createBuffer(1,a.sampleRate*.5,a.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const n=a.createBufferSource();n.buffer=noiseBuf;n.loop=true;const bp=a.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3250;bp.Q.value=6;const ng=a.createGain();ng.gain.value=.35;n.connect(bp);bp.connect(ng);
  o.connect(am);g2.connect(am);ng.connect(am);am.connect(env);env.connect(master);
  [lfo,o,o2,n].forEach(x=>{x.start(t);x.stop(end+.05)});
}
const bellAt=at=>{ring(880,1.5,at,.55);ring(880*2.76,.7,at,.18);ring(880*5.4,.35,at,.08)};
const SOUNDS={
  bell:{n:'Cloche de ring',f:()=>bellAt(0)},
  double_bell:{n:'Double cloche',f:()=>{bellAt(0);bellAt(.35)}},
  triple_bell:{n:'Triple cloche',f:()=>{bellAt(0);bellAt(.3);bellAt(.6)}},
  gong:{n:'Gong',f:()=>{ring(98,3,0,.8);ring(147,2.4,0,.35);ring(233,1.6,0,.2)}},
  beep:{n:'Bip court',f:()=>tone(1000,.15,0,'square',.35)},
  double_beep:{n:'Double bip',f:()=>{tone(1200,.1,0,'square',.33);tone(1200,.1,.16,'square',.33)}},
  long_beep:{n:'Bip long',f:()=>tone(880,.7,0,'square',.33)},
  high_beep:{n:'Bip aigu',f:()=>tone(1760,.18,0,'sine',.6)},
  clapper:{n:'Claquoir (10 s)',f:()=>{noise(.07,0,2200,1.4);noise(.07,.13,2200,1.4)}},
  woodblock:{n:'Bloc de bois',f:()=>{ring(1100,.2,0,1,'triangle');ring(1100,.09,0,.55,'square');ring(2350,.1,0,.45);ring(680,.14,0,.5,'sine');noise(.05,0,2600,1.6)}},
  whistle:{n:'Sifflet d’arbitre',f:()=>{whistle(.16,0);whistle(.6,.24)}},
  buzzer:{n:'Buzzer',f:()=>{tone(140,.8,0,'sawtooth',.45);tone(147,.8,0,'sawtooth',.35)}},
  chime_up:{n:'Carillon montant',f:()=>{ring(659,.6,0,.5);ring(784,.6,.18,.5);ring(1046,.9,.36,.5)}},
  chime_down:{n:'Carillon descendant',f:()=>{ring(1046,.6,0,.5);ring(784,.6,.18,.5);ring(659,.9,.36,.5)}},
  fanfare:{n:'Fanfare',f:()=>{tone(523.25,.16,0);tone(659.25,.16,.18);tone(783.99,.16,.36);tone(1046.5,.7,.54)}},
  tick:{n:'Tic',f:()=>tone(2000,.035,0,'square',.25)},
  voice:{n:'Voix',f:null},
  none:{n:'Aucun son',f:()=>{}}
};
const MOMENTS=[
  {k:'start',n:'Début de séance',d:'à l’appui sur Démarrer',v:()=>'C’est parti'},
  {k:'count',n:'Compte à rebours',d:'5 fois, une par seconde (5, 4, 3, 2, 1) avant chaque effort',v:x=>String(x||5)},
  {k:'restEnd',n:'Début de l’effort',d:'fin du repos, début du round',v:x=>x?'Round '+x:'Au travail'},
  {k:'interval',n:'Temps restant',d:'à 30 s, 1 min, 1 min 30… de la fin de l’effort',v:x=>'Plus que '+sayDur(x||60)},
  {k:'last10',n:'10 dernières secondes',d:'10 fois, une par seconde, jusqu’à la fin de l’effort',v:x=>!x||x===10?'10 secondes':String(x)},
  {k:'workEnd',n:'Fin de l’effort',d:'fin du round, début du repos',v:()=>'Repos'},
  {k:'end',n:'Fin de séance',d:'après le dernier round',v:()=>'Séance terminée'}
];
function sayDur(sec){const m=Math.floor(sec/60),r=sec%60;return m?(m+(m>1?' minutes':' minute')+(r?' '+r:'')):r+' secondes'}
function play(k,arg){
  const id=cfg.snd[k]||'none',mo=MOMENTS.find(x=>x.k===k);
  if(id==='voice'){speak(mo?mo.v(arg):'',true);return}
  const snd=SOUNDS[id];if(snd&&snd.f){audio();snd.f()}
}
const canSpeak='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
function speak(t,force){
  if(!canSpeak||!(force||cfg.voice))return;
  try{const u=new SpeechSynthesisUtterance(t);u.lang='fr-FR';u.volume=1;u.rate=1.1;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}
}
function vib(p){if(cfg.vib&&navigator.vibrate)try{navigator.vibrate(p)}catch(e){}}

/* écran allumé */
let wl=null;
async function lockOn(){
  try{if('wakeLock' in navigator&&document.visibilityState==='visible'&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null;paint()})}}catch(e){wl=null}
  paint();
}
function lockOff(){try{if(wl)wl.release()}catch(e){}wl=null}
document.addEventListener('visibilitychange',()=>{if(run&&document.visibilityState==='visible'){lockOn();tick()}});

/* séance */
function plan(){
  const p=[{k:'prep',d:PREP}];
  if(cfg.warmOn)p.push({k:'warm',d:cfg.warm});
  for(let i=1;i<=cfg.rounds;i++){p.push({k:'work',d:cfg.work,r:i,exo:exoAt(i-1)});if(i<cfg.rounds&&cfg.rest>0)p.push({k:'rest',d:cfg.rest,r:i})}
  if(cfg.coolOn)p.push({k:'cool',d:cfg.cool});
  return p;
}
const totalOf=ph=>ph.reduce((s,x)=>s+(x.k==='prep'?0:x.d),0);
function doneSec(now){
  if(!run)return 0;let s=0;
  for(let i=0;i<run.i;i++)if(run.phases[i].k!=='prep')s+=run.phases[i].d;
  const p=run.phases[run.i];if(p.k!=='prep')s+=p.d-Math.max(0,(run.paused?run.left:run.end-now)/1000);
  return s;
}
function cueEnter(p){
  run.combo='';run.nextCombo=performance.now()+cfg.coachEvery*1000;
  const voiced=id=>cfg.snd[id]==='voice';
  const nxw=run.phases.slice(run.i+1).find(x=>x.k==='work');
  if(p.k==='work'){play('restEnd',p.r);if(!voiced('restEnd'))speak(p.exo||'Round '+p.r);else if(p.exo)setTimeout(()=>speak(p.exo),900);vib([200,100,200])}
  else if(p.k==='rest'){play('workEnd');if(!voiced('workEnd'))speak(nxw&&nxw.exo?'Repos. Ensuite : '+nxw.exo:'Repos');vib([600])}
  else if(p.k==='warm'){speak('Échauffement');vib([300])}
  else if(p.k==='cool'){play('workEnd');speak('Retour au calme');vib([300])}
}
function cueSec(rem){
  const p=run.phases[run.i],nx=run.phases[run.i+1];
  if(rem<1||p.d<=rem)return;
  if(p.k!=='work'&&nx&&nx.k==='work'&&rem<=5){play('count',rem);return}
  if(p.k==='work'){
    if(rem<=10&&p.d>10){play('last10',rem);if(rem===10&&cfg.snd.last10!=='voice')speak('10 secondes');return}
    if(rem%30===0&&rem<p.d)play('interval',rem);
  }
}
function finish(complete){
  const now=performance.now(),sec=Math.round(complete?totalOf(run.phases):doneSec(now));
  if(sec>=10||complete){hist.unshift({at:new Date().toISOString(),name:cfg.preset||'Personnalisé',sec,done:!!complete});hist=hist.slice(0,100);lsSet('adb-tm-hist',JSON.stringify(hist))}
  run=null;lockOff();
  if(complete){play('end');if(cfg.snd.end!=='voice')speak('Séance terminée');vib([200,100,200,100,400]);toast('Séance terminée, bravo !')}
  renderHist();paint();
}
function tick(){
  if(!run||run.paused)return;
  const now=performance.now();let moved=false;
  while(now>=run.end){
    if(run.i+1>=run.phases.length){finish(true);return}
    run.i++;run.end+=run.phases[run.i].d*1000;moved=true;
  }
  if(moved){run.lastRem=null;cueEnter(run.phases[run.i])}
  const p=run.phases[run.i],rem=Math.ceil((run.end-now)/1000);
  if(rem!==run.lastRem){run.lastRem=rem;if(!moved)cueSec(rem)}
  if(cfg.coach&&p.k==='work'&&now>=run.nextCombo){
    run.nextCombo=now+cfg.coachEvery*1000;
    if(rem>11){let c;do{c=COMBOS[Math.floor(Math.random()*COMBOS.length)]}while(c===lastCombo&&COMBOS.length>1);lastCombo=c;run.combo=c;speak(c,true)}
  }
  paint(now);
}
setInterval(tick,100);
function start(){
  audio();
  if(run&&run.paused){const now=performance.now();run.end=now+run.left;run.nextCombo=now+cfg.coachEvery*1000;run.paused=false;lockOn();paint();return}
  if(run)return;
  const now=performance.now(),phases=plan();
  run={phases,i:0,end:now+phases[0].d*1000,paused:false,left:0,lastRem:null,combo:'',nextCombo:now};
  play('start');if(cfg.snd.start!=='voice')speak('Prêt');lockOn();tick();
  if(window.innerWidth<=760)$('#tmScreen').scrollIntoView({behavior:'smooth',block:'start'});
}
function pause(){if(!run||run.paused)return;run.left=Math.max(0,run.end-performance.now());run.paused=true;paint()}
function skip(){
  if(!run)return;audio();
  if(run.i+1>=run.phases.length){finish(true);return}
  const now=performance.now();run.i++;const d=run.phases[run.i].d*1000;
  if(run.paused)run.left=d;else run.end=now+d;
  run.lastRem=null;cueEnter(run.phases[run.i]);paint(now);
}
function stop(){if(!run)return;finish(false);toast('Séance arrêtée')}

/* affichage */
function paint(now){
  now=now||performance.now();
  const scr=$('#tmScreen');if(!scr)return;
  $('#tmSet').disabled=!!run;$('#tmLocked').hidden=!run;
  $('#tmStart').textContent=run&&run.paused?'Reprendre':'Démarrer';
  $('#tmStart').disabled=!!run&&!run.paused;$('#tmPause').disabled=!run||run.paused;$('#tmSkip').disabled=!run;$('#tmStop').disabled=!run;
  if(!run){
    const ph=plan(),tot=totalOf(ph);
    scr.dataset.ph='idle';scr.classList.remove('on','warn');
    $('#tmPh').textContent='Prêt';$('#tmRd').textContent=cfg.rounds+' round'+(cfg.rounds>1?'s':'');
    $('#tmClock').textContent=fmtT(cfg.work);$('#tmCombo').textContent='';
    $('#tmExo').innerHTML=exoAt(0)?`<small>1<sup>er</sup> exercice</small>${esc(exoAt(0))}`:'';
    $('#tmNext').textContent=cfg.preset||'Personnalisé';$('#tmLeft').textContent='Total '+fmtT(tot);
    $('#tmBarPh').style.width='0%';$('#tmBarAll').style.width='0%';
    $('#tmNote').textContent='Le son s’active au premier appui sur Démarrer.';
    return;
  }
  const p=run.phases[run.i],nx=run.phases[run.i+1],N=cfg.rounds;
  const left=Math.max(0,run.paused?run.left:run.end-now),rem=Math.ceil(left/1000);
  scr.dataset.ph=p.k;scr.classList.toggle('on',p.k!=='prep');
  scr.classList.toggle('warn',p.k!=='prep'&&p.d>10&&rem<=10);
  $('#tmPh').textContent=PH[p.k]+(run.paused?' · pause':'');
  $('#tmRd').textContent=p.k==='work'?`Round ${p.r} / ${N}`:p.k==='rest'?`Round ${p.r+1} / ${N} ensuite`:p.k==='cool'?`${N} / ${N} terminés`:`Round 1 / ${N} ensuite`;
  $('#tmClock').textContent=fmtT(rem);
  $('#tmCombo').textContent=p.k==='work'?run.combo:'';
  {const nxw=run.phases.slice(run.i+1).find(x=>x.k==='work');
   $('#tmExo').innerHTML=p.k==='work'?(p.exo?esc(p.exo):''):(nxw&&nxw.exo?`<small>À suivre</small>${esc(nxw.exo)}`:'');
   $('#tmExo').dataset.mode=p.k==='work'?'now':'next'}
  $('#tmNext').textContent=nx?'Ensuite : '+PH[nx.k].toLowerCase()+' '+fmtS(nx.d):'Dernière phase';
  const tot=totalOf(run.phases),dn=doneSec(now);
  $('#tmLeft').textContent='Reste '+fmtT(tot-dn);
  $('#tmBarPh').style.width=(100*(1-left/(p.d*1000))).toFixed(1)+'%';
  $('#tmBarAll').style.width=(tot?100*dn/tot:0).toFixed(1)+'%';
  $('#tmNote').textContent=wl?'Écran maintenu allumé pendant la séance.':'';
}
function setTime(id,sec){$('#'+id+'M').value=Math.floor(sec/60);$('#'+id+'S').value=sec%60}
function getTime(id,min,max){const v=Math.round((Number($('#'+id+'M').value)||0)*60+(Number($('#'+id+'S').value)||0));return clamp(v,min,max)}
function fillForm(){
  $('#tmRounds').value=cfg.rounds;setTime('tmWork',cfg.work);setTime('tmRest',cfg.rest);
  $('#tmWarmOn').checked=cfg.warmOn;setTime('tmWarm',cfg.warm);$('#tmWarmT').hidden=!cfg.warmOn;
  $('#tmCoolOn').checked=cfg.coolOn;setTime('tmCool',cfg.cool);$('#tmCoolT').hidden=!cfg.coolOn;
  const sel=$('#tmSnds');if(sel&&!sel.dataset.built){sel.dataset.built='1';
    sel.innerHTML=MOMENTS.map(m=>`<div class="tm-snd"><label class="lb" for="tmSnd-${m.k}">${m.n}<small>${m.d}</small></label><select id="tmSnd-${m.k}" data-snd="${m.k}">${Object.entries(SOUNDS).filter(([id])=>id!=='voice'||canSpeak).map(([id,x])=>`<option value="${id}">${x.n}</option>`).join('')}</select><button class="btn ghost small" type="button" data-tm="test" data-s="${m.k}" aria-label="Écouter : ${m.n}">▶</button></div>`).join('');
    sel.addEventListener('change',e=>{const t=e.target.closest('select[data-snd]');if(!t)return;cfg.snd[t.dataset.snd]=t.value;saveCfg();audio();play(t.dataset.snd,t.dataset.snd==='interval'?90:t.dataset.snd==='count'?3:undefined)});}
  MOMENTS.forEach(m=>{const e=$('#tmSnd-'+m.k);if(e&&e.value!==cfg.snd[m.k])e.value=cfg.snd[m.k]});
$('#tmVoice').checked=cfg.voice&&canSpeak;$('#tmVoice').disabled=!canSpeak;$('#tmTestVoice').disabled=!canSpeak;
  $('#tmCoach').checked=cfg.coach;$('#tmCoachEvery').value=String(cfg.coachEvery);$('#tmVib').checked=cfg.vib;
  $('#tmTotal').textContent=fmtT(totalOf(plan()));
  renderExos();
}
function renderExos(){
  const box=$('#tmExos');if(!box)return;
  box.innerHTML=Array.from({length:cfg.rounds},(_,i)=>`<label class="tm-exo-row"><span class="num">R${i+1}</span><select data-exo="${i}" aria-label="Exercice du round ${i+1}">${exoOptions(exoAt(i))}</select></label>`).join('');
}
function readExos(){
  const sel=[...document.querySelectorAll('#tmExos select[data-exo]')];
  if(sel.length)sel.forEach(x=>{cfg.exos[Number(x.dataset.exo)]=x.value});
  cfg.exos=Array.from({length:cfg.rounds},(_,i)=>cfg.exos[i]||'');
}
const sameExos=(a,b)=>JSON.stringify((a||[]).map(x=>x||''))===JSON.stringify((b||[]).map(x=>x||''));
function sharedList(){return [...SEANCES.entries()].sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','fr'))}
function matchPreset(){
  const b=BUILTIN.find(p=>p.rounds===cfg.rounds&&p.work===cfg.work&&p.rest===cfg.rest);
  const same=p=>p.rounds===cfg.rounds&&p.work===cfg.work&&p.rest===cfg.rest&&p.warmOn===cfg.warmOn&&p.coolOn===cfg.coolOn&&(!p.warmOn||p.warm===cfg.warm)&&(!p.coolOn||p.cool===cfg.cool)&&sameExos(p.exos,cfg.exos);
  const m=mine.find(same)||sharedList().map(x=>x[1]).find(same);
  if(cfg.preset&&m&&m.name===cfg.preset)return m.name;
  return (b&&b.name)||(m&&m.name)||'';
}
function readForm(){
  cfg.rounds=clamp(Math.round(Number($('#tmRounds').value)||1),1,50);
  cfg.work=getTime('tmWork',5,3600);cfg.rest=getTime('tmRest',0,1800);
  cfg.warmOn=$('#tmWarmOn').checked;cfg.warm=getTime('tmWarm',10,3600);
  cfg.coolOn=$('#tmCoolOn').checked;cfg.cool=getTime('tmCool',10,3600);
  readExos();
  cfg.preset=matchPreset();saveCfg();
  $('#tmWarmT').hidden=!cfg.warmOn;$('#tmCoolT').hidden=!cfg.coolOn;
  $('#tmTotal').textContent=fmtT(totalOf(plan()));renderPresets();paint();
}
function renderPresets(){
  const chip=(p,src,i)=>`<button type="button" class="chip" data-tm="preset" data-src="${src}" data-i="${i}" aria-pressed="${cfg.preset===p.name}">${esc(p.name)}<small>${fmtS(p.work)} / ${fmtS(p.rest)} ×${p.rounds}</small></button>`;
  const nx=p=>(p.exos||[]).filter(Boolean).length?` · ${(p.exos||[]).filter(Boolean).length} exos`:'';
  const chip2=(p,src,i,lab)=>`<button type="button" class="chip" data-tm="preset" data-src="${src}" data-i="${i}" aria-pressed="${cfg.preset===p.name}">${lab||''}${esc(p.name)}<small>${fmtS(p.work)} / ${fmtS(p.rest)} ×${p.rounds}${nx(p)}</small></button>`;
  $('#tmPresets').innerHTML=BUILTIN.map((p,i)=>chip(p,'b',i)).join('')
    +sharedList().map(([id,p])=>chip2(p,'g',id,'👥 ')+`<button type="button" class="chip del" data-tm="delPreset" data-src="g" data-i="${esc(id)}" aria-label="Supprimer le cours partagé ${esc(p.name)}">${armedDel==='g'+id?'Supprimer ?':'✕'}</button>`).join('')
    +mine.map((p,i)=>chip2(p,'m',i)+`<button type="button" class="chip del" data-tm="delPreset" data-i="${i}" aria-label="Supprimer le préréglage ${esc(p.name)}">${armedDel===i?'Supprimer ?':'✕'}</button>`).join('');
}
function renderHist(){
  $('#tmHistClear').hidden=!hist.length;$('#tmHistClear').textContent=armedHist?'Confirmer ?':'Effacer';
  $('#tmHistClear').className='btn small '+(armedHist?'danger':'ghost');
  $('#tmHist').innerHTML=hist.length?hist.slice(0,30).map(h=>{const d=new Date(h.at);return `<div class="tm-h"><span class="num">${esc(d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))} ${pad(d.getHours())}:${pad(d.getMinutes())}</span><span class="nm">${esc(h.name)}</span><span class="num">${fmtT(h.sec)}</span>${h.done?'':'<span class="pill">Interrompue</span>'}</div>`}).join(''):'<div class="empty">Tes séances apparaîtront ici avec la date, le préréglage et la durée.</div>';
}
$('#tmSet').addEventListener('input',readForm);
$('#tmSet').addEventListener('change',()=>{readForm();fillForm()});
$('#tmForm').addEventListener('submit',e=>{
  e.preventDefault();const name=$('#tmName').value.trim().slice(0,30);
  if(!name){toast('Donne un nom à ton cours.');$('#tmName').focus();return}
  if(BUILTIN.some(b=>b.name.toLowerCase()===name.toLowerCase())){toast('Ce nom est déjà pris par un préréglage de base.');return}
  readExos();
  const p={name,rounds:cfg.rounds,work:cfg.work,rest:cfg.rest,warmOn:cfg.warmOn,warm:cfg.warm,coolOn:cfg.coolOn,cool:cfg.cool,exos:cfg.exos.slice()};
  if($('#tmShare').checked){
    if(!db){toast('Pas de connexion : enregistre-le sur ce téléphone (décoche « Partager »).');return}
    const ex=sharedList().find(([,x])=>(x.name||'').toLowerCase()===name.toLowerCase()),mm=me&&member(me);
    const id=ex?ex[0]:'t-'+rid();
    setDoc('courses/'+id,Object.assign({},ex?ex[1]:{at:new Date().toISOString()},p,{kind:'seance',auteur:mm?mm.first+' '+mm.last:'',auteurId:mm?me:'',updated:new Date().toISOString()}));
    cfg.preset=name;saveCfg();$('#tmName').value='';toast(ex?'Cours du groupe mis à jour':'Cours enregistré pour tout le groupe');renderPresets();paint();return;
  }
  const i=mine.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());
  if(i>=0)mine[i]=p;else mine.push(p);mine=mine.slice(-20);
  lsSet('adb-tm-presets',JSON.stringify(mine));cfg.preset=name;saveCfg();$('#tmName').value='';
  toast(i>=0?'Préréglage mis à jour':'Préréglage enregistré');renderPresets();paint();
});
$('#tmVoice').addEventListener('change',e=>{cfg.voice=e.target.checked;saveCfg()});
$('#tmCoach').addEventListener('change',e=>{cfg.coach=e.target.checked;saveCfg()});
$('#tmCoachEvery').addEventListener('change',e=>{cfg.coachEvery=clamp(Number(e.target.value)||6,3,15);saveCfg()});
$('#tmVib').addEventListener('change',e=>{cfg.vib=e.target.checked;saveCfg();vib(200)});
$('#tab-minuteur').addEventListener('click',e=>{
  const b=e.target.closest('[data-tm]');if(!b||b.disabled)return;
  switch(b.dataset.tm){
    case 'start':start();break;
    case 'pause':pause();break;
    case 'skip':skip();break;
    case 'stop':stop();break;
    case 'test':{const s=b.dataset.s;audio();if(s==='voice')speak('Round 2. Repos. 10 secondes.',true);else play(s,s==='interval'?90:s==='count'?3:s==='restEnd'?2:undefined);break}
    case 'preset':{if(run)break;const p=b.dataset.src==='g'?SEANCES.get(b.dataset.i):(b.dataset.src==='b'?BUILTIN:mine)[Number(b.dataset.i)];if(!p)break;
      Object.assign(cfg,{rounds:p.rounds,work:p.work,rest:p.rest,exos:Array.isArray(p.exos)?p.exos.slice():[]},b.dataset.src!=='b'?{warmOn:!!p.warmOn,warm:p.warm||300,coolOn:!!p.coolOn,cool:p.cool||300}:{});
      cfg.preset=p.name;saveCfg();fillForm();renderPresets();paint();break}
    case 'delPreset':{if(run)break;
      if(b.dataset.src==='g'){const id=b.dataset.i,k='g'+id;if(armedDel!==k){armedDel=k;renderPresets();setTimeout(()=>{if(armedDel===k){armedDel=null;renderPresets()}},3000);break}
        armedDel=null;delDoc('courses/'+id);toast('Cours du groupe supprimé');break}
      const i=Number(b.dataset.i);
      if(armedDel!==i){armedDel=i;renderPresets();setTimeout(()=>{if(armedDel===i){armedDel=null;renderPresets()}},3000);break}
      armedDel=null;const p=mine[i];mine.splice(i,1);lsSet('adb-tm-presets',JSON.stringify(mine));
      if(p&&cfg.preset===p.name){cfg.preset=matchPreset();saveCfg()}toast('Préréglage supprimé');renderPresets();paint();break}
    case 'exoAll':{if(run)break;readExos();const f=cfg.exos.find(Boolean);if(!f){toast('Choisis d’abord l’exercice du 1er round.');break}cfg.exos=cfg.exos.map(()=>f);saveCfg();fillForm();paint();break}
    case 'exoRandom':{if(run)break;const pool=Object.entries(EXOS).filter(([g])=>g!=='Récupération').flatMap(([,l])=>l).concat(perso);let last='';
      cfg.exos=Array.from({length:cfg.rounds},()=>{let x;do{x=pool[Math.floor(Math.random()*pool.length)]}while(x===last&&pool.length>1);last=x;return x});cfg.preset=matchPreset();saveCfg();fillForm();renderPresets();paint();break}
    case 'exoClear':{if(run)break;cfg.exos=[];cfg.preset=matchPreset();saveCfg();fillForm();renderPresets();paint();break}
    case 'exoAdd':{const v=$('#tmExoNew').value.trim().slice(0,40);if(!v){$('#tmExoNew').focus();break}
      if(!perso.includes(v)&&!Object.values(EXOS).flat().includes(v)){perso.push(v);perso=perso.slice(-50);lsSet('adb-tm-exos-perso',JSON.stringify(perso))}
      readExos();const k=cfg.exos.findIndex(x=>!x);if(k>=0)cfg.exos[k]=v;saveCfg();$('#tmExoNew').value='';fillForm();paint();toast(k>=0?'« '+v+' » ajouté au round '+(k+1):'« '+v+' » ajouté à la liste');break}
    case 'clearHist':if(!armedHist){armedHist=true;renderHist();setTimeout(()=>{if(armedHist){armedHist=false;renderHist()}},3000);break}
      armedHist=false;hist=[];lsSet('adb-tm-hist','[]');renderHist();toast('Historique effacé');break;
  }
});
const sup=[];
if(!canSpeak)sup.push('annonces vocales');
if(!navigator.vibrate)sup.push('vibration');
if(!('wakeLock' in navigator))sup.push('écran maintenu allumé');
$('#tmSupport').textContent=sup.length?'Non pris en charge sur cet appareil : '+sup.join(', ')+'.':'';
fillForm();renderPresets();renderHist();paint();
window.tmRefresh=()=>{if(!run){cfg.preset=matchPreset()||cfg.preset}renderPresets()};
})();

function renderAll(){
  if(me&&loaded.members&&!S.members.has(me)){me='';lsSet('adb-me','')}
  renderMembers();renderElo();renderFights();renderCalendar();renderNotes();renderSalle();applyRO();
  Notif.render();Notif.sync();
}
renderAll();
boot();
