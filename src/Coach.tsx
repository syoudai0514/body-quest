import {useState} from 'react';
import {RotateCcw,Send,Sparkles} from 'lucide-react';
import type {AppState} from './types';
import {CoachSelector} from './GoalForm';
import {aiContext,askAi,type Turn} from './ai';
import {Field} from './ui';

const starters=['今日の夕食を、外食で選ぶなら？','残りのカロリーとたんぱく質で、次の食事を提案して','プロテインを取り入れるなら、いつ・どれくらい？','今週の筋トレメニューを組んで','前回の筋トレから、どう伸ばせばいい？','吉野家で選ぶなら？サラダ牛丼も気になる','飲み会の日の食事を考えて','体重の傾向から次の一週間を提案して','自分の目標に必要な赤字と、現在のプランの不足を教えて'];
const followUps=['もっと簡単にできる案は？','コンビニで買えるもので','明日の朝食と昼食も','筋トレのメニューも組んで'];

export function Answer({text}:{text:string}) {return <div className="answer-text">{text.split('\n').map((line,i)=>line.startsWith('【')?<strong key={i} className="answer-heading">{line}</strong>:line.trim()?<p key={i}>{line}</p>:null)}</div>;}

export function CoachPanel({state,date,context,online,question,setQuestion,update}:{state:AppState;date:string;context:string;online:boolean;question:string;setQuestion:(q:string)=>void;update:(fn:(s:AppState)=>AppState)=>void}) {
 const [thread,setThread]=useState<{q:string;a:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[next,setNext]=useState('');
 async function ask(q:string,keep:boolean) {
  setBusy(true);setError('');
  const base=keep?thread:[],history:Turn[]=base.slice(-4).flatMap(t=>[{role:'user' as const,text:t.q},{role:'model' as const,text:t.a}]);
  try{const result=await askAi('coach',q,aiContext({...state,contexts:{...state.contexts,[date]:context}},date),undefined,history);setThread([...base,{q,a:result.text??''}]);if(keep)setNext('');}
  catch(e){setError(e instanceof Error?e.message:'AIを利用できません');}
  finally{setBusy(false);}
 }
 return <section className="card coach-panel"><div className="section-heading"><h2><Sparkles size={20}/>今日の相談</h2><span className="pill">Gemini</span></div>
  <CoachSelector settings={state.settings} save={settings=>update(s=>({...s,settings}))}/>
  {!thread.length?<>
   <div className="filter-chips">{starters.map(q=><button key={q} className={question===q?'selected':''} onClick={()=>setQuestion(q)}>{q}</button>)}</div>
   <Field label="コーチへの相談"><textarea rows={3} maxLength={3000} value={question} onChange={e=>setQuestion(e.target.value)}/></Field>
   <p className="muted">送信すると相談内容・設定・今日の食事と残り・最近の体重、運動記録・よく食べる食品がGoogle Geminiに送られます。医療上の判断や薬の変更は相談先の医師へ。</p>
   <button className="primary" disabled={busy||!question.trim()||!online} onClick={()=>ask(question,false)}><Sparkles size={18}/>{busy?'考えています…':'相談する'}</button>
  </>:<>
   <div className="chat">{thread.map((t,i)=><div key={i}><p className="chat-question">{t.q}</p><div className="ai-answer"><span className="eyebrow lime">GEMINI COACH</span><Answer text={t.a}/></div></div>)}</div>
   <div className="filter-chips">{followUps.map(q=><button key={q} onClick={()=>setNext(q)}>{q}</button>)}</div>
   <Field label="続けて質問"><textarea rows={2} maxLength={3000} value={next} onChange={e=>setNext(e.target.value)} placeholder="例：鶏肉以外だと？ 量をもう少し増やしたい"/></Field>
   <div className="quick-actions"><button className="primary" disabled={busy||!next.trim()||!online} onClick={()=>ask(next,true)}><Send size={17}/>{busy?'考えています…':'続けて質問する'}</button><button className="secondary" disabled={busy} onClick={()=>{setThread([]);setError('');}}><RotateCcw size={16}/>新しい相談</button></div>
  </>}
  {error?<p className="error" role="alert">{error}</p>:null}
 </section>;
}
