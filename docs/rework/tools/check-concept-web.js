/* check-concept-web.js — does the concept web keep the rules the curriculum map sets?
 *
 * docs/rework/concept-web.yaml is the map of what there is to learn: people write it, and the
 * director, the characters and every shift read from it (course-engine.md, part 1). A web that is
 * wrong is wrong everywhere at once, silently: a concept that needs something taught later, a session
 * that introduces five new words, an idea that never comes back and so is never really owned.
 * curriculum-map.md sets the rules; this checks them, so the web can be edited without re-deriving
 * the map by hand.
 *
 *   ids        unique, and every `needs` names a concept that exists
 *   order      nothing needs a concept introduced in a LATER session
 *   budget     ≤3 new technical (tier 3) terms and ≤1 studio (tier 2) word per session
 *   returns    ≥4 later sessions each (a same-session retrieval counts one, S7 only), all after the
 *              introducing session, none past session 10
 *   evidence   every concept says what the kid must do and how code judges it
 *   wireframes every wireframe a concept names exists
 *   verified   lists the engine names nobody has checked yet: a report, not a failure, until the
 *              cards go to kids (curriculum-map.md, open question 5)
 *
 * Standalone, like app/tools/check-*.js: run it, read it. It borrows the app's vendored js-yaml
 * rather than adding a dependency. Not in `npm test` yet, because the rework isn't in app/ yet.
 *
 * Run: node docs/rework/tools/check-concept-web.js
 */
const fs = require('fs');
const path = require('path');
const yaml = require('../../../app/public/vendor/js-yaml/js-yaml.min.js');

const REWORK = path.join(__dirname, '..');
const web = yaml.load(fs.readFileSync(path.join(REWORK, 'concept-web.yaml'), 'utf8')) || {};
const concepts = web.concepts || [];

let failed = 0;
function check(label, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (detail ? '  — ' + detail : ''));
  if (!ok) failed++;
}

const byId = {};
concepts.forEach(function (c) { byId[c.id] = c; });

console.log('--- ids ---');
check('there are concepts', concepts.length > 0, concepts.length + ' concepts');
const dupes = concepts.map(function (c) { return c.id; }).filter(function (id, i, a) { return a.indexOf(id) !== i; });
check('every id is unique', dupes.length === 0, dupes.join(', ') || 'none duplicated');
const missing = [];
concepts.forEach(function (c) { (c.needs || []).forEach(function (n) { if (!byId[n]) missing.push(c.id + ' → ' + n); }); });
check('every need names a concept that exists', missing.length === 0, missing.join('; ') || 'all found');

console.log('\n--- order ---');
const early = [];
concepts.forEach(function (c) {
  (c.needs || []).forEach(function (n) { if (byId[n] && byId[n].session > c.session) early.push(c.id + ' (S' + c.session + ') needs ' + n + ' (S' + byId[n].session + ')'); });
});
check('nothing needs a concept taught later', early.length === 0, early.join('; ') || 'in order');

console.log('\n--- budget ---');
for (let s = 1; s <= 10; s++) {
  const t3 = concepts.filter(function (c) { return c.session === s && c.tier === 3; });
  const t2 = concepts.filter(function (c) { return c.session === s && c.tier === 2; });
  if (!t3.length && !t2.length) continue;
  check('S' + s + ': ≤3 technical terms, ≤1 studio word', t3.length <= 3 && t2.length <= 1,
    t3.length + ' technical (' + t3.map(function (c) { return c.name; }).join(', ') + ')' + (t2.length ? ' + ' + t2.map(function (c) { return c.name; }).join(', ') : ''));
}

console.log('\n--- returns ---');
concepts.forEach(function (c) {
  const r = c.returns || [];
  const bad = r.filter(function (s) { return s <= c.session || s > 10; });
  const count = r.length + (c.same_session_return ? 1 : 0);
  check(c.name + ' comes back ≥4 times, all later', count >= 4 && bad.length === 0,
    count + (c.same_session_return ? ' (incl. same-session)' : '') + (bad.length ? '; out of range: ' + bad.join(', ') : ''));
});

console.log('\n--- evidence and wireframes ---');
const noEvidence = concepts.filter(function (c) { return !c.evidence || !String(c.evidence).trim() || !c.kid; }).map(function (c) { return c.id; });
check('every concept has a kid definition and evidence', noEvidence.length === 0, noEvidence.join(', ') || 'all have both');
const lostWf = concepts.filter(function (c) { return c.taught_by && c.taught_by.wireframe && !fs.existsSync(path.join(REWORK, c.taught_by.wireframe)); })
  .map(function (c) { return c.id + ' → ' + c.taught_by.wireframe; });
check('every named wireframe exists', lostWf.length === 0, lostWf.join('; ') || 'all found');

console.log('\n--- not yet verified (report) ---');
const unverified = concepts.filter(function (c) { return c.engines && c.engines.verified === false; });
console.log('REPORT  ' + unverified.length + ' concepts have engine names nobody has checked against the engines’ docs:');
unverified.forEach(function (c) { console.log('        ' + c.name + ': ' + [c.engines.unity, c.engines.unreal, c.engines.godot].filter(Boolean).join(' · ')); });

console.log('\n' + (failed ? failed + ' check(s) failed' : 'the concept web keeps the rules'));
process.exitCode = failed ? 1 : 0;
