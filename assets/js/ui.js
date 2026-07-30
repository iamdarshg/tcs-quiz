// Small shared helpers. No dependencies.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function meter(n, max = 5) {
  let h = '<span class="meter" title="Exam relevance ' + n + '/' + max + '" aria-label="Exam relevance ' + n + ' of ' + max + '">';
  for (let i = 1; i <= max; i++) h += '<i class="' + (i <= n ? 'f' : '') + '"></i>';
  return h + '</span>';
}

// Deliberately tiny markdown: paragraphs, ### headings, lists, bold, italic, code, links.
export function md(src) {
  if (!src) return '';
  // Some source files carried a literal backslash-n instead of a newline.
  const blocks = String(src).replace(/\\n/g, '\n').trim().split(/\n{2,}/);
  return blocks.map(b => {
    b = b.trim();
    if (/^###\s/.test(b)) return '<h3>' + inline(b.replace(/^###\s*/, '')) + '</h3>';
    if (/^[-*]\s/m.test(b) && b.split('\n').every(l => /^[-*]\s/.test(l.trim()))) {
      return '<ul>' + b.split('\n').map(l => '<li>' + inline(l.trim().replace(/^[-*]\s*/, '')) + '</li>').join('') + '</ul>';
    }
    return '<p>' + inline(b).replace(/\n/g, ' ') + '</p>';
  }).join('');
}

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Mulberry32 — seeded RNG so a quiz can be replayed from its seed.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function highlight(text, q) {
  if (!q) return esc(text);
  const parts = q.trim().split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!parts.length) return esc(text);
  return esc(text).replace(new RegExp('(' + parts.join('|') + ')', 'ig'), '<mark>$1</mark>');
}

/* ── read-tracking ──────────────────────────────────────────────────
   One flat map of topic id to timestamp, in localStorage. */

let doneMap = null;
export function done() {
  if (!doneMap) doneMap = store.get('done', {}) || {};
  return doneMap;
}
export function isDone(id) { return !!done()[id]; }
export function toggleDone(id) {
  const d = done();
  if (d[id]) delete d[id]; else d[id] = Date.now();
  store.set('done', d);
  return !!d[id];
}
export function doneCount(ids) {
  const d = done();
  return ids.reduce((n, id) => n + (d[id] ? 1 : 0), 0);
}

export function tick(id) {
  const on = isDone(id);
  return `<button class="tick${on ? ' on' : ''}" data-tick="${esc(id)}" role="checkbox" aria-checked="${on}" title="${on ? 'Read' : 'Mark as read'}" aria-label="${on ? 'Mark as unread' : 'Mark as read'}">
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M2.5 8.5 6 12l7.5-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>`;
}

export const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('tcsquiz.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('tcsquiz.' + k, JSON.stringify(v)); } catch {} }
};
