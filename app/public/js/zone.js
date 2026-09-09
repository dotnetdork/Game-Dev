/* zone.js — building zones: the workspace a module's checkpoint opens.
 *
 * A checkpoint is not a lesson. Every other lesson in the course is something to read with things
 * to do embedded in it; a checkpoint is the opposite shape — a room the student builds their own
 * game in, with the course's voice reduced to a bot sitting beside them. So it does not render as
 * a lesson page with cards on it. It renders as a door, and behind the door is this.
 *
 * The overlay discipline is the lab bench's, deliberately, because the bench got it right:
 *   - ONE element in index.html, present from page load, `hidden`
 *   - every handler bound ONCE at load against that static markup
 *   - only the CONTENTS of the hosts are built and destroyed, per opening
 *   - the shell behind is covered and made `inert` rather than hidden, so the top bar still works
 *   - one state object is the single view-model, and its `.ui` handle being null is the guard
 *     every async callback checks before touching the screen
 *
 * What is different, and why:
 *
 *   The bot is open by default and speaks first. In the bench the tutor is a panel you go and find,
 *   which is right for "I am stuck on this one exercise". It is wrong here: the students this is
 *   written for mostly do not know what to make, and a silent room with an empty board is the exact
 *   blank page that produces either paralysis or a plan for an MMO. So the zone opens the
 *   conversation.
 *
 *   The artifact is a FILE. The board is a structured view of `design.md` in the student's own
 *   project, and that file stays the single truth — the board reads it on open and writes it on
 *   every edit. Nothing is stored twice. This matters more than it looks: notes kept in progress
 *   state are destroyed by "Reset my progress", a button that lives under a heading called Testing
 *   and promises only to clear XP and lessons, and the one-sheet is the only thing a student cannot
 *   get back by reading the starter.
 */

/* ---------- the one-sheet, as data ----------
   design.md is markdown a student can open in the Code tab and read, and it is also the board's
   backing store. Those two have to be the same file or they drift, so this parses and re-renders
   it rather than keeping a copy.

   Round-tripping rules, both learned from what the file actually looks like:

     A leading (parenthesised block) in a slot is a PROMPT, not an answer. The starter ships one
     under every heading to explain what goes there, and a student who has written nothing has an
     empty slot rather than a slot containing a sentence we wrote.

     Headings this zone does not declare are KEPT, in place. A later checkpoint adds `## My core
     loop`, and a student adds whatever they like — dropping those on write would delete their
     work to tidy a namespace. */
const SHEET_FILE = 'design.md';

function zoneSlotKey(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

/* Strip a balanced parenthesised block from the front. Balanced rather than greedy because the
   prompts contain parentheses of their own — "(0 = none)" inside one would end it early. */
function zoneSplitPrompt(body) {
  const t = String(body == null ? '' : body).replace(/^\n+/, '');
  if (t.charAt(0) !== '(') return { prompt: '', answer: t.trim() };
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.charAt(i) === '(') depth++;
    else if (t.charAt(i) === ')') {
      depth--;
      if (depth === 0) return { prompt: t.slice(0, i + 1), answer: t.slice(i + 1).trim() };
    }
  }
  return { prompt: t.trim(), answer: '' };            // unbalanced: treat the lot as the prompt
}

