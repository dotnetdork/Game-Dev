# Layout critique — and does this read as a game engine?

Two questions in one: is the layout right inside the lessons and the labs, and does the overall
structure carry the familiarity of Unity or Godot. Measured in a real browser, structure inspected
from the live DOM.

## The short answer

**The skeleton is already an engine. Two axes are fused that engines keep apart, and the lab bench
has already solved the problem the main shell still has.**

Structurally this is closer than it probably feels. Every panel is in the slot an engine would put
it in. What is missing is not more panels — it is one control and one panel that engines have and
this does not.

## Structure, side by side

| Unity / Godot / GameMaker | Game Dev today | Verdict |
|---|---|---|
| Menu bar — File, Edit, Assets, Window | Web nav — Courses, Store, Gallery, Leaderboards | Different **on purpose**; leave it |
| Toolbar with centred transport: **Play / Pause / Step** | **No transport. "Play" is a view tab** | The one real gap |
| Hierarchy panel, left | Course Outline, left — Learn only | Right slot, wrong exclusivity |
| Project / Assets browser | Files, left — Code only | Right slot, wrong exclusivity |
| Scene / Game tabbed in the centre | Learn / Code / Play tabbed in the centre | Correct |
| **Inspector**, right | AI Assistant, right | Deliberate swap; no Inspector exists at all |
| Console docked at the bottom | Console docked at the bottom, collapsible | Correct |
| Status bar | Status bar — badges, Stars, XP, level | Correct slot, game-flavoured content |
| Panels dock, tab and rearrange | Resizable only (`resLeft`, `resRight`) | **Deliberately not worth building** |

Eight of ten slots already match. That is the part worth knowing before changing anything.

---

## Finding 1 — "Play" is a tab, not a transport. This is the one that matters.

In every engine, **which view am I looking at** and **is the game running** are two independent
axes. Scene / Game is a view tab. Play / Pause / Step is a transport, and it lives in the toolbar,
usually dead centre, because it is the most-pressed control in the product.

Here they are fused into one control. Pressing **Play**:

- switches which panel you are looking at, **and**
- starts the game,

and there is no pause, no stop, no step, and **no way to see your code while the game runs.**

Two costs. Structurally it is the most engine-unlike thing in the app. Practically it is worse: a
student debugging how their player moves wants the code and the running game visible at the same
time. That is the single most common thing anyone does in an engine, and the main shell cannot do
it.

The app already knows this, because the lab bench does exactly the right thing (Finding 4).

---

## Finding 2 — The left dock is one panel wearing three hats

Measured, by view:

| View | Left dock says | Left dock holds |
|---|---|---|
| Learn | Course Outline | `panel-outline` |
| Code | Files | `panel-files` |
| Play | Game Info | `panel-info` |

Three different panels, mutually exclusive, switching implicitly when the centre view changes.
Engines show Hierarchy **and** Project at the same time because you need both at once. A student in
the Code view who wants to re-read what the lesson asked has to leave the Code view to do it.

The dock is also the natural home for something the lessons badly need. A lesson is about six
screens tall and there is no way to jump within it. **Course Outline → current lesson → its
sections** is a hierarchy in the exact sense an engine means it, and it would fix orientation in a
long page while making the panel more engine-like, not less.

---

## Finding 3 — There is no Inspector, and it is the cheapest engine win available

The Inspector is the most recognisable panel in any engine: select a thing, see its properties, edit
them, watch the result. This app has no equivalent. `Game Info` shows the CONFIG numbers on the Play
view, **read-only**.

Everything needed already exists:

- `parseConfig()` reads the numbers ([project.js:97](../app/public/js/project.js))
- `mergeConfig()` writes them back ([project.js](../app/public/js/project.js))
- run cells already ship working sliders, so the interaction is proven in this codebase

Making Game Info an editable Inspector — sliders for `moveSpeed`, `jumpPower`, `gravity`,
`coinBounce` that write through `mergeConfig` and re-run the game — is the **highest engine-feel per
hour available anywhere in this app**. It also teaches the thing the course keeps asserting: numbers
are data, not code. A student dragging gravity and watching the jump change learns
`data-out-of-code` in about four seconds.

---

## Finding 4 — The lab bench is already the engine. Copy it inward.

Measured structure of the full-window lab:

```
.lab-bar      50px   back · flask · title · Reset
.lab-brief    80px   what is wrong and what to do
.lab-panes           "The code" | "What it does"      (1fr 1fr; one column under 900px)
.lab-console         shared log, collapsible
.lab-foot     60px   status · "Ctrl+Enter to run" · Run
```

