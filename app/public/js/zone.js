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
   A goal is a check against the student's real work, never a box they tick. Two kinds, because the
   two furnitures answer different questions:

     slot:   that heading on the board has an answer under it       (sheet zones)
     check:  a list of rules against their real project             (build zones)

   `check:` is the practice checker's own rule set — contains, config_changed, function_added,
   called_in_update, parses, all of it — so a build objective is checked by the same code that
   checks a your-turn step, and an author who can write one can already write the other. */
function zoneGoalDone(zone, goal) {
  if (Array.isArray(goal.check) && goal.check.length) {
    if (typeof practiceRuleResult !== 'function') return false;
    return goal.check.every(function (rule) {
      const r = practiceRuleResult(rule, zone.snap || null);
      return !!(r && r.ok);
    });
  }
  if (goal.slot === '*' || goal.slot === 'all') {
    return (zone.spec.slots || []).every(function (h) { return !!sheetSlot(zone.sheet, h).answer; });
  }
  if (goal.slot) return !!sheetSlot(zone.sheet, goal.slot).answer;
  return false;
}
/* Which objective is live. A build zone runs its objectives IN ORDER — one at a time, the next
   unlocking when the last is done. "Here are five things, go" is the shape that loses a
   thirteen-year-old, and a guide can only brief you on one thing at a time anyway. */
function zoneActiveIndex(zone) {
  const goals = zone.spec.goals || [];
  for (let i = 0; i < goals.length; i++) if (!zoneGoalDone(zone, goals[i])) return i;
  return -1;
}
function zoneProgress(zone) {
  const goals = zone.spec.goals || [];
  let n = 0;
  goals.forEach(function (g) { if (zoneGoalDone(zone, g)) n++; });
  return { done: n, total: goals.length };
}
function paintZoneGoals(zone) {
  const host = $('zoneGoals'); if (!host) return;
  const build = zone.spec.kind === 'build';
  const active = build ? zoneActiveIndex(zone) : -1;
  host.innerHTML = '';
  (zone.spec.goals || []).forEach(function (g, i) {
    const done = zoneGoalDone(zone, g);
    /* In a build zone the rail is a quest chain: done behind you, one live, the rest still ahead
       and deliberately dim. Seeing what is coming is part of the fun; being able to start any of
       them is not, because the order is the teaching. */
    const ahead = build && !done && i !== active;
    const el = document.createElement('span');
    el.className = 'zone-goal' + (done ? ' on' : '') + (i === active ? ' now' : '') + (ahead ? ' ahead' : '');
    el.setAttribute('role', 'listitem');
    el.innerHTML = '<span class="zone-tick" aria-hidden="true">' + (done ? '&#10003;' : (build ? (i + 1) : '')) + '</span>'
      + '<span>' + esc(g.say || g.slot || '') + '</span>'
      + '<span class="sr-only">' + (done ? ' — done' : (i === active ? ' — this one now' : ' — not done yet')) + '</span>';
    host.appendChild(el);
  });
  const p = zoneProgress(zone);
  const cnt = $('zoneCount'), bar = $('zoneProg'), btn = $('zoneDone');
  if (cnt) cnt.textContent = p.total ? p.done + ' of ' + p.total + ' done' : '';
  if (bar) bar.style.width = (p.total ? Math.round(100 * p.done / p.total) : 0) + '%';
  if (btn) {
    const ready = p.total > 0 && p.done >= p.total;
    btn.disabled = !ready || zone.solved;
    btn.textContent = zone.solved ? 'Finished'
      : ready ? 'Finish the checkpoint'
      : (build ? 'Objectives first' : 'Fill the boxes first');
  }
}

/* ---------- tools ----------
   A board of boxes and a bot is a good workspace and a slightly solemn one. Each zone also gets a
   thing to PLAY with, sitting above the cards — and each one is a real tool rather than decoration:
   it does the job that zone's lessons just taught, and it writes its result into a box.

   Declared per zone in the ```zone block, so what a tool says is content:

       tools:
         - kind: mixer
           into: My game is
           bases: [a platformer, a climbing game]
           twists: ['but the floor vanishes behind you']

   Adding a kind means adding a function here. Same shape as demos.js: named from content, written
   in code, and `check-lessons.js` refuses a `kind:` that does not exist so a typo is a failed build
   rather than a silently missing tool. */
