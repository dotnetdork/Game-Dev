/* views.js: the centre of the editor. Three tabs, as Unity's centre has: the SCENE view (the level
   as parts, to look at and arrange), the GAME view (the game as a player sees it, runner.js), and,
   once the kid opens it from the Project window, game.js in a code editor.

   WHY IT EXISTS (Jay, 2026-09-29): "there should be a game view (there is) and a scene view (like in
   unity)", and "clicking the game.js script in the project folder area should open an IDE window
   (similar concept to how its structured in the OG course)". Before this, game.js was a read-only
   list of lines inside the Project window, too small to read and impossible to change.

   THE SCENE VIEW is drawn here, from the parts, not by the game: an SVG of the 960×540 level on a
   grid, each part where the level's code puts it, in the game's own pictures (Runner.thumb) or the
   grey of the greybox. Tapping a part picks it, the same as tapping it in the Hierarchy (Editor.select),
   and the picked part shows its outline and, as Unity's gizmos do, its collider in green when it has
   one switched on. That is not the answer to the floor ticket: the kid still has to pick the tile,
   and the Inspector is where it is fixed. EVERYTHING DRAGS (Jay, Sept 30: "everything in the scene
   should be editable"): the Player, the lava, each coin and each block of floor, snapped to 8
   pixels, through Editor.place, so Undo covers it. A coin is one of the Coins' things (schema.js,
   "every thing in the scene can be moved"): tapping one picks that coin, and dragging it moves
   just it; with the Coins' own row picked, a drag moves them all, as dragging a parent does in
   Unity. The tab arrives with the Hierarchy, because before that there are no parts to pick.

   THE GAME FRAME IS NEVER HIDDEN. The Scene and code views are laid over the Game view rather than
   swapping it out: an iframe set to display:none gets a zero-size canvas that Phaser doesn't grow
   back. Play always shows the Game view, and Stop goes back to the view the kid was on, as Unity does.

   THE CODE EDITOR is CodeMirror 5, which is already vendored for V1 (public/vendor/codemirror). It is
   loaded the first time game.js is opened, by adding its script tags then, so the page's own script
   order (index.html) is unchanged and a kid who never opens the code never downloads it. If it fails
   to load (a filter that blocks it), the code opens in a plain text box and everything still works.
   Save & run is the one way code changes: the code goes into the project (st.code, codeEdited, the
   way the Builder's does, builder.js), the frame is rebuilt, and an error the game hits comes back
   with its line (runner.js reports it) and a way to ask for help or put back the version that
   worked. Tapping a line number asks the chat what that line does, as the old read-only list did.

   THE DESIGN DOC (spec D41) is the fourth tab, between Game and game.js: the kid's game written
   down, section by section (project.js has the sections and why they're in that order), with each
   one's state beside its title and the ideas for later at the end. It arrives with the first design
   round (a quest's `reveal: [doc]`), so it is never a blank page nobody has explained. Each section
   is typed into where it sits, with no Edit button and no Save: a change is kept as the kid types,
   and lands in the doc's `changed` list, which is what the next build is sent. A section the kid is
   typing in is never redrawn under them, even when the chat writes to another one.

   Needs, loaded before it: ui.js, project.js, schema.js, runner.js, builder.js, chat.js, editor.js.
   Nothing but `Views` is global. */
