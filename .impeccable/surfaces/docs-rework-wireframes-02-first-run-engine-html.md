---
version: 1
slug: "docs-rework-wireframes-02-first-run-engine-html"
primary_target: "docs/rework/wireframes/02-first-run-engine.html"
related_targets: []
---

# Surface brief: the first run, engine-styled

Scope: the first run ("Your first day at the studio"), drawn in the chosen visual world at
1366×768. Mode: Experience. Product brief: docs/rework/briefs/first-run.md (v2, confirmed).
Audience, job and constraints: PRODUCT.md. Structural predecessor: docs/rework/wireframes/01-first-run.html.

Decisions: resemble Unity (Jay, pinned; overrides the degraded roll); new world keeping the League
brand; the Inspector opens only when a part is selected, sharing the right side with the mentor.

## Direction contract

THESIS: A real Unity editor, cut down to what a 10–13-year-old first-timer needs. Every panel kept
keeps its real Unity name; every tool a beginner wouldn't use is removed or repurposed for the
course. Refuses both the candy kid-app layout and the full adult editor dump.

OWN-WORLD: Unity's dark editor greys — charcoal ground, graphite panels, hairline separators, tab
headers carrying real panel names — with League orange replacing Unity's selection blue as the one
accent (Play active, selection, the kid's options). System UI type at kid size (15–16px body),
icon-plus-word controls, 44px targets, one authored inline-SVG icon set at a single stroke weight.
The kid's game is the brightest, most colourful thing on screen.

STORY: I'm the new developer at a studio; this is a real engine; my game is in the middle; the
mentor tells me one thing at a time and I answer by tapping.

FIRST VIEWPORT: Toolbar with Play / Pause / Step centred. Left column: a compact Quest panel over
the Hierarchy. Centre: the Game tab, the game filling it. Right: the mentor (Inspector slides over
its lower half when a part is selected). Bottom: a collapsed Project drawer (your cards) and a
status bar with quiet stars. Primary action: the mentor's options, lower right.

FORM: user-pinned "resemble Unity, strip or repurpose unused tools" — #2 on my ordered list —
overriding the degraded roll; seed key 4c443f9e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Rasters

- The League wordmark in the toolbar: `app/public/img/wordmark.png` (existing League brand asset, not generated), embedded as a data URI so the file renders on its own.
