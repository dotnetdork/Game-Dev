/* check-vocab.js — does a lesson lean on something a later lesson is the one to teach?
 *
 * Every other check in this suite asks whether a lesson is WELL FORMED: the quiz parses, the lab
 * is solvable, the figure has a credit, the prose is interleaved. All of them pass happily on a
 * lesson a student cannot follow, because the thing that makes it unfollowable is not in the
 * lesson at all — it is in the ORDER. A word used nine lessons before anything defines it reads
 * perfectly to the person who wrote it and stops a ten-year-old dead.
 *
 * The case that prompted this: lesson 1 asks a student to restore a missing line inside a
 * `function`, uses that word four times without defining it, and the course does not reach
 * functions until lesson 11. Twelve checks passed on that lesson.
 *
 * So this one reads content/vocabulary.yaml (which lesson teaches what), walks the lessons in
 * course.yaml order, and reports anything used before its turn. Two kinds:
 *
 *   terms   — words in the prose a student is expected to already know
 *   syntax  — shapes of code inside a ```run cell or a lab they are expected to already read
 *
 * A REPORT for now, not a failure, for the same reason the pacing check landed as one: the list is
 * long on the day it arrives, and a check that fails everything gets switched off rather than
 * fixed. Promote it when the count reaches zero.
 *
 * Run: node app/tools/check-vocab.js
 */
const fs = require('fs');
const path = require('path');
const yaml = require('../public/vendor/js-yaml/js-yaml.min.js');

const CONTENT = path.join(__dirname, '..', 'content');
const LESSONS = path.join(CONTENT, 'lessons');

const course = yaml.load(fs.readFileSync(path.join(CONTENT, 'course.yaml'), 'utf8')) || {};
const vocab = yaml.load(fs.readFileSync(path.join(CONTENT, 'vocabulary.yaml'), 'utf8')) || {};

/* Lesson id -> its position in the course, which is the only thing "before" and "after" can mean. */
const order = [];
(course.modules || []).forEach(function (m) { (m.lessons || []).forEach(function (id) { order.push(id); }); });
const posOf = {};
order.forEach(function (id, i) { posOf[id] = i; });

/* Every id in vocabulary.yaml has to be a lesson that exists, or the check silently stops covering
   whatever it names — the exact failure mode it is here to prevent. */
let broken = 0;
function owner(id, what) {
  if (posOf[id] === undefined) {
    console.error('FAIL  vocabulary.yaml points "' + what + '" at "' + id + '", which is not a lesson in course.yaml.');
    broken++;
    return null;
  }
  return posOf[id];
}

/* Prose only: front-matter, fenced blocks, HTML tags, inline code and figure captions are all
   either not prose or not the author talking to the student. A term inside a caption naming a
   screenshot is not the lesson relying on the word. */
function proseOf(raw) {
  return raw
    .replace(/^---[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<figure[\s\S]*?<\/figure>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/`[^`]*`/g, ' ');
}

/* The code a student is shown and expected to read: run cells, and the lab's starting code. The
   lab's `solution:` is deliberately not included — that is the answer, not the teaching. */
function codeOf(raw) {
  const out = [];
  let m;
  const run = /```run\r?\n([\s\S]*?)\r?\n```/g;
  while ((m = run.exec(raw))) out.push(m[1]);
  const lab = /```challenge\r?\n([\s\S]*?)\r?\n```/g;
  while ((m = lab.exec(raw))) {
    const code = m[1].match(/\ncode: \|\r?\n([\s\S]*?)$/);
    if (code) out.push(code[1]);
  }
  return out.join('\n');
}

const findings = [];
order.forEach(function (id, pos) {
  let raw = '';
  try { raw = fs.readFileSync(path.join(LESSONS, id + '.md'), 'utf8'); } catch (e) { return; }
  const prose = proseOf(raw).toLowerCase();
  const code = codeOf(raw);

  Object.keys(vocab.terms || {}).forEach(function (term) {
    const taught = owner(vocab.terms[term], term);
    if (taught === null || taught <= pos) return;
    const re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?\\b', 'i');
    if (re.test(prose)) {
      findings.push({ pos: pos, lesson: id, kind: 'term', what: '"' + term + '"', taught: vocab.terms[term], taughtPos: taught });
    }
  });

  (vocab.syntax || []).forEach(function (s) {
    const taught = owner(s.teaches, s.id);
    if (taught === null || taught <= pos) return;
    if (new RegExp(s.match).test(code)) {
      findings.push({ pos: pos, lesson: id, kind: 'syntax', what: s.id, taught: s.teaches, taughtPos: taught });
    }
  });
});

console.log(order.length + ' lessons, ' + Object.keys(vocab.terms || {}).length + ' terms and '
  + (vocab.syntax || []).length + ' syntax shapes tracked');

if (!findings.length) {
  console.log('nothing is used before the lesson that teaches it');
} else {
  /* Sorted by how far ahead of itself the course is reaching. A word borrowed from the very next
     lesson is a small thing; one borrowed from ten lessons away is the student being asked to
     know something the course has not got to yet, and those are the ones worth fixing first. */
  findings.sort(function (a, b) { return (b.taughtPos - b.pos) - (a.taughtPos - a.pos); });
  console.log('report: ' + findings.length + ' uses of something the course teaches later:');
  findings.forEach(function (f) {
    console.log('    lesson ' + String(f.pos + 1).padStart(2) + '  ' + f.lesson.padEnd(26)
      + ' uses ' + (f.kind === 'syntax' ? '' : 'the term ') + f.what
      + ' — taught in lesson ' + (f.taughtPos + 1) + ' (' + f.taught + ')');
  });
  console.log('  Two ways to fix one of these, and neither is "delete the sentence": explain the');
  console.log('  idea where it is first used, or move the lesson that owns it earlier.');
}

process.exit(broken ? 1 : 0);
