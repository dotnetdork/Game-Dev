---
target: leaderboards page
total_score: 23
max_score: 36
na_heuristics: 9
p0_count: 2
p1_count: 2
timestamp: 2026-08-05T03-21-19Z
slug: public-app-js-leaderboards
---
Method: dual-agent (A: a9ce2d6c · B: a9a630b8)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "This week" has no as-of timestamp; rank changes give no feedback |
| 2 | Match System / Real World | 3 | Same medal glyph recolored for 1st/2nd/3rd — no distinct shapes |
| 3 | User Control and Freedom | 2 | Only 4 toggle states; no search, no "jump to me," no expand |
| 4 | Consistency and Standards | 3 | XP printed `4200 XP` with no thousands separator |
| 5 | Error Prevention | 3 | 0-XP empty CTA renders on top of a populated board |
| 6 | Recognition Rather Than Recall | 3 | Rank #N is relative to the filtered set; scoping never explained |
| 7 | Flexibility and Efficiency | 2 | Hard ceiling at ~7 rows; no pagination or depth |
| 8 | Aesthetic and Minimalist Design | 2 | Minimal to the point of emptiness — the core complaint |
| 9 | Error Recovery | n/a | No error states surfaced on this page |
| 10 | Help and Documentation | 2 | Nothing explains how XP is earned or what "class" scopes to |
| **Total** | | **23/36** | **Acceptable (64%)** |

## Design Specificity Verdict

**Product-aware scaffolding wrapped around a generic core.** The framing is authored for this product — privacy-safe names matching the Gallery, a My class / Everyone scope reflecting a real classroom, All-time / This week, Level-from-XP, a brand-orange "you" row. But the list body (rank cell / letter avatar / name / thin bar / value) is the default leaderboard you could drop into any fitness or sales app. Two tells: (1) the app's economy runs on **Stars**, yet the board ranks only on **XP** — its own vocabulary is missing; (2) the rest of the app is a dark game-engine aesthetic, but this screen reads like a plain settings table — no podium, no score treatment, no motion.

**Deterministic scan:** detector on `index.html` returned exit 2 with 7 warnings — all on other components (5× `side-tab` left-borders on lessons/tutor/toast, 1× `layout-transition` on the lesson progress bar, 1× `dark-glow` on the quiz button). **Zero findings on the leaderboard CSS (lines 290–306).** Agreement: the board has no "slop." Detector did not fire on off-token literals it had in scope — medal colors `#ffcf4d/#cfd8e3/#e0965a`, `.lrow.you`/`your-rank` `#241a12`, `.lbar` track `#12304f` — worth normalizing to tokens later.

**Visual overlays:** none — no browser automation in this environment, so no rendered-DOM inspection. The leaderboard DOM is generated at runtime by `renderBoard()`, so the static scan can only vouch for the CSS rules, not the composed rows.

## Overall Impression

The "empty" feeling is real and has one dominant cause plus several amplifiers. Dominant: an 820px-capped board (`.board{max-width:820px}`, no `margin:auto`) sits **left-aligned** in a ~1300px panel, leaving 350–500px of dead space, and in the default My-class view only ~5 short rows render. Amplifiers: no podium/celebration for the top 3, thin low-contrast rows, no header stats band, and no sense of progress. The biggest opportunity is to turn the wasted right-hand space into a **podium + stats rail** and give the top of the board an aspirational payload.

## What's Working

1. **"You" is unmistakable** — brand-orange border + tinted fill on `.lrow.you`, echoed by the `your-rank` pill. Self-location is instant.
2. **Privacy-safe by construction** — first-name + initial with letter avatars, consistent with the Gallery. Correct for minors.
3. **Clean scoping model** — Class/Everyone × All-time/Week is the right classroom mental model, with legible segmented-control state.

## Priority Issues

- **[P0] Board floats in a wide empty panel.** `.board` caps at 820px with no `margin-inline:auto`, left-aligned in a full-width page → 350–500px of dead space on the right, and only ~5 rows in the default view. This is the single biggest driver of "empty." **Fix:** center the board AND fill the reclaimed space with a right rail (top-3 podium, this-week stats, your progress-to-next-rank), or go two-column. → `/impeccable layout`

- **[P0] No podium / no celebration for the top 3.** Ranks 1–3 differ from rank 7 only by a recolored medal glyph in a 34px cell. The aspirational payload of a kids' leaderboard is flattened. **Fix:** a podium band above the list — three pedestals (1st taller), larger avatars, medal + XP + Level, orange accent on #1, subtle entrance motion. Consumes the P0 dead space too. → `/impeccable delight` (then `/impeccable animate`)

- **[P1] Broken empty state at 0 XP.** The "Finish lessons to earn XP" CTA is concatenated *above* a fully populated sample board that already includes the user's own 0-XP row in last place — message and board contradict each other. **Fix:** a real state machine — at 0 XP show an aspirational onboarding state (teaser rows + "Start a lesson" CTA), omit or reframe the 0-XP self-row. → `/impeccable onboard`

- **[P1] Rows are thin and low-contrast.** `.lrow` panel `#0f2440` on bg `#0a1728` is a tiny luminance step; 12px padding, 34px avatar, 5px bar → the list reads faint and sparse. **Fix:** taller rows, larger avatars, ~8–10px bar, raise row/bg contrast, add hover like `.gcard`. → `/impeccable layout`

- **[P2] No summary band and no sense of progress.** `.phead` is just a title + one line; every `.lbar` is normalized to the leader, so bars echo ranking you can already read instead of showing progress. **Fix:** a 3–4 KPI strip (Your rank, Your XP, XP to pass #next, Class total this week) and re-anchor the "you" bar to next-level/next-rank with a caption ("+180 XP to pass Sam K."). → `/impeccable layout`

## Persona Red Flags

**Jordan (first-timer)** — fails hardest, directly on the complaint. Lands on My class / All-time, sees ~4 peers at 1,900–4,200 XP and *themselves last at 0 XP with an empty bar*, while a "Finish lessons" message floats confusingly above that board. No explanation of how XP is earned, no reachable next step. Takeaway: discouragement + confusion, on a mostly-empty screen.

**Sam (accessibility)** — concrete failures: (1) ranks 1–3 replace the number with an icon-font medal glyph and no text alternative — screen readers announce no rank for the podium; (2) `.seg` toggles have no `aria-pressed`, selected state is color-only; (3) `.lbar` has no `role="progressbar"`/`aria-valuenow`; (4) `.seg button` is ~28px tall (under 44px) with no visible focus-visible style.

## Minor Observations

- Default `class` scope filters the sample to ~5 rows — looks emptier on load than "Everyone" would; consider the default or seed more classmates.
- XP needs thousands separators (`4,200 XP`), and the Level rule (`xp/1000`) is never shown.
- Same glyph for gold/silver/bronze misses a cheap hierarchy win.
- No motion anywhere on a screen fundamentally about competition and movement.
- Alex (power user) hits a 7-row ceiling with no depth — low priority for this age group.

## Questions to Consider

1. If a 10–15-year-old opens this and sees themselves dead last at 0 XP, what makes them come back tomorrow?
2. The economy runs on **Stars** but the board ranks on **XP** — which number are you actually asking kids to compete on?
3. The board caps at 820px in a 1300px panel — accident, or a right rail that was designed and never built?
4. Should a classroom board for kids sort strictly by total XP (which freezes newcomers at the bottom), or add "most improved this week"?
