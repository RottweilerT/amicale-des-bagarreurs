/* Fiches illustrées — cardio, conditionnement traditionnel, explosivité, mobilité, coordination. Même format que fiches-1.js. */
'use strict';
const B=require('./familles.js');
const {P,F,H,DEBOUT,MAINS_HANCHES,MAINS_TETE,SQUAT,FENTE,GARDE,JAB,CROSS,CROCHET,ESQUIVE,PLANCHE,PLANCHE_AB,QUATRE,VENTRE,ACCROUPI,GENOUX,FACE,FACE_GARDE,FACE_SQUAT,UNI,TABLE,OURS,PENCHE}=B;
const fs={};
/* ----- vue de face, sauts ----- */
const JF=(o_,jambes,o)=>P({vue:'face',hanche:[0,H],torse:90,tete:90,bd:{a:[-90-o_,-90-o_*.95],m:-90-o_},bg:{a:[-90+o_,-90+o_*.95],m:-90+o_},jd:{t:[-jambes,3],plie:-1},jg:{t:[jambes,3],plie:1}},o);
const BAS=JF(8,4),OUV=JF(150,16,{air:3});
fs['jumping-jacks']={e:[[BAS,'Vue de face : pieds serrés, bras le long du corps.'],[P(OUV,{fleches:[F('bd.b',[6,-26],[-4,22],-.3),F('bg.b',[-6,-26],[4,22],.3)]}),'Saute en écartant bras et jambes.'],[BAS,'Saute pour refermer.']],err:'Atterrir sur les talons.',vf:'half-jacks'};
fs['half-jacks']={e:[[BAS,'Vue de face : pieds serrés.'],[P(JF(90,16,{air:3}),{fleches:[F('bd.b',[4,-16],[-2,14],-.3),F('bg.b',[-4,-16],[2,14],.3)]}),'Saute en écartant les jambes, bras à l’horizontale seulement.'],[BAS,'Referme.']],err:'Monter les bras trop haut.',vd:'jumping-jacks'};
fs['seal-jacks']={e:[[P(JF(8,4),{bd:{t:[7,-4],rel:true,plie:-1,m:90},bg:{t:[-7,-4],rel:true,plie:1,m:90}}),'Vue de face : bras devant, mains jointes.'],[P(JF(90,16,{air:3}),{fleches:[F('bd.b',[10,0],[-12,0]),F('bg.b',[-10,0],[12,0])]}),'Saute : ouvre les bras sur les côtés et écarte les jambes.']],err:'Bras qui tombent.'};
fs['cross-jacks']={e:[[JF(130,14,{air:3}),'Vue de face : bras et jambes écartés.'],[P(JF(20,1),{bd:{t:[14,-16],rel:true,plie:-1},bg:{t:[-14,-16],rel:true,plie:1},jd:{t:[5,3],plie:-1},jg:{t:[-5,3],plie:1},fleches:[F('jd.e',[-10,8],[10,0])]}),'Saute en croisant bras et jambes devant toi.']],err:'Croiser trop fort et perdre l’équilibre.'};
/* ----- course sur place, profil ----- */
const KNEE=(h,n,o)=>P(DEBOUT,Object.assign({hanche:[0,H+3],bd:{a:[n?-60:-120,n?30:-30]},bg:{a:[n?-120:-60,n?-30:30]}},n?{jd:{t:[2,6],p:-50},jg:{a:[h,h-90],p:h-60}}:{jg:{t:[-2,6],p:-50},jd:{a:[h,h-90],p:h-60}},o||{}));
fs['high-knees']={e:[[P(KNEE(5,0),{fleches:[F('jd.j',[0,-14],[0,12])]}),'Genou à hauteur de hanche, sur l’avant du pied.'],[KNEE(5,1),'Change de jambe très vite, bras actifs.']],err:'Se pencher en arrière.',vf:'genoux-moderes'};
fs['genoux-moderes']={e:[[KNEE(-35,0),'Genou à mi-hauteur.'],[KNEE(-35,1),'Alterne à rythme régulier.']],err:'Taper du pied.',vd:'high-knees'};
const TF=n=>P(DEBOUT,Object.assign({hanche:[0,H+3],bd:{a:[n?-60:-120,n?30:-30]},bg:{a:[n?-120:-60,n?-30:30]}},n?{jd:{t:[2,6],p:-50},jg:{a:[-100,100],p:150}}:{jg:{t:[-2,6],p:-50},jd:{a:[-100,100],p:150}}));
fs['talons-fesses']={e:[[P(TF(0),{fleches:[F('jd.e',[-6,-10],[-2,12],-.3)]}),'Le talon monte vers la fesse.'],[TF(1),'Change de jambe, rythme rapide.']],err:'Lever les genoux vers l’avant.'};
/* ----- burpees ----- */
const SAUT=P(DEBOUT,{air:12,bd:{a:[88,90],m:90},bg:{a:[86,88],m:88},jd:{a:[-90,-92],p:-60},jg:{a:[-92,-94],p:-62}});
const BRP=[[DEBOUT,'Debout.'],[ACCROUPI,'Accroupis-toi, mains au sol.'],[P(PLANCHE(0),{fleches:[F('jd.e',[16,8],[-14,0])]}),'Jette les pieds en arrière : planche.'],[PLANCHE(1),'Une pompe, poitrine près du sol.'],[P(ACCROUPI,{fleches:[F('jd.e',[-18,8],[14,0])]}),'Ramène les pieds sous toi.'],[P(SAUT,{fleches:[F('hanche',[-14,-10],[0,14])]}),'Saute bras en l’air.']];
fs['burpees']={e:BRP,err:'Laisser le bassin s’affaisser en planche.',vf:'burpees-sans-saut',vd:'burpees-explo'};
fs['burpees-sans-pompe']={e:[BRP[0],BRP[1],BRP[2],BRP[4],BRP[5]],err:'Arrondir le dos en se relevant.',vf:'burpees-sans-saut',vd:'burpees'};
fs['burpees-sans-saut']={e:[BRP[0],BRP[1],BRP[2],BRP[4],[DEBOUT,'Relève-toi sans sauter.']],err:'Poser les genoux au sol.',vd:'burpees'};
fs['squat-thrusts']={e:[[ACCROUPI,'Accroupi, mains au sol.'],[P(PLANCHE(0),{fleches:[F('jd.e',[16,8],[-14,0])]}),'Pieds en arrière : planche.'],[P(ACCROUPI,{fleches:[F('jd.e',[-18,8],[14,0])]}),'Ramène les pieds, recommence.']],err:'Fesses trop hautes en planche.',vd:'burpees'};
const SK=d=>({vue:'face',hanche:[d*10,40],torse:90+d*-12,tete:90,bd:{a:[d>0?-150:-60,d>0?-150:-50]},bg:{a:[d>0?-120:-30,d>0?-130:-30]},
  jd:d>0?{t:[14,3],plie:1}:{t:[-14,3],plie:-1},jg:d>0?{t:[-2,10],plie:-1,p:-150}:{t:[2,10],plie:1,p:-30}});
