/* editor.js — The CodeMirror editor (lint, hints, folding, shortcuts) and the Learn / Code / Play tab switcher. */
/* ---------- code editor ---------- */
let currentFile = 'game.js';
/* The editor is built now, but plainly: linting, folding, hinting and search all belong to addons
   that no longer load at boot (js/lazy.js — they were ~2 MB, and a student reading a lesson never
   touches them). upgradeEditor() below switches them on once those files arrive, so every existing
   reference to `codeEditor` stays valid and nothing here had to become async.
   The extraKeys naming addon commands are safe to declare early: CodeMirror resolves a command by
   name at the moment the key is pressed, and by then the addons are in. */
const codeEditor = CodeMirror.fromTextArea($('codeeditor'), {
  mode: 'javascript', theme: 'material-darker', lineNumbers: true, tabSize: 2, indentUnit: 2,
  matchBrackets: true, autoCloseBrackets: true,
  gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  extraKeys: {
    'Ctrl-Space': 'autocomplete',
    'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
    'Ctrl-S': function () { saveFile(); }, 'Cmd-S': function () { saveFile(); },
    'Ctrl-Enter': function () { runGame(); }, 'Cmd-Enter': function () { runGame(); },
    'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent'
  }
});

/* Called on the first visit to the Code tab. Idempotent; a failure leaves a working plain editor
   rather than a broken one, because being unable to lint is much better than being unable to type. */
let codeToolsReady = false;
function upgradeEditor() {
  if (codeToolsReady) return Promise.resolve();
  return loadCodeTools().then(function () {
    codeToolsReady = true;
    codeEditor.setOption('styleActiveLine', true);
    codeEditor.setOption('foldGutter', true);
    // Via setEditorLanguage so the file already open decides: a diff is not valid JS (see
    // startReview) and neither is design.md, and linting either one is noise at best.
    if (!reviewing) setEditorLanguage(currentFile);
    codeEditor.refresh();
    if (typeof loadCode === 'function' && !$('view-code').hidden) loadCode();  // re-run now Prettier exists
  }).catch(function (e) {
    console.warn('[league] editor tools unavailable, continuing without them:', e.message);
  });
}
codeEditor.setSize('100%', '100%');
codeEditor.on('cursorActivity', function (cm) { const p = cm.getCursor(); const el = $('cmStatus'); if (el) el.textContent = 'Ln ' + (p.line + 1) + ', Col ' + (p.ch + 1); });
codeEditor.on('inputRead', function (cm, e) {
  // Not in prose. Word-completion on every letter typed into a sentence is a popup that never
  // closes, and the words it offers are the ones already on screen.
  if (typeof isCodeFile === 'function' && !isCodeFile(currentFile)) return;
  if (e.text && /[\w.]/.test(e.text[0]) && !cm.state.completionActive) cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false });
});
/* Click a line number to ask the tutor what that line does — the student's own game is the
   textbook, so reading it should be one click away. */
codeEditor.on('gutterClick', function (cm, n, gutter) {
  if (reviewing) return;                                                                    // those line numbers are diff rows, not the file
  if (gutter === 'CodeMirror-foldgutter' || gutter === 'CodeMirror-lint-markers') return;   // those gutters have their own jobs
  if (typeof isCodeFile === 'function' && !isCodeFile(currentFile)) return;                 // "explain this line" of their own writing explains nothing
  const lineText = cm.getLine(n);
  if (!lineText || !lineText.trim()) { toast('That line is empty — click a line with code on it.'); return; }
  const from = Math.max(0, n - 10), to = Math.min(cm.lineCount() - 1, n + 10);
  const snippet = cm.getRange({ line: from, ch: 0 }, { line: to, ch: cm.getLine(to).length });
  explainLine(currentFile, n + 1, lineText, snippet);
});
function formatJS(code) { try { return prettier.format(code, { parser: 'babel', plugins: prettierPlugins, printWidth: 100, tabWidth: 2, singleQuote: true }); } catch (e) { return code; } }

/* ---------- the editor follows the file ----------
   Every file used to be JavaScript. design.md is prose, and pointing the JavaScript mode and JSHint
   at a page of English produces a screen of red squiggles under a child's game idea — which reads
   as "you have done this wrong" about the one file where there is no wrong.
   Only the JavaScript mode is vendored (vendor/codemirror/mode/javascript/), so a text file gets no
   mode at all. That is the right answer rather than a shortfall: unstyled prose looks like prose.
   Called from loadCode() on every file switch. */
function setEditorLanguage(name) {
  const code = typeof isCodeFile === 'function' ? isCodeFile(name) : true;
  codeEditor.setOption('mode', code ? 'javascript' : null);
  // Guarded on codeToolsReady the same way upgradeEditor is: with no addon there is no option to
  // set, and setting one would throw before the student had even reached the Code tab.
  if (codeToolsReady && !reviewing) {
    codeEditor.setOption('lint', code ? LINT_OPTS : false);
    if (!code) codeEditor.clearGutter('CodeMirror-lint-markers');
  }
  // Bracket-closing in prose turns a typed "(" into "()" mid-sentence.
  codeEditor.setOption('autoCloseBrackets', code);
  codeEditor.setOption('matchBrackets', code);
}

