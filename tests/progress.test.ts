import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,offsetDate,today} from '../src/domain';
import {actualPace,celebration,goalSuggestions,loggingStreak,progressSummary} from '../src/progress';
import type {AppState} from '../src/types';

const d=today();
function plan(perWeek:number,days=16):AppState{const s=freshState();s.settings={...s.settings,startWeight:89,targetWeight:85,startDate:offsetDate(d,-days),deadline:offsetDate(d,35),energy:{age:42,height:182,sex:'male',activity:1.3,exerciseMode:'separate',weeklyExerciseKcal:0},nutritionMode:'auto'};for(let i=days;i>=0;i--)s.weights.push({id:'w'+i,date:offsetDate(d,-i),time:'朝',kg:+(89-(days-i)*perWeek/7).toFixed(2)});return s;}

test('streak counts consecutive logged days, ending yesterday while today is open',()=>{const s=freshState();for(const i of [1,2,3,5])s.weights.push({id:String(i),date:offsetDate(d,-i),time:'朝',kg:80});assert.equal(loggingStreak(s,d),3);s.meals.push({id:'m',date:d,slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:1,protein:0,fat:0,carbs:0});assert.equal(loggingStreak(s,d),4);});
test('measured pace uses the two-week trend, or the first days once they span 5 days',()=>{const s=plan(0.6);assert.equal(actualPace(s,d)?.basis,'trend');const e=plan(0.6,5);assert.equal(actualPace(e,d)?.basis,'early');assert.ok(Math.abs(actualPace(e,d)!.kgPerWeek-0.6)<0.05);assert.equal(actualPace(plan(0.6,3),d),null);});
test('verdict compares measured pace with the pace still needed',()=>{
 const needed=(c:number)=>(c-85)/(35/7);
 const fast=progressSummary(plan(0.8),d)!;assert.equal(fast.verdict,'ahead');assert.ok(fast.pace!.kgPerWeek>needed(fast.current));
 assert.equal(progressSummary(plan(0.5),d)!.verdict,'onTrack');
 assert.equal(progressSummary(plan(0.15),d)!.verdict,'behind');
 assert.equal(progressSummary(plan(1.2),d)!.verdict,'tooFast');
 const s=plan(0.8);assert.ok(s.weights.length);const p=progressSummary(s,d)!;assert.equal(p.milestone,Math.floor(p.lost));assert.ok(p.pct>0&&p.pct<100);assert.equal(p.streak,17);
});
test('goal suggestions: extend or adjust when behind, never lower the bar when on pace',()=>{
 const behind=goalSuggestions(plan(0.15),d);assert.ok(behind.some(s=>s.kind==='deadline'));assert.ok(behind.every(s=>s.kind!=='target'||(s.value as number)>85));
 assert.deepEqual(goalSuggestions(plan(0.5),d),[]);
 assert.ok(goalSuggestions(plan(1.2),d).every(s=>s.kind==='deadline'));
});
test('celebrations: new personal best and 1 kg milestones of the 7-day average',()=>{
 const before=plan(0.5),after={...before,weights:before.weights.map(w=>w.date===d?{...w,kg:w.kg-0.6}:w)};
 assert.match(celebration({...before,weights:before.weights.filter(w=>w.date!==d)},after,d)??'',/自己ベスト|達成/);
 const same={...before,weights:before.weights.map(w=>w.date===d?{...w,kg:89.5}:w)};assert.equal(celebration({...before,weights:before.weights.filter(w=>w.date!==d)},same,d),null);
});
