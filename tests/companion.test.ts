import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companion,recentBriefs} from '../src/companion';
import {homeReport,validAdvice} from '../src/homeCoach';
import {freshState,offsetDate,validateState} from '../src/domain';
import {totalXp} from '../src/game';
import type {AppState,BriefPhase,HomeBriefRecord,Meal} from '../src/types';

const date='2026-10-23';
const meal=(d:string,name='納豆ご飯'):Meal=>({id:crypto.randomUUID(),date:d,slot:'朝食',name,quantity:1,kcal:350,protein:16,fat:10,carbs:50,source:'test',estimated:true});
const advice={headline:'朝の平均は順調',summary:'夜の体重は水分で増えることも。',tips:['たんぱく質を補給']};
const record=(d:string,phase:BriefPhase,focusId?:string):HomeBriefRecord=>({id:`${d}:${phase}`,date:d,phase,attemptedAt:d+'T08:00:00Z',generatedAt:d+'T08:00:00Z',brief:advice,briefSignature:'old',...(focusId?{focusId,companionVersion:2}:{})});
function fixture(){const s=freshState();for(let i=1;i<=7;i++)s.meals.push(meal(offsetDate(date,-i)));return s;}

test('memory includes old backups but is bounded and excludes future phases/dates',()=>{
 const s=fixture();s.homeBriefs=Array.from({length:9},(_,i)=>record(offsetDate(date,-i),'morning'));
 s.homeBriefs.push(record(date,'evening'),record(offsetDate(date,1),'morning'));
 const m=recentBriefs(s,date,'morning');assert.equal(m.length,6);assert.ok(m.every(r=>r.date<=date&&r.phase==='morning'));assert.equal(m[0].headline,advice.headline);
 assert.ok(!JSON.stringify(m).includes('photos'));assert.equal(recentBriefs({...s,homeBriefs:[]},date).length,0);
});
test('topic selection changes over phases and avoids recently discussed topics, without inventing facts',()=>{
 const s=fixture();const seen:string[]=[];
 for(const hour of [8,13,19]){const r=homeReport(s,date,hour),c=companion(s,r);assert.ok(!seen.includes(c.focus.id));seen.push(c.focus.id);s.homeBriefs=[...(s.homeBriefs??[]),record(date,r.phase,c.focus.id)];assert.ok(validAdvice(c.fallback));}
 assert.equal(seen[0],'familiar');assert.equal(seen[2],'reflection');
 const r=homeReport(s,date,8),c=companion(s,r,'familiar');assert.match(c.focus.fact,/7日記録/);assert.equal(c.focus.done,false);
 s.meals.push(meal(date));assert.equal(companion(s,homeReport(s,date,8),'familiar').focus.done,true);
});
test('offline perspective switching reaches multiple topics and grants no XP',()=>{
 const s=fixture(),r=homeReport(s,date,8),before=JSON.stringify(s),xp=totalXp(s,date),seen:string[]=[];
 for(let i=0;i<5;i++){const c=companion(s,r,undefined,seen);assert.ok(!seen.includes(c.focus.id));seen.push(c.focus.id);}
 assert.equal(JSON.stringify(s),before);assert.equal(totalXp(s,date),xp);
});
test('pain and rapid loss override all topic preferences, with no workout or restriction quest',()=>{
 const s=fixture();s.painDates=[date];let r=homeReport(s,date,13),c=companion(s,r,'movement','recovery');
 assert.equal(c.priority,'recovery');assert.equal(c.focus.id,'recovery');assert.equal(c.focus.action,undefined);assert.equal(c.focus.done,false);assert.match(c.focus.mission,/痛み/);
 s.painDates=[];r={...homeReport(s,date,13),tooFast:true};c=companion(s,r,'movement');assert.equal(c.focus.id,'recovery');assert.match(c.focus.mission,/食事をさらに削らず/);
});
test('future health records cannot change a past focus, its XP, counts or memory',()=>{
 const s=fixture(),r=homeReport(s,date,8),before=companion(s,r,'discovery');
 s.meals.push(meal(offsetDate(date,1),'未来の料理'));s.weights.push({id:'future',date:offsetDate(date,1),time:'朝',kg:80});s.homeBriefs=[record(offsetDate(date,1),'morning','discovery')];
 assert.deepEqual(companion(s,homeReport(s,date,8),'discovery'),before);
});
test('game off removes role play; coach tone is respected even without AI',()=>{
 const s=fixture();s.settings.gameMode=false;s.settings.coachMode='gentle';const r=homeReport(s,date,8),c=companion(s,r,'rhythm');
 assert.equal(c.game,false);assert.doesNotMatch(c.fallback.headline+c.fallback.summary,/冒険|セーブ|装備|経験値/);assert.match(c.fallback.summary,/できそうなとき/);
 s.settings.coachMode='direct';assert.match(companion(s,r,'rhythm').fallback.summary,/次の一手/);
});
test('quest success is derived from records, can be undone, and workout completion does not add exercise',()=>{
 const s=fixture();s.exercises=[{id:'walk',date,name:'散歩',minutes:20,details:'',kind:'cardio'}];const c=companion(s,homeReport(s,date,13),'movement');
 assert.equal(c.focus.done,true);assert.equal(c.focus.action,undefined);assert.match(c.focus.why,/追加しなくて/);
 s.closedDays={[date]:{weight:80,expenditure:2400}};assert.equal(companion(s,homeReport(s,date,19),'reflection').focus.done,true);
 delete s.closedDays[date];assert.equal(companion(s,homeReport(s,date,19),'reflection').focus.done,false);
});
test('focus metadata round trips without changing old backups and rejects malformed records',()=>{
 const s=fixture();s.homeBriefs=[record(date,'morning','familiar')];assert.equal(validateState(JSON.parse(JSON.stringify(s))).homeBriefs?.[0].focusId,'familiar');
 s.homeBriefs=[record(date,'morning')];assert.ok(validateState(s));
 for(const patch of [{focusId:'x'.repeat(41)},{focusId:7},{companionVersion:-1},{companionVersion:1.5}])assert.throws(()=>validateState({...s,homeBriefs:[{...s.homeBriefs![0],...patch}]}));
});
