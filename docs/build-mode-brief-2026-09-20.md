# Build mode says it worked and nothing changes

**For: Claude Fable 5, in plan mode, with this repository open.**
**Deliverable: a written plan an implementing model (Opus) can follow. Do not write the fix yourself.**

---

## The symptom

A student asks Build mode for a change. The panel answers as though it made the change. The game is
byte-for-byte identical. This is the single most damaging failure the app has, because an
eleven-year-old does not conclude "the tool is broken" — they conclude they asked wrong, and they
ask again, and it happens again.

It has been reported repeatedly and never reproduced on demand. It is now reproduced in a log.

## The evidence, from a real session on 20 September 2026

Captured from production via `npm run session:watch`. Two lines matter:

```
20:23:48  tool   create   No tool called "create". Available: list_owned_assets, search_store, …
20:23:53  ask [coder 10s]  Can you add an fps counter in the top right?   (no ops)
```

and, from `npm run session:report` over the same capture:

```
2 of 2 builder replies changed nothing at all
```

Read those together. The model spent a round calling a tool named `create`, was told no such tool
exists, and five seconds later produced a reply carrying no edit field. Ten seconds end to end, so
nothing timed out and nothing was killed by the platform.

`create` is not a tool. It is one of the **op fields** the coder prompt tells the model to put in its
JSON answer (`app/ai/agents/coder.md:90`). The model reached for it in the wrong namespace.

## What you are being asked to do

Find out why Build mode returns no ops, and why the student is told otherwise. Then write the plan.

I have three leads. **They are leads, not findings.** Two of them I traced through the code and did
not execute; the third I cannot test without knowing which lesson was open. Confirm, refute, or
replace them — a plan built on the wrong one of these is worse than no plan, because it will look
like it worked.

### Lead 1 — the two namespaces are both in front of the model at once

`app/ai/provider.js:141-153` runs the tool loop by calling `chatOnce(spec, system, msgs, false, true)`
— tools on, JSON off. The `system` there is the **entire coder prompt**, whose closing section is a
table of fields named `config`, `create`, `update`, `functions`, `editFile`, `newFile`,
`replaceFile` (`coder.md:82-94`). Bound alongside it are five real tools, none of which share those
names (`app/ai/tools.js:167-284`).

So during the lookup phase the model is holding two vocabularies with no marker separating them, and
the telemetry shows it picking from the wrong one. Worth checking: whether the ops table should be
withheld until the final call at `provider.js:154`, where tools are off and JSON is back on, and what
that costs in prompt caching and in the model's ability to plan its lookups.

### Lead 2 — the app manufactures the exact word the prompt forbids

`app/routes/ai.js:336`:

```js
let parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };
```

If the model's final turn carries no text — it spent its rounds on tool calls, or ended on a
`tool_use` block, or returned prose that `extractJSON` could not parse — `raw` is empty and the
student is shown the literal string **"Done."** with no ops attached.

`coder.md:86` instructs the model: `reply` … **"Never 'Done.'"** The code says it on the model's
behalf, in the one case where it is guaranteed false.

Now follow it through the guards. The `no-ops` guard (`routes/ai.js:357-372`) is the one built to
catch exactly this, and it fires on `claimsChangeWithoutOps(parsed.reply, ops)`. That function tests
the reply against `CLAIMS_A_CHANGE` at `app/ai/guards.js:216`:

```
/\b(i(?:'ve| have)? (?:added|changed|updated|set|made|created|implemented|fixed|adjusted)|now (?:sprints?|jumps?|runs?|moves?|has|can|will)|will now|you can now|is now)\b/i
```

**"Done." matches none of those alternatives.** So the one reply the app invents for itself is
invisible to the one guard written to stop it, and it reaches the child unchallenged.

This one I did run, against the real module, with empty ops:

| reply | `claimsChangeWithoutOps` |
|---|---|
| `I added an FPS counter.` | caught |
| `Your player can now sprint.` | caught |
| `Done.` | **missed** |
| `Added it.` | **missed** |
| `I could not work that one out.` | missed (correctly — it claims nothing) |

