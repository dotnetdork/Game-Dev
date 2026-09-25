# Impeccable critique of the new template — 2026-09-25

Method: dual-agent (A: independent design review · B: detector + browser evidence), Impeccable 4.3.1
`critique`, run the same way as the old app's critique (`05-critique-current-app.md`, 20/40) so the
scores compare. Target: `docs/rework/wireframes/02-first-run-engine.html` — the first run of the
reworked course, a 12-step click-through prototype. **Caveat stated up front:** a prototype scores
partly by having less in it; heuristics 5, 9 and 10 are flattered because little can go wrong in a
scripted flow. The old app was judged as a working system.

## Design health score: 26/40 (old app 20/40)

| # | Heuristic | New | Old | Key issue now |
|---|---|---|---|---|
| 1 | Visibility of system status | 3 | 2 | Play tint, orange ring, parts snapping in are clear; no "first day" progress; off-cue Play gives no feedback |
| 2 | Match system / real world | 3 | 2 | Studio story + real word and gloss works; "Player Controller (Script)", `moveSpeed`, "60 FPS" are adult-grade |
| 3 | User control and freedom | 2 | 3 | Can't undo or change a pick; "Not quite" advances exactly like "Yes!" |
| 4 | Consistency and standards | 3 | 2 | One token set, icon + word; Pause/Step look live and do nothing; step 11 enters Play by itself right after teaching "you press Play" |
| 5 | Error prevention | 3 | 2 | Options remove typing; Play only when cued (flattered by the script) |
| 6 | Recognition rather than recall | 3 | 1 | Options under the question, labelled docks; the log wipes each step; the kid's picks are never shown back |
| 7 | Flexibility and efficiency | 2 | 2 | No read-aloud, pace control or fast path; typed text ignored |
| 8 | Aesthetic and minimalist design | 3 | 1 | A big step up; steps 1–3 are black voids + one bubble; dead space above the options |
| 9 | Error recovery | 2 | 3 | Scored on intent; "Not quite" recovers nothing; AI-down and "picks nothing" states not shown |
| 10 | Help and documentation | 2 | 2 | The mentor is the help; no "say that again"; cards and stars unexplained |
| **Total** | | **26/40** | **20/40** | **Acceptable, upper half** (old: bottom of Acceptable) |

## Objective comparison

| | Old app | New template |
|---|---|---|
| Interactive controls, first screen | ~26 | 4 |
| Busiest screen | ~34 (AI open) | 13 (Inspector open) |
| Destinations | 11 | 0 on day one |
| Words | ~1,700 per lesson | ~250 for the whole first run; 8–20 per line |
| Smallest target | many under 44px | 44px everywhere (scripted check) |
| Detector anti-patterns | 12 (mostly false positives) | 0 (8 advisories: off-scale radii and sizes) |
| AI visible at 1366 wide | No (hidden below 1440) | Yes — but see the viewport-height issue |

## Design specificity

