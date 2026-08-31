/* pages.js — Full-page views outside the editor: Store, Gallery, Leaderboards, Docs and Help, plus the top-bar router. */
/* ---------- page router ---------- */
/* Whether the game was running when the student left the editor for a full page, so it can be put
   back exactly as they left it rather than only when they happen to return to the Play tab. */
let wasRunningBeforePage = false;
function showPage(page) {
  // The lab makes the top bar inert while it is open, so this should be unreachable then. Belt
  // and braces: leaving the bench on top of the Store would be baffling and hard to get out of.
  if (typeof openLabRef !== 'undefined' && openLabRef) closeLab();
  document.querySelectorAll('.navitem').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-page') === page); });
  if (page === 'courses') {
    $('editor').hidden = false; $('page').hidden = true;
    /* Put the game back if it was running when we left.
       Leaving for any full page calls stopGame() below, which drops the iframe's srcdoc. Without
       this, a student who looks at the Store and comes back finds an empty stage with nothing on
       screen to suggest why. (The console toggle appeared to be the culprit only because resizing a
       blank frame is when you notice it is blank.)
       Keyed on whether the game was RUNNING, not on which tab is showing: since the transport
       separated those, a game can be running behind the Code tab and would otherwise be silently
       dropped by a trip to the Store. */
    if (wasRunningBeforePage && typeof startGame === 'function') startGame();
    wasRunningBeforePage = false;
    paintAIBtn();
    if (typeof syncRoute === 'function') syncRoute();
    return;
  }
  wasRunningBeforePage = (typeof isGameRunning === 'function') && isGameRunning();
  stopGame(); $('editor').hidden = true; $('page').hidden = false;
  const pg = $('page');
  if (page === 'store') pg.innerHTML = renderStore();
  else if (page === 'gallery') pg.innerHTML = renderGallery();
  else if (page === 'leaderboards') pg.innerHTML = renderBoard();
  else if (page === 'docs') pg.innerHTML = renderDocs();
  else if (page === 'help') pg.innerHTML = renderHelp();
  wirePage(page);
  paintAIBtn();
  /* Store, Gallery, Docs and Help get their own address, so they can be linked and the back button
     returns to the lesson you came from. See js/router.js. */
  if (typeof syncRoute === 'function') syncRoute();
}
document.querySelectorAll('.navitem').forEach(function (b) { b.addEventListener('click', function () { showPage(b.getAttribute('data-page')); }); });

/* ---------- asset store (spend Stars to unlock real Phaser assets; owned ones auto-preload by key) ---------- */
const assets = window.STORE_ASSETS || [];
const packs = window.STORE_PACKS || [];
const bundles = window.STORE_BUNDLES || [];
const bundleById = {}; bundles.forEach(function (b) { bundleById[b.id] = b; });
const assetByKey = {}; assets.forEach(function (a) { assetByKey[a.key] = a; });
function avatarStyle(name) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return 'background:hsl(' + (Math.abs(h) % 360) + ' 62% 58%)'; }
const CAT_STYLE = {
  Characters: { col: '#2b6cb0', mdi: 'mdi-human' },
  Enemies: { col: '#9b2c2c', mdi: 'mdi-emoticon-devil-outline' },
  Collectibles: { col: '#2c7a7b', mdi: 'mdi-diamond-stone' },
  Tiles: { col: '#8a6d3b', mdi: 'mdi-grid' },
  Backgrounds: { col: '#3730a3', mdi: 'mdi-image-outline' },
  UI: { col: '#6b46c1', mdi: 'mdi-gesture-tap-button' },
  Sounds: { col: '#0e7490', mdi: 'mdi-volume-high' }
};
/* The Store went from 233 items to 3,246 across nineteen packs. At that size a single scrolling
   grid of everything is not a shop, it is a haystack — so there are three ways to narrow it (what
   it is, which pack it came from, and a search box) and the grid is paged.

   PAGING IS NOT COSMETIC. Every card carries an <img>, and 3,246 of them is 3,246 requests the
   moment the page opens. Lazy loading already keeps them out of the network until they scroll into
   view, but the DOM cost of building the cards is paid up front either way. STORE_PAGE at a time,
   with a button for more. */
const STORE_PAGE = 120;
let storeFilter = 'All';
let storePack = 'All';
let storeQuery = '';
let storeShown = STORE_PAGE;
let storeOpenBundle = null;      // a bundle whose contents are expanded inline
function storeArt(a) {
  const st = CAT_STYLE[a.cat] || { col: '#2b6cb0', mdi: 'mdi-cube' };
  const bg = 'background:linear-gradient(135deg,' + st.col + ',#0b1a2e)';
  if (a.type === 'audio') {
    return '<div class="art" style="' + bg + '"><span class="mdi ' + st.mdi + '"></span>'
      + '<button class="playbtn" data-play="' + a.id + '" title="Preview sound"><span class="mdi mdi-play"></span></button></div>';
  }
  const pixel = '';  // Kenney art is smooth, not pixel-art
  // The catalogue is 233 pictures, and asking for all of them the instant the Store opens was the
  // single heaviest moment in the app — the one most likely to fall over on a shared classroom
  // connection. Lazy loading takes that to roughly what fits on screen. No width/height here on
  // purpose: `.gcard .art` is already a fixed 130px box, so there is no shift to prevent, and
  // fixed attributes would force a 1:1 ratio onto sprites that are not square.
  return '<div class="art' + pixel + '" style="' + bg + '"><img src="' + a.file + '" alt="' + a.name
    + '" loading="lazy" decoding="async"></div>';
}
/* Hyphens, underscores and spaces are all flattened away on both sides, so "1-bit", "1 bit" and
   "1bit" find the same things. A child typing a pack name into a search box should not have to
   guess which of the three the catalogue happened to use — and this catalogue uses all three. */