function parseSheet(md) {
  const lines = String(md == null ? '' : md).replace(/\r\n/g, '\n').split('\n');
  const sheet = { head: [], slots: [] };
  let cur = null;
  lines.forEach(function (ln) {
    const m = ln.match(/^##\s+(.+?)\s*$/);
    if (m) { cur = { heading: m[1], key: zoneSlotKey(m[1]), raw: [] }; sheet.slots.push(cur); return; }
    (cur ? cur.raw : sheet.head).push(ln);
  });
  sheet.slots.forEach(function (s) {
    const p = zoneSplitPrompt(s.raw.join('\n'));
    s.prompt = p.prompt; s.answer = p.answer;
  });
  return sheet;
}

/* Back to markdown. An answered slot loses its prompt, so the file reads as a design document
   rather than as a form — and an unanswered one keeps it, so the Code tab still explains itself. */
function renderSheet(sheet) {
  const out = [sheet.head.join('\n').replace(/\s+$/, '')];
  sheet.slots.forEach(function (s) {
    out.push('\n\n## ' + s.heading + '\n\n' + (s.answer ? s.answer : s.prompt).replace(/\s+$/, ''));
  });
  return out.join('').replace(/\s+$/, '') + '\n';
}

function sheetRead() {
  const md = (typeof project === 'object' && project && project.files) ? project.files[SHEET_FILE] : '';
  return parseSheet(typeof md === 'string' ? md : '');
}
function sheetWrite(sheet) {
  if (typeof project !== 'object' || !project || !project.files) return;
  project.files[SHEET_FILE] = renderSheet(sheet);
  if (project.order && project.order.indexOf(SHEET_FILE) < 0) project.order.unshift(SHEET_FILE);
  if (typeof saveProject === 'function') saveProject();
  /* The Code tab may be showing this very file behind the overlay. Repaint it rather than leaving
     a stale copy for the student to find and "fix" over the top of what they just wrote. */
  if (typeof currentFile !== 'undefined' && currentFile === SHEET_FILE
      && typeof loadCode === 'function' && $('view-code') && !$('view-code').hidden) loadCode();
}
/* Find a slot by heading, creating it if the file has never had one. Matched on the squashed key so
   "My game is" finds "## My game is..." — the starter's headings carry an ellipsis and an author
   writing a zone should not have to reproduce it. */
function sheetSlot(sheet, heading) {
  const k = zoneSlotKey(heading);
  let s = sheet.slots.filter(function (x) { return x.key === k; })[0];
  if (!s) { s = { heading: heading, key: k, raw: [], prompt: '', answer: '' }; sheet.slots.push(s); }
  return s;
}

/* ---------- the zone on screen ---------- */
let openZoneRef = null;         // the zone on screen, or null
let zoneReturnFocus = null;
let zoneRegistry = [];          // the zones in the lesson on screen, for the router
const ZONE_MIN_WIDTH = 700;     // same threshold as the lab bench; see tooSmallToBuild

/* Which shell parts go dead while the zone is up. The top bar is deliberately excluded, exactly as
   the bench excludes it: Store, Gallery, Docs and Help keep working, and showPage closes the zone
   before navigating anywhere. */
function zoneIsolate(on) {
  ['#editor', '#page', '.statusbar'].forEach(function (sel) {
    const el = document.querySelector(sel);
    if (el && 'inert' in el) el.inert = on;
  });
}

/* ---------- goals ----------
   A goal is a check against the student's real work, never a box they tick. Two kinds, because the
   two furnitures answer different questions:

     slot:   that heading on the board has an answer under it       (sheet zones)
     check:  a list of rules against their real project             (build zones)

   `check:` is the practice checker's own rule set — contains, config_changed, function_added,
   called_in_update, parses, all of it — so a build objective is checked by the same code that
   checks a your-turn step, and an author who can write one can already write the other. */
function zoneGoalDone(zone, goal) {
  if (Array.isArray(goal.check) && goal.check.length) {
    if (typeof practiceRuleResult !== 'function') return false;
    return goal.check.every(function (rule) {
      const r = practiceRuleResult(rule, zone.snap || null);
      return !!(r && r.ok);
    });
  }
  if (goal.slot === '*' || goal.slot === 'all') {
    return (zone.spec.slots || []).every(function (h) { return !!sheetSlot(zone.sheet, h).answer; });
  }
  if (goal.slot) return !!sheetSlot(zone.sheet, goal.slot).answer;
  return false;
}
/* Which objective is live. A build zone runs its objectives IN ORDER — one at a time, the next
   unlocking when the last is done. "Here are five things, go" is the shape that loses a
   thirteen-year-old, and a guide can only brief you on one thing at a time anyway. */
function zoneActiveIndex(zone) {
  const goals = zone.spec.goals || [];
  for (let i = 0; i < goals.length; i++) if (!zoneGoalDone(zone, goals[i])) return i;
  return -1;
}
function zoneProgress(zone) {
  const goals = zone.spec.goals || [];
  let n = 0;
  goals.forEach(function (g) { if (zoneGoalDone(zone, g)) n++; });
  return { done: n, total: goals.length };
}
function paintZoneGoals(zone) {
  const host = $('zoneGoals'); if (!host) return;
  const build = zone.spec.kind === 'build';
  const active = build ? zoneActiveIndex(zone) : -1;
  host.innerHTML = '';
  (zone.spec.goals || []).forEach(function (g, i) {
    const done = zoneGoalDone(zone, g);
    /* In a build zone the rail is a quest chain: done behind you, one live, the rest still ahead
       and deliberately dim. Seeing what is coming is part of the fun; being able to start any of
       them is not, because the order is the teaching. */
    const ahead = build && !done && i !== active;
    const el = document.createElement('span');
    el.className = 'zone-goal' + (done ? ' on' : '') + (i === active ? ' now' : '') + (ahead ? ' ahead' : '');
    el.setAttribute('role', 'listitem');
    el.innerHTML = '<span class="zone-tick" aria-hidden="true">' + (done ? '&#10003;' : (build ? (i + 1) : '')) + '</span>'
      + '<span>' + esc(g.say || g.slot || '') + '</span>'
      + '<span class="sr-only">' + (done ? ' — done' : (i === active ? ' — this one now' : ' — not done yet')) + '</span>';
    host.appendChild(el);
  });
  const p = zoneProgress(zone);
  const cnt = $('zoneCount'), bar = $('zoneProg'), btn = $('zoneDone');
  if (cnt) {
    cnt.className = 'zone-count' + (p.total && p.done >= p.total ? ' all' : '');
    cnt.innerHTML = p.total
      ? '<b>' + p.done + '</b> of <b>' + p.total + '</b> ' + (build ? 'objectives' : 'done')
      : '';
  }
  if (bar) bar.style.width = (p.total ? Math.round(100 * p.done / p.total) : 0) + '%';
  if (btn) {
    const ready = p.total > 0 && p.done >= p.total;
    btn.disabled = !ready || zone.solved;
    btn.textContent = zone.solved ? 'Finished'
      : ready ? 'Finish the checkpoint'
      : (build ? 'Objectives first' : 'Fill the boxes first');
  }
}

/* ---------- the board ----------
   A checkpoint is a surface you arrange things on, not a page you fill in — so it is a canvas with
   sticky notes on it, panned and dragged, and both kinds of checkpoint use the same one. What
   differs is what the REGIONS mean.

   The regions are not decoration. On an ideation board they are the data: dragging a sticky out of
   Building and into Not building is how a student cuts scope, and that is the whole lesson of the
   module made physical instead of described. A board where dragging changed nothing would be a
   picture of a workspace.

   What lives where, and why:

     slot text      design.md, as before. It is the one thing a student cannot get back, so it stays
                    in a file that survives Reset my progress.
     loose notes    also design.md, under `## Board notes`, one per line — same argument.
     positions      state.boards[lessonId]. Pure layout, cheap to lose, and no migration needed
                    because loadState merges DEFAULT_STATE first.

   Two kinds of sticky. A SLOT note is one heading of the one-sheet: always present, never
   deletable, its text is that slot's answer. A LOOSE note is anything else the student writes, and
   the region it is sitting in decides what it means. */

const ZONE_NOTE_W = 172;
const ZONE_NOTE_H = 104;
const ZONE_COLOURS = ['y', 'b', 'g', 'p', 'o'];

/* Where the notes are, how big, and whether they are pinned. Layout only — see the note above about
   what is stored where. Stored as an object rather than an [x, y] pair because size and pinning
   arrived later and a tuple that grows is a tuple somebody reads wrong. */
function boardState(lessonId) {
  if (!state.boards) state.boards = {};
  if (!state.boards[lessonId]) state.boards[lessonId] = { pos: {} };
  return state.boards[lessonId];
}
function noteGeo(zone, id) {
  const raw = (boardState(zone.lessonId).pos || {})[id];
  if (!raw) return null;
  if (Array.isArray(raw)) return { x: raw[0], y: raw[1] };     // boards saved before size and pins
  return raw;
}
function saveNoteGeo(zone, id, patch) {
  const b = boardState(zone.lessonId);
  if (!b.pos) b.pos = {};
  const was = noteGeo(zone, id) || {};
  b.pos[id] = Object.assign({}, was, patch);
  if (typeof saveState === 'function') saveState();
}
function notePinned(zone, id) { return !!(noteGeo(zone, id) || {}).pin; }

/* ---------- loose notes, in the file ----------
   `## Board notes` is a slot like any other, one note per line. Keeping them in design.md rather
   than in progress state costs a little parsing and buys the thing that matters: a student's own
   writing is never destroyed by a button labelled Testing. */
const BOARD_SLOT = 'Board notes';
/* Every line that is a list item, INCLUDING the empty ones. An empty sticky is a real thing on a
   board — it is what Crazy 8s deals out eight of, and dropping them on read meant that tool
   silently did nothing. Lines that are not list items are somebody's prose and are left alone. */
function looseNotes(sheet) {
  const raw = sheetSlot(sheet, BOARD_SLOT).answer || '';
  if (!raw.trim()) return [];
  return raw.split('\n')
    .filter(function (l) { return /^\s*[-*]/.test(l); })
    .map(function (l) { return l.replace(/^\s*[-*]\s?/, '').trim(); });
}
function saveLooseNotes(sheet, list) {
  sheetSlot(sheet, BOARD_SLOT).answer = list.map(function (s) { return '- ' + (s || ''); }).join('\n');
  sheetWrite(sheet);
}

/* ---------- regions ----------
   Declared per zone with a rectangle and a role:
     holds: slots            the fixed one-sheet stickies live in here
     collects: <heading>     every loose note dropped in here composes that slot
     objectives: done|now|ahead   build boards; the checks place these, not the student
     budget: <weeks>         a region that costs something — see the meter */
function zoneRegions(zone) { return zone.spec.board || []; }
/* Which region a note at (x, y) is in. Tested against the region's DRAWN rectangle, not its
   declared one — a region grows to fit what has been dropped in it, and a note sitting in the part
   it grew is visibly inside a box that would otherwise say it was loose. */
function regionAt(zone, x, y) {
  const cx = x + ZONE_NOTE_W / 2, cy = y + ZONE_NOTE_H / 2;
  const hit = zoneRegions(zone).filter(function (r) { return inRect(regionRect(zone, r), cx, cy); });
  return hit[hit.length - 1] || null;      // the last declared wins, so a nested region can exist
}

/* ---------- painting ---------- */
function paintZoneBoard(zone) {
  const canvas = $('zoneCanvas'); if (!canvas) return;
  canvas.innerHTML = '';
  zone.sheet = sheetRead();
  geomCache = null;                       // one geometry pass per paint; see plannedGeoms
  const build = zone.spec.kind === 'build';

  zoneRegions(zone).forEach(function (r) {
    const a = regionRect(zone, r);
    const el = document.createElement('div');
    el.className = 'zone-field' + (r.hot ? ' hot' : '');
    el.style.cssText = 'left:' + a[0] + 'px;top:' + a[1] + 'px;width:' + a[2] + 'px;height:' + a[3] + 'px';
    el.dataset.region = r.id || '';
    el.innerHTML = '<span class="zone-field-lab">' + esc(r.say || r.id || '') + '</span>';
    if (r.budget) el.appendChild(regionMeter(zone, r));
    canvas.appendChild(el);
  });

  if (build) paintObjectiveNotes(zone, canvas);
  else paintSlotNotes(zone, canvas);
  paintLooseNotes(zone, canvas);
  paintConnections(zone, canvas);
}

/* ---------- how big a region actually is ----------
   The declared rectangle is a MINIMUM. A region grows to hold whatever has been dragged into it, so
   a student who fills the cut list with eleven notes gets a taller box rather than notes hanging
   out of the bottom of a dashed line that has stopped meaning anything.

   Grows only — never shrinks below what the author drew, so the board does not shuffle about
   underneath somebody every time they move a note. */
const REGION_PAD = 20;
/* How far below a region's current bottom a note still counts as belonging to it. Must stay well
   under the vertical gap the boards leave between regions, or one would grow into the next. */
const REGION_GAP = 24;
function regionRect(zone, r) {
  const a = (r.at || [0, 0, 240, 200]).slice();
  const geoms = plannedGeoms(zone);
  let right = a[0] + a[2], bottom = a[1] + a[3];
  /* Run to a fixed point rather than once. A note that has overflowed the bottom is, by definition,
     outside the rectangle — so a single pass can never see the thing it is supposed to grow to fit,
     and the box stays the size it was while notes hang out of it. Each pass takes in one more row
     and the next pass can then see the row after that. Six is far past any real board; the cap is
     only there so a bug cannot spin. */
  for (let pass = 0; pass < 6; pass++) {
    const was = right + bottom;
    geoms.forEach(function (g) {
      const cx = g.x + g.w / 2;
      /* Horizontally by the note's centre, vertically by its TOP edge with a row's tolerance. A
         centre test would need the box to already be tall enough to contain the note it is growing
         for, which it never is — the padding is smaller than half a note. The tolerance is well
         under the gap the layouts leave between regions, so one cannot claim another's notes. */
      if (cx < a[0] || cx > right) return;
      if (g.y < a[1] || g.y > bottom + REGION_GAP) return;
      right = Math.max(right, g.x + g.w + REGION_PAD);
      bottom = Math.max(bottom, g.y + g.h + REGION_PAD);
    });
    if (right + bottom === was) break;
  }
  return [a[0], a[1], right - a[0], bottom - a[1]];
}
function inRect(a, x, y) { return x >= a[0] && x <= a[0] + a[2] && y >= a[1] && y <= a[1] + a[3]; }

/* Every note's box, worked out from the spec and saved state rather than read off the screen.
   It has to be computable BEFORE anything is painted, because the regions are drawn first and their
   size depends on what is sitting in them — asking the DOM here would measure the previous paint,
   which is a frame behind and empty on the first one. Cached per paint, because regionRect calls it
   once per region and this walks every note. */
let geomCache = null;
function plannedGeoms(zone) {
  if (geomCache) return geomCache;
  const out = [];
  const push = function (id, dx, dy) {
    const g = noteGeo(zone, id) || {};
    out.push({ id: id, x: g.x === undefined ? dx : g.x, y: g.y === undefined ? dy : g.y,
      w: g.w || ZONE_NOTE_W, h: g.h || ZONE_NOTE_H });
  };
  if (zone.spec.kind === 'build') {
    /* Objectives are placed by their check state, not by the student, so their boxes come from the
       same lane arithmetic paintObjectiveNotes uses. */
    objectivePlaces(zone).forEach(function (p) { out.push({ id: p.id, x: p.x, y: p.y, w: ZONE_NOTE_W, h: ZONE_NOTE_H }); });
  } else {
    const home = zoneRegions(zone).filter(function (r) { return r.holds === 'slots'; })[0];
    (zone.spec.slots || []).forEach(function (h, i) {
      const d = defaultSlotPos(home, i);
      push('slot:' + zoneSlotKey(h), d[0], d[1]);
    });
  }
  looseNotes(zone.sheet).forEach(function (t, i) {
    push('note:' + i, 60 + (i % 4) * 30, 470 + Math.floor(i / 4) * 24);
  });
  geomCache = out;
  return out;
}
/* Where each objective sticky goes: its lane, then in order down it. Shared by the painter and the
   geometry pass so the two cannot disagree about where an objective is. */
function objectivePlaces(zone) {
  const goals = zone.spec.goals || [];
  const active = zoneActiveIndex(zone);
  const lane = function (role) { return zoneRegions(zone).filter(function (r) { return r.objectives === role; })[0]; };
  const counts = { done: 0, now: 0, ahead: 0 };
  return goals.map(function (g, i) {
    const done = zoneGoalDone(zone, g);
    const role = done ? 'done' : (i === active ? 'now' : 'ahead');
    const a = (lane(role) || {}).at || [40, 40, 220, 400];
    const n = counts[role]++;
    return { id: 'obj:' + i, i: i, goal: g, role: role, done: done,
      x: a[0] + 20, y: a[1] + 34 + n * (ZONE_NOTE_H + 22) };
  });
}

/* The fixed stickies: one per declared slot, never deletable, text is that slot's answer. */
function paintSlotNotes(zone, canvas) {
  const home = zoneRegions(zone).filter(function (r) { return r.holds === 'slots'; })[0];
  (zone.spec.slots || []).forEach(function (h, i) {
    const slot = sheetSlot(zone.sheet, h);
    const id = 'slot:' + zoneSlotKey(h);
    const d = defaultSlotPos(home, i);
    const g = noteGeo(zone, id) || { x: d[0], y: d[1] };
    const note = makeNote(zone, {
      id: id, x: g.x, y: g.y, w: g.w, h: g.h, pinned: !!g.pin, star: !!g.star,
      colour: g.colour || ZONE_COLOURS[i % ZONE_COLOURS.length],
      label: h.replace(/\.+$/, ''),
      text: slot.answer,
      hint: (zone.spec.prompts || {})[zoneSlotKey(h)] || slot.prompt || '',
      onText: function (v) { slot.answer = v; sheetWrite(zone.sheet); }
    });
    canvas.appendChild(note);
  });
}
function defaultSlotPos(home, i) {
  const a = (home && home.at) || [40, 40, 420, 400];
  const perRow = Math.max(1, Math.floor(a[2] / (ZONE_NOTE_W + 22)));
  return [a[0] + 22 + (i % perRow) * (ZONE_NOTE_W + 22),
    a[1] + 34 + Math.floor(i / perRow) * (ZONE_NOTE_H + 26)];
}

/* Loose notes. Where one sits decides what it means: a note in a `collects:` region is part of
   that slot, and a note anywhere else is a thought the student has not filed yet. */
function paintLooseNotes(zone, canvas) {
  looseNotes(zone.sheet).forEach(function (text, i) {
    const id = 'note:' + i;
    const g = noteGeo(zone, id) || { x: 60 + (i % 4) * 30, y: 470 + Math.floor(i / 4) * 24 };
    canvas.appendChild(makeNote(zone, {
      id: id, x: g.x, y: g.y, w: g.w, h: g.h, pinned: !!g.pin, star: !!g.star,
      colour: g.colour || 'o', loose: true, index: i,
      label: regionLabelFor(zone, g.x, g.y), text: text, hint: 'A loose thought.',
      onText: function (v) {
        const list = looseNotes(zone.sheet);
        if (v) list[i] = v; else list.splice(i, 1);
        saveLooseNotes(zone.sheet, list);
        paintZoneBoard(zone); paintZoneGoals(zone);
      },
      /* Deleting is only offered on notes the student made. A slot note is one heading of their
         one-sheet: it can be emptied, moved and pinned, but it cannot be got rid of, because the
         question it is asking does not go away just because they have not answered it. */
      onDelete: function () {
        const list = looseNotes(zone.sheet);
        list.splice(i, 1);
        saveLooseNotes(zone.sheet, list);
        /* Positions are keyed by index, so removing one shuffles every note after it onto the
           previous note's spot. Shift them down to match rather than leaving the board scrambled. */
        const b = boardState(zone.lessonId);
        const moved = {};
        Object.keys(b.pos || {}).forEach(function (k) {
          const m = k.match(/^note:(\d+)$/);
          if (!m) { moved[k] = b.pos[k]; return; }
          const n = Number(m[1]);
          if (n < i) moved[k] = b.pos[k];
          else if (n > i) moved['note:' + (n - 1)] = b.pos[k];
        });
        b.pos = moved;
        if (typeof saveState === 'function') saveState();
        paintZoneBoard(zone); paintZoneGoals(zone);
      }
    }));
  });
}
function regionLabelFor(zone, x, y) {
  const r = regionAt(zone, x, y);
  return r ? (r.say || r.id) : 'Loose';
}

/* Build boards: the objectives are stickies, and the CHECKS place them. A student cannot drag one
   into Done, which is the point — the board reports on their real project rather than accepting
   their word for it. */
function paintObjectiveNotes(zone, canvas) {
  objectivePlaces(zone).forEach(function (p) {
    canvas.appendChild(makeNote(zone, {
      id: p.id, x: p.x, y: p.y,
      colour: p.done ? 'g' : (p.role === 'now' ? 'o' : 'ghost'),
      label: 'Objective ' + (p.i + 1) + (p.role === 'now' ? ' — now' : ''),
      text: p.goal.say || '', hint: '', fixed: true, done: p.done,
      note: p.role === 'now' ? (p.goal.where || '') : ''
    }));
  });
}

/* One sticky. Editing happens in place — the point of a board is seeing the rest of it while you
   write, and a dialog over a board hides the thing that told you what to write. */
function makeNote(zone, o) {
  const el = document.createElement('div');
  el.className = 'zone-note ' + (o.colour || 'y') + (o.text ? '' : ' blank')
    + (o.done ? ' done' : '') + (o.fixed ? ' fixed' : '') + (o.pinned ? ' pinned' : '')
    + (o.star ? ' star' : '');
  el.style.left = o.x + 'px'; el.style.top = o.y + 'px';
  if (o.w) el.style.width = o.w + 'px';
  if (o.h) el.style.height = o.h + 'px';
  el.dataset.id = o.id;
  el.tabIndex = o.fixed ? -1 : 0;
  const body = o.text || o.hint || '';
  el.innerHTML = (o.done ? '<span class="zone-note-tick" aria-hidden="true">&#10003;</span>' : '')
    + '<div class="zone-note-lab">' + esc(o.label || '') + '</div>'
    + '<div class="zone-note-txt">' + esc(body) + '</div>'
    + (o.note ? '<div class="zone-note-sub">' + esc(o.note) + '</div>' : '');
  if (o.fixed) { el.setAttribute('aria-label', (o.label || '') + ': ' + (o.text || '')); return el; }

  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', (o.label || '') + (o.text ? ': ' + o.text : ' — empty')
    + (o.pinned ? ' — pinned' : '') + '. Click to write, drag to move.');

  /* The controls sit on the note and appear on hover or focus. On it rather than in a toolbar
     somewhere, because which note you are acting on has to be unambiguous on a board where there
     are fifteen of them. Keyboard users get them via focus, so they are not mouse-only. */
  const bar = document.createElement('div');
  bar.className = 'zone-note-bar';
  const btn = function (icon, title, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'zone-note-btn'; b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    bar.appendChild(b);
    return b;
  };
  /* Dot voting, one note at a time. The canonical way a group picks between ideas, and it is just
     as useful alone: a student with nine notes and no way to say "that one" ends up keeping all
     nine. Starred notes stay bright while the rest fade back. */
  btn(o.star ? 'mdi-star' : 'mdi-star-outline', o.star ? 'Not my favourite after all' : 'This is the one',
    function () { saveNoteGeo(zone, o.id, { star: !o.star, x: o.x, y: o.y }); paintZoneBoard(zone); });
  btn('mdi-palette', 'Change its colour', function () {
    const i = ZONE_COLOURS.indexOf(o.colour);
    saveNoteGeo(zone, o.id, { colour: ZONE_COLOURS[(i + 1) % ZONE_COLOURS.length], x: o.x, y: o.y });
    paintZoneBoard(zone);
  });
  if (o.loose) {
    btn('mdi-content-copy', 'Make another like this', function () {
      addLooseNote(zone, o.text || '', [o.x + 18, o.y + 18]);
    });
  }
  /* Pinning saves WHERE IT IS, not just that it is pinned. A note that has never been dragged has
     no saved position, so without writing x and y here it would jump back to its default spot at
     the very moment the student said "stay there" — which is the opposite of what pinning means. */
  btn(o.pinned ? 'mdi-pin' : 'mdi-pin-outline', o.pinned ? 'Unpin — let it move again' : 'Pin it where it is',
    function () {
      saveNoteGeo(zone, o.id, { pin: !o.pinned, x: o.x, y: o.y });
      paintZoneBoard(zone);
    });
  // No confirm. It is a sticky note on their own board, and the friction is worse than the mistake.
  if (o.onDelete) btn('mdi-close', 'Delete this note', o.onDelete);
  el.appendChild(bar);

  /* Resize from the corner. Only the corner, and only bigger than a stub: a note you can shrink to
     nothing is a note you can lose on a board this size. */
  const grip = document.createElement('div');
  grip.className = 'zone-note-grip';
  grip.setAttribute('aria-hidden', 'true');
  resizeNote(zone, el, o, grip);
  el.appendChild(grip);

  if (!o.pinned) dragNote(zone, el, o);
  const edit = function () { editNote(zone, el, o); };
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
  });
  if (o.pinned) el.addEventListener('click', function (e) { if (!e.target.closest('.zone-note-btn')) edit(); });
  el.__edit = edit;
  return el;
}

