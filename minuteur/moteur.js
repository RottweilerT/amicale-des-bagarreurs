/* Minuteur — moteur temporel, sans aucun affichage (testable avec Node : tests/test_moteur.js).
   1. Modèle de séance : des blocs (activité, repos, récupération longue, répétition, combo), normalisés et validés.
   2. Compilation : les blocs deviennent une suite plate d'étapes (répétitions imbriquées, liées ou indépendantes, combos).
   3. Chrono : position calculée à partir d'une horloge monotone (performance.now), jamais d'un compteur décrémenté.
   4. Événements sonores : calculés à partir du TEMPS RESTANT, chacun avec une clé unique (jamais deux fois). */
(function(root){
'use strict';
const MAX_D=7200, MAX_N=99, MAX_PROF=4, MAX_TOTAL=6*3600;
const TYPES=['act','repos','recup','rep','combo'];
const clampInt=(v,a,b,def)=>{v=Math.round(Number(v));return Number.isFinite(v)?Math.min(b,Math.max(a,v)):def};
let seq=0;
const nid=p=>(p||'b')+Date.now().toString(36)+(seq++).toString(36)+Math.random().toString(36).slice(2,5);
const str=(v,n)=>typeof v==='string'?v.slice(0,n||80):'';

/* ---------- 1. Modèle ---------- */
function normExo(e){
  if(typeof e==='string')return {id:'',nom:str(e,60),cat:''};
  e=e||{};return {id:str(e.id,60),nom:str(e.nom,60),cat:str(e.cat,20)};
}
function normBloc(b,prof){
  if(!b||typeof b!=='object'||!TYPES.includes(b.t))return null;
  const o={id:str(b.id,40)||nid(),t:b.t};
  if(b.t==='act'){
    o.exo=normExo(b.exo);o.reps=clampInt(b.reps,0,999,0);o.d=o.reps?0:clampInt(b.d,0,MAX_D,30);
    o.variante=str(b.variante,60);o.note=str(b.note,120);o.intensite=clampInt(b.intensite,0,3,0);
    o.cote=['g','d','2'].includes(b.cote)?b.cote:''; // côté travaillé : g, d, 2 = les deux à la suite ; vide = selon l'exercice
  }else if(b.t==='repos'||b.t==='recup'){
    o.d=clampInt(b.d,0,MAX_D,b.t==='recup'?120:30);o.note=str(b.note,120);
  }else if(b.t==='rep'){
    o.n=clampInt(b.n,1,MAX_N,2);o.lie=b.lie!==false;o.plie=!!b.plie;o.finSansRepos=b.finSansRepos!==false;
    o.blocs=prof>=MAX_PROF?[]:normListe(b.blocs,prof+1);
    if(!o.lie){
      const occ=Array.isArray(b.occ)?b.occ:[];
      o.occ=Array.from({length:o.n},(_,k)=>({blocs:occ[k]&&Array.isArray(occ[k].blocs)?normListe(occ[k].blocs,prof+1):clone(o.blocs,true)}));
    }
  }else if(b.t==='combo'){
    o.nom=str(b.nom,40)||'Combo';o.tours=clampInt(b.tours,1,MAX_N,1);o.comboId=str(b.comboId,40);
    o.mvts=(Array.isArray(b.mvts)?b.mvts:[]).map(m=>normBloc(m&&(m.t==='repos'||m.t==='act')?m:null,MAX_PROF)).filter(Boolean).slice(0,20);
  }
  return o;
}
function normListe(l,prof){return (Array.isArray(l)?l:[]).map(b=>normBloc(b,prof||0)).filter(Boolean).slice(0,200)}
function normaliser(s){
  s=s||{};
  return {id:str(s.id,40)||nid('s'),v:2,nom:str(s.nom,50),prep:clampInt(s.prep,0,600,10),blocs:normListe(s.blocs,0),
    cat:str(s.cat,30),mode:['simple','avance','modele','genere','rapide'].includes(s.mode)?s.mode:'avance'};
}
/* copie profonde ; avec neuf=true, de nouveaux identifiants (dupliquer un bloc, détacher une répétition) */
function clone(x,neuf){
  const c=JSON.parse(JSON.stringify(x||null));
  if(neuf){const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(v.t&&v.id)v.id=nid();Object.values(v).forEach(walk)}};walk(c)}
  return c;
}

