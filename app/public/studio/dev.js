/* dev.js: the dev panel, for whoever is building the course (docs/rework/v2-spec.md §3.5).

   Localhost only. The server answers 404 for this file on a real deployment (server.js, next to
   the static hosting), so a kid never gets it, not merely never sees it. Ctrl+Shift+D opens it.

   It shows where the quest engine is and what it knows, and lets you move it: skip a beat, jump to
   any quest, fire a game event without playing, and start over. "Always start fresh" makes every
   reload a new kid, so a test never resumes a stuck state by accident. */
(function () {
  if (!window.Quest || !Quest.dev) return;
  var el = document.createElement('div');
  el.className = 'devpanel'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Dev panel');
  el.innerHTML = '<div class="dh"><b>Dev panel</b><span>localhost only · Ctrl+Shift+D</span><button type="button" data-a="close" aria-label="Close">×</button></div>'
    + '<p class="where"></p>'
    + '<div class="row"><button type="button" data-a="skip">Skip beat</button><select id="devQuest" aria-label="Quest"></select><button type="button" data-a="jump">Jump</button></div>'
    + '<div class="row"><select id="devEvent" aria-label="Event"><option>fell</option><option>coin</option><option>lava</option><option>hurt</option><option>crossed</option><option>cleared</option><option value="stop">(stop)</option><option value="reverted">(reverted)</option></select><button type="button" data-a="fire">Fire event</button></div>'
    + '<div class="row"><button type="button" data-a="reset">Start over</button><label><input type="checkbox" id="devFresh"> Always start fresh</label></div>'
    + '<pre class="state"></pre>';
  document.body.appendChild(el);
  var $ = function (s) { return el.querySelector(s); };

  function paint() {
    if (el.hidden) return;
    var S = Quest.dev.state(), C = Quest.dev.course();
    $('.where').textContent = Quest.dev.where();
    var sel = $('#devQuest');
    if (C && sel.options.length !== Object.keys(C.quests).length) sel.innerHTML = Object.keys(C.quests).map(function (q) { return '<option>' + q + '</option>'; }).join('');
    $('.state').textContent = S ? JSON.stringify({ stack: S.stack.map(function (f) { return f.quest + '#' + f.beat + (Object.keys(f.flags).length ? ' ' + JSON.stringify(f.flags) : ''); }),
      tickets: S.tickets, stars: S.stars, cards: S.cards, taught: S.taught }, null, 1) : '(not started)';
  }
  Quest.dev.onPaint(paint);
  try { $('#devFresh').checked = localStorage.getItem('studio.fresh') === '1'; } catch (e) {}
  $('#devFresh').addEventListener('change', function () { try { localStorage.setItem('studio.fresh', this.checked ? '1' : '0'); } catch (e) {} });
  el.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) return;
    if (a === 'close') el.hidden = true;
    if (a === 'skip') Quest.dev.skip();
    if (a === 'jump') Quest.dev.jump($('#devQuest').value, 0);
    if (a === 'fire') { var v = $('#devEvent').value; Quest.dev.fire(v === 'stop' || v === 'reverted' ? { type: v } : { type: 'event', name: v }); }
    // the server's copy too, or the next load would adopt it straight back (save.js)
    if (a === 'reset') { Project.reset(); fetch('/api/state', { method: 'DELETE' }).catch(function () {}).then(function () { location.reload(); }); }
    paint();
  });
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); el.hidden = !el.hidden; paint(); }
  });
})();
