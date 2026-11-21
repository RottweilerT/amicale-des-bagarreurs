/* Tests du moteur du minuteur (scénarios A à H du cahier des charges) : node tests/test_moteur.js */
const M=require('../minuteur/moteur.js');
let ko=0;const ok=(c,q)=>{console.log((c?'OK   ':'ÉCHEC')+' '+q);if(!c)ko++};
const act=(nom,d,o)=>Object.assign({t:'act',exo:{id:'',nom,cat:'boxe'},d},o||{});
const repos=d=>({t:'repos',d});
/* simule le déroulé complet en avançant par pas de 50 ms et en « jouant » chaque événement une seule fois */
function derouler(s,opts){
  opts=opts||{};const steps=M.compiler(s);let now=1000;const c=M.chrono(steps,now);c.tires.add('t:0');
  const joues=[];const fin=now+(M.dureeTotale(steps)+5)*1000;
  while(now<=fin){
    if(opts.agir)opts.agir(c,now);
    for(const e of M.evenements(c,now,0))if(e.at<=now){c.tires.add(e.cle);joues.push(Object.assign({rel:e.at},e))}
    M.avancer(c,now);
    if(c.fini&&c.tires.has('fin'))break;
    now+=50;
  }
  return {c,steps,joues};
}
/* A : 3 min de boxe, 1 min de repos, 5 rounds */
{
  const s={prep:10,blocs:[{t:'rep',n:5,blocs:[act('Boxe',180),repos(60)]}]};
  const {steps,joues,c}=derouler(s);
  ok(steps.length===1+5+4,'A : préparation + 5 rounds + 4 repos (pas de repos après le dernier round)');
  ok(M.dureeTotale(steps)===10+5*180+4*60,'A : durée totale exacte');
  ok(joues.filter(e=>e.type==='activite').length===5&&joues.filter(e=>e.type==='repos').length===4,'A : 5 débuts d’activité, 4 débuts de repos');
  ok(joues.filter(e=>e.type==='fin').length===1&&c.fini,'A : un seul son de fin');
  ok(steps[1].rounds[0].i===1&&steps[9].rounds[0].i===5&&steps[9].rounds[0].n===5,'A : numéros de round 1/5 … 5/5');
  const p=joues.filter(e=>e.type==='palier'&&e.etape===1).map(e=>e.s);
  ok(JSON.stringify(p)==='[150,120,90,60,30]','A : paliers de 30 s d’un round de 3 min : '+p);
}
/* B : durées variables */
{
  const s={prep:0,blocs:[act('A',120),repos(60),act('B',120),repos(40),act('C',60)]};
  const steps=M.compiler(s);
  ok(JSON.stringify(steps.map(x=>x.d))==='[120,60,120,40,60]','B : chaque durée est indépendante');
}
/* C : séquence de 4 blocs répétée 5 fois, 3e répétition modifiée seule */
{
  const rep={t:'rep',n:5,lie:true,finSansRepos:false,blocs:[act('Shadow',120),repos(60),act('Pompes',120),repos(40)]};
  const lie=M.normaliser({blocs:[rep]});
  const r=lie.blocs[0];r.lie=false;r.occ=Array.from({length:5},()=>({blocs:M.clone(r.blocs,true)}));
  r.occ[2].blocs[2].exo.nom='Squats';r.occ[2].blocs[2].d=90;
  const steps=M.compiler(lie);
  const pompes=steps.filter(x=>x.k==='act'&&x.rounds[0].i!==3&&x.nom==='Pompes').length;
  ok(steps.filter(x=>x.k!=='prep').length===19,'C : 4 blocs × 5 répétitions (le repos final de la séance est retiré)');
  const r3=steps.find(x=>x.k==='act'&&x.rounds[0].i===3&&x.nom!=='Shadow');
  ok(r3.nom==='Squats'&&r3.d===90&&pompes===4,'C : seule la 3e répétition est modifiée');
  const l2=M.normaliser({blocs:[rep]});l2.blocs[0].blocs[2].d=100;
  ok(M.compiler(l2).filter(x=>x.nom==='Pompes').every(x=>x.d===100),'C : en mode lié, modifier le modèle modifie toutes les répétitions');
  const ids=new Set();let doublon=false;r.occ.forEach(o=>o.blocs.forEach(b=>{if(ids.has(b.id))doublon=true;ids.add(b.id)}));
  ok(!doublon,'C : chaque répétition indépendante a ses propres identifiants');
}
/* D : décompte sonore d'un exercice de 1 min 10 */
{
  const {joues}=derouler({prep:0,blocs:[act('X',70)]});
  const t0=1000,ev=joues.map(e=>({t:(e.rel-t0)/1000,type:e.type,s:e.s}));
  const pal=ev.filter(e=>e.type==='palier');
  ok(pal.length===2&&pal[0].t===10&&pal[1].t===40,'D : bips doux à 1:00 et 0:30 restantes (t=10 s et 40 s)');
  const dec=ev.filter(e=>e.type==='decompte');
  ok(dec.length===10&&dec.every((e,k)=>e.s===10-k&&e.t===60+k),'D : 10 bips de 0:10 à 0:01, un par seconde, pile');
  ok(ev.filter(e=>e.type==='fin').length===1&&ev.find(e=>e.type==='fin').t===70,'D : son de fin à 0:00');
  const cles=joues.map(e=>e.cle);ok(new Set(cles).size===cles.length,'D : aucun son joué deux fois');
  const {joues:j60}=derouler({prep:0,blocs:[act('Y',60)]});
  ok(j60.filter(e=>e.type==='palier').length===1,'D : pas de bip artificiel au début d’un intervalle de 60 s (seul 0:30 sonne)');
}
/* E : repos intelligent, y compris aux frontières des répétitions et avec un combo */
{
  const s={prep:15,blocs:[{t:'rep',n:3,blocs:[act('Shadow',60),repos(30),act('Pompes',60),repos(20)],finSansRepos:false},
    repos(10),{t:'combo',nom:'Combo cardio',mvts:[act('Jumping jacks',30),act('Squats',20),act('Pompes',10)]},
    {t:'rep',n:2,blocs:[{t:'rep',n:2,blocs:[act('Gainage',30),repos(15)]}]}]};
  const steps=M.compiler(s);let bon=true;
  steps.forEach((st,i)=>{if(st.k==='act')return;const a=M.annonce(steps,i);const vrai=steps.slice(i+1).find(x=>x.k==='act');if((a&&a.etape)!==vrai)bon=false});
  ok(bon,'E : chaque repos et la préparation annoncent la bonne activité suivante');
  const iRep=steps.findIndex((x,i)=>x.k==='repos'&&x.rounds.length&&x.rounds[0].i===1&&steps[i+1].nom==='Shadow');
  ok(iRep>0&&M.annonce(steps,iRep).nom==='Shadow','E : à la frontière entre deux répétitions, on annonce le 1er exercice de la suivante');
  const iAvantCombo=steps.findIndex(x=>x.k==='repos'&&!x.rounds.length&&!x.combo);
  const an=M.annonce(steps,iAvantCombo);
  ok(an&&an.nom==='Combo cardio'&&an.combo.length===3&&an.d===60,'E : avant un combo, on annonce ses mouvements : '+(an&&an.combo.join(' + ')));
  ok(steps.filter(x=>x.nom==='Gainage').length===4,'E : répétitions imbriquées 2 × 2');
}
/* F : sauvegarde — la séance survit à JSON (localStorage / Firestore) sans perte */
{
  const s=M.normaliser({nom:'Test',prep:15,blocs:[{t:'rep',n:4,lie:false,blocs:[act('Shadow',120,{variante:'garde haute',intensite:3}),repos(60)]},
    {t:'combo',nom:'C',tours:2,mvts:[act('Burpees',0,{reps:10}),repos(15)]},{t:'recup',d:120}]});
  const s2=M.normaliser(JSON.parse(JSON.stringify(s)));
  ok(JSON.stringify(s2)===JSON.stringify(s),'F : enregistrer puis relire conserve tout (durées, catégories, répétitions, exercices)');
  ok(M.compiler(s2).some(x=>x.reps===10&&x.d===0),'F : un exercice en répétitions devient une étape à passage manuel');
}
/* G : progression après pause et changement manuel d'étape */
{
  const steps=M.compiler({prep:0,blocs:[act('A',60),repos(30),act('B',60)]});let now=0;const c=M.chrono(steps,now);
  now=20000;M.avancer(c,now);let p=M.progression(c,now);ok(Math.abs(p.fait-20)<1e-6&&Math.abs(M.restant(c,now)-40000)<1e-6,'G : après 20 s, 20 s faites et 40 s restantes dans la phase');
  M.pauser(c,now);now=80000;M.avancer(c,now);p=M.progression(c,now);ok(Math.abs(p.fait-20)<1e-6&&c.i===0,'G : la pause gèle tout (aucune avance pendant 60 s de pause)');
  M.reprendre(c,now);now=85000;M.avancer(c,now);ok(Math.abs(M.restant(c,now)-35000)<1e-6,'G : la reprise repart exactement où elle s’était arrêtée');
  M.suivant(c,now);p=M.progression(c,now);ok(c.i===1&&p.fait===60&&M.restant(c,now)===30000,'G : « suivant » : barre de phase pleine, progression globale cohérente');
  now=86000;M.precedent(c,now);ok(c.i===0&&M.restant(c,now)===60000,'G : « précédent » dans les 3 premières secondes revient à l’étape d’avant');
  now=96000;M.precedent(c,now);ok(c.i===0&&M.restant(c,now)===60000,'G : « précédent » après 3 s recommence l’étape');
  /* pause pendant les 10 dernières secondes : aucun bip perdu ni doublé */
  const st2=M.compiler({prep:0,blocs:[act('Z',20)]});let t=0;const c2=M.chrono(st2,t);c2.tires.add('t:0');const vus=[];
  const pump=()=>{for(const e of M.evenements(c2,t,0))if(e.at<=t){c2.tires.add(e.cle);vus.push(e.cle)}M.avancer(c2,t)};
  for(;t<=14000;t+=50)pump();M.pauser(c2,t);for(let k=0;k<100;k++){t+=50;pump()}M.reprendre(c2,t);for(let k=0;k<200&&!c2.tires.has('fin');k++){t+=50;pump()}
  ok(vus.filter(k=>k.startsWith('c:')).length===10&&new Set(vus).size===vus.length,'G : pause pendant le décompte, puis reprise : 10 bips exactement');
  /* ralentissement de l'appli : 5 s sans calcul → pas d'accumulation de bips en retard */
  const st3=M.compiler({prep:0,blocs:[act('Z',20)]});const c3=M.chrono(st3,0);c3.tires.add('t:0');
  const ev=M.evenements(c3,15000,1000);ok(ev.every(e=>e.at>=14999),'G : après un gel de l’appli, les bips manqués ne sont pas rejoués');
  /* fermeture / réouverture */
  const steps4=M.compiler({prep:0,blocs:[act('A',60),act('B',60)]});const c4=M.chrono(steps4,0);M.avancer(c4,75000);
  const snap=JSON.parse(JSON.stringify(M.exporter(c4,75000)));const c5=M.restaurer(steps4,snap,5e6);
  ok(c5.i===1&&c5.pause!==null&&Math.abs(M.restant(c5,5e6+9e9)-45000)<1e-6,'G : après réouverture, la séance reprend à la même seconde, en pause');
}
/* H : fin de séance */
{
  const {c,joues}=derouler({prep:5,blocs:[act('A',15)]});
  ok(joues.filter(e=>e.type==='fin').length===1,'H : son de fin joué une seule fois');
  const now=1e7;M.avancer(c,now);ok(c.fini&&M.evenements(c,now,5000).length===0,'H : plus rien ne démarre après la fin');
  M.suivant(c,now);ok(c.fini,'H : « suivant » après la fin ne relance rien');
}
/* Cas particuliers */
{
  ok(!M.valider({blocs:[]}).ok,'Séance vide refusée');
  ok(!M.valider({blocs:[act('A',0)]}).ok,'Durée nulle refusée');
  ok(!M.valider({blocs:[{t:'rep',n:0,blocs:[act('A',10)]}]}).ok,'Répétitions invalides refusées');
  ok(M.valider({blocs:[act('Seul',30)]}).ok,'Séance d’un seul exercice acceptée');
  ok(M.compiler({prep:0,blocs:[act('A',30),repos(20),repos(10),act('B',30)]}).length===4,'Repos consécutifs conservés');
  ok(M.compiler({prep:0,blocs:[act('A',30),act('B',30)]}).every(x=>x.k==='act'),'Séance sans repos');
}
console.log(ko?`\n${ko} échec(s)`:'\nMoteur : tout est bon.');process.exit(ko?1:0);
