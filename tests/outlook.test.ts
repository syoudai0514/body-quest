import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,offsetDate,validateState} from '../src/domain';
import {defaultEnergy,basal} from '../src/energy';
import {intakeBounds,nutritionPlan,planError,policyOf,syncNutrition} from '../src/planning';
import {goalOutlook} from '../src/outlook';
import {aiContext} from '../src/ai';
const day='2026-10-02';
function fixture(){const s=freshState();s.settings={...s.settings,startDate:day,deadline:offsetDate(day,51),startWeight:88,targetWeight:80,energy:{...defaultEnergy,age:42,height:182,activity:1.2},nutritionMode:'auto'};return s;}
test('short deadline shows attainable weight, unmet target, earliest model date and delay',()=>{
 const s=fixture(),o=goalOutlook(s,day)!;
 assert.ok(o.configured.projected>85&&o.configured.projected<86);assert.equal(o.configured.projected,o.standard.projected);
 assert.equal(o.standard.reachedDays,177);assert.equal(o.standard.date,offsetDate(day,177));assert.equal(o.standard.daysBeyondDeadline,126);
 assert.ok(o.flexible.projected<o.standard.projected);assert.equal(o.flexible.reachedDays,147);
 assert.match(o.note,/保証しない/);
 const extended=goalOutlook({...s,settings:{...s.settings,deadline:o.bound.date!}},day)!;
 assert.equal(extended.bound.projected,80);assert.equal(extended.bound.daysBeyondDeadline,0);
});
test('below-BMR calculation requires explicit acknowledgement and retains deficit and intake bounds',()=>{
 const s=fixture(),standard=nutritionPlan(s,day)!;s.settings.caloriePolicy='flexible';
 assert.equal(policyOf(s.settings),'standard');assert.equal(nutritionPlan(s,day)!.kcal,standard.kcal);
 assert.match(planError(s.settings),/チェック/);assert.throws(()=>validateState(s));
 s.settings.belowBmrAcknowledged=true;const n=nutritionPlan(s,day)!;
 assert.equal(n.kcal,1740);assert.ok(n.kcal<n.bmr);assert.ok(n.kcal>=1600);
 assert.ok(n.deficit<=n.expenditure*.2);assert.ok(n.deficit<=88*.0075*7700/7);
 assert.equal(validateState(syncNutrition(s,day)).settings.caloriePolicy,'flexible');
 assert.equal(goalOutlook(s,day)!.bound.policy,'flexible');assert.equal(aiContext(s,day).energyPlan.outlook!.bound.policy,'flexible');
});
test('rounded limits never exceed either deficit cap across low/high profiles',()=>{
 for(const sex of ['male','female'] as const)for(const weight of [55,88,150,300])for(const activity of [1.2,1.7,2])for(const policy of ['standard','flexible'] as const){
  const p={...defaultEnergy,sex,age:42,height:182,activity};const b=intakeBounds(weight,p,0,policy);
  assert.ok(b.minimumCalories>=1600);assert.ok(b.expenditure-b.minimumCalories<=b.deficitCap);
  if(policy==='standard')assert.ok(b.minimumCalories>=basal(weight,p));
 }
 const s=fixture();s.settings.startWeight=300;s.settings.energy={...s.settings.energy!,activity:2,weeklyExerciseKcal:4200};
 assert.equal(nutritionPlan(s,day)!.outOfRange,true);assert.equal(syncNutrition(s,day).settings.kcal,s.settings.kcal);
 assert.match(planError(s.settings),/対応範囲/);
});
test('already achieved, expired and unreachable targets produce honest outcomes',()=>{
 const s=fixture();s.settings.targetWeight=88;assert.equal(goalOutlook(s,day)!.bound.reachedDays,0);
 s.settings.targetWeight=80;s.settings.deadline=day;const expired=goalOutlook(s,day)!;assert.equal(expired.expired,true);assert.equal(expired.bound.projected,88);
 s.settings.deadline=offsetDate(day,365);s.settings.startWeight=55;s.settings.targetWeight=53;s.settings.energy={...defaultEnergy,sex:'female',age:70,height:155,activity:1.2};
 const unreachable=goalOutlook(s,day)!;assert.equal(unreachable.bound.blocked,true);assert.equal(unreachable.bound.date,null);assert.equal(unreachable.bound.projected,55);
 assert.equal(goalOutlook(freshState(),day),null);
});
test('forecast uses latest measured weight, ignores future records, and matches tomorrow auto target',()=>{
 const s=fixture();s.weights=[{id:'w',date:day,time:'朝',kg:86},{id:'future',date:offsetDate(day,2),time:'朝',kg:70}];
 const n=nutritionPlan(s,day)!;const tomorrow=offsetDate(day,1);s.settings.deadline=tomorrow;
 const one=nutritionPlan(s,day)!,o=goalOutlook(s,day)!;assert.equal(o.current,86);
 assert.ok(Math.abs(o.configured.projected-(86-one.deficit/7700))<1e-10);assert.ok(n.kcal>0);
 s.settings.nutritionMode='manual';s.settings.kcal=2000;
 assert.ok(Math.abs(goalOutlook(s,day)!.configured.projected-(86-(basal(86,s.settings.energy!)*1.2-2000)/7700))<1e-10);
});
test('new manual goals follow selected limits, while legacy imports remain unchanged',()=>{
 const s=fixture();s.settings.nutritionMode='manual';s.settings.kcal=1740;
 assert.match(planError(s.settings),/詳細調整/);
 s.settings.caloriePolicy='flexible';s.settings.belowBmrAcknowledged=true;assert.equal(planError(s.settings),'');
 s.settings.kcal=1600;assert.match(planError(s.settings),/設定下限/);
 delete s.settings.caloriePolicy;delete s.settings.belowBmrAcknowledged;assert.equal(validateState(s).settings.kcal,1600);
});
