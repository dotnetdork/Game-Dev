# Making "the AI is the course" cheap: cost and efficiency research

> **Hosting has changed since this was written.** The app now runs on the League's own server (one
> Docker container; see `DEPLOY.md`). The Vercel/serverless limits cited below (60 s ceiling, no disk, no
> background work) no longer apply and are not constraints. Vercel will very likely never be used again.

2026-09-25. Scope: cost and efficiency only (a separate architecture design is under way elsewhere).
Inputs read: `CLAUDE.md`, `docs/rework/00-direction.md`, `docs/rework/course-engine.md`,
`docs/rework/briefs/first-run.md` §6, `docs/ai-system-brief.md`, `docs/child-privacy-brief.md`,
`app/ai/{models,provider,usage,tools,loader,guards}.js`, `app/routes/ai.js`, `app/ai/agents/*.md`,
`app/store.js`, `app/telemetry.js`, `app/.env.example`, `docker-compose.yml`, `DEPLOY.md`.

Evidence labels:
- **[verified-doc]**: read on the official page today (platform.claude.com pricing and batch-processing pages were fetched in full).
- **[verified-snippet]**: from search-result snippets. openrouter.ai is blocked by the egress proxy, so OpenRouter claims come from its blog and docs as quoted in search results.
- **[repo]**: read in this repository, with file:line.
- **[knowledge]**: my own understanding, not checked today.
- **[estimate]**: an assumption made for the cost model.

---

## 0. What the code does today (the baseline these savings are measured against)

I read each of these lines myself.

| # | Finding | Where | Cost effect |
|---|---|---|---|
| F1 | The Anthropic call sends `system` as one flat string and never sets `cache_control`. | `app/ai/provider.js:78` | No prompt caching. Every call pays full input price for the whole prompt. |
| F2 | The first per-student slot comes early in the coder prompt: `{{whereTheyAre}}` at line 35 and `{{gameCode}}` at line 44, *above* about 150 lines of static rules. Skills are added *after* the filled body. | `app/ai/agents/coder.md:35,44`; `app/ai/loader.js:148-161` | Even with caching switched on, the cacheable prefix would end at line 35 (about 1–1.5k tokens). The static rules after it would be re-billed every time. |
| F3 | The whole project goes into every coder request: `gameCode` up to 100k chars, plus up to 30 files × 12k chars. | `app/routes/ai.js:137`, route ctx `files` | Input grows with the game. A mature game is probably 20–40k chars, so 6–13k tokens per call, resent on every tool round. |
| F4 | The tool loop resends the full conversation each round: up to `MAX_TOOL_ROUNDS=4`, plus a final call, plus one corrective retry pass. | `app/ai/models.js:66`; `app/ai/provider.js` `callAI`; `app/routes/ai.js` guard block | One build request can cost 2–10 model calls, each carrying the full context. |
| F5 | `max_tokens: 8000` for every agent, and no `thinking` or `effort` setting. On Claude Sonnet 5, leaving `thinking` out means adaptive thinking runs, billed as output, at default effort `high`. | `app/ai/provider.js:78` | Dialogue-sized answers may carry thinking-token spend nobody asked for. |
| F6 | `usage.js` adds cache-write and cache-read tokens into "input" at full price. The Haiku price is stale: `$0.8/$4` under a dated ID, where the current price is $1/$5 for `claude-haiku-4-5` [verified-doc]. Per-call telemetry has no student, class or quest. Totals live in module memory. | `app/ai/usage.js:32,60-68,89` | You cannot see the cache hit rate, cost per class, or which agent or quest drives spend. |
| F7 | The OpenRouter path sends `system` as a plain string. There is no `cache_control` block and no sticky `session_id`. | `app/ai/provider.js` openrouter branch | Anthropic and Gemini models behind OpenRouter do not cache. |
| F8 | The rate limit is 40 *requests* per 10 min per student (240/hr), counted in Redis. | `app/routes/ai.js:72`, `app/store.js:149` | It caps request count, not tokens or dollars. One request can be 10 calls (F4). |
| F9 | A good precedent already exists: `tools.js` answers Phaser questions from a local generated index, with no network, because live web answers were measurably wrong. It also has the "reject, never repair" checkers (`quiz-check.js`, `grade-check.js`). | `app/ai/tools.js:27-37`; `app/ai/models.js:34-45` | This is the retrieval pattern to extend (§3). |

Existing estimate for comparison (`docs/ai-system-brief.md:177-199`): a code request is about 5,000 tokens in and 700 out, which is $0.017 on Sonnet 5. At 20 requests per student-hour, that is $8.50 per class-hour (25 students). The new design makes about 3× more AI turns per hour, because every dialogue beat is an AI turn. So a naive build of the new design costs much more than that brief assumed (§9).

---

## 1. Deterministic first: never an LLM call

Rule: **the LLM supplies words and code. The app owns state, rules, scheduling and scoring.** Every item below is a pure function of data people wrote plus the learner card. That makes it free, instant (a child is waiting), testable in `app/tools/check-*.js`, and the same every run. Each matches the repo's "reject, never repair" stance.

