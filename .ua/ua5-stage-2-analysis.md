# UA5 — Stage 2 Analysis

The Stage 2 deliverable. Pulls together what exists in the space, who has a stake in the system beyond the users, who actually uses it, and what users are doing today when they need what the system would provide.

The positioning statement (`ua2`) is revisited throughout. Stage 2 is the second pressure test on it. Contradictions get surfaced and, if accepted, folded back into `ua2`.

> Status: **Section 1 (Landscape) drafted 2026-07-28** for Jay to accept/sharpen/overrule. Sections 2 and 3 are next. (Product name still open from Stage 1 — tracked, not blocking this work.)

---

## Landscape

A short survey of the space the system enters.

### Adjacent products

- **Block-based platforms — Scratch, MakeCode, Tynker, Bloxels.** Do well: dead-simple, Chromebook-friendly, huge libraries/communities; kids move in minutes. Complaints: low ceiling, "not real code," the result doesn't feel like a *real* shareable game, and there's no clean path to text code. Overlap: our beginner audience + browser + fun-first. Gap they leave: no real code to read, no architecture, output isn't a "real game."
- **Coding-game sites — CodeCombat, CodeMonkey.** Do well: teach real syntax through play, auto-graded, teacher dashboards. Complaints: you learn syntax but don't build a game you own or keep; on-rails and walled. Gap: no artifact to show a parent; you're solving levels, not making a game.
- **Kid / no-code game engines — GDevelop, Construct 3, Buildbox, Flowlab, Gamefroot, Struckd, Kodu, Coda Game, Pocket Code.** Do well: make a real, playable, often shareable game with little/no code; several run in-browser (GDevelop, Flowlab, Gamefroot). Complaints: visual event-sheets / drag-drop don't transfer to real programming; some need installs or paid tiers (Construct 3). Gap: they *hide* the code — the opposite of the read/understand/architect ethic — and none teach directing an AI.
- **Pro engines — Unity, Godot, Unreal.** Do well: industry-standard, powerful, "real." Complaints: heavy, installs/VMs, steep, won't run on managed Chromebooks at cohort scale. Relationship: this is the aspiration and the planned **Level 2** in-person course; ruled out for Level 1 by the exact hardware constraint that created this project.
- **Attention competitors — Roblox Studio, Minecraft Education/Redstone.** Do well: kids already love them; huge creation communities; "make a game your friends play." Complaints: platform-locked (Roblox Lua), account/age gates, moderation/safety, not portable or transferable. Gap: locked ecosystems, no portable web artifact, not general programming — but they own the "make a game to show friends" motivation, so marketing must speak to families who think "Roblox class."
- **AI coding tools (emerging adjacent) — Replit + Agent, Cursor, GitHub Copilot, Bolt.new.** Do well: AI writes/edits code from natural language — increasingly how software is actually built. Complaints: built for adult devs, not scaffolded for kids, can do *too much* (the learner learns nothing), no curriculum or guardrails, cost. Overlap: this is the exact core of our pedagogy (direct an AI to build). White space: none is an age-appropriate, guided, *read-and-direct* course with a **deliberately limited** AI — that gap is our differentiation.
- **The League's own — Python Apprentice, Robot Riot / Robot Garage, League Labs.** Python Apprentice is the internal status-quo alternative (its output is hard to share). Robot Riot supplies the fun-first ethic and sibling brand voice. This course is the new browser game-dev offering in that family.

### Open-source candidates

- **Phaser** (MIT) — the chosen game library; browser JS, big ecosystem/docs; already in use. Sets the conventions for how a 2D web game is structured.
- **Kaboom / Kaplay** (MIT) — beginner-friendly JS game lib; inspiration/fallback for a gentler API.
- **Bitsy, PuzzleScript, Twine** (open) — tiny constrained game makers; inspiration for minigame formats and "make something in minutes."
- **Scratch** (open source) — study its onboarding and the conventions kids arrive expecting (sprites, costumes, a green-flag "run").
- **GDevelop, microStudio** (open) — browser engine/IDE cousins; study their asset, export, and share flows and editor UX (learn from, not fork).
- **CodeMirror / Monaco** (open) — code editors; already using CodeMirror; inherit editor conventions.
- **code-server, Gitea / Forgejo** (MIT) — relevant to the League-org git lane; candidates to interoperate with / learn from, pending Eric's confirmation of what the League actually runs.

