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

/* ---------- game info ---------- */
function loadSettings() { const cfg = parseConfig(project.files[configFile()] || ''); const box = $('infoSettings'); box.innerHTML = ''; Object.keys(cfg).forEach(function (k) { const row = document.createElement('div'); row.className = 'setrow'; row.innerHTML = '<span>' + k + '</span><b>' + cfg[k] + '</b>'; box.appendChild(row); }); }
