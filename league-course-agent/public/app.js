/* LEAGUE Game Dev — front end (prototype). Progress saved in localStorage. */

/* ================= example games (loaded into game.js when opened) ================= */
const STAR_CODE = `// game.js - Star Catcher
const CONFIG = { fallSpeed: 160, bombChance: 0.15, paddleWidth: 100, spawnEvery: 750, starPoints: 10 };
const WIDTH = 800, HEIGHT = 600;
function drawStar(g, cx, cy, spikes, outer, inner) {
  let rot = -Math.PI / 2; const step = Math.PI / spikes;
  g.beginPath(); g.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < spikes; i++) { rot += step; g.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step; g.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); }
  g.closePath(); g.fillPath();
}
function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x35c2f5, 1); g.fillRoundedRect(0, 0, CONFIG.paddleWidth, 24, 10); g.generateTexture('player', CONFIG.paddleWidth, 24); g.clear();
  g.fillStyle(0xffd23f, 1); drawStar(g, 17, 17, 5, 16, 8); g.generateTexture('star', 34, 34); g.clear();
  g.fillStyle(0xe94b4b, 1); g.fillCircle(16, 18, 13); g.generateTexture('bomb', 34, 34); g.destroy();
}
function create() {
  const scene = this; buildTextures(scene);
  scene.score = 0; scene.lives = 3; scene.isOver = false;
  scene.player = scene.physics.add.sprite(WIDTH / 2, HEIGHT - 40, 'player'); scene.player.setCollideWorldBounds(true);
  scene.stars = scene.physics.add.group(); scene.bombs = scene.physics.add.group();
  scene.physics.add.overlap(scene.player, scene.stars, collectStar, null, scene);
  scene.physics.add.overlap(scene.player, scene.bombs, hitBomb, null, scene);
  scene.cursors = scene.input.keyboard.createCursorKeys(); scene.keys = scene.input.keyboard.addKeys('A,D');
  scene.input.on('pointermove', function (p) { if (!scene.isOver) scene.player.x = Phaser.Math.Clamp(p.worldX, CONFIG.paddleWidth / 2, WIDTH - CONFIG.paddleWidth / 2); });
  scene.input.on('pointerdown', function () { if (scene.isOver) scene.scene.restart(); });
  scene.scoreText = scene.add.text(16, 14, 'Score: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#eaf1f8' }).setDepth(10);
  scene.livesText = scene.add.text(WIDTH - 16, 14, 'Lives: 3', { fontFamily: 'Arial', fontSize: '22px', color: '#f5b02e' }).setOrigin(1, 0).setDepth(10);
  scene.time.addEvent({ delay: CONFIG.spawnEvery, loop: true, callback: function () { if (!scene.isOver) spawnObject(scene); } });
  postStats(scene);
}
function update() {
  const scene = this; if (scene.isOver) return;
  scene.player.setVelocityX(0);
  if (scene.cursors.left.isDown || scene.keys.A.isDown) scene.player.setVelocityX(-520);
  else if (scene.cursors.right.isDown || scene.keys.D.isDown) scene.player.setVelocityX(520);
  const clean = function (grp) { grp.children.iterate(function (o) { if (o && o.y > HEIGHT + 40) o.destroy(); }); };
  clean(scene.stars); clean(scene.bombs);
}
function spawnObject(scene) {
  const x = Phaser.Math.Between(30, WIDTH - 30); const fall = CONFIG.fallSpeed + scene.score * 1.2;
  if (Math.random() < CONFIG.bombChance) { const b = scene.bombs.create(x, -20, 'bomb'); b.setVelocityY(fall * 0.95); b.setAngularVelocity(120); }
  else { const s = scene.stars.create(x, -20, 'star'); s.setVelocityY(fall); s.setAngularVelocity(180); }
}
function collectStar(player, star) { star.destroy(); this.score += CONFIG.starPoints; this.scoreText.setText('Score: ' + this.score); postStats(this); }
function hitBomb(player, bomb) {
  bomb.destroy(); this.lives -= 1; this.livesText.setText('Lives: ' + this.lives); this.cameras.main.shake(160, 0.01); postStats(this);
  if (this.lives <= 0) { this.isOver = true; this.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x0b1a2e, 0.8).setDepth(20); this.add.text(WIDTH/2, HEIGHT/2 - 20, 'Game Over', { fontFamily: 'Arial', fontSize: '52px', color: '#eaf1f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21); this.add.text(WIDTH/2, HEIGHT/2 + 40, 'Click to play again', { fontFamily: 'Arial', fontSize: '18px', color: '#7c93ae' }).setOrigin(0.5).setDepth(21); }
}
function postStats(scene) { try { if (window.parent) window.parent.postMessage({ type: 'stats', score: scene.score, lives: scene.lives }, '*'); } catch (e) {} }
`;

const SKY_CODE = `// game.js - Sky Dodge
const CONFIG = { fallSpeed: 180, spawnEvery: 600, paddleWidth: 90, blockSize: 30 };
const WIDTH = 800, HEIGHT = 600;
function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x2fd0b6, 1); g.fillRoundedRect(0, 0, CONFIG.paddleWidth, 22, 8); g.generateTexture('ship', CONFIG.paddleWidth, 22); g.clear();
  g.fillStyle(0x3e8fd6, 1); g.fillRoundedRect(0, 0, CONFIG.blockSize, CONFIG.blockSize, 5); g.generateTexture('block', CONFIG.blockSize, CONFIG.blockSize); g.destroy();
}
function create() {
  const scene = this; buildTextures(scene);
  scene.score = 0; scene.lives = 3; scene.isOver = false;
  scene.player = scene.physics.add.sprite(WIDTH / 2, HEIGHT - 36, 'ship'); scene.player.setCollideWorldBounds(true);
  scene.blocks = scene.physics.add.group();
  scene.physics.add.overlap(scene.player, scene.blocks, hitBlock, null, scene);
  scene.cursors = scene.input.keyboard.createCursorKeys(); scene.keys = scene.input.keyboard.addKeys('A,D');
  scene.input.on('pointermove', function (p) { if (!scene.isOver) scene.player.x = Phaser.Math.Clamp(p.worldX, CONFIG.paddleWidth / 2, WIDTH - CONFIG.paddleWidth / 2); });
  scene.input.on('pointerdown', function () { if (scene.isOver) scene.scene.restart(); });
  scene.scoreText = scene.add.text(16, 14, 'Dodged: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#eaf1f8' }).setDepth(10);
  scene.livesText = scene.add.text(WIDTH - 16, 14, 'Lives: 3', { fontFamily: 'Arial', fontSize: '22px', color: '#f5b02e' }).setOrigin(1, 0).setDepth(10);
  scene.time.addEvent({ delay: CONFIG.spawnEvery, loop: true, callback: function () { if (!scene.isOver) spawnBlock(scene); } });
  postStats(scene);
}
function update() {
  const scene = this; if (scene.isOver) return;
  scene.player.setVelocityX(0);
  if (scene.cursors.left.isDown || scene.keys.A.isDown) scene.player.setVelocityX(-520);
  else if (scene.cursors.right.isDown || scene.keys.D.isDown) scene.player.setVelocityX(520);
  scene.blocks.children.iterate(function (b) { if (b && b.y > HEIGHT + 30) { b.destroy(); scene.score += 1; scene.scoreText.setText('Dodged: ' + scene.score); postStats(scene); } });
}
function spawnBlock(scene) {
  const x = Phaser.Math.Between(20, WIDTH - 20); const b = scene.blocks.create(x, -20, 'block');
  b.setVelocityY(CONFIG.fallSpeed + scene.score * 2); b.setAngularVelocity(60);
}
function hitBlock(player, block) {
  block.destroy(); this.lives -= 1; this.livesText.setText('Lives: ' + this.lives); this.cameras.main.shake(160, 0.01); postStats(this);
  if (this.lives <= 0) { this.isOver = true; this.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x0b1a2e, 0.8).setDepth(20); this.add.text(WIDTH/2, HEIGHT/2 - 20, 'Game Over', { fontFamily: 'Arial', fontSize: '52px', color: '#eaf1f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21); this.add.text(WIDTH/2, HEIGHT/2 + 40, 'Click to play again', { fontFamily: 'Arial', fontSize: '18px', color: '#7c93ae' }).setOrigin(0.5).setDepth(21); }
}
function postStats(scene) { try { if (window.parent) window.parent.postMessage({ type: 'stats', score: scene.score, lives: scene.lives }, '*'); } catch (e) {} }
`;

