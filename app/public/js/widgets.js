/* widgets.js — In-lesson widgets: runnable cells, the five quiz types, and challenge minigames. Each runs in its own sandboxed iframe and reports back by token. */
/* Lesson widgets (run cells, challenge minigames) each run in their own sandboxed iframe and
   post results back by token. ONE delegating listener serves them all: a cell registers a
   handler under its token, and re-rendering a lesson clears the registry — otherwise every
   lesson render would leave another permanent window listener behind. */
const widgetHandlers = {};
window.addEventListener('message', function (e) {
  const d = e && e.data; if (!d || !d.tok) return;
  const fn = widgetHandlers[d.tok]; if (fn) fn(d);
});
function resetWidgetHandlers() { Object.keys(widgetHandlers).forEach(function (k) { delete widgetHandlers[k]; }); }

/* ---------- stable widget keys ----------
   Widgets used to identify themselves with Math.random(), which meant nothing about a lesson
   could be remembered: a new id every render. Keys are now the widget's position in the lesson
   by kind — q0, q1, r0, c0 — which is the same on every render and after a reload, so the
   activity ledger in project.js has something durable to hang answers on. */
let lessonWidgetId = '';
let widgetSeq = { q: 0, r: 0, c: 0, y: 0, z: 0 };   // z: building zones, see js/zone.js
let goalRunKeys = [];        // run cells that declare @expect — the only ones that can be "finished"
function beginLessonWidgets(lessonId) {
  lessonWidgetId = lessonId || ''; widgetSeq = { q: 0, r: 0, c: 0, y: 0, z: 0 }; goalRunKeys = [];
  pendingBuilds = []; revealQueue = [];
  clearTimeout(revealFailsafe);
}
function nextWidgetKey(kind) { return kind + (widgetSeq[kind]++); }
function widgetToken(key) { return (lessonWidgetId || 'l') + ':' + key; }

/* ---------- building and revealing as the student scrolls ----------
   Two jobs on one sweep: build the expensive blocks shortly before they are needed, and fade each
   block in as it arrives.

   Measured before writing any of this, because the version of this idea in the plan was wrong about
   where the cost is. A lesson's whole widget build is 1.6ms for the-core-loop and 3.8ms for
   data-out-of-code — nothing worth deferring. The exception is run cells, which cost ~15ms each
   because every one creates a CodeMirror instance: decisions-and-repeats spends 46.6ms of its 48.7ms
   there. Those numbers are from a fast desktop, so call it 150-250ms of jank on a school Chromebook.
   So run cells are deferred and nothing else is. Quizzes, labs and practice steps stay eager, which
   matters for more than speed: a practice step takes its "before" snapshot when it renders, and
   deferring that to "when the student scrolls near it" would take the snapshot AFTER work they had
   already done and fail exactly the student who did the task properly.

   LOOKAHEAD is the whole trick. Everything happens well before the block is on screen, so nothing
   the student is looking at changes size, and no text is ever withheld from someone who has already
   scrolled to it. A reveal that makes you wait for the paragraph you are reading is worse than no
   reveal at all. */
const LOOKAHEAD = 600;      // build this far ahead of the viewport
/* Start the fade this far ahead, so it has finished before you arrive. Raised from 140 when the
   fade grew to 420ms with up to 210ms of stagger: the lead has to cover the whole animation, or a
   more noticeable reveal just means being handed a paragraph that is still moving. */
const REVEAL_AHEAD = 260;
let pendingBuilds = [], revealQueue = [], revealFailsafe = 0;
/* Every live picture currently on the page, so the same scroll sweep that builds blocks can also
   stop the ones nobody is looking at any more. See the demo notes above buildRunCell. */
let liveDemos = [];
/* Switching tab is the other kind of "nobody is looking at it", and no scroll event announces it.
   Cheap insurance on a school laptop, where a lesson left open in a background tab would otherwise
   animate into the battery all lunchtime. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) liveDemos.forEach(function (d) { if (d.playing()) d.stop(); });
});

function deferBlock(el, build) { pendingBuilds.push({ el: el, build: build }); }

function nearViewport(el, margin) {
  const view = $('view-learn'); if (!view || !el || !el.isConnected) return true;
  const vr = view.getBoundingClientRect(), r = el.getBoundingClientRect();
  return r.top < vr.bottom + margin && r.bottom > vr.top - margin;
}

/* Read every position, THEN write every class. Never interleaved.
   The first version did `getBoundingClientRect()` and `classList.add()` in the same loop, which
   makes the browser re-layout on each iteration to answer the next measurement — thirty times over.
   Measured: it turned a 1.6ms lesson build into 12.8ms, so the reveal cost more than the run cells
   it was helping to defer. Batching the reads apart from the writes is the whole fix. */
function sweepLesson() {
  const view = $('view-learn'); if (!view) return;
  const vr = view.getBoundingClientRect();
  const near = function (el, margin) {
    const r = el.getBoundingClientRect();
    return r.top < vr.bottom + margin && r.bottom > vr.top - margin;
  };

  if (pendingBuilds.length) {
    const due = [], keep = [];
    pendingBuilds.forEach(function (p) {                       // read
      if (!p.el || !p.el.isConnected) return;                  // the lesson changed under us
      if (near(p.el, LOOKAHEAD)) due.push(p); else keep.push(p);
    });
    pendingBuilds = keep;
    due.forEach(function (p) {                                 // write
      // A build that throws must not take the sweep — and therefore every later block — with it.
      try { p.build(); }
      catch (e) { console.warn('[league] a lesson block failed to build: ' + (e && e.message)); }
    });
  }

  if (revealQueue.length) {
    const due = [], keep = [];
    revealQueue.forEach(function (el) {                        // read
      if (!el || !el.isConnected) return;
      if (near(el, REVEAL_AHEAD)) due.push(el); else keep.push(el);
    });
    revealQueue = keep;
    due.forEach(function (el, n) {                             // write
      // Stagger a burst so blocks arrive in sequence rather than as one slab. Capped, because a
      // delay long enough to notice on the sixth block is a delay long enough to annoy.
      if (n) el.style.setProperty('--rd', Math.min(n * 70, 210) + 'ms');
      el.classList.add('shown');
    });
  }

  /* A demo that has scrolled off is finished with. Without this, every one a student ever started
     keeps a requestAnimationFrame loop running behind the rest of the lesson.

     This uses the same scroll sweep as the builds and the reveals rather than an
     IntersectionObserver, so there is one answer in this file to "is this on screen?" — and it is
     the one that is already known to work everywhere the app runs. Reads first, writes after, like
     the two above it. */
  if (liveDemos.length) {
    const gone = [];
    liveDemos.forEach(function (d) {                           // read
      if (d.el.isConnected && d.playing() && !near(d.el, 0)) gone.push(d);
    });
    liveDemos = liveDemos.filter(function (d) { return d.el.isConnected; });
    gone.forEach(function (d) { d.stop(); });                  // write
  }
}
/* Called straight from the scroll handler, NOT behind requestAnimationFrame.
   rAF looks like the right tool for coalescing scroll work, and it was the first version — but rAF
   does not fire in a browser that is not compositing (a background tab, or this project's own
   preview pane), and a stalled sweep means a run cell that never becomes editable. The work being
   coalesced is a handful of getBoundingClientRect calls against queues that drain to empty and then
   cost nothing, so there was nothing worth the risk. */
function queueSweep() { sweepLesson(); }
/* Everything visible, unconditionally. The safety net: if the sweep never runs — a thrown error, a
   browser that does not fire scroll the way we expect — a student must never be left looking at a
   blank page because of an animation. */
function revealAll() {
  revealQueue.forEach(function (el) { if (el && el.isConnected) el.classList.add('shown'); });
  revealQueue = [];
}
/* Arm the reveal: only blocks that start BELOW the fold animate. The first screen is shown
   immediately, because a lesson that fades itself in every time you navigate to it is a lesson that
   feels slow, and the effect the student asked for is one they see while scrolling. */
function armReveal(root) {
  const view = $('view-learn'); if (!view || !root) return;
  const fold = view.getBoundingClientRect().bottom;
  const kids = [].slice.call(root.children);
  const below = [];
  for (let i = 0; i < kids.length; i++) {                       // read phase, no writes at all
    if (kids[i].getBoundingClientRect().top > fold) below.push(kids[i]);
  }
  for (let i = 0; i < below.length; i++) below[i].classList.add('willshow');   // write phase
  revealQueue = below;
  clearTimeout(revealFailsafe);
  revealFailsafe = setTimeout(revealAll, 4000);
  queueSweep();
}

/* ---------- the live picture under a slider cell ----------
   A run cell with `// @demo: name` gets a canvas between the editor and the output, driven by the
   same sliders. See demos.js for what a draw function may and may not touch.

   Three things about this are deliberate:

   1. It is a DIFFERENT iframe from the code sandbox. The code sandbox is rebuilt on every slider
      input; rebuilding an animation on every input would restart it sixty times during one drag.
      This one is built once and fed values over postMessage.
   2. It starts PAUSED, showing its first frame. A lesson page with five demos all animating is a
      fairground, and on a school laptop it is also five rAF loops burning battery behind text
      nobody is reading yet.
   3. It stops again after ten seconds of nobody touching it, and when it scrolls out of view. The
      student came here to read; the demo is not entitled to the machine for the rest of the lesson.

   Paused is a visible state, not a mysterious frozen box — the veil says so and clicking it plays. */
const DEMO_IDLE_MS = 10000;
/* Read once from the real stylesheet so a demo cannot drift from the app's colours, and so a
   palette change lands in the pictures too. */
let DEMO_PALETTE = null;
function demoPalette() {
  if (DEMO_PALETTE) return DEMO_PALETTE;
  const cs = getComputedStyle(document.documentElement);
  const g = function (n, fb) { const s = (cs.getPropertyValue('--' + n) || '').trim(); return s || fb; };
  DEMO_PALETTE = {
    bg: g('bg', '#0a1728'), panel: g('panel', '#0f2440'), line: g('line', '#223a58'),
    ink: g('ink', '#eaf1f8'), muted: g('muted', '#9fb2cc'), dim: g('dim', '#8b9db1'),
    azure: g('azure', '#3e8fd6'), gold: g('gold', '#f5b02e'), teal: g('teal', '#2fd0b6'),
    green: g('green', '#3ddc84'), brand: g('brand', '#f5820a')
  };
  return DEMO_PALETTE;
}
/* The harness. Everything a draw function is allowed to lean on is defined in here, because the
   function's SOURCE is inlined into this scope — it cannot close over anything in demos.js. */
