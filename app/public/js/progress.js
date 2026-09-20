/* progress.js — what the student has earned, and what they have finished.
 *
 * Moved out of project.js by the Phase 6 split in docs/architecture-audit-2026-09-15.md.
 *
 * XP, Stars, badges, the weekly reset, the per-lesson activity ledger, lab and practice working
 * state, and the rules that read a student's code to decide whether a practice step is done.
 *
 * The ledger is the part worth understanding: a 50-minute class gets interrupted, and re-answering
 * four questions to re-earn something already earned is how you lose an eleven-year-old. So every
 * resolved activity is keyed by lesson id and widget key and written through to storage.
 *
 * Reads SCHEMA and keepBroken() from project.js. Loaded after it.
 */
const SKEY = 'leagueProgress';
/* `labs` is separate from `activities` on purpose. `activities` answers "is this done?" and is
   read with !!, so putting a draft in there would mark an unfinished lab as complete. This holds
   the working state of a lab instead — the code as they left it, whether they have committed to a
   guess, how many runs have failed — keyed "<lessonId>:<widgetKey>". A 50-minute class gets
   interrupted; coming back to an empty editor is how you lose a 12-year-old.
   The lesson half of that key is the lesson's id from course.yaml — a slug, never a position. See
   the note above V1_COURSE. */
/* `badges` is new, and it is not a cosmetic addition. Every one of the 22 lessons ends with a
   your-turn step whose card says "Doing this unlocks the <X> badge", and until now nothing anywhere
   awarded, stored or displayed one. The app made a specific promise to a child twenty-two times and
   kept it zero times.
   Shape: badge name -> { at: <when>, lesson: "<lesson id>" }. Keyed by name because the question a
   student asks is "have I got the Bug Hunter badge", not "what did the twelfth lesson give me".
   No schema bump needed: loadState() merges DEFAULT_STATE first, so an older save gains the key
   with an empty object — which is exactly the case check-state.js already covers. */
/* `at` is the lesson id the student was last on, for the case the URL cannot answer — they opened
   a bookmark of "/" or typed the bare address. Before it existed, every arrival started at lesson 1
   regardless of how far through the course they were. See js/router.js. */
/* `chats` is a STRIPPED snapshot of the assistant's conversations — see persistChats in js/ai.js.
   The live threads keep their proposal internals in memory; what is written here is text and
   outcomes only, because a saved diff is both large and unsafe to re-apply against code that has
   changed since. */
const DEFAULT_STATE = { v: SCHEMA.progress, xp: 0, stars: 400, done: {}, modDone: {}, unlocked: {}, published: [], activities: {}, labs: {}, badges: {}, practice: {}, at: '', weekXp: 0, weekStart: 0, chats: { threads: [], current: {} } };
function loadState() {
  const raw = Storage.read(SKEY);
  if (!raw) return Object.assign({}, DEFAULT_STATE);
  let s;
  try { s = JSON.parse(raw); } catch (e) { keepBroken(SKEY, raw, 'could not be read'); return Object.assign({}, DEFAULT_STATE); }
  if (!s || typeof s !== 'object' || Array.isArray(s)) { keepBroken(SKEY, raw, 'was not progress we recognise'); return Object.assign({}, DEFAULT_STATE); }
  const r = migrate('progress', s);
  if (r.status === 'future') console.warn('[league] progress was saved by a newer version of the app; leaving it untouched.');
  // Object.assign order matters: defaults first so a key added in a later release appears, saved
  // values second so nothing the student earned is overwritten by a default.
  return Object.assign({}, DEFAULT_STATE, r.data);
}
let state = loadState();

/* ---------- per-lesson activity ledger ----------
   Which in-lesson activities the student has resolved, keyed lesson id -> widget key
   ("q0", "r1", "c0"). Widget keys come from document order, not Math.random(), so an answer
   survives navigating away, completing the lesson, and closing the browser. This is what
   completion is gated on — a 50-minute class period gets interrupted, and re-answering four
   questions to re-earn something you already earned is how you lose an 11-year-old. */
function lessonActivities(lessonId) {
  return (state.activities && state.activities[lessonId]) || {};
}
function activityDone(lessonId, key) { return !!lessonActivities(lessonId)[key]; }

