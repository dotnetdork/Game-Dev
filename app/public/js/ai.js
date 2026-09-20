/* ai.js — The AI panel: chat rendering, the Tutor and Build (coder) requests to /api/ai, and applying the returned ops to the project. */
/* ---------- AI ---------- */
const aiMsgs = $('aiMsgs');
/* The live message array for each mode. Every other function in this file reads and pushes to
   `chats[mode]` and always has — it is now a VIEW onto the current thread's messages rather than
   the only conversation there is, so threading cost no changes at the call sites. */
const chats = { coder: [], tutor: [] };

/* ---------- conversations ----------
   There was one conversation per mode, it lived only in memory, and a reload threw it away. Two
   things wrong with that, and only one of them is tidiness:

   The reload. Lessons survive a refresh now, so a chat vanishing with it is the odd one out.

   The context. chatHistory() sends the last six turns with every request, so once the assistant has
   gone down a wrong path it keeps being handed the wrong path and stays there. A new conversation
   is the only way to actually clear that, which makes "New chat" a debugging tool rather than
   housekeeping — and the reason its button is somewhere a stuck student will find it.

   Build and Tutor keep entirely separate lists: different assistant, different job, and switching
   modes should not disturb either conversation. */
const CHAT_MAX_THREADS = 12;      // per mode; localStorage is shared with their project
const CHAT_MAX_MSGS = 40;         // per thread, kept from the end
let liveThreads = [];             // [{id, mode, title, lesson, msgs, at}] — msgs may hold proposals

/* One of several, drawn per new chat from content/questions.yaml, and then fixed for that chat.
   Each variant in the pool teaches something different about how to use the panel rather than being
   the same sentence reworded — so a student who starts a few chats across a term picks up the whole
   set without reading a manual.
   The hard-coded pair below is the fallback for the one case the pool cannot cover: a thread created
   before questions.yaml has loaded, or a broken file. Never leaves a chat with no opening line. */
const CHAT_GREETING_FALLBACK = {
  tutor: "Hi! I'm your **Tutor**. Ask me anything about the lesson or the code and I'll explain it — I won't change your game.",
  coder: "Hi! I'm your **Build** helper. Tell me what to change or add to your game — like \"make the player move faster\" — and I'll edit the code.",
  design: "Hi! This board is yours. Tell me about your game, ask me what is missing, or ask me to write some stickies to get you started."
};
function chatGreeting(mode) {
  const pool = ((QUESTIONS || {}).greetings || {})[mode];
  if (Array.isArray(pool) && pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return CHAT_GREETING_FALLBACK[mode] || CHAT_GREETING_FALLBACK.tutor;
}
/* The Design tab shares the Tutor's panel and the Tutor's thread — it is the same assistant, asked
   about a different thing — but it must not open with the Tutor's line. A student who presses
   Design and is greeted with "ask me what a semicolon does" has been told, wrongly, what this tab
   is for. The prompt behind it already changes (aiAgentFor); so does the way it says hello and the
   questions it offers. */
function chatVoice(mode) {
  const onDesign = $('view-design') && !$('view-design').hidden;
  return (mode === 'tutor' && onDesign) ? 'design' : mode;
}
function newThreadId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function threadsFor(mode) {
  return liveThreads.filter(function (t) { return t.mode === mode; }).sort(function (a, b) { return b.at - a.at; });
}
function makeThread(mode) {
  const f = (typeof flat !== 'undefined' && typeof curIdx === 'number') ? flat[curIdx] : null;
  const t = { id: newThreadId(), mode: mode, title: '', lesson: f ? f.l.t : '',
    msgs: [{ who: 'bot', text: chatGreeting(chatVoice(mode)) }], at: Date.now() };
  liveThreads.push(t);
  /* Oldest first out, and only within this mode, so a busy Build history cannot evict the Tutor
     conversation a student is halfway through. */
  const mine = threadsFor(mode);
  if (mine.length > CHAT_MAX_THREADS) {
    const drop = mine.slice(CHAT_MAX_THREADS).map(function (x) { return x.id; });
    liveThreads = liveThreads.filter(function (x) { return drop.indexOf(x.id) < 0; });
  }
  return t;
}
let currentThreadId = { tutor: null, coder: null };
function currentThread(mode) {
  let t = liveThreads.find(function (x) { return x.id === currentThreadId[mode]; });
  if (!t) { t = threadsFor(mode)[0] || makeThread(mode); currentThreadId[mode] = t.id; }
  return t;
}
/* Point chats[mode] at the current thread's own array, so every existing push lands in the right
   conversation without any of them knowing threads exist. */
function bindChat(mode) {
  chats[mode] = currentThread(mode).msgs;
  return chats[mode];
}
function openThread(id) {
  const t = liveThreads.find(function (x) { return x.id === id; });
  if (!t) return;
  currentThreadId[t.mode] = t.id;
  bindChat(t.mode);
  renderChat(t.mode);
  renderChatBar();
  persistChats();
}
function startNewChat() {
  const t = makeThread(aiMode);
  currentThreadId[aiMode] = t.id;
  bindChat(aiMode);
  renderChat(aiMode);
  renderChatBar();
  persistChats();
  const box = $('aiText'); if (box) box.focus();
}
/* Deleting the conversation you are currently in has to leave you somewhere, so it falls back to
   the next most recent in this mode and starts a fresh one if that was the last. Never leaves the
   panel pointing at a thread that no longer exists. */
function deleteThread(id) {
  const t = liveThreads.find(function (x) { return x.id === id; });
  if (!t) return;
  const mode = t.mode;
  liveThreads = liveThreads.filter(function (x) { return x.id !== id; });
  if (currentThreadId[mode] === id) {
    const next = threadsFor(mode)[0];
    currentThreadId[mode] = next ? next.id : null;
    bindChat(mode);                       // creates a greeted thread when that was the last one
    if (mode === aiMode) renderChat(mode);
  }
  renderChatBar();
  persistChats();
}

/* The first thing the student asked, which is what they will recognise it by. */
function threadTitle(t) {
  if (t.title) return t.title;
  const firstAsk = (t.msgs || []).find(function (m) { return m.who === 'user' && m.text; });
  if (!firstAsk) return 'New chat';
  const s = String(firstAsk.text).replace(/\s+/g, ' ').trim();
  return s.length > 52 ? s.slice(0, 52) + '…' : s;
}

/* What goes to disk. Deliberately not the live objects:
   a proposal carries `ops` and the full before/after text of every file it touches. Storing that is
   large, and restoring it is worse than large — accepting a diff computed against code the student
   has since changed would quietly corrupt their game. So a saved proposal keeps its sentence and
   its outcome and nothing else, and comes back as a record with no button. A proposal still pending
   when the page closed is recorded as declined, because it was never applied. */
function persistChats() {
  if (typeof state !== 'object' || !state) return;
  state.chats = {
    current: { tutor: currentThreadId.tutor, coder: currentThreadId.coder },
    threads: liveThreads.map(function (t) {
      return { id: t.id, mode: t.mode, title: threadTitle(t), lesson: t.lesson, at: t.at,
        msgs: (t.msgs || [])
          .filter(function (m) { return m && m.text && m.text !== 'Thinking…'; })
          .slice(-CHAT_MAX_MSGS)
          .map(function (m) {
            if (m.kind === 'proposal') {
              return { who: m.who, kind: 'proposal', text: m.text,
                state: m.state === 'pending' ? 'declined' : m.state };
            }
            return { who: m.who, text: m.text };     // a quiz card degrades to its question text
          })
      };
    })
  };
  if (typeof saveState === 'function') saveState();
}
/* The slim bar. Shows which conversation is open and lists the others for this mode only — a
   student switching to Build should not be offered their Tutor conversations. */
function renderChatBar() {
  const title = $('chatTitle'); if (!title) return;
  title.textContent = threadTitle(currentThread(aiMode));
  const list = $('chatList');
  if (!list) return;
  const mine = threadsFor(aiMode);
  list.innerHTML = '';
  mine.forEach(function (t) {
    /* A div, not a button: it holds a delete button, and a button inside a button is invalid and
       does not receive clicks reliably. Keyboard-reachable by hand instead. */
    const row = document.createElement('div');
    row.className = 'chat-row' + (t.id === currentThreadId[aiMode] ? ' on' : '');
    row.setAttribute('role', 'option');
    row.tabIndex = 0;
    row.setAttribute('aria-selected', String(t.id === currentThreadId[aiMode]));

    const text = document.createElement('span'); text.className = 'cr-text';
    /* textContent, not an escaped string. The title is whatever the student typed, and building
       markup out of it needs an escaper — `esc` lives in pages.js, which the page loads AFTER this
       file, so reaching for it here throws at boot. Two nodes and no escaping needed. */
    const tt = document.createElement('span'); tt.className = 'cr-title'; tt.textContent = threadTitle(t);
    text.appendChild(tt);
    if (t.lesson) {
      const sub = document.createElement('span'); sub.className = 'cr-sub'; sub.textContent = t.lesson;
      text.appendChild(sub);
    }
    row.appendChild(text);

    /* Delete, on hover and on keyboard focus. Kept out of the way rather than absent: a student
       testing the assistant makes throwaway chats constantly, and a list that only grows is a list
       they stop using. */
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'cr-del';
    del.title = 'Delete this chat';
    del.innerHTML = '<span class="mdi mdi-close" aria-hidden="true"></span><span class="sr-only">Delete this chat</span>';
    del.addEventListener('click', function (e) { e.stopPropagation(); deleteThread(t.id); });
    row.appendChild(del);

    const open = function () { closeChatList(); openThread(t.id); };
    row.addEventListener('click', open);
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteThread(t.id); }
    });
    list.appendChild(row);
  });
  if (!mine.length) {
    const p = document.createElement('p'); p.className = 'chat-none'; p.textContent = 'No other chats yet.';
    list.appendChild(p);
  }
}
function closeChatList() {
  const l = $('chatList'), b = $('chatPick');
  if (l) l.hidden = true;
  if (b) b.setAttribute('aria-expanded', 'false');
}
function toggleChatList() {
  const l = $('chatList'), b = $('chatPick');
  if (!l) return;
  const open = l.hidden;
  if (open) renderChatBar();
  l.hidden = !open;
  if (b) b.setAttribute('aria-expanded', String(open));
}
if ($('chatNew')) $('chatNew').addEventListener('click', startNewChat);
if ($('chatPick')) $('chatPick').addEventListener('click', function (e) { e.stopPropagation(); toggleChatList(); });
document.addEventListener('click', function (e) {
  const bar = document.querySelector('.chatbar');
  if (bar && !bar.contains(e.target)) closeChatList();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChatList(); });

