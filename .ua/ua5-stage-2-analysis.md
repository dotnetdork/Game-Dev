# UA5 — Stage 2 Analysis

The Stage 2 deliverable. Pulls together what exists in the space, who has a stake in the system beyond the users, who actually uses it, and what users are doing today when they need what the system would provide.

The positioning statement (`ua2`) is revisited throughout. Stage 2 is the second pressure test on it. Contradictions get surfaced and, if accepted, folded back into `ua2`.

> Status: Section 1 (Landscape) approved by Jay 2026-07-28. Sections 2 & 3 drafted 2026-07-28 for review. (Product name still open from Stage 1 — tracked, not blocking.)
>
> **Course-shape facts confirmed by Jay (from the 2026-07-28 meeting + follow-up):** the course is a **single guided game built all the way through**, unlocking assets as you go. Challenges have students **modify an existing game's code to do something new, or find and fix a bug**, run as an **instance inside the lesson itself**. Students answer **AI-generated quick questions** (Parsons and other types, drawn from what they just read) and **brief quizzes**. **Different AI agents** handle different jobs (tutor, grader, coder, …). UI relabel: **"Showcase" → "Gallery"** (student games); the **old "Gallery" → the asset store** (name TBD).

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
- **Bitsy, PuzzleScript, Twine** (open) — tiny constrained game makers; inspiration for minigame/instanced-challenge formats and "make something in minutes."
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

