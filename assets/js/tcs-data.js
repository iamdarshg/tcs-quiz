// TCS Quiz module data is deliberately kept independent from the legacy CLAT
// manifest. Browser clients fetch JSON; Node tests read the same files directly.

const browser = typeof window !== 'undefined';
const cache = new Map();
let manifestPromise;

const requiredTopicFields = ['id', 'rank', 'title', 'hook', 'explainer', 'importance', 'category', 'tags', 'map'];
const requiredQuestionFields = ['id', 'module', 'topicId', 'difficulty', 'q', 'options', 'answer', 'explanation', 'optionFamily', 'optionDomains'];

function fail(message) {
  throw new Error(`Invalid TCS module data: ${message}`);
}

function unique(values, kind) {
  const seen = new Set();
  for (const value of values) {
    if (!value) fail(`missing ${kind} id`);
    if (seen.has(value)) fail(`duplicate ${kind} id ${value}`);
    seen.add(value);
  }
}

function hasFields(value, fields, kind) {
  for (const field of fields) if (value?.[field] === undefined || value[field] === null || value[field] === '') fail(`${kind} is missing ${field}`);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateModuleManifest(manifest) {
  if (!Array.isArray(manifest?.modules)) fail('manifest modules must be an array');
  if (manifest.modules.length !== 15) fail('manifest must contain exactly 15 modules');
  unique(manifest.modules.map((module) => module.id), 'module');
  const orders = manifest.modules.map((module) => module.order).sort((a, b) => a - b);
  if (!orders.every((order, index) => order === index + 1)) fail('manifest orders must be exactly 1–15');
  for (const module of manifest.modules) {
    if (!module.file || !module.label) fail(`module ${module.id} is missing file or label`);
  }
  return manifest;
}

export function validateModule(module) {
  hasFields(module, ['id', 'order', 'label', 'blurb', 'topics', 'questions'], 'module');
  if (!Array.isArray(module.topics) || module.topics.length < 6) fail(`${module.id} needs at least six topics`);
  if (!Array.isArray(module.questions) || module.questions.length < 10) fail(`${module.id} needs at least ten questions`);
  unique(module.topics.map((topic) => topic.id), 'topic');
  unique(module.questions.map((question) => question.id), 'question');
  const topicIds = new Set(module.topics.map((topic) => topic.id));
  for (const topic of module.topics) {
    hasFields(topic, requiredTopicFields, `topic ${topic.id || '(unknown)'}`);
    if (!Array.isArray(topic.tags)) fail(`topic ${topic.id} tags must be an array`);
    if (!Array.isArray(topic.map?.links) || topic.map.links.length < 2) fail(`topic ${topic.id} needs at least two map links`);
    for (const link of topic.map.links) {
      if (!link?.label || !/^https?:\/\//.test(link.url || '')) fail(`topic ${topic.id} has an invalid map link`);
    }
    if (!Array.isArray(topic.map.connections) || topic.map.connections.length < 2) fail(`topic ${topic.id} needs at least two factual map connections`);
    const connectedIds = new Set();
    for (const connection of topic.map.connections) {
      if (!topicIds.has(connection?.topicId) || connection.topicId === topic.id) fail(`topic ${topic.id} has an invalid map connection`);
      if (connectedIds.has(connection.topicId)) fail(`topic ${topic.id} repeats map connection ${connection.topicId}`);
      if (!connection.relationship?.trim() || !connection.fact?.trim()) fail(`topic ${topic.id} has a map connection without a relationship and fact`);
      const peer = module.topics.find((item) => item.id === connection.topicId);
      const note = normalizeText(connection.fact);
      const joinedHooks = [
        `${normalizeText(topic.hook)} ${normalizeText(peer.hook)}`,
        `${normalizeText(peer.hook)} ${normalizeText(topic.hook)}`
      ];
      if (joinedHooks.includes(note)) fail(`topic ${topic.id} has a map connection made from concatenated topic hooks`);
      if (/\b(?:does not imply|no (?:institutional|factual) (?:link|relationship)|without shared governance)\b/i.test(connection.fact)) {
        fail(`topic ${topic.id} has a map connection that disclaims a factual relationship`);
      }
      connectedIds.add(connection.topicId);
    }
  }
  for (const question of module.questions) {
    hasFields(question, requiredQuestionFields, `question ${question.id || '(unknown)'}`);
    if (question.module !== module.id) fail(`question ${question.id} belongs to ${question.module}, not ${module.id}`);
    if (!topicIds.has(question.topicId)) fail(`question ${question.id} references an unknown topic`);
    if (!Array.isArray(question.options) || question.options.length !== 4) fail(`question ${question.id} must have four options`);
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) fail(`question ${question.id} has an out-of-range answer index`);
    if (new Set(question.options.map(normalizeText)).size !== question.options.length) fail(`question ${question.id} repeats an option`);
    if (!Array.isArray(question.optionDomains) || question.optionDomains.length !== question.options.length) {
      fail(`question ${question.id} must classify all four option domains`);
    }
    if (question.optionDomains.some((domain) => normalizeText(domain) !== normalizeText(question.optionFamily))) {
      fail(`question ${question.id} has a cross-domain option`);
    }
  }
  return module;
}

export function validateTcsCorpus(manifest, modules) {
  validateModuleManifest(manifest);
  if (!Array.isArray(modules) || modules.length !== manifest.modules.length) fail('corpus does not include every manifest module');
  unique(modules.map((module) => module.id), 'loaded module');
  const topicIds = new Set();
  const questionIds = new Set();
  const prompts = new Set();
  const explanations = new Set();
  const promptStructures = new Map();
  const explanationSuffixes = new Map();
  const promptOpenings = new Map();
  const explanationOpenings = new Map();
  for (const module of modules) {
    validateModule(module);
    const meta = manifest.modules.find((entry) => entry.id === module.id);
    if (!meta || meta.order !== module.order) fail(`module ${module.id} does not match its manifest entry`);
    for (const topic of module.topics) {
      if (topicIds.has(topic.id)) fail(`duplicate TCS topic id ${topic.id}`);
      topicIds.add(topic.id);
    }
    for (const question of module.questions) {
      if (questionIds.has(question.id)) fail(`duplicate TCS question id ${question.id}`);
      questionIds.add(question.id);
      const prompt = question.q.trim();
      const explanation = question.explanation.trim();
      if (prompts.has(prompt)) fail(`duplicate TCS question prompt: ${prompt}`);
      if (explanations.has(explanation)) fail(`duplicate TCS question explanation: ${explanation}`);
      if (prompt.startsWith('Which term is described by this fact:')) fail(`generic TCS question prompt: ${question.id}`);
      const topic = module.topics.find((item) => item.id === question.topicId);
      if (/_{3,}/.test(prompt)) fail(`TCS question ${question.id} uses a cloze shell`);
      const structure = normalizeText(prompt)
        .replaceAll(normalizeText(topic.title), '{topic}')
        .replace(/\b\d+(?:\.\d+)?\b/g, '#')
        .replace(/[^\p{L}\p{N}{}#]+/gu, ' ')
        .trim();
      const explanationSuffix = normalizeText(explanation)
        .replace(/\b\d+(?:\.\d+)?\b/g, '#')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .split(/\s+/)
        .slice(-8)
        .join(' ');
      const normalizeOpening = (text) => text
        .toLowerCase()
        .replaceAll(topic.title.toLowerCase(), '{topic}')
        .replaceAll(module.label.toLowerCase(), '{module}')
        .replace(/\b\d+\b/g, '#')
        .replace(/[^\p{L}\p{N}{}]+/gu, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 6)
        .join(' ');
      const opening = normalizeOpening(prompt);
      const explanationOpening = normalizeOpening(explanation);
      promptOpenings.set(opening, (promptOpenings.get(opening) || 0) + 1);
      explanationOpenings.set(explanationOpening, (explanationOpenings.get(explanationOpening) || 0) + 1);
      promptStructures.set(structure, (promptStructures.get(structure) || 0) + 1);
      explanationSuffixes.set(explanationSuffix, (explanationSuffixes.get(explanationSuffix) || 0) + 1);
      prompts.add(prompt);
      explanations.add(explanation);
    }
    if (module.id === 'module-14') {
      for (const topic of module.topics) {
        if (!/\b202[56]\b/.test(`${topic.hook} ${topic.explainer}`)) fail(`module-14 topic ${topic.id} is not a dated current affair`);
      }
      for (const question of module.questions) {
        if (!/\b202[56]\b/.test(`${question.q} ${question.explanation}`)) fail(`module-14 question ${question.id} is not a dated current affair`);
      }
    }
  }
  for (const [opening, count] of promptOpenings) {
    if (count > 4) fail(`generic TCS question opening "${opening}" appears ${count} times`);
  }
  for (const [opening, count] of explanationOpenings) {
    if (count > 4) fail(`generic TCS question explanation opening "${opening}" appears ${count} times`);
  }
  for (const [structure, count] of promptStructures) {
    if (count > 1) fail(`duplicate normalized TCS question structure: ${structure}`);
  }
  for (const [suffix, count] of explanationSuffixes) {
    if (count > 1) fail(`duplicate TCS question explanation suffix: ${suffix}`);
  }
  return { modules, topics: topicIds.size, questions: questionIds.size };
}

async function readJson(file) {
  if (browser) {
    const response = await fetch(`./data/modules/${file}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`TCS module data missing: ${file}`);
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(new URL(`../../data/modules/${file}`, import.meta.url), 'utf8'));
}

export async function getModuleManifest() {
  if (!manifestPromise) manifestPromise = readJson('index.json').then(validateModuleManifest);
  return manifestPromise;
}

export async function getModule(id) {
  if (cache.has(id)) return cache.get(id);
  const manifest = await getModuleManifest();
  const meta = manifest.modules.find((module) => module.id === id);
  if (!meta) throw new Error(`TCS module ${id} not found in module manifest`);
  const module = readJson(meta.file).then(validateModule);
  cache.set(id, module);
  return module;
}

export function resetModuleDataCache() {
  cache.clear();
  manifestPromise = undefined;
}
