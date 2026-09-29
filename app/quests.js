/* quests.js: loads the course's quests and tickets, and says whether each file is well formed.

   The course (V2) is authored data run by one engine (docs/rework/v2-spec.md §2.1): a quest file
   says what happens, and public/studio/quest.js makes it happen. This file is the contract between
   the two. It is used in two places, on purpose the same code:
     - the server, which parses the YAML once and hands the browser JSON (GET /api/quests), so the
       browser needs no YAML parser and never sees a file the validator refused;
     - tools/check-quests.js, which runs it in `npm test`, so a quest the AI author drafted (or a
       person edited) can't reach a class malformed.

   WHY SO STRICT. A quest that names a part that doesn't exist, or waits on an event the game never
   sends, doesn't crash: it just never moves on, and a kid sits at a beat forever. Every name a
   quest can use is listed below, and anything else is an error with the file and beat in it. */
const fs = require('fs');
const path = require('path');
const yaml = require('./public/vendor/js-yaml/js-yaml.min.js');

const DIR = path.join(__dirname, 'content', 'quests');

/* The vocabulary. Adding a word here is adding a feature to the engine; the two must move together. */
const DEPARTMENTS = ['studio', 'engineering', 'art', 'audio', 'design'];
const CHARACTERS = ['mentor', 'lead-programmer', 'art-director', 'sound-designer', 'lead-designer', 'department'];
const PANELS = ['game', 'play', 'hierarchy', 'inspector', 'tickets', 'quest', 'project', 'script', 'stars', 'pause'];
const EVENTS = ['fell', 'coin', 'lava', 'hurt', 'crossed'];            // what the game itself reports
const PARTS = { level: ['look', 'gravity'], player: ['look', 'speed', 'jump'], ground: ['solid', 'look'],
  tile: ['solid', 'look'], lava: ['look', 'hurts'], coins: ['look', 'sound', 'size'] };
const COMPONENTS = ['coinArt', 'coinSound', 'coinSize', 'lavaArt', 'hazard', 'floorArt', 'playerMove'];
const PICKERS = ['tickets', 'heroes', 'names'];
const BEAT_KEYS = ['id', 'character', 'say', 'do', 'ask', 'wait_for', 'on', 'hint', 'hints_after', 'done_say', 'pass', 'award', 'skip_if', 'next'];
const DO_KEYS = ['reveal', 'point', 'cue', 'play', 'stop', 'allow', 'close_inspector', 'file_tickets'];
const ANSWER_KEYS = ['text', 'sub', 'say', 'goto', 'correct'];
const HANDLER_KEYS = ['when', 'say', 'once', 'flag', 'cue'];
const COND_KEYS = ['event', 'set', 'select', 'play', 'stop', 'reverted', 'state', 'flag', 'not_flag', 'found_at_least', 'found_none', 'playing', 'filed'];

function problem(list, where, msg) { list.push(where + ': ' + msg); }

function checkPartKey(list, where, pk) {
  const [part, key] = String(pk).split('.');
  if (!PARTS[part]) return problem(list, where, 'no part called "' + part + '" (parts: ' + Object.keys(PARTS).join(', ') + ')');
  if (key !== undefined && PARTS[part].indexOf(key) < 0) problem(list, where, part + ' has no setting "' + key + '" (it has: ' + PARTS[part].join(', ') + ')');
}

function checkCond(list, where, c) {
  if (!c || typeof c !== 'object') return problem(list, where, 'a condition must be a map');
  Object.keys(c).forEach(function (k) { if (COND_KEYS.indexOf(k) < 0) problem(list, where, 'unknown condition "' + k + '"'); });
  if (c.event !== undefined && EVENTS.indexOf(c.event) < 0) problem(list, where, 'the game never sends "' + c.event + '" (it sends: ' + EVENTS.join(', ') + ')');
  if (c.set) {
    if (!c.set.part) problem(list, where, 'set: needs a part');
    else checkPartKey(list, where, c.set.part + (c.set.key ? '.' + c.set.key : ''));
  }
  if (c.select) checkPartKey(list, where, c.select);
  if (c.state) Object.keys(c.state).forEach(function (pk) { checkPartKey(list, where, pk); });
}

function checkLines(list, where, lines) {
  if (!Array.isArray(lines) || !lines.length || lines.some(function (l) { return typeof l !== 'string' || !l.trim(); })) {
    problem(list, where, 'lines must be a list of sentences');
  }
}

