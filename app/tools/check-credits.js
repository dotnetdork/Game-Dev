/* check-credits.js — the credits page names the versions that are actually shipped.
 *
 * The lesson pictures look after themselves: /api/credits is derived from the lessons, and
 * check-boot.js already proves the two agree. The rest of the credits page is a hand-written list —
 * the libraries in app/public/vendor, their versions and their licences — and a hand-written list of
 * versions is a list that goes stale the first time somebody updates one of them.
 *
 * So this reads the version out of each vendored file and fails if the page disagrees. A stale
 * licence page is not a cosmetic problem: two of the entries (Apache-2.0, and the CC BY pictures)
 * are conditions of use rather than courtesies, and claiming the wrong version of a library is
 * claiming the wrong licence text applies to it.
 *
 * Part of `npm test`, unlike check-release, because this one cannot be "correct but set for
 * development" — it is either true or it is wrong.
 */
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const PAGES = path.join(PUB, 'js', 'pages.js');
const VENDOR = path.join(PUB, 'vendor');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

const pages = fs.readFileSync(PAGES, 'utf8');

/* What the page claims, pulled out of the CREDIT_BROWSER table: ['Name', 'version', 'licence', … */
function claimed(name) {
  const re = new RegExp("\\[\\s*'" + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*,\\s*'([^']*)'\\s*,\\s*'([^']*)'");
  const m = pages.match(re);
  return m ? { version: m[1], licence: m[2] } : null;
}

function read(rel) {
  const p = path.join(VENDOR, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

/* Each entry says how to find the real version inside the shipped file. Deliberately reading the
   FILE and not a package.json: what matters is what the browser is handed. */
const LIBS = [
  {
    name: 'Phaser', file: 'phaser/phaser.min.js',
    find: function (s) { const m = s.match(/VERSION\s*:\s*"([\d.]+)"/); return m && m[1]; }
  },
  {
    name: 'CodeMirror', file: 'codemirror/lib/codemirror.js',
    find: function (s) { const m = s.match(/version\s*[:=]\s*"([\d.]+)"/i); return m && m[1]; }
  },
  {
    name: 'JSHint', file: 'jshint/jshint.js',
    find: function (s) { const m = s.match(/\/\*!\s*([\d.]+)\s*\*\//); return m && m[1]; }
  },
  {
    name: 'marked', file: 'marked/marked.min.js',
    find: function (s) { const m = s.match(/marked\s+v([\d.]+)/); return m && m[1]; }
  },
  {
    name: 'DOMPurify', file: 'dompurify/purify.min.js',
    find: function (s) { const m = s.match(/DOMPurify\s+([\d.]+)/); return m && m[1]; }
  },
  {
    name: 'js-yaml', file: 'js-yaml/js-yaml.min.js',
    find: function (s) { const m = s.match(/js-yaml\s+([\d.]+)/); return m && m[1]; }
  },
  {
    name: 'Material Design Icons', file: 'mdi/css/mdi-subset.css',
    find: function (s) { const m = s.match(/v([\d.]+)\)/); return m && m[1]; }
  }
];

LIBS.forEach(function (lib) {
  const src = read(lib.file);
  const said = claimed(lib.name);
  if (!src) { check(lib.name + ' is vendored', false, 'vendor/' + lib.file + ' is missing'); return; }
  if (!said) { check(lib.name + ' is on the credits page', false, 'no row for it in CREDIT_BROWSER'); return; }
  const real = lib.find(src);
  if (!real) { check(lib.name + ' declares its version in the shipped file', false, 'could not read one out of vendor/' + lib.file); return; }
  check('the credits page has the right version of ' + lib.name, said.version === real,
    said.version === real ? 'v' + real
      : 'page says ' + said.version + ', vendor/' + lib.file + ' is ' + real + ' — update CREDIT_BROWSER in js/pages.js');
});

/* Prettier ships no banner of any kind, so there is nothing to read it out of. Say so rather than
   passing silently on a version nobody checked. */
const prettier = claimed('Prettier');
check('Prettier is on the credits page', !!prettier,
  prettier ? 'v' + prettier.version + ' (not verifiable — the vendored build carries no version banner)'
    : 'no row for it in CREDIT_BROWSER');

/* The two that are licence CONDITIONS rather than courtesies. If either name stops appearing, the
   page has stopped doing the one job it is legally required to do. */
check('the Apache-2.0 notice is carried', /Apache-2\.0/.test(pages), 'DOMPurify and Material Design Icons');
check('the Store art names its author and licence', /Kenney/.test(pages) && /CC0/.test(pages), 'Kenney, CC0 1.0');
check('the lesson pictures are still served from the course itself',
  /\/api\/credits/.test(pages), 'derived, so it cannot fall behind the lessons');

/* The offline API reference describes a specific Phaser, and the game runs a specific Phaser. If
   those drift, the Docs tab confidently documents methods the student's game does not have — which
   is worse than having no reference at all, because it is wrong rather than absent. */
const metaPath = path.join(PUB, 'phaser-docs', 'meta.json');
if (!fs.existsSync(metaPath)) {
  check('the offline Phaser reference is built', false,
    'public/phaser-docs/meta.json is missing — run: npm run build:docs');
} else {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const engine = (function () {
    const s = read('phaser/phaser.min.js');
    const m = s && s.match(/VERSION\s*:\s*"([\d.]+)"/);
    return m && m[1];
  })();
  check('the API reference documents the engine that actually ships', meta.version === engine,
    meta.version === engine ? 'both Phaser ' + engine
      : 'reference is Phaser ' + meta.version + ', the game runs ' + engine
        + ' — rebuild with: npm run build:docs');
  check('the reference carries Phaser’s licence', fs.existsSync(path.join(PUB, 'phaser-docs', 'LICENSE.md')),
    'MIT requires the notice to travel with the copy');
  check('the reference has pages to serve', meta.pages > 100 && meta.symbols > 1000,
    meta.pages + ' pages, ' + meta.symbols + ' symbols');

  /* PROVENANCE. The reference is Phaser's own writing, generated from the doclet dump Phaser ships
     on npm — not paraphrased, not summarised, and not written by a model. That is a claim worth
     being able to check rather than be told, so this samples real descriptions out of the generated
     pages and proves each one appears, character for character, in Phaser's own file.

     Skipped when phaser is not installed, because it is a devDependency and the generated pages are
     committed: a fresh clone can run the suite without pulling 18 MB it does not otherwise need. */
  const srcPath = path.join(__dirname, '..', 'node_modules', 'phaser', 'types', 'phaser.json');
  if (!fs.existsSync(srcPath)) {
    console.log('SKIP  the reference is Phaser’s own words  — run `npm i` to install phaser and check it');
  } else {
    const src = fs.readFileSync(srcPath, 'utf8');
    const pagesDir = path.join(PUB, 'phaser-docs', 'pages');
    const files = fs.readdirSync(pagesDir).filter(function (f) { return /\.json$/.test(f); });
    const sample = [];
    /* Spread across the whole set rather than the first few, which are all typedefs. */
    for (let k = 0; k < 40 && sample.length < 25; k++) {
      const pg = JSON.parse(fs.readFileSync(path.join(pagesDir, files[Math.floor(files.length * k / 40)]), 'utf8'));
      const texts = [pg.x].concat((pg.m || []).map(function (m) { return m.x; }))
        .filter(function (t) { return t && t.length > 60; });
      if (texts.length) sample.push(texts[0]);
    }
    /* The dump is JSON, so its string literals escape quotes and backslashes and carry the JSDoc's
       own "\r\n * " between lines. Comparing decoded text against it therefore has to be done on a
       run that cannot contain any of that: the longest stretch of ordinary prose characters, which
       is identical in both. Anything shorter than forty characters is not distinctive enough to
       prove anything, so those samples are skipped rather than counted as passes. */
    const plainRun = function (t) {
      const runs = t.match(/[A-Za-z0-9 ,.;:'()\-]{40,}/g) || [];
      return runs.sort(function (a, b) { return b.length - a.length; })[0] || '';
    };
    const usable = sample.map(plainRun).filter(function (r) { return r.length >= 40; });
    const missing = usable.filter(function (r) { return src.indexOf(r) < 0; });
    check('every word of the reference is Phaser’s own', !missing.length && usable.length >= 10,
      missing.length
        ? missing.length + ' of ' + usable.length + ' sampled descriptions are NOT in phaser.json — first: '
          + JSON.stringify(missing[0].slice(0, 80))
        : usable.length + ' sampled descriptions found verbatim in phaser/types/phaser.json'
          + (usable.length < 10 ? ' — too few to prove anything' : ''));
  }
}

console.log('\n' + (failures
  ? failures + ' credit(s) wrong'
  : 'the credits page matches what is shipped'));
process.exit(failures ? 1 : 0);
