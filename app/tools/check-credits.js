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

console.log('\n' + (failures
  ? failures + ' credit(s) wrong'
  : 'the credits page matches what is shipped'));
process.exit(failures ? 1 : 0);