function checkAsk(list, where, ask, beatIds) {
  if (!ask || typeof ask.text !== 'string') return problem(list, where, 'ask needs text');
  if (ask.from !== undefined) {
    if (PICKERS.indexOf(ask.from) < 0) problem(list, where, 'ask.from must be one of ' + PICKERS.join(', '));
    return;
  }
  if (!Array.isArray(ask.answers) || !ask.answers.length) return problem(list, where, 'ask needs answers (or from:)');
  ask.answers.forEach(function (a, n) {
    const w = where + ' answer ' + (n + 1);
    if (!a || typeof a.text !== 'string') problem(list, w, 'needs text');
    /* An unknown key here is almost always YAML splitting text at a comma: { text: Ha, got it } is
       read as text "Ha" plus a key called "got it". Quote text that has a comma in it. */
    Object.keys(a || {}).forEach(function (k) { if (ANSWER_KEYS.indexOf(k) < 0) problem(list, w, 'unknown key "' + k + '" (text with a comma must be in quotes)'); });
    if (a.say) checkLines(list, w, a.say);
    if (a.goto && a.goto !== 'next' && a.goto !== 'end' && a.goto !== 'again' && beatIds.indexOf(a.goto) < 0) problem(list, w, 'goto "' + a.goto + '" is not a beat in this quest');
  });
  if (ask.answers.some(function (a) { return a && a.correct; }) && !ask.answers.some(function (a) { return a && !a.correct && a.say; })) {
    problem(list, where, 'a quiz question needs a line for the wrong answers, so a kid learns why');
  }
}

function checkQuest(q, file, ticketIds) {
  const list = [];
  const w0 = file;
  if (!q || typeof q !== 'object') { problem(list, w0, 'is empty'); return list; }
  if (!q.id || !/^[a-z0-9-]+$/.test(q.id)) problem(list, w0, 'needs an id in kebab-case');
  if (q.id && path.basename(file, '.yaml') !== q.id) problem(list, w0, 'id "' + q.id + '" must match the file name');
  if (!q.title) problem(list, w0, 'needs a title');
  if (DEPARTMENTS.indexOf(q.department) < 0) problem(list, w0, 'department must be one of ' + DEPARTMENTS.join(', '));
  if (CHARACTERS.indexOf(q.character) < 0 || q.character === 'department') problem(list, w0, 'character must be one of ' + CHARACTERS.slice(0, -1).join(', '));
  if (q.ticket && ticketIds.indexOf(q.ticket) < 0) problem(list, w0, 'ticket "' + q.ticket + '" is not in tickets.yaml');
  (q.allow || []).forEach(function (c) { if (COMPONENTS.indexOf(c) < 0) problem(list, w0, 'allow: unknown component "' + c + '"'); });
  if (!Array.isArray(q.beats) || !q.beats.length) { problem(list, w0, 'needs beats'); return list; }
  const ids = q.beats.map(function (b) { return b && b.id; });
  ids.forEach(function (id, n) { if (!id) problem(list, w0, 'beat ' + (n + 1) + ' needs an id'); else if (ids.indexOf(id) !== n) problem(list, w0, 'two beats are called "' + id + '"'); });
  (q.on || []).forEach(function (h, n) { checkCond(list, w0 + ' on ' + (n + 1), h.when); if (h.say) checkLines(list, w0 + ' on ' + (n + 1), h.say); });
  q.beats.forEach(function (b) {
    const w = w0 + ' beat "' + (b && b.id) + '"';
    Object.keys(b || {}).forEach(function (k) { if (BEAT_KEYS.indexOf(k) < 0) problem(list, w, 'unknown key "' + k + '"'); });
    if (b.character && CHARACTERS.indexOf(b.character) < 0) problem(list, w, 'unknown character "' + b.character + '"');
    if (b.say) checkLines(list, w, b.say);
    if (b.done_say) checkLines(list, w, b.done_say);
    if (b.hint) checkLines(list, w, b.hint);
    if (b.do) {
      Object.keys(b.do).forEach(function (k) { if (DO_KEYS.indexOf(k) < 0) problem(list, w, 'do: unknown action "' + k + '"'); });
      (b.do.reveal || []).forEach(function (p) { if (PANELS.indexOf(p) < 0) problem(list, w, 'reveal: unknown panel "' + p + '"'); });
      if (b.do.point && PANELS.indexOf(b.do.point) < 0) problem(list, w, 'point: unknown panel "' + b.do.point + '"');
      (b.do.allow || []).forEach(function (c) { if (COMPONENTS.indexOf(c) < 0) problem(list, w, 'allow: unknown component "' + c + '"'); });
    }
    if (b.ask) checkAsk(list, w, b.ask, ids);
    if (b.wait_for) checkCond(list, w + ' wait_for', b.wait_for);
    if (b.skip_if) checkCond(list, w + ' skip_if', b.skip_if);
    (b.on || []).forEach(function (h, n) {
      Object.keys(h || {}).forEach(function (k) { if (HANDLER_KEYS.indexOf(k) < 0) problem(list, w + ' on ' + (n + 1), 'unknown key "' + k + '"'); });
      checkCond(list, w + ' on ' + (n + 1), h.when);
      if (h.say) checkLines(list, w + ' on ' + (n + 1), h.say);
    });
    if (b.next && b.next !== 'end' && ids.indexOf(b.next) < 0) problem(list, w, 'next "' + b.next + '" is not a beat');
    // A beat with neither wait_for nor ask moves straight on once its lines are said: "say, then next".
  });
  return list;
}

