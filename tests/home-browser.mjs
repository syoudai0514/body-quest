import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4177'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4177')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],requests=[];
 // A title celebration may cover the screen after an action; a person would tap やった！, so the test does too.
 await page.addLocatorHandler(page.locator('.title-card'),()=>page.getByRole('button',{name:/^やった！/}).click(),{noWaitAfter:true});
 page.on('pageerror',e=>errors.push(e.message));
 const d=new Date(),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 await page.clock.install({time:new Date(date+'T08:00:00')});
 let failed=false,held=false,release;const gate=new Promise(r=>release=r);
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const b=route.request().postDataJSON();requests.push(b);if(b.task==='brief'){if(held)await gate;if(failed)return route.fulfill({status:429,json:{error:'利用上限です'}});return route.fulfill({json:{brief:{headline:`${b.context.homeReport.phase}のAI作戦`,summary:'記録を確認して、今日できる一歩を選びましょう。',tips:['食事を抜かず、いつもの目標に戻しましょう。']}}});}return route.fulfill({json:{text:b.history?'【続き】\n睡眠も大切に。':'【トップで相談】\n今日の記録から、食事と筋トレを提案します。'}});});
 const read=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await read();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 const briefCount=()=>requests.filter(b=>b.task==='brief').length;
 await page.goto('http://127.0.0.1:4177');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await until(s=>!!s,'initial state');
 // Auto-update is on by default: opening today's home asks for the morning brief once.
 await page.getByRole('heading',{name:'morningのAI作戦',exact:true}).waitFor();assert.equal(briefCount(),1);assert.equal(requests[0].context.companion.version,2);assert.equal(requests[0].context.companion.focus.id,'rhythm');assert.equal(requests[0].context.photos,undefined);
 // Both times are direct top-screen inputs and persisted independently.
 await page.getByLabel('朝の体重（kg）',{exact:true}).fill('80');await page.getByRole('button',{name:'朝の体重を保存',exact:true}).click();await until(s=>s.weights.some(w=>w.date===date&&w.time==='朝'&&w.kg===80),'morning');await page.locator('.companion-done').waitFor();
 await page.locator('.weight-switch').getByRole('button',{name:/夜の体重/}).click();await page.getByLabel('夜の体重（kg）',{exact:true}).fill('81');await page.getByRole('button',{name:'夜の体重を保存',exact:true}).click();await until(s=>s.weights.length===2,'night');
 // A reminder for last night changes both the date and selected time, never inventing a reading.
 await page.getByRole('button',{name:'前の日',exact:true}).click();await page.locator('.weight-switch').getByRole('button',{name:/夜の体重/}).click();await page.getByLabel('夜の体重（kg）',{exact:true}).waitFor();assert.notEqual(await page.getByLabel('記録日',{exact:true}).inputValue(),date);assert.equal(await page.getByLabel('夜の体重（kg）',{exact:true}).inputValue(),'');
 await page.getByRole('button',{name:'次の日',exact:true}).click();
 // Inline consultation is the same conversation on the Coach tab.
 await page.locator('.home-chat textarea').fill('筋肉を落とさず痩せるには？');await page.locator('.home-chat').getByRole('button',{name:'相談する',exact:true}).click();await page.getByText('【トップで相談】',{exact:true}).waitFor();
 assert.equal(requests.at(-1).context.surface,'home');assert.ok(requests.at(-1).context.currentAdvice.headline);
 // Follow up directly under the answer: no topic picker, new-conversation button, or tab switch.
 await page.locator('.home-chat').getByLabel('続けて質問',{exact:true}).fill('睡眠は？');await page.locator('.home-chat').getByRole('button',{name:'続けて質問する',exact:true}).click();await page.getByText('【続き】',{exact:true}).waitFor();assert.equal(requests.at(-1).history.length,2);await page.getByText('【トップで相談】',{exact:true}).waitFor();
 assert.equal(await page.locator('.home-chat .filter-chips, .home-tone, .home-chat-archive').count(),0);assert.equal(await page.locator('.home-chat').getByRole('button',{name:'新しい相談',exact:true}).count(),0);
 const together=await page.evaluate(()=>document.querySelector('.home-brief')?.parentElement===document.querySelector('.home-chat')?.parentElement);assert.equal(together,true);
 await nav('コーチ');await page.getByText('【続き】',{exact:true}).waitFor();await nav('今日');await page.getByText('【トップで相談】',{exact:true}).waitFor();await page.getByText('【続き】',{exact:true}).waitFor();
 // Default on (can be turned off) -> one morning request, saved across tabs and reload. No request is sent on a past date.
 await page.getByRole('button',{name:'設定',exact:true}).first().click();assert.equal(await page.getByLabel('朝昼晩に自動更新').isChecked(),true);await page.getByLabel('朝昼晩に自動更新').uncheck();await until(s=>s.settings.homeAiAuto===false,'opt out');await page.getByLabel('朝昼晩に自動更新').check();await until(s=>s.settings.homeAiAuto===true,'opt in');await until(s=>s.homeBriefs?.[0]?.brief,'morning brief');assert.equal(briefCount(),1);await nav('今日');
 await nav('食事');await nav('今日');await page.reload();await page.locator('.home-brief').waitFor();assert.equal(await page.getByRole('heading',{name:'morningのAI作戦',exact:true}).count(),0);assert.equal(briefCount(),1);
 await page.getByRole('button',{name:'前の日',exact:true}).click();await page.waitForTimeout(100);assert.equal(briefCount(),1);await page.getByRole('button',{name:'次の日',exact:true}).click();
 // Changed records immediately replace stale AI text. The visible home clock refreshes automatically after cooldown.
 await page.locator('.home-weight').getByRole('button',{name:'修正',exact:true}).click();await page.getByLabel('朝の体重（kg）',{exact:true}).fill('79.9');await page.getByRole('button',{name:'朝の体重を更新',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'morningのAI作戦',exact:true}).count(),0);assert.equal(briefCount(),1);
 await page.clock.fastForward('00:11:00');await until(s=>s.homeBriefs?.[0]?.briefSignature&&s.weights.some(w=>w.kg===79.9),'new signature');await page.getByRole('heading',{name:'morningのAI作戦',exact:true}).waitFor();assert.equal(briefCount(),2);
 // The next phase triggers once. In-flight requests survive tab/date changes and update the correct date only.
 held=true;await page.clock.fastForward('03:01:00');await page.getByRole('status').filter({hasText:'更新中…'}).waitFor();await nav('食事');await nav('今日');await page.getByRole('status').filter({hasText:'更新中…'}).waitFor();await page.getByRole('button',{name:'前の日',exact:true}).click();release();held=false;await until(s=>s.homeBriefs?.some(r=>r.date===date&&r.phase==='afternoon'&&r.brief),'afternoon reply');assert.equal(await page.getByRole('heading',{name:'afternoonのAI作戦',exact:true}).count(),0);await page.getByRole('button',{name:'次の日',exact:true}).click();await page.getByRole('heading',{name:'afternoonのAI作戦',exact:true}).waitFor();assert.equal(briefCount(),3);assert.ok(requests.filter(r=>r.task==='brief').at(-1).context.companion.memory.some(m=>m.phase==='morning'));
 // A failed auto attempt is cached and never loops on tab changes or reloads.
 failed=true;await page.clock.fastForward('06:01:00');await page.getByRole('alert').filter({hasText:'利用上限です'}).waitFor();await until(s=>s.homeBriefs?.some(r=>r.phase==='evening'&&r.error),'evening failure');assert.equal(briefCount(),4);await nav('食事');await nav('今日');await page.reload();await page.getByRole('alert').filter({hasText:'利用上限です'}).waitFor();assert.equal(briefCount(),4);
 failed=false;await page.getByRole('button',{name:'AIに再接続',exact:true}).click();await page.getByRole('heading',{name:'eveningのAI作戦',exact:true}).waitFor();assert.equal(briefCount(),5);
 // New records, then the first return to home re-checks once; another quick change within the cooldown does not.
 await page.clock.fastForward('00:11:00');await nav('食事');await page.getByRole('tab',{name:'食品リスト'}).click();await page.getByRole('button',{name:'ゆで卵を1食追加',exact:true}).click();await until(s=>s.meals.some(m=>m.name==='ゆで卵'),'meal');
 await nav('今日');await until(s=>s.homeBriefs?.some(r=>r.phase==='evening'&&r.autoRefreshes===1&&r.brief),'stale refresh');assert.equal(briefCount(),6);
 await nav('食事');await page.getByRole('button',{name:'ゆで卵を1食追加',exact:true}).click();await nav('今日');await page.waitForTimeout(300);assert.equal(briefCount(),6);
 await page.locator('.week-strip').waitFor();assert.equal(await page.locator('.day-checklist button.on').filter({hasText:'間食'}).count()+await page.locator('.day-checklist button.on').filter({hasText:'夕食'}).count()>=1,true);
 // Home offers no mode switches or disclosure controls, even when offline.
 const requestCount=briefCount();await page.context().setOffline(true);
 assert.equal(await page.locator('.home-companion details').count(),0);
 for(const name of ['別の視点','AIで再判定','この作戦を相談'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
 assert.equal(briefCount(),requestCount);await page.context().setOffline(false);
 await fs.mkdir('test-artifacts',{recursive:true});for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`test-artifacts/home-ai-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'設定',exact:true}).first().click();await page.getByLabel('レベル・クエスト・ボス・称号を表示する').uncheck();await until(s=>s.settings.gameMode===false,'game off');await nav('今日');
 assert.equal(await page.locator('.companion-xp').count(),0);await page.locator('.home-brief').waitFor();assert.doesNotMatch(await page.locator('.home-brief h2').textContent(),/冒険|装備|セーブ/);
 assert.deepEqual(errors,[]);console.log('PASS: top chat and shared follow-up; morning/night and previous-night inputs; default-on with opt-out, 3 phases, persisted cache, stale refresh, navigation races, failed auto no retries, one rate-limited re-check after new records, 320/390/1280px; companion memory, completion, continuous chat and automatic refresh without mode switches, game opt-out');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
