/* ai/guards.js — checking the model's answer instead of trusting it.
 *
 * Moved out of server.js by the Phase 1 split in docs/architecture-audit-2026-09-15.md. Every
 * function here is pure: text in, findings out. That is the point — they are the deterministic
 * half of the AI safety story (Stage 4 Tier 1), they work with any model, and being pure is what
 * makes them testable without one. See tools/check-guards.js.
 */

// ---- helpers ----
function extractJSON(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < 0 || b < a) return null;
  try { return unwrapDoubleJSON(JSON.parse(s.slice(a, b + 1))); } catch (e) { return null; }
}
/* After reading tool output a model sometimes answers with its JSON wrapped inside another
   JSON string, so `reply` arrives holding the whole object as text. Unwrap it once rather
   than showing a student a blob of JSON. */
const OP_FIELDS = ['reply', 'why', 'config', 'functions', 'create', 'update', 'newFile', 'editFile', 'replaceFile'];
function unwrapDoubleJSON(parsed) {
  if (!parsed || typeof parsed.reply !== 'string' || !/^\s*\{/.test(parsed.reply)) return parsed;
  try {
    const inner = JSON.parse(parsed.reply.slice(parsed.reply.indexOf('{'), parsed.reply.lastIndexOf('}') + 1));
    if (inner && OP_FIELDS.some(function (k) { return inner[k] !== undefined; })) return inner;
  } catch (e) { /* leave it alone */ }
  return parsed;
}
// The browser sends prior turns so follow-ups like "even faster" or "undo that" make sense.
// Never trusted as-is: roles, per-message length, turn count and total size are all capped here.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = []; let budget = 3000;
  for (let i = raw.length - 1; i >= 0 && out.length < 12; i--) {
    const m = raw[i]; if (!m) continue;
    const role = m.role === 'assistant' ? 'assistant' : (m.role === 'user' ? 'user' : null);
    if (!role) continue;
    const content = String(m.content == null ? '' : m.content).slice(0, 1000);
    if (!content.trim()) continue;
    if (content.length > budget) break;                 // oldest turns fall off first
    budget -= content.length;
    out.unshift({ role: role, content: content });
  }
  return out;
}

// What the coder can see besides game.js: the lesson being worked on, the other project
// files, and the asset keys that actually exist. Without this it guesses, and a guessed

