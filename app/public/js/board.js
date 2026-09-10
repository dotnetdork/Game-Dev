/* board.js — the Design tab: the student's own design board, open at any point in the course.
 *
 * A canvas with sticky notes on it, between Learn and Code. What their game IS lives here — the one
 * sentence, the verb, how you win, how you lose, the twist, and the list of everything they decided
 * NOT to build — and they can get to it from any lesson rather than at six appointed moments.
 *
 * WHAT THIS USED TO BE, because the shape of the code still shows it. Every module ended in a
 * CHECKPOINT: a gated lesson that opened this board full-screen, with objectives, a progress rail,
 * a Finish button, a badge, and a coach conducting an interview inside it. The gate is gone
 * (2026-09-09). The board was the good half; the gate was the bad half — six walls, each arriving
 * as a different kind of thing from every lesson around it, and none of them somewhere a student
 * could simply go back to. What is left is the workspace with none of the ceremony.
 *
 * Three things carry over from that design and are worth keeping stated:
 *
 *   The artifact is a FILE. The board is a structured view of `design.md` in the student's own
 *   project, and that file stays the single truth — read on show, written on every edit. Nothing is
 *   stored twice. This matters more than it looks: notes kept in progress state are destroyed by
 *   "Reset my progress", a button that lives under a heading called Testing and promises only to
 *   clear XP and lessons, and the one-sheet is the only thing a student cannot get back by reading
 *   the starter.
 *
 *   The REGIONS are the data, not decoration. Dragging a sticky out of My game and into Not building
 *   is how a student cuts scope — a design lesson made physical instead of described.
 *
 *   There is no chat in here. The board had its own coach; now the Design tab uses the shell's AI
 *   panel like every other tab, with Build switched off and the Tutor answering as the design coach.
 *   One assistant, in one place, whichever tab you are on.
 */

/* ---------- the one-sheet, as data ----------
   design.md is markdown a student can open in the Code tab and read, and it is also the board's
   backing store. Those two have to be the same file or they drift, so this parses and re-renders
   it rather than keeping a copy.

   Round-tripping rules, both learned from what the file actually looks like:

     A leading (parenthesised block) in a slot is a PROMPT, not an answer. The starter ships one
     under every heading to explain what goes there, and a student who has written nothing has an
     empty slot rather than a slot containing a sentence we wrote.

     Headings this board does not declare are KEPT, in place. A later checkpoint adds `## My core
     loop`, and a student adds whatever they like — dropping those on write would delete their
     work to tidy a namespace. */
const SHEET_FILE = 'design.md';

