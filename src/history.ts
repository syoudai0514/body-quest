import {normalizedFoodText,canUseFoodReference,foodIdentity,preparationOf} from './nutrition';
import {portionForQuantity} from './portions';
import type {AppState, Food, Meal, Nutrition,NutritionBasis} from './types';
import {daysBetween, offsetDate, today, totals} from './domain';

export const slots = ['朝食','昼食','夕食','間食'] as const;
export function slotForHour(hour:number) {return hour<10?'朝食':hour<15?'昼食':hour<21?'夕食':'間食';}
export const defaultSlot = () => slotForHour(new Date().getHours());

// A remembered meal: everything needed to add it again exactly (amount, nutrition, alcohol).
export type HistoryAmount = Nutrition & {name:string;quantity:number;source:string;estimated:boolean;alcoholG?:number;portion?:string;nutrition?:NutritionBasis;foodId?:string;count:number;lastDate:string};
// One food in the history, whatever amounts it was eaten in. Its own fields are the usual amount (most often eaten, then most recent);
// amounts lists every amount, each with its latest record so it is added back exactly as recorded.
export type HistoryItem = HistoryAmount & {key:string;slot:string;score:number;amounts:HistoryAmount[]};
const keyOf = (m:Meal) => [m.name,m.portion??'',m.quantity,m.kcal,m.protein,m.fat,m.carbs,m.alcoholG??0,m.source,m.nutrition?.preparation??'',m.nutrition?.kind??'',m.nutrition?.url??''].join('|');
// The same food at another amount: per-serving values (rounded past re-scaling noise), with a count like "2杯" in the name ignored.
const r=(x:number,d:number)=>Math.round(x*10**d)/10**d;
const foodKeyOf=(m:Meal)=>{const q=m.quantity;return [m.name.replace(new RegExp(`(^|[^0-9.])${String(q).replace('.','\\.')}杯`),'$1#杯'),m.portion??'',r(m.kcal/q,0),r(m.protein/q,1),r(m.fat/q,1),r(m.carbs/q,1),r((m.alcoholG??0)/q,1),m.nutrition?.preparation??'',m.nutrition?.kind??'',m.nutrition?.url??''].join('|');};
const snapshot=(m:Meal)=>({name:m.name,quantity:m.quantity,...(m.portion?{portion:m.portion}:{}),source:m.source,estimated:m.estimated,...(m.nutrition?{nutrition:m.nutrition}:{}),...(m.foodId?{foodId:m.foodId}:{}),...(m.alcoholG?{alcoholG:m.alcoholG}:{}),kcal:m.kcal,protein:m.protein,fat:m.fat,carbs:m.carbs});

export function mealHistory(state:AppState,slot:string,date:string,days=90):HistoryItem[] {
 const from=offsetDate(date,-days),groups=new Map<string,{slot:string;score:number;lastDate:string;amounts:Map<number,HistoryAmount>}>();
 for(const m of state.meals){
  if(m.date<from||m.date>today())continue;
  const key=foodKeyOf(m),age=Math.max(0,daysBetween(m.date,date)),weight=1/(1+age/14)*(m.slot===slot?1:.3);
  const g=groups.get(key)??{slot:m.slot,score:0,lastDate:m.date,amounts:new Map()};groups.set(key,g);
  g.score+=weight;if(m.date>=g.lastDate){g.lastDate=m.date;g.slot=m.slot;}
  const old=g.amounts.get(m.quantity);
  g.amounts.set(m.quantity,!old||m.date>=old.lastDate?{...snapshot(m),count:(old?.count??0)+1,lastDate:m.date}:{...old,count:old.count+1});
 }
 return [...groups.entries()].map(([key,g])=>{
  const amounts=[...g.amounts.values()].sort((a,b)=>a.quantity-b.quantity),usual=[...amounts].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate))[0];
  return {...usual,key,slot:g.slot,score:g.score,count:amounts.reduce((n,a)=>n+a.count,0),lastDate:g.lastDate,amounts};
 }).sort((a,b)=>b.score-a.score||b.lastDate.localeCompare(a.lastDate));
}
export function mealFromHistory(item:HistoryAmount,date:string,slot:string):Meal {
 return {id:crypto.randomUUID(),date,slot,name:item.name,quantity:item.quantity,...(item.portion?{portion:item.portion}:{}),source:item.source,estimated:item.estimated,...(item.nutrition?{nutrition:item.nutrition}:{}),...(item.foodId?{foodId:item.foodId}:{}),kcal:item.kcal,protein:item.protein,fat:item.fat,carbs:item.carbs,...(item.alcoholG?{alcoholG:item.alcoholG}:{})};
}
export function searchHistory(items:HistoryItem[],query:string) {const q=query.trim();return q?items.filter(i=>normalizedFoodText(i.name).replace(/\s/g,'').includes(normalizedFoodText(q).replace(/\s/g,''))):items;}

