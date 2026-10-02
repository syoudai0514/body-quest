import {useState} from 'react';
import {ArrowRight,CheckCircle2,Flame,Settings2,Sparkles,Target} from 'lucide-react';
import type {AppState,Settings} from './types';
import {daysBetween,today} from './domain';
import {basal,dailyEnergy,energyLedger,FOOD_TARGET_FLOOR,goalEnergy,mealBudget,profileOf,weeklyBudget,type Period} from './energy';
import {Field} from './ui';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
const signed=(n:number)=>(n>0?'+':'')+fmt(n);
type Props={state:AppState;update:(fn:(s:AppState)=>AppState)=>void;consult:(q:string)=>void};

export function EnergyTeaser({state,open}:{state:AppState;open:()=>void}) {
 const g=goalEnergy(state);
 return <section className="card energy-teaser"><div><span className="eyebrow lime">ENERGY PLAN</span><h2>{g.start} → {g.target} kg、期限までの計画</h2><p>必要な赤字 <b>{g.required===null?'—':fmt(g.required)} kcal / 日</b>。食事目標 {fmt(state.settings.kcal)} kcalでの見通しを確認。</p></div><button className="secondary" onClick={open}>収支と計画を見る<ArrowRight size={18}/></button></section>;
}

export function MealAllocation({state,date}:{state:AppState;date:string}) {
 const b=mealBudget(state,date);
 return <section className="card meal-allocation"><div className="section-heading"><h2>朝・昼・夜の目安</h2><span className="pill">飲酒も予算に含む</span></div><div className="meal-budget-grid">{b.planned.map(p=><div key={p.slot}><span>{p.slot}</span><strong>{fmt(p.kcal)}<small> kcal</small></strong></div>)}</div>
 <p className="muted">朝15%・昼35%・夜40%・間食と飲酒10%の仮配分。朝が少なかった分は主食・たんぱく質を昼夜へ回せます。</p>
 {b.dinnerLogged?<p>夕食も記録済み。一日が終わったら、下の「記録完了」で収支を確定。</p>:b.insufficient?<p className="plan-warning">記録済みの食事で予算が少なくなっています。夕食を抜いて埋めず、魚・鶏肉・豆腐＋野菜＋適量の主食を。今日は超過する可能性を記録し、週の計画で見直しましょう。</p>:<p>記録済みの量から、夕食は <b>{fmt(b.dinnerAllowance)} kcal前後</b>を候補に。未記録の昼食・飲酒があれば先に追加してください。主食とたんぱく質を確保します。</p>}
 </section>;
}

export function CloseDay({state,date,update}:{state:AppState;date:string;update:Props['update']}) {
 const closed=!!state.closedDays?.[date],hasMeals=state.meals.some(m=>m.date===date);
 return <div className="close-day"><label className="check"><input type="checkbox" checked={closed} disabled={!hasMeals||date>today()} onChange={e=>{
  const checked=e.target.checked;
  update(s=>{const days={...s.closedDays};if(checked){const energy=dailyEnergy(s,date);days[date]={expenditure:energy.expenditure,weight:energy.weight};}else delete days[date];return {...s,closedDays:days};});
 }}/><CheckCircle2 size={18}/>この日の食事・飲酒・運動をすべて記録した</label><p className="muted">{closed?'収支を確定しました。消費の推定値を保存。食事・運動を追加・修正すると未確定に戻ります。':'一日分を記録し終えたらチェック。途中・未記録の日は赤字や黒字の判定に含めません。運動をしていない日もチェックできます。'}</p></div>;
}

