/* board.js — the Design tab: the student's own board.
 *
 * Their game design document, their task list, and the place they put an idea before they know what
 * it is. It belongs to them, not to a lesson: one board, open on every page of the course, from the
 * first lesson to the last.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT IT STOPPED BEING, twice, because the shape of the code still shows both.
 *
 * It was six CHECKPOINT boards, one gated behind each module, with objectives and a Finish button
 * (removed 2026-09-09). Then it was one board that was a structured view of `design.md`, the
 * six-slot one-sheet in the student's project (removed 2026-09-11). The one-sheet was a form with a
 * canvas painted on it: six fixed stickies you could move but not rename, delete or add to.
 *
 * Now the board is a real document with its own object model. A student can draw a frame, name it,
 * fill it with sticky notes, connect two of them with a labelled arrow, put a rectangle round a
 * group, and throw any of it away. Nothing on it is fixed. The eight frames it ships with are a
 * starting layout, not a schema — they are ordinary frames that happen to be there on day one, and
 * deleting one is allowed.
 *
 * ---------------------------------------------------------------------------------------------
 * WHERE IT IS STORED, and why it is not in progress state.
 *
 * Its own key, `leagueBoard`, beside the project and the progress rather than inside either.
 *
 * Not in the project, because the project is code: the game runner injects every file as a
 * <script>, the coder agent rewrites files, and Reset-the-game restores them. A design document is
 * none of those things.
 *
 * Not in progress state either, because progress is a ledger of what has been done and this is a
 * document. They are cleared together — **Reset my progress** is a testing control that puts the
 * whole app back to its first run, board included — but they are written at completely different
 * rates, and one blob per thing is also what makes a future per-student server sync a PUT of this
 * key rather than a merge inside somebody else's object.
 *
 * ---------------------------------------------------------------------------------------------
 * THE MODEL
 *
 *   items   one flat array, back to front. Everything is an item and every item has x, y, w, h.
 *           kinds: frame · note · text · shape · chip
 *   links   arrows between two items, optionally with a word on them.
 *
 * Flat rather than a tree, and frames do not own their children. A frame asks "whose centre is
 * inside me" when it is dragged, which means a note can be pulled out of a frame by dragging it
 * out — no reparenting step, no way to get into a state where an item belongs to a frame it is not
 * sitting on. Z-order is array order, so "bring to front" is a splice.
 */

/* ---------- storage ---------- */
const BKEY = 'leagueBoard';
const BOARD_SCHEMA = 1;

let board = null;              // the one board, loaded once
let boardDirty = false;

function saveBoard() {
  if (!board) return;
  board.v = BOARD_SCHEMA;
  Storage.writeJSON(BKEY, board);
}
/* Batched, because a drag fires on every pointermove and a board is a big object to stringify.
   Anything that ends an interaction calls saveBoard directly; anything continuous calls this. */
let saveTimer = 0;
function saveBoardSoon() {
  boardDirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { boardDirty = false; saveBoard(); }, 400);
}

function loadBoard() {
  const raw = Storage.readJSON(BKEY, null);
  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    if (!Array.isArray(raw.links)) raw.links = [];
    return raw;
  }
  return starterBoard();
}

/* ---------- what a new board looks like ----------
   Eight frames laid out as a game design document reads: what the game IS across the top, how it
   WORKS in the middle, and the two frames that are about the work rather than the game — the task
   list and the cut list — down the right.

   The sections are the ones every GDD guide agrees on, trimmed to what a twelve-year-old with one
   platformer can actually answer: pitch, core loop, mechanics, art and sound, levels. "Story" is
   deliberately absent as a default — it is the section that eats a term, and a student who wants
   one can make the frame themselves in two clicks.

   These are ORDINARY FRAMES. Nothing in the code treats them specially; they are simply what is on
   the board the first time it is opened. Rename them, move them, delete them. */
function starterBoard() {
  const F = function (id, title, x, y, w, h, colour) {
    return { id: id, kind: 'frame', title: title, x: x, y: y, w: w, h: h, colour: colour };
  };
  const N = function (id, x, y, title, text, colour) {
    return { id: id, kind: 'note', title: title, text: text, x: x, y: y, w: 168, h: 100, colour: colour };
  };
  return {
    v: BOARD_SCHEMA,
    items: [
      F('f-pitch', 'The pitch', 40, 40, 420, 240, 'b'),
      F('f-loop', 'Core loop', 500, 40, 420, 240, 'g'),
      F('f-mech', 'Mechanics & controls', 40, 320, 420, 300, 'p'),
      F('f-art', 'Art & sound', 500, 320, 420, 300, 'o'),
      F('f-levels', 'Levels', 40, 660, 880, 240, 'y'),
      F('f-todo', 'To do', 960, 40, 320, 400, 'g'),
      F('f-cut', 'Not building — next time', 960, 480, 320, 300, 'r'),
      F('f-scratch', 'Scratch', 960, 820, 320, 240, ''),
      /* Two stickies, written the way a sticky should be written — a heading you could find across
         a full board, then the thing itself. They are the only instructions the board gives. */
      N('n-1', 64, 92, 'One sentence', 'My game is a ______ where you ______.', 'y'),
      N('n-2', 524, 92, 'The loop', 'You do X, the game answers with Y, and Z sets up the next go.', 'y'),
      N('n-3', 984, 92, 'First job', 'Play the starter game. Write down one thing you would change.', 'g')
    ],
    links: []
  };
}

/* ---------- geometry ---------- */
const NOTE_W = 168, NOTE_H = 100;
const GRID = 8;                       // everything lands on this; a board of near-aligned things
                                      // looks broken in a way nobody can point at
const COLOURS = ['y', 'b', 'g', 'p', 'o', 'r', ''];
function snap(n) { return Math.round(n / GRID) * GRID; }
function uid(p) { return (p || 'i') + '-' + Math.random().toString(36).slice(2, 9); }

function itemById(id) { return (board.items || []).filter(function (i) { return i.id === id; })[0] || null; }
function rectOf(i) { return { x: i.x, y: i.y, w: i.w, h: i.h }; }
function centreOf(i) { return { x: i.x + i.w / 2, y: i.y + i.h / 2 }; }
function inside(outer, pt) {
  return pt.x >= outer.x && pt.x <= outer.x + outer.w && pt.y >= outer.y && pt.y <= outer.y + outer.h;
}
/* The frame a point sits in, topmost first. Frames are items like anything else, so this is just a
   filtered reverse scan of the same array. */
function frameAt(pt, skipId) {
  const fr = (board.items || []).filter(function (i) { return i.kind === 'frame' && i.id !== skipId; });
  for (let k = fr.length - 1; k >= 0; k--) if (inside(rectOf(fr[k]), pt)) return fr[k];
  return null;
}
/* Everything whose centre is inside this frame. Used when a frame is dragged: its contents come
   with it. Asked fresh every time rather than stored, so dragging a note out of a frame is the
   whole of "remove it from the frame". */
function itemsInFrame(f) {
  return (board.items || []).filter(function (i) {
    return i !== f && i.kind !== 'frame' && inside(rectOf(f), centreOf(i));
  });
}

/* ---------- view ---------- */
let scale = 1, panX = 0, panY = 0;
const MIN_SCALE = 0.2, MAX_SCALE = 3;      // Miro's range, near enough. 0.4–1.6 was too tight to
                                           // either see the whole document or read a small label
function applyView() {
  const c = $('boardCanvas'); if (!c) return;
  c.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  /* Published for the two bits of furniture that live in board coordinates but must not shrink with
     the board — the selection bar, and the resize grips. At 30% a 24px button is 7px of target. */
  c.style.setProperty('--inv', (1 / scale).toFixed(4));
  const at = $('boardZoomAt'); if (at) at.textContent = Math.round(scale * 100) + '%';
}
function setScale(next, at) {
  const was = scale;
  scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
  if (at && was) {
    panX = at.x - (at.x - panX) * (scale / was);
    panY = at.y - (at.y - panY) * (scale / was);
  }
  applyView();
}
/* Zoom steps are multiplicative, not additive. A fixed ±0.1 is a third of the way from 0.3 to 0.4
   and a thirtieth of the way from 2.9 to 3.0 — the same button doing two different jobs depending
   on where you already are. */
