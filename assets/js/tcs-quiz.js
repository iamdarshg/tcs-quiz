export const QUIZ_MODE_DEFAULTS = Object.freeze({
  rapid: Object.freeze({ count: 10, timeLimit: 0, countSelectable: true, difficultySelectable: true }),
  module: Object.freeze({ count: 10, timeLimit: 15, countSelectable: true, difficultySelectable: true }),
  mock: Object.freeze({ count: 20, timeLimit: 30, countSelectable: true, difficultySelectable: true }),
  deep: Object.freeze({ count: 5, timeLimit: 0, countSelectable: false, difficultySelectable: false })
});

const MODES = new Set(Object.keys(QUIZ_MODE_DEFAULTS));

function matchesFilters(question, config, mode) {
  return ((mode === 'mock' || !config.moduleId) || question.module === config.moduleId)
    && (!config.difficulty || Number(question.difficulty) === Number(config.difficulty));
}

function availableCount(questions, config, mode) {
  const candidates = uniqueQuestions(questions).filter((question) => matchesFilters(question, config, mode));
  if (mode !== 'deep') return candidates.length;
  const moduleCounts = new Map();
  for (const question of candidates) {
    moduleCounts.set(question.module, (moduleCounts.get(question.module) || 0) + 1);
  }
  return Math.max(0, ...moduleCounts.values());
}

export function normaliseQuizConfig(saved = {}, topics = [], questions = []) {
  const mode = MODES.has(saved?.mode) ? saved.mode : 'rapid';
  const defaults = QUIZ_MODE_DEFAULTS[mode];
  const requestedCount = Number(saved?.count);
  const requestedTimeLimit = Number(saved?.timeLimit);
  let moduleId = typeof saved?.moduleId === 'string' ? saved.moduleId : '';
  const knownModuleIds = new Set([
    ...(Array.isArray(topics) ? topics.map((topic) => topic.moduleId) : []),
    ...(Array.isArray(questions) ? questions.map((question) => question.module) : [])
  ].filter(Boolean));
  if (moduleId && knownModuleIds.size && !knownModuleIds.has(moduleId)) moduleId = '';
  const requestedDifficulty = Number(saved?.difficulty);
  const difficulty = defaults.difficultySelectable && [1, 2, 3].includes(requestedDifficulty)
    ? requestedDifficulty
    : 0;
  const config = {
    mode,
    count: mode === 'deep'
      ? defaults.count
      : Number.isInteger(requestedCount) && requestedCount > 0 ? requestedCount : defaults.count,
    moduleId,
    topicId: '',
    difficulty,
    timeLimit: mode === 'module'
      ? requestedTimeLimit > 0 ? requestedTimeLimit : defaults.timeLimit
      : requestedTimeLimit > 0 ? requestedTimeLimit : 0
  };
  if (Array.isArray(questions) && questions.length) {
    const available = availableCount(questions, config, mode);
    if (available > 0) config.count = Math.min(config.count, available);
  }
  return config;
}

export function quizTopicChoices() { return []; }

function seededRandom(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const paper = items.slice();
  for (let index = paper.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [paper[index], paper[swap]] = [paper[swap], paper[index]];
  }
  return paper;
}

function uniqueQuestions(questions) {
  const ids = new Set();
  return (Array.isArray(questions) ? questions : []).filter((question) => {
    if (!question?.id || ids.has(question.id)) return false;
    ids.add(question.id);
    return true;
  });
}

function requestedCount(config, available) {
  const count = Number(config?.count);
  return Number.isInteger(count) && count > 0 ? count : available;
}

/**
 * Builds a deterministic MCQ paper from the TCS module-question corpus.
 * Deep mode deliberately draws one module so a coherent study context can
 * be shown alongside a full five-question set in the browser UI.
 */
export function buildPaper(questions, config = {}, seed = Date.now()) {
  const mode = config.mode || 'rapid';
  if (!MODES.has(mode)) throw new Error(`Unknown quiz mode: ${mode}`);

  const candidates = uniqueQuestions(questions).filter((question) => matchesFilters(question, config, mode));
  const random = seededRandom(seed);
  const ordered = shuffled(candidates, random);
  const count = mode === 'deep' ? QUIZ_MODE_DEFAULTS.deep.count : requestedCount(config, ordered.length);
  let pool = ordered;
  if (mode === 'deep') {
    const byModule = new Map();
    for (const question of ordered) {
      const group = byModule.get(question.module) || [];
      group.push(question);
      byModule.set(question.module, group);
    }
    pool = [...byModule.values()].find((group) => group.length >= count) || [];
  }
  if (pool.length < count) {
    throw new Error(`Cannot build a ${count}-question ${mode} paper from the selected filters`);
  }
  return pool.slice(0, count);
}

export function scorePaper(paper, answers = {}) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const misses = [];

  for (const question of Array.isArray(paper) ? paper : []) {
    if (!Object.prototype.hasOwnProperty.call(answers, question.id) || answers[question.id] === undefined) {
      unanswered += 1;
    } else if (Number(answers[question.id]) === Number(question.answer)) {
      correct += 1;
    } else {
      incorrect += 1;
      misses.push(question.id);
    }
  }

  const total = correct + incorrect + unanswered;
  return {
    correct,
    incorrect,
    unanswered,
    percentage: total ? Math.round((correct / total) * 100) : 0,
    misses
  };
}
