import {Check,Dumbbell,Utensils} from 'lucide-react';
import type {AppState} from './types';
import {latestRecord,offsetDate,today,totals} from './domain';
import {slots} from './history';

const dayNames=['日','月','火','水','木','金','土'];
export function dayStatus(state:AppState,date:string) {
 const meals=state.meals.filter(m=>m.date===date);
 return {bySlot:slots.map(s=>{const items=meals.filter(m=>m.slot===s);return {slot:s,count:items.length,kcal:Math.round(totals(items).kcal)};}),
  mealSlots:new Set(meals.map(m=>m.slot)).size,kcal:Math.round(totals(meals).kcal),
  exercise:state.exercises.filter(e=>e.date===date),weight:!!latestRecord(state.weights,date,'朝'),closed:!!state.closedDays?.[date]};
}

// Seven days at a glance: which days have meals, exercise, a morning weight and a closed balance. Tap a day to open it.
export function WeekStrip({state,date,pick,focus='all'}:{state:AppState;date:string;pick:(d:string)=>void;focus?:'all'|'meals'|'training'}) {
 const end=date<today()?offsetDate(date,3)>today()?today():offsetDate(date,3):today();
 const days=Array.from({length:7},(_,i)=>offsetDate(end,i-6));
 return <section className="card week-strip" aria-label="この1週間の記録">
  <div className="week-strip-days">{days.map(d=>{const s=dayStatus(state,d),dow=new Date(d+'T12:00:00').getDay(),meals=s.mealSlots,full=meals>=3;return <button key={d} className={`${d===date?'selected':''} ${d>today()?'future':''}`} disabled={d>today()} onClick={()=>pick(d)} aria-label={`${d} 食事${meals}回${s.exercise.length?'・運動あり':''}${s.closed?'・確定済み':''}`}>
   <span className={`dow ${dow===0?'sun':dow===6?'sat':''}`}>{d===today()?'今日':dayNames[dow]}</span><small>{Number(d.slice(8))}</small>
   {focus!=='training'?<span className={`meal-dots ${full?'full':meals?'part':''}`} title={`食事 ${meals}回`}>{[0,1,2].map(i=><i key={i} className={i<meals?'on':''}/>)}</span>:null}
   {focus!=='meals'?<span className={`ex-mark ${s.exercise.length?'on':''}`}>{s.exercise.length?<Dumbbell size={12}/>:'·'}</span>:null}
   {focus==='all'?<span className={`close-mark ${s.closed?'on':''}`}>{s.closed?<Check size={11}/>:''}</span>:null}
  </button>;})}</div>
  <p className="week-strip-legend">{focus!=='training'?<span><i className="dot on"/>食事（3つで満タン）</span>:null}{focus!=='meals'?<span><Dumbbell size={11}/>運動</span>:null}{focus==='all'?<span><Check size={11}/>収支を確定</span>:null}</p>
 </section>;
}

// The selected day's meals by slot and its exercise, so a missing meal is obvious.
export function DayChecklist({state,date,openMeals,openTraining}:{state:AppState;date:string;openMeals:(slot:string)=>void;openTraining:()=>void}) {
 const s=dayStatus(state,date),minutes=s.exercise.reduce((a,e)=>a+e.minutes,0);
 return <div className="day-checklist">
  {s.bySlot.map(b=><button key={b.slot} className={b.count?'on':''} onClick={()=>openMeals(b.slot)}><Utensils size={13}/><span>{b.slot}</span><b>{b.count?`${b.kcal.toLocaleString()}kcal`:'未記録'}</b></button>)}
  <button className={s.exercise.length?'on':''} onClick={openTraining}><Dumbbell size={13}/><span>運動</span><b>{s.exercise.length?`${minutes}分`:'未記録'}</b></button>
 </div>;
}
