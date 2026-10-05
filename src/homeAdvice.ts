import type {HomeAdvice} from './types';
export function validAdvice(value:unknown):value is HomeAdvice {
 if(!value||typeof value!=='object')return false;
 const b=value as HomeAdvice;
 return typeof b.headline==='string'&&!!b.headline.trim()&&b.headline.length<=80&&typeof b.summary==='string'&&!!b.summary.trim()&&b.summary.length<=400&&Array.isArray(b.tips)&&b.tips.length<=3&&b.tips.every(t=>typeof t==='string'&&!!t.trim()&&t.length<=200);
}
