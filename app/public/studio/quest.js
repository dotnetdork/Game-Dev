/* quest.js: the quest engine. Runs the course's quest files (app/content/quests/, checked by
   app/quests.js) and keeps the tickets. docs/rework/v2-spec.md §2.1–2.2 is the design, and
   docs/rework/v2-review-2026-09-28.md §4 is the round-2 rules this version follows.

   HOW A BEAT RUNS
     1. `skip_if` already true? Move on (the kid, or the AI, fixed it early).
     2. `do`: reveal panels, point at one, cue Play, start or stop the game, allow components, file a
        ticket, have the Director sum up the day.
     3. `say`: the lines, in the beat's character's voice, one idea per bubble.
     4. `wait_for`: evidence from the game or the editor. A beat never waits on a Next button. A
        condition that is only about state (a setting already on) is checked straight away too.
     5. When it's met: `pass` (the quiet success sound), `award`, `done_say`, then `ask` if there is
        one, else the next beat. A beat that only asks awards when its question is answered, so a
        card never arrives before the quiz that names it.
   `on` handlers react while a beat (or its whole quest) is running: a line when the kid turns the
   fix off again, a flag, a Play cue.

   CHAT FIRST, CODE KEEPS THE SCORE (decision R1). The kid can type anything at any time, to whoever
   is talking; the AI answers as that character. Four things are typed rather than tapped, because a
   card of answers is the studio doing the kid's thinking (Jay's playthrough): what they found, what
   their hero is, what their game is called, and what they thought of the day.

   THE AI NEVER GIVES THE ANSWER (review §4, rule 3). A beat's `hints` are a ladder, where → which →
   how, one rung every `hints_after` seconds or at once when the kid types "help", "stuck" or "idk"
   (answered here, instantly, with no AI). The AI is told the goal and the next rung only, and may
   not make the change the ticket is about: this file drops it if it tries.

   TICKETS. NEVER NARRATE WHAT THE KID HASN'T NOTICED (rule 1). On the first day a problem the game
   shows is only SEEN; it becomes a ticket when the kid says so, in their words (tickets.yaml). After
   that first report, a problem the kid runs into is filed at once, with a row in the chat saying so.
   A ticket's quest runs INSIDE the quest that picked it (a stack), and when it ends the ticket is
   done and the parent carries on. `fixed_when` closes a ticket the kid (or the AI) fixed early.

   WHEN THE AI IS DOWN, the course still runs: every step is scripted, and the AI only adds. A call
   gets 20 seconds; after two failures in a row the studio stops asking until one works again (a
   slow school network shouldn't make every typed line cost 20 seconds). What it says then is the
   truth ("I can't reach the studio's AI"), never "pinned to your idea board" for a line that was
   just dropped.

   Code keeps the score here; the AI changes things through Editor.set, the same way a tap does, and
   through the Builder (builder.js) for anything the settings can't do. */