const COIN_CODE = `// game.js - Coin Rush
const CONFIG = { speed: 300, coins: 6, seconds: 30 };
const WIDTH = 800, HEIGHT = 600;
function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x35c2f5, 1); g.fillCircle(16, 16, 15); g.generateTexture('hero', 32, 32); g.clear();
  g.fillStyle(0xffd23f, 1); g.fillCircle(11, 11, 10); g.generateTexture('coin', 22, 22); g.destroy();
}
function placeCoin(c) { c.setPosition(Phaser.Math.Between(30, WIDTH - 30), Phaser.Math.Between(70, HEIGHT - 30)); }
function create() {
  const scene = this; buildTextures(scene);
  scene.score = 0; scene.timeLeft = CONFIG.seconds; scene.isOver = false;
  scene.hero = scene.physics.add.sprite(WIDTH / 2, HEIGHT / 2, 'hero'); scene.hero.setCollideWorldBounds(true);
  scene.coins = scene.physics.add.group();
  for (let i = 0; i < CONFIG.coins; i++) { const c = scene.coins.create(0, 0, 'coin'); placeCoin(c); }
  scene.physics.add.overlap(scene.hero, scene.coins, function (h, c) { placeCoin(c); scene.score += 1; scene.scoreText.setText('Coins: ' + scene.score); postStats(scene); }, null, scene);
  scene.cursors = scene.input.keyboard.createCursorKeys(); scene.keys = scene.input.keyboard.addKeys('W,A,S,D');
  scene.input.on('pointerdown', function () { if (scene.isOver) scene.scene.restart(); });
  scene.scoreText = scene.add.text(16, 14, 'Coins: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#eaf1f8' }).setDepth(10);
  scene.timeText = scene.add.text(WIDTH - 16, 14, 'Time: ' + scene.timeLeft, { fontFamily: 'Arial', fontSize: '22px', color: '#f5b02e' }).setOrigin(1, 0).setDepth(10);
  scene.time.addEvent({ delay: 1000, loop: true, callback: function () { if (scene.isOver) return; scene.timeLeft -= 1; scene.timeText.setText('Time: ' + Math.max(0, scene.timeLeft)); postStats(scene); if (scene.timeLeft <= 0) endGame(scene); } });
  postStats(scene);
}
function update() {
  const scene = this; if (scene.isOver) return; const s = CONFIG.speed; let vx = 0, vy = 0;
  if (scene.cursors.left.isDown || scene.keys.A.isDown) vx = -s; else if (scene.cursors.right.isDown || scene.keys.D.isDown) vx = s;
  if (scene.cursors.up.isDown || scene.keys.W.isDown) vy = -s; else if (scene.cursors.down.isDown || scene.keys.S.isDown) vy = s;
  scene.hero.setVelocity(vx, vy);
}
function endGame(scene) {
  scene.isOver = true; scene.hero.setVelocity(0, 0);
  scene.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x0b1a2e, 0.8).setDepth(20);
  scene.add.text(WIDTH/2, HEIGHT/2 - 20, 'Time!  ' + scene.score + ' coins', { fontFamily: 'Arial', fontSize: '46px', color: '#eaf1f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
  scene.add.text(WIDTH/2, HEIGHT/2 + 36, 'Click to play again', { fontFamily: 'Arial', fontSize: '18px', color: '#7c93ae' }).setOrigin(0.5).setDepth(21);
}
function postStats(scene) { try { if (window.parent) window.parent.postMessage({ type: 'stats', score: scene.score, lives: Math.max(0, scene.timeLeft) }, '*'); } catch (e) {} }
`;

const PADDLE_CODE = `// game.js - Paddle Bounce
const CONFIG = { paddleWidth: 110, ballSpeed: 300 };
const WIDTH = 800, HEIGHT = 600;
function buildTextures(scene) {
  const g = scene.make.graphics({ add: false });
  g.fillStyle(0x2fd0b6, 1); g.fillRoundedRect(0, 0, CONFIG.paddleWidth, 18, 8); g.generateTexture('paddle', CONFIG.paddleWidth, 18); g.clear();
  g.fillStyle(0xf5b02e, 1); g.fillCircle(11, 11, 10); g.generateTexture('ball', 22, 22); g.destroy();
}
function resetBall(scene) { scene.ball.setPosition(WIDTH / 2, HEIGHT / 2); scene.ball.setVelocity(Phaser.Math.Between(-160, 160), CONFIG.ballSpeed); }
function create() {
  const scene = this; buildTextures(scene);
  scene.score = 0; scene.lives = 3; scene.isOver = false;
  scene.physics.world.setBoundsCollision(true, true, true, false);
  scene.paddle = scene.physics.add.sprite(WIDTH / 2, HEIGHT - 28, 'paddle'); scene.paddle.setImmovable(true); scene.paddle.body.allowGravity = false; scene.paddle.setCollideWorldBounds(true);
  scene.ball = scene.physics.add.sprite(WIDTH / 2, HEIGHT / 2, 'ball'); scene.ball.setCollideWorldBounds(true); scene.ball.setBounce(1);
  resetBall(scene);
  scene.physics.add.collider(scene.ball, scene.paddle, function () { scene.score += 1; scene.scoreText.setText('Score: ' + scene.score); postStats(scene); }, null, scene);
  scene.cursors = scene.input.keyboard.createCursorKeys(); scene.keys = scene.input.keyboard.addKeys('A,D');
  scene.input.on('pointermove', function (p) { if (!scene.isOver) scene.paddle.x = Phaser.Math.Clamp(p.worldX, CONFIG.paddleWidth / 2, WIDTH - CONFIG.paddleWidth / 2); });
  scene.input.on('pointerdown', function () { if (scene.isOver) scene.scene.restart(); });
  scene.scoreText = scene.add.text(16, 14, 'Score: 0', { fontFamily: 'Arial', fontSize: '22px', color: '#eaf1f8' }).setDepth(10);
  scene.livesText = scene.add.text(WIDTH - 16, 14, 'Lives: 3', { fontFamily: 'Arial', fontSize: '22px', color: '#f5b02e' }).setOrigin(1, 0).setDepth(10);
  postStats(scene);
}
function update() {
  const scene = this; if (scene.isOver) return;
  scene.paddle.setVelocityX(0);
  if (scene.cursors.left.isDown || scene.keys.A.isDown) scene.paddle.setVelocityX(-520);
  else if (scene.cursors.right.isDown || scene.keys.D.isDown) scene.paddle.setVelocityX(520);
  if (scene.ball.y > HEIGHT + 30) loseLife(scene);
}
function loseLife(scene) {
  scene.lives -= 1; scene.livesText.setText('Lives: ' + scene.lives); scene.cameras.main.shake(140, 0.008); postStats(scene);
  if (scene.lives <= 0) { scene.isOver = true; scene.ball.setVelocity(0, 0); scene.ball.setVisible(false);
    scene.add.rectangle(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT, 0x0b1a2e, 0.8).setDepth(20);
    scene.add.text(WIDTH/2, HEIGHT/2 - 20, 'Game Over', { fontFamily: 'Arial', fontSize: '52px', color: '#eaf1f8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
    scene.add.text(WIDTH/2, HEIGHT/2 + 40, 'Click to play again', { fontFamily: 'Arial', fontSize: '18px', color: '#7c93ae' }).setOrigin(0.5).setDepth(21);
  } else { resetBall(scene); }
}
function postStats(scene) { try { if (window.parent) window.parent.postMessage({ type: 'stats', score: scene.score, lives: scene.lives }, '*'); } catch (e) {} }
`;

/* ================= app ================= */
const $ = function (id) { return document.getElementById(id); };
let studentId = localStorage.getItem('leagueStudentId');
if (!studentId) { studentId = 'stu-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('leagueStudentId', studentId); }

/* ================= student project (lives in the browser only) =================
   Prebuilt games (above) are read-only templates served by the server. When a
   student opens one it is COPIED into this client-side project. All editing,
   saving, and running happen in the browser (localStorage) — nothing the student
   makes is written back to the server. */
const BOOT_CODE = `// main.js - starts the game (advanced)
const config = {
  type: Phaser.AUTO,
  width: WIDTH, height: HEIGHT,
  parent: 'game',
  backgroundColor: '#0d2137',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade' },
  scene: { create: create, update: update }
};
new Phaser.Game(config);
`;
const PKEY = 'leagueProject';
function defaultProject() { return { files: { 'game.js': STAR_CODE, 'main.js': BOOT_CODE }, order: ['game.js', 'main.js'] }; }
function loadProject() {
  try { const p = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (p && p.files && typeof p.files['game.js'] === 'string') { if (!Array.isArray(p.order)) p.order = Object.keys(p.files); return p; } } catch (e) {}
  return defaultProject();
}
let project = loadProject();
function saveProject() { localStorage.setItem(PKEY, JSON.stringify(project)); }
function fileNames() { const out = project.order.filter(function (n) { return project.files[n] !== undefined; }); Object.keys(project.files).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); }); return out; }
function validJS(code) { try { new Function(code); return true; } catch (e) { return false; } } // parse-check only, never runs