function resizeNote(zone, el, o, grip) {
  grip.addEventListener('pointerdown', function (e) {
    e.stopPropagation(); e.preventDefault();
    const r = el.getBoundingClientRect();
    const w0 = r.width / zoneScale, h0 = r.height / zoneScale;
    const sx = e.clientX, sy = e.clientY;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('sizing');
    const move = function (ev) {
      const w = Math.max(120, w0 + (ev.clientX - sx) / zoneScale);
      const h = Math.max(80, h0 + (ev.clientY - sy) / zoneScale);
      el.style.width = w + 'px'; el.style.height = h + 'px';
    };
    const up = function () {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up);
      el.classList.remove('sizing');
      saveNoteGeo(zone, o.id, { w: Math.round(parseFloat(el.style.width)), h: Math.round(parseFloat(el.style.height)) });
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
}

/* Drag. A click that never moved opens the note for editing instead — a sticky you cannot type into
   by clicking would be a very strange sticky. */
function dragNote(zone, el, o) {
  el.addEventListener('pointerdown', function (e) {
    if (el.classList.contains('editing')) return;
    if (zoneLinking) { e.stopPropagation(); linkClick(zone, o.id); return; }
    e.stopPropagation();
    const canvas = $('zoneCanvas');
    const startX = e.clientX, startY = e.clientY;
    const ox = parseFloat(el.style.left) || 0, oy = parseFloat(el.style.top) || 0;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = function (ev) {
      const dx = (ev.clientX - startX) / zoneScale, dy = (ev.clientY - startY) / zoneScale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; zone.arranging = true; el.classList.add('dragging'); canvas.classList.add('arranging'); }
      el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px';
      highlightDrop(zone, ox + dx, oy + dy);
    };
    const up = function () {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      el.classList.remove('dragging'); canvas.classList.remove('arranging'); zone.arranging = false;
      clearDrop();
      if (!moved) { el.__edit(); return; }
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      saveNoteGeo(zone, o.id, { x: Math.round(x), y: Math.round(y) });
      dropNote(zone, o, x, y);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
}
function highlightDrop(zone, x, y) {
  const r = regionAt(zone, x, y);
  $('zoneCanvas').querySelectorAll('.zone-field').forEach(function (f) {
    f.classList.toggle('over', !!r && f.dataset.region === (r.id || ''));
  });
}
function clearDrop() {
  $('zoneCanvas').querySelectorAll('.zone-field').forEach(function (f) { f.classList.remove('over'); });
}

/* Where a note lands is what it MEANS. This is the function that makes the board data rather than
   layout: drop a loose note into a `collects:` region and it becomes part of that slot; drag it out
   and it stops being. Cutting scope is a gesture here, which is the whole reason for a canvas. */
function dropNote(zone, o, x, y) {
  const r = regionAt(zone, x, y);
  if (!o.loose) { paintZoneGoals(zone); return; }   // a slot note keeps its meaning wherever it sits
  const collecting = zoneRegions(zone).filter(function (g) { return g.collects; });
  if (!collecting.length) return;

  const text = looseNotes(zone.sheet)[o.index];
  if (!text) return;
  /* Rebuild every collecting slot from what is now sitting in it. Rebuilding rather than patching,
     because a note can leave one region and enter another in a single drag and the two halves of
     that must not be able to disagree. */
  const list = looseNotes(zone.sheet);
  collecting.forEach(function (g) {
    const inside = [];
    list.forEach(function (t, i) {
      const p = (i === o.index) ? [x, y] : (notePos(zone, 'note:' + i) || [0, 0]);
      const at = regionAt(zone, p[0], p[1]);
      if (at && at.id === g.id) inside.push(t);
    });
    sheetSlot(zone.sheet, g.collects).answer = inside.join(', ') + (inside.length ? '.' : '');
  });
  sheetWrite(zone.sheet);
  paintZoneBoard(zone);
  paintZoneGoals(zone);
  if (r && r.budget) paintZoneBoard(zone);
}

/* Type into a sticky, in place. */
let zoneEditing = null;
function commitZoneEdit() { if (zoneEditing) zoneEditing(true); }
function editNote(zone, el, o) {
  if (el.classList.contains('editing')) return;
  commitZoneEdit();
  el.classList.add('editing');
  const txt = el.querySelector('.zone-note-txt');
  const box = document.createElement('textarea');
  box.className = 'zone-note-edit';
  box.value = o.text || '';
  box.placeholder = o.hint || 'Write it here.';
  txt.replaceWith(box);
  box.focus(); box.select();

  let closed = false;
  const finish = function (save) {
    if (closed) return; closed = true;
    if (zoneEditing === finish) zoneEditing = null;
    if (save && box.value.trim() !== (o.text || '')) {
      zone.touched = true;
      o.onText(box.value.trim());
    }
    paintZoneBoard(zone); paintZoneGoals(zone);
  };
  zoneEditing = finish;
  box.addEventListener('blur', function () { finish(true); });
  box.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(true); }
  });
}

/* A region that costs something. The scope lesson, as a meter you cannot argue with: the weeks are
   fixed, the sizes are fixed, and the only thing that can move is which notes are sitting in here. */
function regionMeter(zone, r) {
  const weeks = Number(r.budget) || 10;
  const list = looseNotes(zone.sheet);
  let n = 0;
  list.forEach(function (t, i) {
    const p = notePos(zone, 'note:' + i); if (!p) return;
    const at = regionAt(zone, p[0], p[1]);
    if (at && at.id === r.id) n++;
  });
  const spent = n * 2;                       // a note is about a fortnight; see the lesson
  const over = spent > weeks;
  const el = document.createElement('div');
  el.className = 'zone-field-meter' + (over ? ' over' : '');
  el.innerHTML = '<span class="zone-field-bar"><i style="width:' + Math.min(100, Math.round(100 * spent / weeks)) + '%"></i></span>'
    + '<span>' + spent + ' of ' + weeks + ' weeks' + (over ? ' — ' + (spent - weeks) + ' over' : '') + '</span>';
  return el;
}

/* ---------- connections ----------
   An arrow from one note to another: "this leads to that", "this is a version of that". Ideas do
   not come in a list, and a board that can only stack notes is a list with extra steps.
   Stored as pairs of note ids in board state, drawn as one SVG layer under the notes. */
function boardLinks(zone) {
  const b = boardState(zone.lessonId);
  if (!Array.isArray(b.links)) b.links = [];
  return b.links;
}
function paintConnections(zone, canvas) {
  const links = boardLinks(zone);
  if (!links.length) return;
  const by = {};
  plannedGeoms(zone).forEach(function (g) { by[g.id] = g; });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'zone-links');
  let maxX = 0, maxY = 0;
  const keep = [];
  links.forEach(function (l) {
    const a = by[l[0]], b2 = by[l[1]];
    if (!a || !b2) return;                       // an end has been deleted; drop the line with it
    keep.push(l);
    const x1 = a.x + a.w / 2, y1 = a.y + a.h / 2, x2 = b2.x + b2.w / 2, y2 = b2.y + b2.h / 2;
    maxX = Math.max(maxX, x1, x2); maxY = Math.max(maxY, y1, y2);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('class', 'zone-link');
    line.addEventListener('click', function () {
      const at = boardLinks(zone).findIndex(function (k) { return k[0] === l[0] && k[1] === l[1]; });
      if (at >= 0) { boardLinks(zone).splice(at, 1); if (typeof saveState === 'function') saveState(); paintZoneBoard(zone); }
    });
    svg.appendChild(line);
  });
  if (keep.length !== links.length) { boardState(zone.lessonId).links = keep; if (typeof saveState === 'function') saveState(); }
  svg.setAttribute('width', maxX + 80); svg.setAttribute('height', maxY + 80);
  canvas.appendChild(svg);
}
/* Linking is a mode, because it needs two clicks and a board where every click might start a line
   would be a board you cannot use. Escape or a second press of the tool leaves it. */
