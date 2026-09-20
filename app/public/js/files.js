/* files.js — The file tree (source + assets folders), asset detail popup, new/open/save/delete/reset of project files, and the Game Info settings list. */
/* ---------- files ---------- */
let folderOpen = { docs: true, source: true, assets: true };
/* The folder itself is the open/closed control — no separate caret.
   A left/down triangle beside a label is the shape of a SELECT, and this is not one: nothing is
   being chosen, a section is being folded away. The folder icon says the same thing without the
   wrong promise, and it frees the row's left edge so a child's icon can line up directly under its
   folder's icon rather than landing between the caret and the folder, which is what made the
   indentation look accidental. */
function folderHead(id, label, count, addTitle, onAdd) {
  const open = !!folderOpen[id];
  const h = document.createElement('div');
  h.className = 'folderhead' + (open ? ' open' : '');
  h.setAttribute('role', 'button');
  h.setAttribute('tabindex', '0');
  h.setAttribute('aria-expanded', open ? 'true' : 'false');
  h.innerHTML = '<span class="mdi ' + (open ? 'mdi-folder-open-outline' : 'mdi-folder-outline') + '"></span>'
    + '<span class="fname">' + label + '</span><span class="fcount">' + count + '</span>';
  const toggle = function () { folderOpen[id] = !folderOpen[id]; refreshFiles(); };
  h.addEventListener('click', toggle);
  h.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  if (onAdd) {
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'rowbtn fadd'; add.title = addTitle;
    add.setAttribute('aria-label', addTitle);
    add.innerHTML = '<span class="mdi mdi-plus"></span>';
    add.addEventListener('click', function (e) { e.stopPropagation(); onAdd(); });
    h.appendChild(add);
  }
  return h;
}
function refreshFiles() {
  const list = $('fileList'); list.innerHTML = '';
  /* Code and assets. There used to be a `documents` folder above these holding design.md, and it
     went when the Design tab arrived: the board IS that file's editor, and a second way in — a row
     in this tree that opens the same writing as raw markdown — is a second place to look for one
     thing. The file is still in the project, still written by the board and still read by every
     `contains: {file: design.md}` check; it is simply not somewhere you browse to any more. */
  const code = codeFileNames();

  const fileRow = function (name) {
    const row = document.createElement('div'); row.className = 'filerow' + (name === currentFile ? ' active' : '');
    const icon = document.createElement('span');
    icon.className = 'mdi ' + (isCodeFile(name) ? 'mdi-language-javascript' : 'mdi-file-document-outline');
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = name;
    row.appendChild(icon); row.appendChild(lbl);
    row.addEventListener('click', function () { openFile(name); });
    if (STARTER[name] === undefined) {
      const del = document.createElement('button'); del.className = 'rowbtn'; del.title = 'Delete ' + name; del.innerHTML = '<span class="mdi mdi-close"></span>';
      del.addEventListener('click', function (e) { e.stopPropagation(); deleteFile(name); });
      row.appendChild(del);
    } else {
      const rst = document.createElement('button'); rst.className = 'rowbtn rst'; rst.title = 'Reset ' + name + ' to the default'; rst.innerHTML = '<span class="mdi mdi-restore"></span>';
      rst.addEventListener('click', function (e) { e.stopPropagation(); resetFile(name); });
      row.appendChild(rst);
    }
    list.appendChild(row);
  };

  list.appendChild(folderHead('source', 'source', code.length, 'New script', newScript));
  if (folderOpen.source) code.forEach(fileRow);
  renderAssetFolder(list);
}
/* The assets folder shows what this project LOADS, not everything the student owns — those are
   different things now, because a 400-tile set loaded on every Run is 400 requests. `+` adds from
   what they own, the `x` on a row takes it out again. Nothing is deleted by removing it: it stays
   bought, and `+` puts it straight back. */
