/* chat.js: the conversation, in the right-hand dock.

   It should feel like a chat, not a form (Jay, 2026-09-28). So:
   - The history scrolls like a messaging app. What a character says in a row is ONE bubble, a
     paragraph per line, not a stack of bubbles. Earlier lines stay, a step quieter, so an
     instruction never vanishes when the story moves on.
   - A character "types" before speaking: a short dots bubble, longer for more words.
   - When the story needs the kid to choose, the choices come as ONE QUESTION CARD above the text
     box, the way Claude Code asks a multiple-choice question: the question, numbered answers, and
     a tap, a number key, or the arrow keys and Enter to pick. Not a row of bubbles.
   - Typing is never required and always allowed. Anything typed goes to the mentor with the
     question on screen: it can be the kid's own answer (the mentor picks the answer they meant), a
     question, or a request to change the game (the mentor does it). A step can also ask for
     something typed itself (a name, a description), and then it takes the line.
   - While the mentor works on a typed message, its bubble shows a turning wheel and a line that
     changes every couple of seconds, as the old app's chat did (js/ai.js, "the waiting message"):
     a ten-year-old can't tell a slow answer from a broken one without it.
   - Every new line is read out once by the one screen-reader announcer.

   Speakers: 'm' mentor, 'p' lead programmer, 'a' art director, 'u' sound designer, 'd' lead
   designer, 'k' the kid. */
