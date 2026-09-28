/* quest.js: the quest engine. Runs the course's quest files (app/content/quests/, checked by
   app/quests.js) and keeps the tickets. docs/rework/v2-spec.md §2.1–2.2 is the design.

   HOW A BEAT RUNS
     1. `skip_if` already true? Move on (the kid, or the AI, fixed it early).
     2. `do`: reveal panels, point at one, cue Play, start or stop the game, allow components.
     3. `say`: the lines, in the beat's character's voice.
     4. `wait_for`: evidence from the game or the editor. A beat never waits on a Next button. A
        condition that is only about state (a setting already on) is checked straight away too.
     5. When it's met: `pass` (the quiet success sound), `award`, `done_say`, then `ask` if there is
        one, else the next beat.
   `on` handlers react while a beat (or its whole quest) is running: a line when the kid turns the
   fix off again, a flag, a Play cue.

   TICKETS. Every event from the game is checked against every ticket's `found_by`, in every beat of
   every quest, so a problem the kid runs into is filed the moment it happens and never lost. A
   ticket's quest runs INSIDE the quest that picked it (a stack), and when it ends the ticket is
   done and the parent carries on. `fixed_when` closes a ticket the kid (or the AI) fixed early.

   Code keeps the score here; the AI only ever talks, and changes things through Editor.set, the
   same way a tap does. */
