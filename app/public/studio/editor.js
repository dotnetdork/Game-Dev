/* editor.js: the engine around the game. The bar (menus, Play, the kid's own menu), docks, the Hierarchy, the Inspector,
   the Project window, Play, Undo, the pointer.

   The layout and its rules are DESIGN.md's; this file is the behaviour:
   - The Builds Around You Rule. Docks open in story order; until then each is a faint outline in
     its final place, inert and hidden from screen readers, so nothing reads out a panel the kid
     can't see yet. The menus follow the same rule: Window lists only panels the kid has met, and
     a menu item exists only when it works (spec §3.3).
   - The Hierarchy lists the parts; tapping one opens the Inspector as its own dock above the
     conversation (The No Overlay Rule). Components belong to the part they're on, as in Unity, with
     their on/off checkbox in the header where Unity has one.
   - Which components the Inspector opens is up to the story (allow()): on the first day each
     department's job has one knob to find, open, and the rest are folded, one tap away.
   - Play works as Unity's does, including the undo on Stop (runner.js says why), and so do Pause
     and Step. Play, Pause and Stop are three buttons, as in Unity and Unreal (Jay, 2026-09-29): one
     Play button that turned into Stop left a kid who wanted to stop hunting for a button that had
     changed its name. Play stays lit while the game runs, and pressed while paused it carries on.
     Step is the one that waits for the story (stepTools).
   - Undo and Redo cover what the kid changed in the Inspector. What was changed in Play mode is
     undone by Stop anyway, so Stop drops those steps rather than offering to undo them twice.
   - Duplicate, Delete and GameObject › Create make more coins, blocks and lava, or fewer (spec D59;
     "more of a thing, or fewer", below). A right-click opens a menu of what can be done to the thing
     under it (spec D57; "the right-click menu", below), and an asset from the Project window drops
     onto a Hierarchy row or a part in the Scene view as well as onto its slot (spec D58).
   - DOCKS. Every panel but the Game view can be dragged by its tab into the left, right or bottom
     area, and every edge between panels can be dragged to resize. The layout is the kid's own, kept
     in this browser; Layout › Default puts it back. None of it is needed to do anything: a kid who
     never drags a tab has the default layout, which is the one the quests are written for.
   Every change the Inspector makes goes through set(), which updates the project, tells the game,
   and tells whoever is listening (the quest engine) what the kid did. */
