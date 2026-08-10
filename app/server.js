try { require('dotenv').config(); } catch (e) { /* optional */ }
// ============================================================
//  LEAGUE Game Dev - course backend
//  Runs the same on a plain server or inside GitHub Codespaces.
//  Serves the app (public/) and the authored course (content/),
//  and relays the AI agents. The student's project lives in the
//  BROWSER: code is sent along with a request for context, used
//  to build the prompt, and never stored or run on the server.
// ============================================================
const express = require('express');
const path = require('path');
const ai = require('./ai/loader');   // agent + skill prompts, authored as Markdown in ai/

const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---- AI providers (keys stay server-side, never sent to the browser) ----
// Multiple agents (coder / tutor / quiz / grader) each get their own model, set in .env.
// A model spec is "<provider>:<model>", e.g. "ollama:qwen2.5-coder:7b",
// "openrouter:qwen/qwen-2.5-coder-7b", "anthropic:claude-3-5-sonnet-latest".
// No prefix => DEFAULT_PROVIDER is used. Everything works on local Ollama or on OpenRouter.
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
// num_ctx is the WHOLE window: prompt + reply. The prompt now carries game.js, the other
// files, the lesson and recent turns, so 8192 was not enough — Ollama silently truncates the
// front of an over-long prompt, which drops the ops schema and produces malformed edits.
// 16384 fits a 7B model on a 16 GB GPU; lower it here if VRAM is tight.
const OLLAMA_NUM_CTX = Number(process.env.OLLAMA_NUM_CTX || 16384);
const OLLAMA_NUM_PREDICT = Number(process.env.OLLAMA_NUM_PREDICT || 3072);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AGENT_MODELS = {
  coder:  process.env.CODER_MODEL  || '',   // edits the game code
  tutor:  process.env.TUTOR_MODEL  || '',   // explains / answers questions
  quiz:   process.env.QUIZ_MODEL   || '',   // (scaffold) writes questions
  grader: process.env.GRADER_MODEL || ''    // (scaffold) checks work
};
const KNOWN_PROVIDERS = ['ollama', 'openrouter', 'anthropic'];
// Fallback model per provider, used when an agent has no model set in .env.
const PROVIDER_DEFAULT_MODEL = { ollama: OLLAMA_MODEL, anthropic: ANTHROPIC_MODEL, openrouter: OPENROUTER_MODEL };
// Precedence: .env per-agent spec > the agent file's `model:` > default provider.
function resolveModel(agent) {
  let spec = AGENT_MODELS[agent] || '';
  if (!spec) spec = ai.agentModel(agent) || '';
  if (!spec) spec = DEFAULT_PROVIDER + ':' + (PROVIDER_DEFAULT_MODEL[DEFAULT_PROVIDER] || '');
  const i = spec.indexOf(':');
  if (i > 0 && KNOWN_PROVIDERS.indexOf(spec.slice(0, i)) >= 0) return { provider: spec.slice(0, i), model: spec.slice(i + 1) };
  return { provider: DEFAULT_PROVIDER, model: spec };
}

// ---- simple per-student rate limit ----
const RATE = { windowMs: 10 * 60 * 1000, max: 40 };
const hits = new Map();
function rateLimited(id) {
  const now = Date.now();
  if (hits.size > 500) hits.forEach(function (v, k) { if (now - v.start > RATE.windowMs) hits.delete(k); }); // drop stale entries
  const e = hits.get(id);
  if (!e || now - e.start > RATE.windowMs) { hits.set(id, { start: now, count: 1 }); return false; }
  e.count++; return e.count > RATE.max;
}

// ---- static hosting ----
app.use(express.static(path.join(ROOT, 'public')));
app.use('/content', express.static(path.join(ROOT, 'content'), { etag: false, lastModified: false, cacheControl: false })); // authored course: YAML structure + Markdown lessons (read-only)

// ---- which models are running (per agent) ----
app.get('/api/info', (req, res) => {
  const agents = {};
  ['coder', 'tutor', 'quiz', 'grader'].forEach(function (a) { const m = resolveModel(a); agents[a] = m.provider + ':' + m.model; });
  res.json({ agents: agents, provider: DEFAULT_PROVIDER, model: resolveModel('coder').model });
});

// ---- helpers ----
function extractJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}
// The browser sends prior turns so follow-ups like "even faster" or "undo that" make sense.
// Never trusted as-is: roles, per-message length, turn count and total size are all capped here.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = []; let budget = 3000;
  for (let i = raw.length - 1; i >= 0 && out.length < 12; i--) {
    const m = raw[i]; if (!m) continue;
    const role = m.role === 'assistant' ? 'assistant' : (m.role === 'user' ? 'user' : null);
    if (!role) continue;
    const content = String(m.content == null ? '' : m.content).slice(0, 1000);
    if (!content.trim()) continue;
    if (content.length > budget) break;                 // oldest turns fall off first
    budget -= content.length;
    out.unshift({ role: role, content: content });
  }
  return out;
}

