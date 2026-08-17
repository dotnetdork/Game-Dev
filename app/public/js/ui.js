/* ui.js — Shared UI bits (toast, modal, panel resizers) and the boot sequence that starts the app. */
/* ---------- toast + modal ---------- */
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200); }
function modal(opts) {
  const back = $('modalBack');
  back.innerHTML = '<div class="modal"><h3>' + opts.title + '</h3>' + (opts.message ? '<p>' + opts.message + '</p>' : '')
    + (opts.input ? '<input id="modalInput" placeholder="' + (opts.placeholder || '') + '">' : '')
    + '<div class="acts"><button class="cancel" id="modalCancel">Cancel</button><button class="ok" id="modalOk">' + (opts.okLabel || 'OK') + '</button></div></div>';
  back.hidden = false; const inp = $('modalInput'); if (inp) inp.focus();
  function close() { back.hidden = true; back.innerHTML = ''; }
  $('modalCancel').addEventListener('click', close);
  $('modalOk').addEventListener('click', function () { const v = inp ? inp.value : null; close(); if (opts.onOk) opts.onOk(v); });
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('modalOk').click(); });
}

/* ---------- resizers (grow-only) ---------- */
function makeResizer(handle, side) {
  handle.addEventListener('mousedown', function (e) {
    e.preventDefault(); const startX = e.clientX; const editor = $('editor');
    const startL = parseInt(getComputedStyle(editor).getPropertyValue('--leftw'));
    const startR = parseInt(getComputedStyle(editor).getPropertyValue('--rightw'));
    function move(ev) { const dx = ev.clientX - startX;
      if (side === 'left') editor.style.setProperty('--leftw', Math.max(280, Math.min(520, startL + dx)) + 'px');
      else editor.style.setProperty('--rightw', Math.max(320, Math.min(560, startR - dx)) + 'px'); }
    function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
}
$('editor').style.setProperty('--leftw', '280px'); $('editor').style.setProperty('--rightw', '320px');
makeResizer($('resLeft'), 'left'); makeResizer($('resRight'), 'right');

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
