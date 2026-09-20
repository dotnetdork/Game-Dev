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
/* The buffer is js/console-panel.js, shared with the lesson bench — see the note there for why
   there were two and what differed. The painting below stays here, because this console and the
   bench's genuinely behave differently above the log. */
const gameBuffer = makeLogBuffer({
  onNew: function (entry) {
    const body = $('consoleBody'); if (!body) return;
    const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = consoleLineClass(entry);
    d.textContent = consoleLineText(entry);
    body.appendChild(d); body.scrollTop = body.scrollHeight;
    entry.el = d;
  },
  /* A REPEATED LINE NOW SAYS SO. It used to increment a counter nobody ever saw, so a student
     watching one line of output could not tell whether it had happened once or four hundred times
     — which, inside a loop, is the thing they are trying to find out. */
  onRepeat: function (entry) { if (entry.el) entry.el.textContent = consoleLineText(entry); },
  onEvict: function (entry) { if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el); }
});
/* `gameLog` stays a plain array under its old name: ai.js, check-gamelog.js and the telemetry all
   read it, and it is the same list the buffer is holding rather than a copy. */
let gameLog = gameBuffer.all();
let gameHasRun = false;
function noteGameRun() { gameHasRun = true; }
function recentGameLog(max) { return gameBuffer.recent(max); }

function conLine(level, text) { gameBuffer.push(level, text); }
function conClear() {
  gameBuffer.clear(); gameLog = gameBuffer.all();
  const b = $('consoleBody'); if (b) b.innerHTML = '<div class="cl cl-empty">Console output from your game appears here.</div>';
}
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
       not take anything else in the project with it — a note they wrote, a file they added. Those
       are the things that cannot be got back by reading the starter.
       The design board is not in the project at all any more, so it was never at risk here: it is
       its own storage key, untouched by this and by resetFile(). */
    STARTER_ORDER.filter(isCodeFile).forEach(function (n) {
      project.files[n] = STARTER[n];
      if (project.order.indexOf(n) < 0) project.order.push(n);
    });
    saveProject(); toast('Game restored.'); refreshFiles();
    if (typeof isGameRunning === 'function' && isGameRunning()) startGame(); if (!$('view-code').hidden) loadCode(); loadSettings();
  } });
}
if ($('resetGameBtn')) $('resetGameBtn').addEventListener('click', resetGame);

/* Showing and hiding the assistant now lives with the rest of the layout in js/ui.js — hideAI(),
   showAI() and paintAIBtn() — because whether it is a column or a panel floating over the content
   depends on the width tier, and one place has to own that decision. */
