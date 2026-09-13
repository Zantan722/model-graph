import type {ProjectReport} from './desktop-ai';
import {importPuml} from './puml';

// Validate again at the renderer boundary; incomplete/failed drafts never replace a canvas.
export function collectReadyFlows(report:ProjectReport){
 return report.themes.flatMap(theme=>theme.views.flatMap(story=>{
  if(story.status!=='ready'||!story.source)return [];
  const parsed=importPuml(story.source,story.diagram);
  if(parsed.errors.length)return [];
  return [{id:JSON.stringify([report.id,theme.id,story.id]),title:`${theme.title} / ${story.title}`,source:story.source,parsed}];
 }));
}
