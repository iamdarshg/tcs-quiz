#!/usr/bin/env node
/**
 * generate-module-pages.mjs
 *
 * Reads _data/auto-modules/*.json and creates one Jekyll page (as .html)
 * per module at /module/<module-id>/index.html so GitHub Pages renders
 * them at /tcs-quiz/module/<module-id>/.
 *
 * Also generates the revision index page.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. Read the module list ────────────────────────────────────────────────
function findFile(rel) {
  const paths = [join(root, '_data', rel), join(root, 'data', rel)];
  for (const p of paths) { try { readFileSync(p); return p; } catch {} }
  return paths[0];
}

const autoDir = join(root, '_data', 'auto-modules');
const moduleFiles = readdirSync(autoDir).filter(f => f.endsWith('.json'));
const pagesDir = join(root, 'module');

for (const file of moduleFiles) {
  const data = JSON.parse(readFileSync(join(autoDir, file), 'utf8'));
  const modId = data.id;
  const modPageDir = join(pagesDir, modId);
  mkdirSync(modPageDir, { recursive: true });

  // Jekyll permalink page via index.html
  const html = `---
layout: default
title: ${escapeAttr(data.label)} — Modules — TCS Quiz 2026
permalink: /module/${modId}/
---

<div class="page-header">
  <a href="${getBasePath(root)}/modules/" class="back-link">&larr; All modules</a>
  <h1>${escapeHtml(data.label)}</h1>
  <p>${data.topicCount} study items from the prep library</p>
</div>

<div class="topic-list">
{% assign modId = "${modId}" %}
{% assign modData = site.data.auto-modules[modId] %}
{% if modData %}
  {% for topic in modData.topics %}
    <article class="topic-card" id="{{ topic.id }}">
      <div class="topic-meta">
        <span class="topic-rank">#{{ topic.rank }}</span>
        <span class="topic-source">Line {{ topic.sourceLine }}</span>
      </div>
      <div class="topic-title">{{ topic.title }}</div>
      <div class="topic-text">{{ topic.text }}</div>
    </article>
  {% endfor %}
{% else %}
  <p>Module data not available.</p>
{% endif %}
</div>

<style>
.back-link { display: inline-block; font-size: .85rem; color: var(--accent); text-decoration: none; margin-bottom: .5rem; }
.back-link:hover { text-decoration: underline; }
.topic-list { padding: 0.5rem 0 2rem; display: flex; flex-direction: column; gap: 0.75rem; }
.topic-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
.topic-meta { display: flex; gap: 0.75rem; font-size: .75rem; color: var(--text-dim); margin-bottom: .25rem; }
.topic-rank { font-weight: 600; color: var(--accent); }
.topic-title { font-size: .95rem; font-weight: 500; margin-bottom: .25rem; color: var(--text); }
.topic-text { font-size: .85rem; color: var(--text-dim); line-height: 1.5; white-space: pre-wrap; }
</style>
`;

  writeFileSync(join(modPageDir, 'index.html'), html, 'utf8');
  console.log(`  Created /module/${modId}/`);
}

console.log(`\nDone — ${moduleFiles.length} module pages`);

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function getBasePath(r) {
  try {
    const cfg = readFileSync(join(r, '_config.yml'), 'utf8');
    const m = cfg.match(/baseurl:\s*["']?([^"'\n]+)["']?/);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
