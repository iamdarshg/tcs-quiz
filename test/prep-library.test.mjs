import assert from 'node:assert/strict';
import { buildPrepLibrary } from '../scripts/build-prep-library.mjs';

const library = buildPrepLibrary('1. Foundations\nA line\n\n2. Networks\nAnother line');
assert.deepEqual(library.modules.map(({ id, lines }) => [id, lines.map((line) => line.text)]), [
  ['01', ['1. Foundations', 'A line']],
  ['02', ['2. Networks', 'Another line']],
]);
