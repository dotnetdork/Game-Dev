/* lab.js — the lesson lab: the course's own game, broken on purpose, on a bench.
 *
 * Moved out of widgets.js by the Phase 4 split in docs/architecture-audit-2026-09-15.md. It was
 * thirty-one functions, four pieces of module state, its own sandboxed-document builder, its own
 * console and its own tutor chat, all living inside a 2,400-line file about something else. It was
 * a module that had never been given a file, and widgets.js grew by accretion partly because there
 * was nowhere else for any of this to go.
 *
 * WHAT A LAB IS, and the distinction the whole file turns on: this is NOT the student's game. Their
 * game lives in the Code tab and nothing here ever touches it. This is the course's example, broken
 * deliberately, for them to fix — which is why it has its own header, its own reset, and says so.
 *
 * Loaded after widgets.js (see index.html). Nothing here runs at load: renderChallengeCells in
 * widgets.js builds the cards, and openLab is called from a click, long after both files have run.
 */
/* ```challenge — the lesson LAB: the course's own game, broken on purpose, sitting inside the
   lesson for the student to fix.

   The important thing about a lab is whose it is. It is NOT the student's game — that lives in the
   Code tab and nothing here ever touches it. This is the course's example, on a bench, and it says
   so: its own header, a note that it can be reset at any time, and a reset button in plain sight.

   Layout: the CODE comes first and the running game sits under it. You read the thing you are
   about to change, then watch what it does — and after pressing Run your eye does not have to
   travel back up past the output to reach the editor again.

   Authored as YAML in a ```challenge fence:
     title:     what the bench is called
     task:      what is wrong / what to do, in a sentence
     hint:      shown after the first failed run
     code:      the broken starting code
     solution:  the working version, offered once they are properly stuck
   Only `code` is required.

   The student's code calls win() when the goal is met, which resolves the activity and can
   complete the lesson. */
const LAB_HINT_AFTER = 1;     // failed runs before the hint appears
const LAB_REVEAL_AFTER = 4;   // failed runs before the worked answer is offered

/* ---------- launcher in the lesson, working surface in its own window ----------
   The lab used to live inside the lesson column, which is about 760px on a school Chromebook and
   424px on a smaller screen. Code beside a running game does not fit there, and a big editor
   embedded mid-lesson interrupts the reading either way. So the lesson keeps a card that says what
   the lab is and opens it; the lab itself takes the whole stage.

   Going somewhere and coming back is also the point, not a side effect: it marks the lab as a
   thing you do rather than more of the page you were reading, and returning marks it finished.

   The card is a launcher only — the editor and the frame are built when the lab opens and thrown
   away when it closes. Nothing is moved between the two, which avoids a whole class of bug (an
   iframe reloads when it changes parent, a CodeMirror instance needs measuring again), and it
   costs nothing because the code was always saved through the activity ledger anyway. */
let openLabRef = null;          // the lab on screen, or null
let labReturnFocus = null;      // what gets focus back when it closes
let labPendingAdvance = null;   // a lesson that finished while the bench was open

/* The document a lab runs in. Deliberately tiny: a 300x200 canvas, its 2D context, and win().
   No game engine and no owned artwork — which is what lets a lab appear in modules before Phaser
   is introduced, and lets tools/check-challenges.js run all 22 of them without a browser. A lab
   that runs a real Phaser game needs the harness startGame() builds AND a browser to check it in;
   see Stage 2 in .claude/plans/STAGES.md for why that is reserved for a handful of authored ones. */
/* console.log inside a lab used to go nowhere. That is a strange thing to withhold from a student
   in a lesson about reading errors — printing a value to see what it actually is IS the technique
   being taught. Every log, warning and error now travels out to the bench's own console.
   Runs before the student's code, so a log on the very first line is caught. */
function labConsoleShim(tok) {
  return '<' + 'script>(function(){'
    + 'function f(a){return [].slice.call(a).map(function(v){'
    + 'if(typeof v==="string")return v;try{return JSON.stringify(v);}catch(e){return String(v);}'
    + '}).join(" ");}'
    + 'function s(l,a){try{parent.postMessage({__cm:true,tok:"' + tok + '",log:{level:l,text:f(a)}},"*");}catch(e){}}'
    + 'var c=console;["log","info","debug","warn","error"].forEach(function(n){'
    + 'var o=c[n]?c[n].bind(c):function(){};'
    + 'c[n]=function(){o.apply(c,arguments);s(n==="warn"?"warn":(n==="error"?"error":"log"),arguments);};});'
    + '})();<' + '/script>';
}

/* A lab draws in a 300x200 coordinate space — that is the authored contract, every lab uses those
   literals, and tools/check-challenges.js stubs `canvas` as exactly that.
   The picture is much bigger than 300x200 on screen, so the canvas ELEMENT is three times that and
   the context is pre-scaled to match. Everything the student writes still uses 300x200, and the
   result is crisp at full size instead of a 300px bitmap smeared across 900px.
   `canvas` is handed over as a small stand-in reporting the logical size, so `canvas.width` is 300
   in the browser AND 300 in the offline checker. One truth in both places — a mismatch there is
   exactly the kind of gap that hid a blank lab for three commits. */
