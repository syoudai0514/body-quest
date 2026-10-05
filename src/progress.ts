import type {AppState} from './types';
import {daysBetween, latestRecord, morningAverage, offsetDate, trend} from './domain';
import {energyLedger, FAST_LOSS_RATE, GOAL_TOLERANCE_KG} from './energy';
import {goalOutlook} from './outlook';
import {planReady} from './planning';

export type Verdict='reached'|'ahead'|'onTrack'|'behind'|'tooFast'|'early'|'none';

// Days in a row (ending today, or yesterday if today is still open) with a morning weight or a meal.
export function loggingStreak(state:AppState,date:string) {
 const logged=(d:string)=>!!latestRecord(state.weights,d,'朝')||state.meals.some(m=>m.date===d);
 let d=logged(date)?date:offsetDate(date,-1),n=0;
 while(logged(d)&&n<3660){n++;d=offsetDate(d,-1);}
 return n;
}

// Measured pace in kg/week (positive = losing): two-week trend when available, else the first mornings of the last 10 days.
export function actualPace(state:AppState,date:string) {
 const t=trend(state.weights,date);
 if(t)return {kgPerWeek:-t.change,basis:'trend' as const};
 const rows=[...new Map(state.weights.filter(w=>w.time==='朝'&&w.date<=date&&w.date>=offsetDate(date,-9)).sort((a,b)=>a.date.localeCompare(b.date)).map(w=>[w.date,w.kg])).entries()];
 if(rows.length<4)return null;
 const span=daysBetween(rows[0][0],rows[rows.length-1][0]);
 if(span<5)return null;
 return {kgPerWeek:(rows[0][1]-rows[rows.length-1][1])/span*7,basis:'early' as const};
}

export function progressSummary(state:AppState,date:string) {
 const s=state.settings;
 if(!planReady(s))return null;
 const start=s.startWeight!,target=s.targetWeight!,avg=morningAverage(state.weights,date),latest=state.weights.filter(w=>w.time==='朝'&&w.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const current=avg?.value??latest?.kg??start,lost=+(start-current).toFixed(1),goalLoss=Math.max(0.1,start-target);
 const pct=Math.max(0,Math.min(100,Math.round(lost/goalLoss*100))),remaining=+Math.max(0,current-target).toFixed(1);
 const daysLeft=Math.max(0,daysBetween(date,s.deadline)),weeksLeft=daysLeft/7;
 const needed=weeksLeft>0?remaining/weeksLeft:null,pace=actualPace(state,date);
 const tooFast=!!pace&&pace.kgPerWeek>current*FAST_LOSS_RATE;
 const verdict:Verdict=remaining<=GOAL_TOLERANCE_KG?'reached':!pace?(lost>0?'early':'none'):tooFast?'tooFast':needed===null?'none':pace.kgPerWeek>=needed*1.25&&pace.kgPerWeek-needed>0.1?'ahead':pace.kgPerWeek>=needed*0.8||needed-pace.kgPerWeek<0.1?'onTrack':'behind';
 const atPace=pace?+Math.max(30,current-pace.kgPerWeek*weeksLeft).toFixed(1):null;
 const milestone=Math.floor(Math.max(0,lost)),nextMilestone=milestone+1,toNext=+(nextMilestone-lost).toFixed(1);
 const ledger=energyLedger(state,'goal',date),lowest=Math.min(...state.weights.filter(w=>w.time==='朝'&&w.date>=s.startDate&&w.date<=date).map(w=>w.kg),Infinity);
 return {start,target,current:+current.toFixed(1),averaged:!!avg,lost,pct,remaining,daysLeft,needed:needed===null?null:+needed.toFixed(2),pace,verdict,atPace,milestone,nextMilestone:nextMilestone<=Math.ceil(goalLoss)?nextMilestone:null,toNext,
  streak:loggingStreak(state,date),lowest:Number.isFinite(lowest)?lowest:null,
  ledger:{days:ledger.completed.length,elapsed:ledger.elapsed,deficit:Math.round(ledger.deficit),required:Math.round(ledger.required),kg:+(ledger.deficit/7700).toFixed(1)}};
}

// One-tap goal changes grounded in the measured pace and the app's own limits.
export function goalSuggestions(state:AppState,date:string) {
 const p=progressSummary(state,date),o=goalOutlook(state,date);
 if(!p||!o)return [];
 const out:{kind:'target'|'deadline';label:string;detail:string;value:string|number}[]=[];
 if(p.verdict==='ahead'&&p.atPace!==null){
  const candidate=Math.ceil(Math.max(p.atPace,o.bound.projected)*10)/10;
  if(candidate<=p.target-0.3)out.push({kind:'target',label:`目標を${candidate.toFixed(1)}kgに上げる`,detail:`今のペースなら目標日に約${p.atPace.toFixed(1)}kg。アプリの減量上限の範囲内です。`,value:candidate});
 }
 if(p.verdict==='behind'){
  if(o.bound.date&&o.bound.daysBeyondDeadline!>0)out.push({kind:'deadline',label:`目標日を${o.bound.date.slice(5).replace('-','/')}に延ばす`,detail:'今の目標体重のまま、無理のないペースに戻せます。',value:o.bound.date});
  if(p.atPace!==null&&p.atPace>p.target&&p.atPace<p.current)out.push({kind:'target',label:`目標を${(Math.ceil(p.atPace*10)/10).toFixed(1)}kgに調整`,detail:'目標日はそのまま、今の実際のペースに合わせます。',value:Math.ceil(p.atPace*10)/10});
 }
 if(p.verdict==='tooFast'&&o.bound.date)out.push({kind:'deadline',label:'目標日を延ばしてペースを落とす',detail:'減り方が速めです。急がなくても目標に届きます。',value:offsetDate(state.settings.deadline,14)});
 return out;
}

// A message worth celebrating after a morning weight is saved, or null.
export function celebration(before:AppState,after:AppState,date:string) {
 const s=after.settings;
 if(!planReady(s))return null;
 const prevMin=Math.min(...before.weights.filter(w=>w.time==='朝'&&w.date>=s.startDate&&w.date!==date).map(w=>w.kg),Infinity),kg=latestRecord(after.weights,date,'朝')?.kg;
 const a=progressSummary(before,date),b=progressSummary(after,date);
 if(a&&b&&b.milestone>a.milestone&&b.milestone>0)return `🎉 7日平均で開始から−${b.milestone}kg達成！`;
 if(b&&b.verdict==='reached'&&a?.verdict!=='reached')return `🎉 目標の${s.targetWeight}kgに到達！`;
 if(kg!==undefined&&Number.isFinite(prevMin)&&kg<prevMin)return `✨ 自己ベスト更新 ${kg.toFixed(1)}kg（開始から−${(s.startWeight!-kg).toFixed(1)}kg）`;
 return null;
}
