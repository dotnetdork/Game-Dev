/* check-grade.js — the grader's reply is validated before a student is told anything.
 *
 * Mirrors check-quiz.js. The thing being protected here is narrower and more important than a
 * bonus question: this agent's output is the only one that can tell a child their work is not
 * good enough, so every way it can be wrong has to be a rejection rather than a message.
 */
const { cleanGrade } = require('../ai/grade-check');

let pass = 0;
const fails = [];

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + label + (detail ? '  — ' + detail : '')); }
  else { fails.push(label); console.error('FAIL  ' + label + (detail ? '  — ' + detail : '')); }
}
function rejects(label, raw) { ok(label, cleanGrade(raw) === null, 'dropped'); }
function accepts(label, raw, expectPass) {
  const g = cleanGrade(raw);
  ok(label, g !== null && g.pass === expectPass, g ? 'pass=' + g.pass : 'was dropped');
}

console.log('--- shapes that are not a grade at all ---');
rejects('null', null);
rejects('undefined', undefined);
rejects('a string', 'pass');
rejects('a number', 1);
rejects('an array', [{ pass: true, hint: 'x' }]);
rejects('an empty object', {});

console.log('\n--- pass has to be a real boolean ---');
/* Boolean("false") is true. A model that answers with the string is the difference between a
   student being congratulated and being told to try again. */
rejects('pass: "true" as a string', { pass: 'true', hint: 'Looks right.' });
rejects('pass: "false" as a string', { pass: 'false', hint: 'Not there yet.' });
rejects('pass: "yes"', { pass: 'yes', hint: 'Not there yet.' });
rejects('pass: 1', { pass: 1, hint: 'Not there yet.' });
rejects('pass: 0', { pass: 0, hint: 'Not there yet.' });
rejects('pass missing entirely', { hint: 'Not there yet.' });
rejects('pass: null', { pass: null, hint: 'Not there yet.' });
accepts('pass: true', { pass: true, hint: 'The comment is there — good.' }, true);
accepts('pass: false', { pass: false, hint: 'I cannot see a comment at the top of config.js.' }, false);

console.log('\n--- a hint is required, both ways round ---');
/* Required on a pass too: a student who scraped through and is told nothing learns nothing. */
rejects('no hint on a pass', { pass: true });
rejects('no hint on a fail', { pass: false });
rejects('empty hint', { pass: false, hint: '' });
rejects('whitespace-only hint', { pass: false, hint: '   \n  ' });
rejects('non-string hint', { pass: false, hint: { text: 'no' } });
rejects('an essay instead of a hint', { pass: false, hint: 'x'.repeat(401) });
accepts('a hint at the length limit', { pass: false, hint: 'x'.repeat(400) }, false);

console.log('\n--- pass and hint must agree (grader.md states this outright) ---');
/* A real contradiction: told no, shown why it is yes, nothing to act on. */
rejects('fail + "that is correct"', { pass: false, hint: 'That is correct.' });
rejects('fail + "all done"', { pass: false, hint: 'All done here.' });
rejects("fail + \"that's it\"", { pass: false, hint: "That's it." });
rejects('fail + "you have finished"', { pass: false, hint: 'You have finished this one.' });
rejects('fail + "nothing more to do"', { pass: false, hint: 'Nothing more to do.' });

console.log('\n--- but partial credit is NOT a contradiction ---');
/* This is the reply that exposed the first version of this check. Tested live, the grader answered
   `pass:false` with a hint naming what worked and then what was missing — the hint a good teacher
   gives — and the validator threw the whole thing away. A done-phrase only counts as disagreement
   when nothing in the hint points forward. */
accepts('the live reply that broke v1',
  { pass: false, hint: "You've created the variable at the top, which is great—but the task also asks you to add 1 to it and draw it on screen." }, false);
accepts('fail + "well done, but"', { pass: false, hint: 'Well done on the variable, but it is never added to.' }, false);
accepts('fail + "that is right so far, now"',
  { pass: false, hint: 'That is right so far. Now make it show on screen.' }, false);
accepts('fail + "done, still missing"', { pass: false, hint: 'All done with part one — the counter is still missing.' }, false);
/* The mirror image is fine: a PASS may say encouraging things, obviously. */
accepts('pass + "well done"', { pass: true, hint: 'Well done — that is exactly it.' }, true);
/* And an ordinary forward-looking hint must survive. "a good next step" contains "good", which is
   why the patterns key off done-ness rather than sentiment. */
accepts('fail + "a good next step"', { pass: false, hint: 'A good next step would be to open config.js.' }, false);
accepts('fail naming a file', { pass: false, hint: 'Nothing in config.js has changed yet.' }, false);

console.log('\n--- the shape that comes back ---');
const g = cleanGrade({ pass: true, hint: '  The comment is there.  ', extra: 'ignored' });
ok('hint is trimmed', g && g.hint === 'The comment is there.', g && JSON.stringify(g.hint));
ok('only pass and hint survive', g && Object.keys(g).sort().join(',') === 'hint,pass',
  g && Object.keys(g).join(','));

console.log('');
if (fails.length) {
  console.error(fails.length + ' of ' + (pass + fails.length) + ' grade checks failed');
  process.exit(1);
}
if (!pass) {
  console.error('FAIL  no assertions ran — this script is not testing anything.');
  process.exit(1);
}
console.log(pass + ' grade checks passed');
