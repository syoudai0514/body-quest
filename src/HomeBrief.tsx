import {ArrowUpRight,RefreshCw,Sparkles,Sun,Moon,Sunset} from 'lucide-react';
import type {AppState} from './types';
import {phaseLabel,type HomeAction} from './homeCoach';
import type {useHomeCoach} from './useHomeCoach';

export function HomeBrief({coach,state,online,update,act,discuss}:{coach:ReturnType<typeof useHomeCoach>;state:AppState;online:boolean;update:(fn:(s:AppState)=>AppState)=>void;act:(a:HomeAction)=>void;discuss:(q:string)=>void}) {
 const {report,record,busy,stale,refresh}=coach,brief=record?.brief??report,Icon=report.phase==='morning'?Sun:report.phase==='afternoon'?Sunset:Moon;
 return <section className="card home-brief" aria-label="今日の作戦">
  <div className="brief-top"><span className="eyebrow"><Sparkles size={16}/>YOUR NEXT MOVE</span><span className="phase-badge"><Icon size={15}/>{phaseLabel(report.phase)}の作戦</span></div>
  <div className="brief-source"><span className={record?.brief?'ai-dot':'record-dot'}/>{record?.brief?'Gemini AI':'記録からの提案'}{record?.generatedAt?` · ${new Date(record.generatedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`:''}{stale?<span className="stale-badge">記録が変わりました</span>:null}</div>
  <h2>{brief.headline}</h2><p className="brief-summary">{brief.summary}</p>
  <div className="brief-stats"><div><span>朝の7日平均</span><strong>{report.average?`${report.average.kg.toFixed(1)}`:'—'}<small> kg</small></strong><small>{report.average?`${report.average.days}/7日記録`:'朝の記録で表示'}</small></div><div><span>1週間後の平均目安</span><strong>{report.forecast!==null?report.forecast.toFixed(1):report.early?report.early.kg.toFixed(1):'—'}<small> kg</small></strong><small>{report.forecast!==null?'直近の傾向が続く場合':report.early?'計画どおりの場合（暫定）':report.tooFast?'ペースと体調を確認':'朝の記録で表示'}</small></div></div>
  <button className="weekly-brief" onClick={()=>act({kind:'plan',date:report.date,label:'',detail:''})}>今週の食事予算 <strong>{report.weekly.missing?`${report.weekly.missing}日分が未確定`:report.weekly.suggestedKcal?`1日約${report.weekly.suggestedKcal.toLocaleString()}kcalの目安`:'計画で収支を確認'}</strong><ArrowUpRight size={14}/></button>
  <div className="brief-actions">{report.actions.slice(0,3).map((a,i)=><button key={`${a.kind}-${a.date}-${a.time??a.slot??''}`} onClick={()=>act(a)}><span className="action-number">0{i+1}</span><span><strong>{a.label}</strong><small>{a.detail}</small></span><ArrowUpRight size={17}/></button>)}</div>
  <div className="brief-bottom"><button className="secondary" disabled={busy||!online} onClick={refresh}><RefreshCw size={15} className={busy?'spin':''}/>{busy?'AIが作戦を考えています…':record?.brief?'AIで再判定':'AIで今日の作戦を作る'}</button><button className="text-button" onClick={()=>discuss('今日の作戦を、食事・運動・回復の具体的な行動にして教えて')}>作戦を相談</button></div>
  {stale?<p className="muted brief-notice">AIの文章は更新前の記録に基づきます。数字と行動ボタンは現在の記録です。再判定で文章も更新できます。</p>:null}
  {record?.error?<p className="error" role="alert">{record.error} 自動では再試行しません。</p>:null}
  <details className="brief-details"><summary>ヒントとAIの更新設定</summary><ul>{brief.tips.map((t,i)=><li key={i}>{t}</li>)}</ul><label className="check"><input type="checkbox" checked={state.settings.homeAiAuto??false} onChange={e=>update(s=>({...s,settings:{...s.settings,homeAiAuto:e.target.checked}}))}/>朝昼晩に自動更新</label><p className="muted">有効にすると、アプリを開いている朝（0〜10時）・昼（11〜16時）・夜（17〜23時）に各1回、設定と食事・体重・運動の記録をGoogle Geminiへ送ります。手動の作戦・相談ボタンでも送信します。閉じている間の通知はありません。通信できないときも記録からの提案を使えます。</p></details>
 </section>;
}
