import {Award,Flame,Sparkles,Target,TrendingDown} from 'lucide-react';
import type {AppState} from './types';
import {today} from './domain';
import {goalName} from './planning';
import {deficitBreakdown,goalSuggestions,progressSummary,type Verdict} from './progress';
import {gameOn} from './game';
import {BossBar} from './Game';

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
  {gameOn(state.settings)?<BossBar state={state}/>:null}
  <div className={`verdict ${v.tone}`}><strong>{v.title}</strong>{p.pace?<span>実際のペース 週{p.pace.kgPerWeek>=0?'−':'+'}{Math.abs(p.pace.kgPerWeek).toFixed(2)}kg{p.pace.basis==='early'?'（記録初期の目安）':''}{p.needed!==null&&p.verdict!=='reached'?` ／ 必要なペース 週−${p.needed.toFixed(2)}kg`:''}</span>:<span>朝の体重が数日分たまると、実際のペースと比べます。</span>}{p.atPace!==null&&p.verdict!=='reached'?<span>このペースなら目標日に約 {p.atPace.toFixed(1)}kg</span>:null}</div>
  <div className="hero-stats">
   <div><Flame size={16}/><span>連続記録</span><strong>{p.streak}<small> 日</small></strong></div>
   <div><TrendingDown size={16}/><span>累計の赤字（確定{p.ledger.days}日）</span><strong>{fmt(p.ledger.deficit)}<small> kcal</small></strong><small>≈ 脂肪 {Math.max(0,p.ledger.kg).toFixed(1)}kg 分</small></div>
   <div><Target size={16}/><span>自己ベスト</span><strong>{p.lowest!==null?p.lowest.toFixed(1):'—'}<small> kg</small></strong></div>
  </div>
  <DeficitDetails state={state}/>
  <div className="milestones" aria-label="マイルストーン">{Array.from({length:Math.max(1,Math.ceil(p.start-p.target))},(_,i)=>i+1).slice(0,10).map(n=><span key={n} className={n<=p.milestone?'done':''}>−{n}kg{n<=p.milestone?' ✓':''}</span>)}</div>
  {p.nextMilestone!==null&&p.verdict!=='reached'?<p className="muted">次の目標：あと {p.toNext.toFixed(1)}kg で −{p.nextMilestone}kg（7日平均）</p>:null}
  {suggestions.length?<div className="goal-tune"><span className="eyebrow lime"><Sparkles size={14}/>目標の見直し</span>{suggestions.map(s=><button key={s.label} className="secondary" onClick={()=>apply(s)}><span><strong>{s.label}</strong><small>{s.detail}</small></span></button>)}</div>:null}
  <div className="hero-actions"><button className="text-button" onClick={editPlan}>目標・期限を細かく編集</button><button className="text-button" onClick={()=>consult('これまでの体重とカロリー収支の推移を振り返って、よかった点と、次の1週間で変えるとよいことを教えて')}><Sparkles size={14}/>AIと振り返る</button></div>
 </section>;
}

const dow=['日','月','火','水','木','金','土'];
const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}（${dow[new Date(d+'T12:00:00').getDay()]}）`;
// The cumulative deficit is a sum of estimates; this lets it be checked against each confirmed day and against the scale.
function DeficitDetails({state}:{state:AppState}) {
 const d=deficitBreakdown(state,today()),shown=d.rows.slice(0,10),pace=(kg:number)=>`週${kg>=0?'−':'+'}${Math.abs(kg).toFixed(2)}kg`;
 if(!d.days)return <details className="deficit-details"><summary>累計の赤字について</summary><p className="muted">赤字は「推定消費 − 食べた量」を、収支を確定した日だけ足した値です。食事タブ・今日の画面の「記録を完了」で、その日を確定できます。</p></details>;
 return <details className="deficit-details"><summary>赤字の内訳を見る（確定{d.days}日）</summary>
  <p className="muted">赤字 ＝ 推定消費 − 食べた量。収支を確定した日だけを足しています（未確定の日{d.unconfirmed}日は含みません）。推定消費は、体重・身長・年齢・活動量から計算した目安です。</p>
  <table className="deficit-table"><thead><tr><th>日付</th><th>食べた量</th><th>推定消費</th><th>赤字</th></tr></thead>
   <tbody>{shown.map(r=><tr key={r.date}><td>{md(r.date)}</td><td>{fmt(r.intake)}</td><td>{fmt(r.expenditure)}</td><td className={r.deficit<0?'over':''}>{r.deficit>=0?'':'+'}{fmt(r.deficit<0?-r.deficit:r.deficit)}{r.deficit<0?'（超過）':''}</td></tr>)}</tbody>
   <tfoot><tr><th>合計{d.rows.length>shown.length?`（全${d.days}日）`:''}</th><td>{fmt(d.intake)}</td><td>{fmt(d.expenditure)}</td><td>{fmt(d.deficit)}</td></tr></tfoot></table>
  {d.rows.length>shown.length?<p className="muted">表は新しい10日分。合計は確定した全{d.days}日分です。</p>:null}
  <p className="muted">1日平均の赤字は約{fmt(d.perDay??0)}kcal。体脂肪1kgは約7,700kcalとして換算しています。</p>
  {d.check?<p className={d.check.verdict==='close'?'plan-good':'plan-warning'}>
   {d.check.verdict==='close'?`体重の実測（${pace(d.check.measured)}）は、赤字から見込まれる値（${pace(d.check.implied)}）と近い値です。`
    :d.check.verdict==='measuredFaster'?`体重の実測（${pace(d.check.measured)}）は、赤字から見込まれる値（${pace(d.check.implied)}）より大きめです。体重には水分の増減が含まれ、始めたばかりの頃は特に大きく動きます。推定消費は計算式の目安なので、よく歩く・立ち仕事などの場合、実際の消費はもっと多いかもしれません。設定の「普段の活動量」を見直せますが、食事を増やす根拠にはせず、体重の傾向と体調を見て調整してください。`
    :`体重の実測（${pace(d.check.measured)}）は、赤字から見込まれる値（${pace(d.check.implied)}）より小さめです。食事の記録漏れ・量の見積もり不足、水分の増減、推定消費が多すぎる可能性があります。`}</p>
   :<p className="muted">収支を確定した日が7日以上たまり、朝の体重がそろうと、体重の実測と赤字からの見込みを比べます。</p>}
 </details>;
}
