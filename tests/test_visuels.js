/* Bibliothèque visuelle : chaque exercice a sa fiche, chaque fichier du manifeste existe : node tests/test_visuels.js */
const fs=require('fs'),path=require('path');
global.window=global;require('../minuteur/exercices.js');
const R=path.join(__dirname,'..','minuteur'),M=JSON.parse(fs.readFileSync(path.join(R,'visuels','manifest.json'),'utf8'));
let ko=0;const ok=(c,q)=>{if(!c){console.log('ÉCHEC '+q);ko++}};
for(const [id] of window.ADB_LIB.exos){
  const m=M.exercices[id];ok(m,id+' : pas de fiche');if(!m)continue;
  const d=path.join(R,m.dossier);
  for(const f of [m.miniature,m.instructions,...m.etapes,...(m.animation?[m.animation]:[])])ok(fs.existsSync(path.join(d,f)),id+' : fichier manquant '+f);
  const j=JSON.parse(fs.readFileSync(path.join(d,m.instructions),'utf8'));
  ok(j.etapes.length>=1&&j.etapes.length<=6&&j.etapes.every(e=>e.texte&&e.image),id+' : étapes invalides');
  ok(j.erreur&&j.instructions,id+' : erreur ou consigne manquante');
  for(const f of m.etapes){const s=fs.readFileSync(path.join(d,f),'utf8');ok(s.startsWith('<svg')&&!/<text/.test(s),id+' : '+f+' doit être un SVG sans texte')}
}
const n=Object.keys(M.exercices).length,rv=Object.entries(M.exercices).filter(([,x])=>x.statut!=='vérifié').map(([k])=>k);
console.log(`${n} fiches, ${rv.length} à revoir : ${rv.join(', ')}`);
console.log(ko?`${ko} échec(s)`:'Bibliothèque visuelle : tout est bon.');process.exit(ko?1:0);