function slotKey(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

/* Strip a balanced parenthesised block from the front. Balanced rather than greedy because the
   prompts contain parentheses of their own — "(0 = none)" inside one would end it early. */
function splitPrompt(body) {
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
    if (m) { cur = { heading: m[1], key: slotKey(m[1]), raw: [] }; sheet.slots.push(cur); return; }
    (cur ? cur.raw : sheet.head).push(ln);
  });
  sheet.slots.forEach(function (s) {
    const p = splitPrompt(s.raw.join('\n'));
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
   writing a board should not have to reproduce it. */
function sheetSlot(sheet, heading) {
  const k = slotKey(heading);
  let s = sheet.slots.filter(function (x) { return x.key === k; })[0];
  if (!s) { s = { heading: heading, key: k, raw: [], prompt: '', answer: '' }; sheet.slots.push(s); }
  return s;
}

/* ---------- the board ----------
   The student's design board: one canvas with sticky notes on it, panned and dragged, living behind
   the Design tab and open at any point in the course.

   It used to be six of these, one behind each module's CHECKPOINT — a gated lesson that replaced the
   page with a full-screen board and made the module's stars wait behind it. That shape is gone
   (2026-09-09, see content/course.yaml). The board was the good half of it and the gate was the bad
   half: six visits, each one a wall, each one arriving as a different kind of thing from every
   lesson around it. Now there is ONE board, it belongs to the student rather than to a lesson, and
   the whole course can point at it — which is what "work on your own game" was always supposed to
   mean.

   ONE board, not one per lesson. The key is fixed rather than the lesson id: a design board that
   reset when you turned the page would be a worksheet again.

   The regions are not decoration. They are the data: dragging a sticky out of My game and into Not
   building is how a student cuts scope, and that is a design lesson made physical instead of
   described. A board where dragging changed nothing would be a picture of a workspace.

   What lives where, and why:

     slot text      design.md. It is the one thing a student cannot get back, so it stays in a file
                    that survives Reset my progress.
     loose notes    also design.md, under `## Board notes`, one per line — same argument.
     positions      state.boards[BOARD_KEY]. Pure layout, cheap to lose, and no migration needed
                    because loadState merges DEFAULT_STATE first.

   Two kinds of sticky. A SLOT note is one heading of the one-sheet: always present, never
   deletable, its text is that slot's answer. A LOOSE note is anything else the student writes, and
   the region it is sitting in decides what it means. */
let theBoard = null;             // built once, on first paint; there is only ever one
const BOARD_KEY = 'design';      // not a lesson id — see above
const BOARD_MIN_WIDTH = 700;     // same threshold as the lab bench; see tooSmallToBuild

const NOTE_W = 172;
const NOTE_H = 104;
const NOTE_COLOURS = ['y', 'b', 'g', 'p', 'o'];

/* Where the notes are, how big, and whether they are pinned. Layout only — see the note above about
   what is stored where. Stored as an object rather than an [x, y] pair because size and pinning
   arrived later and a tuple that grows is a tuple somebody reads wrong. */
function boardState(lessonId) {
  if (!state.boards) state.boards = {};
  if (!state.boards[lessonId]) state.boards[lessonId] = { pos: {} };
  return state.boards[lessonId];
}
function noteGeo(board, id) {
  const raw = (boardState(BOARD_KEY).pos || {})[id];
  if (!raw) return null;
  if (Array.isArray(raw)) return { x: raw[0], y: raw[1] };     // boards saved before size and pins
  return raw;
}
function saveNoteGeo(board, id, patch) {
  const b = boardState(BOARD_KEY);
  if (!b.pos) b.pos = {};
  const was = noteGeo(board, id) || {};
  b.pos[id] = Object.assign({}, was, patch);
  if (typeof saveState === 'function') saveState();
}
function notePinned(board, id) { return !!(noteGeo(board, id) || {}).pin; }

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
   The board's furniture. Three of them, and each has a job:

     holds: slots            the fixed one-sheet stickies live in here
     collects: <heading>     every loose note dropped in here composes that slot
     (neither)               the scratch region — somewhere to put a thought that has no home yet

   Fixed in code rather than authored per lesson, because there is one board now and it belongs to
   the student rather than to whatever page they happen to be on. A region grows to fit what is
   dropped into it, so the rectangles below are starting sizes and not limits. */
const CUT_HEADING = 'What I am NOT building';
const BOARD_REGIONS = [
  { id: 'game', say: 'My game', at: [40, 40, 620, 300], holds: 'slots' },
  { id: 'cut', say: 'Not building — next time', at: [700, 40, 300, 300], hot: true, collects: CUT_HEADING },
  { id: 'loose', say: 'Ideas, unsorted', at: [40, 380, 960, 200] }
];
function boardRegions() { return BOARD_REGIONS; }
/* The one-sheet's headings, in the order design.md lists them, minus the two that are not stickies:
   the cut list is a REGION that loose notes get dropped into, and Board notes is where those loose
   notes are stored. Read from the file rather than declared, so adding a heading to design.md adds
   a note to the board and nothing else has to know. */
function boardSlots(board) {
  return (board.sheet.slots || []).map(function (x) { return x.heading; })
    .filter(function (h) { return h !== CUT_HEADING && h !== BOARD_SLOT; });
}
/* Which region a note at (x, y) is in. Tested against the region's DRAWN rectangle, not its
   declared one — a region grows to fit what has been dropped in it, and a note sitting in the part
   it grew is visibly inside a box that would otherwise say it was loose. */
function regionAt(board, x, y) {
  const cx = x + NOTE_W / 2, cy = y + NOTE_H / 2;
  const hit = boardRegions(board).filter(function (r) { return inRect(regionRect(board, r), cx, cy); });
  return hit[hit.length - 1] || null;      // the last declared wins, so a nested region can exist
}

/* ---------- painting ---------- */
function paintBoard(board) {
  const canvas = $('boardCanvas'); if (!canvas) return;
  canvas.innerHTML = '';
  board.sheet = sheetRead();
  geomCache = null;                       // one geometry pass per paint; see plannedGeoms

  boardRegions(board).forEach(function (r) {
    const a = regionRect(board, r);
    const el = document.createElement('div');
    el.className = 'board-field' + (r.hot ? ' hot' : '');
    el.style.cssText = 'left:' + a[0] + 'px;top:' + a[1] + 'px;width:' + a[2] + 'px;height:' + a[3] + 'px';
    el.dataset.region = r.id || '';
    el.innerHTML = '<span class="board-field-lab">' + esc(r.say || r.id || '') + '</span>';
    canvas.appendChild(el);
  });

  paintSlotNotes(board, canvas);
  paintLooseNotes(board, canvas);
  paintConnections(board, canvas);
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
function regionRect(board, r) {
  const a = (r.at || [0, 0, 240, 200]).slice();
  const geoms = plannedGeoms(board);
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
function plannedGeoms(board) {
  if (geomCache) return geomCache;
  const out = [];
  const push = function (id, dx, dy) {
    const g = noteGeo(board, id) || {};
    out.push({ id: id, x: g.x === undefined ? dx : g.x, y: g.y === undefined ? dy : g.y,
      w: g.w || NOTE_W, h: g.h || NOTE_H });
  };
    looseNotes(board.sheet).forEach(function (t, i) {
    push('note:' + i, 60 + (i % 4) * 30, 470 + Math.floor(i / 4) * 24);
  });
  geomCache = out;
  return out;
}
/* Where each objective sticky goes: its lane, then in order down it. Shared by the painter and the
   geometry pass so the two cannot disagree about where an objective is. */
function paintSlotNotes(board, canvas) {
  const home = boardRegions(board).filter(function (r) { return r.holds === 'slots'; })[0];
  boardSlots(board).forEach(function (h, i) {
    const slot = sheetSlot(board.sheet, h);
    const id = 'slot:' + slotKey(h);
    const d = defaultSlotPos(home, i);
    const g = noteGeo(board, id) || { x: d[0], y: d[1] };
    const note = makeNote(board, {
      id: id, x: g.x, y: g.y, w: g.w, h: g.h, pinned: !!g.pin, star: !!g.star,
      colour: g.colour || NOTE_COLOURS[i % NOTE_COLOURS.length],
      label: h.replace(/\.+$/, ''),
      text: slot.answer,
      hint: slot.prompt || '',
      onText: function (v) { slot.answer = v; sheetWrite(board.sheet); }
    });
    canvas.appendChild(note);
  });
}
function defaultSlotPos(home, i) {
  const a = (home && home.at) || [40, 40, 420, 400];
  const perRow = Math.max(1, Math.floor(a[2] / (NOTE_W + 22)));
  return [a[0] + 22 + (i % perRow) * (NOTE_W + 22),
    a[1] + 34 + Math.floor(i / perRow) * (NOTE_H + 26)];
}

/* Loose notes. Where one sits decides what it means: a note in a `collects:` region is part of
   that slot, and a note anywhere else is a thought the student has not filed yet. */
function paintLooseNotes(board, canvas) {
  looseNotes(board.sheet).forEach(function (text, i) {
    const id = 'note:' + i;
    const g = noteGeo(board, id) || { x: 60 + (i % 4) * 30, y: 470 + Math.floor(i / 4) * 24 };
    canvas.appendChild(makeNote(board, {
      id: id, x: g.x, y: g.y, w: g.w, h: g.h, pinned: !!g.pin, star: !!g.star,
      colour: g.colour || 'o', loose: true, index: i,
      label: regionLabelFor(board, g.x, g.y), text: text, hint: 'A loose thought.',
      onText: function (v) {
        const list = looseNotes(board.sheet);
        if (v) list[i] = v; else list.splice(i, 1);
        saveLooseNotes(board.sheet, list);
        paintBoard(board);
      },
      /* Deleting is only offered on notes the student made. A slot note is one heading of their
         one-sheet: it can be emptied, moved and pinned, but it cannot be got rid of, because the
         question it is asking does not go away just because they have not answered it. */
      onDelete: function () {
        const list = looseNotes(board.sheet);
        list.splice(i, 1);
        saveLooseNotes(board.sheet, list);
        /* Positions are keyed by index, so removing one shuffles every note after it onto the
           previous note's spot. Shift them down to match rather than leaving the board scrambled. */
        const b = boardState(BOARD_KEY);
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
        paintBoard(board);
      }
    }));
  });
}
function regionLabelFor(board, x, y) {
  const r = regionAt(board, x, y);
  return r ? (r.say || r.id) : 'Loose';
}

/* One sticky. `fixed` is a slot note — one of the one-sheet's headings, always present and never
   deletable; anything else is a loose note the student made and can throw away. */
function makeNote(board, o) {
  const el = document.createElement('div');
  el.className = 'board-note ' + (o.colour || 'y') + (o.text ? '' : ' blank')
    + (o.done ? ' done' : '') + (o.fixed ? ' fixed' : '') + (o.pinned ? ' pinned' : '')
    + (o.star ? ' star' : '');
  el.style.left = o.x + 'px'; el.style.top = o.y + 'px';
  if (o.w) el.style.width = o.w + 'px';
  if (o.h) el.style.height = o.h + 'px';
  el.dataset.id = o.id;
  el.tabIndex = o.fixed ? -1 : 0;
  const body = o.text || o.hint || '';
  el.innerHTML = (o.done ? '<span class="board-note-tick" aria-hidden="true">&#10003;</span>' : '')
    + '<div class="board-note-lab">' + esc(o.label || '') + '</div>'
    + '<div class="board-note-txt">' + esc(body) + '</div>'
    + (o.note ? '<div class="board-note-sub">' + esc(o.note) + '</div>' : '');
  if (o.fixed) { el.setAttribute('aria-label', (o.label || '') + ': ' + (o.text || '')); return el; }

  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', (o.label || '') + (o.text ? ': ' + o.text : ' — empty')
    + (o.pinned ? ' — pinned' : '') + '. Click to write, drag to move.');

  /* The controls sit on the note and appear on hover or focus. On it rather than in a toolbar
     somewhere, because which note you are acting on has to be unambiguous on a board where there
     are fifteen of them. Keyboard users get them via focus, so they are not mouse-only. */
  const bar = document.createElement('div');
  bar.className = 'board-note-bar';
  const btn = function (icon, title, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'board-note-btn'; b.title = title;
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
    function () { saveNoteGeo(board, o.id, { star: !o.star, x: o.x, y: o.y }); paintBoard(board); });
  btn('mdi-palette', 'Change its colour', function () {
    const i = NOTE_COLOURS.indexOf(o.colour);
    saveNoteGeo(board, o.id, { colour: NOTE_COLOURS[(i + 1) % NOTE_COLOURS.length], x: o.x, y: o.y });
    paintBoard(board);
  });
  if (o.loose) {
    btn('mdi-content-copy', 'Make another like this', function () {
      addLooseNote(board, o.text || '', [o.x + 18, o.y + 18]);
    });
  }
  /* Pinning saves WHERE IT IS, not just that it is pinned. A note that has never been dragged has
     no saved position, so without writing x and y here it would jump back to its default spot at
     the very moment the student said "stay there" — which is the opposite of what pinning means. */
  btn(o.pinned ? 'mdi-pin' : 'mdi-pin-outline', o.pinned ? 'Unpin — let it move again' : 'Pin it where it is',
    function () {
      saveNoteGeo(board, o.id, { pin: !o.pinned, x: o.x, y: o.y });
      paintBoard(board);
    });
  // No confirm. It is a sticky note on their own board, and the friction is worse than the mistake.
  if (o.onDelete) btn('mdi-close', 'Delete this note', o.onDelete);
  el.appendChild(bar);

  /* Resize from the corner. Only the corner, and only bigger than a stub: a note you can shrink to
     nothing is a note you can lose on a board this size. */
  const grip = document.createElement('div');
  grip.className = 'board-note-grip';
  grip.setAttribute('aria-hidden', 'true');
  resizeNote(board, el, o, grip);
  el.appendChild(grip);

  if (!o.pinned) dragNote(board, el, o);
  const edit = function () { editNote(board, el, o); };
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
  });
  if (o.pinned) el.addEventListener('click', function (e) { if (!e.target.closest('.board-note-btn')) edit(); });
  el.__edit = edit;
  return el;
}

function resizeNote(board, el, o, grip) {
  grip.addEventListener('pointerdown', function (e) {
    e.stopPropagation(); e.preventDefault();
    const r = el.getBoundingClientRect();
    const w0 = r.width / boardScale, h0 = r.height / boardScale;
    const sx = e.clientX, sy = e.clientY;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('sizing');
    const move = function (ev) {
      const w = Math.max(120, w0 + (ev.clientX - sx) / boardScale);
      const h = Math.max(80, h0 + (ev.clientY - sy) / boardScale);
      el.style.width = w + 'px'; el.style.height = h + 'px';
    };
    const up = function () {
      grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up);
      el.classList.remove('sizing');
      saveNoteGeo(board, o.id, { w: Math.round(parseFloat(el.style.width)), h: Math.round(parseFloat(el.style.height)) });
    };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
}

/* Drag. A click that never moved opens the note for editing instead — a sticky you cannot type into
   by clicking would be a very strange sticky. */
function dragNote(board, el, o) {
  el.addEventListener('pointerdown', function (e) {
    if (el.classList.contains('editing')) return;
    if (linking) { e.stopPropagation(); linkClick(board, o.id); return; }
    e.stopPropagation();
    const canvas = $('boardCanvas');
    const startX = e.clientX, startY = e.clientY;
    const ox = parseFloat(el.style.left) || 0, oy = parseFloat(el.style.top) || 0;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = function (ev) {
      const dx = (ev.clientX - startX) / boardScale, dy = (ev.clientY - startY) / boardScale;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!moved) { moved = true; board.arranging = true; el.classList.add('dragging'); canvas.classList.add('arranging'); }
      el.style.left = (ox + dx) + 'px'; el.style.top = (oy + dy) + 'px';
      highlightDrop(board, ox + dx, oy + dy);
    };
    const up = function () {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      el.classList.remove('dragging'); canvas.classList.remove('arranging'); board.arranging = false;
      clearDrop();
      if (!moved) { el.__edit(); return; }
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      saveNoteGeo(board, o.id, { x: Math.round(x), y: Math.round(y) });
      dropNote(board, o, x, y);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
}
function highlightDrop(board, x, y) {
  const r = regionAt(board, x, y);
  $('boardCanvas').querySelectorAll('.board-field').forEach(function (f) {
    f.classList.toggle('over', !!r && f.dataset.region === (r.id || ''));
  });
}
function clearDrop() {
  $('boardCanvas').querySelectorAll('.board-field').forEach(function (f) { f.classList.remove('over'); });
}

/* Where a note lands is what it MEANS. This is the function that makes the board data rather than
   layout: drop a loose note into a `collects:` region and it becomes part of that slot; drag it out
   and it stops being. Cutting scope is a gesture here, which is the whole reason for a canvas. */
function dropNote(board, o, x, y) {
  const r = regionAt(board, x, y);
  if (!o.loose) return;                            // a slot note means the same wherever it sits
  const collecting = boardRegions(board).filter(function (g) { return g.collects; });
  if (!collecting.length) return;

  const text = looseNotes(board.sheet)[o.index];
  if (!text) return;
  /* Rebuild every collecting slot from what is now sitting in it. Rebuilding rather than patching,
     because a note can leave one region and enter another in a single drag and the two halves of
     that must not be able to disagree. */
  const list = looseNotes(board.sheet);
  collecting.forEach(function (g) {
    const inside = [];
    list.forEach(function (t, i) {
      const p = (i === o.index) ? [x, y] : (notePos(board, 'note:' + i) || [0, 0]);
      const at = regionAt(board, p[0], p[1]);
      if (at && at.id === g.id) inside.push(t);
    });
    sheetSlot(board.sheet, g.collects).answer = inside.join(', ') + (inside.length ? '.' : '');
  });
  sheetWrite(board.sheet);
  paintBoard(board);
  if (r && r.budget) paintBoard(board);
}

/* Type into a sticky, in place. */
let noteEditing = null;
function commitNoteEdit() { if (noteEditing) noteEditing(true); }
function editNote(board, el, o) {
  if (el.classList.contains('editing')) return;
  commitNoteEdit();
  el.classList.add('editing');
  const txt = el.querySelector('.board-note-txt');
  const box = document.createElement('textarea');
  box.className = 'board-note-edit';
  box.value = o.text || '';
  box.placeholder = o.hint || 'Write it here.';
  txt.replaceWith(box);
  box.focus(); box.select();

  let closed = false;
  const finish = function (save) {
    if (closed) return; closed = true;
    if (noteEditing === finish) noteEditing = null;
    if (save && box.value.trim() !== (o.text || '')) {
      board.touched = true;
      o.onText(box.value.trim());
    }
    paintBoard(board);
  };
  noteEditing = finish;
  box.addEventListener('blur', function () { finish(true); });
  box.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(true); }
  });
}

/* A region that costs something. The scope lesson, as a meter you cannot argue with: the weeks are
   fixed, the sizes are fixed, and the only thing that can move is which notes are sitting in here. */
/* ---------- connections ----------
   An arrow from one note to another: "this leads to that", "this is a version of that". Ideas do
   not come in a list, and a board that can only stack notes is a list with extra steps.
   Stored as pairs of note ids in board state, drawn as one SVG layer under the notes. */
function boardLinks(board) {
  const b = boardState(BOARD_KEY);
  if (!Array.isArray(b.links)) b.links = [];
  return b.links;
}
function paintConnections(board, canvas) {
  const links = boardLinks(board);
  if (!links.length) return;
  const by = {};
  plannedGeoms(board).forEach(function (g) { by[g.id] = g; });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'board-links');
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
    line.setAttribute('class', 'board-link');
    line.addEventListener('click', function () {
      const at = boardLinks(board).findIndex(function (k) { return k[0] === l[0] && k[1] === l[1]; });
      if (at >= 0) { boardLinks(board).splice(at, 1); if (typeof saveState === 'function') saveState(); paintBoard(board); }
    });
    svg.appendChild(line);
  });
  if (keep.length !== links.length) { boardState(BOARD_KEY).links = keep; if (typeof saveState === 'function') saveState(); }
  svg.setAttribute('width', maxX + 80); svg.setAttribute('height', maxY + 80);
  canvas.appendChild(svg);
}
/* Linking is a mode, because it needs two clicks and a board where every click might start a line
   would be a board you cannot use. Escape or a second press of the tool leaves it. */
