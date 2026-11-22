/* Minuteur — bibliothèque (recherche, favoris, exercices perso), séances (sauvegarde locale ou partagée, migration),
   modèles, combos, générateur, historique et statistiques. Utilise les fonctions de l'appli (setDoc, delDoc, SEANCES, me…)
   seulement au moment de l'appel. */
(function(){
'use strict';
const M=window.ADB_MOTEUR,L=window.ADB_LIB;
const lsG=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsS=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const jget=(k,d)=>{try{const v=JSON.parse(lsG(k)||'null');return v??d}catch(e){return d}};
const jset=(k,v)=>lsS(k,JSON.stringify(v));
const now=()=>new Date().toISOString();

/* ---------- bibliothèque ---------- */
const CAT=Object.fromEntries(L.cats);
const EX=new Map(L.exos.map(a=>{const [id,nom,cats,mp,ms,niv,cardio,impact,mat,pos,esp,instr,facile,difficile,cote]=a;
  return [id,{id,nom,cats,cat:cats[0],mp,ms,niv,cardio,impact,mat,pos,esp,instr,facile,difficile,cote:cote||''}]}));
let perso=jget('adb-mn-exos-perso',[]);if(!Array.isArray(perso))perso=[];
let fav=jget('adb-mn-fav',{});fav={exos:fav.exos||[],combos:fav.combos||[],seances:fav.seances||[]};
const saveFav=()=>jset('adb-mn-fav',fav);
function exo(id){return EX.get(id)||perso.find(p=>p.id===id)||null}
/* exercices faits d'un seul côté : le moteur les divise en gauche puis droite (sauf si un côté est choisi) */
M.definirCotes(id=>{const e=exo(id);return e&&e.cote||''});
function tousExos(){return [...EX.values(),...perso]}
const sansAccent=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/* recherche « intelligente » : tous les mots, dans le nom, les catégories, les muscles, la consigne */
function chercher(q,f){
  f=f||{};const mots=sansAccent(q).split(/\s+/).filter(Boolean);
  return tousExos().filter(e=>{
    if(f.cat&&!(e.cats||[]).includes(f.cat))return false;
    if(f.fav&&!fav.exos.includes(e.id))return false;
    if(f.pos&&e.pos!==f.pos)return false;
    if(f.sansMat&&e.mat)return false;
    if(f.niv&&e.niv>f.niv)return false;
    if(!mots.length)return true;
    const t=sansAccent([e.nom,...(e.cats||[]).map(c=>CAT[c]),...(e.mp||[]).concat(e.ms||[]).map(m=>L.muscles[m]),e.instr].join(' '));
    return mots.every(m=>t.includes(m));
  }).sort((a,b)=>{const fa=fav.exos.includes(a.id)?0:1,fb=fav.exos.includes(b.id)?0:1;return fa-fb||(q?rang(a,q)-rang(b,q):0)||a.nom.localeCompare(b.nom,'fr')});
}
const rang=(e,q)=>{const i=sansAccent(e.nom).indexOf(sansAccent(q).trim());return i<0?1000:i};
function basculerFav(type,id){const l=fav[type];const i=l.indexOf(id);if(i>=0)l.splice(i,1);else l.unshift(id);saveFav();return i<0}
function ajouterPerso(nom,cat){
  nom=String(nom||'').trim().slice(0,50);if(!nom)return null;
  const ex=tousExos().find(e=>sansAccent(e.nom)===sansAccent(nom));if(ex)return ex;
  const e={id:'p-'+Date.now().toString(36),nom,cats:[cat||'cardio'],cat:cat||'cardio',mp:[],ms:[],niv:1,cardio:1,impact:1,mat:'',pos:'d',esp:'p',instr:'Exercice personnalisé.',facile:'',difficile:'',perso:true};
  perso.push(e);jset('adb-mn-exos-perso',perso);return e;
}
function supprimerPerso(id){perso=perso.filter(p=>p.id!==id);jset('adb-mn-exos-perso',perso)}
/* le bloc garde une copie du nom et de la catégorie : la séance reste juste même si la bibliothèque change */
const refExo=e=>e?{id:e.id,nom:e.nom,cat:e.cat||(e.cats&&e.cats[0])||''}:{id:'',nom:'',cat:''};
const A=(id,d,o)=>Object.assign({t:'act',exo:refExo(exo(id)),d},o||{});
const R=d=>({t:'repos',d}),REC=d=>({t:'recup',d});
const REP=(n,blocs,o)=>Object.assign({t:'rep',n,blocs},o||{});
const COMBO=(nom,mvts,tours)=>({t:'combo',nom,mvts,tours:tours||1});

/* ---------- résumé d'une séance (liste « Mes séances ») ---------- */
function resume(s){
  const steps=M.compiler(s),acts=steps.filter(x=>x.k==='act');
  const noms=new Set(acts.map(x=>x.nom));let tops=0;
  const top=(s.blocs||[]).filter(b=>b.t==='rep');tops=top.length?Math.max(...top.map(b=>b.n)):acts.length;
  const mus={},cats={};let niv=0,car=0,dt=0;
  acts.forEach(a=>{const e=a.exo&&exo(a.exo.id),d=a.d||40;dt+=d;
    if(e){(e.mp||[]).forEach(m=>{if(m!=='ce'&&m!=='car')mus[m]=(mus[m]||0)+d});niv+=e.niv*d;car+=e.cardio*d}else{niv+=1.5*d;car+=1.5*d}
    const c=(a.exo&&a.exo.cat)||'autre';cats[c]=(cats[c]||0)+d});
  const tot=M.dureeTotale(steps),actif=acts.reduce((t,a)=>t+(a.d||40),0);
  niv=dt?niv/dt:1;car=dt?car/dt:1;
  const score=niv+.6*car+(tot?1.2*actif/tot:0)+Math.min(1,tot/2400);
  const diff=score<3?'Facile':score<3.8?'Moyenne':score<4.6?'Difficile':'Très difficile';
  const zones=Object.entries(mus).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([m])=>L.muscles[m]);
  const catP=Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c])=>c);
  return {duree:tot,actif,nbExos:noms.size,rounds:tops,zones,diff,score,cats:catP,etapes:steps.length};
}