const ZONE_TOOLS = {

  /* The blank page, attacked directly. Two lists and a shuffle — the point is not that the machine
     has a good idea, it is that reading three bad ones makes you say "no, but what about…", which
     is the whole trick and the thing a stuck eleven-year-old cannot do from nothing. */
  mixer: function (zone, t, host) {
    const bases = (t.bases || []).length ? t.bases : ['a platformer', 'a racing game', 'a collecting game'];
    const twists = (t.twists || []).length ? t.twists : ['but you only get one life', 'but you cannot stop moving'];
    const out = document.createElement('div'); out.className = 'zone-tool-out';
    const roll = zoneToolButton('Give me three', 'mdi-dice-5');
    let seen = 0;
    roll.addEventListener('click', function () {
      out.innerHTML = '';
      const picks = [];
      for (let i = 0; i < 3 && picks.length < 3; i++) {
        const p = bases[(Math.random() * bases.length) | 0] + ' ' + twists[(Math.random() * twists.length) | 0];
        if (picks.indexOf(p) < 0) picks.push(p);
      }
      picks.forEach(function (p) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'zone-pitch'; b.textContent = p;
        b.addEventListener('click', function () {
          const slot = sheetSlot(zone.sheet, t.into || zone.spec.slots[0]);
          slot.answer = p.charAt(0).toUpperCase() + p.slice(1) + '.';
          zone.touched = true;
          sheetWrite(zone.sheet);
          paintZoneBoard(zone); paintZoneGoals(zone);
          zoneSay('bot', 'In the box — now make it yours. Click the card and change a word, or tell me what is wrong with it.');
        });
        out.appendChild(b);
      });
      const again = document.createElement('p'); again.className = 'zone-tool-hint';
      again.textContent = (++seen > 1)
        ? 'Still nothing? The one you hate is useful too — what is wrong with it?'
        : 'Click one to start from it. You are meant to change it afterwards.';
      out.appendChild(again);
    });
    host.appendChild(roll); host.appendChild(out);
  },

  /* The test the lesson names, made pressable. A one-sheet is finished when somebody else could
     build the right game from it, and the cheapest way to find out is to stop reading it as the
     person who wrote it. Reading it back as one paragraph does that surprisingly well. */
  readback: function (zone, t, host) {
    const out = document.createElement('div'); out.className = 'zone-tool-out';
    const go = zoneToolButton('Read it back to me', 'mdi-text-box-outline');
    go.addEventListener('click', function () {
      const said = (zone.spec.slots || []).map(function (h) {
        return { h: h, a: sheetSlot(zone.sheet, h).answer };
      }).filter(function (x) { return x.a; });
      out.innerHTML = '';
      if (!said.length) {
        out.innerHTML = '<p class="zone-tool-hint">Nothing in the boxes yet — fill one in and press this again.</p>';
        return;
      }
      const p = document.createElement('p'); p.className = 'zone-readback';
      p.textContent = said.map(function (x) { return x.a.replace(/\s+$/, '').replace(/\.?$/, '.'); }).join(' ');
      out.appendChild(p);
      const miss = (zone.spec.slots || []).filter(function (h) { return !sheetSlot(zone.sheet, h).answer; });
      const note = document.createElement('p'); note.className = 'zone-tool-hint';
      /* Quoted rather than lowercased into the sentence. Lowercasing turned "What I cut" into
         "what i cut", and it also stopped the names matching the cards they refer to. */
      note.textContent = miss.length
        ? 'A stranger reading that would still have to ask about: '
          + miss.map(function (h) { return '“' + h.replace(/\.+$/, '') + '”'; }).join(', ') + '.'
        : 'That is your whole game. Read it out loud — if you stumble, the sentence you stumbled on is the one to fix.';
      out.appendChild(note);
    });
    host.appendChild(go); host.appendChild(out);
  },

  /* Scope, as arithmetic you can drag. The lesson makes the argument; this makes it personal, and
     it will not let them cheat: the weeks are fixed and the sizes are fixed, so the only thing that
     can move is the list. Which is the entire point. */
  budget: function (zone, t, host) {
    const weeks = Number(t.weeks) || 10;
    const COST = { S: 1, M: 2, L: 4 };
    const intoSlot = t.into || 'What I am NOT building';
    /* Seeded from the box, so a student who has already written a cut list sees it here instead of
       an empty tool, and closing the zone loses nothing. */
    if (!zone.budget) {
      zone.budget = (sheetSlot(zone.sheet, intoSlot).answer || '')
        .split(/[,\n]+/).map(function (s) { return s.trim().replace(/\.$/, ''); })
        .filter(Boolean).slice(0, 12)
        .map(function (s) { return { name: s, size: 'M', building: false }; });
    }
    const wrap = document.createElement('div'); wrap.className = 'zone-budget';
    host.appendChild(wrap);

    const draw = function () {
      const spent = zone.budget.filter(function (i) { return i.building; })
        .reduce(function (n, i) { return n + COST[i.size]; }, 0);
      const over = spent > weeks;
      wrap.innerHTML = '';
      const meter = document.createElement('div'); meter.className = 'zone-meter' + (over ? ' over' : '');
      meter.innerHTML = '<span class="zone-meter-bar"><i style="width:'
        + Math.min(100, Math.round(100 * spent / weeks)) + '%"></i></span>'
        + '<span class="zone-meter-say">' + spent + ' of ' + weeks + ' weeks'
        + (over ? ' — ' + (spent - weeks) + ' over. Something here is not getting built.' : '') + '</span>';
      wrap.appendChild(meter);

      const list = document.createElement('div'); list.className = 'zone-budget-list';
      zone.budget.forEach(function (item, i) {
        const row = document.createElement('div'); row.className = 'zone-budget-row' + (item.building ? ' on' : '');
        const name = document.createElement('span'); name.className = 'zone-budget-name'; name.textContent = item.name;
        const size = document.createElement('button');
        size.type = 'button'; size.className = 'zone-budget-size'; size.textContent = item.size;
        size.title = 'How big is it? S = a week, M = two, L = four';
        size.addEventListener('click', function () {
          item.size = item.size === 'S' ? 'M' : (item.size === 'M' ? 'L' : 'S'); draw();
        });
        const swap = document.createElement('button');
        swap.type = 'button'; swap.className = 'zone-budget-swap';
        swap.textContent = item.building ? 'Building' : 'Next time';
        swap.addEventListener('click', function () { item.building = !item.building; draw(); });
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'zone-budget-del'; del.innerHTML = '<span class="mdi mdi-close"></span>';
        del.title = 'Take it off the list';
        del.addEventListener('click', function () { zone.budget.splice(i, 1); draw(); });
        row.appendChild(size); row.appendChild(name); row.appendChild(swap); row.appendChild(del);
        list.appendChild(row);
      });
      wrap.appendChild(list);

      const add = document.createElement('form'); add.className = 'zone-budget-add';
      add.innerHTML = '<input placeholder="Something you want in your game…" maxlength="60" aria-label="Add an idea">';
      const plus = zoneToolButton('Add', 'mdi-plus');
      add.appendChild(plus);
      add.addEventListener('submit', function (e) {
        e.preventDefault();
        const box = add.querySelector('input'); const v = box.value.trim();
        if (!v || zone.budget.length >= 14) return;
        zone.budget.push({ name: v, size: 'M', building: true });
        box.value = ''; draw(); add.querySelector('input').focus();
      });
      wrap.appendChild(add);

      const cut = zone.budget.filter(function (i) { return !i.building; });
      const save = zoneToolButton('Put the "next time" list in the box', 'mdi-tray-arrow-down');
      save.disabled = !cut.length;
      save.addEventListener('click', function () {
        sheetSlot(zone.sheet, intoSlot).answer = cut.map(function (i) { return i.name; }).join(', ') + '.';
        zone.touched = true;
        sheetWrite(zone.sheet);
        paintZoneBoard(zone); paintZoneGoals(zone);
      });
      wrap.appendChild(save);
    };
    draw();
  }
};

