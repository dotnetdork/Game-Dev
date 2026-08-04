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
    head.innerHTML = '<span class="tri">' + (modLocked ? '▸' : '▾') + '</span><span class="mdi ' + (modLocked ? 'mdi-lock' : 'mdi-folder') + '"></span><span class="lbl">' + m.name + '</span>';
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
  return '<div class="eyebrow">' + f.m.name + '</div>'
    + '<h1>' + f.l.t + '</h1>'
    + (f.l.d ? '<p class="lead">' + f.l.d + '</p>' : '')
    + f.l.body
    + '<div class="challenge"><div class="ch-h"><span class="mdi mdi-flag-checkered"></span> Challenge</div>'
    + '<div style="color:var(--muted);margin-bottom:6px;">Finish the challenge to complete this lesson and unlock the next one.</div>'
    + '<button class="btn-primary" id="completeBtn"' + (done ? ' disabled' : '') + '><span class="mdi mdi-' + (done ? 'check' : 'flag-checkered') + '"></span>' + (done ? 'Completed  (+' + f.l.xp + ' XP)' : 'Complete challenge  (+' + f.l.xp + ' XP)') + '</button></div>';
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
  document.querySelectorAll('.ai-mode').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === aiMode); });
  const tag = $('aiModelTag'); if (tag) { tag.textContent = aiMode === 'tutor' ? 'Tutor' : 'Build'; tag.title = aiModels[aiMode] || ''; }
  if (aiMode === 'tutor') { const inp = $('aiText'), btn = $('aiSend'); if (inp) { inp.disabled = false; inp.placeholder = 'Ask the tutor about this lesson...'; } if (btn) btn.disabled = false; }
  else { applyAIMode(currentAIMode); }
}
function renderRunCells(root) {
  root.querySelectorAll('pre > code.language-run').forEach(function (code) {
    const pre = code.parentNode; const src = code.textContent;
    const cell = document.createElement('div'); cell.className = 'runcell';
    const ta = document.createElement('textarea'); ta.value = src; ta.spellcheck = false;
    ta.rows = Math.min(14, Math.max(3, src.split('\n').length));
    const bar = document.createElement('div'); bar.className = 'runbar';
    const btn = document.createElement('button'); btn.className = 'runbtn'; btn.innerHTML = '<span class="mdi mdi-play"></span>Run';
    const out = document.createElement('iframe'); out.className = 'runout'; out.setAttribute('sandbox', 'allow-scripts');
    btn.addEventListener('click', function () {
      const userCode = ta.value.replace(/<\/(script)/gi, '<\\/$1');
      out.srcdoc = '<!doctype html><body style="margin:0;font:12.5px Consolas,monospace;color:#cfe0f2;background:#08121f;padding:8px"><pre id="o" style="margin:0;white-space:pre-wrap"></pre><scr' + 'ipt>var o=document.getElementById("o");function w(){o.textContent+=[].slice.call(arguments).join(" ")+"\\n";}console.log=w;console.info=w;console.warn=w;console.error=function(){o.textContent+="\\u26a0 "+[].slice.call(arguments).join(" ")+"\\n";};try{\n' + userCode + '\n}catch(e){o.textContent+="\\u26a0 "+e.message+"\\n";}</scr' + 'ipt></body>';
      out.style.display = 'block';
    });
    bar.appendChild(btn); cell.appendChild(ta); cell.appendChild(bar); cell.appendChild(out);
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
/* ```quiz  (provisional syntax) — Parsons (drag-and-drop) or multiple-choice, checked locally */
function renderQuizCells(root) {
  root.querySelectorAll('pre > code.language-quiz').forEach(function (code) {
    let q; try { q = jsyaml.load(code.textContent) || {}; } catch (e) { q = {}; }
    const pre = code.parentNode;
    const cell = document.createElement('div'); cell.className = 'quizcell';
    cell.innerHTML = '<div class="quiz-h"><span class="mdi mdi-help-circle-outline"></span>' + (q.prompt || 'Quick check') + '</div>';
    const body = document.createElement('div'); body.className = 'quiz-body'; cell.appendChild(body);
    const result = document.createElement('div'); result.className = 'quiz-result';
    const check = document.createElement('button'); check.className = 'quiz-check'; check.textContent = 'Check';
    if (q.type === 'parsons') {
      const lines = (q.lines || []); let order = shuffleOrder(lines.length); let dragFrom = null;
      const list = document.createElement('div'); list.className = 'parsons';
      function draw() {
        list.innerHTML = '';
        order.forEach(function (li, pos) {
          const row = document.createElement('div'); row.className = 'parsons-row'; row.draggable = true;
          const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.innerHTML = '<span class="mdi mdi-drag-horizontal-variant"></span>';
          const c = document.createElement('code'); c.textContent = lines[li];
          row.appendChild(handle); row.appendChild(c);
          row.addEventListener('dragstart', function () { dragFrom = pos; row.classList.add('dragging'); });
          row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
          row.addEventListener('dragover', function (e) { e.preventDefault(); row.classList.add('over'); });
          row.addEventListener('dragleave', function () { row.classList.remove('over'); });
          row.addEventListener('drop', function (e) {
            e.preventDefault(); row.classList.remove('over');
            if (dragFrom === null || dragFrom === pos) { dragFrom = null; return; }
            const moved = order.splice(dragFrom, 1)[0]; order.splice(pos, 0, moved); dragFrom = null; draw();
          });
          list.appendChild(row);
        });
      }
      draw(); body.appendChild(list);
      check.addEventListener('click', function () {
        const ok = order.every(function (v, i) { return v === i; });
        result.className = 'quiz-result ' + (ok ? 'ok' : 'no'); result.textContent = ok ? 'Correct — nice ordering!' : 'Not yet — drag the lines into the right order.';
      });
    } else {
      const opts = (q.options || []); let chosen = -1; const nm = 'q' + Math.random().toString(36).slice(2, 8); const rows = [];
      opts.forEach(function (opt, i) {
        const row = document.createElement('label'); row.className = 'mcq-opt'; rows.push(row);
        const radio = document.createElement('input'); radio.type = 'radio'; radio.name = nm;
        radio.addEventListener('change', function () { chosen = i; });
        const span = document.createElement('span'); span.textContent = opt;
        row.appendChild(radio); row.appendChild(span); body.appendChild(row);
      });
      check.addEventListener('click', function () {
        if (chosen < 0) { result.className = 'quiz-result'; result.textContent = 'Pick an answer first.'; return; }
        const ans = Number(q.answer); const ok = chosen === ans;
        rows.forEach(function (r, i) { r.classList.remove('correct', 'wrong'); if (i === ans) r.classList.add('correct'); else if (i === chosen) r.classList.add('wrong'); });
        result.className = 'quiz-result ' + (ok ? 'ok' : 'no');
        result.textContent = ok ? 'Correct!' : (q.explain ? 'Not quite — ' + q.explain : 'Not quite — the highlighted answer is correct.');
      });
    }
    body.appendChild(check); cell.appendChild(result);
    pre.parentNode.replaceChild(cell, pre);
  });
}
/* ```tutor  (provisional syntax) — a small inline button that routes a scoped question into the AI panel */
function renderTutorCells(root) {
  root.querySelectorAll('pre > code.language-tutor').forEach(function (code) {
    let t; try { t = jsyaml.load(code.textContent) || {}; } catch (e) { t = {}; }
    const pre = code.parentNode; const q = t.prompt || t.question || 'Ask the tutor about this.';
    const cell = document.createElement('div'); cell.className = 'tutor-inline';
    const icon = document.createElement('span'); icon.className = 'mdi mdi-robot-happy-outline';
    const label = document.createElement('span'); label.textContent = q;
    const btn = document.createElement('button'); btn.innerHTML = '<span class="mdi mdi-message-question-outline"></span>Ask the tutor';
    btn.addEventListener('click', function () { setAIMode('tutor'); askTutor(q, t.context || currentLessonText); });
    cell.appendChild(icon); cell.appendChild(label); cell.appendChild(btn);
    pre.parentNode.replaceChild(cell, pre);
  });
}
function selectLesson(idx) {
  curIdx = idx; const f = flat[idx];
  $('crumb').dataset.lesson = f.m.name + ': ' + f.l.t;
  $('lessonBody').innerHTML = lessonBodyHTML(f);
  currentLessonText = ($('lessonBody').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
  renderRunCells($('lessonBody'));
  renderQuizCells($('lessonBody'));
  renderTutorCells($('lessonBody'));
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
}
document.querySelectorAll('.vtab').forEach(function (btn) { btn.addEventListener('click', function () { switchView(btn.getAttribute('data-view')); }); });
function startGame() { // build a self-contained page from the browser-side project and run it in the iframe (no server)
  const ordered = ['game.js'].concat(fileNames().filter(function (n) { return n !== 'game.js' && n !== 'main.js'; }));
  if (typeof project.files['main.js'] === 'string') ordered.push('main.js');
  const scripts = ordered.map(function (n) { return '<' + 'script>\n' + (project.files[n] || '') + '\n<' + '/script>'; }).join('\n');
  const html = '<!doctype html><html><head><meta charset="utf-8">'
    + '<style>html,body{margin:0;height:100%;background:#06101c;overflow:hidden}#game{width:100%;height:100vh}</style></head><body>'
    + '<div id="game"></div>\n'
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
document.querySelectorAll('.ai-mode').forEach(function (b) { b.addEventListener('click', function () { setAIMode(b.getAttribute('data-mode')); }); });
fetch('/api/info').then(function (r) { return r.json(); }).then(function (d) { aiModels = d.agents || { coder: d.model, tutor: d.model }; setAIMode(aiMode); }).catch(function () {});

/* ---------- page router ---------- */
function showPage(page) {
  document.querySelectorAll('.navitem').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-page') === page); });
  if (page === 'courses') { $('editor').hidden = false; $('page').hidden = true; return; }
  stopGame(); $('editor').hidden = true; $('page').hidden = false;
  const pg = $('page');
  if (page === 'gallery') pg.innerHTML = renderGallery();
  else if (page === 'showcase') pg.innerHTML = renderShowcase();
  else if (page === 'leaderboards') pg.innerHTML = renderBoard();
  else if (page === 'docs') pg.innerHTML = renderDocs();
  else if (page === 'help') pg.innerHTML = renderHelp();
  wirePage(page);
}
document.querySelectorAll('.navitem').forEach(function (b) { b.addEventListener('click', function () { showPage(b.getAttribute('data-page')); }); });

/* ---------- gallery ---------- */
const examples = [
  { id: 'starcatcher', name: 'Star Catcher', mdi: 'mdi-star-four-points', col: '#2b6cb0', cost: 0, tags: ['Arcade', 'Easy'], desc: 'Catch falling stars and dodge bombs. The starter game.', code: STAR_CODE },
  { id: 'skydodge', name: 'Sky Dodge', mdi: 'mdi-cube-outline', col: '#2c7a7b', cost: 150, tags: ['Dodge', 'Easy'], desc: 'Slide left and right to dodge falling blocks as long as you can.', code: SKY_CODE },
  { id: 'coinrush', name: 'Coin Rush', mdi: 'mdi-circle-multiple', col: '#b7791f', cost: 150, tags: ['Collect', 'Easy'], desc: 'Race the clock to grab as many coins as you can.', code: COIN_CODE },
  { id: 'paddlebounce', name: 'Paddle Bounce', mdi: 'mdi-circle-double', col: '#6b46c1', cost: 175, tags: ['Reflex', 'Medium'], desc: 'Keep the ball bouncing on your paddle.', code: PADDLE_CODE },
  { id: 'snake', name: 'Snake', mdi: 'mdi-snake', col: '#276749', cost: 200, soon: true, tags: ['Classic', 'Medium'], desc: 'Coming soon — grow the snake without crashing into yourself.' },
  { id: 'breakout', name: 'Brick Breaker', mdi: 'mdi-view-grid', col: '#9b2c2c', cost: 200, soon: true, tags: ['Arcade', 'Medium'], desc: 'Coming soon — smash all the bricks with the ball.' },
  { id: 'whack', name: 'Whack-a-Star', mdi: 'mdi-gesture-tap', col: '#805ad5', cost: 150, soon: true, tags: ['Reflex', 'Easy'], desc: 'Coming soon — tap the stars before they vanish.' },
  { id: 'space', name: 'Space Blaster', mdi: 'mdi-rocket-launch', col: '#2b6cb0', cost: 250, soon: true, tags: ['Shooter', 'Hard'], desc: 'Coming soon — blast asteroids before they reach you.' },
  { id: 'maze', name: 'Maze Runner', mdi: 'mdi-map-marker-path', col: '#1a936f', cost: 200, soon: true, tags: ['Puzzle', 'Medium'], desc: 'Coming soon — find your way to the exit.' },
  { id: 'flappy', name: 'Flap Hero', mdi: 'mdi-bird', col: '#c05621', cost: 175, soon: true, tags: ['Reflex', 'Hard'], desc: 'Coming soon — flap through the gaps.' }
];
function renderGallery() {
  const cards = examples.map(function (e) {
    const owned = !!state.unlocked[e.id];
    let btn;
    if (e.soon) btn = '<button class="gbtn locked" disabled>Coming soon</button>';
    else if (owned) btn = '<button class="gbtn owned-btn" data-open="' + e.id + '"><span class="mdi mdi-pencil"></span>Open</button>';
    else btn = '<button class="gbtn" data-buy="' + e.id + '"><span class="mdi mdi-lock-open-variant"></span>Unlock</button>';
    const price = owned ? '<span class="owned"><span class="mdi mdi-check-decagram"></span>Owned</span>' : '<span class="cost"><span class="mdi mdi-star"></span>' + e.cost + '</span>';
    const tags = e.tags.map(function (t) { return '<span class="chip">' + t + '</span>'; }).join('');
    return '<div class="gcard"><div class="art" style="background:linear-gradient(135deg,' + e.col + ',#0b1a2e)"><span class="mdi ' + e.mdi + '"></span></div>'
      + '<div class="body"><h3>' + e.name + '</h3><div class="tags">' + tags + '</div><p>' + e.desc + '</p><div class="cta">' + price + btn + '</div></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-view-grid"></span>Gallery</h2><p class="sub">Example games for ' + course.name + '. Unlock with ★ Stars, then open one to make it your own.</p></div></div><div class="cardgrid">' + cards + '</div>';
}
function openExample(id) {
  const ex = examples.find(function (e) { return e.id === id; });
  modal({ title: 'Open "' + ex.name + '"?', message: 'This loads the game into your browser as your own editable copy, replacing your current game.js. Your other scripts are kept, and the original template stays safe.', okLabel: 'Open it',
    onOk: function () {
      project.files['game.js'] = ex.code;
      if (project.order.indexOf('game.js') < 0) project.order.unshift('game.js');
      if (typeof project.files['main.js'] !== 'string') { project.files['main.js'] = BOOT_CODE; project.order.push('main.js'); }
      currentFile = 'game.js'; saveProject();
      toast('Loaded ' + ex.name + '.'); showPage('courses'); switchView('play');
    } });
}
function buyExample(id) {
  const ex = examples.find(function (e) { return e.id === id; });
  if (state.stars < ex.cost) { toast('Not enough Stars — you need ★ ' + ex.cost + '.'); return; }
  modal({ title: 'Unlock "' + ex.name + '"?', message: 'This costs ★ ' + ex.cost + '. You have ★ ' + state.stars + '.', okLabel: 'Unlock',
    onOk: function () { state.stars -= ex.cost; state.unlocked[id] = true; saveState(); toast('Unlocked ' + ex.name + '!'); showPage('gallery'); } });
}

/* ---------- showcase ---------- */
const sampleShowcase = [
  { name: 'Neon Jumper', author: 'Ava', mdi: 'mdi-rocket', col: '#2b6cb0', plays: 214 },
  { name: 'Bug Squash', author: 'Leo', mdi: 'mdi-bug', col: '#276749', plays: 187 },
  { name: 'Cloud Hopper', author: 'Mia', mdi: 'mdi-cloud', col: '#6b46c1', plays: 143 },
  { name: 'Laser Cats', author: 'Sam', mdi: 'mdi-cat', col: '#9b2c2c', plays: 98 }
];
function avatarStyle(name) { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return 'background:hsl(' + (Math.abs(h) % 360) + ' 62% 58%)'; }
function renderShowcase() {
  const mine = (state.published || []).map(function (p) { return { name: p.name, author: 'You', mdi: 'mdi-gamepad-variant', col: '#0f6', plays: 0 }; });
  const all = mine.concat(sampleShowcase);
  const cards = all.map(function (g) {
    return '<div class="scard"><div class="art" style="background:linear-gradient(135deg,' + g.col + ',#0b1a2e)"><span class="mdi ' + g.mdi + '"></span><div class="play"><span class="mdi mdi-play-circle"></span></div></div>'
      + '<div class="body"><div class="avatar" style="' + avatarStyle(g.author) + '">' + g.author.charAt(0).toUpperCase() + '</div>'
      + '<div class="meta"><h3>' + g.name + '</h3><div class="by">by ' + g.author + '</div></div>'
      + '<span class="stat"><span class="mdi mdi-play"></span>' + g.plays + '</span></div></div>';
  }).join('');
  return '<div class="phead"><div><h2><span class="mdi mdi-star-box-multiple"></span>Showcase</h2><p class="sub">Games students have published. Hover a card to preview (video clips coming later).</p></div><button class="gbtn" id="publishBtn"><span class="mdi mdi-upload"></span>Publish my game</button></div><div class="cardgrid">' + cards + '</div>';
}
function publishGame() {
  modal({ title: 'Publish your game', message: 'Give your game a title to add it to the Showcase.', input: true, placeholder: 'My Awesome Game', okLabel: 'Publish',
    onOk: function (name) { if (!name) return; state.published = state.published || []; state.published.unshift({ name: name.trim(), date: Date.now() }); saveState(); toast('Published to the Showcase!'); showPage('showcase'); } });
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
  document.querySelectorAll('#page [data-buy]').forEach(function (b) { b.addEventListener('click', function () { buyExample(b.getAttribute('data-buy')); }); });
  document.querySelectorAll('#page [data-open]').forEach(function (b) { b.addEventListener('click', function () { openExample(b.getAttribute('data-open')); }); });
  if (page === 'showcase') { var pb = $('publishBtn'); if (pb) pb.addEventListener('click', publishGame); }
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
