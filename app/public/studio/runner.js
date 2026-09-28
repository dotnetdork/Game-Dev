/* runner.js: runs the kid's game in the Game view, and owns Play mode.

   THE FRAME. The game is built into one self-contained document (srcdoc) and run in an iframe
   with sandbox="allow-scripts" and no allow-same-origin: code written partly by the AI runs with
   an opaque origin and can reach the studio only by postMessage. The old app's frame fetched
   Phaser with a <script src>, which fails from an opaque origin ("Phaser is not defined"), so it
   retried without the sandbox (app/public/js/game-runner.js:3). Here Phaser is fetched ONCE by the
   studio and inlined into the document, so the sandboxed frame needs no script fetch at all. The
   art and sounds are still fetched by the frame; /assets is served CORS-open for exactly this
   (server.js, the static hosting note), and the game asks for them with crossOrigin 'anonymous'.

   ONE FRAME, TWO MODES. The frame is built once per version of the code. Stopped, the same game
   shows the level frozen (physics paused), so the Game view is never a blank box. Play and Stop
   restart the scene with the parts posted in, which is fast and keeps the page from flashing.
   Only a change to the CODE rebuilds the frame.

   PLAY MODE, UNITY'S RULE. What the kid changes while the game runs is applied to the running game
   at once, and undone on Stop: Play takes a snapshot of the parts, Stop puts it back. It is the
   classic beginner's mistake, kept on purpose because every engine does it (Jay, 2026-09-28), and
   the first day has the kid make it safely. Changes made while stopped are kept.

   What the game tells the studio arrives as events ('coin', 'fell', 'lava', 'hurt', 'crossed'),
   passed to whoever is listening (the first day's steps). The same event is passed on at most
   once every 600ms: the game notices "standing on the tile" every frame. */
