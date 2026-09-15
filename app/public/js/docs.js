/* docs.js — the Docs tab: a shelf of references, and the whole Phaser API inside one of them.
 *
 * WHAT IT REPLACED
 *
 * Twelve hand-written cards and a button that opened phaser.io in a new window. The button was the
 * problem: on a filtered school network it is a dead end, and where it works it drops a
 * twelve-year-old onto a site written for professional developers with no way back to their game.
 * "Nothing should link elsewhere" is the requirement, and the only honest way to meet it is to have
 * the reference here — all of it, not a summary.
 *
 * SO THERE ARE TWO HALVES, and keeping them apart is the point.
 *
 *   Start here   the twelve cards, kept. They were written for children: one idea, three lines of
 *                code, a sentence about when you would want it.
 *   Look it up   Phaser's own documentation. Twenty thousand symbols across a thousand pages,
 *                generated from Phaser's source by tools/build-phaser-docs.js.
 *
 * The second half is not a teaching surface and is not pretending to be one. It is what you reach
 * for when you know the name of the thing and want to know what arguments it takes — which is a
 * real need a beginner has about twice a lesson, and which until now was answered by guessing.
 *
 * HOW IT IS LOADED
 *
 * Nothing fetches until the Phaser shelf is opened. Then: one index, 97 KB gzipped, unpacked in the
 * browser with DecompressionStream — and after that one page at a time, a median of nine kilobytes
 * each, cached. Opening the docs costs a tenth of what one lesson's screenshots cost.
 */

/* ---------- where we are ---------- */
let docsTopic = '';            // '' = the shelf. 'phaser' = the Phaser reference.
let docsSym = '';              // a longname, when an API page is open
let docsQuery = '';

/* The shelf. One entry today and built as a list because the ask was explicitly for more later —
   a second reference is a row here and a renderer, not a rewrite. */
const DOC_SHELF = [
  {
    id: 'phaser', name: 'Phaser', mdi: 'mdi-gamepad-variant-outline',
    tag: 'The game engine',
    blurb: 'Everything your game is made of — sprites, physics, input, sound, cameras and the rest. '
      + 'The beginner cards, plus Phaser’s complete API reference.',
    ready: true
  }
];

/* ---------- the index ----------
   Fetched once, kept for the session. Three tab-separated columns — longname, kind, page id — and
   the short name is split back out here rather than carried, because it is always the last dotted
   piece and repeating it cost a quarter of the file. */
let docsIndex = null;
let docsIndexLoading = null;
let docsMeta = null;

function parseDocsIndex(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L) continue;
    const a = L.indexOf('\t'); if (a < 0) continue;
    const b = L.indexOf('\t', a + 1); if (b < 0) continue;
    const ln = L.slice(0, a);
    /* Members are written `Owner#method` or `Owner.CONST`; a page is the bare longname. Either way
       the name a child types is what follows the last separator. */
    let cut = ln.lastIndexOf('#');
    const dot = ln.lastIndexOf('.');
    if (dot > cut) cut = dot;
    out.push({
      ln: ln,
      nm: cut >= 0 ? ln.slice(cut + 1) : ln,
      k: L.slice(a + 1, b),
      p: +L.slice(b + 1)
    });
  }
  return out;
}
function loadDocsIndex() {
  if (docsIndex) return Promise.resolve(docsIndex);
  if (docsIndexLoading) return docsIndexLoading;
  /* The gzipped copy first, unpacked by the browser. There is no compression middleware in this
     app — its dependency list is four packages and stays that way — so a megabyte of plain text
     would go over a school connection raw. Every machine this runs on is a Chromebook and Chrome
     has had DecompressionStream since 80; anything that has not falls through to the plain file. */
  const plain = function () {
    return fetch('/phaser-docs/index.tsv').then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  };
  const gzipped = function () {
    if (typeof DecompressionStream !== 'function') return plain();
    return fetch('/phaser-docs/index.tsv.gz').then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
    }).catch(plain);
  };
  docsIndexLoading = Promise.all([
    gzipped(),
    fetch('/phaser-docs/meta.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
  ]).then(function (both) {
    docsIndex = parseDocsIndex(both[0]);
    docsMeta = both[1];
    return docsIndex;
  }).catch(function (e) {
    docsIndexLoading = null;
    throw e;
  });
  return docsIndexLoading;
}