function zoomBy(f, at) { setScale(scale * f, at); }
function boardBounds() {
  const items = board.items || [];
  if (!items.length) return { x: 0, y: 0, w: 1000, h: 700 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  items.forEach(function (i) {
    x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y);
    x1 = Math.max(x1, i.x + i.w); y1 = Math.max(y1, i.y + i.h);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function zoomToFit() {
  const wrap = $('boardCanvasWrap'); if (!wrap) return;
  const b = wrap.getBoundingClientRect(), r = boardBounds(), pad = 60;
  scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min((b.width - pad) / r.w, (b.height - pad) / r.h)));
  panX = (b.width - r.w * scale) / 2 - r.x * scale;
  panY = (b.height - r.h * scale) / 2 - r.y * scale;
  applyView();
}
/* Screen point -> board point. Every pointer handler needs this and getting it wrong is the classic
   canvas bug where things land further from the cursor the more you have panned. */
function toBoard(clientX, clientY) {
  const b = $('boardCanvasWrap').getBoundingClientRect();
  return { x: (clientX - b.left - panX) / scale, y: (clientY - b.top - panY) / scale };
}

/* ---------- tools ---------- */
/* `select` is the home state and every other tool returns to it after one use, which is the rule
   Miro and FigJam both follow: a tool that stays armed is a tool that puts six rectangles on the
   board while you are trying to click things. Hold shift when you place one to stay in the tool. */
let tool = 'select';
let sticky = false;                       // shift-held: stay in the current tool
const TOOLS = [
  { id: 'select', icon: 'mdi-cursor-default-outline', name: 'Select', key: 'V' },
  { id: 'note', icon: 'mdi-note-outline', name: 'Sticky note', key: 'N' },
  { id: 'text', icon: 'mdi-format-text', name: 'Text', key: 'T' },
  { id: 'frame', icon: 'mdi-image-frame', name: 'Frame — a titled box that moves what is inside it', key: 'F' },
  { id: 'rect', icon: 'mdi-rectangle-outline', name: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: 'mdi-ellipse-outline', name: 'Ellipse', key: 'O' },
  { id: 'diamond', icon: 'mdi-rhombus-outline', name: 'Diamond — a decision, in a flowchart', key: 'D' },
  { id: 'arrow', icon: 'mdi-arrow-top-right', name: 'Arrow — drag from one thing to another', key: 'A' },
  { id: 'draw', icon: 'mdi-draw', name: 'Pen — draw anything, freehand', key: 'P' },
  { id: 'erase', icon: 'mdi-eraser', name: 'Eraser — rub out pen marks', key: 'E' }
];
function setTool(t) {
  tool = t;
  const wrap = $('boardCanvasWrap');
  if (wrap) wrap.dataset.tool = t;
  paintTools();
}

/* ---------- undo ----------
   Whole-board snapshots, not a log of inverse operations. A board is a few dozen small objects, so
   a snapshot is a few kilobytes of JSON and the stack is cheaper than the bookkeeping an operation
   log needs — and it cannot drift, which an inverse-operation undo can and does.

   mark() is called BEFORE a change, by the thing about to make it. Continuous gestures mark once,
   lazily, on the first pointermove: otherwise a click that only selects would push a snapshot and
   the student's first Ctrl+Z would appear to do nothing. */
const UNDO_MAX = 60;
let undoStack = [], redoStack = [];
function snapshot() { return JSON.stringify({ items: board.items, links: board.links || [] }); }
function mark() {
  if (!board) return;
  undoStack.push(snapshot());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  redoStack.length = 0;
}
function unmark() { undoStack.pop(); }        // for a change that turned out to be a no-op
function restore(s) {
  const o = JSON.parse(s);
  board.items = o.items; board.links = o.links;
  sel = sel.filter(function (id) { return !!itemById(id); });
  commitEdit();
  saveBoard(); paintBoard();
}
function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }

/* ---------- copy and paste ----------
   Its own clipboard rather than the system one: the board is inside a page with a code editor and a
   chat box in it, and hijacking the real clipboard would mean a student who copied a note could no
   longer paste a line of code. Pasting offsets, so the copy is not hidden under the original. */
let clip = null;
function copySelection() {
  const items = selItems();
  if (items.length) clip = JSON.stringify(items);
}
function pasteClip() {
  if (!clip) return;
  mark();
  const made = [];
  JSON.parse(clip).forEach(function (i) {
    const c = Object.assign({}, i, { id: uid(i.kind), x: i.x + 24, y: i.y + 24 });
    addItem(c); made.push(c.id);
  });
  if (made.length) { sel = made; saveBoard(); paintBoard(); } else unmark();
}

/* ---------- selection ---------- */
let sel = [];
function isSel(id) { return sel.indexOf(id) >= 0; }
function select(ids, add) {
  sel = add ? sel.concat(ids.filter(function (i) { return !isSel(i); })) : ids.slice();
  paintBoard();
}
function clearSel() { if (sel.length) { sel = []; paintBoard(); } }
function selItems() { return sel.map(itemById).filter(Boolean); }

/* Deletes items AND arrows. An arrow selects like anything else — click it, and it is in `sel` — so
   it has to be looked for by its own id here as well as being swept up when one of its ends goes. */
function deleteSelection() {
  if (!sel.length) return;
  mark();
  board.items = board.items.filter(function (i) { return !isSel(i.id); });
  board.links = (board.links || []).filter(function (l) {
    return !isSel(l.id) && !isSel(l.from) && !isSel(l.to);
  });
  sel = [];
  saveBoard(); paintBoard();
}
function duplicateSelection() {
  if (!sel.length) return;
  mark();
  const made = [];
  selItems().forEach(function (i) {
    const c = Object.assign({}, i, { id: uid(i.kind), x: i.x + 24, y: i.y + 24 });
    addItem(c); made.push(c.id);
  });
  if (made.length) { sel = made; saveBoard(); paintBoard(); } else unmark();
}
function colourSelection(c) {
  const items = selItems();
  if (!items.length || items.every(function (i) { return i.colour === c; })) return;
  mark();
  items.forEach(function (i) { i.colour = c; });
  saveBoard(); paintBoard();
}
/* To the front or the back of its own layer. Raising a frame past the notes standing on it would
   hide them, which is never what "bring to front" is being asked for — so frames are re-sorted
   under everything afterwards either way. */
function restack(toFront) {
  if (!sel.length) return;
  mark();
  const picked = selItems(), rest = board.items.filter(function (i) { return !isSel(i.id); });
  const all = toFront ? rest.concat(picked) : picked.concat(rest);
  board.items = all.filter(function (i) { return i.kind === 'frame'; })
    .concat(all.filter(function (i) { return i.kind !== 'frame'; }));
  saveBoard(); paintBoard();
}
function raiseSelection() { restack(true); }
function lowerSelection() { restack(false); }

/* Arrow keys move the selection, which is the one way to line two things up exactly — a drag snaps
   to the grid but a nudge is how you say "one more". A held arrow is one undo step, not forty: the
   run ends when there is a pause. */
let lastNudge = 0;
function nudge(key, big) {
  const items = selItems(); if (!items.length) return;
  const d = big ? GRID * 4 : GRID;
  const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0;
  const dy = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
  if (!dx && !dy) return;
  const now = Date.now();
  if (now - lastNudge > 600) mark();
  lastNudge = now;
  /* Gathered before anything moves, and deduped — otherwise a frame asked what is standing on it
     after it has already moved answers about its new position, and anything selected alongside its
     own frame travels twice as far as everything else. */
  const moving = [];
  items.forEach(function (i) {
    if (moving.indexOf(i) < 0) moving.push(i);
    if (i.kind === 'frame') itemsInFrame(i).forEach(function (c) { if (moving.indexOf(c) < 0) moving.push(c); });
  });
  moving.forEach(function (i) { i.x = snap(i.x + dx); i.y = snap(i.y + dy); });
  saveBoardSoon(); paintBoard();
}

