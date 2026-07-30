import { esc, highlight, meter, store } from './ui.js';
import { viewQuizSetup } from './quiz.js';
import { viewMyMap } from './mymap.js';
import { viewUltraMap } from './ultramap.js';
import { resolveTopicRoute } from './topic-route.js';
import { renderMap, wireMap } from './map.js';
import { topicWithTcsConnections } from './tcs-map.js';
import { moduleStore } from './module-store.js';
import {
  DAY, exportState, loadStudyState, markRead, nextReviewItems,
  restoreState, saveStudyState
} from './study-state.js';

const view = document.getElementById('view');
const clip = (text, n) => (text = String(text || ''), text.length > n ? text.slice(0, n - 1).trimEnd() + '…' : text);
const latest = (value) => Number(value || 0);

document.getElementById('theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
});

async function getModules() {
  return moduleStore.getModules();
}

function writeState(next) {
  return saveStudyState(next);
}

function progress(ids, state = loadStudyState(), label = true) {
  const done = ids.reduce((count, id) => count + (state.read[id] ? 1 : 0), 0);
  return `<div class="prog-wrap" style="--p:${(done / Math.max(1, ids.length) * 100).toFixed(1)}%">
    <div class="prog-track"><i></i></div>${label ? `<span class="prog-num">${done} of ${ids.length} read</span>` : ''}
  </div>`;
}

function moduleTile(module, state) {
  const ids = module.topics.map((topic) => topic.id);
  return `<a class="module-tile" href="#/module/${encodeURIComponent(module.id)}">
    <span class="module-order">Module ${module.order}</span>
    <b>${esc(module.label)}</b>
    <p>${esc(clip(module.blurb, 120))}</p>
    <span>${module.topics.length} facts · ${module.questions.length} MCQs</span>
    ${progress(ids, state, false)}
  </a>`;
}

function stat(label, value) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

function topicItems(modules) {
  return modules.flatMap((module) => module.topics.map((topic) => ({
    ...topic, moduleId: module.id, moduleLabel: module.label, itemType: 'fact'
  })));
}

function revisionItems(modules) {
  return modules.flatMap((module) => [
    ...module.topics.map((topic) => ({ ...topic, moduleId: module.id, moduleLabel: module.label, itemType: 'fact' })),
    ...module.questions.map((question) => ({
      ...question, title: question.q, hook: question.explanation, moduleId: module.id,
      moduleLabel: module.label, itemType: 'question'
    }))
  ]);
}

function weakCount(state) {
  return Object.values(state.answers).filter((answer) => !answer.correct).length;
}

const routes = [
  [/^\/?$/, viewHome],
  [/^\/modules\/?$/, viewModules],
  [/^\/module\/([^/]+)\/?$/, (match) => viewModule(decodeURIComponent(match[1]))],
  [/^\/topic\/([^/]+)\/?$/, (match) => viewTopic(decodeURIComponent(match[1]))],
  [/^\/revision\/?$/, viewRevision],
  [/^\/backup\/?$/, viewBackup],
  [/^\/search\/?$/, viewSearch],
  [/^\/ultramap\/?$/, () => viewUltraMap(view)],
  [/^\/mymap\/?$/, () => viewMyMap(view)],
  [/^\/quiz\/?$/, () => viewQuizSetup(view)]
];

async function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path] = raw.split('?');
  for (const link of document.querySelectorAll('.nav a')) {
    const href = link.getAttribute('href').slice(1);
    link.toggleAttribute('aria-current', href === '/' ? path === '/' : path.startsWith(href));
    if (link.hasAttribute('aria-current')) link.setAttribute('aria-current', 'page');
  }
  for (const [pattern, render] of routes) {
    const match = path.match(pattern);
    if (match) {
      try { await render(match); } catch (error) { fail(error); }
      return;
    }
  }
  view.innerHTML = '<div class="empty"><strong>No such page</strong><a href="#/" style="color:var(--brand)">Back to your dashboard</a></div>';
}

function fail(error) {
  console.error(error);
  view.innerHTML = `<div class="empty"><strong>Something did not load</strong>${esc(error.message || error)}<br><button class="btn sm" data-retry>Try again</button></div>`;
  view.querySelector('[data-retry]')?.addEventListener('click', () => {
    moduleStore.reset();
    route();
  });
}

addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
route();

