// ============================================================
//  A question is checked before a child sees it.
//
//  Everything the coder agent produces is verified rather than
//  trusted (see the four validators in server.js). The quiz agent
//  had no equivalent: the browser checked that a question came
//  back and that it had options, and never looked at the answer.
//
//  So a model that numbered its options from 1 instead of 0 —
//  which small models do routinely — got the wrong option marked
//  green, and told a child they were wrong when they were right.
//  Silently, with nothing on screen looking broken. A model that
//  omitted the answer made every choice wrong, so the question
//  could not be answered correctly however well it was understood.
//
//  The off-by-one is only sometimes detectable from a number, so
//  the contract prefers the answer as the option's own TEXT, which
//  cannot be off by one at all (see agents/quiz.md). A number is
//  still accepted so an older model keeps working.
//
//  Anything that fails is DROPPED, not repaired. This question is
//  a bonus: one that never appears costs nothing, and one that is
//  wrong costs a child's confidence in the thing that told them.
// ============================================================

const MIN_OPTIONS = 3, MAX_OPTIONS = 4;

/* Returns a clean question, or null. Never throws: a malformed answer from a model is an
   ordinary event, not an error condition. */
function cleanQuizQuestion(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!question) return null;

  if (!Array.isArray(raw.options)) return null;
  const options = raw.options.map(function (o) { return typeof o === 'string' ? o.trim() : ''; });
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) return null;
  if (options.some(function (o) { return !o; })) return null;
  // Two identical options mean one of them is unanswerable whichever the student picks.
  const seen = {};
  if (options.some(function (o) {
    const k = o.toLowerCase();
    if (seen[k]) return true;
    seen[k] = 1;
    return false;
  })) return null;

  let answer = -1;
  if (typeof raw.answer === 'string') {
    const want = raw.answer.trim().toLowerCase();
    if (!want) return null;
    answer = options.findIndex(function (o) { return o.toLowerCase() === want; });
  } else if (typeof raw.answer === 'number' && Number.isInteger(raw.answer)) {
    // Numbered from 1. Not repairable in general — a 1-based "1" is indistinguishable from a
    // 0-based "1" — so the one case that IS unambiguous is refused rather than guessed at.
    if (raw.answer === options.length) return null;
    answer = raw.answer;
  }
  if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;

  /* Required, not cosmetic: this is the whole of what a student who got it wrong is shown.
     Without it the card says "Not quite —" and stops, to the one child who needed the sentence
     after the dash. */
  const explain = typeof raw.explain === 'string' ? raw.explain.trim() : '';
  if (!explain) return null;

  return { question: question, options: options, answer: answer, explain: explain };
}

module.exports = { cleanQuizQuestion: cleanQuizQuestion, MIN_OPTIONS: MIN_OPTIONS, MAX_OPTIONS: MAX_OPTIONS };
