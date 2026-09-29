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
  ink-2: "#cfcfcf"
  ink-3: "#b0b0b0"
  focus: "#ffffff"
  playmode-tint: "#3a2c1c"
  game-backdrop: "#111111"
  kid-bubble: "#4a3b2a"
  guest-bubble: "#33404f"
  callout-paper: "#fbf6ea"
  callout-ink: "#1d1a12"
  card-warm: "#2f2a24"
  card-warm-on: "#3a3027"
  code-ground: "#1e1e1e"
  code-keyword: "#9cb8e0"
  meter-music: "#8fb3ff"
  track-off: "#555555"
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
  well: "7px"
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
  inspector-slot:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.title}"
    rounded: "{rounded.option}"
    padding: "0 12px"
    height: "44px"
  choice-swatch:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.option}"
    padding: "0 10px"
    height: "44px"
  concept-card:
    backgroundColor: "{colors.card-warm}"
    textColor: "{colors.ink}"
    typography: "{typography.message}"
    rounded: "{rounded.callout}"
    padding: "12px 14px"
  card-tile:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.option}"
    padding: "8px 10px"
    width: "132px"
  card-tile-selected:
    backgroundColor: "{colors.card-warm-on}"
    textColor: "{colors.ink}"
  checklist-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.title}"
    height: "30px"
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
  idle control labels and Inspector field names; subtitles, notes, placeholders, the status bar and
  earlier lines of the conversation. Secondary was #b4b4b4 beside Quiet's #b0b0b0, two steps the
  eye could not tell apart; it is #cfcfcf now, so the three read as three.
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
- **Card Warm** (`card-warm`): a concept card in the conversation, a warm graphite that marks the
  moment an idea is named; **Card Warm, Picked** (`card-warm-on`): a card tile the kid has opened.
- **Script Ground** (`code-ground`) and **Keyword Blue-Grey** (`code-keyword`): the C# pane, a
  code editor's near-black with muted keywords; still quieter than the game.
- **Music Meter Blue** (`meter-music`): the music level in the Audio Mixer, the one non-orange level,
  so music and sound effects read apart at a glance.
- **Empty Track** (`track-off`): the unfilled part of a switch or a card's level bar.

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

