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
/* The outline button. Where the outline is a column it collapses and restores that column; where it
   is not, it slides the panel in and out. `aria-expanded` says which way it currently is in both
   cases, so the button reports its state rather than just being pressable. */
function outlineShowing() {
  return tier === 'narrow' ? floatOpen === 'left' : !outlineCollapsed;
}
function paintOutlineBtn() {
  const b = $('outlineBtn'); if (!b) return;
  const on = outlineShowing();
  b.setAttribute('aria-expanded', on ? 'true' : 'false');
  b.title = (on ? 'Hide the ' : 'Show the ') + ($('leftTitle') ? $('leftTitle').textContent.toLowerCase() : 'outline');
}
function toggleOutline() {
  if (tier === 'narrow') {
    if (floatOpen === 'left') closeFloating(); else openFloating('left');
    return;                                     // those two already repaint the button
  }
  outlineCollapsed = !outlineCollapsed;
  $('editor').classList.toggle('outline-hidden', outlineCollapsed);
  paintOutlineBtn();
  if (typeof fitStage === 'function') requestAnimationFrame(fitStage);
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

if ($('aiCollapse')) $('aiCollapse').addEventListener('click', hideAI);
if ($('aiFab')) $('aiFab').addEventListener('click', showAI);
if ($('outlineBtn')) $('outlineBtn').addEventListener('click', toggleOutline);
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
