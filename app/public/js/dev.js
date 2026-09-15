/* dev.js — switches for working ON the app, not for using it.
 *
 * ============================================================
 *  DEV MODE IS DERIVED, NOT REMEMBERED.
 *
 *  It is on when the app is served from a laptop and off when
 *  it is served from anywhere else — so the build that goes to
 *  Vercel is a student's build because of where it is, not
 *  because somebody remembered to flip a constant back before
 *  pushing. The old arrangement was a `true` in this file plus
 *  a release check to catch it, which is a reminder with a
 *  safety net rather than a thing that cannot go wrong.
 * ============================================================
 *
 * WHAT DEV MODE CHANGES
 *
 *   the course      every lesson open, in any order, so it can be read and proof-read without
 *                   playing through it. Locked in a student's build, or the course has no sequence.
 *   Reset everything  the icon beside the version in the footer. A testing control — it puts the
 *                   browser back to a brand-new account — and never something a student should find.
 *   Reset the game  the ↺ in the Play tab's transport, which throws away their code and restores
 *                   the starter files.
 *
 * Two of those three destroy a student's work with one press, which is the whole reason they are
 * behind this and not behind a confirmation dialog alone.
 */

/* THE SERVER'S ANSWER FIRST, because it is the only one that is not a guess.
   Every response carries `league_hosted`: 1 when the app is running on Vercel or with
   NODE_ENV=production, 0 when it is somebody's laptop. See the note on the cookie in server.js.
   A "1" ends the question — no hostname, no URL parameter, nothing else can turn dev mode back on.

   The hostname check below remains as the fallback for the case the cookie cannot cover: a page
   opened straight off the disk, with no server to have set it. */
function hostedCookie() {
  try {
    const m = String(document.cookie || '').match(/(?:^|;\s*)league_hosted=([01])/);
    return m ? m[1] === '1' : null;
  } catch (e) { return null; }
}
/* Localhost, the loopback addresses, and the .local names a machine answers to on a school network.
   Everything else — Vercel, a preview deployment, a tunnel — is a student's build. */
function devHost() {
  const hosted = hostedCookie();
  if (hosted !== null) return !hosted;
  const h = String(location.hostname || '').toLowerCase();
  if (!h) return true;                             // opened as a file: a laptop, by definition
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
    || h === '0.0.0.0' || /\.local$/.test(h) || /\.localhost$/.test(h);
}

const DEV = {
  /* The one switch. Everything else in here reads it. */
  on: devHost(),

  /* Every lesson clickable, in any order, without finishing the one before. */
  unlockAll: devHost(),

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
  sandboxGame: true
};

/* A one-off override from the URL — `?dev=0` to see the app exactly as a student does, `?unlock=0`
   for just the locking, `?sandbox=0` to run a game.

   IT CAN ONLY EVER TURN THINGS OFF ON A HOSTED BUILD. `?dev=1` on the deployed site would be a link
   a student could pass round that unlocks the whole course and hands them a button that wipes their
   game — so on anything that is not a laptop, an override that asks for MORE is ignored and only an
   override that asks for less is honoured. */
try {
  const q = new URLSearchParams(location.search);
  const here = devHost();
  const set = function (key, v) {
    const want = (v !== '0' && v !== 'false');
    if (want && !here) return;                     // never switch dev things ON from a URL
    DEV[key] = want;
  };
  if (q.get('dev') !== null) {
    set('on', q.get('dev'));
    set('unlockAll', q.get('dev'));
  }
  if (q.get('unlock') !== null) set('unlockAll', q.get('unlock'));
  /* The sandbox is not a dev privilege — it is a diagnosis switch, and turning it OFF is the
     direction that needs no guard because it only ever removes an isolation the frame already
     cannot use. It stays overridable anywhere so a broken deployment can be diagnosed. */
  if (q.get('sandbox') !== null) DEV.sandboxGame = (q.get('sandbox') !== '0' && q.get('sandbox') !== 'false');
} catch (e) { /* a malformed URL must not stop the app starting */ }

/* Marked on the root element so CSS can hide the dev-only controls outright rather than every one of
   them having to remember to check. Absent is the safe state: a control that forgets to ask stays
   hidden in a student's build instead of appearing in it. */
try {
  if (DEV.on) document.documentElement.setAttribute('data-dev', '');
} catch (e) { /* nothing to mark yet; index.html sets it too */ }

/* Console only — no badge. Just enough that "why is nothing locked?" is one glance at the log. */
if (DEV.on) console.warn('[dev] dev mode is ON (' + (location.hostname || 'file') + ') — every lesson is open and the reset controls are showing. Add ?dev=0 to see it as a student does.');
if (!DEV.sandboxGame) console.warn('[dev] the game frame is NOT sandboxed.');
