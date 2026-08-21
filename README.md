# LEAGUE Game Development Course

A browser-based game-development course for The League of Amazing Programmers
(students ~11–14, on school-managed Chromebooks). The app is a studio styled like
a game engine — a course outline on the left, a Learn / Code / Play viewport in the
center, an AI assistant on the right. Students read and modify a real Phaser game,
direct an AI to make changes, and build one shareable 2D game across the course.

## Run it

```bash
npm --prefix app install
npm --prefix app start        # → http://localhost:3000
```

Node ≥ 18. The UI runs without any AI configured. To enable the AI panel, copy
`app/.env.example` to `app/.env` and either run [Ollama](https://ollama.com) locally
or set an OpenRouter / Anthropic key. Per-agent models are set there too, and keys
stay server-side.

## Repo map

| Path | What it is |
|---|---|
| `app/` | the application (below) |
| `docs/` | human-facing docs: child-privacy brief, curriculum outline |
| `.ua/` | UA Framework project docs — status, positioning, analysis, specification |
| `.claude/` | AI working material: [`plans/`](.claude/plans/STAGES.md), `design-reviews/`, launch config |
| `.devcontainer/` | GitHub Codespaces setup |

### Inside `app/`

| Path | What it is |
|---|---|
| `server.js` | Express: static hosting + `/api/ai` (multi-agent relay) + `/api/info` |
| `content/` | the authored course — `course.yaml` (modules→lessons) + `lessons/*.md`. Authoring syntax: [`content/AUTHORING.md`](app/content/AUTHORING.md) |
| `ai/` | how the AI behaves — one Markdown file per agent + reusable skills, hot-reloaded. Editing guide: [`ai/AUTHORING.md`](app/ai/AUTHORING.md) |
| `public/index.html` | page shell (markup only) |
| `public/styles.css` | all app CSS |
| `public/js/` | the client, split into ordered plain scripts — no build step; each file has a header comment saying what it owns |
| `public/vendor/` | pinned third-party libs, self-hosted so the app works on filtered school networks ([`VENDORED.md`](app/public/vendor/VENDORED.md)) |
| `public/assets/` + `assets-manifest.js` | the 265 Kenney CC0 store assets + their catalog |
| `public/img/` | League branding images |

## How it holds together

- **The student's project lives in the browser** (`localStorage`): `game.js`, `main.js`,
  any extra scripts, plus XP / Stars / unlocks. The server never stores or runs student code.
- **Games run sandboxed.** `startGame()` assembles a self-contained document (vendored
  Phaser + console shim + owned-asset injector + the student's scripts) into an `<iframe srcdoc>`.
- **The AI is a relay.** `POST /api/ai` routes by agent (coder / tutor / quiz / grader), each
  with its own `provider:model` spec from `.env`. The coder returns JSON "ops"; the client
  applies them with a parse-check and reverts on error. Keys never reach the browser.
- **Teachers edit content, not code.** Lessons, quizzes, and challenges are Markdown + YAML
  under `app/content/`.

## Where things stand

Living status: [`.ua/UA0-PROJECT-STATUS.md`](.ua/UA0-PROJECT-STATUS.md).
What is being built and in what order: [`.claude/plans/STAGES.md`](.claude/plans/STAGES.md) —
start here for a new session.
AI system roadmap (stages, findings, walkthrough protocol):
[`.claude/plans/AI-IMPROVEMENT-PLAN.md`](.claude/plans/AI-IMPROVEMENT-PLAN.md).
Open question for the course itself: [`docs/ai-written-content-options.md`](docs/ai-written-content-options.md)
— how much of the content the AI writes, and who checks it.