function checkTickets(t, file) {
  const list = [];
  if (!t || !Array.isArray(t.tickets)) { problem(list, file, 'needs a tickets: list'); return list; }
  t.tickets.forEach(function (k, n) {
    const w = file + ' ticket ' + (k && k.id || n + 1);
    if (!k.id || !k.title) problem(list, w, 'needs an id and a title');
    if (DEPARTMENTS.indexOf(k.department) < 0) problem(list, w, 'department must be one of ' + DEPARTMENTS.join(', '));
    if (!k.quest) problem(list, w, 'needs the quest that fixes it');
    if (k.found_by) checkCond(list, w + ' found_by', k.found_by);
    if (k.fixed_when) checkCond(list, w + ' fixed_when', k.fixed_when);
  });
  return list;
}

/* Everything, parsed and checked. `problems` is empty when the course is fit to run. */
function load() {
  const problems = [];
  const out = { tickets: [], quests: {} };
  let files = [];
  try { files = fs.readdirSync(DIR).filter(function (f) { return f.endsWith('.yaml'); }); }
  catch (e) { return { tickets: [], quests: {}, problems: ['content/quests/ is missing'] }; }
  const parse = function (f) {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
    /* The same comma trap in a one-line list: say: [ Use the arrows, or A and D ] is TWO lines to
       YAML. Lines go in a block list (one per row) or in quotes. */
    raw.split(/\r?\n/).forEach(function (line, n) {
      const m = line.match(/^\s*(say|done_say|hint):\s*\[(.*)\]\s*$/);
      if (m && /,/.test(m[2]) && !/^\s*"/.test(m[2])) problems.push(f + ' line ' + (n + 1) + ': a one-line ' + m[1] + ' list splits at every comma; put each line on its own row');
    });
    try { return yaml.load(raw); }
    catch (e) { problems.push(f + ': not valid YAML (' + String(e.message).split('\n')[0] + ')'); return null; }
  };
  if (files.indexOf('tickets.yaml') < 0) problems.push('content/quests/tickets.yaml is missing');
  else {
    const t = parse('tickets.yaml');
    checkTickets(t, 'tickets.yaml').forEach(function (p) { problems.push(p); });
    out.tickets = (t && t.tickets) || [];
  }
  const ticketIds = out.tickets.map(function (t) { return t.id; });
  files.filter(function (f) { return f !== 'tickets.yaml'; }).forEach(function (f) {
    const q = parse(f); if (!q) return;
    checkQuest(q, f, ticketIds).forEach(function (p) { problems.push(p); });
    if (q.id) out.quests[q.id] = q;
  });
  out.tickets.forEach(function (t) { if (t.quest && !out.quests[t.quest]) problems.push('tickets.yaml: ticket ' + t.id + ' is fixed by quest "' + t.quest + '", which does not exist'); });
  out.problems = problems;
  return out;
}

module.exports = { load: load, checkQuest: checkQuest, checkTickets: checkTickets, VOCAB: { DEPARTMENTS, CHARACTERS, PANELS, EVENTS, PARTS, COMPONENTS, PICKERS } };