// ---- asset-key validation (Stage 4 Tier 1, pulled forward) ----
// Telling a 7B model "these are the only keys that exist" is not enough — it still invents
// them, and a key that was never loaded fails silently and leaves the student with a broken
// game. So we check its answer instead of trusting it. Deterministic: works with any model.
//
// Where the key sits in each call. `add.text(x, y, 'hi')` is deliberately absent — its third
// argument is text to display, not a key.
const ASSET_USES = [
  { re: /\b(?:add|physics\.add|make)\.(?:sprite|image)\s*\(/g, arg: 2 },
  { re: /\b(?:add|make)\.tileSprite\s*\(/g, arg: 4 },
  { re: /\.create\s*\(/g, arg: 2 },                       // group.create(x, y, key)
  { re: /\bsound\.(?:play|add)\s*\(/g, arg: 0 },
  { re: /\.setTexture\s*\(/g, arg: 0 }
];
// A key can also be legitimately created at runtime rather than bought.
const ASSET_DEFS = [
  { re: /\bgenerateTexture\s*\(/g, arg: 0 },
  { re: /\bload\.(?:image|audio|spritesheet|atlas|bitmapFont)\s*\(/g, arg: 0 }
];
// Split a call's arguments at top level. Needed because arguments are real expressions —
// `Math.random() * (HEIGHT - 100)` has parens in it, which no flat regex survives.
function callArgs(text, open) {
  let depth = 0, start = open + 1, quote = null; const args = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { args.push(text.slice(start, i)); return args; }
      continue;
    }
    if (c === ',' && depth === 1) { args.push(text.slice(start, i)); start = i + 1; }
  }
  return args;   // unbalanced (truncated reply) — treat as no usable args
}
function stringArg(s) { const m = String(s).trim().match(/^(['"])([^'"]*)\1$/); return m ? m[2] : null; }
function opsCode(ops) {
  const out = [];
  ['create', 'update', 'replaceFile'].forEach(function (k) { if (typeof ops[k] === 'string') out.push(ops[k]); });
  if (Array.isArray(ops.functions)) ops.functions.forEach(function (f) { if (typeof f === 'string') out.push(f); });
  if (ops.newFile && typeof ops.newFile.code === 'string') out.push(ops.newFile.code);
  return out.join('\n');
}
function matchAll(text, specs) {
  const found = {};
  specs.forEach(function (spec) {
    spec.re.lastIndex = 0; let m;
    while ((m = spec.re.exec(text))) {
      const key = stringArg(callArgs(text, m.index + m[0].length - 1)[spec.arg]);
      if (key) found[key] = true;      // a non-literal (variable) argument is unknowable, so skip it
    }
  });
  return found;
}
// Keys the proposed change uses that the student does not own and nothing defines.
// `sets` are owned bundles as prefix+count: a key inside one of those ranges is owned even though
// it is not in the (capped) key list, which is what stops a 400-tile set being rejected from 301.
function unknownAssetKeys(ops, gameCode, owned, sets) {
  const code = opsCode(ops);
  if (!code.trim()) return [];
  const defined = matchAll(gameCode + '\n' + code, ASSET_DEFS);   // existing code counts
  const ownedSet = {};
  (owned || []).forEach(function (a) { ownedSet[a.key] = true; });
  const inSet = function (k) {
    return (sets || []).some(function (t) {
      if (k.indexOf(t.prefix) !== 0) return false;
      /* The tail has to be a number inside the set, so a prefix cannot wave through anything that
         merely starts with the same letters. */
      const tail = k.slice(t.prefix.length);
      return /^\d+$/.test(tail) && parseInt(tail, 10) < t.count;
    });
  };
  return Object.keys(matchAll(code, ASSET_USES))
    .filter(function (k) { return !ownedSet[k] && !defined[k] && !inSet(k); });
}
function assetApology(bad, owned) {
  const names = bad.map(function (k) { return '"' + k + '"'; }).join(' and ');
  const have = (owned || []).slice(0, 6).map(function (a) { return a.key; }).join(', ');
  return 'I wanted to use ' + names + ', but you don’t own ' + (bad.length > 1 ? 'those' : 'that') + ' yet, so I left your game alone. '
    + (have ? 'You can use: ' + have + '. ' : '')
    + 'Buy more art and sounds in the Store, or ask me for something using what you have.';
}

// ---- Phaser APIs that do not exist ----
// phaser-rules.md tells the model not to use these; it does anyway often enough to matter, and
// each one either crashes the scene or silently does nothing. Checked, not trusted.
const BAD_PHASER_APIS = [
  { re: /\.(cubicCurveTo|bezierCurveTo|quadraticCurveTo|arcTo|arc|ellipse|rect)\s*\(/g,
    why: 'is an HTML-canvas method and does not exist on Phaser Graphics',
    hint: 'use fillRect, fillRoundedRect, fillCircle, fillTriangle or beginPath/moveTo/lineTo/closePath/fillPath' },
  { re: /\bnew\s+Phaser\.Game\s*\(/g, label: 'new Phaser.Game',
    why: 'creates a second game', hint: 'main.js already starts the game — never create another' },
  { re: /\binput\.keyboard\.isDown\s*\(/g, label: 'input.keyboard.isDown()',
    why: 'does not exist', hint: 'read scene.cursors.<key>.isDown, or register the key with addKeys first' },
  { re: /\bload\.(?:image|audio|spritesheet)\s*\(\s*[^,)]+,\s*['"]https?:/g, label: 'loading a file from a URL',
    why: 'is not allowed here', hint: 'every picture and sound is already loaded by key — use an owned key' }
];
// `arc`/`rect`/`ellipse` are only wrong on a Graphics object; scene.add.rect/ellipse are real.
const GRAPHICS_ONLY = /^(arc|ellipse|rect)$/;
function apiHits(code) {
  const hits = {};
  BAD_PHASER_APIS.forEach(function (rule) {
    rule.re.lastIndex = 0; let m;
    while ((m = rule.re.exec(String(code)))) {
      if (m[1] && GRAPHICS_ONLY.test(m[1])) {
        const before = String(code).slice(Math.max(0, m.index - 40), m.index);
        if (!/graphics|\bg\b|gfx/i.test(before)) continue;      // scene.add.rect(...) is fine
      }
      const name = rule.label || m[1] || m[0].trim();
      hits[name] = hits[name] || { name: name, why: rule.why, hint: rule.hint, n: 0 };
      hits[name].n++;
    }
  });
  return hits;
}
/* Only what this change INTRODUCES. main.js legitimately contains `new Phaser.Game`, so a file
   sent back whole must not be condemned for what was already in it. */
function badPhaserApis(proposed, baseline) {
  const now = apiHits(proposed), was = apiHits(baseline || '');
  return Object.keys(now).filter(function (k) { return now[k].n > (was[k] ? was[k].n : 0); })
    .map(function (k) { return now[k]; });
}
// Per changed file, so each is compared against its own original.
function badApisIn(ops, gameCode, ctxFiles) {
  const out = [];
  if (ops.editFile && typeof ops.editFile.code === 'string') {
    const orig = (ctxFiles || []).filter(function (f) { return f.name === ops.editFile.name; })[0];
    badPhaserApis(ops.editFile.code, orig ? orig.code : '').forEach(function (b) { out.push(b); });
  }
  const gameOps = {};
  ['functions', 'create', 'update', 'replaceFile', 'newFile'].forEach(function (k) { if (ops[k] !== undefined) gameOps[k] = ops[k]; });
  if (Object.keys(gameOps).length) {
    badPhaserApis(opsCode(gameOps), ops.replaceFile ? gameCode : '').forEach(function (b) { out.push(b); });
  }
  const seen = {};
  return out.filter(function (b) { if (seen[b.name]) return false; seen[b.name] = 1; return true; });
}

// ---- keyboard keys must be registered before they are read ----
// `scene.keys.SHIFT.isDown` when only 'W,A,S,D' were registered throws on the very first frame
// and freezes the game. The model gets this right about half the time however plainly the rule
// is written, so it is checked rather than trusted.
function unregisteredKeys(code) {
  const registered = {}; let m, re;
  re = /addKeys\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(code))) m[1].split(',').forEach(function (k) { registered[k.trim().toUpperCase()] = true; });
  re = /addKey\s*\(\s*(?:Phaser\.Input\.Keyboard\.KeyCodes\.([A-Za-z_]+)|['"]([^'"]+)['"])/g;
  while ((m = re.exec(code))) registered[String(m[1] || m[2]).trim().toUpperCase()] = true;
  const used = {};
  re = /\bkeys\.([A-Za-z_]\w*)\b/g;
  while ((m = re.exec(code))) used[m[1].toUpperCase()] = true;
  return Object.keys(used).filter(function (k) { return !registered[k]; });
}
function badKeysIn(ops, gameCode) {
  const bad = {};
  if (ops.editFile && typeof ops.editFile.code === 'string') {
    unregisteredKeys(ops.editFile.code).forEach(function (k) { bad[k] = true; });
  }
  const inGame = opsCode(ops).replace(ops.editFile && ops.editFile.code ? ops.editFile.code : '\0', '');
  if (inGame.trim()) unregisteredKeys(gameCode + '\n' + inGame).forEach(function (k) { bad[k] = true; });
  return Object.keys(bad);
}

// ---- "I added it!" with no ops is a lie the student acts on ----
// A reply is not a change: unless the JSON carries an op field, nothing happens to the game.
// Small models will happily claim success anyway, so the claim is checked against the ops.
//
// IT USED TO WANT A PRONOUN. One regex, and every branch of it began with "I've"/"you can"/"now
// <verb>" — so the single most common false success in the capture, the bare word "Done.", walked
// straight through the guard that exists to catch exactly that. So did "Added it." and the prompt's
// own worked-example phrasing, "There's an extra coin now". A list rather than one alternation,
// because these are four different shapes of the same lie and reading them as four is the only way
// to see which one is missing.
//
// KNOWN AND DELIBERATE: "is now" / "can now" also match a reply that merely DESCRIBES the game
// ("your speed is now 200 — want 300?"), which is a good conversational answer and not a claim.
// Widening the regex without that being handled would turn good replies into retries, so it is
// handled where the context exists: routes/ai.js skips the retry when the model set `held`.
const CLAIMS_A_CHANGE = [
  // first person, past tense: "I've added a double jump"
  /\bi(?:'ve| have)? (?:added|changed|updated|set|made|created|implemented|fixed|adjusted|put|swapped|removed)\b/i,
  // the game described as already different: "now jumps", "now has a counter"
  /\bnow (?:sprints?|jumps?|runs?|moves?|has|have|shows?|contains?|can|will|appears?)\b/i,
  /\b(?:will|can|is|are|should) now\b/i,
  // "There's an extra coin now" — stated as a fact about a game nothing was sent to
  /\bthere(?:'s|’s| is| are) .{0,60}\bnow\b/i,
  // a bare past-tense verb with nobody in front of it: "Added it.", "Changed the speed."
  /^\W*(?:added|changed|updated|set|made|created|implemented|fixed|adjusted|swapped|removed|increased|decreased|bumped)\b/i,
  // "Done." and the words that stand in for it
  /^\W*(?:ok(?:ay)?|sure|alright|yep|yes)?\W*(?:all )?done\b/i,
  /* A PROMISE IS THE SAME DEFECT IN THE FUTURE TENSE, and it is what a model does when it runs out
     of lookups mid-thought: "I'll add the FPS counter using create/update snippets in game.js."
     Nothing was sent, so nothing happens, and the student is left waiting for a change that was
     only ever described. provider.js now tells the model when its lookups are over, which is the
     real fix; this is the net under it.
     Intent only — "I can add a counter, want me to?" is a question and stays out, which is why
     `can` is deliberately absent from the list. */
  /\b(?:i'?ll|i will|let me|i'?m going to|i am going to|going to)\s+(?:now\s+|just\s+)?(?:add|change|update|set|make|create|put|write|build|fix|give|move|swap)\b/i
];
function claimsChangeWithoutOps(reply, ops) {
  if (Object.keys(ops || {}).length) return false;
  const s = String(reply || '');
  return CLAIMS_A_CHANGE.some(function (re) { return re.test(s); });
}

/* ---- the one line the app adds when it holds a change back ----
   The server used to REPLACE the model's answer with a canned sentence whenever a guard fired
   twice — so a model that did exactly what the retry asked ("if it cannot be done that way, change
   nothing and say so plainly") had its explanation thrown away, and an eleven-year-old read "Try
   asking for it a slightly different way." This is the other half of that fix: the model's words go
   to the student, and the app appends one short line saying what it held back and why.

   Three shapes because the three detectors hand back three different things: bad-api hits are
   {name, why, hint} objects, bad-key hits are key names, bad-asset hits are keys the student does
   not own. Pure, so tools/check-guards.js can assert on the wording. */
function heldNote(name, hits, owned) {
  const list = hits || [];
  if (name === 'bad-api') {
    if (!list.length) return '';
    return 'I left your game as it was — the way I tried needs ' + list.map(function (b) {
      return '“' + b.name + '”, which ' + b.why + ' (' + b.hint + ')';
    }).join('; and ') + '.';
  }
  if (name === 'bad-key') {
    if (!list.length) return '';
    return 'I left your game as it was — my change read ' + list.map(function (k) { return 'the ' + k + ' key'; }).join(' and ')
      + ', which your game never registers, so it would have frozen on the first frame.';
  }
  if (name === 'bad-asset') return list.length ? assetApology(list, owned) : '';
  /* Two no-ops notes, because there are two different situations and one sentence was being used
     for both — which is how a student asking a perfectly good follow-up ("we capped it but the
     counter still shows 130+") got told the assistant could not work out what they meant.

     'no-ops' is for a model that said NOTHING usable: there is nothing to pass on, so this is the
     whole reply. 'no-ops-claimed' is for a model that talked — and its words still go to the
     student, with this in front of them. The app knows the game did not change; it does not know
     that the explanation was worthless, and it had no business throwing it away. */
  if (name === 'no-ops') {
    return "I didn't actually change anything — I couldn't work out how to do that one. "
      + 'Can you tell me a bit more about what you want to happen?';
  }
  if (name === 'no-ops-claimed') {
    return 'Heads up: nothing in your game actually changed this time — I described a change but did '
      + 'not send one. Here is what I was saying:';
  }
  return '';
}

/* "Done." / "OK" / "Sure" — an acknowledgement carrying no information. The browser has had this
   list since the first "Done." complaint (saysSomething in js/ai.js); the server needs it for the
   one decision above, where keeping such a reply means printing a correction followed by the very
   word that caused it. One fact, two places, and this is the server's copy — keep them together. */
const EMPTY_ACK = /^(done|ok|okay|sure|yep|yes|here you go|all done|i've made the change|i have made the change)[.!]*$/i;
function isEmptyAck(s) { return EMPTY_ACK.test(String(s || '').trim()); }


module.exports = { extractJSON: extractJSON, unwrapDoubleJSON: unwrapDoubleJSON,
  sanitizeHistory: sanitizeHistory, unknownAssetKeys: unknownAssetKeys, assetApology: assetApology,
  badApisIn: badApisIn, badKeysIn: badKeysIn, claimsChangeWithoutOps: claimsChangeWithoutOps,
  heldNote: heldNote, isEmptyAck: isEmptyAck, BAD_PHASER_APIS: BAD_PHASER_APIS };
