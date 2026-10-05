import type {AppState,BriefPhase,HomeAdvice,HomeBriefRecord} from './types';
import {latestRecord,morningAverage,offsetDate,totals,trend} from './domain';
import {nutritionPlan,planReady} from './planning';
import {KCAL_PER_KG,weeklyBudget} from './energy';
import {mealHistory,slotForHour} from './history';
import {recommendMenu} from './training';

export type HomeAction={kind:'weight'|'meal'|'plan'|'training';label:string;detail:string;date:string;time?:'朝'|'夜';slot?:string};
// Automatic morning/afternoon/evening briefs are on unless the user turned them off.
export const autoBriefOn=(s:AppState['settings'])=>s.homeAiAuto!==false;
export const briefPhase=(hour:number):BriefPhase=>hour<11?'morning':hour<17?'afternoon':'evening';
export const phaseLabel=(phase:BriefPhase)=>({morning:'朝',afternoon:'昼',evening:'夜'}[phase]);
export const briefKey=(date:string,phase:BriefPhase)=>`${date}:${phase}`;
export {validAdvice} from './homeAdvice';
export function homeReport(state:AppState,date:string,hour:number) {
 const phase=briefPhase(hour),ready=planReady(state.settings),average=morningAverage(state.weights,date),change=trend(state.weights,date),yesterday=offsetDate(date,-1),slot=slotForHour(hour),actions:HomeAction[]=[];
 const n=totals(state.meals.filter(m=>m.date===date)),y=totals(state.meals.filter(m=>m.date===yesterday)),confirmedYesterday=!!state.closedDays?.[yesterday],week=weeklyBudget(state,date,date),bounds=nutritionPlan(state,date);
 const safeWeek=!!bounds&&week.missing===0&&week.feasible&&week.suggestion!==null&&week.suggestion>=bounds.minimumCalories&&week.suggestion<=5000;
 const tooFast=!!change&&change.change<-(change.current*0.0075);
 const forecast=change&&!tooFast&&ready&&state.settings.targetWeight!<state.settings.startWeight!&&date<state.settings.deadline&&change.current>state.settings.targetWeight!&&change.change<0?+(change.current+change.change).toFixed(1):null;
 // Before two weeks of mornings exist, give a provisional week-ahead figure from the plan and say what the first days show.
 const mornings=[...new Map(state.weights.filter(w=>w.time==='朝'&&w.date<=date&&w.date>=offsetDate(date,-6)).sort((a,b)=>a.date.localeCompare(b.date)).map(w=>[w.date,w.kg])).entries()];
 const observed=mornings.length>=2?{days:mornings.length,first:mornings[0][1],latest:mornings[mornings.length-1][1],change:+(mornings[mornings.length-1][1]-mornings[0][1]).toFixed(1)}:null;
 const weeklyLoss=bounds?Math.max(0,bounds.deficit)*7/KCAL_PER_KG:0;
 const early=forecast===null&&!tooFast&&ready&&average&&bounds&&weeklyLoss>0&&date<state.settings.deadline&&average.value>state.settings.targetWeight!?{kg:+Math.max(state.settings.targetWeight!,average.value-weeklyLoss).toFixed(1),weeklyLoss:+weeklyLoss.toFixed(2),observed}:null;
 const earlyText=early?`${early.observed?`記録した${early.observed.days}日で、朝の体重は${early.observed.first.toFixed(1)}→${early.observed.latest.toFixed(1)}kg（${early.observed.change>0?'+':''}${early.observed.change.toFixed(1)}kg）。${early.observed.change<-(early.observed.first*0.015)?'順調な出だしです。最初の数日は水分で減りやすいので、食事はこれ以上減らさずに。':early.observed.change<0?'いいスタートです。':'始めの数日は水分で上下しやすいので気にしすぎずに。'}`:`朝の平均は${average!.value.toFixed(1)}kg。`}今の食事目標どおりに続ければ、1週間後の平均は約${early.kg.toFixed(1)}kgが目安です（計画からの暫定値。2週間分そろうと実際の傾向で判定します）。`:'';
 const headline=!ready?'あなたのペースで、まず一歩。':tooFast?'減り方は速め。回復も大切に。':forecast!==null?'朝の平均は、ゆるやかに下降中。':early?.observed&&early.observed.change<0?'いいスタート。この調子で1週間を。':confirmedYesterday&&y.kcal>state.settings.kcal+150?'今日は、いつもの食事に戻そう。':'今日の積み重ねが、次の一週間へ。';
 const summary=!ready?'目標と身長・体重を設定すると、食事の残りと計画をあなたに合わせて案内します。記録は今すぐ始められます。':tooFast?'直近の朝の平均は速めに減っています。さらに食事を削らず、疲れや空腹、体調を確認しましょう。':forecast!==null?`朝の7日平均は${average!.value.toFixed(1)}kg。直近の傾向が続く場合、1週間後の平均は約${forecast.toFixed(1)}kgが目安です。水分などで変動するため、達成の約束ではありません。`:confirmedYesterday&&y.kcal>state.settings.kcal+150?`昨日の確定した記録は目標より${Math.round(y.kcal-state.settings.kcal)}kcal多め。食事を抜いて取り返さず、今日の目標と週の収支を見ながら整えましょう。`:early?earlyText:'体重は一日の増減より朝の7日平均で確認。朝の体重を記録すると、1週間後の目安を表示します。';
 if(!latestRecord(state.weights,date,'朝'))actions.push({kind:'weight',label:'朝の体重を記録しよう',detail:'前回の値から±0.1kgで調整',date,time:'朝'});
 if(phase==='morning'&&!latestRecord(state.weights,yesterday,'夜'))actions.push({kind:'weight',label:'昨夜の体重、測っていたら記録',detail:'覚えている測定値だけでOK。推測で埋めない',date:yesterday,time:'夜'});
 if(phase==='evening'&&!latestRecord(state.weights,date,'夜'))actions.push({kind:'weight',label:'夜の体重も残しておこう',detail:'朝とは別に保存。夜の増加は脂肪の増加とは限りません',date,time:'夜'});
 if(!state.meals.some(m=>m.date===date&&m.slot===slot)){
  const usual=mealHistory({...state,meals:state.meals.filter(m=>m.date<date&&m.slot===slot)},slot,date).find(h=>h.count>=2);
  actions.push({kind:'meal',label:usual?`${slot}は、いつもの${usual.name}？`:`${slot}を記録しよう`,detail:usual?'食べたものと量を確認して、履歴から登録':'履歴・文章・写真で簡単に入力',date,slot});
 }
 if(!ready)actions.push({kind:'plan',label:'あなたの目標を決めよう',detail:'予定の日付でも、1年後の目標でも',date});
 else if(week.missing>0)actions.push({kind:'plan',label:'今週の記録を仕上げよう',detail:`過去${week.missing}日分が未確定。週の評価は確認してから`,date});
 else actions.push({kind:'plan',label:'一週間の収支で考えよう',detail:safeWeek?`今週の残り予算から1日約${Math.round(week.suggestion!)}kcalが計算上の目安`:'週の予算を確認。足りなくても食事を抜かない',date});
 const context=state.contexts[date]??([0,6].includes(new Date(date+'T12:00:00').getDay())?'休日':'出社');
 const workout=recommendMenu(state,date,context,!!state.painDates?.includes(date));
 actions.push({kind:'training',label:state.exercises.some(e=>e.date===date)?'今日の運動、記録できています':workout.menu.name,detail:workout.reason,date});
 const tips=[ready?`記録上の残りは${Math.round(state.settings.kcal-n.kcal)}kcal、たんぱく質はあと${Math.round(Math.max(0,state.settings.protein-n.protein))}g。未記録の食事があれば先に入力。`:'最初の体重や食事を記録すると、提案があなたに近づきます。',workout.reason,'夜の体重は食事や水分で増えやすいもの。減量の傾向は朝の平均で見ます。'];
 return {date,phase,headline,summary,tips,actions,average:average?{kg:+average.value.toFixed(1),days:average.count}:null,forecast,early,tooFast,weekly:{missing:week.missing,suggestedKcal:safeWeek?Math.round(week.suggestion!):null},confirmedYesterday};
}
export function homeSignature(state:AppState,date:string,phase:BriefPhase) {
 const {homeAiAuto:_,...settings}=state.settings;
 const data=JSON.stringify({date,phase,settings,meals:state.meals.filter(m=>m.date>=offsetDate(date,-7)&&m.date<=date),weights:state.weights.filter(w=>w.date>=offsetDate(date,-20)&&w.date<=date),exercises:state.exercises.filter(e=>e.date>=offsetDate(date,-14)&&e.date<=date),closedDays:state.closedDays,context:state.contexts[date],pain:state.painDates?.includes(date),foods:state.foods.map(f=>({id:f.id,name:f.name,kcal:f.kcal,protein:f.protein}))});
 let hash=2166136261;for(let i=0;i<data.length;i++){hash^=data.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16);
}
export function applyBrief(records:HomeBriefRecord[],id:string,result:{brief:HomeAdvice;signature:string;at:string}|{error:string}) {
 return records.map(r=>r.id!==id?r:'brief' in result?{...r,brief:result.brief,briefSignature:result.signature,generatedAt:result.at,error:undefined}:{...r,error:result.error});
}
