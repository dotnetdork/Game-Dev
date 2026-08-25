/* files.js — The file tree (source + assets folders), asset detail popup, new/open/save/delete/reset of project files, and the Game Info settings list. */
/* ---------- files ---------- */
let folderOpen = { source: true, assets: true };
function folderHead(id, label, icon, count) {
  const h = document.createElement('div'); h.className = 'folderhead';
  h.innerHTML = '<span class="caret mdi ' + (folderOpen[id] ? 'mdi-menu-down' : 'mdi-menu-right') + '"></span>'
    + '<span class="mdi ' + icon + '"></span>' + label + '<span class="fcount">' + count + '</span>';
  h.addEventListener('click', function () { folderOpen[id] = !folderOpen[id]; refreshFiles(); });
  return h;
}
function refreshFiles() {
  const list = $('fileList'); list.innerHTML = '';
  const names = fileNames();
  list.appendChild(folderHead('source', 'source', 'mdi-folder-outline', names.length));
  if (folderOpen.source) {
    names.forEach(function (name) {
      const row = document.createElement('div'); row.className = 'filerow' + (name === currentFile ? ' active' : '');
      const icon = document.createElement('span'); icon.className = 'mdi mdi-language-javascript';
      const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = name;
      row.appendChild(icon); row.appendChild(lbl);
      row.addEventListener('click', function () { openFile(name); });
      if (STARTER[name] === undefined) {
        const del = document.createElement('button'); del.className = 'del'; del.title = 'Delete ' + name; del.innerHTML = '<span class="mdi mdi-close"></span>';
        del.addEventListener('click', function (e) { e.stopPropagation(); deleteFile(name); });
        row.appendChild(del);
      } else {
        const rst = document.createElement('button'); rst.className = 'del rst'; rst.title = 'Reset ' + name + ' to the default'; rst.innerHTML = '<span class="mdi mdi-restore"></span>';
        rst.addEventListener('click', function (e) { e.stopPropagation(); resetFile(name); });
        row.appendChild(rst);
      }
      list.appendChild(row);
    });
  }
  renderAssetFolder(list);
}
function renderAssetFolder(list) {
  const owned = (typeof ownedAssets === 'function') ? ownedAssets() : [];
  list.appendChild(folderHead('assets', 'assets', 'mdi-folder-image', owned.length));
  if (!folderOpen.assets) return;
  if (!owned.length) { const em = document.createElement('div'); em.className = 'assetrow empty'; em.textContent = 'Buy assets in the Store'; list.appendChild(em); return; }
  owned.slice().sort(function (a, b) { return a.key < b.key ? -1 : 1; }).forEach(function (a) {
    const r = document.createElement('div'); r.className = 'assetrow'; r.title = a.name;
    const thumb = a.type === 'image' ? '<img src="' + a.file + '" alt="">' : '<span class="mdi mdi-music-note"></span>';
    r.innerHTML = thumb + '<span class="lbl">' + a.key + '</span>';
    r.addEventListener('click', function () { showAssetInfo(a); });
    list.appendChild(r);
  });
}
function showAssetInfo(a) {
  const media = a.type === 'image'
    ? '<div class="asset-preview"><img src="' + a.file + '" alt=""></div>'
    : '<div class="asset-preview snd"><button id="assetPlay" class="gbtn"><span class="mdi mdi-play"></span>Play sound</button></div>';
  const kind = (a.type === 'image' ? 'Image' : 'Sound') + ' · ' + a.cat;
  const info = '<div class="asset-info">'
    + '<div class="ai-row"><span>Type</span><b>' + kind + '</b></div>'
    + '<div class="ai-row"><span>Name to use</span><code>' + a.key + '</code></div>'
    + '<div class="ai-row"><span>In your code</span><code>' + a.hint + '</code></div>'
    + '<p class="ai-desc">' + (a.desc || '') + '</p></div>';
  modal({ title: a.name, message: media + info, okLabel: 'Insert into code', onOk: function () {
    if (typeof codeEditor !== 'undefined' && !$('view-code').hidden) { codeEditor.replaceSelection("'" + a.key + "'"); codeEditor.focus(); toast('Inserted "' + a.key + '"'); }
    else { toast('Open the Code tab, then Insert.'); }
  } });
  const pb = $('assetPlay'); if (pb) pb.addEventListener('click', function () { try { new Audio('/' + a.file).play(); } catch (e) {} });
}
function deleteFile(name) {
  modal({ title: 'Delete ' + name + '?', message: 'This removes the file from your project. This cannot be undone.', okLabel: 'Delete', onOk: function () {
    delete project.files[name]; const i = project.order.indexOf(name); if (i >= 0) project.order.splice(i, 1);
    if (currentFile === name) currentFile = 'game.js';
    saveProject(); refreshFiles(); loadCode(); toast('Deleted ' + name);
  } });
}
function openFile(name) { if (reviewing) endReview(); if (!$('view-code').hidden) { project.files[currentFile] = codeEditor.getValue(); saveProject(); } currentFile = name; $('crumb').textContent = name; refreshFiles(); loadCode(); }
function loadCode() { if (reviewing) { showDiffInEditor(reviewing); return; } const t = project.files[currentFile]; codeEditor.setValue(typeof t === 'string' ? formatJS(t) : '// (empty file)'); codeEditor.refresh(); }
$('newFileBtn').addEventListener('click', function () {
  modal({ title: 'New script', message: 'Name your script (letters, numbers, - or _). ".js" is added automatically.', input: true, placeholder: 'enemy.js', okLabel: 'Create',
    onOk: function (name) { if (!name) return; name = name.trim(); if (!/\.js$/.test(name)) name += '.js';
      if (!/^[A-Za-z0-9_-]+\.js$/.test(name)) { toast('Use letters, numbers, - or _ only.'); return; }
      if (project.files[name] !== undefined) { toast('A file with that name already exists.'); return; }
      project.files[name] = '// ' + name + '\n// Code you write here runs with the game when you press Run.\n';
      project.order.push(name); saveProject(); refreshFiles(); openFile(name); toast('Created ' + name); } });
});
function saveFile(cb) { if (reviewing) { toast('Apply or dismiss the suggested change first.'); return; } project.files[currentFile] = codeEditor.getValue(); saveProject(); toast('Saved ✓'); if (cb) cb(); } // saves to the browser only
$('saveBtn').addEventListener('click', function () { saveFile(); });
$('runBtn').addEventListener('click', function () { saveFile(function () { runGame(); }); });
document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !$('view-code').hidden) { e.preventDefault(); saveFile(); } });

