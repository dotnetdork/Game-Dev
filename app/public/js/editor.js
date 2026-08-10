/* editor.js — The CodeMirror editor (lint, hints, folding, shortcuts) and the Learn / Code / Play tab switcher. */
/* ---------- code editor ---------- */
let currentFile = 'game.js';
const codeEditor = CodeMirror.fromTextArea($('codeeditor'), {
  mode: 'javascript', theme: 'material-darker', lineNumbers: true, tabSize: 2, indentUnit: 2,
  matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, foldGutter: true,
  gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  lint: { esversion: 2021, asi: true, undef: false, browser: true },
  extraKeys: {
    'Ctrl-Space': 'autocomplete',
    'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
    'Ctrl-S': function () { saveFile(); }, 'Cmd-S': function () { saveFile(); },
    'Ctrl-Enter': function () { saveFile(function () { switchView('play'); }); },
    'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent'
  }
});
codeEditor.setSize('100%', '100%');
codeEditor.on('cursorActivity', function (cm) { const p = cm.getCursor(); const el = $('cmStatus'); if (el) el.textContent = 'Ln ' + (p.line + 1) + ', Col ' + (p.ch + 1); });
codeEditor.on('inputRead', function (cm, e) { if (e.text && /[\w.]/.test(e.text[0]) && !cm.state.completionActive) cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false }); });
function formatJS(code) { try { return prettier.format(code, { parser: 'babel', plugins: prettierPlugins, printWidth: 100, tabWidth: 2, singleQuote: true }); } catch (e) { return code; } }

/* ---------- tabs + panels ---------- */
function switchView(view) {
  if (typeof codeEditor !== 'undefined' && !$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); } // keep edits when leaving Code
  document.querySelectorAll('.vtab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
  ['learn', 'code', 'play'].forEach(function (v) { $('view-' + v).hidden = (v !== view); });
  const panelFor = { learn: 'panel-outline', code: 'panel-files', play: 'panel-info' };
  const titleFor = { learn: 'Course Outline', code: 'Files', play: 'Game Info' };
  ['panel-outline', 'panel-files', 'panel-info'].forEach(function (p) { $(p).hidden = (p !== panelFor[view]); });
  $('leftTitle').textContent = titleFor[view];
  if (view === 'learn') $('crumb').textContent = $('crumb').dataset.lesson || 'Lesson';
  if (view === 'code') { $('crumb').textContent = currentFile; refreshFiles(); loadCode(); setTimeout(function () { codeEditor.refresh(); }, 0); }
  if (view === 'play') { $('crumb').textContent = 'Playing: ' + course.name; startGame(); loadSettings(); } else { stopGame(); }
  setAIMode(view === 'learn' ? 'tutor' : 'coder');   // Learn = ask the tutor; Code/Play = build with the coder
  if (view === 'learn') showConsole(false); else if (view === 'code') showConsole(true, true); else showConsole(true, false); // log: open on Code, closed on Play
  if (view === 'play') requestAnimationFrame(fitStage);
}
document.querySelectorAll('.vtab').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); }); });