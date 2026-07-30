#!/usr/bin/env node
// Reads every section file and writes data/index.json — the manifest the app
// boots from. Also acts as a validator: it shouts about anything malformed.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTcsCorpus } from '../assets/js/tcs-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [['months', 'current'], ['static', 'static']];

// Different writers reached for different names for the same subject. The app
// filters and the ultra map cluster by category, so they have to agree.
const CANON = {
  'polity': 'Polity & Constitution', 'polity & constitution': 'Polity & Constitution',
  'constitutional law': 'Polity & Constitution', 'governance': 'Polity & Constitution',
  'polity & elections': 'Polity & Constitution', 'election law': 'Polity & Constitution',
  'elections': 'Polity & Constitution',
  'judiciary': 'Law & Judiciary', 'law & judiciary': 'Law & Judiciary', 'legal': 'Law & Judiciary',
  'law': 'Law & Judiciary', 'legal gk': 'Law & Judiciary',
  'international relations': 'International Relations', 'world politics': 'International Relations',
  'neighbourhood': 'International Relations', 'diplomacy': 'International Relations',
  'international organisations': 'International Organisations',
  'international organizations': 'International Organisations',
  'economy': 'Economy', 'international trade': 'Economy', 'banking': 'Economy',
  'business': 'Economy', 'economy & banking': 'Economy',
  'science & tech': 'Science & Technology', 'science & technology': 'Science & Technology',
  'science and technology': 'Science & Technology', 'technology': 'Science & Technology',
  'science & space': 'Science & Technology', 'space': 'Science & Technology', 'aviation': 'Science & Technology',
  'science': 'Science & Technology',
  'environment': 'Environment', 'ecology': 'Environment', 'climate': 'Environment',
  'geography': 'Geography', 'physical geography': 'Geography',
  'history': 'History', 'modern history': 'History', 'ancient history': 'History',
  'art & culture': 'Arts & Culture', 'arts & culture': 'Arts & Culture', 'culture': 'Arts & Culture',
  'awards': 'Awards & Honours', 'awards & culture': 'Awards & Honours', 'honours': 'Awards & Honours',
  'awards & honours': 'Awards & Honours',
  'sports': 'Sports',
  'defence': 'Defence & Security', 'security': 'Defence & Security',
  'internal security': 'Defence & Security', 'defence & security': 'Defence & Security',
  'government schemes': 'Government Schemes', 'schemes': 'Government Schemes',
  'appointments': 'Appointments',
  'obituary': 'Obituaries', 'obituaries': 'Obituaries',
  'international observance': 'Days & Observances', 'days': 'Days & Observances',
  'education policy': 'Society & Education', 'education': 'Society & Education',
  'health': 'Society & Education', 'society': 'Society & Education',
  'polity & governance': 'Polity & Constitution', 'polity & judiciary': 'Law & Judiciary',
  'international law': 'Law & Judiciary', 'human geography': 'Geography',
  'economy & technology': 'Economy', 'disasters': 'Environment'
};
const canon = c => CANON[String(c || '').toLowerCase().trim()] || (c || 'Other');

const sections = [], topics = [], passages = [];
const problems = [];
let nodeCount = 0;

