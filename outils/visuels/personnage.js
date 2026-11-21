/* Personnage de référence des fiches d'exercices (outil de génération, exécuté avec Node ; rien ici n'est chargé par l'appli).
   Une pose : bassin (hanche), angle du buste (torse), de la tête, et 4 membres. Chaque membre se règle par angles absolus
   {a:[segment1, segment2]} ou par cible {t:[x,y]} (le coude / genou se place tout seul, cinématique inverse à 2 segments).
   Repère : x vers la droite (le personnage regarde à droite en vue de profil), y vers le haut, sol en y = 0, angles en degrés
   (0 = droite, 90 = haut). « bd »/« jd » : bras et jambe du côté de l'observateur ; « bg »/« jg » : côté opposé (plus sombres).
   vue:'face' : personnage vu de face (ou de dessus, avec fixe:true et sans sol). */
'use strict';
const L={torse:28,cou:3.5,tete:7,bras:15.5,avbras:14,main:4.6,cuisse:25,jambe:24,pied:9};
const R=Math.PI/180;
const pt=(o,a,l)=>[o[0]+Math.cos(a*R)*l,o[1]+Math.sin(a*R)*l];
const ang=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])/R;
function ik(o,t,l1,l2,plie){
  let d=Math.hypot(t[0]-o[0],t[1]-o[1]);d=Math.min(d,l1+l2-1e-3);d=Math.max(d,Math.abs(l1-l2)+1e-3);
  const base=ang(o,t),c=(l1*l1+d*d-l2*l2)/(2*l1*d),a=Math.acos(Math.max(-1,Math.min(1,c)))/R;
  const a1=base+plie*a,m=pt(o,a1,l1);return [a1,ang(m,t)];
}
const C={peau:'#E3AC86',peau2:'#BE8763',haut:'#1D3FA6',haut2:'#152F7C',short:'#0D1B3E',short2:'#26345F',chaussure:'#2A2F3A',chaussure2:'#191C23',
  cheveux:'#2B1F18',sol:'#AEB8CE',fond:'#F3F5FA',fleche:'#D12A3A',gant:'#D12A3A',gant2:'#97202B',acc:'#8A93A8',sac:'#7A2430'};
