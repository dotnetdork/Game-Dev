/* build-phaser-doclets.js — generates the doclet dump docs.phaser.io is generated from.
 *
 * WHY THIS EXISTS, when phaser already ships a doclet dump on npm
 *
 * It ships `types/phaser.json`, and that file is missing things its own website shows. Not many:
 * two namespaces, Phaser.Physics.Arcade.ProcessX and ProcessY, and the twelve collision functions
 * inside them. But it is missing them, and "the docs in the app are not the docs on the site" is a
 * thing a student notices and then stops trusting the whole tab over.
 *
 * The cause is one line. Phaser generates phaser.json with scripts/tsgen/bin/publish.js, which ends:
 *
 *     data({ undocumented: true }).remove();
 *     data({ kind: 'package' }).remove();
 *     data({ copyright: { isString: true } }).remove();
 *     data({ access: 'private' }).remove();
 *     data({ ignore: true }).remove();        <-- this one
 *
 * Every function in ProcessX.js carries `@ignore`, because they are internals nobody should call.
 * jsdoc drops them, so the published package has never contained them, while the website — built
 * from the repository rather than the package — renders both namespaces in full.
 *
 * So this runs jsdoc over Phaser's own source with Phaser's own config, and applies four of those
 * five removals. The result is a strict superset of types/phaser.json: 19,353 doclets against
 * 19,181, adding exactly ProcessX, ProcessY and their members and changing nothing else. Measured,
 * not assumed — 335 classes both ways, 254 namespaces against the site's 254.
 *
 * WHAT IT COSTS
 *
 * A download of Phaser's source tarball at the pinned version, and jsdoc as a devDependency. Both
 * are build-time only; the app's four runtime dependencies are untouched. The output is cached
 * under .cache/ and gitignored — what gets committed is public/phaser-docs, which is generated from
 * it by build-phaser-docs.js.
 *
 *   node tools/build-phaser-doclets.js            generate (cached; use --force to redo)
 *   node tools/build-phaser-docs.js               then turn it into the pages the app serves
 *
 * Both run together as `npm run build:docs`.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APP = path.join(__dirname, '..');
const CACHE = path.join(APP, '.cache');
const FORCE = process.argv.indexOf('--force') >= 0;

/* THE VERSION IS THE ONE THE APP IS PINNED TO, read rather than typed, so the reference can never
   describe a different Phaser from the one the student's game actually runs. */
const pkg = JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8'));
const VERSION = String((pkg.devDependencies && pkg.devDependencies.phaser) || '').replace(/^[^0-9]*/, '');
if (!VERSION) {
  console.error('No phaser version in devDependencies. Add it: npm i -D phaser@<version>');
  process.exit(1);
}

