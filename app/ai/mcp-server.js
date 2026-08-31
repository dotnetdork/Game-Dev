#!/usr/bin/env node
// ============================================================
//  MCP server — the same things the course's own agents can look
//  up, offered to any MCP client over stdio.
//
//  MCP (Model Context Protocol) is a standard way for an AI client
//  to discover and call things a server offers. It has three kinds:
//
//    tools     — actions the model can call     (look something up)
//    resources — documents the model can read   (a lesson, the catalogue)
//    prompts   — reusable instruction text      (our agent + skill files)
//
//  This is deliberately a THIN wrapper. The tools come straight from
//  ai/tools.js, which the coder and tutor already use in-process, so
//  there is exactly one definition of what a tool does. If the two
//  ever disagree, that is a bug here, not a second implementation.
//
//  READ ONLY, on purpose. Nothing here can change a student's project
//  or write a file. The coder still changes a game through the ops
//  contract, which the student reviews and accepts in the editor.
//
//  Run:      node ai/mcp-server.js
//  Used by:  Claude Code, via .mcp.json at the repo root
// ============================================================
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const { TOOLS, runTool } = require('./tools.js');

const AI_DIR = __dirname;
const ROOT = path.join(AI_DIR, '..');
const LESSONS = path.join(ROOT, 'content', 'lessons');
const COURSE_YAML = path.join(ROOT, 'content', 'course.yaml');

const server = new McpServer(
  { name: 'league-gamedev', version: '1.0.0' },
  {
    instructions:
      'Course content and reference for the LEAGUE game-development course (Phaser 3, students aged 11-14). ' +
      'Use search_phaser_docs before writing Phaser code, get_lesson to check what a student has been taught, ' +
      'and search_store to find art and sound. Everything here is read-only.'
  }
);

/* ---------- tools ----------
   tools.js describes parameters in JSON Schema; this SDK wants a Zod shape. The schemas in
   play are a handful of single string arguments, so the conversion is small and explicit —
   and it throws on anything it does not understand rather than silently mistyping a tool. */
function zodShape(schema) {
  const props = (schema && schema.properties) || {};
  const required = (schema && schema.required) || [];
  const shape = {};
  Object.keys(props).forEach(function (key) {
    const p = props[key] || {};
    let v;
    if (p.type === 'string') v = z.string();
    else if (p.type === 'number' || p.type === 'integer') v = z.number();
    else if (p.type === 'boolean') v = z.boolean();
    else throw new Error('tools.js: unsupported parameter type "' + p.type + '" on ' + key);
    if (p.description) v = v.describe(p.description);
    if (required.indexOf(key) < 0) v = v.optional();
    shape[key] = v;
  });
  return shape;
}

/* Two of the five tools answer questions about a specific student's session — which assets they
   own, what is in their files. Over MCP there is no student, so they answer honestly rather than
   returning a confident empty list that reads like "this student owns nothing". */
const NEEDS_STUDENT = {
  list_owned_assets: 'Over MCP there is no student session, so ownership is unknown. Use search_store to browse the whole catalogue instead.',
  read_file: 'Over MCP there is no student project to read. This tool only works inside the running course app.'
};

TOOLS.forEach(function (tool) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: zodShape(tool.parameters) },
    async function (args) {
      if (NEEDS_STUDENT[tool.name]) {
        return { content: [{ type: 'text', text: NEEDS_STUDENT[tool.name] }], isError: true };
      }
      // Empty ctx: no student session. search_store then searches the whole catalogue, which is
      // exactly what someone authoring a lesson wants.
      const result = runTool(tool.name, args || {}, {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
});

/* ---------- resources ---------- */
function lessonIds() {
  try {
    return fs.readdirSync(LESSONS)
      .filter(function (f) { return f.endsWith('.md'); })
      .map(function (f) { return f.slice(0, -3); });
  } catch (e) { return []; }
}
function lessonTitle(id) {
  try {
    const raw = fs.readFileSync(path.join(LESSONS, id + '.md'), 'utf8');
    const m = raw.match(/^title:\s*(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : id;
  } catch (e) { return id; }
}

lessonIds().forEach(function (id) {
  server.registerResource(
    'lesson-' + id,
    'lesson://' + id,
    { title: lessonTitle(id), description: 'Course lesson: ' + lessonTitle(id), mimeType: 'text/markdown' },
    async function (uri) {
      const text = fs.readFileSync(path.join(LESSONS, id + '.md'), 'utf8');
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: text }] };
    }
  );
});

server.registerResource(
  'course-outline',
  'course://outline',
  { title: 'Course outline', description: 'Modules and the lesson ids in each, in order.', mimeType: 'text/yaml' },
  async function (uri) {
    const text = fs.readFileSync(COURSE_YAML, 'utf8');
    return { contents: [{ uri: uri.href, mimeType: 'text/yaml', text: text }] };
  }
);

server.registerResource(
  'store-catalogue',
  'catalog://store',
  { title: 'Asset store catalogue', description: 'Every art and sound asset a student can buy, with keys and costs.', mimeType: 'application/json' },
  async function (uri) {
    /* Run the generated file against a stand-in `window` rather than slicing an array out of it by
       string index. The slice worked only while the manifest held exactly one array; it now assigns
       three (packs, bundles, assets), so it produced a fragment spanning all of them that no JSON
       parser would accept. */
    const src = fs.readFileSync(path.join(ROOT, 'public', 'assets-manifest.js'), 'utf8');
    const win = {};
    new Function('window', src)(win);
    const json = JSON.stringify(win.STORE_ASSETS || []);
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: json }] };
  }
);

server.registerResource(
  'phaser-reference',
  'reference://phaser',
  { title: 'Phaser API reference', description: 'The curated Phaser 3 reference the coder agent is held to.', mimeType: 'text/markdown' },
  async function (uri) {
    const text = fs.readFileSync(path.join(AI_DIR, 'reference', 'phaser-api.md'), 'utf8');
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: text }] };
  }
);

/* ---------- prompts ----------
   The agent and skill markdown, exposed as-is. These are the actual teaching rules the course
   runs on, so anyone reviewing or extending the AI's behaviour reads the same text it does.
   Unfilled: {{placeholders}} are substituted per request inside the app, and there is no
   request here. */
function registerPromptDir(dir, kind) {
  let files = [];
  try { files = fs.readdirSync(path.join(AI_DIR, dir)).filter(function (f) { return f.endsWith('.md'); }); }
  catch (e) { return; }
  files.forEach(function (file) {
    const name = file.slice(0, -3);
    server.registerPrompt(
      kind + '-' + name,
      { description: 'The ' + kind + ' instructions for "' + name + '", as the course uses them.' },
      async function () {
        const text = fs.readFileSync(path.join(AI_DIR, dir, file), 'utf8');
        return { messages: [{ role: 'user', content: { type: 'text', text: text } }] };
      }
    );
  });
}
registerPromptDir('agents', 'agent');
registerPromptDir('skills', 'skill');

/* stdio: the client launches this process and talks over stdin/stdout. Nothing may be written
   to stdout except protocol messages, so any logging goes to stderr. */
async function main() {
  await server.connect(new StdioServerTransport());
  console.error('[mcp] league-gamedev ready');
}
main().catch(function (e) {
  console.error('[mcp] failed to start: ' + (e && e.stack || e));
  process.exit(1);
});
