import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import handler from '../api/assistant';
type Request=Parameters<typeof handler>[0];
async function call(method:string,body?:unknown,extra:Record<string,string|undefined>={}){let payload='',status=200;const req=Object.assign(Readable.from([]),{method,body,headers:{host:'localhost',origin:'http://localhost','content-type':'application/json','sec-fetch-site':'same-origin',...extra}}) as Request;const res={setHeader(){},get statusCode(){return status;},set statusCode(s:number){status=s;},end(s:string){payload=s;}} as unknown as ServerResponse;await handler(req,res);return {status,body:JSON.parse(payload)};}
test('several photos of one meal go in one request, within count and size limits, and one bad item keeps the rest',async context=>{process.env.GEMINI_API_KEY='test-only';context.after(()=>{delete process.env.GEMINI_API_KEY;});
 const png='data:image/png;base64,iVBORw0KGgo=';
 const fetchMock=context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'ご飯',portion:'150g',kcal:234,protein:3.8,fat:0.5,carbs:55.7,estimated:true,note:'1枚目'},{name:'カフェラテ',portion:'200g',kcal:103,protein:15,fat:0,carbs:10.3,estimated:false,basis:'label',label:{portion:'1本（430ml）',kcal:193,protein:30,fat:0,carbs:18.5},note:'2枚目'},{name:'壊れた',kcal:'?'}]})}]}}]}),{status:200}));
 const r=await call('POST',{task:'food',text:'昼ごはん',images:[png,png.replace('png','jpeg')]});
 assert.equal(r.status,200);assert.equal(r.body.foods.length,2);assert.equal(r.body.skipped,1);assert.match(r.body.foods[1].issue,/推定値/);
 const sent=JSON.parse(fetchMock.mock.calls.at(-1)!.arguments[1]!.body as string);
 assert.deepEqual(sent.contents.at(-1).parts.filter((p:{inlineData?:unknown})=>p.inlineData).map((p:{inlineData:{mimeType:string}})=>p.inlineData.mimeType),['image/png','image/jpeg']);
 assert.match(sent.contents.at(-1).parts[0].text,/二重に数えない/);
 const calls=fetchMock.mock.callCount();
 for(const bad of [{images:[png,png,png,png,png]},{images:[]},{images:[png,'data:text/html;base64,abc']},{images:[png],image:png},{images:['data:image/png;base64,'+'A'.repeat(1900000),'data:image/png;base64,'+'A'.repeat(1900000)]}])
  assert.equal((await call('POST',{task:'food',text:'x',...bad})).status,400,JSON.stringify(Object.keys(bad)));
 assert.equal((await call('POST',{task:'body',text:'x',images:[png]})).status,400,'only meals take several photos');
 assert.equal(fetchMock.mock.callCount(),calls);
 fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'壊れた',kcal:'?'}]})}]}}]}),{status:200}));
 assert.equal((await call('POST',{task:'food',text:'x',images:[png]})).status,502);
});