/* ---------- lab working state ---------- */
function labKey(lessonId, key) { return (lessonId || 'l') + ':' + key; }
function labState(lessonId, key) {
  if (!state.labs) state.labs = {};                       // progress saved before labs existed
  return state.labs[labKey(lessonId, key)] || null;
}
function saveLabState(lessonId, key, patch) {
  if (!state.labs) state.labs = {};
  const k = labKey(lessonId, key);
  state.labs[k] = Object.assign({ code: null, guessed: false, fails: 0, revealed: false, hintsUsed: 0, tutorOffered: false }, state.labs[k], patch);
  saveState();
  return state.labs[k];
}
function clearLabState(lessonId, key) {
  if (state.labs) delete state.labs[labKey(lessonId, key)];
  saveState();
}

/* ---------- practice state ----------
   A practice step asks the student to change their OWN game, so unlike a quiz there is no answer
   to compare against — only a before and an after. `snap` is their project as it stood when they
   first opened the step, which is what makes "did anything actually change?" answerable at all.

   No schema bump: this is a new key with an empty default, and loadState() merges DEFAULT_STATE
   before the saved values, so an older save simply gains it. Same reasoning as badges above — a
   migration is for a shape that CHANGED, and nothing here did. */
function practiceKey(lessonId, key) { return (lessonId || 'l') + ':' + key; }
function practiceState(lessonId, key) {
  if (!state.practice) state.practice = {};
  return state.practice[practiceKey(lessonId, key)] || null;
}
function savePracticeState(lessonId, key, patch) {
  if (!state.practice) state.practice = {};
  const k = practiceKey(lessonId, key);
  state.practice[k] = Object.assign(
    { snap: null, tries: 0, helped: false, passed: false }, state.practice[k], patch);
  saveState();
  return state.practice[k];
}
/* Taken once, when the step is first RENDERED — that is, when the student first sees the task —
   and never overwritten afterwards.

   Both halves of that matter. Taking it later, on the first press of Check, seems tidier and is
   wrong: the ordinary way to do a practice step is to read it, go to the Code tab, do the work, and
   then press Check. Snapshot at that press and "before" already contains their work, so
   `changed_at_least` sees nothing changed and fails the student who did it properly.
   Never overwriting matters for the opposite reason: re-rendering on every visit would keep moving
   "before" forward, and work done in an earlier session would stop counting. */
function practiceSnapshot(lessonId, key) {
  const p = practiceState(lessonId, key);
  if (p && p.snap) return p.snap;
  const snap = {};
  fileNames().forEach(function (n) { snap[n] = project.files[n]; });
  return savePracticeState(lessonId, key, { snap: snap }).snap;
}

/* ---------- checking a practice step by reading the student's code ----------
   Deterministic where a program can be certain, which is most of the time. This runs in the
   browser, costs nothing, works with no network, and cannot be argued with — the AI is only asked
   about the tasks where "did they do it?" is a genuine judgement.

   Every rule is one key in a `check:` list in the lesson. Unknown rule names FAIL LOUDLY rather
   than passing quietly: a typo in a rule name that silently means "yes" would hand out badges for
   nothing, which is the exact failure this whole feature exists to remove. */
