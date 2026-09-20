import {graphBounds,svgDocument,boundsSize,RASTER_SCALE,JPEG_BACKGROUND,type Bounds,type ExportFormat} from '../../lib/svg-export';
import type {Graph} from '../../lib/graph';
import type {DiagramType} from '../../lib/diagram-types';

export function downloadBlob(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function downloadText(text:string,filename:string,type:string){downloadBlob(new Blob([text],{type}),filename);}

// Canvas styling lives in globals.css, so a detached clone would render unstyled. Copy the used
// values off the live tree instead of duplicating the stylesheet.
const STYLE_PROPS=['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','color','font-family','font-size','font-weight','font-style','letter-spacing','text-anchor','paint-order','filter'];
const DEFAULTS:Record<string,string>={'fill-opacity':'1','stroke-dasharray':'none','stroke-linecap':'butt','stroke-linejoin':'miter',opacity:'1',filter:'none','font-style':'normal','letter-spacing':'normal','paint-order':'normal','text-anchor':'start'};

function inlineStyles(el:Element){
 const computed=getComputedStyle(el);
 const declarations:string[]=[];
 for(const prop of STYLE_PROPS){
  const value=computed.getPropertyValue(prop).trim();
  if(!value||value===DEFAULTS[prop])continue;
  declarations.push(`${prop}:${value}`);
 }
 if(declarations.length)el.setAttribute('style',declarations.join(';'));
 for(const child of Array.from(el.children))inlineStyles(child);
}

/** Serialize the live canvas into a standalone SVG of the whole graph, not the current viewport. */
export function canvasSvg(svg:SVGSVGElement,graph:Graph,diagram:DiagramType,background=''):{source:string;bounds:Bounds}{
 if(!graph.nodes.length)throw new Error('畫布沒有內容可以匯出');
 const clone=svg.cloneNode(true) as SVGSVGElement;
 for(const el of Array.from(clone.querySelectorAll('.port,.wire-preview,.edge-hit')))el.remove();
 for(const el of Array.from(clone.querySelectorAll('.selected,.connecting')))el.classList.remove('selected','connecting');
 clone.querySelector(':scope > g')?.removeAttribute('transform'); // drop pan/zoom; viewBox frames it
 // Resolve globals.css against a detached copy: the live tree would bake in whatever is
 // currently hovered, focused or selected.
 const stage=window.document.createElement('div');
 stage.setAttribute('style','position:fixed;left:-10000px;top:0;width:1200px;height:800px;overflow:hidden;pointer-events:none');
 stage.appendChild(clone);
 window.document.body.appendChild(stage);
 try{inlineStyles(clone);}finally{stage.remove();}
 const bounds=graphBounds(graph,diagram==='sequence');
 const serializer=new XMLSerializer();
 const inner=Array.from(clone.childNodes).map(node=>serializer.serializeToString(node)).join('');
 return {source:svgDocument({inner,bounds,background}),bounds};
}

async function rasterize(source:string,bounds:Bounds,type:'image/png'|'image/jpeg'):Promise<Blob>{
 const {width,height}=boundsSize(bounds);
 const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();
  image.width=width;image.height=height;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('圖片轉檔失敗，請改用 SVG 匯出'));image.src=url;});
  const canvas=document.createElement('canvas');
  canvas.width=width*RASTER_SCALE;canvas.height=height*RASTER_SCALE;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('無法建立繪圖環境，請改用 SVG 匯出');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,.92));
  if(!blob)throw new Error('圖片轉檔失敗，請改用 SVG 匯出');
  return blob;
 }finally{URL.revokeObjectURL(url);}
}

export async function canvasBlob(svg:SVGSVGElement,graph:Graph,diagram:DiagramType,format:ExportFormat):Promise<Blob>{
 const {source,bounds}=canvasSvg(svg,graph,diagram,format==='jpg'?JPEG_BACKGROUND:'');
 if(format==='svg')return new Blob([source],{type:'image/svg+xml;charset=utf-8'});
 return rasterize(source,bounds,format==='png'?'image/png':'image/jpeg');
}
