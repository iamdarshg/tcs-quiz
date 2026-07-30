import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { getModule, getModuleManifest, validateModule, validateModuleManifest, validateTcsCorpus } from '../assets/js/tcs-data.js';

const execFileAsync = promisify(execFile);

async function getRawTcsCorpusFixture() {
  const manifest = JSON.parse(await readFile('data/modules/index.json', 'utf8'));
  const modules = await Promise.all(manifest.modules.map(async (meta) => JSON.parse(await readFile(join('data/modules', meta.file), 'utf8'))));
  let sequence = 0;
  for (const module of modules) {
    for (const topic of module.topics) {
      for (const connection of topic.map.connections) {
        connection.fact += ' The relationship is stated explicitly for this validator fixture.';
      }
    }
    for (const question of module.questions) {
      const topic = module.topics.find((item) => item.id === question.topicId);
      const marker = `fixture${String.fromCharCode(97 + Math.floor(sequence / 26))}${String.fromCharCode(97 + (sequence % 26))}`;
      question.q = `${question.q.replace(/_{3,}/g, topic.title)} ${marker}`;
      question.explanation += ` This fixture ending is deliberately unique to ${marker} alone.`;
      sequence += 1;
    }
  }
  return { manifest, modules };
}

test('module manifest contains the ordered fifteen-module roadmap', async () => {
  const manifest = await getModuleManifest();
  assert.equal(manifest.modules.length, 15);
  assert.deepEqual(manifest.modules.map((module) => module.order), Array.from({ length: 15 }, (_, index) => index + 1));
});

test('every module has drill-ready content', async () => {
  const manifest = await getModuleManifest();
  for (const meta of manifest.modules) {
    const module = await getModule(meta.id);
    assert.ok(module.topics.length >= 6);
    assert.ok(module.questions.length >= 10);
  }
});

test('fact cards provide distinct topic-specific links and every MCQ authors one domain for all four options', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id)));
  for (const module of modules) {
    for (const topic of module.topics) {
      assert.doesNotMatch(topic.hook, /high-yield anchor/i);
      assert.doesNotMatch(topic.explainer, /core concept in .*historical, technical, and practical context/i);
      assert.equal(topic.map.links.length, 2);
      assert.equal(new Set(topic.map.links.map((link) => link.url)).size, 2);
      assert.ok(topic.map.links.every((link) => link.label !== 'Technology context'));
    }
    for (const question of module.questions) {
      assert.ok(question.optionFamily?.trim(), `${question.id} must name its authored option family`);
      assert.deepEqual(
        question.optionDomains,
        Array(4).fill(question.optionFamily),
        `${question.id} must classify every option in the same authored domain`
      );
    }
  }
});

test('reviewer-listed cross-domain distractors are absent from their questions', async () => {
  const reviewed = [
    ['module-14', 'module-14-q-10', ['NASA SPHEREx', 'ISRO SpaDeX', 'ESA Euclid']],
    ['module-12', 'module-12-q-01', ['Training a language model', 'Selecting a Nobel laureate', 'Resolving a domain name']],
    ['module-13', 'module-13-q-08', ['LEED', 'Antibiotics', 'SQL tables alone']],
    ['module-06', 'module-06-q-01', ['Wind turbine']]
  ];

  for (const [moduleId, questionId, rejected] of reviewed) {
    const module = await getModule(moduleId);
    const question = module.questions.find((item) => item.id === questionId);
    assert.ok(question, `${questionId} must exist`);
    for (const option of rejected) {
      assert.ok(!question.options.includes(option), `${questionId} must not use cross-domain distractor "${option}"`);
    }
  }
});

test('loader rejects a requested module that is absent from the manifest', async () => {
  await assert.rejects(() => getModule('not-a-module'), /not found in module manifest/);
});

test('loader rejects malformed question answers, duplicate IDs, and invalid manifest orders', async () => {
  const manifest = {
    modules: Array.from({ length: 15 }, (_, index) => ({
      id: `module-${String(index + 1).padStart(2, '0')}`,
      order: index === 0 ? 2 : index + 1,
      file: 'module-01.json',
      label: 'Test'
    }))
  };
  const malformed = structuredClone(await getModule('module-01'));
  const previousTopicId = malformed.topics[1].id;
  malformed.topics[1].id = malformed.topics[0].id;
  assert.throws(() => validateModuleManifest(manifest), /orders must be exactly 1–15/);
  assert.throws(() => validateModule(malformed), /duplicate topic id/);
  malformed.topics[1].id = 'topic-2';
  for (const topic of malformed.topics) {
    for (const connection of topic.map.connections) {
      if (connection.topicId === previousTopicId) connection.topicId = 'topic-2';
    }
  }
  malformed.questions[0].topicId = 'topic-2';
  malformed.questions[0].answer = 4;
  assert.throws(() => validateModule(malformed), /out-of-range answer/);
});

