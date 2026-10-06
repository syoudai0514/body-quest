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
 const requests=[];let releaseA;const holdA=new Promise(r=>releaseA=r);
 await page.route('**/api/assistant',async route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const body=route.request().postDataJSON();requests.push(body);if(/古い相談A/.test(body.text??''))await holdA;
  await route.fulfill({json:body.task==='food'?{foods:[{name:'いつものカレー',portion:'200g',kcal:320,protein:25,fat:12,carbs:28,estimated:true,note:'登録・履歴の値を使用'},{name:'ご飯',portion:'200g',kcal:312,protein:5,fat:0.6,carbs:74,estimated:true,note:'普通盛り'}]}:{text:/古い相談A/.test(body.text)?'【古い相談Aの回答】':/新しい相談B/.test(body.text)?'【相談Bの回答】':body.history?'【鶏肉以外】\n・鮭の塩焼き':/腰に痛み/.test(body.text)?'【回復を優先】\n・痛む動作は休止':'【夕食の提案】\n・鶏胸肉のポン酢蒸し 200kcal P37g'}});});
 const day=new Date(),iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,today=iso(day);
 await page.goto('http://127.0.0.1:4176');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();

 // Without a goal, Today shows what was recorded rather than a personal-looking remainder.
 await page.getByText('目標が未設定のため、残りは表示していません。',{exact:false}).waitFor();
 assert.equal(await page.getByRole('button',{name:'0.1kg減らす',exact:true}).isDisabled(),true);

 // Older backups may contain two records for the same morning: the last one (and its waist) wins.
 await until(s=>!!s,'initial save');
 await page.evaluate(async t=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);});s.weights=[{id:'a',date:t,time:'朝',kg:80},{id:'b',date:t,time:'朝',kg:79,waist:85}];await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(s,'state');tx.oncomplete=r;});},today);
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await page.getByText(/今朝の体重 79\.0/).waitFor();await page.getByRole('button',{name:'修正',exact:true}).click();
 assert.equal(await page.getByLabel('朝の体重（kg）',{exact:true}).inputValue(),'79.0');
 await page.getByRole('button',{name:'0.1kg減らす',exact:true}).click();await page.getByRole('button',{name:'朝の体重を更新',exact:true}).click();
 let s=await until(s=>s.weights.length===1&&s.weights[0].kg===78.9,'dedupe');assert.equal(s.weights[0].waist,85);
 await page.getByText(/今朝の体重 78\.9/).waitFor();

 // History: record yesterday's breakfast, then reuse it today in one tap, with undo.
 await page.getByRole('button',{name:'前の日',exact:true}).click();await nav('食事');
 await page.locator('.slots').getByRole('button',{name:'朝食',exact:true}).click();
 await page.getByRole('button',{name:'ゆで卵を1食追加',exact:true}).click();await page.getByRole('button',{name:'納豆を1食追加',exact:true}).click();
 await until(s=>s.meals.length===2,'yesterday');
 await page.getByRole('button',{name:'次の日',exact:true}).click();await page.getByRole('tab',{name:'履歴から'}).click();
 await page.getByRole('button',{name:/前日の朝食と同じ/}).click();
 s=await until(s=>s.meals.length===4,'copy slot');assert.equal(s.meals.filter(m=>m.slot==='朝食').length,4);
 await page.getByRole('button',{name:'取り消す'}).click();await until(s=>s.meals.length===2,'undo');
 await page.getByRole('button',{name:/前日の朝食と同じ/}).click();await until(s=>s.meals.length===4,'copy again');
 await page.locator('.history-picker').getByRole('button',{name:'ゆで卵をもう一度追加',exact:true}).click();await until(s=>s.meals.length===5,'history chip');

 // Protein: a lean suggestion is one tap away.
 const protein=(await state()).meals.reduce((a,m)=>a+m.protein,0);
 await page.locator('.protein-picks button').first().click();s=await until(s=>s.meals.length===6,'protein pick');assert.ok(s.meals.reduce((a,m)=>a+m.protein,0)>protein+5);
 assert.ok(s.foods.some(f=>f.id==='protein-shake'));

 // Training: the recommended menu fills the form with its intensity.
 await nav('今日');assert.equal(await page.locator('.quest-item').count(),5);await page.locator('.quest-item').filter({hasText:'体を動かす'}).click();await page.getByRole('heading',{name:'今日できる運動を。'}).waitFor();
 const recommended=await page.locator('.training-plan.recommended h3').innerText();
 await page.locator('.training-plan.recommended').getByRole('button',{name:'このメニューを記録する',exact:true}).click();
 assert.equal(await page.getByLabel('運動・メニュー',{exact:true}).inputValue(),recommended);
 await page.getByRole('button',{name:'運動を保存',exact:true}).click();s=await until(s=>s.exercises.length===1,'exercise');assert.equal(s.exercises[0].name,recommended);assert.ok(s.exercises[0].met>1);

 // Coach: follow-ups keep the conversation across tabs, and each date has its own.
 await nav('コーチ');await page.getByRole('button',{name:'相談する',exact:true}).click();await page.getByText('【夕食の提案】',{exact:true}).waitFor();
 await nav('食事');await nav('コーチ');await page.getByText('【夕食の提案】',{exact:true}).waitFor();
 await page.getByRole('button',{name:'前の日',exact:true}).click();await page.getByRole('button',{name:'相談する',exact:true}).waitFor();assert.equal(await page.getByText('【夕食の提案】',{exact:true}).count(),0);
 await page.getByRole('button',{name:'次の日',exact:true}).click();
 await page.getByLabel('続けて質問',{exact:true}).fill('鶏肉以外だと？');await page.getByRole('button',{name:'続けて質問する',exact:true}).click();await page.getByText('【鶏肉以外】',{exact:true}).waitFor();
 let coach=requests.filter(r=>r.task==='coach');assert.equal(coach[0].history,undefined);assert.deepEqual(coach[1].history.map(t=>t.role),['user','model']);assert.equal(coach[1].context.date,today);
 assert.ok(coach[1].context.today.proteinRemaining>=0);assert.ok(coach[1].context.knownFoods.some(f=>f.name==='ゆで卵'));

 // Pain: the training screen, the question and the AI context agree.
 await nav('運動');await page.getByLabel('今日は腰に痛みがある').check();await until(s=>s.painDates?.includes(today),'pain');
 await page.getByRole('button',{name:'痛みがある日の過ごし方をAIに相談',exact:true}).click();await page.getByRole('button',{name:'相談する',exact:true}).click();await page.getByText('【回復を優先】',{exact:true}).waitFor();
 coach=requests.filter(r=>r.task==='coach');const painAsk=coach.at(-1);assert.match(painAsk.text,/腰に痛み/);assert.equal(painAsk.context.today.painToday,true);assert.equal(painAsk.context.today.suggestedWorkout.name,'回復を優先');assert.equal(painAsk.history,undefined);

 // A late reply to an abandoned consultation never overwrites the newer one, and pending state survives tab switches.
 await nav('コーチ');await page.getByRole('button',{name:'新しい相談',exact:true}).click();
 await page.locator('.coach-panel textarea').fill('古い相談A');await page.getByRole('button',{name:'相談する',exact:true}).click();
 await page.getByRole('status').filter({hasText:'考えています…'}).waitFor();
 await nav('食事');await nav('コーチ');await page.getByRole('status').filter({hasText:'考えています…'}).waitFor();assert.equal(await page.getByRole('button',{name:'相談する',exact:true}).count(),0);
 await page.getByRole('button',{name:'新しい相談',exact:true}).click();await page.locator('.coach-panel textarea').fill('新しい相談B');await page.getByRole('button',{name:'相談する',exact:true}).click();
 await page.getByText('【相談Bの回答】',{exact:true}).waitFor();
 releaseA();await page.waitForResponse(r=>r.url().includes('/api/assistant')&&r.request().postDataJSON()?.text==='古い相談A');await page.waitForTimeout(200);
 assert.equal(await page.getByText('【相談Bの回答】',{exact:true}).count(),1);assert.equal(await page.getByText('古い相談A',{exact:true}).count(),0);assert.equal(await page.getByText('【古い相談Aの回答】',{exact:true}).count(),0);

 // Food AI: several dishes at once with relative scaling, saved for reuse.
 await nav('食事');await page.getByRole('tab',{name:'文章・写真'}).click();await page.getByLabel('食べたものと量',{exact:true}).fill('いつものカレーとご飯200g');await page.getByRole('button',{name:'読み取って確認',exact:true}).click();
 const first=page.locator('.draft').first(),kcal=()=>first.getByLabel('カロリー（kcal）',{exact:true}).inputValue();
 await first.getByRole('button',{name:'×2',exact:true}).click();await first.getByRole('button',{name:'×2',exact:true}).click();assert.equal(await kcal(),'640');
 await first.getByRole('button',{name:'×1',exact:true}).click();assert.equal(await kcal(),'320');
 await page.getByLabel('マイ食品にも保存して次回から選べるようにする').check();await page.getByRole('button',{name:/2品をまとめて記録/}).click();
 s=await until(s=>s.meals.length===8,'food AI');assert.ok(s.foods.some(f=>f.name==='いつものカレー'&&f.category==='マイ食品'));
 assert.ok(requests.find(r=>r.task==='food').context.knownFoods.length>0);

 await nav('今日');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await fs.mkdir('test-artifacts',{recursive:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`test-artifacts/today-${width}.png`,fullPage:true});}
 await nav('食事');await page.screenshot({path:'test-artifacts/meals-390.png',fullPage:true});
 await nav('運動');await page.screenshot({path:'test-artifacts/training-320.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: unconfigured Today, duplicate-morning restore keeps latest weight and waist, compact weight after save, previous-slot copy with undo, distinct history, protein picks, recommended workout, coach threads per date and across tabs, late reply ignored after a new consultation, pain in AI context, relative AI scaling, multi-dish save, 320/390px');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
