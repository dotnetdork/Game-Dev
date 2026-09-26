/* check-session.js — the session logger, checked without a session.
 *
 * Two things here are fragile in ways nothing else would catch until the worst possible moment,
 * which is a Sunday afternoon with three children already on the call:
 *
 *   1. The EVENT LINE ITSELF. app/telemetry.js writes one line of JSON per event. If a field can
 *      break the line — a quote, a newline, a child typing an emoji, a question longer than the
 *      platform will carry — the capture silently fills with unparseable rubbish.
 *
 *   2. READING THEM BACK. The capture scans each log line for tagged events, and a line can carry
 *      more than one, or a child's question with braces and quotes in it. This is what proves it
 *      still finds every one.
 *
 * Run by `npm test`.
 */
const path = require('path');
const tel = require(path.join(__dirname, '..', 'telemetry.js'));
const cap = require(path.join(__dirname, 'session-capture.js'));

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* Catch what telemetry.record writes, instead of letting it reach the terminal. */
function captured(fn) {
  const real = console.log;
  const lines = [];
  console.log = function (s) { lines.push(String(s)); };
  try { fn(); } finally { console.log = real; }
  return lines;
}

/* ---------- 1. the line a recorded event produces ---------- */
const nasty = 'why won\'t my "guy" jump?\nit just\tsits there 🙃 \\ ' + '</script>';
const lines = captured(function () {
  tel.record('ask', { who: 'jonathan@tester', q: nasty, agent: 'coder', ms: 1200, ops: false });
});

check('an event produces exactly one line', lines.length === 1 && lines[0].indexOf('\n') < 0,
  lines.length + ' line(s)');
check('the line is tagged so a capture can find it', lines[0] && lines[0].indexOf(tel.TAG) === 0,
  'starts with "' + tel.TAG.trim() + '"');

let parsed = null;
try { parsed = JSON.parse(lines[0].slice(tel.TAG.length)); } catch (e) { parsed = null; }
check('the line is valid JSON with quotes, tabs, newlines and emoji in the question', !!parsed,
  parsed ? 'parsed' : 'did not parse — a whole session would be unreadable');
if (parsed) {
  check('the question survives intact', parsed.q === nasty,
    parsed.q === nasty ? 'byte for byte' : 'got mangled: ' + JSON.stringify(String(parsed.q).slice(0, 60)));
  check('the event carries who, what and when', !!(parsed.who && parsed.ev && parsed.t),
    parsed.ev + ' / ' + parsed.who);
}

/* A child pasting their whole game into the chat must not produce a line so long the platform
   truncates it, because a truncated line is not JSON and takes the whole capture down with it. */
const bigLines = captured(function () {
  tel.record('ask', { who: 'a@tester', q: 'x'.repeat(50000), code: 'y'.repeat(200000) });
});
let bigOk = false;
try { bigOk = !!JSON.parse(bigLines[0].slice(tel.TAG.length)); } catch (e) { bigOk = false; }
check('an enormous event still emits one parseable line', bigOk && bigLines[0].length < 8000,
  bigLines[0].length + ' chars');

/* Telemetry may never break the thing it is watching. */
const circular = {}; circular.self = circular;
let threw = false;
try { captured(function () { tel.record('ask', { who: 'a@tester', bad: circular }); }); }
catch (e) { threw = true; }
check('a record() that cannot be serialised fails silently rather than throwing', !threw,
  'a logger must never break a student\'s request');

/* ---------- 2. pulling events back out of a log line ---------- */
const ev = { t: '2026-09-20T23:04:00.000Z', ev: 'guard', who: 'miles@tester', name: 'no-ops', gaveUp: true };
const payload = tel.TAG + JSON.stringify(ev);

const SHAPES = {
  'the line is exactly one event': payload,
  'the line has a timestamp in front': '2026-09-20T23:04:00.123456789Z ' + payload,
  'several events share one line': payload + ' ' + payload
};
Object.keys(SHAPES).forEach(function (name) {
  const got = cap.eventsFrom(SHAPES[name]);
  const want = name.indexOf('several') === 0 ? 2 : 1;
  check('found when ' + name, got.length === want && got[0] && got[0].name === 'no-ops',
    got.length + ' event(s)');
});

/* THE SHAPE THAT WAS SILENTLY LOSING EVENTS, from a real session on 20 September.
   The app's first host (Vercel) batched a function's output into one message joined with SPACES,
   not newlines — so a busy request arrived with the usage line and several events run together. The scan used to take
   each event to the next "\n", found none, swallowed the rest of the string and failed to parse it.
   Short events at the end of a message survived; `ask`, `guard` and `model` did not, which is to
   say the ones worth capturing were exactly the ones being dropped. */
const ask = { t: '2026-09-20T20:18:50.017Z', ev: 'ask', who: 'jsausa@tester', agent: 'coder', ops: false };
const model = { t: '2026-09-20T20:18:50.018Z', ev: 'model', agent: 'coder', cost: 0.017 };
const squashed = '[usage] coder claude-sonnet-5  in 7633 out 176  $0.0170 '
  + tel.TAG + JSON.stringify(model) + ' [usage] coder again '
  + tel.TAG + JSON.stringify(ask);
const fromSquashed = cap.eventsFrom(squashed);
check('events joined by spaces in one message are all found', fromSquashed.length === 2,
  fromSquashed.length + ' of 2 — this is how a real session lost its ask and guard events');
check('...and the right ones, in order',
  fromSquashed.length === 2 && fromSquashed[0].ev === 'model' && fromSquashed[1].ev === 'coder' === false
    && fromSquashed[1].ev === 'ask',
  fromSquashed.map(function (e) { return e.ev; }).join(', '));

/* A question with a brace in it must not end the scan early. */
const braceInText = { t: '2026-09-20T20:19:00.000Z', ev: 'ask', who: 'a@tester',
  q: 'why does {this} break, and what about a "quote" or a \\ backslash?' };
const fromBrace = cap.eventsFrom(tel.TAG + JSON.stringify(braceInText) + ' trailing noise');
check('a brace or a quote inside a question does not truncate the event',
  fromBrace.length === 1 && fromBrace[0].q === braceInText.q,
  fromBrace.length ? 'question intact' : 'lost');

/* The rest of stdout is most of the stream and must not become events. */
check('an ordinary log line is not mistaken for an event',
  cap.eventsFrom('[usage] coder claude-sonnet-5  in 7633 out 176').length === 0
    && cap.eventsFrom('Course agent on http://localhost:3000  · saves: file').length === 0, 'ignored');

check('a torn half-line is dropped rather than half-parsed',
  cap.eventsFrom(tel.TAG + '{"ev":"ask","who":"a@tes').length === 0, 'skipped');

console.log('\n' + (failures
  ? failures + ' check(s) failed — the session log cannot be trusted'
  : 'the session logger writes readable lines and can read them back'));
process.exit(failures ? 1 : 0);