const docsPageCache = {};
function loadDocsPage(id) {
  if (docsPageCache[id]) return Promise.resolve(docsPageCache[id]);
  return fetch('/phaser-docs/pages/' + encodeURIComponent(id) + '.json')
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { docsPageCache[id] = j; return j; });
}

/* ---------- search ----------
   Not a search engine. What a child types is a piece of an identifier — "velocity", "overlap",
   "setScale" — and a real index would stem and tokenise those into nonsense: lunr would cut
   `setCollideWorldBounds` into "set", "collid", "world", "bound" and match half of Phaser.

   So: rank by how the query sits in the NAME first and the full path second, and let a subsequence
   match at the bottom catch `scwb` → setCollideWorldBounds. Twenty thousand short strings is a
   couple of milliseconds even on a Chromebook, so there is nothing to build and nothing to keep in
   step with the data. */
const KIND_RANK = { class: 0, namespace: 1, function: 2, member: 3, constant: 4, event: 5, typedef: 6 };
function subseq(hay, needle) {
  let i = 0;
  for (let k = 0; k < hay.length && i < needle.length; k++) if (hay[k] === needle[i]) i++;
  return i === needle.length;
}
function searchDocs(q, limit) {
  if (!docsIndex) return [];
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  const hits = [];
  for (let i = 0; i < docsIndex.length; i++) {
    const e = docsIndex[i];
    const nm = e.nm.toLowerCase();
    let score;
    if (nm === s) score = 0;
    else if (nm.indexOf(s) === 0) score = 1;
    else if (nm.indexOf(s) > 0) score = 2;
    else {
      const ln = e.ln.toLowerCase();
      if (ln.indexOf(s) >= 0) score = 3;
      else if (s.length >= 2 && subseq(nm, s)) score = 4;
      else continue;
    }
    /* A class beats a method of the same name, and a short name beats a long one — searching
       "sprite" should offer Sprite before Sprite3DPluginConfigurationFactory. */
    hits.push({ e: e, s: score * 1000 + (KIND_RANK[e.k] === undefined ? 8 : KIND_RANK[e.k]) * 60 + Math.min(nm.length, 59) });
    if (hits.length > 4000) break;          // a one-letter query must not walk the whole file twice
  }
  hits.sort(function (a, b) { return a.s - b.s; });
  return hits.slice(0, limit || 40).map(function (h) { return h.e; });
}

/* ---------- rendering ---------- */
function docsKindChip(k) {
  return '<span class="dc-kind dc-' + esc(k) + '">' + esc(k) + '</span>';
}
/* A type, as Phaser writes it. Linked when it is something in the index, so a reader can walk from
   a method's return value to the class it returns. */
function docsType(names) {
  if (!names || !names.length) return '';
  return names.map(function (t) {
    const bare = String(t).replace(/^Array\.</, '').replace(/>$/, '');
    const known = docsIndex && docsIndex.some(function (e) { return e.ln === bare && e.p >= 0; });
    return known ? '<a class="dc-type" data-doc="' + esc(bare) + '">' + esc(t) + '</a>'
      : '<span class="dc-type">' + esc(t) + '</span>';
  }).join(' | ');
}
function docsParams(ps) {
  if (!ps || !ps.length) return '';
  return '<ul class="dc-params">' + ps.map(function (p) {
    return '<li><code>' + esc(p.n) + '</code>'
      + (p.o ? '<span class="dc-opt">optional</span>' : '')
      + (p.t ? ' ' + docsType(p.t) : '')
      + (p.d !== undefined ? ' <span class="dc-def">= ' + esc(p.d) + '</span>' : '')
      + (p.x ? '<div class="dc-pdesc">' + esc(p.x) + '</div>' : '')
      + '</li>';
  }).join('') + '</ul>';
}
function docsSignature(m) {
  if (m.k !== 'function') return '';
  const args = (m.p || []).map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ');
  return '<code class="dc-sig">' + esc(m.n) + '(' + esc(args) + ')</code>';
}
/* One id scheme, written once, because the page builds these and the jump-to-member looks them up
   and the two silently disagreeing is a link that does nothing. */