// What the coder can see besides game.js: the lesson being worked on, the other project
// files, and the asset keys that actually exist. Without this it guesses, and a guessed
// asset key crashes the student's game.
function buildContextBlock(ctx) {
  let s = '';
  if (ctx.lessonTitle || ctx.lessonContext) {
    s += '\n\nWHAT THE STUDENT IS LEARNING RIGHT NOW';
    if (ctx.lessonTitle) s += ' — lesson: "' + ctx.lessonTitle + '"';
    s += '\n';
    if (ctx.lessonContext) s += '"""\n' + ctx.lessonContext + '\n"""\n';
    s += 'Stay close to what this lesson covers. If the student asks for something far beyond it, '
      + 'do the simplest version that works and mention that in "reply".';
  }
  if (ctx.assets && ctx.assets.length) {
    s += '\n\nASSETS THE STUDENT OWNS — these are the ONLY asset keys that exist:\n'
      + ctx.assets.map(function (a) { return '  ' + a.key + '  (' + a.type + ')'; }).join('\n')
      + '\nUse ONLY these keys. NEVER invent an asset key: a key that is not on this list fails to load and breaks the game. '
      + 'If the student wants art or a sound they do not own, say so in "reply" and tell them to buy it in the Store.';
  } else {
    s += '\n\nThe student owns no assets yet — do not reference any asset keys.';
  }
  if (ctx.files && ctx.files.length) {
    s += '\n\nOTHER FILES IN THIS PROJECT (game.js is already shown above — do not repeat it):\n'
      + ctx.files.map(function (f) { return '--- ' + f.name + ' ---\n' + f.code; }).join('\n');
  }
  return s;
}

