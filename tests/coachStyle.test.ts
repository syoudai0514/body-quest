import {test} from 'node:test';
import assert from 'node:assert/strict';
import {styleAdvice,styleOf,coachStylePrompt} from '../src/coachStyle';
import {freshState,validateState} from '../src/domain';
import {homeSignature} from '../src/homeCoach';
test('character defaults and backup compatibility preserve independent advice intensity',()=>{
 const s=freshState();assert.equal(styleOf(s.settings.coachStyle),'normal');assert.ok(validateState(s));
 for(const style of ['normal','energetic','beauty'] as const){s.settings.coachStyle=style;s.settings.coachMode='gentle';const restored=validateState(JSON.parse(JSON.stringify(s)));assert.equal(restored.settings.coachStyle,style);assert.equal(restored.settings.coachMode,'gentle');}
 assert.throws(()=>validateState({...s,settings:{...s.settings,coachStyle:'unknown'}}));
});
test('style invalidates cached advice and local fallback preserves all factual comments',()=>{
 const s=freshState(),signature=homeSignature(s,'2026-10-24','morning'),a={headline:'状況',summary:'朝の平均は80.2kg。',tips:['食事：あと30g','運動・回復：記録済み','体重・計画：計画を確認']};
 for(const style of ['energetic','beauty'] as const){s.settings.coachStyle=style;assert.notEqual(homeSignature(s,'2026-10-24','morning'),signature);const b=styleAdvice(a,style);assert.match(b.summary,/80.2kg/);assert.deepEqual(b.tips,a.tips);assert.notEqual(b.headline,a.headline);assert.match(coachStylePrompt(style),/キャラクター/);}
 assert.equal(styleAdvice(a,'normal'),a);
});
