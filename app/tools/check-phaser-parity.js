/* check-phaser-parity.js — compares our rendered API pages against docs.phaser.io, page by page.
 *
 * WHY THIS EXISTS
 *
 * Because "it matches" kept being an opinion. The counts on the front page matched, and four pages
 * picked by hand matched, and that got reported as parity — while the actual pages still differed in
 * ways nobody had looked for, on any of the other 980. A claim about 984 pages needs a measurement
 * of 984 pages.
 *
 * So this fetches the real page from docs.phaser.io, renders ours from the same data with the real
 * renderDocsPage, reduces both to the same shape, and diffs them. What it reports is a count and a
 * list of differences, not a verdict.
 *
 * WHAT IT COMPARES
 *
 *   the section headings, in order          Inherited Members, Public Members, …
 *   the members in each, in order           every name under every heading
 *   each member's signature line            <instance> setVelocityX(value) / x: number
 *   which blocks each member carries        description, parameters, returns
 *   the page's own furniture                description, constructor, scope, extends, source
 *
 * It does NOT compare styling, and it does not compare their prose to ours word for word — the
 * descriptions come from the same JSDoc either way, and Phaser's site wraps them in its own markup.
 *
 *   node tools/check-phaser-parity.js                 a spread of 24 pages
 *   node tools/check-phaser-parity.js --all           every page (slow; be kind to their server)
 *   node tools/check-phaser-parity.js --n 80          a bigger sample
 *   node tools/check-phaser-parity.js Phaser.GameObjects.Arc  named pages
 *   node tools/check-phaser-parity.js --v <name>      one page, printing both shapes in full
 *
 * Network-dependent, so it is NOT part of `npm test`.
 */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const D = path.join(APP, 'public', 'phaser-docs');
const { JSDOM } = require(path.join(APP, 'node_modules', 'jsdom'));

/* ---------- our side ---------- */
const src = fs.readFileSync(path.join(APP, 'public', 'js', 'docs.js'), 'utf8');
/* THE REAL MARKDOWN RENDERER, the same vendored `marked` the app loads in the browser. A stub that
   only split paragraphs made every description containing a bullet list look shorter than Phaser's
   and reported a difference on a dozen pages that were in fact identical — the check was measuring
   its own stub. marked is a UMD bundle, so it runs here with a `window` shim and no DOM. */
const markedSrc = fs.readFileSync(path.join(APP, 'public', 'vendor', 'marked', 'marked.min.js'), 'utf8');
const markedGlobal = {};
new Function('window', 'globalThis', 'module', 'exports', markedSrc)
  .call(markedGlobal, markedGlobal, markedGlobal, undefined, undefined);
const marked = markedGlobal.marked;
if (!marked || typeof marked.parse !== 'function') {
  console.error('could not load vendored marked — descriptions cannot be compared honestly');
  process.exit(2);
}
const api = new Function('marked', `
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
/* No DOMPurify here: the input is Phaser's own JSDoc, and this process renders to a string it
   measures rather than to a page anybody views. */
function mdToSafeHTML(md){ return marked.parse(String(md == null ? '' : md)); }
${src}
return { renderDocsPage: renderDocsPage, docsGroups: docsGroups, setData: function (i, p, m) {
  docsIndex = i; docsPages = p; docsMeta = m;
  docsLongnames = new Set(i.map(function (e) { return e.ln; }));
  docsGroupCache = null;
}, setOpen: function (id) { docsNavOpenId = id; } };
`)(marked);

const idx = [];
fs.readFileSync(path.join(D, 'index.tsv'), 'utf8').split('\n').forEach(function (L) {
  const a = L.indexOf('\t'); if (a < 0) return;
  const b = L.indexOf('\t', a + 1); if (b < 0) return;
  const ln = L.slice(0, a);
  let cut = ln.lastIndexOf('#'); const dot = ln.lastIndexOf('.');
  if (dot > cut) cut = dot;
  idx.push({ ln: ln, nm: cut >= 0 ? ln.slice(cut + 1) : ln, k: L.slice(a + 1, b), p: +L.slice(b + 1) });
});
const pages = fs.readFileSync(path.join(D, 'pages.tsv'), 'utf8').split('\n').map(function (L) {
  const p = L.split('\t');
  if (p.length < 3) return null;
  return { ln: p[0], nm: p[0].split('.').pop(), k: p[1], p: +p[2], also: p[3] ? p[3].split(',') : null };
}).filter(Boolean);
const meta = JSON.parse(fs.readFileSync(path.join(D, 'meta.json'), 'utf8'));
api.setData(idx, pages, meta);