/* ---------- the Inspector ----------
   These rows used to read CONFIG out and print it. Now they change it: drag a slider and the number
   in config.js changes, which is the tinkering loop the whole course is built on — the fastest way
   to learn what `gravity` means is to pull it about and watch.

   The student's FILE stays the source of truth. Nothing is held beside it: every commit goes through
   mergeConfig into project.files[configFile()], and the panel is rebuilt by reading that file back.
   A panel holding its own copy of the numbers would be a second answer to "what is gravity", and the
   two would drift the moment anyone typed in the editor. */

/* Ranges for the four numbers the starter ships. Chosen to be interesting rather than safe: the low
   end of each is a real (silly) game, not a sensible minimum, because "what if gravity were zero"
   is the question a twelve-year-old actually has.
   No descriptions. These four could have one and a variable the student adds in module three could
   not, and a panel where the built-in rows are explained and their own are bare says their code is
   the second-class kind. The name and the number are the same information for every row. */
const SETTING_RANGE = {
  moveSpeed:  { min: 0, max: 600,  step: 10 },
  jumpPower:  { min: 0, max: 1200, step: 10 },
  gravity:    { min: 0, max: 2000, step: 25 },
  coinBounce: { min: 0, max: 1,    step: 0.05 }
};
/* A key we have never seen — the student added it, or a later lesson did. Showing it read-only
   would be the old behaviour for exactly the numbers most likely to be theirs, so a range is
   derived from the value instead: room to triple it, and down to zero (or to its mirror, if it is
   negative, since a negative number that cannot cross zero cannot be explored). */