test('corpus validation rejects duplicate module and question IDs plus missing corpus IDs', async () => {
  const manifest = structuredClone(await getModuleManifest());
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id).then(structuredClone)));
  manifest.modules[1].id = manifest.modules[0].id;
  assert.throws(() => validateModuleManifest(manifest), /duplicate module id/);

  const missingId = structuredClone(modules[0]);
  missingId.topics[0].id = '';
  assert.throws(() => validateModule(missingId), /missing topic id/);

  const duplicateQuestion = structuredClone(modules);
  duplicateQuestion[1].questions[0].id = duplicateQuestion[0].questions[0].id;
  const validManifest = await getModuleManifest();
  assert.throws(() => validateTcsCorpus(validManifest, duplicateQuestion), /duplicate TCS question id/);
});

test('corpus validator reports the fifteen-module drill totals', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['scripts/build-index.mjs', '--validate-tcs']);
  assert.match(stdout, /TCS corpus validated — 15 modules, 90 topics, 150 questions/);
});

test('all 150 MCQ prompts and explanations are unique and avoid repeated normalized openings', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id)));
  const questions = modules.flatMap((module) => module.questions);
  const promptOpeningCounts = new Map();
  const explanationOpeningCounts = new Map();
  for (const question of questions) {
    const topic = modules.flatMap((module) => module.topics).find((item) => item.id === question.topicId);
    const normaliseOpening = (text) => text
      .toLowerCase()
      .replaceAll(topic.title.toLowerCase(), '{topic}')
      .replace(/\b\d+\b/g, '#')
      .replace(/[^\p{L}\p{N}{}]+/gu, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');
    const promptOpening = normaliseOpening(question.q);
    const explanationOpening = normaliseOpening(question.explanation);
    promptOpeningCounts.set(promptOpening, (promptOpeningCounts.get(promptOpening) || 0) + 1);
    explanationOpeningCounts.set(explanationOpening, (explanationOpeningCounts.get(explanationOpening) || 0) + 1);
  }
  assert.equal(new Set(questions.map((question) => question.q)).size, 150);
  assert.equal(new Set(questions.map((question) => question.explanation)).size, 150);
  assert.ok(questions.every((question) => !question.q.startsWith('Which term is described by this fact:')));
  assert.ok(questions.every((question) => !/[a-z]_____|_____[a-z]/.test(question.q)), 'cloze blanks must replace whole terms');
  assert.ok(Math.max(...promptOpeningCounts.values()) <= 4, 'no normalized question opening should repeat materially');
  assert.ok(Math.max(...explanationOpeningCounts.values()) <= 4, 'no normalized explanation opening should repeat materially');
});

test('Module 14 is built from dated 2025 or 2026 current affairs', async () => {
  const module = await getModule('module-14');
  assert.ok(module.topics.every((topic) => /\b202[56]\b/.test(`${topic.hook} ${topic.explainer}`)));
  assert.ok(module.questions.every((question) => /\b202[56]\b/.test(`${question.q} ${question.explanation}`)));
});

test('corpus validator rejects repeated prompts and explanations', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id).then(structuredClone)));
  modules[1].questions[0].q = modules[0].questions[0].q;
  modules[1].questions[0].explanation = modules[0].questions[0].explanation;
  assert.throws(() => validateTcsCorpus(manifest, modules), /duplicate TCS question prompt/);
});

test('corpus validator rejects many unique prompts built from one generic shell', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id).then(structuredClone)));
  modules.flatMap((module) => module.questions).slice(0, 5).forEach((question, index) => {
    question.q = `Identify the roadmap fact from this generic clue number ${index}.`;
  });
  assert.throws(() => validateTcsCorpus(manifest, modules), /generic TCS question opening/);
});

test('corpus validator rejects many unique explanations built from one generic shell', async () => {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id).then(structuredClone)));
  modules.flatMap((module) => module.questions).slice(0, 5).forEach((question, index) => {
    question.explanation = `The correct answer follows from generic explanation detail ${index}.`;
  });
  assert.throws(() => validateTcsCorpus(manifest, modules), /generic TCS question explanation opening/);
});

test('module validator rejects a map note made by concatenating the two topic hooks', async () => {
  const module = JSON.parse(await readFile('data/modules/module-01.json', 'utf8'));
  const source = module.topics[0];
  const connection = source.map.connections[0];
  const target = module.topics.find((topic) => topic.id === connection.topicId);
  connection.fact = `${source.hook} ${target.hook}`;

  assert.throws(() => validateModule(module), /concatenated topic hooks/);
});