/* read the CONFIG object's numeric keys (client-side) */
function parseConfig(code) {
  const cfg = {}; const m = code.match(/CONFIG\s*=\s*\{([\s\S]*?)\}/);
  if (m) { const re = /([A-Za-z_$][\w$]*)\s*:\s*(-?[0-9.]+)/g; let mm; while ((mm = re.exec(m[1]))) cfg[mm[1]] = Number(mm[2]); }
  return cfg;
}

/* ----- surgical-edit helpers: apply the AI's ops to game.js without a full rewrite ----- */
function insertIntoFn(code, fnName, snippet) {
  const sig = code.indexOf('function ' + fnName + '(');
  if (sig < 0) return code + '\n\n// note: could not find ' + fnName + '() to hook into\n';
  const braceStart = code.indexOf('{', sig); if (braceStart < 0) return code;
  let depth = 0, i = braceStart;
  for (; i < code.length; i++) { const c = code[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) break; } }
  return code.slice(0, i) + '  ' + snippet.replace(/\n/g, '\n  ') + '\n' + code.slice(i);
}
function mergeConfig(code, obj) {
  const m = code.match(/CONFIG\s*=\s*\{([\s\S]*?)\}/); if (!m) return code;
  let body = m[1];
  Object.keys(obj).forEach(function (k) {
    const re = new RegExp('(\\b' + k + '\\s*:\\s*)(-?[0-9.]+)');
    if (re.test(body)) body = body.replace(re, '$1' + obj[k]);
    else { const t = body.replace(/\s+$/, ''); body = t + (t.endsWith(',') || t.endsWith('{') ? '' : ',') + ' ' + k + ': ' + obj[k] + ' '; }
  });
  return code.replace(/CONFIG\s*=\s*\{[\s\S]*?\}/, 'CONFIG = {' + body + '}');
}
function applyOps(code, ops) {
  if (typeof ops.replaceFile === 'string' && ops.replaceFile.trim()) return ops.replaceFile;
  if (ops.config && typeof ops.config === 'object') code = mergeConfig(code, ops.config);
  if (Array.isArray(ops.functions)) ops.functions.forEach(function (f) { if (typeof f === 'string' && f.trim()) code += '\n\n' + f.trim() + '\n'; });
  if (typeof ops.create === 'string' && ops.create.trim()) code = insertIntoFn(code, 'create', ops.create.trim());
  if (typeof ops.update === 'string' && ops.update.trim()) code = insertIntoFn(code, 'update', ops.update.trim());
  return code;
}

const SKEY = 'leagueProgress';
function loadState() { try { return Object.assign({ xp: 0, stars: 0, done: {}, modDone: {}, unlocked: { starcatcher: true }, published: [] }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return { xp: 0, stars: 0, done: {}, modDone: {}, unlocked: { starcatcher: true }, published: [] }; } }
let state = loadState();
function saveState() { localStorage.setItem(SKEY, JSON.stringify(state)); renderFooter(); }
function renderFooter() {
  const lvl = Math.floor(state.xp / 1000) + 1; const into = state.xp % 1000;
  $('xpVal').textContent = state.xp; $('starVal').textContent = state.stars; $('lvlVal').textContent = lvl;
  $('xpBar').style.width = (into / 1000 * 100) + '%';
}

/* Course content is AUTHORED in /content: course.yaml (structure) + lessons/*.md
   (Markdown with YAML front-matter). Loaded read-only at boot; edit the files, not this code. */
let course = { id: 'course1', name: 'Course', library: 'Phaser', modules: [] };
let flat = [];
function buildFlat() {
  flat = [];
  course.modules.forEach(function (m, mi) { m.lessons.forEach(function (l, li) { flat.push({ mi: mi, li: li, id: mi + '.' + li, l: l, m: m }); }); });
}
function splitFrontMatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  let meta = {}; try { meta = jsyaml.load(m[1]) || {}; } catch (e) { meta = {}; }
  return { meta: meta, body: m[2] };
}
function loadCourse() {
  return fetch('content/course.yaml').then(function (r) { return r.text(); }).then(function (y) {
    const data = jsyaml.load(y) || {};
    course = { id: data.id, name: data.name || 'Course', library: data.library || 'Phaser', modules: [] };
    const jobs = [];
    (data.modules || []).forEach(function (mod) {
      const module = { name: mod.name, stars: mod.stars || 0, lessons: [] };
      course.modules.push(module);
      (mod.lessons || []).forEach(function (lessonId) {
        const lesson = { t: lessonId, xp: 0, d: '', body: '', ai: 'full' };
        module.lessons.push(lesson);
        jobs.push(fetch('content/lessons/' + lessonId + '.md').then(function (r) { return r.ok ? r.text() : ''; }).then(function (md) {
          const fm = splitFrontMatter(md || '');
          lesson.t = (fm.meta && fm.meta.title) || lessonId;
          lesson.xp = (fm.meta && fm.meta.xp) || 0;
          lesson.d = (fm.meta && fm.meta.summary) || '';
          lesson.ai = (fm.meta && fm.meta.ai) || 'full';
          lesson.body = marked.parse(fm.body || '');
        }).catch(function () { lesson.body = '<p>(Could not load this lesson.)</p>'; }));
      });
    });
    return Promise.all(jobs).then(buildFlat);
  });
}
function lessonUnlocked(idx) { return idx === 0 || !!state.done[flat[idx - 1].id]; }

/* ---------- outline ---------- */
const tree = $('tree'); let curIdx = 0;
function renderOutline() {
  tree.innerHTML = '';
  course.modules.forEach(function (m, mi) {
    const firstIdx = flat.findIndex(function (f) { return f.mi === mi; });
    const modLocked = !lessonUnlocked(firstIdx);
    const sec = document.createElement('div'); sec.className = 'sec';
    const head = document.createElement('div'); head.className = 'sec-head' + (modLocked ? ' locked' : '');
    head.innerHTML = '<span class="tri">' + (modLocked ? '▸' : '▾') + '</span><span class="mdi ' + (modLocked ? 'mdi-lock' : 'mdi-folder') + '"' + (modLocked ? '' : ' style="color:' + moduleAccent(mi) + '"') + '></span><span class="lbl">' + m.name + '</span>';
    if (modLocked) sec.classList.add('collapsed');
    head.addEventListener('click', function () {
      if (modLocked) { toast('Finish the previous module to unlock this one.'); return; }
      sec.classList.toggle('collapsed'); head.querySelector('.tri').textContent = sec.classList.contains('collapsed') ? '▸' : '▾';
    });
    const kids = document.createElement('div'); kids.className = 'kids';
    m.lessons.forEach(function (l, li) {
      const idx = flat.findIndex(function (f) { return f.mi === mi && f.li === li; });
      const locked = !lessonUnlocked(idx), done = !!state.done[mi + '.' + li];
      const icon = done ? 'mdi-check-circle' : (locked ? 'mdi-lock' : 'mdi-file-document-outline');
      const row = document.createElement('div');
      row.className = 'page' + (idx === curIdx ? ' active' : '') + (done ? ' done' : '') + (locked ? ' locked' : '');
      row.innerHTML = '<span class="mdi ' + icon + '"></span><span class="lbl">' + l.t + '</span>';
      row.addEventListener('click', function () { if (locked) { toast('Complete the previous lesson first.'); return; } selectLesson(idx); });
      kids.appendChild(row);
    });
    sec.appendChild(head); sec.appendChild(kids); tree.appendChild(sec);
  });
}