function loose(s) { return String(s || '').toLowerCase().replace(/[\s_-]+/g, ''); }
function matchesQuery(o) {
  if (!storeQuery) return true;
  const q = loose(storeQuery);
  if (!q) return true;
  return loose(o.name).indexOf(q) >= 0
    || loose(o.key || o.id).indexOf(q) >= 0
    || loose(o.cat).indexOf(q) >= 0;
}
/* A bundle's members are not sold one at a time, so listing them as cards would be 1,686 buttons
   that cannot be pressed. They are reachable through the bundle instead — and once it is owned, the
   card expands to show every key, which is the only way to find `tile_0173` in a set of 400.

   The exception is a member that is FREE. The starter game is built from three tiles out of a
   400-tile set, and a student who wants to know what their own player sprite is called has to be
   able to find it — so those get a card of their own saying "Included". */
function storeSellable(a) { return !a.bundle || !!a.free; }

function priceTag(o) {
  return o.free ? '<span class="cost" style="color:var(--teal)"><span class="mdi mdi-check"></span>Free</span>'
    : '<span class="cost"><span class="mdi mdi-star"></span>' + o.cost + '</span>';
}
function buyButton(o, kind) {
  if (o.free) return '<span class="owned"><span class="mdi mdi-check-decagram"></span>Included</span>';
  if (state.unlocked[o.id]) return '<span class="owned"><span class="mdi mdi-check-decagram"></span>Owned</span>';
  return '<button class="gbtn" data-' + kind + '="' + o.id + '"><span class="mdi mdi-cart-outline"></span>Buy</button>';
}
function bundleCard(b) {
  const owned = b.free || !!state.unlocked[b.id];
  const open = storeOpenBundle === b.id;
  const strip = b.preview.map(function (f) {
    return '<img src="' + f + '" alt="" loading="lazy" decoding="async">';
  }).join('');
  /* Owned bundles can be opened to reveal the keys. Numbered tiles are unusable otherwise: a
     student who owns 400 of them still has to be able to find out that the ladder is tile_0089. */
  const contents = open
    ? '<div class="bundle-keys">' + b.members.map(function (k) {
        const m = assetByKey[k]; if (!m) return '';
        return '<button class="bk" data-key="' + k + '" title="' + k + '">'
          + (m.type === 'audio' ? '<span class="mdi mdi-volume-high"></span>'
             : '<img src="' + m.file + '" alt="" loading="lazy" decoding="async">')
          + '<span>' + k + '</span></button>';
      }).join('') + '</div>'
    : '';
  /* Pixel and 1-bit tiles are 16px square. Left at natural size in a 130px strip they read as
     nothing at all, so the strip scales them up and turns off smoothing — a blurred 16px tile is
     worse than a small one. */
  const px = (b.style === 'pixel' || b.style === '1-bit') ? ' pixel' : '';
  return '<div class="gcard bundle' + (open ? ' open' : '') + '">'
    + '<div class="art strip' + px + '">' + strip + '<span class="bcount">' + b.count + '</span></div>'
    + '<div class="body"><h3>' + b.name + '</h3>'
    + '<div class="tags"><span class="chip">' + b.cat + '</span><span class="chip set">'
    + b.count + ' pieces</span></div>'
    + '<p class="use">' + b.desc + '</p>'
    + '<div class="cta">' + priceTag(b) + buyButton(b, 'bundle')
    + (owned ? '<button class="gbtn ghost" data-openb="' + b.id + '">'
        + (open ? 'Hide the names' : 'Show the names') + '</button>' : '')
    + '</div>' + contents + '</div></div>';
}
function assetCard(a) {
  return '<div class="gcard">' + storeArt(a)
    + '<div class="body"><h3>' + a.name + '</h3>'
    + '<div class="tags"><span class="chip">' + a.cat + '</span><span class="chip key">' + a.key + '</span></div>'
    + '<p class="use">Use: <code>' + a.hint + '</code></p>'
    + '<div class="cta">' + priceTag(a) + buyButton(a, 'buy') + '</div></div></div>';
}
function renderStore() {
  const cats = ['All', 'Characters', 'Enemies', 'Collectibles', 'Tiles', 'Backgrounds', 'UI', 'Sounds'];
  const filterBar = cats.map(function (cx) {
    return '<button data-filter="' + cx + '"' + (cx === storeFilter ? ' class="on"' : '') + '>' + cx + '</button>';
  }).join('');
  const packBar = '<select id="packPick" aria-label="Which pack">'
    + '<option value="All">Every pack</option>'
    + packs.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === storePack ? ' selected' : '') + '>'
          + p.name + ' (' + p.count + ')</option>';
      }).join('') + '</select>';

  const inScope = function (o) {
    return (storeFilter === 'All' || o.cat === storeFilter)
      && (storePack === 'All' || o.pack === storePack)
      && matchesQuery(o);
  };
  /* Bundles first. A child looking at Characters should be offered "Character green — 9 pictures"
     before a hundred loose tiles, because the bundle is the thing that actually works. */
  const bs = bundles.filter(inScope);
  const as = assets.filter(function (a) { return storeSellable(a) && inScope(a); });
  const total = bs.length + as.length;
  const shown = [];
  bs.forEach(function (b) { if (shown.length < storeShown) shown.push(bundleCard(b)); });
  as.forEach(function (a) { if (shown.length < storeShown) shown.push(assetCard(a)); });

  const more = total > storeShown
    ? '<div class="store-more"><button class="gbtn" data-more="1">Show '
      + Math.min(STORE_PAGE, total - storeShown) + ' more</button>'
      + '<span class="dim">' + storeShown + ' of ' + total + '</span></div>'
    : '';
  const empty = total ? '' : '<p class="store-empty">Nothing matches that. Try a different word, '
    + 'or set the pack back to <b>Every pack</b>.</p>';

  return '<div class="phead"><div><h2><span class="mdi mdi-cart-outline"></span>Store</h2>'
    + '<p class="sub">Spend ★ Stars to unlock art &amp; sounds. Buy one, then use its <b>name</b> '
    + '(the green key) in your game — it loads automatically. Characters and enemies come as a set, '
    + 'because you need every picture to animate one.</p></div>'
    + '<span class="star-balance"><span class="mdi mdi-star"></span>' + state.stars + '</span></div>'
    + '<div class="store-filter">' + filterBar + '</div>'
    + '<div class="store-refine">' + packBar
    + '<input id="storeQ" type="search" placeholder="Search 3,000+ sprites and sounds…" value="'
    + esc(storeQuery) + '" aria-label="Search the store">'
    + '<span class="dim">' + total + ' result' + (total === 1 ? '' : 's') + '</span></div>'
    + empty
    + '<div class="cardgrid">' + shown.join('') + '</div>' + more;
}
function buyAsset(id) {
  const a = assets.find(function (x) { return x.id === id; });
  if (!a || a.free || state.unlocked[a.id]) return;
  if (state.stars < a.cost) { toast('Not enough Stars — you need ★ ' + a.cost + '.'); return; }
  modal({ title: 'Unlock "' + a.name + '"?', message: 'Costs ★ ' + a.cost + '. You can then use it in your game with the name "' + a.key + '". You have ★ ' + state.stars + '.', okLabel: 'Unlock it',
    onOk: function () {
      state.stars -= a.cost; state.unlocked[a.id] = true; saveState();
      /* Straight into the project. Buying one sprite is an unambiguous "I want this", and making
         them go and add it afterwards would be a second step with no decision in it. */
      if (typeof addProjectAssets === 'function') addProjectAssets(a.key);
      if (typeof refreshFiles === 'function') refreshFiles();
      toast('Unlocked ' + a.name + ' — use "' + a.key + '" in your game.'); showPage('store');
    } });
}
/* Unlocking the bundle unlocks everything in it — the members are not stamped individually, so
   ownership is answered by assetOwned() looking at the bundle. One flag rather than four hundred
   keeps saved state small and means a re-import that adds a tile to a set does not leave a student
   owning 399 of 400. */