/* ---------- three questions to tap instead of typing ----------
   A blank box and a blinking cursor is the hardest interface there is for a child who does not yet
   know what they are allowed to ask. Three real questions show the SHAPE of a good one.

   Drawn at random each time from content/questions.yaml, specific pools first — this lesson's, then
   this module's, then the general ones. Random rather than fixed because the same three chips on
   every lesson stop being read by about the third lesson.

   Only while a chat is new. Once the student has asked something the chips are gone: they are a way
   in, not a menu. */
let QUESTIONS = null;
function loadQuestions() {
  if (QUESTIONS) return Promise.resolve(QUESTIONS);
  return fetch('/content/questions.yaml')
    .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error(String(r.status))); })
    .then(function (src) {
      QUESTIONS = (typeof jsyaml !== 'undefined') ? (jsyaml.load(src) || {}) : {};
      return QUESTIONS;
    })
    /* A missing or broken pool must never cost a student the chat itself. */
    .catch(function () { QUESTIONS = {}; return QUESTIONS; });
}
function shuffled(a) {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
}
/* `scope` is 'lesson' or 'lab'. Takes from the most specific pool first and tops up from the more
   general ones, so a lesson with four of its own shows three of those and a lesson with none still
   shows something sensible rather than nothing.

   `agent` picks the tree. The two are different in kind, not just in wording: the Tutor's chips are
   questions ("why is my score resetting?"), Build's are instructions ("move my score variable out of
   the loop"). Offering a Build chip that reads like a question teaches a child that the two panels
   are interchangeable, which is the most expensive misconception this app could hand out. Build has
   no lab tier because Build is off inside a lab bench. */
