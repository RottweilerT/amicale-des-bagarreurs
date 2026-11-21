/* Poses de base réutilisées par les fiches (outil de génération). Toutes renvoient un objet pose neuf ;
   « P(base, {…}) » fusionne en profondeur (les membres non précisés gardent la base). */
'use strict';
const L=require('./personnage.js').L;
const R=Math.PI/180;
const P=(b,o)=>{const r=JSON.parse(JSON.stringify(b));for(const [k,v] of Object.entries(o||{})){
  if(v&&typeof v==='object'&&!Array.isArray(v)&&r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k])&&['bd','bg','jd','jg','acc'].includes(k)){
    const m=Object.assign({},r[k],JSON.parse(JSON.stringify(v)));if(v.a){delete m.t;delete m.rel;delete m.plie}if(v.t){delete m.a;if(!('rel' in v))delete m.rel}r[k]=m}
  else r[k]=JSON.parse(JSON.stringify(v))}return r};
const F=(sur,dx,d,k)=>({sur,dx,d,k:k||0}); // flèche depuis une articulation (+ décalage), vecteur d, courbure k

/* ----- debout ----- */
const H=52; // hauteur du bassin debout
const DEBOUT={hanche:[0,H],torse:90,tete:90,bd:{a:[-94,-88]},bg:{a:[-86,-92]},jd:{t:[2.5,3]},jg:{t:[-2.5,3]}};
const BRAS_AVANT={bd:{a:[0,0],m:0},bg:{a:[-2,-2],m:-2}};
const BRAS_HAUT={bd:{a:[92,90],m:90},bg:{a:[88,90],m:90}};
const MAINS_TETE={bd:{t:[-3,10],rel:true,plie:1},bg:{t:[-5,10],rel:true,plie:1}};
const MAINS_HANCHES={bd:{t:[-2,-22],rel:true,plie:-1},bg:{t:[-4,-22],rel:true,plie:-1}};
/* squat : profondeur 0 (debout) → 1 (cuisses parallèles) → 1.25 (profond) */
function SQUAT(q,o){
  const y=H-q*24,x=-q*15,tor=90-q*36;
  return P({hanche:[x,y],torse:tor,tete:90-q*20,jd:{t:[3,3]},jg:{t:[-1,3]},bd:{a:[q>.2?2:-94,q>.2?2:-88],m:q>.2?2:-88},bg:{a:[q>.2?-2:-86,q>.2?-2:-92],m:q>.2?-2:-92}},o);
}
/* fente : pied avant en x=+18, arrière en x=-22 ; q 0 → 1 (genou arrière près du sol) */
function FENTE(q,o){return P({hanche:[-2,H-2-q*18],torse:90,tete:90,jd:{t:[19,3]},jg:{t:[-23,3],p:-150,plie:1},...MAINS_HANCHES},o)}
/* ----- boxe : garde de profil, bras/jambe « côté observateur » = avant ----- */
const GARDE={gants:true,hanche:[0,48],torse:83,tete:85,bd:{t:[9,7],rel:true,m:60},bg:{t:[5,9],rel:true,m:70},jd:{t:[13,3]},jg:{t:[-13,3],p:-8}};
const JAB=P(GARDE,{torse:80,bd:{a:[8,4],m:4},hanche:[2,48]});
const CROSS=P(GARDE,{torse:76,hanche:[3,47],bg:{a:[6,4],m:4},bd:{t:[6,8],rel:true},jg:{t:[-12,3],p:-35}});
const CROCHET=P(GARDE,{torse:86,tete:86,bd:{a:[6,0],ech2:.3,m:0}});
const UPPER=P(GARDE,{hanche:[1,45],torse:80,bd:{a:[-35,70],m:80}});
const ESQUIVE=P(GARDE,{hanche:[-1,44],torse:68,tete:72});
const ACCROUPI_GARDE=P(GARDE,{hanche:[-2,36],torse:80});
/* ----- au sol ----- */
/* planche haute : corps incliné d'un angle tel que les mains sont sous les épaules ; coude : 0 tendu → 1 poitrine au sol */
function PLANCHE(fl,o){
  fl=fl||0;const bras=L.bras+L.avbras+2,ang=Math.asin(Math.max(4,bras*(1-fl*.72))/ (L.cuisse+L.jambe+L.torse+5))/R;
  const pieds=-(L.cuisse+L.jambe)*Math.cos(ang*R),h=3.5+(L.cuisse+L.jambe)*Math.sin(ang*R),ex=L.torse*Math.cos(ang*R),ey=h+L.torse*Math.sin(ang*R);
  const mx=(L.cuisse+L.jambe)*Math.cos(23*R)+L.torse*Math.cos(23*R)+pieds; // mains au même endroit que planche tendue
  return P({hanche:[0,h],torse:ang,tete:ang+10,jd:{t:[pieds,4],p:-150},jg:{t:[pieds-1.5,4],p:-150},bd:{t:[fl?mx-2:ex+1,2.6],m:0},bg:{t:[fl?mx-4:ex-1,2.6],m:0}},o);
}
/* planche sur les avant-bras */
function PLANCHE_AB(o){const ang=11;const h=3.5+49*Math.sin(ang*R),ex=L.torse*Math.cos(ang*R);
  return P({hanche:[0,h],torse:ang,tete:ang+8,jd:{t:[-49*Math.cos(ang*R),4],p:-150},jg:{t:[-49*Math.cos(ang*R)-1.5,4],p:-150},bd:{a:[-92,0],m:0},bg:{a:[-95,-2],m:-2}},o)}