var Quest = (function () {
  var COURSE = null, S = null, hintTimer = null, lastFired = {};
  var VOICE = { mentor: 'm', 'lead-programmer': 'p', 'art-director': 'a', 'sound-designer': 'u', 'lead-designer': 'd' };
  var NAME = { mentor: 'the Mentor', 'lead-programmer': 'the lead programmer', 'art-director': 'the art director', 'sound-designer': 'the sound designer', 'lead-designer': 'the lead designer' };
  var DEPT = { engineering: 'Engineering', art: 'Art', audio: 'Audio', design: 'Design', studio: 'Studio' };
  var PANEL = { game: 'dGame', hierarchy: 'dHier', tickets: 'dTickets', play: 'transport', stars: 'stars', project: 'proj' };
  var HEROES = [['alien', 'A green alien', 'The alien!'], ['slime', 'A slime', 'The slime!'], ['frog', 'A frog', 'The frog!'], ['mouse', 'A mouse', 'The mouse!']];
  var NAMES = {
    alien: ['Alien Lava Run', 'Space Hopper', 'Coin Invader'], pink: ['Pink Planet', 'Alien Lava Run', 'Star Hopper'],
    slime: ['Slime Lava Run', 'Bouncy Goo', 'Slime Time'], frog: ['Frog Lava Run', 'Leap of Fire', 'Hop Quest'],
    mouse: ['Mouse Lava Run', 'Cheese Dash', 'Tiny Hero']
  };

  function $(id) { return document.getElementById(id); }
  function frame() { return S.stack[S.stack.length - 1] || null; }
  function quest(f) { f = f || frame(); return f && COURSE.quests[f.quest]; }
  function beat(f) { f = f || frame(); var q = quest(f); return q && q.beats[f.beat]; }
  function save() { Project.save(); }

  /* ---------- the character talking ---------- */
  function character(b, f) {
    var c = (b && b.character) || quest(f).character;
    return c === 'department' ? (S.lastCharacter || 'mentor') : c;
  }
  function voice() { return VOICE[character(beat())] || 'm'; }
  function fill(t) { return String(t).replace(/\{game\}/g, S.name || 'your game'); }
  function say(lines, who) { if (lines && lines.length) Chat.say(lines.map(function (l) { return [who || voice(), fill(l)]; })); }

  /* ---------- conditions ---------- */
  function stateOk(map) {
    return Object.keys(map).every(function (pk) {
      var bits = pk.split('.'), p = Project.part(bits[0]), v = p ? p[bits[1]] : undefined, want = map[pk];
      if (want === null) return v === null || v === undefined || v === false;
      if (want === 'set') return v !== null && v !== undefined && v !== false;
      return v === want;
    });
  }
  function found() { return Object.keys(S.tickets).filter(function (k) { return S.tickets[k].found; }).length; }
  function guards(c, f) {
    if (c.state && !stateOk(c.state)) return false;
    if (c.flag && !(f.flags[c.flag])) return false;
    if (c.not_flag && f.flags[c.not_flag]) return false;
    if (c.found_at_least !== undefined && found() < c.found_at_least) return false;
    if (c.found_none && found() > 0) return false;
    if (c.playing !== undefined && Runner.isPlaying() !== c.playing) return false;
    return true;
  }
  var TRIGGERS = ['event', 'set', 'select', 'play', 'stop', 'reverted', 'filed'];
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
  function file(id, foundIt) {
    var t = COURSE.tickets.filter(function (k) { return k.id === id; })[0];
    if (!t) return;
    var had = S.tickets[id];
    if (!had) S.tickets[id] = { status: 'open', found: !!foundIt };
    else if (foundIt) had.found = true;
    save(); paintTickets();
    if (!had) handle({ type: 'filed', name: id });
  }
  function checkTickets(ev) {
    COURSE.tickets.forEach(function (t) {
      if (t.found_by && !(S.tickets[t.id] && S.tickets[t.id].found) && matches(t.found_by, ev, { flags: {} })) file(t.id, true);
      var mine = S.tickets[t.id];
      if (mine && mine.status === 'open' && t.fixed_when && matches(t.fixed_when, null, { flags: {} })) { mine.status = 'done'; mine.early = true; save(); paintTickets(); }
    });
  }
  function paintTickets() {
    var ul = $('ticketList'); if (!ul) return;
    ul.innerHTML = '';
    var ids = Object.keys(S.tickets);
    if (!ids.length) { ul.innerHTML = '<li class="empty">Nothing yet. Play the game to find what’s broken.</li>'; return; }
    ids.forEach(function (id) {
      var t = COURSE.tickets.filter(function (k) { return k.id === id; })[0], mine = S.tickets[id];
      var li = document.createElement('li'); li.className = 'tk ' + mine.status;
      li.innerHTML = '<span class="st" aria-hidden="true">' + (mine.status === 'done' ? '<svg class="i"><use href="#i-check"/></svg>' : '') + '</span>'
        + '<span class="tt"></span><small></small>';
      li.querySelector('.tt').textContent = t.title;
      li.querySelector('small').textContent = mine.status === 'done' ? 'fixed' : mine.status === 'doing' ? 'working on it · ' + DEPT[t.department] : DEPT[t.department];
      li.setAttribute('aria-label', t.title + ', ' + li.querySelector('small').textContent);
      ul.appendChild(li);
    });
  }

  /* ---------- running beats ---------- */
  function enter() {
    var f = frame(), b = beat(f);
    clearTimeout(hintTimer);
    Chat.clear(); Chat.stopExpecting(); Editor.point(null);
    if (!b) return endQuest();
    Chat.speaker(voice());
    allow(f);
    if (b.skip_if && matches(b.skip_if, null, f)) { f.beat++; save(); return enter(); }
    act(b.do);
    say(b.say);
    if (b.hints_after && b.hint) {
      var at = f.beat, q = f.quest;
      hintTimer = setTimeout(function () { var g = frame(); if (g && g.quest === q && g.beat === at) say(b.hint); }, b.hints_after * 1000);
    }
    paintDev();
    if (b.wait_for) { if (matches(b.wait_for, null, f)) complete(); return; }
    if (b.ask) return ask(b.ask);
    complete();
  }
  function complete() {
    var f = frame(), b = beat(f);
    clearTimeout(hintTimer);
    if (f.completing) return;
    f.completing = true;
    if (b.pass) { UI.sound('good'); UI.feel($('dGame'), 'good'); }
    if (b.award) award(b.award);
    say(b.done_say);
    if (b.ask) { f.completing = false; return ask(b.ask); }
    var delay = b.pass ? 1600 : 0, q = f.quest, at = f.beat;
    setTimeout(function () { var g = frame(); if (g && g.quest === q && g.beat === at) next(b.next); }, delay);
  }
  function next(target) {
    var f = frame(), q = quest(f);
    f.completing = false; f.fired = {};
    if (target === 'end') return endQuest();
    if (target) { var n = q.beats.map(function (b) { return b.id; }).indexOf(target); if (n >= 0) { f.beat = n; save(); return enter(); } }
    f.beat++; save();
    if (f.beat >= q.beats.length) return endQuest();
    enter();
  }
  function endQuest() {
    var f = S.stack.pop(), q = COURSE.quests[f.quest];
    if (q.ticket && S.tickets[q.ticket]) { S.tickets[q.ticket].status = 'done'; paintTickets(); }
    if (S.done.indexOf(q.id) < 0) S.done.push(q.id);
    if (q.character !== 'mentor') S.lastCharacter = q.character;
    save();
    var parent = frame();
    if (!parent) { Chat.speaker('m'); say(['That’s everything on the board for now, @name. Nice work.'], 'm'); paintDev(); return; }
    var pb = beat(parent);
    parent.completing = false;
    if (pb && pb.ask && pb.ask.then === 'again') enter();
    else next(pb && pb.next);
  }

  /* ---------- actions ---------- */
  function act(d) {
    if (!d) return;
    (d.reveal || []).forEach(reveal);
    if (d.file_tickets) COURSE.tickets.forEach(function (t) { file(t.id, false); });
    if (d.stop && Runner.isPlaying()) Editor.togglePlay();
    if (d.play && !Runner.isPlaying()) Editor.togglePlay();
    if (d.close_inspector) Editor.closeInspector();
    if (d.allow) { d.allow.forEach(function (c) { if (S.taught.indexOf(c) < 0) S.taught.push(c); }); allow(frame()); }
    if (d.cue) Editor.cue(true);
    if (d.point) { var el = document.querySelector('#' + (PANEL[d.point] || '') + ' .tab') || $(PANEL[d.point]); if (el) setTimeout(function () { if (!Editor.selected()) Editor.point(pointText(d.point), el); }, 500); }
  }
  function pointText(p) {
    return { game: 'The Game view: where games run.', hierarchy: 'The Hierarchy: every part of the level.', tickets: 'Your tickets: everything that needs fixing.', play: 'Play runs the game.' }[p] || '';
  }
  function reveal(p) {
    if (S.shown.indexOf(p) < 0) { S.shown.push(p); save(); }
    var id = PANEL[p]; if (!id) return;
    if (p === 'play' || p === 'stars' || p === 'project') Editor.reveal(id, true); else Editor.openDock(id, true);
    if (p === 'hierarchy') Editor.tree(true);
  }
  function allow(f) { var q = quest(f); Editor.allow(S.taught.concat((q && q.allow) || [])); }
  function award(a) {
    if (a.stars) { S.stars = (S.stars || 0) + a.stars; Editor.stars(S.stars); reveal('stars'); }
    if (a.card && S.cards.indexOf(a.card) < 0) { S.cards.push(a.card); Editor.cards(S.cards.map(cardName)); reveal('project'); UI.sound('card'); }
    save();
  }
  function cardName(c) { return { 'play-mode': 'Play mode', collider: 'Collider', feedback: 'Feedback', readability: 'Readability', risk: 'Risk' }[c] || c; }

  /* ---------- questions ---------- */
  function ask(a) {
    var who = voice(), f = frame();
    if (a.from === 'tickets') return askTickets(a, who);
    if (a.from === 'heroes') return askHero(a, who);
    if (a.from === 'names') return askName(a, who);
    Chat.ask(fill(a.text), a.answers.map(function (x) {
      return { text: x.text, run: function () {
        if (x.correct) UI.sound('good');
        say(x.say);
        var at = f.beat, q = f.quest;
        var g = frame(); if (!g || g.quest !== q || g.beat !== at) return;
        if (x.goto === 'again') ask(a); else next(x.goto === 'next' ? undefined : x.goto);
      } };
    }), { who: who, keepOrder: !a.answers.some(function (x) { return x.correct; }) });   // a quiz is shuffled; a plain choice keeps its authored order
  }
  function askTickets(a, who) {
    var open = COURSE.tickets.filter(function (t) { return S.tickets[t.id] && S.tickets[t.id].status === 'open'; });
    if (!open.length) { say(['The board is clear!']); var f = frame(); f.completing = false; return next(beat(f).next); }
    Chat.ask(fill(a.text), open.map(function (t) {
      return { text: t.title, sub: DEPT[t.department], run: function () { startTicket(t); } };
    }), { who: who });
  }
  function startTicket(t) {
    S.tickets[t.id].status = 'doing'; paintTickets();
    S.stack.push({ quest: t.quest, beat: 0, flags: {}, fired: {} });
    save();
    enter();
  }
  function askHero(a, who) {
    var list = HEROES.map(function (h) { return { text: h[1], echo: h[2], run: function () { setHero(h[0], null); } }; });
    list.push({ text: 'Something else…', sub: 'describe it', echo: false, run: function () {
      say(['Describe it! A dragon? A pizza? Type it below.']);
      Chat.expect('Describe your hero…', function (text) { scout(text); });
    } });
    Chat.ask(fill(a.text), list, { who: who, keepOrder: true });
  }
  /* "Something else…": until the Art scout searches the whole library (spec §2.3, priority 4), the
     nearest of the heroes the game has, said honestly as a guess. */
  function scout(text) {
    var t = text.toLowerCase(), guess = /frog|toad/.test(t) ? 'frog' : /mouse|rat|hamster/.test(t) ? 'mouse'
      : /slime|goo|blob|jelly/.test(t) ? 'slime' : /pink/.test(t) ? 'pink' : 'alien';
    say(['A ' + text + '! Here’s the closest hero I have, as a guess. You can swap it later.']);
    setHero(guess, text.slice(0, 24).toLowerCase() + ' (guess)');
  }
  function setHero(id, word) {
    var p = Project.part('player'); p.lookWord = word;
    S.hero = id; save();
    Editor.set('player', 'look', id);
    if (!word) say(['Great pick. There’s your hero!']);
    next();
  }
  function askName(a, who) {
    var list = (NAMES[S.hero] || NAMES.alien).map(function (n) { return { text: n, run: function () { setName(n); } }; });
    list.push({ text: 'My own name…', sub: 'type it', echo: false, run: function () {
      Chat.expect('Type your game’s name…', function (text) { setName(text.slice(0, 40)); });
    } });
    Chat.ask(fill(a.text), list, { who: who, keepOrder: true });
  }
  function setName(n) {
    S.name = n; save();
    Editor.reveal('projName', true); Editor.setProjectName(n);
    $('hierOf').textContent = 'your parts';
    say([n + '. Love it. It’s up in the toolbar now.']);
    next();
  }

  /* ---------- everything that happens comes through here ---------- */
  function handle(ev) {
    if (!S || !COURSE) return;
    if (ev.type === 'event' || ev.type === 'set' || ev.type === 'play') checkTickets(ev);
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
      if (h.cue) Editor.cue(true);
      say(h.say);
    });
    if (b && b.wait_for && !f.completing && matches(b.wait_for, ev, f)) complete();
    paintDev();
  }

  /* ---------- typed messages: the current character answers ---------- */
  var CAN = {
    tile: { solid: [true, false] }, ground: { solid: [true, false] },
    coins: { look: [null, 'coin_gold', 'coin_silver', 'gem_blue'], sound: [null, 'ding', 'boing', 'buzz'], size: 'number 1-3' },
    lava: { look: [null, 'lava'], hurts: [true, false] },
    player: { look: ['alien', 'pink', 'slime', 'frog', 'mouse'] },
    level: { look: [null, 'hills'] }
  };
  function allowed(a) {
    var c = CAN[a.part] && CAN[a.part][a.key];
    if (!c) return false;
    if (c === 'number 1-3') return typeof a.value === 'number' && a.value >= 1 && a.value <= 3;
    return c.indexOf(a.value) >= 0;
  }
  function context(qOnScreen) {
    var f = frame(), q = quest(f), b = beat(f), out = [];
    out.push('You are speaking as ' + NAME[character(b, f)] + ', in the quest "' + q.title + '" (' + DEPT[q.department] + ').');
    if (b) {
      if (b.say) out.push('This beat just said: ' + b.say.map(fill).join(' '));
      if (b.wait_for) out.push('The quest is waiting for the kid to: ' + describe(b.wait_for) + '.');
    }
    out.push(qOnScreen ? 'Question on screen: "' + qOnScreen.text + '". Answers: ' + qOnScreen.options.map(function (o, n) { return (n + 1) + '. ' + o.text + (o.sub ? ' (' + o.sub + ')' : ''); }).join('  ') + '.' : 'No question on screen.');
    out.push('Tickets: ' + (Object.keys(S.tickets).map(function (id) { var t = COURSE.tickets.filter(function (k) { return k.id === id; })[0]; return t.title + ' [' + S.tickets[id].status + ']'; }).join('; ') || 'none yet') + '.');
    out.push('Panels on screen: ' + S.shown.join(', ') + ', the chat.' + (Runner.isPlaying() ? ' The game is running (Play mode).' : ' The game is stopped.'));
    out.push('Parts now: ' + Project.get().parts.map(function (p) {
      return p.name + ' (id ' + p.id + ': ' + Object.keys(CAN[p.id] || {}).map(function (k) { return k + '=' + JSON.stringify(p[k]); }).join(', ') + ')';
    }).join('; ') + '.');
    out.push('You can change: ' + Object.keys(CAN).map(function (id) {
      return Object.keys(CAN[id]).map(function (k) { var c = CAN[id][k]; return id + '.' + k + ' to ' + (typeof c === 'string' ? c : c.map(function (x) { return JSON.stringify(x); }).join('/')); }).join(', ');
    }).join('; ') + '. Looks: coin_gold a gold coin, gem_blue a blue gem, lava the lava art, hills a sky with hills. Sounds: ding, boing, buzz.');
    return out.join('\n');
  }
  function describe(c) {
    if (c.event) return { fell: 'fall through a floor', coin: 'grab a coin', lava: 'touch the lava', hurt: 'get hurt by the lava', crossed: 'stand on the fixed floor tile in Play mode' }[c.event] || c.event;
    if (c.select) return 'tap ' + c.select + ' in the Hierarchy';
    if (c.state) return 'set ' + Object.keys(c.state).map(function (k) { return k + ' to ' + JSON.stringify(c.state[k]); }).join(' and ');
    if (c.stop) return 'press Stop';
    if (c.reverted) return 'change something while playing, then press Stop and see it undo';
    return 'carry on';
  }
  function typed(text, qOnScreen) {
    Chat.hide();
    var wait = Chat.thinking();
    var q = quest();
    fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'mentor', message: text, history: Chat.history().slice(0, -1),
        where: q.title + ', on beat "' + beat().id + '".', studio: context(qOnScreen) })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        wait.done();
        if (!res.ok || !res.j.reply) return pinned(text);
        Chat.say([[voice(), res.j.reply]]);
        (res.j.actions || []).filter(allowed).forEach(function (a) { Editor.set(a.part, a.key, a.value); });
        if (res.j.choose && Chat.question() === qOnScreen && qOnScreen && qOnScreen.options[res.j.choose - 1]) Chat.choose(res.j.choose);
        else Chat.reask();
      })
      .catch(function () { wait.done(); pinned(text); });
  }
  function pinned(text) {
    S.ideas.push(text.slice(0, 200)); save();
    Chat.say([[voice(), 'I couldn’t think that through just now, but I’ve pinned it to your idea board.']]);
    Chat.reask();
  }

  /* ---------- the dev panel's handle (studio/dev.js; never served to a real deployment) ---------- */
  var devPaint = null;
  function paintDev() { if (devPaint) devPaint(); }

  function start(course) {
    COURSE = course;
    var st = Project.get();
    if (!st.quest) st.quest = { stack: [], tickets: {}, done: [], taught: [], shown: [], stars: 0, cards: [], ideas: [] };
    S = st.quest;
    S.name = st.name || S.name; st.ideas = S.ideas;
    Runner.on(function (name) {
      if (name === 'play' || name === 'stop' || name === 'reverted') handle({ type: name });
      else if (['fell', 'coin', 'lava', 'hurt', 'crossed'].indexOf(name) >= 0) handle({ type: 'event', name: name });
    });
    Editor.on(function (name, d) {
      if (name === 'select') handle({ type: 'select', name: d });
      if (name === 'set') handle({ type: 'set', detail: d });
    });
    Chat.onAsk(typed);
    // Put the screen back the way this kid left it.
    S.shown.forEach(reveal);
    if (S.stars) Editor.stars(S.stars);
    if (S.cards.length) Editor.cards(S.cards.map(cardName));
    if (S.name) { Editor.setProjectName(S.name); $('hierOf').textContent = 'your parts'; }
    paintTickets();
    if (!S.stack.length && S.done.indexOf('first-day') < 0) S.stack.push({ quest: 'first-day', beat: 0, flags: {}, fired: {} });
    S.stack.forEach(function (f) { f.completing = false; });
    if (S.stack.length) enter();
    else { Chat.speaker('m'); say(['Welcome back, @name!'], 'm'); }
  }

  return { start: start, handle: handle,
    dev: {
      state: function () { return S; }, course: function () { return COURSE; },
      where: function () { var f = frame(); return f ? f.quest + ' › ' + (beat(f) ? beat(f).id : '(end)') : '(no quest)'; },
      skip: function () { var f = frame(); if (!f) return; f.completing = false; next(); },
      jump: function (questId, beatIndex) { S.stack = [{ quest: questId, beat: beatIndex || 0, flags: {}, fired: {} }]; save(); enter(); },
      fire: function (ev) { handle(ev); },
      onPaint: function (fn) { devPaint = fn; }
    } };
})();