/* ---------- their side ----------
   THE URL IS THE BRANCH, NOT THE SYMBOL'S KIND, and that distinction is why this had to be reworked.
   docs.phaser.io has one page per (branch, symbol) pair, with a DIFFERENT TEMPLATE for each branch:
   Phaser.Animations.Events is /namespace/animations-events, titled "Phaser.Animations.Events" with
   its members under "Static functions", AND /event/animations-events, titled "Animations.Events".
   Phaser.Core is a namespace page of static functions AND a constants page of config values.

   Checking one kind per symbol is what let whole templates go unnoticed: the constants and typedef
   branches were each missing their entire page shape and nothing here reported it, because the
   checker was asking for the wrong URL.

   Slug: the longname without "Phaser.", lowercased, dots to dashes. */
function theirUrl(branch, ln) {
  const slug = ln.replace(/^Phaser\.?/, '').replace(/\./g, '-').toLowerCase() || 'phaser';
  return 'https://docs.phaser.io/api-documentation/' + branch + '/' + slug;
}

const LABELS = /^(Description:|Parameters:?|Returns:|Constructor|Extends|Scope:|Constants:|From .+:)$/;

/* One shape, produced the same way from either side, so a diff is a diff and not a formatting
   argument. Their markup is h2/h3/h4/p/blockquote/ul; ours is h2/h3/.dc-sig/.dc-lab/.dc-src/ul. */
function shapeFrom(doc, root, sel) {
  const out = [];
  root.querySelectorAll(sel).forEach(function (el) {
    const t = el.textContent.trim().replace(/​/g, '').replace(/\s+/g, ' ');
    const tag = el.tagName;
    if (tag === 'H2') { out.push({ t: 'section', v: t }); return; }
    if (tag === 'H3') { out.push({ t: 'member', v: t }); return; }
    if (tag === 'H4' || el.classList.contains('dc-sig')) { out.push({ t: 'sig', v: t }); return; }
    if (tag === 'UL') { out.push({ t: 'names', v: [...el.querySelectorAll('li')].map(function (li) { return li.textContent.trim(); }).join(',') }); return; }
    if (tag === 'BLOCKQUOTE' || el.classList.contains('dc-src') || el.classList.contains('dc-ext')) {
      /* Their blockquote is used for BOTH the Extends list and Source/Since; ours are separate
         elements. Normalise on content so the two shapes can be compared at all — .dc-ext was not
         even being collected, so every "Extends" on our side read as missing. */
      if (/^Source:/.test(t)) { out.push({ t: 'source', v: t.replace(/\s+/g, ' ') }); return; }
      out.push({ t: 'extends', v: t.split(/[\s|,]+/).filter(Boolean).sort().join(' ') }); return;
    }
    if (tag === 'TABLE') { out.push({ t: 'params', v: el.querySelectorAll('tbody tr').length + ' rows' }); return; }
    if (LABELS.test(t)) { out.push({ t: 'label', v: t.replace(/:$/, '') }); return; }
  });
  return out;
}
function theirShape(html) {
  const doc = new JSDOM(html).window.document;
  const h1 = doc.querySelector('h1');
  if (!h1) return null;
  /* THE ARTICLE, not "the first ancestor containing an h2". A constants page has no h2 at all — its
     entries are h3 — so that climb walked all the way to <body> and swept their site's navigation
     into the comparison: the version dropdown, the whole left rail, the breadcrumb. Every constants
     page then reported forty "missing" lists that were menus, not documentation. */
  let c = h1.closest('article') || h1.parentElement;
  while (c && c !== doc.body && !c.querySelector('h2') && !c.querySelector('h3') && c.parentElement) {
    c = c.parentElement;
  }
  if (!c) c = doc.body;
  /* THEIR CHROME IS NOT THEIR CONTENT. The article element carries the breadcrumb trail, the mobile
     "On this page" collapsible and the version badge, and ours strips its equivalents — so leaving
     theirs in reported the breadcrumb as a missing list on every single page. */
  c.querySelectorAll('nav,[class*="breadcrumb"],[class*="tocCollapsible"],[class*="theme-doc-toc"],[class*="pagination"]')
    .forEach(function (e) { e.remove(); });
  c.querySelectorAll('*').forEach(function (e) {
    if (e.children.length === 0 && /^Version: Phaser v/.test(e.textContent.trim())) e.remove();
  });
  return [pageDesc(c, 'h2')].concat(shapeFrom(doc, c, 'h2,h3,h4,p,ul,blockquote,table'));
}
/* THE PAGE'S OPENING PROSE, which this used to skip on the grounds that it is the same JSDoc on both
   sides. It was not: every class page in our build had lost it, because jsdoc files a class's
   description under `classdesc` and the builder only read `description`. A check that skips a field
   cannot find a bug in that field.

   PRESENT OR ABSENT, AND ROUGHLY THE RIGHT LENGTH — not an exact word count. The same JSDoc runs
   through two different markdown renderers, so backticks, bullet lists and nowrap spans land as
   different numbers of "words" on each side; an exact comparison reported a difference on every page
   that contains a code span. Bucketed to the nearest 25 words, which still catches what actually
   goes wrong: a description missing altogether, or truncated. */
