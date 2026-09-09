/* router.js — the app's address bar.
 *
 * Until this existed the whole app lived at one URL. Everything worked and nothing could be
 * referred to. Concretely, four things were broken and all four are the same missing idea:
 *
 *   The back button left the app. Not "went back a lesson" — left. A student who pressed it lost
 *   their place entirely, and back is the most-pressed control in a browser.
 *
 *   A reload dropped you at lesson 1. Thirty minutes in, on a school laptop that reloads when it
 *   feels like it, that is the whole session's navigation gone.
 *
 *   No lesson could be linked. An instructor could not send "open this one" to a stuck student,
 *   and a student could not bookmark where they got to.
 *
 *   Nothing could be shared. Not the Store, not the Gallery, not a page of the Docs.
 *
 * Real paths rather than #fragments, because /lesson/what-an-engine-does is a thing you can read
 * out loud to a class and type into a laptop. Lesson ids in course.yaml are already kebab-case, so
 * they ARE the slugs; there is no separate slug table to keep in sync and no way for one to drift.
 * flat[].id is that same id — the one identity a lesson has, and what every progress store keys
 * off. It used to be the lesson's position, which is why several reads here said `f.l.id || f.id`.
 *
 * Server side: one catch-all in server.js sends unknown non-file paths to index.html. It sits after
 * express.static, so real files still win.
 *
 * The app's own navigation functions (selectLesson, showPage) do not know about any of this. They
 * call syncRoute() when they finish and it decides whether the address bar needs to change. That
 * keeps the routing in one file instead of smeared across every caller, and it means a navigation
 * added later is routed without anyone remembering to route it.
 */

/* Set while the router is the one driving. selectLesson and showPage still run normally; they just
   do not push a history entry, because we are here BECAUSE of a history entry. Without this, going
   back pushes a new state and the back button becomes a loop the student cannot escape. */
let routeApplying = false;

/* Nothing may touch the address bar before startRouter has read it.
   ui.js opens the courses view synchronously at boot, long before the course has loaded — and that
   call reaches syncRoute with an empty `flat` and no lesson, which reads as "home" and would push
   "/" straight over the deep link the student actually arrived on. The URL was then gone before the
   router ever looked at it, and every shared link landed on the wrong lesson. */
let routerStarted = false;

const PAGE_ROUTES = ['store', 'gallery', 'leaderboards', 'docs', 'help'];
/* The panels inside a lesson that are worth their own address. `learn` is deliberately absent: it
   is the default, and /…/what-an-engine-does/learn would be a second URL for the same screen. */
const LESSON_VIEWS = ['code', 'game', 'lab', 'zone'];

/* A lesson lives at /<module>/<lesson> — /game-engines/what-an-engine-does.
   The module comes from its NAME, not its course.yaml id: the ids are short internal handles
   ("engines", "phaser") and the names are what the student sees in the outline, so the name is the
   half that makes a pasted link read as a place in the course. Lesson ids are already kebab-case,
   so they are the slug and there is no second table to drift out of sync. */