async function viewHome() {
  view.innerHTML = '<div class="skel" style="height:270px"></div>';
  const { modules } = await getModules();
  const state = loadStudyState();
  const topics = topicItems(modules);
  const review = nextReviewItems(revisionItems(modules), state).slice(0, 4);
  const read = topics.filter((topic) => state.read[topic.id]).length;
  const recent = topics.filter((topic) => state.read[topic.id]).sort((a, b) => latest(state.read[b.id]) - latest(state.read[a.id])).slice(0, 4);

  view.innerHTML = `
  <section class="hero dashboard-hero">
    <p class="eyebrow">TCS Quiz 2026 study portal</p>
    <h1>Build exam recall, one focused fact at a time.</h1>
    <p>Fifteen roadmap modules, ranked fact cards, a revision queue and practice modes in one quiet workspace.</p>
    <div class="acts"><a class="btn primary lg" href="#/modules">Choose a module</a><a class="btn lg" href="#/revision">Review next</a></div>
    <div class="stats">
      ${stat('facts read', `${read}/${topics.length}`)}
      ${stat('modules', modules.length)}
      ${stat('weak answers', weakCount(state))}
      ${stat('ready to review', review.length)}
    </div>
    ${progress(topics.map((topic) => topic.id), state)}
  </section>

  <section class="dashboard-section">
    <div class="section-title"><h2>Roadmap modules</h2><a href="#/modules">View all 15 →</a></div>
    <div class="module-grid">${modules.map((module) => moduleTile(module, state)).join('')}</div>
  </section>

  <div class="dashboard-columns">
    <section><div class="section-title"><h2>Next review</h2><a href="#/revision">Open queue →</a></div>${review.length ? `<div class="compact-list">${review.map(reviewRow).join('')}</div>` : emptyReview()}</section>
    <section><div class="section-title"><h2>Recent reading</h2></div>${recent.length ? `<div class="compact-list">${recent.map((topic) => compactTopic(topic, 'Read')).join('')}</div>` : '<div class="empty"><strong>Your study trail starts here</strong>Mark a fact as read to keep your recent activity visible.</div>'}</section>
  </div>`;
}

function emptyReview() {
  return '<div class="empty"><strong>Nothing due right now</strong>Missed questions appear immediately; read cards return after a day.</div>';
}

function compactTopic(item, label) {
  return `<a class="compact-row" href="#/module/${encodeURIComponent(item.moduleId)}"><span class="chip">${esc(label)}</span><span><b>${esc(clip(item.title, 95))}</b><small>${esc(item.moduleLabel)}</small></span></a>`;
}

function reviewRow(item) {
  const label = item.reviewKind === 'missed' ? 'Missed' : item.reviewKind === 'read' ? 'Read again' : 'Practice';
  return `<a class="compact-row" href="#/module/${encodeURIComponent(item.moduleId)}"><span class="chip on">${label}</span><span><b>${esc(clip(item.title, 95))}</b><small>${esc(item.moduleLabel)}</small></span></a>`;
}

async function viewModules() {
  view.innerHTML = '<div class="skel" style="height:300px"></div>';
  const { modules } = await getModules();
  const state = loadStudyState();
  view.innerHTML = `<div class="page-head"><h1>Roadmap modules</h1><p class="sub">The TCS Quiz 2026 roadmap in order. Each module contains ranked facts and a focused MCQ pool.</p></div><div class="module-grid">${modules.map((module) => moduleTile(module, state)).join('')}</div>`;
}

async function viewModule(id) {
  view.innerHTML = '<div class="skel" style="height:340px"></div>';
  const { modules } = await getModules();
  const module = modules.find((item) => item.id === id);
  if (!module) throw new Error(`TCS module ${id} was not found`);
  let category = '';
  const draw = () => {
    const state = loadStudyState();
    const topics = module.topics.filter((topic) => !category || topic.category === category).sort((a, b) => a.rank - b.rank);
    view.innerHTML = `<nav class="crumb"><a href="#/modules">Modules</a><s>/</s><span>Module ${module.order}</span></nav>
      <header class="page-head module-head"><span class="module-order">Module ${module.order}</span><h1>${esc(module.label)}</h1><p class="sub">${esc(module.blurb)}</p><p class="module-meta">${module.topics.length} ranked facts · ${module.questions.length} MCQs</p>${progress(module.topics.map((topic) => topic.id), state)}</header>
      <div class="module-actions"><a class="btn primary" href="#/quiz?module=${encodeURIComponent(module.id)}">Take module test</a><a class="btn" href="#/revision">Open revision</a></div>
      <div class="filters"><button data-category="" class="${category ? '' : 'on'}">All</button>${[...new Set(module.topics.map((topic) => topic.category))].sort().map((name) => `<button data-category="${esc(name)}" class="${category === name ? 'on' : ''}">${esc(name)}</button>`).join('')}</div>
      <div class="fact-grid">${topics.map((topic) => factCard(topic, module, state)).join('')}</div>`;
    view.querySelector('.filters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      category = button.dataset.category;
      draw();
    });
    view.querySelectorAll('[data-read]').forEach((button) => button.addEventListener('click', () => {
      const current = loadStudyState();
      writeState(markRead(current, button.dataset.read));
      draw();
    }));
  };
  draw();
}

