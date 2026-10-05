import {Award,Flame,Sparkles,Target,TrendingDown} from 'lucide-react';
import type {AppState} from './types';
import {today} from './domain';
import {goalName} from './planning';
import {goalSuggestions,progressSummary,type Verdict} from './progress';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
const verdicts:Record<Verdict,{title:string;tone:string}>={
 reached:{title:'目標に到達しました！',tone:'good'},
 ahead:{title:'予定より速いペースで順調！',tone:'good'},
 onTrack:{title:'順調です。このままで大丈夫',tone:'good'},
 behind:{title:'予定より少しゆっくり',tone:'warn'},
 tooFast:{title:'減り方が速め。体調を優先して',tone:'warn'},
 early:{title:'いいスタートです',tone:'good'},
 none:{title:'記録を続けると、ペースを判定します',tone:''},
};

// The first thing on the progress tab: how far, whether on track, and what to change.
export function ProgressHero({state,update,notify,consult,editPlan}:{state:AppState;update:(fn:(s:AppState)=>AppState)=>void;notify:(t:string)=>void;consult:(q:string)=>void;editPlan:()=>void}) {
 const date=today(),p=progressSummary(state,date);
 if(!p)return null;
 const v=verdicts[p.verdict],suggestions=goalSuggestions(state,date);
 const apply=(s:ReturnType<typeof goalSuggestions>[number])=>{if(!window.confirm(`${s.label}。よろしいですか？\n${s.detail}`))return;update(x=>({...x,settings:{...x.settings,...(s.kind==='target'?{targetWeight:s.value as number}:{deadline:s.value as string})}}));notify('目標を更新しました。食事目標も自動で調整されます');};
 return <section className="card progress-hero" aria-label="これまでの成果">
  <div className="section-heading"><h2><Award size={19}/>{goalName(state.settings)}への道のり</h2><span className="pill">残り {p.daysLeft}日</span></div>
  <div className="hero-loss"><span>開始 {p.start}kg から</span><strong className={p.lost>0?'good':''}>{p.lost>0?'−':p.lost<0?'+':'±'}{Math.abs(p.lost).toFixed(1)}<small> kg</small></strong><small>{p.averaged?'朝の7日平均':'最新の朝の体重'} {p.current.toFixed(1)}kg</small></div>
  <div className="goal-progress" role="img" aria-label={`目標までの達成率${p.pct}%`}><span style={{width:`${p.pct}%`}}/></div>
  <div className="goal-progress-labels"><span>{p.pct}% 達成</span><span>目標 {p.target}kg まで あと {p.remaining.toFixed(1)}kg</span></div>
  <div className={`verdict ${v.tone}`}><strong>{v.title}</strong>{p.pace?<span>実際のペース 週{p.pace.kgPerWeek>=0?'−':'+'}{Math.abs(p.pace.kgPerWeek).toFixed(2)}kg{p.pace.basis==='early'?'（記録初期の目安）':''}{p.needed!==null&&p.verdict!=='reached'?` ／ 必要なペース 週−${p.needed.toFixed(2)}kg`:''}</span>:<span>朝の体重が数日分たまると、実際のペースと比べます。</span>}{p.atPace!==null&&p.verdict!=='reached'?<span>このペースなら目標日に約 {p.atPace.toFixed(1)}kg</span>:null}</div>
  <div className="hero-stats">
   <div><Flame size={16}/><span>連続記録</span><strong>{p.streak}<small> 日</small></strong></div>
   <div><TrendingDown size={16}/><span>累計の赤字（確定{p.ledger.days}日）</span><strong>{fmt(p.ledger.deficit)}<small> kcal</small></strong><small>≈ 脂肪 {Math.max(0,p.ledger.kg).toFixed(1)}kg 分</small></div>
   <div><Target size={16}/><span>自己ベスト</span><strong>{p.lowest!==null?p.lowest.toFixed(1):'—'}<small> kg</small></strong></div>
  </div>
  <div className="milestones" aria-label="マイルストーン">{Array.from({length:Math.max(1,Math.ceil(p.start-p.target))},(_,i)=>i+1).slice(0,10).map(n=><span key={n} className={n<=p.milestone?'done':''}>−{n}kg{n<=p.milestone?' ✓':''}</span>)}</div>
  {p.nextMilestone!==null&&p.verdict!=='reached'?<p className="muted">次の目標：あと {p.toNext.toFixed(1)}kg で −{p.nextMilestone}kg（7日平均）</p>:null}
  {suggestions.length?<div className="goal-tune"><span className="eyebrow lime"><Sparkles size={14}/>目標の見直し</span>{suggestions.map(s=><button key={s.label} className="secondary" onClick={()=>apply(s)}><span><strong>{s.label}</strong><small>{s.detail}</small></span></button>)}</div>:null}
  <div className="hero-actions"><button className="text-button" onClick={editPlan}>目標・期限を細かく編集</button><button className="text-button" onClick={()=>consult('これまでの体重とカロリー収支の推移を振り返って、よかった点と、次の1週間で変えるとよいことを教えて')}><Sparkles size={14}/>AIと振り返る</button></div>
 </section>;
}