function demoDoc(tok, W, H, drawSrc, vals, P) {
  const safe = String(drawSrc).replace(/<\/(script)/gi, '<\\/$1');
  return '<!doctype html><body style="margin:0;overflow:hidden;background:transparent">'
    + '<canvas id="c"></canvas><scr' + 'ipt>(function(){'
    + 'var W=' + W + ',H=' + H + ',P=' + JSON.stringify(P) + ',v=' + JSON.stringify(vals) + ';'
    + 'var c=document.getElementById("c"),ctx=c.getContext("2d"),dpr=1;'
    + 'function size(w,h){W=w;H=h;dpr=Math.min(window.devicePixelRatio||1,2);'
    + 'c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);c.style.width=W+"px";c.style.height=H+"px";'
    + 'ctx.setTransform(dpr,0,0,dpr,0,0);}'
    + 'size(W,H);'
    /* The helpers named in demos.js's contract. Nothing else is in scope. */
    + 'function clamp(n,a,b){return n<a?a:(n>b?b:n);}'
    + 'function lerp(a,b,k){return a+(b-a)*k;}'
    + 'function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);'
    + 'ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}'
    + 'function txt(s,x,y,size,col,align){ctx.fillStyle=col;ctx.textAlign=align||"left";'
    + 'ctx.font=size+"px system-ui,Segoe UI,Roboto,Arial,sans-serif";ctx.fillText(String(s),x,y);ctx.textAlign="left";}'
    + 'var draw=' + safe + ';'
    + 'var playing=false,s={},t=0,last=0,raf=0,dead=false;'
    /* t only advances while playing, so moving a slider on a paused demo redraws the same instant
       rather than jumping forward by however long the student was reading. */
    + 'function one(now){var d=last?Math.min(now-last,64):16;last=now;if(playing)t+=d;'
    + 'ctx.clearRect(0,0,W,H);'
    + 'if(dead)return;'
    + 'try{draw(ctx,W,H,v,t,s,d,P);}catch(e){dead=true;'
    + 'txt("this demo is broken: "+e.message,10,20,11,P.gold,"left");}}'
    + 'function loop(now){one(now);if(playing){raf=requestAnimationFrame(loop);}else{raf=0;}}'
    + 'function paint(){if(!raf)requestAnimationFrame(function(n){one(n);});}'
    + 'requestAnimationFrame(function(n){last=0;one(n);});'
    + 'addEventListener("message",function(e){var d=e.data||{};if(d.__demo!=="' + tok + '")return;'
    + 'if(d.w)size(d.w,d.h);'
    + 'if(d.vals){for(var k in d.vals)v[k]=d.vals[k];}'
    + 'if(typeof d.playing==="boolean"&&d.playing!==playing){playing=d.playing;last=0;'
    + 'if(playing&&!raf)raf=requestAnimationFrame(loop);}'
    + 'if(!playing)paint();});'
    + '})();</scr' + 'ipt></body>';
}

/* ```run — editable JS cell. Directives (as // @lines): @goal: <text>, @expect: <substring>, @slider: name min max step value, @demo: name */
function renderRunCells(root) {
  const codes = [].slice.call(root.querySelectorAll('pre > code.language-run'));
  /* Keys and goal keys are allocated NOW, in document order, even though each cell is built when the
     student scrolls near it. A key that depended on build order would differ between a student who
     scrolls fast and one who scrolls slowly, which would silently orphan a saved answer — and
     goalRunKeys decides how many activities the lesson has, so counting them lazily would make the
     progress total climb while the student scrolled and the rail go backwards. */
  codes.forEach(function (code) {
    code.setAttribute('data-wkey', nextWidgetKey('r'));
    if (/^\s*\/\/\s*@expect:\s*\S/m.test(code.textContent)) goalRunKeys.push(code.getAttribute('data-wkey'));
  });
  /* The un-built state needs no placeholder: a run cell's `pre` already shows the code as an
     ordinary code block, which is exactly what it is until it becomes editable. */
  codes.forEach(function (code) { deferBlock(code.parentNode, function () { buildRunCell(code); }); });
}
function buildRunCell(code) {
  {
    const pre = code.parentNode; const raw = code.textContent;
    let goal = '', expect = '', demoName = ''; const sliders = []; const bodyLines = [];
    raw.split('\n').forEach(function (ln) {
      let m;
      if (m = ln.match(/^\s*\/\/\s*@goal:\s*(.+)$/)) goal = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@expect:\s*(.+)$/)) expect = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@demo:\s*([A-Za-z_$][\w$]*)\s*$/)) demoName = m[1];
      else if (m = ln.match(/^\s*\/\/\s*@slider:\s*([A-Za-z_$][\w$]*)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/)) sliders.push({ name: m[1], min: +m[2], max: +m[3], step: +m[4], value: +m[5] });
      else bodyLines.push(ln);
    });
    // Trailing blank lines too, not just leading: a fence's closing newline was showing up as an
    // extra empty line in the editor, which is most of the "gap under the code".
    const src = bodyLines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
    // Stamped during the census above, so it is the key this cell would have had either way.
    const key = code.getAttribute('data-wkey'), tok = widgetToken(key);
    const cell = document.createElement('div'); cell.className = 'runcell';
    /* The goal line is also the cell's header row, and Run sits at the right of it — the same shape
       as every other block: what this is on the left, what to do about it on the right. It used to
       have a bar of its own between the code and the output, which put the one button in the cell
       halfway down it with the answer appearing below. */
    const head = document.createElement('div'); head.className = 'run-goal';
    if (goal) { head.innerHTML = '<span class="mdi mdi-target"></span>'; head.appendChild(document.createTextNode(goal)); }
    const side = document.createElement('div'); side.className = 'run-side';
    head.appendChild(side);
    const sEls = {};
    if (sliders.length) {
      const sw = document.createElement('div'); sw.className = 'run-sliders';
      sliders.forEach(function (s) {
        const row = document.createElement('label'); row.className = 'run-slider';
        const nm = document.createElement('span'); nm.className = 'rs-name'; nm.textContent = s.name + ' = ';
        const val = document.createElement('b'); val.textContent = s.value; nm.appendChild(val);
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = s.value;
        inp.addEventListener('input', function () { val.textContent = inp.value; run(); demoPoke(); });
        sEls[s.name] = inp; row.appendChild(nm); row.appendChild(inp); sw.appendChild(row);
      });
      cell.appendChild(sw);
    }
    /* A real editor rather than a <textarea>: the run cell is where a lesson first shows a child
       actual JavaScript, and it was the one code surface with no colouring at all. It also sizes
       itself to the code, which is what removes the empty box under a one-line example. */
    const host = document.createElement('div'); host.className = 'run-editor';
    const ta = document.createElement('textarea'); ta.value = src; ta.spellcheck = false;
    let editor = null;
    if (typeof CodeMirror === 'function') {
      editor = CodeMirror(host, {
        value: src, mode: 'javascript', theme: 'material-darker',
        tabSize: 2, indentUnit: 2, matchBrackets: true, autoCloseBrackets: true,
        viewportMargin: Infinity
      });
    } else { ta.rows = Math.max(1, src.split('\n').length); host.appendChild(ta); }
    const readCode = function () { return editor ? editor.getValue() : ta.value; };

    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'runbtn'; btn.innerHTML = '<span class="mdi mdi-play"></span>Run';
    const status = document.createElement('span'); status.className = 'run-status';
    /* The iframe is here to RUN the code safely, not to show it. A run cell only ever produces
       console text, and that text already comes back over postMessage — so it is rendered in the
       page, where it fits its content exactly. Sizing an iframe to its contents means guessing a
       height for a box that scrolls independently, and the guess was wrong whenever the output
       wrapped or the panel was resized. The sandbox stays, at zero size. */
    const out = document.createElement('iframe'); out.className = 'runsandbox'; out.setAttribute('sandbox', 'allow-scripts');
    out.setAttribute('title', 'Code sandbox'); out.setAttribute('aria-hidden', 'true');
    const outText = document.createElement('pre'); outText.className = 'runout'; outText.setAttribute('aria-live', 'polite');

    /* ---- the live picture, if this cell asked for one ---- */
    const demoDef = (demoName && typeof DEMOS === 'object') ? DEMOS[demoName] : null;
    let demoWrap = null, demoFrame = null, demoVeil = null, demoTimer = 0, demoOn = false;
    function demoVals() {
      const o = {};
      sliders.forEach(function (s) { o[s.name] = +sEls[s.name].value; });
      return o;
    }
    function demoSend(msg) {
      if (!demoFrame || !demoFrame.contentWindow) return;
      msg.__demo = tok;
      try { demoFrame.contentWindow.postMessage(msg, '*'); } catch (e) { /* not loaded yet */ }
    }
    function paintVeil() {
      if (!demoVeil) return;
      demoVeil.classList.toggle('playing', demoOn);
      demoVeil.querySelector('.mdi').className = 'mdi mdi-' + (demoOn ? 'pause' : 'play');
      demoVeil.querySelector('.rd-lbl').textContent = demoOn ? 'Pause' : 'Drag a slider to start it';
    }
    function demoStop() { clearTimeout(demoTimer); demoOn = false; demoSend({ playing: false }); paintVeil(); }
    /* Every interaction — a slider, a click on the picture — restarts the ten seconds. */
    function demoPoke() {
      if (!demoFrame) return;
      demoOn = true;
      demoSend({ vals: demoVals(), playing: true });
      paintVeil();
      clearTimeout(demoTimer);
      demoTimer = setTimeout(demoStop, DEMO_IDLE_MS);
    }
    if (demoDef) {
      demoWrap = document.createElement('div'); demoWrap.className = 'run-demo';
      demoFrame = document.createElement('iframe');
      demoFrame.setAttribute('sandbox', 'allow-scripts');
      demoFrame.setAttribute('title', 'A moving picture of what the sliders do');
      /* The veil covers the whole picture and is the play/pause control. The demo is not
         interactive, so there is nothing underneath for it to be in the way of — and it means a
         student can stop a moving thing by clicking the moving thing, which is where they will
         click anyway. */
      demoVeil = document.createElement('button');
      demoVeil.type = 'button'; demoVeil.className = 'rd-veil';
      const vi = document.createElement('span'); vi.className = 'mdi mdi-play';
      const vl = document.createElement('span'); vl.className = 'rd-lbl';
      demoVeil.appendChild(vi); demoVeil.appendChild(vl);
      demoVeil.addEventListener('click', function () { if (demoOn) demoStop(); else demoPoke(); });
      demoWrap.appendChild(demoFrame); demoWrap.appendChild(demoVeil);
      paintVeil();
    }

    function buildDoc(userCode) {
      const prefix = sliders.map(function (s) { return 'const ' + s.name + ' = ' + sEls[s.name].value + ';'; }).join('\n');
      const safe = (prefix + '\n' + userCode).replace(/<\/(script)/gi, '<\\/$1');
      // The document reports its own height back so the output box can fit the output instead of
      // reserving a fixed 120px and leaving a hole under a single line of text.
      return '<!doctype html><body><pre id="o"></pre><scr' + 'ipt>var o=document.getElementById("o");function w(){o.textContent+=[].slice.call(arguments).join(" ")+"\\n";}console.log=w;console.info=w;console.warn=w;console.error=function(){o.textContent+="\\u26a0 "+[].slice.call(arguments).join(" ")+"\\n";};try{\n' + safe + '\n}catch(e){o.textContent+="\\u26a0 "+e.message+"\\n";}try{parent.postMessage({__runcell:true,tok:"' + tok + '",text:o.textContent},"*");}catch(e){}</scr' + 'ipt></body>';
    }
    function run() { out.srcdoc = buildDoc(readCode()); }

    if (expect) {
      /* goalRunKeys is filled by the census in renderRunCells, not here — a cell that counts toward
         finishing the lesson has to be counted whether or not it has been scrolled to yet. */
      if (activityDone(lessonWidgetId, key)) { status.className = 'run-status ok'; status.textContent = 'Goal met!'; }
    }
    widgetHandlers[tok] = function (d) {
      if (!d.__runcell) return;
      // textContent, never innerHTML: this string is whatever the student's code printed.
      outText.textContent = (d.text || '').replace(/\n+$/, '');
      if (!expect) return;
      const met = (d.text || '').indexOf(expect) >= 0;
      status.className = 'run-status ' + (met ? 'ok' : 'no'); status.textContent = met ? 'Goal met!' : 'Not yet — check the output.';
      if (met) resolveActivity(key);
    };

    /* A cell whose whole point is "drag this and watch the number change" should not also make you
       press Run. Sliders re-run on input, so the button is noise — and the cell starts already
       run, so there is something to watch change. */
    const liveSliders = sliders.length > 0 && !expect;
    side.appendChild(status);
    if (!liveSliders) { btn.addEventListener('click', run); side.appendChild(btn); }
    /* A header with neither a goal nor a button is an empty bar, so it is left out entirely. That is
       a live-slider cell with no @goal: it runs itself and has nothing to announce. */
    if (goal || !liveSliders) cell.insertBefore(head, cell.firstChild);
    cell.appendChild(host);
    if (demoWrap) cell.appendChild(demoWrap);   // between the code and what the code printed
    cell.appendChild(outText); cell.appendChild(out);

    pre.parentNode.replaceChild(cell, pre);
    if (editor) editor.refresh();       // only now does it have a box to measure
    if (liveSliders) run();

    /* The size has to be measured HERE and baked into the document. A sandboxed srcdoc frame has no
       layout at script time — window.innerWidth inside one is 0 — so a demo that sized itself would
       draw into a 3px canvas and then be wiped by the refit. Same trap the lab bench fell into. */
    if (demoDef) {
      const sizeOf = function () {
        const w = Math.max(220, Math.round(demoWrap.clientWidth));
        return { w: w, h: Math.round(Math.min(220, Math.max(110, w * (demoDef.aspect || 0.32)))) };
      };
      let box = sizeOf();
      demoWrap.style.height = box.h + 'px';
      demoFrame.srcdoc = demoDoc(tok, box.w, box.h, demoDef.draw.toString(), demoVals(), demoPalette());
      /* Resized rather than rebuilt: rebuilding would restart the animation every time the reading
         column changed width. Width only — reacting to our own height change would loop. */
      if (typeof ResizeObserver === 'function') {
        let rt = 0;
        new ResizeObserver(function () {
          clearTimeout(rt);
          rt = setTimeout(function () {
            const n = sizeOf();
            if (n.w === box.w) return;
            box = n; demoWrap.style.height = n.h + 'px'; demoSend({ w: n.w, h: n.h });
          }, 120);
        }).observe(demoWrap);
      }
      /* Scrolled away is the same as finished with — handled by sweepLesson, which is already
         watching this scroller for the block builds and the reveals. */
      liveDemos.push({ el: demoWrap, playing: function () { return demoOn; }, stop: demoStop });
    }
  }
}
function shuffleOrder(n) {
  let a = []; for (let i = 0; i < n; i++) a.push(i);
  if (n < 2) return a;
  let tries = 0;
  do { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } tries++; }
  while (a.every(function (v, i) { return v === i; }) && tries < 12);
  return a;
}

