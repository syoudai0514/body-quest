import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {basisForFood,calculateServing,foodFromDraft,foodIdentity,nutritionIssues,scaledDraft,searchFoods,upsertFoods,validNutritionBasis} from '../src/nutrition';
import {compositionFoods,searchComposition} from '../src/composition';
import {mealFromFood,scaleMeal,freshState,today,validateState} from '../src/domain';
import {mealFromHistory,mealHistory} from '../src/history';
import {knownFoods} from '../src/ai';
import {portionMeasure,portionCount} from '../src/portions';
import {allowedSourceUrl,nutritionTables,searchManufacturer,fetchManufacturer,catalogueLinks} from '../server/foodSources';
import type {Food,Draft} from '../src/types';
const values={kcal:193,protein:30,fat:0,carbs:18.5};
const food:Food={id:'verified',name:'ザバス カフェラテ P30',portion:'1本（430ml）',category:'マイ食品',source:'メーカー表示',estimated:false,...values,nutrition:{kind:'manufacturer',portion:'1本（430ml）',values,preparation:'ready',url:'https://www.meiji.co.jp/products/sports/4902705128804.html',checkedAt:'2026-10-08T00:00:00Z'}};
const table='<h1>テスト商品 430ml</h1><h2>栄養成分表示 1本（430ml）あたり</h2><table><tr><th>エネルギー</th><td>193kcal</td></tr><tr><th>たんぱく質</th><td>30.0g</td></tr><tr><th>脂質</th><td>0g</td></tr><tr><th>炭水化物</th><td>18.5g</td></tr><tr><th>糖質</th><td>17.8g</td></tr><tr><th>糖類</th><td>15.3g</td></tr></table>';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('common serving calculation never maps g to ml or invents a mass for a plate',()=>{
 near(calculateServing(food.nutrition!,'215ml').carbs,9.25);assert.throws(()=>calculateServing(food.nutrition!,'215g'));
 assert.equal(calculateServing({portion:'1皿',values},'1皿 ×2').kcal,386);assert.throws(()=>calculateServing({portion:'1皿',values},'100g'));
 assert.equal(portionMeasure('ヨーグルト150g・バナナ1本'),null);assert.equal(portionMeasure('粉30g・1杯')?.value,30);
});
test('photo draft keeps original precision when a consumed half is doubled or saved as a reusable food',()=>{
 const d:Draft={name:food.name,portion:'215ml',note:'写真',...calculateServing(food.nutrition!,'215ml'),estimated:false,basis:'label',nutrition:{...food.nutrition!,kind:'label'}};
 near(scaledDraft(d,2).carbs,18.5);near(scaledDraft(scaledDraft(d,.5),2).kcal,193);const stored=foodFromDraft(d);assert.equal(stored.portion,'1本（430ml）');assert.equal(stored.carbs,18.5);
 const half=mealFromFood(stored,today(),'朝食',.5);near(half.carbs,9.25);const full=scaleMeal(half,1);near(full.carbs,18.5);near(scaleMeal(scaleMeal(full,.75),1).carbs,18.5);
});
test('composition data uses the four labelled columns and explicit raw/cooked foods rather than amino acids or sugars',()=>{
 const raw=JSON.parse(fs.readFileSync('public/food-composition.json','utf8'));assert.equal(raw.foods.length,2537);assert.equal(raw.sourceSha256.length,64);const foods=compositionFoods(raw),chicken=foods.find(f=>f.id==='mext-11220')!;assert.deepEqual([chicken.kcal,chicken.protein,chicken.fat,chicken.carbs],[105,23.3,1.9,.1]);assert.equal(chicken.nutrition?.preparation,'raw');assert.equal(calculateServing(chicken.nutrition!,'200g').protein,46.6);
 assert.ok(searchComposition(foods,'鶏むね 生').some(f=>f.id===chicken.id));assert.ok(searchComposition(foods,'ご飯').some(f=>/めし/.test(f.name)));
});
test('local search accepts spaces, fullwidth characters, English brand and separate variants',()=>{
 assert.equal(searchFoods([food],'ＳＡＶＡＳ カフェラテ 430').length,1);const other={...food,id:'p20',name:'ザバス カフェラテ P20',portion:'200ml',nutrition:{...food.nutrition!,portion:'200ml'}};assert.equal(searchFoods([food,other],'カフェラテ').length,2);assert.notEqual(foodIdentity(food),foodIdentity(other));assert.equal(searchFoods([{...food,archived:true}],'ザバス').length,0);
});
test('repeated verified food reuses its identity; real revisions retain original values and previous meals',()=>{
 const foods=upsertFoods([], [food]),meal=mealFromFood(foods[0],today(),'朝食');let list=upsertFoods(foods,[{...food,id:'another',nutrition:{...food.nutrition!,checkedAt:'2026-10-08T02:00:00Z'}}]);assert.equal(list.length,1);assert.equal(list[0].revision,1);
 const changed={...list[0],kcal:200,nutrition:{...food.nutrition!,values:{...values,kcal:200}}};list=upsertFoods(list,[changed]);assert.equal(list[0].revision,2);assert.equal(list[0].revisions?.[0].values.kcal,193);assert.equal(meal.kcal,193);assert.equal(meal.nutrition?.values.kcal,193);assert.equal(mealFromFood(list[0],today(),'昼食').kcal,200);
 const s=freshState();s.foods=list;s.meals=[meal];assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);assert.equal(mealFromHistory(mealHistory(s,'朝食',today())[0],today(),'昼食').nutrition?.values.kcal,193);
});
test('bad or legacy references cannot become verified numeric sources and archived foods stay out of AI',()=>{
 const s=freshState();s.foods=[food,{...food,id:'legacy',name:'以前の飲み物',nutrition:undefined},{...food,id:'invalid',name:'矛盾した食品',kcal:999},{...food,id:'archived',name:'非表示の商品',archived:true}];const refs=knownFoods(s,today());assert.equal(refs.find(f=>f.name==='以前の飲み物')?.canScale,false);assert.equal('kcal' in refs.find(f=>f.name==='以前の飲み物')!,false);assert.equal(refs.some(f=>f.name==='非表示の商品'||f.name==='矛盾した食品'),false);assert.equal(nutritionIssues(s.foods[2]).length,1);
});
test('source metadata and recipe ingredient snapshots are validated in old-compatible backups',()=>{
 assert.equal(validNutritionBasis(food.nutrition),true);assert.equal(validNutritionBasis({...food.nutrition,url:'javascript:alert(1)'}),false);assert.equal(validNutritionBasis({...food.nutrition,values:{...values,carbs:NaN}}),false);assert.equal(validNutritionBasis({...food.nutrition,kind:'recipe',finishedGrams:0}),false);const s=freshState();s.foods=[{...food,nutrition:undefined}];assert.doesNotThrow(()=>validateState(s));assert.throws(()=>validateState({...s,foods:[{...food,revisions:[{at:'bad'}]}]}));
});
test('manufacturer tables use displayed kcal and total carbs and need a complete, separate basis',()=>{
 const parsed=nutritionTables(table,food.nutrition!.url!);assert.equal(parsed.length,1);assert.equal(parsed[0].kcal,193);assert.equal(parsed[0].carbs,18.5);assert.equal(parsed[0].nutrition?.kind,'manufacturer');assert.equal(parsed[0].portion,'1本(430ml)');
 assert.equal(nutritionTables(table.replace('18.5g','0〜20g'),food.nutrition!.url!).length,0);assert.equal(nutritionTables(table.replace(/<h2>.*?<\/h2>/,''),food.nutrition!.url!).length,0);
 const horizontal='<h1>商品</h1><table><caption>100gあたり</caption><tr><th>エネルギー(kcal)</th><th>たんぱく質(g)</th><th>脂質(g)</th><th>炭水化物(g)</th></tr><tr><td>100</td><td>5</td><td>2</td><td>15</td></tr></table>';assert.equal(nutritionTables(horizontal,food.nutrition!.url!)[0].protein,5);
});
test('separate manufacturer sizes and products never inherit the previous table basis',()=>{
 const rows='<tr><th>エネルギー</th><td>45</td><td>193</td></tr><tr><th>たんぱく質</th><td>7</td><td>30</td></tr><tr><th>脂質</th><td>0</td><td>0</td></tr><tr><th>炭水化物</th><td>4.3</td><td>18.5</td></tr>';
 const products=nutritionTables('<h1>飲み物</h1><table><tr><th>栄養成分</th><th>100mlあたり</th><th>430mlあたり</th></tr>'+rows+'</table>',food.nutrition!.url!);assert.equal(products.length,2);assert.deepEqual(products.map(f=>f.portion),['100ml','430ml']);
 assert.equal(nutritionTables(table+table.replace(/<h2>.*?<\/h2>/,''),food.nutrition!.url!).length,1);
});
test('manufacturer URLs and redirects cannot request arbitrary hosts, credentials, ports or scripts',async context=>{
 for(const url of ['http://www.meiji.co.jp/','https://www.meiji.co.jp.evil.example/','https://evil.example/','https://127.0.0.1/','https://user:pass@www.meiji.co.jp/','https://www.meiji.co.jp:8443/','javascript:alert(1)'])assert.equal(allowedSourceUrl(url),null);
 context.mock.method(globalThis,'fetch',async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1/internal'}}));await assert.rejects(()=>fetchManufacturer(food.nutrition!.url!));
});
test('grounded search gets links, but nutrition is extracted from actual manufacturer HTML and cached',async context=>{
 const sent:Record<string,unknown>[]=[],urls:string[]=[];context.mock.method(globalThis,'fetch',async(url:unknown,options?:RequestInit)=>{urls.push(String(url));if(String(url).includes('generativelanguage')){sent.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sources:[{title:'商品',url:food.nutrition!.url}]})}]},groundingMetadata:{webSearchQueries:['商品の栄養表示'],groundingChunks:[{web:{uri:'https://vertexaisearch.cloud.google.com/test'}}],searchEntryPoint:{renderedContent:'<p>検索</p>'}}}]}));}return new Response(table,{headers:{'content-type':'text/html'}});});
 const result=await searchManufacturer('grounded-test-query','fake-test-key','gemini-3.5-flash-lite');assert.equal(result.foods[0].kcal,193);assert.equal(result.foods[0].protein,30);assert.equal(result.sources.length,1);assert.equal('responseMimeType' in (sent[0].generationConfig as object),false);assert.ok(sent[0].tools);const count=urls.length;await searchManufacturer('grounded-test-query','fake-test-key','gemini-3.5-flash-lite');assert.equal(urls.length,count);
});
test('a non-grounded search response cannot present invented URLs or nutrient values as search results',async context=>{
 context.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({sources:[{title:'fake',url:food.nutrition!.url}]})}]}}]})));await assert.rejects(()=>searchManufacturer('ungrounded-test-query','fake-test-key','gemini-3.5-flash-lite'));
});

