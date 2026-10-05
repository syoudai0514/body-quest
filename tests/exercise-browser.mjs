import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4177'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4177')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const requests=[];
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const body=route.request().postDataJSON();requests.push(body);
  await route.fulfill({json:body.task==='exercise'?{exercises:[{name:'ジムで筋トレ',minutes:40,met:3.5,details:'チェストプレス30kg 10回×3\nラットプルダウン25kg 12回×3',note:'時間は推定'},{name:'バイク',minutes:20,met:6,details:'',note:''}]}:{text:'ok'}});});
 await page.goto('http://127.0.0.1:4177');await page.locator('.bottom-nav').getByRole('button',{name:'運動',exact:true}).click();
 await page.locator('.exercise-ai textarea').first().fill('チェストプレス30kg10回3セット、ラットプルダウン、バイク20分');
 await page.getByRole('button',{name:'AIで読み取る',exact:true}).click();await page.getByText('時間は推定',{exact:true}).waitFor();
 const sent=requests.find(r=>r.task==='exercise');assert.ok(Array.isArray(sent.context.knownMenus)&&sent.context.knownMenus.length>0);assert.equal(sent.context.painToday,false);
 const first=page.locator('.exercise-draft').first();await first.getByLabel('実施時間（分）',{exact:true}).fill('45');
 await page.getByRole('button',{name:'2件をまとめて記録',exact:true}).click();
 const s=await until(s=>s.exercises.length===2,'exercises');
 assert.deepEqual(s.exercises.map(e=>[e.name,e.minutes,e.met]),[['ジムで筋トレ',45,3.5],['バイク',20,6]]);assert.match(s.exercises[0].details,/ラットプルダウン/);
 assert.equal(await page.locator('.exercise-draft').count(),0);
 await page.getByText('ジムで筋トレ · 45分',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: AI exercise reading with menu context, editable drafts, batch save with METs, listed in today records, 390px');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