/* ---------- a stable shuffle, for the answer options ----------
   All 44 multiple-choice questions in the course are authored `answer: 0`. Every correct answer is
   the first option. That is the natural thing to write — you put the right answer down and then
   think up the wrong ones — and it is fine until the options are drawn in that order, at which
   point the course teaches "click the top one" within about three lessons. Now that clicking an
   option IS answering it, that would be a free pass on every question in the course.
   Shuffling at render fixes it for all 44 at once, and does not need 44 files edited or an author
   to remember. Seeded on the lesson and the question rather than Math.random, so:
     - the order is the same every time this student opens this question, which matters because a
       card that has already been answered is redrawn from the saved answer;
     - and two students, or one student and the answer key, do not have to agree on an order.
   Deliberately NOT used for find-the-bug, where the "options" are lines of code and the order is
   the program, or for put-in-order, where a random order is the whole puzzle. */
function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) || 1;
}
function seededOrder(n, seed) {
  const a = []; for (let i = 0; i < n; i++) a.push(i);
  if (n < 2) return a;
  let s = seed || 1;
  const rnd = function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
/* The YAML inside a widget fence. A parse failure used to be swallowed silently and the widget
   built from an empty object — which renders a card with a heading, no question and no options,
   looking merely sparse rather than broken. Three quiz blocks and two your-turn steps shipped
   that way. It still degrades rather than throwing (one bad block must not take the lesson down)
   but it now says so, so the person authoring the lesson finds out while they are writing it.
   `npm test` catches the same thing ahead of time — see tools/check-lessons.js. */
function parseWidgetYaml(kind, text, key) {
  try {
    const v = jsyaml.load(text);
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    console.warn('[league] ' + kind + ' ' + (key || '?') + ' is empty or is not a set of keys — it will render with nothing in it.');
    return {};
  } catch (e) {
    console.warn('[league] ' + kind + ' ' + (key || '?') + ' has YAML that does not parse, so it will render empty: '
      + String(e.message).split('\n')[0]
      + '\n  A value starting with ` or " or containing ": " has to be wrapped in quotes.');
    return {};
  }
}

/* ---------- one header for every in-lesson activity ----------
   A label saying what KIND of thing this is, then a heading saying what THIS one is. Before this,
   three block types had three conventions: a quiz used its question as the heading with no label, a
   lab hid its label inside the title behind an em-dash, and a practice step had a title and no
   label. Nothing told a student what they had arrived at except an icon.
   `note` is the "2 of 2" chip. The title goes through inlineMd, so a question that names real code
   ("what does `if (lives <= 0)` ask?") shows the code rather than the backticks — which it did
   not before. */
function blockHeader(kind, title, note, action) {
  const h = document.createElement('div'); h.className = 'block-hd';
  const k = document.createElement('span'); k.className = 'block-kind'; k.textContent = kind;
  const t = document.createElement('h3'); t.className = 'block-title'; t.innerHTML = inlineMd(title);
  h.appendChild(k); h.appendChild(t);
  const s = blockSide(h);
  if (note) { const n = document.createElement('span'); n.className = 'block-note'; n.textContent = note; s.appendChild(n); }
  if (action) s.appendChild(action);
  return h;
}

/* Everything that sits to the right of the heading — the "2 of 2" chip, the green tick, and the
   block's one action — shares a single flex row.
   It has to be one container rather than three grid children: .block-note and .block-tick both
   claimed grid-column:2 / grid-row:1 span 2, so on a lesson with two answered quizzes the chip and
   the tick were placed in the SAME cell and drew on top of each other. The rule written to fix
   that (.block-note + .block-tick) re-declared column 2 instead of moving out of it, so it did
   nothing. A flex row cannot have that bug: things in it are laid out in order, by definition. */
function blockSide(head) {
  let s = head.querySelector('.block-side');
  if (!s) { s = document.createElement('div'); s.className = 'block-side'; head.appendChild(s); }
  return s;
}

/* The block's action lives in its header, on the heading line. It used to sit at the bottom of the
   block pushed right with margin-left:auto — which, in a 480px column on a wide screen, left it
   floating in the middle of the page with nothing near it, and put the practice step's two buttons
   at opposite ends of a row. Up here it is against the heading it belongs to. */
function blockAction(label, icon, role) {
  const b = document.createElement('button'); b.type = 'button';
  b.className = 'btn ' + (role === 'secondary' ? 'btn-secondary' : 'btn-primary-role') + ' block-act';
  if (icon) { const i = document.createElement('span'); i.className = 'mdi mdi-' + icon; b.appendChild(i); }
  b.appendChild(document.createTextNode(label));
  return b;
}

/* A quiet secondary action: a link, not a second button. Two filled buttons side by side made a
   practice step look like it was asking a question ("open my game" OR "done"?) when one of them is
   just a shortcut. */
/* The same .btn-secondary every other secondary action in the app uses. It used to be a bespoke
   `.block-link` with its own font size, padding and radius, which is why "Open my game" and "Check
   my work" sat side by side in the same header at two different heights. Role, not a one-off. */
function blockLink(label, icon) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary block-link';
  if (icon) { const i = document.createElement('span'); i.className = 'mdi mdi-' + icon; b.appendChild(i); }
  b.appendChild(document.createTextNode(label));
  return b;
}

/* Authored lab titles read "Lab — the world that will not tick". The label carries "Lab" now, so
   the prefix would say it twice. Stripped here rather than edited across 22 files — the same
   approach as badge names losing their trailing "badge". */
