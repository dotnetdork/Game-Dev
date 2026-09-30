/* schema.js: every component a part can have, every setting on it, and every asset a setting can
   hold. The one list (review §7, "a component schema shared by the Inspector, the validator, the
   mentor's allowed changes and the Builder"): before it, a part's settings were written in four
   places (editor.js drew them, quest.js's CAN let the mentor change them, quests.js let a quest name
   them, the starter game read them) and the four had already drifted.

   Here: the Inspector draws each part's components from KINDS; the characters may change exactly
   the fields listed, to exactly the values allowed (can()); the Project window lists SPRITES and
   SOUNDS. quests.js still keeps its own PARTS list for the validator, and check-studio.js checks the
   two agree, since the server does not load browser scripts.

   COMPONENTS ARE UNITY'S, with Unity's names (Jed, 2026-09-28: the Unity words and habits stay), and
   the plain words go in the tooltip. A component with `toggle` has Unity's on/off checkbox in its
   header, and that IS the setting (a Box Collider that's off lets things fall through). `gate` is
   the name a quest uses to open a component (quest `allow:`), or one field of it: on the first day
   each department's job has exactly one thing to find; after it, every gate is open (quest.js).

   EVERY PART HAS THE SAME SHAPE (Jay, 2026-09-29: flipping between parts, the Inspector "looks wildly
   different from one area to the next"). So every game object starts with a Transform, Position X
   and Y, the way Unity's always does; components run Transform, Sprite Renderer, physics, sound,
   scripts. A component the story hasn't opened yet is drawn folded, not left out and not locked
   (Jay, Sept 30: "the inspector should allow you to manually configure several things if you want
   to"): the kid can open and set anything; the story's cue says which one it is asking about, and a
   ticket fixed early closes itself (quest.js, fixed_when).

   EVERY THING IN THE SCENE CAN BE MOVED (Jay, Sept 30: "not sure why i cannot move the position of
   the coins. Also, the coins should appear as separate objects shouldnt they?"). A part draws one
   thing or several: the Coins a coin at each of its `spots`, a floor a block for each of its
   `pieces` ([x, width] or [x, width, y]; y is the part's own when left out). A part with several is
   a Unity prefab and its instances: each thing is its own row in the Hierarchy ("Coin (1)"), with
   its own Position, and they share everything else, so setting the Clip on one sets it on every
   coin. The part's own row moves them all together. things(), where() and moveTo() below are the
   one account of it: the Inspector, the Scene view and the drag all go through them. A `place`
   field (Position X, Position Y, a floor's Width) is one of those and is not in rules(): moving
   things stays the kid's job, and the Builder's in code.

   THE ART IS CODE-DRAWN (Jay, 2026-09-28: lay off the Kenney sprites). Each sprite here is drawn by
   the game's own code (starter/game.js, SPRITES), so the kid's code owns its look and the Builder can
   add more; the Project window's thumbnails are the game's own textures, sent back by the frame. */