**The Front Door (no longer an exception).** The hiring interview (wireframe 07, a kid's first
sign-in) is still its own scene, not the editor: the Studio Director a silhouette against a big
window at night, one speech bubble centred under them, the kid's last answer echoed above it, the
text box below, the director's clipboard notes on the left and a tablet for the try-this moments on
the right. But it is drawn in League Navy, token for token with the studio: the warm dusk lobby
(Jay, 2026-09-26) is reversed (Jay, 2026-09-28: "the interview art style does not match the color
scheme of the rest of the app"). The bubble is Raised navy with 17px message text; the director's
identity colour, `#f7d154`, is on the avatar (Lucide "clapperboard"), the bubble's edge and the
name only, never on buttons or focus rings; orange is only the call to action ("Go to my desk") and
the selection. `studio/interview.css` says which token is which. Everything below describes the
editor.

An editor designed at 1366×650, the usable part of a 1366×768 Chromebook screen once Chrome's own
bars are gone. A four-row, three-column grid: one bar (48px: menus, Play, Sound and the kid's own menu), workspace, Project drawer (30px, or a
118–132px shelf when a shift needs its sounds or cards), status bar (26px); left column 264px,
centre flexible, right column 388px running from under the bar to the status bar. The
workspace row is `minmax(0, 1fr)` so tall dock content scrolls inside its dock instead of pushing
the drawer and status bar out of the frame. Docks meet with 1px gaps that show the charcoal
ground, as editor panes do.

- **Toolbar:** League wordmark and project name left, Play centred in a charcoal well, exactly
  where Unity keeps it. Pause and Step join it only when a quest needs them (the frame shift).
- **Left column:** during a shift, a compact Quest dock (the checklist) over the Hierarchy; on the
  desk between shifts, the Studio dock (milestones and departments) in the same place.
- **Centre:** the Game dock, the game filling it. When the C# pane opens it is its own dock beside
  the game, its tab level with the Game tab.
- **Right column:** the character's dock (the mentor, or the studio character running the shift).
  The kid's primary action, the options, sits at its lower right. When a part is picked, the
  **Inspector opens as its own dock above it**, with its own tab.
- **Bottom:** the Project drawer ("your cards", or the shift's shelf) and the status bar with the
  quiet stars.

**The Zoom Rule.** The product's editor is a fluid layout that honours browser zoom: at 1366×650 it
is exactly the grid above, and when a kid zooms in, text and targets get bigger and the docks
reflow (columns shrink before type does). The wireframes in `docs/rework/wireframes/` stand in with
a fixed frame scaled to fit the window, which cancels zoom (WCAG 2.2 resize text, 1.4.4); the
prototype must not copy that (Jay, 2026-09-25, from the audit).

Spacing runs on a small editor rhythm (6, 8, 10, 12px); dock bodies pad 10px by 12px. Fixed-height
strips centre their content vertically. Controls grow to 44px targets even inside compact strips.

**The Builds Around You Rule.** Docks open in story order. Until then a dock is a faint outline
in its final place, so the layout never jumps and the kid sees where things will come.

## Elevation & Depth

Depth is tonal: charcoal ground, graphite docks, raised graphite rows, the darkest well behind the
game. Shadows are rare and soft, used only on the few things that float over the docks: the
callout, the key hint over the game, and the pops. The Inspector is a dock and does not lift.

### Shadow Vocabulary
- **Callout lift** (`box-shadow: 0 6px 18px rgba(0,0,0,.35)`): the pointer bubble above a tab.
- **Play ring** (`box-shadow: inset 0 0 0 3px` League Orange): round the game while it runs.
- **Play cue** (`box-shadow: 0 0 0 2px` League Orange): round the Play button when pressing it is
  the next step.
- **Closed outline** (`box-shadow: inset 0 0 0 1px` Closed Outline): an unrevealed dock.

### Named Rules
**The Tonal Stack Rule.** Docks never cast shadows; they sit flat in their grid and read by tone.
Only true overlays (the callout, the key hint, the pops) lift.

**The No Overlay Rule.** A panel never lies over another panel. When something needs room (the
Inspector, the C# pane), it opens as a dock and its neighbours shrink; what they held stays
readable and scrolls to its newest line (Jay, 2026-09-25).

## Shapes

Small, practical corners, as editor chrome has: 4px on list rows and chips, 5px on transport
buttons and the quest card, 7px on the charcoal well that groups the transport, 6px tops on tabs (square at the bottom where they join the dock),
8px on dialogue options and the say field, 10px on the callout, 12px on message bubbles, circles
for the quest dot, slider thumbs and the mentor's face. Borders are hairlines; the only heavier
stroke is the 1.5px orange outline on dialogue options.

**Icons.** One authored inline-SVG set, a 24-unit grid drawn at 18px, stroke 1.75, round caps and
joins, no fill, coloured by `currentColor`: play, pause, step, stop, hierarchy tree, game pad,
flag, cube, sliders, cards, star, fold chevron, close, check. New icons join this set at this
stroke; no icon fonts, no emoji, no second set.

## Components

### Buttons (transport)
Play (and Pause, Step when a quest needs them): Unity's own buttons, with words. Play is real: it
runs and stops the game, and the toolbar can never disagree with the game.
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
  an Orange Ink rim. Each row is 44px: the kid's field name over its real Unity property name, and
  the value shown as a number beside the track. A slider's accessible value says what it means
  ("2.0, the jump hits the spikes"), not only the number.
- **Switch** (e.g. Solid, Hurts player): a 44px button with a 38×22px track (Empty Track grey, League
  Orange when on) and the state in words beside it ("On: things stand on it").
- **Choice swatches** (a colour, a sound): 44px buttons with a word, and a colour dot when it is a
  colour; never colour alone. The picked one gets the 2px orange ring.
- **Inspector slot** (e.g. a sound slot): a 44px dashed outline in Quiet Ink while empty ("Tap to add
  a sound", one line), solid orange outline once filled.

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

### Character dock and Inspector (signature)
The mentor, or the studio character running the shift, lives in the right column: a header (face,
name, role), the message log, the options, the say field. Messages are 12px-rounded bubbles: mentor
in Raised Graphite, the kid right-aligned in Kid Bubble, visiting characters in Guest Bubble. The
speaker's Caption shows only when the speaker changes; a second line in a row doesn't repeat it.
**The conversation keeps its history:** new lines append (a 0.3s rise), earlier ones stay in Quiet
Ink, and the last eight are kept, so an instruction or a line of praise never vanishes the moment
the story moves on. The dock's tab carries the chat icon (not the GameObject cube) and always names
who is talking. Answers are shuffled every time they are shown, and each new line is read out once
by a single screen-reader announcer; so is what happens in play ("Coin grabbed."), unless a line
was just said for it. **"Say something else" is the idea inbox:** a typed idea is always answered
("I've pinned it to your idea board for studio time"), never deflected. Every picker ends in
**"Something else…"**: the kid describes it, and gets the nearest thing, labelled as a guess.

When a Hierarchy part is picked, the **Inspector opens as its own dock above the character's dock**,
with its own tab ("Inspector · Player") and a 44px close button (Escape closes it too). The
character's dock shrinks, drops its name card (its tab still says who is talking) and keeps its
newest line scrolled into view; the options and say field stay where they are. Nothing lies over
the conversation. Components belong to the part they are on, as in Unity: a sound slot is on the
Coin, the Player or the Lava, opened from the Hierarchy, never on the level. Parts are edited only
while stopped; tapping one during Play gets "Press Stop first" and nothing opens. *One narrow
exception:* the Audio Mixer, which belongs to no part, is opened by its step and closed when the
job is done, so it has no close button; a kid who closed it early could not get it back.

### Game dock
The game fills the Game Well. In Play mode the game gets the 3px orange inset ring, the chrome
takes the Play-Mode Umber tint, and a one-number frame counter (Unity's Stats overlay, cut down)
sits top right in the Stats face on a translucent black plate.

### Callout
A cream speech bubble (10px corners, callout lift, a tail) naming a panel in one sentence ("This is
the Game view: where games run."). It floats **just above the panel's tab and points down at it**,
never inside the panel it names: the tab is the label the kid will find again in Unity.

### Quest checklist
The shift's steps in the Quest dock: 30px rows, a 20px box that fills League Orange with a check
only on evidence from play, the current step in Title weight with an orange box outline.

### Concept card
Earned in the conversation after an idea is felt and used: Card Warm ground, 1.5px orange outline,
10px corners; the name in bold, the kid definition in one sentence, then the real names (Unity
first). Cards collect in the Project drawer.

### Cards drawer and tiles
On the desk the Project drawer (a 44px bar when closed) opens taller, taking its height from the
Game view and never overlaying it, into a **wrapping grid** of tiles that scrolls vertically if it
must, never sideways: tools first, then cards newest first. Each tile: the idea's name, a
four-segment level bar (new, learning, solid, strong: League Orange segments on Empty Track grey),
and the level in words. A tool (a prize) gets an orange outline. Tapping a tile opens its back in
the Inspector. A card for an idea with no engine panel says "Unity: an idea, not a panel".

### Studio dock
Between shifts: the milestone track (Hired, Prototype, Alpha, Beta, Launch party: a filled orange
circle with a check when done, an orange outline for the next one) and the departments (an orange
dot when unlocked, a hollow dot when not), with one line about today.

### Pops and the key hint
A sound made visible over the game ("DING!", 20px, weight 800, white with a dark shadow), which
drifts up and fades; a sound the music buries shows small and faint, so the pop tells the same
story as the speakers. The key hint ("← → or A D move · Space or W jump") sits over the bottom of
the game until the game has focus.

### Unity mapping
Recorded in the contract and the artifact's step notes; any new surface keeps it.
- **Kept, real names:** centred Play / Pause / Stop icons in the bar (Step when the story brings it); Game view; Hierarchy (parts
  indented under the level); Inspector (component header, property rows); Play-mode tint and the
  undo-on-Stop behaviour; the Stats overlay (one number).
- **Repurposed:** the right-hand column holds the mentor and characters, with the Inspector docked
  above them when a part is picked; the Project window becomes "your cards" (and a shift's shelf);
  the status bar holds the quiet stars; selection blue becomes League orange.
- **Removed (until a quest needs them):** the Scene tab, Console (it returns as one line under the C#
  pane), move/rotate/scale tools, Pause and Step, the account and layout menus.
- **Added:** the Quest and Studio docks above the Hierarchy; the characters; kid subtitles on real
  panel names.

### Sound
The UI makes a sound only when **the kid caused a change**: Play and Stop, a step passed, a wrong
answer, a card or tool earned, being hired. Routine taps (a Hierarchy row, a slider, an answer) are
silent, because twenty trackpads clicking at once in one room is noise, not feedback. Sounds are
Kenney CC0 interface sounds, all under a second, at gain 0.15–0.35, and never two within 250ms.
One **Sound** switch in the bar (an icon) mutes the UI and the game together; pops
still show. The shared implementation is `docs/rework/wireframes/src/ui.js`.

### Motion
Reveals fade over 0.45s and the Inspector dock drops in over 0.35s (fade and 8px), both on
`cubic-bezier(.16,1,.3,1)`; parts snap in 650ms apart; pops rise and fade over 0.9s; a new tool
arrives in the toolbar with a 1.2s ring. A first success holds about 1.5s, with a line of praise,
before the story moves on. Reactiveness is small and tied to what the kid did: a press sinks 1px,
a passed step pulses the game once in orange (0.5s), a wrong answer shakes its button once (0.32s),
a checklist box ticks in with a scale. Under `prefers-reduced-motion` every transition and animation is off;
the states they carry (a pop, a new tool) still appear, just without the movement.

## Do's and Don'ts

### Do:
- **Do** take every token from the frontmatter; the `:root` in `docs/rework/wireframes/src/base.css` is the source.
- **Do** give every dock a tab with its real Unity name and a kid subtitle beside it.
- **Do** make every control an icon from the one set plus a word, at least 44px.
- **Do** use League orange for everything Unity paints selection blue, and for nothing decorative.
- **Do** keep the kid's game the most colourful thing on screen; chrome stays grey.
- **Do** show unrevealed docks as a 1px closed outline in their final place.
- **Do** tint the chrome and ring the game in orange while Play mode is on.
- **Do** open the Inspector as its own dock above the character's dock; keep the newest line and the options visible.
- **Do** point a callout at a panel's tab from above.
- **Do** make every step's progress depend on evidence from play, and shuffle answers every time.
- **Do** build the product's editor fluid, so browser zoom makes it bigger (The Zoom Rule).
- **Do** keep the conversation's history, answer every typed idea, and end every picker in "Something else…".
- **Do** make a sound only when the kid caused a change, quietly, with one Sound switch for everything.

### Don't:
- **Don't** take colours, type or components from the legacy `app/public/` styles; they are not authority for the rework.
- **Don't** add a second accent hue to the chrome, or Unity's selection blue.
- **Don't** set text a kid must read below 12px, or messages below 15px.
- **Don't** use icon-only controls, icon fonts, emoji or a second icon set.
- **Don't** show a removed Unity tool (Scene tab, Console, transform tools, account and layout menus) until a quest needs it.
- **Don't** give docks shadows; only overlays lift.
- **Don't** lay a panel over another panel; docks stack and shrink (The No Overlay Rule).
- **Don't** show a control that looks live but does nothing; hide it until a quest needs it (hidden, not greyed out).
- **Don't** scale the product's editor to fit the window; that cancels zoom.
- **Don't** play a sound on a routine tap, or two sounds at once.