let linking = null;
function startLinking(board) {
  linking = linking ? null : { from: null };
  $('boardCanvasWrap').classList.toggle('linking', !!linking);
  paintPalette(board);
  if (linking) toast('Click one note, then another, to link them. Click a line to remove it.');
}
function linkClick(board, id) {
  if (!linking) return false;
  if (!linking.from) { linking.from = id; $('boardCanvas').querySelector('[data-id="' + id + '"]').classList.add('linkfrom'); return true; }
  if (linking.from !== id) {
    boardLinks(board).push([linking.from, id]);
    if (typeof saveState === 'function') saveState();
  }
  linking = null;
  $('boardCanvasWrap').classList.remove('linking');
  paintBoard(board); paintPalette(board);
  return true;
}

/* ---------- pan and zoom ---------- */
let boardScale = 1, boardPanX = 0, boardPanY = 0;
function applyBoardView() {
  const c = $('boardCanvas'); if (!c) return;
  c.style.transform = 'translate(' + boardPanX + 'px,' + boardPanY + 'px) scale(' + boardScale + ')';
  const at = $('boardZoomAt'); if (at) at.textContent = Math.round(boardScale * 100) + '%';
}
function boardZoom(by, at) {
  const was = boardScale;
  boardScale = Math.max(0.4, Math.min(1.6, +(boardScale + by).toFixed(2)));
  /* Zoom towards the pointer rather than the origin, so the thing under the cursor stays under the
     cursor. Without this, zooming in on a note in the corner sends it off the screen — which reads
     as the board running away from you. */
  if (at && was) {
    boardPanX = at.x - (at.x - boardPanX) * (boardScale / was);
    boardPanY = at.y - (at.y - boardPanY) * (boardScale / was);
  }
  applyBoardView();
}
function boardSize(board) {
  let w = 820, h = 520;
  boardRegions(board).forEach(function (r) {
    const a = r.at || [0, 0, 0, 0];
    w = Math.max(w, a[0] + a[2] + 40); h = Math.max(h, a[1] + a[3] + 40);
  });
  return [w, h];
}
/* Shrink the whole board onto the screen. Offered as a button rather than used as the default: a
   board that opens at 55% is a board whose handwriting you cannot read, and arriving zoomed out is
   the wrong first impression of a place you are meant to write in. */