var Chat = (function () {
  var WHO = {
    m: ['Mentor', 'The studio’s AI, and proud of it'],
    p: ['Lead programmer', 'Engineering department'],
    a: ['Art director', 'Art department'],
    u: ['Sound designer', 'Audio department'],
    d: ['Lead designer', 'Design department']
  };
  var KEEP = 50;
  var log, card, input, send, announcer;
  var queue = [], busy = false, pendingQ = null, question = null, expecting = null, askHandler = null;
  var kidName = 'new developer', kidLabel = 'You', history = [];

  function $(id) { return document.getElementById(id); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function init() {
    log = $('log'); card = $('qcard'); input = $('say'); send = $('sendBtn'); announcer = $('announce');
    $('sayForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (send.disabled) return;
      var text = input.value.trim().slice(0, 200);
      if (!text) return;
      input.value = '';
      if (!expecting) stopExpecting();   // a prompt() placeholder lasts one message
      typed(text);
    });
    card.addEventListener('keydown', cardKeys);
    stopExpecting();
  }

  function setKid(n) { kidName = n || 'new developer'; kidLabel = n || 'You'; }
  function speaker(kind) {
    var w = WHO[kind] || WHO.m;
    $('whoTab').textContent = w[0]; $('whoName').textContent = w[0]; $('whoRole').textContent = w[1];
    $('face').setAttribute('data-who', kind || 'm');
  }
  function fill(text) { return String(text).replace(/@name/g, kidName); }
  function scroll() { requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; }); }

  /* What was said before steps back a shade. The kid's own latest line stays bright with the reply. */
  function quieten() {
    var last = log.lastElementChild, keep = last && last.getAttribute('data-from') === 'k' ? last : null;
    Array.prototype.forEach.call(log.querySelectorAll('.msg p:not(.old)'), function (p) {
      if (keep && keep.contains(p)) return;
      p.classList.add('old');
    });
  }

  /* One line into the log. A line from whoever spoke last joins their bubble as a new paragraph. */
  function bubbleFor(who) {
    var last = log.lastElementChild;
    if (last && last.classList.contains('msg') && last.getAttribute('data-from') === who) return last;
    var b = document.createElement('div');
    b.className = 'msg' + (who === 'k' ? ' kid' : who === 'm' ? '' : ' guest');
    b.setAttribute('data-from', who);
    var f = document.createElement('span'); f.className = 'from';
    f.textContent = who === 'k' ? kidLabel : (WHO[who] || WHO.m)[0];
    b.appendChild(f);
    log.appendChild(b);
    return b;
  }
  function line(who, text) {
    var b = bubbleFor(who);
    var p = document.createElement('p'); p.className = 'in'; p.textContent = fill(text);
    b.appendChild(p);
    while (log.children.length > KEEP) log.removeChild(log.firstElementChild);
    history.push({ role: who === 'k' ? 'user' : 'assistant', content: fill(text) });
    if (history.length > 12) history.shift();
    if (who !== 'k') announcer.textContent = fill(text);
    scroll();
  }

  function dots() {
    var d = document.createElement('div'); d.className = 'typing'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<i></i><i></i><i></i>';
    log.appendChild(d); scroll();
    return d;
  }

  /* The mentor working on something the kid typed: a turning wheel and a line that changes. The
     words are the studio's guess at the shape of the work, not the model narrating itself. */
  var WORKING = ['Thinking…', 'Reading what you wrote…', 'Looking at your game…', 'Checking what’s on screen…', 'Working out what you meant…'];
  function thinking() {
    var w = document.createElement('div'); w.className = 'msg thinking'; w.setAttribute('role', 'status');
    w.innerHTML = '<span class="from">Mentor</span><p><span class="wheel" aria-hidden="true"></span><span class="w"></span></p>';
    log.appendChild(w); scroll();
    var k = 0, label = w.querySelector('.w');
    var turn = function () { label.textContent = WORKING[k % WORKING.length]; k++; };
    turn();
    var timer = setInterval(turn, 2200);
    send.disabled = true; send.classList.add('busy');
    return { done: function () { clearInterval(timer); w.remove(); send.disabled = false; send.classList.remove('busy'); } };
  }

  /* Lines are queued, each after a short "typing" beat; the kid's own lines land at once. A
     question waits until the queue is empty, so the card never sits under half a message. */
  function say(lines) {
    hideCard();
    quieten();
    /* One speaker's lines in one go are ONE paragraph, not a line each (Jay, 2026-09-28: a stream of
       one-line messages is hard to follow at 10). They arrive together after one typing beat. */
    lines.forEach(function (l) {
      var last = queue[queue.length - 1];
      if (last && last[0] === l[0] && l[0] !== 'k') last[1] = last[1] + ' ' + l[1];
      else queue.push([l[0], l[1]]);
    });
    pump();
  }
  function pump() {
    if (busy) return;
    var next = queue.shift();
    if (!next) { if (pendingQ) { var q = pendingQ; pendingQ = null; showCard(q); } return; }
    if (next[0] === 'k') { line('k', next[1]); pump(); return; }
    busy = true;
    var wait = reduced() ? 120 : Math.min(1100, 450 + String(next[1]).length * 4);   // snappy, but long enough to see someone is typing
    var d = dots();
    setTimeout(function () { d.remove(); line(next[0], next[1]); busy = false; pump(); }, wait);
  }
  function settled() { return !busy && !queue.length; }

  /* ---------- the question card ---------- */
  /* ask(text, [{ text, sub, run, echo }], { who }). Answers are shuffled every time, so the right one
     is never always first; `keepOrder` for lists where order is the point. */
  function ask(text, list, opts) {
    opts = opts || {};
    var options = (list || []).slice();
    if (!opts.keepOrder) shuffle(options);
    var q = { text: text, who: opts.who || 'm', options: options };
    question = q;
    if (!settled()) { pendingQ = q; return; }
    showCard(q);
  }
  function shuffle(a) {
    for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; }
    return a;
  }
  function showCard(q) {
    var a = document.activeElement;
    var wasHere = card.contains(a) || a === document.body || a === input || (log && log.contains(a));
    card.innerHTML = '';
    var h = document.createElement('p'); h.className = 'q'; h.id = 'qText'; h.textContent = fill(q.text);
    card.appendChild(h);
    var ol = document.createElement('ol'); ol.setAttribute('aria-labelledby', 'qText');
    q.options.forEach(function (o, n) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'qopt'; b.setAttribute('data-key', 'q:' + n);
      b.innerHTML = '<span class="n" aria-hidden="true">' + (n + 1) + '</span><span class="t"></span><svg class="i go" aria-hidden="true"><use href="#i-send"/></svg>';
      b.querySelector('.t').textContent = o.text;
      if (o.sub) { var s = document.createElement('small'); s.textContent = o.sub; b.querySelector('.t').appendChild(s); }
      b.addEventListener('click', function () { pick(n); });
      b.addEventListener('focus', function () { mark(n); });
      b.addEventListener('mouseenter', function () { mark(n); });
      li.appendChild(b); ol.appendChild(li);
    });
    card.appendChild(ol);
    var hint = document.createElement('p'); hint.className = 'hint';
    hint.textContent = q.options.length > 1 ? 'Tap an answer, or press its number · or type your own below' : 'Tap it, or press Enter · or type below';
    card.appendChild(hint);
    card.hidden = false;
    mark(0);
    if (wasHere && !Runner.isPlaying()) card.querySelector('.qopt').focus({ preventScroll: true });
    announcer.textContent = fill(q.text);
    scroll();
  }
  function mark(n) {
    Array.prototype.forEach.call(card.querySelectorAll('.qopt'), function (b, k) { b.classList.toggle('on', k === n); });
  }
  function cardKeys(e) {
    var bs = Array.prototype.slice.call(card.querySelectorAll('.qopt'));
    if (!bs.length) return;
    var at = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      bs[at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
      return;
    }
    var d = parseInt(e.key, 10);
    if (d >= 1 && d <= bs.length) { e.preventDefault(); pick(d - 1); }
  }
  function hideCard() { card.hidden = true; card.innerHTML = ''; pendingQ = null; }

  /* An answer, tapped or chosen by the mentor from what the kid typed. The question goes into the
     log as the asker's line and the answer as the kid's, so the history reads as a conversation. */
  function pick(n, typedAlready) {
    var q = question; if (!q || !q.options[n]) return;
    var o = q.options[n];
    question = null; hideCard();
    if (!typedAlready) {
      quieten();
      line(q.who, q.text);
      if (o.echo !== false) line('k', o.echo || o.text);
    }
    o.run();
  }
  function choose(n) { pick(n - 1, true); }

  /* The step asked for something typed (a name, a description): the next line typed is that. */
  function expect(placeholder, fn) { expecting = fn; input.placeholder = placeholder; hideCard(); question = null; input.focus(); }
  /* Menus that start a conversation (GameObject › Add a part…, Help › Ask the mentor) put the
     cursor in the box with a hint of what to type; what's typed goes the usual way. */
  function prompt(placeholder) { if (placeholder) input.placeholder = placeholder; input.focus(); }
  function stopExpecting() { expecting = null; input.placeholder = 'Answer, ask a question, or tell the mentor what to do…'; }
  function onAsk(fn) { askHandler = fn; }

  function typed(text) {
    quieten();
    line('k', text);
    if (expecting) { var fn = expecting; stopExpecting(); fn(text); return; }
    if (askHandler) askHandler(text, question);
  }

  /* The question on screen goes away while the mentor answers something typed, and comes back
     after unless the answer moved the story on. */
  function reask() { if (question) { if (settled()) showCard(question); else pendingQ = question; } }
  function clear() { hideCard(); question = null; }

  return { init: init, say: say, ask: ask, choose: choose, clear: clear, reask: reask, expect: expect, prompt: prompt,
           stopExpecting: stopExpecting, onAsk: onAsk, speaker: speaker, setKid: setKid, settled: settled,
           thinking: thinking, hide: hideCard, question: function () { return question; },
           history: function () { return history.slice(); }, WHO: WHO };
})();
