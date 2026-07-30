// Resolve the hash links emitted by the retained knowledge-map views against
// the TCS module corpus. Keeping this pure makes legacy-link compatibility
// testable without a browser DOM.
export function resolveTopicRoute(hash, modules) {
  const match = String(hash || '').replace(/^#/, '').match(/^\/topic\/([^/?]+)\/?$/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  for (const module of modules || []) {
    const topic = module.topics?.find((item) => item.id === id);
    if (topic) return { module, topic };
  }
  return null;
}
