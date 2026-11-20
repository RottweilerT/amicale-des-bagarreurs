(()=>{
  const W=window.__writes=[];window.__rulesNew=true;
  const SV={__sv:'ts'};const L={};
  const data=window.__data||{members:{m1:{first:'Armand',last:'C'},m2:{first:'Bob',last:'D'}},fights:{},courses:{},attendance:{}};
  const emit=col=>setTimeout(()=>(L[col]||[]).forEach(cb=>cb({docs:Object.entries(data[col]||{}).map(([id,v])=>({id,data:()=>JSON.parse(JSON.stringify(v))}))})),5);
  const doc=path=>{const [col,id]=path.split('/');return {id,
    set:async(d,o)=>{W.push({op:'set',path,d:JSON.parse(JSON.stringify(d))});data[col]=data[col]||{};
      const cur=o&&o.merge?(data[col][id]||{}):{};const mg=(cur,d)=>{for(const[k,v]of Object.entries(d)){if(v&&v.__del){delete cur[k]}else if(v&&v.union)cur[k]=[...new Set([...(cur[k]||[]),...v.union])];else if(v&&v.remove)cur[k]=(cur[k]||[]).filter(x=>!v.remove.includes(x));else if(o&&o.merge&&v&&typeof v==='object'&&!Array.isArray(v)&&!v.__sv){cur[k]=cur[k]&&typeof cur[k]==='object'?cur[k]:{};mg(cur[k],v)}else cur[k]=v}};mg(cur,d)
      data[col][id]=cur;emit(col)},
    delete:async()=>{W.push({op:'del',path});delete data[col][id];emit(col)}}};
  const db={settings(){},enablePersistence:()=>Promise.resolve(),doc:p=>doc(p),
    collection:col=>({onSnapshot(cb){(L[col]=L[col]||[]).push(cb);emit(col);return()=>{}},doc:()=>({id:'id'+Math.random().toString(36).slice(2,10)}),add:async d=>{W.push({op:'add',col,d});return{id:'r'}}})};
  const fs=()=>db;fs.FieldValue={delete:()=>({__del:1}),serverTimestamp:()=>SV,arrayUnion:(...a)=>({union:a}),arrayRemove:(...a)=>({remove:a})};
  window.firebase={initializeApp(){},firestore:fs,messaging:()=>({getToken:async()=>'TOKEN-'+'x'.repeat(30),deleteToken:async()=>true})};
})();
