/* chat.js: the conversation, in the right-hand dock, and the Console beside the Project window.

   It should feel like a chat, not a form (Jay, 2026-09-28). Two playthroughs settled the rest:
   - ONE CONVERSATION, ONE CHARACTER AT A TIME (Jay, 2026-09-29, which undid a tab per character:
     "Multiple chats is just confusing"). Whoever the story is with talks here, under their name,
     icon and colour in the header. When the story moves to someone else, their predecessor's last
     line is left up for a moment, then the chat clears and a row says who the kid is talking to
     now. The hand-over is queued behind the lines still being said, so nobody is cut off. Each
     character has an identity colour and a Lucide icon (decisions R3 and R4 in
     docs/rework/v2-review-2026-09-28.md §9): the colour is on the header, the edge of their
     bubbles and their question card, and NEVER on a button or a focus ring, so orange still means
     "the thing to do next".
   - THE KID ALWAYS KNOWS WHAT'S WANTED (Jay, 2026-09-29: "There is no way for them to know whats
     happening or what the AI wants their answer to be"). Two things answer that. The TASK line
     under the header says what this step wants, in a sentence, with a Hint button when the step
     has hints (quest.js sets it). And every question, typed or tapped, comes as a QUESTION CARD
     above the text box: the question, numbered answers, and, when typing is welcome, a line saying
     they can type their own instead. A typed step's answers are examples of the shape of an answer
     ("a dragon", "a robot"), never the answer the step is teaching.
   - GAME EVENTS ARE NOT SPEECH. What the game did ("Play started", "Ticket filed") is a thin row
     with an icon, not a bubble, and it also goes to the Console, where every event is kept with its
     time. The same event again, straight after, is the same row with a count ("×4"), not a new row:
     falling off the level ten times read as spam.
   - ONE IDEA PER BUBBLE (review §4, rule 4). Lines are never joined into one long paragraph; a run
     of lines from one speaker is grouped the way a messaging app groups them, with the name once.
   - A character "types" before speaking: a short dots bubble, longer for more words, never long.
   - The card: a tap, a number key, or the arrow keys and Enter to pick. Nothing on it is lit until
     the kid points at it or moves to it (the first build lit option 1, which read as "already
     chosen").
   - Typing is never required and always allowed. What's typed goes to whoever is talking, with the
     question on screen: it can be the kid's own answer, a question, or a request to change the
     game. A step can also ask for something typed itself (a name, a description, a finding), and
     then it takes the line.
   - While a character works on a typed message, its bubble shows a turning wheel and a line that
     changes every couple of seconds, as the old app's chat did (js/ai.js, "the waiting message"):
     a ten-year-old can't tell a slow answer from a broken one without it.
   - Text in the log can't be dragged. Jay's playthrough sent the chat's own words as his message:
     a drag of selected text drops into the box below as typing.
   - SCREEN READERS hear each line once. The log is the live region (role="log"); #announce is only
     for what isn't in it: a question card appearing, a new task, a hand-over.

   Speakers: 'm' mentor, 'p' lead programmer, 'a' art director, 'u' sound designer, 'd' lead
   designer, 'r' the Studio Director, 'k' the kid. The table below is the one place a character's
   name, job, colour and icon are written; quest.js maps the quest files' character ids onto these
   letters. */
