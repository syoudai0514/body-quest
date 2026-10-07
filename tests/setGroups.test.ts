import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupSets,describeSets} from '../src/setGroups';
import type {StrengthSet} from '../src/types';
const set=(exercise:string,kg=40,reps=10,extra:Partial<StrengthSet>={}):StrengthSet=>({exercise,kg,reps,...extra});
test('eight actual sets can summarize as three exercises without losing per-set values',()=>{const sets=[...Array.from({length:3},()=>set('チェスト',40,10,{rir:2})),...Array.from({length:3},()=>set('ラット',30)),...Array.from({length:2},()=>set('レッグ',55,15))];const groups=groupSets(sets);assert.deepEqual(groups.map(g=>g.length),[3,3,2]);assert.deepEqual(groups.flat(),sets);assert.deepEqual(describeSets(groups[0]),['40kg × 10回 × 3セット · 余力2回']);});
test('differing reps, RIR, missing RIR and warmups never flatten into one identical block',()=>{const sets=[set('ベンチ',20,10,{warmup:true}),set('ベンチ',40,10),set('ベンチ',40,10,{rir:0}),set('ベンチ',40,8,{rir:2})];assert.equal(describeSets(sets).length,4);assert.match(describeSets(sets)[0],/^準備/);assert.match(describeSets(sets)[2],/余力0回/);assert.match(describeSets(sets)[3],/8回/);});
test('alternating circuit exercise order is preserved rather than regrouped',()=>{const sets=[set('押す'),set('引く'),set('押す')];assert.deepEqual(groupSets(sets).map(g=>g[0].exercise),['押す','引く','押す']);assert.deepEqual(groupSets(sets).flat(),sets);assert.deepEqual(describeSets([set('腕立て',0,10)]),['自重 × 10回 × 1セット']);});