export function EnergyPlan({state,update,consult}:Props) {
 const [period,setPeriod]=useState<Period>(7),[end,setEnd]=useState(today),[editing,setEditing]=useState(false);
 const goal=goalEnergy(state),ledger=energyLedger(state,period,end),daily=dailyEnergy(state,today()),p=profileOf(state.settings),week=weeklyBudget(state,today());
 const noData=ledger.completed.length===0,unsafe=goal.arithmeticIntake!==null&&goal.arithmeticIntake<FOOD_TARGET_FLOOR;
 return <div className="energy-plan"><section className="card goal-card"><div className="section-heading"><h2><Target size={20}/>目標から逆算する</h2><button className="secondary compact" onClick={()=>setEditing(!editing)} aria-expanded={editing}><Settings2 size={16}/>計画を編集</button></div>
 <div className="goal-head"><div><span>開始 → 目標</span><strong>{goal.start}<small> → </small>{goal.target}<small> kg</small></strong></div><div><span>{state.settings.deadline.slice(5).replace('-','/')} 朝まで</span><strong>{goal.days}<small> 日の計画</small></strong></div></div>
 {!goal.configured?<p className="plan-warning">88→80kgの仮計画です。「計画を編集」で保存できます。既存の記録はそのまま使います。</p>:null}
 <p className="muted">{state.settings.startDate}〜{state.settings.deadline}の前日までを計算。脂肪1kgを約7,700kcalとして、減量{goal.loss.toFixed(1)}kgを換算します。</p>
 <div className="plan-stats"><div><span>必要な赤字・合計</span><strong>{fmt(goal.total)}<small> kcal</small></strong></div><div><span>必要な赤字・1日平均</span><strong>{goal.required===null?'—':fmt(goal.required)}<small> kcal</small></strong></div><div><span>必要な赤字・7日換算</span><strong>{goal.required===null?'—':fmt(goal.required*7)}<small> kcal</small></strong></div></div>
 <div className="plan-warning"><strong>{goal.days===0?'開始日と期限を確認してください。':goal.aggressive?'この期限で目標を目指す場合、かなり速い減量です。':'必要なペースは週約'+goal.weeklyLoss?.toFixed(2)+'kg。'}</strong><p>{goal.aggressive?'目標ペースは開始体重の1%/週を超えます。脂質異常症の治療中でもあるため、8kg減をこの期限で進めるなら主治医に計画を相談してください。お腹・顔の変化には個人差があります。':'体重の水分変動を含むため、カロリー換算どおりの減量は保証できません。朝の平均体重と体調も確認します。'}</p></div>
 <div className="formula"><span>消費の推定 / 今日</span><p>基礎代謝 <b>{fmt(daily.bmr)}</b> × 日常活動係数 <b>{p.activity.toFixed(2)}</b> ＋ 追加運動 <b>{fmt(daily.exercise)}</b> ＝ <b>{fmt(daily.expenditure)} kcal</b></p><small>日常活動には移動・家事などと食事による消費を含めます。基礎代謝だけとの差ではありません。{p.exerciseMode==='included'?'係数に運動を含む設定なので、運動記録を重ねて加算しません。':'運動は安静時との差分を記録したものだけ加算します。'}</small></div>
 <div className="projection"><div><span>食事だけで目標線に合わせる単純計算</span><strong>{goal.arithmeticIntake===null?'—':fmt(goal.arithmeticIntake)}<small> kcal / 日</small></strong><p className="muted">目標に沿って体重が減る想定の平均消費から必要な赤字を引いた値。予定の追加運動も含む。</p>{unsafe?<p className="plan-warning">これは推奨摂取量ではありません。通常の自己管理用プランとして採用せず、アプリは1,600kcal未満へ自動設定しません。1,600kcalも個人に合う保証はありません。</p>:null}</div><div><span>現在の食事目標でのモデル試算</span><strong>{goal.projected.toFixed(1)}<small> kg / 期限</small></strong><p>食事 {fmt(state.settings.kcal)} kcal / 日、予定の追加運動 {fmt(goal.plannedExercise)} kcal / 日。減量に伴う基礎代謝低下も反映。</p><p className={goal.projected>goal.target+.3?'plan-warning':'muted'}>{goal.projected>goal.target+.3?'現行プランでは'+goal.target+'kgに届かない試算です。差は約'+(goal.projected-goal.target).toFixed(1)+'kg。':'モデル上は目標付近です。体調と体重平均で確認を。'}</p></div></div>
 <p className="muted">今の体重の目安 {goal.current.toFixed(1)}kgから、残り{goal.remainingDays}日の必要赤字は {goal.remainingRequired===null?'—':fmt(goal.remainingRequired)} kcal / 日。予測は計画を毎日実行した場合の計算で、実績や達成保証ではありません。消費の個人差・水分・記録誤差・代謝適応は反映しきれません。</p>
 <button className="secondary" onClick={()=>consult('目標体重と期限に対し、必要な赤字と現在の食事・運動プランを比較して。届かない場合ははっきり伝え、無理な制限や食事抜きなしで今週変える行動を3つ提案して。')}><Sparkles size={16}/>この数字でAIに相談</button>
 {editing?<PlanForm settings={state.settings} save={settings=>{update(s=>({...s,settings}));setEditing(false);}}/>:null}
 </section>
 <section className="card"><div className="section-heading"><h2><Flame size={20}/>期間で見るカロリー収支</h2><span className="pill">確定した日で比較</span></div><div className="segmented period-tabs">{([{id:1,label:'1日'},{id:7,label:'1週'},{id:14,label:'2週'},{id:30,label:'30日'},{id:'goal',label:'期限まで'}] as {id:Period;label:string}[]).map(t=><button key={t.id} className={period===t.id?'active':''} onClick={()=>setPeriod(t.id)}>{t.label}</button>)}</div>
 {period!=='goal'?<Field label="集計の最終日"><input type="date" max={today()} min={state.settings.startDate} value={end} onChange={e=>{if(e.target.value)setEnd(e.target.value);}}/></Field>:null}
 <div className="coverage"><strong>{ledger.range.from} 〜 {ledger.range.to}</strong><span>確定 {ledger.completed.length}日 / 経過 {ledger.elapsed}日 · 未確定 {ledger.missing}日</span></div>
 <div className="plan-stats"><div><span>摂取・確定日合計</span><strong>{noData?'—':fmt(ledger.intake)}<small> kcal</small></strong></div><div><span>推定消費・確定日合計</span><strong>{noData?'—':fmt(ledger.expenditure)}<small> kcal</small></strong></div><div><span>差分・赤字がプラス</span><strong className={ledger.deficit<0?'orange':'lime'}>{noData?'—':signed(ledger.deficit)}<small> kcal</small></strong></div></div>
 {noData?<p className="muted">食事画面で一日分を記録し「すべて記録した」をチェックすると、収支のグラフと評価が始まります。</p>:<><CumulativeChart ledger={ledger}/><div className="projection"><div><span>減量目標と比較 / 同じ確定日数</span><strong>{fmt(ledger.required)}<small> kcalの赤字が目標</small></strong><p className={ledger.gap>0?'plan-warning':'lime'}>{ledger.gap>0?'赤字が'+fmt(ledger.gap)+' kcal不足。目標線より遅い計算です。':'必要な赤字を'+fmt(-ledger.gap)+' kcal上回る計算です。体調と体重平均も確認。'}</p></div><div><span>食事目標と比較 / 同じ確定日数</span><strong>{fmt(ledger.foodBudget)}<small> kcalの食事予算</small></strong><p>{ledger.foodOver>0?'予算を'+fmt(ledger.foodOver)+' kcal超過。':'予算より'+fmt(-ledger.foodOver)+' kcal少なめ。'}食事予算内でも、減量目標に必要な赤字が足りるとは限りません。</p></div></div></>}
 {ledger.missing>0?<p className="plan-warning">未確定の{ledger.missing}日をゼロ摂取として埋めていません。期間全体の成果はまだ判定できません。まず記録漏れを埋めましょう。</p>:null}
 <details className="ledger-details"><summary>日別の摂取・推定消費を見る</summary><div className="ledger-scroll"><table><thead><tr><th>日付</th><th>摂取</th><th>消費</th><th>赤字</th><th>状態</th></tr></thead><tbody>{ledger.rows.map(r=><tr key={r.date}><th>{r.date.slice(5)}</th><td>{r.future?'—':r.hasEntries?fmt(r.intake):'未記録'}</td><td>{r.future?'—':fmt(r.expenditure)}</td><td>{r.deficit===null?'—':signed(r.deficit)}</td><td>{r.future?'予定':r.closed?'確定':'未確定'}</td></tr>)}</tbody></table></div></details>
 <p className="muted">消費は測定値ではなく推定です。確定時の消費値を保存するため、プロフィールの変更で過去の収支を書き換えません。開始日・目標変更時の比較線は新しい計画で再計算します。</p>
 </section>
 <section className="card"><h2>飲み会も含めた、今週の食事予算</h2><p className="muted">月曜〜日曜（目標期間内）の{week.days}日。減量目標の赤字ではなく、設定した食事目標を週で配分します。</p><div className="plan-stats"><div><span>今週の食事予算</span><strong>{fmt(week.days*state.settings.kcal)}<small> kcal</small></strong></div><div><span>ここまでの記録済み</span><strong>{fmt(week.used)}<small> kcal</small></strong></div><div><span>予算の残り</span><strong>{signed(week.remaining)}<small> kcal</small></strong></div></div>
 {week.missing>0?<p className="plan-warning">過去の未確定日が{week.missing}日あるため、残り日への再配分は保留。食事と飲酒の漏れを確認してください。</p>:week.slots===0?<p>今週の残り日はありません。超過分を翌週の断食で埋めず、通常の食事へ。</p>:week.feasible?<p>今日が未確定なら今日を含む残り{week.slots}日を、平均 <b>{fmt(week.suggestion!)} kcal / 日</b>にすると週の食事予算に収まる計算です。今日すでに食べた分もこの目安に含みます。追加で食べられる量ではありません。設定への自動反映はしません。</p>:<p className="plan-warning">残り日への均等配分は{week.suggestion===null?'—':fmt(week.suggestion)} kcal / 日となり、通常の自己管理用プランには採用しません。今週の超過は受け入れ、食事を抜かず次の食事から元の目標へ戻しましょう。</p>}
 <button className="secondary" onClick={()=>consult('飲み会・食べ過ぎの日を含め、今週の食事予算と未確定日を確認して。断食や過剰な運動をせずに、残りの日の朝昼夜と外食候補を提案して。')}><Sparkles size={16}/>今週の配分を相談</button></section>
 </div>;
}

