import type {DiagramType} from './diagram-types';
export type ViewEvidence={path:string;startLine:number;endLine:number;excerpt:string};
export type ViewItem={id:string;type:'element'|'relationship'|'step'|'stage'|'state'|'transition';title:string;description:string;from?:string;to?:string;evidence:ViewEvidence[]};
export type ProjectView={seedPaths?:string[];sourcePaths?:string[];id:string;title:string;summary:string;purpose:string;scope:string;diagram:DiagramType;level:string;trigger?:string;uncertainty:string;legacy?:boolean;content:{kind:'structure'|'scenario'|'pipeline'|'lifecycle'|'legacy';items:ViewItem[]};status:'proposed'|'queued'|'generating'|'ready'|'failed';source?:string;draftSource?:string;error?:string;warnings?:{line:number;message:string}[]};
export type ProjectReport={discovery?:boolean;version:2;id:string;createdAt:string;project:string;title:string;summary:string;status:string;diagram?:DiagramType;level?:string;prompt?:string;legacy?:boolean;snapshotAvailable:boolean;error?:string;coverage:{indexed:number;excluded:number;read:{path:string;sha256:string}[];omitted:{path:string;reason:string}[]};themes:{id:string;title:string;question:string;rationale:string;status:string;gaps:string[];error?:string;views:ProjectView[]}[]};
export type SourceFolder={name:string;files:{path:string;bytes:number}[];skipped:number;limited:boolean};
export type ViewSelection={id:string;reportId:string;viewIds:string[]};
export type AIRequest={provider:string;custom:string;model:string;prompt:string;current:string;diagram:string;level:string;selection:string;files:string[];useFolder?:boolean;runId?:string;intent?:'auto'|'diagram'|'stories'|'project'};
export function viewPrompt(view:ProjectView){return `依據來源修改「${view.title}」。\n圖種：${view.diagram}${view.diagram==='c4'?` / ${view.level}`:''}\n目的：${view.purpose}\n範圍：${view.scope}\n${view.summary}\n${view.trigger?`觸發：${view.trigger}\n`:''}內容：\n${view.content.items.map(i=>`${i.title}：${i.description}（${i.evidence.map(e=>`${e.path}:${e.startLine}-${e.endLine}`).join('、')}）`).join('\n')}${view.uncertainty?`\n補充：${view.uncertainty}`:''}\n依此圖種呈現結構或行為，不把假設當成已實作。`;}
export type PumlDocument={id:string;name:string;source:string};
export type SavePlan={token:string;name:string;before:string;after:string};
declare global {interface Window {modelGraphAI?:{
 openPuml:()=>Promise<PumlDocument|null>;
 preparePuml:(request:{id?:string;source:string})=>Promise<SavePlan|null>;
 savePuml:(token:string)=>Promise<PumlDocument>;
 cancelPuml:(token:string)=>Promise<boolean>;
 report:()=>Promise<ProjectReport|null>;
 onProgress:(callback:(event:{runId?:string;phase?:string;message?:string;report?:ProjectReport})=>void)=>()=>void;
 folder:()=>Promise<SourceFolder|null>;
 executable:()=>Promise<string|null>;
 check:(provider:string,custom:string)=>Promise<{executable:string;version:string;auth:string}>;
 generate:(request:AIRequest)=>Promise<{kind:'diagram';source:string;files:string[]}|{kind:'project';report:ProjectReport;files:string[]}>;
 generateViews:(request:{provider:string;custom:string;model:string;reportId:string;viewIds:string[];runId:string})=>Promise<{kind:'project';report:ProjectReport;files:string[]}>;
 cancel:()=>Promise<boolean>;
}}}
