# Make Build mode as useful as Tutor mode

> **Hosting has changed since this was written.** The app now runs on the League's own server (one
> Docker container; see `DEPLOY.md`). The Vercel/serverless limits cited below (60 s ceiling, no disk, no
> background work) no longer apply and are not constraints. Vercel will very likely never be used again.

**For: Claude Fable 5, in plan mode, with this repository open.**
**Deliverable: a written plan an implementing model (Opus) can follow. Do not write the fix yourself.**

---

## The ask

Tutor mode works. Students ask it things and it explains, follows up, and feels like talking to
someone who knows the material. Build mode, which is the mode that actually changes their game, is
worse at helping than the mode that cannot touch the code at all.

Three things are wanted from it, and the third is the one that matters most:

1. **It should not claim to have done something it did not do.** It currently says "Done." in cases
   where nothing changed.
2. **It should be efficient** — not burn model calls producing nothing.
3. **It should behave like Claude does in a chat.** When it cannot do what was asked, or the request
   is ambiguous, or the student's code has a problem in the way, it should *say what the problem is
   and work through it with them*. Right now it is heavily gated: it refuses, it withholds, and when
   it does have something useful to say the app frequently throws that text away and replaces it
   with a canned apology.

Point 3 is the brief. Points 1 and 2 are symptoms of the same design.

## Start here: the one-line difference between the two modes

Both agents go through the same `callAI`. Compare how they are called.

```js
// routes/ai.js:276 — TUTOR
raw = await callAI(spec, tutorSystem, message, false, history, agentTools, onTool);

// routes/ai.js:334 — CODER
raw = await callAI(spec, system,      message, true,  history, agentTools, onTool);
```

The fourth argument is `wantJSON`. The tutor writes prose and the prose *is* the answer. The coder
fills in a form, and anything it wants to say has to fit the `reply` field, which
`app/ai/agents/coder.md:86` caps at "1-2 sentences" and forbids from being conversational.

So the mode that most needs to explain itself is the one given the least room to. Everything below
follows from that. **Question whether the coder should be answering in a single strict-JSON turn at
all** — and if it should, whether the explanation has to travel in the same object as the edit.

## The gates, specifically

Find all of these in the code and judge each one. Some are protecting students from real crashes and
must survive in some form. Others are refusing on the student's behalf.

### Gate 1 — the guards discard the model's own explanation

`routes/ai.js:428-445` runs four corrective guards in order. Each one detects a problem, asks the
model once more, re-checks, and on a second failure does this (`:443`):

```js
return res.json({ reply: g.giveUp(hits), ops: null });
```

`parsed.reply` is dropped on the floor. Whatever the model wrote — which may be a perfectly good
account of what it tried, why Phaser will not do it that way, and what the student could change — is
replaced by a fixed string. The four strings are at `:371`, `:384`, `:399` and `:424`. One of them:

> "I couldn't do that without using something Phaser doesn't have, so I left your game alone. Try
> asking for it a slightly different way."

That tells an eleven-year-old nothing, and it is the app talking, not the agent. **This is the single
biggest thing standing between Build mode and the behaviour Jay is describing.** A plan that changes
nothing else should change this.

Consider: what does the student need at that moment? Probably the model's explanation, clearly marked
as "I did not change anything, and here is why" — with the offer to try a different approach.

### Gate 2 — one request can spend four retries to arrive at a canned sentence

The same loop. Guards run in sequence against whatever the previous guard left in `ops`
(`routes/ai.js:346-348` documents this as deliberate). So a single student request can make the
initial call plus one retry per guard, and `app/ai/provider.js:141` already allows
`MAX_TOOL_ROUNDS` (default 4, `app/ai/models.js:66`) lookup rounds per call before the final one.

That is the efficiency question. Work out the realistic worst case in model calls and seconds against
the 60-second Vercel ceiling, and whether a student who waits that long gets anything for it. Note
`app/ai/provider.js:16-19` already discusses this arithmetic — check whether its reasoning still
holds now that the guard loop sits on top.

### Gate 3 — the practice-exercise refusal

`app/ai/agents/coder.md:40-55` tells the coder that when a request **is** the current lesson's
practice exercise, it must return no edit field at all and point the student at Tutor mode.

The reasoning is sound and is written out at `:46`: the grader reads the file and cannot tell whose
hands typed it, so doing the exercise hands over the badge and destroys the only evidence anyone had
about whether the student learned anything. **Do not propose removing this.**

Do examine how it behaves at the edges. `:55` says "If it is *close* but not the same thing, build
it", which is a judgement call made by a model that only has the exercise text. Ask:

- How often does it fire, and how often is it right? The telemetry may not currently record enough
  to answer this, and if so that gap belongs in the plan.
- When it fires, is the student actually helped? It is supposed to name the step they are stuck on
  and hand off to Tutor. Does it, or does it produce a generic brush-off?
- Could Build mode do the handoff itself rather than telling them to go and click something?

### Gate 4 — assets

`coder.md:57-59` restricts the model to owned asset keys, and the `bad-asset` guard
(`routes/ai.js:412-424`) enforces it. This one is real — an invented key fails to load and breaks the
game. But the failure mode is a refusal, and `assetApology` (`app/ai/guards.js:125`) is the only
thing the student hears. Check whether it names what they would need and where to get it.

## The "Done." problem, concretely

There are **two** places the app manufactures that word, and the prompt at `coder.md:86` explicitly
instructs the model never to use it:

