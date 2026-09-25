---
name: Game Dev (the rework)
description: A real Unity editor, cut down for 10–13-year-olds new to computers, in League orange.
colors:
  accent: "#f5820a"
  accent-ink: "#1a1206"
  accent-soft: "rgba(245, 130, 10, .16)"
  ground: "#232323"
  panel: "#383838"
  panel-2: "#414141"
  tabbar: "#282828"
  line: "#121212"
  line-soft: "#444444"
  closed-outline: "#3a3a3a"
  ink: "#e8e8e8"
  ink-2: "#b4b4b4"
  ink-3: "#b0b0b0"
  focus: "#ffffff"
  playmode-tint: "#3a2c1c"
  game-backdrop: "#111111"
  kid-bubble: "#4a3b2a"
  guest-bubble: "#33404f"
  callout-paper: "#fbf6ea"
  callout-ink: "#1d1a12"
typography:
  body:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  message:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  label:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  caption:
    fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
  stats:
    fontFamily: "ui-monospace, \"SFMono-Regular\", Menlo, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
rounded:
  row: "4px"
  control: "5px"
  tab: "6px 6px 0 0"
  option: "8px"
  callout: "10px"
  bubble: "12px"
  round: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  target: "44px"
components:
  transport-button:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  transport-button-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  dialogue-option:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.option}"
    padding: "8px 12px"
    height: "44px"
  dialogue-option-hover:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
  dock-tab:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.tab}"
    padding: "0 12px"
    height: "30px"
  hierarchy-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "0 8px"
    height: "44px"
  hierarchy-row-hover:
    backgroundColor: "{colors.panel-2}"
  hierarchy-row-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
  message-mentor:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    typography: "{typography.message}"
    rounded: "{rounded.bubble}"
    padding: "9px 12px"
  message-kid:
    backgroundColor: "{colors.kid-bubble}"
    textColor: "{colors.ink}"
    typography: "{typography.message}"
    rounded: "{rounded.bubble}"
    padding: "9px 12px"
  message-guest:
    backgroundColor: "{colors.guest-bubble}"
    textColor: "{colors.ink}"
    typography: "{typography.message}"
    rounded: "{rounded.bubble}"
    padding: "9px 12px"
  say-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.option}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.row}"
    padding: "2px 8px"
  callout:
    backgroundColor: "{colors.callout-paper}"
    textColor: "{colors.callout-ink}"
    rounded: "{rounded.callout}"
    padding: "8px 12px"
---

# Design System: Game Dev (the rework)

**Scope and authority.** This file governs the reworked course: everything under `docs/rework/`
and whatever is built from it. It was recorded from the first-run wireframe
`docs/rework/wireframes/02-first-run-engine.html` (now superseded by `04-first-day.html`); the
normative token source is the `:root` block of **`docs/rework/wireframes/src/base.css`**, which every
current wireframe (03 onward) is built from. The direction contract recorded then is
`.impeccable/surfaces/docs-rework-wireframes-02-first-run-engine-html.md`.
**The legacy app's styles (`app/public/styles.css` and the rest of `app/public/`) are not authority.**
That dark-navy look belongs to the old prototype, kept only as a reference; do not borrow its
colours, type or components for rework surfaces.

## Overview

**Creative North Star: "The Real Engine, Cut Down"**

The kid sits at a real Unity editor in its dark skin: charcoal ground, graphite docks butting
together on hairlines, tab strips carrying Unity's own panel names. Then everything a
first-timer would not use is taken away or turned to the course's purpose, and what stays is
drawn at kid size: 15px body type, 44px targets, and every control an icon with a word. It
refuses both the candy kid-app layout and the full adult editor dump. It should read as a studio
workstation, not a toy and not a worksheet.

The chrome is deliberately colourless so that two things carry the eye: League orange, which takes
over every job Unity gives its selection blue, and the kid's game, which is the only saturated,
many-coloured thing on screen. The editor builds itself around the kid: docks not yet revealed
sit as faint outlines where they will open, and they fade in as the story reaches them.

Density is editor density with kid-sized parts: fixed-height bars, tight 6–12px gaps, content
centred in its strip. One thing speaks at a time: the mentor's latest line, with its options
directly under it.