const LAB_W = 300, LAB_H = 200, LAB_SCALE = 3;

/* `pw`/`ph` are the pixel size of the frame, measured by the PARENT and baked in.
   The document cannot measure itself in time: inside a sandboxed srcdoc iframe window.innerWidth is
   0 while the inline script runs, so the canvas kept its default 300x150, the student's code drew
   onto that, and the refit at `load` — now with a real width — resized the canvas and wiped the
   drawing. A lab that draws one frame was blank from then on, with nothing to redraw it. The parent
   already knows the size at the moment it sets srcdoc, so it says so. */
function labDoc(tok, userCode, pw, ph) {
  const safe = String(userCode).replace(/<\/(script)/gi, '<\\/$1');
  const W = Math.max(1, Math.round(pw || 0)), H = Math.max(1, Math.round(ph || 0));
  /* The canvas fills the pane now that the stage no longer letterboxes it in CSS, and the 300x200
     world is fitted into whatever shape that is: one uniform scale, centred, so a drawing is never
     stretched. The leftover margin is the same colour as the pane, so it reads as a full viewport
     rather than a card floating in one — which is what it looked like before.
     Re-fitted on resize, because the pane changes width whenever the assistant opens or closes. */
  // #06101c: the same ground the Game tab's stage uses, so running and idle look like one surface.
  return '<!doctype html><body style="margin:0;background:#06101c;overflow:hidden">'
    /* object-fit:contain, because the bitmap is sized once and then CSS-scaled (see __fit). Without
       it, opening the assistant narrows the pane and the fixed bitmap is squashed to fit — the game
       goes visibly tall and thin. Contain letterboxes it into whatever shape the pane becomes and
       keeps the drawing's proportions. */
    + '<canvas id="c" style="width:100%;height:100vh;display:block;object-fit:contain"></canvas>'
    + labConsoleShim(tok)
    + '<scr' + 'ipt>var __el=document.getElementById("c"),ctx=__el.getContext("2d");'
    + 'var __W=' + LAB_W + ',__H=' + LAB_H + ',__DPR=' + LAB_SCALE + ',__sized=false;'
    /* Only touch the backing store when the size has really changed. Assigning canvas.width WIPES
       the canvas, and a lab that draws once — which is most of them, and is the entire point of the
       broken ones — was being blanked by the resize event the iframe fires as it settles after
       load. The drawing was correct and then erased a frame later. */
    /* innerWidth/innerHeight, not getBoundingClientRect. The script runs before the sandboxed
       document has been laid out, so the canvas measured 0 — it was sized 3x3, drawn on perfectly,
       and then stretched across the pane as nothing. The window's own dimensions are correct from
       the first line, and they are what the canvas fills anyway. */
    + 'function __fit(){'
    + 'var w=Math.max(1,window.innerWidth||0)||' + W + ',h=Math.max(1,window.innerHeight||0)||' + H + ';'
    + 'if(w<2){w=' + W + ';}if(h<2){h=' + H + ';}'
    /* The backing store is sized ONCE and then left alone. Assigning canvas.width wipes the canvas,
       and most of these labs draw a single frame — so a later resize (the assistant panel opening,
       say) would erase the very picture the student is being asked to look at, with nothing to
       redraw it. Fixed bitmap, CSS scales it: a resize costs a little sharpness instead of
       everything. The transform is still recomputed so the first real fit lands correctly. */
    + 'var bw=w*__DPR,bh=h*__DPR;'
    + 'if(!__sized&&w>1&&h>1){__el.width=bw;__el.height=bh;__sized=true;}'
    + 'if(!__sized)return;'
    + 'var s=Math.min(w/__W,h/__H)*__DPR;'
    + 'ctx.setTransform(s,0,0,s,(w*__DPR-__W*s)/2,(h*__DPR-__H*s)/2);}'
    + '__fit();window.addEventListener("resize",__fit);window.addEventListener("load",__fit);'
    + 'var canvas={width:' + LAB_W + ',height:' + LAB_H + ',getContext:function(){return ctx;}};'
    + 'var __w=false;function win(){if(__w)return;__w=true;try{parent.postMessage({__cm:true,tok:"' + tok + '",win:true},"*");}catch(e){}}window.onerror=function(m){try{parent.postMessage({__cm:true,tok:"' + tok + '",err:String(m)},"*");}catch(e){}};'
    /* Pause, from outside a sandbox we cannot reach into.
       Every lab animates with requestAnimationFrame, so wrapping that one function is enough to
       freeze one: while paused the callback is held instead of scheduled, and resuming hands the
       held callbacks straight back to the real rAF. The student's code is untouched and never
       knows. A loop built on setInterval would keep running — none of the labs use one, and a
       half-working pause on the ones that do is still better than no pause at all. */
    + 'var __paused=false,__held=[],__raf=window.requestAnimationFrame.bind(window);'
    + 'window.requestAnimationFrame=function(cb){if(__paused){__held.push(cb);return 0;}return __raf(cb);};'
    + 'window.addEventListener("message",function(e){var d=e&&e.data||{};'
    + 'if(d.__labctl==="pause"){__paused=true;}'
    + 'else if(d.__labctl==="resume"){__paused=false;var q=__held;__held=[];'
    + 'for(var i=0;i<q.length;i++){__raf(q[i]);}}});'
    + 'try{\n' + safe + '\n}catch(e){window.onerror(e.message);}<\/scr' + 'ipt></body>';
}