function pickQuestions(scope, n, agent) {
  const q = QUESTIONS || {};
  /* The design tree has one tier and no lesson tiers on purpose: the board is the same board on
     every lesson and belongs to the student rather than to the page they came from, so a chip keyed
     to where they happen to be standing would be answering a question nobody asked. */
  if (agent === 'design') return shuffled(((q.design || {}).any) || []).slice(0, n);
  /* Falls back to the whole file if the agent trees are missing, so an older or half-edited
     questions.yaml still produces chips instead of nothing. */
  const t = q[agent === 'coder' ? 'coder' : 'tutor'] || q;
  const f = (typeof flat !== 'undefined' && typeof curIdx === 'number') ? flat[curIdx] : null;
  const lessonId = f ? (f.l.id || '') : '';
  const moduleName = f ? f.m.name : '';
  const tiers = scope === 'lab'
    ? [(t.labs || {})[lessonId], (t.lessons || {})[lessonId], (t.modules || {})[moduleName]]
    : [(t.lessons || {})[lessonId], (t.modules || {})[moduleName], t.any];
  const out = [];
  tiers.concat([t.any]).forEach(function (pool) {
    if (out.length >= n || !Array.isArray(pool)) return;
    shuffled(pool).forEach(function (s) {
      if (out.length < n && typeof s === 'string' && out.indexOf(s) < 0) out.push(s);
    });
  });
  return out;
}
/* Rendered into the message list itself rather than pinned above the input, so they scroll away
   with the greeting instead of hovering over a conversation that has moved on. */
function renderStarters(scope, host, send, agent) {
  if (!host) return;
  const old = host.querySelector('.starters'); if (old) old.remove();
  const picks = pickQuestions(scope, 3, agent);
  if (!picks.length) return;
  const wrap = document.createElement('div');
  wrap.className = 'starters';
  const lead = document.createElement('p'); lead.className = 'st-lead';
  /* Build's chips are instructions, so "what to ask" would be the wrong word for them. The board's
     are half questions and half asks, and "where do I start" is what a blank board actually feels
     like. */
  lead.textContent = agent === 'coder' ? 'Not sure what to build?'
    : agent === 'design' ? 'Not sure where to start?' : 'Not sure what to ask?';
  wrap.appendChild(lead);
  picks.forEach(function (text) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'st-chip'; b.textContent = text;
    b.addEventListener('click', function () { send(text); });
    wrap.appendChild(b);
  });
  host.appendChild(wrap);
  host.scrollTop = host.scrollHeight;
}
/* A chat is "new" until the student has said something in it. */
function chatIsNew(msgs) {
  return !(msgs || []).some(function (m) { return m && m.who === 'user'; });
}
function refreshStarters() {
  if (!aiMsgs) return;
  const old = aiMsgs.querySelector('.starters'); if (old) old.remove();
  if (!chatIsNew(chats[aiMode])) return;
  loadQuestions().then(function () {
    if (!chatIsNew(chats[aiMode])) return;
    renderStarters('lesson', aiMsgs, function (text) {
      const box = $('aiText'); if (box) { box.value = text; growTextarea(box); }
      sendAI();
    }, chatVoice(aiMode));
  });
}