/* ---------- séances enregistrées ---------- */
let locales=jget('adb-mn-seances',[]);if(!Array.isArray(locales))locales=[];
let utilise=jget('adb-mn-used',{});
const saveLoc=()=>jset('adb-mn-seances',locales);
/* ancien format (rounds × effort / repos, un exercice par round) → blocs */
function depuisAncien(p){
  const ex=Array.isArray(p.exos)?p.exos:[];const blocs=[];
  if(p.warmOn&&p.warm)blocs.push(A('shadow-libre',p.warm,{note:'Échauffement'}));
  const memes=ex.every(x=>(x||'')===(ex[0]||''));
  const actOf=k=>{const nom=ex[k]||'';const e=nom&&tousExos().find(x=>sansAccent(x.nom)===sansAccent(nom));
    return {t:'act',exo:e?refExo(e):{id:'',nom:nom||'Round',cat:'boxe'},d:p.work||180}};
  if(memes)blocs.push(REP(p.rounds||1,[actOf(0)].concat(p.rest?[R(p.rest)]:[])));
  else blocs.push({t:'rep',n:p.rounds||1,lie:false,blocs:[actOf(0)].concat(p.rest?[R(p.rest)]:[]),
    occ:Array.from({length:p.rounds||1},(_,k)=>({blocs:[actOf(k)].concat(p.rest?[R(p.rest)]:[])}))});
  if(p.coolOn&&p.cool)blocs.push(REC(p.cool));
  return M.normaliser({nom:p.name||'Séance',prep:6,blocs,mode:'simple'});
}
(function migrer(){
  if(lsG('adb-mn-migre'))return;
  const anciens=jget('adb-tm-presets',[]);
  if(Array.isArray(anciens))anciens.forEach(p=>{try{const s=depuisAncien(p);locales.push({s,cree:now(),maj:now()})}catch(e){}});
  saveLoc();lsS('adb-mn-migre','1');
})();
function partagees(){
  const m=typeof SEANCES!=='undefined'?SEANCES:new Map(),out=[];
  for(const [id,d] of m){try{
    const s=d.v===2&&Array.isArray(d.blocs)?M.normaliser(Object.assign({},d,{id})):Object.assign(depuisAncien(d),{id});
    out.push({src:'groupe',id,s,auteur:d.auteur||'',auteurId:d.auteurId||'',cree:d.at||'',maj:d.updated||d.at||''});
  }catch(e){}}
  return out;
}
function toutes(){
  return locales.map(x=>({src:'local',id:x.s.id,s:M.normaliser(x.s),cree:x.cree,maj:x.maj})).concat(partagees())
    .map(x=>Object.assign(x,{fav:fav.seances.includes(x.id),utilise:utilise[x.id]||'',r:resume(x.s)}));
}
function trouver(id){return toutes().find(x=>x.id===id)||null}
/* enregistre (création ou mise à jour). partage=true : visible par tout le groupe (Firestore) */
function enregistrer(s,partage){
  s=M.normaliser(s);const deja=trouver(s.id);
  if(partage){
    if(typeof db==='undefined'||!db)throw new Error('hors-ligne');
    const mm=typeof me!=='undefined'&&me&&member(me);
    const steps=M.compiler(s),a=steps.find(x=>x.k==='act'),r=steps.find(x=>x.k==='repos');
    const id=deja&&deja.src==='groupe'?s.id:(s.id.startsWith('t-')?s.id:'t-'+rid());
    if(deja&&deja.src==='local'){locales=locales.filter(x=>x.s.id!==s.id);saveLoc()}
    s.id=id;
    setDoc('courses/'+id,{kind:'seance',v:2,nom:s.nom,prep:s.prep,blocs:s.blocs,cat:s.cat,mode:s.mode,
      name:s.nom,rounds:resume(s).rounds,work:a?a.d||60:60,rest:r?r.d:0, /* champs lus par les anciennes versions de l'appli */
      auteur:deja&&deja.auteur||(mm?mm.first+' '+mm.last:''),auteurId:deja&&deja.auteurId||(mm?me:''),at:deja&&deja.cree||now(),updated:now()});
  }else{
    if(deja&&deja.src==='groupe'){delDoc('courses/'+s.id);s.id=M.nid('s')}
    const i=locales.findIndex(x=>x.s.id===s.id);
    if(i>=0)locales[i]={s,cree:locales[i].cree,maj:now()};else locales.unshift({s,cree:now(),maj:now()});
    saveLoc();
  }
  return s;
}
function supprimer(id){
  const x=trouver(id);if(!x)return;
  if(x.src==='groupe')delDoc('courses/'+id);else{locales=locales.filter(y=>y.s.id!==id);saveLoc()}
  fav.seances=fav.seances.filter(y=>y!==id);saveFav();
}
function dupliquer(id){
  const x=trouver(id);if(!x)return null;
  const s=M.normaliser(Object.assign(M.clone(x.s,true),{id:M.nid('s'),nom:(x.s.nom+' (copie)').slice(0,50)}));
  locales.unshift({s,cree:now(),maj:now()});saveLoc();return s;
}
function marquerUtilisee(id){if(!id)return;utilise[id]=now();jset('adb-mn-used',utilise)}

