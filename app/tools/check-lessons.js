/* check-lessons.js — the authored quizzes and your-turn steps are actually answerable.
 *
 * Two real bugs motivated this, and both were invisible in the browser:
 *
 *   1. All 22 lessons wrote the question as `question:`; the renderer read `prompt:` and fell back
 *      to the words "Quick check". Every quiz in the course displayed no question for three
 *      commits. Nothing looked broken — the card, the options and the Check button were all there.
 *
 *   2. Three quiz blocks had YAML that does not parse (a value starting with a backtick, and a
 *      value starting with a double quote followed by more text — both need the whole value
 *      quoted). The renderer catches that and renders an EMPTY card, so those three lessons could
 *      never be completed by any student, and the page showed no error.
 *
 * Both are content mistakes that only a program will ever catch reliably, because the failure looks
 * like a card that is merely a bit sparse. `check-challenges.js` does this job for the labs; this
 * does it for everything else a lesson asks of a student.
 *
 * Run: node app/tools/check-lessons.js
 */
const fs = require('fs');
const path = require('path');
const yaml = require('../public/vendor/js-yaml/js-yaml.min.js');

const DIR = process.argv[2] || path.join(__dirname, '..', 'content', 'lessons');
const QUIZ = /```quiz\r?\n([\s\S]*?)```/g;
const YOURTURN = /```yourturn\r?\n([\s\S]*?)```/g;
const CHALLENGE = /```challenge\r?\n([\s\S]*?)```/g;
const KNOWN_TYPES = ['mcq', 'predict', 'parsons', 'fillblank', 'findbug'];

const problems = [];
let quizzes = 0, yourturns = 0, challenges = 0;
/* How many multiple-choice answers sit at each authored position, tallied for the position-bias
   report at the bottom of this file. */
const answerAt = {};

function fail(where, msg) { problems.push(where + ': ' + msg); }

/* The renderer accepts either name (widgets.js quizPrompt). New content should use `question:`. */
function promptOf(q) {
  const p = q && (q.question || q.prompt);
  return typeof p === 'string' && p.trim() ? p.trim() : '';
}

function checkQuiz(where, src) {
  let q;
  try { q = yaml.load(src); }
  catch (e) {
    // This is the one that renders a blank card. Point at the usual cause rather than just the line.
    fail(where, 'the YAML does not parse (' + String(e.message).split('\n')[0] + ').'
      + ' A value that starts with ` or " or contains ": " must be wrapped in quotes.');
    return;
  }
  if (!q || typeof q !== 'object' || Array.isArray(q)) { fail(where, 'is empty or is not a set of keys'); return; }

  if (!promptOf(q)) fail(where, 'has no `question:` — the card would say "Quick check" and ask nothing');

  const type = q.type || 'mcq';
  if (KNOWN_TYPES.indexOf(type) < 0) {
    fail(where, 'has type "' + type + '", which the app does not know — it would silently render as mcq. Known: ' + KNOWN_TYPES.join(', '));
    return;
  }

  if (type === 'mcq' || type === 'predict') {
    if (!Array.isArray(q.options) || q.options.length < 2) { fail(where, 'needs at least 2 `options:`'); return; }
    const n = q.options.length;
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= n) {
      fail(where, '`answer: ' + JSON.stringify(q.answer) + '` is not a position in the ' + n + ' options (0 to ' + (n - 1) + '), so no option can be marked right');
    } else {
      answerAt['answer=' + q.answer] = (answerAt['answer=' + q.answer] || 0) + 1;
    }
    // Not fatal, but a feedback list that has slipped out of step teaches the wrong option.
    if (Array.isArray(q.feedback) && q.feedback.length !== n) {
      fail(where, 'has ' + q.feedback.length + ' `feedback:` lines for ' + n + ' options — they are matched by position, so they are now against the wrong answers');
    }
    if (type === 'predict' && !q.code) fail(where, 'is type predict but has no `code:` to predict the output of');
  }

  if (type === 'findbug') {
    const lines = q.code || q.lines;
    if (!Array.isArray(lines) || !lines.length) { fail(where, 'is type findbug and needs `code:` as a list of lines'); return; }
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= lines.length) {
      fail(where, '`answer: ' + JSON.stringify(q.answer) + '` is not one of the ' + lines.length + ' lines, so the buggy line can never be found');
    }
  }

  if (type === 'fillblank') {
    const tpl = String(q.code || q.template || '');
    if (!tpl) fail(where, 'is type fillblank and needs `code:` (or `template:`)');
    else if (tpl.indexOf('___') < 0) fail(where, 'is type fillblank but its text has no ___ to fill in, so no input box appears');
    const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
    if (!answers.length || answers.some(function (a) { return typeof a !== 'string' || !a.trim(); })) {
      fail(where, 'needs an `answer:` (or a list of accepted answers) as text');
    }
  }

  if (type === 'parsons') {
    if (!Array.isArray(q.lines) || q.lines.length < 2) { fail(where, 'is type parsons and needs at least 2 `lines:` in the right order'); return; }
    if (q.lines.some(function (l) { return typeof l !== 'string' || !l.trim(); })) fail(where, 'has a blank entry in `lines:`');
    if (q.distractors !== undefined && !Array.isArray(q.distractors)) fail(where, '`distractors:` must be a list');
  }

  /* Required by the retry rule the app uses everywhere: a second wrong answer reveals the answer
     and shows `explain`. Without it, the child who got it wrong twice is told "Here is the answer,
     highlighted above" and nothing more. */
  if (typeof q.explain !== 'string' || !q.explain.trim()) {
    fail(where, 'has no `explain:` — it is what a student who got it wrong twice is shown');
  }
}

