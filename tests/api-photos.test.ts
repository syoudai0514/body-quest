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
 const ten=await call('POST',{task:'food',text:'10枚',images:Array.from({length:10},()=>png)});assert.equal(ten.status,200);
 const r=await call('POST',{task:'food',text:'昼ごはん',images:[png,png.replace('png','jpeg')]});
 assert.equal(r.status,200);assert.equal(r.body.foods.length,2);assert.equal(r.body.skipped,1);assert.match(r.body.foods[1].issue,/推定値/);
 const sent=JSON.parse(fetchMock.mock.calls.at(-1)!.arguments[1]!.body as string);
 assert.deepEqual(sent.contents.at(-1).parts.filter((p:{inlineData?:unknown})=>p.inlineData).map((p:{inlineData:{mimeType:string}})=>p.inlineData.mimeType),['image/png','image/jpeg']);
 assert.match(sent.contents.at(-1).parts[0].text,/二重に数えない/);
 const calls=fetchMock.mock.callCount();
 for(const bad of [{images:Array.from({length:11},()=>png)},{images:[]},{images:[png,'data:text/html;base64,abc']},{images:[png],image:png},{images:['data:image/png;base64,'+'A'.repeat(1900000),'data:image/png;base64,'+'A'.repeat(1900000)]}])
  assert.equal((await call('POST',{task:'food',text:'x',...bad})).status,400,JSON.stringify(Object.keys(bad)));
 assert.equal((await call('POST',{task:'body',text:'x',images:[png]})).status,400,'only meals take several photos');
 assert.equal(fetchMock.mock.callCount(),calls);
 fetchMock.mock.mockImplementation(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'壊れた',kcal:'?'}]})}]}}]}),{status:200}));
 assert.equal((await call('POST',{task:'food',text:'x',images:[png]})).status,502);
});
test('photos keep full quality while they fit; past the limit the largest shrinks a step at a time from its original',async()=>{
 const {fitFoodPhotos}=await import('../src/storage.ts');
 const sizes:Record<number,number>={1024:600,896:400,768:300};
 const encode=async(_f:File,side=1280)=>'x'.repeat(sizes[side]);
 const photo=(n:number)=>({file:new File([],'p'),data:'x'.repeat(n),level:0});
 const same=await fitFoodPhotos([photo(900),photo(500)],2000,encode);assert.deepEqual(same.map(p=>p.level),[0,0],'nothing shrinks when it fits');
 const fitted=await fitFoodPhotos([photo(900),photo(800),photo(500)],1800,encode);
 assert.ok(fitted.reduce((n,p)=>n+p.data.length,0)<=1800);assert.deepEqual(fitted.map(p=>p.level),[1,1,0]);
 await assert.rejects(fitFoodPhotos([photo(900),photo(900)],500,encode),/枚数を減らして/);
});
test('a busy model (5xx) hands the request to the fallback models; refusals say what happened and are logged without content',async context=>{process.env.GEMINI_API_KEY='test-only';process.env.GEMINI_MODEL='gemini-main';delete process.env.GEMINI_FALLBACK_MODELS;context.after(()=>{delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;delete process.env.GEMINI_FALLBACK_MODELS;});
 const logs:string[]=[];context.mock.method(console,'error',(m:string)=>{logs.push(m);});const warns:string[]=[];context.mock.method(console,'warn',(m:string)=>{warns.push(m);});
 const ok=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({foods:[{name:'ご飯',portion:'150g',kcal:234,protein:3.8,fat:0.5,carbs:55.7,estimated:true,note:''}]})}]}}]}),{status:200});
 const fail=(status:number,message='busy')=>new Response(JSON.stringify({error:{code:status,status:'X',message}}),{status});
 const png='data:image/png;base64,iVBORw0KGgo=',urls:string[]=[];
 let replies:Response[]=[];const fetchMock=context.mock.method(globalThis,'fetch',async(url:string)=>{urls.push(String(url));return replies.shift()!;});
 const model=(u:string)=>u.match(/models\/([^:]+):/)![1];
 // busy main model -> first fallback answers
 replies=[fail(503,'This model is currently experiencing high demand'),ok()];
 const switched=await call('POST',{task:'food',text:'焼き鳥',images:[png,png]});
 assert.equal(switched.status,200);assert.deepEqual(urls.map(model),['gemini-main','gemini-flash-latest']);
 assert.deepEqual(JSON.parse(warns.at(-1)!),{event:'gemini_fallback',task:'food',from:'gemini-main',to:'gemini-flash-latest'});
 // a missing fallback is skipped
 urls.length=0;replies=[fail(503),fail(404,'not found'),ok()];assert.equal((await call('POST',{task:'food',text:'x'})).status,200);assert.deepEqual(urls.map(model),['gemini-main','gemini-flash-latest','gemini-flash-lite-latest']);
 // all busy: the main model's reason is shown, every failure is logged
 urls.length=0;logs.length=0;replies=[fail(503,'This model is currently experiencing high demand'),fail(503),fail(429,'quota')];
 const busy=await call('POST',{task:'food',text:'焼き鳥',images:[png,png]});
 assert.equal(busy.status,502);assert.match(busy.body.error,/混み合っている/);assert.match(busy.body.error,/Gemini 503/);assert.equal(urls.length,3,'main plus two fallbacks, no more');
 const entries=logs.map(l=>JSON.parse(l));assert.deepEqual(entries.map(e=>[e.model,e.status]),[['gemini-main',503],['gemini-flash-latest',503],['gemini-flash-lite-latest',429]]);
 assert.deepEqual([entries[0].event,entries[0].task,entries[0].images],['gemini_error','food',2]);assert.match(entries[0].reason,/high demand/);
 assert.ok(!logs.join('').includes('焼き鳥')&&!logs.join('').includes('iVBOR')&&!logs.join('').includes('test-only'),'no text, photo or key in the logs');
 // the main model's own refusals are not passed on to fallbacks
 for(const [status,pattern] of [[400,/写真の枚数を減らす/],[403,/利用権限/],[429,/利用上限/],[404,/モデル名/]] as const){urls.length=0;replies=[fail(status,'Request payload size exceeds the limit')];const r=await call('POST',{task:'food',text:'x',images:[png]});assert.match(r.body.error,pattern);assert.match(r.body.error,new RegExp(`Gemini ${status}`));assert.equal(urls.length,1);}
 // the fallback list can be configured or turned off
 process.env.GEMINI_FALLBACK_MODELS='';urls.length=0;replies=[fail(503)];assert.equal((await call('POST',{task:'food',text:'x'})).status,502);assert.equal(urls.length,1);
 assert.equal(fetchMock.mock.callCount()>0,true);
});
test('fallback models are deduplicated, validated, exclude the main model and are at most three',async()=>{
 const {fallbackModels}=await import('../api/assistant.ts');
 assert.deepEqual(fallbackModels('gemini-a',undefined),['gemini-flash-latest','gemini-flash-lite-latest']);
 assert.deepEqual(fallbackModels('gemini-a','gemini-b, gemini-a ,gemini-b,evil/../x,gemini-c,gemini-d,gemini-e'),['gemini-b','gemini-c','gemini-d']);
 assert.deepEqual(fallbackModels('gemini-a',''),[]);
});
