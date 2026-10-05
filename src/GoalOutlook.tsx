import type {AppState} from './types';
import {goalOutlook} from './outlook';
import {nutritionPlan} from './planning';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
export function GoalOutlook({state,onDeadline,onTarget}:{state:AppState;onDeadline?:(date:string)=>void;onTarget?:(weight:number)=>void}) {
 const o=goalOutlook(state);if(!o)return null;
 const n=nutritionPlan(state),bound=o.bound;
 const deficitGap=n?Math.max(0,n.requested-Math.max(0,o.bounds.expenditure-o.bounds.minimumCalories)):0;
 const targetCandidate=Math.ceil(bound.projected*10)/10;
 return <section className="goal-outlook" aria-label="目標の実現性" aria-live="polite">
 <h3>この条件で、どこまで届く？</h3>
 <div className="outlook-stats"><div><span>現在の設定で目標日の試算</span><strong>{o.configured.projected.toFixed(1)}<small> kg</small></strong><p>{state.settings.nutritionMode==='auto'?'体重と残り日数に合わせて再計算':'手動の食事目標を維持'}した場合。</p></div><div><span>選択モードの制限内で減量を最大化</span><strong>{bound.projected.toFixed(1)}<small> kg</small></strong><p>今の{ o.current.toFixed(1)}kgから、モデル上は約{bound.loss.toFixed(1)}kg減まで。実際の限界値ではありません。</p></div></div>
 {o.alreadyReached?<p>記録上は目標体重に到達しています。減量を強めず、維持と体調を確認しましょう。</p>:o.expired?<p className="plan-warning">目標日を迎えています。これからの目標日に変更すると、残り期間の比較ができます。</p>:o.onTrack?<p className="plan-good">目標日までに、モデル上ほぼ目標どおりに届く見込みです（差{Math.max(0,bound.projected-o.target).toFixed(2)}kg）。体重計の日々の変動より小さい差なので、このままの計画で大丈夫です。</p>:deficitGap>0?<p className="plan-warning">期限どおりの目標に必要な赤字と、このモードでの上限には約{fmt(deficitGap)} kcal / 日の差があります。今の期限に合わせて制限を強める設定にはしていません。</p>:<p className="muted">入力された期限の中で、アプリの設定範囲に沿う計画を検討できる試算です。</p>}
 <div className="timeline-card"><span>目標 {o.target}kgまでの期間の目安</span><strong>{bound.reachedDays===0?'すでに到達':o.onTrack?'目標日ごろに到達の見込み':bound.reachedDays!==null?`少なくともモデル上 ${bound.reachedDays}日`:'この条件では到達日を推定できません'}</strong>{o.onTrack?<p>モデル上の到達は{bound.date?bound.date.replaceAll('-','.'):'目標日'}ごろ。目標日との差は誤差の範囲です。</p>:bound.date&&bound.reachedDays!==0?<p>{bound.date.replaceAll('-','.')} 頃からが候補。{bound.daysBeyondDeadline!>0?`現在の目標日より約${bound.daysBeyondDeadline}日後です。`:'現在の目標日までの範囲です。'}実際には余裕を持った日程を検討してください。</p>:bound.reachedDays===null?<p>摂取量の下限と推定消費の関係、または10年以内の試算範囲では目標に届きません。活動量の見積もり・目標体重を見直し、必要に応じて医療者に相談してください。</p>:null}<p className="muted">これはアプリの減量ペース上限から計算した候補日です。「これより短いと必ず健康を害する」「この日数なら安全」とは判定できません。</p></div>
 <details className="outlook-comparison"><summary>通常モードと詳細調整を比較する</summary><div className="ledger-scroll"><table><thead><tr><th>計算条件</th><th>目標日の体重</th><th>目標までの期間</th></tr></thead><tbody>{[{label:'通常 · 基礎代謝以上',model:o.standard},{label:'詳細調整 · 基礎代謝未満を含む',model:o.flexible}].map(row=><tr key={row.label}><th>{row.label}</th><td>{row.model.projected.toFixed(1)}kg</td><td>{row.model.reachedDays===null?'推定不可':`${row.model.reachedDays}日`}</td></tr>)}</tbody></table></div><p className="muted">詳細調整でも1,600kcal未満と、推定消費20%・体重0.75%/週を超える赤字は自動設定しません。基礎代謝との大小だけで安全性は判断できません。</p></details>
 <div className="outlook-actions">{onDeadline&&!o.onTrack&&bound.date&&bound.daysBeyondDeadline!>0?<button type="button" className="secondary" onClick={()=>onDeadline(bound.date!)}>この目安の日付に変更</button>:null}{onTarget&&!o.onTrack&&!o.expired&&!o.alreadyReached&&targetCandidate<o.current&&targetCandidate>o.target?<button type="button" className="secondary" onClick={()=>onTarget(targetCandidate)}>目標を{targetCandidate.toFixed(1)}kgに変更</button>:null}</div>
 <details className="outlook-method"><summary>試算の前提と限界</summary><p className="muted">日ごとに体重と基礎代謝を再計算し、設定した活動量・予定運動が続く前提で比較します。基礎代謝はMifflin–St Jeor式、体重変化は7,700kcal/kgの概算。活動量・代謝適応・水分変動・病歴・栄養状態の個人差を十分に反映できないため、到達体重・期間・健康への影響は保証できません。</p><p className="muted"><a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noreferrer">NIDDK：体重計画の個人差</a> · <a href="https://www.nice.org.uk/guidance/ng246/chapter/Physical-activity-and-diet" target="_blank" rel="noreferrer">NICE：低エネルギー食と専門的支援</a></p></details>
 </section>;
}
