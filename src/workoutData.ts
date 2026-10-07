import type {Exercise,StrengthSet,TrainingProfile} from './types.ts';
export const trainingModes=[
 {id:'walking',label:'歩く・消費',detail:'1駅歩く、ゆるウォーキング',goal:'fitness',weeklyDays:2,minutes:20},
 {id:'home',label:'自宅トレ',detail:'道具なし・短時間で続ける',goal:'fitness',weeklyDays:2,minutes:20},
 {id:'gym',label:'ジム・基本',detail:'全身を週2〜3回',goal:'fitness',weeklyDays:2,minutes:30},
 {id:'advanced',label:'ジム・本格',detail:'筋力・筋肥大と前回比較',goal:'hypertrophy',weeklyDays:4,minutes:60},
] as const;
export function validTraining(value:unknown):value is TrainingProfile {if(!value||typeof value!=='object')return false;const p=value as TrainingProfile;return trainingModes.some(m=>m.id===p.mode)&&['fitness','strength','hypertrophy'].includes(p.goal)&&Number.isInteger(p.weeklyDays)&&p.weeklyDays>=2&&p.weeklyDays<=6&&Number.isFinite(p.minutes)&&p.minutes>=10&&p.minutes<=120;}
export function validSets(value:unknown):value is StrengthSet[] {return Array.isArray(value)&&value.length<=60&&value.every(s=>s&&typeof s.exercise==='string'&&!!s.exercise.trim()&&s.exercise.length<=100&&Number.isFinite(s.kg)&&s.kg>=0&&s.kg<=500&&Number.isInteger(s.reps)&&s.reps>=1&&s.reps<=100&&(s.rir===undefined||(Number.isInteger(s.rir)&&s.rir>=0&&s.rir<=10))&&(s.warmup===undefined||typeof s.warmup==='boolean'));}
export const workSets=(sets:StrengthSet[]=[])=>sets.filter(s=>!s.warmup);
export const volume=(sets:StrengthSet[]=[])=>workSets(sets).reduce((sum,s)=>sum+s.kg*s.reps,0);
// Same exercise only; a new machine, unit convention or exercise mix isn't a strength record comparison.
export function setComparisons(history:Exercise[],sets:StrengthSet[],before:string) {
 const names=[...new Set(workSets(sets).map(s=>s.exercise))];
 return names.map(name=>{const current=workSets(sets).filter(s=>s.exercise===name),previous=history.filter(e=>e.date<before&&e.sets?.some(s=>!s.warmup&&s.exercise===name)).reverse().sort((a,b)=>b.date.localeCompare(a.date))[0],old=workSets(previous?.sets).filter(s=>s.exercise===name);
  return {name,date:previous?.date,currentVolume:volume(current),previousVolume:previous?volume(old):null,sets:current.length,previousSets:old.length,best:Math.max(...current.map(s=>s.kg)),previousBest:old.length?Math.max(...old.map(s=>s.kg)):null};});
}
export const setText=(sets:StrengthSet[]=[])=>sets.map(s=>`${s.exercise} ${s.kg===0?'自重':`${s.kg}kg`} × ${s.reps}回${s.rir===undefined?'':` · RIR ${s.rir}`}${s.warmup?'（準備）':''}`).join('\n');
