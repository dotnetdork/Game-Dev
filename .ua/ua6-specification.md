# UA6 — Specification

The Stage 3 deliverable: everything from Stages 1–2 pulled into one document a developer (human or AI) can build from. The screens are the spine.

> **Note on this project:** we are *editing a working app* instead of building wireframes. So each screen carries a **Build status** — `[built]` (exists now), `[rename]` (exists, label/behavior changes), `[extend]` (exists, needs more), `[new]` (doesn't exist yet). That makes this spec double as the implementation checklist for the edit phase.

Scenario keys (from `ua5`): **S1** get hooked fast · **S2** build a game without inventing one · **S3** prove understanding (in-lesson challenge) · **S4** quick questions/quizzes · **S5** keep + show the finished game.

---

## Overview

### Positioning statement

> For League students aged ~10–15 on school-managed Chromebooks (and the League instructors and parents who choose their courses), who want to build a real game they're proud to show family and friends — but the tools that feel "real" won't run on their locked-down hardware, the ones that do run feel like toys, and none of them teach kids to actually understand the code a game is made of, the League's game-development course (name TBD) is a project-based, browser-based introduction to game development, delivered through an engine-like studio where the student directs an AI that does the heavy typing, that hooks them with playable games first, then guides them over ~10–12 hours to build their own game by reading, shaping, and debugging its code — finishing with one game they're genuinely proud to show off. Unlike block platforms, walled coding-game sites, Roblox/Minecraft classes, the status-quo PyGame course, or Unity/Godot courses that can't run on a Chromebook cohort, our course runs entirely in-browser on managed Chromebooks at class scale — no installs, no VMs, no per-student accounts (games save and publish through the League's own GitHub) — and instead of hiding the code or making kids type it from scratch, it teaches them to read a real codebase, make the design and architecture calls, and direct an AI to carry them out.

### Summary

A browser-based studio, styled like a game engine, in which a student follows a guided course that builds one real 2D game (Phaser/JavaScript) from start to finish. Lessons teach a concept, then make the student prove it by modifying or debugging a small instanced game right in the lesson; short AI-generated questions and quizzes check understanding; challenges must pass an automated checker to earn XP and unlock the next lesson. Stars earned along the way buy assets (art + physics snippets) that appear as files in the student's project. Finished games are kept in git — under the student's own GitHub, or under the League's org via the code server for kids without an account — and shown off in a public Gallery. Several AI agents (coder, tutor, quiz-maker, grader/checker) sit behind a controller and are configured per-agent in `.env`, working on both local Ollama and OpenRouter.

---

## Screen inventory

| # | Screen | Purpose | Scenarios | Build |
|---|--------|---------|-----------|-------|
| 1 | Marketing home (public) | Explain the course, sign-ups, pricing, benefits; entry to the public Gallery | — | [new] |
| 2 | Public Gallery (public) | Browse/play student games with privacy-safe names | S5 | [new] |
| 3 | App shell (nav + footer) | Global chrome: nav, XP/Stars/level, identity | all | [rename] |
| 4 | Lesson view (Learn) | Read a lesson and work its embedded activities | S1–S4 | [extend] |
| 5 | In-lesson challenge | Modify/fix an instanced game, submit, get checked | S1, S3 | [new] |
| 6 | Quick question / quiz | Answer AI-generated checks (Parsons, MCQ, …) | S4 | [new] |
| 7 | Tutor checkpoint | Ask the tutor a scoped question mid-lesson | S1, S3 | [new] |
| 8 | Code view | Read/edit the game's files | S1, S2, S3 | [built] |
| 9 | Play view | Run the game; see settings + console/log | S1, S2 | [extend] |
| 10 | AI Assistant panel | Direct the coder/tutor agents | S1, S2, S3 | [extend] |
| 11 | Asset Store (was "Gallery") | Spend Stars on assets that become files | S2 | [rename] |
| 12 | Gallery (was "Showcase") | The student's + peers' published games | S5 | [rename] |
| 13 | Leaderboards | Rank students by XP | — | [built] |
| 14 | Docs | Phaser quick-reference wiki | — | [built] |
| 15 | Help | Explain the app; reset progress (testing) | — | [built] |
| 16 | Sign-in / identity | Establish who the student is (GitHub OR code-server username) | S5 | [new] |
| 17 | Save & Sync / Publish | Create repo, sync commits, publish to Gallery | S5 | [new] |
| 18 | Locked lesson/module state | Communicate prerequisites | S2, S3 | [built] |
| 19 | Empty states | First-run Files/Store/Gallery with nothing yet | S2, S5 | [extend] |
| 20 | Error states | Game runtime error, failed AI edit, failed save/sync, failed check | S1, S3, S5 | [extend] |
| 21 | Confirmation / success | Confirm irreversible/meaningful actions (buy, publish, reset, open example) | S2, S5 | [built] |

