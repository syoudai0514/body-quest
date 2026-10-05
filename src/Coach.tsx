import {useState} from 'react';
import {RotateCcw,Send,Sparkles} from 'lucide-react';
import type {AppState} from './types';
import {CoachSelector} from './GoalForm';
import {aiContext,askAi,type Turn} from './ai';
import {Field} from './ui';
import {today} from './domain';

const starters=['今日の夕食を、外食で選ぶなら？','残りのカロリーとたんぱく質で、次の食事を提案して','プロテインを取り入れるなら、いつ・どれくらい？','今週の筋トレメニューを組んで','前回の筋トレから、どう伸ばせばいい？','吉野家で選ぶなら？サラダ牛丼も気になる','飲み会の日の食事を考えて','体重の傾向から次の一週間を提案して','自分の目標に必要な赤字と、現在のプランの不足を教えて'];
const followUps=['もっと簡単にできる案は？','コンビニで買えるもので','明日の朝食と昼食も','筋トレのメニューも組んで'];

export function Answer({text}:{text:string}) {return <div className="answer-text">{text.split('\n').map((line,i)=>line.startsWith('【')?<strong key={i} className="answer-heading">{line}</strong>:line.trim()?<p key={i}>{line}</p>:null)}</div>;}

export type Exchange={q:string;a:string};
// One conversation per record date, kept in the parent so tab switches keep it (including a pending request).
// A reply is applied only if its conversation and request are still the current ones, so late answers never overwrite a newer consultation.
export type Conversation={id:string;turns:Exchange[];pending?:string;asking?:string;error?:string};
export const newConversation=():Conversation=>({id:crypto.randomUUID(),turns:[]});
export function applyReply(c:Conversation,conversation:string,request:string,result:{exchange:Exchange}|{error:string}):Conversation {
 if(c.id!==conversation||c.pending!==request)return c;
 return 'exchange' in result?{id:c.id,turns:[...c.turns,result.exchange]}:{id:c.id,turns:c.turns,error:result.error};
}
export function CoachPanel({state,date,context,online,question,setQuestion,update,convo,setConvo}:{state:AppState;date:string;context:string;online:boolean;question:string;setQuestion:(q:string)=>void;update:(fn:(s:AppState)=>AppState)=>void;convo:Conversation;setConvo:(date:string,fn:(c:Conversation)=>Conversation)=>void}) {
 const [next,setNext]=useState(''),thread=convo.turns,busy=!!convo.pending,error=convo.error??'';
 async function ask(q:string,keep:boolean) {
  const sentFor=date,conversation=keep?convo.id:crypto.randomUUID(),request=crypto.randomUUID(),base=keep?thread:[];
  const history:Turn[]=base.slice(-4).flatMap(t=>[{role:'user' as const,text:t.q},{role:'model' as const,text:t.a}]);
  setConvo(sentFor,()=>({id:conversation,turns:base,pending:request,asking:q}));
  let result:{exchange:Exchange}|{error:string};
  try{const r=await askAi('coach',q,aiContext({...state,contexts:{...state.contexts,[sentFor]:context}},sentFor),undefined,history);result={exchange:{q,a:r.text??''}};if(keep)setNext('');}
  catch(e){result={error:e instanceof Error?e.message:'AIを利用できません'};}
  setConvo(sentFor,c=>applyReply(c,conversation,request,result));
 }
 return <section className="card coach-panel"><div className="section-heading"><h2><Sparkles size={20}/>{date===today()?'今日':date.slice(5).replace('-','/')}の相談</h2><span className="pill">Gemini</span></div>
  <CoachSelector settings={state.settings} save={settings=>update(s=>({...s,settings}))}/>
  {!thread.length&&!busy?<>
   <div className="filter-chips">{starters.map(q=><button key={q} className={question===q?'selected':''} onClick={()=>setQuestion(q)}>{q}</button>)}</div>
   <Field label="コーチへの相談"><textarea rows={3} maxLength={3000} value={question} onChange={e=>setQuestion(e.target.value)}/></Field>
   <p className="muted">送信すると相談内容・設定・今日の食事と残り・最近の体重、運動記録・よく食べる食品がGoogle Geminiに送られます。医療上の判断や薬の変更は相談先の医師へ。</p>
   <button className="primary" disabled={busy||!question.trim()||!online} onClick={()=>ask(question,false)}><Sparkles size={18}/>{busy?'考えています…':'相談する'}</button>
  </>:<>
   <p className="muted chat-date">{date.slice(5).replace('-','/')}の記録をもとにした相談です。日付を変えると、その日の相談に切り替わります。</p><div className="chat">{thread.map((t,i)=><div key={i}><p className="chat-question">{t.q}</p><div className="ai-answer"><span className="eyebrow lime">GEMINI COACH</span><Answer text={t.a}/></div></div>)}{busy&&convo.asking?<div><p className="chat-question">{convo.asking}</p><p className="muted" role="status">考えています…</p></div>:null}</div>
   <div className="filter-chips">{followUps.map(q=><button key={q} onClick={()=>setNext(q)}>{q}</button>)}</div>
   <Field label="続けて質問"><textarea rows={2} maxLength={3000} value={next} onChange={e=>setNext(e.target.value)} placeholder="例：鶏肉以外だと？ 量をもう少し増やしたい"/></Field>
   <div className="quick-actions"><button className="primary" disabled={busy||!next.trim()||!online} onClick={()=>ask(next,true)}><Send size={17}/>{busy?'考えています…':'続けて質問する'}</button><button className="secondary" onClick={()=>setConvo(date,()=>newConversation())}><RotateCcw size={16}/>新しい相談</button></div>
  </>}
  {error?<p className="error" role="alert">{error}</p>:null}
 </section>;
}
