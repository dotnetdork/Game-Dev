/* highlight.js — Syntax colouring for the code that appears inside lessons. */

/* The Code tab renders fully coloured JavaScript; the lesson teaching that JavaScript rendered it
   as flat grey text. This colours both from the same tokenizer and the same theme, so a keyword in
   the lesson is the same colour as that keyword in the editor.

   CodeMirror ships a `runmode` addon for exactly this, but only the library and the JavaScript
   mode are vendored here, and the app has to keep working on a filtered school network — so no
   CDN, no new download. `getMode`, `startState` and `StringStream` are all public API, and walking
   them is what the addon does anyway, so the walk lives here instead. */
function tokenizeJS(text, emit) {
  if (typeof CodeMirror === 'undefined' || !CodeMirror.getMode) return false;
  const mode = CodeMirror.getMode(CodeMirror.defaults || {}, 'javascript');
  const state = CodeMirror.startState ? CodeMirror.startState(mode) : (mode.startState && mode.startState());
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i) emit('\n', null);
    const stream = new CodeMirror.StringStream(lines[i], 2, null);
    if (!lines[i] && mode.blankLine) mode.blankLine(state);
    while (!stream.eol()) {
      const style = mode.token(stream, state);
      emit(stream.current(), style);
      stream.start = stream.pos;
    }
  }
  return true;
}

/* Plain code text in, a coloured fragment out. Returns null if CodeMirror is unavailable, so
   every caller degrades to the uncoloured text it already had rather than blanking the code. */
function highlightCode(text) {
  const frag = document.createDocumentFragment();
  let ok;
  try {
    ok = tokenizeJS(text, function (token, style) {
      if (!style) { frag.appendChild(document.createTextNode(token)); return; }
      const node = document.createElement('span');
      node.className = 'cm-' + style.replace(/ +/g, ' cm-');
      node.textContent = token;
      frag.appendChild(node);
    });
  } catch (e) { return null; }
  return ok ? frag : null;
}

/* Parsons steps and fill-in-the-blank templates are sometimes real code and sometimes an English
   sentence ("You move to catch it"). Running a JavaScript tokenizer over the sentence coloured
   `catch` as a keyword and every other word as a variable, which is worse than leaving it plain —
   it tells a child that English words are code. So: only paint text that shows actual syntax.

   Calibrated against the whole corpus: every Parsons line in it is an English sentence, and three
   of the four fill-in templates are real statements. Crucially, "create() runs one time to build
   the world" is prose, so call syntax and member access cannot be the test — only a statement
   terminator or an assignment is. A code line that gets read as prose merely renders plain, which
   is a far cheaper mistake than colouring a sentence. */
function looksLikeCode(text) {
  return /[;{}]|[^=!<>]=[^=]/.test(String(text));
}

/* Colour an element that already holds plain code text, in place. */
function paintCode(el) {
  if (!el || el.dataset.painted) return;
  if (!looksLikeCode(el.textContent)) { el.dataset.painted = '1'; return; }
  const frag = highlightCode(el.textContent);
  if (!frag) return;
  el.textContent = '';
  el.appendChild(frag);
  el.dataset.painted = '1';
}

/* Fill-in-the-blank is code with an <input> sitting in the middle of it, so it can't be repainted
   wholesale — each text run around the input is coloured on its own. */
function paintTextNodes(el) {
  if (!el || el.dataset.painted) return;
  el.dataset.painted = '1';
  // Judged on the whole template, not fragment by fragment: the text either side of the blank is
  // usually too short to look like anything on its own.
  if (!looksLikeCode(el.textContent)) return;
  [].slice.call(el.childNodes).forEach(function (node) {
    if (node.nodeType !== 3 || !node.nodeValue.trim()) return;
    const frag = highlightCode(node.nodeValue);
    if (frag) el.replaceChild(frag, node);
  });
}

/* Every code surface in a rendered lesson. Called after the widget renderers have run, so the
   ```run / ```quiz / ```challenge fences are already gone and what's left in `pre` is a plain
   sample the author wanted shown as-is. */
function paintLesson(root) {
  if (!root) return;
  root.classList.add('cm-s-material-darker');
  root.querySelectorAll('pre > code, pre.quiz-code, .fb-row code, .parsons-row code').forEach(paintCode);
  root.querySelectorAll('.fill-code').forEach(paintTextNodes);
}
