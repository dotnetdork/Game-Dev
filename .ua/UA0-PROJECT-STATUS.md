# UA0 — Project Status

Maintained by the agent. Records where the LEAGUE Game Development course project stands.
(Kept in `.ua/`; a fuller snapshot lives in `../HANDOFF.md`.)

## Project header
- **Project:** LEAGUE Game Development Course — Level 1
- **Path:** client (The League; Jay = intern / project lead; Jed Stumpf = stakeholder)
- **Started:** 2026-07-18 · **Updated:** 2026-08-05 · **Continuing in:** Claude Code (moved from Cowork)

## Current stage
**Stage 3 — Specification & build.** `ua6` spec drafted; per Jay, wireframes are replaced by **building the real app** (each spec screen carries a build status). Implementation is well underway — much of the app is built and running locally.

## Direction (current — supersedes earlier engine picks)
- **Constraint reality:** Chromebooks are **school-managed** → no Linux/Play Store, browser-only; **no third-party student sign-ups** (GitHub via the League org is fine).
- **Course shape:** game-**design-first**, coding as literacy, **AI does most of the heavy coding**, students build a real, shareable 2D game.
- **Tech:** the game is built with **Phaser** (JS). The course is a **web app styled like a game engine** (outline • viewport • AI panel); the viewport runs the student's game and the AI edits the code.
- **AI:** **multi-agent** (coder / tutor / quiz / grader) behind a controller, each model set **per-agent in `.env`**, provider-agnostic — runs on local **Ollama** (`qwen2.5-coder:7b` coder + `qwen2.5:7b` tutor, sized for a 16GB GPU) or **OpenRouter / Anthropic**; keys stay server-side.
- **Deployment:** runs the same as a small web app on a server **or** in Codespaces (Codespaces-required is an open question, leaning "not necessarily").
- **Set aside:** Godot editor (won't run on managed Chromebooks); GDevelop / PlayCanvas / Godot-web (see research briefs); Construct 3 (paid).

## Positioning statement (ua2) — revised 2026-07-28
Refreshed to match the pivot (Pass-4-style revision driven by the second client meeting + the approved prototype). **Key benefit** reframed to fun-first + build-one-real-game + understand/direct the code; **primary differentiation** reframed to (1) accessibility on managed Chromebooks with no per-student accounts (League-org code server) and (2) read-a-real-codebase + make design/architecture calls + direct an AI. **Product name still open** (League branding decision) — the one clause blocking a clean Stage 1 exit.

## Completed checkpoints
- 2026-07-18 Discovery, landscape research, client conversation (Jed), positioning draft + research refinement.
- 2026-07-21 Engine research (Godot/GDevelop/PlayCanvas), GitHub-Pages/self-host analysis; boss deck (later retired).
- 2026-07-28 Pivot to browser-only + design-first + AI-assisted; **Phaser** chosen for the game.
- 2026-07-28 Built prototypes + a working **sandboxed AI agent app** (`../app/`): Node/Express backend, engine-style shell, Code (game.js/main.js) / Learn / Play tabs, AI panel wired to local Ollama, model name shown in header. Sandbox verified (range-clamp, allowlist, rate limit, read-only files).
- 2026-07-28 Second client meeting (Jed + Eric): prototype approved; direction firmed (fun-first, read/understand/direct-the-AI pedagogy, minigames→one big game, stars→assets, League code server = repos under one League GitHub account, client-side + git storage, itch-style showcase). Child-privacy brief captured (`../docs/child-privacy-brief.md`).
- 2026-07-28 **Positioning statement revised** (Pass-4-style) from the meeting + approved prototype; key-benefit & differentiation reframed. Product name still open.

## Known gaps / open items
- **Auth not built yet:** GitHub OAuth (build first) + the League **code-server** lane (repos under one League GitHub account) — need Eric's exact code-server API / base URL / auth scheme.
- **Product name** still open (course + Store name; "Gallery" confirmed for student games) — the one clause blocking a clean Stage 1 exit.
- **Content:** Jay authors the real lessons in Markdown/YAML; the 47-lesson scaffold + examples are in place. Capstone "build" lessons not yet converted to challenge minigames.
- **Widget-authoring syntax** is provisional (fenced blocks); finalize later.
- **Accessibility (WCAG) audit** pending; Parsons drag has no keyboard path yet; quiz/grader agents scaffolded but not fully wired.
- Local coder model occasionally invents APIs (Reset-to-starter is the safety net; a stronger model via OpenRouter slips less).
- No **student/instructor interviews** yet — evidence is research + two client conversations.
- Confirm with League: Codespaces required? hardware? exact Chromebook models? Wordmark logo may show on a white background on the dark bar (verify).

## Current stage / activity
**Stage 3 — Specification (`ua6`) done; building the app per spec** (wireframes replaced by real app edits). Substantial implementation complete and running locally; iterating on UX. **Work is continuing in Claude Code** from here (this was the last Cowork session). Repo: https://github.com/dotnetdork/LEAGUE-GameDev (single repo: app + `.ua/` + `docs/`); latest local commit `bc9a785`.

## Completed (this stretch)
- **UA docs:** Stage 1 positioning revised for the pivot; Stage 2 Analysis (`ua5`); Stage 3 spec (`ua6`); child-privacy/COPPA brief (`../docs/child-privacy-brief.md`); curriculum outline (`../docs/curriculum-outline.md`).
- **Course restructured** to 10 modules / 47 lessons (engines & languages, team roles, systems/architecture, sprites/collisions/rules, juice, capstone). Authored in **YAML + Markdown front-matter** so Jay edits content, not code (`../app/content/`).
- **Multi-agent AI:** coder + tutor (+ quiz/grader scaffolds) behind a controller; models set **per-agent in `.env`**; Ollama + OpenRouter + Anthropic parity. Separate Tutor/Build chats, one-panel icon toggle, collapsible dock + FAB.
- **Lesson widgets:** goal-checked runnable cells, live sliders, quizzes (mcq / predict-output / Parsons+distractors / fill-in-blank / find-the-bug), and **in-lesson challenge minigames** (edit an embedded game → `win()` completes the lesson, replacing the tick-box).
- **Client-side model:** student project in localStorage; games run via `iframe.srcdoc`; no student code/PII stored server-side. Coder AI applies surgical/additive ops in the browser; Reset-to-starter safety net.
- **UI:** Gallery→**Store** (buy assets with Stars → files) and Showcase→**Gallery** (student games); console/log panel; League-orange brand + per-module accent colors; full-width lesson hero + centered reading layout + larger body font; framed Play viewport; focus states; hover-to-delete/reset files; wordmark logo top-left.
- **Leaderboards** reworked (privacy-safe names, anchored "Your rank", class + timeframe filters, medals, "you" highlight) after an Impeccable critique pass; also ran Impeccable critiques on the lesson reading layout.

## Completed (2026-08-05 stretch — final Cowork session)
- **Real asset library:** replaced placeholder art with **265 Kenney CC0 assets** (Characters/Enemies/Collectibles/Tiles/Backgrounds/UI/Sounds), sourced from Platformer Art Deluxe + UI Pack + Digital/Interface audio; CC0/public-domain, credited in `../app/public/assets/CREDITS.txt`. Store buys **unlock** assets (a small core set is free); owned assets **auto-preload by key** (`preloadAssets`, audio via Blob URL to avoid a sandbox data-URI hang).
- **Code editor → IDE:** CodeMirror upgraded with inline JSHint linting, autocomplete/hints, bracket match + auto-close, active-line, code folding, find, comment toggle, Ln/Col status bar, and Ctrl-S/Ctrl-Enter shortcuts.
- **Starter game:** the default is now a **Mario-style platformer** (gravity, platforms, coins, score) using free Kenney assets, fully commented, with **WASD + arrow** controls and coin/jump sounds.
- **File tree:** code files under a collapsible **source** folder, owned assets under a collapsible **assets** folder; clicking an asset opens a **detail popup** (preview, type/category, key, usage snippet, Insert).
- **Play view / game viewer:** hero-viewport pass — game fills a true 4:3 stage; **mute (default on) + volume** control now in the console bar; game frame gets focus on load; "Building your game…" loading state; neutral frame (orange trim removed per Jay).
- **Design reviews:** ran Impeccable `critique` on the leaderboards and twice on the Play view (26→27/40), applying the layout/placement fixes.

## Known gaps / open items (carried forward)
- **Auth still not built:** GitHub OAuth + League **code-server** lane (repos under one League GitHub account) — needs Eric's code-server API/base URL/auth scheme. Highest-value next lane.
- **Product name** still open (course + Store name; "Gallery" confirmed for student games).
- **Content:** Jay authors the real lessons (47-lesson scaffold in place); capstone "build" lessons not yet converted to challenge minigames.
- **quiz/grader agents** scaffolded but not wired to the UI; **accessibility (WCAG) audit** pending (Parsons drag has no keyboard path).
- No **student/instructor interviews** yet — evidence is research + two client conversations.
- Housekeeping: `../app/workspace/game.js` is a runtime scratch file still tracked in git — consider gitignoring it.

## Last updated
- 2026-08-05 · by ua-orchestrator (final Cowork build refresh; continuing in Claude Code)
