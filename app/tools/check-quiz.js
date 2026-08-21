/* check-quiz.js — the AI's questions are checked before a child sees them.
 *
 * This exists because of a specific, shipped failure. The app asks the AI a comprehension question
 * after a student accepts a code change. The reply was checked for three things — is there a
 * question, is there a list of options, are there at least two of them — and the ANSWER was never
 * looked at. So:
 *
 *   - a model numbering its options from 1 instead of 0 (small models do this routinely) got the
 *     wrong option marked green, and the app told a child they were wrong when they were right
 *   - a model omitting the answer made every option wrong, so the question could not be answered
 *     correctly however well the student understood it
 *
 * Neither looked broken on screen, which is why neither was noticed. "Is this the right answer?"
 * cannot be judged by a program — but every one of the cases below can be, and each one is a way
 * a question reaches a student in a state where answering it correctly is impossible.
 *
 * The rule under test: anything suspect is DROPPED, never repaired. A missing bonus question costs
 * nothing. A wrong one costs a child's trust in the thing that marked it.
 *
 * Run: node app/tools/check-quiz.js
 */
const { cleanQuizQuestion } = require('../ai/quiz-check');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}
function rejects(name, raw) {
  const got = cleanQuizQuestion(raw);
  check(name, got === null, got === null ? 'dropped' : 'ACCEPTED: ' + JSON.stringify(got));
}

const OPTS = ['In the read step', 'In the draw step', 'Only at the start'];
const good = { question: 'Where is input noticed?', options: OPTS.slice(), answer: 'In the read step', explain: 'Input is read at the top of each frame.' };

console.log('--- a good question gets through ---');
const ok = cleanQuizQuestion(good);
check('a well-formed question is accepted', !!ok);
check('the answer text is resolved to its position', ok && ok.answer === 0, ok ? 'answer = ' + ok.answer : '');
check('answer text is matched regardless of case and padding',
  (function () { const r = cleanQuizQuestion(Object.assign({}, good, { answer: '  in the READ step ' })); return r && r.answer === 0; })());
check('a plain 0-based number still works, so an older model keeps running',
  (function () { const r = cleanQuizQuestion(Object.assign({}, good, { answer: 1 })); return r && r.answer === 1; })());
check('four options are allowed',
  !!cleanQuizQuestion(Object.assign({}, good, { options: OPTS.concat(['Between frames']) })));
check('the question, options and explanation are trimmed',
  (function () {
    const r = cleanQuizQuestion({ question: '  Q?  ', options: [' a ', 'b', 'c'], answer: 'a', explain: '  because.  ' });
    return r && r.question === 'Q?' && r.options[0] === 'a' && r.explain === 'because.';
  })());

console.log('\n--- the answer is wrong or unusable: the whole question goes ---');
rejects('counted from 1 instead of 0 (answer === number of options)', Object.assign({}, good, { answer: 3 }));
rejects('answer number past the end', Object.assign({}, good, { answer: 7 }));
rejects('negative answer number', Object.assign({}, good, { answer: -1 }));
rejects('no answer at all', { question: 'Q?', options: OPTS.slice(), explain: 'because.' });
rejects('answer is null', Object.assign({}, good, { answer: null }));
rejects('answer is a fraction', Object.assign({}, good, { answer: 1.5 }));
rejects('answer text matches none of the options', Object.assign({}, good, { answer: 'In the update step' }));
rejects('answer text is only part of an option', Object.assign({}, good, { answer: 'read' }));
rejects('answer text is empty', Object.assign({}, good, { answer: '   ' }));
rejects('answer is a letter, not the option text', Object.assign({}, good, { answer: 'B' }));

console.log('\n--- the options are unusable ---');
rejects('too few options to be a real choice', Object.assign({}, good, { options: ['yes', 'no'] }));
rejects('more options than the contract allows', Object.assign({}, good, { options: ['a', 'b', 'c', 'd', 'e'] }));
rejects('two options are the same, so one of them is unanswerable',
  { question: 'Q?', options: ['same', 'Same', 'other'], answer: 'other', explain: 'because.' });
rejects('an option is blank', Object.assign({}, good, { options: ['a', '', 'c'] }));
rejects('an option is not text', Object.assign({}, good, { options: ['a', 42, 'c'] }));
rejects('options is not a list', Object.assign({}, good, { options: 'a, b, c' }));
rejects('options is missing', { question: 'Q?', answer: 0, explain: 'because.' });

console.log('\n--- the question or explanation is missing ---');
rejects('no question', Object.assign({}, good, { question: '' }));
rejects('question is only whitespace', Object.assign({}, good, { question: '   \n ' }));
rejects('question is not text', Object.assign({}, good, { question: { text: 'Q?' } }));
rejects('no explanation — the one thing a wrong answer gets to read',
  { question: 'Q?', options: OPTS.slice(), answer: 0 });
rejects('explanation is only whitespace', Object.assign({}, good, { explain: '  ' }));

console.log('\n--- nothing usable came back at all ---');
rejects('an empty object, which is what a failed parse produces', {});
rejects('null', null);
rejects('undefined', undefined);
rejects('a string', 'here is your question');
rejects('an array', [good]);

console.log('\n--- it never throws, whatever arrives ---');
let threw = null;
[0, false, NaN, [], function () {}, { options: { 0: 'a' } }, { question: 'Q', options: [null, undefined, 'c'], answer: 0, explain: 'x' }]
  .forEach(function (v) { try { cleanQuizQuestion(v); } catch (e) { threw = e.message; } });
check('junk input returns null rather than raising', threw === null, threw || 'no throws');

console.log('\n' + (failures ? failures + ' failing' : 'every malformed question is dropped'));
process.exit(failures ? 1 : 0);
