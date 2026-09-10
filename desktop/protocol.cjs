const path = require('node:path');
// Only packaged renderer assets may be served by our local, secure origin.
function resolveAsset(requestUrl, root) {
  try {
    const url = new URL(requestUrl);
    if (url.protocol !== 'modelgraph:' || url.host !== 'app' || url.username || url.password) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) return null;
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    if (relative !== 'index.html' && !/^assets\/[a-zA-Z0-9_.-]+\.(?:js|css|woff2?|png|svg)$/.test(relative)) return null;
    const resolved = path.resolve(root, relative);
    return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
  } catch { return null; }
}
module.exports = { resolveAsset };