function PlanForm({settings,save}:{settings:Settings;save:(s:Settings)=>void}) {
 const [s,setS]=useState<Settings>(()=>({...settings,startWeight:settings.startWeight??88,targetWeight:settings.targetWeight??80,energy:{...profileOf(settings)}})),[error,setError]=useState('');
 const p=profileOf(s),change=(key:keyof typeof p,value:unknown)=>setS({...s,energy:{...p,[key]:value}});
 return <form className="plan-form" onSubmit={e=>{e.preventDefault();if(daysBetween(s.startDate,s.deadline)<=0||daysBetween(s.startDate,s.deadline)>3660){setError('期限は開始日より後、10年以内で設定してください');return;}if(s.kcal<1600||s.kcal>5000){setError('食事目標は1,600〜5,000kcal。これ以下の計算値をそのまま採用しません。');return;}save(s);}}><h3>計算の条件</h3><button type="button" className="text-button" onClick={()=>setS({...s,startWeight:88,targetWeight:80})}>開始88kg → 目標80kgにする</button><div className="form-grid"><Field label="開始体重（kg）"><input type="number" min="30" max="300" step="0.1" required value={s.startWeight??''} onChange={e=>setS({...s,startWeight:Number(e.target.value)})}/></Field><Field label="目標体重（kg）"><input type="number" min="30" max="300" step="0.1" required value={s.targetWeight??''} onChange={e=>setS({...s,targetWeight:Number(e.target.value)})}/></Field><Field label="開始日"><input type="date" required value={s.startDate} onChange={e=>setS({...s,startDate:e.target.value})}/></Field><Field label="期限（この日の朝）"><input type="date" required value={s.deadline} onChange={e=>setS({...s,deadline:e.target.value})}/></Field><Field label="年齢"><input type="number" min="18" max="100" step="1" required value={p.age} onChange={e=>change('age',Number(e.target.value))}/></Field><Field label="身長（cm）"><input type="number" min="120" max="230" step="0.1" required value={p.height} onChange={e=>change('height',Number(e.target.value))}/></Field><Field label="代謝式に使う性別"><select value={p.sex} onChange={e=>change('sex',e.target.value)}><option value="male">男性</option><option value="female">女性</option></select></Field><Field label="日常活動係数"><select value={p.activity} onChange={e=>change('activity',Number(e.target.value))}><option value="1.2">1.20 · 座り仕事、活動少なめ</option><option value="1.35">1.35 · 日常の移動や立ち仕事あり</option><option value="1.5">1.50 · よく動く生活</option><option value="1.7">1.70 · 活動の多い生活</option></select></Field><Field label="運動の消費の扱い"><select value={p.exerciseMode} onChange={e=>change('exerciseMode',e.target.value)}><option value="separate">活動係数に運動を含めず、別途加算</option><option value="included">活動係数に運動込み、別途加算しない</option></select></Field><Field label="予定の追加運動（kcal / 週）"><input type="number" min="0" max="4200" step="1" disabled={p.exerciseMode==='included'} required value={p.weeklyExerciseKcal} onChange={e=>change('weeklyExerciseKcal',Number(e.target.value))}/></Field><Field label="食事目標（kcal / 日）"><input type="number" min="1600" max="5000" step="1" required value={s.kcal} onChange={e=>setS({...s,kcal:Number(e.target.value)})}/></Field></div><p className="muted">予定の追加運動は将来のモデル試算だけに使用。実績には実際の運動記録だけを使います。二重加算を避け、運動時間を増やして無理に赤字を埋めないでください。食事目標の変更後は設定画面でPFCも確認。</p><details><summary>計算式と推定の限界</summary><p>Mifflin–St Jeor式：男性は10×体重＋6.25×身長−5×年齢＋5、女性は最後が−161。生活の総消費は基礎代謝×活動係数を目安にします。現在の条件では開始時の基礎代謝は約{fmt(basal(s.startWeight??88,p))}kcalです。</p><p>7700kcal/kgは脂肪減少の粗い換算。体重は水分・塩分・消化中の食物・筋肉でも変わり、減量中の代謝適応もあります。平均体重を2週間以上記録し、消費の仮定を見直します。</p><p><a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noreferrer">NIDDK：体重計画と代謝の変化</a></p></details>{error?<p role="alert" className="error">{error}</p>:null}<button className="primary" type="submit">計画を保存</button></form>;
}

