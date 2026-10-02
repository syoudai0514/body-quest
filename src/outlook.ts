import type {AppState,CaloriePolicy} from './types';
import {daysBetween,offsetDate,today} from './domain';
import {basal,KCAL_PER_KG,profileOf,weightAt} from './energy';
import {caloriesFor,intakeBounds,planReady,policyOf} from './planning';

const HORIZON=3660;
// Compare model assumptions; none of these paths measures a biological limit.
export function goalOutlook(state:AppState,asOf=today()) {
 if(!planReady(state.settings))return null;
 const s=state.settings,p=profileOf(s),startDate=asOf>s.startDate?asOf:s.startDate;
 const current=weightAt(state,asOf),target=s.targetWeight!;
 const remainingDays=Math.max(0,daysBetween(startDate,s.deadline));
 const days=Math.min(HORIZON,remainingDays),planned=p.exerciseMode==='separate'?p.weeklyExerciseKcal/7:0;
 const alreadyReached=current<=target;
 const simulate=(policy:CaloriePolicy,kind:'bound'|'configured')=>{
  let weight=current,atDeadline=current,reachedDays:number|null=alreadyReached?0:null,blocked=false;
  const initial=intakeBounds(current,p,planned,policy);
  const limit=kind==='bound'?HORIZON:days;
  for(let i=0;i<limit;i++){
   if(kind==='bound'&&weight<=target){if(i<=days)atDeadline=weight;break;}
   const b=intakeBounds(weight,p,planned,policy);
   if(b.outOfRange&&kind==='bound'){blocked=true;break;}
   const requested=kind==='bound'?Infinity:Math.max(0,weight-target)*KCAL_PER_KG/Math.max(1,days-i);
   const intake=kind==='bound'?b.minimumCalories:s.nutritionMode==='auto'?caloriesFor(b,requested):s.kcal;
   const deficit=b.expenditure-intake;
   if(kind==='bound'&&deficit<=0){blocked=true;break;}
   weight=Math.max(30,weight-deficit/KCAL_PER_KG);
   if(kind==='bound')weight=Math.max(target,weight);
   if(weight<=target&&reachedDays===null)reachedDays=i+1;
   if(i+1<=days)atDeadline=weight;
  }
  return {policy,projected:atDeadline,loss:Math.max(0,current-atDeadline),initialCalories:kind==='bound'?initial.minimumCalories:s.nutritionMode==='auto'?null:s.kcal,
   reachedDays,date:reachedDays===null?null:offsetDate(startDate,reachedDays),blocked,
   daysBeyondDeadline:reachedDays===null?null:Math.max(0,reachedDays-remainingDays)};
 };
 const standard=simulate('standard','bound'),flexible=simulate('flexible','bound'),selected=policyOf(s);
 return {current,target,startDate,remainingDays,alreadyReached,expired:remainingDays===0,truncated:remainingDays>HORIZON,
  configured:simulate(selected,'configured'),standard,flexible,bound:selected==='flexible'?flexible:standard,
  bmr:basal(current,p),bounds:intakeBounds(current,p,planned,selected),
  note:'消費・体重変化のモデル試算。到達日も安全性も保証しない。代謝適応、水分、疾患、栄養状態は十分に反映できない。'};
}
