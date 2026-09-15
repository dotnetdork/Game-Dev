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
let docsPages = null;          // every class/namespace/typedef, for the nav tree and the front page

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
    fetch('/phaser-docs/meta.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch('/phaser-docs/pages.tsv').then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; })
  ]).then(function (all) {
    docsIndex = parseDocsIndex(all[0]);
    docsMeta = all[1];
    docsPages = String(all[2] || '').split('\n').map(function (L) {
      const p = L.split('\t');
      if (p.length < 3) return null;
      return { ln: p[0], nm: p[0].split('.').pop(), k: p[1], p: +p[2] };
    }).filter(Boolean);
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

/* ---------- the glossary ----------
   Phaser's documentation is accurate and is written for people who already know what a viewport is.
   A ten-year-old reading "the texture's frame is cropped to the camera's viewport" meets three
   words they have never seen and gives up on the sentence, not the word.

   So: the words get a dotted underline wherever they appear, and hovering — or tapping, or tabbing
   to — says what they mean in one plain sentence. Nothing is rewritten and nothing is hidden; the
   sentence is still Phaser's. This is the cheapest thing in the whole docs rework and probably the
   one that buys the most, because it works on all twenty thousand pages at once without anybody
   having to write twenty thousand of anything.

   Matched whole-word and case-insensitively, first occurrence in a block only — underlining the
   fortieth "sprite" on a page is noise, and the reader has had the answer thirty-nine times. */
/* THE SAME FILE THE LESSONS USE — content/glossary.yaml, loaded by js/highlight.js. There were
   briefly two lists of terms in this app, which is one more than can ever stay in agreement: a
   word explained one way in a lesson and another way in the docs is worse than a word explained
   once. Jay keeps one file; both surfaces read it.

   The MATCHING differs, and that is the real reason this code exists separately. A lesson bolds a
   term the first time it matters, and that bold is the author saying "this is a thing" — so there,
   only bolded words are glossed. Phaser’s documentation bolds nothing and was written by people
   who assume you know what a viewport is, so here every occurrence is a candidate. */
let docTermsRe = null;
function docTerms() {
  if (typeof loadGlossary !== 'function') return Promise.resolve(null);
  return loadGlossary().then(function (g) {
    if (!g || !Object.keys(g).length) return null;
    if (!docTermsRe) {
      /* Longest first, so "game object" wins over "object" and "blend mode" over "mode". */
      const keys = Object.keys(g).sort(function (x, y) { return y.length - x.length; })
        .map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      docTermsRe = new RegExp('\\b(' + keys.join('|') + ')(s?)\\b', 'gi');
    }
    return g;
  });
}
/* Walks the text nodes of already-rendered, already-sanitised HTML — so it can never turn a word
   inside a tag or inside a code sample into markup. Code is skipped outright: `frame` in a line of
   JavaScript is a variable, not a word needing explaining. */
function glossify(host) {
  if (!host) return;
  docTerms().then(function (g) {
    if (!g || !docTermsRe) return;
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.length < 4) return NodeFilter.FILTER_REJECT;
        /* Never inside code. `frame` in a line of JavaScript is a variable somebody named, not a
           word that wants explaining — and underlining it would make the example look wrong. */
        if (n.parentElement.closest('code, pre, .dc-sig, .dc-type, .dn-item, .dt-item, a, abbr')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const jobs = [];
    let node;
    while ((node = walker.nextNode())) jobs.push(node);
    const seen = {};
    jobs.forEach(function (n) {
      docTermsRe.lastIndex = 0;
      if (!docTermsRe.test(n.nodeValue)) return;
      docTermsRe.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m, made = false;
      while ((m = docTermsRe.exec(n.nodeValue))) {
        const key = m[1].toLowerCase();
        const def = g[key];
        /* Once per page. A hint on the first "sprite" is help; a dotted underline under all forty
           is a page with a rash. */
        if (!def || seen[key]) continue;
        seen[key] = 1;
        frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
        const tag = document.createElement('abbr');
        tag.className = 'dc-term';
        tag.setAttribute('tabindex', '0');
        tag.title = def;
        tag.textContent = m[0];            // m[0] keeps a trailing plural the key does not have
        frag.appendChild(tag);
        last = m.index + m[0].length;
        made = true;
      }
      if (!made) return;
      frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
      n.parentNode.replaceChild(frag, n);
    });
  });
}

/* ---------- rendering ---------- */
function docsKindChip(k) {
  return '<span class="dc-kind dc-' + esc(k) + '">' + esc(k) + '</span>';
}

/* Phaser writes its descriptions in markdown — `code` in backticks, hyphen bullets, blank lines
   between paragraphs — and they were being printed as escaped plain text. So a reader got one
   unbroken wall of words with literal backticks scattered through it, which is how
   Phaser.Actions.AddEffectBloom came out as a 200-word paragraph nobody could get through.

   Run through the same pair the lessons use: marked to parse, DOMPurify to make it safe. The text
   is Phaser's own and is not edited — only delivered properly. */
function docsProse(md) {
  if (!md) return '';
  const html = (typeof mdToSafeHTML === 'function') ? mdToSafeHTML(md) : esc(md);
  return '<div class="dc-prose">' + html + '</div>';
}
/* The same, for the one-liners — a parameter's note, a return value's note. They are single lines
   and must stay single lines, so marked's paragraph wrapper comes off; but they carry backticks
   just as often as the long descriptions do, and leaving those as literal grave accents put 172
   of them on one page of Phaser.Actions alone. */
function docsInline(md) {
  if (!md) return '';
  if (typeof mdToSafeHTML !== 'function') return esc(md);
  return String(mdToSafeHTML(md)).replace(/^\s*<p>/, '').replace(/<\/p>\s*$/, '');
}
/* Code goes in a code block, coloured like the code everywhere else in this app. It was arriving as
   a bare <pre> with no background, so an eight-line example read as part of the prose above it. */
function docsCode(src) {
  return '<pre class="dc-eg cm-s-material-darker"><code>' + esc(src) + '</code></pre>';
}
/* ONE BLOCK PER MEMBER, not one per @example. Phaser often writes three examples in a row and they
   arrived as three separate boxes with gaps between them — which reads as one snippet that has been
   chopped up rather than as three alternatives. Joined with a blank line, the way anybody would
   write them in a file. */
function docsExamples(list) {
  if (!list || !list.length) return '';
  return docsCode(list.map(function (s) { return String(s).trim(); }).join('\n\n'));
}
function paintDocsCode(host) {
  if (typeof paintCode !== 'function') return;
  host.querySelectorAll('.dc-eg code').forEach(function (c) {
    /* The colours live in CodeMirror's theme stylesheet and only apply under its theme class.
       paintCode adds the cm-* class to each token, but without an ancestor carrying
       `cm-s-material-darker` every one of them inherits the same colour — which is why the examples
       were coming out uniformly white despite being fully tokenised. */
    if (!c.closest('.cm-s-material-darker')) c.parentElement.classList.add('cm-s-material-darker');
    try { paintCode(c); } catch (e) { /* colour is a bonus; the code still reads without it */ }
  });
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
      + (p.x ? '<div class="dc-pdesc dc-prose">' + docsInline(p.x) + '</div>' : '')
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
    + docsProse(m.x)
    + (m.t && m.k !== 'function' ? '<div class="dc-line"><b>Type</b> ' + docsType(m.t) + '</div>' : '')
    + docsParams(m.p)
    + (m.r ? '<div class="dc-line"><b>Returns</b> ' + docsType(m.r.t) + (m.r.x ? ' — ' + docsInline(m.r.x) : '') + '</div>' : '')
    + docsExamples(m.eg)
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
  const main = '<div class="phead"><div><h2><span class="mdi mdi-gamepad-variant-outline"></span>Phaser</h2>'
    + '<p class="sub" id="docsSub">The engine your game runs on.</p></div></div>'
    + '<div class="dc-search"><span class="mdi mdi-magnify"></span>'
    + '<input id="docsSearch" type="search" autocomplete="off" spellcheck="false" '
    + 'placeholder="Look up anything — setVelocityX, overlap, Sprite…" aria-label="Search the Phaser API">'
    + '</div><div id="docsResults" class="dc-results" hidden></div>'
    + '<div id="docsBrowse" class="dc-browse"><p class="dc-loading">Loading the reference…</p></div>';
  return docsShell(docsNav(''), main, '');
}

/* ---------- the shell ----------
   A LIST DOWN THE LEFT THAT NEVER GOES AWAY, the page in the middle, and a jump-to rail on the
   right. This is the shape every reference has — Phaser's own, MDN's, every language's — and the
   reason is that documentation is not read, it is navigated: you arrive somewhere, look around, and
   go somewhere else. The cards this replaced made every move a round trip through a front page, so
   getting from one class to a related one meant going back twice. It read as a dictionary because
   it behaved like one: a thing you look a word up in and then close. */
function docsShell(nav, main, toc) {
  return '<div class="dc-shell">'
    + '<aside class="dc-nav">' + nav + '</aside>'
    + '<div class="dc-main">' + main + '</div>'
    + (toc ? '<aside class="dc-toc">' + toc + '</aside>' : '')
    + '</div>';
}
/* The left rail: which reference you are in, then the parts of it. Built from the metadata the
   build writes, so it is there before any page is fetched. */
function docsNav(activeLongname) {
  const shelf = DOC_SHELF.map(function (d) {
    return '<button class="dn-doc' + (docsTopic === d.id ? ' on' : '') + '" data-doc-open="' + esc(d.id) + '">'
      + '<span class="mdi ' + d.mdi + '"></span>' + esc(d.name) + '</button>';
  }).join('');
  if (!docsPages) {
    return '<div class="dn-docs">' + shelf + '</div>'
      + '<div class="dn-head">Phaser</div><p class="dc-loading">Loading…</p>';
  }
  /* GROUPED BY KIND, which is how Phaser's own navigation is arranged: a short list of headings —
     Namespaces, Class, Typedefs — each opening onto a flat alphabetical list of full dotted names.
     Not a namespace tree. A tree looks tidier and is worse here, because the thing a reader is
     hunting is a NAME and a tree makes them guess which branch it is filed under first. */
  const GROUPS = [
    ['class', 'Classes'],
    ['namespace', 'Namespaces'],
    ['typedef', 'Typedefs'],
    ['interface', 'Interfaces'],
    ['mixin', 'Mixins']
  ];
  const by = {};
  docsPages.forEach(function (p) { (by[p.k] || (by[p.k] = [])).push(p); });
  const sections = GROUPS.filter(function (g) { return by[g[0]] && by[g[0]].length; }).map(function (g) {
    const list = by[g[0]];
    const openHere = list.some(function (p) { return p.ln === activeLongname; });
    const open = docsNavOpen[g[0]] === undefined ? openHere : docsNavOpen[g[0]];
    return '<button class="dn-item' + (open ? ' open' : '') + '" data-branch="' + g[0] + '">'
      + '<span class="dn-caret mdi mdi-chevron-right"></span>' + g[1]
      + '<span class="dn-n">' + list.length + '</span></button>'
      + (open ? '<div class="dn-kids">' + list.map(function (p) {
        return '<button class="dn-sub' + (p.ln === activeLongname ? ' on' : '') + '" data-doc="'
          + esc(p.ln) + '">' + esc(p.ln) + '</button>';
      }).join('') + '</div>' : '');
  }).join('');
  return '<div class="dn-docs">' + shelf + '</div>'
    + '<div class="dn-list">'
    + '<button class="dn-item dn-home' + (!activeLongname ? ' on' : '') + '" data-doc-open="phaser">'
    + 'Phaser ' + esc((docsMeta && docsMeta.version) || '') + ' API Documentation</button>'
    + sections + '</div>';
}
/* Which branches the reader has opened by hand. Kept across pages so the nav does not shut itself
   every time they follow a link. */
const docsNavOpen = {};

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
  /* The jump-to rail. On a class with three hundred members, scrolling is not navigation — and this
     is the one thing Phaser's own docs have that made the difference between their page and ours. */
  const tocGroup = function (kind, label) {
    const list = groups[kind] || [];
    if (!list.length) return '';
    return '<div class="dt-head">' + label + '</div>'
      + list.map(function (m) {
        return '<a class="dt-item' + (m.from ? ' dt-inh' : '') + '" href="#'
          + memberDomId(pg.l, m.n) + '" data-jump="' + esc(memberDomId(pg.l, m.n)) + '">'
          + esc(m.n) + '</a>';
      }).join('');
  };
  const toc = tocGroup('member', 'Properties') + tocGroup('constant', 'Constants')
    + tocGroup('function', 'Methods') + tocGroup('event', 'Events');

  const main = '<div class="phead"><div>'
    + '<div class="dc-crumbs">' + (crumbs.join('<span>›</span>') || '&nbsp;') + '</div>'
    + '<h2>' + esc(pg.n) + docsKindChip(pg.k) + '</h2></div></div>'
    + '<div class="dc-page">'
    + docsProse(pg.x)
    /* Phaser builds its game objects out of two dozen mixins, so "Built on" for Sprite is a
       twenty-five-item wall of dotted paths above everything a reader came for. Three, then a count
       that opens the rest — the information is still there, it is just no longer the first and
       largest thing on the page. */
    + (pg.ext && pg.ext.length
      ? '<div class="dc-line dc-ext"><b>Built on</b> ' + docsType(pg.ext.slice(0, 3))
        + (pg.ext.length > 3
          ? ' <button class="dc-more" data-more="dc-ext-rest">and ' + (pg.ext.length - 3) + ' more</button>'
            + '<span id="dc-ext-rest" hidden> ' + docsType(pg.ext.slice(3)) + '</span>'
          : '')
        + '</div>'
      : '')
    + (pg.since ? '<div class="dc-line"><b>Added in Phaser</b> ' + esc(pg.since) + '</div>' : '')
    + (pg.ctor && pg.ctor.p ? '<h3 class="dc-h">Making one</h3>'
        + docsCode('new ' + pg.l + '(' + pg.ctor.p.map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ') + ')')
        + docsParams(pg.ctor.p) : '')
    + (kids ? '<h3 class="dc-h">Inside this</h3><div class="dc-kids">' + kids + '</div>' : '')
    + block('member', 'Properties') + block('constant', 'Constants')
    + block('function', 'Methods') + block('event', 'Events')
    + '</div>';
  return docsShell(docsNav(pg.l), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
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
/* Just the nav's own handlers, so repainting it after a branch opens does not mean re-wiring the
   whole page — and so the nav can be repainted the moment the index arrives. */
function wireDocsNav(host) {
  const nav = host.querySelector('.dc-nav');
  if (!nav) return;
  nav.querySelectorAll('[data-doc-open]').forEach(function (b) {
    b.addEventListener('click', function () { openDocsTopic(b.getAttribute('data-doc-open')); });
  });
  nav.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
  nav.querySelectorAll('[data-branch]').forEach(function (b) {
    b.addEventListener('click', function () {
      docsNavOpen[b.getAttribute('data-branch')] = !b.classList.contains('open');
      nav.innerHTML = docsNav(docsSym || '');
      wireDocsNav(host);
    });
  });
}
function wireDocs() {
  const host = $('page');
  host.querySelectorAll('[data-doc-open]').forEach(function (b) {
    b.addEventListener('click', function () { openDocsTopic(b.getAttribute('data-doc-open')); });
  });
  host.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
  /* Opening and shutting a section of the nav. Repaints the nav only — the page you are reading
     does not move. */
  host.querySelectorAll('[data-branch]').forEach(function (b) {
    b.addEventListener('click', function () {
      const k = b.getAttribute('data-branch');
      docsNavOpen[k] = !b.classList.contains('open');
      const nav = host.querySelector('.dc-nav');
      if (nav) {
        nav.innerHTML = docsNav(docsSym || '');
        wireDocsNav(host);
      }
    });
  });
  host.querySelectorAll('[data-doc-page]').forEach(function (b) {
    b.addEventListener('click', function () {
      loadDocsPage(b.getAttribute('data-doc-page')).then(function (pg) { openDocsSymbol(pg.l); });
    });
  });
  /* The jump-to rail. Scrolls rather than navigating, so the address stays on the page you are
     reading and the back button still means "the last thing I looked at". */
  host.querySelectorAll('[data-jump]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const el = document.getElementById(link.getAttribute('data-jump'));
      if (!el) return;
      host.querySelectorAll('.dc-jumped').forEach(function (x) { x.classList.remove('dc-jumped'); });
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('dc-jumped');
    });
  });
  host.querySelectorAll('[data-more]').forEach(function (b) {
    b.addEventListener('click', function () {
      const rest = document.getElementById(b.getAttribute('data-more'));
      if (!rest) return;
      rest.hidden = !rest.hidden;
      b.textContent = rest.hidden ? b.dataset.shut || b.textContent : 'show fewer';
      if (!b.dataset.shut && rest.hidden === false) b.dataset.shut = b.dataset.shut || '';
    });
    b.dataset.shut = b.textContent;
  });
  paintDocsCode(host);
  glossify(host.querySelector('.dc-main') || host);

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
        /* AND THE NAV. It was rendered once, before any of this had loaded, so it said "Loading…"
           and then said it for ever — the index arriving repainted the middle of the page and never
           told the left rail. That is the "stuck on loading" everybody saw. */
        const nav = $('page').querySelector('.dc-nav');
        if (nav) { nav.innerHTML = docsNav(docsSym || ''); wireDocsNav($('page')); }
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
/* The front page: every page in the reference, grouped by kind, as plain lists of links — which is
   exactly what Phaser's own front page is. It was a grid of thirty-five cards, and a card is a
   promise that there is something to read on it; these are names, and a list is what you scan a
   thousand names in. The cards also sat beside a nav saying the same thirty-five words, so the page
   asked to be read twice. */
function paintBrowse() {
  const browse = $('docsBrowse');
  if (!browse) return;
  if (!docsPages) { browse.innerHTML = '<p class="dc-loading">Loading the reference…</p>'; return; }
  const GROUPS = [
    ['class', 'Classes'],
    ['namespace', 'Namespaces'],
    ['typedef', 'Typedefs'],
    ['interface', 'Interfaces'],
    ['mixin', 'Mixins']
  ];
  const by = {};
  docsPages.forEach(function (p) { (by[p.k] || (by[p.k] = [])).push(p); });
  browse.innerHTML = GROUPS.filter(function (g) { return by[g[0]] && by[g[0]].length; })
    .map(function (g) {
      return '<h3 class="dc-h" id="sec-' + g[0] + '">' + g[1]
        + '<span class="dc-count">' + by[g[0]].length + '</span></h3>'
        + '<ul class="dc-index">' + by[g[0]].map(function (p) {
          return '<li><a data-doc="' + esc(p.ln) + '">' + esc(p.ln) + '</a></li>';
        }).join('') + '</ul>';
    }).join('');
  browse.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
}
