import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4183')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/assistant',route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const body=route.request().postDataJSON();return route.fulfill({json:body.task==='food'?{foods:[{name:'いつものカレー',portion:'200g',kcal:320,protein:25,fat:12,carbs:28,estimated:true,note:'登録・履歴の値を使用'}]}:{brief:{headline:'一歩ずつ',summary:'記録を続けましょう。',tips:['朝の体重を記録']}}});});
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,today=iso(new Date());
 await page.goto('http://127.0.0.1:4183');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 // The weight entry sits above the home brief.
 const order=await page.evaluate(()=>{const w=document.getElementById('home-weight'),b=document.querySelector('.brief-details');return !!w&&!!b&&!!(w.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);});
 assert.equal(order,true,'weight comes before the brief');
 // Night tab -> full form opens on 夜 and saves to 夜.
 await page.getByRole('button',{name:'夜の体重 未記録'}).click();await page.getByRole('button',{name:'体組成・ウエストも記録'}).click();
 assert.equal(await page.locator('.modal .segmented button.active').innerText(),'夜');
 await page.locator('.modal').getByLabel('体重（kg）',{exact:true}).fill('71.2');await page.locator('.modal').getByRole('button',{name:'体重を保存'}).click();
 await until(s=>s.weights.some(w=>w.time==='夜'&&w.kg===71.2&&w.date===today),'night weight');
 // A past date chosen on another tab does not leak into the plan tab's weight form.
 await nav('食事');for(let i=0;i<3;i++)await page.getByRole('button',{name:'前の日'}).click();
 await nav('計画');await page.locator('.section-heading',{hasText:'体重の推移'}).getByRole('button',{name:'記録'}).click();
 assert.match(await page.locator('.weight-form-date').innerText(),/今日/);
 await page.locator('.modal').getByLabel('体重（kg）',{exact:true}).fill('72.0');await page.locator('.modal').getByRole('button',{name:'体重を保存'}).click();
 await until(s=>s.weights.some(w=>w.time==='朝'&&w.date===today&&w.kg===72),'today morning weight');
 // Weight rows can be edited and a delete can be undone.
 await page.locator('.records-details summary').click();
 await page.getByRole('button',{name:`${today} 朝の体重を修正`}).click();
 assert.equal(await page.locator('.modal').getByLabel('体重（kg）',{exact:true}).inputValue(),'72');await page.getByRole('button',{name:'閉じる'}).click();
 await page.getByRole('button',{name:`${today} 夜の体重を削除`}).click();await until(s=>!s.weights.some(w=>w.time==='夜'),'weight deleted');
 await page.getByRole('button',{name:'取り消す'}).click();await until(s=>s.weights.some(w=>w.time==='夜'&&w.kg===71.2),'weight restored');
 // Meals: AI entry clears after recording, a meal can move to another slot, and a delete can be undone.
 await nav('食事');await page.getByRole('button',{name:'次の日'}).click();await page.getByRole('button',{name:'次の日'}).click();await page.getByRole('button',{name:'次の日'}).click();
 await page.getByRole('tab',{name:'文章・写真'}).click();await page.getByLabel('食べたものと量').fill('いつものカレー');
 await page.getByRole('button',{name:'読み取って確認'}).click();await page.getByRole('button',{name:'確認して記録'}).click();
 await until(s=>s.meals.some(m=>m.name==='いつものカレー'),'ai meal');
 assert.equal(await page.getByLabel('食べたものと量').inputValue(),'','the AI text is cleared once everything is recorded');
 await page.locator('.record-edit').first().click();await page.locator('.modal').getByRole('button',{name:'間食',exact:true}).click();
 await until(s=>s.meals.find(m=>m.name==='いつものカレー')?.slot==='間食','moved slot');
 await page.getByRole('button',{name:'いつものカレーの記録を削除'}).click();await until(s=>!s.meals.length,'meal deleted');
 await page.getByRole('button',{name:'取り消す'}).click();await until(s=>s.meals.length===1&&s.meals[0].slot==='間食','meal restored');
 assert.deepEqual(errors,[]);
 console.log('PASS: weight above brief, night form, plan-tab date, weight edit/undo, AI entry reset, slot move, meal delete undo');
} finally {await browser?.close();server.kill();}
