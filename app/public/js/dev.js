/* dev.js — switches for working ON the app, not for using it.
 *
 * One place for all of them. They were starting to scatter (the game-frame sandbox already had
 * its own), and a debug switch you have to go hunting for is a debug switch nobody uses.
 *
 * Three ways to set each one, in order of precedence:
 *   1. the URL, for a one-off:            ?unlock=1        ?sandbox=0
 *   2. the console, to make it stick:     DEV.set('unlockAll', true)
 *   3. the defaults below, to change it for everyone
 *
 * Anything switched on shows a marker in the status bar. A hidden mode that changes how the app
 * behaves is how you spend an afternoon debugging a problem you turned on yourself.
 */
const DEV_DEFAULTS = {
  /* Every lesson clickable, in any order, without finishing the one before. For authoring and
     testing — a course you have to play through to proof-read is a course nobody proof-reads.

     ON while we are building. It MUST go back to false before any student uses this, or the
     course has no sequence at all. The status bar says "Dev: unlockAll" the whole time it is on,
     which is the reminder. */
  unlockAll: true,

  /* The game frame runs with an opaque origin so student code cannot reach the app. Off only to
     rule it out if assets ever mysteriously fail to load. */
  sandboxGame: true
};

/* What each switch MUST be before a real student uses the app. The status-bar marker is driven by
   this, not by whether a value differs from its default — the moment `unlockAll` became the default
   for development, "differs from default" said nothing was on and the marker disappeared, which is
   exactly when it was most needed. This is a statement about safety, so flipping a default can
   never silence it. */
const DEV_SAFE = { unlockAll: false, sandboxGame: true };

const DEV_URL_KEYS = { unlock: 'unlockAll', sandbox: 'sandboxGame' };
const DEV_STORE_KEY = 'leagueDev';

function devTruthy(v) { return v !== '0' && v !== 'false' && v !== false; }

const DEV = (function () {
  const saved = (function () {
    try { return JSON.parse(Storage.read(DEV_STORE_KEY) || '{}') || {}; } catch (e) { return {}; }
  })();
  const cfg = Object.assign({}, DEV_DEFAULTS, saved);
  try {
    const q = new URLSearchParams(location.search);
    Object.keys(DEV_URL_KEYS).forEach(function (k) {
      const v = q.get(k);
      if (v !== null) cfg[DEV_URL_KEYS[k]] = devTruthy(v);
    });
  } catch (e) { /* a malformed URL must not stop the app starting */ }

  cfg.set = function (name, value) {
    if (!(name in DEV_DEFAULTS)) { console.warn('[dev] no such switch: ' + name); return; }
    cfg[name] = !!value;
    const keep = {};
    Object.keys(DEV_DEFAULTS).forEach(function (k) { if (cfg[k] !== DEV_DEFAULTS[k]) keep[k] = cfg[k]; });
    Storage.write(DEV_STORE_KEY, JSON.stringify(keep));
    console.log('[dev] ' + name + ' = ' + cfg[name] + ' (reload to apply everywhere)');
    if (typeof renderDevBadge === 'function') renderDevBadge();
    return cfg[name];
  };
  cfg.reset = function () { Storage.remove(DEV_STORE_KEY); console.log('[dev] back to defaults — reload'); };
  /* Everything currently set to something a student should never see. */
  cfg.active = function () {
    return Object.keys(DEV_SAFE).filter(function (k) { return cfg[k] !== DEV_SAFE[k]; });
  };
  return cfg;
})();

/* Says so, in the status bar, whenever anything is off-default. */
function renderDevBadge() {
  const bar = document.querySelector('.statusbar'); if (!bar) return;
  let el = document.getElementById('devBadge');
  const on = DEV.active();
  if (!on.length) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('span'); el.id = 'devBadge'; el.className = 'dev-badge';
    bar.insertBefore(el, bar.querySelector('.sb-mid'));
  }
  el.innerHTML = '<span class="mdi mdi-wrench-outline" aria-hidden="true"></span>Dev: ' + on.join(', ');
  el.title = 'Developer switches are on. DEV.reset() in the console puts them back.';
}