function practiceRuleResult(rule, snap) {
  const files = project.files;
  const readFile = function (name) { return typeof files[name] === 'string' ? files[name] : ''; };
  /* Two "everything" readings, because the project is no longer all code.
     allCode is for the rules that reason about PROGRAM structure — a function existing, a call
     inside update(), whether the thing still parses. Handing those a page of English produces
     nonsense: a sentence with the word "const" in it would register as a declaration.
     allFiles is for `contains` and `matches` with no `file:`, which AUTHORING.md documents as
     searching the whole project — and the student's notes are part of their project. A checkpoint
     that asks "have they written their core loop down" needs to be able to find it. */
  const allCode = function () { return codeFileNames().map(readFile).join('\n'); };
  const allFiles = function () { return fileNames().map(readFile).join('\n'); };

  /* ---------- no baseline means nothing has changed yet ----------
     Five of the rules below ask "is this DIFFERENT from when you started", and each one reads its
     before out of `snap`. Handed no snapshot they each fall back to an empty string, and an empty
     string makes EVERYTHING look like the student's work: every CONFIG number differs from a
     number that was never recorded, every function in the starter counts as newly added, every
     file counts as edited.

     That is not hypothetical. A checkpoint door asks whether each objective is done in order to
     draw its ticks, and it has no snapshot to ask with — so every build checkpoint greeted the
     student with "3 of 4 already done" and three green ticks before they had opened it once.

     The honest reading of "different from when you started" with no record of the start is "no".
     Listed by name rather than caught by a default so that a new comparison rule shows up here as
     an omission instead of quietly inheriting the bug. */
  if (!snap && (rule.config_changed || rule.function_added || rule.file_changed || rule.new_file
      || typeof rule.changed_at_least === 'number')) {
    return { ok: false, why: 'you have not started this one yet' };
  }

  if (rule.contains) {
    const f = rule.contains.file, t = String(rule.contains.text || '');
    const hay = f ? readFile(f) : allFiles();
    return { ok: hay.indexOf(t) >= 0, why: 'nothing in ' + (f || 'your game') + ' contains "' + t + '" yet' };
  }
  /* ---- the Design tab's answer to `contains` ----
     A your-turn step that asks the student to write something on their BOARD, rather than in a
     file. The board used to be a structured view of `design.md` in the project, so `contains:` with
     a filename could see it; it has its own object model now and lives outside the project
     entirely, so this asks board.js instead.

     `text` is a substring, matched case-insensitively across every heading, note and arrow label —
     a child writing on a sticky is not going to match capitals. `notes` is a count instead, for the
     steps that just want "put three things in this frame". */
  if (rule.board_contains) {
    if (typeof boardText !== 'function') return null;          // board not loaded: cannot check
    const want = String(rule.board_contains.text || rule.board_contains || '').toLowerCase();
    const min = Number(rule.board_contains.notes || 0);
    if (min) {
      const n = typeof boardItemCount === 'function' ? boardItemCount('note') : 0;
      return { ok: n >= min, why: 'your board has ' + n + ' sticky note' + (n === 1 ? '' : 's') + ' — this one wants ' + min };
    }
    if (!want) return { ok: false, bad: 'the `board_contains:` rule has nothing to look for' };
    return {
      ok: boardText().toLowerCase().indexOf(want) >= 0,
      why: 'nothing on your board says "' + want + '" yet — write it on a sticky in the Design tab'
    };
  }
  if (rule.matches) {
    const f = rule.matches.file, src = String(rule.matches.regex || '');
    let re; try { re = new RegExp(src, 'm'); } catch (e) { return { ok: false, bad: 'the `matches:` pattern is not a valid regular expression: ' + src }; }
    return { ok: re.test(f ? readFile(f) : allFiles()), why: 'nothing in ' + (f || 'your game') + ' matches that pattern yet' };
  }
  if (rule.config_changed) {
    const keys = Array.isArray(rule.config_changed) ? rule.config_changed : [rule.config_changed];
    const cf = configFile();
    const before = parseConfig(String((snap && snap[cf]) || '')), after = parseConfig(readFile(cf));
    const moved = keys.filter(function (k) { return before[k] !== after[k]; });
    return { ok: moved.length > 0, why: keys.join(' or ') + ' is still the number it started at' };
  }
  if (rule.function_added) {
    const had = topLevelNames(String((snap && Object.keys(snap).filter(isCodeFile).map(function (n) { return snap[n]; }).join('\n')) || ''));
    const has = topLevelNames(allCode());
    /* `function_added: true` means ANY new top-level name, rather than one in particular. A
       building zone's objective is "write a function for your mechanic" — the whole point is that
       the student chooses what it is called, so there is no name to demand. Naming one is still
       right where the task names it. */
    if (rule.function_added === true) {
      const added = has.filter(function (n) { return had.indexOf(n) < 0; });
      return { ok: added.length > 0, why: 'there is no new function in your game yet' };
    }
    const name = String(rule.function_added);
    return { ok: has.indexOf(name) >= 0 && had.indexOf(name) < 0,
      why: 'there is no new function called ' + name + ' yet' };
  }
  /* They have put a game in the Gallery. The last objective of the last zone in the course, and the
     only check in the set that reads progress rather than code — because publishing is the one
     thing a student does that leaves no trace in their files. */
  if (rule.published) {
    const n = (state && Array.isArray(state.published)) ? state.published.length : 0;
    return { ok: n > 0, why: 'nothing has been published to the Gallery yet' };
  }
  /* One named file is different from how it started. `changed_at_least` counts the whole project,
     which cannot tell "they wired it into game.js" from "they typed a lot into config.js" — and for
     a build objective that distinction is the objective. */
  if (rule.file_changed) {
    const n = String(rule.file_changed);
    const before = (snap && typeof snap[n] === 'string') ? snap[n] : '';
    return { ok: readFile(n) !== before, why: n + ' has not changed yet' };
  }
  if (rule.function_kept) {
    const name = String(rule.function_kept);
    return { ok: topLevelNames(allCode()).indexOf(name) >= 0, why: name + ' is gone from your game' };
  }
  if (rule.called_in_update) {
    /* Inside update(), not merely present in the file. fnBodyEnd skips strings and comments, so a
       call that is commented out does not count — which is the difference between "I wrote it" and
       "it runs". */
    const name = String(rule.called_in_update);
    const hit = codeFileNames().some(function (n) {
      const code = readFile(n);
      const end = fnBodyEnd(code, 'update');
      if (end < 0) return false;
      const open = code.indexOf('{', code.search(/function\s+update\s*\(/));
      if (open < 0 || open >= end) return false;
      return code.slice(open, end).indexOf(name) >= 0;
    });
    return { ok: hit, why: name + ' is not being called inside update() yet' };
  }
  if (rule.new_file) {
    const before = snap ? Object.keys(snap) : [];
    const added = fileNames().filter(function (n) { return before.indexOf(n) < 0; });
    return { ok: added.length > 0, why: 'no new file has been added to your project yet' };
  }
  if (typeof rule.changed_at_least === 'number') {
    let n = 0;
    fileNames().forEach(function (name) {
      const before = (snap && typeof snap[name] === 'string') ? snap[name] : '';
      const rows = lineDiff(before, readFile(name));
      if (rows) { const c = countChanges(rows); n += c.added + c.removed; }
    });
    return { ok: n >= rule.changed_at_least,
      why: 'only ' + n + ' line(s) of your game have changed so far' };
  }
  if (rule.parses) {
    // Code files only. A markdown file in the project never parses as JavaScript, so without this
    // every `parses: true` rule in the course would fail for every student, permanently.
    const broken = codeFileNames().filter(function (n) { return !validJS(readFile(n)); });
    return { ok: broken.length === 0, why: broken.length ? broken[0] + ' has a syntax error in it' : '' };
  }
  const named = Object.keys(rule).filter(function (k) { return k !== 'hint'; });
  return { ok: false, bad: 'unknown check rule ' + JSON.stringify(named) + ' — see AUTHORING.md' };
}

/* What changed since the snapshot, as a diff, for the grader to read.
   A diff rather than the whole project on purpose: the grader is judging one specific task, and
   handing a model six thousand lines to find a two-line change in is how it ends up confidently
   judging the wrong code. Per file, only the changed lines with a little context. */
function practiceDiff(snap) {
  const out = [];
  fileNames().forEach(function (name) {
    const before = (snap && typeof snap[name] === 'string') ? snap[name] : '';
    const after = typeof project.files[name] === 'string' ? project.files[name] : '';
    if (before === after) return;
    const rows = lineDiff(before, after);
    if (!rows) { out.push('--- ' + name + ' --- (too large to diff)'); return; }
    const body = diffHunks(rows, 2)
      .map(function (r) { return (r.t === '…' ? '…' : r.t + ' ' + r.text); }).join('\n');
    out.push('--- ' + name + ' ---\n' + body);
  });
  return out.join('\n\n').slice(0, 6000);
}

/* Runs every rule and returns the first failure's hint, because a student given four things wrong
   at once fixes none of them. `bad` is an authoring error, kept separate from a student's work not
   being done yet: one is our bug and one is theirs, and telling them apart matters. */
function checkPracticeRules(rules, snap) {
  if (!Array.isArray(rules) || !rules.length) return { pass: null, hint: '', authoring: [] };
  const authoring = [];
  let firstFail = null;
  rules.forEach(function (rule) {
    if (!rule || typeof rule !== 'object') { authoring.push('a `check:` entry is not a set of keys'); return; }
    const r = practiceRuleResult(rule, snap);
    if (r.bad) { authoring.push(r.bad); return; }
    if (!r.ok && !firstFail) firstFail = { hint: rule.hint || r.why };
  });
  if (authoring.length) return { pass: null, hint: '', authoring: authoring };
  return { pass: !firstFail, hint: firstFail ? firstFail.hint : '', authoring: [] };
}
/* ---------- badges ----------
   Earned by doing the technique in your OWN game — a badge records that you did something.
   Awarding is idempotent: a student who re-opens a finished lesson does not earn it twice and does
   not get told about it again. */
function hasBadge(name) { return !!(state.badges && state.badges[name]); }
function badgeCount() { return state.badges ? Object.keys(state.badges).length : 0; }
function awardBadge(name, lessonId) {
  const n = String(name == null ? '' : name).trim();
  if (!n) return false;
  if (!state.badges) state.badges = {};
  if (state.badges[n]) return false;                 // already earned
  state.badges[n] = { at: Date.now(), lesson: lessonId || '' };
  saveState();
  emit(EV.BADGE_EARNED, { name: n, lesson: lessonId || '' });
  return true;
}

/* ---------- XP, total and this week ----------
   The weekly board needs a weekly number. It did not have one: it ranked the student by their
   ALL-TIME xp against everyone else's weekly figures, so anyone a few lessons in topped the weekly
   board permanently — which is the exact "one child is always first, one is always last" shape a
   resetting board exists to avoid.
   Monday-based, and it rolls over lazily: the first read or award in a new week zeroes the counter.
   No timer has to run, and a laptop that was shut all week catches up the moment it opens. */
function weekStamp(when) {
  const t = new Date(when || Date.now());
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7));   // back to Monday
  return t.getTime();
}
function weekXp() {
  const w = weekStamp();
  if (state.weekStart !== w) { state.weekStart = w; state.weekXp = 0; saveState(); }
  return state.weekXp || 0;
}
/* The one place XP is added. Both callers used to do `state.xp += n` and neither could have known
   about the weekly total, which is how it came to be missing. */
