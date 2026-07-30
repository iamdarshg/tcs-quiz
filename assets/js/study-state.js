export const APP_NAMESPACE = 'tcsquiz';
export const STATE_VERSION = 1;
export const DAY = 24 * 60 * 60 * 1000;

export function emptyState() {
  return { read: {}, answers: {} };
}

function cloneState(state) {
  const source = state && typeof state === 'object' ? state : emptyState();
  return {
    read: { ...(source.read || {}) },
    answers: { ...(source.answers || {}) }
  };
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validId(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Study item id is required');
  return id;
}

export function markRead(state, id, now = Date.now()) {
  const next = cloneState(state);
  next.read[validId(id)] = Number(now);
  return next;
}

export function recordAnswer(state, questionId, correct, now = Date.now()) {
  const next = cloneState(state);
  const id = validId(questionId);
  const prior = next.answers[id] || {};
  next.answers[id] = {
    correct: Boolean(correct),
    attempts: Number(prior.attempts || 0) + 1,
    answeredAt: Number(now),
    dueAt: Boolean(correct) ? Number(now) + 3 * DAY : Number(now)
  };
  return next;
}

export function nextReviewItems(items, state, now = Date.now()) {
  const current = cloneState(state);
  const at = Number(now);
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const answer = current.answers[item?.id];
      const readAt = current.read[item?.id];
      if (answer && answer.dueAt <= at) {
        return { item, index, kind: answer.correct ? 'answered' : 'missed', dueAt: answer.dueAt, priority: answer.correct ? 1 : 0 };
      }
      if (readAt && at - readAt >= DAY) {
        return { item, index, kind: 'read', dueAt: readAt + DAY, priority: 2 };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority || a.dueAt - b.dueAt || a.index - b.index)
    .map(({ item, kind }) => ({ ...item, reviewKind: kind }));
}

export function exportState(state, exportedAt = Date.now()) {
  return {
    app: APP_NAMESPACE,
    version: STATE_VERSION,
    exportedAt: new Date(Number(exportedAt)).toISOString(),
    state: cloneState(state)
  };
}

export function restoreState(json) {
  let payload = json;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { throw new Error('Backup is not valid JSON'); }
  }
  if (!payload || typeof payload !== 'object') throw new Error('Backup must be an object');
  if (payload.app !== APP_NAMESPACE) throw new Error('This backup belongs to a different app');
  if (payload.version !== STATE_VERSION) throw new Error('This backup version is not supported');
  if (!isPlainObject(payload.state)) throw new Error('Backup has no study state');
  if (!isPlainObject(payload.state.read) || !isPlainObject(payload.state.answers)) {
    throw new Error('Backup study state maps must be plain objects');
  }
  for (const [id, timestamp] of Object.entries(payload.state.read)) {
    validId(id);
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) throw new Error('Backup contains an invalid read timestamp');
  }
  for (const [id, answer] of Object.entries(payload.state.answers)) {
    validId(id);
    if (!isPlainObject(answer)
      || typeof answer.correct !== 'boolean'
      || !Number.isInteger(answer.attempts) || answer.attempts < 1
      || typeof answer.answeredAt !== 'number' || !Number.isFinite(answer.answeredAt)
      || typeof answer.dueAt !== 'number' || !Number.isFinite(answer.dueAt)) {
      throw new Error('Backup contains an invalid answer record');
    }
  }
  const state = cloneState(payload.state);
  for (const [id, timestamp] of Object.entries(state.read)) {
    state.read[id] = timestamp;
  }
  for (const [id, answer] of Object.entries(state.answers)) {
    state.answers[id] = {
      correct: answer.correct,
      attempts: answer.attempts,
      answeredAt: answer.answeredAt,
      dueAt: answer.dueAt
    };
  }
  return state;
}

const KEY = `${APP_NAMESPACE}.study-state`;

export function loadStudyState() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? restoreState({ app: APP_NAMESPACE, version: STATE_VERSION, state: JSON.parse(saved) }) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveStudyState(state) {
  const next = restoreState(exportState(state));
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