function CumulativeChart({ledger}:{ledger:ReturnType<typeof energyLedger>}) {
 let sum=0;
 const points=ledger.completed.map((r,i)=>({date:r.date,actual:sum+=r.deficit??0,target:ledger.required/ledger.completed.length*(i+1)}));
 const values=[0,...points.flatMap(p=>[p.actual,p.target])],min=Math.min(...values),max=Math.max(1,...values),width=560,height=210;
 const x=(i:number)=>58+(i+1)/(points.length+1)*(width-78),y=(v:number)=>height-35-(v-min)/(max-min)*(height-58);
 const path=(key:'actual'|'target')=>'M 58 '+y(0)+' '+points.map((p,i)=>'L '+x(i)+' '+y(p[key])).join(' ');
 return <div className="energy-chart"><h3>累積の赤字：目標線と実績</h3><svg viewBox={'0 0 '+width+' '+height} role="img" aria-label={'確定した'+points.length+'日分の累積赤字。実績'+fmt(ledger.deficit)+'kcal、目標'+fmt(ledger.required)+'kcal。'}><line x1="58" x2={width-20} y1={y(0)} y2={y(0)} stroke="#394553"/>{[min,max].map((v,i)=><text key={i} x="3" y={y(v)+4} fill="#98a7b6" fontSize="12">{fmt(v)}</text>)}<path d={path('target')} stroke="#92bbef" strokeWidth="2" fill="none" strokeDasharray="6 5"/><path d={path('actual')} stroke="#c5f563" strokeWidth="3" fill="none"/>{points.map((p,i)=><circle key={p.date} cx={x(i)} cy={y(p.actual)} r="4" fill="#c5f563"><title>{p.date}：累積赤字 {fmt(p.actual)} kcal / 目標 {fmt(p.target)} kcal</title></circle>)}<text x="58" y={height-8} fill="#98a7b6" fontSize="12">開始</text><text x={width-95} y={height-8} fill="#98a7b6" fontSize="12">{points.at(-1)?.date.slice(5)}</text></svg><div className="chart-legend"><span className="lime">● 実績（推定消費−摂取）</span><span className="blue">┄ 目標</span></div><p className="muted">横軸は確定日の順番。未確定日と将来日は省略し、同じ確定日数で比較します。マイナスは摂取が消費を超えた状態。</p></div>;
}