function factCard(topic, module, state) {
  const done = Boolean(state.read[topic.id]);
  return `<article class="fact-card${done ? ' read' : ''}">
    <div class="fact-top"><span class="rk">${topic.rank}</span><span class="chip">${esc(topic.category)}</span>${meter(topic.importance)}</div>
    <h2>${esc(topic.title)}</h2><p class="fact-hook">${esc(topic.hook)}</p>
    <details><summary>Open explanation</summary><p>${esc(topic.explainer)}</p><div class="tag-list">${topic.tags.map((tag) => `<span class="chip">${esc(tag)}</span>`).join('')}</div>
      <div class="fact-links">${topic.map.links.map((link) => `<a href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)} ↗</a>`).join('')}</div></details>
    <div class="fact-foot"><button class="btn sm${done ? ' primary' : ''}" data-read="${esc(topic.id)}">${done ? 'Read' : 'Mark as read'}</button><a href="#/quiz?module=${encodeURIComponent(module.id)}" class="mini">Practice</a></div>
  </article>`;
}

async function viewTopic(id) {
  view.innerHTML = '<div class="skel" style="height:300px"></div>';
  const { modules } = await getModules();
  const resolved = resolveTopicRoute(`#/topic/${encodeURIComponent(id)}`, modules);
  if (!resolved) {
    view.innerHTML = `<div class="empty"><strong>That topic is not in the TCS roadmap</strong>Choose a TCS module to continue, or return to the map.<div style="margin-top:14px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#/modules">Browse modules</a><a class="btn" href="#/ultramap">Back to maps</a></div></div>`;
    return;
  }
  const { module } = resolved;
  const topic = topicWithTcsConnections(module, resolved.topic);
  const draw = () => {
    const state = loadStudyState();
    const done = Boolean(state.read[topic.id]);
    view.innerHTML = `<nav class="crumb"><a href="#/modules">Modules</a><s>/</s><a href="#/module/${encodeURIComponent(module.id)}">${esc(module.label)}</a><s>/</s><span>#${topic.rank}</span></nav>
      <header class="topic-head"><h1>${esc(topic.title)}</h1><p class="hk">${esc(topic.hook)}</p><div class="mt"><span class="chip on">${esc(topic.category)}</span><span>Exam relevance ${meter(topic.importance)}</span>${topic.tags.map((tag) => `<span class="chip">${esc(tag)}</span>`).join('')}</div><button class="donebtn${done ? ' on' : ''}" data-read="${esc(topic.id)}">${done ? 'Read' : 'Mark as read'}</button></header>
      <div class="topic-body"><article class="prose"><p>${esc(topic.explainer)}</p><h3>Connections to review</h3>${renderMap(topic)}<div class="fact-links">${topic.map.links.map((link) => `<a href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.label)} ↗</a>`).join('')}</div></article><aside class="side"><div class="box"><h4>Module practice</h4><div class="backup-body"><p>${esc(module.label)} contains ${module.questions.length} MCQs.</p><a class="btn primary" href="#/quiz?module=${encodeURIComponent(module.id)}">Take module test</a></div></div></aside></div>`;
    wireMap(view, topic);
    view.querySelector('[data-read]').addEventListener('click', () => {
      writeState(markRead(loadStudyState(), topic.id));
      draw();
    });
  };
  draw();
}