let zoneLinking = null;
function startLinking(zone) {
  zoneLinking = zoneLinking ? null : { from: null };
  $('zoneCanvasWrap').classList.toggle('linking', !!zoneLinking);
  paintZonePalette(zone);
  if (zoneLinking) zoneSay('bot', 'Linking. Click one note, then another, to draw a line between them. Click a line to remove it.');
}
function linkClick(zone, id) {
  if (!zoneLinking) return false;
  if (!zoneLinking.from) { zoneLinking.from = id; $('zoneCanvas').querySelector('[data-id="' + id + '"]').classList.add('linkfrom'); return true; }
  if (zoneLinking.from !== id) {
    boardLinks(zone).push([zoneLinking.from, id]);
    if (typeof saveState === 'function') saveState();
  }
  zoneLinking = null;
  $('zoneCanvasWrap').classList.remove('linking');
  paintZoneBoard(zone); paintZonePalette(zone);
  return true;
}

/* ---------- pan and zoom ---------- */
let zoneScale = 1, zonePanX = 0, zonePanY = 0;
function applyZoneView() {
  const c = $('zoneCanvas'); if (!c) return;
  c.style.transform = 'translate(' + zonePanX + 'px,' + zonePanY + 'px) scale(' + zoneScale + ')';
  const at = $('zoneZoomAt'); if (at) at.textContent = Math.round(zoneScale * 100) + '%';
}
function zoneZoom(by, at) {
  const was = zoneScale;
  zoneScale = Math.max(0.4, Math.min(1.6, +(zoneScale + by).toFixed(2)));
  /* Zoom towards the pointer rather than the origin, so the thing under the cursor stays under the
     cursor. Without this, zooming in on a note in the corner sends it off the screen — which reads
     as the board running away from you. */
  if (at && was) {
    zonePanX = at.x - (at.x - zonePanX) * (zoneScale / was);
    zonePanY = at.y - (at.y - zonePanY) * (zoneScale / was);
  }
  applyZoneView();
}
function boardSize(zone) {
  let w = 820, h = 520;
  zoneRegions(zone).forEach(function (r) {
    const a = r.at || [0, 0, 0, 0];
    w = Math.max(w, a[0] + a[2] + 40); h = Math.max(h, a[1] + a[3] + 40);
  });
  return [w, h];
}
/* Shrink the whole board onto the screen. Offered as a button rather than used as the default: a
   board that opens at 55% is a board whose handwriting you cannot read, and arriving zoomed out is
   the wrong first impression of a place you are meant to write in. */
