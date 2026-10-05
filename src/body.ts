import type {BodyComp, Weight} from './types';

// Body-composition values as shown by home scales. They are device estimates, so ranges only reject impossible readings.
export const bodyFields: {key:keyof BodyComp;label:string;unit:string;min:number;max:number;step:number;better?:'down'|'up'}[] = [
 {key:'bodyFat',label:'体脂肪率',unit:'%',min:1,max:75,step:0.1,better:'down'},
 {key:'muscle',label:'骨格筋率',unit:'%',min:5,max:70,step:0.1,better:'up'},
 {key:'visceral',label:'内臓脂肪レベル',unit:'',min:1,max:60,step:0.5,better:'down'},
 {key:'leanMass',label:'除脂肪体重',unit:'kg',min:10,max:200,step:0.1},
 {key:'water',label:'体水分率',unit:'%',min:20,max:80,step:0.1},
 {key:'protein',label:'タンパク質率',unit:'%',min:3,max:40,step:0.1},
 {key:'bone',label:'骨量',unit:'kg',min:0.5,max:10,step:0.1},
 {key:'bmr',label:'基礎代謝（体組成計）',unit:'kcal',min:500,max:5000,step:1},
 {key:'bodyAge',label:'体内年齢',unit:'歳',min:10,max:100,step:1},
 {key:'bmi',label:'BMI',unit:'',min:10,max:80,step:0.1},
];
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
export function bodyOk(value:unknown):value is BodyComp {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>{const f=bodyFields.find(f=>f.key===k);return !!f&&(v[k]===undefined||(finite(v[k])&&(v[k] as number)>=f.min&&(v[k] as number)<=f.max));});
}
// Keep only known, in-range values; returns undefined when nothing remains.
export function cleanBody(value:unknown):BodyComp|undefined {
 if(!value||typeof value!=='object')return undefined;
 const v=value as Record<string,unknown>,out:BodyComp={};
 for(const f of bodyFields){const x=v[f.key];if(finite(x)&&x>=f.min&&x<=f.max)out[f.key]=f.step<1?+x.toFixed(1):Math.round(x);}
 return Object.keys(out).length?out:undefined;
}
export function bodyHistory(weights:Weight[]) {return weights.filter(w=>w.body&&Object.keys(w.body).length).sort((a,b)=>(a.date+(a.time==='朝'?0:1)).localeCompare(b.date+(b.time==='朝'?0:1)));}
export function latestBody(weights:Weight[]) {const list=bodyHistory(weights);return {latest:list.at(-1),previous:list.at(-2)};}
export const formatBody=(key:keyof BodyComp,value:number)=>{const f=bodyFields.find(f=>f.key===key)!;return `${f.step===0.5?String(value):f.step<1?value.toFixed(1):Math.round(value).toLocaleString("ja-JP")}${f.unit}`;};
