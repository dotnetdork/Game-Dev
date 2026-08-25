/* ui.js — Shared UI bits (toast, modal, panel resizers) and the boot sequence that starts the app. */
/* ---------- toast + modal ---------- */
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200); }
/* opts: title, message (plain sentence, wrapped in a <p>), html (block markup, NOT wrapped —
   `message` goes inside a <p>, so a grid or a list in there gets broken out of it by the parser),
   input, placeholder, okLabel, hideCancel (for a dialog that only closes), wide (for content that
   needs columns rather than one 420px lane), onOk. */
function modal(opts) {
  const back = $('modalBack');
  back.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '"><h3>' + opts.title + '</h3>'
    + (opts.message ? '<p>' + opts.message + '</p>' : '')
    + (opts.html || '')
    + (opts.input ? '<input id="modalInput" placeholder="' + (opts.placeholder || '') + '">' : '')
    + '<div class="acts">'
    + (opts.hideCancel ? '' : '<button class="cancel" id="modalCancel">Cancel</button>')
    + '<button class="ok" id="modalOk">' + (opts.okLabel || 'OK') + '</button></div></div>';
  back.hidden = false; const inp = $('modalInput'); if (inp) inp.focus();
  function close() { back.hidden = true; back.innerHTML = ''; }
  if ($('modalCancel')) $('modalCancel').addEventListener('click', close);
  $('modalOk').addEventListener('click', function () { const v = inp ? inp.value : null; close(); if (opts.onOk) opts.onOk(v); });
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('modalOk').click(); });
  if (!inp) $('modalOk').focus();
}

/* ---------- how much room each region gets ----------
   The two docks used to claim a constant 600px at every width. Measured, that is 44% of a 1366
   Chromebook and 59% of a 1024 screen before any content appears, which left the lesson 424px —
   and the resizer floors (280 and 320) meant a student could not reclaim it by hand either.
   Three tiers. The tier is written onto <body> so the stylesheet and the floating-button state read
   it from the same place and cannot disagree:
     wide    >= 1440   both docks are columns
     mid     >= 1180   the outline is a column; the assistant floats in over the content
     narrow  <  1180   both float in, and the centre gets the whole width
   A floating dock is the same element in the same DOM position — only its positioning changes — so
   focus order and the outline's tree semantics are untouched. */
const TIER_WIDE = 1440, TIER_MID = 1180;
const dockLeft = document.querySelector('.dock.left');
const dockRight = document.querySelector('.dock.right');
let tier = '';
let aiCollapsed = false;         // the student's own choice, which only the wide tier can honour
let outlineCollapsed = false;    // ditto, for the outline column
let floatOpen = null;            // 'left' | 'right' | null

/* Drag limits per tier, so the handle can give the centre column its space back on a small screen
   instead of being pinned to a floor set for a 1920 monitor. */
const DOCK_LIMITS = { wide: { left: [230, 520], right: [280, 560] }, mid: { left: [200, 380] } };

function layoutTier() {
  const w = window.innerWidth;
  return w >= TIER_WIDE ? 'wide' : (w >= TIER_MID ? 'mid' : 'narrow');
}
function dockLimits(side) { return (DOCK_LIMITS[tier] || {})[side] || null; }

function paintScrim() { const s = $('dockScrim'); if (s) s.hidden = !floatOpen; }

function closeFloating() {
  if (!floatOpen) return;
  const d = floatOpen === 'left' ? dockLeft : dockRight;
  d.classList.remove('open');
  const back = floatOpen === 'left' ? $('outlineBtn') : $('aiFab');
  floatOpen = null;
  paintScrim(); updateFab(); paintOutlineBtn();
  if (back && !back.hidden) { try { back.focus(); } catch (e) {} }
}
function openFloating(which) {
  const d = which === 'left' ? dockLeft : dockRight;
  if (!d || !d.classList.contains('floating')) return;
  if (floatOpen && floatOpen !== which) closeFloating();
  d.classList.add('open');
  floatOpen = which;
  paintScrim(); updateFab(); paintOutlineBtn();
  const first = d.querySelector('button:not([hidden]), input:not([disabled])');
  if (first) { try { first.focus(); } catch (e) {} }
}

