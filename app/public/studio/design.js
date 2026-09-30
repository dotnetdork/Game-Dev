/* studio/design.js — the design meeting: the kid's game design doc, written in the chat (spec D47–D50).
 *
 * Jay, 2026-09-30: after the tutorial's board is clear and before the hero, "building a game design
 * document with the robot. This should be comprehensive but fun and the robot should ask them
 * discovery questions that lead into multiple choice questions (where needed) (they should be
 * specific to the student based on their design, when the robot needs to know more)". And "We also
 * want the robot to continually teach them about game design concepts and the core of what makes a
 * game a game".
 *
 * So it runs in ROUNDS, short ones (Jay's pick): round 1 is the core (the idea, how you play, the goal,
 * what makes it fun), about five minutes, then they build it; the later rounds come after building.
 *
 * THE PAGE OWNS THE MEETING, the way interview.js owns the hiring interview (its header says why: a
 * model left to run a conversation forgets where it is, repeats itself and invents what the kid
 * "said"). Here:
 *   - which section is being talked about, and when it is done, is the page's. Each section's FIRST
 *     question is the page's own (instant, and the same with the AI down): the section's question from
 *     project.js SECTIONS, with an example of an answer in it, since a kid can't tell what's wanted
 *     from "What kind of game is it?" alone (Jay, 2026-09-29, on the typed questions);
 *   - the AI (ai/agents/designer.md) only talks: it says back what it heard, digs for what's unclear or
 *     why, answers a question the kid asked, writes the section up, says when it is clear enough to
 *     build, and now and then proposes a card when the kid's idea leaves a real fork;
 *   - every claim is checked. A `doc` line is kept only if it is grounded in what the kid typed or
 *     picked (the kid's own words go in otherwise); `decided` needs a real answer; a card never comes
 *     on a section's first turn, and at most one per section; and after LET_GO turns the section is
 *     let go (decided if it has words, started if not), so nothing stalls;
 *   - the teaching is the page's too: when a section is decided the page says the concept in one line
 *     and awards its card (quest.js CARDS, where the line lives), so it is always right and always
 *     short.
 * A kid can leave whenever they like: "let's build" or "I'm done" ends the round with what's decided,
 * "skip" moves past a section, and the sections not reached wait for the next round.
 *
 * AI DOWN (a timeout, or two failures in a row, as the interviewer counts them): the page's question
 * for each section, and the kid's words go into the doc as typed. No generated cards; "idk" still
 * brings the section's suggestions (chat.js, expect).
 *
 * Needs Project, Chat and Views; quest.js starts a round (ask `from: design`) and hands it `host`,
 * its own say / award / card lookup and the rest, so this file never reaches into the engine.
 */
