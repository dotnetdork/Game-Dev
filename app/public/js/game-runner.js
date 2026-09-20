/* game-runner.js — Runs the student's game: injects owned assets, builds the sandboxed iframe document, sizes the 4:3 stage, and drives mute/volume. */

/* ---------- game frame isolation ----------
   Without `sandbox` this frame is same-origin with the app, and a probe confirmed code inside it
   could write the parent's localStorage, read document.cookie, and call parent.completeLesson()
   directly. It runs code written partly by the AI and partly by whatever a student copied off the
   internet, so it gets an opaque origin and talks to the app over postMessage only — which is how
   the audio control already worked.

   WHETHER IT WORKS IS DECIDED AT RUN TIME, NOT WRITTEN DOWN HERE. This comment used to assert it
   was confirmed working in Chrome; js/dev.js asserted the opposite with measurements. See the note
   above startGame for how that is resolved and why guessing was the wrong answer. Measured in the
   Claude browser pane on 20 September: sandboxed run fails with "Phaser is not defined", the retry
   boots, and the student sees no failure at all.

   Longer term the frame should have its own origin (separate port or subdomain) rather than
   relying on the attribute — that's what would let script-src drop 'unsafe-inline', and it is what
   would make the retry above unnecessary. */
function sandboxGame() { return !!DEV.sandboxGame; }

/* Owned Store assets → auto-preloaded into every Phaser scene by key (student just uses the name).

   THREE ways to own something, and every caller needs the same answer: it is free, it was bought on
   its own, or it came inside a bundle that was bought. Characters, enemies and the numbered tile
   sets are bundle-only, so a check that looked at `unlocked[a.id]` alone would preload none of them
   and the student's game would fail to find a key the Store told them they owned.

   Defined here rather than in pages.js because game-runner.js loads earlier: files.js and pages.js
   both call it, and the Store is not open when a game runs. */
function assetOwned(a) {
  return !!(a && (a.free || state.unlocked[a.id] || (a.bundle && state.unlocked[a.bundle])));
}
function ownedAssets() { return (window.STORE_ASSETS || []).filter(assetOwned); }

/* ---------- owning something and loading it are different ----------
   They used to be the same: every owned asset went into the frame and was load.image()d on every
   Run. At 265 assets nobody noticed. The Store now sells a 400-tile set, which made that 400
   requests before create() gets to run — so a project carries an explicit list of what it loads,
   curated in the content browser, and only that list is injected.

   `project.assets === null` means "everything owned", which is what every project saved before this
   existed gets. It is materialised into a real list the first time anything asks, which has to
   happen out here rather than in the v1->v2 migration: that runs before `state` exists. */
function ensureProjectAssets() {
  if (!Array.isArray(project.assets)) {
    project.assets = ownedAssets().map(function (a) { return a.key; });
    saveProject();
  }
  return project.assets;
}
/* The manifest entries for what this project loads. Filtered by ownership as well as membership,
   so a key that is in the list but not owned (a shared project, a catalogue change) is skipped
   rather than 404ing on every Run. */