/* ---------- the bench console ----------
   Same markup, classes and behaviour as the game console under the Play tab, so a student meets
   one console in this app rather than two that behave differently. Identical consecutive lines are
   counted rather than repeated, because a log inside an animation frame fires sixty times a second
   and would otherwise be the entire log. */
const LAB_LOG_MAX = 80;
let labLog = [];
/* Set when the student collapses the log themselves. Output opens the log — printing a value to
   see what it is is the whole technique, and a badge they have to notice and click is not seeing
   it. But once they have deliberately closed it, it stays closed for anything short of an error. */
let labConsoleShut = false;

function labConsoleClear() {
  labLog = [];
  const b = $('labConBody');
  if (b) b.innerHTML = '<div class="cl cl-empty">Anything your code prints appears here.</div>';
  labConsoleCount();
}
function labConsoleCount() {
  const el = $('labConCount'); if (!el) return;
  const box = $('labConsole');
  const collapsed = box && box.classList.contains('collapsed');
  const n = labLog.reduce(function (t, l) { return t + l.n; }, 0);
  el.textContent = (collapsed && n) ? n + (n === 1 ? ' line' : ' lines') : '';
}
function labConsoleOpen(open) {
  const box = $('labConsole'); if (!box) return;
  box.classList.toggle('collapsed', !open);
  labConsoleCount();
}
function labConsoleLine(level, text) {
  const lvl = ['log', 'warn', 'error'].indexOf(level) >= 0 ? level : 'log';
  const last = labLog[labLog.length - 1];
  if (last && last.level === lvl && last.text === text) {
    last.n++;
    if (last.el) last.el.textContent = text + '   (' + last.n + '×)';
  } else {
    const body = $('labConBody'); if (!body) return;
    const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = 'cl' + (lvl === 'error' ? ' err' : (lvl === 'warn' ? ' warn' : ''));
    d.textContent = text;                                  // whatever the student's code printed
    body.appendChild(d); body.scrollTop = body.scrollHeight;
    labLog.push({ level: lvl, text: text, n: 1, el: d });
    if (labLog.length > LAB_LOG_MAX) {
      const gone = labLog.shift();
      if (gone.el && gone.el.parentNode) gone.el.parentNode.removeChild(gone.el);
    }
  }
  // An error always opens the log; ordinary output opens it unless they closed it on purpose.
  if (lvl === 'error' || !labConsoleShut) labConsoleOpen(true);
  labConsoleCount();
}

function labSave(lab, patch) { saveLabState(lab.lessonId, lab.key, patch); }

/* What the card in the lesson says. Never "you have not started this" — a lab is not homework. */
function paintLabCard(lab) {
  const k = lab.card; if (!k) return;
  k.done.hidden = !lab.solved;
  if (lab.solved) {
    k.done.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>'
      + (lab.revealed ? 'Working — you read the answer' : 'Fixed it!');
  }
  // Short, because the label above already says "LAB" — "Start the lab" said it twice.
  const label = lab.solved ? 'Open' : (lab.touched || lab.fails ? 'Continue' : 'Start');
  k.open.innerHTML = '<span class="mdi ' + (lab.solved ? 'mdi-flask-outline' : 'mdi-play') + '" aria-hidden="true"></span>' + label;
}

/* Running first, then an error, then solved — so re-running a lab that already works shows
   "Running…" and settles back to "Fixed it!" instead of looking like nothing happened. */
function paintLabStatus(lab) {
  const el = $('labStatus'); if (!el || openLabRef !== lab) return;
  if (lab.running) { el.className = 'lab-status'; el.textContent = 'Running…'; return; }
  /* The most common outcome for a lab that is still broken: it ran, it threw nothing, and it did
     not win. Saying so is the honest answer. Before this the status simply read "Running…" and
     stayed there, which reads as the app having hung rather than as the code not working yet. */
  if (lab.settled && !lab.solved) {
    el.className = 'lab-status no';
    el.textContent = 'It ran, but the goal is not met yet — read what it does and try again.';
    return;
  }
  if (lab.error) {
    // textContent, not innerHTML: this string is whatever the student's own code threw.
    el.className = 'lab-status no';
    el.textContent = 'Error: ' + lab.error;
    return;
  }
  if (lab.solved) {
    el.className = 'lab-status ok';
    el.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>'
      + (lab.revealed ? 'Working — now you have seen why.' : 'Fixed it!');
    return;
  }
  el.className = 'lab-status'; el.textContent = '';
}