function descNode(all) {
  return { t: 'desc', n: all ? all.split(/\s+/).length : 0 };
}
function pageDesc(root, stopAt) {
  const words = [];
  let n = root.querySelector(stopAt === 'h2' ? 'header, h1' : 'h2');
  n = n ? n.nextElementSibling : root.firstElementChild;
  while (n && !/^H[123]$/.test(n.tagName)) {
    const t = n.textContent.trim().replace(/\s+/g, ' ');
    /* A PREFIX TEST, not an exact one. "Scope: static" is a label with its value on the same line,
       so an anchored match let it through and every namespace page reported a two-word description
       that does not exist. */
    if (n.tagName === 'P' && t && !/^(Description:|Parameters:?|Returns:|Constructor|Extends|Scope:|Constants:|Tags:|From )/.test(t)) words.push(t);
    n = n.nextElementSibling;
  }
  return descNode(words.join(' '));
}
function ourShape(html) {
  const doc = new JSDOM('<div id=r>' + html + '</div>').window.document;
  const root = doc.getElementById('r');
  /* Drop the furniture Phaser's page does not have in its article body — including the page TITLE,
     which is an <h2> here and an <h1> there and was otherwise counted as a section, so every page in
     the reference reported one extra section that did not exist. */
  root.querySelectorAll('.dc-crumbs,.dc-ver,.dt-item,.dt-head,.dt-title,.dc-search,.dc-results,.dc-nav,.dc-toc').forEach(function (e) { e.remove(); });
  const phead = root.querySelector('.phead');
  const desc = pageDescOurs(root);
  if (phead) phead.remove();
  /* EVERY `ul`, not just the inherited-member ones. Their side collects all of them — the bullet
     lists inside JSDoc descriptions as well as the index lists — so restricting ours to `ul.dc-inh`
     reported a missing list on every page whose prose contains one, none of which were missing. */
  return [desc].concat(shapeFrom(doc, root, 'h2,h3,.dc-sig,.dc-lab,.dc-line.dc-ext,.dc-src,ul,table.dc-table'));
}
/* Our description is the run of prose between the title block and the first heading. */
function pageDescOurs(root) {
  const p = root.querySelector('.dc-page');
  if (!p) return descNode('');
  const words = [];
  let n = p.firstElementChild;
  while (n && !/^H[123]$/.test(n.tagName)) {
    /* PARAGRAPHS ONLY, because that is all their side counts. A description containing a bullet
       list or a fenced block put that text into our word count and not into theirs, so MatterPhysics
       read ~200w here against ~125w there while both were rendering the same JSDoc. */
    if (n.classList.contains('dc-prose')) {
      n.querySelectorAll(':scope > p').forEach(function (p) {
        const t = p.textContent.trim().replace(/\s+/g, ' ');
        if (t) words.push(t);
      });
    }
    n = n.nextElementSibling;
  }
  return descNode(words.join(' '));
}