function loadChats() {
  const saved = (state && state.chats) || {};
  liveThreads = Array.isArray(saved.threads) ? saved.threads.filter(function (t) {
    return t && t.id && (t.mode === 'tutor' || t.mode === 'coder') && Array.isArray(t.msgs);
  }) : [];
  currentThreadId = {
    tutor: (saved.current && saved.current.tutor) || null,
    coder: (saved.current && saved.current.coder) || null
  };
  ['tutor', 'coder'].forEach(function (m) { bindChat(m); });   // creates a greeted thread if none
}
function renderBubble(who, text) { const m = document.createElement('div'); m.className = 'msg ' + who; if (who === 'bot') { try { m.innerHTML = String(mdToSafeHTML(text)).trim(); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } return m; }
function addMsg(who, text) { const entry = { who: who, text: text }; (chats[aiMode] || (chats[aiMode] = [])).push(entry); const m = renderBubble(who, text); m.__entry = entry; aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight; return m; }
/* ---------- the waiting message ----------
   "Thinking…" sat there unchanged for however long the call took, which reads as frozen — a
   ten-year-old cannot tell a slow answer from a broken one. Rotating text says the thing is alive.

   These are written on this side, not sent by the model. Worth being clear about, because it looks
   like the assistant narrating itself: the rotating words in a chat UI are the CLIENT guessing at
   what is happening. (A model's real reasoning is a separate API feature — streamed thinking blocks
   — which this server does not ask for and which would be a strange fit for a 3-sentence answer to
   a child.) So they are honest about the shape of the work rather than pretending to report it. */
const THINKING = {
  tutor: ['Thinking…', 'Reading your code…', 'Working out how to explain it…',
    'Looking for a simpler way to say it…', 'Checking what the lesson covered…'],
  coder: ['Thinking…', 'Reading your game…', 'Working out the smallest change…',
    'Checking which file this belongs in…', 'Writing it carefully…'],
  lab: ['Thinking…', 'Reading your lab code…', 'Looking at what it printed…',
    'Working out a nudge, not the answer…'],
  zone: ['Thinking…', 'Reading your board…', 'Looking at what is still empty…',
    'Working out one question worth asking…', 'Thinking about your game, not ours…']
};
function startThinking(el, kind) {
  if (!el) return;
  const pool = THINKING[kind] || THINKING.tutor;
  let i = 0;
  const step = function () {
    el.textContent = pool[i % pool.length];
    if (el.__entry) el.__entry.text = 'Thinking…';   // history never stores the flavour text
    i++;
  };
  step();
  stopThinking(el);
  /* Slow on purpose. Faster than this and it reads as a slot machine rather than as work; the
     point is to show the thing is alive, not to entertain. */
  el.__think = setInterval(step, 2200);
}
function stopThinking(el) {
  if (el && el.__think) { clearInterval(el.__think); el.__think = null; }
}

function setMsg(m, who, text) {
  stopThinking(m); if (m && m.__entry) { m.__entry.who = who; m.__entry.text = text; } if (who === 'bot') { try { m.innerHTML = mdToSafeHTML(text); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } aiMsgs.scrollTop = aiMsgs.scrollHeight; }
function renderChat(mode) {
  aiMsgs.innerHTML = '';
  (chats[mode] || []).forEach(function (en) {
    const m = en.kind === 'proposal' ? renderProposal(en) : (en.kind === 'quiz' ? renderQuizCard(en) : renderBubble(en.who, en.text));
    m.__entry = en; aiMsgs.appendChild(m);
  });
  aiMsgs.scrollTop = aiMsgs.scrollHeight;
  refreshStarters();
}

/* ---------- propose → read → accept ----------
   A change to the student's actual code is shown as a diff they have to look at and accept.
   Reading the change is the point of the course, so it is the price of the change. A
   CONFIG-only tweak is a slider, not a program change, and still applies straight away. */
/* Small models routinely skip the `why` field and answer "Done.", which tells the student
   nothing at the exact moment they are supposed to be reading the change. Fall back to
   describing the change itself rather than showing them a useless sentence. */
function saysSomething(s) {
  return s && !/^(done|ok|okay|sure|here you go|i've made the change|i have made the change)[.!]?$/i.test(String(s).trim());
}
/* The chat bubble after an edit. "Done." tells the student nothing, so when that is all the
   model managed, describe the change from the ops instead. */
function describeEdit(reply, ops) {
  if (saysSomething(reply)) return String(reply).trim();
  if (ops && ops.config && typeof ops.config === 'object' && !opsChangeCode(ops)) {
    const bits = Object.keys(ops.config).map(function (k) { return k + ' to ' + ops.config[k]; });
    if (bits.length) return 'Changed ' + bits.join(', ') + '.';
  }
  return 'I made that change for you — take a look.';
}
function proposalWhy(why, reply, rows) {
  const useful = saysSomething;
  if (useful(why)) return String(why).trim();
  if (useful(reply)) return String(reply).trim();
  const c = countChanges(rows || []), bits = [];
  if (c.added) bits.push(c.added + (c.added === 1 ? ' line' : ' lines') + ' added');
  if (c.removed) bits.push(c.removed + (c.removed === 1 ? ' line' : ' lines') + ' removed');
  return bits.length ? 'A change to game.js — ' + bits.join(', ') + '. Have a read before you accept it.'
                     : 'A change to game.js. Have a read before you accept it.';
}
function addProposal(why, ops, reply) {
  const changes = opsToChanges(ops);
  if (changes === null || !changes.length) return null;   // couldn't place it; caller tells the student
  // One review can span several files — a sprint key changes player.js, not game.js.
  const rows = [];
  changes.forEach(function (c) {
    c.rows = lineDiff(c.before, c.after) || [];
    if (changes.length > 1 || c.name !== 'game.js') rows.push({ t: 'h', text: c.name });
    c.rows.forEach(function (r) { rows.push(r); });
  });
  /* TWO DIFFERENT SENTENCES, AND THEY WERE THE SAME ONE. `why` is the caption over the diff — one
     line, in the review bar. `explain` is what the model actually told the student about the
     change, which is the thing a twelve-year-old reads to learn anything from it.
     Only `why` was kept, so the explanation was thrown away every time a change touched code: a
     student was shown "Adds fps.target/forceSetTimeOut to the Phaser game config in main.js", and
     then the comprehension check asked why forceSetTimeOut was needed. Nothing they had been given
     could answer that. */
  const entry = { who: 'bot', kind: 'proposal', state: 'pending', why: proposalWhy(why, reply, rows), ops: ops,
    explain: saysSomething(reply) ? String(reply).trim() : '', changes: changes, rows: rows };
  entry.text = entry.explain || entry.why;   // `text` is what the model sees as its own turn in history
  (chats.coder || (chats.coder = [])).push(entry);
  const card = renderProposal(entry); card.__entry = entry;
  aiMsgs.appendChild(card); aiMsgs.scrollTop = aiMsgs.scrollHeight;
  startReview(entry);                         // take them to the Code tab to read the diff
  return entry;
}
/* The diff itself lives in the Code tab; this card is the record of what was suggested and
   the way back into the review if the student wanders off. */
function renderProposal(en) {
  // the explanation is the chat bubble just above this card; the card is the action
  const wrap = document.createElement('div'); wrap.className = 'msg bot proposal';
  const counts = countChanges(en.rows || []);
  const summary = (counts.added ? '+' + counts.added + ' added' : '') +
    (counts.added && counts.removed ? ', ' : '') + (counts.removed ? '−' + counts.removed + ' removed' : '');

  if (en.state === 'pending') {
    const b = document.createElement('button'); b.className = 'prop-review'; b.type = 'button';
    const names = (en.changes || []).map(function (c) { return c.name; }).join(', ');
    b.innerHTML = '<span class="mdi mdi-file-compare"></span>Review the change' + (names ? ' in ' + names : '') + (summary ? ' (' + summary + ')' : '');
    b.addEventListener('click', function () { startReview(en); });
    wrap.appendChild(b);
    /* AND A WAY TO SAY YES FROM HERE.
       Accepting used to live in exactly one place — the Apply button on the bar above the editor —
       so anything that left that bar off the screen left the student with a change they could read
       and no way to take it. That happened on the deployed build and is what prompted this.
       The bar is the better place to accept from, because it sits beside the diff and the whole
       point is that they read it first. This is the second door, not a replacement: it is on the
       card their eye is already on, and it means the action can never go missing with one strip of
       UI. Both call the same acceptProposal. */
    const ok = document.createElement('button'); ok.className = 'prop-apply'; ok.type = 'button';
    ok.innerHTML = '<span class="mdi mdi-check"></span>Apply it';
    ok.addEventListener('click', function () { acceptProposal(en); });
    wrap.appendChild(ok);
  } else {
    const done = document.createElement('div'); done.className = 'prop-state ' + en.state;
    done.textContent = en.state === 'applied' ? '✓ Applied to your game' : 'Not applied';
    wrap.appendChild(done);
  }
  return wrap;
}
function declineProposal(en) {
  if (en.state !== 'pending') return;
  en.state = 'declined';
  if (typeof endReview === 'function') endReview();
  renderChat('coder');
  toast('Left your game as it was.');
}
function acceptProposal(en) {
  if (en.state !== 'pending') return;
  const broken = (en.changes || []).filter(function (c) { return !validJS(c.after); });
  if (broken.length) {
    en.state = 'declined';
    if (typeof endReview === 'function') endReview();
    renderChat('coder');
    addMsg('bot', 'That change would have broken ' + broken[0].name + ', so I kept your game the way it was. Try asking a slightly different way.');
    return;
  }
  (en.changes || []).forEach(function (c) {
    if (project.files[c.name] === undefined) project.order.push(c.name);   // a file the AI created
    project.files[c.name] = c.after;
  });
  en.state = 'applied';
  saveProject();
  if (typeof endReview === 'function') endReview();
  renderChat('coder');
  refreshFiles();
  runGame();                     // straight to seeing the change actually happen, and running
  maybeAskQuiz(en);
}
/* Re-run only if the game is actually running. It used to key off whether the Play TAB was showing,
   which is no longer the same question: a game can be running behind the Code tab, and that is
   exactly the case where seeing an applied edit take effect matters most. */
function refreshAfterEdit() { loadSettings(); refreshFiles(); if (typeof isGameRunning === 'function' && isGameRunning()) startGame(); if (!$('view-code').hidden) loadCode(); }

/* The last few turns of this panel's chat, so follow-ups like "even faster" or "undo that"
   make sense to the model. Call this BEFORE adding the new message. Kept small on purpose —
   game.js, main.js and the lesson already take a big slice of the model's context window. */
function chatHistory(mode) {
  const turns = (chats[mode] || []).filter(function (en) { return en.text && en.text !== 'Thinking…'; });
  const out = []; let budget = 3000;
  for (let i = turns.length - 1; i >= 0 && out.length < 6; i--) {
    const content = String(turns[i].text).slice(0, 1000);
    if (content.length > budget) break;
    budget -= content.length;
    out.unshift({ role: turns[i].who === 'user' ? 'user' : 'assistant', content: content });
  }
  return out;
}

/* Where the student is and what actually exists in their project. game.js goes over as
   `code`, so it is excluded here rather than sent twice. */
function aiContext() {
  const f = (typeof flat !== 'undefined' && flat[curIdx]) ? flat[curIdx] : null;
  // Every file the student has, in tree order, including any they added themselves. Contents
  // are included while there is room, but a file is NEVER dropped silently — the name always
  // goes over, so the coder knows it exists and can edit it by name. (A 3000-char budget here
  // used to drop player.js and coins.js, so the coder was asked to change movement while
  // unable to see movePlayer, and answered by claiming changes it had not made.)
  let budget = 12000;
  const files = fileNames().filter(function (n) { return n !== 'game.js'; }).map(function (n) {
    const code = project.files[n] || '';
    if (code.length <= budget) { budget -= code.length; return { name: n, code: code }; }
    return { name: n, code: '', omitted: true };
  });
  return {
    lessonTitle: f ? f.l.t : '',
    lessonContext: currentLessonText || '',
    where: describeWhere(),
    aiMode: currentAIMode,
    ownedAssets: (typeof ownedAssets === 'function' ? ownedAssets() : []).map(function (a) { return { key: a.key, type: a.type }; }),
    /* Owned BUNDLES, compressed to a shared prefix and a count.

       The Store now sells 400-tile sets, and the server caps the key list it puts in the prompt at
       300. Sending only that list meant a student who owned a big set had keys 301+ treated as
       invented — the coder's change would be refused with "you don't own that" for a tile they had
       paid for. Sending four hundred key strings on every request instead is not the answer either.

       So a set travels as `1bit-platformer_tile_` × 400, which the server can validate against and
       describe in one line. */
    ownedSets: (function () {
      const out = [];
      (window.STORE_BUNDLES || []).forEach(function (b) {
        if (!state.unlocked[b.id] && !b.free) return;
        const keys = b.members || [];
        if (keys.length < 2) return;
        let p = keys[0];
        keys.forEach(function (k) { while (p && k.indexOf(p) !== 0) p = p.slice(0, -1); });
        if (p.length < 4) return;             // no useful shared prefix — leave it to the key list
        out.push({ prefix: p, count: keys.length, name: b.name, type: 'image' });
      });
      return out;
    })(),
    files: files,
    // What the game actually printed the last time it ran. "It says undefined is not a function
    // on line 40" is a different conversation from "here is my code, help".
    gameLog: (typeof recentGameLog === 'function' ? recentGameLog() : []),
    gameRan: (typeof gameHasRun !== 'undefined' && gameHasRun)
  };
}

/* ---------- comprehension check after an applied change ----------
   Roughly one in three applied code changes asks one question about what just happened.
   It never blocks anything: a wrong answer just explains, a right one is worth a little XP. */
const QUIZ_CHANCE = 1 / 3, QUIZ_XP = 20;
function maybeAskQuiz(en) {
  if (Math.random() >= QUIZ_CHANCE) return;
  const changed = diffHunks(en.rows || [], 1).filter(function (r) { return r.t === '+' || r.t === '-'; })
    .map(function (r) { return r.t + ' ' + r.text; }).join('\n').slice(0, 1200);
  if (!changed) return;
  const c = aiContext();
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    agent: 'quiz',
    /* Both halves, because the question has to be answerable from what the student was actually
       TOLD. On the caption alone ("adds fps.target/forceSetTimeOut…") the quiz agent wrote a
       perfectly good question about why forceSetTimeOut was needed — and nothing the student had
       read mentioned why. The explanation is the material they were taught from; the caption is a
       label. */
    message: 'The student just made this change to their game:\n' + changed
      + '\n\nWhat it was meant to do: ' + (en.why || '')
      + '\n\nWhat the student was told about it, and the ONLY explanation they have seen:\n'
      + (en.explain || '(nothing beyond the line above)')
      + '\n\nWrite ONE question checking they understood what this change does. It must be answerable '
      + 'from the explanation above — do not ask about anything the student was never told.',
    lessonTitle: c.lessonTitle, lessonContext: c.lessonContext
  }) })
    .then(aiRead).then(function (d) {
      const q = d && d.result;
      // The server validates this properly (cleanQuizQuestion) and drops anything it cannot
      // vouch for. This stays as a second net, and it checks `answer` — which it did not use to.
      // Without that check a missing or out-of-range answer marked every choice wrong, so a
      // student could not answer the question correctly however well they understood it.
      if (!q || !q.question || !Array.isArray(q.options) || q.options.length < 2) return;
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) return;
      const entry = { who: 'bot', kind: 'quiz', q: q, picked: -1, text: q.question };
      (chats.coder || (chats.coder = [])).push(entry);
      const card = renderQuizCard(entry); card.__entry = entry;
      aiMsgs.appendChild(card); aiMsgs.scrollTop = aiMsgs.scrollHeight;
    })
    .catch(function () { /* a check is a bonus, never an interruption */ });
}
/* ---------- grading a practice step ----------
   Called only when the deterministic rules in project.js could not settle it — either the task has
   no rules authored, or it has some and they passed but the goal itself needs judgement. Returns
   { pass, hint } or null, where null means "could not check" and NEVER means fail. The server drops
   any reply it cannot vouch for (ai/grade-check.js), so null arrives here as an empty result. */
