// Data access. One manifest, month files fetched on demand and cached.

const cache = new Map();
let manifest = null;

export async function getManifest() {
  if (manifest) return manifest;
  const r = await fetch('./data/index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('index.json missing — run node scripts/build-index.mjs');
  manifest = await r.json();
  return manifest;
}

export async function getSection(id) {
  if (cache.has(id)) return cache.get(id);
  const m = await getManifest();
  const s = m.sections.find(x => x.id === id);
  if (!s) return null;
  const p = fetch('./' + s.path, { cache: 'no-cache' }).then(r => r.json());
  cache.set(id, p);
  return p;
}

export async function getTopic(topicId) {
  const m = await getManifest();
  const stub = m.topics.find(t => t.id === topicId);
  if (!stub) return null;
  const sec = await getSection(stub.section);
  return { topic: sec.topics.find(t => t.id === topicId), section: sec, stub };
}

// Pull full passages for a set of section ids, filtered.
export async function getPassages(sectionIds, filter = () => true) {
  const secs = await Promise.all(sectionIds.map(getSection));
  const out = [];
  for (const s of secs) {
    if (!s || !s.passages) continue;
    for (const p of s.passages) if (filter(p, s)) out.push({ ...p, sectionId: s.id, sectionLabel: s.label });
  }
  return out;
}
