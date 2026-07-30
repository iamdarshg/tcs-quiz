// Radial knowledge map. Renders a topic's connection tree as SVG.
// Ring distance = degrees of separation. Tier = how much the exam cares.

import { esc } from './ui.js';

// Ellipse rather than circle: browser viewports are wide and short, and the
// extra horizontal room is where the long labels go.
const W = 1440, H = 940, CX = 720, CY = 470;
const RING = [0, 158, 288, 405];
const SPREAD = 1.42;
const KIND_LABEL = {
  person: 'Person', org: 'Organisation', event: 'Event', concept: 'Concept',
  place: 'Place', law: 'Law / Article', book: 'Book', award: 'Award', term: 'Term'
};

export function renderMap(topic) {
  const nodes = (topic.map && topic.map.nodes) || [];
  if (!nodes.length) return '';
  return `
<div class="mapwrap" data-map>
  <div class="map-bar">
    <h4>Connection map</h4>
    <div class="legend">
      <span><i class="t1"></i>Ask-me-first</span>
      <span><i class="t2"></i>Second order</span>
      <span><i class="t3"></i>Background</span>
    </div>
    <div class="map-tools">
      <button data-z="-1" title="Zoom out" aria-label="Zoom out">&minus;</button>
      <button data-z="0" title="Reset view" aria-label="Reset view">&#9678;</button>
      <button data-z="1" title="Zoom in" aria-label="Zoom in">+</button>
      <button data-full title="Expand" aria-label="Expand map">&#9974;</button>
    </div>
  </div>
  <div class="map-stage" data-stage>${svg(topic, nodes)}
    <div class="map-detail" data-detail><button class="x" data-close aria-label="Close">&times;</button><div data-detail-body></div></div>
  </div>
</div>`;
}

function layout(topic, raw) {
  const byId = new Map();
  const root = { id: 'root', label: topic.title, tier: 0, kind: 'topic', note: topic.hook || '', children: [], depth: 0 };
  byId.set('root', root);
  for (const n of raw) byId.set(n.id, { ...n, children: [], depth: 0 });
  for (const n of raw) {
    const node = byId.get(n.id);
    const parent = byId.get(n.parent) && n.parent !== n.id ? byId.get(n.parent) : root;
    node.parent = parent;
    parent.children.push(node);
  }
  // guard against cycles introduced by bad data
  const seen = new Set(['root']);
  (function walk(n, d) {
    n.depth = Math.min(d, 3);
    n.children = n.children.filter(c => !seen.has(c.id) && seen.add(c.id));
    n.children.forEach(c => walk(c, d + 1));
  })(root, 0);

  const leaves = n => (n.leaves = n.children.length ? n.children.reduce((s, c) => s + leaves(c), 0) : 1);
  leaves(root);

  const gap = 0.16; // radians of breathing room at the 12 o'clock seam
  (function place(n, a0, a1) {
    n.angle = (a0 + a1) / 2;
    n.r = RING[n.depth];
    n.x = CX + n.r * SPREAD * Math.cos(n.angle);
    n.y = CY + n.r * Math.sin(n.angle);
    let a = a0;
    for (const c of n.children) {
      const span = (a1 - a0) * (c.leaves / n.leaves);
      place(c, a, a + span);
      a += span;
    }
  })(root, -Math.PI / 2 + gap, Math.PI * 1.5 - gap);

  const flat = [];
  (function collect(n) { flat.push(n); n.children.forEach(collect); })(root);

  // Labels sit horizontally, so two nodes at the same radius on the same side
  // will collide. Push them apart vertically; the edges follow.
  const MIN = 19;
  const groups = new Map();
  for (const n of flat) {
    if (n.depth === 0) continue;
    const key = n.depth + ':' + (Math.cos(n.angle) >= -0.05 ? 'r' : 'l');
    (groups.get(key) || groups.set(key, []).get(key)).push(n);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.y - b.y);
    for (let i = 1; i < g.length; i++) {
      const d = g[i].y - g[i - 1].y;
      if (d < MIN) g[i].y = g[i - 1].y + MIN;
    }
    const overflow = g.length ? g[g.length - 1].y - (CY + RING[3] + 60) : 0;
    if (overflow > 0) for (const n of g) n.y -= overflow / 2;
  }

  return { root, flat };
}

function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }

