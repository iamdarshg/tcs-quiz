// Deterministic adapter from explicit, authored TCS topic connections to the
// retained map views. No similarity, vocabulary, category, or position
// heuristic is allowed to invent a relationship.

function peers(module, topic) {
  const topicsById = new Map((Array.isArray(module?.topics) ? module.topics : [])
    .map((item) => [item.id, item]));
  return (Array.isArray(topic?.map?.connections) ? topic.map.connections : [])
    .map((connection) => ({ item: topicsById.get(connection.topicId), connection }))
    .filter(({ item }) => item && item.id !== topic?.id)
    .slice(0, 4);
}

export function topicWithTcsConnections(module, topic) {
  const linked = peers(module, topic);
  return {
    ...topic,
    map: {
      ...(topic.map || {}),
      nodes: linked.map(({ item: peer, connection }, index) => ({
        id: `peer-${peer.id}`,
        parent: null,
        label: peer.title,
        note: connection.fact,
        rel: connection.relationship,
        kind: 'concept',
        tier: index < 2 ? 1 : 2,
        topicRef: peer.id
      }))
    }
  };
}

export function buildTcsMapCorpus(modules) {
  const loaded = Array.isArray(modules) ? modules : [];
  return {
    sections: loaded.map((module) => ({
      id: module.id,
      kind: 'module',
      order: module.order,
      label: `Module ${module.order}: ${module.label}`,
      blurb: module.blurb
    })),
    topics: loaded.flatMap((module) => module.topics.map((topic) => ({
      ...topic,
      section: module.id,
      moduleId: module.id,
      moduleOrder: module.order,
      moduleLabel: module.label,
      kind: 'module',
      refs: peers(module, topic).map(({ item }) => item.id)
    })))
  };
}
