import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4182'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4182')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/assistant',route=>route.fulfill({json:{configured:false}}));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true}).click();
 await page.goto('http://127.0.0.1:4182');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 // Number fields: a 0 can be cleared and typing never leaves a leading zero.
 await nav('食事');await page.getByRole('button',{name:'食品を登録'}).click();
 const kcal=page.getByLabel('カロリー（kcal）');assert.equal(await kcal.inputValue(),'0');
 await kcal.click();await page.keyboard.press('End');await page.keyboard.type('15');assert.equal(await kcal.inputValue(),'15');
 await kcal.fill('');assert.equal(await kcal.inputValue(),'','an emptied field stays empty instead of snapping back to 0');
 await kcal.type('120');assert.equal(await kcal.inputValue(),'120');
 await page.getByRole('button',{name:'閉じる'}).click();
 await page.getByRole('button',{name:'皮なし鶏胸肉を1食追加'}).locator('..').getByRole('button',{name:'量を変更'}).click();
 const grams=page.getByLabel('食べた量（g）'),times=page.getByLabel('基準量の何倍？');
 await grams.fill('');await grams.type('150');assert.equal(await grams.inputValue(),'150');await page.waitForFunction(()=>document.querySelector('input[aria-label],label')&&[...document.querySelectorAll('.modal input')].some(i=>i.value==='1.5'));assert.equal(await times.inputValue(),'1.5','the linked 倍 field follows the grams');
 await page.getByRole('button',{name:'食事に追加',exact:true}).click();
 await until(s=>s.meals.length===1&&s.meals[0].quantity===1.5,'150g chicken');
 // Favorites from a remembered meal, then one-tap from the favorites tab.
 await page.getByRole('tab',{name:'履歴から'}).click();
 await page.getByRole('button',{name:'皮なし鶏胸肉をお気に入りに登録'}).click();
 await until(s=>s.favorites?.includes('chicken'),'history star');
 await page.getByRole('tab',{name:'お気に入り'}).click();
 await page.getByRole('button',{name:'皮なし鶏胸肉を追加',exact:true}).click();
 await until(s=>s.meals.length===2,'favorite one-tap');
 // A home recipe from the coach tab.
 await nav('コーチ');await page.getByRole('button',{name:'鶏胸肉のポン酢蒸しをお気に入りに登録'}).click();
 await until(s=>s.favorites?.includes('ponzu'),'recipe star');
 await nav('食事');await page.getByRole('tab',{name:'履歴から'}).click();await page.getByRole('tab',{name:'お気に入り'}).click();
 assert.equal(await page.locator('.history-chip-row').count(),2);
 await page.getByRole('button',{name:'皮なし鶏胸肉をお気に入りから解除'}).click();
 await until(s=>!s.favorites.includes('chicken'),'unstar');
 assert.deepEqual(errors,[]);
 console.log('PASS: number fields clear without leading zeros; favorites from history, recipes and the favorites tab');
} finally {await browser?.close();server.kill();}