/* ---------- making things ---------- */
/* Frames go UNDER everything, not on top, however late they are drawn. Array order is z-order, so a
   frame drawn round three existing notes would otherwise cover them — and drawing a box round things
   you already have is the main reason anyone reaches for a frame. */
function addItem(o) {
  o.id = o.id || uid(o.kind);
  if (o.kind === 'frame') {
    let n = 0;
    while (n < board.items.length && board.items[n].kind === 'frame') n++;
    board.items.splice(n, 0, o);
  } else {
    board.items.push(o);
  }
  saveBoard();
  return o;
}
/* `what` is a TOOL id, not a kind: rect, ellipse and diamond are all the `shape` kind wearing
   different clothes, and keeping that mapping in one place stops every caller having to know it. */
const SHAPE_TOOLS = ['rect', 'ellipse', 'diamond'];
function defaultsFor(what, pt) {
  const isShape = SHAPE_TOOLS.indexOf(what) >= 0;
  const base = { kind: isShape ? 'shape' : what, x: snap(pt.x - 40), y: snap(pt.y - 20), colour: 'y' };
  if (isShape) return Object.assign(base, { shape: what, text: '', w: 160, h: 100, colour: 'b' });
  if (what === 'note') return Object.assign(base, { title: '', text: '', w: NOTE_W, h: NOTE_H });
  if (what === 'text') return Object.assign(base, { text: '', w: 220, h: 40, colour: '' });
  if (what === 'frame') return Object.assign(base, { title: 'New frame', w: 360, h: 260, colour: 'b' });
  return base;
}
/* Placed at the pointer, then immediately opened for typing. A new sticky you have to click again
   to write in is a new sticky most students leave blank. */
let justPlaced = null;         // see the text commit in startEdit
function placeAt(what, pt) {
  mark();
  const o = addItem(defaultsFor(what, pt));
  justPlaced = o.id;
  paintBoard();
  select([o.id]);
  /* A sticky is typed heading-first, then Enter drops into the body — so the heading is the default
     rather than the thing nobody remembers to go back and add. */
  if (what === 'note') startEdit(o.id, 'title', 'text'); else startEdit(o.id);
  if (!sticky) setTool('select');
  return o;
}

/* ---------- painting ---------- */
function paintBoard() {
  const canvas = $('boardCanvas'); if (!canvas || !board) return;
  canvas.innerHTML = '';
  const b = boardBounds();
  canvas.style.width = Math.max(2000, b.x + b.w + 600) + 'px';
  canvas.style.height = Math.max(1400, b.y + b.h + 600) + 'px';

  paintLinks(canvas);
  (board.items || []).forEach(function (i) { canvas.appendChild(makeEl(i)); });
  paintSelectionBar();
}

function colourClass(c) { return c ? ' c-' + c : ' c-plain'; }

/* A hand-pinned angle, from the id, so a note keeps the same tilt for its whole life and no two
   beside each other land at the same one. Small — 1.5° is enough to say "paper on a wall"; more and
   a column of them looks broken rather than stuck. */
function tiltOf(id) {
  let n = 0;
  for (let k = 0; k < id.length; k++) n = (n * 31 + id.charCodeAt(k)) % 1000;
  return ((n / 1000) * 3 - 1.5).toFixed(2);
}

function makeEl(i) {
  const el = document.createElement('div');
  el.className = 'bi bi-' + i.kind + colourClass(i.colour) + (isSel(i.id) ? ' sel' : '')
    + (i.kind === 'shape' ? ' s-' + i.shape : '');
  el.dataset.id = i.id;
  el.style.left = i.x + 'px'; el.style.top = i.y + 'px';
  el.style.width = i.w + 'px'; el.style.height = i.h + 'px';

  if (i.kind === 'frame') {
    const t = document.createElement('div'); t.className = 'bi-ftitle';
    t.textContent = i.title || 'Frame';
    el.appendChild(t);
  } else if (i.kind === 'note') {
    el.style.setProperty('--rot', tiltOf(i.id) + 'deg');
    /* Every sticky has a heading, whether or not one has been written yet. A note with a heading is
       a thing about something; a note without one is a sentence floating on a board, and a wall of
       those is exactly the mess this workspace exists to prevent. */
    const h = document.createElement('div'); h.className = 'bi-title';
    h.textContent = i.title || 'Heading';
    if (!i.title) h.classList.add('blank');
    el.appendChild(h);
    const p = document.createElement('div'); p.className = 'bi-body';
    p.textContent = i.text || '';
    if (!i.text) { p.classList.add('blank'); p.textContent = 'Write something…'; }
    el.appendChild(p);
  } else if (i.kind === 'ink') {
    /* Drawn into its own bounding box with a viewBox, so resizing the stroke scales it — a squiggle
       behaves like everything else on the board instead of being the one thing you cannot adjust. */
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'bi-inkpath');
    svg.setAttribute('viewBox', '0 0 ' + i.w + ' ' + i.h);
    svg.setAttribute('preserveAspectRatio', 'none');
    const line = document.createElementNS(NS, 'polyline');
    line.setAttribute('points', (i.pts || []).map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
    svg.appendChild(line);
    el.appendChild(svg);
  } else {
    if (i.title && i.kind === 'shape') { const h = document.createElement('div'); h.className = 'bi-title'; h.textContent = i.title; el.appendChild(h); }
    const p = document.createElement('div'); p.className = 'bi-body';
    p.textContent = i.text || '';
    if (!i.text && i.kind === 'text') { p.classList.add('blank'); p.textContent = 'Text'; }
    el.appendChild(p);
  }

  /* Handles only on a selected thing, so a board at rest is notes rather than notes plus furniture.
     Four corners resize; the dots on each edge start an arrow. */
  if (isSel(i.id) && i.kind !== 'text') {
    ['nw', 'ne', 'se', 'sw'].forEach(function (c) {
      const h = document.createElement('i'); h.className = 'bi-grip g-' + c; h.dataset.grip = c;
      el.appendChild(h);
    });
    ['n', 'e', 's', 'w'].forEach(function (c) {
      const h = document.createElement('i'); h.className = 'bi-grip g-' + c + ' side'; h.dataset.grip = c;
      el.appendChild(h);
    });
    /* Turning things is not a power feature here — it is how a drawn arrow gets pointed the right
       way and how a label goes up the side of a level. A frame stays square: a tilted room with
       square things in it is a bug that looks like a feature. */
    if (i.kind !== 'frame') {
      /* Two ways in, because two habits exist. The visible handle hangs BELOW the shape, which is
         where Canva puts it and — more to the point — out from under the selection bar, which sits
         above and used to cover a handle at the top. The four invisible corner patches are
         Photoshop's and Figma's: reach just past a corner and the cursor becomes a turn arrow. */
      const s = document.createElement('i'); s.className = 'bi-spin'; s.dataset.spin = '1';
      el.appendChild(s);
      ['nw', 'ne', 'se', 'sw'].forEach(function (c) {
        const z = document.createElement('i'); z.className = 'bi-rot r-' + c; z.dataset.spin = '1';
        el.appendChild(z);
      });
    }
  }
  if (i.rot) el.style.setProperty('--spin', i.rot + 'deg');
  if (i.kind !== 'frame' && i.kind !== 'ink') {
    ['n', 'e', 's', 'w'].forEach(function (d) {
      const h = document.createElement('i'); h.className = 'bi-port p-' + d; h.dataset.port = d;
      el.appendChild(h);
    });
  }
  return el;
}

/* ---------- links ----------
   One SVG behind everything, redrawn with the board. An arrow is stored as two ids, so it follows
   whatever it is tied to and there is no second copy of a position to keep in step. */