/* ---------- combos enregistrés ---------- */
let combos=jget('adb-mn-combos',[]);if(!Array.isArray(combos))combos=[];
function enregistrerCombo(b){
  const c={id:b.comboId||'k'+Date.now().toString(36),nom:String(b.nom||'Combo').slice(0,40),tours:b.tours||1,mvts:M.clone(b.mvts,true)};
  const i=combos.findIndex(x=>x.id===c.id);if(i>=0)combos[i]=c;else combos.unshift(c);jset('adb-mn-combos',combos);return c;
}
function supprimerCombo(id){combos=combos.filter(c=>c.id!==id);jset('adb-mn-combos',combos)}
const blocDeCombo=c=>({t:'combo',nom:c.nom,tours:c.tours||1,comboId:c.id,mvts:M.clone(c.mvts,true)});
const COMBOS_BASE=[
  {id:'kb-cond',nom:'Combo conditionnement',tours:1,mvts:[A('jumping-jacks',30),A('squats',20),A('pompes',10)]},
  {id:'kb-boxe',nom:'Combo boxeur',tours:1,mvts:[A('shadow-intense',30),A('sprawls',15),A('mountain-climbers',15)]},
  {id:'kb-abdos',nom:'Combo abdos',tours:1,mvts:[A('crunchs',20),A('bicycle',20),A('planche',20)]},
  {id:'kb-reps',nom:'Combo en répétitions',tours:1,mvts:[A('burpees',0,{reps:10}),A('squats',0,{reps:20}),A('pompes',0,{reps:10})]}
].map(c=>Object.assign(c,{base:true}));
function tousCombos(){return combos.concat(COMBOS_BASE.filter(b=>!combos.some(c=>c.id===b.id)))}