fs['skaters']={e:[[SK(1),'Vue de face : en appui sur une jambe, l’autre croisée derrière.'],[P(SK(-1),{fleches:[F('hanche',[18,-6],[-28,0],.3)]}),'Petit bond latéral sur l’autre jambe.']],err:'Atterrir jambe tendue.',revoir:'Jambe croisée derrière approximative en vue de face.'};
const FF=n=>P(SQUAT(.35),{bd:{a:[-60,10]},bg:{a:[-70,0]},jd:{t:[4,n?8:3],p:-45},jg:{t:[-2,n?3:8],p:-45}});
fs['fast-feet']={e:[[FF(0),'Légèrement accroupi, sur l’avant des pieds.'],[FF(1),'Petits pas ultra-rapides sur place.']],err:'Se redresser.'};
const TUCK=P(DEBOUT,{air:18,hanche:[0,40],torse:85,bd:{a:[-20,20],m:20},bg:{a:[-22,18],m:18},jd:{a:[20,-110],p:-30},jg:{a:[18,-112],p:-32}});
fs['sauts-groupes']={e:[[SQUAT(.5),'Demi-squat.'],[P(TUCK,{fleches:[F('hanche',[-14,-6],[0,12])]}),'Saute en ramenant les genoux à la poitrine.'],[SQUAT(.5),'Réception souple.']],err:'Atterrir jambes tendues.',vf:'sauts-verticaux'};
fs['sauts-verticaux']={e:[[P(SQUAT(.6),{bd:{a:[-120,-120]},bg:{a:[-122,-122]}}),'Demi-squat, bras en arrière.'],[P(SAUT,{fleches:[F('hanche',[-14,-10],[0,14])]}),'Saute le plus haut possible, bras vers le ciel.'],[SQUAT(.5),'Réception souple.']],err:'Atterrir genoux rentrés.',vd:'sauts-groupes'};
fs['shadow-cardio']={e:[[P(GARDE,{air:3}),'En garde en sautillant.'],[P(JAB,{fleches:[F('bd.b',[-18,6],[16,0])]}),'Boxe sans t’arrêter, rythme élevé.']],err:'Lâcher la garde.'};
const CORDE=(air,h)=>({vue:'face',hanche:[0,H],torse:90,tete:90,air,bd:{a:[-112,-70],m:-60},bg:{a:[-68,-110],m:-120},jd:{t:[-3,3],plie:-1},jg:{t:[3,3],plie:1},acc:h?{corde:h}:undefined});
fs['corde']={e:[[CORDE(0,'haut'),'Vue de face : corde au-dessus de la tête, poignets actifs.'],[CORDE(5,'bas'),'Petits sauts sur les pointes, la corde passe sous les pieds.']],err:'Sauter trop haut ou tourner avec les bras.'};
fs['corde-imaginaire']={e:[[P(CORDE(0),{fleches:[F('bd.b',[0,-6],[0,8],1.2),F('bg.b',[0,-6],[0,8],-1.2)]}),'Vue de face : fais tourner les poignets comme avec une corde.'],[CORDE(5),'Petits sauts réguliers sur les pointes.']],err:'Atterrir à plat.',vd:'corde'};
fs['pas-boxeur']={e:[[P(DEBOUT,{hanche:[0,H+5],bd:{a:[-80,-10]},bg:{a:[-85,-15]},jd:{t:[2,8],p:-55},jg:{t:[-2,13],p:-60}}),'Sur un pied…'],[P(DEBOUT,{hanche:[0,H+5],bd:{a:[-80,-10]},bg:{a:[-85,-15]},jd:{t:[2,13],p:-60},jg:{t:[-2,8],p:-55}}),'… puis l’autre, en petits rebonds.']],err:'Rester sur les talons.'};
fs['squat-extension']={e:[[SQUAT(1),'Squat.'],[P(DEBOUT,{hanche:[0,H+6],bd:{a:[88,90],m:90},bg:{a:[86,88],m:88},jd:{t:[2.5,8],p:-58},jg:{t:[-2.5,8],p:-60},fleches:[F('hanche',[-14,-10],[0,14])]}),'Extension complète sur les pointes, bras en l’air.']],err:'Arrondir le dos en bas.'};
const DS={vue:'face',fixe:true,sol:false,hanche:[0,40],torse:0,tete:0,bd:{t:[26,47],ech:.42,plie:1,m:0},bg:{t:[26,33],ech:.42,plie:-1,m:0}};
fs['plank-jacks']={e:[[P(DS,{jd:{a:[182,180],p:180},jg:{a:[178,180],p:180}}),'Vue de dessus : planche haute, pieds joints.'],[P(DS,{jd:{a:[192,190],p:180},jg:{a:[168,170],p:180},fleches:[F('jd.e',[4,-4],[0,8])]}),'Écarte et rapproche les pieds en sautant.']],err:'Lever les fesses.'};
/* ----- CONDITIONNEMENT TRADITIONNEL ----- */
fs['hindu-squats']={e:[[P(DEBOUT,{bd:{a:[0,0],m:0},bg:{a:[-2,-2],m:-2}}),'Debout, bras devant.'],[P(SQUAT(1),{hanche:[-6,32],torse:75,jd:{t:[3,8],p:-50},jg:{t:[-1,8],p:-52},bd:{a:[-120,-115]},bg:{a:[-122,-117]},fleches:[F('bd.b',[6,10],[-4,-14],.3)]}),'Descends sur les pointes, bras qui balancent en arrière.'],[P(DEBOUT,{bd:{a:[0,0],m:0},bg:{a:[-2,-2],m:-2}}),'Remonte en ramenant les bras, rythme continu.']],err:'Bloquer la respiration.'};
fs['squats-continus']={e:[[SQUAT(0),'Debout.'],[SQUAT(1),'Squat.'],[SQUAT(0),'Enchaîne sans pause, rythme régulier.']],err:'Raccourcir l’amplitude avec la fatigue.'};
fs['bear-crawl']={e:[[OURS,'Position de l’ours, genoux décollés.'],[P(OURS,{bd:{a:[-70,-80],m:0},jg:{t:[-14,4],p:-120},fleches:[F('bd.b',[-6,6],[10,0])]}),'Petits pas des mains et des pieds sur place.']],err:'Remonter les fesses.'};
const CRAB={hanche:[0,18],torse:160,tete:150,bd:{a:[-95,-92],m:180},bg:{a:[-97,-94],m:180},jd:{t:[20,3.5]},jg:{t:[19,3.5]}};
fs['crab-hold']={e:[[CRAB,'Mains et pieds au sol, bassin décollé, immobile.']],err:'Laisser le bassin toucher le sol.',vd:'crab-reach'};
fs['crab-reach']={e:[[CRAB,'En position du crabe.'],[P(TABLE,{bg:{a:[-97,-94],m:180},bd:{a:[120,140],m:150},fleches:[F('bd.b',[10,-10],[-12,6],-.3)]}),'Monte le bassin et tends un bras par-dessus.']],err:'Forcer sur l’épaule d’appui.',vf:'crab-hold'};
fs['frog-jumps']={e:[[ACCROUPI,'Accroupi, mains au sol.'],[P(SAUT,{fleches:[F('hanche',[-14,-10],[0,14])]}),'Saute en ouvrant le corps.'],[ACCROUPI,'Reviens accroupi, mains au sol.']],err:'Atterrir jambes tendues.'};
const DUCK=n=>P(SQUAT(1.25),{jd:{t:[n?6:2,n?6:3],p:0},jg:{t:[n?-2:2,n?3:6],p:0}});
fs['duck-walk']={e:[[DUCK(0),'En squat bas, buste droit.'],[DUCK(1),'Petits pas sur place sans te relever.']],err:'Se redresser entre les pas.'};
fs['burpees-stricts']={e:[BRP[0],BRP[1],BRP[2],[P(VENTRE,{bd:{t:[-6,-10],rel:true,plie:1,m:0},bg:{t:[-8,-10],rel:true,plie:1,m:0}}),'Poitrine au sol, puis pousse pour revenir en planche.'],BRP[4],BRP[5]],err:'Tricher sur l’amplitude.',vf:'burpees'};
fs['squat-thrusts-rapides']={e:fs['squat-thrusts'].e,err:'Perdre l’alignement en accélérant.',vf:'squat-thrusts'};
fs['squat-profond-hold']={e:[[P(SQUAT(1.3),{bd:{t:[10,-14],rel:true,m:90},bg:{t:[8,-14],rel:true,m:90}}),'Accroupi au plus bas, talons au sol, coudes contre les genoux.']],err:'Décoller les talons.'};
fs['pompes-cadence']={e:[[PLANCHE(0),'Planche haute.'],[PLANCHE(1),'Une pompe toutes les 2 secondes, sans t’arrêter.']],err:'Casser le rythme.',vf:'pompes-genoux'};
fs['gainage-prolonge']={e:[[PLANCHE_AB(),'Planche tenue toute la durée, respiration calme.']],err:'Bloquer la respiration.'};
fs['pompe-squat']={e:[[PLANCHE(0),'Planche haute.'],[PLANCHE(1),'Une pompe.'],[DEBOUT,'Relève-toi.'],[SQUAT(1),'Un squat, puis recommence.']],err:'Bâcler la pompe ou le squat.'};
fs['debout-sol']={e:[[DEBOUT,'Debout.'],[GENOUX,'Pose un genou, puis l’autre.'],[VENTRE,'Allonge-toi sur le ventre.'],[GENOUX,'Reviens à genoux.'],[DEBOUT,'Relève-toi, sans les mains si possible.']],err:'Se laisser tomber.'};
const SPRAWL=P(VENTRE,{hanche:[0,7],torse:24,tete:34,bd:{t:[25,2.6],m:0},bg:{t:[23,2.6],m:0}});
fs['sprawls']={e:[[GARDE,'En garde.'],[P(SPRAWL,{fleches:[F('jd.e',[16,8],[-14,0])]}),'Jette les jambes en arrière, hanches au sol.'],[GARDE,'Reviens en garde aussitôt.']],err:'Garder les hanches hautes.',vd:'sprawls-rapides'};
fs['extensions-corps']={e:[[ACCROUPI,'Accroupi, mains au sol.'],[P(DEBOUT,{hanche:[0,H+6],bd:{a:[88,90],m:90},bg:{a:[86,88],m:88},jd:{t:[2.5,8],p:-58},jg:{t:[-2.5,8],p:-60},fleches:[F('hanche',[-14,-10],[0,14])]}),'Grand étirement debout, bras au ciel, sur les pointes.']],err:'Se relever le dos rond.'};
fs['isometrie-variee']={e:[[SQUAT(1),'10 s en squat.'],[FENTE(1),'10 s en fente.'],[PLANCHE_AB(),'10 s en planche.'],[PLANCHE(.85),'10 s en bas de pompe.']],err:'Se relâcher entre deux positions.',anim:false};
/* ----- EXPLOSIVITÉ ----- */
fs['tuck-jumps']={e:[[SQUAT(.5),'Demi-squat.'],[P(TUCK,{air:24,fleches:[F('hanche',[-14,-6],[0,14])]}),'Saute en ramenant les genoux le plus haut possible.'],[SQUAT(.5),'Réception souple, enchaîne.']],err:'Atterrir sur les talons.',vf:'sauts-groupes'};
fs['burpees-explo']={e:[BRP[0],BRP[1],BRP[2],BRP[4],[P(SAUT,{air:20,fleches:[F('hanche',[-14,-10],[0,16])]}),'Saut maximal.']],err:'Atterrir lourdement.',vf:'burpees'};
const ROT=a=>P(FACE,{air:a?10:0,bd:{a:[-120,-120]},bg:{a:[-60,-60]}});
fs['sauts-rotation']={e:[[FACE_SQUAT(.4,8),'Vue de face : demi-squat.'],[P(DEBOUT,{air:12,bd:{a:[80,80]},bg:{a:[100,100]},fleches:[F('tete',[-12,10],[24,0],-.5)]}),'Saute en faisant un demi-tour.'],[FACE_SQUAT(.4,8),'Réception stable, genoux souples.']],err:'Atterrir genoux rentrés.',revoir:'La rotation est suggérée par la flèche.'};
fs['sprawls-rapides']={e:fs['sprawls'].e,err:'Hanches hautes en arrivant au sol.',vf:'sprawls'};
fs['shadow-explo']={e:[[GARDE,'En garde.'],[P(CROSS,{fleches:[F('bg.b',[-18,6],[16,0])]}),'Coups au maximum de vitesse et de puissance.']],err:'Rester bras tendu après le coup.'};
fs['frappes-max']={e:[[GARDE,'En garde.'],[JAB,'Jab.'],[CROSS,'Direct.'],[P(CROCHET,{fleches:[F('bd.b',[-14,-9],[16,0],.45)]}),'Crochet, à pleine puissance, puis 2 s de pause.']],err:'Perdre l’équilibre en frappant.'};
fs['contraction-relache']={e:[[P(DEBOUT,{bd:{a:[-60,60],m:60},bg:{a:[-62,58],m:58},jd:{t:[4,3]},jg:{t:[-4,3]}}),'Contracte tout le corps 3 s, poings serrés.'],[DEBOUT,'Relâche complètement.']],err:'Bloquer la respiration en contractant.'};
/* ----- MOBILITÉ ----- */
fs['rotations-cervicales']={e:[[P(FACE,{tete:75,fleches:[F('tete',[-10,10],[20,0],-.4)]}),'Vue de face : penche lentement la tête d’un côté…'],[P(FACE,{tete:105}),'… puis de l’autre, sans forcer.']],err:'Faire de grands cercles rapides avec la tête.'};
fs['mobilite-epaules']={e:[[P(DEBOUT,{bd:{a:[0,0],m:0}}),'Bras tendu devant.'],[P(DEBOUT,{bd:{a:[90,90],m:90},fleches:[F('bd.b',[10,-14],[-8,12],.4)]}),'Monte-le au-dessus de la tête…'],[P(DEBOUT,{bd:{a:[200,200],m:200}}),'… puis vers l’arrière : grands cercles lents.']],err:'Cambrer le dos.'};
fs['rotations-thoraciques']={e:[[P(QUATRE,{bd:{t:[-4,8],rel:true,plie:-1}}),'À quatre pattes, une main derrière la tête, coude vers le sol.'],[P(QUATRE,{bd:{a:[60,-120],m:-120},fleches:[F('bd.j',[0,-12],[0,12],.3)]}),'Ouvre le coude vers le ciel en tournant le buste.']],err:'Tourner le bassin.',revoir:'La rotation du buste se lit mal de profil.'};
fs['cat-cow']={e:[[P(QUATRE,{torse:20,tete:-30,fleches:[F('epaule',[-10,10],[0,8])]}),'Dos rond, menton vers la poitrine.'],[P(QUATRE,{torse:10,tete:45}),'Dos creux, regard vers l’avant.']],err:'Aller trop vite.',revoir:'La courbure du dos ne peut pas être dessinée : seule la tête et le buste bougent.'};
fs['rotations-hanches']={e:[[P(UNI,{jg:{a:[0,-90],p:0},fleches:[F('jg.j',[-2,4],[10,0],1.2)]}),'Sur une jambe, grands cercles avec le genou, puis change.']],err:'Se pencher sur le côté.'};
fs['ouvertures-hanches']={e:[[P(FACE,{...{bd:{t:[-2,-22],rel:true,plie:-1}},jg:{a:[0,-90],p:-90},fleches:[F('jg.j',[-12,6],[12,0],-.4)]}),'Vue de face : lève le genou et ouvre-le vers l’extérieur.']],err:'Basculer le bassin.'};
const DEMI_GENOU={hanche:[-4,30],torse:90,tete:90,jd:{t:[18,3]},jg:{a:[-90,180],p:180},...MAINS_HANCHES};
fs['mobilite-chevilles']={e:[[DEMI_GENOU,'Un genou au sol, pied avant à plat.'],[P(DEMI_GENOU,{hanche:[2,30],jd:{t:[18,3]},fleches:[F('jd.j',[-2,6],[10,0])]}),'Avance le genou au-dessus des orteils, talon au sol.']],err:'Décoller le talon.'};
fs['etir-flechisseurs']={e:[[P(DEMI_GENOU,{hanche:[0,26],jd:{t:[22,3]},jg:{a:[-120,180],p:180}}),'Fente basse, genou arrière au sol.'],[P(DEMI_GENOU,{hanche:[6,24],jd:{t:[22,3]},jg:{a:[-130,180],p:180},fleches:[F('hanche',[-10,0],[10,0])]}),'Pousse le bassin vers l’avant.']],err:'Cambrer le bas du dos.'};
fs['etir-quadri']={e:[[P(DEBOUT,{jg:{a:[-92,93],p:150},bg:{t:[-4,50],plie:1,m:-90},bd:{a:[0,0],m:0}}),'Sur une jambe, talon tenu vers la fesse, genoux serrés.']],err:'Cambrer le dos.'};
fs['etir-ischios']={e:[[P(DEBOUT,{hanche:[-4,45],torse:40,tete:45,jd:{t:[40,3],p:70},jg:{t:[-6,3],plie:1},bd:{t:[-6,-30],rel:true},bg:{t:[-8,-30],rel:true}}),'Jambe tendue devant, talon au sol : penche le buste dos droit.']],err:'Arrondir le dos pour aller plus bas.'};
fs['etir-mollets']={e:[[P(FENTE(.2),{torse:80,jd:{t:[19,3]},jg:{t:[-26,3],p:0},bd:{t:[20,-10],rel:true},bg:{t:[18,-10],rel:true}}),'Grand pas en avant, talon arrière au sol, jambe arrière tendue.']],err:'Décoller le talon arrière.'};
fs['mobilite-poignets']={e:[[P(QUATRE,{bd:{a:[-90,-90],m:180},bg:{a:[-92,-92],m:180}}),'À quatre pattes, doigts tournés vers les genoux.'],[P(QUATRE,{hanche:[-4,27],fleches:[F('hanche',[4,8],[-10,0])]}),'Recule doucement le bassin pour étirer les poignets.']],err:'Forcer sur la douleur.',revoir:'Les poignets sont trop petits pour montrer le détail.'};
const FB={hanche:[-4,26],torse:30,tete:35,jd:{t:[20,3]},jg:{t:[-24,3],p:-150,plie:1}};
fs['greatest-stretch']={e:[[P(FB,{bd:{t:[20,2.6],m:0},bg:{t:[18,2.6],m:0}}),'Fente, mains au sol à l’intérieur du pied avant.'],[P(FB,{bd:{t:[17,8],plie:-1},bg:{t:[18,2.6],m:0}}),'Coude vers le pied avant.'],[P(FB,{bd:{a:[90,90],m:90},bg:{t:[18,2.6],m:0},fleches:[F('bd.b',[-6,-14],[0,12])]}),'Ouvre le bras vers le ciel.'],[P(FB,{hanche:[-14,36],torse:0,tete:5,jd:{t:[14,3],p:70},bd:{t:[18,2.6],m:0},bg:{t:[16,2.6],m:0}}),'Recule les hanches, jambe avant tendue.']],err:'Aller trop vite d’une position à l’autre.',revoir:'L’ouverture du bras est vue de profil.'};
fs['squat-hold']={e:[[P(SQUAT(1.3),{bd:{t:[12,-14],rel:true,m:90},bg:{t:[10,-14],rel:true,m:90}}),'Accroupi, coudes qui poussent les genoux vers l’extérieur.']],err:'Laisser le dos s’arrondir.'};
const DOS_GENOUX={hanche:[0,7],torse:180,tete:180,bd:{t:[8,3],rel:false,plie:1,m:0},bg:{a:[-8,0],m:0},jd:{t:[22,3.5]},jg:{t:[21,3.5]}};
fs['respiration-diaph']={e:[[P(DOS_GENOUX,{bd:{t:[-10,10],plie:1,m:0},fleches:[F('hanche',[-8,10],[0,8])]}),'Main sur le ventre : inspire 4 s par le nez, le ventre se soulève.'],[P(DOS_GENOUX,{bd:{t:[-10,9],plie:1,m:0},fleches:[F('hanche',[-8,18],[0,-8])]}),'Expire 6 s, le ventre redescend.']],err:'Gonfler la poitrine au lieu du ventre.'};
fs['respiration-recup']={e:[[P(DEBOUT,{hanche:[-4,50],torse:75,tete:80,bd:{t:[10,-26],rel:true},bg:{t:[8,-26],rel:true},jd:{t:[3,3]},jg:{t:[-3,3]}}),'Mains sur les cuisses : inspire 4 s, bloque 4 s, expire 4 s, bloque 4 s.']],err:'Respirer trop vite.'};
/* ----- COORDINATION ----- */
fs['equilibre-uni']={e:[[UNI,'Sur un pied, genou levé ; change à mi-temps.']],err:'Regarder ses pieds.'};
fs['equilibre-bras']={e:[[P(UNI,{bd:{a:[0,0],m:0},bg:{t:[6,10],rel:true}}),'Sur un pied, enchaîne des coups ou des cercles avec les bras.']],err:'Se pencher pour compenser.'};
fs['touches-croisees']={e:[[P(FACE,{jg:{a:[-70,-95],ech:.55,p:-90},bd:{t:[16,-24],rel:true,plie:-1},fleches:[F('bd.b',[-8,8],[6,-6])]}),'Vue de face : main droite sur le genou gauche…'],[P(FACE,{jd:{a:[-110,-85],ech:.55,p:-90},bg:{t:[-16,-24],rel:true,plie:1}}),'… puis l’inverse, en rythme.']],err:'Pencher le dos pour aller chercher le genou.'};
fs['genoux-croises']={e:[[P(FACE,{torse:82,jg:{a:[-40,-100],ech:.6,p:-90},bd:{t:[16,-16],rel:true,plie:-1}}),'Vue de face : genou vers le coude opposé.'],[P(FACE,{torse:98,jd:{a:[-140,-80],ech:.6,p:-90},bg:{t:[-16,-16],rel:true,plie:1}}),'Puis l’autre côté.']],err:'Arrondir le dos.'};
fs['pas-rythme']={e:[[GARDE,'En garde.'],[P(GARDE,{hanche:[8,48],jd:{t:[21,3]},jg:{t:[-5,3],p:-8},fleches:[F('hanche',[-6,-28],[14,0])]}),'Un pas avant…'],[P(GARDE,{fleches:[F('hanche',[8,-28],[-14,0])]}),'… un pas arrière, toujours au même rythme.']],err:'Accélérer sans le vouloir.'};
const GARDE_INV=P(GARDE,{jd:{t:[-13,3],p:-8},jg:{t:[13,3],p:0}});
fs['changements-garde']={e:[[GARDE,'En garde.'],[P(GARDE,{air:4,jd:{t:[0,3]},jg:{t:[0,3]},fleches:[F('jd.e',[10,8],[-14,0]),F('jg.e',[-10,4],[14,0])]}),'Petit saut : les pieds changent de place.'],[GARDE_INV,'Te voilà en garde inversée.']],err:'Baisser la garde pendant le changement.'};
fs['dissociation']={e:[[JF(150,4),'Vue de face : bras en l’air, pieds serrés.'],[JF(10,16,{air:3}),'Bras en bas quand les jambes s’écartent : deux rythmes différents.']],err:'Synchroniser bras et jambes par habitude.'};
fs['shadow-contraintes']={e:[[GARDE,'En garde.'],[P(JAB,{fleches:[F('bd.b',[-18,6],[16,0])]}),'Combinaison…'],[P(ESQUIVE,{fleches:[F('tete',[8,8],[-6,-10],.3)]}),'… qui finit toujours par une esquive (ou ta contrainte).']],err:'Oublier la contrainte quand la fatigue arrive.'};
fs['coord-alternee']={e:[[P(DEBOUT,{jg:{a:[-100,100],p:150},bd:{t:[-12,-36],rel:true,plie:-1}}),'Main touche le pied opposé derrière toi.'],[P(DEBOUT,{jd:{a:[-100,100],p:150},bg:{t:[-12,-36],rel:true,plie:-1}}),'Puis l’inverse, en rythme.']],err:'Se pencher en avant.',revoir:'Croisement main-pied peu visible de profil.'};
fs['cadence']={e:[[GARDE,'En garde.'],[P(av(JAB,6),{fleches:[F('bd.b',[-18,6],[16,0])]}),'Un pas, un coup : même rythme tout le temps.']],err:'Accélérer en fin de round.'};
function av(p,dx){return P(p,{hanche:[p.hanche[0]+dx,p.hanche[1]],jd:{t:[p.jd.t[0]+dx,3]},jg:{t:[p.jg.t[0]+dx,3],p:p.jg.p}})}
fs['asymetriques']={e:[[P(FACE,{bd:{a:[180,180],m:180},bg:{a:[90,90],m:90},fleches:[F('bd.b',[0,-6],[0,12],1.2)]}),'Vue de face : un bras fait des cercles, l’autre monte et descend.']],err:'Aller trop vite.'};
fs['marche-sur-place']={e:[[KNEE(-50,0),'Marche calmement sur place.'],[KNEE(-50,1),'Respire profondément.']],err:'Se voûter.'};
module.exports=fs;