var Schema = (function () {
  /* sprite key: [the name shown, which kind of part can wear it] */
  var SPRITES = {
    coin_gold: ['Gold coin', 'coin'], coin_silver: ['Silver coin', 'coin'], gem_blue: ['Blue gem', 'coin'], star: ['Star', 'coin'],
    lava: ['Lava', 'lava'], goo: ['Green goo', 'lava'],
    grass: ['Grass', 'floor'], stone: ['Stone', 'floor'],
    hills: ['Hills', 'level'], night: ['Night sky', 'level'],
    hero: ['Your hero', 'player']
  };
  /* sound key: [the name shown, the file under /assets] */
  var SOUNDS = {
    ding: ['Sparkly ding', 'platformer/sfx_coin.ogg'],
    boing: ['Springy boing', 'platformer/sfx_jump.ogg'],
    buzz: ['Angry buzz', 'sfx-error.ogg']
  };

  /* WHICH SPRITE FITS WHICH SLOT. Any object's picture goes on any object, as in Unity (a star for a
     coin, stone for the lava, a gem for the Player). Two stay home: a background is the size of the
     level and drawn behind everything, and Your hero is drawn from its shape, for the Player only. */
  function fits(key, of) {
    var s = SPRITES[key]; if (!s) return false;
    if (s[1] === 'level' || of === 'level') return s[1] === of;
    return s[1] !== 'player' || of === 'player';
  }

  function num(key, label, tip, min, max, step, unit) { return { key: key, type: 'number', label: label, tip: tip, min: min, max: max, step: step, unit: unit || '' }; }
  function gated(f, gate) { f.gate = gate; return f; }
  function placed(f, one) { f.place = true; if (one) f.one = true; return f; }   // one: a single thing's, not the group's
  var PLACE = {
    x: placed(num('x', 'Position X', 'Position X: left to right, in pixels', 0, 960, 8)),
    y: placed(num('y', 'Position Y', 'Position Y: top to bottom, in pixels', 0, 540, 8)),
    w: placed(num('w', 'Width', 'Width: how wide it is, in pixels', 32, 960, 16), true)
  };
  var KINDS = {
    level: [
      { name: 'Scene', icon: 'i-pad', fields: [
        { key: 'look', type: 'sprite', of: 'level', label: 'Background', tip: 'Background: what’s drawn behind everything' },
        num('gravity', 'Gravity', 'Gravity: how hard everything is pulled down', 0, 2400, 50)
      ] }
    ],
    player: [
      { name: 'Transform', icon: 'i-cube', fields: [
        num('x', 'Position X', 'Position X: where the hero starts, left to right', 0, 960, 8),
        num('y', 'Position Y', 'Position Y: where the hero starts, top to bottom', 0, 540, 8)
      ] },
      { name: 'Sprite Renderer', icon: 'i-image', gate: 'heroArt', fields: [
        { key: 'look', type: 'sprite', of: 'player', label: 'Sprite', tip: 'Sprite: the picture the hero is drawn with' },
        { key: 'tint', type: 'color', label: 'Color', tip: 'Color: tints the picture' }
      ] },
      { name: 'Rigidbody 2D', icon: 'i-sliders', gate: 'playerMove', fields: [
        num('gravityScale', 'Gravity Scale', 'Gravity Scale: 1 is normal, 0 floats, 2 falls fast', 0, 3, 0.1, '×')
      ] },
      { name: 'Player Move (Script)', icon: 'i-script', gate: 'playerMove', fields: [
        num('speed', 'Speed', 'Speed: how fast the hero walks, in pixels a second', 60, 600, 10),
        num('jump', 'Jump Force', 'Jump Force: how hard the hero jumps', 200, 1200, 20)
      ] }
    ],
    floor: [
      { name: 'Transform', icon: 'i-cube', fields: [PLACE.x, PLACE.y, PLACE.w] },
      { name: 'Sprite Renderer', icon: 'i-image', gate: 'floorArt', fields: [
        { key: 'look', type: 'sprite', of: 'floor', label: 'Sprite', tip: 'Sprite: the picture this part is drawn with' },
        { key: 'tint', type: 'color', label: 'Color', tip: 'Color: tints the picture' }
      ] },
      { name: 'Box Collider 2D', icon: 'i-cube', toggle: 'solid', tip: 'Box Collider 2D: tick it and things can stand on this part',
        on: 'Things stand on it.', off: 'Things fall through.' }
    ],
    lava: [
      { name: 'Transform', icon: 'i-cube', fields: [PLACE.x, PLACE.y,
        gated(num('w', 'Width', 'Width: how wide the lava is, in pixels', 32, 320, 16), 'lavaSize')
      ] },
      { name: 'Sprite Renderer', icon: 'i-image', gate: 'lavaArt', fields: [
        { key: 'look', type: 'sprite', of: 'lava', label: 'Sprite', tip: 'Sprite: the picture this part is drawn with' },
        { key: 'tint', type: 'color', label: 'Color', tip: 'Color: tints the picture' }
      ] },
      { name: 'Hazard (Script)', icon: 'i-script', gate: 'hazard', toggle: 'hurts', tip: 'Hazard: a script. Tick it and touching this part sends the player back',
        on: 'Touching it sends you back.', off: 'It’s just a floor.' }
    ],
    coin: [
      { name: 'Transform', icon: 'i-cube', fields: [PLACE.x, PLACE.y,
        gated(num('size', 'Scale', 'Scale: how big the part is. 1 is its normal size', 0.5, 3, 0.1, '×'), 'coinSize')
      ] },
      { name: 'Sprite Renderer', icon: 'i-image', gate: 'coinArt', fields: [
        { key: 'look', type: 'sprite', of: 'coin', label: 'Sprite', tip: 'Sprite: the picture this part is drawn with' },
        { key: 'tint', type: 'color', label: 'Color', tip: 'Color: tints the picture' }
      ] },
      { name: 'Audio Source', icon: 'i-sound', gate: 'coinSound', fields: [
        { key: 'sound', type: 'sound', label: 'Clip', tip: 'Clip: the sound that plays when a coin is grabbed' },
        num('volume', 'Volume', 'Volume: 0 is silent, 1 is full', 0, 1, 0.05),
        num('pitch', 'Pitch', 'Pitch: under 1 is lower, over 1 is higher', 0.5, 2, 0.05, '×')
      ] }
    ]
  };
  var GATES = ['coinArt', 'coinSound', 'coinSize', 'lavaArt', 'lavaSize', 'hazard', 'floorArt', 'playerMove', 'heroArt'];
  var COLORS = ['#ffffff', '#ffd75e', '#ff8a65', '#ef5350', '#ec6fcf', '#9c7bff', '#4fc3f7', '#4dd0a8', '#9be36f', '#8d6e63', '#9e9e9e', '#37474f'];

  function components(kind) { return KINDS[kind] || []; }
  /* The sprites a slot takes: the ones made for it first, then the rest that fit. */
  function spritesFor(of) {
    var all = Object.keys(SPRITES).filter(function (k) { return fits(k, of); });
    return all.filter(function (k) { return SPRITES[k][1] === of; }).concat(all.filter(function (k) { return SPRITES[k][1] !== of; }));
  }

  /* ---------- where things are (the header's "every thing in the scene can be moved") ---------- */
  /* The things a part draws, each { x, y } (and w for a floor's block), or null for a part that is
     one thing at its own x and y (the Player, the lava). */
  function things(p) {
    if (!p) return null;
    if (p.kind === 'coin' && Array.isArray(p.spots)) return p.spots.map(function (s) { return { x: s[0], y: s[1] }; });
    if (p.kind === 'floor' && Array.isArray(p.pieces)) return p.pieces.map(function (q) { return { x: q[0], y: typeof q[2] === 'number' ? q[2] : p.y, w: q[1] }; });
    return null;
  }
  /* A part with several things is a prefab: its things are the Hierarchy's rows under it. */
  function many(p) { var t = things(p); return !!t && t.length > 1; }
  function childName(p, i) { return (p.kind === 'coin' ? 'Coin' : p.name) + ' (' + (i + 1) + ')'; }
  /* Where thing i is; i < 0 is the whole part, at its things' top-left corner. */
  function where(p, i) {
    var t = things(p);
    if (!t) return { x: p.x, y: p.y, w: p.w };
    if (t.length === 1) i = 0;
    if (i >= 0) return t[i] || null;
    return { x: Math.min.apply(null, t.map(function (q) { return q.x; })), y: Math.min.apply(null, t.map(function (q) { return q.y; })) };
  }
  /* The settings that put thing i (or the whole part, i < 0) at `to` ({ x, y, w }, any of them), as
     [key, value] pairs for Editor.set. Several things are one setting, a new list (never the old one
     changed, so Undo keeps what it was); the whole part moves every thing by the same amount. */
  function moveTo(p, i, to) {
    var t = things(p);
    if (!t) return Object.keys(to).filter(function (k) { return p[k] !== to[k]; }).map(function (k) { return [k, to[k]]; });
    if (t.length === 1) i = 0;
    var at = where(p, i), dx = 'x' in to ? to.x - at.x : 0, dy = 'y' in to ? to.y - at.y : 0;
    t = t.map(function (q, n) {
      if (i >= 0 && n !== i) return q;
      return { x: q.x + dx, y: q.y + dy, w: n === i && 'w' in to ? to.w : q.w };
    });
    if (p.kind === 'coin') return [['spots', t.map(function (q) { return [q.x, q.y]; })]];
    return [['pieces', t.map(function (q) { return q.y === p.y ? [q.x, q.w] : [q.x, q.w, q.y]; })]];
  }
  /* Everything a character may set on a part, as field → rule. A part the Builder added (a kind
     with no schema) may have its plain number and on/off settings changed, within reason. */
  function rules(p) {
    var out = {};
    components(p.kind).forEach(function (c) {
      if (c.toggle) out[c.toggle] = { type: 'bool' };
      (c.fields || []).forEach(function (f) { if (!f.place) out[f.key] = f; });
    });
    if (!KINDS[p.kind]) Object.keys(p).forEach(function (k) {
      if (/^(id|name|kind|note)$/.test(k)) return;
      if (typeof p[k] === 'boolean') out[k] = { type: 'bool' };
      if (typeof p[k] === 'number') out[k] = { type: 'number', min: -5000, max: 5000 };
    });
    return out;
  }
  function can(p, key, value) {
    var r = p && rules(p)[key];
    if (!r) return false;
    if (r.type === 'bool') return typeof value === 'boolean';
    if (r.type === 'number') return typeof value === 'number' && isFinite(value) && value >= r.min && value <= r.max;
    if (r.type === 'sprite') return value === null || fits(value, r.of);
    if (r.type === 'sound') return value === null || !!SOUNDS[value];
    if (r.type === 'color') return value === null || /^#[0-9a-f]{6}$/i.test(String(value));
    return false;
  }
  /* A setting by the name the kid sees in the Inspector: "Box Collider 2D" for a component's own
     checkbox, "Audio Source › Clip" for a field. The characters' prompt uses it, so a reply names
     what is on screen rather than the key the code stores it under. */
  function label(kind, key) {
    var hit = null;
    components(kind).some(function (c) {
      if (c.toggle === key) { hit = c.name + ' (its checkbox)'; return true; }
      var f = (c.fields || []).filter(function (x) { return x.key === key; })[0];
      if (f) { hit = c.name + ' › ' + f.label; return true; }
      return false;
    });
    return hit || key;
  }
  /* The same, in words, for the characters' prompt. */
  function describe(p) {
    var r = rules(p);
    return Object.keys(r).map(function (k) {
      var f = r[k];
      if (f.type === 'bool') return k + ' true/false';
      if (f.type === 'number') return k + ' ' + f.min + '–' + f.max;
      if (f.type === 'sprite') return k + ' ' + ['null'].concat(spritesFor(f.of)).join('/');
      if (f.type === 'sound') return k + ' ' + ['null'].concat(Object.keys(SOUNDS)).join('/');
      if (f.type === 'color') return k + ' a #rrggbb colour or null';
      return k;
    }).join(', ');
  }

  return { SPRITES: SPRITES, SOUNDS: SOUNDS, KINDS: KINDS, GATES: GATES, COLORS: COLORS,
           components: components, spritesFor: spritesFor, fits: fits, rules: rules, can: can, describe: describe, label: label,
           things: things, many: many, childName: childName, where: where, moveTo: moveTo };
})();