var Views = (function () {
  function $(id) { return document.getElementById(id); }
  var current = 'game', beforePlay = null, sceneOn = false, codeOpen = false, docOn = false;
  var TABS = { scene: ['vtScene', 'sceneView'], game: ['vtGame', 'gamebody'], doc: ['vtDoc', 'docView'], code: ['vtCode', 'codeView'] };
  var ORDER = ['scene', 'game', 'doc', 'code'];

  /* ---------- the tabs ---------- */
  /* auto: Play or Stop moved it. A view the kid picks during Play is where Stop leaves them. */
  function show(name, auto) {
    if (!auto) beforePlay = null;
    if (name === 'scene' && !sceneOn) name = 'game';
    if (name === 'code' && !codeOpen) name = 'game';
    if (name === 'doc' && !docOn) name = 'game';
    current = name;
    Object.keys(TABS).forEach(function (k) {
      var tab = $(TABS[k][0]), on = k === name;
      tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1;
      if (k !== 'game') $(TABS[k][1]).hidden = !on;
    });
    $('gamebody').inert = name !== 'game';   // under a view: nothing in it can take focus
    if (name === 'scene') { paintScene(); Runner.askThumbs(); }   // a picture the game drew since the last ask
    if (name === 'code' && cm) setTimeout(function () { cm.refresh(); }, 0);
    if (name === 'doc') paintDoc();
  }
  function tabKeys(e) {
    var d = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!d) return;
    var list = ORDER.filter(function (k) { return !$(TABS[k][0]).hidden; });
    var n = list[(list.indexOf(current) + d + list.length) % list.length];
    e.preventDefault(); show(n); $(TABS[n][0]).focus();
  }
  function revealScene(on) { sceneOn = !!on; $('vtScene').hidden = !sceneOn; if (!sceneOn && current === 'scene') show('game'); }
  function revealDoc(on) { docOn = !!on; $('vtDoc').hidden = !docOn; if (!docOn && current === 'doc') show('game'); }
  /* Play shows the game; Stop goes back to where the kid was. */
  function playing(on) {
    if (on && current !== 'game') { beforePlay = current; show('game', true); }
    else if (!on && beforePlay) { var b = beforePlay; beforePlay = null; show(b, true); }
  }

  /* ---------- the Scene view ---------- */
  var W = 960, H = 540, dims = {};
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* A picture's own size, read once from its thumbnail (the game draws each at its natural size). */
  function dim(url) {
    if (!url) return null;
    var d = dims[url]; if (d) return d.w ? d : null;
    dims[url] = {};
    var im = new Image();
    im.onload = function () { dims[url] = { w: im.naturalWidth, h: im.naturalHeight }; paintScene(); };
    im.src = url;
    return null;
  }
  var pats = {};   // this paint's picture fills and tints, by id
  function fillOf(key) {
    var u = key && Runner.thumb(key), d = dim(u); if (!d) return null;
    var id = 'pt-' + key.replace(/W/g, '');
    pats[id] = '<pattern id="' + id + '" patternUnits="userSpaceOnUse" width="' + d.w + '" height="' + d.h + '"><image href="' + u + '" width="' + d.w + '" height="' + d.h + '"/></pattern>';
    return 'url(#' + id + ')';
  }
  /* A tint multiplies a picture's colours, inside its own shape (Phaser's setTint), and replaces a grey
     box's fill (setFillStyle): the game's paint(). */
  function tinted(c) {
    if (!/^#[0-9a-f]{6}$/i.test(c || '')) return '';
    var id = 'tn-' + c.slice(1);
    pats[id] = '<filter id="' + id + '" color-interpolation-filters="sRGB"><feFlood flood-color="' + c + '"/><feComposite in2="SourceAlpha" operator="in"/>'
      + '<feBlend in2="SourceGraphic" mode="multiply"/></filter>';
    return ' filter="url(#' + id + ')"';
  }
  function rect(x, y, w, h, fill, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function image(u, b, extra) { return '<image href="' + u + '" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '"' + (extra || '') + '/>'; }
  /* A floor or the lava: a 64px block with its fill below it, as the game's block() draws it. */
  /* A floor block or the lava: 64px tall with its fill below it, as the game's block() draws it. A
     picture with no fill of its own (a coin's, on a floor) fills with itself, as the game does. */
  function block(p, x, y, w, grey, greyFill) {
    var art = fillOf(p.look), under = fillOf(p.look && p.look + '_fill') || art, below = H - (y + 64);
    var out = art ? rect(x, y, w, 64, art, tinted(p.tint)) : rect(x, y, w, 64, p.tint || grey);
    if (below > 0) out += under ? rect(x, y + 64, w, below, under, tinted(p.tint)) : rect(x, y + 64, w, below, p.tint || greyFill);
    return out;
  }
  /* Each part's boxes in level pixels, one per thing it draws (schema.js, things): what's drawn,
     what a tap hits, the outline when picked, the collider gizmo. */
  function boxes(p) {
    if (p.kind === 'floor') return Schema.things(p).map(function (q) { return [q.x, q.y, q.w, H - q.y]; });
    if (p.kind === 'lava') return [[p.x, p.y, p.w, H - p.y]];
    if (p.kind === 'coin') return (p.spots || []).map(function (s) { var z = coinSize(p); return [s[0] - z[0] / 2, s[1] - z[1] / 2, z[0], z[1]]; });
    if (p.kind === 'player') return [heroBox(p)];
    return [];
  }
  /* A coin's picture at its own size times Scale, or the grey circle's 30. */
  function coinSize(p) { var d = p.look && dim(Runner.thumb(p.look)), k = p.size || 1; return d ? [d.w * k, d.h * k] : [30 * k, 30 * k]; }
  /* The grey box is 40×56 on the Player's spot; a sprite (the hero, or any other the kid gave it)
     stands with its feet where the box's feet were (starter/game.js, makePlayer). */
  function heroArt(p) { var u = p.look && Runner.thumb(p.look); return u && dim(u) ? u : null; }
  function heroBox(p) {
    var u = heroArt(p), d = u && dim(u);
    return d ? [p.x - d.w / 2, p.y + 28 - d.h, d.w, d.h] : [p.x - 20, p.y - 28, 40, 56];
  }
  function drawPart(p) {
    if (p.kind === 'floor') return Schema.things(p).map(function (q) { return block(p, q.x, q.y, q.w, '#6e6e6e', '#5f5f5f'); }).join('');
    if (p.kind === 'lava') return block(p, p.x, p.y, p.w, '#7c7c7c', '#747474');
    if (p.kind === 'coin') {
      var cu = p.look && Runner.thumb(p.look), art = cu && dim(cu);
      return boxes(p).map(function (b, i) {
        var s = p.spots[i];
        return art ? image(cu, b, tinted(p.tint))
          : '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + (15 * (p.size || 1)) + '" fill="' + (p.tint || '#c4c4c4') + '" stroke="#8f8f8f" stroke-width="3"/>';
      }).join('');
    }
    if (p.kind === 'player') {
      var hu = heroArt(p), hb = heroBox(p);
      return hu ? image(hu, hb, tinted(p.tint)) : rect(hb[0], hb[1], hb[2], hb[3], p.tint || '#4f4f4f');
    }
    return '';
  }
  function paintScene() {
    var svg = $('sceneSvg'); if (!svg || current !== 'scene') return;
    var st = Project.get(), sel = Editor.selected(), level = st.parts.filter(function (p) { return p.kind === 'level'; })[0];
    pats = {};
    // the level's own grey, and its background picture centred at its size (starter/game.js, create)
    var body = rect(0, 0, W, H, '#9a9a9a'), bu = level && level.look && Runner.thumb(level.look), bd = dim(bu);
    if (bd) body += image(bu, [W / 2 - bd.w / 2, H / 2 - bd.h / 2, bd.w, bd.h]);
    body += '<rect class="gridover" x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#grid)"/>';
    var picked = Editor.refOf(sel);
    st.parts.forEach(function (p) {
      if (p.kind === 'level') return;
      var bx = boxes(p), on = p.id === picked.id, mine = function (n) { return on && (picked.i < 0 || picked.i === n); };
      body += '<g class="spart' + (on ? ' on' : '') + '" data-part="' + esc(p.id) + '"><title>' + esc(p.name) + '</title>' + drawPart(p)
        + bx.map(function (b, n) { return '<rect class="hit" data-i="' + n + '" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '"/>'; }).join('');
      if (on) {
        body += bx.map(function (b, n) { return mine(n) ? '<rect class="sel" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '"/>' : ''; }).join('');
        // the collider gizmo, Unity's green box, on a part whose Box Collider 2D is switched on
        if (p.kind === 'floor' && p.solid) body += bx.map(function (b, n) { return mine(n) ? '<rect class="gizmo" x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="64"/>' : ''; }).join('');
      }
      body += '</g>';
    });
    svg.innerHTML = '<defs><pattern id="grid" patternUnits="userSpaceOnUse" width="32" height="32"><path d="M32 0H0V32" fill="none" class="gridline"/></pattern>'
      + Object.keys(pats).map(function (id) { return pats[id]; }).join('') + '</defs>'
      + '<rect x="-400" y="-400" width="' + (W + 800) + '" height="' + (H + 800) + '" fill="url(#grid)"/>'
      + body + '<rect class="bounds" x="0" y="0" width="' + W + '" height="' + H + '"/>';
    var pp = sel && Project.part(picked.id), name = pp ? (picked.i >= 0 ? Schema.childName(pp, picked.i) : pp.name) : '';
    $('sceneHint').textContent = !pp ? 'Tap anything to pick it. Drag it to move it.'
      : pp.kind === 'level' ? name + ' is picked. Its settings are in the Inspector.'
      : Schema.many(pp) && picked.i < 0 ? 'Drag to move all of the ' + name + ', or tap one to move just it.'
      : 'Drag ' + name + ' to move it, or type its Position in the Inspector.';
  }
  /* THE PICKED PART, OUTLINED OVER THE GAME VIEW too, while it's stopped (the Sept 30 critique: a
     Hierarchy row that lights nothing on screen can't tell a kid which grey block the Floor tile
     is). The game fits and centres its 960×540 in the frame, and so does this SVG's viewBox, so the
     boxes land on the game's own things. Play hides it (CSS). */
  function paintPick() {
    var svg = $('pickOver'); if (!svg) return;
    var r = Editor.refOf(Editor.selected()), p = r.id && Project.part(r.id);
    if (!p || p.kind === 'level') { svg.innerHTML = ''; return; }
    svg.innerHTML = boxes(p).map(function (b, n) {
      return r.i < 0 || r.i === n ? '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="2"/>' : '';
    }).join('');
  }
  /* Level pixels under the pointer. */
  function at(e) { var svg = $('sceneSvg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
  var drag = null;
  /* What a tap picks: the thing under it (one coin), unless its part is already picked whole, when
     the drag moves them all. */
  function sceneDown(e) {
    var g = e.target.closest && e.target.closest('[data-part]');
    if (!g) { if (Editor.selected()) Editor.closeInspector(); paintScene(); return; }
    var id = g.getAttribute('data-part'), p = Project.part(id), hit = e.target.closest('[data-i]');
    var i = hit ? +hit.getAttribute('data-i') : 0, sel = Schema.many(p) && Editor.selected() !== id ? id + '#' + (i + 1) : id;
    if (Editor.selected() !== sel) Editor.select(sel);
    if (!Runner.isPlaying()) {
      var w = Schema.where(p, Editor.refOf(sel).i), q = at(e);
      drag = { sel: sel, dx: q.x - w.x, dy: q.y - w.y, x: w.x, y: w.y, moved: false,
               one: sel === id && Schema.many(p) ? id + '#' + (i + 1) : null };   // a tap, not a drag, picks the one
      try { $('sceneSvg').setPointerCapture(e.pointerId); } catch (err) {}
    }
    paintScene();
  }
  function sceneMove(e) {
    if (!drag) return;
    var q = at(e), snap = function (v, max) { return Math.max(0, Math.min(max, Math.round(v / 8) * 8)); };
    var to = { x: snap(q.x - drag.dx, W), y: snap(q.y - drag.dy, H) };
    if (!drag.moved && to.x === drag.x && to.y === drag.y) return;   // a tap, not a drag
    Editor.place(drag.sel, to, true, true);   // replay: no undo step for each move
    drag.moved = true; paintScene();
  }
  /* Letting go: put it back where the drag began, then move it there for real, so Undo has the
     move as one step (or X then Y, for a part whose position is two settings). */
  function sceneUp() {
    var d = drag; drag = null;
    if (d && !d.moved && d.one) { Editor.select(d.one); paintScene(); return; }
    if (!d || !d.moved) return;
    var r = Editor.refOf(d.sel), end = Schema.where(Project.part(r.id), r.i), to = { x: end.x, y: end.y };
    Editor.place(d.sel, { x: d.x, y: d.y }, true, true);
    Editor.place(d.sel, to);
    paintScene();
  }

  /* ---------- game.js ---------- */
  var cm = null, box = null, loading = null, saved = '', history = [], lastError = null, codeStart = 0;
  function loadCodeMirror() {
    if (window.CodeMirror) return Promise.resolve();
    if (loading) return loading;
    var base = '/vendor/codemirror/';
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'lib/codemirror.css'; document.head.appendChild(css);
    function js(src) {
      return new Promise(function (ok, no) {
        var s = document.createElement('script'); s.src = base + src; s.onload = ok; s.onerror = function () { no(new Error(src)); };
        document.head.appendChild(s);
      });
    }
    loading = js('lib/codemirror.js').then(function () {
      return Promise.all(['mode/javascript/javascript.js', 'addon/edit/matchbrackets.js', 'addon/edit/closebrackets.js',
        'addon/selection/active-line.js', 'addon/comment/comment.js'].map(js));
    });
    loading.catch(function () { loading = null; });
    return loading;
  }
  function text() { return cm ? cm.getValue() : box ? box.value : ''; }
  function dirty() { return codeOpen && text() !== saved; }
  function paintCode() {
    var d = dirty();
    $('codeDirty').hidden = !d;
    $('vtCode').setAttribute('aria-label', 'game.js' + (d ? ', not saved' : ''));
    $('codeState').textContent = d ? 'Not saved yet' : lastError ? 'Saved, but the game hit an error' : 'Saved';
    $('codeSave').disabled = !d;
    $('codeErr').hidden = !lastError;
    if (lastError) {
      $('codeErrText').textContent = (lastError.line ? 'Line ' + lastError.line + ': ' : '') + lastError.text;
      $('codeErrGo').hidden = !lastError.line;
      $('codeErrBack').hidden = !history.length;
    }
    if (cm) cm.operation(function () {
      for (var i = 0; i < cm.lineCount(); i++) cm.removeLineClass(i, 'background', 'cm-errline');
      if (lastError && lastError.line) cm.addLineClass(lastError.line - 1, 'background', 'cm-errline');
    });
  }
  function openCode() {
    codeOpen = true; $('vtCode').hidden = false; $('codeClose').hidden = false;
    show('code');
    if (cm || box) { if (!dirty()) reload(); return; }
    $('codeState').textContent = 'Opening…';
    Promise.all([Project.code(), loadCodeMirror().then(function () { return true; }, function () { return false; })]).then(function (r) {
      saved = r[0];
      if (r[1] && window.CodeMirror) {
        cm = CodeMirror($('codeHost'), {
          value: saved, mode: 'javascript', theme: 'studio', lineNumbers: true, indentUnit: 2, tabSize: 2,
          matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, lineWrapping: false,
          screenReaderLabel: 'game.js, your game’s code',
          extraKeys: { 'Ctrl-S': save, 'Cmd-S': save, 'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment', 'Esc': function () { $('vtCode').focus(); } }
        });
        cm.on('change', paintCode);
        cm.on('gutterClick', function (c, n) { askLine(n + 1); });
      } else {
        // CodeMirror didn't load (a filtered network): a plain box, and everything else the same
        box = document.createElement('textarea'); box.className = 'codebox'; box.spellcheck = false; box.value = saved;
        box.setAttribute('aria-label', 'game.js, your game’s code');
        box.addEventListener('input', paintCode);
        box.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
        $('codeHost').appendChild(box);
      }
      paintCode();
      if (cm) cm.focus(); else box.focus();
    });
  }
  function closeCode() {
    codeOpen = false; $('vtCode').hidden = true; $('codeClose').hidden = true;
    if (current === 'code') show('game');
    $('vtGame').focus();
  }
  /* Load the project's code into the editor: after the Builder changed it, or an undo put it back. */
  function reload() {
    Project.code().then(function (code) {
      if (code === saved) return;
      saved = code;
      if (cm) { var at = cm.getCursor(); cm.setValue(code); cm.setCursor(at); } else if (box) box.value = code;
      paintCode();
    });
  }
  function askLine(n) {
    var line = (cm ? cm.getLine(n - 1) : text().split('\n')[n - 1]) || '';
    if (!line.trim()) return;
    Chat.send('What does line ' + n + ' of game.js do? `' + line.trim().slice(0, 150) + '`');
  }
  /* Save & run: the one way the kid's own code gets into the game. */
  function save() {
    var code = text();
    if (code === saved) return;
    if (Builder.busy()) { $('codeState').textContent = 'The Builder is changing your game. Save again in a moment'; return; }
    if (Runner.isPlaying()) Editor.togglePlay();   // the change is to the game, not this test run (builder.js)
    var st = Project.get();
    history.push({ code: st.code, codeEdited: !!st.codeEdited }); if (history.length > 10) history.shift();
    st.code = code; st.codeEdited = true; saved = code; lastError = null;
    Project.save(); paintCode();
    $('codeState').textContent = 'Saved. Starting your game…';
    Chat.event('You changed game.js', 'i-script', { consoleOnly: true });
    watching = true;
    Runner.mount($('stage'), code, st.parts, UI.muted()).then(function () { if (!lastError) $('codeState').textContent = 'Saved. Your game restarted with it'; setTimeout(Runner.askThumbs, 600); });
  }
  var watching = false;
  Runner.on(function (name, t, line) {
    if (name !== 'error' || !watching || !codeOpen) return;
    lastError = { text: String(t || 'Something went wrong'), line: line || null };
    paintCode();
  });
  function putBack() {
    var h = history.pop(); if (!h) return;
    var st = Project.get(); st.code = h.code; st.codeEdited = h.codeEdited; lastError = null; Project.save();
    Project.code().then(function (code) {
      saved = code; if (cm) cm.setValue(code); else if (box) box.value = code;
      paintCode(); $('codeState').textContent = 'Put back the version before';
      Runner.mount($('stage'), code, st.parts, UI.muted());
    });
  }

  /* ---------- the design doc ---------- */
  var STATE_WORDS = { empty: 'Not decided yet', started: 'Started', decided: 'Decided' };
  var MARKS = { empty: 'i-sec-empty', started: 'i-sec-started', decided: 'i-sec-decided' };
  var docBuilt = false, typing = {};
  /* Built once: a heading, one section per entry in Project.SECTIONS, the ideas. paintDoc fills it. */
  function buildDoc() {
    var host = $('docHost'); if (!host || docBuilt) return;
    docBuilt = true;
    var art = document.createElement('article'); art.className = 'gdd';
    art.innerHTML = '<header><h2></h2><p>Your game, written down. The Builder builds what this says, so change anything you like.</p></header>';
    Project.SECTIONS.forEach(function (s) {
      var sec = document.createElement('section'); sec.className = 'dsec'; sec.setAttribute('data-sec', s[0]);
      sec.innerHTML = '<h3 id="ds-' + s[0] + '"><svg class="i mark" aria-hidden="true"><use href="#i-sec-empty"/></svg><span class="st"></span><span class="sw"></span></h3>'
        + '<textarea rows="2" maxlength="600" spellcheck="true" aria-labelledby="ds-' + s[0] + '" data-key="doc:' + s[0] + '"></textarea>';
      sec.querySelector('.st').textContent = s[1];
      var t = sec.querySelector('textarea');
      t.placeholder = s[2];
      t.addEventListener('input', function () { grow(t); clearTimeout(typing[s[0]]); typing[s[0]] = setTimeout(function () { keep(s[0], t); }, 700); });
      t.addEventListener('change', function () { keep(s[0], t); });
      t.addEventListener('blur', function () { keep(s[0], t); });
      art.appendChild(sec);
    });
    var ideas = document.createElement('section'); ideas.className = 'dideas';
    ideas.innerHTML = '<h3 id="ds-ideas"><svg class="i" aria-hidden="true"><use href="#i-bulb"/></svg><span class="st">Ideas for later</span></h3><ul aria-labelledby="ds-ideas"></ul>';
    art.appendChild(ideas);
    host.appendChild(art);
  }
  /* A box as tall as its words (the CSS does it where field-sizing works; this is for the rest). */
  var FIELD_SIZING = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
  function grow(t) { if (FIELD_SIZING) return; t.style.height = 'auto'; if (t.scrollHeight) t.style.height = (t.scrollHeight + 2) + 'px'; }
  function keep(key, t) {
    clearTimeout(typing[key]); typing[key] = null;
    if (Project.writeDoc(key, t.value, 'kid')) {
      $('docState').textContent = 'Saved. ' + progress();
      Chat.event('You changed ' + Project.SECTIONS.filter(function (s) { return s[0] === key; })[0][1] + ' in the design doc', 'i-doc', { consoleOnly: true });
    }
  }
  function progress() {
    var secs = Project.doc().sections, n = Project.SECTIONS.filter(function (s) { return secs[s[0]].state === 'decided'; }).length;
    return n + ' of ' + Project.SECTIONS.length + ' decided';
  }
  function paintDoc() {
    if (current !== 'doc') return;
    buildDoc();
    var d = Project.doc(), game = window.Quest && Quest.progress ? Quest.progress().game : '';
    document.querySelector('.gdd h2').textContent = game || 'Your game';
    Project.SECTIONS.forEach(function (s) {
      var sec = document.querySelector('.dsec[data-sec="' + s[0] + '"]'), v = d.sections[s[0]];
      sec.setAttribute('data-state', v.state);
      sec.querySelector('.mark use').setAttribute('href', '#' + MARKS[v.state]);
      sec.querySelector('.sw').textContent = STATE_WORDS[v.state];
      var t = sec.querySelector('textarea');
      // never under the kid's fingers: the box they are in keeps what they're typing
      if (document.activeElement !== t && !typing[s[0]] && t.value !== v.text) { t.value = v.text; grow(t); }
    });
    var ul = document.querySelector('.dideas ul'); ul.innerHTML = '';
    if (!d.ideas.length) { var e = document.createElement('li'); e.className = 'empty'; e.textContent = 'Nothing yet. Anything you ask for that isn’t built yet is kept here.'; ul.appendChild(e); }
    d.ideas.slice().reverse().forEach(function (x) { var li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
    $('docState').textContent = progress();
  }
  function openDoc() { if (!docOn) return; show('doc'); $('vtDoc').focus(); }

  function init() {
    ORDER.forEach(function (k) {
      var tab = $(TABS[k][0]);
      tab.addEventListener('click', function () { show(k); });
      tab.addEventListener('keydown', tabKeys);
    });
    $('codeClose').addEventListener('click', closeCode);
    $('codeSave').addEventListener('click', save);
    $('codeErrGo').addEventListener('click', function () { if (cm && lastError && lastError.line) { cm.focus(); cm.setCursor({ line: lastError.line - 1, ch: 0 }); } });
    $('codeErrAsk').addEventListener('click', function () {
      Chat.send('My game.js has an error' + (lastError && lastError.line ? ' on line ' + lastError.line : '') + ': “' + (lastError ? lastError.text : '') + '”. What’s wrong?');
    });
    $('codeErrBack').addEventListener('click', putBack);
    var svg = $('sceneSvg');
    svg.addEventListener('pointerdown', sceneDown);
    svg.addEventListener('pointermove', sceneMove);
    svg.addEventListener('pointerup', sceneUp);
    svg.addEventListener('pointercancel', sceneUp);
    Editor.on(function (name) { if (name === 'select' || name === 'deselect' || name === 'set') { paintScene(); paintPick(); } });
    Project.onDoc(paintDoc);
    Runner.on(function (name) { if (name === 'thumbs' || name === 'ready' || name === 'stop') { paintScene(); paintPick(); } if (name === 'play') playing(true); if (name === 'stop') playing(false); });
    if (window.Builder) Builder.on(function (name) {
      if (name !== 'built' && name !== 'reverted') return;
      paintScene(); paintPick(); lastError = null;
      if (!codeOpen) return;
      if (!dirty()) return reload();
      // the kid's unsaved edits are kept; they're told that saving replaces what the Builder did
      paintCode(); $('codeState').textContent = 'The Builder changed game.js. Save & run replaces its change with yours';
    });
    show('game');
  }

  return { init: init, show: show, openCode: openCode, revealScene: revealScene, paintScene: paintScene,
           revealDoc: revealDoc, openDoc: openDoc, paintDoc: paintDoc, docOn: function () { return docOn; },
           current: function () { return current; } };
})();