async function viewRevision() {
  view.innerHTML = '<div class="skel" style="height:300px"></div>';
  const { modules } = await getModules();
  const state = loadStudyState();
  const due = nextReviewItems(revisionItems(modules), state).slice(0, 40);
  view.innerHTML = `<div class="page-head"><h1>Revision queue</h1><p class="sub">Missed questions come first. Facts you read return after one day, keeping recall active without a separate checklist.</p></div>
    ${due.length ? `<div class="revision-list">${due.map((item) => `<article class="revision-card"><span class="chip on">${item.reviewKind === 'missed' ? 'Missed question' : item.reviewKind === 'read' ? 'Read yesterday' : 'Practice again'}</span><h2>${esc(item.title)}</h2><p>${esc(item.hook || '')}</p><div><a class="btn sm primary" href="#/module/${encodeURIComponent(item.moduleId)}">Review module</a>${item.itemType === 'question' ? `<a class="btn sm" href="#/quiz?module=${encodeURIComponent(item.moduleId)}">Try questions</a>` : ''}</div></article>`).join('')}</div>` : emptyReview()}`;
}

function viewBackup() {
  const state = loadStudyState();
  view.innerHTML = `<div class="page-head"><h1>Backup and restore</h1><p class="sub">Your progress stays in this browser. Save a JSON backup before clearing browser data or moving devices.</p></div>
    <div class="backup-grid"><section class="box"><h4>Export progress</h4><div class="backup-body"><p>${Object.keys(state.read).length} facts read · ${Object.keys(state.answers).length} answered questions.</p><button class="btn primary" data-export>Download JSON backup</button></div></section>
    <section class="box"><h4>Restore progress</h4><div class="backup-body"><p>Only TCS Quiz 2026 backups are accepted. Validation runs before anything in this browser is replaced.</p><label class="btn" for="restore-file">Choose backup file</label><input id="restore-file" type="file" accept="application/json,.json" hidden><p class="restore-note" data-status aria-live="polite"></p></div></section></div>`;
  view.querySelector('[data-export]').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(exportState(state), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'tcs-quiz-2026-backup.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  view.querySelector('#restore-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    const status = view.querySelector('[data-status]');
    if (!file) return;
    try {
      const restored = restoreState(await file.text());
      writeState(restored);
      status.textContent = 'Backup restored successfully.';
      status.className = 'restore-note ok';
    } catch (error) {
      status.textContent = `Nothing changed: ${error.message}`;
      status.className = 'restore-note bad';
    }
  });
}

async function viewSearch() {
  view.innerHTML = '<div class="skel" style="height:180px"></div>';
  const { modules } = await getModules();
  const items = topicItems(modules);
  const q0 = new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '';
  view.innerHTML = `<div class="page-head"><h1>Search</h1><p class="sub">Search fact titles, hooks, categories and tags across the full TCS roadmap.</p></div><div class="searchbar"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg><input class="input" placeholder="Cloud, Tata, quantum, cybersecurity…" value="${esc(q0)}" autofocus></div><div data-results></div>`;
  const input = view.querySelector('input');
  const output = view.querySelector('[data-results]');
  const run = () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) { output.innerHTML = '<div class="empty"><strong>Type at least two letters</strong>Results update as you type.</div>'; return; }
    const words = query.split(/\s+/);
    const hits = items.map((topic) => {
      const haystack = `${topic.title} ${topic.hook} ${topic.category} ${topic.tags.join(' ')}`.toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return null;
      const score = words.reduce((sum, word) => sum + (topic.title.toLowerCase().includes(word) ? 3 : 0) + (topic.tags.some((tag) => tag.toLowerCase().includes(word)) ? 2 : 0), topic.importance);
      return { topic, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 60);
    history.replaceState(null, '', '#/search?q=' + encodeURIComponent(input.value));
    output.innerHTML = hits.length ? `<p class="search-count">${hits.length} result${hits.length === 1 ? '' : 's'}</p><div class="search-results">${hits.map(({ topic }) => `<a class="search-result" href="#/module/${encodeURIComponent(topic.moduleId)}"><span class="rk">${topic.rank}</span><span><h2>${highlight(topic.title, input.value)}</h2><p>${highlight(topic.hook, input.value)}</p><small>${esc(topic.moduleLabel)} · ${esc(topic.category)}</small></span>${meter(topic.importance)}</a>`).join('')}</div>` : '<div class="empty"><strong>Nothing found</strong>Try a shorter term or a different spelling.</div>';
  };
  let timeout;
  input.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(run, 120); });
  run();
}
