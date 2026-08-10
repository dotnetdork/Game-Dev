/* console-dock.js — The console/log panel under Code and Play, game/file reset dialogs, and the collapsible AI dock. */
/* ---------- console / log panel (bottom of Code & Play) ---------- */
function conLine(level, text) {
  const body = $('consoleBody'); if (!body) return;
  const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
  const d = document.createElement('div'); d.className = 'cl' + (level === 'error' ? ' err' : (level === 'warn' ? ' warn' : ''));
  d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight;
}
function conClear() { const b = $('consoleBody'); if (b) b.innerHTML = '<div class="cl cl-empty">Console output from your game appears here.</div>'; }
let consoleOpen = true;
function showConsole(show, open) {
  const c = $('console'); if (!c) return;
  c.hidden = !show;
  if (open !== undefined) consoleOpen = open;
  c.classList.toggle('collapsed', !consoleOpen);
  // Showing or collapsing the console resizes the stage box above it. Re-fit the game or it
  // keeps its old size and spills over everything — which is what happened when a runtime
  // error auto-opened the console after an AI edit.
  if ($('view-play') && !$('view-play').hidden && typeof fitStage === 'function') requestAnimationFrame(fitStage);
}
if ($('conToggle')) $('conToggle').addEventListener('click', function () { consoleOpen = !consoleOpen; $('console').classList.toggle('collapsed', !consoleOpen); if (!$('view-play').hidden) requestAnimationFrame(fitStage); });
if ($('conClear')) $('conClear').addEventListener('click', conClear);
window.addEventListener('message', function (e) { const d = e && e.data; if (d && d.__gamelog) { conLine(d.level || 'log', d.text || ''); if (d.level === 'error' && $('view-play') && !$('view-play').hidden) showConsole(true, true); } });
conClear();
function resetFile(name) {
  const def = STARTER[name];
  if (def === undefined) { toast('That file has no original to go back to.'); return; }
  modal({ title: 'Reset ' + name + '?', message: 'This restores the original ' + name + ', replacing your changes. Your other files are kept.', okLabel: 'Reset it', onOk: function () {
    project.files[name] = def; if (project.order.indexOf(name) < 0) project.order.push(name);
    saveProject(); toast(name + ' restored.');
    if (!$('view-play').hidden) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
function resetGame() {
  modal({ title: 'Reset the game?', message: 'This restores all of the original game files, replacing your changes to them. Any other files you added are kept.', okLabel: 'Reset it', onOk: function () {
    STARTER_ORDER.forEach(function (n) {
      project.files[n] = STARTER[n];
      if (project.order.indexOf(n) < 0) project.order.push(n);
    });
    saveProject(); toast('Game restored.'); refreshFiles();
    if (!$('view-play').hidden) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
if ($('resetGameBtn')) $('resetGameBtn').addEventListener('click', resetGame);

/* ---------- collapsible AI dock ---------- */
let aiCollapsed = false;
function updateFab() { const fab = $('aiFab'); if (fab) fab.hidden = !(aiCollapsed && $('page') && $('page').hidden); }
function setAICollapsed(c) { aiCollapsed = c; const ed = $('editor'); if (ed) ed.style.setProperty('--rightw', c ? '0px' : '320px'); updateFab(); }
if ($('aiCollapse')) $('aiCollapse').addEventListener('click', function () { setAICollapsed(true); });
if ($('aiFab')) $('aiFab').addEventListener('click', function () { setAICollapsed(false); });