test('fractional servings retain their meaning; negative and zero-denominator portions cannot be scaled',()=>{
 assert.equal(portionCount('1/2本')?.value,.5);assert.equal(portionCount('½本')?.value,.5);assert.equal(calculateServing(food.nutrition!,'1/2本').kcal,96.5);assert.equal(portionMeasure('1/2kg')?.value,500);
 for(const invalid of ['-100g','1/0kg','100g ×-2'])assert.equal(portionMeasure(invalid),null);assert.equal(portionCount('-1本'),null);
});

test('official list and definition-list panels need a complete block and cannot merge neighbouring products',()=>{
 const rows=[['エネルギー','100kcal'],['たんぱく質','0.4g'],['脂質','11.2g'],['炭水化物','0.1g']];const list='<h1>マヨネーズ</h1><section><h4>栄養成分表示</h4><div><p>大さじ約1杯（15g）当たり</p><ul>'+rows.map(([k,v])=>`<li><span>${k}</span><span>${v}</span></li>`).join('')+'</ul></div></section>';const foods=nutritionTables(list,'https://www.kewpie.co.jp/products/detail/4901577042072/');assert.equal(foods.length,1);assert.deepEqual([foods[0].kcal,foods[0].protein,foods[0].fat,foods[0].carbs],[100,.4,11.2,.1]);assert.equal(foods[0].portion,'1杯(15g)');assert.equal(nutritionTables(list.replace('大さじ約1杯（15g）当たり','1食当たり（15g）'),'https://www.kewpie.co.jp/products/detail/4901577042072/')[0].portion,'1食(15g)');
 const definitions='<section><header><h2>栄養成分 <small>（1個(100g)当たり）</small></h2></header><div>'+rows.map(([k,v])=>`<dl><dt>${k}</dt><dd>${v}</dd></dl>`).join('')+'</div></section>';assert.equal(nutritionTables('<h1>ヨーグルト</h1>'+definitions,food.nutrition!.url!).length,1);
 const split='<section><h2>栄養成分</h2><article><p>100g当たり</p><dl><dt>エネルギー</dt><dd>100kcal</dd></dl><dl><dt>たんぱく質</dt><dd>5g</dd></dl></article><article><p>200g当たり</p><dl><dt>脂質</dt><dd>2g</dd></dl><dl><dt>炭水化物</dt><dd>10g</dd></dl></article></section>';assert.equal(nutritionTables(split,food.nutrition!.url!).length,0);
});
test('official catalogue ranks variants, fullwidth queries and JAN; tracking links cannot escape official hosts',()=>{
 const html='<a href="/products/sports/4902705128804.html">（ザバス）MILK PROTEIN 脂肪0 カフェラテ味 430ml</a><a href="/products/sports/4902777320588.html">ザバス ソイプロテイン100 カフェラテ風味 224g</a><a href="https://evil.example/products/test.html">ザバス カフェラテ430ml</a>';assert.equal(catalogueLinks(html,'https://www.meiji.co.jp/products/sports/','ＳＡＶＡＳカフェラテ430ml')[0].url,food.nutrition!.url);assert.equal(catalogueLinks(html,'https://www.meiji.co.jp/products/sports/','4902705128804').length,1);
 const tracked='<a href="https://search.kewpie.co.jp/click?url=https%3A%2F%2Fwww.kewpie.co.jp%2Fproducts%2Fdetail%2F4901577042072%2F">キユーピーマヨネーズ</a><a href="https://search.kewpie.co.jp/click?url=https%3A%2F%2Fevil.example%2F">マヨネーズ</a>';assert.deepEqual(catalogueLinks(tracked,'https://search.kewpie.co.jp/search','マヨネーズ').map(x=>x.url),['https://www.kewpie.co.jp/products/detail/4901577042072/']);
});
test('supported manufacturer catalogue search works without a Gemini request or search quota',async context=>{
 const urls:string[]=[];context.mock.method(globalThis,'fetch',async(url:unknown)=>{urls.push(String(url));assert.ok(!String(url).includes('generativelanguage'));return new Response(String(url).endsWith('/sports/')?'<a href="/products/sports/4902705128804.html">ザバス カフェラテ430ml</a>':table,{headers:{'content-type':'text/html'}});});const r=await searchManufacturer('SAVASカフェラテ430ml native fixture','not-used','gemini-3.5-flash-lite');assert.equal(r.provider,'manufacturer');assert.equal(r.foods[0].kcal,193);assert.equal(urls.length,2);
});
