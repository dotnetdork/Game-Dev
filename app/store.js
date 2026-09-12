/* store.js — where a student's work lives when the app is not running on their own laptop.
 *
 * Everything the student makes — their game's code, their XP and stars, their design board — has
 * always been in `localStorage`. On a laptop that is exactly right: no account, no server, no
 * privacy question, and it survives a reload. Hosted, it stops being enough, for one reason that
 * came straight from the 9 September call:
 *
 *     "We're probably going to have multiple sessions with these kids, and they're not going to
 *      want to log back in and all their work be gone. That's going to totally bum them out."
 *
 * localStorage is per-browser-per-machine. A tester on a school Chromebook in session one and a
 * borrowed laptop in session two has two different empty apps. So there is a copy on the server,
 * keyed on who they signed in as.
 *
 * ---------------------------------------------------------------------------------------------
 * THREE BACKENDS, CHOSEN BY WHAT IS CONFIGURED
 *
 *   redis   Upstash over its REST API — which is what a Vercel KV store is underneath. Chosen
 *           because it needs NO npm package: it is a POST with a bearer token, and `fetch` is in
 *           Node now. This app has no bundler and vendors its browser libraries on purpose; taking
 *           a runtime dependency for four HTTP calls would be out of keeping with that.
 *
 *   file    A folder on disk, for `npm start` on a laptop. Not available on Vercel, whose
 *           filesystem is read-only — which is the whole reason the redis backend exists.
 *
 *   none    Nothing configured. The endpoints say so and the browser stays on localStorage alone,
 *           exactly as it did before this file existed. A missing store must never be an error: a
 *           developer with no Redis should get the app, not a stack trace.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT IS STORED, AND WHAT IS DELIBERATELY NOT
 *
 * One JSON blob per student, holding the same three keys the browser already keeps. No schema, no
 * migration: the browser owns the shape and this is a copy of it. That is the point — the day a
 * schema changes, project.js's existing migration runs on the way in and nothing here needs to know.
 *
 * THE KEY IS A HASH of the sign-in identity, not the identity. Redis keys show up in dashboards and
 * logs, and a list of children's names and email addresses is not something to leave lying in one.
 * The identity is inside the encrypted-at-rest value instead, where it is needed for debugging.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* Vercel KV injects KV_REST_API_*; a store created directly with Upstash uses UPSTASH_*. Both are
   the same API, so both names are read and whichever is present wins. */
const REDIS_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const IS_HOSTED = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
/* Where the file backend keeps things. Under the app rather than in a temp folder, so it survives a
   reboot and is obvious enough to delete. .gitignored. */
const FILE_DIR = process.env.STATE_DIR || path.join(__dirname, '.data', 'state');

/* A blob is one child's whole working life in this app. 512KB is generous for a handful of small
   JS files, a progress ledger and a board — and small enough that a bug cannot fill the store. */
const MAX_BYTES = 512 * 1024;

const MODE = (REDIS_URL && REDIS_TOKEN) ? 'redis' : (IS_HOSTED ? 'none' : 'file');

function enabled() { return MODE !== 'none'; }
function mode() { return MODE; }

/* Why it is off, in words, for the boot banner and /api/info. */
function problem() {
  if (MODE !== 'none') return null;
  return 'no per-student save store is configured, so work will only survive in the browser it was '
    + 'made in. Create a KV store in the Vercel dashboard and redeploy — it sets KV_REST_API_URL '
    + 'and KV_REST_API_TOKEN itself.';
}

function keyFor(identity) {
  const h = crypto.createHash('sha256').update(String(identity || '')).digest('hex').slice(0, 32);
  return 'gd:v1:state:' + h;
}

/* ---- redis, over REST ----
   Upstash's REST API takes the command as path segments and answers {result}. The value is sent as
   a body rather than in the path, because a path segment has a length limit and a project does not
   fit in one. */
async function redis(cmd, body) {
  const r = await fetch(REDIS_URL + '/' + cmd.map(encodeURIComponent).join('/'), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN },
    body: body
  });
  if (!r.ok) throw new Error('store ' + r.status);
  const d = await r.json();
  return d ? d.result : null;
}

/* Colons go. They are fine in a Redis key and illegal in a Windows filename — it reads `gd:v1:` as
   a drive letter and an alternate data stream — so the file backend silently failed every write on
   the machine this is developed on. Only [a-z0-9-] survives, which is safe everywhere. */
function filePath(k) { return path.join(FILE_DIR, k.replace(/[^a-z0-9]+/gi, '-') + '.json'); }

async function read(identity) {
  if (!enabled()) return null;
  const k = keyFor(identity);
  if (MODE === 'redis') {
    const raw = await redis(['get', k]);
    return raw ? JSON.parse(raw) : null;
  }
  try { return JSON.parse(fs.readFileSync(filePath(k), 'utf8')); } catch (e) { return null; }
}

async function write(identity, record) {
  if (!enabled()) return false;
  const raw = JSON.stringify(record);
  if (Buffer.byteLength(raw) > MAX_BYTES) { const e = new Error('too big'); e.tooBig = true; throw e; }
  const k = keyFor(identity);
  if (MODE === 'redis') { await redis(['set', k], raw); return true; }
  fs.mkdirSync(FILE_DIR, { recursive: true });
  fs.writeFileSync(filePath(k), raw);
  return true;
}

/* Used by "Reset everything", which is a testing control and has to mean it — a reset that left the
   server copy behind would be undone by the next reload adopting it back. */
async function clear(identity) {
  if (!enabled()) return false;
  const k = keyFor(identity);
  if (MODE === 'redis') { await redis(['del', k]); return true; }
  try { fs.unlinkSync(filePath(k)); } catch (e) { /* already gone */ }
  return true;
}

/* ---------- counters that expire ----------
   The primitive behind every rate limit in the app. It exists here rather than in server.js for one
   reason: on Vercel a counter in a module-level Map counts only the requests that happened to land
   on the same short-lived instance as the last one, which on a cold path is none of them. A limit
   that resets whenever the platform feels like it is not a limit, and the only thing standing
   between the public URL and a paid API key should not be decorative.

   With a KV store it is a real shared counter. Without one — a laptop — the in-memory Map is
   correct, because there is exactly one process.

   IT FAILS OPEN. If the store is unreachable this returns 0, which reads as "not over the limit",
   and the caller lets the request through. A child mid-sentence must not be told to slow down
   because Redis hiccuped; the in-memory tier still catches a runaway loop in the meantime. */
const memHits = new Map();
function memBump(key, windowSec) {
  const now = Date.now(), ms = windowSec * 1000;
  if (memHits.size > 500) memHits.forEach(function (v, k) { if (now - v.start > ms) memHits.delete(k); });
  const e = memHits.get(key);
  if (!e || now - e.start > ms) { memHits.set(key, { start: now, n: 1 }); return 1; }
  e.n++;
  return e.n;
}
async function bump(key, windowSec) {
  const local = memBump(key, windowSec);          // always counted, so a laptop and a cold instance both work
  if (MODE !== 'redis') return local;
  const k = 'gd:v1:rl:' + String(key).replace(/[^a-z0-9@._:-]/gi, '_');
  try {
    const n = Number(await redis(['incr', k]));
    /* Only the first writer sets the expiry, so a steady stream of requests cannot keep pushing the
       window out in front of itself and make the limit unreachable. */
    if (n === 1) await redis(['expire', k, String(windowSec)]);
    return Math.max(n, local);
  } catch (e) {
    return local;                                  // see "fails open" above
  }
}

module.exports = { enabled, mode, problem, read, write, clear, bump, MAX_BYTES };