function slug(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function moduleSlug(mi) {
  const m = (typeof course !== 'undefined' && course.modules) ? course.modules[mi] : null;
  return m ? slug(m.name) : '';
}

/* What the address bar currently says, as something the app can act on. */
function readRoute() {
  const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const head = (parts[0] || '').toLowerCase();
  if (!head) return { kind: 'home' };
  if (PAGE_ROUTES.indexOf(head) >= 0) return { kind: 'page', page: head };
  /* Two segments is a lesson. The first is read for clarity, not for lookup — the lesson id alone
     identifies it, so a link whose module half is stale (a lesson moved between modules, which the
     course reorder will do) still opens the right lesson and gets its address corrected. `lesson`
     is accepted as the first segment too, because that is what the URLs were before this. */
  /* A third segment is which panel of the lesson you are looking at:
       /game-engines/what-an-engine-does        the lesson
       /game-engines/what-an-engine-does/code   their game's source
       /game-engines/what-an-engine-does/game   their game, running
       /game-engines/what-an-engine-does/lab    the lab bench, open
     Learn has no segment because it is where a lesson link should land. */
  if (parts[1]) {
    const view = (parts[2] || '').toLowerCase();
    return { kind: 'lesson', id: decodeURIComponent(parts[1]), mod: head,
      view: LESSON_VIEWS.indexOf(view) >= 0 ? view : '' };
  }
  return { kind: 'unknown' };
}

/* The path a given app state should live at. */
function routePath(route) {
  if (!route) return '/';
  if (route.kind === 'page') return '/' + route.page;
  if (route.kind === 'lesson') {
    const mod = moduleSlug(route.mi);
    return '/' + (mod || 'lesson') + '/' + encodeURIComponent(route.id)
      + (route.view ? '/' + route.view : '');
  }
  return '/';
}

/* Where the app is right now, read from the app rather than from the URL.
   Which panel is actually on screen decides, not which top-bar button is lit. selectLesson shows
   the editor without touching that highlight, so a lesson opened from the outline while the Store
   was up left the button lit and the URL stuck on /store. #page carries `hidden` either way, so it
   is the honest answer to "is a full page open". */
function currentRoute() {
  const pagePanel = document.getElementById('page');
  const pageOpen = pagePanel && !pagePanel.hidden;
  const openPage = document.querySelector('.navitem.on');
  const page = openPage ? openPage.getAttribute('data-page') : 'courses';
  if (pageOpen && page && page !== 'courses') return { kind: 'page', page: page };
  const f = (typeof flat !== 'undefined' && typeof curIdx === 'number') ? flat[curIdx] : null;
  if (!f) return { kind: 'home' };
  /* A full-window overlay wins over the tab underneath it: it is what the student is actually
     looking at, and a link to it should reopen it rather than the tab it covers. A zone and a bench
     cannot both be open — each closes the other — so the order here is only a tie-break. */
  let view = '';
  if (typeof openZoneRef !== 'undefined' && openZoneRef) view = 'zone';
  else if (typeof openLabRef !== 'undefined' && openLabRef) view = 'lab';
  else {
    const tab = document.querySelector('.vtab.on');
    const v = tab ? tab.getAttribute('data-view') : 'learn';
    if (v === 'code') view = 'code';
    else if (v === 'play') view = 'game';          // the tab is `play`, the word students read is Game
  }
  return { kind: 'lesson', id: f.id, mi: f.mi, view: view };
}

/* Called by selectLesson and showPage once they have finished. Pushes only when the address is
   actually out of date, so re-selecting the lesson you are already on does not stack duplicate
   history entries for the back button to chew through. */
function syncRoute() {
  if (routeApplying || !routerStarted) return;
  const path = routePath(currentRoute());
  if (path === location.pathname) return;
  try { history.pushState(null, '', path); } catch (e) {}
  rememberPlace();
}

/* Where the student was, for the case the URL cannot answer: they typed the bare origin, or opened
   a bookmark of "/". Kept in the existing progress record — loadState merges DEFAULT_STATE first,
   so an older save just gains the key. */
function rememberPlace() {
  if (typeof state !== 'object' || !state) return;
  const r = currentRoute();
  state.at = (r.kind === 'lesson') ? r.id : '';
  if (typeof saveState === 'function') saveState();
}

function lessonIndexById(id) {
  if (typeof flat === 'undefined' || !id) return -1;
  return flat.findIndex(function (f) { return f.id === id; });
}

/* Put the app where the URL says. Never pushes — this runs because the URL already changed. */
function applyRoute(route) {
  routeApplying = true;
  try {
    if (route.kind === 'page') { showPage(route.page); return; }

    /* Everything below is the courses view. Show it first: arriving at a lesson link from the
       Store must leave the Store, and showPage is what does that. */
    showPage('courses');

    let idx = -1;
    if (route.kind === 'lesson') {
      idx = lessonIndexById(route.id);
      if (idx < 0) toast('There is no lesson with that name — starting you where you left off.');
      else if (typeof lessonUnlocked === 'function' && !lessonUnlocked(idx)) {
        toast('That lesson is still locked. Finish the one before it first.');
        idx = -1;
      }
    }
    if (idx < 0) idx = resumeIndex();
    selectLesson(idx);

    /* Then the panel within it. The lab has to wait for the lesson's widgets to exist — selectLesson
       fetches and renders the body, and the lab it is being asked to open is built from that. */
    const want = route.view || '';
    if (want === 'code' || want === 'game') {
      if (typeof switchView === 'function') switchView(want === 'game' ? 'play' : 'code');
    } else if (want === 'lab') {
      openLabFromRoute();
    } else if (want === 'zone') {
      openZoneFromRoute();
    }
  } finally {
    routeApplying = false;
  }
}

/* Open this lesson's lab from a URL.
   The lab is built from the lesson body, which selectLesson fetches and renders — and its widgets
   are built lazily as the student scrolls, so the launcher card may not exist for a moment yet.
   Rather than guess a delay, this waits for the card to appear and gives up after a second. */
function openLabFromRoute() {
  let tries = 0;
  const tick = function () {
    if (typeof labRegistry === 'undefined') return;
    const lab = labRegistry[0];
    if (lab) { openLab(lab); return; }
    if (++tries > 20) return;              // ~1s; the lesson simply has no lab
    setTimeout(tick, 50);
  };
  tick();
}

/* Open this checkpoint's building zone from a URL. Same shape as openLabFromRoute and for the same
   reason: selectLesson fetches and renders the body, and the zone is built out of that body. */
function openZoneFromRoute() {
  let tries = 0;
  const tick = function () {
    if (typeof zoneRegistry === 'undefined') return;
    const z = zoneRegistry[0];
    if (z) { if (!openZoneRef) openZone(z); return; }
    if (++tries > 20) return;              // ~1s; this lesson simply has no zone
    setTimeout(tick, 50);
  };
  tick();
}

/* The best lesson to open when the URL does not name one: where they were last, else the furthest
   they have unlocked, else the first. Never a locked lesson, and never lesson 1 for a student who
   was half way through the course — which is what the app did before. */
function resumeIndex() {
  const saved = (typeof state === 'object' && state && state.at) ? lessonIndexById(state.at) : -1;
  if (saved >= 0 && (typeof lessonUnlocked !== 'function' || lessonUnlocked(saved))) return saved;
  if (typeof flat === 'undefined' || typeof lessonUnlocked !== 'function') return 0;
  /* Where they are UP TO — the first lesson they have not finished. NOT the furthest one that
     happens to be unlocked.

     Those are the same number for a student working through the course in order, which is why the
     old version looked right. They come apart the moment unlocking is forced: DEV.unlockAll opens
     every lesson for authoring, so "the last index where lessonUnlocked() is true" became the last
     lesson in the COURSE, and anyone arriving without a saved place landed on Ship It in Asset
     Design instead of lesson one.

     Reading progress directly is also the more honest question. Unlock state is a permission; done
     state is where the student got to, and that is what "resume" means. */
  const done = (typeof state === 'object' && state && state.done) || {};
  for (let i = 0; i < flat.length; i++) {
    if (!done[flat[i].id] && lessonUnlocked(i)) return i;
  }
  /* Every lesson finished: leave them at the end rather than sending them back to the beginning. */
  return flat.length ? flat.length - 1 : 0;
}

/* Back and forward. The browser has already changed location by the time this fires, so all we do
   is make the app agree with it. */
window.addEventListener('popstate', function () {
  const r = readRoute();
  applyRoute(r.kind === 'unknown' ? { kind: 'home' } : r);
});

/* Boot. Replaces rather than pushes, so the first entry in the student's history is where they
   actually landed and one back press leaves cleanly instead of bouncing off a redirect. */
function startRouter() {
  const r = readRoute();          // read FIRST, before anything is allowed to write
  routerStarted = true;
  applyRoute(r.kind === 'unknown' ? { kind: 'home' } : r);
  const path = routePath(currentRoute());
  try { history.replaceState(null, '', path); } catch (e) {}
  rememberPlace();
}
