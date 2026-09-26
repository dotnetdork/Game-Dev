/* telemetry.js — what the app noticed, written where somebody can read it back.
 *
 * WHY THIS EXISTS
 *
 * Three children test this app on Sunday with two adults watching over Zoom. Zoom records the call
 * and all three share their screens, so anything a person can see is already captured. What no
 * camera catches is what the app knew and never said: the question a child actually typed, the
 * corrective guard that silently threw away a change and left the game untouched, the error their
 * game threw at frame one, the button they pressed four times that was never a button.
 *
 * Before this file, `POST /api/ai` handled every question a student ever asked and recorded not one
 * of them.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY STDOUT, AND NOT A FILE OR THE KV STORE
 *
 * This was decided on the app's first host (Vercel), where there was no disk and no SSH and stdout
 * was the only way out. The League server has both, and stdout is still the right channel: it is
 * synchronous, so it costs nothing and cannot be lost; Docker keeps it (`docker compose logs`) across
 * restarts; and nothing about it needs a file to be rotated, a folder to be writable, or a store to
 * be reachable. tools/session-capture.js follows it live from a laptop and writes the session's file
 * there — the durable copy ends up on the machine that was watching, which is the machine that
 * wanted it.
 *
 * ---------------------------------------------------------------------------------------------
 * THE RULE THIS FILE MUST NEVER BREAK
 *
 * Telemetry may not fail a student's request. Not by throwing, not by rejecting, not by being slow.
 * A child in the middle of asking why their sprite will not jump must never see a stack trace
 * because a logger was unhappy about a circular reference. Every entry point here is wrapped, and
 * the failure mode is silence.
 */

/* One prefix, so a capture can tell our lines apart from anything else on stdout — including the
   [usage] and [league] messages that were already going to stdout. Deliberately not JSON-only:
   a bare `{` at the start of a log line is indistinguishable from anything else that logs JSON. */
const TAG = 'EVT ';

/* A log pipeline may truncate very long lines (the first host cut at 4KB), and a truncated line is
   not parseable JSON — it is a hole in the capture. Individual strings are cut well before that, and
   the whole line is checked again at the end. */
const MAX_FIELD = 700;
const MAX_LINE = 3000;

/* Strings get cut, everything else is passed through as-is. Objects are walked one level deep only:
   an event is a flat record by design, and a deep walk is how a logger ends up recursing into a
   request object and taking the process with it. */
function trim(v, depth) {
  if (typeof v === 'string') return v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) + '…' : v;
  if (v === null || v === undefined) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (depth > 1) return undefined;
  if (Array.isArray(v)) return v.slice(0, 20).map(function (x) { return trim(x, depth + 1); });
  if (typeof v === 'object') {
    const out = {};
    Object.keys(v).slice(0, 30).forEach(function (k) { out[k] = trim(v[k], depth + 1); });
    return out;
  }
  return undefined;                                  // functions, symbols: not log material
}

/* Record one thing that happened.
 *
 *   record('ask', { who: 'jed@tester', agent: 'coder', q: 'make him jump higher', ms: 2100 })
 *
 * `ev` names the kind; everything else is that kind's own fields. There is no schema and no
 * registry on purpose — tools/session-report.js groups by `ev` and prints what it finds, so adding
 * a new kind of event is one call here and nothing else anywhere. */
function record(ev, fields) {
  try {
    const e = Object.assign({ t: new Date().toISOString(), ev: String(ev || 'unknown') },
      trim(fields || {}, 0));
    let line = TAG + JSON.stringify(e);
    if (line.length > MAX_LINE) {
      /* Rather than emit a truncated line that will not parse, emit a whole one that says so. A
         report that knows an event was too big is better off than a report with a broken line. */
      line = TAG + JSON.stringify({ t: e.t, ev: e.ev, who: e.who, oversize: line.length });
    }
    console.log(line);
  } catch (e) { /* see the rule at the top of this file */ }
}

/* Who is asking, from the signed session cookie and nowhere else.
 *
 * The browser also sends a `studentId` of its own. The server has ignored it since the rate limiter
 * was keyed on it by mistake — see the note above rateLimited in server.js — and this keeps that
 * true. A value the caller chooses is a value the caller can change, which makes it useless for
 * telling one child's session from another's.
 *
 * For Sunday every identity will be `<name>@tester`: the tester door mints the email from the name
 * they type. Two children typing the same name share an identity, in the log exactly as in their
 * saved work. */
function who(auth, req) {
  try {
    const me = auth && auth.currentUser && auth.currentUser(req);
    return (me && me.email) || 'anon';
  } catch (e) { return 'anon'; }
}

module.exports = { record: record, who: who, TAG: TAG };