var Runner = (function () {
  var frame = null, phaser = null, builtFor = null, ready = false, pending = null;
  var playing = false, snapshot = null, changedInPlay = false;
  var listeners = [], lastEvent = {};

  function on(fn) { listeners.push(fn); }
  function emit(name, detail) { listeners.forEach(function (fn) { try { fn(name, detail); } catch (e) { console.error(e); } }); }

  function phaserText() {
    if (phaser) return Promise.resolve(phaser);
    return fetch('/vendor/phaser/phaser.min.js').then(function (r) {
      if (!r.ok) throw new Error('phaser ' + r.status);
      return r.text();
    }).then(function (t) { phaser = t; return t; });
  }

  /* The bridge the kid's code talks to: Studio.part(), Studio.parts, Studio.playing, Studio.event(),
     Studio.onChange(). Written as plain ES5 because it is a string, not a checked file. */
  function bridge() {
    return '<script>(function(){'
      + 'var changeFns=[];'
      + 'var S=window.Studio={parts:[],playing:false,'
      + 'part:function(id){for(var i=0;i<S.parts.length;i++)if(S.parts[i].id===id)return S.parts[i];return null;},'
      + 'event:function(n){parent.postMessage({__studio:"event",name:String(n)},"*");},'
      + 'onChange:function(fn){changeFns.push(fn);}};'
      + 'function scene(){var g=window.__game;return g&&g.scene&&g.scene.getScene("Level");}'
      + 'window.addEventListener("message",function(e){var d=e.data||{};'
      + 'if(d.__studio==="load"){S.parts=d.parts;S.playing=d.playing;changeFns=[];var s=scene();'
      + 'if(s){s.scene.restart();}if(window.__game&&window.__game.sound)window.__game.sound.mute=!!d.mute;}'
      + 'if(d.__studio==="set"){var p=S.part(d.id);if(p){p[d.key]=d.value;changeFns.slice().forEach(function(fn){try{fn(d.id,d.key,d.value);}catch(err){report(err);}});}}'
      + 'if(d.__studio==="mute"&&window.__game&&window.__game.sound)window.__game.sound.mute=!!d.mute;'
      + '});'
      + 'function report(err){parent.postMessage({__studio:"error",text:String(err&&err.message||err)},"*");}'
      + 'window.addEventListener("error",function(e){report(e.message);});'
      /* Phaser.Game is wrapped so the studio can find the game the kid's code makes without the
         kid's code having to hand it over. */
      + 'window.__wrapPhaser=function(){var G=Phaser.Game;Phaser.Game=function(c){var g=new G(c);window.__game=g;'
      + 'g.events.once("ready",function(){if(g.sound)g.sound.mute=!!window.__mute;parent.postMessage({__studio:"ready"},"*");});return g;};'
      + 'Phaser.Game.prototype=G.prototype;};'
      + '})();<' + '/script>';
  }

  function doc(code, parts, mute) {
    return '<!doctype html><html><head><meta charset="utf-8">'
      + '<style>html,body{margin:0;height:100%;background:#111;overflow:hidden}#game{width:100%;height:100%}canvas{display:block}</style>'
      + '</head><body><div id="game"></div>'
      + bridge()
      + '<script>window.__mute=' + (mute ? 'true' : 'false') + ';Studio.parts=' + JSON.stringify(parts).replace(/</g, '\\u003c') + ';</' + 'script>'
      + '<script>' + phaser + '\n</' + 'script>'
      + '<script>__wrapPhaser();</' + 'script>'
      + '<script>' + code.replace(/<\/script/gi, '<\\/script') + '\n</' + 'script>'
      + '</body></html>';
  }

  /* Build (or rebuild) the frame for this code. Resolves when the game says it is ready. */
  function mount(host, code, parts, mute) {
    return phaserText().then(function () {
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'gameFrame';
        frame.title = 'Your game';
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.setAttribute('allow', 'autoplay');
        host.appendChild(frame);
      }
      ready = false; builtFor = code;
      frame.srcdoc = doc(code, parts, mute);
      return new Promise(function (resolve) { pending = resolve; });
    });
  }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data || {};
    if (d.__studio === 'ready') { ready = true; if (pending) { pending(); pending = null; } emit('ready'); }
    if (d.__studio === 'event') {
      var t = Date.now(), n = String(d.name).slice(0, 30);
      if (t - (lastEvent[n] || 0) < 600) return;
      lastEvent[n] = t;
      if (playing) emit(n);
    }
    if (d.__studio === 'error') emit('error', String(d.text || '').slice(0, 300));
  });

  function post(msg) { if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, '*'); }

  function load(parts, mute) { post({ __studio: 'load', parts: parts, playing: playing, mute: mute }); }

  /* Play takes the snapshot; Stop restores it. Returns true if Stop undid something. */
  function play(parts, mute) {
    if (playing) return;
    playing = true; snapshot = Project.clone(parts); changedInPlay = false; lastEvent = {};
    load(parts, mute);
    emit('play');
    focusGame();
  }
  function stop(project, mute) {
    if (!playing) return false;
    playing = false;
    var undid = changedInPlay;
    if (snapshot) project.parts = snapshot;
    snapshot = null; changedInPlay = false;
    load(project.parts, mute);
    emit('stop');
    if (undid) emit('reverted');
    return undid;
  }
  /* The Inspector changed a setting. Sent to the running (or stopped) game either way; only
     marked as "will be undone" in Play mode. */
  function set(id, key, value) {
    if (playing) changedInPlay = true;
    post({ __studio: 'set', id: id, key: key, value: value });
  }
  function mute(m) { post({ __studio: 'mute', mute: m }); }
  function focusGame() { if (frame) { try { frame.focus(); frame.contentWindow.focus(); } catch (e) {} } }

  return { on: on, mount: mount, play: play, stop: stop, set: set, mute: mute, focusGame: focusGame,
           isPlaying: function () { return playing; }, isReady: function () { return ready; },
           frame: function () { return frame; }, builtFor: function () { return builtFor; } };
})();
