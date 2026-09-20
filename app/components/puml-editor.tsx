'use client';
import { useEffect, useRef, useState } from 'react';
import { Braces, Download, Upload, X, Check, ArrowRight, AlignLeft } from 'lucide-react';
import { GraphPreview } from './graph-preview';
import { formatPuml, importPuml, type PumlResult } from '../../lib/puml';
import { diagramTypes, type DiagramType } from '../../lib/diagram-types';
import { downloadText } from './canvas-export';

export function PumlEditor({initialSource,onClose,onApply}:{initialSource:string;onClose:()=>void;onApply:(result:PumlResult)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),file=useRef<HTMLInputElement>(null);
 const [source,setSource]=useState(initialSource),[type,setType]=useState<DiagramType|'auto'>('auto');
 const [result,setResult]=useState<PumlResult|null>(()=>{try{return importPuml(initialSource);}catch{return null;}}),[fileError,setFileError]=useState('');
 useEffect(()=>{dialog.current?.showModal();},[]);
 function close(){if(source!==initialSource&&!window.confirm('原始碼尚未套用到畫布，確定捨棄這次編輯？'))return;onClose();}
 function change(text:string){setSource(text);setResult(null);setFileError('');}
 function download(){downloadText(source,'model-graph.puml','text/plain;charset=utf-8');}
 function format(){const next=formatPuml(source);if(next!==source)change(next);}
 return <dialog ref={dialog} className="puml-dialog" onCancel={e=>{e.preventDefault();close();}} aria-labelledby="puml-title">
  <header className="puml-heading"><div><Braces size={20}/><h2 id="puml-title">PlantUML 原始碼</h2><span className="small-label">.PUML</span></div><button aria-label="關閉 PUML 編輯器" onClick={close}><X size={18}/></button></header>
  <div className="puml-actions"><button onClick={()=>file.current?.click()}><Upload size={16}/> 開啟 PUML</button><button onClick={download} disabled={!source.trim()}><Download size={16}/> 下載原始碼</button><button onClick={format} disabled={!source.trim()}><AlignLeft size={16}/> 格式化</button><label>匯入類型<select value={type} onChange={e=>{setType(e.target.value as DiagramType|'auto');setResult(null);}}><option value="auto">自動辨識</option>{Object.entries(diagramTypes).map(([id,t])=><option value={id} key={id}>{t.name}</option>)}</select></label></div>
  <div className="puml-content"><div className="puml-code"><label htmlFor="puml-source">PUML 原始碼 · 可貼上或直接修改</label><textarea id="puml-source" spellCheck={false} value={source} onChange={e=>change(e.target.value)} placeholder={'@startuml\nparticipant Browser\nparticipant API\nBrowser -> API : request\nAPI --> Browser : response\n@enduml'}/><small>目前內容可直接下載；「格式化」只調整排版，不會修正語法；「解析並檢查」不會更動畫布。</small></div>
  <aside className="puml-report" aria-live="polite"><h3>匯入檢查</h3>{fileError&&<p className="puml-error">{fileError}</p>}{!result?<><p>解析後可查看圖表類型、元素數量與相容性，再套用至對應畫布。</p><div className="info-card"><p>支援常見宣告、別名、箭頭、節點註解、活動 if / while，以及 C4 巨集。巢狀群組、alt / loop、任意 include 等進階語法會阻擋套用並標出行號。</p></div></>:<><div className="puml-summary"><span>{diagramTypes[result.diagram].name}{result.diagram==='c4'?` · ${result.level}`:''}</span><strong>{result.graph.nodes.length} 節點 · {result.graph.edges.length} 關係</strong><small>{result.graph.notes.length} 則註解</small></div>{result.errors.length===0&&<><GraphPreview graph={result.graph}/><small>關係縮圖，實際排版與時序呈現以套用後畫布為準。</small></>}{result.errors.length===0&&<p className="puml-success"><Check size={16}/> 已通過匯入語法檢查</p>}{result.errors.map((e,i)=><p className="puml-error" key={`error-${i}`}><strong>第 {e.line} 行</strong>{e.message}</p>)}{result.warnings.map((w,i)=><p className="puml-warning" key={`warning-${i}`}><strong>第 {w.line} 行 · 轉換提醒</strong>{w.message}</p>)}</>}
  <p className="puml-footnote">畫布使用 Model Graph 呈現，並非 PlantUML 原生渲染。重新匯出會產生標準化原始碼，原檔的排版、一般註解與樣式不會逐字保留。</p></aside></div>
  <footer className="puml-footer"><span>套用會取代對應圖表畫布，可使用復原還原。</span><div><button onClick={()=>{try{setResult(importPuml(source,type));setFileError('');}catch{setResult(null);setFileError('無法解析此檔案，畫布未被修改。');}}} disabled={!source.trim()}>解析並檢查</button><button className="primary" disabled={!result||result.errors.length>0} onClick={()=>{if(result&&!result.errors.length)onApply(result);}}>套用至畫布 <ArrowRight size={16}/></button></div></footer>
  <input ref={file} hidden type="file" accept=".puml,.plantuml,.pu,.txt,text/plain" onChange={async e=>{const input=e.currentTarget,f=input.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw new Error('PUML 上限 2 MB');change(await f.text());}catch(err){setFileError((err as Error).message);}input.value='';}}/>
 </dialog>;
}