/* ---------- getting stuck ----------
   Twenty minutes stuck is not perseverance, it is a child who has stopped learning and needs a
   door. The doors are the Hint button (asked for, one rung at a time) and, after the hints and the
   tutor, the worked answer below. Nothing pushes help at a student who has not asked: a hint that
   appears by itself is just the answer arriving early, and it arrived before some students had
   read the task. */
function labOfferSolution(lab) {
  const ui = lab.ui; if (!ui || ui.solveEl || !lab.c.solution) return;
  const wrap = document.createElement('div'); wrap.className = 'ch-solve';
  const p = document.createElement('p');
  p.textContent = 'Stuck on this one? You can put the working version in and read it instead.';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary';
  b.textContent = 'Show the answer';
  b.addEventListener('click', function () {
    ui.write(lab.c.solution);
    lab.code = lab.c.solution; lab.revealed = true; lab.touched = true;
    labSave(lab, { revealed: true, code: lab.code });
    wrap.innerHTML = '<p class="ch-solve-done">Here it is. Read it, run it, and see what it does '
      + 'differently — that is the bit worth remembering.</p>';
  });
  wrap.appendChild(p); wrap.appendChild(b);
  ui.brief.appendChild(wrap); ui.solveEl = wrap;
}
function labFail(lab) {
  lab.fails++;
  if (lab.ui) lab.code = lab.ui.read();
  labSave(lab, { fails: lab.fails, code: lab.code });
  /* No automatic hint any more — that is the Hint button's job, and only when asked. The worked
     answer still surfaces on its own, because a student who has failed this many times without
     pressing anything is exactly the one who will not ask. */
  if (lab.fails >= LAB_REVEAL_AFTER && !lab.revealed) labOfferSolution(lab);
}

/* The dialog claims to be modal, so it has to actually be modal — otherwise everything behind it
   is still reachable by Tab and still announced, and a student using the keyboard falls out of the
   bench into a lesson they cannot see. `inert` does this without a hand-written focus trap. */
/* The top bar is deliberately NOT in this list. Making it inert did make the bench properly modal,
   and it also meant Store, Gallery, Docs and Help silently stopped working while a lab was open —
   a dead row of buttons with no explanation. showPage() closes the lab before it navigates, so
   leaving the bar live is safe and the student keeps the way out they can see. */
function labIsolate(on) {
  ['#editor', '#page', '.statusbar'].forEach(function (sel) {
    const el = document.querySelector(sel);
    if (el && 'inert' in el) el.inert = on;
  });
}

/* Below this the app reads but does not build — see the media query at the end of styles.css, which
   gates the Code and Game tabs the same way. Kept in step with that 700px by being the only other
   place the number appears. */
const BUILD_MIN_WIDTH = 700;
function tooSmallToBuild() { return window.innerWidth < BUILD_MIN_WIDTH; }

