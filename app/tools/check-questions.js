/* check-questions.js — are the tap-instead-of-typing openers actually there, and the right shape?
 *
 * content/questions.yaml feeds two things: the line a new chat greets a student with, and the
 * three chips above the input that show them what they are allowed to ask. Both fail SILENTLY.
 * A lesson id that does not exist does not throw — pickQuestions just finds nothing at that tier
 * and quietly tops up from `any`, so the student gets three generic chips on a lesson that was
 * supposed to have ten of its own and nobody ever notices. That is the whole reason this file
 * exists: every way this content can be wrong looks fine in the browser.
 *
 * It checks four things:
 *
 *   1. every module and lesson in course.yaml has a pool on BOTH sides, and every lab has a
 *      tutor pool — no silent fallback to generic chips
 *   2. nothing points at a module or lesson that is not in course.yaml
 *   3. the two trees stay different in KIND. `tutor:` is questions, `coder:` is instructions. A
 *      Build chip that reads like a question teaches a child the two panels are interchangeable,
 *      which is the most expensive misconception this app can hand out. So no line may appear in
 *      both trees, and nothing in `coder:` may end in a question mark.
 *   4. the pools are big enough to still feel chosen. Ten per lesson gives 120 possible sets of
 *      three; three per lesson gives one set, which a student stops reading by the third lesson.
 *
 * (3) allows the reverse — a `tutor:` line that is not a question — because "I have no idea where
 * to start." is a real thing a stuck child types and refusing it would be pedantry.
 *
 * Fatal, not a report. Unlike the pacing and vocabulary checks this one arrived with the list
 * already empty, so there is no long tail to grandfather in.
 *
 * Run: node app/tools/check-questions.js
 */
const fs = require('fs');
const path = require('path');
const yaml = require('../public/vendor/js-yaml/js-yaml.min.js');

const CONTENT = path.join(__dirname, '..', 'content');

/* How many openers a pool needs before the chips stop feeling like a fixed menu. The lesson tier
   is the one a student sees most, so it carries the highest bar. */
const MIN = { lessons: 10, labs: 6, modules: 10, any: 15, greetings: 12 };

let fails = 0;
function fail(msg) { console.error('FAIL  ' + msg); fails++; }

const course = yaml.load(fs.readFileSync(path.join(CONTENT, 'course.yaml'), 'utf8')) || {};
let q;
try {
  q = yaml.load(fs.readFileSync(path.join(CONTENT, 'questions.yaml'), 'utf8')) || {};
} catch (e) {
  console.error('FAIL  questions.yaml does not parse (' + String(e.message).split('\n')[0] + ').');
  console.error('  Wrap the line in single quotes if it contains a colon followed by a space.');
  process.exit(1);
}

const moduleNames = (course.modules || []).map(function (m) { return m.name; });
const lessonIds = [];
(course.modules || []).forEach(function (m) { (m.lessons || []).forEach(function (id) { lessonIds.push(id); }); });

/* ---- 1 and 2: every pool exists, and nothing points at something that does not ---- */
function tier(tree, side, key, wanted, label) {
  const pools = (q[side] || {})[key];
  if (!pools) { fail(side + ': there is no ' + key + ' block at all.'); return; }
  wanted.forEach(function (name) {
    const pool = pools[name];
    if (!Array.isArray(pool) || !pool.length) {
      fail(side + '.' + key + ' has nothing for ' + label + ' "' + name + '" — a student there gets generic chips.');
    } else if (pool.length < MIN[key]) {
      fail(side + '.' + key + '.' + name + ' has only ' + pool.length + ' openers; ' + MIN[key] + ' is the minimum.');
    }
  });
  Object.keys(pools).forEach(function (name) {
    if (wanted.indexOf(name) < 0) {
      fail(side + '.' + key + ' has a pool for "' + name + '", which is not ' + label + ' in course.yaml.');
    }
  });
}

['tutor', 'coder'].forEach(function (side) {
  if (!q[side]) { fail('there is no ' + side + ' tree in questions.yaml.'); return; }
  tier(q, side, 'modules', moduleNames, 'a module');
  tier(q, side, 'lessons', lessonIds, 'a lesson');
  const any = (q[side] || {}).any;
  if (!Array.isArray(any) || any.length < MIN.any) {
    fail(side + '.any has ' + ((any || []).length) + ' openers; ' + MIN.any + ' is the minimum — it is the tier that catches everything else.');
  }
});
/* Labs are tutor-only: Build is off inside a lab bench, so a coder.labs block would be dead
   content that reads as if the panel were available there.
   And only lessons that HAVE a lab. The labs tier is read when the bench is open (scope === 'lab'
   in pickQuestions), so six openers for a lesson with no ```challenge in it can never be drawn —
   demanding them buys nothing and costs six lines of writing nobody will read. Asking the lesson
   files rather than trusting a list also means the requirement follows the content: add a lab and
   this starts asking for its openers, take one out and the leftover pool is reported as dead. */