var Chat = (function () {
  /* name, what they do (the header's second line), icon symbol in index.html. The colour is CSS
     (studio.css, --c-* on :root), keyed by the same letter, because it is a design token. */
  var WHO = {
    m: ['Mentor', 'The studio’s AI', 'i-bot'],
    p: ['Lead programmer', 'Engineering', 'i-code'],
    a: ['Art director', 'Art', 'i-palette'],
    u: ['Sound designer', 'Audio', 'i-wave'],
    d: ['Lead designer', 'Design', 'i-puzzle'],
    r: ['Studio Director', 'Runs the studio', 'i-clapper']   // the interview's host, back at the end of a day
  };
  var KEEP = 80;
  var box, card, input, send, announcer, consoleList, taskEl;
  var active = null, history = [];
  var queue = [], busy = false, pendingQ = null, question = null, expecting = null, askHandler = null, hintHandler = null;
  var kidName = 'new developer', kidLabel = 'You';
  var t0 = Date.now();

  function $(id) { return document.getElementById(id); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function who(k) { return WHO[k] || WHO.m; }

  function init() {
    box = $('log'); card = $('qcard'); input = $('say'); send = $('sendBtn');
    announcer = $('announce'); consoleList = $('consoleList'); taskEl = $('task');
    $('sayForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (send.disabled) return;
      var text = input.value.trim().slice(0, 200);
      if (!text) return;
      input.value = '';
      typed(text);
    });
    card.addEventListener('keydown', cardKeys);
    box.addEventListener('dragstart', function (e) { e.preventDefault(); });
    var hb = $('taskHint');
    if (hb) hb.addEventListener('click', function () { if (hintHandler) hintHandler(); });
    header('m'); active = 'm';
  }

  function setKid(n) { kidName = n || 'new developer'; kidLabel = n || 'You'; }
  function fill(text) { return String(text).replace(/@name/g, kidName); }

  /* ---------- who's talking ---------- */
  function header(k) {
    var w = who(k);
    $('dMentor').setAttribute('data-who', k);
    $('whoName').textContent = w[0]; $('whoRole').textContent = w[1];
    $('face').querySelector('use').setAttribute('href', '#' + w[2]);
    placeholder();
  }
  /* The story moved to another character. Queued, so the last lines finish first; then a short
     beat to read them, the chat clears, and the new character's conversation starts. */
  function speaker(kind) {
    var k = WHO[kind] ? kind : 'm';
    var last = queue.filter(function (x) { return x[0] === '@to'; }).pop();
    if ((last ? last[1] : active) === k) return;
    queue.push(['@to', k]);
    pump();
  }
  function handover(k, then) {
    var was = active;
    active = k; history = [];
    var go = function () {
      box.innerHTML = '';
      header(k);
      var r = document.createElement('div'); r.className = 'handoff'; r.setAttribute('data-who', k);
      r.innerHTML = '<span class="face" aria-hidden="true"><svg class="i"><use href="#' + who(k)[2] + '"/></svg></span><span></span>';
      r.querySelector('span:last-child').textContent = 'You’re talking to the ' + (k === 'm' ? 'Mentor' : who(k)[0].toLowerCase()) + ' now';
      box.appendChild(r);
      announcer.textContent = who(k)[0] + ' is talking to you now';
      then();
    };
    // the first speaker of a session, or a chat with nothing in it yet: no pause
    if (!was || !box.querySelector('.msg')) return go();
    box.classList.add('leaving');
    setTimeout(function () { box.classList.remove('leaving'); go(); }, reduced() ? 60 : 1100);
  }
  function scroll() { requestAnimationFrame(function () { box.scrollTop = box.scrollHeight; }); }
  function trim() { while (box.children.length > KEEP) box.removeChild(box.firstElementChild); }

  /* ---------- the task: what this step wants ---------- */
  /* task(text, { hint }) shows the line under the header; task(null) hides it. `hint` is called
     when the kid taps Hint, and the button shows only when there is one. */
  function task(text, opts) {
    if (!taskEl) return;
    opts = opts || {};
    hintHandler = opts.hint || null;
    if (!text) { taskEl.hidden = true; return; }
    var t = $('taskText'), changed = t.textContent !== fill(text);
    t.textContent = fill(text);
    $('taskHint').hidden = !hintHandler;
    taskEl.hidden = false;
    if (changed) { taskEl.classList.remove('fresh'); void taskEl.offsetWidth; taskEl.classList.add('fresh'); announcer.textContent = 'Your task: ' + fill(text); }
  }

  /* ---------- lines ---------- */
  /* What was said before steps back a shade. The kid's own latest line stays bright with the reply. */
  function quieten() {
    Array.prototype.forEach.call(box.querySelectorAll('.msg:not(.old)'), function (m) { m.classList.add('old'); });
  }
  function line(k, text) {
    var last = box.lastElementChild;
    var b = document.createElement('div');
    b.className = 'msg in' + (k === 'k' ? ' kid' : '');
    b.setAttribute('data-from', k);
    // a run of lines from one speaker is grouped: the name once, the bubbles close together
    if (!(last && last.classList.contains('msg') && last.getAttribute('data-from') === k)) {
      var f = document.createElement('span'); f.className = 'from';
      f.textContent = k === 'k' ? kidLabel : who(k)[0];
      b.appendChild(f);
    } else b.classList.add('more');
    var p = document.createElement('p'); p.textContent = fill(text);
    b.appendChild(p);
    box.appendChild(b); trim();
    history.push({ role: k === 'k' ? 'user' : 'assistant', content: (k === 'k' || k === active ? '' : who(k)[0] + ': ') + fill(text) });
    if (history.length > 16) history.shift();
    scroll();
  }

  /* A game event, as a row rather than a bubble, in the chat and in the Console. `quiet` rows skip
     the Console (they are about the chat, not the game); `consoleOnly` ones skip the chat. The same
     row again, straight after, counts up instead. */
  function stamp() { var s = Math.floor((Date.now() - t0) / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function again(row, sel) {
    var n = (+row.getAttribute('data-n') || 1) + 1;
    row.setAttribute('data-n', String(n));
    var c = row.querySelector(sel);
    if (!c) { c = document.createElement('b'); c.className = 'times'; row.appendChild(c); }
    c.textContent = '×' + n;
  }
  function event(text, icon, opts) {
    opts = opts || {};
    var ic = icon || 'i-pad', when = stamp(), words = fill(text);
    if (!opts.consoleOnly) {
      var last = box.lastElementChild;
      if (last && last.classList.contains('evt') && last.getAttribute('data-text') === words) again(last, '.times');
      else {
        var r = document.createElement('div'); r.className = 'evt' + (opts.kind ? ' ' + opts.kind : '');
        r.setAttribute('data-text', words);
        r.innerHTML = '<svg class="i" aria-hidden="true"><use href="#' + ic + '"/></svg><span></span>';
        r.querySelector('span').textContent = words;
        box.appendChild(r); trim();
      }
      scroll();
    }
    if (!opts.quiet && consoleList) {
      var lc = consoleList.lastElementChild;
      if (lc && lc.getAttribute('data-text') === words) { again(lc, '.times'); lc.querySelector('time').textContent = when; }
      else {
        var li = document.createElement('li'); li.className = 'crow' + (opts.kind ? ' ' + opts.kind : '');
        li.setAttribute('data-text', words);
        li.innerHTML = '<time></time><svg class="i" aria-hidden="true"><use href="#' + ic + '"/></svg><span></span>';
        li.querySelector('time').textContent = when; li.querySelector('span').textContent = words;
        consoleList.appendChild(li);
        while (consoleList.children.length > 200) consoleList.removeChild(consoleList.firstElementChild);
      }
      var c = consoleList.parentNode; c.scrollTop = c.scrollHeight;
      var n = $('consoleCount'); if (n) n.textContent = String(consoleList.children.length);
    }
  }

  function dots(k) {
    var d = document.createElement('div'); d.className = 'typing'; d.setAttribute('aria-hidden', 'true'); d.setAttribute('data-from', k);
    d.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(d); scroll();
    return d;
  }

  /* A character working on something the kid typed: a turning wheel and a line that changes. The
     words are the studio's guess at the shape of the work, not the model narrating itself. */
  var WORKING = ['Thinking…', 'Reading what you wrote…', 'Looking at your game…', 'Checking what’s on screen…', 'Working out what you meant…'];
  var BUILDING = ['Reading your game’s code…', 'Working out the change…', 'Writing the code…', 'Checking it runs…', 'Nearly there…'];
  function thinking(k, building) {
    k = k || active || 'm';
    var words = building ? BUILDING : WORKING;
    var w = document.createElement('div'); w.className = 'msg thinking'; w.setAttribute('role', 'status'); w.setAttribute('data-from', k);
    w.innerHTML = '<span class="from"></span><p><span class="wheel" aria-hidden="true"></span><span class="w"></span></p>';
    w.querySelector('.from').textContent = who(k)[0];
    box.appendChild(w); scroll();
    var n = 0, label = w.querySelector('.w');
    var turn = function () { label.textContent = words[Math.min(n, words.length - 1)]; n++; };
    turn();
    var timer = setInterval(turn, building ? 3200 : 2200);
    send.disabled = true; send.classList.add('busy');
    return { done: function () { clearInterval(timer); w.remove(); send.disabled = false; send.classList.remove('busy'); } };
  }

  /* Lines are queued, each after a short "typing" beat; the kid's own lines land at once. A
     question waits until the queue is empty, so the card never sits under half a message. */
  function say(lines) {
    hideCard(true);
    lines.forEach(function (l) { if (l && l[1]) queue.push([l[0], l[1]]); });
    pump();
  }
  function pump() {
    if (busy) return;
    var next = queue.shift();
    if (!next) {
      if (!pendingQ) return;
      var q = pendingQ.typed && expecting ? (typedCard() || pendingQ) : pendingQ;   // a typed card is made fresh: its answers may have changed
      pendingQ = null; question = q; showCard(q); return;
    }
    if (next[0] === '@to') { busy = true; handover(next[1], function () { busy = false; pump(); }); return; }
    if (next[0] === 'k') { line('k', next[1]); pump(); return; }
    busy = true;
    var wait = reduced() ? 80 : Math.min(900, 320 + String(next[1]).length * 3);   // snappy, but long enough to see someone is typing
    var d = dots(next[0]);
    setTimeout(function () { d.remove(); line(next[0], next[1]); busy = false; pump(); }, wait);
  }
  function settled() { return !busy && !queue.length; }

  /* ---------- the question card ---------- */
  /* ask(text, [{ text, sub, run, echo }], { who, keepOrder, picker }). Answers are shuffled unless
     `keepOrder`, so the right one is never always first. */
  function ask(text, list, opts) {
    opts = opts || {};
    var options = (list || []).slice();
    if (!opts.keepOrder) shuffle(options);
    var q = { text: text, who: WHO[opts.who] ? opts.who : (active || 'm'), options: options, picker: opts.picker || null };
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
    var wasHere = card.contains(a) || a === document.body || (box && box.contains(a));
    card.innerHTML = '';
    card.setAttribute('data-who', q.who);
    card.classList.toggle('typed', !!q.typed);
    var h = document.createElement('p'); h.className = 'q'; h.id = 'qText'; h.textContent = fill(q.text);
    card.appendChild(h);
    if (q.options.length) {
      var ol = document.createElement('ol'); ol.setAttribute('aria-labelledby', 'qText');
      q.options.forEach(function (o, n) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.className = 'qopt'; b.setAttribute('data-key', 'q:' + n);
        b.innerHTML = '<span class="n" aria-hidden="true">' + (n + 1) + '</span><span class="t"></span><svg class="i go" aria-hidden="true"><use href="#i-send"/></svg>';
        b.querySelector('.t').textContent = o.text;
        if (o.sub) { var s = document.createElement('small'); s.textContent = o.sub; b.querySelector('.t').appendChild(s); }
        b.addEventListener('click', function () { pick(n); });
        li.appendChild(b); ol.appendChild(li);
      });
      card.appendChild(ol);
    }
    if (q.typed) {
      var t = document.createElement('p'); t.className = 'or';
      t.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-chat"/></svg><span></span>';
      t.querySelector('span').textContent = q.options.length ? 'Or type your own answer below.' : 'Type your answer below.';
      card.appendChild(t);
    }
    card.hidden = false;
    // a typed step puts the cursor in the box; a tapped one puts focus on the card (number keys and
    // arrows work there), with nothing lit until the kid moves
    if (!Runner.isPlaying()) {
      if (q.typed && (wasHere || a === input)) input.focus({ preventScroll: true });
      else if (wasHere || a === input) { card.tabIndex = -1; card.focus({ preventScroll: true }); }
    }
    announcer.textContent = fill(q.text) + ' ' + q.options.map(function (o, n) { return (n + 1) + ', ' + o.text; }).join('. ') + (q.typed ? '. Or type your own.' : '');
    scroll();
  }
  function cardKeys(e) {
    var bs = Array.prototype.slice.call(card.querySelectorAll('.qopt'));
    if (!bs.length) return;
    var at = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      bs[at < 0 ? (e.key === 'ArrowDown' ? 0 : bs.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
      return;
    }
    var d = parseInt(e.key, 10);
    if (d >= 1 && d <= bs.length) { e.preventDefault(); pick(d - 1); }
  }
  /* `keep` hides the card but keeps the question (a line is being said); otherwise it's gone too. */
  function hideCard(keep) {
    card.hidden = true; card.innerHTML = '';
    if (keep && question) pendingQ = question; else pendingQ = null;
  }

  /* An answer, tapped or chosen by the character from what the kid typed. The question goes into the
     log as the asker's line and the answer as the kid's, so the history reads as a conversation. A
     typed step's example answer is just the kid's line, as if they had typed it. */
  function pick(n, typedAlready) {
    var q = question; if (!q || !q.options[n]) return;
    var o = q.options[n];
    if (q.typed) { answer(o.say || o.text); return; }
    question = null; hideCard();
    if (!typedAlready) {
      quieten();
      line(q.who, q.text);
      if (o.echo !== false) line('k', o.echo || o.text);
    }
    o.run();
  }
  function choose(n) { pick(n - 1, true); }

  /* The step asked for something typed (a name, a description, a finding): the next line typed is
     that. `fn` returns false to say "that wasn't it, keep waiting" (it has already replied).
     `opts.card` is the question card to show with it, { text, options: [{ text, sub, say }] }, or a
     function that makes one (the findings card shrinks as tickets are filed). */
  function expect(ph, fn, opts) {
    opts = opts || {};
    expecting = { fn: fn, ph: ph, card: opts.card || null, who: opts.who || active };
    hideCard(); question = null; placeholder();
    offerCard();
    if (!Runner.isPlaying()) input.focus({ preventScroll: true });
  }
  function typedCard() {
    if (!expecting || !expecting.card) return null;
    var c = typeof expecting.card === 'function' ? expecting.card() : expecting.card;
    return c ? { text: c.text, who: expecting.who || active, options: c.options || [], typed: true } : null;
  }
  function offerCard() {
    var q = typedCard(); if (!q) return;
    question = q;
    if (settled()) showCard(q); else pendingQ = q;
  }
  function answer(text) {
    var e = expecting, q = question && question.typed && !card.hidden ? question : null;
    quieten();
    if (q) line(q.who, q.text);   // the question the card asked goes into the log, as a tapped one does
    line('k', text);
    if (!e) return;
    expecting = null; question = null; hideCard(); placeholder();
    if (e.fn(text, active) === false) { expecting = e; placeholder(); offerCard(); }
  }
  /* Menus that start a conversation (GameObject › Add a part…, Help › Ask the mentor) put the
     cursor in the box with a hint of what to type; what's typed goes the usual way. */
  function prompt(ph) { if (ph) input.placeholder = ph; input.focus(); }
  function stopExpecting() { expecting = null; placeholder(); }
  function placeholder() {
    if (!input) return;
    var to = active === 'm' || !active ? 'the Mentor' : 'the ' + who(active)[0].toLowerCase();
    input.placeholder = expecting ? expecting.ph : 'Message ' + to + '…';
    input.setAttribute('aria-label', expecting ? expecting.ph.replace(/…$/, '') : 'Type a message to ' + to);
  }
  /* The conversation so far, for the AI, as turns a model API takes: the kid's latest line left off
     (it is the message itself), a run of one side's lines as one turn, and never starting with the
     studio's side (the scripted lines come first, and an API wants the user to open). */
  function turns() {
    var h = history.slice();
    if (h.length && h[h.length - 1].role === 'user') h.pop();
    var out = [];
    h.forEach(function (m) {
      var last = out[out.length - 1];
      if (last && last.role === m.role) last.content += '\n' + m.content; else out.push({ role: m.role, content: m.content });
    });
    if (out.length && out[0].role === 'assistant') out.unshift({ role: 'user', content: '(opens the studio)' });
    return out;
  }
  function onAsk(fn) { askHandler = fn; }
  function expectingNow() { return !!expecting; }

  function typed(text) {
    if (expecting) return answer(text);
    quieten();
    line('k', text);
    if (askHandler) askHandler(text, question, active);
  }

  /* The question on screen goes away while a character answers something typed, and comes back
     after unless the answer moved the story on. */
  function reask() { if (question) { if (settled()) showCard(question); else pendingQ = question; } }
  function clear() { hideCard(); question = null; }

  return { init: init, say: say, ask: ask, choose: choose, clear: clear, reask: reask, expect: expect, prompt: prompt,
           stopExpecting: stopExpecting, onAsk: onAsk, speaker: speaker, setKid: setKid, settled: settled, task: task,
           thinking: thinking, hide: function () { hideCard(true); }, question: function () { return question; },
           event: event, expecting: expectingNow, active: function () { return active; }, pick: function (n) { pick(n); },
           send: function (t) { if (t) typed(String(t).slice(0, 240)); },
           history: turns, WHO: WHO };
})();