function boardFit(board) {
  const wrap = $('boardCanvasWrap'); if (!wrap) return;
  const s = boardSize(board), b = wrap.getBoundingClientRect();
  boardScale = Math.max(0.4, Math.min(1, Math.min((b.width - 24) / s[0], (b.height - 24) / s[1])));
  boardPanX = Math.max(12, (b.width - s[0] * boardScale) / 2);
  boardPanY = 12;
  applyBoardView();
}
/* How a board opens: full size, centred. Full size because these are things with handwriting on
   them and 100% is the size they were written at; centred because a board that opens against one
   edge looks like it has already been dragged somewhere.
   Centred on the WORKING width — the conversation is laid over the right-hand side, so centring on
   the whole pane would put the middle of the board underneath it. */
const CHAT_W = 360;
function boardHome(board) {
  const wrap = $('boardCanvasWrap'); if (!wrap) return;
  boardScale = 1;
  const b = wrap.getBoundingClientRect(), s = boardSize(board);
  const usable = Math.max(320, b.width - Math.min(CHAT_W, b.width * 0.38));
  boardPanX = Math.round(Math.max(12, (usable - s[0]) / 2));
  boardPanY = Math.round(Math.max(12, (b.height - s[1]) / 2));
  applyBoardView();
}

/* ---------- the palette ----------
   The tools, as things that put notes ON the board rather than panels beside it. A student presses
   the dice and three ideas land on the canvas to be dragged or thrown away, which is what a
   whiteboard is for. */