/* ---------- squelette ---------- */
function squelette(p){
  const face=p.vue==='face',h=(p.hanche||[0,52]).slice(),tA=p.torse??90,tt=p.tete??tA;
  const ep=pt(h,tA,L.torse*(p.echTorse||1)),cou=pt(ep,tt,L.cou),tete=pt(cou,tt,L.tete);
  const n=[Math.cos((tA-90)*R),Math.sin((tA-90)*R)]; // vers la « droite » du buste
  const off=(o,k)=>face?[o[0]+n[0]*k,o[1]+n[1]*k]:o.slice();
  const memb=(m,o,l1,l2,lb,defA,defPlie,bout)=>{
    m=m||{};let a;const k=m.ech||1;l1*=k;l2*=k*(m.ech2||1);lb*=Math.max(k,.7);
    if(m.t){const t=m.rel?[o[0]+m.t[0],o[1]+m.t[1]]:m.t;a=ik(o,t,l1,l2,m.plie??defPlie)}else a=(m.a||defA).slice();
    const j=pt(o,a[0],l1),e=pt(j,a[1],l2),ab=m[bout]??(bout==='p'?(face?-90:0):a[1]);
    return {o,j,e,b:pt(e,ab,lb),a,ab};
  };
  const s={vue:p.vue||'profil',hanche:h,epaule:ep,cou,tete,tA,tt,
    bd:memb(p.bd,off(ep,-7),L.bras,L.avbras,L.main,face?[-100,-95]:[-95,-88],-1,'m'),
    bg:memb(p.bg,off(ep,7),L.bras,L.avbras,L.main,face?[-80,-85]:[-85,-92],-1,'m'),
    jd:memb(p.jd,off(h,-4.5),L.cuisse,L.jambe,L.pied,[-91,-90],1,'p'),
    jg:memb(p.jg,off(h,4.5),L.cuisse,L.jambe,L.pied,face?[-89,-90]:[-89,-90],face?-1:1,'p')};
  return s;
}
const tous=s=>[s.hanche,s.epaule,s.cou,s.tete,...['bd','bg','jd','jg'].flatMap(k=>[s[k].o,s[k].j,s[k].e,s[k].b])];
/* pose posée au sol : le point le plus bas (épaisseur comprise) touche y = 0 ; air : décollage ; fixe : pas de recalage */
function poser(p){
  const s=squelette(p);if(p.fixe)return s;
  let min=Infinity;
  for(const k of ['bd','bg'])for(const q of [s[k].j,s[k].e,s[k].b])min=Math.min(min,q[1]-2.6);
  for(const k of ['jd','jg'])for(const q of [s[k].j,s[k].e,s[k].b])min=Math.min(min,q[1]-3);
  min=Math.min(min,s.hanche[1]-7.5,s.tete[1]-L.tete,s.epaule[1]-7.5);
  const dy=-min+(p.air||0);const vus=new Set();
  for(const q of tous(s))if(!vus.has(q)){vus.add(q);q[1]+=dy}
  return s;
}
/* ---------- dessin : liste d'éléments (tag + attributs), pour pouvoir animer ---------- */
const f1=v=>Math.round(v*10)/10;
function elements(s,p){
  const face=s.vue==='face',E=[];
  const ln=(a,b,w,c)=>E.push(['line',{x1:f1(a[0]),y1:f1(-a[1]),x2:f1(b[0]),y2:f1(-b[1]),stroke:c,'stroke-width':w,'stroke-linecap':'round'}]);
  const ci=(a,r,c)=>E.push(['circle',{cx:f1(a[0]),cy:f1(-a[1]),r,fill:c}]);
  const gants=!!p.gants;
  const bras=(m,loin)=>{ln(m.o,m.j,7,loin?C.haut2:C.haut);ln(m.j,m.e,5.4,loin?C.peau2:C.peau);if(gants)ci(pt(m.e,m.ab,2.6),4.6,loin?C.gant2:C.gant);else ln(m.e,m.b,4.4,loin?C.peau2:C.peau)};
  const jambe=(m,loin)=>{ln(m.o,m.j,9.6,loin?C.short2:C.short);ln(m.j,m.e,7,loin?C.peau2:C.peau);ln(m.e,m.b,5.4,loin?C.chaussure2:C.chaussure)};
  const tronc=()=>{
    ln(s.hanche,s.epaule,face?20:15,C.haut);
    if(face){const n=[Math.cos((s.tA-90)*R),Math.sin((s.tA-90)*R)];ln([s.hanche[0]-n[0]*5,s.hanche[1]-n[1]*5],[s.hanche[0]+n[0]*5,s.hanche[1]+n[1]*5],12,C.short)}
    else ci(s.hanche,7.4,C.short);
    ln(s.epaule,s.cou,6,C.peau);ci(s.tete,L.tete,C.peau);
    /* cheveux : à l'arrière et au-dessus de la tête (indique le sens du regard) ; de face : sur le dessus */
    const c=s.tete,r=L.tete+.4,a0=face?s.tt-75:s.tt-15,a1=face?s.tt+75:s.tt+185;
    const P=a=>[c[0]+Math.cos(a*R)*r,c[1]+Math.sin(a*R)*r],q0=P(a0),q1=P(a1);
    E.push(['path',{d:`M${f1(q0[0])} ${f1(-q0[1])} A${r} ${r} 0 ${a1-a0>180?1:0} 0 ${f1(q1[0])} ${f1(-q1[1])} Z`,fill:C.cheveux}]);
  };
  if(face){jambe(s.jg,0);jambe(s.jd,0);tronc();bras(s.bg,0);bras(s.bd,0)}
  else{bras(s.bg,1);jambe(s.jg,1);tronc();jambe(s.jd,0);bras(s.bd,0)}
  return E;
}
function accessoires(p,s){
  const A=[],a=p.acc||{};
  if(a.mur!==undefined)A.push(`<line x1="${a.mur}" y1="0" x2="${a.mur}" y2="-110" stroke="${C.acc}" stroke-width="4"/>`);
  if(a.sac!==undefined){const x=a.sac;A.push(`<line x1="${x}" y1="-118" x2="${x}" y2="-96" stroke="${C.acc}" stroke-width="1.6"/><rect x="${x-9}" y="-96" width="18" height="58" rx="7" fill="${C.sac}"/>`)}
  if(a.double){const [x,y]=a.double;A.push(`<line x1="${x}" y1="-118" x2="${x}" y2="${-y-5}" stroke="${C.acc}" stroke-width="1.2"/><line x1="${x}" y1="${-y+5}" x2="${x}" y2="0" stroke="${C.acc}" stroke-width="1.2"/><circle cx="${x}" cy="${-y}" r="5.5" fill="${C.sac}"/>`)}
  if(a.corde){const h1=s.bd.b,h2=s.bg.b,y=a.corde==='haut'?s.tete[1]+16:-1.5;const mx=(h1[0]+h2[0])/2+(a.corde==='haut'?-4:4);
    A.push(`<path d="M${f1(h1[0])} ${f1(-h1[1])} Q${f1(mx-24)} ${f1(-y)} ${f1(mx)} ${f1(-y)} Q${f1(mx+24)} ${f1(-y)} ${f1(h2[0])} ${f1(-h2[1])}" fill="none" stroke="${C.acc}" stroke-width="1.6"/>`)}
  return A.join('');
}
function flecheGeo(f,s){
  const get=k=>{const [a,b]=k.split('.');const v=b?s[a][b]:s[a];return [v[0],v[1]]};
  let a=f.sur?get(f.sur):f.de.slice();if(f.dx)a=[a[0]+f.dx[0],a[1]+f.dx[1]];
  const b=f.d?[a[0]+f.d[0],a[1]+f.d[1]]:f.a;const k=f.k??0;
  const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,dx=b[0]-a[0],dy=b[1]-a[1],c=[mx-dy*k,my+dx*k];
  return {a,b,c};
}
function fleche(f,s){
  const {a,b,c}=flecheGeo(f,s);
  const t=Math.atan2(b[1]-c[1],b[0]-c[0]),h=5.2,p1=[b[0]-h*Math.cos(t-.5),b[1]-h*Math.sin(t-.5)],p2=[b[0]-h*Math.cos(t+.5),b[1]-h*Math.sin(t+.5)];
  const st=`fill="none" stroke="${C.fleche}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  return `<path d="M${f1(a[0])} ${f1(-a[1])} Q${f1(c[0])} ${f1(-c[1])} ${f1(b[0])} ${f1(-b[1])}" ${st}/><path d="M${f1(p1[0])} ${f1(-p1[1])} L${f1(b[0])} ${f1(-b[1])} L${f1(p2[0])} ${f1(-p2[1])}" ${st}/>`;
}
/* cadre commun (cadrage constant pour toutes les étapes d'un exercice), format presque carré */
function cadre(poses){
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const p of poses){const s=poser(p);
    for(const q of tous(s)){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1])}
    y1=Math.max(y1,s.tete[1]+L.tete);x0=Math.min(x0,s.tete[0]-L.tete);x1=Math.max(x1,s.tete[0]+L.tete);
    const a=p.acc||{};if(a.mur!==undefined){x0=Math.min(x0,a.mur-4);x1=Math.max(x1,a.mur+4)}
    if(a.sac!==undefined){x0=Math.min(x0,a.sac-12);x1=Math.max(x1,a.sac+12);y1=Math.max(y1,100)}
    if(a.double){x0=Math.min(x0,a.double[0]-8);x1=Math.max(x1,a.double[0]+8)}
    for(const f of p.fleches||[]){const g=flecheGeo(f,s);for(const q of [g.a,g.b,[(g.a[0]+2*g.c[0]+g.b[0])/4,(g.a[1]+2*g.c[1]+g.b[1])/4]]){x0=Math.min(x0,q[0]-3);x1=Math.max(x1,q[0]+3);y0=Math.min(y0,q[1]-3);y1=Math.max(y1,q[1]+3)}}
  }
  const m=9;x0-=m;x1+=m;y1+=m;y0=Math.min(y0-m,-4);
  let w=x1-x0,h=y1-y0;const ratio=1.15;
  if(w/h<ratio){const nw=h*ratio;x0-=(nw-w)/2;w=nw}else{const nh=w/ratio;y1+=(nh-h)*.7;y0-=(nh-h)*.3;h=nh}
  w=Math.max(w,40);return {x:f1(x0),y:f1(-y1),w:f1(w),h:f1(h)};
}
const attrs=o=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
function fond(cd,p){return `<rect x="${cd.x}" y="${cd.y}" width="${cd.w}" height="${cd.h}" fill="${C.fond}"/>`+(p.sol===false?'':`<line x1="${cd.x}" y1="1.2" x2="${f1(cd.x+cd.w)}" y2="1.2" stroke="${C.sol}" stroke-width="2"/>`)}
/* une image fixe */
function svg(p,o){
  o=o||{};const s=poser(p),cd=o.cadre||cadre([p]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cd.x} ${cd.y} ${cd.w} ${cd.h}">`+fond(cd,p)+accessoires(p,s)
    +elements(s,p).map(([t,a])=>`<${t} ${attrs(a)}/>`).join('')+(o.fleches===false?'':(p.fleches||[]).map(f=>fleche(f,s)).join(''))+`</svg>`;
}
/* animation en boucle (SMIL, fonctionne dans <img>) : interpolation des angles entre les étapes */
function params(p){const s=poser(p);const v=[s.hanche[0],s.hanche[1],s.tA,s.tt];for(const k of ['bd','bg','jd','jg'])v.push(s[k].a[0],s[k].a[1],s[k].ab);return v}
function depuisParams(v,p0){
  const lim=(i)=>({a:[v[i],v[i+1]],[i>=12?'p':'m']:v[i+2]});
  return Object.assign({},p0,{hanche:[v[0],v[1]],torse:v[2],tete:v[3],bd:lim(4),bg:lim(7),jd:{a:[v[10],v[11]],p:v[12]},jg:{a:[v[13],v[14]],p:v[15]},fixe:true,fleches:[]});
}
function interp(a,b,t){return a.map((x,i)=>{if(i<2)return x+(b[i]-x)*t;let d=((b[i]-x+540)%360)-180;return x+d*t})}
function animation(poses,o){
  o=o||{};const cd=o.cadre||cadre(poses),P=poses.map(params),frames=[],ease=t=>t*t*(3-2*t);
  const tenir=o.tenir??5,pas=o.pas??9;
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];for(let k=0;k<tenir;k++)frames.push(a);for(let k=1;k<pas;k++)frames.push(interp(a,b,ease(k/pas)))}
  const els=frames.map(v=>elements(poser(depuisParams(v,poses[0])),poses[0]));
  const dur=(frames.length*(o.ms??70)/1000).toFixed(2);
  const out=els[0].map(([t,a],j)=>{
    const anim=Object.keys(a).filter(k=>els.some(e=>e[j][1][k]!==a[k]))
      .map(k=>`<animate attributeName="${k}" dur="${dur}s" repeatCount="indefinite" values="${els.map(e=>e[j][1][k]).join(';')}"/>`).join('');
    return anim?`<${t} ${attrs(a)}>${anim}</${t}>`:`<${t} ${attrs(a)}/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cd.x} ${cd.y} ${cd.w} ${cd.h}">`+fond(cd,poses[0])+accessoires(poses[0],poser(poses[0]))+out+`</svg>`;
}
module.exports={L,C,squelette,poser,svg,animation,cadre,ik};