| Course part | How to do it without an LLM | Where the LLM still helps (optional) |
|---|---|---|
| **Quest scheduling / "director" core** | Rules over the concept web: filter to nodes whose prerequisites are met (`vocabulary.yaml` already models needs-what). Score by (a) due-for-review under a spacing rule, e.g. revisit a concept 1, 3 and 7 quests after it was learned, the Leitner-style boxes in [knowledge]; (b) matches interest tags on the learner card; (c) character variety. Pick the top 2–3. Plan-ahead "plants" are fields authors write into quest outlines (`plants: [feedback]`). | One short call to *phrase* the teaser ("the sound designer wants to meet you…"), or none if teasers are authored per quest. |
| **Skill / learner-card updates** | Event rules: quest completed → concept box +1; hint used → pace signal; option picked → interest tag; undo count, reading-level heuristic (option-read time, word count typed). | One recap-summary call per quest (§6) that writes 2–3 short *observations*, never the score. |
| **Quest completion checks** | Check the game's runtime state and code for the outline's "what counts as done". Examples: `CONFIG.gravity` changed; a `physics.add.overlap` exists between player and new group; a particle emitter object exists in the running scene. Write these as declarative check specs in the quest outline, run in the browser against the live game or statically against the code. | Only when a check is marked `judgement: true` (e.g. "the level feels harder"). Then a small model answers yes/no with a reason, and the deterministic checker validates its JSON. Expect under 30% of checks to need it [estimate]. |
| **Menus, navigation, "what do I do next"** | UI. The quest log shows the current goal from the outline. | No. |
| **Prizes / currency / unlocks** | A table: quest → reward; concept card collected → reward. Prize logic must never depend on AI output. Kids will probe it, and it must be fair and auditable. | No. |
| **Scripted beats** (first-run opener, character intros, unlock ceremonies, rejoin points) | Authored dialogue nodes (§2). | No. |
| **Simple building ("make the jump higher")** | "Knobs". `config.js` already holds the CONFIG numbers (`coder.md` table). Map a recognised intent to a bounded config op with a slider. The quest can *teach* the knob ("gravity is a number, try 300"). | Intent recognition can be keyword and synonym tables first, with a small model only when that fails. |
| **Safety / format guards** | Keep `guards.js` (asset keys, bad APIs, empty ops). With structured outputs (§6), expect fewer retries. | No. |

**What it saves [estimate]:** in the call mix of §9, deterministic handling removes about 11 of 66 events per kid-hour (menus and prizes 5, knob builds 3, most checks, director scoring). It also removes the most expensive *kind* of call: director and checker calls that would otherwise carry the whole concept web and the whole game. On the naive cost model that is about 15% of calls and about 20% of spend, before counting knock-on effects such as fewer retries.

---

## 2. Pre-generation vs live generation

**Offline, reviewed by people, generated per quest (a "quest pack"):**
- The dialogue tree for the quest's spine. The authored outline stays short (course-engine.md §2). An offline generator expands it into about 20–40 nodes: character line plus 3–4 options, each option → next node. It uses branch-and-rejoin, as the direction doc already decided.
- Each node at **2–3 reading levels** (e.g. L1 at about Grade 3 with very short lines, L2, L3), plus optional **interest-flavoured variants** keyed by a *closed* tag list (platformer / puzzle / cozy / action).
- Explanations of the quest's concept in several forms (analogy, show-me demo spec, one-line recap), hints 1→3 (escalating), 2–3 "common mistake" responses, a recap question with authored feedback, and the teaser line for the next quest.
- Canned replies for predictable off-script input: "I'm bored", "this is hard", "what's gravity", "can I skip", "idk". Match them by keyword and intent (§3).

Pooled does not mean identical: every pooled node is a slotted template with 4–8 variants, selected by learner card and personalised cheaply. See §11 for the snowflake requirement.

**Live AI only for:**
1. Free text that does not match a pack reply.
2. Personalised rejoin lines that reference the kid's own game ("your frog jumps too high now!"). These can often be templated deterministically with slots from game state.
3. **Building and editing the game.** This is unavoidably live and the main cost.
4. Clarifying a vague build request.
5. Judgement checks and the per-quest recap summary.

**Share of turns served from pre-generated or deterministic content [estimate, 60 kid actions/hour]:**

| Kid action | per hour | served without an LLM | live |
|---|---:|---:|---:|
| Pick a dialogue option on an authored node | 35 | 28 (80%: authored nodes + slot templating) | 7 (branching off the tree, personalised callbacks) |
| "Say something else" free text | 10 | 3 (keyword/intent → canned reply or concept card) | 7 |
| Build request | 10 | 3 (knobs) | 7 |
| Menus, prize claims, quest log | 5 | 5 | 0 |
| **Total** | **60** | **39 (65%)** | **21** |

The realistic range is **50–75%**. It depends on how talkative the class is, and one cohort's telemetry will show it (§10). Commercial RPG dialogue ("Skyrim-style") is fully authored for exactly these reasons: consistency, cost and voice [knowledge]. Here the tree is machine-drafted and people review it, which keeps authoring cost low.

