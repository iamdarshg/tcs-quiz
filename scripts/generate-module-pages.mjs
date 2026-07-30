#!/usr/bin/env node
/**
 * generate-module-pages.mjs
 *
 * Reads the CURATED module data (data/modules/module-01.json through
 * module-15.json) and generates Jekyll detail pages for each.
 *
 * For every topic in a module, it also finds relevant prep-library
 * lines by keyword matching — this is how the library's long text
 * automatically flows into the module pages.
 *
 * Also writes the curated modules index (used by modules.html).
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '/tcs-quiz';

// ── Helper: find files in _data/ or data/ ─────────────────────────────────
function findFile(rel) {
  for (const p of [join(root, '_data', rel), join(root, 'data', rel)]) {
    try { readFileSync(p); return p; } catch {}
  }
  return null;
}

function exists(rel) {
  return findFile(rel) !== null;
}

function readJSON(rel) {
  const p = findFile(rel);
  return p ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

// ── 1. Read curated module manifest ────────────────────────────────────────
const manifest = readJSON(join('modules', 'index.json'));
if (!manifest) throw new Error('data/modules/index.json not found');

const curatedModules = manifest.modules || [];

// ── 2. Read prep library for cross-referencing ────────────────────────────
const library = readJSON('prep-library.json');
const allLibLines = [];
if (library && Array.isArray(library.modules)) {
  for (const mod of library.modules) {
    for (const line of (mod.lines || [])) {
      allLibLines.push({
        sourceLine: line.sourceLine,
        text: line.text || '',
        moduleId: mod.id,
        moduleTitle: mod.title,
      });
    }
  }
}

// ── 3. Find prep library lines relevant to a topic ────────────────────────
function findRelatedLines(topic, maxLines = 15) {
  // Search for the topic title as a whole phrase in library lines.
  // This is far more specific than keyword matching.
  const title = String(topic.title || '').toLowerCase().trim();
  if (!title || title.length < 3) return [];

  // For multi-word titles, split into parts and check each
  const parts = title.split(/\s+/).filter(w => w.length > 2);

  const scored = allLibLines.map(line => {
    const lower = line.text.toLowerCase();
    // Check if ALL significant title words appear in the line
    const matches = parts.filter(w => lower.includes(w)).length;
    // Bonus if the full title phrase appears
    const phraseBonus = lower.includes(title) ? 2 : 0;
    return { ...line, score: matches + phraseBonus };
  })
  .filter(l => l.score >= parts.length)  // all parts must match
  .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxLines);
}

// ── 4. Write curated modules index for modules.html ────────────────────────
const curatedIndex = {
  built: new Date().toISOString(),
  totalModules: curatedModules.length,
  modules: curatedModules.map(m => ({
    id: m.id,
    order: m.order,
    label: m.label,
    blurb: m.blurb || '',
    file: m.file,
  })),
};
writeFileSync(join(root, '_data', 'curated-index.json'), JSON.stringify(curatedIndex, null, 2), 'utf8');
console.log(`curated-index.json written — ${curatedModules.length} modules`);

// ── 5. Generate module detail pages ────────────────────────────────────────
const moduleDir = join(root, 'data', 'modules');

for (const meta of curatedModules) {
  const data = readJSON(join('modules', meta.file));
  if (!data) {
    console.warn(`  WARNING: ${meta.file} not found, skipping`);
    continue;
  }

  const modId = meta.id;
  const modPageDir = join(root, 'module', modId);
  mkdirSync(modPageDir, { recursive: true });

  // Build HTML for topics
  const topicCards = (data.topics || []).map((topic, idx) => {
    const related = findRelatedLines(topic);
    const relatedHtml = related.length > 0
      ? `<details class="related-lines"><summary>Related library lines (${related.length})</summary>
         <div class="related-list">${related.map(l =>
           `<div class="related-line"><span class="rel-num">L${l.sourceLine}</span><span class="rel-text">${escapeHtml(l.text)}</span></div>`
         ).join('')}</div></details>`
      : '';

    return `<article class="topic-card" id="${topic.id}">
      <div class="topic-meta">
        <span class="topic-rank">#${idx + 1}</span>
        <span class="topic-importance">${'★'.repeat(topic.importance || 3)}</span>
      </div>
      <h3 class="topic-title">${escapeHtml(topic.title)}</h3>
      <div class="topic-hook">${escapeHtml(topic.hook)}</div>
      <div class="topic-explain">${escapeHtml(topic.explainer || '')}</div>
      ${relatedHtml}
      ${topic.map && topic.map.links ? `<div class="topic-links">${topic.map.links.map(l =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="topic-link">${escapeHtml(l.label)}</a>`
      ).join('')}</div>` : ''}
    </article>`;
  }).join('\n');

  // Build HTML for questions
  const questionCards = (data.questions || []).map((q, idx) => {
    const opts = (q.options || []).map((o, oi) =>
      `<li class="${oi === q.answer ? 'q-correct' : ''}">${escapeHtml(o)}${oi === q.answer ? ' ←' : ''}</li>`
    ).join('');
    return `<details class="question-card" id="${q.id}">
      <summary class="q-prompt">Q${idx + 1}: ${escapeHtml(q.q)}</summary>
      <ol class="q-options" type="A">${opts}</ol>
      <div class="q-explain">${escapeHtml(q.explanation)}</div>
    </details>`;
  }).join('\n');

  const html = `---
layout: default
title: ${escapeAttr(data.label)} — TCS Quiz 2026
permalink: /module/${modId}/
---

<div class="page-header">
  <a href="${BASE}/modules/" class="back-link">&larr; All modules</a>
  <h1>${escapeHtml(data.label)}</h1>
  <p class="module-stats">${data.topics.length} topics · ${data.questions.length} questions</p>
</div>

<nav class="module-toc">
  <h3>Topics</h3>
  <ul>${(data.topics || []).map((t, i) =>
    `<li><a href="#${t.id}">${i + 1}. ${escapeHtml(t.title)}</a></li>`
  ).join('')}</ul>
</nav>

<div class="topic-list">
${topicCards}
</div>

${questionCards ? `<h2 class="section-title">Practice Questions</h2>
<div class="question-list">${questionCards}</div>` : ''}

<style>
.module-stats { font-size: .85rem; color: var(--text-dim); margin: .25rem 0 0; }
.module-toc { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin: 0 0 1.5rem; }
.module-toc h3 { margin: 0 0 .5rem; font-size: .9rem; }
.module-toc ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .35rem; }
.module-toc li { font-size: .82rem; }
.module-toc a { color: var(--accent); text-decoration: none; padding: .15rem .5rem; border-radius: 4px; }
.module-toc a:hover { background: rgba(0,0,0,.05); }
.section-title { font-size: 1.2rem; margin: 2rem 0 1rem; padding-bottom: .25rem; border-bottom: 1px solid var(--border); }
.topic-list { display: flex; flex-direction: column; gap: 1rem; }
.topic-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; }
.topic-meta { display: flex; gap: .75rem; font-size: .78rem; color: var(--text-dim); margin-bottom: .35rem; align-items: center; }
.topic-rank { font-weight: 700; color: var(--accent); }
.topic-importance { color: #f0b400; letter-spacing: .1em; }
.topic-title { font-size: 1.05rem; font-weight: 600; margin: 0 0 .35rem; }
.topic-hook { font-size: .9rem; color: var(--text); line-height: 1.5; margin-bottom: .35rem; }
.topic-explain { font-size: .85rem; color: var(--text-dim); line-height: 1.5; white-space: pre-wrap; }
.topic-links { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
.topic-link { font-size: .8rem; color: var(--accent); text-decoration: none; padding: .2rem .6rem; border: 1px solid var(--border); border-radius: 4px; }
.topic-link:hover { border-color: var(--accent); }
.related-lines { margin-top: .5rem; font-size: .82rem; }
.related-lines summary { cursor: pointer; color: var(--accent); font-weight: 500; padding: .25rem 0; }
.related-list { max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; margin-top: .25rem; }
.related-line { display: flex; gap: .5rem; padding: .3rem .5rem; border-bottom: 1px solid var(--border-subtle, rgba(0,0,0,.04)); font-size: .82rem; line-height: 1.4; }
.related-line:last-child { border-bottom: none; }
.rel-num { min-width: 3rem; color: var(--text-dim); font-family: monospace; font-size: .75rem; text-align: right; user-select: none; }
.rel-text { color: var(--text); white-space: pre-wrap; }
.question-list { display: flex; flex-direction: column; gap: .5rem; }
.question-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: .75rem 1rem; }
.question-card[open] { border-color: var(--accent); }
.q-prompt { font-size: .9rem; font-weight: 500; cursor: pointer; padding: .25rem 0; }
.q-options { list-style: upper-alpha; padding-left: 1.5rem; margin: .5rem 0; font-size: .88rem; }
.q-correct { font-weight: 600; color: #1a8a1a; }
.q-explain { font-size: .85rem; color: var(--text-dim); line-height: 1.5; padding: .35rem 0; margin-top: .25rem; border-top: 1px solid var(--border); }
[data-theme="dark"] .q-correct { color: #4caf50; }
[data-theme="dark"] .related-line { border-bottom-color: rgba(255,255,255,.06); }
</style>
`;

  writeFileSync(join(modPageDir, 'index.html'), html, 'utf8');
  console.log(`  ${modId}: ${data.label} — ${data.topics.length} topics, ${data.questions.length} questions`);
}

console.log(`\nDone — ${curatedModules.length} module pages generated`);

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