function buyBundle(id) {
  const b = bundleById[id];
  if (!b || b.free || state.unlocked[b.id]) return;
  if (state.stars < b.cost) { toast('Not enough Stars — you need ★ ' + b.cost + '.'); return; }
  modal({ title: 'Unlock "' + b.name + '"?',
    message: 'Costs ★ ' + b.cost + ' and unlocks all ' + b.count + ' pieces at once. You have ★ ' + state.stars + '.',
    okLabel: 'Unlock it',
    onOk: function () {
      state.stars -= b.cost; state.unlocked[b.id] = true; saveState();
      /* What goes INTO the project depends on what kind of set it is, and the difference matters.
         A character is nine frames of one thing and all nine belong in the game — that is the whole
         reason it is a bundle. A 400-tile set is a library to pick from, and adding all of it would
         be 400 requests on every Run, so what goes in is the one sheet that holds the lot; the
         loose tiles stay available through + for anyone who wants them by name. */
      let msg = 'Unlocked ' + b.name + ' — ' + b.count + ' pieces.';
      if (typeof addProjectAssets === 'function') {
        if (b.sheet) {
          addProjectAssets(b.sheet);
          msg += ' Added to your project as one sheet: ' + b.sheet + '.';
        } else {
          addProjectAssets(b.members);
          msg += ' Added to your project.';
        }
      }
      if (typeof refreshFiles === 'function') refreshFiles();
      storeOpenBundle = b.id;         // straight to the names, which is what they need next
      toast(msg); showPage('store');
    } });
}

/* ---------- gallery (student games) ----------
   Four invented games by four invented students used to sit here — Neon Jumper by Ava R. and so on,
   with play counts. They made an empty gallery look busy, which is exactly the wrong trade: the
   whole point of this page is that the work on it is real, and a class works out fast that Ava R.
   is nobody. Every other claim the app makes gets cheaper the moment they do.
   An empty gallery that says "nothing here yet, go first" is both honest and a better offer —
   being first is a reason to publish, and a wall of fake hits is a reason not to bother. */
function renderGallery() {
  const mine = (state.published || []).map(function (p) {
    return { name: p.name, author: 'You', mdi: 'mdi-gamepad-variant', col: '#0f766e' };
  });
  const body = mine.length
    ? '<div class="cardgrid">' + mine.map(function (g) {
        return '<div class="scard"><div class="art" style="background:linear-gradient(135deg,' + g.col + ',#0b1a2e)"><span class="mdi ' + g.mdi + '"></span><div class="play"><span class="mdi mdi-play-circle"></span></div></div>'
          + '<div class="body"><div class="avatar" style="' + avatarStyle(g.author) + '">' + esc(g.author.charAt(0).toUpperCase()) + '</div>'
          + '<div class="meta"><h3>' + esc(g.name) + '</h3><div class="by">by ' + esc(g.author) + '</div></div>'
          + '</div></div>';
      }).join('') + '</div>'
    : '<div class="gempty"><span class="mdi mdi-view-grid-outline" aria-hidden="true"></span>'
      + '<h3>Nothing published yet</h3>'
      + '<p>When you publish a game it appears here for everyone else to play. Nobody has gone first.</p></div>';
  return '<div class="phead"><div><h2><span class="mdi mdi-view-grid"></span>Gallery</h2>'
    + '<p class="sub">Games students have published. Names show a first name and last initial only.</p></div>'
    + '<button class="gbtn" id="publishBtn"><span class="mdi mdi-upload"></span>Publish my game</button></div>'
    + body;
}
function publishGame() {
  modal({ title: 'Publish your game', message: 'Give your game a title to add it to the Gallery.', input: true, placeholder: 'My Awesome Game', okLabel: 'Publish',
    onOk: function (name) { if (!name) return; state.published = state.published || []; state.published.unshift({ name: name.trim(), date: Date.now() }); saveState(); toast('Published to the Gallery!'); showPage('gallery'); } });
}

