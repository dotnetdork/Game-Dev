# The AI system: what was built, and what I need next

**For:** Jed, Eric
**From:** Jay
**Date:** 11 August 2026
**Ask:** an API key for a hosted model, so I can test what this is actually like for a student.

---

## The short version

The course app has an AI helper built into it. Six weeks ago it was one prompt hardcoded in a
file, and it guessed at things it should have looked up. It is now a small system of four
specialised assistants whose behaviour lives in editable text files, which check their own work
before a student sees it, and which can look things up instead of guessing.

Both things you asked for are done:

1. **Agents with skills in markdown files** — the AI's teaching behaviour is now plain text a
   teacher can edit, not code.
2. **An MCP server** — the course's content and lookups are exposed over the standard protocol
   that AI tools use to talk to each other.

Everything runs today on a free model on my machine. What I can't tell you yet is how good it
feels with a proper hosted model, because I don't have a key. That's the ask.

---

## Jargon, once

I'll use these words below. They're worth five lines up front.

| Term | What it means here |
|---|---|
| **Model** | The AI itself. "Sonnet 5", "GPT-5", "Qwen" are models. It takes text in, gives text out. |
| **Prompt** | The instructions we send the model before the student's question. Everything the model knows about its job comes from here. |
| **Token** | How models bill and measure. Roughly ¾ of a word. 1,000 tokens ≈ 750 words. |
| **Context window** | How much text a model can hold at once. Too much and older text falls out. |
| **Agent** | One model doing one job with one prompt. We have four. |
| **Skill** | A reusable block of instructions shared by several agents (e.g. "how to talk to a 12-year-old"). |
| **Tool** | Something the model can call to look up a fact mid-answer, instead of guessing. |
| **MCP** | Model Context Protocol. An industry standard (from Anthropic, now widely adopted) for exposing tools and documents to any AI client. |
| **Ollama** | Software that runs a model locally on my PC. Free, private, slower and weaker than hosted models. |

---

## How the AI works now

A student types "make the ship go faster." Here's what happens.

**1. It goes to the right assistant.** There are four, each with its own prompt and its own job:

| Agent | Job |
|---|---|
| **Coder** | Changes the student's game code |
| **Tutor** | Explains concepts — deliberately cannot write code for them |
| **Quiz** | Asks a comprehension question after a change is applied |
| **Grader** | Checks a student's answer and gives a hint |

Splitting them matters. When one assistant did everything, asking "what does this line mean?"
would get you a code change you didn't ask for.

**2. It's given real context.** The coder sees the student's actual game files, the lesson
they're on, and the last few messages. It used to see only the one file, with no memory of the
conversation — so "make it faster" after "add a dragon" had no idea what "it" was.

**3. It can look things up.** Five read-only tools: what art the student owns, what's in the
store, what's in one of their files, how a Phaser feature actually works, and what a lesson
taught. This replaced guessing, which was the single biggest source of broken games — the AI
would invent an image name that didn't exist and the game would go blank.

**4. Its answer is checked before the student sees it.** Four automatic checks:

- Does it use art the student doesn't own? → rejected
- Does it use a Phaser feature that doesn't exist? → rejected
- Does it claim it changed something while changing nothing? → rejected
- Does it reference code that isn't there? → rejected

This is the part I'd most want you to notice. **We don't trust the model — we check it.** Asking
nicely in a prompt is not a safety mechanism; a test is.

**5. The student reads the change before accepting it.** The AI never edits silently. The change
appears in the code editor as a normal red/green diff — the same view a professional developer
sees — and nothing happens until the student clicks Apply. The whole course is about reading
code, so an AI that edits invisibly would undermine the thing we're teaching.

---

## What was built, stage by stage

Six stages, 61 commits.