function memberDomId(owner, name) {
  return 'sym-' + String(owner + '-' + name).replace(/[^A-Za-z0-9_-]/g, '-');
}
function docsMember(m, owner) {
  const id = memberDomId(owner, m.n);
  return '<div class="dc-member" id="' + id + '">'
    + '<div class="dc-mhead">' + (docsSignature(m) || '<code class="dc-sig">' + esc(m.n) + '</code>')
    + docsKindChip(m.k)
    + (m.s ? '<span class="dc-flag">static</span>' : '')
    + (m.ro ? '<span class="dc-flag">read-only</span>' : '')
    /* The CLASS it came from, not the method name again. `inherits` reads
       "Phaser.Physics.Arcade.Components.Velocity#setVelocityX", and splitting that on every dot and
       hash popped "setVelocityX" — so a hundred inherited members each announced "from" followed by
       their own name, which is no information at all. */
    + (m.from ? '<span class="dc-flag dc-inh">from ' + esc(String(m.from).split('#')[0].split('.').pop()) + '</span>' : '')
    + '</div>'
    + (m.x ? '<p class="dc-mdesc">' + esc(m.x) + '</p>' : '')
    + (m.t && m.k !== 'function' ? '<div class="dc-line"><b>Type</b> ' + docsType(m.t) + '</div>' : '')
    + docsParams(m.p)
    + (m.r ? '<div class="dc-line"><b>Returns</b> ' + docsType(m.r.t) + (m.r.x ? ' — ' + esc(m.r.x) : '') + '</div>' : '')
    + (m.eg ? m.eg.map(function (e) { return '<pre class="dc-eg">' + esc(e) + '</pre>'; }).join('') : '')
    + '</div>';
}

