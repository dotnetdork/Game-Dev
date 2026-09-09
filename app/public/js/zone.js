/* zone.js — building zones: the workspace a module's checkpoint opens.
 *
 * A checkpoint is not a lesson. Every other lesson in the course is something to read with things
 * to do embedded in it; a checkpoint is the opposite shape — a room the student builds their own
 * game in, with the course's voice reduced to a bot sitting beside them. So it does not render as
 * a lesson page with cards on it. It renders as a door, and behind the door is this.
 *
 * The overlay discipline is the lab bench's, deliberately, because the bench got it right:
 *   - ONE element in index.html, present from page load, `hidden`
 *   - every handler bound ONCE at load against that static markup
 *   - only the CONTENTS of the hosts are built and destroyed, per opening
 *   - the shell behind is covered and made `inert` rather than hidden, so the top bar still works
 *   - one state object is the single view-model, and its `.ui` handle being null is the guard
 *     every async callback checks before touching the screen
 *
 * What is different, and why:
 *
 *   The bot is open by default and speaks first. In the bench the tutor is a panel you go and find,
 *   which is right for "I am stuck on this one exercise". It is wrong here: the students this is
 *   written for mostly do not know what to make, and a silent room with an empty board is the exact
 *   blank page that produces either paralysis or a plan for an MMO. So the zone opens the
 *   conversation.
 *
 *   The artifact is a FILE. The board is a structured view of `design.md` in the student's own
 *   project, and that file stays the single truth — the board reads it on open and writes it on
 *   every edit. Nothing is stored twice. This matters more than it looks: notes kept in progress
 *   state are destroyed by "Reset my progress", a button that lives under a heading called Testing
 *   and promises only to clear XP and lessons, and the one-sheet is the only thing a student cannot
 *   get back by reading the starter.
 */

/* ---------- the one-sheet, as data ----------
   design.md is markdown a student can open in the Code tab and read, and it is also the board's
   backing store. Those two have to be the same file or they drift, so this parses and re-renders
   it rather than keeping a copy.

   Round-tripping rules, both learned from what the file actually looks like:

     A leading (parenthesised block) in a slot is a PROMPT, not an answer. The starter ships one
     under every heading to explain what goes there, and a student who has written nothing has an
     empty slot rather than a slot containing a sentence we wrote.

     Headings this zone does not declare are KEPT, in place. A later checkpoint adds `## My core
     loop`, and a student adds whatever they like — dropping those on write would delete their
     work to tidy a namespace. */
const SHEET_FILE = 'design.md';

function zoneSlotKey(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

/* Strip a balanced parenthesised block from the front. Balanced rather than greedy because the
   prompts contain parentheses of their own — "(0 = none)" inside one would end it early. */
function zoneSplitPrompt(body) {
  const t = String(body == null ? '' : body).replace(/^\n+/, '');
  if (t.charAt(0) !== '(') return { prompt: '', answer: t.trim() };
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t.charAt(i) === '(') depth++;
    else if (t.charAt(i) === ')') {
      depth--;
      if (depth === 0) return { prompt: t.slice(0, i + 1), answer: t.slice(i + 1).trim() };
    }
  }
  return { prompt: t.trim(), answer: '' };            // unbalanced: treat the lot as the prompt
}

