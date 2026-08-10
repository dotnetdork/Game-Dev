---
target: Play view (game mode display)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-08-05T05-24-38Z
slug: public-index-html-play-view
---
Method: dual-agent (A: afb0c9e8 · B: a325d051)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No "building/running" state while startGame() rebuilds the iframe; nothing labels the frame as the live game |
| 2 | Match System / Real World | 3 | "Play", gamepad, Console, Current settings speak kid-dev language well |
| 3 | User Control and Freedom | 3 | Reset/mute/collapse/resize present; no restart/pause/fullscreen from the view |
| 4 | Consistency and Standards | 2 | Audio control anchored to the view not the canvas; FAB overlaps a real button |
| 5 | Error Prevention | 2 | AI FAB sits on top of the console "Clear" button — misclick hazard |
| 6 | Recognition Rather Than Recall | 3 | Visible controls + title tooltips |
| 7 | Flexibility and Efficiency | 3 | Ctrl-Enter run + draggable resizers; no canvas zoom/fit/fullscreen |
| 8 | Aesthetic and Minimalist Design | 1 | 900px canvas capped in a much wider column → dominating dark void; game reads small and lost |
| 9 | Error Recovery | 3 | Console pipes game errors/warnings with color coding |
| 10 | Help and Documentation | 3 | Docs/Help + consistent tooltips |
| **Total** | | **26/40** | **Acceptable (65%)** |

## Design Specificity Verdict

**A competent engine-shell, but not yet an authored kids'-game viewport.** The three-pane grid, tab strip, dockable console, and AI dock read like a solid IDE clone — but the one screen where a kid should feel "that's MY game, running right now" abdicates. `#view-play` is a radial-gradient void with a 900px iframe floating in it and a detached audio pill. League orange — the whole brand identity — is absent from the hero view (it appears only on the FAB and mute-on state). Real engine viewports frame the canvas, label it, and attach its controls to it; this one lets the canvas drift and the chrome collide.

**Deterministic scan:** detector returned 7 warnings, **all on other views** (lesson/quiz/tutor side-borders, the global progress bar, the quiz-button glow) — **zero on Play-view selectors** (`#view-play`, `#gameFrame`, `.game-audio`, `.ai-fab`, `.console` all came back clean). So this isn't a "slop" problem in the markup; it's an under-designed layout. Agreement between the LLM review and the detector: the Play chrome is technically clean, the issues are compositional.

**Visual overlays:** none — no browser automation available, so no live-rendered overlay. The game canvas is a runtime iframe, so the static scan only vouches for the surrounding shell.

## Overall Impression

This is *the* screen the whole course builds toward, and right now the payoff is muted. The game sits small in a big dark void, the audio pill floats in the top-right emptiness disconnected from the frame it controls, and the orange AI robot button overlaps the console's "Clear" — a real collision. The single biggest opportunity: make the running game the unmistakable **hero** of this view — bigger, framed, on-brand — and attach its controls to it.

## What's Working

1. **Audio wiring is solid** — `updateAudioUI` keeps icon, tooltip, `.on` state, slider value and disabled-state coherent, persists to localStorage, and postMessages into the sandboxed iframe. Only the *placement* fails, not the logic.
2. **Console-as-dev-tool is the right call** — color-coded errors/warnings, collapsible, open on Code and closed on Play. Sensible, moment-aware defaults.
3. **The canvas frame is tastefully styled** — rounded corners + soft drop shadow. Once sized and centered right, it'll look like a proper viewport.

## Priority Issues

- **[P0] AI FAB collides with the console "Clear" button.** `.ai-fab` (`right:18px;bottom:18px;z-index:20`) lands directly on `.con-clear` (pinned right of the console head) when the AI dock is collapsed — visible in the screenshot. Two destructive-adjacent actions share the same pixels: reaching to reopen the AI can wipe the log. **Fix:** lift the FAB above the console band (`bottom: console-head height + 18px`) or anchor it to `.viewbody` so it floats over the canvas region, never the console lane. → `/impeccable layout`

- **[P0] The game isn't the hero — capped canvas in a dominating void.** `#gameFrame{max-width:900px;aspect-ratio:4/3}` inside a much wider center column leaves the radial-gradient void dominating; the game reads small and off-center. **Fix:** raise the ceiling and prioritize height (`max-height:calc(100% - 32px)`, `max-width:min(100%,1100px)`), wrap the frame in a `.stage` with a subtle League-orange rim/glow and a small "▶ Your game — running" caption, so the empty gradient becomes an intentional matte stage rather than accidental emptiness. → `/impeccable layout` + `/impeccable delight`

- **[P1] Audio control is detached from the frame it controls.** `.game-audio{position:absolute;top:14px;right:14px}` pins to the top-right of the whole view, floating in the void far from the centered canvas. **Fix:** put frame + audio in a `position:relative .stage` wrapper sized to the canvas so the pill rides the frame's top-right corner like a real viewport toolbar (also fixes the perceived right-shift). → `/impeccable layout`

- **[P2] The left "Game info" panel is under-furnished.** Two settings + Reset, then empty space next to an empty-feeling viewport — doubles the "unfinished" impression. **Fix:** enrich into a real card (title, controls legend "Arrow keys / WASD / Space", Running status, tunables as live sliders), or narrow the left dock in Play mode and give the width to the canvas. → `/impeccable layout`

- **[P3] No "building/running" feedback on Run.** Between switching to Play and first paint there's a blank frame with no status; on a slow connection a kid sees black and wonders if it broke. **Fix:** a lightweight "Building your game…" overlay in `.stage`, cleared in the existing `gf.onload`. → `/impeccable onboard`

## Persona Red Flags

**Jordan (first-timer):** hits Run, gets a small frame adrift in a dark void with a floating speaker icon and no label — the proudest moment of the course lands as "did it work? is that it?". The missing "your game" framing and the void are Jordan-critical.

**Riley (stress-tester):** collapses the AI dock and immediately finds the FAB-over-Clear collision, then resizes the window and watches the 4:3 canvas shrink into the void while the audio pill drifts further from it. Both are reproducible defects, not edge cases.

## Minor Observations

- Muted-by-default is a considerate classroom choice — keep it.
- `#gameFrame` and the iframe body share the same dark background, so a not-yet-painted game is invisible against the void — reinforces the need for a loading state.
- Brand orange is missing from the hero view — a running-game "LIVE" rim would spend it well.
- Collapsed console height is driven by its head, which is exactly the band the FAB collides with — the fix must reference that, not a fixed number.

## Questions to Consider

1. If a kid screenshotted this view to show a friend, would they say "whoa, you made a game?" or "why is there so much black?" Design for the first answer.
2. Why is League orange absent from the one screen that celebrates the kid's creation?
3. Is 900px the canvas *ceiling* or the *target*? If target, why give it a 1400px column and paint the rest black instead of framing it as a deliberate stage?
4. Should the FAB ever live in the console's lane at all?