/* ---------- modèles prêts à utiliser ---------- */
const MODELES=[
  {nom:'Boxe technique',cat:'boxe',prep:10,blocs:[A('corde-imaginaire',60),A('mobilite-epaules',30),R(15),A('shadow-tech',180),R(60),A('jab-cross',180),R(60),A('defense',180),R(60),A('contres',180),R(60),A('combis-libres',180),REC(60),A('respiration-recup',60)]},
  {nom:'Boxe cardio',cat:'boxe',prep:10,blocs:[A('pas-boxeur',60),R(15),REP(6,[A('shadow-cardio',120),R(20),A('burpees',30),R(40)])]},
  {nom:'Boxe explosive',cat:'explo',prep:10,blocs:[A('shadow-libre',120),R(30),REP(8,[A('frappes-explo',20),R(10)]),REC(60),REP(6,[A('shadow-explo',30),A('sprawls-rapides',15),R(45)])]},
  {nom:'Haut du corps',cat:'bras',prep:10,blocs:[A('cercles-bras',30),A('cercles-bras-inv',30),R(10),REP(3,[A('pompes',40),R(20),A('pompes-pike',40),R(20),A('reverse-snow',40),R(20),A('pompes-diamant',30),R(20),A('shoulder-taps',40),REC(60)])]},
  {nom:'Bas du corps',cat:'cuisses',prep:10,blocs:[A('rotations-hanches',40),A('squats',30),R(10),REP(3,[A('squats',45),R(15),A('fentes-alternees',45),R(15),A('pont',45),R(15),A('pointes',45),R(15),A('chaise',40),REC(60)])]},
  {nom:'Abdominaux',cat:'abdos',prep:10,blocs:[REP(3,[A('crunchs',40),R(20),A('bicycle',40),R(20),A('releves-jambes',40),R(20),A('russian-twists',40),R(20),A('mountain-climbers',30),REC(45)])]},
  {nom:'Gainage',cat:'gainage',prep:10,blocs:[REP(3,[A('planche',45),R(15),A('planche-lat-g',30),R(10),A('planche-lat-d',30),R(15),A('dead-bug',40),R(15),A('superman-hold',30),REC(45)])]},
  {nom:'Full body',cat:'cardio',prep:10,blocs:[A('jumping-jacks',60),R(15),REP(4,[A('burpees',40),R(20),A('squats',40),R(20),A('pompes',40),R(20),A('mountain-climbers',40),R(20),A('pont',40),REC(60)])]},
  {nom:'HIIT',cat:'cardio',prep:10,blocs:[REP(2,[A('high-knees',40),R(20),A('squats-sautes',40),R(20),A('mountain-climbers',40),R(20),A('burpees',40),R(20),A('skaters',40),R(20),A('plank-jacks',40),REC(90)])]},
  {nom:'Tabata',cat:'cardio',prep:10,blocs:[REP(8,[A('squats-sautes',20),R(10)],{finSansRepos:false}),REC(60),REP(8,[A('mountain-climbers',20),R(10)])]},
  {nom:'Conditionnement traditionnel',cat:'trad',prep:10,blocs:[REP(4,[A('hindu-squats',60),R(20),A('pompes-hindoues',45),R(20),A('bear-crawl',45),R(20),A('burpees-stricts',40),R(20),A('gainage-prolonge',60),REC(60)])]},
  {nom:'Mobilité',cat:'mobilite',prep:5,blocs:['rotations-cervicales','mobilite-epaules','rotations-thoraciques','cat-cow','rotations-hanches','ouvertures-hanches','greatest-stretch','etir-ischios','mobilite-chevilles'].flatMap(id=>[A(id,45),R(10)]).concat([A('respiration-diaph',90)])},
  {nom:'Récupération active',cat:'mobilite',prep:5,blocs:[A('marche-sur-place',120),A('mobilite-epaules',60),A('cat-cow',60),A('squat-hold',60),A('etir-quadri',45),A('etir-ischios',45),A('etir-mollets',45),A('respiration-recup',120)]},
  {nom:'Circuit mixte boxe-musculation',cat:'boxe',prep:10,blocs:[A('shadow-libre',90),R(15),REP(4,[A('shadow-intense',90),R(15),A('pompes',30),R(15),A('squats',30),R(15),A('crochets',60),R(15),A('planche',45),REC(60)])]}
].map(m=>M.normaliser(Object.assign({mode:'modele'},m)));
function depuisModele(k){const m=MODELES[k];return M.normaliser(Object.assign(M.clone(m,true),{id:M.nid('s')}))}

