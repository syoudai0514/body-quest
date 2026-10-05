import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,latestRecord,morningAverage,offsetDate,presets,today,validateState,withPresets} from '../src/domain';
import {copyMeals,mealFromHistory,mealHistory,mealSets,proteinPicks,proteinStatus,slotForHour} from '../src/history';
import {lastSession,menus,recommendMenu,trainingWeek} from '../src/training';
import {foodAiContext,knownFoods,todaySummary} from '../src/ai';
import type {Meal} from '../src/types';
import {applyReply,type Conversation} from '../src/Coach';

const d=today();
const meal=(date:string,slot:string,name:string,kcal:number,protein=10,quantity=1):Meal=>({id:crypto.randomUUID(),date,slot,name,quantity,source:'test',estimated:true,kcal,protein,fat:5,carbs:20});

test('slot follows the time of day',()=>{assert.equal(slotForHour(7),'朝食');assert.equal(slotForHour(12),'昼食');assert.equal(slotForHour(19),'夕食');assert.equal(slotForHour(23),'間食');});
test('history ranks frequent meals, separates amounts, prefers the slot and keeps alcohol',()=>{
 const s=freshState();
 s.meals=[meal(offsetDate(d,-1),'朝食','納豆ご飯',350),meal(offsetDate(d,-2),'朝食','納豆ご飯',350),meal(offsetDate(d,-3),'朝食','納豆ご飯',350),meal(offsetDate(d,-1),'夕食','カレー',700),meal(offsetDate(d,-1),'夕食','カレー',1050,15,1.5),{...meal(offsetDate(d,-1),'間食','ハイボール',99,0),alcoholG:14.2}];
 const morning=mealHistory(s,'朝食',d);
 assert.equal(morning[0].name,'納豆ご飯');assert.equal(morning[0].count,3);
 assert.equal(morning.filter(h=>h.name==='カレー').length,2);
 const again=mealFromHistory(morning.find(h=>h.kcal===1050)!,d,'昼食');
 assert.equal(again.quantity,1.5);assert.equal(again.slot,'昼食');assert.equal(again.date,d);
 assert.equal(mealFromHistory(morning.find(h=>h.name==='ハイボール')!,d,'間食').alcoholG,14.2);
 assert.equal(mealHistory(s,'夕食',d)[0].name,'カレー');
});
test('history ignores future and very old records',()=>{const s=freshState();s.meals=[meal(offsetDate(d,1),'朝食','未来',100),meal(offsetDate(d,-200),'朝食','昔',100)];assert.equal(mealHistory(s,'朝食',d).length,0);});
test('meal sets find repeated combinations and copies get new ids',()=>{
 const s=freshState();
 for(const i of [1,2,8])s.meals.push(meal(offsetDate(d,-i),'朝食','ヨーグルト',190),meal(offsetDate(d,-i),'朝食','ゆで卵',67,6.3));
 s.meals.push(meal(offsetDate(d,-1),'昼食','そば',400));
 const sets=mealSets(s,d);assert.equal(sets.length,1);assert.equal(sets[0].count,3);assert.equal(sets[0].slot,'朝食');assert.equal(Math.round(sets[0].kcal),257);
 const copies=copyMeals(sets[0].meals,d,'昼食');assert.ok(copies.every(m=>m.date===d&&m.slot==='昼食'&&!sets[0].meals.some(x=>x.id===m.id)));
});
test('protein status spreads target per meal and picks lean protein foods within the calorie budget',()=>{
 const s=freshState();s.settings.protein=140;s.settings.kcal=2000;s.meals=[meal(d,'朝食','トースト',300,8)];
 const p=proteinStatus(s,d);assert.equal(p.remaining,132);assert.equal(p.perMeal,40);assert.equal(p.bySlot['朝食'],8);
 const picks=proteinPicks(s,d);assert.equal(picks.length,4);assert.ok(picks.every(f=>f.protein*4/f.kcal>=0.3));assert.ok(!picks.some(f=>f.id==='rice150'));
 s.meals.push(meal(d,'昼食','大盛り',1950,10));const tight=proteinPicks(s,d);assert.ok(tight[0].kcal<=150);
});
test('new built-in foods are added to old data without overwriting edits',()=>{
 const s=freshState();s.foods=s.foods.filter(f=>f.id!=='protein-shake').map(f=>f.id==='rice150'?{...f,kcal:999}:f);
 const next=withPresets(s);assert.equal(next.foods.find(f=>f.id==='rice150')!.kcal,999);assert.ok(next.foods.some(f=>f.id==='protein-shake'));assert.equal(withPresets(next),next);assert.ok(presets.some(f=>f.category==='たんぱく質'));
});
test('workout recommendation rests muscles, alternates gym days and respects pain',()=>{
 const s=freshState();
 assert.equal(recommendMenu(s,d,'在宅',true).menu.id,'pain');
 assert.equal(recommendMenu(s,d,'在宅',false).menu.id,'home10');
 assert.equal(recommendMenu(s,d,'出社',false).menu.id,'gym-a');
 s.exercises.push({id:'1',date:offsetDate(d,-3),name:menus.find(m=>m.id==='gym-a')!.name,minutes:30,details:'チェストプレス20kg 12回×3'});
 assert.equal(recommendMenu(s,d,'出社',false).menu.id,'gym-b');
 assert.equal(lastSession(s,'ジムで30分・全身A（押す）',d)?.details,'チェストプレス20kg 12回×3');
 s.exercises.push({id:'2',date:offsetDate(d,-1),name:'筋トレ',minutes:30,details:''});
 assert.equal(recommendMenu(s,d,'出社',false).menu.id,'walk');
 s.exercises.push({id:'3',date:d,name:'家で10分',minutes:10,details:''});
 assert.equal(recommendMenu(s,d,'出社',false).menu.id,'recovery');
 assert.equal(recommendMenu(freshState(),d,'飲み会',false).menu.id,'walk');
 assert.ok(trainingWeek(s,d).strengthDays>=1);
});
test('AI food context carries the foods the user actually eats and stays small',()=>{
 const s=freshState();s.foods.push({id:'curry',name:'いつものカレー',portion:'完成後 200g',category:'作り置き',source:'x',estimated:true,kcal:320,protein:25,fat:12,carbs:28});
 for(let i=0;i<300;i++)s.meals.push(meal(offsetDate(d,-(i%60)),'夕食',`料理${i%80}`,400+i));
 const known=knownFoods(s,d);assert.equal(known[0].name,'いつものカレー');assert.ok(known.length<=40);
 assert.ok(JSON.stringify(foodAiContext(s,d)).length<12000);
});
test('history keeps meals with the same name and calories but different amount or PFC apart',()=>{
 const s=freshState();s.meals=[meal(offsetDate(d,-1),'朝食','ヨーグルト',100,5,1),meal(offsetDate(d,-2),'朝食','ヨーグルト',100,20,2)];
 const items=mealHistory(s,'朝食',d);assert.equal(items.length,2);assert.deepEqual(items.map(i=>[i.quantity,i.protein]).sort(),[[1,5],[2,20]]);
 const again=mealFromHistory(items.find(i=>i.quantity===1)!,d,'朝食');assert.equal(again.protein,5);
});
test('duplicate morning records from older data resolve to the last one and keep its waist',()=>{
 const w=[{id:'a',date:d,time:'朝' as const,kg:80},{id:'b',date:d,time:'朝' as const,kg:79,waist:85}];
 assert.deepEqual(latestRecord(w,d,'朝'),w[1]);assert.equal(morningAverage(w,d)?.value,latestRecord(w,d,'朝')!.kg);
 assert.deepEqual(latestRecord([...w,{id:'c',date:d,time:'朝',kg:78.5}],d,'朝'),{id:'c',date:d,time:'朝',kg:78.5,waist:85});
 assert.equal(latestRecord(w,d,'夜'),undefined);
});
test('a painful day reaches the AI context and the recommendation, and is validated in backups',()=>{
 const s=freshState();s.painDates=[d];
 const summary=todaySummary(s,d);assert.equal(summary.painToday,true);assert.equal(summary.suggestedWorkout.name,'回復を優先');
 assert.equal(todaySummary(freshState(),d).painToday,false);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).painDates,[d]);assert.throws(()=>validateState({...s,painDates:['2026-02-31']}));
});
test('coach replies apply only to the conversation and request that are still current',()=>{
 const pending:Conversation={id:'c1',turns:[],pending:'r1',asking:'A'};
 assert.deepEqual(applyReply(pending,'c1','r1',{exchange:{q:'A',a:'a'}}).turns,[{q:'A',a:'a'}]);
 const newer:Conversation={id:'c2',turns:[{q:'B',a:'b'}]};
 assert.equal(applyReply(newer,'c1','r1',{exchange:{q:'A',a:'a'}}),newer);
 const retried:Conversation={id:'c1',turns:[],pending:'r2'};assert.equal(applyReply(retried,'c1','r1',{error:'x'}),retried);
 assert.equal(applyReply(pending,'c1','r1',{error:'失敗'}).error,'失敗');assert.equal(applyReply(pending,'c1','r1',{error:'失敗'}).pending,undefined);
});