// ---- asset-key validation (Stage 4 Tier 1, pulled forward) ----
// Telling a 7B model "these are the only keys that exist" is not enough — it still invents
// them, and a key that was never loaded fails silently and leaves the student with a broken
// game. So we check its answer instead of trusting it. Deterministic: works with any model.
//
// Where the key sits in each call. `add.text(x, y, 'hi')` is deliberately absent — its third
// argument is text to display, not a key.
const ASSET_USES = [
  { re: /\b(?:add|physics\.add|make)\.(?:sprite|image)\s*\(/g, arg: 2 },
  { re: /\b(?:add|make)\.tileSprite\s*\(/g, arg: 4 },
  { re: /\.create\s*\(/g, arg: 2 },                       // group.create(x, y, key)
  { re: /\bsound\.(?:play|add)\s*\(/g, arg: 0 },
  { re: /\.setTexture\s*\(/g, arg: 0 }
];
// A key can also be legitimately created at runtime rather than bought.
const ASSET_DEFS = [
  { re: /\bgenerateTexture\s*\(/g, arg: 0 },
  { re: /\bload\.(?:image|audio|spritesheet|atlas|bitmapFont)\s*\(/g, arg: 0 }
];
// Split a call's arguments at top level. Needed because arguments are real expressions —
// `Math.random() * (HEIGHT - 100)` has parens in it, which no flat regex survives.
function callArgs(text, open) {
  let depth = 0, start = open + 1, quote = null; const args = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(text.slice(start, i)); return args; }
      continue;
    }
    if (c === ',' && depth === 1) { args.push(text.slice(start, i)); start = i + 1; }
  }
  return args;   // unbalanced (truncated reply) — treat as no usable args
}
function stringArg(s) { const m = String(s).trim().match(/^(['"])([^'"]*)\1$/); return m ? m[2] : null; }
function opsCode(ops) {
  const out = [];
  ['create', 'update', 'replaceFile'].forEach(function (k) { if (typeof ops[k] === 'string') out.push(ops[k]); });
  if (Array.isArray(ops.functions)) ops.functions.forEach(function (f) { if (typeof f === 'string') out.push(f); });
  if (ops.newFile && typeof ops.newFile.code === 'string') out.push(ops.newFile.code);
  return out.join('\n');
}
function matchAll(text, specs) {
  const found = {};
  specs.forEach(function (spec) {
    spec.re.lastIndex = 0; let m;
    while ((m = spec.re.exec(text))) {
      const key = stringArg(callArgs(text, m.index + m[0].length - 1)[spec.arg]);
      if (key) found[key] = true;      // a non-literal (variable) argument is unknowable, so skip it
    }
  });
  return found;
}
// Keys the proposed change uses that the student does not own and nothing defines.
function unknownAssetKeys(ops, gameCode, owned) {
  const code = opsCode(ops);
  if (!code.trim()) return [];
  const defined = matchAll(gameCode + '\n' + code, ASSET_DEFS);   // existing code counts
  const ownedSet = {};
  (owned || []).forEach(function (a) { ownedSet[a.key] = true; });
  return Object.keys(matchAll(code, ASSET_USES))
    .filter(function (k) { return !ownedSet[k] && !defined[k]; });
}
function assetApology(bad, owned) {
  const names = bad.map(function (k) { return '"' + k + '"'; }).join(' and ');
  const have = (owned || []).slice(0, 6).map(function (a) { return a.key; }).join(', ');
  return 'I wanted to use ' + names + ', but you don’t own ' + (bad.length > 1 ? 'those' : 'that') + ' yet, so I left your game alone. '
    + (have ? 'You can use: ' + have + '. ' : '')
    + 'Buy more art and sounds in the Store, or ask me for something using what you have.';
}

// Lessons set `ai: guided` when the student is meant to make the design call themselves.
const GUIDED_RULES = '\n\nGUIDED MODE IS ON for this lesson — the student is supposed to decide what changes.\n'
  + '- If the request is vague ("make it cooler", "make it better", "add something", "surprise me"), change NOTHING. '
  + 'Reply with only {"reply":"..."} asking which specific thing to change, offering two or three concrete options.\n'
  + '- Only act when the request names what to change and roughly how ("make the player jump higher", "put a coin above the left platform").\n'
  + '- Make the smallest change that does it, and say in one short sentence what you changed.';

// Built-in fallbacks. Used only when ai/agents/*.md is missing or malformed, so a typo
// while authoring a prompt degrades to the previous behaviour instead of breaking the app.
function fallbackCoderSystem(gameCode, ctx) {
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
    + '- Output nothing but the single JSON object.'
    + buildContextBlock(ctx || {})
    + ((ctx && ctx.aiMode === 'guided') ? GUIDED_RULES : '');
}
function fallbackTutorSystem(gameCode, context, ctx) {
  const c = ctx || {};
  return 'You are a friendly coding tutor for kids aged 11-15 in a game-dev course. '
    + 'Explain clearly and help them UNDERSTAND rather than doing their work for them. '
    + 'ALWAYS answer in the context of JavaScript and the Phaser game library — NEVER use Python or any other language. '
    + 'Keep answers to about 2-4 short sentences; include a tiny JavaScript snippet only if it truly helps; never dump large code.\n'
    + 'Earlier turns of this conversation are included — when the student says "that" or "it", they mean what you were just talking about.\n'
    + (c.lessonTitle ? '\nThey are on the lesson "' + c.lessonTitle + '".\n' : '')
    + (context ? '\nThe student is asking about this part of the lesson:\n"""\n' + context + '\n"""\n' : '')
    + (gameCode ? '\nCurrent game.js for reference:\n```javascript\n' + gameCode + '\n```' : '');
}
const FALLBACK_AGENT_SYSTEMS = {
  quiz: 'You write short comprehension questions for kids (11-15) learning to code. Output ONLY a JSON object.',
  grader: 'You check a student\'s answer or code change for a kids coding course. Output ONLY a JSON object with {"pass": true/false, "hint": "..."}.'
};
async function callAI(spec, system, user, wantJSON, history) {
  const provider = spec.provider, model = spec.model;
  if (!model) throw new Error('No model set for ' + provider + ' — set it in .env');
  const hist = history || [];   // earlier turns, oldest first; sits between the system prompt and the new message
  if (provider === 'anthropic') {
    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: model, max_tokens: 4000, system: system, messages: hist.concat([{ role: 'user', content: user }]) })
    });
    if (!r.ok) throw new Error('Anthropic HTTP ' + r.status);
    const d = await r.json();
    return (d.content && d.content[0] && d.content[0].text) || '';
  }
  if (provider === 'openrouter') {
    if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set');
    const body = { model: model, messages: [{ role: 'system', content: system }].concat(hist, [{ role: 'user', content: user }]) };
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
  // num_predict must be generous: a "replaceFile" reply is a whole game.js, and a truncated
  // reply is unparseable JSON that would surface to the student as garbage.
  const body = { model: model, stream: false, options: { num_ctx: OLLAMA_NUM_CTX, num_predict: OLLAMA_NUM_PREDICT, temperature: 0.3 },
    messages: [{ role: 'system', content: system }].concat(hist, [{ role: 'user', content: user }]) };
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
  const history = sanitizeHistory(req.body && req.body.history);
  let agent = (req.body && req.body.agent) || 'coder';
  if (['coder', 'tutor', 'quiz', 'grader'].indexOf(agent) < 0) agent = 'coder';   // controller: keep to known agents
  const spec = resolveModel(agent);

  // Context the browser sends about where the student is and what exists in their project.
  const b = req.body || {};
  const ctx = {
    lessonTitle: (b.lessonTitle || '').toString().slice(0, 120),
    lessonContext: (b.lessonContext || '').toString().slice(0, 3000),
    aiMode: ['full', 'guided', 'off'].indexOf(b.aiMode) >= 0 ? b.aiMode : 'full',
    hasAssetList: Array.isArray(b.ownedAssets),   // only validate keys when the client actually told us what it owns
    assets: Array.isArray(b.ownedAssets) ? b.ownedAssets.slice(0, 300).map(function (a) {
      return { key: String((a && a.key) || '').slice(0, 60), type: String((a && a.type) || '').slice(0, 20) };
    }).filter(function (a) { return a.key; }) : [],
    files: Array.isArray(b.files) ? b.files.slice(0, 10).map(function (f) {
      return { name: String((f && f.name) || '').slice(0, 60), code: String((f && f.code) || '').slice(0, 6000) };
    }).filter(function (f) { return f.name && f.code; }) : []
  };

  // TUTOR: plain-language explanation, no code edits.
  if (agent === 'tutor') {
    let raw;
    const tutorSystem = ai.buildPrompt('tutor', Object.assign({ gameCode: gameCode }, ctx)) || fallbackTutorSystem(gameCode, context, ctx);
    try { raw = await callAI(spec, tutorSystem, message, false, history); }
    catch (e) { return res.status(502).json({ reply: 'The tutor is not reachable right now (' + e.message + ').' }); }
    return res.json({ reply: (raw || '').trim() || 'Hmm, I am not sure — try rephrasing.' });
  }

  // QUIZ / GRADER (scaffold): return whatever JSON the model produced.
  if (agent === 'quiz' || agent === 'grader') {
    let raw;
    const agentSystem = ai.buildPrompt(agent, ctx) || FALLBACK_AGENT_SYSTEMS[agent];
    try { raw = await callAI(spec, agentSystem, message, true); }
    catch (e) { return res.status(502).json({ error: 'The ' + agent + ' agent is not reachable (' + e.message + ').' }); }
    return res.json({ result: extractJSON(raw) || {} });
  }

  // CODER (default): return ops the browser applies to game.js.
  const system = ai.buildPrompt('coder', Object.assign({ gameCode: gameCode }, ctx)) || fallbackCoderSystem(gameCode, ctx);
  function toOps(parsed) {
    const ops = {};
    ['config', 'functions', 'create', 'update', 'newFile', 'replaceFile'].forEach(function (k) {
      if (parsed[k] !== undefined && parsed[k] !== null) ops[k] = parsed[k];
    });
    return ops;
  }
  let raw;
  try { raw = await callAI(spec, system, message, true, history); }
  catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
  let parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
  let ops = toOps(parsed);

  // Check the answer instead of trusting it: one corrective retry, then refuse the change.
  if (ctx.hasAssetList) {
    let bad = unknownAssetKeys(ops, gameCode, ctx.assets);
    if (bad.length) {
      const retry = message + '\n\nIMPORTANT: your previous answer used the asset key(s) '
        + bad.map(function (k) { return '"' + k + '"'; }).join(', ')
        + ', which do not exist and would break the game. '
        + 'Redo it using ONLY the owned asset keys listed above, or — if this cannot be done with those — '
        + 'change nothing and reply with only {"reply":"..."} explaining which asset they would need to buy.';
      try { raw = await callAI(spec, system, retry, true, history); }
      catch (e) { return res.status(502).json({ reply: 'The AI service is not reachable right now (' + e.message + ').' }); }
      parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
      ops = toOps(parsed);
      bad = unknownAssetKeys(ops, gameCode, ctx.assets);
      if (bad.length) return res.json({ reply: assetApology(bad, ctx.assets), ops: null });
    }
  }

  res.json({ reply: parsed.reply || 'Done.', ops: Object.keys(ops).length ? ops : null });
});

app.listen(PORT, () => {
  const c = resolveModel('coder'), t = resolveModel('tutor');
  console.log('Course agent on http://localhost:' + PORT + '  (coder: ' + c.provider + ':' + c.model + ' · tutor: ' + t.provider + ':' + t.model + ')');
});
