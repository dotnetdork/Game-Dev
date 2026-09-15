/* telemetry.js (browser half) — the things only the page can see.
 *
 * The server knows about AI requests and saves. It does not know that a child clicked the same spot
 * four times, that their game threw on frame one, that they got the same quiz question wrong twice,
 * or that a locked lesson turned them away. All of that happens here and, until this file, stayed
 * here.
 *
 * This batches those moments and posts them to /api/events, which prints them into the same log
 * stream the server's own events go to — so one capture file holds the whole session from both
 * sides. See app/telemetry.js for why that is stdout and not a database.
 *
 * WHAT IT DOES NOT DO: identify anybody. The batch carries no name, and the server stamps the
 * signed-in identity on arrival. A page cannot be trusted to say whose page it is.
 */

/* One per page load, so one child's visit reads as a run even though several children share the
   same tester name space. Not stored anywhere: a reload is a new run, which is the truth. */
const TEL_SID = Math.random().toString(36).slice(2, 10);

const telQueue = [];
let telTimer = null;
/* A child on a Chromebook with a flaky school network should not accumulate an unbounded queue.
   Fifty is more than a session produces between flushes; past that the oldest go. */
const TEL_MAX_QUEUE = 50;

function logEvent(ev, fields) {
  try {
    const e = Object.assign({ ev: String(ev || 'client'), sid: TEL_SID }, fields || {});
    telQueue.push(e);
    if (telQueue.length > TEL_MAX_QUEUE) telQueue.splice(0, telQueue.length - TEL_MAX_QUEUE);
    if (!telTimer) telTimer = setTimeout(flushEvents, 10000);
  } catch (err) { /* telemetry must never break the page */ }
}

/* `beacon` is used when the page is going away — a normal fetch is cancelled on unload and the last
   events of a session, which are the ones that say how it ended, are exactly the ones that would be
   lost. sendBeacon is queued by the browser and survives the navigation. */
function flushEvents(beacon) {
  try {
    if (telTimer) { clearTimeout(telTimer); telTimer = null; }
    if (!telQueue.length) return;
    const body = JSON.stringify({ events: telQueue.splice(0, telQueue.length) });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/events', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true
    }).catch(function () { /* a lost batch is a lost batch; never surface it */ });
  } catch (err) { /* as above */ }
}

window.addEventListener('pagehide', function () { flushEvents(true); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') flushEvents(true);
});

/* ---------- dead clicks and rage clicks ----------
 *
 * THE REASON THIS IS HERE AT ALL. On the 15th, a tester clicked the assistant's mode switcher while
 * on the Learn tab. It is only a button on Code and Play, so nothing happened, and he concluded the
 * app had no Build mode — and said so out loud, which is the only reason anybody found out. A child
 * will not say so. They will click it, get nothing, and quietly decide the feature does not exist.
 *
 * A dead click is a click that reached nothing interactive. It is a weak signal on its own and a
 * very strong one in aggregate: if all three children dead-click the same thing, that thing is
 * lying about what it is.
 */
const TEL_INTERACTIVE = 'a,button,input,select,textarea,label,summary,option,'
  + '[role="button"],[role="link"],[role="tab"],[contenteditable],'
  + '[data-nav],[data-page],[data-doc],[data-doc-open],[data-group],[data-act],[tabindex]';
/* Places that handle their own clicks on plain elements, where "nothing interactive" is wrong
   rather than interesting: the code editor, the design board, the running game. */
const TEL_LIVE_AREAS = '.CodeMirror,.cm-editor,#board,#boardWrap,canvas,iframe,.console,#console';

/* Enough to recognise the thing again without dragging the student's own text into the log. */
function telDescribe(el) {
  if (!el || !el.tagName) return '?';
  const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return el.tagName.toLowerCase()
    + (el.id ? '#' + el.id : '')
    + (cls ? '.' + cls : '')
    + (text ? ' "' + text + '"' : '');
}

