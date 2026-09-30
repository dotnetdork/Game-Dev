/* student-log.js — a playtest's student log, read back as a transcript and a list of what to fix.
 *
 *   npm --prefix app run log                   every student with a log, and how far each got
 *   npm --prefix app run log -- jay            one student (any part of the name): transcript + fixes
 *   npm --prefix app run log -- jay --why      ...with the AI's own reading of each turn (`read`)
 *   npm --prefix app run log -- jay --fixes    ...only the list of what to fix
 *   npm --prefix app run log -- --all          the fixes list for every student at once
 *
 * WHY THIS EXISTS
 *
 * Jay, Sept 30: "right now its not fully comprehending me if I pretend to be a 10 year old who cant
 * spell right or i act bored", and "after the playtest I know exactly what to do". A pasted chat shows
 * what the Mentor said. It can't show why: which code path answered, whether the AI was asked at all,
 * what it thought the kid meant, whether its answer came back empty and a fallback line was said
 * instead. The log has all of that (telemetry.js, ONE LOG PER STUDENT), and this puts it in the order
 * it happened, with the machinery indented under what the kid saw.
 *
 * The fixes list is heuristics, not verdicts. Each item is a place to look, with the lines around it,
 * found by rules that match the ways the studio has actually failed kids so far:
 *   - the AI failed, timed out, came back empty or unparseable (the "Hmm, say that another way?" line)
 *   - the kid was confused (huh, what, where, ?, idk) and what the studio said right before
 *   - the studio said nearly the same thing twice in one step (four explanations of the Hierarchy)
 *   - the kid drifted (haha, lalala, boring, bye) and what the studio did about it
 *   - the report ladder gave up on something ("We'll come back to it")
 *   - steps that took longest, and the hints each one needed
 *   - errors the page threw
 *
 * Standalone on purpose, like the check-*.js scripts (CLAUDE.md, constraint 5): a person runs it and
 * reads it, and it needs nothing but Node.
 */
const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(__dirname, '..', '.data', 'logs');

const args = process.argv.slice(2);
const flag = function (f) { return args.indexOf(f) >= 0; };
const name = args.filter(function (a) { return !/^--/.test(a); })[0];

