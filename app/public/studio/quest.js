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
  var COURSE = null, S = null, hintTimer = null, lastFired = {}, ai = UI.gate();   // ai: when to stop asking a failing AI, and when to try again (ui.js)
  var VOICE = { mentor: 'm', 'lead-programmer': 'p', 'art-director': 'a', 'concept-artist': 'c', 'sound-designer': 'u', 'lead-designer': 'd', director: 'r' };
  var NAME = { mentor: 'the Mentor', 'lead-programmer': 'the lead programmer', 'art-director': 'the art director', 'concept-artist': 'the concept artist', 'sound-designer': 'the sound designer', 'lead-designer': 'the lead designer', director: 'the Studio Director' };
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
  /* A ticket is one of the course's (tickets.yaml) or one the kid found that the course never planned
     (S.own, filed by askFindings through fileOwn). An own ticket has what the board shows (title,
     department, detail, done) and is fixed in your-ticket.yaml's shift; it has no words, nudge or
     fixed_when, since nothing knew about it before the kid did. */
  function ticketOf(id) { return COURSE.tickets.filter(function (k) { return k.id === id; })[0] || (S && S.own && S.own[id]) || null; }
  function allTickets() { return COURSE.tickets.concat(Object.keys(S.own || {}).map(function (id) { return S.own[id]; })); }
  // the ticket a frame is fixing: its quest's, or, for your-ticket, the one it was started for
  function ticketFor(f) { return f && (f.ticket || (quest(f) && quest(f).ticket !== 'own' && quest(f).ticket)) || null; }
  function ownShift(f) { var q = f && quest(f); return !!(q && q.ticket === 'own' && f.ticket); }
  /* A piece of the kid's design to build (doc-ticket.yaml, spec D49), rather than a bug to fix. It is
     closed by something BUILT for it: the Builder's change, or settings the AI changed when the kid
     described what they wanted. A tap in the Inspector does not count, because the audit (Sept 30,
     D51) found "Add forks that chase you" closing on a jump height nudged to 401. */
  function docShift(f) { return ownShift(f) && quest(f).id === 'doc-ticket'; }
  // who leads each department, for a shift whose character is `department`
  var LEADS = { engineering: 'lead-programmer', art: 'art-director', audio: 'sound-designer', design: 'lead-designer', studio: 'mentor' };
  function save() { Project.save(); }

  /* ---------- the character talking ---------- */
  function character(b, f) {
    f = f || frame();
    var q = quest(f);
    var c = (b && b.character) || (q && q.character) || 'mentor';
    if (c !== 'department') return c;
    var t = ownShift(f) && ticketOf(f.ticket);
    return t ? LEADS[t.department] || 'mentor' : (S.lastCharacter || 'mentor');
  }
  function voice() { return frame() ? (VOICE[character(beat())] || 'm') : (Chat.active() || 'm'); }
  /* {game}: the game's name. {role}: who is talking ("the lead programmer"). {ticket}: the ticket this
     shift is fixing, as the board titles it; {detail}, what it says to build. {cards}: the cards they have, by name ("Collider,
     Feedback and Risk"), which is how the design meeting opens (spec D50). */
  function fill(t) {
    var f = frame(), tk = f && ticketFor(f) && ticketOf(ticketFor(f));
    return String(t).replace(/\{game\}/g, S.name || 'your game')
      .replace(/\{cards\}/g, function () { return cardList(S.cards); })
      .replace(/\{role\}/g, NAME[character(f && beat(f), f)] || 'the Mentor')
      .replace(/\{ticket\}/g, tk ? tk.title.charAt(0).toLowerCase() + tk.title.slice(1) : 'this ticket')
      .replace(/\{detail\}/g, tk && tk.detail ? tk.detail : 'this ticket');   // what it builds, as the ticket's page says
  }
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
  /* A playtest's student log (telemetry.js, STUDENT_LOGS; the server says whether it is on, with the
     course): everything, so the log alone says what happened. `log` sends only then, so a class with
     logging off sends nothing extra. */
  function log(ev, fields) { if (COURSE && COURSE.logging) track(ev, fields); }
  function logOn() {
    if (!COURSE.logging) return;
    Chat.onLine(function (kind, k, text, extra) {
      log('chat', { kind: kind, from: k === 'k' ? 'kid' : (BY_VOICE[k] || k || undefined), text: String(text).slice(0, 600), extra: extra || undefined });
    });
    window.addEventListener('error', function (e) { log('page-error', { text: String(e.message || '').slice(0, 300), at: String(e.filename || '').split('/').pop() + ':' + e.lineno }); });
    log('session', { screen: innerWidth + 'x' + innerHeight, ua: navigator.userAgent.slice(0, 160), stars: S.stars || 0, done: (S.done || []).slice(), tickets: Object.keys(S.tickets || {}).map(function (id) { return id + ':' + S.tickets[id].status; }) });
  }

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
  var TRIGGERS = ['event', 'set', 'select', 'play', 'stop', 'reverted', 'filed', 'built', 'fixed'];
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
      if (trig === 'fixed' && ev.type !== 'fixed') return false;
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
    if (words && !by) badge('found-it');
    handle({ type: 'filed', name: id });
    return true;
  }
  /* A ticket the course never planned: { title, department, detail, done } from the AI, or, with it
     down, the kid's own first line as the title and the department its words point to. Returns it. */
  var DEPT_WORDS = [['audio', /\b(sound|sounds|music|noise|noisy|quiet|loud|hear|heard|silent|beep|ding)\b/i],
    ['art', /\b(look|looks|colou?rs?|gr[ae]y|ugly|pictures?|drawn|sprites?|dark|bright|invisible|see)\b/i],
    ['design', /\b(boring|hard|easy|fun|unfair|confus\w*|too (many|few|long|short))\b/i]];
  /* `quest` is the shift that fixes it: your-ticket for a finding, doc-ticket for a piece of the
     design doc (spec D49), whose `by` is the department that filed it and whose `sections` say which
     parts of the doc it builds. */
  function fileOwn(t, words, questId, by) {
    var n = Object.keys(S.own).length + 1, id = 'own-' + n;
    while (S.own[id]) id = 'own-' + (++n);
    var title = String(t.title || '').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').slice(0, 70);
    title = title.charAt(0).toUpperCase() + title.slice(1);
    var dept = DEPT[t.department] && t.department !== 'studio' ? t.department
      : ((DEPT_WORDS.filter(function (d) { return d[1].test(words || title); })[0] || ['engineering'])[0]);
    S.own[id] = { id: id, own: true, title: title || 'Something you found', department: dept, quest: questId || 'your-ticket',
      detail: String(t.detail || words || title).slice(0, 200),
      done: String(t.done || 'You test it with Play, and it does what should happen.').slice(0, 160) };
    if (t.sections && t.sections.length) S.own[id].sections = t.sections.slice(0, 4);
    file(id, words, by === true ? DEPT[dept] : by);
    return S.own[id];
  }
  /* `file: design` (spec D49): what the doc decided since it was last filed goes on the board, one
     ticket per thing to build, each to its department (design.js wrap words them). Then the doc's
     change list is empty, because it is all on the board now. */
  function fileDesign(then) {
    var d = Project.doc(), keys = d.changed.filter(function (k) { return d.sections[k] && d.sections[k].state === 'decided'; });
    if (!keys.length) return then();
    var who = voice();
    Design.wrap({ keys: keys, who: who, name: NAME[BY_VOICE[who] || 'mentor'], aiUp: aiUp, log: log,
      cards: function () { return S.cards.map(cardOf); }, hero: function () { return S.hero || null; } })
      .then(function (list) {
        list.forEach(function (t) { fileOwn(t, null, 'doc-ticket', true); });
        Project.docBuilt(keys);
        track('design-filed', { sections: keys, tickets: list.length });
        if (list.length) say([list.length === 1 ? 'Your design has one thing to build. It’s on the board now.' : 'Your design has ' + list.length + ' things to build. They’re on the board now.'], who);
        then();
      });
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
  function lead(t) { var q = COURSE.quests[t.quest]; return VOICE[t.own ? LEADS[t.department] : (q && q.character) || 'mentor'] || 'm'; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function icon(id) { var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use'); svg.setAttribute('class', 'i'); svg.setAttribute('aria-hidden', 'true'); use.setAttribute('href', '#' + id); svg.appendChild(use); return svg; }
  function pill(status, build) { var p = el('span', 'pill ' + status, build && status === 'done' ? 'Built' : STATUS[status]); if (status === 'done') p.insertBefore(icon('i-check'), p.firstChild); return p; }

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
        top.appendChild(pill(mine.status, t.quest === 'doc-ticket'));
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
    var build = t.quest === 'doc-ticket';   // a piece of their design to build (spec D49): nothing is wrong with it
    var focused = page.contains(document.activeElement) ? document.activeElement.getAttribute('data-key') : null;
    page.innerHTML = ''; page.setAttribute('data-dept', t.department);
    var back = el('button', 'tbtn quiet back'); back.type = 'button'; back.setAttribute('data-key', 'back');
    back.appendChild(icon('i-undo')); back.appendChild(el('span', '', 'All tickets'));
    back.addEventListener('click', closeTicket);
    page.appendChild(back);
    var top = el('p', 'tmeta');
    top.appendChild(el('span', 'tid', '#' + number(t.id)));
    top.appendChild(el('span', 'tdept', DEPT[t.department]));
    top.appendChild(pill(mine.status, t.quest === 'doc-ticket'));
    page.appendChild(top);
    page.appendChild(el('h3', '', t.title));
    var owner = el('p', 'towner'); owner.setAttribute('data-who', who);
    var face = el('span', 'face'); face.appendChild(icon(W[2])); owner.appendChild(face);
    owner.appendChild(el('span', '', W[0] + ' · ' + (mine.status === 'done' ? (build ? 'built it with you' : 'fixed it with you') : (build ? 'will build it with you' : 'will help you fix it'))));
    page.appendChild(owner);
    function part(label, text, cls) { var sec = el('section', 'tsec' + (cls ? ' ' + cls : '')); sec.appendChild(el('h4', '', label)); sec.appendChild(el('p', '', text)); page.appendChild(sec); }
    part(build ? 'What to build' : 'What’s wrong', t.detail);
    if (mine.words) part('You reported', '“' + mine.words + '”', 'quote');
    else if (build) part('From your design doc', (t.sections || []).map(function (k) { return (Project.SECTIONS.filter(function (x) { return x[0] === k; })[0] || [k, k])[1]; }).join(', ') || 'Your plan');
    else part('Reported by', mine.by === 'The game' ? 'The game, when you ran into it' : (mine.by || 'The studio'));
    if (mine.should) part('Should happen', '“' + mine.should + '”', 'quote');   // their half of the bug report (askFindings)
    part(build ? 'Done when' : 'Fixed when', t.done);
    var act = el('div', 'tact');
    if (mine.status === 'open') {
      var why = whyNot(t), go = el('button', 'tbtn on'); go.type = 'button'; go.setAttribute('data-key', 'fix');
      go.appendChild(icon('i-hammer')); go.appendChild(el('span', '', build ? 'Build this one' : 'Fix this one'));
      if (why) { go.disabled = true; act.appendChild(go); act.appendChild(el('p', 'tnote', why)); }
      else { go.addEventListener('click', function () { fixTicket(t); }); act.appendChild(go); }
    } else if (mine.status === 'doing') {
      var f = frame(), here = f && ticketFor(f) === t.id, b = here && beat(f);
      if (b && b.goal) { var now = el('p', 'tnow'); now.appendChild(el('small', '', 'Your task now')); now.appendChild(document.createTextNode(fill(b.goal))); act.appendChild(now); }
      if (b && b.hints) {
        var h = el('button', 'tbtn'); h.type = 'button'; h.setAttribute('data-key', 'hint');
        h.appendChild(icon('i-bulb')); h.appendChild(el('span', '', 'Stuck? Get a hint'));
        h.addEventListener('click', function () { hintNow('ticket'); });
        act.appendChild(h);
        act.appendChild(el('p', 'tnote', 'The hint opens under your task. You can ask ' + asker + ' anything in the chat too.'));
      } else act.appendChild(el('p', 'tnote', 'Stuck? Ask ' + asker + ' in the chat.'));
      // a ticket the kid filed is closed by the kid, once they've tested it (claimFixed)
      if (here && ownShift(f)) {
        var fx = el('button', 'tbtn on'); fx.type = 'button'; fx.setAttribute('data-key', 'fixed');
        fx.appendChild(icon('i-check')); fx.appendChild(el('span', '', build ? 'It works' : 'It’s fixed'));
        fx.addEventListener('click', function () { claimFixed(who); });
        act.insertBefore(fx, act.firstChild);
      }
    } else {
      var q = COURSE.quests[t.quest], c = q && q.concept && S.cards.indexOf(q.concept) >= 0 ? cardOf(q.concept) : null;
      var fixed = el('p', 'tnote good'); fixed.appendChild(icon('i-check'));
      fixed.appendChild(document.createTextNode(c ? 'Fixed. You earned the ' + c.name + ' card (Project › Cards).' : build ? 'Built. Nice work.' : 'Fixed. Nice work.'));
      act.appendChild(fixed);
    }
    page.appendChild(act);
    if (focused) { var again = page.querySelector('[data-key="' + focused + '"]'); if (again) again.focus({ preventScroll: true }); }
  }
  /* Why "Fix this one" can't start it now, in words; null when it can. */
  function whyNot(t) {
    if (pickable(t) >= 0) return null;
    var on = S.stack.map(ticketFor).filter(Boolean)[0];
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
  function busyWithQuest() { var f = frame(); return !!(f && (ticketFor(f) || S.done.indexOf('first-day') < 0)); }
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
    if (b.do && b.do.file === 'design') return fileDesign(function () { if (frame() === f && beat(f) === b) go(f, b); });
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
    // closed the moment it's tested and said fixed, not when the shift ends: the playtest review comes after (doc-ticket.yaml)
    if (b.wait_for && b.wait_for.fixed) ticketDone(ticketFor(f));
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
  function ticketDone(tid) { if (tid && S.tickets[tid]) { S.tickets[tid].status = 'done'; if (openTicket === tid) openTicket = null; paintTickets(); save(); badgeCheck(); } }
  function endQuest() {
    var f = S.stack[S.stack.length - 1], q = COURSE.quests[f.quest], tid = ticketFor(f), who = character(null, f);
    if (f.quest === 'clock-out') badge('first-shift');
    S.stack.pop();
    clearTimeout(hintTimer);
    // back to the board, where it is crossed off (Jay, Sept 30: "completing a ticket should close the
    // ticket (still show it, but cross it out)"); its page stayed open and the board never showed it
    ticketDone(tid);
    if (S.done.indexOf(q.id) < 0 && q.ticket !== 'own') S.done.push(q.id);   // your-ticket runs once per ticket
    if (who !== 'mentor') S.lastCharacter = who;
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
    if (b.goal) Chat.task(fill(b.goal), { hint: b.hints ? function () { hintNow('button'); } : null });
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
    Chat.event('Hint ' + (n + 1) + ' of ' + b.hints.length, 'i-bulb');
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
    } else if (Array.isArray(d.file)) d.file.forEach(function (id) { var t = ticketOf(id); file(id, null, t ? DEPT[t.department] : 'The studio'); });
    // `file: design` waits on the AI's wording, so enter() runs it (fileDesign) before the beat speaks
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
      S.cards.push(a.card); S.cardAt = S.cardAt || {};
      var f = frame(), q = f && quest(f);
      S.cardAt[a.card] = { at: Date.now(), where: q ? q.title : '' };   // the card's back says where it was earned
      // the first card is still when the Project window arrives (the first day's Play-mode beat): the
      // cards moved to the profile (D55), but the sprites in it are what the next tickets need
      reveal('project'); Editor.project();
      Editor.news('card'); UI.sound('card');
      Chat.event('New card: ' + cardOf(a.card).name + ' (tap your circle, top right, to see it)', 'i-cards', { kind: 'good' });
    }
    save();
  }
  /* A CARD (spec D55) is an idea the kid learned, drawn as a trading card (editor.js cardFace). The
     front: its picture (`icon`, a symbol in index.html), its name, and one short line a 10-year-old can
     read. The back: where they earned it, then either what Unity and Phaser call it (`unity`,
     `phaser`: the engine ideas, Jed's "Unity names stay, Phaser code replaces C#") or a real game that
     does it (`seen`: the design ideas). `family` is its colour and the word on its bottom line. The
     order here is the collection's order in the profile. A real game named on a back is one most
     kids have played, and says only what anyone can see by playing it. */
  var CARDS = {
    'play-mode': { name: 'Play mode', family: 'engine', icon: 'i-play', text: 'Changes you make while the game runs are undone when you press Stop.',
      unity: 'Play Mode. The Play button turns the editor blue-grey so you notice', phaser: 'Your code runs from the start each time the game loads' },
    collider: { name: 'Collider', family: 'engine', icon: 'i-c-collider', text: 'The invisible shape that makes a part solid, so things can stand on it.',
      unity: 'Box Collider 2D', phaser: 'this.physics.add.collider(player, floor)' },
    feedback: { name: 'Feedback', family: 'feel', icon: 'i-c-feedback', text: 'The game telling you something happened: a sound, a flash, a number.',
      seen: 'In Super Mario Bros., every coin goes “bling” and the coin count goes up.' },
    readability: { name: 'Readability', family: 'feel', icon: 'i-c-eye', text: 'A player can tell what everything is at a glance.',
      seen: 'In most platformers, spikes look sharp and stand out, so you know they hurt before you touch them.' },
    risk: { name: 'Risk', family: 'challenge', icon: 'i-c-risk', text: 'A danger that makes the player’s choices matter.',
      seen: 'In Super Mario Bros., a coin over a pit is a risk you choose to jump for.' },
    /* The design meeting's concepts, one per section of the doc (spec D50; design.js CONCEPT says which
       section teaches which, and says this line when the section is decided). */
    genre: { name: 'Genre', family: 'game', icon: 'i-c-genre', text: 'The kind of game it is: a platformer, a racer, a puzzle…',
      seen: 'Mario Kart is a racer, Tetris is a puzzle game, and Minecraft is a sandbox.' },
    'core-loop': { name: 'Core loop', family: 'game', icon: 'i-again', text: 'What the player does again and again: run, jump, grab.',
      seen: 'In Pac-Man: eat the dots, dodge the ghosts, clear the maze, and again.' },
    goal: { name: 'Goal', family: 'game', icon: 'i-flag', text: 'What the player is trying to do. Without one it’s a toy, not a game.',
      seen: 'In Super Mario Bros., you reach the flagpole at the end of each level.' },
    reward: { name: 'Reward', family: 'challenge', icon: 'i-c-reward', text: 'Something good the game gives you for doing well.',
      seen: 'In Zelda, opening a chest plays a little tune and gives you something new.' },
    'player-character': { name: 'Player character', family: 'game', icon: 'i-person', text: 'Who you are in the game, and what they can do.',
      seen: 'Mario runs and jumps on enemies. Kirby floats and swallows them.' },
    challenge: { name: 'Challenge', family: 'challenge', icon: 'i-c-challenge', text: 'What makes the goal hard, so winning feels good.',
      seen: 'In Flappy Bird, the narrow gaps between the pipes are the whole challenge.' },
    theme: { name: 'Theme', family: 'feel', icon: 'i-palette', text: 'The world it’s set in, which ties how everything looks together.',
      seen: 'Plants vs. Zombies is a garden under attack, so everything in it is a plant or a zombie.' },
    mood: { name: 'Mood', family: 'feel', icon: 'i-music', text: 'Music and sound set how a game feels: spooky, fast, happy.',
      seen: 'Mario’s underground levels change to slower, echoey music, so they feel like a cave.' },
    story: { name: 'Story', family: 'feel', icon: 'i-c-story', text: 'Why the player is doing all this.',
      seen: 'In Super Mario Bros., you’re on your way to rescue Princess Peach.' },
    balance: { name: 'Balance', family: 'challenge', icon: 'i-c-balance', text: 'Not too easy, not too hard.',
      seen: 'In Mario Kart, whoever is behind gets better items, so they can catch up.' }
  };
  var FAMILY = { engine: 'Engine idea', game: 'Game idea', challenge: 'Challenge idea', feel: 'Feel idea' };
  function cardOf(c) {
    var k = CARDS[c]; if (!k) return { id: c, name: c, text: '' };
    var at = (S && S.cardAt && S.cardAt[c]) || {};
    return { id: c, name: k.name, text: k.text, family: k.family, kind: FAMILY[k.family], icon: k.icon,
             unity: k.unity || '', phaser: k.phaser || '', seen: k.seen || '', where: at.where || '', at: at.at || 0 };
  }

  /* BADGES (spec D55) are firsts: things the kid did, not ideas they learned. The code awards them
     from what happened (badgeCheck), never the AI, and a save from before badges gets the ones its
     history already shows, quietly (catchUp). [id, name, how it's earned, icon]. */
  var BADGES = [
    ['first-fix', 'First fix', 'Fixed your first ticket', 'i-check'],
    ['found-it', 'Bug hunter', 'Found a problem in the game yourself', 'i-search'],
    ['hero', 'Hero maker', 'Made your own hero', 'i-person'],
    ['designer', 'Designer', 'Planned how your game plays in the design doc', 'i-doc'],
    ['first-build', 'Director', 'Told the AI what to build, and it built it', 'i-hammer'],
    ['coder', 'Coder', 'Changed your game’s code yourself, and it ran', 'i-script'],
    ['clean-board', 'Clean board', 'Fixed every ticket on the board', 'i-ticket'],
    ['first-shift', 'First shift', 'Clocked out of your first day', 'i-clapper']
  ];
  var DESIGNED = ['idea', 'play', 'goal', 'fun'];   // the design meeting's round 1 (design.js ROUNDS): how the game plays
  function badge(id, quiet) {
    S.badges = S.badges || [];
    var b = BADGES.filter(function (x) { return x[0] === id; })[0];
    if (!b || S.badges.indexOf(id) >= 0) return;
    S.badges.push(id); save();
    if (quiet) return;
    Editor.news('badge'); UI.sound('tool');
    Chat.event('New badge: ' + b[1] + '. ' + b[2], b[3], { kind: 'good' });
    track('badge', { badge: id });
  }
  function badgeCheck() {
    var ids = Object.keys(S.tickets), fixed = ids.filter(function (id) { return S.tickets[id].status === 'done'; }).length;
    if (fixed) badge('first-fix');
    if (ids.length >= 3 && fixed === ids.length) badge('clean-board');
  }
  function catchUp() {
    var ids = Object.keys(S.tickets), fixed = ids.filter(function (id) { return S.tickets[id].status === 'done'; }).length, s = Project.doc().sections;
    if (fixed) badge('first-fix', true);
    if (ids.length >= 3 && fixed === ids.length) badge('clean-board', true);
    if (ids.some(function (id) { return S.tickets[id].words && !S.tickets[id].by; })) badge('found-it', true);
    if (S.hero) badge('hero', true);
    if (DESIGNED.every(function (k) { return s[k] && s[k].state === 'decided'; })) badge('designer', true);
    if (S.built) badge('first-build', true);
    if (Project.get().codeEdited) badge('coder', true);
    if (S.done.indexOf('clock-out') >= 0) badge('first-shift', true);
  }
  function badgeOf(id) { var b = BADGES.filter(function (x) { return x[0] === id; })[0]; return { id: b[0], name: b[1], how: b[2], icon: b[3], earned: !!S && (S.badges || []).indexOf(b[0]) >= 0 }; }
  function cardList(ids) { var n = ids.map(function (c) { return cardOf(c).name; }); return n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n[0] || 'no cards yet'; }

  /* ---------- questions ---------- */
  function ask(a) {
    var who = voice(), f = frame();
    if (a.from === 'tickets') return askTickets(a, who);
    if (a.from === 'findings') return askFindings(a, who);
    if (a.from === 'heroes') return askHero(a, who);
    if (a.from === 'names') return askName(a, who);
    if (a.from === 'feedback') return askFeedback(a, who);
    if (a.from === 'design') return askDesign(a, who);
    if (a.from === 'review') return askReview(a, who);
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
    var open = function () { return allTickets().filter(function (t) { return S.tickets[t.id] && S.tickets[t.id].status === 'open'; }).sort(function (x, y) { return number(x.id) - number(y.id); }); };
    if (!open().length) { f.completing = false; return next(beat(f).next); }
    var go = function (t) {
      picking = null; Chat.stopExpecting();
      track('answer', { q: a.text, a: t.id });
      startTicket(t);
    };
    picking = function (t) { if (frame() === f) go(t); };
    picking.f = f;
    // every way to answer, said plainly (Jay, Sept 30): a kid shouldn't have to guess what counts
    var button = open().some(function (t) { return t.quest === 'doc-ticket'; }) ? 'Build this one' : 'Fix this one';   // as its page says (paintTicket)
    say([fill(a.text), 'Type its number, or tell me what it’s about. Or tap a ticket on the Tickets board and press ' + button + '.'], who);
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
    S.stack.push({ quest: t.quest, beat: 0, flags: {}, fired: {}, ticket: t.own ? t.id : undefined });
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
    say([f.early && f.early.length ? 'You told me what you found while you played. Let me write it up.' : fill(a.text)], who);
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
    var LEVEL = 'The level is all grey today, so the kid may not know what things are: the grey circles are coins; the dip in the floor between the coins is the lava; the grey block standing on the left is the player. So a gap, dip, hole or pit in the middle that does nothing IS the lava problem, however they put it. Say what a thing is only when they mention it, never to point them at something new. They are 10 and write short and misspell: "i fall", "i walk den i fell", "no soud" say what happened, and what happened is all a report needs. Never ask why or what caused it: that is the fix, and working it out is the shift\'s job.';
    var NAMES = [[/\b(gap|dip|pit|dent|low(er)? (bit|part))\b/i, 'That dip between the coins is meant to be lava.'], [/\b(dots?|circles?|balls?|round things?)\b/i, 'Those circles are coins.']];
    function named(said) { var t = said.join(' '), n = NAMES.filter(function (x) { return x[0].test(t); })[0]; return n ? n[1] + ' ' : ''; }
    /* A dig that names a planned thing is about that ticket, the same as a nudge: "There are dots ...
       when walk into dem", "Those circles are the coins. What happened?", "Nothing happen" was dug at
       twice more and kept as an idea, and "nothing" to "that dip is the lava: what happens when you walk
       into it?" three times over (Jay's playthrough, Sept 30). With the ticket as the aim, its
       `nudge_yes` hears "nothing" as the finding. */
    var ABOUT = [[/\b(lava|gap|dip|pit|dent)\b/i, 'harmless-lava'], [/\b(coins?|dots?|circles?|balls?)\b/i, 'silent-coins']];
    function about(t) { var a = ABOUT.filter(function (x) { return x[0].test(t) && !S.tickets[x[1]]; })[0]; return a ? a[1] : null; }
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
      pending = { kind: 'dig', said: said, n: n, aim: (pending && pending.aim) || about(said.join(' ')) };
      log('report', { step: 'dig', n: n, aim: pending.aim });
      var plain = named(said) + (n === 1 ? (feel ? '“' + cap(feel) + '” how? What did you see or hear that made it feel ' + feel + '?' : 'What happened with it? Tell me what you did, and what the game did.')
        : n === 2 ? 'Where in the level was that? What were you doing right then?'
        : 'Try it again and watch closely. What does the game do?');
      Chat.placeholder();
      return put(said[said.length - 1], 'TASK: the kid is reporting what seemed wrong in the game, but it is not a clear problem yet. Everything they said so far: "' + said.join(' / ') + '". ' + LEVEL + ' Ask ONE short question that pushes them to explain more: what exactly they saw, heard or did, where, or what happens when they try the thing they mentioned (you may say what a thing is, like "those circles are coins: what happens when you grab one?"). Never say what is wrong or what causes it. If they already said what happened ("nothing happens"), that is the answer: do not ask it again in other words. No praise, no list.', plain);
    }
    function filed(ts, words, reply, by) {
      pending = null;
      ts.forEach(function (t) { file(t.id, words, by); });
      track('finding', { text: words, tickets: ts.map(function (t) { return t.id; }) });
      reveal('tickets'); paintTickets();
      var t0 = ticketOf(ts[0].id);
      var ack = reply || (ts.length > 1 ? 'Good catches. Those are tickets now.' : ACKS[acked++ % ACKS.length].replace('#N', '#' + number(ts[0].id)));
      // one nobody planned says where it goes: every ticket belongs to a department
      if (t0.own && !reply) ack += ' It goes to ' + DEPT[t0.department] + '.';
      /* "What should have happened?" is asked once, the first time, to teach the other half of a bug
         report. After that the Mentor says it (critique, Sept 30: the same scripted question after
         every finding made the Mentor sound like it wasn't listening). A ticket nobody planned has no
         `should` to say, so it is always asked: only the kid knows. */
      if (taught && !t0.own) return onward(ack + ' ' + t0.should);
      pending = { kind: 'should', ticket: ts[0].id, n: 1 };
      say([ack, t0.should_q || (t0.own && taught ? 'What should happen instead?' : 'What should have happened instead?')], who);
      Chat.placeholder();
      return false;
    }
    function filedOwn(spec, words, reply) { return filed([fileOwn(spec, words)], words, reply); }
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
      log('report', { step: 'retry', aim: pending.aim, n: pending.n });
      if (pending.n === 0) { pending.n = 1; say(['Press Play and try it, then tell me what happened.'], who); Chat.placeholder(); return false; }
      return onward('That’s okay. We’ll come back to it.');
    }
    function should(text) {
      var t = ticketOf(pending.ticket), tk = S.tickets[pending.ticket];
      if (FINISH.test(text)) return wantsOut();
      var stuck = STUCK.test(text) || text.trim().length < 3;
      var lead2 = t.should_ask || 'Think of a game you like. What would happen there instead?';
      if (stuck && pending.n === 1) {
        pending.n = 2;
        return put(text, 'TASK: the kid does not know what should have happened for this problem: "' + t.title + '". Ask ONE short, friendly question that leads them there from what any player knows, like "' + lead2 + '" Do not give the answer.', lead2);
      }
      pending = null;
      // the first time, name what they just did: both halves make a bug report
      var lead = function (first) { return first + (taught ? '' : ' That’s a real bug report: what happened, and what should have.'); };
      var wasTaught = taught; taught = true;
      if (stuck) return onward(lead(t.should ? 'Here’s the idea: ' + t.should.charAt(0).toLowerCase() + t.should.slice(1) : 'That’s okay. We’ll work it out when we fix it.'));
      if (tk) { tk.should = String(text).slice(0, 120); save(); paintTickets(); }
      if (!aiUp()) return onward(lead(wasTaught ? 'Exactly.' : 'Yes, that’s it.'));
      mentor(text, null, who, 'TASK: the kid said what should have happened for the problem "' + t.title + '": "' + text + '". ' + (t.should ? 'The idea to reach: "' + t.should + '". In ONE short line, build on their own words: if they have it, say so; if not quite, lead them the rest of the way.' : 'Nobody planned this problem, so there is no set answer: in ONE short line, build on their words, and if it is unclear, say what you think they mean.') + ' Nothing else.')
        .then(function (res) { if (frame() !== f) return; onward(lead((res && res.reply) || 'Yes, that’s it.')); });
      return false;
    }
    var hear = function (text) {
      if (frame() !== f) return;
      if (pending && pending.kind === 'should') {
        // "oh and the lava doesn't hurt" is a new finding, not the answer to what should have happened
        var other = concrete(text).filter(function (t) { return !S.tickets[t.id]; });
        if (!other.length || /\bshould\b/i.test(text)) return should(text);
        pending = null;
      }
      var aim = pending && pending.aim ? ticketOf(pending.aim) : null;
      /* The answer to a nudge: "nothing", to what did you hear, is the finding. So is an answer in that
         ticket's own words: "they are both grey", to the coins-and-lava nudge, was filed by the AI as a
         new ticket, "Coins and lava look the same", beside the grey-box one it was (Jay, Sept 30). */
      /* ...unless it names another thing: "coin do nothing", with the lava as the aim, filed the lava on
         its "nothing" (Jay's playthrough, Sept 30). */
      var names = about(text);
      var aimed = aim && !S.tickets[aim.id] && !IDK.test(text) && (!names || names === aim.id) && ((aim.nudge_yes && new RegExp('\\b(?:' + aim.nudge_yes + ')', 'i').test(text)) || concrete(text).some(function (t) { return t.id === aim.id; }));
      if (aimed) {
        var all = (pending.said || []).concat([text]).join('. '), own = all.trim().length >= 12;   // "nothing" alone would read oddly on the ticket's page
        return filed([aim], own ? all : null, null, own ? null : 'You');
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
      /* NOT ONLY THE PLANNED TICKETS (Jay, Sept 30: "It should be able to file and create tickets for
         different departments. It also just kinda shoots for the expected tickets"). "I jumped and it
         felt floaty ... when I was jumping over the gap" was filed as the lava, on the word "gap". With
         the AI up, the words are only a hint and the AI decides: one of the planned problems, a real
         problem nobody planned (a new ticket for its department, fileOwn), an idea for something new,
         or not a problem yet (ask more). With it down, the words decide, and a finding the kid has
         explained once that matches nothing is filed in their own words. */
      var hit = concrete(text), fresh = hit.filter(function (t) { return !S.tickets[t.id]; });
      var unfiled = COURSE.tickets.filter(function (t) { return !S.tickets[t.id]; });
      // the words' own reading, for when there is no AI to ask (down, or the call failed)
      var planned = function () { return fresh.length ? filed(fresh, words) : hit.length ? onward('That’s ticket #' + number(hit[0].id) + ' already. Good detail.') : null; };
      var unplanned = function () { return !aim && said.length >= 2 && !STUCK.test(text) ? filedOwn({ title: said[0] }, words) : aim ? retry() : dig(said); };
      if (hit.length && !aiUp()) return planned();
      /* Said twice, it's the finding. A kid who writes "i fall" and then "i just walk and den i fell"
         has told us what happened, twice, in the floor ticket's own words; being asked a third time is
         the studio not listening (Jay's playthrough, Sept 30). */
      var again = pending && pending.kind === 'dig' ? fresh.filter(function (t) { return concrete(pending.said.join(' ')).indexOf(t) >= 0; }) : [];
      if (again.length === 1) return filed(again, words);
      // still no problem after the follow-ups: keep it, and move on kindly
      if (aim && pending.n >= 2 && !fresh.length) return retry();
      if (pending && pending.n >= 3) { idea(words, true); return onward('I’ve kept that as an idea.'); }
      // a feeling is always asked about first, never sorted into a ticket on its own
      if (!pending && FEEL.test(text)) return dig(said);
      if (!aiUp()) return unplanned();
      // the last options: a problem nobody planned, an idea, or they're done ("ok where", "where are the
      // tickets?"): the conversation moves the day on, not a magic phrase (Jay, 2026-09-30)
      var n = unfiled.length, NEW = n + 1, IDEA = n + 2, OUT = n + 3;
      var hidden = { text: 'Which problem did the kid just report?', options: unfiled.map(function (t) { return { text: t.title + (t.says ? ' (a kid might say “' + t.says + '”)' : '') }; })
        .concat([{ text: 'A real problem that is not on this list: file it as a new ticket' }, { text: 'Not a problem but an idea for something new, like “add a boss”: keep it for later' }])
        .concat(more() ? [{ text: 'None: they are done reporting, or asking what happens next' }] : []) };
      var filedNow = allTickets().filter(function (t) { return S.tickets[t.id]; }).map(function (t) { return '#' + number(t.id) + ' ' + t.title; }).join('; ');
      var aimAt = aim ? unfiled.indexOf(aim) + 1 : 0;
      mentor(words, hidden, who, 'TASK: the kid is reporting something they found while playing.' + (aim ? ' You just asked them: "' + aim.nudge + '"' + (aimAt ? ' That question is about problem ' + aimAt + ': if their answer shows it, even in part, choose ' + aimAt + ', never a new ticket.' : '') : '') + ' Everything they said about it: "' + said.join(' / ') + '". ' + LEVEL + (filedNow ? ' Already on the board: ' + filedNow + '. Only say it is one of those if it clearly is.' : '')
        + ' The studio planned the listed problems, but a kid finds real ones nobody planned, and those count just as much. Decide which it is.'
        + ' (1) It clearly describes one of the listed problems: choose it and reply in one short line. Several listed problems in one message: choose all of them, as a list ([1, 3]). What happened is enough, however short or misspelled: "i fall" is the falling problem. Sharing a word is not enough, though: "it felt floaty when I was jumping over the gap" is about the jump, not the lava.'
        + ' (2) A clear problem that is not listed (they said what went wrong): choose option ' + NEW + ' and fill `ticket`: a short board title in plain words ("The jump feels floaty"), the department that fixes it (engineering: how things move, collide and work; art: how things look; audio: sounds and music; design: whether it is fair, fun, too hard or too easy), `detail`, one sentence of what is wrong, and `done`, one sentence of how they will know it is fixed. Reply in one short line that says which department it goes to.'
        + ' Whichever you choose, never say what should happen instead ("coins and lava should look different"): the studio asks them that next, and it is theirs to say.'
        + ' (3) A wish for something new rather than something broken: choose option ' + IDEA + '.'
        + ' (4) Vague, a feeling, or a thing with no problem yet: do not choose. Ask ONE short question that pushes them to explain what exactly they saw, heard or did (you may say what a thing is, like "that dip is meant to be lava: what happens when you walk into it?").'
        + (more() ? ' (5) They are done, or asking what is next: choose option ' + OUT + ' and reply in one short line.' : '')
        + ' Never say what is wrong with anything, never say what causes it or which setting or component is to blame ("sounds like the collider isn\'t doing its job" gives away the fix: working that out is the shift\'s job), and never bring up a thing they have not mentioned, even if the game saw them touch it: finding it is their job.'
        + ' Never argue with a fair answer or correct it with the problem ("they\'re both grey, so shape can\'t tell them apart" found it for them): say what is right about it, and ask about one other thing they could look at.')
        .then(function (res) {
          if (frame() !== f) return;
          if (!res) return planned() === null ? unplanned() : undefined;   // no answer: the words decide
          var c = res.choose;
          if (c === OUT && more()) { wantsOut(); return; }
          if (c === NEW) { filedOwn(res.ticket || { title: said[0] }, words, res.reply); return; }
          if (c === IDEA) { idea(words); onward(res.reply || 'That’s a great idea for later. I saved it.'); return; }
          if (c && unfiled[c - 1]) { filed([c].concat(res.also || []).map(function (n) { return unfiled[n - 1]; }).filter(Boolean), words, res.reply); return; }
          /* The dig's aim comes from the kid's words before the AI's. "i fall" hit the floor ticket, the AI
             asked where and said the lava was the dip, and the lava became the aim; "no i just walk on norm
             floor den it hapenn" missed it and got "We'll come back to it" (Jay's playthrough, Sept 30).
             The AI's reply still counts when the kid's words name nothing ("Those circles are the coins.
             What happened?", about()). */
          if (res && res.reply && /\?\s*["”]?\s*$/.test(res.reply)) { pending = { kind: 'dig', said: said, n: (pending && pending.kind === 'dig' ? pending.n : 0) + 1, aim: (aim && aim.id) || (fresh.length === 1 ? fresh[0].id : null) || about(res.reply) || (fresh.length ? null : about(said.join(' '))) }; log('report', { step: 'dig', by: 'ai', n: pending.n, aim: pending.aim }); say([res.reply], who); Chat.placeholder(); return; }
          if (aim) retry(); else dig(said);   // no question from the AI ("noted!"): the ladder asks its own
        });
      return false;   // still listening: returning false keeps the box expecting a finding (chat.js expect)
    };
    Chat.expect(function () { return pending && pending.kind === 'should' ? 'Like “it should…”' : pending ? 'Say what you saw, heard or did…' : more() ? 'Something else you noticed…' : 'Like “the jump feels floaty”…'; }, hear, { who: who, takesHelp: function () { return !!pending; } });
    /* What they already told us while playing is the report's start, not something to say again:
       "I fall in lava and dont get hurt. I grab coin but get nothing for coin. I fell off the level",
       typed during Play, got "three good finds!", and then "What was broken?" as if it hadn't been
       said, and "I already said" (Jay's playthrough, Sept 30). typed() keeps it (f.early). */
    if (f.early && f.early.length) { var early = f.early.join('. '); f.early = null; hear(early); }
    function finish(reply) {
      S.reported = true; save();
      say([reply || 'Great report. Those are your tickets now.'], who);
      next();
    }
  }

  /* A hero, typed: "a dragon", "a pizza with legs". The AI composes one from the drawer's parts
     (decision R2: shape heroes, drawn by the game's own code); without it, the nearest of a table
     of presets, said honestly as a guess. Either way the kid can ask for changes after. */
  var BODIES = ['box', 'round', 'tall', 'blob', 'wide', 'slice'];
  var EYES = ['dots', 'big', 'visor', 'angry', 'sleepy', 'one'];
  var EXTRAS = ['horns', 'ears-cat', 'ears-round', 'ears-bunny', 'antenna', 'crown', 'hat-wizard', 'helmet', 'cape', 'wings', 'tail', 'spikes', 'snout', 'beak', 'fins', 'flame', 'leaf', 'whiskers', 'bow', 'scarf', 'cap', 'mustache', 'spots', 'sprinkles', 'stripes', 'drips', 'outline', 'glasses'];
  function hex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null; }
  function cleanHero(h) {
    if (!h || typeof h !== 'object') return null;
    return {
      body: BODIES.indexOf(h.body) >= 0 ? h.body : 'box',
      color: hex(h.color) || '#5aa9e6', belly: hex(h.belly),
      eyes: EYES.indexOf(h.eyes) >= 0 ? h.eyes : 'dots', eyeColor: hex(h.eyeColor),
      extras: (Array.isArray(h.extras) ? h.extras : []).filter(function (e) { return e && EXTRAS.indexOf(e.kind) >= 0; })
        .slice(0, 6).map(function (e) { return { kind: e.kind, color: hex(e.color) }; })
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
    [/pizza/, { body: 'slice', color: '#ffca28', belly: '#d9822b', eyes: 'big', extras: [X('spots', '#c62828'), X('drips', '#ffe082')] }],
    [/cookie|biscuit/, { body: 'round', color: '#c68642', eyes: 'big', extras: [X('spots', '#4e342e')] }],
    [/donut|doughnut|cupcake|cake/, { body: 'round', color: '#f48fb1', eyes: 'big', extras: [X('sprinkles', '#ffffff'), X('drips', '#fce4ec')] }],
    [/food|burger|taco|sandwich/, { body: 'wide', color: '#ffca28', belly: '#e53935', eyes: 'big', extras: [] }],
    [/bee|tiger|zebra/, { body: 'round', color: '#fdd835', eyes: 'big', extras: [X('stripes', '#212121'), X('wings', '#e3f2fd')] }],
    [/cow|dalmatian|ladybug|ladybird/, { body: 'round', color: '#f5f5f5', eyes: 'dots', extras: [X('spots', '#212121')] }],
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
    if (word) { S.hero = word; save(); card({ hero: word }); Project.writeDoc('hero', word, 'kid', 'started'); badge('hero'); }
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
    mentor(said[said.length - 1], null, who, 'TASK: the kid is describing their game’s hero. Everything they said about it: "' + said.join(' / ') + '". Set `hero` to a hero drawn from the parts listed under HERO, as close to that as the parts allow (a cap and mustache for a plumber, say), and change what they asked to change. Draw it now, every time: never offer a choice or ask whether to go ahead ("pepperoni olive" means red spots and black spots, drawn this turn, not "want me to try spikes?"). No part for it at all? Draw the nearest and say plainly what you used. Reply in one short, excited line saying what you drew. It shows in the Game view.')
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

  /* The playtest review (spec D50): after a piece of their design is built, the lead designer asks one
     quick question about how it played, the way a studio's designers playtest every build. Each
     question is a concept: the first is always Balance, which earns its card, and then they take turns,
     so the same one never comes twice in a row. A card the kid already holds is named rather than
     explained again ("That's feedback, one of your cards"). An answer that asks for a change is kept
     in Ideas for later as a playtest note; "just right" isn't an idea, so it isn't kept. Tapped,
     typed or skipped: it never holds up the board. */
  var REVIEWS = [
    { q: 'How hard was it?', card: 'balance', a: [
      ['Too easy', 'Then we can make it harder.', 'felt too easy'],
      ['Just right', 'Just right is what every designer aims for.', null],
      ['Too hard', 'Then we can make it fairer.', 'felt too hard']] },
    { q: 'Could you tell when it worked?', card: 'feedback', a: [
      ['Yes, right away', 'Then it tells the player clearly.', null],
      ['Kind of', 'Then it could use a sound, a flash or a number.', 'could show more clearly when it works'],
      ['Not really', 'Then it needs a sound, a flash or a number.', 'needs to show when it works']] },
    { q: 'Would you play it again?', card: 'reward', a: [
      ['Yes!', 'Then it gives you something worth coming back for.', null],
      ['Maybe', 'Something good to win or grab could make it a yes.', 'could use something good to win'],
      ['Not yet', 'Then it needs something good to win or grab.', 'needs something worth playing again for']] }
  ];
  var SKIP_REVIEW = /^\s*(skip|no thanks|nah|later|not now|pass|next)\b/i;
  function askReview(a, who) {
    var f = frame(), n = S.reviews || 0, r = REVIEWS[n % REVIEWS.length];
    var tk = ticketFor(f) && ticketOf(ticketFor(f));
    var sec = tk && tk.sections && Project.SECTIONS.filter(function (x) { return x[0] === tk.sections[0]; })[0];
    var about = sec ? 'Playtest of ' + sec[1].charAt(0).toLowerCase() + sec[1].slice(1) + ': ' : 'Playtest: ';
    var c = cardOf(r.card), word = c.name.toLowerCase();
    var done = function (lines, note) {
      Chat.stopExpecting();
      S.reviews = n + 1;
      if (note) idea(about + note);
      say(lines, who);
      next();
    };
    var answered = function (x) {
      track('answer', { q: r.q, a: x[0] });
      var had = S.cards.indexOf(r.card) >= 0;
      done([x[1] + (had ? ' That’s ' + word + ', one of your cards.' : ' Designers call that ' + word + '. ' + c.text)], x[2]);
      if (!had) award({ card: r.card });
    };
    var skip = function () { track('answer', { q: r.q, a: 'skip' }); done(['No problem. Back to the board!']); };
    Chat.expect('Tell me how it played…', function (text) {
      if (frame() !== f) return;
      if (SKIP_REVIEW.test(text)) return skip();
      var k = answerFrom(text, r.a.map(function (x) { return { text: x[0] }; }));
      if (k >= 0) return answered(r.a[k]);
      track('answer', { q: r.q, a: text.slice(0, 200) });
      done(['Good playtest note. That’s how designers find what to change.'], text.slice(0, 160));
    }, { who: who });
    Chat.ask((a.text ? fill(a.text) + ' ' : '') + r.q,   // the beat's lead-in, then this time's question
      r.a.map(function (x) { return { text: x[0], run: function () { answered(x); } }; })
        .concat([{ text: 'Skip', sub: 'Back to the board', run: skip }]), { who: who, keepOrder: true });
  }

  /* A round of the design meeting (design.js runs it). It gets the engine's own ways of saying,
     awarding and logging, and `still`, which is false once the kid has moved on (a reload, a new beat),
     so a late answer from the AI lands nowhere. */
  function askDesign(a, who) {
    var f = frame(), at = f.beat;
    Design.round({ round: a.round || 1, text: fill(a.text), who: who, name: NAME[BY_VOICE[who] || 'mentor'],
      say: function (lines) { say(lines, who); }, award: award, card: cardOf,
      cards: function () { return S.cards.map(cardOf); }, hero: function () { return S.hero || null; },
      idea: function (t) { idea(t); }, log: log, aiUp: aiUp, ai: ai,
      still: function () { return frame() === f && f.beat === at; },
      done: function () { if (frame() === f && f.beat === at) next(); } });
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
    if (!(ev.type === 'event' && ev.name === 'coin')) log('did', { type: ev.type, name: ev.name || undefined, set: ev.type === 'set' && ev.detail ? ev.detail.id + '.' + ev.detail.key + ' = ' + JSON.stringify(ev.detail.value) : undefined });
    if (ev.type === 'play' || ev.type === 'select') Editor.point(null);   // the pointer's job is done once they act
    if (ev.type === 'coded') badge('coder');   // their own code saved, and the game ran it (views.js save)
    if (ev.type === 'event' || ev.type === 'set' || ev.type === 'play') checkTickets(ev);
    if (ev.type === 'event') Chat.event(EVENT_WORDS[ev.name] || ev.name, EVENT_ICON[ev.name] || 'i-pad');
    if (ev.type === 'select' || ev.type === 'set' || ev.type === 'play' || ev.type === 'stop') busyKid();
    var f = frame(); if (!f) return;
    // for claimFixed: when the game last changed, and when it was last tested
    if (ownShift(f)) { if (ev.type === 'built' || (ev.type === 'set' && !docShift(f))) f.changedAt = Date.now(); if (ev.type === 'play') f.playedAt = Date.now(); }
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
      log('trigger', { on: key, when: h.when });
      speak(h);
    });
    if (b && b.wait_for && !f.completing && matches(b.wait_for, ev, f)) { log('step-done', { when: b.wait_for }); complete(); }
    paintDev();
  }
  /* The game's events, as the rows the Log shows (the chat never does: chat.js, event). */
  var EVENT_WORDS = { fell: 'The player fell off the level', coin: 'Coin grabbed', lava: 'The player touched the lava', hurt: 'The lava sent the player back', crossed: 'The player stood on the floor tile', cleared: 'Every coin grabbed' };
  var EVENT_ICON = { fell: 'i-flag', coin: 'i-star', lava: 'i-flag', hurt: 'i-flag', crossed: 'i-check', cleared: 'i-star' };

  /* ---------- typed messages: the character whose thread is open answers ---------- */
  /* What the AI may set: what schema.js says the part can hold, on a component the kid can see, and
     never the fix the kid is working on (that would be the answer). */
  function protectedKeys() {
    var out = {};
    S.stack.forEach(function (f) {
      var t = ticketFor(f) && ticketOf(ticketFor(f));
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
    /* The design doc, near the top so the 7000-character cut below never takes it (spec D41: the doc is
       what the studio builds from; the Builder gets this same block). Decided sections first. */
    var secs = Project.doc().sections, docLines = Project.SECTIONS.filter(function (x) { return secs[x[0]].text; })
      .sort(function (x, y) { return (secs[y[0]].state === 'decided') - (secs[x[0]].state === 'decided'); })
      .map(function (x) { return x[1] + (secs[x[0]].state === 'decided' ? '' : ' (not decided yet)') + ': ' + secs[x[0]].text; });
    if (docLines.length) out.push(('THEIR DESIGN DOC (their game as they planned it; build what it says): ' + docLines.join(' | ')).slice(0, 1200));
    /* The cards they hold (spec D50, referring back): when what they do or ask IS one of these, the
       character names it in a few words instead of teaching it again (mentor.md, designer.md). */
    if (S.cards.length) out.push('THEIR CARDS (ideas they have learned): ' + S.cards.map(function (c) { var k = cardOf(c); return k.name + ' (' + k.text + ')'; }).join(' ').slice(0, 900));
    if (q) {
      var tk = ticketFor(f) && ticketOf(ticketFor(f)), idea = q.concept && CARDS[q.concept];
      out.push('Quest: "' + q.title + '" (' + DEPT[q.department] + ').'
        + (tk ? ' It fixes the ticket ' + titleOf(tk) + ': ' + tk.detail : '')
        + (idea ? ' The idea it teaches: ' + idea[0] + ' (' + idea[1] + ')' : ''));
      if (b && b.goal) out.push('The task line on their screen: "' + fill(b.goal) + '".');
      if (b && b.say) out.push('This step just said: ' + b.say.map(fill).join(' ') + (b.instruct ? ' Then: ' + fill(b.instruct) : ''));
      /* A ticket the kid filed has no set answer, so it isn't "their job to figure out" the way a planned
         one is: the lead helps them find the cause, and does the change when they say it clearly. */
      if (b && b.wait_for && b.wait_for.fixed && tk && tk.quest === 'doc-ticket') {
        /* A piece of their design doc (doc-ticket.yaml): nothing is broken, so there is no cause to find.
           The lead builds it with them, and the lesson is saying exactly what you want (mentor.md). */
        out.push('This ticket builds part of their design doc' + (tk.sections ? ' (' + tk.sections.join(', ') + ')' : '') + '. There is no set answer: build it WITH them. Ask how exactly they want it (what it looks like, how it moves, when it happens) until you could build it, one question at a time. When they have said it clearly, do it (actions, or build for what the settings can\'t do) and say it worked because they said exactly what they wanted. When it\'s changed, tell them to press Play and test it, then say "fixed" or press It\'s fixed on the ticket.');
      } else if (b && b.wait_for && b.wait_for.fixed) {
        out.push('This is a ticket the kid found and filed themselves' + (tk && S.tickets[tk.id] && S.tickets[tk.id].should ? ', and they said it should: "' + S.tickets[tk.id].should + '"' : '') + '. There is no set answer: help them fix it. Ask what they think causes it and which part it is about, and point them at the Hierarchy and the Inspector. When they say clearly what to change, do it (actions, or build for what the settings can\'t do) and say it worked because they said exactly what they wanted. When it\'s changed, tell them to press Play and test it, then say "fixed" or press It\'s fixed on the ticket.');
      } else if (b && b.wait_for) {
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
    out.push('HERO (for `hero`): body ' + BODIES.join('/') + '; color, belly, eyeColor as #rrggbb; eyes ' + EYES.join('/') + '; up to 6 extras, each {kind, color}, kinds: ' + EXTRAS.join(', ') + '. A kind may be used twice in two colours (red spots for pepperoni and black spots for olives). What each is for: slice is a triangle body, point down, whose belly is a crust along the top (pizza, cheese, cone); spots are round marks on the body (pepperoni, cow spots, polka dots, freckles); sprinkles are tiny dots (sprinkles, seeds, stars); stripes (tiger, bee, a shirt); drips run down from the top (cheese, slime, icing); outline is a thick edge round the body (crust, shell, a cartoon line); glasses go over the eyes.'
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
    if (c.fixed) return 'fix it, test it with Play, and say it is fixed';
    return 'carry on';
  }
  function aiUp() { return ai.up(); }
  /* One call to the mentor agent, with a deadline. Resolves the answer, or null when there isn't one
     (and says so in the thread, honestly, unless `quiet`). */
  function mentor(text, qOnScreen, who, task) {
    var wait = Chat.thinking(who);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, AI_MS);
    var f = frame(), t0 = Date.now();
    // the page's side of an AI turn, for the student log: the server logs what the AI said (mentor-turn)
    var out = function (how, j) { log('ai', { how: how, said: String(text).slice(0, 300), task: task ? String(task).slice(0, 160) : undefined, reply: j && j.reply, choose: j && j.choose, actions: j && j.actions && j.actions.length ? j.actions : undefined, build: j && j.build || undefined, ms: Date.now() - t0 }); };
    return fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ agent: 'mentor', message: text, history: Chat.history(), budget: AI_MS,
        where: f ? quest(f).title + ', on step "' + (beat(f) ? beat(f).id : 'end') + '".' : 'Their own game, no quest running.',
        studio: context(qOnScreen, who, task) })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        clearTimeout(timer); wait.done();
        // the studio's own rate limit: its words, honestly, and the AI is not down (ui.js gate)
        if (res.status === 429) { out('limited', res.j); return { reply: res.j.reply || 'That’s a lot of messages at once. Give it a minute, then ask again.' }; }
        if (!res.ok || !res.j.reply) { ai.fail(res.status); out(res.ok ? 'empty' : 'failed ' + (res.j.error || ''), res.j); return null; }
        ai.ok(); out('ok', res.j); return res.j;
      }, function (e) { clearTimeout(timer); wait.done(); ai.fail(); out(e && e.name === 'AbortError' ? 'timeout' : 'offline'); return null; });
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
  /* "It's fixed", on a ticket the kid filed: taken only once something has changed and been tested
     with Play since, because a ticket is closed by testing it, not by saying so. Anything short of
     that gets the step that's missing. True when it answered. */
  var FIXED = /\b(fixed|it works|works now|working now|solved|all good|that did it)\b/i, NOT_FIXED = /\b(not|isn['’]?t|still|didn['’]?t|doesn['’]?t|how|why|\?)/i;
  function claimFixed(who) {
    var f = frame(); if (!ownShift(f)) return false;
    who = who || voice();
    if (!f.changedAt) { say([docShift(f) ? 'Nothing’s been built for this one yet. Tell me how you want it, and I’ll build it.' : 'Nothing in the game has changed yet. What do you think is causing it?'], who); return true; }
    if (!(f.playedAt > f.changedAt)) {
      Chat.say([[who, 'Test it first!'], [who, 'Press Play and try it, then tell me.', 'step']]);
      Editor.cue('play'); return true;
    }
    handle({ type: 'fixed' });
    return true;
  }
  /* What the AI asked to change and the page refused, in a sentence: the kid's own fix is theirs to
     make (protectedKeys), and anything else is a setting this part doesn't have, or can't show yet. */
  function notChanged(refused) {
    var a = refused[0], p = Project.part(a.part), what = p ? p.name + '’s ' + Schema.label(p.kind, a.key) : 'that';
    if (protectedKeys()[a.part + '.' + a.key]) return 'I left ' + what + ' for you: that’s the fix you’re working on. It’s in the Inspector.';
    return 'I couldn’t change ' + what + (refused.length > 1 ? ' and ' + (refused.length - 1) + ' more' : '') + ' from here, so ' + (refused.length > 1 ? 'those are' : 'it’s') + ' the same as before.';
  }
  function typed(text, qOnScreen, who) {
    who = who || Chat.active() || 'm';
    track('typed', { to: who, text: text.slice(0, 200) });
    busyKid();
    if (ownShift(frame()) && who === voice() && FIXED.test(text) && !NOT_FIXED.test(text) && claimFixed(who)) return;
    // help, instantly and with no AI: the next rung of the ladder
    if (HELP.test(text) && frame() && beat() && beat().hints && Chat.active() === voice()) { giveHint('asked'); return; }
    /* An answer typed instead of tapped ("the box collider" for "Its Box Collider") is that answer, at
       once and with no AI: in Jay's playthrough (Sept 30) the AI took it as chat and the card came
       back, asking again what the kid had just said. */
    var said = qOnScreen && !qOnScreen.typed ? answerFrom(text, qOnScreen.options) : -1;
    if (said >= 0) { Chat.choose(said + 1); return; }
    /* A finding typed while testing, before the report asks for it: kept for the report (askFindings
       starts from it), and nothing is claimed as written up yet. A question still goes to the AI. */
    var fr = frame(), nb = fr && quest(fr).beats[fr.beat + 1];
    if (nb && nb.ask && nb.ask.from === 'findings' && beat() && !beat().ask && !/\?\s*$/.test(text) && !/^\s*(what|where|why|how|who|when|can|is|are|do|does)\b/i.test(text)) {
      fr.early = (fr.early || []).concat([text]);
      say([Runner.isPlaying() ? 'Got it! Press Stop when you’re ready, and I’ll write that up.' : 'Got it! Keep testing, and press Stop when you’ve found something.'], who);
      return;
    }
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
      // the server's safety check answered instead of the AI (ai/safety.js): its words, and nothing done
      if (j.concern) { Chat.say([[who, j.reply]]); return Chat.reask(); }
      /* CHECKED BEFORE IT IS SAID. The reply is the AI's account of what it did, so what it did is
         filtered first, and anything refused is said plainly after it. When nothing it meant to do
         survived, its reply is not shown at all: "Done, your jump is higher!" over an unchanged jump
         is the lie the audit found (Sept 30, D51), and a 10-year-old believes the words over the game. */
      var asked = j.actions || [], acted = asked.filter(allowed), refused = asked.filter(function (a) { return !allowed(a); });
      var h = j.hero ? cleanHero(j.hero) : null;
      var lines = [], did = acted.length || h || j.build || j.choose;
      if (!refused.length && !(j.hero && !h)) lines.push([who, j.reply]);
      else {
        if (did) lines.push([who, j.reply]);
        if (refused.length) lines.push([who, notChanged(refused)]);
        if (j.hero && !h) lines.push([who, 'I couldn’t draw your hero that way, so it looks the same. Describe it another way?']);
      }
      Chat.say(lines);
      acted.forEach(function (a) { Editor.set(a.part, a.key, a.value); });
      if (acted.length && docShift(frame())) frame().changedAt = Date.now();   // built by asking: it counts (docShift)
      if (acted.length) Chat.event('Changed: ' + acted.map(function (a) { var p = Project.part(a.part); return (p ? p.name : a.part) + ' ' + a.key; }).join(', '), 'i-sliders');
      if (h) { setHero(h, null); Chat.event('Your hero was redrawn', 'i-palette'); }
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
    Builder.ask(brief, { kidSaid: kidSaid, studio: context(null, who), history: Chat.history(), kept: Object.keys(protectedKeys()),
      where: f ? quest(f).title : 'Their own game, no quest running.' })
      .then(function (r) {
        wait.done();
        say([r.reply], who);
        if (r.ok) {
          S.built = (S.built || 0) + 1; save(); badge('first-build');
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
    S.own = S.own || {};   // the tickets the kid found that the course didn't plan (fileOwn)
    delete S.ideas;   // they live in the design doc now; project.js moved an older save's across
    Object.keys(S.tickets).forEach(function (id) { if (!ticketOf(id)) delete S.tickets[id]; });   // a ticket the course no longer has
    if (S.stack.some(function (f) { return !COURSE.quests[f.quest]; })) S.stack = [];             // a quest it no longer has
    if (Object.keys(S.tickets).length && S.reported === undefined) S.reported = true;              // a save from before findings
    S.name = st.name || S.name;
    Runner.on(function (name) {
      if (name === 'play' || name === 'stop' || name === 'reverted') handle({ type: name });
      else if (EVENT_WORDS[name]) handle({ type: 'event', name: name });
      if (name === 'play') Chat.event('Play', 'i-play');
      if (name === 'stop') Chat.event('Stop', 'i-stop');
      if (name === 'reverted') Chat.event('Stop put back what changed in Play mode', 'i-undo');
      if (name === 'error') Chat.event('Error: ' + arguments[1], 'i-flag', { kind: 'bad' });
    });
    Editor.on(function (name, d) {
      if (name === 'select') handle({ type: 'select', name: d });
      if (name === 'set') handle({ type: 'set', detail: d });
    });
    Chat.onAsk(typed);
    catchUp();
    Project.onDoc(function () { var s = Project.doc().sections; if (DESIGNED.every(function (k) { return s[k] && s[k].state === 'decided'; })) badge('designer'); });
    watchBuilder();
    logOn();
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
    /* For the profile (editor.js): every card and badge in the collection's order, each with `earned`. */
    collection: function () {
      return { cards: Object.keys(CARDS).map(function (c) { var k = cardOf(c); k.earned = !!S && S.cards.indexOf(c) >= 0; return k; }),
               badges: BADGES.map(function (b) { return badgeOf(b[0]); }) };
    },
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
      aiBack: function () { ai.ok(); },   // check-playthrough: a stand-in AI after the AI-off run
      onPaint: function (fn) { devPaint = fn; }
    } };
})();
