import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,validateState} from '../src/domain';
import {bodyOk,cleanBody,latestBody} from '../src/body';

test('scale readings keep known in-range values only and round to display precision',()=>{
 assert.deepEqual(cleanBody({bodyFat:24.73,muscle:39.7,visceral:14,bmr:1810.4,bodyAge:42,bmi:26,water:53,protein:18.3,bone:3.4,leanMass:64.8}),{bodyFat:24.7,muscle:39.7,visceral:14,leanMass:64.8,water:53,protein:18.3,bone:3.4,bmr:1810,bodyAge:42,bmi:26});
 assert.deepEqual(cleanBody({bodyFat:200,muscle:'39',unknown:5,bmr:20}),undefined);
 assert.deepEqual(cleanBody({bodyFat:20,muscle:-1}),{bodyFat:20});
});
test('backups accept body composition and reject impossible or unknown values',()=>{
 const s=freshState();s.weights=[{id:'a',date:'2026-10-06',time:'朝',kg:86,body:{bodyFat:24.7,muscle:39.7}}];
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).weights[0].body,{bodyFat:24.7,muscle:39.7});
 assert.throws(()=>validateState({...s,weights:[{...s.weights[0],body:{bodyFat:120}}]}));
 assert.throws(()=>validateState({...s,weights:[{...s.weights[0],body:{hack:1}}]}));
 assert.equal(bodyOk([]),false);
});
test('latest and previous readings follow date, then morning before night',()=>{
 const w=[{id:'1',date:'2026-10-05',time:'夜' as const,kg:86.5,body:{bodyFat:25}},{id:'2',date:'2026-10-06',time:'朝' as const,kg:86,body:{bodyFat:24.7}},{id:'3',date:'2026-10-05',time:'朝' as const,kg:86.2,body:{bodyFat:25.2}},{id:'4',date:'2026-10-07',time:'朝' as const,kg:85.9}];
 const {latest,previous}=latestBody(w);assert.equal(latest?.id,'2');assert.equal(previous?.id,'1');
});
