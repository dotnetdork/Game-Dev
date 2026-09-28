/* project.js: the kid's game as data, and where it is kept.

   A game is two things, the way a Unity project is:
     parts  the scene. Every row in the Hierarchy, and every setting the Inspector shows for it.
            Plain data, so the Inspector can change it without touching code.
     code   studio/starter/game.js, the real Phaser code that says how each kind of part looks and
            behaves. The kid can read it; the AI edits it. It is fetched once, as text, and then
            belongs to the kid's project.

   The first day starts from the intern's game: a greybox level (every part a plain grey block,
   the way a studio blocks a level out before Art arrives) with three things wrong with it. Each
   one belongs to a department, which is how the first day's "what should we fix first?" works.

   Saved to this browser under one key. The server copy comes with the sign-in work (see
   docs/rework/prototype-plan.md §7-8); until then a cleared browser starts the day again. */
var Project = (function () {
  var KEY = 'studio.v2';

  /* The intern's level. x/y are in the game's own 960×540 pixels. */
  function internsParts() {
    return [
      { id: 'level', name: 'Level 1', kind: 'level', note: 'the level', gravity: 1200, look: null },
      { id: 'player', name: 'Player', kind: 'player', note: 'grey box', x: 96, y: 420, speed: 240, jump: 600, look: null },
      { id: 'ground', name: 'Ground', kind: 'floor', note: 'solid', y: 448, pieces: [[0, 320], [384, 192], [704, 256]], solid: true, look: null },
      { id: 'tile', name: 'Floor tile', kind: 'floor', note: 'looks broken', y: 448, pieces: [[320, 64]], solid: false, look: null },
      { id: 'lava', name: 'Lava', kind: 'lava', note: 'the danger', x: 576, y: 464, w: 128, hurts: false, look: null },
      { id: 'coins', name: 'Coins', kind: 'coin', note: 'the goal', spots: [[480, 400], [832, 400]], size: 1, look: null, sound: null }
    ];
  }

  var state = null;
  function fresh() {
    return { v: 3, parts: internsParts(), code: null, quest: null };   // quest: the engine's own state (quest.js)
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) { state = null; }
    if (!state || state.v !== 3) state = fresh();
    return state;
  }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }, 300);
  }
  function reset() { state = fresh(); try { localStorage.removeItem(KEY); } catch (e) {} return state; }

  /* The starter code. It becomes the kid's own copy the moment it is edited (codeEdited); until then
     it is fetched fresh, so a fix to the starter reaches a kid who hasn't changed their code. */
  function code() {
    if (state.code && state.codeEdited) return Promise.resolve(state.code);
    return fetch('/studio/starter/game.js', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('starter code ' + r.status);
      return r.text();
    }).then(function (t) { state.code = t; save(); return t; });
  }

  function part(id) { return state.parts.filter(function (p) { return p.id === id; })[0] || null; }
  function clone(parts) { return JSON.parse(JSON.stringify(parts)); }

  return { load: load, save: save, reset: reset, code: code, part: part, clone: clone,
           get: function () { return state; }, internsParts: internsParts };
})();