/* ---------- mode simple / rapide ---------- */
function simple(o){
  o=o||{};const blocs=[];const n=Math.max(1,o.rounds|0||1),exos=o.exos||[];
  const act=k=>{const e=exos[k]&&exo(exos[k]);return e?A(e.id,o.travail):{t:'act',exo:{id:'',nom:o.nomAct||'Round',cat:'boxe'},d:o.travail}};
  const memes=exos.every(x=>x===exos[0]);
  if(memes)blocs.push(REP(n,[act(0)].concat(o.repos?[R(o.repos)]:[])));
  else blocs.push({t:'rep',n,lie:false,blocs:[act(0)].concat(o.repos?[R(o.repos)]:[]),occ:Array.from({length:n},(_,k)=>({blocs:[act(k)].concat(o.repos?[R(o.repos)]:[])}))});
  return M.normaliser({nom:o.nom||'',prep:o.prep??10,blocs,mode:o.mode||'simple',cat:'boxe'});
}

/* ---------- générateur ---------- */
const ZONES={haut:['bras','epaules','pecs','dos'],tronc:['abdos','gainage'],bas:['cuisses','fessiers','mollets'],cardio:['cardio','explo','trad'],boxe:['boxe','coord']};
const ZONES_NOM={haut:'Haut du corps',tronc:'Abdos et gainage',bas:'Bas du corps',cardio:'Cardio',boxe:'Boxe'};
const MUSCLE_ZONE=m=>['ep','tri','pec','dos','bic','avb'].includes(m)?'haut':['abd','obl','lomb'].includes(m)?'tronc':['qua','isc','fes','mol','add','hanch','chev'].includes(m)?'bas':'ce';
function pool(o){
  let cats=new Set((o.cats||[]).concat(...(o.zones||[]).map(z=>ZONES[z]||[])));
  const tous=!cats.size;
  return tousExos().filter(e=>!e.perso&&(tous?!e.cats.includes('mobilite')||e.cats.length>1:e.cats.some(c=>cats.has(c)))
    &&(!e.mat||(o.mat||[]).includes(e.mat))&&e.impact<=(o.impact||3)&&e.niv<=(o.niveau||3)&&!(e.cat==='mobilite'&&!cats.has('mobilite')));
}
function choisir(cands,prec,deja,o,rand){
  rand=rand||Math.random;let best=null,bs=-1e9;
  for(const e of cands){
    let s=rand()*3;
    if(deja.has(e.id))s-=6;
    if(prec){
      const zp=new Set((prec.mp||[]).map(MUSCLE_ZONE)),ze=(e.mp||[]).map(MUSCLE_ZONE);
      if(ze.some(z=>z!=='ce'&&zp.has(z)))s-=4;          // pas deux fois de suite la même zone
      if((e.mp||[]).some(m=>(prec.mp||[]).includes(m)))s-=3;
      if(e.pos!==prec.pos&&e.pos!=='x'&&prec.pos!=='x')s-=1.5; // limite les passages debout/sol
    }
    if(o.cardio)s-=Math.abs(e.cardio-o.cardio)*1.2;
    if(o.niveau)s-=Math.max(0,o.niveau-e.niv)*.6;
    if(s>bs){bs=s;best=e}
  }
  return best;
}
function generer(o,rand){
  o=Object.assign({duree:20,zones:[],cats:[],niveau:2,cardio:2,impact:3,mat:[],travail:40,repos:20,echauffement:true},o||{});
  const P=pool(o);if(!P.length)return null;
  const total=Math.max(5,o.duree)*60,blocs=[];const deja=new Set();let prec=null;
  let echauf=0,calme=0;
  if(o.echauffement&&total>=600){
    const w=tousExos().filter(e=>!e.perso&&(e.cats.includes('mobilite')||(e.cat==='cardio'&&e.niv===1))&&e.impact<=Math.min(2,o.impact)&&!e.mat);
    const ids=['cercles-bras','rotations-hanches','genoux-moderes','corde-imaginaire','mobilite-epaules','jumping-jacks','pas-boxeur'].filter(id=>w.some(e=>e.id===id)&&(exo(id).impact<=o.impact));
    const pick=ids.sort(()=>(rand||Math.random)()-.5).slice(0,3);
    pick.forEach(id=>{blocs.push(A(id,45,{note:'Échauffement'}));echauf+=45});
    blocs.push(R(15));echauf+=15;
    calme=150;
  }
  const main=total-echauf-calme,slot=o.travail+o.repos;
  let n=Math.max(1,Math.round((main+o.repos)/slot));
  /* circuits : k exercices différents répétés r fois (3 tours au plus), puis un nouveau circuit après une récupération */
  const construire=n=>{
    const out=[];let reste=n;let c=0;const d2=new Set(deja);let pr=prec;
    while(reste>0){
      let k=reste,r=1;
      if(reste>=6){k=reste>=15?5:reste>=8?4:3;r=Math.min(3,Math.max(1,Math.floor(reste/k)))}
      k=Math.min(k,P.length);
      const seq=[];for(let j=0;j<k;j++){const e=choisir(P,pr,d2,o,rand);seq.push(e);d2.add(e.id);pr=e}
      const corps=[];seq.forEach((e,j)=>{corps.push(A(e.id,o.travail));if(o.repos>0)corps.push(j===seq.length-1&&r>1?REC(Math.max(o.repos*2,45)):R(o.repos))});
      if(c>0)out.push(REC(Math.max(60,o.repos*2)));
      if(r>1)out.push(REP(r,corps));else out.push(...corps);
      reste-=k*r;c++;
    }
    return out;
  };
  let corpsF=construire(n);
  for(let essai=0;essai<12&&n>1;essai++){
    const t=M.dureeTotale(M.compiler({prep:0,blocs:blocs.concat(corpsF)}))+calme;
    if(t<=total+45)break;n--;corpsF=construire(n);
  }
  blocs.push(...corpsF);
  const seq=corpsF.flatMap(b=>b.t==='rep'?b.blocs:[b]).filter(b=>b.t==='act').map(b=>exo(b.exo.id));
  if(calme){blocs.push(R(15));['etir-quadri','etir-ischios','respiration-recup'].forEach((id,j)=>blocs.push(A(id,j===2?60:35,{note:'Retour au calme'})))}
  const zs=(o.zones||[]).map(z=>ZONES_NOM[z]).join(' + ')||'Full body';
  return M.normaliser({nom:'',prep:10,blocs,mode:'genere',cat:seq[0]&&seq[0].cat||''});
}
/* remplacer un exercice par un autre de la même famille, sans matériel en plus */
function remplacant(e,rand){
  const src=e&&exo(e.id);const c=src?src.cat:(e&&e.cat)||'cardio';
  const l=tousExos().filter(x=>!x.perso&&x.cats.includes(c)&&x.id!==(e&&e.id)&&(!x.mat||(src&&x.mat===src.mat)));
  return l.length?l[Math.floor((rand||Math.random)()*l.length)]:null;
}

