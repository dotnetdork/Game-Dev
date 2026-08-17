/* storage.js — the one place the app talks to saved data.
 *
 * Everything used to call localStorage directly from wherever it happened to be. That works
 * exactly as long as the answer is always "the browser". It stops working the moment a student
 * logs in and their game has to live on the code server instead — at which point every one of
 * those calls is a separate thing to find and change.
 *
 * So: one small interface, and swappable implementations behind it. Today there is one
 * implementation (the browser). Later there is a second (the server) and nothing that CALLS this
 * has to know which one it got.
 *
 * It also handles the two ways browser storage really fails, both of which used to be silent:
 *
 *   Storage switched off. Some school-managed browsers block it outright, and reading it then
 *   throws rather than returning null. The app falls back to memory: the student can work, and
 *   loses it when they close the tab, which is far better than a page that will not load.
 *
 *   Storage full. localStorage is a few megabytes and a project is a handful of files, so this
 *   is unlikely — but when it happens setItem throws, and the old code let that reach nobody.
 *   The student kept working on a game that had silently stopped saving. Now it reports.
 */

/* Detected once, by actually writing — asking `typeof localStorage` is not the same question,
   because a browser can expose the object and still refuse to use it. */
const _localOK = (function () {
  try {
    const k = '__league_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
})();

const _memory = {};   // the fallback store: real for this tab, gone when it closes

/* Called when a write fails. Set by the app so storage does not have to know what a toast is. */
let _onWriteFailure = null;
function onStorageFailure(fn) { _onWriteFailure = fn; }

const Storage = {
  /* True when saves will actually survive a reload. The UI can use this to say so honestly
     rather than promising a student their work is safe when it is not. */
  persistent: _localOK,

  /* _memory is checked first, always. It is not just the fallback for a browser with storage
     switched off — it is also where a value goes when a write FAILS on a browser that normally
     works. Reading straight through to localStorage in that case returns the older value, or
     nothing, and the student watches their last ten minutes of work disappear on the next reload
     while the app happily shows them stale code. Memory is the newer truth; prefer it. */
  read: function (key) {
    if (Object.prototype.hasOwnProperty.call(_memory, key)) return _memory[key];
    if (!_localOK) return null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },

  /* Returns true if the value is safely stored. A false return is a real event the caller may
     want to react to — it means the student's work is only in memory now. */
  write: function (key, value) {
    const v = String(value);
    if (!_localOK) { _memory[key] = v; return false; }
    try {
      localStorage.setItem(key, v);
      delete _memory[key];                  // it is safely on disk; stop shadowing it
      return true;
    }
    catch (e) {
      _memory[key] = v;                     // keep it for this session at least
      // Deliberately NOT removing anything to make room. The only things in here are the
      // student's project and their progress, and quietly deleting one to save the other is a
      // decision no program should make on its own.
      if (_onWriteFailure) { try { _onWriteFailure(key, e); } catch (e2) {} }
      return false;
    }
  },

  remove: function (key) {
    delete _memory[key];
    if (!_localOK) return;
    try { localStorage.removeItem(key); } catch (e) {}
  },

  keys: function () {
    if (!_localOK) return Object.keys(_memory);
    try { return Object.keys(localStorage); } catch (e) { return []; }
  },

  /* JSON in and out, since every caller in the app stores objects. `fallback` is returned when
     the key is missing OR unreadable, so callers do not each re-implement try/catch. */
  readJSON: function (key, fallback) {
    const raw = Storage.read(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  },
  writeJSON: function (key, value) { return Storage.write(key, JSON.stringify(value)); }
};
