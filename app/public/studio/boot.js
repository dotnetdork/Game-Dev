/* boot.js: starts the studio. Loads the kid's project and the course, builds the game frame, and
   hands over to the quest engine.

   The kid's name comes from the sign-in (/auth/me). Until the hiring interview gives every kid a
   handle (docs/rework/v2-spec.md §3.2), a tester's typed name stands in, and a kid with no name is
   "new developer".

   "Always start fresh" (the dev panel's switch, localhost only) throws this browser's copy away on
   every load, so testing never resumes a half-played state by accident. */
(function () {
  function $(id) { return document.getElementById(id); }
  var fresh = false;
  try { fresh = localStorage.getItem('studio.fresh') === '1'; } catch (e) {}
  if (fresh) Project.reset();
  /* The server's copy first (save.js says which copy wins, and why), then everything else. */
  Save.adopt(fresh).then(boot);

  function boot() {
    var st = Project.load();
    Save.start();
    Chat.init();
    Editor.init();

    Runner.on(function (name, text) {
      /* Said plainly on the game, with the detail in the console for whoever is helping. Cleared by the
         next Play, since that is a fresh test run. */
      if (name === 'error') { $('gameStatus').textContent = 'Your game hit an error. Press Stop, then Play to try again.'; console.warn('[game] ' + text); }
      if (name === 'play') $('gameStatus').textContent = '';
    });

    var me = fetch('/auth/me').then(function (r) { return r.json(); }).catch(function () { return {}; });
    var course = fetch('/api/quests', { cache: 'no-cache' }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j.problems || [j.error || r.status]).join('\n'));
        return j;
      });
    });

    me.then(function (m) {
      /* A kid who came in through the class list but hasn't finished the interview goes back to it:
         the studio greets them by the handle the interview gives them. */
      if (m && m.studio) {
        return fetch('/auth/studio/me').then(function (r) { return r.json(); }).then(function (s) {
          if (!s.interviewed) { location.replace('/interview.html'); return new Promise(function () {}); }
          Chat.setKid(s.card && s.card.handle);
          window.__studioKid = true;   // a class-list kid: the quests keep their card up to date (quest.js card())
          return course;
        });
      }
      var n = m && m.signedIn && m.name && m.name !== 'Local developer' ? String(m.name).split(/\s+/)[0] : '';
      Chat.setKid(n);
      return course;
    }).then(function (c) {
      Quest.start(c);
    }).catch(function (e) {
      console.error(e);
      Chat.say([['m', 'The studio couldn’t load today’s work. Tell whoever is running the class.']]);
    });

    Project.code().then(function (code) {
      $('gameStatus').textContent = 'Loading the game…';
      return Runner.mount($('stage'), code, st.parts, UI.muted());
    }).then(function () {
      $('gameStatus').textContent = '';
    }).catch(function (e) {
      console.error(e);
      $('gameStatus').textContent = 'The game didn’t load. Check your connection and reload the page.';
    });
  }
})();