```js
// routes/ai.js:336 — when the model's output will not parse as JSON
let parsed = extractJSON(raw) || { reply: (raw || '').trim() || 'Done.' };

// routes/ai.js:447 — when the model returned no reply field
res.json({ reply: parsed.reply || 'Done.', why: ..., ops: ... });
```

Two guard `parse` fallbacks do the same (`:350-353` documents three different empty-reply fallbacks
as deliberate and says changing them is a behaviour change; `:416` is one of them).

Now trace why nothing catches it. The `no-ops` guard at `:357-372` exists to catch exactly "claimed a
change, changed nothing". It fires on `claimsChangeWithoutOps`, which tests the reply against
`CLAIMS_A_CHANGE` at `app/ai/guards.js:216`. I ran it against the real module with empty ops:

| reply | caught? |
|---|---|
| `I added an FPS counter.` | yes |
| `Your player can now sprint.` | yes |
| `Done.` | **no** |
| `Added it.` | **no** |
| `I could not work that one out.` | no, correctly — it claims nothing |

The word the app invents for itself is invisible to the guard written to stop it. `Added it.` is
missed too, because the regex wants a leading first-person pronoun, so the hole is wider than the
one string.

**This is a symptom, not the disease.** Deleting the `'Done.'` fallbacks makes the message honest but
leaves the student with an empty reply. The real question is what Build mode should say when it has
nothing — and the answer is the same as Gate 1's: whatever the model actually said.

## One piece of hard evidence

From a production capture on 20 September 2026 (`npm run session:watch`):

```
20:23:48  tool   create   No tool called "create". Available: list_owned_assets, search_store, …
20:23:53  ask [coder 10s]  Can you add an fps counter in the top right?   (no ops)
```

and from the report over the same session: **2 of 2 builder replies changed nothing at all.**

`create` is not a tool. It is one of the op *fields* the model is told to put in its JSON answer
(`coder.md:90`). During the lookup phase at `provider.js:142` the model is holding the full coder
prompt — including that table of field names — alongside five real tool specs, with nothing marking
which namespace is which. It picked wrong, and burned a round doing it.

Worth deciding: should the ops contract be in the prompt during the lookup phase at all, or only in
the final call at `provider.js:154` where tools are off?

## Where to look

| file | why |
|---|---|
| `app/routes/ai.js:323-448` | the coder branch, `toOps`, the guard loop, both `'Done.'` sites |
| `app/routes/ai.js:263-300` | the tutor and design-coach branches — the thing that works |
| `app/ai/agents/coder.md` | the ops contract, the reply cap, the practice carve-out |
| `app/ai/agents/tutor.md` | compare. Why does this one produce good conversation? |
| `app/ai/provider.js:130-155` | `callAI`, the two-phase tool loop |
| `app/ai/guards.js` | `CLAIMS_A_CHANGE` (`:216`), `assetApology` (`:125`), `OP_FIELDS` (`:18`) |
| `app/public/js/ops.js` | the browser applies the ops. Confirm arriving ops are not dropped here |
| `app/public/js/ai.js` | the panel: how a reply is shown, and whether it can hold a conversation |

`ops.js` is on the list because nobody has proved the failure is server-side. An op that arrives and
is dropped in the browser looks identical to a student. Rule the client in or out early.

## Constraints

- **No bundler.** Plain ordered `<script>` tags in `app/public/index.html`. A new client file needs a
  tag with an ordering comment.
- **`npm test` is 22 checks and must stay green.** New behaviour gets a new check.
  `check-prompts.js` asserts all six agent prompts still build; `check-guards.js` covers the table.
- **Vercel serverless**: 60s ceiling, no writable disk, module state dies on cold start, and a
  promise left floating after `res.json()` may never run.
- **Prompts are source.** `app/ai/agents/*.md` and `app/ai/skills/*.md` are edited as deliberately as
  the JS. If the fix is a prompt change, say so plainly — that is a legitimate answer here.
- **The repo is CRLF.**
- Audience is 11-to-14-year-olds on school Chromebooks. Every string the app can emit is read by a
  child who may already be frustrated.
- Four runtime dependencies is a ceiling. Adding one needs asking first.

## What the plan should contain

1. **An honest assessment of why Build mode underperforms Tutor mode**, grounded in the code rather
   than in the prompt alone. If the answer is that the JSON contract is the wrong shape for this job,
   say that, and say what replaces it.
2. **A design for what Build mode does when it cannot do the thing** — which is the majority of the
   bad experiences. Explaining and collaborating, not apologising and stopping.
3. **The fix, file by file.** Smallest change that gets the behaviour. Flag anything that is a
   behaviour change to a deliberate decision, because several of these are documented as intentional
   and reversing one needs to be a choice rather than an accident.
4. **How it gets tested.** A check that fails before and passes after. The "said done, changed
   nothing" path survived four guards and 22 checks, so it needs one specifically.
5. **What you chose not to change, and why.** The practice-exercise carve-out should be on this list
   unless you have a strong argument.

## Out of scope

Do not restructure the agent system as a whole. Do not add a queue, a job runner, or a second model
call whose only job is to check the first one's work. Do not touch the tutor, lab-tutor, quiz, grader
or design-coach paths except where they share code with the coder. Do not add dependencies.

Beta testers have already run against this build and more are coming, so the goal is the narrowest
set of changes that makes Build mode genuinely helpful — not a better architecture on paper.
