# UA1 — Opportunity Notes

Maintained by the agent during opportunity discovery. Jay does the observing and the talking; the agent writes it down.

The point of this document is to surface a candidate opportunity — a real piece of friction, grounded in observation and conversation, that can be taken into Stage 1.

> **Honesty note (read this first).** This is a *client-path* project: The League of Amazing Programmers is the client, and Jay is the intern / project lead. We now have **one real, high-value stakeholder conversation** (Jed Stumpf, Jay's boss — see Conversations), which confirms many constraints that were previously only assumed. What is still missing is the **student/instructor voice** — no 11–15-year-old or PyGame-course instructor has been interviewed yet. Those remain marked `NEEDS INTERVIEW`. Nothing below invents a quote that did not happen; the Jed quotes are from the actual Slack conversation Jay provided.

---

## Observations

Specific frictions and constraints. Each entry separates what is *confirmed* from what is still *assumed*.

### The League of Amazing Programmers (client context)

- **Confirmed (Jed):** The course must **scale to ~20 concurrent students** — that was the size of the Python cohorts. Whatever the tech, it has to work for 20 kids at once.
- **Confirmed (Jed):** **Per-student VMs are off the table.** "We've had nightmares with VMs. Try getting 20 kids on their own VMs. Doesn't work." This kills any Unity-cloud-streaming-per-kid approach.
- **Confirmed (Jed):** Hardware floor is **Chromebooks, ChromeOS updated within ~the last year, 8–16 GB RAM.** They have only **4–5 spare MacBooks** — not enough for a summer camp, so the course cannot depend on Macs.
- **Confirmed (Jed):** **Cross-platform is the sales lever.** It should run on Windows, Linux, Chrome, and Mac; the two that matter most, in order, are **Chrome first, then Apple.**
- **Confirmed (Jed):** **"Best if it can run on VS Code in a Codespace. It doesn't have to be the best game engine, it just needs to work."** Explicit prioritization of *reliability and reach* over *engine prestige*.
- **Confirmed (Jed):** Deliverable shape — **Level 1 = 12–25 hours; a working game to show friends/family after ~12 hours** ("probably deployed on GitHub Pages but look into that too"), and the rest of the level is **fun extras**.
- **Confirmed (Jed + Jay):** **Code edited in Codespaces; the game client can run separately (the engine itself is fine as the client).** Both agree this is how most engines will have to work.
- **Confirmed (Jed):** **Two-course strategy.** "If we can do that we can sell it, then we can make one with a better engine that would require weekly in-person classes on our machines." The accessible Codespaces course comes first; the heavier-engine course is a *separate, later, in-person* offering.
- **Known (Jay):** The League already runs a dedicated **PyGame** course; this course must not repeat it.
- **Known (Jay):** Jay is an aspiring game developer, more experienced with Unity/C# than Godot, and personally keen to learn/teach a real engine (has a Unity WebGL game, "Dark Lantern," playable on his own site).

### Assumed friction (still `NEEDS INTERVIEW`)

- **Assumption:** Younger students lose momentum if the gap between "start" and "looks like a real game" is too long — hence Jed's ~12-hour "working game" milestone. → Confirm with an instructor about real drop-off points.
- **Assumption:** The "show your family" moment is the emotional payoff, and a shareable link is what makes it land. → Confirm with a current student.

---

## Conversations

### Conversation 1 — Jed Stumpf (Jay's boss / client stakeholder), July 2026 (Slack)

- **Setting:** Planning thread about switching a new course to game development. Real conversation provided by Jay.
- **Friction explored:** What does the course actually need to be to sell and to run at camp scale?
- **What he said and did (direct quotes):**
  - "It doesn't have to be the best game engine, it just needs to work."
  - "Best if it can run on VS Code in a codespace."
  - On scale/VMs: "We've had nightmares with VMs. Try getting 20 kids on their own VMs. Doesn't work."
  - On hardware: MacBooks — "We have them but not enough for summer camps… like 4 or 5 extra at the most"; Chromebooks — "go with a version released in the last year or so and assume 8-16gb ram."
  - On reach: "To really sell the course to more than just a couple kids we would need it to run on Windows, Linux, Chrome, and Mac. The 2 most important are, in order, Chrome, Apple."
  - On strategy: "If we can do that we can sell it, then we can make one with a better engine that would require weekly in-person classes on our machines."
  - On deployment: after ~12 hours students "should have a working game they can show to friends and family, probably deployed on GitHub Pages but look into that too."
- **Workaround in use:** They previously ran Python (PyGame) at 20-kids scale; that's the operational baseline this course is measured against.
- **What surprised the student:** The client *explicitly* deprioritizes engine quality in favor of "it just needs to work on Chromebook/Codespaces at scale" — and already has a two-tier course strategy in mind. That reframes the engine debate entirely.

### Conversation 2 — [PLANNED: a League instructor who taught PyGame, date TBD] — `NEEDS INTERVIEW`

- **Friction to explore:** Where in a 12–25 hour course do 11–15-year-olds lose momentum? When do they light up? Was sharing the finished PyGame game actually hard?

### Conversation 3 — [PLANNED: a current 11–15 student, date TBD] — `NEEDS INTERVIEW`

- **Friction to explore:** Show me a game you love. What would make you proud to say "I made that" and send the link to your family?

---

## Landscape research (what else is out there)

The competitive scan Jay asked for. Each option checked against the four hard constraints, now sharpened by Jed's priorities: **(A)** runs on an 8–16 GB Chromebook *for ~20 kids, no VMs*, **(B)** code editable in VS Code + Codespaces (engine-as-client is fine), **(C)** teaches real, text-based, industry-standard code, **(D)** reaches a polished, shareable artifact fast — ideally a **GitHub Pages** link, cross-platform (Chrome > Mac priority).

| Offering | What it teaches | A: Chromebook @ scale | B: Code in Codespaces | C: Real industry code | D: Shareable (GitHub Pages) | Verdict |
|---|---|---|---|---|---|---|
| **Scratch / MakeCode Arcade / Tynker / code.org** | Block-based (some JS bridge) | Yes | No (own editor) | No — blocks; low ceiling | Weak (platform link) | Approachable but not "industry-standard"; ceiling too low |
| **CodeCombat** | Real Python/JS via puzzles | Yes | No (own sandbox) | Partial (syntax only) | No artifact you own | Teaches syntax, not shipping your own game |
| **Roblox / Minecraft classes** | Lua / platform scripting | Varies | No (platform tools) | Partial (platform-specific) | Shareable but platform-locked | Fun + shareable, but proprietary, not Git/VS Code |
| **Unity / Unreal teen courses** | C# / C++ pro engines | No — editor won't run @ scale; VMs ruled out | Code yes, editor no | Yes (industry) | Yes (WebGL) but heavy | **= the future in-person course**, not this one |
| **Harvard CS50 2D Game Dev** | Lua/LÖVE2D + Unity/C# | No (desktop) | No | Yes | Yes | Great but too steep for 11–15 and not Chromebook/Codespaces |
| **Native Godot (GDScript)** | Full 2D/3D engine | Fragile on Chromebook (ES2.0, select devices) | Yes (code via Godot Tools ext) | Yes | Web export needs GH Pages workaround (below) | Viable "real engine" path with sharp edges at scale |
| **JS/TS web framework (Phaser / Kaplay)** | Real JS/TS, Git/GitHub, dev server + browser client | Yes — native, no VMs, 20 kids fine | Yes — native fit | Yes — JS/TS is industry-standard | Yes — trivial GitHub Pages deploy, identical on Chrome/Mac/Win/Linux | **The whitespace + best fit for Jed's constraints** |

### GitHub Pages deployment finding (Jed asked us to "look into that")

- **JS / HTML5 games (Phaser, Kaplay): trivial.** A Vite build produces a `dist/` of plain static files; a GitHub Actions workflow publishes them to GitHub Pages automatically. No special headers, no gotchas — deployment is just file hosting, and the game runs identically on Chrome, Mac, Windows, and Linux because it's a web page. This maps *exactly* onto Jed's "working game deployed on GitHub Pages" milestone.
- **Godot 4 web export: doable but with a real gotcha.** Godot 4 HTML5 builds typically need `SharedArrayBuffer`, which requires COOP/COEP HTTP headers — and **GitHub Pages does not allow custom headers.** Workarounds exist (export as a PWA whose service worker injects the headers, or disable threads and re-export, or host on itch.io / Cloudflare Pages instead). Workable, but it's the kind of sharp edge that bites when you're supporting 20 kids and the client's bar is "it just needs to work."
- **Unity WebGL: shareable but not the workflow.** Jay's own "Dark Lantern" proves Unity WebGL games are shareable on a static site — but the *editor* still can't run on 20 Chromebooks, and VMs are ruled out. Fine for the future in-person course.

### The engine question, resolved against the client's own priorities

Jed's constraints do most of the deciding:

- **For Level 1 (this course):** the evidence points hard at a **JavaScript/TypeScript web framework (Phaser or Kaplay).** It runs entirely in Codespaces + browser for 20 kids with no VMs and nothing to install, is identical across Chrome/Mac/Windows/Linux, deploys to GitHub Pages with zero drama, and still teaches genuinely industry-standard skills (real JS/TS, Git, GitHub, a dev server). It is the most literal possible answer to "run on VS Code in a Codespace… it just needs to work."
  - *Phaser* = most established, best docs, and (real classroom advantage) AI assistants answer it accurately; object-oriented, so it bridges toward Unity/Godot later.
  - *Kaplay* (Kaboom.js successor) = easiest to learn, fastest to a polished result, ideal for beginners; trade-off is lower ceiling and more AI hallucination.
- **Godot** is the credible "real engine" middle path — GDScript is Python-like and beginner-friendly, code lives in the repo and edits in Codespaces via the official Godot Tools extension, engine as client. But the Chromebook-editor-at-scale fragility and the GitHub Pages header workaround make it a *sharper* path than a JS framework for a first, sell-it-to-everyone course.
- **Unity** is best understood as **the "better engine" future course Jed already described** — weekly, in-person, on League machines — not the Codespaces/Chromebook Level 1. This cleanly honors Jay's engine ambition without breaking the Level 1 constraints.

---

## Patterns

What shows up repeatedly across the landscape scan *and* the client conversation:

- **Pattern — "reach beats prestige" (Jed, twice):** "it just needs to work" and "run on Windows, Linux, Chrome, and Mac." The client optimizes for reliability and cross-platform reach over engine quality. A browser/web target satisfies this more cleanly than any native engine.
- **Pattern — the approachable/authentic trade-off (whole landscape):** every existing option is either *approachable but not real* (blocks, walled platforms) or *real but not runnable on this hardware at scale* (Unity, CS50, native Godot). Codespaces + a web framework is the one place both are true at once.
- **Pattern — sharing is the payoff, and a link is the cheat code:** Jed's ~12-hour "show friends and family, deploy to GitHub Pages" milestone matches what the beloved platforms (Roblox, Scratch) get right and what a PyGame desktop window gets wrong.
- **Pattern — professional tooling is the real "industry-standard" (Jay + Jed):** Git, GitHub, a dev server, VS Code, a public URL — rarely taught to this age, painless via Codespaces, and the genuinely transferable part.

---

## Candidate opportunity

> League students aged 11+ on Chromebooks have no path to build a *real*, industry-credible game they can quickly share with family: block tools cap out and don't teach real code, while professional-engine courses can't run on 20 Chromebooks at once (and VMs and spare Macs aren't options). A browser-based course built on a JavaScript/TypeScript game framework, with code edited in VS Code + GitHub Codespaces and the game deployed to a GitHub Pages link, closes that gap — a working, shareable game in ~12 hours and polish thereafter — while teaching real code and real developer tooling. It complements (doesn't repeat) the existing PyGame course and sets up a future advanced, in-person engine course (Unity/Godot) as Level 2.

**What Jay would take into Stage 1:** the origin interview is effectively already begun with Jed (client stakeholder). The anchoring friction for the positioning statement is *"we need a game course that 20 kids can actually run on their Chromebooks and be proud to share — it doesn't have to be the fanciest engine, it has to work and it has to reach everyone."* Working assumption carried forward: a JS/TS web framework on Codespaces, shipping to GitHub Pages, is the Level 1 resolution — to be pressure-tested with a student/instructor interview and a hands-on Chromebook spike, not presumed.

---

## Vision brief — Jay's three questions (answered, updated with the client conversation)

### 1. Core problem
The course closes the *missing-middle* gap for Chromebook-bound students aged 11+: approachable tools (Scratch, MakeCode, Tynker, CodeCombat) aren't real industry code and hit a low ceiling, while real-engine courses (Unity, Unreal, CS50, native Godot) can't run on 20 Chromebooks at once — and the client's own constraints rule out the usual escape hatches (per-student VMs: "nightmares"; enough Macs: only 4–5 spare). Moving beyond PyGame matters twice over: it avoids duplicating The League's existing course, and — unlike a PyGame desktop window — a web game deploys to a **GitHub Pages link** that opens on anyone's phone, which is the whole emotional payoff. The problem is pedagogical (teach real skills on weak hardware at scale) *and* commercial (the client can only sell a course that runs cross-platform, Chrome-first, for a full cohort).

### 2. Target audience & curriculum structure (ages 11+, 12–25 hours)
Match the client's shape: **a working, shareable game by ~hour 12; polish and "fun extras" after.** An early-win spiral, not a theory ramp:

- **Hours 0–3 — "It moves." Ship on day one.** From a pre-built Codespaces template (repo wired, dev server one click), the student changes a sprite, sees it move in the browser, and shares a preview URL. Professional tooling (VS Code, Git, dev server) is invisible scaffolding they *use* before they *understand*.
- **Hours 3–12 — Build the game in playable slices, ending in a deployable game.** Movement → collisions → scoring → enemies/obstacles → sound → win/lose. Industry concepts (game loop, sprites, collision detection, state, assets) taught *as each slice needs them*. By ~hour 12: deploy to a **GitHub Pages** URL and send it to family — the milestone Jed named.
- **Hours 12–22 — "Fun extras": make it yours and polish.** Level design, art/sound swaps, juice (screen shake, particles, tweens), title and game-over screens.
- **Hours 22–25 — Showcase.** Public URL, short README, two-minute demo. Deliverable = a link, a repo, and a demo — and, per Jed, material The League can use to advertise the course.

Guardrails for the age band and 20-kid scale: capped session scope, a working checkpoint every session (never leave a cohort broken), pair/small-group friendly, and a stack the AI assistants answer accurately (favoring Phaser) so 20 kids asking chatbots for help don't all hit hallucinations.

### 3. Value proposition & the VS Code / Codespaces angle
The course refuses the usual trade-off: *approachable on a Chromebook at cohort scale* **and** *genuinely industry-standard*. Codespaces is the enabling trick — it turns a low-RAM Chromebook into a full professional dev environment (VS Code in the browser, a real terminal, a dev server, Git) with nothing to install and no VMs to babysit, so 20 eleven-year-olds can each write real JavaScript in the editor professionals use, version with Git, and ship to a live GitHub Pages URL that works on Chrome, Mac, Windows, and Linux alike. Students leave with three transferable things a block platform can't give them: **real code**, **real tooling** (VS Code + Git + GitHub + deployment), and **a shareable, portfolio-grade artifact**. And it seeds the client's Level 2: once students have shipped a web game, a later in-person Unity/Godot course is a natural next step. For a young student, the pitch is: *"I made a real game, here's the link, and I built it the way real developers do."*

---

## Next steps in the UA Framework
1. **Get the student/instructor voice** (the remaining `NEEDS INTERVIEW` items) — one PyGame-course instructor and one current 11–15 student. This is the last thing standing between belief and evidence; the client stakeholder view (Jed) is already captured.
2. **Run the engine spike on a real target Chromebook** — build the same tiny "it moves + one interaction + deploy to GitHub Pages" slice as **(a)** a JS framework (Phaser or Kaplay) fully in Codespaces, and **(b)** Godot (code in Codespaces, engine as client; test the GH Pages header workaround). Judge on: runs smoothly on the actual 8 GB device, how clunky the code-to-client loop is for a kid, and time-to-shareable. Keep the runner-up documented as Level 2 groundwork.
3. Proceed to **Stage 1 — Positioning Statement**, using the candidate opportunity as the spine, with the engine held as an explicit open variable to be closed by (1) and (2).
