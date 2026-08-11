// ============================================================
//  The tools an agent can call to look something up instead of
//  guessing: what the student owns, what a lesson says, what is
//  in one of their files, and what a Phaser API is actually called.
//
//  This table IS the MCP surface (Stage 5). Keep each tool a plain
//  function of (args, ctx) with a JSON-schema description, and the
//  MCP server becomes a thin wrapper rather than a rewrite.
//
//  Everything here is READ ONLY. Tools answer questions; the coder
//  still changes the game through the ops contract, which the
//  student reviews. Nothing in here can write to a student's project.
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LESSONS = path.join(ROOT, 'content', 'lessons');
const REFERENCE = path.join(__dirname, 'reference', 'phaser-api.md');

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
const SAFE_FILE = /^[A-Za-z0-9_-]+\.js$/;

let catalogCache = null;
/* The Store catalogue. assets-manifest.js is a generated browser file (`window.STORE_ASSETS = [...]`),
   so the array is sliced out rather than duplicating it into a second source of truth. */
function catalog() {
  if (catalogCache) return catalogCache;
  try {
    const src = fs.readFileSync(path.join(ROOT, 'public', 'assets-manifest.js'), 'utf8');
    catalogCache = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
  } catch (e) { catalogCache = []; }
  return catalogCache;
}

const TOOLS = [
  {
    name: 'list_owned_assets',
    description: "List the art and sound keys this student owns. These are the ONLY asset keys that exist for them — anything else fails to load and breaks the game. Call this before using any asset key you are not certain about.",
    parameters: { type: 'object', properties: {}, required: [] },
    run: function (args, ctx) {
      const owned = ctx.assets || [];
      if (!owned.length) return { owned: [], note: 'This student owns no assets yet.' };
      const meta = {};
      catalog().forEach(function (a) { meta[a.key] = a; });
      return { owned: owned.map(function (a) {
        const m = meta[a.key] || {};
        return { key: a.key, type: a.type, category: m.cat || '', usage: m.hint || '' };
      }) };
    }
  },
  {
    name: 'search_store',
    description: 'Search the Store for art or sounds the student does NOT own yet, so you can tell them what to buy. Never use a key from here in code — they do not own it.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'what to look for, e.g. "dragon" or "explosion"' } }, required: ['query'] },
    run: function (args, ctx) {
      const q = String(args.query || '').toLowerCase().trim();
      if (!q) return { matches: [] };
      const ownedKeys = {};
      (ctx.assets || []).forEach(function (a) { ownedKeys[a.key] = true; });
      const hits = catalog().filter(function (a) {
        return !ownedKeys[a.key] && ((a.key + ' ' + a.name + ' ' + a.cat + ' ' + (a.desc || '')).toLowerCase().indexOf(q) >= 0);
      }).slice(0, 12);
      return { matches: hits.map(function (a) { return { key: a.key, name: a.name, category: a.cat, cost: a.cost, owned: false }; }) };
    }
  },
  {
    name: 'read_file',
    description: "Read one of the student's project files in full. Use this when you need to change code that lives outside game.js, or to check what a helper function actually does before calling it.",
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'file name, e.g. "player.js"' } }, required: ['name'] },
    run: function (args, ctx) {
      const name = String(args.name || '').trim();
      if (!SAFE_FILE.test(name)) return { error: 'Not a valid file name.' };
      if (name === 'game.js') return { name: name, code: ctx.gameCode || '' };
      const f = (ctx.files || []).filter(function (x) { return x.name === name; })[0];
      if (!f) return { error: 'No such file. The project has: ' + ['game.js'].concat((ctx.files || []).map(function (x) { return x.name; })).join(', ') };
      if (!f.code) return { error: 'That file exists but its contents were not sent with this request.' };
      return { name: name, code: f.code };
    }
  },
  {
    name: 'search_phaser_docs',
    description: 'Look up how to do something in Phaser 3 — the real method names for movement, collisions, keys, sound, tweens, drawing and so on. Use this instead of guessing an API.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'what you want to do, e.g. "make something spin" or "detect a key press"' } }, required: ['query'] },
    run: function (args) {
      let doc = '';
      try { doc = fs.readFileSync(REFERENCE, 'utf8'); } catch (e) { return { error: 'Reference unavailable.' }; }
      const words = String(args.query || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
      const sections = doc.split(/\n(?=## )/).filter(function (s) { return s.indexOf('## ') === 0; });
      const scored = sections.map(function (s) {
        const hay = s.toLowerCase();
        return { s: s, score: words.reduce(function (n, w) { return n + (hay.indexOf(w) >= 0 ? 1 : 0); }, 0) };
      }).filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; });
      if (!scored.length) return { sections: [], note: 'Nothing matched. Stick to the patterns already in the student\'s code.' };
      return { sections: scored.slice(0, 3).map(function (x) { return x.s.trim(); }) };
    }
  },
  {
    name: 'get_lesson',
    description: 'Read the text of a course lesson, to check what the student has actually been taught before using an idea they may not have met yet.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'lesson id, e.g. "moving-with-velocity". Omit to get the current lesson.' } }, required: [] },
    run: function (args, ctx) {
      const id = String(args.id || '').trim();
      if (!id) return { title: ctx.lessonTitle || '(none)', text: ctx.lessonContext || 'No lesson text for this request.' };
      if (!SAFE_ID.test(id)) return { error: 'Not a valid lesson id.' };
      try {
        const raw = fs.readFileSync(path.join(LESSONS, id + '.md'), 'utf8');
        const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
        const title = m ? (m[1].match(/^title:\s*(.+)$/m) || [, id])[1].trim() : id;
        return { id: id, title: title, text: (m ? m[2] : raw).slice(0, 4000) };
      } catch (e) {
        return { error: 'No lesson called "' + id + '".' };
      }
    }
  }
];

const BY_NAME = {};
TOOLS.forEach(function (t) { BY_NAME[t.name] = t; });

/* Tool definitions in the shape Ollama and OpenRouter want (OpenAI style). */
function toolSpecs() {
  return TOOLS.map(function (t) {
    return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } };
  });
}
/* Anthropic uses its own field names for the same thing. */
function anthropicSpecs() {
  return TOOLS.map(function (t) {
    return { name: t.name, description: t.description, input_schema: t.parameters };
  });
}
/* Run one tool. Never throws: a tool failure becomes a result the model can read and recover from. */
function runTool(name, args, ctx) {
  const t = BY_NAME[name];
  if (!t) return { error: 'No tool called "' + name + '". Available: ' + TOOLS.map(function (x) { return x.name; }).join(', ') };
  try { return t.run(args || {}, ctx || {}); }
  catch (e) { return { error: 'That lookup failed: ' + e.message }; }
}

module.exports = { TOOLS: TOOLS, toolSpecs: toolSpecs, anthropicSpecs: anthropicSpecs, runTool: runTool };
