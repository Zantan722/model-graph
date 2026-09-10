import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mkdirSync(`${root}/desktop-app`, { recursive: true });
for (const name of ['main.cjs', 'protocol.cjs', 'preload.cjs', 'ai.cjs', 'ai-ipc.cjs', 'stories.cjs', 'repo-analysis.cjs', 'report-store.cjs']) copyFileSync(`${root}/desktop/${name}`, `${root}/desktop-app/${name}`);
writeFileSync(`${root}/desktop-app/package.json`, JSON.stringify({
  name: 'model-graph', version: pkg.version, productName: 'Model Graph',
  description: 'Offline software diagram editor with PlantUML input and output',
  main: 'main.cjs', author: 'Model Graph', private: true,
}, null, 2));
await build({entryPoints:[`${root}/lib/puml.ts`],bundle:true,platform:'node',format:'cjs',outfile:`${root}/desktop-app/diagram-parser.cjs`});
console.log('Desktop app prepared (bundled renderer, no web server or runtime dependencies).');