---

## Screen descriptions

### 1 — Marketing home (public) `[new]`
- **Purpose:** Sell the course and route visitors to sign up or to the public Gallery.
- **Who lands here:** Parents/instructors (and curious kids) from a link or search; the app's public root.
- **What's shown:** What the course is and the games kids make; how sign-ups/classes work; pricing; benefits; a link into the public Gallery; a way to start/log in.
- **What they can do:** Read info sections; open the public Gallery; start/sign in.
- **Where each action goes:** Info → same page anchors; Gallery → screen 2; Start/sign in → screen 16.

### 2 — Public Gallery `[new]`
- **Purpose:** Show off finished student games publicly, privacy-safely.
- **Who lands here:** Public visitors from the marketing home; students/parents sharing a link.
- **What's shown:** Game cards with title, a pseudonymous handle by default (first name + last initial only if parental consent flag is set), play + view-code affordances. No other identifying info.
- **What they can do:** Play a game; view its code; filter/browse.
- **Where each action goes:** Play → runs the game (client-side, from its repo); View code → the student's repo or the League-org repo; a private game is not listed here.
- **Build note:** content comes from git (student repo or League org); honor per-game private toggle + teacher takedown.

### 3 — App shell (nav + footer) `[rename]`
- **Purpose:** Persistent frame: navigate the studio and see progress/identity.
- **Who lands here:** Every authenticated student, always present.
- **What's shown:** Top nav (Courses, Store, Gallery, Leaderboards, Docs, Help), the League logo, and the footer (course + version left; ★ Stars, XP, level, progress bar middle; League © right); signed-in identity/handle.
- **What they can do:** Switch top-level sections; see XP/Stars/level; access identity/sign-out.
- **Where each action goes:** Nav items → screens 4/11/12/13/14/15; identity → screen 16.
- **Build note:** rename nav "Gallery"→"Store" (screen 11) and "Showcase"→"Gallery" (screen 12); add identity affordance.

### 4 — Lesson view (Learn) `[extend]`
- **Purpose:** Deliver one lesson: read a concept, then do its activities.
- **Who lands here:** Student clicking an unlocked lesson in the outline; auto-advanced after completing the prior one.
- **What's shown:** The lesson content (Markdown-authored: text, images/GIFs, embedded minigame instances, runnable code, quick questions, tutor checkpoints, and the challenge), the module/lesson breadcrumb, and completion/XP state.
- **What they can do:** Read/scroll; run embedded code; play an embedded minigame; ask a tutor checkpoint; answer a quick question/quiz; start the challenge; mark complete (only after the challenge passes).
- **Where each action goes:** Challenge → screen 5; quick question → screen 6; tutor checkpoint → screen 7; runnable code → runs inline; complete → awards XP, unlocks next lesson (state change), may award Stars/assets on module completion.
- **Build note:** today the lesson is placeholder HTML; needs the Markdown + front-matter authoring pipeline (YAML structure, per-lesson front-matter incl. `ai: full|guided|off`) and the embedded-widget renderer (syntax TBD, currently parked).

### 5 — In-lesson challenge `[new]`
- **Purpose:** Make the student prove a concept by changing or fixing real code, checked automatically.
- **Who lands here:** Student reaching the challenge in a lesson.
- **What's shown:** An instanced small game + its relevant code, the task ("modify so X" or "find and fix the bug"), the AI's availability for this challenge (full/guided/off), and check results/hints.
- **What they can do:** Edit the code; run it; ask the (possibly limited) AI; submit for checking; retry.
- **Where each action goes:** Run → updates the instance; Submit → grader/checker agent verifies → pass (XP + unlock, screen 4 advances) or fail (targeted hint, stay); AI → coder/tutor within the mode's limits.
- **Build note:** new instanced-game-in-lesson runtime + checker agent + per-lesson AI mode enforcement.

### 6 — Quick question / quiz `[new]`
- **Purpose:** Fast, low-stakes check that a just-read concept stuck.
- **Who lands here:** Student at a question checkpoint after a reading.
- **What's shown:** One or a few AI-generated questions scoped to the lesson content; types vary (Parsons/reorder, multiple-choice, fill-in); result + one-line explanation after answering.
- **What they can do:** Answer; submit; retry.
- **Where each action goes:** Submit → grader agent scores + explains (state change); may contribute to lesson completion; retry stays.
- **Build note:** quiz agent (generation, scoped context) + grader agent; authored via Markdown; question data structured.

