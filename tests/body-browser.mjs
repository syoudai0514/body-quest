import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178'],{stdio:'inherit'});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4178')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 let scaleScreen=true;const sent=[];
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const b=route.request().postDataJSON();if(b.task==='body'){sent.push(b);return route.fulfill({json:scaleScreen?{body:{kg:86,bodyFat:24.7,muscle:39.7,visceral:14,bmr:1810,leanMass:64.8},note:''}:{body:{},note:'体重計の画面ではありません'}});}return route.fulfill({status:503,json:{error:'off'}});});
 await page.goto('http://127.0.0.1:4178');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await until(s=>!!s,'initial');
 await nav('計画');await page.getByText('体組成計の結果画面を写真で読み取ると',{exact:false}).waitFor();
 await page.locator('.body-card').getByRole('button',{name:'写真から記録',exact:true}).click();
 const upload=f=>page.locator('.scale-photo input').setInputFiles({name:'scale.png',mimeType:'image/png',buffer:png});
 scaleScreen=false;await upload();await page.getByRole('alert').filter({hasText:'体重計の画面ではありません'}).waitFor();
 scaleScreen=true;await upload();await page.getByText('読み取った値を入れました',{exact:false}).waitFor();
 assert.match(sent[1].image,/^data:image\/jpeg;base64,/);
 assert.equal(await page.getByLabel('体重（kg）',{exact:true}).inputValue(),'86');assert.equal(await page.getByLabel('体脂肪率（%）',{exact:true}).inputValue(),'24.7');assert.equal(await page.getByLabel('内臓脂肪レベル',{exact:true}).inputValue(),'14');
 await page.getByLabel('骨格筋率（%）',{exact:true}).fill('39.8');
 await page.getByRole('button',{name:'体重を保存',exact:true}).click();
 let s=await until(s=>s.weights.length===1,'saved');assert.deepEqual(s.weights[0].body,{bodyFat:24.7,muscle:39.8,visceral:14,leanMass:64.8,bmr:1810});assert.equal(s.weights[0].kg,86);
 await page.locator('.body-card').getByText('24.7%',{exact:true}).waitFor();
 // A quick weight update on the home screen keeps the composition.
 await nav('今日');await page.getByText(/体脂肪 24\.7%/).waitFor();await page.locator('.home-weight').getByRole('button',{name:'修正',exact:true}).click();
 await page.getByRole('button',{name:'0.1kg減らす',exact:true}).click();await page.getByRole('button',{name:'朝の体重を更新',exact:true}).click();
 s=await until(s=>s.weights[0]?.kg===85.9,'quick update');assert.equal(s.weights.length,1);assert.equal(s.weights[0].body.bodyFat,24.7);
 await nav('計画');await fs.mkdir('test-artifacts',{recursive:true});await page.locator('.body-card').screenshot({path:'test-artifacts/body-card-390.png'});
 for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);
 console.log('PASS: scale photo reading (non-scale rejected), editable composition fields, saved with weight, body card, quick weight update keeps composition, 320/390px');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
