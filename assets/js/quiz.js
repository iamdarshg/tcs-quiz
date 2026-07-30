import { getModuleManifest, getModule } from './tcs-data.js';
import { esc, store } from './ui.js';
import { buildPaper, normaliseQuizConfig, scorePaper } from './tcs-quiz.js';
import { loadStudyState, recordAnswer, saveStudyState } from './study-state.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const MODES = {
  rapid: { label: 'Rapid MCQ', description: 'A quick untimed recall drill.', count: 10, timeLimit: 0 },
  module: { label: 'Timed Module Test', description: 'A focused module paper against the clock.', count: 10, timeLimit: 15 },
  mock: { label: 'Mixed Mock', description: 'A mixed TCS Quiz paper across the roadmap.', count: 20, timeLimit: 30 },
  deep: { label: 'Deep Module Set', description: 'A connected five-question set from one module.', count: 5, timeLimit: 0 }
};

let cfg = normaliseQuizConfig(store.get('quizcfg', {}));
let run = null;
let clockTimer = null;

function routeModuleId() {
  try { return new URLSearchParams(location.hash.split('?')[1] || '').get('module') || ''; } catch { return ''; }
}

function saveConfig() { store.set('quizcfg', cfg); }

async function loadModules() {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id)));
  return { manifest, modules };
}