/* ---------- côtés (exercices faits d'un seul côté à la fois) ---------- */
/* L'appli indique quels exercices se font d'un côté : fonction id → « jambe » | « bras » | « côté » | ''. */
let typeCote=()=>'';
function definirCotes(f){if(typeof f==='function')typeCote=f}
const NOM_COTE={g:'gauche',d:'droite'};
function libelleCote(type,c){if(!type||!NOM_COTE[c])return '';return type+' '+(c==='g'?'gauche':type==='jambe'?'droite':'droit')}
/* côtés effectifs d'un bloc d'activité : [] (pas de côté), ['g'], ['d'] ou ['g','d'] (les deux, gauche d'abord) */
function cotesDe(b){const t=b.exo&&b.exo.id?typeCote(b.exo.id):'';if(!t)return [];return b.cote==='g'?['g']:b.cote==='d'?['d']:['g','d']}

/* ---------- 2. Compilation en étapes ---------- */
/* Une étape : {k:'prep'|'act'|'repos'|'recup', d (s ; 0 = passage manuel), reps, nom, exo, variante, note, intensite,
   blocId, rounds:[{i,n}] (pile des répétitions englobantes), combo:{nom,tour,tours,parts,partI}|null} */
function compiler(s){
  s=normaliser(s);const out=[];
  if(s.prep>0)out.push({k:'prep',d:s.prep,nom:'Préparation',blocId:'prep',rounds:[],combo:null});
  const emit=(b,pile,combo)=>{
    if(b.t==='act'){if(b.d<=0&&!b.reps)return;
      const cs=cotesDe(b),t=cs.length?typeCote(b.exo.id):'';
      (cs.length?cs:['']).forEach((c,k)=>out.push({k:'act',d:b.reps?0:b.d,reps:b.reps,nom:b.exo.nom||'Exercice',exo:b.exo,variante:b.variante,note:b.note,intensite:b.intensite,blocId:b.id,rounds:pile,combo,
        cote:c,coteLabel:libelleCote(t,c),coteI:cs.length>1?k+1:0}));}
    else if(b.t==='repos'||b.t==='recup'){if(b.d<=0)return;
      out.push({k:b.t,d:b.d,nom:b.t==='repos'?'Repos':'Récupération',note:b.note,blocId:b.id,rounds:pile,combo});}
    else if(b.t==='rep'){
      for(let k=0;k<b.n;k++){
        let l=b.lie?b.blocs:(b.occ[k]?b.occ[k].blocs:b.blocs);
        if(b.finSansRepos&&k===b.n-1){l=l.slice();while(l.length&&(l[l.length-1].t==='repos'||l[l.length-1].t==='recup'))l.pop()}
        const p2=pile.concat([{i:k+1,n:b.n,id:b.id}]);
        l.forEach(x=>emit(x,p2,combo));
      }
    }else if(b.t==='combo'){
      const parts=b.mvts.map(m=>{const cs=m.t==='act'?cotesDe(m):[];return {k:m.t,nom:m.t==='act'?(m.exo.nom||'Exercice'):'Repos',d:m.d*(cs.length||1),reps:m.reps||0,cotes:cs.length>1?'chaque côté':cs.length?NOM_COTE[cs[0]]:''}});
      for(let k=0;k<b.tours;k++)b.mvts.forEach((m,j)=>emit(m,pile,{nom:b.nom,id:b.id,tour:k+1,tours:b.tours,parts,partI:j}));
    }
  };
  s.blocs.forEach(b=>emit(b,[],null));
  /* un repos tout à la fin n'annonce plus rien : on le retire (la récupération longue, elle, est gardée) */
  while(out.length&&out[out.length-1].k==='repos')out.pop();
  out.forEach((x,i)=>{x.i=i});
  return out;
}
const dureeTotale=steps=>steps.reduce((t,x)=>t+(x.d||0),0);
/* prochaine activité après l'étape i (traverse répétitions, combos, repos consécutifs) */
function prochaineActivite(steps,i){for(let j=i+1;j<steps.length;j++)if(steps[j].k==='act')return steps[j];return null}
/* ce qu'il faut annoncer pendant un repos : l'exercice, ou tout le combo qui commence */
function annonce(steps,i){
  const a=prochaineActivite(steps,i);if(!a)return null;
  if(a.combo){
    const parts=a.combo.parts.slice(a.combo.partI).filter(p=>p.k==='act');
    return {nom:a.combo.nom,combo:parts.map(p=>(p.reps?p.reps+' × ':fmtCourt(p.d)+' de ')+p.nom.toLowerCase()+(p.cotes?' ('+p.cotes+')':'')),d:a.combo.parts.slice(a.combo.partI).reduce((t,p)=>t+p.d,0),etape:a};
  }
  return {nom:a.nom+(a.coteLabel?' — '+a.coteLabel:''),d:a.d,reps:a.reps,variante:a.variante,etape:a};
}
function fmtCourt(s){s=Math.round(s);if(s<60)return s+' s';const m=Math.floor(s/60),r=s%60;return r?m+' min '+r:m+' min'}

