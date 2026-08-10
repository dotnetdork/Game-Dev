# LEAGUE Game Dev — the app

A web app styled like a game engine: a course outline on the left, a Learn / Code / Play
viewport in the center, and an AI assistant dock on the right. Students read and edit a real
Phaser 3 game, and the AI edits code only through reviewable JSON "ops" applied in the browser.

Runs the same on a plain server or in GitHub Codespaces. Nothing here depends on Codespaces.

## Requirements

- Node.js 18+ (uses the built-in `fetch`).
- Optional, for the AI panel: local [Ollama](https://ollama.com) **or** an OpenRouter /
  Anthropic API key in `.env` (copy `.env.example`; per-agent models are set there too).

## Run

```bash
npm install
npm start          # → http://localhost:3000
```

## Layout

| Path | What it is |
|---|---|
| `server.js` | Express: static hosting + `/api/ai` (multi-agent relay) + `/api/info` |
| `content/` | the authored course — `course.yaml` (modules→lessons) + `lessons/*.md`; syntax in `content/README.md` |
| `public/index.html` | page shell (markup only) |
| `public/styles.css` | all app CSS |
| `public/js/` | the client, split into ordered plain scripts (no build step) — see each file's header comment |
| `public/vendor/` | pinned third-party libs, self-hosted so the app works on filtered school networks (`vendor/README.md`) |
| `public/assets/` + `assets-manifest.js` | the 265 Kenney CC0 store assets + their catalog |
| `public/img/` | League branding images |

## How it holds together

- **The student's project lives in the browser** (`localStorage`): `game.js`, `main.js`, any
  extra scripts, plus XP/Stars/unlocks. The server never stores or runs student code.
- **Games run sandboxed**: `startGame()` assembles a self-contained HTML document (vendored
  Phaser + console shim + owned-asset injector + the student's scripts) into an
  `<iframe srcdoc>`.
- **The AI is a relay**: `POST /api/ai` routes by agent (coder / tutor / quiz / grader), each
  with its own `provider:model` spec from `.env`. The coder returns JSON ops; the client
  applies them with a parse-check and reverts on error. API keys never reach the browser.
- Everything a teacher edits is content, not code: lessons, quizzes, and challenges are
  Markdown/YAML under `content/`.