function paintPalette(board) {
  const host = $('boardPalette'); if (!host) return;
  host.innerHTML = '';
  const add = function (icon, title, fn, on) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'board-tool' + (on ? ' on' : ''); b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  };
  const gap = function () { const s = document.createElement('span'); s.className = 'board-tool-gap'; host.appendChild(s); };

  add('mdi-plus', 'Add a note', function () { addLooseNote(board, ''); });
  add('mdi-vector-line', linking ? 'Stop linking' : 'Link two notes', function () { startLinking(board); }, !!linking);
  gap();
  /* The thinking tools. Every one of these is a technique that exists because a blank page beats
     most people, and each of them puts something ON the board rather than telling them about it. */
  Object.keys(PALETTE).forEach(function (kind) {
    const t = { kind: kind };
    const tool = PALETTE[t.kind];
    if (!tool) { console.warn('[league] board tool "' + t.kind + '" does not exist — see PALETTE in js/board.js'); return; }
    add(tool.icon, t.title || tool.title, function () { tool.run(board, t); });
  });
  gap();
  add('mdi-broom', 'Tidy the loose notes into a grid', function () { tidyBoard(board); });
  add('mdi-fit-to-screen', 'Fit the whole board on screen', function () { boardFit(board); });
}

/* The scratch region — the one with no job. Every tool that deals notes out puts them here rather
   than wherever the board happens to be scrolled to: dropping eight blank stickies on top of the
   one-sheet buries the thing the student is supposed to be filling in, and they arrive already
   filed into a region they have nothing to do with. */
