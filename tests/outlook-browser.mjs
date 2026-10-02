import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175'],{stdio:'inherit'});
const day=new Date().toISOString().slice(0,10),after=n=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4175')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('body-quest',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return new Promise((r,j)=>{const q=db.transaction('data').objectStore('data').get('state');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});});
 const waitState=async expected=>{for(let i=0;i<100;i++){const s=await state();if(s&&Object.entries(expected).every(([k,v])=>s.settings[k]===v))return s;await new Promise(r=>setTimeout(r,50));}throw new Error('settings were not persisted: '+JSON.stringify(expected));};
 const form=page.locator('.goal-form'),save=()=>form.getByRole('button',{name:'目標と食事プランを保存',exact:true}).click();
 await page.goto('http://127.0.0.1:4175');await page.getByRole('button',{name:'目標を設定する',exact:true}).click();
 for(const [label,value] of [['身長（cm）','182'],['年齢','42'],['開始体重（kg）','88'],['目標体重（kg）','80'],['目標日',after(51)]])await form.getByLabel(label,{exact:true}).fill(value);
 await form.getByText('少なくともモデル上 177日',{exact:true}).waitFor();
 assert.ok((await form.locator('.goal-outlook').innerText()).includes('85.6'));
 await form.getByRole('button',{name:'基礎代謝未満も含む詳細調整',exact:true}).click();await save();
 await form.getByRole('alert').filter({hasText:'チェック'}).waitFor();assert.equal((await state()).settings.energy,undefined);
 await form.getByLabel('基礎代謝だけでは安全性を判断できないことと、設定の上限・下限を確認しました',{exact:true}).check();
 await form.getByText('少なくともモデル上 147日',{exact:true}).waitFor();
 await form.getByText(/推定基礎代謝.*未満/).first().waitFor();
 await form.getByRole('button',{name:'自分で調整',exact:true}).click();await form.getByLabel('カロリー（kcal）',{exact:true}).fill('1600');await save();
 await form.getByRole('alert').filter({hasText:'設定下限'}).waitFor();
 await form.getByRole('button',{name:'目標から自動計算',exact:true}).click();await save();
 await waitState({caloriePolicy:'flexible',belowBmrAcknowledged:true,kcal:1740});
 await page.locator('.bottom-nav').getByRole('button',{name:'今日',exact:true}).click();await page.getByText('自動目標 1,740 kcal',{exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();await waitState({caloriePolicy:'flexible',belowBmrAcknowledged:true,kcal:1740});
 await page.locator('.bottom-nav').getByRole('button',{name:'計画',exact:true}).click();
 await page.getByText('通常モードと詳細調整を比較する',{exact:true}).click();assert.equal(await page.locator('.outlook-comparison table tbody tr').count(),2);
 await fs.mkdir('test-artifacts',{recursive:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('.goal-outlook').screenshot({path:`test-artifacts/outlook-${width}.png`});}
 await page.getByRole('button',{name:'目標を85.2kgに変更',exact:true}).click();await waitState({targetWeight:85.2});
 await page.getByRole('button',{name:'計画を編集',exact:true}).click();await form.getByLabel('目標体重（kg）',{exact:true}).fill('80');await save();await waitState({targetWeight:80});
 await page.getByRole('button',{name:'この目安の日付に変更',exact:true}).click();await waitState({deadline:after(147)});
 await page.getByRole('button',{name:'計画を編集',exact:true}).click();await form.getByRole('button',{name:'通常モード',exact:true}).click();await save();
 const final=await waitState({caloriePolicy:'standard',belowBmrAcknowledged:false});assert.ok(final.settings.kcal>=1812.5);
 assert.deepEqual(errors,[]);
 console.log('PASS: below-BMR acknowledgement, bounded manual input, auto calories/PFC and persistence, comparative forecast, candidate target/date actions, standard reset, 320/390px and no page errors');
} finally {if(browser)await browser.close();server.kill('SIGTERM');}