for (const [dir, kind] of dirs) {
  let files = [];
  try { files = (await readdir(join(root, 'data', dir))).filter(f => f.endsWith('.json')).sort(); }
  catch { continue; }

  for (const f of files) {
    const path = `data/${dir}/${f}`;
    let sec;
    try { sec = JSON.parse(await readFile(join(root, path), 'utf8')); }
    catch (e) { problems.push(`${path}: cannot parse — ${e.message}`); continue; }

    const id = sec.id || f.replace(/\.json$/, '');
    const t = sec.topics || [], p = sec.passages || [];
    if (!t.length) problems.push(`${path}: no topics`);

    sections.push({
      id, kind, path,
      label: sec.label || id,
      blurb: sec.blurb || '',
      order: sec.order ?? null,
      topicCount: t.length,
      passageCount: p.length
    });

    const seen = new Set();
    for (const x of t) {
      if (!x.id) { problems.push(`${path}: a topic has no id`); continue; }
      if (seen.has(x.id)) problems.push(`${path}: duplicate topic id ${x.id}`);
      seen.add(x.id);
      if (!x.story) problems.push(`${path}: ${x.id} has no story`);
      const n = x.map?.nodes?.length || 0;
      if (!n) problems.push(`${path}: ${x.id} has an empty map`);
      nodeCount += n;
      topics.push({
        id: x.id, section: id, kind,
        rank: x.rank ?? 999,
        depth: x.depth || 'medium',
        importance: x.importance ?? 3,
        title: x.title || x.id,
        hook: x.hook || '',
        date: x.date || '',
        category: canon(x.category),
        tags: x.tags || [],
        nodes: n,
        // explicit cross-references, so the ultra map draws real links and not
        // just tag coincidence
        refs: [...new Set((x.map?.nodes || []).map(k => k.topicRef).filter(Boolean))]
      });
    }

    for (const x of p) {
      if (!x.id) { problems.push(`${path}: a passage has no id`); continue; }
      const qs = x.questions || [];
      if (qs.length !== 5) problems.push(`${path}: ${x.id} has ${qs.length} questions, expected 5`);
      for (const [qi, q] of qs.entries()) {
        if (!Array.isArray(q.options) || q.options.length !== 4)
          problems.push(`${path}: ${x.id} q${qi + 1} does not have 4 options`);
        if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= (q.options?.length || 0))
          problems.push(`${path}: ${x.id} q${qi + 1} has an out-of-range answer index`);
      }
      passages.push({
        id: x.id, section: id, kind: x.kind || kind,
        category: canon(x.category),
        tags: x.tags || [],
        difficulty: x.difficulty ?? 2,
        topicIds: x.topicIds || [],
        n: qs.length
      });
    }
  }
}

sections.sort((a, b) => {
  if (a.kind !== b.kind) return a.kind === 'current' ? -1 : 1;
  if (a.kind === 'current') return a.id.localeCompare(b.id);
  return (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label);
});

const categories = [...new Set(topics.map(t => t.category))].filter(Boolean).sort();

const manifest = {
  built: new Date().toISOString(),
  sections, topics, passages, categories,
  stats: {
    months: sections.filter(s => s.kind === 'current').length,
    staticSections: sections.filter(s => s.kind === 'static').length,
    topics: topics.length,
    nodes: nodeCount,
    passages: passages.length,
    questions: passages.reduce((s, p) => s + p.n, 0)
  }
};

await writeFile(join(root, 'data/index.json'), JSON.stringify(manifest), 'utf8');

const s = manifest.stats;
console.log(`index.json written — ${s.months} months, ${s.staticSections} static sections, ${s.topics} topics, ${s.nodes} map nodes, ${s.questions} questions`);

// The TCS portal is independent of the legacy index above, but this command is
// the single authoring check for both corpora.
try {
  const moduleDir = process.env.TCS_MODULES_DIR || join(root, 'data', 'modules');
  const moduleManifest = JSON.parse(await readFile(join(moduleDir, 'index.json'), 'utf8'));
  const moduleData = await Promise.all(moduleManifest.modules.map(async (meta) => JSON.parse(await readFile(join(moduleDir, meta.file), 'utf8'))));
  const tcs = validateTcsCorpus(moduleManifest, moduleData);
  console.log(`TCS corpus validated — ${tcs.modules.length} modules, ${tcs.topics} topics, ${tcs.questions} questions`);
} catch (error) {
  problems.push(`data/modules: ${error.message}`);
}

if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems.slice(0, 60)) console.log('  · ' + p);
  if (problems.length > 60) console.log(`  … and ${problems.length - 60} more`);
  process.exitCode = 1;
}
