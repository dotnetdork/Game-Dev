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
const CHARACTERS = ['mentor', 'lead-programmer', 'art-director', 'sound-designer', 'lead-designer', 'director', 'department'];
const PANELS = ['game', 'play', 'hierarchy', 'inspector', 'tickets', 'quest', 'project', 'script', 'stars', 'pause', 'console', 'doc'];
const EVENTS = ['fell', 'coin', 'lava', 'hurt', 'crossed', 'cleared'];  // what the game itself reports (cleared: every coin grabbed)
/* The parts a quest may name, and their settings. The Inspector's own list is public/studio/schema.js
   (the browser's); check-studio.js checks every setting here is one the schema has. */
const PARTS = { level: ['look', 'gravity'], player: ['look', 'speed', 'jump', 'gravityScale', 'tint', 'shape', 'x', 'y'],
  ground: ['solid', 'look', 'tint'], tile: ['solid', 'look', 'tint'], lava: ['look', 'hurts', 'w', 'tint'],
  coins: ['look', 'sound', 'size', 'tint', 'volume', 'pitch'] };
const COMPONENTS = ['coinArt', 'coinSound', 'coinSize', 'lavaArt', 'lavaSize', 'hazard', 'floorArt', 'playerMove', 'heroArt'];
/* A question whose answers come from the game, not the file. `findings`, `heroes`, `names` and
   `feedback` are TYPED: the kid says what they found, what their hero is, what their game is called,
   what they thought of the day, in their own words (Jay, 2026-09-28: the game name typed in chat,
   not a preselected card). They are asked in the chat with no card (spec D43); their `examples` are
   the placeholder's example and the suggestions a kid gets by saying "idk" (Jay, 2026-09-29: without
   them a kid can't tell what's wanted); tapping one is typing it. */
const PICKERS = ['tickets', 'findings', 'heroes', 'names', 'feedback'];
/* `hints` is a ladder, where → which → how (review §4, rule 3): one rung every `hints_after` seconds,
   or at once when the kid types "help", "stuck" or "idk". Never the answer before the last rung. */
/* `goal` is the step's task line, pinned under the chat's header while the step runs (Jay,
   2026-09-29: "There is no way for them to know whats happening"). Short, in the kid's terms, and
   never the answer: "Find out why the tile doesn't hold you", not "Tick the Box Collider". A beat
   that waits for something or asks something needs one. */
const BEAT_KEYS = ['id', 'character', 'goal', 'say', 'instruct', 'do', 'ask', 'wait_for', 'on', 'hints', 'hints_after', 'done_say', 'pass', 'award', 'skip_if', 'next'];
const GOAL_WORDS = 12;
const DO_KEYS = ['reveal', 'point', 'cue', 'play', 'stop', 'allow', 'close_inspector', 'file', 'recap'];
const ANSWER_KEYS = ['text', 'sub', 'say', 'goto', 'correct'];
const HANDLER_KEYS = ['when', 'say', 'instruct', 'once', 'flag', 'cue'];
const COND_KEYS = ['event', 'set', 'select', 'play', 'stop', 'reverted', 'state', 'flag', 'not_flag', 'seen_at_least', 'seen_none', 'playing', 'filed', 'built'];
const ASK_KEYS = ['text', 'answers', 'from', 'then', 'if_none', 'examples'];
/* One speaker, one message (Jay, 2026-09-29; chat.js says why): the lines of one `say` land as ONE
   bubble, so the whole list is what's counted. A hint is shown alone, so each hint is counted alone.
   An instruction (`instruct`) is one short line of what to do now. */
const SAY_WORDS = 22;       // a hint
const MESSAGE_WORDS = 28;   // a whole say list
const INSTRUCT_WORDS = 14;
const CUES = ['play', 'stop'];

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

function words(l) { return l.trim().split(/\s+/).length; }
function checkLines(list, where, lines, each) {
  if (!Array.isArray(lines) || !lines.length || lines.some(function (l) { return typeof l !== 'string' || !l.trim(); })) {
    return problem(list, where, 'lines must be a list of sentences');
  }
  if (each) return lines.forEach(function (l) {
    if (words(l) > SAY_WORDS) problem(list, where, 'a hint of ' + words(l) + ' words is too long (at most ' + SAY_WORDS + '): "' + l.slice(0, 40) + '…"');
  });
  const n = lines.reduce(function (t, l) { return t + words(l); }, 0);
  if (n > MESSAGE_WORDS) problem(list, where, 'these lines are one message of ' + n + ' words (at most ' + MESSAGE_WORDS + '); say less, or move the "do this" part to instruct: "' + lines[0].slice(0, 40) + '…"');
}
function checkInstruct(list, where, x) {
  if (x.instruct === undefined) return;
  if (typeof x.instruct !== 'string' || !x.instruct.trim()) return problem(list, where, 'instruct is one line of what to do now');
  if (words(x.instruct) > INSTRUCT_WORDS) problem(list, where, 'instruct is at most ' + INSTRUCT_WORDS + ' words: "' + x.instruct.slice(0, 40) + '…"');
}
/* A cue is the one thing to click next, pulsing (editor.js cue): Play or Stop, a part's row in the
   Hierarchy (`tile`), or one of its settings in the Inspector (`tile.solid`). */
