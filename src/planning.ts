import type {AppState, CaloriePolicy, CoachMode, EnergyProfile, Settings} from './types';
import {daysBetween, localDate, today} from './domain';
import {basal, FOOD_TARGET_FLOOR, goalEnergy, KCAL_PER_KG, profileOf, weightAt} from './energy';

export const coachModes: {id:CoachMode;label:string;description:string}[] = [
 {id:'gentle',label:'やさしめ',description:'できたことを認め、小さな一歩を提案'},
 {id:'balanced',label:'バランス',description:'事実と改善案を落ち着いて伝える'},
 {id:'direct',label:'厳しめ',description:'差を率直に伝え、今日の行動を明確に'},
];
export const goalName = (s:Settings) => s.goalName?.trim() || '自分の目標';
export const planReady = (s:Settings) => !!s.energy && s.startWeight!==null && s.targetWeight!==null;
export const policyOf = (s:Settings):CaloriePolicy => s.caloriePolicy==='flexible'&&s.belowBmrAcknowledged===true?'flexible':'standard';
export function intakeBounds(weight:number,p:EnergyProfile,plannedExercise:number,policy:CaloriePolicy) {
 const bmr=basal(weight,p),expenditure=bmr*p.activity+plannedExercise;
 const deficitCap=Math.min(expenditure*.2,weight*.0075*KCAL_PER_KG/7);
 const floor=policy==='standard'?Math.max(FOOD_TARGET_FLOOR,Math.ceil(bmr/10)*10):FOOD_TARGET_FLOOR;
 const minimumCalories=Math.ceil(Math.max(floor,expenditure-deficitCap)/10)*10;
 return {bmr,expenditure,deficitCap,floor,minimumCalories,outOfRange:minimumCalories>5000};
}
export const caloriesFor=(bounds:ReturnType<typeof intakeBounds>,requested:number)=>Math.max(bounds.minimumCalories,Math.round((bounds.expenditure-Math.min(Math.max(0,requested),bounds.deficitCap))/10)*10);
export function monthsAfter(date:string,months:number) {
 const d=new Date(date+'T12:00:00'),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);
 const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return localDate(d);
}
export function nutritionPlan(state:AppState,asOf=today()) {
 const s=state.settings;
 if(!planReady(s))return null;
 const p=profileOf(s),current=weightAt(state,asOf),g=goalEnergy(state,asOf);
 const policy=policyOf(s),bounds=intakeBounds(current,p,g.plannedExercise,policy),{expenditure,floor}=bounds;
 const requested=g.remainingRequired??0;
 // A deadline can change the arithmetic, never the restriction guardrails.
 const cap=bounds.deficitCap;
 const kcal=caloriesFor(bounds,requested);
 const protein=Math.min(Math.round(current*(s.proteinPerKg??1.6)),Math.floor(kcal*.3/4));
 const fat=Math.round(kcal*.3/9),carbs=Math.round((kcal-protein*4-fat*9)/4);
 return {kcal,protein,fat,carbs,current,expenditure,requested,deficit:expenditure-kcal,policy,bmr:bounds.bmr,minimumCalories:bounds.minimumCalories,belowBmr:kcal<bounds.bmr,outOfRange:bounds.outOfRange||kcal>5000,
  limited:requested>cap || expenditure-requested<floor,expired:g.remainingDays===0,
  weeklyDeficit:(expenditure-kcal)*7,weeklyProtein:protein*7};
}
export function syncNutrition(state:AppState,asOf=today()):AppState {
 if(state.settings.nutritionMode!=='auto')return state;
 const n=nutritionPlan(state,asOf);if(!n||n.outOfRange)return state;
 return {...state,settings:{...state.settings,kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs}};
}
export function planError(s:Settings,currentWeight=s.startWeight!) {
 if(!planReady(s))return '身長・年齢・現在体重・目標体重を入力してください。';
 if(daysBetween(s.startDate,s.deadline)<=0||daysBetween(s.startDate,s.deadline)>3660)return '目標日は開始日より後、10年以内で設定してください。';
 if(s.startDate>today())return '開始日は今日以前にしてください。';
 if(s.deadline<=today())return 'これからの目標日を設定してください。';
 if(s.targetWeight!>s.startWeight!)return '減量・維持の目標体重は開始体重以下にしてください。';
 if(s.targetWeight!/(s.energy!.height/100)**2<18.5)return 'BMI 18.5未満を目指す減量計画には対応していません。目標体重を見直してください。';
 if(s.caloriePolicy==='flexible'&&!s.belowBmrAcknowledged)return '詳細調整の説明を確認してチェックを入れてください。';
 const bounds=intakeBounds(currentWeight,s.energy!,s.energy!.exerciseMode==='separate'?s.energy!.weeklyExerciseKcal/7:0,policyOf(s));
 if(s.nutritionMode==='auto'&&caloriesFor(bounds,Math.max(0,currentWeight-s.targetWeight!)*KCAL_PER_KG/Math.max(1,daysBetween(today(),s.deadline)))>5000)return '自動計算の対応範囲を超えています。食事量は医療者に相談してください。';
 if(s.nutritionMode==='manual'&&(s.kcal<1600||s.kcal>5000||[s.protein,s.fat,s.carbs].some(v=>!Number.isFinite(v)||v<0||v>1000)))return '手動目標は1,600〜5,000kcal、PFCは0〜1,000gで設定してください。';
 if(s.nutritionMode==='manual'){
  if(s.kcal<bounds.bmr&&policyOf(s)==='standard')return '基礎代謝未満の目標には詳細調整を選び、説明を確認してください。';
  if(s.kcal<bounds.minimumCalories)return `この条件の設定下限は${bounds.minimumCalories.toLocaleString('ja-JP')}kcalです。減量ペースの上限に合わせて食事量・活動量を見直してください。`;
 }
 return '';
}