function assetThumb(a) {
  if (a.type === 'audio') return '<span class="mdi mdi-music-note"></span>';
  if (a.type === 'spritesheet') return '<span class="mdi mdi-view-grid-outline"></span>';
  return '<img src="' + a.file + '" alt="" loading="lazy">';
}
function renderAssetFolder(list) {
  const inp = (typeof projectAssets === 'function') ? projectAssets() : [];
  const owned = (typeof ownedAssets === 'function') ? ownedAssets() : [];
  list.appendChild(folderHead('assets', 'assets', inp.length,
    'Add something you own to this project', openAssetPicker));
  if (!folderOpen.assets) return;
  if (!inp.length) {
    const em = document.createElement('div'); em.className = 'assetrow empty';
    em.textContent = owned.length ? 'Nothing added yet — press +' : 'Buy assets in the Store';
    list.appendChild(em); return;
  }
  inp.slice().sort(function (a, b) { return a.key < b.key ? -1 : 1; }).forEach(function (a) {
    const r = document.createElement('div'); r.className = 'assetrow'; r.title = a.name;
    r.innerHTML = assetThumb(a) + '<span class="lbl">' + a.key + '</span>';
    r.addEventListener('click', function () { showAssetInfo(a); });
    const del = document.createElement('button');
    del.className = 'rowbtn'; del.title = 'Take ' + a.key + ' out of this project (you keep it)';
    del.innerHTML = '<span class="mdi mdi-close"></span>';
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      removeProjectAsset(a.key); refreshFiles();
      toast(a.key + ' removed from the project — you still own it.');
    });
    r.appendChild(del);
    list.appendChild(r);
  });
}

/* Everything owned that is not already in the project, searchable. Clicking a tile adds it and the
   tile disappears from the picker, so the panel is always "what could I still add?" — which is the
   question being asked. It stays open, because adding four things should not be four trips. */
