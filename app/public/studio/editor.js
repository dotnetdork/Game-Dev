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
    d.classList.toggle('closed', !open); d.inert = !open; d.setAttribute('aria-hidden', String(!open));
    // Undo and Layout arrive with the first panel whose contents the kid can change or move.
    if (id === 'dHier' && open) { reveal('editTools', true); reveal('layoutTools', true); }
    paintBar();
  }
  function reveal(id, open) {
    var d = $(id); if (!d) return;
    d.classList.toggle('closed', !open); d.inert = !open;
    paintBar();
  }

  /* ---------- the Hierarchy ---------- */
  var HERO_WORDS = { alien: 'alien', pink: 'pink alien', slime: 'slime', frog: 'frog', mouse: 'mouse' };
  function note(p) {
    if (p.kind === 'player') return p.look ? 'your ' + (p.lookWord || HERO_WORDS[p.look] || 'hero') : p.note;
    if (p.id === 'tile') return p.solid ? 'solid now' : p.note;
    if (p.kind === 'floor') return p.solid ? 'solid' : 'not solid!';
    if (p.kind === 'coin') return p.sound ? 'makes a sound now' : p.look ? 'has art now' : p.size > 1.05 ? 'bigger' : p.note;
    if (p.kind === 'lava') return p.hurts ? 'hurts now' : p.look ? 'has art now' : p.note;
    return p.note || '';
  }
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
          + '<svg class="i" aria-hidden="true"><use href="#i-cube"/></svg><span class="nm"></span><small></small>';
        b.querySelector('.nm').textContent = p.name;
        b.querySelector('small').textContent = note(p);
        b.addEventListener('click', function () { select(p.id); });
        li.appendChild(b); ul.appendChild(li);
      });
    });
  }

  /* ---------- the Inspector ---------- */
  function allow(list) { allowed = {}; (list || []).forEach(function (c) { allowed[c] = true; }); if (selected) inspect(selected); }

  /* A component, as Unity draws one: a fold arrow, the on/off checkbox when the component can be
     switched off (that IS the setting, as in Unity: a Box Collider that's off lets things fall
     through), the real name, and the kid's gloss. `state` says in words what the checkbox means. */
  var folded = {};
  function comp(o) {
    var id = o.name.replace(/\W+/g, '-').toLowerCase(), shut = !!folded[o.name];
    var h = '<div class="comp' + (shut ? ' folded' : '') + '">'
      + '<button type="button" class="fold" data-fold="' + o.name + '" data-key="fold:' + id + '" aria-expanded="' + !shut + '" aria-controls="cb-' + id + '" aria-label="Fold ' + o.name + '" data-tip="Fold or open this component"><svg class="i" aria-hidden="true"><use href="#i-fold"/></svg></button>';
    if (o.key) {
      h += '<button type="button" class="cbox" role="checkbox" data-key="c:' + o.key + '" data-set="' + o.key + '" aria-checked="' + !!o.on + '" data-tip="' + o.tip + '">'
        + '<i aria-hidden="true"><svg class="i"><use href="#i-check"/></svg></i><strong>' + o.name + '</strong></button>';
    } else h += '<strong class="cname" data-tip="' + o.tip + '" tabindex="0">' + o.name + '</strong>';
    h += '<small>' + o.gloss + '</small></div><div class="comp-body" id="cb-' + id + '"' + (shut ? ' hidden' : '') + '>';
    if (o.state) h += '<p class="cstate' + (o.on ? ' on' : '') + '">' + o.state + '</p>';
    return h + (o.body || '') + '</div>';
  }
  function choices(key, label, unity, tip, list, cur) {
    return '<div class="irow wide"><span class="lbl" data-tip="' + tip + '" tabindex="0">' + label + '<small>' + unity + '</small></span><div class="sw-row" role="group" aria-label="' + label + '">'
      + list.map(function (c) {
        return '<button type="button" class="swatch" data-key="' + key + ':' + c[0] + '" data-pick="' + key + '" data-val="' + (c[0] === null ? '' : c[0]) + '" aria-pressed="' + (cur === c[0]) + '">'
          + (c[2] ? '<img alt="" src="' + c[2] + '">' : c[3] ? '<i class="blk" style="background:' + c[3] + '"></i>' : '')
          + c[1] + '</button>';
      }).join('') + '</div></div>';
  }
  function slider(key, label, unity, tip, min, max, stepv, val, fmt) {
    return '<div class="irow"><label for="r-' + key + '" data-tip="' + tip + '">' + label + '<small>' + unity + '</small></label>'
      + '<div class="rng"><input id="r-' + key + '" type="range" data-key="r:' + key + '" data-slide="' + key + '" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + val + '"'
      + ' aria-valuetext="' + fmt(val) + '"><output>' + fmt(val) + '</output></div></div>';
  }

  var A = '/assets/platformer/';
  function body(p) {
    var h = '';
    if (p.kind === 'floor') {
      h += comp({ name: 'Box Collider 2D', gloss: 'makes it solid', key: 'solid', on: p.solid,
        tip: 'Box Collider 2D: tick it and things can stand on this part',
        state: p.solid ? 'On: things stand on it.' : 'Off: it’s just a picture. Things fall through.' });
    }
    if (p.kind === 'coin') {
      if (allowed.coinArt) h += comp({ name: 'Sprite Renderer', gloss: 'how it looks', tip: 'Sprite Renderer: draws a picture for this part',
        body: choices('look', 'Sprite', 'Unity: Sprite', 'Sprite: the picture this part is drawn with',
          [[null, 'Grey box', null, '#c4c4c4'], ['coin_gold', 'Gold coin', A + 'coin_gold.png'], ['coin_silver', 'Silver coin', A + 'coin_silver.png'], ['gem_blue', 'Blue gem', A + 'gem_blue.png']], p.look) });
      if (allowed.coinSound) h += comp({ name: 'Audio Source', gloss: 'the sound it makes', tip: 'Audio Source: plays a sound from this part',
        body: choices('sound', 'When you grab it', 'Unity: AudioClip', 'AudioClip: the sound that plays when a coin is grabbed',
          [[null, 'Nothing'], ['ding', 'Sparkly ding'], ['boing', 'Springy boing'], ['buzz', 'Angry buzz']], p.sound) });
      if (allowed.coinSize) h += comp({ name: 'Transform', gloss: 'where it is, how big', tip: 'Transform: every part has one. It holds where the part is and how big',
        body: slider('size', 'Size', 'Unity: Scale', 'Scale: how big the part is. 1 is its normal size', 1, 3, 0.1, p.size, function (v) { return Number(v).toFixed(1) + '×'; }) });
    }
    if (p.kind === 'lava') {
      if (allowed.lavaArt) h += comp({ name: 'Sprite Renderer', gloss: 'how it looks', tip: 'Sprite Renderer: draws a picture for this part',
        body: choices('look', 'Sprite', 'Unity: Sprite', 'Sprite: the picture this part is drawn with', [[null, 'Grey box', null, '#7c7c7c'], ['lava', 'Lava', A + 'lava_top.png']], p.look) });
      if (allowed.hazard) h += comp({ name: 'Hazard (Script)', gloss: 'a rule the designer wrote', key: 'hurts', on: p.hurts,
        tip: 'Hazard: a script. Tick it and touching this part sends the player back',
        state: p.hurts ? 'On: touching it sends you back.' : 'Off: it’s just a floor.' });
    }
    if (!h) {
      h = '<p class="inote">' + ({
        player: p.look ? 'Your hero. You’ll tune how it moves soon.' : 'The hero, for now a grey box. Nothing to change here yet.',
        level: 'The level all the parts live in. Gravity lives here.',
        coin: 'The goal. Grab them to win.',
        lava: 'Lava. It should hurt… but that’s a job for the Design department.'
      }[p.kind] || 'Nothing to change here yet.') + '</p>';
    }
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
    requestAnimationFrame(function () { var lg = $('log'); lg.scrollTop = lg.scrollHeight; });   // the conversation keeps its newest line in view
  }
  function inspect(id) {
    var p = Project.part(id); if (!p) return;
    selected = id;
    UI.keepFocus($('inspector'), function () {
      $('inspName').textContent = p.name;
      $('inspBody').innerHTML = body(p);
      wire(p);
    });
    openInspector();
  }
  /* Window › Inspector with nothing picked: Unity's empty Inspector, saying what to do. */
  function inspectNothing() {
    $('inspName').textContent = '';
    $('inspBody').innerHTML = '<p class="inote">Nothing picked. Tap a part in the Hierarchy to see its settings here.</p>';
    openInspector();
  }
  function closeInspector() {
    var el = $('inspector');
    el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); el.inert = true;
    selected = null; tree();
  }
  function wire(p) {
    var box = $('inspBody');
    Array.prototype.forEach.call(box.querySelectorAll('[data-set]'), function (b) {
      b.addEventListener('click', function () { var k = b.getAttribute('data-set'); set(p.id, k, !p[k]); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-fold]'), function (b) {
      b.addEventListener('click', function () { var n = b.getAttribute('data-fold'); folded[n] = !folded[n]; inspect(p.id); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-pick]'), function (b) {
      b.addEventListener('click', function () { var v = b.getAttribute('data-val') || null; set(p.id, b.getAttribute('data-pick'), v); });
    });
    Array.prototype.forEach.call(box.querySelectorAll('[data-slide]'), function (r) {
      r.addEventListener('input', function () {
        var v = parseFloat(r.value), out = r.parentNode.querySelector('output');
        out.textContent = Number(v).toFixed(1) + '×'; r.setAttribute('aria-valuetext', out.textContent);
        set(p.id, r.getAttribute('data-slide'), v, true);
      });
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
    if ((!quiet || replay) && selected === id) inspect(id);   // repaint the open Inspector; never open one the kid didn't ask for
    tree();
    emit('set', { id: id, key: key, value: value });
  }

  /* Picking a sound plays it once, here in the studio: the kid caused it, so it may make a noise. */
  var SFX = { ding: 'platformer/sfx_coin.ogg', boing: 'platformer/sfx_jump.ogg', buzz: 'sfx-error.ogg' };
  function previewSound(id) {
    if (UI.muted() || !SFX[id]) return;
    try { var a = new Audio('/assets/' + SFX[id]); a.volume = 0.5; a.play().catch(function () {}); } catch (e) {}
  }

  /* ---------- Undo and Redo ---------- */
  var undos = [], redos = [], playMark = 0;
  var WORD = { solid: 'Box Collider', hurts: 'Hazard', look: 'Sprite', sound: 'sound', size: 'size' };
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
    $('pointerText').textContent = text; el.hidden = false;
    var ed = $('editor').getBoundingClientRect(), r = target.getBoundingClientRect();
    el.style.left = Math.max(8, Math.round(r.left - ed.left)) + 'px';
    el.style.top = Math.max(8, Math.round(r.top - ed.top - el.offsetHeight - 10)) + 'px';
  }

  /* ---------- the Project window: Tickets and Cards, each a tab that arrives with the story ---------- */
  var PTABS = { tickets: ['tabTickets', 'pTickets'], cards: ['tabCards', 'pCards'] };
  function projectTab(name, pick) {
    var t = PTABS[name]; if (!t) return;
    openDock('dProject', true);
    var first = !Object.keys(PTABS).some(function (k) { return !$(PTABS[k][0]).hidden; });
    $(t[0]).hidden = false;
    if (first || pick) pickTab(name);
  }
  function pickTab(name) {
    Object.keys(PTABS).forEach(function (k) {
      var on = k === name;
      $(PTABS[k][0]).setAttribute('aria-selected', String(on)); $(PTABS[k][0]).tabIndex = on ? 0 : -1;
      $(PTABS[k][1]).hidden = !on;
      if (on) $(PTABS[k][0]).classList.remove('news');
    });
  }
  function tabKeys(e) {
    var fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight', back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (!fwd && !back) return;
    var shown = Object.keys(PTABS).filter(function (k) { return !$(PTABS[k][0]).hidden; });
    var at = shown.indexOf(Object.keys(PTABS).filter(function (k) { return $(PTABS[k][0]) === e.target; })[0]);
    if (at < 0) return;
    var n = shown[(at + (fwd ? 1 : shown.length - 1)) % shown.length];
    pickTab(n); $(PTABS[n][0]).focus(); e.preventDefault();
  }
  function ticketCount(open) { $('ticketCount').textContent = open ? open + ' open' : ''; }
  /* The cards the kid has earned, newest first: the idea's name and one line of what it means. */
  function cards(list) {
    var ul = $('cardList'); ul.innerHTML = '';
    $('cardCount').textContent = list.length ? String(list.length) : '';
    if (!list.length) { ul.innerHTML = '<li class="empty">No cards yet. You earn one each time you learn a game idea.</li>'; return; }
    list.slice().reverse().forEach(function (c) {
      var li = document.createElement('li'); li.className = 'ctile';
      li.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-cards"/></svg><b></b><span></span>';
      li.querySelector('b').textContent = c.name || c; li.querySelector('span').textContent = c.text || '';
      ul.appendChild(li);
    });
    if ($('tabCards').getAttribute('aria-selected') !== 'true') $('tabCards').classList.add('news');
  }

  /* ---------- menus ---------- */
  /* Built each time one opens, from what is true right now, so an item never lies about whether it
     works. A menu with nothing in it yet isn't on the bar. */
  var PANEL_NAMES = { hierarchy: ['Hierarchy', 'i-tree', 'dHier'], game: ['Game', 'i-pad', 'dGame'], inspector: ['Inspector', 'i-sliders', 'inspector'],
                      chat: ['Chat', 'i-chat', 'dMentor'], project: ['Project', 'i-folder', 'dProject'] };
  function MENUS() {
    var playing = Runner.isPlaying(), hier = isOpen('dHier');
    return [
      { id: 'file', label: 'File', items: [
        { label: 'Save', icon: 'i-save', keys: 'Ctrl+S', tip: 'Your game saves by itself; this saves it right now', run: saveNow },
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
        { label: 'Add a part…', icon: 'i-plus', tip: 'Describe a new part, and the studio will add it', run: function () { Chat.prompt('Describe the part you want to add…'); } },
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
  var PANELS = { hierarchy: 'dHier', inspector: 'inspector', chat: 'dMentor', project: 'dProject' };
  var DEFAULT = { left: ['hierarchy'], right: ['inspector', 'chat'], bottom: ['project'], lw: 264, rw: 388, bh: 150, grow: {} };
  var BIG = { left: ['hierarchy'], right: ['inspector', 'chat'], bottom: ['project'], lw: 200, rw: 316, bh: 112, grow: {} };
  var LAYOUT_KEY = 'studio.layout.v1', L = null;
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
    Object.keys(PTABS).forEach(function (k) { $(PTABS[k][0]).addEventListener('click', function () { pickTab(k); }); $(PTABS[k][0]).addEventListener('keydown', tabKeys); });
    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', function (e) {
      if (openMenu && !openMenu.pop.contains(e.target) && e.target !== openMenu.btn) closeMenu(false);
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

  function setProjectName(name) {
    $('projText').textContent = name;
    $('gameOf').textContent = name;
  }
  function stars(n) {
    $('starCount').textContent = n + (n === 1 ? ' star' : ' stars');
  }

  return { init: init, on: on, openDock: openDock, reveal: reveal, tree: tree, allow: allow, select: select,
           inspect: inspect, closeInspector: closeInspector, set: set, togglePlay: togglePlay, cue: cue, point: point,
           paintPlay: paintPlay, setProjectName: setProjectName, stars: stars, cards: cards,
           projectTab: projectTab, ticketCount: ticketCount, undo: undo, redo: redo,
           selected: function () { return selected; } };
})();
