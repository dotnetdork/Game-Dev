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

/* ---------- dragging the console taller ----------
   The vertical twin of makeResizer() in ui.js — same shape, same mouse-only scope, same decision not
   to persist: a dock width dragged in one lesson does not follow you into the next, and neither
   should this. The limits are computed per drag rather than fixed, because .center's height changes
   with the window and a floor written in pixels would be most of a short one. */
(function () {
  const handle = $('resConsole'), con = $('console');
  if (!handle || !con) return;
  handle.addEventListener('mousedown', function (e) {
    const centre = document.querySelector('.center');
    if (!centre) return;
    e.preventDefault();
    const startY = e.clientY, start = con.getBoundingClientRect().height;
    // Floor: the header plus a couple of lines, so the pane is never smaller than the thing it
    // contains. Ceiling: leave the view above it at least a third, or dragging the log up would
    // hide the game entirely and there would be no handle left to drag it back with.
    const min = 90, max = Math.max(min, Math.round(centre.getBoundingClientRect().height * 0.72));
    function move(ev) {
      const h = Math.max(min, Math.min(max, start + (startY - ev.clientY)));  // up = taller
      con.style.setProperty('--conh', h + 'px');
    }
    function up() {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.classList.remove('resizing-v');
      if (!$('view-play').hidden && typeof fitStage === 'function') requestAnimationFrame(fitStage);
    }
    // While dragging, the cursor belongs to the drag and not to whatever it passes over.
    document.body.classList.add('resizing-v');
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
})();
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
  modal({ title: 'Reset the game?', message: 'This restores all of the original game files, replacing your changes to them. Your notes and any other files you added are kept.', okLabel: 'Reset it', onOk: function () {
    /* Code files only. This is the button a student presses after breaking their game, and it must
       not take their design notes with it — design.md is the one thing in the project that cannot
       be got back by reading the starter. resetFile() still restores it on its own, because there
       the student named the file they meant. */
    STARTER_ORDER.filter(isCodeFile).forEach(function (n) {
      project.files[n] = STARTER[n];
      if (project.order.indexOf(n) < 0) project.order.push(n);
    });
    // A project that predates design.md still gains it, without touching one that has it.
    if (typeof project.files['design.md'] !== 'string') {
      project.files['design.md'] = STARTER['design.md'];
      if (project.order.indexOf('design.md') < 0) project.order.unshift('design.md');
    }
    saveProject(); toast('Game restored.'); refreshFiles();
    if (typeof isGameRunning === 'function' && isGameRunning()) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
if ($('resetGameBtn')) $('resetGameBtn').addEventListener('click', resetGame);

/* Showing and hiding the assistant now lives with the rest of the layout in js/ui.js — hideAI(),
   showAI() and paintAIBtn() — because whether it is a column or a panel floating over the content
   depends on the width tier, and one place has to own that decision. */