/* `Returns:` is a label on their side and a line on ours; both reduce to the same entry. */
function normalise(list) {
  return list.filter(function (e) { return e.t !== 'label' || e.v !== 'Parameters'; })
    .map(function (e) {
      if (e.t === 'label' && /^Returns/.test(e.v)) return { t: 'label', v: 'Returns' };
      if (e.t === 'label' && /^Scope/.test(e.v)) return { t: 'label', v: 'Scope' };
      if (e.t === 'label' && /^From /.test(e.v)) return { t: 'from', v: e.v.replace(/:$/, '') };
      if (e.t === 'source') return { t: 'source', v: e.v.replace(/\s+/g, ' ') };
      return e;
    });
}
const key = function (e) { return e.t + '|' + e.v; };

async function compare(pg, branch, verbose) {
  const url = theirUrl(branch, pg.ln);
  let html;
  try {
    const res = await fetch(url);
    if (!res.ok) return { pg: pg, branch: branch, skip: 'HTTP ' + res.status };
    html = await res.text();
  } catch (e) { return { pg: pg, branch: branch, skip: e.message }; }

  const theirs = theirShape(html);
  if (!theirs) return { pg: pg, branch: branch, skip: 'no <h1> — page shape not recognised' };
  const file = path.join(D, 'pages', pg.p + '.json');
  let page = JSON.parse(fs.readFileSync(file, 'utf8'));
  /* Render it the way the app renders it when the reader arrived through THIS branch — the branch
     picks the title, the breadcrumb and, for typedefs and constants, the whole page template. */
  api.setOpen(branch);
  if (branch === 'typedef') {
    const kids = (page.kids || []).filter(function (k) { return k[1] === 'typedef'; });
    if (kids.length) {
      page = Object.assign({}, page, {
        inline: kids.map(function (k) {
          return JSON.parse(fs.readFileSync(path.join(D, 'pages', k[2] + '.json'), 'utf8'));
        })
      });
    }
  }
  const ours = ourShape(api.renderDocsPage(page));

  /* THE DESCRIPTION IS COMPARED BY LENGTH, WITH A TOLERANCE, and pulled out of the exact diff. Two
     markdown renderers disagree on where a word ends — a code span, a nowrap span, a hyphenated
     type name — so the same paragraph counts a few words differently on each side. Within 15% is
     the same text; anything further apart is missing or truncated, which is what this is for. */
  const theirDesc = theirs.shift(), ourDesc = ours.shift();
  const big = Math.max(theirDesc.n, ourDesc.n);
  const descOk = big === 0 || Math.abs(theirDesc.n - ourDesc.n) / big <= 0.15;

  const T = normalise(theirs).map(key);
  const O = normalise(ours).map(key);
  if (verbose) {
    console.log('--- THEIRS (' + T.length + ') ---'); T.forEach(function (l) { console.log('  ' + l); });
    console.log('--- OURS   (' + O.length + ') ---'); O.forEach(function (l) { console.log('  ' + l); });
  }
  const tset = {}, oset = {};
  T.forEach(function (k) { tset[k] = (tset[k] || 0) + 1; });
  O.forEach(function (k) { oset[k] = (oset[k] || 0) + 1; });
  const missing = [], extra = [];
  Object.keys(tset).forEach(function (k) { const d = tset[k] - (oset[k] || 0); if (d > 0) missing.push(k + (d > 1 ? ' x' + d : '')); });
  Object.keys(oset).forEach(function (k) { const d = oset[k] - (tset[k] || 0); if (d > 0) extra.push(k + (d > 1 ? ' x' + d : '')); });
  const secT = T.filter(function (k) { return k.indexOf('section|') === 0; });
  const secO = O.filter(function (k) { return k.indexOf('section|') === 0; });
  if (!descOk) {
    (theirDesc.n > ourDesc.n ? missing : extra)
      .push('description ' + theirDesc.n + 'w theirs vs ' + ourDesc.n + 'w ours');
  }
  return {
    pg: pg, branch: branch, url: url,
    nodes: [T.length, O.length],
    sectionsMatch: secT.join('>') === secO.join('>'),
    sectionsT: secT.map(function (s) { return s.slice(8); }),
    sectionsO: secO.map(function (s) { return s.slice(8); }),
    missing: missing, extra: extra
  };
}

