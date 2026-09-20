/* check-prompts.js — every agent's prompt is complete before a child talks to it.
 *
 * ai/loader.js builds a system prompt by filling {{placeholders}} in ai/agents/*.md and the skills
 * they list. An unknown placeholder becomes an empty string, silently, by design — so the failure
 * this file exists to catch leaves no trace anywhere:
 *
 *   The grader had NO placeholders at all. The server built the whole context it needed — the task,
 *   the steps, what the student changed — handed it to buildPrompt, and buildPrompt threw it away
 *   because the .md never asked for it. The agent judged a child's work having been told neither
 *   what the task was nor what they did. Nothing errored. Nothing logged. It was found by reading.
 *
 * So: every agent renders, nothing is left unfilled, and every slot an agent asks for actually
 * receives the value the server sends. A sentinel goes in and has to come out.
 *
 * This became load-bearing in Phase 3, which deleted the hand-written fallback prompts. Before
 * that, a missing or malformed .md quietly degraded to a 110-line string literal with half the
 * slots; now it is a 500 the moment anybody notices, which is the honest answer — and this is what
 * makes sure nobody has to notice in front of a class.
 *
 * Run by `npm test`.
 */
const fs = require('fs');
const path = require('path');

const AI_DIR = path.join(__dirname, '..', 'ai');
const loader = require(path.join(AI_DIR, 'loader.js'));

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log('PASS  ' + name + (detail ? '  — ' + detail : ''));
  else { failures++; console.error('FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

/* Every agent the server will dispatch to. Kept here rather than imported so that adding an agent
   to the whitelist without adding its .md fails here rather than at 4pm on a Sunday. */
const AGENTS = ['coder', 'tutor', 'lab-tutor', 'quiz', 'grader', 'design-coach'];

/* A request with every field the server can send, each carrying a sentinel we can look for. The
   values are deliberately unmistakable — a real lesson title could occur by accident; SENTINEL_LESSON
   cannot. */
const S = function (n) { return 'SENTINEL' + n.toUpperCase(); };
const CTX = {
  gameCode: S('gamecode'),
  lessonTitle: S('lessontitle'),
  lessonContext: S('lessoncontext'),
  practiceTask: { title: S('practicetitle'), task: S('practicetask'), steps: [S('practicestep')] },
  where: S('where'),
  lab: { title: S('labtitle'), task: S('labtask'), goal: S('labgoal'), code: S('labcode'), log: S('lablog') },
  assets: [{ key: S('assetkey'), type: 'image' }],
  files: [{ name: 'player.js', code: S('filecode') }],
  aiMode: 'full',
  gameLog: [{ level: 'error', text: S('gamelog'), n: 1 }],
  gameRan: true,
  fileName: 'player.js',
  lineNumber: '42',
  line: S('line'),
  snippet: S('snippet'),
  taskTitle: S('tasktitle'),
  taskSteps: [S('taskstep')],
  changedCode: S('changedcode'),
  board: { title: S('boardtitle'), lesson: S('boardlesson'),
    frames: [{ title: S('framename'), notes: [{ id: 'n-1', title: S('notetitle'), text: S('notetext') }] }],
    loose: [{ id: 'n-2', title: S('loosetitle'), text: S('loosetext') }] }
};

/* Which slot each placeholder is fed from, so "the .md asks for {{X}}" can be checked against "the
   value actually arrived". Mirrors the fill() call in loader.js. */
const SLOT_SENTINEL = {
  gameCode: S('gamecode'), lessonTitle: S('lessontitle'), lessonContext: S('lessoncontext'),
  practiceTask: S('practicetask'), whereTheyAre: S('where'),
  labTitle: S('labtitle'), labTask: S('labtask'), labGoal: S('labgoal'), labCode: S('labcode'), labLog: S('lablog'),
  ownedAssets: S('assetkey'), files: S('filecode'), gameLog: S('gamelog'),
  line: S('line'), snippet: S('snippet'),
  taskTitle: S('tasktitle'), taskSteps: S('taskstep'), changedCode: S('changedcode'),
  boardTitle: S('boardtitle'), boardLesson: S('boardlesson'),
  boardFrames: S('framename'), boardLoose: S('loosetitle'),
  aiMode: 'full', fileName: 'player.js', lineNumber: '42'
};

AGENTS.forEach(function (agent) {
  const md = path.join(AI_DIR, 'agents', agent + '.md');
  if (!fs.existsSync(md)) {
    check(agent + ': ai/agents/' + agent + '.md exists', false,
      'the server dispatches to this agent and there is no prompt for it');
    return;
  }
  const prompt = loader.buildPrompt(agent, CTX);
  check(agent + ': the prompt builds', !!prompt && prompt.length > 200,
    prompt ? prompt.length + ' chars' : 'buildPrompt returned null — a 500 for every request to this agent');
  if (!prompt) return;

  /* Nothing left unsubstituted. A stray {{typo}} is a slot the author expected to be filled. */
  const left = prompt.match(/\{\{(\w+)\}\}/g) || [];
  check(agent + ': no placeholder is left unfilled', left.length === 0, left.join(', ') || 'clean');

  /* Every slot the .md asks for received its value. This is the grader's bug, generalised. */
  const asked = (fs.readFileSync(md, 'utf8').match(/\{\{(\w+)\}\}/g) || [])
    .map(function (p) { return p.slice(2, -2); });
  const unknown = asked.filter(function (k) { return !(k in SLOT_SENTINEL); });
  check(agent + ': every slot it asks for is one the server sends', unknown.length === 0,
    unknown.length ? 'asks for {{' + unknown.join('}}, {{') + '}}, which loader.js never fills' : asked.length + ' slots');

  const missing = asked.filter(function (k) {
    return (k in SLOT_SENTINEL) && prompt.indexOf(SLOT_SENTINEL[k]) < 0;
  });
  check(agent + ': the values it asks for actually arrive', missing.length === 0,
    missing.length ? '{{' + missing.join('}}, {{') + '}} rendered empty' : 'all present');
});

/* The grader is the one agent whose reply can tell a child their work is not good enough, and it is
   the one this whole file was written for: it spent an unknown stretch judging students having been
   told neither the task nor what they changed.

   The quiz is deliberately NOT checked the same way. It asks for no slots at all, and that is not
   the same bug: js/ai.js puts the student's change and what it was meant to do into the USER
   message, so the agent does have the thing it is writing a question about. See the note below
   about what it is sent and never reads. */
(function () {
  const prompt = loader.buildPrompt('grader', CTX) || '';
  const knowsTheTask = prompt.indexOf(S('tasktitle')) >= 0 || prompt.indexOf(S('taskstep')) >= 0
    || prompt.indexOf(S('changedcode')) >= 0;
  check('grader: is told what was asked and what changed', knowsTheTask,
    knowsTheTask ? 'has the task and the change' : 'is judging a child with no idea what was asked');
})();

/* The flip side, as a note rather than a failure: context the server assembles, sends, and the
   agent's .md never asks for. loader.js drops it silently, so it costs the server work and buys the
   agent nothing. Sometimes correct — the quiz is handed its subject in the message instead — and
   sometimes a slot somebody meant to add. Worth seeing either way. */
const SENT_PER_AGENT = {
  quiz: ['lessonTitle', 'lessonContext'],
  grader: ['taskTitle', 'taskSteps', 'changedCode', 'lessonTitle', 'lessonContext'],
  'design-coach': ['boardTitle', 'boardLesson', 'boardFrames', 'boardLoose', 'lessonTitle']
};
Object.keys(SENT_PER_AGENT).forEach(function (agent) {
  const md = path.join(AI_DIR, 'agents', agent + '.md');
  if (!fs.existsSync(md)) return;
  const asked = (fs.readFileSync(md, 'utf8').match(/\{\{(\w+)\}\}/g) || []).map(function (p) { return p.slice(2, -2); });
  const ignored = SENT_PER_AGENT[agent].filter(function (k) { return asked.indexOf(k) < 0; });
  if (ignored.length) console.log('NOTE  ' + agent + ': sent {{' + ignored.join('}}, {{') + '}} and never reads '
    + (ignored.length === 1 ? 'it' : 'them'));
});

/* A skill that does not exist must not take the prompt down with it. */
const withBadSkill = loader.buildPrompt('tutor', Object.assign({}, CTX, { extraSkills: ['no-such-skill'] }));
check('an unknown skill is skipped, not fatal', !!withBadSkill,
  'a typo in a skill name must not 500 a student\'s question');

/* Path traversal through a skill name. Skill names arrive from front-matter AND from the request
   body, so this one is reachable from the browser. */
const traversal = loader.buildPrompt('tutor', Object.assign({}, CTX, { extraSkills: ['../../../etc/passwd'] }));
check('a skill name cannot walk out of ai/skills', !!traversal && traversal.indexOf('root:') < 0,
  'safeName() in loader.js is what stops this');

console.log('\n' + (failures
  ? failures + ' check(s) failed — an agent would answer a child with a prompt that is missing something'
  : 'every agent prompt builds complete, with every value it asked for'));
process.exit(failures ? 1 : 0);
