/* game-runner.js — Runs the student's game: injects owned assets, builds the sandboxed iframe document, sizes the 4:3 stage, and drives mute/volume. */
/* Owned Store assets → auto-preloaded into every Phaser scene by key (student just uses the name). */
function ownedAssets() { const A = window.STORE_ASSETS || []; return A.filter(function (a) { return a.free || !!state.unlocked[a.id]; }); }
function assetInjectScript() {
  // Assets go in by URL, not as inlined base64. The manifest used to carry a data URI for all 265
  // of them — 933 KB downloaded by every student on every load, for the handful they own. The
  // iframe is srcdoc with no sandbox attribute, so it shares this page's origin and can fetch
  // /assets/* directly, exactly as it already fetches /vendor/phaser/phaser.min.js below. As a
  // bonus the browser now caches each asset instead of re-parsing base64 on every run.
  const map = {}; ownedAssets().forEach(function (a) { map[a.key] = { type: a.type, url: '/' + a.file }; });
  return '<' + 'script>window.LEAGUE_ASSETS=' + JSON.stringify(map) + ';'
    + 'window.preloadAssets=function(scene){var A=window.LEAGUE_ASSETS||{};'
    + 'try{scene.load.on("loaderror",function(f){console.warn("[league] could not load: "+(f&&f.key));});}catch(e){}'
    + 'for(var k in A){var a=A[k];try{'
    + 'if(a.type==="image"){if(!scene.textures.exists(k))scene.load.image(k,a.url);}'
    + 'else if(a.type==="audio"){if(!scene.cache||!scene.cache.audio||!scene.cache.audio.exists(k))scene.load.audio(k,a.url);}'
    + '}catch(e){}}};'
    + 'if(window.__leagueMute===undefined)window.__leagueMute=true;'
    + '(function(){if(!window.Phaser||!Phaser.Game||Phaser.Game.prototype.__audioHook)return;Phaser.Game.prototype.__audioHook=1;'
    + 'var bp=Phaser.Game.prototype.boot;Phaser.Game.prototype.boot=function(){var r=bp.apply(this,arguments);var self=this;window.__leagueGame=self;'
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

function startGame() { // build a self-contained page from the browser-side project and run it in the iframe (no server)
  conClear();
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
  const gl = $('gameLoading'); if (gl) gl.classList.remove('hidden');
  const gf = $('gameFrame'); gf.onload = function () { const g = $('gameLoading'); if (g) g.classList.add('hidden'); fitStage(); try { gf.contentWindow.focus(); } catch (e) {} if (typeof postGameAudio === 'function') postGameAudio(); };
  gf.removeAttribute('src'); gf.srcdoc = html;
}
function stopGame() { const f = $('gameFrame'); if (f) { f.removeAttribute('srcdoc'); f.removeAttribute('src'); } }
function fitStage() {  // size the game frame to the largest true 4:3 box that fits the stage
  const st = $('gameStage'); if (!st) return; const fr = st.querySelector('.stage-frame'); if (!fr) return;
  const w = st.clientWidth, h = st.clientHeight; if (!w || !h) return;
  let fw = w, fh = w * 3 / 4; if (fh > h) { fh = h; fw = h * 4 / 3; }
  fr.style.width = Math.floor(fw) + 'px'; fr.style.height = Math.floor(fh) + 'px';
}
window.addEventListener('resize', function () { const v = $('view-play'); if (v && !v.hidden) fitStage(); });

/* ---------- game audio: mute defaults ON; controls live in the Play viewport ---------- */
let gameMuted = (localStorage.getItem('leagueMuted') !== 'false');
let gameVolume = parseFloat(localStorage.getItem('leagueVol') || '0.5'); if (isNaN(gameVolume)) gameVolume = 0.5;
function postGameAudio() { const f = $('gameFrame'); if (f && f.contentWindow) { try { f.contentWindow.postMessage({ __leagueAudio: { mute: gameMuted, volume: gameVolume } }, '*'); } catch (e) {} } }
function updateAudioUI() { const b = $('muteBtn'), s = $('volSlider'); if (!b) return;
  b.innerHTML = '<span class="mdi ' + (gameMuted ? 'mdi-volume-off' : 'mdi-volume-high') + '"></span>';
  b.title = gameMuted ? 'Sound is off — click to turn it on' : 'Sound is on — click to mute';
  b.classList.toggle('on', !gameMuted); if (s) { s.value = Math.round(gameVolume * 100); s.disabled = gameMuted; } }
if ($('muteBtn')) $('muteBtn').addEventListener('click', function () { gameMuted = !gameMuted; localStorage.setItem('leagueMuted', gameMuted ? 'true' : 'false'); updateAudioUI(); postGameAudio(); });
if ($('volSlider')) $('volSlider').addEventListener('input', function () { gameVolume = (+this.value) / 100; if (gameMuted) { gameMuted = false; localStorage.setItem('leagueMuted', 'false'); } localStorage.setItem('leagueVol', String(gameVolume)); updateAudioUI(); postGameAudio(); });
updateAudioUI();

