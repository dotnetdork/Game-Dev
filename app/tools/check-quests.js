/* check-quests.js: every quest and ticket file in content/quests/ is well formed.
   Uses the same checker the server does (quests.js), so a file that passes here is exactly a file
   the server will hand to the browser. A quest that names a part that doesn't exist, or waits on an
   event the game never sends, doesn't crash in class: it just never moves on. This is where that
   gets caught instead. */
const quests = require('../quests');

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
  if (!ok) failed++;
}

const all = quests.load();
check('content/quests/ parses and every file is well formed', all.problems.length === 0,
  all.problems.length ? all.problems.length + ' problem(s)' : Object.keys(all.quests).length + ' quests, ' + all.tickets.length + ' tickets');
all.problems.forEach(function (p) { console.log('        ' + p); });

check('the first day exists', !!all.quests['first-day']);
all.tickets.forEach(function (t) {
  check('ticket "' + t.id + '" has its quest', !!all.quests[t.quest], t.quest);
});

/* The checker has to actually refuse things, or every file "passes". */
const bad = quests.checkQuest({ id: 'x', title: 'x', department: 'art', character: 'mentor',
  beats: [{ id: 'a', wait_for: { event: 'teleported' } }, { id: 'b', do: { reveal: ['scene'] }, wait_for: { set: { part: 'dragon', key: 'fire' } } }] }, 'x.yaml', []);
check('an event the game never sends is refused', bad.some(function (p) { return /never sends "teleported"/.test(p); }));
check('a part that does not exist is refused', bad.some(function (p) { return /no part called "dragon"/.test(p); }));
check('a panel that does not exist is refused', bad.some(function (p) { return /unknown panel "scene"/.test(p); }));

const split = quests.checkQuest({ id: 'y', title: 'y', department: 'art', character: 'mentor',
  beats: [{ id: 'a', ask: { text: 'Ok?', answers: [{ text: 'Ha', 'got it': null, goto: 'next' }] } }] }, 'y.yaml', []);
check('text split at a comma is caught', split.some(function (p) { return /got it/.test(p) && /quotes/.test(p); }));

if (failed) { console.log('\n' + failed + ' check(s) failed'); process.exit(1); }
console.log('\nquests: all checks passed');