function parseSheet(md) {
  const lines = String(md == null ? '' : md).replace(/\r\n/g, '\n').split('\n');
  const sheet = { head: [], slots: [] };
  let cur = null;
  lines.forEach(function (ln) {
    const m = ln.match(/^##\s+(.+?)\s*$/);
    if (m) { cur = { heading: m[1], key: zoneSlotKey(m[1]), raw: [] }; sheet.slots.push(cur); return; }
    (cur ? cur.raw : sheet.head).push(ln);
  });
  sheet.slots.forEach(function (s) {
    const p = zoneSplitPrompt(s.raw.join('\n'));
    s.prompt = p.prompt; s.answer = p.answer;
  });
  return sheet;
}

/* Back to markdown. An answered slot loses its prompt, so the file reads as a design document
   rather than as a form — and an unanswered one keeps it, so the Code tab still explains itself. */
function renderSheet(sheet) {
  const out = [sheet.head.join('\n').replace(/\s+$/, '')];
  sheet.slots.forEach(function (s) {
    out.push('\n\n## ' + s.heading + '\n\n' + (s.answer ? s.answer : s.prompt).replace(/\s+$/, ''));
  });
  return out.join('').replace(/\s+$/, '') + '\n';
}

function sheetRead() {
  const md = (typeof project === 'object' && project && project.files) ? project.files[SHEET_FILE] : '';
  return parseSheet(typeof md === 'string' ? md : '');
}
function sheetWrite(sheet) {
  if (typeof project !== 'object' || !project || !project.files) return;
  project.files[SHEET_FILE] = renderSheet(sheet);
  if (project.order && project.order.indexOf(SHEET_FILE) < 0) project.order.unshift(SHEET_FILE);
  if (typeof saveProject === 'function') saveProject();
  /* The Code tab may be showing this very file behind the overlay. Repaint it rather than leaving
     a stale copy for the student to find and "fix" over the top of what they just wrote. */
  if (typeof currentFile !== 'undefined' && currentFile === SHEET_FILE
      && typeof loadCode === 'function' && $('view-code') && !$('view-code').hidden) loadCode();
}
/* Find a slot by heading, creating it if the file has never had one. Matched on the squashed key so
   "My game is" finds "## My game is..." — the starter's headings carry an ellipsis and an author
   writing a zone should not have to reproduce it. */
function sheetSlot(sheet, heading) {
  const k = zoneSlotKey(heading);
  let s = sheet.slots.filter(function (x) { return x.key === k; })[0];
  if (!s) { s = { heading: heading, key: k, raw: [], prompt: '', answer: '' }; sheet.slots.push(s); }
  return s;
}

/* ---------- the zone on screen ---------- */
let openZoneRef = null;         // the zone on screen, or null
let zoneReturnFocus = null;
let zoneRegistry = [];          // the zones in the lesson on screen, for the router
const ZONE_MIN_WIDTH = 700;     // same threshold as the lab bench; see tooSmallToBuild

/* Which shell parts go dead while the zone is up. The top bar is deliberately excluded, exactly as
   the bench excludes it: Store, Gallery, Docs and Help keep working, and showPage closes the zone
   before navigating anywhere. */
function zoneIsolate(on) {
  ['#editor', '#page', '.statusbar'].forEach(function (sel) {
    const el = document.querySelector(sel);
    if (el && 'inert' in el) el.inert = on;
  });
}

/* ---------- goals ----------
   A goal is a check against the student's real work, not a box they tick. `slot:` is the only kind
   this stage has and it is the honest one for a board: that heading has an answer under it. */
function zoneGoalDone(zone, goal) {
  if (goal.slot === '*' || goal.slot === 'all') {
    return zone.spec.slots.every(function (h) { return !!sheetSlot(zone.sheet, h).answer; });
  }
  if (goal.slot) return !!sheetSlot(zone.sheet, goal.slot).answer;
  return false;
}
function zoneProgress(zone) {
  const goals = zone.spec.goals || [];
  let n = 0;
  goals.forEach(function (g) { if (zoneGoalDone(zone, g)) n++; });
  return { done: n, total: goals.length };
}
function paintZoneGoals(zone) {
  const host = $('zoneGoals'); if (!host) return;
  host.innerHTML = '';
  (zone.spec.goals || []).forEach(function (g) {
    const done = zoneGoalDone(zone, g);
    const el = document.createElement('span');
    el.className = 'zone-goal' + (done ? ' on' : '');
    el.setAttribute('role', 'listitem');
    el.innerHTML = '<span class="zone-tick" aria-hidden="true">' + (done ? '&#10003;' : '') + '</span>'
      + '<span>' + esc(g.say || g.slot || '') + '</span>'
      + '<span class="sr-only">' + (done ? ' — done' : ' — not done yet') + '</span>';
    host.appendChild(el);
  });
  const p = zoneProgress(zone);
  const cnt = $('zoneCount'), bar = $('zoneProg'), btn = $('zoneDone');
  if (cnt) cnt.textContent = p.total ? p.done + ' of ' + p.total + ' done' : '';
  if (bar) bar.style.width = (p.total ? Math.round(100 * p.done / p.total) : 0) + '%';
  if (btn) {
    const ready = p.total > 0 && p.done >= p.total;
    btn.disabled = !ready || zone.solved;
    btn.textContent = zone.solved ? 'Finished' : (ready ? 'Finish the zone' : 'Fill the boxes first');
  }
}

/* ---------- the board ----------
   One card per slot, all of them on screen at once. That is the whole reason this is a board and
   not a form: the empty ones are visible next to the full ones, which is the only way an
   eleven-year-old can see what is left without being told. */
function paintZoneBoard(zone) {
  const host = $('zoneBody'); if (!host) return;
  host.innerHTML = '';
  const board = document.createElement('div'); board.className = 'zone-board';
  const declared = zone.spec.slots || [];
  const prompts = zone.spec.prompts || {};

  const cardFor = function (heading, extra) {
    const slot = sheetSlot(zone.sheet, heading);
    const prompt = prompts[zoneSlotKey(heading)] || slot.prompt || '';
    const filled = !!slot.answer;
    const card = document.createElement('div');
    card.className = 'zone-card' + (filled ? ' filled' : ' empty') + (extra ? ' extra' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', heading + (filled ? '' : ' — empty') + '. Click to write in it.');
    card.innerHTML = '<div class="zone-card-lab"><span class="zone-dot' + (filled ? ' on' : '') + '"></span>'
      + esc(heading.replace(/\.+$/, '')) + '</div>'
      + '<div class="zone-card-txt">' + (filled ? esc(slot.answer) : esc(prompt)) + '</div>';
    const edit = function () { editZoneCard(zone, card, slot, prompt); };
    card.addEventListener('click', edit);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(); }
    });
    return card;
  };

  declared.forEach(function (h) { board.appendChild(cardFor(h, false)); });
  /* Slots the file has that this zone does not declare — a heading a later checkpoint added, or one
     the student wrote. Shown, because hiding a student's own writing in the one place that is
     supposed to be about their game would be the wrong kind of tidy. */
  zone.sheet.slots.forEach(function (s) {
    if (declared.some(function (h) { return zoneSlotKey(h) === s.key; })) return;
    if (!s.answer) return;                       // an empty undeclared slot is just noise
    board.appendChild(cardFor(s.heading, true));
  });
  host.appendChild(board);
}