function awardXp(n) {
  const amt = Number(n) || 0;
  if (!amt) return;
  weekXp();                                   // rolls the week over first, if it needs it
  state.xp += amt;
  state.weekXp = (state.weekXp || 0) + amt;
  saveState();
}

/* ---------- where Stars come from ----------
   Stars used to arrive in exactly one place: the end of a module, 120-160 at a time, 830 over the
   whole course. Measured against a Store where a character set costs 130, that is a shop a student
   visits six times in fifteen hours. So the currency now pays out for the work as it happens:

     lesson finished      30     every content lesson; the steady income
     checkpoint finished  60     instead of the lesson's 30 - it is the lesson about THEIR game
     practice passed      20     the "your turn": the one task that touches their own project
     lab solved           10     only when they solved it - reading the answer still finishes the
                                 lab, it just does not pay

   plus the module bonus, which stays. About 3,000 over the course from a 400 start, against a
   catalogue where the biggest 400-tile set is 1,000. Every number is here and nowhere else, so the
   economy can be tuned in one place and the toasts stay honest. */
const STARS = { lesson: 30, checkpoint: 60, practice: 20, lab: 10 };
function awardStars(n) {
  const amt = Number(n) || 0;
  if (!amt) return;
  state.stars = (state.stars || 0) + amt;
  saveState();
}

function markActivity(lessonId, key) {
  if (!lessonId || !key) return false;
  if (!state.activities) state.activities = {};
  if (!state.activities[lessonId]) state.activities[lessonId] = {};
  if (state.activities[lessonId][key]) return false;        // already recorded
  state.activities[lessonId][key] = true;
  saveState();
  return true;
}
/* saveState used to call renderFooter() directly, which meant this file — which knows about
   storage and XP arithmetic — also had to know that a footer exists. It announces instead; the
   footer subscribes. */
function saveState() { Storage.writeJSON(SKEY, state); emit(EV.PROGRESS_CHANGED, { xp: state.xp, stars: state.stars }); }
function renderFooter() {
  const lvl = Math.floor(state.xp / 1000) + 1; const into = state.xp % 1000;
  $('xpVal').textContent = state.xp; $('starVal').textContent = state.stars; $('lvlVal').textContent = lvl;
  const bv = $('badgeVal'); if (bv) bv.textContent = badgeCount();
  // scaleX rather than width: the bar is full-width and squashed, so growing it costs no reflow
  // in the status bar. See .progress > div in styles.css.
  $('xpBar').style.transform = 'scaleX(' + (into / 1000) + ')';
}

