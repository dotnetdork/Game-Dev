/* editor.js: the engine around the game. Menus, the toolbar, docks, the Hierarchy, the Inspector,
   the Project window, Play, Undo, the pointer.

   The layout and its rules are DESIGN.md's; this file is the behaviour:
   - The Builds Around You Rule. Docks open in story order; until then each is a faint outline in
     its final place, inert and hidden from screen readers, so nothing reads out a panel the kid
     can't see yet. The menus follow the same rule: Window lists only panels the kid has met, and
     a menu item exists only when it works (spec §3.3).
   - The Hierarchy lists the parts; tapping one opens the Inspector as its own dock above the
     conversation (The No Overlay Rule). Components belong to the part they're on, as in Unity, with
     their on/off checkbox in the header where Unity has one.
   - Which components the Inspector shows is up to the story (allow()): on the first day each
     department's job has exactly one knob to find, so a kid isn't handed six.
   - Play works as Unity's does, including the undo on Stop (runner.js says why), and so do Pause
     and Step.
   - Undo and Redo cover what the kid changed in the Inspector. What was changed in Play mode is
     undone by Stop anyway, so Stop drops those steps rather than offering to undo them twice.
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
  function isOpen(id) { var d = $(id); return !!d && !d.classList.contains('closed'); }

  function openDock(id, open) {
    var d = $(id); if (!d) return;
    if (open && maxed && maxed !== d) unmaximize();   // a panel arriving is shown, not hidden under a big one
    d.classList.toggle('closed', !open); d.inert = !open; d.setAttribute('aria-hidden', String(!open));
    // Undo and Layout arrive with the first panel whose contents the kid can change or move.
    if (id === 'dHier' && open) { reveal('editTools', true); reveal('layoutTools', true); }
    // ...and the Scene view with the Hierarchy: the parts, to look at and pick (views.js)
    if (id === 'dHier' && window.Views) Views.revealScene(!!open);
    paintBar();
  }
  function reveal(id, open) {
    var d = $(id); if (!d) return;
    d.classList.toggle('closed', !open); d.inert = !open;
    paintBar();
  }

  /* ---------- the Hierarchy ---------- */
  /* Names only, as Unity's is. The first build glossed each row ("not solid!", "looks broken"), which
     told the kid the answer before they looked (Jay, 2026-09-28: no glosses). */
  function tree(animate) {
    UI.keepFocus($('tree'), function () {
      var ul = $('tree'); ul.innerHTML = '';
      Project.get().parts.forEach(function (p, k) {
        var li = document.createElement('li');
        if (p.kind !== 'level') li.className = 'child';
        if (animate) li.className += ' snap';
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-key', 'part:' + p.id);
        b.setAttribute('aria-pressed', String(selected === p.id));
        if (animate) b.style.animationDelay = (k * 0.1) + 's';
        b.innerHTML = (p.kind === 'level' ? '<svg class="i fold" aria-hidden="true"><use href="#i-fold"/></svg>' : '')
          + '<svg class="i" aria-hidden="true"><use href="#' + (p.kind === 'level' ? 'i-layout' : 'i-cube') + '"/></svg><span class="nm"></span>';
        b.querySelector('.nm').textContent = p.name;
        b.addEventListener('click', function () { select(p.id); });
        li.appendChild(b); ul.appendChild(li);
      });
    });
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
     exactly one to find, so a kid isn't handed six. After it, all of them. The rest are LOCKED
     headers, not missing ones, and every part opens with its name and a Transform, so the Inspector
     has the same shape whichever part is picked (schema.js, "every part has the same shape"). */
  function allow(list) { allowed = {}; (list || []).forEach(function (c) { allowed[c] = true; }); if (selected) inspect(selected); }

  var folded = {};
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function header(c, p) {
    var id = c.name.replace(/\W+/g, '-').toLowerCase(), shut = !!folded[c.name];
    var h = '<div class="comp' + (shut ? ' folded' : '') + '">'
      + '<button type="button" class="fold" data-fold="' + esc(c.name) + '" data-key="fold:' + id + '" aria-expanded="' + !shut + '" aria-controls="cb-' + id + '" aria-label="Fold ' + esc(c.name) + '" data-tip="Fold or open this component"><svg class="i" aria-hidden="true"><use href="#i-fold"/></svg></button>'
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
  function numberField(f, p) {
    var v = typeof p[f.key] === 'number' ? p[f.key] : f.min;
    return '<div class="irow num"><label for="r-' + f.key + '" data-tip="' + esc(f.tip || f.label) + '">' + esc(f.label) + '</label>'
      + '<div class="rng"><input id="r-' + f.key + '" type="range" data-key="r:' + f.key + '" data-slide="' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + v + '" aria-valuetext="' + fmt(f, v) + (f.unit || '') + '">'
      + '<input type="number" class="nbox" id="n-' + f.key + '" data-key="n:' + f.key + '" data-num="' + f.key + '" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + fmt(f, v) + '" aria-label="' + esc(f.label) + ', exact value"></div></div>';
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
  /* A number that can't be changed here: placed by the level (readonly), or on a gate the story
     hasn't opened. Its value, and a tooltip saying why; no slider, no id, nothing to set. */
  function fixedField(f, p, why) {
    var v = f.get ? f.get(p) : p[f.key];
    return '<div class="irow num fixed"><span class="lbl" data-tip="' + esc(why) + '" tabindex="0">' + esc(f.label) + '</span>'
      + '<div class="rng"><output class="nbox" aria-label="' + esc(f.label) + '">' + fmt(f, v) + '</output></div></div>';
  }
  function fields(c, p) {
    return (c.fields || []).map(function (f) {
      if (f.readonly) return fixedField(f, p, f.tip);
      if (f.gate && !allowed[f.gate]) return fixedField(f, p, f.label + ': you’ll unlock this on a later shift');
      if (f.type === 'number') return numberField(f, p);
      if (f.type === 'sprite' || f.type === 'sound') return objectField(f, p);
      if (f.type === 'color') return colorField(f, p);
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
  function objectHeader(p) {
    return '<div class="ohead"><svg class="i" aria-hidden="true"><use href="#' + (p.kind === 'level' ? 'i-layout' : 'i-cube') + '"/></svg>'
      + '<p><strong>' + esc(p.name) + '</strong><small>' + esc(KIND_WORDS[p.kind] || 'Game Object · Built by the Builder') + '</small></p></div>';
  }
  /* A component the story hasn't opened yet: its header, locked, with nothing in it to find. */
  function lockedHeader(c) {
    return '<div class="comp locked" tabindex="0" data-tip="' + esc(c.name) + ': you’ll unlock this on a later shift" aria-label="' + esc(c.name) + ', locked for now">'
      + '<span class="lock" aria-hidden="true"><svg class="i"><use href="#i-lock"/></svg></span>'
      + '<svg class="i cicon" aria-hidden="true"><use href="#' + (c.icon || 'i-cube') + '"/></svg><strong class="cname">' + esc(c.name) + '</strong></div>';
  }
  function body(p) {
    var h = objectHeader(p), comps = Schema.components(p.kind);
    comps.forEach(function (c) {
      if (c.gate && !allowed[c.gate]) { h += lockedHeader(c); return; }
      h += header(c, p) + fields(c, p) + '</div>';
    });
    if (!comps.length) h += generic(p) || '<p class="inote">Nothing on ' + esc(p.name) + ' to change yet.</p>';
    return h;
  }

  function select(id) {
    selected = selected === id ? null : id;
    tree();
    if (selected) inspect(selected); else closeInspector();
    emit('select', id);
  }
  function openInspector() {
    var el = $('inspector');
    if (!el.classList.contains('open')) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); el.inert = false; }
  }
  function inspect(id) {
    var p = Project.part(id); if (!p) return;
    selected = id;
    closePicker();
    UI.keepFocus($('inspector'), function () {
      $('inspBody').innerHTML = body(p);
      wire(p);
    });
    glow();
    openInspector();
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
  function wire(p) {
    var box = $('inspBody');
    function each(sel, fn) { Array.prototype.forEach.call(box.querySelectorAll(sel), fn); }
    each('[data-set]', function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-set'); set(p.id, k, !p[k]); }); });
    each('[data-fold]', function (b) { b.addEventListener('click', function () { var n = b.getAttribute('data-fold'); folded[n] = !folded[n]; inspect(p.id); }); });
    each('[data-slide]', function (r) {
      r.addEventListener('input', function () {
        var k = r.getAttribute('data-slide'), f = fieldOf(p, k), v = parseFloat(r.value), n = $('n-' + k);
        if (n) n.value = fmt(f, v);
        r.setAttribute('aria-valuetext', fmt(f, v) + (f.unit || ''));
        set(p.id, k, v, true);
      });
    });
    each('[data-num]', function (n) {
      n.addEventListener('change', function () {
        var k = n.getAttribute('data-num'), f = fieldOf(p, k), v = parseFloat(n.value);
        if (!isFinite(v)) { n.value = fmt(f, p[k]); return; }
        v = Math.max(f.min, Math.min(f.max, v));
        n.value = fmt(f, v); var r = $('r-' + k); if (r) r.value = v;
        set(p.id, k, v, true);
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
    return el;
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
    return a.kind !== 'sprite' || slot.getAttribute('data-of') === a.of;
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
  }

  /* The one way the kid changes a part. `quiet` leaves the Inspector alone (a slider mid-drag);
     `replay` is Undo or Redo putting a value back, which is not a new step. */
  function set(id, key, value, quiet, replay) {
    var p = Project.part(id); if (!p) return;
    var before = p[key];
    if (before === value) return;
    if (!replay) record(id, key, before, value, quiet);
    p[key] = value;
    Runner.set(id, key, value);
    if (!Runner.isPlaying()) Project.save();
    if (key === 'sound' && value) previewSound(value);
    if (key === 'look' || key === 'shape') setTimeout(Runner.askThumbs, 600);   // the Project window shows the new picture
    if ((!quiet || replay) && selected === id) inspect(id);   // repaint the open Inspector; never open one the kid didn't ask for
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
  var WORD = { solid: 'Box Collider', hurts: 'Hazard', look: 'Sprite', sound: 'Clip', size: 'Scale', tint: 'Color', shape: 'hero', gravityScale: 'Gravity Scale', jump: 'Jump Force', w: 'Width' };
  function record(id, key, before, after, quiet) {
    var last = undos[undos.length - 1], t = Date.now();
    // one slider drag is one step, not forty
    if (quiet && last && last.id === id && last.key === key && t - last.t < 1200) { last.after = after; last.t = t; }
    else undos.push({ id: id, key: key, before: before, after: after, t: t });
    if (undos.length > 50) { undos.shift(); playMark = Math.max(0, playMark - 1); }
    redos = [];
    paintUndo();
  }
  function what(e) { var p = Project.part(e.id); return (p ? p.name + ' ' : '') + (WORD[e.key] || e.key); }
  function canUndo() { return undos.length > (Runner.isPlaying() ? playMark : 0); }
  function canRedo() { return redos.length > 0; }
  function undo() {
    if (!canUndo()) return;
    var e = undos.pop(); redos.push(e);
    set(e.id, e.key, e.before, false, true);
    status('Undid: ' + what(e)); paintUndo();
  }
  function redo() {
    if (!canRedo()) return;
    var e = redos.pop(); undos.push(e);
    set(e.id, e.key, e.after, false, true);
    status('Redid: ' + what(e)); paintUndo();
  }
  function paintUndo() {
    $('bUndo').disabled = !canUndo(); $('bRedo').disabled = !canRedo();
    var u = undos[undos.length - 1], r = redos[redos.length - 1];
    $('bUndo').setAttribute('data-tip', canUndo() ? 'Undo: put back ' + what(u) + ' (Ctrl+Z)' : 'Undo: nothing to put back yet');
    $('bRedo').setAttribute('data-tip', canRedo() ? 'Redo: ' + what(r) + ' again (Ctrl+Y)' : 'Redo: nothing to do again');
  }

  /* ---------- Play, Pause, Step ---------- */
  function paintPlay() {
    var on = Runner.isPlaying(), paused = Runner.isPaused(), b = $('bPlay');
    b.classList.toggle('on', on);
    b.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-play');
    b.querySelector('span').textContent = on ? 'Stop' : 'Play';
    b.setAttribute('aria-label', on ? 'Stop the game' : 'Play the game');
    b.setAttribute('data-tip', on ? 'Stop: end the game. Changes made while playing are undone (Ctrl+P)' : 'Play: run your game (Ctrl+P)');
    $('bPause').disabled = !on; $('bPause').setAttribute('aria-pressed', String(paused)); $('bPause').classList.toggle('on', paused);
    $('bStep').disabled = !paused;
    $('pausedTag').hidden = !paused;
    $('editor').classList.toggle('playmode', on);
    $('gamebody').classList.toggle('playing', on);
    status(paused ? 'Paused: press Step to move one frame, or Pause again to carry on'
      : on ? 'Play mode: changes you make now are undone when you press Stop' : 'Stopped');
    hint(); paintUndo();
  }
  function togglePlay() {
    var st = Project.get();
    if (maxed && maxed.id !== 'dGame' && !Runner.isPlaying()) unmaximize();   // Play shows the game
    if (Runner.isPlaying()) {
      Runner.stop(st, UI.muted()); UI.sound('stop'); Project.save();
      undos.length = Math.min(undos.length, playMark); redos = [];   // Stop just undid those
      if (selected) inspect(selected); tree();
    } else { playMark = undos.length; Runner.play(st.parts, UI.muted()); UI.sound('play'); }
    cue(false);
    paintPlay();
  }
  function togglePause() { if (!Runner.isPlaying()) return; Runner.pause(!Runner.isPaused()); paintPlay(); }
  function stepFrame() { Runner.step(); status('One frame on. Press Step again, or Pause to carry on'); }
  function cue(on) { $('bPlay').classList.toggle('cue', !!on); }

  /* The key hint sits over the game while it runs and doesn't have the keyboard. */
  var keysUntil = 0;
  function hint() {
    var f = Runner.frame(), has = f && document.activeElement === f;
    $('hint').hidden = !(Date.now() < keysUntil) && (!Runner.isPlaying() || Runner.isPaused() || has);
  }
  function showKeys() { keysUntil = Date.now() + 5000; hint(); setTimeout(hint, 5100); }

  /* ---------- the pointer: a callout just above a panel's tab, pointing down at it ---------- */
  function point(text, target) {
    var el = $('pointer');
    if (!text) { el.hidden = true; return; }
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
       Cards    the game ideas they've learned
     A sprite or sound can be dragged onto an object field in the Inspector, or tapped to hold it
     and then a field tapped to take it (tap-to-slot, the Inspector's note). */
  var FOLDERS = [
    { id: 'sprites', name: 'Sprites', icon: 'i-image', path: 'Assets › Sprites' },
    { id: 'sounds', name: 'Sounds', icon: 'i-music', path: 'Assets › Sounds' },
    { id: 'scripts', name: 'Scripts', icon: 'i-script', path: 'Assets › Scripts' },
    { id: 'docs', name: 'Docs', icon: 'i-doc', path: 'Docs' },
    { id: 'cards', name: 'Cards', icon: 'i-cards', path: 'Cards' }
  ];
  var folder = 'sprites', openDoc = null, seenCards = 0;
  function paintFolders() {
    var nav = $('pFolders');
    UI.keepFocus(nav, function () {
      nav.innerHTML = '';
      FOLDERS.forEach(function (f) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'pfold'; b.id = 'pf-' + f.id; b.setAttribute('role', 'tab'); b.setAttribute('data-key', 'folder:' + f.id);
        b.setAttribute('aria-selected', String(folder === f.id)); b.setAttribute('aria-controls', 'pBody'); b.tabIndex = folder === f.id ? 0 : -1;
        b.innerHTML = '<svg class="i" aria-hidden="true"><use href="#' + (f.id === 'docs' || f.id === 'cards' ? f.icon : 'i-folder') + '"/></svg><span>' + f.name + '</span><i class="dot" aria-hidden="true"></i>';
        if (f.id === 'cards' && cardList().length > seenCards && folder !== 'cards') b.classList.add('news');
        b.addEventListener('click', function () { openFolder(f.id); });
        nav.appendChild(b);
      });
    });
  }
  function openFolder(id) { folder = id; openDoc = null; if (id === 'cards') seenCards = cardList().length; paintProject(); }
  function folderKeys(e) {
    var d = { ArrowDown: 1, ArrowUp: -1 }[e.key]; if (!d) return;
    var i = FOLDERS.map(function (f) { return f.id; }).indexOf(folder), n = FOLDERS[(i + d + FOLDERS.length) % FOLDERS.length];
    e.preventDefault(); openFolder(n.id); $('pf-' + n.id).focus();
  }
  function cardList() { return window.Quest && Quest.cards ? Quest.cards() : []; }
  function tile(face, name, opts) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'asset' + (opts.cls ? ' ' + opts.cls : '');
    if (opts.key) b.setAttribute('data-key', opts.key);
    b.innerHTML = '<span class="face">' + face + '</span><span class="nm"></span>';
    b.querySelector('.nm').textContent = name;
    if (opts.pressed !== undefined) b.setAttribute('aria-pressed', String(opts.pressed));
    if (opts.tip) b.setAttribute('data-tip', opts.tip);
    if (opts.run) b.addEventListener('click', opts.run);
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
          tip: Schema.SPRITES[k][0] + ': drag it onto a Sprite slot, or tap it, then tap the slot', run: function () { hold(a); } }));
      });
      if (folder === 'sounds') Object.keys(Schema.SOUNDS).forEach(function (k) {
        var a = { kind: 'sound', key: k };
        grid.appendChild(tile(assetFace('sound', k), Schema.SOUNDS[k][0], { key: 'asset:' + k, pressed: !!held && held.key === k, drag: a,
          tip: Schema.SOUNDS[k][0] + ': tap to hear it and hold it, then tap a Clip slot', run: function () { previewSound(k); hold(a); } }));
      });
      if (folder === 'scripts') {
        // game.js opens in the centre, in its own tab beside the Game view (views.js)
        grid.appendChild(tile('<svg class="i" aria-hidden="true"><use href="#i-script"/></svg>', 'game.js', { key: 'asset:game.js',
          tip: 'Your game’s code. Open it to read and change it', run: function () { Views.openCode(); } }));
      }
      if (folder === 'docs') {
        if (openDoc) return doc(openDoc);
        [['Ideas', 'i-bulb'], ['Design doc', 'i-doc']].forEach(function (d) {
          grid.appendChild(tile('<svg class="i" aria-hidden="true"><use href="#' + d[1] + '"/></svg>', d[0], { key: 'doc:' + d[0], run: function () { openDoc = d[0]; paintProject(); } }));
        });
      }
      if (folder === 'cards') {
        var list = cardList();
        if (!list.length) { grid.className = 'assets list'; grid.innerHTML = '<li class="empty">No cards yet. You earn one each time you learn a game idea.</li>'; return; }
        grid.className = 'assets cards';
        list.slice().reverse().forEach(function (c) {
          var li = document.createElement('li'); li.className = 'ctile';
          li.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-cards"/></svg><b></b><span></span>';
          li.querySelector('b').textContent = c.name; li.querySelector('span').textContent = c.text;
          grid.appendChild(li);
        });
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
  function doc(name) {
    var v = view(name), st = Project.get(), S = st.quest || {};
    var ul = document.createElement('ul'); ul.className = 'docl';
    var rows = [];
    if (name === 'Ideas') {
      rows = (S.ideas || []).slice().reverse();
      if (!rows.length) rows = ['Nothing yet. Anything you ask for that can’t be built right away is kept here.'];
    } else {
      rows = ['Game: ' + (S.name || 'not named yet'), 'Hero: ' + (S.hero || 'not picked yet'),
        'Fixed: ' + (Object.keys(S.tickets || {}).filter(function (k) { return S.tickets[k].status === 'done'; }).length) + ' tickets',
        'Built with the AI: ' + (S.built || 0) + ' changes', 'Parts: ' + st.parts.map(function (p) { return p.name; }).join(', ')];
    }
    rows.forEach(function (r) { var li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
    v.appendChild(ul);
  }
  /* ---------- menus ---------- */
  /* Built each time one opens, from what is true right now, so an item never lies about whether it
     works. A menu with nothing in it yet isn't on the bar. */
  var PANEL_NAMES = { tickets: ['Tickets', 'i-ticket', 'dTickets'], hierarchy: ['Hierarchy', 'i-tree', 'dHier'], game: ['Game', 'i-pad', 'dGame'],
                      inspector: ['Inspector', 'i-sliders', 'inspector'], chat: ['Chat', 'i-chat', 'dMentor'], project: ['Project', 'i-folder', 'dProject'],
                      console: ['Console', 'i-terminal', 'dConsole'] };
  function MENUS() {
    var playing = Runner.isPlaying(), hier = isOpen('dHier');
    return [
      { id: 'file', label: 'File', items: [
        { label: 'Save', icon: 'i-save', keys: 'Ctrl+S', tip: 'Your game saves by itself; this saves it right now', run: saveNow },
        window.Quest && Quest.doneFirstDay && Quest.doneFirstDay() && { label: 'Clock out', icon: 'i-clapper', tip: 'End today’s shift. The Studio Director sums it up', run: function () { Quest.clockOut(); } },
        { sep: true },
        { label: 'Sign out', icon: 'i-exit', tip: 'Sign out of the studio. Your game stays saved', run: function () { saveNow(); setTimeout(function () { location.href = '/auth/logout'; }, 300); } }
      ] },
      { id: 'edit', label: 'Edit', items: [
        isOpen('editTools') && { label: 'Undo', icon: 'i-undo', keys: 'Ctrl+Z', disabled: !canUndo(), run: undo },
        isOpen('editTools') && { label: 'Redo', icon: 'i-redo', keys: 'Ctrl+Y', disabled: !canRedo(), run: redo },
        isOpen('transport') && { sep: true },
        isOpen('transport') && { label: playing ? 'Stop' : 'Play', icon: playing ? 'i-stop' : 'i-play', keys: 'Ctrl+P', run: togglePlay },
        isOpen('stepTools') && { label: Runner.isPaused() ? 'Carry on' : 'Pause', icon: 'i-pause', keys: 'Ctrl+Shift+P', disabled: !playing, run: togglePause },
        isOpen('stepTools') && { label: 'Step', icon: 'i-step', keys: 'Ctrl+Alt+P', disabled: !Runner.isPaused(), run: stepFrame }
      ] },
      { id: 'gameobject', label: 'GameObject', items: hier ? [
        { label: 'New part…', icon: 'i-plus', tip: 'Describe a new part, and the Builder adds it to your level', run: function () { Chat.prompt('Describe the part you want, like “a spring that bounces me up”…'); } },
        { sep: true, label: 'In your level' }
      ].concat(Project.get().parts.map(function (p) {
        return { label: p.name, icon: 'i-cube', checked: selected === p.id, run: function () { if (selected !== p.id) select(p.id); } };
      })) : [] },
      { id: 'window', label: 'Window', items: Object.keys(PANEL_NAMES).filter(met).map(function (k) {
        var n = PANEL_NAMES[k];
        return { label: n[0], icon: n[1], checked: k === 'inspector' ? $('inspector').classList.contains('open') : true, run: function () { showPanel(k); } };
      }).concat(isOpen('layoutTools') ? [{ sep: true, label: 'Layouts' }].concat(LAYOUT_ITEMS()) : []) },
      { id: 'help', label: 'Help', items: [
        { label: 'Ask the mentor', icon: 'i-chat', tip: 'Type a question to the studio', run: function () { Chat.prompt('Ask the studio anything…'); } },
        isOpen('dGame') && { label: 'Game keys', icon: 'i-keys', tip: 'Show the keys that move your hero', run: showKeys }
      ] }
    ].map(function (m) { m.items = m.items.filter(Boolean); return m; });
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
  function popup(btn, items, focusFirst, bar) {
    closeMenu(false);
    UI.hideTip();
    var pop = document.createElement('div'); pop.className = 'menupop'; pop.setAttribute('role', 'menu');
    pop.setAttribute('aria-label', btn.textContent.trim());
    items.forEach(function (it) {
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
    btn.parentNode.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true'); btn.classList.add('open');
    // keep it on screen
    var r = pop.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    if (r.right > vw - 8) pop.style.left = Math.round(vw - 8 - r.right) + 'px';
    openMenu = { btn: btn, pop: pop, bar: bar };
    if (focusFirst) { var f = pop.querySelector('.mitem'); if (f) f.focus(); }
  }
  function closeMenu(refocus) {
    if (!openMenu) return;
    var m = openMenu; openMenu = null;
    m.pop.remove(); m.btn.setAttribute('aria-expanded', 'false'); m.btn.classList.remove('open');
    if (refocus) m.btn.focus();
  }

  function showPanel(k) {
    if (k === 'inspector') { if (selected) inspect(selected); else inspectNothing(); }
    var d = $(PANEL_NAMES[k][2]); if (!d) return;
    UI.feel(d, 'good');
    var f = d.querySelector('button:not([disabled]):not([hidden]), input, [tabindex="0"]');
    if (f) f.focus({ preventScroll: false });
  }

  /* ---------- docks: where each panel sits, and how big ---------- */
  var AREAS = { left: 'aLeft', right: 'aRight', bottom: 'aBottom' };
  /* Tickets sit above the Hierarchy (a ticket is what the kid is working on; the Hierarchy is where),
     and the Console beside the Project window, as Unity's are. */
  var PANELS = { tickets: 'dTickets', hierarchy: 'dHier', inspector: 'inspector', chat: 'dMentor', project: 'dProject', console: 'dConsole' };
  var DEFAULT = { left: ['tickets', 'hierarchy'], right: ['inspector', 'chat'], bottom: ['project', 'console'], lw: 264, rw: 388, bh: 176, grow: { tickets: 2, hierarchy: 3, project: 3, console: 2 } };
  var BIG = { left: ['tickets', 'hierarchy'], right: ['inspector', 'chat'], bottom: ['project', 'console'], lw: 200, rw: 316, bh: 120, grow: { tickets: 2, hierarchy: 3, project: 3, console: 2 } };
  var LAYOUT_KEY = 'studio.layout.v3', L = null;
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function layoutIs(d) { return JSON.stringify(L) === JSON.stringify(d); }
  function loadLayout() {
    var s = null; try { s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) {}
    // only a layout that still names every panel exactly once; anything else is from an older studio
    var names = s && [].concat(s.left || [], s.right || [], s.bottom || []).sort().join();
    L = names === Object.keys(PANELS).sort().join() ? s : copy(DEFAULT);
    L.grow = L.grow || {};
  }
  function saveLayout() { try { if (layoutIs(DEFAULT)) localStorage.removeItem(LAYOUT_KEY); else localStorage.setItem(LAYOUT_KEY, JSON.stringify(L)); } catch (e) {} }
  function useLayout(d) { L = copy(d); saveLayout(); applyLayout(); status(d === DEFAULT ? 'Panels are back where they started' : 'The game is as big as it goes'); }
  function applyLayout() {
    Object.keys(AREAS).forEach(function (a) {
      var area = $(AREAS[a]);
      Array.prototype.forEach.call(area.querySelectorAll(':scope > .split'), function (s) { s.remove(); });
      L[a].forEach(function (name, i) {
        var d = $(PANELS[name]);
        if (i) area.appendChild(splitter('panels', a, i));
        area.appendChild(d);
        d.style.flex = L.grow[name] ? L.grow[name] + ' 1 0' : '';
      });
      area.classList.toggle('empty', !L[a].length);
      if (!area.querySelector(':scope > .split.edge')) area.appendChild(splitter('edge', a));
    });
    sizes();
    requestAnimationFrame(function () { var lg = $('log'); lg.scrollTop = lg.scrollHeight; });
  }
  function sizes() {
    var ed = $('editor');
    ed.style.setProperty('--lw', (L.left.length ? L.lw : 0) + 'px');
    ed.style.setProperty('--rw', (L.right.length ? L.rw : 0) + 'px');
    ed.style.setProperty('--bh', (L.bottom.length ? L.bh : 0) + 'px');
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
    var sz = names.map(function (n) { var r = $(PANELS[n]).getBoundingClientRect(); return vertical ? r.height : r.width; });
    var a = at - 1, b = at;
    while (a >= 0 && !sz[a]) a--;
    while (b < names.length && !sz[b]) b++;
    if (a < 0 || b >= names.length) return;
    var move = Math.max(-(sz[a] - 90), Math.min(sz[b] - 90, px));
    sz[a] += move; sz[b] -= move;
    names.forEach(function (n, i) { if (sz[i]) { L.grow[n] = Math.round(sz[i]); $(PANELS[n]).style.flex = L.grow[n] + ' 1 0'; } });
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
    var chat = $('dMentor'), side = !narrow() && d !== chat && L.right.indexOf('chat') >= 0 && L.right.indexOf(d.getAttribute('data-panel')) < 0;
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
    var dock = tab.closest('.dock'); if (!dock || dock.classList.contains('closed')) return;
    var name = dock.getAttribute('data-panel'); if (!PANELS[name]) return;
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
    ln.hidden = false;
    var r = t.rect;
    if (t.vertical) { ln.style.left = r.left + 'px'; ln.style.width = r.width + 'px'; ln.style.top = t.edge - 2 + 'px'; ln.style.height = '4px'; }
    else { ln.style.top = r.top + 'px'; ln.style.height = r.height + 'px'; ln.style.left = t.edge - 2 + 'px'; ln.style.width = '4px'; }
  }
  /* Which area the pointer is over, and where in it: before the first panel whose middle is past
     the pointer. An empty area opens as a drop strip while a drag is on (CSS, .dragging). */
  function dropAt(x, y) {
    var hit = null;
    Object.keys(AREAS).forEach(function (a) {
      var r = $(AREAS[a]).getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = { area: a, rect: r };
    });
    if (!hit) return null;
    var vertical = hit.area !== 'bottom', names = L[hit.area].filter(function (n) { return n !== drag.name; });
    var idx = names.length, edge = vertical ? hit.rect.bottom : hit.rect.right;
    for (var i = 0; i < names.length; i++) {
      var r = $(PANELS[names[i]]).getBoundingClientRect(); if (!r.width || !r.height) continue;
      var mid = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
      if ((vertical ? y : x) < mid) { idx = i; edge = vertical ? r.top : r.left; break; }
    }
    if (!names.length) edge = vertical ? hit.rect.top + 2 : hit.rect.left + 2;
    return { area: hit.area, index: idx, vertical: vertical, rect: hit.rect, edge: edge };
  }
  function tabUp() {
    var d = drag; tabEnd();
    if (!d || !d.on || !d.target) return;
    Object.keys(AREAS).forEach(function (a) { L[a] = L[a].filter(function (n) { return n !== d.name; }); });
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
    if (e.key === 'Escape' && drag) { tabEnd(); return; }
    if (e.key === 'Escape' && openMenu) { closeMenu(true); return; }
    if (e.key === 'Escape' && pickerEl) { closePicker(true); return; }
    if (e.key === 'Escape' && held) { drop(); status('Put it down'); return; }
    if (e.key === 'Escape' && maxed) { var m = maxed; unmaximize(); var mb = m.querySelector('.maxb'); if (mb) mb.focus(); return; }
    if (e.key === 'Escape' && $('inspector').classList.contains('open')) { closeInspector(); return; }
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (!(e.ctrlKey || e.metaKey) || typing) return;
    var k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveNow(); }
    if (k === 'z' && !e.shiftKey && isOpen('editTools')) { e.preventDefault(); undo(); }
    if ((k === 'y' || (k === 'z' && e.shiftKey)) && isOpen('editTools')) { e.preventDefault(); redo(); }
    if (k === 'p' && isOpen('transport')) {
      e.preventDefault();
      if (e.altKey) { if (isOpen('stepTools')) stepFrame(); }
      else if (e.shiftKey) { if (isOpen('stepTools')) togglePause(); }
      else togglePlay();
    }
  }

  function init() {
    loadLayout(); applyLayout();
    paintBar();
    $('bPlay').addEventListener('click', togglePlay);
    $('bPause').addEventListener('click', togglePause);
    $('bStep').addEventListener('click', stepFrame);
    $('bUndo').addEventListener('click', undo);
    $('bRedo').addEventListener('click', redo);
    $('bLayout').addEventListener('click', function () {
      var b = $('bLayout'); if (openMenu && openMenu.btn === b) closeMenu(true); else popup(b, LAYOUT_ITEMS(), false, false);
    });
    $('bLayout').addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); popup($('bLayout'), LAYOUT_ITEMS(), true, false); } });
    $('inspClose').addEventListener('click', function () { closeInspector(); });
    Array.prototype.forEach.call($('editor').querySelectorAll('.dock'), function (d) {
      var row = d.querySelector(':scope > .tabs'); if (!row) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'x maxb';
      b.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-grow"/></svg>';
      b.addEventListener('click', function () { maximize(d); });
      row.insertBefore(b, row.querySelector(':scope > .x'));
      row.addEventListener('dblclick', function (e) { if (e.target.closest('.tab')) maximize(d); });
      paintMax(d);
    });
    $('pFolders').addEventListener('keydown', folderKeys);
    paintProject();
    Runner.on(function (name) { if (name === 'thumbs') { paintProject(); if (selected) inspect(selected); } });
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', function (e) {
      if (openMenu && !openMenu.pop.contains(e.target) && e.target !== openMenu.btn) closeMenu(false);
      if (pickerEl && !pickerEl.contains(e.target) && !pickerEl.from.contains(e.target)) closePicker(false);
    });
    $('editor').addEventListener('pointerdown', tabDown);
    $('gamebody').addEventListener('pointerdown', function () { Runner.focusGame(); });
    window.addEventListener('blur', function () { if (openMenu) closeMenu(false); setTimeout(hint, 0); });   // a click into the game frame blurs the page
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

  return { init: init, on: on, openDock: openDock, reveal: reveal, tree: tree, allow: allow, select: select,
           inspect: inspect, closeInspector: closeInspector, set: set, togglePlay: togglePlay, cue: cue, point: point,
           paintPlay: paintPlay, setProjectName: setProjectName, stars: stars, project: paintProject, undo: undo, redo: redo,
           selected: function () { return selected; }, allowed: function () { return allowed; } };
})();