const labLessonIds = lessonIds.filter(function (id) {
  try { return /```challenge/.test(fs.readFileSync(path.join(CONTENT, 'lessons', id + '.md'), 'utf8')); }
  catch (e) { return false; }
});
tier(q, 'tutor', 'labs', labLessonIds, 'a lesson with a lab');
if ((q.coder || {}).labs) fail('coder.labs exists, but Build is disabled inside a lab bench — that content can never be shown.');

/* ---- 3: the two trees stay different in kind ---- */
function everyLine(tree) {
  const out = [];
  if (!tree) return out;
  if (Array.isArray(tree.any)) out.push.apply(out, tree.any);
  ['modules', 'lessons', 'labs'].forEach(function (k) {
    Object.values(tree[k] || {}).forEach(function (pool) {
      if (Array.isArray(pool)) out.push.apply(out, pool);
    });
  });
  return out;
}
const tutorLines = everyLine(q.tutor);
const coderLines = everyLine(q.coder);

coderLines.forEach(function (s) {
  if (typeof s === 'string' && s.trim().endsWith('?')) {
    fail('coder opener is a question, not an instruction: "' + s + '"');
  }
});
const coderSet = new Set(coderLines);
const shared = tutorLines.filter(function (s) { return coderSet.has(s); });
[...new Set(shared)].forEach(function (s) {
  fail('this opener is in both the tutor and the coder tree: "' + s + '"');
});

/* ---- the design tree ----
   One tier, `any`, and that is deliberate: the board is the same board on every lesson and belongs
   to the student rather than to the page they came from, so a per-lesson pool would be answering a
   question nobody asked. pickQuestions reads `design.any` and nothing else, so a modules/ or
   lessons/ block here would be content that can never be drawn.

   Its lines may be questions OR asks — this is the one agent that both asks and writes — so the
   coder tree's no-question-marks rule does not apply. What does apply is that they are its own:
   a line shared with the Tutor is a chip that means something different depending on which tab a
   student happens to be standing on. */
if (!q.design) {
  fail('there is no design tree in questions.yaml — the Design tab has no starter chips.');
} else {
  const dAny = q.design.any;
  if (!Array.isArray(dAny) || dAny.length < MIN.any) {
    fail('design.any has ' + ((dAny || []).length) + ' openers; ' + MIN.any + ' is the minimum — it is the only tier the design coach has.');
  }
  ['modules', 'lessons', 'labs'].forEach(function (k) {
    if (q.design[k]) fail('design.' + k + ' exists, but the design coach only ever draws from design.any — that content can never be shown.');
  });
  const otherSet = new Set(tutorLines.concat(coderLines));
  [...new Set((dAny || []).filter(function (s) { return otherSet.has(s); }))].forEach(function (s) {
    fail('this opener is in the design tree and in another tree: "' + s + '"');
  });
}
/* Every voice the panel can greet in needs a pool, or a student meets the one hard-coded fallback
   line every single time they open that tab. */
['tutor', 'coder', 'design'].forEach(function (voice) {
  const pool = (q.greetings || {})[voice];
  if (!Array.isArray(pool) || pool.length < MIN.greetings) {
    fail('greetings.' + voice + ' has ' + ((pool || []).length) + '; ' + MIN.greetings + ' is the minimum.');
  }
});

/* Within one pool a repeat is just a wasted slot — the draw dedupes, so a student sees two chips
   where there should be three. */
function dupesIn(tree, side) {
  const scan = function (pools, where) {
    Object.keys(pools || {}).forEach(function (name) {
      const seen = new Set();
      (pools[name] || []).forEach(function (s) {
        if (seen.has(s)) fail(side + '.' + where + '.' + name + ' lists the same opener twice: "' + s + '"');
        seen.add(s);
      });
    });
  };
  scan({ any: (tree || {}).any }, 'any');
  ['modules', 'lessons', 'labs'].forEach(function (k) { scan((tree || {})[k], k); });
}
dupesIn(q.tutor, 'tutor');
dupesIn(q.coder, 'coder');

/* ---- 4: the greetings ---- */
const greetings = q.greetings || {};
['tutor', 'coder'].forEach(function (side) {
  const pool = greetings[side];
  if (!Array.isArray(pool) || !pool.length) {
    fail('greetings.' + side + ' is missing — every new chat would open with the hard-coded fallback.');
    return;
  }
  if (pool.length < MIN.greetings) {
    fail('greetings.' + side + ' has only ' + pool.length + ' variants; ' + MIN.greetings + ' is the minimum.');
  }
  const seen = new Set();
  pool.forEach(function (s) {
    if (seen.has(s)) fail('greetings.' + side + ' lists the same intro twice.');
    seen.add(s);
    /* Each intro is meant to teach something about the panel, which does not fit in one line. */
    if (typeof s === 'string' && s.length < 90) {
      fail('greetings.' + side + ' has an intro too short to say anything: "' + s + '"');
    }
  });
});

const total = tutorLines.length + coderLines.length;
console.log(lessonIds.length + ' lessons and ' + moduleNames.length + ' modules covered on both sides — '
  + total + ' openers (' + tutorLines.length + ' tutor, ' + coderLines.length + ' build) and '
  + ((greetings.tutor || []).length + (greetings.coder || []).length) + ' intros');

if (!fails) {
  console.log('every lesson has its own openers, and the two panels never borrow each other\'s');
} else {
  console.error(fails + ' problem' + (fails === 1 ? '' : 's') + ' in content/questions.yaml');
}
process.exit(fails ? 1 : 0);
