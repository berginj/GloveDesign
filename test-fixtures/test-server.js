/**
 * Simple HTTP server to host test fixtures for integration testing
 * Usage: node test-fixtures/test-server.js [port]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;
const ROOT_DIR = path.join(__dirname, 'simple-team-site');

const MIME_TYPES = {
  '.html': 'text/html',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT_DIR, req.url === '/' ? 'index.html' : req.url);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${ROOT_DIR}`);
  console.log(`\nTest URLs:`);
  console.log(`  - Homepage: http://localhost:${PORT}/`);
  console.log(`  - Logo: http://localhost:${PORT}/logo.svg`);
  console.log(`  - Robots: http://localhost:${PORT}/robots.txt`);
  console.log(`\nPress Ctrl+C to stop`);
});
