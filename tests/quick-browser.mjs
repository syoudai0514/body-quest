import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4176'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4176')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 const requests=[];
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const body=route.request().postDataJSON();requests.push(body);
  await route.fulfill({json:body.task==='food'?{foods:[{name:'いつものカレー',portion:'200g',kcal:320,protein:25,fat:12,carbs:28,estimated:true,note:'登録・履歴の値を使用'},{name:'ご飯',portion:'200g',kcal:312,protein:5,fat:0.6,carbs:74,estimated:true,note:'普通盛り'}]}:{text:requests.filter(r=>r.task==='coach').length===1?'【夕食の提案】\n・鶏胸肉のポン酢蒸し 200kcal P37g':'【鶏肉以外】\n・鮭の塩焼き'}});});
 await page.goto('http://127.0.0.1:4176');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();

 // Weight: type once on the home screen, then nudge and update without opening a dialog.
 await page.getByLabel('朝の体重（kg）',{exact:true}).fill('80');await page.getByRole('button',{name:'朝の体重を保存',exact:true}).click();
 await until(s=>s.weights.length===1&&s.weights[0].kg===80,'weight');
 await page.getByRole('button',{name:'0.1kg減らす',exact:true}).click();await page.getByRole('button',{name:'朝の体重を更新',exact:true}).click();
 const w=await until(s=>s.weights[0]?.kg===79.9,'weight update');assert.equal(w.weights.length,1);

 // History: record yesterday's breakfast, then reuse it today in one tap.
 await page.getByRole('button',{name:'前の日',exact:true}).click();await nav('食事');
 await page.locator('.slots').getByRole('button',{name:'朝食',exact:true}).click();
 await page.getByRole('button',{name:'ゆで卵を1食追加',exact:true}).click();await page.getByRole('button',{name:'納豆を1食追加',exact:true}).click();
 await until(s=>s.meals.length===2,'yesterday');
 await page.getByRole('button',{name:'次の日',exact:true}).click();await nav('今日');
 await page.locator('.quick-meals .slots').getByRole('button',{name:'朝食',exact:true}).click();
 await page.getByRole('button',{name:/前日の朝食と同じ/}).click();
 let s=await until(s=>s.meals.length===4,'copy slot');assert.equal(s.meals.filter(m=>m.slot==='朝食').length,4);
 await page.locator('.quick-meals').getByRole('button',{name:'ゆで卵をもう一度追加',exact:true}).click();await until(s=>s.meals.length===5,'history chip');

 // Protein: a lean suggestion is one tap away.
 const protein=(await state()).meals.reduce((a,m)=>a+m.protein,0);
 await page.locator('.protein-picks button').first().click();s=await until(s=>s.meals.length===6,'protein pick');assert.ok(s.meals.reduce((a,m)=>a+m.protein,0)>protein+5);
 assert.ok(s.foods.some(f=>f.id==='protein-shake'));

 // Training: the recommended menu fills the form with its intensity.
 await page.getByRole('button',{name:'メニューを見て記録',exact:true}).click();
 const recommended=await page.locator('.training-plan.recommended h3').innerText();
 await page.locator('.training-plan.recommended').getByRole('button',{name:'このメニューを記録する',exact:true}).click();
 assert.equal(await page.getByLabel('運動・メニュー',{exact:true}).inputValue(),recommended);
 await page.getByRole('button',{name:'運動を保存',exact:true}).click();s=await until(s=>s.exercises.length===1,'exercise');assert.equal(s.exercises[0].name,recommended);assert.ok(s.exercises[0].met>1);

 // Coach: follow-up questions keep the conversation.
 await nav('コーチ');await page.getByRole('button',{name:'相談する',exact:true}).click();await page.getByText('【夕食の提案】',{exact:true}).waitFor();
 await page.getByLabel('続けて質問',{exact:true}).fill('鶏肉以外だと？');await page.getByRole('button',{name:'続けて質問する',exact:true}).click();await page.getByText('【鶏肉以外】',{exact:true}).waitFor();
 const coach=requests.filter(r=>r.task==='coach');assert.equal(coach[0].history,undefined);assert.deepEqual(coach[1].history.map(t=>t.role),['user','model']);
 assert.ok(coach[1].context.today.proteinRemaining>=0);assert.ok(coach[1].context.knownFoods.some(f=>f.name==='ゆで卵'));

 // Food AI: several dishes at once, saved for reuse.
 await nav('食事');await page.getByLabel('食べたものと量',{exact:true}).fill('いつものカレーとご飯200g');await page.getByRole('button',{name:'読み取って確認',exact:true}).click();
 await page.getByLabel('マイ食品にも保存して次回から選べるようにする').check();await page.getByRole('button',{name:/2品をまとめて記録/}).click();
 s=await until(s=>s.meals.length===8,'food AI');assert.ok(s.foods.some(f=>f.name==='いつものカレー'&&f.category==='マイ食品'));
 assert.ok(requests.find(r=>r.task==='food').context.knownFoods.length>0);

 await nav('今日');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await fs.mkdir('test-artifacts',{recursive:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`test-artifacts/today-${width}.png`,fullPage:true});}
 await nav('運動');await page.screenshot({path:'test-artifacts/training-320.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: inline weight entry and nudge, previous-slot copy, history re-add, protein picks, recommended workout, coach follow-up with history, multi-dish AI with save, 320/390px');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
