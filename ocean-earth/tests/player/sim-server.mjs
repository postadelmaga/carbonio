// Server statico che imita la produzione: Cache-Control no-cache + ETag (304),
// latenza fissa e banda condivisa limitata (che Chrome non applica ai worker).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2], port = +(process.argv[3] || 8790), bw = +(process.argv[4] || 2) * 1e6, rtt = +(process.argv[5] || 50);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.svg': 'image/svg+xml' };
let next = Date.now();                       // secchiello unico: banda condivisa
const stats = { req: 0, r304: 0, bytes: 0 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
http.createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/__stats') { res.end(JSON.stringify(stats)); return; }
  if (u === '/__reset') { stats.req = stats.r304 = stats.bytes = 0; res.end('ok'); return; }
  let f = path.join(root, u.endsWith('/') ? u + 'index.html' : u);
  await sleep(rtt);
  fs.stat(f, async (err, st) => {
    if (err) { res.writeHead(404); res.end(); return; }
    stats.req++;
    const etag = `"${st.size.toString(36)}-${st.mtimeMs.toString(36)}"`;
    const h = { 'Cache-Control': 'no-cache', ETag: etag, 'Last-Modified': st.mtime.toUTCString(), 'Content-Type': types[path.extname(f)] || 'application/octet-stream' };
    if (req.headers['if-none-match'] === etag) { stats.r304++; res.writeHead(304, h); res.end(); return; }
    const buf = fs.readFileSync(f);
    stats.bytes += buf.length;
    const now = Date.now();
    next = Math.max(next, now) + (buf.length / bw) * 1000;
    await sleep(next - now);
    res.writeHead(200, { ...h, 'Content-Length': buf.length });
    res.end(buf);
  });
}).listen(port, () => console.log('pronto', port));
