/* ai.js — The AI panel: chat rendering, the Tutor and Build (coder) requests to /api/ai, and applying the returned ops to the project. */
/* ---------- AI ---------- */
const aiMsgs = $('aiMsgs');
const chats = { coder: [], tutor: [] };   // separate conversation per mode
function renderBubble(who, text) { const m = document.createElement('div'); m.className = 'msg ' + who; if (who === 'bot') { try { m.innerHTML = mdToSafeHTML(text); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } return m; }
function addMsg(who, text) { const entry = { who: who, text: text }; (chats[aiMode] || (chats[aiMode] = [])).push(entry); const m = renderBubble(who, text); m.__entry = entry; aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight; return m; }
function setMsg(m, who, text) { if (m && m.__entry) { m.__entry.who = who; m.__entry.text = text; } if (who === 'bot') { try { m.innerHTML = mdToSafeHTML(text); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } aiMsgs.scrollTop = aiMsgs.scrollHeight; }
function renderChat(mode) { aiMsgs.innerHTML = ''; (chats[mode] || []).forEach(function (en) { const m = renderBubble(en.who, en.text); m.__entry = en; aiMsgs.appendChild(m); }); aiMsgs.scrollTop = aiMsgs.scrollHeight; }
function refreshAfterEdit() { loadSettings(); refreshFiles(); if (!$('view-play').hidden) startGame(); if (!$('view-code').hidden) loadCode(); }
function askTutor(question, context) {
  addMsg('user', question); const pending = addMsg('bot', 'Thinking…');
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: studentId, agent: 'tutor', message: question, context: context || '', code: project.files['game.js'] || '' }) })
    .then(function (r) { return r.json(); }).then(function (d) { setMsg(pending, 'bot', d.reply || '—'); })
    .catch(function () { setMsg(pending, 'bot', 'Could not reach the tutor.'); });
}
function sendAI() {
  const box = $('aiText'); const text = box.value.trim(); if (!text) return;
  if (aiMode === 'coder' && currentAIMode === 'off') { toast('The AI is off for this challenge — give it a try yourself!'); return; }
  box.value = '';
  if (aiMode === 'tutor') { askTutor(text, currentLessonText); return; }
  addMsg('user', text); const pending = addMsg('bot', 'Thinking…');
  // the code lives in the browser; we send it along, the server relays the AI, and we apply the change here
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: studentId, agent: 'coder', message: text, code: project.files['game.js'] || '' }) })
    .then(function (r) { return r.json(); }).then(function (data) {
      setMsg(pending, 'bot', data.reply || 'Done.');
      const ops = data.ops; if (!ops) return;
      if (ops.newFile && typeof ops.newFile.name === 'string' && typeof ops.newFile.code === 'string') {
        let nm = ops.newFile.name.trim(); if (!/\.js$/.test(nm)) nm += '.js';
        if (/^[A-Za-z0-9_-]+\.js$/.test(nm)) { const existed = project.files[nm] !== undefined; project.files[nm] = ops.newFile.code; if (!existed) project.order.push(nm); }
      }
      const before = project.files['game.js'] || '';
      const next = applyOps(before, ops);
      if (next !== before) {
        if (!validJS(next)) { addMsg('bot', "That change caused a code error, so I kept your game the way it was. Try asking a slightly different way."); saveProject(); refreshAfterEdit(); return; }
        project.files['game.js'] = next;
      }
      saveProject(); refreshAfterEdit();
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
