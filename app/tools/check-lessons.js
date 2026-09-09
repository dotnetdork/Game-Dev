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

/* ---- how wide a figure is actually drawn ----
   These have to match styles.css. A screenshot in the flow gets the full block; one marked `aside`
   floats into the strip beside the prose. If either number changes there, change it here.  */
const BLOCK_W = 780;
const ASIDE_W = 300;

/* Natural pixel size, straight out of the file header. No dependency: PNG, JPEG and GIF all
   declare their dimensions in the first few bytes, and those are the only three formats the
   lessons use. Returns null for anything else (SVG has no intrinsic size worth checking — it is
   drawn to fit by design, which is the whole reason we use it for diagrams). */
function imageSize(file) {
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) { return null; }
  // PNG: 8-byte signature, then an IHDR chunk whose width/height are big-endian at 16 and 20.
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF: "GIF87a"/"GIF89a", then the logical screen size little-endian at 6 and 8.
  if (buf.length > 10 && buf.toString('latin1', 0, 3) === 'GIF') {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // JPEG: walk the segment chain to the first start-of-frame, which carries the real size.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let p = 2;
    while (p + 9 < buf.length) {
      if (buf[p] !== 0xff) { p++; continue; }             // resync past padding
      const marker = buf[p + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      const len = buf.readUInt16BE(p + 2);
      // SOF0/1/2/3/5/6/7/9..11/13..15 — every frame type except the DHT/DAC/DNL lookalikes.
      const isSOF = (marker >= 0xc0 && marker <= 0xcf)
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
      p += 2 + len;
    }
  }
  return null;
}

/* A wide landscape screenshot dropped into a 300px aside. Three were, before this check: 780x439
   pictures drawn 169px tall, with captions asking the reader to look at detail — the dust behind a
   kart, the items on a menu — that they could not possibly see at that size. This one is a hard
   failure because it is never right: half the source resolution is being thrown away to produce a
   picture too small to read. */
const TINY_W = 200;
const tiny = [];

function checkFigureSizes(where, attrs, inner) {
  const isShot = /\bclass\s*=\s*["'][^"']*\b(shot|clip)\b/.test(attrs);
  if (!isShot) return;
  const aside = /\bclass\s*=\s*["'][^"']*\baside\b/.test(attrs);

  const re = /<img[^>]+src\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(inner))) {
    const src = m[1];
    if (src.charAt(0) !== '/' || /\.svg$/i.test(src)) continue;   // handled by checkImages
    const rel = src.replace(/^\//, '').split('?')[0];
    const onDisk = rel.indexOf('content/') === 0
      ? path.join(CONTENT, rel.slice('content/'.length))
      : path.join(PUBLIC, rel);
    const size = imageSize(onDisk);
    if (!size || !size.w) continue;

    if (aside && size.w > 620) {
      fail(where, '"' + src + '" is ' + size.w + 'x' + size.h + ' in an `aside` figure, so it is'
        + ' squeezed into ' + ASIDE_W + 'px — about ' + Math.round(size.h * ASIDE_W / size.w)
        + 'px tall. A landscape screenshot that size belongs in the flow at full width; drop'
        + ' `aside`.');
    }
    /* Not a failure. Some of these sources are genuinely tiny — the RuneScape Classic capture is
       160px because that is the only one that exists — and a small picture of an old game is
       still worth showing. But it is worth an author knowing which ones will be stamp-sized. */
    const drawn = Math.min(size.w, aside ? ASIDE_W : BLOCK_W);
    if (drawn < TINY_W) tiny.push(where + ': ' + src.split('/').pop() + ' draws at ' + drawn + 'px');
  }
}

/* The invariant that keeps the above honest, asserted against the stylesheet rather than trusted.
   Screenshots must draw at their own size or smaller, never stretched. Two declarations do that
   together, and BOTH are easy to lose in a refactor:
     width:auto        - so a narrow image is not told to fill the column
     align-self        - because the figure is a column flexbox, and align-items:stretch overrides
                         width:auto without a word. Pac-Man rendered at 300px from a 224px source
                         even with width:auto in place, until align-self was added.
   That second one is the whole reason this check exists: the first fix looked correct, measured
   wrong, and would have shipped. */
function checkUpscaleGuard() {
  const cssPath = path.join(PUBLIC, 'styles.css');
  if (!fs.existsSync(cssPath)) { problems.push('styles.css: not found at ' + cssPath); return; }
  const css = fs.readFileSync(cssPath, 'utf8');
  const rule = css.match(/\.lesson-content > figure\.shot img[^{]*\{([^}]*)\}/);
  if (!rule) {
    problems.push('styles.css: cannot find the `.lesson-content > figure.shot img` rule, so'
      + ' whether screenshots are being stretched can no longer be checked here.');
    return;
  }
  /* Comments stripped FIRST, and that is not fussiness. The comment inside this very rule explains
     why width:auto and align-self matter, so it contains both strings — which meant the first
     version of this check passed happily with the declarations deleted, satisfied by the prose
     describing them. A check that its own documentation can satisfy is not a check. */
  const body = rule[1].replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/width\s*:\s*auto/.test(body)) {
    problems.push('styles.css: `figure.shot img` no longer sets width:auto, so any screenshot'
      + ' narrower than its column is stretched to fill it and rendered blurry.');
  }
  if (!/align-self/.test(body)) {
    problems.push('styles.css: `figure.shot img` no longer sets align-self. The figure is a column'
      + ' flexbox, so without it align-items:stretch silently overrides width:auto and every'
      + ' screenshot is stretched again — which is exactly how this shipped the first time.');
  }
}

