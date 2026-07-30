import assert from 'node:assert/strict';
import test from 'node:test';

const origin = 'http://127.0.0.1:8091';

async function getJson(path) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response.json();
}

test('served site exposes each of the fifteen module files', async () => {
  const manifest = await getJson('/data/modules/index.json');
  assert.equal(manifest.modules.length, 15);
  await Promise.all(manifest.modules.map((module) => getJson('/data/modules/' + module.file)));
});
