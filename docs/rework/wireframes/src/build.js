// Assembles a wireframe from its template: {{CSS}}, {{ICONS}} and {{LOGO}} are replaced with
// base.css, icons.svg and logo.txt (the League wordmark as a data URI), so the output is one
// self-contained HTML file that opens from disk with no server.
//   node docs/rework/wireframes/src/build.js 03-shift-silent-coins
// Edit the template, not the output: the output is overwritten.
const fs = require('fs'), path = require('path');
const name = process.argv[2] || '03-shift-silent-coins';
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const out = read(name + '.template.html')
  .replace('{{CSS}}', () => read('base.css'))
  .replace('{{ICONS}}', () => read('icons.svg'))
  .replace('{{LOGO}}', () => read('logo.txt').trim());
fs.writeFileSync(path.join(__dirname, '..', name + '.html'), out);
console.log('wrote docs/rework/wireframes/' + name + '.html');
