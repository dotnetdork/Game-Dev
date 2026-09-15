/* session-report.js — what the session actually said.
 *
 *   npm --prefix app run session:report              the newest capture in app/logs/
 *   node tools/session-report.js path/to/file.jsonl  a particular one
 *
 * Reads what session-capture.js wrote and answers the question the testing exists to answer, which
 * Jed put like this: are the struggles the ones we want them to have, or are they struggles because
 * of how the thing is built?
 *
 * The sections are ordered by how likely they are to change what gets fixed on Monday, not by how
 * interesting they look. Everything a child typed comes first, because that is the irreplaceable
 * part; counts come after, because counts can be recomputed and a child's actual words cannot.
 *
 * Prints nothing it does not have. A section with no events says so in one line rather than showing
 * an empty table — a report full of empty headings is a report nobody reads twice.
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

/* ---------- which file ---------- */
function newestCapture() {
  let names = [];
  try { names = fs.readdirSync(LOG_DIR).filter(function (n) { return /\.jsonl$/.test(n); }); }
  catch (e) { return null; }
  if (!names.length) return null;
  return names
    .map(function (n) { return { n: n, at: fs.statSync(path.join(LOG_DIR, n)).mtimeMs }; })
    .sort(function (a, b) { return b.at - a.at; })[0].n;
}

const arg = process.argv[2];
const file = arg ? path.resolve(arg) : (function () {
  const n = newestCapture();
  return n ? path.join(LOG_DIR, n) : null;
})();

if (!file || !fs.existsSync(file)) {
  console.error('No capture to read.');
  console.error('Run `npm --prefix app run session:watch` during a session, or pass a file path.');
  process.exit(1);
}

const events = fs.readFileSync(file, 'utf8').split('\n')
  .map(function (L) { L = L.trim(); if (!L) return null; try { return JSON.parse(L); } catch (e) { return null; } })
  .filter(Boolean)
  .sort(function (a, b) { return String(a.t) < String(b.t) ? -1 : 1; });

if (!events.length) {
  console.error('Read ' + file + ' but found no events in it.');
  process.exit(1);
}

/* ---------- small helpers ---------- */
const B = '\x1b[1m', D = '\x1b[2m', R = '\x1b[31m', Y = '\x1b[33m', G = '\x1b[32m', O = '\x1b[0m';
const bold = process.stdout.isTTY ? function (s) { return B + s + O; } : function (s) { return s; };
const dim = process.stdout.isTTY ? function (s) { return D + s + O; } : function (s) { return s; };
const red = process.stdout.isTTY ? function (s) { return R + s + O; } : function (s) { return s; };
const yel = process.stdout.isTTY ? function (s) { return Y + s + O; } : function (s) { return s; };
const grn = process.stdout.isTTY ? function (s) { return G + s + O; } : function (s) { return s; };

function name(who) { return String(who || '?').replace(/@tester$/, ''); }
function clock(t) { return String(t || '').slice(11, 19); }
function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function of(ev) { return events.filter(function (e) { return e.ev === ev; }); }