Side benefits that matter as much as cost: pre-generated nodes respond **instantly**, where a live model takes 1–5 s. They are **reviewed** (the direction's "people own the web", and COPPA-friendly). They are **the same for every kid**, so a teacher can see what a child was told. A child cannot talk them into saying something off-brand.

---

## 3. The context library (retrieval with no new dependencies and no vector DB)

The idea: agents get **small, curated, pre-written context retrieved by ID or tag**, not long prompts and not open research.

**Contents (Markdown or YAML under `app/content/`, written or reviewed by people, versioned):**
- **Concept cards**: one per concept-web node. Definition at 3 reading levels, one analogy, the Unity/Godot/Unreal names (course-engine.md §1), common misconceptions, the concept IDs it depends on. About 300–600 tokens each.
- **Quest packs**: §2, plus the machine-readable completion checks.
- **Character sheets**: persona, voice rules, catch-phrases, the character's slice of the web. About 1–2k tokens each.
- **Engine glossary / Phaser recipes**: already half there in `ai/reference/phaser-api.md` (5.4 KB) and the generated `public/phaser-docs/` index behind `search_phaser_docs`. Add short "recipes" per buildable feature (particles, overlap, camera follow) that the builder pulls before editing.

**Retrieval approaches that fit the constraints:**
1. **Per-quest context bundle (the main one).** When the director starts a quest, the server assembles one deterministic text block: character sheet + quest pack + concept cards for the quest's concept and its "plants", plus relevant recipes. The bundle is **byte-identical for every kid on that quest**, which makes it the ideal cache prefix (§4). There is no retrieval step at runtime, only a lookup by quest ID.
2. **Tag / keyword index**, built at load time into a plain JS `Map` (tokenise → concept IDs), the way `tools.js` `searchPhaserApi` already scores name hits (`app/ai/tools.js:89-125`). It is used to (a) route free text to canned replies or concept cards before any LLM call, and (b) back a new `get_concept_card(id|query)` tool the character can call when a kid asks about something off-quest.
3. **BM25-lite** over about 100–300 cards, if keyword recall proves weak: about 40 lines, no dependency [knowledge]. At this corpus size a vector DB adds nothing but a dependency and a network hop.
4. **Anthropic's server-side tool search** (`tool_search_tool_bm25_20251119`) exists, but it searches *tools*, not documents. It is not needed here.

**Is pulling research live ever worth it? No, for the child-facing loop:**
- **Blocked or filtered on school networks**, the same reason there is no bundler (CLAUDE.md).
- **Cost:** web search is $10 per 1,000 searches plus the result tokens. An average fetched page is about 2,500 tokens [verified-doc, pricing page]. That is 10–50× the size of a concept card, on every use.
- **Correctness:** `models.js:34-45` records the measured failure. Without local docs the agent gave 3 wrong answers out of 4 about Phaser 4, and web pages describe whichever version they happened to cover.
- **Child safety and review:** unvetted third-party text reaches a 10-year-old, and breaks "people own the web".
- **Latency and serverless:** extra round trips inside a 60 s ceiling with a child waiting.
- **Non-determinism:** it breaks the checker and makes a teacher's view impossible.

Research belongs **offline, with authors**, when a card is written. Then it is reviewed once and served forever.

---

## 4. Prompt caching

### 4.1 Anthropic (first-party API) [verified-doc unless noted]

- **Pricing multipliers on base input:** 5-minute cache write **1.25×**, 1-hour write **2×**, cache read (hit, which also refreshes the entry) **0.1×**. Opus 5.5 reads at 0.05× and Fable 5.1 at 0.025×. Writes pay off after one read (5m) or two reads (1h). The multipliers stack with the Batch discount and data residency.
  - Sonnet 5: input $2, 5m write $2.50, 1h write $4, read $0.20, output $10 per MTok.
  - Haiku 4.5: $1 / $1.25 / $2 / $0.10 / $5.
  - Opus 5: $5 / $6.25 / $10 / $0.50 / $25.
- **TTL:** 5 minutes by default, and each read resets the timer at no cost. Set `ttl: "1h"` for gaps of 5–60 minutes. The lifetime runs from the *start* of the request that wrote or read the entry. If requests sharing a prefix start less than 5 minutes apart, 5m stays warm indefinitely, and 1h buys nothing (claude-api skill `shared/prompt-caching.md`, cached from the official page).
- **Minimum cacheable prefix** (skill doc, cached 2026-06; the Haiku 4.5 figure is corroborated by the OpenRouter snippet [verified-snippet]):
  - Opus 5: 512 tokens.
  - Sonnet 5: 1,024.
  - **Haiku 4.5: 4,096.** This is a trap: a 3k-token Haiku prompt silently does not cache.
  - Below the minimum, `cache_creation_input_tokens` reads 0, with no error.
- **Structure:** the prefix is matched byte for byte in the order `tools` → `system` → `messages`. There are up to 4 breakpoints. Top-level automatic caching is available, and so are explicit `cache_control: {type:"ephemeral"}` markers on blocks.
- **Scope:** the cache is isolated per **workspace** (never across organisations). All classes on one workspace share cache entries for the same bundle, so class B's first request can read what class A wrote if it lands within the TTL.
- **Caches are per model.** Routing the same prefix to Haiku and Sonnet makes two separate cache entries.
- **Verify** with `usage.cache_read_input_tokens` and `cache_creation_input_tokens`. Total prompt = `input_tokens + cache_creation + cache_read`.

### 4.2 OpenRouter [verified-snippet]

- It passes `cache_control` breakpoints through for **Anthropic and Gemini** models. Blocks must be content arrays (`{"type":"text","text":…,"cache_control":{"type":"ephemeral"}}`), not a plain system string, which is what F7 sends today.
- **OpenAI** models cache automatically at 1,024 tokens or more, with reads at about 0.25–0.5×. **Gemini 2.5+** also caches implicitly (reads about 0.25×). **DeepSeek / Qwen** read at about 0.1×.
- **Sticky routing:** pass a stable `session_id`, and follow-ups route to the provider endpoint that holds the warm cache. Without it, provider load-balancing can scatter requests and miss the cache.
- Cached-token counts come back in the response `usage` (OpenAI-style `prompt_tokens_details.cached_tokens`) [knowledge; check the field name when implementing].

### 4.3 How to structure this app's prompts

```
tools            [stable, sorted, same for every call to this agent]
system block 1   agent persona + house rules + skills (static per agent)            ◆ breakpoint 1
system block 2   per-quest context bundle: character sheet, quest pack, concept
                 cards, recipes (identical for every kid on this quest)             ◆ breakpoint 2
messages[0]      per-kid: selected learner-card fields, quest state, rolling summary
messages[1..n]   last few turns (in a build loop: the relevant files, then tool traffic)
messages[last]   the kid's input                                                    ◆ auto-cache tail (5m)
```

- **Fix F2 as part of this.** Move every `{{slot}}` in `coder.md` and `tutor.md` out of the system prompt into a trailing user-turn "context" block. Put skills *before* anything dynamic. This is a reorder of content, and the prompts stay content (CLAUDE.md). Adjust `loader.js buildPrompt` to return `{staticSystem, dynamicContext}`.
- **Never** put timestamps, the kid's nickname, request IDs, or unsorted JSON above a breakpoint. `JSON.stringify` of an object whose key order varies will silently break the cache.
- **Classroom traffic fits 5-minute TTL well.** 20 kids on the same 1–3 quests means each bundle prefix is read many times a minute. Expect cache-read shares on static tokens of **90%+**. Use 1h only for the director prefix, which is called about twice per kid-hour.
- **Keep Haiku prefixes at or above 4,096 tokens.** The quest bundle plus persona (about 5k) clears that naturally. Otherwise do not bother marking them.
- **Worked example [arithmetic].** A Haiku character call with a 5,000-token cached prefix, 1,200 uncached tokens and 150 output:
  - Cached: 5,000×$0.10 + 1,200×$1 + 150×$5 = **$0.00245**.
  - Uncached: 6,200×$1 + 150×$5 = **$0.00695**.
  - Caching gives 65% off that call.
  - On Sonnet 5 with 7k static + 4k dynamic + 1k output: cached is $0.0194; uncached is 11,000×$2 + 1,000×$10 = $0.032. That is 39% off; output dominates, which is why §6 matters.

---

## 5. Model routing / tiering

| Job | Model | Why |
|---|---|---|
| Character dialogue (live nodes), free-text intent, clarifier, recap summary, judgement checks | **Claude Haiku 4.5** ($1/$5), no thinking, JSON output. Alternatives via OpenRouter: Gemini Flash Lite ($0.30/$2.50 per the repo's 11 Aug 2026 table, `docs/ai-system-brief.md:180`) | Short, voice-constrained, strongly templated by the quest pack. Fast first token matters more than depth for a 10-year-old. |
| Game-building edits, director re-plan (if an LLM is used) | **Claude Sonnet 5** ($2/$10) with explicit low/medium effort | The coder's strict ops contract is where mistakes are visible and costly (guard retries). The repo's brief already chose Sonnet 5 for this reason. |
| Hard builds only (multi-file refactor, repeated guard failure) | Escalate to Sonnet 5 at higher effort, not Opus. Log escalations. | Keeps the premium path rare and measurable. |
| Simple builds (one-file, small feature) | Try Haiku 4.5 first *if* an eval shows the guard pass rate holds. Otherwise Sonnet. | About 50% cheaper per build call (§9, aggressive variant). |
| Dev, testing, offline demos, fallback when the API is down | **Local Ollama** (`qwen3.5:9b` today, `.env.example:12`) | Zero marginal cost. The existing brief notes it is several seconds per reply and fails complex requests. |

**Routing mechanism.** The deterministic router in `routes/ai.js` already whitelists agents. Add a `route(kind, signals)` step: intent class (from the keyword index), file count touched, previous guard failure → spec. Keep it **static per agent by default**, because a cascade forfeits cache reuse across models (caches are per model, §4.1).

**Local Ollama on League hardware: trade-offs.**
- *Cost:* no per-token bill. But `docker-compose.yml` shows a plain container behind Caddy with no GPU reservation, so today's League server probably has no GPU. That is an assumption to confirm with whoever runs it.
- *Throughput:* 20 concurrent kids against one consumer GPU. Ollama serves a small number of parallel requests (`OLLAMA_NUM_PARALLEL`) and queues the rest [knowledge]. A 9B model at roughly 40–80 tok/s single-stream [knowledge] would leave kids waiting 5–20 s at peak. A child waiting more than a couple of seconds disengages; the student test already found boredom.
- *Quality:* measured weak on complex builds (`docs/ai-system-brief.md`). Acceptable for classification and short dialogue with a good quest pack.
- *Reliability:* a single box is a single point of failure during a class. The Vercel path can't reach it without exposing it publicly (DEPLOY.md: localhost is the function itself).
- **Recommendation:** use Ollama for dev and CI evals, offline demos, and as an *optional* low-tier dialogue backend if League adds a GPU box. Never as the only path for building during class.

**Thinking / effort.** Set per agent. For Sonnet 5: `thinking: {type:"disabled"}` or `output_config.effort: "low"` on dialogue-like calls; `"medium"` on builds. Haiku 4.5 runs without thinking unless asked (skill doc table). This fixes F5.

---

## 6. Token discipline

1. **Output caps per agent,** replacing the global 8000 (F5):
   - character: 300
   - classifier: 50
   - clarifier: 150
   - check: 120
   - recap: 400
   - director: 600
   - builder: 3,000

   Output costs 5× input on every Claude tier [verified-doc], so a verbose model is the fastest way to spend money.
2. **Structured outputs** (`output_config.format` with a JSON schema on Anthropic; `response_format` on OpenRouter, already used for JSON agents in `provider.js`). The character returns `{line, options[3-4], mood, conceptTag}`, which is shorter than prose, cannot be malformed, and removes `bad-json` guard retries (F4). Keep options to 4–8 words each; that also serves kids who "don't read walls of text".
3. **No transcripts.** Send only the last 4–6 turns (the current `sanitizeHistory` caps at 12 turns / 3,000 chars, `guards.js:29-43`, which is reasonable). At each quest end, a recap call writes 2–3 observations into the learner card and the turns are dropped. That is cheaper, *and* it is what the brief already requires: "Never: … stored chat transcripts" (`first-run.md` §6); COPPA data minimisation and retention (`child-privacy-brief.md`).
4. **Only the learner-card fields a request needs.** A character call needs about 150 tokens: nickname, reading level, 2 interest tags, current concept box levels for this quest's concepts. It does not need the whole card. Define `cardFor(agentKind)` projections in code. This is also better for privacy.
5. **Do not resend the whole game (F3):**
   - Send a **manifest** (file names, function names, CONFIG keys) of about 300 tokens, plus **only the files the router expects to change**. Map the intent to files with the coder's existing file table, e.g. movement → `player.js`.
   - Let `read_file` (already in `tools.js:213`) fetch the rest on demand.
   - Ask for **ops / search-replace diffs**, not whole-file `editFile` rewrites. `provider.js:72-77` notes a whole-file edit can be most of 4,000 output tokens; a targeted replace is typically 100–400.
   - Within one build loop, the kid's files sit behind the auto-cache tail, so tool rounds read them at 0.1×.
6. **Cut tool rounds.** A pre-assembled recipe in the quest bundle answers most "what's the API" lookups before the model asks. Lower `AI_TOOL_ROUNDS` from 4 to 2 for the builder once recipes exist, and measure (§10).
7. **Trim the static prompt itself.** `coder.md` is 13.3 KB (about 3.5–4.5k tokens). Once cached, its per-call cost is small, so do not strip the house-style explanations for cost. Trim only for *quality*, i.e. rules that no longer apply to a no-code, concepts-first course.

---

## 7. Caching responses across students

**Safe to reuse (key = hash of non-personal inputs only):** `sha256(kind | conceptId | characterId | readingLevel | interestTag? | variant# | contentVersion)`.
- Concept explanations, analogies and hints at a reading level: "what are particles?" at L2 is the same for every child.
- Character lines on authored nodes. These are already pre-generated, so this cache only matters for lines generated live *on demand* the first time (lazy pre-generation).
- Recipes, glossary answers, and canned replies to common free-text intents *after* intent classification. Cache the answer to the *intent*, never to the raw text.

**Storage:** reviewed items → committed files under `app/content/` (preferred: people see them). Lazily generated, unreviewed items → the existing Redis via `store.js` over `fetch`, no new dependency. Keep them in a separate namespace with a TTL so they can be purged per `contentVersion`. On serverless, a module-level `Map` is only a per-instance warm cache (cold starts wipe it, CLAUDE.md §6). Use it only as an L1 in front of Redis.

**Not safe (never cache across students):**
- Anything whose input contains **a child's free text**. It may include a name, school, location or feelings, and replaying it to another child would disclose personal information.
- Anything derived from **their game code** (their creative work, which may contain names).
- Recaps and learner-card observations.
- Any output that addresses the child personally.

Under COPPA, "personal information" includes names, contact details, persistent identifiers, photos/voice/video and geolocation, or information combined with those [knowledge; see the FTC FAQ cited in `docs/child-privacy-brief.md`]. A reading-level plus closed-list interest tag, unlinked to an identity, is not identifying. It is still minimal-data practice to keep the tag list closed and coarse.

**Also important:** Anthropic's *prompt* cache is per workspace and never cross-organisation [verified-doc via skill]. Shared prefixes should contain **no child data at all**, which the layout in §4.3 guarantees by construction.

**Hit rate [estimate]:** about 60 concepts × 3 levels × 4 tags gives a keyspace under 1,000 per content type. After the first class, most lookups hit. The main saving is **latency and consistency**; the dollar saving is modest because these calls are already cheap Haiku calls.

---

## 8. Batch API for offline generation [verified-doc]

- **50% off input and output**, and it **stacks** with prompt-cache multipliers.
  - Sonnet 5 batch: $1 / $5.
  - Opus 5: $2.50 / $12.50.
  - Haiku 4.5: $0.50 / $2.50.
- Limits:
  - Up to **100,000 requests or 256 MB** per batch.
  - Most batches finish **within 1 hour**, and they expire at 24 h (expired requests are not billed).
  - Results stay available for **29 days**.
- Use the **1-hour cache TTL** for shared context in batches, since processing can take longer than 5 minutes. `max_tokens: 0` pre-warming is not allowed inside batches. Cache hits in a concurrent batch are best-effort.
- Not available for fast mode or Managed Agents.
- **Fits this app:** generating quest packs, reading-level variants, hints and concept cards is exactly "nobody is waiting". Run it from a `app/tools/build-quest-packs.js` generator, following the repo's `build-*.js` convention. It runs on a laptop or in a GitHub Action, never in a Vercel function. Output lands as files for people to review.
- **One-off cost [estimate]:**
  - Assume 30 launch quests × 6 generation requests each (tree, options at 3 levels, hints, explanations, canned replies, check spec). Each request is about 10k in (mostly the cached bundle) and 6k out, on **Opus 5 batch**: 10k×$2.50 + 6k×$12.50 = **$0.10 per request**.
  - $0.60 per quest; ×3 review iterations = $1.80 per quest; ×30 = **about $54**.
  - Plus concept cards: 60 × 3 levels, about $0.03 each, so about $6.
  - **Under $100 for the whole launch library.** The real cost is people's review time, not tokens. Use the strongest model here, because quality is paid for once and served for free.

---

## 9. Cost model

**Prices [verified-doc, platform.claude.com/docs/en/about-claude/pricing, fetched 2026-09-25], per MTok:**

| Model | Input | Cache read | 5m write | Output |
|---|---:|---:|---:|---:|
| Sonnet 5 | $2 | $0.20 | $2.50 | $10 |
| Haiku 4.5 | $1 | $0.10 | $1.25 | $5 |
| Opus 5 | $5 | $0.50 | $6.25 | $25 |

Note: Claude 4.7 and later use a tokenizer that produces about 30% more tokens for the same text. Token counts below are *model tokens*; if you estimate from characters (÷4), add about 30% for Sonnet 5 and Opus 5.

**Shared assumptions [estimate]:**
- 1 kid-hour = 60 kid actions (35 option picks, 10 free text, 10 build requests, 5 menu/prize) + 6 system events (2 director, 3 checks, 1 recap).
- Class = 20 kids. Course = 10 one-hour sessions.
- Uncertainty ±50%. Re-baseline from telemetry after the first real session (§10).

### (a) Naive: every event is a big-model call with full context

Per call input: persona + rules + whole concept web 8k, full learner card 1.5k, full transcript averaging 8k (0 → 16k over the hour), whole game 6k, so **about 24k tokens**, no caching. Calls:
- 50 dialogue and free-text/menu turns × 1 call, 500 out each.
- 10 builds × 2.5 calls (tool rounds + retries), averaging 1,200 out.
- 6 system events, 500 out.

That is **81 calls**.
- Input: 81 × 24,000 = **1,944,000 tokens**.
- Output: 56 × 500 + 25 × 1,200 = 28,000 + 30,000 = **58,000 tokens**.

| | per kid-hour | class of 20 per hour | 10-week course (one class) |
|---|---:|---:|---:|
| Sonnet 5: 1.944×$2 + 0.058×$10 = $3.89 + $0.58 | **$4.47** | **$89** | **$894** |
| Opus 5: 1.944×$5 + 0.058×$25 = $9.72 + $1.45 | **$11.17** | **$223** | **$2,234** |

### (b) Efficient design (§§1–8)

39 of 60 actions are served with no LLM (§2). The remaining calls:

| Line | Calls/kid-hr | Tokens per call (cached / uncached in / out) | $ per call | $ per kid-hr |
|---|---:|---|---|---:|
| A. Live character dialogue, Haiku 4.5 | 14 | 5,000 / 1,200 / 150 | 5k×0.10 + 1.2k×1 + 150×5 = $0.00245 | 0.0343 |
| B. Free-text intent classifier, Haiku (below the 4,096 cache minimum, so uncached) | 10 | 0 / 1,500 / 30 | $0.00165 | 0.0165 |
| C. Builds, Sonnet 5, 7 requests × 1.5 calls | 10.5 | 7,000 / 4,000 / 1,000 | 7k×0.20 + 4k×2 + 1k×10 = $0.0194 | 0.2037 |
| D. Clarifier, Haiku | 2 | 5,000 / 1,200 / 150 | $0.00245 | 0.0049 |
| E. Judgement-check fallback, Haiku | 1 | 0 / 3,000 / 100 | $0.0035 | 0.0035 |
| F. Director phrasing / re-plan, Sonnet 5 | 2 | 5,000 / 2,000 / 500 | 5k×0.20 + 2k×2 + 0.5k×10 = $0.010 | 0.0200 |
| G. Quest recap → learner card, Haiku | 1 | 0 / 4,000 / 300 | $0.0055 | 0.0055 |
| H. Cache writes, class-wide | about 30 writes per class-hour × about 12k µ$ = $0.36, ÷20 kids | | | 0.0180 |
| I. Snowflake pass: personalise the next quest's key lines when it is planned, Haiku (§11.1) | 2 | 5,000 / 1,500 / 800 | 5k×0.10 + 1.5k×1 + 0.8k×5 = $0.0060 | 0.0120 |
| J. Snowflake pass: runtime polish of rejoin/callback lines, Haiku (§11.1) | 6 | 4,500 / 400 / 60 | 4.5k×0.10 + 0.4k×1 + 60×5 = $0.00115 | 0.0069 |
| **Total** | **about 48 calls** | | | **$0.325** |

| | per kid-hour | class of 20 per hour | 10-week course (one class) |
|---|---:|---:|---:|
| **Efficient, with snowflake personalisation** | **$0.33** | **$6.50** | **$65** |
| Same + Haiku on 4 of 7 builds (if the eval holds): Haiku build call = 7k×0.10 + 4k×1 + 1k×5 = $0.0097; C becomes 6×$0.0097 + 4.5×$0.0194 = $0.145 | **$0.27** | **$5.4** | **$54** |
| One-off: launch library via Batch (§8), with 4–8 variants per node for the snowflake pools (§11.1) instead of 1 | | | about $250–400 total, amortised over every class |
| Recurring: weekly pool-growth batch (§11.2): about 2,000 candidates × (1k in / 200 out) on Haiku batch = $2, plus Sonnet batch clustering about $3 | | | about $5 per week across *all* classes |

The snowflake layer (lines I and J, plus bigger variant pools) adds about **$0.02 per kid-hour (about 6%)**. It is the cheapest line on the bill relative to what it buys.

**Ratios:** efficient (with the snowflake layer) vs naive Sonnet is about **14×** cheaper; vs naive Opus about **34×**. For a sense of scale, the repo's earlier estimate for the *old* app was $8.50 per class-hour (25 students, code turns only). The efficient new design costs less than that while making about twice as many AI-mediated moments.

**Where the remaining money goes:** builds are about 66% of (b). So the next levers are builder-specific: the knob share, diff output, fewer tool rounds, and Haiku for simple builds. Dialogue is already about 11%.

**Sensitivity:**
- If pre-generation serves only 50% (not 65%), A and B grow by about 50%: +$0.025 per kid-hour.
- If the builder averages 2.5 calls instead of 1.5: +$0.136 per kid-hour.
- If output tokens double across the board: +$0.12 per kid-hour.
- Every case stays **under about $0.60 per kid-hour (about $12 per class-hour)**.

---

## 10. Measuring it

**Fix `usage.js` first (F6):**
- Record `input`, `cache_write` (5m and 1h separately, from `usage.cache_creation`), `cache_read` and `output` as separate numbers. Price each at its own rate.
- Correct the Haiku price and ID: `claude-haiku-4-5` at $1/$5 [verified-doc]. Add cache-rate columns to `PRICES`.
- Add to each `tel.record('model', …)`: `classId`, hashed `who` (the same hashing `store.js` uses for keys), `questId`, `callKind` (dialogue / classify / build / check / director / recap), `tier`, `toolRound`, `latencyMs`.
- Parse OpenRouter's cached-token field too.

**Per-turn source tag.** Every child-facing turn logs `source: pregen | deterministic | cache | live`. This is the single most useful efficiency metric, because it shows directly whether §2's 65% holds.

**Dashboard numbers per session, via `tools/session-report.js`, which already aggregates telemetry:**
- $ per kid-hour and $ per class-hour, split by `callKind`.
- Share of turns served without an LLM (target 60% or more).
- Cache hit ratio = `cache_read / (input + cache_write + cache_read)` on static-prefix agents (target 85% or more). If it drops, a silent invalidator slipped in. Anthropic's cache-diagnostics beta can pinpoint it.
- Calls per build request (target 1.6 or fewer), guard retry rate, escalation rate.
- p50/p95 latency by `callKind` (the kid experience; dialogue p95 under about 2 s).
- Output tokens per call by kind (catches verbosity drift).

**Budgets and alerts** (serverless-safe, no background work):
- A per-class daily spend counter in Redis. `store.bump` does INCR+EXPIRE today; add an `INCRBY` variant counting **micro-dollars** (integers). Update it synchronously inside the request after each model call, the same way the rate limiter already is.
- **Soft limit** (e.g. $10 per class-hour, about 1.6× the estimate): log `budget:soft` and switch builds to the cheaper tier and dialogue to pregen-only. Then the kid gets slightly less personalised lines, **not** an error.
- **Hard limit** (e.g. $25 per class per day): builds pause with a friendly line, and a teacher-visible banner appears. Dialogue on pre-generated trees keeps working, so the course never stops dead mid-class.
- **Replace the per-student request limit** (`routes/ai.js:72`, 40 requests / 10 min) with a **token or cost bucket**. That is fairer than counting a 1-call dialogue turn the same as a 3-call build, and it closes the gap where one request is up to 10 calls.
- **Ground truth:** reconcile weekly against the Anthropic Console or the Usage & Cost Admin API (raw HTTP, admin key) [skill doc]. `usage.js`'s own header already says the provider dashboard is the authority. Use a **separate workspace or API key for this app**, so reports are not blended with other League traffic. Keep all classes in *one* workspace so they share prompt-cache entries.
- **Provider-side cap:** set a monthly spend limit on the Anthropic workspace (and an OpenRouter key credit limit) as the backstop that works even if the app's counters fail open, which `store.js` deliberately does.

---

## 11. Snowflake, not script: keeping every kid's run original while staying cheap

Product owner requirement (Jay): efficiency must not make the course feel canned. Runs may resemble each other and may reuse pooled material, but no kid should feel they are watching the same script replayed. That matters in the room too: 20 kids sit at adjacent Chromebooks and *will* compare screens.

The design principle: **pool the parts that are expensive and must be correct (concept explanations, check logic, branch structure), and personalise the surface (wording, references, callbacks, order, flavour) cheaply.** The pool is a skeleton, not a script.

### 11.1 Personalising pooled content cheaply at runtime

Four layers, cheapest first. Each layer is optional per line, so the budget controls how far down it goes.

1. **Slot filling (deterministic, free).** Pooled lines are templates with typed slots, filled from the learner card and live game state:
   - `{hero}`, `{gameName}`, `{lastBuilt}` (e.g. "double jump")
   - `{pastChoice}` ("you picked *sneak round the back* on day one")
   - `{favGameAnalogy}` (from a closed interest-tag list: "like the coins in Mario")
   - `{npcCallback}` (a line another character said to *this* kid)

   Slot sources are the card projection (§6.4) and game state the checker already reads.
2. **Variant pools with learner-card selection (deterministic, free).**
   - Each node stores 4–8 variants per reading level, tagged (tone, interest tag, pace, `firstTime` vs `revisit`).
   - Selection is a pure function: filter by card (reading level, interest, try-first vs watch-first), then choose with a seeded pick, `hash(kidIdHash, nodeId, visitCount)`.
   - Two rules: **never the same variant twice for one kid**, and **rotate across the class**, so kids at the same node in the same session get different variants where the pool allows.
3. **Recombination (deterministic, free).** Build a line from separate pools: opener × concept beat × callback × closer. With 5 of each, that is 625 surfaces per node. Options (the 3–4 choices) come from an option pool the same way, but the *branch each option leads to* stays fixed, so the checker and the tree logic never change.
4. **A small personalisation pass (cheap LLM).** Two forms, both on Haiku 4.5 with a cached style-and-examples prefix of 4,096 tokens or more:
   - **Personalise-on-plan (line I in §9).** At quest end the director already runs (course-engine.md, serverless note). In the same request, one Haiku call rewrites the next quest's 8–12 key lines (arrival, concept reveal, rejoin, celebration). Inputs: the selected skeleton variants, about 150 tokens of card projection, and 3–5 game facts. The results are stored on the kid's quest state.
     - Cost: about $0.006 per quest.
     - Latency is **zero at turn time**, because it is prefetched while the kid is celebrating the last quest.
   - **Runtime polish (line J).** Only for lines that depend on what just happened (rejoining after an off-tree detour, reacting to a build). Output capped at about 60 tokens, about $0.001 per line.
   - **Guarded, "reject, never repair":** a deterministic check that the polished line keeps the node's concept keywords, stays under the length cap and readability level for the kid's reading level, and adds no new claims (no new concept IDs, numbers or API names). On failure, the app shows the slot-filled skeleton. The kid never sees an error and the content stays correct.

**Share of turns and cost.** The 65% "no live call at turn time" figure (§2) still holds: layers 1–3 are free, and layer 4 is mostly prefetched. The snowflake layer adds about $0.02 per kid-hour (§9, lines I and J).

### 11.2 How the pool grows and improves, privacy-safe

A promotion pipeline in which people keep ownership of content (CLAUDE.md: `app/content/` is authored; ask first):

1. **Capture candidates.** Keep live character lines, answers to recognised free-text intents, and explanations the kid engaged with. Tag each one: `conceptId | level | characterId | nodeId or intentId | context tags (interest, genre, mood, firstTime/revisit) | contentVersion`.
2. **De-personalise at capture, deterministically.** The server knows exactly which card values and game names it injected, so it reverse-substitutes them back into slots (`"Zapfrog"` → `{hero}`).
   - Then run a PII screen: regex for names from the card, numbers, places, school-like words.
   - Drop any candidate whose text quotes or paraphrases the kid's own free text, and anything generated from their game code beyond slot facts.
   - Candidates from the build path are never captured. A kid's game is theirs.
3. **Stage with a short retention period.** Candidates go to Redis under a separate `pool-cand:` namespace with a TTL (e.g. 14 days), keyed by tag hash only, with no kid identifier stored alongside. What is not promoted expires, which satisfies the written-retention-policy point in `docs/child-privacy-brief.md`.
4. **Score by aggregate signal, never per-kid.** Useful signals: the kid picked an option quickly, didn't hit "I'm bored"/skip, completed the quest, didn't re-ask the same thing. Require a candidate pattern to appear across several separate sessions before it counts, so no single child's quirk becomes pool content.
5. **Weekly batch curation (§8 prices, about $5 per week).**
   - A batch run (Haiku to screen, Sonnet to cluster) deduplicates near-identical candidates, checks them against the concept card for correctness, and proposes promotions, plus *retirements*: over-used or low-engagement variants.
   - Output is a reviewable diff to `app/content/pool/*.yaml`. **A person approves the PR.** Nothing goes into the pool unreviewed.
6. **Version.** `contentVersion` bumps on promotion. Cross-student caches (§7) key on it, so stale variants drop out automatically.

The pool improves with every cohort. Each class makes the next class's runs *more* varied (more variants per node), not more uniform.

### 11.3 Where live generation is worth paying for (originality matters most)

Spend the live budget where no pool can compete:

- **The kid's own game.** Building, and commentary about it: "your frog double-jumps now — what if the floor was lava?" This is already the biggest line (C), and it stays live and personal.
- **Reflect-backs.** First-run discovery ("So, like Mario?" in `first-run.md` §3), and whenever a character mirrors back what the kid said or made. Being *heard* is the core of the snowflake feeling.
- **Genuinely novel free text** that no intent matches. That is line A, and it is still live.
- **Surprises.** A character reacting to something odd in their game, a planted callback paying off ("remember when you made the enemies tiny?"), and first-time celebrations. The director can *schedule* 1–2 surprise beats per quest and the LLM writes them.
- **The recap that names what *they* did** (line G), and brainstorming their game idea.

Budget rule of thumb: about 15–20 "spotlight" live moments per kid-hour (lines A, D, G, I, J together), costing about $0.06. That is roughly 20% of the bill buying most of the felt originality. Building costs the rest.

### 11.4 Measuring same-y-ness, so it can be tuned

Compute on **line IDs, variant IDs and pooled or skeleton text**, not on kids' free text. It runs as a no-dependency `app/tools/report-sameness.js` over the session capture, in the style of `session-report.js`.

- **Per-kid repeat rate:** share of character lines a kid has already seen (same variant ID, or near-duplicate text). Target about 0 exact repeats, and under 5% near-duplicates across a course.
- **Cross-kid overlap per node per session:** mean pairwise Jaccard similarity of word 4-grams between the lines different kids saw at the same node. Target e.g. under 0.3. Watch the "neighbour" case: kids in the same session at the same node within 10 minutes of each other.
- **distinct-n** (unique n-grams ÷ total n-grams) over all character lines per quest per class. A falling distinct-2 or distinct-3 across weeks means the pool is collapsing onto favourites.
- **Variant entropy per node:** Shannon entropy of variant-selection counts. Low entropy means one variant dominates: add variants or fix the selector.
- **Personalisation rate:** share of turns carrying at least one kid-specific reference (slot filled from their game, hero or a past choice), and share passing through layer 4. Target 50% or more of key beats.
- **Experience proxies:** "I'm bored"/skip rate and time-to-pick an option per node, compared between high-overlap and low-overlap nodes. Plus the teacher's observation of kids saying "mine says the same as yours".
- **Tuning knobs, in cost order:**
  1. More variants per node (one-off batch cost).
  2. More recombination pools (free).
  3. Stronger class rotation (free).
  4. A higher personalise-on-plan share (about $0.006 per quest).
  5. More runtime polish (about $0.001 per line).
  6. More live spotlight moments (about $0.0025 each).

---

## Ranked: the 10 highest-impact efficiency decisions (updated for the snowflake requirement)

1. **Make the course's spine deterministic.** Rule-based director scoring over the concept web, event-rule learner-card updates, prize tables, menus, and declarative completion checks run against the live game. The LLM writes words and code only. *Removes the most expensive and least necessary calls, and makes the course testable and fair.*
2. **Pooled content as variant pools with slots, recombination and personalise-on-plan (§2 + §11.1).** People-reviewed skeletons at 2–3 reading levels, selected by learner card, never repeated for one kid, rotated across the class. One cheap Haiku pass personalises the next quest while the director plans it. *About 65% of turns with no live call at turn time and instant replies, while every run still reads as that kid's own, for about $0.02 per kid-hour.*
3. **Restructure every prompt as static prefix → quest bundle → per-kid tail, and turn on `cache_control`.** Fix F1, F2 and F7; add a sticky `session_id` on OpenRouter. *65% off each live Haiku call and about 40% off each Sonnet build call.*
4. **Tier models by job.** Haiku 4.5 for dialogue, classification, clarification, checks, recaps and personalisation; Sonnet 5 for builds and the director; escalate rarely; Ollama for dev and fallback only. *2–5× cheaper per call where it's safe, and faster for kids.*
5. **Stop resending the whole game.** Send a manifest plus the relevant files, use `read_file` on demand, get diff/replace ops out, and add a knob system for CONFIG tweaks. *Builds are about two-thirds of the efficient bill; this is the lever on them.*
6. **Set per-agent output caps, thinking/effort and structured JSON outputs.** Fixes F5 and removes `bad-json` retries. *Output is 5× input price; unrequested thinking on Sonnet 5 is invisible spend.*
7. **Spend live generation deliberately on spotlight moments (§11.3):** the kid's game, reflect-backs, surprises, the personal recap. Serve everything else from the pool. *Roughly 20% of the bill buys most of the felt originality.*
8. **Summaries into the learner card instead of transcripts, and only the fields each agent needs.** *Flat per-turn input instead of input that grows through the hour; the brief's COPPA rule; and the card is exactly what the personalisation layers read.*
9. **Build the context library, and a privacy-safe pool-growth loop.** Concept cards, character sheets, recipes and per-quest bundles, retrieved by ID or tag with the `tools.js` pattern; no vector DB, no live web. Good live lines are de-personalised to slots at capture, staged with a TTL, curated weekly in a Batch run (50% off, stacks with caching), and promoted only by a person's PR (§3, §8, §11.2). *Small, correct, cacheable context, and a pool that gets more varied with every cohort for about $5 per week.*
10. **Instrument before optimising further.** Fix `usage.js` (cache fields, prices, class/quest/kind attribution), log turn source, add the same-y-ness metrics (§11.4), and add per-class micro-dollar budgets that degrade gracefully instead of stopping. *Without this, neither the cost numbers nor the "snowflake" claim can be confirmed or tuned.*

Cross-student response caching (§7) is worth doing for latency and consistency, keyed only on non-personal inputs plus `contentVersion`. It ranks below these ten on dollars.

## Sources

- Anthropic pricing, including cache multipliers, batch prices and tokenizer note [verified-doc]: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic Message Batches (limits, 24 h, 29 days, 1h cache tip) [verified-doc]: https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Anthropic prompt caching (minimums, TTL semantics, workspace isolation). Via the claude-api skill's cached copy of the official page; live page: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- OpenRouter prompt caching guide [verified-snippet]: https://openrouter.ai/docs/guides/best-practices/prompt-caching
- OpenRouter blog, "Prompt Caching: What Cached Tokens Cost" (sticky routing, read multipliers) [verified-snippet]: https://openrouter.ai/blog/tutorials/prompt-caching-sticky-routing/
- Repo: `docs/ai-system-brief.md:177-199` (OpenRouter prices, 11 Aug 2026; old-app estimate), `docs/child-privacy-brief.md`, `docs/rework/briefs/first-run.md` §6.