### 7 — Tutor checkpoint `[new]`
- **Purpose:** Let a student ask an isolated, scoped question of the tutor mid-lesson.
- **Who lands here:** Student clicking a checkpoint icon placed in the lesson.
- **What's shown:** A focused prompt/multiple-choice, answered by the tutor agent using only the lesson lines the author scoped to it.
- **What they can do:** Ask/select; read the tutor's answer.
- **Where each action goes:** Ask → tutor agent responds inline (state change), scoped to the marked context.
- **Build note:** tutor agent with scoped context (named markers, not raw line numbers); placement authored in Markdown.

### 8 — Code view `[built]`
- **Purpose:** Read and edit the game's code.
- **Who lands here:** Student clicking the Code tab, Run flow, or opening a file.
- **What's shown:** File list (game.js, main.js, student scripts, and bought asset files), the selected file in a syntax-highlighted editor, Save/Run/New controls.
- **What they can do:** Open a file; edit; format; New file; Save; Run.
- **Where each action goes:** Save → writes to the browser-side project (state); Run → screen 9; New → adds a file; open → loads into the editor.
- **Build note:** already client-side + auto-format; will also list unlocked asset files (screen 11).

### 9 — Play view `[extend]`
- **Purpose:** Run the game and inspect it.
- **Who lands here:** Student clicking Play or Run.
- **What's shown:** The running game (client-side, srcdoc), the Game Info panel listing every CONFIG variable, and a console/log area for debugging.
- **What they can do:** Play; read current settings; read logs; return to Code.
- **Where each action goes:** Play interactions run in the iframe; return → screen 8.
- **Build note:** add the console/log panel (Jed/Jay want basic debugging visibility); settings panel already lists all CONFIG vars.

### 10 — AI Assistant panel `[extend]`
- **Purpose:** Direct the AI to change the game or answer questions.
- **Who lands here:** Persistent right dock in the studio.
- **What's shown:** The active agent + model, the conversation, and the input.
- **What they can do:** Ask the coder to change/add (additive edits, applied client-side); ask the tutor to explain; (mode-permitting).
- **Where each action goes:** Coder → proposes ops the browser applies to game.js (state change) or is rejected on error; tutor → text answer; controller routes to the right agent.
- **Build note:** today one coder path; extend to multi-agent (coder/tutor + controller), per-agent `.env` config, Ollama+OpenRouter parity, and honor the lesson's AI mode.

### 11 — Asset Store (was "Gallery") `[rename]`
- **Purpose:** Spend Stars on assets that drop into the student's project as files.
- **Who lands here:** Student clicking Store; prompted when a lesson unlocks a purchase.
- **What's shown:** Asset cards (art: sprites/backgrounds/enemies; physics: readable `.js` snippet files), price in Stars, owned/affordable state, the student's Star balance.
- **What they can do:** Browse; buy (if affordable); see owned.
- **Where each action goes:** Buy → confirmation (screen 21) → deduct Stars, add the file to the project's Files (state); owned assets auto-preload so code can reference them by name.
- **Build note:** rename from the current examples "Gallery"; change model from "buy games" to "buy assets → files"; physics packs as readable snippet files; app auto-preloads owned assets.

### 12 — Gallery (was "Showcase") `[rename]`
- **Purpose:** Where a student's and peers' finished games live and get shown off.
- **Who lands here:** Student clicking Gallery; after publishing.
- **What's shown:** Game cards (pseudonymous handle by default), the student's own games, a publish entry point, and each game's private/public state.
- **What they can do:** Play; view code; publish a game; toggle a game private/public.
- **Where each action goes:** Publish → screen 17/consent flow; toggle → state change; play/view → runs/opens repo; teacher/admin can take down.
- **Build note:** rename from "Showcase"; add per-game private toggle + pseudonymous default; the public mirror is screen 2.

### 13 — Leaderboards `[built]`
- **Purpose:** Rank students by XP for friendly motivation.
- **Who lands here:** Student clicking Leaderboards.
- **What's shown:** Ranked list with handle/avatar, level, XP; the student's own row highlighted.
- **What they can do:** View.
- **Where each action goes:** —.
- **Build note:** already built; use pseudonymous handles per privacy defaults.

### 14 — Docs `[built]`
- **Purpose:** A beginner Phaser quick-reference.
- **Who lands here:** Student clicking Docs.
- **What's shown:** A TOC + short reference sections with code snippets; link to full Phaser docs.
- **What they can do:** Browse; jump via TOC; open full docs.
- **Where each action goes:** TOC → scrolls; full docs → new tab.