function gradePractice(task, changed) {
  const c = aiContext();
  return fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    agent: 'grader',
    message: 'Decide whether the student has done the task. Answer with JSON only.',
    taskTitle: task.title || '', taskSteps: task.steps || [],
    changedCode: changed,
    lessonTitle: c.lessonTitle, lessonContext: c.lessonContext,
    code: (project.files && project.files['game.js']) || '', files: c.files
  }) })
    .then(aiRead)
    .then(function (d) {
      const g = d && d.result;
      // Second net, same as the quiz card above. A reply missing either half is not a verdict.
      if (!g || typeof g.pass !== 'boolean' || typeof g.hint !== 'string' || !g.hint.trim()) return null;
      return g;
    })
    .catch(function () { return null; });   // offline or a 502: could not check, so never a fail
}

/* Hand the practice task to the assistant with everything it needs already loaded, so a stuck
   student can talk it through instead of guessing at what the checker wants. */
function askAboutPractice(task) {
  const steps = (task.steps || []).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n');
  const msg = 'I am working on this in my own game and I think I have done it, but the check does '
    + 'not agree:\n\n' + (task.title || '') + '\n' + steps
    + '\n\nCan you look at my code and tell me what is missing?';
  if (typeof showAI === 'function') showAI();
  if (typeof setAIMode === 'function') setAIMode('tutor');
  const box = $('aiText');
  if (box) { box.value = msg; box.focus(); }
}