/* ---------- lesson (rendered from authored Markdown) ---------- */
function lessonBodyHTML(f) {
  const done = !!state.done[f.id];
  const total = f.m.lessons.length;
  const meta = '<div class="lesson-meta">'
    + '<span class="lchip"><span class="mdi mdi-book-open-page-variant"></span>Lesson ' + (f.li + 1) + ' of ' + total + '</span>'
    + '<span class="lchip"><span class="mdi mdi-lightning-bolt"></span>+' + f.l.xp + ' XP</span>'
    + (done ? '<span class="lchip"><span class="mdi mdi-check-circle"></span>Completed</span>' : '')
    + '</div>';
  return '<div class="lesson-hero"><div class="eyebrow">' + f.m.name + '</div><h1>' + f.l.t + '</h1>'
    + (f.l.d ? '<p class="lead">' + f.l.d + '</p>' : '') + meta + '</div>'
    + '<div class="lesson-content">' + f.l.body
    + '<div class="challenge"><div class="ch-h"><span class="mdi mdi-flag-checkered"></span> Challenge</div>'
    + '<div style="color:var(--muted);margin-bottom:6px;">Finish the challenge to complete this lesson and unlock the next one.</div>'
    + '<button class="btn-primary" id="completeBtn"' + (done ? ' disabled' : '') + '><span class="mdi mdi-' + (done ? 'check' : 'flag-checkered') + '"></span>' + (done ? 'Completed  (+' + f.l.xp + ' XP)' : 'Complete challenge  (+' + f.l.xp + ' XP)') + '</button></div>'
    + '</div>';
}
let currentAIMode = 'full';   // the current lesson's coder policy: full | guided | off
let aiMode = 'coder';         // which agent the panel talks to: tutor | coder
let aiModels = {};            // per-agent model names from /api/info
let currentLessonText = '';   // plain text of the current lesson, used as tutor context
function applyAIMode(mode) {
  currentAIMode = mode || 'full';
  if (aiMode !== 'coder') return;   // in Tutor mode the lesson's coder policy doesn't gate the box
  const inp = $('aiText'), btn = $('aiSend');
  if (!inp || !btn) return;
  if (currentAIMode === 'off') { inp.disabled = true; btn.disabled = true; inp.placeholder = 'AI is off for this challenge — try it yourself!'; }
  else if (currentAIMode === 'guided') { inp.disabled = false; btn.disabled = false; inp.placeholder = 'Guided: tell the AI exactly what to change'; }
  else { inp.disabled = false; btn.disabled = false; inp.placeholder = 'Ask the AI to change your game...'; }
}
function setAIMode(mode) {
  aiMode = (mode === 'tutor') ? 'tutor' : 'coder';
  const tog = $('modeToggle');
  if (tog) {
    tog.innerHTML = '<span class="mdi ' + (aiMode === 'tutor' ? 'mdi-school-outline' : 'mdi-code-braces') + '"></span>';
    tog.title = aiMode === 'tutor' ? 'Tutor mode (explains) — click to switch to Build' : 'Build mode (edits code) — click to switch to Tutor';
    tog.classList.toggle('tutor', aiMode === 'tutor'); tog.classList.toggle('coder', aiMode === 'coder');
  }
  const tag = $('aiModelTag'); if (tag) { const spec = aiModels[aiMode] || ''; tag.textContent = spec.replace(/^[^:]+:/, '') || '…'; tag.title = spec; }
  if (aiMode === 'tutor') { const inp = $('aiText'), btn = $('aiSend'); if (inp) { inp.disabled = false; inp.placeholder = 'Ask the tutor about this lesson...'; } if (btn) btn.disabled = false; }
  else { applyAIMode(currentAIMode); }
}
/* ```run — editable JS cell. Directives (as // @lines): @goal: <text>, @expect: <substring>, @slider: name min max step value */
function renderRunCells(root) {
  root.querySelectorAll('pre > code.language-run').forEach(function (code) {
    const pre = code.parentNode; const raw = code.textContent;
    let goal = '', expect = ''; const sliders = []; const bodyLines = [];
    raw.split('\n').forEach(function (ln) {
      let m;
      if (m = ln.match(/^\s*\/\/\s*@goal:\s*(.+)$/)) goal = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@expect:\s*(.+)$/)) expect = m[1].trim();
      else if (m = ln.match(/^\s*\/\/\s*@slider:\s*([A-Za-z_$][\w$]*)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/)) sliders.push({ name: m[1], min: +m[2], max: +m[3], step: +m[4], value: +m[5] });
      else bodyLines.push(ln);
    });
    const src = bodyLines.join('\n').replace(/^\n+/, '');
    const tok = 'rc' + Math.random().toString(36).slice(2, 9);
    const cell = document.createElement('div'); cell.className = 'runcell';
    if (goal) { const g = document.createElement('div'); g.className = 'run-goal'; g.innerHTML = '<span class="mdi mdi-target"></span>'; g.appendChild(document.createTextNode(goal)); cell.appendChild(g); }
    const sEls = {};
    if (sliders.length) {
      const sw = document.createElement('div'); sw.className = 'run-sliders';
      sliders.forEach(function (s) {
        const row = document.createElement('label'); row.className = 'run-slider';
        const nm = document.createElement('span'); nm.className = 'rs-name'; nm.textContent = s.name + ' = ';
        const val = document.createElement('b'); val.textContent = s.value; nm.appendChild(val);
        const inp = document.createElement('input'); inp.type = 'range'; inp.min = s.min; inp.max = s.max; inp.step = s.step; inp.value = s.value;
        inp.addEventListener('input', function () { val.textContent = inp.value; run(); });
        sEls[s.name] = inp; row.appendChild(nm); row.appendChild(inp); sw.appendChild(row);
      });
      cell.appendChild(sw);
    }
    const ta = document.createElement('textarea'); ta.value = src; ta.spellcheck = false; ta.rows = Math.min(16, Math.max(3, src.split('\n').length));
    const bar = document.createElement('div'); bar.className = 'runbar';
    const btn = document.createElement('button'); btn.className = 'runbtn'; btn.innerHTML = '<span class="mdi mdi-play"></span>Run';
    const status = document.createElement('span'); status.className = 'run-status';
    const out = document.createElement('iframe'); out.className = 'runout'; out.setAttribute('sandbox', 'allow-scripts');
    function buildDoc(userCode) {
      const prefix = sliders.map(function (s) { return 'const ' + s.name + ' = ' + sEls[s.name].value + ';'; }).join('\n');
      const safe = (prefix + '\n' + userCode).replace(/<\/(script)/gi, '<\\/$1');
      return '<!doctype html><body style="margin:0;font:12.5px Consolas,monospace;color:#cfe0f2;background:#08121f;padding:8px"><pre id="o" style="margin:0;white-space:pre-wrap"></pre><scr' + 'ipt>var o=document.getElementById("o");function w(){o.textContent+=[].slice.call(arguments).join(" ")+"\\n";}console.log=w;console.info=w;console.warn=w;console.error=function(){o.textContent+="\\u26a0 "+[].slice.call(arguments).join(" ")+"\\n";};try{\n' + safe + '\n}catch(e){o.textContent+="\\u26a0 "+e.message+"\\n";}try{parent.postMessage({__runcell:true,tok:"' + tok + '",text:o.textContent},"*");}catch(e){}</scr' + 'ipt></body>';
    }
    function run() { out.style.display = 'block'; out.srcdoc = buildDoc(ta.value); }
    if (expect) {
      window.addEventListener('message', function (e) {
        const d = e && e.data; if (!d || !d.__runcell || d.tok !== tok) return;
        const met = (d.text || '').indexOf(expect) >= 0;
        status.className = 'run-status ' + (met ? 'ok' : 'no'); status.textContent = met ? 'Goal met!' : 'Not yet — check the output.';
      });
    }
    btn.addEventListener('click', run);
    bar.appendChild(btn); bar.appendChild(status);
    cell.appendChild(ta); cell.appendChild(bar); cell.appendChild(out);
    pre.parentNode.replaceChild(cell, pre);
  });
}
function shuffleOrder(n) {
  let a = []; for (let i = 0; i < n; i++) a.push(i);
  if (n < 2) return a;
  let tries = 0;
  do { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } tries++; }
  while (a.every(function (v, i) { return v === i; }) && tries < 12);
  return a;
}
/* ```quiz  (provisional syntax) — types: mcq | predict | parsons | fillblank | findbug. All checked locally. */
function renderQuizCells(root) {
  root.querySelectorAll('pre > code.language-quiz').forEach(function (code) {
    let q; try { q = jsyaml.load(code.textContent) || {}; } catch (e) { q = {}; }
    const pre = code.parentNode;
    const cell = document.createElement('div'); cell.className = 'quizcell';
    const head = document.createElement('div'); head.className = 'quiz-h'; head.innerHTML = '<span class="mdi mdi-help-circle-outline"></span>'; head.appendChild(document.createTextNode(q.prompt || 'Quick check')); cell.appendChild(head);
    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);
    const result = document.createElement('div'); result.className = 'quiz-result';
    const check = document.createElement('button'); check.className = 'quiz-check'; check.textContent = 'Check';
    const say = function (ok, msg) { result.className = 'quiz-result ' + (ok ? 'ok' : 'no'); result.textContent = msg; };
    const type = q.type || 'mcq';
    if (type === 'parsons') buildParsons(q, body, check, say);
    else if (type === 'fillblank') buildFill(q, body, check, say);
    else if (type === 'findbug') buildFindBug(q, body, check, say);
    else buildMCQ(q, body, check, say, type === 'predict');
    body.appendChild(check); cell.appendChild(result);
    pre.parentNode.replaceChild(cell, pre);
  });
}
function buildMCQ(q, body, check, say, isPredict) {
  if (isPredict && q.code) { const pc = document.createElement('pre'); pc.className = 'quiz-code'; pc.textContent = q.code; body.appendChild(pc); }
  const opts = q.options || []; const fb = q.feedback || []; let chosen = -1; const nm = 'q' + Math.random().toString(36).slice(2, 8); const rows = [];
  opts.forEach(function (opt, i) {
    const row = document.createElement('label'); row.className = 'mcq-opt'; rows.push(row);
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = nm;
    radio.addEventListener('change', function () { chosen = i; });
    const span = document.createElement('span'); span.textContent = opt;
    row.appendChild(radio); row.appendChild(span); body.appendChild(row);
  });
  check.addEventListener('click', function () {
    if (chosen < 0) { say(false, 'Pick an answer first.'); return; }
    const ans = Number(q.answer); const ok = chosen === ans;
    rows.forEach(function (r, i) { r.classList.remove('correct', 'wrong'); if (i === ans) r.classList.add('correct'); else if (i === chosen) r.classList.add('wrong'); });
    if (ok) say(true, 'Correct!');
    else say(false, fb[chosen] ? 'Not quite — ' + fb[chosen] : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — the highlighted answer is correct.'));
  });
}
function buildParsons(q, body, check, say) {
  const items = (q.lines || []).map(function (t) { return { text: t, distractor: false, why: '' }; })
    .concat((q.distractors || []).map(function (d) { return { text: (typeof d === 'string' ? d : d.text), distractor: true, why: (typeof d === 'string' ? '' : (d.why || '')) }; }));
  const correct = (q.lines || []); const hasDist = (q.distractors || []).length > 0;
  let order = shuffleOrder(items.length); const used = {}; items.forEach(function (_, i) { used[i] = true; }); let dragFrom = null;
  const list = document.createElement('div'); list.className = 'parsons';
  function draw() {
    list.innerHTML = '';
    order.forEach(function (idx, pos) {
      const it = items[idx];
      const row = document.createElement('div'); row.className = 'parsons-row' + (used[idx] ? '' : ' unused'); row.draggable = true;
      const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.innerHTML = '<span class="mdi mdi-drag-horizontal-variant"></span>';
      row.appendChild(handle);
      if (hasDist) { const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'p-use'; cb.checked = used[idx]; cb.addEventListener('change', function () { used[idx] = cb.checked; row.classList.toggle('unused', !cb.checked); }); row.appendChild(cb); }
      const c = document.createElement('code'); c.textContent = it.text; row.appendChild(c);
      row.addEventListener('dragstart', function () { dragFrom = pos; row.classList.add('dragging'); });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('over'); if (dragFrom === null || dragFrom === pos) { dragFrom = null; return; } const mv = order.splice(dragFrom, 1)[0]; order.splice(pos, 0, mv); dragFrom = null; draw(); });
      list.appendChild(row);
    });
  }
  draw(); body.appendChild(list);
  const hint = document.createElement('div'); hint.className = 'parsons-hint'; hint.textContent = hasDist ? 'Drag into order — and uncheck any lines that don’t belong.' : 'Drag the lines into the right order.'; body.appendChild(hint);
  check.addEventListener('click', function () {
    const kept = order.filter(function (idx) { return used[idx]; }).map(function (idx) { return items[idx]; });
    const badDist = kept.filter(function (it) { return it.distractor; });
    if (badDist.length) { say(false, badDist[0].why ? 'Not quite — ' + badDist[0].why : 'Not quite — one of the lines you kept doesn’t belong.'); return; }
    const texts = kept.map(function (it) { return it.text; });
    const ok = texts.length === correct.length && texts.every(function (t, i) { return t === correct[i]; });
    say(ok, ok ? 'Correct — nice ordering!' : 'Not yet — check the order (and which lines you kept).');
  });
}
function buildFill(q, body, check, say) {
  const tpl = String(q.code || q.template || ''); const parts = tpl.split('___');
  const wrap = document.createElement('div'); wrap.className = 'fill-code';
  const input = document.createElement('input'); input.type = 'text'; input.className = 'fill-input'; input.spellcheck = false; input.placeholder = '?';
  if (parts.length >= 2) { wrap.appendChild(document.createTextNode(parts[0])); wrap.appendChild(input); wrap.appendChild(document.createTextNode(parts.slice(1).join('___'))); }
  else { wrap.appendChild(input); }
  body.appendChild(wrap);
  const answers = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(function (a) { return String(a).trim(); });
  check.addEventListener('click', function () {
    const v = input.value.trim();
    const ok = answers.some(function (a) { return a === v || a.toLowerCase() === v.toLowerCase(); });
    say(ok, ok ? 'Correct!' : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — try again.'));
  });
}
function buildFindBug(q, body, check, say) {
  const lines = q.code || q.lines || []; let chosen = -1; const rows = [];
  const wrap = document.createElement('div'); wrap.className = 'findbug';
  lines.forEach(function (ln, i) {
    const row = document.createElement('div'); row.className = 'fb-row'; rows.push(row);
    const num = document.createElement('span'); num.className = 'fb-num'; num.textContent = (i + 1);
    const c = document.createElement('code'); c.textContent = ln;
    row.appendChild(num); row.appendChild(c);
    row.addEventListener('click', function () { chosen = i; rows.forEach(function (r) { r.classList.remove('sel'); }); row.classList.add('sel'); });
    wrap.appendChild(row);
  });
  body.appendChild(wrap);
  check.addEventListener('click', function () {
    if (chosen < 0) { say(false, 'Click the line you think has the bug.'); return; }
    const ans = Number(q.answer); const ok = chosen === ans;
    rows.forEach(function (r, i) { r.classList.remove('correct', 'wrong'); if (i === ans) r.classList.add('correct'); else if (i === chosen) r.classList.add('wrong'); });
    say(ok, ok ? 'Correct — that’s the bug!' : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — the highlighted line has the bug.'));
  });
}
const MODULE_HERO = ['#143561', '#2f2a6b', '#1f5b63', '#5b3320', '#1f6b45', '#6b2a52', '#26456b', '#4a6b26', '#6b5320', '#33305b'];
const MODULE_ACCENT = ['#3e8fd6', '#8b7cff', '#2fd0b6', '#f5820a', '#3ddc84', '#ff6b9d', '#59a5ff', '#a3d94a', '#f5b02e', '#7c9cff'];
function moduleHero(mi) { return MODULE_HERO[mi % MODULE_HERO.length]; }
function moduleAccent(mi) { return MODULE_ACCENT[mi % MODULE_ACCENT.length]; }
function railHTML(f) {
  const mod = course.modules[f.mi];
  const total = mod.lessons.length;
  const doneCount = mod.lessons.filter(function (l, li) { return state.done[f.mi + '.' + li]; }).length;
  const pct = Math.round(doneCount / total * 100);
  const items = mod.lessons.map(function (l, li) {
    const gi = flat.findIndex(function (x) { return x.mi === f.mi && x.li === li; });
    const done = !!state.done[f.mi + '.' + li], locked = !lessonUnlocked(gi), cur = gi === curIdx;
    const icon = done ? 'mdi-check-circle' : (locked ? 'mdi-lock' : 'mdi-circle-small');
    return '<div class="rail-item' + (cur ? ' cur' : '') + (done ? ' done' : '') + (locked ? ' locked' : '') + '" data-goto-lesson="' + gi + '"><span class="mdi ' + icon + '"></span>' + l.t + '</div>';
  }).join('');
  const prevOk = curIdx > 0, nextOk = (curIdx + 1) < flat.length && lessonUnlocked(curIdx + 1);
  return '<button class="rail-jump" id="railJump"><span class="mdi mdi-flag-checkered"></span>Jump to challenge</button>'
    + '<div class="rail-prog"><h4>Module progress</h4><div class="pct">' + doneCount + ' of ' + total + ' lessons</div><div class="bar"><div style="width:' + pct + '%"></div></div></div>'
    + '<div><h4>In this module</h4><div class="rail-list">' + items + '</div></div>'
    + '<div class="rail-nav"><button id="railPrev"' + (prevOk ? '' : ' disabled') + '><span class="mdi mdi-arrow-left"></span>Prev</button><button id="railNext"' + (nextOk ? '' : ' disabled') + '>Next<span class="mdi mdi-arrow-right"></span></button></div>';
}
function selectLesson(idx) {
  curIdx = idx; const f = flat[idx];
  $('crumb').dataset.lesson = f.m.name + ': ' + f.l.t;
  $('lessonBody').innerHTML = lessonBodyHTML(f);
  $('lessonBody').style.setProperty('--mod', moduleHero(f.mi));
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  applyAIMode(f.l.ai);
  const btn = $('completeBtn'); if (btn) btn.addEventListener('click', function () { completeLesson(); });
  renderOutline(); switchView('learn');
}
function completeLesson() {
  const f = flat[curIdx]; if (state.done[f.id]) return;
  state.done[f.id] = true; state.xp += f.l.xp; toast('Lesson complete!  +' + f.l.xp + ' XP');
  const allDone = course.modules[f.mi].lessons.every(function (l, li) { return state.done[f.mi + '.' + li]; });
  if (allDone && !state.modDone[f.mi]) { state.modDone[f.mi] = true; state.stars += course.modules[f.mi].stars; setTimeout(function () { toast('Module complete: ' + course.modules[f.mi].name + '!  +' + course.modules[f.mi].stars + ' ★'); }, 900); }
  saveState(); selectLesson(curIdx);
}

/* ---------- code editor ---------- */
let currentFile = 'game.js';
const codeEditor = CodeMirror.fromTextArea($('codeeditor'), { mode: 'javascript', theme: 'material-darker', lineNumbers: true, tabSize: 2, indentUnit: 2 });
codeEditor.setSize('100%', '100%');
function formatJS(code) { try { return prettier.format(code, { parser: 'babel', plugins: prettierPlugins, printWidth: 100, tabWidth: 2, singleQuote: true }); } catch (e) { return code; } }

/* ---------- tabs + panels ---------- */
function switchView(view) {
  if (typeof codeEditor !== 'undefined' && !$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); } // keep edits when leaving Code
  document.querySelectorAll('.vtab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
  ['learn', 'code', 'play'].forEach(function (v) { $('view-' + v).hidden = (v !== view); });
  const panelFor = { learn: 'panel-outline', code: 'panel-files', play: 'panel-info' };
  const titleFor = { learn: 'Course Outline', code: 'Files', play: 'Game Info' };
  ['panel-outline', 'panel-files', 'panel-info'].forEach(function (p) { $(p).hidden = (p !== panelFor[view]); });
  $('leftTitle').textContent = titleFor[view];
  if (view === 'learn') $('crumb').textContent = $('crumb').dataset.lesson || 'Lesson';
  if (view === 'code') { $('crumb').textContent = currentFile; refreshFiles(); loadCode(); setTimeout(function () { codeEditor.refresh(); }, 0); }
  if (view === 'play') { $('crumb').textContent = 'Playing: ' + course.name; startGame(); loadSettings(); } else { stopGame(); }
  setAIMode(view === 'learn' ? 'tutor' : 'coder');   // Learn = ask the tutor; Code/Play = build with the coder
  if (view === 'learn') showConsole(false); else if (view === 'code') showConsole(true, true); else showConsole(true, false); // log: open on Code, closed on Play
}
document.querySelectorAll('.vtab').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); }); });
function startGame() { // build a self-contained page from the browser-side project and run it in the iframe (no server)
  conClear();
  const ordered = ['game.js'].concat(fileNames().filter(function (n) { return n !== 'game.js' && n !== 'main.js'; }));
  if (typeof project.files['main.js'] === 'string') ordered.push('main.js');
  const scripts = ordered.map(function (n) { return '<' + 'script>\n' + (project.files[n] || '') + '\n<' + '/script>'; }).join('\n');
  const capture = '<' + 'script>(function(){function f(a){a=[].slice.call(a);if(typeof a[0]==="string"&&/%[csdfoO]/.test(a[0])){var i=1;var o=a[0].replace(/%[csdfoO]/g,function(m){if(m==="%c"){i++;return "";}return String(a[i++]);});return (o+" "+a.slice(i).join(" ")).replace(/\\s+/g," ").trim();}return a.map(String).join(" ");}function s(l,a){try{parent.postMessage({__gamelog:true,level:l,text:f(a)},"*");}catch(e){}}var c=console,lg=c.log.bind(c);c.log=function(){lg.apply(c,arguments);s("log",arguments);};var wn=c.warn.bind(c);c.warn=function(){wn.apply(c,arguments);s("warn",arguments);};var er=c.error.bind(c);c.error=function(){er.apply(c,arguments);s("error",arguments);};window.onerror=function(m){s("error",[m]);return false;};})();<' + '/script>\n';
  const html = '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;height:100%;background:#06101c;overflow:hidden}#game{width:100%;height:100vh}</style></head><body>'
    + '<div id="game"></div>\n'
    + capture
    + '<' + 'script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"><' + '/script>\n'
    + scripts + '\n</body></html>';
  $('gameFrame').removeAttribute('src'); $('gameFrame').srcdoc = html;
}
function stopGame() { const f = $('gameFrame'); if (f) { f.removeAttribute('srcdoc'); f.removeAttribute('src'); } }

