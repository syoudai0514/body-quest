import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,today} from '../src/domain';
import {dayStatus} from '../src/DayStatus';
test('day status shows meals by slot, exercise and closing',()=>{
 const d=today(),s=freshState();s.meals=[{id:'a',date:d,slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:380.4,protein:10,fat:5,carbs:50},{id:'b',date:d,slot:'朝食',name:'y',quantity:1,source:'',estimated:true,kcal:100,protein:1,fat:1,carbs:1}];s.exercises=[{id:'e',date:d,name:'歩く',minutes:20,details:''}];
 const st=dayStatus(s,d);assert.deepEqual(st.bySlot.map(b=>[b.slot,b.count,b.kcal]),[['朝食',2,480],['昼食',0,0],['夕食',0,0],['間食',0,0]]);assert.equal(st.mealSlots,1);assert.equal(st.exercise.length,1);assert.equal(st.closed,false);assert.equal(st.weight,false);
});
