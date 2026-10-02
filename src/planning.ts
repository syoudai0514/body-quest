import type {AppState, CoachMode, Settings} from './types';
import {daysBetween, localDate, today} from './domain';
import {basal, FOOD_TARGET_FLOOR, goalEnergy, KCAL_PER_KG, profileOf, weightAt} from './energy';

export const coachModes: {id:CoachMode;label:string;description:string}[] = [
 {id:'gentle',label:'やさしめ',description:'できたことを認め、小さな一歩を提案'},
 {id:'balanced',label:'バランス',description:'事実と改善案を落ち着いて伝える'},
 {id:'direct',label:'厳しめ',description:'差を率直に伝え、今日の行動を明確に'},
];
export const goalName = (s:Settings) => s.goalName?.trim() || '自分の目標';
export const planReady = (s:Settings) => !!s.energy && s.startWeight!==null && s.targetWeight!==null;
export function monthsAfter(date:string,months:number) {
 const d=new Date(date+'T12:00:00'),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);
 const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return localDate(d);
}
export function nutritionPlan(state:AppState,asOf=today()) {
 const s=state.settings;
 if(!planReady(s))return null;
 const p=profileOf(s),current=weightAt(state,asOf),g=goalEnergy(state,asOf);
 const expenditure=basal(current,p)*p.activity+g.plannedExercise;
 const requested=g.remainingRequired??0;
 // A deadline can change the arithmetic, never the restriction guardrails.
 const cap=Math.min(expenditure*.2,current*.0075*KCAL_PER_KG/7);
 const floor=Math.max(FOOD_TARGET_FLOOR,Math.ceil(basal(current,p)/10)*10);
 const kcal=Math.min(5000,Math.max(floor,Math.round((expenditure-Math.min(requested,cap))/10)*10));
 const protein=Math.min(Math.round(current*(s.proteinPerKg??1.6)),Math.floor(kcal*.3/4));
 const fat=Math.round(kcal*.3/9),carbs=Math.round((kcal-protein*4-fat*9)/4);
 return {kcal,protein,fat,carbs,current,expenditure,requested,deficit:expenditure-kcal,
  limited:requested>cap || expenditure-requested<floor,expired:g.remainingDays===0,
  weeklyDeficit:(expenditure-kcal)*7,weeklyProtein:protein*7};
}
export function syncNutrition(state:AppState,asOf=today()):AppState {
 if(state.settings.nutritionMode!=='auto')return state;
 const n=nutritionPlan(state,asOf);if(!n)return state;
 return {...state,settings:{...state.settings,kcal:n.kcal,protein:n.protein,fat:n.fat,carbs:n.carbs}};
}
export function planError(s:Settings) {
 if(!planReady(s))return '身長・年齢・現在体重・目標体重を入力してください。';
 if(daysBetween(s.startDate,s.deadline)<=0||daysBetween(s.startDate,s.deadline)>3660)return '目標日は開始日より後、10年以内で設定してください。';
 if(s.startDate>today())return '開始日は今日以前にしてください。';
 if(s.deadline<=today())return 'これからの目標日を設定してください。';
 if(s.targetWeight!>s.startWeight!)return '減量・維持の目標体重は開始体重以下にしてください。';
 if(s.targetWeight!/(s.energy!.height/100)**2<18.5)return 'BMI 18.5未満を目指す減量計画には対応していません。目標体重を見直してください。';
 if(s.nutritionMode==='manual'&&(s.kcal<1600||s.kcal>5000||[s.protein,s.fat,s.carbs].some(v=>!Number.isFinite(v)||v<0||v>1000)))return '手動目標は1,600〜5,000kcal、PFCは0〜1,000gで設定してください。';
 return '';
}