/* ---------- historique et statistiques ---------- */
let hist=jget('adb-mn-hist',null);
if(!Array.isArray(hist)){hist=(jget('adb-tm-hist',[])||[]).map(h=>({at:h.at,nom:h.name,prevu:h.sec,fait:h.sec,actif:0,repos:0,cats:{},statut:h.done?'terminée':'interrompue',ancien:true}));jset('adb-mn-hist',hist)}
function noterSeance(h){hist.unshift(Object.assign({at:now()},h));hist=hist.slice(0,300);jset('adb-mn-hist',hist)}
function effacerHist(){hist=[];jset('adb-mn-hist',hist)}
function stats(){
  const n=hist.length,tot=hist.reduce((t,h)=>t+(h.fait||0),0),act=hist.reduce((t,h)=>t+(h.actif||0),0),rep=hist.reduce((t,h)=>t+(h.repos||0),0);
  const cats={};hist.forEach(h=>Object.entries(h.cats||{}).forEach(([c,s])=>cats[c]=(cats[c]||0)+s));
  const top=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([c,s])=>({c,nom:CAT[c]||'Autre',s}));
  const sem=[];const d0=new Date();d0.setHours(0,0,0,0);d0.setDate(d0.getDate()-((d0.getDay()+6)%7));
  for(let w=7;w>=0;w--){const a=new Date(d0);a.setDate(a.getDate()-7*w);const b=new Date(a);b.setDate(b.getDate()+7);
    sem.push({debut:a,n:hist.filter(h=>{const t=new Date(h.at);return t>=a&&t<b}).length})}
  const moy=sem.slice(0,7).reduce((t,x)=>t+x.n,0)/7;
  return {n,tot,act,rep,top,sem,moy,terminees:hist.filter(h=>h.statut==='terminée').length};
}

