/* game-runner.js — Runs the student's game: injects owned assets, builds the sandboxed iframe document, sizes the 4:3 stage, and drives mute/volume. */

/* ---------- game frame isolation ----------
   Without `sandbox` this frame is same-origin with the app, and a probe confirmed code inside it
   could write the parent's localStorage, read document.cookie, and call parent.completeLesson()
   directly. It runs code written partly by the AI and partly by whatever a student copied off the
   internet, so it gets an opaque origin and talks to the app over postMessage only — which is how
   the audio control already worked.

   Confirmed working in Chrome: the game runs normally with the frame isolated. (The dev preview
   pane cannot load ANY subresource into an opaque-origin frame — script, stylesheet or image —
   which is a fault in that pane, not in the browser. `?sandbox=0` stays as a one-reload way to
   rule this out if assets ever go missing somewhere new.)

   Longer term the frame should have its own origin (separate port or subdomain) rather than
   relying on the attribute — that's what would let script-src drop 'unsafe-inline'. */
function sandboxGame() { return !!DEV.sandboxGame; }

/* Owned Store assets → auto-preloaded into every Phaser scene by key (student just uses the name). */
function ownedAssets() { const A = window.STORE_ASSETS || []; return A.filter(function (a) { return a.free || !!state.unlocked[a.id]; }); }
function assetInjectScript() {
  // Assets go in by URL, not as inlined base64. The manifest used to carry a data URI for all 265
  // of them — 933 KB downloaded by every student on every load, for the handful they own. The
  // frame is sandboxed, so /assets is cross-origin to it; the server sends those paths CORS-open
  // for exactly this reason. As a bonus the browser now caches each asset instead of re-parsing
  // base64 on every run.
  const map = {}; ownedAssets().forEach(function (a) { map[a.key] = { type: a.type, url: '/' + a.file }; });
  return '<' + 'script>window.LEAGUE_ASSETS=' + JSON.stringify(map) + ';'
    + 'window.preloadAssets=function(scene){var A=window.LEAGUE_ASSETS||{};'
    // The frame is sandboxed, so its origin is opaque and /assets is cross-origin to it. Without
    // this, a WebGL texture built from those images taints the context and the sprite never draws.
    + 'try{scene.load.crossOrigin="anonymous";}catch(e){}'
    + 'try{scene.load.on("loaderror",function(f){console.warn("[league] could not load: "+(f&&f.key));});}catch(e){}'
    + 'for(var k in A){var a=A[k];try{'
    + 'if(a.type==="image"){if(!scene.textures.exists(k))scene.load.image(k,a.url);}'
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
   cannot disagree about whether anything is running. */
function paintTransport() {
  const play = $('gamePlay'), stop = $('gameStop'), idle = $('gameIdle');
  if (play) {
    play.classList.toggle('on', gameRunning);
    play.innerHTML = '<span class="mdi ' + (gameRunning ? 'mdi-restart' : 'mdi-play') + '" aria-hidden="true"></span>'
      + (gameRunning ? 'Restart' : 'Play');
    play.title = gameRunning ? 'Start it again from the top (Ctrl+Enter)' : 'Run your game (Ctrl+Enter)';
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

function startGame() { // build a self-contained page from the browser-side project and run it in the iframe (no server)
  conClear();                                          // this run starts with a clean log, on screen and in the buffer
  if (typeof noteGameRun === 'function') noteGameRun(); // so the AI can tell "printed nothing" from "never ran"
  // load order is the file order in the tree; main.js runs last because it starts the engine
  const ordered = fileNames().filter(function (n) { return n !== 'main.js'; });
  const scripts = ordered.map(function (n) { return '<' + 'script>\n' + (project.files[n] || '') + '\n<' + '/script>'; }).join('\n')
    + '\n' + errorReporterScript()                                  // must sit between the game files and main.js
    + (typeof project.files['main.js'] === 'string' ? '<' + 'script>\n' + project.files['main.js'] + '\n<' + '/script>' : '');
  const capture = '<' + 'script>(function(){function f(a){a=[].slice.call(a);if(typeof a[0]==="string"&&/%[csdfoO]/.test(a[0])){var i=1;var o=a[0].replace(/%[csdfoO]/g,function(m){if(m==="%c"){i++;return "";}return String(a[i++]);});return (o+" "+a.slice(i).join(" ")).replace(/\\s+/g," ").trim();}return a.map(String).join(" ");}function s(l,a){try{parent.postMessage({__gamelog:true,level:l,text:f(a)},"*");}catch(e){}}var c=console,lg=c.log.bind(c);c.log=function(){lg.apply(c,arguments);s("log",arguments);};var wn=c.warn.bind(c);c.warn=function(){wn.apply(c,arguments);s("warn",arguments);};var er=c.error.bind(c);c.error=function(){er.apply(c,arguments);s("error",arguments);};window.onerror=function(m){s("error",[m]);return false;};})();<' + '/script>\n';
  const html = '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;height:100%;background:#06101c;overflow:hidden}#game{width:100%;height:100vh}</style></head><body>'
    + '<div id="game"></div>\n'
    + capture
    + '<' + 'script src="/vendor/phaser/phaser.min.js"><' + '/script>\n'   // vendored: no CDN, works on filtered networks
    + assetInjectScript()
    + scripts + '\n</body></html>';
  fitStage();
  watchGameBoot();
  const gl = $('gameLoading'); if (gl) gl.classList.remove('hidden');
  const gf = $('gameFrame'); gf.onload = function () { const g = $('gameLoading'); if (g) g.classList.add('hidden'); fitStage(); try { gf.contentWindow.focus(); } catch (e) {} if (typeof postGameAudio === 'function') postGameAudio(); };
  // Set per run rather than in the markup, so toggling it takes effect on the next Play.
  if (sandboxGame()) gf.setAttribute('sandbox', 'allow-scripts'); else gf.removeAttribute('sandbox');
  gf.removeAttribute('src'); gf.srcdoc = html;
  gameRunning = true;
  paintTransport();
}
function stopGame() {
  clearBootWatch(); showGameFailed(false);
  const f = $('gameFrame'); if (f) { f.removeAttribute('srcdoc'); f.removeAttribute('src'); }
  gameRunning = false;
  paintTransport();
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
  const d = el.querySelector('.gf-detail');
  if (d) { d.textContent = detail || ''; d.hidden = !detail; }
}
function watchGameBoot() {
  clearBootWatch();
  gameBooted = false;
  showGameFailed(false);
  /* Generous, because a big pile of Store assets on a school connection is slow and a game that is
     merely late is not a game that is broken. A boot arriving after this clears the message again,
     so being wrong here corrects itself. */
  bootWatch = setTimeout(function () {
    bootWatch = null;
    if (!gameBooted) showGameFailed(true);
  }, 4000);
}
window.addEventListener('message', function (e) {
  const d = e && e.data; if (!d) return;
  if (d.__gameboot) { gameBooted = true; clearBootWatch(); showGameFailed(false); return; }
  /* An error before the game has booted is the syntax-error case, and there is no point waiting out
     the timer when the browser has already told us what is wrong. Quote it on the stage: the log is
     open by now (console-dock opens it on any game error), but the stage is where they are looking. */
  if (d.__gamelog && d.level === 'error' && !gameBooted && $('view-play') && !$('view-play').hidden) {
    showGameFailed(true, String(d.text || '').slice(0, 200));
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

