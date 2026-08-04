try { require('dotenv').config(); } catch (e) { /* optional */ }
// ============================================================
//  LEAGUE Game Dev - course backend + SANDBOXED AI agent
//  Runs the same on a plain server or inside GitHub Codespaces.
//  The AI can ONLY: (1) change allowlisted numeric settings in
//  game.js, or (2) answer questions. Nothing else.
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const WORKSPACE = path.join(ROOT, 'workspace');
const GAME_FILE = path.join(WORKSPACE, 'game.js');

// ---- AI providers (keys stay server-side, never sent to the browser) ----
// Multiple agents (coder / tutor / quiz / grader) each get their own model, set in .env.
// A model spec is "<provider>:<model>", e.g. "ollama:qwen2.5-coder:7b",
// "openrouter:qwen/qwen-2.5-coder-7b", "anthropic:claude-3-5-sonnet-latest".
// No prefix => DEFAULT_PROVIDER is used. Everything works on local Ollama or on OpenRouter.
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AGENT_MODELS = {
  coder:  process.env.CODER_MODEL  || '',   // edits the game code
  tutor:  process.env.TUTOR_MODEL  || '',   // explains / answers questions
  quiz:   process.env.QUIZ_MODEL   || '',   // (scaffold) writes questions
  grader: process.env.GRADER_MODEL || ''    // (scaffold) checks work
};
const KNOWN_PROVIDERS = ['ollama', 'openrouter', 'anthropic'];
function resolveModel(agent) {
  let spec = AGENT_MODELS[agent] || '';
  if (!spec) spec = DEFAULT_PROVIDER + ':' + (DEFAULT_PROVIDER === 'anthropic' ? ANTHROPIC_MODEL : OLLAMA_MODEL);
  const i = spec.indexOf(':');
  if (i > 0 && KNOWN_PROVIDERS.indexOf(spec.slice(0, i)) >= 0) return { provider: spec.slice(0, i), model: spec.slice(i + 1) };
  return { provider: DEFAULT_PROVIDER, model: spec };
}

// ---- SANDBOX: the only fields the agent may change, with safe ranges ----
const TUNABLES = {
  fallSpeed:   { min: 60,  max: 600 },
  bombChance:  { min: 0,   max: 0.6 },
  paddleWidth: { min: 40,  max: 260 },
  spawnEvery:  { min: 250, max: 1500 },
  starPoints:  { min: 1,   max: 100 }
};
const ALLOWED_KEYS = Object.keys(TUNABLES);

// ---- simple per-student rate limit ----
const RATE = { windowMs: 10 * 60 * 1000, max: 40 };
const hits = new Map();
function rateLimited(id) {
  const now = Date.now(); const e = hits.get(id);
  if (!e || now - e.start > RATE.windowMs) { hits.set(id, { start: now, count: 1 }); return false; }
  e.count++; return e.count > RATE.max;
}

// ---- static hosting ----
app.use(express.static(path.join(ROOT, 'public')));
app.use('/workspace', express.static(WORKSPACE, { etag: false, lastModified: false, cacheControl: false }));
app.use('/content', express.static(path.join(ROOT, 'content'), { etag: false, lastModified: false, cacheControl: false })); // authored course: YAML structure + Markdown lessons (read-only)

// ---- file access: safe .js names inside the workspace only ----
const SAFE_NAME = /^[A-Za-z0-9_-]+\.js$/;
function safeScriptPath(name) { return SAFE_NAME.test(name) ? path.join(WORKSPACE, name) : null; } // no traversal, .js only
function listScripts() { return fs.readdirSync(WORKSPACE).filter(f => f.endsWith('.js')).sort(); }
app.get('/api/files', (req, res) => res.json(listScripts()));            // list the student's scripts
app.get('/api/files/:name', (req, res) => {                               // read one script
  const p = safeScriptPath(req.params.name);
  if (!p || !fs.existsSync(p)) return res.status(404).type('text/plain').send('// file not available');
  res.type('text/plain').send(fs.readFileSync(p, 'utf8'));
});
app.get('/api/config', (req, res) => res.json(currentConfig(fs.readFileSync(GAME_FILE, 'utf8')))); // current game settings

// ---- which models are running (per agent) ----
app.get('/api/info', (req, res) => {
  const agents = {};
  ['coder', 'tutor', 'quiz', 'grader'].forEach(function (a) { const m = resolveModel(a); agents[a] = m.provider + ':' + m.model; });
  res.json({ agents: agents, provider: DEFAULT_PROVIDER, model: resolveModel('coder').model });
});

