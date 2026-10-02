import type {AppState, EnergyProfile, Settings} from './types';
import {daysBetween, morningAverage, offsetDate, today, totals} from './domain';

export const KCAL_PER_KG = 7700;
export const FOOD_TARGET_FLOOR = 1600; // App guardrail, not an individual medical prescription.
export const defaultEnergy: EnergyProfile = {age:42,height:182,sex:'male',activity:1.2,exerciseMode:'separate',weeklyExerciseKcal:0};
export const profileOf = (settings:Settings):EnergyProfile => settings.energy??defaultEnergy;
export function basal(weight:number,p:EnergyProfile) {return 10*weight+6.25*p.height-5*p.age+(p.sex==='male'?5:-161);}
export function weightAt(state:AppState,date:string) {
 const average=morningAverage(state.weights,date);
 if(average)return average.value;
 const latest=state.weights.filter(w=>w.time==='朝'&&w.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 return latest?.kg??state.settings.startWeight??88;
}
// Net energy above resting expenditure, which the baseline already contains.
export function netExercise(met:number,minutes:number,kg:number) {return Math.max(0,met-1)*kg*minutes/60;}
export function dailyEnergy(state:AppState,date:string) {
 const p=profileOf(state.settings),weight=weightAt(state,date),bmr=basal(weight,p);
 const exercise=p.exerciseMode==='separate'?state.exercises.filter(e=>e.date===date).reduce((sum,e)=>sum+(e.netKcal??0),0):0;
 return {weight,bmr,baseline:bmr*p.activity,exercise,expenditure:bmr*p.activity+exercise};
}
export function goalEnergy(state:AppState,asOf=today()) {
 const s=state.settings,p=profileOf(s),start=s.startWeight??88,target=s.targetWeight??80;
 const days=Math.max(0,daysBetween(s.startDate,s.deadline)),loss=Math.max(0,start-target),total=loss*KCAL_PER_KG;
 const required=days>0?total/days:null;
 const plannedExercise=p.exerciseMode==='separate'?p.weeklyExerciseKcal/7:0;
 const meanGoalExpenditure=basal((start+target)/2,p)*p.activity+plannedExercise;
 const arithmeticIntake=required===null?null:meanGoalExpenditure-required;
 const current=weightAt(state,asOf),remainingDays=Math.max(0,daysBetween(asOf>s.startDate?asOf:s.startDate,s.deadline));
 const remainingRequired=remainingDays>0?Math.max(0,current-target)*KCAL_PER_KG/remainingDays:null;
 let projected=current;
 for(let i=0;i<Math.min(remainingDays,3660);i++){
  const gap=basal(projected,p)*p.activity+plannedExercise-s.kcal;
  projected=Math.max(30,projected-gap/KCAL_PER_KG);
 }
 return {start,target,days,loss,total,required,arithmeticIntake,current,remainingDays,remainingRequired,projected,plannedExercise,
  aggressive:days>0&&loss/days*7>start*0.01,
  configured:s.startWeight!==null&&s.targetWeight!==null,
  currentBaseline:basal(current,p)*p.activity,weeklyLoss:days>0?loss/days*7:null};
}
export type Period = 1|7|14|30|'goal';
export function periodRange(state:AppState,period:Period,end=today()) {
 const last=offsetDate(state.settings.deadline,-1);
 const to=period==='goal'?last:(end<last?end:last);
 const from=period==='goal'?state.settings.startDate:offsetDate(to,-period+1);
 return {from:from>state.settings.startDate?from:state.settings.startDate,to};
}
export function energyLedger(state:AppState,period:Period,end=today(),actualToday=today()) {
 const range=periodRange(state,period,end),goal=goalEnergy(state,end);
 const count=Math.max(0,Math.min(3660,daysBetween(range.from,range.to)+1));
 const rows=Array.from({length:count},(_,i)=>{
  const date=offsetDate(range.from,i),mealItems=state.meals.filter(m=>m.date===date),intake=totals(mealItems).kcal;
  const closed=date<=actualToday?state.closedDays?.[date]:undefined;
  const energy=dailyEnergy(state,date);
  return {date,intake,hasEntries:mealItems.length>0,closed:!!closed,future:date>actualToday,
   expenditure:closed?.expenditure??energy.expenditure,deficit:closed?closed.expenditure-intake:null};
 });
 const completed=rows.filter(r=>r.closed),elapsed=rows.filter(r=>!r.future).length;
 const intake=completed.reduce((s,r)=>s+r.intake,0),expenditure=completed.reduce((s,r)=>s+r.expenditure,0);
 const deficit=expenditure-intake,required=(goal.required??0)*completed.length;
 return {range,rows,completed,elapsed,missing:elapsed-completed.length,intake,expenditure,deficit,required,
  gap:required-deficit,foodBudget:state.settings.kcal*completed.length,foodOver:intake-state.settings.kcal*completed.length};
}
export function mealBudget(state:AppState,date:string) {
 const target=state.settings.kcal,meals=state.meals.filter(m=>m.date===date),n=totals(meals);
 const planned=[{slot:'朝食',kcal:target*.15},{slot:'昼食',kcal:target*.35},{slot:'夕食',kcal:target*.4},{slot:'間食・飲酒',kcal:target*.1}];
 const dinner=totals(meals.filter(m=>m.slot==='夕食'&&!(m.alcoholG))).kcal;
 const beforeDinner=n.kcal-dinner;
 const allowance=target-beforeDinner-target*.1;
 const alreadySnacks=totals(meals.filter(m=>m.slot==='間食'||!!m.alcoholG)).kcal;
 const adjusted=allowance+Math.min(target*.1,alreadySnacks);
 return {planned,intake:n.kcal,dinnerLogged:dinner>0,dinnerAllowance:Math.min(target*.4,Math.max(400,adjusted)),
  insufficient:adjusted<400,remaining:target-n.kcal};
}
// Monday-Sunday food allowance. Past missing days block redistribution.
export function weeklyBudget(state:AppState,date:string,actualToday=today()) {
 const weekday=(new Date(date+'T12:00:00').getDay()+6)%7;
 const start=offsetDate(date,-weekday),end=offsetDate(start,6),todayDate=actualToday;
 const from=start>state.settings.startDate?start:state.settings.startDate;
 const to=end<state.settings.deadline?end:offsetDate(state.settings.deadline,-1);
 const n=Math.max(0,daysBetween(from,to)+1);
 const dates=Array.from({length:n},(_,i)=>offsetDate(from,i));
 const missing=dates.filter(d=>d<todayDate&&!state.closedDays?.[d]).length;
 const used=dates.filter(d=>d<=todayDate).reduce((sum,d)=>sum+totals(state.meals.filter(m=>m.date===d)).kcal,0);
 const future=dates.filter(d=>d>todayDate).length;
 const todayIncluded=dates.includes(todayDate)&&!state.closedDays?.[todayDate];
 const slots=future+(todayIncluded?1:0);
 const remaining=n*state.settings.kcal-used;
 const openTodayIntake=todayIncluded?totals(state.meals.filter(m=>m.date===todayDate)).kcal:0;
 const suggestion=slots>0?(remaining+openTodayIntake)/slots:null;
 return {from,to,days:n,missing,used,remaining,slots,suggestion,
  feasible:missing===0&&suggestion!==null&&suggestion>=FOOD_TARGET_FLOOR};
}
