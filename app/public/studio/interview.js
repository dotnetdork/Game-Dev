/* interview.js: the hiring interview (interview.html). docs/rework/v2-spec.md §3.2, and the round-2
   rework in docs/rework/v2-review-2026-09-28.md §5 ("make it listen").

   A CONVERSATION, NOT A SURVEY (Jay, 2026-09-28). The first build asked wireframe 07's beats in a
   fixed order with a card of answers under each, and it read as a form to fill in. Now the Studio
   Director is the interviewer agent (ai/agents/interviewer.md): it asks one open question at a time,
   reacts in the kid's own words, and digs. There are no premade answers; typing is the way in.

   IT HAS TO LISTEN (Jay, round 2): "if a student likes RuneScape, ask why ... was it the grind, the
   click to move, the lore ... we are trying to gather not the game, but what elements of that game
   they liked, and why over games with similar mechanics." The second build's `games` goal was done
   the moment a game was named, so the clipboard said "plays RuneScape, Project Zomboid", which tells
   a studio nothing. So the games goal is now a LADDER, one rung per turn:
     game     a game they love (not just play)
     element  which part of it: the grind, click-to-move, the lore, the jokes... (free text, their words)
     why      why that part is fun for them
     over     (the `contrast` goal) why this game's version and not another game's
   and it is only done when the card holds a {game, element, why}. The CODE decides that, from what
   `learned` holds and what the kid actually typed (learnLoves), never from the director saying so:
   a "you're hired!" before the name and the why are in is thrown away and the next question asked.

   The AI leads, the code keeps the goals. Every turn the browser tells the director what it knows,
   what is still open and what to do NOW (context()), and the director says what it learned as JSON.
   The goals, in the order nextGoal() offers them:
     name        first name and last initial (Jed approved it, 2026-09-28; no handles, Jay). Must
                 appear in something the kid typed, so a model can't invent one.
     games       the ladder above: at least one {game, element, why}
     contrast    one "why this one over the others?" (let go after two turns: nice, not needed)
     notFan      a game or a thing they don't like, and what bugged them
     wants       the game they'd make if they could make anything
     confidence  1 to 5, how sure they are that they could make a game (growth snapshot)
     job         which studio job sounds most fun (always last)
   and the tablet's try-this moments, which record the kid's tap exactly (the growth snapshot):
     jumps  sounds  engine  words (one is made up: flarnish)  coin (their first fix, always the last test)
   The tablet FOLLOWS THE TALK: after the ladder, talk and tablet alternate, and the tablet offered is
   the one that connects to what they said (they talked about feel, so: the two jumps). Never mid-ladder.
   A goal the conversation keeps missing is let go after a few turns, and the whole thing is capped,
   so a chatty kid is still at their desk in time.

   RESILIENCE (§4 rule 10). Each turn waits at most 12 s for the director, then says the scripted
   line for the next open goal instead (scripted(), which ladders too, in plainer words). After two
   failures in a row the interview stays scripted to the end, and says so quietly under the text box.

   THE SAVED CARD. It lives in localStorage (studio.interview) and goes to the server with the saves
   (save.js, the studio page); the name and badge also go on the kid's roster card
   (/auth/studio/profile). Internal fields may change; `CARD.profile` is the stable part, rewritten on
   every save, and it is what the studio's mentor reads to personalise quests:
     { who,                         the signed-in account (/auth/studio/me card.id)
       first, initial,              "Maya", "R"
       games: [..],                 every game they named, ≤8, ≤30 chars
       loves: [{ game, element, why, over }],   ≤6; element/why/over are short phrases in their words
       notFan: [..],                ≤3, ≤50 chars ("waiting around in Clash Royale")
       wants: '',                   ≤60 chars, the game they'd make
       fun: [..],                   explore challenge clever social make story collect feel progress
                                    characters funny cozy (heard, never asked as a list)
       confidence, job,             1..5; art | audio | design | engineering | everything
       jump, sound, tone, note,     floaty|snappy|same; ding|thud; keen|curious|silly|shy; last note
       tried: { playTap, jumpTap, wordsHeard, decoyTicked, coinFixed } }   the tablet's taps

   A SHARED CHROMEBOOK. The card used to reset only when it was v1 or done, so the second kid to sign
   up on a Chromebook sat down in the middle of the first kid's interview, with their name on the
   clipboard. The card is stamped with the account it belongs to (`who`) and thrown away when the
   signed-in account differs. Until /auth/studio/me has answered, nothing can be typed. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'studio.interview';
  var CAP = 30;          // kid turns, then the studio hires them with what it has
  var LET_GO = 6;        // turns a goal may sit as "next" before the interview moves past it
  var TIMEOUT = 12000;   // ms the director gets per turn before the scripted line is said instead
  var CARD = null, busy = true;

  function fresh() {
    return { v: 2, who: null, tone: null, first: '', initial: '', games: [], fun: [], notes: [],
             loves: [], notFan: [], wants: '', feelJump: null, feelSound: null,
             job: null, confidence: null, coinFixed: null, said: {}, moved: {}, asking: 'hello',
             badge: { colour: '#e0474c', icon: 'rocket' },
             snapshot: { jumpPick: null, playTap: null, jumpTap: null, wordsHeard: null, decoyTicked: false, confidence: null },
             typedSomething: false, turns: 0, focus: { id: null, turns: 0 }, log: [], showing: null,
             fails: 0, scripted: false, hired: false, done: false };
  }
  function save() { CARD.profile = profile(); try { localStorage.setItem(KEY, JSON.stringify(CARD)); } catch (e) {} }
  function load() {
    try { CARD = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { CARD = null; }
    if (!CARD || typeof CARD !== 'object' || CARD.v !== 2 || CARD.done) CARD = fresh();   // v1 was the scripted interview's card
    else CARD = Object.assign(fresh(), CARD);   // a card from before a field existed gets its default
  }
  function profile() {
    var s = CARD.snapshot || {};
    return { who: CARD.who, first: CARD.first, initial: CARD.initial, games: CARD.games.slice(),
      loves: CARD.loves.filter(function (l) { return l.game && l.element; }).map(function (l) { return { game: l.game, element: l.element, why: l.why || '', over: l.over || '' }; }),
      notFan: CARD.notFan.slice(), wants: CARD.wants, fun: CARD.fun.slice(), confidence: CARD.confidence, job: CARD.job,
      jump: CARD.feelJump, sound: CARD.feelSound, tone: CARD.tone, note: CARD.notes[CARD.notes.length - 1] || '',
      tried: { playTap: s.playTap, jumpTap: s.jumpTap, wordsHeard: s.wordsHeard, decoyTicked: !!s.decoyTicked, coinFixed: CARD.coinFixed } };
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function named() { return CARD.first + (CARD.initial ? ' ' + CARD.initial + '.' : ''); }
  function clip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  function short(t) { var w = String(t).split(/\s+/); return w.length > 6 ? w.slice(0, 6).join(' ') + '…' : String(t); }
  /* A real answer, not "idk" and not a tablet tap: only a real answer can fill a rung of the ladder. */
  var FILLER = /^(idk|i ?d[o']?nt know|i do not know|dunno|nothing|no+|nope|nah|yes+|yeah|yep|ok(ay)?|k|sure|maybe|lol|um+|uh+|hm+|not sure|what|why|huh)\W*$/i;
  function real(t) { t = String(t || '').trim(); return t.length > 1 && !/^\[tablet\]/.test(t) && !FILLER.test(t); }
  function kidText() { return CARD.log.filter(function (m) { return m.role === 'user' && !/^\[tablet\]/.test(m.content); }).map(function (m) { return m.content; }).join(' ').toLowerCase(); }

  /* ---------- the goals ---------- */
  var GOALS = [
    { id: 'name', done: function (c) { return !!c.first; } },
    { id: 'games', done: function (c) { return c.loves.some(function (l) { return l.game && l.element && l.why; }); } },
    { id: 'contrast', done: function (c) { return c.loves.some(function (l) { return !!l.over; }); } },
    { id: 'jumps', tablet: true, done: function (c) { return !!c.feelJump; },
      links: /\b(feel|control|mov|jump|fast|speed|smooth|click|parkour|run(ning)?\b|dodg|combat|fight|physic|drift|swing)/i, bridge: 'You care how a game feels.',
      ask: 'Two jumps on my tablet. Try both. Which one feels better?' },
    { id: 'sounds', tablet: true, done: function (c) { return !!c.feelSound; },
      links: /\b(sound|music|audio|satisf|crunch|song|hear\b|loud)/i, bridge: 'Sounds matter more than people think.',
      ask: 'You grab a coin. Tap both sounds on my tablet. Which one fits?' },
    { id: 'engine', tablet: true, done: function (c) { return !!c.snapshot.jumpTap; },
      links: /\b(build|make|making|creat|mods?\b|modding|design|craft|edit|base|house)/i, bridge: 'You like making things.',
      ask: 'Here’s a tiny game engine on my tablet. Just guess, there’s no wrong answer.' },
    { id: 'words', tablet: true, done: function (c) { return c.snapshot.wordsHeard !== null; },
      links: /\b(code|coding|program|script|learn|wiki|how it works|glitch|speedrun)/i, bridge: 'Quick one for a curious mind.',
      ask: 'Which of these words have you heard before? Tap any on my tablet.' },
    { id: 'notFan', done: function (c) { return c.notFan.length > 0 || !!c.said.notFan; } },
    { id: 'wants', done: function (c) { return !!c.wants; } },
    { id: 'confidence', done: function (c) { return !!c.confidence || !!c.said.confidence; } },
    { id: 'coin', tablet: true, done: function (c) { return !!c.coinFixed; },
      ask: 'Last test! This coin should make a sound, but it’s silent. Give it one on my tablet.' },
    { id: 'job', done: function (c) { return !!c.job || !!c.said.job; } }
  ];
  function goal(id) { return GOALS.filter(function (g) { return g.id === id; })[0]; }
  function covered(g) { return g.done(CARD) || (g.id !== 'name' && !!CARD.moved[g.id]); }
  function open() { return GOALS.filter(function (g) { return !covered(g); }); }
  function digging() { return !covered(goal('games')); }

  /* The rung of the ladder the games goal is on: the first love without a why, and what it needs. */
  function dig() {
    if (!digging()) return null;
    var l = CARD.loves.filter(function (x) { return !(x.element && x.why); })[0];
    if (!l && CARD.games.length && CARD.loves.length < 6) {   // they named games before saying which one they love: dig into the first
      var g = CARD.games.filter(function (n) { return !love(n); })[0];
      if (g) { l = { game: g, element: '', why: '', over: '' }; CARD.loves.push(l); }
    }
    return { love: l || null, need: !l || !l.game ? 'game' : !l.element ? 'element' : 'why' };
  }
  function love(game) { var k = String(game).toLowerCase(); return CARD.loves.filter(function (l) { return l.game && l.game.toLowerCase() === k; })[0]; }
  /* The one love the contrast is about: the first with a why and no `over` yet. */
  function contrasting() { return CARD.loves.filter(function (l) { return l.why && !l.over; })[0] || null; }

  /* What comes next. The name, then the ladder, then one contrast; then a tablet test and a question
     take turns (the test that connects to what they said), the coin is the last test and the job the
     last question. A test that is on the tablet stays next until it's tapped. */
  function nextGoal() {
    var left = open();
    if (!left.length) return null;
    var has = function (id) { return left.filter(function (g) { return g.id === id; })[0]; };
    if (has('name')) return has('name');
    if (has('games')) return has('games');
    if (CARD.showing && has(CARD.showing)) return has(CARD.showing);
    if (has('contrast')) return has('contrast');
    var tabs = left.filter(function (g) { return g.tablet && g.id !== 'coin'; });
    var talk = left.filter(function (g) { return !g.tablet && g.id !== 'job'; });
    if (tabs.length && (4 - tabs.length <= 3 - talk.length || !talk.length)) return linked(tabs) || tabs[0];
    if (talk.length) return talk[0];
    return has('coin') || has('job') || left[0];
  }
  /* The tablet test that follows the talk: the first one whose words the kid used lately, or in
     what they love. null when nothing they said points anywhere. */
  function linked(tabs) {
    var recent = CARD.log.filter(function (m) { return m.role === 'user' && !/^\[tablet\]/.test(m.content); }).slice(-3).map(function (m) { return m.content; })
      .concat(CARD.loves.map(function (l) { return (l.element || '') + ' ' + (l.why || ''); })).join(' ');
    return tabs.filter(function (g) { return g.links && g.links.test(recent); })[0] || null;
  }
  function asking(g) { return !g ? 'hired' : g.id === 'games' ? 'games:' + dig().need : g.id; }

  /* After each kid turn: the goal that's been "next" too long is let go (never the name). */
  function tick() {
    CARD.turns++;
    var g = nextGoal();
    if (!g) return;
    if (CARD.focus.id === g.id) CARD.focus.turns++; else CARD.focus = { id: g.id, turns: 1 };
    var limit = g.id === 'contrast' ? 2 : LET_GO;
    if (g.id !== 'name' && CARD.focus.turns > limit && (!g.tablet || CARD.showing === g.id)) { CARD.moved[g.id] = true; CARD.focus = { id: null, turns: 0 }; }
  }

  /* ---------- the director ---------- */
  function react(kind) {
    var s = $('scene'), cls = 'iv-' + kind;
    s.classList.remove('iv-lean', 'iv-laugh', 'iv-scribble', 'iv-nod'); void s.offsetWidth; s.classList.add(cls);
    if (kind !== 'lean') setTimeout(function () { s.classList.remove(cls); }, 1400);
  }
  /* A jot: the director scribbles, and the clipboard is redrawn from the card. The jots themselves are
     kept (CARD.notes, the last one is the profile's `note`) but the clipboard shows the card's sections. */
  function jot(word) {
    if (!word) return;
    react('scribble');
    CARD.notes.push(clip(word, 60)); if (CARD.notes.length > 12) CARD.notes.shift();
    drawNotes();
  }
  /* The clipboard: short sections a kid can read, in their own words (§5). Only filled ones show. */
  function sections() {
    var loves = CARD.loves.filter(function (l) { return l.game; }).map(function (l) { return l.element ? l.element + ' (' + l.game + ')' : l.game; });
    if (CARD.feelJump) loves.push(CARD.feelJump === 'same' ? 'any jump' : CARD.feelJump + ' jumps');
    if (CARD.feelSound) loves.push('a ' + CARD.feelSound + ' for a coin');
    var because = [];
    CARD.loves.forEach(function (l) { if (l.why) because.push(l.why); if (l.over) because.push('over the rest: ' + l.over); });
    var wants = CARD.wants ? [CARD.wants] : [];
    if (CARD.job) wants.push('job: ' + JOB[CARD.job]);
    return [['Name', CARD.first ? [named()] : []], ['Loves', loves], ['Because', because], ['Not a fan of', CARD.notFan],
            ['Wants to make', wants], ['Feels ready', CARD.confidence ? [CARD.confidence + ' / 5'] : []]]
      .filter(function (s) { return s[1].length; });
  }
  function drawNotes() {
    var dl = $('notes'), s = sections();
    dl.innerHTML = s.length ? '' : '<div class="empty">(nothing yet)</div>';
    s.forEach(function (sec) {
      var div = document.createElement('div'), dt = document.createElement('dt');
      dt.textContent = sec[0]; div.appendChild(dt);
      sec[1].slice(-3).forEach(function (t) { var dd = document.createElement('dd'); dd.textContent = clip(t, 60); div.appendChild(dd); });
      if (sec[0] === 'Name') div.className = 'name';
      dl.appendChild(div);
    });
  }
  function remember(role, text) { CARD.log.push({ role: role, content: text }); if (CARD.log.length > 16) CARD.log.shift(); }

  /* The director's words land as one short paragraph, after a short beat, then `then`. */
  function say(text, then) {
    var w = $('words'), b = $('bubble');
    busy = true; lock(true);
    w.innerHTML = '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    setTimeout(function () {
      w.textContent = text; b.classList.remove('fresh'); void b.offsetWidth; b.classList.add('fresh');
      $('announce').textContent = text;
      remember('assistant', text); save();
      busy = false; lock(false);
      if (then) then();
    }, reduced() ? 100 : Math.min(900, 380 + text.length * 3));
  }
  function thinking() { busy = true; lock(true); $('words').innerHTML = '<span class="wheel" aria-hidden="true"></span>Thinking…'; }
  function lock(on) { $('sendBtn').disabled = on; }
  function echo(text) { $('echo').innerHTML = text ? '<span>You: ' + esc(text) + '</span>' : ''; }
  function showMode() { $('mode').hidden = !CARD.scripted || CARD.hired; }

  /* ---------- a turn ---------- */
  $('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('say'), text = input.value.trim().slice(0, 200);
    if (!text || busy || CARD.hired) return;
    input.value = '';
    CARD.typedSomething = true;
    echo(text);
    // not about the game (ui.js, SAFETY): a fixed, kind answer, and the line goes no further, not even into the log
    var worry = UI.concern(text, 'interview');
    if (worry) { say(worry.reply); return; }
    turn(text);
  });
  /* One kid turn: `said` is what goes to the director, `tap` the tablet goal it came from (if any).
     The goal and the rung are read BEFORE the turn, because that is the question the kid answered. */
  function turn(said, tap) {
    var focus = nextGoal(), d = dig(), step = focus && focus.id === 'games' && d ? d.need : null;
    var prev = (CARD.log.filter(function (m) { return m.role === 'assistant'; }).pop() || {}).content || '';
    remember('user', said); tick(); save();
    thinking();
    if (CARD.scripted) { setTimeout(function () { scripted(said, focus, step, tap); }, reduced() ? 60 : 450); return; }
    var body = { agent: 'interviewer', message: said, history: CARD.log.slice(0, -1),
      where: 'The hiring interview: their very first minutes at the studio, before they have seen the game engine.', studio: context() };
    var ctl = window.AbortController ? new AbortController() : null, settled = false;
    var fail = function () {
      if (settled) return; settled = true; clearTimeout(timer);
      CARD.fails++; if (CARD.fails >= 2) { CARD.scripted = true; showMode(); }
      scripted(said, focus, step, tap);
    };
    var timer = setTimeout(function () { if (ctl) ctl.abort(); fail(); }, TIMEOUT);
    fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (settled) return;
        if (!res.ok || !res.j.reply || !res.j.learned) return fail();
        settled = true; clearTimeout(timer); CARD.fails = 0;
        // the server's safety check answered instead of the AI (ai/safety.js): nothing is learned from it
        if (res.j.concern) { CARD.log = CARD.log.filter(function (m) { return !(m.role === 'user' && m.content === said); }); return say(res.j.reply); }
        learn(res.j.learned, said);
        if (!tap) net(focus, step, said, prev, res.j.reply);
        answered(res.j.reply, res.j.show, res.j.done);
      })
      .catch(fail);
  }

  /* What the director is told each turn. Plain words: it's read by a model, and by whoever debugs it. */
  var TALK_HINT = { notFan: 'a game (or a kind of thing in games) they DON’T like, and what bugs them about it',
    wants: 'the game they would make if they could make anything', confidence: 'from 1 to 5, how sure they are they could make a game',
    job: 'which studio job sounds most fun: art, sounds, levels, making it work, or everything' };
  function context() {
    var known = [];
    if (CARD.first) known.push('name: ' + named());
    CARD.loves.forEach(function (l) {
      if (!l.game) return;
      known.push('loves ' + l.game + (l.element ? ': the part they love is "' + l.element + '"' : ' (which part: not known yet)')
        + (l.why ? ', because "' + l.why + '"' : '') + (l.over ? ', and over other games: "' + l.over + '"' : ''));
    });
    var others = CARD.games.filter(function (g) { return !love(g); });
    if (others.length) known.push('also plays: ' + others.join(', '));
    if (CARD.notFan.length) known.push('not a fan of: ' + CARD.notFan.join('; '));
    if (CARD.wants) known.push('wants to make: ' + CARD.wants);
    if (CARD.feelJump) known.push('jump they liked: ' + CARD.feelJump);
    if (CARD.feelSound) known.push('coin sound they liked: ' + CARD.feelSound);
    if (CARD.snapshot.playTap) known.push('engine guesses: Play at "' + AREA[CARD.snapshot.playTap] + '"' + (CARD.snapshot.jumpTap ? ', jump height at "' + AREA[CARD.snapshot.jumpTap] + '"' : ''));
    if (CARD.snapshot.wordsHeard) known.push('words heard of: ' + (CARD.snapshot.wordsHeard.join(', ') || 'none') + (CARD.snapshot.decoyTicked ? ' (and the made-up one, flarnish)' : ''));
    if (CARD.coinFixed) known.push('fixed the coin with: ' + CARD.coinFixed);
    if (CARD.confidence) known.push('confidence: ' + CARD.confidence + ' of 5');
    if (CARD.job) known.push('job: ' + CARD.job);
    var lines = ['Known so far (never ask for these again): ' + (known.join(' | ') || 'nothing yet') + '.'];
    var next = nextGoal(), d = dig(), c = contrasting();
    if (!next) lines.push('EVERY GOAL IS COVERED. Wrap up in one or two warm sentences, tell them they\'re hired, and set done to true.');
    else {
      lines.push('Still open: ' + open().map(function (g) { return g.id + (g.tablet ? ' (tablet)' : ''); }).join(', ') + '.');
      var now;
      if (next.id === 'name') now = 'their first name and last initial.';
      else if (next.id === 'games') now = d.need === 'game' ? 'find a game they LOVE, then dig into it. No tablet yet.'
        : d.need === 'element' ? 'dig into ' + d.love.game + ': which part of it do they love? Stay on it until you know. No tablet yet.'
        : 'they love "' + d.love.element + '" in ' + d.love.game + '. Ask WHY, using their words. Stay on it until you have a why. No tablet yet.';
      else if (next.id === 'contrast') now = c ? 'one contrast. Other games have "' + c.element + '" too: why ' + c.game + '’s? Then move on.' : 'move on.';
      else if (next.tablet) now = 'the ' + next.id + ' test: set show to "' + next.id + '" and say what to try.' + (next.links && linked([next]) ? ' Link it to what they said (' + next.bridge.toLowerCase().replace(/\.$/, '') + ').' : '');
      else now = TALK_HINT[next.id] + '.';
      /* The model hears the answer and still leaves `learned` empty unless it's shown the exact slot. */
      if (next.id === 'games' && d.need !== 'game') now += ' If their last message answers that, write it as "learned": {"loves": [{"game": "' + d.love.game + '", "' + d.need + '": "their words"}]}.';
      lines.push('NOW: ' + now + (CARD.focus.id === next.id && CARD.focus.turns >= 3 ? ' It has been next for ' + CARD.focus.turns + ' turns: finish up and move to it.' : ''));
    }
    lines.push('Tablet: ' + (CARD.showing ? 'showing "' + CARD.showing + '", waiting for their tap' : 'off') + '.');
    lines.push('Kid turns so far: ' + CARD.turns + ' of about ' + CAP + '.' + (CARD.turns > CAP - 6 && next ? ' Time is nearly up: keep it quick.' : ''));
    if (CARD.tone) lines.push('They come across as: ' + CARD.tone + '.');
    return lines.join('\n');
  }

  /* Take what the director says it learned, but only what holds up. */
  function learn(l, said) {
    var kidSaid = kidText();
    if (l.first && !CARD.first && kidSaid.indexOf(l.first.toLowerCase()) >= 0) {
      CARD.first = l.first.charAt(0).toUpperCase() + l.first.slice(1).toLowerCase();
      if (l.initial) CARD.initial = l.initial;
      jot(named()); sendName();
    } else if (l.initial && CARD.first && !CARD.initial) { CARD.initial = l.initial; sendName(); }
    if (l.games) l.games.forEach(function (g) { if (grounded(g)) addGame(g); });
    if (l.loves) learnLoves(l.loves, said);
    if (l.notFan && real(said)) l.notFan.forEach(function (n) { if (CARD.notFan.length < 3 && CARD.notFan.indexOf(n) < 0) { CARD.notFan.push(clip(n, 50)); jot('not a fan: ' + n); } });
    if (l.wants && !CARD.wants && real(said)) { CARD.wants = clip(l.wants, 60); jot('wants to make ' + CARD.wants); }
    if (l.fun) l.fun.forEach(addFun);
    if (l.confidence && !CARD.confidence) jot('feels ready: ' + l.confidence + ' of 5');
    if (l.job && !CARD.job) jot('job: ' + JOB[l.job]);
    if (l.jump && !CARD.feelJump) { CARD.feelJump = l.jump; if (!CARD.snapshot.jumpPick) CARD.snapshot.jumpPick = l.jump; }
    if (l.sound && !CARD.feelSound) CARD.feelSound = l.sound;
    if (l.confidence) { CARD.confidence = l.confidence; if (!CARD.snapshot.confidence) CARD.snapshot.confidence = l.confidence; }
    if (l.job) CARD.job = l.job;
    if (l.tone && !CARD.tone) CARD.tone = l.tone;
    if (l.note && CARD.notes.indexOf(l.note) < 0) jot(l.note);
    drawNotes(); save();
  }
  function addGame(g) { g = clip(g, 30); if (g && !CARD.games.some(function (x) { return x.toLowerCase() === g.toLowerCase(); }) && CARD.games.length < 8) CARD.games.push(g); }
  function addFun(f) { if (f && CARD.fun.indexOf(f) < 0) CARD.fun.push(f); }
  /* A game counts when the kid typed it (a word of it, at least), or it's one they already named: a
     model can't put a game in their mouth. A rung counts only on a real answer, and in order: a why
     belongs to an element, a contrast to a why. The director may name the game or leave it out (it
     then belongs to the game being dug into). */
  function grounded(game) {
    var text = kidText(), words = String(game).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 3; });
    return CARD.games.some(function (x) { return x.toLowerCase() === String(game).toLowerCase(); })
      || (words.length ? words.some(function (w) { return text.indexOf(w.slice(0, 5)) >= 0; }) : text.indexOf(String(game).toLowerCase()) >= 0);
  }
  function learnLoves(list, said) {
    var ok = real(said);
    list.forEach(function (n) {
      var l = null;
      if (n.game) { if (!grounded(n.game)) return; l = love(n.game); }
      else { var d = dig(); l = (d && d.love) || contrasting(); }
      if (!l) {
        if (!n.game || CARD.loves.length >= 6) return;
        l = { game: clip(n.game, 30), element: '', why: '', over: '' }; CARD.loves.push(l); addGame(l.game); jot('loves ' + l.game);
      }
      if (n.element && !l.element && ok) { l.element = clip(n.element, 40); jot('loves ' + l.element + ' in ' + l.game); funFrom(l.element); }
      if (n.why && !l.why && l.element && ok) { l.why = clip(n.why, 80); jot('because ' + l.why); funFrom(l.why); }
      if (n.over && !l.over && l.why && ok) { l.over = clip(n.over, 80); jot('over others: ' + l.over); }
    });
  }
  function funFrom(t) { Object.keys(FUN).forEach(function (f) { if (FUN[f].test(t)) addFun(f); }); }

  /* The safety net. A small model often understands an answer and still leaves `learned` empty
     ("Nice to meet you, Maya R!", learned: {}), and then asks for it forever. So when the goal the kid
     was just asked is still open, the browser reads the answer itself, but only takes what holds up:
     a name counts when the kid typed it AND the director then called them by it; a number from 1 to 5
     for confidence; a job's keyword; a rung of the ladder only when the question the kid was answering
     asked for that rung (a "why" question for a why); other talk goals, a real answer, kept as said. */
  var NOT_A_NAME = /^(yes|yeah|yep|no|nope|ok|okay|sure|cool|hi|hello|hey|idk|um|uh|what|why|i|im|my|the|a|maybe|lol|nothing|dunno|sup|yo)$/i;
  var ASKED = { game: /game/i, element: /part|best|favou?rite|what .*(like|love)|love most|keeps? you|which/i, why: /why|how come|what .*about|makes? .*(fun|good|great|special|feel)|fun for you/i,
                contrast: /why .*(not|instead|over)|other games|another|different|compared|lots of games|too\b/i,
                /* Word edges on all of these: "hate" matched "whatever's", and a contrast answer was
                   filed as a game they don't like. */
                notFan: /\b(didn['’]?t (like|enjoy|get)|don['’]?t (like|enjoy)|not a fan|hated?|least favou?rite|boring|annoy\w*|opposite|flip side)\b/i,
                wants: /\b(make|build|create|design)\b.*\b(own|dream|any|a) game\b|\bgame (would|could|will|do) you (want to )?(make|build)\b|\bif you could make\b/i,
                confidence: /\b(1 to 5|one to five|out of (5|five)|on a scale)\b/i,
                job: /\b(which|what) (studio )?job|\bjobs? (at|in) (a|the)\b|\bwhich part of making\b|\bwhat would you (want to )?do\b/i };
  /* "yes! I'm Jay S" → Jay, S: the hello and the introduction come off before the name is read. */
  function nameWords(t) {
    return t.replace(/^\W*((yes|yeah|yep|yup|sure|ok|okay|hi|hey|hello|sup|yo)\b[\s,!.]*)+/i, '')
      .replace(/^(my name is|my name's|my names|i am|i'm|im|call me|it's|its|this is)\s+/i, '').match(/[\p{L}'’-]+/gu) || [];
  }
  function net(focus, step, said, prev, reply) {
    if (!CARD.first) {
      var w = nameWords(said);
      if (w.length && w.length <= 3 && !NOT_A_NAME.test(w[0]) && (' ' + reply.toLowerCase().replace(/[^\p{L}'’-]+/gu, ' ') + ' ').indexOf(' ' + w[0].toLowerCase() + ' ') >= 0) {
        CARD.first = w[0].charAt(0).toUpperCase() + w[0].slice(1).toLowerCase(); CARD.initial = w[1] ? w[1].charAt(0).toUpperCase() : '';
        jot(named()); sendName();
      }
    }
    if (!focus || !real(said)) return;
    /* A why also counts when the answer is a reason itself ("cuz i can make whatever is in my head"),
       whatever the question looked like (Sonnet 5 asked "is it the creating part, or the planning?"). */
    if (focus.id === 'games') { if (digging() && dig().need === step && (ASKED[step].test(prev) || (step === 'why' && /\b(cuz|cause|coz|because|bc|since)\b/i.test(said)))) fallbackParse('games', said, step); drawNotes(); save(); return; }
    /* The director doesn't always ask what the page had next: with the engine next, Sonnet 5 asked
       "what's a game you tried but really didn't like?" and wrote nothing down. So the answer goes to
       the talk goal the question was plainly about, when that isn't the one the page expected. */
    var TALK = ['notFan', 'wants', 'confidence', 'job', 'contrast'];   // most specific question first: a contrast's "another" is broad
    var about = TALK.filter(function (id) { return !covered(goal(id)) && ASKED[id].test(prev); })[0];
    if (about) focus = goal(about);
    if (covered(focus)) return;
    else if (focus.id === 'contrast') { if (ASKED.contrast.test(prev)) fallbackParse('contrast', said); }
    else if (focus.id === 'confidence') { if (/\b[1-5]\b/.test(said)) fallbackParse('confidence', said); }
    else if (focus.id === 'job') { if (/art|draw|sound|music|audio|level|design|code|program|engineer|all|every/i.test(said)) fallbackParse('job', said); }
    else if (focus.id === 'notFan' || focus.id === 'wants') fallbackParse(focus.id, said);
    drawNotes(); save();
  }
  function sendName() {
    fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: CARD.first, initial: CARD.initial }) }).catch(function () {});
  }

  /* The director's reply has landed: say it, turn the tablet to what it asked for, and hire if the
     goals are all covered (or time's up and we know who they are). */
  function answered(reply, show, done, scriptLine) {
    react(CARD.tone === 'silly' && Math.random() < .3 ? 'laugh' : 'nod');
    var left = open(), timeUp = CARD.turns >= CAP && !!CARD.first;
    /* The director says they're hired. The code decides: with the name and the ladder's why in, the
       page agrees (rather than a second "you're hired" two turns later) and lets the rest go. Without
       them, the reply is thrown away and the next question is asked instead. */
    if (!scriptLine && left.length && (done || /you['’]re hired|you are hired/i.test(reply))) {
      if (CARD.first && !digging()) { left.forEach(function (g) { CARD.moved[g.id] = true; }); left = []; save(); }
      else { var n = nextGoal(); reply = ask(n); show = n && n.tablet ? n.id : null; }
    }
    var mid = digging();   // never a tablet test in the middle of the ladder
    /* ...and never a reply that moves on to one either: Sonnet 5 took "cuz i can make whatever is in my
       head" as the why, said so, and went to the jumps, and the page (rightly) left the tablet off, so
       the kid was told to watch two jumps on a blank screen. Keep what it said back to them, then ask
       the rung that's still open. */
    if (!scriptLine && mid && (show || /tablet|jump|try (this|these)|test/i.test(reply))) {
      var kept = (reply.match(/[^.!?]+[.!?]+/g) || []).filter(function (s, i, all) {
        return all.slice(0, i + 1).every(function (x) { return !/\?|tablet|jump|try|test|watch|let['’]s/i.test(x); });
      }).join('').trim();
      reply = (kept ? kept + ' ' : '') + ask(nextGoal()); show = null;
    }
    show =(show && !mid && goal(show) && goal(show).tablet && !covered(goal(show))) ? show : (mid ? null : pickTablet(reply, left));
    if (show) tablet(show);
    else if (CARD.showing && covered(goal(CARD.showing))) tablet(null);
    CARD.asking = asking(nextGoal());
    if (!left.length || timeUp) {
      var hiredSaid = /hired/i.test(reply);
      say(reply, function () { if (hiredSaid) hire(); else setTimeout(function () { say('Well, ' + CARD.first + ', I’ve heard enough. YOU’RE HIRED! Welcome to the studio.', hire); }, 700); });
      return;
    }
    say(reply, focusBox);
  }
  /* The director often SAYS "look at my tablet" and leaves `show` empty, and the kid is left staring
     at a desk with nothing on it (Jay hit this, 2026-09-28; Sonnet 5 still does it about one turn in
     four, answering in plain words). So the page turns the tablet on itself: when the reply talks
     about the tablet (to the moment it names, else the next open one), when it names the very test the
     page has next ("a tiny game engine..."), or when a tablet goal has been next for three turns. */
  function pickTablet(reply, left) {
    var ids = left.filter(function (g) { return g.tablet; }).map(function (g) { return g.id; });
    if (!ids.length) return null;
    var next = nextGoal();
    var named1 = /silent|fix/i.test(reply) ? 'coin' : /engine|press play|play button/i.test(reply) ? 'engine' : /jump/i.test(reply) ? 'jumps'
      : /word/i.test(reply) ? 'words' : /sound|ding|thud/i.test(reply) ? 'sounds' : null;
    if (named1 && next && named1 === next.id) return named1;
    if (/tablet/i.test(reply)) {
      return ids.indexOf(named1) >= 0 ? named1 : (CARD.showing && ids.indexOf(CARD.showing) >= 0 ? CARD.showing : next && next.tablet ? next.id : ids[0]);
    }
    if (next && next.tablet && !CARD.showing && CARD.focus.id === next.id && CARD.focus.turns >= 3) return next.id;
    return null;
  }
  function focusBox() { if (!CARD.showing && !CARD.hired) $('say').focus({ preventScroll: true }); }

  /* ---------- without the AI: the scripted director ----------
     The same goals and the same ladder, in plain lines that still use the kid's words back. A second
     "idk" on a rung gets an easier way in, never the same question twice. */
  function ask(g) {
    if (!g) return 'Well, ' + (CARD.first || 'friend') + ', you’re hired!';
    var tries = function (k) { return CARD.said['try:' + k] || 0; };
    if (g.id === 'name') return 'First things first. What should I call you? Your first name and the first letter of your last name.';
    if (g.id === 'games') {
      var d = dig();
      if (d.need === 'game') return tries('game') ? 'Any game counts, even a phone game. Which one could you play all day?' : 'So what’s a game you really love? Any game at all.';
      if (d.need === 'element') return tries('element') ? 'What do you spend most of your time doing in ' + d.love.game + '?' : 'What’s the best part of ' + d.love.game + ' for you?';
      return tries('why') ? 'What would ' + d.love.game + ' be like without that?' : 'Why that part? What makes it fun for you?';
    }
    if (g.id === 'contrast') { var c = contrasting(); return c ? 'Other games have that too. Why ' + c.game + ', and not another one?' : 'Tell me one more thing you like about it.'; }
    if (g.id === 'notFan') return 'Now the opposite. What’s a game you didn’t like? What bugged you about it?';
    if (g.id === 'wants') return 'If you could make any game at all, what would it be?';
    if (g.id === 'confidence') return 'Be honest. From 1 to 5, how sure are you that you could make a game?';
    if (g.id === 'job') return 'Last question. Of all the jobs at a game studio, which sounds most fun to you?';
    return (g.links && linked([g]) ? g.bridge + ' ' : '') + g.ask;
  }
  var OK = ['Love it. I wrote that down.', 'Ha, noted!', 'Good answer.', 'Ooh, interesting.'];
  function scripted(said, focus, step, tap) {
    var heard = (!tap && focus) ? fallbackParse(focus.id, said, step) : '';
    drawNotes(); save();
    var next = nextGoal();
    var react1 = tap ? tabletLine(tap) : heard || (focus && focus.id === 'name' ? 'Great!' : real(said) ? OK[CARD.turns % OK.length] : 'That’s okay.');
    if (!next || (CARD.turns >= CAP && CARD.first)) { answered(react1 + ' Well, ' + (CARD.first || 'friend') + ', you’re hired!', null, false, true); return; }
    answered(react1 + ' ' + ask(next), next.tablet ? next.id : null, false, true);
  }
  /* Reads an answer for goal `id` (and rung `step`), records what holds up, and returns a short
     reaction that uses their words back, or '' when it heard nothing it could use. */
  function fallbackParse(id, t, step) {
    if (id === 'name') {
      var words = nameWords(t);
      if (!words[0] || NOT_A_NAME.test(words[0]) || words.length > 4) return '';
      CARD.first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase(); CARD.initial = words[1] ? words[1].charAt(0).toUpperCase() : '';
      jot(named()); sendName();
      return 'Nice to meet you, ' + CARD.first + '!';
    }
    var ok = real(t);
    if (id === 'games') {
      step = step || 'game';
      if (!ok) { CARD.said['try:' + step] = (CARD.said['try:' + step] || 0) + 1; return ''; }
      var d = dig();
      if (step === 'game') {
        /* "I'm Maya R", answering "what's a game you love?": an introduction, not a game (the name
           arrived from the account first, so the games goal was the open one). */
        var nw = nameWords(t);
        if (/^\W*(i'?m|im|i am|my name|call me)\b/i.test(t.replace(/^\W*(yes|yeah|hi|hey|hello)\b[\s,!.]*/i, '')) || (CARD.first && nw[0] && nw[0].toLowerCase() === CARD.first.toLowerCase())) return '';
        t.replace(/^(i (mostly |really |probably )?(play|like|love)|mostly|probably|definitely|prob)\s+/i, '').split(/,|\band\b|&|\bor\b/i)
          .map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 6).forEach(addGame);
        var g = dig();   // makes a love of the first game named
        return g && g.love ? g.love.game + '! Good pick.' : '';
      }
      if (!d || !d.love) return '';
      var said1 = t.replace(/^(i think|probably|maybe|um+|well|honestly|like)[, ]+/i, '');
      if (step === 'element') {
        d.love.element = clip(said1.replace(/^(i (really )?(like|love|enjoy)|the best part is|my favou?rite (part|thing) is|it'?s|its|probably)\s+/i, ''), 40);
        jot('loves ' + d.love.element + ' in ' + d.love.game); funFrom(d.love.element);
        return 'Ooh, “' + short(d.love.element) + '”.';
      }
      d.love.why = clip(said1.replace(/^(because|cause|cuz|coz|bc|since)\s+/i, ''), 80);
      jot('because ' + d.love.why); funFrom(d.love.why);
      return 'So it’s “' + short(d.love.why) + '”. Got it.';
    }
    if (!ok) return '';
    CARD.said[id] = t.slice(0, 80);
    if (id === 'contrast') { var c = contrasting(); if (c) { c.over = clip(t, 80); jot('over others: ' + c.over); } return 'That’s a real reason. Noted.'; }
    if (id === 'notFan') { if (CARD.notFan.length < 3) CARD.notFan.push(clip(t, 50)); jot('not a fan: ' + t); return 'Ha, fair.'; }
    if (id === 'wants') { CARD.wants = clip(t.replace(/^(i would make|i'?d make|probably|maybe)\s+/i, ''), 60); jot('wants to make ' + CARD.wants); return 'Ooh, I’d play that.'; }
    if (id === 'confidence') {
      var n = t.match(/[1-5]/); CARD.confidence = n ? +n[0] : /not|no\b|nope|idk|dunno/i.test(t) ? 2 : /very|totally|yes|def/i.test(t) ? 4 : 3;
      CARD.snapshot.confidence = CARD.snapshot.confidence || CARD.confidence;
      jot('feels ready: ' + CARD.confidence + ' of 5');
      return CARD.confidence >= 4 ? 'Love the confidence.' : 'Honest answer. That’s what this place is for.';
    }
    if (id === 'job') {
      CARD.job = /art|draw|paint/i.test(t) ? 'art' : /sound|music|audio/i.test(t) ? 'audio' : /level|design/i.test(t) ? 'design'
        : /code|program|work|engineer|build/i.test(t) ? 'engineering' : /all|every/i.test(t) ? 'everything' : null;
      jot(CARD.job ? 'job: ' + JOB[CARD.job] : 'job: not sure yet');
      return CARD.job ? 'Good choice.' : 'Not sure yet? That’s fine.';
    }
    return '';
  }
  /* The kinds of fun, heard in what they say (never asked as a list). The first seven are the second
     build's; the rest are §5's element taxonomy. ai/routes/ai.js keeps the same list. */
  var FUN = { explore: /explor|wander|look around|secret|discover|open world|map/i, challenge: /fight|smash|battle|boss|race|win\b|hard|combat|pvp|compet/i,
              clever: /figur|puzzl|sneak|trick|think|solve|strateg/i, social: /friend|together|team|sister|brother|cousin|with my|co-?op|trade|trading/i,
              make: /build|make|creat|design|castle|craft|mod/i, story: /story|lore|quest|plot/i, collect: /collect|catch|pok[eé]mon|loot|rare/i,
              feel: /feel|control|click|smooth|fast|movement|jump|parkour/i, progress: /grind|level|xp|stronger|upgrade|progress|unlock|skill/i,
              characters: /character|hero|villain|npc/i, funny: /funny|laugh|chaos|silly|random|troll|glitch/i, cozy: /cozy|calm|relax|chill|peaceful|farm/i };
  var JOB = { art: 'the art', audio: 'the sounds', design: 'the levels', engineering: 'making it work', everything: 'everything' };
  function tabletLine(id) {
    if (id === 'jumps') return CARD.feelJump === 'floaty' ? 'The floaty one! Like being on the moon.' : 'The snappy one! Quick and sharp.';
    if (id === 'sounds') return CARD.feelSound === 'ding' ? 'The ding! Bright and happy.' : 'The thud! You like things to feel heavy.';
    if (id === 'engine') return 'Good guesses. You’ll know for sure in a week or two.';
    if (id === 'words') return CARD.snapshot.decoyTicked ? 'Ha, flarnish! I made that one up.' : 'Nice. You’ll know all of these soon.';
    if (id === 'coin') return 'You’re a natural. That’s the sound designer’s job.';
    return OK[0];
  }

  /* ---------- the tablet's try-this moments ---------- */
  function screen(html) { var off = html == null; $('tablet').classList.toggle('off', off); var sc = $('screen'); sc.innerHTML = off ? '' : html; return sc; }
  /* A tap: echoed as what they did, recorded exactly, then told to the director as a turn. */
  var TAP_NOTE = { jumps: function () { return 'likes ' + CARD.feelJump + ' jumps'; }, sounds: function () { return 'coin sound: ' + CARD.feelSound; },
    engine: function () { return 'guessed the engine'; }, words: function () { return CARD.snapshot.wordsHeard.length ? 'knows: ' + CARD.snapshot.wordsHeard.slice(0, 3).join(', ') : 'new to the words'; },
    coin: function () { return 'fixed a coin!'; } };
  function tapped(id, shown, said) {
    if (busy) return false;
    jot(TAP_NOTE[id]());
    echo(shown);
    tablet(null);
    UI.feel($('tablet'), 'good');
    turn('[tablet] ' + said, id);
    return true;
  }
  function tablet(id) {
    jumpsOn = false;
    CARD.showing = id; save();
    if (!id) { screen(null); return; }
    ({ jumps: jumps, sounds: sounds, engine: engine, words: words, coin: coin })[id]();
  }

  /* The two jumps, drawn in the studio's own colours: a navy sky, a blue-grey ground, the green hero. */
  var jumpsOn = false;
  function startJumps() {
    jumpsOn = true; var t = 0;
    var one = function (id, g, v) { var c = $(id); if (!c) return; var x = c.getContext('2d'), p = (t % 150), vy = v, yy = 0;
      for (var k = 0; k < p; k++) { vy -= g; yy += vy; if (yy < 0) { yy = 0; vy = 0; } }
      x.fillStyle = '#1c3c63'; x.fillRect(0, 0, 160, 110); x.fillStyle = '#3d6a9e'; x.fillRect(0, 92, 160, 18);
      x.fillStyle = '#5fd06a'; x.fillRect(72, 78 - Math.min(76, yy), 16, 14); x.fillStyle = '#0a1728'; x.fillRect(75, 82 - Math.min(76, yy), 3, 3); x.fillRect(82, 82 - Math.min(76, yy), 3, 3); };
    var step = function () { if (!jumpsOn) return; t++; one('jA', 0.035, 1.9); one('jB', 0.32, 5.4); requestAnimationFrame(step); };
    step();
  }
  function jumps() {
    var sc = screen('<h2>Which jump feels better?</h2><div class="pair">'
      + '<button type="button" class="pick" data-v="floaty"><canvas id="jA" width="160" height="110" aria-hidden="true"></canvas><b>Jump A</b><small>floats up slowly</small></button>'
      + '<button type="button" class="pick" data-v="snappy"><canvas id="jB" width="160" height="110" aria-hidden="true"></canvas><b>Jump B</b><small>snaps up fast</small></button></div>'
      + '<p class="note">Tap the one you like.</p>');
    startJumps();
    Array.prototype.forEach.call(sc.querySelectorAll('.pick'), function (b) { b.addEventListener('click', function () {
      var v = b.dataset.v, name = v === 'floaty' ? 'Jump A' : 'Jump B';
      if (busy) return;
      CARD.feelJump = v; CARD.snapshot.jumpPick = v;
      tapped('jumps', '(picked ' + name + ')', 'I picked ' + name + ', the ' + (v === 'floaty' ? 'floaty one that drifts down slowly.' : 'snappy one that goes up fast and lands hard.'));
    }); });
  }

  var SFX = { ding: '/assets/platformer/sfx_coin.ogg', thud: '/assets/platformer/sfx_bump.ogg', boing: '/assets/platformer/sfx_jump.ogg' };
  function play(id) { if (UI.muted()) return; try { var a = new Audio(SFX[id]); a.volume = .55; a.play().catch(function () {}); } catch (e) {} }
  function sounds() {
    var sc = screen('<h2>Which coin sound?</h2><div class="pair">'
      + '<div class="opt"><button type="button" class="tile" data-play="ding"><svg class="i" aria-hidden="true"><use href="#i-sound"/></svg>Hear A</button><button type="button" class="tile pickit" data-v="ding">Pick A</button></div>'
      + '<div class="opt"><button type="button" class="tile" data-play="thud"><svg class="i" aria-hidden="true"><use href="#i-sound"/></svg>Hear B</button><button type="button" class="tile pickit" data-v="thud">Pick B</button></div></div>'
      + '<p class="note">Sound off? A is a “ding”, B is a “thud”.</p>');
    Array.prototype.forEach.call(sc.querySelectorAll('[data-play]'), function (b) { b.addEventListener('click', function () { play(b.dataset.play); }); });
    Array.prototype.forEach.call(sc.querySelectorAll('.pickit'), function (b) { b.addEventListener('click', function () {
      if (busy) return;
      var v = b.dataset.v; CARD.feelSound = v;
      tapped('sounds', '(picked Sound ' + (v === 'ding' ? 'A' : 'B') + ')', 'I picked Sound ' + (v === 'ding' ? 'A, the bright ding.' : 'B, the dull thud.'));
    }); });
  }

  var AREA = { top: 'the bar across the top', left: 'the list on the left', mid: 'the picture in the middle', right: 'the panel on the right' };
  function engine() {
    var first = !CARD.snapshot.playTap;
    var sc = screen('<h2>' + (first ? 'Where would you press Play?' : 'Where would you change how high the hero jumps?') + '</h2>'
      + '<div class="mini" id="mini"><button type="button" class="mtop" data-a="top" aria-label="' + AREA.top + '"><i></i></button>'
      + '<button type="button" class="mside" data-a="left" aria-label="' + AREA.left + '"></button><button type="button" class="mscene" data-a="mid" aria-label="' + AREA.mid + '"></button>'
      + '<button type="button" class="minsp" data-a="right" aria-label="' + AREA.right + '"></button></div><p class="note">Just guess!</p>');
    var m = sc.querySelector('#mini'), took = false;
    Array.prototype.forEach.call(m.children, function (b) { b.addEventListener('click', function (e) {
      if (took || busy) return; took = true;
      var r = m.getBoundingClientRect(), br = b.getBoundingClientRect(), a = b.dataset.a;
      var mk = document.createElement('span'); mk.className = 'mark';
      mk.style.left = ((e.clientX || br.left + br.width / 2) - r.left) + 'px'; mk.style.top = ((e.clientY || br.top + br.height / 2) - r.top) + 'px'; m.appendChild(mk);
      react('scribble');
      setTimeout(function () {
        if (first) { CARD.snapshot.playTap = a; save(); engine(); return; }   // the second guess, then one turn for both
        CARD.snapshot.jumpTap = a;
        tapped('engine', '(tapped two places)', 'For Play I tapped ' + AREA[CARD.snapshot.playTap] + '. For how high the hero jumps I tapped ' + AREA[a] + '.');
      }, 450);
    }); });
  }

  function words() {
    var W = ['sprite', 'collider', 'prefab', 'frame', 'flarnish', 'Inspector'], on = {};
    var sc = screen('<h2>Heard of any of these?</h2><div class="tiles">' + W.map(function (w) { return '<button type="button" class="tile" aria-pressed="false">' + w + '</button>'; }).join('') + '</div>'
      + '<button type="button" class="tile done" id="wDone">Done</button>');
    Array.prototype.forEach.call(sc.querySelectorAll('.tiles .tile'), function (b) { b.addEventListener('click', function () {
      var v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); on[b.textContent] = v; }); });
    sc.querySelector('#wDone').addEventListener('click', function () {
      if (busy) return;
      var got = Object.keys(on).filter(function (k) { return on[k]; });
      CARD.snapshot.decoyTicked = got.indexOf('flarnish') >= 0; CARD.snapshot.wordsHeard = got.filter(function (w) { return w !== 'flarnish'; });
      tapped('words', got.length ? '(heard of: ' + got.join(', ') + ')' : '(heard of none)', got.length ? 'I have heard of: ' + got.join(', ') + '.' : 'I haven’t heard of any of them.');
    });
  }

  function coin() {
    var sc = screen('<h2>Coin: when grabbed</h2><div class="tiles"><button type="button" class="tile" data-s="ding">Sparkly ding</button><button type="button" class="tile" data-s="boing">Springy boing</button><button type="button" class="tile" data-s="thud">Dull thud</button></div>'
      + '<p class="note">Tap one to give the coin its sound.</p>');
    Array.prototype.forEach.call(sc.querySelectorAll('[data-s]'), function (b) { b.addEventListener('click', function () {
      if (busy) return;
      play(b.dataset.s); UI.sound('good');
      CARD.coinFixed = b.dataset.s;
      tapped('coin', '(gave the coin a ' + b.textContent.toLowerCase() + ')', 'I fixed the coin. I gave it the ' + b.textContent.toLowerCase() + ' sound.');
    }); });
  }

  /* ---------- hired ---------- */
  var COLOURS = [['Red', '#e0474c'], ['Blue', '#3f7fe0'], ['Green', '#2f9e5b'], ['Purple', '#8a5cd6']];
  var ICONS = ['rocket', 'cat', 'bolt', 'ghost'];
  function badgeHtml() {
    var c = CARD.badge.colour;
    return '<div class="badge"><div class="band" style="background:' + c + '">THE LEAGUE GAME STUDIO</div><div class="body"><div class="pic" style="background:' + c + '"><svg class="i"><use href="#p-' + CARD.badge.icon + '"/></svg></div>'
      + '<div><strong>' + esc(named()) + '</strong><small>Game developer · new hire</small></div></div></div>';
  }
  function drawBadge() {
    var sc = screen(badgeHtml() + '<div class="swatches">' + COLOURS.map(function (c) { return '<button type="button" class="tile" data-c="' + c[1] + '" aria-pressed="' + (CARD.badge.colour === c[1]) + '"><i style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('') + '</div>'
      + '<div class="swatches">' + ICONS.map(function (ic) { return '<button type="button" class="tile" data-i="' + ic + '" aria-pressed="' + (CARD.badge.icon === ic) + '" aria-label="' + ic + '"><svg class="i"><use href="#p-' + ic + '"/></svg></button>'; }).join('') + '</div>');
    Array.prototype.forEach.call(sc.querySelectorAll('[data-c],[data-i]'), function (b) { b.addEventListener('click', function () {
      if (b.dataset.c) CARD.badge.colour = b.dataset.c; if (b.dataset.i) CARD.badge.icon = b.dataset.i; save(); drawBadge(); sendBadge(); $('badgeOut').innerHTML = '<div class="badge-out">' + badgeHtml() + '</div>'; }); });
  }
  function hire() {
    if (!CARD.first) { say(ask(goal('name')), focusBox); return; }   // never hired without a name; the next turn asks for it
    fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: CARD.first, initial: CARD.initial, badge: CARD.badge, hired: true }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        CARD.hired = true; CARD.showing = null; CARD.asking = 'hired'; save();
        hiredScene(true);
      })
      .catch(function () { say('Hmm, I couldn’t reach the office to print your badge. Say anything to try again.', focusBox); });
  }
  /* The badge is on their class-list card too, so a change after they're hired goes to the roster. */
  var badgeTimer = null;
  function sendBadge() {
    if (!CARD.hired) return;
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(function () { fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badge: CARD.badge }) }).catch(function () {}); }, 400);
  }
  function hiredScene(fresh) {
    $('scene').classList.add('iv-stand');
    $('badgeOut').innerHTML = '<div class="badge-out">' + badgeHtml() + '</div>';
    drawBadge();
    if (fresh) UI.sound('hired');
    $('sayForm').hidden = true; showMode();
    var go = $('desk'); go.hidden = false; go.focus({ preventScroll: true });
    if (!fresh) { $('words').textContent = 'Welcome to the studio, ' + CARD.first + '! Pick your badge colour on my tablet, then head to your desk.'; }
  }
  $('desk').addEventListener('click', function () { CARD.done = true; save(); location.href = '/'; });

  /* ---------- start: only for a signed-in new hire, and only with their own card ---------- */
  load();
  lock(true);
  fetch('/auth/studio/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    if (!m.studio) { location.replace('/login.html'); return; }
    var who = (m.card && m.card.id) || null;
    if (CARD.who !== who) { CARD = fresh(); CARD.who = who; save(); }   // someone else's interview, on a shared Chromebook
    if (m.interviewed && !CARD.hired) { location.replace('/'); return; }
    if (m.card && m.card.first && !CARD.first) { CARD.first = m.card.first; CARD.initial = m.card.initial || ''; }
    drawNotes(); showMode();
    busy = false; lock(false);
    if (CARD.hired) { hiredScene(false); return; }
    var last = CARD.log.filter(function (x) { return x.role === 'assistant'; }).pop();
    if (last) {   // back after a reload: where we were
      $('words').textContent = last.content;
      if (CARD.showing) tablet(CARD.showing);
      focusBox();
      return;
    }
    react('lean');
    say('Come in, come in! I’m the Studio Director, the studio’s AI. You’re here about the game developer job?', focusBox);
  }).catch(function () { say('I can’t reach the office right now. Reload the page to try again.', function () { busy = true; lock(true); }); });
})();