/* Shown whenever the assistant is not. Hidden over a full-page view or a lab, where the panel it
   would open is behind something else and the button would do nothing a student can see. */
function updateFab() {
  const fab = $('aiFab'); if (!fab) return;
  const labOpen = typeof openLabRef !== 'undefined' && !!openLabRef;
  const pageShowing = !($('page') && $('page').hidden);
  const aiVisible = tier === 'wide' ? !aiCollapsed : floatOpen === 'right';
  fab.hidden = aiVisible || pageShowing || labOpen;
}
/* Hiding the outline mirrors hiding the assistant: the chevron in the panel's own header sends it
   away, and the button in the view bar brings it back. That button is on screen ONLY while the
   outline is not — otherwise it sits next to the thing it opens, and it pushes the breadcrumb off
   centre for no reason. */
function outlineShowing() {
  return tier === 'narrow' ? floatOpen === 'left' : !outlineCollapsed;
}
function paintOutlineBtn() {
  const b = $('outlineBtn'); if (!b) return;
  const on = outlineShowing();
  b.hidden = on;
  b.setAttribute('aria-expanded', on ? 'true' : 'false');
  const what = $('leftTitle') ? $('leftTitle').textContent.toLowerCase() : 'outline';
  b.title = 'Show the ' + what;
  const c = $('outlineCollapse');
  if (c) c.title = 'Hide the ' + what;
}
function showOutline() {
  if (tier === 'narrow') { openFloating('left'); return; }   // that repaints the button itself
  outlineCollapsed = false;
  $('editor').classList.remove('outline-hidden');
  paintOutlineBtn();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
}
function hideOutline() {
  if (tier === 'narrow') { closeFloating(); return; }
  outlineCollapsed = true;
  $('editor').classList.add('outline-hidden');
  paintOutlineBtn();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
  const b = $('outlineBtn');
  if (b && !b.hidden) { try { b.focus(); } catch (e) {} }    // focus was inside what just closed
}

function hideAI() {
  if (tier === 'wide') { aiCollapsed = true; $('editor').classList.add('ai-hidden'); }
  else closeFloating();
  updateFab();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
}
function showAI() {
  if (tier === 'wide') { aiCollapsed = false; $('editor').classList.remove('ai-hidden'); }
  else openFloating('right');
  updateFab();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
}

/* A width dragged at one tier can be nonsense at another, so anything outside the new tier's range
   is dropped and the stylesheet's own value for that tier takes over. */
function clampDockWidths() {
  const ed = $('editor');
  [['left', '--leftw'], ['right', '--rightw']].forEach(function (pair) {
    const lim = dockLimits(pair[0]);
    const inline = parseInt(ed.style.getPropertyValue(pair[1]), 10);
    if (!inline) return;
    if (!lim || inline < lim[0] || inline > lim[1]) ed.style.removeProperty(pair[1]);
  });
}

function applyTier() {
  const t = layoutTier();
  if (t === tier) return;
  tier = t;
  document.body.dataset.tier = t;
  dockLeft.classList.toggle('floating', t === 'narrow');
  dockRight.classList.toggle('floating', t !== 'wide');
  // A dock that has stopped floating must not keep the class that slid it in.
  if (t !== 'narrow') dockLeft.classList.remove('open');
  if (t === 'wide') dockRight.classList.remove('open');
  if ((floatOpen === 'left' && t !== 'narrow') || (floatOpen === 'right' && t === 'wide')) floatOpen = null;
  $('editor').classList.toggle('ai-hidden', t === 'wide' && aiCollapsed);
  // Collapsing a column only means anything where there IS a column to collapse.
  $('editor').classList.toggle('outline-hidden', t !== 'narrow' && outlineCollapsed);
  clampDockWidths();
  paintScrim();
  updateFab();
  paintOutlineBtn();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
}