function freeRegion(board) {
  const rs = boardRegions(board);
  return rs.filter(function (r) { return !r.holds && !r.collects && !r.objectives; })[0] || rs[rs.length - 1];
}
/* Lay the loose notes out in rows, leaving pinned ones and anything already inside a region alone.
   A tidy button that moved everything would undo the arranging, which is the work. */
function tidyBoard(board) {
  const home = freeRegion(board);
  const a = (home && home.at) || [40, 460, 900, 200];
  const perRow = Math.max(1, Math.floor(a[2] / (NOTE_W + 18)));
  let n = 0;
  looseNotes(board.sheet).forEach(function (t, i) {
    const id = 'note:' + i;
    const g = noteGeo(board, id) || {};
    if (g.pin) return;                                   // pinned means pinned
    if (g.x !== undefined && regionAt(board, g.x, g.y)) return;   // already filed somewhere
    saveNoteGeo(board, id, {
      x: a[0] + 18 + (n % perRow) * (NOTE_W + 18),
      y: a[1] + 34 + Math.floor(n / perRow) * (NOTE_H + 18)
    });
    n++;
  });
  paintBoard(board);
}

function addLooseNote(board, text, at, quiet) {
  const list = looseNotes(board.sheet);
  const i = list.length;
  list.push(text || '');                   // empty, not "New note" — a blank sticky is an invitation
  saveLooseNotes(board.sheet, list);
  const wrap = $('boardCanvasWrap').getBoundingClientRect();
  const p = at || [(-boardPanX + wrap.width / 2) / boardScale - NOTE_W / 2,
    (-boardPanY + wrap.height / 2) / boardScale - NOTE_H / 2];
  saveNoteGeo(board, 'note:' + i, { x: Math.round(p[0]), y: Math.round(p[1]) });
  /* `quiet` is for the tools that drop several at once: painting and focusing per note would fight
     itself eight times over, so the caller paints once at the end. */
  if (quiet) return i;
  paintBoard(board);
  const el = $('boardCanvas').querySelector('[data-id="note:' + i + '"]');
  if (el && el.__edit) el.__edit();
  return i;
}