function openLab(lab) {
  const view = $('labView'); if (!view) return;
  /* Refused at the door rather than covered afterwards, unlike the two tabs. A lab takes over the
     whole screen, so an overlay on top of one would have to reinvent the close button underneath
     it — and unlike a tab, nothing is lost by simply not opening: the card stays where it was. */
  if (tooSmallToBuild()) {
    modal({ title: 'Open this on a computer',
      message: 'This lab is a code editor and a screen to run it on, which need a bigger screen and '
        + 'a keyboard. The lesson around it reads fine here — carry on, and come back to the lab '
        + 'on a computer.',
      okLabel: 'OK', hideCancel: true });
    return;
  }
  if (openLabRef) closeLab();
  openLabRef = lab;
  labReturnFocus = (lab.card && lab.card.open) || null;

  $('labTitle').textContent = lab.c.title || 'Lab';

  const brief = $('labBrief'); brief.innerHTML = '';
  if (lab.c.task) {
    const t = document.createElement('div'); t.className = 'ch-task';
    t.innerHTML = inlineMd(lab.c.task); brief.appendChild(t);
  }

  const screen = $('labScreen'); screen.innerHTML = '';
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');       // opaque origin: lab code cannot reach the app
  frame.setAttribute('title', 'Lab output');
  screen.appendChild(frame);

  labConsoleClear();
  /* Open by default. Printing a value to find out what it is is the whole debugging technique this
     course teaches, and a log the student has to notice and unfold first is a log they will not
     read. Their own decision to collapse it still sticks — see labConsoleShut. */
  labConsoleOpen(!labConsoleShut);
  /* The tutor dock starts hidden every time and comes back only if this lab has already unlocked
     it — it is per-lab, not per-session, so opening a fresh lab does not inherit the last one's. */
  const tutorDock = $('labTutor');
  /* Unlocked is not the same as open: reopening a lab shows the bench, not a chat panel sitting
     over it. The robot in the bar is lit, and pressing it is the student's call. */
  if (tutorDock) { tutorDock.hidden = true; $('labTutorBody').innerHTML = ''; }
  lab.tutorGreeted = false;
  wireLabChatBox();
  labConsoleOpen(!labConsoleShut);

  const host = $('labEditor'); host.innerHTML = '';
  let editor = null, ta = null;
  if (typeof CodeMirror === 'function') {
    /* The gutters are declared up front even though the addons that fill them arrive later —
       CodeMirror needs the gutter to exist before foldGutter or the lint markers can use it. Same
       reasoning as the Code tab's editor in js/editor.js. */
    editor = CodeMirror(host, {
      value: lab.code, mode: 'javascript', theme: 'material-darker',
      lineNumbers: true, tabSize: 2, indentUnit: 2, matchBrackets: true, autoCloseBrackets: true,
      gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      extraKeys: {
        // No Ctrl-Enter to run: the transport row at the foot is the way, and one visible control
        // beats a shortcut a ten-year-old has to be told about.
        'Ctrl-Space': 'autocomplete',
        'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent'
      }
    });
    const cursor = $('labCursor');
    if (cursor) {
      const showPos = function (cm) {
        const p = cm.getCursor();
        cursor.textContent = 'Ln ' + (p.line + 1) + ', Col ' + (p.ch + 1);
      };
      editor.on('cursorActivity', showPos); showPos(editor);
    }
    // Suggest as you type, the same way the Code tab does.
    editor.on('inputRead', function (cm, e) {
      if (e.text && /[\w.]/.test(e.text[0]) && !cm.state.completionActive && CodeMirror.hint && CodeMirror.hint.anyword) {
        cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false });
      }
    });
  } else {
    ta = document.createElement('textarea'); ta.className = 'ch-code';
    ta.spellcheck = false; ta.value = lab.code; host.appendChild(ta);
  }

  lab.ui = {
    frame: frame, brief: brief, editor: editor, hintEl: null, solveEl: null,
    read: function () { return editor ? editor.getValue() : ta.value; },
    write: function (v) { if (editor) editor.setValue(v); else ta.value = v; }
  };
  const keep = function () { lab.code = lab.ui.read(); lab.touched = true; labSave(lab, { code: lab.code }); };
  if (editor) editor.on('blur', keep); else ta.addEventListener('blur', keep);

  /* The linter, the folding, the search dialog and the hint addons are about 2 MB and do not load
     at boot (js/lazy.js). The bench opens immediately with a plain editor and upgrades in place
     when they arrive — a lab about reading an error deserves the same squiggles as the Code tab,
     but not at the cost of waiting for them. A failure here leaves a working editor, because being
     unable to lint is much better than being unable to type. */
  if (editor && typeof loadCodeTools === 'function') {
    loadCodeTools().then(function () {
      if (openLabRef !== lab || !lab.ui || lab.ui.editor !== editor) return;   // they left already
      editor.setOption('styleActiveLine', true);
      editor.setOption('foldGutter', true);
      if (typeof LINT_OPTS !== 'undefined') editor.setOption('lint', LINT_OPTS);
      editor.refresh();
    }).catch(function (e) {
      console.warn('[league] the lab editor is running without its extras:', e.message);
    });
  }

  if (lab.fails >= LAB_REVEAL_AFTER && !lab.revealed) labOfferSolution(lab);
  paintLabAI(lab);
  paintLabTransport(lab);

  view.hidden = false;
  if (typeof syncRoute === 'function') syncRoute();   // the open bench has its own address

  /* Show the broken thing before asking them to fix it.
     The bench used to open on an empty screen, so the first question — "what does it do wrong?" —
     could not be answered without pressing Play, and pressing Play spent an attempt. This runs the
     code once for the picture only: no attempt counted, no goal checked, and win() ignored, so a
     lab that happens to pass on its starter code cannot complete itself by being looked at.
     AFTER the view is shown, not before: the document sizes its canvas from window.innerWidth, and
     inside a hidden element that is zero. */
  labPreview(lab);
  labIsolate(true);
  paintAIBtn();
  paintLabStatus(lab);
  // The editor gets focus: it is what the student came here to do, and the task is right above it.
  if (editor) { editor.refresh(); editor.focus(); } else if (ta) ta.focus();
}

function closeLab() {
  const lab = openLabRef; if (!lab) return;
  clearTimeout(lab.settleTimer);
  if (lab.ui) { lab.code = lab.ui.read(); labSave(lab, { code: lab.code }); }
  lab.ui = null; lab.running = false; lab.error = ''; lab.settled = false;
  lab.started = false; lab.paused = false;
  const tutorDock = $('labTutor');
  if (tutorDock) { tutorDock.hidden = true; $('labTutorBody').innerHTML = ''; }
  openLabRef = null;
  if (typeof syncRoute === 'function') syncRoute();   // back to the lesson's own address

  $('labEditor').innerHTML = '';
  $('labScreen').innerHTML = '';        // drops the frame, which stops whatever it was running
  $('labBrief').innerHTML = '';
  labConsoleClear();
  labConsoleOpen(false);
  $('labView').hidden = true;
  labIsolate(false);
  paintAIBtn();
  paintLabCard(lab);

  if (labReturnFocus) { try { labReturnFocus.focus(); } catch (e) {} }
  labReturnFocus = null;

  /* A lab can be the last thing a lesson needed. The move to the next lesson waits until the
     student is back looking at the lesson, rather than happening behind the bench. */
  if (labPendingAdvance) { const f = labPendingAdvance; labPendingAdvance = null; startAdvance(f); }
}