/* ---------- files ---------- */
function refreshFiles() {
  const list = $('fileList'); list.innerHTML = '';
  fileNames().forEach(function (name) {
    const row = document.createElement('div'); row.className = 'filerow' + (name === currentFile ? ' active' : '');
    row.innerHTML = '<span class="mdi mdi-language-javascript"></span><span class="lbl">' + name + '</span>';
    row.addEventListener('click', function () { openFile(name); });
    list.appendChild(row);
  });
}
function openFile(name) { if (!$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); } currentFile = name; $('crumb').textContent = name; refreshFiles(); loadCode(); }
function loadCode() { const t = project.files[currentFile]; codeEditor.setValue(typeof t === 'string' ? formatJS(t) : '// (empty file)'); codeEditor.refresh(); }
$('newFileBtn').addEventListener('click', function () {
  modal({ title: 'New script', message: 'Name your script (letters, numbers, - or _). ".js" is added automatically.', input: true, placeholder: 'enemy.js', okLabel: 'Create',
    onOk: function (name) { if (!name) return; name = name.trim(); if (!/\.js$/.test(name)) name += '.js';
      if (!/^[A-Za-z0-9_-]+\.js$/.test(name)) { toast('Use letters, numbers, - or _ only.'); return; }
      if (project.files[name] !== undefined) { toast('A file with that name already exists.'); return; }
      project.files[name] = '// ' + name + '\n// Code you write here runs with the game when you press Run.\n';
      project.order.push(name); saveProject(); refreshFiles(); openFile(name); toast('Created ' + name); } });
});
function saveFile(cb) { project.files[currentFile] = codeEditor.getValue(); saveProject(); toast('Saved ✓'); if (cb) cb(); } // saves to the browser only
$('saveBtn').addEventListener('click', function () { saveFile(); });
$('runBtn').addEventListener('click', function () { saveFile(function () { switchView('play'); }); });
document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('view-code').hidden) { e.preventDefault(); saveFile(); } });

