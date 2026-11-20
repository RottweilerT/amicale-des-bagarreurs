const UX_CONF={nav:'nav.tabs',tabs:'nav.tabs button[data-tab]',key:'tab',attr:'aria-selected',val:'true',prefix:'adb',draft:{form:'#ntForm',body:'#ntBody',subject:'#ntSubject',submit:'#ntSubmit'}};
/* ===== Ergonomie (couche de navigation uniquement : aucune donnée ni logique métier modifiée) =====
   1. Bouton « retour » du téléphone / navigateur : revient à l'onglet précédent au lieu de quitter l'appli.
   2. Chaque onglet retrouve la position de défilement où on l'avait laissé.
   3. Un ticket en cours d'écriture est gardé sur l'appareil jusqu'à son envoi (fermeture, rechargement…). */
(function(c){
  const btns=()=>[...document.querySelectorAll(c.tabs)];
  const keyOf=b=>b.getAttribute('data-'+c.key);
  const active=()=>{const b=btns().find(x=>x.getAttribute(c.attr)===c.val);return b?keyOf(b):null};
  const scroller=t=>(c.scroller&&c.scroller(t))||null;
  const getY=t=>{const s=scroller(t);return s?s.scrollTop:window.scrollY};
  const setY=(t,y)=>{const s=scroller(t);if(s)s.scrollTop=y;else window.scrollTo(0,y)};
  /* l'appli peut réécrire l'entrée d'historique (adresse #onglet) : on garde l'onglet mémorisé */
  const rs=history.replaceState.bind(history);
  history.replaceState=(s,t,u)=>rs(s==null&&history.state&&history.state.uxTab?{uxTab:history.state.uxTab}:s,t,u);
  let cur=active(),restoring=false;const pos={};
  if(cur)rs(Object.assign({},history.state||{},{uxTab:cur}),'');
  /* on retient la position de défilement de l'onglet en cours avant chaque changement */
  document.addEventListener('pointerdown',e=>{if(cur&&e.target.closest&&e.target.closest(c.tabs+',.tp-menu,.tp-more,.moremenu,.tabmore'))pos[cur]=getY(cur)},true);
  addEventListener('keydown',e=>{if(cur&&(e.key==='Enter'||e.key===' '))pos[cur]=getY(cur)},true);
  function changed(){
    const t=active();if(!t||t===cur)return;
    if(pos[cur]==null)pos[cur]=0;
    if(!restoring)history.pushState({uxTab:t},'',location.href);
    restoring=false;cur=t;
    const y=pos[t]||0;requestAnimationFrame(()=>requestAnimationFrame(()=>setY(t,y)));
  }
  new MutationObserver(changed).observe(document.querySelector(c.nav),{subtree:true,attributes:true,attributeFilter:[c.attr]});
  addEventListener('popstate',e=>{
    const t=e.state&&e.state.uxTab;if(!t||t===active())return;
    const b=btns().find(x=>keyOf(x)===t);if(!b||b.disabled)return;
    if(cur)pos[cur]=getY(cur);restoring=true;b.click();
    setTimeout(()=>{if(active()!==t)restoring=false},300);
  });
  /* brouillon du ticket en cours d'écriture */
  if(c.draft){
    const d=c.draft,K=c.prefix+'-brouillon-ticket',f=document.querySelector(d.form),body=document.querySelector(d.body),subj=document.querySelector(d.subject),sub=document.querySelector(d.submit);
    if(f&&body){
      const isNew=()=>!sub||/cr[ée]er/i.test(sub.textContent||'');
      const read=()=>{try{return JSON.parse(localStorage.getItem(K)||'null')}catch(e){return null}};
      const write=v=>{try{v?localStorage.setItem(K,JSON.stringify(v)):localStorage.removeItem(K)}catch(e){}};
      const save=()=>{if(!isNew())return;const v={b:body.value,s:subj?subj.value:''};write(v.b.trim()||v.s?v:null)};
      body.addEventListener('input',save);subj&&subj.addEventListener('change',save);
      let sent=0,told=false;
      const restore=()=>{const dr=read();if(!dr||body.value||!isNew()||Date.now()-sent<4000)return;
        body.value=dr.b||'';if(subj&&dr.s&&[...subj.options].some(o=>o.value===dr.s))subj.value=dr.s;
        if(dr.b&&!told){told=true;const n=document.createElement('p');n.className='ux-draft';n.textContent='Brouillon retrouvé : ton ticket non envoyé a été remis ici.';body.insertAdjacentElement('afterend',n);setTimeout(()=>n.remove(),8000)}};
      restore();
      /* l'appli peut vider le formulaire (connexion, annulation) : on remet le brouillon, sauf juste après un envoi */
      f.addEventListener('reset',()=>setTimeout(restore,0));
      f.addEventListener('submit',()=>{sent=Date.now();write(null)});
    }
  }
})(UX_CONF);
