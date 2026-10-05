import {Check,ChevronRight,Dumbbell,ShieldCheck,Sparkles,TrendingDown,Utensils} from 'lucide-react';
import type {AppState,Weight} from './types';
import {morningAverage,today,totals,trend} from './domain';
import {planReady} from './planning';
import {proteinStatus} from './history';
import {recommendMenu,trainingWeek} from './training';
import {EnergyTeaser} from './EnergyPlan';
import {QuickWeight} from './QuickLog';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
type Go=(page:'meals'|'training'|'progress'|'coach'|'settings')=>void;

// The home screen only answers "what's left today" and routes to the tab that does the work.
export function TodayHub({state,date,slot,context,go,consult,saveWeight,openWeight}:{state:AppState;date:string;slot:string;context:string;go:Go;consult:(q:string)=>void;saveWeight:(w:Weight)=>void;openWeight:()=>void}) {
 const s=state.settings,ready=planReady(s),meals=state.meals.filter(m=>m.date===date),n=totals(meals),left=s.kcal-n.kcal,p=proteinStatus(state,date);
 const workout=recommendMenu(state,date,context,false),week=trainingWeek(state,date),trained=state.exercises.some(e=>e.date===date);
 const average=morningAverage(state.weights,today()),change=trend(state.weights,today());
 const tiles=[
  {id:'meals' as const,icon:Utensils,title:`${slot}を記録`,sub:meals.length?`${[...new Set(meals.map(m=>m.slot))].join('・')} 記録済み`:'履歴からワンタップ',done:meals.length>0},
  {id:'training' as const,icon:Dumbbell,title:trained?'運動 記録済み':workout.menu.name,sub:`今週の筋トレ ${week.strengthDays}/${week.target}〜3回`,done:trained},
  {id:'progress' as const,icon:TrendingDown,title:average?`7日平均 ${average.value.toFixed(1)}kg`:'経過と計画',sub:change?`前週比 ${change.change>0?'+':''}${change.change.toFixed(1)}kg`:'朝の記録で傾向を表示',done:false},
 ];
 return <>
  <QuickWeight key={date+(state.weights.find(w=>w.date===date&&w.time==='朝')?.kg??'')} state={state} date={date} save={saveWeight} openFull={openWeight}/>
  {!ready?<EnergyTeaser state={state} open={()=>go('progress')}/>:null}
  <section className="card today-left"><div className="section-heading"><h2>今日の残り</h2><button className="pill goal-link" onClick={()=>go('progress')}>{ready?`${s.nutritionMode==='auto'?'自動目標':'目標'} ${fmt(s.kcal)} kcal`:'目標を設定'}</button></div>
   <div className="left-grid">
    <div><span>{left>=0?'カロリー':'超過'}</span><strong className={left<0?'over':''}>{fmt(Math.abs(left))}<small> kcal</small></strong><div className="bar"><span className="bar-kcal" style={{width:`${Math.min(100,n.kcal/(s.kcal||1)*100)}%`}}/></div></div>
    <div><span>たんぱく質</span><strong>{p.remaining>0?fmt(p.remaining):'達成'}<small>{p.remaining>0?' g':''}</small></strong><div className="bar"><span className="bar-protein" style={{width:`${p.ratio*100}%`}}/></div></div>
   </div>
  </section>
  <nav className="today-tiles" aria-label="記録へ移動">{tiles.map(t=><button key={t.id} className="today-tile" onClick={()=>go(t.id)}><span className={`tile-icon ${t.done?'done':''}`}>{t.done?<Check size={18}/>:<t.icon size={18}/>}</span><span><strong>{t.title}</strong><small>{t.sub}</small></span><ChevronRight size={18}/></button>)}
   <button className="today-tile" onClick={()=>consult(p.remaining>0?`残り${fmt(Math.max(0,left))}kcalで、たんぱく質をあと${fmt(p.remaining)}g取れる次の食事を提案して`:'今日の食事と運動を振り返って、明日の改善点を教えて')}><span className="tile-icon"><Sparkles size={18}/></span><span><strong>コーチに相談</strong><small>{p.remaining>0?'残りで何を食べる？':'今日の振り返り'}</small></span><ChevronRight size={18}/></button>
  </nav>
  {!state.lastBackup?<div className="backup-reminder"><ShieldCheck size={18}/><span>記録はこの端末だけに保存。定期的にバックアップを。</span><button className="text-button" onClick={()=>go('settings')}>設定</button></div>:null}
 </>;
}
