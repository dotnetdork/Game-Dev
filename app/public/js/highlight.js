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
  paintInlineCode(root);
}

/* ---------- inline code, in prose and inside the activity blocks ----------
   `console.log("frame")` in a practice step is the same JavaScript as `console.log("frame")` in the
   editor, and it was the one place in the app that rendered it as flat orange monospace. A student
   copying it across saw two different-looking things and had to trust they were the same.

   The looksLikeCode guard that protects the Parsons rows is deliberately NOT applied here. That
   guard exists because a Parsons step can be an English sentence the author never marked as code;
   backticks are an explicit statement that this IS code, so the author has already answered the
   question the guard was asking.

   A bare filename is the exception: `game.js` tokenizes as a variable and a property, which paints
   a file to look like a member access. Those are left alone — and made openable instead, below. */
const FILENAME_RE = /^[\w-]+\.(js|json|md|css|html|png|jpg|ogg|mp3)$/i;
function paintInlineCode(root) {
  root.querySelectorAll('.lesson-content code').forEach(function (el) {
    if (el.closest('pre') || el.dataset.painted) return;
    const text = el.textContent;
    if (FILENAME_RE.test(text.trim())) { el.dataset.painted = '1'; return; }
    const frag = highlightCode(text);
    if (!frag) return;
    el.textContent = '';
    el.appendChild(frag);
    el.dataset.painted = '1';
  });
}

/* ---------- the glossary ----------
   A term the course marks in bold can be hovered for a plain explanation of what it means.

   This replaces the margin note. A `tip aside` explaining "core loop" sat out to the right of a
   paragraph whether or not the reader wanted it, took a column of space to say one thing once, and
   only helped the student who happened to be on that lesson. A term is needed wherever it is used —
   "frame" turns up in five lessons and "sprite" in six — and the explanation should be attached to
   the word, not to the page.

   No new authoring syntax. Lessons already bold a term the first time it matters, and that bold IS
   the author saying "this is a thing"; content/glossary.yaml supplies the text. First match per
   term per lesson, so a word bolded again later for emphasis does not sprout a second tooltip. */
let GLOSSARY = null;
function loadGlossary() {
  if (GLOSSARY) return Promise.resolve(GLOSSARY);
  return fetch('/content/glossary.yaml')
    .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(r.status)); })
    .then(function (src) {
      const raw = (typeof jsyaml !== 'undefined') ? (jsyaml.load(src) || {}) : {};
      GLOSSARY = {};
      Object.keys(raw).forEach(function (k) { GLOSSARY[String(k).toLowerCase()] = String(raw[k]); });
      return GLOSSARY;
    })
    /* A missing or broken glossary must never cost a student the lesson text. */
    .catch(function () { GLOSSARY = {}; return GLOSSARY; });
}

/* Which side a definition opens on. Measured against whatever actually clips it — the lesson
   scroller — rather than the window, because the window is not what was cutting them off.
   Above is still the default: it keeps the definition next to the sentence you are reading rather
   than covering the words underneath it. This only overrides that when above does not fit. */
function glossClipBox(el) {
  let n = el.parentElement;
  while (n && n !== document.documentElement) {
    /* A sideways-scrolling wrapper is not a clip box for a tooltip. .tablescroll exists so a wide
       table can scroll horizontally; a tooltip is entitled to leave it, and treating it as the
       boundary is actively wrong — it is ~126px tall, so every note inside a table "had no room
       above" and was placed below, where it hung past the wrapper's bottom edge. That phantom
       overflow gave the wrapper a vertical scrollbar, and the scrollbar took 10px off the table's
       width. One bad clip box, three visible symptoms. */
    if (!n.classList.contains('tablescroll')) {
      const cs = getComputedStyle(n);
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') return n.getBoundingClientRect();
    }
    n = n.parentElement;
  }
  return { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
}
/* Place every note once, as soon as the lesson is painted.
   These are position:absolute and visibility:hidden — hidden, but still laid out, which is what
   lets placeGlossNote measure one without flashing it on screen. The cost is that a closed note
   still counts toward the scrollable area, so a term near the right of the column had 320px of
   invisible tooltip hanging past the edge and the whole lesson grew a horizontal scrollbar over
   nothing. Deciding the side up front means a note is never parked outside the column, and the
   hover pass below only has to redo it when scrolling has changed the answer. */
function placeAllGlossNotes(root) {
  if (!root) return;
  root.querySelectorAll('.gloss').forEach(function (wrap) {
    const note = wrap.querySelector('.gloss-note');
    if (note) placeGlossNote(wrap, note);
  });
}
function placeGlossNote(wrap, note) {
  note.classList.remove('gloss-below', 'gloss-right');
  /* A closed note is display:none, so it has no box until we give it one. Laid out but invisible
     was tried and is worse: it stays in the scroll area, so a 320px tooltip nobody has opened still
     widens the lesson and can add a scrollbar to whatever contains it.
     Measured with display restored and visibility still hidden, then put straight back — the note
     is never visible at any point, so this cannot flash. */
  const hidden = getComputedStyle(note).display === 'none';
  if (hidden) { note.style.display = 'block'; note.style.visibility = 'hidden'; }
  const box = glossClipBox(wrap);
  const w = wrap.getBoundingClientRect();
  const h = note.getBoundingClientRect().height;
  const GAP = 9;
  if (w.top - GAP - h < box.top && box.bottom - (w.bottom + GAP) > w.top - GAP - box.top) {
    note.classList.add('gloss-below');
  }
  /* And the same question sideways. A term late in a line put a 320px note past the right edge. */
  if (w.left + note.getBoundingClientRect().width > box.right - 8) note.classList.add('gloss-right');
  if (hidden) { note.style.display = ''; note.style.visibility = ''; }
}

let glossSeq = 0;
function linkGlossary(root) {
  if (!root) return;
  loadGlossary().then(function (g) {
    if (!g || !Object.keys(g).length) return;
    const used = {};
    root.querySelectorAll('.lesson-content strong, .lesson-content b').forEach(function (el) {
      if (el.closest('pre, code, figcaption, .block-hd, .gloss')) return;
      const word = el.textContent.trim().toLowerCase().replace(/[.,:;!?]+$/, '');
      const def = g[word] || g[word.replace(/s$/, '')];
      if (!def || used[word]) return;
      used[word] = 1;
      const wrap = document.createElement('span');
      wrap.className = 'gloss';
      const id = 'gloss' + (++glossSeq);
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      el.classList.add('gloss-term');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-describedby', id);
      el.setAttribute('aria-expanded', 'false');
      const note = document.createElement('span');
      note.className = 'gloss-note';
      note.id = id;
      note.setAttribute('role', 'note');
      note.textContent = def;
      wrap.appendChild(note);
      /* Decide which side to open on, every time, just before it becomes visible.
         The note defaults to sitting ABOVE the word, and the lesson scrolls inside #view-learn,
         which clips — so a term near the top of the scroll box had its definition cut in half.
         That is the common case, not an edge case: you scroll to a word and then hover it, which
         puts it near the top of the box by definition. */
      const place = function () { placeGlossNote(wrap, note); };
      el.addEventListener('mouseenter', place);
      el.addEventListener('focus', place);
      const toggle = function () {
        place();
        const open = wrap.classList.toggle('open');
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        else if (e.key === 'Escape' && wrap.classList.contains('open')) toggle();
      });
    });
    /* The notes exist now, so decide which side each one opens on before any of them can stick out
       of the column. Runs after the loop, not inside it, so the measuring happens once. */
    placeAllGlossNotes(root);
  });
}

