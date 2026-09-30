/* chat.js: the conversation, in the right-hand dock, and the Log beside the Project window.

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
     has hints (quest.js sets it). And a question is asked the way its answer is given:
       - A QUESTION CARD, only when it is needed (spec D43; Jay, 2026-09-30): a real choice from a
         closed set (which ticket next, "Ready to build?"), a checkpoint quiz, or suggestions the kid
         asked for. It sits above the text box, drawn as Claude's is (showCard says how).
       - Anything open (what they found, their hero, their game's name, a design question) is a
         line in the chat with an example in it, and the box's placeholder says what to type. No
         card, so the kid answers in their own words (Jay, Sept 30: drop the multiple choice). Saying "idk" or tapping Hint brings up suggestions (expect). Suggestions are examples of
         the shape of an answer ("a dragon", "a robot"), never the answer the step is teaching.
   - GAME EVENTS ARE NOT SPEECH. What the game did ("Play started", "Ticket filed") goes to the Log,
     where every event is kept with its time, and not to the chat (Jay, Sept 30: "The status stuff in
     the chat should move to log"). The same event again, straight after, is the same row with a
     count ("×4"), not a new row: falling off the level ten times read as spam.
   - ONE SPEAKER, ONE MESSAGE (Jay, 2026-09-29, which replaced "one idea per bubble", review §4
     rule 4: his first-day screenshot showed the Mentor's welcome as four bubbles). The lines said
     together land as one bubble after one typing beat; lines caused by something the kid did are a
     new message. A run of messages from one speaker still shows the name once.
   - THE CHAT IS THE CONVERSATION (Jay, 2026-09-29: "I just dont think the hint should appear in
     the chat"). Four things live here and each looks like what it is:
       talk          a bubble, under the speaker's name
       instructions  what to do now ("Press Play up top"): a row with an arrow and no bubble, so it
                     reads as the step, not as chatter (a quest's `instruct`)
       events        what happened (a ticket filed, a star): a thin dashed row with an icon, below
       hints         NOT in the log at all: the Hint button opens a callout under the task line,
                     which closes on its ×, Esc, a click elsewhere, typing, or a new task
   - KEYS ARE DRAWN AS KEYS. A keyboard key in square brackets, [Space], [←], [A] or [Ctrl+Z], is
     drawn as a keycap wherever the studio shows words (a line, the task, a hint, a question). Only
     real key names count, so any other bracketed text is left as it is.
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
    c: ['Concept artist', 'Art · characters and assets', 'i-pen'],   // designs how things look: the hero first
    u: ['Sound designer', 'Audio', 'i-wave'],
    d: ['Lead designer', 'Design', 'i-puzzle'],
    r: ['Studio Director', 'Runs the studio', 'i-clapper']   // the interview's host, back at the end of a day
  };
  var KEEP = 80;
  var box, card, input, send, announcer, consoleList, taskEl;
  var active = null, history = [];
  var queue = [], busy = false, pendingQ = null, question = null, expecting = null, askHandler = null, hintHandler = null, asked = 0;
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
    if (hb) hb.addEventListener('click', hintTapped);
    $('hintX').addEventListener('click', function () { hideHint(); hb.focus(); });
    input.addEventListener('input', hideHint);
    document.addEventListener('pointerdown', function (e) {
      if ($('hintBox').hidden) return;
      if (e.target.closest && e.target.closest('#hintBox, #taskHint, [data-key="hint"]')) return;
      hideHint();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('hintBox').hidden) { hideHint(); e.stopPropagation(); }
    }, true);
    header('m'); active = 'm';
  }

  function setKid(n) { kidName = n || 'new developer'; kidLabel = n || 'You'; }
  function fill(text) { return String(text).replace(/@name/g, kidName); }

  /* Words into an element, with [Key] drawn as keycaps. Built as nodes, never as HTML: some of these
     words come from the model. */
  var KEY = /^(Space|Enter|Esc|Tab|Shift|Ctrl|Alt|Cmd|Backspace|Delete|[←→↑↓]|Left|Right|Up|Down|[A-Z0-9])$/;
  var ARROW = { Left: '←', Right: '→', Up: '↑', Down: '↓' };
  function rich(el, text) {
    el.textContent = '';
    String(text).split(/(\[[^\]\s]{1,16}\])/).forEach(function (bit) {
      var inner = /^\[(.+)\]$/.exec(bit), keys = inner && inner[1].split('+');
      if (keys && keys.every(function (k) { return KEY.test(k); })) {
        keys.forEach(function (k, n) {
          if (n) el.appendChild(document.createTextNode('+'));
          var kb = document.createElement('kbd'); kb.className = 'key'; kb.textContent = ARROW[k] || k;
          el.appendChild(kb);
        });
      } else if (bit) el.appendChild(document.createTextNode(bit));
    });
    return el;
  }

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
      tap('handover', k, who(k)[0]);
      then();
    };
    // the first speaker of a session, or a chat with nothing in it yet: no pause
    if (!was || !box.querySelector('.msg')) return go();
    /* Long enough to read the last thing said before the thread is cleared: a fixed 1.1 s swept the lead
       designer's two-line playtest answer away before a kid could read it (Sept 30). So it stays up about
       a quarter second a word (0.7 to 3 s), then fades (.log.leaving) and the new thread starts. */
    var msgs = box.querySelectorAll('.msg'), last = msgs[msgs.length - 1];
    var n = last ? last.textContent.trim().split(/\s+/).length : 0;
    setTimeout(function () {
      box.classList.add('leaving');
      setTimeout(function () { box.classList.remove('leaving'); go(); }, reduced() ? 30 : 400);
    }, reduced() ? 30 : Math.max(700, Math.min(3000, n * 250)));
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
    if (!text) { taskEl.hidden = true; hideHint(); return; }
    var t = $('taskText'), changed = t.getAttribute('data-text') !== fill(text);
    t.setAttribute('data-text', fill(text)); rich(t, fill(text));
    if (changed) hideHint();
    hintButton();
    taskEl.hidden = false;
    if (changed) tap('task', active, text);
    if (changed) { taskEl.classList.remove('fresh'); void taskEl.offsetWidth; taskEl.classList.add('fresh'); announcer.textContent = 'Your task: ' + fill(text); }
  }

  /* ---------- the hint: a callout under the task line, never a line in the log ---------- */
  /* hint(text, n, total) opens it (or swaps in the next hint); it closes on its ×, Esc, a click
     anywhere but the callout and the Hint buttons, typing in the box, or a new task. */
  function hint(text, n, total) {
    var hb = $('hintBox'); if (!hb) return;
    tap('hint', active, text, { n: n, of: total });
    rich($('hintText'), fill(text));
    $('hintN').textContent = total > 1 ? 'Hint ' + n + ' of ' + total : 'Hint';
    var was = !hb.hidden;
    hb.hidden = false;
    if (was) { hb.classList.remove('fresh'); void hb.offsetWidth; }
    hb.classList.add('fresh');
    $('taskHint').classList.remove('nudge');
    announcer.textContent = 'Hint: ' + fill(text);
  }
  function hideHint() { var hb = $('hintBox'); if (hb) hb.hidden = true; }
  /* Stuck for a while: the Hint button asks to be pressed, once. Nothing is said for them. */
  function nudge() {
    var b = $('taskHint'); if (!b || b.hidden || !$('hintBox').hidden) return;
    b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge');
  }

  /* ---------- lines ---------- */
  /* What was said before steps back a shade. The kid's own latest line stays bright with the reply. */
  function quieten() {
    Array.prototype.forEach.call(box.querySelectorAll('.msg:not(.old), .step:not(.old)'), function (m) { m.classList.add('old'); });
  }
  /* Everything the chat shows, as it is shown, for the student log (quest.js, when logging is on):
     who said it, what kind of line it is, and its words. A listener that throws is ignored. */
  var taps = [];
  function tap(kind, k, text, extra) { taps.forEach(function (fn) { try { fn(kind, k, fill(String(text || '')), extra); } catch (e) {} }); }
  function line(k, text) {
    tap(k === 'k' ? 'kid' : 'said', k, text);
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
    var p = rich(document.createElement('p'), fill(text));
    b.appendChild(p);
    box.appendChild(b); trim();
    history.push({ role: k === 'k' ? 'user' : 'assistant', content: (k === 'k' || k === active ? '' : who(k)[0] + ': ') + fill(text) });
    if (history.length > 16) history.shift();
    scroll();
  }

  /* A game event, as a row in the Log. Only a `chat` row is also in the chat, and a `quiet` one
     skips the Log (it is about the chat, not the game). The same row again, straight after, counts
     up instead. */
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
    tap('event', null, words);
    if (opts.chat) {
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
    var mine = [];
    lines.forEach(function (l) {
      if (!l || !l[1]) return;
      var last = mine[mine.length - 1];
      // one speaker's lines, said together, are one message
      if (last && !last[2] && !l[2] && last[0] === l[0] && l[0] !== 'k') last[1] += ' ' + l[1];
      else mine.push([l[0], l[1], l[2] || null]);
    });
    mine.forEach(function (l) { queue.push(l); });
    pump();
  }
  /* An instruction: what to do now, as a row that isn't a bubble (the header says why). */
  function step(k, text) {
    tap('step', k, text);
    var r = document.createElement('div'); r.className = 'step'; r.setAttribute('data-from', k);
    r.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-next"/></svg><p></p>';
    rich(r.querySelector('p'), fill(text));
    box.appendChild(r); trim();
    history.push({ role: 'assistant', content: (k === active ? '' : who(k)[0] + ': ') + fill(text) });
    if (history.length > 16) history.shift();
    scroll();
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
    var out = function () { inflight = null; if (d) d.remove(); (next[2] === 'step' ? step : line)(next[0], next[1]); busy = false; };
    var d = next[2] === 'step' ? null : dots(next[0]);
    var wait = next[2] === 'step' ? (reduced() ? 60 : 380) : reduced() ? 80 : Math.min(900, 320 + String(next[1]).length * 3);   // snappy, but long enough to see someone is typing
    inflight = { out: out, timer: setTimeout(function () { out(); pump(); }, wait) };
  }
  var inflight = null;
  /* The kid typed while a character was still "typing": what they were saying lands first, at once,
     and the kid's line after it. Otherwise the kid's line sat above the Mentor's half-said one and the
     Mentor looked like it was answering them without having listened (critique, Sept 30: "kid lines
     land above the Mentor's pending line"). A handover still waits its turn. */
  function flush() {
    if (inflight) { clearTimeout(inflight.timer); inflight.out(); }
    while (queue.length && queue[0][0] !== '@to') {
      var l = queue.shift();
      (l[2] === 'step' ? step : line)(l[0], l[1]);
    }
    if (queue.length) setTimeout(pump, 0);   // after the kid's line, which the caller adds now
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
  /* Drawn the way Claude's own question card is (Jay, 2026-09-30, with a screenshot): the question on
     a title row; each answer a row with its label in bold, a line saying what it means under it, and
     its key number on the right; a last row, "Something else", that is a text box of its own; and a
     footer with Skip (only when the question may be skipped) and Send. While a card is up it IS the
     place to type: the chat's own box steps aside, so there is one way to answer, not two. */
  function showCard(q) {
    tap('card', q.who || active, q.text, { options: (q.options || []).map(function (o) { return o.text; }), typed: !!q.typed });
    var a = document.activeElement;
    var wasHere = card.contains(a) || a === document.body || (box && box.contains(a)) || a === input;
    card.innerHTML = '';
    card.setAttribute('data-who', q.who);
    card.classList.toggle('typed', !!q.typed);
    var h = rich(document.createElement('p'), fill(q.text)); h.className = 'q'; h.id = 'qText';
    // Skip only where the question may be skipped (the suggestions: the question itself stays open).
    // It sits on the title row: a footer of its own fell below the fold of a short chat dock.
    var head = document.createElement('div'); head.className = 'qhead'; head.appendChild(h);
    if (q.skip) {
      var sk = document.createElement('button'); sk.type = 'button'; sk.className = 'tbtn quiet'; sk.id = 'qSkip'; sk.textContent = 'Skip';
      sk.addEventListener('click', function () { var f = q.skip; question = null; hideCard(); f(); });
      head.appendChild(sk);
    }
    card.appendChild(head);
    var ol = document.createElement('ol'); ol.setAttribute('aria-labelledby', 'qText');
    q.options.forEach(function (o, n) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'qopt'; b.setAttribute('data-key', 'q:' + n);
      b.innerHTML = '<span class="t"><b></b></span><kbd class="n" aria-hidden="true">' + (n + 1) + '</kbd>';
      rich(b.querySelector('b'), o.text);
      if (o.sub) { var s = document.createElement('small'); s.textContent = o.sub; b.querySelector('.t').appendChild(s); }
      b.addEventListener('click', function () { pick(n); });
      li.appendChild(b); ol.appendChild(li);
    });
    // "Something else": typing here answers, as the chat box would (a typed step takes it as the
    // answer; any other question passes it to whoever is talking, with the question on screen)
    var oli = document.createElement('li'), row = document.createElement('label');
    row.className = 'qopt qother'; row.htmlFor = 'qOther';
    row.innerHTML = '<span class="t"><b>Something else</b><span class="qin"><input id="qOther" type="text" autocomplete="off" maxlength="200">'
      + '<button type="button" class="send" id="qSend" disabled aria-label="Send" data-tip="Send (Enter)"><svg class="i" aria-hidden="true"><use href="#i-send"/></svg></button></span></span>'
      + '<kbd class="n" aria-hidden="true">' + (q.options.length + 1) + '</kbd>';
    var other = row.querySelector('input'), go = row.querySelector('#qSend');
    other.placeholder = q.typed ? 'Type your own answer…' : 'Type something else…';
    other.setAttribute('aria-label', 'Something else: type your own answer');
    go.addEventListener('click', function (e) { e.preventDefault(); sendOther(); });
    oli.appendChild(row); ol.appendChild(oli);
    card.appendChild(ol);
    other.addEventListener('input', function () { go.disabled = !other.value.trim(); });
    other.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendOther(); }
      e.stopPropagation();   // digits and arrows are typing here, not picking
    });
    card.hidden = false;
    $('sayForm').hidden = true;
    // focus on the card (number keys and arrows work there), with nothing lit until the kid moves
    if (!Runner.isPlaying() && wasHere) { card.tabIndex = -1; card.focus({ preventScroll: true }); }
    announcer.textContent = fill(q.text) + ' ' + q.options.map(function (o, n) { return (n + 1) + ', ' + o.text; }).join('. ') + '. Or type something else.';
    scroll();
  }
  function sendOther() {
    var f = card.querySelector('#qOther'); if (!f) return;
    var text = f.value.trim().slice(0, 200); if (!text) return;
    typed(text);
  }
  function cardKeys(e) {
    var bs = Array.prototype.slice.call(card.querySelectorAll('button.qopt'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var all = bs.concat([card.querySelector('#qOther')]), i = all.indexOf(document.activeElement);
      all[i < 0 ? (e.key === 'ArrowDown' ? 0 : all.length - 1) : (i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus();
      return;
    }
    var d = parseInt(e.key, 10);
    if (d >= 1 && d <= bs.length) { e.preventDefault(); pick(d - 1); }
    else if (d === bs.length + 1) { e.preventDefault(); card.querySelector('#qOther').focus(); }
  }
  /* `keep` hides the card but keeps the question (a line is being said); otherwise it's gone too.
     The chat's own box comes back either way. */
  function hideCard(keep) {
    var had = card.contains(document.activeElement);
    card.hidden = true; card.innerHTML = '';
    $('sayForm').hidden = false;
    if (had && !Runner.isPlaying()) input.focus({ preventScroll: true });
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
     `opts.card` is the suggestions, { text, options: [{ text, sub, say }] }, or a function that makes
     them (the findings shrink as tickets are filed).

     AN OPEN QUESTION HAS NO CARD (spec D43; Jay, 2026-09-30: questions only when necessary). The
     question is a line in the chat with an example in it, and the box's placeholder says what to
     type, so a kid knows how to answer without a menu. The suggestions come only when asked for: the
     kid types "idk", "help" or the like, or taps Hint. Then they are a card with Skip, and tapping
     one is typing it. A question whose answers are the point (what did you find?) has no
     suggestions: "idk" there is the step's next hint, which says where to look, never what. */
  var HELP_ME = /^\s*(idk|i ?d(on|o)n?['’]?t know|dunno|no idea|(i['’]?m |im )?not sure|help( me)?|hint|i['’]?m stuck|stuck|you (pick|choose|decide)|\?+)\s*[.!?]*\s*$/i;
  // what's said first: [when there are suggestions, when there is a hint]
  var HELPED = [['No problem. Here are some ideas, or say your own.', 'No problem. Here’s a hint.'],
                ['That’s okay. Pick one of these, or type something else.', 'That’s okay. Try this hint.'],
                ['Here are a few to get you going.', 'Here’s a hint to get you going.']], helped = 0;
  function expect(ph, fn, opts) {
    opts = opts || {};
    expecting = { fn: fn, ph: ph, card: opts.card || null, who: opts.who || active, takesHelp: opts.takesHelp || null }; asked++;
    hideCard(); question = null; placeholder(); hintButton();
    if (!Runner.isPlaying()) input.focus({ preventScroll: true });
  }
  function typedCard() {
    if (!expecting || !expecting.card) return null;
    var c = typeof expecting.card === 'function' ? expecting.card() : expecting.card;
    return c ? { text: c.text, who: expecting.who || active, options: c.options || [], typed: true,
                 skip: function () { placeholder(); if (!Runner.isPlaying()) input.focus({ preventScroll: true }); } } : null;
  }
  function offerCard() {
    var q = typedCard(); if (!q) return false;
    question = q;
    if (settled()) showCard(q); else pendingQ = q;
    return true;
  }
  function answer(text) {
    var e = expecting, q = question && question.typed && !card.hidden ? question : null;
    quieten(); flush();
    // the question the card asked goes into the log, as a tapped one does: typed under the playtest
    // card, "not really" sat in the log under nothing (Sept 30)
    var up = question && !card.hidden ? question : null;
    if (up) line(up.who, up.text);
    line('k', text);
    if (!e) return;
    /* "idk" is always answered in the chat, then the help comes (critique, Sept 30: typed "idk" opened
       the hint box and the chat said nothing, so the kid who admitted being stuck was ignored). */
    var help = !q && HELP_ME.test(text);
    if (help && e.card) { say([[e.who || active || 'm', HELPED[helped++ % HELPED.length][0]]]); offerCard(); return; }   // asked for ideas: here they are
    // a question with no suggestions (what did you find: a list would be the answers) gets the step's
    // next hint instead, the same as tapping Hint. Unless the asker takes "idk" itself right now
    // (`takesHelp`): mid-question, the Mentor leads them on from what they said (quest.js, askFindings)
    if (help && !e.card && hintHandler && !(e.takesHelp && e.takesHelp())) { say([[e.who || active || 'm', HELPED[helped++ % HELPED.length][1]]]); hintHandler(); return; }
    expecting = null; question = null; hideCard(); placeholder(); hintButton();
    /* false keeps listening, unless the answer already moved on (a new question, or a stop): the hero's
       answer, drawn at once with the AI down, asked the name, and putting the hero's handler back made
       the next line a hero again, so the game never got its name */
    var at = asked;
    if (e.fn(text, active) === false && asked === at) { expecting = e; placeholder(); hintButton(); }
  }
  /* The task line's Hint: during an open question it shows the suggestions; otherwise the step's own
     hints (quest.js), when it has them. */
  function hintButton() {
    var b = $('taskHint'); if (!b) return;
    b.hidden = !hintHandler && !(expecting && expecting.card);
  }
  function hintTapped() {
    if (expecting && expecting.card) { if (card.hidden) offerCard(); return; }
    if (hintHandler) hintHandler();
  }
  /* Menus that start a conversation (GameObject › Add a part…, Help › Ask the mentor) put the
     cursor in the box with a hint of what to type; what's typed goes the usual way. */
  function prompt(ph) { if (ph) input.placeholder = ph; input.focus(); }
  function stopExpecting() { expecting = null; asked++; placeholder(); hintButton(); }
  function placeholder() {
    if (!input) return;
    var to = active === 'm' || !active ? 'the Mentor' : 'the ' + who(active)[0].toLowerCase();
    // a function when what's wanted moves on (the findings: an example, then "another, or that's all")
    var ph = expecting && (typeof expecting.ph === 'function' ? expecting.ph() : expecting.ph);
    input.placeholder = ph || 'Message ' + to + '…';
    input.setAttribute('aria-label', ph ? ph.replace(/…$/, '') : 'Type a message to ' + to);
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
    quieten(); flush();
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
           onLine: function (fn) { taps.push(fn); }, history: turns, WHO: WHO, hint: hint, hideHint: hideHint, nudge: nudge, rich: rich, placeholder: placeholder };
})();