// Combinations eaten together in one slot, e.g. the usual breakfast.
export type MealSet = Nutrition & {key:string;slot:string;meals:Meal[];count:number;lastDate:string};
export function mealSets(state:AppState,date:string,days=45,limit=4):MealSet[] {
 const from=offsetDate(date,-days),groups=new Map<string,Meal[]>();
 for(const m of state.meals)if(m.date>=from&&m.date<date){const k=`${m.date}|${m.slot}`;groups.set(k,[...(groups.get(k)??[]),m]);}
 const sets=new Map<string,MealSet>();
 for(const meals of groups.values()){
  if(meals.length<2)continue;
  const key=meals[0].slot+'|'+meals.map(keyOf).sort().join('+'),old=sets.get(key),last=meals[0].date;
  if(!old||last>old.lastDate)sets.set(key,{key,slot:meals[0].slot,meals,...totals(meals),count:(old?.count??0)+1,lastDate:last});
  else old.count++;
 }
 return [...sets.values()].sort((a,b)=>b.count-a.count||b.lastDate.localeCompare(a.lastDate)).slice(0,limit);
}
// The food a remembered meal stands for: its linked food, or a マイ食品 holding exactly the recorded amount. Drinks keep their alcohol only as meals.
export function favoriteTarget(state:AppState,item:HistoryItem):Food|null {
 const linked=item.foodId?state.foods.find(f=>f.id===item.foodId&&!f.archived):undefined;
 if(linked)return linked;
 if(item.alcoholG)return null;
 const portion=portionForQuantity(item.portion,item.quantity)??'記録した1回分',values={kcal:item.kcal,protein:item.protein,fat:item.fat,carbs:item.carbs};
 return {id:crypto.randomUUID(),name:item.name,portion,category:'マイ食品',source:item.source,estimated:item.estimated,...values,nutrition:{...(item.nutrition??{kind:item.estimated?'estimate':'manual',preparation:preparationOf(portion)}),portion,values}};
}
export function isFavorite(state:AppState,food:Food) {const fav=new Set(state.favorites??[]);return fav.has(food.id)||state.foods.some(f=>fav.has(f.id)&&!f.archived&&foodIdentity(f)===foodIdentity(food));}
export const favoriteFoods=(state:AppState)=>{const fav=new Set(state.favorites??[]);return state.foods.filter(f=>fav.has(f.id)&&!f.archived);};
export function copyMeals(meals:Meal[],date:string,slot?:string):Meal[] {return meals.map(m=>({...m,id:crypto.randomUUID(),date,...(slot?{slot}:{})}));}

// Protein: daily target, spread over meals, and foods that close the gap without many calories.
export function proteinStatus(state:AppState,date:string) {
 const meals=state.meals.filter(m=>m.date===date),eaten=totals(meals).protein,target=state.settings.protein;
 const perMeal=Math.min(40,Math.max(20,Math.round(target/3.5/5)*5));
 const bySlot=Object.fromEntries(slots.map(s=>[s,totals(meals.filter(m=>m.slot===s)).protein])) as Record<string,number>;
 return {target,eaten,remaining:Math.max(0,target-eaten),ratio:target?Math.min(1,eaten/target):0,perMeal,bySlot,kcalLeft:state.settings.kcal-totals(meals).kcal};
}
export const proteinDense = (f:Nutrition) => f.protein>=6&&f.kcal>0&&f.protein*4/f.kcal>=0.3;
export function proteinPicks(state:AppState,date:string,limit=4):Food[] {
 const {remaining,kcalLeft}=proteinStatus(state,date),fav=new Set(state.favorites??[]);
 const used=new Map<string,number>();for(const m of state.meals)used.set(m.name,(used.get(m.name)??0)+1);
 return state.foods.filter(canUseFoodReference).filter(proteinDense).map(f=>{
  const fits=f.kcal<=Math.max(150,kcalLeft+50),useful=f.protein<=remaining+15;
  return {f,score:(fav.has(f.id)?3:0)+Math.min(3,(used.get(f.name)??0)*.5)+f.protein*4/f.kcal*4+(fits?2:-3)+(useful?1:-1)+(f.category==='たんぱく質'?1:0)};
 }).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.f);
}
export function proteinAdvice(state:AppState,date:string,trainedToday:boolean) {
 const p=proteinStatus(state,date),hasMeals=state.meals.some(m=>m.date===date);
 if(!hasMeals)return `1食あたりたんぱく質${p.perMeal}g前後を目安に、朝・昼・夜に分けて取りましょう。`;
 if(p.remaining<=0)return 'たんぱく質は今日の目標に届いています。残りは野菜・主食でバランスを。';
 if(p.remaining>=20&&p.kcalLeft<p.remaining*8)return `あと${Math.round(p.remaining)}g。カロリーの残りが少ないので、プロテイン・サラダチキン・ギリシャヨーグルトなど脂質の少ない食品が向いています。`;
 if(trainedToday)return `運動した日です。あと${Math.round(p.remaining)}g。次の食事でたんぱく質${p.perMeal}g前後を意識しましょう。`;
 return `あと${Math.round(p.remaining)}g。次の食事で${Math.min(p.perMeal,Math.round(p.remaining))}g前後を。食事で難しい日はプロテイン1杯（約20g）も選択肢です。`;
}