function zoneToolButton(label, icon) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'zone-tool-btn';
  b.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>' + esc(label);
  return b;
}

/* Tools are painted once per zone opening, not on every board repaint — a tool holding a shuffle
   the student is reading, or half a typed item, must not be thrown away because a card elsewhere
   was edited. */
function paintZoneTools(zone) {
  const host = $('zoneTools'); if (!host) return;
  host.innerHTML = '';
  (zone.spec.tools || []).forEach(function (t) {
    const fn = ZONE_TOOLS[t.kind];
    if (!fn) { console.warn('[league] zone tool "' + t.kind + '" does not exist — see ZONE_TOOLS in js/zone.js'); return; }
    const box = document.createElement('section'); box.className = 'zone-tool';
    const hd = document.createElement('h3'); hd.className = 'zone-tool-hd';
    hd.textContent = t.title || t.kind;
    box.appendChild(hd);
    if (t.say) { const p = document.createElement('p'); p.className = 'zone-tool-say'; p.textContent = t.say; box.appendChild(p); }
    try { fn(zone, t, box); } catch (e) { console.warn('[league] zone tool "' + t.kind + '" failed: ' + e.message); return; }
    host.appendChild(box);
  });
}

/* ---------- the board ----------
   One card per slot, all of them on screen at once. That is the whole reason this is a board and
   not a form: the empty ones are visible next to the full ones, which is the only way an
   eleven-year-old can see what is left without being told. */