function paintLinks(canvas) {
  const links = board.links || [];
  if (!links.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'bi-links');
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = '<marker id="bArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">'
    + '<path d="M0,0 L9,4.5 L0,9 z" fill="currentColor"/></marker>';
  svg.appendChild(defs);
  links.forEach(function (l) {
    const a = itemById(l.from), b2 = itemById(l.to);
    if (!a || !b2) return;
    const p = edgePoints(a, b2);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'bi-link' + (isSel(l.id) ? ' sel' : ''));
    g.dataset.link = l.id;
    const path = document.createElementNS(NS, 'path');
    const mx = (p.a.x + p.b.x) / 2;
    path.setAttribute('d', 'M' + p.a.x + ',' + p.a.y + ' C' + mx + ',' + p.a.y + ' ' + mx + ',' + p.b.y + ' ' + p.b.x + ',' + p.b.y);
    path.setAttribute('marker-end', 'url(#bArrow)');
    g.appendChild(path);
    if (l.label) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', mx); t.setAttribute('y', (p.a.y + p.b.y) / 2 - 6);
      t.setAttribute('text-anchor', 'middle');
      t.textContent = l.label;
      g.appendChild(t);
    }
    svg.appendChild(g);
  });
  canvas.appendChild(svg);
}
/* Where a line between two boxes should actually touch them: the point on each edge facing the
   other one, so an arrow never starts inside the note it comes from. */
function edgePoints(a, b2) {
  const ca = centreOf(a), cb = centreOf(b2);
  return { a: edgePoint(a, ca, cb), b: edgePoint(b2, cb, ca) };
}
function edgePoint(i, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!dx && !dy) return from;
  const hw = i.w / 2, hh = i.h / 2;
  const t = Math.min(Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

/* ---------- editing text in place ---------- */
let editing = null;
/* `then` is the field to open next, so a new sticky can be typed straight through: heading, Enter,
   body, Ctrl+Enter, done — without a click in between. */
function startEdit(id, which, then) {
  const i = itemById(id); if (!i) return;
  commitEdit();
  const el = $('boardCanvas').querySelector('[data-id="' + id + '"]'); if (!el) return;
  /* A frame has no body — its title is the only text on it, so that is what a double-click opens. */
  const field = which || (i.kind === 'frame' ? 'title' : 'text');
  const ta = document.createElement('textarea');
  ta.className = 'bi-edit' + (field === 'title' ? ' t' : '');
  ta.value = (field === 'title' ? (i.title || '') : (i.text || ''));
  /* IN the layout, not over it. The editor used to be a box stretched across the whole thing, so
     writing a sticky's body hid the heading you were writing it under, and on a frame it blacked
     out the frame. Swapping the one line or paragraph you are editing for a textarea that inherits
     the same font, padding and box means the note does not move or change shape as you type in it —
     which is the difference between editing a note and filling in a field that appeared on top of
     one. Nothing to edit in the layout (a frame's title sits outside the box) falls back to the
     overlay, which is right for those. */
  const slot = el.querySelector(field === 'title' ? '.bi-title' : '.bi-body');
  if (slot) { ta.classList.add('inflow'); slot.replaceWith(ta); } else el.appendChild(ta);
  el.classList.add('editing');
  ta.focus(); ta.select();
  /* A body grows to fit what is in it rather than hiding the end of a sentence behind a scrollbar,
     and the sticky grows with it — up to a point, after which it scrolls like a page. */
  const fit = function () {
    if (field === 'title' || !slot) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 600) + 'px';
    const want = el.scrollHeight;
    if (want > i.h) { i.h = snap(want + 4); el.style.height = i.h + 'px'; }
  };
  fit();
  ta.addEventListener('input', fit);
  const h0 = i.h;
  editing = function (keep) {
    editing = null;
    if (!keep) i.h = h0;            // undo the growing the textarea did while it was open
    const was = field === 'title' ? (i.title || '') : (i.text || '');
    const now = field === 'title' ? ta.value.trim() : ta.value.replace(/\s+$/, '');
    /* One undo step per edit, and only if the text actually changed — opening a note to read it and
       clicking away must not fill the stack with snapshots of nothing. The first words typed into a
       brand-new thing are part of making it, so they fold into the step that made it: one Ctrl+Z
       takes the whole sticky away, which is what a student who just made one by accident wants. */
    if (keep && now !== was) {
      if (i.id === justPlaced) { if (!then) justPlaced = null; } else mark();
      if (field === 'title') i.title = now; else i.text = now;
      saveBoard();
    }
    paintBoard();
    if (keep && then) startEdit(id, then);
  };
  ta.addEventListener('blur', function () { if (editing) editing(true); });
  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); if (editing) editing(false); }
    /* Enter commits on a title and a one-line text; a sticky is a paragraph, so there Enter is a
       newline and Ctrl/Cmd+Enter is the way out. Tab always moves on, which is the habit anyone who
       has filled in a form already has. */
    if (e.key === 'Tab' || (e.key === 'Enter' && (field === 'title' || i.kind === 'text' || e.ctrlKey || e.metaKey))) {
      e.preventDefault(); if (editing) editing(true);
    }
    e.stopPropagation();
  });
}
function commitEdit() { if (editing) editing(true); }

/* ---------- the tool rail ---------- */
function paintTools() {
  const host = $('boardPalette'); if (!host) return;
  host.innerHTML = '';
  const btn = function (icon, name, on, fn, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'board-tool' + (on ? ' on' : '') + (cls ? ' ' + cls : '');
    b.title = name; b.setAttribute('aria-label', name);
    b.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    b.addEventListener('click', fn);
    host.appendChild(b);
    return b;
  };
  /* Grouped: the pointer · things you write in · things you draw with · the freehand pair. */
  TOOLS.forEach(function (t, n) {
    btn(t.icon, t.name + '  (' + t.key + ')', tool === t.id, function () { setTool(t.id); });
    if (n === 0 || n === 2 || n === 7) { const s = document.createElement('span'); s.className = 'board-tool-gap'; host.appendChild(s); }
  });
  const s = document.createElement('span'); s.className = 'board-tool-gap'; host.appendChild(s);
  btn('mdi-broom', 'Tidy the loose notes into a grid', false, function () { tidy(); });
}

/* The bar that appears over a selection: colour, duplicate, bring to front, delete. Over the
   selection rather than in the rail, because these act on a thing rather than arming a mode — and
   a student should not have to find the far side of the screen to change a note's colour. */
function paintSelectionBar() {
  const old = document.querySelector('.bi-bar'); if (old) old.remove();
  if (!sel.length) return;
  const items = selItems();
  /* An arrow is selectable too, and it used to get nothing — you clicked it, the bar did not
     appear, and there was no way to label or remove it except the keyboard. It gets the two things
     an arrow can be asked for. */
  if (!items.length) { paintLinkBar(); return; }
  let x0 = Infinity, y0 = Infinity;
  items.forEach(function (i) { x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); });
  const bar = document.createElement('div');
  bar.className = 'bi-bar';
  /* Anchored to the top-left of the selection; the CSS lifts it clear and un-scales it, so the bar
     is the same size on screen at 30% as at 300%. */
  bar.style.left = x0 + 'px'; bar.style.top = y0 + 'px';
  /* The colour they are all on already, if they agree — shown as a ring, so the bar says what the
     selection IS as well as what it could become. */
  const shared = items.every(function (i) { return (i.colour || '') === (items[0].colour || ''); })
    ? (items[0].colour || '') : null;
  const swatches = document.createElement('span');
  swatches.className = 'bi-swatches';
  COLOURS.forEach(function (c) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'bi-swatch' + colourClass(c) + (shared === c ? ' on' : '');
    s.title = c ? 'Colour' : 'No colour';
    s.setAttribute('aria-label', c ? 'Colour' : 'No colour');
    s.addEventListener('click', function (e) { e.stopPropagation(); colourSelection(c); });
    swatches.appendChild(s);
  });
  bar.appendChild(swatches);
  const gap = document.createElement('span'); gap.className = 'bi-bargap'; bar.appendChild(gap);
  const act = function (icon, name, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bi-act'; b.title = name; b.setAttribute('aria-label', name);
    b.innerHTML = '<span class="mdi ' + icon + '"></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    bar.appendChild(b);
  };
  if (items.length === 1 && items[0].kind !== 'text') {
    act('mdi-format-title', 'Rename — give it a title', function () { startEdit(items[0].id, 'title'); });
  }
  act('mdi-content-copy', 'Duplicate', duplicateSelection);
  act('mdi-flip-to-front', 'Bring to front', raiseSelection);
  act('mdi-trash-can-outline', 'Delete', deleteSelection);
  $('boardCanvas').appendChild(bar);
}

