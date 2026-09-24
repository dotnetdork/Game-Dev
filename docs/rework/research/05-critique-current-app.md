# Impeccable critique of the current app — 2026-09-24

Method: dual-agent (A: independent design review · B: detector + browser evidence), Impeccable 4.3.1
`critique`, run as research for the rework. Target: `app/public/index.html` at 1366×768 (the school
Chromebook size), signed in, no AI model running (the panel's empty and error states were judged;
its replies were not). Key claims checked by hand: `ui.js:37` (`TIER_WIDE = 1440`), no tour code in
`public/js` or `index.html` despite `course.yaml:7`, and `what-an-engine-does.md:112` ("Open the
**Game** tab" — the tab is called Play).

This critique agrees with the student test point for point, and gives the reasons behind each.

## Design health score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | "Check my work" results land below the fold; Play opens on "Your game is not running"; "0 of 2 done" only at the very bottom of the lesson. |
| 2 | Match system / real world | 2 | Minecraft framing is great; the chrome speaks adult engine: "Content Browser", "Inspector", "Source 6 / Assets 9", `config.js`, the raw model name. |
| 3 | User control and freedom | 3 | Quiz retry, board undo/redo, the lab's Back button all work. |
| 4 | Consistency and standards | 2 | Lesson says "Game tab", tab says Play; the left dock changes identity on every tab; the AI greets as "Tutor" while its input says "Ask the AI to change your game…". |
| 5 | Error prevention | 2 | Kids hand-edit raw JS; a "Reset everything (testing only)" control ships in the footer. |
| 6 | Recognition rather than recall | 1 | Practice steps live in Learn but the work happens in Code/Play; switching tabs hides the instructions, so a kid must remember four steps. |
| 7 | Flexibility and efficiency | 2 | Number-key quiz shortcuts and resizable docks — neither helps this audience. |
| 8 | Aesthetic and minimalist design | 1 | ~26 controls on a reading screen; long prose; Play is one-third empty console. |
| 9 | Error recovery | 3 | Wrong quiz answers explain why; the AI's failure message is kind and clear. |
| 10 | Help and documentation | 2 | Help is a wall of text; Docs is the full Phaser API; the promised first-run tour doesn't exist. |
| **Total** | | **20/40** | **Acceptable (bottom of the band) — significant work needed** |

## Design specificity

**Partly authored.** The shell is a generic dark IDE/engine template — navy panels, blue pill tabs,
file tree, console, inspector — that would fit a data notebook unchanged. What's specific to this
product is all in the *content*: the Minecraft and Mario hooks, the read/update/draw loop diagram,
the fps demo, the sticky-note Design board. Nothing in the chrome says "made for 11-year-olds" or
"fun"; League orange appears only on the logo and a few buttons. It reads as a competent adult tool,
which works against "fun first."

**Detector (deterministic scan):** 12 findings on `index.html`, 0 across all 29 client scripts. Five
`clipped-overflow-container` (body and the docks — deliberate in a full-screen app, false positives),
two `cramped-padding` (the view bar and lab panes — how toolbars and editor panes are built, false
positives), one `dark-glow` (the orange `.btn-primary` shadow, `styles.css:1014` and `:2290` — a taste
call), four `thin-border-wide-shadow` advisories on floating layers (dropdown, toast, block cards).
**None of the detector's findings is a cause of what the students hit.** The problems are structural
— density, flow, words, where the AI sits — which a pattern detector doesn't see. The browser overlay
could not run: the app's own Content Security Policy (`server.js:75-107`) blocks Impeccable's script
from another port; relaxing it during critique runs would need your say-so.

**Objective counts at 1366×768:** first lesson 26 interactive controls (~34 with the AI open),
Design 31, Code 41, Play 26, Store 20. No page has a single link — all navigation is buttons.

## Overall impression

A carefully built adult tool wrapped around genuinely good teaching ideas. The single biggest
opportunity: **make the kid's game and the AI the centre of the screen, and turn each lesson into a
few moments that happen beside the game instead of a page to read before it.**

## What's working — keep these

1. **The three-column engine layout** (which you like) and, inside it, the Play tab's **live-tuning
   sliders** (moveSpeed, jumpPower, gravity) — the best "concept → feel it in my game" affordance in
   the app. Promote them.
2. **Direct-manipulation demos** (the fps slider visibly stutters at 10 fps; the gravity demo), the
   loop diagram, and **quiz feedback that explains the wrong answer**. Concepts with few words. Make
   them move on their own.
3. **The Design board** — sticky notes in regions (pitch, core loop, not building). Concrete,
   playful, and already about game concepts, not syntax. Fits the new direction almost as is.
4. **The voice** ("A creeper is heading your way right now"). Keep the tone; cut the length ~80%.

## Priority issues

**[P0] The AI — the focal point of the new course — is hidden at the Chromebook's resolution.**
`ui.js:37` puts the "wide" layout at 1440px; at 1366 the AI panel starts closed behind a small
unlabelled robot icon, and opening it either covers the lesson or squeezes it until the title clips.
Switching Tutor/Build is "the icon in its header"; the raw model name is shown.
*Why:* "teach the concept, build with AI" can't work if the AI is off-screen.
*Fix:* design at 1366 first; keep the AI docked, visible, and named; one chat (merge Tutor and
Build); hide the model name. *Commands:* `/impeccable layout`, `/impeccable adapt`.

**[P0] Lessons are reading assignments, and the building happens somewhere else.** 1,100–1,900 words
before one practice step, and that step sends the kid to another tab with instructions to remember.
*Why:* this is "too many words" and "course and building disconnected" in one.
*Fix:* each lesson becomes a short sequence — one concept, one moving visual, one action that happens
*in place*, with the game visible beside it ("tell the AI to make your jump floatier"). ≤150 words per
concept. *Commands:* `/impeccable distill`, `/impeccable clarify`.

**[P1] Too much chrome, too many destinations.** 26+ controls, 11 destinations (7 nav + 4 tabs), and
a left dock that means something different on every tab.
*Fix:* top nav down to ~2 (the course and my game) now that Gallery and Leaderboards go; show only the
current module; one consistent meaning for the left dock ("your path").
*Commands:* `/impeccable quieter`, `/impeccable layout`.

**[P1] No onboarding, and the kid's own game isn't the first thing they see.** The tour
`course.yaml:7` describes doesn't exist; Play opens idle; first contact is a sign-in page and then a
text lesson.
*Fix:* the first screen is their game running, with the AI saying hi and offering one tap-able change
within 30 seconds. *Command:* `/impeccable onboard`.

**[P2] Widgets are inert or adult-grade.** Demos wait for a drag before moving; the lab is a debugging
IDE; "Check my work" feedback lands off-screen; the quiz is a text list with number badges; literal
asterisks around "*you*"; the wrong tab name.
*Fix:* demos that autoplay; big tappable choices with a real celebration; practice checked in place;
no code-debugging labs in a no-syntax course. *Commands:* `/impeccable delight`, `/impeccable harden`.

## Persona red flags

**Jordan (confused first-timer):** nothing says "start here"; seven nav words mean nothing yet
(Docs? Leaderboards?); the robot icon has no label; practice says "Open the Game tab" and there is no
Game tab; on Code the outline disappears and there's no obvious way back.

**Mia, 11, won't read** (from PRODUCT.md's "short, mixed attention spans"): sees paragraph,
paragraph, heading — scrolls. Skips the demo because it isn't moving. Hits a quiz before anything to
play. Never finds her game (behind a tab and a Play button). Bored by minute three — exactly what
the students did.