/* Counts by key, returned biggest-first. The workhorse of every section below. */
function tally(list, keyFn) {
  const m = new Map();
  list.forEach(function (e) {
    const k = keyFn(e);
    if (k === undefined || k === null || k === '') return;
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort(function (a, b) { return b[1] - a[1]; });
}
function head(title) { console.log('\n' + bold(title) + '\n' + dim('─'.repeat(Math.max(title.length, 40)))); }
function none(what) { console.log(dim('  nothing — ' + what)); }

/* ---------- who was here ---------- */
const people = [...new Set(events.map(function (e) { return e.who; }).filter(Boolean))].filter(function (w) { return w !== ''; });
const first = events[0].t, last = events[events.length - 1].t;
const mins = Math.round((new Date(last) - new Date(first)) / 60000);

console.log('');
console.log(bold('Session report') + dim('  ' + path.basename(file)));
console.log(dim(clock(first) + ' – ' + clock(last) + '  (' + mins + ' min)   ' + events.length + ' events   '
  + people.length + ' signed in: ' + people.map(name).join(', ')));

/* ---------- 1. what they asked ---------- */
head('Every question, in order');
const asks = of('ask').filter(function (e) { return e.q; });
if (!asks.length) none('nobody asked the assistant anything');
else {
  people.forEach(function (w) {
    const mine = asks.filter(function (e) { return e.who === w; });
    if (!mine.length) return;
    console.log('\n  ' + bold(name(w)) + dim('  (' + mine.length + ')'));
    mine.forEach(function (e) {
      const flags = []
        .concat(e.guards && e.guards.length ? [yel(e.guards.join(','))] : [])
        .concat(e.status >= 400 ? [red('HTTP ' + e.status)] : [])
        .concat(e.agent === 'coder' && !e.ops && e.status < 400 ? [yel('no change')] : []);
      console.log('    ' + dim(clock(e.t)) + ' ' + dim('[' + (e.agent || '?') + ']') + ' ' + clip(e.q, 90)
        + (flags.length ? '  ' + flags.join(' ') : ''));
    });
  });
}

/* ---------- 2. where the builder failed ---------- */
head('How the assistant failed');
const guards = of('guard');
if (!guards.length) none('no corrective guard fired');
else {
  console.log(dim('  A guard firing means the model produced something wrong and was asked again.'));
  console.log(dim('  "gave up" means the second attempt was wrong too and the game was left untouched.\n'));
  tally(guards, function (e) { return e.name; }).forEach(function (row) {
    const gaveUp = guards.filter(function (e) { return e.name === row[0] && e.gaveUp; }).length;
    console.log('  ' + String(row[1]).padStart(4) + '  ' + row[0].padEnd(12)
      + (gaveUp ? red(gaveUp + ' gave up') : grn('all recovered')));
  });
  const detail = tally(guards.filter(function (e) { return e.detail; }), function (e) { return e.name + ': ' + clip(e.detail, 50); });
  if (detail.length) {
    console.log(dim('\n  what it got wrong:'));
    detail.slice(0, 12).forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
  }
}

const coderTurns = of('ask').filter(function (e) { return e.agent === 'coder' && e.status < 400; });
const noChange = coderTurns.filter(function (e) { return !e.ops; });
if (coderTurns.length) {
  console.log('\n  ' + bold(noChange.length + ' of ' + coderTurns.length)
    + ' builder replies changed nothing at all' + dim('  (this is "it just says done")'));
}

/* ---------- 3. things that were not buttons ---------- */
head('Clicks that did nothing');
const dead = of('deadclick'), rage = of('rageclick');
if (!dead.length && !rage.length) none('every click landed on something');
else {
  console.log(dim('  A dead click reached nothing interactive. One is noise. The same one from every\n'
    + '  child is a control that is lying about what it is.\n'));
  /* Counted per control, but sorted so the ones several children hit come first — a control three
     children press for nothing is a different finding from one child pressing it three times, and
     it is the finding worth acting on. */
  const byWhat = new Map();
  dead.forEach(function (e) {
    const k = clip(e.what, 60);
    const row = byWhat.get(k) || { n: 0, who: new Set(), where: e.where || '?' };
    row.n++; if (e.who) row.who.add(e.who);
    byWhat.set(k, row);
  });
  [...byWhat.entries()]
    .sort(function (a, b) { return (b[1].who.size - a[1].who.size) || (b[1].n - a[1].n); })
    .slice(0, 15).forEach(function (r) {
      console.log('  ' + String(r[1].n).padStart(4) + '  ' + r[0] + dim('  (' + r[1].where + ')')
        + (r[1].who.size > 1 ? yel('  ' + r[1].who.size + ' different children') : ''));
    });
  if (rage.length) {
    console.log('\n  ' + red(rage.length + (rage.length === 1 ? ' rage click' : ' rage clicks')) + dim(' (3+ fast clicks in one spot):'));
    tally(rage, function (e) { return clip(e.what, 60); }).slice(0, 8)
      .forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
  }
}

/* ---------- 4. their games ---------- */
head('Games that broke');
const fails = of('gamefail'), glog = of('gamelog');
if (!fails.length && !glog.length) none('no game errors');
else {
  if (fails.length) {
    const noBoot = fails.filter(function (e) { return e.reason === 'no-boot'; }).length;
    console.log('  ' + red(fails.length + ' failures to start') + dim('  (' + noBoot + ' with no error at all — a syntax error kills the whole file)'));
  }
  const byMsg = tally(glog.filter(function (e) { return e.level === 'error'; }), function (e) { return clip(e.text, 70); });
  if (byMsg.length) {
    console.log('');
    byMsg.slice(0, 12).forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
  }
  const located = glog.filter(function (e) { return e.line; });
  if (located.length) {
    console.log(dim('\n  with a location:'));
    tally(located, function (e) { return (e.file || '?') + ':' + e.line + '  ' + clip(e.text, 50); })
      .slice(0, 8).forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
  }
}

/* ---------- 5. the course itself ---------- */
head('Where the course caught them');
const quiz = of('quiz'), wrong = quiz.filter(function (e) { return !e.correct; });
if (!quiz.length) none('no quiz questions were answered');
else {
  console.log('  ' + quiz.length + ' answers, ' + (wrong.length ? yel(wrong.length + ' wrong') : grn('none wrong')));
  if (wrong.length) {
    console.log(dim('\n  questions that caught people (a question several children miss is the lesson\'s problem,\n  not theirs):'));
    tally(wrong, function (e) { return (e.lesson || '?') + '  ' + (e.key || '?') + dim('  ' + (e.kind || '')); })
      .slice(0, 15).forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
  }
}

const blocked = of('blocked');
if (blocked.length) {
  console.log('\n  ' + yel(blocked.length + ' times a locked lesson turned somebody away') + ':');
  tally(blocked, function (e) { return (e.id || '?') + dim(' (' + (e.why || '') + ')'); })
    .slice(0, 8).forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + r[0]); });
}

