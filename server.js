const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

http.createServer((req, res) => {
  if (req.url === '/dev') {
    res.writeHead(302, { 'Location': '/world_builder.html?dev=1' });
    res.end();
    return;
  }
  
  // Existing static file server logic...
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT);

console.log(`Server running at http://127.0.0.1:${PORT}/`);
