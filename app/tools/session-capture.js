/* session-capture.js — watch a live session, and keep it.
 *
 *   npm --prefix app run session:watch
 *
 * Start this before the children arrive and leave it running. It follows the app's stdout on the
 * League server — `docker compose logs -f`, over SSH — and does three things the bare command cannot:
 *
 *   SAVES SOMEWHERE DECIDED IN ADVANCE. app/logs/session-<date>.jsonl, chosen here rather than
 *   typed at 4pm with three kids waiting. The folder is gitignored: these files hold children's
 *   questions word for word and belong on the laptop that captured them, not in a repository.
 *
 *   PRINTS SOMETHING A HUMAN CAN READ. A raw event is one long line of JSON, which is unwatchable
 *   while also running a Zoom. Each event gets one short line instead.
 *
 *   RECONNECTS, AND FILLS THE GAP. A two-hour stream will drop at least once; the bare command just
 *   stops, quietly, and you find out afterwards. On reconnect this asks for everything since the
 *   last event it saw, so a dropped minute is recovered rather than lost.
 *
 * WHY A LOG STREAM AT ALL: see app/telemetry.js. In short, stdout costs a request nothing and cannot
 * be lost, and Docker keeps it.
 *
 * NEEDS: SESSION_SSH in app/.env — an SSH login on the server that may run docker (not the deploy
 * key, which can only deploy) — and SESSION_DIR if docker-compose.yml is not in /opt/Game-Dev.
 *
 * Ctrl+C to stop. The file is already written — it is appended as events arrive, not at the end, so
 * killing the terminal loses nothing but the tail.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (e) { /* optional */ }
const LOG_DIR = path.join(__dirname, '..', 'logs');
const SSH = (process.env.SESSION_SSH || '').replace(/[^\w@.\-]/g, '');
const DIR = (process.env.SESSION_DIR || '/opt/Game-Dev').replace(/[^\w\/.\-]/g, '');
/* The one command this file runs, with the variable parts filtered to safe characters on the way in. */
function logsCmd(follow, since) {
  return 'ssh ' + SSH + ' "cd ' + DIR + ' && docker compose logs --no-log-prefix'
    + (follow ? ' -f' : '') + (since ? ' --since ' + since : '') + ' app"';
}
const TAG = 'EVT ';

const stamp = new Date().toISOString().slice(0, 10);
const OUT = path.join(LOG_DIR, 'session-' + stamp + '.jsonl');

/* Opened in main(), not at load, so tools/check-session.js can require this file for eventsFrom()
   without creating a log file as a side effect of being tested. */
let sink = null;

let lastSeen = null;      // ISO time of the newest event, for --since on reconnect
let count = 0;
let stopping = false;

/* ---------- printing ---------- */
const C = process.stdout.isTTY
  ? { dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { dim: '', red: '', yellow: '', green: '', cyan: '', bold: '', off: '' };

function short(who) { return String(who || '?').replace(/@tester$/, ''); }
function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }

/* One line per event. The shapes are chosen so the three things worth spotting mid-session stand
   out without reading: a guard that gave up, a game that would not start, a dead click. */
function line(e) {
  const t = (e.t || '').slice(11, 19);
  const who = short(e.who).padEnd(10).slice(0, 10);
  const head = C.dim + t + C.off + ' ' + C.cyan + who + C.off + ' ';
  switch (e.ev) {
    case 'ask':
      return head + (e.ops ? C.green + 'ask ' : 'ask ') + C.off
        + C.dim + '[' + (e.agent || '?') + (e.ms ? ' ' + Math.round(e.ms / 100) / 10 + 's' : '') + ']' + C.off
        + ' ' + clip(e.q, 80)
        + (e.status >= 400 ? C.red + '  HTTP ' + e.status + C.off : '')
        + (e.guards && e.guards.length ? C.yellow + '  ' + e.guards.join(',') + C.off : '');
    case 'guard':
      return head + (e.gaveUp ? C.red + 'GAVE UP' : C.yellow + 'guard  ') + C.off
        + ' ' + e.name + (e.detail ? C.dim + '  ' + clip(e.detail, 60) + C.off : '');
    case 'tool':
      return head + C.dim + 'tool   ' + e.name + (e.error ? C.red + '  ' + clip(e.error, 40) : '') + C.off;
    case 'deadclick':
      return head + C.yellow + 'dead   ' + C.off + clip(e.what, 60) + C.dim + '  (' + (e.where || '?') + ')' + C.off;
    case 'rageclick':
      return head + C.red + 'RAGE   ' + C.off + clip(e.what, 60) + C.dim + '  (' + (e.where || '?') + ')' + C.off;
    case 'gamefail':
      return head + C.red + 'GAME   ' + C.off + (e.reason === 'no-boot' ? 'never started' : clip(e.detail, 70));
    case 'gamelog':
      return head + (e.level === 'error' ? C.red : C.yellow) + 'game   ' + C.off + clip(e.text, 70)
        + (e.line ? C.dim + '  ' + (e.file || '') + ':' + e.line + C.off : '');
    case 'quiz':
      return head + (e.correct ? C.green + 'quiz ✓' : C.yellow + 'quiz ✗') + C.off
        + ' ' + C.dim + (e.lesson || '') + ' ' + (e.key || '') + (e.attempts > 1 ? ' try ' + e.attempts : '') + C.off;
    case 'lesson':
      return head + C.dim + 'lesson ' + (e.act || '') + ' ' + (e.id || '') + C.off;
    case 'blocked':
      return head + C.yellow + 'locked ' + C.off + (e.id || '') + C.dim + ' (' + (e.why || '') + ')' + C.off;
    /* One model call, with what it cost. Several of these sit behind a single `ask` — a lookup
       round each, plus the answer — so a row of them before one ask is the shape of an expensive
       question. `who` is absent because the usage meter counts calls, not children. */
    case 'model':
      return head + C.dim + 'model  ' + (e.agent || '?') + ' ' + String(e.model || '').replace(/^claude-/, '')
        + '  in ' + e.in + ' out ' + e.out + (e.cost ? '  $' + Number(e.cost).toFixed(4) : '') + C.off;
    case 'sandbox':
      return head + C.yellow + 'sandbox' + C.off + ' ' + (e.result || '') + ' — ' + (e.action || '');
    case 'apifail':
      return head + C.red + 'apifail' + C.off + ' ' + e.status + ' ' + (e.url || '');
    case 'open':
      return head + C.dim + 'opened the app' + C.off;
    case 'http':
      return head + C.red + 'http   ' + e.status + C.off + ' ' + (e.path || '');
    default:
      return head + (e.ev || '?') + ' ' + clip(JSON.stringify(e), 80);
  }
}