function projectAssets() {
  const want = {};
  ensureProjectAssets().forEach(function (k) { want[k] = true; });
  return (window.STORE_ASSETS || []).filter(function (a) { return want[a.key] && assetOwned(a); });
}
function inProject(key) { return ensureProjectAssets().indexOf(key) >= 0; }
function addProjectAssets(keys) {
  const list = ensureProjectAssets();
  let added = 0;
  (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
    if (k && list.indexOf(k) < 0) { list.push(k); added++; }
  });
  if (added) saveProject();
  return added;
}
function removeProjectAsset(key) {
  const list = ensureProjectAssets(), i = list.indexOf(key);
  if (i < 0) return false;
  list.splice(i, 1); saveProject();
  return true;
}
function assetInjectScript() {
  // Assets go in by URL, not as inlined base64. The manifest used to carry a data URI for all 265
  // of them — 933 KB downloaded by every student on every load, for the handful they own. The
  // frame is sandboxed, so /assets is cross-origin to it; the server sends those paths CORS-open
  // for exactly this reason. As a bonus the browser now caches each asset instead of re-parsing
  // base64 on every run.
  /* projectAssets(), not ownedAssets(): what the student put in the project, not everything they
     have ever bought. See the note above ensureProjectAssets(). */
  const map = {};
  projectAssets().forEach(function (a) {
    map[a.key] = { type: a.type, url: '/' + a.file };
    if (a.type === 'spritesheet') { map[a.key].fw = a.frameWidth; map[a.key].fh = a.frameHeight; }
  });
  return '<' + 'script>window.LEAGUE_ASSETS=' + JSON.stringify(map) + ';'
    + 'window.preloadAssets=function(scene){var A=window.LEAGUE_ASSETS||{};'
    // The frame is sandboxed, so its origin is opaque and /assets is cross-origin to it. Without
    // this, a WebGL texture built from those images taints the context and the sprite never draws.
    + 'try{scene.load.crossOrigin="anonymous";}catch(e){}'
    + 'try{scene.load.on("loaderror",function(f){console.warn("[league] could not load: "+(f&&f.key));});}catch(e){}'
    + 'for(var k in A){var a=A[k];try{'
    + 'if(a.type==="image"){if(!scene.textures.exists(k))scene.load.image(k,a.url);}'
    // A whole tile set as one sheet. The frame number picks the tile, and frame N is tile N.
    + 'else if(a.type==="spritesheet"){if(!scene.textures.exists(k))scene.load.spritesheet(k,a.url,{frameWidth:a.fw,frameHeight:a.fh});}'
    + 'else if(a.type==="audio"){if(!scene.cache||!scene.cache.audio||!scene.cache.audio.exists(k))scene.load.audio(k,a.url);}'
    + '}catch(e){}}};'
    + 'if(window.__leagueMute===undefined)window.__leagueMute=true;'
    + '(function(){if(!window.Phaser||!Phaser.Game||Phaser.Game.prototype.__audioHook)return;Phaser.Game.prototype.__audioHook=1;'
    // Tell the app the game actually started. It is the only reliable way to know: the frame is
    // sandboxed, so nothing out here can look inside it and check for a canvas.
    + 'var bp=Phaser.Game.prototype.boot;Phaser.Game.prototype.boot=function(){var r=bp.apply(this,arguments);var self=this;window.__leagueGame=self;'
    + 'try{parent.postMessage({__gameboot:true},"*");}catch(e){}'
    + 'function ap(){try{self.sound.mute=window.__leagueMute!==false;var v=(typeof window.__leagueVol==="number")?window.__leagueVol:0.5;if(self.sound.setVolume)self.sound.setVolume(v);else self.sound.volume=v;}catch(e){}}'
    + 'try{self.events.once("ready",ap);}catch(e){}try{ap();}catch(e){}return r;};})();'
    + 'window.addEventListener("message",function(ev){var d=ev&&ev.data&&ev.data.__leagueAudio;if(!d)return;if("mute" in d)window.__leagueMute=!!d.mute;if(typeof d.volume==="number")window.__leagueVol=d.volume;var g=window.__leagueGame;if(g&&g.sound){try{g.sound.mute=window.__leagueMute;if(g.sound.setVolume)g.sound.setVolume(window.__leagueVol);else g.sound.volume=window.__leagueVol;}catch(e){}}});'
    + '<' + '/script>\n';
}
/* An error thrown inside create() or update() dies inside Phaser's own step, which leaves the
   student with a frozen game and an EMPTY console — the worst possible way to fail. Wrapping
   their functions puts the real message in the log instead, once rather than sixty times a
   second, and lets the rest of the frame carry on so the game keeps drawing. This has to be
   injected after the game files (so the functions exist) and before main.js (which hands them
   to Phaser). */
function errorReporterScript() {
  return '<' + 'script>(function(){' +
    'var seen = {};' +
    '["preload","create","update"].forEach(function(name){' +
    '  var fn = window[name];' +
    '  if (typeof fn !== "function") return;' +
    '  window[name] = function(){' +
    '    try { return fn.apply(this, arguments); }' +
    '    catch (e) {' +
    '      var msg = e && e.message ? e.message : String(e);' +
    '      if (!seen[msg]) { seen[msg] = 1; console.error("Your " + name + "() stopped: " + msg); }' +
    '    }' +
    '  };' +
    '});' +
    '})();<' + '/script>\n';
}

