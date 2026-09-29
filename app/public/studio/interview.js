/* interview.js: the hiring interview (interview.html). docs/rework/v2-spec.md §3.2.

   A CONVERSATION, NOT A SURVEY (Jay, 2026-09-28). The first build asked wireframe 07's beats in a
   fixed order with a card of answers under each, and it read as a form to fill in. Now the studio
   director is the interviewer agent (ai/agents/interviewer.md): it asks one open question at a time,
   reacts, asks follow-ups, and digs for more. There are no premade answers; typing is the way in.

   The AI leads, the code keeps the goals. Every turn the browser tells the director what it knows,
   which goals are still open and a good next one, and the director says what it learned as JSON.
   The code decides what counts and when a kid is hired, so a model that wanders, forgets or makes
   something up can't skip the name or hire a kid who never gave one. The goals:
     name        first name and last initial (Jed approved it, 2026-09-28; no handles, Jay). Must
                 appear in something the kid typed, so a model can't invent one.
     games       what they play, and what they like about it
     fun         the kinds of fun they like, heard from their answers, never asked as a list
     confidence  1 to 5, how sure they are that they could make a game (growth snapshot)
     job         which studio job sounds most fun
   and the tablet's try-this moments, which the director turns on with `show`, and which record the
   kid's tap exactly (the growth snapshot is made of these):
     jumps  sounds  engine  words (one is made up: flarnish)  coin (their first fix)
   A goal the conversation keeps missing is let go after a few turns, and the whole thing is capped,
   so a chatty kid is still at their desk in time. If the AI can't be reached, the director falls
   back to a plain scripted question for the next open goal, and the interview still finishes.

   The learner card lives in localStorage (studio.interview) and goes to the server with the saves
   (save.js); the name also goes on the kid's roster card (/auth/studio/profile). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'studio.interview';
  var CAP = 30;        // kid turns, then the studio hires them with what it has
  var LET_GO = 6;      // turns a goal may sit as "next" before the interview moves past it
  var CARD = null, busy = false;

  function fresh() {
    return { v: 2, tone: null, first: '', initial: '', games: [], fun: [], notes: [], feelJump: null, feelSound: null,
             job: null, confidence: null, coinFixed: null, said: {}, moved: {},
             badge: { colour: '#e0474c', icon: 'rocket' },
             snapshot: { jumpPick: null, playTap: null, jumpTap: null, wordsHeard: null, decoyTicked: false, confidence: null },
             typedSomething: false, turns: 0, focus: { id: null, turns: 0 }, log: [], showing: null, hired: false, done: false };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(CARD)); } catch (e) {} }
  function load() {
    try { CARD = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { CARD = null; }
    if (!CARD || CARD.v !== 2 || CARD.done) CARD = fresh();   // v1 was the scripted interview's card
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function named() { return CARD.first + (CARD.initial ? ' ' + CARD.initial + '.' : ''); }

  /* ---------- the goals ---------- */
  var GOALS = [
    { id: 'name', done: function (c) { return !!c.first; },
      ask: 'First things first. What should I call you? Your first name and the first letter of your last name.' },
    { id: 'games', done: function (c) { return c.games.length > 0 || !!c.said.games; },
      ask: 'So what games do you play? Tell me about one you love.' },
    { id: 'jumps', tablet: true, done: function (c) { return !!c.feelJump; },
      ask: 'Try something for me. There are two jumps on my tablet. Which one feels better?' },
    { id: 'fun', done: function (c) { return c.fun.length > 0 || !!c.said.fun; },
      ask: 'Picture this: you’re in a game and you find a locked door. What do you do?' },
    { id: 'sounds', tablet: true, done: function (c) { return !!c.feelSound; },
      ask: 'Now sounds. You grab a coin. Tap both sounds on my tablet. Which one fits?' },
    { id: 'engine', tablet: true, done: function (c) { return !!c.snapshot.jumpTap; },
      ask: 'Here’s a tiny game engine on my tablet. Just guess, there’s no wrong answer.' },
    { id: 'words', tablet: true, done: function (c) { return c.snapshot.wordsHeard !== null; },
      ask: 'Which of these words have you heard before? Tap any on my tablet.' },
    { id: 'coin', tablet: true, done: function (c) { return !!c.coinFixed; },
      ask: 'Last test! This coin should make a sound, but it’s silent. Pick it one on my tablet.' },
    { id: 'confidence', done: function (c) { return !!c.confidence || !!c.said.confidence; },
      ask: 'Be honest. From 1 to 5, how sure are you that you could make a game?' },
    { id: 'job', done: function (c) { return !!c.job || !!c.said.job; },
      ask: 'Last question. Of all the jobs at a game studio, which sounds most fun to you?' }
  ];
  function goal(id) { return GOALS.filter(function (g) { return g.id === id; })[0]; }
  function covered(g) { return g.done(CARD) || (g.id !== 'name' && !!CARD.moved[g.id]); }
  function open() { return GOALS.filter(function (g) { return !covered(g); }); }

  /* After each kid turn: the goal that's been "next" too long is let go (never the name). */
  function tick() {
    CARD.turns++;
    var g = open()[0];
    if (!g) return;
    if (CARD.focus.id === g.id) CARD.focus.turns++; else CARD.focus = { id: g.id, turns: 1 };
    if (g.id !== 'name' && CARD.focus.turns > LET_GO && (!g.tablet || CARD.showing === g.id)) { CARD.moved[g.id] = true; CARD.focus = { id: null, turns: 0 }; }
  }

  /* ---------- the director ---------- */
  function react(kind) {
    var s = $('scene'), cls = 'iv-' + kind;
    s.classList.remove('iv-lean', 'iv-laugh', 'iv-scribble', 'iv-nod'); void s.offsetWidth; s.classList.add(cls);
    if (kind !== 'lean') setTimeout(function () { s.classList.remove(cls); }, 1400);
  }
  function jot(word) {
    if (!word) return;
    react('scribble');
    CARD.notes.push(word); if (CARD.notes.length > 7) CARD.notes.shift();
    drawNotes();
  }
  function drawNotes() {
    var ul = $('notes'); ul.innerHTML = '';
    var name = CARD.first ? named() : '', rest = CARD.notes.filter(function (n) { return n !== name; }).slice(-6);
    if (!name && !rest.length) { ul.innerHTML = '<li class="empty">(nothing yet)</li>'; return; }
    (name ? [name] : []).concat(rest).forEach(function (n, k) { var li = document.createElement('li'); li.textContent = n; if (name && !k) li.className = 'name'; ul.appendChild(li); });   // their name stays at the top
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

  /* ---------- a turn ---------- */
  $('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('say'), text = input.value.trim().slice(0, 200);
    if (!text || busy || CARD.hired) return;
    input.value = '';
    CARD.typedSomething = true;
    echo(text);
    turn(text);
  });
  /* One kid turn: `said` is what goes to the director, `tap` the tablet goal it came from (if any). */
  function turn(said, tap) {
    var focus = open()[0];
    remember('user', said); tick(); save();
    thinking();
    var body = { agent: 'interviewer', message: said, history: CARD.log.slice(0, -1),
      where: 'The hiring interview: their very first minutes at the studio, before they have seen the game engine.', studio: context() };
    fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.reply || !res.j.learned) return scripted(said, focus, tap);
        learn(res.j.learned, said);
        if (!tap) net(focus, said, res.j.reply);
        answered(res.j.reply, res.j.show, res.j.done);
      })
      .catch(function () { scripted(said, focus, tap); });
  }

  /* What the director is told each turn. Plain words: it's read by a model, and by whoever debugs it. */
  function context() {
    var known = [];
    if (CARD.first) known.push('name: ' + named());
    if (CARD.games.length) known.push('games: ' + CARD.games.join(', '));
    if (CARD.fun.length) known.push('fun: ' + CARD.fun.join(', '));
    if (CARD.feelJump) known.push('jump they liked: ' + CARD.feelJump);
    if (CARD.feelSound) known.push('coin sound they liked: ' + CARD.feelSound);
    if (CARD.snapshot.playTap) known.push('engine guesses: Play at "' + AREA[CARD.snapshot.playTap] + '"' + (CARD.snapshot.jumpTap ? ', jump height at "' + AREA[CARD.snapshot.jumpTap] + '"' : ''));
    if (CARD.snapshot.wordsHeard) known.push('words heard of: ' + (CARD.snapshot.wordsHeard.join(', ') || 'none') + (CARD.snapshot.decoyTicked ? ' (and the made-up one, flarnish)' : ''));
    if (CARD.coinFixed) known.push('fixed the coin with: ' + CARD.coinFixed);
    if (CARD.confidence) known.push('confidence: ' + CARD.confidence + ' of 5');
    if (CARD.job) known.push('job: ' + CARD.job);
    if (CARD.notes.length) known.push('your clipboard: ' + CARD.notes.join('; '));
    var left = open(), next = left[0];
    var lines = ['Known so far: ' + (known.join(' | ') || 'nothing yet') + '.'];
    if (!left.length) lines.push('EVERY GOAL IS COVERED. Wrap up in one or two warm sentences, tell them they\'re hired, and set done to true.');
    else {
      lines.push('Still open: ' + left.map(function (g) { return g.id + (g.tablet ? ' (tablet)' : ''); }).join(', ') + '.');
      lines.push('Good next step: ' + next.id + (next.tablet ? ' (set show to "' + next.id + '")' : '') + '.'
        + (CARD.focus.id === next.id && CARD.focus.turns >= 3 ? ' It has been next for ' + CARD.focus.turns + ' turns: finish the follow-up and move to it now.' : ''));
    }
    lines.push('Tablet: ' + (CARD.showing ? 'showing "' + CARD.showing + '", waiting for their tap' : 'off') + '.');
    lines.push('Kid turns so far: ' + CARD.turns + ' of about ' + CAP + '.' + (CARD.turns > CAP - 6 && left.length ? ' Time is nearly up: keep it quick.' : ''));
    if (CARD.tone) lines.push('They come across as: ' + CARD.tone + '.');
    return lines.join('\n');
  }

  /* Take what the director says it learned, but only what holds up. */
  function learn(l, said) {
    var kidSaid = CARD.log.filter(function (m) { return m.role === 'user'; }).map(function (m) { return m.content; }).join(' ').toLowerCase();
    if (l.first && !CARD.first && kidSaid.indexOf(l.first.toLowerCase()) >= 0) {
      CARD.first = l.first.charAt(0).toUpperCase() + l.first.slice(1).toLowerCase();
      if (l.initial) CARD.initial = l.initial;
      jot(named()); sendName();
    } else if (l.initial && CARD.first && !CARD.initial) { CARD.initial = l.initial; sendName(); }
    if (l.games) { var had = CARD.games.length; l.games.forEach(function (g) { if (CARD.games.indexOf(g) < 0 && CARD.games.length < 8) CARD.games.push(g); }); if (CARD.games.length > had) jot('plays ' + CARD.games.slice(0, 2).join(', ')); }
    if (l.fun) l.fun.forEach(function (f) { if (CARD.fun.indexOf(f) < 0) { CARD.fun.push(f); if (FUN[f]) jot(FUN[f][1]); } });
    if (l.confidence && !CARD.confidence) jot('sure: ' + l.confidence + ' of 5');
    if (l.job && !CARD.job) jot('wants: ' + JOB[l.job]);
    if (l.jump && !CARD.feelJump) { CARD.feelJump = l.jump; if (!CARD.snapshot.jumpPick) CARD.snapshot.jumpPick = l.jump; }
    if (l.sound && !CARD.feelSound) CARD.feelSound = l.sound;
    if (l.confidence) { CARD.confidence = l.confidence; if (!CARD.snapshot.confidence) CARD.snapshot.confidence = l.confidence; }
    if (l.job) CARD.job = l.job;
    if (l.tone && !CARD.tone) CARD.tone = l.tone;
    if (l.note && CARD.notes.indexOf(l.note) < 0) jot(l.note);
    save();
  }
  /* The safety net. A small model often understands an answer and still leaves `learned` empty
     ("Nice to meet you, Maya R!", learned: {}), and then asks for the name forever. So when the goal
     the kid was just asked is still open, the browser reads the answer itself, but only takes what
     holds up: a name counts when the kid typed it AND the director then called them by it; a number
     from 1 to 5 for confidence; a job's keyword; for games and fun, a real answer (kept as said). */
  var NOT_A_NAME = /^(yes|yeah|yep|no|nope|ok|okay|sure|cool|hi|hello|hey|idk|um|uh|what|why|i|im|my|the|a|maybe|lol|nothing|dunno)$/i;
  function net(focus, said, reply) {
    if (!CARD.first) {
      var w = said.replace(/^(my name is|my name's|i am|i'm|im|call me|it's|its)\s+/i, '').match(/[\p{L}'’-]+/gu) || [];
      if (w.length && w.length <= 3 && !NOT_A_NAME.test(w[0]) && (' ' + reply.toLowerCase().replace(/[^\p{L}'’-]+/gu, ' ') + ' ').indexOf(' ' + w[0].toLowerCase() + ' ') >= 0) {
        CARD.first = w[0].charAt(0).toUpperCase() + w[0].slice(1).toLowerCase(); CARD.initial = w[1] ? w[1].charAt(0).toUpperCase() : '';
        jot(named()); sendName();
      }
    }
    if (!focus || covered(focus)) return;
    if (focus.id === 'confidence' && /\b[1-5]\b/.test(said)) fallbackParse('confidence', said);
    if (focus.id === 'job' && /art|draw|sound|music|audio|level|design|code|program|engineer|all|every/i.test(said)) fallbackParse('job', said);
    if ((focus.id === 'games' || focus.id === 'fun') && said.length > 3 && !NOT_A_NAME.test(said.trim())) fallbackParse(focus.id, said);
    save();
  }
  function sendName() {
    fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: CARD.first, initial: CARD.initial }) }).catch(function () {});
  }

  /* The director's reply has landed: say it, turn the tablet to what it asked for, and hire if the
     goals are all covered (or time's up and we know who they are). */
  function answered(reply, show, done) {
    react(CARD.tone === 'silly' && Math.random() < .3 ? 'laugh' : 'nod');
    var left = open(), timeUp = CARD.turns >= CAP && !!CARD.first;
    /* The director has hired them (it judged it had enough). The name is the one thing the studio
       can't do without; with it, the page agrees, rather than a second "you're hired" two turns later. */
    if (CARD.first && left.length && (done || /you['’]re hired|you are hired/i.test(reply))) { left.forEach(function (g) { CARD.moved[g.id] = true; }); left = []; save(); }
    show = (show && goal(show) && !covered(goal(show))) ? show : pickTablet(reply, left);
    if (show) tablet(show);
    else if (CARD.showing && covered(goal(CARD.showing))) tablet(null);
    if (!left.length || timeUp) {
      var hiredSaid = /hired/i.test(reply);
      say(reply, function () { if (hiredSaid) hire(); else setTimeout(function () { say('Well, ' + CARD.first + ', I’ve heard enough. YOU’RE HIRED! Welcome to the studio.', hire); }, 700); });
      return;
    }
    say(reply, focusBox);
  }
  /* The director often SAYS "look at my tablet" and leaves `show` empty, and the kid is left staring
     at a desk with nothing on it (Jay hit this, 2026-09-28). So the page turns the tablet on itself:
     when the reply talks about the tablet (to the moment it names, else the next open one), or when a
     tablet goal has been next for three turns. */
  function pickTablet(reply, left) {
    var ids = left.filter(function (g) { return g.tablet; }).map(function (g) { return g.id; });
    if (!ids.length) return null;
    if (/tablet/i.test(reply)) {
      var named1 = /silent|fix/i.test(reply) ? 'coin' : /engine|press play|play button/i.test(reply) ? 'engine' : /jump/i.test(reply) ? 'jumps'
        : /word/i.test(reply) ? 'words' : /sound|ding|thud/i.test(reply) ? 'sounds' : null;
      return ids.indexOf(named1) >= 0 ? named1 : (CARD.showing && ids.indexOf(CARD.showing) >= 0 ? CARD.showing : ids[0]);
    }
    var next = left[0];
    if (next && next.tablet && !CARD.showing && CARD.focus.id === next.id && CARD.focus.turns >= 3) return next.id;
    return null;
  }
  function focusBox() { if (!CARD.showing && !CARD.hired) $('say').focus({ preventScroll: true }); }

  /* ---------- without the AI: a plain question for the next open goal ---------- */
  var OK = ['Love it. I wrote that down.', 'Ha, noted!', 'Good answer.', 'Ooh, interesting.'];
  function scripted(said, focus, tap) {
    if (!tap && focus) fallbackParse(focus.id, said);
    save();
    var next = open()[0];
    var react1 = tap ? tabletLine(tap) : OK[CARD.turns % OK.length];
    if (!next || (CARD.turns >= CAP && CARD.first)) { answered(react1 + ' Well, ' + (CARD.first || 'friend') + ', you’re hired!', null); return; }
    answered(react1 + ' ' + next.ask, next.tablet ? next.id : null);
  }
  function fallbackParse(id, t) {
    if (id === 'name') {
      var words = t.replace(/^(hi|hey|hello)[,! ]*/i, '').replace(/^(my name is|my name's|i am|i'm|im|call me|it's|its)\s+/i, '').match(/[\p{L}'’-]+/gu) || [];
      if (words[0]) { CARD.first = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase(); CARD.initial = words[1] ? words[1].charAt(0).toUpperCase() : ''; jot(named()); sendName(); }
      return;
    }
    CARD.said[id] = t.slice(0, 80);
    if (id === 'games') {
      t.replace(/^(i (mostly |really )?(play|like|love)|mostly|probably)\s+/i, '').split(/,|\band\b|&/i).map(function (s) { return s.trim().slice(0, 30); })
        .filter(Boolean).slice(0, 6).forEach(function (g) { if (CARD.games.indexOf(g) < 0) CARD.games.push(g); });
      if (CARD.games.length) jot('plays ' + CARD.games.slice(0, 2).join(', '));
      return;
    }
    if (id === 'fun') {
      Object.keys(FUN).forEach(function (f) { if (FUN[f][0].test(t) && CARD.fun.indexOf(f) < 0) { CARD.fun.push(f); jot(FUN[f][1]); } });
      return;
    }
    if (id === 'confidence') { var d = t.match(/[1-5]/); CARD.confidence = d ? +d[0] : /not|no\b|nope|idk|dunno/i.test(t) ? 2 : /very|totally|yes|def/i.test(t) ? 4 : 3; CARD.snapshot.confidence = CARD.snapshot.confidence || CARD.confidence; }
    if (id === 'job') CARD.job = /art|draw|paint/i.test(t) ? 'art' : /sound|music|audio/i.test(t) ? 'audio' : /level|design/i.test(t) ? 'design'
      : /code|program|work|engineer|build/i.test(t) ? 'engineering' : /all|every/i.test(t) ? 'everything' : null;
    if (id === 'confidence') jot('sure: ' + CARD.confidence + ' of 5');
    if (id === 'job') jot(CARD.job ? 'wants: ' + JOB[CARD.job] : 'job: not sure yet');
  }
  /* The notes the page writes itself: short, in the director's clipboard voice. */
  var FUN = { explore: [/explor|wander|look around|secret|discover/i, 'explorer'], challenge: [/fight|smash|battle|boss|race|win\b|hard/i, 'likes a challenge'],
              clever: [/figur|puzzl|sneak|trick|think|solve/i, 'puzzler'], social: [/friend|together|team|sister|brother|cousin|with my/i, 'team player'],
              make: [/build|make|creat|design|castle|craft/i, 'maker'], story: [/story|character|lore/i, 'story lover'], collect: [/collect|catch|pok[eé]mon/i, 'collector'] };
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

  var jumpsOn = false;
  function startJumps() {
    jumpsOn = true; var t = 0;
    var one = function (id, g, v) { var c = $(id); if (!c) return; var x = c.getContext('2d'), p = (t % 150), vy = v, yy = 0;
      for (var k = 0; k < p; k++) { vy -= g; yy += vy; if (yy < 0) { yy = 0; vy = 0; } }
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 160, 110); x.fillStyle = '#6e6e6e'; x.fillRect(0, 92, 160, 18);
      x.fillStyle = '#5fd06a'; x.fillRect(72, 78 - Math.min(76, yy), 16, 14); x.fillStyle = '#1d2230'; x.fillRect(75, 82 - Math.min(76, yy), 3, 3); x.fillRect(82, 82 - Math.min(76, yy), 3, 3); };
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
    if (!CARD.first) { say(GOALS[0].ask, focusBox); return; }   // never hired without a name; the next turn asks for it
    fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first: CARD.first, initial: CARD.initial, badge: CARD.badge, hired: true }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        CARD.hired = true; CARD.showing = null; save();
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
    $('sayForm').hidden = true;
    var go = $('desk'); go.hidden = false; go.focus({ preventScroll: true });
    if (!fresh) { $('words').textContent = 'Welcome to the studio, ' + CARD.first + '! Pick your badge colour on my tablet, then head to your desk.'; }
  }
  $('desk').addEventListener('click', function () { CARD.done = true; save(); location.href = '/'; });

  /* ---------- start: only for a signed-in new hire ---------- */
  load();
  drawNotes();
  fetch('/auth/studio/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    if (!m.studio) { location.replace('/login.html'); return; }
    if (m.interviewed && !CARD.hired) { location.replace('/'); return; }
    if (m.card && m.card.first && !CARD.first) { CARD.first = m.card.first; CARD.initial = m.card.initial || ''; }
    if (CARD.hired) { hiredScene(false); return; }
    var last = CARD.log.filter(function (x) { return x.role === 'assistant'; }).pop();
    if (last) {   // back after a reload: where we were
      $('words').textContent = last.content;
      if (CARD.showing) tablet(CARD.showing);
      focusBox();
      return;
    }
    react('lean');
    say('Come in, come in! Sit down. So, you’re here about the game developer job?', focusBox);
  }).catch(function () { say('I can’t reach the office right now. Reload the page to try again.'); });
})();
