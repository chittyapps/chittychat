// Simple tracker server for @chittycorp/app-beacon
// Deploy this to collect beacon data

const http = require('http');
const fs = require('fs');

const apps = new Map();

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'POST' && req.url === '/track') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        apps.set(data.id, {
          ...data,
          last_seen: new Date().toISOString()
        });
        
        console.log(`📡 ${data.event || 'beacon'} from ${data.name} (${data.platform})`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
    return;
  }
  
  if (req.method === 'GET' && req.url === '/apps') {
    const appList = Array.from(apps.values());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(appList, null, 2));
    return;
  }
  
  // Simple dashboard
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>App Beacon Tracker</title>
          <style>
            body { font-family: system-ui; padding: 20px; }
            .app { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
            .claude { background: #e3f2fd; }
          </style>
        </head>
        <body>
          <h1>📡 App Beacon Tracker</h1>
          <div id="apps"></div>
          <script>
            setInterval(async () => {
              const res = await fetch('/apps');
              const apps = await res.json();
              document.getElementById('apps').innerHTML = apps.map(app => 
                '<div class="app ' + (app.has_claude_code ? 'claude' : '') + '">' +
                '<strong>' + app.name + '</strong> (' + app.platform + ')' +
                (app.has_claude_code ? ' 🤖 Claude Code' : '') +
                '<br>Last seen: ' + new Date(app.last_seen).toLocaleString() +
                '</div>'
              ).join('');
            }, 1000);
          </script>
        </body>
      </html>
    `);
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 App Beacon Tracker running on port ${PORT}`);
});