/* ---------- reviewing an AI change ----------
   A proposed code change is shown in the editor itself as a diff — removed lines red with a
   minus, added lines green with a plus — so the student reads the change where the code lives.
   While reviewing, the editor holds a PREVIEW and not a real file, so every path that writes
   the editor's contents back into the project has to be blocked (see saveFile / switchView /
   openFile). Saving a diff as game.js would destroy the student's game. */
let reviewing = null;
const LINT_OPTS = { esversion: 2021, asi: true, undef: false, browser: true };

function showDiffInEditor(entry) {
  // the whole file, not just the changed hunks — the student should see the change in the
  // context of their real program. We scroll to the first change instead of hiding the rest.
  const rows = entry.rows || [];
  const text = rows.map(function (r) {
    if (r.t === 'h') return '===== ' + r.text + ' =====';   // a change can span several files
    return (r.t === ' ' ? '  ' : r.t + ' ') + r.text;
  }).join('\n');
  codeEditor.setOption('lint', false);                 // a diff is not valid JS; linting it is noise
  codeEditor.clearGutter('CodeMirror-lint-markers');
  codeEditor.setOption('readOnly', 'nocursor');
  codeEditor.setValue(text);
  let first = -1;
  rows.forEach(function (r, i) {
    if (r.t === '+') codeEditor.addLineClass(i, 'background', 'cm-diff-add');
    else if (r.t === '-') codeEditor.addLineClass(i, 'background', 'cm-diff-del');
    else { if (r.t === 'h') codeEditor.addLineClass(i, 'background', 'cm-diff-file'); return; }
    if (first < 0) first = i;
  });
  codeEditor.refresh();
  if (first < 0) return;
  // Land on the first change with a little context above it. Run again after layout: when this
  // is called during the switch into the Code tab the editor has not been measured yet, so the
  // first charCoords reading is short.
  const toChange = function () {
    codeEditor.refresh();
    const top = codeEditor.charCoords({ line: first, ch: 0 }, 'local').top;
    codeEditor.scrollTo(null, Math.max(0, top - 70));
  };
  toChange();
  setTimeout(toChange, 0);
  requestAnimationFrame(toChange);
}
function startReview(entry) {
  // keep any unsaved hand edits before the preview takes over the editor
  if (!reviewing && !$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); }
  reviewing = entry;
  const c = countChanges(entry.rows || []);
  const names = (entry.changes || []).map(function (x) { return x.name; }).join(', ');
  $('reviewStat').innerHTML = (names ? '<span class="rv-files">' + names + '</span> ' : '')
    + '<b class="add">+' + c.added + '</b> <b class="del">−' + c.removed + '</b>';
  $('reviewBar').hidden = false;
  switchView('code');                                  // switchView -> loadCode(), which renders the diff
}
function endReview() {
  if (!reviewing) return;
  reviewing = null;
  $('reviewBar').hidden = true;
  codeEditor.setOption('readOnly', false);
  if (codeToolsReady) codeEditor.setOption('lint', LINT_OPTS);   // no addon yet => nothing to turn on
  loadCode();                                          // back to the real file
}
if ($('reviewApply')) $('reviewApply').addEventListener('click', function () { if (reviewing) acceptProposal(reviewing); });
if ($('reviewSkip')) $('reviewSkip').addEventListener('click', function () { if (reviewing) declineProposal(reviewing); });