var Design = (function () {
  var TIMEOUT = 20000;   // quest.js AI_MS: a reasoned answer takes longer than 12s on a school network
  var LET_GO = 3;        // the kid's answers a section gets before the page moves on
  var MAX_TURNS = 5;     // with their questions to the AI counted too
  /* Which sections each round covers, in Jed's order (project.js SECTIONS). The hero is not in a
     round: the concept artist draws it right after round 1 (first-day.yaml, your-hero), and that
     writes the section (quest.js askHero). `handoff` is the Mentor's last line, so the hop to the
     concept artist reads as part of the meeting rather than as the Mentor leaving it. */
  var ROUNDS = {
    1: { keys: ['idea', 'play', 'goal', 'fun'], sum: 'the idea, how you play, the goal and the fun', handoff: 'The concept artist is joining us for your hero!' },
    2: { keys: ['obstacles', 'world'], sum: 'what gets in your way, and the world' },
    3: { keys: ['sound', 'story'], sum: 'the sound and the story' },
    more: { keys: [], sum: 'the extras' }
  };
  /* Each section's example answer, said with its question and shown in the box, and the suggestions
     "idk" brings. Examples of the kind of answer, never one kid's game: they are before anything is
     known about theirs. */
  var HELP = {
    idea: ['like “a cat that jumps across rooftops”', ['A cat jumping across rooftops', 'A robot escaping a factory', 'A dragon collecting gems', 'A pizza running from forks']],
    play: ['like “run and jump with the arrow keys”', ['Run and jump with the arrow keys', 'Fly up with the space bar', 'Dodge left and right', 'Climb higher and higher']],
    goal: ['like “reach the flag” or “grab 10 gems”', ['Reach the flag at the end', 'Grab every gem', 'Survive for one minute', 'Beat the boss']],
    fun: ['like “jumping over lava just in time”', ['Jumping over lava just in time', 'Finding a secret', 'Going super fast', 'Beating a really hard bit']],
    obstacles: ['like “spiky robots” or “gaps you can fall in”', ['Enemies that chase you', 'Spikes and traps', 'Gaps you can fall in', 'Things falling from the sky']],
    world: ['like “a spooky castle at night”', ['A spooky castle at night', 'A candy land', 'Outer space', 'A busy kitchen']],
    sound: ['like “fast music, and a boing when you jump”', ['Fast, exciting music', 'Calm, happy music', 'A boing when you jump', 'A crunch when you get hit']],
    story: ['like “the cat is looking for its way home”', ['Rescue a friend', 'Find the way home', 'Escape before time runs out', 'No story, just play']]
  };
  /* The concept each section teaches: the card's id in quest.js CARDS, and how the line names it. */
  var CONCEPT = { idea: ['genre', 'the genre'], play: ['core-loop', 'the core loop'], goal: ['goal', 'the goal'], fun: ['reward', 'a reward'],
    obstacles: ['challenge', 'the challenge'], world: ['theme', 'the theme'], sound: ['mood', 'the mood'], story: ['story', 'the story'] };

  /* The words a kid might use to leave, said as the whole line: "it's boring when the forks win" is a
     design answer, not "boring". */
  var EXIT = /^\s*(let['’]?s (build|make|play)( it)?|can we (build|make|play)( it)?( now)?|build it|(i['’]?m |im )?(done|finished)|that['’]?s (it|all|enough)|boring|this is boring|stop)\s*[.!]*\s*$/i;
  var SKIP = /^\s*(skip( it| this)?|next( one)?|pass|move on|later)\s*[.!]*\s*$/i;
  // interview.js FILLER: a line with nothing in it
  var FILLER = /^(idk|i ?d[o']?nt know|i do not know|dunno|nothing|no+|nope|nah|yes+|yeah|yep|ok(ay)?|k|sure|maybe|lol|um+|uh+|hm+|not sure|what|why|huh)\W*$/i;
  function real(t) { t = String(t || '').trim(); return t.length > 1 && !FILLER.test(t); }
  var STOP = /^(that|this|with|when|then|they|them|there|their|your|have|from|what|like|just|into|some|will|would|could|gets?|game|player|playing|every|very|also|lose|wins?)$/i;
  function words(t) { return String(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(function (w) { return w.length >= 4 && !STOP.test(w); }); }

  var M = null;   // the round in progress
  function round(host) {
    var R = ROUNDS[host.round] || ROUNDS[1];
    var todo = R.keys.filter(function (k) { return Project.doc().sections[k].state !== 'decided'; });
    M = { host: host, R: R, todo: todo, at: -1, fails: host.aiUp() ? 0 : 2, kid: [], s: null, busy: false };
    if (Views.docOn()) Views.show('doc');   // they watch it being written
    if (!todo.length) return end();
    if (todo.length === R.keys.length) host.say([host.text]);   // "Four quick questions" is wrong on a resume with two left
    nextSection();
  }
  function on() { return M && M.host.still(); }
  function aiUp() { return M.fails < 2; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function title(k) { return (Project.SECTIONS.filter(function (x) { return x[0] === k; })[0] || [k, k])[1]; }
  function question(k) { return (Project.SECTIONS.filter(function (x) { return x[0] === k; })[0] || [k, k, ''])[2]; }

  function nextSection() {
    M.at++;
    if (M.at >= M.todo.length) return end();
    var k = M.todo[M.at], h = HELP[k] || ['', []];
    M.s = { key: k, turns: 0, answers: 0, said: [], picks: [], carded: false, text: Project.doc().sections[k].text || '' };
    // the page's own first question, with its example in it; its own last mark stays at the end
    var q = question(k), mark = (q.match(/[.?!]\s*$/) || ['?'])[0].trim();
    M.host.say([h[0] ? q.replace(/[.?!]\s*$/, '') + ', ' + h[0] + mark : q]);
    listen();
  }
  function listen() {
    var k = M.s.key, h = HELP[k] || ['', []];
    Chat.expect(h[0] ? cap(h[0].replace(/ or .*$/, '')) + '…' : 'Type your answer…', function (text) { return heard(text); },
      { who: M.host.who, card: { text: question(k), options: h[1].map(function (x) { return { text: x }; }) } });
  }

  /* A line from the kid: typed, tapped from the suggestions, or "Picked: …" from a card. */
  function heard(text, pick) {
    if (!on()) return false;
    var s = M.s;
    // said while the AI is still answering the last line: kept for the doc, answered with the next one
    if (M.busy) { if (!pick) { s.said.push(text); M.kid.push(text); } return false; }
    if (!pick && EXIT.test(text)) { M.host.say([Object.keys(decidedNow()).length ? 'Sure! We’ve got enough to start building.' : 'Sure. We can plan more later.']); return end(); }
    if (!pick && SKIP.test(text)) { letGo(s, 'Okay, we’ll come back to that one.'); return; }
    s.turns++;
    if (pick) s.picks.push(pick); else { s.said.push(text); M.kid.push(text); }
    if (pick || (real(text) && !/\?\s*$/.test(text))) s.answers++;
    M.host.log('design', { section: s.key, turn: s.turns, said: String(text).slice(0, 200), pick: pick || undefined });
    if (!aiUp()) return scripted(s, text);
    ask(s, text);
    return false;
  }

  /* The AI down: the kid's words are the section. One nudge for a line with nothing in it. */
  function scripted(s, text) {
    if (!s.said.some(real) && !s.picks.length) {
      if (s.turns >= 2) return letGo(s, 'No worries, we’ll come back to it.');
      M.host.say(['Say it any way you like, ' + ((HELP[s.key] || [''])[0] || 'in a few words') + '.']);
      return false;
    }
    Project.writeDoc(s.key, s.said.filter(real).concat(s.picks).join('. ').slice(0, 300), 'kid', 'decided');
    decide(s, ['Got it, that’s in your doc.']);
  }

  function studio(s) {
    var d = Project.doc(), out = [];
    out.push('You are speaking as ' + M.host.name + '.');
    out.push('Design meeting, round ' + M.host.round + ': ' + M.R.keys.map(function (k) { return '"' + k + '"'; }).join(', ') + '.');
    out.push('THE DOC SO FAR: ' + Project.SECTIONS.map(function (x) {
      var t = d.sections[x[0]]; return '"' + x[0] + '" (' + x[1] + ') [' + t.state + ']' + (t.text ? ': ' + t.text : '');
    }).join('; ') + '.');
    out.push('NOW: "' + s.key + '" (' + title(s.key) + '). Its question: "' + question(s.key) + '". Turns on it: ' + s.turns + '. '
      + (s.carded ? 'A card was already offered for it: no more cards for this section.' : s.turns < 2 ? 'No card yet: this is its first answer.' : 'A card is allowed, only for a real fork.'));
    out.push('What they said about NOW: ' + (s.said.map(function (t) { return '"' + t + '"'; }).join(' / ') || 'nothing yet') + (s.picks.length ? '. They picked: ' + s.picks.join('; ') : '') + '.');
    out.push('Their hero: ' + (M.host.hero() || 'none yet (the concept artist draws it after this round)') + '.');
    out.push('Their cards (ideas they have learned): ' + (M.host.cards().map(function (c) { return c.name + ' (' + c.text + ')'; }).join('; ') || 'none') + '.');
    out.push('Ideas for later: ' + (d.ideas.slice(-5).join(' | ') || 'none') + '.');
    return out.join('\n');
  }

  function ask(s, text) {
    M.busy = true;
    var wait = Chat.thinking(M.host.who), t0 = Date.now(), at = M.at;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    var done = function (how, j) {
      clearTimeout(timer); wait.done(); M.busy = false;
      M.host.log('ai', { agent: 'designer', how: how, section: s.key, said: String(text).slice(0, 300), reply: j && j.reply, doc: j && j.doc, decided: j && j.decided, card: j && j.card ? j.card.text : undefined, idea: j && j.idea || undefined, ms: Date.now() - t0 });
    };
    fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ agent: 'designer', message: text, history: Chat.history(),
        where: 'The design meeting, round ' + M.host.round + ', on “' + title(s.key) + '”.', studio: studio(s) })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!on() || M.at !== at) return done('late', res.j);
        if (!res.ok || !res.j.reply) { M.fails++; done(res.ok ? 'empty' : 'failed', res.j); return scripted(s, text); }
        M.fails = 0; done('ok', res.j);
        answered(s, res.j);
      }, function (e) {
        if (!M) return;
        M.fails++; done(e && e.name === 'AbortError' ? 'timeout' : 'offline');
        if (on() && M.at === at) scripted(s, text);
      });
  }

  /* Is the AI's write-up made of what the kid said? Some real word of it has to be in their words, in
     this meeting or on the card they picked (interview.js grounded, on a sentence rather than a name). */
  function grounded(line, s) {
    var theirs = (M.kid.join(' ') + ' ' + s.picks.join(' ')).toLowerCase();
    var ws = words(line);
    return ws.length > 0 && ws.some(function (w) { return theirs.indexOf(w.slice(0, 5)) >= 0; });
  }
  function answered(s, j) {
    var reply = String(j.reply || '').trim();
    var line = j.doc && j.doc[s.key], mine = s.said.filter(real).concat(s.picks).join('. ');
    // the newest write-up that is theirs, else the last one that was, else their own words
    if (line && grounded(line, s)) s.aiText = line;
    var text = s.aiText || mine;
    if (text && (s.said.some(real) || s.picks.length) && text !== s.text) {
      s.text = text.slice(0, 300);
      Project.writeDoc(s.key, s.text, s.aiText ? 'ai' : 'kid', 'started');
    }
    if (j.idea && real(j.idea) && grounded(j.idea, s)) { M.host.idea(j.idea); }
    /* Decided, the page moves on, so a question left in the reply would never be answered ("Does the
       pizza run on its own, or only when you press an arrow?", then the goal's question under it, in
       the first real run). Only the part that says it back is kept. */
    var lead = reply.replace(/[^.!?]*\?\s*$/, '').trim();
    var decided = j.decided === true && !!s.text && s.answers > 0;
    if (decided) return decide(s, lead ? [lead] : []);
    // a card: only for a fork, never on the first turn, once per section, and only while it can still help
    var c = j.card;
    if (c && !s.carded && s.turns >= 2 && s.answers < LET_GO && c.options && c.options.length >= 2) {
      s.carded = true;
      // the card asks the question; the reply leads into it
      if (lead) M.host.say([lead]);
      Chat.ask(c.text, c.options.slice(0, 4).map(function (o) {
        return { text: o.text, sub: o.sub || undefined, run: function () { heard('Picked: ' + o.text, o.text + (o.sub ? ' (' + o.sub + ')' : '')); } };
      }), { who: M.host.who, keepOrder: true });
      return false;   // still listening: "Something else" on the card is a typed answer
    }
    if (s.answers >= LET_GO || s.turns >= MAX_TURNS) return letGo(s, reply);
    M.host.say([reply]);
    return false;
  }

  /* The section is clear: its concept, in one line, and its card. */
  function decide(s, lines) {
    var d = Project.doc().sections[s.key];
    if (d.text) Project.writeDoc(s.key, d.text, d.by, 'decided');
    var c = CONCEPT[s.key], card = c && M.host.card(c[0]);
    var fresh = c && M.host.cards().map(function (x) { return x.id; }).indexOf(c[0]) < 0;
    if (fresh && card && card.text) lines = lines.concat(['Designers call that ' + c[1] + '. ' + card.text]);
    if (lines.length) M.host.say(lines);
    if (fresh) M.host.award({ card: c[0] });
    Chat.stopExpecting();
    nextSection();
  }
  /* Enough turns, or "skip": on, with what there is. */
  function letGo(s, line) {
    var d = Project.doc().sections[s.key];
    if (d.text) return decide(s, line ? [line] : []);
    if (line) M.host.say([line]);
    Chat.stopExpecting();
    nextSection();
  }
  function decidedNow() {
    var d = Project.doc().sections, out = {};
    M.R.keys.forEach(function (k) { if (d[k].state === 'decided') out[k] = true; });
    return out;
  }
  function end() {
    if (!M) return;
    var host = M.host, R = M.R, n = Object.keys(decidedNow()).length;
    Chat.stopExpecting();
    M = null;
    if (R.keys.length) host.say([n ? 'That’s ' + R.sum + ', in your design doc.' : 'Your design doc is ready whenever you are.'].concat(R.handoff ? [R.handoff] : []));
    if (Views.current() === 'doc') Views.show('game');
    host.done();
  }

  return { round: round, ROUNDS: ROUNDS, CONCEPT: CONCEPT, busy: function () { return !!M; } };
})();
