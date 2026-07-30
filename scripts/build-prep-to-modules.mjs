#!/usr/bin/env node
/**
 * build-prep-to-modules.mjs
 *
 * Reads _data/prep-library.json (or data/prep-library.json) and auto-generates
 * structured module topic files into _data/auto-modules/ and a full revision
 * index into _data/auto-revision.json.
 *
 * Each prep-library line becomes a revision card/topic item with:
 *   - id: source line number (e.g. "lib-0007")
 *   - moduleId: which module it belongs to
 *   - moduleLabel: module title
 *   - title: first 80 chars of the line text
 *   - text: the full line text (the study content)
 *   - hook: truncated version for card previews
 *
 * This bridges the gap between the raw prep library document and the
 * Jekyll-generated module/revision pages: whenever the library source
 * text is updated, re-running this script propagates changes everywhere.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Try _data first, fall back to data/
function findFile(rel) {
  const paths = [
    join(root, '_data', rel),
    join(root, 'data', rel),
  ];
  for (const p of paths) {
    try { readFileSync(p); return p; } catch {}
  }
  return paths[0];
}

// ── 1. Read prep library ──────────────────────────────────────────────────
const libPath = findFile('prep-library.json');
const library = JSON.parse(readFileSync(libPath, 'utf8'));

// ── 2. Read existing module manifest for metadata ─────────────────────────
const modIndexPath = findFile(join('modules', 'index.json'));
let moduleManifest = { modules: [] };
try {
  moduleManifest = JSON.parse(readFileSync(modIndexPath, 'utf8'));
} catch {
  console.warn('Warning: no modules/index.json found — using prep-library module list only');
}

// Build a lookup: module id → label & order
const manifestLookup = {};
for (const m of moduleManifest.modules || []) {
  const key = m.id.replace(/^module-/, '');
  manifestLookup[key] = { label: m.label, order: m.order };
}

// ── 3. Generate auto-module data ──────────────────────────────────────────
const SKIP_MODULE_IDS = new Set(['00']); // roadmap/intro
const autoModules = [];
let totalLibLines = 0;

for (const mod of library.modules || []) {
  if (SKIP_MODULE_IDS.has(mod.id)) continue;
  const meta = manifestLookup[mod.id] || {};
  const moduleId = `module-${mod.id}`;
  const moduleLabel = meta.label || mod.title || `Module ${mod.id}`;

  const topics = mod.lines.map((line, idx) => {
    totalLibLines++;
    const topicId = `lib-${String(line.sourceLine).padStart(5, '0')}`;
    const text = line.text || '';
    const title = text.length > 80 ? text.slice(0, 77) + '...' : text;
    return {
      id: topicId,
      rank: idx + 1,
      moduleId,
      moduleLabel,
      sourceLine: line.sourceLine,
      title: title || '(empty)',
      text,
      hook: text.length > 120 ? text.slice(0, 117) + '...' : text,
      category: moduleLabel,
      tags: [moduleLabel, 'TCS Quiz 2026'],
    };
  });

  autoModules.push({
    id: moduleId,
    order: meta.order || Number(mod.id),
    label: moduleLabel,
    topicCount: topics.length,
    topics,
  });
}

// ── 4. Write auto-module files ────────────────────────────────────────────
const outDir = join(root, '_data', 'auto-modules');
mkdirSync(outDir, { recursive: true });

const allTopics = [];

for (const am of autoModules) {
  const filePath = join(outDir, `${am.id}.json`);
  writeFileSync(filePath, JSON.stringify(am, null, 2), 'utf8');
  allTopics.push(...am.topics);
  console.log(`  ${am.id}: ${am.topicCount} topics`);
}

// ── 5. Write revision index (all topics flat, for Jekyll) ─────────────────
const revisionIndex = {
  built: new Date().toISOString(),
  totalModules: autoModules.length,
  totalTopics: allTopics.length,
  modules: autoModules.map(m => ({
    id: m.id,
    order: m.order,
    label: m.label,
    topicCount: m.topicCount,
    file: `${m.id}.json`,
  })),
};

writeFileSync(join(root, '_data', 'auto-revision.json'), JSON.stringify(revisionIndex, null, 2), 'utf8');

// ── 6. Stats ──────────────────────────────────────────────────────────────
console.log(`\nDone — ${autoModules.length} modules, ${allTopics.length} topics from ${totalLibLines} library lines`);
