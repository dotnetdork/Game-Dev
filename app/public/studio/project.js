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

   Saved to this browser under one key, and to the server by save.js, so a kid's game is waiting
   for them on any Chromebook they sign in on. */
var Project = (function () {
  var KEY = 'studio.v2';

  /* The intern's level. x/y are in the game's own 960×540 pixels. Every setting here is one the
     Inspector shows (schema.js); the Hierarchy shows only the names (no notes: "Level 1 · the
     level" told the kid what they could already see, and "looks broken" gave the answer away). */
  function internsParts() {
    return [
      { id: 'level', name: 'Level 1', kind: 'level', gravity: 1200, look: null },
      { id: 'player', name: 'Player', kind: 'player', x: 96, y: 420, speed: 240, jump: 600, gravityScale: 1, look: null, tint: null, shape: null },
      { id: 'ground', name: 'Ground', kind: 'floor', y: 448, pieces: [[0, 320], [384, 192], [704, 256]], solid: true, look: null, tint: null },
      { id: 'tile', name: 'Floor tile', kind: 'floor', y: 448, pieces: [[320, 64]], solid: false, look: null, tint: null },
      { id: 'lava', name: 'Lava', kind: 'lava', x: 576, y: 464, w: 128, hurts: false, look: null, tint: null },
      { id: 'coins', name: 'Coins', kind: 'coin', spots: [[480, 400], [832, 400]], size: 1, look: null, tint: null, sound: null, volume: 0.6, pitch: 1 }
    ];
  }

  /* THE DESIGN DOC (spec D41): the kid's game written down, section by section, and what the Builder
     builds from. It is filled in the chat, in rounds (design.js), and the kid can change any of it in
     the Design doc tab (views.js). The sections are in Jed's order (Sept 30): "start with the things
     that make the game play, then move on", so gameplay comes first and the art, sound and writing
     after it. Each section is { text, state, by, at }:
       state  'empty' (nothing yet), 'started' (something, still to finish), 'decided'
       by     who wrote the words last: 'kid' (typed it in the tab, or said it) or 'ai' (the designer,
              from what the kid said)
     `changed` lists the sections written since they were last filed as tickets, which is what the
     next `file: design` files (quest.js fileDesign); `builtAt` is when that last filing was. `ideas` are the things the kid asked for that don't
     belong in a section yet ("Ideas for later"). */
  /* [key, the kid's title, what the section asks]. The question is the empty section's prompt in the
     tab and the scripted question when the AI is down (design.js), so it is written once, here. */
  var SECTIONS = [['idea', 'The idea', 'What kind of game is it? Say it in one sentence.'],
                  ['play', 'How you play', 'What does the player do? Which keys do what?'],
                  ['goal', 'The goal', 'How do you win? How do you lose?'],
                  ['fun', 'What makes it fun', 'What’s the best moment in it, and why is it fun?'],
                  ['obstacles', 'Obstacles and enemies', 'What gets in the player’s way?'],
                  ['hero', 'Your hero', 'Who do you play as? What can they do?'],
                  ['world', 'World and look', 'Where does it happen? What does it look like?'],
                  ['sound', 'Sound and music', 'What does it sound like? Music, sound effects?'],
                  ['story', 'Story and writing', 'Is there a story? What words are on screen?']];
  function freshDoc() {
    var s = {};
    SECTIONS.forEach(function (x) { s[x[0]] = { text: '', state: 'empty', by: null, at: 0 }; });
    return { v: 1, sections: s, ideas: [], builtAt: 0, changed: [] };
  }

  var state = null;
  function fresh() {
    return { v: 3, parts: internsParts(), code: null, quest: null, doc: freshDoc() };   // quest: the engine's own state (quest.js)
  }
  /* A save from before a setting existed gets that setting, at the intern's value, rather than the
     whole game being thrown away (V1's rule: migrate, never wipe). The old Kenney looks the first
     build used are moved onto the code-drawn sprites with the same job. */
  var OLD_LOOKS = { alien: 'hero', pink: 'hero', slime: 'hero', frog: 'hero', mouse: 'hero' };
  function migrate(s) {
    var base = internsParts();
    s.parts.forEach(function (p) {
      var b = base.filter(function (q) { return q.id === p.id; })[0];
      if (b) Object.keys(b).forEach(function (k) { if (!(k in p)) p[k] = b[k]; });
      delete p.note;
      if (p.kind === 'player' && OLD_LOOKS[p.look]) p.look = p.shape ? 'hero' : null;
    });
    // a save from before the design doc: a blank one, with the hero and the ideas the kid already gave
    if (!s.doc || s.doc.v !== 1 || !s.doc.sections) {
      s.doc = freshDoc();
      var q = s.quest || {};
      if (q.hero) s.doc.sections.hero = { text: q.hero, state: 'started', by: 'kid', at: Date.now() };
      if (Array.isArray(q.ideas)) s.doc.ideas = q.ideas.slice();
    }
    SECTIONS.forEach(function (x) { if (!s.doc.sections[x[0]]) s.doc.sections[x[0]] = { text: '', state: 'empty', by: null, at: 0 }; });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) { state = null; }
    if (!state || state.v !== 3 || !Array.isArray(state.parts)) state = fresh();
    else migrate(state);
    return state;
  }
  var saveTimer = null, onSave = [], frozen = false;
  function save() {
    if (frozen) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      onSave.forEach(function (fn) { fn(state); });   // save.js sends the server its copy
    }, 300);
  }
  /* Signing out (save.js, leave): write now rather than in 300ms, then never again on this page, so
     nothing puts the game back in this browser after it has been cleared. */
  function flush() {
    if (frozen || !state) return;
    clearTimeout(saveTimer);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function freeze() { flush(); frozen = true; clearTimeout(saveTimer); }
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

  /* The design doc's one way in: every writer (the tab, the rounds, the quest's hero question) comes
     through here, so `changed` and the listeners are never skipped. Words that don't change anything
     change nothing, so a kid clicking in and out of a section doesn't queue a build. */
  var onDoc = [];
  function docChanged(key) { onDoc.forEach(function (fn) { try { fn(key); } catch (e) { console.error(e); } }); }
  function writeDoc(key, text, by, st8) {
    var d = state.doc, s = d.sections[key]; if (!s) return false;
    text = String(text || '').trim().slice(0, 600);
    st8 = st8 || (text ? 'decided' : 'empty');
    if (s.text === text && s.state === st8) return false;
    d.sections[key] = { text: text, state: text ? st8 : 'empty', by: by === 'ai' ? 'ai' : 'kid', at: Date.now() };
    if (s.text !== text && d.changed.indexOf(key) < 0) d.changed.push(key);
    save(); docChanged(key);
    return true;
  }
  function docIdea(text) {
    var d = state.doc; d.ideas.push(String(text).slice(0, 200)); if (d.ideas.length > 40) d.ideas.shift();
    save(); docChanged(null);
  }
  /* Those sections are on the board as tickets now (quest.js fileDesign), so they are off the change
     list. Only those: a section still being planned (the hero, "started" after round 1) stays on it,
     or deciding it later in the same words would never file it. */
  function docBuilt(keys) {
    var d = state.doc;
    d.changed = keys ? d.changed.filter(function (k) { return keys.indexOf(k) < 0; }) : [];
    d.builtAt = Date.now(); save(); docChanged(null);
  }

  return { load: load, save: save, onSave: function (fn) { onSave.push(fn); }, KEY: KEY, reset: reset, flush: flush, freeze: freeze, code: code, part: part, clone: clone,
           get: function () { return state; }, internsParts: internsParts, migrate: migrate,
           SECTIONS: SECTIONS, doc: function () { return state.doc; }, writeDoc: writeDoc, docIdea: docIdea, docBuilt: docBuilt,
           onDoc: function (fn) { onDoc.push(fn); } };
})();