/* The board's own tools, over and above the fixed add/link/tidy/fit in the rail.
   The bar for being in here is high, and two entries have already failed it. A "Crazy 8s" button
   dealt eight blank stickies and started a clock; a "look at it another way" button opened seven
   SCAMPER lenses. Both are real techniques and both were dead weight on this board, for the same
   reason: they asked the student a NEW question when the board in front of them was already full of
   unanswered ones. A tool earns its place by doing something to what is ALREADY on the board. */
const PALETTE = {
  /* The test the one-sheet lesson names, made pressable: stop reading it as the person who wrote it. */
  readback: {
    icon: 'mdi-text-box-outline', title: 'Read it back as a stranger would',
    run: function (board) {
      const said = boardSlots(board).map(function (h) { return sheetSlot(board.sheet, h).answer; }).filter(Boolean);
      if (!said.length) { toast('Nothing on the board yet — write a note first.'); return; }
      const para = said.map(function (s) { return s.replace(/\s+$/, '').replace(/\.?$/, '.'); }).join(' ');
      const miss = boardSlots(board).filter(function (h) { return !sheetSlot(board.sheet, h).answer; });
      readBackModal(para, miss);
    }
  }
};
/* The board's stickies, run together into the paragraph somebody else would read. It used to arrive
   as a chat message from the coach; with no chat on the board it gets the shared dialog instead,
   which is the right shape for it anyway — it is one thing to read once, not a turn in a
   conversation. */
