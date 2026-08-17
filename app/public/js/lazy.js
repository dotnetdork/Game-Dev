/* lazy.js — load a script or stylesheet on demand, once.
 *
 * Vendoring every library locally is right for a filtered school network. Loading all of them on
 * every page load was not: the linter (1.2 MB), the formatter (0.75 MB) and most of the editor
 * addons are only ever used by the Code tab, and a student who opens a lesson and reads it was
 * downloading all of it first.
 *
 * Nothing here is a bundler. Each call appends a tag and resolves when it fires; a URL asked for
 * twice returns the first promise rather than fetching again.
 */
const _pending = {};

function loadOne(url, make) {
  if (_pending[url]) return _pending[url];
  _pending[url] = new Promise(function (resolve, reject) {
    const el = make(url);
    el.onload = function () { resolve(url); };
    el.onerror = function () {
      delete _pending[url];                       // let a retry actually retry
      reject(new Error('could not load ' + url));
    };
    document.head.appendChild(el);
  });
  return _pending[url];
}

function loadStyle(url) {
  return loadOne(url, function (u) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u; return l;
  });
}

/* Scripts load IN ORDER, one after the next. These are old-style globals that assume their
   dependencies already exist — javascript-lint.js reads JSHINT, and every CodeMirror addon reads
   CodeMirror — so loading them in parallel is a race that usually works and sometimes doesn't.
   Sometimes is worse than never. */
function loadScripts(urls) {
  return urls.reduce(function (chain, url) {
    return chain.then(function () {
      return loadOne(url, function (u) {
        const s = document.createElement('script'); s.src = u; s.async = false; return s;
      });
    });
  }, Promise.resolve());
}

/* ---------- the Code tab's toolkit ----------
   Everything the editor wants that a lesson does not. The Learn tab's run cells and challenges
   use CodeMirror too, so the core, the JavaScript mode and the two bracket addons stay eager in
   index.html; only this half waits. */
const CODE_TOOLS_STYLES = [
  'vendor/codemirror/addon/hint/show-hint.css',
  'vendor/codemirror/addon/lint/lint.css',
  'vendor/codemirror/addon/fold/foldgutter.css',
  'vendor/codemirror/addon/dialog/dialog.css'
];
const CODE_TOOLS_SCRIPTS = [
  'vendor/codemirror/addon/selection/active-line.js',
  'vendor/codemirror/addon/comment/comment.js',
  'vendor/codemirror/addon/hint/show-hint.js',
  'vendor/codemirror/addon/hint/anyword-hint.js',
  'vendor/codemirror/addon/hint/javascript-hint.js',
  'vendor/codemirror/addon/fold/foldcode.js',
  'vendor/codemirror/addon/fold/foldgutter.js',
  'vendor/codemirror/addon/fold/brace-fold.js',
  'vendor/codemirror/addon/search/searchcursor.js',
  'vendor/codemirror/addon/search/search.js',
  'vendor/codemirror/addon/dialog/dialog.js',
  'vendor/codemirror/addon/search/jump-to-line.js',
  'vendor/jshint/jshint.js',                        // 1.2 MB, the single heaviest file in the app
  'vendor/codemirror/addon/lint/lint.js',
  'vendor/codemirror/addon/lint/javascript-lint.js',
  'vendor/prettier/standalone.js',
  'vendor/prettier/parser-babel.js'
];

let codeToolsPromise = null;
function loadCodeTools() {
  if (!codeToolsPromise) {
    CODE_TOOLS_STYLES.forEach(loadStyle);           // styles can race; they depend on nothing
    codeToolsPromise = loadScripts(CODE_TOOLS_SCRIPTS);
  }
  return codeToolsPromise;
}
