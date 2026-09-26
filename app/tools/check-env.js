/* check-env.js — every switch this app reads is written down somewhere a person will find it.
 *
 * The failure this exists to stop is quiet. Code reads `process.env.SOMETHING`, the person
 * deploying copies .env.example, and the variable is simply not in it — so the feature it controls
 * is off, or on, or half-configured, and nothing anywhere says the switch exists. It happened nine
 * times before this check was written, including twice in one afternoon:
 *
 *   TESTER_PASSWORD        the entire beta sign-in, undocumented in the file people copy
 *   KV_REST_API_*          saved work; without it a hosted deployment silently keeps nothing
 *   AI_CALL_TIMEOUT_MS     added the same day this check was, and immediately caught by it
 *
 * The rule: anything read as process.env.NAME under app/ is either in .env.example, or is on the
 * ALLOWED list below because the platform injects it and nobody sets it by hand.
 *
 * Run by `npm test`.
 */
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const EXAMPLE = path.join(APP, '.env.example');

/* Injected by the host or by Node itself. Nobody writes these into a .env, so listing them there
   would be noise — but they are named here so "not in .env.example" always means something. */
const ALLOWED = new Set([
  'NODE_ENV',        // set by app/Dockerfile, or by a launch config
  'PORT',            // set by the platform; defaults to 3000
  'npm_package_version'
]);

/* Files that are allowed to read anything: they are tools a developer runs by hand, not the app. */
const TOOL_ONLY = /^tools[\\/]/;

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* Every .js under app/, minus the places that are not ours to police. */
function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'public', '.cache', '.data', 'logs', '.impeccable'].indexOf(e.name) >= 0) return;
      walk(full, out);
    } else if (/\.js$/.test(e.name)) {
      out.push(full);
    }
  });
  return out;
}

const files = walk(APP, []);
const documented = new Set();
let exampleText = '';
try { exampleText = fs.readFileSync(EXAMPLE, 'utf8'); }
catch (e) { check('.env.example exists', false, EXAMPLE + ' could not be read'); }

/* A name counts as documented whether it is set (`NAME=`) or commented out (`# NAME=`) — both tell
   a reader the switch exists, which is the whole point. */
exampleText.split(/\r?\n/).forEach(function (line) {
  const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/);
  if (m) documented.add(m[1]);
});
check('.env.example lists some variables', documented.size > 5, documented.size + ' documented');

const missing = new Map();          // NAME -> [where it is read]
const seen = new Set();
const sources = new Map();          // rel -> source, kept for the dynamic-lookup pass below
files.forEach(function (file) {
  const rel = path.relative(APP, file);
  const src = fs.readFileSync(file, 'utf8');
  sources.set(rel, src);
  /* `process.env[name]` is a real pattern here — see agentTool() in server.js, which takes the
     variable's name as an argument. A static scan cannot follow it, so a documented name that
     appears as a quoted string anywhere in the code counts as read. That is loose enough to be
     wrong in principle and has not been wrong in practice; it is only used to soften a NOTE, never
     to pass or fail the check. */
  const re = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    seen.add(name);
    if (ALLOWED.has(name) || documented.has(name)) continue;
    if (TOOL_ONLY.test(rel)) continue;
    if (!missing.has(name)) missing.set(name, []);
    if (missing.get(name).indexOf(rel) < 0) missing.get(name).push(rel);
  }
});

check('every environment variable the app reads is in .env.example', missing.size === 0,
  missing.size
    ? [...missing.entries()].map(function (e) { return e[0] + ' (' + e[1].join(', ') + ')'; }).join('; ')
    : seen.size + ' read, all accounted for');

/* The other direction, as a warning rather than a failure: a documented variable nothing reads is
   usually a rename that only got done in one place. Not fatal — .env.example also documents things
   for the hosting dashboard — but worth seeing. */
const quoted = new Set();
sources.forEach(function (src) {
  [...documented].forEach(function (n) {
    if (src.indexOf("'" + n + "'") >= 0 || src.indexOf('"' + n + '"') >= 0) quoted.add(n);
  });
});
const unread = [...documented].filter(function (n) { return !seen.has(n) && !quoted.has(n); });
if (unread.length) {
  console.log('NOTE  documented but never read: ' + unread.join(', '));
  console.log('      (fine if the platform consumes it; a leftover if not)');
}

console.log('\n' + (failures
  ? failures + ' check(s) failed — a switch exists that nobody deploying this would know about'
  : 'every switch the app reads is documented where somebody will find it'));
process.exit(failures ? 1 : 0);