test('module validator rejects a map note that disclaims a factual relationship', async () => {
  const module = JSON.parse(await readFile('data/modules/module-15.json', 'utf8'));
  const source = module.topics.find((topic) => topic.id === 'module-15-suez-canal');
  const connection = source.map.connections[1];
  connection.fact = 'The Suez Canal opened in 1869 and the first modern Olympics followed in 1896; their shared century does not imply an institutional link.';

  assert.throws(() => validateModule(module), /disclaims a factual relationship/);
});

test('module validator rejects a distractor whose authored domain differs from the answer family', async () => {
  const module = JSON.parse(await readFile('data/modules/module-14.json', 'utf8'));
  const question = module.questions.find((item) => item.id === 'module-14-q-10');
  question.optionFamily = 'enterprise mainframe features';
  question.optionDomains = [
    'enterprise mainframe features',
    'space observatories',
    'space docking missions',
    'cosmology missions'
  ];

  assert.throws(() => validateModule(module), /cross-domain option/);
});

test('corpus validator rejects the old cloze shell even when it copies a true topic fact', async () => {
  const { manifest, modules } = await getRawTcsCorpusFixture();
  modules[0].questions[0].q = 'An _____ is a manual calculating frame used for arithmetic in several ancient civilizations.';

  assert.throws(() => validateTcsCorpus(manifest, modules), /cloze shell/);
});

test('corpus validator rejects duplicate normalized reverse-fact question structures', async () => {
  const { manifest, modules } = await getRawTcsCorpusFixture();
  const [first, second] = modules[0].questions;
  const firstTopic = modules[0].topics.find((topic) => topic.id === first.topicId);
  const secondTopic = modules[0].topics.find((topic) => topic.id === second.topicId);
  first.q = `Which invented account belongs to ${firstTopic.title}?`;
  second.q = `Which invented account belongs to ${secondTopic.title}?`;

  assert.throws(() => validateTcsCorpus(manifest, modules), /duplicate normalized TCS question structure/);
});

test('corpus validator rejects repeated explanation boilerplate suffixes', async () => {
  const { manifest, modules } = await getRawTcsCorpusFixture();
  const [first, second] = modules[0].questions;
  first.explanation = 'The abacus predates electronic computers. Remember this tested link rather than a lookalike.';
  second.explanation = 'Lovelace wrote about Babbage’s engine. Remember this tested link rather than a lookalike.';

  assert.throws(() => validateTcsCorpus(manifest, modules), /duplicate TCS question explanation suffix/);
});

test('build validator fails the process for malformed TCS corpus data', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'tcs-corpus-'));
  try {
    await cp('data/modules', fixtureDir, { recursive: true });
    const firstModule = JSON.parse(await readFile(join(fixtureDir, 'module-01.json'), 'utf8'));
    const moduleFile = join(fixtureDir, 'module-02.json');
    const module = JSON.parse(await readFile(moduleFile, 'utf8'));
    module.questions[0].id = firstModule.questions[0].id;
    await writeFile(moduleFile, JSON.stringify(module));
    await assert.rejects(
      () => execFileAsync(process.execPath, ['scripts/build-index.mjs', '--validate-tcs'], { env: { ...process.env, TCS_MODULES_DIR: fixtureDir } }),
      (error) => error.code === 1 && /duplicate TCS question id/.test(error.stdout)
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

for (const [name, corrupt, message] of [
  ['a missing module ID', async (dir) => {
    const manifestFile = join(dir, 'index.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    manifest.modules[0].id = '';
    await writeFile(manifestFile, JSON.stringify(manifest));
  }, 'missing module id'],
  ['a missing topic ID', async (dir) => {
    const moduleFile = join(dir, 'module-01.json');
    const module = JSON.parse(await readFile(moduleFile, 'utf8'));
    module.topics[0].id = '';
    await writeFile(moduleFile, JSON.stringify(module));
  }, 'missing topic id'],
  ['a missing question ID', async (dir) => {
    const moduleFile = join(dir, 'module-01.json');
    const module = JSON.parse(await readFile(moduleFile, 'utf8'));
    module.questions[0].id = '';
    await writeFile(moduleFile, JSON.stringify(module));
  }, 'missing question id']
]) {
  test(`build validator exits 1 for ${name}`, async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'tcs-corpus-'));
    try {
      await cp('data/modules', fixtureDir, { recursive: true });
      await corrupt(fixtureDir);
      await assert.rejects(
        () => execFileAsync(process.execPath, ['scripts/build-index.mjs', '--validate-tcs'], { env: { ...process.env, TCS_MODULES_DIR: fixtureDir } }),
        (error) => error.code === 1 && new RegExp(message).test(error.stdout)
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
}