### 15 — Help `[built]`
- **Purpose:** Explain the app; reset progress for testing.
- **Who lands here:** Student clicking Help.
- **What's shown:** How each part works; a reset-progress control.
- **What they can do:** Read; reset progress.
- **Where each action goes:** Reset → confirmation (screen 21) → clears local progress + reloads.

### 16 — Sign-in / identity `[new]`
- **Purpose:** Establish who the student is, in one of two lanes, without a per-kid GitHub account being required.
- **Who lands here:** New/returning student from the marketing home or first studio launch.
- **What's shown:** Two paths — "Sign in with GitHub" (13+ with an account) and "Continue with a class username / teacher token" (code-server lane under the League org); minimal, COPPA-safe.
- **What they can do:** Authenticate via GitHub OAuth; or create/enter a code-server username (session/teacher token).
- **Where each action goes:** GitHub → OAuth → back into the studio with their identity; username lane → code-server session → studio. Both feed the identity used by Save & Sync (screen 17).
- **Build note:** new; GitHub OAuth built first (Jay), code-server lane pending Eric's API details (base URL, auth scheme, repo-under-org API).

### 17 — Save & Sync / Publish `[new]`
- **Purpose:** Persist the student's game to git and publish it to the Gallery.
- **Who lands here:** Student in Code view (Sync) or Gallery (Publish).
- **What's shown:** Repo status; a single Sync action; a Publish action; consent/privacy state (handle vs. name).
- **What they can do:** (First GitHub sign-in) confirm "create your games repo?"; Sync (stage → auto commit message → push); Publish to Gallery.
- **Where each action goes:** Create repo → confirmation → repo made (own account or League org); Sync → commits+pushes (success/failure state); Publish → adds to Gallery (screen 12) under the consented display; failures surface as errors (screen 20).
- **Build note:** new; one Sync button (ask-on-first-sign-in); code-server lane commits/pushes under the League org.

### 18–21 — States (grouped)
- **Locked lesson/module `[built]`:** grayed, non-clickable until prerequisites are met; explains why; clicking shows a "finish the previous one" toast. (S2, S3)
- **Empty states `[extend]`:** first-run Files (just game.js/main.js), Store (nothing owned), Gallery (nothing published) — each says what to do next.
- **Error states `[extend]`:** game runtime error → console/log + tutor pointer; failed AI edit → kept-as-was message; failed save/sync → retry message; failed challenge check → targeted hint. (S1, S3, S5)
- **Confirmation / success `[built]`:** modal confirms for buy, publish, reset progress, open example; success via toast. (S2, S5)

---

## Requirements

- **Multi-agent, configurable:** coder, tutor, quiz-maker, grader/checker behind a controller; each agent's model set per-agent in `.env`; must run on local Ollama and on OpenRouter with parity; keys server-side only.
- **Authoring pipeline:** course structure in YAML + per-lesson Markdown with front-matter (incl. `ai: full|guided|off`); embedded-widget syntax still to be chosen; scoped tutor context via named markers.
- **Client-side + git storage:** student work lives in the browser and in git (own repo or League org via code server); no database.
- **Privacy (see `docs/child-privacy-brief.md`):** pseudonymous by default; parental-consent flag reveals first name + last initial; per-game private toggle; teacher takedown; no student PII to model providers.
- **Accessibility:** keyboard-operable editor, adequate contrast on the dark theme, readable fonts, caution with game motion (WCAG) — audit pending.

## Constraints and assumptions

- Runs in-browser on school-managed Chromebooks at ~20/class; no installs, no VMs.
- Lightweight webserver (approved); Codespaces optional, not required.
- No per-student GitHub accounts required (League-org code server is the default lane); COPPA in scope (under-13s).
- Phaser is the game library; JavaScript (not TypeScript) for Level 1.
- The League's staff own all legal consent/authorization collection.
- Course scope ~10–12 hrs: first half minigames/concepts, second half building one game (e.g., a roguelike).

## Open questions

- Product/course name, Store name, and confirmation of "Gallery" for student games (all open).
- Code-server specifics from Eric: base URL, auth scheme, repo-under-org + push API, username/repo naming, and how no-GitHub students recover access.
- Embedded-widget authoring syntax (fenced vs. directives vs. MDX) — parked.
- Whether students can remix each other's Gallery games (Scratch-style).
- The two parked `ua2` refinements (AI-coding-tool adjacency; no-code-engine differentiation).
- Accessibility audit not yet done.