**Key Characteristics:**
- Unity dark-skin greys with a single accent, League orange, in Unity's selection-blue role.
- Real Unity panel names on every dock tab, with a quiet kid subtitle beside them.
- System UI type at kid sizes; icon plus word on every control; 44px minimum targets.
- One authored inline-SVG icon set at a single stroke weight.
- The kid's game is the brightest, most colourful thing on screen.
- Play mode tints the chrome warm and rings the game in orange.
- Unrevealed docks are faint outlines, not missing space.

## Colors

A neutral graphite editor with one warm accent and one saturated zone, the game.

### Primary
- **League Orange** (`accent`): Unity's selection blue, repurposed. The active Play/Stop button,
  the selected Hierarchy row, the outline of every dialogue option, slider thumbs, the Play-mode
  ring round the game, the stars, the Quest department dot, the mentor's tab icon, text selection.
  It is binding brand colour (PRODUCT.md), not a choice to revisit.
- **Orange Ink** (`accent-ink`): the near-black brown used for text and icons sitting on solid
  orange, and the rim of slider thumbs.
- **Orange Wash** (`accent-soft`): the orange at 16%: dialogue-option hover, and the flash a new
  Hierarchy row carries as it snaps in.

### Neutral
- **Editor Charcoal** (`ground`): the ground behind the docks, visible in the 1px gaps between
  them; also the well of the "say something else" field and of the transport group.
- **Dock Graphite** (`panel`): the body of every dock, and the active tab (which is the dock body
  colour, as in Unity).
- **Raised Graphite** (`panel-2`): rows and wells inside a dock: idle transport buttons, the
  current-quest card, mentor message bubbles, chips, slider tracks, row hover.
- **Tab-Strip Black** (`tabbar`): tab strips, the toolbar, the Project drawer, the status bar.
- **Hairline** (`line`): the separator between docks and bars. **Soft Hairline** (`line-soft`):
  separators inside a dock (the Inspector component header) and the say-field border.
- **Closed Outline** (`closed-outline`): the 1px inset outline of a dock not yet revealed.
- **Editor Ink** (`ink`), **Secondary Ink** (`ink-2`), **Quiet Ink** (`ink-3`): primary text;
  idle control labels and Inspector field names; subtitles, notes, placeholders and the status bar.
- **Focus White** (`focus`): the 2px focus outline, offset 2px, on everything.

### Contextual
- **Play-Mode Umber** (`playmode-tint`): replaces the toolbar, tab strips, Project drawer and
  status bar backgrounds while the game runs, as Unity tints its chrome.
- **Game Well** (`game-backdrop`): behind the game, darker than any dock so the game glows.
- **Kid Bubble** (`kid-bubble`) and **Guest Bubble** (`guest-bubble`): the kid's own lines (warm,
  right-aligned) and a visiting studio character's lines (cool slate). Both are muted; neither
  competes with the game.
- **Callout Paper** (`callout-paper`) on **Callout Ink** (`callout-ink`): the one light surface in
  the editor, the pointer bubble that names what the kid is looking at.

### Named Rules
**The One Accent Rule.** Orange is the only chrome hue. Anything Unity would paint selection blue
is orange; nothing else in the chrome is coloured.

**The Brightest Thing Rule.** The kid's game is the only saturated, many-coloured thing on screen.
If a piece of chrome would out-shine the game, it is too loud.

## Typography

**Body Font:** system-ui (with -apple-system, "Segoe UI", Roboto, sans-serif)
**Label/Mono Font:** ui-monospace (with "SFMono-Regular", Menlo, monospace), for the frame counter only

**Character:** One system sans throughout, as an editor uses; it is familiar on a Chromebook and
costs nothing to load on a filtered network. Hierarchy comes from weight (600 for names, 500 for
subtitles) and the three ink levels, not from a display face. There is no display tier: the
editor has no headlines.

### Hierarchy
- **Body** (400, 15px, 1.45): the editor's base size, hierarchy rows, the say field.
- **Message** (400, 15px, 1.4): the mentor's and characters' lines. Never smaller than body.
- **Title** (600, 14px): dock tab names, transport button words, dialogue option words,
  the Inspector component name.
- **Label** (500, 12.5px): kid subtitles on tabs ("your parts", "studio AI"), the department
  under a dialogue option, chips, the status bar.
