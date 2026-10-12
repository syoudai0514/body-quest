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
import {earnedTitles,pendingTitles,seedTitles} from '../src/game';
test('titles: ranks come with the level, badges with their goals; only unseen ones are pending, and a first look seeds without celebrating',()=>{
 const s=freshState();
 assert.deepEqual(earnedTitles(s,d).map(t=>t.id),['rank1'],'a new player starts with the first rank');
 const seeded=seedTitles(s,d);assert.deepEqual(seeded.achievementsSeen,['rank1']);assert.equal(seedTitles(seeded,d),seeded,'seeding happens once');
 assert.deepEqual(pendingTitles(seeded,d),[]);
 // first record earns 旅立ち, and three days in a row earn 三日坊主を超えて
 const one={...seeded,meals:[meal(d,'朝食')]};assert.deepEqual(pendingTitles(one,d).map(t=>t.id),['first']);
 assert.equal(pendingTitles(one,d)[0].kind,'badge');
 const three={...seeded,meals:[meal(offsetDate(d,-2),'朝食'),meal(offsetDate(d,-1),'朝食'),meal(d,'朝食')]};
 assert.deepEqual(pendingTitles(three,d).map(t=>t.id).sort(),['first','streak3']);
 // dismissing one leaves the other, and an undone record takes its title away again
 assert.deepEqual(pendingTitles({...three,achievementsSeen:[...seeded.achievementsSeen!,'first']},d).map(t=>t.id),['streak3']);
 assert.deepEqual(pendingTitles({...three,meals:three.meals.slice(1)},d).map(t=>t.id).sort(),['first'],'two days in a row is not three');
 // reaching a rank level pends the rank with a pointer to the next one
 const xp=xpFor(3),rich={...seeded,weights:Array.from({length:Math.ceil(xp/10)+2},(_,i)=>({id:String(i),date:offsetDate(d,-i),time:'朝' as const,kg:80}))};
 const rank=pendingTitles(rich,d).find(t=>t.id==='rank3');assert.ok(rank);assert.equal(rank!.kind,'rank');assert.equal(rank!.title,'駆け出しの戦士');assert.match(rank!.next!,/Lv\.6/);
 assert.ok(validateState(JSON.parse(JSON.stringify(seeded))));
 for(const bad of [{achievementsSeen:'x'},{achievementsSeen:[1]},{achievementsSeen:['']},{achievementsSeen:Array(501).fill('a')}])assert.throws(()=>validateState({...JSON.parse(JSON.stringify(seeded)),...bad}),/称号/);
});