/* ---------- pulling events out of the log ----------
   Docker hands back the app's stdout as it was printed, one line per console.log. Anything without
   our prefix — the boot banner, [usage] lines — is not an error, just not ours. */
/* The index of the `}` that closes the `{` at `from`, or -1 if the string ends first. Strings and
   escapes are tracked because a child's question can contain a brace — "why does {this} break" —
   and counting braces naively would stop in the middle of their own words. */
function matchingBrace(s, from) {
  let depth = 0, inStr = false, esc = false;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/* Pure, and exported, because this is the part most likely to be wrong and the only part that can
   be checked without a live session. tools/check-session.js feeds it the lines we have seen. */
function eventsFrom(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  /* Our own events, wherever they were carried.

     READ TO THE MATCHING BRACE, NOT TO THE END OF THE LINE. This took each event to the next "\n"
     on the reasonable assumption that a console.log is a line. The app's first host (Vercel) did not
     preserve that: it batched a function's output into one message joined with SPACES, so a busy
     request arrived as

       [usage] coder … EVT {"ev":"model",…} [usage] coder … EVT {"ev":"ask",…}

     with no newline anywhere. The old scan then took everything after the first `EVT ` to the end
     of the string, JSON.parse choked on the trailing text, and the event was dropped — silently,
     in a catch whose comment said "half a line: skip it".
     It dropped exactly the events worth having. Found on the day, with a session running. Docker
     keeps lines apart, but reading to the matching brace costs nothing and survives any pipeline
     that joins them again. */
  const found = [];
  [text].forEach(function (s) {
    let i = s.indexOf(TAG);
    while (i >= 0) {
      const start = s.indexOf('{', i + TAG.length);
      if (start < 0) break;
      const end = matchingBrace(s, start);
      if (end < 0) break;                       // truncated by the platform: nothing to salvage
      try { found.push(JSON.parse(s.slice(start, end + 1))); } catch (e) { /* not ours after all */ }
      i = s.indexOf(TAG, end);
    }
  });

  return found;
}

/* Events already written, so a backfill over a window already captured does not double it up.
   Keyed on time+kind+who, which is as unique as an event gets and cheap to hold for a session. */
const seenIds = new Set();
/* THE ONE NON-EVENT WORTH INTERRUPTING FOR.
   The server prints this at boot when no save store is configured, and it means every child's work
   lives in one browser on one machine and is gone the moment that changes. It is the single thing
   most likely to be quietly wrong during a session, it cannot be fixed from here, and until now it
   sat in a log nobody was reading while the capture beside it scrolled happily past. Said once, at
   the top, so whoever is watching knows before the children do. */
let warnedNoStore = false;
function noticeStoreWarning(text) {
  if (warnedNoStore || text.indexOf('no per-student save store is configured') < 0) return;
  warnedNoStore = true;
  console.error('\n' + C.red + '  ⚠  NO SAVE STORE ON THIS DEPLOYMENT' + C.off
    + '\n     Work lives in one browser on one machine and does not follow a sign-in.'
    + '\n     The server has STATE_DIR=none in its .env. Remove it and redeploy: saves then go to'
    + '\n     the gamedev_state volume (see DEPLOY.md, "Saved work").\n');
}

function handleRaw(raw) {
  noticeStoreWarning(String(raw || ''));
  eventsFrom(raw).forEach(function (e) {
    if (!e.t) e.t = new Date().toISOString();
    const id = e.t + '|' + e.ev + '|' + (e.who || '');
    if (seenIds.has(id)) return;
    seenIds.add(id);
    if (!lastSeen || e.t > lastSeen) lastSeen = e.t;
    count++;
    sink.write(JSON.stringify(e) + '\n');
    console.log(line(e));
  });
}

/* ---------- going back for what was missed ----------
   `node tools/session-capture.js --since 3h` reads HISTORY instead of following, then exits.
   It exists because of a real morning: the parser was dropping every event that shared a message
   with another (see eventsFrom), so a session's `ask`, `guard` and `model` events never reached the
   file — while sitting perfectly intact in the platform's own logs the whole time. Once the parser was
   fixed there was no way to go back for them, and the run they described was over.
   Now there is. It is also the honest answer to a laptop that slept: the events are not lost until
   Docker's log retention drops them (it keeps them until the container is rebuilt). */
function backfill(since) {
  const win = String(since).replace(/[^0-9a-zA-Z:.\-]/g, '');
  console.log(C.bold + 'reading history' + C.off + ' since ' + win + ' — not following.\n');
  const out = spawnSync(logsCmd(false, win),
    { shell: true, encoding: 'utf8', maxBuffer: 1 << 28 });
  /* SORTED BEFORE PRINTING, unlike the live path, because events are stamped by the browser that
     sent them and a batch can arrive after a later one. The live stream is left in arrival order. */
  const history = [];
  (out.stdout || '').split(/\r?\n/).forEach(function (raw) {
    eventsFrom(raw).forEach(function (e) { history.push(e); });
  });
  history.sort(function (a, b) { return String(a.t) < String(b.t) ? -1 : 1; });
  history.forEach(function (e) { handleRaw(TAG + JSON.stringify(e)); });
  const err = (out.stderr || '').split(/\r?\n/)
    .filter(function (s) { return s.trim(); });
  if (err.length) console.error(C.dim + err.join('\n') + C.off);
  console.log('\n' + C.bold + '  ' + count + ' events' + C.off + ' written to ' + OUT);
  console.log('  read them with:  npm --prefix app run session:report\n');
  sink.end();
}

/* ---------- the stream ---------- */
function start(sinceISO) {
  /* One command STRING with shell:true rather than a command plus an args array: passing both is
     what Node warns about (DEP0190, "arguments are not escaped, only concatenated"), and the warning
     would sit in the middle of the live view for the whole session. The variable parts are a
     timestamp this file produced and two settings, all filtered to safe characters. */
  const since = sinceISO ? String(sinceISO).replace(/[^0-9TZ:.\-]/g, '') : '';
  const child = spawn(logsCmd(true, since), { shell: true });

  let buf = '';
  child.stdout.on('data', function (chunk) {
    buf += chunk.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) { handleRaw(buf.slice(0, nl)); buf = buf.slice(nl + 1); }
    if (buf.length > 1 << 20) buf = '';        // a line that never ends is a line we cannot use
  });
  /* ssh and docker write any complaint to stderr — "permission denied" is the failure everybody hits
     first and is otherwise invisible — so it is shown, minus blank lines. */
  const NOISE = /^\s*$/;
  child.stderr.on('data', function (c) {
    c.toString().split(/\r?\n/).forEach(function (s) {
      const line = s.trim();
      if (line && !NOISE.test(line)) console.error(C.dim + line + C.off);
    });
  });

  child.on('exit', function (code) {
    if (stopping) return;
    console.error(C.yellow + '\n  stream ended (' + code + ') — reconnecting in 3s'
      + (lastSeen ? ', picking up from ' + lastSeen.slice(11, 19) : '') + C.off);
    setTimeout(function () { start(lastSeen || undefined); }, 3000);
  });
  return child;
}