function blockTitleOf(raw, kind) {
  let s = String(raw == null ? '' : raw).trim();
  s = s.replace(new RegExp('^' + kind + '\\s*(?:[\\u2014\\u2013:-]\\s*)?', 'i'), '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/* The question itself. Authored as `question:`; the v1 course used `prompt:` and both are
   accepted, because a renamed key that only the renderer knows about is how all 44 quizzes in
   the course came to display the words "Quick check" instead of anything a student could answer.
   One place to read it from, so a third name can never quietly become a fifth bug. */
function quizPrompt(q) {
  const p = (q && (q.question || q.prompt));
  return typeof p === 'string' && p.trim() ? p.trim() : '';
}

/* ```quiz  (provisional syntax) — types: mcq | predict | parsons | fillblank | findbug. All checked locally. */
function renderQuizCells(root) {
  const codes = [].slice.call(root.querySelectorAll('pre > code.language-quiz'));
  const total = codes.length;
  codes.forEach(function (code, idx) {
    const pre = code.parentNode;
    const key = nextWidgetKey('q');
    const q = parseWidgetYaml('quiz', code.textContent, key);

    const cell = document.createElement('div'); cell.className = 'quizcell'; cell.setAttribute('role', 'group');

    /* Which types need a button at all.
       Picking an option IS the answer, so for those the Check button was a second click that
       carried no information — you had already told it what you thought. Typing in a box and
       putting lines in order are different: there is no moment a program can call "the answer",
       because a half-typed word and a half-ordered list both look like an attempt. Those two keep
       a Check, and it goes in the header with every other block's action. */
    const type = q.type || 'mcq';
    const needsCheck = (type === 'parsons' || type === 'fillblank');
    const check = needsCheck ? blockAction('Check', '', 'secondary') : null;

    // Header: the question is the strongest thing in the card, with its place in the lesson.
    const head = blockHeader('Quiz', quizPrompt(q) || 'Quick check',
      total > 1 ? (idx + 1) + ' of ' + total : '', check);
    cell.appendChild(head);

    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);

    const result = document.createElement('div'); result.className = 'quiz-result';
    result.setAttribute('aria-live', 'polite');

    const ctx = { q: q, key: key, cell: cell, head: head, body: body, check: check, attempts: 0, resolved: false };
    ctx.say = function (kind, msg) { result.className = 'quiz-result' + (kind ? ' ' + kind : ''); result.textContent = msg || ''; };

    if (type === 'parsons') buildParsons(q, body, ctx);
    else if (type === 'fillblank') buildFill(q, body, ctx);
    else if (type === 'findbug') buildFindBug(q, body, ctx);
    else buildMCQ(q, body, ctx, type === 'predict');

    body.appendChild(result);
    pre.parentNode.replaceChild(cell, pre);

    if (activityDone(lessonWidgetId, key)) markQuizDone(ctx, true);
  });
}

/* ---------- one retry model for all five quiz types ----------
   They used to disagree: mcq/predict/findbug revealed the answer on the FIRST wrong attempt and
   ended there, while fillblank/parsons allowed unlimited tries and never revealed. Same-looking
   card, opposite rules, so a child could not tell what guessing costs — and being shown the
   answer the instant you are wrong, with no second try, is the shape of feeling stupid.
   Now: first wrong explains and invites another go; second wrong teaches the answer. */
function quizVerdict(ctx, correct, wrongHint, reveal) {
  if (ctx.resolved) return;
  if (correct) { ctx.say('ok', 'Correct!'); markQuizDone(ctx); return; }
  ctx.attempts++;
  if (ctx.attempts < 2) {
    ctx.say('no', wrongHint || 'Not quite — take another look.');
    if (ctx.check) ctx.check.textContent = 'Try again';
    return;
  }
  if (typeof reveal === 'function') reveal();
  ctx.say('no', ctx.q.explain ? "Here's the answer — " + ctx.q.explain : 'Here is the answer, highlighted above.');
  markQuizDone(ctx);
}

/* Resolved for good: lock the card, tick the header, and record it so the lesson can complete
   and so the answer survives a reload.
   ctx.check is null for the types where clicking an option checks it, so every touch of it is
   guarded — the whole point of those is that there is no button. */
function markQuizDone(ctx, restoring) {
  ctx.resolved = true;
  if (ctx.check) { ctx.check.disabled = true; ctx.check.textContent = 'Answered'; }
  ctx.cell.classList.add('answered');
  if (!ctx.head.querySelector('.block-tick')) {
    const tick = document.createElement('span'); tick.className = 'block-tick mdi mdi-check-circle';
    tick.title = 'Answered';
    blockSide(ctx.head).appendChild(tick);
  }
  if (restoring) { ctx.say('', ''); if (typeof ctx.restore === 'function') ctx.restore(); return; }
  resolveActivity(ctx.key);
}
function buildMCQ(q, body, ctx, isPredict) {
  if (isPredict && q.code) { const pc = document.createElement('pre'); pc.className = 'quiz-code'; pc.textContent = q.code; body.appendChild(pc); }
  /* The options are shuffled, so `right` is where the authored answer LANDED rather than what the
     author wrote. Per-option feedback rides along in the same order — it is indexed by option, so
     reordering one without the other would explain the wrong answer. */
  const opts0 = q.options || [], fb0 = q.feedback || [];
  const order = seededOrder(opts0.length, seedFrom(widgetToken(ctx.key)));
  const opts = order.map(function (i) { return opts0[i]; });
  const fb = order.map(function (i) { return fb0[i]; });
  const rows = [];
  let chosen = -1;

  const list = document.createElement('div'); list.className = 'mcq-list';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', quizPrompt(q) || 'Answer options');

  opts.forEach(function (opt, i) {
    // A real button, not a label wrapping a radio: the whole row is the target, and it is
    // reachable and pressable from the keyboard without any extra work.
    const row = document.createElement('button'); row.type = 'button'; row.className = 'mcq-opt';
    row.setAttribute('role', 'radio'); row.setAttribute('aria-checked', 'false');
    const text = document.createElement('span'); text.className = 'mcq-text'; text.textContent = opt;
    const num = document.createElement('span'); num.className = 'mcq-num'; num.textContent = String(i + 1);
    row.appendChild(text); row.appendChild(num);
    row.addEventListener('click', function () { if (!ctx.resolved && !row.disabled) answer(i); });
    rows.push(row); list.appendChild(row);
  });
  body.appendChild(list);

  /* Picking IS answering. There is no select-then-confirm step: the click marks the row and checks
     it in the same motion. A wrong row is then disabled, so the two tries a student gets are two
     DIFFERENT answers rather than the same one twice. */
  function answer(i) {
    chosen = i;
    rows.forEach(function (r, n) { r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
    grade();
  }
  // Number keys answer directly, for the same reason the mouse does.
  ctx.cell.addEventListener('keydown', function (e) {
    if (ctx.resolved || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= rows.length && !rows[n - 1].disabled) { rows[n - 1].focus(); answer(n - 1); e.preventDefault(); }
  });

  /* The content authors per-option feedback that only ever appeared as one line at the bottom of
     the card. It belongs against the option it explains. */
  function explainRow(i) {
    const row = rows[i]; if (!row || row.querySelector('.mcq-why') || !fb[i]) return;
    const why = document.createElement('span'); why.className = 'mcq-why'; why.textContent = fb[i];
    row.querySelector('.mcq-text').appendChild(why);
  }
  /* An authored answer outside the option list would shuffle to -1, which no click can ever equal —
     a question where every answer is wrong and nothing on screen says so. Say it out loud and fall
     back to the first option, because a wrong-but-answerable question costs a moment and an
     unanswerable one blocks the lesson from ever completing. */
  let right = order.indexOf(Number(q.answer));
  if (right < 0) {
    console.warn('[league] quiz ' + ctx.key + ' has answer: ' + q.answer + ' but only '
      + opts0.length + ' options, so no answer could ever be right. Falling back to the first one.');
    right = order.indexOf(0);
  }
  ctx.restore = function () { rows.forEach(function (r, i) { r.disabled = true; if (i === right) r.classList.add('correct'); }); };

  function grade() {
    if (ctx.resolved || chosen < 0) return;
    const ok = chosen === right;
    if (ok) { rows[chosen].classList.add('correct'); }
    else { rows[chosen].classList.add('wrong'); rows[chosen].disabled = true; explainRow(chosen); }
    quizVerdict(ctx, ok, fb[chosen] || 'Not quite — read that one again.', function () {
      rows[right].classList.add('correct');
    });
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  }
}
function buildParsons(q, body, ctx) {
  const items = (q.lines || []).map(function (t) { return { text: t, distractor: false, why: '' }; })
    .concat((q.distractors || []).map(function (d) { return { text: (typeof d === 'string' ? d : d.text), distractor: true, why: (typeof d === 'string' ? '' : (d.why || '')) }; }));
  const correct = (q.lines || []); const hasDist = (q.distractors || []).length > 0;
  let order = shuffleOrder(items.length); const used = {}; items.forEach(function (_, i) { used[i] = true; }); let dragFrom = null;
  let focusPos = 0;
  const list = document.createElement('div'); list.className = 'parsons';
  list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Put the lines in order');
  const live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');

  /* Reordering was mouse-only: draggable plus three drag listeners and nothing else, so five
     lessons were simply unreachable without a mouse. Alt+Up/Down moves the focused line and
     announces where it landed. */
  function move(from, to) {
    if (to < 0 || to >= order.length) return;
    const mv = order.splice(from, 1)[0]; order.splice(to, 0, mv);
    focusPos = to; draw();
    const row = list.children[to]; if (row) row.focus();
    live.textContent = 'Moved to position ' + (to + 1) + ' of ' + order.length;
  }
  function draw() {
    list.innerHTML = '';
    order.forEach(function (idx, pos) {
      const it = items[idx];
      const row = document.createElement('div'); row.className = 'parsons-row' + (used[idx] ? '' : ' unused');
      row.draggable = !ctx.resolved;
      row.tabIndex = pos === focusPos ? 0 : -1;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.setAttribute('aria-label', it.text + ', position ' + (pos + 1) + ' of ' + order.length);
      // The position number is the answer, so it leads the row instead of hiding behind a handle.
      const num = document.createElement('span'); num.className = 'p-pos'; num.textContent = String(pos + 1);
      row.appendChild(num);
      // Prose steps get prose type; code lines get the monospace + colouring they deserve.
      const isCode = typeof looksLikeCode === 'function' && looksLikeCode(it.text);
      const c = document.createElement(isCode ? 'code' : 'span');
      c.className = 'p-text'; c.textContent = it.text;
      if (isCode && typeof paintCode === 'function') paintCode(c);
      row.appendChild(c);

      /* Buttons, not drag-only. This shipped as draggable + three drag listeners, which asks a
         child on a Chromebook touchscreen to do a precise drag; these work by tapping. */
      const tools = document.createElement('span'); tools.className = 'p-tools';
      [['up', 'mdi-chevron-up', 'Move up', -1], ['down', 'mdi-chevron-down', 'Move down', 1]].forEach(function (b) {
        const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'p-move';
        mb.innerHTML = '<span class="mdi ' + b[1] + '"></span>';
        mb.title = b[2]; mb.setAttribute('aria-label', b[2] + ': ' + it.text);
        mb.disabled = ctx.resolved || (b[3] < 0 ? pos === 0 : pos === order.length - 1);
        mb.addEventListener('click', function (e) { e.stopPropagation(); move(pos, pos + b[3]); });
        tools.appendChild(mb);
      });
      if (hasDist) {
        const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'p-use';
        drop.setAttribute('aria-pressed', used[idx] ? 'false' : 'true');
        drop.title = used[idx] ? 'This line does not belong — leave it out' : 'Put this line back in';
        drop.innerHTML = '<span class="mdi ' + (used[idx] ? 'mdi-close' : 'mdi-plus') + '"></span>';
        drop.disabled = ctx.resolved;
        drop.addEventListener('click', function (e) { e.stopPropagation(); used[idx] = !used[idx]; draw(); const r = list.children[pos]; if (r) r.focus(); });
        tools.appendChild(drop);
      }
      row.appendChild(tools);
      row.addEventListener('focus', function () { focusPos = pos; });
      row.addEventListener('keydown', function (e) {
        if (ctx.resolved) return;
        if (e.altKey && e.key === 'ArrowUp') { move(pos, pos - 1); e.preventDefault(); }
        else if (e.altKey && e.key === 'ArrowDown') { move(pos, pos + 1); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { const p = list.children[pos - 1]; if (p) { focusPos = pos - 1; p.tabIndex = 0; p.focus(); } e.preventDefault(); }
        else if (e.key === 'ArrowDown') { const n = list.children[pos + 1]; if (n) { focusPos = pos + 1; n.tabIndex = 0; n.focus(); } e.preventDefault(); }
        else if (hasDist && (e.key === ' ' || e.key === 'Enter')) { used[idx] = !used[idx]; draw(); const r = list.children[pos]; if (r) r.focus(); live.textContent = used[idx] ? 'Line kept' : 'Line left out'; e.preventDefault(); }
      });
      row.addEventListener('dragstart', function () { dragFrom = pos; row.classList.add('dragging'); });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('over'); if (dragFrom === null || dragFrom === pos) { dragFrom = null; return; } const mv = order.splice(dragFrom, 1)[0]; order.splice(pos, 0, mv); dragFrom = null; draw(); });
      list.appendChild(row);
    });
  }
  draw(); body.appendChild(list); body.appendChild(live);
  const hint = document.createElement('div'); hint.className = 'parsons-hint';
  hint.textContent = (hasDist ? 'Put the lines in order with the arrows, and use ✕ to leave out any that don’t belong. ' : 'Put the lines in the right order using the arrows (or drag them). ')
    + 'Keyboard: ↑ ↓ to move between lines, Alt + ↑ ↓ to reorder.';
  body.appendChild(hint);

  ctx.restore = function () { draw(); };
  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    const kept = order.filter(function (idx) { return used[idx]; }).map(function (idx) { return items[idx]; });
    const badDist = kept.filter(function (it) { return it.distractor; });
    const texts = kept.map(function (it) { return it.text; });
    const ok = !badDist.length && texts.length === correct.length && texts.every(function (t, i) { return t === correct[i]; });
    const hintMsg = badDist.length
      ? (badDist[0].why ? 'Not quite — ' + badDist[0].why : 'Not quite — one of the lines you kept doesn’t belong.')
      : 'Not yet — check the order (and which lines you kept).';
    quizVerdict(ctx, ok, hintMsg, function () {
      order = items.map(function (_, i) { return i; }).filter(function (i) { return !items[i].distractor; });
      items.forEach(function (it, i) { used[i] = !it.distractor; });
      draw();
    });
    if (ctx.resolved) draw();
  });
}
function buildFill(q, body, ctx) {
  const tpl = String(q.code || q.template || ''); const parts = tpl.split('___');
  // A prose template ("We write our game in ___") should not be dressed as a code block.
  const isCode = typeof looksLikeCode === 'function' && looksLikeCode(tpl);
  const wrap = document.createElement('div'); wrap.className = 'fill-code' + (isCode ? '' : ' prose');
  const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-input'; input.spellcheck = false; input.placeholder = 'type your answer';
  input.setAttribute('aria-label', quizPrompt(q) || 'Fill in the blank');
  if (parts.length >= 2) { wrap.appendChild(document.createTextNode(parts[0])); wrap.appendChild(input); wrap.appendChild(document.createTextNode(parts.slice(1).join('___'))); }
  else { wrap.appendChild(input); }
  body.appendChild(wrap);
  // Grow with what's typed, so the answer isn't cramped in a fixed 130px slot.
  const sizeInput = function () { input.style.width = Math.max(120, Math.min(340, (input.value.length || 12) * 8.6 + 26)) + 'px'; };
  input.addEventListener('input', sizeInput); sizeInput();
  const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(function (a) { return String(a).trim(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !ctx.resolved) { ctx.check.click(); e.preventDefault(); } });

  ctx.restore = function () { input.value = answers[0] || ''; sizeInput(); input.disabled = true; input.classList.add('correct'); };
  ctx.check.addEventListener('click', function () {
    if (ctx.resolved) return;
    const v = input.value.trim();
    if (!v) { ctx.say('no', 'Type your answer in the box first.'); return; }
    const ok = answers.some(function (a) { return a === v || a.toLowerCase() === v.toLowerCase(); });
    input.classList.toggle('correct', ok); input.classList.toggle('wrong', !ok);
    quizVerdict(ctx, ok, q.explain ? 'Not quite — ' + q.explain : 'Not quite — check the spelling and try again.', function () {
      input.value = answers[0] || ''; sizeInput(); input.classList.remove('wrong'); input.classList.add('correct');
    });
    if (ctx.resolved) input.disabled = true;
  });
}
function buildFindBug(q, body, ctx) {
  const lines = q.code || q.lines || []; let chosen = -1; const rows = [];
  const wrap = document.createElement('div'); wrap.className = 'findbug';
  wrap.setAttribute('role', 'radiogroup'); wrap.setAttribute('aria-label', quizPrompt(q) || 'Which line has the bug?');
  // Say what to do. The card showed a block of code and a Check button and left the child to
  // infer that the lines were clickable at all.
  const lead = document.createElement('div'); lead.className = 'fb-lead';
  lead.textContent = 'Click the line you think has the bug — that answers it.';
  wrap.appendChild(lead);
  lines.forEach(function (ln, i) {
    // A button, so the line is reachable and pressable without a mouse.
    const row = document.createElement('button'); row.type = 'button'; row.className = 'fb-row'; rows.push(row);
    row.setAttribute('role', 'radio'); row.setAttribute('aria-checked', 'false');
    row.setAttribute('aria-label', 'Line ' + (i + 1) + ': ' + ln);
    const num = document.createElement('span'); num.className = 'fb-num'; num.textContent = (i + 1);
    const c = document.createElement('code'); c.textContent = ln;
    if (typeof paintCode === 'function') paintCode(c);
    row.appendChild(num); row.appendChild(c);
    // Clicking a line answers it, the same as picking an option in a multiple choice question —
    // which is what this is, with the code as the options.
    row.addEventListener('click', function () { if (!ctx.resolved && !row.disabled) grade(i); });
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  const right = Number(q.answer);
  ctx.restore = function () { rows.forEach(function (r, i) { r.disabled = true; if (i === right) r.classList.add('correct'); }); };

  function grade(i) {
    chosen = i;
    rows.forEach(function (r, n) { r.setAttribute('aria-checked', n === i ? 'true' : 'false'); });
    const ok = chosen === right;
    if (ok) { rows[chosen].classList.add('correct'); }
    else { rows[chosen].classList.add('wrong'); rows[chosen].disabled = true; }
    quizVerdict(ctx, ok, q.explain ? 'Not quite — ' + q.explain : 'Not quite — look at that line again.', function () {
      rows[right].classList.add('correct');
    });
    if (ctx.resolved) rows.forEach(function (r) { r.disabled = true; });
  }
}
/* Inline Markdown for the short authored strings in a lab or a "your turn" step — `code` and
   **bold**, nothing else. Written by hand rather than run through marked() because these are
   single lines, not documents: marked would wrap each one in a <p> and fight the list styling.
   Escaped FIRST, so authored text can never inject markup. */
function inlineMd(text) {
  return esc(String(text == null ? '' : text))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

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
      studentId: (typeof studentId !== 'undefined' ? studentId : ''),
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
let labRegistry = [];

function renderChallengeCells(root) {
  labRegistry = [];
  root.querySelectorAll('pre > code.language-challenge').forEach(function (code) {
    const pre = code.parentNode;
    const key = nextWidgetKey('c'), tok = widgetToken(key);
    const c = parseWidgetYaml('challenge', code.textContent, key);
    const lessonId = lessonWidgetId;
    const saved = labState(lessonId, key) || {};
    const startCode = c.code || '';

    /* Everything about this lab in one object, so the card in the lesson and the full-window
       bench are two views of the same thing and cannot drift apart. */
    const lab = {
      c: c, key: key, tok: tok, lessonId: lessonId,
      startCode: startCode,
      code: typeof saved.code === 'string' ? saved.code : startCode,
      fails: saved.fails || 0,
      revealed: !!saved.revealed,
      solved: activityDone(lessonId, key),
      touched: typeof saved.code === 'string' && saved.code !== startCode,
      tutorOffered: !!saved.tutorOffered,
      tutorGreeted: false,
      running: false, error: '', attemptOpen: false,
      started: false, paused: false,
      ui: null, card: null
    };
    labRegistry.push(lab);

    /* Classes are ch-*, not cm-*: the lesson root carries CodeMirror's `cm-s-material-darker`
       theme class, and a widget naming its own parts cm-anything is one rename from colliding. */
    const cell = document.createElement('div'); cell.className = 'challenge-mini';

    /* Start sits in the header. paintLabCard swaps its label between Start / Continue / Open, so
       the heading line always says both what the lab is and what pressing it will do. */
    const open = blockAction('Start', 'play');
    const head = blockHeader('Lab', blockTitleOf(c.title, 'Lab') || 'The course’s example', '', open);
    head.classList.add('ch-head');
    cell.appendChild(head);

    const bodyEl = document.createElement('div'); bodyEl.className = 'ch-body'; cell.appendChild(bodyEl);

    /* No "this is the course's example, not your game" note here any more. The bench it opens is
       titled Lab and carries Reset in plain sight, the block itself is labelled LAB, and the task
       never refers to the student's own game — so the reassurance was answering a question nobody
       had got as far as asking, in the one line of the block a student reads first. */

    if (c.task) { const t = document.createElement('div'); t.className = 'ch-task'; t.innerHTML = inlineMd(c.task); bodyEl.appendChild(t); }

    /* What "finished" looks like, stated before they open the bench.
       The block used to be a label, a title, one sentence and a button — which describes a problem
       and never says how a student would know they had solved it. `goal:` is optional so the other
       eighteen labs keep working while they are written; where it is missing this row is simply
       absent rather than showing an empty frame. */
    if (c.goal) {
      const g = document.createElement('p'); g.className = 'ch-goal';
      g.innerHTML = '<span class="ch-goal-k">Goal</span><span>' + inlineMd(c.goal) + '</span>';
      bodyEl.appendChild(g);
    }

    /* "Solved" belongs beside the heading with every other block's status, not on a row of its own
       at the bottom of the block. That row is now empty, so it is gone. */
    const done = document.createElement('span'); done.className = 'ch-solved'; done.hidden = true;
    blockSide(head).insertBefore(done, open);

    lab.card = { done: done, open: open };
    paintLabCard(lab);
    open.addEventListener('click', function () { openLab(lab); });

    /* One handler per lab, registered once. It updates the lab's own state either way, so the
       card is correct whether or not the bench happens to be open when the message arrives. */
    widgetHandlers[tok] = function (d) {
      if (!d.__cm) return;
      // Only the bench has a console, so a log arriving for a lab that is not open is dropped.
      if (d.log) { if (openLabRef === lab) labConsoleLine(d.log.level, String(d.log.text || '')); return; }
      if (d.win) {
        /* The opening preview is a picture, not an attempt. A lab whose starter code happens to
           call win() would otherwise complete itself the moment the bench opened, before the
           student had read the task. */
        if (lab.previewing) return;
        clearTimeout(lab.settleTimer);
        lab.attemptOpen = false; lab.running = false; lab.error = ''; lab.settled = false;
        lab.solved = true;
        if (lab.ui) lab.code = lab.ui.read();
        labSave(lab, { code: lab.code });
        paintLabStatus(lab); paintLabCard(lab);
        resolveActivity(lab.key);
      } else if (d.err) {
        if (lab.previewing) return;      // a broken starter is the point; it is not a failed run
        clearTimeout(lab.settleTimer);
        lab.attemptOpen = false; lab.running = false; lab.settled = false;
        lab.error = String(d.err).slice(0, 300);
        // In the log as well as on the status line: the status line is the verdict, the log is the
        // record, and a student comparing two runs needs the record.
        if (openLabRef === lab) labConsoleLine('error', lab.error);
        labFail(lab);
        paintLabStatus(lab); paintLabCard(lab);
      }
    };

    pre.parentNode.replaceChild(cell, pre);
  });
}

/* ```yourturn — the bridge from the lab to the student's own game.
   A lab teaches a technique on the course's example. This asks them to do the same thing in the
   game that is actually theirs, by hand. That order — worked example, then independent practice —
   is the point: copying the lab's code across would move the technique without teaching it.

   YAML: title, task, steps (a list), optionally `reward` naming an unlockable, optionally a
   `check:` list of rules and an `example:` to show after a third failed try.

   There is no "Done" button. There used to be, and it recorded that the student SAID they had done
   it — so twenty-two badges could be collected without opening the Code tab once. Now pressing
   Check my work reads their actual project: the authored rules decide it wherever a program can be
   certain (instantly, offline, no model call), and only the genuinely judgement-shaped tasks go to
   the grader. Nothing here can tell a student they are wrong when the checker merely could not
   tell — see gradePractice() in ai.js, where a null reply means "could not check". */
function renderYourTurnCells(root) {
  root.querySelectorAll('pre > code.language-yourturn').forEach(function (code) {
    const pre = code.parentNode;
    const key = nextWidgetKey('y');
    const c = parseWidgetYaml('yourturn', code.textContent, key);
    const lessonId = lessonWidgetId;
    const done = activityDone(lessonId, key);

    /* Hand the practice task to the Build helper so it can recognise a request to do this exercise
       and coach instead of writing it. It cannot get this from lessonContext: that is the lesson's
       text truncated at 3,000 characters, and a lesson runs nearer 10,000 — the practice block is
       the last thing on the page, so it is always past the cut. Set here rather than parsed again
       server-side because this is the one place the block is already parsed. */
    currentPracticeTask = {
      title: c.title || '',
      task: c.task || '',
      steps: Array.isArray(c.steps) ? c.steps.slice(0, 8) : []
    };

    const cell = document.createElement('div'); cell.className = 'yourturn';
    /* "Practice" rather than "Your turn": one word, it sits beside Quiz and Lab as a short noun
       naming the kind of activity, and it is honest about what this is — the independent practice
       that follows the lab's worked example. Not "Build", which is already the AI's other mode. */
    const mark = blockAction('Check my work', 'check');
    const head = blockHeader('Practice', blockTitleOf(c.title, 'Practice') || 'In your own game', '', mark);
    head.classList.add('yt-head');
    cell.appendChild(head);

    const body = document.createElement('div'); body.className = 'yt-body';
    if (c.task) { const t = document.createElement('p'); t.className = 'yt-task'; t.innerHTML = inlineMd(c.task); body.appendChild(t); }
    if (Array.isArray(c.steps) && c.steps.length) {
      const ol = document.createElement('ol'); ol.className = 'yt-steps';
      // inlineMd, not textContent: steps name real functions like `update`, and the backticks were
      // showing up literally on screen.
      c.steps.forEach(function (s) { const li = document.createElement('li'); li.innerHTML = inlineMd(s); ol.appendChild(li); });
      body.appendChild(ol);
    }
    /* The reward line. It used to promise a badge that nothing in the app awarded, stored or
       displayed — the promise is kept now, and once it is kept the line says so rather than
       still telling a student about something they already have. */
    let rewardEl = null;
    function paintReward() {
      if (!rewardEl || !c.reward) return;
      const earned = hasBadge(c.reward);
      rewardEl.className = 'yt-reward' + (earned ? ' earned' : '');
      /* "Engine Room badge" already ends in the word badge, so the sentence supplies the article
         and the stored name carries the noun: "unlocks the Engine Room badge".
         What the badge is FOR used to be crammed onto the same line as a second clause, which made
         the reward the longest and dullest thing in the block. It moves to a hover on the name —
         opened by hover, by keyboard focus and by tap, because a touchscreen Chromebook cannot
         hover and this is the only place that explains what a badge means. */
      const name = badgeShortName(c.reward);
      const why = c.title ? 'Awarded for finishing this practice step: ' + c.title + '.'
        : 'Awarded for finishing this practice step.';
      const tip = '<span class="badge-tip">'
        + '<button type="button" class="badge-name" aria-expanded="false"'
        + ' aria-label="What the ' + esc(name) + ' badge is for">' + esc(name) + '</button>'
        + '<span class="badge-why" role="note">' + esc(why) + '</span></span>';
      rewardEl.innerHTML = (earned
        ? '<span class="mdi mdi-medal" aria-hidden="true"></span>'
        : '<span class="mdi mdi-lock-open-variant-outline" aria-hidden="true"></span>') + tip;
      const btn = rewardEl.querySelector('.badge-name'), wrap = rewardEl.querySelector('.badge-tip');
      if (btn) btn.addEventListener('click', function () {
        const open = wrap.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    if (c.reward) {
      /* Beside the PRACTICE label, not under the steps. At the bottom it was the last thing in the
         block and read as a fourth control after five instructions; up here it is one short line
         attached to the label, which is what it is — a note about what this block gives you. */
      rewardEl = document.createElement('span');
      const kindEl = head.querySelector('.block-kind');
      const row = document.createElement('span');
      row.className = 'block-kindrow';
      kindEl.parentNode.insertBefore(row, kindEl);
      row.appendChild(kindEl);       // moves it, so the header grid sees one child on that row
      row.appendChild(rewardEl);
      paintReward();
    }
    cell.appendChild(body);

    /* No "Open my game" button. Step 1 already names the file, and linkFileNames() in highlight.js
       makes that name open it — so the button was a second control for something the sentence was
       doing anyway, and it put a second differently-coloured thing next to Check my work. */
    const foot = document.createElement('div'); foot.className = 'yt-foot';
    const status = document.createElement('span'); status.className = 'yt-status'; status.setAttribute('aria-live', 'polite');

    /* The hint line, and the way out of being stuck. Both live under the steps rather than in the
       header, because this is the part a student reads slowly. */
    const hintEl = document.createElement('p'); hintEl.className = 'yt-hint'; hintEl.hidden = true;
    const helpBtn = blockLink('talk it through with the assistant', 'chat-question-outline');
    helpBtn.hidden = true;
    helpBtn.addEventListener('click', function () {
      if (typeof askAboutPractice === 'function') askAboutPractice({ title: c.title, steps: c.steps });
    });

    function settle(helped) {
      status.className = 'yt-status ok';
      status.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>'
        + (helped ? 'Done — with a look at the answer' : 'Done in your game');
      mark.disabled = true; mark.hidden = true;
      hintEl.hidden = true; helpBtn.hidden = true;
      // The header tick, so a finished practice step reads the same as a finished quiz.
      if (!head.querySelector('.block-tick')) {
        const tick = document.createElement('span'); tick.className = 'block-tick mdi mdi-check-circle';
        tick.title = 'Done'; blockSide(head).appendChild(tick);
      }
    }
    function award(helped) {
      savePracticeState(lessonId, key, { passed: true, helped: !!helped });
      settle(helped);
      /* The badge before the activity: resolveActivity can complete the lesson, which starts the
         countdown to the next one, and the student should have been told what they earned before
         anything starts moving them along. */
      if (c.reward && awardBadge(c.reward, lessonId)) {
        paintReward();
        toast('Badge earned: ' + c.reward);
      }
      resolveActivity(key);
    }
    /* `label` is the visible verdict; `msg` is the detail under it.
       Pressing Check used to blank the status and write only the hint paragraph, so the two states
       a student most needs to tell apart — "I am looking at your game" and "that is not it yet" —
       were both just a new sentence appearing somewhere under the steps. Nothing said which had
       happened, and on a slow model the button sat dead with no sign it had registered the press. */
    function say(kind, msg, showHelp, label) {
      status.className = 'yt-status' + (kind ? ' ' + kind : '');
      status.innerHTML = label
        ? (kind === 'no' ? '<span class="mdi mdi-close" aria-hidden="true"></span>' : '') + esc(label)
        : '';
      hintEl.hidden = !msg;
      hintEl.className = 'yt-hint' + (kind === 'no' ? ' no' : '');
      hintEl.innerHTML = msg ? inlineMd(msg) : '';
      if (showHelp) helpBtn.hidden = false;
    }

    if (done) settle((practiceState(lessonId, key) || {}).helped);

    /* Snapshot NOW, as the step is rendered — the moment the student first sees the task, before
       they have had a chance to do anything about it. Deferring it to the first press of Check
       would take "before" from a project that already contains their work, so a rule like
       `changed_at_least` would fail precisely the student who read the task, went and did it, and
       then came back to be checked. It is written once and never overwritten. */
    if (!done) practiceSnapshot(lessonId, key);

    mark.addEventListener('click', function () {
      if (mark.disabled) return;
      const snap = practiceSnapshot(lessonId, key);
      const p = savePracticeState(lessonId, key, { tries: (practiceState(lessonId, key) || {}).tries + 1 || 1 });
      const tries = p.tries;

      const ruled = checkPracticeRules(c.check, snap);
      if (ruled.authoring.length) {
        /* Our bug, not theirs. Never hold a student up for it: say so in the console for whoever
           is authoring, and let them through. */
        console.warn('[league] practice ' + key + ' has a broken `check:` — ' + ruled.authoring.join('; '));
        award(false);
        return;
      }
      if (ruled.pass === false) {
        // A rule said no, and a rule is never a judgement call — so this is a real "not yet".
        const extra = tries >= 2 ? ' Look in the file the steps name, near the top.' : '';
        const shown = tries >= 3 && c.example;
        say('no', ruled.hint + extra + (shown ? '\n\nHere is one way to do it:\n`' + String(c.example).replace(/`/g, '') + '`' : ''), tries >= 2, 'Not yet');
        if (shown) savePracticeState(lessonId, key, { helped: true });
        return;
      }

      /* Either every rule passed, or none were authored. Both need the grader: passing the rules
         proves the mechanics, not that the change does what the task asked. */
      mark.disabled = true;
      say('', '', false, 'Checking your game…');
      const changed = practiceDiff(snap);
      const task = { title: c.title, steps: c.steps };
      const done2 = function (g) {
        mark.disabled = false;
        if (!g) {
          /* Could not check — offline, a 502, or a reply the server refused to vouch for. If the
             rules passed, that is enough on its own; if there were no rules, give them the benefit
             of the doubt rather than blocking on our own plumbing. */
          award((practiceState(lessonId, key) || {}).helped);
          return;
        }
        if (g.pass) { award((practiceState(lessonId, key) || {}).helped); return; }
        const shown = tries >= 3 && c.example;
        say('no', g.hint + (shown ? '\n\nHere is one way to do it:\n`' + String(c.example).replace(/`/g, '') + '`' : ''), true, 'Not yet');
        if (shown) savePracticeState(lessonId, key, { helped: true });
      };
      if (typeof gradePractice === 'function') gradePractice(task, changed).then(done2);
      else done2(null);
    });

    foot.appendChild(status);
    cell.appendChild(hintEl);
    cell.appendChild(foot);
    foot.appendChild(helpBtn);
    pre.parentNode.replaceChild(cell, pre);
  });
}

/* A clip of a real game loops on its own, which is right for showing what a mechanic feels like and
   wrong for a student who has asked their machine for less movement. Autoplay is an attribute, so it
   cannot be undone in CSS: the clip is stopped here and given controls, so it is still watchable by
   choice rather than simply gone. */
function calmClips(root) {
  if (!root || !window.matchMedia) return;
  let quiet = false;
  try { quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return; }
  if (!quiet) return;
  root.querySelectorAll('figure.clip video').forEach(function (v) {
    v.autoplay = false; v.loop = false; v.controls = true;
    try { v.pause(); } catch (e) {}
  });
}

/* ---------- the picture credit, folded away ----------
   Thirty-one figures name whose work they are showing, and check-lessons.js refuses a lesson that
   borrows a screenshot without one. That is the right rule and the markup does not change here.
   What changed is where it sits: a permanent third line of small print under every caption, so the
   credit competed with the sentence doing the teaching, on every figure, in every lesson.

   Folded, NOT removed. The <cite> is still in the DOM and still selectable; eleven of these images
   are CC BY, where naming the author is a licence condition rather than a courtesy, so it opens
   three ways — hover for a mouse, focus for a keyboard, and click for the touchscreen Chromebooks
   that have no hover at all. A tooltip a student cannot reach is the same as no attribution. */
/* ---------- an aside with nothing to sit beside ----------
   `figure.aside` floats right so a paragraph can run alongside it. That only works when the next
   thing IS a paragraph. Where a lesson puts one immediately before a heading, the float has nothing
   to wrap it: the picture sits over on the right, the column beside it stays empty, and the section
   below starts against a wall of white space. Two lessons do exactly that today, and an author
   adding a third has no way to know.

   So the float is asked for in the lesson and granted here only when it will pay — the next block
   has to be prose that can wrap. Anything else (a heading, another figure, a code block, an
   activity) and the figure stays in the flow where it reads correctly. */
/* ---------- a table needs a box to scroll in, and it cannot be itself ----------
   A wide table has to scroll sideways inside its own box rather than making the whole page scroll,
   and the way that was done was `display:block; overflow-x:auto` on the table element.

   That works for the scrolling and quietly breaks two other things. `display:block` turns the
   <table> into a block box, so `width:100%` sizes THAT box while the real table inside it stays on
   auto layout and shrinks to its content — 744px of block holding 625px of table, with the header
   rule and every row separator stopping 119px short of where the prose ends. It reads as a panel
   that has been cut off. And per the overflow spec, setting overflow-x to anything but `visible`
   promotes overflow-y from `visible` to `auto`, so the table was also a vertical scroll container
   that nothing ever wanted.

   So the scrolling moves out to a wrapper and the table goes back to being a table. Done here
   rather than in the Markdown pipeline because it applies to every table in every lesson and no
   author should have to remember it. */
function wrapTables(root) {
  if (!root) return;
  root.querySelectorAll('.lesson-content > table').forEach(function (t) {
    const box = document.createElement('div');
    box.className = 'tablescroll';
    t.parentNode.insertBefore(box, t);
    box.appendChild(t);
  });
  fitTables(root);
}

/* Clip only when clipping is the lesser evil.
   The wrapper starts with no overflow at all, because a scroll container clips in BOTH directions
   and the tables in this course are exactly where the glossary terms live — a definition opening
   out of the `overlap` cell was being sliced in half by the box meant to help it. Every table in
   the course fits its column, so the honest default is not to clip; `.scrolling` turns overflow on
   for the narrow case where the alternative is the whole page scrolling sideways. */
function fitTables(root) {
  if (!root) return;
  root.querySelectorAll('.lesson-content > .tablescroll').forEach(function (box) {
    const t = box.querySelector('table');
    if (!t) return;
    box.classList.remove('scrolling');                       // measure it unclipped
    if (t.scrollWidth > box.clientWidth + 1) box.classList.add('scrolling');
  });
}

const WRAPS_BESIDE = { P: 1, UL: 1, OL: 1, BLOCKQUOTE: 1 };
function unfloatLonelyAsides(root) {
  if (!root) return;
  /* Re-run when the pictures arrive. Every decision below is a measurement, and at first paint an
     <img> that has not loaded is zero pixels tall — so a figure was being judged on the height of
     its caption alone and kept a float it could not fill. Idempotent: the class is cleared before
     each pass, so running this three times gives the same answer as running it once. */
  root.querySelectorAll('.lesson-content > figure img').forEach(function (img) {
    if (img.complete || img.dataset.floatWatch) return;
    img.dataset.floatWatch = '1';
    img.addEventListener('load', function () { unfloatLonelyAsides(root); });
    img.addEventListener('error', function () { unfloatLonelyAsides(root); });
  });
  root.querySelectorAll('.lesson-content > figure.aside, .lesson-content > .tip.aside').forEach(function (el) {
    el.classList.remove('no-float');
    let next = el.nextElementSibling;
    // The reading rail and the progress strip are furniture, not content to wrap around.
    while (next && (next.classList.contains('rail') || next.id === 'lessonProgress')) next = next.nextElementSibling;
    if (!next || !WRAPS_BESIDE[next.tagName]) { el.classList.add('no-float'); return; }
    /* Having prose next to it is necessary but not sufficient. The float also has to have enough
       prose to sit beside, or the column under that prose is empty and the section ends on a hole
       with a picture hanging to the right of nothing.

       Measured against the WHOLE prose run, not the one paragraph that happens to be next: a float
       is meant to outlast one paragraph, and the ones after it keep wrapping. Measuring against a
       single paragraph is what unfloated pictures that were working perfectly well.

       The tolerance is generous on purpose. A figure running a little past the text it illustrates
       is ordinary magazine layout and looks fine; what looks broken is a tall picture beside two
       short lines. Only that case gets pulled back into the flow. */
    let run = 0, n = next;
    while (n && WRAPS_BESIDE[n.tagName]) { run += n.getBoundingClientRect().height; n = n.nextElementSibling; }
    const slack = el.classList.contains('tip') ? 24 : 56;
    if (el.getBoundingClientRect().height > run + slack) el.classList.add('no-float');
  });
}

function foldCredits(root) {
  if (!root) return;
  root.querySelectorAll('figure > figcaption > cite').forEach(function (cite) {
    const fig = cite.parentNode.parentNode;
    if (fig.querySelector(':scope > .credit-hover')) return;   // already folded
    /* Everything above the caption is the picture, whether that is one borrowed screenshot or the
       six sprites of an `art` row. Wrapping the lot gives one hover target per figure and one rule
       for both shapes; the wrapper shrinks to its contents, so hovering means hovering the picture
       and not the empty column beside it. */
    const wrap = document.createElement('span');
    wrap.className = 'credit-hover';
    fig.insertBefore(wrap, fig.firstChild);
    while (wrap.nextSibling && wrap.nextSibling.tagName !== 'FIGCAPTION') wrap.appendChild(wrap.nextSibling);
    wrap.appendChild(cite);          // moves the node, so the credit text itself is untouched
    /* A picture cannot be hovered on a touchscreen and cannot be tabbed to at all, so the wrapper
       becomes focusable and clickable. Without this the credit is simply unreachable for anyone on
       a touch Chromebook or a keyboard — and eleven of these images are CC BY, where naming the
       author is a licence condition rather than a courtesy. */
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-expanded', 'false');
    wrap.setAttribute('aria-label', 'Show who made this picture');
    function toggle(on) {
      wrap.classList.toggle('open', on);
      wrap.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    wrap.addEventListener('click', function () { toggle(!wrap.classList.contains('open')); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(!wrap.classList.contains('open')); }
      else if (e.key === 'Escape' && wrap.classList.contains('open')) toggle(false);
    });
  });
}

const MODULE_HERO = ['#143561', '#2f2a6b', '#1f5b63', '#5b3320', '#1f6b45', '#6b2a52', '#26456b', '#4a6b26', '#6b5320', '#33305b'];
const MODULE_ACCENT = ['#3e8fd6', '#8b7cff', '#2fd0b6', '#f5820a', '#3ddc84', '#ff6b9d', '#59a5ff', '#a3d94a', '#f5b02e', '#7c9cff'];
function moduleHero(mi) { return MODULE_HERO[mi % MODULE_HERO.length]; }
function moduleAccent(mi) { return MODULE_ACCENT[mi % MODULE_ACCENT.length]; }
/* Lesson bodies are fetched on demand now, so this has two halves: the part that must happen
   immediately (the outline highlight and the tab switch — a click has to feel answered) and the
   part that needs the body. `token` guards against a student clicking three lessons quickly: only
   the newest request is allowed to paint, so a slow earlier fetch cannot land on top of it. */
let lessonToken = 0;
function selectLesson(idx) {
  /* Changing lesson tears down every widget in the old one, including the handler the open bench
     is talking to. Close it first rather than leaving it on screen wired to a lesson that is gone. */
  if (openLabRef) closeLab();
  // Same reasoning for a building zone: its board is bound to the lesson that built it.
  if (typeof openZoneRef !== 'undefined' && openZoneRef) closeZone();
  labPendingAdvance = null;
  curIdx = idx; const f = flat[idx];
  revealModuleFor(idx);        // the module this lesson lives in opens; nothing else is touched
  // At a narrow width the outline is floating over the lesson. Picking one is the end of that job,
  // so it gets out of the way rather than sitting on top of what was just opened.
  if (typeof floatOpen !== 'undefined' && floatOpen === 'left') closeFloating();
  const token = ++lessonToken;
  $('crumb').dataset.lesson = f.m.name + ': ' + f.l.t;
  cancelAdvance();
  renderOutline(); switchView('learn');
  lessonBody(f.l).then(function (html) {
    if (token !== lessonToken) return;   // they moved on; this is a stale answer
    paintLesson2(f, html);
  });
}
function paintLesson2(f, html) {
  $('lessonBody').innerHTML = lessonBodyHTML(f, html);
  /* Start at the top. #view-learn is the thing that scrolls (the document itself never does), and
     nothing reset it — so reading to the bottom of a long lesson and clicking the next one landed
     the student part-way down it, past the title, with no clue they had missed anything. */
  const learn = $('view-learn'); if (learn) learn.scrollTop = 0;
  $('lessonBody').style.setProperty('--mod', moduleHero(f.mi));
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  currentPracticeTask = null;   // renderYourTurnCells sets this lesson's, a few lines below
  resetWidgetHandlers();   // the previous lesson's widget iframes are gone with the innerHTML
  beginLessonWidgets(f.id);
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  renderChallengeCells($('lessonBody'));
  renderYourTurnCells($('lessonBody'));
  if (typeof mountZones === 'function') mountZones($('lessonBody'));
  wrapTables($('lessonBody'));
  calmClips($('lessonBody'));
  unfloatLonelyAsides($('lessonBody'));
  foldCredits($('lessonBody'));
  paintLesson($('lessonBody'));
  linkFileNames($('lessonBody'));
  linkPlaces($('lessonBody'));
  linkGlossary($('lessonBody'));
  applyAIMode(f.l.ai);
  startLessonProgress(f);
  /* After startLessonProgress, because arming the reveal measures where each block sits and the
     progress strip is one of them. */
  armReveal($('lessonBody').querySelector('.lesson-content'));
  /* After the body exists and after armReveal, which is what fixes where each section sits. */
  buildSectionNav();
  wireSectionSpy();
  prefetchNextLesson(curIdx);
  /* The address bar catches up with wherever we just landed, so back, bookmarking and sharing all
     work without every caller of selectLesson having to remember. No-ops when the router itself is
     the one driving. See js/router.js. */
  if (typeof syncRoute === 'function') syncRoute();
  /* The suggested questions are about the lesson, so they follow it. Without this they stayed on
     whichever lesson the panel first loaded under — lesson 1's questions offered on lesson 11. */
  if (typeof refreshStarters === 'function') refreshStarters();
}

/* ---------- finishing a lesson ----------
   There is no "Complete lesson" button any more. A lesson finishes when its work is finished:
   every quiz answered, every goal-checked run cell met, every challenge won. A lesson with none
   of those to offer finishes once the student has actually reached the end of it and stayed a
   while. The button was always clickable from the moment the page loaded, which taught a child
   in lesson one that the questions were decoration. */
let lessonPlan = { keys: [], total: 0, dwellTimer: null, dwellSeen: false };
const DWELL_MS = 20000;

function lessonActivityKeys() {
  const keys = [];
  for (let i = 0; i < widgetSeq.q; i++) keys.push('q' + i);
  for (let i = 0; i < widgetSeq.c; i++) keys.push('c' + i);
  /* Practice steps (`y*`) are not counted in an ORDINARY lesson, though they used to be.
     A practice step checks the student's real game and cannot be waved through, which turns "does
     this lesson count as finished?" into "has the checker been satisfied?" — and lessons unlock in
     a straight line, so one student stuck on their own game, or one bug in a rule, would wall off
     the rest of the course. Reading and questions finish a lesson.
     In a CHECKPOINT they are the whole point, and they are counted. That is the difference between
     the two kinds of lesson: a checkpoint is the one place the course insists, because you cannot
     arrive at the part where you build your own game having built nothing. It sits at the end of a
     module and it is therefore also what the module's stars wait for — completeLesson only awards
     them once every lesson in the module is done, so the gate needs no code of its own.
     Either way they record and award their badge — see renderYourTurnCells. */
  /* A building zone counts as one thing, because it IS one thing — the student's own game, worked
     on in a workspace, with its own goals ticking inside it. Splitting that into an activity per
     goal would put the zone's own progress bar on the lesson page as well, in a different shape.
     A checkpoint that has no zone yet falls back to counting its practice steps. */
  if (widgetSeq.z) { for (let i = 0; i < widgetSeq.z; i++) keys.push('z' + i); }
  else if (isCheckpoint()) { for (let i = 0; i < widgetSeq.y; i++) keys.push('y' + i); }
  // only run cells with an @expect goal can be "finished"; the rest are for tinkering
  goalRunKeys.forEach(function (k) { keys.push(k); });
  return keys;
}
/* Is the lesson on screen a checkpoint? From course.yaml's front-matter via the index, so it is
   known before the body is fetched — the outline draws these rows differently. */
function isCheckpoint(f) {
  const l = f || flat[curIdx];
  return !!(l && l.l && l.l.cp);
}
/* How many practice steps in a lesson are done. */
function practiceProgress(lessonId, count) {
  const done = lessonActivities(lessonId);
  let n = 0;
  for (let i = 0; i < count; i++) if (done['y' + i]) n++;
  return n;
}
function startLessonProgress(f) {
  cancelAdvance();
  clearInterval(lessonPlan.dwellTimer);
  lessonPlan = { keys: lessonActivityKeys(), total: 0, dwellTimer: null, dwellSeen: false };
  lessonPlan.total = lessonPlan.keys.length;
  renderLessonProgress(f);
  wireLessonRail();
  railHigh = 0;                 // a new lesson starts unread, whatever the last one reached
  paintLessonRail();
  if (!lessonPlan.total && !state.done[f.id]) watchDwell(f);
}
function activityProgress() {
  const done = lessonActivities(flat[curIdx] ? flat[curIdx].id : '');
  let n = 0; lessonPlan.keys.forEach(function (k) { if (done[k]) n++; });
  return n;
}

/* ---------- the reading rail ----------
   Two pixels under the view bar saying how far down the lesson you are, and how many of its
   activities are done. A lesson averages about six screens, and until this existed the only
   progress readout was the strip at the very bottom — which you reach by finishing, so it could
   never tell you anything on the way.
   Driven from the scroll position rather than from IntersectionObserver on purpose: this is one
   number about one scroll container, and a listener on that container cannot disagree with it. */
let railWired = false;
let railHigh = 0;          // the furthest this lesson has been read; reset per lesson
function paintLessonRail() {
  const rail = $('lessonRail'), fill = $('lessonRailFill'), count = $('lessonRailCount');
  if (!rail || !fill) return;
  const view = $('view-learn');
  const onLearn = !!view && !view.hidden;
  rail.hidden = !onLearn;
  if (!onLearn) return;
  const max = view.scrollHeight - view.clientHeight;
  // Nothing to scroll means the whole lesson is already on screen, which is 100% read, not 0%.
  let pct = max > 8 ? Math.min(1, Math.max(0, view.scrollTop / max)) : 1;
  // At the bottom, say so. Sub-pixel rounding otherwise leaves it at 0.998 forever.
  if (max > 8 && view.scrollTop + view.clientHeight >= view.scrollHeight - 2) pct = 1;
  /* Never go backwards within a lesson.
     A run cell is a plain code block until the student scrolls near it, and becoming an editor makes
     it taller — so the page grows underneath them and the same scroll position becomes a smaller
     fraction of it. Measured: the rail slid from 0.83 back to 0.80 near the bottom and never reached
     the end. Clamping is the honest reading rather than a cover-up: the words did not change, only
     when we chose to build them, and "how far through am I" should not answer "further back than a
     moment ago" because of that. */
  if (pct < railHigh) pct = railHigh; else railHigh = pct;
  fill.style.transform = 'scaleX(' + pct.toFixed(4) + ')';
  if (count) {
    count.textContent = lessonPlan.total
      ? activityProgress() + ' of ' + lessonPlan.total + ' done'
      : '';
  }
}
function wireLessonRail() {
  if (railWired) return;
  const view = $('view-learn'); if (!view) return;
  railWired = true;
  /* One listener drives both the rail and the build/reveal sweep. Two event sources could disagree
     about where the student is; one cannot. */
  view.addEventListener('scroll', function () { paintLessonRail(); queueSweep(); }, { passive: true });
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('resize', function () { paintLessonRail(); queueSweep(); });
  }
}
/* Called by every widget the moment its work is genuinely finished. */
function resolveActivity(key) {
  const f = flat[curIdx]; if (!f) return;
  markActivity(f.id, key);
  renderLessonProgress(f);
  paintLessonRail();
  if (lessonPlan.total && activityProgress() >= lessonPlan.total) completeLesson();
}
/* Reading lessons: finish on reaching the end and staying there. The timer only runs while the
   tab is actually visible, so parking the lesson in a background tab does not count. */
function watchDwell(f) {
  const content = $('lessonBody').querySelector('.lesson-content');
  if (!content) return;
  const end = document.createElement('div'); end.className = 'lesson-end-sentinel';
  content.appendChild(end);
  let elapsed = 0, last = 0;
  // The tick outlives a lesson switch by up to half a second, and would otherwise write this
  // lesson's reading progress into the next lesson's strip.
  const stillHere = function () { return flat[curIdx] === f; };
  /* Measured directly rather than with an IntersectionObserver. IO callbacks are delivered as
     part of the rendering steps, so a client that isn't painting never gets one — and with the
     Complete button gone, a reading lesson whose observer stays silent can never be finished at
     all. A rect read on a timer that is already running has no such dependency. */
  const atEnd = function () {
    const r = end.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || 0);
  };
  const tick = function () {
    if (!stillHere()) return;
    const seen = atEnd();
    if (seen !== lessonPlan.dwellSeen) { lessonPlan.dwellSeen = seen; if (!seen) last = 0; }
    if (document.visibilityState !== 'visible' || !seen) { last = 0; return; }
    const now = Date.now(); if (last) elapsed += now - last; last = now;
    if (elapsed >= DWELL_MS) { clearInterval(lessonPlan.dwellTimer); completeLesson(); return; }
    renderLessonProgress(f, Math.min(1, elapsed / DWELL_MS));
  };
  lessonPlan.dwellTimer = setInterval(tick, 500);
}
/* ---------- moving on ----------
   After a lesson lands, the next one comes to the student rather than making them go find it in
   the sidebar. It is announced and cancellable: silently navigating away from what someone just
   earned is worse than making them click. */
let advanceTimer = null;
const ADVANCE_MS = 3000;
function cancelAdvance() { clearInterval(advanceTimer); advanceTimer = null; }
function startAdvance(f) {
  cancelAdvance();
  const nextIdx = curIdx + 1;
  if (!flat[nextIdx]) return;                 // last lesson in the course — nowhere to go
  /* Measured against the clock, not by counting ticks: setInterval is throttled in a background
     or unpainted tab, and a countdown that says 4s while 13s have passed is just wrong. */
  let elapsed = 0, last = 0;
  renderLessonProgress(f, 0, Math.ceil(ADVANCE_MS / 1000));
  advanceTimer = setInterval(function () {
    if (flat[curIdx] !== f) { cancelAdvance(); return; }        // they navigated themselves
    if (document.visibilityState !== 'visible') { last = 0; return; }   // not behind their back
    const now = Date.now(); if (last) elapsed += now - last; last = now;
    if (elapsed >= ADVANCE_MS) { cancelAdvance(); selectLesson(nextIdx); return; }
    renderLessonProgress(f, 0, Math.ceil((ADVANCE_MS - elapsed) / 1000));
  }, 250);
}

/* ---------- what reading the answer costs ----------
   Asking the tutor is free: it explains and refuses to write the code, so a student who leans on it
   has still done the work themselves. Reading the worked answer is a different thing — it IS the
   answer — and it halves the lesson's XP.
   Halved rather than zeroed, deliberately. A student who got unstuck and finished still finished,
   and a course that pays nothing for a completed lesson teaches a stuck eleven-year-old to give up
   rather than to look. */
const LAB_REVEAL_KEEP = 0.5;
function lessonXpFactor(lessonId) {
  let factor = 1;
  Object.keys(state.labs || {}).forEach(function (k) {
    if (k.indexOf(lessonId + ':') !== 0) return;
    if ((state.labs[k] || {}).revealed) factor = LAB_REVEAL_KEEP;
  });
  return factor;
}

function completeLesson() {
  const f = flat[curIdx]; if (!f || state.done[f.id]) return;
  clearInterval(lessonPlan.dwellTimer);
  state.done[f.id] = true;
  const factor = lessonXpFactor(f.id);
  const earned = Math.max(1, Math.round(f.l.xp * factor));
  awardXp(earned);
  toast(factor < 1
    ? 'Lesson complete!  +' + earned + ' XP  (half, because you read the answer)'
    : 'Lesson complete!  +' + earned + ' XP');
  /* Ask the module which lessons it contains rather than rebuilding their key names out of f.mi
     and a counter. The arithmetic version was reading seat numbers: reorder the course and it asks
     about whatever now sits in those seats instead of about this module's lessons. */
  const mod = course.modules[f.mi];
  const allDone = mod.lessons.every(function (l) { return !!state.done[l.id]; });
  /* Keyed by the module's id from course.yaml, not its index, for the same reason and with a
     sharper edge: modDone is the only thing stopping the star award happening twice. */
  const modKey = mod.id;
  if (allDone && !state.modDone[modKey]) {
    state.modDone[modKey] = true;
    state.stars += mod.stars;
    setTimeout(function () { toast('Module complete: ' + mod.name + '!  +' + mod.stars + ' ★'); }, 900);
  }
  saveState();
  /* Announce it and stop caring who is listening. Everything that has to react to a finished
     lesson — the outline tick, the progress strip, the countdown to the next one — subscribes in
     wireLessonEvents() below instead of being named here.

     Note what this function no longer does: call selectLesson(). That used to rebuild the lesson
     from scratch and wipe every answer and run-cell edit at the exact moment the student earned
     the reward. Nothing here touches the screen at all now. */
  emit(EV.LESSON_DONE, { id: f.id, xp: f.l.xp, moduleIndex: f.mi, lesson: f });
  if (allDone && state.modDone[modKey]) emit(EV.MODULE_DONE, { moduleIndex: f.mi, moduleId: modKey, stars: mod.stars });
}

/* Who reacts to a finished lesson. Registered once, at load, so the list of consequences is
   readable in one place rather than scattered through whatever function happened to trigger it. */
function wireLessonEvents() {
  on(EV.LESSON_DONE, function (d) { renderLessonProgress(d.lesson); });   // the reward, in place
  on(EV.LESSON_DONE, function () { renderOutline(); });                   // tick the row, unlock the next
  /* Offer the next lesson — but not while the bench is open. Solving a lab can be the last thing
     a lesson needed, and moving the lesson on underneath the student takes the reward away from
     them before they have seen it. closeLab() picks this up when they come back. */
  on(EV.LESSON_DONE, function (d) {
    /* Also a building zone, and there it matters more: finishing a zone is what completes a
       checkpoint, so without this the workspace a student just finished closes itself under them
       three seconds later and the app moves on. closeLab and closeZone both flush this. */
    if (openLabRef || (typeof openZoneRef !== 'undefined' && openZoneRef)) { labPendingAdvance = d.lesson; return; }
    startAdvance(d.lesson);
  });
  on(EV.PROGRESS_CHANGED, function () { renderFooter(); });               // XP bar, stars, level
}
wireLessonEvents();
