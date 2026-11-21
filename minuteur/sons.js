/* Minuteur — moteur sonore (Web Audio, aucun fichier). 5 ambiances × 6 sons distincts.
   Les sons sont PROGRAMMÉS sur l'horloge audio à l'instant exact calculé par le moteur : ils tombent pile sur le chrono,
   même si l'affichage ralentit. Un son programmé peut être annulé (pause, étape suivante, arrêt). */
(function(){
'use strict';
const lsG=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsS=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const DEF={on:true,vol:1,pack:'cloche',paliers:true,decompte:true,vib:true,voix:false};
let R=Object.assign({},DEF);try{Object.assign(R,JSON.parse(lsG('adb-mn-sons')||'{}'))}catch(e){}
const save=()=>lsS('adb-mn-sons',JSON.stringify(R));
let ac=null,master=null,noiseBuf=null;const prog=[];
function audio(){
  try{
    if(!ac){
      try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ac=new C({latencyHint:'interactive'});
      /* chaîne « fort et propre » : gain réglable → compresseur → gain → limiteur */
      master=ac.createGain();master.gain.value=R.vol;
      const comp=ac.createDynamicsCompressor();comp.threshold.value=-26;comp.knee.value=6;comp.ratio.value=10;comp.attack.value=.002;comp.release.value=.12;
      const boost=ac.createGain();boost.gain.value=2.6;
      const lim=ac.createDynamicsCompressor();lim.threshold.value=-1;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.001;lim.release.value=.05;
      master.connect(comp);comp.connect(boost);boost.connect(lim);lim.connect(ac.destination);
    }
    if(ac.state==='suspended')ac.resume().catch(()=>{});
    return ac;
  }catch(e){return null}
}
/* à appeler pendant un appui de l'utilisateur (règle des navigateurs et des téléphones) */
function activer(){
  const a=audio();if(!a)return false;
  try{const b=a.createBuffer(1,1,22050),s=a.createBufferSource();s.buffer=b;s.connect(a.destination);s.start(0)}catch(e){}
  if(window.speechSynthesis&&R.voix){try{speechSynthesis.getVoices()}catch(e){}}
  return true;
}
document.addEventListener('visibilitychange',()=>{if(ac&&document.visibilityState==='visible'&&ac.state!=='running')ac.resume().catch(()=>{})});
const keep=(t,nodes)=>{prog.push({t,nodes});if(prog.length>400)prog.splice(0,prog.length-400)};
function tone(t,f,dur,type,g){
  const o=ac.createOscillator(),v=ac.createGain();o.type=type||'sine';o.frequency.value=f;g=g||.6;
  v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.01);
  v.gain.setValueAtTime(g,Math.max(t+.012,t+dur-.03));v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.03);keep(t,[o]);
}
function sweep(t,f1,f2,dur,type,g){
  const o=ac.createOscillator(),v=ac.createGain();o.type=type||'sawtooth';o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);
  v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g||.4,t+.02);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.03);keep(t,[o]);
}
function ring(t,f,dur,g,type){
  const o=ac.createOscillator(),v=ac.createGain();o.type=type||'sine';o.frequency.value=f;g=g||.5;
  v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g,t+.006);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(master);o.start(t);o.stop(t+dur+.05);keep(t,[o]);
}
function noise(t,dur,freq,g){
  if(!noiseBuf){noiseBuf=ac.createBuffer(1,ac.sampleRate*.5,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const src=ac.createBufferSource(),bp=ac.createBiquadFilter(),v=ac.createGain();
  src.buffer=noiseBuf;bp.type='bandpass';bp.frequency.value=freq||1800;bp.Q.value=4;
  v.gain.setValueAtTime(g||1,t);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(bp);bp.connect(v);v.connect(master);src.start(t);src.stop(t+dur+.02);keep(t,[src]);
}
function whistle(t,dur){
  const end=t+dur,lfo=ac.createOscillator();lfo.type='sine';lfo.frequency.value=34;
  const fm=ac.createGain();fm.gain.value=170;lfo.connect(fm);
  const env=ac.createGain();env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(.8,t+.012);env.gain.setValueAtTime(.8,end-.04);env.gain.exponentialRampToValueAtTime(.0001,end);
  const o=ac.createOscillator();o.type='sine';o.frequency.value=3250;fm.connect(o.frequency);o.connect(env);env.connect(master);
  [lfo,o].forEach(x=>{x.start(t);x.stop(end+.05)});keep(t,[lfo,o]);
}
const bell=(t,f,g)=>{f=f||880;ring(t,f,1.5,.55*(g||1));ring(t,f*2.76,.7,.18*(g||1));ring(t,f*5.4,.35,.08*(g||1))};
const wood=(t,g)=>{ring(t,1100,.2,g||1,'triangle');ring(t,2350,.1,.45*(g||1));noise(t,.05,2600,1.4*(g||1))};
/* 6 sons par ambiance : debut (séance), activite, repos, palier (bip doux 30 s), decompte (10…1), fin (séance complète) */
const PACKS={
  cloche:{n:'Boxe avec cloche',
    debut:t=>{bell(t);bell(t+.3);bell(t+.6)},activite:t=>bell(t),repos:t=>{bell(t,880,.9);bell(t+.32,880,.9)},
    palier:t=>wood(t,.45),decompte:(t,s)=>s<=3?wood(t,1):noise(t,.06,2200,1.2),
    fin:t=>{for(let k=0;k<5;k++)bell(t+k*.28);ring(t+1.5,98,3,.8);ring(t+1.5,147,2.4,.35)}},
  classique:{n:'Classique sportif',
    debut:t=>{ring(t,659,.6,.5);ring(t+.18,784,.6,.5);ring(t+.36,1046,.9,.5)},activite:t=>tone(t,1320,.55,'square',.4),
    repos:t=>{tone(t,880,.22,'square',.35);tone(t+.28,660,.4,'square',.35)},palier:t=>tone(t,880,.12,'sine',.25),
    decompte:(t,s)=>tone(t,s<=3?1320:1000,.13,'square',.35),
    fin:t=>{tone(t,523.25,.16);tone(t+.18,659.25,.16);tone(t+.36,783.99,.16);tone(t+.54,1046.5,.4);tone(t+1,783.99,.16);tone(t+1.18,1046.5,.9)}},
  electro:{n:'Électronique minimaliste',
    debut:t=>{[440,554,659,880].forEach((f,k)=>tone(t+k*.09,f,.08,'square',.3))},activite:t=>sweep(t,400,1600,.35,'sawtooth',.35),
    repos:t=>sweep(t,1400,350,.45,'sawtooth',.3),palier:t=>tone(t,1760,.05,'sine',.25),
    decompte:(t,s)=>tone(t,s<=3?2400:1800,.05,'square',.3),
    fin:t=>{[523,659,784,1046,1318,1568].forEach((f,k)=>tone(t+k*.1,f,.12,'square',.3));sweep(t+.7,800,2400,.8,'sine',.35)}},
  intensif:{n:'Entraînement intensif',
    debut:t=>{tone(t,140,.6,'sawtooth',.45);whistle(t+.7,.6)},activite:t=>{whistle(t,.16);whistle(t+.22,.5)},
    repos:t=>{tone(t,140,.7,'sawtooth',.45);tone(t,147,.7,'sawtooth',.35)},palier:t=>{tone(t,1200,.08,'square',.3);tone(t+.14,1200,.08,'square',.3)},
    decompte:(t,s)=>tone(t,s<=3?1600:1200,.12,'square',.45),
    fin:t=>{for(let k=0;k<3;k++){tone(t+k*.45,233,.38,'sawtooth',.4);tone(t+k*.45,294,.38,'sawtooth',.35);tone(t+k*.45,349,.38,'sawtooth',.3)}whistle(t+1.5,1)}},
  doux:{n:'Sons doux',
    debut:t=>{ring(t,523,1.2,.35);ring(t+.25,659,1.2,.35);ring(t+.5,784,1.6,.35)},activite:t=>{ring(t,659,.9,.4);ring(t+.15,988,1.1,.35)},
    repos:t=>{ring(t,784,.9,.35);ring(t+.2,523,1.3,.35)},palier:t=>ring(t,1046,.35,.15),
    decompte:(t,s)=>ring(t,s<=3?880:660,.25,.3),
    fin:t=>{[523,659,784,1046,784,1046].forEach((f,k)=>ring(t+k*.22,f,1.4,.35))}}
};
const TYPES={debut:'Début de séance',activite:'Début d’activité',repos:'Début de repos',palier:'Bip doux (toutes les 30 s)',decompte:'Décompte des 10 dernières secondes',fin:'Fin complète de séance'};
/* joue un son à l'instant atPerf (horloge performance.now, en ms) ; sans atPerf : tout de suite */
function jouer(type,atPerf,s){
  if(!R.on)return;
  if(type==='palier'&&!R.paliers)return;
  if(type==='decompte'&&!R.decompte)return;
  const a=audio();if(!a)return;const P=PACKS[R.pack]||PACKS.cloche,f=P[type];if(!f)return;
  const dt=atPerf==null?0:(atPerf-performance.now())/1000;
  try{f(Math.max(a.currentTime+.005,a.currentTime+dt+.005),s)}catch(e){}
}
/* annule les sons programmés qui n'ont pas encore commencé */
function annuler(){
  if(!ac)return;const now=ac.currentTime+.002;
  for(let k=prog.length-1;k>=0;k--){if(prog[k].t>now){prog[k].nodes.forEach(n=>{try{n.stop(0);n.disconnect()}catch(e){}});prog.splice(k,1)}}
}
function vibrer(p){if(R.vib&&navigator.vibrate)try{navigator.vibrate(p)}catch(e){}}
const peutParler='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
function parler(t,force){
  if(!peutParler||!(force||R.voix)||!t)return;
  try{const u=new SpeechSynthesisUtterance(t);u.lang='fr-FR';u.volume=1;u.rate=1.05;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}
}
function regler(o){Object.assign(R,o);if(master)master.gain.value=R.vol;save()}
window.ADB_SONS={PACKS,TYPES,R,activer,jouer,annuler,vibrer,parler,peutParler,regler,
  tester:(type,s)=>{activer();const on=R.on,p=R.paliers,d=R.decompte;R.on=R.paliers=R.decompte=true;jouer(type,null,s||5);R.on=on;R.paliers=p;R.decompte=d}};
})();