function renderQuizCard(en) {
  const wrap = document.createElement('div'); wrap.className = 'msg bot quizcard';
  const h = document.createElement('div'); h.className = 'qc-h';
  h.innerHTML = '<span class="mdi mdi-help-circle-outline"></span>Quick check';
  const q = document.createElement('div'); q.className = 'qc-q'; q.textContent = en.q.question;
  wrap.appendChild(h); wrap.appendChild(q);
  const answered = en.picked >= 0;
  const correct = Number(en.q.answer);
  en.q.options.forEach(function (opt, i) {
    const b = document.createElement('button'); b.className = 'qc-opt'; b.type = 'button'; b.textContent = opt;
    if (answered) {
      b.disabled = true;
      if (i === correct) b.classList.add('right');
      else if (i === en.picked) b.classList.add('wrong');
    } else {
      b.addEventListener('click', function () {
        en.picked = i;
        if (i === correct) { awardXp(QUIZ_XP); toast('Nice! +' + QUIZ_XP + ' XP'); }
        renderChat('coder');
      });
    }
    wrap.appendChild(b);
  });
  if (answered) {
    const ex = document.createElement('div'); ex.className = 'qc-explain';
    ex.textContent = (en.picked === correct ? '' : 'Not quite — ') + (en.q.explain || '');
    wrap.appendChild(ex);
  }
  return wrap;
}

/* Where the student actually is, in a sentence the model can act on.
   Both agents were answering blind: the tutor could not tell someone reading a lesson from someone
   staring at a stack trace on the Code tab, and the coder could not tell whether the game was even
   running. "Why isn't it working?" means three different questions on the three tabs. */
function describeWhere() {
  const f = (typeof flat !== 'undefined' && typeof curIdx === 'number') ? flat[curIdx] : null;
  const tab = document.querySelector('.vtab.on');
  const view = tab ? tab.getAttribute('data-view') : 'learn';
  const bits = [];
  if (f) bits.push('They are on lesson "' + f.l.t + '" in the module "' + f.m.name + '".');
  if (view === 'learn') bits.push('They are READING the lesson — the Learn tab. They are not looking at their code right now.');
  else if (view === 'code') {
    bits.push('They are on the CODE tab, editing their game\'s files.');
    if (typeof currentFile === 'string' && currentFile) bits.push('The file open in front of them is ' + currentFile + '.');
  } else if (view === 'play') {
    bits.push('They are on the GAME tab, watching their game.');
    bits.push(typeof isGameRunning === 'function' && isGameRunning()
      ? 'It is running right now.' : 'It is NOT running — they have not pressed Play, or they stopped it.');
  }
  return bits.join(' ');
}

/* Which agent the Tutor side of the panel is actually talking to.
   On the Design tab it is the design coach: the student is arranging what their game IS, and the
   ordinary tutor is built to explain code — handed "should the platforms vanish?" it answers about
   syntax, because that is what its prompt is for. Same panel, same chat, same thread; a different
   prompt behind it, chosen by where the student is standing. */
function aiAgentFor() {
  const onDesign = $('view-design') && !$('view-design').hidden;
  return onDesign ? 'design-coach' : 'tutor';
}
/* ---------- when a request fails, say what failed ----------
 *
 * Every one of these used to come out the same way. Nothing checked `r.ok`, so a 401 parsed to a
 * body with no `reply` and the panel said "I am not sure how to do that one — can you say it a
 * different way?" A child who had simply been signed out was told the robot could not understand
 * their words, and would sit there rewording a perfectly good question. Network faults all became
 * "Could not reach the server." with no hint of what to do about it.
 *
 * That is the wrong lesson to teach in a computer science course. Something went wrong, it has a
 * name and a number, and the number is a real thing they will meet for the rest of their lives.
 * So the status is shown, in a sentence that says whose problem it is and what to do next.
 */
function aiRead(r) {
  if (typeof telAIResponse === 'function') telAIResponse(r);
  return r.json().catch(function () { return {}; }).then(function (d) {
    d = d || {};
    d.__status = r.status;
    d.__ok = r.ok;
    return d;
  });
}
function aiTrouble(status) {
  if (!status) return 'Your browser could not reach the server at all — that is almost always the wifi rather than anything you did. Check the connection and ask again.';
  if (status === 401) return 'You have been signed out, so the assistant never saw your question. Sign in again and ask once more — nothing you have made is lost. (HTTP 401 means "not signed in".)';
  if (status === 429) return 'You have asked a lot of questions very quickly and the server wants you to slow down for a minute. (HTTP 429 means "too many requests".)';
  if (status === 400) return 'The server could not make sense of that request. (HTTP 400 means "bad request".) Try asking again.';
  if (status === 413) return 'That was too big to send — your game has more in it than one message can carry. (HTTP 413 means "too large".)';
  if (status === 502 || status === 503 || status === 504) return 'The AI service did not answer in time. That is our end, not yours — wait a few seconds and ask again. (HTTP ' + status + '.)';
  if (status >= 500) return 'The server hit an error while dealing with that. Not your fault — try again. (HTTP ' + status + '.)';
  return 'That came back as HTTP ' + status + ', which this app was not expecting. Try again.';
}