/* The still picture the bench opens on. Deliberately not labRun: no attempt is opened, nothing is
   marked failed, the status line stays quiet, and the win flag is set so a win() from this run is
   ignored. It exists so the first thing a student sees is the bug, not a blank rectangle. */
function labPreview(lab) {
  if (!lab || !lab.ui || lab.solved) return;
  lab.previewing = true;
  lab.started = true; lab.paused = false;
  var __pr = lab.ui.frame.getBoundingClientRect();
  lab.ui.frame.srcdoc = labDoc(lab.tok, lab.code, __pr.width, __pr.height);
  clearTimeout(lab.previewTimer);
  /* Freeze it after a beat. An animating lab would otherwise run forever behind a lesson the
     student has gone back to reading, and the frame it stops on is the one worth looking at. */
  lab.previewTimer = setTimeout(function () {
    if (openLabRef !== lab || !lab.previewing) return;
    lab.paused = true; labSend(lab, 'pause');
    paintLabTransport(lab);
  }, 2200);
  paintLabTransport(lab);
}

function labRun() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  lab.previewing = false;             // from here on it is a real attempt and win() counts
  clearTimeout(lab.previewTimer);
  /* When does a run count as failed? Not "did it win within 900ms" — one lab animates a ship
     across the screen and needs about 1.4 seconds, so that question marked a CORRECT answer as a
     failure. A run counts as failed when the student runs AGAIN without having won in between:
     honest, and it can never mislabel a slow success. A thrown error counts straight away. */
  if (lab.attemptOpen) labFail(lab);
  lab.attemptOpen = true;
  lab.running = true; lab.error = ''; lab.settled = false;
  lab.started = true; lab.paused = false;      // the transport row has something to control now
  lab.code = lab.ui.read(); lab.touched = true;
  labSave(lab, { code: lab.code });
  paintLabStatus(lab); paintLabTransport(lab);
  // Each run starts with a clean log, so what is on screen belongs to the run being looked at.
  labConsoleClear();
  var __rr = lab.ui.frame.getBoundingClientRect();
  lab.ui.frame.srcdoc = labDoc(lab.tok, lab.code, __rr.width, __rr.height);

  /* Long enough that a slow-but-correct lab is never called unfinished — one of these animates a
     ship across the screen and takes about 1.4 seconds to win. This only changes what the status
     line says; whether a run counts as FAILED is still decided by the student running again. */
  clearTimeout(lab.settleTimer);
  lab.settleTimer = setTimeout(function () {
    if (openLabRef !== lab || !lab.running) return;
    lab.running = false; lab.settled = true;
    /* Pause, do not stop. The verdict arrives at the same moment the screen would have gone blank,
       so a student read "it ran, but the goal is not met" with nothing left to look at — the one
       thing the sentence is asking them to look at. Frozen on its last frame, they can read the
       message and see what it is describing, and Play carries on from there. */
    if (lab.started && !lab.paused) { lab.paused = true; labSend(lab, 'pause'); }
    paintLabStatus(lab); paintLabTransport(lab);
  }, 2200);
}

/* ---------- transport ----------
   Play, pause, stop, restart, in the shape anything that moves has had since tape decks. The bench
   used to offer Run and nothing else, so the only way to look closely at a moving box was to run it
   again and try to catch it, and the only way to make it stop was to leave. */
function labSend(lab, cmd) {
  try { lab.ui.frame.contentWindow.postMessage({ __labctl: cmd }, '*'); } catch (e) {}
}
function labPause() {
  const lab = openLabRef; if (!lab || !lab.ui || !lab.started || lab.paused) return;
  lab.paused = true; labSend(lab, 'pause');
  paintLabTransport(lab); paintLabStatus(lab);
}
function labResume() {
  const lab = openLabRef; if (!lab || !lab.ui || !lab.started || !lab.paused) return;
  lab.paused = false; labSend(lab, 'resume');
  paintLabTransport(lab); paintLabStatus(lab);
}
function labStop() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  clearTimeout(lab.settleTimer);
  lab.ui.frame.removeAttribute('srcdoc');
  lab.started = false; lab.paused = false; lab.running = false; lab.settled = false;
  paintLabTransport(lab); paintLabStatus(lab);
}
function labRestart() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  labStop();
  labRun();
}
/* Play doubles as Resume, because to a student those are the same button and the same idea.
   The opening preview is the exception: it leaves the lab technically started-and-paused, so Play
   was resuming the picture instead of starting a real attempt — the goal was never checked and the
   status line stayed empty. A preview is not a run, so Play on top of one is a run. */
function labPlay() {
  const lab = openLabRef; if (!lab) return;
  if (lab.previewing) { labRun(); return; }
  if (lab.started && lab.paused) { labResume(); return; }
  labRun();
}
/* Same three states as the Game tab's transport, drawn the same way: start it, carry on from where
   you froze it, or run it again from the top. Reset is separate and always available, because
   putting the starter code back is not a run control — it is the way out of a mess. */
