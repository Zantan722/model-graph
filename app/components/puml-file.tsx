'use client';
import {useEffect,useRef,useState} from 'react';
import type {PumlDocument,SavePlan} from '../../lib/desktop-ai';
export function PumlFile({source,document,onOpen,onSaved}:{source:string;document:PumlDocument|null;onOpen:(d:PumlDocument)=>void;onSaved:(d:PumlDocument)=>void}){
 const [plan,setPlan]=useState<SavePlan|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[desktop,setDesktop]=useState(false);const modal=useRef<HTMLDialogElement>(null);
 useEffect(()=>setDesktop(Boolean(window.modelGraphAI)),[]);useEffect(()=>{if(plan)modal.current?.showModal();},[plan]);
 async function prepare(asNew=false){setError('');setBusy(true);try{setPlan(await window.modelGraphAI!.preparePuml({id:asNew?undefined:document?.id,source}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function close(){if(plan)await window.modelGraphAI!.cancelPuml(plan.token);setPlan(null);}
 if(!desktop)return null;
 return <><div className="puml-file-actions"><button disabled={busy} onClick={async()=>{setError('');try{const d=await window.modelGraphAI!.openPuml();if(d)onOpen(d);}catch(e){setError((e as Error).message);}}}>開啟 PUML</button><button disabled={busy} onClick={()=>void prepare()}>儲存 PUML</button>{document&&<button disabled={busy} onClick={()=>void prepare(true)}>另存</button>}<span>{document?`${document.name}${document.source===source?' · 已儲存':' · 有變更'}`:'尚未連結檔案'}</span></div>{error&&<p role="alert">{error}</p>}
 {plan&&<dialog ref={modal} className="puml-dialog" aria-label="儲存前確認差異" onCancel={e=>{e.preventDefault();void close();}}><header className="puml-heading"><h2>儲存 {plan.name}</h2></header><div className="puml-code"><p>請比較原檔與即將儲存的內容。畫布編輯後會標準化 PUML，一般註解與樣式可能改變。</p><div className="save-comparison"><label>原檔<textarea readOnly value={plan.before} aria-label="原檔內容"/></label><label>即將儲存<textarea readOnly value={plan.after} aria-label="即將儲存內容"/></label></div></div><footer className="puml-footer"><span>{plan.before===plan.after?'內容沒有變更':'只會儲存此預覽的內容'}</span><div><button disabled={busy} onClick={()=>void close()}>返回</button><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{onSaved(await window.modelGraphAI!.savePuml(plan.token));setPlan(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>確認儲存</button></div>{error&&<p role="alert">{error}</p>}</footer></dialog>}
 </>;
}
