import {BarChart3,Download,Flame} from 'lucide-react';
import type {AppState} from './types';
import {coaching,offsetDate,today,totals} from './domain';
import {energyLedger} from './energy';
const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
export function WeeklyInsights({state}:{state:AppState}) {
 const end=today(),from=offsetDate(end,-6),ledger=energyLedger(state,7,end),count=ledger.completed.length;
 const proteins=ledger.completed.map(r=>totals(state.meals.filter(m=>m.date===r.date)).protein);
 const recorded=new Set(state.meals.filter(m=>m.date>=from&&m.date<=end).map(m=>m.date)).size;
 const hits=proteins.filter(p=>p>=state.settings.protein).length;
 return <section className="card weekly-insights"><div className="section-heading"><h2><BarChart3 size={19}/>今週の振り返り</h2><span className="pill">直近7日 · 無料</span></div><div className="plan-stats"><div><span>食事を記録した日</span><strong>{recorded}<small> / 7日</small></strong></div><div><span>確定日の平均摂取</span><strong>{count?fmt(ledger.intake/count):'—'}<small> kcal</small></strong></div><div><span>たんぱく質目標達成</span><strong>{hits}<small> / {count}確定日</small></strong></div></div><p className="muted">{count?'確定した日だけを集計。たんぱく質は現在の目標と比較しています。':'食事画面で一日の記録を完了すると、平均と栄養の振り返りが表示されます。'}</p><p className="tip-line"><Flame size={16}/>{coaching(state,end)[0]}</p></section>;
}
export function exportCsv(state:AppState) {
 const quote=(value:unknown)=>'"'+String(value??'').replaceAll('"','""').replace(/^\s*[=+@-]/,"'$&")+'"';
 const rows=[['日付','食事','食品名','kcal','たんぱく質g','脂質g','炭水化物g','推定','記録完了'],...state.meals.map(m=>[m.date,m.slot,m.name,m.kcal,m.protein,m.fat,m.carbs,m.estimated?'目安':'表示値',state.closedDays?.[m.date]?'完了':'未完了'])];
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`body-quest-meals-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export function CsvButton({state}:{state:AppState}) {return <button className="secondary" disabled={!state.meals.length} onClick={()=>exportCsv(state)}><Download size={17}/>食事記録をCSVで出力</button>;}
