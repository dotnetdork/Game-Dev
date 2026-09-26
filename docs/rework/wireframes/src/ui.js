/* ui.js: shared by every wireframe, inlined by build.js before each template's own script.
   It holds the pieces that must behave the same in every shift, so a kid's muscle memory is not
   trained on five slightly different versions (critique 2026-09-26, P1 "same patterns behave
   differently").

   1. UI SOUNDS, for a room of about 20 kids. The rules:
      - A sound only when the kid CAUSED A CHANGE: a step passed, a card or tool earned, a wrong
        answer, Play and Stop, being hired. Routine taps (a Hierarchy row, a slider, an answer) are
        silent: twenty trackpads clicking at once is noise, not feedback.
      - Quiet (gain 0.15–0.35), short (Kenney CC0 interface sounds, all under a second), and never two
        within 250ms, so a burst of events plays once.
      - One switch, "Sound", in the toolbar, mutes everything: these and the game's own sounds. The
        visual pops still show, so a muted Chromebook loses nothing. The choice is remembered on this
        browser.
   2. keepFocus(): rebuilding a list with innerHTML drops keyboard focus to <body>. Run the rebuild
      inside keepFocus and focus goes back to the same control, found by its data-key.
   3. feel(): a small visual answer on the element the kid acted on (a tick pulse on success, a
      short shake on "not yet"). Off under prefers-reduced-motion; the words still carry it. */
var UI = (function () {
  var DATA = {{UISFX}};
  var GAIN = { play: 0.2, stop: 0.18, good: 0.3, nope: 0.2, card: 0.3, tool: 0.32, hired: 0.35 };
  var AC = null, buf = {}, last = 0, muted = false;
  try { muted = localStorage.getItem('wfSound') === 'off'; } catch (e) {}
  function ctx() {
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function sound(id) {
    if (muted || !DATA[id]) return;
    var t = Date.now(); if (t - last < 250) return; last = t;
    var ac = ctx(); if (!ac) return;
    var go = function () { var s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = GAIN[id] || 0.25;
      s.buffer = buf[id]; s.connect(g); g.connect(ac.destination); s.start(); };
    if (buf[id]) { go(); return; }
    try { var bin = atob(DATA[id]), bytes = new Uint8Array(bin.length); for (var k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      ac.decodeAudioData(bytes.buffer, function (b) { buf[id] = b; go(); }, function () {}); } catch (e) {}
  }
  function paint() {
    var b = document.getElementById('bSound'); if (!b) return;
    b.setAttribute('aria-pressed', String(!muted));
    b.querySelector('use').setAttribute('href', muted ? '#i-sound-off' : '#i-sound');
    b.querySelector('span').textContent = muted ? 'Sound off' : 'Sound on';
  }
  function init() {
    var b = document.getElementById('bSound'); if (!b) return;
    b.addEventListener('click', function () { muted = !muted; try { localStorage.setItem('wfSound', muted ? 'off' : 'on'); } catch (e) {} paint(); });
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { sound: sound, muted: function () { return muted; }, keepFocus: keepFocus, feel: feel };
})();
