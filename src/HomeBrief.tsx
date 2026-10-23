import {ArrowUpRight,Check,RefreshCw,Sparkles} from 'lucide-react';
import {phaseLabel,type HomeAction} from './homeCoach';
import type {useHomeCoach} from './useHomeCoach';

export function HomeBrief({coach,online,act}:{coach:ReturnType<typeof useHomeCoach>;online:boolean;act:(a:HomeAction)=>void}) {
 const {report,record,adventure,busy,refresh,advice,isAi}=coach,{focus}=adventure;
 return <section className="home-brief" aria-label="今日の作戦">
  <div className="brief-source"><Sparkles size={16}/><span>{phaseLabel(report.phase)}の相棒</span><span>{isAi?'Gemini AI':'記録からの提案'}</span>{busy?<span role="status">更新中…</span>:null}</div>
  <h2>{advice.headline}</h2><p className="brief-summary">{advice.summary}</p>
  {focus.done?<p className="companion-done" aria-live="polite"><Check size={16}/>{focus.mission}</p>:focus.action?<button className="secondary companion-action" onClick={()=>act(focus.action!)}>{focus.action.label}<ArrowUpRight size={16}/></button>:null}
  {record?.error?<div className="brief-error"><p className="error" role="alert">{record.error} 記録からの提案は使えます。</p><button className="text-button" disabled={busy||!online} onClick={refresh}><RefreshCw size={14}/>AIに再接続</button></div>:null}
 </section>;
}
