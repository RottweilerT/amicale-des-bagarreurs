/* ===== Onglets personnalisables (même fonctionnement que le FC St Léon) =====
   Appui long sur un onglet (clic droit sur ordinateur) : « Masquer l'onglet ». Les onglets masqués passent
   dans le menu « ⋯ » en fin de barre, où ils restent utilisables ; appui long dans ce menu : « Réafficher l'onglet ».
   Les préférences sont gardées sur l'appareil (localStorage). Rien n'est supprimé : les onglets sont seulement cachés,
   et un clic dans le menu déclenche le bouton d'origine, donc la navigation de l'appli reste la même. */
function TabsPerso(o){
  const btns=o.buttons,keyOf=o.key;
  /* Préférences propres à chaque profil : { "<profil>": [onglets masqués] } (« _ » = aucun profil choisi).
     L'ancien réglage commun à l'appareil (simple liste) est repris une fois par le premier profil qui s'ouvre. */
  const who=()=>{try{return (o.profile&&o.profile())||'_'}catch(e){return '_'}};
  const all=()=>{try{const v=JSON.parse(localStorage.getItem(o.storage)||'{}');return v&&typeof v==='object'?v:{}}catch(e){return {}}};
  const read=()=>{let a=all(),p=who();
    if(Array.isArray(a)){a={[p]:a};try{localStorage.setItem(o.storage,JSON.stringify(a))}catch(e){}}
    const v=a[p]===undefined&&p!=='_'&&o.defaut?o.defaut:a[p];let h=Array.isArray(v)?v.filter(k=>btns.some(b=>keyOf(b)===k)):[];
    /* onglet apparu depuis le dernier réglage de ce profil : rangé dans ⋯ s'il l'est par défaut */
    if(Array.isArray(a[p])&&p!=='_'&&o.defaut){const known=Array.isArray(a['~'+p])?a['~'+p]:(o.anciens||btns.map(keyOf));btns.forEach(b=>{const k=keyOf(b);if(!known.includes(k)&&o.defaut.includes(k)&&!h.includes(k))h.push(k)})}
    return h.length>=btns.length?[]:h};
  const write=v=>{const a=all(),b=Array.isArray(a)?{}:a;b[who()]=v;b['~'+who()]=btns.map(keyOf);try{localStorage.setItem(o.storage,JSON.stringify(b))}catch(e){}};
  let cur=who(),hidden=read();
  const label=b=>(o.label?o.label(b):b.textContent).trim();
  const isOn=b=>b.getAttribute(o.activeAttr)===(o.activeVal||'true');
  const more=document.createElement('button');more.type='button';more.className='tp-more tp-lp';
  more.setAttribute('aria-label','Onglets masqués');more.setAttribute('aria-haspopup','menu');more.setAttribute('aria-expanded','false');
  more.innerHTML=o.moreHTML||'⋯';more.hidden=true;o.container.appendChild(more);
  const mk=c=>{const m=document.createElement('div');m.className='tp-menu '+c;m.setAttribute('role','menu');m.hidden=true;document.body.appendChild(m);return m};
  const menu=mk('tp-list'),ctx=mk('tp-ctx');
  if(o.up)[menu,ctx].forEach(m=>m.style.setProperty('--tp-dy','4px'));
  function place(el,anchor,alignLeft){
    el.hidden=false;const r=anchor.getBoundingClientRect(),w=el.offsetWidth,h=el.offsetHeight;
    let left=alignLeft?r.left:r.right-w;left=Math.max(8,Math.min(left,innerWidth-w-8));
    let top=o.up?r.top-h-6:r.bottom+6;if(top<8)top=r.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);
    el.style.left=left+'px';el.style.top=top+'px';
  }
  function closeMenu(){menu.hidden=true;more.setAttribute('aria-expanded','false')}
  function closeCtx(){ctx.hidden=true;ctx.innerHTML=''}
  function closeAll(){closeMenu();closeCtx()}
  /* appui long sur mobile, clic droit sur ordinateur ; le « clic » qui suit un appui long est ignoré */
  function onLongPress(el,fn){
    let tm=null,sx=0,sy=0;const stop=()=>{clearTimeout(tm);tm=null};
    el.classList.add('tp-lp');
    el.addEventListener('pointerdown',e=>{delete el.dataset.lp;if(e.pointerType==='mouse')return;sx=e.clientX;sy=e.clientY;stop();
      tm=setTimeout(()=>{tm=null;el.dataset.lp='1';try{navigator.vibrate&&navigator.vibrate(15)}catch(_){}fn()},550)});
    el.addEventListener('pointermove',e=>{if(tm&&Math.hypot(e.clientX-sx,e.clientY-sy)>10)stop()});
    ['pointerup','pointercancel','pointerleave'].forEach(k=>el.addEventListener(k,stop));
    el.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();stop();if(el.dataset.lp&&!ctx.hidden)return;fn()});
    el.addEventListener('click',e=>{if(el.dataset.lp){delete el.dataset.lp;e.preventDefault();e.stopImmediatePropagation()}},true);
  }
  function openCtx(anchor,k,mode){
    closeCtx();
    const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');
    b.textContent=mode==='hide'?'Masquer l’onglet':'Réafficher l’onglet';
    b.onclick=e=>{e.stopPropagation();closeCtx();mode==='hide'?hide(k):show(k)};
    ctx.appendChild(b);ctx._a=anchor;place(ctx,anchor,true);setTimeout(()=>b.focus(),0);
  }
  function hide(k){
    const vis=btns.filter(b=>!hidden.includes(keyOf(b)));
    if(!vis.some(b=>keyOf(b)===k))return;
    if(vis.length<=1){o.toast&&o.toast('Garde au moins un onglet visible.');return}
    const b=btns.find(x=>keyOf(x)===k),done=()=>{b.classList.remove('tp-out');hidden=btns.map(keyOf).filter(x=>x===k||hidden.includes(x));write(hidden);render();o.toast&&o.toast('« '+label(b)+' » rangé dans ⋯')};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)done();else{b.classList.add('tp-out');setTimeout(done,160)}
  }
  function show(k){
    hidden=hidden.filter(x=>x!==k);write(hidden);closeMenu();render();
    const b=btns.find(x=>keyOf(x)===k);if(!b)return;
    b.classList.remove('tp-in');void b.offsetWidth;b.classList.add('tp-in');b.addEventListener('animationend',()=>b.classList.remove('tp-in'),{once:true});
    o.toast&&o.toast('« '+label(b)+' » est de retour dans la barre');
  }
  function fillMenu(){
    menu.innerHTML='<p>Onglets masqués · appui long pour réafficher</p>';
    btns.filter(b=>hidden.includes(keyOf(b))).forEach(b=>{
      const it=document.createElement('button');it.type='button';it.setAttribute('role','menuitem');
      const svg=b.querySelector('svg');if(svg)it.appendChild(svg.cloneNode(true));
      it.appendChild(document.createTextNode(label(b)));
      if(isOn(b))it.setAttribute('aria-current','true');if(b.disabled)it.disabled=true;
      it.onclick=e=>{e.stopPropagation();closeMenu();b.click()};
      onLongPress(it,()=>openCtx(it,keyOf(b),'show'));
      menu.appendChild(it);
    });
  }
  function render(){
    let chg=false;if(who()!==cur){cur=who();hidden=read();closeAll();chg=true}
    const vis=btns.filter(b=>!hidden.includes(keyOf(b)));
    btns.forEach(b=>{b.hidden=hidden.includes(keyOf(b))});
    more.hidden=!hidden.length;
    if(o.grid)o.grid.style.gridTemplateColumns=`repeat(${vis.length+(hidden.length?1:0)},1fr)`;
    const on=btns.some(b=>b.hidden&&isOn(b));
    const mv=on?(o.activeVal||'true'):(o.activeOff||'false');if(more.getAttribute(o.activeAttr)!==mv)more.setAttribute(o.activeAttr,mv);
    if(!hidden.length)closeMenu();else if(!menu.hidden)fillMenu();
    if(o.onRender)o.onRender(vis,more);
    if(chg&&o.onProfile)o.onProfile(vis);
  }
  btns.forEach(b=>onLongPress(b,()=>openCtx(b,keyOf(b),'hide')));
  more.addEventListener('click',e=>{e.stopPropagation();e.preventDefault();closeCtx();if(!menu.hidden){closeMenu();return}fillMenu();place(menu,more,false);more.setAttribute('aria-expanded','true')});
  document.addEventListener('click',e=>{if(!ctx.hidden&&!ctx.contains(e.target))closeCtx();if(!menu.hidden&&!menu.contains(e.target)&&e.target!==more)closeMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
  /* le menu suit l'onglet si la page ou la barre défile */
  const follow=()=>{if(!menu.hidden)place(menu,more,false);if(!ctx.hidden&&ctx._a&&ctx._a.isConnected&&!ctx._a.hidden)place(ctx,ctx._a,true);else if(!ctx.hidden)closeCtx()};
  addEventListener('resize',follow);addEventListener('scroll',follow,{passive:true,capture:true});
  new MutationObserver(ms=>{if(ms.some(m=>m.target!==more))render()}).observe(o.container,{subtree:true,attributes:true,attributeFilter:[o.activeAttr,'disabled']});
  render();setInterval(()=>{if(who()!==cur)render()},800);  /* changement de profil */
  return {hide,show,refresh:render,hidden:()=>hidden.slice()};
}
/* Par défaut (et une fois pour tous les profils existants, d'où la nouvelle clé) : seuls Calendrier et Minuteur restent visibles,
   le reste est rangé dans ⋯. Sans profil choisi, tout reste visible pour pouvoir s'inscrire. */
const ongletVisible=vis=>{const a=vis.find(b=>b.dataset.tab===ui.tab);if(!a&&vis[0])showTab(vis[0].dataset.tab)};
TabsPerso({container:document.querySelector('nav.tabs'),buttons:[...document.querySelectorAll('nav.tabs button[data-tab]')],key:b=>b.dataset.tab,activeAttr:'aria-selected',profile:()=>me,storage:'adb-onglets-masques-2',toast,
  defaut:CFG.onglets_masques_par_defaut,anciens:CFG.onglets_anciens,
  onRender:(vis,more)=>{const C=['b','w','r'];vis.forEach((b,i)=>{b.dataset.tc=C[i%3]});more.dataset.tc=C[vis.length%3]},
  onProfile:ongletVisible});
if(!location.hash)ongletVisible([...document.querySelectorAll('nav.tabs button[data-tab]')].filter(b=>!b.hidden));