function svg(topic, raw) {
  const { flat } = layout(topic, raw);
  const edges = [], marks = [];

  for (const n of flat) {
    if (!n.parent) continue;
    const p = n.parent;
    const mr = (p.r + n.r) / 2;
    const c1x = CX + mr * SPREAD * Math.cos(p.angle), c1y = CY + mr * Math.sin(p.angle);
    const c2x = CX + mr * SPREAD * Math.cos(n.angle), c2y = CY + mr * Math.sin(n.angle);
    edges.push(`<path class="mp-edge t${n.tier}" data-edge="${esc(n.id)}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}"/>`);
  }

  for (const n of flat) {
    const isRoot = n.id === 'root';
    const right = Math.cos(n.angle) >= -0.05;
    const r = isRoot ? 9 : n.tier === 1 ? 6 : n.tier === 2 ? 5 : 3.6;
    const dx = isRoot ? 0 : (right ? r + 8 : -(r + 8));
    const anchor = isRoot ? 'middle' : right ? 'start' : 'end';
    const dy = isRoot ? 26 : 4;
    const cap = isRoot ? 42 : n.tier === 1 ? 34 : 30;
    const label = trunc(n.label, cap);
    const cls = isRoot ? 'mp-node mp-root' : `mp-node t${n.tier}`;
    const delay = isRoot ? 0 : 90 + n.depth * 110 + (n.tier - 1) * 40;
    marks.push(
      `<g class="${cls}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})" style="--d:${delay}ms">` +
      `<circle class="hit" r="${Math.max(16, r + 11)}"/>` +
      `<circle r="${r}"/>` +
      `<text x="${dx}" y="${dy}" text-anchor="${anchor}">${esc(label)}</text>` +
      `</g>`
    );
  }

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Connection map for ${esc(topic.title)}">
  <g data-cam>${edges.join('')}${marks.join('')}</g>
</svg>`;
}

export function wireMap(scope, topic) {
  const wrap = scope.querySelector('[data-map]');
  if (!wrap) return;
  const stage = wrap.querySelector('[data-stage]');
  const cam = wrap.querySelector('[data-cam]');
  const detail = wrap.querySelector('[data-detail]');
  const body = wrap.querySelector('[data-detail-body]');
  const nodes = new Map((topic.map?.nodes || []).map(n => [n.id, n]));

  // parent chain, for branch highlighting
  const parentOf = new Map();
  for (const n of nodes.values()) parentOf.set(n.id, nodes.has(n.parent) && n.parent !== n.id ? n.parent : 'root');

  let scale = 1, tx = 0, ty = 0;
  const apply = () => {
    tx = Math.max(-W, Math.min(W, tx));
    ty = Math.max(-H, Math.min(H, ty));
    cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${scale})`);
  };

  wrap.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => {
    const z = +b.dataset.z;
    if (z === 0) { scale = 1; tx = 0; ty = 0; }
    else scale = Math.min(3.2, Math.max(0.55, scale * (z > 0 ? 1.25 : 0.8)));
    apply();
  }));

  wrap.querySelector('[data-full]').addEventListener('click', () => {
    wrap.classList.toggle('full');
    document.body.style.overflow = wrap.classList.contains('full') ? 'hidden' : '';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && wrap.classList.contains('full')) {
      wrap.classList.remove('full'); document.body.style.overflow = '';
    }
  });

  // Plain scrolling belongs to the page. Zoom needs a pinch or ctrl held.
  stage.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    scale = Math.min(3.2, Math.max(0.55, scale * (e.deltaY > 0 ? 0.92 : 1.08)));
    apply();
  }, { passive: false });

  // Pointer capture would steal the click target, so a tap is detected here
  // rather than left to a click listener: press, move less than 4px, release.
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.map-detail') || e.target.closest('.map-tools')) return;
    const g = e.target.closest('.mp-node');
    drag = { x: e.clientX, y: e.clientY, tx, ty, node: g ? g.dataset.node : null, moved: false };
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (dx * dx + dy * dy < 16) return;
      drag.moved = true;
      stage.classList.add('drag');
      try { stage.setPointerCapture(e.pointerId); } catch {}
    }
    const k = (W / stage.clientWidth) || 1;
    tx = drag.tx + dx * k;
    ty = drag.ty + dy * k;
    apply();
  });
  const endDrag = e => {
    if (drag && !drag.moved && drag.node) select(drag.node);
    drag = null;
    stage.classList.remove('drag');
    if (e) { try { stage.releasePointerCapture(e.pointerId); } catch {} }
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  const chain = id => { const out = []; let c = id; while (c && c !== 'root' && !out.includes(c)) { out.push(c); c = parentOf.get(c); } return out; };

  function focus(id) {
    stage.querySelectorAll('.hi').forEach(el => el.classList.remove('hi'));
    if (!id || id === 'root') { stage.classList.remove('focus'); return; }
    stage.classList.add('focus');
    const ids = chain(id);
    for (const i of ids) {
      stage.querySelector(`[data-node="${CSS.escape(i)}"]`)?.classList.add('hi');
      stage.querySelector(`[data-edge="${CSS.escape(i)}"]`)?.classList.add('hi');
    }
    stage.querySelector('.mp-root')?.classList.add('hi');
  }

  function select(id) {
    stage.querySelectorAll('.sel').forEach(el => el.classList.remove('sel'));
    const n = nodes.get(id);
    if (!n) {
      body.innerHTML = `<div class="k">This topic</div><h5>${esc(topic.title)}</h5><p>${esc(topic.hook || '')}</p>`;
    } else {
      stage.querySelector(`[data-node="${CSS.escape(id)}"]`)?.classList.add('sel');
      const link = n.topicRef ? `<a href="#/topic/${encodeURIComponent(n.topicRef)}">Open that topic &rarr;</a>` : '';
      body.innerHTML =
        `<div class="k">${esc(KIND_LABEL[n.kind] || 'Link')}${n.rel ? ' · ' + esc(n.rel) : ''}</div>` +
        `<h5>${esc(n.label)}</h5><p>${esc(n.note || '')}</p>${link}`;
    }
    detail.classList.add('on');
  }

  stage.addEventListener('pointerover', e => {
    const g = e.target.closest('.mp-node');
    if (g) focus(g.dataset.node);
  });
  stage.addEventListener('pointerleave', () => focus(null));
  stage.addEventListener('keydown', e => {
    const g = e.target.closest('.mp-node');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.dataset.node); focus(g.dataset.node); }
  });
  wrap.querySelector('[data-close]').addEventListener('click', () => {
    detail.classList.remove('on');
    stage.querySelectorAll('.sel').forEach(el => el.classList.remove('sel'));
  });

  // Entrance: nodes fade in ring by ring, which is how you read the hierarchy.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.querySelectorAll('.mp-node, .mp-edge').forEach(el => {
      const d = el.style.getPropertyValue('--d') || '0ms';
      el.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 380, delay: parseFloat(d) || 0, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'backwards' });
    });
  }
}
