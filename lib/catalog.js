'use strict';
// Builds the public pack list from README.txt (status, notes, fixes) and the
// _check_data JSON files. View-only: the public data has names, counts and
// picture links only. No folder paths, no texture or model files.
const fs = require('fs');
const path = require('path');

const IMAGE_EXT = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif']);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function statusKind(label) {
  const l = label.toLowerCase();
  if (l.startsWith('not usable')) return 'bad';
  if (l.includes('issue')) return 'warn';
  return 'ok';
}

// Parses the "=== Category ===" / "[STATUS] Name  (N items; a, b)" blocks.
function parseReadme(text) {
  const packs = [];
  let category = null;
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const cat = raw.match(/^=== (.+) ===$/);
    if (cat) {
      category = cat[1].trim();
      current = null;
      continue;
    }
    if (!category) continue;
    const head = raw.match(/^\[([^\]]+)\]\s+(.+?)\s+\((\d+) items?; (.*)\)\s*$/);
    if (head) {
      current = {
        name: head[2].trim(),
        category,
        statusLabel: head[1].trim(),
        status: statusKind(head[1]),
        itemCount: Number(head[3]),
        setups: head[4].split(',').map((s) => s.trim()).filter(Boolean),
        fixes: [],
        notes: [],
      };
      packs.push(current);
      continue;
    }
    const extra = raw.match(/^\s+(fixed|note):\s*(.+)$/);
    if (extra && current) {
      (extra[1] === 'fixed' ? current.fixes : current.notes).push(extra[2].trim());
    }
  }
  return packs;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pack';
}

// "1 - Weapon and Tool Sets" -> "Weapon and Tool Sets"
function cleanCategory(c) {
  return String(c).replace(/^\d+\s*-\s*/, '');
}

function existingImage(file) {
  try {
    return IMAGE_EXT.has(path.extname(file).toLowerCase()) && fs.statSync(file).isFile();
  } catch (err) {
    return false;
  }
}

// Returns { data, images }. `data` is sent to the browser. `images` maps a
// picture id to its real file and stays on the server.
function loadCatalog(root) {
  const readmePath = path.join(root, 'README.txt');
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  const organize = readJson(path.join(root, '_check_data', '_organize.json'), {});
  const finalCheck = readJson(path.join(root, '_check_data', '_final_check.json'), {});

  const rows = parseReadme(readme);
  const seen = new Set(rows.map((r) => r.name));
  // Packs in _organize.json but missing from the README still show up.
  for (const [name, org] of Object.entries(organize)) {
    if (seen.has(name)) continue;
    const check = finalCheck[name] || {};
    rows.push({
      name,
      category: org.category || 'Other',
      statusLabel: 'Not checked',
      status: 'warn',
      itemCount: (check.items || []).length,
      setups: check.setups || [],
      fixes: org.fixes || [],
      notes: [],
    });
  }

  const images = new Map();
  const usedIds = new Map();
  const packs = rows.map((r) => {
    let id = slug(r.name);
    const n = usedIds.get(id) || 0;
    usedIds.set(id, n + 1);
    if (n) id += '-' + (n + 1);

    const org = organize[r.name] || {};
    const relDir = org.path ? String(org.path) : path.join(r.category, r.name);
    const dir = path.join(root, ...relDir.split(/[\\/]/));

    const pictures = [];
    const add = (file, label) => {
      if (!existingImage(file)) return;
      const picId = id + '-' + pictures.length + path.extname(file).toLowerCase();
      images.set(picId, file);
      // Relative link, so it works on the Node server and on GitHub Pages (/Models/).
      pictures.push({ url: 'img/' + encodeURIComponent(picId), label });
    };
    add(path.join(dir, 'preview.png'), 'Preview');
    for (const f of org.official || []) add(path.join(dir, path.basename(f)), 'Creator image');

    const items = ((finalCheck[r.name] || {}).items || [])
      .map((it) => String(it.name || it.id || ''))
      .filter(Boolean);

    return {
      id,
      name: r.name,
      category: cleanCategory(r.category),
      categoryOrder: parseInt(r.category, 10) || 99,
      status: r.status,
      statusLabel: r.statusLabel,
      itemCount: r.itemCount,
      setups: r.setups,
      // The internal fix log is not public: it names files inside the packs.
      notes: r.notes,
      pictures,
      items,
    };
  });

  packs.sort((a, b) => a.categoryOrder - b.categoryOrder || a.name.localeCompare(b.name));

  const categories = [];
  for (const p of packs) if (!categories.includes(p.category)) categories.push(p.category);
  const setups = [...new Set(packs.flatMap((p) => p.setups))].sort((a, b) => a.localeCompare(b));
  const stats = {
    packs: packs.length,
    items: packs.reduce((s, p) => s + p.itemCount, 0),
    ok: packs.filter((p) => p.status === 'ok').length,
    warn: packs.filter((p) => p.status === 'warn').length,
    bad: packs.filter((p) => p.status === 'bad').length,
  };
  return { data: { packs, categories, setups, stats }, images };
}

module.exports = { loadCatalog, parseReadme, slug };