The last row is the guard working. The middle two are not. `Added it.` is a plain past-tense claim
with no leading "I", which the regex requires, so the guard's coverage is narrower than its name
suggests independently of the `'Done.'` fallback. Treat the fallback and the regex as two defects
that happen to compound, not one.

### Lead 3 — the model may be withholding deliberately

`coder.md:40-55` tells the coder that when a request **is** the current lesson's practice exercise,
it must return no edit field at all, deliberately, and instead name the step and point at Tutor mode.
`coder.md:55` tries to bound this — "If it is *close* but not the same thing, build it" — which is a
judgement call made by a model with the exercise text in its prompt.

The captured request was *"Can you add an fps counter in the top right?"* If the lesson open at
20:23 had a practice exercise about drawing a number on the screen, correct behaviour and the bug are
indistinguishable from outside. Check `{{practiceTask}}` against the lessons, and check whether the
telemetry records enough to tell these apart after the fact. If it does not, that gap is itself a
finding and belongs in the plan.

Note that this lead predicts a reply *refusing* helpfully, and leads 1 and 2 predict a reply
*claiming success*. Whichever the real reply text was, it discriminates between them. Find it if the
capture still holds it.

## Where to look

| file | why |
|---|---|
| `app/routes/ai.js:323-451` | the coder branch, `toOps`, and the four-guard loop |
| `app/ai/provider.js:130-155` | `callAI`, the two-phase tool loop, the final JSON call |
| `app/ai/provider.js:53-113` | `chatOnce` per provider; note `wantJSON && !withTools` at `:78` |
| `app/ai/guards.js` | `extractJSON`, `OP_FIELDS` (`:18`), `CLAIMS_A_CHANGE` (`:216`) |
| `app/ai/agents/coder.md` | the ops table, the practice-exercise carve-out |
| `app/ai/tools.js:301` | `runTool` returns `{error}` and never throws, so a bogus tool is silent |
| `app/ai/models.js:54-66` | `AGENT_TOOLS`, and `MAX_TOOL_ROUNDS` defaulting to 4 |
| `app/public/js/ops.js` | the browser side — confirm ops that *do* arrive are applied |

`app/public/js/ops.js` is on that list for a reason: nobody has proved the failure is server-side.
An op that arrives and is dropped in the browser produces the identical symptom, and the telemetry
records `ops: false` from the **server's** view of the response body, so it would not distinguish
them. Rule the client in or out early.

## Constraints the plan has to respect

- **No bundler.** Plain ordered `<script>` tags in `app/public/index.html`. A new client file needs a
  tag in the right position.
- **`npm test` is 22 checks and must stay green.** New behaviour gets a new check. `check-prompts.js`
  asserts all six agent prompts still build; `check-guards.js` covers the guard table.
- **Vercel serverless.** No persistent filesystem, 60s ceiling, module state dies on cold start. A
  promise left floating after `res.json()` may never run.
- **The repo is CRLF.** Any patch script must preserve line endings.
- **Telemetry must never break a request** — the fail-open discipline at `app/store.js:159-161`.
- The audience is 11-to-14-year-olds on school Chromebooks. A failure the app cannot fix should say
  something a child can act on, which is what the `giveUp` strings exist for.

## What the plan should contain

1. **The actual cause, stated once, with the evidence that settles it.** If two causes are both real,
   say so and rank them by how often each fires.
2. **The fix, file by file**, smallest change that works. If a fix is a prompt change rather than a
   code change, say that plainly — this repo treats `app/ai/agents/*.md` as source.
3. **How it gets tested.** A check that fails before the fix and passes after. The "says done,
   changed nothing" path needs one specifically, since it survived four guards and 22 checks.
4. **What you chose not to fix and why.** The guard table carries deliberate inconsistencies
   (`routes/ai.js:350-353` documents three different empty-reply fallbacks as intentional). Leave
   them unless they are the cause.

## Out of scope

Do not restructure the agent system, do not add a queue or a job runner, do not add a second model
call to check the first one's work, and do not touch the Tutor, quiz, grader or design-coach paths
except where they share the code you are changing. Beta testers have already run on this build; the
goal is the narrowest correct fix, not a better architecture.