- **Caption** (700, 12px): who is speaking, above each message; hierarchy row notes.
- **Stats** (600 monospace, 12px, 1): the frame counter overlay on the game, and nothing else.

### Named Rules
**The Kid Size Rule.** Body and messages are 15px; nothing a kid must read is under 12px.

**The Real Word First Rule.** The real Unity word is the name (Title, weight 600); the kid's
gloss sits beside or below it (Label, Quiet Ink). The kid learns the real word and is never left
without the plain one.

## Layout

A fixed editor frame designed at 1366×768, the Chromebook screen, scaled down whole to fit
narrower windows. A four-row, three-column grid: toolbar (56px), workspace, Project drawer (30px),
status bar (26px); left column 264px, centre flexible, right column 388px running from under the
toolbar to the status bar. Docks meet with 1px gaps that show the charcoal ground, as editor
panes do.

- **Toolbar:** League wordmark and project name left, Play / Pause / Step centred in a charcoal
  well, exactly where Unity keeps them.
- **Left column:** a compact Quest dock over the Hierarchy.
- **Centre:** the Game dock, the game filling it.
- **Right column:** the mentor's dock, in Unity's Inspector slot. The kid's primary action, the
  mentor's options, sits at its lower right.
- **Bottom:** the Project drawer ("your cards") and the status bar with the quiet stars.

Spacing runs on a small editor rhythm (6, 8, 10, 12px); dock bodies pad 10px by 12px. Fixed-height
strips centre their content vertically. Controls grow to 44px targets even inside compact strips.

**The Builds Around You Rule.** Docks open in story order. Until then a dock is a faint outline
in its final place, so the layout never jumps and the kid sees where things will come.

## Elevation & Depth

Depth is tonal: charcoal ground, graphite docks, raised graphite rows, the darkest well behind the
game. Shadows are rare and soft, used only on the few things that float over the docks.

### Shadow Vocabulary
- **Inspector lift** (`box-shadow: 0 -10px 24px rgba(0,0,0,.35)`): the Inspector as it slides over
  the mentor's dock.
- **Callout lift** (`box-shadow: 0 6px 18px rgba(0,0,0,.35)`): the pointer bubble over the game.
- **Play ring** (`box-shadow: inset 0 0 0 3px` League Orange): round the game while it runs.
- **Play cue** (`box-shadow: 0 0 0 2px` League Orange): round the Play button when pressing it is
  the next step.
- **Closed outline** (`box-shadow: inset 0 0 0 1px` Closed Outline): an unrevealed dock.

### Named Rules
**The Tonal Stack Rule.** Docks never cast shadows; they sit flat in their grid and read by tone.
Only overlays (Inspector, callout) lift.

## Shapes

Small, practical corners, as editor chrome has: 4px on list rows and chips, 5px on transport
buttons and the quest card, 6px tops on tabs (square at the bottom where they join the dock),
8px on dialogue options and the say field, 10px on the callout, 12px on message bubbles, circles
for the quest dot, slider thumbs and the mentor's face. Borders are hairlines; the only heavier
stroke is the 1.5px orange outline on dialogue options.

**Icons.** One authored inline-SVG set, a 24-unit grid drawn at 18px, stroke 1.75, round caps and
joins, no fill, coloured by `currentColor`: play, pause, step, stop, hierarchy tree, game pad,
flag, cube, sliders, cards, star, fold chevron, close, check. New icons join this set at this
stroke; no icon fonts, no emoji, no second set.

## Components

### Buttons (transport)
Play, Pause, Step: Unity's own buttons, with words.
- **Shape:** gently rounded (5px), 44px tall, icon plus word, grouped in a charcoal well (7px).
- **Idle:** Raised Graphite with Secondary Ink.
- **Active:** Play becomes Stop while the game runs: solid League Orange with Orange Ink, stop icon.
- **Cue:** a 2px orange ring when pressing Play or Stop is what the story needs next.

### Dialogue options
The kid's primary action: 3–4 answers under the mentor's latest line, plus "say something else".
- **Style:** transparent, 1.5px League Orange outline, 8px corners, 44px minimum, word in Title
  weight; an optional department label right-aligned in Label / Quiet Ink.
- **Hover:** Orange Wash fill. **Focus:** the white focus outline.

### Inputs / Fields
- **Say field:** charcoal well, Soft Hairline border, 8px corners, 44px tall, 14px text, Quiet Ink
  placeholder "Say something else…". Typing is never required.
