import assert from 'node:assert/strict';
import test from 'node:test';

import { getModuleManifest, getModule } from '../assets/js/tcs-data.js';
import {
  QUIZ_MODE_DEFAULTS,
  buildPaper,
  normaliseQuizConfig,
  quizTopicChoices,
  scorePaper
} from '../assets/js/tcs-quiz.js';

const questionBank = [
  ...Array.from({ length: 24 }, (_, index) => ({
    id: `q-${index + 1}`,
    module: index < 12 ? 'module-01' : 'module-02',
    topicId: index % 2 ? 'topic-b' : 'topic-a',
    difficulty: (index % 3) + 1,
    answer: index % 4,
    q: `Question ${index + 1}`,
    options: ['A', 'B', 'C', 'D'],
    explanation: `Explanation ${index + 1}`
  })),
  { id: 'q-1', module: 'module-02', topicId: 'topic-z', difficulty: 3, answer: 1, q: 'Duplicate', options: ['A', 'B', 'C', 'D'], explanation: 'Duplicate' }
];

test('mixed mock has no duplicate questions and honors the requested count', () => {
  const paper = buildPaper(questionBank, { mode: 'mock', count: 20 }, 7);
  assert.equal(paper.length, 20);
  assert.equal(new Set(paper.map((question) => question.id)).size, 20);
});

test('mixed mock clears a stale module choice and draws from the roadmap', () => {
  const paper = buildPaper(questionBank, { mode: 'mock', moduleId: 'module-01', count: 20 }, 7);
  assert.equal(paper.length, 20);
  assert.ok(paper.some((question) => question.module === 'module-02'));
});

test('module paper excludes questions outside the selected module', () => {
  const paper = buildPaper(questionBank, { mode: 'module', moduleId: 'module-02', count: 8 }, 7);
  assert.equal(paper.length, 8);
  assert.ok(paper.every((question) => question.module === 'module-02'));
});

test('rapid paper ignores removed topic filters and respects difficulty', () => {
  const paper = buildPaper(questionBank, { mode: 'rapid', topicId: 'topic-a', difficulty: 2, count: 4 }, 7);
  assert.equal(paper.length, 4);
  assert.ok(paper.every((question) => question.difficulty === 2));
  assert.ok(paper.some((question) => question.topicId !== 'topic-a'));
});

test('deep module set honors the requested count from one coherent module', () => {
  const config = normaliseQuizConfig({ mode: 'deep', count: 30, topicId: 'topic-a', difficulty: 3 });
  const paper = buildPaper(questionBank, config, 7);
  const directPaper = buildPaper(questionBank, { mode: 'deep', count: 30 }, 7);
  assert.equal(config.count, 5);
  assert.equal(config.topicId, '');
  assert.equal(config.difficulty, 0);
  assert.equal(paper.length, 5);
  assert.equal(directPaper.length, 5);
  assert.equal(new Set(paper.map((question) => question.module)).size, 1);
});

test('deep module mode declares its fixed controls', () => {
  assert.equal(QUIZ_MODE_DEFAULTS.deep.countSelectable, false);
  assert.equal(QUIZ_MODE_DEFAULTS.deep.difficultySelectable, false);
});

test('deep module set builds five questions from one real TCS module', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((module) => getModule(module.id)));
  const paper = buildPaper(modules.flatMap((module) => module.questions), { mode: 'deep', count: 5 }, 7);
  assert.equal(paper.length, 5);
  assert.equal(new Set(paper.map((question) => question.module)).size, 1);
});

test('quiz modes expose Deep Module Set terminology without a passage mode', () => {
  assert.deepEqual(Object.keys(QUIZ_MODE_DEFAULTS), ['rapid', 'module', 'mock', 'deep']);
});

test('selecting a module clears a topic from a different module', () => {
  const topics = [
    { id: 'topic-a', moduleId: 'module-01' },
    { id: 'topic-z', moduleId: 'module-02' }
  ];
  const config = normaliseQuizConfig({
    mode: 'module',
    moduleId: 'module-02',
    topicId: 'topic-a'
  }, topics);
  assert.equal(config.topicId, '');
  assert.deepEqual(quizTopicChoices(topics, config), []);
});

test('normalisation clears stale module and difficulty filters', () => {
  const topics = [{ id: 'topic-a', moduleId: 'module-01' }];
  const config = normaliseQuizConfig({
    mode: 'module',
    moduleId: 'missing-module',
    difficulty: 99
  }, topics, questionBank);
  assert.equal(config.moduleId, '');
  assert.equal(config.difficulty, 0);
});

test('timed module configuration always has a positive deadline', () => {
  const config = normaliseQuizConfig({ mode: 'module', timeLimit: 0 });
  assert.equal(config.mode, 'module');
  assert.ok(config.timeLimit > 0);
});

test('normalisation adapts requested count to the selected module and difficulty pool', () => {
  const config = normaliseQuizConfig({
    mode: 'module',
    moduleId: 'module-01',
    difficulty: 3,
    count: 30
  }, [], questionBank);
  assert.equal(config.count, 4);
  assert.equal(buildPaper(questionBank, config, 7).length, 4);
});

test('every quiz configuration exposed by the real corpus can build a paper', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((module) => getModule(module.id)));
  const questions = modules.flatMap((module) => module.questions);
  const topics = modules.flatMap((module) => module.topics.map((topic) => ({ ...topic, moduleId: module.id })));
  const counts = [5, 10, 15, 20, 30];

  for (const mode of ['rapid', 'module', 'mock', 'deep']) {
    const moduleIds = mode === 'mock' ? [''] : ['', ...modules.map((module) => module.id)];
    const difficulties = mode === 'deep' ? [0] : [0, 1, 2, 3];
    for (const moduleId of moduleIds) {
      if (mode === 'module' && !moduleId) continue;
      for (const difficulty of difficulties) {
        for (const count of mode === 'deep' ? [5] : counts) {
          const config = normaliseQuizConfig({ mode, moduleId, difficulty, count }, topics, questions);
          assert.doesNotThrow(
            () => buildPaper(questions, config, 7),
            `${mode}/${moduleId || 'all'}/difficulty-${difficulty}/count-${count}`
          );
        }
      }
    }
  }
});

test('score records only incorrect answered questions as misses', () => {
  const samplePaper = [
    { id: 'a', answer: 1 },
    { id: 'b', answer: 2 },
    { id: 'c', answer: 3 }
  ];
  const result = scorePaper(samplePaper, { a: 1, b: 0 });
  assert.deepEqual(result, {
    correct: 1,
    incorrect: 1,
    unanswered: 1,
    percentage: 33,
    misses: ['b']
  });
});
