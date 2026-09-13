'use client';
import {useState} from 'react';
import type {ProjectReport,ProjectView} from '../../lib/desktop-ai';
import {diagramTypes} from '../../lib/diagram-types';
const labels:Record<string,string>={interrupted:'已中斷',running:'整理候選中',reading:'追查來源',synthesizing:'整理說明',pending:'等待處理',described:'已整理說明',proposed:'尚未產圖',queued:'本批排隊中',generating:'產圖中',ready:'已完成',complete:'完成',partial:'部分完成',failed:'未完成',cancelled:'已取消',awaiting_selection:'等待選圖'};
const itemLabels:Record<string,string>={structure:'元素與依賴',scenario:'情境步驟',pipeline:'資料處理與流向',lifecycle:'狀態與轉換',legacy:'舊版情境分析'};
function download(name:string,text:string,type:string){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
export function ProjectReportView({report,onPreview,onRefine,onGenerate,canGenerate,disabled}:{report:ProjectReport;onPreview:(source:string)=>void;onRefine:(view:ProjectView)=>void;onGenerate:(ids:string[])=>void;canGenerate:boolean;disabled?:boolean}){
 const [filter,setFilter]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const all=report.themes.flatMap(t=>t.views),ready=all.filter(v=>v.status==='ready').length;
 const eligible=all.filter(v=>['proposed','failed'].includes(v.status)&&!v.legacy);
 const chosen=selected.filter(id=>eligible.some(v=>v.id===id));
 const query=filter.trim().toLowerCase();
 const visible=report.themes.map(t=>({...t,views:(t.title+t.question).toLowerCase().includes(query)?t.views:t.views.filter(v=>(v.title+v.summary+v.purpose).toLowerCase().includes(query))})).filter(t=>t.views.length||!query);
 const locked=Boolean(disabled)||!report.snapshotAvailable;
 return <section className="project-report" aria-label="圖表清單">
 <header><span className="eyebrow">DIAGRAMS</span><h2>{report.title}</h2><p>{report.summary}</p><div className="report-counts"><strong>{report.themes.length} 主題</strong><strong>{all.length} 張候選圖</strong><strong>{ready} 張已完成</strong><span>{labels[report.status]||report.status}</span>{report.diagram&&<span>{diagramTypes[report.diagram].name}{report.diagram==='c4'?` / ${report.level}`:''}</span>}</div></header>
 <p>{report.project} · {report.discovery?'候選圖根據專案概覽建議，尚未核對實作。勾選後才讀取相關程式碼與文件。':'已保留先前整理的圖表與來源。'}</p>
 {report.error&&<p role="alert" className="puml-error">{report.error}</p>}
 <div className="view-selection-bar"><div><strong>先讀說明，再選擇要畫的圖</strong><p>未勾選不讀取該圖的實作、不產圖。可分批選擇；已完成的圖不會重跑。</p></div><div className="ai-actions"><button disabled={locked||!eligible.length} onClick={()=>setSelected(ids=>[...new Set([...ids,...eligible.filter(v=>visible.some(t=>t.views.some(item=>item.id===v.id))).map(v=>v.id)])])}>選取篩選結果</button><button disabled={disabled||!chosen.length} onClick={()=>setSelected([])}>清除選取</button><button className="primary" disabled={locked||!canGenerate||!chosen.length} onClick={()=>{onGenerate(chosen);setSelected([]);}}>產生所選 {chosen.length} 張圖</button></div><p role="status">已選 {chosen.length} 張／可選 {eligible.length} 張</p>{!report.snapshotAvailable&&<p>{disabled?'正在整理候選，完成後即可選圖。':'此清單缺少來源參考，請重新列出候選；既有圖仍可預覽。'}</p>}{!canGenerate&&!disabled&&<p>請在左側選擇 Codex CLI 或 Claude Code，以產生所選圖表。</p>}</div>
 <div className="ai-actions"><button onClick={()=>download('model-graph-project-report.json',JSON.stringify(report,null,2),'application/json')}>下載圖表清單與 PUML</button></div>
 <label>篩選主題或視圖<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="例如 身分驗證、訂單或部署"/></label>
 {visible.map(theme=><section className="theme-section" key={theme.id}><header><span className="small-label">{labels[theme.status]||theme.status}</span><h3>{theme.title}</h3><p>{theme.question}</p><p>{theme.rationale}</p></header>{theme.error&&<p className="puml-error">{theme.error}</p>}
 {theme.views.map(view=><article className="story-card" key={view.id} data-view-id={view.id}>
 <span className="small-label">{diagramTypes[view.diagram].name}{view.diagram==='c4'?` / ${view.level}`:''} · {labels[view.status]||view.status}</span>
 <label className="view-choice"><input type="checkbox" aria-label={`選擇 ${view.title}`} disabled={locked||!eligible.some(v=>v.id===view.id)} checked={chosen.includes(view.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,view.id]:ids.filter(id=>id!==view.id))}/><span>{view.title}</span></label>
 <p>{view.summary}</p><p><strong>回答的問題：</strong>{view.purpose}</p><p><strong>範圍：</strong>{view.scope}</p>{view.trigger&&<p><strong>觸發：</strong>{view.trigger}</p>}{view.legacy&&<p>舊版情境分析，保留原始內容。</p>}
 {view.content.items.length>0&&<details><summary>{itemLabels[view.content.kind]} · {view.content.items.length} 項與來源</summary><ul>{view.content.items.map((item,i)=><li key={i}><strong>{item.title}</strong><p>{item.description}</p>{item.evidence.map((e,j)=><details key={j}><summary>{e.path}:{e.startLine}–{e.endLine}</summary><pre>{e.excerpt}</pre></details>)}</li>)}</ul></details>}
 {view.sourcePaths&&view.sourcePaths.length>0&&<details><summary>本圖參考檔案 · {view.sourcePaths.length}</summary>{view.sourcePaths.map(p=><p key={p}>{p}</p>)}</details>}<div className="ai-actions">{view.source&&<><button className="primary" onClick={()=>onPreview(view.source!)}>預覽／載入視圖</button><button onClick={()=>download(`${view.id}.puml`,view.source!,'text/plain')}>下載 PUML</button></>}{<button disabled={disabled} onClick={()=>onRefine(view)}>帶回 Prompt 修改</button>}{view.draftSource&&<button onClick={()=>onPreview(view.draftSource!)}>修正未通過的草稿</button>}</div>{view.error&&<p className="puml-error">{view.error}</p>}{view.warnings?.map((w,i)=><p key={i}>圖表提醒：{w.message}</p>)}
 </article>)}</section>)}
 {!all.length&&!disabled&&<p>目前沒有候選圖。可以回到直接畫圖，描述你想畫的內容。</p>}
 <details><summary>參考來源</summary><p>{report.discovery?'候選使用專案概覽；每次產生所選圖表時，讀取參考資料夾當下的相關內容。':'舊版清單使用當時保存的來源快照。'}</p>{report.coverage.read.map(f=><p key={f.path}>{f.path}<code>{f.sha256.slice(0,16)}</code></p>)}{report.coverage.omitted.map(f=><p key={f.path}>略過 {f.path}：{f.reason}</p>)}</details>
 <p>候選清單與已完成圖表保存在本機，下次啟動可從「圖表清單」繼續選圖。畫布編輯可另存至流程庫。</p>
 </section>;
}