- **Inspector sliders:** 44px hit height, 6px Raised Graphite track, 22px League Orange thumb with
  an Orange Ink rim. Each row is 48px: the kid's field name over its real Unity property name.

### Chips
- **Style:** Raised Graphite, Secondary Ink, 4px corners, Label size; used for counts in the
  Project drawer ("no cards yet").

### Navigation: docks and tab strips
Every panel is a dock with a Tab-Strip Black strip (34px) and one tab (30px) in the dock colour.
The tab carries an icon, the **real Unity panel name**, and a kid subtitle in Label / Quiet Ink:
"Hierarchy · your parts", "Inspector · Player", "Mentor · studio AI". Panels the course added
(Quest, Mentor) use the same tab so they read as part of the engine.

### Hierarchy rows
44px rows: cube icon, part name, a right-aligned note ("your robot"). Children indent 34px under
the level, which has a fold chevron. Hover is Raised Graphite; selected is solid League Orange
with Orange Ink. New parts snap in from the left with a brief Orange Wash (0.6s).

### Mentor dock and Inspector (signature)
The mentor lives in Unity's Inspector slot: a header (face, name, "The studio's AI, and proud of
it"), the message log, the options, the say field. Messages are 12px-rounded bubbles: mentor in
Raised Graphite, the kid right-aligned in Kid Bubble, visiting characters in Guest Bubble, each
with a Caption naming the speaker. When a Hierarchy part is picked, the **Inspector slides in from
the right below the mentor's latest line**, earlier lines hide, and the options and say field stay
pinned beneath it: the kid still sees what the mentor just said and can still answer. The Inspector
has its own tab and a 44px close button.

### Game dock
The game fills the Game Well. In Play mode the game gets the 3px orange inset ring, the chrome
takes the Play-Mode Umber tint, and a one-number frame counter (Unity's Stats overlay, cut down)
sits top right in the Stats face on a translucent black plate.

### Callout
A cream speech bubble (10px corners, callout lift, a tail) pinned over the game, naming what the
kid is looking at in one sentence ("This is the Game view: where your game lives.").

### Unity mapping
Recorded in the contract and the artifact's step notes; any new surface keeps it.
- **Kept, real names:** toolbar with centred Play / Pause / Step; Game view; Hierarchy (parts
  indented under the level); Inspector (component header, property rows); Play-mode tint and the
  undo-on-Stop behaviour; the Stats overlay (one number).
- **Repurposed:** the Inspector's right-hand slot holds the mentor; the Project window becomes
  "your cards"; the status bar holds the quiet stars; selection blue becomes League orange.
- **Removed (until a quest needs them):** the Scene tab, Console, move/rotate/scale tools, the
  account and layout menus.
- **Added:** the Quest dock above the Hierarchy; the mentor; kid subtitles on real panel names.

### Motion
Reveals fade over 0.45s and the Inspector slides over 0.4s, both on `cubic-bezier(.16,1,.3,1)`;
parts snap in 650ms apart. Under `prefers-reduced-motion` every transition and animation is off.

## Do's and Don'ts

### Do:
- **Do** take every token from the frontmatter; the `:root` in `docs/rework/wireframes/src/base.css` is the source.
- **Do** give every dock a tab with its real Unity name and a kid subtitle beside it.
- **Do** make every control an icon from the one set plus a word, at least 44px.
- **Do** use League orange for everything Unity paints selection blue, and for nothing decorative.
- **Do** keep the kid's game the most colourful thing on screen; chrome stays grey.
- **Do** show unrevealed docks as a 1px closed outline in their final place.
- **Do** tint the chrome and ring the game in orange while Play mode is on.
- **Do** keep the mentor's latest line and its options visible when the Inspector opens.

### Don't:
- **Don't** take colours, type or components from the legacy `app/public/` styles; they are not authority for the rework.
- **Don't** add a second accent hue to the chrome, or Unity's selection blue.
- **Don't** set text a kid must read below 12px, or messages below 15px.
- **Don't** use icon-only controls, icon fonts, emoji or a second icon set.
- **Don't** show a removed Unity tool (Scene tab, Console, transform tools, account and layout menus) until a quest needs it.
- **Don't** give docks shadows; only overlays lift.
