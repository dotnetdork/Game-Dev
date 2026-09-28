/* save.js: the kid's work on the server, so it's waiting on any Chromebook they sign in on.

   What's kept: the studio project (Project, KEY studio.v2: the game, the quests, the tickets) and
   the interview's learner card (studio.interview). The server stores it as an opaque blob per
   sign-in (store.js; /api/state), keyed on the session, never on anything the browser claims.

   THE RULES, because this is where one kid's work could land on another's:
   - On load, the server's copy wins over this browser's when it's newer, or when the browser's
     copy belongs to somebody else (a shared Chromebook: the last kid's work is thrown away here,
     not shown to the next kid, and it's safe on the server under the last kid's sign-in).
   - Every save says whose work it is (`who`), and the server refuses a save whose owner isn't the
     signed-in kid (server.js, PUT /api/state). A tab signed out and back in as someone else can't
     write the old kid's game into the new kid's account.
   - "Always start fresh" (the dev panel) skips the server copy, so a test starts clean.
   - Saving is debounced (every change would be a request per slider step) and also sent when the
     page is hidden, which is the last moment a Chromebook reliably gives us. */
var Save = (function () {
  var OWNER = 'studio.owner', me = null, timer = null, enabled = false, lastSent = '';

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function blob() {
    var d = { v2: { project: JSON.parse(read(Project.KEY) || 'null'), interview: JSON.parse(read('studio.interview') || 'null'), at: Date.now() } };
    return d;
  }

  /* Before the studio loads anything: make this browser's copy the right one. Resolves either way,
     because a server that is down must never stop a kid playing. */
  function adopt(fresh) {
    return fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
      if (!s || !s.store) return;
      enabled = true; me = s.me || null;
      var owner = read(OWNER);
      if (owner && me && owner !== me) { write(Project.KEY, null); write('studio.interview', null); }   // someone else's work
      write(OWNER, me);
      if (fresh) return;
      var theirs = s.data && s.data.v2, mine = JSON.parse(read(Project.KEY) || 'null');
      var mineAt = Number(read('studio.savedAt') || 0);
      if (theirs && (!mine || (s.at || 0) > mineAt)) {
        if (theirs.project) write(Project.KEY, JSON.stringify(theirs.project));
        if (theirs.interview) write('studio.interview', JSON.stringify(theirs.interview));
        write('studio.savedAt', String(s.at || Date.now()));
      }
    }).catch(function () {});
  }

  function send(beacon) {
    if (!enabled || !me) return;
    var body = JSON.stringify({ who: me, data: blob() });
    if (body === lastSent) return;
    lastSent = body;
    fetch('/api/state', { method: 'PUT', credentials: 'same-origin', keepalive: !!beacon, headers: { 'Content-Type': 'application/json' }, body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.at) write('studio.savedAt', String(j.at)); })
      .catch(function () { lastSent = ''; });   // try again next time
  }
  function soon() { clearTimeout(timer); timer = setTimeout(send, 2000); }

  function start() {
    Project.onSave(soon);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(timer); send(true); } });
  }

  return { adopt: adopt, start: start, now: send };
})();
