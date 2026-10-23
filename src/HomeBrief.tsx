import {ArrowUpRight,Check,Compass,RefreshCw,Shuffle,Sparkles,Sun,Moon,Sunset} from 'lucide-react';
import type {AppState} from './types';
import {autoBriefOn,phaseLabel,type HomeAction} from './homeCoach';
import type {useHomeCoach} from './useHomeCoach';

export function HomeBrief({coach,state,online,update,act,discuss}:{coach:ReturnType<typeof useHomeCoach>;state:AppState;online:boolean;update:(fn:(s:AppState)=>AppState)=>void;act:(a:HomeAction)=>void;discuss:(q:string)=>void}) {
 const {report,record,adventure,busy,stale,refresh,another}=coach,{focus,game}=adventure;
 const ai=!!record?.brief&&record.focusId===focus.id&&(record.gameMode??true)===game&&!adventure.priority;
 const brief=ai?record!.brief!:adventure.fallback,Icon=report.phase==='morning'?Sun:report.phase==='afternoon'?Sunset:Moon;
 return <section className="card home-brief" aria-label="今日の作戦">
  <div className="brief-top"><span className="eyebrow"><Compass size={16}/>{game?'QUEST COMPANION':'YOUR NEXT MOVE'}</span><span className="phase-badge"><Icon size={15}/>{phaseLabel(report.phase)}の作戦</span></div>
  <div className="companion-meta"><span className="companion-theme">{focus.theme}</span>{game?<span className="companion-xp" aria-label={`この日は${adventure.xp}XP獲得`}>Lv.{adventure.level} · この日 +{adventure.xp} XP</span>:null}</div>
  <div className="brief-source"><span className={ai?'ai-dot':'record-dot'}/>{ai?'Gemini AI':'記録からの提案'}{ai&&record?.generatedAt?` · ${new Date(record.generatedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`:''}{stale&&ai?<span className="stale-badge">記録が変わりました</span>:null}</div>
  <h2>{brief.headline}</h2><p className="brief-summary">{brief.summary}</p>
  <div className={`companion-mission ${focus.done?'is-done':''}`} aria-live="polite">
   <div className="mission-heading"><span>{game?'今回のクエスト':'今回の一歩'}</span>{focus.done?<span><Check size={14}/>記録で達成</span>:null}</div>
   <strong>{focus.mission}</strong>
   <button className="text-button" onClick={()=>focus.action?act(focus.action):discuss(focus.question)}>{focus.done?'記録を振り返る':focus.action?.label??'回復を相談する'}<ArrowUpRight size={16}/></button>
  </div>
  <div className="brief-bottom"><button className="secondary" disabled={busy||!!adventure.priority} onClick={another}><Shuffle size={15}/>別の視点</button><button className="text-button" onClick={()=>discuss(focus.question)}><Sparkles size={15}/>この作戦を相談</button></div>
  <details className="brief-evidence"><summary>記録の根拠・ほかの行動</summary>
   <p className="muted">{focus.fact}</p>
   <div className="brief-stats"><div><span>朝の7日平均</span><strong>{report.average?`${report.average.kg.toFixed(1)}`:'—'}<small> kg</small></strong><small>{report.average?`${report.average.days}/7日記録`:'朝の記録で表示'}</small></div><div><span>1週間後の平均目安</span><strong>{report.forecast!==null?report.forecast.toFixed(1):report.early?report.early.kg.toFixed(1):'—'}<small> kg</small></strong><small>{report.forecast!==null?'直近の傾向が続く場合':report.early?'計画どおりの場合（暫定）':report.tooFast?'ペースと体調を確認':'朝の記録で表示'}</small></div></div>
   <button className="weekly-brief" onClick={()=>act({kind:'plan',date:report.date,label:'',detail:''})}>今週の食事予算 <strong>{report.weekly.missing?`${report.weekly.missing}日分が未確定`:report.weekly.suggestedKcal?`1日約${report.weekly.suggestedKcal.toLocaleString()}kcalの目安`:'計画で収支を確認'}</strong><ArrowUpRight size={14}/></button>
   <div className="brief-actions">{report.actions.map((a,i)=><button key={`${a.kind}-${a.date}-${a.time??a.slot??''}`} onClick={()=>act(a)}><span className="action-number">0{i+1}</span><span><strong>{a.label}</strong><small>{a.detail}</small></span><ArrowUpRight size={17}/></button>)}</div>
  </details>
  {stale&&ai?<p className="muted brief-notice">AIの文章は更新前の記録に基づきます。クエストの達成・数字は現在の記録です。</p>:null}
  {record?.error?<p className="error" role="alert">{record.error} 記録からの作戦も使えます。自動では再試行しません。</p>:null}
  <details className="brief-details"><summary>ヒントとAIの更新設定</summary><ul>{brief.tips.map((t,i)=><li key={i}>{t}</li>)}</ul><label className="check"><input type="checkbox" checked={autoBriefOn(state.settings)} onChange={e=>update(s=>({...s,settings:{...s.settings,homeAiAuto:e.target.checked}}))}/>朝昼晩に自動更新</label><p className="muted">朝・昼・夜にアプリを開くと、その時間の作戦を作ります。設定・記録の要約・最近7日間の作戦（最大6件）をGoogle Geminiへ送ります。閉じている間の通知はありません。「別の視点」は通信なしで使えます。</p></details>
  <button className="text-button companion-refresh" disabled={busy||!online} onClick={refresh}><RefreshCw size={14} className={busy?'spin':''}/>{busy?'AIが作戦を考えています…':record?.brief?'AIで再判定':'AIで今日の作戦を作る'}</button>
 </section>;
}
