import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,offsetDate,today,validateState} from '../src/domain';
import {achievements,boss,dailyQuests,gameOn,levelInfo,totalXp,xpFor,XP} from '../src/game';
import type {Meal} from '../src/types';

const d=today();
const meal=(date:string,slot:string,kcal=500,protein=30):Meal=>({id:crypto.randomUUID(),date,slot,name:'x',quantity:1,source:'',estimated:true,kcal,protein,fat:10,carbs:60});

test('levels need more XP as they rise and carry titles',()=>{assert.equal(levelInfo(0).level,1);assert.equal(levelInfo(0).title,'見習い冒険者');assert.equal(levelInfo(xpFor(3)).level,3);assert.equal(levelInfo(xpFor(3)-1).level,2);assert.ok(xpFor(10)-xpFor(9)>xpFor(3)-xpFor(2));assert.equal(levelInfo(xpFor(10)).title,'習慣の騎士');});
test('a full day earns XP plus the clear bonus; eating less never earns more',()=>{
 const s=freshState();s.settings.protein=80;s.weights=[{id:'w',date:d,time:'朝',kg:80}];s.meals=[meal(d,'朝食'),meal(d,'昼食'),meal(d,'夕食')];s.exercises=[{id:'e',date:d,name:'家で10分',minutes:10,details:''}];s.closedDays={[d]:{expenditure:2400,weight:80}};
 assert.equal(totalXp(s,d),XP.weight+3*XP.meal+XP.protein+XP.exercise+XP.close+XP.clear);assert.ok(dailyQuests(s,d).every(q=>q.done));
 const less={...s,meals:s.meals.map(m=>({...m,kcal:m.kcal/2}))};assert.equal(totalXp(less,d),totalXp(s,d));
 const skipped={...s,meals:s.meals.slice(0,1)};assert.ok(totalXp(skipped,d)<totalXp(s,d));
 assert.equal(totalXp(s,offsetDate(d,-1)),0);
});
test('achievements, boss HP and the opt-out setting',()=>{
 const s=freshState();for(let i=0;i<7;i++)s.weights.push({id:String(i),date:offsetDate(d,-i),time:'朝',kg:80});
 const a=achievements(s,d);assert.equal(a.find(x=>x.id==='streak7')!.earned,true);assert.equal(a.find(x=>x.id==='streak30')!.earned,false);assert.equal(boss(s,d),null);
 s.settings={...s.settings,startWeight:82,targetWeight:78,startDate:offsetDate(d,-6),deadline:offsetDate(d,60),energy:{age:40,height:175,sex:'male',activity:1.3,exerciseMode:'separate',weeklyExerciseKcal:0}};
 const b=boss(s,d)!;assert.equal(b.max,4);assert.equal(b.hp,2);assert.equal(b.defeated,false);
 assert.equal(gameOn(s.settings),true);s.settings.gameMode=false;assert.equal(gameOn(s.settings),false);assert.equal(validateState(JSON.parse(JSON.stringify(s))).settings.gameMode,false);
});
