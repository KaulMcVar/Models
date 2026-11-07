import React, { useEffect, useMemo, useRef, useState } from 'react';

const STATUS_TEXT = { ok: 'Ready', warn: 'Small issue', bad: 'Not usable' };
const SORTS = {
  name: { label: 'Name A-Z', fn: (a, b) => a.name.localeCompare(b.name) },
  items: { label: 'Most items', fn: (a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name) },
  category: { label: 'Category', fn: null },
};

function store(key, value) {
  try {
    if (value === undefined) return window.localStorage.getItem(key);
    window.localStorage.setItem(key, value);
  } catch (err) {
    // Storage can be blocked (private mode). The site still works without it.
  }
  return null;
}

function readHash() {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#/, ''));
  } catch (err) {
    return '';
  }
}

// Pictures can't be dragged out or right-click saved from the page.
function Picture({ src, alt, className }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className={'pic-missing ' + (className || '')} role="img" aria-label="No preview">
        <span>No preview</span>
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onError={() => setBroken(true)}
    />
  );
}

function StatusBadge({ status }) {
  return <span className={'badge badge-' + status}>{STATUS_TEXT[status] || status}</span>;
}

function PackCard({ pack, matches, onOpen }) {
  const cover = pack.pictures[0];
  return (
    <button type="button" className="card" onClick={() => onOpen(pack.id)} aria-label={'Open ' + pack.name}>
      <div className="card-pic">
        <Picture src={cover && cover.url} alt={pack.name + ' preview'} />
      </div>
      <div className="card-body">
        <div className="card-top">
          <h3>{pack.name}</h3>
          <StatusBadge status={pack.status} />
        </div>
        <p className="muted">
          {pack.itemCount ? pack.itemCount + ' items' : 'Pack'} · {pack.category}
        </p>
        <div className="tags">
          {pack.setups.slice(0, 3).map((s) => (
            <span key={s} className="tag">{s}</span>
          ))}
          {pack.setups.length > 3 ? <span className="tag">+{pack.setups.length - 3}</span> : null}
        </div>
        {matches.length ? (
          <p className="match">Has: {matches.slice(0, 3).join(', ')}{matches.length > 3 ? ' and ' + (matches.length - 3) + ' more' : ''}</p>
        ) : null}
      </div>
    </button>
  );
}

