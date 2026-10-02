import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import handler from '../api/assistant';
type Request=Parameters<typeof handler>[0];
async function call(method:string,body?:unknown,authorization?:string){let payload='',status=200;const req=Object.assign(Readable.from([]),{method,body,headers:{host:'localhost',...(authorization?{authorization}:{} )}}) as Request;const res={setHeader(){},get statusCode(){return status;},set statusCode(s:number){status=s;},end(s:string){payload=s;}} as unknown as ServerResponse;await handler(req,res);return {status,body:JSON.parse(payload)};}
test('AI endpoint fails closed without server secrets',async()=>{delete process.env.GEMINI_API_KEY;delete process.env.APP_ACCESS_PASSWORD;assert.deepEqual((await call('GET')).body,{configured:false});assert.equal((await call('POST',{task:'coach',text:'hello'})).status,503);});
test('authorized input validation, output validation, quota and provider errors',async context=>{process.env.GEMINI_API_KEY='test-only';process.env.APP_ACCESS_PASSWORD='test-only-password-12345';process.env.GEMINI_MODEL='gemini-2.5-flash-lite';context.after(()=>{delete process.env.GEMINI_API_KEY;delete process.env.APP_ACCESS_PASSWORD;delete process.env.GEMINI_MODEL;});const authorization='Bearer test-only-password-12345';assert.equal((await call('POST',{task:'food',text:'ご飯'},'Bearer wrong')).status,401);assert.equal((await call('POST',{task:'invalid',text:'hello'},authorization)).status,400);assert.equal((await call('POST',{task:'food',text:'a',image:'data:text/html;base64,abc'},authorization)).status,400);
 const fetchMock=context.mock.method(globalThis,'fetch',async(_url:unknown,options?:RequestInit)=>{assert.ok(options?.headers);const data=JSON.parse(options?.body as string);assert.ok(data.systemInstruction.parts[0].text.includes('1600kcal'));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'ご飯',portion:'150g',kcal:234,protein:3.8,fat:0.5,carbs:55.7,estimated:true,note:'量は推定'}]})}]}}]}),{status:200});});
 const result=await call('POST',{task:'food',text:'ご飯',context:{}},authorization);assert.equal(result.status,200);assert.equal(result.body.foods[0].kcal,234);
 fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"foods":[{"name":"bad","kcal":-99}]}'}]}}]}),{status:200}));assert.equal((await call('POST',{task:'food',text:'ご飯'},authorization)).status,502);
 fetchMock.mock.mockImplementation(async()=>new Response('{}',{status:429}));assert.equal((await call('POST',{task:'coach',text:'夕食は？'},authorization)).status,429);
});