/* The same bar, for a selected arrow: put it at the midpoint of the line it belongs to. */
function paintLinkBar() {
  const l = (board.links || []).filter(function (x) { return isSel(x.id); })[0];
  if (!l) return;
  const a = itemById(l.from), b2 = itemById(l.to);
  if (!a || !b2) return;
  const p = edgePoints(a, b2);
  const bar = document.createElement('div');
  bar.className = 'bi-bar';
  bar.style.left = ((p.a.x + p.b.x) / 2) + 'px';
  bar.style.top = ((p.a.y + p.b.y) / 2) + 'px';
  const act = function (icon, name, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bi-act'; b.title = name; b.setAttribute('aria-label', name);
    b.innerHTML = '<span class="mdi ' + icon + '"></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    bar.appendChild(b);
  };
  act('mdi-label-outline', l.label ? 'Change what this arrow says' : 'Say what this arrow means',
    function () { labelLink(l.id); });
  act('mdi-trash-can-outline', 'Delete this arrow', deleteSelection);
  $('boardCanvas').appendChild(bar);
}

/* ---------- the right-click menu ----------
   Every one of these has another way in — a button on the selection bar, a key, the rail — and that
   is the point: the menu is where a student who does not yet know any of those finds out that they
   exist, with the key written next to the name. It is positioned in screen pixels rather than board
   ones, so it is never half a millimetre tall at 20% zoom. */
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function openMenu(e) {
  closeMenu();
  commitEdit();
  const pt = toBoard(e.clientX, e.clientY);
  const el = e.target.closest('.bi');
  const lk = e.target.closest('.bi-link');

  /* Right-clicking something that is not in the selection selects it first — otherwise Delete in
     the menu would act on whatever happened to be selected across the board. */
  if (el && !isSel(el.dataset.id)) select([el.dataset.id]);
  else if (lk && !isSel(lk.dataset.link)) select([lk.dataset.link]);
  else if (!el && !lk) clearSel();

  const rows = [];
  const one = selItems().length === 1 ? selItems()[0] : null;
  if (el) {
    if (one && one.kind !== 'ink') {
      rows.push(['mdi-pencil-outline', 'Edit text', '', function () { startEdit(one.id, one.kind === 'frame' ? 'title' : 'text'); }]);
      if (one.kind === 'note' || one.kind === 'shape') {
        rows.push(['mdi-format-title', 'Edit heading', '', function () { startEdit(one.id, 'title'); }]);
      }
    }
    rows.push(['mdi-content-copy', 'Duplicate', 'Ctrl+D', duplicateSelection]);
    rows.push(['mdi-content-cut', 'Cut', 'Ctrl+X', function () { copySelection(); deleteSelection(); }]);
    rows.push(null);
    rows.push(['mdi-flip-to-front', 'Bring to front', '', raiseSelection]);
    rows.push(['mdi-flip-to-back', 'Send to back', '', lowerSelection]);
    rows.push(null);
    rows.push(['mdi-trash-can-outline', 'Delete', 'Del', deleteSelection]);
  } else if (lk) {
    rows.push(['mdi-label-outline', 'Label this arrow', '', function () { labelLink(lk.dataset.link); }]);
    rows.push(null);
    rows.push(['mdi-trash-can-outline', 'Delete', 'Del', deleteSelection]);
  } else {
    rows.push(['mdi-note-outline', 'New sticky note here', 'N', function () { placeAt('note', pt); }]);
    rows.push(['mdi-image-frame', 'New frame here', 'F', function () { placeAt('frame', pt); }]);
    if (clip) rows.push(['mdi-content-paste', 'Paste', 'Ctrl+V', pasteClip]);
    rows.push(null);
    rows.push(['mdi-broom', 'Tidy the loose notes', '', tidy]);
    rows.push(['mdi-select-all', 'Select everything', 'Ctrl+A', function () {
      select((board.items || []).map(function (i) { return i.id; }));
    }]);
    rows.push(['mdi-overscan', 'Fit the board on screen', '0', zoomToFit]);
  }

  const m = document.createElement('div');
  m.className = 'bi-menu';
  rows.forEach(function (r) {
    if (!r) { const s = document.createElement('span'); s.className = 'bi-menu-gap'; m.appendChild(s); return; }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bi-menu-row';
    b.innerHTML = '<span class="mdi ' + r[0] + '"></span><span class="bi-menu-lab"></span>'
      + '<span class="bi-menu-key"></span>';
    b.querySelector('.bi-menu-lab').textContent = r[1];
    b.querySelector('.bi-menu-key').textContent = r[2];
    b.addEventListener('click', function () { closeMenu(); r[3](); });
    m.appendChild(b);
  });

  const wrap = $('boardCanvasWrap'), wb = wrap.getBoundingClientRect();
  wrap.appendChild(m);
  /* Flipped rather than clipped when it would run off the pane — a menu you have to scroll the page
     to read is a menu nobody presses the last item on. */
  const mb = m.getBoundingClientRect();
  let x = e.clientX - wb.left, y = e.clientY - wb.top;
  if (x + mb.width > wb.width - 6) x = Math.max(6, x - mb.width);
  if (y + mb.height > wb.height - 6) y = Math.max(6, y - mb.height);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  menuEl = m;
}
document.addEventListener('pointerdown', function (e) {
  if (menuEl && !e.target.closest('.bi-menu')) closeMenu();
}, true);

/* ---------- tidy ----------
   Straightens things WHERE THEY ARE. The first version swept every loose note into a grid below the
   whole board, which is not tidying — it is taking your things away: a student pressed it to line up
   four stickies and had to hunt for them off the bottom of a board they could no longer see.

   So: tidy works on the selection if there is one, otherwise on everything loose; it lays them out
   in reading order starting from the cluster's own top-left corner, in as many columns as the
   cluster was already wide; and it leaves anything inside a frame alone, because that arrangement
   is the work. */
function tidy() {
  const chosen = selItems().filter(function (i) { return i.kind !== 'frame'; });
  const group = chosen.length > 1 ? chosen : (board.items || []).filter(function (i) {
    return i.kind !== 'frame' && i.kind !== 'ink' && !frameAt(centreOf(i), i.id);
  });
  if (group.length < 2) return;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity;
  group.forEach(function (i) {
    x0 = Math.min(x0, i.x); y0 = Math.min(y0, i.y); x1 = Math.max(x1, i.x + i.w);
  });
  const colW = Math.max.apply(null, group.map(function (i) { return i.w; })) + 20;
  const rowH = Math.max.apply(null, group.map(function (i) { return i.h; })) + 20;
  const cols = Math.max(1, Math.min(group.length, Math.round((x1 - x0) / colW) || 1));

  /* Reading order, by where each thing already is — so a tidy rearranges as little as it can and
     nothing swaps places with something across the board. */
  const rowOf = function (i) { return Math.round(i.y / rowH); };
  const order = group.slice().sort(function (a, b) { return rowOf(a) - rowOf(b) || a.x - b.x; });

  mark();
  order.forEach(function (i, n) {
    i.x = snap(x0 + (n % cols) * colW);
    i.y = snap(y0 + Math.floor(n / cols) * rowH);
  });
  saveBoard(); paintBoard();
}

/* ---------- pointer ----------
   One handler for the whole canvas. Which gesture you get is decided by what is under the pointer
   and which tool is armed, in that order — the same rule every canvas app uses, and the one nobody
   has to be told about. */
