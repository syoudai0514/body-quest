import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import handler from '../api/assistant';
test('character instructions reach brief and chat only, independently from intensity and OCR',async t=>{
 const before=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';t.after(()=>{if(before===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=before;});
 const sent:string[]=[];t.mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{const data=JSON.parse(options!.body as string);sent.push(data.systemInstruction.parts[0].text);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'応援しています。'}]}}]}));});
 for(const [style,word] of [['energetic','熱血の応援団長'],['beauty','親しみやすい美容系インフルエンサー'],['normal','キャラクターはノーマル']]){
  let status=0;const req=Object.assign(Readable.from([]),{method:'POST',headers:{host:'localhost',origin:'http://localhost','content-type':'application/json'},body:{task:'coach',text:'今日の作戦は？',context:{settings:{coachStyle:style,coachMode:'gentle'}}}}) as Parameters<typeof handler>[0];
  await handler(req,{setHeader(){},set statusCode(s:number){status=s;},end(){}} as unknown as ServerResponse);assert.equal(status,200);assert.ok(sent.at(-1)!.includes(word));assert.match(sent.at(-1)!,/やさしめ/);
  req.body={task:'food',text:'ごはん',context:{settings:{coachStyle:style}}};await handler(req,{setHeader(){},set statusCode(s:number){status=s;},end(){}} as unknown as ServerResponse);assert.ok(!sent.at(-1)!.includes(word));
 }
});
