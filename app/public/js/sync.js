/* sync.js — keeping the student's work on the server as well as in this browser.
 *
 * Everything the app saves goes through `Storage`, and `Storage` is per-browser-per-machine. That
 * is fine on one laptop and not fine for the beta: the testers get more than one session, on more
 * than one machine, and the promise made to them was that their game would still be there.
 *
 * So: the same three blobs, mirrored to /api/state under whoever they signed in as.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THE FIRST LOAD CAN RELOAD THE PAGE
 *
 * The awkward part is the ORDER. project.js and course.js read localStorage as they load — the
 * project is built, the progress migrated, the outline ticked — and all of that has happened long
 * before a fetch to /api/state could come back. There is no synchronous way to get the server's
 * copy in first.
 *
 * Three options, and the third is the one here:
 *
 *   1. Make boot asynchronous and await the fetch. Touches every file that reads storage at load,
 *      to solve a problem that only exists on the first load of a fresh browser.
 *   2. Have the server inline the state into index.html. Clean, but index.html is a static file
 *      served by express.static, and making it dynamic to carry a blob is a big change for this.
 *   3. Let the page load normally. If the server turns out to have work this browser does not,
 *      write it into localStorage and reload once.
 *
 * Three costs one extra reload, and only when there is genuinely something to adopt — a returning
 * tester on a different machine, which is exactly the case this exists for. A student in the middle
 * of a session never sees it. `sessionStorage` holds a flag so a failure can never loop.
 *
 * ---------------------------------------------------------------------------------------------
 * WHICH COPY WINS
 *
 * Last write, by clock. Not a merge: merging two divergent copies of a child's game without being
 * able to ask them which one they wanted is how you lose the one they cared about. The server
 * records when it was written; this browser records when it last pushed. Newer wins, whole.
 *
 * This is a real limitation and worth naming: the same student signed in on two machines at once
 * will have one of them overwrite the other. For five testers on a call it is the right trade. For
 * a classroom it would not be, and the answer then is per-key timestamps rather than a bundle.
 */

/* The three keys worth keeping: their game's code, their progress ledger, their design board. The
   chat threads ride along inside the progress blob, so those come too.
   `leagueMuted` and `leagueVol` are left out because they belong to the machine, not the student.
   `leagueStudentId` is left out ON PURPOSE, and not because it does not matter: it is minted at
   load by project.js, before this file has heard back from the server, so a brand-new browser
   would write one, count itself as having work, and then refuse to adopt a real save that was
   older than that write. It is an anonymous id for attributing AI calls; a different one per
   machine costs nothing, and the bug it would buy is a child losing their game. */
const SYNC_KEYS = ['leagueProject', 'leagueProgress', 'leagueBoard'];
const SYNC_AT = 'leagueSyncedAt';       // when this browser last pushed, so it can tell who is newer
const SYNC_WHO = 'leagueSyncedWho';     // WHOSE work is in this browser — see the owner check below
const ADOPT_FLAG = 'leagueAdopted';     // sessionStorage; stops an adopt-reload loop

let syncOn = false;                     // does the server have a store at all
let ownerOk = false;                    // is the work in this browser the signed-in student's
let pushTimer = 0;
let pushing = false;
let pendingWhilePushing = false;

function syncBundle() {
  const out = {};
  SYNC_KEYS.forEach(function (k) {
    const raw = Storage.read(k);
    if (raw !== null) out[k] = raw;     // the STRING, exactly as stored — no reparsing on the way
  });
  return out;
}
function syncLocalAt() { return Number(Storage.read(SYNC_AT) || 0); }

/* Every upload says whose work the browser believes it is carrying. The server refuses it if that
   disagrees with the session presenting it — see the 409 in /api/state. */
function pushBody() {
  return { who: Storage.read(SYNC_WHO) || '', data: syncBundle() };
}

/* Anything to save at all? A brand-new browser has nothing, and pushing an empty bundle over a real
   save would be the worst possible bug in this file. */
function syncHasWork() {
  const b = syncBundle();
  return SYNC_KEYS.some(function (k) { return typeof b[k] === 'string' && b[k].length > 2; });
}

