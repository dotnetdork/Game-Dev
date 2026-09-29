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
   scripts; and a component the story hasn't opened is drawn as a locked header, not left out.
   A `readonly` field is shown and never set: the level's code places the floor, so its position is
   read from the part (`get`) and is not in rules(), where nothing (the AI included) can change it.

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

  function num(key, label, tip, min, max, step, unit) { return { key: key, type: 'number', label: label, tip: tip, min: min, max: max, step: step, unit: unit || '' }; }
  function gated(f, gate) { f.gate = gate; return f; }
  function ro(key, label, get) { return { key: key, type: 'number', readonly: true, label: label, step: 1, get: get, tip: label + ': set by the level. Ask the Builder to move it' }; }
  function least(list, i) { return Math.min.apply(null, list.map(function (q) { return q[i]; })); }
  var PLACED = {
    x: ro('x', 'Position X', function (p) { return p.pieces ? least(p.pieces, 0) : p.spots ? least(p.spots, 0) : p.x; }),
    y: ro('y', 'Position Y', function (p) { return p.spots ? least(p.spots, 1) : p.y; })
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
      { name: 'Transform', icon: 'i-cube', fields: [PLACED.x, PLACED.y] },
      { name: 'Sprite Renderer', icon: 'i-image', gate: 'floorArt', fields: [
        { key: 'look', type: 'sprite', of: 'floor', label: 'Sprite', tip: 'Sprite: the picture this part is drawn with' },
        { key: 'tint', type: 'color', label: 'Color', tip: 'Color: tints the picture' }
      ] },
      { name: 'Box Collider 2D', icon: 'i-cube', toggle: 'solid', tip: 'Box Collider 2D: tick it and things can stand on this part',
        on: 'Things stand on it.', off: 'Things fall through.' }
    ],
    lava: [
      { name: 'Transform', icon: 'i-cube', fields: [PLACED.x, PLACED.y,
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
      { name: 'Transform', icon: 'i-cube', fields: [PLACED.x, PLACED.y,
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
  function spritesFor(kind) { return Object.keys(SPRITES).filter(function (k) { return SPRITES[k][1] === kind; }); }
  /* Everything a character may set on a part, as field → rule. A part the Builder added (a kind
     with no schema) may have its plain number and on/off settings changed, within reason. */
  function rules(p) {
    var out = {};
    components(p.kind).forEach(function (c) {
      if (c.toggle) out[c.toggle] = { type: 'bool' };
      (c.fields || []).forEach(function (f) { if (!f.readonly) out[f.key] = f; });
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
    if (r.type === 'sprite') return value === null || (SPRITES[value] && SPRITES[value][1] === r.of) || false;
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
           components: components, spritesFor: spritesFor, rules: rules, can: can, describe: describe, label: label };
})();
