// ============================================================
//  A grade is checked before a student is told anything.
//
//  Everything the coder agent produces is verified rather than
//  trusted (four validators in server.js), and the quiz agent got
//  the same treatment in quiz-check.js. The grader had none: the
//  route parsed the model's JSON and passed it straight through
//  with `res.json({ result: parsedAgent })`.
//
//  That matters more here than anywhere else, because this is the
//  one agent whose output can tell a child their work is not good
//  enough. The failure modes are specific and all three have been
//  seen in testing:
//
//    - `pass` comes back as the string "true", or "yes", or 1.
//      Truthy in the wrong place and falsy in the wrong place,
//      depending on which line of client code reads it.
//    - `pass: false` with a hint that describes work already done
//      ("you have added the comment") — the verdict and the reason
//      disagree, which is worse than either being wrong alone,
//      because the student is told no and shown why it is yes.
//    - `pass: true` with an empty hint, so a student who scraped
//      through learns nothing about what they actually did.
//
//  A rejected grade returns nothing, and the client reads nothing
//  as "I could not check this" — never as a fail. That asymmetry is
//  deliberate and load-bearing: refusing a student who did the work
//  is the failure that makes them stop trusting the course, and it
//  is much more expensive than letting one through.
// ============================================================

/* Phrases that assert the WHOLE task is finished. If the verdict is `false` and the hint says the
   job is done, the two genuinely disagree and the reply is untrustworthy — the student is told no
   and shown why it is yes, with nothing to act on.
   Deliberately about done-ness rather than sentiment: "good" and "nice" appear in plenty of
   legitimate hints ("a good next step would be…"). */
const SOUNDS_DONE = [
  /\b(?:that|this|it)(?:'s| is| looks)\s+(?:all\s+)?(?:correct|right|done|complete|it)\b/i,
  /\bwell done\b/i,
  /\bnice work\b/i,
  /\ball\s+done\b/i,
  /\bnothing (?:more|else) to do\b/i,
  /\byou(?:'ve| have)\s+(?:finished|completed)\b/i
];

/* ...unless the hint goes on to say what is still missing.
   This escape is not a nicety — without it the check rejected a genuinely good reply. Tested live,
   the grader answered `pass:false` with "You've created the variable at the top, which is great —
   but the task also asks you to add 1 to it and draw it on screen." That is exactly the hint a good
   teacher gives: name what worked, then name what is left. It is not a contradiction, and throwing
   it away cost the student the most useful sentence in the exchange.
   So a done-phrase only counts as disagreement when nothing in the hint points forward. */
const POINTS_FORWARD = /\b(?:but|however|though|although|still|now|next|also|as well|remains?|missing|instead|yet|need to|needs to|try|add|look at|open|change|move)\b/i;

/* Returns { pass, hint } or null. Never throws: a malformed reply from a model is an ordinary
   event on the happy path, not an error condition. */
function cleanGrade(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  /* A real boolean, not something boolean-ish. Accepting "false" as a string is how a student
     gets told they failed by a model that meant the opposite — `Boolean("false")` is true. */
  if (typeof raw.pass !== 'boolean') return null;

  const hint = typeof raw.hint === 'string' ? raw.hint.trim() : '';
  if (!hint) return null;
  if (hint.length > 400) return null;              // a hint is a nudge; an essay means it lost the thread

  /* The rule grader.md states outright: pass and hint must agree. Checked here rather than trusted.
     A hint that says the task is finished alongside `pass: false` is a real contradiction — but only
     if it does not then say what is left to do. "You've done X, but Y is still missing" is a fail
     with a good hint, not a contradiction. */
  if (raw.pass === false
      && SOUNDS_DONE.some(function (re) { return re.test(hint); })
      && !POINTS_FORWARD.test(hint)) return null;

  return { pass: raw.pass, hint: hint };
}

module.exports = { cleanGrade: cleanGrade, SOUNDS_DONE: SOUNDS_DONE, POINTS_FORWARD: POINTS_FORWARD };