/* ---------- leaderboards ----------
   One page, two jobs: where you stand against the class, and where you are in the course.

   These were briefly separated, and separating them was a mistake worth recording. The board came
   out, on the grounds that ranked leaderboards are the gamification element most often linked to
   demotivating the students at the bottom. What replaced it was a page of personal statistics that
   inlined the badge case — which the badge modal already showed — so the page repeated something
   the app had elsewhere while removing the one thing on it that made the course feel like a game.
   Trading a real motivator for a duplicate is a bad trade however good the citation is.

   So the board is back and it is the centre of the page. The course map and the badge summary sit
   in the rail beside it, where they add "how far through am I" without restating the badge case:
   the summary is two numbers and a button that opens the case that already exists.

   Two things are set up so the competition stays fun rather than becoming a running tally of who
   is worst, which is the part of the research worth keeping:

     This week is the DEFAULT view. A weekly board resets, so nobody accumulates a permanent
     position at the bottom and Monday is a fresh start for everyone. All-time is still one click
     away for anyone who wants the long view.

     The rail always shows the gap to the person one place above, never the distance to the top.
     "+240 XP to pass Ivy" is a target you can reach this afternoon; "3,500 XP behind first" is a
     reason to stop reading the page.

   The roster below is sample data. There is no backend yet, so a board needs someone on it to be
   worth looking at or testing; swap `sampleBoard` for the real class when there is one to fetch. */
const sampleBoard = [ // privacy-safe names (first name + last initial), like the Gallery
  { name: 'Ava R.', xp: 4200, week: 620, cls: true },
  { name: 'Leo M.', xp: 3850, week: 410, cls: true },
  { name: 'Ivy L.', xp: 3100, week: 540, cls: true },
  { name: 'Mia T.', xp: 2600, week: 900, cls: false },
  { name: 'Eli J.', xp: 2250, week: 480, cls: true },
  { name: 'Sam K.', xp: 1950, week: 300, cls: true },
  { name: 'Zoe W.', xp: 1500, week: 260, cls: false },
  { name: 'Kai P.', xp: 1200, week: 720, cls: false },
  { name: 'Max D.', xp: 980, week: 390, cls: true },
  { name: 'Noa B.', xp: 700, week: 150, cls: true }
];
let boardScope = 'class', boardRange = 'week';
function nfmt(n) { return Number(n).toLocaleString('en-US'); }

/* How far through the course, counted in lessons actually finished. */
function courseProgress() {
  let done = 0, total = 0;
  const mods = (course.modules || []).map(function (m, mi) {
    let d = 0;
    m.lessons.forEach(function (l, li) { total++; if (state.done[mi + '.' + li]) { d++; done++; } });
    return { name: m.name, accent: moduleAccent(mi), done: d, total: m.lessons.length };
  });
  return { done: done, total: total, mods: mods };
}

