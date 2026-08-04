# UA2 — Positioning Statement

The deliverable of Stage 1. Drafted in Pass 1 from current belief, revised across Passes 2–4 as research and interview evidence comes in. Every clause must be defensible by the time Stage 1 exits.

The statement at the top is the public-facing artifact — short, clean, one paragraph. The evidence record below it is the working document where the thinking lives, mess and all.

> **Ownership note.** These clauses were drafted *for Jay to accept, sharpen, or overrule* — Jay owns this document. Edit any "Current belief" line freely.
>
> **Evidence approach (Jay, 2026-07-18; updated 2026-07-28).** This project is grounded primarily in **documented sources + client conversations**, not user interviews. As of 2026-07-28 there have been **two client conversations** (Jed alone in July, then **Jed + Eric on 2026-07-28**) plus a **working prototype the clients explicitly approved** — stronger stakeholder evidence than the first draft rested on, though still **no student/instructor user interviews**. The UA Framework's Stage 1 exit bar accepts a clause defended by a real conversation, a documented source, or observed behavior. The honest limit remains: secondary research shows what *kids of this age in general* do; it cannot prove what *these specific League students* feel. Where a clause rests on secondary evidence, that is stated plainly, and each clause records a counter-finding or falsifier.

---

## Statement

> For **League students aged ~10–15 on school-managed Chromebooks** (and the League instructors and parents who choose their courses),
> who **want to build a real game they're proud to show family and friends — but the tools that feel "real" won't run on their locked-down hardware, the ones that do run feel like toys, and none of them teach kids to actually understand the code a game is made of**,
> **the League's game-development course (name TBD)** is a **project-based, browser-based introduction to game development, delivered through an engine-like studio where the student directs an AI that does the heavy typing**
> that **hooks them with playable games first, then guides them over ~10–12 hours to build their own game by reading, shaping, and debugging its code — finishing with one game they're genuinely proud to show off.**
> Unlike **block platforms (Scratch, MakeCode, Tynker), walled coding-game sites (CodeCombat), Roblox/Minecraft classes, the status-quo Python/PyGame course whose output is hard to share, or Unity/Godot courses that can't run on a Chromebook cohort**,
> our course **runs entirely in-browser on managed Chromebooks at class scale — no installs, no VMs, and no per-student accounts (games save and publish through the League's own GitHub) — and instead of hiding the code or making kids type it from scratch, it teaches them to read a real codebase, make the design and architecture calls, and direct an AI to carry them out: the way software is increasingly built.**

---

## Status

Per-clause status. Mirrors `UA0-PROJECT-STATUS.md`.

- **Target customer:** refined by research (client-reaffirmed 2026-07-28)
- **Need or opportunity:** refined by research (client-reaffirmed 2026-07-28)
- **Product name:** drafted from belief — **open** (League branding decision; blocks a clean Stage 1 exit)
- **Product category:** refined by research (client-reaffirmed 2026-07-28)
- **Key benefit:** revised 2026-07-28 — refined by research + client conversation
- **Primary competitive alternative:** refined by research (client-reaffirmed 2026-07-28)
- **Primary differentiation:** revised 2026-07-28 — refined by research + client conversation

Status values: `not started` | `drafted from belief` | `drafted-unconfirmed` | `refined by research` | `evidenced by interview` | `stable`.

---

## Evidence

One subsection per clause. Updated continuously across all passes.

### Target customer

- **Current belief:** League students aged ~10–15 on school-managed Chromebooks are the *users*; League instructors/leadership (and parents) are the *buyers/deciders*. Jed named the floor as "11+"; Jay has observed engaged 10-year-olds (his nephew).
- **Basis for the belief:** Two client conversations (Jed; Jed + Eric) + published research on how this age group is motivated.
- **Evidence found:**
  - Jed, July 2026: cohorts ~20; Chromebook hardware (8–16 GB); "to really sell the course… run on Chrome, then Apple." Establishes buyer priorities and user hardware.
  - Jed + Eric, 2026-07-28: reaffirmed cohort scale and the 11+ band; confirmed managed Chromebooks as the design constraint.
  - Jay, 2026-07-28: his ~10–11-year-old nephew, previously uninterested, reacted to the prototype with "can I play? this is fire" — an observed instance of the fun-first hook working on the young end of the range.
  - Iowa State Univ. (School of Education): middle-schoolers "are motivated differently" — they "engage quickly with a creative narrative" and "are not focused on academic achievement or class ranking."
  - Landscape research: comparable youth game-dev courses cluster around this 11–15 / middle-school band.
- **Alternatives considered:** "The League itself is the customer" (true for the *buyer* lens; kept both, primary = student). "Ages 11–15 strictly" (widened to ~10–15 given observed 10-year-olds and Jed's "11+").
- **What would change my mind:** Evidence that enrollment skews notably older/younger, or that parents rather than the League are the true deciders. A single instructor could confirm the enrolling profile.

### Need or opportunity

- **Current belief:** Students want to make a *real* game they can proudly share; current options force a choice between "feels real but won't run on my Chromebook" and "runs on my Chromebook but isn't real / can't be shared" — and, added 2026-07-28, **none of the accessible options teach kids to actually understand the code a game is made of.** The motivating entry point is fun (play first), not instruction.
- **Basis for the belief:** Client goal statements (both meetings) + a body of learning-science research on shareable artifacts and early ownership. (Partly secondary evidence, not a student's own words.)
- **Evidence found:**
  - **Constructionism (Papert; Resnick/Scratch, MIT Media Lab):** learning is strongest when it centers on creating "tangible, shareable artifacts." The shareable finished game is the pedagogically central mechanism.
  - **Early-ownership / retention research:** the first ~4 weeks are the highest-risk dropout window; "students need to produce something within the first two sessions." Validates "working, shareable game fast." (Kodely; CSTA "disengagement gap.")
  - Jed, July 2026: independently frames the ~12-hour "working game to show friends and family" as the milestone.
  - Eric, 2026-07-28: named a deeper need beyond producing a game — students should **read code and think about architecture**, make decisions and learn to **explain them to an AI**; and articulated the **fun-first ethic** ("have fun first; then to keep having fun, you learn to program" — the "Robot Riot" model).
  - Jed, 2026-07-28: from experience, kids **cannot self-start a game** ("80% don't know what to make; the other 20% spend all their time on a sprite"), so the felt need is a **guided path**, not a blank canvas.
- **Alternatives considered:** "The need is just to learn to code" (too generic). "The need is a portfolio artifact" (fits older teens). "The need is only to produce a shareable game" (the 2026-07-28 meeting added the *understand-and-direct-the-code* dimension, so this earlier framing was too shallow).
- **What would change my mind:** A student or instructor saying kids don't care about sharing the result; or that kids are happy to let the AI do everything and have no interest in understanding it. **Honest note:** the "understanding the code" need is client-asserted (Eric) and pedagogically sound but not yet confirmed by students themselves.

### Product name

- **Current belief:** **Open — name TBD.** Prior working title "League Web Game Studio." The course name *and* the public showcase-site name are both undecided.
- **Basis for the belief:** Placeholder; naming is a League branding decision, confirmed with Jay to be owned by the League (Jed), not settled in the meeting.
- **Evidence found:** none — deliberately deferred to the League.
- **Alternatives considered:** "League Web Game Studio," "Ship Your First Game," "Game Dev: Web Edition," "Playable (Level 1)," "Code Your Own Game."
- **What would change my mind:** A League branding decision. **This is the one clause blocking a clean Stage 1 exit** until the League names it.

### Product category

- **Current belief:** A project-based, browser-based introduction-to-game-development course for ages ~10–15, delivered through an **engine-like, AI-assisted studio**, and positioned as **Level 1 of a planned two-level track** (Level 2 = a heavier, in-person "real-deal" course with professional tools).
- **Basis for the belief:** Client framing (both meetings) + research on how families categorize/search + project-based-learning evidence.
- **Evidence found:**
  - Jed, July 2026 & 2026-07-28: explicit two-course strategy — this accessible browser course first; a heavier-engine course later where students "build their own Minecraft" with professional tools. Establishes this as "Level 1."
  - Project-based learning research: PBL is an effective pedagogy for motivating middle-schoolers, with measured pre/post engagement gains (ERIC ED591136; PMC10783726).
  - Landscape research: families shop for this under "coding class / game design class for kids."
- **Alternatives considered:** "A web-development course" (undersells the game hook). "A computer-science fundamentals course" (accurate but not how customers search).
- **What would change my mind:** Evidence families categorize/search this differently (e.g., "Roblox class"), which would change marketing language.

### Key benefit

- **Current belief:** You start by *playing* games, then over ~10–12 hours you build your own game by **reading, shaping, and debugging its code with an AI doing the heavy typing** — finishing with one game you're genuinely proud to show off, and coming out **actually understanding how it works and how to direct an AI to build things.**
- **Basis for the belief:** Mirrors both clients' framing (fun-first + guided build + understanding), grounded in constructionism + early-ownership research (partly secondary).
- **Evidence found:**
  - Constructionism: the shareable artifact is the payoff and the learning mechanism at once (see Need).
  - Early-ownership research: producing something real early converts excitement into retention (Kodely; CSTA).
  - Eric, 2026-07-28: fun-first hook; the real benefit is **understanding and directing** the code (not typing it), and getting good at **explaining what you want to an AI** — a deliberately timely skill.
  - Jed, 2026-07-28: shape of the payoff — first ~6 hours through 5–6 teaching **minigames**, last ~6 hours building **one impressive game** (a roguelike was floated) they'd proudly show a parent, "not the falling stars."
  - Deployment: a browser (HTML5/JS) game publishes to a shareable link trivially, so the "here's my game" payoff is genuinely deliverable on this stack.
- **Alternatives considered:** *(revised away 2026-07-28)* "In ~12h you build and share a real game **written in real industry-standard code with professional developer tools**, then polish it by hour 25." The pivot demoted the "industry-standard code / pro tooling" framing in favor of fun-first + understand-and-direct-the-code. Also: "the benefit is learning industry skills" (that's the *buyer's* benefit; student-benefit kept primary).
- **What would change my mind:** A student describing the payoff as something else (beating friends' high scores rather than sharing/understanding). **Honest note:** partly secondary-evidence; the "understanding" benefit is client-asserted, unconfirmed by students.

### Primary competitive alternative

- **Current belief:** The real alternatives are (1) block-based platforms (Scratch, MakeCode, Tynker) and walled coding-game sites (CodeCombat); (2) the status quo — the League's PyGame course, whose output is hard to share; (3) Roblox/Minecraft classes competing for the same attention; and (4) "do nothing." Unity/Godot courses are alternatives in name but ruled out by hardware/scale.
- **Basis for the belief:** Landscape research + client context (both meetings).
- **Evidence found:**
  - Landscape research: block tools are Chromebook-friendly but low-ceiling and not real code; CodeCombat teaches syntax but yields no game you own; Unity/native Godot need hardware or a desktop editor this cohort/scale can't support.
  - Jed, July 2026: VMs are "nightmares" at 20 kids; only 4–5 spare Macs — pro-engine alternatives are non-starters for Level 1.
  - Jed, 2026-07-28: reinforced the accessibility problem with a concrete failure — a whole class had their GitHub accounts suspended (under-13), which is *why* the League runs a code server; the alternative of "just use GitHub normally" actively fails for this age.
- **Alternatives considered:** "Roblox/Minecraft classes" as the primary alternative (real competition for attention, though platform-locked — worth naming in marketing). "PyGame" as the head-to-head rival (internal status quo, kept as an alternative).
- **What would change my mind:** Families overwhelmingly comparing against Roblox/Minecraft classes (shifting the primary alternative), or the PyGame course already sharing results easily.

### Primary differentiation

- **Current belief:** Two things at once. **(1) Accessibility:** it runs entirely in-browser on managed Chromebooks at class scale — no installs, no VMs, and **no per-student accounts**, because games save and publish through the **League's own GitHub via the code server** (repos created under one League account, the legal workaround for the under-13 GitHub problem). **(2) Pedagogy:** instead of block toys or making kids type code from scratch, it teaches them to **read a real codebase, make design/architecture decisions, and direct an AI** to carry them out. It is the only option that is simultaneously *runnable on this hardware at cohort scale* and *builds genuine code-reading + AI-direction skill.*
- **Basis for the belief:** Landscape + deployment research + client constraints + learning-science on making-vs-playing + the 2026-07-28 meeting's pedagogy direction.
- **Evidence found:**
  - Research: JS/HTML5 web games run identically across Chrome/Mac/Windows in a browser and publish to a public link with no header workarounds (unlike Godot 4 web export's COOP/COEP wall).
  - **Making > playing:** studies comparing student *creation* of game content against gameplay-only find creators show "improved learning gains and positive effects on motivation" (Springer/Discover Education). Differentiates a *build-your-own* course from play-to-learn sites like CodeCombat.
  - Eric, 2026-07-28: the intended, differentiated skill is **reading code + architecture + directing an AI**; he even wants the AI **deliberately limited or "impoverished" in places** to force students to think — a pedagogy no block tool or AI-autocomplete product offers.
  - Jed, 2026-07-28: the **League code server** (repos under one League GitHub account) is the accessibility differentiator that makes the whole thing legal and workable for under-13s at school; everything runs **client-side**, code stored in git, **no database** to manage.
- **Alternatives considered:** *(revised away 2026-07-28)* the earlier differentiator — "students write **real industry-standard code (JS/TS) with professional tooling (VS Code, Git, GitHub, deployment) via GitHub Codespaces**, shipping to GitHub Pages." The pivot replaced "write real code in pro tools via Codespaces" with "read/direct real code in an engine-like studio," and Codespaces is now optional (a lightweight webserver was approved). Engine choice (Phaser vs Kaplay) — now resolved to **Phaser**.
- **What would change my mind (counter-evidence noted for honesty):** Some game-based-learning studies report *lower* CS motivation than traditional instruction in certain setups — "game" framing alone doesn't guarantee engagement; execution matters. Also: if a competitor already delivers AI-assisted, read-and-direct pedagogy on managed Chromebooks at scale, the "only option" claim weakens; if 10–11-year-olds can't actually handle reading code and directing an AI; or if the fun-first minigames don't convert into willingness to build.

---

## Sources

Primary stakeholder evidence:
- Client conversations: Jed Stumpf (July 2026) and Jed Stumpf + Eric Busboom (2026-07-28); prototype demoed and approved 2026-07-28.

Secondary research underpinning the clauses:
- Iowa State University, School of Education — middle-schoolers are motivated differently (creative narrative over class ranking).
- ERIC ED591136 — Impact of Project-Based Learning on middle-school motivation and engagement.
- PMC10783726 — digital educational games and student motivation via learning engagement.
- Constructionism (Papert; Resnick/Scratch, MIT Media Lab) — tangible, shareable artifacts as the core learning mechanism.
- Kodely retention analysis; CSTA "The Disengagement Gap" — early-ownership / first-sessions dropout window.
- Springer / Discover Education — student-generated challenges (making) outperform gameplay-only on learning and motivation.
- Systematic reviews of game-based learning & computational thinking — mixed motivation findings (counter-evidence).
