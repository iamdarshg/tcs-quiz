import assert from 'node:assert/strict';
import test from 'node:test';

test('a module route loads through the app module store', async () => {
  const view = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '.filters') return { addEventListener() {} };
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const theme = { addEventListener() {} };
  const saved = new Map();

  globalThis.document = {
    getElementById(id) {
      return id === 'view' ? view : theme;
    },
    querySelectorAll() {
      return [];
    }
  };
  globalThis.location = { hash: '#/module/module-01' };
  globalThis.localStorage = {
    getItem(key) {
      return saved.get(key) ?? null;
    },
    setItem(key, value) {
      saved.set(key, value);
    }
  };
  globalThis.addEventListener = () => {};

  await import(`../assets/js/app.js?module-route-test=${Date.now()}`);
  for (let attempt = 0; attempt < 20 && view.innerHTML.includes('skel'); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.match(view.innerHTML, /Computing History and Foundations/);
  assert.doesNotMatch(view.innerHTML, /Something did not load/);
});