// ---- WRITE access: students may edit/create only safe .js files in the workspace ----
app.post('/api/save-file', (req, res) => {
  const p = safeScriptPath((req.body && req.body.name) || '');
  const content = req.body && req.body.content;
  if (!p) return res.status(403).json({ ok: false, error: 'That file name is not allowed.' });                        // name/path allowlist
  if (typeof content !== 'string' || content.length > 100000) return res.status(400).json({ ok: false, error: 'Content missing or too large.' }); // size cap
  try { new Function(content); } catch (e) { return res.status(400).json({ ok: false, error: 'Syntax error: ' + e.message }); } // PARSE only - never executes
  fs.writeFileSync(p, content);
  res.json({ ok: true });
});
app.post('/api/new-file', (req, res) => {
  const name = (req.body && req.body.name) || '';
  const p = safeScriptPath(name);
  if (!p) return res.status(400).json({ ok: false, error: 'Use letters, numbers, - or _ and end with .js' });
  if (fs.existsSync(p)) return res.status(409).json({ ok: false, error: 'A file with that name already exists.' });
  fs.writeFileSync(p, '// ' + name + '\n// Code you write here runs with the game when you press Run.\n');
  res.json({ ok: true, files: listScripts() });
});

// ---- helpers ----
function currentConfig(text) {
  const cfg = {};
  const block = text.match(/CONFIG\s*=\s*\{([\s\S]*?)\}/);   // read every numeric key in the CONFIG object
  if (block) {
    const re = /([A-Za-z_$][\w$]*)\s*:\s*(-?[0-9.]+)/g; let m;
    while ((m = re.exec(block[1]))) cfg[m[1]] = Number(m[2]);
  }
  return cfg;
}
function applyEdits(text, edits) {
  const applied = {};
  Object.keys(edits || {}).forEach(k => {
    if (!ALLOWED_KEYS.includes(k)) return;                 // ignore anything not on the allowlist
    let v = Number(edits[k]); if (!isFinite(v)) return;
    v = Math.max(TUNABLES[k].min, Math.min(TUNABLES[k].max, v)); // clamp to a safe range
    text = text.replace(new RegExp('(' + k + '\\s*:\\s*)(-?[0-9.]+)'), '$1' + v);
    applied[k] = v;
  });
  return { text, applied };
}
function extractJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
function buildSystem(gameCode) {
  return 'You are a coding assistant inside a kids game-dev course (ages 11-15). '
    + 'The student is building a 2D Phaser 3 game. game.js defines a CONFIG object and functions '
    + '(create, update, spawnObject, buildTextures, postStats, etc.); create() and update() both start with '
    + '`const scene = this;`. A separate main.js boots the game.\n\n'
    + 'CURRENT game.js:\n```javascript\n' + gameCode + '\n```\n\n'
    + 'Make the SMALLEST change that satisfies the request. PREFER ADDING over rewriting. '
    + 'Reply with ONLY one JSON object (no prose, no markdown, no code fences) using any of these OPTIONAL fields:\n'
    + '  "reply": a short friendly one-sentence message to the student.\n'
    + '  "config": an object of CONFIG numbers to add or change, e.g. {"shieldTime": 5, "fallSpeed": 120}.\n'
    + '  "functions": an array of COMPLETE new top-level functions to add, each a string.\n'
    + '  "create": a code snippet inserted at the END of create() (the scene is the variable "scene").\n'
    + '  "update": a code snippet inserted at the END of update() (use "scene").\n'
    + '  "newFile": {"name":"thing.js","code":"..."} ONLY if the student asks to create a new script/file.\n'
    + '  "replaceFile": the COMPLETE new game.js. Use ONLY when the student asks to remove, delete, or rewrite a large part.\n\n'
    + 'RULES:\n'
    + '- Normal "add ..." requests: use config / functions / create / update. Do NOT use replaceFile and do NOT resend the whole file.\n'
    + '- Use replaceFile ONLY when the student clearly asks to remove/delete/rewrite something.\n'
    + '- Put any new adjustable number in "config" so it appears in the settings panel.\n'
    + '- Use only Phaser 3 APIs and the patterns already in the file. Never write a new Phaser.Game.\n'
    + '- For drawing, use only real Phaser 3 Graphics methods (fillRect, fillRoundedRect, fillCircle, fillTriangle, beginPath/moveTo/lineTo/closePath/fillPath, generateTexture). Do NOT use HTML-canvas methods like cubicCurveTo, bezierCurveTo, or arcTo — they do not exist on Phaser Graphics and crash the game.\n'
    + '- If it is just a question, reply with only {"reply":"..."} and no other fields.\n'
    + '- Output nothing but the single JSON object.';
}
function buildTutorSystem(gameCode, context) {
  return 'You are a friendly coding tutor for kids aged 11-15 in a game-dev course. '
    + 'Explain clearly and help them UNDERSTAND rather than doing their work for them. '
    + 'ALWAYS answer in the context of JavaScript and the Phaser game library — NEVER use Python or any other language. '
    + 'Keep answers to about 2-4 short sentences; include a tiny JavaScript snippet only if it truly helps; never dump large code.\n'
    + (context ? '\nThe student is asking about this part of the lesson:\n"""\n' + context + '\n"""\n' : '')
    + (gameCode ? '\nCurrent game.js for reference:\n```javascript\n' + gameCode + '\n```' : '');
}
const AGENT_SYSTEMS = {
  quiz: 'You write short comprehension questions for kids (11-15) learning to code. Output ONLY a JSON object.',
  grader: 'You check a student\'s answer or code change for a kids coding course. Output ONLY a JSON object with {"pass": true/false, "hint": "..."}.'
};
function extractCode(raw) {
  const m = raw.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : null;
}
function stripCode(raw) { return raw.replace(/```[\s\S]*?```/, '').trim(); }
async function callAI(spec, system, user, wantJSON) {
  const provider = spec.provider, model = spec.model;
  if (provider === 'anthropic') {
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: model, max_tokens: 2000, system: system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('Anthropic HTTP ' + r.status);
    const d = await r.json();
    return (d.content && d.content[0] && d.content[0].text) || '';
  }
  if (provider === 'openrouter') {
    if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set');
    const body = { model: model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
    if (wantJSON) body.response_format = { type: 'json_object' };
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('OpenRouter HTTP ' + r.status);
    const d = await r.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }
  // default: local Ollama (free). format:json nudges clean JSON out of small models.
  const body = { model: model, stream: false, options: { num_ctx: 8192, num_predict: 2048, temperature: 0.3 },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (wantJSON) body.format = 'json';
  const r = await fetch(OLLAMA_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Ollama HTTP ' + r.status);
  const d = await r.json();
  return (d.message && d.message.content) || d.response || '';
}

// ---- the agent endpoint: relays the AI and returns a change for the browser to apply ----
//      The student's code lives in the browser and is sent with the request. The server
//      never stores or runs student code — it just talks to the model and returns "ops".
app.post('/api/ai', async (req, res) => {
  const id = (req.body && req.body.studentId) || req.ip || 'anon';
  if (rateLimited(id)) return res.status(429).json({ reply: 'Slow down a moment - you have hit the request limit. Try again shortly.' });
  const message = ((req.body && req.body.message) || '').toString().slice(0, 2000);
  if (!message) return res.status(400).json({ reply: 'Please type a message.' });
  const gameCode = ((req.body && req.body.code) || '').toString().slice(0, 100000);
  const context = ((req.body && req.body.context) || '').toString().slice(0, 4000);
  let agent = (req.body && req.body.agent) || 'coder';
  if (['coder', 'tutor', 'quiz', 'grader'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
  const spec = resolveModel(agent);

  // TUTOR: plain-language explanation, no code edits.
  if (agent === 'tutor') {
    let raw;
    try { raw = await callAI(spec, buildTutorSystem(gameCode, context), message, false); }
    catch (e) { return res.status(502).json({ reply: 'The tutor is not reachable right now (' + e.message + ').' }); }
    return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — try rephrasing.' });
  }

  // QUIZ / GRADER (scaffold): return whatever JSON the model produced.
  if (agent === 'quiz' || agent === 'grader') {
    let raw;
    try { raw = await callAI(spec, AGENT_SYSTEMS[agent], message, true); }
    catch (e) { return res.status(502).json({ error: 'The ' + agent + ' agent is not reachable (' + e.message + ').' }); }
    return res.json({ result: extractJSON(raw) || {} });
  }

  // CODER (default): return ops the browser applies to game.js.
  let raw;
  try { raw = await callAI(spec, buildSystem(gameCode), message, true); }
  catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
  const parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
  const ops = {};
  ['config', 'functions', 'create', 'update', 'newFile', 'replaceFile'].forEach(function (k) {
    if (parsed[k] !== undefined && parsed[k] !== null) ops[k] = parsed[k];
  });
  res.json({ reply: parsed.reply || 'Done.', ops: Object.keys(ops).length ? ops : null });
});

app.listen(PORT, () => {
  const c = resolveModel('coder'), t = resolveModel('tutor');
  console.log('Course agent on http://localhost:' + PORT + '  (coder: ' + c.provider + ':' + c.model + ' · tutor: ' + t.provider + ':' + t.model + ')');
});