/* Turn one card into a textarea, in place. Saved on blur and on Ctrl/Cmd-Enter; Escape abandons.
   In place rather than in a dialog because the point of a board is seeing the rest of it while you
   write, and a modal over a board hides the thing that told you what to write. */
/* The card being typed in, if any. Blur is what normally commits an edit, and removing a focused
   element does NOT reliably fire it — so pressing Back, or Escape, or Finish with a half-typed
   sentence on screen would throw the sentence away. Everything that tears the board down calls
   this first. */
let zoneEditing = null;
function commitZoneEdit() { if (zoneEditing) zoneEditing(true); }

function editZoneCard(zone, card, slot, prompt) {
  if (card.classList.contains('editing')) return;
  commitZoneEdit();                       // one card at a time; the last one keeps what was typed
  card.classList.add('editing');
  const txt = card.querySelector('.zone-card-txt');
  const box = document.createElement('textarea');
  box.className = 'zone-card-edit';
  box.value = slot.answer || '';
  box.placeholder = prompt || 'Write it here.';
  box.rows = 3;
  txt.replaceWith(box);
  box.focus(); box.select();

  let closed = false;
  const finish = function (save) {
    if (closed) return; closed = true;
    if (zoneEditing === finish) zoneEditing = null;
    if (save && box.value.trim() !== (slot.answer || '')) {
      slot.answer = box.value.trim();
      zone.touched = true;
      sheetWrite(zone.sheet);
    }
    paintZoneBoard(zone);
    paintZoneGoals(zone);
  };
  zoneEditing = finish;
  box.addEventListener('blur', function () { finish(true); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(true); }
  });
}

/* ---------- opening and closing ---------- */
function openZone(zone) {
  const view = $('zoneView'); if (!view) return;
  if (window.innerWidth && window.innerWidth < ZONE_MIN_WIDTH) {
    if (typeof modal === 'function') {
      modal({ title: 'Open this on a computer',
        message: 'A building zone puts your notes and a helper side by side, and that needs a wider screen than this one.',
        okLabel: 'OK', hideCancel: true });
    }
    return;
  }
  if (openZoneRef) closeZone();
  openZoneRef = zone;
  zone.sheet = sheetRead();                     // the file is the truth; read it every opening
  zone.ui = { open: true };
  zoneReturnFocus = (zone.card && zone.card.open) || null;

  $('zoneTitle').textContent = zone.spec.title || 'Building zone';
  const flag = view.querySelector('.zone-flag');
  if (flag && typeof moduleAccent === 'function' && typeof flat !== 'undefined' && flat[curIdx]) {
    flag.style.color = moduleAccent(flat[curIdx].mi);
  }
  paintZoneBoard(zone);
  paintZoneGoals(zone);
  zoneBotReset(zone);

  view.hidden = false;
  zoneIsolate(true);
  if (typeof syncRoute === 'function') syncRoute();
  if (typeof paintAIBtn === 'function') paintAIBtn();
  zoneBotOpen(zone);                            // the bot speaks first — see the header
}

