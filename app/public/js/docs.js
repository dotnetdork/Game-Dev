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
let docsGroupId = '';          // a group id, when one of the index pages is open
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
        /* Never inside code, and never inside a HEADING — underlining "Events" in the title
           "Phaser.Animations.Events" broke the name in half and put a tooltip on part of it. A
           heading is a label, not prose. */
        if (n.parentElement.closest('code, pre, h1, h2, h3, h4, .phead, .dc-sig, .dc-type, .dc-crumbs, .dc-lab, .dc-ver, .dc-src, th, .dn-item, .dt-item, a, abbr')) {
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
/* A TABLE, with Phaser's own four columns — name, type, optional, description — because that is
   what its documentation prints and because a parameter list is tabular data: four facts about each
   of several things, compared down the columns. It was an indented bullet list, which makes "is
   this one optional?" a question you answer by reading rather than by looking. */
function docsParams(ps) {
  if (!ps || !ps.length) return '';
  return '<div class="dc-tablewrap"><table class="dc-table"><thead><tr>'
    + '<th>name</th><th>type</th><th>optional</th><th>description</th></tr></thead><tbody>'
    + ps.map(function (p) {
      return '<tr><td><code>' + esc(p.n) + '</code></td>'
        + '<td>' + (p.t ? docsType(p.t) : '') + '</td>'
        + '<td>' + (p.o ? 'Yes' : 'No')
        + (p.d !== undefined ? ' <span class="dc-def">= ' + esc(p.d) + '</span>' : '') + '</td>'
        + '<td class="dc-prose">' + (p.x ? docsInline(p.x) : '') + '</td></tr>';
    }).join('')
    + '</tbody></table></div>';
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
    /* Phaser labels each block — "Description:", "Parameters:" — rather than letting the prose and
       the table run together, and on a page of three hundred members those labels are most of what
       makes it skimmable. */
    + (m.x ? '<div class="dc-lab">Description:</div>' + docsProse(m.x) : '')
    + (m.t && m.k !== 'function' ? '<div class="dc-line"><b>Type</b> ' + docsType(m.t) + '</div>' : '')
    + (m.p && m.p.length ? '<div class="dc-lab">Parameters:</div>' + docsParams(m.p) : '')
    + (m.r ? '<div class="dc-line"><b>Returns</b> ' + docsType(m.r.t) + (m.r.x ? ' — ' + docsInline(m.r.x) : '') + '</div>' : '')
    + docsSource(m.src)
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
function docsNav(activeLongname, activeGroup) {
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
  /* ONE SECTION OPEN AT A TIME. Every group used to decide for itself whether it contained the page
     you were on, and Phaser.Actions is in two of them — it is a namespace, and it is also one of the
     nineteen namespaces that hold static functions — so arriving there opened Namespaces AND
     Functions, with the same row highlighted in both. Which is confusing in the ordinary way and
     also doubles the length of the rail.

     So: the first group that actually contains the page wins, and the groups are in an order where
     the truthful home comes first — Phaser.Actions IS a namespace; it merely CONTAINS functions.
     Pressing a heading opens that one and shuts whatever was open, which is what the accordion in
     Phaser's own nav does. */
  const groups = docsRailGroups();
  let autoOpen = '';
  for (let i = 0; i < groups.length && !autoOpen; i++) {
    if (!groups[i].leaf && groups[i].list.some(function (p) { return p.ln === activeLongname; })) {
      autoOpen = groups[i].id;
    }
  }
  const openId = docsNavOpenId === undefined ? autoOpen : docsNavOpenId;
  const sections = groups.map(function (g) {
    /* A leaf — Game Objects, Physics — is a link to that namespace's own page, the way Phaser's
       nav has them: no chevron, nothing to open. */
    if (g.flat) {
      return '<button class="dn-item' + (activeGroup === g.id ? ' on' : '') + '" data-group="'
        + esc(g.id) + '">' + esc(g.label) + '</button>';
    }
    const open = openId === g.id;
    /* EVERY name, not a page of them. Phaser's nav lists all of its eleven thousand functions and
       so does this one; `content-visibility` on the rows means the browser only lays out the ones
       actually on screen, which is what makes that affordable without inventing a filter box the
       real thing does not have. Searching lives in one place — the box at the top right. */
    const body = open
      ? '<div class="dn-kids">' + g.list.map(function (p) {
        return '<button class="dn-sub' + (p.ln === activeLongname ? ' on' : '') + '" data-doc="'
          + esc(p.ln) + '">' + esc(p.ln) + '</button>';
      }).join('') + '</div>'
      : '';
    /* The chevron sits on the RIGHT, where Phaser's does, and there is no count beside it. A number
       next to every heading is a fact nobody needs at the moment of choosing where to go, and it
       was the only thing in the rail competing with the names for attention. */
    return '<button class="dn-item' + (open ? ' open' : '')
      + (activeGroup === g.id ? ' on' : '') + '" data-group="' + esc(g.id) + '">'
      + esc(g.label) + '<span class="dn-caret mdi mdi-chevron-right"></span></button>' + body;
  }).join('');
  return '<div class="dn-docs">' + shelf + '</div>'
    + '<div class="dn-list">'
    + '<button class="dn-item dn-home' + (!activeLongname ? ' on' : '') + '" data-doc-open="phaser">'
    + 'Phaser ' + esc((docsMeta && docsMeta.version) || '') + ' API Documentation</button>'
    + sections + '</div>';
}

/* EVERY GROUP PHASER'S OWN NAV HAS, in its order. Three of them — Events, Functions, Constants —
   are not pages in this model but members of them, so they are gathered out of the search index
   rather than the page list; clicking one still opens the page it lives on and jumps to it. Game
   Objects and Physics are the two Phaser pulls out as direct links because they are where anybody
   building a game actually goes. */
let docsGroupCache = null;
function docsGroups() {
  /* Not cached until there is something to cache. The first call can land before the index has
     arrived, and caching that answer froze the groups at empty for the rest of the session — the
     rail rendered, the group pages rendered, and both were blank for ever. */
  if (!docsPages || !docsIndex) return [];
  if (docsGroupCache) return docsGroupCache;
  const byKind = {};
  (docsPages || []).forEach(function (p) { (byKind[p.k] || (byKind[p.k] = [])).push(p); });
  const isPage = {};
  (docsPages || []).forEach(function (p) { isPage[p.ln] = 1; });
  const ev = [], fn = [], co = [];
  (docsIndex || []).forEach(function (e) {
    if (isPage[e.ln]) return;
    if (e.k === 'event') ev.push(e);
    else if (e.k === 'function') fn.push(e);
    else if (e.k === 'constant') co.push(e);
  });
  const byName = function (a, b) { return a.ln < b.ln ? -1 : a.ln > b.ln ? 1 : 0; };

  /* THESE THREE GROUPS LIST NAMESPACES, NOT MEMBERS, and that is what Phaser's own nav does.
     Opening Functions gave eleven thousand three hundred individual method names; Phaser gives
     nineteen — Phaser.Actions, Phaser.Core, Phaser.Curves and so on — because "Functions" there
     means the STATIC utility functions a namespace offers, not every method on every class. Rolled
     up to the namespace, that is 699 functions across exactly the nineteen names Phaser lists, in
     the same order. Instance methods are excluded by the separator: the index writes a static
     member as `Owner.name` and an instance one as `Owner#name`.

     Events keep their full owner, because those owners already ARE the namespaces Phaser lists —
     Phaser.Animations.Events, Phaser.Cache.Events, and nineteen more. */
  const ownerOf = function (ln) {
    const cut = Math.max(ln.lastIndexOf('#'), ln.lastIndexOf('.'));
    return cut > 0 ? ln.slice(0, cut) : ln;
  };
  const owners = function (entries, roll) {
    const seen = {}, out = [];
    entries.forEach(function (e) {
      let o = ownerOf(e.ln);
      if (roll) o = o.split('.').slice(0, 2).join('.');
      if (seen[o] || !o) return;
      seen[o] = 1;
      out.push({ ln: o, nm: o.split('.').pop(), k: 'namespace', p: -1 });
    });
    return out.sort(byName);
  };
  const under = function (prefix) {
    return (docsPages || []).filter(function (p) { return p.ln.indexOf(prefix) === 0; });
  };
  const out = [
    { id: 'namespace', label: 'Namespaces', list: (byKind.namespace || []).slice().sort(byName) },
    /* No chevron on these two in Phaser's rail; their page is an index split into sections. */
    { id: 'gameobjects', label: 'Game Objects', flat: true, root: 'Phaser.GameObjects',
      /* "Game Object Classes" is everything that is not a function — Phaser files the sub-namespaces
         Components, Events, Particles and RetroFont under it too. Checked by diffing against their
         own page: all 58 of their entries are in this set, and the four extra here (CustomContext,
         Mesh2D, Stencil, StencilReference) are new in 4.2.1 and simply do not exist in the 4.1.0
         page being compared against. */
      byKind: [['!function', 'Game Object Classes'], ['function', 'Game Object Functions']],
      list: under('Phaser.GameObjects') },
    { id: 'physics', label: 'Physics', flat: true, root: 'Phaser.Physics',
      byNamespace: true, sectionSuffix: ' Physics', list: under('Phaser.Physics') },
    { id: 'event', label: 'Events', list: owners(ev, false) },
    { id: 'class', label: 'Class', list: (byKind.class || []).slice().sort(byName) },
    { id: 'function', label: 'Functions', list: owners(fn.filter(function (e) { return e.ln.indexOf('#') < 0; }), true) },
    { id: 'constant', label: 'Constants', list: owners(co, true) },
    { id: 'typedef', label: 'Typedefs', list: (byKind.typedef || []).slice().sort(byName) },
    /* Not a rail group — the front page's Typedefs section lists the NAMESPACES that hold typedefs,
       the way its Constants and Events sections do, and Phaser counts fifty-seven of them. The rail
       lists the typedef pages themselves. */
    { id: 'typedef-owners', label: 'Typedefs', hidden: true,
      /* Only the typedefs that HAVE an owner. Nineteen of Phaser's are global — Attachment,
         BaseShaderConfig, CenterFunction — with no dot in the name, and asking for the part before
         the dot handed back the name itself, so each invented a namespace of its own and the
         section came out at 75 against Phaser's 56. */
      list: owners((docsPages || []).filter(function (p) {
        return p.k === 'typedef' && p.ln.indexOf('.') > 0;
      }).map(function (p) { return { ln: p.ln }; }), false) },
    { id: 'interface', label: 'Interfaces', list: (byKind.interface || []).slice().sort(byName) },
    { id: 'mixin', label: 'Mixins', list: (byKind.mixin || []).slice().sort(byName) }
  ].filter(function (g) { return g.list.length; });
  docsGroupCache = out;
  return out;
}
/* The rail shows only the groups meant to be navigated; `hidden` ones exist to feed the front page. */
function docsRailGroups() {
  return docsGroups().filter(function (g) { return !g.hidden; });
}
/* Which section the reader opened by hand: a group id, '' for none, or undefined meaning "nobody has
   chosen, so open whichever holds the page they are on". Kept across pages so the nav does not shut
   itself every time they follow a link. */
let docsNavOpenId;

/* ---------- a group's own page ----------
   Pressing Functions in Phaser's nav does not only open a list in the rail — it OPENS A PAGE, and
   that page is the index of everything in the group. Physics is the clearest case: its page lists
   all forty-six things under it, in two sections, Arcade Physics and Matter Physics, and every
   constant and helper function alongside the classes. Ours showed two links, because it was
   listing only the direct children that happened to be pages.

   So these are real pages with real addresses, and a heading in the rail goes to one. */
function directChildren(prefix) {
  const pre = prefix + '.';
  const seen = {}, out = [];
  const take = function (ln, k, id) {
    if (ln.indexOf(pre) !== 0) return;
    if (ln.slice(pre.length).indexOf('.') >= 0) return;   // one level down only, as Phaser lists it
    if (seen[ln]) return;
    seen[ln] = 1;
    out.push({ ln: ln, k: k, p: id });
  };
  (docsPages || []).forEach(function (p) { take(p.ln, p.k, p.p); });
  /* Constants and static helpers are pages nowhere, but Phaser lists them here — DYNAMIC_BODY,
     GetCollidesWith, SeparateX — and leaving them out is most of why our Physics page was empty. */
  (docsIndex || []).forEach(function (e) {
    if (e.ln.indexOf('#') >= 0) return;
    take(e.ln, e.k, e.p);
  });
  return out.sort(function (a, b) { return a.ln < b.ln ? -1 : a.ln > b.ln ? 1 : 0; });
}
function docsIndexList(items) {
  return '<ul class="dc-index">' + items.map(function (i) {
    return '<li><a data-doc="' + esc(i.ln) + '">' + esc(i.ln) + '</a></li>';
  }).join('') + '</ul>';
}
function renderDocsGroup(g) {
  /* The two split pages split DIFFERENTLY, and both were checked against docs.phaser.io rather than
     guessed at. Game Objects is two sections by KIND — "Game Object Classes" (58 of them) and
     "Game Object Functions" (5) — and lists neither its sub-namespaces nor its constants. Physics is
     two sections by SUB-NAMESPACE — "Arcade Physics", "Matter Physics" — and each lists every direct
     child whatever its kind, constants and helper functions included. */
  let body = '', toc = '';
  const section = function (id, label, items) {
    if (!items.length) return '';
    toc += '<a class="dt-item" href="#sec-' + esc(id) + '" data-jump="sec-' + esc(id) + '">' + esc(label) + '</a>';
    return '<h2 class="dc-h2" id="sec-' + esc(id) + '">' + esc(label) + '</h2>' + docsIndexList(items);
  };
  if (g.byKind) {
    const kids = directChildren(g.root);
    body = g.byKind.map(function (s) {
      const want = s[0];
      const not = want.charAt(0) === '!';
      const kind = not ? want.slice(1) : want;
      return section(kind, s[1], kids.filter(function (k) { return not ? k.k !== kind : k.k === kind; }));
    }).join('');
  } else if (g.byNamespace) {
    const pre = g.root + '.';
    body = (docsPages || []).filter(function (p) {
      return p.k === 'namespace' && p.ln.indexOf(pre) === 0 && p.ln.slice(pre.length).indexOf('.') < 0;
    }).sort(function (a, b) { return a.ln < b.ln ? -1 : 1; })
      .map(function (s) { return section(s.nm, s.nm + (g.sectionSuffix || ''), directChildren(s.ln)); })
      .join('');
  } else {
    body = docsIndexList(g.list);
  }
  if (!body) body = docsIndexList(directChildren(g.root || ''));
  const main = '<div class="phead"><div>'
    + '<div class="dc-crumbs"><a data-doc-open="phaser">Phaser API Documentation</a></div>'
    + '<h2>' + esc(g.label) + '</h2></div>'
    + docsSearchBox() + '</div><div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">' + body + '</div>';
  return docsShell(docsNav('', g.id), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}
/* The source line, linking where Phaser's links: the exact file and line on GitHub, at the tag for
   the version this reference was generated from. Jay asked for it explicitly, and it is the one
   outward link in the docs — a pointer at the engine's own source, not a place a student gets lost.
   It opens in a new tab so it never takes them out of their game. */
function docsSource(src) {
  if (!src) return '';
  const v = (docsMeta && docsMeta.version) || '';
  const href = 'https://github.com/phaserjs/phaser/blob/v' + v + '/' + src;
  return '<div class="dc-src">Source: <a href="' + esc(href) + '" target="_blank" rel="noopener">'
    + esc(src) + '</a></div>';
}
function docsSearchBox() {
  return '<div class="dc-search dc-search-sm"><span class="mdi mdi-magnify"></span>'
    + '<input id="docsSearch" type="search" autocomplete="off" spellcheck="false" '
    + 'placeholder="Search Phaser…" aria-label="Search the Phaser API"></div>';
}

/* One API page. */
function renderDocsPage(pg) {
  const groups = { member: [], constant: [], function: [], event: [] };
  (pg.m || []).forEach(function (m) { (groups[m.k] || (groups[m.k] = [])).push(m); });
  /* PHASER'S OWN SECTION NAMES, and its own split. A class page there reads "Public Members",
     "Inherited Members", "Public Methods", "Inherited Methods" — the class's own things first, then
     what it got from elsewhere, gathered under a "From Phaser.GameObjects.Components.Alpha:" label
     for each source. Ours listed everything together with a small "from" chip on each row, which on
     Sprite means 242 of the 319 rows carry a chip and the seventy-seven that are actually Sprite's
     own are lost in them. */
  const block = function (kind, label) {
    const list = (groups[kind] || []).filter(function (m) { return !m.from; });
    if (!list.length) return '';
    return '<h2 class="dc-h2" id="sec-' + esc(label.replace(/\s+/g, '-')) + '">' + esc(label) + '</h2>'
      + list.map(function (m) { return docsMember(m, pg.l); }).join('');
  };
  const inherited = function (kind, label) {
    const list = (groups[kind] || []).filter(function (m) { return !!m.from; });
    if (!list.length) return '';
    const by = {};
    list.forEach(function (m) {
      const src = String(m.from).split('#')[0];
      (by[src] || (by[src] = [])).push(m);
    });
    return '<h2 class="dc-h2" id="sec-' + esc(label.replace(/\s+/g, '-')) + '">' + esc(label) + '</h2>'
      + Object.keys(by).sort().map(function (src) {
        return '<div class="dc-lab dc-from">From <a data-doc="' + esc(src) + '">' + esc(src) + '</a>:</div>'
          + by[src].map(function (m) { return docsMember(m, pg.l); }).join('');
      }).join('');
  };
  /* What is inside a namespace, as LISTS grouped by kind — the same shape as the front page and as
     Phaser's own namespace pages. It was a row of pills, which is the card pattern again: a pill is
     a control you press, and these are names you scan. On Phaser.Animations the whole page was five
     pills and nothing else, which looks like a page that failed to load rather than a namespace
     whose contents are five classes. */
  const KID_LABEL = { class: 'Classes', namespace: 'Namespaces', typedef: 'Typedefs',
    interface: 'Interfaces', mixin: 'Mixins' };
  const kidsBy = {};
  (pg.kids || []).forEach(function (k) { (kidsBy[k[1]] || (kidsBy[k[1]] = [])).push(k); });
  const kids = Object.keys(kidsBy).sort().map(function (kind) {
    const list = kidsBy[kind].slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return '<h3 class="dc-h">' + esc(KID_LABEL[kind] || kind)
      + '<span class="dc-count">' + list.length + '</span></h3>'
      + '<ul class="dc-index">' + list.map(function (k) {
        return '<li><a data-doc-page="' + k[2] + '">' + esc(pg.l + '.' + k[0]) + '</a></li>';
      }).join('') + '</ul>';
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

  /* Searching from a page, without going back to the front one first. The landing page has its own
     full-width box and keeps it; this is the same box, small, in the corner every site puts it. */
  /* Phaser titles a CLASS by its short name and a NAMESPACE by its full one — "Sprite", but
     "Phaser.Animations.Events" — and the breadcrumb above carries the rest either way. */
  const title = pg.k === 'namespace' ? pg.l : pg.n;
  const main = '<div class="phead"><div>'
    + '<div class="dc-crumbs">' + (crumbs.join('<span>›</span>') || '&nbsp;') + '</div>'
    + '<h2>' + esc(title) + docsKindChip(pg.k) + '</h2></div>'
    + '<div class="dc-search dc-search-sm"><span class="mdi mdi-magnify"></span>'
    + '<input id="docsSearch" type="search" autocomplete="off" spellcheck="false" '
    + 'placeholder="Search Phaser…" aria-label="Search the Phaser API"></div>'
    + '</div><div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">'
    + '<div class="dc-ver">Version: Phaser v' + esc((docsMeta && docsMeta.version) || '') + '</div>'
    + (pg.x ? '<div class="dc-lab">Description:</div>' + docsProse(pg.x) : '')
    + (pg.scope ? '<div class="dc-line"><b>Scope</b> ' + esc(pg.scope) + '</div>' : '')
    + docsSource(pg.src)
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
    + kids
    + block('member', 'Public Members') + inherited('member', 'Inherited Members')
    + block('constant', 'Constants')
    + block('function', 'Public Methods') + inherited('function', 'Inherited Methods')
    + block('event', 'Events')
    + '</div>';
  return docsShell(docsNav(pg.l), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}

/* ---------- the page, whichever of the three it currently is ---------- */
function renderDocs() {
  if (!docsTopic) return renderDocsShelf();
  if (docsSym) return '<div class="dc-loading">Loading…</div>';
  if (docsGroupId) {
    const g = docsGroups().filter(function (x) { return x.id === docsGroupId; })[0];
    if (g) return renderDocsGroup(g);
  }
  return renderPhaserDocs();
}
/* A group's index page. Pressing a heading in the rail goes here AND opens the list beneath it —
   both, because in Phaser's nav the heading is a link and a disclosure at the same time. */
function openDocsGroup(id) {
  if (!docsPages) {
    loadDocsIndex().then(function () { openDocsGroup(id); });
    return;
  }
  docsTopic = 'phaser'; docsSym = ''; docsGroupId = id;
  docsNavOpenId = id;
  const host = $('page');
  host.innerHTML = renderDocs();
  wireDocs();
  host.scrollTop = 0;
  if (typeof syncRoute === 'function') syncRoute();
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
  /* A heading is a link to the group's page and a disclosure for its list, the way Phaser's is:
     pressing it goes there and opens it. Pressing the one you are already on shuts the list without
     leaving the page. */
  nav.querySelectorAll('[data-group]').forEach(function (b) {
    b.addEventListener('click', function () {
      const id = b.getAttribute('data-group');
      if (docsGroupId === id && b.classList.contains('open')) {
        docsNavOpenId = '';
        nav.innerHTML = docsNav(docsSym || '', docsGroupId);
        wireDocsNav(host);
        return;
      }
      openDocsGroup(id);
    });
  });
}
function wireDocs() {
  const host = $('page');
  /* THE NAV WIRES ITSELF, and nothing here may touch it. Both functions used to bind every
     [data-branch], [data-doc] and [data-doc-open] in the whole page — and the nav is in the page —
     so every button in the rail had two handlers on it and a single click ran both. On a section
     heading that is open-then-close in one press: the nav appeared not to respond at all. */
  wireDocsNav(host);
  const main = host.querySelector('.dc-main') || host;
  main.querySelectorAll('[data-doc-open]').forEach(function (b) {
    b.addEventListener('click', function () { openDocsTopic(b.getAttribute('data-doc-open')); });
  });
  main.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
  main.querySelectorAll('[data-doc-page]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
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
        if (nav) { nav.innerHTML = docsNav(docsSym || '', docsGroupId); wireDocsNav($('page')); }
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
  /* THE EIGHT SECTIONS PHASER'S OWN FRONT PAGE HAS, in its order, checked against it rather than
     chosen: Classes, Constants, Events, Game Object Classes, Game Object Functions, Arcade Physics,
     Matter Physics, Typedefs. Ours had three — Classes, Namespaces, Typedefs — where Namespaces is
     not one of theirs at all and Typedefs meant something different.

     Constants, Events and Typedefs here are the NAMESPACES that hold them, not the things
     themselves, which is what Phaser lists: thirteen, twenty-one and fifty-seven. */
  const groups = docsGroups();
  const byId = {};
  groups.forEach(function (g) { byId[g.id] = g; });
  const pagesOf = function (k) {
    return docsPages.filter(function (p) { return p.k === k; })
      .sort(function (a, b) { return a.ln < b.ln ? -1 : 1; });
  };
  const owners = function (kind) {
    const g = byId[kind];
    return g ? g.list : [];
  };
  const secs = [
    ['classes', 'Classes', pagesOf('class')],
    ['constants', 'Constants', owners('constant')],
    ['events', 'Events', owners('event')],
    ['go-classes', 'Game Object Classes', directChildren('Phaser.GameObjects').filter(function (k) { return k.k !== 'function'; })],
    ['go-functions', 'Game Object Functions', directChildren('Phaser.GameObjects').filter(function (k) { return k.k === 'function'; })],
    ['arcade', 'Arcade Physics', directChildren('Phaser.Physics.Arcade')],
    ['matter', 'Matter Physics', directChildren('Phaser.Physics.Matter')],
    ['typedefs', 'Typedefs', owners('typedef-owners')]
  ].filter(function (s) { return s[2] && s[2].length; });

  browse.innerHTML = secs.map(function (s) {
    return '<h2 class="dc-h2" id="sec-' + s[0] + '">' + esc(s[1]) + '</h2>'
      + '<ul class="dc-index">' + s[2].map(function (p) {
        return '<li><a data-doc="' + esc(p.ln) + '">' + esc(p.ln) + '</a></li>';
      }).join('') + '</ul>';
  }).join('');
  browse.querySelectorAll('[data-doc]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
  });
}
