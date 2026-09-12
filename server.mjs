import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const documents = path.resolve('documents');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/calculate') {
      const expression = url.searchParams.get('expression') || '0';
      const result = eval(expression);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ result }));
      return;
    }
    if (url.pathname === '/files') {
      const name = url.searchParams.get('name') || 'welcome.txt';
      const content = await readFile(path.join(documents, name));
      res.setHeader('Content-Type', 'text/plain');
      res.end(content);
      return;
    }
    res.writeHead(404).end('Not found');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
});
server.listen(Number(process.env.PORT || 43219), '127.0.0.1');