function paintZoneBoard(zone) {
  const host = $('zoneBoard'); if (!host) return;
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

/* ---------- build zones ----------
   The other furniture. A sheet zone is a board of things the student decides; a build zone is their
   real game running next to their real code, because "make this mechanic run" cannot be answered in
   a text box and "what is your game about" cannot be answered in a code editor.

   Everything here drives the SAME project the Code tab does — `project.files`, saved through
   saveProject. Not a copy: a workspace that edited a copy would send them back to the Code tab to
   do it again, and the goals check their real project, so a copy would never tick. */
let zoneEditor = null;

function zoneBuildOpen(zone) {
  const files = (typeof codeFileNames === 'function' ? codeFileNames() : []);
  const pick = $('zoneFile');
  pick.innerHTML = '';
  files.forEach(function (n) {
    const o = document.createElement('option'); o.value = n; o.textContent = n; pick.appendChild(o);
  });
  /* Start on the file the zone says the work is in. An author knows which file this checkpoint is
     about, and opening on config.js when the task is in world.js costs a student the first minute. */
  const want = zone.spec.file && files.indexOf(zone.spec.file) >= 0 ? zone.spec.file : (files[0] || '');
  pick.value = want;
  zoneOpenFile(zone, want);
  pick.onchange = function () { zoneSaveFile(zone); zoneOpenFile(zone, pick.value); };
}

function zoneOpenFile(zone, name) {
  const host = $('zoneEditor'); if (!host) return;
  zone.file = name;
  host.innerHTML = '';
  const text = (project.files[name] != null) ? project.files[name] : '';
  if (typeof CodeMirror === 'function') {
    zoneEditor = CodeMirror(host, {
      value: text, mode: 'javascript', theme: 'material-darker',
      lineNumbers: true, tabSize: 2, indentUnit: 2, matchBrackets: true, autoCloseBrackets: true,
      extraKeys: {
        'Ctrl-S': function () { zoneSaveFile(zone); }, 'Cmd-S': function () { zoneSaveFile(zone); },
        'Ctrl-Enter': function () { zoneRunGame(zone); }, 'Cmd-Enter': function () { zoneRunGame(zone); }
      }
    });
    // Saved on blur as well as on the button, the same as the bench: a student who types and then
    // reaches for Run should not lose the thing they were about to run.
    zoneEditor.on('blur', function () { zoneSaveFile(zone); });
    setTimeout(function () { if (zoneEditor) zoneEditor.refresh(); }, 0);
  } else {
    const ta = document.createElement('textarea'); ta.className = 'zone-editor-plain'; ta.value = text;
    host.appendChild(ta);
    zoneEditor = { getValue: function () { return ta.value; }, refresh: function () {} };
    ta.addEventListener('blur', function () { zoneSaveFile(zone); });
  }
}

function zoneSaveFile(zone) {
  if (!zoneEditor || !zone || !zone.file) return;
  const v = zoneEditor.getValue();
  if (project.files[zone.file] === v) return;
  project.files[zone.file] = v;
  if (typeof saveProject === 'function') saveProject();
  zone.touched = true;
  paintZoneGoals(zone);                 // an objective can be satisfied by typing, not only by running
  zoneWatch(zone);                      // ...and if it just was, the guide says so and hands out the next
  /* The Code tab may be showing this file behind the overlay. Same reason the sheet repaints it:
     leaving a stale copy there invites the student to "fix" it back over what they just wrote. */
  if (typeof currentFile !== 'undefined' && currentFile === zone.file
      && typeof loadCode === 'function' && $('view-code') && !$('view-code').hidden) loadCode();
}

/* Their game, in the zone, built by the Game tab's own builder. The sandbox posture is whatever the
   app's is — see sandboxGame() — so this frame is never more or less exposed than the Game tab, and
   a fix there fixes both. */
function zoneRunGame(zone) {
  zoneSaveFile(zone);
  const host = $('zoneStage'); if (!host || typeof gameDoc !== 'function') return;
  host.innerHTML = '';
  const f = document.createElement('iframe');
  f.setAttribute('title', 'Your game');
  if (typeof sandboxGame === 'function' && sandboxGame()) f.setAttribute('sandbox', 'allow-scripts');
  host.appendChild(f);
  zoneLogClear();
  try { f.srcdoc = gameDoc(); } catch (e) { zoneLogLine('error', 'Could not build your game: ' + e.message); }
  zone.running = true;
  paintZoneRun(zone);
  /* After the run, not before: an objective like "it runs without an error" can only be true once
     it has. Given a moment for the frame to boot and report. */
  setTimeout(function () { if (openZoneRef === zone) zoneWatch(zone); }, 1200);
}
function zoneStopGame(zone) {
  const host = $('zoneStage'); if (host) host.innerHTML = '';
  zone.running = false;
  paintZoneRun(zone);
}
function paintZoneRun(zone) {
  const stop = $('zoneStop'); if (stop) stop.disabled = !zone.running;
  const run = $('zoneRun'); if (run) run.title = zone.running ? 'Run it again' : 'Run it';
}

/* The game's console, in the zone. A build checkpoint is where a student's own code goes wrong for
   the first time, and the whole of the last Phaser lesson was about reading the error — so the
   error has to be somewhere they can see it without leaving. */
function zoneLogClear() { const b = $('zoneLog'); if (b) b.innerHTML = ''; }
function zoneLogLine(level, text) {
  const b = $('zoneLog'); if (!b) return;
  const el = document.createElement('div'); el.className = 'zone-log-line ' + level;
  el.textContent = text;
  b.appendChild(el);
  while (b.childElementCount > 60) b.removeChild(b.firstChild);
  b.scrollTop = b.scrollHeight;
}
/* The game frame posts its console through, the same shape the Game tab's capture uses. Bound once
   and filtered on whether a zone is open, so it cannot fight the Game tab's own dock. */
window.addEventListener('message', function (e) {
  const d = e && e.data;
  if (!d || !d.__gamelog || !openZoneRef || !openZoneRef.running) return;
  const text = String(d.text || '');
  zoneLogLine(d.level || 'log', text);
  /* One known failure, named once, because otherwise it reads as the student's bug.
     A sandboxed frame has an opaque origin, and an opaque-origin document cannot make ANY
     subresource request back to the app — measured: allow-scripts fails, allow-scripts
     allow-same-origin works, no sandbox works, and there is no CSP violation, the CORP header is
     already cross-origin, and the file serves 200 without cookies. So Phaser never arrives and
     neither does any asset. It is an app-level issue with DEV.sandboxGame, not anything in their
     game, and a child staring at "Phaser is not defined" in their own checkpoint has no way to
     know that. */
  if (!openZoneRef.blamed && /Phaser is not defined/.test(text)
      && typeof sandboxGame === 'function' && sandboxGame()) {
    openZoneRef.blamed = true;
    zoneLogLine('warn', 'That one is not your code — the game frame cannot load Phaser while it is '
      + 'sandboxed. Add ?sandbox=0 to the address and reload to run it.');
  }
});

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
  /* Which furniture. A build zone's objectives are checked against the project as it was when they
     ARRIVED — config_changed and function_added both need a "before", and taking it on open rather
     than on first check means a student who tunes a number before reading anything still gets
     credit for it. practiceSnapshot stores it, so it survives closing the zone. */
  const build = zone.spec.kind === 'build';
  $('zoneSheet').hidden = build;
  $('zoneBuild').hidden = !build;
  if (build) {
    if (typeof practiceSnapshot === 'function' && typeof lessonWidgetId !== 'undefined') {
      zone.snap = practiceSnapshot(lessonWidgetId, zone.key);
    }
    zoneBuildOpen(zone);
    paintZoneRun(zone);
  } else {
    paintZoneTools(zone);
    paintZoneBoard(zone);
  }
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
  if (zone.spec.kind === 'build') { zoneSaveFile(zone); zoneStopGame(zone); }
  zoneEditor = null;
  $('zoneEditor').innerHTML = '';
  $('zoneStage').innerHTML = '';
  zoneLogClear();
  openZoneRef = null;
  zone.ui = null;
  const bot = $('zoneBot'); if (bot) bot.hidden = false;   // back to its default for next time
  $('zoneBotBody').innerHTML = '';
  $('zoneBoard').innerHTML = '';
  $('zoneTools').innerHTML = '';
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
   The door. Not a lesson page with a box on it and not a summary of one: the only things on it are
   what this zone wants and the way in.

   It reads design.md every time it paints, so the checklist is LIVE. That is the whole point of it
   being a door rather than a poster — a student coming back to a half-finished zone can see from
   the outside what is left, and one arriving at Your One-Sheet can see that two boxes are already
   answered from the checkpoint before it. */
function paintZoneCover(zone) {
  const k = zone.card; if (!k) return;
  const sheet = sheetRead();
  const goals = zone.spec.goals || [];
  const state = goals.map(function (g) {
    return { say: g.say || g.slot || '', done: zoneGoalDone({ spec: zone.spec, sheet: sheet }, g) };
  });
  const done = state.filter(function (g) { return g.done; }).length;

  k.list.innerHTML = '';
  state.forEach(function (g) {
    const li = document.createElement('li');
    /* No marker at all until it is done, and then a tick. Two goes at a small circle — a ring with
       a tick in it, then a 6px dot — both read as two different sizes sitting side by side, because
       at that scale antialiasing decides how big a circle looks and the two pills are never the
       same width. A mark that is only ever present in one state cannot be inconsistent with
       anything, and the colour is already carrying the meaning. */
    li.className = 'zone-cover-goal' + (g.done ? ' on' : '');
    li.setAttribute('aria-label', g.say + (g.done ? ' — done' : ' — not done yet'));
    li.innerHTML = (g.done ? '<span class="zone-cover-tick" aria-hidden="true">&#10003;</span>' : '')
      + '<span>' + esc(g.say) + '</span>';
    k.list.appendChild(li);
  });

  k.open.innerHTML = '<span class="mdi ' + (zone.solved ? 'mdi-flag-checkered' : 'mdi-arrow-right')
    + '" aria-hidden="true"></span>'
    + (zone.solved ? 'Open Checkpoint again' : (done ? 'Carry on' : 'Open Checkpoint'));
  k.open.classList.toggle('again', !!zone.solved);

  /* The count is only worth saying while it is neither nothing nor everything. "0 of 5" beside an
     empty checklist is the checklist said twice, and "5 of 5" is what the tick is for. */
  k.note.textContent = zone.solved ? '✓ Finished'
    : (done && done < goals.length ? done + ' of ' + goals.length + ' already done' : '');
  k.note.className = 'zone-cover-note' + (zone.solved ? ' done' : '');
}

/* Build the door from the lesson's ```zone block.
   It does NOT open the zone by itself. Auto-opening was tried and taken back out: a full-window
   workspace that appears the instant you touch a row in the sidebar gives a student no moment to
   see where they have arrived, and it fights the back button — closing it lands you on the page
   that opened it, which then wants to open it again. The door costs one press and answers "what is
   this and what does it want" before it takes the whole window. A /zone URL still goes straight in;
   that one was asked for explicitly. */
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

    /* Deliberately not blockHeader. That builds the header a quiz, lab or practice step wears, and
       the whole point here is that this is not one of those — it is the way into a room. */
    const cell = document.createElement('div'); cell.className = 'zone-cover';
    cell.innerHTML =
      '<div class="zone-cover-kind"><span class="mdi mdi-flag-checkered" aria-hidden="true"></span>Building zone</div>'
      + '<p class="zone-cover-intro"></p>'
      + '<ul class="zone-cover-goals" role="list"></ul>'
      + '<div class="zone-cover-go"></div>';
    const intro = cell.querySelector('.zone-cover-intro');
    if (spec.intro) intro.innerHTML = (typeof inlineMd === 'function') ? inlineMd(spec.intro) : esc(spec.intro);
    else intro.remove();

    const go = cell.querySelector('.zone-cover-go');
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'zone-cover-btn';
    const note = document.createElement('span'); note.className = 'zone-cover-note';
    go.appendChild(open); go.appendChild(note);

    zone.card = { open: open, note: note, list: cell.querySelector('.zone-cover-goals') };
    paintZoneCover(zone);
    open.addEventListener('click', function () { openZone(zone); });
    pre.parentNode.replaceChild(cell, pre);
  });
}

