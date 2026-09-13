import type {ProjectReport} from './desktop-ai';
import {importPuml} from './puml';
export type DiagramDraft={source:string;versions:string[]};
export type DiagramDrafts=Record<string,DiagramDraft>;
export const DRAFT_KEY='modelgraph-diagram-drafts-v1';
export function loadDrafts(raw:string|null):DiagramDrafts{
 if(!raw)return {};const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('圖表版本資料損壞');
 for(const value of Object.values(data) as DiagramDraft[]){if(!value||typeof value.source!=='string'||!Array.isArray(value.versions)||value.versions.some(v=>typeof v!=='string')||importPuml(value.source).errors.length)throw new Error('圖表版本資料損壞');}return data;
}
export function withDrafts(report:ProjectReport|null,drafts:DiagramDrafts):ProjectReport|null{
 if(!report)return null;return {...report,themes:report.themes.map(t=>({...t,views:t.views.map(v=>{const draft=drafts[JSON.stringify([report.id,t.id,v.id])];return draft?{...v,source:draft.source}:v;})}))};
}
