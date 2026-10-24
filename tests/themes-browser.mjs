import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4190'],{stdio:'inherit'});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4190')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addLocatorHandler(page.locator('.title-card'),()=>page.getByRole('button',{name:/^やった！/}).click(),{noWaitAfter:true});
 await page.route('**/api/assistant',r=>{if(r.request().method()!=='POST')return r.fulfill({json:{configured:true}});const b=r.request().postDataJSON();requests.push(b);const style=b.context?.settings?.coachStyle??'normal';return r.fulfill({json:{brief:{headline:style==='energetic'?'よし、ここからだ！':style==='beauty'?'いっしょに整えていこう✨':'今日の作戦',summary:'記録から今日の一歩を考えましょう。',tips:['食事：記録を確認','運動・回復：体調を確認','体重・計画：傾向を確認']}}});});
 await page.goto('http://127.0.0.1:4190');await page.locator('.advice-themes').waitFor();assert.equal(await page.locator('.advice-theme').count(),3);
 await page.getByRole('button',{name:/運動・回復を詳しく相談/}).click();assert.match(await page.locator('.home-chat textarea').inputValue(),/運動・回復/);
 await page.getByRole('button',{name:'全体の作戦を相談',exact:true}).click();assert.match(await page.locator('.home-chat textarea').inputValue(),/全体の作戦/);
 const date=new Date().toISOString().slice(0,10),ago=new Date(Date.now()-30*86400000).toISOString().slice(0,10),deadline=new Date(Date.now()+100*86400000).toISOString().slice(0,10);
 await page.evaluate(async({date,ago,deadline})=>{const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result)});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result)});s.settings={...s.settings,startWeight:100,targetWeight:90,startDate:ago,deadline,nutritionMode:'manual',homeAiAuto:false,energy:{age:40,height:175,sex:'male',activity:1.35,exerciseMode:'separate',weeklyExerciseKcal:0}};s.weights=[{id:'current',date,time:'朝',kg:85}];s.achievementsSeen=[];await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(s,'state');tx.oncomplete=r;});},{date,ago,deadline});
 await page.reload();await page.locator('.advice-themes').waitFor();await page.getByRole('button',{name:'設定',exact:true}).first().click();
 await page.getByLabel('再計算に使う現在体重（kg）',{exact:true}).fill('84.8');await page.getByRole('button',{name:'この体重と期限で計算し直す',exact:true}).click();
 await page.getByLabel('目標体重（kg）',{exact:true}).fill('82');await page.getByRole('button',{name:'目標と食事プランを保存',exact:true}).click();
 await page.getByText('目標とカロリー・PFCを保存しました',{exact:true}).waitFor();
 const stored=await page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result)});});
 assert.equal(stored.settings.planBaseline.kg,84.8);assert.equal(stored.settings.targetWeight,82);assert.equal(stored.settings.startWeight,100);assert.equal(stored.settings.startDate,ago);assert.equal(stored.weights[0].kg,85);assert.equal(stored.settings.nutritionMode,'auto');
 await page.reload();await page.locator('.advice-themes').waitFor();for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}await page.locator('.bottom-nav').getByRole('button',{name:'コーチ',exact:true}).click();await page.getByRole('button',{name:/🔥 熱血/}).click();await page.locator('.bottom-nav').getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('heading',{name:'よし、ここからだ！',exact:true}).waitFor();assert.equal(requests.at(-1).context.settings.coachStyle,'energetic');
 await page.locator('.bottom-nav').getByRole('button',{name:'コーチ',exact:true}).click();await page.getByRole('button',{name:/✨ 美容系インフルエンサー/}).click();await page.locator('.bottom-nav').getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('heading',{name:'いっしょに整えていこう✨',exact:true}).waitFor();assert.equal(requests.at(-1).context.settings.coachStyle,'beauty');await page.reload();await page.locator('.bottom-nav').getByRole('button',{name:'コーチ',exact:true}).click();assert.equal(await page.getByRole('button',{name:/✨ 美容系インフルエンサー/}).getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);
 console.log('PASS: overview + 3 named themes; inline questions; reached goal renewed from current weight; original progress retained; saved and restored; 320/390px');
}finally{await browser?.close();server.kill('SIGTERM');}