/* ---------- 6. where they stalled ---------- */
head('Where they stalled');
const opened = of('lesson').filter(function (e) { return e.act === 'opened'; });
const done = of('lesson').filter(function (e) { return e.act === 'done'; });
if (!opened.length) none('no lessons were opened');
else {
  const finished = new Set(done.map(function (e) { return e.who + '|' + e.id; }));
  /* How long each child had a lesson open, measured to whatever they did next. A lesson opened and
     never finished, with a long dwell, is the shape of being stuck. */
  const stalls = [];
  people.forEach(function (w) {
    const mine = events.filter(function (e) { return e.who === w; });
    opened.filter(function (e) { return e.who === w; }).forEach(function (o) {
      const after = mine.filter(function (e) { return e.t > o.t; });
      const nextOpen = after.filter(function (e) { return e.ev === 'lesson' && e.act === 'opened'; })[0];
      const endT = nextOpen ? nextOpen.t : last;
      stalls.push({
        who: w, id: o.id, title: o.title || o.id,
        mins: Math.round((new Date(endT) - new Date(o.t)) / 60000),
        finished: finished.has(w + '|' + o.id)
      });
    });
  });
  stalls.sort(function (a, b) { return b.mins - a.mins; });
  stalls.slice(0, 12).forEach(function (s) {
    console.log('  ' + String(s.mins + 'm').padStart(5) + '  ' + name(s.who).padEnd(10)
      + clip(s.title, 40).padEnd(42) + (s.finished ? grn('finished') : yel('did not finish')));
  });
  console.log(dim('\n  ' + done.length + ' lessons finished, ' + opened.length + ' opened.'));
}

/* ---------- 7. things that were simply broken ---------- */
head('Errors the children should never have seen');
const apifail = of('apifail'), http = of('http');
if (!apifail.length && !http.length) none('no failed requests');
else {
  tally(apifail.concat(http), function (e) { return (e.status || '?') + '  ' + (e.url || e.path || ''); })
    .forEach(function (r) { console.log('  ' + String(r[1]).padStart(4) + '  ' + red(r[0])); });
  if (apifail.some(function (e) { return e.status === 401; })) {
    console.log(yel('\n  A 401 is a child who was signed out mid-session. They are now told so plainly and\n'
      + '  asked to sign in again, but it still means their question went nowhere — worth\n'
      + '  knowing how often a session lapses during two hours.'));
  }
  if (apifail.some(function (e) { return e.status === 429; })) {
    console.log(yel('\n  A 429 is the rate limit. It only holds if a KV store is attached; without one it\n'
      + '  counts in memory and resets whenever the platform feels like it.'));
  }
}

/* ---------- 8. what it cost in time ---------- */
head('Speed');
const timed = of('ask').filter(function (e) { return e.ms; });
if (!timed.length) none('no timings');
else {
  const ms = timed.map(function (e) { return e.ms; }).sort(function (a, b) { return a - b; });
  const p = function (q) { return Math.round(ms[Math.min(ms.length - 1, Math.floor(ms.length * q))] / 100) / 10; };
  console.log('  median ' + p(0.5) + 's    slowest ' + p(0.99) + 's    ' + timed.length + ' requests');
  const slow = timed.filter(function (e) { return e.ms > 30000; });
  if (slow.length) {
    console.log(yel('\n  ' + slow.length + ' took over 30 seconds') + dim('  (the function is killed at 60s on Vercel):'));
    slow.slice(0, 6).forEach(function (e) {
      console.log('  ' + String(Math.round(e.ms / 1000) + 's').padStart(5) + '  ' + name(e.who).padEnd(10) + clip(e.q, 60));
    });
  }
  const toolUse = of('tool');
  if (toolUse.length) {
    console.log(dim('\n  ' + toolUse.length + ' documentation lookups: ')
      + tally(toolUse, function (e) { return e.name; }).map(function (r) { return r[0] + ' ' + r[1]; }).join(', '));
  }
}

console.log('\n' + dim('read from ' + file) + '\n');