var Quest = (function () {
  var COURSE = null, S = null, hintTimer = null, lastFired = {}, aiFails = 0;
  var VOICE = { mentor: 'm', 'lead-programmer': 'p', 'art-director': 'a', 'sound-designer': 'u', 'lead-designer': 'd', director: 'r' };
  var NAME = { mentor: 'the Mentor', 'lead-programmer': 'the lead programmer', 'art-director': 'the art director', 'sound-designer': 'the sound designer', 'lead-designer': 'the lead designer', director: 'the Studio Director' };
  var BY_VOICE = {}; Object.keys(VOICE).forEach(function (k) { BY_VOICE[VOICE[k]] = k; });
  var DEPT = { engineering: 'Engineering', art: 'Art', audio: 'Audio', design: 'Design', studio: 'Studio' };
  /* What a quest's `reveal:` names, and where it is. `pause` brings Pause and Step into the toolbar
     beside Play. */
  var PANEL = { game: 'dGame', hierarchy: 'dHier', tickets: 'dTickets', play: 'transport', stars: 'stars', project: 'dProject', pause: 'stepTools', console: 'dConsole', doc: 'vtDoc' };
  var AI_MS = 20000;   // a reasoned answer from a big model takes longer than 12s on a school network
  // an apostrophe may be straight or curly: a tablet's keyboard curls it
  var HELP = /^\s*(help|hint|stuck|idk|i ?d(on|o)n?['’]?t know|i['’]?m stuck|what do i do|what now|\?+)\b/i;   // not "how": "how do I make it spin" is a question for the AI

  function $(id) { return document.getElementById(id); }
  function frame() { return S.stack[S.stack.length - 1] || null; }
  function quest(f) { f = f || frame(); return f && COURSE.quests[f.quest]; }
  function beat(f) { f = f || frame(); var q = quest(f); return q && q.beats[f.beat]; }
  function ticketOf(id) { return COURSE.tickets.filter(function (k) { return k.id === id; })[0] || null; }
  function save() { Project.save(); }

  /* ---------- the character talking ---------- */
  function character(b, f) {
    var q = quest(f);
    var c = (b && b.character) || (q && q.character) || 'mentor';
    return c === 'department' ? (S.lastCharacter || 'mentor') : c;
  }
  function voice() { return frame() ? (VOICE[character(beat())] || 'm') : (Chat.active() || 'm'); }
  function fill(t) { return String(t).replace(/\{game\}/g, S.name || 'your game'); }
  function say(lines, who) { if (lines && lines.length) Chat.say(lines.map(function (l) { return [who || voice(), fill(l)]; })); }
  /* A step's words: its talk, then its instruction (`instruct`), which the chat draws as a step row
     rather than a bubble (chat.js, "the chat is the conversation"). */
  function speak(x) {
    var lines = (x.say || []).map(function (l) { return [voice(), fill(l)]; });
    if (x.instruct) lines.push([voice(), fill(x.instruct), 'step']);
    if (lines.length) Chat.say(lines);
  }

  /* ---------- what happened, for whoever runs the playtest (telemetry.js on the server) ---------- */
  var outbox = [], outTimer = null;
  function track(ev, fields) {
    var e = { ev: ev }; Object.keys(fields || {}).forEach(function (k) { e[k] = fields[k]; });
    var f = frame(); if (f && !e.quest) { e.quest = f.quest; e.beat = beat(f) ? beat(f).id : '(end)'; }
    outbox.push(e);
    clearTimeout(outTimer);
    outTimer = setTimeout(flush, 4000);
  }
  function flush() {
    if (!outbox.length) return;
    var body = JSON.stringify({ events: outbox.splice(0, 50) });
    try { fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  window.addEventListener('pagehide', flush);

  /* ---------- conditions ---------- */
  function stateOk(map) {
    return Object.keys(map).every(function (pk) {
      var bits = pk.split('.'), p = Project.part(bits[0]), v = p ? p[bits[1]] : undefined, want = map[pk];
      if (want === null) return v === null || v === undefined || v === false;
      if (want === 'set') return v !== null && v !== undefined && v !== false;
      return v === want;
    });
  }
  function seen() { return Object.keys(S.seen).length + Object.keys(S.tickets).length; }
  function guards(c, f) {
    if (c.state && !stateOk(c.state)) return false;
    if (c.flag && !(f.flags[c.flag])) return false;
    if (c.not_flag && f.flags[c.not_flag]) return false;
    if (c.seen_at_least !== undefined && seen() < c.seen_at_least) return false;
    if (c.seen_none && seen() > 0) return false;
    if (c.playing !== undefined && Runner.isPlaying() !== c.playing) return false;
    return true;
  }
  var TRIGGERS = ['event', 'set', 'select', 'play', 'stop', 'reverted', 'filed', 'built'];
  /* ev: { type, name, detail }. A condition with a trigger needs that trigger now; one with only
     guards (state, flags) is true whenever its guards are. */
  function matches(c, ev, f) {
    if (!c) return false;
    var trig = TRIGGERS.filter(function (k) { return c[k] !== undefined; })[0];
    if (trig) {
      if (!ev) return false;
      if (trig === 'event' && !(ev.type === 'event' && ev.name === c.event)) return false;
      if (trig === 'play' && ev.type !== 'play') return false;
      if (trig === 'stop' && ev.type !== 'stop') return false;
      if (trig === 'reverted' && ev.type !== 'reverted') return false;
      if (trig === 'built' && ev.type !== 'built') return false;
      if (trig === 'filed' && !(ev.type === 'filed' && ev.name === c.filed)) return false;
      if (trig === 'select' && !(ev.type === 'select' && ev.name === c.select)) return false;
      if (trig === 'set') {
        var s = c.set, d = ev.detail || {};
        if (ev.type !== 'set' || d.id !== s.part || (s.key && d.key !== s.key)) return false;
        if (s.value !== undefined && d.value !== s.value) return false;
        if (s.gt !== undefined && !(d.value > s.gt)) return false;
      }
    }
    return guards(c, f);
  }

  /* ---------- tickets ---------- */
  /* File a ticket. `words` are the kid's, when they reported it; `by` names who filed it when it
     wasn't the kid (the art director, the game itself), for the row in the chat. */
  function file(id, words, by) {
    var t = ticketOf(id); if (!t || S.tickets[id]) return false;
    S.tickets[id] = { status: 'open', words: words ? String(words).slice(0, 160) : null, by: by || null, n: Object.keys(S.tickets).length + 1 };
    save(); paintTickets();
    Chat.event((by ? by + ' filed ' : 'You filed ') + 'ticket #' + S.tickets[id].n + ': ' + t.title, 'i-ticket', { kind: 'ticket' });
    UI.feel($('dTickets'), 'good');
    track('ticket-filed', { ticket: id, words: words || null, by: by || 'kid' });
    handle({ type: 'filed', name: id });
    return true;
  }
  function checkTickets(ev) {
    COURSE.tickets.forEach(function (t) {
      if (t.found_by && !S.tickets[t.id] && matches(t.found_by, ev, { flags: {} })) {
        if (!S.seen[t.id]) { S.seen[t.id] = true; save(); }
        if (S.reported) file(t.id, null, 'The game');   // after the first report, a new problem files itself
      }
      var mine = S.tickets[t.id];
      if (mine && mine.status === 'open' && t.fixed_when && matches(t.fixed_when, null, { flags: {} })) {
        mine.status = 'done'; mine.early = true; save(); if (openTicket === t.id) openTicket = null; paintTickets();
        Chat.event('Ticket #' + number(t.id) + ' fixed: ' + t.title, 'i-check', { kind: 'good' });
      }
    });
  }
  /* A ticket's name for the AI and the Director: the board's title, with the kid's words when they
     reported it, so the AI can tell "the floor thing" means this one. */
  function titleOf(t) { var mine = S.tickets[t.id]; return t.title + (mine && mine.words ? ' (they reported it as “' + mine.words + '”)' : ''); }
  function number(id) { var mine = S.tickets[id]; return (mine && mine.n) || Object.keys(S.tickets).indexOf(id) + 1; }
  var STATUS = { open: 'Open', doing: 'In progress', done: 'Fixed' };
  function lead(t) { var q = COURSE.quests[t.quest]; return VOICE[(q && q.character) || 'mentor'] || 'm'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function icon(id) { var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use'); svg.setAttribute('class', 'i'); svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', '#' + id); svg.appendChild(use); return svg; }
  function pill(status) { var p = el('span', 'pill ' + status, STATUS[status]); if (status === 'done') p.insertBefore(icon('i-check'), p.firstChild); return p; }

  /* The Tickets dock: a board, the way a studio's bug tracker looks (Jay, 2026-09-29: "more
     professional, clear title, clicking it should provide further details on the problem, or help if
     they get stuck"). Each row is a number, a department, a status and the ticket's title; tapping one
     opens its page (below) in the same dock, with a way back. Picking and starting a ticket happen on
     its page, so a tap always does the same thing. */
  var openTicket = null;
  function paintTickets() {
    var ul = $('ticketList'), page = $('ticketPage'); if (!ul) return;
    var ids = Object.keys(S.tickets);
    var open = ids.filter(function (id) { return S.tickets[id].status !== 'done'; }).length;
    $('ticketCount').textContent = open ? String(open) : '';
    if (openTicket && !S.tickets[openTicket]) openTicket = null;
    ul.hidden = !!openTicket; if (page) page.hidden = !openTicket;
    if (openTicket) return paintTicket(ticketOf(openTicket));
    UI.keepFocus(ul, function () {
      ul.innerHTML = '';
      if (!ids.length) { ul.innerHTML = '<li class="empty">Nothing yet. Play the game and tell the Mentor what’s broken.</li>'; return; }
      ids.slice().sort(function (a, b) { return number(a) - number(b); }).forEach(function (id) {
        var t = ticketOf(id), mine = S.tickets[id]; if (!t) return;
        var li = el('li'), b = el('button', 'tk ' + mine.status);
        b.type = 'button'; b.setAttribute('data-key', 'ticket:' + id); b.setAttribute('data-dept', t.department);
        var top = el('span', 'tmeta');
        top.appendChild(el('span', 'tid', '#' + number(id)));
        top.appendChild(el('span', 'tdept', DEPT[t.department]));
        top.appendChild(pill(mine.status));
        b.appendChild(top);
        b.appendChild(el('span', 'tt', t.title));
        b.setAttribute('aria-label', 'Ticket ' + number(id) + ': ' + t.title + '. ' + DEPT[t.department] + ', ' + STATUS[mine.status] + '. Open its page.');
        /* A tap always opens the ticket's page. While the Mentor is asking which to fix, that is
           selecting it (Jay, 2026-09-30: "clicking a ticket should make the ticket the selected one"),
           and the page's "Fix this one" is the confirm (later the same day: "click one of the tickets
           and confirm it"). Starting on the tap alone started a shift the kid had only wanted to read. */
        b.addEventListener('click', function () { showTicket(t.id); });
        li.appendChild(b); ul.appendChild(li);
      });
    });
  }
  function showTicket(id) {
    openTicket = id; paintTickets(); $('ticketPage').parentNode.scrollTop = 0;
    var back = $('ticketPage').querySelector('.back'); if (back) back.focus({ preventScroll: true });
  }
  function closeTicket() {
    var id = openTicket; openTicket = null; paintTickets();
    var row = $('ticketList').querySelector('[data-key="ticket:' + id + '"]'); if (row) row.focus({ preventScroll: true });
  }
  /* A ticket's page: what's wrong, who reported it, how you'll know it's fixed, and what to do now:
     "Fix this one" when it's open and the kid may start it, the task and a Hint while they work on
     it, and what they learned once it's fixed. */
  function paintTicket(t) {
    var page = $('ticketPage'), mine = S.tickets[t.id], who = lead(t), W = Chat.WHO[who], asker = NAME[BY_VOICE[who]];
    var focused = page.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
    page.innerHTML = ''; page.setAttribute('data-dept', t.department);
    var back = el('button', 'tbtn quiet back'); back.type = 'button'; back.setAttribute('data-key', 'back');
    back.appendChild(icon('i-undo')); back.appendChild(el('span', '', 'All tickets'));
    back.addEventListener('click', closeTicket);
    page.appendChild(back);
    var top = el('p', 'tmeta');
    top.appendChild(el('span', 'tid', '#' + number(t.id)));
    top.appendChild(el('span', 'tdept', DEPT[t.department]));
    top.appendChild(pill(mine.status));
    page.appendChild(top);
    page.appendChild(el('h3', '', t.title));
    var owner = el('p', 'towner'); owner.setAttribute('data-who', who);
    var face = el('span', 'face'); face.appendChild(icon(W[2])); owner.appendChild(face);
    owner.appendChild(el('span', '', W[0] + ' · ' + (mine.status === 'done' ? 'fixed it with you' : 'will help you fix it')));
    page.appendChild(owner);
    function part(label, text, cls) { var sec = el('section', 'tsec' + (cls ? ' ' + cls : '')); sec.appendChild(el('h4', '', label)); sec.appendChild(el('p', '', text)); page.appendChild(sec); }
    part('What’s wrong', t.detail);
    if (mine.words) part('You reported', '“' + mine.words + '”', 'quote');
    else part('Reported by', mine.by === 'The game' ? 'The game, when you ran into it' : (mine.by || 'The studio'));
    if (mine.should) part('Should happen', '“' + mine.should + '”', 'quote');   // their half of the bug report (askFindings)
    part('Fixed when', t.done);
    var act = el('div', 'tact');
    if (mine.status === 'open') {
      var why = whyNot(t), go = el('button', 'tbtn on'); go.type = 'button'; go.setAttribute('data-key', 'fix');
      go.appendChild(icon('i-hammer')); go.appendChild(el('span', '', 'Fix this one'));
      if (why) { go.disabled = true; act.appendChild(go); act.appendChild(el('p', 'tnote', why)); }
      else { go.addEventListener('click', function () { fixTicket(t); }); act.appendChild(go); }
    } else if (mine.status === 'doing') {
      var f = frame(), here = f && f.quest === t.quest, b = here && beat(f);
      if (b && b.goal) { var now = el('p', 'tnow'); now.appendChild(el('small', '', 'Your task now')); now.appendChild(document.createTextNode(fill(b.goal))); act.appendChild(now); }
      if (b && b.hints) {
        var h = el('button', 'tbtn'); h.type = 'button'; h.setAttribute('data-key', 'hint');
        h.appendChild(icon('i-bulb')); h.appendChild(el('span', '', 'Stuck? Get a hint'));
        h.addEventListener('click', function () { hintNow('ticket'); });
        act.appendChild(h);
        act.appendChild(el('p', 'tnote', 'The hint opens under your task. You can ask ' + asker + ' anything in the chat too.'));
      } else act.appendChild(el('p', 'tnote', 'Stuck? Ask ' + asker + ' in the chat.'));
    } else {
      var q = COURSE.quests[t.quest], c = q && q.concept && S.cards.indexOf(q.concept) >= 0 ? cardOf(q.concept) : null;
      var fixed = el('p', 'tnote good'); fixed.appendChild(icon('i-check'));
      fixed.appendChild(document.createTextNode(c ? 'Fixed. You earned the ' + c.name + ' card (Project › Cards).' : 'Fixed. Nice work.'));
      act.appendChild(fixed);
    }
    page.appendChild(act);
    if (focused) { var again = page.querySelector('[data-key="' + focused + '"]'); if (again) again.focus({ preventScroll: true }); }
  }
  /* Why "Fix this one" can't start it now, in words; null when it can. */
  function whyNot(t) {
    if (pickable(t) >= 0) return null;
    var on = S.stack.map(function (f) { return quest(f).ticket; }).filter(Boolean)[0];
    if (on) return 'Finish ticket #' + number(on) + ' first.';
    if (busyWithQuest()) return 'You’ll pick one to fix when the Mentor asks.';
    return null;
  }
  function pickable(t) {
    if (picking && picking.f !== frame()) picking = null;   // that question's step is over
    if (picking && S.tickets[t.id] && S.tickets[t.id].status === 'open') return 0;   // asked in the chat (askTickets)
    var q = Chat.question();
    return q && q.picker === 'tickets' ? q.options.map(function (o) { return o.ticket; }).indexOf(t.id) : -1;
  }
  function fixTicket(t) {
    if (picking && pickable(t) >= 0) return picking(t);
    var n = pickable(t);
    if (n >= 0) return Chat.pick(n);
    if (whyNot(t)) return status(whyNot(t));
    startTicket(t);
  }
  function busyWithQuest() { var f = frame(); return !!(f && (quest(f).ticket || S.done.indexOf('first-day') < 0)); }
  function status(text) { $('statusMsg').textContent = text; }

  /* ---------- running beats ---------- */
  function enter() {
    var f = frame(), b = beat(f);
    clearTimeout(hintTimer);
    Chat.clear(); Chat.stopExpecting(); Editor.point(null);
    if (!b) return endQuest();
    Chat.speaker(voice());
    allow(f);
    if (b.skip_if && matches(b.skip_if, null, f)) { f.beat++; save(); return enter(); }
    setTask(f, b);
    track('beat', {});
    Editor.cue(null);   // a cue is the last step's; a beat lights only what it names
    act(b.do);
    if (b.do && b.do.recap) return recap(function () { go(f, b); });
    go(f, b);
  }
  function go(f, b) {
    speak(b);
    f.rung = 0; f.nudged = null; hints();
    paintDev();
    if (b.wait_for) { if (matches(b.wait_for, null, f)) complete(); return; }
    if (b.ask) return ask(b.ask);
    complete();
  }
  function complete() {
    var f = frame(), b = beat(f);
    clearTimeout(hintTimer);
    if (!b || f.completing) return;
    f.completing = true;
    if (b.pass) { UI.sound('good'); UI.feel($('dGame'), 'good'); }
    if (b.award) { award(b.award); f.awarded = true; }
    say(b.done_say);
    if (b.ask) { f.completing = false; return ask(b.ask); }
    var delay = b.pass ? 1600 : 0, q = f.quest, at = f.beat;
    setTimeout(function () { var g = frame(); if (g && g.quest === q && g.beat === at) next(b.next); }, delay);
  }
  function next(target) {
    var f = frame(), q = quest(f), b = beat(f);
    if (b && b.award && !f.awarded) award(b.award);   // a beat that only asked awards on its answer
    f.completing = false; f.fired = {}; f.awarded = false;
    if (target === 'end') return endQuest();
    if (target) { var n = q.beats.map(function (x) { return x.id; }).indexOf(target); if (n >= 0) { f.beat = n; save(); return enter(); } }
    f.beat++; save();
    if (f.beat >= q.beats.length) return endQuest();
    enter();
  }
  function endQuest() {
    var f = S.stack.pop(), q = COURSE.quests[f.quest];
    clearTimeout(hintTimer);
    // back to the board, where it is crossed off (Jay, Sept 30: "completing a ticket should close the
    // ticket (still show it, but cross it out)"); its page stayed open and the board never showed it
    if (q.ticket && S.tickets[q.ticket]) { S.tickets[q.ticket].status = 'done'; if (openTicket === q.ticket) openTicket = null; paintTickets(); }
    if (S.done.indexOf(q.id) < 0) S.done.push(q.id);
    if (q.character !== 'mentor') S.lastCharacter = q.character;
    track('quest-done', { quest: q.id });
    if (q.id === 'first-day') { Editor.allow(Schema.GATES); Chat.event('Every component is open to you now', 'i-sliders', { kind: 'good' }); }
    save();
    var parent = frame();
    if (!parent) {
      // no dead end: a quest says what comes after it (next_quest), and the last one leaves the kid in
      // their own game with the whole studio to ask
      if (q.next_quest && COURSE.quests[q.next_quest] && S.done.indexOf(q.next_quest) < 0) {
        S.stack.push({ quest: q.next_quest, beat: 0, flags: {}, fired: {} }); save(); return enter();
      }
      free(); return;
    }
    var pb = beat(parent);
    parent.completing = false;
    if (pb && pb.ask && pb.ask.then === 'again') enter();
    else next(pb && pb.next);
  }
  /* The task line under the chat's header (chat.js task): the beat's `goal`, with a Hint button when
     it has hints. A beat with no goal only says its lines and moves on, so the last task stays up,
     except at a quest's start, where it would belong to the quest before. */
  function setTask(f, b) {
    if (b.goal) Chat.task(b.goal, { hint: b.hints ? function () { hintNow('button'); } : null });
    else if (f.beat === 0) Chat.task(null);
    if (openTicket) paintTickets();   // its page shows the task too
  }
  function hintNow(why) { giveHint(why); }
  /* No quest running: the kid's own game. Whoever they talk to answers; the Builder builds. */
  function free() {
    Chat.speaker('m');
    Chat.task('Your game now. Ask for anything you want in it');
    Editor.allow(Schema.GATES);
    paintDev();
  }

  /* ---------- hints: where → which → how ---------- */
  function hints() {
    clearTimeout(hintTimer);
    var f = frame(), b = beat(f);
    if (!b || !b.hints || f.rung >= b.hints.length) return;
    var at = f.beat, q = f.quest;
    hintTimer = setTimeout(function () {
      var g = frame(); if (!g || g.quest !== q || g.beat !== at || g.completing) return;
      if (!Chat.settled() || Chat.expecting()) { hints(); return; }   // not over a line being said, or a typed answer
      /* The Hint button asks, once for each hint; the hint itself waits to be asked for. It used to
         post the next hint into the chat on this timer, and a kid who didn't answer was sent one
         every half-minute (Jay, 2026-09-29: "the robot will repetitively spam you"). */
      if (g.nudged === g.rung) return;
      g.nudged = g.rung; Chat.nudge();
    }, (b.hints_after || 30) * 1000);
  }
  function giveHint(why) {
    var f = frame(), b = beat(f);
    if (!b || !b.hints) return false;
    var n = Math.min(f.rung || 0, b.hints.length - 1);
    Chat.hint(fill(b.hints[n]), n + 1, b.hints.length);
    Chat.event('Hint ' + (n + 1) + ' of ' + b.hints.length, 'i-bulb', { consoleOnly: true });
    track('stuck', { rung: n + 1, why: why });
    f.rung = n + 1; hints();
    return true;
  }
  /* The kid did something: the next rung waits a full interval again. */
  function busyKid() { var f = frame(); if (f && beat(f) && beat(f).hints) hints(); }

  /* ---------- actions ---------- */
  function act(d) {
    if (!d) return;
    (d.reveal || []).forEach(reveal);
    /* `file: rest` (spec D44): every problem the kid didn't report is filed by its own department, so
       a finding missed never stalls the day. A colleague would have spotted it; the Mentor says so. */
    if (d.file === 'rest') {
      var rest = COURSE.tickets.filter(function (t) { return !S.tickets[t.id]; });
      rest.forEach(function (t) { file(t.id, null, DEPT[t.department]); });
      if (rest.length) say([rest.length > 1 ? 'The team spotted ' + rest.length + ' more and filed them too.' : 'The team spotted one more and filed it too.'], voice());
    } else (d.file || []).forEach(function (id) { var t = ticketOf(id); file(id, null, t ? DEPT[t.department] : 'The studio'); });
    if (d.stop && Runner.isPlaying()) Editor.togglePlay();
    if (d.play && !Runner.isPlaying()) Editor.togglePlay();
    if (d.close_inspector) Editor.closeInspector();
    if (d.allow) { d.allow.forEach(function (c) { if (S.taught.indexOf(c) < 0) S.taught.push(c); }); allow(frame()); }
    if (d.cue) Editor.cue(d.cue);
    if (d.point) { var el = document.querySelector(d.point === 'game' ? '#vtGame' : '#' + (PANEL[d.point] || '') + ' .tab') || $(PANEL[d.point]); if (el) setTimeout(function () { if (!Editor.selected() && !Runner.isPlaying()) Editor.point(pointText(d.point), el); }, 500); }
  }
  function pointText(p) {
    return { game: 'The Game view: where games run.', hierarchy: 'The Hierarchy: every part of the level.', tickets: 'Your tickets: everything that needs fixing.', play: 'Play runs the game.' }[p] || '';
  }
  function reveal(p) {
    if (S.shown.indexOf(p) < 0) { S.shown.push(p); save(); }
    var id = PANEL[p]; if (!id) return;
    if (p === 'doc') { Views.revealDoc(true); Editor.project(); return; }   // a centre tab, not a dock
    if (p === 'play' || p === 'stars' || p === 'pause') Editor.reveal(id, true); else Editor.openDock(id, true);
    if (p === 'hierarchy') Editor.tree(true);
  }
  function allow(f) {
    if (S.done.indexOf('first-day') >= 0) return Editor.allow(Schema.GATES);   // after the first day, every component shows
    var q = quest(f); Editor.allow(S.taught.concat((q && q.allow) || []));
  }
  function award(a) {
    if (a.stars) { S.stars = (S.stars || 0) + a.stars; Editor.stars(S.stars); reveal('stars'); Chat.event('+' + a.stars + (a.stars === 1 ? ' star' : ' stars'), 'i-star', { kind: 'good' }); }
    if (a.card && S.cards.indexOf(a.card) < 0) {
      S.cards.push(a.card); reveal('project'); Editor.project(); UI.sound('card');
      Chat.event('New card: ' + cardOf(a.card).name + ' (Project › Cards)', 'i-cards', { kind: 'good' });
    }
    save();
  }
  /* A card: the idea's name and one short line a 10-year-old can read. */
  var CARDS = {
    'play-mode': ['Play mode', 'Changes you make while the game runs are undone when you press Stop.'],
    collider: ['Collider', 'The invisible shape that makes a part solid, so things can stand on it.'],
    feedback: ['Feedback', 'The game telling you something happened: a sound, a flash, a number.'],
    readability: ['Readability', 'A player can tell what everything is at a glance.'],
    risk: ['Risk', 'A danger that makes the player’s choices matter.']
  };
  function cardOf(c) { var k = CARDS[c]; return k ? { name: k[0], text: k[1] } : { name: c, text: '' }; }

  /* ---------- questions ---------- */
  function ask(a) {
    var who = voice(), f = frame();
    if (a.from === 'tickets') return askTickets(a, who);
    if (a.from === 'findings') return askFindings(a, who);
    if (a.from === 'heroes') return askHero(a, who);
    if (a.from === 'names') return askName(a, who);
    if (a.from === 'feedback') return askFeedback(a, who);
    var quiz = a.answers.some(function (x) { return x.correct; });
    var left = f.left && f.left.q === a.text ? f.left.list : a.answers;
    Chat.ask(fill(a.text), left.map(function (x) {
      return { text: x.text, sub: x.sub, run: function () {
        track('answer', { q: a.text, a: x.text, correct: quiz ? !!x.correct : null });
        if (x.correct) UI.sound('good');
        say(x.say);
        var g = frame(); if (!g || g !== f) return;
        /* A wrong answer, or "again": ask once more without it, so nothing loops and a quiz is
           answered right in the end (review §4: a wrong answer is a retry, not a shrug). */
        var retry = x.goto === 'again' || x.goto === 'resume' || (quiz && !x.correct && !x.goto);
        if (retry) {
          var rest = left.filter(function (y) { return y !== x; });
          if (rest.length > (quiz ? 0 : 1) && (!quiz || rest.some(function (y) { return y.correct; }))) { f.left = { q: a.text, list: rest }; return ask(a); }
        }
        f.left = null;
        next(x.goto === 'next' || retry ? undefined : x.goto);
      } };
    }), { who: who, keepOrder: !quiz });   // a quiz is shuffled; a plain choice keeps its authored order
  }
  /* Which ticket? Said in the chat, not tapped (Jay, 2026-09-30: "It should trigger from the chat
     conversation, they shouldn't have to press a multiple choice answer"). The kid names it any way
     a kid would: its number ("2", "#2"), what it's about ("the floor one", "the grey"), its
     department ("art"). Recognised here first, then by the AI; "Fix this one" on the ticket's page
     answers too. The board is on screen beside the chat, so the choices are in view without a card;
     "idk" or Hint brings them as one (chat.js, expect). */
  var picking = null;
  var STOP_WORDS = /^(the|a|an|and|of|is|are|when|with|that|this|one|player|level|whole|part|doesn’t|doesn't)$/i;
  function ticketFrom(text, open) {
    var n = String(text).match(/(?:^|[^\d])#?\s*(\d{1,2})(?!\d)/);
    if (n) { var byNum = open.filter(function (t) { return String(number(t.id)) === n[1]; }); if (byNum.length) return byNum[0]; }
    var scored = open.map(function (t) {
      var s = 0;
      if (t.words && new RegExp('\\b(?:' + t.words + ')', 'i').test(text)) s += 3;
      if (new RegExp('\\b' + DEPT[t.department] + '\\b', 'i').test(text)) s += 2;
      String(t.title).split(/[^A-Za-z’']+/).forEach(function (w) {
        if (w.length > 3 && !STOP_WORDS.test(w) && new RegExp('\\b' + w.replace(/s$/, '') + 's?\\b', 'i').test(text)) s += 1;
      });
      return { t: t, s: s };
    }).filter(function (x) { return x.s > 0; }).sort(function (x, y) { return y.s - x.s; });
    return scored.length && (scored.length === 1 || scored[0].s > scored[1].s) ? scored[0].t : null;
  }
  function askTickets(a, who) {
    var f = frame();
    var open = function () { return COURSE.tickets.filter(function (t) { return S.tickets[t.id] && S.tickets[t.id].status === 'open'; }); };
    if (!open().length) { f.completing = false; return next(beat(f).next); }
    var go = function (t) {
      picking = null; Chat.stopExpecting();
      track('answer', { q: a.text, a: t.id });
      startTicket(t);
    };
    picking = function (t) { if (frame() === f) go(t); };
    picking.f = f;
    // every way to answer, said plainly (Jay, Sept 30): a kid shouldn't have to guess what counts
    say([fill(a.text), 'Type its number, or tell me what it’s about. Or tap a ticket on the Tickets board and press Fix this one.'], who);
    Chat.expect('Like “#' + number(open()[0].id) + '” or “the ' + DEPT[open()[0].department].toLowerCase() + ' one”…', function (text) {
      if (frame() !== f) return;
      var list = open(), t = ticketFrom(text, list);
      if (t) { say(['Ticket #' + number(t.id) + ', ' + t.title.charAt(0).toLowerCase() + t.title.slice(1) + '. Let’s go!'], who); go(t); return; }
      if (!aiUp()) { say(['Which one? Say its number from the Tickets board.'], who); return false; }
      var hidden = { text: 'Which ticket does the kid want to fix?', options: list.map(function (x) { return { text: '#' + number(x.id) + ' ' + x.title }; }) };
      mentor(text, hidden, who, 'TASK: the kid is picking which ticket to fix next, from the listed ones. If they named or described one, set choose to it and reply in one short line. If they did not pick yet, answer them in one short line and ask which one.')
        .then(function (res) {
          if (frame() !== f || !picking) return;
          if (res && res.choose && list[res.choose - 1]) { if (res.reply) say([res.reply], who); go(list[res.choose - 1]); }
          else say([(res && res.reply) || 'Which one? Say its number from the Tickets board.'], who);
        });
      return false;
    }, { who: who, card: function () {
      return { text: fill(a.text), options: open().map(function (t) { return { text: '#' + number(t.id) + ' ' + t.title, sub: DEPT[t.department] }; }) };
    } });
  }
  function startTicket(t) {
    S.tickets[t.id].status = 'doing'; paintTickets();
    S.stack.push({ quest: t.quest, beat: 0, flags: {}, fired: {} });
    save();
    enter();
  }

  /* What was broken? Typed, in the kid's words. Recognised here from each ticket's `words` first
     (instant, and works with no AI), then by the AI, which is shown the problems as a hidden
     question and picks the one the kid meant. Anything else they found is kept as an idea. */
  var DONE = /^\s*(no+,?\s+)?(no+|nope|nah|nothing( else)?|that['’]?s (it|all|everything)|(i['’]?m |all )?done|no more|none|finished|thats? all|next|what now|what['’]?s next|move on|let['’]?s (go|fix (it|them))|where are (the|my) tickets)\s*[.!?]*\s*$/i;   // the whole line: "no sound on the coins" is a finding, not a no
  function askFindings(a, who) {
    var f = frame(), before = Object.keys(S.tickets).length;
    /* No suggestions here, ever (Jay, 2026-09-30: a card of what she ran into "just gives the kids the
       answers"; the point is to find out what THEY found). "idk" or Hint gives the beat's hints,
       which say where to look and how to put it, never what is broken (chat.js, answer). */
    // an open question: said, with an example that isn't one of the problems (chat.js, expect)
    say([fill(a.text)], who);
    /* After the first finding the box says how to finish: in Jay's playthrough (Sept 30) the Mentor
       said "that's a ticket now" and waited, and nothing said that "that's all" was the way on. */
    var more = function () { return Object.keys(S.tickets).length > before; };
    /* DISCOVERY, NOT SORTING. Jay, 2026-09-30: "It should ask why its boring, or why what they said.
       Ask for more deeper understanding", and "a kid isn't going to know the direct answer ... they
       need to be taught the answer by the AI pushing them deeper into explaining it". "Its boring" had
       been filed on the spot as the grey-box ticket, and "there are dots" got "noted!".
       So each finding is a short bug report, and the Mentor walks the kid down it:
       1. WHAT HAPPENED. A feeling ("its boring") or a thing with no problem yet ("there are dots") is
          asked about: what did you see, hear or do; where; try it again and watch. Up to three
          follow-ups, and what they say next is read together with what came before, so the ticket
          keeps all of their words ("its boring. everything is grey"). Still vague, it's an idea.
       2. WHAT SHOULD HAVE HAPPENED. Once it is a problem it is filed (it lands on the board as it is
          said) and the Mentor asks what should have happened. "idk" gets the ticket's `should_ask`, a
          question that leads there from what any player knows; still stuck, the Mentor says `should`
          (tickets.yaml). Their answer goes on the ticket's page.
       3. ARE YOU SURE? The report doesn't end on a magic phrase (Jay, same day: "gating them to say
          thats all is a bad idea. The conversation should feel natural", and "The bot should have
          responded with are you sure?"). The Mentor just asks what else; the first "that's all" with
          problems unfound gets "Are you sure?" and a `nudge` for each, one at a time: where to look,
          never what is wrong. A nudge not found after one more try is left for its department to
          file (`file: rest`, first-day.yaml); "that's all" again ends the report there.
       The code runs the ladder, so it works with the AI down; the AI, when up, words each question
       from what the kid actually said. `pending` is the rung in progress; its `aim` is the problem a
       nudge is about. */
    var pending = null, taught = false, looking = false, tried = {};
    var FEEL = /\b(boring|bored|dull|meh|lame|bad|weird|strange|odd|ugly|annoying|sucks?|dumb|stupid|confusing|off|wrong|broken|buggy|glitchy|hard|easy|not fun|no fun)\b/i;
    var IDK = /^\s*(idk|i ?d(on|o)n?['’]?t know|dunno|no idea|(i['’]?m |im )?not sure|um+|uh+|\?+)\s*[.!?]*\s*$/i;
    var STUCK = /^\s*(idk|i ?d(on|o)n?['’]?t know|dunno|no idea|(i['’]?m |im )?not sure|nothing|no+|nope|um+|uh+|\?+)\s*[.!?]*\s*$/i;
    var ASKING = /^\s*(what|where|which|huh|wdym)\b(?!.*\b(nothing|happened|did)\b)|\?\s*$/i;
    var FINISH = /^\s*(that['’]?s (it|all|everything)|thats? all|(i['’]?m |all )?done|finished|no more|move on|next)\s*[.!]*\s*$/i;
    var ELSE = ['What else did you notice?', 'Anything else seem off?', 'Good. What else?'];
    /* On the first day the level is grey boxes, and nothing says which box is what (Jay, Sept 30:
       "theres no way to know thats lava"). The Mentor may say what a thing is, never what's wrong
       with it, so the AI is told the names, and the script names the two a kid can't guess. */
    var LEVEL = 'The level is all grey today, so the kid may not know what things are: the grey circles are coins; the dip in the floor between the coins is the lava; the grey block standing on the left is the player. Say what a thing is if that helps them.';
    var NAMES = [[/\b(gap|dip|pit|dent|low(er)? (bit|part))\b/i, 'That dip between the coins is meant to be lava.'], [/\b(dots?|circles?|balls?|round things?)\b/i, 'Those circles are coins.']];
    function named(said) { var t = said.join(' '), n = NAMES.filter(function (x) { return x[0].test(t); })[0]; return n ? n[1] + ' ' : ''; }
    function concrete(text) { return COURSE.tickets.filter(function (t) { return t.words && new RegExp('\\b(?:' + t.words + ')', 'i').test(text); }); }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    // one question to the kid: the AI's wording when it is up, the plain one when it isn't or fails
    function put(text, task, plain, then) {
      if (!aiUp()) { say([plain], who); if (then) then(); return false; }
      mentor(text, null, who, task).then(function (res) { if (frame() !== f) return; say([(res && res.reply) || plain], who); if (then) then(); });
      return false;
    }
    function dig(said) {
      var n = (pending && pending.kind === 'dig' ? pending.n : 0) + 1, feel = (said.join(' ').match(FEEL) || [])[1];
      pending = { kind: 'dig', said: said, n: n, aim: pending && pending.aim };
      var plain = named(said) + (n === 1 ? (feel ? '“' + cap(feel) + '” how? What did you see or hear that made it feel ' + feel + '?' : 'What happened with it? Tell me what you did, and what the game did.')
        : n === 2 ? 'Where in the level was that? What were you doing right then?'
        : 'Try it again and watch closely. What does the game do?');
      Chat.placeholder();
      return put(said[said.length - 1], 'TASK: the kid is reporting what seemed wrong in the game, but it is not a clear problem yet. Everything they said so far: "' + said.join(' / ') + '". ' + LEVEL + ' Ask ONE short question that pushes them to explain more: what exactly they saw, heard or did, where, or what happens when they try the thing they mentioned (you may say what a thing is, like "those circles are coins: what happens when you grab one?"). Never say what is wrong. No praise, no list.', plain);
    }
    function filed(ts, words, reply, by) {
      pending = null;
      ts.forEach(function (t) { file(t.id, words, by); });
      track('finding', { text: words, tickets: ts.map(function (t) { return t.id; }) });
      reveal('tickets'); paintTickets();
      var ack = reply || (ts.length > 1 ? 'Good catches. Those are tickets now.' : ACKS[acked++ % ACKS.length].replace('#N', '#' + number(ts[0].id)));
      /* "What should have happened?" is asked once, the first time, to teach the other half of a bug
         report. After that the Mentor says it (critique, Sept 30: the same scripted question after
         every finding made the Mentor sound like it wasn't listening). */
      if (taught) return onward(ack + ' ' + ticketOf(ts[0].id).should);
      pending = { kind: 'should', ticket: ts[0].id, n: 1 };
      say([ack, ticketOf(ts[0].id).should_q || 'What should have happened instead?'], who);
      Chat.placeholder();
      return false;
    }
    var ACKS = ['Good catch. That’s ticket #N now.', 'Nice find. That’s ticket #N.', 'Spotted it. Ticket #N is on the board.', 'Yes! That’s ticket #N.'], acked = 0;
    // the next problem to send them looking for: one they ran into first, then the rest in order
    function unfound() { return COURSE.tickets.filter(function (t) { return !S.tickets[t.id] && !tried[t.id] && t.nudge; }).sort(function (x, y) { return (S.seen[y.id] ? 1 : 0) - (S.seen[x.id] ? 1 : 0); }); }
    function nudge(t, lead) {
      tried[t.id] = true;
      pending = { kind: 'dig', said: [], n: 0, aim: t.id };
      say([lead, t.nudge].filter(Boolean), who);
      Chat.placeholder();
      return false;
    }
    // after a finding, or a nudge that found nothing: on, the way a person would carry on talking
    function onward(lead) {
      pending = null;
      var left = unfound();
      if (!left.length && (looking || !COURSE.tickets.some(function (t) { return !S.tickets[t.id]; }))) return finish(lead);
      if (looking) return nudge(left[0], lead);
      say([lead, ELSE[(Object.keys(S.tickets).length - 1) % ELSE.length]].filter(Boolean), who);
      Chat.placeholder();
      return false;
    }
    // they think they're done: the first time, if there's more to find, are they sure?
    function wantsOut() {
      if (pending && pending.kind === 'dig' && pending.said.length && !pending.aim) idea(pending.said.join('. '), true);
      pending = null;
      if (!Object.keys(S.tickets).length) { say(['Nothing yet? Let’s look again.'], who); next(a.if_none); return; }
      var left = unfound();
      if (looking || !left.length) return finish();
      looking = true;
      return nudge(left[0], 'Are you sure? There’s more to find. Let’s look together.');
    }
    // a nudge that didn't land: one more try, then leave it for its department
    function retry() {
      if (pending.n === 0) { pending.n = 1; say(['Press Play and try it, then tell me what happened.'], who); Chat.placeholder(); return false; }
      return onward('That’s okay. We’ll come back to it.');
    }
    function should(text) {
      var t = ticketOf(pending.ticket), tk = S.tickets[pending.ticket];
      if (FINISH.test(text)) return wantsOut();
      var stuck = STUCK.test(text) || text.trim().length < 3;
      if (stuck && pending.n === 1) {
        pending.n = 2;
        return put(text, 'TASK: the kid does not know what should have happened for this problem: "' + t.title + '". Ask ONE short, friendly question that leads them there from what any player knows, like "' + t.should_ask + '" Do not give the answer.', t.should_ask);
      }
      pending = null;
      // the first time, name what they just did: both halves make a bug report
      var lead = function (first) { return first + (taught ? '' : ' That’s a real bug report: what happened, and what should have.'); };
      var wasTaught = taught; taught = true;
      if (stuck) return onward(lead('Here’s the idea: ' + t.should.charAt(0).toLowerCase() + t.should.slice(1)));
      if (tk) { tk.should = String(text).slice(0, 120); save(); paintTickets(); }
      if (!aiUp()) return onward(lead(wasTaught ? 'Exactly.' : 'Yes, that’s it.'));
      mentor(text, null, who, 'TASK: the kid said what should have happened for the problem "' + t.title + '": "' + text + '". The idea to reach: "' + t.should + '". In ONE short line, build on their own words: if they have it, say so; if not quite, lead them the rest of the way. Nothing else.')
        .then(function (res) { if (frame() !== f) return; onward(lead((res && res.reply) || 'Yes, that’s it.')); });
      return false;
    }
    Chat.expect(function () { return pending && pending.kind === 'should' ? 'Like “it should…”' : pending ? 'Say what you saw, heard or did…' : more() ? 'Something else you noticed…' : 'Like “the jump feels floaty”…'; }, function (text) {
      if (frame() !== f) return;
      if (pending && pending.kind === 'should') {
        // "oh and the lava doesn't hurt" is a new finding, not the answer to what should have happened
        var other = concrete(text).filter(function (t) { return !S.tickets[t.id]; });
        if (!other.length || /\bshould\b/i.test(text)) return should(text);
        pending = null;
      }
      var aim = pending && pending.aim ? ticketOf(pending.aim) : null;
      // the answer to a nudge: "nothing", to what did you hear, is the finding
      if (aim && !S.tickets[aim.id] && !IDK.test(text) && aim.nudge_yes && new RegExp('\\b(?:' + aim.nudge_yes + ')', 'i').test(text)) {
        var own = text.trim().length >= 12;   // "nothing" alone would read oddly on the ticket's page
        return filed([aim], own ? text : null, null, own ? null : 'You');
      }
      /* A question back ("what lava?") is not the finding: the AI took it as one in Jay's playthrough
         (Sept 30) and filed the lava for a kid who didn't know there was any. Answered once, by
         saying where to look again; the nudge says what the thing is. */
      if (aim && !pending.asked && ASKING.test(text)) { pending.asked = true; say(['Good question. ' + aim.nudge], who); Chat.placeholder(); return false; }
      if (aim && STUCK.test(text)) return retry();
      // stuck mid-dig ("idk", "nothing"): the next rung, a different way in, without their "idk" in the ticket
      if (pending && pending.kind === 'dig' && STUCK.test(text)) {
        if (pending.n >= 3) { idea(pending.said.join('. '), true); return onward('That’s okay. I’ve kept it as an idea.'); }
        return dig(pending.said);
      }
      if (DONE.test(text) || FINISH.test(text)) return wantsOut();
      var said = pending && pending.kind === 'dig' ? pending.said.concat([text]) : [text], words = said.join('. ');
      var hit = concrete(text), fresh = hit.filter(function (t) { return !S.tickets[t.id]; });
      if (fresh.length) return filed(fresh, words);
      var unfiled = COURSE.tickets.filter(function (t) { return !S.tickets[t.id]; });
      // a word shared with a filed ticket is not proof it's the same problem: the AI, when it's up, decides
      if (hit.length && (!unfiled.length || !aiUp())) return onward('That’s ticket #' + number(hit[0].id) + ' already. Good detail.');
      // still no problem after the follow-ups: keep it, and move on kindly
      if (aim && pending.n >= 2) return retry();
      if (pending && pending.n >= 3) { idea(words, true); return onward('I’ve kept that as an idea.'); }
      // a feeling is always asked about first, never sorted into a ticket on its own
      if (!pending && FEEL.test(text)) return dig(said);
      if (!unfiled.length || !aiUp()) return aim ? retry() : dig(said);
      // the last option: they're done, or asking to move on ("ok where", "where are the tickets?"):
      // the conversation moves the day on, not a magic phrase (Jay, 2026-09-30)
      var hidden = { text: 'Which problem did the kid just report?', options: unfiled.map(function (t) { return { text: t.title + (t.says ? ' (a kid might say “' + t.says + '”)' : '') }; })
        .concat(more() ? [{ text: 'None: they are done reporting, or asking what happens next' }] : []) };
      var filedNow = COURSE.tickets.filter(function (t) { return S.tickets[t.id]; }).map(function (t) { return '#' + number(t.id) + ' ' + t.title; }).join('; ');
      mentor(words, hidden, who, 'TASK: the kid is reporting something broken they found while playing.' + (aim ? ' You just asked them: "' + aim.nudge + '"' : '') + ' Everything they said about it: "' + said.join(' / ') + '". ' + LEVEL + (filedNow ? ' Already on the board: ' + filedNow + '. Only say it is one of those if it clearly is.' : '') + ' Only if that clearly describes one of the listed problems, set choose to it and reply in one short line. If it is vague, a feeling, or a thing with no problem yet, do not choose: ask ONE short question that pushes them to explain what exactly they saw, heard or did (you may say what a thing is, like "that dip is meant to be lava: what happens when you walk into it?"). If they are done or asking what is next, choose the "done" option and reply in one short line. Never say what is wrong with anything, and never bring up a thing they have not mentioned, even if the game saw them touch it: finding it is their job.')
        .then(function (res) {
          if (frame() !== f) return;
          if (res && res.choose === unfiled.length + 1 && more()) { wantsOut(); return; }
          if (res && res.choose && unfiled[res.choose - 1]) { filed([unfiled[res.choose - 1]], words, res.reply); return; }
          if (res && res.reply && /\?\s*["”]?\s*$/.test(res.reply)) { pending = { kind: 'dig', said: said, n: (pending && pending.kind === 'dig' ? pending.n : 0) + 1, aim: aim && aim.id }; say([res.reply], who); Chat.placeholder(); return; }
          if (aim) retry(); else dig(said);   // no question from the AI ("noted!"): the ladder asks its own
        });
      return false;   // still listening: returning false keeps the box expecting a finding (chat.js expect)
    }, { who: who, takesHelp: function () { return !!pending; } });
    function finish(reply) {
      S.reported = true; save();
      say([reply || 'Great report. Those are your tickets now.'], who);
      next();
    }
  }

  /* A hero, typed: "a dragon", "a pizza with legs". The AI composes one from the drawer's parts
     (decision R2: shape heroes, drawn by the game's own code); without it, the nearest of a table
     of presets, said honestly as a guess. Either way the kid can ask for changes after. */
  var BODIES = ['box', 'round', 'tall', 'blob', 'wide'];
  var EYES = ['dots', 'big', 'visor', 'angry', 'sleepy', 'one'];
  var EXTRAS = ['horns', 'ears-cat', 'ears-round', 'ears-bunny', 'antenna', 'crown', 'hat-wizard', 'helmet', 'cape', 'wings', 'tail', 'spikes', 'snout', 'beak', 'fins', 'flame', 'leaf', 'whiskers', 'bow', 'scarf', 'cap', 'mustache'];
  function hex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; }
  function cleanHero(h) {
    if (!h || typeof h !== 'object') return null;
    return {
      body: BODIES.indexOf(h.body) >= 0 ? h.body : 'box',
      color: hex(h.color) || '#5aa9e6', belly: hex(h.belly),
      eyes: EYES.indexOf(h.eyes) >= 0 ? h.eyes : 'dots', eyeColor: hex(h.eyeColor),
      extras: (Array.isArray(h.extras) ? h.extras : []).filter(function (e) { return e && EXTRAS.indexOf(e.kind) >= 0; })
        .slice(0, 5).map(function (e) { return { kind: e.kind, color: hex(e.color) }; })
    };
  }
  function X(kind, color) { return { kind: kind, color: color || null }; }
  var PRESETS = [
    [/dragon|dino|lizard/, { body: 'box', color: '#4caf50', belly: '#c5e1a5', eyes: 'angry', extras: [X('horns', '#fff3c4'), X('wings', '#2e7d32'), X('tail', '#4caf50'), X('spikes', '#ffb74d')] }],
    [/cat|kitten|tiger|lion/, { body: 'round', color: '#ffa726', belly: '#ffe0b2', eyes: 'big', extras: [X('ears-cat'), X('whiskers'), X('tail')] }],
    [/robot|bot|machine|android/, { body: 'box', color: '#90a4ae', eyes: 'visor', eyeColor: '#4fc3f7', extras: [X('antenna', '#ef5350')] }],
    [/knight|soldier|warrior/, { body: 'tall', color: '#b0bec5', eyes: 'dots', extras: [X('helmet', '#78909c'), X('cape', '#c62828')] }],
    [/frog|toad/, { body: 'wide', color: '#66bb6a', belly: '#dcedc8', eyes: 'big', extras: [] }],
    [/slime|goo|blob|jelly/, { body: 'blob', color: '#9ccc65', eyes: 'dots', extras: [] }],
    [/alien|martian/, { body: 'tall', color: '#81c784', eyes: 'one', extras: [X('antenna', '#81c784')] }],
    [/ghost|spirit/, { body: 'round', color: '#eceff1', eyes: 'sleepy', extras: [] }],
    [/dog|puppy|wolf|fox/, { body: 'box', color: '#a1887f', belly: '#efebe9', eyes: 'big', extras: [X('ears-round', '#6d4c41'), X('snout', '#d7ccc8'), X('tail')] }],
    [/bird|chick|duck|penguin|owl/, { body: 'round', color: '#ffee58', eyes: 'dots', extras: [X('beak', '#ff9800'), X('wings')] }],
    [/fish|shark/, { body: 'wide', color: '#4fc3f7', eyes: 'dots', extras: [X('fins', '#0288d1'), X('tail', '#0288d1')] }],
    [/unicorn|horse|pony/, { body: 'box', color: '#f8bbd0', eyes: 'big', extras: [X('horns', '#ffd54f'), X('tail', '#ce93d8')] }],
    [/bunny|rabbit/, { body: 'round', color: '#f5f5f5', belly: '#f8bbd0', eyes: 'big', extras: [X('ears-bunny')] }],
    [/wizard|witch|mage/, { body: 'tall', color: '#7e57c2', eyes: 'dots', extras: [X('hat-wizard', '#4527a0')] }],
    [/king|queen|prince|princess/, { body: 'tall', color: '#ec407a', eyes: 'dots', extras: [X('crown', '#ffd54f'), X('cape', '#6a1b9a')] }],
    [/fire|flame|lava/, { body: 'round', color: '#ff7043', eyes: 'angry', extras: [X('flame')] }],
    [/plant|tree|sprout|flower/, { body: 'round', color: '#8bc34a', eyes: 'sleepy', extras: [X('leaf', '#43a047')] }],
    [/monster|beast/, { body: 'wide', color: '#8e24aa', eyes: 'one', extras: [X('horns', '#fff3c4'), X('spikes', '#ce93d8')] }],
    [/pizza|food|burger|cookie/, { body: 'wide', color: '#ffca28', belly: '#e53935', eyes: 'big', extras: [] }],
    [/bear|panda/, { body: 'round', color: '#8d6e63', belly: '#d7ccc8', eyes: 'dots', extras: [X('ears-round')] }],
    [/mario|plumber/, { body: 'round', color: '#e53935', belly: '#1e88e5', eyes: 'dots', extras: [X('cap', '#e53935'), X('mustache')] }],
    [/luigi/, { body: 'tall', color: '#43a047', belly: '#1e88e5', eyes: 'dots', extras: [X('cap', '#43a047'), X('mustache')] }],
    [/sonic|hedgehog/, { body: 'round', color: '#1e88e5', belly: '#ffe0b2', eyes: 'big', extras: [X('spikes', '#1565c0')] }]
  ];
  var COLOR_WORDS = { red: '#e53935', blue: '#1e88e5', green: '#43a047', yellow: '#fdd835', purple: '#8e24aa', pink: '#f06292', orange: '#fb8c00', black: '#37474f', white: '#f5f5f5', gold: '#ffc107', grey: '#9e9e9e', gray: '#9e9e9e', brown: '#8d6e63' };
  function preset(text) {
    var t = text.toLowerCase(), p = PRESETS.filter(function (x) { return x[0].test(t); })[0];
    var h = JSON.parse(JSON.stringify(p ? p[1] : { body: 'box', color: '#5aa9e6', eyes: 'big', extras: [] }));
    var c = Object.keys(COLOR_WORDS).filter(function (w) { return new RegExp('\\b' + w + '\\b').test(t); })[0];
    if (c) h.color = COLOR_WORDS[c];
    return { hero: cleanHero(h), close: !!p };
  }
  function setHero(shape, word) {
    if (!shape) return;
    Editor.set('player', 'shape', shape);
    if (Project.part('player').look !== 'hero') Editor.set('player', 'look', 'hero');
    // the kid's own words go in the doc as a start; the second round digs into the hero (design.js)
    if (word) { S.hero = word; save(); card({ hero: word }); Project.writeDoc('hero', word, 'kid', 'started'); }
    setTimeout(Runner.askThumbs, 600);
  }
  function examples(a) { return (a.examples || []).map(function (x) { return { text: x }; }); }
  /* Draw the hero from everything the kid has said about it: the AI from the drawer's parts, or,
     with it down, the nearest preset with their colour. `then(line)` gets what to say. */
  function composeHero(said, word, who, then) {
    var text = said.join('. '), p = preset(text), plain = p.close ? 'Here’s your ' + word + '!' : 'Here’s my best guess at a ' + word + '.';
    // "the spikes look weird": what they don't like comes off (Jay, Sept 30: it was praised instead)
    var last = said[said.length - 1], gone = NOT_LIKED.test(last) ? p.hero.extras.filter(function (x) { return new RegExp('\\b' + x.kind.replace(/-.*/, '').replace(/s$/, '') + 's?\\b', 'i').test(last); }) : [];
    if (gone.length) { p.hero.extras = p.hero.extras.filter(function (x) { return gone.indexOf(x) < 0; }); plain = 'I took the ' + gone.map(function (x) { return x.kind.replace(/-/g, ' '); }).join(' and the ') + ' off.'; }
    else if (said.length > 1) plain = 'I changed it. Take a look.';
    if (!aiUp()) { setHero(p.hero, word); return then(plain); }
    mentor(said[said.length - 1], null, who, 'TASK: the kid is describing their game’s hero. Everything they said about it: "' + said.join(' / ') + '". Set `hero` to a hero drawn from the parts listed under HERO, as close to that as the parts allow (a cap and mustache for a plumber, say), and change what they asked to change. Reply in one short, excited line saying what you drew. It shows in the Game view.')
      .then(function (res) { var shape = res && cleanHero(res.hero); setHero(shape || p.hero, word); then((shape && res.reply) || plain); });
  }
  /* A hero, typed, and the first lesson in telling an AI what you want (Jay, 2026-09-30: "Kids are
     10-14 ... arent going to have clear instructions right out the gate for the AI, we need to teach
     that through this"). A kid says "mario"; the Mentor draws its guess, then asks them to say what
     it looks like, because it only knows what they tell it. What they describe is drawn with the
     rest, and the Mentor says why it got closer. One round, then on: a lesson, not a quiz. A kid who
     describes it the first time is told that was exactly right. */
  // words the drawer can draw: "with", "has" and "big" were here, and "a dog with a bone" was praised
  // as a perfect description (critique, Sept 30)
  var DESCRIBES = /\b(red|blue|green|yellow|purple|pink|orange|black|white|gold|grey|gray|brown|hat|cap|crown|helmet|wings?|horns?|tail|ears?|eyes?|round|tall|fat|mustache|moustache|overalls|cape|spikes|antenna|scarf|beak|snout|whiskers)\b/i;
  var NOT_LIKED = /\b(weird|ugly|bad|wrong|gross|remove|without|no|don['’]?t (like|want)|get rid|take (off|away)|too (big|much|many))\b/i;
  /* The hero's name from what was typed: "Uhh, maybe like sonic" was taken whole, and the Mentor
     said "Here's your Uhh, maybe like sonic!" and offered "Uhh, Maybe Like Sonic Lava Run" as a name
     (Jay, Sept 30). The filler comes off the front; a hero the presets know is called by its name. */
  var LEAD = /^\s*(u+h+|u+m+|h+m+|er+m*|well|so|ok(ay)?|maybe|probably|perhaps|like|kinda|kind of|sort of|something like|i think|i guess|idk|i want|i['’]?d like|it['’]?s|it should be|my hero is|a|an|my|the)\b[\s,.!…-]*/i;
  function bare(text) { var w = String(text); for (var n = 0; n < 8 && LEAD.test(w); n++) w = w.replace(LEAD, ''); return w; }
  function heroWord(text) {
    var w = bare(text);
    var hit = PRESETS.filter(function (x) { return x[0].test(text.toLowerCase()); })[0], m = hit && text.toLowerCase().match(hit[0]);
    if (m && w.split(/\s+/).length > 3) w = m[0];
    return (w.replace(/[.!?,…]+$/, '').trim() || String(text)).slice(0, 40);
  }
  function shapeNow() { return JSON.stringify(Project.part('player').shape || null); }
  var HAPPY = /^\s*(ok(ay)?|good|fine|perfect|yes|yeah|yep|cool|nice|great|love (it|him|her)|looks? (good|great)|that'?s (it|good|great))\s*[.!]*\s*$/i;
  function askHero(a, who) {
    var f = frame(), ex = (a.examples || [])[0], said = [], word = null;
    say([fill(a.text)], who);
    Chat.expect(function () { return said.length ? 'Like “red, with a cap and a moustache”…' : ex ? 'Like “' + ex.toLowerCase() + '”…' : 'Describe your hero…'; }, function (text) {
      if (frame() !== f) return;
      var first = !said.length;
      if (!first && HAPPY.test(text)) { say(['Great, that’s your hero. Want it different later? Just tell me.'], who); Chat.stopExpecting(); next(); return; }
      said.push(text); S.heroSaid = said.slice(-6);   // the name step may hear more about it
      if (first) word = heroWord(text);
      var clear = DESCRIBES.test(text) || bare(text).trim().split(/\s+/).length >= 5, before = shapeNow();
      composeHero(said, word, who, function (line) {
        if (frame() !== f) return;
        /* Praise only what the drawing shows: a description that changed nothing is not "exactly
           what you wanted", and "the more you tell me, the closer I get" under an unchanged hero
           teaches the wrong thing (critique, Sept 30). */
        var changed = shapeNow() !== before;
        if (first && !(clear && changed)) { say([line, 'That’s my guess. I only know what you tell me: what do they look like? Colours, a hat, anything.'], who); Chat.placeholder(); return; }
        if (!first && !changed && said.length < 3) { say(['I couldn’t draw that part, so it looks the same. Try a colour, a hat, ears, wings or a tail.'], who); Chat.placeholder(); return; }
        say([line, first ? 'You told me exactly what you wanted. That’s how to get what you want from an AI.' : changed ? 'See? The more you tell me, the closer I get. Want changes later? Just ask.' : 'That’s your hero for now. Want changes later? Just ask.'], who);
        Chat.stopExpecting(); next();
      });
      return false;
    }, { who: who, card: { text: fill(a.text), options: examples(a) } });
  }

  var TALK = /^(yeah|yes|no|nah|ok(ay)?|but|wait|i mean|why|what|how|um+|uh+|lol|hey)\b|\b(you|your|didn['’]?t|isn['’]?t|doesn['’]?t|not|looks?|change|made|drew)\b/i;
  var HERO_TALK = /\b(guy|character|hero|him|her|he|she|looks?|made|drew|colou?r|hat|cap|mustache|moustache)\b/i;
  /* The game's name, typed. "idk" gets three names to pick from, the suggestions (chat.js, expect). */
  function askName(a, who) {
    var f = frame();
    var h = (S.hero || 'hero').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    say([fill(a.text)], who);
    Chat.expect('Like “' + h + ' Lava Run”…', function (text) {
      if (frame() !== f) return;
      /* Not every line is the name: "yeah thats just a blue guy" was about the hero, and became the
         game's title (Jay's playtest, Sept 30). Talk about the hero redraws it; other talk gets the
         question again, with its example. */
      if (TALK.test(text) || text.trim().split(/\s+/).length > 6) {
        if (HERO_TALK.test(text) && S.hero) {
          S.heroSaid = (S.heroSaid || [S.hero]).concat([text]).slice(-6);
          composeHero(S.heroSaid, S.hero, who, function (line) { if (frame() === f) say([line, 'And what’s your game called? Just the name, like “' + h + ' Lava Run”.'], who); });
        } else say(['Got it. First, what’s your game called? Just the name, like “' + h + ' Lava Run”.'], who);
        return false;
      }
      var n = text.replace(/^(it'?s |my game is |call it |it is )(called )?/i, '').replace(/^["“']|["”'.!]+$/g, '').trim().slice(0, 40) || text.slice(0, 40);
      // typed all in lower case, as kids type: a title gets its capitals ("dragon dash" → "Dragon Dash")
      if (n === n.toLowerCase()) n = n.replace(/(^|\s)(\S)/g, function (m, s, c) { return s + c.toUpperCase(); });
      setName(n, who);
    }, { who: who, card: { text: 'How about one of these?', options: [h + ' Lava Run', 'Coin Quest', 'Leap of Fire'].map(function (n) { return { text: n }; }) } });
  }
  /* The class list shows each kid's game and hero, so a returning kid can spot theirs. */
  function card(fields) { if (!window.__studioKid) return; fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }).catch(function () {}); }
  function setName(n, who) {
    S.name = n; save(); card({ game: n });
    Editor.reveal('projName', true); Editor.setProjectName(n);
    say(['“' + n + '”. Love it. It’s up in the menu bar now.'], who);
    next();
  }

  /* The end-of-day questions: typed, sent to whoever runs the playtest, and thanked. */
  function askFeedback(a, who) {
    var f = frame(), ex = (a.examples || [])[0];
    say([fill(a.text)], who);
    Chat.expect(ex ? 'Like “' + ex + '”…' : 'Type your answer…', function (text) {
      if (frame() !== f) return;
      track('survey', { q: a.text, a: text.slice(0, 200) });
      say(['Thanks. That helps a lot.'], who);
      next();
    }, { who: who, card: { text: fill(a.text), options: examples(a) } });
  }

  /* The Director sums up the day: the AI's words when it's up, the facts when it isn't. */
  function recap(then) {
    var fixed = Object.keys(S.tickets).filter(function (id) { return S.tickets[id].status === 'done'; }).length;
    var facts = 'Today they fixed ' + fixed + ' ticket' + (fixed === 1 ? '' : 's') + ', earned ' + (S.stars || 0) + ' stars and the cards ' + (S.cards.map(function (c) { return cardOf(c).name; }).join(', ') || 'none') + '. Their game: ' + (S.name || 'unnamed') + ', starring a ' + (S.hero || 'hero') + '. Things they built with the AI: ' + (S.built || 0) + '.';
    var plain = function () {
      say(['Great first day, @name.', 'You fixed ' + fixed + (fixed === 1 ? ' ticket' : ' tickets') + ' and earned ' + S.cards.length + (S.cards.length === 1 ? ' card.' : ' cards.')], 'r');
      then();
    };
    if (!aiUp()) return plain();
    mentor('(the end of the day)', null, 'r', 'TASK: you are the Studio Director, and the kid is clocking out. In two short lines: one specific thing they did well today, and one thing to try next shift. Use their first name. FACTS: ' + facts)
      .then(function (res) { if (res && res.reply) { say([res.reply], 'r'); then(); } else plain(); });
  }

  /* ---------- everything that happens comes through here ---------- */
  function handle(ev) {
    if (!S || !COURSE) return;
    remember(ev);
    if (ev.type === 'play' || ev.type === 'select') Editor.point(null);   // the pointer's job is done once they act
    if (ev.type === 'event' || ev.type === 'set' || ev.type === 'play') checkTickets(ev);
    if (ev.type === 'event') Chat.event(EVENT_WORDS[ev.name] || ev.name, EVENT_ICON[ev.name] || 'i-pad', { consoleOnly: !S.reported || !IN_CHAT[ev.name] });
    if (ev.type === 'select' || ev.type === 'set' || ev.type === 'play' || ev.type === 'stop') busyKid();
    var f = frame(); if (!f) return;
    var q = quest(f), b = beat(f);
    ((b && b.on) || []).concat(q.on || []).forEach(function (h, n) {
      var key = (b && b.on && n < b.on.length ? 'b' : 'q') + n;
      if (h.once && f.fired[key]) return;
      if (!matches(h.when, ev, f)) return;
      var sig = f.quest + f.beat + key + (ev.type || '') + (ev.name || '');
      if (Date.now() - (lastFired[sig] || 0) < 1500) return;   // one line per thing, not one per frame
      lastFired[sig] = Date.now();
      f.fired[key] = true;
      if (h.flag) f.flags[h.flag] = true;
      if (h.cue) Editor.cue(h.cue);
      speak(h);
    });
    if (b && b.wait_for && !f.completing && matches(b.wait_for, ev, f)) complete();
    paintDev();
  }
  /* The game's events, as the rows the chat and the Console show. On the first day, before the kid
     has reported what they found, they go to the Console only: the chat doesn't tell them. */
  var EVENT_WORDS = { fell: 'The player fell off the level', coin: 'Coin grabbed', lava: 'The player touched the lava', hurt: 'The lava sent the player back', crossed: 'The player stood on the floor tile', cleared: 'Every coin grabbed' };
  var EVENT_ICON = { fell: 'i-flag', coin: 'i-star', lava: 'i-flag', hurt: 'i-flag', crossed: 'i-check', cleared: 'i-star' };
  var IN_CHAT = { fell: true, hurt: true, cleared: true };   // the rest would be a row per coin: Console only

  /* ---------- typed messages: the character whose thread is open answers ---------- */
  /* What the AI may set: what schema.js says the part can hold, on a component the kid can see, and
     never the fix the kid is working on (that would be the answer). */
  function protectedKeys() {
    var out = {};
    S.stack.forEach(function (f) {
      var t = quest(f).ticket && ticketOf(quest(f).ticket);
      if (t && t.fixed_when && t.fixed_when.state) Object.keys(t.fixed_when.state).forEach(function (k) { out[k] = true; });
    });
    return out;
  }
  function visible(p, key) {
    var shown = Editor.allowed();
    return Schema.components(p.kind).length === 0 || Schema.components(p.kind).some(function (c) {
      return (!c.gate || shown[c.gate]) && (c.toggle === key || (c.fields || []).some(function (x) { return x.key === key && !x.readonly && (!x.gate || shown[x.gate]); }));
    });
  }
  function allowed(a) {
    var p = Project.part(a.part);
    return !!p && Schema.can(p, a.key, a.value) && visible(p, a.key) && !protectedKeys()[a.part + '.' + a.key];
  }
  /* What the AI is told, every time: who it is speaking as, the job and what done looks like, the
     task line the kid can see, the question on screen WITH its answer key, what just happened in the
     game, and the parts by their Inspector names. The review of V1's prompts (2026-09-29) found the
     old block left out the goal, the answer key and the game's events, and named settings by their
     code keys ("solid") where the kid sees "Box Collider 2D"; a model can't steer a kid toward an
     answer it was never told, or name a panel it only knows by a key. */
  function context(qOnScreen, who, task) {
    var f = frame(), q = f && quest(f), b = f && beat(f), out = [];
    out.push('You are speaking as ' + NAME[BY_VOICE[who] || 'mentor'] + '.');
    if (q) {
      var tk = q.ticket && ticketOf(q.ticket), idea = q.concept && CARDS[q.concept];
      out.push('Quest: "' + q.title + '" (' + DEPT[q.department] + ').'
        + (tk ? ' It fixes the ticket ' + titleOf(tk) + ': ' + tk.detail : '')
        + (idea ? ' The idea it teaches: ' + idea[0] + ' (' + idea[1] + ')' : ''));
      if (b && b.goal) out.push('The task line on their screen: "' + fill(b.goal) + '".');
      if (b && b.say) out.push('This step just said: ' + b.say.map(fill).join(' ') + (b.instruct ? ' Then: ' + fill(b.instruct) : ''));
      if (b && b.wait_for) {
        var rung = Math.min(f.rung || 0, (b.hints || []).length);
        out.push('The step is done when they ' + describe(b.wait_for) + '. THIS IS THEIR JOB TO FIGURE OUT: do not do it for them, and do not name the exact setting before the last hint.');
        if (b.hints) out.push('The hint ladder (they have had ' + rung + ' of ' + b.hints.length + '): ' + b.hints.map(function (h, n) { return (n + 1) + '. ' + fill(h); }).join(' ')
          + (rung < b.hints.length ? ' If they are stuck, give hint ' + (rung + 1) + ' in your own words.' : ' They have had every hint; if they are still stuck, walk them through it one step at a time.'));
      }
    } else out.push('No quest is running: the game is theirs now. Help them make it what they want. Build what they ask for.');
    if (task) out.push(task);
    if (qOnScreen) {
      var key = b && b.ask && b.ask.text && fill(b.ask.text) === qOnScreen.text ? b.ask.answers : null;
      out.push('Question on screen: "' + qOnScreen.text + '"' + (qOnScreen.typed ? ' (they may tap an example or type their own answer)' : '') + '. Answers: '
        + qOnScreen.options.map(function (o, n) {
          var k = key && key.filter(function (x) { return x.text === o.text; })[0];
          return (n + 1) + '. ' + o.text + (o.sub ? ' (' + o.sub + ')' : '') + (k && k.correct ? ' [THE RIGHT ANSWER]' : '') + (k && k.say ? ' [the studio replies: ' + k.say.map(fill).join(' ') + ']' : '');
        }).join('  ') + '.' + (key && key.some(function (x) { return x.correct; }) ? ' It is a quiz: never say which answer is right; help them think it through.' : '')
      // "That's exactly it!" with the card still up asked again what they had just answered (Jay, Sept 30)
      + ' If what they typed means one of these answers, in any words, set choose to it and let the studio\'s reply do the talking: do not also explain it yourself.');
    } else out.push('No question on screen.');
    out.push('What just happened (oldest first): ' + (recent.length ? recent.map(function (r) { return r[1] + ' (' + Math.round((Date.now() - r[0]) / 1000) + 's ago)'; }).join('; ') : 'nothing yet') + '.');
    out.push('Tickets: ' + (Object.keys(S.tickets).map(function (id) { var t = ticketOf(id); return t ? titleOf(t) + ' [' + S.tickets[id].status + ']' : ''; }).join('; ') || 'none yet') + '.');
    out.push('Panels on screen: ' + S.shown.join(', ') + ', the chat.' + (Runner.isPlaying() ? ' The game is running (Play mode).' : ' The game is stopped.'));
    var keep = protectedKeys();
    out.push('Parts now, with each setting as the Inspector names it [and its key]: ' + Project.get().parts.map(function (p) {
      var r = Schema.rules(p);
      return p.name + ' (id ' + p.id + ', ' + p.kind + ': ' + Object.keys(r).map(function (k) { return Schema.label(p.kind, k) + ' [' + k + ']=' + JSON.stringify(p[k]); }).join(', ') + ')';
    }).join('; ') + '.');
    out.push('You can change (as actions): ' + Project.get().parts.map(function (p) {
      var ok = Schema.describe(p).split(', ').filter(function (d) { var k = d.split(' ')[0]; return visible(p, k) && !keep[p.id + '.' + k]; });
      return ok.length ? p.id + ': ' + ok.join(', ') : '';
    }).filter(Boolean).join('; ') + '. Sprites: ' + Object.keys(Schema.SPRITES).map(function (k) { return k + ' (' + Schema.SPRITES[k][0] + ')'; }).join(', ') + '. Sounds: ' + Object.keys(Schema.SOUNDS).map(function (k) { return k + ' (' + Schema.SOUNDS[k][0] + ')'; }).join(', ') + '.');
    out.push('HERO (for `hero`): body ' + BODIES.join('/') + '; color, belly, eyeColor as #rrggbb; eyes ' + EYES.join('/') + '; up to 5 extras, each {kind, color}, kinds: ' + EXTRAS.join(', ') + '.'
      + (Project.part('player') && Project.part('player').shape ? ' Their hero now: ' + JSON.stringify(Project.part('player').shape) + '.' : ''));
    out.push('Their game: ' + (S.name || 'not named yet') + '. Ideas they’ve had: ' + (Project.doc().ideas.slice(-5).join(' | ') || 'none') + '.');
    return out.join('\n').slice(0, 7000);
  }
  /* The last few things the game and the kid did, for context(): the AI's "game log". */
  var recent = [];
  function remember(ev) {
    var w = ev.type === 'event' ? (EVENT_WORDS[ev.name] || ev.name)
      : ev.type === 'play' ? 'They pressed Play' : ev.type === 'stop' ? 'They pressed Stop'
      : ev.type === 'reverted' ? 'Stop undid what they changed while playing'
      : ev.type === 'select' ? 'They tapped ' + ((Project.part(ev.name) || {}).name || ev.name) + ' in the Hierarchy'
      : ev.type === 'set' && ev.detail ? 'They set ' + ((Project.part(ev.detail.id) || {}).name || ev.detail.id) + ' ' + Schema.label((Project.part(ev.detail.id) || {}).kind, ev.detail.key) + ' to ' + JSON.stringify(ev.detail.value)
      : ev.type === 'filed' ? 'A ticket was filed: ' + ev.name : ev.type === 'built' ? 'The Builder changed the game' : null;
    if (!w) return;
    var last = recent[recent.length - 1];
    if (last && last[1].replace(/ ×\d+$/, '') === w) { last[2]++; last[1] = w + ' ×' + last[2]; last[0] = Date.now(); return; }
    recent.push([Date.now(), w, 1]);
    if (recent.length > 8) recent.shift();
  }
  function describe(c) {
    if (c.event) return { fell: 'fall through a floor', coin: 'grab a coin', lava: 'touch the lava', hurt: 'get hurt by the lava', crossed: 'stand on the fixed floor tile in Play mode', cleared: 'grab every coin' }[c.event] || c.event;
    if (c.select) return 'tap ' + c.select + ' in the Hierarchy';
    if (c.state) return 'set ' + Object.keys(c.state).map(function (k) { return k + ' to ' + JSON.stringify(c.state[k]); }).join(' and ');
    if (c.stop) return 'press Stop';
    if (c.reverted) return 'change something while playing, then press Stop and see it undo';
    return 'carry on';
  }
  function aiUp() { return aiFails < 2; }
  /* One call to the mentor agent, with a deadline. Resolves the answer, or null when there isn't one
     (and says so in the thread, honestly, unless `quiet`). */
  function mentor(text, qOnScreen, who, task) {
    var wait = Chat.thinking(who);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, AI_MS);
    var f = frame();
    return fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ agent: 'mentor', message: text, history: Chat.history(),
        where: f ? quest(f).title + ', on step "' + (beat(f) ? beat(f).id : 'end') + '".' : 'Their own game, no quest running.',
        studio: context(qOnScreen, who, task) })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        clearTimeout(timer); wait.done();
        if (!res.ok || !res.j.reply) { aiFails++; return null; }
        aiFails = 0; return res.j;
      }, function () { clearTimeout(timer); wait.done(); aiFails++; return null; });
  }
  /* Something the kid wanted, kept so it isn't lost: the design doc's "Ideas for later" (project.js),
     which is Project › Docs › Ideas until the doc itself has been opened up. */
  function idea(text, quiet) {
    Project.docIdea(text);
    Editor.project();
    if (!quiet) Chat.event(S.shown.indexOf('doc') >= 0 ? 'Saved to Ideas for later, in your design doc' : 'Saved to your Ideas (Project › Docs)', 'i-bulb');
  }
  var ASKS_FOR = /\b(make|add|can you|could you|i want|put|give|change|turn|let'?s|build|create)\b/i;
  // which answer on the card the kid's words name: the one sharing the most words with it, if only one does
  var FILLER_WORD = /^(its?|it['’]s|the|a|an|to|so|of|is|was|you|i|my|that|this|and|or|by|it’s)$/i;
  function answerFrom(text, options) {
    function ws(s) { return String(s).toLowerCase().replace(/[^a-z0-9’' ]+/g, ' ').split(/\s+/).filter(function (w) { return w && !FILLER_WORD.test(w); }); }
    var mine = ws(text);
    var scores = options.map(function (o) { var theirs = ws(o.text); return mine.filter(function (w) { return theirs.indexOf(w) >= 0; }).length; });
    var best = Math.max.apply(null, scores.concat([0]));
    return best > 0 && scores.filter(function (s) { return s === best; }).length === 1 ? scores.indexOf(best) : -1;
  }
  function typed(text, qOnScreen, who) {
    who = who || Chat.active() || 'm';
    track('typed', { to: who, text: text.slice(0, 200) });
    busyKid();
    // help, instantly and with no AI: the next rung of the ladder
    if (HELP.test(text) && frame() && beat() && beat().hints && Chat.active() === voice()) { giveHint('asked'); return; }
    /* An answer typed instead of tapped ("the box collider" for "Its Box Collider") is that answer, at
       once and with no AI: in Jay's playthrough (Sept 30) the AI took it as chat and the card came
       back, asking again what the kid had just said. */
    var said = qOnScreen && !qOnScreen.typed ? answerFrom(text, qOnScreen.options) : -1;
    if (said >= 0) { Chat.choose(said + 1); return; }
    if (!aiUp()) {
      if (ASKS_FOR.test(text)) { say(['I can’t reach the studio’s AI right now, so I can’t build that yet.', 'I saved it to your Ideas so we don’t forget it.'], who); idea(text); }
      else if (frame() && beat() && beat().hints) giveHint('offline');
      else say(['I can’t reach the studio’s AI right now, so I can’t answer that one.', 'Everything else still works.'], who);
      Chat.reask(); return;
    }
    Chat.hide();
    mentor(text, qOnScreen, who).then(function (j) {
      if (!j) {
        if (ASKS_FOR.test(text)) { say(['I couldn’t reach the studio’s AI just now, so I didn’t change anything.', 'I saved your idea to Ideas. Try asking again in a minute.'], who); idea(text); }
        else say(['I couldn’t reach the studio’s AI just now. Try asking again in a minute.'], who);
        return Chat.reask();
      }
      Chat.say([[who, j.reply]]);
      var acted = (j.actions || []).filter(allowed);
      acted.forEach(function (a) { Editor.set(a.part, a.key, a.value); });
      if (acted.length) Chat.event('Changed: ' + acted.map(function (a) { var p = Project.part(a.part); return (p ? p.name : a.part) + ' ' + a.key; }).join(', '), 'i-sliders');
      if (j.hero) { var h = cleanHero(j.hero); if (h) { setHero(h, null); Chat.event('Your hero was redrawn', 'i-palette'); } }
      if (j.build && window.Builder) return build(j.build, text, who);
      if (j.choose && Chat.question() === qOnScreen && qOnScreen && qOnScreen.options[j.choose - 1]) Chat.choose(j.choose);
      else Chat.reask();
    });
  }

  /* ---------- the Builder: changes the settings can't make (builder.js) ---------- */
  function build(brief, kidSaid, who) {
    if (Builder.busy()) { say(['I’m still building the last thing. One at a time!'], who); return Chat.reask(); }
    var wait = Chat.thinking(who, true);
    var f = frame();
    Builder.ask(brief, { kidSaid: kidSaid, studio: context(null, who), history: Chat.history(),
      where: f ? quest(f).title : 'Their own game, no quest running.' })
      .then(function (r) {
        wait.done();
        say([r.reply], who);
        if (r.ok) {
          S.built = (S.built || 0) + 1; save();
          Chat.event('Built: ' + (r.summary || brief), 'i-hammer', { kind: 'good' });
          Editor.project(); setTimeout(Runner.askThumbs, 800);
          handle({ type: 'built' });
          track('built', { brief: brief.slice(0, 200), summary: r.summary });
        } else { track('build-failed', { brief: brief.slice(0, 200) }); if (!r.held) idea(kidSaid, true); }
        Chat.reask();
      });
  }
  function watchBuilder() {
    if (!window.Builder) return;
    Builder.on(function (name, detail) {
      if (name === 'reverted') { $('gameStatus').textContent = ''; Chat.event('The last build was undone', 'i-undo'); }
      if (name === 'broke') {
        var who = Chat.active() || 'm';
        Chat.event('The game hit an error: ' + String(detail || '').slice(0, 80), 'i-flag', { kind: 'bad' });
        say(['That last change broke the game when it ran. Sorry!'], who);
        Chat.ask('Should I put it back?', [
          { text: 'Yes, undo it', run: function () { Builder.undo(); } },
          { text: 'No, keep it', run: function () { say(['Okay. Tell me what went wrong and I’ll try to fix it.'], who); } }
        ], { who: who, keepOrder: true });
      }
    });
  }

  /* Clocking out, from the File menu, once the first day is done. */
  function clockOut() {
    if (!COURSE.quests['clock-out']) return;
    S.done = S.done.filter(function (id) { return id !== 'clock-out'; });
    S.stack = [{ quest: 'clock-out', beat: 0, flags: {}, fired: {} }]; save(); enter();
  }

  /* ---------- the dev panel's handle (studio/dev.js; never served to a real deployment) ---------- */
  var devPaint = null;
  function paintDev() { if (devPaint) devPaint(); }

  function start(course) {
    COURSE = course;
    var st = Project.get();
    if (!st.quest) st.quest = { stack: [], tickets: {}, done: [], taught: [], shown: [], stars: 0, cards: [] };
    S = st.quest;
    S.seen = S.seen || {};
    delete S.ideas;   // they live in the design doc now; project.js moved an older save's across
    Object.keys(S.tickets).forEach(function (id) { if (!ticketOf(id)) delete S.tickets[id]; });   // a ticket the course no longer has
    if (S.stack.some(function (f) { return !COURSE.quests[f.quest]; })) S.stack = [];             // a quest it no longer has
    if (Object.keys(S.tickets).length && S.reported === undefined) S.reported = true;              // a save from before findings
    S.name = st.name || S.name;
    Runner.on(function (name) {
      if (name === 'play' || name === 'stop' || name === 'reverted') handle({ type: name });
      else if (EVENT_WORDS[name]) handle({ type: 'event', name: name });
      if (name === 'play') Chat.event('Play', 'i-play', { consoleOnly: true });
      if (name === 'stop') Chat.event('Stop', 'i-stop', { consoleOnly: true });
      if (name === 'reverted') Chat.event('Stop put back what changed in Play mode', 'i-undo');
      if (name === 'error') Chat.event('Error: ' + arguments[1], 'i-flag', { kind: 'bad', consoleOnly: true });
    });
    Editor.on(function (name, d) {
      if (name === 'select') handle({ type: 'select', name: d });
      if (name === 'set') handle({ type: 'set', detail: d });
    });
    Chat.onAsk(typed);
    watchBuilder();
    // Put the screen back the way this kid left it.
    S.shown.forEach(reveal);
    if (S.stars) Editor.stars(S.stars);
    Editor.project();
    if (S.name) Editor.setProjectName(S.name);
    paintTickets();
    if (!S.stack.length && S.done.indexOf('first-day') < 0) S.stack.push({ quest: 'first-day', beat: 0, flags: {}, fired: {} });
    S.stack.forEach(function (f) { f.completing = false; f.left = null; });
    if (S.stack.length) enter();
    else { free(); say(['Welcome back, @name! What should we build today?'], 'm'); }
  }

  return { start: start, handle: handle, clockOut: clockOut,
    cards: function () { return S ? S.cards.map(cardOf) : []; },
    ideas: function () { return Project.doc().ideas.slice(); },
    doneFirstDay: function () { return !!S && S.done.indexOf('first-day') >= 0; },
    /* For the kid's own menu (editor.js ME_ITEMS): the numbers, and what they're on now. */
    progress: function () {
      if (!S) return {};
      var ids = Object.keys(S.tickets), f = frame(), q = f && quest(f), b = f && beat(f);
      return { game: S.name || '', stars: S.stars || 0, cards: S.cards.length, tickets: ids.length,
               fixed: ids.filter(function (id) { return S.tickets[id].status === 'done'; }).length,
               quest: q ? q.title : '', task: b && b.goal ? fill(b.goal) : '' };
    },
    dev: {
      state: function () { return S; }, course: function () { return COURSE; },
      where: function () { var f = frame(); return f ? f.quest + ' › ' + (beat(f) ? beat(f).id : '(end)') : '(no quest)'; },
      skip: function () { var f = frame(); if (!f) return; f.completing = false; next(); },
      jump: function (questId, beatIndex) { S.stack = [{ quest: questId, beat: beatIndex || 0, flags: {}, fired: {} }]; save(); enter(); },
      fire: function (ev) { handle(ev); },
      onPaint: function (fn) { devPaint = fn; }
    } };
})();