/* ---------- validation ---------- */
function valider(s){
  const err=[],avert=[];const raw=s||{};
  const tour=(l,prof)=>(l||[]).forEach(b=>{
    if(!b||!TYPES.includes(b.t)){err.push({id:b&&b.id,msg:'Bloc inconnu'});return}
    if(b.t==='act'&&!(Number(b.d)>0)&&!(Number(b.reps)>0))err.push({id:b.id,msg:'« '+((b.exo&&b.exo.nom)||'Exercice')+' » : durée nulle'});
    if(b.t==='act'&&!(b.exo&&b.exo.nom))avert.push({id:b.id,msg:'Exercice sans nom'});
    if((b.t==='repos'||b.t==='recup')&&!(Number(b.d)>0))avert.push({id:b.id,msg:'Repos de 0 s : ignoré'});
    if((b.t==='act'||b.t==='repos'||b.t==='recup')&&Number(b.d)>MAX_D)err.push({id:b.id,msg:'Durée supérieure à 2 h'});
    if(b.t==='rep'){const n=Number(b.n);if(!(Number.isInteger(n)&&n>=1&&n<=MAX_N))err.push({id:b.id,msg:'Nombre de répétitions invalide (1 à '+MAX_N+')'});
      if(prof>=MAX_PROF)err.push({id:b.id,msg:'Trop de répétitions imbriquées'});
      if(!(b.blocs||[]).length&&b.lie!==false)err.push({id:b.id,msg:'Répétition vide'});
      if(b.lie===false)(b.occ||[]).forEach(o=>tour(o.blocs,prof+1));else tour(b.blocs,prof+1)}
    if(b.t==='combo'){if(!(b.mvts||[]).some(m=>m.t==='act'))err.push({id:b.id,msg:'Combo sans mouvement'});tour(b.mvts,prof+1)}
  });
  tour(raw.blocs,0);
  const steps=compiler(raw);
  if(!steps.some(x=>x.k==='act'))err.push({id:null,msg:'Séance vide : ajoute au moins un exercice'});
  if(dureeTotale(steps)>MAX_TOTAL)err.push({id:null,msg:'Séance de plus de 6 h'});
  return {ok:!err.length,erreurs:err,avertissements:avert,steps};
}

/* ---------- 3. Chrono ---------- */
/* Tous les temps sont en millisecondes sur une horloge monotone fournie par l'appelant (performance.now()). */
function chrono(steps,now){
  return {steps,i:0,debut:now,pause:null,fini:steps.length===0,stats:{actif:0,repos:0,cats:{},etapes:0},tires:new Set(),demarre:now};
}
const ecoule=(c,now)=>Math.max(0,(c.pause!==null?c.pause:now)-c.debut);
function restant(c,now){const st=c.steps[c.i];if(!st||c.fini)return 0;return st.d?Math.max(0,st.d*1000-ecoule(c,now)):0}
function compter(c,ms){
  const st=c.steps[c.i];if(!st||ms<=0)return;const s=ms/1000;
  if(st.k==='act'){c.stats.actif+=s;const k=(st.exo&&st.exo.cat)||'autre';c.stats.cats[k]=(c.stats.cats[k]||0)+s}
  else if(st.k==='repos'||st.k==='recup')c.stats.repos+=s;
}
/* fait avancer le chrono jusqu'à now ; renvoie les étapes franchies. Le début de chaque étape est calé sur la fin
   théorique de la précédente : aucune dérive, même si l'appli a été ralentie. */
