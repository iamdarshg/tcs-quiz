// Authoring helpers for hand-written sections.
export const N = (id, parent, tier, label, kind, rel, note) => ({ id, parent, tier, label, kind, rel, note });
export function topic(o) {
  const depth = o.depth || (o.rank <= 12 ? 'deep' : o.rank <= 26 ? 'medium' : 'brief');
  return {
    id: o.id, rank: o.rank, depth,
    importance: o.imp ?? (o.rank <= 6 ? 5 : o.rank <= 14 ? 4 : o.rank <= 26 ? 3 : 2),
    title: o.title, date: o.date || '', category: o.cat,
    tags: o.tags || [], hook: o.hook, story: o.story,
    facts: o.facts.map(([k, v]) => ({ k, v })),
    timeline: (o.timeline || []).map(([when, what]) => ({ when, what })),
    why: o.why, map: { nodes: o.nodes }, sources: o.sources || []
  };
}
export function passage(o) {
  return {
    id: o.id, kind: o.kind || 'static', month: o.section, topicIds: o.topicIds || [],
    category: o.cat, tags: o.tags || [], difficulty: o.diff ?? 2, title: o.title,
    passage: o.passage,
    questions: o.qs.map(([q, options, answer, explain]) => ({ q, options, answer, explain }))
  };
}