- Projects the kid keeps + visible XP/progress + a parent-visible showcase (now "Gallery") — **keep**.
- Instructor-led, taught in class — **keep** (teachers explain beyond the AI).
- Game-engine UX (viewport + code + play, scenes, sprites, assets, run button) — **keep** (already built).
- Chat-to-edit AI assistant — **keep**, but the "AI instantly does everything" convention — **break on purpose** (deliberately limit/impoverish the AI at challenges; keep the change visible/reviewable).
- Block-based coding (Scratch/Tynker norm) — **break on purpose** (we use real JS text) while keeping their fast-first-success ethic.
- itch.io-style "play + view code + shareable page" for the showcase — **keep** (this becomes the "Gallery").
- "Spend in-game currency to unlock games" convention — **broke it** (stars buy *assets*, not games; the store is the relabeled old "Gallery").
- Auto-graded quizzes as separate testing screens — **break on purpose** (questions/quizzes are short, AI-generated, and embedded in the lesson right after the relevant reading).
- Remix/community conventions (kids may expect to remix others' games, Scratch-style) — **open**.

---

## Stakeholders and users

### Stakeholders

| Stakeholder | Stake | Their version of "success" |
|---|---|---|
| The League (Jed, Eric) — client/sponsor | A sellable, shippable course matching their pedagogy + hardware constraints | Kids hooked; reading/architecting code + directing an AI; a finished shareable game; runs on managed Chromebooks at scale; feeds the Level-2 pipeline |
| Instructors / teachers | Deliver it to ~20 kids at once without chaos; help beyond the AI | Low-setup, easy to teach, kids progress in order, they can explain the code a challenge points to |
| Parents | Safety + a real skill + something to show | Kid engaged and safe; visible learning; a game they can show family |
| Platform / legal layer (COPPA, League-org GitHub, code server, hosting) | No legal exposure; no per-kid GitHub accounts; low maintenance | Compliant, no database to manage, pseudonymous-by-default showcase |
| Model providers (Ollama / OpenRouter / Anthropic) | Cost, rate limits, key safety | Affordable, reliable, keys stay server-side |

**Client vs. users (client path):**
- **Client:** The League (Jed, Eric) — a stakeholder, not a user.
- **Users the client serves:** students ~10–15 in camps / classes / schools.
- **Where interests align:** both want kids hooked, actually learning, and ending with a finished game.
- **Where they diverge (friction):** the League wants code-reading/architecture rigor (Eric) and sellability; kids want instant fun and results — managed by the fun-first hook + the deliberately-limited AI. Teachers want a calm room; the AI-direct model must not leave 20 kids stuck — hence the tutor agent + in-order unlocking.

### Users (recap from Stage 1, with Stage 2 updates)

- **Primary user type:** students ~10–15 on school-managed Chromebooks; mixed/short attention spans; motivated by making and showing a game; **most cannot self-start a game** (Jed).
- **Secondary user types:** instructors (in-class facilitators) and parents (viewers of the finished game).
- **Added/revised since Stage 1:** confirmed **guided single-game throughline** (not free build); **fun-first** entry; **two identity lanes** (own GitHub vs. League code server); challenges are **in-lesson, instanced** code edits / bug hunts; **AI-generated** quick questions + brief quizzes; **multi-agent** delivery.

### Compliance and accessibility considerations

- **COPPA / PII** — Users include under-13s, so COPPA applies. Researched in `../docs/child-privacy-brief.md`: pseudonymous showcase by default, parental opt-in for first name + last initial, no per-student accounts, server-side AI (no student PII to model providers), per-game private toggle, teacher takedown. **The League's staff own all consent collection and authorization.**
- **School / FERPA** — In school/class settings, student data falls under the school-authorization path for educational use only, no commercial use; public display still needs parental consent.
- **Accessibility / WCAG** — The studio UI (code editor, viewport, panels) should meet basic keyboard-operability, color-contrast, and readable-font needs for ages 10–15. Open to audit: CodeMirror keyboard/screen-reader behavior, contrast of the dark theme, and motion in the games. Flagged, not yet done.

---

## Jobs-to-be-done and scenarios

### Job 1 — Get hooked fast

- **JTBD:** When I'm a kid who just got handed a coding class, I want to immediately play something fun, so I can feel this is worth my time.
- **How we know it's real:** Eric's explicit fun-first ("Robot Riot") ethic; Jay's nephew, previously uninterested, reacted to the prototype with "can I play? this is fire"; early-ownership research on the first-sessions dropout window.
- **What people do today:** block tools / CodeCombat open with setup or instruction; kids disengage before they make anything.
- **Why it persists:** play-first platforms (Roblox) win attention precisely because the fun is immediate.

#### Scenario 1.1 — First five minutes
> A student opens the studio and plays the demo game right away. They want it faster, so they open the code and change a number — but pick the wrong one and the screen goes black. **Something goes wrong:** no game, no obvious error. They check the console/log panel, and the tutor agent points them at the line they broke. They undo/fix it, hit Run, and it works — now they're curious. **Need met:** hooked, and already reading code.

**Reads back against `ua2`:** delivers the fun-first + start-to-understand benefit — yes.

### Job 2 — Build a real game without having to invent one

- **JTBD:** When I don't know what game to make, I want the course to walk me through building one specific game, so I end up with something real instead of freezing on a blank canvas.
- **How we know it's real:** Jed, from experience — "80% don't know what to make; the other 20% spend all their time on a sprite… just walk them through making games." This is why the course is a single guided throughline.
- **What people do today:** "make your own game" courses stall; kids ask the instructor what to build.
- **Why it persists:** open-ended feels creative and flexible — it just fails at classroom scale.

#### Scenario 2.1 — Adding an enemy
> Progressing module to module on the one game, the student reaches a challenge to add an enemy. They tell the coder agent "make it more fun" — too vague, so the agent makes a weak change (or asks them to be specific). **Something goes wrong:** the result isn't what they pictured. They read the existing enemy code, decide what they actually want ("an enemy that falls faster than the others"), and say that precisely. The AI makes it; an asset unlocks. **Need met:** a real addition they directed and understood.

**Reads back against `ua2`:** delivers "direct an AI + understand the code" — yes.

### Job 3 — Change the game and prove I understood it (in-lesson challenge)

- **JTBD:** When I'm learning a concept, I want to modify or fix a small piece of a real game right here in the lesson, so I can prove I understand it — not just read about it.
- **How we know it's real:** Jed — a challenge is "modify one or two lines… create a variable called speed, put it in this method"; Eric — students should read, trace, and debug, then direct the AI; the "start from a broken example and fix it" idea.
- **What people do today:** quizzes test recall, or the AI just does the task and the kid learns nothing.
- **Why it persists:** recall quizzes are trivial to grade; they just don't prove code understanding.
- **Mechanics:** each lesson embeds an **instance** of a small game; challenge types are "modify this code so it does X" or "find and fix the bug"; a **grader/checker agent** verifies the student actually achieved it before awarding points and unlocking the next lesson; the AI may be in `guided` or `off` mode for these.

#### Scenario 3.1 — Make the stars fall
> The lesson embeds a game where the stars don't fall. Challenge: make them fall. The student edits the code and hits submit. **Something goes wrong:** the checker agent runs it and the stars still don't move — they set the wrong property. The checker returns a targeted hint (not the answer). They try again, the stars fall, the check passes, points land, and the next lesson unlocks. **Need met:** proven understanding, not a guess.

**Reads back against `ua2`:** delivers read/understand/fix — yes.

### Job 4 — Check I understood what I just read (quick questions + quizzes)

- **JTBD:** When I've just read or played a concept, I want a couple of quick questions right there, so I (and the teacher) know it stuck.
- **How we know it's real:** Jay — "a little quiz here and there," AI-generated from what they just read, a mixture of types (Parsons, etc.); scoped tutor checkpoints in the lesson.
- **What people do today:** one big end-of-unit test, or no checks at all, so teachers can't tell who's lost.
- **Why it persists:** end tests are standard and easy to administer — they're just too sparse and too late.
- **Mechanics:** a **quiz agent** generates questions scoped to the specific lesson content; mixed types (Parsons = reorder scrambled code lines, multiple-choice, fill-in); a **grader agent** scores and explains; short and low-stakes.

#### Scenario 4.1 — A Parsons check
> After a short reading, a Parsons question asks the student to put scrambled code lines in the right order. **Something goes wrong:** they order two lines backwards. The grader agent marks it and shows which line is out of place with a one-line why. They reorder it correctly and move on. **Need met:** a fast, low-stakes confirmation that it clicked.

**Reads back against `ua2`:** supports the "understand it" benefit — yes.

### Job 5 — Keep the finished game and show it off

- **JTBD:** When I've built my game, I want to keep it and show my family, so I feel proud and can come back to it.
- **How we know it's real:** Jed — kids need to "take the games home," an itch.io-style showcase with play + view-code, "their parents can see it."
- **What people do today:** PyGame output is hard to share; Roblox is locked to the platform/account; class work is often lost afterward.
- **Why it persists:** nothing good exists for a portable kid game artifact on a Chromebook without accounts — which is the whole reason for the code server.
- **Mechanics:** two identity lanes — own GitHub → the student's repo; no GitHub → the League code server creates a repo under the League org tied to a username. The student-games showcase is the relabeled **"Gallery"**; pseudonymous by default; per-game private toggle; teacher takedown.

#### Scenario 5.1 — Publishing without a GitHub account
> The student finishes and hits Publish. They have no GitHub account, so the code server makes a repo under the League org tied to their username, and the game appears in the Gallery under their handle. **Something goes wrong:** at home they've forgotten their username/token and can't get back in. Through the teacher/League recovery path they retrieve it and open their game again. **Need met:** the game is kept, shareable, and recoverable.

**Reads back against `ua2`:** delivers the shareable-finished-game benefit — yes.

---

## Open from this stage

Flagged during Stage 2; revisit or carry into Stage 3.

- **UI relabel (Stage 3 spec item):** rename **Showcase → "Gallery"** (student games); rename the **old "Gallery" → the asset store** — store name TBD (e.g., Store / Shop / Market / Workshop / Armory / Supply). Not yet applied in the app.
- **Positioning check — AI coding tools** (parked, Jay's call): consider naming adult AI-coding tools (Replit/Cursor/Bolt.new) as an adjacent alternative in `ua2`, with our edge = age-appropriate + deliberately limited + guided.
- **Positioning check — no-code kid engines** (parked): sharpen `ua2` differentiation vs. GDevelop/Buildbox/Flowlab — they hide code; we teach reading/architecting it.
- **Accessibility audit** — CodeMirror keyboard/screen-reader support, dark-theme contrast, game motion (WCAG) not yet checked.
- **Remix/community** — decide whether kids can remix each other's Gallery games (Scratch-style).
- **Product name** — still open (course + store + confirmed "Gallery" for student games).
