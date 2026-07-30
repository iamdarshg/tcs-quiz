import assert from 'node:assert/strict';
import { searchPrepLines } from '../assets/js/prep-library.js';

const results = searchPrepLines({ modules: [{ lines: [{ sourceLine: 7, text: 'Ada Lovelace wrote notes' }] }] }, 'lovelace');
assert.equal(results[0].sourceLine, 7);
