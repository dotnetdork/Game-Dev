/* Runs every ```challenge block the way the sandboxed iframe does, and checks two things that
   matter: an untouched challenge must NOT win (and must terminate), and the intended fix MUST win. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = process.argv[2] || path.join(__dirname, '..', 'content', 'lessons');

// The intended student edit for each challenge, keyed by lesson file.
const FIXES = {
  'how-the-course-works.md':  [['let xp = 0;', 'let xp = 100;']],
  'playtesting.md':           [['const pointsPerStar = 0;', 'const pointsPerStar = 2;']],
  'why-javascript-phaser.md': [['// add one line here: move x right by 4', 'x = x + 4;']],
  'you-and-your-ai.md':       [['score + points;', 'score = score + points;']],
  'state-machines.md':        [['// set state to "dead" here', 'state = "dead";']],
  'publish.md':               [['const speed = 0;', 'const speed = 4;'], ['const catcherX = 0;', 'const catcherX = 150;']],
  'challenge-drive-the-ship.md': [['const speed = 0;', 'const speed = 4;']],
  'challenge-catch-the-stars.md': [['const fallSpeed = 0;', 'const fallSpeed = 4;']],
  'challenge-add-a-fail-state.md': [['health = health;', 'health = health - 1;']],
  'challenge-make-a-hit-feel-great.md': [['const shakeAmount = 0;', 'const shakeAmount = 6;']]
};

function stubCtx() {
  const noop = function () {};
  return new Proxy({ fillStyle: '', font: '', strokeStyle: '', lineWidth: 0 }, {
    get(t, k) { return k in t ? t[k] : noop; },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function runChallenge(code) {
  return new Promise(function (resolve) {
    let won = false, err = null, pending = 0, settled = false;
    const finish = function () { if (!settled) { settled = true; resolve({ won, err }); } };
    const sandbox = {
      canvas: { width: 300, height: 200, getContext: stubCtx },
      ctx: stubCtx(),
      win: function () { won = true; },
      Math, String, Number, Boolean, Array, Object, JSON, isNaN, parseInt, parseFloat,
      console: { log: function () {} }
    };
    sandbox.setTimeout = function (fn, ms) {
      pending++;
      setTimeout(function () {
        try { fn(); } catch (e) { err = String(e && e.message || e); }
        pending--;
        if (pending === 0) finish();
      }, Math.min(ms || 0, 1));
    };
    sandbox.requestAnimationFrame = function (fn) { return sandbox.setTimeout(fn, 1); };
    try {
      vm.createContext(sandbox);
      vm.runInContext(code, sandbox, { timeout: 4000 });
    } catch (e) { err = String(e && e.message || e); return finish(); }
    if (pending === 0) finish();
    setTimeout(finish, 9000);           // runaway guard
  });
}

function blocks(md) {
  const out = [];
  const re = /```challenge\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) out.push(m[1]);
  return out;
}

/* Pulls one `key: |` block out, de-indented, stopping at the first line that dedents past it.
   Hand-rolled rather than a real YAML parse because these blocks hold JavaScript, and a stray
   colon or `#` inside a string is perfectly good code that a strict parser would reject. */
function blockValue(src, key) {
  const at = src.indexOf('\n' + key + ': |');
  if (at < 0) return null;
  const body = src.slice(at + ('\n' + key + ': |').length).replace(/^\n/, '');
  const lines = body.split('\n');
  const first = lines.find(function (l) { return l.trim(); }) || '';
  const indent = first.match(/^\s*/)[0].length;
  if (!indent) return null;
  const out = [];
  for (const l of lines) {
    if (l.trim() && l.match(/^\s*/)[0].length < indent) break;   // dedented: the block has ended
    out.push(l.slice(indent));
  }
  return out.join('\n').replace(/\s+$/, '');
}

// tiny YAML reader for the keys we use (title:, task:, code: |, solution: |)
function parseChallenge(src) {
  const code = blockValue(src, 'code');
  if (code === null) return null;
  const head = src.slice(0, src.indexOf('\ncode: |') + 1);
  const task = (head.match(/^task:\s*(.+)$/m) || [])[1] || '';
  const title = (head.match(/^title:\s*(.+)$/m) || [])[1] || '';
  return { title, task, code, solution: blockValue(src, 'solution') };
}

(async function () {
  const files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.md'); });
  const rows = [];
  for (const f of files) {
    const md = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const b of blocks(md)) {
      const c = parseChallenge(b);
      if (!c) { rows.push({ file: f, status: 'UNPARSEABLE' }); continue; }
      const before = await runChallenge(c.code);
      /* The worked answer now lives in the lab itself, as `solution:` — the student is offered it
         when they get properly stuck, so the same text is both the escape hatch and the thing this
         checks. That is the point: a fix kept in a separate table here can drift out of step with
         the lesson, and then this passes while the lesson is broken.
         FIXES stays as a fallback for any lab that has no solution authored yet. */
      let after = null;
      if (typeof c.solution === 'string' && c.solution.trim()) {
        after = await runChallenge(c.solution);
      } else if (FIXES[f]) {
        let fixed = c.code;
        FIXES[f].forEach(function (p) {
          if (fixed.indexOf(p[0]) < 0) throw new Error(f + ': fix anchor not found -> ' + p[0]);
          fixed = fixed.replace(p[0], p[1]);
        });
        after = await runChallenge(fixed);
      }
      rows.push({
        file: f, title: c.title, hasTask: !!c.task,
        unfixedWins: before.won, unfixedErr: before.err,
        fixedWins: after ? after.won : 'NO FIX DEFINED', fixedErr: after ? after.err : null
      });
    }
  }
  let bad = 0;
  rows.forEach(function (r) {
    const ok = r.hasTask && r.unfixedWins === false && !r.unfixedErr && r.fixedWins === true && !r.fixedErr;
    if (!ok) bad++;
    console.log((ok ? 'PASS  ' : 'FAIL  ') + r.file.padEnd(30) + JSON.stringify(r));
  });
  console.log('\n' + rows.length + ' challenges, ' + bad + ' failing');
  process.exit(bad ? 1 : 0);
})();
