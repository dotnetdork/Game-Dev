/* check-html.js — tag-balance check for public/index.html.
 *
 * Written after a real bug: `<div class="center">` was renamed to `<main class="center">` but its
 * closing `</div>` was left alone. Browsers do not report that. The parser hits the stray `</div>`,
 * walks up the stack of open elements looking for a div, finds the one two levels UP, and closes
 * that instead — so the AI panel ended up outside #editor and stopped hiding when you switched to
 * another page. The page still rendered. Nothing logged. It took a bug report to notice.
 *
 * This is a balance check, not a parser: index.html is hand-written and well-formed by intent, so
 * a stack of open tags is enough to catch a mismatch the moment it is introduced.
 *
 * Run: node app/tools/check-html.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'public', 'index.html');
const src = fs.readFileSync(file, 'utf8');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr', '!doctype']);
/* Tags the HTML spec lets you leave open. index.html does not use them, but listing them keeps
   the check honest rather than accidentally strict. */
const OPTIONAL_CLOSE = new Set(['html', 'head', 'body', 'p', 'li', 'tr', 'td', 'th', 'option']);

const lineOf = (i) => src.slice(0, i).split('\n').length;

const stack = [];
const errors = [];
const tag = /<(\/?)([a-zA-Z!][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
let m;
while ((m = tag.exec(src)) !== null) {
  const closing = m[1] === '/', name = m[2].toLowerCase(), selfClosed = m[3] === '/';
  if (VOID.has(name) || selfClosed) continue;
  if (name === 'script' || name === 'style') {                 // skip their text content wholesale
    if (!closing) { const end = src.indexOf('</' + name, tag.lastIndex); if (end > -1) tag.lastIndex = end; }
    continue;
  }
  if (!closing) { stack.push({ name: name, line: lineOf(m.index) }); continue; }

  const top = stack[stack.length - 1];
  if (!top) { errors.push('line ' + lineOf(m.index) + ': stray </' + name + '> with nothing open'); continue; }
  if (top.name === name) { stack.pop(); continue; }
  if (OPTIONAL_CLOSE.has(top.name)) { stack.pop(); tag.lastIndex = m.index; continue; }
  errors.push('line ' + lineOf(m.index) + ': </' + name + '> closes <' + top.name + '> opened on line '
    + top.line + '  — a rename that missed its closing tag looks exactly like this');
  stack.pop();
}
stack.filter(function (t) { return !OPTIONAL_CLOSE.has(t.name); })
  .forEach(function (t) { errors.push('line ' + t.line + ': <' + t.name + '> is never closed'); });

/* Containment invariants the layout actually depends on. The tag-balance check above would have
   caught the bug that prompted this file, but these say out loud what the structure is FOR. */
function inside(childRe, parentId) {
  const c = src.search(childRe);
  if (c < 0) return 'element ' + childRe + ' not found';
  const open = src.indexOf('id="' + parentId + '"');
  if (open < 0) return '#' + parentId + ' not found';
  return c > open ? null : '#' + parentId + ' must open before ' + childRe;
}
[
  [/<aside class="dock left"/, 'editor'],
  [/<main class="center"/, 'editor'],
  [/<aside class="dock right"/, 'editor']
].forEach(function (pair) {
  const err = inside(pair[0], pair[1]);
  if (err) errors.push(err);
});

if (errors.length) {
  console.error('index.html: ' + errors.length + ' problem(s)\n');
  errors.forEach(function (e) { console.error('  ' + e); });
  process.exit(1);
}
console.log('index.html: tags balanced, docks and main are inside #editor');