function checkFigures(file, text) {
  FIGURE.lastIndex = 0;
  let m, i = 0;
  while ((m = FIGURE.exec(text))) {
    const attrs = m[1] || '', inner = m[2] || '', where = file + ' figure ' + i;
    i++;
    checkFigureSizes(where, attrs, inner);
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

/* ---- pacing ----
   The complaint that started this was "it feels like a wall of text", and it turned out to be
   measurable: across the 22 lessons the first activity averages 39% of the way down and the longest
   unbroken run of prose averages 9 blocks. The worst lesson asks a student to scroll about 2,800
   pixels before anything asks them to do something.
   The course already contains the answer: decisions-and-repeats puts its first activity 10% in and
   never runs more than 4 prose blocks together. It is not shorter than the others, it is
   interleaved. So these two numbers describe a shape the course has already proven it can hit.
   It landed as a REPORT because 18 of 22 lessons would have failed on day one, and a check that
   fails everything the day it arrives gets switched off rather than fixed. The condition for making
   it fatal was that the list reach empty. It has: all 22 lessons pass, the longest prose run
   averages 5.5 blocks and the first activity 16% down. So it is fatal now, which is the only way it
   stays true — a report nobody has to satisfy drifts back within a month of authoring.
   The position-bias report below is still a report, on the same terms: the shuffle covers it. */
const PROSE_RUN_MAX = 6;
const FIRST_ACT_MAX_PCT = 25;
const ACT_FENCES = ['quiz', 'challenge', 'yourturn', 'run'];

function pacingOf(text) {
  const body = text.replace(/^---[\s\S]*?\n---\n/, '');
  const lines = body.split('\n');
  const kinds = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i];
    const fence = ln.match(/^```(\w*)/);
    if (fence) {
      let j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j++;
      kinds.push(ACT_FENCES.indexOf(fence[1]) >= 0 ? 'act' : 'prose');   // a plain ``` block is a code sample
      i = j + 1; continue;
    }
    if (/^<figure\b/.test(ln)) {
      let j = i;
      while (j < lines.length && !/<\/figure>/.test(lines[j])) j++;
      kinds.push('fig');
      i = j + 1; continue;
    }
    if (!ln.trim()) { i++; continue; }
    let j = i;
    while (j < lines.length && lines[j].trim() && !/^```/.test(lines[j]) && !/^<figure\b/.test(lines[j])) j++;
    kinds.push('prose');
    i = j;
  }
  let run = 0, longest = 0;
  kinds.forEach(function (k) { if (k === 'prose') { run++; if (run > longest) longest = run; } else run = 0; });
  const first = kinds.indexOf('act');
  /* Two activities with nothing in between. A quiz sitting directly on top of a lab, or a lab
     directly on top of the practice step, gives a student three things to do in a row and not one
     sentence explaining why the next one follows the last — the lesson stops teaching and starts
     issuing tasks. A line or two between them does real work: it says what the lab is about to
     show, or what the quiz just proved. */
  let backToBack = 0;
  for (let k = 1; k < kinds.length; k++) if (kinds[k] === 'act' && kinds[k - 1] === 'act') backToBack++;
  return {
    blocks: kinds.length,
    longestProseRun: longest,
    firstActivityPct: first < 0 ? null : Math.round(first / kinds.length * 100),
    backToBack: backToBack,
    activities: kinds.filter(function (k) { return k === 'act'; }).length
  };
}

const pacing = [];

const files = fs.readdirSync(DIR).filter(function (f) { return f.endsWith('.md'); }).sort();
files.forEach(function (f) {
  // Normalised to \n first. A \r\n checkout is why check-challenges.js silently examined nothing.
  const text = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  checkImages(f, text);
  checkFigures(f, text);
  pacing.push(Object.assign({ file: f }, pacingOf(text)));
  quizzes += eachBlock(text, QUIZ, function (i, src) { checkQuiz(f + ' quiz ' + i, src); });
  yourturns += eachBlock(text, YOURTURN, function (i, src) { checkYourTurn(f + ' yourturn ' + i, src); });
  challenges += eachBlock(text, CHALLENGE, function (i, src) { checkChallenge(f + ' challenge ' + i, src); });
});

checkUpscaleGuard();
checkDemoNames();
checkLessonIds();

/* ---- a lesson's id is a storage key, so it has to be one ----
   state.done, state.activities, state.labs and state.practice all hang off the lesson's id from
   course.yaml. It used to be the lesson's POSITION, and moving to the id is what makes the course
   reorderable — but it also means a typo in this file is no longer cosmetic:

     an EMPTY id       collapses every lesson without one into a single record. Finish one and they
                       all tick. (A blank list entry — `lessons: [a, , b]` — is how you get one.)
     a DUPLICATE id    merges two lessons' ticks, answers and lab drafts, and lessonIndexById only
                       ever finds the first of them. Same argument as the duplicate-badge check.
     a ':' in an id    breaks the "<lessonId>:<widgetKey>" format labs and practice are keyed by.
     '__proto__'       is swallowed by the prototype setter, then reads back truthy forever, so the
                       lesson is permanently done and cannot be un-done.

   check-boot.js asserts the same thing against the running app; this one names the file to fix. */
function checkLessonIds() {
  const CY = path.join(__dirname, '..', 'content', 'course.yaml');
  let doc;
  try { doc = yaml.load(fs.readFileSync(CY, 'utf8')) || {}; }
  catch (e) { fail('course.yaml', 'does not parse (' + String(e.message).split('\n')[0] + ').'); return; }
  const seen = {};
  let n = 0;
  (doc.modules || []).forEach(function (mod) {
    const where = 'course.yaml (' + (mod.name || mod.id || '?') + ')';
    (mod.lessons || []).forEach(function (id) {
      n++;
      if (id === null || id === undefined || String(id).trim() === '') {
        fail(where, 'has a blank lesson id — a lesson with no id cannot save progress.');
        return;
      }
      id = String(id);
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
        fail(where, '"' + id + '" is not usable as a progress key. Lowercase letters, digits and single hyphens only.');
      }
      if (seen[id]) fail(where, '"' + id + '" is listed twice (also in ' + seen[id] + ') — the two would share progress.');
      else seen[id] = where;
      if (!fs.existsSync(path.join(DIR, id + '.md'))) {
        fail(where, '"' + id + '" has no lessons/' + id + '.md — the outline will show it as missing.');
      }
    });
  });
  if (!n) fail('course.yaml', 'lists no lessons at all.');
  checkCheckpoints(doc);
}

/* ---- a checkpoint has to be able to do its job ----
   `checkpoint: true` in a lesson's front-matter changes two things: the outline draws that row as
   the end of its module, and lessonActivityKeys counts the your-turn steps, so the lesson cannot be
   finished — and the module's stars cannot be earned — until the student's own game satisfies them.

   Both of those depend on facts YAML cannot enforce, and each fails silently in its own way:

     not last in its module   the module's stars stop waiting on it, because completeLesson only
                              awards them once every lesson is done and there would be lessons
                              after it. The gate quietly becomes decoration.
     no `yourturn` block      there are no `y*` keys to count, so the lesson completes on its
                              quizzes like any other. A checkpoint that insists on nothing.

   Which modules HAVE a checkpoint is reported rather than failed, for now: the course is mid-way
   through gaining them, and a check that fails on work not done yet gets switched off. Promote it
   when the list below is empty. */
function checkCheckpoints(doc) {
  const missing = [];
  (doc.modules || []).forEach(function (mod) {
    const ids = (mod.lessons || []).filter(function (id) { return id && String(id).trim(); }).map(String);
    let found = null;
    ids.forEach(function (id, i) {
      let raw = '';
      try { raw = fs.readFileSync(path.join(DIR, id + '.md'), 'utf8'); } catch (e) { return; }
      const fm = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
      if (!fm || !/^checkpoint:\s*true\s*$/m.test(fm[1])) return;
      found = id;
      const where = id + '.md';
      if (i !== ids.length - 1) {
        fail(where, 'is a checkpoint but is not the last lesson in ' + (mod.name || mod.id)
          + '. The module\'s stars only wait for the last one, so this gate does nothing.');
      }
      if (!/```yourturn/.test(raw)) {
        fail(where, 'is a checkpoint with no ```yourturn block. It has nothing to insist on, so it '
          + 'finishes like an ordinary lesson.');
      }
    });
    if (!found) missing.push(mod.name || mod.id);
  });
  if (missing.length) {
    console.log('note: ' + missing.length + ' module(s) have no checkpoint yet — ' + missing.join(', '));
  }
}