/* ---------- séance en cours (reprise après fermeture) ---------- */
const enCours={lire:()=>jget('adb-mn-encours',null),ecrire:v=>jset('adb-mn-encours',v),effacer:()=>{try{localStorage.removeItem('adb-mn-encours')}catch(e){}}};


/* ---------- bibliothèque visuelle (minuteur/visuels, générée par outils/visuels) ---------- */
const BASE_V='minuteur/';let MANIF=null,manifP=null;const fiches=new Map();
function chargerManifeste(){if(!manifP)manifP=fetch(BASE_V+'visuels/manifest.json').then(r=>r.ok?r.json():null).then(m=>{MANIF=m;return m}).catch(()=>{manifP=null;return null});return manifP}
/* chemins des images d'un exercice (miniature, étapes, animation) ; null si pas d'illustration */
function visuel(id){
  const m=MANIF&&MANIF.exercices&&MANIF.exercices[id];
  const d=m?BASE_V+m.dossier:(EX.has(id)?BASE_V+'visuels/'+id+'/':null);if(!d)return null;
  return {mini:d+(m?m.miniature:'thumbnail.svg'),etapes:m?m.etapes.map(f=>d+f):null,anim:m?(m.animation?d+m.animation:null):d+'animation.svg',statut:m?m.statut:'',dossier:d};
}
function fiche(id){
  if(fiches.has(id))return fiches.get(id);
  const v=visuel(id);if(!v)return Promise.resolve(null);
  const p=fetch(v.dossier+'instructions.json').then(r=>r.ok?r.json():null).catch(()=>null);fiches.set(id,p);
  p.then(x=>{if(!x)fiches.delete(id)});return p;
}
chargerManifeste();

window.ADB_SEANCES={visuel,fiche,chargerManifeste,EX,CAT,L,exo,tousExos,chercher,fav,basculerFav,ajouterPerso,supprimerPerso,refExo,A,R,REC,REP,COMBO,
  resume,toutes,trouver,enregistrer,supprimer,dupliquer,marquerUtilisee,depuisAncien,
  tousCombos,enregistrerCombo,supprimerCombo,blocDeCombo,MODELES,depuisModele,simple,
  ZONES,ZONES_NOM,pool,generer,remplacant,hist:()=>hist,noterSeance,effacerHist,stats,enCours};
})();
