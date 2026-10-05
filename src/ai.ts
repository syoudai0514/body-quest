import {goalOutlook} from './outlook';
import type {AppState,Draft,HomeAdvice} from './types';
import {offsetDate,today,totals} from './domain';
import {goalEnergy,energyLedger,mealBudget,weeklyBudget} from './energy';
import {mealHistory,proteinStatus,slotForHour} from './history';
import {recommendMenu,trainingWeek} from './training';
export type Turn={role:'user'|'model';text:string};
// Foods the user actually eats or registered, so the AI can reuse their values instead of guessing.
export function knownFoods(state:AppState,date:string,limit=40) {
 const custom=state.foods.filter(f=>!['基本','朝食','外食','レシピ','たんぱく質'].includes(f.category)||state.favorites?.includes(f.id)).map(f=>({name:f.name,portion:f.portion,kcal:Math.round(f.kcal),protein:+f.protein.toFixed(1),fat:+f.fat.toFixed(1),carbs:+f.carbs.toFixed(1)}));
 const history=mealHistory(state,slotForHour(new Date().getHours()),date).slice(0,limit).map(h=>({name:h.name,portion:h.quantity===1?'1回分':`${h.quantity}倍`,kcal:Math.round(h.kcal),protein:+h.protein.toFixed(1),fat:+h.fat.toFixed(1),carbs:+h.carbs.toFixed(1),timesEaten:h.count}));
 return [...custom,...history.filter(h=>!custom.some(c=>c.name===h.name))].slice(0,limit);
}
export function todaySummary(state:AppState,date:string) {
 const meals=state.meals.filter(m=>m.date===date),n=totals(meals),p=proteinStatus(state,date),ctx=state.contexts[date]??'出社',pain=!!state.painDates?.includes(date),w=recommendMenu(state,date,ctx,pain);
 return {intake:{kcal:Math.round(n.kcal),protein:Math.round(n.protein),fat:Math.round(n.fat),carbs:Math.round(n.carbs)},targets:{kcal:state.settings.kcal,protein:state.settings.protein,fat:state.settings.fat,carbs:state.settings.carbs},kcalRemaining:Math.round(state.settings.kcal-n.kcal),proteinRemaining:Math.round(p.remaining),proteinPerMeal:p.perMeal,slotsLogged:[...new Set(meals.map(m=>m.slot))],trainingThisWeek:trainingWeek(state,date),painToday:pain,suggestedWorkout:{name:w.menu.name,reason:w.reason,moves:w.menu.moves.map(m=>`${m.name} ${m.dose}`)}};
}
export function aiContext(state:AppState,date:string) {return {energyPlan:{outlook:goalOutlook(state,date),goal:goalEnergy(state,date),periods:([1,7,14,30,'goal'] as const).map(period=>{const l=energyLedger(state,period,date);return {period,range:l.range,completedDays:l.completed.length,elapsedDays:l.elapsed,missingDays:l.missing,intake:l.intake,estimatedExpenditure:l.expenditure,estimatedDeficit:l.deficit,requiredDeficitForSameCompletedDays:l.required,deficitShortfall:l.gap,foodBudgetOver:l.foodOver};}),mealAllocation:mealBudget(state,date),weeklyFoodBudget:weeklyBudget(state,date),note:'確定日だけの収支。消費は推定。未記録はゼロではない。projectedはモデル試算で実測予測ではない。'},settings:state.settings,date,dayType:state.contexts[date]??'出社',today:todaySummary(state,date),knownFoods:knownFoods(state,date,25),weights:state.weights.filter(w=>w.date>=offsetDate(today(),-20)).slice(-50),meals:state.meals.filter(m=>m.date>=offsetDate(date,-2)&&m.date<=date).slice(-50),exercises:state.exercises.filter(e=>e.date>=offsetDate(date,-14)&&e.date<=date).slice(-30)};}
export function foodAiContext(state:AppState,date:string) {return {date,settings:{kcal:state.settings.kcal,protein:state.settings.protein},knownFoods:knownFoods(state,date),todayMeals:state.meals.filter(m=>m.date===date).map(m=>({slot:m.slot,name:m.name,kcal:Math.round(m.kcal)}))};}
export type ExerciseDraft={name:string;minutes:number;met:number;details:string;note:string};
export function exerciseAiContext(state:AppState,date:string,menus:string[]) {return {date,knownMenus:menus,recentExercises:state.exercises.filter(e=>e.date>=offsetDate(date,-30)&&e.date<=date).slice(-15).map(e=>({date:e.date,name:e.name,minutes:e.minutes,met:e.met??null,details:e.details.slice(0,300)})),painToday:!!state.painDates?.includes(date)};}
export type BodyReading=Partial<Record<'kg'|keyof import('./types').BodyComp,number>>;
export async function askAi(task:'coach'|'food'|'brief'|'exercise'|'body',text:string,context:unknown,image?:string,history?:Turn[]):Promise<{text?:string;foods?:Draft[];brief?:HomeAdvice;exercises?:ExerciseDraft[];body?:BodyReading;note?:string}> {const r=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,text,context,image,...(history?.length?{history}:{})}),signal:AbortSignal.timeout(60000)});const result=await r.json().catch(()=>({error:'サーバーからの応答を読み取れませんでした'}));if(!r.ok)throw new Error(result.error??'AIを利用できません');return result;}