/* ---------- places in the app that a step tells you to go ----------
   A practice step says "Open the Store from the top bar" or "open the Play tab", and both were
   plain words while the filename beside them had become a link — the student had one instruction
   they could click and one they had to follow by hand, with nothing to say which was which.

   Three deliberate limits, all of them because the first version linked too much:

   NUMBERED STEPS ONLY. Not the task sentence above them — that is describing the exercise, not
   telling you to go anywhere, and a link there is decoration.

   THE NAME, NOT THE ARTICLE. "the Store" underlined the "the"; the destination is Store.

   NO TABS. "Open `world.js` in the Code tab" already has a link that goes to the Code tab — the
   filename. Linking the tab as well gives one instruction two controls that do nearly the same
   thing. Only the top-bar destinations, which nothing else in the sentence reaches. */
const PLACES = [
  { re: /\bStore\b/g, label: 'Store', go: function () { if (typeof showPage === 'function') showPage('store'); } },
  { re: /\bGallery\b/g, label: 'Gallery', go: function () { if (typeof showPage === 'function') showPage('gallery'); } }
];
function linkPlaces(root) {
  if (!root) return;
  root.querySelectorAll('.lesson-content .yt-steps li').forEach(function (host) {
    if (host.dataset.placed) return;
    host.dataset.placed = '1';
    PLACES.forEach(function (spec) {
      [].slice.call(host.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) return;                    // text nodes only — never touch markup
        spec.re.lastIndex = 0;
        const m = spec.re.exec(node.nodeValue);
        if (!m) return;
        const after = node.splitText(m.index);
        after.nodeValue = after.nodeValue.slice(m[0].length);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'place-link';
        b.textContent = spec.label;
        b.title = 'Go to ' + spec.label;
        b.addEventListener('click', spec.go);
        host.insertBefore(b, after);
      });
    });
  });
}

/* A filename in a lesson is a place you can go. Step 1 of every practice step is "open game.js",
   and the shortcut for it used to be a button in the header captioned "Open my game" — a second
   control for something the sentence was already naming. The name itself opens it now. */
function linkFileNames(root) {
  if (!root || typeof openFile !== 'function' || typeof fileNames !== 'function') return;
  let names;
  try { names = fileNames(); } catch (e) { return; }
  root.querySelectorAll('.lesson-content code').forEach(function (el) {
    if (el.closest('pre') || el.dataset.filelink) return;
    const name = el.textContent.trim();
    if (names.indexOf(name) < 0) return;
    el.dataset.filelink = '1';
    el.classList.add('file-open');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.title = 'Open ' + name + ' in the Code tab';
    /* An icon, not just a colour. `game.js` sat in a step beside `update` and
       `console.log("frame")` wearing the same inline-code chip as both of them, so nothing said
       this one did anything when you pressed it — an underline is not a strong enough signal when
       every neighbour is already a bordered monospace box. */
    const ico = document.createElement('span');
    ico.className = 'mdi mdi-open-in-new';
    ico.setAttribute('aria-hidden', 'true');
    el.appendChild(ico);
    const go = function () {
      if (typeof switchView === 'function') switchView('code');
      openFile(name);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}
