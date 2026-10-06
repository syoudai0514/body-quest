import type {AppState} from './types';
import {daysBetween, latestRecord, offsetDate, totals} from './domain';
import {bodyHistory} from './body';
import {isStrength} from './training';
import {goalName, planReady} from './planning';
import {progressSummary} from './progress';

// Points reward showing up and taking care of yourself, never eating less or losing faster.
export const XP = {weight:10, meal:5, protein:10, exercise:20, close:15, body:5, clear:20};
export const gameOn = (s:AppState['settings']) => s.gameMode!==false;

function dayXp(state:AppState,date:string) {
 const meals=state.meals.filter(m=>m.date===date),slots=new Set(meals.map(m=>m.slot)).size;
 const weight=!!latestRecord(state.weights,date,'朝'),protein=meals.length>0&&totals(meals).protein>=state.settings.protein;
 const exercise=state.exercises.some(e=>e.date===date),closed=!!state.closedDays?.[date];
 const body=state.weights.some(w=>w.date===date&&w.body&&Object.keys(w.body).length);
 const meal=Math.min(4,slots)*XP.meal,base=(weight?XP.weight:0)+meal+(protein?XP.protein:0)+(exercise?XP.exercise:0)+(closed?XP.close:0)+(body?XP.body:0);
 const clear=weight&&slots>=3&&exercise&&closed;
 return base+(clear?XP.clear:0);
}
export function totalXp(state:AppState,upTo:string) {
 const dates=new Set([...state.weights.map(w=>w.date),...state.meals.map(m=>m.date),...state.exercises.map(e=>e.date),...Object.keys(state.closedDays??{})].filter(d=>d<=upTo));
 let xp=0;for(const d of dates)xp+=dayXp(state,d);return xp;
}
const titles:[number,string][]=[[1,'見習い冒険者'],[3,'駆け出しの戦士'],[6,'記録の剣士'],[10,'習慣の騎士'],[15,'鍛錬の勇者'],[22,'不屈の英雄'],[30,'伝説のクエスター']];
export const xpFor=(level:number)=>25*(level-1)*level; // total XP needed to reach a level
export function levelInfo(xp:number) {
 let level=1;while(xpFor(level+1)<=xp&&level<99)level++;
 const from=xpFor(level),to=xpFor(level+1);
 return {level,title:[...titles].reverse().find(([l])=>level>=l)![1],xp,into:xp-from,need:to-from,progress:Math.round((xp-from)/(to-from)*100)};
}

export type Quest={id:string;label:string;xp:number;done:boolean;target:'weight'|'meals'|'training'|'close'};
export function dailyQuests(state:AppState,date:string):Quest[] {
 const meals=state.meals.filter(m=>m.date===date),slots=new Set(meals.map(m=>m.slot)).size;
 return [
  {id:'weight',label:'朝の体重を量る',xp:XP.weight,done:!!latestRecord(state.weights,date,'朝'),target:'weight'},
  {id:'meals',label:`食事を記録（${Math.min(slots,3)}/3食）`,xp:XP.meal*3,done:slots>=3,target:'meals'},
  {id:'protein',label:`たんぱく質 ${state.settings.protein}g`,xp:XP.protein,done:meals.length>0&&totals(meals).protein>=state.settings.protein,target:'meals'},
  {id:'exercise',label:'体を動かす',xp:XP.exercise,done:state.exercises.some(e=>e.date===date),target:'training'},
  {id:'close',label:'一日を締めくくる',xp:XP.close,done:!!state.closedDays?.[date],target:'close'},
 ];
}

export type Achievement={id:string;icon:string;title:string;desc:string;earned:boolean};
export function achievements(state:AppState,date:string):Achievement[] {
 const p=progressSummary(state,date),best=longestStreak(state,date);
 const strength=new Set(state.exercises.filter(isStrength).map(e=>e.date)).size,closed=Object.keys(state.closedDays??{}).length;
 const proteinDays=[...new Set(state.meals.map(m=>m.date))].filter(d=>totals(state.meals.filter(m=>m.date===d)).protein>=state.settings.protein).length;
 const list:Achievement[]=[
  {id:'first',icon:'🌱',title:'旅立ち',desc:'最初の記録をつけた',earned:state.weights.length+state.meals.length>0},
  {id:'streak3',icon:'🔥',title:'三日坊主を超えて',desc:'3日連続で記録',earned:best>=3},
  {id:'streak7',icon:'🔥',title:'一週間の勇者',desc:'7日連続で記録',earned:best>=7},
  {id:'streak30',icon:'🏆',title:'習慣の達人',desc:'30日連続で記録',earned:best>=30},
  {id:'close7',icon:'📒',title:'帳簿係',desc:'収支を7日確定',earned:closed>=7},
  {id:'protein7',icon:'🍗',title:'たんぱく質ハンター',desc:'たんぱく質目標を7日達成',earned:proteinDays>=7},
  {id:'strength4',icon:'💪',title:'鉄の意志',desc:'筋トレを4日記録',earned:strength>=4},
  {id:'strength12',icon:'🛡️',title:'鋼の肉体',desc:'筋トレを12日記録',earned:strength>=12},
  {id:'body',icon:'🔬',title:'自分を知る者',desc:'体組成を3回記録',earned:bodyHistory(state.weights).length>=3},
  ...(p?[1,3,5].filter(n=>n<=Math.ceil(p.start-p.target)).map(n=>({id:`loss${n}`,icon:'⚔️',title:`−${n}kgの壁を突破`,desc:`7日平均で開始から−${n}kg`,earned:p.milestone>=n})):[]),
  ...(p?[{id:'goal',icon:'👑',title:`${goalName(state.settings)}を制覇`,desc:'目標体重に到達',earned:p.verdict==='reached'}]:[]),
 ];
 return list;
}
function longestStreak(state:AppState,date:string) {
 const days=[...new Set([...state.weights.filter(w=>w.time==='朝').map(w=>w.date),...state.meals.map(m=>m.date)])].filter(d=>d<=date).sort();
 let best=0,run=0,prev='';for(const d of days){run=prev&&daysBetween(prev,d)===1?run+1:1;best=Math.max(best,run);prev=d;}return best;
}

// The goal as a boss: its HP is the weight still to lose.
export function boss(state:AppState,date:string) {
 if(!planReady(state.settings))return null;
 const p=progressSummary(state,date)!;const max=Math.max(0.1,p.start-p.target);
 return {name:`${goalName(state.settings)}の魔王`,hp:+Math.max(0,p.remaining).toFixed(1),max:+max.toFixed(1),pct:Math.round(Math.max(0,p.remaining)/max*100),defeated:p.verdict==='reached',daysLeft:p.daysLeft};
}
export const yesterdayXp=(state:AppState,date:string)=>dayXp(state,offsetDate(date,-1));
export const todayXp=(state:AppState,date:string)=>dayXp(state,date);
