/* dev.js — switches for working ON the app, not for using it.
 *
 * ============================================================
 *  BEFORE PRODUCTION: set unlockAll back to false.
 *  You do not have to remember this:
 *      npm --prefix app run check:release
 *  fails while it is on. Run that before a class. It is kept out
 *  of `npm test` so the daily run stays green while building.
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
     Off only to rule it out if assets ever mysteriously fail to load.

     KNOWN BROKEN, and this is the diagnosis rather than a suspicion. With this on, the game does
     not run at all: "Phaser is not defined". An opaque-origin document cannot make ANY subresource
     request back to the app, so neither Phaser nor a single asset arrives. Measured:

       sandbox="allow-scripts"                    Phaser missing
       sandbox="allow-scripts allow-same-origin"  works
       no sandbox attribute                       works

     and it is none of the things it looks like: no securitypolicyviolation fires, the CSP already
     names the origin explicitly beside 'self' (see cspFor in server.js), the responses carry
     Cross-Origin-Resource-Policy: cross-origin and Access-Control-Allow-Origin: *, and the file
     serves 200 with credentials omitted. Even a no-cors fetch from inside the frame fails, so it is
     a hard network block rather than CORS or CSP.

     The real fix is the one the CSP comment already names: serve the game frame from its own
     origin, which gets it a real origin instead of an opaque one and lets the sandbox stay. Until
     then this switch is a choice between a sandboxed frame that cannot run and an unsandboxed one
     that can — so it is left ON deliberately, and `?sandbox=0` is how you run a game today. */
  sandboxGame: true,

  /* ---- the two shapes a BUILD checkpoint can have, so they can be compared ----
     OFF (default): a build checkpoint opens the board — the full-screen canvas with Done / Now /
     Still ahead lanes and the coach laid over it. The objectives are stickies the checks move.

     ON: the same checkpoint opens IN THE CODE VIEW instead, as a rail down the right-hand side:
     the same objective chain, the same coach, the same checks, the same Finish — beside the editor
     rather than in front of it.

     The argument for the rail is that a build objective IS a code check (`config_changed`,
     `function_added`, `file_changed: game.js`), so the student needs the editor and the objective on
     screen together, and a full-screen board is a modal that hides the editor. The board's own
     "Open the Code tab" button exists because of that, and it closes the checkpoint to get there.

     The argument for the board is that a checkpoint should feel like a place rather than a panel,
     and all six should feel like the same kind of thing.

     Try both with ?rail=1 and ?rail=0 on a build checkpoint (Build Your First Mechanic, Room to
     Grow, Launch Your Game). The three DESIGN checkpoints ignore this switch entirely — the board
     is the only sensible home for a one-sheet the coach fills in by interview. */
  buildRail: false
};

/* A one-off override from the URL, e.g. ?unlock=0 to see the locking behave as a student would. */
try {
  const q = new URLSearchParams(location.search);
  const map = { unlock: 'unlockAll', sandbox: 'sandboxGame', rail: 'buildRail' };
  Object.keys(map).forEach(function (k) {
    const v = q.get(k);
    if (v !== null) DEV[map[k]] = (v !== '0' && v !== 'false');
  });
} catch (e) { /* a malformed URL must not stop the app starting */ }

/* Console only — no badge, nothing on screen. Just enough that "why is nothing locked?" is one
   glance at the log rather than an afternoon. */
if (DEV.unlockAll) console.warn('[dev] unlockAll is ON — every lesson is open. Set it to false in js/dev.js for production.');
if (!DEV.sandboxGame) console.warn('[dev] the game frame is NOT sandboxed.');
if (DEV.buildRail) console.warn('[dev] buildRail is ON — build checkpoints open as a rail in the Code view, not as a board.');