let pickerQuery = '';
function openAssetPicker() {
  if (typeof ownedAssets !== 'function') return;
  modal({
    title: 'Add to this project',
    wide: true,
    /* `html` rather than `message`: modal() wraps message in a <p>, and a grid inside a paragraph
       is both wrong and narrower than it needs to be. */
    html: '<p class="pick-lead">Everything you own that is not in the project yet. '
      + 'Adding it means your game loads it — that is what makes the name work in your code.</p>'
      + '<input id="pickQ" type="search" placeholder="Search what you own…" aria-label="Search">'
      + '<div id="pickGrid" class="pick-grid"></div>',
    okLabel: 'Done', hideCancel: true
  });
  pickerQuery = '';
  const paint = function () {
    const grid = $('pickGrid'); if (!grid) return;
    const q = pickerQuery.toLowerCase().replace(/[\s_-]+/g, '');
    const avail = ownedAssets().filter(function (a) {
      if (inProject(a.key)) return false;
      if (!q) return true;
      return (a.key + a.name + a.cat).toLowerCase().replace(/[\s_-]+/g, '').indexOf(q) >= 0;
    });
    grid.innerHTML = '';
    if (!avail.length) {
      const em = document.createElement('p'); em.className = 'pick-empty';
      em.textContent = q ? 'Nothing you own matches that.' : 'Everything you own is already in the project.';
      grid.appendChild(em); return;
    }
    /* Capped, because owning a 400-tile set would otherwise build 400 tiles into a modal. The
       count tells them to search rather than scroll. */
    const show = avail.slice(0, 150);
    show.forEach(function (a) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick' + (a.type === 'image' ? '' : ' icon');
      b.title = a.name + '  ·  ' + a.key;
      /* The pack prefix is the same on every tile in a pack, so a truncated full key labels 150
         tiles identically — "1bit-platformer_t…" over and over. The tail is the part that tells
         them apart, and the full key is on the tooltip and goes in when they click. */
      const short = a.key.indexOf(a.pack + '_') === 0 ? a.key.slice(a.pack.length + 1) : a.key;
      b.innerHTML = assetThumb(a) + '<span>' + short + '</span>';
      b.addEventListener('click', function () {
        addProjectAssets(a.key); refreshFiles(); paint();
        toast('Added ' + a.key + ' — use "' + a.key + '" in your code.');
      });
      grid.appendChild(b);
    });
    if (avail.length > show.length) {
      const more = document.createElement('p'); more.className = 'pick-empty';
      more.textContent = 'Showing ' + show.length + ' of ' + avail.length + '. Search to narrow it down.';
      grid.appendChild(more);
    }
  };
  paint();
  const q = $('pickQ');
  if (q) {
    let t = 0;
    q.addEventListener('input', function () {
      clearTimeout(t); t = setTimeout(function () { pickerQuery = q.value.trim(); paint(); }, 160);
    });
    q.focus();
  }
}
function showAssetInfo(a) {
  const media = a.type === 'audio'
    ? '<div class="asset-preview snd"><button id="assetPlay" class="gbtn"><span class="mdi mdi-play"></span>Play sound</button></div>'
    : '<div class="asset-preview' + (a.type === 'spritesheet' ? ' sheet' : '') + '"><img src="' + a.file + '" alt=""></div>';
  const kind = (a.type === 'image' ? 'Image' : a.type === 'spritesheet' ? 'Sheet' : 'Sound') + ' · ' + a.cat;
  const info = '<div class="asset-info">'
    + '<div class="ai-row"><span>Type</span><b>' + kind + '</b></div>'
    + '<div class="ai-row"><span>Name to use</span><code>' + a.key + '</code></div>'
    /* A sheet is the one asset where the key alone is not enough to use it — the frame number is
       half the answer, so the range is stated rather than left to be discovered. */
    + (a.type === 'spritesheet'
        ? '<div class="ai-row"><span>Pictures on it</span><b>' + a.frames + ' (numbered 0 to ' + (a.frames - 1) + ')</b></div>'
          + '<div class="ai-row"><span>Each one</span><b>' + a.frameWidth + ' x ' + a.frameHeight + ' pixels</b></div>'
        : '')
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
/* The Code tab shows code. The Read/Edit toggle and the rendered-markdown preview that used to live
   here went with the documents folder: design.md is edited on the Design tab now, as a board, and
   the only markdown this tree could have opened was that one file. */
function loadCode() {
  /* THE BAR IS A VIEW OF `reviewing`, NOT A SECOND COPY OF IT.
     It used to be switched on in startReview and off in endReview and nowhere else, which made its
     visibility a separate piece of state that had to be kept in step by hand. Every path that
     repainted the editor without going through those two — and there are several, including the
     delayed loadCode() that fires when the editor tools finish downloading — could leave the diff
     on screen with no bar above it. A student then sees their change, correctly, and has no way to
     accept it: reported from the deployed build on 20 September.
     Deriving it here costs one line and makes the desync impossible, whichever path caused it. */
  const bar = $('reviewBar'); if (bar) bar.hidden = !reviewing;
  if (reviewing) { showDiffInEditor(reviewing); return; }
  const t = project.files[currentFile];
  /* formatJS is Prettier's JavaScript parser. Handed a page of prose it either throws or rewrites
     it into something that is no longer what the student typed, so only code gets formatted.
     setEditorLanguage switches the editor's own mode and linting to match — see editor.js. */
  const code = isCodeFile(currentFile);
  if (typeof setEditorLanguage === 'function') setEditorLanguage(currentFile);
  codeEditor.setValue(typeof t === 'string' ? (code ? formatJS(t) : t) : (code ? '// (empty file)' : ''));
  codeEditor.refresh();
}

/* Named, because two things call it: the New button in the footer and the + on the source folder. */
function newScript() {
  newFile('.js');
}

function newFile(ext) {
  const doc = ext === '.md';
  modal({
    title: doc ? 'New document' : 'New script',
    message: doc
      ? 'Name it (letters, numbers, - or _). ".md" is added automatically.'
      : 'Name it (letters, numbers, - or _). ".js" is added automatically.',
    input: true, placeholder: doc ? 'level-ideas.md' : 'enemy.js', okLabel: 'Create',
    onOk: function (name) {
      if (!name) return; name = name.trim();
      // An explicit extension is taken at its word either way, so a student who types enemy.js in
      // the documents folder gets a script rather than enemy.js.md.
      if (!/\.(js|md)$/i.test(name)) name += ext;
      if (!/^[A-Za-z0-9_-]+\.(js|md)$/i.test(name)) { toast('Use letters, numbers, - or _ only.'); return; }
      if (project.files[name] !== undefined) { toast('A file with that name already exists.'); return; }
      project.files[name] = isCodeFile(name)
        ? '// ' + name + '\n// Code you write here runs with the game when you press Run.\n'
        : '# ' + name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ') + '\n\nWrite here. This one is for you to read, not for the game to run.\n';
      project.order.push(name); saveProject(); refreshFiles(); openFile(name); toast('Created ' + name);
    }
  });
}
$('newFileBtn').addEventListener('click', newScript);
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
  paintSettingsNote();
}