/* The shelf. */
function renderDocsShelf() {
  const cards = DOC_SHELF.map(function (d) {
    return '<button class="doc-card" data-doc-open="' + esc(d.id) + '">'
      + '<span class="dcd-icon"><span class="mdi ' + d.mdi + '"></span></span>'
      + '<span class="dcd-body"><span class="dcd-name">' + esc(d.name) + '</span>'
      + '<span class="dcd-tag">' + esc(d.tag) + '</span>'
      + '<span class="dcd-blurb">' + esc(d.blurb) + '</span></span></button>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-book-open-variant"></span>Docs</h2>'
    + '<p class="sub">References you can read without leaving the app.</p></div></div>'
    + '<div class="doc-shelf">' + cards + '</div>';
}

/* The Phaser reference. Search, then everything.
   There used to be a "Start here" block under this — the twelve hand-written beginner cards the
   Docs tab was before it had the real reference in it. They went because this page is the complete
   documentation now and a curated dozen sitting under it made it look like a summary with the
   documentation hidden somewhere else. What those cards were for — a way in for a reader who does
   not yet know a name to type — is the Browse section's job, and Browse covers all of Phaser rather
   than the twelve things somebody picked. */
function renderPhaserDocs() {
  return '<div class="phead"><div><h2><span class="mdi mdi-gamepad-variant-outline"></span>Phaser</h2>'
    + '<p class="sub" id="docsSub">The engine your game runs on.</p></div>'
    + '<button class="gbtn" data-doc-open=""><span class="mdi mdi-arrow-left"></span>All docs</button></div>'

    + '<div class="dc-search"><span class="mdi mdi-magnify"></span>'
    + '<input id="docsSearch" type="search" autocomplete="off" spellcheck="false" '
    + 'placeholder="Look up anything — setVelocityX, overlap, Sprite…" aria-label="Search the Phaser API">'
    + '</div><div id="docsResults" class="dc-results" hidden></div>'

    + '<div id="docsBrowse" class="dc-browse"><p class="dc-loading">Loading the reference…</p></div>';
}

/* One API page. */
function renderDocsPage(pg) {
  const groups = { member: [], constant: [], function: [], event: [] };
  (pg.m || []).forEach(function (m) { (groups[m.k] || (groups[m.k] = [])).push(m); });
  const block = function (kind, label) {
    const list = groups[kind] || [];
    if (!list.length) return '';
    return '<h3 class="dc-h">' + label + ' <span class="dc-count">' + list.length + '</span></h3>'
      + list.map(function (m) { return docsMember(m, pg.l); }).join('');
  };
  const kids = (pg.kids || []).map(function (k) {
    return '<button class="dc-kid" data-doc-page="' + k[2] + '">' + esc(k[0]) + docsKindChip(k[1]) + '</button>';
  }).join('');
  const crumbs = [];
  if (pg.mo) {
    const parts = String(pg.mo).split('.');
    let acc = '';
    parts.forEach(function (p) {
      acc = acc ? acc + '.' + p : p;
      crumbs.push('<a data-doc="' + esc(acc) + '">' + esc(p) + '</a>');
    });
  }
  return '<div class="phead"><div>'
    + '<div class="dc-crumbs">' + (crumbs.join('<span>›</span>') || '&nbsp;') + '</div>'
    + '<h2><span class="mdi mdi-code-braces"></span>' + esc(pg.n) + docsKindChip(pg.k) + '</h2>'
    + (pg.x ? '<p class="sub">' + esc(pg.x) + '</p>' : '') + '</div>'
    + '<button class="gbtn" data-doc-open="phaser"><span class="mdi mdi-arrow-left"></span>Phaser docs</button></div>'
    + '<div class="dc-page">'
    + (pg.ext && pg.ext.length ? '<div class="dc-line"><b>Extends</b> ' + docsType(pg.ext) + '</div>' : '')
    + (pg.since ? '<div class="dc-line"><b>Since</b> ' + esc(pg.since) + '</div>' : '')
    + (pg.ctor && pg.ctor.p ? '<h3 class="dc-h">Making one</h3><code class="dc-sig">new ' + esc(pg.l)
        + '(' + esc(pg.ctor.p.map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ')) + ')</code>'
        + docsParams(pg.ctor.p) : '')
    + (kids ? '<h3 class="dc-h">Inside this</h3><div class="dc-kids">' + kids + '</div>' : '')
    + block('member', 'Properties') + block('constant', 'Constants')
    + block('function', 'Methods') + block('event', 'Events')
    + '</div>';
}

/* ---------- the page, whichever of the three it currently is ---------- */
function renderDocs() {
  if (!docsTopic) return renderDocsShelf();
  if (docsSym) return '<div class="dc-loading">Loading…</div>';
  return renderPhaserDocs();
}

/* Opening a symbol is asynchronous, so it paints a frame of "loading" and then replaces itself. */
function openDocsSymbol(longname) {
  docsTopic = 'phaser'; docsSym = longname;
  const host = $('page');
  loadDocsIndex().then(function (idx) {
    const hit = idx.filter(function (e) { return e.ln === longname; })[0]
      || idx.filter(function (e) { return e.ln.split(/[.#]/).pop() === longname; })[0];
    if (!hit) throw new Error('not found');
    return loadDocsPage(hit.p);
  }).then(function (pg) {
    if (docsSym !== longname) return;              // the reader moved on while this was in flight
    host.innerHTML = renderDocsPage(pg);
    wireDocs();
    /* A member's address opens its class — there is nowhere else for it to live — and then goes to
       the member. Without this, searching "setVelocityX" and pressing the result landed a reader at
       the top of a class with 319 things on it and left them to find the one they asked for. */
    let jumped = false;
    if (longname !== pg.l) {
      const member = longname.indexOf('#') >= 0
        ? longname.slice(longname.lastIndexOf('#') + 1)
        : longname.slice(pg.l.length + 1);
      const el = member && document.getElementById(memberDomId(pg.l, member));
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('dc-jumped');
        jumped = true;
      }
    }
    if (!jumped) host.scrollTop = 0;
    if (typeof syncRoute === 'function') syncRoute();
  }).catch(function () {
    if (docsSym !== longname) return;
    host.innerHTML = '<div class="phead"><div><h2>Not found</h2>'
      + '<p class="sub">There is nothing in the Phaser reference called <code>' + esc(longname) + '</code>.</p></div>'
      + '<button class="gbtn" data-doc-open="phaser"><span class="mdi mdi-arrow-left"></span>Phaser docs</button></div>';
    wireDocs();
  });
}
function openDocsTopic(id) {
  docsTopic = id || ''; docsSym = ''; docsQuery = '';
  showPage('docs');
}

/* ---------- wiring ---------- */
function wireDocs() {
  const host = $('page');
  host.querySelectorAll('[data-doc-open]').forEach(function (b) {
    b.addEventListener('click', function () { openDocsTopic(b.getAttribute('data-doc-open')); });
  });
  host.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
  host.querySelectorAll('[data-doc-page]').forEach(function (b) {
    b.addEventListener('click', function () {
      loadDocsPage(b.getAttribute('data-doc-page')).then(function (pg) { openDocsSymbol(pg.l); });
    });
  });
  host.querySelectorAll('[data-goto]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const el = document.getElementById('doc-' + link.getAttribute('data-goto'));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const box = $('docsSearch');
  if (box) {
    const results = $('docsResults');
    const browse = $('docsBrowse');
    /* The index is a megabyte; fetching it the moment the page opens would stall the beginner cards
       for no reason. It is asked for on the first keystroke and on idle, whichever comes first. */
    let warmed = false;
    const warm = function () {
      if (warmed) return; warmed = true;
      loadDocsIndex().then(function () {
        paintBrowse();
        const sub = $('docsSub');
        if (sub && docsMeta) sub.textContent = 'The engine your game runs on — Phaser '
          + docsMeta.version + ', ' + docsMeta.symbols.toLocaleString() + ' things you can look up.';
      }).catch(function () {
        if (browse) browse.innerHTML = '<p class="dc-warn">The reference could not be loaded. '
          + 'The cards below still work.</p>';
      });
    };
    box.addEventListener('focus', warm);
    box.addEventListener('input', function () {
      warm();
      docsQuery = box.value;
      const q = box.value.trim();
      if (!q) { results.hidden = true; results.innerHTML = ''; if (browse) browse.hidden = false; return; }
      if (!docsIndex) { results.hidden = false; results.innerHTML = '<p class="dc-loading">Loading the reference…</p>'; return; }
      const hits = searchDocs(q, 40);
      if (browse) browse.hidden = true;
      results.hidden = false;
      results.innerHTML = hits.length
        ? hits.map(function (e) {
          return '<button class="dc-hit" data-doc="' + esc(e.ln) + '">'
            + '<span class="dc-hname">' + esc(e.nm) + '</span>' + docsKindChip(e.k)
            + '<span class="dc-hpath">' + esc(e.ln) + '</span></button>';
        }).join('')
        : '<p class="dc-none">Nothing in Phaser is called “' + esc(q) + '”.</p>';
      results.querySelectorAll('[data-doc]').forEach(function (b) {
        b.addEventListener('click', function () { openDocsSymbol(b.getAttribute('data-doc')); });
      });
    });
    if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1500);
  }
}

/* The way in for a reader who does not yet know a name to search for.
   Every top-level part of Phaser, each saying what it holds and how much of it — because "Geom" and
   "Structs" and "Utils" mean nothing to a twelve-year-old, and thirty identical chips in a row is a
   thing you read every time rather than learn once. */
function paintBrowse() {
  const browse = $('docsBrowse');
  if (!browse) return;
  const tops = (docsMeta && docsMeta.tops) || [];
  if (!tops.length) { browse.innerHTML = ''; return; }
  browse.innerHTML = '<h3 class="dc-h">Everything in Phaser <span class="dc-count">'
    + tops.length + ' parts</span></h3>'
    + '<div class="dc-tops">' + tops.map(function (t) {
      const size = t.c ? t.c + (t.c === 1 ? ' thing' : ' things') + ' inside'
        : (t.m ? t.m + ' to look up' : '');
      return '<button class="dc-top" data-doc="' + esc(t.l) + '">'
        + '<span class="dc-tname">' + esc(t.n) + docsKindChip(t.k) + '</span>'
        + (t.x ? '<span class="dc-tx">' + esc(t.x) + '</span>' : '')
        + (size ? '<span class="dc-tn">' + esc(size) + '</span>' : '')
        + '</button>';
    }).join('') + '</div>';
  browse.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function () { openDocsSymbol(b.getAttribute('data-doc')); });
  });
}