function renderBoard() {
  const hasXp = state.xp > 0;
  const me = { name: 'You', xp: state.xp, week: weekXp(), cls: true, you: true };
  let pool = sampleBoard.slice();
  if (boardScope === 'class') pool = pool.filter(function (r) { return r.cls; });
  const val = function (r) { return boardRange === 'week' ? r.week : r.xp; };
  const rows = (hasXp ? pool.concat([me]) : pool.slice()).sort(function (a, b) { return val(b) - val(a); });
  const max = val(rows[0]) || 1;
  const myIdx = rows.findIndex(function (r) { return r.you; });
  const myRank = myIdx + 1;

  const podMeta = [{ i: 1, c: 's', lbl: '2nd place' }, { i: 0, c: 'g p1', lbl: '1st place' }, { i: 2, c: 'b', lbl: '3rd place' }];
  const podium = '<div class="podium">' + podMeta.map(function (m) {
    const r = rows[m.i]; if (!r) return '';
    const lvl = Math.floor(r.xp / 1000) + 1;
    return '<div class="pod ' + m.c + (r.you ? ' you' : '') + '">'
      + '<span class="medal" role="img" aria-label="' + m.lbl + '"><span class="mdi mdi-medal"></span></span>'
      + '<div class="pod-av" style="' + avatarStyle(r.name) + '">' + r.name.charAt(0).toUpperCase() + '</div>'
      + '<div class="pod-nm">' + r.name + '</div><div class="pod-lv">Level ' + lvl + '</div>'
      + '<div class="pod-xp">' + nfmt(val(r)) + ' XP</div></div>';
  }).join('') + '</div>';

  const list = rows.map(function (r, i) {
    const medal = i === 0 ? 'g' : (i === 1 ? 's' : (i === 2 ? 'b' : ''));
    const lvl = Math.floor(r.xp / 1000) + 1;
    const pct = Math.round(val(r) / max * 100);
    return '<div class="lrow' + (r.you ? ' you' : '') + '">'
      + '<div class="rank ' + medal + '">' + (i + 1) + '</div>'
      + '<div class="avatar" style="' + avatarStyle(r.name) + '">' + r.name.charAt(0).toUpperCase() + '</div>'
      + '<div class="who"><div class="nm">' + r.name + '</div><div class="lv">Level ' + lvl + '</div>'
      + '<div class="lbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div></div>'
      + '<div class="xp">' + nfmt(val(r)) + ' XP</div></div>';
  }).join('');

  /* ---- the rail: you, then the course, then the badges ---- */
  let yourCard;
  if (hasXp) {
    const lvl = Math.floor(me.xp / 1000) + 1;
    const into = me.xp % 1000, toNext = 1000 - into, pctL = into / 10;
    /* The person one place ahead, never the leader. A gap you can close today is a reason to keep
       going; the distance to first place is a reason to close the page. */
    const ahead = myIdx > 0 ? rows[myIdx - 1] : null;
    const cap = ahead ? '+' + nfmt(val(ahead) - val(me)) + ' XP to pass ' + ahead.name : 'You’re in the lead 🎉';
    yourCard = '<div class="card yourcard">'
      + '<div class="yc-h"><span class="lbl">Your rank</span><span class="yc-xp">' + nfmt(val(me)) + ' XP</span></div>'
      + '<div class="yc-rank">#' + myRank + '</div>'
      + '<div class="yc-sub">Level ' + lvl + ' · ' + nfmt(toNext) + ' XP to Level ' + (lvl + 1) + '</div>'
      + '<div class="prog" role="progressbar" aria-valuenow="' + Math.round(pctL) + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pctL + '%"></div></div>'
      + '<div class="prog-cap">' + cap + '</div></div>';
  } else {
    /* Forward-looking, not an absence. "You're not on the board yet" was the first thing this page
       told a brand-new student about themselves. */
    yourCard = '<div class="card yourcard">'
      + '<div class="yc-h"><span class="lbl">Your rank</span></div>'
      + '<div class="yc-sub">One lesson puts you on the board. The weekly one resets on Monday, so everybody starts level.</div>'
      + '<button class="startbtn" data-start="1"><span class="mdi mdi-play-circle"></span>Start a lesson</button></div>';
  }

  const p = courseProgress();
  const map = p.mods.map(function (m) {
    return '<li class="pmod' + (m.done === m.total ? ' complete' : '') + '" style="--acc:' + m.accent + '">'
      + '<div class="pmod-hd"><b>' + esc(m.name) + '</b><span>' + m.done + '<i>/' + m.total + '</i></span></div>'
      + '<div class="pmod-bar" role="progressbar" aria-valuenow="' + m.done + '" aria-valuemin="0" aria-valuemax="' + m.total + '">'
      + '<i style="transform:scaleX(' + (m.total ? m.done / m.total : 0) + ')"></i></div></li>';
  }).join('');
  const courseCard = '<div class="card"><p class="psec">Where you are — ' + p.done + ' of ' + p.total + ' lessons</p>'
    + '<ul class="pmods">' + map + '</ul></div>';

  /* Two numbers and a button. The full case is a modal that already exists — drawing it here as
     well is how this page ended up repeating itself. */
  const allBadges = badgeGroups().reduce(function (a, g) { return a.concat(g.badges); }, []);
  const earned = allBadges.filter(function (b) { return hasBadge(b.name); }).length;
  const badgeCard = '<div class="card"><p class="psec">Badges</p>'
    + '<div class="badge-sum"><span class="bs-n">' + earned + '<i>/' + allBadges.length + '</i></span>'
    + '<span class="bs-bar"><i style="transform:scaleX(' + (allBadges.length ? earned / allBadges.length : 0) + ')"></i></span></div>'
    + '<button class="casebtn" data-case="1"><span class="mdi mdi-medal"></span>See all badges</button></div>';

  const stat = function (v, k, cls) { return '<div class="stat"><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div><div class="k">' + k + '</div></div>'; };
  const learners = pool.length + (hasXp ? 1 : 0);
  const classTotal = pool.reduce(function (s, r) { return s + val(r); }, 0) + (hasXp ? val(me) : 0);
  const stats = '<div class="card"><div class="statgrid">'
    + stat(nfmt(state.stars), 'Stars to spend', 'gold')
    + stat((state.published || []).length, 'Published', 'teal')
    + stat(learners, boardScope === 'class' ? 'In your class' : 'Learners', '')
    + stat(nfmt(classTotal), (boardScope === 'class' ? 'Class' : 'Total') + ' XP', '')
    + '</div></div>';

  const rail = '<div class="rail">' + yourCard + courseCard + badgeCard + stats + '</div>';

  const seg = function (attr, opts, cur) { return '<span class="seg" role="group">' + opts.map(function (o) { const on = cur === o[0]; return '<button data-' + attr + '="' + o[0] + '" aria-pressed="' + on + '"' + (on ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</span>'; };
  const controls = '<div class="board-controls">'
    + seg('bscope', [['class', 'My class'], ['all', 'Everyone']], boardScope)
    + seg('brange', [['week', 'This week'], ['all', 'All-time']], boardRange)
    + (hasXp ? '<span class="your-rank">Your rank <span class="r">#' + myRank + '</span></span>' : '')
    + '</div>';

  return '<div class="phead"><div><h2><span class="mdi mdi-podium"></span>Leaderboards</h2><p class="sub">'
    + (boardScope === 'class' ? 'Your class' : 'Everyone') + ' · ' + (boardRange === 'week' ? 'this week — resets Monday' : 'all-time')
    + '</p></div></div>'
    + '<div class="board">' + controls + podium + '<div class="lb-body"><div class="lb-list">' + list + '</div>' + rail + '</div></div>';
}

/* ---------- docs / help ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
const docSections = [
  { id: 'start', title: 'Getting started', mdi: 'mdi-flag-checkered', text: 'A Phaser game is built from a config object that sets the size, physics, and which scene runs.', code: 'const config = {\n  type: Phaser.AUTO,\n  width: 800, height: 600,\n  physics: { default: "arcade" },\n  scene: { create: create, update: update }\n};\nnew Phaser.Game(config);' },
  { id: 'scenes', title: 'Scenes: create & update', mdi: 'mdi-layers', text: 'create() runs once when the scene starts, so build your world there. update() runs every frame (about 60x a second) for movement and checks.', code: 'function create() {\n  // build the world once\n}\nfunction update() {\n  // runs every frame\n}' },
  { id: 'sprites', title: 'Sprites & images', mdi: 'mdi-shape', text: 'A sprite is a picture you can move and collide. The physics factory gives it a body so it can move and bump into things.', code: 'const player = this.physics.add.sprite(400, 300, "player");\nplayer.setCollideWorldBounds(true);' },
  { id: 'textures', title: 'Making textures', mdi: 'mdi-palette', text: 'No art files? Draw shapes with Graphics and turn them into a texture you can use as a sprite.', code: 'const g = this.make.graphics({ add: false });\ng.fillStyle(0xffd23f, 1);\ng.fillCircle(10, 10, 10);\ng.generateTexture("coin", 20, 20);' },
  { id: 'input', title: 'Keyboard & mouse', mdi: 'mdi-keyboard', text: 'Read the arrow keys, letter keys, or the pointer to control your game.', code: 'this.cursors = this.input.keyboard.createCursorKeys();\nthis.keys = this.input.keyboard.addKeys("A,D");\nthis.input.on("pointermove", (p) => { player.x = p.worldX; });' },
  { id: 'physics', title: 'Movement & physics', mdi: 'mdi-arrow-all', text: 'Arcade physics moves bodies by velocity (pixels per second). Bounce and world bounds keep things on screen.', code: 'player.setVelocityX(200);\nball.setBounce(1);\nball.setCollideWorldBounds(true);' },
  { id: 'collisions', title: 'Collisions & overlap', mdi: 'mdi-vector-intersection', text: 'overlap() tells you when two things touch (great for collecting). collider() also pushes them apart (great for walls and paddles).', code: 'this.physics.add.overlap(player, coins, grab, null, this);\nthis.physics.add.collider(ball, paddle);\nfunction grab(player, coin) { coin.destroy(); }' },
  { id: 'groups', title: 'Groups & spawning', mdi: 'mdi-group', text: 'A group holds many similar objects, like all the falling stars, so you can create and manage them together.', code: 'this.stars = this.physics.add.group();\nconst s = this.stars.create(x, -20, "star");\ns.setVelocityY(160);' },
  { id: 'text', title: 'Text & score', mdi: 'mdi-format-text', text: 'Show a score, lives, or messages with text objects, and update them any time with setText().', code: 'this.scoreText = this.add.text(16, 14, "Score: 0",\n  { fontFamily: "Arial", fontSize: "22px", color: "#ffffff" });\nthis.scoreText.setText("Score: " + score);' },
  { id: 'timers', title: 'Timers', mdi: 'mdi-timer-outline', text: 'Run code on a delay or on a loop, perfect for spawning enemies every so often.', code: 'this.time.addEvent({\n  delay: 750, loop: true,\n  callback: () => spawn(this)\n});' },
  { id: 'tweens', title: 'Tweens (smooth motion)', mdi: 'mdi-transition', text: 'Tweens smoothly change a value over time, great for pop, fade, and game feel.', code: 'this.tweens.add({\n  targets: label, y: label.y - 30, alpha: 0,\n  duration: 500\n});' }
];
function renderDocs() {
  const toc = docSections.map(function (d) { return '<a data-goto="' + d.id + '"><span class="mdi ' + d.mdi + '"></span>' + d.title + '</a>'; }).join('');
  const secs = docSections.map(function (d) { return '<div class="wiki-sec" id="doc-' + d.id + '"><h3><span class="mdi ' + d.mdi + '"></span>' + d.title + '</h3><p>' + d.text + '</p><pre>' + esc(d.code) + '</pre></div>'; }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-book-open-variant"></span>' + course.library + ' Docs</h2><p class="sub">A quick, beginner-friendly reference for ' + course.library + '.</p></div>'
    + '<a class="gbtn" href="https://docs.phaser.io/" target="_blank" rel="noopener"><span class="mdi mdi-open-in-new"></span>Full ' + course.library + ' docs</a></div>'
    + '<div class="wiki"><aside class="wiki-toc">' + toc + '</aside><div class="wiki-main">' + secs + '</div></div>';
}
function renderHelp() {
  return '<div class="phead"><div><h2><span class="mdi mdi-help-circle-outline"></span>Help — How this app works</h2><p class="sub">A quick guide to everything on screen.</p></div></div><div class="help-body">'
    + '<h3><span class="mdi mdi-navigation-variant"></span>The top bar</h3><p><b>Courses</b> is where you learn and build. <b>Store</b> sells art and sounds for ★ Stars. <b>Gallery</b> shows games students have published. <b>Leaderboards</b> ranks the class by XP and shows how far through the course you are. <b>Docs</b> is a quick ' + course.library + ' reference, and <b>Help</b> is this page.</p>'
    + '<h3><span class="mdi mdi-school"></span>Learning (Courses)</h3><p>Work through lessons in order in the left outline. Finishing a lesson earns <b>XP</b>; finishing a whole module earns <b>★ Stars</b>. Locked lessons unlock as you go, and your XP fills the bar in the footer toward the next level.</p>'
    + '<h3><span class="mdi mdi-view-split-vertical"></span>The three tabs</h3><p><b>Learn</b> is the lesson. <b>Code</b> is your game\'s code — the <b>source</b> folder holds your scripts and the <b>assets</b> folder holds the art and sounds you own (click one to see how to use it). <b>Save</b> keeps your changes and <b>Run</b> plays them. <b>Play</b> runs your game, with the console and sound controls underneath.</p>'
    + '<h3><span class="mdi mdi-robot"></span>The AI Assistant</h3><p>The panel on the right has two modes — click the icon in its header to switch. <b>Tutor</b> explains things and never touches your code, so ask it "what does this line do?". <b>Build</b> edits your game when you tell it what to change. Some lessons turn Build off on purpose so you try it yourself.</p>'
    + '<p>One thing Build will not do is the <b>Practice</b> exercise at the end of a lesson — it will give you a hint and send you to Tutor instead. That exercise is the only way you find out whether you can do it, so having it done for you costs you the answer to the one question worth asking. Everything else in your game, Build will happily build.</p>'
    + '<h3><span class="mdi mdi-star"></span>Stars & the Store</h3><p>Earn ★ Stars by finishing modules, then spend them in the <b>Store</b> to unlock art and sounds. Anything you own loads into your game automatically — just use its <b>name</b> (the green key) in your code.</p>'
    + '<h3><span class="mdi mdi-image-outline"></span>Picture credits</h3><p>Lessons show screenshots of real games and sprites drawn by other people. Hovering any picture in a lesson names who made it; this is the same list in one place.</p>'
    + '<div id="creditsList" class="credits-list"><p class="credits-loading">Loading…</p></div>'
    + '<h3><span class="mdi mdi-restart"></span>Testing</h3><p>Reset all saved progress (XP, Stars, unlocked assets, completed lessons) to try the app from scratch.</p>'
    + '<button class="gbtn" id="resetBtn"><span class="mdi mdi-delete-outline"></span>Reset my progress</button></div>';
}

/* The same credits the pictures carry, gathered in one place. The hover line on a figure is the
   attribution that travels with the picture; this is the durable copy, for anyone who wants to know
   what the course borrowed without hunting through 22 lessons for it — and for the eleven CC BY
   images, where naming the author is a licence condition rather than a courtesy.
   Built by the server from the lessons themselves (/api/credits), so it cannot fall behind them. */
function fillCredits() {
  const box = $('creditsList');
  if (!box) return;
  fetch('/api/credits')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); })
    .then(function (data) {
      const rows = (data && data.credits) || [];
      if (!rows.length) { box.innerHTML = '<p class="credits-loading">No pictures are credited yet.</p>'; return; }
      box.innerHTML = rows.map(function (c) {
        const count = c.pictures === 1 ? '1 picture' : c.pictures + ' pictures';
        return '<div class="credit-row"><div class="credit-who">' + esc(c.credit) + '</div>'
          + '<div class="credit-where">' + count + ' · ' + esc((c.lessons || []).join(' · ')) + '</div></div>';
      }).join('');
    })
    .catch(function () {
      /* Say where the credits still are rather than just failing: they are on every picture in
         every lesson whether this list loads or not. */
      box.innerHTML = '<p class="credits-loading">Could not load the list. Every picture still names'
        + ' its author when you hover it in the lesson.</p>';
    });
}
/* ---------- the trophy case ----------
   Shows every badge in the course, not only the earned ones. A case with no empty slots tells a
   student nothing about what is still there to get, and the empty slots are most of the point —
   each one names the lesson that awards it, so it reads as a map rather than a scoreboard.
   Locked rows deliberately do NOT say how to earn it beyond the lesson name: that is the lesson's
   job, and spoiling it here would make the your-turn step redundant. */
/* Every badge name ends in "badge", and repeating that 22 times inside a panel headed "Your
   badges" is 22 words of noise. Stripped for display only — the stored key keeps the full name. */
function badgeShortName(name) { return String(name).replace(/\s*badges?\s*$/i, '').trim() || String(name); }

function badgeGroups() {
  return course.modules.map(function (m, mi) {
    const badges = [];
    m.lessons.forEach(function (l, li) {
      if (l.reward) badges.push({ name: l.reward, lesson: l.t, id: mi + '.' + li });
    });
    return { name: m.name, accent: moduleAccent(mi), badges: badges };
  }).filter(function (g) { return g.badges.length; });
}

function renderBadgeCase() {
  const groups = badgeGroups();
  const all = groups.reduce(function (a, g) { return a.concat(g.badges); }, []);
  if (!all.length) return '<p class="case-none">This course has no badges in it yet.</p>';

  const earned = all.filter(function (b) { return hasBadge(b.name); }).length;

  /* Grouped by module rather than listed flat. Twenty-two identical rows in one column tells a
     student nothing about shape or progress; a module with three of four filled tells them
     exactly where they are and what is one step away. */
  const sections = groups.map(function (g) {
    const got = g.badges.filter(function (b) { return hasBadge(b.name); }).length;
    const tiles = g.badges.map(function (b) {
      const has = hasBadge(b.name);
      return '<li class="case-badge' + (has ? ' got' : '') + '">'
        + '<span class="case-ico mdi ' + (has ? 'mdi-medal' : 'mdi-lock') + '" aria-hidden="true"></span>'
        + '<span class="case-txt">'
        + '<b>' + esc(badgeShortName(b.name)) + '</b>'
        // Locked names the lesson that awards it, so the case reads as a map. It stops there:
        // HOW to earn it is the lesson's job, and saying it here makes the lesson redundant.
        + '<span class="case-sub">' + esc(has ? 'Earned' : b.lesson) + '</span>'
        + '</span>'
        + '<span class="sr-only">' + (has ? ' (earned)' : ' (not earned yet)') + '</span>'
        + '</li>';
    }).join('');
    return '<section class="case-mod' + (got === g.badges.length ? ' complete' : '') + '"'
      + ' style="--acc:' + g.accent + '">'
      + '<header class="case-mod-hd">'
      + '<h4>' + esc(g.name) + '</h4>'
      + '<span class="case-mod-n">' + got + '<span>/' + g.badges.length + '</span></span>'
      + '</header>'
      + '<ul class="case-grid">' + tiles + '</ul>'
      + '</section>';
  }).join('');

  return '<div class="case-top">'
    + '<div class="case-score"><b>' + earned + '</b><span>of ' + all.length + ' earned</span></div>'
    + '<div class="case-bar" role="progressbar" aria-valuenow="' + earned + '" aria-valuemin="0" aria-valuemax="' + all.length + '">'
    + '<i style="transform:scaleX(' + (earned / all.length) + ')"></i></div>'
    + '</div>'
    + '<p class="case-note">Badges come from doing a technique in <b>your own game</b>.</p>'
    + '<div class="case-body">' + sections + '</div>';
}
function showBadgeCase() {
  modal({ title: 'Your badges', html: renderBadgeCase(), okLabel: 'Close', hideCancel: true, wide: true });
}
if ($('badgeBtn')) $('badgeBtn').addEventListener('click', showBadgeCase);

function resetProgress() {
  modal({ title: 'Reset progress?', message: 'This clears all XP, Stars, unlocked assets, and completed lessons on this browser. This cannot be undone.', okLabel: 'Reset everything',
    onOk: function () { Storage.remove(SKEY); location.reload(); } });
}
function wirePage(page) {
  document.querySelectorAll('#page [data-buy]').forEach(function (b) { b.addEventListener('click', function () { buyAsset(b.getAttribute('data-buy')); }); });
  document.querySelectorAll('#page [data-filter]').forEach(function (b) { b.addEventListener('click', function () { storeFilter = b.getAttribute('data-filter'); storeShown = STORE_PAGE; showPage('store'); }); });
  document.querySelectorAll('#page [data-bundle]').forEach(function (b) { b.addEventListener('click', function () { buyBundle(b.getAttribute('data-bundle')); }); });
  document.querySelectorAll('#page [data-openb]').forEach(function (b) { b.addEventListener('click', function () { const id = b.getAttribute('data-openb'); storeOpenBundle = (storeOpenBundle === id) ? null : id; showPage('store'); }); });
  /* Clicking a key copies it, because the next thing the student does with it is type it into their
     game, and `tile_0173` is exactly the kind of thing that gets mistyped. */
  document.querySelectorAll('#page [data-key]').forEach(function (b) { b.addEventListener('click', function () { const k = b.getAttribute('data-key'); try { navigator.clipboard.writeText(k); toast('Copied "' + k + '"'); } catch (e) { toast('Its name is "' + k + '"'); } }); });
  document.querySelectorAll('#page [data-more]').forEach(function (b) { b.addEventListener('click', function () { storeShown += STORE_PAGE; showPage('store'); }); });
  if (page === 'store') {
    const pk = $('packPick');
    if (pk) pk.addEventListener('change', function () { storePack = pk.value; storeShown = STORE_PAGE; showPage('store'); });
    const q = $('storeQ');
    /* Re-rendering on every keystroke rebuilds up to 120 cards, so it waits for a pause. The cursor
       is put back at the end because showPage() replaces the input along with everything else. */
    if (q) {
      let t = 0;
      q.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          storeQuery = q.value.trim(); storeShown = STORE_PAGE; showPage('store');
          const n = $('storeQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
        }, 220);
      });
    }
  }
  document.querySelectorAll('#page [data-play]').forEach(function (b) { b.addEventListener('click', function () { const a = assets.find(function (x) { return x.id === b.getAttribute('data-play'); }); if (a) { try { new Audio('/' + a.file).play(); } catch (e) {} } }); });
  if (page === 'gallery') { var pb = $('publishBtn'); if (pb) pb.addEventListener('click', publishGame); }
  if (page === 'leaderboards') {
    document.querySelectorAll('#page [data-bscope]').forEach(function (b) { b.addEventListener('click', function () { boardScope = b.getAttribute('data-bscope'); showPage('leaderboards'); }); });
    document.querySelectorAll('#page [data-brange]').forEach(function (b) { b.addEventListener('click', function () { boardRange = b.getAttribute('data-brange'); showPage('leaderboards'); }); });
    document.querySelectorAll('#page [data-start]').forEach(function (b) { b.addEventListener('click', function () { showPage('courses'); switchView('learn'); }); });
    document.querySelectorAll('#page [data-case]').forEach(function (b) { b.addEventListener('click', showBadgeCase); });
  }
  if (page === 'help') { var rb = $('resetBtn'); if (rb) rb.addEventListener('click', resetProgress); fillCredits(); }
  if (page === 'docs') { document.querySelectorAll('#page [data-goto]').forEach(function (link) { link.addEventListener('click', function (e) { e.preventDefault(); var el = document.getElementById('doc-' + link.getAttribute('data-goto')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }
}
