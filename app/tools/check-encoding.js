/* check-encoding.js — no source file may contain a NUL byte.
 *
 * This exists because of one character in server.js.
 *
 * Line 466 held a sentinel string that could never match — the intent was `'\0'`, and what
 * was actually in the file was a raw NUL byte between two apostrophes. As far as Node is
 * concerned those are identical: a one-character string containing U+0000. The server ran
 * correctly for as long as it was there and nothing about the app ever looked wrong.
 *
 * What it broke was searching. ripgrep — which is what `grep` is in most editors and in
 * every agent tool built on it — treats a file containing a NUL byte as binary and skips
 * it, silently. No warning, no "binary file matches" unless you ask for it. So for the
 * whole life of that byte, every search across this repo quietly excluded the single
 * biggest and most important file in it.
 *
 * That is not a hypothetical cost. Searching for `grader` across app/ returned three
 * files and did not return server.js, which made the grading agent look completely
 * unrouted when in fact it is whitelisted at server.js:644 and handled at :693. A whole
 * piece of work was nearly planned around a gap the tooling had invented.
 *
 * This project has a history with exactly this failure mode — three of its checks were
 * once unrunnable or vacuous, and every one of them reported success. A search that finds
 * nothing and a check that tests nothing are the same bug: a tool that says "fine" when it
 * means "I did not look". So this is a check, not a comment.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXTS = ['.js', '.mjs', '.cjs', '.json', '.md', '.css', '.html', '.yaml', '.yml', '.txt'];
const SKIP_DIRS = ['node_modules', '.git', 'vendor', 'assets', 'img'];

const problems = [];
let scanned = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.indexOf(entry.name) >= 0) continue;
      walk(full);
      continue;
    }
    if (EXTS.indexOf(path.extname(entry.name).toLowerCase()) < 0) continue;
    scanned++;
    const buf = fs.readFileSync(full);
    const at = buf.indexOf(0);
    if (at < 0) continue;
    // Report the line, because a byte offset is not something you can go and look at.
    let line = 1;
    for (let i = 0; i < at; i++) if (buf[i] === 10) line++;
    problems.push({ file: path.relative(ROOT, full), line: line, offset: at });
  }
}

walk(ROOT);

console.log(scanned + ' source files scanned for NUL bytes');

if (problems.length) {
  console.error('');
  problems.forEach(function (p) {
    console.error('FAIL  ' + p.file + ':' + p.line + ' contains a NUL byte (offset ' + p.offset + ')');
  });
  console.error('\nA NUL byte makes ripgrep treat the file as binary and skip it, so every');
  console.error('grep over this repo will silently stop searching it — no warning, no match,');
  console.error('no way to tell that from "there is nothing there".');
  console.error('If you meant a NUL character in a string, write the escape \\0 instead. It');
  console.error('is the same value to JavaScript and it leaves the file readable as text.');
  process.exit(1);
}

/* Finding nothing to scan is a failure, not a pass — the trap check-challenges.js fell into. */
if (!scanned) {
  console.error('FAIL  no source files found under ' + ROOT + ' — this script is looking in the wrong place.');
  process.exit(1);
}
console.log('no NUL bytes: every source file is searchable');
