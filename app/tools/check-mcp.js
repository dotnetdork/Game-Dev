/* Starts ai/mcp-server.js as a real MCP client would and exercises every surface it offers.
   Run: node tools/check-mcp.js   (from the app/ directory) */
const path = require('path');
const fs = require('fs');

/* Read the real course rather than hardcoding what it used to contain. The first version asserted
   "at least 50 resources" and fetched a lesson by name; rewriting the course from 47 lessons to 22
   failed both, which told us nothing about the MCP server — the thing actually under test. The
   course is content and will keep changing; this checks the server against whatever it currently
   is. */
const yaml = require(path.join(__dirname, '..', 'public', 'vendor', 'js-yaml', 'js-yaml.min.js'));
const COURSE = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'content', 'course.yaml'), 'utf8')) || {};
const LESSON_IDS = (COURSE.modules || []).reduce(function (a, m) { return a.concat(m.lessons || []); }, []);
const SAMPLE_LESSON = LESSON_IDS[0];

async function main() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, '..', 'ai', 'mcp-server.js')]
  });
  const client = new Client({ name: 'check-mcp', version: '1.0.0' });
  await client.connect(transport);

  const fails = [];
  const check = function (label, ok, detail) {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  — ' + detail : ''));
    if (!ok) fails.push(label);
  };

  const tools = (await client.listTools()).tools;
  const resources = (await client.listResources()).resources;
  const prompts = (await client.listPrompts()).prompts;

  check('tools listed', tools.length === 5, tools.map(function (t) { return t.name; }).join(', '));
  // one per lesson, plus the outline, the asset catalogue and the Phaser reference
  check('resources listed', resources.length >= LESSON_IDS.length, resources.length + ' resources for ' + LESSON_IDS.length + ' lessons');
  // 5 agents (coder, tutor, lab-tutor, quiz, grader) + 4 skills. Adding an agent or a skill under
  // ai/ is expected to move this number; it exists to catch one going missing.
  check('prompts listed', prompts.length === 9, prompts.map(function (p) { return p.name; }).join(', '));

  // every tool advertises a schema the client can actually use
  const schemaOk = tools.every(function (t) { return t.inputSchema && t.inputSchema.type === 'object'; });
  check('tool schemas well-formed', schemaOk);

  // a real lookup: the Phaser reference
  const phaser = await client.callTool({ name: 'search_phaser_docs', arguments: { query: 'detect a key press' } });
  const phaserText = phaser.content[0].text;
  check('search_phaser_docs returns a section', /cursors|keyboard|createCursorKeys/i.test(phaserText),
    phaserText.slice(0, 60).replace(/\s+/g, ' '));

  // the store, searched with no student session — should see the whole catalogue
  const store = await client.callTool({ name: 'search_store', arguments: { query: 'enemy' } });
  const matches = JSON.parse(store.content[0].text).matches || [];
  check('search_store finds catalogue items', matches.length > 0,
    matches.length + ' matches: ' + matches.slice(0, 3).map(function (m) { return m.key; }).join(', '));

  // and a query with nothing behind it returns empty rather than inventing a key
  const none = await client.callTool({ name: 'search_store', arguments: { query: 'zzzznotathing' } });
  check('search_store invents nothing', (JSON.parse(none.content[0].text).matches || []).length === 0);

  // a lesson by id
  const lesson = await client.callTool({ name: 'get_lesson', arguments: { id: SAMPLE_LESSON } });
  const got = JSON.parse(lesson.content[0].text);
  check('get_lesson reads a lesson', !!got.title && (got.text || '').length > 50, got.title);

  // a bad lesson id must not leak a path or throw
  const bad = await client.callTool({ name: 'get_lesson', arguments: { id: '../../../etc/passwd' } });
  const badOut = bad.content[0].text;
  check('path traversal refused', /Not a valid lesson id/.test(badOut), badOut.slice(0, 50).replace(/\s+/g, ' '));

  // session-dependent tools say so instead of answering emptily
  const owned = await client.callTool({ name: 'list_owned_assets', arguments: {} });
  check('list_owned_assets explains it needs a session', owned.isError === true && /no student session/i.test(owned.content[0].text));

  // resources
  const outline = await client.readResource({ uri: 'course://outline' });
  check('course outline readable', /modules:/.test(outline.contents[0].text));

  const one = await client.readResource({ uri: 'lesson://' + SAMPLE_LESSON });
  check('lesson resource readable', /title:/.test(one.contents[0].text), one.contents[0].text.split('\n')[1]);

  const cat = await client.readResource({ uri: 'catalog://store' });
  const catJson = JSON.parse(cat.contents[0].text);
  check('store catalogue parses', Array.isArray(catJson) && catJson.length > 100, catJson.length + ' assets');

  // prompts
  const coder = await client.getPrompt({ name: 'agent-coder', arguments: {} });
  check('coder agent prompt readable', coder.messages[0].content.text.length > 200);

  await client.close();
  console.log('\n' + (fails.length ? fails.length + ' FAILING: ' + fails.join('; ') : 'all MCP checks passed'));
  process.exit(fails.length ? 1 : 0);
}

main().catch(function (e) { console.error(e); process.exit(1); });