/* Badge names, so two lessons cannot award the same one. Badges are stored keyed by name, so a
   duplicate means the second lesson silently awards nothing — the student does the work and the
   card still says "unlocks". */
const rewards = {};

function checkYourTurn(where, src) {
  let c;
  try { c = yaml.load(src); }
  catch (e) {
    fail(where, 'the YAML does not parse (' + String(e.message).split('\n')[0] + ').'
      + ' A value that starts with ` or " or contains ": " must be wrapped in quotes.');
    return;
  }
  if (!c || typeof c !== 'object' || Array.isArray(c)) { fail(where, 'is empty or is not a set of keys'); return; }
  if (!c.task && !(Array.isArray(c.steps) && c.steps.length)) {
    fail(where, 'has no `task:` and no `steps:`, so it asks the student to do nothing');
  }
  if (Array.isArray(c.steps) && c.steps.some(function (s) { return typeof s !== 'string' || !s.trim(); })) {
    fail(where, 'has a blank entry in `steps:`');
  }
  if (c.reward !== undefined) {
    if (typeof c.reward !== 'string' || !c.reward.trim()) {
      fail(where, '`reward:` is present but not a name, so the card would promise a blank badge');
    } else {
      const name = c.reward.trim();
      if (rewards[name]) {
        fail(where, 'awards "' + name + '", which ' + rewards[name] + ' already awards.'
          + ' Badges are stored by name, so the second one would silently award nothing.');
      } else rewards[name] = where;
    }
  }
}

/* Labs are checked twice, by two different parsers, because the app and check-challenges.js read
   them in two different ways — and that gap hid a real bug.
   `check-challenges.js` pulls `code:` and `solution:` out by hand, on purpose: those blocks hold
   JavaScript, and a stray colon or `#` inside a string is good code that a strict parser rejects.
   The BROWSER, though, runs the whole block through js-yaml. So a lab whose `hint:` starts with a
   backtick parses fine for the validator, passes as "solvable", and renders in the app with no
   code, no task and no hint at all. One shipped that way.
   This is the half that asks the question the app asks: can a student see it? */
function checkChallenge(where, src) {
  let c;
  try { c = yaml.load(src); }
  catch (e) {
    fail(where, 'the YAML does not parse, so the lab renders completely empty in the app — no code,'
      + ' no task, nothing (' + String(e.message).split('\n')[0] + ').'
      + ' A value that starts with ` or " or contains ": " must be wrapped in quotes.'
      + ' NOTE: check-challenges.js does NOT catch this — it reads the code block by hand.');
    return;
  }
  if (!c || typeof c !== 'object' || Array.isArray(c)) { fail(where, 'is empty or is not a set of keys'); return; }
  if (typeof c.code !== 'string' || !c.code.trim()) fail(where, 'has no `code:` for the student to edit');
  if (!c.task) fail(where, 'has no `task:`, so it does not say what is wrong or what to do');
}

function eachBlock(text, re, fn) {
  re.lastIndex = 0;
  let m, i = 0;
  while ((m = re.exec(text))) { fn(i, m[1]); i++; }
  return i;
}

/* Every picture a lesson points at has to exist. A wrong path does not throw and does not warn —
   it renders as nothing at all, or as alt text, on a page nobody is checking. And the trap is
   specific: a lesson's Markdown is fetched from /content/lessons/ but rendered into the page at /,
   so a plain relative name resolves against the wrong place. Root-relative paths only. */
const PUBLIC = path.join(__dirname, '..', 'public');
const CONTENT = path.join(__dirname, '..', 'content');
const IMG_SRC = /<(?:img|source)[^>]+src\s*=\s*["']([^"']+)["']|!\[[^\]]*\]\(([^)\s]+)/g;
/* A figure showing someone else's game must say whose it is. The credit is not what makes using it
   lawful — that is fair use, or a press-kit licence, or the game being openly licensed — but a
   screenshot with no attribution is indefensible on any of those footings, and it is the one part
   a program can actually check. So: `shot` and `clip` figures need a <cite>. Diagrams we drew do
   not, which is why the rule keys off the class rather than applying to every figure. */
const FIGURE = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g;