function PackDetail({ pack, onClose, onStep }) {
  const [pic, setPic] = useState(0);
  const [itemQuery, setItemQuery] = useState('');
  const closeRef = useRef(null);

  useEffect(() => {
    setPic(0);
    setItemQuery('');
  }, [pack.id]);

  useEffect(() => {
    const previous = document.activeElement;
    if (closeRef.current) closeRef.current.focus();
    document.body.classList.add('no-scroll');
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && e.target.tagName !== 'INPUT') onStep(1);
      else if (e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT') onStep(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      if (previous && previous.focus) previous.focus();
    };
  }, [onClose, onStep]);

  const items = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return q ? pack.items.filter((i) => i.toLowerCase().includes(q)) : pack.items;
  }, [pack, itemQuery]);

  const current = pack.pictures[pic] || pack.pictures[0];

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">{pack.category}</p>
            <h2 id="dialog-title">{pack.name}</h2>
          </div>
          <div className="dialog-actions">
            <button type="button" className="icon-btn" onClick={() => onStep(-1)} aria-label="Previous pack">‹</button>
            <button type="button" className="icon-btn" onClick={() => onStep(1)} aria-label="Next pack">›</button>
            <button type="button" className="icon-btn" ref={closeRef} onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className="dialog-grid">
          <div>
            <div className="big-pic">
              <Picture src={current && current.url} alt={pack.name + ' preview'} />
            </div>
            {pack.pictures.length > 1 ? (
              <div className="pic-tabs" role="tablist">
                {pack.pictures.map((p, i) => (
                  <button
                    key={p.url}
                    type="button"
                    role="tab"
                    aria-selected={i === pic}
                    className={'chip' + (i === pic ? ' chip-on' : '')}
                    onClick={() => setPic(i)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="facts">
            <dl>
              <div><dt>Status</dt><dd><StatusBadge status={pack.status} /></dd></div>
              <div><dt>Items</dt><dd>{pack.itemCount}</dd></div>
              <div><dt>Works with</dt><dd>{pack.setups.join(', ') || 'Resource pack'}</dd></div>
            </dl>
            {pack.notes.length ? (
              <div className="notes">
                <h4>Good to know</h4>
                <ul>{pack.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            ) : null}

            {pack.items.length ? (
              <div className="items">
                <div className="items-head">
                  <h4>Items ({pack.items.length})</h4>
                  {pack.items.length > 8 ? (
                    <input
                      type="search"
                      className="input input-sm"
                      placeholder="Find item"
                      aria-label="Find item in this pack"
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                    />
                  ) : null}
                </div>
                <ul className="item-list">
                  {items.map((name, i) => <li key={name + i}>{name}</li>)}
                  {!items.length ? <li className="muted">No item matches.</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [setup, setSetup] = useState('all');
  const [sort, setSort] = useState('category');
  const [openId, setOpenId] = useState(readHash());
  const [theme, setTheme] = useState(store('theme') || 'auto');

  useEffect(() => {
    let alive = true;
    fetch('packs.json')
      .then((r) => {
        if (!r.ok) throw new Error('Server answered ' + r.status);
        return r.json();
      })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message || 'Could not load packs'));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setOpenId(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    store('theme', theme);
  }, [theme]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!data) return [];
    const list = [];
    for (const p of data.packs) {
      if (category !== 'all' && p.category !== category) continue;
      if (status !== 'all' && p.status !== status) continue;
      if (setup !== 'all' && !p.setups.includes(setup)) continue;
      let matches = [];
      if (q) {
        const inName = p.name.toLowerCase().includes(q) || p.setups.some((s) => s.toLowerCase().includes(q));
        matches = p.items.filter((i) => i.toLowerCase().includes(q));
        if (!inName && !matches.length) continue;
        if (inName) matches = [];
      }
      list.push({ pack: p, matches });
    }
    const fn = SORTS[sort] && SORTS[sort].fn;
    if (fn) list.sort((a, b) => fn(a.pack, b.pack));
    return list;
  }, [data, q, category, status, setup, sort]);

  const openPack = (id) => {
    window.location.hash = encodeURIComponent(id);
  };
  const closePack = React.useCallback(() => {
    // Removes the hash without adding a history step or jumping the page.
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (err) {
      window.location.hash = '';
    }
    setOpenId('');
  }, []);

  const opened = data && openId ? data.packs.find((p) => p.id === openId) : null;

  const step = React.useCallback(
    (dir) => {
      if (!opened) return;
      const list = results.length ? results.map((r) => r.pack) : data.packs;
      const at = list.findIndex((p) => p.id === opened.id);
      const next = list[(at + dir + list.length) % list.length];
      if (next) {
        try {
          window.history.replaceState(null, '', '#' + encodeURIComponent(next.id));
        } catch (err) {
          // Fine: the state below still switches the pack.
        }
        setOpenId(next.id);
      }
    },
    [opened, results, data]
  );

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setStatus('all');
    setSetup('all');
  };
  const filtered = q || category !== 'all' || status !== 'all' || setup !== 'all';

  // Group by category when sorting by category, otherwise one flat grid.
  const groups = useMemo(() => {
    if (sort !== 'category') return [{ name: null, rows: results }];
    const map = new Map();
    for (const r of results) {
      if (!map.has(r.pack.category)) map.set(r.pack.category, []);
      map.get(r.pack.category).push(r);
    }
    return [...map].map(([name, rows]) => ({ name, rows }));
  }, [results, sort]);

  const nextTheme = { auto: 'dark', dark: 'light', light: 'auto' };

  return (
    <div className="page">
      <header className="top">
        <div className="wrap top-row">
          <a className="brand" href="./" onClick={(e) => { e.preventDefault(); clearFilters(); closePack(); window.scrollTo(0, 0); }}>
            <span className="logo" aria-hidden="true" />
            McModels
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTheme(nextTheme[theme] || 'auto')}
            aria-label={'Theme: ' + theme + '. Click to change.'}
          >
            Theme: {theme === 'auto' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Minecraft model packs</h1>
          <p className="lead">Weapons, armor, cosmetics, GUIs and mobs. Browse every pack and see what is inside.</p>
          {data ? (
            <div className="stats">
              <div><b>{data.stats.packs}</b><span>packs</span></div>
              <div><b>{data.stats.items.toLocaleString('en-US')}</b><span>items</span></div>
              <div><b>{data.stats.ok}</b><span>ready to use</span></div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="toolbar">
        <div className="wrap">
          <div className="toolbar-row">
            <input
              type="search"
              className="input search"
              placeholder="Search packs or items, like katana or wings"
              aria-label="Search packs or items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="input" aria-label="Plugin" value={setup} onChange={(e) => setSetup(e.target.value)}>
              <option value="all">All plugins</option>
              {data ? data.setups.map((s) => <option key={s} value={s}>{s}</option>) : null}
            </select>
            <select className="input" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Any status</option>
              <option value="ok">Ready</option>
              <option value="warn">Small issue</option>
              <option value="bad">Not usable</option>
            </select>
            <select className="input" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.keys(SORTS).map((k) => <option key={k} value={k}>Sort: {SORTS[k].label}</option>)}
            </select>
          </div>
          <div className="chips" role="group" aria-label="Category">
            <button type="button" className={'chip' + (category === 'all' ? ' chip-on' : '')} onClick={() => setCategory('all')}>All</button>
            {data ? data.categories.map((c) => (
              <button key={c} type="button" className={'chip' + (category === c ? ' chip-on' : '')} onClick={() => setCategory(c)}>{c}</button>
            )) : null}
          </div>
        </div>
      </div>

      <main className="wrap main">
        {error ? (
          <div className="state-box">
            <h2>Could not load the packs</h2>
            <p className="muted">{error}</p>
            <button type="button" className="btn" onClick={() => window.location.reload()}>Try again</button>
          </div>
        ) : !data ? (
          <div className="grid" aria-busy="true" aria-label="Loading">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card skeleton" />)}
          </div>
        ) : (
          <React.Fragment>
            <p className="count" aria-live="polite">
              {results.length} {results.length === 1 ? 'pack' : 'packs'}
              {filtered ? <button type="button" className="link" onClick={clearFilters}>Clear filters</button> : null}
            </p>
            {!results.length ? (
              <div className="state-box">
                <h2>No packs found</h2>
                <p className="muted">Try another word or clear the filters.</p>
                <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              groups.map((g) => (
                <section key={g.name || 'all'} className="group">
                  {g.name ? <h2 className="group-title">{g.name} <span>{g.rows.length}</span></h2> : null}
                  <div className="grid">
                    {g.rows.map((r) => <PackCard key={r.pack.id} pack={r.pack} matches={r.matches} onOpen={openPack} />)}
                  </div>
                </section>
              ))
            )}
          </React.Fragment>
        )}
      </main>

      <footer className="foot">
        <div className="wrap">Preview catalog. Pack files are not available for download here.</div>
      </footer>

      {opened ? <PackDetail pack={opened} onClose={closePack} onStep={step} /> : null}
    </div>
  );
}
