import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4179'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4179')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 await page.route('**/api/assistant',r=>r.request().method()==='GET'?r.fulfill({json:{configured:false}}):r.fulfill({status:503,json:{error:'off'}}));
 await page.goto('http://127.0.0.1:4179');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await until(s=>!!s,'initial');
 // Two weeks of a slow start: behind the needed pace.
 const today=await page.evaluate(async()=>{
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,day=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d);};
  const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);});
  s.settings={...s.settings,startWeight:89,targetWeight:85,startDate:day(-16),deadline:day(35),goalName:'七五三',energy:{age:42,height:182,sex:'male',activity:1.3,exerciseMode:'separate',weeklyExerciseKcal:0},nutritionMode:'auto',homeAiAuto:false};
  s.weights=[];s.closedDays={};for(let i=16;i>=1;i--){s.weights.push({id:'w'+i,date:day(-i),time:'朝',kg:+(89-(16-i)*0.03).toFixed(2)});s.closedDays[day(-i)]={expenditure:2500,weight:88.8};s.meals.push({id:'m'+i,date:day(-i),slot:'夕食',name:'定食',quantity:1,source:'x',estimated:true,kcal:2100,protein:60,fat:50,carbs:250});}
  await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(s,'state');tx.oncomplete=r;});return day(0);});
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await nav('計画');const hero=page.locator('.progress-hero');await hero.getByText('予定より少しゆっくり',{exact:true}).waitFor();
 await hero.getByText(/実際のペース 週−0\.\d\dkg/).waitFor();assert.match(await hero.locator('.hero-stats').innerText(),/連続記録\s*16\s*日/);
 assert.ok(await hero.locator('.milestones span').count()>=4);
 // A one-tap goal change asks first, then updates the plan.
 const extend=hero.getByRole('button',{name:/目標日を.*に延ばす/});await extend.waitFor();
 page.once('dialog',d=>d.dismiss());await extend.click();assert.equal((await state()).settings.deadline>today,true);const before=(await state()).settings.deadline;
 page.once('dialog',d=>d.accept());await extend.click();const s1=await until(s=>s.settings.deadline!==before,'deadline extended');assert.ok(s1.settings.deadline>before);
 // Chart shows the plan line; the weekly review compares with last week; technical details are folded.
 assert.match(await page.locator('.weight-chart.large').getAttribute('aria-label'),/計画線/);
 await page.locator('.weekly-insights').getByText('前週比',{exact:false}).first().waitFor();
 assert.equal(await page.locator('.plan-details').getAttribute('open'),null);
 assert.equal(await page.locator('.records-details').getAttribute('open'),null);
 // Today: a personal best is celebrated, and the day can be closed where the remainder is shown.
 await nav('今日');await page.getByLabel('朝の体重（kg）',{exact:true}).fill('88');await page.getByRole('button',{name:'朝の体重を保存',exact:true}).click();
 await page.getByRole('status').filter({hasText:'自己ベスト更新'}).waitFor();
 await page.getByText('🔥 17日連続で記録中',{exact:true}).waitFor();
 await nav('食事');await page.getByRole('tab',{name:'食品リスト'}).click();await page.getByRole('button',{name:'ご飯を1食追加',exact:true}).click();await until(s=>s.meals.some(m=>m.date===today),'meal');
 await nav('今日');await page.getByRole('button',{name:'今日の記録を完了（収支を確定）',exact:true}).click();
 await until(s=>!!s.closedDays?.[today],'closed');await page.getByText(/この日の収支を確定済み/).waitFor();
 await page.getByRole('button',{name:'確定を取り消す',exact:true}).click();await until(s=>!s.closedDays?.[today],'reopened');
 await fs.mkdir('test-artifacts',{recursive:true});
 for(const width of [320,390]){await page.setViewportSize({width,height:844});await nav('計画');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.progress-hero').screenshot({path:`test-artifacts/progress-hero-${width}.png`});}
 assert.deepEqual(errors,[]);
 console.log('PASS: progress hero verdict/pace/streak/milestones, confirmed one-tap deadline change, plan line, week-over-week review, folded details, personal-best toast, streak and day close on Today, 320/390px');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