### Category

- **The category customers think they're shopping in:** "coding class / game-design class for kids" — and, increasingly, "AI for kids."
- **What that category brings with it:** price expectations (per-course / camp / subscription), feature expectations (projects the kid keeps, visible progress, something to show a parent, a safe/moderated space), usage patterns (instructor-led weekly class or camp), and the parent's underlying question — "will this give my kid a real skill?"
- **Fit vs misfit:** good fit as a "game-design class for kids" with a differentiated twist (real code you *read* + an AI you *direct*). Misfit risk: some families specifically want "Roblox/Minecraft class," so marketing has to translate our value into that expectation.

### Inherited conventions

Keep / break-on-purpose / open:

- Projects the kid keeps + visible XP/progress + a parent-visible showcase — **keep**.
- Instructor-led, taught in class — **keep** (teachers explain beyond the AI).
- Game-engine UX (viewport + code + play, scenes, sprites, assets, run button) — **keep** (already built).
- Chat-to-edit AI assistant — **keep**, but the "AI instantly does everything" convention — **break on purpose** (deliberately limit/impoverish the AI at challenges; keep the change visible/reviewable).
- Block-based coding (Scratch/Tynker norm) — **break on purpose** (we use real JS text) while keeping their fast-first-success ethic.
- itch.io-style "play + view code + shareable page" for the showcase — **keep**.
- "Spend in-game currency to unlock games" convention — **broke it** (stars buy *assets*, not games).
- Remix/community conventions (kids may expect to remix others' games, Scratch-style) — **open**.
- Scratch-style green-flag onboarding metaphors — **open**.

---

## Stakeholders and users

> To draft next. Seeds: **client/stakeholder** = The League (Jed, Eric) + instructors + parents + the platform/legal layer (COPPA, the League-org GitHub, the code server); **users** = students ~10–15. Compliance already partly surfaced in `../docs/child-privacy-brief.md` (COPPA, pseudonymous showcase, teacher takedown). Will be surfaced in conversation, not as a checklist.

### Stakeholders

_(to draft)_

### Users (recap from Stage 1, with Stage 2 updates)

_(to draft)_

### Compliance and accessibility considerations

_(to draft — COPPA/PII already researched in docs/child-privacy-brief.md; still to surface: accessibility/WCAG for the studio UI, and school/FERPA context when used in class)_

---

## Jobs-to-be-done and scenarios

> To draft next. Candidate jobs from Stage 1 + the meetings: (1) "get a kid hooked fast" (fun-first play → want to build), (2) "help a kid who doesn't know what to make" (guided build, not blank canvas), (3) "let a kid change the game and understand what changed" (read/direct code), (4) "take the finished game home / show a parent" (save + showcase across the two identity lanes). Each needs evidence, current-alternative, why-it-persists, and a scenario with a things-go-wrong branch.

_(to draft)_

---

## Open from this stage

Flagged during Stage 2; revisit or carry into Stage 3.

- **Positioning check — AI coding tools.** The landscape surfaced adult AI coding tools (Replit/Cursor/Bolt.new) as an adjacent category `ua2` doesn't name. Our "direct an AI" differentiation sits right next to them; consider adding to `ua2` that the differentiator vs. those is *age-appropriate + deliberately limited + guided*. (Possible `ua2` revision.)
- **Positioning check — no-code kid engines.** GDevelop/Buildbox/Flowlab are a stronger "make a real game on a Chromebook" alternative than `ua2` emphasizes; our edge vs. them is that they *hide* the code while we teach reading/architecting it. (Possible `ua2` refinement of the differentiation clause.)
- **Remix/community conventions** — decide whether kids can remix each other's showcased games (Scratch-style) or not.
- **Product name** — still open from Stage 1 (course + showcase-site name).
