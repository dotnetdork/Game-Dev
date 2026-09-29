/* ui.js: the pieces that must behave the same everywhere in the studio. Ported from the wireframes'
   shared script (docs/rework/wireframes/src/ui.js), where the rules below were settled.

   1. UI SOUNDS, for a room of about 20 kids. A sound only when the kid CAUSED A CHANGE (Play and
      Stop, a step passed, a wrong answer, a card or tool earned, being hired); routine taps are
      silent, because twenty trackpads clicking at once is noise. Quiet (gain 0.15-0.35), short
      (Kenney CC0, all under a second), never two within 250ms. One Sound switch mutes these AND the
      game; the game's pops still show. Here the files are fetched from /assets rather than inlined.
   2. keepFocus(): a rebuild with innerHTML drops keyboard focus to <body>; run it inside keepFocus
      and focus returns to the control with the same data-key.
   3. feel(): a small visual answer on what the kid acted on: a pulse on success, one shake on
      "not yet". Off under prefers-reduced-motion; the words still carry it.
   4. TOOLTIPS: every control with data-tip gets one (spec §3.3: "every button has an icon, a word
      and a tooltip"). One tooltip element for the page. It shows after a short rest on hover, at
      once on keyboard focus, and goes on a press, Escape or leaving. It is extra, never the only
      place a thing is said: the button's own word or aria-label already names it. */
var UI = (function () {
  var FILES = { play: 'sfx-select.ogg', stop: 'sfx-back.ogg', good: 'sfx-confirm.ogg', nope: 'sfx-lowrandom.ogg',
                card: 'sfx-powerup2.ogg', tool: 'platformer/sfx_magic.ogg', hired: 'sfx-threetone2.ogg' };
  var GAIN = { play: 0.2, stop: 0.18, good: 0.3, nope: 0.2, card: 0.3, tool: 0.32, hired: 0.35 };
  var AC = null, buf = {}, last = 0, muted = false, onMute = [];
  try { muted = localStorage.getItem('studio.sound') === 'off'; } catch (e) {}

  function ctx() {
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function sound(id) {
    if (muted || !FILES[id]) return;
    var t = Date.now(); if (t - last < 250) return; last = t;
    var ac = ctx(); if (!ac) return;
    var go = function () {
      var s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = GAIN[id] || 0.25;
      s.buffer = buf[id]; s.connect(g); g.connect(ac.destination); s.start();
    };
    if (buf[id]) { go(); return; }
    fetch('/assets/' + FILES[id]).then(function (r) { return r.arrayBuffer(); })
      .then(function (a) { return new Promise(function (ok, no) { ac.decodeAudioData(a, ok, no); }); })
      .then(function (b) { buf[id] = b; go(); }).catch(function () {});
  }
  function paint() {
    var b = document.getElementById('bSound'); if (!b) return;
    b.setAttribute('aria-pressed', String(!muted));
    b.querySelector('use').setAttribute('href', muted ? '#i-sound-off' : '#i-sound');
    b.querySelector('span').textContent = muted ? 'Sound off' : 'Sound on';
  }
  function init() {
    var b = document.getElementById('bSound'); if (!b) return;
    b.addEventListener('click', function () {
      muted = !muted;
      try { localStorage.setItem('studio.sound', muted ? 'off' : 'on'); } catch (e) {}
      paint(); onMute.forEach(function (fn) { fn(muted); });
    });
    paint();
  }
  function keepFocus(box, rebuild) {
    var a = document.activeElement, key = a && box && box.contains(a) && a.getAttribute ? a.getAttribute('data-key') : null;
    rebuild();
    if (key) { var el = box.querySelector('[data-key="' + key.replace(/"/g, '') + '"]'); if (el) el.focus({ preventScroll: true }); }
  }
  function feel(el, kind) {
    if (!el || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    el.classList.remove('feel-good', 'feel-nope'); void el.offsetWidth; el.classList.add(kind === 'nope' ? 'feel-nope' : 'feel-good');
  }
  /* ---------- tooltips ---------- */
  var tip = null, tipFor = null, tipTimer = null;
  function tipEl() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(el) {
    var text = el.getAttribute('data-tip'); if (!text) return;
    var t = tipEl(); t.textContent = text; t.hidden = false; tipFor = el;
    el.setAttribute('aria-describedby', 'tip');
    var r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth;
    var below = r.bottom + 8 + h < window.innerHeight;
    t.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2))) + 'px';
    t.style.top = Math.round(below ? r.bottom + 8 : r.top - h - 8) + 'px';
  }
  function hideTip() {
    clearTimeout(tipTimer);
    if (tipFor) tipFor.removeAttribute('aria-describedby');
    tipFor = null; if (tip) tip.hidden = true;
  }
  function tipTarget(e) { return e.target && e.target.closest ? e.target.closest('[data-tip]') : null; }
  document.addEventListener('pointerover', function (e) {
    var el = tipTarget(e); if (el === tipFor) return;
    hideTip(); if (!el || e.pointerType === 'touch') return;
    tipTimer = setTimeout(function () { showTip(el); }, 450);
  });
  document.addEventListener('pointerout', function (e) { var el = tipTarget(e); if (el && !el.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('focusin', function (e) {
    var el = tipTarget(e); hideTip();
    if (el && el.matches(':focus-visible')) showTip(el);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tipFor) hideTip(); }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { sound: sound, muted: function () { return muted; }, onMute: function (fn) { onMute.push(fn); },
           keepFocus: keepFocus, feel: feel, hideTip: hideTip };
})();
