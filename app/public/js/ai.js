/* ai.js — The AI panel: chat rendering, the Tutor and Build (coder) requests to /api/ai, and applying the returned ops to the project. */
/* ---------- AI ---------- */
const aiMsgs = $('aiMsgs');
const chats = { coder: [], tutor: [] };   // separate conversation per mode
function renderBubble(who, text) { const m = document.createElement('div'); m.className = 'msg ' + who; if (who === 'bot') { try { m.innerHTML = mdToSafeHTML(text); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } return m; }
function addMsg(who, text) { const entry = { who: who, text: text }; (chats[aiMode] || (chats[aiMode] = [])).push(entry); const m = renderBubble(who, text); m.__entry = entry; aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight; return m; }
function setMsg(m, who, text) { if (m && m.__entry) { m.__entry.who = who; m.__entry.text = text; } if (who === 'bot') { try { m.innerHTML = mdToSafeHTML(text); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } aiMsgs.scrollTop = aiMsgs.scrollHeight; }
function renderChat(mode) {
  aiMsgs.innerHTML = '';
  (chats[mode] || []).forEach(function (en) {
    const m = en.kind === 'proposal' ? renderProposal(en) : (en.kind === 'quiz' ? renderQuizCard(en) : renderBubble(en.who, en.text));
    m.__entry = en; aiMsgs.appendChild(m);
  });
  aiMsgs.scrollTop = aiMsgs.scrollHeight;
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
function addProposal(why, ops, before, reply) {
  const after = applyOps(before, ops);
  if (after === null) return null;            // couldn't place it safely; caller tells the student
  const rows = lineDiff(before, after);
  const entry = { who: 'bot', kind: 'proposal', state: 'pending', why: proposalWhy(why, reply, rows), ops: ops, before: before, after: after,
    rows: rows };
  entry.text = entry.why;                  // `text` is what the model sees as its own turn in history
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
    b.innerHTML = '<span class="mdi mdi-file-compare"></span>Review the change' + (summary ? ' (' + summary + ')' : '');
    b.addEventListener('click', function () { startReview(en); });
    wrap.appendChild(b);
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
  if (!validJS(en.after)) {
    en.state = 'declined';
    if (typeof endReview === 'function') endReview();
    renderChat('coder');
    addMsg('bot', "That change would have broken your game, so I kept it the way it was. Try asking a slightly different way.");
    return;
  }
  if (en.ops.newFile && typeof en.ops.newFile.name === 'string' && typeof en.ops.newFile.code === 'string') {
    let nm = en.ops.newFile.name.trim(); if (!/\.js$/.test(nm)) nm += '.js';
    if (/^[A-Za-z0-9_-]+\.js$/.test(nm)) { const existed = project.files[nm] !== undefined; project.files[nm] = en.ops.newFile.code; if (!existed) project.order.push(nm); }
  }
  project.files['game.js'] = en.after;
  en.state = 'applied';
  saveProject();
  if (typeof endReview === 'function') endReview();
  renderChat('coder');
  refreshFiles();
  switchView('play');            // straight to seeing the change actually happen
  maybeAskQuiz(en);
}
function refreshAfterEdit() { loadSettings(); refreshFiles(); if (!$('view-play').hidden) startGame(); if (!$('view-code').hidden) loadCode(); }

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
  const others = fileNames().filter(function (n) { return n !== 'game.js'; })
    .map(function (n) { return { name: n, code: project.files[n] || '' }; })
    .sort(function (a, b) { return a.code.length - b.code.length; });   // keep the small ones if we run out of room
  let budget = 3000; const files = [];
  others.forEach(function (o) { if (o.code.length <= budget) { budget -= o.code.length; files.push(o); } });
  return {
    lessonTitle: f ? f.l.t : '',
    lessonContext: currentLessonText || '',
    aiMode: currentAIMode,
    ownedAssets: (typeof ownedAssets === 'function' ? ownedAssets() : []).map(function (a) { return { key: a.key, type: a.type }; }),
    files: files
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
    studentId: studentId, agent: 'quiz',
    message: 'The student just made this change to their game:\n' + changed + '\n\nWhat it was meant to do: ' + (en.why || '') + '\n\nWrite ONE question checking they understood what this change does.',
    lessonTitle: c.lessonTitle, lessonContext: c.lessonContext
  }) })
    .then(function (r) { return r.json(); }).then(function (d) {
      const q = d && d.result;
      if (!q || !q.question || !Array.isArray(q.options) || q.options.length < 2) return;   // bad question: skip silently
      const entry = { who: 'bot', kind: 'quiz', q: q, picked: -1, text: q.question };
      (chats.coder || (chats.coder = [])).push(entry);
      const card = renderQuizCard(entry); card.__entry = entry;
      aiMsgs.appendChild(card); aiMsgs.scrollTop = aiMsgs.scrollHeight;
    })
    .catch(function () { /* a check is a bonus, never an interruption */ });
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
        if (i === correct) { state.xp += QUIZ_XP; saveState(); toast('Nice! +' + QUIZ_XP + ' XP'); }
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