function onPointerDown(e) {
  if (e.button !== 0) return;
  /* The furniture is INSIDE the canvas wrap — the tool rail, the zoom bar, and the bar that appears
     over a selection — so its clicks arrive here first. Left to run, this handler cleared the
     selection and repainted, which destroyed the very button the student was pressing before its
     click event could fire: the colour swatches and the rename button did nothing at all, and a
     tool click landed a stray sticky under the rail. The furniture keeps its own clicks. */
  if (e.target.closest('.board-palette,.board-zoom,.bi-bar')) return;

  const wrap = $('boardCanvasWrap');
  const pt = toBoard(e.clientX, e.clientY);
  sticky = e.shiftKey;

  const linkEl = e.target.closest('.bi-link');
  const el = e.target.closest('.bi');
  const grip = e.target.closest('.bi-grip');
  const port = e.target.closest('.bi-port');
  const spin = e.target.closest('[data-spin]');

  commitEdit();

  if (spin && el) { beginSpin(itemById(el.dataset.id), e); return; }

  // the freehand pair are gestures, not objects placed by a click
  if (tool === 'draw' && !grip) { beginDraw(e); return; }
  if (tool === 'erase') { beginErase(e); return; }

  // a placing tool: one click, one object
  if (tool !== 'select' && tool !== 'arrow' && !grip && !port) { placeAt(tool, pt); return; }

  if (tool === 'arrow' && el) { beginLink(el.dataset.id, e); return; }
  if (port && el) { beginLink(el.dataset.id, e); return; }
  if (grip && el) { beginResize(itemById(el.dataset.id), grip.dataset.grip, e); return; }

  if (linkEl) { select([linkEl.dataset.link]); return; }

  if (el) {
    const id = el.dataset.id;
    if (!isSel(id)) select([id], e.shiftKey || e.metaKey || e.ctrlKey);
    beginDrag(e);
    return;
  }

  // empty canvas: clear, then rubber-band
  if (!e.shiftKey) clearSel();
  beginMarquee(e);
}