function avancer(c,now){
  const pass=[];
  while(!c.fini&&c.pause===null){
    const st=c.steps[c.i];if(!st.d)break;
    const fin=c.debut+st.d*1000;if(now<fin)break;
    compter(c,st.d*1000);c.stats.etapes++;
    if(c.i+1>=c.steps.length){c.fini=true;c.finA=fin;pass.push({de:c.i,vers:null});break}
    c.i++;c.debut=fin;pass.push({de:c.i-1,vers:c.i});
  }
  return pass;
}
function pauser(c,now){avancer(c,now);if(!c.fini&&c.pause===null)c.pause=now}
function reprendre(c,now){if(c.pause===null)return;c.debut+=now-c.pause;c.pause=null}
/* oublie les sons déjà programmés à partir de l'étape j (pour qu'ils repartent au bon moment) */
function oublier(c,j){for(const k of [...c.tires]){const m=/^[tpc]:(\d+)/.exec(k);if(m&&Number(m[1])>=j)c.tires.delete(k)}}
function aller(c,j,now){
  if(j<0)j=0;
  if(j>=c.steps.length){compter(c,Math.min(ecoule(c,now),(c.steps[c.i].d||1e9)*1000));c.fini=true;c.finA=now;return}
  compter(c,Math.min(ecoule(c,now),(c.steps[c.i].d||1e9)*1000));if(j>c.i)c.stats.etapes+=j-c.i;
  c.i=j;c.debut=now;if(c.pause!==null)c.pause=now;
  oublier(c,j);c.tires.add('t:'+j); // la transition de cette étape est jouée tout de suite par l'appelant
}
function suivant(c,now){avancer(c,now);if(!c.fini)aller(c,c.i+1,now)}
/* précédent : après 3 s dans l'étape, on la recommence ; sinon on revient à la précédente */
function precedent(c,now){
  if(c.fini)return;avancer(c,now);
  const j=ecoule(c,now)>3000||c.i===0?c.i:c.i-1;
  if(j<c.i)c.stats.etapes=Math.max(0,c.stats.etapes-1);
  compter(c,Math.min(ecoule(c,now),(c.steps[c.i].d||1e9)*1000));
  c.i=j;c.debut=now;if(c.pause!==null)c.pause=now;oublier(c,j);c.tires.add('t:'+j);
}
function progression(c,now){
  const tot=dureeTotale(c.steps);let fait=0;
  for(let j=0;j<c.i&&j<c.steps.length;j++)fait+=c.steps[j].d||0;
  const st=c.steps[c.i];
  if(c.fini)fait=tot;else if(st&&st.d)fait+=Math.min(st.d*1000,ecoule(c,now))/1000;
  return {total:tot,fait,reste:Math.max(0,tot-fait),pct:tot?Math.min(100,100*fait/tot):(c.fini?100:0),etapesFaites:c.fini?c.steps.length:c.i,etapes:c.steps.length};
}
/* Événements sonores à venir dans la fenêtre [now, now+horizon], calculés à partir du temps restant de chaque étape.
   at : instant absolu (ms). Clés : t:j transition au début de l'étape j, p:j:s palier « s secondes restantes »,
   c:j:s décompte, fin. Le palier n'est jamais joué au tout début d'une étape (s < durée), le décompte non plus. */
function evenements(c,now,horizon){
  const ev=[];if(c.pause!==null)return ev;
  if(c.fini){if(!c.tires.has('fin'))ev.push({at:c.finA||now,cle:'fin',type:'fin'});return ev}
  let j=c.i,S=c.debut;const lim=now+horizon;
  while(j<c.steps.length&&S<=lim){
    const st=c.steps[j],D=st.d;
    if(j>c.i||S>=now-1)ev.push({at:S,cle:'t:'+j,type:st.k==='act'?'activite':st.k==='prep'?'prep':'repos',etape:j});
    if(!D)break; // passage manuel : la suite dépend de l'utilisateur
    if(st.k!=='prep')for(let s=30;s<D;s+=30)if(s>10){const at=S+(D-s)*1000;if(at>=now-1&&at<=lim)ev.push({at,cle:'p:'+j+':'+s,type:'palier',s,etape:j})}
    for(let s=Math.min(10,D-1);s>=1;s--){const at=S+(D-s)*1000;if(at>=now-1&&at<=lim)ev.push({at,cle:'c:'+j+':'+s,type:'decompte',s,etape:j})}
    S+=D*1000;j++;
    if(j>=c.steps.length&&S<=lim)ev.push({at:S,cle:'fin',type:'fin'});
  }
  return ev.filter(e=>!c.tires.has(e.cle)).sort((a,b)=>a.at-b.at);
}
/* instantané pour reprendre après fermeture de l'appli (toujours restauré en pause) */
function exporter(c,now){return {i:c.i,ecoule:ecoule(c,now),stats:c.stats,fini:c.fini}}
function restaurer(steps,snap,now){
  const c=chrono(steps,now);if(!snap)return c;
  c.i=Math.min(Math.max(0,snap.i|0),Math.max(0,steps.length-1));
  const st=steps[c.i];const e=Math.max(0,Math.min(Number(snap.ecoule)||0,st&&st.d?st.d*1000-1:1e9));
  c.debut=now-e;c.pause=now;c.stats=Object.assign({actif:0,repos:0,cats:{},etapes:0},snap.stats||{});
  for(let j=0;j<=c.i;j++)c.tires.add('t:'+j);
  return c;
}

const API={definirCotes,cotesDe,libelleCote,normaliser,normBloc,normListe,clone,nid,compiler,dureeTotale,prochaineActivite,annonce,valider,fmtCourt,
  chrono,avancer,pauser,reprendre,suivant,precedent,aller,ecoule,restant,progression,evenements,exporter,restaurer,MAX_D,MAX_N};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.ADB_MOTEUR=API;
})(typeof window!=='undefined'?window:this);