function deriveRange(v) {
  const lo = v < 0 ? v * 3 : 0;
  const hi = v > 0 ? Math.max(v * 3, 1) : Math.max(Math.abs(v) * 3, 1);
  const span = hi - lo;
  const step = span >= 500 ? 10 : span >= 50 ? 1 : span >= 5 ? 0.1 : 0.01;
  return { min: lo, max: hi, step: step };
}
function settingRange(k, v) {
  const r = SETTING_RANGE[k] || deriveRange(v);
  // A hand-edited value can sit outside the range we chose. Widen rather than clamp: snapping the
  // student's own number to our maximum the moment they opened this panel would be the panel
  // rewriting their file for them, which is the one thing it must never do.
  return { min: Math.min(r.min, v), max: Math.max(r.max, v), step: r.step };
}
/* Slider values arrive as strings and come back through arithmetic, so 0.3 + 0.05 is
   0.35000000000000003 — and mergeConfig writes whatever it is given straight into the file. */
function roundToStep(v, step) {
  const dp = (String(step).split('.')[1] || '').length;
  return Number(Number(v).toFixed(dp));
}

function loadSettings() {
  const file = configFile();
  const cfg = parseConfig(project.files[file] || '');
  const hd = $('infoHd'); if (hd) hd.textContent = file;
  const box = $('infoSettings'); box.innerHTML = '';
  const keys = Object.keys(cfg);
  if (!keys.length) {
    const em = document.createElement('div'); em.className = 'setrow empty';
    em.textContent = 'No CONFIG numbers found in ' + file + '.';
    box.appendChild(em); return;
  }
  keys.forEach(function (k) {
    const v = cfg[k], r = settingRange(k, v);
    const row = document.createElement('div'); row.className = 'setrow';
    const head = document.createElement('div'); head.className = 'set-hd';
    const name = document.createElement('span'); name.className = 'set-name'; name.textContent = k;
    const val = document.createElement('b'); val.className = 'set-val'; val.textContent = v;
    head.appendChild(name); head.appendChild(val);
    const sl = document.createElement('input');
    sl.type = 'range'; sl.min = r.min; sl.max = r.max; sl.step = r.step; sl.value = v;
    sl.className = 'set-slider';
    sl.setAttribute('aria-label', k);
    // input fires the whole way through the drag, change only on release. The readout follows the
    // thumb so the number is never behind the hand; the file is written once, at the end, because
    // rebuilding the game on every pixel of a drag would make it unusable.
    sl.addEventListener('input', function () { val.textContent = roundToStep(sl.value, r.step); });
    sl.addEventListener('change', function () { commitSetting(k, roundToStep(sl.value, r.step)); });
    row.appendChild(head); row.appendChild(sl);
    box.appendChild(row);
  });
}

/* One number, written into the student's file. Deliberately NOT refreshAfterEdit(): that reloads
   this panel too, which would tear out the slider the student's hand is still on. Everything else
   it does still has to happen. */
function commitSetting(k, v) {
  const file = configFile(), before = project.files[file] || '';
  const obj = {}; obj[k] = v;
  const after = mergeConfig(before, obj);
  if (after === before) return;
  // Same guard the AI's config edits use: a merge that produced unbalanced brackets means the
  // regex matched something it should not have, and writing it would break the student's game.
  if (!validJS(after)) { toast('Could not change ' + k + ' — check ' + file + ' for a typo.'); return; }
  project.files[file] = after; saveProject();
  if (typeof isGameRunning === 'function' && isGameRunning()) startGame();  // watch it land
  if (!$('view-code').hidden) loadCode();
}