function askTutor(question, context) {
  const history = chatHistory('tutor');
  addMsg('user', question); const pending = addMsg('bot', 'Thinking…');
  const c = aiContext();
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: studentId, agent: 'tutor', message: question, context: context || '', code: project.files['game.js'] || '', history: history, lessonTitle: c.lessonTitle }) })
    .then(function (r) { return r.json(); }).then(function (d) { setMsg(pending, 'bot', d.reply || '—'); })
    .catch(function () { setMsg(pending, 'bot', 'Could not reach the tutor.'); });
}
/* Clicking a line number in the Code tab asks the tutor about that line. The answer lands in
   the normal chat, so the student can follow up on it like any other question. */
function explainLine(fileName, lineNumber, lineText, snippet) {
  setAIMode('tutor');
  addMsg('user', 'What does line ' + lineNumber + ' of ' + fileName + ' do?');
  const pending = addMsg('bot', 'Thinking…');
  const c = aiContext(), history = chatHistory('tutor');
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    studentId: studentId, agent: 'tutor', skill: 'explain-a-line',
    message: 'What does line ' + lineNumber + ' do?',
    code: project.files['game.js'] || '', history: history, lessonTitle: c.lessonTitle,
    fileName: fileName, lineNumber: String(lineNumber), line: lineText, snippet: snippet
  }) })
    .then(function (r) { return r.json(); }).then(function (d) { setMsg(pending, 'bot', d.reply || '—'); })
    .catch(function () { setMsg(pending, 'bot', 'Could not reach the tutor.'); });
}

function sendAI() {
  const box = $('aiText'); const text = box.value.trim(); if (!text) return;
  if (aiMode === 'coder' && currentAIMode === 'off') { toast('The AI is off for this challenge — give it a try yourself!'); return; }
  box.value = '';
  if (aiMode === 'tutor') { askTutor(text, currentLessonText); return; }
  const history = chatHistory('coder'), c = aiContext();
  addMsg('user', text); const pending = addMsg('bot', 'Thinking…');
  // the code lives in the browser; we send it along with the lesson, the other files and the
  // asset keys that exist, the server relays the AI, and we apply the change here
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    studentId: studentId, agent: 'coder', message: text, code: project.files['game.js'] || '',
    history: history, lessonTitle: c.lessonTitle, lessonContext: c.lessonContext,
    aiMode: c.aiMode, ownedAssets: c.ownedAssets, files: c.files
  }) })
    .then(function (r) { return r.json(); }).then(function (data) {
      const ops = data.ops;
      if (!ops) { setMsg(pending, 'bot', data.reply || 'I am not sure how to do that one — can you say it a different way?'); return; }
      setMsg(pending, 'bot', describeEdit(data.reply, ops));

      // Numbers live in config.js and are the tinkering loop — they land straight away.
      if (ops.config && typeof ops.config === 'object') {
        const cf = configFile(), cfgBefore = project.files[cf] || '';
        const cfgAfter = mergeConfig(cfgBefore, ops.config);
        if (cfgAfter !== cfgBefore && validJS(cfgAfter)) { project.files[cf] = cfgAfter; saveProject(); }
      }

      // A change to the code itself is proposed, not applied — the student reads it first.
      const before = project.files['game.js'] || '';
      if (opsChangeCode(ops)) {
        const en = addProposal(data.why, ops, before, data.reply);
        // the card carries the action; this bubble is the sentence explaining it
        setMsg(pending, 'bot', en ? en.why
          : "I couldn't work out where to put that change safely, so I left your game alone. Try asking for it a different way.");
        return;
      }
      refreshAfterEdit();
    })
    .catch(function () { pending.textContent = 'Could not reach the server.'; });
}
$('aiSend').addEventListener('click', sendAI);
$('aiText').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendAI(); });
chats.coder.push({ who: 'bot', text: "Hi! I'm your **Build** helper. Tell me what to change or add to your game — like \"make the player move faster\" — and I'll edit the code." });
chats.tutor.push({ who: 'bot', text: "Hi! I'm your **Tutor**. Ask me anything about the lesson or the code and I'll explain it — I won't change your game." });
renderChat(aiMode);
$('modeToggle').addEventListener('click', function () { setAIMode(aiMode === 'tutor' ? 'coder' : 'tutor'); });
fetch('/api/info').then(function (r) { return r.json(); }).then(function (d) { aiModels = d.agents || { coder: d.model, tutor: d.model }; setAIMode(aiMode); }).catch(function () {});