export async function viewQuizSetup(el) {
  const linkedModule = routeModuleId();
  const { manifest, modules } = await loadModules();
  if (linkedModule && manifest.modules.some((module) => module.id === linkedModule)) {
    cfg = normaliseQuizConfig({ ...cfg, mode: 'module', moduleId: linkedModule, timeLimit: cfg.timeLimit });
  }
  const topics = modules.flatMap((module) => module.topics.map((topic) => ({ ...topic, moduleId: module.id })));
  const questions = modules.flatMap((module) => module.questions);
  cfg = normaliseQuizConfig(cfg, topics, questions);
  const countChoices = () => {
    if (cfg.mode === 'deep') return [5];
    const maximum = normaliseQuizConfig({ ...cfg, count: Number.MAX_SAFE_INTEGER }, topics, questions).count;
    return [...new Set([cfg.count, ...[5, 10, 15, 20, 30].filter((count) => count <= maximum)])].sort((a, b) => a - b);
  };

  el.innerHTML = `
    <div class="page-head">
      <h1>TCS Quiz practice</h1>
      <p class="sub">Choose a focused drill, a timed module test, a mixed mock, or a deep module set.</p>
    </div>
    <div class="qsetup">
      <div>
        <div class="qgroup"><h4>Practice mode</h4><div class="pick" data-mode>
          ${Object.entries(MODES).map(([id, mode]) => `<button data-v="${id}" class="${cfg.mode === id ? 'on' : ''}"><b>${mode.label}</b><small>${mode.description}</small></button>`).join('')}
        </div></div>
        <div class="qgroup" data-count-group><h4>Questions</h4><div class="seg" data-count>
          ${countChoices().map((count) => `<button data-v="${count}" class="${cfg.count === count ? 'on' : ''}">${count}</button>`).join('')}
        </div></div>
        <div class="qgroup" data-module-group><h4>Module</h4><select class="field" data-module>
          <option value="">All roadmap modules</option>
          ${manifest.modules.map((module) => `<option value="${esc(module.id)}" ${cfg.moduleId === module.id ? 'selected' : ''}>${esc(`Module ${module.order}: ${module.label}`)}</option>`).join('')}
        </select></div>
        <div class="qgroup" data-difficulty-group><h4>Difficulty</h4><div class="seg" data-difficulty>
          ${[[0, 'Any'], [1, 'Easy'], [2, 'Moderate'], [3, 'Hard']].map(([value, label]) => `<button data-v="${value}" class="${cfg.difficulty === value ? 'on' : ''}">${label}</button>`).join('')}
        </div></div>
        <div class="qgroup" data-time-group><h4>Time limit</h4><div class="seg" data-time>
          ${[[0, 'Untimed'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [45, '45 min']].map(([value, label]) => `<button data-v="${value}" class="${cfg.timeLimit === value ? 'on' : ''}">${label}</button>`).join('')}
        </div></div>
      </div>
      <aside class="qsum"><h4>This paper</h4><dl>
        <dt>Mode</dt><dd data-summary-mode>${esc(MODES[cfg.mode].label)}</dd>
        <dt>Questions</dt><dd data-summary-count>${cfg.count}</dd>
        <dt>Time limit</dt><dd data-summary-time>${cfg.timeLimit ? `${cfg.timeLimit} min` : 'Untimed'}</dd>
      </dl><p data-summary-note style="font-size:13px;color:var(--muted);line-height:1.5"></p>
      <button class="btn primary lg" style="width:100%" data-start>Build paper</button></aside>
    </div>`;

  const $ = (selector) => el.querySelector(selector);
  function refresh() {
    cfg = normaliseQuizConfig(cfg, topics, questions);
    $('[data-count]').innerHTML = countChoices()
      .map((count) => `<button data-v="${count}" class="${cfg.count === count ? 'on' : ''}">${count}${count < 5 ? ' available' : ''}</button>`)
      .join('');
    saveConfig();
    $('[data-summary-mode]').textContent = MODES[cfg.mode].label;
    $('[data-summary-count]').textContent = cfg.count;
    $('[data-summary-time]').textContent = cfg.timeLimit ? `${cfg.timeLimit} min` : 'Untimed';
    $('[data-summary-note]').textContent = cfg.mode === 'deep'
      ? 'Deep Module Set keeps five questions from one module together and shows its study context before the questions.'
      : cfg.mode === 'module' && !cfg.moduleId
        ? 'Select a module for a focused paper.'
        : 'Answers are scored with explanations and saved to your revision queue.';
    $('[data-module-group]').style.display = cfg.mode === 'mock' ? 'none' : '';
    $('[data-count-group]').style.display = cfg.mode === 'deep' ? 'none' : '';
    $('[data-difficulty-group]').style.display = cfg.mode === 'deep' ? 'none' : '';
    $('[data-time-group]').style.display = cfg.mode === 'deep' ? 'none' : '';
    $('[data-time] button[data-v="0"]').hidden = cfg.mode === 'module';
    $('[data-start]').disabled = cfg.mode === 'module' && !cfg.moduleId;
  }
  $('[data-mode]').addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    const mode = button.dataset.v;
    cfg = normaliseQuizConfig({
      ...cfg,
      mode,
      moduleId: mode === 'mock' ? '' : cfg.moduleId,
      count: MODES[mode].count,
      timeLimit: MODES[mode].timeLimit
    }, topics, questions);
    $('[data-mode]').querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === button));
    $('[data-count]').querySelectorAll('button').forEach((item) => item.classList.toggle('on', Number(item.dataset.v) === cfg.count));
    $('[data-time]').querySelectorAll('button').forEach((item) => item.classList.toggle('on', Number(item.dataset.v) === cfg.timeLimit));
    refresh();
  });
  const segmented = (selector, key) => $(selector).addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    cfg = normaliseQuizConfig({ ...cfg, [key]: Number(button.dataset.v) }, topics, questions);
    $(selector).querySelectorAll('button').forEach((item) => item.classList.toggle('on', item === button));
    refresh();
  });
  segmented('[data-count]', 'count');
  segmented('[data-difficulty]', 'difficulty');
  segmented('[data-time]', 'timeLimit');
  $('[data-module]').addEventListener('change', (event) => { cfg = normaliseQuizConfig({ ...cfg, moduleId: event.target.value }, topics, questions); refresh(); });
  $('[data-start]').addEventListener('click', () => start(el));
  refresh();
}