**Mr. Ortiz, instructor with 20 kids:** 20 kids at 20 scroll positions in 1,800-word pages, so he
can't see who's stuck; the AI is hidden so hands go up instead; the lab stops kids cold; the footer
reset lets a kid wipe their progress; no class view.

## Minor observations

- Store cards show code (`this.physics.add.sprite(x, y, 'KEY')`) and offer 153 sets; the direction
  wants one style.
- "Courses" shows a single course; "Game Dev" beside the logo is redundant.
- The sign-in page ("Class access only… still being built… for authentication purposes") is a cold
  first impression.
- Design board region labels (tiny uppercase at 58% zoom) are likely below AA contrast — check in an
  audit.
- Run-cell code areas are editable textareas inside the reading flow; clicks land in them by
  accident.

## Questions for the rework

1. If the kid's game were always on screen and running, with the lesson as a card beside it, what
   would still need a Learn tab?
2. Can every concept be one moving picture plus one sentence, then "now tell the AI to put it in
   your game"?
3. Should the AI be a named character with a face — the teacher at the shoulder — rather than a panel
   called "AI Assistant"?
4. What does a kid see the moment a concept lands in their game — a before/after replay, a
   celebration, a clip? Where is each lesson's peak?
5. If code is hidden in this version, do the Code tab, console and labs survive at all, or are they
   Level 2?

Screenshots from the run were taken in the session scratchpad (not committed).