function zoneFit(zone) {
  const wrap = $('zoneCanvasWrap'); if (!wrap) return;
  const s = boardSize(zone), b = wrap.getBoundingClientRect();
  zoneScale = Math.max(0.4, Math.min(1, Math.min((b.width - 24) / s[0], (b.height - 24) / s[1])));
  zonePanX = Math.max(12, (b.width - s[0] * zoneScale) / 2);
  zonePanY = 12;
  applyZoneView();
}
/* How a board opens: full size, centred. Full size because these are things with handwriting on
   them and 100% is the size they were written at; centred because a board that opens against one
   edge looks like it has already been dragged somewhere.
   Centred on the WORKING width — the conversation is laid over the right-hand side, so centring on
   the whole pane would put the middle of the board underneath it. */
const ZONE_CHAT_W = 360;
function zoneHome(zone) {
  const wrap = $('zoneCanvasWrap'); if (!wrap) return;
  zoneScale = 1;
  const b = wrap.getBoundingClientRect(), s = boardSize(zone);
  const usable = Math.max(320, b.width - Math.min(ZONE_CHAT_W, b.width * 0.38));
  zonePanX = Math.round(Math.max(12, (usable - s[0]) / 2));
  zonePanY = Math.round(Math.max(12, (b.height - s[1]) / 2));
  applyZoneView();
}

/* ---------- the palette ----------
   The tools, as things that put notes ON the board rather than panels beside it. A student presses
   the dice and three ideas land on the canvas to be dragged or thrown away, which is what a
   whiteboard is for. */
function paintZonePalette(zone) {
  const host = $('zonePalette'); if (!host) return;
  host.innerHTML = '';
  const add = function (icon, title, fn, on) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'zone-tool' + (on ? ' on' : ''); b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  };
  const gap = function () { const s = document.createElement('span'); s.className = 'zone-tool-gap'; host.appendChild(s); };

  add('mdi-plus', 'Add a note', function () { addLooseNote(zone, ''); });
  add('mdi-vector-line', zoneLinking ? 'Stop linking' : 'Link two notes', function () { startLinking(zone); }, !!zoneLinking);
  gap();
  /* The thinking tools. Every one of these is a technique that exists because a blank page beats
     most people, and each of them puts something ON the board rather than telling them about it. */
  (zone.spec.tools || []).forEach(function (t) {
    const tool = ZONE_PALETTE[t.kind];
    if (!tool) { console.warn('[league] zone tool "' + t.kind + '" does not exist — see ZONE_PALETTE in js/zone.js'); return; }
    add(tool.icon, t.title || tool.title, function () { tool.run(zone, t); });
  });
  gap();
  add('mdi-broom', 'Tidy the loose notes into a grid', function () { tidyBoard(zone); });
  add('mdi-fit-to-screen', 'Fit the whole board on screen', function () { zoneFit(zone); });
}

/* The scratch region — the one with no job. Every tool that deals notes out puts them here rather
   than wherever the board happens to be scrolled to: dropping eight blank stickies on top of the
   one-sheet buries the thing the student is supposed to be filling in, and they arrive already
   filed into a region they have nothing to do with. */
function freeRegion(zone) {
  const rs = zoneRegions(zone);
  return rs.filter(function (r) { return !r.holds && !r.collects && !r.objectives; })[0] || rs[rs.length - 1];
}
/* Lay the loose notes out in rows, leaving pinned ones and anything already inside a region alone.
   A tidy button that moved everything would undo the arranging, which is the work. */
function tidyBoard(zone) {
  const home = freeRegion(zone);
  const a = (home && home.at) || [40, 460, 900, 200];
  const perRow = Math.max(1, Math.floor(a[2] / (ZONE_NOTE_W + 18)));
  let n = 0;
  looseNotes(zone.sheet).forEach(function (t, i) {
    const id = 'note:' + i;
    const g = noteGeo(zone, id) || {};
    if (g.pin) return;                                   // pinned means pinned
    if (g.x !== undefined && regionAt(zone, g.x, g.y)) return;   // already filed somewhere
    saveNoteGeo(zone, id, {
      x: a[0] + 18 + (n % perRow) * (ZONE_NOTE_W + 18),
      y: a[1] + 34 + Math.floor(n / perRow) * (ZONE_NOTE_H + 18)
    });
    n++;
  });
  paintZoneBoard(zone);
}

function addLooseNote(zone, text, at, quiet) {
  const list = looseNotes(zone.sheet);
  const i = list.length;
  list.push(text || '');                   // empty, not "New note" — a blank sticky is an invitation
  saveLooseNotes(zone.sheet, list);
  const wrap = $('zoneCanvasWrap').getBoundingClientRect();
  const p = at || [(-zonePanX + wrap.width / 2) / zoneScale - ZONE_NOTE_W / 2,
    (-zonePanY + wrap.height / 2) / zoneScale - ZONE_NOTE_H / 2];
  saveNoteGeo(zone, 'note:' + i, { x: Math.round(p[0]), y: Math.round(p[1]) });
  /* `quiet` is for the tools that drop several at once: painting and focusing per note would fight
     itself eight times over, so the caller paints once at the end. */
  if (quiet) return i;
  paintZoneBoard(zone); paintZoneGoals(zone);
  const el = $('zoneCanvas').querySelector('[data-id="note:' + i + '"]');
  if (el && el.__edit) el.__edit();
  return i;
}

/* The board's own tools, over and above the fixed add/link/tidy/fit in the rail.
   The bar for being in here is high, and two entries have already failed it. A "Crazy 8s" button
   dealt eight blank stickies and started a clock; a "look at it another way" button opened seven
   SCAMPER lenses. Both are real techniques and both were dead weight on this board, for the same
   reason: the assistant is running the interview now, so a student with a half-empty board is
   already being asked a question, and a second thing asking them a different question is only in
   the way. A tool earns its place by doing something to what is ALREADY on the board. */
const ZONE_PALETTE = {
  /* The test the one-sheet lesson names, made pressable: stop reading it as the person who wrote it. */
  readback: {
    icon: 'mdi-text-box-outline', title: 'Read it back as a stranger would',
    run: function (zone) {
      const said = (zone.spec.slots || []).map(function (h) { return sheetSlot(zone.sheet, h).answer; }).filter(Boolean);
      if (!said.length) { zoneSay('bot', 'Nothing on the board yet — write a note and press it again.'); return; }
      const para = said.map(function (s) { return s.replace(/\s+$/, '').replace(/\.?$/, '.'); }).join(' ');
      const miss = (zone.spec.slots || []).filter(function (h) { return !sheetSlot(zone.sheet, h).answer; });
      zoneSay('bot', '**Your game, as a stranger reads it:**\n\n' + para
        + (miss.length ? '\n\nThey would still have to ask about: ' + miss.map(function (h) { return '“' + h.replace(/\.+$/, '') + '”'; }).join(', ') + '.'
          : '\n\nRead it out loud. The sentence you stumble on is the one to fix.'));
    }
  }
};

/* ---------- build boards and the Code tab ----------
   A build checkpoint does NOT contain an editor. The student writes code where they always have,
   and this board is what watches — so the only thing it needs is a way out and back. Closing the
   zone lands them on the door, one press from here. */
function zoneToCode() {
  const zone = openZoneRef; if (!zone) return;
  closeZone();
  if (typeof switchView === 'function') switchView('code');
}

/* ---------- opening and closing ---------- */
function openZone(zone) {
  const view = $('zoneView'); if (!view) return;
  if (window.innerWidth && window.innerWidth < ZONE_MIN_WIDTH) {
    if (typeof modal === 'function') {
      modal({ title: 'Open this on a computer',
        message: 'A building zone puts your notes and a helper side by side, and that needs a wider screen than this one.',
        okLabel: 'OK', hideCancel: true });
    }
    return;
  }
  if (openZoneRef) closeZone();
  openZoneRef = zone;
  zone.sheet = sheetRead();                     // the file is the truth; read it every opening
  zone.ui = { open: true };
  zoneReturnFocus = (zone.card && zone.card.open) || null;

  $('zoneTitle').textContent = zone.spec.title || 'Building zone';
  const flag = view.querySelector('.zone-flag');
  if (flag && typeof moduleAccent === 'function' && typeof flat !== 'undefined' && flat[curIdx]) {
    flag.style.color = moduleAccent(flat[curIdx].mi);
  }
  /* A build board's objectives are checked against the project as it was when the student ARRIVED —
     config_changed and function_added both need a "before", and taking it on open rather than on
     first check means somebody who tuned a number before reading anything still gets credit for it.
     practiceSnapshot stores it, so it survives closing the zone. */
  if (zone.spec.kind === 'build' && typeof practiceSnapshot === 'function'
      && typeof lessonWidgetId !== 'undefined') {
    zone.snap = practiceSnapshot(lessonWidgetId, zone.key);
  }
  const toCode = $('zoneToCode');
  if (toCode) toCode.hidden = zone.spec.kind !== 'build';
  paintZonePalette(zone);
  paintZoneBoard(zone);
  zoneHome(zone);
  paintZoneGoals(zone);
  zoneBotReset(zone);

  view.hidden = false;
  zoneIsolate(true);
  if (typeof syncRoute === 'function') syncRoute();
  if (typeof paintAIBtn === 'function') paintAIBtn();
  zoneBotOpen(zone);                            // the bot speaks first — see the header
}

