import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4191'],{stdio:'inherit'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
let browser,page;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4191')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 let food={name:'鶏むね肉（生）',portion:'生200g',kcal:210,protein:46.6,fat:3.8,carbs:.2,estimated:true,basis:'estimate',note:'生重量を基準に推定'};
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const b=route.request().postDataJSON();requests.push(b);if(b.task==='food')return route.fulfill({json:{foods:[food]}});return route.fulfill({status:503,json:{error:'test'}});});
 await page.goto('http://127.0.0.1:4191');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await until(s=>!!s,'initial state');
 await page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result)});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result)});s.meals=[{id:'legacy',date:new Date().toLocaleDateString('sv-SE'),slot:'朝食',name:'サラダチキン',quantity:1,source:'旧AI',estimated:true,kcal:420,protein:92.4,fat:4.8,carbs:1.2}];await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(s,'state');tx.oncomplete=r;});});
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await nav('食事');await page.getByRole('tab',{name:'文章・写真'}).click();
 const read=async text=>{await page.getByLabel('食べたものと量',{exact:true}).fill(text);await page.getByRole('button',{name:'読み取って確認',exact:true}).click();await page.locator('.draft').waitFor();};
 await read('生の皮なし鶏むね肉200g');let d=page.locator('.draft');assert.equal(await d.getByLabel('たんぱく質（g）',{exact:true}).inputValue(),'46.6');
 const old=requests.find(r=>r.task==='food').context.knownFoods.find(f=>f.name==='サラダチキン');assert.equal(old.canScale,false);assert.equal('protein' in old,false);
 await d.getByRole('button',{name:'×0.5',exact:true}).click();await page.getByLabel('マイ食品にも保存して次回から選べるようにする').check();await d.getByRole('button',{name:'確認して記録',exact:true}).click();
 let s=await until(s=>s.meals.length===2,'half raw chicken');const chicken=s.meals.at(-1);assert.equal(chicken.portion,'生200g ×0.5');assert.equal(chicken.protein,23.3);assert.equal(chicken.kcal,105);assert.equal(chicken.quantity,1);assert.ok(s.foods.some(f=>f.name===chicken.name&&f.portion===chicken.portion));
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await nav('食事');await page.getByRole('tab',{name:'文章・写真'}).click();
 food={name:'ザバス脂肪0カフェラテ',portion:'430ml',kcal:193,protein:30,fat:0,carbs:18.5,estimated:false,basis:'label',label:{portion:'1本（430ml）',kcal:193,protein:30,fat:0,carbs:18.5},note:'写真の栄養表示：1本（430ml）あたり193kcal / P30g / F0g / C18.5g'};
 await page.locator('.meal-entry input[type=file]').setInputFiles({name:'label.png',mimeType:'image/png',buffer:png});await page.getByAltText('AIに送る食事写真').waitFor();await read('この写真の飲み物を1本');
 const input=requests.filter(r=>r.task==='food').at(-1);assert.ok(input.image.startsWith('data:image/'));const ref=input.context.knownFoods.find(f=>f.name===chicken.name);assert.equal(ref.portion,'生200g ×0.5');assert.equal(ref.protein,23.3);
 d=page.locator('.draft');await d.getByText('430ml · 写真から読み取った表示値',{exact:true}).waitFor();await d.getByRole('button',{name:'×0.5',exact:true}).click();assert.equal(await d.getByLabel('カロリー（kcal）',{exact:true}).inputValue(),'96.5');await d.getByRole('button',{name:'確認して記録',exact:true}).click();
 s=await until(s=>s.meals.length===3,'half bottle');assert.deepEqual([s.meals.at(-1).kcal,s.meals.at(-1).protein,s.meals.at(-1).carbs,s.meals.at(-1).portion],[96.5,15,9.3,'430ml ×0.5']);
 // A food-list serving change must preserve the same basis as one-tap adding.
 await page.getByRole('tab',{name:'食品リスト'}).click();await page.getByLabel('食品を検索',{exact:true}).fill(chicken.name);const item=page.locator('.food-item').filter({hasText:chicken.name});await item.getByRole('button',{name:'量を変更',exact:true}).click();await page.getByLabel('基準量の何倍？',{exact:true}).fill('2');await page.getByRole('button',{name:'食事に追加',exact:true}).click();
 s=await until(s=>s.meals.length===4,'food list double');assert.equal(s.meals.at(-1).portion,'生200g ×0.5');assert.equal(s.meals.at(-1).quantity,2);assert.equal(s.meals.at(-1).protein,46.6);
 // Correcting a whole recorded serving resets the multiplier, so another reuse cannot double it.
 await page.locator('.record-edit').filter({hasText:chicken.name}).last().click();await page.getByRole('dialog').getByLabel('表示値に対応する量',{exact:true}).fill('生200g');await page.getByRole('button',{name:'食品を保存',exact:true}).click();s=await until(s=>s.meals.at(-1).quantity===1,'correct whole serving');assert.equal(s.meals.at(-1).protein,46.6);assert.equal(s.meals.at(-1).portion,'生200g');
 await page.getByRole('tab',{name:'文章・写真'}).click();await page.getByRole('button',{name:'写真を外す',exact:true}).click();food={name:'サラダチキン',portion:'200g',kcal:420,protein:92.4,fat:4.8,carbs:1.2,estimated:true,note:'推定'};await read('サラダチキン200g');d=page.locator('.draft');assert.equal(await d.getByRole('button',{name:'確認して記録',exact:true}).isDisabled(),true);await d.getByText(/二重換算/).waitFor();
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await fs.mkdir('test-artifacts',{recursive:true});await page.screenshot({path:`test-artifacts/food-warning-${width}.png`,fullPage:true});}
 await d.getByLabel('カロリー（kcal）',{exact:true}).fill('220');await d.getByLabel('たんぱく質（g）',{exact:true}).fill('48');assert.equal(await d.getByRole('button',{name:'確認して記録',exact:true}).isDisabled(),false);await d.getByRole('button',{name:'確認して記録',exact:true}).click();await until(s=>s.meals.length===5,'correct suspicious estimate');
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();s=await state();assert.equal(s.meals.at(-1).protein,48);assert.equal(s.meals.at(-1).portion,'200g');assert.deepEqual(errors,[]);
 console.log('PASS: legacy unknown portions excluded from numerical AI references; raw chicken half serving saved and reloaded; photo label half bottle; food-list quantity basis; whole-record correction; excessive chicken warning; 320/390px');
} catch(e){if(page){await fs.mkdir('test-artifacts',{recursive:true});await page.screenshot({path:'test-artifacts/food-test-failure.png',fullPage:true});console.log((await page.locator('body').innerText()).slice(0,4500));}throw e;} finally {if(browser)await browser.close();server.kill('SIGTERM');}