function checkFigures(file, text) {
  FIGURE.lastIndex = 0;
  let m, i = 0;
  while ((m = FIGURE.exec(text))) {
    const attrs = m[1] || '', inner = m[2] || '', where = file + ' figure ' + i;
    i++;
    const borrowed = /\bclass\s*=\s*["'][^"']*\b(shot|clip)\b/.test(attrs);
    if (!/<figcaption\b/.test(inner)) {
      fail(where, 'has no <figcaption>. The picture and the caption teach together; a picture with'
        + ' no caption is decoration.');
    }
    if (borrowed && !/<cite\b/.test(inner)) {
      fail(where, 'shows someone else\'s game and has no <cite> credit. Name the game and who made'
        + ' it — see AUTHORING.md for the shape and for where the images may come from.');
    }
    if (/<img\b/.test(inner) && !/<img[^>]+\balt\s*=/.test(inner)) {
      fail(where, 'has an <img> with no alt text, so it is nothing at all to a student using a'
        + ' screen reader.');
    }
    if (/<video\b/.test(inner) && !/\bmuted\b/.test(inner)) {
      fail(where, 'has a <video> without `muted`. Sound that starts on its own in a classroom of'
        + ' twenty-five is its own kind of problem, and browsers block unmuted autoplay anyway.');
    }
  }
}

function checkImages(file, text) {
  IMG_SRC.lastIndex = 0;
  let m;
  while ((m = IMG_SRC.exec(text))) {
    const src = m[1] || m[2];
    if (/^(https?:|data:|blob:)/i.test(src)) {
      fail(file, 'points at "' + src.slice(0, 48) + '" — the security policy only allows same-origin,'
        + ' data: and blob: images, so a remote one is blocked. Put the file in content/images/.');
      continue;
    }
    if (src.charAt(0) !== '/') {
      fail(file, 'has the image "' + src + '" without a leading slash. A lesson renders at / but is'
        + ' fetched from /content/lessons/, so a relative path silently resolves to the wrong place.'
        + ' Write it as /content/images/' + src.replace(/^\.?\//, '') + ' .');
      continue;
    }
    const rel = src.replace(/^\//, '').split('?')[0];
    const onDisk = rel.indexOf('content/') === 0
      ? path.join(CONTENT, rel.slice('content/'.length))
      : path.join(PUBLIC, rel);
    if (!fs.existsSync(onDisk)) fail(file, 'points at "' + src + '", which is not on disk');
  }
}

const files = fs.readdirSync(DIR).filter(function (f) { return f.endsWith('.md'); }).sort();
files.forEach(function (f) {
  // Normalised to \n first. A \r\n checkout is why check-challenges.js silently examined nothing.
  const text = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  checkImages(f, text);
  checkFigures(f, text);
  quizzes += eachBlock(text, QUIZ, function (i, src) { checkQuiz(f + ' quiz ' + i, src); });
  yourturns += eachBlock(text, YOURTURN, function (i, src) { checkYourTurn(f + ' yourturn ' + i, src); });
  challenges += eachBlock(text, CHALLENGE, function (i, src) { checkChallenge(f + ' challenge ' + i, src); });
});

console.log(files.length + ' lessons: ' + quizzes + ' quizzes, ' + challenges + ' labs, ' + yourturns + ' your-turn steps');
if (problems.length) {
  console.error('');
  problems.forEach(function (p) { console.error('FAIL  ' + p); });
  console.error('\n' + problems.length + ' problem(s) — these render as cards a student cannot answer.');
  process.exit(1);
}
/* Finding nothing is a failure, not a pass — the same trap check-challenges.js fell into. */
if (!quizzes) {
  console.error('FAIL  no ```quiz blocks found in ' + DIR + ' — the course has quizzes, so this is a bug in this script.');
  process.exit(1);
}

/* ---- position bias ----
   Every one of the 44 multiple-choice questions was authored `answer: 0`, because writing the
   right answer down first and then inventing the wrong ones is the natural way to write one. The
   renderer shuffles the options now, so this is no longer a bug a student can exploit — but if
   that shuffle is ever removed or bypassed, the course silently becomes "always click the top
   one" again. Reported rather than failed: the authored position stopped mattering the moment
   the options were shuffled, so failing the build over it would be demanding busywork.
   It fails only if the shuffle is gone, which is the thing actually worth catching. */
const RENDERER = path.join(__dirname, '..', 'public', 'js', 'widgets.js');
const shuffles = fs.existsSync(RENDERER)
  && /seededOrder\(\s*opts0\.length/.test(fs.readFileSync(RENDERER, 'utf8'));
const spread = Object.keys(answerAt).length;
if (!shuffles) {
  console.error('FAIL  buildMCQ no longer shuffles its options, and ' + spread + ' distinct answer '
    + 'position(s) are authored across the course. Without the shuffle, the correct answer sits in '
    + 'the same place every time and a student learns the position instead of the material.');
  process.exit(1);
}
console.log('answer positions authored: '
  + Object.keys(answerAt).sort().map(function (k) { return k + '×' + answerAt[k]; }).join(', ')
  + '  (shuffled at render, so position carries no information)');
console.log('every quiz, lab and your-turn step renders with something to answer');