function closeZone() {
  const zone = openZoneRef; if (!zone) return;
  commitZoneEdit();                       // a half-typed sentence on screen is still their work
  zoneLinking = null;
  $('zoneCanvasWrap').classList.remove('linking');
  openZoneRef = null;
  zone.ui = null;
  $('zoneLane').innerHTML = '';
  $('zoneCanvas').innerHTML = '';
  $('zonePalette').innerHTML = '';
  $('zoneGoals').innerHTML = '';
  $('zoneView').hidden = true;
  zoneIsolate(false);
  if (typeof syncRoute === 'function') syncRoute();
  if (typeof paintAIBtn === 'function') paintAIBtn();
  paintZoneCover(zone);
  if (zoneReturnFocus) { try { zoneReturnFocus.focus(); } catch (e) {} }
  zoneReturnFocus = null;
  if (typeof labPendingAdvance !== 'undefined' && labPendingAdvance) {
    const f = labPendingAdvance; labPendingAdvance = null;
    if (typeof startAdvance === 'function') startAdvance(f);
  }
}

/* ---------- finishing ----------
   Two gates, in order, and they are different questions. The goals are mechanical and cannot be
   argued with: that box has words in it. The sign-off is a judgement, because a box with "idk" in
   it passes every mechanical check ever written.
   The sign-off resolves in the student's FAVOUR when it cannot tell — an unreachable server or a
   reply the server refuses to vouch for must never be the reason a child is told they are not
   finished. See gradePractice, which made the same call. */
function finishZone() {
  const zone = openZoneRef; if (!zone || zone.solved) return;
  commitZoneEdit();                       // pressing Finish with a card open counts what is in it
  const p = zoneProgress(zone);
  if (!p.total || p.done < p.total) return;
  const btn = $('zoneDone');
  if (btn) { btn.disabled = true; btn.textContent = 'Reading it…'; }
  zoneSignOff(zone).then(function (verdict) {
    if (openZoneRef !== zone) return;
    if (verdict && verdict.pass === false) {
      if (btn) { btn.disabled = false; btn.textContent = 'Finish the zone'; }
      zoneSay('bot', verdict.hint || 'Not quite yet — have another look at what you have written.');
      return;
    }
    zone.solved = true;
    paintZoneGoals(zone);
    /* The badge before the activity. resolveActivity can complete the lesson, which fires
       LESSON_DONE and its toast — and a badge announced after that reads as belonging to the next
       thing rather than to the work they just did. */
    if (zone.spec.reward && typeof awardBadge === 'function'
        && awardBadge(zone.spec.reward, typeof lessonWidgetId !== 'undefined' ? lessonWidgetId : '')) {
      if (typeof toast === 'function') toast('Zone finished — ' + zone.spec.reward + ' earned!');
    } else if (typeof toast === 'function') toast('Zone finished!');
    if (typeof resolveActivity === 'function') resolveActivity(zone.key);
    paintZoneCover(zone);
  });
}

/* ---------- the cover ----------
   The door. Not a lesson page with a box on it and not a summary of one: the only things on it are
   what this zone wants and the way in.

   It reads design.md every time it paints, so the checklist is LIVE. That is the whole point of it
   being a door rather than a poster — a student coming back to a half-finished zone can see from
   the outside what is left, and one arriving at Your One-Sheet can see that two boxes are already
   answered from the checkpoint before it. */
function paintZoneCover(zone) {
  const k = zone.card; if (!k) return;
  const sheet = sheetRead();
  const goals = zone.spec.goals || [];
  const state = goals.map(function (g) {
    return { say: g.say || g.slot || '', done: zoneGoalDone({ spec: zone.spec, sheet: sheet }, g) };
  });
  const done = state.filter(function (g) { return g.done; }).length;

  k.list.innerHTML = '';
  state.forEach(function (g) {
    const li = document.createElement('li');
    /* No marker at all until it is done, and then a tick. Two goes at a small circle — a ring with
       a tick in it, then a 6px dot — both read as two different sizes sitting side by side, because
       at that scale antialiasing decides how big a circle looks and the two pills are never the
       same width. A mark that is only ever present in one state cannot be inconsistent with
       anything, and the colour is already carrying the meaning. */
    li.className = 'zone-cover-goal' + (g.done ? ' on' : '');
    li.setAttribute('aria-label', g.say + (g.done ? ' — done' : ' — not done yet'));
    li.innerHTML = (g.done ? '<span class="zone-cover-tick" aria-hidden="true">&#10003;</span>' : '')
      + '<span>' + esc(g.say) + '</span>';
    k.list.appendChild(li);
  });

  k.open.innerHTML = '<span class="mdi ' + (zone.solved ? 'mdi-flag-checkered' : 'mdi-arrow-right')
    + '" aria-hidden="true"></span>'
    + (zone.solved ? 'Open Checkpoint again' : (done ? 'Carry on' : 'Open Checkpoint'));
  k.open.classList.toggle('again', !!zone.solved);

  /* The count is only worth saying while it is neither nothing nor everything. "0 of 5" beside an
     empty checklist is the checklist said twice, and "5 of 5" is what the tick is for. */
  k.note.textContent = zone.solved ? '✓ Finished'
    : (done && done < goals.length ? done + ' of ' + goals.length + ' already done' : '');
  k.note.className = 'zone-cover-note' + (zone.solved ? ' done' : '');
}

/* Build the door from the lesson's ```zone block.
   It does NOT open the zone by itself. Auto-opening was tried and taken back out: a full-window
   workspace that appears the instant you touch a row in the sidebar gives a student no moment to
   see where they have arrived, and it fights the back button — closing it lands you on the page
   that opened it, which then wants to open it again. The door costs one press and answers "what is
   this and what does it want" before it takes the whole window. A /zone URL still goes straight in;
   that one was asked for explicitly. */
function mountZones(root) {
  zoneRegistry = [];
  if (!root) return;
  root.querySelectorAll('pre > code.language-zone').forEach(function (code) {
    const pre = code.parentNode;
    const key = (typeof nextWidgetKey === 'function') ? nextWidgetKey('z') : 'z0';
    const spec = zoneSpec(code.textContent);
    const zone = {
      spec: spec, key: key, sheet: null, ui: null, card: null, touched: false,
      solved: (typeof activityDone === 'function' && typeof lessonWidgetId !== 'undefined')
        ? activityDone(lessonWidgetId, key) : false,
      chat: [], greeted: false
    };
    zoneRegistry.push(zone);

    /* Deliberately not blockHeader. That builds the header a quiz, lab or practice step wears, and
       the whole point here is that this is not one of those — it is the way into a room. */
    const cell = document.createElement('div'); cell.className = 'zone-cover';
    cell.innerHTML =
      '<div class="zone-cover-kind"><span class="mdi mdi-flag-checkered" aria-hidden="true"></span>Building zone</div>'
      + '<p class="zone-cover-intro"></p>'
      + '<ul class="zone-cover-goals" role="list"></ul>'
      + '<div class="zone-cover-go"></div>';
    const intro = cell.querySelector('.zone-cover-intro');
    if (spec.intro) intro.innerHTML = (typeof inlineMd === 'function') ? inlineMd(spec.intro) : esc(spec.intro);
    else intro.remove();

    const go = cell.querySelector('.zone-cover-go');
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'zone-cover-btn';
    const note = document.createElement('span'); note.className = 'zone-cover-note';
    go.appendChild(open); go.appendChild(note);

    zone.card = { open: open, note: note, list: cell.querySelector('.zone-cover-goals') };
    paintZoneCover(zone);
    open.addEventListener('click', function () { openZone(zone); });
    pre.parentNode.replaceChild(cell, pre);
  });
}

/* The zone's declaration, out of the fenced block. Same YAML reader every other widget uses, so
   the quoting rules an author already knows apply here too. */
function zoneSpec(src) {
  const y = (typeof parseWidgetYaml === 'function') ? parseWidgetYaml('zone', src, 'z') : {};
  const goals = Array.isArray(y.goals) ? y.goals.filter(function (g) { return g && typeof g === 'object'; }) : [];
  const tools = Array.isArray(y.tools) ? y.tools.filter(function (t) { return t && typeof t === 'object' && t.kind; }) : [];
  const board = Array.isArray(y.board) ? y.board.filter(function (r) {
    return r && typeof r === 'object' && r.id && Array.isArray(r.at) && r.at.length === 4;
  }) : [];
  const slots = Array.isArray(y.slots) ? y.slots.map(String) : [];
  const prompts = {};
  if (y.prompts && typeof y.prompts === 'object') {
    Object.keys(y.prompts).forEach(function (k) { prompts[zoneSlotKey(k)] = String(y.prompts[k]); });
  }
  return {
    // `sheet` unless told otherwise: it is the older kind and the one a zone with slots wants.
    kind: y.kind === 'build' ? 'build' : 'sheet',
    file: y.file || '',
    title: y.title || '', intro: y.intro || '', brief: y.brief || '',
    opener: y.opener || '', reward: y.reward || '',
    slots: slots, prompts: prompts, goals: goals, tools: tools, board: board
  };
}