/* ---- `// @demo: name` in a run cell has to name a demo that exists ----
   A run cell can ask for a live picture under the code. If the name is wrong — renamed in
   demos.js, or a typo — buildRunCell finds nothing in DEMOS and simply does not add the canvas.
   Nothing throws, nothing logs, and the cell renders as an ordinary run cell, so the only way to
   notice is to remember that the lesson used to have a picture in it. That is exactly the kind of
   quiet loss this suite exists to catch.

   demos.js is read and evaluated rather than pattern-matched, so this checks the real object the
   browser builds. Evaluating it is safe: the file is a plain object literal of draw functions and
   touches no browser API until one of them is CALLED, which nothing here does. */
function checkDemoNames() {
  const demoSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'demos.js'), 'utf8');
  let names;
  try {
    names = Object.keys(eval(demoSrc + ';DEMOS'));           // eslint-disable-line no-eval
  } catch (e) {
    fail('demos.js', 'does not evaluate (' + String(e.message).split('\n')[0] + ').');
    return;
  }
  if (!names.length) { fail('demos.js', 'defines no demos at all — this is a bug in that file.'); return; }
  let used = 0;
  files.forEach(function (f) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    let m; const re = /^```run\r?\n([\s\S]*?)^```/gm;
    while ((m = re.exec(src))) {
      const d = m[1].match(/^\s*\/\/\s*@demo:\s*(\S+)\s*$/m);
      if (!d) continue;
      used++;
      if (names.indexOf(d[1]) < 0) {
        fail(f, 'a run cell asks for the demo "' + d[1] + '", which is not in demos.js (have: '
          + names.join(', ') + '). The cell would render with no picture and no error.');
      }
      /* A demo with no slider to drive it is a still image that animates at nobody's request —
         almost certainly a directive left behind after the sliders were edited out. */
      if (!/^\s*\/\/\s*@slider:/m.test(m[1])) {
        fail(f, 'a run cell has "@demo: ' + d[1] + '" but no @slider — the picture would have nothing to drive it.');
      }
    }
  });
  console.log(used + ' run cells carry a live picture, from ' + names.length + ' demos: ' + names.join(', '));
}

