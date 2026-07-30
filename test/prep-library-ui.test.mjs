import assert from 'node:assert/strict';
import { pagePrepLines, searchPrepLines } from '../assets/js/prep-library.js';

const results = searchPrepLines({ modules: [{ lines: [{ sourceLine: 7, text: 'Ada Lovelace wrote notes' }] }] }, 'lovelace');
assert.equal(results[0].sourceLine, 7);

const page = pagePrepLines(Array.from({ length: 601 }, (_, sourceLine) => ({ sourceLine })), 3, 250);
assert.deepEqual([page.items.length, page.page, page.pages, page.items[0].sourceLine], [101, 3, 3, 500]);
