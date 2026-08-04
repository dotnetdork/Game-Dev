# LEAGUE Game Dev — Course Shell + Sandboxed AI Agent

A small web app that looks like a game engine (outline • viewport • AI panel) and lets students
change a real `game.js` by talking to an AI. The AI is **sandboxed**: it can only adjust a handful
of allow-listed game settings, or answer questions — nothing else.

Runs the **same** whether you host it as a plain web app on your own server **or** open it in
GitHub Codespaces. Nothing here depends on Codespaces.

## Requirements
- Node.js 18+ (uses the built-in `fetch`).

## Quick start
```bash
cp .env.example .env      # then edit .env to pick your AI provider
npm install
npm start                 # serves http://localhost:3000
```
Open the app, click **Play**, then in the **AI Assistant** type things like
"make it faster", "add more bombs", or "make the paddle bigger".
The game reloads with your change, and the **Code** tab shows the updated `game.js`.

## Choosing the AI (keys stay on the server, never in the browser)
**Local / free — Ollama** (great on a server you control):
```
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=llama3.1
```
Install Ollama and `ollama pull llama3.1`. Because the **server** calls Ollama (not the browser),
there is no browser CORS to configure.

**Cloud — Anthropic (Claude)** (good for Codespaces, where local Ollama isn't present):
```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

## Two ways to run it
**A) As a web app on your server**
- `npm install && npm start`, put it behind your reverse proxy / domain. Use Ollama or Anthropic.

**B) In GitHub Codespaces**
- Open the repo in a Codespace (the devcontainer runs `npm install`), then `npm start`.
- Forward port **3000** (set visibility to public to embed the viewport elsewhere).
- Use `AI_PROVIDER=anthropic` with the key stored as a Codespaces secret (local Ollama isn't in the codespace),
  or point `OLLAMA_URL` at an Ollama you host elsewhere.

## How the sandbox works
- **Write access:** the agent can only change these settings in `workspace/game.js`, each clamped to a safe range:
  `fallSpeed (60–600)`, `bombChance (0–0.6)`, `paddleWidth (40–260)`, `spawnEvery (250–1500)`, `starPoints (1–100)`.
- Anything the model asks for outside that list is **ignored**. The edited file is **syntax-checked before it is written**, and the server only ever writes `game.js`.
- **Read access:** only `game.js` is exposed (`GET /api/files/game.js`) for the Code tab and Q&A.
- **Rate limit:** per-student cap (default 40 requests / 10 min).
- **Keys:** never leave the server.

## Project structure
```
server.js                 Express backend + sandboxed /api/ai agent
workspace/game.js         the student's editable Phaser game (only writable file)
public/index.html         the engine-style course shell
public/app.js             shell logic (nav, tabs, AI calls)
public/game-host.html     the viewport page that runs game.js
.devcontainer/            Codespaces config (auto npm install, forwards :3000)
.env.example              provider/key configuration
```

## Notes / next steps
- The agent currently edits allow-listed *settings*. The same backend pattern extends to fuller code
  edits by adding tools that write specific files (still behind the allowlist + syntax check).
- Add GitHub OAuth if you want per-student identity/login instead of the anonymous per-browser id.
