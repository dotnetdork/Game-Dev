# Lesson design review — appearance, delivery, and what to do next

A critique of the 22 lesson pages as a **Read** surface: the student is here to understand
something, so comprehension outranks expression and the reading experience has to be worth staying
in. Everything below is measured in a real browser against `npm start`, not eyeballed. Numbers are
reproducible; the probes are described so they can be re-run.

## Score

| Dimension | Score | One-line verdict |
|---|---|---|
| Colour and contrast | **9 / 10** | 37 of 37 text styles pass WCAG AA; tightest 5.24:1 |
| Vertical rhythm | **7 / 10** | Disciplined and intentional, with two ambiguities |
| Type hierarchy | **4 / 10** | 13 font sizes, 31 treatments; lists and quiz options set below body |
| Reading measure | **8 / 10** | The two-width system is a real idea, consistently applied |
| Pacing / delivery | **4 / 10** | ~6 screens per lesson, first activity 39% down, 9-block prose runs |
| Orientation | **4 / 10** | No progress cue anywhere in a 4,700px page until the very end |
| Responsive | **2 / 10** | No phone layout: the page scrolls sideways at 375px |
| Activity identity | **8 / 10** | Label + colour + stripe reads clearly and scales to four kinds |

---

## What is genuinely good, and should not be touched

**Contrast is better than most shipped products.** 37 distinct text styles measured with proper
alpha compositing down to the page background: **zero failures**. The tightest is `.block-kind` and
`.block-link` at 5.24:1 against a 4.5 requirement. The muted and dim greys that *look* risky on a
dark ground measure 6.5–8.3:1. Nothing here needs changing, and it is worth knowing that before
anyone "improves" the palette.

**The heading-binding rhythm is right, and is the thing most sites get wrong.** A heading sits
**10px** above the paragraph it introduces, while two paragraphs sit **18px** apart. That means a
heading visually belongs to what follows rather than floating between sections. Most projects set a
big margin above *and* below a heading and lose the relationship entirely.

**The two-width reading system works.** Prose at 540px (~68 characters), blocks and figures at
780px, everything sharing one left edge. It gives diagrams room without strangling the paragraphs,
and it is applied consistently enough to read as a rule rather than an accident.

**Activity blocks now announce themselves.** Label, kind-colour and the left stripe together mean a
student scrolling fast can tell Quiz from Lab from Practice without reading a word. That scales to a
fourth and fifth kind without redesign.

---

## Finding 1 — The type scale has drifted into 13 sizes

**Measured:** one lesson (`the-core-loop`) renders **31 distinct combinations** of
size/weight/line-height/colour, across **13 distinct font sizes**: 34, 21, 20, 17, 16.5, 15, 14.5,
14, 13.5, 13, 12.5, 12, 11.5.

That is not a scale, it is accumulation. Three specific consequences, in order of how much they
cost a student:

**1a. Bullet lists are set smaller than prose.** `li` is 14.5px against `p` at 16.5px. Every
lesson's **Recap** is a `ul` — so the most re-read, most revision-critical part of every lesson is
set two points smaller than the paragraphs a student reads once. The hierarchy is inverted.

**1b. Quiz options are set smaller than prose.** `.mcq-opt` is 15px. The text a student must read
most carefully — the one place where misreading a word costs them the answer — is smaller than the
body text around it.

**1c. Four sizes are doing one job.** `.ch-task` 15, `.yt-task` 15, `figcaption` 14, `.ch-note`
12.5 are all "supporting prose inside a block". They differ because they were written at different
times, not because they mean different things.

**Recommendation.** Collapse to six steps and hold the line:

| Step | Size | Job |
|---|---|---|
| Display | 34px | Lesson title only |
| Section | 21px | `h2` |
| Block | 20px | `.block-title` |
| Body | 16.5px | `p`, **`li`**, **`.mcq-opt`**, `.ch-task`, `.yt-task`, blockquote |
| Support | 14px | captions, credits, hints, notes |
| Micro | 12px | labels, chips, option numbers |

The single highest-value line in this whole document is putting `li` and `.mcq-opt` at body size.

---

## Finding 2 — The wall of text is real and measurable

Averaged across all 22 lessons:

| Metric | Average | Worst |
|---|---|---|
| Words | 876 | 1,011 (`ship-it`) |
| Reading time | 4.9 min | 5.6 min |
| Page height | 4,744px ≈ **6 screens** | 5,746px (`data-out-of-code`) |
| First activity appears | **39% down** | **59% down** (`risk-and-reward`) |
| Longest unbroken prose run | **9.1 blocks** | 12 blocks (`game-state`, `events-not-tangles`, `sprites-and-animation`) |
| Activities per lesson | 4.2 | — |

A student opening `risk-and-reward` scrolls roughly **2,800 pixels** — three and a half screens —
before anything asks them to do something. Twelve consecutive prose blocks is the definition of the
feeling being complained about.

**The fix already exists in the course.** `decisions-and-repeats` is the outlier in the right
direction: first activity at **10% down**, longest prose run **4 blocks**, **7 activities**. It is
not shorter or thinner than the others — it is *interleaved*. So the target shape is a known-good
in-house example, not an invention.

**Recommendation.** Two authoring rules, enforced by `check-lessons.js` the way the badge and
figure rules already are:

- **No more than 6 consecutive prose blocks** without a figure, run cell, quiz or callout.
- **The first activity within the first 25%** of a lesson.

Both are mechanical to check and would flag 18 of 22 lessons today. That is a content pass, not a
code change — but the checks make it finite and visible rather than a vague ambition.

---

## Finding 3 — There is no phone layout, and the page scrolls sideways

