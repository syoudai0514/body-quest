import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4185'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4185')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/assistant',route=>route.fulfill({json:{configured:false}}));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const edit=fn=>page.evaluate(async src=>{const f=eval(src);const db=await new Promise(r=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);});const s=await new Promise(r=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);});const next=f(s);await new Promise(r=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(next,'state');tx.oncomplete=r;});db.close();},fn.toString());
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 const dialog=()=>page.getByRole('dialog',{name:/./});
 const iso=n=>{const d=new Date();d.setDate(d.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 await page.goto('http://127.0.0.1:4185');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 // A new player: the first look seeds the starting rank without a celebration.
 await until(s=>Array.isArray(s.achievementsSeen)&&s.achievementsSeen.includes('rank1'),'seeded');assert.equal(await page.locator('.title-card').count(),0);
 // The first record earns 旅立ち; the celebration waits for the undo toast, then takes over the screen.
 await nav('食事');await page.getByRole('tab',{name:'食品リスト'}).click();await page.getByRole('button',{name:'ご飯を1食追加'}).click();
 const card=page.locator('.title-card');await card.waitFor({timeout:15000});
 assert.match(await card.innerText(),/称号を獲得！[\s\S]*旅立ち[\s\S]*最初の記録をつけた/);
 assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'),'true');
 await page.getByRole('button',{name:'やった！'}).click();await card.waitFor({state:'detached'});
 await until(s=>s.achievementsSeen.includes('first'),'first seen');
 // Not again after a reload, and not for what was already earned.
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await page.waitForTimeout(800);assert.equal(await page.locator('.title-card').count(),0);
 // An older save with titles already earned and no seen list is seeded silently, not celebrated.
 await edit(s=>{const day=n=>{const d=new Date();d.setDate(d.getDate()-n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  s.meals=[...s.meals.filter(m=>m.date===day(0)),...[1,2].map(n=>({id:'old'+n,date:day(n),slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:300,protein:10,fat:5,carbs:40}))];delete s.achievementsSeen;return s;});
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await page.waitForTimeout(800);
 assert.equal(await page.locator('.title-card').count(),0,'existing titles are not replayed');
 const seeded=await until(s=>Array.isArray(s.achievementsSeen),'reseeded');assert.ok(seeded.achievementsSeen.includes('first')&&seeded.achievementsSeen.includes('streak3'));
 // Game mode off: nothing is shown, and what is earned meanwhile is not saved up for later.
 await edit(s=>{s.settings.gameMode=false;const d=new Date();d.setDate(d.getDate()-3);const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;s.meals.push({id:'old3',date:day,slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:300,protein:10,fat:5,carbs:40},{id:'old4',date:(()=>{const e=new Date();e.setDate(e.getDate()-4);return `${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,'0')}-${String(e.getDate()).padStart(2,'0')}`;})(),slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:300,protein:10,fat:5,carbs:40});return s;});
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await page.waitForTimeout(1000);
 assert.equal(await page.locator('.title-card').count(),0);
 // Streak reaches 5 days: 三日坊主 was already seen; turning game mode back on brings no old celebrations.
 await edit(s=>{s.settings.gameMode=true;return s;});await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await page.waitForTimeout(1000);
 assert.equal(await page.locator('.title-card').count(),0,'turning the game back on does not replay');
 // A new badge: seven days in a row, shown with a path to the collection.
 await edit(s=>{for(const n of [5,6]){const d=new Date();d.setDate(d.getDate()-n);s.meals.push({id:'old'+n,date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,slot:'朝食',name:'x',quantity:1,source:'',estimated:true,kcal:300,protein:10,fat:5,carbs:40});}return s;});
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await page.waitForTimeout(800);assert.equal(await page.locator('.title-card').count(),1,'a title earned by new data shows up on the next open until it is acknowledged');
 assert.match(await page.locator('.title-card').innerText(),/一週間の勇者/);
 await page.getByRole('button',{name:'称号コレクションを見る'}).click();await page.locator('.achievements').waitFor();
 assert.equal(await page.locator('.title-card').count(),0);assert.ok((await state()).achievementsSeen.includes('streak7'));
 assert.deepEqual(errors,[]);
 console.log('PASS: title celebration after the undo window, once only, silent seeding for existing players, off when game mode is off, link to the collection');
} finally {await browser?.close();server.kill();}