/* à quatre pattes : mains sous les épaules, genoux sous les hanches */
const QUATRE={hanche:[0,27],torse:14,tete:20,bd:{a:[-90,-90],m:0},bg:{a:[-92,-92],m:0},jd:{a:[-90,180],p:180},jg:{a:[-92,180],p:180}};
/* sur le dos, tête à gauche */
const DOS={hanche:[0,7],torse:180,tete:180,bd:{a:[-170,-175]},bg:{a:[-172,-178]},jd:{t:[22,3.5]},jg:{t:[21,3.5]}};
const DOS_TENDU={hanche:[0,7],torse:180,tete:180,bd:{a:[-175,-178]},bg:{a:[-177,-179]},jd:{a:[-2,0],p:80},jg:{a:[-1,0],p:80}};
/* sur le ventre, tête à droite */
const VENTRE={hanche:[0,7],torse:0,tete:0,bd:{a:[-175,180],m:180},bg:{a:[-178,180],m:180},jd:{a:[180,180],p:-100},jg:{a:[181,181],p:-100}};
/* assis, jambes devant */
const ASSIS={hanche:[0,7],torse:115,tete:110,bd:{t:[-12,3],m:180},bg:{t:[-14,3],m:180},jd:{t:[30,4],p:80},jg:{t:[29,4],p:80}};
/* vue de face, debout */
const FACE={vue:'face',hanche:[0,H],torse:90,tete:90,jd:{t:[-6,3]},jg:{t:[6,3]}};

