/* events.js — one place things get announced, so the announcer doesn't have to know who's listening.
 *
 * The problem this solves, concretely. When a student finishes a lesson, five things have to
 * happen: the outline row ticks, the footer XP updates, the progress strip celebrates, the next
 * lesson unlocks, and the save is written. Today completeLesson() calls each of those by name. So
 * completeLesson has to KNOW about the outline, the footer and the strip — and the next person who
 * adds a sixth thing has to find every place a lesson can finish and add a sixth call there too.
 *
 * That is how the answers-get-wiped bug happened: completeLesson called selectLesson to refresh
 * the screen, and selectLesson rebuilt the lesson from scratch, destroying the very answers that
 * had just triggered the completion.
 *
 * With this, completeLesson says "a lesson finished" and stops caring. The outline, the footer and
 * the strip each say "tell me when that happens". Adding a sixth thing touches one file — the new
 * one — instead of every place a lesson can end.
 *
 * Deliberately about thirty lines. This is not a framework and should not grow into one.
 */
const _listeners = {};

/* Listen for something. Returns a function that stops listening, so anything temporary (a widget
   that belongs to the lesson currently on screen) can clean up after itself instead of piling up
   dead handlers every time a student changes lesson. */
function on(name, fn) {
  (_listeners[name] || (_listeners[name] = [])).push(fn);
  return function off() {
    const list = _listeners[name];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

/* Announce something. `detail` is whatever the listeners need — for a finished lesson, which one.
   A listener that throws is reported and skipped rather than allowed to stop the others: if the
   footer has a bug, the outline should still tick. */
function emit(name, detail) {
  const list = _listeners[name];
  if (!list || !list.length) return 0;
  list.slice().forEach(function (fn) {          // copy: a listener may remove itself while running
    try { fn(detail); }
    catch (e) { console.error('[league] a "' + name + '" listener failed:', e); }
  });
  return list.length;
}

/* The names, in one place, so a typo is a missing constant instead of an event nobody ever
   receives. `emit('lessson-done')` fails silently forever; `EV.LESSSON_DONE` fails immediately. */
const EV = {
  LESSON_DONE: 'lesson:done',        // detail: { id, xp, moduleIndex }
  MODULE_DONE: 'module:done',        // detail: { moduleIndex, stars }
  PROGRESS_CHANGED: 'progress:changed',  // XP, Stars or unlocks moved
  PROJECT_CHANGED: 'project:changed',    // the student's files were edited or saved
  LESSON_OPENED: 'lesson:opened',    // detail: { index, id }
  BADGE_EARNED: 'badge:earned'       // detail: { name, lesson }
};