/* ---------- the bot in the room ----------
   Same dock, same bubbles, same input row as the assistant in the shell and the tutor in the bench.
   Reached at runtime rather than at load because js/ai.js is loaded after this file, which is the
   trap the bench's own wiring documents: a load-time call slides past the typeof guard and leaves
   the textarea not growing, with nothing to show that it failed. */
/* ---------- the conversation, laid over the board ----------
   Not a panel beside the workspace and not objects in board coordinates either. Bubbles floating on
   the right with the board visible underneath and running on behind them — text messages over a
   whiteboard. They stay put while the board pans, because a conversation you have to go and find by
   panning is not a conversation, and because what the assistant says is about the board as a whole
   rather than about one spot on it. */
function zoneSay(who, text) {
  if (!who) return null;                                  // called with nothing = "just look again"
  const lane = $('zoneLane'); if (!lane) return null;
  const el = document.createElement('div');
  el.className = 'zone-bubble ' + who;
  if (who === 'bot' && typeof mdToSafeHTML === 'function') {
    try { el.innerHTML = mdToSafeHTML(text); } catch (e) { el.textContent = String(text); }
  } else el.textContent = text;
  placeInLane(el);
  return el;
}
function placeInLane(el) {
  const lane = $('zoneLane'); if (!lane) return;
  lane.appendChild(el);
  lane.scrollTop = lane.scrollHeight;
}

/* A suggestion the student can accept into a slot. This is the thing that makes the bot part of the
   workspace rather than a chat next to it: it does not tell them what to type, it offers a wording
   and puts it in the box. Accepting is one press, and rewording it is the other — because a
   sentence a child pressed a button to accept is not yet theirs, and the second button is how they
   get to make it so. */
/* The assistant fills the box itself, as the conversation goes.
   This used to be an offer with a "Put it on the board" button, and the button was the problem: the
   student has just answered the question, so being asked to confirm their own answer teaches
   nothing and breaks the run of the interview. The board is meant to fill in WHILE they talk — they
   answer, it lands, the next question comes.

   Nothing replaces the button either — not even an undo. Two undo affordances already exist and
   both are better than a third: the sticky is editable on the board (click it), and the student can
   simply tell the assistant it got it wrong, which is the conversation they are already having.
   What lands in the chat is a receipt, not a question. */
function zoneLanded(zone, offer) {
  if (!offer || !openZoneRef) return;
  /* A collecting region has no single sticky to write into — it IS a pile of notes, and dropNote
     rebuilds its slot from whatever is sitting in it. So writing the slot directly there would be
     undone by the next drag. The assistant adds a note inside the region instead, which is exactly
     what a student does by hand. */
  const region = zoneRegions(zone).filter(function (r) {
    return r.collects && zoneSlotKey(r.collects) === zoneSlotKey(offer.heading);
  })[0];
  if (region) { landInRegion(zone, region, offer); return; }

  const slot = sheetSlot(zone.sheet, offer.heading);
  slot.answer = offer.text;
  zone.touched = true;
  sheetWrite(zone.sheet);
  paintZoneBoard(zone); paintZoneGoals(zone);
  flashNote('slot:' + zoneSlotKey(offer.heading));

  const card = document.createElement('div'); card.className = 'zone-offer landed';
  card.innerHTML = '<div class="zone-offer-lab">&#10003; written into &ldquo;'
    + esc(offer.heading.replace(/\.+$/, '')) + '&rdquo;</div><p></p>';
  card.querySelector('p').textContent = offer.text;
  placeInLane(card);
}
/* Drop the assistant's answer into a collecting region as a note, laid out under whatever is
   already in there, and rebuild that region's slot from the result. */
function landInRegion(zone, region, offer) {
  const a = region.at || [0, 0, 240, 200];
  const inside = plannedGeoms(zone).filter(function (g) { return inRect(regionRect(zone, region), g.x + g.w / 2, g.y + g.h / 2); }).length;
  const perRow = Math.max(1, Math.floor(a[2] / (ZONE_NOTE_W + 16)));
  const i = addLooseNote(zone, offer.text, [
    a[0] + 16 + (inside % perRow) * (ZONE_NOTE_W + 16),
    a[1] + 32 + Math.floor(inside / perRow) * (ZONE_NOTE_H + 16)
  ], true);
  zone.touched = true;
  dropNote(zone, { loose: true, index: i }, notePos(zone, 'note:' + i)[0], notePos(zone, 'note:' + i)[1]);
  flashNote('note:' + i);

  const card = document.createElement('div'); card.className = 'zone-offer landed';
  card.innerHTML = '<div class="zone-offer-lab">&#10003; added to &ldquo;'
    + esc(region.say || offer.heading) + '&rdquo;</div><p></p>';
  card.querySelector('p').textContent = offer.text;
  placeInLane(card);
}
function notePos(zone, id) { const g = noteGeo(zone, id) || {}; return [g.x || 0, g.y || 0]; }

/* A moment of gold on the sticky that just changed. Something appearing silently on a board while
   the student is reading a message on the other side of the screen is something they do not see. */
function flashNote(id) {
  const el = $('zoneCanvas').querySelector('[data-id="' + id + '"]');
  if (!el) return;
  el.classList.add('landed');
  setTimeout(function () { el.classList.remove('landed'); }, 1400);
}

function zoneBotReset(zone) {
  $('zoneLane').innerHTML = '';
  zone.greeted = false;
  zone.chat = [];
  const tag = $('zoneBotTag');
  if (tag) {
    const spec = (typeof aiModels !== 'undefined' && (aiModels['zone-coach'] || aiModels.tutor)) || '';
    tag.textContent = spec.replace(/^[^:]+:/, '') || '…';
    tag.title = spec;
  }
  wireZoneChatBox();
}

/* The bot speaks first, and it speaks about what is actually missing. This is the whole difference
   between this and the dock: "80% don't know what to make" is the documented failure mode this
   module exists for, and a helper that waits to be asked is no help to any of them. */
function zoneBotOpen(zone) {
  if (zone.greeted) return;
  zone.greeted = true;
  const hello = zone.spec.opener
    || 'This is your zone — everything here is about your game, not ours. I ask questions and point '
       + 'at things. I will not write it for you.';
  zoneSay('bot', hello);
  if (zone.spec.kind === 'build') { zoneBrief(zone); return; }
  const empty = (zone.spec.slots || []).filter(function (h) { return !sheetSlot(zone.sheet, h).answer; });
  if (empty.length) {
    zoneAsk(zoneNudge(zone, empty), { silent: true });
  } else if (typeof loadQuestions === 'function' && typeof renderStarters === 'function') {
    loadQuestions().then(function () {
      renderStarters('zone', $('zoneLane'), function (t) { zoneSubmitText(t); }, 'tutor');
    });
  }
}

/* ---------- the quest chain ----------
   A build zone is a text adventure with a compiler attached. The objectives are the quest chain,
   the guide is the character who gives them out, and the conversation IS the quest log — which is
   why almost none of this is new UI. It is worth being explicit about why the fun is load-bearing
   rather than decoration: what this replaces is a page of numbered instructions a student reads
   once and then works alone against, and the thing that actually goes wrong there is that nobody
   tells them when they got it right. A chain that announces each objective, watches their real
   project, and says COMPLETE the moment the check passes is the same information with the two
   parts a game would never leave out — one thing at a time, and an answer the instant you do it. */
function zoneObjectiveCard(zone, goal, n) {
  const canvas = $('zoneCanvas'); if (!canvas || !openZoneRef) return;
  const card = document.createElement('div'); card.className = 'zone-quest';
  card.innerHTML = '<div class="zone-quest-lab">Objective ' + n + ' of ' + (zone.spec.goals || []).length + '</div>'
    + '<div class="zone-quest-say"></div>';
  card.querySelector('.zone-quest-say').textContent = goal.say || '';
  placeInLane(card);
}
function zoneCompleteCard(zone, goal, n) {
  const canvas = $('zoneCanvas'); if (!canvas || !openZoneRef) return;
  const card = document.createElement('div'); card.className = 'zone-quest done';
  card.innerHTML = '<div class="zone-quest-lab">&#10003; Objective ' + n + ' complete</div>'
    + '<div class="zone-quest-say"></div>';
  card.querySelector('.zone-quest-say').textContent = goal.say || '';
  placeInLane(card);
}

/* Hand out the live objective and have the guide brief it against THEIR game. The card is the
   quest; the briefing under it is why this objective exists in their game rather than in general,
   which is the part a printed instruction can never do. */
function zoneBrief(zone) {
  const goals = zone.spec.goals || [];
  const i = zoneActiveIndex(zone);
  if (i < 0) {
    zoneSay('bot', '**Every objective done.** Press Finish the zone when you are happy with it.');
    return;
  }
  if (zone.briefed === i) return;
  zone.briefed = i;
  zoneObjectiveCard(zone, goals[i], i + 1);
  zoneAsk(zoneBriefPrompt(zone, goals[i], i), { silent: true });
}
function zoneBriefPrompt(zone, goal, i) {
  return 'The student has just reached objective ' + (i + 1) + ': "' + (goal.say || '') + '". '
    + (goal.brief ? 'What it is for: ' + goal.brief + ' ' : '')
    + 'Brief them on it in two or three sentences — what to change, in which of THEIR files, and '
    + 'why it matters for the game on their one-sheet. Name the file. Do not write the code. '
    + 'Do not greet them and do not repeat the objective back word for word.';
}

