/* pages.js — Full-page views outside the editor: Store, Gallery, Leaderboards, Docs and Help, plus the top-bar router. */
/* ---------- page router ---------- */
function showPage(page) {
  // The lab makes the top bar inert while it is open, so this should be unreachable then. Belt
  // and braces: leaving the bench on top of the Store would be baffling and hard to get out of.
  if (typeof openLabRef !== 'undefined' && openLabRef) closeLab();
  document.querySelectorAll('.navitem').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-page') === page); });
  if (page === 'courses') {
    $('editor').hidden = false; $('page').hidden = true;
    /* Restart the game if Play is the tab we are coming back to.
       Leaving for any full page calls stopGame() below, which drops the iframe's srcdoc — but the
       Play TAB stays selected inside the hidden editor. So without this, a student on Play who looks
       at the Store and comes back finds an empty stage, and nothing on screen suggests why or offers
       a way to fix it. The console toggle appeared to be the culprit only because resizing a blank
       frame is when you notice it is blank. */
    if (!$('view-play').hidden && typeof startGame === 'function') startGame();
    updateFab(); return;
  }
  stopGame(); $('editor').hidden = true; $('page').hidden = false;
  const pg = $('page');
  if (page === 'store') pg.innerHTML = renderStore();
  else if (page === 'gallery') pg.innerHTML = renderGallery();
  else if (page === 'leaderboards') pg.innerHTML = renderBoard();
  else if (page === 'docs') pg.innerHTML = renderDocs();
  else if (page === 'help') pg.innerHTML = renderHelp();
  wirePage(page);
  updateFab();
}
document.querySelectorAll('.navitem').forEach(function (b) { b.addEventListener('click', function () { showPage(b.getAttribute('data-page')); }); });

