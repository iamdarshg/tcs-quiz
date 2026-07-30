// Ultra map: an exploration of the TCS module corpus rather than a picture of it.
//
// You start with a handful of anchor topics and nothing else. Clicking one
// opens it, and its neighbours fade in around it. What you have not clicked
// stays hidden, so the graph grows along the path you walk instead of
// arriving as a hairball. The links are real: shared rare tags, and the
// explicit cross-references topic maps make to other topics.

import { getModuleManifest, getModule } from './tcs-data.js';
import { buildTcsMapCorpus } from './tcs-map.js';
import { esc, meter, isDone } from './ui.js';

const clip = (s, n) => (s = String(s || ''), s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const W = 1680, H = 1060, CX = 840, CY = 520;
const STEP = 158;   // how far a child sits from its parent
const MIN = 104;    // closest two nodes may be placed

/* ── graph ────────────────────────────────────────────────────────── */

function buildGraph(topics) {
  const norm = s => String(s || '').toLowerCase().trim();

  // A tag shared by half the corpus links nothing. Weight each tag by how rare
  // it is, so "India" counts for almost nothing and "Monroe Doctrine" counts.
  // Tags alone are too sparse — different writers tagged differently. Proper
  // nouns out of the titles carry the same signal and cost nothing.
  const STOP = new Set(['about', 'after', 'again', 'against', 'among', 'become', 'before', 'being',
    'between', 'called', 'court', 'every', 'first', 'from', 'india', 'india\'s', 'indian', 'into',
    'its', 'more', 'most', 'new', 'over', 'part', 'raise', 'return', 'their', 'there', 'these',
    'this', 'through', 'under', 'what', 'when', 'where', 'which', 'while', 'with', 'without',
    'year', 'years', 'holds', 'takes', 'opens', 'clears', 'strikes', 'reaches', 'grinds']);
  const tokens = t => {
    const out = new Set((t.tags || []).map(norm).filter(Boolean));
    for (const w of String(t.title || '').toLowerCase().split(/[^a-z0-9']+/))
      if (w.length > 4 && !STOP.has(w)) out.add(w);
    return out;
  };

  const bag = new Map(topics.map(t => [t.id, tokens(t)]));
  const freq = new Map();
  for (const set of bag.values()) for (const k of set) freq.set(k, (freq.get(k) || 0) + 1);

  const byTag = new Map();
  for (const t of topics) {
    for (const tag of bag.get(t.id)) {
      if (!tag || freq.get(tag) > 24) continue;
      (byTag.get(tag) || byTag.set(tag, []).get(tag)).push(t);
    }
  }

  const pair = new Map();
  const why = new Map();
  const add = (a, b, w, reason) => {
    if (a === b) return;
    const k = a < b ? a + '|' + b : b + '|' + a;
    pair.set(k, (pair.get(k) || 0) + w);
    if (reason && !why.has(k)) why.set(k, reason);
  };

  for (const [tag, list] of byTag) {
    if (list.length < 2 || list.length > 14) continue;
    const w = 1.4 / Math.log2(freq.get(tag) + 2);
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) add(list[i].id, list[j].id, w, tag);
  }

  const known = new Set(topics.map(t => t.id));
  for (const t of topics) for (const r of t.refs || []) if (known.has(r)) add(t.id, r, 1.6, 'named in the map');

  const section = new Map(topics.map(t => [t.id, t.section]));
  const edges = [];
  for (const [k, w] of pair) {
    const [a, b] = k.split('|');
    const cross = section.get(a) !== section.get(b);
    if (w < (cross ? 0.5 : 0.85)) continue;
    edges.push({ a, b, w, cross, why: why.get(k) || '' });
  }

  // Thin the hairball: keep each node's strongest links only. In an
  // exploration view this matters twice over, because the cap is also the
  // most branches a single click can open at once.
  const perNode = new Map();
  edges.sort((x, y) => y.w - x.w);
  const keep = [];
  for (const e of edges) {
    const na = perNode.get(e.a) || 0, nb = perNode.get(e.b) || 0;
    const cap = e.cross ? 6 : 4;
    if (na >= cap && nb >= cap) continue;
    perNode.set(e.a, na + 1);
    perNode.set(e.b, nb + 1);
    keep.push(e);
  }
  return keep;
}

/* ── view ─────────────────────────────────────────────────────────── */

export async function viewUltraMap(el) {
  const manifest = await getModuleManifest();
  const modules = await Promise.all(manifest.modules.map((meta) => getModule(meta.id)));
  const m = buildTcsMapCorpus(modules);
  const topics = m.topics.map(t => ({ ...t, refs: t.refs || [] }));
  const byId = new Map(topics.map(t => [t.id, t]));
  const edges = buildGraph(topics);

  const nbr = new Map();
  for (const e of edges) {
    (nbr.get(e.a) || nbr.set(e.a, []).get(e.a)).push(e.b);
    (nbr.get(e.b) || nbr.set(e.b, []).get(e.b)).push(e.a);
  }
  const degree = id => (nbr.get(id) || []).length;

  // Anchors: the best-connected, heaviest topic in each of the largest
  // subjects, so the six starting points sit in different parts of the corpus.
  function anchors(n = 6) {
    const best = new Map();
    for (const t of topics) {
      if (!degree(t.id)) continue;
      const score = (t.importance || 3) * 3 + degree(t.id);
      const cur = best.get(t.category);
      if (!cur || score > cur.score) best.set(t.category, { t, score });
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n).map(x => x.t.id);
  }

  // The map is a walked path, not an accumulating cloud. Only the trail you
  // have actually clicked stays on screen, plus whatever the node at the head
  // of it connects to. Branches you looked at and did not take fall away.
  const state = {
    pos: new Map(),      // id -> {x, y, from}
    path: [],            // the chain of opened nodes, in click order
    seeds: [],           // the six anchors, shown until the first click
    fresh: new Set(),    // newly visible since the last draw, so only they animate
    leaving: new Set(),  // visible last draw, gone now, held one beat to fade
    sel: null, scale: 1, tx: 0, ty: 0
  };
  const head = () => state.path[state.path.length - 1] || null;

  el.innerHTML = `
  <div class="page-head">
    <h1>Ultra map</h1>
    <p class="sub">The TCS roadmap as a walk rather than a picture. Six module anchors begin the map; click one to reveal the related topics in its study module. The branches you do not take fall away, so the screen keeps the thread you actually pulled.</p>
  </div>

  <div class="ultra-bar">
    <span class="ultra-count" data-count></span>
    <div class="ultra-tools">
      <button class="mini" data-act="back">Step back</button>
      <button class="mini" data-act="reset">Start over</button>
      <button class="mini" data-z="-1">&minus;</button>
      <button class="mini" data-z="0">Centre</button>
      <button class="mini" data-z="1">+</button>
    </div>
  </div>

  <div class="ultrawrap">
    <div class="map-stage ultra-stage" data-stage></div>
    <div class="ultra-card" data-card></div>
    <div class="ultra-key">
      <span><i class="dot cur"></i>Selected module topic</span>
      <span><i class="dot sta"></i>Related module topic</span>
      <span><i class="dot fro"></i>Unopened</span>
      <span><i class="ln cross"></i>Cross-module connection</span>
    </div>
  </div>
  <p style="font-size:12.5px;color:var(--faint);margin-top:10px">Hollow dots are branches you have not taken; the number on one is how many topics sit behind it. Clicking moves you onto a node and drops the branches you passed over. Click back along the rose trail to return. Drag to pan, ctrl-scroll or pinch to zoom.</p>`;

  const stage = el.querySelector('[data-stage]');
  const card = el.querySelector('[data-card]');
  const count = el.querySelector('[data-count]');

  const apply = () => {
    const cam = stage.querySelector('[data-cam]');
    if (cam) cam.setAttribute('transform', `translate(${state.tx.toFixed(1)} ${state.ty.toFixed(1)}) scale(${state.scale})`);
  };

  const tooClose = (x, y) => {
    for (const q of state.pos.values())
      if ((q.x - x) ** 2 + (q.y - y) ** 2 < MIN * MIN) return true;
    return false;
  };

  // Children fan out on the far side of the parent from wherever the parent
  // came in, so a chain reads outward instead of folding back on itself.
  function place(parentId, ids) {
    const p = state.pos.get(parentId);
    const base = p.from && state.pos.has(p.from)
      ? Math.atan2(p.y - state.pos.get(p.from).y, p.x - state.pos.get(p.from).x)
      : Math.atan2(p.y - CY, p.x - CX) || 0;
    const n = ids.length;
    const spread = n <= 2 ? 1.5 : n <= 4 ? 2.5 : 3.5;

    ids.forEach((id, i) => {
      let a = base + (n === 1 ? 0 : -spread / 2 + spread * (i / (n - 1)));
      let r = STEP + (i % 2) * 26;
      let x = p.x + r * Math.cos(a), y = p.y + r * Math.sin(a);
      for (let k = 0; k < 48 && tooClose(x, y); k++) {
        a += 0.26; r += 7;
        x = p.x + r * Math.cos(a); y = p.y + r * Math.sin(a);
      }
      state.pos.set(id, { x, y, from: parentId });
      state.fresh.add(id);
    });
  }

  // What is on screen: the trail, plus the head's neighbours. Before the first
  // click that is the six anchors instead.
  function visible() {
    const out = new Set(state.path);
    const h = head();
    if (h) for (const n of nbr.get(h) || []) out.add(n);
    else for (const s of state.seeds) out.add(s);
    return out;
  }

  function walkTo(id) {
    const at = state.path.indexOf(id);
    if (at >= 0) { state.path.length = at + 1; return; }   // clicked back up the trail
    state.path.push(id);
    const next = (nbr.get(id) || [])
      .filter(x => !state.pos.has(x))
      .sort((a, b) => (byId.get(b)?.importance || 3) - (byId.get(a)?.importance || 3));
    if (next.length) place(id, next);
  }

  function reset() {
    state.pos.clear(); state.fresh.clear(); state.leaving.clear();
    state.path = [];
    state.sel = null; state.scale = 1; state.tx = 0; state.ty = 0;
    card.classList.remove('on');
    state.seeds = anchors(6);
    state.seeds.forEach((id, i) => {
      const a = -Math.PI / 2 + (i / state.seeds.length) * Math.PI * 2;
      state.pos.set(id, { x: CX + 300 * Math.cos(a), y: CY + 236 * Math.sin(a), from: null });
    });
  }

  function stepBack() {
    if (!state.path.length) return;
    state.path.pop();
    state.sel = null;
    card.classList.remove('on');
  }

  // Put a node under the middle of the canvas. Camera changes are animated by
  // a CSS transition on the group, so the transform is written after paint.
  function centreOn(id, scale) {
    const p = state.pos.get(id);
    if (!p) return;
    state.scale = scale ?? Math.max(state.scale, 1.3);
    state.tx = CX - state.scale * p.x;
    state.ty = CY - state.scale * p.y;
  }

  let settle = null;

  function draw() {
    const shown = visible();
    const h = head();
    const paint = new Set([...shown, ...state.leaving]);
    const live = edges.filter(e => {
      if (!paint.has(e.a) || !paint.has(e.b)) return false;
      // Draw the trail itself, and every spoke off the head. Nothing else.
      const trail = state.path.includes(e.a) && state.path.includes(e.b);
      return trail || e.a === h || e.b === h;
    });

    const lines = live.map(e => {
      const A = state.pos.get(e.a), B = state.pos.get(e.b);
      if (!A || !B) return '';
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const cx = mx + (A.y - B.y) * 0.11, cy = my + (B.x - A.x) * 0.11;
      const isNew = state.fresh.has(e.a) || state.fresh.has(e.b);
      const isOut = state.leaving.has(e.a) || state.leaving.has(e.b);
      const onTrail = state.path.includes(e.a) && state.path.includes(e.b);
      return `<path class="ul-edge${e.cross ? ' cross' : ''}${onTrail ? ' trail' : ''}${isNew ? ' grew' : ''}${isOut ? ' going' : ''}" data-a="${esc(e.a)}" data-b="${esc(e.b)}" d="M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}" style="stroke-width:${(0.5 + e.w * 0.7).toFixed(2)}"/>`;
    }).join('');

    const dots = [...paint].map(id => {
      const p = state.pos.get(id), t = byId.get(id);
      if (!p || !t) return '';
      const r = 6 + (t.importance || 3) * 1.9;
      const onTrail = state.path.includes(id);
      const hidden = (nbr.get(id) || []).filter(x => !shown.has(x)).length;
      const cls = ['ul-node', t.kind, onTrail ? 'open' : 'frontier'];
      if (id === h) cls.push('head');
      if (isDone(id)) cls.push('read');
      if (state.sel === id) cls.push('sel');
      if (state.fresh.has(id)) cls.push('grew');
      if (!shown.has(id)) cls.push('going');
      const from = p.from && state.pos.has(p.from) ? state.pos.get(p.from) : { x: p.x, y: p.y };
      // The placement transform lives on the outer group and the entry
      // animation on the inner one, because a CSS transform would otherwise
      // overwrite the attribute and drop the node at the origin.
      return `<g class="${cls.join(' ')}" data-id="${esc(id)}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
        <g class="ul-in" style="--fx:${(from.x - p.x).toFixed(1)}px;--fy:${(from.y - p.y).toFixed(1)}px">
          <circle class="hit" r="${(r + 14).toFixed(1)}"/>
          <circle class="halo" r="${(r + 7).toFixed(1)}"/>
          <circle class="core" r="${r.toFixed(1)}"/>
          ${!onTrail && hidden ? `<text class="ul-more" y="3.2" text-anchor="middle">${hidden}</text>` : ''}
          <text class="ul-lab" y="${(r + 17).toFixed(1)}" text-anchor="middle">${esc(clip(t.title, 34))}</text>
        </g>
      </g>`;
    }).join('');

    // Render with the camera where it was, then move it, so the CSS
    // transition on the group actually has two values to animate between.
    const was = stage.querySelector('[data-cam]')?.getAttribute('transform');
    stage.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Explorable map of the corpus">
      <g class="ul-cam" data-cam${was ? ` transform="${was}"` : ''}><g class="ul-edges">${lines}</g><g class="ul-nodes">${dots}</g></g>
    </svg>`;
    requestAnimationFrame(apply);

    const ahead = shown.size - state.path.length;
    count.textContent = state.path.length
      ? `${state.path.length} on the trail · ${ahead} branching off · ${topics.length - state.pos.size} never seen`
      : `${state.seeds.length} anchors · pick one to start walking`;

    state.fresh.clear();
    if (state.leaving.size) {
      clearTimeout(settle);
      settle = setTimeout(() => { state.leaving.clear(); draw(); }, 360);
    }
  }

  function show(id) {
    const t = byId.get(id);
    if (!t) return;
    const links = (nbr.get(id) || []).map(x => byId.get(x)).filter(Boolean)
      .sort((a, b) => b.importance - a.importance);
    const found = links.filter(l => state.pos.has(l.id)).length;
    const sec = m.sections.find(s => s.id === t.section);
    card.innerHTML = `
      <button class="x" data-close aria-label="Close">&times;</button>
      <div class="k">${esc(sec ? sec.label : '')} · ${esc(t.category || '')}</div>
      <h5>${esc(t.title)}</h5>
      <p>${esc(t.hook || '')}</p>
      <div style="margin:9px 0 2px">${meter(t.importance || 3)}</div>
      ${links.length ? `<div class="ul-links"><b>${found} of ${links.length} connections revealed</b>${links.slice(0, 8).map(l =>
        state.pos.has(l.id)
          ? `<a href="#/topic/${encodeURIComponent(l.id)}"><i class="${l.kind}"></i>${esc(l.title)}</a>`
          : `<span class="dark"><i></i>Not yet found</span>`).join('')}</div>` : ''}
      <a class="btn sm primary" style="margin-top:10px" href="#/topic/${encodeURIComponent(t.id)}">Open topic</a>`;
    card.classList.add('on');
    card.querySelector('[data-close]').addEventListener('click', () => {
      card.classList.remove('on');
      state.sel = null;
      stage.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
    });
  }

  /* ── interaction ─────────────────────────────────────────────────── */

  let drag = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.ultra-card')) return;
    const g = e.target.closest('.ul-node');
    drag = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty, id: g ? g.dataset.id : null, moved: false };
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
    state.tx = Math.max(-W * 1.6, Math.min(W * 1.6, drag.tx + dx * k));
    state.ty = Math.max(-H * 1.6, Math.min(H * 1.6, drag.ty + dy * k));
    apply();
  });
  // Walking to a node retires whatever was on screen only because the
  // previous head pointed at it. Those are held for one beat so they fade
  // rather than vanish.
  function step(id) {
    const before = visible();
    state.sel = id;
    walkTo(id);
    const after = visible();
    state.leaving = new Set([...before].filter(x => !after.has(x)));
    for (const x of after) if (!before.has(x)) state.fresh.add(x);
    centreOn(id);
    show(id);
    draw();
  }

  const end = e => {
    if (drag && !drag.moved) {
      if (drag.id) step(drag.id);
      else {
        state.sel = null;
        card.classList.remove('on');
        stage.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
      }
    }
    drag = null;
    stage.classList.remove('drag');
    if (e) { try { stage.releasePointerCapture(e.pointerId); } catch {} }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    state.scale = Math.min(4, Math.max(0.35, state.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
    apply();
  }, { passive: false });

  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
    const before = visible();
    if (b.dataset.act === 'reset') reset(); else stepBack();
    const after = visible();
    state.leaving = new Set([...before].filter(x => !after.has(x)));
    for (const x of after) if (!before.has(x)) state.fresh.add(x);
    if (head()) centreOn(head()); else { state.scale = 1; state.tx = 0; state.ty = 0; }
    draw();
  }));

  el.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => {
    const z = +b.dataset.z;
    if (z === 0) {
      if (head()) centreOn(head(), 1.3); else { state.scale = 1; state.tx = 0; state.ty = 0; }
    } else {
      state.scale = Math.min(4, Math.max(0.35, state.scale * (z > 0 ? 1.25 : 0.8)));
      if (head()) centreOn(head(), state.scale);
    }
    apply();
  }));

  reset();
  draw();
}
