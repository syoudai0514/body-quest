import {useEffect,useRef,useState} from 'react';
import type {AppState} from './types';
import {askAi,todaySummary} from './ai';
import {companion,COMPANION_VERSION} from './companion';
import {today} from './domain';
import {applyBrief,autoBriefOn,briefKey,homeReport,homeSignature,staleRefreshAllowed,validAdvice} from './homeCoach';

// Mounted in App: a request survives navigation; its reply can only update its original record.
export function useHomeCoach(state:AppState,date:string,active:boolean,ready:boolean,online:boolean,update:(fn:(s:AppState)=>AppState)=>void) {
 const [clock,setClock]=useState(()=>new Date()),[pending,setPending]=useState<string[]>([]),inFlight=useRef(new Set<string>()),current=useRef({state,date,update});current.current={state,date,update};
 useEffect(()=>{const tick=()=>{if(document.visibilityState==='visible')setClock(new Date());};const timer=setInterval(tick,60000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
 const report=homeReport(state,date,clock.getHours()),key=briefKey(date,report.phase),signature=homeSignature(state,date,report.phase),record=state.homeBriefs?.find(r=>briefKey(r.date,r.phase)===key);
 const adventure=companion(state,report,record?.focusId),stale=!!record?.brief&&record.briefSignature!==signature;
 const isAi=!!record?.brief&&record.focusId===adventure.focus.id&&(record.gameMode??true)===adventure.game&&!adventure.priority&&!stale;
 const advice=isAi?record!.brief!:adventure.fallback;
 async function refresh(mode:'manual'|'auto'|'stale'='manual') {
  const automatic=mode!=='manual';
  const {state:s,date:d,update:save}=current.current,hour=new Date().getHours(),facts=homeReport(s,d,hour),k=briefKey(d,facts.phase);
  if(inFlight.current.has(k)||!online||!ready||(automatic&&(!autoBriefOn(s.settings)||d!==today()||document.visibilityState!=='visible'||(mode==='auto'?!!s.homeBriefs?.some(r=>briefKey(r.date,r.phase)===k):!staleRefreshAllowed(s.homeBriefs?.find(r=>briefKey(r.date,r.phase)===k),homeSignature(s,d,facts.phase))))))return;
  const id=crypto.randomUUID(),sig=homeSignature(s,d,facts.phase),at=new Date().toISOString(),previous=s.homeBriefs?.find(r=>briefKey(r.date,r.phase)===k);
  const selected=companion(s,facts,previous?.focusId);
  inFlight.current.add(k);setPending(p=>[...p,k]);
  save(v=>({...v,homeBriefs:[...(v.homeBriefs??[]).filter(r=>briefKey(r.date,r.phase)!==k),{...previous,id,date:d,phase:facts.phase,attemptedAt:at,error:undefined,focusId:selected.focus.id,gameMode:selected.game,brief:previous?.focusId===selected.focus.id?previous.brief:undefined,companionVersion:COMPANION_VERSION,...(mode==='stale'?{autoRefreshes:(previous?.autoRefreshes??0)+1}:{})}].slice(-90)}));
  try {
   const r=await askAi('brief','相棒として、今回の発見と一手を。最近と同じ説明を繰り返さず、選ばれた話題を具体的に深めてください。', {date:d,dayType:s.contexts[d],settings:{ldl:s.settings.ldl,backPain:s.settings.backPain,coachMode:s.settings.coachMode,gameMode:s.settings.gameMode,training:s.settings.training},today:todaySummary(s,d),homeReport:facts,companion:selected});
   if(!validAdvice(r.brief))throw new Error('AIのアドバイスを読み取れませんでした。記録からの提案を使えます。');
   save(v=>({...v,homeBriefs:applyBrief(v.homeBriefs??[],id,{brief:r.brief!,signature:sig,at:new Date().toISOString()})}));
  }catch(e){save(v=>({...v,homeBriefs:applyBrief(v.homeBriefs??[],id,{error:(e instanceof Error?e.message:'AIに接続できませんでした').slice(0,1000)})}));}
  finally {inFlight.current.delete(k);setPending(p=>p.filter(x=>x!==k));}
 }
 // Records and the visible minute clock trigger a rate-limited refresh without requiring navigation.
 useEffect(()=>{if(active&&ready&&online&&autoBriefOn(state.settings))void refresh('stale');},[active,ready,online,signature,clock,autoBriefOn(state.settings)]);
 useEffect(()=>{if(active&&ready&&online&&autoBriefOn(state.settings))void refresh('auto');},[active,ready,online,autoBriefOn(state.settings),date,report.phase,clock]);
 return {report,record,adventure,advice,isAi,busy:pending.includes(key),stale,refresh:()=>refresh('manual')};
}
