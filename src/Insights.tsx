import {BarChart3,Download,Flame} from 'lucide-react';
import type {AppState} from './types';
import {coaching,morningAverage,offsetDate,today,totals} from './domain';
import {energyLedger} from './energy';
const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
function weekStats(state:AppState,end:string) {
 const from=offsetDate(end,-6),ledger=energyLedger(state,7,end),count=ledger.completed.length;
 const proteins=ledger.completed.map(r=>totals(state.meals.filter(m=>m.date===r.date)).protein);
 const avg=morningAverage(state.weights,end);
 return {from,count,avgWeight:avg&&avg.count>=3?avg.value:null,intake:count?ledger.intake/count:null,deficit:count?ledger.deficit:null,
  proteinHits:proteins.filter(p=>p>=state.settings.protein).length,recorded:new Set(state.meals.filter(m=>m.date>=from&&m.date<=end).map(m=>m.date)).size,
  exercise:state.exercises.filter(e=>e.date>=from&&e.date<=end).reduce((a,e)=>a+e.minutes,0),mornings:avg?.count??0};
}
const delta=(a:number|null,b:number|null,digits=1,unit='')=>a===null||b===null?null:`${a-b>0?'+':''}${(a-b).toFixed(digits)}${unit}`;
// This week against the previous one, with what went well and one next step.
export function WeeklyInsights({state}:{state:AppState}) {
 const end=today(),w=weekStats(state,end),prev=weekStats(state,offsetDate(end,-7));
 const wins=[w.recorded>=6?`食事を${w.recorded}/7日記録`:null,w.mornings>=5?`朝の体重を${w.mornings}日測定`:null,w.proteinHits>=4?`たんぱく質目標を${w.proteinHits}日達成`:null,w.exercise>=60?`運動 ${w.exercise}分`:null,w.avgWeight!==null&&prev.avgWeight!==null&&w.avgWeight<prev.avgWeight?`平均体重が${(prev.avgWeight-w.avgWeight).toFixed(1)}kg減`:null,w.deficit!==null&&w.deficit>0?`確定日の赤字 ${fmt(w.deficit)}kcal`:null].filter(Boolean) as string[];
 const next=w.count<w.recorded?'食事を記録した日は「今日の記録を完了」で収支を確定すると、振り返りが正確になります。':w.mornings<4?'朝の体重を週4日以上測ると、平均で正しく判断できます。':w.proteinHits<3&&w.count>=3?'たんぱく質を1食20〜40g意識すると、筋肉を守りながら減量できます。':w.exercise<60?'週2回の短い筋トレを入れると、体組成が良くなりやすいです。':coaching(state,end)[0];
 const rows:[string,string,string|null][]=[
  ['朝の平均体重',w.avgWeight!==null?`${w.avgWeight.toFixed(1)}kg`:'—',delta(w.avgWeight,prev.avgWeight,1,'kg')],
  ['確定日の平均摂取',w.intake!==null?`${fmt(w.intake)}kcal`:'—',delta(w.intake,prev.intake,0,'kcal')],
  ['確定日の赤字合計',w.deficit!==null?`${fmt(w.deficit)}kcal`:'—',null],
  ['運動',`${w.exercise}分`,delta(w.exercise,prev.exercise,0,'分')],
 ];
 return <section className="card weekly-insights"><div className="section-heading"><h2><BarChart3 size={19}/>今週の振り返り</h2><span className="pill">直近7日 / 前週比</span></div>
  <div className="week-table">{rows.map(([label,value,d])=><div key={label}><span>{label}</span><strong>{value}</strong><small>{d?`前週比 ${d}`:''}</small></div>)}</div>
  <div className="plan-stats two"><div><span>食事を記録した日</span><strong>{w.recorded}<small> / 7日</small></strong></div><div><span>たんぱく質目標達成</span><strong>{w.proteinHits}<small> / {w.count}確定日</small></strong></div></div>
  {wins.length?<div className="wins"><span className="eyebrow lime">今週よかったこと</span><ul>{wins.map(x=><li key={x}>✓ {x}</li>)}</ul></div>:null}
  <p className="tip-line"><Flame size={16}/>次の一手：{next}</p>
 </section>;
}
export function exportCsv(state:AppState) {
 const quote=(value:unknown)=>'"'+String(value??'').replaceAll('"','""').replace(/^\s*[=+@-]/,"'$&")+'"';
 const rows=[['日付','食事','食品名','kcal','たんぱく質g','脂質g','炭水化物g','推定','記録完了'],...state.meals.map(m=>[m.date,m.slot,m.name,m.kcal,m.protein,m.fat,m.carbs,m.estimated?'目安':'表示値',state.closedDays?.[m.date]?'完了':'未完了'])];
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`body-quest-meals-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function CsvButton({state}:{state:AppState}) {return <button className="secondary" disabled={!state.meals.length} onClick={()=>exportCsv(state)}><Download size={17}/>食事記録をCSVで出力</button>;}