That is Unity's arrangement: source on one side, output on the other, log across the bottom,
transport in a bar. It even has the keyboard hint an engine would have.

**So the recommendation is not "make the shell more like Unity" — it is "make the shell more like
your own lab."** The lab is the proof that this team can build the arrangement; the shell just has
not adopted it.

One note on the lab's own budget: 221px of fixed vertical chrome (bar + brief + console + foot)
before any work surface. The 80px brief is the discretionary part — worth making collapsible once
read, since it is re-read far less often than it is displayed.

---

## Finding 5 — Naming is inconsistent between the shell and the lab

The shell says **Code** and **Play**. The lab says **The code** and **What it does**. Both are
defensible; having both is not. Engines name panels with short nouns — Scene, Game, Console,
Inspector — and that is part of what makes them feel like tools rather than websites.

Recommendation: short nouns everywhere in the chrome, and let the **lesson prose** carry the
friendly voice. The chrome is a tool; the writing is the teacher. Keeping those separate is what
lets both be good.

---

## What not to build

**Draggable, re-dockable, tabbable panels.** It is an enormous amount of work, and for an audience
of 11–14 year olds a rearrangeable workspace is mostly a way to destroy your own layout and not know
how to get it back. Unity ships layout presets precisely because its own flexibility is a support
burden.

The familiarity that matters is the **skeleton** — things in the slots you expect. The familiarity of
**reconfigurability** buys nothing here. Resizable docks, which already exist, are the right stopping
point.

---

## Layout inside the lessons

The type and rhythm work is done and committed: six type sizes, and spacing that now reads
10 / 18 / 22 / 26 / 36 / 48 with the section boundary as the largest division. What remains is
spatial.

**5a. The right-hand column is still mostly empty.** Prose is 540px inside a 780px block, so there
is a ~240px strip beside every paragraph. Figures marked `aside` use it; roughly 60% of paragraphs
have nothing there. That strip is the obvious home for margin notes — a definition, an aside, "in
Unity this is called…" — which is both a genuine reading aid and a very engine-documentation move.
It needs an authoring affordance, not new layout machinery.

**5b. The hero costs a third of the first screen.** 212px tall with reading beginning at 256px. For
a title, a one-line summary and two chips that is generous, and it is the cheapest screenful in the
app to buy back.

**5c. There is no way to jump within a six-screen lesson.** See Finding 2 — section anchors in the
left dock solve the orientation problem and the engine-familiarity problem with one panel.

---

## Plan

Ordered by engine-feel and usability per hour.

### 1. The Inspector (half a day) — do this first

Make `Game Info` editable. Sliders for the four CONFIG numbers, writing through the existing
`mergeConfig`, re-running the game on release. Rename the panel **Inspector**.

*Verify:* dragging a slider changes the value in `config.js`, the change survives a reload, and the
game reflects it. The student's file is the source of truth, not the panel.

### 2. Split the transport from the view (1–2 days)

Add a **Code + Game** split view — the lab's arrangement, in the shell. Keep Learn as a view tab.
Turn Play into a transport pair (Play / Stop) in the view bar that runs the game in whichever view
is showing it, rather than being the thing that decides what you look at.

*Verify:* a student can edit code and watch the game without changing view; stopping does not lose
their place; the game frame is not re-created on every view switch.

### 3. Sections in the left dock (half a day)

Under the current lesson in Course Outline, list its `h2` anchors and scroll to them. Highlight the
one on screen.

*Verify:* clicking an anchor scrolls to it; the highlight tracks scroll; it costs nothing on lessons
with no headings.

### 4. Let the left dock hold two panels (1 day)

Outline and Files visible together rather than swapped by view. Stacked with collapsible headers is
enough — no drag, no tabs.

*Verify:* both usable at once at the wide tier; degrades to one at narrow; no regression to the
floating-dock behaviour.

### 5. Naming and the lab brief (two hours)

Short nouns in all chrome. Make the lab brief collapsible once read.

### 6. Margin notes (half a day, plus authoring)

An authored `note` block that renders into the right-hand strip beside the paragraph it belongs to,
falling to the flow when narrow. Reuses the `figure.aside` float mechanism already in the sheet.

---

## Honest summary

This does not feel like a game engine yet, and it is much closer than it feels. The gap is not
polish and it is not more panels — it is one missing control (a transport that is separate from the
view) and one missing panel (an Inspector that edits rather than displays). Both are small. The lab
bench proves the arrangement already works here.

The top-level navigation being a website rather than a menu bar is the right call and should stay:
this **is** a course, those destinations are real, and dressing them as File/Edit/Assets would be a
costume rather than a structure.
