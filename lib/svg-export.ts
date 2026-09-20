import {sequenceHeaderY,type Graph} from './graph';
import type {DiagramType} from './diagram-types';

export type Bounds={minX:number;minY:number;maxX:number;maxY:number};
export type ExportFormat='svg'|'png'|'jpg';
export const RASTER_SCALE=2;
export const JPEG_BACKGROUND='#ffffff';

/** The box zoom-to-fit has always used; export and fit() must not drift apart. */
export function graphBounds(graph:Graph,sequence:boolean):Bounds{
 if(!graph.nodes.length)return {minX:0,minY:0,maxX:960,maxY:600};
 const xs=graph.nodes.map(n=>n.x),ys=graph.nodes.map(n=>n.y);
 return {minX:Math.min(...xs)-60,minY:Math.min(...ys)-100,maxX:Math.max(...xs)+300,maxY:sequence?sequenceHeaderY(graph)+330+graph.edges.length*66:Math.max(...ys)+210};
}
export function boundsSize(bounds:Bounds):{width:number;height:number}{
 return {width:Math.max(1,Math.round(bounds.maxX-bounds.minX)),height:Math.max(1,Math.round(bounds.maxY-bounds.minY))};
}
export function exportFileName(diagram:DiagramType,level:string,ext:ExportFormat|'json'):string{
 return `model-graph-${(diagram==='c4'?level:diagram).toLowerCase()}.${ext}`;
}
/** Standalone SVG document. `background` paints a full-bleed rect; JPEG needs it or transparency turns black. */
export function svgDocument({inner,bounds,background=''}:{inner:string;bounds:Bounds;background?:string}):string{
 const {width,height}=boundsSize(bounds);
 const rect=background?`<rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="${background}"/>`:'';
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}">${rect}${inner}</svg>\n`;
}
