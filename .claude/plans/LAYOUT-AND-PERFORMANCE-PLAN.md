# Layout & performance: audit findings and the plan

**Target:** the whole web app — `app/public/index.html`, `styles.css`, `js/*.js`
**Date:** 17 August 2026
**Method:** every number below was measured in a real browser against the running app at
1920×1080, 1366×768, 1024×768 and 820×700, plus the bundled mechanical detector. Nothing here is
estimated from reading the source.

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | **2**/4 | `--dim` fails WCAG AA on all six backgrounds it is used on (2.83–3.97:1) |
| 2 | Performance | **1**/4 | 3.78 MB of JavaScript in 37 render-blocking `<script>` tags; ~3 MB of it is unused on the Learn tab |
| 3 | Responsive design | **1**/4 | 600 px of side chrome never yields; two real media queries in 607 lines of CSS |
| 4 | Theming | **2**/4 | 176 raw hex literals against 20 tokens; three of them are hand-typed duplicates of tokens that already exist |
| 5 | Implementation integrity | **3**/4 | Coherent and product-specific; 8 detector findings, all minor and isolated |
| | **Total** | **9/20** | **Poor band by the rubric — but concentrated** |

The score is harsher than the app looks, and that is the useful part of it. Two dimensions
(performance, responsive) carry 6 of the 11 lost points, and neither is a design problem. The
visual identity is genuinely good and is **not** what needs changing.

### Implementation integrity verdict — **PASS**

This is a specific product, not a template. The dark engine-shell palette, the module accent
colours, the XP/Stars footer, the three-tab Learn/Code/Play spine, and the quiz card language are
all things only this product would have. The detector's 8 findings (5 × side-tab accent border,
1 × border-accent-on-rounded, 2 × `transition: width`) are real but cosmetic, and two of them —
`.lesson h2` and `.lesson blockquote` — are deliberate typographic choices, not drift.

---

## Executive summary

Issue counts: **4 P0 · 7 P1 · 6 P2 · 4 P3**

**Top five:**

1. **P0 — 3.78 MB of blocking JavaScript on every page load.** `jshint.js` (1,256 KB),
   `assets-manifest.js` (983 KB), Prettier (755 KB) and the full Material Design Icons font+CSS
   (733 KB) all load before the first lesson paints. None carries `defer` or `async`
   (`index.html:138-174`). A student who opens a lesson and reads it uses **none** of the first
   three. Total first load: **5.1 MB across 250 requests.**
2. **P0 — the app has no responsive behaviour and breaks below ~1000 px.** `.editor` is
   `grid-template-columns: 280px 1fr 320px` (`styles.css:31`) with no breakpoint. Measured
   centre-column width: 1320 px at 1920, **766 px at 1366**, **424 px at 1024**, **220 px at 820**
   — at which point the Learn/Code/Play tabs (236 px) overflow their 220 px bar and are clipped by
   `body { overflow: hidden }`. The whole file contains one layout media query, and it is for the
   leaderboard.
3. **P0 — `--dim` fails WCAG AA everywhere it is used.** `#5f758f` measures 2.83:1 on `--panel2`,
   3.05:1 on `--head`, 3.29:1 on `--panel`, 3.97:1 on `#08121f`. AA small text needs 4.5:1. It is
   used 20 times, including both dock headers, the entire status bar, every quiz option number
   badge, every Parsons position number, the cursor-position readout and the store asset keys.
4. **P1 — the Store fires 233 image requests at once,** none with `loading="lazy"`, none with
   `width`/`height` (`pages.js:39`). This is the heaviest single moment in the app and the one
   most likely to fall over on a shared school connection.
5. **P1 — reading measure is wrong at both ends.** `.lesson-content` is `max-width: 820px`
   (`styles.css:147`) at `font-size: 16.5px`. Measured: **92 characters per line at 1920** (target
   45–75, and nearer 55–65 for 11–14-year-olds) and **~42 characters at 1024**, where the docks
   have squeezed it to 334 px of text.

---

## Detailed findings

### P0

**[P0] Render-blocking bundle**
*Location:* `index.html:138-174` · *Category:* Performance
*Impact:* 3.78 MB parsed synchronously before anything renders. On localhost this is 377 ms; on a
filtered school Wi-Fi with 25 students booting at once it is the difference between "the app is
slow" and "the app is broken". Measured breakdown:

| File | Transferred | Needed for |
|---|---|---|
| `vendor/jshint/jshint.js` | 1,256 KB | Code tab linting only |
| `assets-manifest.js` | 983 KB | Store only |
| `vendor/prettier/*` (2 files) | 755 KB | Code tab formatting only |
| `vendor/mdi/*` (font + CSS) | 733 KB | 71 icons actually used |
| `vendor/codemirror/*` | ~500 KB | Code tab, run cells, challenges |

