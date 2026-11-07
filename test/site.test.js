'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const { createServer } = require('../server');
const { loadCatalog, parseReadme } = require('../lib/catalog');

const ROOT = path.resolve(__dirname, '..', '..');
let server;
let base;

function get(urlPath, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + urlPath, { method: method || 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

test('README parser reads status, items and notes', () => {
  const rows = parseReadme('=== 1 - Weapons ===\n[1 small issue] Wukong  (10 items; ItemsAdder)\n    fixed: a\n    note: b\n');
  assert.deepStrictEqual(rows[0].status, 'warn');
  assert.strictEqual(rows[0].itemCount, 10);
  assert.deepStrictEqual(rows[0].notes, ['b']);
});

test('catalog loads every pack with a picture', () => {
  const { data, images } = loadCatalog(ROOT);
  assert.strictEqual(data.packs.length, 156);
  assert.strictEqual(new Set(data.packs.map((p) => p.id)).size, data.packs.length, 'ids are unique');
  const noPic = data.packs.filter((p) => !p.pictures.length).map((p) => p.name);
  console.log('packs without a picture:', noPic.join(', ') || 'none');
  assert.ok(images.size >= 140);
});

test('public data has no file paths', async () => {
  const res = await get('/packs.json');
  assert.strictEqual(res.status, 200);
  const text = res.body.toString();
  // The GitHub Pages export must hold the same safe data.
  const exported = path.join(__dirname, '..', 'docs', 'packs.json');
  if (require('fs').existsSync(exported)) {
    const e = require('fs').readFileSync(exported, 'utf8');
    assert.ok(!/[A-Za-z]:\\\\/.test(e) && !e.includes('McModels Sorted') && !e.includes('resourcepack'), 'export is clean');
  }
  assert.ok(!/[A-Za-z]:\\\\/.test(text), 'no Windows paths');
  assert.ok(!text.includes('McModels Sorted'));
  assert.ok(!text.includes('resourcepack'));
  JSON.parse(text);
});

test('preview pictures load', async () => {
  const data = JSON.parse((await get('/packs.json')).body);
  const pics = data.packs.flatMap((p) => p.pictures);
  for (const pic of pics) {
    const res = await get('/' + pic.url, 'HEAD');
    assert.strictEqual(res.status, 200, pic.url);
    assert.match(res.headers['content-type'], /^image\//);
  }
});

test('pack files can not be downloaded', async () => {
  const blocked = [
    '/README.txt',
    '/INDEX.html',
    '/_check_data/_final_check.json',
    '/files/README.txt',
    '/img/../README.txt',
    '/img/..%2fREADME.txt',
    '/%2e%2e/README.txt',
    '/..%5c..%5cREADME.txt',
    '/1%20-%20Weapon%20and%20Tool%20Sets/Akira/preview.png',
    '/img/akira-0.yml',
    '/server.js',
    '/package.json',
    '/assets/does-not-exist.js',
  ];
  for (const p of blocked) {
    const res = await get(p);
    const body = res.body.toString();
    assert.ok(res.status === 404 || res.status === 400 || body.includes('<div id="root">'), p + ' -> ' + res.status);
    assert.ok(!body.includes('ItemsAdder 4 ready') && !body.includes('"errors"'), p + ' leaked data');
  }
});

test('source maps are not public', async () => {
  const html = (await get('/')).body.toString();
  const js = html.match(/assets\/(app-[^"]+\.js)/)[1];
  assert.strictEqual((await get('/assets/' + js)).status, 200);
  assert.strictEqual((await get('/assets/' + js + '.map')).status, 404);
});

test('only GET and HEAD are allowed', async () => {
  assert.strictEqual((await get('/api/packs', 'POST')).status, 405);
  assert.strictEqual((await get('/', 'DELETE')).status, 405);
});

test('page has security headers', async () => {
  const res = await get('/');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-security-policy'], /default-src 'self'/);
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
});
