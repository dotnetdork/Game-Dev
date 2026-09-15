/* build-phaser-docs.js — turns Phaser's own API documentation into something this app can serve.
 *
 * WHY THIS EXISTS
 *
 * The Docs tab used to be a dozen hand-written cards and a button that opened phaser.io in a new
 * window. On a school network that button is a dead end — the filter blocks it — and even where it
 * works it takes a twelve-year-old out of the app, onto a site written for professional developers,
 * with no way back. "Nothing should link elsewhere" is the requirement; this is how that is met.
 *
 * WHERE THE CONTENT COMES FROM, and why it is not scraped
 *
 * Phaser's API documentation is JSDoc comments in its own source. Its build (scripts/tsgen) dumps
 * every doclet to `types/phaser.json`, already stripped of private and undocumented members, and
 * SHIPS THAT FILE ON NPM. So the same data the official docs are generated from is a dependency
 * away — no scraping, no HTML parsing, no guessing.
 *
 * That matters legally as well as practically. Phaser is MIT, and the MIT grant covers "this
 * software and associated documentation files"; the JSDoc comments live in src/, so phaser.json is
 * a mechanical derivative of the Software and redistributing it is clean. Phaser's LICENSE.md is
 * copied out beside the generated files so the notice travels with the copy.
 *
 * Two things are deliberately NOT taken: the narrative guides on docs.phaser.io, which are not in
 * any public repo and carry no stated licence, and the phaserjs/examples repo, which has no licence
 * file at all.
 *
 * WHAT IT PRODUCES
 *
 *   meta.json     version, counts, the licence notice
 *   index.tsv     every symbol, one per line, for the search box
 *   pages/N.json  one file per class, namespace or typedef — the unit a reader actually opens
 *
 * The source is 46 MB and two thirds of that is redundant: `comment` repeats the raw JSDoc block
 * that every other field was parsed out of, and `parsedType` is a syntax tree for a type string
 * that is already spelled out in `type.names`. Dropping those and keeping only what a page renders
 * takes it to about a tenth of the size, split across a thousand files with a median of two
 * kilobytes — so opening a page costs one small fetch rather than a download of the whole API.
 *
 *   node tools/build-phaser-docs.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'phaser-docs');
const PAGES = path.join(OUT, 'pages');

/* The doclet dump, from wherever Phaser is installed. Checked in order so this runs from a plain
   `npm install` as well as from a tarball somebody unpacked by hand. */