/* ---------- resizers ---------- */
function makeResizer(handle, side) {
  handle.addEventListener('mousedown', function (e) {
    const lim = dockLimits(side);
    if (!lim) return;                          // this dock floats at this tier; there is nothing to drag
    e.preventDefault(); const startX = e.clientX; const editor = $('editor');
    const prop = side === 'left' ? '--leftw' : '--rightw';
    const start = parseInt(getComputedStyle(editor).getPropertyValue(prop), 10) || lim[0];
    function move(ev) {
      const dx = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      editor.style.setProperty(prop, Math.max(lim[0], Math.min(lim[1], start + dx)) + 'px');
    }
    function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
}
makeResizer($('resLeft'), 'left'); makeResizer($('resRight'), 'right');

/* ---------- the assistant's button, moved by hand ----------
   It floats over the work, so wherever it sits is in somebody's way eventually — over the coins in
   one game, over the log in another. Press and drag moves it; a press that does not travel is still
   a click that opens the assistant, which is what it is for and must stay the easy thing.

   Pointer events rather than mouse, unlike the two dock resizers: those adjust a column on a
   desktop, this is a floating control on the tier where a touch screen is likely. Threshold before
   anything moves, or a slightly shaky tap on a touch screen becomes a drag and never opens
   anything. */
const FABKEY = 'leagueFabPos';
const FAB_DRAG_MIN = 4;                     // px of travel before a press counts as a drag

function fabBounds(fab) {
  const host = $('editor').getBoundingClientRect();
  const r = fab.getBoundingClientRect();
  return { host: host, w: r.width, h: r.height,
    maxX: Math.max(0, host.width - r.width - 8), maxY: Math.max(0, host.height - r.height - 8) };
}
function placeFab(x, y) {
  const fab = $('aiFab'); if (!fab) return;
  const b = fabBounds(fab);
  const cx = Math.max(8, Math.min(b.maxX, x)), cy = Math.max(8, Math.min(b.maxY, y));
  fab.classList.add('moved');
  fab.style.left = cx + 'px'; fab.style.top = cy + 'px';
  return { x: cx, y: cy };
}
/* A position saved on a 1920 screen can be off the edge of a 1280 one, so it is clamped on the way
   in rather than trusted — the same reasoning as clampDockWidths. */
function restoreFabPos() {
  const fab = $('aiFab'); if (!fab) return;
  const p = Storage.readJSON(FABKEY, null);
  if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return;
  // Measuring needs a laid-out button, and it boots hidden. Unhide for the measurement only.
  const was = fab.hidden; fab.hidden = false;
  placeFab(p.x, p.y);
  fab.hidden = was;
}
(function () {
  const fab = $('aiFab'); if (!fab) return;
  let dragging = false, moved = false, id = null, offX = 0, offY = 0;
  fab.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    const host = $('editor').getBoundingClientRect(), r = fab.getBoundingClientRect();
    // Grab from wherever it was taken hold of, not from the corner, or it leaps under the cursor.
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    dragging = true; moved = false; id = e.pointerId;
    // Keeps the drag alive over the game frame, which would otherwise swallow the moves. Guarded:
    // capturing a pointer the element does not actually hold throws, and a throw here would leave
    // `dragging` true with no way to end it — the button would follow the cursor forever.
    try { fab.setPointerCapture(id); } catch (e) {}
  });
  fab.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    const host = $('editor').getBoundingClientRect();
    const x = e.clientX - host.left - offX, y = e.clientY - host.top - offY;
    if (!moved) {
      const r = fab.getBoundingClientRect();
      if (Math.abs(e.clientX - (r.left + offX)) < FAB_DRAG_MIN
        && Math.abs(e.clientY - (r.top + offY)) < FAB_DRAG_MIN) return;
      moved = true;
      fab.classList.add('dragging'); document.body.classList.add('dragging-fab');
    }
    placeFab(x, y);
  });
  function end() {
    if (!dragging) return;
    dragging = false;
    if (id !== null) { try { fab.releasePointerCapture(id); } catch (e) {} id = null; }
    fab.classList.remove('dragging'); document.body.classList.remove('dragging-fab');
    if (moved) {
      const host = $('editor').getBoundingClientRect(), r = fab.getBoundingClientRect();
      Storage.writeJSON(FABKEY, { x: Math.round(r.left - host.left), y: Math.round(r.top - host.top) });
    }
  }
  fab.addEventListener('pointerup', end);
  fab.addEventListener('pointercancel', end);
  // The click still fires after a drag; swallow it, or letting go opens the panel every time.
  fab.addEventListener('click', function (e) {
    if (moved) { moved = false; e.stopImmediatePropagation(); e.preventDefault(); return; }
    showAI();
  });
  // A window resize can strand it off the edge, exactly as it can a saved position.
  window.addEventListener('resize', function () {
    if (!fab.classList.contains('moved')) return;
    const was = fab.hidden; fab.hidden = false;
    placeFab(parseFloat(fab.style.left) || 0, parseFloat(fab.style.top) || 0);
    fab.hidden = was;
  });
})();

