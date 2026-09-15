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

/* THE SYMBOL PAGE THAT IS ACTUALLY IN HAND, and the one being fetched.
   renderDocs() is synchronous and a symbol page is not, so opening one used to paint "Loading…" and
   rely on the in-flight fetch to come back and replace it. That holds exactly once. Anything that
   repaints #page afterwards — and applyRoute, showPage and the nav all do — calls renderDocs()
   again, gets the same placeholder, and this time there is no fetch on its way to replace it. The
   reader is left on "Loading…" for ever with the data already in memory, which is what "the docs
   get stuck on loading" was: not a slow network, a repaint arriving after the answer.
   Keeping the loaded page means renderDocs() can answer straight away on every repaint after the
   first, and the pending longname means the placeholder can start its own fetch instead of being a
   dead end. */
let docsSymPage = null;        // { ln, pg } — the last symbol page that finished loading
let docsSymPending = '';       // a longname whose fetch is in flight right now

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
/* The same longnames as a Set. docsType asks "is this type something I can link to?" once per type
   name on the page, and Sprite asks it 438 times — each of which was a linear walk of all nineteen
   thousand entries. That was two thirds of the time it took to draw the page, and it was two thirds
   of it on a Chromebook as well, where the page is already the slowest thing in the app. */
let docsLongnames = null;
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
    docsLongnames = new Set(docsIndex.map(function (e) { return e.ln; }));
    docsMeta = all[1];
    docsPages = String(all[2] || '').split('\n').map(function (L) {
      const p = L.split('\t');
      if (p.length < 3) return null;
      /* A fourth column, on the one row that has it: the other kinds this longname is documented as.
         Phaser.Display.Color is a class AND a namespace, and Phaser lists it under both. */
      return { ln: p[0], nm: p[0].split('.').pop(), k: p[1], p: +p[2], also: p[3] ? p[3].split(',') : null };
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
  /* ALSO THE FENCED BLOCKS INSIDE DESCRIPTIONS, not only the @example ones. Phaser writes real
     ```js blocks in its JSDoc — SmoothedKeyControl's whole config object is one — and they were
     arriving as plain uncoloured text beside examples that were coloured. */
  host.querySelectorAll('.dc-eg code, .dc-prose pre code').forEach(function (c) {
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
function docsType(names, sep) {
  if (!names || !names.length) return '';
  return names.map(function (t) {
    const bare = String(t).replace(/^Array\.</, '').replace(/>$/, '');
    const known = !!docsLongnames && docsLongnames.has(bare);
    /* A union can also live INSIDE one type name — `Set.<(A|B)>` arrives as a single string. Phaser
       spaces those too, so the pipe reads as "or" rather than as part of a name. */
    const shown = String(t).replace(/\s*\|\s*/g, ' | ');
    return known ? '<a class="dc-type" data-doc="' + esc(bare) + '">' + esc(shown) + '</a>'
      : '<span class="dc-type">' + esc(shown) + '</span>';
  /* A UNION IS " | " IN A TABLE AND ", " ON A SIGNATURE LINE. Phaser's parameter tables print
     "number | Phaser.Types.Math.Vector2Like", and its property signatures print
     "renderer: Phaser.Renderer.Canvas.CanvasRenderer, Phaser.Renderer.WebGL.WebGLRenderer". Same
     data, two separators, and we used the pipe in both places. */
  }).join(sep || ' | ');
}
/* A TABLE, with Phaser's own columns: name, type, optional, default, description.
   THE DEFAULT IS ITS OWN COLUMN, and it appears only when something in this table actually has one —
   which is what Phaser does, so Arc's constructor gets five columns and Body#setVelocityX gets four.
   Ours crammed it into the "optional" cell as "Yes = 0", which reads as part of the yes/no answer
   and put two different facts in one column. */
function docsParams(ps) {
  if (!ps || !ps.length) return '';
  const hasDefault = ps.some(function (p) { return p.d !== undefined; });
  return '<div class="dc-tablewrap"><table class="dc-table"><thead><tr>'
    + '<th>name</th><th>type</th><th>optional</th>'
    + (hasDefault ? '<th>default</th>' : '')
    + '<th>description</th></tr></thead><tbody>'
    + ps.map(function (p) {
      /* CLASSES, NOT COLUMN NUMBERS. The "optional" and "default" cells must not wrap and the
         description must; keyed on nth-child that worked only while a table had five columns, and
         on the four-column ones — most of them — it made the DESCRIPTION nowrap, which is what put
         a horizontal scrollbar under every parameter table in the reference. */
      return '<tr><td class="dc-c-name"><code>' + esc(p.n) + '</code></td>'
        + '<td class="dc-c-type">' + (p.t ? docsType(p.t) : '') + '</td>'
        + '<td class="dc-c-opt">' + (p.o ? 'Yes' : 'No') + '</td>'
        + (hasDefault ? '<td class="dc-c-def">' + (p.d !== undefined ? '<code>' + esc(p.d) + '</code>' : '') + '</td>' : '')
        + '<td class="dc-c-desc dc-prose">' + (p.x ? docsInline(p.x) : '') + '</td></tr>';
    }).join('')
    + '</tbody></table></div>';
}
/* One id scheme, written once, because the page builds these and the jump-to-member looks them up
   and the two silently disagreeing is a link that does nothing. */
function memberDomId(owner, name) {
  return 'sym-' + String(owner + '-' + name).replace(/[^A-Za-z0-9_-]/g, '-');
}
/* ONE MEMBER, laid out the way docs.phaser.io lays one out — read off its own markup rather than
   invented. Every block on their page is, in order:

     acceleration                                  the name, on its own
     acceleration: Phaser.Math.Vector2             a property, with its type
     <instance> setVelocityX(value)                a method, with who it belongs to
     Description:  …
     Parameters:   name | type | optional | description
     Returns: Phaser.Physics.Arcade.Body - This Body object.
     Source: src/physics/arcade/Body.js#L2032   Since: 3.0.0

   Three things here were wrong before. The `<instance>` / `<static>` marker was a "static" chip that
   appeared only on statics, so an instance method said nothing about being one. `Since` was parsed
   by the build, stored on every one of nineteen thousand members, and then never printed. And a
   property's type was a "Type" row underneath instead of sitting on the signature line where Phaser
   puts it. */
function docsMember(m, owner) {
  const id = memberDomId(owner, m.n);
  const args = (m.p || []).map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ');
  const sig = m.k === 'function'
    ? '<span class="dc-scope">&lt;' + (m.s ? 'static' : 'instance') + '&gt;</span> '
      + esc(m.n) + '(' + esc(args) + ')'
    /* A property and a constant carry their type — "x: number", "ZERO: Phaser.Math.Vector2". An
       EVENT does not: Phaser prints the bare name, because the type of an event constant is always
       `string` and saying so on all 248 of them is noise. */
    : esc(m.n) + (m.k !== 'event' && m.t && m.t.length ? ': ' + docsType(m.t, ', ') : '');
  return '<div class="dc-member" id="' + id + '">'
    + '<h3 class="dc-mname">' + esc(m.n) + '</h3>'
    + '<div class="dc-mhead"><code class="dc-sig">' + sig + '</code>'
    + (m.ro ? '<span class="dc-flag">read-only</span>' : '') + '</div>'
    + (m.x ? '<div class="dc-lab">Description:</div>' + docsProse(m.x) : '')
    /* Between the description and the parameters, where Phaser puts them. */
    + (m.tags && m.tags.length
      ? '<div class="dc-lab">Tags:</div><ul class="dc-tags">'
        + m.tags.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
      : '')
    + (m.p && m.p.length ? '<div class="dc-lab">Parameters:</div>' + docsParams(m.p) : '')
    + (m.r ? '<div class="dc-line"><b>Returns:</b> ' + docsType(m.r.t)
      + (m.r.x ? ' - ' + docsInline(m.r.x) : '') + '</div>' : '')
    + docsSource(m.src, m.since)
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
/* THE SAME FURNITURE EVERY PAGE OF THE REFERENCE HAS, and the landing page had none of it: no
   breadcrumb, no version badge, and a title reading "Phaser" where Phaser's reads "Phaser 4.1.0 API
   Documentation". It looked like a different site from the pages it links to.

   The wording under the title is OURS, deliberately. Phaser's own three-paragraph introduction is
   narrative writing on docs.phaser.io, not JSDoc out of src/, so it is not covered by the MIT grant
   the rest of this reference rests on — the same reason build-phaser-docs.js takes the doclets and
   leaves the guides. */
function renderPhaserDocs() {
  const v = (docsMeta && docsMeta.version) || '';
  const main = '<div class="phead"><div>'
    + docsCrumbs([['Phaser API Documentation', 'landing'],
      ['Phaser ' + v + ' API Documentation', 'here']])
    + docsVersionBadge()
    + '<h2>Phaser ' + esc(v) + ' API Documentation</h2></div></div>'
    /* THREE PARAGRAPHS, in the shape and order Phaser's landing page uses: what this is, what it
       gives you, and where to go for the part it does not.

       The WORDING is ours. Phaser's own introduction is narrative copy on docs.phaser.io rather
       than JSDoc out of src/, so it is not covered by the MIT grant the rest of this reference
       rests on — the same line build-phaser-docs.js draws when it takes the doclets and leaves the
       guides. The third paragraph also has to differ in substance: theirs sends you to the Phaser
       Guide and the examples repo, and nothing in this app sends a twelve-year-old to a site their
       school network blocks. It sends them to the lessons instead. */
    + '<div class="dc-page dc-intro">'
    + docsProse('This is the complete API documentation for Phaser ' + v + '.\n\n'
      + 'It lists every method, property, event, typedef and callback signature in the engine, '
      + 'without any explanation of when you would want to use them.\n\n'
      + 'For that, read it alongside the lessons in this course.')
    + '</div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div id="docsBrowse" class="dc-browse"><p class="dc-loading">Loading the reference…</p></div>';
  /* The eight section names, as a jump-to rail — the same thing Phaser's right-hand column is. It is
     filled in by paintBrowse once the index lands, because until then there are no sections. */
  return docsShell(docsNav(''), main, '<div id="docsToc"></div>');
}

/* THE TRAIL IS HOME › THE REFERENCE › THE BRANCH › THIS PAGE, which is what Phaser's says:
   "Phaser API Documentation › Class › AnimationFrame". Ours walked the namespace path instead —
   "Phaser 4.1.0 API Documentation › Phaser › Animations › AnimationFrame" — which is where the
   symbol lives in the engine, not where the reader is in the documentation. The rail on the left
   says Class; the trail on top has to agree with it.

   Each part is [label, kind, value]: 'landing' goes to the reference's front page, 'group' opens one
   of the rail's branches, 'doc' opens a symbol, and 'here' is where you are and is not a link. */
function docsCrumbs(parts) {
  return '<div class="dc-crumbs">'
    + '<a class="dc-crumb-home" data-doc-open="" aria-label="Docs" title="Docs">'
    + '<span class="mdi mdi-home"></span></a>'
    + parts.map(function (p) {
      const label = esc(p[0]);
      if (p[1] === 'here') return '<span class="dc-crumb-sep">›</span><span class="dc-crumb-here">' + label + '</span>';
      if (p[1] === 'group') return '<span class="dc-crumb-sep">›</span><a data-group="' + esc(p[2]) + '">' + label + '</a>';
      if (p[1] === 'doc') return '<span class="dc-crumb-sep">›</span><a data-doc="' + esc(p[2]) + '">' + label + '</a>';
      return '<span class="dc-crumb-sep">›</span><a data-doc-open="phaser">' + label + '</a>';
    }).join('')
    + '</div>';
}
/* THE TITLE DEPENDS ON THE BRANCH YOU CAME THROUGH, not on the symbol's kind — because on Phaser's
   site it depends on the URL you came through, and the same symbol has more than one URL.
   Phaser.Animations.Events is reachable at /namespace/animations-events, titled
   "Phaser.Animations.Events", and at /event/animations-events, titled "Animations.Events". Two
   pages, two titles, one symbol. This reference has one page per symbol, so the branch in the rail
   stands in for the URL kind: open it under Events and it is titled the way Phaser's event page
   titles it, open it under Namespaces and it is titled the way their namespace page does.

   The row labels in the rail follow the same three rules — see rowLabel in docsGroups. */
function docsPageTitle(pg) {
  const groups = docsGroups();
  const branch = groups.filter(function (g) {
    return g.id === docsNavOpenId && g.list.some(function (p) { return p.ln === pg.l; });
  })[0];
  const style = branch ? branch.rowLabel : (pg.k === 'class' ? 'short' : 'full');
  return style === 'short' ? pg.n
    : style === 'strip' ? pg.l.replace(/^Phaser\./, '')
      : pg.l;
}
/* Which branch of the rail a page belongs to, for the trail. Phaser names the branch, not the kind:
   a namespace page says "Namespaces". */
const DOCS_BRANCH = { class: ['Class', 'class'], namespace: ['Namespaces', 'namespace'],
  typedef: ['Typedefs', 'typedef'], interface: ['Interfaces', 'interface'],
  mixin: ['Mixins', 'mixin'] };
function docsVersionBadge() {
  const v = (docsMeta && docsMeta.version) || '';
  return v ? '<div class="dc-ver">Version: Phaser v' + esc(v) + '</div>' : '';
}

/* ---------- the shell ----------
   A LIST DOWN THE LEFT THAT NEVER GOES AWAY, the page in the middle, and a jump-to rail on the
   right. This is the shape every reference has — Phaser's own, MDN's, every language's — and the
   reason is that documentation is not read, it is navigated: you arrive somewhere, look around, and
   go somewhere else. The cards this replaced made every move a round trip through a front page, so
   getting from one class to a related one meant going back twice. It read as a dictionary because
   it behaved like one: a thing you look a word up in and then close. */
/* THE SEARCH BOX LIVES IN THE RIGHT-HAND RAIL, above the jump-to list, which is where Phaser's is.
   Ours was a full-width bar across the middle of the landing page — the single loudest thing on a
   page whose job is to be a contents list, and absent entirely from the shape of Phaser's. One box,
   one place, on every page of the reference rather than three near-copies in three layouts. */
/* BOTH RAILS COLLAPSE TO A DISCLOSURE ON A NARROW SCREEN, which is what docs.phaser.io does at its
   996px breakpoint: the left rail goes behind a menu button and the right one becomes an "On this
   page" dropdown above the article. Ours went to a single column at 820px and stacked the left rail
   ON TOP of the page — so on a phone the Docs tab opened on 254 namespace names and the
   documentation itself was three screens down — and hid the right rail entirely at 1180px, which
   also hid the search box that lives in it.

   The button is always in the markup and hidden by CSS above the breakpoint, so there is one shape
   to reason about rather than two renderers. */
function docsShell(nav, main, toc) {
  const rail = function (cls, label, body) {
    return '<aside class="' + cls + '">'
      + '<button class="dc-railtoggle" type="button" aria-expanded="false">' + esc(label)
      + '<span class="dc-railcaret mdi mdi-chevron-down"></span></button>'
      + '<div class="dc-railbody">' + body + '</div></aside>';
  };
  return '<div class="dc-shell">'
    + rail('dc-nav', 'Menu', nav)
    + '<div class="dc-main">' + main + '</div>'
    + rail('dc-toc', 'On this page', docsSearchBox() + (toc || ''))
    + '</div>';
}
/* The left rail: which reference you are in, then the parts of it. Built from the metadata the
   build writes, so it is there before any page is fetched. */
/* NO "Phaser" CHIP ABOVE THE LIST. It named the reference you were already in, directly above a row
   that names it again and more precisely — "Phaser 4.1.0 API Documentation" — so the rail opened
   with the same word twice and one of them did nothing the other did not. */
function docsNav(activeLongname, activeGroup) {
  if (!docsPages) {
    return '<div class="dn-head">Phaser</div><p class="dc-loading">Loading…</p>';
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
  const groups = docsGroups();
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
        const label = g.rowLabel === 'short' ? p.nm
          : g.rowLabel === 'strip' ? p.ln.replace(/^Phaser\./, '')
            : p.ln;
        return '<button class="dn-sub' + (p.ln === activeLongname ? ' on' : '') + '" data-doc="'
          + esc(p.ln) + '" title="' + esc(p.ln) + '">' + esc(label) + '</button>';
      }).join('') + '</div>'
      : '';
    /* The chevron sits on the RIGHT, where Phaser's does, and there is no count beside it. A number
       next to every heading is a fact nobody needs at the moment of choosing where to go, and it
       was the only thing in the rail competing with the names for attention. */
    return '<button class="dn-item' + (open ? ' open' : '')
      + (activeGroup === g.id ? ' on' : '') + '" data-group="' + esc(g.id) + '">'
      + esc(g.label) + '<span class="dn-caret mdi mdi-chevron-right"></span></button>' + body;
  }).join('');
  /* HIGHLIGHTED ONLY WHEN YOU ARE ACTUALLY ON IT. The test was "no symbol open", which is also true
     of every group index — so opening Physics or Typedefs left this row lit alongside the one you
     had just pressed, and the rail claimed you were in two places at once. The landing page is the
     one with no symbol AND no group. */
  /* The arrow goes OUT of this reference, back to the shelf of them; the row beside it goes to this
     reference's own front page. Two different destinations, so two controls — and a button inside a
     button is not markup, so they sit side by side in one row. */
  return '<div class="dn-list">'
    + '<div class="dn-homerow">'
    + '<button class="dn-back" data-doc-open="" aria-label="Back to Docs" title="Back to Docs">'
    + '<span class="mdi mdi-home"></span></button>'
    + '<button class="dn-item dn-home' + (!activeLongname && !activeGroup ? ' on' : '') + '" data-doc-open="phaser">'
    + 'Phaser ' + esc((docsMeta && docsMeta.version) || '') + ' API Documentation</button>'
    + '</div>'
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
  /* A page is filed under every kind it is documented as, not only the one its page is titled with,
     so Phaser.Display.Color appears in Classes AND in Namespaces the way it does on Phaser's site. */
  const byKind = {};
  (docsPages || []).forEach(function (p) {
    [p.k].concat(p.also || []).forEach(function (k) { (byKind[k] || (byKind[k] = [])).push(p); });
  });
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
  const typedefs = (byKind.typedef || []).slice().sort(byName);

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
  /* HOW EACH BRANCH WRITES ITS ROWS, read off Phaser's own sidebar rather than picked. It is not one
     rule — every branch was showing the full dotted longname here, so Class read
     "Phaser.Animations.Animation" where Phaser reads "Animation", and the rail was three times as
     wide as it needed to be for the one branch a beginner opens most.

       Namespaces   Phaser.Actions              the whole name
       Class        Animation                   the last piece only
       Functions    Phaser.Actions              the whole name
       Constants    BlendModes                  the name without its "Phaser." prefix
       Events       Animations.Events           likewise
       Typedefs     Physics.Matter.Events       likewise */
  const out = [
    { id: 'namespace', label: 'Namespaces', rowLabel: 'full',
      list: (byKind.namespace || []).slice().sort(byName) },
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
    { id: 'event', label: 'Events', rowLabel: 'strip', list: owners(ev, false) },
    { id: 'class', label: 'Class', rowLabel: 'short',
      list: (byKind.class || []).slice().sort(byName) },
    { id: 'function', label: 'Functions', rowLabel: 'full',
      list: owners(fn.filter(function (e) { return e.ln.indexOf('#') < 0; }), true) },
    { id: 'constant', label: 'Constants', rowLabel: 'strip', list: owners(co, true) },
    /* THE NAMESPACES THAT HOLD TYPEDEFS, not the typedefs themselves. Phaser's Typedefs page and
       its Typedefs branch in the rail both list fifty-seven namespaces — Phaser.Types.Core,
       Phaser.Types.Input and the rest — exactly as its Constants and Events sections list theirs.
       This listed all 395 typedef pages instead, so the branch was seven times the length of
       Phaser's and opened onto a wall of bare names — `EachMapCallback<E>`, `CenterFunction` —
       with nothing to say which part of the engine any of them belonged to.

       Only the typedefs that HAVE an owner. Eighteen of Phaser's are global, with no dot in the
       name, and asking for the part before the dot hands back the name itself — so each invented a
       namespace of its own and the section came out at 75 against Phaser's 57. Phaser's own index
       drops those eighteen entirely; this one keeps them, in a Global section on the Typedefs page,
       because a page nothing links to is a page nobody finds. */
    { id: 'typedef', label: 'Typedefs', rowLabel: 'strip',
      list: owners(typedefs.filter(function (p) { return p.ln.indexOf('.') > 0; }), false),
      globals: typedefs.filter(function (p) { return p.ln.indexOf('.') < 0; }) },
    { id: 'interface', label: 'Interfaces', list: (byKind.interface || []).slice().sort(byName) },
    { id: 'mixin', label: 'Mixins', list: (byKind.mixin || []).slice().sort(byName) }
  ].filter(function (g) { return g.list.length; });
  docsGroupCache = out;
  return out;
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
  } else if (g.globals && g.globals.length) {
    /* Phaser's eighteen global typedefs are callback signatures that belong to no namespace, so
       there is no owner row that leads to them. Their own section, under the owners. */
    body = section('owners', g.label, g.list) + section('global', 'Global', g.globals);
  } else {
    body = docsIndexList(g.list);
  }
  const main = '<div class="phead"><div>'
    + docsCrumbs([['Phaser API Documentation', 'landing'], [g.label, 'here']])
    + docsVersionBadge()
    + '<h2>' + esc(g.label) + '</h2></div></div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">' + body + '</div>';
  return docsShell(docsNav('', g.id), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}
/* The source line, linking where Phaser's links: the exact file and line on GitHub, at the tag for
   the version this reference was generated from. Jay asked for it explicitly, and it is the one
   outward link in the docs — a pointer at the engine's own source, not a place a student gets lost.
   It opens in a new tab so it never takes them out of their game. */
/* SOURCE AND SINCE ON ONE LINE, which is how Phaser prints it — "Source: src/math/Vector2.js#L294
   Since: 3.0.0" — at the foot of the page and at the foot of every member on it. */
function docsSource(src, since) {
  if (!src && !since) return '';
  const v = (docsMeta && docsMeta.version) || '';
  const href = 'https://github.com/phaserjs/phaser/blob/v' + v + '/' + src;
  return '<div class="dc-src">'
    + (src ? 'Source: <a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(src) + '</a>' : '')
    + (since ? ' <span class="dc-since">Since: ' + esc(since) + '</span>' : '')
    + '</div>';
}
/* Searching from wherever you are, without going back to the front page first. The landing page has
   its own full-width box and keeps it; this is the same box, small, in the corner every site puts
   it — on a group's index page and on every API page. */
function docsSearchBox() {
  return '<div class="dc-search dc-search-sm"><span class="mdi mdi-magnify"></span>'
    + '<input id="docsSearch" type="search" autocomplete="off" spellcheck="false" '
    + 'placeholder="Search Phaser…" aria-label="Search the Phaser API"></div>';
}

/* A TYPEDEF BRANCH PAGE SHOWS ITS TYPEDEFS IN FULL, not as a list of links to them.
   docs.phaser.io/api-documentation/typedef/device is Audio, Browser, CanvasFeatures and five more,
   each with its description and its table of fields, all on the one page — and the individual ones
   have no page of their own there at all: /typedef/types-math/sincostable is a 404. Ours listed
   eight names and made the reader click each one.

   The child pages are separate files, so openDocsSymbol fetches them before rendering and hangs
   them on `inline`. When it has not — every other branch — this renders nothing and the ordinary
   "Typedefs:" index list is used instead. */
function inlineTypedefs(pg) {
  const list = pg.inline;
  if (!list || !list.length) return '';
  return list.map(function (t) {
    return '<h2 class="dc-h2" id="sec-' + esc(String(t.n).replace(/[^A-Za-z0-9_-]/g, '-')) + '">'
      + esc(t.n) + '</h2>'
      + '<div class="dc-member">'
      + '<h3 class="dc-mname"><span class="dc-scope">&lt;static&gt;</span> ' + esc(t.n) + '</h3>'
      + (t.x ? docsProse(t.x) : '')
      + (t.props && t.props.length ? docsParams(t.props) : '')
      + (t.params && t.params.length ? '<div class="dc-lab">Parameters:</div>' + docsParams(t.params) : '')
      + (t.ret ? '<div class="dc-line"><b>Returns:</b> ' + docsType(t.ret.t)
        + (t.ret.x ? ' - ' + docsInline(t.ret.x) : '') + '</div>' : '')
      + (t.t && t.t.length ? '<div class="dc-line">Type: ' + docsType(t.t, ', ') + '</div>' : '')
      + (t.mo ? '<div class="dc-line">Member of: <a data-doc="' + esc(t.mo) + '">' + esc(t.mo) + '</a></div>' : '')
      + docsSource(t.src, t.since)
      + '</div>';
  }).join('');
}

/* THE CONSTANTS BRANCH IS ITS OWN PAGE SHAPE, the way the typedefs branch is. Opened under
   Constants, Phaser.TintModes on their site is six headings and nothing else — no description, no
   "Scope: static", no page-level source, no "Constants:" or "Public Members" heading. Each constant
   is an h2 with its name, its `NAME: type` line, its description and its source, IN THE ORDER IT IS
   WRITTEN IN THE FILE rather than alphabetically.

   Ours carried all the page furniture and then two stacked headings above an alphabetical list, so
   the same six constants arrived in a different order under two headings their page does not have. */
function renderConstantsPage(pg) {
  /* ONLY THE CONSTANTS. Phaser.Math has fifty static functions as well as its constants, and their
     constants page lists PI2, TAU, EPSILON and the rest — not the functions. Taking every member
     put 205 blocks on a page that has 65. */
  const list = (pg.m || []).filter(function (m) {
    return !m.from && (m.k === 'constant' || (m.k === 'member' && m.s));
  }).slice().sort(function (a, b) { return (a.ln || 0) - (b.ln || 0); });
  /* Each constant is an h3, not an h2 — measured on their page: TintModes has one h1 at 48/60 and
     six h3s at 24/30, no h2 anywhere, and NO horizontal rules between them. The gap from a Source
     block to the next name is 30px, which the h3's own top margin provides once nothing blocks it
     from collapsing. So no .dc-member wrapper here: that one draws a rule after every block. */
  const body = list.map(function (m) {
    const id = memberDomId(pg.l, m.n);
    return '<div class="dc-const">'
      + '<h3 class="dc-mname" id="' + esc(id) + '">' + esc(m.n) + '</h3>'
      + '<div class="dc-mhead"><code class="dc-sig">' + esc(m.n)
      + (m.t && m.t.length ? ': ' + docsType(m.t, ', ') : '') + '</code></div>'
      + (m.x ? '<div class="dc-lab">Description:</div>' + docsProse(m.x) : '')
      + docsSource(m.src, m.since)
      + '</div>';
  }).join('');
  const toc = list.map(function (m) {
    const id = memberDomId(pg.l, m.n);
    return '<a class="dt-item" href="#' + id + '" data-jump="' + esc(id) + '">' + esc(m.n) + '</a>';
  }).join('');
  const title = docsPageTitle(pg);
  const main = '<div class="phead"><div>'
    + docsCrumbs([['Phaser API Documentation', 'landing'], ['Constants', 'group', 'constant'],
      [title, 'here']])
    + docsVersionBadge()
    + '<h2>' + esc(title) + '</h2></div></div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">' + body + '</div>';
  return docsShell(docsNav(pg.l, ''), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}

/* THE TYPEDEFS BRANCH, like the constants branch, is only its own entries. Their /typedef/phaser
   page is one typedef — DeviceConf — and nothing else, while Phaser the namespace has hundreds of
   members, classes and sub-namespaces. Rendering the namespace page and appending the typedefs put
   all of that on it. */
function renderTypedefsPage(pg) {
  const title = docsPageTitle(pg);
  const main = '<div class="phead"><div>'
    + docsCrumbs([['Phaser API Documentation', 'landing'], ['Typedefs', 'group', 'typedef'],
      [title, 'here']])
    + docsVersionBadge()
    + '<h2>' + esc(title) + '</h2></div></div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">' + inlineTypedefs(pg) + '</div>';
  const toc = (pg.inline || []).map(function (t) {
    const id = 'sec-' + String(t.n).replace(/[^A-Za-z0-9_-]/g, '-');
    return '<a class="dt-item" href="#' + id + '" data-jump="' + esc(id) + '">' + esc(t.n) + '</a>'
      + '<a class="dt-item dt-sub" href="#' + id + '" data-jump="' + esc(id) + '">'
      + '&lt;static&gt; ' + esc(t.n) + '</a>';
  }).join('');
  return docsShell(docsNav(pg.l, ''), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}

/* THE EVENTS BRANCH. Their /event/data-events is an h1 and then one h2 per event, in source order,
   with no page description, no Scope, no page-level Source and no "Static functions" heading — and
   inside each entry the layout differs too: "Description:" runs INTO the first sentence rather than
   sitting on its own line, the parameter table carries no "Parameters:" label, and a "Member of:"
   line sits above the source. Every one of those was wrong when events were rendered by the
   namespace template. */
function renderEventsPage(pg) {
  const list = (pg.m || []).filter(function (m) { return !m.from && m.k === 'event'; })
    .slice().sort(function (a, b) { return (a.ln || 0) - (b.ln || 0); });
  const body = list.map(function (m) {
    const id = memberDomId(pg.l, m.n);
    return '<h2 class="dc-h2" id="' + esc(id) + '">' + esc(m.n) + '</h2>'
      + '<div class="dc-const">'
      /* The label is part of the sentence, so it goes through the markdown with it. */
      + (m.x ? docsProse('**Description:** ' + m.x) : '')
      + (m.p && m.p.length ? docsParams(m.p) : '')
      + '<div class="dc-line">Member of: <a data-doc="' + esc(pg.l) + '">' + esc(pg.l) + '</a></div>'
      + docsSource(m.src, m.since)
      + '</div>';
  }).join('');
  const toc = list.map(function (m) {
    const id = memberDomId(pg.l, m.n);
    return '<a class="dt-item" href="#' + id + '" data-jump="' + esc(id) + '">' + esc(m.n) + '</a>';
  }).join('');
  const title = docsPageTitle(pg);
  const main = '<div class="phead"><div>'
    + docsCrumbs([['Phaser API Documentation', 'landing'], ['Events', 'group', 'event'],
      [title, 'here']])
    + docsVersionBadge()
    + '<h2>' + esc(title) + '</h2></div></div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">' + body + '</div>';
  return docsShell(docsNav(pg.l, ''), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}

/* One API page. */
function renderDocsPage(pg) {
  if (docsNavOpenId === 'constant' && (pg.m || []).some(function (m) { return m.k === 'constant' || (m.k === 'member' && m.s); })) {
    return renderConstantsPage(pg);
  }
  if (docsNavOpenId === 'event' && (pg.m || []).some(function (m) { return m.k === 'event'; })) {
    return renderEventsPage(pg);
  }
  if (docsNavOpenId === 'typedef' && pg.inline && pg.inline.length) {
    return renderTypedefsPage(pg);
  }
  /* SIX SECTIONS, SPLIT BY SCOPE AS WELL AS KIND, in the order docs.phaser.io prints them:

       Inherited Members · Public Members · Inherited Methods · Public Methods
       Static functions  · Constants:

     Two of those were wrong and one did not exist. Inherited came AFTER the class's own, where
     Phaser puts it first. Statics were mixed in with instance methods, so Phaser.Animations.Events
     — which is nothing but static event names — had no section at all matching the "Static
     functions" heading their page carries. And constants were their own heading, where Phaser emits
     a "Constants:" label and then lists them exactly like properties. */
  const own = [], inh = [];
  (pg.m || []).forEach(function (m) { (m.from ? inh : own).push(m); });
  const sect = {
    inhMembers: inh.filter(function (m) { return m.k === 'member' || m.k === 'constant'; }),
    pubMembers: own.filter(function (m) { return m.k === 'member' && !m.s; }),
    inhMethods: inh.filter(function (m) { return m.k === 'function'; }),
    pubMethods: own.filter(function (m) { return m.k === 'function' && !m.s; }),
    /* Events live here because that is where Phaser files them: an event name is a static string on
       a namespace, and their generator labels the whole group "Static functions". */
    staticFns: own.filter(function (m) { return (m.k === 'function' && m.s) || m.k === 'event'; }),
    /* ONLY REAL CONSTANTS trail the page. A static PROPERTY is not one: Phaser.GameObjects.Graphics
       has two and lists them in the ordinary Public Members section, while Phaser.Structs.Size's
       are @constant and get the trailing "Constants:" block. Treating "static" as "constant" gave
       Graphics a second Public Members heading its own page does not have. */
    constants: own.filter(function (m) { return m.k === 'constant'; })
  };
  sect.pubMembers = own.filter(function (m) { return m.k === 'member'; });
  /* A CLASS HAS NO "Static functions" SECTION — its statics sit in Public Methods, mixed in by name.
     A NAMESPACE does have one, and it is the only thing on pages like Phaser.Animations.Events.
     Phaser.Display.Color is the case that shows it: eighteen static functions, and their class page
     lists every one of them under Public Methods with no separate heading anywhere. */
  if (pg.k === 'class') {
    sect.pubMethods = sect.pubMethods.concat(sect.staticFns).sort(function (a, b) {
      const x = a.n.toLowerCase(), y = b.n.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
    sect.staticFns = [];
  }
  /* `id` is separate from `label` because Phaser emits the heading "Public Members" TWICE on a class
     with constants — once for its properties and once, after a "Constants:" label, for the constants
     themselves. Two elements with one id is an anchor that goes to the wrong half of the page. */
  const block = function (list, label, id) {
    if (!list.length) return '';
    return '<h2 class="dc-h2" id="sec-' + esc((id || label).replace(/\s+/g, '-')) + '">'
      + esc(label) + '</h2>'
      + list.map(function (m) { return docsMember(m, pg.l); }).join('');
  };
  /* INHERITED MEMBERS ARE A LIST OF NAMES, not two hundred full blocks. Phaser prints "From
     Phaser.GameObjects.Components.Alpha:" and then the names, each linking to that class's own page
     — so Sprite's 178 inherited entries are 178 short links rather than 178 descriptions, parameter
     tables and source lines. Rendering them in full is the single biggest reason our Sprite page
     looked nothing like theirs: it was a 325 KB wall where Phaser's is a contents list. */
  const inherited = function (list, label) {
    if (!list.length) return '';
    const by = {};
    list.forEach(function (m) {
      const src = String(m.from).split('#')[0];
      (by[src] || (by[src] = [])).push(m);
    });
    return '<h2 class="dc-h2" id="sec-' + esc(label.replace(/\s+/g, '-')) + '">' + esc(label) + '</h2>'
      + Object.keys(by).sort().map(function (src) {
        return '<div class="dc-lab dc-from">From <a data-doc="' + esc(src) + '">' + esc(src) + '</a>:</div>'
          + '<ul class="dc-inh">' + by[src].map(function (m) {
            return '<li><a data-doc="' + esc(src + '#' + m.n) + '">' + esc(m.n) + '</a></li>';
          }).join('') + '</ul>';
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
  /* A HEADING LIKE EVERY OTHER SECTION — "Namespaces:", "Classes:" — and no count beside it. Phaser
     writes these as an h2 with a trailing colon and lists the short names; ours was an h3 with a
     count badge, which made a namespace's contents look like a different kind of thing from every
     other section on the page. */
  /* When the typedefs are rendered in full above, the index list of their names is the same eight
     entries a second time. */
  if (pg.inline && pg.inline.length) delete kidsBy.typedef;
  const kids = Object.keys(kidsBy).sort().map(function (kind) {
    const list = kidsBy[kind].slice().sort(function (a, b) {
      return a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1;
    });
    const label = (KID_LABEL[kind] || kind) + ':';
    return '<h2 class="dc-h2" id="sec-' + esc(label.replace(/[^A-Za-z]/g, '')) + '">' + esc(label) + '</h2>'
      + '<ul class="dc-index">' + list.map(function (k) {
        return '<li><a data-doc-page="' + k[2] + '">' + esc(k[0]) + '</a></li>';
      }).join('') + '</ul>';
  }).join('');
  const title = docsPageTitle(pg);
  /* The trail names the branch you came through, for the same reason the title does. */
  const open = docsGroups().filter(function (g) {
    return g.id === docsNavOpenId && g.list.some(function (p) { return p.ln === pg.l; });
  })[0];
  const branch = open ? [open.label, open.id] : DOCS_BRANCH[pg.k];
  const crumbs = [['Phaser API Documentation', 'landing']];
  if (branch) crumbs.push([branch[0], 'group', branch[1]]);
  crumbs.push([title, 'here']);
  /* The jump-to rail. On a class with three hundred members, scrolling is not navigation — and this
     is the one thing Phaser's own docs have that made the difference between their page and ours. */
  const tocGroup = function (list, label) {
    if (!list.length) return '';
    return '<div class="dt-head">' + label + '</div>'
      + list.map(function (m) {
        return '<a class="dt-item" href="#' + memberDomId(pg.l, m.n)
          + '" data-jump="' + esc(memberDomId(pg.l, m.n)) + '">' + esc(m.n) + '</a>';
      }).join('');
  };
  /* Only what the page actually renders in full. The inherited sections are lists of links to other
     pages, so putting them in a rail that scrolls THIS page sent the reader to an anchor that is
     not here. */
  /* A typedef branch page's content is its inlined typedefs, so its jump-to list is those — two rows
     each, the name and its signature line, which is what Phaser's rail shows. Without this the rail
     on all 57 typedef pages held a search box and nothing else. */
  const tocInline = (pg.inline || []).map(function (t) {
    const id = 'sec-' + String(t.n).replace(/[^A-Za-z0-9_-]/g, '-');
    return '<a class="dt-item" href="#' + id + '" data-jump="' + esc(id) + '">' + esc(t.n) + '</a>'
      + '<a class="dt-item dt-sub" href="#' + id + '" data-jump="' + esc(id) + '">'
      + '&lt;static&gt; ' + esc(t.n) + '</a>';
  }).join('');
  const toc = tocInline
    + tocGroup(sect.pubMembers, 'Public Members')
    + tocGroup(sect.pubMethods, 'Public Methods')
    + tocGroup(sect.staticFns, 'Static functions')
    + tocGroup(sect.constants, 'Constants');

  const main = '<div class="phead"><div>'
    + docsCrumbs(crumbs)
    /* Above the title, in a badge, where Phaser's sits — it was a line of body text under it. */
    + docsVersionBadge()
    + '<h2>' + esc(title) + '</h2></div></div>'
    + '<div id="docsResults" class="dc-results" hidden></div>'
    + '<div class="dc-page">'
    /* The description is the first thing on Phaser's page and carries no "Description:" label — that
       label belongs to the member blocks further down, where there are other things it could be. */
    + (pg.x ? docsProse(pg.x) : '')
    /* THE CONSTRUCTOR COMES FIRST, above Scope and Extends and Source, because it is the thing a
       reader opening a class came for. It was last, under a heading reading "Making one". */
    + (pg.ctor && pg.ctor.p
      ? '<div class="dc-lab">Constructor</div>'
        + docsCode('new ' + pg.n + '(' + pg.ctor.p.map(function (p) { return p.o ? '[' + p.n + ']' : p.n; }).join(', ') + ')')
        + '<div class="dc-lab">Parameters</div>' + docsParams(pg.ctor.p)
      : '')
    + (pg.scope ? '<div class="dc-line">Scope: ' + esc(pg.scope) + '</div>' : '')
    /* EVERY MIXIN, under Phaser's own heading. Showing three and hiding twenty-two behind "and 22
       more" meant the answer to "where does setVelocityX actually come from" was behind a button. */
    + (pg.ext && pg.ext.length
      ? '<div class="dc-lab">Extends</div><div class="dc-line dc-ext">' + docsType(pg.ext) + '</div>'
      : '')
    /* A typedef's own fields — or, for a callback signature, its parameters and return. */
    + (pg.props && pg.props.length ? docsParams(pg.props) : '')
    + (pg.params && pg.params.length ? '<div class="dc-lab">Parameters:</div>' + docsParams(pg.params) : '')
    + (pg.ret ? '<div class="dc-line"><b>Returns:</b> ' + docsType(pg.ret.t)
      + (pg.ret.x ? ' - ' + docsInline(pg.ret.x) : '') + '</div>' : '')
    + (pg.t && pg.t.length && pg.k === 'typedef'
      ? '<div class="dc-line">Type: ' + docsType(pg.t, ', ') + '</div>' : '')
    + docsSource(pg.src, pg.since)
    + inlineTypedefs(pg)
    + inherited(sect.inhMembers, 'Inherited Members')
    + block(sect.pubMembers, 'Public Members')
    + inherited(sect.inhMethods, 'Inherited Methods')
    + block(sect.pubMethods, 'Public Methods')
    + block(sect.staticFns, 'Static functions')
    /* "Constants:" IS A HEADING, not a label — Phaser emits it as an h2 and then emits "Public
       Members" as a second h2 beneath it, so a class with constants carries that heading twice.
       And it appears only for REAL constants: a class whose trailing block is merely static
       properties, like Phaser.Loader.LoaderPlugin, gets the second "Public Members" with no
       "Constants:" above it. */
    + (sect.constants.some(function (m) { return m.k === 'constant'; })
      ? '<h2 class="dc-h2" id="sec-Constants">Constants:</h2>' : '')
    + block(sect.constants, 'Public Members', 'Constants-members')
    /* What is inside the namespace goes LAST, under "Namespaces:" — after everything the page
       documents itself, which is where Phaser puts it. */
    + kids
    + '</div>';
  return docsShell(docsNav(pg.l), main, toc ? '<div class="dt-title">Jump to</div>' + toc : '');
}

/* ---------- the page, whichever of the three it currently is ---------- */
function renderDocs() {
  if (!docsTopic) return renderDocsShelf();
  if (docsSym) {
    /* Already in hand: render it now. This is every repaint after the first. */
    if (docsSymPage && docsSymPage.ln === docsSym) return renderDocsPage(docsSymPage.pg);
    /* Not in hand and nobody is fetching it: fetch it. Deferred by a tick because this function's
       return value is about to be written into #page, and openDocsSymbol writes there too. */
    if (docsSymPending !== docsSym) {
      const want = docsSym;
      setTimeout(function () { if (docsSym === want) openDocsSymbol(want); }, 0);
    }
    return '<div class="dc-loading">Loading…</div>';
  }
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
  docsSymPending = longname;
  const host = $('page');
  loadDocsIndex().then(function (idx) {
    const hit = idx.filter(function (e) { return e.ln === longname; })[0]
      || idx.filter(function (e) { return e.ln.split(/[.#]/).pop() === longname; })[0];
    if (!hit) throw new Error('not found');
    return loadDocsPage(hit.p);
  }).then(function (pg) {
    /* Under the Typedefs branch, the children are the page — see inlineTypedefs. Fetched here
       because rendering is synchronous and they live in their own files. */
    const kids = docsNavOpenId === 'typedef'
      ? (pg.kids || []).filter(function (k) { return k[1] === 'typedef'; }) : [];
    if (!kids.length) return pg;
    return Promise.all(kids.map(function (k) { return loadDocsPage(k[2]); }))
      .then(function (loaded) {
        const copy = {};
        Object.keys(pg).forEach(function (k) { copy[k] = pg[k]; });
        copy.inline = loaded;
        return copy;
      });
  }).then(function (pg) {
    /* Kept whichever way this lands, so a repaint that arrives after the fetch has something to
       render instead of a placeholder nothing will replace. */
    docsSymPage = { ln: longname, pg: pg };
    if (docsSymPending === longname) docsSymPending = '';
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
    if (docsSymPending === longname) docsSymPending = '';
    if (docsSym !== longname) return;
    host.innerHTML = '<div class="phead"><div><h2>Not found</h2>'
      + '<p class="sub">There is nothing in the Phaser reference called <code>' + esc(longname) + '</code>.</p></div>'
      + '<button class="gbtn" data-doc-open="phaser"><span class="mdi mdi-arrow-left"></span>Phaser docs</button></div>';
    wireDocs();
  });
}
function openDocsTopic(id) {
  /* THE GROUP HAS TO GO TOO. It did not, and renderDocs checks docsGroupId before it falls through
     to the landing page — so once you had opened Typedefs or Class, the "Phaser 4.1.0 API
     Documentation" row at the top of the rail and the Phaser card on the shelf both put you back on
     that group's index, address and all, and there was no way left to reach the front page except
     reloading. The open branch in the rail stays open; only the page changes. */
  docsTopic = id || ''; docsSym = ''; docsGroupId = '';
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
        /* The body, not the aside — the aside carries the narrow-screen disclosure button. */
        (nav.querySelector('.dc-railbody') || nav).innerHTML = docsNav(docsSym || '', docsGroupId);
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
  /* The breadcrumb's middle step — "Class", "Namespaces" — opens that branch's index page. */
  main.querySelectorAll('[data-group]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openDocsGroup(b.getAttribute('data-group')); });
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
      b.textContent = rest.hidden ? b.dataset.shut : 'show fewer';
    });
    /* The label to go back to, captured before the first press. */
    b.dataset.shut = b.textContent;
  });
  /* The two rail disclosures. The button is in the markup at every width and CSS decides whether it
     is visible, so there is nothing here that needs to know the breakpoint. */
  host.querySelectorAll('.dc-railtoggle').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-expanded', b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
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
        /* The rail's BODY, not the whole aside — the aside also holds the disclosure button that
           folds it away on a narrow screen, and replacing its innerHTML deleted that button. */
        const nav = $('page').querySelector('.dc-nav .dc-railbody');
        if (nav) { nav.innerHTML = docsNav(docsSym || '', docsGroupId); wireDocsNav($('page')); }
        /* AND THE VERSION, everywhere the landing page prints it. That page is painted before the
           index has arrived — it has to be, or the Docs tab would open on a blank frame — so the
           version is the empty string at that moment and the title came out as "Phaser API
           Documentation" with the number missing, the badge as "Version: Phaser v", and the first
           sentence as "…for Phaser .". Filled in the same way and at the same moment as the nav. */
        const v = (docsMeta && docsMeta.version) || '';
        const main = $('page').querySelector('.dc-main');
        if (v && main && docsTopic === 'phaser' && !docsSym && !docsGroupId) {
          const full = 'Phaser ' + v + ' API Documentation';
          const title = main.querySelector('.phead h2');
          if (title) title.textContent = full;
          const here = main.querySelector('.dc-crumb-here');
          if (here) here.textContent = full;
          const badge = main.querySelector('.dc-ver');
          if (badge) badge.textContent = 'Version: Phaser v' + v;
          const lead = main.querySelector('.dc-intro p');
          if (lead) lead.textContent = 'This is the complete API documentation for Phaser ' + v + '.';
        }
      }).catch(function () {
        if (browse) browse.innerHTML = '<p class="dc-warn">The reference could not be loaded. '
          + 'The cards below still work.</p>';
      });
    };
    box.addEventListener('focus', warm);
    /* IT FILTERS THE JUMP-TO LIST BESIDE IT. That is what Phaser's box does — type "Te" there and
       the right-hand rail narrows to the entries on THIS page that match, and the page you are
       reading is left alone.

       Ours ran a search of all nineteen thousand symbols and painted the hits into the middle
       column, on top of the page. So typing two letters while reading Phaser.Actions replaced the
       documentation with a list of every `text` and `texture` in the engine, which looks like the
       page has broken rather than like a search.

       A name that is nowhere on this page still has to be findable, so when nothing here matches,
       the same box falls back to searching the whole reference — in the rail, under a heading that
       says so, rather than over the top of what you were reading. */
    const toc = host.querySelector('.dc-toc');
    const fallback = document.createElement('div');
    fallback.className = 'dt-fallback';
    fallback.hidden = true;
    /* Inside the rail's body, so it folds away with everything else on a narrow screen. */
    if (toc) (toc.querySelector('.dc-railbody') || toc).appendChild(fallback);
    if (results) results.remove();

    box.addEventListener('input', function () {
      warm();
      const q = box.value.trim().toLowerCase();
      if (!toc) return;
      const items = toc.querySelectorAll('.dt-item');
      let shown = 0;
      items.forEach(function (a) {
        const hit = !q || a.textContent.toLowerCase().indexOf(q) >= 0;
        a.hidden = !hit;
        if (hit) shown++;
      });
      /* A group heading with nothing left under it is a heading for an empty list. */
      toc.querySelectorAll('.dt-head').forEach(function (h) {
        let n = h.nextElementSibling, any = false;
        while (n && n.classList.contains('dt-item')) { if (!n.hidden) { any = true; break; } n = n.nextElementSibling; }
        h.hidden = !any;
      });
      const title = toc.querySelector('.dt-title');
      if (title) title.hidden = !!q && !shown;

      if (!q || shown) { fallback.hidden = true; fallback.innerHTML = ''; return; }
      if (!docsIndex) { fallback.hidden = false; fallback.innerHTML = '<p class="dc-loading">Loading…</p>'; return; }
      const hits = searchDocs(q, 25);
      fallback.hidden = false;
      fallback.innerHTML = '<div class="dt-head">Elsewhere in Phaser</div>' + (hits.length
        /* WITH THE THING IT BELONGS TO. Twelve classes have a setVelocityX, so a list of the name on
           its own is twelve identical rows and no way to pick. */
        ? hits.map(function (e) {
          const owner = e.ln.slice(0, e.ln.length - e.nm.length).replace(/[.#]$/, '');
          return '<a class="dt-item dt-else" data-doc="' + esc(e.ln) + '" title="' + esc(e.ln) + '">'
            + esc(e.nm) + (owner ? '<span class="dt-owner">' + esc(owner.split('.').pop()) + '</span>' : '')
            + '</a>';
        }).join('')
        : '<p class="dc-none">Nothing in Phaser is called “' + esc(box.value.trim()) + '”.</p>');
      fallback.querySelectorAll('[data-doc]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.preventDefault(); openDocsSymbol(b.getAttribute('data-doc')); });
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
    return docsPages.filter(function (p) { return p.k === k || (p.also || []).indexOf(k) >= 0; })
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
    ['typedefs', 'Typedefs', owners('typedef')]
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
  /* The eight section names in the right-hand rail, the way every other page of the reference has a
     jump-to list. The landing page is the longest page in the app — 335 classes before Constants
     even starts — and it was the one page with no way to skip down it. */
  const toc = $('docsToc');
  if (toc) {
    toc.innerHTML = '<div class="dt-title">Jump to</div>'
      + secs.map(function (s) {
        return '<a class="dt-item" href="#sec-' + s[0] + '" data-jump="sec-' + s[0] + '">'
          + esc(s[1]) + '</a>';
      }).join('');
    toc.querySelectorAll('[data-jump]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const el = document.getElementById(link.getAttribute('data-jump'));
        if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });
  }
}
