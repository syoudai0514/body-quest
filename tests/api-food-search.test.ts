import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {ServerResponse} from 'node:http';
import handler from '../api/assistant';
type Request=Parameters<typeof handler>[0];
async function call(body:unknown){let payload='',status=200;const req=Object.assign(Readable.from([]),{method:'POST',body,headers:{host:'localhost',origin:'http://localhost','content-type':'application/json','sec-fetch-site':'same-origin'}}) as Request;const res={setHeader(){},get statusCode(){return status;},set statusCode(value:number){status=value;},end(value:string){payload=value;}} as unknown as ServerResponse;await handler(req,res);return {status,body:JSON.parse(payload)};}
test('food-search API validates input, returns source-derived values, and never forwards personal context',async context=>{
 process.env.GEMINI_API_KEY='test-only';context.after(()=>{delete process.env.GEMINI_API_KEY;});const calls:string[]=[];
 context.mock.method(globalThis,'fetch',async(url:unknown)=>{calls.push(String(url));return new Response('<h1>API検証商品</h1><table><caption>1本（430ml）あたり</caption><tr><th>エネルギー</th><td>193kcal</td></tr><tr><th>たんぱく質</th><td>30g</td></tr><tr><th>脂質</th><td>0g</td></tr><tr><th>炭水化物</th><td>18.5g</td></tr></table>',{headers:{'content-type':'text/html'}});});
 for(const input of [{text:'a'},{text:'a'.repeat(301)},{text:'商品',image:'data:image/png;base64,iVBORw0KGgo='}])assert.equal((await call({task:'foodSearch',...input})).status,400);assert.equal(calls.length,0);
 const url='https://www.meiji.co.jp/products/api-test.html',result=await call({task:'foodSearch',text:url,context:{privateHealthRecord:'not-to-be-forwarded'}});assert.equal(result.status,200);assert.deepEqual(calls,[url]);const food=result.body.foods[0];assert.deepEqual([food.kcal,food.protein,food.fat,food.carbs],[193,30,0,18.5]);assert.equal(food.nutrition.kind,'manufacturer');assert.equal(food.nutrition.url,url);assert.equal(food.portion,'1本(430ml)');
});
test('food-search API fails explicitly when a provider cannot verify real search sources',async context=>{
 process.env.GEMINI_API_KEY='test-only';context.after(()=>{delete process.env.GEMINI_API_KEY;});context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"sources":[]}'}]}}]})));const result=await call({task:'foodSearch',text:'API ungrounded search'});assert.equal(result.status,502);assert.match(result.body.error,/検索の出典/);assert.equal(result.body.foods,undefined);
});
