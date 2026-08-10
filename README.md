# LEAGUE Game Development Course

A browser-based game-development course for The League of Amazing Programmers
(students ~11–14, on school-managed Chromebooks). The app is a web-based studio
styled like a game engine: students read and modify a real Phaser game, direct
an AI to make changes, and build one shareable 2D game across the course.

## Run it

```bash
npm --prefix app install
npm --prefix app start        # → http://localhost:3000
```

Node ≥ 18. The UI runs without any AI configured; to enable the AI panel, copy
`app/.env.example` to `app/.env` and either run [Ollama](https://ollama.com)
locally or set an OpenRouter/Anthropic key. Keys stay server-side.

## Repo map

| Path | What it is |
|---|---|
| [`app/`](app/) | the application — Node/Express server, client, authored course content ([details](app/README.md)) |
| [`docs/`](docs/) | human-facing docs: child-privacy brief, curriculum outline |
| [`HANDOFF.md`](HANDOFF.md) | orientation snapshot for whoever (or whatever) picks the project up next |
| `.ua/` | UA Framework project docs — status, positioning, analysis, specification |
| `.claude/` | AI working material: `plans/` (the improvement roadmap), `design-reviews/`, launch config |
| `.devcontainer/` | GitHub Codespaces / devcontainer setup |

## Where things stand

The living status is [`.ua/UA0-PROJECT-STATUS.md`](.ua/UA0-PROJECT-STATUS.md).
The AI system roadmap (stages, findings, walkthrough protocol) is
[`.claude/plans/AI-IMPROVEMENT-PLAN.md`](.claude/plans/AI-IMPROVEMENT-PLAN.md).