*Recommendation:* Stage A below. *Command:* `/impeccable optimize`

**[P0] Fixed side chrome, no breakpoints**
*Location:* `styles.css:31`, `ui.js:24-25` · *Category:* Responsive
*Impact:* The two docks claim a constant 600 px. At 1366×768 — a very common school Chromebook —
that is 44 % of the screen before any content. At 1024×768 it is 59 %, and the Play tab renders
the 800×600 game at roughly 392×294. The resizer floors (`Math.max(280, …)`, `Math.max(320, …)`)
mean a student cannot reclaim the space manually either. *Command:* `/impeccable adapt`

**[P0] `--dim` fails AA on every background**
*Location:* `styles.css:3` (definition), 20 usages · *Category:* Accessibility · *Standard:* WCAG 2.2 AA 1.4.3
*Impact:* All 20 usages are 10–13 px text, which needs 4.5:1. Verified replacement: **`#8b9db1`**
clears it on all six backgrounds (worst case 4.83:1 on `--panel2`, best 6.77:1 on `#08121f`).
*Command:* `/impeccable audit` → fix in Stage C

**[P0] No document landmarks**
*Location:* `index.html:23-136` · *Category:* Accessibility · *Standard:* WCAG 2.2 A 1.3.1
*Impact:* Measured: zero `<header>`, `<nav>`, `<main>`, `<aside>` or `<footer>` elements in the
whole document. A screen-reader user has no way to jump to the lesson, the outline or the
assistant — they must tab through all 57 outline buttons to reach the content. The tree itself was
fixed properly in an earlier pass; the shell around it was not. *Command:* `/impeccable harden`

### P1

**[P1] Store loads 233 images eagerly with no intrinsic size**
*Location:* `pages.js:39`, `pages.js:52-57` · *Category:* Performance
*Impact:* 233 simultaneous requests and 233 layout shifts. Fix is two attributes.

**[P1] Reading measure too wide above 1440, too narrow below 1300**
*Location:* `styles.css:147` · *Category:* Layout
*Impact:* 92 chars/line at 1920, 84 at 1366, 42 at 1024. None of these is a comfortable measure for
the target age. *Command:* `/impeccable layout`

**[P1] Three brand images ship at 100–1700× the pixels they render**
*Location:* `index.html:106, 25, 129` · *Category:* Performance
*Impact:* Measured natural vs rendered: `clearRobotRing4.png` 480×611 → **20×20** (90 KB);
`wordmark.png` 2887×770 → **82×22** (30 KB); `bolt.png` 540×540 → **13×13** (24 KB). 144 KB that
should be about 6 KB.

**[P1] Boot fetches 47 lesson files individually**
*Location:* `course.js:27` · *Category:* Performance
*Impact:* 47 parallel requests before the outline can render, to display one lesson.

**[P1] `.ai-collapse` is an 18×18 px target**
*Location:* `styles.css:469-470` · *Category:* Accessibility · *Standard:* WCAG 2.2 AA 2.5.8 (24×24 minimum)
*Impact:* Measured 18×18. This is the only control that hides the assistant panel.

**[P1] Four different content widths across five pages**
*Location:* `styles.css:147` (820), `:297` (1080), `:378` (820), `:233` (`.page`, unbounded)
*Impact:* At 1920 the Store grid is 1822 px wide with six columns while the Docs page next to it
caps at 820. Same app, no shared rule. *Command:* `/impeccable layout`

**[P1] `prefers-reduced-motion` covers 2 animations out of ~20 moving things**
*Location:* `styles.css:207, 452` · *Category:* Accessibility · *Standard:* WCAG 2.2 AAA 2.3.3 / A 2.2.2
*Impact:* The loading spinner and the quiz verdict are guarded. The card hover lifts
(`translateY(-4px)`, `styles.css:279`), the leaderboard row lift, the toast slide, the progress-bar
fill and the console chevron rotation are not.

### P2

**[P2] `volSlider` has no accessible name** — `index.html:96`. It is an `<input type="range">` with
no label, `aria-label` or placeholder.

**[P2] 25 distinct font sizes** — including 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16,
16.5, 17. Seven steps within 6 px of each other is not a scale, it is per-component guessing.

**[P2] 25 distinct spacing values** — 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18,
20, 22, 26, 28, 34, 40, 44, 50 px. The odd values (3, 5, 7, 9, 11, 13, 15) are ~30 % of all uses.

**[P2] 12 distinct border radii** — 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 999.

**[P2] 176 raw hex literals against 20 tokens** — eight of them are de-facto tokens that were never
named (`#08121f` ×15, `#cfe0f2` ×14, `#0d2440` ×14, `#c3d3e6` ×10, `#06192e` ×8, `#cfe6ff` ×7,
`#12304f` ×6, `#122c4c` ×5), and three are hand-typed duplicates of tokens that already exist
(`#eaf1f8` = `--ink`, `#0f2440` = `--panel`, `#0a1728` = `--bg`).

