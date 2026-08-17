/* dev.js — switches for working ON the app, not for using it.
 *
 * ============================================================
 *  BEFORE PRODUCTION: set unlockAll back to false.
 * ============================================================
 *
 * Change the value below and that is the whole job. A URL parameter can override either one for a
 * single page load (?unlock=0, ?sandbox=0) without touching the file.
 */
const DEV = {
  /* Every lesson clickable, in any order, without finishing the one before, so the course can be
     read and proof-read without playing through it.
     ON while we are building. Set to false for students, or the course has no sequence. */
  unlockAll: true,

  /* The game frame runs with an opaque origin so student code cannot reach the app. Leave on.
     Off only to rule it out if assets ever mysteriously fail to load. */
  sandboxGame: true
};

/* A one-off override from the URL, e.g. ?unlock=0 to see the locking behave as a student would. */
try {
  const q = new URLSearchParams(location.search);
  const map = { unlock: 'unlockAll', sandbox: 'sandboxGame' };
  Object.keys(map).forEach(function (k) {
    const v = q.get(k);
    if (v !== null) DEV[map[k]] = (v !== '0' && v !== 'false');
  });
} catch (e) { /* a malformed URL must not stop the app starting */ }

/* Console only — no badge, nothing on screen. Just enough that "why is nothing locked?" is one
   glance at the log rather than an afternoon. */
if (DEV.unlockAll) console.warn('[dev] unlockAll is ON — every lesson is open. Set it to false in js/dev.js for production.');
if (!DEV.sandboxGame) console.warn('[dev] the game frame is NOT sandboxed.');