function beginDrag(e) {
  const wrap = $('boardCanvasWrap');
  const start = toBoard(e.clientX, e.clientY);
  /* A frame takes what is standing on it. Captured once, at the start, so a note that leaves the
     frame mid-drag is not dropped halfway. */
  const moving = [];
  selItems().forEach(function (i) {
    moving.push(i);
    if (i.kind === 'frame') itemsInFrame(i).forEach(function (c) { if (moving.indexOf(c) < 0) moving.push(c); });
  });
  const from = moving.map(function (i) { return { i: i, x: i.x, y: i.y }; });
  wrap.setPointerCapture(e.pointerId);
  let marked = false;
  const move = function (ev) {
    if (!marked) { mark(); marked = true; }     // a click that only selects is not a change
    const p = toBoard(ev.clientX, ev.clientY);
    const dx = p.x - start.x, dy = p.y - start.y;
    from.forEach(function (f) { f.i.x = snap(f.x + dx); f.i.y = snap(f.y + dy); });
    paintBoard();
    saveBoardSoon();
  };
  const up = function () {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    saveBoard(); paintBoard();
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

function beginResize(i, grip, e) {
  if (!i) return;
  const wrap = $('boardCanvasWrap');
  const start = toBoard(e.clientX, e.clientY);
  const o = { x: i.x, y: i.y, w: i.w, h: i.h };
  wrap.setPointerCapture(e.pointerId);
  let marked = false;
  const move = function (ev) {
    if (!marked) { mark(); marked = true; }
    const p = toBoard(ev.clientX, ev.clientY);
    const dx = p.x - start.x, dy = p.y - start.y;
    /* Grips are named by compass point, so the letters ARE the answer: a corner carries two and a
       side carries one, and the same three lines handle all eight. */
    const west = grip.indexOf('w') >= 0, east = grip.indexOf('e') >= 0;
    const north = grip.indexOf('n') >= 0, south = grip.indexOf('s') >= 0;
    let w = east ? o.w + dx : west ? o.w - dx : o.w;
    let h = south ? o.h + dy : north ? o.h - dy : o.h;
    w = Math.max(40, snap(w)); h = Math.max(32, snap(h));
    i.w = w; i.h = h;
    i.x = snap(west ? o.x + (o.w - w) : o.x);
    i.y = snap(north ? o.y + (o.h - h) : o.y);
    paintBoard(); saveBoardSoon();
  };
  const up = function () {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    saveBoard(); paintBoard();
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

/* Turning. The angle is measured from the item's own centre, so the thing spins where it stands
   rather than swinging around the pointer — and it snaps to 15° unless a key is held, because a
   label at 43° is almost always a label somebody meant to put at 45°. */
function beginSpin(i, e) {
  if (!i) return;
  const wrap = $('boardCanvasWrap');
  const c = centreOf(i);
  const angle = function (ev) {
    const p = toBoard(ev.clientX, ev.clientY);
    return Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI + 90;
  };
  const from = angle(e), was = i.rot || 0;
  wrap.setPointerCapture(e.pointerId);
  let marked = false;
  const move = function (ev) {
    if (!marked) { mark(); marked = true; }
    let a = was + (angle(ev) - from);
    if (!ev.altKey) a = Math.round(a / 15) * 15;
    i.rot = Math.round(((a % 360) + 360) % 360);
    if (i.rot === 0) delete i.rot;
    paintBoard(); saveBoardSoon();
  };
  const up = function () {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    saveBoard(); paintBoard();
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

/* An arrow is drawn by dragging from one thing to another, which is how every board does it. The
   line follows the pointer while you drag so it is obvious what is being connected. */
let ghost = null;
function beginLink(fromId, e) {
  const wrap = $('boardCanvasWrap');
  wrap.setPointerCapture(e.pointerId);
  const move = function (ev) {
    const p = toBoard(ev.clientX, ev.clientY);
    drawGhost(itemById(fromId), p);
  };
  const up = function (ev) {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    if (ghost) { ghost.remove(); ghost = null; }
    const over = document.elementFromPoint(ev.clientX, ev.clientY);
    const target = over && over.closest ? over.closest('.bi') : null;
    const toId = target ? target.dataset.id : null;
    if (toId && toId !== fromId) {
      mark();
      board.links.push({ id: uid('l'), from: fromId, to: toId, label: '' });
      saveBoard();
    }
    if (!sticky) setTool('select');
    paintBoard();
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}
function drawGhost(from, pt) {
  if (!from) return;
  const canvas = $('boardCanvas');
  if (!ghost) {
    ghost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ghost.setAttribute('class', 'bi-links ghost');
    canvas.appendChild(ghost);
  }
  const a = edgePoint(from, centreOf(from), pt);
  ghost.innerHTML = '<path d="M' + a.x + ',' + a.y + ' L' + pt.x + ',' + pt.y + '"/>';
}

/* ---------- the pen, and the eraser ----------
   A board you can only put boxes on is a form. Half of what a twelve-year-old wants to say about a
   game is a shape of a level, an arrow through a jump, a face — and none of that is a sticky note.

   A stroke becomes an ordinary item the moment the pointer lifts: it selects, moves, recolours,
   resizes and deletes like everything else, and the points are stored relative to its own box so
   all of that works without any special cases anywhere else in the file. */
const INK_NS = 'http://www.w3.org/2000/svg';
function beginDraw(e) {
  const wrap = $('boardCanvasWrap'), canvas = $('boardCanvas');
  const pts = [];
  const add = function (ev) {
    const p = toBoard(ev.clientX, ev.clientY);
    const last = pts[pts.length - 1];
    /* Dropped points that are within a pixel of the last one: a slow hand otherwise produces a
       thousand-point path for a two-inch line, and that is what gets saved. */
    if (last && Math.abs(last[0] - p.x) < 1.5 && Math.abs(last[1] - p.y) < 1.5) return;
    pts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
  };
  add(e);
  const live = document.createElementNS(INK_NS, 'svg');
  live.setAttribute('class', 'bi-links ink-live');
  canvas.appendChild(live);
  wrap.setPointerCapture(e.pointerId);
  const move = function (ev) {
    add(ev);
    live.innerHTML = '<polyline points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>';
  };
  const up = function () {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    live.remove();
    if (pts.length >= 2) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(function (p) {
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
      });
      const pad = 6;              // room for the stroke itself, so a line is not clipped by its box
      mark();
      const o = addItem({
        kind: 'ink', colour: '', x: x0 - pad, y: y0 - pad,
        w: Math.max(8, (x1 - x0) + pad * 2), h: Math.max(8, (y1 - y0) + pad * 2),
        pts: pts.map(function (p) { return [+(p[0] - x0 + pad).toFixed(1), +(p[1] - y0 + pad).toFixed(1)]; })
      });
      saveBoard();
      paintBoard();
      if (!sticky) { setTool('select'); select([o.id]); }
      return;
    }
    if (!sticky) setTool('select');
    paintBoard();
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

/* Rubs out pen marks and nothing else. An eraser that also took away notes would be the second
   delete, and a student who picked it up to fix a line would lose a paragraph. */
function beginErase(e) {
  const wrap = $('boardCanvasWrap');
  wrap.setPointerCapture(e.pointerId);
  let marked = false;
  const rub = function (ev) {
    const p = toBoard(ev.clientX, ev.clientY);
    const r = 12 / scale;         // a constant size under the pointer, whatever the zoom
    const gone = (board.items || []).filter(function (i) {
      return i.kind === 'ink' && inside({ x: i.x - r, y: i.y - r, w: i.w + r * 2, h: i.h + r * 2 }, p)
        && (i.pts || []).some(function (q) {
          const dx = i.x + q[0] - p.x, dy = i.y + q[1] - p.y;
          return dx * dx + dy * dy < r * r;
        });
    });
    if (!gone.length) return;
    if (!marked) { mark(); marked = true; }
    board.items = board.items.filter(function (i) { return gone.indexOf(i) < 0; });
    saveBoardSoon(); paintBoard();
  };
  rub(e);                         // a single click rubs out what is under it
  const up = function () {
    wrap.removeEventListener('pointermove', rub); wrap.removeEventListener('pointerup', up);
    if (marked) saveBoard();
    if (!sticky) setTool('select');
  };
  wrap.addEventListener('pointermove', rub); wrap.addEventListener('pointerup', up);
}

function beginMarquee(e) {
  const wrap = $('boardCanvasWrap'), canvas = $('boardCanvas');
  const start = toBoard(e.clientX, e.clientY);
  const box = document.createElement('div'); box.className = 'bi-marquee';
  canvas.appendChild(box);
  wrap.setPointerCapture(e.pointerId);
  const move = function (ev) {
    const p = toBoard(ev.clientX, ev.clientY);
    const r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    box.style.left = r.x + 'px'; box.style.top = r.y + 'px';
    box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
    box.__r = r;
  };
  const up = function () {
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
    const r = box.__r; box.remove();
    if (r && r.w > 6 && r.h > 6) {
      select((board.items || []).filter(function (i) { return inside(r, centreOf(i)); })
        .map(function (i) { return i.id; }));
    }
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

/* Panning is the middle button, space-drag, or a two-finger scroll — never a plain left-drag, which
   belongs to the marquee. */
function beginPan(e) {
  const wrap = $('boardCanvasWrap');
  wrap.classList.add('panning');
  wrap.setPointerCapture(e.pointerId);
  const sx = e.clientX - panX, sy = e.clientY - panY;
  const move = function (ev) { panX = ev.clientX - sx; panY = ev.clientY - sy; applyView(); };
  const up = function () {
    wrap.classList.remove('panning');
    wrap.removeEventListener('pointermove', move); wrap.removeEventListener('pointerup', up);
  };
  wrap.addEventListener('pointermove', move); wrap.addEventListener('pointerup', up);
}

/* ---------- what a lesson can check ----------
   The board is no longer a file, so `contains: {file: design.md}` cannot see it. This is what a
   `yourturn` asks instead — see board_contains in js/project.js. */
function boardText() {
  if (!board) board = loadBoard();
  const bits = [];
  (board.items || []).forEach(function (i) {
    if (i.title) bits.push(i.title);
    if (i.text) bits.push(i.text);
  });
  (board.links || []).forEach(function (l) { if (l.label) bits.push(l.label); });
  return bits.join('\n');
}
function boardItemCount(kind) {
  if (!board) board = loadBoard();
  return (board.items || []).filter(function (i) {
    return !kind || i.kind === kind;
  }).length;
}

/* ---------- what the coach is told, and what it may do ---------- */
function boardPayload() {
  if (!board) board = loadBoard();
  const f = (typeof flat !== 'undefined' && typeof curIdx === 'number' && flat[curIdx]) ? flat[curIdx] : null;
  const frames = (board.items || []).filter(function (i) { return i.kind === 'frame'; });
  return {
    title: 'Design board',
    lesson: f ? (f.l.t || f.id) : '',
    /* Every note goes out WITH ITS ID. Without ids the coach could only ever add — it could see a
       note that was wrong and not fix it, which is most of what "help me with this" turns out to
       mean once a board has anything on it. */
    frames: frames.map(function (fr) {
      return {
        title: fr.title || 'Frame',
        notes: itemsInFrame(fr).filter(function (i) { return i.title || i.text; })
          .slice(0, 24).map(function (i) {
            return { id: i.id, title: (i.title || '').slice(0, 80), text: (i.text || '').slice(0, 300) };
          })
      };
    }),
    loose: (board.items || []).filter(function (i) {
      return i.kind !== 'frame' && (i.title || i.text) && !frameAt(centreOf(i), i.id);
    }).slice(0, 24).map(function (i) {
      return { id: i.id, title: (i.title || '').slice(0, 80), text: (i.text || '').slice(0, 300) };
    })
  };
}

/* ---------- the coach's hands ----------
   It proposes actions, the browser applies them — the same shape as the coder agent's `ops`, and
   for the same reason: a model that returns an instruction the client validates can be wrong
   without being dangerous. Five ops, which between them are everything a person could do to a
   board of stickies: add one, change one, move one, throw one away, and add a section.

   Every batch is ONE undo step, so a student who did not want what just landed presses Ctrl+Z once.
   That is what makes it safe to let the coach do real work rather than ask permission first. */
const APPLY_MAX = 28;            // a reply cannot rewrite the whole board in one go by accident

function frameByTitle(t) {
  const want = String(t || '').trim().toLowerCase();
  if (!want) return null;
  const frames = (board.items || []).filter(function (i) { return i.kind === 'frame'; });
  return frames.filter(function (i) { return String(i.title || '').trim().toLowerCase() === want; })[0]
    /* A near miss is a typo, not a refusal: "To-do" and "todo" both mean To do, and a student
       watching nothing happen cannot tell the difference between that and a broken feature. */
    || frames.filter(function (i) {
      const a = String(i.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return a && a === want.replace(/[^a-z0-9]/g, '');
    })[0] || null;
}
/* Only notes the coach may touch: its own kind of object, never a frame, a drawing or a shape the
   student built by hand. */
function coachNote(id) {
  const i = itemById(String(id || ''));
  return (i && i.kind === 'note') ? i : null;
}

function boardApply(ops) {
  if (!board || !ops || !ops.length) return 0;
  mark();
  let n = 0, made = [];
  /* Where unframed notes land, worked out ONCE — the board's bounds grow with every note added, so
     asking again each time walks the next one further down the page. */
  const b0 = boardBounds();
  const loose = { x: snap(b0.x), y: snap(b0.y + b0.h + 48), n: 0 };
  const freeSpotLoose = function () {
    const k = loose.n++;
    return { x: loose.x + (k % 5) * (NOTE_W + 16), y: loose.y + Math.floor(k / 5) * (NOTE_H + 16) };
  };
  ops.slice(0, APPLY_MAX).forEach(function (op) {
    if (!op || typeof op !== 'object') return;

    if (op.putNote) {
      const fr = frameByTitle(op.putNote.frame);
      /* No frame named, or a name that matches nothing: it goes loose in clear space rather than
         being dropped. A note in the wrong place can be dragged; a note that never arrived cannot. */
      const spot = fr ? freeSpotIn(fr) : freeSpotLoose();
      made.push(addItem(Object.assign(defaultsFor('note', spot), {
        title: String(op.putNote.title || '').slice(0, 60),
        text: String(op.putNote.text || '').slice(0, 400),
        colour: COLOURS.indexOf(op.putNote.colour) >= 0 ? op.putNote.colour : 'y'
      })).id);
      n++;
      return;
    }

    if (op.editNote) {
      const i = coachNote(op.editNote.id);
      if (!i) return;
      if (typeof op.editNote.title === 'string') i.title = op.editNote.title.slice(0, 60);
      if (typeof op.editNote.text === 'string') i.text = op.editNote.text.slice(0, 400);
      if (COLOURS.indexOf(op.editNote.colour) >= 0) i.colour = op.editNote.colour;
      made.push(i.id); n++;
      return;
    }

    /* Moving one note into another frame is how cutting actually happens: "that is a great idea for
       later" is a drag from Mechanics into Not building — next time, and asking a twelve-year-old to
       do the drag themselves is asking them to agree with you twice. */
    if (op.moveNote) {
      const i = coachNote(op.moveNote.id);
      const fr = frameByTitle(op.moveNote.frame);
      if (!i || !fr) return;
      const spot = freeSpotIn(fr);
      i.x = snap(spot.x); i.y = snap(spot.y);
      made.push(i.id); n++;
      return;
    }

    if (op.deleteNote) {
      const i = coachNote(op.deleteNote.id);
      if (!i) return;
      board.items = board.items.filter(function (x) { return x !== i; });
      board.links = (board.links || []).filter(function (l) { return l.from !== i.id && l.to !== i.id; });
      n++;
      return;
    }

    if (op.addFrame) {
      const b = boardBounds();
      made.push(addItem(Object.assign(defaultsFor('frame', { x: b.x + b.w + 60, y: b.y }), {
        title: String(op.addFrame.title || 'New frame').slice(0, 60),
        w: 420, h: 300,
        colour: COLOURS.indexOf(op.addFrame.colour) >= 0 ? op.addFrame.colour : 'b'
      })).id);
      n++;
    }
  });

  if (!n) { unmark(); return 0; }
  saveBoard();
  paintBoard();
  /* Flashed, not silently inserted. The student is reading a message on the other side of the
     screen while this happens, and a board that changed behind their back is a board they stop
     trusting. `landed` fades after a second and a half. */
  made.forEach(function (id) {
    const el = $('boardCanvas').querySelector('[data-id="' + id + '"]');
    if (el) el.classList.add('landed');
  });
  return n;
}
/* Somewhere inside a frame nothing is already sitting. Rows first, then a new row. */
function freeSpotIn(f) {
  const taken = itemsInFrame(f);
  const perRow = Math.max(1, Math.floor((f.w - 24) / (NOTE_W + 16)));
  const k = taken.length;
  return {
    x: f.x + 16 + (k % perRow) * (NOTE_W + 16),
    y: f.y + 36 + Math.floor(k / perRow) * (NOTE_H + 16)
  };
}

/* ---------- showing it ----------
   A tab, not a dialog: switchView calls this every time the Design tab is shown. Loaded once and
   kept, so panning and selection survive a trip to the Code tab. */
let fitAt = '';                // pane size the last fit was computed for; not saved, so every fresh
                               // page load fits once
function showBoard() {
  if (!board) board = loadBoard();
  paintTools();
  paintBoard();
  /* Fit once, and again if the pane is a different size than when we last did. Not every time: that
     would throw away wherever the student had panned to.

     On the NEXT frame, because switchView hides the console dock on the way in and the pane is
     still the old height when this runs — fitting against it makes the board arrive smaller than
     it needs to be, and short by exactly the height of a dock nobody can see. */
  requestAnimationFrame(function () {
    const r = $('boardCanvasWrap').getBoundingClientRect();
    const w = Math.round(r.width) + 'x' + Math.round(r.height);
    if (fitAt !== w) { zoomToFit(); fitAt = w; }
  });
}

/* ---------- wiring, once, at load ---------- */
if ($('boardCanvasWrap')) {
  const wrap = $('boardCanvasWrap');
  /* Pan is the middle button or space-drag. The right button is a menu, not a hand: it briefly did
     the panning too, and that cost the one gesture everybody already knows for "what can I do with
     this thing". */
  wrap.addEventListener('pointerdown', function (e) {
    if (e.button === 1 || spaceDown) { beginPan(e); e.preventDefault(); return; }
    if (e.button === 2) return;                  // handled by contextmenu, below
    onPointerDown(e);
  });
  wrap.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.board-palette,.board-zoom')) return;   // let the browser's menu alone
    e.preventDefault();
    openMenu(e);
  });
  wrap.addEventListener('dblclick', function (e) {
    if (e.target.closest('.board-palette,.board-zoom,.bi-bar')) return;
    const el = e.target.closest('.bi');
    /* Whichever half was double-clicked is the half that opens. Double-clicking a sticky's heading
       and getting the body instead is the sort of thing that teaches a student the board is not
       listening to them. */
    if (el) { startEdit(el.dataset.id, e.target.closest('.bi-title') ? 'title' : null); return; }
    const lk = e.target.closest('.bi-link');
    if (lk) { labelLink(lk.dataset.link); return; }
    /* Double-clicking nothing makes a sticky there, which is the one shortcut every board has. */
    placeAt('note', toBoard(e.clientX, e.clientY));
  });
  /* A plain scroll pans, which is what a trackpad user expects and what every board does. Zoom is
     ctrl/⌘+wheel — a trackpad pinch arrives as exactly that, so pinching works for free. */
  wrap.addEventListener('wheel', function (e) {
    if (e.target.closest('.bi-edit')) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const b = wrap.getBoundingClientRect();
      zoomBy(e.deltaY > 0 ? 0.9 : 1.1, { x: e.clientX - b.left, y: e.clientY - b.top });
      return;
    }
    panX -= e.deltaX; panY -= e.deltaY; applyView();
  }, { passive: false });
}
if ($('boardZoomIn')) $('boardZoomIn').addEventListener('click', function () { zoomBy(1.2); });
if ($('boardZoomOut')) $('boardZoomOut').addEventListener('click', function () { zoomBy(1 / 1.2); });
if ($('boardFit')) $('boardFit').addEventListener('click', zoomToFit);

function labelLink(id) {
  const l = (board.links || []).filter(function (x) { return x.id === id; })[0];
  if (!l || typeof modal !== 'function') return;
  modal({
    title: 'What does this arrow mean?',
    message: 'A word or two — "makes it harder", "happens after", "needs".',
    input: true, placeholder: l.label || 'makes it harder', okLabel: 'Save',
    onOk: function (v) { mark(); l.label = String(v || '').slice(0, 40); saveBoard(); paintBoard(); }
  });
}

/* Keyboard. Only while the Design tab is showing and nothing is being typed into, so a shortcut
   can never fire from the Code editor or a lesson's answer box. */
let spaceDown = false;
document.addEventListener('keydown', function (e) {
  const v = $('view-design');
  if (!v || v.hidden) return;
  const t = e.target;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
  if (e.key === ' ') { spaceDown = true; return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.key === 'Escape') { setTool('select'); clearSel(); return; }
  /* The keys everybody already knows. A student who has used anything else on a computer will try
     Ctrl+Z here before they try any button in the rail, and a board that does not answer it is a
     board they will be careful on instead of playing with. */
  if (e.ctrlKey || e.metaKey) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
    if (k === 'c') { e.preventDefault(); copySelection(); return; }
    if (k === 'x') { e.preventDefault(); copySelection(); deleteSelection(); return; }
    if (k === 'v') { e.preventDefault(); pasteClip(); return; }
    if (k === 'd') { e.preventDefault(); duplicateSelection(); return; }
    if (k === 'a') {
      e.preventDefault(); select((board.items || []).map(function (i) { return i.id; })); return;
    }
    return;
  }
  if (e.altKey) return;
  if (e.key.indexOf('Arrow') === 0) { e.preventDefault(); nudge(e.key, e.shiftKey); return; }
  const hit = TOOLS.filter(function (x) { return x.key.toLowerCase() === e.key.toLowerCase(); })[0];
  if (hit) { setTool(hit.id); return; }
  if (e.key === '+' || e.key === '=') zoomBy(1.2);
  if (e.key === '-') zoomBy(1 / 1.2);
  if (e.key === '0') zoomToFit();
});
document.addEventListener('keyup', function (e) { if (e.key === ' ') spaceDown = false; });