function readBackModal(para, miss) {
  if (typeof modal !== 'function') { toast(para); return; }
  const gaps = miss.length
    ? '<p class="bp-hint">They would still have to ask about: '
      + miss.map(function (h) { return '<b>' + esc(h.replace(/\.+$/, '')) + '</b>'; }).join(', ') + '.</p>'
    : '<p class="bp-hint">Read it out loud. The sentence you stumble on is the one to fix.</p>';
  modal({
    title: 'Your game, as a stranger reads it',
    html: '<p class="bp-use">' + esc(para) + '</p>' + gaps,
    okLabel: 'Back to the board', hideCancel: true
  });
}

/* notePos and flashNote survive the coach that used to call them: the board still moves notes
   about by itself when one is dropped into a region. */
function notePos(board, id) { const g = noteGeo(board, id) || {}; return [g.x || 0, g.y || 0]; }

/* A moment of gold on the sticky that just changed. Something appearing silently on a board while
   the student is reading a message on the other side of the screen is something they do not see. */
function flashNote(id) {
  const el = $('boardCanvas').querySelector('[data-id="' + id + '"]');
  if (!el) return;
  el.classList.add('landed');
  setTimeout(function () { el.classList.remove('landed'); }, 1400);
}


/* ---------- showing it ----------
   A tab, not a dialog: there is no open and no close, only "you are looking at it now". switchView
   calls this every time the Design tab is shown, and it does two different jobs on purpose.

   Built ONCE. The conversation is the part that must survive a trip to the Code tab and back — a
   coach that forgot the question it had just asked, every time the student went to look something
   up, would be worse than no coach.

   Re-read EVERY time. design.md is not only edited here: a lesson's your-turn writes to it, the
   coach writes to it, and the student can open it themselves. Re-reading on show is what stops the
   board being a stale picture of a file that has moved on.

   Painted after the view is visible, because boardHome measures the pane and a hidden pane
   measures zero. */
function showBoard() {
  if (!theBoard) theBoard = { sheet: null };
  theBoard.sheet = sheetRead();
  paintPalette(theBoard);
  paintBoard(theBoard);
  if (!theBoard.placed) { boardHome(theBoard); theBoard.placed = true; }
}

/* ---------- wiring, once, at load ---------- */
if ($('boardZoomIn')) $('boardZoomIn').addEventListener('click', function () { boardZoom(0.1); });
if ($('boardZoomOut')) $('boardZoomOut').addEventListener('click', function () { boardZoom(-0.1); });
if ($('boardFit')) $('boardFit').addEventListener('click', function () { if (theBoard) boardFit(theBoard); });
/* The wheel means zoom on the board and scroll in the conversation. Which one you get is decided by
   what is under the pointer, not by a mode — that is how every canvas app behaves and it is the one
   arrangement nobody has to be told about. The conversation's own scrolling is left alone entirely,
   so a long thread reads normally. */
if ($('boardCanvasWrap')) $('boardCanvasWrap').addEventListener('wheel', function (e) {
  if (e.target.closest('.board-chat-over')) return;     // the conversation scrolls itself
  if (e.target.closest('.board-note-edit')) return;     // so does a note being typed into
  e.preventDefault();
  const b = $('boardCanvasWrap').getBoundingClientRect();
  boardZoom(e.deltaY > 0 ? -0.08 : 0.08, { x: e.clientX - b.left, y: e.clientY - b.top });
}, { passive: false });
/* Pan by dragging the board itself. Notes stop this from reaching here (they capture the pointer),
   so grabbing a sticky moves the sticky and grabbing the space between them moves the board. */
if ($('boardCanvasWrap')) $('boardCanvasWrap').addEventListener('pointerdown', function (e) {
  const w = $('boardCanvasWrap');
  if (e.target.closest('.board-note') || e.target.closest('.board-palette') || e.target.closest('.board-zoom')) return;
  commitNoteEdit();
  w.classList.add('panning'); w.setPointerCapture(e.pointerId);
  const sx = e.clientX - boardPanX, sy = e.clientY - boardPanY;
  const move = function (ev) { boardPanX = ev.clientX - sx; boardPanY = ev.clientY - sy; applyBoardView(); };
  const up = function () {
    w.classList.remove('panning');
    w.removeEventListener('pointermove', move); w.removeEventListener('pointerup', up);
  };
  w.addEventListener('pointermove', move); w.addEventListener('pointerup', up);
});