function pushState() {
  /* `ownerOk` is the belt to the owner check's braces. That check ends in a reload, so in the
     ordinary case nothing below it ever runs for the wrong student — but the adopt flag makes it
     once-per-tab, and a tab that somehow got past it must still never upload one child's game
     under another child's name. */
  if (!syncOn || !ownerOk) return;
  if (pushing) { pendingWhilePushing = true; return; }
  if (!syncHasWork()) return;
  pushing = true;
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(pushBody())
  })
    .then(function (r) {
      /* The server says this work belongs to somebody else — the session changed under this tab.
         Stop, and let a fresh load sort out whose browser this now is. */
      if (r.status === 409) { syncOn = false; ownerOk = false; return null; }
      return r.ok ? r.json() : null;
    })
    .then(function (d) {
      /* Stamped with the SERVER's clock, not ours. A Chromebook with the wrong date would otherwise
         decide it was years newer than the server forever, and never accept a save again. */
      if (d && d.at) Storage.write(SYNC_AT, String(d.at));
    })
    .catch(function () { /* offline: the next write tries again, and localStorage still has it */ })
    .finally(function () {
      pushing = false;
      if (pendingWhilePushing) { pendingWhilePushing = false; pushSoon(); }
    });
}
/* Debounced hard. A slider drag or a run of keystrokes in the editor can write twenty times in a
   second and the server does not need to hear about any but the last. */
function pushSoon() {
  if (!syncOn) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushState, 2500);
}

/* Take the server's copy. Written straight into storage as the same strings that came out of it, so
   project.js's own migrations run on them at the next load exactly as they would on a local save. */
function adoptState(data) {
  SYNC_KEYS.forEach(function (k) {
    if (typeof data[k] === 'string') Storage.write(k, data[k]);
    /* A key the server does not have is one this student never made. Removing it matters: a
       borrowed laptop may have somebody else's board sitting in it. */
    else Storage.remove(k);
  });
}

/* ---- the takeover check, and why it is synchronous ----
   This runs at script-load time, before project.js has read a single byte of localStorage, and it
   is the only part of this file that cannot be async.

   The reason is a bug that took two goes to kill. Asking the server "who am I?" and wiping when the
   answer disagrees is too late: by the time the fetch returns, project.js has already built the app
   out of the previous student's save, and ANY write between the wipe and the reload — a debounced
   project save, the progress ledger stamping itself — puts it straight back. The reload then reads
   it in again and the second child spends the session inside the first child's game.

   So the identity comes from a cookie the server sets alongside the session, readable here without
   asking anything. If it names somebody other than the owner stamped in this browser, the previous
   student's work is dropped NOW, while nothing has read it yet. No reload, no race, no window. */
function readWhoCookie() {
  const m = /(?:^|;\s*)league_who=([^;]*)/.exec(document.cookie || '');
  try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
}
function takeoverCheck() {
  if (typeof Storage !== 'object') return;
  const me = readWhoCookie();
  const localWho = Storage.read(SYNC_WHO) || '';
  if (!me) return;                       // signed out, or an older session with no companion cookie
  if (!localWho) { Storage.write(SYNC_WHO, me); return; }   // unstamped browser: claim it, keep it
  if (localWho === me) return;
  /* Somebody else's browser. Drop everything of theirs and stamp it for whoever is here now; the
     async pass below will bring this student's own work down from the server if they have any. */
  SYNC_KEYS.forEach(function (k) { Storage.remove(k); });
  Storage.remove(SYNC_AT);
  Storage.write(SYNC_WHO, me);
  try { sessionStorage.removeItem(ADOPT_FLAG); } catch (e) {}
}