async function start(el) {
  clearInterval(clockTimer);
  el.innerHTML = '<div class="page-head"><h1>Building your TCS Quiz paper…</h1></div><div class="skel" style="height:180px"></div>';
  const { modules } = await loadModules();
  const selected = cfg.mode === 'module' || cfg.moduleId ? modules.filter((module) => module.id === cfg.moduleId) : modules;
  const questions = selected.flatMap((module) => module.questions);
  const topicById = new Map(modules.flatMap((module) => module.topics.map((topic) => [topic.id, { ...topic, moduleLabel: module.label }])));
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  let paper;
  try {
    paper = buildPaper(questions, cfg, (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0);
  } catch (error) {
    el.innerHTML = `<div class="empty"><strong>That paper cannot be filled</strong><p>${esc(error.message || error)}</p><button class="btn sm" data-back>Adjust your quiz settings</button></div>`;
    el.querySelector('[data-back]').addEventListener('click', () => viewQuizSetup(el));
    return;
  }
  if (!paper.length) {
    el.innerHTML = '<div class="empty"><strong>No questions match these filters</strong><button class="btn sm" data-back>Adjust your quiz settings</button></div>';
    el.querySelector('[data-back]').addEventListener('click', () => viewQuizSetup(el));
    return;
  }
  run = { paper, topicById, moduleById, answers: {}, idx: 0, started: Date.now(), done: false, recorded: false, config: { ...cfg } };
  if (cfg.timeLimit) run.deadline = run.started + cfg.timeLimit * 60 * 1000;
  paint(el);
}

function remainingSeconds() {
  return run?.deadline ? Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000)) : null;
}

function elapsedSeconds() { return Math.max(0, Math.floor(((run?.ended || Date.now()) - run.started) / 1000)); }

function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }

function paint(el) {
  clearInterval(clockTimer);
  if (!run) return;
  if (run.done) return results(el);
  const question = run.paper[run.idx];
  const answered = Object.keys(run.answers).length;
  const context = run.topicById.get(question.topicId);
  const moduleContext = run.moduleById.get(question.module);
  el.innerHTML = `
    <div class="qbar"><span class="n">Question ${run.idx + 1} of ${run.paper.length}</span><div class="prog"><i style="width:${(answered / run.paper.length * 100).toFixed(1)}%"></i></div><span class="n">${answered}/${run.paper.length} answered</span><span class="clock" data-clock></span></div>
    ${run.config.mode === 'deep' && moduleContext ? `<article class="module-context"><h4>${esc(moduleContext.label)}</h4><p>${esc(moduleContext.blurb)} Current topic: ${esc(context?.title || '')}.</p></article>` : ''}
    <div class="qblock"><div class="qitem"><div class="qq"><b>${run.idx + 1}.</b><span>${esc(question.q)}</span></div><div class="opts" data-options>
      ${question.options.map((option, index) => `<button class="opt ${run.answers[question.id] === index ? 'on' : ''}" data-answer="${index}"><span class="lt">${LETTERS[index]}</span><span>${esc(option)}</span></button>`).join('')}
    </div></div></div>
    <div class="qnav"><button class="btn" data-prev ${run.idx === 0 ? 'disabled' : ''}>&larr; Previous</button><span class="sp"></span><button class="btn" data-quit>Abandon</button>${run.idx === run.paper.length - 1 ? '<button class="btn primary" data-submit>Submit paper</button>' : '<button class="btn primary" data-next>Next question &rarr;</button>'}</div>`;
  el.querySelector('[data-options]').addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    run.answers[question.id] = Number(button.dataset.answer);
    el.querySelectorAll('[data-options] .opt').forEach((item) => item.classList.toggle('on', item === button));
    const nextAnswered = Object.keys(run.answers).length;
    el.querySelector('.prog i').style.width = `${(nextAnswered / run.paper.length * 100).toFixed(1)}%`;
    el.querySelectorAll('.qbar .n')[1].textContent = `${nextAnswered}/${run.paper.length} answered`;
  });
  el.querySelector('[data-prev]')?.addEventListener('click', () => { run.idx -= 1; paint(el); });
  el.querySelector('[data-next]')?.addEventListener('click', () => { run.idx += 1; paint(el); });
  el.querySelector('[data-submit]')?.addEventListener('click', () => submit(el));
  el.querySelector('[data-quit]')?.addEventListener('click', () => { run = null; viewQuizSetup(el); });
  clock(el.querySelector('[data-clock]'));
}

