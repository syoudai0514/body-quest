import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184'],{stdio:'inherit'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4184')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];
 await page.route('**/api/assistant',route=>{if(route.request().method()!=='POST')return route.fulfill({json:{configured:true}});const body=route.request().postDataJSON();requests.push(body);
  return route.fulfill({json:body.task==='food'?{foods:[{name:'カフェラテ',portion:'430ml',kcal:808,protein:30,fat:0,carbs:18.5,estimated:false,basis:'label',note:'2枚目の表示'},{name:'おにぎり',portion:'1個',kcal:180,protein:4,fat:1,carbs:39,estimated:true,note:'1枚目',issue:'写真の栄養表示の基準量と食べた量を対応付けられなかったため、推定値として読み取りました。表示と量を確認してください。'}],skipped:1}:{brief:{headline:'一歩ずつ',summary:'続けましょう。',tips:['記録']}}});});
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const until=async(check,label)=>{for(let i=0;i<100;i++){const s=await state();if(s&&check(s))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('not persisted: '+label);};
 await page.goto('http://127.0.0.1:4184');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();
 await page.locator('.bottom-nav').getByRole('button',{name:'食事',exact:true}).click();await page.getByRole('tab',{name:'文章・写真'}).click();
 // A real 2x2 PNG so the browser can decode and re-encode it.
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==','base64');
 const file=n=>({name:`p${n}.png`,mimeType:'image/png',buffer:png});
 const input=page.locator('.meal-entry input[type=file]');
 await input.setInputFiles([file(1),file(2)]);await page.locator('.ai-images figure').nth(1).waitFor();
 assert.equal(await page.locator('.ai-images figure').count(),2);
 await page.getByRole('button',{name:'写真2を外す'}).click();assert.equal(await page.locator('.ai-images figure').count(),1);
 await input.setInputFiles([3,4,5,6,7,8,9,10,11,12].map(file));await page.getByText('写真は10枚までです',{exact:false}).waitFor();assert.equal(await page.locator('.ai-images figure').count(),1,'too many at once are refused');
 await input.setInputFiles([3,4,5,6,7,8,9,10,11].map(file));await page.locator('.ai-images figure').nth(9).waitFor();
 assert.equal(await input.isDisabled(),true,'no more than ten photos');
 await page.getByLabel('食べたものと量').fill('昼ごはん');await page.getByRole('button',{name:'読み取って確認'}).click();await page.locator('.draft').nth(1).waitFor();
 const sent=requests.filter(r=>r.task==='food').at(-1);assert.equal(sent.images.length,10);assert.ok(sent.images.every(i=>i.startsWith('data:image/jpeg;base64,')));assert.equal('image' in sent,false);
 await page.getByText('1件は数値を確認できなかったため除きました',{exact:false}).waitFor();
 const latte=page.locator('.draft').nth(0),onigiri=page.locator('.draft').nth(1);
 await latte.getByText(/kJ/).waitFor();assert.equal(await latte.getByRole('button',{name:'確認して記録'}).isDisabled(),true);
 await onigiri.getByText(/推定値として読み取りました/).waitFor();assert.equal(await onigiri.getByRole('button',{name:'確認して記録'}).isDisabled(),true);
 await onigiri.getByLabel('重量の基準と栄養値を確認しました').check();await onigiri.getByRole('button',{name:'確認して記録'}).click();
 await until(s=>s.meals.some(m=>m.name==='おにぎり'),'checked onigiri');
 // Correcting the misread energy clears the kJ warning without a tick.
 await latte.getByLabel('カロリー（kcal）').fill('193');await latte.getByRole('button',{name:'確認して記録'}).click();
 await until(s=>s.meals.some(m=>m.name==='カフェラテ'&&m.kcal===193),'corrected latte');
 assert.equal(await page.locator('.ai-images figure').count(),0,'photos are cleared once everything is recorded');
 assert.deepEqual(errors,[]);
 console.log('PASS: up to ten meal photos in one request, per-photo removal, partial results, kJ and fallback warnings gate recording');
} finally {await browser?.close();server.kill();}