function startSync() {
  if (typeof Storage !== 'object' || typeof fetch !== 'function') return;
  fetch('/api/state', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.store) return;                 // nothing configured; localStorage alone, as before
      syncOn = true;

      const serverAt = Number(d.at || 0);
      const localAt = syncLocalAt();
      const theirs = !!(d.data && Object.keys(d.data).length);

      /* ---- WHOSE WORK IS THIS? ----
         localStorage is a cache of ONE student's work and has no idea whose. Two testers sharing a
         borrowed laptop — which is exactly what is going to happen on the 20th, Jed is lending one
         out — meant the second to sign in opened the first one's game, carried on in it, and then
         pushed it up under their own name. Both children lose, which is the one outcome this whole
         file exists to prevent.

         So the browser records the owner. A different owner means everything here belongs to
         somebody else: drop it, take whatever the server holds for the person actually signed in
         (which is nothing at all, for a student's first session), and reload into it.

         An EMPTY record is not a mismatch. It is a browser that was used before this file existed,
         and that work is the signed-in student's by the only reckoning available. */
      const localWho = Storage.read(SYNC_WHO) || '';
      const me = String(d.me || '');
      const wrongOwner = !!(localWho && me && localWho !== me);
      /* Work that counts as this student's. Somebody else's does not count as theirs at all, so a
         mismatch has to read as "this browser has nothing" rather than "this browser has newer". */
      const mine = !wrongOwner && syncHasWork();

      /* The owner check runs even when the store is unreachable, and it is the ONE thing that still
         has to happen then: it needs only who is signed in, which the server answers from the
         session cookie without touching the store. A tab that skipped it would go on saving one
         child's work into another child's browser. */
      if (wrongOwner && !sessionStorage.getItem(ADOPT_FLAG)) {
        try { sessionStorage.setItem(ADOPT_FLAG, '1'); } catch (e) {}
        adoptState(d.error ? {} : (d.data || {}));   // {} wipes the previous student's work
        Storage.write(SYNC_AT, d.error ? '0' : String(serverAt));
        Storage.write(SYNC_WHO, me);
        location.reload();
        return;
      }
      if (me && localWho !== me) Storage.write(SYNC_WHO, me);   // first run, or an unstamped browser
      ownerOk = !wrongOwner;

      /* Reachable but broken. Keep saving locally and try again on the next write, rather than
         adopting a null over the top of real work. */
      if (d.error) { onStorageWrite(function (k) { if (SYNC_KEYS.indexOf(k) >= 0) pushSoon(); }); return; }

      /* Adopt when the server has work and this browser either has none or has an older push. The
         flag makes it once-per-tab: if adopting somehow does not settle it, the student gets the
         app rather than a reload loop. */
      const stale = theirs && (!mine || serverAt > localAt);
      if (stale && !sessionStorage.getItem(ADOPT_FLAG)) {
        try { sessionStorage.setItem(ADOPT_FLAG, '1'); } catch (e) {}
        adoptState(d.data);
        Storage.write(SYNC_AT, String(serverAt));
        location.reload();
        return;
      }

      /* Nothing to adopt, so this browser is the newer one — or the only one. Push what is here so
         the server has it, then keep it in step from now on. */
      onStorageWrite(function (k) { if (SYNC_KEYS.indexOf(k) >= 0) pushSoon(); });
      if (mine && serverAt < localAt) pushSoon();
      else if (mine && !theirs) pushSoon();       // first ever save for this student

      /* A closing tab gets one last try. `keepalive` is what makes a fetch survive the unload —
         without it the browser cancels it and the last thing they did is lost. */
      window.addEventListener('pagehide', function () {
        if (!syncOn || !ownerOk || !syncHasWork()) return;
        try {
          fetch('/api/state', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin', keepalive: true,
            body: JSON.stringify(pushBody())
          });
        } catch (e) {}
      });
    })
    .catch(function () { /* no server copy today; the app is unaffected */ });
}

/* Told to clear the server copy too. Called by "Reset everything", which is a testing control and
   has to actually reset: clearing the browser alone would be undone by the next load adopting the
   server's copy straight back. Returns a promise so the caller can reload after it lands. */
function clearServerState() {
  clearTimeout(pushTimer);                        // do not let a queued push recreate it
  const was = syncOn;
  syncOn = false;                                 // and stop the pagehide handler writing it back
  /* The bookkeeping goes too. Left behind, the timestamp would make the next load think this
     browser held something newer than the server, and the owner stamp would suppress the adopt
     that is supposed to bring a real save back. */
  Storage.remove(SYNC_AT);
  Storage.remove(SYNC_WHO);
  try { sessionStorage.removeItem(ADOPT_FLAG); } catch (e) {}
  if (!was) return Promise.resolve();
  return fetch('/api/state', { method: 'DELETE', credentials: 'same-origin' })
    .then(function () {}).catch(function () {});
}

/* Order matters and is the whole point: the takeover check is synchronous and must finish before
   project.js runs; startSync only kicks off a fetch and settles later. */
takeoverCheck();
startSync();