const OUT = path.join(CACHE, 'phaser-doclets-' + VERSION + '.json');
if (fs.existsSync(OUT) && !FORCE) {
  console.log('cached: ' + OUT + '  (' + (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB)');
  console.log('re-generate with --force');
  process.exit(0);
}

const jsdocBin = path.join(APP, 'node_modules', '.bin', process.platform === 'win32' ? 'jsdoc.cmd' : 'jsdoc');
if (!fs.existsSync(jsdocBin)) {
  console.error('jsdoc is not installed. It is a build-time dependency of this script only:');
  console.error('  npm i -D jsdoc');
  process.exit(1);
}

fs.mkdirSync(CACHE, { recursive: true });
const SRC_ROOT = path.join(CACHE, 'phaser-' + VERSION);
const TGZ = path.join(CACHE, 'phaser-' + VERSION + '.tar.gz');

/* ---------- the source ----------
   The tarball rather than a clone: it is fifteen megabytes against a repository with a decade of
   history, and a tag is exactly as reproducible as a commit. */
async function fetchSource() {
  if (fs.existsSync(path.join(SRC_ROOT, 'src'))) { console.log('source already extracted'); return; }
  if (!fs.existsSync(TGZ)) {
    const url = 'https://github.com/phaserjs/phaser/archive/refs/tags/v' + VERSION + '.tar.gz';
    console.log('downloading ' + url);
    const res = await fetch(url);
    if (!res.ok) throw new Error('download failed: HTTP ' + res.status + ' for ' + url);
    fs.writeFileSync(TGZ, Buffer.from(await res.arrayBuffer()));
    console.log('  ' + (fs.statSync(TGZ).size / 1048576).toFixed(1) + ' MB');
  }
  console.log('extracting');
  /* tar ships with Windows 10+, macOS and every Linux; Node has no archive reader of its own and
     this is not worth a dependency. */
  execFileSync('tar', ['-xzf', TGZ, '-C', CACHE], { stdio: 'inherit' });
  if (!fs.existsSync(path.join(SRC_ROOT, 'src'))) {
    throw new Error('extracted, but no src/ under ' + SRC_ROOT);
  }
}

/* ---------- the template ----------
   Phaser's own publish.js, minus the line that drops @ignore. Written out here rather than kept as
   a checked-in file so the reason for it travels with the code that needs it. */
const TEMPLATE_DIR = path.join(CACHE, 'template');
const TEMPLATE = `/* Generated by tools/build-phaser-doclets.js — do not edit; edit that.
   Phaser's scripts/tsgen/bin/publish.js with its \`data({ ignore: true }).remove()\` line left out,
   which is the only difference between types/phaser.json and what docs.phaser.io renders. */
'use strict';
const fs = require('fs');
const path = require('path');
exports.publish = function (data, opts) {
  data({ undocumented: true }).remove();
  data({ kind: 'package' }).remove();
  data({ copyright: { isString: true } }).remove();
  data({ access: 'private' }).remove();
  if (!fs.existsSync(opts.destination)) fs.mkdirSync(opts.destination, { recursive: true });
  fs.writeFileSync(path.join(opts.destination, 'doclets.json'), JSON.stringify(data().get()));
};
`;

/* Phaser's own source include/exclude list, copied from scripts/tsgen/jsdoc-tsd.conf.json so the
   same files are parsed and the same ones skipped. */
const EXCLUDES = [
  'phaser-arcade-physics.js', 'phaser-core.js', 'phaser-esm.js', 'phaser-no-physics.js',
  'physics/matter-js/poly-decomp/', 'physics/matter-js/lib', 'polyfills'
];

function writeConfig() {
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEMPLATE_DIR, 'publish.js'), TEMPLATE);
  const fwd = (p) => p.replace(/\\/g, '/');
  const src = fwd(path.join(SRC_ROOT, 'src')) + '/';
  const conf = {
    tags: { allowUnknownTags: true },
    source: {
      include: [src],
      exclude: EXCLUDES.map(function (e) { return src + e; }),
      includePattern: '.+\\.js?$',
      excludePattern: '(^|\\/|\\\\)_'
    },
    /* Phaser's own typedef plugin, from the tarball — typedefs are parsed differently without it. */
    plugins: [fwd(path.join(SRC_ROOT, 'scripts', 'tsgen', 'jsdoc-plugins', 'typedef.js'))],
    opts: { encoding: 'utf8', recurse: true, private: false, lenient: true, sourceType: 'script' }
  };
  const confPath = path.join(CACHE, 'jsdoc.conf.json');
  fs.writeFileSync(confPath, JSON.stringify(conf, null, 2));
  return confPath;
}

(async function main() {
  await fetchSource();
  const confPath = writeConfig();
  const dest = path.join(CACHE, 'jsdoc-out');
  console.log('running jsdoc over ' + VERSION + ' source (this takes a few minutes)');
  execFileSync(jsdocBin, ['-c', confPath, '-t', TEMPLATE_DIR, '-d', dest], {
    stdio: 'inherit',
    /* The dump is large and jsdoc holds the whole parse in memory. */
    env: Object.assign({}, process.env, { NODE_OPTIONS: '--max-old-space-size=6144' })
  });
  const produced = path.join(dest, 'doclets.json');
  if (!fs.existsSync(produced)) throw new Error('jsdoc finished but wrote no doclets.json');
  fs.copyFileSync(produced, OUT);

  const all = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const kinds = {};
  all.forEach(function (d) {
    if (!d || !d.longname) return;
    (kinds[d.kind] || (kinds[d.kind] = new Set())).add(d.longname);
  });
  console.log('\nwrote ' + OUT + '  (' + (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB)');
  console.log('doclets:    ' + all.length);
  console.log('classes:    ' + (kinds.class || new Set()).size + '   (docs.phaser.io: 335)');
  console.log('namespaces: ' + (kinds.namespace || new Set()).size + '   (docs.phaser.io: 254)');
  /* The two that started all this. If they are ever absent again, the ignore filter is back. */
  ['Phaser.Physics.Arcade.ProcessX', 'Phaser.Physics.Arcade.ProcessY'].forEach(function (n) {
    console.log((kinds.namespace && kinds.namespace.has(n) ? '  ok   ' : '  MISSING ') + n);
  });
  console.log('\nnow run:  node tools/build-phaser-docs.js');
}()).catch(function (e) {
  console.error('\n' + e.message);
  process.exit(1);
});
