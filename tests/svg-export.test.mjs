import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle=async name=>{const r=await build({entryPoints:[new URL(`../lib/${name}.ts`,import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));};
const {graphBounds,boundsSize,exportFileName,svgDocument,RASTER_SCALE,JPEG_BACKGROUND}=await bundle('svg-export');
const {initialGraph,sequenceHeaderY}=await bundle('graph');
const {loadPanels,storePanels,allClosed,workspaceClass,ALL_OPEN,ALL_CLOSED}=await bundle('panels');

// graphBounds must reproduce the box fit() used before it was extracted, for every canvas.
const legacy=(g,sequence)=>({
 minX:Math.min(...g.nodes.map(n=>n.x))-60,
 minY:Math.min(...g.nodes.map(n=>n.y))-100,
 maxX:Math.max(...g.nodes.map(n=>n.x))+300,
 maxY:sequence?sequenceHeaderY(g)+330+g.edges.length*66:Math.max(...g.nodes.map(n=>n.y))+210,
});
for(const level of ['architecture','workflow','sequence','dataflow','lifecycle','Context','Container','Component','Code']){
 const g=initialGraph(level),sequence=level==='sequence';
 assert.deepEqual(graphBounds(g,sequence),legacy(g,sequence),`bounds drifted for ${level}`);
 const {width,height}=boundsSize(graphBounds(g,sequence));
 assert.ok(width>0&&height>0&&Number.isInteger(width)&&Number.isInteger(height));
}
// Sequence height follows the lifeline stack, not node y — messages extend well below the participants.
const seq=initialGraph('sequence');
assert.equal(graphBounds(seq,true).maxY,sequenceHeaderY(seq)+330+seq.edges.length*66);
assert.ok(graphBounds(seq,true).maxY>graphBounds(seq,false).maxY);
// An empty canvas must not produce Infinity bounds.
const empty=graphBounds({nodes:[],edges:[],notes:[]},false);
assert.ok(Object.values(empty).every(Number.isFinite));

assert.equal(exportFileName('architecture','Container','png'),'model-graph-architecture.png');
assert.equal(exportFileName('c4','Container','svg'),'model-graph-container.svg');
assert.equal(exportFileName('c4','Code','json'),'model-graph-code.json');
assert.equal(exportFileName('dataflow','Container','jpg'),'model-graph-dataflow.jpg');

const bounds={minX:-60,minY:-40,maxX:940,maxY:560};
const plain=svgDocument({inner:'<g/>',bounds});
assert.ok(plain.includes('xmlns="http://www.w3.org/2000/svg"'));
assert.ok(plain.includes('viewBox="-60 -40 1000 600"'));
assert.ok(plain.includes('width="1000"')&&plain.includes('height="600"'));
assert.ok(!plain.includes('<rect'),'SVG export must stay transparent');
const opaque=svgDocument({inner:'<g/>',bounds,background:JPEG_BACKGROUND});
assert.ok(opaque.includes(`<rect x="-60" y="-40" width="1000" height="600" fill="${JPEG_BACKGROUND}"/>`),'JPEG needs an opaque backdrop');
assert.ok(opaque.indexOf('<rect')<opaque.indexOf('<g/>'),'backdrop must paint behind the graph');
assert.equal(RASTER_SCALE,2);

// Panel preferences: corrupt or partial values must never hide the UI.
assert.deepEqual(loadPanels(null),ALL_OPEN);
assert.deepEqual(loadPanels('not json'),ALL_OPEN);
assert.deepEqual(loadPanels('[]'),ALL_OPEN);
assert.deepEqual(loadPanels('{"left":false}'),{top:true,left:false,right:true});
assert.deepEqual(loadPanels(JSON.stringify(ALL_CLOSED)),ALL_CLOSED);
assert.ok(allClosed(ALL_CLOSED)&&!allClosed(ALL_OPEN)&&!allClosed({top:false,left:true,right:false}));
assert.equal(workspaceClass(ALL_OPEN,false),'workspace');
assert.equal(workspaceClass(ALL_OPEN,true),'workspace show-report');
assert.equal(workspaceClass(ALL_CLOSED,false),'workspace no-left no-right');
assert.equal(workspaceClass({top:true,left:false,right:true},false),'workspace no-left');
// A storage that throws (quota/private mode) must not break the toggle.
storePanels({setItem(){throw new Error('quota');}},ALL_OPEN);
let written='';storePanels({setItem:(_k,v)=>{written=v;}},ALL_CLOSED);
assert.deepEqual(loadPanels(written),ALL_CLOSED);

console.log('SVG/PNG/JPG export bounds, filenames, document assembly and panel preferences passed.');
