import {useEffect,useState,type ReactNode} from 'react';
import {Check,ChevronRight,Dumbbell,ShieldCheck,Sparkles,TrendingDown,Utensils} from 'lucide-react';
import type {AppState,Weight} from './types';
import {latestRecord,morningAverage,today,totals,trend} from './domain';
import {planReady} from './planning';
import {proteinStatus} from './history';
import {recommendMenu,trainingWeek} from './training';
import {EnergyTeaser} from './EnergyPlan';
import {QuickWeight} from './QuickLog';

const fmt=(n:number)=>Math.round(n).toLocaleString('ja-JP');
type Go=(page:'meals'|'training'|'progress'|'coach'|'settings')=>void;

export function TodayHub({state,date,slot,context,go,consult,saveWeight,openWeight,brief,chat,weightIntent}:{state:AppState;date:string;slot:string;context:string;go:Go;consult:(q:string)=>void;saveWeight:(w:Weight)=>void;openWeight:()=>void;brief:ReactNode;chat:ReactNode;weightIntent?:{date:string;time:Weight['time'];id:string}}) {
 const [time,setTime]=useState<Weight['time']>('朝');
 useEffect(()=>{if(weightIntent?.date===date){setTime(weightIntent.time);requestAnimationFrame(()=>{document.getElementById('home-weight')?.scrollIntoView({behavior:'smooth',block:'center'});});}},[weightIntent,date]);
 const s=state.settings,ready=planReady(s),meals=state.meals.filter(m=>m.date===date),n=totals(meals),left=s.kcal-n.kcal,p=proteinStatus(state,date);
 const workout=recommendMenu(state,date,context,!!state.painDates?.includes(date)),week=trainingWeek(state,date),trained=state.exercises.some(e=>e.date===date);
 const slotDone=meals.some(m=>m.slot===slot),label=date===today()?'今日':`${Number(date.slice(5,7))}/${Number(date.slice(8))}`;
 const average=morningAverage(state.weights,date),change=trend(state.weights,date);
 const tiles=[
  {id:'meals' as const,icon:Utensils,title:slotDone?`${slot} 記録済み`:`${slot}を記録`,sub:meals.length?`記録済み：${[...new Set(meals.map(m=>m.slot))].join('・')}`:'履歴・文章・写真から',done:slotDone},
  {id:'training' as const,icon:Dumbbell,title:trained?'運動 記録済み':workout.menu.name,sub:`今週の筋トレ ${week.strengthDays}/${week.target}〜3回`,done:trained},
  {id:'progress' as const,icon:TrendingDown,title:average?`7日平均 ${average.value.toFixed(1)}kg`:'経過と計画',sub:change?`前週比 ${change.change>0?'+':''}${change.change.toFixed(1)}kg`:'朝の記録で傾向を表示',done:false},
 ];
 return <>
  {brief}
  <div id="home-weight" className="home-weight"><div className="weight-switch" role="group" aria-label="朝と夜の体重">{(['朝','夜'] as const).map(t=>{const w=latestRecord(state.weights,date,t);return <button key={t} aria-pressed={time===t} className={time===t?'active':''} onClick={()=>setTime(t)}><span>{t}の体重</span><small>{w?`${w.kg.toFixed(1)}kg ✓`:'未記録'}</small></button>;})}</div><QuickWeight key={date+time+(latestRecord(state.weights,date,time)?.kg??'')} state={state} date={date} time={time} save={saveWeight} openFull={openWeight}/>{time==='夜'?<p className="muted night-weight-note">夜は食事・水分で増えやすいもの。朝とは別に保存し、減量の傾向は朝の平均で確認します。</p>:null}</div>
  {!ready?<EnergyTeaser state={state} open={()=>go('progress')}/>:null}
  <section className="card today-left"><div className="section-heading"><h2>{ready?`${label}の残り`:`${label}の記録`}</h2><button className="pill goal-link" onClick={()=>go('progress')}>{ready?`${s.nutritionMode==='auto'?'自動目標':'目標'} ${fmt(s.kcal)} kcal`:'目標を設定'}</button></div>
   {ready?<div className="left-grid">
    <div><span>{left>=0?'カロリー':'超過'}</span><strong className={left<0?'over':''}>{fmt(Math.abs(left))}<small> kcal</small></strong><div className="bar"><span className="bar-kcal" style={{width:`${Math.min(100,n.kcal/(s.kcal||1)*100)}%`}}/></div></div>
    <div><span>たんぱく質</span><strong>{p.remaining>0?fmt(p.remaining):'達成'}<small>{p.remaining>0?' g':''}</small></strong><div className="bar"><span className="bar-protein" style={{width:`${p.ratio*100}%`}}/></div></div>
   </div>:<><div className="left-grid">
    <div><span>カロリー</span><strong>{fmt(n.kcal)}<small> kcal</small></strong></div>
    <div><span>たんぱく質</span><strong>{fmt(n.protein)}<small> g</small></strong></div>
   </div><p className="muted">目標が未設定のため、残りは表示していません。記録はこのまま使えます。目標を設定すると、あなたに合わせた残りを表示します。</p></>}
  </section>
  {chat}
  <nav className="today-tiles" aria-label="記録へ移動">{tiles.map(t=><button key={t.id} className="today-tile" onClick={()=>go(t.id)}><span className={`tile-icon ${t.done?'done':''}`}>{t.done?<Check size={18}/>:<t.icon size={18}/>}</span><span><strong>{t.title}</strong><small>{t.sub}</small></span><ChevronRight size={18}/></button>)}
   <button className="today-tile" onClick={()=>consult(ready&&p.remaining>0?`残り${fmt(Math.max(0,left))}kcalで、たんぱく質をあと${fmt(p.remaining)}g取れる次の食事を提案して`:'今日の食事と運動を振り返って、明日の改善点を教えて')}><span className="tile-icon"><Sparkles size={18}/></span><span><strong>コーチに相談</strong><small>{ready&&p.remaining>0?'残りで何を食べる？':'食事と運動の相談'}</small></span><ChevronRight size={18}/></button>
  </nav>
  {!state.lastBackup?<div className="backup-reminder"><ShieldCheck size={18}/><span>記録はこの端末だけに保存。定期的にバックアップを。</span><button className="text-button" onClick={()=>go('settings')}>設定</button></div>:null}
 </>;
}
