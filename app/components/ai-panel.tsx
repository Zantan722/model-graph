'use client';
import {useEffect,useState,useRef} from 'react';
import {FlowLibrary} from './flow-library';
import type {SourceFolder,RepoStory,ProjectReport} from '../../lib/desktop-ai';
import {importPuml,type PumlResult} from '../../lib/puml';
import type {DiagramType} from '../../lib/diagram-types';
export function AIPanel({prompt,current,diagram,level,selection,onPreview,onPrompt,onLocal,onDiagram,onReport,onBusy,onGenerated,storyToRefine}:{onGenerated:(result:PumlResult)=>void;onReport:(report:ProjectReport,live?:boolean)=>void;onBusy:(busy:boolean)=>void;storyToRefine:RepoStory|null;onDiagram:(diagram:DiagramType,level:string)=>void;onPrompt:(value:string)=>void;onLocal:()=>void;prompt:string;current:string;diagram:DiagramType;level:string;selection:string;onPreview:(source:string)=>void}){
 const [desktop,setDesktop]=useState(false),[provider,setProvider]=useState('local'),[custom,setCustom]=useState(''),[model,setModel]=useState('');
 const [intent,setIntent]=useState<'diagram'|'project'>('project');
 const runId=useRef('');
 const [folder,setFolder]=useState<SourceFolder|null>(null),[usedFiles,setUsedFiles]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[result,setResult]=useState('');
 useEffect(()=>{setDesktop(Boolean(window.modelGraphAI));if(window.modelGraphAI){let saved='codex';try{const value=localStorage.getItem('modelgraph-ai-provider');if(value&&['local','claude','codex'].includes(value))saved=value;}catch{}setProvider(saved);}},[]);
 function changeProvider(value:string){setProvider(value);setCustom('');setModel('');setStatus('');setError('');try{localStorage.setItem('modelgraph-ai-provider',value);}catch{setStatus('無法記住提供者設定，本次選擇仍有效');}}
 const providerLabel=provider==='codex'?'Codex CLI':provider==='claude'?'Claude Code':'本機規則';
 useEffect(()=>{const api=window.modelGraphAI;if(!api)return;api.report().then(report=>{if(report&&!runId.current)onReport(report);}).catch(e=>setError(`上次報告讀取失敗：${e.message}`));return api.onProgress(event=>{if(event.runId!==runId.current)return;if(event.message)setStatus(event.message);if(event.report)onReport(event.report,true);});},[onReport]);
 useEffect(()=>{onBusy(busy);},[busy,onBusy]);
 useEffect(()=>{if(storyToRefine)chooseStory(storyToRefine);},[storyToRefine]);
 async function check(){setChecking(true);setError('');try{const r=await window.modelGraphAI!.check(provider,custom);setStatus(`${r.version} · ${r.auth}`);}catch(e){setError((e as Error).message);}finally{setChecking(false);}}
 async function choose(){setChecking(true);setError('');try{const r=await window.modelGraphAI!.folder();if(r){setFolder(r);setIntent('project');setUsedFiles([]);setResult('');}}catch(e){setError((e as Error).message);}finally{setChecking(false);}}
 const canGenerate=!busy&&!checking&&(provider==='local'?Boolean(prompt.trim()):(intent==='project'?Boolean(folder):Boolean(prompt.trim()||folder)));
 function chooseStory(story:RepoStory){onDiagram(story.diagram,story.level);setIntent('diagram');onPrompt(`依據專案程式碼繪製「${story.title}」。\n${story.summary}\n觸發：${story.trigger}\n步驟：\n${story.steps.map((step,i)=>`${i+1}. ${step.title}：${step.description}（${step.evidence.map(e=>`${e.path}:${e.startLine}-${e.endLine}`).join('、')}）`).join('\n')}\n待確認：${story.uncertainty}\n重新核對来源，呈現主要路徑與確有依據的分支，標註來源，勿把推測当作已實作。`);setStatus(`已載入「${story.title}」，可調整 Prompt 後產圖`);}
 async function generate(){if(!canGenerate)return;if(provider==='local'){onLocal();return;}runId.current=crypto.randomUUID();setBusy(true);setError('');setResult('');setUsedFiles([]);setStatus(`${providerLabel} 正在分析並產圖，正在建立分析計畫…`);try{
 const r=await window.modelGraphAI!.generate({provider,custom,model,prompt,current,diagram,level,selection,files:[],useFolder:Boolean(folder),intent,runId:runId.current});
 setUsedFiles(r.files);
 if(r.kind==='project'){onReport(r.report,true);setStatus(`分析${r.report.status==='complete'?'完成':'結束（保留已完成結果）'}：${r.report.themes.length} 個主題，${r.report.themes.reduce((n,t)=>n+t.stories.filter(s=>s.flowStatus==='ready').length,0)} 份 Flow`);return;}
 const parsed=importPuml(r.source,diagram);
 if(parsed.errors.length){setError(`結果需要修正：${parsed.errors.slice(0,3).map(e=>`第 ${e.line} 行 ${e.message}`).join('；')}`);}
 setResult(r.source);if(!parsed.errors.length){onGenerated(parsed);setStatus(`產圖完成 · 使用 ${r.files.length} 份來源，已自動同步到畫布，可復原。`);}else{setStatus('結果未通過檢查，請修正 PUML 後套用。');}
 }catch(e){setError((e as Error).message);setStatus('產圖已停止；已同步的畫布與完成結果保留。');}finally{setBusy(false);}}
 return <section className="ai-panel unified-composer" aria-label="圖表產生器">
 <label>產圖提供者<select aria-label="產圖提供者" value={provider} disabled={busy||checking} onChange={e=>changeProvider(e.target.value)}><option value="local">本機規則（離線）</option><option value="claude" disabled={!desktop}>Claude Code</option><option value="codex" disabled={!desktop}>Codex CLI</option></select></label>
 {provider!=='local'&&<label>本次產出<select aria-label="分析模式" value={intent} disabled={busy||checking} onChange={e=>setIntent(e.target.value as 'diagram'|'project')}><option value="diagram">修改／產生單張指定圖表</option><option value="project">主題式 Repo 分析 · 多 Story／Flow</option></select></label>}
 <label htmlFor="unified-prompt">描述需求 / Prompt</label><div className="composer"><textarea id="unified-prompt" aria-label="圖表描述" maxLength={12000} disabled={busy} value={prompt} placeholder={provider==='local'?'例如 Browser → API → Database':'例如：根據選取的程式碼，畫出登入流程，並標出驗證失敗的分支。'} onChange={e=>onPrompt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();void generate();}}}/></div>
 {provider!=='local'&&<>
 <div className="ai-actions"><button disabled={busy||checking} onClick={choose}>{folder?'更換專案資料夾':'選擇專案資料夾'}</button>{folder&&<button disabled={busy} onClick={()=>{setFolder(null);setUsedFiles([]);setResult('');}}>移除專案</button>}</div>
 {folder&&<p><strong>{folder.name}</strong> · {folder.files.length} 份可讀檔案。依主題追查程式碼、文件與呼叫關係，自動產生多份 Flow。App 不限制來源檔案大小與數量。</p>}
 </>}
 {provider!=='local'&&<details><summary>模型設定</summary>
 <label>模型（留白使用 CLI 預設）<input value={model} maxLength={200} disabled={busy} onChange={e=>setModel(e.target.value)} placeholder="預設模型"/></label>
 <label>CLI 路徑（留白自動偵測）<input value={custom} disabled={busy||checking} maxLength={4096} onChange={e=>{setCustom(e.target.value);setStatus('');}} placeholder="/完整路徑/claude 或 codex"/></label>
 <div className="ai-actions"><button disabled={busy||checking} onClick={async()=>{try{const p=await window.modelGraphAI!.executable();if(p){setCustom(p);setStatus('');}}catch(e){setError((e as Error).message);}}}>選執行檔</button><button disabled={busy||checking} onClick={check}>{checking?'檢查中…':'檢查 CLI／登入'}</button></div>
 </details>}
 <p>{provider==='local'?'支援 A → B → C 與「新增 名稱」；專案分析僅在 AI 模式使用。':<>使用上述 Prompt、目前畫布、已保存的 comment{selection?'與選取元素':''}。未輸入描述時，依來源產生目前選定的圖表類型。{folder?`專案：${folder.name}`:'可選擇專案資料夾作為分析來源。'}</>}</p>
 {provider!=='local'&&<p>按下分析或產圖會將專案檔案清單、AI 選取的檔案內容與圖表送至所選 CLI 的模型服務。隱藏檔、常見憑證與建置目錄已排除；送出前請確認此專案適合交由模型分析。</p>}
 <div className="ai-actions"><button className="primary" aria-label="產生圖表" disabled={!canGenerate} onClick={generate}>{busy?`${providerLabel} 產圖中…`:`使用 ${providerLabel} ${provider!=='local'&&intent==='project'?'分析主題並產生多份 Flow':'產生圖表'}`}</button>{busy&&<button onClick={async()=>{try{await window.modelGraphAI!.cancel();setStatus('正在取消…');}catch(e){setError((e as Error).message);}}}>取消</button>}</div>
 <p role="status">{status}</p>{error&&<p role="alert" className="puml-error">{error}</p>}
 {usedFiles.length>0&&<details><summary>本次參考 {usedFiles.length} 份檔案</summary>{usedFiles.map(name=><p key={name}>{name}</p>)}</details>}
 {result&&<button onClick={()=>onPreview(result)}>預覽／修正 PUML 與套用</button>}
 <FlowLibrary current={current} result={result} project={folder?.name||''} onPreview={onPreview}/>
 {!desktop&&<p>Claude Code／Codex 與資料夾附件需在 Electron 桌面版使用。</p>}
 </section>;
}