function closeZone() {
  const zone = openZoneRef; if (!zone) return;
  commitZoneEdit();                       // a half-typed sentence on screen is still their work
  openZoneRef = null;
  zone.ui = null;
  const bot = $('zoneBot'); if (bot) bot.hidden = false;   // back to its default for next time
  $('zoneBotBody').innerHTML = '';
  $('zoneBody').innerHTML = '';
  $('zoneGoals').innerHTML = '';
  $('zoneView').hidden = true;
  zoneIsolate(false);
  if (typeof syncRoute === 'function') syncRoute();
  if (typeof paintAIBtn === 'function') paintAIBtn();
  paintZoneCover(zone);
  if (zoneReturnFocus) { try { zoneReturnFocus.focus(); } catch (e) {} }
  zoneReturnFocus = null;
  if (typeof labPendingAdvance !== 'undefined' && labPendingAdvance) {
    const f = labPendingAdvance; labPendingAdvance = null;
    if (typeof startAdvance === 'function') startAdvance(f);
  }
}

/* ---------- finishing ----------
   Two gates, in order, and they are different questions. The goals are mechanical and cannot be
   argued with: that box has words in it. The sign-off is a judgement, because a box with "idk" in
   it passes every mechanical check ever written.
   The sign-off resolves in the student's FAVOUR when it cannot tell — an unreachable server or a
   reply the server refuses to vouch for must never be the reason a child is told they are not
   finished. See gradePractice, which made the same call. */
function finishZone() {
  const zone = openZoneRef; if (!zone || zone.solved) return;
  commitZoneEdit();                       // pressing Finish with a card open counts what is in it
  const p = zoneProgress(zone);
  if (!p.total || p.done < p.total) return;
  const btn = $('zoneDone');
  if (btn) { btn.disabled = true; btn.textContent = 'Reading it…'; }
  zoneSignOff(zone).then(function (verdict) {
    if (openZoneRef !== zone) return;
    if (verdict && verdict.pass === false) {
      if (btn) { btn.disabled = false; btn.textContent = 'Finish the zone'; }
      zoneSay('bot', verdict.hint || 'Not quite yet — have another look at what you have written.');
      return;
    }
    zone.solved = true;
    paintZoneGoals(zone);
    /* The badge before the activity. resolveActivity can complete the lesson, which fires
       LESSON_DONE and its toast — and a badge announced after that reads as belonging to the next
       thing rather than to the work they just did. */
    if (zone.spec.reward && typeof awardBadge === 'function'
        && awardBadge(zone.spec.reward, typeof lessonWidgetId !== 'undefined' ? lessonWidgetId : '')) {
      if (typeof toast === 'function') toast('Zone finished — ' + zone.spec.reward + ' earned!');
    } else if (typeof toast === 'function') toast('Zone finished!');
    if (typeof resolveActivity === 'function') resolveActivity(zone.key);
    paintZoneCover(zone);
  });
}

/* ---------- the cover ----------
   What sits behind the zone: the door in, and nothing else. Not a lesson — no prose, no recap, no
   cards. A student who closes the zone lands here and can get straight back in. */
function paintZoneCover(zone) {
  const k = zone.card; if (!k) return;
  k.open.innerHTML = '<span class="mdi ' + (zone.solved ? 'mdi-flag-checkered' : 'mdi-play')
    + '" aria-hidden="true"></span>' + (zone.solved ? 'Open it again' : (zone.touched ? 'Carry on' : 'Open the zone'));
  if (k.done) {
    k.done.hidden = !zone.solved;
    if (zone.solved) k.done.innerHTML = '<span class="mdi mdi-check-circle" aria-hidden="true"></span>Finished';
  }
}

/* Build the cover from the lesson's ```zone block, and open the zone straight away the first time.
   Auto-opened because the checkpoint IS the zone: making a student click through a page that exists
   only to hold one button would be a lesson pretending not to be one. It is not re-opened on a
   later visit, so closing it is a way out rather than a fight with the back button. */
