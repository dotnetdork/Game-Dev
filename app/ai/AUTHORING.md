# Authoring the AI's behaviour

These Markdown files **are** the AI's instructions. Editing them changes how the tutor
explains things and how the Build helper edits code — no code change, no restart.

```
ai/
├─ agents/     one file per agent: coder · tutor · quiz · grader
├─ skills/     reusable chunks an agent can pull in
├─ reference/  phaser-api.md — what search_phaser_docs searches
├─ tools.js    the lookups an agent can call (read-only)
└─ loader.js   the code that assembles the prompts (don't edit to change behaviour)
```

**`reference/phaser-api.md` is worth editing.** When tool calling is on, `search_phaser_docs`
searches that file, so adding an entry there is how you stop the AI guessing at an API. Each
block is a `##` heading, a `keywords:` line used for matching, and a short code example.

## How a prompt is assembled

For each request: the agent's body, then the body of every skill it lists, then
`{{placeholders}}` are replaced with the real lesson, code and asset list.

Save the file and the next message uses it. If a file is missing or broken, the server
logs `[ai] … — falling back to the built-in prompt` and uses the previous hard-coded
prompt, so a typo never takes the app down. Watch the terminal after editing.

## Front-matter

Every file starts with a `---` block:

```markdown
---
name: coder
description: What this agent or skill is for.
model: ""                              # optional, see below
skills: [kid-communication, phaser-rules]
---
The prompt text starts here.
```

| Key | Where | Meaning |
|---|---|---|
| `name` | both | Should match the filename. For your reference. |
| `description` | both | What it's for. For your reference. |
| `model` | agents | Optional `provider:model` override. **`.env` wins over this.** Leave `""` normally. |
| `skills` | agents | Skill files to append, in order. |
| `when_ai_mode` | skills | Only include this skill when the lesson's `ai:` equals this (`full` \| `guided` \| `off`). |

Supported syntax is deliberately small: `key: value`, quoted values, `[a, b, c]`, and
`- item` lists. `#` starts a comment. Nested structures are **not** supported.

## Placeholders

| Placeholder | Becomes |
|---|---|
| `{{gameCode}}` | the student's current `game.js` |
| `{{lessonTitle}}` | the lesson they're on |
| `{{lessonContext}}` | that lesson's text |
| `{{ownedAssets}}` | the asset keys they own, one per line — the only keys that exist |
| `{{files}}` | their other project files (`main.js`, anything they added) |
| `{{aiMode}}` | `full`, `guided` or `off` for this lesson |

An unknown placeholder becomes an empty string.

Conversation history is **not** a placeholder — recent turns are passed as real
conversation messages, which models handle better than pasted-in text.

## Things worth knowing

- **The coder's JSON contract is load-bearing.** `coder.md` tells the model to reply with one
  JSON object using `config` / `functions` / `create` / `update` / `newFile` / `replaceFile`.
  The browser applies exactly those fields. If you change their names or meaning here, the
  edits stop working — change `applyOps()` in `public/js/project.js` to match.
- **Asset keys are checked, not trusted.** Whatever `coder.md` says, the server verifies the
  keys in a proposed edit against what the student owns and refuses the change otherwise.
  Wording in the prompt reduces how often that fires; it isn't the safety net.
- **Keep it short.** Everything here competes with `game.js` for the model's context window.
  A local 7B degrades noticeably on a long prompt. Cut before you add.
- **Test both models.** A rule a big cloud model follows happily is often ignored by the
  local 7B. If a behaviour matters, verify it on Ollama.

## The MCP server (`ai/mcp-server.js`)

MCP (Model Context Protocol) is a standard way for an AI client to discover and use what a
server offers. Ours exposes, read-only:

- **tools** — the same five in `tools.js` the coder and tutor already use
- **resources** — every lesson (`lesson://<id>`), the course outline, the 265-asset store
  catalogue, and the Phaser reference
- **prompts** — the agent and skill markdown in this folder, as the course uses them

It is a thin wrapper on purpose: the tools come straight from `tools.js`, so there is one
definition of what a tool does, not two that can drift apart.

Two of the five tools (`list_owned_assets`, `read_file`) answer questions about a specific
student's session. Over MCP there is no student, so they say so rather than returning an empty
list that reads like "this student owns nothing."

```bash
node app/tools/check-mcp.js
```

Claude Code picks it up automatically in this repo via `.mcp.json` at the root, which is what
makes it useful today: a session authoring lessons can query the real asset catalogue and read
real lesson text instead of guessing.