/* ----- poses complémentaires ----- */
/* vue de dessus, allongé sur le ventre (planche, pompes) : tête à droite ; ecart = demi-écart des mains ; decal = mains décalées */
function DESSUS(o){return P({vue:'face',fixe:true,sol:false,hanche:[0,40],torse:0,tete:0,bd:{t:[26,49],m:0,ech:.42},bg:{t:[26,31],m:0,ech:.42},jd:{a:[182,180],p:180},jg:{a:[178,180],p:180}},o)}
const MAINS=(ecart,decal)=>({bd:{t:[26+(decal||0),40+ecart],m:0,ech:.42+Math.max(0,ecart-11)*.02,plie:1},bg:{t:[26-(decal||0),40-ecart],m:0,ech:.42+Math.max(0,ecart-11)*.02,plie:-1}});
/* vue de dessus, allongé sur le dos ou le ventre, bras le long du corps */
const DESSUS_ALLONGE={vue:'face',fixe:true,sol:false,hanche:[0,40],torse:0,tete:0,bd:{a:[178,180],m:180},bg:{a:[182,180],m:180},jd:{a:[183,180],p:180},jg:{a:[177,180],p:180}};
/* V inversé : fesses en l'air, mains et pieds au sol */
const PIKE={hanche:[0,52],torse:-48,tete:-55,bd:{a:[-48,-48],m:0},bg:{a:[-50,-50],m:0},jd:{t:[-24,3.5],p:0},jg:{t:[-25.5,3.5],p:0}};
/* penché en avant, mains au sol (jambes presque tendues) */
const PENCHE={hanche:[-6,50],torse:-62,tete:-70,bd:{a:[-90,-90],m:0},bg:{a:[-92,-92],m:0},jd:{t:[-3,3]},jg:{t:[-5,3]}};
/* accroupi, mains au sol devant les pieds */
const ACCROUPI={hanche:[-10,22],torse:40,tete:45,bd:{t:[14,2.6],m:0},bg:{t:[12,2.6],m:0},jd:{t:[2,3]},jg:{t:[0,3]}};
/* à genoux, buste droit */
const GENOUX={hanche:[0,29],torse:90,tete:90,jd:{a:[-90,180],p:180},jg:{a:[-92,180],p:180}};
/* table inversée : mains derrière, pieds au sol, bassin haut, ventre vers le ciel (tête à gauche) */
const TABLE={hanche:[0,33],torse:180,tete:165,bd:{a:[-90,-90],m:180},bg:{a:[-92,-92],m:180},jd:{a:[0,-90],p:0},jg:{a:[-2,-90],p:0}};
/* pont fessier (tête à gauche, épaules au sol) */
const PONT={hanche:[0,24],torse:205,tete:185,bd:{a:[-8,0],m:0},bg:{a:[-10,-2],m:0},jd:{t:[20,3.5]},jg:{t:[19,3.5]}};
/* ours : à quatre pattes, genoux décollés */
const OURS={hanche:[0,29],torse:12,tete:18,bd:{a:[-90,-90],m:0},bg:{a:[-92,-92],m:0},jd:{t:[-20,4],p:-120},jg:{t:[-22,4],p:-120}};
/* planche sur les genoux */
function PLANCHE_GENOUX(fl,o){const ang=fl?17:31;return P({hanche:[0,3+25*Math.sin(ang*R)],torse:ang,tete:ang+8,jd:{a:[180+ang,135],p:135},jg:{a:[182+ang,137],p:137},
  bd:fl?{t:[33,2.6],m:0}:{a:[-90,-90],m:0},bg:fl?{t:[31,2.6],m:0}:{a:[-92,-92],m:0}},o)}
/* planche latérale vue de face : appui sur l'avant-bras (bg, côté sol) */
const LAT={vue:'face',hanche:[0,17],torse:17,tete:20,bg:{a:[-90,0],m:0},bd:{t:[-6,-14],rel:true,plie:1},jd:{a:[197,197],p:-90},jg:{a:[197,197],p:-90}};
/* garde vue de face */
const FACE_GARDE={vue:'face',gants:true,hanche:[0,48],torse:90,tete:90,bd:{t:[6,9],rel:true,plie:1,m:90},bg:{t:[-6,9],rel:true,plie:-1,m:90},jd:{t:[-12,3],plie:-1},jg:{t:[12,3],plie:1}};
/* debout sur une jambe, genou opposé levé */
const UNI={hanche:[0,52],torse:90,tete:90,jd:{t:[1,3]},jg:{a:[0,-90],p:0},...MAINS_HANCHES};
/* vue de face, accroupi jambes écartées */
function FACE_SQUAT(q,ecart,o){return P({vue:'face',hanche:[0,52-q*22],torse:90,tete:90,jd:{t:[-(ecart||12),3],plie:-1},jg:{t:[ecart||12,3],plie:1}},o)}

module.exports={DESSUS,MAINS,DESSUS_ALLONGE,PIKE,PENCHE,ACCROUPI,GENOUX,TABLE,PONT,OURS,PLANCHE_GENOUX,LAT,FACE_GARDE,UNI,FACE_SQUAT,P,F,H,DEBOUT,BRAS_AVANT,BRAS_HAUT,MAINS_TETE,MAINS_HANCHES,SQUAT,FENTE,GARDE,JAB,CROSS,CROCHET,UPPER,ESQUIVE,ACCROUPI_GARDE,PLANCHE,PLANCHE_AB,QUATRE,DOS,DOS_TENDU,VENTRE,ASSIS,FACE};
