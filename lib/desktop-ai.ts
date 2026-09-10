export type SourceFolder={name:string;files:{path:string;bytes:number}[];skipped:number;limited:boolean};
export type AIRequest={provider:string;custom:string;model:string;prompt:string;current:string;diagram:string;level:string;selection:string;files:string[];useFolder?:boolean};
declare global {interface Window {modelGraphAI?:{
 folder:()=>Promise<SourceFolder|null>;
 executable:()=>Promise<string|null>;
 check:(provider:string,custom:string)=>Promise<{executable:string;version:string;auth:string}>;
 generate:(request:AIRequest)=>Promise<{source:string;files:string[]}>;
 cancel:()=>Promise<boolean>;
}}}
