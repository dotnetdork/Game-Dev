/* console-dock.js — The console/log panel under Code and Play, game/file reset dialogs, and the collapsible AI dock. */
/* ---------- console / log panel (bottom of Code & Play) ---------- */

/* ---------- what the game said, kept for the AI ----------
   Every log, warning and error the game produces already arrives here and is drawn on screen.
   It used to stop there: the AI could read the student's code but had no idea what happened
   when it ran, so "it's broken, help" was a guessing game. The last run's output is kept in
   this buffer and travels with each AI request.

   It holds exactly what the student can see: cleared when the game restarts, and cleared by
   the Clear button too. The AI should never know something the student's own console does not.

   Identical consecutive lines are counted rather than stored — a console.log in update() fires
   sixty times a second and would otherwise be the entire buffer. */
const GAMELOG_MAX = 60;
let gameLog = [];
let gameHasRun = false;
function noteGameRun() { gameHasRun = true; }
/* The last few lines, plus any earlier errors that scrolled out of that window — an error at
   startup matters more than the sixtieth frame of ordinary logging. */
function recentGameLog(max) {
  const n = max || 14;
  if (gameLog.length <= n) return gameLog.slice();
  const tail = gameLog.slice(-n);
  const missedProblems = gameLog.slice(0, -n)
    .filter(function (l) { return l.level === 'error' || l.level === 'warn'; }).slice(-3);
  return missedProblems.concat(tail);
}

function conLine(level, text) {
  const last = gameLog[gameLog.length - 1];
  if (last && last.level === level && last.text === text) last.n++;
  else { gameLog.push({ level: level, text: String(text), n: 1 }); if (gameLog.length > GAMELOG_MAX) gameLog.shift(); }
  const body = $('consoleBody'); if (!body) return;
  const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
  const d = document.createElement('div'); d.className = 'cl' + (level === 'error' ? ' err' : (level === 'warn' ? ' warn' : ''));
  d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight;
}
function conClear() { gameLog = []; const b = $('consoleBody'); if (b) b.innerHTML = '<div class="cl cl-empty">Console output from your game appears here.</div>'; }
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
    if (typeof isGameRunning === 'function' && isGameRunning()) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
function resetGame() {
  modal({ title: 'Reset the game?', message: 'This restores all of the original game files, replacing your changes to them. Any other files you added are kept.', okLabel: 'Reset it', onOk: function () {
    STARTER_ORDER.forEach(function (n) {
      project.files[n] = STARTER[n];
      if (project.order.indexOf(n) < 0) project.order.push(n);
    });
    saveProject(); toast('Game restored.'); refreshFiles();
    if (typeof isGameRunning === 'function' && isGameRunning()) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
if ($('resetGameBtn')) $('resetGameBtn').addEventListener('click', resetGame);

/* Showing and hiding the assistant now lives with the rest of the layout in js/ui.js — hideAI(),
   showAI() and updateFab() — because whether it is a column or a panel floating over the content
   depends on the width tier, and one place has to own that decision. */