/* The zone's declaration, out of the fenced block. Same YAML reader every other widget uses, so
   the quoting rules an author already knows apply here too. */
function zoneSpec(src) {
  const y = (typeof parseWidgetYaml === 'function') ? parseWidgetYaml('zone', src, 'z') : {};
  const goals = Array.isArray(y.goals) ? y.goals.filter(function (g) { return g && typeof g === 'object'; }) : [];
  const tools = Array.isArray(y.tools) ? y.tools.filter(function (t) { return t && typeof t === 'object' && t.kind; }) : [];
  const slots = Array.isArray(y.slots) ? y.slots.map(String) : [];
  const prompts = {};
  if (y.prompts && typeof y.prompts === 'object') {
    Object.keys(y.prompts).forEach(function (k) { prompts[zoneSlotKey(k)] = String(y.prompts[k]); });
  }
  return {
    // `sheet` unless told otherwise: it is the older kind and the one a zone with slots wants.
    kind: y.kind === 'build' ? 'build' : 'sheet',
    file: y.file || '',
    title: y.title || '', intro: y.intro || '', brief: y.brief || '',
    opener: y.opener || '', reward: y.reward || '',
    slots: slots, prompts: prompts, goals: goals, tools: tools
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
      const cards = $('zoneBoard').querySelectorAll('.zone-card');
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
  const hello = zone.spec.opener
    || 'This is your zone — everything here is about your game, not ours. I ask questions and point '
       + 'at things. I will not write it for you.';
  zoneSay('bot', hello);
  if (zone.spec.kind === 'build') { zoneBrief(zone); return; }
  const empty = (zone.spec.slots || []).filter(function (h) { return !sheetSlot(zone.sheet, h).answer; });
  if (empty.length) {
    zoneAsk(zoneNudge(zone, empty), { silent: true });
  } else if (typeof loadQuestions === 'function' && typeof renderStarters === 'function') {
    loadQuestions().then(function () {
      renderStarters('zone', $('zoneBotBody'), function (t) { zoneSubmitText(t); }, 'tutor');
    });
  }
}

/* ---------- the quest chain ----------
   A build zone is a text adventure with a compiler attached. The objectives are the quest chain,
   the guide is the character who gives them out, and the conversation IS the quest log — which is
   why almost none of this is new UI. It is worth being explicit about why the fun is load-bearing
   rather than decoration: what this replaces is a page of numbered instructions a student reads
   once and then works alone against, and the thing that actually goes wrong there is that nobody
   tells them when they got it right. A chain that announces each objective, watches their real
   project, and says COMPLETE the moment the check passes is the same information with the two
   parts a game would never leave out — one thing at a time, and an answer the instant you do it. */
function zoneObjectiveCard(zone, goal, n) {
  const body = $('zoneBotBody'); if (!body) return;
  const card = document.createElement('div'); card.className = 'zone-quest';
  card.innerHTML = '<div class="zone-quest-lab">Objective ' + n + ' of ' + (zone.spec.goals || []).length + '</div>'
    + '<div class="zone-quest-say"></div>';
  card.querySelector('.zone-quest-say').textContent = goal.say || '';
  body.appendChild(card);
  body.scrollTop = body.scrollHeight;
}
function zoneCompleteCard(zone, goal, n) {
  const body = $('zoneBotBody'); if (!body) return;
  const card = document.createElement('div'); card.className = 'zone-quest done';
  card.innerHTML = '<div class="zone-quest-lab">&#10003; Objective ' + n + ' complete</div>'
    + '<div class="zone-quest-say"></div>';
  card.querySelector('.zone-quest-say').textContent = goal.say || '';
  body.appendChild(card);
  body.scrollTop = body.scrollHeight;
}

/* Hand out the live objective and have the guide brief it against THEIR game. The card is the
   quest; the briefing under it is why this objective exists in their game rather than in general,
   which is the part a printed instruction can never do. */
function zoneBrief(zone) {
  const goals = zone.spec.goals || [];
  const i = zoneActiveIndex(zone);
  if (i < 0) {
    zoneSay('bot', '**Every objective done.** Press Finish the zone when you are happy with it.');
    return;
  }
  if (zone.briefed === i) return;
  zone.briefed = i;
  zoneObjectiveCard(zone, goals[i], i + 1);
  zoneAsk(zoneBriefPrompt(zone, goals[i], i), { silent: true });
}
function zoneBriefPrompt(zone, goal, i) {
  return 'The student has just reached objective ' + (i + 1) + ': "' + (goal.say || '') + '". '
    + (goal.brief ? 'What it is for: ' + goal.brief + ' ' : '')
    + 'Brief them on it in two or three sentences — what to change, in which of THEIR files, and '
    + 'why it matters for the game on their one-sheet. Name the file. Do not write the code. '
    + 'Do not greet them and do not repeat the objective back word for word.';
}

/* Re-check after anything that could have satisfied the live objective, and make a noise when it
   has. Called from the editor's save and from Run. */
function zoneWatch(zone) {
  if (!zone || zone.spec.kind !== 'build') return;
  const goals = zone.spec.goals || [];
  const was = typeof zone.briefed === 'number' ? zone.briefed : -1;
  const now = zoneActiveIndex(zone);
  if (now === was) return;                       // nothing moved
  if (was >= 0 && was < goals.length && zoneGoalDone(zone, goals[was])) {
    zoneCompleteCard(zone, goals[was], was + 1);
  }
  paintZoneGoals(zone);
  zoneBrief(zone);
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
  const build = zone.spec.kind === 'build';
  /* A build zone has no board of its own, so what goes over as "boxes" is their ONE-SHEET — the
     game they said they were making. That is the whole point of the guide in a build zone: it is
     the only thing in the app that can say "your sheet says the platforms vanish, so start in
     world.js", and it cannot say it without the sheet. */
  const headings = build
    ? sheetRead().slots.filter(function (s) { return s.answer; }).map(function (s) { return s.heading; })
    : (zone.spec.slots || []);
  const sheet = build ? sheetRead() : zone.sheet;
  const boxes = headings.map(function (h) {
    return { heading: h, text: sheetSlot(sheet, h).answer || '' };
  });
  const out = {
    kind: zone.spec.kind,
    title: zone.spec.title || '',
    brief: zone.spec.brief || '',
    boxes: boxes,
    goals: (zone.spec.goals || []).map(function (g) {
      return { say: g.say || g.slot || '', done: zoneGoalDone(zone, g) };
    })
  };
  if (build) {
    out.file = zone.file || '';
    out.code = (zoneEditor && typeof zoneEditor.getValue === 'function') ? zoneEditor.getValue()
      : String((project.files || {})[zone.file] || '');
    out.log = zoneLogText();
  }
  return out;
}
function zoneLogText() {
  const b = $('zoneLog'); if (!b) return '';
  return [].slice.call(b.children).slice(-14)
    .map(function (l) { return '[' + (l.className.split(' ')[1] || 'log') + '] ' + l.textContent; })
    .join('\n').slice(0, 1200);
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
if ($('zoneRun')) $('zoneRun').addEventListener('click', function () { if (openZoneRef) zoneRunGame(openZoneRef); });
if ($('zoneStop')) $('zoneStop').addEventListener('click', function () { if (openZoneRef) zoneStopGame(openZoneRef); });
if ($('zoneSave')) $('zoneSave').addEventListener('click', function () {
  if (!openZoneRef) return;
  zoneSaveFile(openZoneRef);
  if (typeof toast === 'function') toast('Saved ✓');
});
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