function paintLabTransport(lab) {
  const live = !!(lab && lab.started);
  /* The opening preview does not count as having run. Pause and Stop still work on it — something
     IS on screen — but the primary button says Play, because from the student's side nothing has
     been run yet. It used to open showing Restart, offering to redo a thing they had not done. */
  const on = live && !lab.previewing;
  const pause = $('labPause'), stop = $('labStop'), run = $('labRun');
  if (pause) pause.disabled = !live || lab.paused;
  if (stop) stop.disabled = !live;
  if (run) {
    run.classList.toggle('on', on && !lab.paused);
    const icon = !on ? 'mdi-play' : (lab.paused ? 'mdi-play' : 'mdi-restart');
    const label = !on ? 'Play' : (lab.paused ? 'Resume' : 'Restart');
    run.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    run.setAttribute('aria-label', label);
    run.title = label === 'Play' ? 'Run it'
      : (label === 'Resume' ? 'Carry on from where you paused' : 'Run it again from the top');
  }
}

/* The robot in the lab bar and the model tag in the panel header. The panel is the assistant, not a
   separate "help" surface with its own rules — there is no gate on it and nothing to earn first.
   A hint ladder lived here and is gone: two overlapping ways to ask for help, one of which had to be
   spent before the other unlocked, in a panel a student already knows how to use from the lesson. */
function paintLabAI(lab) {
  const tut = $('labTutorBtn');
  const open = !$('labTutor').hidden;
  if (tut) {
    /* Only on screen while the panel is out, exactly like the shell's collapsed-assistant button. */
    tut.hidden = open;
    tut.setAttribute('aria-expanded', String(open));
  }
  /* The model, same as the assistant's own header shows — it is the same tutor behind both. */
  const tag = $('labTutorTag');
  if (tag) {
    const spec = (typeof aiModels !== 'undefined' && aiModels.tutor) || '';
    tag.textContent = spec.replace(/^[^:]+:/, '') || '…';
    tag.title = spec;
  }
}

function labToggleTutor() {
  const lab = openLabRef; if (!lab) return;
  const dock = $('labTutor'); if (!dock) return;
  dock.hidden = !dock.hidden;
  if (!dock.hidden) {
    /* Greeted once per opening of the bench, not once per toggle — hiding the panel and bringing it
       back should not restart the conversation. */
    if (!lab.tutorGreeted) {
      lab.tutorGreeted = true;
      /* The same greeting the assistant gives on the lesson, pointed at the lab. One tutor, one
         voice, wherever a student meets it. */
      labTutorSay('bot', "Hi! I'm your Tutor. Ask me anything about this lab and I'll explain it — "
        + "I won't write it for you.");
      /* Three questions about THIS lab, drawn from content/questions.yaml. A stuck student staring
         at a blank box is exactly who this panel is for, and they are the least likely to know what
         to type into it. */
      if (typeof loadQuestions === 'function') {
        loadQuestions().then(function () {
          renderStarters('lab', $('labTutorBody'), function (text) {
            const b = $('labTutorText'); if (b) { b.value = text; if (typeof growTextarea === 'function') growTextarea(b); }
            labTutorSubmit();
          }, 'tutor');
        });
      }
    }
    const b = $('labTutorText'); if (b) b.focus();
  }
  paintLabAI(lab);
}
/* ---------- the tutor, inside the bench ----------
   Unlocked by working through the hints, and it stays here. Sending a stuck student out to the
   lesson to find a chat panel asks them to leave the thing they are stuck on, and the bench makes
   the rest of the app inert anyway, so there was nothing to go back to without closing first.
   It gets what a human helper leaning over the desk would have: the task, the code actually in the
   editor right now, and what the last run printed. */
/* Unlock the tutor without opening it. Called when the last hint is taken, and by the worked-answer
   path so a student who got there by failing repeatedly is not locked out of the one door left. */
function labOfferTutor(lab) {
  if (lab.tutorOffered) return;
  lab.tutorOffered = true;
  labSave(lab, { tutorOffered: true });
  paintLabAI(lab);
}
function labTutorSay(who, text) {
  const body = $('labTutorBody'); if (!body) return null;
  const el = document.createElement('div');
  /* The shell's own bubble classes, not a lookalike pair. They already carry the wrapping, the
     pre-wrap that keeps a pasted snippet's line breaks, and the Markdown styling for replies. */
  el.className = 'msg ' + who;
  if (who === 'bot' && typeof mdToSafeHTML === 'function') {
    try { el.innerHTML = mdToSafeHTML(text); } catch (e) { el.textContent = String(text); }
  } else el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}