| Stage | What landed | Why it mattered |
|---|---|---|
| **0** | Cleanup and hardening | Removed dead code; fixed a security hole where AI output could run scripts in the page; brought all external libraries in-house so the app works on a filtered school network |
| **1** | Real context | The AI can now see the student's files, lesson and conversation |
| **2** | **Agents and skills as markdown** *(your ask #1)* | The AI's behaviour became editable text files instead of code |
| **3** | The teaching loop | Propose → read → accept; explain-any-line; a quiz after each change; a tutor that hints before answering |
| **4** | Tools and self-checking | The AI looks things up, and its answers are verified |
| **5** | **MCP server** *(your ask #2)* | Everything above exposed over the industry-standard protocol |

Two of these deserve more than a row.

### Your ask #1 — skills as markdown

The AI's personality and teaching rules are now four agent files and four skill files, in plain
English. This is the whole of `kid-communication.md`, which every agent uses:

> - They are 11 to 14. Write like a friendly older sibling who codes, not like documentation.
> - Short sentences. One idea per sentence.
> - Name things the way their code names them ("the player", "the coins"), not in jargon.
> - Never say "simply", "just", or "obviously" — if it were obvious they would not be asking.
> - If something they asked for is a bad idea, say so kindly in one sentence and offer the
>   version you would do instead.

That is the actual file, not a summary of it. To change how the AI talks to students, you edit
those lines. No developer, no deployment — the files reload while the app is running.

The skills are reusable, so a rule written once applies everywhere. One of them,
`guided-mode.md`, only activates on lessons marked "guided", where the AI is required to make the
student say exactly what they want changed rather than doing their thinking for them.

**Why this matters to you:** the teaching approach is now owned by whoever writes the curriculum,
not by whoever writes the code.

### Your ask #2 — the MCP server

MCP is the standard way for AI tools to offer things to each other. Ours offers, read-only:

- **5 tools** — the same lookups the course's own AI uses
- **50 documents** — all 47 lessons, the course outline, the 265-item asset catalogue, the Phaser reference
- **8 prompts** — the agent and skill files above

It's a deliberately thin layer over what already existed, which is the honest way to build it. It
already earns its place: when I'm writing lessons with an AI assistant, that assistant can now
read the real lesson text and the real asset list instead of inventing them.

---

## What it can do today

- Change a student's game from plain English, across multiple files
- Explain any line of the student's own code, on click
- Teach without giving the answer away — hint first, answer if asked again
- Quiz the student on a change they just accepted
- Refuse to use art or code features that don't exist
- Run entirely offline on a local model, with no per-student cost
- Switch to any hosted model by editing one config file — no code change

## What it can't do, honestly

- **It's only been tested by me.** No student has used it. That's the real gap.
- **The local model is the weak link.** It's a 9-billion-parameter model on my home GPU. Hosted
  models are perhaps 50× larger. Every limitation below is mostly this.
- **It's slow locally** — several seconds per reply. Fine for me; probably not fine for a room of
  thirteen-year-olds.
- **Complex requests still fail.** "Add a shop with three upgrades" is beyond it. Single, concrete
  changes work well.
- **No memory between sessions.** A student who returns tomorrow starts fresh.
- **It can't see the running game.** It reads the code, not the screen, so "the jump feels floaty"
  is hard for it.
- **Student identity is not verified**, so the per-student rate limit (40 requests per 10 minutes)
  could be worked around by a curious kid. Fine for a pilot; needs real logins before it's public.

---

## What I need: an API key

**The ask: an API key for a hosted model, ideally OpenRouter.**

**Why OpenRouter:** one key gives access to every model below, so I can measure which is actually
best for this instead of committing to a guess. Going direct to a single provider also works —
it's a one-line config change either way.

### The models I'd start with

Prices are per million tokens, taken from OpenRouter on 11 August 2026. "Cost per request" is
calculated for our actual usage: a code request sends about 5,000 tokens and gets back about 700.

| Model | OpenRouter ID | In / Out per 1M | Cost per request |
|---|---|---|---|
| Claude Sonnet 5 | `anthropic/claude-sonnet-5` | $2 / $10 | $0.017 |
| GPT-5.6 Terra | `openai/gpt-5.6-terra` | $1 / $6 | $0.009 |
| Gemini 3.6 Flash | `google/gemini-3.6-flash` | $1.50 / $7.50 | $0.013 |
| Gemini 3.5 Flash Lite | `google/gemini-3.5-flash-lite` | $0.30 / $2.50 | $0.003 |

The four assistants don't have to use the same model, and shouldn't. My proposed starting point —
this is the entire configuration change, in one file:

```
CODER_MODEL=openrouter:anthropic/claude-sonnet-5
TUTOR_MODEL=openrouter:anthropic/claude-sonnet-5
QUIZ_MODEL=openrouter:google/gemini-3.5-flash-lite
GRADER_MODEL=openrouter:google/gemini-3.5-flash-lite
```

**Sonnet 5 for the coder**, because it reliably produces the strict format our code-editing
contract depends on, and the coder is the one assistant whose mistakes a student sees.
**Sonnet 5 for the tutor too, initially** — its hard job is *refusing* to write code when a
student pushes for it, and that's worth over-spending on until I've read real transcripts.
**Flash Lite for the quiz and grader**, which are short, low-stakes jobs where the cheap model is
genuinely fine. I'd also test **GPT-5.6 Terra** as the coder, at roughly half the cost.

### What it costs to run

| | Per request | Per student-hour (20 requests) | Per class-hour (25 students) |
|---|---|---|---|
| Sonnet 5 coder | $0.017 | $0.34 | **$8.50** |
| GPT-5.6 Terra coder | $0.009 | $0.18 | $4.60 |
| Quiz + grader | $0.003 | $0.06 | $1.50 |

**The ask is a capped $20–50 to test.** At Sonnet 5 pricing, $30 buys about 1,750 code requests —
far more than an evaluation needs. The app already rate-limits each student, and I'd lower the cap
on the expensive assistant before testing.

**What I'd do with it, in order:**

1. Run the same set of real student requests against the local model and each candidate, and score
   them on success rate and speed — a table, not an opinion.
2. Confirm the automatic safety checks still behave with a much stronger model.
3. Settle the per-assistant model choice with those measurements.
4. Report back actual cost per student-hour instead of the estimate above.

**The risk if we don't:** I can keep polishing against a local model, but I'd be guessing about
the thing that matters — whether this actually helps a real student in a real classroom.

**What I do *not* need:** any change to how the app is built. The provider switch is one line in a
config file. Keys stay on the server and are never sent to the browser. The local model stays as a
permanent free fallback, which also means a demo never depends on the internet.

---

## Questions I have for you

**On the key**
1. What spending cap should I work within for testing?
2. Do you want the key restricted to the four models above, or open so I can compare more?

**On the classroom**
3. What's an acceptable wait for a reply? That decides which models are usable at all — the
   cheaper ones are generally faster, so this trades off against quality.
4. Should the AI be available in every lesson, or off during assessments?
5. How many students would be on it at once? That sets the rate limits I configure.

**On what happens next**
6. Can I get this in front of a few real students, and how do I arrange that? It's the only
   remaining way to learn anything important about it.
7. Who owns the curriculum content long-term? The system is built so a non-developer can edit the
   teaching behaviour — that only pays off if someone actually does.

---

## If you want to check any of this

Everything is committed and verifiable. From the project folder:

```bash
node app/tools/check-mcp.js
```

Starts the MCP server and exercises every part of it — 14 checks.

```bash
node app/tools/check-challenges.js
```

Runs all 22 in-lesson labs and confirms each is both solvable and not already solved.

The AI's teaching behaviour is readable without any technical knowledge, in `app/ai/agents/` and
`app/ai/skills/`. Those are the files I'd suggest looking at first — they're short, they're
English, and they're where the actual pedagogy lives.