function findSource() {
  /* THE GENERATED DUMP FIRST, and the published one only as a fallback. types/phaser.json is what
     npm ships and it is missing Phaser.Physics.Arcade.ProcessX and ProcessY — twelve @ignore'd
     functions that Phaser's own site renders, because their docs build keeps @ignore and their
     package build does not. tools/build-phaser-doclets.js regenerates the full set from Phaser's
     source at the pinned tag; `npm run build:docs` runs it first.
     Falling back rather than failing, so a checkout with no jsdoc still builds a reference — one
     that is two namespaces short, and says so. */
  const pkg = path.join(__dirname, '..', 'package.json');
  let ver = '';
  try { ver = String(JSON.parse(fs.readFileSync(pkg, 'utf8')).devDependencies.phaser || '').replace(/^[^0-9]*/, ''); }
  catch (e) { /* fall through to the plain lookups */ }
  const tries = [
    process.argv[2],
    ver && path.join(__dirname, '..', '.cache', 'phaser-doclets-' + ver + '.json'),
    path.join(__dirname, '..', 'node_modules', 'phaser', 'types', 'phaser.json'),
    path.join(__dirname, '..', '..', 'node_modules', 'phaser', 'types', 'phaser.json')
  ].filter(Boolean);
  for (const p of tries) if (fs.existsSync(p)) return p;
  return null;
}
function findLicence(srcPath) {
  const pkgRoot = path.join(path.dirname(srcPath), '..');
  for (const n of ['LICENSE.md', 'LICENSE', 'license.md']) {
    const p = path.join(pkgRoot, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const SRC = findSource();
if (!SRC) {
  console.error('Could not find phaser/types/phaser.json.');
  console.error('Install it as a build-time source:  npm i -D phaser');
  console.error('or pass the path:  node tools/build-phaser-docs.js <path to phaser.json>');
  process.exit(1);
}

const pkgJson = path.join(path.dirname(SRC), '..', 'package.json');
const version = fs.existsSync(pkgJson) ? JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version : 'unknown';

console.log('reading ' + SRC + ' (' + (fs.statSync(SRC).size / 1048576).toFixed(1) + ' MB)');
const all = JSON.parse(fs.readFileSync(SRC, 'utf8'));
console.log('doclets: ' + all.length);

/* ---------- what a page is ----------
   A class, a namespace, an interface or a typedef. Everything else — a method, a property, an
   event, a constant — belongs to one of those and is rendered inside it. That is the unit a reader
   opens: nobody navigates to a single method without wanting the class around it. */
const PAGE_KINDS = { class: 1, namespace: 1, interface: 1, typedef: 1, mixin: 1 };
/* Which kind wins when a longname is documented as more than one. Phaser's own site files
   Phaser.Display.Color — documented as a class AND a namespace — under Classes, so class outranks
   namespace here too. Lower is stronger. */
const PAGE_RANK = { class: 0, interface: 1, mixin: 2, typedef: 3, namespace: 4 };
/* A typedef that is really a function signature is documentation for a callback, which reads as a
   page of its own; a plain object typedef is a config bag, which also does. Both stay. */

/* One line, for the places that are one line — a parameter's note, a return value's note. */
/* THE LEADING HYPHEN IS JSDOC'S SEPARATOR, NOT PROSE. Phaser writes `@return {Phaser.Time.Clock} -
   This Clock instance.` and jsdoc hands back the description still carrying "- ". Rendered through
   marked that is a bullet list, so three of Clock's return values became single-item lists where
   Phaser prints them inline after the type. Stripped once here rather than guarded at every use. */
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/^-\s+/, '');

/* A DESCRIPTION IS MARKDOWN AND MUST STAY THAT WAY. Phaser writes these as real markdown: `code`
   in backticks, hyphen bullet lists, blank lines between paragraphs. Collapsing every run of
   whitespace — which is what this used to do to everything — turned a structured explanation into
   one unbroken wall of text with visible backticks in the middle of it. Phaser.Actions.AddEffectBloom
   became a 200-word paragraph nobody would read.

   So newlines survive, trailing space on each line goes, and runs of blank lines collapse to one.
   The reader passes it through marked and DOMPurify, the same pair the lessons already use. */
const cleanMd = (s) => String(s == null ? '' : s)
  .replace(/\r\n/g, '\n')
  .split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/* Type names, as written. `parsedType` is an AST of the same string and is the single biggest
   contributor to the source file's size. */
function typeNames(t) {
  if (!t || !Array.isArray(t.names)) return [];
  return t.names.map(String);
}
function slimParams(ps) {
  if (!Array.isArray(ps)) return undefined;
  const out = ps.map(function (p) {
    const o = { n: p.name || '' };
    const t = typeNames(p.type); if (t.length) o.t = t;
    if (p.optional) o.o = 1;
    if (p.defaultvalue !== undefined) o.d = String(p.defaultvalue);
    const d = clean(p.description); if (d) o.x = d;
    return o;
  });
  return out.length ? out : undefined;
}
function slimReturns(rs) {
  if (!Array.isArray(rs) || !rs.length) return undefined;
  const r = rs[0];
  const o = {};
  const t = typeNames(r.type); if (t.length) o.t = t;
  const d = clean(r.description); if (d) o.x = d;
  return Object.keys(o).length ? o : undefined;
}

/* Where it is written, the way Phaser prints it: "src/animations/events/index.js#L7". `meta.path` is
   absolute and is Rich Davey's own drive — D:\wamp\www\phaser\src\... — so only the part from `src`
   onwards is kept. It is shown as TEXT and not as a link: Phaser's links to GitHub, and nothing in
   this app leaves the app. */
function sourceOf(d) {
  const m = d.meta;
  if (!m || !m.filename) return undefined;
  const dir = String(m.path || '').replace(/\\/g, '/');
  const cut = dir.indexOf('/src/');
  const rel = cut >= 0 ? dir.slice(cut + 1) : (dir.split('/').pop() || '');
  return (rel ? rel + '/' : '') + m.filename + (m.lineno ? '#L' + m.lineno : '');
}

/* One member, as a page renders it. Short keys because there are twenty thousand of them. */
function slimMember(d) {
  const o = { n: d.name || '', k: d.kind || '' };
  /* THE LINE IT IS DECLARED ON. Phaser's class pages list members alphabetically, but its constants
     pages list them in SOURCE order — Phaser.TintModes reads MULTIPLY, FILL, ADD, SCREEN, OVERLAY,
     HARD_LIGHT there and ADD, FILL, HARD_LIGHT… here. Carrying the line number is the only way to
     put them back in the order they were written. */
  if (d.meta && d.meta.lineno) o.ln = d.meta.lineno;
  if (d.scope === 'static') o.s = 1;
  const src = sourceOf(d); if (src) o.src = src;
  const x = cleanMd(d.description); if (x) o.x = x;
  const p = slimParams(d.params); if (p) o.p = p;
  const r = slimReturns(d.returns); if (r) o.r = r;
  const t = typeNames(d.type); if (t.length) o.t = t;
  if (d.since) o.since = String(d.since);
  if (d.readonly) o.ro = 1;
  if (d.inherited && d.inherits) o.from = String(d.inherits);
  if (d.overrides) o.over = String(d.overrides);
  if (Array.isArray(d.fires) && d.fires.length) o.fires = d.fires.map(String);
  /* THE CUSTOM TAGS PHASER PRINTS — @generic, @genericUse, @webglOnly. Its config sets
     allowUnknownTags, so jsdoc keeps them, and its template renders their NAMES as a "Tags:" list
     between the description and the parameters. 2,689 of them across the API: nineteen on
     Phaser.GameObjects.Container alone, and every one was being dropped here. The values are
     TypeScript codegen hints and Phaser does not print them either — only the names. */
  if (Array.isArray(d.tags) && d.tags.length) {
    o.tags = d.tags.map(function (t) { return String(t.originalTitle || t.title || ''); })
      .filter(Boolean);
    if (!o.tags.length) delete o.tags;
  }
  /* Only 151 doclets in the whole of Phaser carry one, so this costs almost nothing and is the most
     useful thing on the page when it is there. */
  if (Array.isArray(d.examples) && d.examples.length) o.eg = d.examples.map(String).slice(0, 3);
  return o;
}

/* ---------- group ---------- */
const pageByName = new Map();          // longname -> page object
const orphans = [];

all.forEach(function (d) {
  if (!d || !d.longname) return;
  /* `ignore` IS NOT FILTERED HERE, and that is deliberate.
     Phaser's own scripts/tsgen/bin/publish.js ends with `data({ ignore: true }).remove()`, which is
     the single reason Phaser.Physics.Arcade.ProcessX and ProcessY — twelve @ignore'd collision
     helpers — have never existed in the phaser.json published on npm, while docs.phaser.io renders
     both. Filtering them a second time here put the gap back even when the source had them.
     The dump this reads has already had Phaser's other four removals applied. */
  if (d.access === 'private' || d.undocumented) return;
  if (PAGE_KINDS[d.kind]) {
    /* A class and its constructor share a longname; keep the first and let the later one fill in
       anything missing rather than replacing the page wholesale. */
    if (!pageByName.has(d.longname)) {
      pageByName.set(d.longname, {
        longname: d.longname,
        name: d.name || d.longname,
        kind: d.kind,
        memberof: d.memberof || '',
        /* A CLASS KEEPS ITS PROSE IN `classdesc`, NOT `description`. jsdoc splits the two: the text
           above `@class` describes the class and lands in classdesc, while `description` is left for
           the constructor and is empty on all but six of Phaser's 335 classes. Reading only
           `description` silently dropped the opening paragraphs of every class page in the
           reference — 825 of 984 pages arrived with nothing under the title. */
        description: cleanMd(d.classdesc || d.description),
        scope: d.scope || '',
        src: sourceOf(d) || '',
        since: d.since ? String(d.since) : '',
        extends: Array.isArray(d.augments) ? d.augments.map(String) : [],
        ctor: null,
        props: Array.isArray(d.properties) && d.properties.length ? slimParams(d.properties) : null,
        /* A typedef's own type — "object", "function" — which Phaser prints under its table. */
        type: typeNames(d.type),
        members: []
      });
    }
    const pg = pageByName.get(d.longname);
    /* EVERY kind this longname is documented as, not just the winning one. Phaser.Display.Color is
       both a class and a namespace, and docs.phaser.io lists it under BOTH Classes and Namespaces —
       254 namespaces there against our 253 once the page itself is filed as a class. One page, two
       places to find it, which is what Phaser does. */
    (pg.kinds || (pg.kinds = {}))[d.kind] = 1;
    /* THE KIND CAN BE WRONG UNTIL THE REAL DOCLET TURNS UP, and it was staying wrong.

       Two ways a page ends up mislabelled. A member can appear in the dump BEFORE its owner's own
       doclet, and the stub made for it below guesses "namespace" — so Phaser.Geom.Circle,
       GameObjectFactory, PathFollower and FilterList were all filed as namespaces and vanished from
       the Classes list, ten of them against docs.phaser.io. And Phaser.Display.Color is documented
       as BOTH a class and a namespace, where Phaser's own site picks class.

       So a later doclet may upgrade the kind, and class outranks namespace. Everything else about
       the page is still filled in rather than replaced. */
    if (pg.stub || PAGE_RANK[d.kind] < PAGE_RANK[pg.kind]) {
      pg.kind = d.kind;
      pg.name = d.name || pg.name;
      pg.memberof = d.memberof || pg.memberof;
      pg.scope = d.scope || pg.scope;
      pg.src = sourceOf(d) || pg.src;
      delete pg.stub;
    }
    /* A TYPEDEF'S FIELDS ARE `@property` TAGS, not member doclets. jsdoc hands them back on the
       typedef's own doclet as `properties`, in the same shape as `params`, and nothing here was
       reading them — so every one of Phaser's 396 typedef pages came out as a name, a sentence and
       nothing else, where its page on docs.phaser.io is a table of the fields the object holds.
       Phaser.Device.Audio alone documents eleven of them. */
    if (Array.isArray(d.properties) && d.properties.length && !pg.props) {
      pg.props = slimParams(d.properties);
    }
    /* A typedef can be a CALLBACK SIGNATURE rather than an object bag — EachTileCallback,
       DataEachCallback and eighty others. Those carry params and a return instead of properties,
       and Phaser prints them the same way it prints a method's. */
    if (Array.isArray(d.params) && d.params.length && !pg.params && d.kind !== 'class') {
      pg.params = slimParams(d.params);
    }
    if (Array.isArray(d.returns) && d.returns.length && !pg.ret) pg.ret = slimReturns(d.returns);
    if (!pg.description) pg.description = cleanMd(d.classdesc || d.description);
    /* `since` the same way. A class and its constructor share a longname and only one of the two
       carries it, so whichever doclet arrived first decided — and the pages that lost the coin toss
       printed "Source: …" where Phaser prints "Source: …  Since: 3.0.0". */
    if (!pg.since && d.since) pg.since = String(d.since);
    if (d.kind === 'class' && Array.isArray(d.params) && d.params.length && !pg.ctor) {
      pg.ctor = { p: slimParams(d.params) };
    }
    if (Array.isArray(d.augments) && d.augments.length && !pg.extends.length) {
      pg.extends = d.augments.map(String);
    }
    return;
  }
  if (!d.memberof) { orphans.push(d); return; }
  const owner = d.memberof;
  if (!pageByName.has(owner)) {
    /* A member whose owner was never documented as a class or namespace. Phaser has a handful.
       Make a stub so the member is still reachable rather than dropped on the floor. */
    pageByName.set(owner, {
      longname: owner, name: owner.split('.').pop() || owner, kind: 'namespace',
      memberof: owner.split('.').slice(0, -1).join('.'), description: '', since: '',
      extends: [], ctor: null, members: [], stub: true
    });
  }
  pageByName.get(owner).members.push(slimMember(d));
});

/* ---------- write ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(PAGES, { recursive: true });

const pages = Array.from(pageByName.values())
  .sort(function (a, b) { return a.longname < b.longname ? -1 : a.longname > b.longname ? 1 : 0; });

/* Members in a sensible reading order: what it is made of, then what it can do, then what it
   announces. Inherited members last within each, because a child is looking for the class's own. */
const KIND_ORDER = { member: 0, constant: 1, function: 2, event: 3 };
/* CASE-INSENSITIVELY, the way Phaser orders its own lists. A plain `<` compares by code point, so
   every capital sorts before every lowercase: `addToDisplayList` came before `addedToScene` because
   'T' is 84 and 'e' is 101. Phaser reads addedToScene, addToDisplayList, addToUpdateList. On a class
   like Arc that is most of a 60-name inherited list in a visibly different order. */
const byName = function (a, b) {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : (a < b ? -1 : a > b ? 1 : 0);
};
pages.forEach(function (pg) {
  pg.members.sort(function (a, b) {
    const ka = KIND_ORDER[a.k] === undefined ? 9 : KIND_ORDER[a.k];
    const kb = KIND_ORDER[b.k] === undefined ? 9 : KIND_ORDER[b.k];
    if (ka !== kb) return ka - kb;
    if (!!a.from !== !!b.from) return a.from ? 1 : -1;
    return byName(a.n, b.n);
  });
});

const idOf = new Map();
pages.forEach(function (pg, i) { idOf.set(pg.longname, i); });

let bytes = 0, biggest = { n: '', b: 0 };
pages.forEach(function (pg, i) {
  const out = {
    l: pg.longname, n: pg.name, k: pg.kind, mo: pg.memberof,
    x: pg.description, since: pg.since,
    scope: pg.scope || undefined, src: pg.src || undefined,
    ext: pg.extends.length ? pg.extends : undefined,
    ctor: pg.ctor || undefined,
    props: pg.props || undefined,
    t: pg.type && pg.type.length ? pg.type : undefined,
    params: pg.params || undefined,
    ret: pg.ret || undefined,
    m: pg.members
  };
  /* Children of this page, so a namespace lists what is inside it rather than being a dead end. */
  const kids = pages.filter(function (p) { return p.memberof === pg.longname; })
    .map(function (p) { return [p.name, p.kind, idOf.get(p.longname)]; });
  if (kids.length) out.kids = kids;
  const s = JSON.stringify(out);
  bytes += s.length;
  if (s.length > biggest.b) biggest = { n: pg.longname, b: s.length };
  fs.writeFileSync(path.join(PAGES, i + '.json'), s);
});

/* ---------- the search index ----------
   Tab-separated and flat, because what a child types is a piece of an identifier — "velocity",
   "setScale", "overlap" — and a real search engine would stem and tokenise those into nonsense. A
   linear scan of twenty thousand short strings is a couple of milliseconds even on a Chromebook.

   Three columns, not four: the short name a child actually types is the last dotted piece of the
   longname, so carrying it separately repeated a quarter of the file for nothing. The reader splits
   it back out once, at load. */
const rows = [];
pages.forEach(function (pg, i) {
  rows.push([pg.longname, pg.kind, i].join('\t'));
  pg.members.forEach(function (m) {
    rows.push([pg.longname + (m.s ? '.' : '#') + m.n, m.k, i].join('\t'));
  });
});
const indexText = rows.join('\n');
fs.writeFileSync(path.join(OUT, 'index.tsv'), indexText);

/* Just the PAGES — every class, namespace, typedef and the rest — as their own small file. The
   landing page is a list of these grouped by kind, the way Phaser's own front page is, and picking
   them back out of the big index is not possible: a static constant like Phaser.Math.PI2 has no `#`
   in its name either, so there is nothing in a row that says "this one is a page". A thousand rows
   is forty kilobytes and it loads beside the index. */
/* A FOURTH COLUMN, present only on the handful of pages that need it: the other kinds this longname
   is documented as, comma-separated. Today that is exactly one row — Phaser.Display.Color, a class
   that is also a namespace — and it is what lets the Namespaces list reach 254 the way Phaser's
   does without inventing a second page. The reader treats a missing column as "no others". */
fs.writeFileSync(path.join(OUT, 'pages.tsv'), pages.map(function (pg, i) {
  const also = Object.keys(pg.kinds || {}).filter(function (k) { return k !== pg.kind; }).sort();
  const row = [pg.longname, pg.kind, i];
  if (also.length) row.push(also.join(','));
  return row.join('\t');
}).join('\n'));
/* And the same thing gzipped, which the reader prefers.
   A megabyte of plain text over a school connection is a wait a child will interpret as the app
   being broken, and this app has no compression middleware — deliberately, since its dependency
   list is four packages and means to stay that way. Chrome has had DecompressionStream since 80 and
   every machine this runs on is a Chromebook, so the browser can do the work instead: it fetches
   the .gz, unzips it natively, and falls back to the plain file anywhere that cannot. Roughly a
   tenth of the bytes for eight lines of client code and no new dependency. */
const gz = require('zlib').gzipSync(Buffer.from(indexText, 'utf8'), { level: 9 });
fs.writeFileSync(path.join(OUT, 'index.tsv.gz'), gz);

const licSrc = findLicence(SRC);
let licence = '';
if (licSrc) {
  licence = fs.readFileSync(licSrc, 'utf8');
  fs.writeFileSync(path.join(OUT, 'LICENSE.md'), licence);
}

/* The top-level namespaces, with what is in them, so the Browse section can say what each one is
   for instead of being thirty identical chips. Cheap to carry here — thirty rows — and it saves the
   reader thirty fetches to find out which of them holds the thing about collisions. */
const tops = pages.filter(function (pg) {
  return pg.memberof === 'Phaser' && (pg.kind === 'namespace' || pg.kind === 'class');
}).map(function (pg) {
  const prefix = pg.longname + '.';
  const inside = pages.filter(function (p) { return p.longname.indexOf(prefix) === 0; }).length;
  return {
    n: pg.name, l: pg.longname, k: pg.kind, id: idOf.get(pg.longname),
    x: pg.description.slice(0, 180),
    c: inside, m: pg.members.length
  };
}).sort(function (a, b) { return a.n < b.n ? -1 : 1; });

fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  version: version,
  tops: tops,
  generated: new Date().toISOString().slice(0, 10),
  doclets: all.length,
  pages: pages.length,
  symbols: rows.length,
  source: 'phaser/types/phaser.json',
  licence: 'MIT',
  notice: 'Phaser © Richard Davey, Phaser Studio Inc. Released under the MIT License. '
    + 'This reference is generated from Phaser ' + version + "'s own source documentation."
}, null, 2));

console.log('pages:    ' + pages.length + '  (' + (bytes / 1048576).toFixed(2) + ' MB total, median '
  + Math.round(bytes / pages.length / 1024 * 10) / 10 + ' KB)');
console.log('biggest:  ' + biggest.n + ' at ' + Math.round(biggest.b / 1024) + ' KB');
console.log('index:    ' + rows.length + ' symbols, ' + Math.round(indexText.length / 1024) + ' KB'
  + '  (' + Math.round(gz.length / 1024) + ' KB gzipped)');
console.log('orphans:  ' + orphans.length + ' doclets with no owner (dropped)');
console.log('licence:  ' + (licSrc ? 'copied from ' + licSrc : 'NOT FOUND — ship it by hand'));
console.log('written to ' + OUT);