**[P2] `transition: width` on two progress bars** — `styles.css:368, 554`. Detector-confirmed;
animates a layout property. `transform: scaleX()` is the same effect without the reflow.

### P3

**[P3] Five side-tab accent borders** — `styles.css:153, 159, 385, 456, 488`. Detector-flagged as
an AI-UI tell. Two are deliberate (`.lesson h2`, `.lesson blockquote`) and should stay; the toast
and the chat quiz card could drop theirs.

**[P3] `.challenge-mini` has a 3 px top border on a 12 px-radius card** — `styles.css:582`. The
straight border and the rounded corner fight at the two top corners.

**[P3] `.dock.left` overflows by 3 px at 1024** — measured `scrollWidth` 282 vs `clientWidth` 279.

**[P3] Icon font ships 3.8 MB of library for 71 icons.** Counted across `index.html` and all of
`js/`. Folded into Stage A2.

---

## Patterns & systemic issues

1. **Every fix so far has been made at the component, never at the system.** The quiz card,
   the challenge card and the button roles were each done well and each introduced their own
   sizes, spacings and radii. The result is 25 font sizes and 25 spacing values — not from
   carelessness, but from six good passes with no shared scale to land on.
2. **The desktop layout was designed once, at one width, and never revisited.** Everything else
   in the app adapts (cards reflow, the outline wraps, the lesson column centres). The shell does
   not, and the shell is what decides how much room everything else gets.
3. **"Vendor it locally" was the right call for the school network and was applied uniformly** —
   including to four libraries that two tabs need and 45 lessons do not. The constraint was
   correct; the granularity was not.

## Positive findings

- **The token layer exists and is real.** 20 named custom properties covering colour, type, focus
  and layout widths; `--leftw`/`--rightw` are already driven through the cascade rather than
  through inline styles, which is exactly what makes Stage B cheap.
- **The outline tree is properly accessible** — `role="tree"`, roving `tabindex`, arrow-key
  traversal, `aria-current`, `aria-disabled`, `sr-only` state text. This is better than most
  production apps manage.
- **`:focus-visible` is defined globally** at `styles.css:5` with a real 2 px ring and an offset.
- **Zero console errors** across boot, all five pages and all three tabs.
- **Zero horizontal document overflow** at every width tested, including 820.
- **Sanitisation is consistent** — `mdToSafeHTML` and `esc()` are used everywhere user or content
  strings reach the DOM.
- **The Play stage already listens to `resize` and refits** (`game-runner.js:67-72`), so Stage B
  needs no new code there.

---

# The plan

Four stages, ordered by value per unit of risk. **A and C are the ones that matter.** Each stage
is independently shippable and independently revertable.

## Stage A — Weight

*Nothing visual changes. Target: 5.1 MB / 250 requests → ~0.9 MB / ~20 requests on first load.*

**A1. Load the Code-tab libraries on first entry to the Code tab.**
Move `jshint.js`, both Prettier files and the CodeMirror lint/hint/fold/search addons out of
`index.html` and behind a one-time loader called from `switchView('code')`. Keep
`codemirror.js` + the JavaScript mode eagerly — run cells and challenges are on the Learn tab.
Saves ~2.0 MB. Show the existing skeleton while it loads; it is a one-time ~200 ms cost the first
time a student opens Code, and free afterwards.

**A2. Load `assets-manifest.js` on first entry to the Store.**
It is 983 KB and only `pages.js` reads it. Same loader. Saves 983 KB.

**A3. Subset the icon font.**
71 icons are used. Generate a subset webfont from that list, or convert to an inline SVG sprite.
Either way ~733 KB → ~10 KB. Add a `check-icons` script so an icon added to a lesson without being
added to the subset fails loudly rather than rendering a blank box.

**A4. Resize the three brand images.** 144 KB → ~6 KB. Emit `@1x`/`@2x` and set explicit
`width`/`height` so they reserve their box.

**A5. Store images: `loading="lazy"` + explicit `width`/`height`.** Two attributes in `pages.js:39`.
233 requests → about 20 on first paint, and zero layout shift.

**A6. Serve the lesson corpus as one index.**
Add a build-free `/api/lessons` that returns front-matter for all 47 in one response; fetch a
lesson body only when it is opened. 48 requests → 2.

**Verify:** re-measure `performance.getEntriesByType('resource')` at boot, on the Code tab and on
the Store; assert first-load transfer under 1 MB and request count under 25.

## Stage B — Fit

*The layout problem. Preserves the visual world exactly; changes only how much room each region gets.*