/* EVERY BRANCH THE RAIL HAS, sampled across each — because a branch is a template, and a template
   that is wrong is wrong on all of its pages at once. Reading the branches out of docsGroups is what
   makes this cover the reference rather than a list somebody typed: add a branch to the nav and it
   is checked here without anyone remembering to add it. */
function branchTargets(perBranch) {
  const out = [];
  api.docsGroups().forEach(function (g) {
    if (g.flat) return;                       // Game Objects / Physics are index pages, not templates
    const list = g.list.filter(function (p) { return p.p >= 0 || pages.some(function (x) { return x.ln === p.ln; }); });
    const step = Math.max(1, Math.floor(list.length / perBranch));
    list.filter(function (_, i) { return i % step === 0; }).slice(0, perBranch).forEach(function (p) {
      const row = pages.filter(function (x) { return x.ln === p.ln; })[0];
      if (row) out.push({ pg: row, branch: g.id });
    });
  });
  return out;
}

(async function main() {
  const args = process.argv.slice(2);
  const verboseAt = args.indexOf('--v');
  const named = args.filter(function (a) { return a.indexOf('Phaser') === 0 || a === 'Class'; });
  const nAt = args.indexOf('--n');
  const bAt = args.indexOf('--branch');
  let targets;
  if (verboseAt >= 0) {
    const row = pages.filter(function (p) { return p.ln === args[verboseAt + 1]; })[0];
    targets = row ? [{ pg: row, branch: bAt >= 0 ? args[bAt + 1] : row.k }] : [];
  } else if (named.length) {
    targets = named.map(function (ln) { return pages.filter(function (p) { return p.ln === ln; })[0]; })
      .filter(Boolean).map(function (row) { return { pg: row, branch: bAt >= 0 ? args[bAt + 1] : row.k }; });
  } else {
    targets = branchTargets(Number(args[nAt + 1]) || 6);
  }
  console.log('comparing ' + targets.length + ' page(s) across '
    + [...new Set(targets.map(function (t) { return t.branch; }))].join(', ') + '\n');

  let ok = 0, diff = 0, skipped = 0;
  const byBranch = {};
  for (const target of targets) {
    const pg = target.pg;
    const tag = target.branch + '/' + pg.ln;
    const b = byBranch[target.branch] || (byBranch[target.branch] = { ok: 0, diff: 0, skip: 0 });
    const r = await compare(pg, target.branch, verboseAt >= 0);
    if (r.skip) { skipped++; b.skip++; console.log('  skip  ' + tag + '  (' + r.skip + ')'); continue; }
    const clean = !r.missing.length && !r.extra.length && r.sectionsMatch;
    if (clean) { ok++; b.ok++; console.log('  ok    ' + tag); }
    else {
      diff++; b.diff++;
      console.log('  DIFF  ' + tag + '   nodes ' + r.nodes[0] + ' vs ' + r.nodes[1]);
      if (!r.sectionsMatch) {
        console.log('          sections theirs: ' + JSON.stringify(r.sectionsT));
        console.log('          sections ours:   ' + JSON.stringify(r.sectionsO));
      }
      r.missing.slice(0, 6).forEach(function (m) { console.log('          missing: ' + m.slice(0, 110)); });
      if (r.missing.length > 6) console.log('          … ' + (r.missing.length - 6) + ' more missing');
      r.extra.slice(0, 6).forEach(function (m) { console.log('          extra:   ' + m.slice(0, 110)); });
      if (r.extra.length > 6) console.log('          … ' + (r.extra.length - 6) + ' more extra');
    }
  }
  /* Per branch as well as overall, because a branch IS a template: six failures spread evenly are
     six page bugs, and six failures all inside one branch are one template bug. */
  console.log('\nby branch:');
  Object.keys(byBranch).sort().forEach(function (k) {
    const b = byBranch[k];
    console.log('  ' + k.padEnd(12) + b.ok + ' match, ' + b.diff + ' differ'
      + (b.skip ? ', ' + b.skip + ' skipped' : ''));
  });
  console.log('\n' + ok + ' match, ' + diff + ' differ, ' + skipped + ' skipped');
  process.exit(diff ? 1 : 0);
}()).catch(function (e) { console.error(e); process.exit(2); });
