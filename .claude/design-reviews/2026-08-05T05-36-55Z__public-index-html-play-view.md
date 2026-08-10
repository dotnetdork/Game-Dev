---
target: Play view (game mode display)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-05T05-36-55Z
slug: public-index-html-play-view
---
Method: dual-agent (A: a1f1a373 · B: aad320c5) — re-critique after the hero-viewport pass

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading overlay + error-open console are real; but `.stage-cap` hardcodes "running" + a pulsing dot regardless of actual state |
| 2 | Match System / Real World | 3 | "Your game"/"Building…" are kid-right; `#panel-info` shows raw camelCase CONFIG keys with no units |
| 3 | User Control and Freedom | 3 | Mute/volume/reset present; no replay/pause; keys don't reach the game until the canvas is clicked |
| 4 | Consistency and Standards | 3 | On-brand edge/pill/FAB; caption's uppercase+tracking mirrors the lesson eyebrow |
| 5 | Error Prevention | 2 | No inline error/idle state — a crash leaves a black frame under a caption still claiming "running" |
| 6 | Recognition Rather Than Recall | 2 | No on-frame controls hint; child must recall arrow/WASD keys |
| 7 | Flexibility and Efficiency | 3 | Run-then-Play flow fine; viewport minimal |
| 8 | Aesthetic and Minimalist Design | 3 | Framed stage looks deliberate, but the border is too faint to read as a frame and the box floats on wide/short windows |
| 9 | Error Recovery | 3 | Console shows red errors + force-opens; messages raw; caption contradicts error state |
| 10 | Help and Documentation | 2 | Global Docs/Help only; nothing contextual at the "I just ran it" moment |
| **Total** | | **27/40** | **Acceptable (68%)** — up 1 from 26 |

## Design Specificity Verdict

**Dressed like an engine, not yet wired like one.** The pass genuinely moves this from "bare iframe in a tab" to "framed stage with a brand edge, caption, and build state" — a real appearance win. But the authored feel is a veneer: the status caption is a hardcoded string, the "Game Info" panel doesn't show game info, and the running game already broadcasts its score to a parent that throws the message away. A kid inspecting closely finds the engine is mostly a picture frame.

**Deterministic scan:** 7 warnings, exit 2 — **all on other views** (lesson side-borders, quiz-button glow, sidebar progress bar, global toast); **none on Play-view selectors**. Two detector notes for human judgment: the new `.stage-frame` orange border is a full 1px perimeter so the one-sided `side-tab` rule structurally can't catch it (is it a bezel or an accent sticker?), and the `.stage-cap .live .dot` `box-shadow:0 0 6px #4fd08a` is a textbook zero-offset colored halo the `dark-glow` rule MISSED — a false negative worth a look.

**Visual overlays:** none — no browser automation, so no live render; the canvas is a runtime iframe the static scan can't see into.

## Overall Impression

The frame looks better, but the score barely moved because the substance didn't: the viewport still doesn't tell the truth about game state, and the "Game Info" panel still shows static config instead of the live score the child is earning. The single biggest opportunity is to make the stage *honest and alive* — real Loading/Running/Error state and a live score readout — which also finally fills the sparse left panel.

## What's Working

1. **The stage now reads as a deliberate screen** — 4:3 intent + soft elevation shadow + brand edge + loading overlay is a clear step up from a naked iframe.
2. **Thoughtful plumbing** — `gf.onload` chains overlay-hide → `postGameAudio()`, errors auto-open the console, output is sandboxed, audio is mute-by-default.
3. **Kid-legible microcopy** — "Building your game…", "Your game", mute-state tooltips.

## Priority Issues

- **[P0] The status caption is fake and the live game state is discarded.** `.stage-cap` hardcodes "Your game ● running" with an always-pulsing dot — it says "running" during loading, over a crashed black frame, and before anything starts. Meanwhile every non-starter game posts `{type:'stats', score, lives}` each frame and **nothing listens** (only `__gamelog` is handled); `.info-live` is styled but never rendered. **Fix:** drive the caption from real state (Loading/Running/Error/Idle) set in `startGame()`, `gf.onload`, the error path, and `stopGame()`; add a `message` listener for `type==='stats'` that populates a live "Score · Lives" block in `#panel-info` so the panel titled "Game Info" actually shows game info. (This also resolves the previously-deferred sparse-panel item.) → `/impeccable onboard` + wiring

- **[P1] `flex:1` + `aspect-ratio:4/3` + `max-width` fight, breaking the 4:3 promise.** On narrow/tall windows flex forces extra height → frame taller than 4:3 (letterbox inside); on wide/short windows flex gives small height → the stage floats as a small rectangle in the background (pillarbox). **Fix:** let one model win — `.stage-frame{aspect-ratio:4/3;width:auto;height:100%;max-width:min(100%,1200px);max-height:100%;margin:auto}` with `.stage{min-height:0;justify-content:center}`; drop `flex:1`. → `/impeccable adapt`

- **[P1] Audio pill overlaps the in-game HUD, and keyboard control is dead until click.** `.game-audio` sits top-right, exactly where the games draw score/lives/time; and `switchView('play')` never focuses `#gameFrame`, so arrow/WASD keys do nothing until the child clicks the canvas — deflating the play moment. **Fix:** move the pill out of the HUD zone (bottom-center of the frame or into the caption bar) and `gf.contentWindow.focus()` after load, with a one-time "press an arrow key to play" hint. → `/impeccable layout`

- **[P2] The orange border reads as a sticker, not a bezel; the idle frame is an empty dark box.** `border:1px solid rgba(245,130,10,.5)` is thin and half-transparent; before load the frame and iframe are both `#06101c`. **Fix:** commit to a real bezel (thicker/solid edge or inner ring) and give the idle state a placeholder ("Press Run to start" / watermark) so an empty frame never looks broken. → `/impeccable delight`

- **[P3] Unconditional infinite animation, no reduced-motion guard.** `livepulse` (dot) and `.spin` run indefinitely. **Fix:** `@media (prefers-reduced-motion: reduce){animation:none}`; the dot pulse becomes moot once the caption is state-driven. → `/impeccable harden`

## Persona Red Flags

**Proud-moment deflation:** they hit Run, the game appears — but arrow keys do nothing until they click, and the score they rack up never shows in the "Game Info" panel right there promising exactly that. The payoff is muffled at the instant it should peak.

**The lying green light:** a 10–15-year-old reads a green "● running" dot literally. When it stays green over a black or crashed frame, the app feels broken or dishonest — fast trust erosion in a tool meant to be *their* engine.

## Minor Observations

- The starter platformer never calls `postStats`, so even once stats are wired, its live panel needs a fallback ("Coins: 0").
- `stopGame()` clears the iframe but doesn't reset the caption or show an idle state.
- No loading-overlay timeout — a hung Phaser CDN spins forever.
- Caption `.live` green is the only lowercase text and competes with the uppercase label, reinforcing the eyebrow read.

## Questions to Consider

1. If the green dot is always on, what does it actually tell anyone? Should a viewport display a status it doesn't measure?
2. The game reports its score every frame — why does the panel literally titled "Game Info" show static config instead of the live score?
3. Is a 1px translucent orange line a frame, or a sticker? What makes this stage feel like a console bezel a kid wants to screenshot?