/* ---------- asset store (spend Stars to unlock real Phaser assets; owned ones auto-preload by key) ---------- */
const assets = window.STORE_ASSETS || [];
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
let storeFilter = 'All';
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
function renderStore() {
  const cats = ['All', 'Characters', 'Enemies', 'Collectibles', 'Tiles', 'Backgrounds', 'UI', 'Sounds'];
  const filterBar = cats.map(function (cx) { return '<button data-filter="' + cx + '"' + (cx === storeFilter ? ' class="on"' : '') + '>' + cx + '</button>'; }).join('');
  const list = assets.filter(function (a) { return storeFilter === 'All' || a.cat === storeFilter; });
  const cards = list.map(function (a) {
    const owned = a.free || !!state.unlocked[a.id];
    const btn = a.free ? '<span class="owned"><span class="mdi mdi-check-decagram"></span>Included</span>'
      : (owned ? '<span class="owned"><span class="mdi mdi-check-decagram"></span>Owned</span>'
      : '<button class="gbtn" data-buy="' + a.id + '"><span class="mdi mdi-cart-outline"></span>Buy</button>');
    const price = a.free ? '<span class="cost" style="color:var(--teal)"><span class="mdi mdi-check"></span>Free</span>'
      : '<span class="cost"><span class="mdi mdi-star"></span>' + a.cost + '</span>';
    return '<div class="gcard">' + storeArt(a)
      + '<div class="body"><h3>' + a.name + '</h3>'
      + '<div class="tags"><span class="chip">' + a.cat + '</span><span class="chip key">' + a.key + '</span></div>'
      + '<p class="use">Use: <code>' + a.hint + '</code></p>'
      + '<div class="cta">' + price + btn + '</div></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-cart-outline"></span>Store</h2><p class="sub">Spend ★ Stars to unlock art &amp; sounds. Buy one, then use its <b>name</b> (the green key) in your game — it loads automatically.</p></div><span class="star-balance"><span class="mdi mdi-star"></span>' + state.stars + '</span></div>'
    + '<div class="store-filter">' + filterBar + '</div>'
    + '<div class="cardgrid">' + cards + '</div>';
}
function buyAsset(id) {
  const a = assets.find(function (x) { return x.id === id; });
  if (!a || a.free || state.unlocked[a.id]) return;
  if (state.stars < a.cost) { toast('Not enough Stars — you need ★ ' + a.cost + '.'); return; }
  modal({ title: 'Unlock "' + a.name + '"?', message: 'Costs ★ ' + a.cost + '. You can then use it in your game with the name "' + a.key + '". You have ★ ' + state.stars + '.', okLabel: 'Unlock it',
    onOk: function () {
      state.stars -= a.cost; state.unlocked[a.id] = true; saveState();
      toast('Unlocked ' + a.name + ' — use "' + a.key + '" in your game.'); showPage('store');
    } });
}

/* ---------- gallery (student games) ---------- */
const sampleGallery = [
  { name: 'Neon Jumper', author: 'Ava R.', mdi: 'mdi-rocket', col: '#2b6cb0', plays: 214 },
  { name: 'Bug Squash', author: 'Leo M.', mdi: 'mdi-bug', col: '#276749', plays: 187 },
  { name: 'Cloud Hopper', author: 'Mia T.', mdi: 'mdi-cloud', col: '#6b46c1', plays: 143 },
  { name: 'Laser Cats', author: 'Sam K.', mdi: 'mdi-cat', col: '#9b2c2c', plays: 98 }
];
function renderGallery() {
  const mine = (state.published || []).map(function (p) { return { name: p.name, author: 'You', mdi: 'mdi-gamepad-variant', col: '#0f766e', plays: 0 }; });
  const all = mine.concat(sampleGallery);
  const cards = all.map(function (g) {
    return '<div class="scard"><div class="art" style="background:linear-gradient(135deg,' + g.col + ',#0b1a2e)"><span class="mdi ' + g.mdi + '"></span><div class="play"><span class="mdi mdi-play-circle"></span></div></div>'
      + '<div class="body"><div class="avatar" style="' + avatarStyle(g.author) + '">' + esc(g.author.charAt(0).toUpperCase()) + '</div>'
      + '<div class="meta"><h3>' + esc(g.name) + '</h3><div class="by">by ' + esc(g.author) + '</div></div>'
      + '<span class="stat"><span class="mdi mdi-play"></span>' + g.plays + '</span></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-view-grid"></span>Gallery</h2><p class="sub">Games students have published. Names show a first name and last initial only.</p></div><button class="gbtn" id="publishBtn"><span class="mdi mdi-upload"></span>Publish my game</button></div><div class="cardgrid">' + cards + '</div>';
}
function publishGame() {
  modal({ title: 'Publish your game', message: 'Give your game a title to add it to the Gallery.', input: true, placeholder: 'My Awesome Game', okLabel: 'Publish',
    onOk: function (name) { if (!name) return; state.published = state.published || []; state.published.unshift({ name: name.trim(), date: Date.now() }); saveState(); toast('Published to the Gallery!'); showPage('gallery'); } });
}

/* ---------- leaderboards ---------- */
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
let boardScope = 'class', boardRange = 'all';
function nfmt(n) { return Number(n).toLocaleString('en-US'); }
function renderBoard() {
  const hasXp = state.xp > 0;
  const me = { name: 'You', xp: state.xp, week: state.xp, cls: true, you: true };
  let pool = sampleBoard.slice();
  if (boardScope === 'class') pool = pool.filter(function (r) { return r.cls; });
  const val = function (r) { return boardRange === 'week' ? r.week : r.xp; };
  let rows = (hasXp ? pool.concat([me]) : pool.slice()).sort(function (a, b) { return val(b) - val(a); });
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

  const learners = pool.length + (hasXp ? 1 : 0);
  const classTotal = pool.reduce(function (s, r) { return s + val(r); }, 0) + (hasXp ? val(me) : 0);
  let yourCard;
  if (hasXp) {
    const lvl = Math.floor(me.xp / 1000) + 1;
    const into = me.xp % 1000, toNext = 1000 - into, pctL = into / 10;
    const ahead = myIdx > 0 ? rows[myIdx - 1] : null;
    const cap = ahead ? '+' + nfmt(val(ahead) - val(me)) + ' XP to pass ' + ahead.name : "You’re in the lead 🎉";
    yourCard = '<div class="card yourcard">'
      + '<div class="yc-h"><span class="lbl">Your rank</span><span class="yc-xp">' + nfmt(val(me)) + ' XP</span></div>'
      + '<div class="yc-rank">#' + myRank + '</div>'
      + '<div class="yc-sub">Level ' + lvl + ' · ' + nfmt(toNext) + ' XP to Level ' + (lvl + 1) + '</div>'
      + '<div class="prog" role="progressbar" aria-valuenow="' + Math.round(pctL) + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pctL + '%"></div></div>'
      + '<div class="prog-cap">' + cap + '</div></div>';
  } else {
    yourCard = '<div class="card yourcard">'
      + '<div class="yc-h"><span class="lbl">Your rank</span></div>'
      + '<div class="yc-sub">You’re not on the board yet. Finish your first lesson to earn XP and claim a spot.</div>'
      + '<button class="startbtn" data-start="1"><span class="mdi mdi-play-circle"></span>Start a lesson</button></div>';
  }
  const stat = function (v, k, cls) { return '<div class="stat"><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div><div class="k">' + k + '</div></div>'; };
  const stats = '<div class="card"><div class="statgrid">'
    + stat(hasXp ? '#' + myRank : '—', 'Your rank', 'gold')
    + stat(nfmt(val(me)), 'Your ' + (boardRange === 'week' ? 'weekly ' : '') + 'XP', 'teal')
    + stat(learners, boardScope === 'class' ? 'In your class' : 'Learners', '')
    + stat(nfmt(classTotal), (boardScope === 'class' ? 'Class' : 'Total') + ' XP', '')
    + '</div></div>';
  const rail = '<div class="rail">' + yourCard + stats + '</div>';

  const seg = function (attr, opts, cur) { return '<span class="seg" role="group">' + opts.map(function (o) { const on = cur === o[0]; return '<button data-' + attr + '="' + o[0] + '" aria-pressed="' + on + '"' + (on ? ' class="on"' : '') + '>' + o[1] + '</button>'; }).join('') + '</span>'; };
  const controls = '<div class="board-controls">' + seg('bscope', [['class', 'My class'], ['all', 'Everyone']], boardScope) + seg('brange', [['all', 'All-time'], ['week', 'This week']], boardRange) + '</div>';

  return '<div class="phead"><div><h2><span class="mdi mdi-podium"></span>Leaderboards</h2><p class="sub">' + (boardScope === 'class' ? 'Your class' : 'Everyone') + ' · ' + (boardRange === 'week' ? 'this week' : 'all-time') + '</p></div></div>'
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
    + '<h3><span class="mdi mdi-navigation-variant"></span>The top bar</h3><p><b>Courses</b> is where you learn and build. <b>Store</b> sells art and sounds for ★ Stars. <b>Gallery</b> shows games students have published. <b>Leaderboards</b> ranks everyone by XP. <b>Docs</b> is a quick ' + course.library + ' reference, and <b>Help</b> is this page.</p>'
    + '<h3><span class="mdi mdi-school"></span>Learning (Courses)</h3><p>Work through lessons in order in the left outline. Finishing a lesson earns <b>XP</b>; finishing a whole module earns <b>★ Stars</b>. Locked lessons unlock as you go, and your XP fills the bar in the footer toward the next level.</p>'
    + '<h3><span class="mdi mdi-view-split-vertical"></span>The three tabs</h3><p><b>Learn</b> is the lesson. <b>Code</b> is your game\'s code — the <b>source</b> folder holds your scripts and the <b>assets</b> folder holds the art and sounds you own (click one to see how to use it). <b>Save</b> keeps your changes and <b>Run</b> plays them. <b>Play</b> runs your game, with the console and sound controls underneath.</p>'
    + '<h3><span class="mdi mdi-robot"></span>The AI Assistant</h3><p>The panel on the right has two modes — click the icon in its header to switch. <b>Tutor</b> explains things and never touches your code, so ask it "what does this line do?". <b>Build</b> edits your game when you tell it what to change. Some lessons turn Build off on purpose so you try it yourself.</p>'
    + '<h3><span class="mdi mdi-star"></span>Stars & the Store</h3><p>Earn ★ Stars by finishing modules, then spend them in the <b>Store</b> to unlock art and sounds. Anything you own loads into your game automatically — just use its <b>name</b> (the green key) in your code.</p>'
    + '<h3><span class="mdi mdi-restart"></span>Testing</h3><p>Reset all saved progress (XP, Stars, unlocked assets, completed lessons) to try the app from scratch.</p>'
    + '<button class="gbtn" id="resetBtn"><span class="mdi mdi-delete-outline"></span>Reset my progress</button></div>';
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
    + '<p class="case-note">Badges come from doing a technique in <b>your own game</b>. Stars cannot buy them.</p>'
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
  document.querySelectorAll('#page [data-filter]').forEach(function (b) { b.addEventListener('click', function () { storeFilter = b.getAttribute('data-filter'); showPage('store'); }); });
  document.querySelectorAll('#page [data-play]').forEach(function (b) { b.addEventListener('click', function () { const a = assets.find(function (x) { return x.id === b.getAttribute('data-play'); }); if (a) { try { new Audio('/' + a.file).play(); } catch (e) {} } }); });
  if (page === 'gallery') { var pb = $('publishBtn'); if (pb) pb.addEventListener('click', publishGame); }
  if (page === 'leaderboards') {
    document.querySelectorAll('#page [data-bscope]').forEach(function (b) { b.addEventListener('click', function () { boardScope = b.getAttribute('data-bscope'); showPage('leaderboards'); }); });
    document.querySelectorAll('#page [data-brange]').forEach(function (b) { b.addEventListener('click', function () { boardRange = b.getAttribute('data-brange'); showPage('leaderboards'); }); });
    document.querySelectorAll('#page [data-start]').forEach(function (b) { b.addEventListener('click', function () { showPage('courses'); switchView('learn'); }); });
  }
  if (page === 'help') { var rb = $('resetBtn'); if (rb) rb.addEventListener('click', resetProgress); }
  if (page === 'docs') { document.querySelectorAll('#page [data-goto]').forEach(function (link) { link.addEventListener('click', function (e) { e.preventDefault(); var el = document.getElementById('doc-' + link.getAttribute('data-goto')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }
}
