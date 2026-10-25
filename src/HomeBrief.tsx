import {ArrowUpRight,Check,RefreshCw,Sparkles} from 'lucide-react';
import {phaseLabel,type HomeAction} from './homeCoach';
import type {useHomeCoach} from './useHomeCoach';

export function HomeBrief({coach,online,act,discuss}:{coach:ReturnType<typeof useHomeCoach>;online:boolean;act:(a:HomeAction)=>void;discuss:(q:string)=>void}) {
 const {report,record,adventure,busy,refresh,advice,isAi}=coach,{focus}=adventure;
 return <section className="home-brief" aria-label="今日の作戦">
  <div className="brief-source"><Sparkles size={16}/><span>{phaseLabel(report.phase)}の相棒</span><span>{isAi?'Gemini AI':'記録からの提案'}</span>{busy?<span role="status">更新中…</span>:null}</div>
  <h2>{advice.headline}</h2><p className="brief-summary">{advice.summary}</p>
  <button className="text-button overview-discuss" onClick={()=>discuss('全体の作戦について、今の記録に合わせて優先順位と具体的な行動を教えて')}>全体の作戦を相談</button>
  <div className="advice-themes" aria-label="テーマ別のコメント">{['食事','運動・回復','体重・計画'].map((theme,i)=>{const tip=advice.tips[i]?.replace(/^[^：:]{1,12}[：:]\s*/, '')??'このテーマについて、記録をもとに一緒に考えましょう。';return <button key={theme} className="advice-theme" onClick={()=>discuss(`${theme}について、このコメント「${tip}」を今の記録に合う具体的な提案にして。`)}><strong>{theme}<ArrowUpRight size={15}/></strong><span>{tip}</span><small>{theme}を詳しく相談</small></button>;})}</div>
  {focus.done?<p className="companion-done" aria-live="polite"><Check size={16}/>{focus.mission}</p>:focus.action?<button className="secondary companion-action" onClick={()=>act(focus.action!)}>{focus.action.label}<ArrowUpRight size={16}/></button>:null}
  {!record?.error?<button className="text-button companion-refresh" disabled={busy||!online} onClick={refresh}><RefreshCw size={14} className={busy?'spin':''}/>{busy?'AIが考えています…':!online?'オフラインのためAIは使えません':isAi?'AIで再判定':'AIで今の記録から作る'}</button>:null}
  {record?.error?<div className="brief-error"><p className="error" role="alert">{record.error} 記録からの提案は使えます。</p><button className="text-button" disabled={busy||!online} onClick={refresh}><RefreshCw size={14}/>AIに再接続</button></div>:null}
 </section>;
}
