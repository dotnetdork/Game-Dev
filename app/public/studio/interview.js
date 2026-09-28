/* interview.js: the hiring interview (interview.html). docs/rework/v2-spec.md §3.2.

   Wireframe 07's beats, in the real app, as a chat:
     meet      "You're here about the job?"                 tone (keen / curious / silly)
     name      first name and last initial                   shown only to the teacher and on the class
                                                             list (Jed approved it, 2026-09-28)
     games     which games they've played                    examples later, and the handle
     feels     two jumps, then two coin sounds               growth snapshot: the jump pick
     door      the locked door                               the kinds of fun they like
     badge     a generated handle they can re-roll, a colour and a picture
     engine    two "just guess" taps, then a word check with one made-up word (flarnish)
                                                             growth snapshot, repeated at the exit
     task      fix a silent coin, how sure they are, which job sounds fun
     hired     the badge prints, and off to their desk
   The code-at-the-door beat is gone: the sign-in page's class password does that job now. The
   picture password is gone too (Jed didn't like it); the class list plus "Is this your game?" replaced it.

   Choices come as the question card (the studio's, chat.js, in the lobby's colours). Typing is
   always allowed: a step that asked for something typed takes it, and anything else goes to the
   director (the mentor agent, speaking as the studio director), who can pick the answer the kid
   meant. What's learned goes on the director's clipboard as it happens, the learner card in the open. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'studio.interview';
  var CARD = null, expecting = null, question = null, busy = false, history = [];

  function fresh() {
    return { tone: null, first: '', initial: '', games: [], fun: [], feelJump: null, feelSound: null, job: null, handle: null,
             badge: { colour: '#e0474c', icon: 'rocket' },
             snapshot: { jumpPick: null, playTap: null, jumpTap: null, wordsHeard: [], decoyTicked: false, confidence: null },
             typedSomething: false, beat: 0, done: false };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(CARD)); } catch (e) {} }
  function load() { try { CARD = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { CARD = null; } if (!CARD || CARD.done) CARD = fresh(); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- the director ---------- */
  function react(kind) {
    var s = $('scene'), cls = 'iv-' + kind;
    s.classList.remove('iv-lean', 'iv-laugh', 'iv-scribble', 'iv-nod'); void s.offsetWidth; s.classList.add(cls);
    if (kind !== 'lean') setTimeout(function () { s.classList.remove(cls); }, 1400);
  }
  function jot(word) {
    react('scribble');
    var ul = $('notes'), e = ul.querySelector('.empty'); if (e) e.remove();
    var li = document.createElement('li'); li.textContent = word; ul.appendChild(li);
    while (ul.children.length > 7) ul.removeChild(ul.firstElementChild);
  }
  function screen(html, off) { $('tablet').classList.toggle('off', !!off); var sc = $('screen'); sc.innerHTML = off ? '' : (html || ''); return sc; }

  /* The director's words: one bubble, one short paragraph, after a short "typing" beat. Then the
     question, if there is one. `then` runs once the words have landed. */
  var pending = null;
  function say(text, then) {
    hideCard();
    var w = $('words'), b = $('bubble');
    busy = true;
    w.innerHTML = '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    var t = String(text).replace(/@name/g, CARD.first || 'you').replace(/@handle/g, CARD.handle || 'you');
    setTimeout(function () {
      w.textContent = t; b.classList.remove('fresh'); void b.offsetWidth; b.classList.add('fresh');
      $('announce').textContent = t;
      history.push({ role: 'assistant', content: t }); if (history.length > 10) history.shift();
      busy = false;
      if (then) then();
      if (pending) { var p = pending; pending = null; showCard(p); }
    }, reduced() ? 100 : Math.min(1000, 420 + t.length * 4));
  }
  function echo(text) { $('echo').innerHTML = '<span>You: ' + esc(text) + '</span>'; history.push({ role: 'user', content: text }); }
  function answer(text, reply, kind, then) { echo(text); react(kind || 'nod'); say(reply, then); }

  /* ---------- the question card ---------- */
  function ask(text, list, keepOrder) {
    var opts = list.slice();
    if (!keepOrder) for (var k = opts.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = opts[k]; opts[k] = opts[j]; opts[j] = t; }
    question = { text: text, options: opts };
    if (busy) pending = question; else showCard(question);
  }
  function showCard(q) {
    var card = $('qcard'); card.innerHTML = '';
    var h = document.createElement('p'); h.className = 'q'; h.id = 'qText'; h.textContent = q.text; card.appendChild(h);
    var ol = document.createElement('ol');
    q.options.forEach(function (o, n) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'qopt';
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
    card.hidden = false; mark(0);
    var a = document.activeElement;
    if (!a || a === document.body || card.contains(a) || a === $('say')) card.querySelector('.qopt').focus({ preventScroll: true });
  }
  function mark(n) { Array.prototype.forEach.call($('qcard').querySelectorAll('.qopt'), function (b, k) { b.classList.toggle('on', k === n); }); }
  function hideCard() { var c = $('qcard'); c.hidden = true; c.innerHTML = ''; }
  function pick(n, typed) { var q = question; if (!q || !q.options[n]) return; question = null; pending = null; hideCard(); var o = q.options[n]; if (!typed && o.echo !== false) echo(o.echo || o.text); o.run(); }
  $('qcard').addEventListener('keydown', function (e) {
    var bs = Array.prototype.slice.call($('qcard').querySelectorAll('.qopt')), at = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); bs[at < 0 ? 0 : (at + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); return; }
    var d = parseInt(e.key, 10); if (d >= 1 && d <= bs.length) { e.preventDefault(); pick(d - 1); }
  });

  /* ---------- typing ---------- */
  function expect(placeholder, fn) { expecting = fn; $('say').placeholder = placeholder; $('say').focus(); }
  $('sayForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('say'), text = input.value.trim().slice(0, 120);
    if (!text || $('sendBtn').disabled) return;
    input.value = ''; input.placeholder = 'Answer, or ask the director anything…';
    CARD.typedSomething = true; save();
    if (expecting) { var fn = expecting; expecting = null; echo(text); fn(text); return; }
    echo(text); director(text);
  });
  /* Anything else typed: the director answers, and picks the answer the kid meant if there's one on
     screen. The mentor agent does this in the studio too; here it speaks as the studio director. */
  function director(text) {
    var q = question; hideCard();
    $('words').innerHTML = '<span class="wheel" aria-hidden="true"></span>Thinking…'; $('sendBtn').disabled = true;
    var ctx = 'You are speaking as the studio director, interviewing a new hire for a game developer job. It is warm and a bit funny, never a test: every answer is fine. '
      + 'They have not seen the game engine yet. Nothing in the game can be changed from here, so actions must be []. '
      + (q ? 'Question on screen: "' + q.text + '". Answers: ' + q.options.map(function (o, n) { return (n + 1) + '. ' + o.text; }).join('  ') + '.' : 'No question on screen right now.')
      + ' Keep it to one or two short sentences. Never ask for their last name, age, school or where they live.';
    fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'mentor', message: text, history: history.slice(0, -1), where: 'The hiring interview, before their first day at the studio.', studio: ctx }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        $('sendBtn').disabled = false;
        if (!res.ok || !res.j.reply) { say('Ha, I like you already. I’ve written that down.'); jot('said: ' + text.slice(0, 18)); if (q) ask(q.text, q.options, true); return; }
        react('nod');
        var n = res.j.choose;
        say(res.j.reply, function () { if (q && n && q.options[n - 1]) { question = q; pick(n - 1, true); } });
        if (!(q && n && q.options[n - 1]) && q) ask(q.text, q.options, true);
      })
      .catch(function () { $('sendBtn').disabled = false; say('Ha, I like you already.'); if (q) ask(q.text, q.options, true); });
  }

  /* ---------- the beats ---------- */
  var BEATS = [meet, name, games, feels, door, badge, engine, task, hired];
  function go(n) { CARD.beat = n; save(); screen('', true); expecting = null; $('say').placeholder = 'Answer, or ask the director anything…'; BEATS[n](); }
  function next() { go(CARD.beat + 1); }

  function meet() {
    react('lean');
    say('Come in, come in! Sit down. So, you’re here about the game developer job?');
    var t = function (tone, text, reply, kind) { return { text: text, run: function () { CARD.tone = tone; save(); answer(text, reply, kind); ask('Ready?', [{ text: 'Yes, I want the job!', run: next }]); } }; };
    ask('What do you say?', [
      t('keen', 'Yes!', 'Great! There are no wrong answers today, I promise.'),
      t('curious', 'Wait, what job?', 'Game developer! You make games, here, with us. Still interested?'),
      t('silly', 'I’m just here for the snacks', 'Ha! Honestly, same. We’ll get to the snacks.', 'laugh')], true);
  }

  function name() {
    react('lean');
    say('First, what should I call you? Just your first name, and the first letter of your last name.');
    var sc = screen('<h2>Your name</h2><div class="namefields"><div><label for="nFirst">First name</label><input id="nFirst" autocomplete="off" maxlength="20"></div>'
      + '<div><label for="nInit">Last initial</label><input id="nInit" autocomplete="off" maxlength="1"></div></div>'
      + '<p class="note">Only your teacher and your class see it. Everywhere else, you’ll go by a studio name.</p>');
    var done = function (first, initial) {
      first = String(first || '').replace(/[^\p{L} '’-]/gu, '').trim().slice(0, 20);
      initial = String(initial || '').replace(/[^\p{L}]/gu, '').slice(0, 1).toUpperCase();
      if (!first) { say('I didn’t catch that. What’s your first name?'); ask('Your name', [{ text: 'That’s me', run: fromFields }], true); return; }
      CARD.first = first.charAt(0).toUpperCase() + first.slice(1); CARD.initial = initial; save();
      jot(CARD.first + (initial ? ' ' + initial + '.' : ''));
      answer(CARD.first + (initial ? ' ' + initial + '.' : ''), 'Nice to meet you, ' + CARD.first + '!', 'nod', function () { setTimeout(next, 900); });
    };
    var fromFields = function () { done($('nFirst').value, $('nInit').value); };
    sc.querySelector('#nInit').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fromFields(); } });
    sc.querySelector('#nFirst').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('nInit').focus(); } });
    ask('Type it on the tablet, or below', [{ text: 'That’s me', echo: false, run: fromFields }], true);
    expect('Like “Maya R”…', function (text) { var bits = text.trim().split(/\s+/); done(bits[0], bits[1]); });
    setTimeout(function () { var f = $('nFirst'); if (f) f.focus(); }, 1100);
  }

  var G = [['Minecraft', 'build'], ['Mario', 'jump'], ['Roblox', 'build'], ['Fortnite', 'battle'], ['Zelda', 'adventure'], ['Among Us', 'team'], ['Pokémon', 'collect']];
  function games() {
    react('lean'); var picked = {};
    say('Which of these games have you played? Tap all you like on the tablet.');
    var sc = screen('<h2>Games you’ve played</h2><div class="tiles">' + G.map(function (g) { return '<button type="button" class="tile" aria-pressed="false">' + g[0] + '</button>'; }).join('') + '</div>');
    Array.prototype.forEach.call(sc.querySelectorAll('.tile'), function (b) { b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); picked[b.textContent] = on; }); });
    var done = function () {
      CARD.games = Object.keys(picked).filter(function (k) { return picked[k]; }); save();
      var w = { build: 'a builder', jump: 'a jumper', battle: 'a battler', adventure: 'an adventurer', team: 'a teammate', collect: 'a collector' }, seen = {};
      var list = CARD.games.map(function (g) { var f = G.filter(function (x) { return x[0] === g; })[0]; return f && f[1]; }).filter(function (k) { if (!k || seen[k]) return false; seen[k] = 1; return true; }).map(function (k) { return w[k]; });
      var line = !list.length ? (CARD.games.length ? 'Ooh, ' + CARD.games.join(' and ') + '! I’m writing that down.' : 'A fresh start! You’ll see games differently after today.')
        : list.length === 1 ? 'Ooh, ' + list[0] + '! I’m writing that down.' : 'So you’re ' + list.slice(0, -1).join(', ') + ' AND ' + list[list.length - 1] + '. Noted!';
      answer(CARD.games.length ? CARD.games.join(', ') : 'None of these', line, 'nod', function () { setTimeout(next, 900); });
      if (list.length) jot(list[0].replace(/^an? /, '')); else if (CARD.games.length) jot(CARD.games[0]);
    };
    ask('Tap your games, then', [{ text: 'That’s all of them', echo: false, run: done }, { text: 'None of these', echo: false, run: function () { picked = {}; done(); } },
      { text: 'Something else…', sub: 'type a game you love', echo: false, run: function () { expect('Type a game you love…', function (t) { picked[t.slice(0, 30)] = true; done(); }); } }], true);
  }

  var jumpsOn = false;
  function startJumps() {
    jumpsOn = true; var t = 0;
    var one = function (id, g, v) { var c = $(id); if (!c) return; var x = c.getContext('2d'), p = (t % 150), vy = v, yy = 0;
      for (var k = 0; k < p; k++) { vy -= g; yy += vy; if (yy < 0) { yy = 0; vy = 0; } }
      x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 160, 110); x.fillStyle = '#6e6e6e'; x.fillRect(0, 92, 160, 18);
      x.fillStyle = '#5fd06a'; x.fillRect(72, 78 - Math.min(76, yy), 16, 14); x.fillStyle = '#1d2230'; x.fillRect(75, 82 - Math.min(76, yy), 3, 3); x.fillRect(82, 82 - Math.min(76, yy), 3, 3); };
    var tick = function () { if (!jumpsOn) return; t++; one('jA', 0.035, 1.9); one('jB', 0.32, 5.4); requestAnimationFrame(tick); };
    tick();
  }
  var SFX = { ding: '/assets/platformer/sfx_coin.ogg', thud: '/assets/platformer/sfx_bump.ogg', boing: '/assets/platformer/sfx_jump.ogg' };
  function play(id) { if (UI.muted()) return; try { var a = new Audio(SFX[id]); a.volume = .55; a.play().catch(function () {}); } catch (e) {} }
  function feels() {
    react('lean');
    say('Quick one. Two jumps on the tablet. Which one feels better to you?');
    screen('<h2>Which jump feels better?</h2><div class="pair"><div><canvas id="jA" width="160" height="110" aria-label="Jump A floats up slowly and drifts down"></canvas><b>Jump A</b></div>'
      + '<div><canvas id="jB" width="160" height="110" aria-label="Jump B snaps up fast and lands hard"></canvas><b>Jump B</b></div></div>');
    startJumps();
    var sounds = function () {
      jumpsOn = false;
      say('Now sounds. You grab a coin. Tap each one to hear it.');
      var sc = screen('<h2>Which coin sound?</h2><div class="tiles"><button type="button" class="tile" id="sA"><svg class="i"><use href="#i-sound"/></svg>Sound A</button><button type="button" class="tile" id="sB"><svg class="i"><use href="#i-sound"/></svg>Sound B</button></div>'
        + '<p class="note">Sound off? A is a “ding”, B is a “thud”.</p>');
      sc.querySelector('#sA').addEventListener('click', function () { play('ding'); });
      sc.querySelector('#sB').addEventListener('click', function () { play('thud'); });
      var s = function (v, text, reply) { return { text: text, run: function () { CARD.feelSound = v; save(); jot(v === 'ding' ? 'likes a sparkle' : 'likes a thump'); answer(text, reply, 'nod', function () { setTimeout(next, 900); }); } }; };
      ask('Which one?', [s('ding', 'Sound A', 'The ding! Bright and happy. You have an ear for this.'), s('thud', 'Sound B', 'The thud! Solid. You like things to feel heavy.')], true);
    };
    var j = function (v, text, reply) { return { text: text, run: function () { CARD.feelJump = v; CARD.snapshot.jumpPick = v; save(); jot(v === 'floaty' ? 'likes floaty' : v === 'snappy' ? 'likes snappy' : 'hmm, the same?'); answer(text, reply, 'nod', sounds); } }; };
    ask('Which jump?', [j('floaty', 'Jump A', 'The floaty one! Like being on the moon.'), j('snappy', 'Jump B', 'The snappy one! Quick and sharp.'),
      j('same', 'They feel the same', 'Interesting! Watch them again later. There’s a secret in there.')], true);
  }

  function door() {
    react('lean');
    say('You’re in a game. You find a locked door. What do you do?');
    var d = function (fun, text, reply, note, kind) { return { text: text, run: function () { CARD.fun.push(fun); save(); jot(note); answer(text, reply, kind || 'nod', function () { setTimeout(next, 900); }); } }; };
    ask('The locked door', [d('explore', 'Hunt for the key', 'An explorer! You want to see everything.', 'explorer'),
      d('challenge', 'Smash it', 'Ha! Action first. Bold.', 'action', 'laugh'), d('clever', 'Sneak round the back', 'Clever. You like figuring things out.', 'puzzler'),
      d('social', 'Get a friend', 'A team player! Games are better together.', 'team player'), d('make', 'Build a way over', 'A maker! You’d rather build your own way.', 'maker')]);
  }

  var ADJ = { explore: ['Curious', 'Wandering', 'Roaming'], challenge: ['Turbo', 'Brave', 'Mighty'], clever: ['Sneaky', 'Clever', 'Tricky'],
              social: ['Friendly', 'Loyal', 'Jolly'], make: ['Crafty', 'Handy', 'Inventive'], any: ['Pixel', 'Cosmic', 'Speedy', 'Lucky'] };
  var NOUN = { Minecraft: ['Miner', 'Builder'], Mario: ['Jumper', 'Hopper'], Roblox: ['Builder', 'Maker'], Fortnite: ['Glider', 'Ranger'],
               Zelda: ['Hero', 'Explorer'], 'Among Us': ['Crewmate', 'Detective'], 'Pokémon': ['Trainer', 'Collector'], any: ['Fox', 'Byte', 'Rocket', 'Otter', 'Comet'] };
  function one(a) { return a[Math.floor(Math.random() * a.length)]; }
  function roll() {
    var adj = [].concat.apply([], CARD.fun.map(function (f) { return ADJ[f] || []; })); if (!adj.length) adj = ADJ.any;
    var nn = [].concat.apply([], CARD.games.map(function (g) { return NOUN[g] || []; })); if (!nn.length) nn = NOUN.any;
    var h, guard = 0; do { h = one(adj) + one(nn) + (10 + Math.floor(Math.random() * 90)); } while (h === CARD.handle && guard++ < 5);
    CARD.handle = h; save();
  }
  var COLOURS = [['Red', '#e0474c'], ['Blue', '#3f7fe0'], ['Green', '#2f9e5b'], ['Purple', '#8a5cd6']];
  var ICONS = ['rocket', 'cat', 'bolt', 'ghost'];
  function badgeHtml() {
    var c = CARD.badge.colour;
    return '<div class="badge"><div class="band" style="background:' + c + '">THE LEAGUE GAME STUDIO</div><div class="body"><div class="pic" style="background:' + c + '"><svg class="i"><use href="#p-' + CARD.badge.icon + '"/></svg></div>'
      + '<div><strong>' + esc(CARD.handle) + '</strong><small>Game developer · new hire</small></div></div></div>';
  }
  function drawBadge() {
    var sc = screen(badgeHtml() + '<div class="swatches">' + COLOURS.map(function (c) { return '<button type="button" class="tile" data-c="' + c[1] + '" aria-pressed="' + (CARD.badge.colour === c[1]) + '"><i style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('') + '</div>'
      + '<div class="swatches">' + ICONS.map(function (ic) { return '<button type="button" class="tile" data-i="' + ic + '" aria-pressed="' + (CARD.badge.icon === ic) + '" aria-label="' + ic + '"><svg class="i"><use href="#p-' + ic + '"/></svg></button>'; }).join('') + '</div>');
    Array.prototype.forEach.call(sc.querySelectorAll('[data-c],[data-i]'), function (b) { b.addEventListener('click', function () {
      if (b.dataset.c) CARD.badge.colour = b.dataset.c; if (b.dataset.i) CARD.badge.icon = b.dataset.i; save(); drawBadge(); }); });
  }
  function badge() {
    react('lean'); roll(); drawBadge();
    say('Everyone here goes by a studio name. I made you one from your answers: @handle! Don’t love it? Roll again.');
    var keep = function () {
      fetch('/auth/studio/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first: CARD.first, initial: CARD.initial, handle: CARD.handle }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
        .then(function (res) {
          if (res.status === 409) { roll(); drawBadge(); say('Ooh, someone already has that one! How about @handle?'); ask('Your studio name', choices, true); return; }
          if (!res.ok) { say('Hmm, I couldn’t save that. Let’s try again.'); ask('Your studio name', choices, true); return; }
          jot(CARD.handle); UI.sound('good');
          answer(CARD.handle + '. Keep it!', 'Welcome, @handle! Pick a badge colour and picture on the tablet if you like.', 'nod', function () { ask('Your badge', [{ text: 'Looks good', run: next }], true); });
        })
        .catch(function () { say('Hmm, I couldn’t reach the office. Try again in a moment.'); ask('Your studio name', choices, true); });
    };
    var choices = [{ text: 'Keep it!', echo: false, run: keep },
      { text: 'Roll again', sub: 'a new name from the same answers', echo: false, run: function () { roll(); drawBadge(); UI.feel($('tablet'), 'good'); say('How about @handle?'); ask('Your studio name', choices, true); } }];
    ask('Your studio name', choices, true);
  }

  var AREA = { top: 'The bar across the top', left: 'The list on the left', mid: 'The picture in the middle', right: 'The panel on the right' };
  function mini(q, onTap) {
    var sc = screen('<div class="mini" id="mini"><button type="button" class="mtop" data-a="top" aria-label="' + AREA.top + '"><i></i></button>'
      + '<button type="button" class="mside" data-a="left" aria-label="' + AREA.left + '"></button><button type="button" class="mscene" data-a="mid" aria-label="' + AREA.mid + '"></button>'
      + '<button type="button" class="minsp" data-a="right" aria-label="' + AREA.right + '"></button></div>');
    var m = sc.querySelector('#mini'), took = false;
    var tap = function (a, x, y) {
      if (took) return; took = true;
      var mk = document.createElement('span'); mk.className = 'mark'; mk.style.left = x + 'px'; mk.style.top = y + 'px'; m.appendChild(mk);
      react('scribble'); question = null; hideCard(); setTimeout(function () { onTap(a); }, 450);
    };
    Array.prototype.forEach.call(m.children, function (b) { b.addEventListener('click', function (e) {
      var r = m.getBoundingClientRect(), br = b.getBoundingClientRect();
      tap(b.dataset.a, (e.clientX ? e.clientX : br.left + br.width / 2) - r.left, (e.clientY ? e.clientY : br.top + br.height / 2) - r.top); }); });
    // the same four places as answers, so a keyboard or a screen reader never has to aim
    ask(q, Object.keys(AREA).map(function (a) { return { text: AREA[a], echo: false, run: function () { m.querySelector('[data-a="' + a + '"]').click(); } }; }), true);
  }
  function engine() {
    react('lean');
    say('Now a peek at our game engine. Just guess! Where would you press Play to test a game?');
    mini('Tap a place on the tablet', function (a) {
      CARD.snapshot.playTap = a; save(); echo('(tapped: ' + AREA[a].toLowerCase() + ')');
      say('Interesting! And where would you change how high the hero jumps?');
      mini('Tap a place on the tablet', function (a2) {
        CARD.snapshot.jumpTap = a2; save(); echo('(tapped: ' + AREA[a2].toLowerCase() + ')');
        say('Great. You’ll know for sure in a week or two.', words);
      });
    });
  }
  function words() {
    var W = ['sprite', 'collider', 'prefab', 'frame', 'flarnish', 'Inspector'], on = {};
    say('Which of these words have you heard before? Tap any on the tablet.');
    var sc = screen('<h2>Heard of any of these?</h2><div class="tiles">' + W.map(function (w) { return '<button type="button" class="tile" aria-pressed="false">' + w + '</button>'; }).join('') + '</div>');
    Array.prototype.forEach.call(sc.querySelectorAll('.tile'), function (b) { b.addEventListener('click', function () {
      var v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); on[b.textContent] = v; }); });
    var done = function () {
      var got = Object.keys(on).filter(function (k) { return on[k]; });
      CARD.snapshot.decoyTicked = got.indexOf('flarnish') >= 0; CARD.snapshot.wordsHeard = got.filter(function (w) { return w !== 'flarnish'; }); save();
      answer(got.length ? got.join(', ') : 'None of them', CARD.snapshot.decoyTicked ? 'Ha, flarnish! I made that one up. You’re keen, I like it.' : got.length ? 'Nice. You’ll know all of these soon.' : 'Perfect. You’ll learn every one of these here.',
        CARD.snapshot.decoyTicked ? 'laugh' : 'nod', function () { setTimeout(next, 900); });
    };
    ask('Tap the words, then', [{ text: 'That’s all', echo: false, run: done }, { text: 'None of them', echo: false, run: function () { on = {}; done(); } }], true);
  }

  function task() {
    react('lean');
    say('Last thing. This coin should make a sound when you grab it, but it’s silent. Fix it on the tablet?');
    var sc = screen('<h2>Coin: when grabbed</h2><div class="tiles" id="ftiles"><button type="button" class="tile" data-s="ding">Sparkly ding</button><button type="button" class="tile" data-s="boing">Springy boing</button><button type="button" class="tile" data-s="thud">Dull thud</button></div>');
    var fixed = function (label) { UI.sound('good'); answer('(gave the coin a ' + label.toLowerCase() + ')', 'You’re a natural. That’s literally the sound designer’s job.', 'nod', confidence); };
    Array.prototype.forEach.call(sc.querySelectorAll('[data-s]'), function (b) { b.addEventListener('click', function () {
      play(b.dataset.s); Array.prototype.forEach.call(sc.querySelectorAll('[data-s]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      question = null; hideCard(); fixed(b.textContent); }); });
    ask('Pick the coin a sound', [['ding', 'Sparkly ding'], ['boing', 'Springy boing'], ['thud', 'Dull thud']].map(function (s) {
      return { text: s[1], echo: false, run: function () { sc.querySelector('[data-s="' + s[0] + '"]').click(); } }; }), true);
  }
  function confidence() {
    var F = ['Not sure at all', 'A bit unsure', 'Maybe', 'Pretty sure', 'Totally sure'];
    say('Be honest. How sure are you that you could make a game?');
    screen('<h2>How sure are you?</h2><div class="faces">' + F.map(function (f, k) { return '<button type="button" class="tile" data-v="' + (k + 1) + '"><svg class="i"><use href="#f-' + (k + 1) + '"/></svg>' + f + '</button>'; }).join('') + '</div>');
    var chose = function (v) { CARD.snapshot.confidence = v; save(); question = null; hideCard();
      answer(F[v - 1], v < 3 ? 'That’s OK! Everyone starts there. By the end, you’ll have made one.' : 'Love it. Let’s prove it.', 'nod', job); };
    Array.prototype.forEach.call(document.querySelectorAll('.faces .tile'), function (b) { b.addEventListener('click', function () { chose(+b.dataset.v); }); });
    ask('How sure?', F.map(function (f, k) { return { text: f, echo: false, run: function () { chose(k + 1); } }; }), true);
  }
  function job() {
    screen('', true);
    say('And which job sounds most fun to you?');
    var j = function (v, text, reply) { return { text: text, run: function () { CARD.job = v; save(); jot(v); answer(text, reply, 'nod', function () { ask('Well?', [{ text: 'So… did I get the job?', run: next }], true); }); } }; };
    ask('Which job?', [j('art', 'Making the art', 'An artist! Our art director will love you.'), j('audio', 'Making the sounds', 'Sound! You already fixed that coin.'),
      j('design', 'Building the levels', 'A designer! Levels are where the fun lives.'), j('engineering', 'Making things work', 'A programmer! Our lead programmer will be thrilled.'),
      j('everything', 'All of it!', 'Ha! You’ll try every job here. That’s the plan.')]);
  }

  function hired() {
    $('scene').classList.add('iv-stand');
    $('badgeOut').innerHTML = '<div class="badge-out">' + badgeHtml() + '</div>';
    UI.sound('hired');
    say('Well, @handle, I’ve seen enough. YOU’RE HIRED! Welcome to the studio.' + (CARD.tone === 'silly' ? ' And yes, the snacks are in the break room.' : ''));
    ask('Your desk is ready', [{ text: 'Go to my desk', sub: 'your first day starts', run: function () { CARD.done = true; save(); location.href = '/'; } }], true);
  }

  /* ---------- start: only for a signed-in new hire ---------- */
  load();
  fetch('/auth/studio/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    if (!m.studio) { location.replace('/login.html'); return; }
    if (m.interviewed && !(CARD.beat > 5 && !CARD.done)) { location.replace('/'); return; }
    if (m.card) { CARD.first = CARD.first || m.card.first; CARD.initial = CARD.initial || m.card.initial; if (m.card.handle) CARD.handle = m.card.handle; }
    go(Math.min(CARD.beat || 0, BEATS.length - 1));
  }).catch(function () { say('I can’t reach the office right now. Reload the page to try again.'); });
})();
