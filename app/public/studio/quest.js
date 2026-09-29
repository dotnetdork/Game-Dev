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
  var PANEL = { game: 'dGame', hierarchy: 'dHier', tickets: 'dTickets', play: 'transport', stars: 'stars', project: 'dProject', pause: 'stepTools', console: 'dConsole' };
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
    S.tickets[id] = { status: 'open', words: words ? String(words).slice(0, 80) : null, by: by || null, n: Object.keys(S.tickets).length + 1 };
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
        mine.status = 'done'; mine.early = true; save(); paintTickets();
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
        act.appendChild(el('p', 'tnote', 'The hint shows up in the chat. You can ask ' + asker + ' anything there too.'));
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
    var q = Chat.question();
    return q && q.picker === 'tickets' ? q.options.map(function (o) { return o.ticket; }).indexOf(t.id) : -1;
  }
  function fixTicket(t) {
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
    act(b.do);
    if (b.do && b.do.recap) return recap(function () { go(f, b); });
    go(f, b);
  }
  function go(f, b) {
    say(b.say);
    f.rung = 0; hints();
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
    if (q.ticket && S.tickets[q.ticket]) { S.tickets[q.ticket].status = 'done'; paintTickets(); }
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
  function hintNow(why) { Chat.hide(); giveHint(why); Chat.reask(); }
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
      giveHint('timer');
    }, (b.hints_after || 30) * 1000);
  }
  function giveHint(why) {
    var f = frame(), b = beat(f);
    if (!b || !b.hints) return false;
    var n = Math.min(f.rung || 0, b.hints.length - 1);
    say([b.hints[n]]);
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
    (d.file || []).forEach(function (id) { var t = ticketOf(id); file(id, null, t ? DEPT[t.department] : 'The studio'); });
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
  function askTickets(a, who) {
    var open = COURSE.tickets.filter(function (t) { return S.tickets[t.id] && S.tickets[t.id].status === 'open'; });
    if (!open.length) { var f = frame(); f.completing = false; return next(beat(f).next); }
    Chat.ask(fill(a.text), open.map(function (t) {
      return { text: t.title, sub: '#' + number(t.id) + ' · ' + DEPT[t.department], ticket: t.id, run: function () { startTicket(t); } };
    }), { who: who, picker: 'tickets' });
  }
  function startTicket(t) {
    S.tickets[t.id].status = 'doing'; paintTickets();
    S.stack.push({ quest: t.quest, beat: 0, flags: {}, fired: {} });
    save();
    enter();
  }

  /* What did you find? Typed, in the kid's words. Recognised here from each ticket's `words` first
     (instant, and works with no AI), then by the AI, which is shown the problems as a hidden
     question and picks the one the kid meant. Anything else they found is kept as an idea. */
  var DONE = /^\s*(no+,?\s+)?(no+|nope|nah|nothing( else)?|that['’]?s (it|all|everything)|(i['’]?m |all )?done|no more|none|finished|thats? all)\s*[.!]*\s*$/i;   // the whole line: "no sound on the coins" is a finding, not a no
  function askFindings(a, who) {
    var f = frame(), before = Object.keys(S.tickets).length;
    /* The card: the problems the kid has RUN INTO (S.seen), and the ones plain to see (no found_by),
       in a kid's words (tickets.yaml `says`). Never one they haven't met: that would be telling. */
    var findingsCard = function () {
      var met = COURSE.tickets.filter(function (t) { return !S.tickets[t.id] && t.says && (S.seen[t.id] || !t.found_by); });
      var any = Object.keys(S.tickets).length > 0;
      return { text: Object.keys(S.tickets).length > before ? 'Anything else you found?' : fill(a.text),
               options: met.map(function (t) { return { text: t.says }; }).concat([{ text: any ? 'That’s all' : 'Nothing' }]) };
    };
    Chat.expect('Type what you found…', function (text) {
      if (frame() !== f) return;
      if (DONE.test(text)) {
        if (Object.keys(S.tickets).length) { S.reported = true; save(); say(['Great report. Those are your tickets now.'], who); next(); return; }
        say(['Nothing yet? Let’s look again.'], who);
        next(a.if_none);
        return;
      }
      var hit = COURSE.tickets.filter(function (t) { return t.words && new RegExp('\\b(?:' + t.words + ')', 'i').test(text); });
      var fresh = hit.filter(function (t) { return !S.tickets[t.id]; });
      if (fresh.length) { fresh.forEach(function (t) { file(t.id, text); }); track('finding', { text: text, tickets: fresh.map(function (t) { return t.id; }) }); return found(who, fresh.length); }
      if (hit.length) { say(['That one’s on the board already.'], who); return false; }
      var unfiled = COURSE.tickets.filter(function (t) { return !S.tickets[t.id]; });
      track('finding', { text: text, tickets: [] });
      if (!unfiled.length || !aiUp()) { say(['I didn’t catch which problem that is.', 'Say what happened, like “I fell through the floor”.'], who); return false; }
      var hidden = { text: 'Which problem did the kid just report?', options: unfiled.map(function (t) { return { text: t.title }; }) };
      mentor(text, hidden, who, 'TASK: the kid is reporting something broken they found while playing. If it means one of the listed problems, set choose to it and reply in one short line. If it is something else, thank them in one line and say you noted it. Never mention a problem they did not describe.')
        .then(function (res) {
          if (frame() !== f) return;
          if (res && res.choose && unfiled[res.choose - 1]) { file(unfiled[res.choose - 1].id, text); found(who, 1, res.reply); }
          else { if (res && res.reply) say([res.reply], who); else say(['I didn’t catch which problem that is. Say what happened?'], who); idea(text, true); }
        });
      return false;   // still listening: returning false keeps the box expecting a finding (chat.js expect)
    }, { who: who, card: findingsCard });
    function found(who, n, reply) {
      say([reply || (n > 1 ? 'Good catches. Those are tickets now.' : 'Good catch. That’s a ticket now.')], who);
      return false;
    }
  }

  /* A hero, typed: "a dragon", "a pizza with legs". The AI composes one from the drawer's parts
     (decision R2: shape heroes, drawn by the game's own code); without it, the nearest of a table
     of presets, said honestly as a guess. Either way the kid can ask for changes after. */
  var BODIES = ['box', 'round', 'tall', 'blob', 'wide'];
  var EYES = ['dots', 'big', 'visor', 'angry', 'sleepy', 'one'];
  var EXTRAS = ['horns', 'ears-cat', 'ears-round', 'ears-bunny', 'antenna', 'crown', 'hat-wizard', 'helmet', 'cape', 'wings', 'tail', 'spikes', 'snout', 'beak', 'fins', 'flame', 'leaf', 'whiskers', 'bow', 'scarf'];
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
    [/bear|panda/, { body: 'round', color: '#8d6e63', belly: '#d7ccc8', eyes: 'dots', extras: [X('ears-round')] }]
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
    if (word) { S.hero = word; save(); card({ hero: word }); }
    setTimeout(Runner.askThumbs, 600);
  }
  function examples(a) { return (a.examples || []).map(function (x) { return { text: x }; }); }
  function askHero(a, who) {
    var f = frame();
    Chat.expect('Describe your hero…', function (text) {
      if (frame() !== f) return;
      var word = text.replace(/^(a|an|my|it'?s|i want)\s+/i, '').slice(0, 40);
      var done = function (shape, line) { setHero(shape, word); say([line, 'Want it different? Just tell me, any time.'], who); next(); };
      if (!aiUp()) { var p = preset(text); return done(p.hero, p.close ? 'Here’s your ' + word + '!' : 'Here’s my best guess at a ' + word + '.'); }
      mentor(text, null, who, 'TASK: the kid is describing their game’s hero. Set `hero` to a hero drawn from the parts listed under HERO, as close to what they said as the parts allow. Reply in one short, excited line.')
        .then(function (res) {
          if (frame() !== f) return;
          var shape = res && cleanHero(res.hero), p = preset(text);
          done(shape || p.hero, (res && res.reply) || (p.close ? 'Here’s your ' + word + '!' : 'Here’s my best guess at a ' + word + '.'));
        });
    }, { who: who, card: { text: fill(a.text), options: examples(a) } });
  }

  /* The game's name, typed. "idk" gets three ideas to pick from (that card is a real choice). */
  var SHRUG = /^\s*(idk|i ?d(on|o)n?['’]?t know|dunno|no idea|you (pick|choose|decide)|anything|\?+|not sure)\s*[.!?]*\s*$/i;
  function askName(a, who) {
    var f = frame();
    var h = (S.hero || 'hero').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    Chat.expect('Type your game’s name…', function (text) {
      if (frame() !== f) return;
      if (SHRUG.test(text)) {
        Chat.ask('How about one of these?', [h + ' Lava Run', 'Coin Quest', 'Leap of Fire'].map(function (n) {
          return { text: n, run: function () { setName(n, who); } };
        }), { who: who, keepOrder: true });
        return;
      }
      var n = text.replace(/^(it'?s |my game is |call it |it is )(called )?/i, '').replace(/^["“']|["”'.!]+$/g, '').trim().slice(0, 40) || text.slice(0, 40);
      // typed all in lower case, as kids type: a title gets its capitals ("dragon dash" → "Dragon Dash")
      if (n === n.toLowerCase()) n = n.replace(/(^|\s)(\S)/g, function (m, s, c) { return s + c.toUpperCase(); });
      setName(n, who);
    }, { who: who, card: { text: fill(a.text), options: [h + ' Lava Run', 'Coin Quest', 'Leap of Fire'].map(function (n) { return { text: n }; }) } });
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
    var f = frame();
    Chat.expect('Type your answer…', function (text) {
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
      say(h.say);
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
      if (b && b.say) out.push('This step just said: ' + b.say.map(fill).join(' '));
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
        }).join('  ') + '.' + (key && key.some(function (x) { return x.correct; }) ? ' It is a quiz: never say which answer is right; help them think it through.' : ''));
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
    out.push('Their game: ' + (S.name || 'not named yet') + '. Ideas they’ve had: ' + (S.ideas.slice(-5).join(' | ') || 'none') + '.');
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
  /* Something the kid wanted, kept in Project › Docs › Ideas so it isn't lost. */
  function idea(text, quiet) {
    S.ideas.push(String(text).slice(0, 200)); if (S.ideas.length > 40) S.ideas.shift(); save();
    Editor.project();
    if (!quiet) Chat.event('Saved to your Ideas (Project › Docs)', 'i-bulb');
  }
  var ASKS_FOR = /\b(make|add|can you|could you|i want|put|give|change|turn|let'?s|build|create)\b/i;
  function typed(text, qOnScreen, who) {
    who = who || Chat.active() || 'm';
    track('typed', { to: who, text: text.slice(0, 200) });
    busyKid();
    // help, instantly and with no AI: the next rung of the ladder
    if (HELP.test(text) && frame() && beat() && beat().hints && Chat.active() === voice()) { Chat.hide(); giveHint('asked'); Chat.reask(); return; }
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
    if (!st.quest) st.quest = { stack: [], tickets: {}, done: [], taught: [], shown: [], stars: 0, cards: [], ideas: [] };
    S = st.quest;
    S.seen = S.seen || {}; S.ideas = S.ideas || [];
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
    ideas: function () { return S ? S.ideas.slice() : []; },
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
