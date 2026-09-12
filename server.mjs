import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const documents = path.resolve('documents');

// Safe arithmetic evaluator: supports numbers, parentheses, and + - * / only.
// Replaces eval() to prevent remote code execution via arbitrary JavaScript input.
function safeEvalArithmetic(expr) {
  let pos = 0;

  function skipWhitespace() {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  }

  function parseExpression() {
    let value = parseTerm();
    skipWhitespace();
    while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
      const op = expr[pos++];
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
      skipWhitespace();
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    skipWhitespace();
    while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
      const op = expr[pos++];
      const right = parseFactor();
      value = op === '*' ? value * right : value / right;
      skipWhitespace();
    }
    return value;
  }

  function parseFactor() {
    skipWhitespace();
    if (expr[pos] === '(') {
      pos++;
      const value = parseExpression();
      skipWhitespace();
      if (expr[pos] !== ')') throw new Error('Expected closing parenthesis');
      pos++;
      return value;
    }
    if (expr[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (expr[pos] === '+') {
      pos++;
      return parseFactor();
    }
    const start = pos;
    while (pos < expr.length && /[\d.]/.test(expr[pos])) pos++;
    if (start === pos) throw new Error('Expected number');
    const num = parseFloat(expr.slice(start, pos));
    if (isNaN(num)) throw new Error('Invalid number');
    return num;
  }

  const result = parseExpression();
  skipWhitespace();
  if (pos < expr.length) throw new Error('Unexpected trailing characters');
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/calculate') {
      const expression = url.searchParams.get('expression') || '0';
      // SECURITY: use a safe arithmetic parser instead of eval() to prevent RCE.
      try {
        const result = safeEvalArithmetic(expression);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ result }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid expression' }));
      }
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
