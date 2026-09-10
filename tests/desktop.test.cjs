const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveAsset } = require('../desktop/protocol.cjs');
const root = path.resolve('desktop-app/renderer');
assert.equal(resolveAsset('modelgraph://app/', root), path.join(root,'index.html'));
assert.equal(resolveAsset('modelgraph://app/assets/index-123.js',root),path.join(root,'assets/index-123.js'));
for(const url of ['file:///etc/passwd','https://app/index.html','modelgraph://evil/index.html','modelgraph://app/%2e%2e/main.cjs','modelgraph://app/assets/%2e%2e%2fmain.cjs','modelgraph://app/assets/a%5cb.js','modelgraph://app/main.cjs','modelgraph://user@app/index.html','modelgraph://app/%ZZ'])assert.equal(resolveAsset(url,root),null,url);
console.log('Desktop protocol checks passed.');
