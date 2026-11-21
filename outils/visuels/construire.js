/* Génère la bibliothèque visuelle : node outils/visuels/construire.js
   → minuteur/visuels/<id>/thumbnail.svg, step-01.svg…, animation.svg (si plusieurs étapes de même vue), instructions.json
   → minuteur/visuels/manifest.json (manifeste central)
   → outils/visuels/controle/<catégorie>.html (planches de contrôle visuel)
   Les textes ne sont jamais dessinés dans les images : ils sont dans instructions.json. */
'use strict';
const fs=require('fs'),path=require('path');
const V=require('./personnage.js');
global.window=global;require('../../minuteur/exercices.js');const LIB=global.ADB_LIB;
const FICHES=Object.assign({},...['fiches-1','fiches-2','fiches-3'].filter(f=>fs.existsSync(path.join(__dirname,f+'.js'))).map(f=>require('./'+f+'.js')));
const RACINE=path.join(__dirname,'..','..'),OUT=path.join(RACINE,'minuteur','visuels'),QC=path.join(__dirname,'controle');
const VERSION=1;
const CAT=Object.fromEntries(LIB.cats);
const manquants=[],manifest={version:VERSION,genere:new Date().toISOString().slice(0,10),format:'svg',exercices:{}};
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(QC,{recursive:true});
const parCat={};
for(const a of LIB.exos){
  const [id,nom,cats,,,,,,,,,instr,facile,difficile]=a;const f=FICHES[id];
  if(!f){manquants.push(id);continue}
  const poses=f.e.map(x=>x[0]),cad=V.cadre(poses),dir=path.join(OUT,id);
  fs.mkdirSync(dir,{recursive:true});
  for(const old of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,old));
  const etapes=f.e.map(([p,t],i)=>{const nomF=`step-${String(i+1).padStart(2,'0')}.svg`;fs.writeFileSync(path.join(dir,nomF),V.svg(p,{cadre:cad}));return {image:nomF,texte:t}});
  const iMini=f.mini??(poses.length>2?1:poses.length-1);
  fs.writeFileSync(path.join(dir,'thumbnail.svg'),V.svg(poses[iMini],{cadre:V.cadre([poses[iMini]]),fleches:false}));
  const memeVue=poses.every(p=>(p.vue||'profil')===(poses[0].vue||'profil')&&!!p.gants===!!poses[0].gants&&JSON.stringify(p.acc||{})===JSON.stringify(poses[0].acc||{})&&!!p.fixe===!!poses[0].fixe);
  let anim=null;
  if(poses.length>1&&memeVue&&f.anim!==false){anim='animation.svg';fs.writeFileSync(path.join(dir,anim),V.animation(poses,{cadre:cad}))}
  const fiche={id,nom,categories:cats.map(c=>CAT[c]),etapes,instructions:instr,erreur:f.err,
    variantes:{facile:{texte:facile,exercice:f.vf||null},difficile:{texte:difficile,exercice:f.vd||null}},
    animation:anim,controle:{statut:f.revoir?'à revoir':'vérifié',note:f.revoir||''}};
  for(const k of ['vf','vd'])if(f[k]&&!LIB.exos.some(x=>x[0]===f[k]))throw new Error(id+' : variante inconnue '+f[k]);
  fs.writeFileSync(path.join(dir,'instructions.json'),JSON.stringify(fiche,null,1));
  manifest.exercices[id]={dossier:'visuels/'+id+'/',miniature:'thumbnail.svg',etapes:etapes.map(e=>e.image),animation:anim,instructions:'instructions.json',statut:fiche.controle.statut};
  (parCat[cats[0]]=parCat[cats[0]]||[]).push({id,nom,f,cad});
}
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest));
/* planches de contrôle : toutes les étapes de chaque exercice, côte à côte, avec leur consigne */
for(const [c,l] of Object.entries(parCat)){
  let h=`<!doctype html><meta charset="utf-8"><title>Contrôle — ${CAT[c]}</title><body style="margin:0;font:11px system-ui;background:#fff">`;
  for(const x of l){h+=`<div style="display:flex;gap:4px;align-items:flex-start;border-bottom:1px solid #ccc;padding:3px"><div style="width:120px"><b>${x.nom}</b><br><small>${x.id}</small>${x.f.revoir?'<br><i style="color:#c00">à revoir</i>':''}</div>`
    +x.f.e.map(([p,t])=>`<div style="width:150px"><div style="width:150px">${V.svg(p,{cadre:x.cad})}</div><small>${t}</small></div>`).join('')+'</div>'}
  fs.writeFileSync(path.join(QC,c+'.html'),h+'</body>');
}
const n=Object.keys(manifest.exercices).length,rv=Object.values(manifest.exercices).filter(x=>x.statut!=='vérifié').length;
console.log(`${n} fiches générées, ${rv} à revoir, ${manquants.length} sans fiche${manquants.length?' : '+manquants.join(', '):''}`);
if(process.argv.includes('--strict')&&manquants.length)process.exit(1);
