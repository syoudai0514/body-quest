import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4193','--strictPort'],{stdio:'inherit'});let browser;
const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('sv-SE');};
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4193')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addLocatorHandler(page.locator('.title-card'),()=>page.getByRole('button',{name:/^やった！/}).click(),{noWaitAfter:true});
 await page.route('**/api/assistant',r=>r.fulfill({json:{configured:false}}));
 const read=()=>page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result)});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await read();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 await page.goto('http://127.0.0.1:4193');await until(s=>!!s,'initial state');
 // Started at 90kg aiming for 85kg; the last week of mornings is 84.5kg, so the goal is reached.
 await page.evaluate(async({start,deadline,weights})=>{const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result)});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result)});s.settings={...s.settings,startWeight:90,targetWeight:85,startDate:start,deadline,nutritionMode:'auto',homeAiAuto:false,energy:{age:40,height:175,sex:'male',activity:1.35,exerciseMode:'separate',weeklyExerciseKcal:0}};s.weights=weights;await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(s,'state');tx.oncomplete=r;});},{start:day(-60),deadline:day(60),weights:Array.from({length:7},(_,i)=>({id:`w${i}`,date:day(-i),time:'朝',kg:84.5}))});
 await page.reload();await page.locator('.bottom-nav').getByRole('button',{name:'計画',exact:true}).click();
 await page.getByText('目標に到達しました！').waitFor();
 // Reaching the goal offers the next one right on the progress card and opens the renewal section.
 await page.getByRole('button',{name:'次の目標を設定する'}).click();
 const renew=page.locator('.goal-card .renew-goal');await renew.waitFor();await page.waitForTimeout(600);assert.ok(await renew.evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}),'renewal section scrolled into view');
 const form=page.locator('.goal-card .goal-form');
 assert.equal(await form.getByLabel('再計算に使う現在体重（kg）').inputValue(),'84.5');
 // Without re-basing, a target above the starting weight explains how to move on.
 await form.getByLabel('目標体重（kg）').fill('92');await form.getByRole('button',{name:'目標と食事プランを保存'}).click();
 assert.match(await form.locator('[role=alert]').textContent(),/この体重と期限で計算し直す/);
 await form.getByRole('button',{name:'この体重と期限で計算し直す'}).click();await form.getByLabel('目標体重（kg）').fill('80');await form.getByRole('button',{name:'目標と食事プランを保存'}).click();
 let s=await until(s=>s.settings.targetWeight===80,'renewed goal');
 assert.deepEqual(s.settings.planBaseline,{date:day(0),kg:84.5});assert.equal(s.settings.startWeight,90);assert.equal(s.settings.startDate,day(-60));assert.equal(s.weights.length,7);
 await page.getByRole('button',{name:'次の目標を設定する'}).waitFor({state:'detached'});
 // The plain edit link also opens the form instead of only scrolling.
 await page.getByRole('button',{name:'目標体重・期限を編集'}).click();await form.waitFor();
 // Coming back to the plan tab later does not reopen the form by itself.
 await page.locator('.bottom-nav').getByRole('button',{name:'今日',exact:true}).click();await page.locator('.bottom-nav').getByRole('button',{name:'計画',exact:true}).click();await page.locator('.goal-card').waitFor();assert.equal(await page.locator('.goal-card .goal-form').count(),0);
 // In settings, toggling the game mode keeps an unsaved goal edit, and saving the goal keeps the toggle.
 await page.locator('.bottom-nav').getByRole('button',{name:'今日',exact:true}).click();await page.getByRole('button',{name:'設定',exact:true}).first().click();
 const settingsForm=page.locator('.goal-form').first();await settingsForm.getByLabel('目標体重（kg）').fill('79');
 await page.getByLabel('レベル・クエスト・ボス・称号を表示する').uncheck();await until(s=>s.settings.gameMode===false,'game off');
 assert.equal(await settingsForm.getByLabel('目標体重（kg）').inputValue(),'79');
 await settingsForm.getByRole('button',{name:'目標と食事プランを保存'}).click();
 s=await until(s=>s.settings.targetWeight===79,'saved after toggle');assert.equal(s.settings.gameMode,false);
 assert.deepEqual(errors,[]);
 console.log('PASS: reached goal offers the next goal, renewal keeps history, edit link opens the form, settings toggles keep unsaved goal edits');
}finally{await browser?.close();server.kill('SIGTERM');}