function clock(node) {
  const tick = () => {
    if (!run || run.done) return clearInterval(clockTimer);
    const remaining = remainingSeconds();
    node.textContent = remaining === null ? formatTime(elapsedSeconds()) : formatTime(remaining);
    if (remaining === 0) submit(node.closest('#view') || node.parentElement.parentElement);
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function submit(el) {
  if (!run || run.done) return;
  run.done = true;
  run.ended = Date.now();
  paint(el);
}

function recordResults() {
  if (run.recorded) return;
  let state = loadStudyState();
  for (const question of run.paper) {
    if (Object.prototype.hasOwnProperty.call(run.answers, question.id)) {
      state = recordAnswer(state, question.id, run.answers[question.id] === question.answer);
    }
  }
  saveStudyState(state);
  run.recorded = true;
}

function results(el) {
  clearInterval(clockTimer);
  recordResults();
  const result = scorePaper(run.paper, run.answers);
  const seconds = elapsedSeconds();
  el.innerHTML = `
    <div class="score"><div class="big">${result.correct}</div><div class="of">of ${run.paper.length} correct · ${result.percentage}%</div><div class="line">${esc(MODES[run.config.mode].label)} complete · ${run.paper.length} questions. ${result.misses.length ? 'Your misses are saved for revision. Review the explanations before you retry.' : 'Every answered question was correct. Keep the recall fresh with another paper.'}</div></div>
    <div class="brk"><div><b>${result.correct}</b><span>Correct</span></div><div><b>${result.incorrect}</b><span>Incorrect</span></div><div><b>${result.unanswered}</b><span>Unanswered</span></div><div><b>${formatTime(seconds)}</b><span>Time taken</span></div></div>
    <h2 style="font-size:18px;margin:26px 0 6px">Answer review</h2><p style="color:var(--muted);font-size:13.5px;margin-bottom:18px">Read the explanation for every result; this is where a score becomes recall.</p>
    <div class="qblock">${run.paper.map((question, index) => {
      const got = run.answers[question.id];
      const status = got === undefined ? 'Not attempted.' : got === question.answer ? 'Correct.' : 'Incorrect.';
      return `<div class="qitem"><div class="qq"><b>${index + 1}.</b><span>${esc(question.q)}</span></div><div class="opts">${question.options.map((option, optionIndex) => `<div class="opt ${optionIndex === question.answer ? 'right' : got === optionIndex ? 'wrong' : ''}"><span class="lt">${LETTERS[optionIndex]}</span><span>${esc(option)}</span></div>`).join('')}</div><div class="expl"><b>${status}</b> ${esc(question.explanation || '')}</div></div>`;
    }).join('')}</div>
    <div class="qnav">${result.misses.length ? '<button class="btn primary" data-retry>Retry wrong answers</button>' : ''}<button class="btn" data-again>Another paper</button><button class="btn" data-config>Change settings</button></div>`;
  el.querySelector('[data-retry]')?.addEventListener('click', () => {
    run = { ...run, paper: run.paper.filter((question) => result.misses.includes(question.id)), answers: {}, idx: 0, started: Date.now(), ended: undefined, deadline: undefined, done: false, recorded: false };
    paint(el);
  });
  el.querySelector('[data-again]').addEventListener('click', () => start(el));
  el.querySelector('[data-config]').addEventListener('click', () => { run = null; viewQuizSetup(el); });
}

export function quizActive() { return Boolean(run && !run.done); }