function askTutor(question, context) {
  const history = chatHistory('tutor');
  addMsg('user', question); const pending = addMsg('bot', 'Thinking…');
  startThinking(pending, 'tutor');
  setChatBusy($('aiText'), true);
  const c = aiContext();
  const agent = aiAgentFor();
  /* The board travels with a design question and not with any other, because it is only meaningful
     to the coach — and it is the whole board, frame by frame, so the coach can answer "what is
     missing" without asking the student to read it out. */
  const body = { agent: agent, message: question, context: context || '',
    code: project.files['game.js'] || '', history: history, lessonTitle: c.lessonTitle,
    where: c.where, files: c.files, gameLog: c.gameLog, gameRan: c.gameRan };
  if (agent === 'design-coach' && typeof boardPayload === 'function') body.board = boardPayload();
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(aiRead)
    .then(function (d) {
      if (!d.__ok) { setMsg(pending, 'bot', aiTrouble(d.__status)); return; }
      const text = d.reply || '—';
      setMsg(pending, 'bot', agent === 'design-coach' ? applyBoardOps(text) : text);
    })
    .catch(function () { setMsg(pending, 'bot', aiTrouble(0)); })
    .finally(function () { setChatBusy($('aiText'), false); persistChats(); renderChatBar(); });
}

/* The design coach's hands. It ends a reply with `BOARD: {…}` lines; we lift them out, hand them to
   the board to apply, and return the prose with those lines gone — the student sees the stickies
   appear, never the instruction that made them.

   Same shape as the coder agent's `ops`, and for the same reason: a model that returns an
   instruction the client validates can be wrong without being able to do damage. board.js checks
   every field and ignores anything it does not recognise, so a malformed line costs a sticky, not
   the board. The whole reply is scanned rather than just the tail, because a model told to put
   something last will sometimes put it in the middle, and a leaked `BOARD:` line in the chat is
   worse than a missed sticky. */
function applyBoardOps(reply) {
  if (typeof boardApply !== 'function') return reply;
  const ops = [], kept = [];
  String(reply).split('\n').forEach(function (line) {
    const m = /^\s*(?:```)?\s*BOARD:\s*(\{.*\})\s*(?:```)?\s*$/.exec(line);
    if (!m) { kept.push(line); return; }
    try { ops.push(JSON.parse(m[1])); } catch (e) { /* a broken line is dropped, not shown */ }
  });
  if (!ops.length) return reply;
  boardApply(ops);
  /* Fences the ops were sitting inside, now empty, and the blank run they leave behind. */
  return kept.join('\n').replace(/```[a-z]*\s*```/g, '').replace(/\n{3,}/g, '\n\n').trim()
    || 'Done — have a look at your board.';
}
/* Clicking a line number in the Code tab asks the tutor about that line. The answer lands in
   the normal chat, so the student can follow up on it like any other question. */
function explainLine(fileName, lineNumber, lineText, snippet) {
  setAIMode('tutor');
  addMsg('user', 'What does line ' + lineNumber + ' of ' + fileName + ' do?');
  const pending = addMsg('bot', 'Thinking…');
  startThinking(pending, 'tutor');
  const c = aiContext(), history = chatHistory('tutor');
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    agent: 'tutor', skill: 'explain-a-line',
    message: 'What does line ' + lineNumber + ' do?',
    code: project.files['game.js'] || '', history: history, lessonTitle: c.lessonTitle,
    fileName: fileName, lineNumber: String(lineNumber), line: lineText, snippet: snippet,
    gameLog: c.gameLog, gameRan: c.gameRan
  }) })
    .then(aiRead).then(function (d) { setMsg(pending, 'bot', d.__ok ? (d.reply || '—') : aiTrouble(d.__status)); })
    .catch(function () { setMsg(pending, 'bot', aiTrouble(0)); })
    .finally(function () { setChatBusy($('aiText'), false); persistChats(); renderChatBar(); });
}

function sendAI() {
  const box = $('aiText'); const text = box.value.trim(); if (!text) return;
  setTimeout(function () { growTextarea(box); }, 0);   // back to one line once it is sent
  if (aiMode === 'coder' && currentAIMode === 'off') { toast('The AI is off for this challenge — give it a try yourself!'); return; }
  box.value = '';
  if (aiMode === 'tutor') { askTutor(text, currentLessonText); return; }
  const history = chatHistory('coder'), c = aiContext();
  addMsg('user', text); const pending = addMsg('bot', 'Thinking…');
  startThinking(pending, 'coder');
  setChatBusy($('aiText'), true);
  // the code lives in the browser; we send it along with the lesson, the other files and the
  // asset keys that exist, the server relays the AI, and we apply the change here
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    agent: 'coder', message: text, code: project.files['game.js'] || '',
    history: history, lessonTitle: c.lessonTitle, lessonContext: c.lessonContext, where: c.where,
    practiceTask: currentPracticeTask,
    aiMode: c.aiMode, ownedAssets: c.ownedAssets, files: c.files,
    gameLog: c.gameLog, gameRan: c.gameRan
  }) })
    .then(aiRead).then(function (data) {
      if (!data.__ok) { setMsg(pending, 'bot', aiTrouble(data.__status)); return; }
      const ops = data.ops;
      /* No ops and no reply is the model having nothing to say, which IS a phrasing problem — so
         that sentence stays, but only now that it cannot be shown for a failed request. */
      if (!ops) { setMsg(pending, 'bot', data.reply || 'I am not sure how to do that one — can you say it a different way?'); return; }

      /* Numbers live in config.js and are the tinkering loop — they land straight away.
         APPLIED BEFORE ANYTHING IS SAID ABOUT THEM, which is the whole point of this order.
         "Changed speed to 300." used to be printed here and mergeConfig run afterwards — and
         mergeConfig returns the file unchanged when it cannot find a CONFIG block to edit. So a
         student could read that their speed had changed, press Play, and find it had not. */
      let cfgApplied = null;
      if (ops.config && typeof ops.config === 'object') {
        const cf = configFile(), cfgBefore = project.files[cf] || '';
        const cfgAfter = mergeConfig(cfgBefore, ops.config);
        cfgApplied = (cfgAfter !== cfgBefore && validJS(cfgAfter));
        if (cfgApplied) { project.files[cf] = cfgAfter; saveProject(); }
      }
      /* The model's sentence is dropped when the merge failed, which is the one place this file
         does that. A config reply is always "changed X to Y" and carries nothing else, so keeping
         it next to "nothing changed" leaves a twelve-year-old to work out which half of one message
         is true. The branch below keeps the reply because a code change's reply says what it TRIED,
         which is what they need in order to ask again. */
      setMsg(pending, 'bot', cfgApplied === false && !opsChangeCode(ops)
        ? "I couldn't find those numbers in " + configFile() + ", so nothing changed. Have a look at what is in there and tell me which one you meant."
        : describeEdit(data.reply, ops));

      // A change to the code itself is proposed, not applied — the student reads it first.
      if (opsChangeCode(ops)) {
        const en = addProposal(data.why, ops, data.reply);
        /* The card carries the action and the review bar carries the one-line caption, so this
           bubble is the EXPLANATION — what the change does and why it works that way. It used to
           show `why`, the same line as the bar, which meant the model's explanation was written
           and never read by anyone. */
        if (en) { setMsg(pending, 'bot', en.explain || en.why); return; }
        /* No card: opsToChanges could not place the edit. The model's explanation is still the best
           thing the student has, so it is kept and the reason is added to it rather than written
           over the top of it. */
        setMsg(pending, 'bot', (saysSomething(data.reply) ? String(data.reply).trim() + '\n\n' : '')
          + "I couldn't work out where to put that change safely, so I left your game alone. Try asking for it a different way.");
        return;
      }
      refreshAfterEdit();
    })
    /* setMsg, not pending.textContent: a bare write is overwritten by startThinking's interval 2.2
       seconds later and never reaches __entry, so the error flashed and the saved turn still said
       "Thinking…". Every branch in here has to end in setMsg on `pending` for the same reason. */
    .catch(function () { setMsg(pending, 'bot', aiTrouble(0)); })
    .finally(function () { setChatBusy($('aiText'), false); persistChats(); renderChatBar(); });
}
$('aiSend').addEventListener('click', sendAI);