**B1. Introduce a content-width token** and use it for all four content regions:
`--measure: 68ch` for prose, `--page-max: 1200px` for the full-page views. Replaces the 820 /
820 / 1080 / unbounded set.

**B2. Cap and floor the reading measure.**
`.lesson-content { max-width: var(--measure); }` at 16.5 px lands at ~64 chars/line instead of 92.
Below that, the centre column becomes the binding constraint — which is what B3 fixes.

**B3. Make the docks yield.** Three breakpoints, no new components:

| Viewport | Left dock | Right dock | Centre |
|---|---|---|---|
| ≥ 1440 | 280 px | 320 px | ≥ 840 px |
| 1180–1440 | 260 px | collapses to the existing `.ai-fab` | ≥ 560 px |
| < 1180 | overlay, opened from a new outline button in the view bar | `.ai-fab` | full width |

The `.ai-fab` and the collapse mechanism already exist (`index.html:39`, `styles.css:471`); this
stage gives them a reason to fire automatically instead of only on click. The left dock overlay is
the only genuinely new piece.

**B4. Let the resizer floors follow the breakpoint** rather than being hard-coded to 280/320 in
`ui.js:24-25`, so a student on a 1280 screen can actually reclaim the space.

**B5. Make the view bar survive narrow.** At the narrowest tier the Learn/Code/Play tabs drop their
labels to icons with `aria-label`, which removes the clipping measured at 820.

**Verify:** re-measure the centre column and characters-per-line at 1920 / 1440 / 1366 / 1280 /
1024 / 820; assert 45 ≤ chars/line ≤ 75 at every one, and no clipped controls.

## Stage C — Contrast and semantics

*Cheap, high-impact, and the part that is a compliance question rather than a taste question.*

**C1.** `--dim: #5f758f` → **`#8b9db1`**. Verified ≥ 4.83:1 on all six backgrounds. One line.
**C2.** Wrap the shell in real landmarks — `<header>` (topbar), `<nav>` (topnav), `<main>` (centre),
`<aside>` × 2 (docks), `<footer>` (statusbar) — plus a skip-to-lesson link as the first focusable
element.
**C3.** `.ai-collapse` → 24×24 minimum hit area, glyph size unchanged.
**C4.** `aria-label="Game volume"` on `volSlider`.
**C5.** One global `@media (prefers-reduced-motion: reduce)` block that neutralises transform and
opacity transitions app-wide, replacing the two per-component guards. Per the audit rubric this
must **preserve** state change and hierarchy, not blanket-kill to `0.01ms` — so hover lifts become
a border-colour change rather than nothing.

**Verify:** recompute all 19 contrast pairs; re-run the landmark and target-size probes; confirm
`prefers-reduced-motion` leaves every state still legible.

## Stage D — System hygiene

*Do this last. It is the one stage that touches every file and returns nothing a user can see —
its value is that it stops Stages A–C from drifting apart again.*

**D1.** Spacing scale on a 4 px base: 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48. Migrate the odd values.
**D2.** Type scale, 8 steps: 11 · 12 · 13 · 15 · 16.5 · 20 · 28 · 32. Migrate the 17 others.
**D3.** Radius scale, 4 steps: 6 · 8 · 12 · 999.
**D4.** Name the eight de-facto colours; replace the three hand-typed token duplicates.
**D5.** Clear the detector: drop the toast and chat-card side tabs, resolve the rounded-card top
border, and convert the two `transition: width` bars to `transform: scaleX()`.
**D6.** Then run `/impeccable document` to write DESIGN.md, so the next pass has a written system
to build on instead of re-deriving one from the CSS.

**Verify:** `node <skill>/scripts/detect.mjs --json app/public` returns zero unexplained findings.

---

## Out of scope

- **The visual identity.** The palette, the engine-shell metaphor, the module accents and the card
  language stay exactly as they are. Nothing in this plan is a redesign.
- **Content.** No changes to `app/content/**` or `course.yaml`.
- **The AI system.** Stages 0–5 of `AI-IMPROVEMENT-PLAN.md` are untouched.
- **Phone layouts.** The app declares a viewport meta and a webmanifest, but a 375 px phone is a
  different product decision, not a bug fix. Stage B stops at ~820 px, which is where the app
  currently breaks.

## Suggested order

1. **`/impeccable optimize`** — Stage A. Biggest measurable win, zero visual risk.
2. **`/impeccable harden`** — Stage C. Contrast, landmarks, targets, motion. Cheap and it is the
   compliance answer if anyone asks.
3. **`/impeccable adapt`** — Stage B. The real layout work.
4. **`/impeccable layout`** + **`/impeccable typeset`** — Stage D scales.
5. **`/impeccable polish`** — final pass.
6. **`/impeccable audit`** — re-score. Target ≥ 16/20.
