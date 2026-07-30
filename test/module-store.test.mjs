import assert from 'node:assert/strict';
import test from 'node:test';

import { createModuleStore } from '../assets/js/module-store.js';

test('retry invalidates app and loader caches before fetching modules again', async () => {
  let attempts = 0;
  let loaderResets = 0;
  const store = createModuleStore({
    getManifest: async () => ({ modules: [{ id: 'module-01' }] }),
    getModule: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('transient module failure');
      return { id: 'module-01', topics: [], questions: [] };
    },
    resetData: () => { loaderResets += 1; }
  });

  await assert.rejects(() => store.getModules(), /transient module failure/);
  await assert.rejects(() => store.getModules(), /transient module failure/);
  assert.equal(attempts, 1);

  store.reset();
  const loaded = await store.getModules();
  assert.deepEqual(loaded.modules.map((module) => module.id), ['module-01']);
  assert.equal(attempts, 2);
  assert.equal(loaderResets, 1);
});