console.log(files.length + ' lessons: ' + quizzes + ' quizzes, ' + challenges + ' labs, ' + yourturns + ' your-turn steps');
if (tiny.length) {
  console.log('note: ' + tiny.length + ' screenshot(s) draw smaller than ' + TINY_W + 'px —');
  tiny.forEach(function (t) { console.log('  ' + t); });
}
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
/* ---- pacing: a hard failure now that the list is empty ---- */
let pacingFailed = false;
const slow = pacing.filter(function (p) {
  return p.longestProseRun > PROSE_RUN_MAX || p.firstActivityPct === null || p.firstActivityPct > FIRST_ACT_MAX_PCT;
});
const avgRun = (pacing.reduce(function (s, p) { return s + p.longestProseRun; }, 0) / (pacing.length || 1)).toFixed(1);
const avgFirst = Math.round(pacing.reduce(function (s, p) { return s + (p.firstActivityPct || 100); }, 0) / (pacing.length || 1));
console.log('pacing: longest prose run averages ' + avgRun + ' blocks (target ≤' + PROSE_RUN_MAX
  + '), first activity averages ' + avgFirst + '% down (target ≤' + FIRST_ACT_MAX_PCT + '%)');
if (slow.length) {
  pacingFailed = true;
  console.error('FAIL  ' + slow.length + ' of ' + pacing.length + ' lessons read as a wall of text.');
  slow.sort(function (a, b) { return b.longestProseRun - a.longestProseRun; }).forEach(function (p) {
    const why = [];
    if (p.longestProseRun > PROSE_RUN_MAX) why.push(p.longestProseRun + ' prose blocks in a row');
    if (p.firstActivityPct === null) why.push('no activity at all');
    else if (p.firstActivityPct > FIRST_ACT_MAX_PCT) why.push('first activity ' + p.firstActivityPct + '% down');
    console.error('    ' + p.file.replace(/\.md$/, '').padEnd(26) + why.join(', '));
  });
  /* Says what to do, because the fix is not obvious from the numbers and the wrong fix is to cut
     the writing. A `run` cell counts as an activity here but NOT toward completing a lesson (see
     AUTHORING.md), so interleaving changes how a lesson reads without changing what it asks of a
     student. A figure breaks a run too. A `.tip` callout does not — it is read as prose. */
  console.error('  Interleave, do not rewrite: a short ```run cell or a figure breaks a run of prose,');
  console.error('  and a run cell with no @expect adds nothing to what the lesson demands.');
} else {
  console.log('  every lesson interleaves');
}