function mountZones(root) {
  zoneRegistry = [];
  if (!root) return;
  root.querySelectorAll('pre > code.language-zone').forEach(function (code) {
    const pre = code.parentNode;
    const key = (typeof nextWidgetKey === 'function') ? nextWidgetKey('z') : 'z0';
    const spec = zoneSpec(code.textContent);
    const zone = {
      spec: spec, key: key, sheet: null, ui: null, card: null, touched: false,
      solved: (typeof activityDone === 'function' && typeof lessonWidgetId !== 'undefined')
        ? activityDone(lessonWidgetId, key) : false,
      chat: [], greeted: false
    };
    zoneRegistry.push(zone);

    const cell = document.createElement('div'); cell.className = 'zone-cover';
    const open = (typeof blockAction === 'function') ? blockAction('Open the zone', 'play')
      : (function () { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Open the zone'; return b; })();
    const done = document.createElement('span'); done.className = 'ch-solved'; done.hidden = true;
    const head = (typeof blockHeader === 'function')
      ? blockHeader('Building zone', spec.title || 'Your own game', '', open)
      : document.createElement('div');
    if (typeof blockSide === 'function') blockSide(head).insertBefore(done, open);
    cell.appendChild(head);
    if (spec.intro) {
      const p = document.createElement('p'); p.className = 'zone-cover-intro';
      p.innerHTML = (typeof inlineMd === 'function') ? inlineMd(spec.intro) : esc(spec.intro);
      cell.appendChild(p);
    }
    if ((spec.goals || []).length) {
      const ul = document.createElement('ul'); ul.className = 'zone-cover-goals';
      spec.goals.forEach(function (g) {
        const li = document.createElement('li'); li.textContent = g.say || g.slot || ''; ul.appendChild(li);
      });
      cell.appendChild(ul);
    }
    zone.card = { open: open, done: done };
    paintZoneCover(zone);
    open.addEventListener('click', function () { openZone(zone); });
    pre.parentNode.replaceChild(cell, pre);
  });
  /* First arrival goes straight in. `zoneAutoOpened` is per lesson-render, so re-selecting the
     lesson opens it again but closing it does not bounce the student back inside. */
  if (zoneRegistry.length && !zoneAutoOpened) {
    zoneAutoOpened = true;
    const z = zoneRegistry[0];
    if (!z.solved) setTimeout(function () { if (!openZoneRef) openZone(z); }, 60);
  }
}
let zoneAutoOpened = false;
function resetZoneAutoOpen() { zoneAutoOpened = false; }

/* The zone's declaration, out of the fenced block. Same YAML reader every other widget uses, so
   the quoting rules an author already knows apply here too. */
function zoneSpec(src) {
  const y = (typeof parseWidgetYaml === 'function') ? parseWidgetYaml('zone', src, 'z') : {};
  const goals = Array.isArray(y.goals) ? y.goals.filter(function (g) { return g && typeof g === 'object'; }) : [];
  const slots = Array.isArray(y.slots) ? y.slots.map(String) : [];
  const prompts = {};
  if (y.prompts && typeof y.prompts === 'object') {
    Object.keys(y.prompts).forEach(function (k) { prompts[zoneSlotKey(k)] = String(y.prompts[k]); });
  }
  return {
    title: y.title || '', intro: y.intro || '', brief: y.brief || '',
    opener: y.opener || '', reward: y.reward || '',
    slots: slots, prompts: prompts, goals: goals
  };
}

/* ---------- the bot in the room ----------
   Same dock, same bubbles, same input row as the assistant in the shell and the tutor in the bench.
   Reached at runtime rather than at load because js/ai.js is loaded after this file, which is the
   trap the bench's own wiring documents: a load-time call slides past the typeof guard and leaves
   the textarea not growing, with nothing to show that it failed. */
function zoneSay(who, text) {
  if (!who) return null;                                  // called with nothing = "just look again"
  const body = $('zoneBotBody'); if (!body) return null;
  const el = document.createElement('div');
  el.className = 'msg ' + who;
  if (who === 'bot' && typeof mdToSafeHTML === 'function') {
    try { el.innerHTML = mdToSafeHTML(text); } catch (e) { el.textContent = String(text); }
  } else el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}

/* A suggestion the student can accept into a slot. This is the thing that makes the bot part of the
   workspace rather than a chat next to it: it does not tell them what to type, it offers a wording
   and puts it in the box. Accepting is one press, and rewording it is the other — because a
   sentence a child pressed a button to accept is not yet theirs, and the second button is how they
   get to make it so. */
function zoneOffer(zone, offer) {
  const body = $('zoneBotBody'); if (!body || !offer) return;
  const card = document.createElement('div'); card.className = 'zone-offer';
  card.innerHTML = '<div class="zone-offer-lab">goes in &ldquo;' + esc(offer.heading.replace(/\.+$/, '')) + '&rdquo;</div>'
    + '<p></p><div class="zone-offer-acts"></div>';
  card.querySelector('p').textContent = offer.text;
  const acts = card.querySelector('.zone-offer-acts');
  const put = document.createElement('button'); put.className = 'zone-mini go'; put.textContent = 'Put it in the box';
  const mine = document.createElement('button'); mine.className = 'zone-mini alt'; mine.textContent = 'Let me word it';
  acts.appendChild(put); acts.appendChild(mine);

  const land = function (focusIt) {
    const slot = sheetSlot(zone.sheet, offer.heading);
    if (!focusIt) { slot.answer = offer.text; sheetWrite(zone.sheet); }
    zone.touched = true;
    paintZoneBoard(zone); paintZoneGoals(zone);
    acts.innerHTML = '<span class="zone-offer-done">' + (focusIt ? 'over to you' : 'in the box') + '</span>';
    if (focusIt) {
      /* Open the card for editing, seeded with their own words rather than the bot's. The offer is
         still on screen above, so they can read it while they write their version. */
      const cards = $('zoneBody').querySelectorAll('.zone-card');
      for (let i = 0; i < cards.length; i++) {
        if (cards[i].getAttribute('aria-label').indexOf(offer.heading.replace(/\.+$/, '')) === 0) { cards[i].click(); break; }
      }
    }
  };
  put.addEventListener('click', function () { land(false); });
  mine.addEventListener('click', function () { land(true); });
  body.appendChild(card);
  body.scrollTop = body.scrollHeight;
}

function zoneBotReset(zone) {
  const body = $('zoneBotBody'); if (body) body.innerHTML = '';
  zone.greeted = false;
  zone.chat = [];
  const tag = $('zoneBotTag');
  if (tag) {
    const spec = (typeof aiModels !== 'undefined' && (aiModels['zone-coach'] || aiModels.tutor)) || '';
    tag.textContent = spec.replace(/^[^:]+:/, '') || '…';
    tag.title = spec;
  }
  wireZoneChatBox();
}

/* The bot speaks first, and it speaks about what is actually missing. This is the whole difference
   between this and the dock: "80% don't know what to make" is the documented failure mode this
   module exists for, and a helper that waits to be asked is no help to any of them. */
function zoneBotOpen(zone) {
  if (zone.greeted) return;
  zone.greeted = true;
  const empty = (zone.spec.slots || []).filter(function (h) { return !sheetSlot(zone.sheet, h).answer; });
  const hello = zone.spec.opener
    || 'This is your zone — the board on the left is your game, not ours. I ask questions and I will '
       + 'not write it for you.';
  zoneSay('bot', hello);
  if (empty.length) {
    zoneAsk(zoneNudge(zone, empty), { silent: true });
  } else if (typeof loadQuestions === 'function' && typeof renderStarters === 'function') {
    loadQuestions().then(function () {
      renderStarters('zone', $('zoneBotBody'), function (t) { zoneSubmitText(t); }, 'tutor');
    });
  }
}
/* What to open on. The first empty box, named — a question about a specific box is answerable, and
   "what would you like to talk about" is not. */
function zoneNudge(zone, empty) {
  return 'The student has just opened this zone. ' + empty.length + ' of the '
    + (zone.spec.slots || []).length + ' boxes are still empty; the first is "' + empty[0]
    + '". Ask them one short question that would fill that box. Do not greet them again.';
}

function zoneSubmitText(t) {
  const box = $('zoneBotText');
  if (box) { box.value = t; if (typeof growTextarea === 'function') growTextarea(box); }
  zoneSubmit();
}
function zoneSubmit() {
  const box = $('zoneBotText'); if (!box) return;
  const q = box.value.trim(); if (!q) return;
  box.value = '';
  if (typeof growTextarea === 'function') growTextarea(box);
  zoneAsk(q);
}

/* One call per turn. The reply is prose, optionally carrying a wording for one box — see
   ai/zone-check.js for why that arrives as a trailing line rather than as JSON mixed into prose. */
function zoneAsk(question, opts) {
  const zone = openZoneRef; if (!zone || !question) return;
  const silent = !!(opts && opts.silent);
  if (!silent) zoneSay('user', question);
  const pending = zoneSay('bot', 'Thinking…');
  if (pending && typeof startThinking === 'function') startThinking(pending, 'zone');
  if (typeof setChatBusy === 'function') setChatBusy($('zoneBotText'), true);
  const history = zone.chat.slice(-6);
  if (!silent) zone.chat.push({ role: 'user', content: question });

  fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: (typeof studentId !== 'undefined' ? studentId : ''),
      agent: 'zone-coach', message: question, history: history,
      zone: zonePayload(zone),
      lessonTitle: (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx].l.t : ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (openZoneRef !== zone) return;
      const reply = (d && d.reply) || '—';
      if (pending) {
        if (typeof stopThinking === 'function') stopThinking(pending);
        if (typeof mdToSafeHTML === 'function') {
          try { pending.innerHTML = mdToSafeHTML(reply); } catch (e) { pending.textContent = reply; }
        } else pending.textContent = reply;
      }
      zone.chat.push({ role: 'assistant', content: reply });
      if (d && d.slot && d.slot.heading && d.slot.text) zoneOffer(zone, d.slot);
    })
    .catch(function () {
      if (pending) { if (typeof stopThinking === 'function') stopThinking(pending); pending.textContent = 'Could not reach the helper.'; }
    })
    .finally(function () { if (typeof setChatBusy === 'function') setChatBusy($('zoneBotText'), false); });
}

