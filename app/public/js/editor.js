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
    'Ctrl-Enter': function () { saveFile(function () { switchView('play'); }); },
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
    if (!reviewing) codeEditor.setOption('lint', LINT_OPTS);   // a diff is not valid JS; see startReview
    codeEditor.refresh();
    if (typeof loadCode === 'function' && !$('view-code').hidden) loadCode();  // re-run now Prettier exists
  }).catch(function (e) {
    console.warn('[league] editor tools unavailable, continuing without them:', e.message);
  });
}
codeEditor.setSize('100%', '100%');
codeEditor.on('cursorActivity', function (cm) { const p = cm.getCursor(); const el = $('cmStatus'); if (el) el.textContent = 'Ln ' + (p.line + 1) + ', Col ' + (p.ch + 1); });
codeEditor.on('inputRead', function (cm, e) { if (e.text && /[\w.]/.test(e.text[0]) && !cm.state.completionActive) cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false }); });
/* Click a line number to ask the tutor what that line does — the student's own game is the
   textbook, so reading it should be one click away. */
codeEditor.on('gutterClick', function (cm, n, gutter) {
  if (reviewing) return;                                                                    // those line numbers are diff rows, not the file
  if (gutter === 'CodeMirror-foldgutter' || gutter === 'CodeMirror-lint-markers') return;   // those gutters have their own jobs
  const lineText = cm.getLine(n);
  if (!lineText || !lineText.trim()) { toast('That line is empty — click a line with code on it.'); return; }
  const from = Math.max(0, n - 10), to = Math.min(cm.lineCount() - 1, n + 10);
  const snippet = cm.getRange({ line: from, ch: 0 }, { line: to, ch: cm.getLine(to).length });
  explainLine(currentFile, n + 1, lineText, snippet);
});
function formatJS(code) { try { return prettier.format(code, { parser: 'babel', plugins: prettierPlugins, printWidth: 100, tabWidth: 2, singleQuote: true }); } catch (e) { return code; } }

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
  const panelFor = { learn: 'panel-outline', code: 'panel-files', play: 'panel-info' };
  const titleFor = { learn: 'Course Outline', code: 'Files', play: 'Game Info' };
  ['panel-outline', 'panel-files', 'panel-info'].forEach(function (p) { $(p).hidden = (p !== panelFor[view]); });
  $('leftTitle').textContent = titleFor[view];
  /* At a narrow width the left dock slides in from a button, and that button opens whichever panel
     this tab shows — so it says so rather than always claiming "Course outline". */
  const ob = $('outlineBtn');
  if (ob) { ob.title = titleFor[view]; ob.querySelector('.sr-only').textContent = 'Show the ' + titleFor[view].toLowerCase(); }
  if (view === 'learn') $('crumb').textContent = $('crumb').dataset.lesson || 'Lesson';
  if (view === 'code') { upgradeEditor(); $('crumb').textContent = currentFile; refreshFiles(); loadCode(); setTimeout(function () { codeEditor.refresh(); }, 0); }
  if (view === 'play') { $('crumb').textContent = 'Playing: ' + course.name; startGame(); loadSettings(); } else { stopGame(); }
  // The assistant's mode is the student's choice, not the tab's. Switching it for them meant a
  // question typed in Tutor mode went to the coder the moment they clicked Code to look at the
  // answer — the panel changed its mind while they were mid-thought. Only an explicit click on
  // the toggle (or explainLine, which is a tutor question by definition) changes it now.
  if (view === 'learn') showConsole(false); else if (view === 'code') showConsole(true, true); else showConsole(true, false); // log: open on Code, closed on Play
  if (view === 'play') requestAnimationFrame(fitStage);
}
document.querySelectorAll('.vtab').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); }); });