/* What these sliders do, said under them once and always the same. It deliberately does not change
   with the state of the game: a note that rewords itself is a second thing to read, and the rule it
   states is true either way. Named after the file so it is clear WHERE the numbers really live. */
function paintSettingsNote() {
  const note = $('infoNote'); if (!note) return;
  note.textContent = 'While your game is running these only tune what you can see — the changes are'
    + ' not saved, and stopping the game puts them back. To change a number for good, edit it in '
    + configFile() + '.';
}

/* ---------- tuning while it runs, versus changing the game ----------
   These sliders used to do one thing everywhere: write the number into config.js and save. That is
   right in the Code tab, where the student is editing their game and can see the file change
   underneath them.
   It is wrong while the game is RUNNING in front of them. There they are playing — dragging gravity
   to see what happens — and a silent rewrite of their file is an edit they did not ask for and
   cannot see. Worse, there is no way back: the number they started from is gone.
   So while a game is running, a drag reaches the running game and nothing else. Stopping it puts
   every slider back to what the file says, which is also what the next run will use. Making a
   change stick is then a deliberate act: type it into config.js, or drag it here with the game
   stopped. The note under the panel says all of this — see loadSettings. */
function liveTuning() {
  return !!($('view-play') && !$('view-play').hidden
    && typeof isGameRunning === 'function' && isGameRunning());
}
/* Which sliders have been dragged away from the file during this run, so stopping the game knows
   there is something to put back. Cleared by resetLiveTuning(). */
let liveTuned = {};
function resetLiveTuning() {
  if (!Object.keys(liveTuned).length) return;
  liveTuned = {};
  if (typeof loadSettings === 'function') loadSettings();   // repaint from the file
}

/* One number, written into the student's file. Deliberately NOT refreshAfterEdit(): that reloads
   this panel too, which would tear out the slider the student's hand is still on. Everything else
   it does still has to happen. */
function commitSetting(k, v) {
  if (liveTuning()) {
    liveTuned[k] = true;
    sendConfigLive(k, v);
    return;                                   // the running game only; the file is untouched
  }
  const file = configFile(), before = project.files[file] || '';
  const obj = {}; obj[k] = v;
  const after = mergeConfig(before, obj);
  if (after === before) return;
  // Same guard the AI's config edits use: a merge that produced unbalanced brackets means the
  // regex matched something it should not have, and writing it would break the student's game.
  if (!validJS(after)) { toast('Could not change ' + k + ' — check ' + file + ' for a typo.'); return; }
  project.files[file] = after; saveProject();
  /* Push the number into the running game rather than rebuilding it. A rebuild threw away the
     level, the score and where the player was standing, which made the panel useless for the exact
     thing it exists to do — drag gravity and WATCH. See configBridge in game-runner.js.
     The file is still written first and stays the source of truth; this only stops the screen from
     resetting between the drag and the result. */
  if (typeof isGameRunning === 'function' && isGameRunning()) sendConfigLive(k, v);
  if (!$('view-code').hidden) loadCode();
}