/* ---------- tabs + panels ---------- */
function switchView(view) {
  // never write the editor back to the project while it holds a diff preview
  if (typeof codeEditor !== 'undefined' && !reviewing && !$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); } // keep edits when leaving Code
  document.querySelectorAll('.vtab').forEach(function (b) {
    const on = b.getAttribute('data-view') === view;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');   // the tablist's state, not just its paint
  });
  ['learn', 'code', 'play'].forEach(function (v) { $('view-' + v).hidden = (v !== view); });
  /* Build has nothing to do on the Learn tab — it edits game files, and there are none on screen.
     Offering it there produced edits a student could not see land, so the panel goes to Tutor and
     the mode toggle is disabled while they are reading. It comes straight back on Code and Game. */
  if (typeof paintAIModeAvailability === 'function') paintAIModeAvailability(view);
  // Each tab gets its own address, so /…/what-an-engine-does/code is a link. See js/router.js.
  if (typeof syncRoute === 'function') syncRoute();
  const panelFor = { learn: 'panel-outline', code: 'panel-files', play: 'panel-info' };
  /* Engine names for engine panels. "Inspector" rather than "Game Info" because the panel edits the
     numbers now, and that is what every engine calls the one that edits the selected thing's
     properties; "Content Browser" rather than "Files" because it holds the scripts AND the bought
     art and sound, which is exactly the distinction Unreal's name draws. */
  const titleFor = { learn: 'Course Outline', code: 'Content Browser', play: 'Inspector' };
  ['panel-outline', 'panel-files', 'panel-info'].forEach(function (p) { $(p).hidden = (p !== panelFor[view]); });
  $('leftTitle').textContent = titleFor[view];
  /* The transport rides in this bar but belongs to the Game view, so it is only on screen there.
     Whether the game is RUNNING is still nothing to do with which tab you are on — that is the whole
     point of the transport — this only decides whether the buttons are visible. A game started here
     keeps running behind Learn and Code with no control showing, which is fine: the Code tab has its
     own Run button and Ctrl+Enter, and Stop is not something you reach for from a lesson. */
  const tr = document.querySelector('.transport');
  if (tr) {
    tr.hidden = (view !== 'play');
    // The bar has to know too: a centred transport sits over the middle of the breadcrumb's box, so
    // the crumb is capped while it is there. See .viewbar.has-transport in styles.css.
    tr.parentNode.classList.toggle('has-transport', view === 'play');
  }
  /* At a narrow width the left dock slides in from a button, and that button opens whichever panel
     this tab shows — so it says so rather than always claiming "Course outline". */
  const ob = $('outlineBtn');
  if (ob) {
    ob.querySelector('.sr-only').textContent = titleFor[view];
    /* The glyph follows the panel too. It was always the book, so on the Code tab a button that
       opens the file tree was drawn as a lesson — the picture said one thing and the tooltip
       underneath it said another. Sliders for the Inspector, matching what that panel now is. */
    const iconFor = { learn: 'mdi-book-open-page-variant', code: 'mdi-file-tree', play: 'mdi-tune-variant' };
    const g = ob.querySelector('.mdi');
    if (g) g.className = 'mdi ' + iconFor[view];
    // One owner for the title, since it also has to say whether the panel is currently showing.
    if (typeof paintOutlineBtn === 'function') paintOutlineBtn();
  }
  if (view === 'learn') $('crumb').textContent = $('crumb').dataset.lesson || 'Lesson';
  if (view === 'code') { upgradeEditor(); $('crumb').textContent = currentFile; refreshFiles(); loadCode(); setTimeout(function () { codeEditor.refresh(); }, 0); }
  /* Arriving here no longer starts the game and leaving no longer stops it — that is the transport's
     job now (Play/Stop, centred in the view bar). This tab shows the stage; it does not own what is on it.
     The one thing that still follows the tab is sound: a game running behind Learn or Code must be
     silent, which syncGameAudio() handles by muting rather than pausing. */
  if (view === 'play') { $('crumb').textContent = 'Playing: ' + course.name; loadSettings(); }
  if (typeof syncGameAudio === 'function') syncGameAudio();
  // The assistant's mode is the student's choice, not the tab's. Switching it for them meant a
  // question typed in Tutor mode went to the coder the moment they clicked Code to look at the
  // answer — the panel changed its mind while they were mid-thought. Only an explicit click on
  // the toggle (or explainLine, which is a tutor question by definition) changes it now.
  /* Open on Code AND on Play. It used to start closed on Play, on the theory that the game is the
     thing you came to look at — but the log is where a game that did nothing tells you why, and a
     student who does not know the panel exists reads a blank screen as "my game is broken" with no
     next step. It is collapsible; the default should be the one that answers the question. */
  if (view === 'learn') showConsole(false); else showConsole(true, true);
  if (view === 'play') requestAnimationFrame(fitStage);
  // The reading rail belongs to the lesson, so it goes away with it.
  if (typeof paintLessonRail === 'function') paintLessonRail();
}
document.querySelectorAll('.vtab').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); }); });

/* "Run my game and show me" — the one owner for it.
   Ctrl+Enter, the Run button, the transport's Play and applying an AI change all mean this, and
   before the transport they each expressed it as switchView('play') because arriving on that tab was
   what started the game. Now that arriving does nothing, every one of them would have quietly
   stopped running anything. */
function runGame() {
  // Save first, or Play runs the last save rather than what is on screen.
  if (typeof codeEditor !== 'undefined' && !reviewing && !$('view-code').hidden) {
    project.files[currentFile] = codeEditor.getValue(); saveProject();
  }
  startGame();
  if ($('view-play').hidden) switchView('play');
  else if (typeof syncGameAudio === 'function') syncGameAudio();
}
/* Play runs it and shows you it; Stop ends it and leaves you where you are — stopping is not a
   reason to move somebody. */
/* Play doubles as Resume, because to a student those are the same button and the same idea. */
if ($('gamePlay')) $('gamePlay').addEventListener('click', function () {
  if (typeof gamePaused !== 'undefined' && isGameRunning() && gamePaused) { resumeGame(); return; }
  runGame();
});
if ($('gamePause')) $('gamePause').addEventListener('click', function () { pauseGame(); });
if ($('gameStop')) $('gameStop').addEventListener('click', function () { stopGame(); });
/* Reset restores the starter files and always asks first — resetGame() owns that dialog. It used to
   be a lone button in the Inspector, which put a destructive action in a panel of tuning sliders. */
if ($('gameReset')) $('gameReset').addEventListener('click', function () { resetGame(); });