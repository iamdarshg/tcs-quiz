// Personal map. Starts empty; every node is written by hand and stored in
// localStorage. Renders through the same engine as the topic maps.

import { esc, md, store } from './ui.js';
import { renderMap, wireMap } from './map.js';

const KEY = 'mymap';
const blank = () => ({ title: 'My map', nodes: [] });

function load() {
  const d = store.get(KEY, null);
  return d && Array.isArray(d.nodes) ? d : blank();
}
function save(d) { store.set(KEY, d); }

// Depth from the parent chain drives the tier, so the ring styling means the
// same thing here as it does on a topic map: closer in, more central.
function withTiers(nodes) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const depth = n => {
    let d = 1, c = n, guard = 0;
    while (c.parent && byId.has(c.parent) && guard++ < 20) { d++; c = byId.get(c.parent); }
    return d;
  };
  return nodes.map(n => ({
    id: n.id,
    parent: byId.has(n.parent) ? n.parent : 'root',
    tier: Math.min(3, depth(n)),
    label: n.label,
    kind: 'concept',
    rel: '',
    note: n.note || 'No note on this one yet.'
  }));
}

export function viewMyMap(el) {
  let data = load();
  let editing = null;

  const draw = () => {
    const nodes = withTiers(data.nodes);
    const topic = { title: data.title, hook: `${data.nodes.length} node${data.nodes.length === 1 ? '' : 's'}, all yours.`, map: { nodes } };

    el.innerHTML = `
    <div class="page-head">
      <h1>Personal map</h1>
      <p class="sub">A blank sheet. Add a node for anything you learn, hang the next one off it, and the shape of what you know builds up over weeks. Click any node to read what you wrote. Everything is stored in this browser only.</p>
    </div>

    <div class="mymap-grid">
      <div>
        ${data.nodes.length
          ? renderMap(topic)
          : `<div class="empty" style="padding:70px 24px">
               <strong>Nothing on the map yet</strong>
               Add your first node on the right. Give it a title and, if you want, a note — the note is what shows when you click the node later.
             </div>`}
      </div>

      <aside class="mymap-side">
        <div class="box">
          <h4>${editing ? 'Edit node' : 'Add a node'}</h4>
          <form class="nodeform" data-form>
            <div class="field">
              <label for="nf-title">Title</label>
              <input class="input" id="nf-title" name="label" required maxlength="80" placeholder="Basic structure doctrine" value="${esc(editing ? editing.label : '')}">
            </div>
            <div class="field">
              <label for="nf-note">Content <span style="font-weight:440;color:var(--faint)">optional</span></label>
              <textarea class="input ta" id="nf-note" name="note" rows="4" placeholder="Kesavananda Bharati, 1973, 13-judge bench. Parliament can amend any part of the Constitution but cannot alter its basic structure.">${esc(editing ? editing.note : '')}</textarea>
            </div>
            <div class="field">
              <label for="nf-parent">Branches from</label>
              <select class="input" id="nf-parent" name="parent">
                <option value="">Nothing — start a new branch</option>
                ${data.nodes.filter(n => !editing || n.id !== editing.id).map(n =>
                  `<option value="${esc(n.id)}" ${editing && editing.parent === n.id ? 'selected' : ''}>${esc(n.label)}</option>`).join('')}
              </select>
            </div>
            <div class="formrow">
              <button class="btn primary" type="submit">${editing ? 'Save changes' : 'Add node'}</button>
              ${editing ? '<button class="btn" type="button" data-cancel>Cancel</button>' : ''}
            </div>
          </form>
        </div>

        ${data.nodes.length ? `<div class="box">
          <h4>Nodes</h4>
          <div class="nodelist">
            ${data.nodes.map(n => `<div class="nodeitem">
              <span>
                <b>${esc(n.label)}</b>
                ${n.parent ? `<i>under ${esc((data.nodes.find(x => x.id === n.parent) || {}).label || '—')}</i>` : '<i>top level</i>'}
              </span>
              <span class="acts">
                <button class="mini" data-edit="${esc(n.id)}" title="Edit">Edit</button>
                <button class="mini danger" data-del="${esc(n.id)}" title="Delete">Delete</button>
              </span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <div class="box">
          <h4>Map name</h4>
          <div style="padding:12px 14px;display:flex;gap:8px">
            <input class="input" style="flex:1" data-title value="${esc(data.title)}" maxlength="48">
            <button class="btn sm" data-rename>Rename</button>
          </div>
        </div>

        ${data.nodes.length ? `<div class="box">
          <h4>Backup</h4>
          <div style="padding:12px 14px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn sm" data-export>Copy as JSON</button>
            <button class="btn sm" data-import>Paste JSON</button>
            <button class="btn sm danger" data-wipe>Erase map</button>
          </div>
        </div>` : ''}
      </aside>
    </div>`;

    if (data.nodes.length) wireMap(el, topic);

    el.querySelector('[data-form]').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const label = String(f.get('label') || '').trim();
      if (!label) return;
      const parent = String(f.get('parent') || '') || null;
      const note = String(f.get('note') || '').trim();
      if (editing) {
        Object.assign(editing, { label, note, parent });
        editing = null;
      } else {
        data.nodes.push({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), label, note, parent });
      }
      save(data);
      draw();
    });

    el.querySelector('[data-cancel]')?.addEventListener('click', () => { editing = null; draw(); });

    el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      editing = data.nodes.find(n => n.id === b.dataset.edit);
      draw();
      el.querySelector('#nf-title')?.focus();
    }));

    el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.del;
      const node = data.nodes.find(n => n.id === id);
      const kids = data.nodes.filter(n => n.parent === id).length;
      const msg = kids
        ? `Delete "${node.label}"? Its ${kids} branch${kids === 1 ? '' : 'es'} will move up to where it sat.`
        : `Delete "${node.label}"?`;
      if (!confirm(msg)) return;
      data.nodes.forEach(n => { if (n.parent === id) n.parent = node.parent; });
      data.nodes = data.nodes.filter(n => n.id !== id);
      if (editing && editing.id === id) editing = null;
      save(data);
      draw();
    }));

    el.querySelector('[data-rename]')?.addEventListener('click', () => {
      const v = el.querySelector('[data-title]').value.trim();
      if (v) { data.title = v; save(data); draw(); }
    });

    el.querySelector('[data-export]')?.addEventListener('click', async e => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data));
        e.target.textContent = 'Copied';
        setTimeout(() => { e.target.textContent = 'Copy as JSON'; }, 1400);
      } catch { prompt('Copy this:', JSON.stringify(data)); }
    });

    el.querySelector('[data-import]')?.addEventListener('click', () => {
      const raw = prompt('Paste a map JSON. This replaces what is here.');
      if (!raw) return;
      try {
        const next = JSON.parse(raw);
        if (!Array.isArray(next.nodes)) throw new Error('no nodes array');
        data = { title: next.title || 'My map', nodes: next.nodes };
        save(data); draw();
      } catch (err) { alert('That did not parse: ' + err.message); }
    });

    el.querySelector('[data-wipe]')?.addEventListener('click', () => {
      if (!confirm('Erase every node on this map? There is no undo.')) return;
      data = blank(); save(data); draw();
    });
  };

  draw();
}
