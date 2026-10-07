import type {StrengthSet} from './types';
// Keep consecutive runs: combining separated exercises would reorder circuits/supersets.
export function groupSets<T extends {exercise:string}>(sets:T[]):T[][] {
 const groups:T[][]=[];
 for(const set of sets){const last=groups.at(-1);if(last?.[0].exercise===set.exercise)last.push(set);else groups.push([set]);}
 return groups;
}
export function describeSets(sets:StrengthSet[]):string[] {
 const runs:{set:StrengthSet;count:number}[]=[];
 for(const set of sets){const last=runs.at(-1);if(last&&last.set.kg===set.kg&&last.set.reps===set.reps&&last.set.rir===set.rir&&!!last.set.warmup===!!set.warmup)last.count++;else runs.push({set,count:1});}
 return runs.map(({set,count})=>`${set.warmup?'準備 · ':''}${set.kg===0?'自重':`${set.kg}kg`} × ${set.reps}回 × ${count}セット${set.rir===undefined?'':` · 余力${set.rir}回`}`);
}