/* ---------- game info ---------- */
function loadSettings() { const cfg = parseConfig(project.files['game.js'] || ''); const box = $('infoSettings'); box.innerHTML = ''; Object.keys(cfg).forEach(function (k) { const row = document.createElement('div'); row.className = 'setrow'; row.innerHTML = '<span>' + k + '</span><b>' + cfg[k] + '</b>'; box.appendChild(row); }); }

/* ---------- AI ---------- */
const aiMsgs = $('aiMsgs');
function addMsg(who, text) { const m = document.createElement('div'); m.className = 'msg ' + who; setMsg(m, who, text); aiMsgs.appendChild(m); aiMsgs.scrollTop = aiMsgs.scrollHeight; return m; }
function setMsg(m, who, text) { if (who === 'bot') { try { m.innerHTML = marked.parse(String(text)); } catch (e) { m.textContent = String(text); } } else { m.textContent = text; } aiMsgs.scrollTop = aiMsgs.scrollHeight; }
function refreshAfterEdit() { loadSettings(); refreshFiles(); if (!$('view-play').hidden) startGame(); if (!$('view-code').hidden) loadCode(); }
function askTutor(question, context) {
  addMsg('user', question); const pending = addMsg('bot', 'Thinking…');
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: studentId, agent: 'tutor', message: question, context: context || '', code: project.files['game.js'] || '' }) })
    .then(function (r) { return r.json(); }).then(function (d) { setMsg(pending, 'bot', d.reply || '—'); })
    .catch(function () { setMsg(pending, 'bot', 'Could not reach the tutor.'); });
}
function sendAI() {
  const box = $('aiText'); const text = box.value.trim(); if (!text) return;
  if (aiMode === 'coder' && currentAIMode === 'off') { toast('The AI is off for this challenge — give it a try yourself!'); return; }
  box.value = '';
  if (aiMode === 'tutor') { askTutor(text, currentLessonText); return; }
  addMsg('user', text); const pending = addMsg('bot', 'Thinking…');
  // the code lives in the browser; we send it along, the server relays the AI, and we apply the change here
  fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: studentId, agent: 'coder', message: text, code: project.files['game.js'] || '' }) })
    .then(function (r) { return r.json(); }).then(function (data) {
      setMsg(pending, 'bot', data.reply || 'Done.');
      const ops = data.ops; if (!ops) return;
      if (ops.newFile && typeof ops.newFile.name === 'string' && typeof ops.newFile.code === 'string') {
        let nm = ops.newFile.name.trim(); if (!/\.js$/.test(nm)) nm += '.js';
        if (/^[A-Za-z0-9_-]+\.js$/.test(nm)) { const existed = project.files[nm] !== undefined; project.files[nm] = ops.newFile.code; if (!existed) project.order.push(nm); }
      }
      const before = project.files['game.js'] || '';
      const next = applyOps(before, ops);
      if (next !== before) {
        if (!validJS(next)) { addMsg('bot', "That change caused a code error, so I kept your game the way it was. Try asking a slightly different way."); saveProject(); refreshAfterEdit(); return; }
        project.files['game.js'] = next;
      }
      saveProject(); refreshAfterEdit();
    })
    .catch(function () { pending.textContent = 'Could not reach the server.'; });
}
$('aiSend').addEventListener('click', sendAI);
$('aiText').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendAI(); });
addMsg('bot', "Hi! Two modes up top: **Tutor** explains the lesson and answers questions, and **Build** changes your game's code. I switch automatically with your tab — Learn uses Tutor; Code and Play use Build.");
$('modeToggle').addEventListener('click', function () { setAIMode(aiMode === 'tutor' ? 'coder' : 'tutor'); });
fetch('/api/info').then(function (r) { return r.json(); }).then(function (d) { aiModels = d.agents || { coder: d.model, tutor: d.model }; setAIMode(aiMode); }).catch(function () {});

