# UA0 — Project Status

Maintained by the agent. Records where the LEAGUE Game Development course project stands.
(Kept in `.ua/`; a fuller snapshot lives in `../HANDOFF.md`.)

## Project header
- **Project:** LEAGUE Game Development Course — Level 1
- **Path:** client (The League; Jay = intern / project lead; Jed Stumpf = stakeholder)
- **Started:** 2026-07-18 · **Updated:** 2026-07-28

## Current stage
Past Stage 1 (Discovery). Now in **delivery design / prototyping** — building the actual course tool and validating the tech, with a working prototype in hand.

## Direction (current — supersedes earlier engine picks)
- **Constraint reality:** Chromebooks are **school-managed** → no Linux/Play Store, browser-only; **no third-party student sign-ups** (GitHub via the League org is fine).
- **Course shape:** game-**design-first**, coding as literacy, **AI does most of the heavy coding**, students build a real, shareable 2D game.
- **Tech:** the game is built with **Phaser** (JS). The course is a **web app styled like a game engine** (outline • viewport • AI panel); the viewport runs the student's game and the AI edits the code.
- **AI:** the League's **own model** — local **Ollama (`qwen3:14b-q8_0`)** for testing now, Anthropic/Claude for cloud; keys stay server-side.
- **Deployment:** runs the same as a small web app on a server **or** in Codespaces (Codespaces-required is an open question, leaning "not necessarily").
- **Set aside:** Godot editor (won't run on managed Chromebooks); GDevelop / PlayCanvas / Godot-web (see research briefs); Construct 3 (paid).

## Positioning statement (ua2) — revised 2026-07-28
Refreshed to match the pivot (Pass-4-style revision driven by the second client meeting + the approved prototype). **Key benefit** reframed to fun-first + build-one-real-game + understand/direct the code; **primary differentiation** reframed to (1) accessibility on managed Chromebooks with no per-student accounts (League-org code server) and (2) read-a-real-codebase + make design/architecture calls + direct an AI. **Product name still open** (League branding decision) — the one clause blocking a clean Stage 1 exit.

## Completed checkpoints
- 2026-07-18 Discovery, landscape research, client conversation (Jed), positioning draft + research refinement.
- 2026-07-21 Engine research (Godot/GDevelop/PlayCanvas), GitHub-Pages/self-host analysis; boss deck (later retired).
- 2026-07-28 Pivot to browser-only + design-first + AI-assisted; **Phaser** chosen for the game.
- 2026-07-28 Built prototypes + a working **sandboxed AI agent app** (`../league-course-agent/`): Node/Express backend, engine-style shell, Code (game.js/main.js) / Learn / Play tabs, AI panel wired to local Ollama, model name shown in header. Sandbox verified (range-clamp, allowlist, rate limit, read-only files).
- 2026-07-28 Second client meeting (Jed + Eric): prototype approved; direction firmed (fun-first, read/understand/direct-the-AI pedagogy, minigames→one big game, stars→assets, League code server = repos under one League GitHub account, client-side + git storage, itch-style showcase). Child-privacy brief captured (`../docs/child-privacy-brief.md`).
- 2026-07-28 **Positioning statement revised** (Pass-4-style) from the meeting + approved prototype; key-benefit & differentiation reframed. Product name still open.

## Known gaps / open items
- Confirm with League: Codespaces required? backend/hardware? exact Chromebook models? course + showcase-site **names still open**.
- Add **GitHub OAuth** for per-student login.
- Extend agent from settings-only edits to **fuller code edits** (same allowlist + syntax-check).
- Build the real **design-first curriculum** (replace Learn placeholders).
- No **student/instructor interviews** yet — evidence is research + one client conversation.

## Current stage / activity
**Stage 3 — Specification** (document side). `ua6-specification.md` drafted: overview, 21-screen inventory, five-part descriptions, requirements/constraints/open-questions. Per Jay, **wireframes are replaced by editing the working app** — each screen in `ua6` carries a build status ([built]/[rename]/[extend]/[new]) so the spec doubles as the implementation checklist. Next: implement, in a prioritized order (MVP order emerges as we build).

Repo pushed to GitHub: https://github.com/dotnetdork/LEAGUE-GameDev (single repo: app + `.ua/` + `docs/`).

## Completed (this stretch)
- 2026-07-28 Stage 1 positioning revised for the pivot (name still open).
- 2026-07-28 Stage 2 Analysis (`ua5`) drafted — landscape, stakeholders/users/compliance, 5 jobs + scenarios.
- 2026-07-28 Stage 3 spec (`ua6`) drafted; wireframes swapped for direct app edits.

## Last updated
- 2026-07-28 · by specification (ua6 draft)