/* Re-check after anything that could have satisfied the live objective, and make a noise when it
   has. Called from the editor's save and from Run. */
function zoneWatch(zone) {
  if (!zone || zone.spec.kind !== 'build') return;
  const goals = zone.spec.goals || [];
  const was = typeof zone.briefed === 'number' ? zone.briefed : -1;
  const now = zoneActiveIndex(zone);
  if (now === was) return;                       // nothing moved
  if (was >= 0 && was < goals.length && zoneGoalDone(zone, goals[was])) {
    zoneCompleteCard(zone, goals[was], was + 1);
  }
  paintZoneGoals(zone);
  zoneBrief(zone);
}
/* What to open on. The first empty box, named — a question about a specific box is answerable, and
   "what would you like to talk about" is not. */
function zoneNudge(zone, empty) {
  return 'The student has just opened this zone. ' + empty.length + ' of the '
    + (zone.spec.slots || []).length + ' boxes are still empty; the first is "' + empty[0]
    + '". Ask them one short question that would fill that box. Do not greet them again.';
}

function zoneSubmitText(t) {
  const box = $('zoneBotText');
  if (box) { box.value = t; if (typeof growTextarea === 'function') growTextarea(box); }
  zoneSubmit();
}
function zoneSubmit() {
  const box = $('zoneBotText'); if (!box) return;
  const q = box.value.trim(); if (!q) return;
  box.value = '';
  if (typeof growTextarea === 'function') growTextarea(box);
  zoneAsk(q);
}

/* One call per turn. The reply is prose, optionally carrying a wording for one box — see
   ai/zone-check.js for why that arrives as a trailing line rather than as JSON mixed into prose. */
function zoneAsk(question, opts) {
  const zone = openZoneRef; if (!zone || !question) return;
  const silent = !!(opts && opts.silent);
  if (!silent) zoneSay('user', question);
  const pending = zoneSay('bot', 'Thinking…');
  if (pending && typeof startThinking === 'function') startThinking(pending, 'zone');
  if (typeof setChatBusy === 'function') setChatBusy($('zoneBotText'), true);
  const history = zone.chat.slice(-6);
  if (!silent) zone.chat.push({ role: 'user', content: question });

  fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: (typeof studentId !== 'undefined' ? studentId : ''),
      agent: 'zone-coach', message: question, history: history,
      zone: zonePayload(zone),
      lessonTitle: (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx].l.t : ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (openZoneRef !== zone) return;
      const reply = (d && d.reply) || '—';
      if (pending) {
        if (typeof stopThinking === 'function') stopThinking(pending);
        if (typeof mdToSafeHTML === 'function') {
          try { pending.innerHTML = mdToSafeHTML(reply); } catch (e) { pending.textContent = reply; }
        } else pending.textContent = reply;
      }
      zone.chat.push({ role: 'assistant', content: reply });
      if (d && d.slot && d.slot.heading && d.slot.text) zoneLanded(zone, d.slot);
    })
    .catch(function () {
      if (pending) { if (typeof stopThinking === 'function') stopThinking(pending); pending.textContent = 'Could not reach the helper.'; }
    })
    .finally(function () { if (typeof setChatBusy === 'function') setChatBusy($('zoneBotText'), false); });
}

/* What the model is told about the zone. The board, as it stands — every declared box with whatever
   is in it — plus the goals and their state, so it can talk about what is left rather than guessing.
   A dedicated `zone` object rather than stray fields, because the bench learned that the hard way:
   context sent under a name the prompt does not use is dropped silently by fill() and the model
   answers confidently about something else. */
function zonePayload(zone) {
  const build = zone.spec.kind === 'build';
  /* A build zone has no board of its own, so what goes over as "boxes" is their ONE-SHEET — the
     game they said they were making. That is the whole point of the guide in a build zone: it is
     the only thing in the app that can say "your sheet says the platforms vanish, so start in
     world.js", and it cannot say it without the sheet. */
  /* A sheet board's boxes are its slots PLUS anything a region collects. The collecting ones are
     not in `slots:` — they are piles of notes rather than a single sticky — but they are still
     boxes on the student's board with headings on them, and leaving them out meant the assistant
     could see "not building" written on the screen, be asked to fill it, and have every attempt
     silently dropped because the heading was not on its allowlist. */
  const headings = build
    ? sheetRead().slots.filter(function (s) { return s.answer; }).map(function (s) { return s.heading; })
    : (zone.spec.slots || []).concat(zoneRegions(zone)
      .filter(function (r) { return r.collects; })
      .map(function (r) { return r.collects; }));
  const sheet = build ? sheetRead() : zone.sheet;
  const boxes = headings.map(function (h) {
    return { heading: h, text: sheetSlot(sheet, h).answer || '' };
  });
  const out = {
    kind: zone.spec.kind,
    title: zone.spec.title || '',
    brief: zone.spec.brief || '',
    boxes: boxes,
    goals: (zone.spec.goals || []).map(function (g) {
      return { say: g.say || g.slot || '', done: zoneGoalDone(zone, g) };
    })
  };
  /* A build board has no editor in it — the student writes code in the Code tab, where they always
     have. But the guide still has to be able to say "line 14 of world.js", so their code goes over
     anyway: the file this objective is about, and the last thing their game printed. Read from the
     project and the game log rather than from a pane, because there is no pane. */
  if (build) {
    const f = zone.spec.file || 'game.js';
    out.file = f;
    out.code = String((project.files || {})[f] || '');
    out.log = (typeof gameLog !== 'undefined' && Array.isArray(gameLog))
      ? gameLog.slice(-14).map(function (l) { return '[' + l.level + '] ' + l.text; }).join('\n').slice(0, 1200)
      : '';
  }
  return out;
}

/* The sign-off. A separate agent with a separate contract, for the same reason the grader is not
   the tutor: this one answers yes or no about somebody's work, and an agent that mostly chats is
   the wrong thing to ask. Anything other than an explicit refusal passes. */
function zoneSignOff(zone) {
  return fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: (typeof studentId !== 'undefined' ? studentId : ''),
      agent: 'zone-check',
      message: 'The student says this zone is finished. Decide whether the boxes have real answers in them.',
      zone: zonePayload(zone),
      lessonTitle: (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx].l.t : ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) { return (d && d.result && typeof d.result.pass === 'boolean') ? d.result : null; })
    .catch(function () { return null; });          // unreachable is not a refusal
}

let zoneChatWired = false;
function wireZoneChatBox() {
  if (zoneChatWired || typeof wireChatBox !== 'function') return;
  zoneChatWired = true;
  wireChatBox($('zoneBotText'), zoneSubmit);
}

/* ---------- wiring, once, at load ---------- */
if ($('zoneChatForm')) $('zoneChatForm').addEventListener('submit', function (e) { e.preventDefault(); zoneSubmit(); });
if ($('zoneToCode')) $('zoneToCode').addEventListener('click', zoneToCode);
if ($('zoneZoomIn')) $('zoneZoomIn').addEventListener('click', function () { zoneZoom(0.1); });
if ($('zoneZoomOut')) $('zoneZoomOut').addEventListener('click', function () { zoneZoom(-0.1); });
/* The wheel means zoom on the board and scroll in the conversation. Which one you get is decided by
   what is under the pointer, not by a mode — that is how every canvas app behaves and it is the one
   arrangement nobody has to be told about. The conversation's own scrolling is left alone entirely,
   so a long thread reads normally. */
if ($('zoneCanvasWrap')) $('zoneCanvasWrap').addEventListener('wheel', function (e) {
  if (e.target.closest('.zone-chat-over')) return;      // the conversation scrolls itself
  if (e.target.closest('.zone-note-edit')) return;      // so does a note being typed into
  e.preventDefault();
  const b = $('zoneCanvasWrap').getBoundingClientRect();
  zoneZoom(e.deltaY > 0 ? -0.08 : 0.08, { x: e.clientX - b.left, y: e.clientY - b.top });
}, { passive: false });
if ($('zoneFit')) $('zoneFit').addEventListener('click', function () { if (openZoneRef) zoneFit(openZoneRef); });
/* Pan by dragging the board itself. Notes stop this from reaching here (they capture the pointer),
   so grabbing a sticky moves the sticky and grabbing the space between them moves the board. */
if ($('zoneCanvasWrap')) $('zoneCanvasWrap').addEventListener('pointerdown', function (e) {
  const w = $('zoneCanvasWrap');
  if (e.target.closest('.zone-note') || e.target.closest('.zone-palette') || e.target.closest('.zone-zoom')) return;
  commitZoneEdit();
  w.classList.add('panning'); w.setPointerCapture(e.pointerId);
  const sx = e.clientX - zonePanX, sy = e.clientY - zonePanY;
  const move = function (ev) { zonePanX = ev.clientX - sx; zonePanY = ev.clientY - sy; applyZoneView(); };
  const up = function () {
    w.classList.remove('panning');
    w.removeEventListener('pointermove', move); w.removeEventListener('pointerup', up);
  };
  w.addEventListener('pointermove', move); w.addEventListener('pointerup', up);
});
if ($('zoneBack')) $('zoneBack').addEventListener('click', closeZone);
if ($('zoneDone')) $('zoneDone').addEventListener('click', finishZone);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && openZoneRef) { closeZone(); e.preventDefault(); }
});