/* ---------- console / log panel (bottom of Code & Play) ---------- */
function conLine(level, text) {
  const body = $('consoleBody'); if (!body) return;
  const empty = body.querySelector('.cl-empty'); if (empty) empty.remove();
  const d = document.createElement('div'); d.className = 'cl' + (level === 'error' ? ' err' : (level === 'warn' ? ' warn' : ''));
  d.textContent = text; body.appendChild(d); body.scrollTop = body.scrollHeight;
}
function conClear() { const b = $('consoleBody'); if (b) b.innerHTML = '<div class="cl cl-empty">Console output from your game appears here.</div>'; }
let consoleOpen = true;
function showConsole(show, open) {
  const c = $('console'); if (!c) return;
  c.hidden = !show;
  if (open !== undefined) consoleOpen = open;
  c.classList.toggle('collapsed', !consoleOpen);
}
if ($('conToggle')) $('conToggle').addEventListener('click', function () { consoleOpen = !consoleOpen; $('console').classList.toggle('collapsed', !consoleOpen); });
if ($('conClear')) $('conClear').addEventListener('click', conClear);
window.addEventListener('message', function (e) { const d = e && e.data; if (d && d.__gamelog) conLine(d.level || 'log', d.text || ''); });
conClear();

/* ---------- collapsible AI dock ---------- */
let aiCollapsed = false;
function updateFab() { const fab = $('aiFab'); if (fab) fab.hidden = !(aiCollapsed && $('page') && $('page').hidden); }
function setAICollapsed(c) { aiCollapsed = c; const ed = $('editor'); if (ed) ed.style.setProperty('--rightw', c ? '0px' : '320px'); updateFab(); }
if ($('aiCollapse')) $('aiCollapse').addEventListener('click', function () { setAICollapsed(true); });
if ($('aiFab')) $('aiFab').addEventListener('click', function () { setAICollapsed(false); });

