import {useEffect,useRef,useState} from 'react';
import type {AppState} from './types';
import {askAi,aiContext} from './ai';
import {today} from './domain';
import {applyBrief,briefKey,homeReport,homeSignature,validAdvice} from './homeCoach';

// Mounted in App: a request survives navigation; its reply can only update its original record.
export function useHomeCoach(state:AppState,date:string,active:boolean,ready:boolean,online:boolean,update:(fn:(s:AppState)=>AppState)=>void) {
 const [clock,setClock]=useState(()=>new Date()),[pending,setPending]=useState<string[]>([]),inFlight=useRef(new Set<string>()),current=useRef({state,date,update});current.current={state,date,update};
 useEffect(()=>{const tick=()=>{if(document.visibilityState==='visible')setClock(new Date());};const timer=setInterval(tick,60000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const report=homeReport(state,date,clock.getHours()),key=briefKey(date,report.phase),signature=homeSignature(state,date,report.phase),record=state.homeBriefs?.find(r=>briefKey(r.date,r.phase)===key);
 async function refresh(automatic=false) {
  const {state:s,date:d,update:save}=current.current,hour=new Date().getHours(),facts=homeReport(s,d,hour),k=briefKey(d,facts.phase);
  if(inFlight.current.has(k)||!online||!ready||(automatic&&(!s.settings.homeAiAuto||d!==today()||document.visibilityState!=='visible'||s.homeBriefs?.some(r=>briefKey(r.date,r.phase)===k))))return;
  const id=crypto.randomUUID(),sig=homeSignature(s,d,facts.phase),at=new Date().toISOString(),previous=s.homeBriefs?.find(r=>briefKey(r.date,r.phase)===k);
  inFlight.current.add(k);setPending(p=>[...p,k]);
  save(v=>({...v,homeBriefs:[...(v.homeBriefs??[]).filter(r=>briefKey(r.date,r.phase)!==k),{...previous,id,date:d,phase:facts.phase,attemptedAt:at,error:undefined}].slice(-90)}));
  try {
   const r=await askAi('brief','今の記録から、励ましと次の行動を短く提案してください。', {...aiContext(s,d),homeReport:facts});
   if(!validAdvice(r.brief))throw new Error('AIのアドバイスを読み取れませんでした。記録からの提案を使えます。');
   save(v=>({...v,homeBriefs:applyBrief(v.homeBriefs??[],id,{brief:r.brief!,signature:sig,at:new Date().toISOString()})}));
  }catch(e){save(v=>({...v,homeBriefs:applyBrief(v.homeBriefs??[],id,{error:(e instanceof Error?e.message:'AIに接続できませんでした').slice(0,1000)})}));}
  finally {inFlight.current.delete(k);setPending(p=>p.filter(x=>x!==k));}
 }
 useEffect(()=>{if(active&&ready&&online&&state.settings.homeAiAuto)void refresh(true);},[active,ready,online,state.settings.homeAiAuto,date,report.phase,clock]);
 return {report,record,busy:pending.includes(key),stale:!!record?.brief&&record.briefSignature!==signature,refresh:()=>refresh(false)};
}