/* ---------- the transport ----------
   Whether the game is running is now its own state, not a side effect of which tab is showing.
   switchView() used to call startGame() on arriving at Play and stopGame() on leaving, which meant
   the game could only exist while you were looking at it — so you could never watch a change land
   while editing the code that caused it. */
let gameRunning = false;
function isGameRunning() { return gameRunning; }

/* Play and Stop, plus the idle notice on the stage. One place decides how all three look, so they
   cannot disagree about whether anything is running.
   The buttons are symbols, so the name has to be carried by aria-label and title instead of by
   visible text — and both are set here beside the icon rather than left in the markup, because a
   button drawing ↻ while still announcing "Play" is a worse lie than a wrong picture on its own. */
/* Paused is a third state, distinct from stopped: the game is still there, still holding its score
   and its positions, just not being asked for frames. */
let gamePaused = false;
function pauseGame() {
  if (!gameRunning || gamePaused) return;
  gamePaused = true;
  try { $('gameFrame').contentWindow.postMessage({ __gamectl: 'pause' }, '*'); } catch (e) {}
  paintTransport();
}
function resumeGame() {
  if (!gameRunning || !gamePaused) return;
  gamePaused = false;
  try { $('gameFrame').contentWindow.postMessage({ __gamectl: 'resume' }, '*'); } catch (e) {}
  paintTransport();
}
function paintTransport() {
  const play = $('gamePlay'), stop = $('gameStop'), idle = $('gameIdle');
  const pause = $('gamePause');
  if (pause) { pause.disabled = !gameRunning || gamePaused; }
  if (play) {
    play.classList.toggle('on', gameRunning && !gamePaused);
    /* Three things this button can mean, and it says which: start it, carry on from where you
       froze it, or run it again from the top. */
    const icon = !gameRunning ? 'mdi-play' : (gamePaused ? 'mdi-play' : 'mdi-restart');
    const label = !gameRunning ? 'Play' : (gamePaused ? 'Resume' : 'Restart');
    play.innerHTML = '<span class="mdi ' + icon + '" aria-hidden="true"></span>';
    play.setAttribute('aria-label', label);
    play.title = label === 'Play' ? 'Run your game'
      : (label === 'Resume' ? 'Carry on from where you paused' : 'Run it again from the top');
  }
  if (stop) stop.disabled = !gameRunning;
  // Only ever on the stage, and only when there is genuinely nothing there.
  if (idle) idle.classList.toggle('hidden', gameRunning);
}

/* A game running behind the Learn tab must not still be making noise. Muting rather than pausing:
   Phaser has no pause we control from out here, and postGameAudio already speaks to the frame. */
function syncGameAudio() {
  if (typeof postGameAudio === 'function') postGameAudio();
}

/* ---------- the safety net under the asset list ----------
   Splitting "owned" from "in the project" introduces one new way to be confused: code that names a
   sprite the student really does own, which simply does not load because it was never added. The
   symptom is a missing texture and no error worth reading, and the fix ("press + in the content
   browser") is not something a twelve-year-old will guess.

   So a Run scans their files for owned keys they have not added, adds them, and says so. It is not
   silent — the toast names what happened, which is how they learn the list exists — and it cannot
   add anything they do not own, so it is not a way around the Store.

   Keys built at run time (`'tile_' + n`) cannot be seen this way, which is exactly what a 400-tile
   set invites. That is the case the sheet is for: one key, added when the set is bought. */