/* ---- activities stacked with nothing between them ----
   Fatal. It arrived as a report because 18 of the 22 lessons did this and a check that fails
   everything on the day it lands gets switched off rather than satisfied — the same way the pacing
   numbers above were introduced. The condition for promoting it was the list reaching empty, and
   all 28 have now been written, so it is a failure from here. */
const stacked = pacing.filter(function (p) { return p.backToBack > 0; });
const stackedTotal = stacked.reduce(function (s, p) { return s + p.backToBack; }, 0);
if (!stacked.length) {
  console.log('every activity has something between it and the last one');
} else {
  pacingFailed = true;
  console.error('FAIL  ' + stackedTotal + ' activities in ' + stacked.length + ' lessons sit directly'
    + ' on another, with no sentence in between:');
  stacked.sort(function (a, b) { return b.backToBack - a.backToBack; }).forEach(function (p) {
    console.error('    ' + p.file.replace(/\.md$/, '').padEnd(26) + p.backToBack);
  });
  console.error('  A quiz landing straight on a lab, or a lab straight on the practice step, gives a');
  console.error('  student three things to do in a row and no sentence saying why the next one');
  console.error('  follows the last. The line between them should do work: say what the lab is about');
  console.error('  to show, or what the quiz just proved.');
}

console.log('answer positions authored: '
  + Object.keys(answerAt).sort().map(function (k) { return k + '×' + answerAt[k]; }).join(', ')
  + '  (shuffled at render, so position carries no information)');
console.log('every quiz, lab and your-turn step renders with something to answer');

// Last, so a pacing failure still prints everything else this tool checked rather than cutting the
// report off at the first problem.
if (pacingFailed) process.exit(1);