At a 375px viewport the document is **770px wide**. The page scrolls horizontally, which on a
reading surface is the single most damaging layout failure there is.

**Root cause, located precisely.** `body` is `display: grid` and its track resolved to **769px
inside a 375px body**. A grid track defaults to `auto`, whose minimum is the content's min-content
width, so the widest unbreakable child inflates the track and every ancestor with it. `.editor`
does the same thing at `0px 769.031px 0px`.

**Verified fix.** Applying `grid-template-columns: minmax(0, 1fr)` to `body` and
`0 minmax(0,1fr) 0` to `.editor` collapsed `.lesson-content` from **769px → 375px** immediately.
This is the standard grid-blowout fix and it is a two-line change.

**What remains after that fix** is chrome, not lessons — the document was still 753px because these
rows do not wrap:

- `nav.topnav` (Game Dev / Courses / Store / Gallery / Leaderboards) — 389px, running to x=576
- `nav.topright` (Docs / Help) — 590→741
- `.sb-mid` and `.sb-right` in the status bar — 136→524 and 540→753

**Tap targets.** On a touch viewport, everything interactive in the chrome is under the 44px
minimum: `.navitem` 29px tall, `.vtab` 27px, `.outline-btn` 30×26, `.block-link` 24px. The quiz
options are fine at 44px, and the block buttons at 41px are borderline.

**Framing this honestly:** the tier system's narrowest tier is `narrow` (< 1180px), which was
designed for Chromebook widths and does that job. There has never been a phone tier. If phones are
in scope for testing, this is its own piece of work; if they are not, the grid-blowout fix is still
worth taking because it is two lines and removes a whole class of future surprise.

---

## Finding 4 — Six screens of scrolling with no sense of progress

The lesson progress strip sits at **5,046px** — the very bottom. There are **no sticky or fixed
elements inside the lesson view at all**. So for six screens a student has no answer to "how much
of this is left?" except the browser scrollbar, and no reward for having got two-thirds through.

The breadcrumb in the view bar does keep them oriented as to *where* they are, which is the harder
half. What is missing is *how far*.

**Recommendation.** A 2px progress rule pinned under the view bar, filling as the lesson scrolls,
plus the activity count ("2 of 4 done") moved into that same sticky strip rather than living only at
the bottom. Cheap, unobtrusive, and it turns a long page into a measurable one.

---

## Finding 5 — Two smaller things

**5a. The hero costs a third of the first screen.** 212px tall, with reading beginning at 256px —
about 26% and 32% of an 800px view. For a title, a one-line summary and two chips that is generous.
Tightening it is the cheapest screenful available.

**5b. A figure between two sections has ambiguous ownership.** `figure → h2` is 38px and
`block → block` is 36px. Nearly identical, so a figure sitting between a quiz and the next heading
reads as belonging to neither. Widening the pre-heading gap to ~48px would make section boundaries
unambiguous.

---

## Implementation plan

Ordered by payoff per unit of effort. Each phase is independently shippable and independently
verifiable.

### Phase 1 — Type scale (half a day, highest payoff)

Collapse 13 sizes to the six-step scale above. `li` and `.mcq-opt` to body size is the change a
student would notice first. Retire `.ch-task` / `.yt-task` / `.ch-note` as separate sizes.

*Verify:* re-run the type-scale probe — distinct sizes should drop from 13 to 6 and treatments from
31 to roughly 12. Confirm `li` and `.mcq-opt` both measure 16.5px. Re-run the contrast probe and
confirm still 0 failures, since changing sizes moves the large-text threshold.

### Phase 2 — Grid blowout (one hour)

`minmax(0, 1fr)` on the `body` and `.editor` grid tracks. Add `overflow-x: auto` to tables and
`pre` inside a lesson so wide content scrolls itself instead of stretching its parent.

*Verify:* at 375px, `documentElement.scrollWidth` must equal `clientWidth`. Confirm nothing regresses
at the wide, mid and narrow tiers.

### Phase 3 — In-lesson progress (half a day)

A sticky 2px fill under the view bar, with the activity count beside it.

*Verify:* the strip is present and visible from scroll position 0; it reaches 100% at the bottom of
the content, not the bottom of the document; it does not overlap the breadcrumb at any tier.

### Phase 4 — Pacing checks, then the content pass (checks: half a day; content: ongoing)

Add the two rules to `check-lessons.js` as **warnings first**, reporting the 18 lessons that fail,
then work through them and flip to hard failures once the list is empty. Interleaving means
promoting existing prose into callouts and adding short run cells — not writing new lessons.

*Verify:* the check reports per-lesson longest-prose-run and first-activity-depth; every lesson
reaches ≤ 6 and ≤ 25% before the rule becomes fatal.

### Phase 5 — Phone tier (2–3 days; only if phones are in scope)

A fourth tier below ~700px: the top nav collapses to a menu, the status bar drops to essentials,
tap targets go to 44px, `.block-hd` stacks (it already does, at 720px).

*Verify:* no horizontal scroll at 375px and 320px; no interactive target under 44px; a lesson is
readable and every activity completable on a touch viewport.

### Phase 6 — Hero and section boundaries (two hours)

Tighten the hero; widen the pre-heading gap to ~48px.

*Verify:* reading begins within the first 20% of the first screen; `figure → h2` is visibly larger
than `block → block`.

---

## What this review deliberately does not propose

- **No palette change.** Contrast is measured good; changing it risks a 9/10 to fix nothing.
- **No new visual identity.** The stripe-and-label system is working and is two commits old.
- **No lesson rewrites.** Every pacing problem is solvable by interleaving what is already written.
- **No animation.** On a Read surface with 876 words per page, motion is a cost until the
  fundamentals above are fixed.