**Mostly authored.** Unity's dark skin, League orange doing Unity's selection job, real panel names
with kid glosses, the Play-mode tint and outlined docks are deliberate. What stays generic is the
mentor ("face TBD / name TBD"): warmth and kid-appeal still come from the dialogue, not the design.
**Detector:** 0 anti-patterns; the browser pass re-reports the editor-chrome padding pattern (its
file-scoped ignore isn't read in the browser) and found one real **low-contrast** case (4.3:1:
`#b0b0b0` sub-labels on a hovered option's tint, `#564431`); the file's `nested-cards` ignore is
stale (no such finding even with config off).

## What's working

1. **The editor builds itself around the kid** — outlines hold each dock's place; the lowest-load
   first screen the project has had.
2. **The engine drives the story** — the real toolbar Play/Stop is the only way forward at steps
   6–7; a Hierarchy row opens a real Inspector with real word + gloss.
3. **A coherent, kid-sized visual system** — 15px body, 44px targets, one accent, one icon set, the
   game the brightest thing on screen.

## Priority issues

**[P0] The kid mostly taps and watches; the agreed core loop isn't there yet.** Across 12 steps the
kid only decides; the AI fixes, builds, and even makes the Play-mode change. The "play it" game is a
still picture and the sliders do nothing. *Fix:* a playable game (arrows + space); the kid makes the
Play-mode change themselves (drag the coin slider while playing, watch it revert on Stop); the
intern's-game fix as a tiny hands-on shift. *Commands:* `/impeccable shape` (the shift),
`/impeccable delight`.

**[P1] The 768px frame doesn't fit a real Chromebook browser window.** `fit()` scales by width only;
at 1366×657 usable (Chrome's tabs, address bar, shelf) the say field, Project drawer and status bar
are cut off and the fourth option is half hidden. 1366×768 is the *screen*, not the page. *Fix:*
design for ~1366×650 usable and scale to fit both dimensions. *Commands:* `/impeccable adapt`,
`/impeccable layout`.

**[P1] Tabbing into the hidden Inspector wipes out the mentor.** The closed Inspector's close button
stays focusable (`aria-hidden` only); tabbing to it scrolls the mentor dock sideways behind an empty
Inspector. *Fix:* make the closed Inspector `inert`. *Command:* `/impeccable harden`.

**[P2] The opening is three questions over an empty screen** — name, locked door, favourite game
before anything moves (the brief's "no survey" anti-goal); the favourite-game question shows a typed
answer the kid never gave and offers no options. *Fix:* something moving in the Game view from step
1; one question between visible changes; tappable options on every question. *Command:*
`/impeccable onboard`.

**[P2] The mentor has no presence** — "face TBD" in the most-looked-at spot. *Command:*
`/impeccable delight`, once the character is decided.

## Persona red flags

**Jordan (first-timer):** three empty dark rectangles look broken; "See the Play button up top?"
relies on a 2px ring; Pause/Step look pressable and do nothing; "Tap a part!" gives no reason;
cards and stars unexplained.

**Mia, 11, won't read:** reads less (good); asked three questions before anything moves; at the peak
she can't actually play; sliders do nothing; no read-aloud.

**Mr. Ortiz, 20 kids:** linear steps give a shared "where are you" (a big gain); no stuck signal or
hand-up; a kid who ignores the step-6 cue gets no nudge; 20 kids finishing in ~90 seconds leaves
idle time.

## Old findings: resolved or not

| Old issue / student finding | Status | Why |
|---|---|---|
| P0 AI hidden at 1366 | Mostly resolved | Docked and named; reopened by viewport-height clipping |
| P0 Lessons are reading; building elsewhere | Partly | ~250 words, one frame beside the game; kid building not shown |
| P1 Too much chrome / destinations | Resolved for day one | 4–13 controls, no nav; the day-10 editor untested |
| P1 No onboarding; game not first | Partly | It is onboarding, but the game appears at step 4 |
| P2 Inert / adult widgets | Not yet | Sliders inert, game a still, Pause/Step dead |
| Bored | Not testable | Less to be bored by, but less to do; shifts not shown |
| Lost | Partly | Named docks one at a time; the Tab bug and clipping can hide the mentor |
| Couldn't tell what to do | Partly | Always one obvious tap, but still watching the AI |
| Overwhelming | Resolved (first run) | ~4 controls at the start |
| Too many words | Resolved (in the script) | AI-written lines must be held to this |
| Course and building disconnected | Partly | Same frame, but the kid never builds or plays |
| Poor widgets | Not yet | The key widgets are inert |

## Minor observations

The name is always "Captain Byte" (prototype shortcut); "Saved" with no sense of what; the 10.5px
face placeholder breaks the 12px floor; "Level 1" has no Inspector; the step-7 callout and mentor
both explain Play mode; dead space between message and options will grow with history.

## Questions to consider

1. If the kid never moves the robot on day one, have they really played their own game?
2. Should the Play-mode mistake be the kid's own — mistakes stick when they're yours?
3. What's on screen in the first 10 seconds besides dark panels — could the intern's grey game
   already be running?
4. Is 1366×768 a design size or a screen size — will it ever run fullscreen or kiosk?
5. Do Pause and Step belong on day one if they do nothing?