function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  /* Append, never truncate. Two sessions on one day, or a restart after a dropped stream, must add
     to the morning's file rather than replace it. */
  sink = fs.createWriteStream(OUT, { flags: 'a' });

  process.on('SIGINT', function () {
    stopping = true;
    console.log('\n' + C.bold + '  ' + count + ' events' + C.off + ' written to ' + OUT);
    console.log('  read them with:  npm --prefix app run session:report\n');
    sink.end(function () { process.exit(0); });
  });

  if (!SSH) {
    console.error(C.red + 'SESSION_SSH is not set.' + C.off + ' Put the SSH login that can run docker on the League'
      + '\nserver in app/.env, e.g. SESSION_SSH=you@apps.jointheleague.org — see the top of this file.');
    process.exit(1);
  }
  console.log(C.bold + 'watching ' + C.off + SSH + ', writing to ' + C.bold + OUT + C.off);
  console.log(C.dim + 'Ctrl+C to stop. Nothing appears here until somebody uses the app.' + C.off);
  /* --since <window> reads history and stops; no argument follows the live stream. */
  const arg = process.argv.indexOf('--since');
  if (arg > 0 && process.argv[arg + 1]) { backfill(process.argv[arg + 1]); return; }
  console.log('');
  start();
}

if (require.main === module) main();
module.exports = { eventsFrom: eventsFrom, TAG: TAG };