/* ---------- page router ---------- */
function showPage(page) {
  document.querySelectorAll('.navitem').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-page') === page); });
  if (page === 'courses') { $('editor').hidden = false; $('page').hidden = true; updateFab(); return; }
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

/* ---------- asset store (spend Stars on assets that drop into your project as files) ---------- */
const assets = [
  { id: 'robot', name: 'Robot sprite', cat: 'Sprite', mdi: 'mdi-robot', col: '#2b6cb0', cost: 120, desc: 'A blocky robot for a player or enemy.', file: 'robot.js',
    code: "// robot.js — a robot sprite.\n// In create(): makeRobot(this); then use the key 'robot'.\nfunction makeRobot(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0x9fb3c8, 1); g.fillRoundedRect(2, 6, 24, 20, 4);\n  g.fillStyle(0x35c2f5, 1); g.fillRect(7, 11, 4, 4); g.fillRect(17, 11, 4, 4);\n  g.generateTexture('robot', 28, 28); g.destroy();\n}\n" },
  { id: 'diamond', name: 'Diamond', cat: 'Sprite', mdi: 'mdi-diamond-stone', col: '#2c7a7b', cost: 120, desc: 'A shiny collectible.', file: 'diamond.js',
    code: "// diamond.js — a diamond collectible.\n// In create(): makeDiamond(this); then use the key 'diamond'.\nfunction makeDiamond(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0x59e0ff, 1); g.beginPath();\n  g.moveTo(14, 0); g.lineTo(28, 14); g.lineTo(14, 28); g.lineTo(0, 14); g.closePath(); g.fillPath();\n  g.generateTexture('diamond', 28, 28); g.destroy();\n}\n" },
  { id: 'heart', name: 'Heart', cat: 'Sprite', mdi: 'mdi-heart', col: '#9b2c2c', cost: 100, desc: 'For lives or health pickups.', file: 'heart.js',
    code: "// heart.js — a heart sprite.\n// In create(): makeHeart(this); then use the key 'heart'.\nfunction makeHeart(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0xff5a7a, 1); g.fillCircle(8, 9, 7); g.fillCircle(18, 9, 7);\n  g.fillTriangle(1, 11, 25, 11, 13, 26);\n  g.generateTexture('heart', 26, 26); g.destroy();\n}\n" },
  { id: 'slime', name: 'Slime enemy', cat: 'Enemy', mdi: 'mdi-emoticon-devil', col: '#276749', cost: 150, desc: 'A bouncy slime to chase the player.', file: 'slime.js',
    code: "// slime.js — a slime enemy.\n// In create(): makeSlime(this); then use the key 'slime'.\nfunction makeSlime(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0x3ddc84, 1); g.fillRoundedRect(0, 8, 30, 18, 9);\n  g.fillStyle(0x0b1a2e, 1); g.fillCircle(10, 16, 3); g.fillCircle(20, 16, 3);\n  g.generateTexture('slime', 30, 26); g.destroy();\n}\n" },
  { id: 'spikeball', name: 'Spike ball', cat: 'Enemy', mdi: 'mdi-alert-octagon', col: '#c05621', cost: 150, desc: 'A spiky hazard to avoid.', file: 'spikeball.js',
    code: "// spikeball.js — a spiky hazard.\n// In create(): makeSpikeball(this); then use the key 'spikeball'.\nfunction makeSpikeball(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0xe94b4b, 1); g.fillCircle(14, 14, 10);\n  g.fillStyle(0xffb4b4, 1); for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; g.fillCircle(14 + Math.cos(r) * 13, 14 + Math.sin(r) * 13, 2); }\n  g.generateTexture('spikeball', 28, 28); g.destroy();\n}\n" },
  { id: 'space-bg', name: 'Space background', cat: 'Background', mdi: 'mdi-star-shooting', col: '#3730a3', cost: 150, desc: 'A starfield backdrop.', file: 'space-bg.js',
    code: "// space-bg.js — a starfield background.\n// In create(): makeSpaceBg(this); scene.add.image(400, 300, 'space-bg');\nfunction makeSpaceBg(scene) {\n  const g = scene.make.graphics({ add: false });\n  g.fillStyle(0x0a1330, 1); g.fillRect(0, 0, 800, 600);\n  g.fillStyle(0xffffff, 1); for (let i = 0; i < 120; i++) g.fillCircle(Math.random() * 800, Math.random() * 600, Math.random() * 1.5);\n  g.generateTexture('space-bg', 800, 600); g.destroy();\n}\n" },
  { id: 'low-gravity', name: 'Low gravity', cat: 'Physics', mdi: 'mdi-feather', col: '#6b46c1', cost: 100, desc: 'Floaty, moon-like gravity.', file: 'low-gravity.js',
    code: "// low-gravity.js — floaty physics.\n// In create(): applyLowGravity(this);\nfunction applyLowGravity(scene) {\n  scene.physics.world.gravity.y = 120;\n}\n" },
  { id: 'bouncy', name: 'Bouncy world', cat: 'Physics', mdi: 'mdi-basketball', col: '#b7791f', cost: 100, desc: 'Things bounce off the walls.', file: 'bouncy.js',
    code: "// bouncy.js — make a sprite bounce.\n// After creating a sprite: makeBouncy(sprite);\nfunction makeBouncy(sprite) {\n  sprite.setBounce(1);\n  sprite.setCollideWorldBounds(true);\n}\n" },
  { id: 'fast-fall', name: 'Fast fall', cat: 'Physics', mdi: 'mdi-arrow-down-bold', col: '#0e7490', cost: 100, desc: 'Heavier, faster-falling gravity.', file: 'fast-fall.js',
    code: "// fast-fall.js — heavy gravity.\n// In create(): applyFastFall(this);\nfunction applyFastFall(scene) {\n  scene.physics.world.gravity.y = 700;\n}\n" }
];
function avatarStyle(name) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return 'background:hsl(' + (Math.abs(h) % 360) + ' 62% 58%)'; }
function renderStore() {
  const cards = assets.map(function (a) {
    const owned = !!state.unlocked[a.id];
    const btn = owned ? '<span class="owned"><span class="mdi mdi-check-decagram"></span>Owned</span>'
      : '<button class="gbtn" data-buy="' + a.id + '"><span class="mdi mdi-cart-outline"></span>Buy</button>';
    const price = '<span class="cost"><span class="mdi mdi-star"></span>' + a.cost + '</span>';
    return '<div class="gcard"><div class="art" style="background:linear-gradient(135deg,' + a.col + ',#0b1a2e)"><span class="mdi ' + a.mdi + '"></span></div>'
      + '<div class="body"><h3>' + a.name + '</h3><div class="tags"><span class="chip">' + a.cat + '</span></div><p>' + a.desc + '</p><div class="cta">' + price + btn + '</div></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-cart-outline"></span>Store</h2><p class="sub">Spend ★ Stars on assets. Each one drops a file into your project you can use in your game.</p></div><span class="star-balance"><span class="mdi mdi-star"></span>' + state.stars + '</span></div><div class="cardgrid">' + cards + '</div>';
}
function buyAsset(id) {
  const a = assets.find(function (x) { return x.id === id; });
  if (!a || state.unlocked[a.id]) return;
  if (state.stars < a.cost) { toast('Not enough Stars — you need ★ ' + a.cost + '.'); return; }
  modal({ title: 'Buy "' + a.name + '"?', message: 'Costs ★ ' + a.cost + ' and adds ' + a.file + ' to your project. You have ★ ' + state.stars + '.', okLabel: 'Buy it',
    onOk: function () {
      state.stars -= a.cost; state.unlocked[a.id] = true; saveState();
      if (project.files[a.file] === undefined) { project.files[a.file] = a.code; project.order.push(a.file); saveProject(); }
      toast('Bought ' + a.name + ' — added ' + a.file + ' to your Files.'); showPage('store');
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
      + '<div class="body"><div class="avatar" style="' + avatarStyle(g.author) + '">' + g.author.charAt(0).toUpperCase() + '</div>'
      + '<div class="meta"><h3>' + g.name + '</h3><div class="by">by ' + g.author + '</div></div>'
      + '<span class="stat"><span class="mdi mdi-play"></span>' + g.plays + '</span></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-view-grid"></span>Gallery</h2><p class="sub">Games students have published. Names show a first name and last initial only.</p></div><button class="gbtn" id="publishBtn"><span class="mdi mdi-upload"></span>Publish my game</button></div><div class="cardgrid">' + cards + '</div>';
}
function publishGame() {
  modal({ title: 'Publish your game', message: 'Give your game a title to add it to the Gallery.', input: true, placeholder: 'My Awesome Game', okLabel: 'Publish',
    onOk: function (name) { if (!name) return; state.published = state.published || []; state.published.unshift({ name: name.trim(), date: Date.now() }); saveState(); toast('Published to the Gallery!'); showPage('gallery'); } });
}

/* ---------- leaderboards ---------- */
const sampleBoard = [{ name: 'Ava', xp: 4200 }, { name: 'Leo', xp: 3850 }, { name: 'Mia', xp: 2600 }, { name: 'Sam', xp: 1950 }, { name: 'Kai', xp: 1200 }, { name: 'Noa', xp: 700 }];
function renderBoard() {
  const rows = sampleBoard.concat([{ name: 'You', xp: state.xp, you: true }]).sort(function (a, b) { return b.xp - a.xp; });
  const max = rows[0].xp || 1;
  const body = rows.map(function (r, i) {
    const medal = i === 0 ? 'g' : (i === 1 ? 's' : (i === 2 ? 'b' : ''));
    const lvl = Math.floor(r.xp / 1000) + 1;
    return '<div class="lrow' + (r.you ? ' you' : '') + '"><div class="rank ' + medal + '">' + (i < 3 ? ['🥇','🥈','🥉'][i] : (i + 1)) + '</div>'
      + '<div class="avatar" style="' + avatarStyle(r.name) + '">' + r.name.charAt(0).toUpperCase() + '</div>'
      + '<div class="who"><div class="nm">' + r.name + '</div><div class="lv">Level ' + lvl + '</div><div class="lbar"><div style="width:' + (r.xp / max * 100) + '%"></div></div></div>'
      + '<div class="xp">' + r.xp + ' XP</div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-podium"></span>Leaderboards</h2><p class="sub">Ranked by total XP.</p></div></div><div class="board">' + body + '</div>';
}

/* ---------- docs / help ---------- */
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
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
    + '<h3><span class="mdi mdi-navigation-variant"></span>The top bar</h3><p><b>Courses</b> is where you learn and build. <b>Gallery</b> has example games you can unlock with ★ Stars and edit. <b>Showcase</b> shows games students published. <b>Leaderboards</b> ranks everyone by XP. <b>Docs</b> opens the game library\'s reference, and <b>Help</b> is this page.</p>'
    + '<h3><span class="mdi mdi-school"></span>Learning (Courses)</h3><p>Work through lessons in order in the left outline. Finishing a lesson\'s challenge earns <b>XP</b>; finishing a whole module earns <b>★ Stars</b>. Locked lessons unlock as you go, and your XP fills the bar in the footer toward the next level.</p>'
    + '<h3><span class="mdi mdi-view-split-vertical"></span>The three tabs</h3><p><b>Learn</b> is the lesson. <b>Code</b> is your game\'s code, with a file list on the left — <b>Save</b> keeps changes and <b>Run</b> plays them. <b>Play</b> runs your game and shows live score and settings.</p>'
    + '<h3><span class="mdi mdi-robot"></span>The AI Assistant</h3><p>On the right, ask the AI to change or add features to your game (it edits your code), or ask questions like "what does this function do?"</p>'
    + '<h3><span class="mdi mdi-star"></span>Stars & the Gallery</h3><p>Spend ★ Stars in the Gallery to unlock new example games, then <b>Open</b> one to make it your own.</p>'
    + '<h3><span class="mdi mdi-restart"></span>Testing</h3><p>Reset all saved progress (XP, Stars, unlocks, completed lessons) to try the app from scratch.</p>'
    + '<button class="gbtn" id="resetBtn"><span class="mdi mdi-delete-outline"></span>Reset my progress</button></div>';
}
function resetProgress() {
  modal({ title: 'Reset progress?', message: 'This clears all XP, Stars, unlocked games, and completed lessons on this browser. This cannot be undone.', okLabel: 'Reset everything',
    onOk: function () { localStorage.removeItem(SKEY); location.reload(); } });
}
function wirePage(page) {
  document.querySelectorAll('#page [data-buy]').forEach(function (b) { b.addEventListener('click', function () { buyAsset(b.getAttribute('data-buy')); }); });
  if (page === 'gallery') { var pb = $('publishBtn'); if (pb) pb.addEventListener('click', publishGame); }
  if (page === 'help') { var rb = $('resetBtn'); if (rb) rb.addEventListener('click', resetProgress); }
  if (page === 'docs') { document.querySelectorAll('#page [data-goto]').forEach(function (link) { link.addEventListener('click', function (e) { e.preventDefault(); var el = document.getElementById('doc-' + link.getAttribute('data-goto')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }); }
}

/* ---------- toast + modal ---------- */
let toastTimer;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200); }
function modal(opts) {
  const back = $('modalBack');
  back.innerHTML = '<div class="modal"><h3>' + opts.title + '</h3>' + (opts.message ? '<p>' + opts.message + '</p>' : '')
    + (opts.input ? '<input id="modalInput" placeholder="' + (opts.placeholder || '') + '">' : '')
    + '<div class="acts"><button class="cancel" id="modalCancel">Cancel</button><button class="ok" id="modalOk">' + (opts.okLabel || 'OK') + '</button></div></div>';
  back.hidden = false; const inp = $('modalInput'); if (inp) inp.focus();
  function close() { back.hidden = true; back.innerHTML = ''; }
  $('modalCancel').addEventListener('click', close);
  $('modalOk').addEventListener('click', function () { const v = inp ? inp.value : null; close(); if (opts.onOk) opts.onOk(v); });
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('modalOk').click(); });
}

/* ---------- resizers (grow-only) ---------- */
function makeResizer(handle, side) {
  handle.addEventListener('mousedown', function (e) {
    e.preventDefault(); const startX = e.clientX; const editor = $('editor');
    const startL = parseInt(getComputedStyle(editor).getPropertyValue('--leftw'));
    const startR = parseInt(getComputedStyle(editor).getPropertyValue('--rightw'));
    function move(ev) { const dx = ev.clientX - startX;
      if (side === 'left') editor.style.setProperty('--leftw', Math.max(280, Math.min(520, startL + dx)) + 'px');
      else editor.style.setProperty('--rightw', Math.max(320, Math.min(560, startR - dx)) + 'px'); }
    function up() { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  });
}
$('editor').style.setProperty('--leftw', '280px'); $('editor').style.setProperty('--rightw', '320px');
makeResizer($('resLeft'), 'left'); makeResizer($('resRight'), 'right');

/* ---------- boot ---------- */
renderFooter(); showPage('courses');
loadCourse().then(function () { renderOutline(); selectLesson(0); })
  .catch(function () { $('lessonBody').innerHTML = '<p style="color:var(--muted)">Could not load the course content. Is the server running?</p>'; });
