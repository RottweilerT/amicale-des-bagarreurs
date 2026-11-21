/* Minuteur — interface : « Mes séances », « Créer » (éditeur par blocs, modèles, générateur), « Historique », « Sons »,
   et l'écran « Séance en cours ». Toute la logique de temps est dans moteur.js, les sons dans sons.js, les données dans seances.js. */
(function(){
'use strict';
const M=window.ADB_MOTEUR,S=window.ADB_SEANCES,SON=window.ADB_SONS,L=window.ADB_LIB;
const $$=s=>document.querySelector(s);
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const say=m=>{if(typeof toast==='function')toast(m)};
/* 75 → « 1:15 » ; horloge : « 01:15 » */
const fT=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return h?h+':'+p2(m)+':'+p2(r):m+':'+p2(r)};
const fClock=s=>{s=Math.max(0,s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;return h?h+':'+p2(m)+':'+p2(r):p2(m)+':'+p2(r)};
const fC=M.fmtCourt;
const fDuree=s=>{s=Math.round(s);if(s<60)return s+' s';const h=Math.floor(s/3600),m=Math.round(s%3600/60);return h?h+' h '+(m?p2(m):''):m+' min'};
const NOM_T={act:'Activité',repos:'Repos',recup:'Récupération',rep:'Répétition',combo:'Combo',prep:'Préparation'};
const vue=$$('#mnVue'),root=$$('#tab-minuteur');
const ui={v:'liste',q:'',fDuree:'',fCat:'',fType:'',armed:null,armT:0};
const arm=k=>{if(ui.armed===k&&Date.now()-ui.armT<4000){ui.armed=null;return true}ui.armed=k;ui.armT=Date.now();setTimeout(()=>{if(ui.armed===k){ui.armed=null;rendre()}},4000);return false};

/* ================= feuille (panneau du bas) ================= */
let sheetCb=null;
function sheet(html,cb){$$('#mnSheetIn').innerHTML=html;$$('#mnSheet').hidden=false;sheetCb=cb||null;document.body.classList.add('mn-lock');
  const f=$$('#mnSheetIn [autofocus]');if(f)setTimeout(()=>f.focus(),30)}
function fermer(){$$('#mnSheet').hidden=true;$$('#mnSheetIn').innerHTML='';sheetCb=null;if($$('#mnRun').hidden)document.body.classList.remove('mn-lock')}

/* ================= navigation ================= */
function aller(v){ui.v=v;root.querySelectorAll('.mn-nav [data-v]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.v===v||(['editeur','simple','generateur'].includes(v)&&b.dataset.v==='creer'))));rendre();
  const t=$$('#mn');if(t&&t.getBoundingClientRect().top<0)t.scrollIntoView({block:'start'})}
function rendre(){
  if(ui.v==='liste')vue.innerHTML=vListe();
  else if(ui.v==='creer')vue.innerHTML=vCreer();
  else if(ui.v==='editeur')vue.innerHTML=vEditeur();
  else if(ui.v==='historique')vue.innerHTML=vHist();
  else if(ui.v==='sons')vue.innerHTML=vSons();
  else if(ui.v==='generateur')vue.innerHTML=vGen();
  else if(ui.v==='simple')vue.innerHTML=vSimple();
}

/* ================= Mes séances ================= */
const rap=Object.assign({travail:180,repos:60,rounds:8,prep:15},JSON.parse((()=>{try{return localStorage.getItem('adb-mn-rapide')}catch(e){return null}})()||'{}'));
const pas=d=>d<60?5:d<180?15:30;
function stepper(act,val,lab,extra){return `<div class="mn-step"><span class="lb">${lab}</span><div class="mn-step-c"><button type="button" class="btn ghost" data-mn="${act}" data-x="-1" ${extra||''} aria-label="${lab} : moins">−</button><button type="button" class="mn-step-v num" data-mn="${act}" data-x="0" ${extra||''} aria-label="${lab} : saisir">${val}</button><button type="button" class="btn ghost" data-mn="${act}" data-x="1" ${extra||''} aria-label="${lab} : plus">+</button></div></div>`}
function vListe(){
  const all=S.toutes();const enc=S.enCours.lire();
  let l=all;const q=S.chercher?ui.q.trim():'';
  if(q){const n=q.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();l=l.filter(x=>(x.s.nom+' '+x.r.zones.join(' ')+' '+x.r.cats.map(c=>S.CAT[c]).join(' ')).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(n))}
  if(ui.fDuree)l=l.filter(x=>ui.fDuree==='c'?x.r.duree<900:ui.fDuree==='m'?x.r.duree>=900&&x.r.duree<=1800:x.r.duree>1800);
  if(ui.fCat)l=l.filter(x=>x.r.cats.includes(ui.fCat));
  if(ui.fType==='fav')l=l.filter(x=>x.fav);else if(ui.fType==='groupe')l=l.filter(x=>x.src==='groupe');else if(ui.fType==='local')l=l.filter(x=>x.src==='local');
  l.sort((a,b)=>(b.fav-a.fav)||(b.utilise||b.maj||'').localeCompare(a.utilise||a.maj||''));
  const cats=[...new Set(all.flatMap(x=>x.r.cats))].filter(c=>S.CAT[c]);
  const chip=(k,v,t)=>`<button type="button" class="chip" data-mn="filtre" data-k="${k}" data-val="${v}" aria-pressed="${ui[k]===v}">${t}</button>`;
  return `
  ${enc&&enc.s?`<div class="panel mn-reprise"><div><b>Séance interrompue :</b> ${E(enc.s.nom||'Séance')} — étape ${(enc.snap&&enc.snap.i||0)+1}</div><div class="row"><button class="btn" type="button" data-mn="reprendreEnCours">Reprendre</button><button class="btn ghost" type="button" data-mn="abandonEnCours">${ui.armed==='abandon'?'Confirmer ?':'Abandonner'}</button></div></div>`:''}
  <div class="panel mn-rapide">
    <div class="mn-h"><h3>Mode rapide</h3><span class="hint">sans passer par l’éditeur</span></div>
    <div class="mn-rapide-g">
      ${stepper('rap',fT(rap.travail),'Activité','data-k="travail"')}${stepper('rap',fT(rap.repos),'Repos','data-k="repos"')}
      ${stepper('rap',rap.rounds,'Rounds','data-k="rounds"')}${stepper('rap',rap.prep+' s','Préparation','data-k="prep"')}
    </div>
    <div class="row"><button class="btn mn-go" type="button" data-mn="rapideGo">▶ Démarrer · ${fDuree(rap.prep+rap.rounds*rap.travail+(rap.rounds-1)*rap.repos)}</button><button class="btn ghost" type="button" data-mn="rapideEdit" style="flex:0 0 auto">Modifier en détail</button></div>
  </div>
  <div class="panel">
    <div class="mn-h"><h3>Mes séances</h3><button class="btn small" type="button" data-mn="vue" data-v="creer">+ Créer</button></div>
    <input type="search" id="mnQ" placeholder="Rechercher une séance (nom, zone, catégorie)" value="${E(ui.q)}" aria-label="Rechercher une séance">
    <div class="chips mn-filtres">${chip('fDuree','','Toutes durées')}${chip('fDuree','c','< 15 min')}${chip('fDuree','m','15–30 min')}${chip('fDuree','l','> 30 min')}</div>
    <div class="chips mn-filtres">${chip('fType','','Toutes')}${chip('fType','fav','★ Favorites')}${chip('fType','groupe','👥 Groupe')}${chip('fType','local','📱 Ce téléphone')}
      ${cats.length?`<select id="mnFCat" aria-label="Catégorie"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${c}"${ui.fCat===c?' selected':''}>${E(S.CAT[c])}</option>`).join('')}</select>`:''}</div>
    <div class="mn-liste">${l.map(cSeance).join('')||`<div class="empty">${all.length?'Aucune séance ne correspond à ces filtres.':'Aucune séance enregistrée pour l’instant. Crée la tienne, ou pars d’un modèle ci-dessous.'}</div>`}</div>
  </div>
  <div class="panel"><div class="mn-h"><h3>Modèles prêts à l’emploi</h3><span class="hint">modifiables</span></div>
    <div class="mn-modeles">${S.MODELES.map((m,k)=>{const r=S.resume(m);return `<button type="button" class="mn-modele" data-mn="modele" data-k="${k}"><b>${E(m.nom)}</b><small>${fDuree(r.duree)} · ${r.diff}</small></button>`}).join('')}</div></div>`;
}
function cSeance(x){
  const r=x.r,u=x.utilise?new Date(x.utilise):null;
  return `<article class="mn-sc${x.fav?' fav':''}">
    <div class="mn-sc-h"><button type="button" class="mn-star" data-mn="favSeance" data-id="${E(x.id)}" aria-pressed="${x.fav}" aria-label="Favorite">${x.fav?'★':'☆'}</button>
      <div class="mn-sc-t"><b>${E(x.s.nom||'Sans nom')}</b><small>${x.src==='groupe'?'👥 Groupe'+(x.auteur?' · '+E(x.auteur):''):'📱 Ce téléphone'}${u?' · utilisée le '+u.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):''}</small></div>
      <span class="pill mn-diff d${['Facile','Moyenne','Difficile','Très difficile'].indexOf(r.diff)}">${r.diff}</span></div>
    <div class="mn-sc-m num"><span><b>${fDuree(r.duree)}</b></span><span>${r.nbExos} exercice${r.nbExos>1?'s':''}</span><span>${r.rounds} round${r.rounds>1?'s':''}</span></div>
    ${r.zones.length?`<div class="mn-sc-z">${r.zones.map(z=>`<span>${E(z)}</span>`).join('')}</div>`:''}
    <div class="mn-sc-a"><button class="btn" type="button" data-mn="go" data-id="${E(x.id)}">▶ Démarrer</button><button class="btn ghost" type="button" data-mn="edit" data-id="${E(x.id)}">Modifier</button><button class="btn ghost" type="button" data-mn="menuSeance" data-id="${E(x.id)}" aria-label="Plus d’actions">⋯</button></div>
  </article>`;
}

/* ================= Créer ================= */
function vCreer(){
  const cb=S.tousCombos();
  return `<div class="panel"><div class="mn-h"><h3>Créer une séance</h3></div>
    <div class="mn-tuiles">
      <button type="button" class="mn-tuile" data-mn="vue" data-v="simple"><b>Simple</b><small>Des intervalles qui se répètent : activité, repos, rounds. Prête en 20 secondes.</small></button>
      <button type="button" class="mn-tuile" data-mn="nouvelle"><b>Avancée</b><small>Une suite libre de blocs : exercices, repos, répétitions, combos.</small></button>
      <button type="button" class="mn-tuile" data-mn="vue" data-v="liste-modeles"><b>Depuis un modèle</b><small>14 séances prêtes, entièrement modifiables.</small></button>
      <button type="button" class="mn-tuile" data-mn="vue" data-v="generateur"><b>Générateur</b><small>Choisis durée, zones, niveau, matériel : la séance se construit seule, en mélangeant les catégories.</small></button>
    </div></div>
  ${ed?`<div class="panel mn-reprise"><div><b>Brouillon en cours :</b> ${E(ed.s.nom||'Sans nom')}</div><button class="btn" type="button" data-mn="vue" data-v="editeur">Continuer</button></div>`:''}
  <div class="panel" id="mnModeles"><div class="mn-h"><h3>Modèles</h3></div><div class="mn-modeles">${S.MODELES.map((m,k)=>{const r=S.resume(m);return `<button type="button" class="mn-modele" data-mn="modele" data-k="${k}"><b>${E(m.nom)}</b><small>${fDuree(r.duree)} · ${r.nbExos} exos · ${r.diff}</small></button>`}).join('')}</div></div>
  <div class="panel"><div class="mn-h"><h3>Mes combos</h3><span class="hint">réutilisables dans toutes les séances</span></div>
    <div class="mn-combos">${cb.map(c=>`<div class="mn-cb"><button type="button" class="mn-star" data-mn="favCombo" data-id="${E(c.id)}" aria-pressed="${S.fav.combos.includes(c.id)}">${S.fav.combos.includes(c.id)?'★':'☆'}</button><div><b>${E(c.nom)}</b><small>${E(c.mvts.filter(m=>m.t==='act').map(m=>(m.reps?m.reps+' × ':fC(m.d)+' ')+m.exo.nom.toLowerCase()).join(' + '))}${c.tours>1?' · ×'+c.tours:''}</small></div>${c.base?'<span class="pill">Exemple</span>':`<button class="btn ghost small" type="button" data-mn="delCombo" data-id="${E(c.id)}">${ui.armed==='cb'+c.id?'Confirmer ?':'Supprimer'}</button>`}</div>`).join('')}</div>
    <p class="hint" style="margin:0">Pour créer un combo : dans l’éditeur, « + Combo », ou sélectionne plusieurs blocs puis « Combiner ».</p></div>`;
}
function vSimple(){
  const o=ui.simple||(ui.simple={rounds:6,travail:180,repos:60,prep:10,exo:null});
  return `<div class="panel"><div class="mn-h"><h3>Séance simple</h3><button class="btn ghost small" type="button" data-mn="vue" data-v="creer">Retour</button></div>
    <div class="mn-rapide-g">${stepper('simp',o.rounds,'Rounds','data-k="rounds"')}${stepper('simp',fT(o.travail),'Activité','data-k="travail"')}${stepper('simp',fT(o.repos),'Repos','data-k="repos"')}${stepper('simp',o.prep+' s','Préparation','data-k="prep"')}</div>
    <div class="mn-tl">Exercice de chaque round</div>
    <button type="button" class="mn-pick" data-mn="simpExo">${o.exo?E(o.exo.nom):'Round (sans exercice précis)'}<small>Toucher pour choisir dans la bibliothèque</small></button>
    <div class="mn-total num">Durée totale <b>${fT(o.prep+o.rounds*o.travail+(o.rounds-1)*o.repos)}</b></div>
    <div class="row"><button class="btn" type="button" data-mn="simpCreer">Continuer dans l’éditeur</button><button class="btn ghost" type="button" data-mn="simpGo" style="flex:0 0 auto">▶ Démarrer</button></div>
    <p class="hint" style="margin:0">Dans l’éditeur, tu pourras donner un exercice différent à chaque round (« Indépendantes »).</p></div>`;
}

/* ================= Générateur ================= */
const gen=Object.assign({duree:20,zones:[],cats:[],niveau:2,cardio:2,impact:3,mat:[],travail:40,repos:20,echauffement:true},JSON.parse((()=>{try{return localStorage.getItem('adb-mn-gen')}catch(e){return null}})()||'{}'));
function vGen(){
  const c=(k,v,t,multi)=>`<button type="button" class="chip" data-mn="gen" data-k="${k}" data-val="${v}" ${multi?'data-multi="1"':''} aria-pressed="${multi?gen[k].includes(v):String(gen[k])===String(v)}">${t}</button>`;
  return `<div class="panel mn-gen"><div class="mn-h"><h3>Générateur de séance</h3><button class="btn ghost small" type="button" data-mn="vue" data-v="creer">Retour</button></div>
    <div class="mn-tl">Durée</div><div class="chips">${[10,15,20,30,45,60].map(d=>c('duree',d,d+' min')).join('')}</div>
    <div class="mn-tl">Zones (aucune = corps entier)</div><div class="chips">${Object.entries(S.ZONES_NOM).map(([k,t])=>c('zones',k,t,1)).join('')}</div>
    <div class="mn-tl">Niveau</div><div class="chips">${c('niveau',1,'Débutant')}${c('niveau',2,'Intermédiaire')}${c('niveau',3,'Avancé')}</div>
    <div class="mn-tl">Intensité cardio</div><div class="chips">${c('cardio',1,'Douce')}${c('cardio',2,'Moyenne')}${c('cardio',3,'Élevée')}</div>
    <div class="mn-tl">Impact</div><div class="chips">${c('impact',1,'Sans saut')}${c('impact',2,'Modéré')}${c('impact',3,'Tous')}</div>
    <div class="mn-tl">Matériel disponible</div><div class="chips">${Object.entries(L.materiel).map(([k,t])=>c('mat',k,t,1)).join('')}</div>
    <div class="mn-rapide-g">${stepper('genT',fT(gen.travail),'Travail','data-k="travail"')}${stepper('genT',fT(gen.repos),'Repos','data-k="repos"')}</div>
    <details class="mn-det"><summary>Catégories précises (facultatif)</summary><div class="chips">${L.cats.map(([k,t])=>c('cats',k,t,1)).join('')}</div></details>
    <label class="check"><input type="checkbox" data-mn="genEch" ${gen.echauffement?'checked':''}> Échauffement et retour au calme (séances de 10 min et plus)</label>
    <button class="btn mn-go" type="button" data-mn="genGo">Générer la séance</button></div>`;
}

/* ================= Éditeur ================= */
let ed=null; // {s, existe, partage, gen, sel:Set, selListe, occTab:{}, etat}
try{const b=JSON.parse(localStorage.getItem('adb-mn-brouillon')||'null');if(b&&b.s)ed={s:M.normaliser(b.s),existe:!!b.existe,partage:!!b.partage,sel:new Set(),selListe:null,occTab:{},etat:b.existe?'ok':'brouillon'}}catch(e){}
function ouvrir(s,o){o=o||{};ed={s:M.normaliser(s),existe:!!o.existe,partage:!!o.partage,gen:o.gen||null,sel:new Set(),selListe:null,occTab:{},etat:o.existe?'ok':'brouillon'};garderBrouillon();aller('editeur')}
function garderBrouillon(){try{localStorage.setItem('adb-mn-brouillon',JSON.stringify({s:ed.s,existe:ed.existe,partage:ed.partage}))}catch(e){}}
let saveT=0;
/* toute modification passe par ici : brouillon local + sauvegarde automatique si la séance est déjà enregistrée */
function modifie(){
  garderBrouillon();
  if(ed.existe){ed.etat='encours';clearTimeout(saveT);saveT=setTimeout(()=>{const v=M.valider(ed.s);if(!v.ok||!ed.s.nom.trim()){ed.etat='invalide';majEtat();return}
    try{ed.s=S.enregistrer(ed.s,ed.partage);ed.etat='ok';garderBrouillon()}catch(e){ed.etat='erreur'}majEtat()},600)}
  rendre();
}
function majEtat(){const e=$$('#mnEtat');if(e)e.outerHTML=etatHtml()}
function etatHtml(){const t={brouillon:'Brouillon — pas encore enregistrée',encours:'Enregistrement…',ok:'✓ Enregistrée'+(ed.partage?' pour le groupe':' sur ce téléphone'),invalide:'⚠ Non enregistrée : corrige les erreurs ci-dessous',erreur:'⚠ Échec de l’enregistrement (connexion ?)'}[ed.etat];
  return `<span id="mnEtat" class="mn-etat ${ed.etat}">${t}</span>`}
/* accès aux listes de blocs : « root », « <idRep> », « <idRep>#k » (tour indépendant), « <idCombo> » (mouvements) */
function trouverBloc(id,l,cle){
  l=l||ed.s.blocs;cle=cle||'root';
  for(let i=0;i<l.length;i++){const b=l[i];if(b.id===id)return {b,l,i,cle};
    if(b.t==='rep'){let r=trouverBloc(id,b.blocs,b.id);if(r)return r;if(!b.lie)for(let k=0;k<b.occ.length;k++){r=trouverBloc(id,b.occ[k].blocs,b.id+'#'+k);if(r)return r}}
    if(b.t==='combo'){const r=trouverBloc(id,b.mvts,b.id);if(r)return r}}
  return null;
}
function liste(cle){
  if(cle==='root')return ed.s.blocs;
  const [id,k]=cle.split('#');const x=trouverBloc(id);if(!x)return null;
  if(x.b.t==='combo')return x.b.mvts;
  return k!==undefined&&!x.b.lie?x.b.occ[Number(k)].blocs:x.b.blocs;
}
function vEditeur(){
  if(!ed)return `<div class="panel"><div class="empty">Aucune séance ouverte.</div><button class="btn" type="button" data-mn="nouvelle">Nouvelle séance</button></div>`;
  const v=M.valider(ed.s),steps=v.steps,tot=M.dureeTotale(steps),nb=new Set(steps.filter(x=>x.k==='act').map(x=>x.nom)).size;
  ed.suite={};steps.forEach((st,i)=>{if((st.k==='repos'||st.k==='recup')&&!(st.blocId in ed.suite)){const a=M.annonce(steps,i);ed.suite[st.blocId]=a?a.nom:'fin de la séance'}});
  ed.err={};v.erreurs.forEach(e=>{if(e.id)ed.err[e.id]=e.msg});
  const sel=ed.sel.size;
  return `<div class="mn-ed">
  ${ed.gen?`<div class="panel mn-info"><b>Séance générée.</b> Modifie-la librement, change un exercice avec « ⋯ », puis enregistre-la. <button class="btn ghost small" type="button" data-mn="genGo">↻ Régénérer</button></div>`:''}
  <div class="panel mn-ed-h">
    <input id="mnNom" maxlength="50" placeholder="Nom de la séance (ex. Circuit du mercredi)" value="${E(ed.s.nom)}" aria-label="Nom de la séance">
    <div class="mn-ed-row">${etatHtml()}
      <div class="mn-seg" role="group" aria-label="Où enregistrer"><button type="button" data-mn="partage" data-val="0" aria-pressed="${!ed.partage}">📱 Ce téléphone</button><button type="button" data-mn="partage" data-val="1" aria-pressed="${ed.partage}">👥 Groupe</button></div></div>
    <div class="mn-tl">Préparation avant de commencer</div>
    <div class="chips">${[0,5,10,15,20,30,60].map(d=>`<button type="button" class="chip" data-mn="prep" data-val="${d}" aria-pressed="${ed.s.prep===d}">${d?d+' s':'Aucune'}</button>`).join('')}<button type="button" class="chip" data-mn="prepPerso" aria-pressed="${![0,5,10,15,20,30,60].includes(ed.s.prep)}">${![0,5,10,15,20,30,60].includes(ed.s.prep)?ed.s.prep+' s':'Autre…'}</button></div>
  </div>
  <div class="mn-ed-tot"><div class="num"><b>${fT(tot)}</b><small>${steps.length} étapes · ${nb} exercice${nb>1?'s':''}</small></div>
    ${ed.existe?'':`<button class="btn ghost" type="button" data-mn="sauver">Enregistrer</button>`}<button class="btn" type="button" data-mn="goEd" ${v.ok?'':'disabled'}>▶ Démarrer</button></div>
  ${v.erreurs.length||v.avertissements.length?`<div class="mn-err">${v.erreurs.map(e=>`<div>⚠ ${E(e.msg)}</div>`).join('')}${v.avertissements.map(e=>`<div class="av">ℹ ${E(e.msg)}</div>`).join('')}</div>`:''}
  <div class="mn-tools"><button type="button" class="btn ghost small" data-mn="selMode" aria-pressed="${!!ed.selOn}">${ed.selOn?'Terminer la sélection':'Sélectionner'}</button>
    ${ed.selOn?`<span class="hint">${sel} bloc${sel>1?'s':''}</span><button class="btn small" type="button" data-mn="selRep" ${sel?'':'disabled'}>Répéter</button><button class="btn ghost small" type="button" data-mn="selCombo" ${sel?'':'disabled'}>Combiner</button><button class="btn ghost small" type="button" data-mn="selDup" ${sel?'':'disabled'}>Dupliquer</button><button class="btn ghost small danger-t" type="button" data-mn="selDel" ${sel?'':'disabled'}>${ui.armed==='selDel'?'Confirmer ?':'Supprimer'}</button>`:''}</div>
  ${rListe(ed.s.blocs,'root',0)}
  ${barreAjout('root')}
  ${ed.existe?`<div class="row mn-ed-bas"><button class="btn ghost" type="button" data-mn="nouvelle">Nouvelle séance</button><button class="btn ghost" type="button" data-mn="vue" data-v="liste">Mes séances</button></div>`:''}
  </div>`;
}
function barreAjout(cle,petit){
  const c=E(cle);
  return `<div class="mn-add${petit?' petit':''}"><button type="button" data-mn="add" data-t="act" data-l="${c}">+ Exercice</button><button type="button" data-mn="add" data-t="repos" data-l="${c}">+ Repos</button>${enCombo(cle)?'':`<button type="button" data-mn="add" data-t="recup" data-l="${c}">+ Récup.</button><button type="button" data-mn="add" data-t="rep" data-l="${c}">+ Répétition</button><button type="button" data-mn="add" data-t="combo" data-l="${c}">+ Combo</button>`}</div>`;
}
function enCombo(cle){if(cle==='root')return false;const x=trouverBloc(cle.split('#')[0]);return !!(x&&x.b.t==='combo')}
function rListe(l,cle,prof){return `<div class="mn-blocs" data-l="${E(cle)}">${l.map((b,i)=>rBloc(b,cle,i,prof)).join('')||'<div class="mn-vide">Vide : ajoute un bloc.</div>'}</div>`}
function dureeCtl(b){
  if(b.t==='act'&&b.reps)return `<div class="mn-dur"><button type="button" class="btn ghost" data-mn="reps" data-id="${b.id}" data-x="-1" aria-label="Moins de répétitions">−</button><button type="button" class="mn-dur-v num" data-mn="reps" data-id="${b.id}" data-x="0">${b.reps} rép.</button><button type="button" class="btn ghost" data-mn="reps" data-id="${b.id}" data-x="1" aria-label="Plus de répétitions">+</button></div>`;
  return `<div class="mn-dur"><button type="button" class="btn ghost" data-mn="dur" data-id="${b.id}" data-x="-1" aria-label="Moins de temps">−</button><button type="button" class="mn-dur-v num" data-mn="dur" data-id="${b.id}" data-x="0" aria-label="Saisir la durée">${fT(b.d)}</button><button type="button" class="btn ghost" data-mn="dur" data-id="${b.id}" data-x="1" aria-label="Plus de temps">+</button></div>`;
}
function rBloc(b,cle,i,prof){
  const selOn=ed.selOn,coche=ed.sel.has(b.id),err=ed.err[b.id];
  const head=`${selOn?`<label class="mn-sel"><input type="checkbox" data-mn="sel" data-id="${b.id}" data-l="${E(cle)}" ${coche?'checked':''} aria-label="Sélectionner"></label>`:`<span class="mn-poignee" data-drag="${b.id}" aria-hidden="true" title="Glisser pour déplacer">⠿</span>`}`;
  const menu=`<button type="button" class="mn-menu" data-mn="menuBloc" data-id="${b.id}" aria-label="Actions du bloc">⋯</button>`;
  if(b.t==='act'){const e=b.exo.id&&S.exo(b.exo.id);
    return `<div class="mn-b act${coche?' sel':''}${err?' err':''}" data-id="${b.id}">${head}
      <div class="mn-b-main">${e?`<button type="button" class="mn-b-img" data-mn="ficheExo" data-id="${E(e.id)}" aria-label="Fiche illustrée de ${E(e.nom)}">${imgMini(e.id)}</button>`:''}<button type="button" class="mn-b-nom" data-mn="choisirExo" data-id="${b.id}"><b>${E(b.exo.nom||'Choisir un exercice')}</b><small>${E(S.CAT[b.exo.cat]||'')}${b.variante?' · '+E(b.variante):''}${b.intensite?' · intensité '+'●'.repeat(b.intensite):''}${e&&e.mat?' · '+E(L.materiel[e.mat]):''}</small></button></div>
      ${dureeCtl(b)}${menu}${err?`<div class="mn-b-err">${E(err)}</div>`:''}</div>`}
  if(b.t==='repos'||b.t==='recup')return `<div class="mn-b ${b.t}${coche?' sel':''}" data-id="${b.id}">${head}
      <div class="mn-b-nom"><b>${b.t==='repos'?'Repos':'Récupération longue'}</b><small>puis : ${E(ed.suite[b.id]||'—')}${b.note?' · '+E(b.note):''}</small></div>${dureeCtl(b)}${menu}</div>`;
  if(b.t==='rep'){
    const tab=Math.min(ed.occTab[b.id]||0,b.n-1),cl=b.lie?b.id:b.id+'#'+tab;
    const inner=b.lie?b.blocs:b.occ[tab].blocs,dt=M.dureeTotale(M.compiler({prep:0,blocs:[Object.assign({},b,{finSansRepos:false})]}));
    return `<div class="mn-b rep${coche?' sel':''}${err?' err':''}${b.plie?' plie':''}" data-id="${b.id}">
      <div class="mn-rep-h">${head}<button type="button" class="mn-plier" data-mn="plier" data-id="${b.id}" aria-expanded="${!b.plie}" aria-label="Plier ou déplier">${b.plie?'▸':'▾'}</button>
        <div class="mn-rep-t"><b>Répéter</b><small>${inner.length} bloc${inner.length>1?'s':''} · ${fT(dt)} au total</small></div>
        <div class="mn-dur"><button type="button" class="btn ghost" data-mn="repN" data-id="${b.id}" data-x="-1" aria-label="Une fois de moins">−</button><span class="mn-dur-v num">×${b.n}</span><button type="button" class="btn ghost" data-mn="repN" data-id="${b.id}" data-x="1" aria-label="Une fois de plus">+</button></div>${menu}</div>
      ${b.plie?'':`<div class="mn-rep-c">
        <div class="mn-seg petit" role="group" aria-label="Mode des répétitions"><button type="button" data-mn="lie" data-id="${b.id}" data-val="1" aria-pressed="${b.lie}">Liées</button><button type="button" data-mn="lie" data-id="${b.id}" data-val="0" aria-pressed="${!b.lie}">Indépendantes</button></div>
        <p class="hint mn-rep-aide">${b.lie?'Modifier ces blocs modifie toutes les répétitions.':'Chaque tour se modifie séparément : choisis le tour.'}</p>
        ${b.lie?'':`<div class="chips mn-occ">${b.occ.map((_,k)=>`<button type="button" class="chip" data-mn="occ" data-id="${b.id}" data-k="${k}" aria-pressed="${k===tab}">Tour ${k+1}</button>`).join('')}</div>`}
        ${rListe(inner,cl,prof+1)}${barreAjout(cl,true)}
        ${b.finSansRepos?'<p class="hint mn-rep-aide">Le repos final du dernier tour est sauté.</p>':''}</div>`}
      ${err?`<div class="mn-b-err">${E(err)}</div>`:''}</div>`;
  }
  if(b.t==='combo'){
    const dt=b.mvts.reduce((t,m)=>t+(m.d||0),0);
    return `<div class="mn-b combo${coche?' sel':''}${err?' err':''}" data-id="${b.id}">
      <div class="mn-rep-h">${head}<div class="mn-rep-t"><input class="mn-combo-nom" data-mn-in="comboNom" data-id="${b.id}" value="${E(b.nom)}" maxlength="40" aria-label="Nom du combo"><small>Combo · ${fT(dt*b.tours)}${b.mvts.some(m=>m.reps)?' + répétitions':''}</small></div>
        <div class="mn-dur"><button type="button" class="btn ghost" data-mn="tours" data-id="${b.id}" data-x="-1" aria-label="Un tour de moins">−</button><span class="mn-dur-v num">×${b.tours}</span><button type="button" class="btn ghost" data-mn="tours" data-id="${b.id}" data-x="1" aria-label="Un tour de plus">+</button></div>${menu}</div>
      <div class="mn-rep-c">${rListe(b.mvts,b.id,prof+1)}${barreAjout(b.id,true)}</div>
      ${err?`<div class="mn-b-err">${E(err)}</div>`:''}</div>`;
  }
  return '';
}
function nouveauBloc(t){
  if(t==='act')return {t:'act',exo:{id:'',nom:'',cat:''},d:45};
  if(t==='repos')return {t:'repos',d:20};
  if(t==='recup')return {t:'recup',d:90};
  if(t==='rep')return {t:'rep',n:3,blocs:[{t:'act',exo:{id:'',nom:'',cat:''},d:45},{t:'repos',d:15}]};
  if(t==='combo')return {t:'combo',nom:'Mon combo',mvts:[{t:'act',exo:{id:'',nom:'',cat:''},d:30},{t:'act',exo:{id:'',nom:'',cat:''},d:30}]};
}
function ajouter(t,cle){
  const l=liste(cle);if(!l)return;
  if(t==='combo'&&S.tousCombos().length){
    const cb=S.tousCombos();
    sheet(`<div class="mn-sh-h"><h3>Ajouter un combo</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
      <button type="button" class="mn-pick" data-mn="comboNeuf" data-l="${E(cle)}"><b>+ Nouveau combo vide</b></button>
      ${cb.map(c=>`<button type="button" class="mn-pick" data-mn="comboAjout" data-cid="${E(c.id)}" data-l="${E(cle)}"><b>${S.fav.combos.includes(c.id)?'★ ':''}${E(c.nom)}</b><small>${E(c.mvts.filter(m=>m.t==='act').map(m=>(m.reps?m.reps+' × ':fC(m.d)+' ')+m.exo.nom.toLowerCase()).join(' + '))}</small></button>`).join('')}`);
    return;
  }
  const b=M.normBloc(nouveauBloc(t),0);l.push(b);
  if(t==='act'){modifie();choisirExo(b.id);return}
  modifie();
}

/* ---------- bibliothèque (sélecteur d'exercice) ---------- */
let pick={q:'',cat:'',cb:null,info:null};
function choisirExo(idBloc,cb){
  pick={q:'',cat:pick.cat||'',cb:cb||(e=>{const x=trouverBloc(idBloc);if(!x)return;x.b.exo=S.refExo(e);if(!x.b.d&&!x.b.reps)x.b.d=45;modifie()}),info:null};
  afficherPick();
}
function afficherPick(){
  sheet(`<div class="mn-sh-h"><h3>Bibliothèque</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
    <input type="search" id="mnPickQ" placeholder="Chercher : pompes, abdos, sac, épaules…" autofocus aria-label="Chercher un exercice">
    <div class="chips mn-pick-cats" id="mnPickCats"></div><div class="mn-pick-l" id="mnPickL"></div>`);
  const q=$$('#mnPickQ');if(q&&pick.q)q.value=pick.q;
  majPick();
}
function majPick(){
  const cats=$$('#mnPickCats');if(!cats)return;
  cats.innerHTML=[['','Tout'],['★','★ Favoris'],['perso','Mes exercices']].concat(L.cats).map(([k,t])=>`<button type="button" class="chip" data-mn="pickCat" data-k="${k}" aria-pressed="${pick.cat===k}">${E(t)}</button>`).join('');
  let l=S.chercher(pick.q,{cat:pick.cat&&pick.cat!=='★'&&pick.cat!=='perso'?pick.cat:'',fav:pick.cat==='★'});
  if(pick.cat==='perso')l=l.filter(e=>e.perso);
  const q=pick.q.trim();
  const exact=q&&S.tousExos().some(e=>e.nom.toLowerCase()===q.toLowerCase());
  $$('#mnPickL').innerHTML=(q&&!exact?`<button type="button" class="mn-pick perso" data-mn="pickPerso"><b>+ Créer l’exercice « ${E(q)} »</b><small>ajouté à « Mes exercices »${pick.cat&&S.CAT[pick.cat]?', catégorie '+E(S.CAT[pick.cat]):''}</small></button>`:'')
    +l.slice(0,150).map(e=>{const f=S.fav.exos.includes(e.id),open=pick.info===e.id;
      return `<div class="mn-ex${open?' open':''}"><button type="button" class="mn-star" data-mn="favExo" data-id="${e.id}" aria-pressed="${f}" aria-label="Favori">${f?'★':'☆'}</button>
      <button type="button" class="mn-ex-n" data-mn="pickExo" data-id="${e.id}">${imgMini(e.id)}<span><b>${E(e.nom)}</b><small>${E(S.CAT[e.cat]||'')}${(e.mp||[]).length?' · '+E(e.mp.map(m=>L.muscles[m]).join(', ')):''}${e.mat?' · '+E(L.materiel[e.mat]):''} · ${'●'.repeat(e.niv)}${'○'.repeat(3-e.niv)}</small></span></button>
      <button type="button" class="mn-ex-i" data-mn="ficheExo" data-id="${e.id}" data-pick="1" aria-label="Fiche illustrée de ${E(e.nom)}">i</button>
      ${open?`<div class="mn-ex-d"><p>${E(e.instr)}</p>${e.facile?`<p><b>Plus facile :</b> ${E(e.facile)}</p>`:''}${e.difficile?`<p><b>Plus difficile :</b> ${E(e.difficile)}</p>`:''}
        <p class="hint">${e.pos==='d'?'Debout':e.pos==='s'?'Au sol':'Debout et sol'} · ${e.esp==='p'?'sur place':'un peu d’espace'} · cardio ${'●'.repeat(e.cardio)} · impact ${'●'.repeat(e.impact)}${(e.ms||[]).length?' · aussi : '+E(e.ms.map(m=>L.muscles[m]).join(', ')):''}</p>
        ${e.perso?`<button class="btn ghost small" type="button" data-mn="delPerso" data-id="${e.id}">${ui.armed==='p'+e.id?'Confirmer ?':'Supprimer cet exercice'}</button>`:''}</div>`:''}</div>`}).join('')
    +(l.length?'':'<div class="empty">Aucun exercice trouvé.</div>');
}

/* ---------- fiches illustrées ---------- */
function imgMini(id,cls){const v=id&&S.visuel(id);return v?`<img class="${cls||'mn-mini'}" src="${E(v.mini)}" alt="" loading="lazy" decoding="async">`:''}
let ficheCtx=null;
function ouvrirFiche(id,o){
  o=o||{};const e=S.exo(id);if(!e)return;ficheCtx={id,o};const v=S.visuel(id);
  const corps=f=>{
    const et=f&&f.etapes&&v?f.etapes.map((x,i)=>`<li><img src="${E(v.dossier+x.image)}" alt="Étape ${i+1}" loading="lazy"><span><b>${i+1}.</b> ${E(x.texte)}</span></li>`).join(''):'';
    const varH=(lab,t,ex)=>t?`<p><b>${lab} :</b> ${E(t)}${ex&&S.exo(ex)?` <button type="button" class="mn-lien" data-mn="ficheExo" data-id="${E(ex)}"${o.pick?' data-pick="1"':''}>→ ${E(S.exo(ex).nom)}</button>`:''}</p>`:'';
    return `${v?`<div class="mn-fi-anim"><img src="${E(v.anim||v.mini)}" alt="Démonstration : ${E(e.nom)}"></div>`:''}
      <p class="hint" style="margin:0">${E((e.cats||[]).map(c=>S.CAT[c]).join(' · '))}${(e.mp||[]).length?' — '+E(e.mp.map(m=>L.muscles[m]).join(', ')):''}</p>
      ${et?`<ol class="mn-fi-etapes">${et}</ol>`:(f===undefined?'<p class="hint">Chargement des étapes…</p>':'')}
      <p><b>Consigne :</b> ${E((f&&f.instructions)||e.instr)}</p>
      ${f&&f.erreur?`<p class="mn-fi-err"><b>Erreur à éviter :</b> ${E(f.erreur)}</p>`:''}
      ${varH('Plus facile',e.facile,f&&f.variantes&&f.variantes.facile.exercice)}${varH('Plus difficile',e.difficile,f&&f.variantes&&f.variantes.difficile.exercice)}
      <p class="hint">${e.pos==='d'?'Debout':e.pos==='s'?'Au sol':'Debout et au sol'} · ${e.esp==='p'?'sur place':'un peu d’espace'} · niveau ${'●'.repeat(e.niv)}${'○'.repeat(3-e.niv)} · cardio ${'●'.repeat(e.cardio)} · impact ${'●'.repeat(e.impact)}${e.mat?' · '+E(L.materiel[e.mat]):''}</p>
      ${f&&f.controle&&f.controle.statut!=='vérifié'?`<p class="hint">Illustration simplifiée : ${E(f.controle.note)}</p>`:''}`;
  };
  const html=f=>`<div class="mn-sh-h"><h3>${E(e.nom)}</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
    ${o.pick?`<button type="button" class="mn-lien" data-mn="ficheRetour">← Retour à la bibliothèque</button>`:''}
    <div id="mnFiche">${corps(f)}</div>
    ${o.pick&&pick.cb?`<button class="btn mn-go" type="button" data-mn="pickExo" data-id="${E(id)}">Choisir cet exercice</button>`:''}`;
  sheet(html(undefined));
  S.fiche(id).then(f=>{if(ficheCtx&&ficheCtx.id===id&&$$('#mnFiche'))$$('#mnFiche').innerHTML=corps(f||null)});
}

/* ---------- actions sur un bloc ---------- */
function menuBloc(id){
  const x=trouverBloc(id);if(!x)return;const b=x.b;
  const act=b.t==='act';
  sheet(`<div class="mn-sh-h"><h3>${E(act?(b.exo.nom||'Exercice'):b.t==='combo'?b.nom:NOM_T[b.t])}</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
    ${act?`<label>Variante<input data-mn-in="variante" data-id="${id}" value="${E(b.variante)}" maxlength="60" placeholder="ex. garde haute, tempo lent"></label>
      <label>Consigne courte<input data-mn-in="note" data-id="${id}" value="${E(b.note)}" maxlength="120" placeholder="ex. respire, reste relâché"></label>
      <div class="mn-tl">Intensité</div><div class="chips">${['—','Légère','Moyenne','Maximale'].map((t,k)=>`<button type="button" class="chip" data-mn="intens" data-id="${id}" data-val="${k}" aria-pressed="${b.intensite===k}">${t}</button>`).join('')}</div>
      <div class="mn-tl">Mesure</div><div class="mn-seg"><button type="button" data-mn="mesure" data-id="${id}" data-val="d" aria-pressed="${!b.reps}">Durée</button><button type="button" data-mn="mesure" data-id="${id}" data-val="r" aria-pressed="${!!b.reps}">Répétitions (passage manuel)</button></div>
      <div class="mn-sh-a"><button class="btn ghost" type="button" data-mn="choisirExo" data-id="${id}">Changer d’exercice</button><button class="btn ghost" type="button" data-mn="remplacer" data-id="${id}">Suggestion au hasard</button></div>`
    :b.t==='repos'||b.t==='recup'?`<label>Indication de transition<input data-mn-in="note" data-id="${id}" value="${E(b.note)}" maxlength="120" placeholder="ex. bois une gorgée, enfile les gants"></label>
      <div class="mn-seg"><button type="button" data-mn="typeRepos" data-id="${id}" data-val="repos" aria-pressed="${b.t==='repos'}">Repos</button><button type="button" data-mn="typeRepos" data-id="${id}" data-val="recup" aria-pressed="${b.t==='recup'}">Récupération longue</button></div>`
    :b.t==='rep'?`<label class="check"><input type="checkbox" data-mn="finSansRepos" data-id="${id}" ${b.finSansRepos?'checked':''}> Sauter le repos à la fin du dernier tour</label>`
    :`<div class="mn-sh-a"><button class="btn ghost" type="button" data-mn="comboSave" data-id="${id}">Enregistrer dans mes combos</button></div>`}
    <div class="mn-sh-a">
      <button class="btn ghost" type="button" data-mn="monter" data-id="${id}" ${x.i===0?'disabled':''}>↑ Monter</button><button class="btn ghost" type="button" data-mn="descendre" data-id="${id}" ${x.i===x.l.length-1?'disabled':''}>↓ Descendre</button>
      <button class="btn ghost" type="button" data-mn="dupBloc" data-id="${id}">Dupliquer</button>${b.t==='rep'||b.t==='combo'?`<button class="btn ghost" type="button" data-mn="degrouper" data-id="${id}">Dégrouper</button>`:''}
      <button class="btn danger" type="button" data-mn="delBloc" data-id="${id}">Supprimer</button></div>`);
}
function saisirDuree(titre,val,cb,opts){
  opts=opts||{};
  sheet(`<div class="mn-sh-h"><h3>${E(titre)}</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
    ${opts.reps?`<label>Nombre de répétitions<input id="mnSaisieR" type="number" inputmode="numeric" min="1" max="999" value="${val}" autofocus></label>`
    :`<div class="tm-time mn-saisie"><input id="mnSaisieM" type="number" inputmode="numeric" min="0" max="120" value="${Math.floor(val/60)}" aria-label="Minutes" autofocus><span>min</span><input id="mnSaisieS" type="number" inputmode="numeric" min="0" max="59" value="${val%60}" aria-label="Secondes"><span>s</span></div>
    <div class="chips">${(opts.choix||[10,15,20,30,40,45,60,90,120,180,240,300]).map(d=>`<button type="button" class="chip" data-mn="saisieChip" data-val="${d}">${fC(d)}</button>`).join('')}</div>`}
    <button class="btn mn-go" type="button" data-mn="saisieOk">Valider</button>`,cb);
}

/* ================= Historique ================= */
function vHist(){
  const st=S.stats(),h=S.hist(),max=Math.max(1,...st.sem.map(x=>x.n));
  return `<div class="panel"><div class="mn-h"><h3>Statistiques</h3></div>
    <div class="mn-kpi"><div><b class="num">${st.n}</b><small>séances</small></div><div><b class="num">${fDuree(st.tot)}</b><small>d’entraînement</small></div>
      <div><b class="num">${fDuree(st.act)}</b><small>d’activité</small></div><div><b class="num">${fDuree(st.rep)}</b><small>de repos</small></div>
      <div><b class="num">${st.moy.toFixed(1).replace('.',',')}</b><small>séances / semaine (7 dern.)</small></div></div>
    <div class="mn-tl">Par semaine (8 dernières)</div>
    <div class="mn-sem">${st.sem.map(x=>`<div title="${x.n} séance(s)"><i style="height:${Math.round(100*x.n/max)}%"></i><small>${x.debut.getDate()}/${x.debut.getMonth()+1}</small></div>`).join('')}</div>
    ${st.top.length?`<div class="mn-tl">Catégories les plus pratiquées</div>${st.top.map(c=>`<div class="mn-catbar"><span>${E(c.nom)}</span><i style="width:${Math.round(100*c.s/st.top[0].s)}%"></i><b class="num">${fDuree(c.s)}</b></div>`).join('')}`:''}
  </div>
  <div class="panel"><div class="mn-h"><h3>Historique</h3>${h.length?`<button class="btn small ${ui.armed==='hist'?'danger':'ghost'}" type="button" data-mn="effHist">${ui.armed==='hist'?'Confirmer ?':'Effacer'}</button>`:''}</div>
    <div class="mn-hist">${h.slice(0,60).map(x=>{const d=new Date(x.at);return `<div class="mn-hl"><span class="num">${E(d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))} ${p2(d.getHours())}:${p2(d.getMinutes())}</span><b>${E(x.nom||'Séance')}</b><span class="num">${x.ancien?'':'prévu '+fT(x.prevu||0)+' · '}fait ${fT(x.fait||0)}</span><span class="pill ${x.statut==='terminée'?'ok':''}">${x.statut==='terminée'?'Terminée':'Interrompue'}</span></div>`}).join('')||'<div class="empty">Tes séances effectuées apparaîtront ici.</div>'}</div></div>`;
}

/* ================= Sons ================= */
function vSons(){
  const R=SON.R,sw=(k,t)=>`<label class="check"><input type="checkbox" data-mn="son" data-k="${k}" ${R[k]?'checked':''}> ${t}</label>`;
  return `<div class="panel mn-sons"><div class="mn-h"><h3>Sons</h3></div>
    ${sw('on','Sons activés')}
    <label>Volume <span class="num" id="mnVolV">${Math.round(R.vol*100)} %</span><input type="range" min="0" max="100" step="5" value="${Math.round(R.vol*100)}" data-mn-in="vol" aria-label="Volume"></label>
    <p class="hint" style="margin:0">Le niveau final dépend aussi du volume « Multimédia » du téléphone. Sur iPhone, les sons passent même en mode silencieux (iOS 16.4 et plus).</p>
    <div class="mn-tl">Ambiance</div>
    <div class="mn-packs">${Object.entries(SON.PACKS).map(([k,p])=>`<div class="mn-pack"><label class="check"><input type="radio" name="mnPack" data-mn="pack" data-k="${k}" ${R.pack===k?'checked':''}> ${E(p.n)}</label><button class="btn ghost small" type="button" data-mn="testPack" data-k="${k}" aria-label="Écouter ${E(p.n)}">▶</button></div>`).join('')}</div>
    <div class="mn-tl">Tester chaque son</div>
    <div class="mn-tests">${Object.entries(SON.TYPES).map(([k,t])=>`<button class="btn ghost small" type="button" data-mn="testSon" data-k="${k}">▶ ${E(t)}</button>`).join('')}</div>
    <div class="mn-tl">Signaux</div>
    ${sw('paliers','Bip doux toutes les 30 s restantes (activité et repos)')}${sw('decompte','Décompte sonore des 10 dernières secondes')}
    ${sw('vib','Vibration aux changements de phase'+(navigator.vibrate?'':' (non disponible sur cet appareil)'))}
    ${sw('voix','Annonce vocale du nom des exercices'+(SON.peutParler?'':' (non disponible sur cet appareil)'))}
    ${sw('coach','Coach : enchaînements annoncés pendant les exercices de boxe')}
    <label>Fréquence du coach<select data-mn-in="coachEvery">${[3,4,6,8,10,15].map(n=>`<option value="${n}"${(R.coachEvery||6)===n?' selected':''}>Toutes les ${n} s</option>`).join('')}</select></label>
    <button class="btn ghost small" type="button" data-mn="testVoix" style="justify-self:start" ${SON.peutParler?'':'disabled'}>Tester la voix</button></div>`;
}

/* ================= Séance en cours ================= */
const COMBOS_COACH=['Jab','Double jab','Jab – cross','Jab – cross – crochet','Jab – cross – crochet – cross','Crochet – uppercut','Uppercut – crochet','Jab au corps – cross','Cross – crochet – cross','Esquive – cross','Esquive – crochet','Rotation – crochet – cross','Parade – contre','Jab – esquive – cross','Double uppercut – crochet','Pas de côté – jab – cross'];
let run=null; // {s,c,pauses,pauseA,raf,timer,lastI,coach,nom,id,sched:Map}
const frise=$$('#mrFrise');
function demarrer(s,o){
  o=o||{};
  const v=M.valider(s);if(!v.ok){say(v.erreurs[0].msg);return}
  SON.activer();
  const now=performance.now();
  const c=o.snap?M.restaurer(v.steps,o.snap,now):M.chrono(v.steps,now);
  if(o.snap)c.demarre=now-(Number(o.snap.reelMs)||0);
  run={s:M.normaliser(s),c,nom:s.nom||o.nom||'Séance',id:o.id||'',pauseTotal:0,pauseA:o.snap?now:null,sched:new Map(),lastI:-1,coachNext:0,lastCombo:'',fini:false};
  $$('#mnRun').hidden=false;document.body.classList.add('mn-lock');$$('#mrFinale').hidden=true;
  $$('#mrSeance').textContent=run.nom;
  dessinerFrise();
  if(!o.snap){c.tires.add('t:0');SON.jouer('debut');const st=c.steps[0];if(st&&st.k==='act')annoncer(0);else SON.parler('C’est parti');SON.vibrer([200,100,200])}
  ecranOn();boucle();
  if(run.id)S.marquerUtilisee(run.id);
}
/* boucle : rAF quand l'écran est visible (affichage fluide) + minuterie de secours (sons programmés à l'avance) */
function boucle(){
  if(!run)return;
  cancelAnimationFrame(run.raf);clearInterval(run.timer);
  const f=()=>{if(!run)return;tick();run.raf=requestAnimationFrame(f)};run.raf=requestAnimationFrame(f);
  run.timer=setInterval(()=>{if(run)tick()},250);
}
function tick(){
  if(!run||run.fini)return;
  const now=performance.now(),c=run.c;
  const pass=M.avancer(c,now);
  programmer(now);
  if(pass.length&&!c.fini){pass.forEach(p=>{if(p.vers!==null)entree(p.vers,false)})}
  if(c.fini&&!run.fini){terminer(true);return}
  coach(now);
  peindre(now);
  if(now-(run.saveA||0)>1000){run.saveA=now;sauverEnCours(now)}
}
/* programme sur l'horloge audio les sons des 1,5 prochaines secondes ; les sons ratés (appli gelée) ne sont pas rejoués */
function programmer(now){
  const c=run.c;
  for(const e of M.evenements(c,now,1500)){
    c.tires.add(e.cle);
    if(e.at<now-250&&e.type!=='fin')continue;
    const at=Math.max(e.at,now);run.sched.set(e.cle,at);
    if(e.type==='prep')continue;
    SON.jouer(e.type==='activite'?'activite':e.type==='repos'?'repos':e.type,at,e.s);
    const dl=Math.max(0,at-now);
    if(e.type==='activite'||e.type==='repos'||e.type==='fin')setTimeout(()=>{if(run)SON.vibrer(e.type==='activite'?[200,100,200]:e.type==='repos'?[500]:[200,100,200,100,400])},dl);
    else if(e.type==='decompte'&&e.s<=3)setTimeout(()=>{if(run)SON.vibrer(60)},dl);
  }
  for(const [k,at] of run.sched)if(at<now-2000)run.sched.delete(k);
}
/* annule les sons programmés pas encore joués (pause, précédent, suivant) pour qu'ils repartent au bon moment */
function deprogrammer(now){SON.annuler();for(const [k,at] of run.sched)if(at>now+5){run.c.tires.delete(k);run.sched.delete(k)}}
/* entrée dans l'étape i : voix et frise (le son de transition est déjà programmé, ou joué tout de suite si manuel) */
function entree(i,manuel){
  const st=run.c.steps[i];if(!st)return;
  if(manuel)SON.jouer(st.k==='act'?'activite':st.k==='prep'?'palier':'repos');
  if(manuel)SON.vibrer(st.k==='act'?[200,100,200]:[400]);
  annoncer(i);run.coachNext=performance.now()+(SON.R.coachEvery||6)*1000;run.combo='';
  majFrise(i);
}
function annoncer(i){
  const st=run.c.steps[i];if(!st||!SON.R.voix)return;
  if(st.k==='act')SON.parler((st.combo&&st.combo.partI===0?st.combo.nom+'. ':'')+st.nom+(st.reps?', '+st.reps+' répétitions':''));
  else{const a=M.annonce(run.c.steps,i);SON.parler((st.k==='prep'?'Préparation':st.k==='repos'?'Repos':'Récupération')+(a?'. Prochain : '+a.nom:''))}
}
function coach(now){
  const st=run.c.steps[run.c.i];
  if(!SON.R.coach||!st||st.k!=='act'||!st.exo||st.exo.cat!=='boxe'||run.c.pause!==null)return;
  if(now<run.coachNext)return;run.coachNext=now+(SON.R.coachEvery||6)*1000;
  if(st.d&&M.restant(run.c,now)<11000)return;
  let x;do{x=COMBOS_COACH[Math.floor(Math.random()*COMBOS_COACH.length)]}while(x===run.lastCombo);run.lastCombo=x;run.combo=x;SON.parler(x,true);
}
function sauverEnCours(now){S.enCours.ecrire({s:run.s,id:run.id,nom:run.nom,snap:Object.assign(M.exporter(run.c,now),{reelMs:now-run.c.demarre-run.pauseTotal-(run.pauseA?now-run.pauseA:0)}),at:new Date().toISOString()})}
function dessinerFrise(){
  const st=run.c.steps,tot=Math.max(1,M.dureeTotale(st));
  frise.innerHTML=st.map((x,i)=>`<i class="f-${x.k}" data-i="${i}" style="flex-grow:${Math.max(x.d||20,4)}" title="${E(x.nom)} ${x.d?fC(x.d):x.reps+' rép.'}"></i>`).join('')+'<i class="f-fin" style="flex-grow:3" title="Fin"></i>';
  frise.style.minWidth=Math.max(100,Math.min(400,st.length*3))+'%';
  run.lastI=-1;majFrise(run.c.i);
}
function majFrise(i){
  if(!run||run.lastI===i)return;run.lastI=i;
  frise.querySelectorAll('i[data-i]').forEach(el=>{const k=Number(el.dataset.i);el.className='f-'+run.c.steps[k].k+(k<i?' fait':k===i?' cur':'')});
  const cur=frise.querySelector('.cur');if(cur){const box=frise.parentElement;if(!box)return;box.scrollLeft=Math.max(0,cur.offsetLeft-box.clientWidth/3)}
}
function peindre(now){
  const c=run.c,st=c.steps[c.i],R=$$('#mnRun');if(!st)return;
  const pause=c.pause!==null,ms=M.restant(c,now),rem=Math.ceil(ms/1000),man=!st.d;
  R.dataset.ph=st.k;R.classList.toggle('pause',pause);R.classList.toggle('dix',!man&&st.d>10&&ms<=10000);
  const lab={prep:'Préparation',act:'Activité',repos:'Repos',recup:'Récupération'}[st.k];
  txt('#mrPh',pause?'En pause':lab);
  const r=st.rounds||[];txt('#mrRd',(r.length?`Round ${r[0].i} / ${r[0].n}`:'')+(r.length>1?` · Série ${r[r.length-1].i} / ${r[r.length-1].n}`:'')+(st.combo?(r.length?' · ':'')+st.combo.nom+(st.combo.tours>1?' '+st.combo.tour+'/'+st.combo.tours:''):'')||`Étape ${c.i+1} / ${c.steps.length}`);
  txt('#mrExo',st.k==='act'?st.nom:st.k==='prep'?'Prêt ?':lab);
  {const v=st.k==='act'&&st.exo&&st.exo.id?S.visuel(st.exo.id):null,im=$$('#mrVis'),src=v?(v.anim||v.mini):'';
   if(im.dataset.src!==src){im.dataset.src=src;if(src)im.src=src;else im.removeAttribute('src')}im.hidden=!src;
   const cible=st.k==='act'?st:M.prochaineActivite(c.steps,c.i);$$('#mrInfo').hidden=!(cible&&cible.exo&&cible.exo.id&&S.exo(cible.exo.id))}
  txt('#mrVar',st.k==='act'?[st.variante,st.note,st.intensite?'Intensité '+['','légère','moyenne','maximale'][st.intensite]:'',run.combo].filter(Boolean).join(' · '):(st.note||''));
  txt('#mrClock',man?(st.reps+' rép.'):fClock(rem));
  $$('#mrClock').classList.toggle('reps',man);
  $$('#mrFait').hidden=!man;
  $$('#mrBarPh').style.width=(man?100:Math.max(0,Math.min(100,100*ms/(st.d*1000)))).toFixed(2)+'%';
  /* prochain exercice : pendant l'activité en petit, pendant le repos en grand (et encore plus dans les 10 dernières s) */
  const a=M.annonce(c.steps,c.i);let nx='';
  const vn=a&&a.etape&&a.etape.exo&&a.etape.exo.id&&st.k!=='act'?S.visuel(a.etape.exo.id):null,imN=vn?`<img class="mr-next-img" src="${E(vn.anim||vn.mini)}" alt="">`:'';
  if(a){const d=a.combo?`${E(a.nom)} — ${fClock(a.d)}<span class="mr-cb">${E(a.combo.join(' + '))}</span>`:`${E(a.nom)} — ${a.reps?a.reps+' rép.':fClock(a.d)}`;
    nx=st.k==='act'&&!(st.combo&&a.etape.combo&&a.etape.combo.id===st.combo.id&&a.etape.combo.tour===st.combo.tour)?`<div><small>Ensuite</small>${d}</div>`:`${imN}<div><small>Prochain exercice</small>${d}</div>`}
  else nx=c.i+1>=c.steps.length?'<div><small>Ensuite</small>Fin de la séance</div>':'';
  const ne=$$('#mrNext');if(ne.dataset.h!==nx){ne.innerHTML=nx;ne.dataset.h=nx}
  ne.classList.toggle('grand',st.k!=='act');ne.classList.toggle('imminent',st.k!=='act'&&!man&&ms<=10000);
  const p=M.progression(c,now),reel=(now-c.demarre-run.pauseTotal-(run.pauseA?now-run.pauseA:0))/1000;
  $$('#mrBarAll').style.width=p.pct.toFixed(2)+'%';
  txt('#mrStats',`${Math.floor(p.pct)} % · ${fT(reel)} écoulées · ${fT(p.reste)} restantes · étape ${Math.min(p.etapesFaites+1,p.etapes)} / ${p.etapes}`);
  const pb=$$('#mrPause');const pl=pause?'▶<span>Reprendre</span>':'⏸<span>Pause</span>';if(pb.innerHTML!==pl)pb.innerHTML=pl;
  majFrise(c.i);
}
function txt(s,t){const e=$$(s);if(e&&e.textContent!==t)e.textContent=t}
function pauser(){if(!run||run.fini)return;const now=performance.now();if(run.c.pause!==null){M.reprendre(run.c,now);run.pauseTotal+=now-(run.pauseA||now);run.pauseA=null;SON.activer();ecranOn()}else{M.pauser(run.c,now);run.pauseA=now;deprogrammer(now)}sauverEnCours(now);peindre(now)}
function suivant(){if(!run||run.fini)return;const now=performance.now();deprogrammer(now);M.suivant(run.c,now);if(run.c.fini){terminer(true);return}entree(run.c.i,true);peindre(now)}
function precedent(){if(!run||run.fini)return;const now=performance.now();deprogrammer(now);M.precedent(run.c,now);entree(run.c.i,true);peindre(now)}
function terminer(complet){
  if(!run)return;const now=performance.now(),c=run.c;
  if(!complet){M.pauser(c,now)}
  run.fini=true;cancelAnimationFrame(run.raf);clearInterval(run.timer);
  if(complet){programmer(now)}else SON.annuler();
  const reel=Math.max(0,(now-c.demarre-run.pauseTotal-(run.pauseA?now-run.pauseA:0))/1000),p=M.progression(c,now);
  if(complet||reel>=10)S.noterSeance({nom:run.nom,seanceId:run.id||'',prevu:p.total,fait:Math.round(reel),actif:Math.round(c.stats.actif),repos:Math.round(c.stats.repos),cats:c.stats.cats,statut:complet?'terminée':'interrompue'});
  S.enCours.effacer();ecranOff();
  const R=$$('#mnRun');R.dataset.ph='fin';R.classList.remove('pause','dix');
  txt('#mrPh',complet?'Séance terminée':'Séance arrêtée');txt('#mrExo',complet?'Bravo !':'Arrêtée');txt('#mrClock',fClock(Math.round(reel)));txt('#mrRd','');txt('#mrVar','');
  $$('#mrBarPh').style.width='0%';$$('#mrBarAll').style.width=(complet?100:p.pct)+'%';$$('#mrNext').innerHTML='';$$('#mrNext').dataset.h='';$$('#mrFait').hidden=true;
  frise.querySelectorAll('i').forEach((el,k)=>{if(complet||k<c.i)el.classList.add('fait');el.classList.remove('cur')});
  $$('#mrFinale').hidden=false;
  $$('#mrFinale').innerHTML=`<div class="mr-bilan num"><span>Durée réelle <b>${fT(reel)}</b></span><span>Activité <b>${fT(c.stats.actif)}</b></span><span>Repos <b>${fT(c.stats.repos)}</b></span></div>
    <div class="row"><button class="btn" type="button" data-mn="recommencer">↻ Recommencer</button><button class="btn ghost" type="button" data-mn="quitter">Fermer</button></div>`;
  if(complet){SON.parler('Séance terminée. Bravo !')}
}
function quitter(){if(run){cancelAnimationFrame(run.raf);clearInterval(run.timer)}SON.annuler();run=null;$$('#mnRun').hidden=true;document.body.classList.remove('mn-lock');ecranOff();
  if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});rendre()}
/* écran allumé pendant la séance */
let wl=null;
async function ecranOn(){try{if('wakeLock' in navigator&&document.visibilityState==='visible'&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){wl=null}}
function ecranOff(){try{if(wl)wl.release()}catch(e){}wl=null}
document.addEventListener('visibilitychange',()=>{if(run&&!run.fini&&document.visibilityState==='visible'){ecranOn();tick()}});
addEventListener('pagehide',()=>{if(run&&!run.fini)sauverEnCours(performance.now())});

/* ================= glisser-déposer (poignée ⠿) ================= */
let drag=null;
root.addEventListener('pointerdown',e=>{
  const h=e.target.closest('[data-drag]');if(!h)return;
  const el=h.closest('.mn-b'),box=el&&el.parentElement;if(!el||!box)return;
  e.preventDefault();h.setPointerCapture&&h.setPointerCapture(e.pointerId);
  drag={el,box,id:el.dataset.id,y0:e.clientY,moved:false};el.classList.add('drag');
});
root.addEventListener('pointermove',e=>{
  if(!drag)return;drag.moved=true;
  const sib=[...drag.box.children].filter(x=>x!==drag.el&&x.classList.contains('mn-b'));
  let avant=null;for(const s of sib){const r=s.getBoundingClientRect();if(e.clientY<r.top+r.height/2){avant=s;break}}
  if(avant)drag.box.insertBefore(drag.el,avant);else drag.box.appendChild(drag.el);
  if(e.clientY<60)scrollBy(0,-12);else if(e.clientY>innerHeight-60)scrollBy(0,12);
});
const finDrag=()=>{
  if(!drag)return;const d=drag;drag=null;d.el.classList.remove('drag');if(!d.moved)return;
  const l=liste(d.box.dataset.l);if(!l)return;const ordre=[...d.box.children].map(x=>x.dataset.id).filter(Boolean);
  l.sort((a,b)=>ordre.indexOf(a.id)-ordre.indexOf(b.id));modifie();
};
root.addEventListener('pointerup',finDrag);root.addEventListener('pointercancel',finDrag);

/* ================= actions ================= */
function bornes(t){return t==='act'?[5,M.MAX_D]:[5,M.MAX_D]}
function majRapide(){try{localStorage.setItem('adb-mn-rapide',JSON.stringify(rap))}catch(e){}}
function seanceRapide(){return S.simple({rounds:rap.rounds,travail:rap.travail,repos:rap.repos,prep:rap.prep,nom:'Mode rapide',mode:'rapide'})}
function ajusteVal(o,k,x,cb){
  const isT=k==='travail'||k==='repos',lim={travail:[5,3600],repos:[0,1800],rounds:[1,50],prep:[0,120]}[k];
  if(x===0){
    if(isT)saisirDuree(k==='travail'?'Durée d’activité':'Durée de repos',o[k],v=>{o[k]=Math.min(lim[1],Math.max(lim[0],v));cb()},{choix:k==='repos'?[0,10,15,20,30,45,60,90,120]:undefined});
    else if(k==='prep')saisirDuree('Préparation',o[k],v=>{o[k]=Math.min(lim[1],Math.max(lim[0],v));cb()},{choix:[0,5,10,15,20,30,60]});
    else sheet(`<div class="mn-sh-h"><h3>Nombre de rounds</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div><label>Rounds<input id="mnSaisieR" type="number" inputmode="numeric" min="1" max="50" value="${o[k]}" autofocus></label><button class="btn mn-go" type="button" data-mn="saisieOk">Valider</button>`,v=>{o[k]=Math.min(50,Math.max(1,v));cb()});
    return;
  }
  const st=k==='rounds'?1:k==='prep'?5:pas(o[k]+(x<0?-1:0));
  o[k]=Math.min(lim[1],Math.max(lim[0],o[k]+x*st));cb();
}
root.addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='mnQ'){ui.q=t.value;const pos=t.selectionStart;rendre();const n=$$('#mnQ');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}return}
  if(t.id==='mnPickQ'){pick.q=t.value;majPick();return}
  if(t.id==='mnNom'&&ed){ed.s.nom=t.value.slice(0,50);garderBrouillon();if(ed.existe){ed.etat='encours';majEtat();clearTimeout(saveT);saveT=setTimeout(()=>{if(!ed.s.nom.trim()){ed.etat='invalide';majEtat();return}try{ed.s=S.enregistrer(ed.s,ed.partage);ed.etat='ok'}catch(_){ed.etat='erreur'}majEtat()},800)}return}
  const k=t.dataset.mnIn;if(!k)return;
  if(k==='vol'){SON.regler({vol:Number(t.value)/100});const v=$$('#mnVolV');if(v)v.textContent=t.value+' %';return}
  if(k==='coachEvery'){SON.regler({coachEvery:Number(t.value)});return}
  const x=ed&&trouverBloc(t.dataset.id);if(!x)return;
  if(k==='comboNom')x.b.nom=t.value.slice(0,40);else x.b[k]=t.value.slice(0,k==='note'?120:60);
  garderBrouillon();clearTimeout(ui.inT);ui.inT=setTimeout(()=>{if(ed.existe){try{ed.s=S.enregistrer(ed.s,ed.partage);ed.etat='ok'}catch(_){ed.etat='erreur'}majEtat()}},800);
});
root.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='mnFCat'){ui.fCat=t.value;rendre();return}
  if(t.dataset.mnIn==='comboNom'||t.dataset.mnIn==='note'||t.dataset.mnIn==='variante'){if(t.closest('#mnSheet'))return;modifie();return}
});
root.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='mnSaisieM'||e.target.id==='mnSaisieS'||e.target.id==='mnSaisieR')){e.preventDefault();const b=$$('[data-mn="saisieOk"]');if(b)b.click()}
  if(e.key==='Escape'&&!$$('#mnSheet').hidden)fermer()});
root.addEventListener('click',e=>{
  const b=e.target.closest('[data-mn]');if(!b||b.disabled)return;
  const a=b.dataset.mn,id=b.dataset.id;
  switch(a){
    case 'fermer':fermer();break;
    case 'vue':if(b.dataset.v==='liste-modeles'){aller('creer');setTimeout(()=>{const m=$$('#mnModeles');if(m)m.scrollIntoView({behavior:'smooth'})},30)}else aller(b.dataset.v);break;
    case 'filtre':ui[b.dataset.k]=b.dataset.val;rendre();break;
    /* mode rapide */
    case 'rap':ajusteVal(rap,b.dataset.k,Number(b.dataset.x),()=>{majRapide();if(!$$('#mnSheet').hidden)fermer();rendre()});break;
    case 'rapideGo':demarrer(seanceRapide(),{nom:'Mode rapide'});break;
    case 'rapideEdit':{const s=seanceRapide();s.nom='';s.mode='simple';ouvrir(s);break}
    /* séance simple */
    case 'simp':ajusteVal(ui.simple,b.dataset.k,Number(b.dataset.x),()=>{if(!$$('#mnSheet').hidden)fermer();rendre()});break;
    case 'simpExo':choisirExo(null,e2=>{ui.simple.exo=e2;fermer();rendre()});break;
    case 'simpCreer':case 'simpGo':{const o=ui.simple;const s=S.simple({rounds:o.rounds,travail:o.travail,repos:o.repos,prep:o.prep,exos:o.exo?[o.exo.id]:[],nom:''});
      if(a==='simpGo')demarrer(s,{nom:o.exo?o.exo.nom:'Séance simple'});else ouvrir(s);break}
    case 'nouvelle':ouvrir({nom:'',prep:10,blocs:[],mode:'avance'});break;
    case 'modele':ouvrir(S.depuisModele(Number(b.dataset.k)));say('Modèle ouvert : modifie-le puis enregistre-le sous ton nom.');break;
    /* générateur */
    case 'gen':{const k=b.dataset.k,v=isNaN(Number(b.dataset.val))?b.dataset.val:Number(b.dataset.val);
      if(b.dataset.multi){const l=gen[k];const i=l.indexOf(b.dataset.val);if(i>=0)l.splice(i,1);else l.push(b.dataset.val)}else gen[k]=v;
      try{localStorage.setItem('adb-mn-gen',JSON.stringify(gen))}catch(_){}rendre();break}
    case 'genT':ajusteVal(gen,b.dataset.k,Number(b.dataset.x),()=>{try{localStorage.setItem('adb-mn-gen',JSON.stringify(gen))}catch(_){}if(!$$('#mnSheet').hidden)fermer();rendre()});break;
    case 'genEch':gen.echauffement=b.checked;try{localStorage.setItem('adb-mn-gen',JSON.stringify(gen))}catch(_){}break;
    case 'genGo':{const s=S.generer(gen);if(!s){say('Aucun exercice ne correspond : élargis les critères.');break}ouvrir(s,{gen:Object.assign({},gen)});break}
    /* liste */
    case 'go':{const x=S.trouver(id);if(x)demarrer(x.s,{id:x.id});break}
    case 'edit':{const x=S.trouver(id);if(x)ouvrir(x.s,{existe:true,partage:x.src==='groupe'});break}
    case 'favSeance':S.basculerFav('seances',id);rendre();break;
    case 'menuSeance':{const x=S.trouver(id);if(!x)break;
      sheet(`<div class="mn-sh-h"><h3>${E(x.s.nom||'Séance')}</h3><button class="btn ghost small" type="button" data-mn="fermer">Fermer</button></div>
        <label>Renommer<input id="mnRen" maxlength="50" value="${E(x.s.nom)}"></label><button class="btn ghost" type="button" data-mn="renommer" data-id="${E(id)}">Enregistrer le nom</button>
        <div class="mn-sh-a"><button class="btn ghost" type="button" data-mn="dupSeance" data-id="${E(id)}">Dupliquer</button>
        <button class="btn ghost" type="button" data-mn="bascPartage" data-id="${E(id)}">${x.src==='groupe'?'Garder seulement sur ce téléphone':'Partager avec le groupe'}</button>
        <button class="btn danger" type="button" data-mn="delSeance" data-id="${E(id)}">${ui.armed==='del'+id?'Confirmer la suppression ?':'Supprimer'}</button></div>`);break}
    case 'renommer':{const x=S.trouver(id),n=($$('#mnRen').value||'').trim();if(!x||!n){say('Donne un nom.');break}x.s.nom=n;try{S.enregistrer(x.s,x.src==='groupe');say('Renommée')}catch(_){say('Échec (connexion ?)')}fermer();rendre();break}
    case 'dupSeance':{const s=S.dupliquer(id);fermer();if(s){say('Copie créée sur ce téléphone');rendre()}break}
    case 'bascPartage':{const x=S.trouver(id);if(!x)break;try{S.enregistrer(x.s,x.src!=='groupe');say(x.src==='groupe'?'Gardée sur ce téléphone':'Partagée avec le groupe')}catch(_){say('Pas de connexion : réessaie plus tard.')}fermer();rendre();break}
    case 'delSeance':if(!arm('del'+id)){b.textContent='Confirmer la suppression ?';break}S.supprimer(id);if(ed&&ed.s.id===id){ed=null;try{localStorage.removeItem('adb-mn-brouillon')}catch(_){}}fermer();say('Séance supprimée');rendre();break;
    case 'reprendreEnCours':{const x=S.enCours.lire();if(x&&x.s)demarrer(x.s,{id:x.id,nom:x.nom,snap:x.snap});break}
    case 'abandonEnCours':if(!arm('abandon')){rendre();break}S.enCours.effacer();rendre();break;
    /* éditeur */
    case 'partage':ed.partage=b.dataset.val==='1';if(ed.existe){const old=ed.s.id;try{ed.s=S.enregistrer(ed.s,ed.partage);ed.etat='ok'}catch(_){ed.partage=!ed.partage;say('Pas de connexion : partage impossible pour l’instant.')}}modifie();break;
    case 'prep':ed.s.prep=Number(b.dataset.val);modifie();break;
    case 'prepPerso':saisirDuree('Préparation',ed.s.prep,v=>{ed.s.prep=Math.min(600,Math.max(0,v));modifie()},{choix:[5,10,15,20,30,45,60,90,120]});break;
    case 'sauver':{const v=M.valider(ed.s);if(!v.ok){say(v.erreurs[0].msg);break}
      if(!ed.s.nom.trim()){say('Donne un nom à la séance.');const n=$$('#mnNom');if(n)n.focus();break}
      try{ed.s=S.enregistrer(ed.s,ed.partage);ed.existe=true;ed.etat='ok';ed.gen=null;say(ed.partage?'Séance enregistrée pour le groupe':'Séance enregistrée');modifie()}catch(_){say('Pas de connexion : choisis « Ce téléphone ».')}break}
    case 'goEd':{const v=M.valider(ed.s);if(!v.ok){say(v.erreurs[0].msg);break}demarrer(ed.s,{id:ed.existe?ed.s.id:'',nom:ed.s.nom||'Séance sans nom'});break}
    case 'add':ajouter(b.dataset.t,b.dataset.l);break;
    case 'comboNeuf':fermer();{const l=liste(b.dataset.l);if(l){l.push(M.normBloc(nouveauBloc('combo'),0));modifie()}}break;
    case 'comboAjout':{const c=S.tousCombos().find(x=>x.id===b.dataset.cid),l=liste(b.dataset.l);if(c&&l){l.push(M.normBloc(S.blocDeCombo(c),0));fermer();modifie()}break}
    case 'choisirExo':fermer();choisirExo(id);break;
    case 'pickCat':pick.cat=b.dataset.k;majPick();break;
    case 'pickExo':{const e2=S.exo(id);if(e2&&pick.cb){const cb=pick.cb;fermer();cb(e2)}break}
    case 'pickInfo':pick.info=pick.info===id?null:id;majPick();break;
    case 'ficheExo':ouvrirFiche(id,{pick:!!b.dataset.pick});break;
    case 'ficheRetour':afficherPick();break;
    case 'infoRun':{if(!run)break;const st=run.c.steps[run.c.i];const cible=st&&st.k==='act'?st:M.prochaineActivite(run.c.steps,run.c.i);
      if(cible&&cible.exo&&cible.exo.id&&S.exo(cible.exo.id))ouvrirFiche(cible.exo.id);else say('Pas de fiche pour cet exercice.');break}
    case 'pickPerso':{const e2=S.ajouterPerso(pick.q,S.CAT[pick.cat]?pick.cat:'cardio');if(e2&&pick.cb){const cb=pick.cb;fermer();cb(e2);say('« '+e2.nom+' » ajouté à tes exercices')}break}
    case 'favExo':S.basculerFav('exos',id);majPick();break;
    case 'delPerso':if(!arm('p'+id)){majPick();break}S.supprimerPerso(id);majPick();break;
    case 'dur':{const x=trouverBloc(id);if(!x)break;const dx=Number(b.dataset.x);
      if(dx===0)saisirDuree(x.b.t==='act'?'Durée — '+(x.b.exo.nom||'exercice'):NOM_T[x.b.t],x.b.d,v=>{x.b.d=Math.min(M.MAX_D,Math.max(5,v));modifie()});
      else{x.b.d=Math.min(M.MAX_D,Math.max(5,x.b.d+dx*pas(x.b.d+(dx<0?-1:0))));modifie()}break}
    case 'reps':{const x=trouverBloc(id);if(!x)break;const dx=Number(b.dataset.x);
      if(dx===0)saisirDuree('Répétitions',x.b.reps,v=>{x.b.reps=Math.min(999,Math.max(1,v));modifie()},{reps:true});
      else{x.b.reps=Math.min(999,Math.max(1,x.b.reps+dx));modifie()}break}
    case 'saisieChip':{const m=$$('#mnSaisieM'),s2=$$('#mnSaisieS'),v=Number(b.dataset.val);if(m){m.value=Math.floor(v/60);s2.value=v%60}if(sheetCb){const cb=sheetCb;fermer();cb(v)}break}
    case 'saisieOk':{let v;const r=$$('#mnSaisieR');if(r)v=Math.round(Number(r.value)||0);else v=Math.round((Number($$('#mnSaisieM').value)||0)*60+(Number($$('#mnSaisieS').value)||0));
      const cb=sheetCb;fermer();if(cb)cb(v);break}
    case 'repN':{const x=trouverBloc(id);if(!x)break;const b2=x.b;b2.n=Math.min(M.MAX_N,Math.max(1,b2.n+Number(b.dataset.x)));
      if(!b2.lie){while(b2.occ.length<b2.n)b2.occ.push({blocs:M.clone(b2.occ[b2.occ.length-1].blocs,true)});b2.occ.length=b2.n}modifie();break}
    case 'tours':{const x=trouverBloc(id);if(!x)break;x.b.tours=Math.min(M.MAX_N,Math.max(1,x.b.tours+Number(b.dataset.x)));modifie();break}
    case 'lie':{const x=trouverBloc(id);if(!x)break;const b2=x.b,v=b.dataset.val==='1';if(v===b2.lie)break;
      if(!v){b2.lie=false;b2.occ=Array.from({length:b2.n},()=>({blocs:M.clone(b2.blocs,true)}));ed.occTab[id]=0;modifie()}
      else{if(!arm('lie'+id)){b.textContent='Tour '+((ed.occTab[id]||0)+1)+' pour tous ?';break}b2.blocs=b2.occ[ed.occTab[id]||0].blocs;b2.lie=true;delete b2.occ;modifie()}break}
    case 'occ':ed.occTab[id]=Number(b.dataset.k);rendre();break;
    case 'plier':{const x=trouverBloc(id);if(x){x.b.plie=!x.b.plie;modifie()}break}
    case 'menuBloc':menuBloc(id);break;
    case 'intens':{const x=trouverBloc(id);if(x){x.b.intensite=Number(b.dataset.val);modifie();menuBloc(id)}break}
    case 'mesure':{const x=trouverBloc(id);if(!x)break;if(b.dataset.val==='r'){x.b.reps=x.b.reps||10;x.b.d=0}else{x.b.reps=0;x.b.d=x.b.d||45}modifie();menuBloc(id);break}
    case 'typeRepos':{const x=trouverBloc(id);if(x){x.b.t=b.dataset.val;modifie();menuBloc(id)}break}
    case 'finSansRepos':{const x=trouverBloc(id);if(x){x.b.finSansRepos=b.checked;modifie()}break}
    case 'remplacer':{const x=trouverBloc(id);if(!x)break;const r=S.remplacant(x.b.exo);if(r){x.b.exo=S.refExo(r);modifie();say('Remplacé par « '+r.nom+' »');menuBloc(id)}break}
    case 'comboSave':{const x=trouverBloc(id);if(!x)break;const c=S.enregistrerCombo(x.b);x.b.comboId=c.id;fermer();modifie();say('Combo enregistré dans « Mes combos »');break}
    case 'monter':case 'descendre':{const x=trouverBloc(id);if(!x)break;const j=x.i+(a==='monter'?-1:1);if(j<0||j>=x.l.length)break;[x.l[x.i],x.l[j]]=[x.l[j],x.l[x.i]];modifie();menuBloc(id);break}
    case 'dupBloc':{const x=trouverBloc(id);if(!x)break;x.l.splice(x.i+1,0,M.normBloc(M.clone(x.b,true),0));fermer();modifie();break}
    case 'degrouper':{const x=trouverBloc(id);if(!x)break;const inner=x.b.t==='combo'?x.b.mvts:(x.b.lie?x.b.blocs:x.b.occ.flatMap(o=>o.blocs));x.l.splice(x.i,1,...M.clone(inner,true).map(z=>M.normBloc(z,0)));fermer();modifie();break}
    case 'delBloc':{const x=trouverBloc(id);if(!x)break;x.l.splice(x.i,1);fermer();modifie();say('Bloc supprimé');break}
    case 'selMode':ed.selOn=!ed.selOn;ed.sel.clear();ed.selListe=null;rendre();break;
    case 'sel':{if(ed.selListe!==b.dataset.l){ed.sel.clear();ed.selListe=b.dataset.l}if(b.checked)ed.sel.add(id);else ed.sel.delete(id);rendre();break}
    case 'selRep':case 'selCombo':case 'selDup':case 'selDel':{
      const l=liste(ed.selListe||'root');if(!l)break;const idx=l.map((x,i)=>ed.sel.has(x.id)?i:-1).filter(i=>i>=0);if(!idx.length)break;
      const pris=idx.map(i=>l[i]);
      if(a==='selDel'){if(!arm('selDel')){rendre();break}for(let k=idx.length-1;k>=0;k--)l.splice(idx[k],1)}
      else if(a==='selDup'){l.splice(idx[idx.length-1]+1,0,...pris.map(x=>M.normBloc(M.clone(x,true),0)))}
      else{
        if(a==='selCombo'&&pris.some(x=>x.t!=='act'&&x.t!=='repos')){say('Un combo ne contient que des exercices et des repos.');break}
        for(let k=idx.length-1;k>=0;k--)l.splice(idx[k],1);
        const nb=a==='selRep'?{t:'rep',n:2,blocs:pris,finSansRepos:true}:{t:'combo',nom:'Mon combo',mvts:pris};
        l.splice(idx[0],0,M.normBloc(nb,0));
      }
      ed.sel.clear();ed.selOn=false;modifie();if(a==='selRep')say('Répétition créée : règle le nombre de tours avec + et −');break}
    case 'favCombo':S.basculerFav('combos',id);rendre();break;
    case 'delCombo':if(!arm('cb'+id)){rendre();break}S.supprimerCombo(id);rendre();break;
    /* historique */
    case 'effHist':if(!arm('hist')){rendre();break}S.effacerHist();rendre();say('Historique effacé');break;
    /* sons */
    case 'son':{const o={};o[b.dataset.k]=b.checked;SON.regler(o);if(b.dataset.k==='vib'&&b.checked)SON.vibrer(200);break}
    case 'pack':SON.regler({pack:b.dataset.k});SON.tester('activite');break;
    case 'testPack':{const old=SON.R.pack;SON.R.pack=b.dataset.k;SON.tester('debut');setTimeout(()=>{SON.R.pack=old},50);break}
    case 'testSon':SON.tester(b.dataset.k,b.dataset.k==='decompte'?5:undefined);break;
    case 'testVoix':SON.activer();SON.parler('Repos. Prochain exercice : pompes, deux minutes.',true);break;
    /* séance en cours */
    case 'pause':pauser();break;
    case 'suiv':case 'fait':suivant();break;
    case 'prec':precedent();break;
    case 'stop':if(!run)break;if(run.fini){quitter();break}if(!arm('stop')){b.textContent='Confirmer l’arrêt ?';b.classList.add('danger');setTimeout(()=>{b.textContent='Arrêter';b.classList.remove('danger')},4000);break}terminer(false);break;
    case 'recommencer':{const r=run;quitter();if(r)demarrer(r.s,{id:r.id,nom:r.nom});break}
    case 'quitter':quitter();break;
    case 'plein':{const el=$$('#mnRun');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(el.requestFullscreen)el.requestFullscreen().catch(()=>say('Plein écran indisponible sur cet appareil'));else say('Plein écran indisponible sur cet appareil');break}
  }
});
/* raccourcis clavier pendant la séance : espace = pause, flèches = étapes */
document.addEventListener('keydown',e=>{if(!run||run.fini||$$('#mnRun').hidden||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key===' '){e.preventDefault();pauser()}else if(e.key==='ArrowRight')suivant();else if(e.key==='ArrowLeft')precedent()});

window.tmRefresh=()=>{if(ui.v==='liste'&&!document.activeElement?.closest?.('#mnVue input'))rendre()};
window.ADB_MINUTEUR={demarrer,ouvrir,get run(){return run},get ed(){return ed},aller,tick};
if(!document.fullscreenEnabled)$$('#mrFs').hidden=true;
rendre();
})();