/* What the model is told about the zone. The board, as it stands — every declared box with whatever
   is in it — plus the goals and their state, so it can talk about what is left rather than guessing.
   A dedicated `zone` object rather than stray fields, because the bench learned that the hard way:
   context sent under a name the prompt does not use is dropped silently by fill() and the model
   answers confidently about something else. */
function zonePayload(zone) {
  const boxes = (zone.spec.slots || []).map(function (h) {
    return { heading: h, text: sheetSlot(zone.sheet, h).answer || '' };
  });
  return {
    title: zone.spec.title || '',
    brief: zone.spec.brief || '',
    boxes: boxes,
    goals: (zone.spec.goals || []).map(function (g) {
      return { say: g.say || g.slot || '', done: zoneGoalDone(zone, g) };
    })
  };
}

/* The sign-off. A separate agent with a separate contract, for the same reason the grader is not
   the tutor: this one answers yes or no about somebody's work, and an agent that mostly chats is
   the wrong thing to ask. Anything other than an explicit refusal passes. */
function zoneSignOff(zone) {
  return fetch('/api/ai', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: (typeof studentId !== 'undefined' ? studentId : ''),
      agent: 'zone-check',
      message: 'The student says this zone is finished. Decide whether the boxes have real answers in them.',
      zone: zonePayload(zone),
      lessonTitle: (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx].l.t : ''
    })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) { return (d && d.result && typeof d.result.pass === 'boolean') ? d.result : null; })
    .catch(function () { return null; });          // unreachable is not a refusal
}

let zoneChatWired = false;
function wireZoneChatBox() {
  if (zoneChatWired || typeof wireChatBox !== 'function') return;
  zoneChatWired = true;
  wireChatBox($('zoneBotText'), zoneSubmit);
}

/* ---------- wiring, once, at load ---------- */
if ($('zoneBotForm')) $('zoneBotForm').addEventListener('submit', function (e) { e.preventDefault(); zoneSubmit(); });
if ($('zoneBack')) $('zoneBack').addEventListener('click', closeZone);
if ($('zoneDone')) $('zoneDone').addEventListener('click', finishZone);
if ($('zoneBotHide')) $('zoneBotHide').addEventListener('click', function () {
  $('zoneBot').hidden = true;
  const b = $('zoneBotBtn'); if (b) { b.hidden = false; b.setAttribute('aria-expanded', 'false'); }
});
if ($('zoneBotBtn')) $('zoneBotBtn').addEventListener('click', function () {
  $('zoneBot').hidden = false;
  const b = $('zoneBotBtn'); if (b) { b.hidden = true; b.setAttribute('aria-expanded', 'true'); }
  const t = $('zoneBotText'); if (t) t.focus();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && openZoneRef) { closeZone(); e.preventDefault(); }
});