function autoAddUsedAssets() {
  if (typeof ownedAssets !== 'function') return;
  const code = codeFileNames().map(function (n) { return project.files[n] || ''; }).join('\n');
  if (!code) return;
  const quoted = {};
  let m; const re = /['"]([A-Za-z0-9_-]{2,60})['"]/g;
  while ((m = re.exec(code))) quoted[m[1]] = true;
  const missing = ownedAssets().filter(function (a) { return quoted[a.key] && !inProject(a.key); });
  if (!missing.length) return;
  addProjectAssets(missing.map(function (a) { return a.key; }));
  if (typeof refreshFiles === 'function') refreshFiles();
  if (typeof toast === 'function') {
    toast(missing.length === 1
      ? 'Your code uses "' + missing[0].key + '", so it was added to the project.'
      : missing.length + ' assets your code uses were added to the project.');
  }
}

/* One CONFIG value, into the running game. Answered by configBridge inside the frame.
   If the frame says it could not apply the change — no CONFIG in this project, or it threw — the
   game is rebuilt so the slider is never a control that silently does nothing. Guarded so a broken
   frame cannot put us in a rebuild loop. */
let configFallbackAt = 0;
window.addEventListener('message', function (e) {
  const d = e && e.data;
  if (!d || !d.__leagueConfigFail) return;
  const now = Date.now();
  if (now - configFallbackAt < 1500) return;
  configFallbackAt = now;
  if (typeof isGameRunning === 'function' && isGameRunning()) startGame();
});
function sendConfigLive(key, value) {
  const gf = $('gameFrame');
  if (!gf || !gf.contentWindow) return;
  try { gf.contentWindow.postMessage({ __leagueConfig: true, key: key, value: value }, '*'); }
  catch (e) { startGame(); }
}

/* The whole game as one self-contained page, built from the browser-side project. No server.
   Factored out of startGame so a second surface can show the same game: a building zone puts a live
   preview next to the student's code, and a preview built any other way would be a second game that
   only resembles theirs. One builder, two frames. */
function gameDoc() {
  autoAddUsedAssets();          // inside the builder, so every caller gets it and none has to remember
  // load order is the file order in the tree; main.js runs last because it starts the engine
  // codeFileNames, not fileNames: design.md is prose, and a <script> full of prose is a syntax
  // error that kills the whole block — which on this page means a black stage and no game.
  const ordered = codeFileNames().filter(function (n) { return n !== 'main.js'; });
  const scripts = ordered.map(function (n) { return '<' + 'script>\n' + (project.files[n] || '') + '\n<' + '/script>'; }).join('\n')
    + '\n' + errorReporterScript()                                  // must sit between the game files and main.js
    + (typeof project.files['main.js'] === 'string' ? '<' + 'script>\n' + project.files['main.js'] + '\n<' + '/script>' : '');
  /* Both of these are built by js/sandbox-shims.js, which the lab uses too — see the note there
     for why they stopped being two copies. The envelope stays here because it is the one part that
     is genuinely the game's own: everything the frame says arrives as `__gamelog`, and
     console-dock.js and the boot watchdog both read that shape. */
  const capture = sandboxConsoleShim({
    post: '{__gamelog:true,level:lvl,text:txt}',
    onError: '{__gamelog:true,level:"error",text:String(msg),file:file,line:line,col:col}'
  });
  const pauseShim = sandboxPauseShim('__gamectl');
  /* ---------- the Inspector's sliders, applied to the running game ----------
     Dragging a slider used to rebuild the whole game: the level was thrown away, the score reset,
     the player teleported back to the start. That makes the one thing this panel is for — "pull
     gravity about and watch what happens" — impossible to actually watch, because what you get is
     a new game that happens to have different gravity.

     So the value is posted in and assigned instead. `CONFIG` is declared `const CONFIG = {...}` at
     the top level of config.js, which makes it a global LEXICAL binding and not a property of
     `window` — so this cannot reach it as `window.CONFIG`. It can reach it by name, because a
     classic top-level script shares that scope, which is why this is its own <script> and not part
     of the asset IIFE. The binding is read inside the callback, long after config.js has run, so
     there is no temporal-dead-zone problem.

     `const` freezes the BINDING, not the object, so assigning a property is allowed and legal.

     Gravity needs a second step. Arcade reads it once, when the game boots, into the physics
     world — so changing CONFIG.gravity alone would update the number the student can see in their
     file and change nothing on screen. Every arcade world is re-synced from CONFIG.gravity after
     any change, rather than special-casing which key moved, so the world can never drift from the
     file it came from.

     Anything the student's own code reads per frame (moveSpeed, jumpPower) takes effect on the very
     next frame. Anything read once at creation time (coinBounce, used when a coin is made) applies
     to the next thing created — which is the honest behaviour and worth them noticing. */
  const configBridge = '<' + 'script>window.addEventListener("message",function(e){'
    + 'var d=e&&e.data||{};if(!d.__leagueConfig)return;var k=d.key;'
    + 'try{'
    + 'if(typeof CONFIG==="undefined"||!CONFIG){parent.postMessage({__leagueConfigFail:true},"*");return;}'
    + 'CONFIG[k]=d.value;'
    + 'var g=window.__leagueGame;'
    + 'if(g&&g.scene&&typeof CONFIG.gravity==="number"){var ss=g.scene.scenes||[];'
    + 'for(var i=0;i<ss.length;i++){var w=ss[i]&&ss[i].physics&&ss[i].physics.world;'
    + 'if(w&&w.gravity)w.gravity.y=CONFIG.gravity;}}'
    + '}catch(err){parent.postMessage({__leagueConfigFail:true},"*");}'
    + '});<' + '/script>\n';
  return '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;height:100%;background:#06101c;overflow:hidden}#game{width:100%;height:100vh}</style></head><body>'
    + '<div id="game"></div>\n'
    + capture + pauseShim + configBridge
    + '<' + 'script src="/vendor/phaser/phaser.min.js"><' + '/script>\n'   // vendored: no CDN, works on filtered networks
    + assetInjectScript()
    + scripts + '\n</body></html>';
}

/* ---------- the sandbox, and why this retries ----------
   Whether `sandbox="allow-scripts"` lets the game run has had two contradictory answers written
   down in this repo for weeks: the header of this file said it was confirmed working in Chrome and
   that only the dev preview pane failed, while js/dev.js recorded it as KNOWN BROKEN with measured
   results ("Phaser is not defined"). Both were written after somebody tested; they cannot both be
   right, and no test in the suite can tell them apart — check-boot.js runs under jsdom, which does
   not execute iframes at all.

   Rather than guess, the app now finds out for itself, once, at the moment it matters. The first
   run of a session is sandboxed. If it produces no boot — which is what the failure looks like,
   because an opaque-origin document that cannot fetch Phaser never starts one — the same document
   is re-run without the attribute and the answer is remembered for the rest of the session.

   This is deliberately not a silent downgrade of an isolation boundary:
     - it happens only after a sandboxed attempt has demonstrably failed, where the alternative is a
       black stage and a child who cannot play the game they just wrote;
     - the unsandboxed frame is exactly what the app has been serving all along whenever
       DEV.sandboxGame was off or `?sandbox=0` was used, so the fallback state is the status quo;
     - it says so in the console, so the answer is observable instead of assumed.
   The real fix is the one both comments already name: give the game frame its own origin, so it has
   a real one rather than an opaque one. Until then this makes the ambiguity harmless. */
let sandboxWorks = null;          // null = not yet known this session
let sandboxRetried = false;       // one retry per run, never a loop
let runSandboxed = false;         // was THIS run sandboxed? see the boot handler

function startGame() { // run the project in the Game tab's iframe
  conClear();                                          // this run starts with a clean log, on screen and in the buffer
  if (typeof noteGameRun === 'function') noteGameRun(); // so the AI can tell "printed nothing" from "never ran"
  sandboxRetried = false;
  runGameDoc(sandboxGame() && sandboxWorks !== false);
}

function runGameDoc(sandboxed) {
  runSandboxed = sandboxed;
  const html = gameDoc();
  fitStage();
  watchGameBoot(sandboxed);
  const gl = $('gameLoading'); if (gl) gl.classList.remove('hidden');
  const gf = $('gameFrame'); gf.onload = function () { const g = $('gameLoading'); if (g) g.classList.add('hidden'); fitStage(); try { gf.contentWindow.focus(); } catch (e) {} if (typeof postGameAudio === 'function') postGameAudio(); };
  // Set per run rather than in the markup, so toggling it takes effect on the next Play.
  if (sandboxed) gf.setAttribute('sandbox', 'allow-scripts'); else gf.removeAttribute('sandbox');
  gf.removeAttribute('src'); gf.srcdoc = html;
  gameRunning = true; gamePaused = false;
  paintTransport();
  /* The Inspector's sliders mean something different while a game is running — see liveTuning() in
     js/files.js. The note under them has to say which. */
  if (typeof paintSettingsNote === 'function') paintSettingsNote();
}

/* The sandboxed attempt did not start. Try once more without it before telling a child their game
   is broken, because on this path it is not their game that is broken. */
function retryWithoutSandbox() {
  if (sandboxRetried || sandboxWorks === false) return false;
  sandboxRetried = true;
  sandboxWorks = false;
  /* THE ABANDONED ATTEMPT MUST NOT LEAVE ITS ERROR IN THEIR CONSOLE.
     The sandboxed run fails with "Uncaught ReferenceError: Phaser is not defined" — the library
     could not be fetched into an opaque-origin frame — and that line was staying on screen after
     the retry succeeded. So a child whose game was running fine still saw a red error naming
     something they have never typed, in the panel they are taught to read when their game breaks.
     It is not their error and it is not even an error any more: the app tried something, it did not
     work, and it did the other thing. Clearing it is the honest state.
     conClear() also empties the buffer the AI is given, which is right for the same reason — a
     tutor asked "why is my game broken" should not be reasoning about an attempt we threw away. */
  /* Deferred by a tick, because this runs from a `message` handler and console-dock.js has its OWN
     handler for the same message — registered later, so it writes the error line AFTER this
     function returns. Clearing synchronously cleared an empty console and the error appeared a
     moment later anyway. One macrotask is long after every listener for this message and still far
     shorter than the new frame takes to load and print anything of its own. */
  if (typeof conClear === 'function') setTimeout(conClear, 0);
  console.warn('[league] the game did not start in a sandboxed frame — re-running it unsandboxed. '
    + 'See the note above startGame in js/game-runner.js.');
  if (typeof logEvent === 'function') logEvent('sandbox', { result: 'failed', action: 'retried-unsandboxed' });
  runGameDoc(false);
  return true;
}
function stopGame() {
  clearBootWatch(); showGameFailed(false);
  const f = $('gameFrame'); if (f) { f.removeAttribute('srcdoc'); f.removeAttribute('src'); }
  gameRunning = false; gamePaused = false;
  paintTransport();
  /* Anything tuned while it was running was never written to the file, so stopping puts the sliders
     back to what the file says — which is also what the next run will use. resetLiveTuning repaints
     the panel; paintSettingsNote covers the case where nothing was dragged and only the note needs
     to change. */
  if (typeof resetLiveTuning === 'function') resetLiveTuning();
  if (typeof paintSettingsNote === 'function') paintSettingsNote();
}

/* ---------- did the game actually start? ----------
   A mistake INSIDE create() or update() is handled well: errorReporterScript catches it, the log
   says "Your create() stopped: ..." and the game keeps drawing. A SYNTAX error is different in kind.
   The browser abandons that whole <script> block before running a line of it, so CONFIG or a
   function the rest of the game needs simply never exists, Phaser never starts, and the stage is a
   black rectangle. The log does say why — but the stage, which is where the student is looking,
   says nothing at all.
   So: the game announces itself when Phaser boots (see assetInjectScript). No announcement means it
   never ran, and the stage says so in words instead of going dark. */
let gameBooted = false, bootWatch = null;
function clearBootWatch() { if (bootWatch) { clearTimeout(bootWatch); bootWatch = null; } }
function showGameFailed(on, detail) {
  const el = $('gameFailed'); if (!el) return;
  el.classList.toggle('hidden', !on);
  if (!on) return;
  /* A game that never started is the single worst moment in this app for a child — a black stage,
     nothing to press, and a typo somewhere in a file they cannot see. `detail` distinguishes the
     two ways it happens: an error we caught, or four seconds of silence with no boot at all. */
  if (typeof emit === 'function' && typeof EV !== 'undefined') {
    emit(EV.GAME_FAILED, { detail: String(detail || '').slice(0, 200), reason: detail ? 'error' : 'no-boot' });
  }
  const d = el.querySelector('.gf-detail');
  if (d) { d.textContent = detail || ''; d.hidden = !detail; }
}
function watchGameBoot(sandboxed) {
  clearBootWatch();
  gameBooted = false;
  showGameFailed(false);
  /* Generous, because a big pile of Store assets on a school connection is slow and a game that is
     merely late is not a game that is broken. A boot arriving after this clears the message again,
     so being wrong here corrects itself. */
  bootWatch = setTimeout(function () {
    bootWatch = null;
    if (gameBooted) return;
    if (sandboxed && retryWithoutSandbox()) return;    // not their bug; try the other way first
    showGameFailed(true);
  }, 4000);
}
/* The signature of the sandbox failing rather than the student's code failing. "Phaser is not
   defined" means the vendored library never loaded, which a syntax error in their own file cannot
   cause — their scripts come after Phaser's tag. */
const SANDBOX_FAILURE = /Phaser is not defined/i;
window.addEventListener('message', function (e) {
  const d = e && e.data; if (!d) return;
  /* Only a SANDBOXED run that booted proves the sandbox works. Crediting the unsandboxed retry with
     the answer would mean starting every subsequent run sandboxed, failing, and paying the retry
     again — a wasted round trip on every press of Play. */
  if (d.__gameboot) {
    gameBooted = true; clearBootWatch();
    if (runSandboxed) sandboxWorks = true;
    showGameFailed(false);
    return;
  }
  /* An error before the game has booted is the syntax-error case, and there is no point waiting out
     the timer when the browser has already told us what is wrong. Quote it on the stage: the log is
     open by now (console-dock opens it on any game error), but the stage is where they are looking. */
  if (d.__gamelog && d.level === 'error' && !gameBooted) {
    if (SANDBOX_FAILURE.test(String(d.text || '')) && retryWithoutSandbox()) return;
    if ($('view-play') && !$('view-play').hidden) showGameFailed(true, String(d.text || '').slice(0, 200));
  }
});
/* Sizing the stage is CSS's job now (see .stage / .stage-frame in styles.css): the frame is the
   largest 4:3 box that fits its container, worked out by the browser whenever anything changes
   size. This used to be measured by hand after a requestAnimationFrame from three separate
   places, and it lost — collapsing the console grew the box from 387px to 591px while the game
   stayed 516x387, leaving a dead gap, and opening it again pushed the game over the log.

   fitStage stays as a no-op because several call sites still ask for it, and clearing any inline
   sizing left over from an older session is the one useful thing left to do. */
function fitStage() {
  const st = $('gameStage'); if (!st) return;
  const fr = st.querySelector('.stage-frame'); if (!fr) return;
  if (fr.style.width || fr.style.height) { fr.style.width = ''; fr.style.height = ''; }
}

/* ---------- game audio: mute defaults ON; controls live in the Play viewport ---------- */
let gameMuted = (Storage.read('leagueMuted') !== 'false');
let gameVolume = parseFloat(Storage.read('leagueVol') || '0.5'); if (isNaN(gameVolume)) gameVolume = 0.5;
/* Muted whenever the stage is not on screen, whatever the student's own mute setting says. The game
   outliving the Play tab is the point of the transport; the game being *audible* from behind a
   lesson is not, and in a room of twenty-five it is the difference between a feature and a problem.
   The student's setting is untouched — this only ever adds mute, never clears it. */
/* Nothing is running at boot, so paint that once rather than trusting the markup to agree. */
paintTransport();
function gameOffScreen() { const v = $('view-play'); return !!v && v.hidden; }
function postGameAudio() {
  const f = $('gameFrame'); if (!f || !f.contentWindow) return;
  const mute = gameMuted || gameOffScreen();
  try { f.contentWindow.postMessage({ __leagueAudio: { mute: mute, volume: gameVolume } }, '*'); } catch (e) {}
}
function updateAudioUI() { const b = $('muteBtn'), s = $('volSlider'); if (!b) return;
  b.innerHTML = '<span class="mdi ' + (gameMuted ? 'mdi-volume-off' : 'mdi-volume-high') + '"></span>';
  b.title = gameMuted ? 'Sound is off — click to turn it on' : 'Sound is on — click to mute';
  b.classList.toggle('on', !gameMuted); if (s) { s.value = Math.round(gameVolume * 100); s.disabled = gameMuted; } }
if ($('muteBtn')) $('muteBtn').addEventListener('click', function () { gameMuted = !gameMuted; Storage.write('leagueMuted', gameMuted ? 'true' : 'false'); updateAudioUI(); postGameAudio(); });
if ($('volSlider')) $('volSlider').addEventListener('input', function () { gameVolume = (+this.value) / 100; if (gameMuted) { gameMuted = false; Storage.write('leagueMuted', 'false'); } Storage.write('leagueVol', String(gameVolume)); updateAudioUI(); postGameAudio(); });
updateAudioUI();

