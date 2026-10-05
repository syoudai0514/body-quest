import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.BODY_QUEST_PLAYWRIGHT??'playwright');
const profile=await mkdtemp(join(tmpdir(),'body-quest-no-password-'));
const server=spawn('node',['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174'],{stdio:'inherit'});
const launch=()=>chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true,...(process.env.BODY_QUEST_CHROMIUM?{executablePath:process.env.BODY_QUEST_CHROMIUM,args:['--no-sandbox']}:{} )});
let context;
const requests=[];
async function open(){context=await launch();const page=await context.newPage();await page.route('**/api/assistant',async route=>{if(route.request().method()==='POST'){const req=route.request();requests.push(req);assert.equal(req.headers().authorization,undefined);const task=req.postDataJSON().task;await route.fulfill({json:task==='food'?{foods:[{name:'ご飯',portion:'150g',kcal:234,protein:3.8,fat:0.5,carbs:55.7,estimated:true,note:'テスト推定値'}]}:{text:'パスワード入力なしで相談できます。'}});}else await route.fulfill({json:{configured:true}});});await page.goto('http://127.0.0.1:4174');await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();return page;}
async function coach(page){await page.locator('.bottom-nav').getByRole('button',{name:'コーチ',exact:true}).click();await page.getByRole('button',{name:'相談する',exact:true}).click();await page.getByText('パスワード入力なしで相談できます。',{exact:true}).waitFor();}
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4174')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 let page=await open();
 await page.locator('.header-settings').click();assert.equal(await page.locator('input[type=password]').count(),0);assert.equal(await page.getByRole('button',{name:'パスコードを保存',exact:true}).count(),0);
 await coach(page);assert.equal(requests.filter(r=>r.postDataJSON().task!=='brief').length,1);
 await page.evaluate(()=>{localStorage.setItem('body-quest-access','old-value-for-cleanup-test');sessionStorage.setItem('body-quest-access','old-value-for-cleanup-test');});await page.reload();await page.getByRole('heading',{name:'今日のクエスト'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('body-quest-access')),null);assert.equal(await page.evaluate(()=>sessionStorage.getItem('body-quest-access')),null);
 await context.close();page=await open();await coach(page);assert.equal(requests.filter(r=>r.postDataJSON().task!=='brief').length,2);
 await page.locator('.bottom-nav').getByRole('button',{name:'食事',exact:true}).click();await page.getByRole('tab',{name:'文章・写真'}).click();await page.getByLabel('食べたものと量',{exact:true}).fill('ご飯150g');await page.getByRole('button',{name:'読み取って確認',exact:true}).click();await page.getByRole('button',{name:'確認して記録',exact:true}).waitFor();assert.equal(requests.filter(r=>r.postDataJSON().task!=='brief').length,3);
 assert.ok(requests.some(r=>r.postDataJSON().task==='brief'));console.log('PASS: fresh install has no password input, default auto brief without credentials, coach without credentials, browser restart without credentials, food AI without credentials, legacy saved password cleanup');
} finally {if(context)await context.close();server.kill('SIGTERM');}
