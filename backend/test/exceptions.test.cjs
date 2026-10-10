require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const path = require('node:path');
const { SafeExceptionFilter } = require('../dist/safe-exception.filter.js');

test('unexpected errors expose neither exception contents nor request data', () => {
  let result;
  const response = { headersSent: false, status(code) { this.code = code; return this; }, json(body) { result = { code: this.code, body }; } };
  const exception = Object.assign(new Error('SENSITIVE_TEST_CONTENT'), { body: 'SENSITIVE_TEST_CONTENT' });
  new SafeExceptionFilter().catch(exception, { switchToHttp: () => ({ getResponse: () => response }) });
  assert.equal(result.code, 500);
  assert(!JSON.stringify(result).includes('SENSITIVE_TEST_CONTENT'));
});

test('malformed JSON and oversized requests return bounded errors without logging their content', { timeout: 25000 }, async () => {
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, '../dist/main.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'test', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', FRONTEND_ORIGIN: 'http://localhost:3000', WEB_ROOT: path.join(__dirname, 'nonexistent-export') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try { ready = (await fetch(`${origin}/api/health`)).ok; } catch { /* The server may still be starting. */ }
      if (ready) break;
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, `API did not start. Startup output: ${output}`);
    assert.deepEqual(await (await fetch(`${origin}/api/contact/status`)).json(), { configured: false });
    const malformed = await fetch(`${origin}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"message":"PRIVATE_REQUEST_MARKER",broken' });
    assert.equal(malformed.status, 400);
    assert(!JSON.stringify(await malformed.json()).includes('PRIVATE_REQUEST_MARKER'));
    const oversized = await fetch(`${origin}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `PRIVATE_REQUEST_MARKER${'a'.repeat(20000)}` }) });
    assert.equal(oversized.status, 413);
    assert(!JSON.stringify(await oversized.json()).includes('PRIVATE_REQUEST_MARKER'));
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test contact', email: 'test@example.com', topic: 'Consulta inicial', message: 'PRIVATE_REQUEST_MARKER', website: '' }) };
    const valid = await fetch(`${origin}/api/contact`, request);
    assert.equal(valid.status, 503);
    assert.match(JSON.stringify(await valid.json()), /contacto directo/);
    for (let attempt = 0; attempt < 2; attempt++) assert.equal((await fetch(`${origin}/api/contact`, request)).status, 503);
    const limited = await fetch(`${origin}/api/contact`, request);
    assert.equal(limited.status, 429);
    assert(Number(limited.headers.get('retry-after')) > 0, 'Rate limit retry header was lost.');
    assert(!JSON.stringify(await limited.json()).includes('PRIVATE_REQUEST_MARKER'));
    assert(!output.includes('PRIVATE_REQUEST_MARKER'), 'Request content appeared in process logs.');
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
});