/* ---------- what a chat box is supposed to do ----------
   This was a one-line <input>. It could not hold a newline, so Shift+Enter did nothing, a pasted
   snippet arrived as one endless scrolling line with its formatting flattened, and there was no way
   to see the end of what you had written. Every chat panel does these four things and it did none
   of them. Shared, so the lesson's assistant and the lab bench's behave identically. */
function growTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';                       // measure the content, not the box it is in now
  const max = 180;                                // ~7 lines, then it scrolls instead of eating the chat
  el.style.height = Math.min(el.scrollHeight, max) + 'px';
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
}
/* ---------- the send button says what will happen if you press it ----------
   It was one static paper-plane that looked identical whether the box was empty, ready, or waiting
   on a reply — so the only way to find out whether anything was happening was to press it again.
   Three states, and the icon carries each:
     empty     dim, disabled, nothing to send
     ready     lit, the arrow
     waiting   a spinner, disabled, so a second press cannot queue a duplicate question
   `busy` is owned by the caller, because only it knows when the reply has landed. */
function paintChatSend(el) {
  if (!el) return;
  const btn = el.__sendBtn; if (!btn) return;
  const busy = !!el.__busy;
  const empty = !el.value.trim();
  btn.disabled = busy || empty || el.disabled;
  btn.classList.toggle('busy', busy);
  btn.title = busy ? 'Waiting for a reply…' : (empty ? 'Type something first' : 'Send');
  btn.innerHTML = '<span class="mdi ' + (busy ? 'mdi-loading' : 'mdi-send') + '" aria-hidden="true"></span>';
  el.parentElement && el.parentElement.classList.toggle('is-busy', busy);
}
function setChatBusy(el, busy) {
  if (!el) return;
  el.__busy = !!busy;
  el.placeholder = busy ? 'Thinking…' : (el.__placeholder || el.placeholder);
  paintChatSend(el);
}
function wireChatBox(el, send) {
  if (!el) return;
  el.__placeholder = el.placeholder;
  /* The send button is whichever button sits beside it in the input row. Found rather than passed,
     so a third chat panel added later needs no extra wiring. */
  el.__sendBtn = el.parentElement && el.parentElement.querySelector('button');
  paintChatSend(el);
  el.addEventListener('input', function () { growTextarea(el); paintChatSend(el); });
  /* The whole input row takes the focus ring, not the bare textarea — the box and its send button
     read as one control, which is what they are. */
  el.addEventListener('focus', function () { el.parentElement && el.parentElement.classList.add('focused'); });
  el.addEventListener('blur', function () { el.parentElement && el.parentElement.classList.remove('focused'); });
  el.addEventListener('keydown', function (e) {
    /* Enter sends; Shift+Enter (and Ctrl/Cmd+Enter) start a new line. The modifier check has to
       come first, or holding shift would send and swallow the line the student meant to write. */
    if (e.key !== 'Enter') return;
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;   // let the newline through
    e.preventDefault();
    if (el.__busy || !el.value.trim()) return;   // no double-sends while a reply is in flight
    send();
  });
  /* Paste keeps its formatting. The browser's default paste into a textarea already preserves
     newlines and indentation; what broke it before was the element being an <input>, which strips
     every line break on the way in. Growing afterwards is the only part left to do. */
  el.addEventListener('paste', function () { setTimeout(function () { growTextarea(el); paintChatSend(el); }, 0); });
}
wireChatBox($('aiText'), sendAI);
/* Conversations come back from the last session rather than being greeted fresh every reload. The
   greeting is now the first message of a NEW thread (chatGreeting), so it is not pushed here. */
/* Questions first, then conversations. loadChats() creates a greeted thread when there is nothing
   saved, and the greeting comes from the pool — so the pool has to be there before the first thread
   is made, or a brand-new student gets the fallback line every time. */
loadQuestions().then(function () {
  loadChats();
  renderChat(aiMode);
  renderChatBar();
  refreshStarters();
});
$('modeToggle').addEventListener('click', function () { setAIMode(aiMode === 'tutor' ? 'coder' : 'tutor'); });
fetch('/api/info').then(aiRead).then(function (d) { aiModels = d.agents || { coder: d.model, tutor: d.model }; setAIMode(aiMode); }).catch(function () {});
