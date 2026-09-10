import type {DiagramType} from './diagram-types';
export type RepoStory={id:string;title:string;summary:string;diagram:DiagramType;level:string;trigger:string;uncertainty:string;steps:{title:string;description:string;evidence:{path:string;startLine:number;endLine:number;excerpt:string}[]}[]};
export type ProjectStory=RepoStory & {flowStatus:'pending'|'generating'|'ready'|'failed';source?:string;draftSource?:string;error?:string;warnings?:{line:number;message:string}[]};
export type ProjectReport={version:1;id:string;createdAt:string;project:string;title:string;summary:string;status:string;error?:string;coverage:{indexed:number;excluded:number;read:{path:string;sha256:string}[];omitted:{path:string;reason:string}[]};themes:{id:string;title:string;question:string;rationale:string;status:string;gaps:string[];error?:string;stories:ProjectStory[]}[]};
export type SourceFolder={name:string;files:{path:string;bytes:number}[];skipped:number;limited:boolean};
export type AIRequest={provider:string;custom:string;model:string;prompt:string;current:string;diagram:string;level:string;selection:string;files:string[];useFolder?:boolean;runId?:string;intent?:'diagram'|'stories'|'project'};
declare global {interface Window {modelGraphAI?:{
 report:()=>Promise<ProjectReport|null>;
 onProgress:(callback:(event:{runId?:string;phase?:string;message?:string;report?:ProjectReport})=>void)=>()=>void;
 folder:()=>Promise<SourceFolder|null>;
 executable:()=>Promise<string|null>;
 check:(provider:string,custom:string)=>Promise<{executable:string;version:string;auth:string}>;
 generate:(request:AIRequest)=>Promise<{kind:'diagram';source:string;files:string[]}|{kind:'project';report:ProjectReport;files:string[]}>;
 cancel:()=>Promise<boolean>;
}}}