if ($('aiCollapse')) $('aiCollapse').addEventListener('click', hideAI);
if ($('outlineBtn')) $('outlineBtn').addEventListener('click', showOutline);
if ($('outlineCollapse')) $('outlineCollapse').addEventListener('click', hideOutline);
if ($('dockScrim')) $('dockScrim').addEventListener('click', closeFloating);
document.addEventListener('keydown', function (e) {
  // After the lab's own handler, which returns early unless a lab is open.
  if (e.key === 'Escape' && floatOpen && !(typeof openLabRef !== 'undefined' && openLabRef)) {
    closeFloating(); e.preventDefault();
  }
});
/* Driven by matchMedia, not by `resize` alone. A resize listener was measurably unreliable here —
   the tier stayed on "mid" at a 1920 viewport because the event either did not arrive or arrived
   carrying a width that was still mid-change. A media query fires exactly when the breakpoint is
   crossed, and it fires with the answer already true. `resize` stays as a second net, since it also
   covers the case where nothing crossed a breakpoint but a dock needs re-fitting. */
/* Guarded, because an environment without matchMedia must still get a working app: unguarded, this
   threw during boot and took the whole page down with it — no outline, no lesson, nothing. The
   resize listener below is enough on its own, so a missing matchMedia costs promptness, not
   function. */
if (typeof window.matchMedia === 'function') {
  [TIER_WIDE, TIER_MID].forEach(function (px) {
    const mq = window.matchMedia('(min-width:' + px + 'px)');
    if (mq.addEventListener) mq.addEventListener('change', applyTier);
    else if (mq.addListener) mq.addListener(applyTier);        // older WebKit
  });
}
window.addEventListener('resize', applyTier);
applyTier();
restoreFabPos();   // after applyTier, so the button is measured against the layout it will live in

/* ---------- saving problems are the student's problem, so say so ----------
   A failed save used to throw somewhere nobody was listening, and the student carried on working
   on a game that had quietly stopped being kept. Both cases below are rare and both are worth a
   sentence, because the alternative is losing an afternoon's work without ever being told. */
let warnedAboutSaving = false;
onStorageFailure(function () {
  if (warnedAboutSaving) return;                 // once, not on every keystroke
  warnedAboutSaving = true;
  toast('Your browser is out of space — your work is not being saved. Tell your teacher.');
});
if (!Storage.persistent) {
  setTimeout(function () {
    toast('This browser has saving switched off, so your work will be lost when you close the tab.');
  }, 1200);
}

/* ---------- boot ---------- */
renderFooter(); showPage('courses');
loadCourse().then(function () { renderOutline(); selectLesson(0); })
  .catch(function () { $('lessonBody').innerHTML = '<p style="color:var(--muted)">Could not load the course content. Is the server running?</p>'; });