let telLast = { x: 0, y: 0, at: 0, n: 0 };
document.addEventListener('click', function (e) {
  try {
    const t = e.target;
    if (!t || !t.closest) return;

    /* Rage: three or more clicks in the same small area in under a second. Reported once, at the
       third, rather than on every click after it. */
    const now = Date.now();
    const near = Math.abs(e.clientX - telLast.x) < 30 && Math.abs(e.clientY - telLast.y) < 30;
    telLast = near && (now - telLast.at) < 800
      ? { x: e.clientX, y: e.clientY, at: now, n: telLast.n + 1 }
      : { x: e.clientX, y: e.clientY, at: now, n: 1 };
    if (telLast.n === 3) logEvent('rageclick', { what: telDescribe(t), where: telWhere() });

    if (t.closest(TEL_LIVE_AREAS)) return;
    if (t.closest(TEL_INTERACTIVE)) return;
    logEvent('deadclick', { what: telDescribe(t), where: telWhere() });
  } catch (err) { /* never let a logger swallow a click */ }
}, true);

/* Which tab the student is looking at, so a dead click can be placed. */
function telWhere() {
  try {
    const views = ['learn', 'design', 'code', 'play'];
    for (let i = 0; i < views.length; i++) {
      const el = document.getElementById('view-' + views[i]);
      if (el && !el.hidden) return views[i];
    }
    const page = document.getElementById('page');
    if (page && !page.hidden) {
      const on = document.querySelector('.navitem.on');
      return on ? (on.getAttribute('data-page') || 'page') : 'page';
    }
  } catch (err) { /* fall through */ }
  return '';
}

/* ---------- what the app already announces ----------
   Registered once, in one readable block, the way wireLessonEvents does in widgets.js. Where an
   event already exists this subscribes to it rather than reaching into the code that raises it. */
(function wireTelemetry() {
  if (typeof on !== 'function' || typeof EV === 'undefined') return;

  on(EV.LESSON_OPENED, function (d) { logEvent('lesson', { act: 'opened', id: d && d.id, index: d && d.index }); });
  on(EV.LESSON_DONE, function (d) { logEvent('lesson', { act: 'done', id: d && d.id, xp: d && d.xp }); });
  on(EV.MODULE_DONE, function (d) { logEvent('module', { id: d && d.moduleId, stars: d && d.stars }); });
  on(EV.LESSON_BLOCKED, function (d) { logEvent('blocked', { id: d && d.id, why: d && d.why }); });
  on(EV.QUIZ_ANSWERED, function (d) {
    logEvent('quiz', {
      lesson: d && d.lesson, key: d && d.key, kind: d && d.kind,
      correct: !!(d && d.correct), attempts: d && d.attempts
    });
  });
  on(EV.GAME_FAILED, function (d) { logEvent('gamefail', { reason: d && d.reason, detail: d && d.detail }); });
})();

/* Called from ai.js on every reply from /api/ai and /api/info.
   A failed request is currently invisible to the child in the worst possible way: nothing checks
   `r.ok`, so a 401 from a lapsed session parses to a body with no `reply`, and the panel prints
   "I am not sure how to do that one — can you say it a different way?" A child is told the robot
   did not understand them when in fact they were signed out. Until that is fixed, at least the log
   knows the difference. */
function telAIResponse(r) {
  try {
    if (!r || r.ok) return;
    logEvent('apifail', {
      status: r.status,
      url: String(r.url || '').replace(location.origin, ''),
      where: telWhere()
    });
  } catch (err) { /* never turn a failed request into a second failure */ }
}

/* ---------- what the running game says ----------
   The game frame posts every console line and every thrown error to the parent; console-dock.js
   shows them and game-runner.js uses them to decide whether the game booted. This listens to the
   same messages for the two levels that mean something went wrong.
   Deliberately not `log`: that is the student's own printing, it is the whole point of the console
   panel, and it is none of the log's business. An error is different — it is the game telling them
   no, and it is the thing we want to count across three children. */
window.addEventListener('message', function (e) {
  try {
    const d = e && e.data;
    if (!d || !d.__gamelog) return;
    if (d.level !== 'error' && d.level !== 'warn') return;
    logEvent('gamelog', {
      level: d.level,
      text: String(d.text || '').slice(0, 300),
      file: d.file || undefined,
      line: d.line || undefined
    });
  } catch (err) { /* never interfere with the game's own logging */ }
});

/* The first thing in the file, so a run that produces nothing else still says somebody arrived. */
logEvent('open', { ua: String(navigator.userAgent || '').slice(0, 120), w: window.innerWidth, h: window.innerHeight });
