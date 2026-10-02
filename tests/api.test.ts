import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import handler from '../api/assistant';
type Request=Parameters<typeof handler>[0];
async function call(method:string,body?:unknown,extra:Record<string,string|undefined>={}){let payload='',status=200;const req=Object.assign(Readable.from([]),{method,body,headers:{host:'localhost',origin:'http://localhost','content-type':'application/json','sec-fetch-site':'same-origin',...extra}}) as Request;const res={setHeader(){},get statusCode(){return status;},set statusCode(s:number){status=s;},end(s:string){payload=s;}} as unknown as ServerResponse;await handler(req,res);return {status,body:JSON.parse(payload)};}
test('AI is unavailable without its server key and needs no access password',async()=>{delete process.env.GEMINI_API_KEY;delete process.env.APP_ACCESS_PASSWORD;assert.deepEqual((await call('GET')).body,{configured:false});assert.equal((await call('POST',{task:'coach',text:'hello'})).status,503);process.env.GEMINI_API_KEY='test-only';assert.deepEqual((await call('GET')).body,{configured:true});delete process.env.GEMINI_API_KEY;});
test('passwordless same-origin JSON, input/output validation and quota',async context=>{process.env.GEMINI_API_KEY='test-only';process.env.GEMINI_MODEL='gemini-3.5-flash-lite';context.after(()=>{delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;});
 const fetchMock=context.mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{const data=JSON.parse(options?.body as string);assert.ok(data.systemInstruction.parts[0].text.includes('1600kcal'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'ご飯',portion:'150g',kcal:234,protein:3.8,fat:0.5,carbs:55.7,estimated:false,note:'量は推定'}]})}]}}]}),{status:200});});
 assert.equal((await call('POST',{task:'coach',text:'hello'},{origin:undefined})).status,403);
 assert.equal((await call('POST',{task:'coach',text:'hello'},{origin:'https://another.example'})).status,403);
 assert.equal((await call('POST',{task:'coach',text:'hello'},{origin:'null'})).status,403);
 assert.equal((await call('POST',{task:'coach',text:'hello'},{'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await call('POST',{task:'coach',text:'hello'},{'content-type':'text/plain'})).status,415);
 assert.equal(fetchMock.mock.callCount(),0);
 assert.equal((await call('POST',{task:'invalid',text:'hello'})).status,400);
 assert.equal((await call('POST',{task:'food',text:'a',image:'data:text/html;base64,abc'})).status,400);
 for(const [mode,word] of [['gentle','やさしめ'],['balanced','バランス'],['direct','厳しめ']]){await call('POST',{task:'coach',text:'夕食は？',context:{settings:{coachMode:mode}}});const data=JSON.parse(fetchMock.mock.calls.at(-1)!.arguments[1]!.body as string);assert.ok(data.systemInstruction.parts[0].text.includes(word));assert.ok(!data.systemInstruction.parts[0].text.includes('目的は七五三'));}
 const result=await call('POST',{task:'food',text:'ご飯',context:{}});assert.equal(result.status,200);assert.equal(result.body.foods[0].kcal,234);assert.equal(result.body.foods[0].estimated,true);
 fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"foods":[{"name":"bad","kcal":-99}]}'}]}}]}),{status:200}));assert.equal((await call('POST',{task:'food',text:'ご飯'})).status,502);
 fetchMock.mock.mockImplementation(async()=>new Response('{}',{status:429}));assert.equal((await call('POST',{task:'coach',text:'夕食は？'})).status,429);
 fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'回答'}]}}]}),{status:200}));
 let limited=false;for(let i=0;i<31;i++){const r=await call('POST',{task:'coach',text:'夕食は？'});if(r.status===429){limited=true;break;}assert.equal(r.status,200);}assert.equal(limited,true);const calls=fetchMock.mock.callCount();assert.equal((await call('POST',{task:'coach',text:'夕食は？'})).status,429);assert.equal(fetchMock.mock.callCount(),calls);
});