function checkCue(list, where, c) {
  if (c === undefined || CUES.indexOf(c) >= 0) return;
  if (typeof c !== 'string') return problem(list, where, 'cue must be ' + CUES.join(' or ') + ', a part, or part.setting');
  checkPartKey(list, where + ' cue', c);
}

function checkAsk(list, where, ask, beatIds) {
  if (!ask || typeof ask.text !== 'string') return problem(list, where, 'ask needs text');
  Object.keys(ask).forEach(function (k) { if (ASK_KEYS.indexOf(k) < 0) problem(list, where, 'ask: unknown key "' + k + '"'); });
  if (ask.then !== undefined && ask.then !== 'again') problem(list, where, 'ask.then can only be "again"');
  if (ask.if_none !== undefined && beatIds.indexOf(ask.if_none) < 0) problem(list, where, 'if_none "' + ask.if_none + '" is not a beat in this quest');
  if (ask.from !== undefined) {
    if (PICKERS.indexOf(ask.from) < 0) problem(list, where, 'ask.from must be one of ' + PICKERS.join(', '));
    if (ask.examples !== undefined && (!Array.isArray(ask.examples) || ask.examples.length > 4 || ask.examples.some(function (x) { return typeof x !== 'string' || !x.trim(); }))) {
      problem(list, where, 'examples is a list of at most 4 short answers');
    }
    return;
  }
  /* A question with one answer is a Next button wearing a costume (review §4: no "Ready?" or "Make
     sense?" cards). If there is nothing to choose, the beat says its line and moves on. */
  if (Array.isArray(ask.answers) && ask.answers.length < 2) problem(list, where, 'a question needs at least two real answers');
  if (!Array.isArray(ask.answers) || !ask.answers.length) return problem(list, where, 'ask needs answers (or from:)');
  ask.answers.forEach(function (a, n) {
    const w = where + ' answer ' + (n + 1);
    if (!a || typeof a.text !== 'string') problem(list, w, 'needs text');
    /* An unknown key here is almost always YAML splitting text at a comma: { text: Ha, got it } is
       read as text "Ha" plus a key called "got it". Quote text that has a comma in it. */
    Object.keys(a || {}).forEach(function (k) { if (ANSWER_KEYS.indexOf(k) < 0) problem(list, w, 'unknown key "' + k + '" (text with a comma must be in quotes)'); });
    if (a.say) checkLines(list, w, a.say);
    /* Every answer on a card has a line under it saying what it means, as Claude's card does (Jay,
       2026-09-30: "with details and what not to support each answer"). In a quiz it describes the
       answer truly without saying which is right. */
    if (typeof a.sub !== 'string' || !a.sub.trim()) problem(list, w, 'needs sub: one short line under the answer saying what it means');
    else if (words(a.sub) > INSTRUCT_WORDS) problem(list, w, 'sub is at most ' + INSTRUCT_WORDS + ' words');
    /* again: ask the same question once more, WITHOUT this answer, so "Why does it do that?" can be
       asked once and never loops (it did, in Jay's playthrough). */
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
  /* next_quest: what starts when this one ends with nothing under it, so the course never stops at
     "that's everything for now" (Jay's playthrough: a dead end after the tickets). */
  if (q.next_quest !== undefined && !/^[a-z0-9-]+$/.test(q.next_quest)) problem(list, w0, 'next_quest must be a quest id');
  if (!Array.isArray(q.beats) || !q.beats.length) { problem(list, w0, 'needs beats'); return list; }
  const ids = q.beats.map(function (b) { return b && b.id; });
  ids.forEach(function (id, n) { if (!id) problem(list, w0, 'beat ' + (n + 1) + ' needs an id'); else if (ids.indexOf(id) !== n) problem(list, w0, 'two beats are called "' + id + '"'); });
  (q.on || []).forEach(function (h, n) {
    const w = w0 + ' on ' + (n + 1);
    Object.keys(h || {}).forEach(function (k) { if (HANDLER_KEYS.indexOf(k) < 0) problem(list, w, 'unknown key "' + k + '"'); });
    checkCond(list, w, h.when); if (h.say) checkLines(list, w, h.say); checkInstruct(list, w, h); checkCue(list, w, h.cue);
  });
  q.beats.forEach(function (b) {
    const w = w0 + ' beat "' + (b && b.id) + '"';
    Object.keys(b || {}).forEach(function (k) { if (BEAT_KEYS.indexOf(k) < 0) problem(list, w, 'unknown key "' + k + '"'); });
    if (b.character && CHARACTERS.indexOf(b.character) < 0) problem(list, w, 'unknown character "' + b.character + '"');
    if (b.say) checkLines(list, w, b.say);
    checkInstruct(list, w, b);
    if (b.done_say) checkLines(list, w, b.done_say);
    if ((b.wait_for || b.ask) && !b.goal) problem(list, w, 'needs a goal: the task line the kid sees while this step runs');
    if (b.goal !== undefined && (typeof b.goal !== 'string' || b.goal.trim().split(/\s+/).length > GOAL_WORDS)) problem(list, w, 'goal is one line of at most ' + GOAL_WORDS + ' words');
    if (b.hints) checkLines(list, w + ' hints', b.hints, true);
    if (b.hints_after !== undefined && !(b.hints_after >= 5)) problem(list, w, 'hints_after is seconds, at least 5');
    if (b.do) {
      Object.keys(b.do).forEach(function (k) { if (DO_KEYS.indexOf(k) < 0) problem(list, w, 'do: unknown action "' + k + '"'); });
      checkCue(list, w, b.do.cue);
      (b.do.reveal || []).forEach(function (p) { if (PANELS.indexOf(p) < 0) problem(list, w, 'reveal: unknown panel "' + p + '"'); });
      if (b.do.point && PANELS.indexOf(b.do.point) < 0) problem(list, w, 'point: unknown panel "' + b.do.point + '"');
      (b.do.allow || []).forEach(function (c) { if (COMPONENTS.indexOf(c) < 0) problem(list, w, 'allow: unknown component "' + c + '"'); });
      // `file: rest` files every ticket the kid didn't report, each by its department (quest.js act)
      if (b.do.file !== undefined && b.do.file !== 'rest' && !Array.isArray(b.do.file)) problem(list, w, 'file is a list of tickets, or "rest"');
      if (Array.isArray(b.do.file)) b.do.file.forEach(function (t) { if (ticketIds.indexOf(t) < 0) problem(list, w, 'file: no ticket "' + t + '"'); });
    }
    if (b.ask) checkAsk(list, w, b.ask, ids);
    if (b.wait_for) checkCond(list, w + ' wait_for', b.wait_for);
    if (b.skip_if) checkCond(list, w + ' skip_if', b.skip_if);
    (b.on || []).forEach(function (h, n) {
      Object.keys(h || {}).forEach(function (k) { if (HANDLER_KEYS.indexOf(k) < 0) problem(list, w + ' on ' + (n + 1), 'unknown key "' + k + '"'); });
      checkCond(list, w + ' on ' + (n + 1), h.when);
      if (h.say) checkLines(list, w + ' on ' + (n + 1), h.say);
      checkInstruct(list, w + ' on ' + (n + 1), h); checkCue(list, w + ' on ' + (n + 1), h.cue);
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
    if (k.words !== undefined) { try { new RegExp(k.words, 'i'); } catch (e) { problem(list, w, 'words is not a valid pattern (' + e.message + ')'); } }
    if (k.fixed_when) checkCond(list, w + ' fixed_when', k.fixed_when);
    /* `says` is the finding in a kid's words, the AI's example when it matches a report (never shown
       to the kid; tickets.yaml says why). `detail` and `done` are the ticket's page: what is wrong,
       and how the kid will know it's fixed. */
    if (!k.says) problem(list, w, 'needs says: the finding as a kid would put it');
    // the report's second question, what should have happened (tickets.yaml says why)
    if (!k.should_ask || !/\?\s*$/.test(k.should_ask)) problem(list, w, 'needs should_ask: a question that leads a kid to what should happen');
    if (!k.should) problem(list, w, 'needs should: what should happen, in a kid\'s words, said if they stay stuck');
    if (k.should_q !== undefined && !/\?\s*$/.test(k.should_q)) problem(list, w, 'should_q, the question itself for a problem that is not something happening, must be a question');
    // "that's all" with this one unfound: the question that sends them to look (tickets.yaml says why)
    if (!k.nudge || !/\?\s*$/.test(k.nudge)) problem(list, w, 'needs nudge: a question that says where to look, not what is wrong');
    if (k.nudge_yes !== undefined) { try { new RegExp(k.nudge_yes, 'i'); } catch (e) { problem(list, w, 'nudge_yes is not a valid pattern (' + e.message + ')'); } }
    if (!k.detail) problem(list, w, 'needs detail: what is wrong, for the ticket\'s page');
    if (!k.done) problem(list, w, 'needs done: how the kid will know it is fixed, for the ticket\'s page');
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
  Object.keys(out.quests).forEach(function (id) { const n = out.quests[id].next_quest; if (n && !out.quests[n]) problems.push(id + '.yaml: next_quest "' + n + '" does not exist'); });
  out.problems = problems;
  return out;
}

module.exports = { load: load, checkQuest: checkQuest, checkTickets: checkTickets, VOCAB: { DEPARTMENTS, CHARACTERS, PANELS, EVENTS, PARTS, COMPONENTS, PICKERS, SAY_WORDS, MESSAGE_WORDS, INSTRUCT_WORDS } };
