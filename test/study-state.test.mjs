import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyState,
  markRead,
  recordAnswer,
  nextReviewItems,
  exportState,
  restoreState
} from '../assets/js/study-state.js';

test('a wrong answer is queued for review before a read card', () => {
  const state = recordAnswer(emptyState(), 'q-1', false, 1000);
  const review = nextReviewItems([{ id: 'q-1' }], state, 2000);
  assert.deepEqual(review.map((item) => item.id), ['q-1']);
});

test('a card read yesterday becomes eligible for revision', () => {
  const state = markRead(emptyState(), 'topic-1', 1000);
  const review = nextReviewItems([{ id: 'topic-1' }], state, 1000 + 24 * 60 * 60 * 1000);
  assert.deepEqual(review.map((item) => item.id), ['topic-1']);
});

test('restore rejects a payload from another app namespace', () => {
  assert.throws(() => restoreState({ app: 'clatgk', version: 1, state: {} }));
});

test('backup round-trips the tracked state without sharing references', () => {
  const state = recordAnswer(markRead(emptyState(), 'topic-1', 1000), 'q-1', true, 2000);
  const restored = restoreState(exportState(state, 3000));
  assert.deepEqual(restored, state);
  assert.notEqual(restored, state);
});

for (const [name, state] of [
  ['an array read map', { read: [], answers: {} }],
  ['a scalar read map', { read: 42, answers: {} }],
  ['an array answer map', { read: {}, answers: [] }],
  ['a scalar answer map', { read: {}, answers: 'wrong' }],
  ['an array answer record', { read: {}, answers: { 'q-1': [] } }],
  ['a string timestamp', { read: { 'topic-1': '1000' }, answers: {} }],
  ['a fractional attempt count', {
    read: {},
    answers: { 'q-1': { correct: true, attempts: 1.5, answeredAt: 1000, dueAt: 2000 } }
  }]
]) {
  test(`restore rejects ${name} without mutating existing state`, () => {
    const existing = recordAnswer(markRead(emptyState(), 'topic-kept', 10), 'q-kept', false, 20);
    const snapshot = structuredClone(existing);
    assert.throws(() => restoreState({ app: 'tcsquiz', version: 1, state }));
    assert.deepEqual(existing, snapshot);
  });
}