var Editor = (function () {
  function $(id) { return document.getElementById(id); }
  var allowed = {}, selected = null, listeners = [];

  function on(fn) { listeners.push(fn); }
  function emit(name, detail) { listeners.forEach(function (fn) { try { fn(name, detail); } catch (e) { console.error(e); } }); }
  function status(text) { $('statusMsg').textContent = text; }
  /* What the story has brought out so far. Most are elements (a panel, Play); Undo and the layouts
     are menu items now, so theirs is only a flag. */
  var gates = {};
  function isOpen(id) { var d = $(id); return d ? !d.classList.contains('closed') : !!gates[id]; }

  function openDock(id, open) {
    var d = $(id); if (!d) return;
    if (open && maxed && maxed !== d) unmaximize();   // a panel arriving is shown, not hidden under a big one
    if (open && d.classList.contains('closed')) unmin(d);   // ...nor folded (minimize)
    var arriving = open && d.classList.contains('closed');
    d.classList.toggle('closed', !open); d.inert = !open; d.setAttribute('aria-hidden', String(!open));
    // a panel the story brings out, tabbed with others, is the one showing: it's what the story means
    var pn = d.getAttribute('data-panel');
    if (L && PANELS[pn] && slot(leadOf(pn)).length > 1) { if (arriving) setFront(leadOf(pn), pn); applyLayout(); }
    // Undo and Layout arrive with the first panel whose contents the kid can change or move.
    if (id === 'dHier' && open) { reveal('editTools', true); reveal('layoutTools', true); }
    // ...and the Scene view with the Hierarchy: the parts, to look at and pick (views.js)
    if (id === 'dHier' && window.Views) Views.revealScene(!!open);
    paintBar();
  }
  function reveal(id, open) {
    var d = $(id);
    if (!d) gates[id] = !!open; else { d.classList.toggle('closed', !open); d.inert = !open; }
    paintBar();
  }

  /* ---------- the Hierarchy ---------- */
  /* Names only, as Unity's is. The first build glossed each row ("not solid!", "looks broken"), which
     told the kid the answer before they looked (Jay, 2026-09-28: no glosses).
     A part that draws several things (schema.js, "every thing in the scene can be moved") is a
     parent row with its things under it, "Coin (1)", "Coin (2)", as a prefab's instances are in
     Unity. It starts folded, with how many are inside at the end of the row, so the first day's
     Hierarchy stays six rows a kid can scan; its arrow opens it, and picking one of its things in
     the Scene view opens it too, so the row that lights up is always on screen. */
  var unfolded = {};
  function refOf(sel) { var m = /^(.+)#(\d+)$/.exec(sel || ''); return m ? { id: m[1], i: +m[2] - 1 } : { id: sel, i: -1 }; }
  function row(ul, key, name, icon, depth, animate, k, pick) {
    var li = document.createElement('li');
    li.className = (depth ? 'child' : '') + (depth > 1 ? ' grand' : '') + (animate ? ' snap' : '');
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-key', 'part:' + key);
    b.setAttribute('aria-pressed', String(selected === key));
    if (animate) b.style.animationDelay = (k * 0.1) + 's';
    b.innerHTML = '<svg class="i" aria-hidden="true"><use href="#' + icon + '"/></svg><span class="nm"></span>';
    b.querySelector('.nm').textContent = name;
    b.addEventListener('click', pick);
    b.addEventListener('dblclick', function () { renameRow(key); });
    b.addEventListener('keydown', function (e) { if (e.key === 'F2') { e.preventDefault(); renameRow(key); } });
    // an asset dragged in from the Project window, onto the part it fits (takes)
    var id = refOf(key).id;
    b.addEventListener('dragover', function (e) { if (takes(id)) { e.preventDefault(); b.classList.add('over'); } });
    b.addEventListener('dragleave', function () { b.classList.remove('over'); });
    b.addEventListener('drop', function (e) { b.classList.remove('over'); if (takes(id)) { e.preventDefault(); give(id); } });
    li.appendChild(b); ul.appendChild(li);
    return li;
  }
  /* Renaming, as in any engine (Jay, Sept 30: "you can rename the level, rename the objects or
     things in the scene"): double-click a row or press F2 on it, or type in the Inspector's name box.
     A name is only a name: the quests find a part by its id, so a kid who calls the Floor tile
     "Trapdoor" still has it pointed at. One coin's name is kept in its prefab's `names`, by its place
     in the list (schema.js childName). */
  function nameOf(sel) { var r = refOf(sel), p = Project.part(r.id); return !p ? '' : r.i >= 0 ? Schema.childName(p, r.i) : p.name; }
  function rename(sel, text) {
    var r = refOf(sel), p = Project.part(r.id), t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!p || !t || t === nameOf(sel)) return;
    if (r.i < 0) return set(p.id, 'name', t);
    var names = (p.names || []).slice(); names[r.i] = t; set(p.id, 'names', names);
  }
  function renameRow(sel) {
    if (selected !== sel) select(sel);   // a double-click's two clicks picked it and put it down again
    var b = $('tree').querySelector('[data-key="part:' + sel + '"]'); if (!b) return;
    unmin(b);   // from the Scene view's menu, or Edit › Rename, with the Hierarchy folded or behind a tab
    var box = document.createElement('input'), done = false;
    box.className = 'rn'; box.value = nameOf(sel); box.maxLength = 32; box.spellcheck = false;
    box.setAttribute('aria-label', 'New name for ' + nameOf(sel)); box.setAttribute('data-key', 'rename:' + sel);
    b.hidden = true; b.parentNode.insertBefore(box, b.nextSibling);
    box.focus(); box.select();
    function end(keep) {
      if (done) return; done = true;
      if (keep) rename(sel, box.value);
      tree();
      var nb = $('tree').querySelector('[data-key="part:' + sel + '"]'); if (nb) nb.focus();
    }
    box.addEventListener('keydown', function (e) {
      e.stopPropagation();   // Escape here is "never mind", not "close the Inspector"
      if (e.key === 'Enter') { e.preventDefault(); end(true); }
      if (e.key === 'Escape') { e.preventDefault(); end(false); }
    });
    box.addEventListener('blur', function () { end(true); });
  }
  /* The level folds too: its arrow was a drawing, and Jay (Sept 30) found it "doesn't dropdown". It
     starts open, since everything the day asks for is inside it. */
  var levelShut = false;
  function twisty(li, p, open, n, flip) {
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'twisty'; t.setAttribute('data-key', 'open:' + p.id);
    t.setAttribute('aria-expanded', String(!!open)); t.setAttribute('aria-label', (open ? 'Fold ' : 'Open ') + p.name + ': ' + n + ' inside');
    t.setAttribute('data-tip', open ? 'Fold it' : 'Show the ' + n + ' inside');
    t.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-fold"/></svg>';
    t.addEventListener('click', function () { flip(); tree(); });
    li.classList.add('parent'); li.insertBefore(t, li.querySelector('button'));
  }
  function tree(animate) {
    UI.keepFocus($('tree'), function () {
      var ul = $('tree'); ul.innerHTML = '';
      var parts = Project.get().parts;
      parts.forEach(function (p, k) {
        if (levelShut && p.kind !== 'level') return;
        var kids = Schema.many(p) ? Schema.things(p) : null, open = kids && unfolded[p.id];
        var li = row(ul, p.id, p.name, p.kind === 'level' ? 'i-layout' : kids ? 'i-folder' : 'i-cube', p.kind === 'level' ? 0 : 1, animate, k, function () { select(p.id); });
        if (p.kind === 'level') return twisty(li, p, !levelShut, parts.length - 1, function () { levelShut = !levelShut; });
        if (!kids) return;
        li.querySelector('button').insertAdjacentHTML('beforeend', '<small>' + kids.length + '</small>');
        twisty(li, p, open, kids.length, function () { unfolded[p.id] = !open; });
        if (open) kids.forEach(function (q, i) {
          var key = p.id + '#' + (i + 1);
          row(ul, key, Schema.childName(p, i), 'i-cube', 2, false, 0, function () { select(key); });
        });
      });
    });
    paintCue();
  }

  /* ---------- the Inspector ---------- */
  /* Drawn from schema.js, the one list of components and settings (its header says why). Unity's
     shapes, because the Unity words and habits stay (Jed, 2026-09-28):
     - a component header: fold arrow, the on/off checkbox where Unity has one (that IS the setting:
       a Box Collider that's off lets things fall through), the icon and the real name. No gloss
       under it; the plain words are in its tooltip.
     - a number: its label, a slider, and a box to type the exact value in.
     - an OBJECT FIELD for a sprite or a sound: a slot saying what's in it ("None (Sprite)"), and the
       round picker button beside it that opens the list of what fits. A slot also takes an asset
       dragged from the Project window, or TAPPED there first (tap-to-slot: a Chromebook trackpad
       drag is hard, and a touch screen has no drag at all). A slot that can take the held asset
       glows.
     - a colour: a swatch that opens the palette.
     Which components open is up to the story (allow()): on the first day each department's job has
     one to find, open, so a kid isn't handed six at once. The rest are FOLDED, not locked (Jay,
     Sept 30: "the inspector should allow you to manually configure several things if you want
     to"): a kid who opens one and paints the lava early has fixed that ticket early, and it closes
     itself (quest.js, fixed_when). After the first day, all of them open. Every part opens with its
     name and a Transform, so the Inspector has the same shape whichever part is picked (schema.js,
     "every part has the same shape"). */
  function allow(list) { allowed = {}; (list || []).forEach(function (c) { allowed[c] = true; }); if (selected) inspect(selected); }

  var folded = {};
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* `later`: a component the story isn't asking about yet starts folded, until the kid opens it.
     `bare`: nothing under it to set (a Box Collider is only its checkbox), so no fold arrow: an
     arrow that opens nothing reads as broken (Jay, Sept 30: "Dropdowns should only render if there
     is stuff attached to that thing"). A spacer keeps the names in line. */
  function header(c, p, later, bare) {
    var id = c.name.replace(/\W+/g, '-').toLowerCase(), shut = !bare && (c.name in folded ? !!folded[c.name] : !!later);
    var h = '<div class="comp' + (shut ? ' folded' : '') + (bare ? ' bare' : '') + '" data-comp="' + esc(c.name) + '">'
      + (bare ? '<span class="fold" aria-hidden="true"></span>'
        : '<button type="button" class="fold" data-fold="' + esc(c.name) + '" data-key="fold:' + id + '" aria-expanded="' + !shut + '" aria-controls="cb-' + id + '" aria-label="Fold ' + esc(c.name) + '" data-tip="Fold or open this component"><svg class="i" aria-hidden="true"><use href="#i-fold"/></svg></button>')
      + '<svg class="i cicon" aria-hidden="true"><use href="#' + (c.icon || 'i-cube') + '"/></svg>';
    if (c.toggle) {
      h += '<button type="button" class="cbox" role="checkbox" data-key="c:' + c.toggle + '" data-set="' + c.toggle + '" aria-checked="' + !!p[c.toggle] + '" data-tip="' + esc(c.tip || c.name) + '">'
        + '<i aria-hidden="true"><svg class="i"><use href="#i-check"/></svg></i><strong>' + esc(c.name) + '</strong></button>';
    } else h += '<strong class="cname" data-tip="' + esc(c.tip || c.name) + '" tabindex="0">' + esc(c.name) + '</strong>';
    return h + '</div><div class="comp-body" id="cb-' + id + '"' + (shut ? ' hidden' : '') + '>';
  }
  function fmt(f, v) {
    if (typeof v !== 'number') return '';
    var d = f.step < 0.1 ? 2 : f.step < 1 ? 1 : 0;
    return Number(v).toFixed(d);
  }
  function numberField(f, p, v) {
    if (typeof v !== 'number') v = typeof p[f.key] === 'number' ? p[f.key] : f.min;
    return '<div class="irow num"><label for="r-' + f.key + '" data-tip="' + esc(f.tip || f.label) + '">' + esc(f.label) + '</label>'
      + '<div class="rng"><input id="r-' + f.key + '" type="range" data-key="r:' + f.key + '" data-slide="' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + v + '" aria-valuetext="' + fmt(f, v) + (f.unit || '') + '">'
      + '<input type="number" class="nbox" id="n-' + f.key + '" data-key="n:' + f.key + '" data-num="' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + fmt(f, v) + '" aria-label="' + esc(f.label) + ', exact value"></div></div>';
  }
  /* A setting that is on or off, inside a component (Is Trigger): Unity's checkbox with its label. */
  function boolField(f, p) {
    return '<div class="irow"><button type="button" class="cbox inline" role="checkbox" data-set="' + f.key + '" data-key="c:' + f.key + '" aria-checked="' + !!p[f.key] + '" data-tip="' + esc(f.tip || f.label) + '">'
      + '<i aria-hidden="true"><svg class="i"><use href="#i-check"/></svg></i><strong>' + esc(f.label) + '</strong></button></div>';
  }
  /* An asset as the Project window and the object fields show it: the game's own picture of it for a
     sprite (runner.js, thumbnails), the sound icon for a sound. */
  function assetFace(kind, key) {
    if (kind === 'sprite') {
      var u = Runner.thumb(key);
      return u ? '<img alt="" src="' + u + '">' : '<svg class="i" aria-hidden="true"><use href="#i-image"/></svg>';
    }
    return '<svg class="i" aria-hidden="true"><use href="#i-music"/></svg>';
  }
  function assetName(kind, key) { var t = kind === 'sprite' ? Schema.SPRITES[key] : Schema.SOUNDS[key]; return t ? t[0] : key; }
  function objectField(f, p) {
    var v = p[f.key], kind = f.type, what = kind === 'sprite' ? 'Sprite' : 'AudioClip';
    return '<div class="irow wide"><span class="lbl" data-tip="' + esc(f.tip || f.label) + '" tabindex="0">' + esc(f.label) + '</span>'
      + '<div class="ofield' + (v ? '' : ' none') + '" data-slot="' + f.key + '" data-kind="' + kind + '" data-of="' + (f.of || '') + '">'
      + '<button type="button" class="oslot" data-key="slot:' + f.key + '" data-open="' + f.key + '" aria-label="' + esc(f.label) + ': ' + (v ? esc(assetName(kind, v)) : 'None') + '. Pick one">'
      + (v ? assetFace(kind, v) + '<span>' + esc(assetName(kind, v)) + '</span>' : '<span>None (' + what + ')</span>') + '</button>'
      + '<button type="button" class="opick" data-key="pick:' + f.key + '" data-open="' + f.key + '" aria-label="Pick a ' + what.toLowerCase() + '" data-tip="Pick from your Project"><svg class="i" aria-hidden="true"><use href="#i-pick"/></svg></button>'
      + '</div></div>';
  }
  function colorField(f, p) {
    var v = p[f.key];
    return '<div class="irow wide"><span class="lbl" data-tip="' + esc(f.tip || f.label) + '" tabindex="0">' + esc(f.label) + '</span>'
      + '<button type="button" class="cfield' + (v ? '' : ' none') + '" data-key="color:' + f.key + '" data-color="' + f.key + '" aria-label="' + esc(f.label) + ': ' + (v || 'none') + '. Pick a colour">'
      + '<i style="background:' + (v || 'transparent') + '"></i><span>' + (v ? v.toUpperCase() : 'None') + '</span></button></div>';
  }
  /* A `place` field is where a thing is (schema.js): of the one picked (i), or of the whole part. A
     floor's Width belongs to one block, so a floor's own row, standing for three, leaves it out. */
  function fields(c, p, i) {
    return (c.fields || []).map(function (f) {
      if (f.place) {
        if (f.one && i < 0 && Schema.many(p)) return '';
        var at = Schema.where(p, i);
        return at && typeof at[f.key] === 'number' ? numberField(f, p, at[f.key]) : '';
      }
      if (f.type === 'number') return numberField(f, p);
      if (f.type === 'sprite' || f.type === 'sound') return objectField(f, p);
      if (f.type === 'color') return colorField(f, p);
      if (f.type === 'bool') return boolField(f, p);
      return '';
    }).join('');
  }
  /* A part the Builder added, of a kind schema.js doesn't know: its plain settings, as Unity shows a
     script's public fields. */
  function generic(p) {
    var r = Schema.rules(p), keys = Object.keys(r);
    if (!keys.length) return '';
    var c = { name: 'Properties', icon: 'i-script', tip: 'The settings the Builder gave this part' };
    return header(c, p) + keys.map(function (k) {
      if (r[k].type === 'bool') return '<div class="irow"><button type="button" class="cbox inline" role="checkbox" data-set="' + k + '" data-key="c:' + k + '" aria-checked="' + !!p[k] + '"><i aria-hidden="true"><svg class="i"><use href="#i-check"/></svg></i><strong>' + esc(k) + '</strong></button></div>';
      var span = Math.max(1, Math.abs(p[k]) * 4);
      return numberField({ key: k, label: k, min: Math.max(r[k].min, Math.min(0, p[k] - span)), max: Math.min(r[k].max, p[k] + span), step: Number.isInteger(p[k]) ? 1 : 0.1 }, p);
    }).join('') + '</div>';
  }
  /* The top of every Inspector: the part's icon, its name, and what it is, as Unity's has. */
  var KIND_WORDS = { level: 'Level · holds every part', player: 'Game Object · Player', floor: 'Game Object · Floor', lava: 'Game Object · Hazard', coin: 'Game Object · Pickups' };
  function objectHeader(p, i) {
    var many = Schema.many(p), n = many ? Schema.things(p).length : 0;
    var name = i >= 0 ? Schema.childName(p, i) : p.name;
    var what = i >= 0 ? 'Game Object · one of the ' + p.name
      : many ? 'Prefab · ' + n + ' inside, each in the Hierarchy' : KIND_WORDS[p.kind] || 'Game Object · Built by the Builder';
    return '<div class="ohead"><svg class="i" aria-hidden="true"><use href="#' + (p.kind === 'level' ? 'i-layout' : many && i < 0 ? 'i-folder' : 'i-cube') + '"/></svg>'
      + '<p><input class="oname" data-key="oname" value="' + esc(name) + '" maxlength="32" spellcheck="false" aria-label="Name" data-tip="Its name. Type a new one to rename it"><small>' + esc(what) + '</small></p></div>'
      // a prefab's one rule, said where it bites: the rest is shared
      + (i >= 0 ? '<p class="inote shared">Its Position is its own. Everything else is shared: change it here and every ' + esc(p.kind === 'coin' ? 'coin' : p.name) + ' changes.</p>'
        : many ? '<p class="inote shared">Moving it moves all ' + n + '. Pick one of them to move just that one.</p>' : '');
  }
  function body(p, i) {
    var h = objectHeader(p, i), comps = Schema.components(p.kind);
    comps.forEach(function (c) { var f = fields(c, p, i); h += header(c, p, c.gate && !allowed[c.gate], !f.trim()) + f + '</div>'; });
    if (!comps.length) h += generic(p) || '<p class="inote">Nothing on ' + esc(p.name) + ' to change yet.</p>';
    return h;
  }

  /* `id` is a part, or one of its things ("coins#2"). The story hears the part: a coin picked is
     the Coins picked, since what the quest is after (the Clip) is shared by them all. */
  function select(id) {
    selected = selected === id ? null : id;
    var r = refOf(id);
    if (selected) { cueDone(r.id); if (r.i >= 0) unfolded[r.id] = true; if ((Project.part(r.id) || {}).kind !== 'level') levelShut = false; }
    tree();
    if (selected) inspect(selected); else closeInspector();
    emit('select', r.id);
  }
  function openInspector() {
    var el = $('inspector');
    if (!el.classList.contains('open')) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); el.inert = false; }
  }
  /* False when there is nothing by that id any more (the Builder took it away). */
  function inspect(id) {
    var r = refOf(id), p = Project.part(r.id);
    if (!p || (r.i >= 0 && !(Schema.many(p) && Schema.things(p)[r.i]))) return false;
    selected = id;
    closePicker();
    UI.keepFocus($('inspector'), function () {
      $('inspBody').innerHTML = body(p, r.i);
      wire(p, r.i);
    });
    paintCue();
    glow();
    openInspector();
    return true;
  }
  /* Moving thing i of a part (or all of it, i < 0) to `to`, { x, y, w }: the one way a position
     changes, from the Inspector or a drag in the Scene view (schema.js, moveTo). */
  function place(sel, to, quiet, replay) {
    var r = refOf(sel), p = Project.part(r.id); if (!p) return;
    Schema.moveTo(p, r.i, to).forEach(function (kv) { set(p.id, kv[0], kv[1], quiet, replay); });
  }
  /* Window › Inspector with nothing picked: Unity's empty Inspector, saying what to do. */
  function inspectNothing() {
    $('inspBody').innerHTML = '<p class="inote">Nothing picked. Tap a part in the Hierarchy to see its components here.</p>';
    openInspector();
  }
  function closeInspector() {
    var el = $('inspector');
    closePicker();
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
    selected = null; tree();
    emit('deselect');   // nothing is picked now (the Scene view drops its outline)
  }
  function fieldOf(p, key) {
    var out = null;
    Schema.components(p.kind).forEach(function (c) { (c.fields || []).forEach(function (f) { if (f.key === key) out = f; }); });
    if (!out && Schema.rules(p)[key]) out = Schema.rules(p)[key];
    return out;
  }
  function wire(p, i) {
    var box = $('inspBody'), sel = selected;
    function each(sel, fn) { Array.prototype.forEach.call(box.querySelectorAll(sel), fn); }
    // a number: a place (where a thing is, schema.js) or the part's own setting
    function put(f, k, v) { if (f.place) { var to = {}; to[k] = v; place(sel, to, true); } else set(p.id, k, v, true); }
    function now(f, k) { return f.place ? (Schema.where(p, i) || {})[k] : p[k]; }
    var nm = box.querySelector('.oname');
    if (nm) {
      nm.addEventListener('change', function () { rename(sel, nm.value); });
      nm.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); nm.blur(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nm.value = nameOf(sel); nm.blur(); }
      });
    }
    each('[data-set]', function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-set'); set(p.id, k, !p[k]); }); });
    each('[data-fold]', function (b) { b.addEventListener('click', function () { var n = b.getAttribute('data-fold'); folded[n] = b.getAttribute('aria-expanded') === 'true'; inspect(sel); }); });
    each('[data-slide]', function (r) {
      r.addEventListener('input', function () {
        var k = r.getAttribute('data-slide'), f = fieldOf(p, k), v = parseFloat(r.value), n = $('n-' + k);
        if (n) n.value = fmt(f, v);
        r.setAttribute('aria-valuetext', fmt(f, v) + (f.unit || ''));
        put(f, k, v);
      });
    });
    each('[data-num]', function (n) {
      n.addEventListener('change', function () {
        var k = n.getAttribute('data-num'), f = fieldOf(p, k), v = parseFloat(n.value);
        if (!isFinite(v)) { n.value = fmt(f, now(f, k)); return; }
        v = Math.max(f.min, Math.min(f.max, v));
        n.value = fmt(f, v); var r = $('r-' + k); if (r) r.value = v;
        put(f, k, v);
      });
    });
    each('[data-open]', function (b) {
      b.addEventListener('click', function () {
        var slot = b.closest('.ofield'), k = slot.getAttribute('data-slot');
        if (held && fits(slot, held)) { set(p.id, k, held.key); drop(); return; }   // tap-to-slot
        picker(b, p, fieldOf(p, k), slot.getAttribute('data-kind'));
      });
    });
    each('[data-color]', function (b) { b.addEventListener('click', function () { palette(b, p, b.getAttribute('data-color')); }); });
    // an asset dragged in from the Project window
    each('.ofield', function (slot) {
      slot.addEventListener('dragover', function (e) { if (dragging && fits(slot, dragging)) { e.preventDefault(); slot.classList.add('over'); } });
      slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
      slot.addEventListener('drop', function (e) {
        slot.classList.remove('over');
        if (!dragging || !fits(slot, dragging)) return;
        e.preventDefault(); set(p.id, slot.getAttribute('data-slot'), dragging.key); dragging = null; drop();
      });
    });
  }

  /* ---------- the picker: Unity's object picker, as a popover under the field ---------- */
  var pickerEl = null;
  function closePicker(refocus) {
    if (!pickerEl) return;
    var from = pickerEl.from; pickerEl.remove(); pickerEl = null;
    if (refocus && from && document.body.contains(from)) from.focus();
  }
  function pop(anchor, cls, label) {
    closePicker();
    var el = document.createElement('div'); el.className = 'opicker ' + cls; el.setAttribute('role', 'listbox'); el.setAttribute('aria-label', label);
    el.from = anchor;
    el.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(el.querySelectorAll('button')), i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
    });
    anchor.closest('.irow').appendChild(el);
    pickerEl = el;
    float(el, anchor.closest('.ofield, .cfield') || anchor);
    return el;
  }
  /* The popover floats over the panels rather than inside the Inspector's scroll: at a Chromebook's
     768 pixels the Inspector can be 190 tall with the Chat under it, and a list drawn inside it showed
     two sprites and a clipped third. It opens below the field, or above it when there is more room
     there, and closes if the Inspector scrolls out from under it. */
  function float(el, field) {
    var r = field.getBoundingClientRect(), below = innerHeight - r.bottom - 8, above = r.top - 8;
    var up = below < 220 && above > below, room = Math.min(280, up ? above : below);
    el.style.position = 'fixed'; el.style.left = r.left + 'px'; el.style.width = r.width + 'px'; el.style.right = 'auto';
    el.style.maxHeight = room + 'px';
    if (up) { el.style.top = 'auto'; el.style.bottom = (innerHeight - r.top + 2) + 'px'; }
    else el.style.top = (r.bottom + 2) + 'px';
    setTimeout(function () { addEventListener('scroll', function onScroll(e) {
      if (el.contains(e.target)) return;   // scrolling the list itself is fine
      removeEventListener('scroll', onScroll, true); if (pickerEl === el) closePicker();
    }, true); }, 0);
  }
  function picker(anchor, p, f, kind) {
    var keys = kind === 'sprite' ? Schema.spritesFor(f.of) : Object.keys(Schema.SOUNDS);
    var el = pop(anchor, kind, 'Pick a ' + (kind === 'sprite' ? 'sprite' : 'sound'));
    [null].concat(keys).forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'popt'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(p[f.key] === k)); b.setAttribute('data-key', 'opt:' + (k || 'none'));
      b.innerHTML = k ? assetFace(kind, k) + '<span></span>' : '<span class="nonei" aria-hidden="true"></span><span></span>';
      b.lastChild.textContent = k ? assetName(kind, k) : 'None';
      b.addEventListener('click', function () { closePicker(); set(p.id, f.key, k); });
      if (kind === 'sound' && k) b.addEventListener('pointerenter', function () { previewSound(k); });
      el.appendChild(b);
    });
    var cur = el.querySelector('[aria-selected="true"]') || el.querySelector('button'); if (cur) cur.focus();
  }
  function palette(anchor, p, key) {
    var el = pop(anchor, 'colors', 'Pick a colour');
    [null].concat(Schema.COLORS).forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'popt sw'; b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(p[key] === c)); b.setAttribute('aria-label', c || 'No colour'); b.setAttribute('data-key', 'col:' + (c || 'none'));
      b.innerHTML = '<i style="background:' + (c || 'transparent') + '"' + (c ? '' : ' class="nonei"') + '></i>';
      b.addEventListener('click', function () { closePicker(); set(p.id, key, c); });
      el.appendChild(b);
    });
    var cur = el.querySelector('[aria-selected="true"]') || el.querySelector('button'); if (cur) cur.focus();
  }

  /* ---------- tap-to-slot and drag: an asset held from the Project window ---------- */
  var held = null, dragging = null;   // { kind: 'sprite'|'sound', key, of }
  function fits(slot, a) {
    if (slot.getAttribute('data-kind') !== a.kind) return false;
    return a.kind !== 'sprite' || Schema.fits(a.key, slot.getAttribute('data-of'));
  }
  function hold(a) {
    held = held && held.key === a.key ? null : a;
    glow(); paintProject();
    if (held) status((held.kind === 'sprite' ? 'Holding the ' : 'Holding ') + assetName(held.kind, held.key) + '. Tap a slot in the Inspector that fits it' + (selected ? '' : ', after tapping a part in the Hierarchy'));
    else status('Put it down');
  }
  function drop() { held = null; glow(); paintProject(); }
  function glow() {
    Array.prototype.forEach.call(document.querySelectorAll('#inspBody .ofield'), function (s) {
      s.classList.toggle('can-take', !!(held && fits(s, held)) || !!(dragging && fits(s, dragging)));
    });
    // while one is dragged, the Hierarchy rows it can go on (a sound: the Coins)
    Array.prototype.forEach.call(document.querySelectorAll('#tree [data-key^="part:"]'), function (b) {
      b.classList.toggle('can-take', !!dragging && takes(refOf(b.getAttribute('data-key').slice(5)).id));
    });
  }
  /* WHERE AN ASSET GOES ON A PART (spec D58): into its first slot of that kind that fits it, a sprite
     into its Sprite (or the level's Background), a sound into its Clip; null if it has none. The
     Inspector's slots, its Hierarchy row and the part in the Scene view all take a drop through
     this, so they never disagree about what fits. */
  function slotFor(p, a) {
    var out = null;
    Schema.components(p.kind).forEach(function (c) {
      (c.fields || []).forEach(function (f) { if (!out && f.type === a.kind && (a.kind !== 'sprite' || Schema.fits(a.key, f.of))) out = f.key; });
    });
    return out;
  }
  function takes(id) { var p = Project.part(id); return !!(dragging && p && slotFor(p, dragging)); }
  function give(id) {
    var p = Project.part(id), a = dragging, k = p && a && slotFor(p, a); if (!k) return false;
    dragging = null; glow();
    set(p.id, k, a.key);
    status('Put ' + assetName(a.kind, a.key) + ' on ' + p.name + '. Undo takes it off');
    return true;
  }

  /* The one way the kid changes a part. `quiet` leaves the Inspector alone (a slider mid-drag);
     `replay` is Undo or Redo putting a value back, which is not a new step. */
  function set(id, key, value, quiet, replay) {
    var p = Project.part(id); if (!p) return;
    var before = p[key];
    if (before === value) return;
    /* A Sprite or a Color, never both (Jay, Sept 30: "you can use a sprite/texture, and also color.
       It should be one or the other"): picking one clears the other, and Undo puts both back. */
    var other = { look: 'tint', tint: 'look' }[key], g = null;
    if (!replay && other && value && p.kind !== 'level' && p[other]) { g = Date.now() + Math.random(); record(id, other, p[other], null, false, g); p[other] = null; Runner.set(id, other, null); }
    if (!replay) record(id, key, before, value, quiet, g);
    p[key] = value;
    Runner.set(id, key, value);
    if (!Runner.isPlaying()) Project.save();
    if (key === 'sound' && value) previewSound(value);
    if (key === 'look' || key === 'shape') setTimeout(Runner.askThumbs, 600);   // the Project window shows the new picture
    // repaint the open Inspector, never opening one the kid didn't ask for; a thing that's gone (Undo of a Duplicate) leaves its part there
    if ((!quiet || replay) && selected && refOf(selected).id === id && !inspect(selected)) inspect(id);
    cueDone(id + '.' + key);
    tree();
    emit('set', { id: id, key: key, value: value });
  }

  /* Picking a sound plays it once, here in the studio: the kid caused it, so it may make a noise. */
  function previewSound(id) {
    if (UI.muted() || !Schema.SOUNDS[id]) return;
    try { var a = new Audio('/assets/' + Schema.SOUNDS[id][1]); a.volume = 0.5; a.play().catch(function () {}); } catch (e) {}
  }

  /* ---------- Undo and Redo ---------- */
  var undos = [], redos = [], playMark = 0;
  var WORD = { solid: 'Box Collider', hurts: 'Hazard', look: 'Sprite', sound: 'Clip', size: 'Scale', tint: 'Color', shape: 'hero', gravityScale: 'Gravity Scale', jump: 'Jump Force', w: 'Width',
               x: 'Position', y: 'Position', spots: 'Position', pieces: 'Position', name: 'name', names: 'name' };
  function record(id, key, before, after, quiet, g) {
    var last = undos[undos.length - 1], t = Date.now(), w = batch ? batch.word : null;
    if (batch) g = g || batch.g;
    // one slider drag is one step, not forty
    if (quiet && !g && last && last.id === id && last.key === key && t - last.t < 1200) { last.after = after; last.t = t; }
    else undos.push({ id: id, key: key, before: before, after: after, t: t, g: g || null, w: w });
    if (undos.length > 50) { undos.shift(); playMark = Math.max(0, playMark - 1); }
    redos = [];
   
  }
  function what(e) { if (e.w) return e.w; var p = Project.part(e.id); return (p ? p.name + ' ' : '') + (WORD[e.key] || e.key); }
  function canUndo() { return undos.length > (Runner.isPlaying() ? playMark : 0); }
  function canRedo() { return redos.length > 0; }
  function undo() {
    if (!canUndo()) return;
    var e = undos.pop(); redos.push(e);
    set(e.id, e.key, e.before, false, true);
    // a step made of two changes (a Sprite that cleared a Color) comes back whole
    while (e.g && canUndo() && undos[undos.length - 1].g === e.g) { var e2 = undos.pop(); redos.push(e2); set(e2.id, e2.key, e2.before, false, true); }
    status('Undid: ' + what(e));
  }
  function redo() {
    if (!canRedo()) return;
    var e = redos.pop(); undos.push(e);
    set(e.id, e.key, e.after, false, true);
    while (e.g && redos.length && redos[redos.length - 1].g === e.g) { var e2 = redos.pop(); undos.push(e2); set(e2.id, e2.key, e2.after, false, true); e = e2; }
    status('Redid: ' + what(e));
  }

  /* ---------- more of a thing, or fewer (spec D59) ----------
     Duplicate (Ctrl+D), Delete (the Delete key) and GameObject › Create, for coins, blocks of floor
     and lava. Each is one of a prefab's things (schema.js): a new one is one more in its part's list
     (spots or pieces) and Delete takes one out, so each is a change to one setting, and Undo has it
     for nothing. A name the kid gave one (`names`, kept by place in the list) moves with it, in the
     same step. What they don't do, on purpose:
       - A whole part (the Coins, the Player) is never deleted: the story points at the parts by id
         (quest.js), and a ticket whose part is gone could never be fixed. Its things can be, down to
         the last one, which stays: switching its Box Collider off makes it do nothing.
       - Duplicate needs one thing picked. On a prefab's own row it would mean copying all of them;
         Create adds one more, which is what a kid after "more coins" means. */
  var batch = null;   // { g, word }: the settings one Duplicate or Delete changes, undone as one step
  function together(word, fn) { batch = { g: Date.now() + Math.random(), word: word }; try { fn(); } finally { batch = null; } }
  function pick(sel) { if (selected !== sel) select(sel); else inspect(sel); }
  // the thing `sel` names in its part's list: { p, key, i, n }, i < 0 for a prefab's own row
  function thingOf(sel) {
    var r = refOf(sel), p = Project.part(r.id), key = Schema.listKey(p); if (!key) return null;
    var n = p[key].length;
    return { p: p, key: key, i: r.i >= 0 ? r.i : n === 1 ? 0 : -1, n: n };
  }
  function canDuplicate(sel) { var t = sel && thingOf(sel); return !!(t && t.i >= 0); }
  function canDelete(sel) { var t = sel && thingOf(sel); return !!(t && t.i >= 0 && t.n > 1); }
  function whyNot(sel, act) {
    var t = sel && thingOf(sel);
    if (!t) return act === 'Duplicate' ? 'Pick a coin, a block of floor or the lava first' : 'Pick a coin, a block of floor or some lava first';
    if (t.i < 0) return 'Pick one of the ' + t.p.name + ' first';
    return 'The last one stays. To have it do nothing, untick its Box Collider 2D';
  }
  function duplicate(sel) {
    if (!canDuplicate(sel)) return;
    var t = thingOf(sel), at = t.i + 1, list = t.p[t.key].slice(), word = 'Duplicate ' + Schema.childName(t.p, t.i);
    list.splice(at, 0, Schema.copyOf(t.p, t.i));
    together(word, function () {
      if (t.p.names && t.p.names.length > at) { var nm = t.p.names.slice(); nm.splice(at, 0, null); set(t.p.id, 'names', nm); }
      set(t.p.id, t.key, list);
    });
    pick(t.p.id + '#' + (at + 1));
    status('Made ' + Schema.childName(t.p, at) + ' beside it. Drag it in the Scene view to move it');
  }
  function remove(sel) {
    if (!canDelete(sel)) return;
    var t = thingOf(sel), list = t.p[t.key].slice(), gone = Schema.childName(t.p, t.i);
    list.splice(t.i, 1);
    together('Delete ' + gone, function () {
      if (t.p.names && t.p.names.length > t.i) { var nm = t.p.names.slice(); nm.splice(t.i, 1); set(t.p.id, 'names', nm); }
      set(t.p.id, t.key, list);
    });
    pick(list.length > 1 ? t.p.id + '#' + Math.min(t.i + 1, list.length) : t.p.id);
    status('Deleted ' + gone + '. Undo puts it back');
  }
  /* GameObject › Create: one more, in the open middle of the level, picked so it is outlined there. A
     platform joins the solid floor (the Ground), never the first day's tile. */
  var MAKE = [['coin', 'Coin', 'i-star', { x: 480, y: 288 }], ['floor', 'Platform', 'i-cube', { x: 416, y: 352, w: 128 }], ['lava', 'Lava', 'i-flag', { x: 416, w: 96 }]];
  function makeInto(kind) {
    var ps = Project.get().parts.filter(function (p) { return p.kind === kind && Schema.listKey(p); });
    return ps.filter(function (p) { return kind !== 'floor' || p.solid; })[0] || ps[0] || null;
  }
  function create(kind) {
    var m = MAKE.filter(function (x) { return x[0] === kind; })[0], p = makeInto(kind); if (!m || !p) return;
    var key = Schema.listKey(p), list = p[key].slice(), n = list.length, at = { x: m[3].x, y: 'y' in m[3] ? m[3].y : p.y, w: m[3].w };
    list.push(Schema.copyOf(p, n - 1, at));
    together('Create ' + m[1], function () { set(p.id, key, list); });
    pick(p.id + '#' + (n + 1));
    status('Added ' + Schema.childName(p, n) + ' to the ' + p.name + '. Drag it where you want it in the Scene view');
  }
  function createItems(only) {
    return MAKE.filter(function (m) { return (!only || m[0] === only) && makeInto(m[0]); }).map(function (m) {
      return { label: only ? 'Add a ' + m[1].toLowerCase() : m[1], icon: m[2], tip: 'One more ' + m[1].toLowerCase() + ', in the middle of the level', run: function () { create(m[0]); } };
    });
  }

  /* ---------- the right-click menu (spec D57) ----------
     Unity's context menu, on the five things that have one here: a Hierarchy row, a part in the Scene
     view, a tile in the Project window, a component's header, and a panel's tab. It opens on a
     right-click, a two-finger tap on a Chromebook's trackpad or a long press on a touch screen (the
     browser's contextmenu, all three), and on Shift+F10 or the menu key for whatever has focus. It is
     drawn by the menus' own popup(), so it works and looks as they do. Its rule is the menus' (spec
     §3.3): it holds what can be done to that thing right now, and every item in it is somewhere else
     too (a menu on the bar, a key, a button), so a kid who never right-clicks misses nothing.
     Anywhere else, and in anything typed into (the chat, the code, the doc, a name box), the browser
     keeps its own menu, with its spelling and paste. A right-click on a part picks it first, as in
     Unity, so the Inspector shows what the menu is about. */
  function q(v) { return window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"'); }
  function typingIn(t) { return !!(t.closest('input, textarea, [contenteditable=""], [contenteditable="true"], .CodeMirror')); }
  function objectItems(sel) {
    var p = Project.part(refOf(sel).id); if (!p) return [];
    var t = thingOf(sel), out = [{ label: 'Rename', icon: 'i-pen', keys: 'F2', tip: 'Give it a new name', run: function () { renameRow(sel); } }];
    if (t && t.i >= 0) out.push(
      { label: 'Duplicate', icon: 'i-copy', keys: 'Ctrl+D', run: function () { duplicate(sel); } },
      { label: 'Delete', icon: 'i-trash', keys: 'Del', disabled: !canDelete(sel), tip: canDelete(sel) ? '' : whyNot(sel, 'Delete'), run: function () { remove(sel); } });
    else if (t) out = out.concat(createItems(p.kind));
    else if (p.kind === 'level') out = out.concat([{ sep: true, label: 'Create' }], createItems());
    return out;
  }
  function assetItems(a) {
    var r = selected && refOf(selected), p = r && Project.part(r.id), k = p && slotFor(p, a), out = [];
    if (a.kind === 'sound') out.push({ label: 'Play it', icon: 'i-play', tip: 'Hear it once', run: function () { previewSound(a.key); } });
    if (k) out.push({ label: 'Use on ' + p.name, icon: a.kind === 'sound' ? 'i-music' : 'i-image', tip: 'Put it in ' + p.name + '’s slot, as dropping it there does', run: function () { set(p.id, k, a.key); } });
    out.push({ label: held && held.key === a.key ? 'Put it down' : 'Hold it', icon: 'i-pick', tip: 'Then tap a slot in the Inspector that fits it', run: function () { hold(a); } });
    return out;
  }
  function compItems(name) {
    var p = selected && Project.part(refOf(selected).id); if (!p) return [];
    var c = Schema.components(p.kind).filter(function (x) { return x.name === name; })[0]; if (!c) return [];
    var box = $('inspBody').querySelector('.comp[data-comp="' + q(name) + '"]'), fold = box && box.querySelector('[data-fold]'), out = [];
    if (c.toggle) out.push({ label: c.name, checked: !!p[c.toggle], tip: c.tip, run: function () { set(p.id, c.toggle, !p[c.toggle]); } });
    if (fold) { var open = fold.getAttribute('aria-expanded') === 'true'; out.push({ label: open ? 'Fold it' : 'Open it', icon: 'i-fold', run: function () { folded[c.name] = open; inspect(selected); } }); }
    if (/\(Script\)$/.test(c.name) && isOpen('dProject') && window.Views) out.push({ label: 'Edit Script', icon: 'i-script', tip: 'This script is part of game.js. Open it in the code editor', run: function () { Views.openCode(); } });
    return out;
  }
  function tabItems(tab) {
    var name = tab.getAttribute('data-of'), d = (name && $(PANELS[name])) || tab.closest('.dock'); if (!d) return [];
    var out = [];
    if (PANELS[d.getAttribute('data-panel')]) out.push({ label: d.classList.contains('min') ? 'Open it' : 'Minimize', icon: 'i-fold', run: function () { minimize(d); } });
    out.push({ label: d === maxed ? 'Put it back' : 'Make it big', icon: d === maxed ? 'i-shrink' : 'i-grow', keys: d === maxed ? 'Esc' : '', run: function () { unmin(d); maximize(d); } });
    if (isOpen('layoutTools')) out.push({ sep: true, label: 'Layouts' }, LAYOUT_ITEMS()[0]);
    return out;
  }
  /* What a right-click on `t` is about: its name, its items (built when it opens, from what is true
     then), and the element to open beside and give focus back to (found again after picking, which
     redraws the Hierarchy and the Scene view). Null: the browser's own menu. */
  function ctxFor(t) {
    if (!t || !t.closest || typingIn(t) || !$('editor').contains(t)) return null;
    var b = t.closest('#tree [data-key^="part:"]');
    if (b) {
      var key = b.getAttribute('data-key').slice(5);
      return { label: nameOf(key), items: function () { pick(key); return objectItems(key); }, el: function () { return $('tree').querySelector('[data-key="part:' + q(key) + '"]'); } };
    }
    if (t.closest('#sceneSvg')) {
      var g = t.closest('[data-part]');
      if (!g) return { label: 'Scene', items: function () { return [{ sep: true, label: 'Create' }].concat(createItems()); }, el: function () { return $('sceneSvg'); } };
      var id = g.getAttribute('data-part'), p = Project.part(id), hit = t.closest('[data-i]');
      var sel = p && Schema.many(p) ? id + '#' + ((hit ? +hit.getAttribute('data-i') : 0) + 1) : id;
      return { label: nameOf(sel), items: function () { pick(sel); return objectItems(sel); }, el: function () { return $('sceneSvg'); } };
    }
    if ((b = t.closest('#assetGrid .asset')) && b.ctx) { var a = b; return { label: a.textContent.trim(), items: a.ctx, el: function () { return document.body.contains(a) ? a : $('assetGrid'); } }; }
    if ((b = t.closest('#inspBody .comp[data-comp]'))) { var n = b.getAttribute('data-comp'); return { label: n, items: function () { return compItems(n); }, el: function () { return b; } }; }
    if ((b = t.closest('.tabs > .tab'))) { var tb = b; return { label: tb.textContent.trim(), items: function () { return tabItems(tb); }, el: function () { return tb; } }; }
    return null;
  }
  function openCtx(c, at, keyboard) {
    var items = c.items().filter(Boolean); if (!items.length) return false;
    var el = c.el(); if (!el) return false;
    if (!at) { var r = el.getBoundingClientRect(); at = { x: r.left + 12, y: r.bottom + 2 }; }
    at.label = c.label;
    popup(el, items, keyboard, false, at);
    return true;
  }

  /* ---------- Play, Pause, Stop, Step ---------- */
  function paintPlay() {
    var on = Runner.isPlaying(), paused = Runner.isPaused(), b = $('bPlay');
    b.classList.toggle('on', on && !paused); b.setAttribute('aria-pressed', String(on));
    b.setAttribute('data-tip', paused ? 'Play: carry on from where it paused' : on ? 'Playing. Stop ends the game' : 'Play: run your game (Ctrl+P)');
    $('bPause').disabled = !on; $('bPause').setAttribute('aria-pressed', String(paused)); $('bPause').classList.toggle('on', paused);
    $('bStop').disabled = !on;
    $('bStep').disabled = !paused;
    $('pausedTag').hidden = !paused;
    $('editor').classList.toggle('playmode', on);
    $('gamebody').classList.toggle('playing', on);
    status(paused ? 'Paused: press Step to move one frame, or Pause again to carry on'
      : on ? 'Play mode: changes you make now are undone when you press Stop' : 'Stopped');
    hint();
  }
  function togglePlay() {
    var st = Project.get();
    if (maxed && maxed.id !== 'dGame' && !Runner.isPlaying()) unmaximize();   // Play shows the game
    if (Runner.isPlaying()) {
      Runner.stop(st, UI.muted()); UI.sound('stop'); Project.save();
      undos.length = Math.min(undos.length, playMark); redos = [];   // Stop just undid those
      if (selected) inspect(selected); tree();
    } else { playMark = undos.length; Runner.play(st.parts, UI.muted()); UI.sound('play'); played = true; linger(LINGER); }
    if (cueing === 'play' || cueing === 'stop') cue(null);   // a part's cue outlives a test run
    paintPlay();
  }
  /* The buttons: Play starts (or carries on after Pause), Stop ends. Ctrl+P is Unity's toggle. */
  function play() { if (!Runner.isPlaying()) togglePlay(); else if (Runner.isPaused()) togglePause(); else Runner.focusGame(); }
  function stop() { if (Runner.isPlaying()) togglePlay(); }
  function togglePause() { if (!Runner.isPlaying()) return; Runner.pause(!Runner.isPaused()); paintPlay(); }
  function stepFrame() { Runner.step(); status('One frame on. Press Step again, or Pause to carry on'); }
  /* The quest's `cue`: the one thing to click next, pulsing (Jay, 2026-09-30: "how the play button
     has the highlight, the floor tile should also have the highlight"). It is
       - 'play' or 'stop': that button;
       - a part ('tile'): its row in the Hierarchy;
       - a part's setting ('tile.solid'): that control in the Inspector while the part is open there,
         and the part's row until it is, so the way to it is lit whatever the kid has open.
     A cue ends when it is done: the button pressed, the part picked, the setting changed. Anything
     falsy clears it. tree() and inspect() rebuild their rows, so both call paintCue after. */
  var cueing = null;
  function cue(which) {
    cueing = which === true ? 'play' : which || null; cuedAt = null;
    // a part pointed at is on screen: a folded level opens (tree(), levelShut)
    var p = cueing && Project.part(cueing.split('.')[0]);
    if (p && p.kind !== 'level' && levelShut) { levelShut = false; tree(); return; }
    paintCue();
  }
  function paintCue() {
    $('bPlay').classList.toggle('cue', cueing === 'play');
    $('bStop').classList.toggle('cue', cueing === 'stop');
    Array.prototype.forEach.call(document.querySelectorAll('#tree .cue, #inspBody .cue'), function (el) { el.classList.remove('cue'); });
    if (!cueing || cueing === 'play' || cueing === 'stop') return;
    var bits = cueing.split('.'), id = bits[0], key = bits[1], el = null;
    var on = selected && refOf(selected).id;
    if (key && on === id) {
      el = $('inspBody').querySelector('[data-key="c:' + key + '"], [data-key="slot:' + key + '"], [data-key="r:' + key + '"], [data-key="color:' + key + '"]');
      if (el) el = el.closest('.ofield') || (el.type === 'range' && el.closest('.irow')) || el;
    } else el = $('tree').querySelector('[data-key="part:' + id + '"]');
    if (!el) return;
    unmin(el);   // a place lit inside a minimized panel is opened, or it is no cue
    el.classList.add('cue');
    // a cue below the fold is no cue (the Clip slot sat under the chat in a short Inspector): the
    // first time a place is lit, it is scrolled into view; a repaint of the same place leaves it be
    var at = (key && on === id ? 'insp:' : 'tree:') + cueing;
    if (at !== cuedAt) { cuedAt = at; el.scrollIntoView({ block: 'nearest', behavior: UI.lessMotion() ? 'auto' : 'smooth' }); }
  }
  var cuedAt = null;
  /* What the kid just did ends the cue it answers. */
  function cueDone(what) { if (cueing && cueing === what) cue(null); }

  /* The game's keys, as keycaps in a strip at the bottom of the Game view (Jay, 2026-09-29: the keys
     were a line in the chat, "I'd rather that not be in the chat"). It is up before the first Play,
     and whenever the game is running without the keyboard; Play, or a click in the game, lets it
     stay LINGER more so it is seen, then it fades. Clicks go through it to the game (CSS
     pointer-events), so it never gets in the way. Help › Game keys brings it back for a moment.
     Play focuses the game, which is why the old rule (shown only while the game lacks the
     keyboard) hid it the instant it appeared. */
  var keysUntil = 0, played = false, LINGER = 2600;
  function hint() {
    var f = Runner.frame(), has = f && document.activeElement === f, on = Runner.isPlaying() && !Runner.isPaused();
    var show = Date.now() < keysUntil || (!played && !Runner.isPlaying()) || (on && !has);
    $('hintLead').hidden = !(on && !has);
    var el = $('hint');
    if (show) { el.hidden = false; el.classList.remove('gone'); }
    else if (!el.hidden) {   // fades, then hides (transitionend, init); at once when motion is off
      if (UI.lessMotion()) el.hidden = true; else el.classList.add('gone');
    }
  }
  function linger(ms) { keysUntil = Date.now() + ms; hint(); setTimeout(hint, ms + 50); }
  function showKeys() { linger(5000); }

  /* ---------- the pointer: a callout just above a panel's tab, pointing down at it ----------
     Off for now (Jay, 2026-09-29: "hide them by default, we may have use for them later"). The
     quests still say where to point (`point:`), so turning POINTERS back on brings every one back;
     ?pointers=1 on the URL shows them for a look. */
  var POINTERS = /[?&]pointers=1\b/.test(location.search);
  function point(text, target) {
    var el = $('pointer');
    if (!text || !POINTERS) { el.hidden = true; return; }
    if (maxed && !maxed.contains(target)) unmaximize();
    $('pointerText').textContent = text; el.hidden = false;
    var ed = $('editor').getBoundingClientRect(), r = target.getBoundingClientRect();
    el.style.left = Math.max(8, Math.round(r.left - ed.left)) + 'px';
    el.style.top = Math.max(8, Math.round(r.top - ed.top - el.offsetHeight - 10)) + 'px';
  }

  /* ---------- the Project window ---------- */
  /* Unity's: folders on the left, what's in the open one on the right (Jay, 2026-09-28: the Project
     window holds everything the game is made of, like Unity). Everything listed exists:
       Sprites  the pictures the game's code draws (thumbnails from the frame, runner.js)
       Sounds   the clips an Audio Source can play (tap to hear one)
       Scripts  the game's code, game.js, to read; tap a line to ask what it does
       Docs     the kid's Ideas (what they asked for that isn't built yet) and the design doc
     The cards they've learned were a folder here until Sept 30; they're in the profile now (D55),
     because this window holds what the game is made of, as Unity's does. A sprite or sound can be dragged onto an object field in the Inspector, or tapped to hold it
     and then a field tapped to take it (tap-to-slot, the Inspector's note). */
  var FOLDERS = [
    { id: 'sprites', name: 'Sprites', icon: 'i-image', path: 'Assets › Sprites' },
    { id: 'sounds', name: 'Sounds', icon: 'i-music', path: 'Assets › Sounds' },
    { id: 'scripts', name: 'Scripts', icon: 'i-script', path: 'Assets › Scripts' },
    { id: 'docs', name: 'Docs', icon: 'i-doc', path: 'Docs' }
  ];
  var folder = 'sprites', openDoc = null;
  function paintFolders() {
    var nav = $('pFolders');
    UI.keepFocus(nav, function () {
      nav.innerHTML = '';
      FOLDERS.forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'pfold'; b.id = 'pf-' + f.id; b.setAttribute('role', 'tab'); b.setAttribute('data-key', 'folder:' + f.id);
        b.setAttribute('aria-selected', String(folder === f.id)); b.setAttribute('aria-controls', 'pBody'); b.tabIndex = folder === f.id ? 0 : -1;
        b.innerHTML = '<svg class="i" aria-hidden="true"><use href="#' + (f.id === 'docs' ? f.icon : 'i-folder') + '"/></svg><span>' + f.name + '</span>';
        b.addEventListener('click', function () { openFolder(f.id); });
        nav.appendChild(b);
      });
    });
  }
  function openFolder(id) { folder = id; openDoc = null; paintProject(); }
  function folderKeys(e) {
    var d = { ArrowDown: 1, ArrowUp: -1 }[e.key]; if (!d) return;
    var i = FOLDERS.map(function (f) { return f.id; }).indexOf(folder), n = FOLDERS[(i + d + FOLDERS.length) % FOLDERS.length];
    e.preventDefault(); openFolder(n.id); $('pf-' + n.id).focus();
  }
  function tile(face, name, opts) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'asset' + (opts.cls ? ' ' + opts.cls : '');
    if (opts.key) b.setAttribute('data-key', opts.key);
    b.innerHTML = '<span class="face">' + face + '</span><span class="nm"></span>';
    b.querySelector('.nm').textContent = name;
    if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
    if (opts.tip) b.setAttribute('data-tip', opts.tip);
    if (opts.run) b.addEventListener('click', opts.run);
    if (opts.ctx) b.ctx = opts.ctx;   // its right-click menu (ctxFor)
    if (opts.drag) {
      b.draggable = true;
      b.addEventListener('dragstart', function (e) { dragging = opts.drag; try { e.dataTransfer.setData('text/plain', opts.drag.key); e.dataTransfer.effectAllowed = 'copy'; } catch (x) {} glow(); });
      b.addEventListener('dragend', function () { dragging = null; glow(); });
    }
    li.appendChild(b);
    return li;
  }
  function paintProject() {
    if (!$('assetGrid')) return;
    paintFolders();
    var f = FOLDERS.filter(function (x) { return x.id === folder; })[0];
    var grid = $('assetGrid'), crumbs = $('pCrumbs');
    $('pBody').setAttribute('aria-labelledby', 'pf-' + folder);
    UI.keepFocus($('pBody'), function () {
      grid.innerHTML = ''; grid.className = 'assets';
      crumbs.textContent = f.path + (openDoc ? ' › ' + openDoc : '');
      var old = $('pBody').querySelector('.pview'); if (old) old.remove();
      if (folder === 'sprites') Object.keys(Schema.SPRITES).forEach(function (k) {
        var a = { kind: 'sprite', key: k, of: Schema.SPRITES[k][1] };
        grid.appendChild(tile(assetFace('sprite', k), Schema.SPRITES[k][0], { key: 'asset:' + k, pressed: !!held && held.key === k, drag: a,
          tip: Schema.SPRITES[k][0] + ': drag it onto a part or a Sprite slot, or tap it, then tap the slot', run: function () { hold(a); }, ctx: function () { return assetItems(a); } }));
      });
      if (folder === 'sounds') Object.keys(Schema.SOUNDS).forEach(function (k) {
        var a = { kind: 'sound', key: k };
        grid.appendChild(tile(assetFace('sound', k), Schema.SOUNDS[k][0], { key: 'asset:' + k, pressed: !!held && held.key === k, drag: a,
          tip: Schema.SOUNDS[k][0] + ': tap to hear it and hold it, then tap a Clip slot', run: function () { previewSound(k); hold(a); }, ctx: function () { return assetItems(a); } }));
      });
      if (folder === 'scripts') {
        // game.js opens in the centre, in its own tab beside the Game view (views.js)
        grid.appendChild(tile('<svg class="i" aria-hidden="true"><use href="#i-script"/></svg>', 'game.js', { key: 'asset:game.js',
          tip: 'Your game’s code. Open it to read and change it', run: function () { Views.openCode(); }, ctx: function () { return [{ label: 'Open', icon: 'i-script', run: function () { Views.openCode(); } }]; } }));
      }
      if (folder === 'docs') {
        /* Before the first design round, the Ideas the kid has asked for; after it, the design doc,
           which opens in the centre (views.js) and keeps the ideas at its end. */
        if (window.Views && Views.docOn()) {
          grid.appendChild(tile('<svg class="i" aria-hidden="true"><use href="#i-doc"/></svg>', 'Design doc', { key: 'doc:Design doc',
            tip: 'Your game, written down. Open it to read and change it', run: function () { Views.openDoc(); }, ctx: function () { return [{ label: 'Open', icon: 'i-doc', run: function () { Views.openDoc(); } }]; } }));
        } else {
          if (openDoc) return doc(openDoc);
          grid.appendChild(tile('<svg class="i" aria-hidden="true"><use href="#i-bulb"/></svg>', 'Ideas', { key: 'doc:Ideas', run: function () { openDoc = 'Ideas'; paintProject(); } }));
        }
      }
    });
  }
  /* A doc, in place of the grid, with a way back. */
  function view(title) {
    var v = document.createElement('div'); v.className = 'pview';
    var back = document.createElement('button'); back.type = 'button'; back.className = 'tbtn quiet back'; back.setAttribute('data-key', 'back');
    back.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-undo"/></svg><span>Back</span>';
    back.addEventListener('click', function () { openDoc = null; paintProject(); });
    var h = document.createElement('h3'); h.textContent = title;
    v.appendChild(back); v.appendChild(h);
    $('pBody').appendChild(v);
    return v;
  }
  /* The Ideas, before the design doc arrives (the doc then lists them as "Ideas for later"). */
  function doc(name) {
    var v = view(name);
    var ul = document.createElement('ul'); ul.className = 'docl';
    var rows = Project.doc().ideas.slice().reverse();
    if (!rows.length) rows = ['Nothing yet. Anything you ask for that can’t be built right away is kept here.'];
    rows.forEach(function (r) { var li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
    v.appendChild(ul);
  }
  /* ---------- menus ---------- */
  /* Built each time one opens, from what is true right now, so an item never lies about whether it
     works. A menu with nothing in it yet isn't on the bar. */
  var PANEL_NAMES = { tickets: ['Tickets', 'i-ticket', 'dTickets'], hierarchy: ['Hierarchy', 'i-tree', 'dHier'], game: ['Game', 'i-pad', 'dGame'],
                      inspector: ['Inspector', 'i-sliders', 'inspector'], chat: ['Chat', 'i-chat', 'dMentor'], project: ['Project', 'i-folder', 'dProject'],
                      console: ['Log', 'i-list', 'dConsole'] };
  function MENUS() {
    var doneDay = window.Quest && Quest.doneFirstDay && Quest.doneFirstDay();
    return [
      /* File: the game as a file. Signing out is in the kid's own menu (the circle at the right). */
      { id: 'file', label: 'File', items: [
        { label: 'Save', icon: 'i-save', keys: 'Ctrl+S', tip: 'Your game saves by itself; this saves it right now', run: saveNow },
        window.Views && Views.docOn() && { label: 'Open design doc', icon: 'i-doc', tip: 'Your game, written down. The Builder builds what it says', run: function () { Views.openDoc(); } },
        isOpen('dProject') && window.Views && { label: 'Open game.js', icon: 'i-script', tip: 'Your game’s code, in the code editor', run: function () { Views.openCode(); } },
        doneDay && { sep: true },
        doneDay && { label: 'Clock out', icon: 'i-clapper', tip: 'End today’s shift. The Studio Director sums it up', run: function () { Quest.clockOut(); } }
      ] },
      /* Edit: Undo and Redo, which were buttons under the menus. Play is only on the bar: a menu
         that repeated it was the kind of doubling Jay pointed at (2026-09-29). */
      { id: 'edit', label: 'Edit', items: [
        isOpen('editTools') && { label: canUndo() ? 'Undo ' + what(undos[undos.length - 1]) : 'Undo', icon: 'i-undo', keys: 'Ctrl+Z', disabled: !canUndo(), run: undo },
        isOpen('editTools') && { label: canRedo() ? 'Redo ' + what(redos[redos.length - 1]) : 'Redo', icon: 'i-redo', keys: 'Ctrl+Y', disabled: !canRedo(), run: redo },
        // what the Hierarchy's right-click menu does to the part picked, as in Unity's Edit menu
        isOpen('dHier') && { sep: true },
        isOpen('dHier') && { label: canDuplicate(selected) ? 'Duplicate ' + nameOf(selected) : 'Duplicate', icon: 'i-copy', keys: 'Ctrl+D', disabled: !canDuplicate(selected), tip: canDuplicate(selected) ? '' : whyNot(selected, 'Duplicate'), run: function () { duplicate(selected); } },
        isOpen('dHier') && { label: canDelete(selected) ? 'Delete ' + nameOf(selected) : 'Delete', icon: 'i-trash', keys: 'Del', disabled: !canDelete(selected), tip: canDelete(selected) ? '' : whyNot(selected, 'Delete'), run: function () { remove(selected); } },
        isOpen('dHier') && { label: 'Rename', icon: 'i-pen', keys: 'F2', disabled: !selected, tip: selected ? '' : 'Pick a part first', run: function () { renameRow(selected); } }
      ] },
      /* GameObject: Unity's menu for making things. Create adds one more coin, platform or lava. */
      { id: 'gameobject', label: 'GameObject', items: isOpen('dHier') ? [{ sep: true, label: 'Create' }].concat(createItems()) : [] },
      { id: 'window', label: 'Window', items: Object.keys(PANEL_NAMES).filter(met).map(function (k) {
        var n = PANEL_NAMES[k];
        return { label: n[0], icon: n[1], checked: k === 'inspector' ? $('inspector').classList.contains('open') : true, run: function () { showPanel(k); } };
      }).concat(isOpen('layoutTools') ? [{ sep: true, label: 'Layouts' }].concat(LAYOUT_ITEMS()) : []) },
      { id: 'help', label: 'Help', items: [
        isOpen('dGame') && { label: 'Game keys', icon: 'i-keys', tip: 'Show the keys that move your hero', run: showKeys },
        { label: 'Keyboard shortcuts', icon: 'i-keys', tip: 'The keys that work anywhere in the studio', run: function () { var b = document.querySelector('.mtop[data-menu="help"]'); if (b) popup(b, KEYS_ITEMS(), true, true); } }
      ] }
    ].map(function (m) { m.items = m.items.filter(Boolean); return m; });
  }
  /* The studio's own keys: a menu that lists them (picking one does what it says). */
  function KEYS_ITEMS() {
    return [{ sep: true, label: 'Keyboard shortcuts' },
      isOpen('transport') && { label: 'Play or Stop', icon: 'i-play', keys: 'Ctrl+P', run: togglePlay },
      isOpen('transport') && { label: 'Pause', icon: 'i-pause', keys: 'Ctrl+Shift+P', disabled: !Runner.isPlaying(), run: togglePause },
      isOpen('stepTools') && { label: 'Step one frame', icon: 'i-step', keys: 'Ctrl+Alt+P', disabled: !Runner.isPaused(), run: stepFrame },
      isOpen('editTools') && { label: 'Undo', icon: 'i-undo', keys: 'Ctrl+Z', disabled: !canUndo(), run: undo },
      isOpen('editTools') && { label: 'Redo', icon: 'i-redo', keys: 'Ctrl+Y', disabled: !canRedo(), run: redo },
      isOpen('dHier') && { label: 'Duplicate', icon: 'i-copy', keys: 'Ctrl+D', disabled: !canDuplicate(selected), run: function () { duplicate(selected); } },
      isOpen('dHier') && { label: 'Delete', icon: 'i-trash', keys: 'Del', disabled: !canDelete(selected), run: function () { remove(selected); } },
      isOpen('dHier') && { label: 'Rename', icon: 'i-pen', keys: 'F2', disabled: !selected, run: function () { renameRow(selected); } },
      { label: 'Save', icon: 'i-save', keys: 'Ctrl+S', run: saveNow }].filter(Boolean);
  }
  /* ---------- the kid's profile: the circle at the right of the bar (spec D55, D56) ----------
     Who they are, what they've collected, their settings, and the way out (Jay, 2026-09-29: sign out
     was hidden in File). It was a menu until Sept 30; it is a panel now (role=dialog, not role=menu),
     because it holds a collection and switches as well as actions, and a menu's arrow keys would
     skip them. Tab moves through it, Escape or a tap outside closes it, and focus goes back to the
     circle. What it leaves out, on purpose: today's task (the chat's task card already shows it) and
     a cards count of its own (the collection says "5 of 15").
       CARDS  a row of small cards, every idea in the course, the ones not found yet as outlines. A
              tap opens the card big over the studio, and a tap on it turns it over (cardView).
       BADGES the firsts (quest.js BADGES), each with its tooltip: what earned it.
       SETTINGS a second page of the same panel (ui.js keeps them). */
  var meName = '', prof = null, news = { card: false, badge: false };
  /* Their picture: an animal or a bug (Jay, Oct 1), picked from their name so it is the same one on
     every Chromebook they sign in on, with nothing new to save. Emoji, because ChromeOS draws them
     all in colour from its own font and they cost no download on a filtered network. */
  var PETS = ['🦊', '🐸', '🐢', '🐝', '🐞', '🦉', '🐙', '🐌', '🐰', '🐧', '🦋', '🦎', '🐼', '🐨', '🦔', '🐳',
              '🐛', '🦀', '🐱', '🐶', '🦜', '🐹', '🐯', '🦕'];
  var mePet = PETS[0];
  function me(name) {
    meName = name || '';
    var h = 0, k = meName.toLowerCase();
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    mePet = PETS[h % PETS.length];
    $('mePic').textContent = mePet;
  }
  /* Something new to see in the profile: a dot on the circle until it's opened. */
  function newsFor(kind) { news[kind] = true; $('bMe').classList.add('news'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function ico(id) { return '<svg class="i" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function openProfile(focusFirst) {
    closeMenu(false); UI.hideTip();
    var b = $('bMe'), pop = el('div', 'profile'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Your profile');
    b.parentNode.appendChild(pop);
    prof = { pop: pop };
    b.setAttribute('aria-expanded', 'true'); b.classList.add('open'); b.classList.remove('news');
    paintProfile('home', focusFirst);
    pop.addEventListener('focusout', function (e) { if (prof && prof.pop === pop && e.relatedTarget && !pop.contains(e.relatedTarget) && !e.relatedTarget.closest('.cardview') && e.relatedTarget !== b) closeProfile(false); });
  }
  function closeProfile(refocus) {
    if (!prof) return;
    var p = prof; prof = null; p.pop.remove();
    $('bMe').setAttribute('aria-expanded', 'false'); $('bMe').classList.remove('open');
    if (refocus) $('bMe').focus();
  }
  function paintProfile(view, focusFirst) {
    var pop = prof.pop; pop.innerHTML = ''; pop.setAttribute('data-view', view);
    if (view === 'settings') paintSettings(pop); else paintHome(pop);
    var f = pop.querySelector(view === 'settings' ? '.pback' : 'button, [tabindex="0"]');
    if (f && (focusFirst || view === 'settings')) f.focus();
  }
  function paintHome(pop) {
    var pr = window.Quest && Quest.progress ? Quest.progress() : {}, col = window.Quest && Quest.collection ? Quest.collection() : { cards: [], badges: [] };
    var head = el('div', 'phead');
    head.innerHTML = '<span class="me big" aria-hidden="true"></span><p><b></b><span></span></p>';
    head.querySelector('.me').textContent = mePet;
    head.querySelector('b').textContent = meName || 'New developer';
    head.querySelector('p span').textContent = pr.game ? 'Making ' + pr.game : 'Intern at the studio';
    var st = el('p', 'pstats');
    st.innerHTML = '<span>' + ico('i-star') + '<b></b> </span><span>' + ico('i-ticket') + '<b></b> </span>';
    var sp = st.querySelectorAll('span');
    sp[0].querySelector('b').textContent = String(pr.stars || 0); sp[0].appendChild(document.createTextNode(pr.stars === 1 ? 'star' : 'stars'));
    sp[1].querySelector('b').textContent = (pr.fixed || 0) + (pr.tickets ? ' of ' + pr.tickets : ''); sp[1].appendChild(document.createTextNode('tickets fixed'));
    pop.appendChild(head); pop.appendChild(st);
    // the cards: earned ones open, the rest are outlines that say how many are still to find
    var earned = col.cards.filter(function (c) { return c.earned; });
    var cs = el('section', 'pset'); cs.setAttribute('aria-labelledby', 'pCards');
    cs.innerHTML = '<h3 id="pCards">Cards<small></small></h3><ul class="minis"></ul>';
    cs.querySelector('small').textContent = earned.length + ' of ' + col.cards.length;
    col.cards.forEach(function (c) {
      var li = el('li');
      if (c.earned) {
        var m = el('button', 'mini'); m.type = 'button'; m.setAttribute('data-family', c.family); m.setAttribute('data-key', 'card:' + c.id);
        m.setAttribute('aria-label', c.name + ' card'); m.setAttribute('data-tip', c.name);
        m.innerHTML = ico(c.icon);
        m.addEventListener('click', function () { cardView(earned, earned.indexOf(c), m); });
        li.appendChild(m);
      } else { var lk = el('span', 'mini locked'); lk.setAttribute('aria-hidden', 'true'); li.appendChild(lk); }
      cs.querySelector('ul').appendChild(li);
    });
    if (!earned.length) cs.appendChild(el('p', 'pnone', 'You get a card for each game idea you learn.'));
    pop.appendChild(cs);
    var got = col.badges.filter(function (x) { return x.earned; });
    var bs = el('section', 'pset'); bs.setAttribute('aria-labelledby', 'pBadges');
    bs.innerHTML = '<h3 id="pBadges">Badges<small></small></h3><ul class="badges"></ul>';
    bs.querySelector('small').textContent = got.length + ' of ' + col.badges.length;
    col.badges.forEach(function (x) {
      var li = el('li'), m = el('span', 'badge' + (x.earned ? '' : ' locked'));
      // a badge not earned yet still says how to earn it: that is the point of showing it
      m.tabIndex = 0; m.setAttribute('role', 'img');
      m.setAttribute('aria-label', x.name + (x.earned ? ': ' : ', not yet: ') + x.how);
      m.setAttribute('data-tip', x.earned ? x.name + ': ' + x.how : 'Not yet. ' + x.how);
      m.innerHTML = ico(x.earned ? x.icon : 'i-lock');
      li.appendChild(m); bs.querySelector('ul').appendChild(li);
    });
    pop.appendChild(bs);
    var acts = el('div', 'pacts');
    function act(label, icon, tip, run) {
      var a = el('button', 'pact'); a.type = 'button'; a.innerHTML = ico(icon) + '<span></span>'; a.querySelector('span').textContent = label;
      if (tip) a.setAttribute('data-tip', tip);
      a.addEventListener('click', run); acts.appendChild(a); return a;
    }
    act('Settings', 'i-gear', 'Sounds, motion, text size and tooltips', function () { paintProfile('settings'); }).classList.add('more');
    if (window.Quest && Quest.doneFirstDay && Quest.doneFirstDay())
      act('Clock out', 'i-clapper', 'End today’s shift. The Studio Director sums it up', function () { closeProfile(true); Quest.clockOut(); });
    act('Sign out', 'i-exit', 'Sign out of the studio. Your game stays saved in your account', function () { closeProfile(false); status('Saving, then signing out…'); Save.leave(function () { location.href = '/auth/logout'; }); });
    pop.appendChild(acts);
    news.card = news.badge = false;
  }
  /* Settings (ui.js 7): each a switch, and the text size two buttons. A change shows at once. */
  var SETTINGS = [
    ['game', 'Game sound', 'Your game’s music and sound effects when you press Play.'],
    ['sounds', 'Studio sounds', 'The studio’s little sounds when you do something, like earning a card.'],
    ['motion', 'Less motion', 'No pulses, shakes or card flips.', 'less', 'normal'],
    ['tips', 'Tooltips', 'The notes that pop up when you rest on a button.'],
    ['contrast', 'Higher contrast', 'Brighter grey words and edges.', 'more', 'normal']
  ];
  function paintSettings(pop) {
    var top = el('div', 'ptop');
    var back = el('button', 'pback'); back.type = 'button'; back.setAttribute('data-key', 'pback');
    back.innerHTML = ico('i-back') + '<span>Back</span>';
    back.addEventListener('click', function () { paintProfile('home', true); });
    top.appendChild(back); top.appendChild(el('h3', '', 'Settings'));
    pop.appendChild(top);
    var list = el('ul', 'psettings');
    SETTINGS.forEach(function (s) {
      // Game sound is ui.js's own mute (the interview page's Sound button shares it), not a setting
      var on = s[0] === 'game' ? !UI.muted() : s[3] ? UI.setting(s[0]) === s[3] : !!UI.setting(s[0]);
      var li = el('li'), sw = el('button', 'switch'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', String(on));
      sw.setAttribute('data-key', 'set:' + s[0]); sw.id = 'set-' + s[0]; sw.setAttribute('aria-describedby', 'set-' + s[0] + '-d');
      sw.innerHTML = '<span class="sl"></span><span class="knob" aria-hidden="true"></span>';
      sw.querySelector('.sl').textContent = s[1];
      sw.addEventListener('click', function () {
        var now = sw.getAttribute('aria-checked') !== 'true';
        if (s[0] === 'game') UI.setMuted(!now); else UI.set(s[0], s[3] ? (now ? s[3] : s[4]) : now);
        sw.setAttribute('aria-checked', String(now));
      });
      var d = el('p', 'sd', s[2]); d.id = 'set-' + s[0] + '-d';
      li.appendChild(sw); li.appendChild(d); list.appendChild(li);
    });
    // text size: two choices, one pressed
    var li = el('li', 'ptext'), lab = el('span', 'sl', 'Text size'); lab.id = 'set-text-l';
    var grp = el('div', 'seg'); grp.setAttribute('role', 'group'); grp.setAttribute('aria-labelledby', 'set-text-l');
    [['normal', 'Normal'], ['big', 'Big']].forEach(function (o) {
      var b = el('button', '', o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(UI.setting('text') === o[0])); b.setAttribute('data-key', 'set:text:' + o[0]);
      b.addEventListener('click', function () {
        UI.set('text', o[0]);
        Array.prototype.forEach.call(grp.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 0);   // the docks fit the window again (zoomed)
      });
      grp.appendChild(b);
    });
    li.appendChild(lab); li.appendChild(grp); list.appendChild(li);
    pop.appendChild(list);
  }

  /* ---------- a card, big (spec D55) ----------
     Over the studio, with the room dimmed: it's a moment of collecting, so it may interrupt. A tap on
     the card turns it over; ← and → go through the other cards they have; Escape, the ×, or a tap on
     the dim closes it and puts focus back on the small card it came from. */
  var cv = null;
  function cardFace(c, n, of) {
    var front = '<div class="cface front"><div class="art">' + ico(c.icon) + '</div><h3></h3><p class="line"></p>'
      + '<footer><span class="kind"></span><span class="num"></span></footer></div>';
    var rows = (c.where ? '<dt>Where you got it</dt><dd class="where"></dd>' : '')
      + (c.unity ? '<dt>In Unity</dt><dd class="unity"></dd>' : '') + (c.phaser ? '<dt>In Phaser</dt><dd class="phaser"><code></code></dd>' : '')
      + (c.seen ? '<dt>In a real game</dt><dd class="seen"></dd>' : '');
    var back = '<div class="cface back"><h3></h3><dl>' + rows + '</dl><span class="mark">' + ico(c.icon) + '</span><footer><span class="kind"></span></footer></div>';
    var w = el('div', 'tinner'); w.innerHTML = front + back;
    w.querySelectorAll('h3').forEach(function (h) { h.textContent = c.name; });
    w.querySelector('.line').textContent = c.text;
    w.querySelectorAll('.kind').forEach(function (k) { k.textContent = c.kind || ''; });
    w.querySelector('.num').textContent = n + ' of ' + of;
    if (c.where) w.querySelector('.where').textContent = c.where;
    if (c.unity) w.querySelector('.unity').textContent = c.unity;
    if (c.phaser) w.querySelector('.phaser code').textContent = c.phaser;
    if (c.seen) w.querySelector('.seen').textContent = c.seen;
    return w;
  }
  function cardView(list, i, from) {
    closeCard(false);
    var all = window.Quest && Quest.collection ? Quest.collection().cards : [];
    var box = el('div', 'cardview'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="dim"></div><div class="cvbody"><button type="button" class="tcard" aria-pressed="false"></button>'
      + '<p class="cvhint"></p><button type="button" class="x cvclose" aria-label="Close the card">' + ico('i-x') + '</button></div>';
    document.body.appendChild(box);
    cv = { box: box, list: list, i: i, from: from };
    function show() {
      var c = cv.list[cv.i], t = box.querySelector('.tcard');
      t.innerHTML = ''; t.setAttribute('data-family', c.family); t.setAttribute('aria-pressed', 'false');
      t.appendChild(cardFace(c, all.map(function (x) { return x.id; }).indexOf(c.id) + 1, all.length));
      t.setAttribute('aria-label', c.name + ' card. ' + c.text + ' Press to turn it over');
      box.setAttribute('aria-label', c.name + ' card');
      box.querySelector('.cvhint').textContent = 'Tap the card to turn it over' + (cv.list.length > 1 ? '. ← and → for your other cards' : '');
    }
    cv.show = show; show();
    var t = box.querySelector('.tcard');
    t.addEventListener('click', function () {
      var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on));
      var c = cv.list[cv.i];
      t.setAttribute('aria-label', on ? c.name + ', the back. ' + [c.where && 'Where you got it: ' + c.where, c.unity && 'In Unity: ' + c.unity, c.phaser && 'In Phaser: ' + c.phaser, c.seen && 'In a real game: ' + c.seen].filter(Boolean).join('. ') : c.name + ' card. ' + c.text + ' Press to turn it over');
    });
    box.querySelector('.dim').addEventListener('click', function () { closeCard(true); });
    box.querySelector('.cvclose').addEventListener('click', function () { closeCard(true); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCard(true); }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && cv.list.length > 1) { e.preventDefault(); cv.i = (cv.i + (e.key === 'ArrowRight' ? 1 : cv.list.length - 1)) % cv.list.length; show(); t.focus(); }
      if (e.key === 'Tab') {   // the two buttons, round and round: nothing behind the dim takes focus
        var f = [t, box.querySelector('.cvclose')], k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + 1) % 2].focus();
      }
    });
    requestAnimationFrame(function () { box.classList.add('in'); });
    t.focus();
  }
  function closeCard(refocus) {
    if (!cv) return;
    var c = cv; cv = null; c.box.remove();
    if (refocus && c.from && document.body.contains(c.from)) c.from.focus();
  }
  function LAYOUT_ITEMS() {
    return [{ label: 'Default', icon: 'i-layout', checked: layoutIs(DEFAULT), tip: 'Put every panel back where it started', run: function () { useLayout(DEFAULT); } },
            { label: 'Big game', icon: 'i-pad', checked: layoutIs(BIG), tip: 'Make the Game view as big as it goes', run: function () { useLayout(BIG); } }];
  }
  function met(k) {
    if (k === 'inspector') return isOpen('dHier');
    if (k === 'chat') return true;
    return isOpen(PANEL_NAMES[k][2]);
  }
  function saveNow() { Project.save(); try { Save.now(); } catch (e) {} status('Saved'); }

  var openMenu = null;   // { btn, pop, items }
  /* The bar itself changes only when a menu gains its first item (a panel arrived), so it is
     rebuilt from openDock() and reveal(), never while a menu is open, and keeps keyboard focus. */
  function paintBar() {
    if (openMenu) return;
    var ul = $('menus');
    UI.keepFocus(ul, function () { barItems(ul); });
  }
  function barItems(ul) {
    var had = ul.querySelector('.mtop[tabindex="0"]'), roving = had ? had.getAttribute('data-menu') : 'file';
    ul.innerHTML = '';
    MENUS().forEach(function (m) {
      if (!m.items.length) return;
      var li = document.createElement('li'); li.setAttribute('role', 'none'); li.className = 'menu-anchor';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mtop'; b.setAttribute('role', 'menuitem'); b.setAttribute('aria-haspopup', 'menu');
      b.setAttribute('aria-expanded', 'false'); b.setAttribute('data-menu', m.id); b.setAttribute('data-key', 'menu:' + m.id);
      b.textContent = m.label; b.tabIndex = m.id === roving ? 0 : -1;
      b.addEventListener('click', function () { if (openMenu && openMenu.btn === b) closeMenu(true); else showMenu(b, m.id); });
      b.addEventListener('pointerenter', function () { if (openMenu && openMenu.btn !== b && openMenu.bar) showMenu(b, m.id); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showMenu(b, m.id, true); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); barMove(b, e.key === 'ArrowRight' ? 1 : -1, false); }
      });
      li.appendChild(b); ul.appendChild(li);
    });
    if (!ul.querySelector('.mtop[tabindex="0"]') && ul.firstChild) ul.firstChild.firstChild.tabIndex = 0;
  }
  function barMove(from, dir, open) {
    var all = Array.prototype.slice.call($('menus').querySelectorAll('.mtop')), i = all.indexOf(from);
    var to = all[(i + dir + all.length) % all.length]; if (!to) return;
    all.forEach(function (x) { x.tabIndex = x === to ? 0 : -1; });
    if (open) showMenu(to, to.getAttribute('data-menu'), true); else to.focus();
  }
  function showMenu(btn, id, focusFirst) {
    var m = MENUS().filter(function (x) { return x.id === id; })[0]; if (!m) return;
    popup(btn, m.items, focusFirst, true);
  }
  /* `at` ({ x, y, label }): the right-click menu, opened at that point over everything rather than
     under a button on the bar. */
  function popup(btn, items, focusFirst, bar, at) {
    closeMenu(false);
    UI.hideTip();
    var pop = document.createElement('div'); pop.className = 'menupop' + (at ? ' ctx' : ''); pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', at ? at.label : btn.textContent.trim());
    items.forEach(function (it) {
      if (it.node) { pop.appendChild(it.node); return; }
      if (it.sep) { var s = document.createElement('div'); s.className = 'msep'; s.setAttribute('role', 'separator'); if (it.label) s.textContent = it.label; pop.appendChild(s); return; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'mitem';
      b.setAttribute('role', it.checked !== undefined ? 'menuitemcheckbox' : 'menuitem');
      if (it.checked !== undefined) b.setAttribute('aria-checked', String(!!it.checked));
      if (it.disabled) b.setAttribute('aria-disabled', 'true');
      if (it.tip) b.setAttribute('data-tip', it.tip);
      b.tabIndex = -1;
      b.innerHTML = '<span class="mk" aria-hidden="true">' + (it.checked ? '<svg class="i"><use href="#i-check"/></svg>' : '') + '</span>'
        + (it.icon ? '<svg class="i" aria-hidden="true"><use href="#' + it.icon + '"/></svg>' : '<span class="i"></span>')
        + '<span class="ml"></span>' + (it.keys ? '<kbd>' + it.keys + '</kbd>' : '');
      b.querySelector('.ml').textContent = it.label;
      b.addEventListener('click', function () { if (it.disabled) return; closeMenu(true); it.run(); });
      pop.appendChild(b);
    });
    pop.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(pop.querySelectorAll('.mitem')), i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1) + list.length) % list.length]; if (n) n.focus(); }
      if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      if (e.key === 'Tab') closeMenu(false);
      if (bar && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); barMove(btn, e.key === 'ArrowRight' ? 1 : -1, true); }
    });
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    if (at) {
      // at the pointer, turned back from the right and bottom edges so all of it shows
      document.body.appendChild(pop);
      var cr = pop.getBoundingClientRect();
      pop.style.left = Math.round(Math.max(8, Math.min(at.x, vw - cr.width - 8))) + 'px';
      pop.style.top = Math.round(at.y + cr.height > vh - 8 ? Math.max(8, at.y - cr.height) : at.y) + 'px';
      pop.tabIndex = -1;
    } else {
      btn.parentNode.appendChild(pop);
      btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
      // keep it on screen
      var r = pop.getBoundingClientRect();
      if (r.right > vw - 8) pop.style.left = Math.round(vw - 8 - r.right) + 'px';
    }
    openMenu = { btn: btn, pop: pop, bar: bar, ctx: !!at };
    var f = focusFirst && pop.querySelector('.mitem');
    if (f) f.focus(); else if (at) pop.focus({ preventScroll: true });   // the arrow keys work in it straight away
  }
  function closeMenu(refocus) {
    if (!openMenu) return;
    var m = openMenu; openMenu = null;
    m.pop.remove();
    if (!m.ctx) { m.btn.setAttribute('aria-expanded', 'false'); m.btn.classList.remove('open'); }
    if (refocus && document.body.contains(m.btn)) m.btn.focus({ preventScroll: true });
  }

  function showPanel(k) {
    if (k === 'inspector') { if (selected) inspect(selected); else inspectNothing(); }
    var d = $(PANEL_NAMES[k][2]); if (!d) return;
    unmin(d);   // behind another tab, or folded: shown
    UI.feel(d, 'good');
    var f = d.querySelector('button:not([disabled]):not([hidden]), input, [tabindex="0"]');
    if (f) f.focus({ preventScroll: false });
  }

  /* ---------- docks: where each panel sits, and how big ---------- */
  var AREAS = { left: 'aLeft', right: 'aRight', bottom: 'aBottom' };
  /* Tickets sit above the Hierarchy (a ticket is what the kid is working on; the Hierarchy is where),
     and the Log beside the Project window, as Unity's Console is. */
  var PANELS = { tickets: 'dTickets', hierarchy: 'dHier', inspector: 'inspector', chat: 'dMentor', project: 'dProject', console: 'dConsole' };
  /* The bottom row shows two rows of assets (Jay, Sept 30: "The project tab should be a lot taller",
     then his screenshot of the size he meant: two rows, the Project window and the Log half each).
     On a short screen sizes() gives way to the Game view (limits()). */
  /* TABBED TOGETHER (Jay, Sept 30: "the tabs could be side by side while one is active at a time, not
     in two separate dock points side by side"), as Unity's are. A place in an area (L.left, L.right,
     L.bottom) is named by its first panel, its lead; `L.tabs[lead]` lists every panel tabbed there, in
     tab order, and `L.front[lead]` the one showing. Size and folding belong to the place (grow and
     min are keyed by the lead). The panels behind wait in #dockStore, outside the areas, so an area's
     children are only the docks on show and the splitters between them, and every rule in studio.css
     about a dock and its neighbours still holds. Their tabs sit in the front one's tab row.
     By default the Tickets and the Log share a place beside the Project window (Jay: "Probably should
     have tickets be docked with log"): the board is what the kid works from, the Log a record they
     glance at, so one of them is enough on screen, and the Log's count says when it has news. The
     Hierarchy gets the left column to itself. */
  var DEFAULT = { left: ['hierarchy'], right: ['inspector', 'chat'], bottom: ['project', 'tickets'], tabs: { tickets: ['tickets', 'console'] }, front: {}, lw: 264, rw: 388, bh: 262, grow: { project: 1, tickets: 1 }, min: {} };
  var BIG = { left: ['hierarchy'], right: ['inspector', 'chat'], bottom: ['project', 'tickets'], tabs: { tickets: ['tickets', 'console'] }, front: {}, lw: 200, rw: 316, bh: 120, grow: { project: 3, tickets: 2 } };
  var LAYOUT_KEY = 'studio.layout.v5', L = null;   // v5: panels tabbed together
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function layoutIs(d) { return JSON.stringify(L) === JSON.stringify(d); }
  function loadLayout() {
    var s = null; try { s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) {}
    // only a layout that still names every panel exactly once; anything else is from an older studio
    var names = s && [].concat(s.left || [], s.right || [], s.bottom || []).reduce(function (all, n) { return all.concat((s.tabs && s.tabs[n]) || [n]); }, []).sort().join();
    L = names === Object.keys(PANELS).sort().join() ? s : copy(DEFAULT);
    L.grow = L.grow || {}; L.min = L.min || {}; L.tabs = L.tabs || {}; L.front = L.front || {};
  }
  var AREA_KEYS = ['left', 'right', 'bottom'];
  function slot(lead) { return (L.tabs && L.tabs[lead]) || [lead]; }
  function leadOf(name) { for (var k in L.tabs) if (L.tabs[k].indexOf(name) >= 0) return k; return name; }
  function shut(name) { return $(PANELS[name]).classList.contains('closed'); }
  // the one showing: the chosen one if the story has brought it out, else the first that is out
  function frontOf(lead) {
    var ms = slot(lead), out = ms.filter(function (n) { return !shut(n); }), f = L.front[lead];
    return out.indexOf(f) >= 0 ? f : out[0] || ms[0];
  }
  function shown(lead) { return $(PANELS[frontOf(lead)]); }
  // take a panel out of wherever it is; a place whose lead leaves is led by the next tab
  function detach(name) {
    var lead = leadOf(name), ms = slot(lead);
    if (ms.length < 2) { AREA_KEYS.forEach(function (a) { L[a] = L[a].filter(function (n) { return n !== name; }); }); delete L.min[name]; delete L.grow[name]; return; }
    var rest = ms.filter(function (n) { return n !== name; }), nl = rest[0], was = L.front[lead];
    delete L.tabs[lead]; delete L.front[lead];
    if (rest.length > 1) L.tabs[nl] = rest;
    if (was && was !== name) L.front[nl] = was;
    if (lead !== name) return;
    AREA_KEYS.forEach(function (a) { var i = L[a].indexOf(name); if (i >= 0) L[a][i] = nl; });
    if (L.grow[name]) L.grow[nl] = L.grow[name]; delete L.grow[name];
    if (L.min[name]) L.min[nl] = true; delete L.min[name];
  }
  function join(name, lead) {
    if (leadOf(name) !== lead) { detach(name); L.tabs[lead] = slot(lead).concat([name]); }
    setFront(lead, name);
  }
  // the first tab showing is the default, and says nothing (so Layout › Default still matches)
  function setFront(lead, name) { if (slot(lead)[0] === name) delete L.front[lead]; else L.front[lead] = name; }
  // a tab behind, picked (or the story opening or pointing into it): it comes to the front
  function bringFront(name) {
    var lead = leadOf(name); if (slot(lead).length < 2 || frontOf(lead) === name) return false;
    setFront(lead, name); saveLayout(); applyLayout();
    status(PANEL_NAMES[name][0] + ' is showing');
    return true;
  }
  // every panel's tab home to its own row, then a place's tabs into its front one's row
  function paintTabs() {
    Object.keys(PANELS).forEach(function (n) {
      var t = TAB[n], row = $(PANELS[n]).querySelector(':scope > .tabs'); if (!t || !row) return;
      row.insertBefore(t, row.firstChild);
      t.classList.remove('back', 'gone'); t.removeAttribute('tabindex'); t.removeAttribute('role'); t.removeAttribute('aria-selected');
      row.removeAttribute('role');
    });
    AREA_KEYS.forEach(function (a) {
      L[a].forEach(function (lead) {
        var ms = slot(lead); if (ms.length < 2) return;
        var f = frontOf(lead), row = $(PANELS[f]).querySelector(':scope > .tabs');
        row.setAttribute('role', 'tablist');
        ms.slice().reverse().forEach(function (n) {
          var t = TAB[n]; row.insertBefore(t, row.firstChild);
          t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(n === f));
          t.tabIndex = 0;   // the front one too: focus stays on the tab a kid just chose
          if (n !== f) t.classList.add('back');
          if (n !== f && shut(n)) t.classList.add('gone');   // not out yet: no tab for it
        });
      });
    });
  }
  var TAB = {};
  function saveLayout() { try { if (layoutIs(DEFAULT)) localStorage.removeItem(LAYOUT_KEY); else localStorage.setItem(LAYOUT_KEY, JSON.stringify(L)); } catch (e) {} }
  function useLayout(d) { L = copy(d); saveLayout(); applyLayout(); status(d === DEFAULT ? 'Panels are back where they started' : 'The game is as big as it goes'); }
  function applyLayout() {
    var store = $('dockStore');
    Object.keys(AREAS).forEach(function (a) {
      var area = $(AREAS[a]);
      Array.prototype.forEach.call(area.querySelectorAll(':scope > .split'), function (s) { s.remove(); });
      L[a].forEach(function (lead, i) {
        var f = frontOf(lead);
        if (i) area.appendChild(splitter('panels', a, i));
        slot(lead).forEach(function (name) {
          var d = $(PANELS[name]);
          (name === f ? area : store).appendChild(d);
          d.style.flex = L.grow[lead] ? L.grow[lead] + ' 1 0' : '';
          d.classList.toggle('min', !!L.min[lead]); paintMin(d);
        });
      });
      area.classList.toggle('empty', !L[a].length);
      if (!area.querySelector(':scope > .split.edge')) area.appendChild(splitter('edge', a));
    });
    paintTabs();
    sizes();
    requestAnimationFrame(function () { var lg = $('log'); lg.scrollTop = lg.scrollHeight; });
  }
  function sizes() {
    var ed = $('editor');
    ed.style.setProperty('--lw', (L.left.length ? L.lw : 0) + 'px');
    ed.style.setProperty('--rw', (L.right.length ? L.rw : 0) + 'px');
    // a bottom row whose open panels are all minimized is only as tall as their tabs
    var folded = L.bottom.length && L.bottom.every(function (n) { return L.min[n] || shown(n).classList.contains('closed'); }) && L.bottom.some(function (n) { return L.min[n]; });
    ed.style.setProperty('--bh', (!L.bottom.length ? 0 : folded ? 41 : ed.clientHeight ? clamp(L.bh, limits('bottom')) : L.bh) + 'px');
  }
  /* Minimized (Jay, Sept 30: "make tabs minimizeable"): a panel folds down to its tab row, and its
     room goes to the panels beside it. The button again, or a tap on its tab, opens it. Kept with
     the layout, wherever the kid has docked it. The story opening or pointing into a folded panel
     opens it first (unmin). */
  function paintMin(d) {
    var b = d.querySelector('.minb'); if (!b) return;
    var on = d.classList.contains('min'), n = panelName(d);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Open the ' + n : 'Minimize the ' + n);
    b.setAttribute('data-tip', on ? 'Open it' : 'Minimize');
  }
  function minimize(d, on) {
    var name = d.getAttribute('data-panel'); if (!L || !PANELS[name]) return;
    name = leadOf(name);   // a place folds with all its tabs
    if (on === undefined) on = !L.min[name];
    if (!!L.min[name] === on) return;
    if (on && d === maxed) unmaximize();
    if (on) L.min[name] = true; else delete L.min[name];
    slot(name).forEach(function (m) { var el = $(PANELS[m]); el.classList.toggle('min', on); paintMin(el); });
    saveLayout(); sizes();
    status(panelName(d) + (on ? ' minimized. Its tab opens it again' : ' is open'));
  }
  function unmin(el) {
    var d = el && el.closest && el.closest('.dock'); if (!d) return;
    if (d.parentNode && d.parentNode.id === 'dockStore') bringFront(d.getAttribute('data-panel'));   // behind another tab: to the front
    if (d.classList.contains('min')) minimize(d, false);
  }
  /* A splitter: `edge` sits on an area's inner edge and resizes the area; `panels` sits between two
     panels in one area and shares the room between them. Both work from the keyboard too (a
     separator with arrow keys), and neither is ever the only way to see anything. */
  function splitter(kind, area, at) {
    var s = document.createElement('div');
    s.className = 'split ' + kind + ' ' + area;
    s.setAttribute('role', 'separator'); s.tabIndex = 0;
    var across = (kind === 'edge') === (area !== 'bottom');   // a vertical line, dragged sideways
    s.setAttribute('aria-orientation', across ? 'vertical' : 'horizontal');
    s.setAttribute('aria-label', kind === 'edge' ? 'Resize the ' + area + ' panels' : 'Share the room between these panels');
    s.setAttribute('data-tip', 'Drag to resize');
    s.addEventListener('pointerdown', function (e) { if (e.button === 0) startResize(e, s, kind, area, at, across); });
    s.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]; if (!k) return;
      e.preventDefault(); nudge(kind, area, at, k * 24);
    });
    return s;
  }
  function limits(area) {
    var ed = $('editor').getBoundingClientRect();
    if (area === 'left') return [150, Math.max(150, ed.width - L.rw - 360)];
    if (area === 'right') return [260, Math.max(260, ed.width - (L.left.length ? L.lw : 0) - 360)];
    return [88, Math.max(88, ed.height - 86 - 26 - 220)];
  }
  function clamp(v, lim) { return Math.round(Math.max(lim[0], Math.min(lim[1], v))); }
  var SIZE = { left: 'lw', right: 'rw', bottom: 'bh' };
  function nudge(kind, area, at, px) {
    if (kind === 'edge') { var dir = area === 'left' ? 1 : -1; L[SIZE[area]] = clamp(L[SIZE[area]] + px * dir, limits(area)); sizes(); saveLayout(); return; }
    share(area, at, px);
    saveLayout();
  }
  /* Between two panels in an area: fix every panel's grow to its current size, then move `px` of
     room from one neighbour to the other. Grow with a zero basis is a proportion, so it survives
     the window being resized. */
  function share(area, at, px) {
    var names = L[area], vertical = area !== 'bottom';
    var sz = names.map(function (n) { var r = shown(n).getBoundingClientRect(); return vertical ? r.height : r.width; });
    var a = at - 1, b = at;
    while (a >= 0 && !sz[a]) a--;
    while (b < names.length && !sz[b]) b++;
    if (a < 0 || b >= names.length) return;
    var move = Math.max(-(sz[a] - 90), Math.min(sz[b] - 90, px));
    sz[a] += move; sz[b] -= move;
    names.forEach(function (n, i) { if (sz[i]) { L.grow[n] = Math.round(sz[i]); slot(n).forEach(function (m) { $(PANELS[m]).style.flex = L.grow[n] + ' 1 0'; }); } });
  }
  function startResize(e, s, kind, area, at, across) {
    e.preventDefault(); s.setPointerCapture(e.pointerId);
    var last = across ? e.clientX : e.clientY;
    document.body.classList.add(across ? 'resizing-x' : 'resizing-y'); s.classList.add('active');
    function move(ev) { var now = across ? ev.clientX : ev.clientY, d = now - last; if (!d) return; last = now; if (kind === 'edge') nudgeRaw(area, d); else share(area, at, d); }
    function up() {
      s.removeEventListener('pointermove', move); s.removeEventListener('pointerup', up); s.removeEventListener('pointercancel', up);
      document.body.classList.remove('resizing-x', 'resizing-y'); s.classList.remove('active'); saveLayout();
    }
    s.addEventListener('pointermove', move); s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
  }
  function nudgeRaw(area, d) { var dir = area === 'left' ? 1 : -1; L[SIZE[area]] = clamp(L[SIZE[area]] + d * dir, limits(area)); sizes(); }

  /* ---------- one panel made big (Jay, 2026-09-29: "the project tab should be expandable") ----------
     Every panel's tab row has a button that lays it over the editor, from the toolbar down to the
     status bar; the button again, a double-click on its tab, or Escape puts it back. Nothing in the
     layout moves (.dock.max is laid on top), so putting it back is exact. The Chat column stays
     showing beside a big panel when it is where it starts, on the right: the story talks there. What
     the story does next that needs the rest of the screen (a panel arriving, a pointer, Play from
     another panel) puts the big one back first. The panels under it are inert while it's up. */
  var maxed = null;
  function panelName(d) { return d.getAttribute('aria-label') || 'panel'; }
  function paintMax(d) {
    var b = d.querySelector('.maxb'); if (!b) return;
    var on = d === maxed, n = panelName(d);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Put the ' + n + ' back' : 'Make the ' + n + ' big');
    b.setAttribute('data-tip', on ? 'Put it back (Esc)' : 'Make it big (or double-click its tab)');
    b.querySelector('use').setAttribute('href', on ? '#i-shrink' : '#i-grow');
  }
  function cover(on) {
    Array.prototype.forEach.call($('editor').querySelectorAll('.dock, .split'), function (el) {
      if (el === maxed) return;
      if (on) { el.inert = true; return; }
      // worked out again, not remembered: the story may have opened a panel while this one was big
      el.inert = el.id === 'inspector' ? !el.classList.contains('open') : el.classList.contains('closed');
    });
  }
  function maximize(d) {
    var was = maxed; unmaximize();
    if (!d || was === d) return;
    maxed = d;
    var chat = $('dMentor'), side = !narrow() && d !== chat && L.right.indexOf(leadOf('chat')) >= 0 && L.right.indexOf(leadOf(d.getAttribute('data-panel'))) < 0 && frontOf(leadOf('chat')) === 'chat';
    d.classList.add('max'); d.classList.toggle('side', side);
    cover(true);
    if (side) Array.prototype.forEach.call($('aRight').querySelectorAll('.dock'), function (el) {   // the column left showing
      el.inert = el.id === 'inspector' ? !el.classList.contains('open') : el.classList.contains('closed');
    });
    paintMax(d);
    status(panelName(d) + ' is big now. Press Esc to put it back');
  }
  function unmaximize() {
    if (!maxed) return;
    var d = maxed; maxed = null;
    d.classList.remove('max', 'side'); cover(false); paintMax(d);
  }

  /* Dragging a panel by its tab into another area (or to another place in its own). The drop place
     shows as an orange line; Escape or dropping anywhere else puts it back. Not in the narrow,
     stacked layout, where there is only one column to be in. */
  var drag = null;
  function narrow() { return window.matchMedia && matchMedia('(max-width: 900px)').matches; }
  function tabDown(e) {
    var tab = e.target.closest('[data-drag]'); if (!tab || e.button !== 0 || narrow()) return;
    // a tab may sit in another panel's row (tabbed together): it drags its own panel
    var name = tab.getAttribute('data-of'), dock = name && $(PANELS[name]); if (!dock || dock.classList.contains('closed')) return;
    drag = { name: name, dock: dock, x: e.clientX, y: e.clientY, on: false, tab: tab, id: e.pointerId };
    tab.setPointerCapture(e.pointerId);
    tab.addEventListener('pointermove', tabMove); tab.addEventListener('pointerup', tabUp); tab.addEventListener('pointercancel', tabCancel);
  }
  function tabMove(e) {
    if (!drag) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
      drag.on = true; UI.hideTip(); point(null);
      $('editor').classList.add('dragging');
      drag.ghost = document.createElement('div'); drag.ghost.className = 'ghost'; drag.ghost.textContent = drag.tab.textContent.trim().split(/\s{2,}/)[0];
      document.body.appendChild(drag.ghost);
      drag.line = document.createElement('div'); drag.line.className = 'dropline'; drag.line.hidden = true; document.body.appendChild(drag.line);
      drag.dock.classList.add('lifted');
    }
    drag.ghost.style.left = e.clientX + 12 + 'px'; drag.ghost.style.top = e.clientY + 10 + 'px';
    drag.target = dropAt(e.clientX, e.clientY);
    var t = drag.target, ln = drag.line;
    if (!t) { ln.hidden = true; return; }
    ln.hidden = false; ln.classList.toggle('join', !!t.join);
    var r = t.rect;
    if (t.join) { ln.style.left = r.left + 'px'; ln.style.width = r.width + 'px'; ln.style.top = r.top + 'px'; ln.style.height = r.height + 'px'; return; }
    if (t.vertical) { ln.style.left = r.left + 'px'; ln.style.width = r.width + 'px'; ln.style.top = t.edge - 2 + 'px'; ln.style.height = '4px'; }
    else { ln.style.top = r.top + 'px'; ln.style.height = r.height + 'px'; ln.style.left = t.edge - 2 + 'px'; ln.style.width = '4px'; }
  }
  /* Which area the pointer is over, and where in it: before the first panel whose middle is past
     the pointer. An empty area opens as a drop strip while a drag is on (CSS, .dragging). */
  function dropAt(x, y) {
    /* Over a place's tab row: a tab there, beside the others. Not the Inspector's, which comes and
       goes with what is picked, and would take its tabs with it. */
    var into = null;
    if (drag.name !== 'inspector') AREA_KEYS.forEach(function (a) {
      L[a].forEach(function (lead) {
        var ms = slot(lead); if (ms.indexOf('inspector') >= 0 || (ms.length === 1 && lead === drag.name)) return;
        var d = shown(lead); if (d.classList.contains('closed')) return;
        var r = d.querySelector(':scope > .tabs').getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) into = { join: lead, rect: r };
      });
    });
    if (into) return into;
    var hit = null;
    Object.keys(AREAS).forEach(function (a) {
      var r = $(AREAS[a]).getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = { area: a, rect: r };
    });
    if (!hit) return null;
    // the dragged panel's own place stays if others are tabbed there (detach, in tabUp, keeps it)
    var vertical = hit.area !== 'bottom', names = L[hit.area].filter(function (n) { return !(n === drag.name && slot(n).length === 1); });
    var idx = names.length, edge = vertical ? hit.rect.bottom : hit.rect.right;
    for (var i = 0; i < names.length; i++) {
      var r = shown(names[i]).getBoundingClientRect(); if (!r.width || !r.height) continue;
      var mid = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
      if ((vertical ? y : x) < mid) { idx = i; edge = vertical ? r.top : r.left; break; }
    }
    if (!names.length) edge = vertical ? hit.rect.top + 2 : hit.rect.left + 2;
    return { area: hit.area, index: idx, vertical: vertical, rect: hit.rect, edge: edge };
  }
  function tabUp() {
    var d = drag; tabEnd();
    if (!d || !d.on || !d.target) return;
    if (d.target.join) {
      join(d.name, d.target.join); saveLayout(); applyLayout();
      status(PANEL_NAMES[d.name][0] + ' is a tab beside ' + PANEL_NAMES[slot(d.target.join)[0]][0] + ' now. Layout › Default puts it back');
      return;
    }
    detach(d.name);
    L[d.target.area].splice(d.target.index, 0, d.name);
    L.grow = {};   // a new arrangement shares its room evenly again
    saveLayout(); applyLayout();
    status(PANEL_NAMES[d.name][0] + ' moved. Layout › Default puts it back');
  }
  function tabCancel() { tabEnd(); }
  function tabEnd() {
    if (!drag) return;
    var t = drag.tab;
    t.removeEventListener('pointermove', tabMove); t.removeEventListener('pointerup', tabUp); t.removeEventListener('pointercancel', tabCancel);
    if (drag.ghost) drag.ghost.remove(); if (drag.line) drag.line.remove();
    drag.dock.classList.remove('lifted');
    $('editor').classList.remove('dragging');
    drag = null;
  }

  /* ---------- keys: Unity's own, where the browser allows them ---------- */
  function keys(e) {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {   // the right-click menu, from the keyboard
      var c = ctxFor(document.activeElement);
      if (c && openCtx(c, null, true)) e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && drag) { tabEnd(); return; }
    if (e.key === 'Escape' && openMenu) { closeMenu(true); return; }
    if (e.key === 'Escape' && cv) { closeCard(true); return; }
    if (e.key === 'Escape' && prof) { if (prof.pop.getAttribute('data-view') === 'settings') paintProfile('home', true); else closeProfile(true); return; }
    if (e.key === 'Escape' && pickerEl) { closePicker(true); return; }
    if (e.key === 'Escape' && held) { drop(); status('Put it down'); return; }
    if (e.key === 'Escape' && maxed) { var m = maxed; unmaximize(); var mb = m.querySelector('.maxb'); if (mb) mb.focus(); return; }
    if (e.key === 'Escape' && $('inspector').classList.contains('open')) { closeInspector(); return; }
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    // Unity's keys for the part picked; a row's own F2 got there first (defaultPrevented)
    if (!typing && !openMenu && !e.defaultPrevented && isOpen('dHier') && !e.ctrlKey && !e.metaKey) {   // Alt too: a Chromebook's Delete is Alt+Backspace
      if (e.key === 'Delete' && canDelete(selected)) { e.preventDefault(); remove(selected); return; }
      if (e.key === 'F2' && selected) { e.preventDefault(); renameRow(selected); return; }
    }
    if (!(e.ctrlKey || e.metaKey) || typing) return;
    var k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveNow(); }
    if (k === 'd' && !e.shiftKey && isOpen('dHier')) { e.preventDefault(); duplicate(selected); }   // the browser's bookmark key, kept for Unity's
    if (k === 'z' && !e.shiftKey && isOpen('editTools')) { e.preventDefault(); undo(); }
    if ((k === 'y' || (k === 'z' && e.shiftKey)) && isOpen('editTools')) { e.preventDefault(); redo(); }
    if (k === 'p' && isOpen('transport')) {
      e.preventDefault();
      if (e.altKey) { if (isOpen('stepTools')) stepFrame(); }
      else if (e.shiftKey) togglePause();
      else togglePlay();
    }
  }

  function init() {
    paintBar();
    $('bPlay').addEventListener('click', play);
    $('bStop').addEventListener('click', stop);
    $('bPause').addEventListener('click', togglePause);
    $('bStep').addEventListener('click', stepFrame);
    $('bMe').addEventListener('click', function (e) { if (prof) closeProfile(true); else openProfile(e.detail === 0); });   // detail 0: Enter or Space, so focus goes in
    $('inspClose').addEventListener('click', function () { closeInspector(); });
    Object.keys(PANELS).forEach(function (name) {
      var t = $(PANELS[name]).querySelector(':scope > .tabs > .tab[data-drag]'); if (!t) return;
      TAB[name] = t; t.setAttribute('data-of', name);
      t.addEventListener('click', function (e) { if (t.classList.contains('back')) { e.stopPropagation(); bringFront(name); unmin($(PANELS[name])); t.focus(); } });
      t.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && t.classList.contains('back')) { e.preventDefault(); bringFront(name); } });
    });
    loadLayout(); applyLayout();   // after the tabs are known and the store is there
    Array.prototype.forEach.call($('editor').querySelectorAll('.dock'), function (d) {
      var row = d.querySelector(':scope > .tabs'); if (!row) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'x maxb';
      b.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-grow"/></svg>';
      b.addEventListener('click', function () { unmin(d); maximize(d); });
      // every docked panel folds; the Game view in the middle doesn't (there'd be nothing left)
      if (PANELS[d.getAttribute('data-panel')]) {
        var m = document.createElement('button'); m.type = 'button'; m.className = 'x minb';
        m.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-fold"/></svg>';   // a chevron that points where the panel goes (studio.css, .minb)
        m.addEventListener('click', function () { minimize(d); });
        row.insertBefore(m, row.querySelector(':scope > .x'));
      }
      row.insertBefore(b, row.querySelector(':scope > .x:not(.minb)'));   // minimize, big, then close
      row.addEventListener('dblclick', function (e) { if (e.target.closest('.tab')) { unmin(d); maximize(d); } });
      // a tap anywhere on a folded panel's strip opens it (a drag still moves it: tabUp only runs a real drag)
      row.addEventListener('click', function (e) { if (d.classList.contains('min') && !e.target.closest('.x')) minimize(d, false); });
      paintMax(d); paintMin(d);
    });
    $('pFolders').addEventListener('keydown', folderKeys);
    paintProject();
    Runner.on(function (name) { if (name === 'thumbs') { paintProject(); if (selected) inspect(selected); } });
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', function (e) {
      if (openMenu && !openMenu.pop.contains(e.target) && e.target !== openMenu.btn) closeMenu(false);
      if (pickerEl && !pickerEl.contains(e.target) && !pickerEl.from.contains(e.target)) closePicker(false);
      if (prof && !cv && !prof.pop.contains(e.target) && !$('bMe').contains(e.target)) closeProfile(false);
    });
    $('editor').addEventListener('pointerdown', tabDown);
    document.addEventListener('contextmenu', function (e) {
      var c = ctxFor(e.target); if (!c) return;   // the browser's own menu
      e.preventDefault();
      // a contextmenu with no pointer at all is the keyboard's (some browsers send one for Shift+F10)
      openCtx(c, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null, !e.clientX && !e.clientY);
    });
    $('gamebody').addEventListener('pointerdown', function () { Runner.focusGame(); });
    // a click into the game frame blurs the page; the keys stay a moment longer, then go
    window.addEventListener('blur', function () { if (openMenu) closeMenu(false); setTimeout(function () { if (!$('hint').hidden && !$('hint').classList.contains('gone')) linger(LINGER); else hint(); }, 0); });
    $('hint').addEventListener('transitionend', function () { if (this.classList.contains('gone')) { this.hidden = true; this.classList.remove('gone'); } });
    window.addEventListener('focus', function () { setTimeout(hint, 0); });
    window.addEventListener('resize', function () { if (L) { L.lw = clamp(L.lw, limits('left')); L.rw = clamp(L.rw, limits('right')); L.bh = clamp(L.bh, limits('bottom')); sizes(); } });
    document.addEventListener('focusin', function () { setTimeout(hint, 0); });
    UI.onMute(function (m) { Runner.mute(m); });
    Runner.on(function (name) { if (name === 'paused' || name === 'resumed') paintPlay(); });
    paintPlay();
  }

  function setProjectName(name) { $('projText').textContent = name; }
  function stars(n) {
    $('starCount').textContent = n + (n === 1 ? ' star' : ' stars');
  }

  return { init: init, on: on, openDock: openDock, reveal: reveal, unmin: unmin, tree: tree, allow: allow, select: select,
           inspect: inspect, closeInspector: closeInspector, set: set, place: place, refOf: refOf, togglePlay: togglePlay, cue: cue, point: point,
           paintPlay: paintPlay, me: me, news: newsFor, setProjectName: setProjectName, stars: stars, project: paintProject, undo: undo, redo: redo,
           takes: takes, give: give, duplicate: duplicate, remove: remove, create: create,
           selected: function () { return selected; }, allowed: function () { return allowed; } };
})();
