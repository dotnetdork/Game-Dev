# HANDOFF — LEAGUE Game Development Course

A fuller snapshot for whoever picks this up next (e.g. a fresh Claude Code session). The short, living status is in [`.ua/UA0-PROJECT-STATUS.md`](.ua/UA0-PROJECT-STATUS.md); this file is the orientation doc.

Last updated: 2026-08-05 · Repo: https://github.com/dotnetdork/LEAGUE-GameDev · branch `main`

---

## 1. What this is

A browser-based **Game Development course for The League of Amazing Programmers** (students ~10–15, on school-managed Chromebooks). It's a **web app styled like a game engine**: a left outline, a center viewport with Learn / Code / Play tabs, and a right AI-assistant dock. Students read/modify a real Phaser game, direct an AI to make changes, and build one shareable 2D game across the course.

Pedagogy (set by the client, Jed + Eric): **fun first**, coding as literacy, the AI does most of the heavy typing but students must **read the code, make design/architecture decisions, and direct the AI**.

## 2. Run it

```bash
cd app
npm install
cp .env.example .env      # then fill in as needed
npm start                 # → http://localhost:3000
```

- Node ≥ 18. Deps are tiny: `express`, `dotenv`.
- **AI is optional for the UI to run.** For the AI panel, either run **Ollama** locally (`qwen2.5-coder:7b` + `qwen2.5:7b`, sized for a 16 GB GPU) or set an **OpenRouter**/**Anthropic** key in `.env`. Keys stay server-side.
- `.env` is gitignored (holds keys) — never commit it.

## 3. Repo layout

```
Game Development/
├─ HANDOFF.md                 ← this file
├─ .ua/                       ← UA Framework docs (status, positioning, analysis, spec)
├─ docs/                      ← child-privacy brief, curriculum outline
└─ app/       ← the actual app
   ├─ server.js               ← Node/Express: static serving + /api/ai (+ file APIs)
   ├─ .env.example            ← AI provider + per-agent model config
   ├─ content/                ← the course (authored, read-only at runtime)
   │  ├─ course.yaml          ← 10 modules → 47 lessons (ids, names, stars)
   │  ├─ lessons/*.md         ← one Markdown file per lesson (YAML front-matter + body)
   │  └─ README.md            ← widget/authoring syntax
   ├─ public/
   │  ├─ index.html           ← ALL markup + CSS (single file)
   │  ├─ app.js               ← ALL client logic (single file, ~1k+ lines)
   │  ├─ assets-manifest.js   ← window.STORE_ASSETS = 265 Kenney assets (metadata + data URIs)
   │  └─ assets/              ← the 265 real Kenney PNG/OGG files + CREDITS.txt
   └─ workspace/game.js       ← server-side scratch copy (see gotchas)
```

## 4. How it works (architecture)

**Client-side SPA.** `public/index.html` (markup + all CSS) + `public/app.js` (all logic). No build step — plain ES5-ish JS, libraries from CDNs (Phaser 3.80.1, CodeMirror 5, marked, js-yaml, Prettier).

**Student project lives in the browser.** The project (`game.js`, `main.js`, any added scripts) is stored in `localStorage` under `leagueProject`; progress (XP, Stars, unlocked assets, completed lessons) under `leagueProgress`. **No student code or PII is stored server-side.**

**Running a game.** `startGame()` in `app.js` assembles a self-contained HTML string and drops it into an `<iframe srcdoc>` — Phaser from CDN + a console-capture shim + an **asset injector** (`assetInjectScript()`) + the student's scripts. The game runs entirely in the sandboxed iframe.

**Assets.** The Store (`window.STORE_ASSETS` from `assets-manifest.js`) sells Kenney CC0 assets. Buying **unlocks** an asset (a small core set — `player`, `grass`, `sky`, `coin-gold`, `sfx-coin`, `sfx-jump` — is free). Owned assets are exposed to the game via `window.preloadAssets(scene)`, which the starter calls in `preload()`. Images load from data URIs; **audio loads via a Blob URL** (a data-URI audio XHR hangs the loader in the sandbox — do not revert this).

**Content pipeline.** `content/course.yaml` defines modules→lessons; each lesson is `content/lessons/<id>.md` with YAML front-matter (title, xp, ai mode, summary) + a Markdown body. Fenced blocks render as widgets: ` ```run ` (goal/expect/slider), ` ```quiz ` (mcq / predict / parsons+distractors / fillblank / findbug), ` ```challenge ` (edit an embedded game, call `win()`). Authoring syntax is in `content/README.md`. **Jay edits content, not code.**

**AI (multi-agent).** `POST /api/ai` routes by `agent` (coder / tutor / quiz / grader) through a controller. Models are set **per-agent in `.env`** as `provider:model` (`ollama:` / `openrouter:` / `anthropic:`). The **coder** returns surgical edit "ops" applied in the browser; the **tutor** returns plain markdown. quiz/grader are scaffolded but not wired to the UI yet.

## 5. What's built (works today)

- Engine-style shell (outline · viewport · AI dock), Learn/Code/Play tabs, collapsible console + AI dock.
- **265 Kenney CC0 assets** across Characters/Enemies/Collectibles/Tiles/Backgrounds/UI/Sounds; Store with category filter, buy-with-Stars, "Included" free core, sound preview.
- **Mario-style platformer starter** (gravity, platforms, coins, score), fully commented, **WASD + arrows**, coin/jump sounds.
- **IDE code editor** (CodeMirror): JSHint lint, autocomplete, bracket match/close, active-line, folding, find, comment toggle, Ln/Col status bar, Ctrl-S / Ctrl-Enter.
- **File tree** with collapsible **source** (code) and **assets** (owned) folders; clicking an asset opens a detail popup (preview, type, key, usage, Insert).
- **Play view**: true-4:3 framed game stage, "Building…" loading state, **mute (default on) + volume** in the console bar.
- **Leaderboards** (privacy-safe names, your-rank anchor, class/timeframe filters), **Gallery** (student games), Store.
- 10 modules / 47 lessons scaffolded with the widget engine.

## 6. What's NOT built / next (priority order)

1. **Auth + storage lane (highest value).** GitHub OAuth login, then the League **code-server** flow: repos created under **one** League GitHub account (legal workaround for under-13s). Needs Eric's code-server API / base URL / auth scheme. Then sync/commit/push from the app. Nothing persists off the browser until this exists.
2. **Product name** (course + Store) — still undecided; "Gallery" confirmed for student games.
3. **Capstone "build" lessons** → convert to challenge minigames.
4. **quiz/grader agents** → wire to the UI (endpoints exist).
5. **Accessibility/WCAG audit** (e.g. Parsons drag has no keyboard path).
6. **Front-facing marketing/showcase page** (public "kids games" site).
7. Student/instructor **interviews** (evidence so far is research + two client meetings).

## 7. Conventions & gotchas (read before editing)

- **Two big single files:** `public/index.html` (markup+CSS) and `public/app.js` (all JS). Edits in this project were done with exact string replacements; keep functions cohesive.
- **Audio must load via Blob URL**, not a data URI — a data-URI audio XHR hangs Phaser's loader inside the sandboxed `srcdoc` iframe and `create()` never runs. See `preloadAssets` in `assetInjectScript()`.
- **Don't wrap `Phaser.Game`'s constructor** to auto-load assets — an earlier attempt broke the game. The current approach: the starter calls `preloadAssets(this)` in `preload()`; keep it non-invasive.
- **`fitStage()`** sizes the game frame to a true 4:3 box; it must run *after* the console collapses (it's called on `switchView('play')` via rAF, on console toggle, on resize, and on `gf.onload`).
- **Reset game** restores BOTH `game.js` and `main.js` (the starter needs `main.js`'s `scene.preload` wired).
- **Security constraints (preserve):** `.env` holds keys and stays gitignored; AI keys never reach the browser; never send student PII to model providers; the game runs sandboxed. Child-privacy: pseudonymous handles by default, parental opt-in for first name + last initial, per-game private toggle, teacher/admin takedown — League staff own consent collection (see `docs/child-privacy-brief.md`).
- **Server-side vs client-side storage mismatch (reconcile later):** `server.js` still exposes `/api/files`, `/api/save-file`, `/api/new-file`, `/workspace`, and a `GAME_FILE` under `app/workspace/`. The current UI does **not** use these — it stores the project in `localStorage`. The tracked file `app/workspace/game.js` is a leftover server-side scratch copy that keeps showing as modified; **add it to `.gitignore`** (or remove the server file APIs) when you touch this area.

## 8. UA Framework docs

- [`.ua/UA0-PROJECT-STATUS.md`](.ua/UA0-PROJECT-STATUS.md) — living status (stage, gaps, next action).
- [`.ua/ua2-positioning-statement.md`](.ua/ua2-positioning-statement.md) — positioning (product name is the one open clause).
- [`.ua/ua5-stage-2-analysis.md`](.ua/ua5-stage-2-analysis.md) — landscape, stakeholders, jobs/scenarios.
- [`.ua/ua6-specification.md`](.ua/ua6-specification.md) — screen inventory + build status (the implementation checklist).
- [`docs/child-privacy-brief.md`](docs/child-privacy-brief.md), [`docs/curriculum-outline.md`](docs/curriculum-outline.md).

## 9. Where to look first

- Client behavior: `public/app.js` — start at `startGame()`, `assetInjectScript()`, `switchView()`, `renderStore()`, `refreshFiles()`.
- Styling/markup: `public/index.html`.
- Server + AI routing: `server.js` (`/api/ai`, `buildSystem`, `resolveModel`, `callAI`).
- The course: `content/course.yaml` + `content/lessons/*.md` (syntax in `content/README.md`).
