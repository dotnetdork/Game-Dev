/* Starts ai/mcp-server.js as a real MCP client would and exercises every surface it offers.
   Run: node tools/check-mcp.js   (from the app/ directory) */
const path = require('path');

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
  check('resources listed', resources.length >= 50, resources.length + ' resources');
  check('prompts listed', prompts.length === 8, prompts.map(function (p) { return p.name; }).join(', '));

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
  const lesson = await client.callTool({ name: 'get_lesson', arguments: { id: 'moving-with-velocity' } });
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

  const one = await client.readResource({ uri: 'lesson://the-game-loop' });
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