function files() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs.readdirSync(LOG_DIR).filter(function (f) { return /\.jsonl$/.test(f); }).map(function (f) { return path.join(LOG_DIR, f); });
}
function read(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter(Boolean).sort(function (a, b) { return String(a.t).localeCompare(String(b.t)); });
}
function short(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function clock(ms) { const s = Math.round(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
const WHO = { kid: 'KID', mentor: 'Mentor', 'lead-programmer': 'Programmer', 'art-director': 'Art dir', 'concept-artist': 'Concept', 'sound-designer': 'Sound', 'lead-designer': 'Designer', director: 'Director' };

if (!files().length) {
  console.log('No student logs yet. Set STUDENT_LOGS=1 in app/.env (or the launch config), restart the server, and play.');
  console.log('They are written to ' + LOG_DIR);
  process.exit(0);
}

if (!name && !flag('--all')) {
  console.log('Student logs in ' + LOG_DIR + '\n');
  files().forEach(function (f) {
    const ev = read(f), last = ev.filter(function (e) { return e.beat; }).pop();
    const kid = ev.filter(function (e) { return e.ev === 'chat' && e.kind === 'kid'; }).length;
    console.log(path.basename(f, '.jsonl').padEnd(40) + String(ev.length).padStart(6) + ' events  ' + String(kid).padStart(4) + ' typed  '
      + (ev[0] ? String(ev[0].t).slice(0, 16).replace('T', ' ') : '') + ' → ' + (ev.length ? String(ev[ev.length - 1].t).slice(11, 16) : '')
      + (last ? '   at ' + last.quest + ' / ' + last.beat : ''));
  });
  console.log('\nOne student:  npm --prefix app run log -- <part of the name>');
  process.exit(0);
}

const picked = flag('--all') ? files() : files().filter(function (f) { return path.basename(f).toLowerCase().indexOf(name.toLowerCase()) >= 0; });
if (!picked.length) { console.log('No log matches "' + name + '". Run without a name to list them.'); process.exit(1); }

picked.forEach(function (file) {
  const ev = read(file);
  console.log('\n' + '='.repeat(100) + '\n' + path.basename(file, '.jsonl') + '   ' + ev.length + ' events\n' + '='.repeat(100));
  if (!flag('--fixes') && !flag('--all')) transcript(ev);
  fixes(ev);
});

/* ---------- the transcript: what the kid saw, and under it, what made it happen ---------- */
function transcript(ev) {
  const t0 = Date.parse(ev[0].t);
  let at = '';
  ev.forEach(function (e) {
    const where = e.quest ? e.quest + ' / ' + e.beat : '';
    if (where && where !== at && e.ev !== 'mentor-turn' && e.ev !== 'ask') { at = where; console.log('\n--- ' + where + ' ' + '-'.repeat(Math.max(0, 90 - where.length))); }
    const ts = clock(Date.parse(e.t) - t0) + '  ';
    const line = function (s) { console.log(ts + s); };
    const under = function (s) { console.log('         ' + s); };
    switch (e.ev) {
      case 'chat':
        if (e.kind === 'kid') line('KID          ' + e.text);
        else if (e.kind === 'said') line((WHO[e.from] || e.from || '?').padEnd(12) + ' ' + e.text);
        else if (e.kind === 'step') line(''.padEnd(12) + ' → ' + e.text);
        else if (e.kind === 'task') under('[task line] ' + e.text);
        else if (e.kind === 'hint') under('[hint ' + (e.extra ? e.extra.n + '/' + e.extra.of : '') + '] ' + e.text);
        else if (e.kind === 'card') under('[card] ' + e.text + (e.extra && e.extra.options ? '  {' + e.extra.options.join(' | ') + '}' : ''));
        else if (e.kind === 'handover') under('[handover to ' + e.text + ']');
        else if (e.kind === 'event') under('· ' + e.text);
        break;
      case 'did': if (e.type !== 'event' || e.name !== 'crossed') under('did: ' + e.type + (e.name ? ' ' + e.name : '') + (e.set ? ' ' + e.set : '')); break;
      case 'trigger': under('⚡ trigger ' + e.on + ' ' + JSON.stringify(e.when)); break;
      case 'step-done': under('✓ step done: ' + JSON.stringify(e.when)); break;
      case 'report': under('ladder: ' + e.step + (e.n != null ? ' #' + e.n : '') + (e.aim ? ' aimed at ' + e.aim : '') + (e.by ? ' (by ' + e.by + ')' : '')); break;
      case 'ai': under('ai ' + e.how + ' ' + e.ms + 'ms' + (e.choose ? ' choose=' + e.choose : '') + (e.actions ? ' actions=' + JSON.stringify(e.actions) : '') + (e.build ? ' build="' + short(e.build, 80) + '"' : '') + (e.task ? '   task: ' + short(e.task, 90) : '')); break;
      case 'mentor-turn':
        if (flag('--why') || e.fellBack || !e.parsed) under('ai read: ' + short(e.read || '(none)', 220) + (e.fellBack ? '   ** FELL BACK **' : '') + (!e.parsed ? '   ** UNPARSED **' : ''));
        break;
      case 'finding': under('FILED from "' + short(e.text, 80) + '" → ' + (e.tickets || []).join(', ')); break;
      case 'ticket-filed': if (e.by !== 'kid') under('filed ' + e.ticket + ' by ' + e.by); break;
      case 'answer': under('answered "' + short(e.q, 50) + '" → ' + e.a + (e.correct === false ? '  (wrong)' : '')); break;
      case 'stuck': under('stuck, hint rung ' + e.rung + ' (' + e.why + ')'); break;
      case 'built': under('BUILT: ' + short(e.brief, 90)); break;
      case 'build-failed': under('BUILD FAILED: ' + short(e.brief, 90)); break;
      case 'quest-done': under('quest done: ' + e.quest); break;
      case 'page-error': under('PAGE ERROR ' + e.text + ' at ' + e.at); break;
      case 'session': under('[page loaded ' + e.screen + ', ' + (e.tickets || []).length + ' tickets, done: ' + (e.done || []).join(',') + ']'); break;
    }
  });
}

/* ---------- what to fix: each rule prints the moment, with what came just before ---------- */
function fixes(ev) {
  const talk = ev.filter(function (e) { return e.ev === 'chat' && (e.kind === 'kid' || e.kind === 'said' || e.kind === 'step'); });
  const said = function (e) { return (e.kind === 'kid' ? 'KID: ' : (WHO[e.from] || e.from) + ': ') + short(e.text, 110); };
  const before = function (e, n) { const i = talk.indexOf(e); return talk.slice(Math.max(0, i - n), i).map(said); };
  const after = function (e, n) { const i = talk.indexOf(e); return talk.slice(i + 1, i + 1 + n).map(said); };
  const out = [];
  const add = function (kind, where, lines) { out.push({ kind: kind, where: where, lines: lines }); };
  const place = function (e) { return e.quest ? e.quest + '/' + e.beat : ''; };

  // 1. the AI let the kid down
  ev.forEach(function (e) {
    if (e.ev === 'mentor-turn' && (e.fellBack || !e.parsed)) add('AI answer unusable', place(e), ['kid said: "' + short(e.said, 100) + '"', e.fellBack ? 'reply was empty: the kid got the fallback line' : 'reply was not JSON', 'raw: ' + short(e.raw, 200)]);
    if (e.ev === 'ai' && e.how !== 'ok') add('AI call ' + e.how, place(e), ['kid said: "' + short(e.said, 100) + '"', 'after ' + e.ms + 'ms', e.task ? 'task: ' + short(e.task, 120) : '']);
    if (e.ev === 'ai' && e.how === 'ok' && e.ms > 8000) add('AI slow (' + Math.round(e.ms / 1000) + 's)', place(e), ['kid said: "' + short(e.said, 100) + '"']);
  });
  // 2. the kid was confused, and 3. drifted
  const CONFUSED = /^\s*(huh|what|wat|wut|where|which|how|wdym|idk|i ?d(o|on)n?['’]?t (get|know|understand)|confus|lost|\?+)|\?\s*$/i;
  const DRIFT = /\b(ha(ha)+|lol|lmao|la(la)+|boring|bored|meh|whatever|bye|stop|shut up|not reading|skip|i quit|this is dumb|no+ ?$)\b/i;
  talk.forEach(function (e) {
    if (e.kind !== 'kid') return;
    if (CONFUSED.test(e.text)) add('Kid confused or asking', place(e), before(e, 2).concat(['>> ' + said(e)], after(e, 2)));
    else if (DRIFT.test(e.text)) add('Kid drifting or bored', place(e), before(e, 1).concat(['>> ' + said(e)], after(e, 2)));
  });
  // 4. the studio said nearly the same thing again, in the same step
  const words = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; }); };
  const alike = function (a, b) { const A = words(a), B = words(b); if (A.length < 4 || B.length < 4) return false; const shared = A.filter(function (w) { return B.indexOf(w) >= 0; }).length; return shared / Math.min(A.length, B.length) >= 0.7; };
  const bot = talk.filter(function (e) { return e.kind !== 'kid'; });
  bot.forEach(function (e, i) {
    const earlier = bot.slice(Math.max(0, i - 6), i).filter(function (x) { return place(x) === place(e) && alike(x.text, e.text) && x.text !== e.text; })[0];
    if (earlier) add('Studio repeated itself', place(e), ['first: ' + said(earlier), 'again: ' + said(e)].concat(before(e, 1).filter(function (l) { return /^KID/.test(l); }).map(function (l) { return 'between them the kid said ' + l.slice(5); })));
  });
  // 5. the report gave up, or kept something as an idea instead of filing it
  talk.forEach(function (e) {
    if (e.kind === 'said' && /come back to it|kept (it|that) as an idea|say that another way/i.test(e.text)) add('Studio gave up on what the kid said', place(e), before(e, 4).concat(['>> ' + said(e)]));
  });
  // 6. errors
  ev.forEach(function (e) {
    if (e.ev === 'page-error') add('Page error', place(e), [e.text + ' at ' + e.at]);
    if (e.ev === 'build-failed') add('Build failed', place(e), [short(e.brief, 150)]);
    if (e.ev === 'chat' && e.kind === 'event' && /^Error/.test(e.text)) add('Game error', place(e), [e.text]);
  });

  // how long each step took, and what it needed
  const beats = [];
  ev.forEach(function (e) {
    if (!e.beat) return;
    const k = place(e), last = beats[beats.length - 1];
    if (!last || last.k !== k) beats.push({ k: k, from: Date.parse(e.t), to: Date.parse(e.t), typed: 0, hints: 0, stuck: 0 });
    const b = beats[beats.length - 1];
    b.to = Date.parse(e.t);
    if (e.ev === 'chat' && e.kind === 'kid') b.typed++;
    if (e.ev === 'chat' && e.kind === 'hint') b.hints++;
    if (e.ev === 'stuck') b.stuck++;
  });

  console.log('\nWHAT TO FIX  (' + out.length + ' moments; each is a lead, read the transcript around it)');
  const groups = {};
  out.forEach(function (o) { (groups[o.kind] = groups[o.kind] || []).push(o); });
  Object.keys(groups).forEach(function (k) {
    console.log('\n## ' + k + ' (' + groups[k].length + ')');
    groups[k].forEach(function (o) { console.log('  @ ' + o.where); o.lines.filter(Boolean).forEach(function (l) { console.log('      ' + l); }); });
  });
  if (!out.length) console.log('  Nothing the rules catch. Read the transcript anyway.');

  console.log('\n## Time per step (longest first)');
  beats.slice().sort(function (a, b) { return (b.to - b.from) - (a.to - a.from); }).slice(0, 10).forEach(function (b) {
    console.log('  ' + clock(b.to - b.from) + '  ' + b.k.padEnd(40) + b.typed + ' typed, ' + b.hints + ' hints' + (b.stuck ? ', stuck ' + b.stuck + 'x' : ''));
  });
  const kidTyped = talk.filter(function (e) { return e.kind === 'kid'; });
  const found = ev.filter(function (e) { return e.ev === 'ticket-filed'; });
  console.log('\n## Totals');
  console.log('  ' + kidTyped.length + ' lines typed, ' + ev.filter(function (e) { return e.ev === 'ai'; }).length + ' AI calls ('
    + ev.filter(function (e) { return e.ev === 'ai' && e.how !== 'ok'; }).length + ' failed), '
    + found.filter(function (e) { return e.by === 'kid' || e.by === 'You'; }).length + ' tickets found by the kid, '
    + found.filter(function (e) { return e.by !== 'kid' && e.by !== 'You'; }).length + ' filed for them, '
    + ev.filter(function (e) { return e.ev === 'quest-done'; }).length + ' quests done');
}
