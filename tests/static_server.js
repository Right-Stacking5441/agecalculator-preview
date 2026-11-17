/* Tiny static server for Playwright tests. Serves docs/ with directory
   indexes, a 301 from /slug to /slug/, and the custom 404.html. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function startServer(docs) {
  docs = docs || DOCS;
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const wantsSlash = urlPath.endsWith('/');
      if (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
      const raw = path.normalize(path.join(docs, urlPath.replace(/^\//, '')));
      if (!raw.startsWith(docs)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      let file = raw;
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (urlPath !== '/' && !wantsSlash && urlPath !== '') {
          res.writeHead(301, { Location: urlPath + '/' });
          res.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      const custom = path.join(docs, '404.html');
      if (fs.existsSync(custom)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(custom).pipe(res);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: 'http://127.0.0.1:' + port, close() { server.close(); } });
    });
    server.on('error', reject);
  });
}

module.exports = { startServer, DOCS, MIME };
