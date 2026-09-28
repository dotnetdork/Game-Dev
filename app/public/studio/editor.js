/* editor.js: the engine around the game. Docks, the Hierarchy, the Inspector, Play, the pointer.

   The layout and its rules are DESIGN.md's; this file is the behaviour:
   - The Builds Around You Rule. Docks open in story order; until then each is a faint outline in
     its final place, inert and hidden from screen readers, so nothing reads out a panel the kid
     can't see yet.
   - The Hierarchy lists the parts; tapping one opens the Inspector as its own dock above the
     conversation (The No Overlay Rule). Components belong to the part they're on, as in Unity.
   - Which components the Inspector shows is up to the story (allow()): on the first day each
     department's job has exactly one knob to find, so a kid isn't handed six.
   - Play works as Unity's does, including the undo on Stop (runner.js says why).
   Every change the Inspector makes goes through set(), which updates the project, tells the game,
   and tells whoever is listening (the first day's steps) what the kid did. */
var Editor = (function () {
  function $(id) { return document.getElementById(id); }
  var allowed = {}, selected = null, listeners = [];

  function on(fn) { listeners.push(fn); }
  function emit(name, detail) { listeners.forEach(function (fn) { try { fn(name, detail); } catch (e) { console.error(e); } }); }

  function openDock(id, open) {
    var d = $(id); if (!d) return;
    d.classList.toggle('closed', !open); d.inert = !open; d.setAttribute('aria-hidden', String(!open));
  }
  function reveal(id, open) {
    var d = $(id); if (!d) return;
    d.classList.toggle('closed', !open); d.inert = !open;
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

  function comp(title, unity) {
    return '<div class="comp"><svg class="i" aria-hidden="true"><use href="#i-fold"/></svg><strong>' + title + '</strong>'
      + (unity ? '<small>' + unity + '</small>' : '') + '</div>';
  }
  function sw(key, on, onText, offText, label, unity) {
    return '<div class="irow"><label id="l-' + key + '">' + label + '<small>' + unity + '</small></label>'
      + '<button type="button" class="switch" role="switch" data-key="' + key + '" data-set="' + key + '" aria-labelledby="l-' + key + '" aria-checked="' + on + '"><i></i><span>'
      + (on ? onText : offText) + '</span></button></div>';
  }
  function choices(key, label, unity, list, cur) {
    return '<div class="irow wide"><span class="lbl">' + label + '<small>' + unity + '</small></span><div class="sw-row" role="group" aria-label="' + label + '">'
      + list.map(function (c) {
        return '<button type="button" class="swatch" data-key="' + key + ':' + c[0] + '" data-pick="' + key + '" data-val="' + (c[0] === null ? '' : c[0]) + '" aria-pressed="' + (cur === c[0]) + '">'
          + (c[2] ? '<img alt="" src="' + c[2] + '">' : c[3] ? '<i class="blk" style="background:' + c[3] + '"></i>' : '')
          + c[1] + '</button>';
      }).join('') + '</div></div>';
  }
  function slider(key, label, unity, min, max, stepv, val, fmt) {
    return '<div class="irow"><label for="r-' + key + '">' + label + '<small>' + unity + '</small></label>'
      + '<div class="rng"><input id="r-' + key + '" type="range" data-key="r:' + key + '" data-slide="' + key + '" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + val + '"'
      + ' aria-valuetext="' + fmt(val) + '"><output>' + fmt(val) + '</output></div></div>';
  }

  var A = '/assets/platformer/';
  function body(p) {
    var h = '';
    if (p.kind === 'floor') {
      h += comp('Box Collider 2D', 'makes it solid');
      h += sw('solid', p.solid, 'On: things stand on it', 'Off: just a picture', 'Solid', 'Unity: collider on/off');
    }
    if (p.kind === 'coin') {
      if (allowed.coinArt) h += comp('Sprite Renderer', 'how it looks') + choices('look', 'Sprite', 'Unity: Sprite',
        [[null, 'Grey box', null, '#c4c4c4'], ['coin_gold', 'Gold coin', A + 'coin_gold.png'], ['coin_silver', 'Silver coin', A + 'coin_silver.png'], ['gem_blue', 'Blue gem', A + 'gem_blue.png']], p.look);
      if (allowed.coinSound) h += comp('Audio Source', 'the sound it makes') + choices('sound', 'When you grab it', 'Unity: AudioClip',
        [[null, 'Nothing'], ['ding', 'Sparkly ding'], ['boing', 'Springy boing'], ['buzz', 'Angry buzz']], p.sound);
      if (allowed.coinSize) h += comp('Transform', 'where it is, how big') + slider('size', 'Size', 'Unity: Scale', 1, 3, 0.1, p.size, function (v) { return Number(v).toFixed(1) + '×'; });
    }
    if (p.kind === 'lava') {
      if (allowed.lavaArt) h += comp('Sprite Renderer', 'how it looks') + choices('look', 'Sprite', 'Unity: Sprite',
        [[null, 'Grey box', null, '#7c7c7c'], ['lava', 'Lava', A + 'lava_top.png']], p.look);
      if (allowed.hazard) h += comp('Hazard (Script)', 'a rule the designer wrote') + sw('hurts', p.hurts, 'On: sends you back', 'Off: just a floor', 'Hurts player', 'Unity: a trigger + your rule');
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
  function inspect(id) {
    var p = Project.part(id); if (!p) return;
    selected = id;
    var el = $('inspector');
    UI.keepFocus(el, function () {
      $('inspName').textContent = p.name;
      $('inspBody').innerHTML = body(p);
      wire(p);
    });
    if (!el.classList.contains('open')) {
      el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); el.inert = false;
    }
    requestAnimationFrame(function () { var lg = $('log'); lg.scrollTop = lg.scrollHeight; });   // the conversation keeps its newest line in view
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

  /* The one way the kid changes a part. `quiet` leaves the Inspector alone (a slider mid-drag). */
  function set(id, key, value, quiet) {
    var p = Project.part(id); if (!p) return;
    p[key] = value;
    Runner.set(id, key, value);
    if (!Runner.isPlaying()) Project.save();
    if (key === 'sound' && value) previewSound(value);
    if (!quiet && selected === id) inspect(id);   // repaint the open Inspector; never open one the kid didn't ask for
    tree();
    emit('set', { id: id, key: key, value: value });
  }

  /* Picking a sound plays it once, here in the studio: the kid caused it, so it may make a noise. */
  var SFX = { ding: 'platformer/sfx_coin.ogg', boing: 'platformer/sfx_jump.ogg', buzz: 'sfx-error.ogg' };
  function previewSound(id) {
    if (UI.muted() || !SFX[id]) return;
    try { var a = new Audio('/assets/' + SFX[id]); a.volume = 0.5; a.play().catch(function () {}); } catch (e) {}
  }

  /* ---------- Play ---------- */
  function paintPlay() {
    var on = Runner.isPlaying(), b = $('bPlay');
    b.classList.toggle('on', on);
    b.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-play');
    b.querySelector('span').textContent = on ? 'Stop' : 'Play';
    b.setAttribute('aria-label', on ? 'Stop the game' : 'Play the game');
    $('editor').classList.toggle('playmode', on);
    $('gamebody').classList.toggle('playing', on);
    $('statusMsg').textContent = on ? 'Play mode: changes you make now are undone when you press Stop' : 'Stopped';
    hint();
  }
  function togglePlay() {
    var st = Project.get();
    if (Runner.isPlaying()) { Runner.stop(st, UI.muted()); UI.sound('stop'); Project.save(); if (selected) inspect(selected); tree(); }
    else { Runner.play(st.parts, UI.muted()); UI.sound('play'); }
    cue(false);
    paintPlay();
  }
  function cue(on) { $('bPlay').classList.toggle('cue', !!on); }

  /* The key hint sits over the game while it runs and doesn't have the keyboard. */
  function hint() {
    var f = Runner.frame(), has = f && document.activeElement === f;
    $('hint').hidden = !Runner.isPlaying() || has;
  }

  /* ---------- the pointer: a callout just above a panel's tab, pointing down at it ---------- */
  function point(text, target) {
    var el = $('pointer');
    if (!text) { el.hidden = true; return; }
    $('pointerText').textContent = text; el.hidden = false;
    var ed = $('editor').getBoundingClientRect(), r = target.getBoundingClientRect();
    el.style.left = Math.max(8, Math.round(r.left - ed.left)) + 'px';
    el.style.top = Math.max(8, Math.round(r.top - ed.top - el.offsetHeight - 10)) + 'px';
  }

  function init() {
    $('bPlay').addEventListener('click', togglePlay);
    $('inspClose').addEventListener('click', function () { closeInspector(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('inspector').classList.contains('open')) closeInspector();
    });
    $('gamebody').addEventListener('pointerdown', function () { Runner.focusGame(); });
    window.addEventListener('blur', function () { setTimeout(hint, 0); });
    window.addEventListener('focus', function () { setTimeout(hint, 0); });
    document.addEventListener('focusin', function () { setTimeout(hint, 0); });
    UI.onMute(function (m) { Runner.mute(m); });
    paintPlay();
  }

  function setProjectName(name) {
    $('projText').textContent = name;
    $('gameOf').textContent = name;
  }
  function stars(n) {
    $('starCount').textContent = n + (n === 1 ? ' star' : ' stars');
  }
  function cards(list) {
    $('cardChip').textContent = list.length ? list.length + (list.length === 1 ? ' card: ' : ' cards, newest: ') + list[list.length - 1] : 'no cards yet';
  }

  return { init: init, on: on, openDock: openDock, reveal: reveal, tree: tree, allow: allow, select: select,
           inspect: inspect, closeInspector: closeInspector, set: set, togglePlay: togglePlay, cue: cue, point: point,
           paintPlay: paintPlay, setProjectName: setProjectName, stars: stars, cards: cards,
           selected: function () { return selected; } };
})();