function labTutorAsk(question) {
  const lab = openLabRef; if (!lab || !question) return;
  labTutorSay('user', question);
  const pending = labTutorSay('bot', 'Thinking…');
  /* Recent turns, so "what about that line?" means something. Kept on the lab rather than in the
     shell's chat store: this is a different conversation about a different thing, and mixing it
     into the lesson chat is how the tutor ends up answering one about the other. */
  if (!lab.chat) lab.chat = [];
  const history = lab.chat.slice(-6);
  lab.chat.push({ role: 'user', content: question });
  if (typeof setChatBusy === 'function') setChatBusy($('labTutorText'), true);
  const log = labLog.map(function (l) { return '[' + l.level + '] ' + l.text; }).join('\n').slice(0, 1200);
  /* The `lab-tutor` agent, not `tutor`. The lesson tutor's prompt is built around {{gameCode}} —
     the student's GAME — and it has no slot for anything else, so the lab context sent as a stray
     `context` field was silently dropped by fill() and the model answered about game.js and Phaser
     to a student looking at a canvas exercise containing neither. Its own agent, its own slots. */
  fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'lab-tutor', message: question, history: history,
      lab: {
        title: lab.c.title || '',
        task: lab.c.task || '',
        goal: lab.c.goal || '',
        code: (lab.ui ? lab.ui.read() : lab.code) || '',
        log: log
      },
      lessonTitle: (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx].l.t : ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      const reply = (d && d.reply) || '—';
      if (pending) pending.textContent = reply;
      lab.chat.push({ role: 'assistant', content: reply });
    })
    .catch(function () { if (pending) pending.textContent = 'Could not reach the tutor.'; })
    .finally(function () { if (typeof setChatBusy === 'function') setChatBusy($('labTutorText'), false); });
}
function labTutorSubmit() {
  const box = $('labTutorText'); if (!box) return;
  const q = box.value.trim(); if (!q) return;
  box.value = '';
  if (typeof growTextarea === 'function') growTextarea(box);
  labTutorAsk(q);
}
if ($('labTutorForm')) $('labTutorForm').addEventListener('submit', function (e) { e.preventDefault(); labTutorSubmit(); });
/* Wired on first use, not at load. wireChatBox lives in js/ai.js, which the page loads AFTER this
   file — so doing it up here found nothing, skipped silently past the `typeof` guard, and left the
   lab's box as a textarea that never grew. Anything this file borrows from a later script has to
   be reached for at runtime. */
let labChatWired = false;
function wireLabChatBox() {
  if (labChatWired || typeof wireChatBox !== 'function') return;
  labChatWired = true;
  wireChatBox($('labTutorText'), labTutorSubmit);
}
if ($('labTutorHide')) $('labTutorHide').addEventListener('click', function () {
  $('labTutor').hidden = true;
  if (openLabRef) paintLabAI(openLabRef);
});
if ($('labTutorBtn')) $('labTutorBtn').addEventListener('click', labToggleTutor);

/* Destructive, so it asks. It throws away everything the student typed in this lab, and it used to
   do that on a single click of a button sitting in the top bar where a stuck child is most likely
   to be clicking things. */
function labResetAsk() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  if (!lab.touched) { labResetToStart(); return; }   // nothing of theirs to lose
  modal({
    title: 'Put the starter code back?',
    message: 'This throws away the changes you have made in this lab and starts you from the '
      + 'original code again. Your hints and your game are not affected.',
    okLabel: 'Reset it',
    onOk: labResetToStart
  });
}
function labResetToStart() {
  const lab = openLabRef; if (!lab || !lab.ui) return;
  lab.ui.write(lab.startCode);
  lab.code = lab.startCode;
  clearTimeout(lab.settleTimer);
  lab.fails = 0; lab.revealed = false; lab.attemptOpen = false;
  lab.running = false; lab.error = ''; lab.settled = false; lab.touched = false;
  lab.started = false; lab.paused = false;
  if (lab.ui.solveEl) { lab.ui.solveEl.remove(); lab.ui.solveEl = null; }
  lab.ui.frame.removeAttribute('srcdoc');
  labConsoleClear();
  clearLabState(lab.lessonId, lab.key);
  paintLabStatus(lab); paintLabTransport(lab);
}

/* Play doubles as Resume and, once running, as Restart — one button, three states, exactly as the
   Game tab's does. */
if ($('labRun')) $('labRun').addEventListener('click', function () {
  const lab = openLabRef;
  if (lab && lab.started && !lab.paused) { labRestart(); return; }
  labPlay();
});
if ($('labPause')) $('labPause').addEventListener('click', labPause);
if ($('labStop')) $('labStop').addEventListener('click', labStop);
if ($('labReset')) $('labReset').addEventListener('click', labResetAsk);
if ($('labBack')) $('labBack').addEventListener('click', closeLab);
if ($('labConToggle')) $('labConToggle').addEventListener('click', function () {
  const opening = $('labConsole').classList.contains('collapsed');
  labConsoleShut = !opening;              // closing it by hand is a preference, and it sticks
  labConsoleOpen(opening);
});
if ($('labConClear')) $('labConClear').addEventListener('click', labConsoleClear);
labConsoleClear();
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && openLabRef) { closeLab(); e.preventDefault(); }
});

/* Every lab in the lesson on screen, in document order. The router needs to be able to open one
   from a URL, and it has no other way to reach an object built inside this closure. Cleared per
   lesson by renderChallengeCells, which runs once per render. */
