# V2: the spec

**Status: approved by Jay, 2026-09-28** ("we may circle back later"). Written through discovery Q&A.

It sits on top of `prototype-plan.md` (what to build, and in what order). This file is *how V2
works*: the architecture, the course flow, and the interaction rules. The spec comes first; the
decision log it was built from (Jay's answers, rounds 1–7) is below it, numbered so the spec can
cite it as (D12).

---

# The spec

## 1. What V2 is, in one paragraph

A kid signs up with today's code and is interviewed for a job at a game studio (about 3
minutes, in its own scene). They're hired, and land at their desk: a cut-down Unity editor in
League Navy. Studio characters voice authored quests, and a mentor answers anything typed. The
first quest has them play the intern's broken greybox level. Every problem they find becomes a
ticket; they fix one, and the level becomes their own game. From then on they pick tickets. Each
ticket is a department's shift that teaches one concept by changing their game. Then comes guided
time on their own game, where the AI builds whatever they ask. The session ends with a feedback
form.

## 2. Architecture

```
 quest files (YAML, schema-checked)      ai/agents/*.md + ai/skills/*.md
            │                                         │
            ▼                                         ▼
  ┌──────────────── browser ─────────────────┐   ┌──────── server ────────┐
  │ Quest engine ── tickets ── project store │◄──┤ /api/ai: director,     │
  │      │ events            ▲               │   │  character, builder,   │
  │      ▼                   │ set()/ops     │   │  art-scout, checker    │
  │ Chat panel   Editor (docks, Inspector,   │   │ /api/state: saves      │
  │ (question    Hierarchy, Project, Script) │   │  per kid               │
  │  card)            │                      │   │ /api/teacher: roster,  │
  │                   ▼                      │   │  progress, live feed   │
  │            Game frame (sandboxed Phaser) │   └────────────────────────┘
  └──────────────────────────────────────────┘
```

**The rule that holds it together: code keeps the score, the AI writes the words.**
- **Code decides:** progress, gates, tickets, stars and what counts as done. That is the quest
  engine plus the game's own events.
- **The AI decides:** what's said, how it's said, what a typed line meant, and how to build what
  was asked. It only ever acts through the same `set()`/ops the kid's own taps use, and those are
  validated against what exists.

### 2.1 Quest files (D1, D18, D20)

`app/content/quests/<id>.yaml`, one per shift, validated by `tools/check-quests.js`. (V1's authored lessons in `app/content/lessons/` are V1's; V2 doesn't read them.)

```yaml
id: floor-is-a-picture
department: engineering
character: lead-programmer
concept: collider                  # the word the kid will own
opens_from: ticket:floor           # what starts it
beats:
  - id: point
    say: [ "That floor tile is just a picture. Nothing tells the game it's solid." ]   # key lines: meaning kept, AI voices them
    do:  { reveal: [hierarchy], point: hierarchy }
    wait_for: { select: tile }     # evidence, not a Next button
    hints_after: 25s
  - id: fix
    wait_for: { set: { part: tile, key: solid, value: true } }
  - id: test
    say: [ "Now press Play and walk across it." ]
    wait_for: { event: crossed, while: playing }
  - id: name-it
    award: { card: collider }
    ask:
      text: "What made the tile solid?"
      answers:
        - { text: "Its Box Collider", correct: true }
        - { text: "Its colour" }
        - { text: "Pressing Play" }
```

**The beat vocabulary is small and fixed:**

| Key | What it does |
|---|---|
| `say` | key lines; the meaning is kept, the AI voices them |
| `ask` | a question card |
| `do` | reveal a panel, point at it, open the Inspector or Script, start Play |
| `wait_for` | a game event, an Inspector set, a selection, Play or Stop, or an answer |
| `award` | a card, a star, a tool |
| `ticket` | file, close or reopen a ticket |
| `hints_after` | the nudge timer |

Because a beat only ever waits on evidence, a kid doing things out of order can't break a quest.

### 2.2 Tickets (D2, D16, D17)

A ticket is `{ id, title, department, quest, status: open | doing | done, source: found | asked }`.
- **Found problems:** the game's events file them. `fell` files the floor ticket, `coin` with no
  sound files the silent-coins ticket, and so on. Each is filed the first time it happens, in any
  step, and never lost.
- **Kid requests the Builder did early:** these are filed as done (D6).

The Tickets tab lives in the Project window. After the first day the kid picks the next shift from
it. The quest engine refuses to finish a day with a found ticket unfiled; that's the floor bug
from the first build.

### 2.3 The AI team (D5, D6)

| Agent | When | Returns | Can change |
|---|---|---|---|
| **Director** (unseen) | quest start, a kid is stuck, a ticket is picked | the next quest or beat, a nudge | nothing, it chooses |
| **Character** (one agent, a character sheet per persona) | every beat's `say`; every typed line | `{ reply, choose, actions }` | Inspector settings, via `set()` |
| **Builder** | a typed request beyond settings (new part, new behaviour, code) | ops on parts and code, and what it changed | the project, with a snapshot for Undo |
| **Art scout** | "Something else…", or asking for art | 3 best matches from the whole library | nothing; the kid picks |
| **Checker** | after every Builder change | does the game still boot, is the change there | nothing; it can make the Builder retry |
| **Quest author** (offline) | writing core quests | a quest file, schema-valid | a draft Jay approves |

**Skills hold the shared rules:** `kid-communication`, `unity-words`, `privacy`, `studio-facts`.
Each agent's context is the quest file's current beat plus the project state, so it can't invent
panels or steps.

### 2.4 Saves and state

- **Everything is saved on the server, per kid:** the project, the quest state, tickets, cards
  and chat history (test telemetry).
- **The browser copy is only a cache.** An "always start fresh" dev flag ignores it (D7).
- **Versioned:** a new quest-file version resumes at the nearest beat, never a stuck one.

## 3. The screens

### 3.1 Sign-in (prototype-plan §7)

The original sign-in page's look, with new copy. Two doors, then Google for staff:
- **Sign Up** asks for **today's code** (`TESTER_PASSWORD`, one code for the room, changed per
  session) and goes straight to the interview. The name is asked there, not here.
- **Log In** asks for today's code **and the class code** (`CLASS_CODE`, which never changes), then
  "Who's here?" (a card per hired kid: badge or hero, first name + initial, their game or join date),
  then "Is this you?".
- **No handles and no picture password** (Jed, 2026-09-28). Codes ignore case, spaces and dashes.
- Returning kids usually skip all of it: the cookie lasts 14 days. Google sign-in is limited to
  `ALLOWED_DOMAIN=jointheleague.org`.

### 3.2 The interview (D14, D19)

- **All of wireframe 07's beats, about 3 minutes,** in its own scene: the lobby, the silhouette,
  the clipboard and the tablet.
- **A conversation, not a survey.** The director (`ai/agents/interviewer.md`) asks one open
  question at a time and follows up on what the kid said. There are no premade answers; the only
  taps are the tablet's try-this moments (jump feel, coin sound, press Play, words they know, fix a
  silent coin).
- **The page owns the goals and the hire,** the AI only talks: it returns `{learned, reply, show,
  done}` and the page validates every field. When the model forgets to fill `learned` or `show`,
  the page's own safety net records the answer and turns the tablet on (`studio/interview.js`).
  With no AI at all, scripted lines run the same goals.
- **It collects:**
  - first name and last initial;
  - the games they play and the kinds of fun they like;
  - the growth snapshot (the tablet taps);
  - their confidence, and which job they want.
- **The clipboard takes notes as they talk,** and the name is pinned at the top.
- **It ends with the kid hired** and a badge (colour + icon) for their card on "Who's here?".

### 3.3 The editor (D3, D9–D13, D15)

- **Top:** a menu bar (File, Edit, GameObject, Window, Help), with only items that work, over a
  toolbar. The toolbar has Undo/Redo, Play/Pause/Step centred, then Layout and Sound. Every button
  has an icon, a word and a tooltip.
- **Default docks:**
  - Hierarchy, left;
  - Game, centre;
  - Inspector over Chat, right;
  - Project, bottom, with tabs for Assets, Scripts, Tickets and Cards;
  - Script, opened by quests.
- **Docks can be dragged by their tab and resized by their edges.** Layout → Default resets them,
  and Window opens any panel.
- **Panels arrive in story order.** A panel a quest hasn't reached yet isn't shown at all, and
  Window only lists panels the kid has met.
- **The Inspector is Unity-faithful** (D9): components with their on/off checkboxes, real field
  types, a tooltip on every field, and Add Component later.
- **Play mode:** edits made while playing are undone on Stop. The chrome gets a navy play tint and
  the game an orange ring.
- **The Chat panel:** grouped bubbles, the question card, and free typing. A working wheel and a
  rotating status line show while the AI works.
- **Colours:** League Navy in shades of one hue (D15). DESIGN.md is rewritten to match.

### 3.4 The teacher view (D23)

`/teacher`, for Google sign-in teachers:
- who's who;
- where each kid is, with a stuck flag;
- reset or rewind a kid to a beat;
- the live feed of AI asks and what the AI did;
- the observer form.

### 3.5 The dev panel (D7)

Localhost only, on Ctrl+Shift+D:
- jump to a beat;
- fire events;
- see the quest and ticket state;
- start fresh.

It isn't in the kid's UI and isn't served in production.

## 4. Sunday, beat by beat (D8, D17, D21, D22)

| Time | What | Built from |
|---|---|---|
| 0:00 | Sign-in, then the interview (~3 min) | §3.1–3.2 |
| 0:05 | **First day:** play the intern's level, file tickets, fix your pick, then the Play-mode mistake, pick a hero and name, play your game | quest `first-day` (wireframe 04's beats on the engine) |
| 0:30 | **Tickets:** pick a shift, then the next one. All four departments' first shifts exist | quests `floor-is-a-picture` / Engineering, `silent-coins` / Audio, `greybox` / Art, `harmless-lava` / Design |
| 1:15 | **Own-game time:** 2–3 suggestions as a question card, plus ask anything. The Builder does it and shows the change in the Inspector and code | own-game mode |
| 1:45 | **Feedback:** the kid survey as the mentor's last shift, the characters question, the recall check | quest `clock-out` |
| (any) | The observer form, for Jay | teacher view |

Fast kids never run out: tickets and own-game time stretch. A kid who is slow still reaches their
own game, because the first day ends there.

## 5. Deployment (D24)

- **Rename the current app `game-dev` to `game-dev-v1`,** still deployed from `main`.
- **Add `game-dev-v2`,** deployed from the V2 branch.
- **Each gets its own container, Caddy address and saves volume,** so accounts and work never mix.
- This changes `docker-compose.yml`, `.github/workflows/deploy.yml` and DEPLOY.md. It's done in
  its own commit, and the server side is coordinated with whoever runs the League server.

## 6. Priorities (D25; nothing is cut, lower tiers only if there's time)

1. The quest engine, the schema, tickets, and the four first shifts (plus `first-day`).
2. Sign-in, the full interview, and server saves.
3. The editor: docking, Inspector, Project, Script, menus, tooltips.
4. The AI team: Director, character, Builder, Art scout, Checker.
5. Own-game time.
6. Feedback and the observer form, the teacher view, the dev panel, and the playthrough tests.
7. Live side quests.

## 7. What happens to the first build

It stays uncommitted until this spec is approved. Then:
- **Kept, reshaped:**
  - the sandboxed Phaser frame with inlined Phaser, and the Play-mode snapshot and undo
    (`runner.js`);
  - the kid's game as parts plus real code (`starter/game.js`, `project.js`);
  - the character agent's `{ reply, choose, actions }` shape and its server route.
- **Rewritten on the engine:** `first-day.js`, `chat.js`, `editor.js`, the layout and the CSS.
- **The old app's tests that expect the old page** (`check-html`, `check-boot`, and the lesson
  checks) are replaced by V2's own checks and the playthroughs, not deleted quietly.

---

# Decision log

## Why this exists

The first V2 build (2026-09-28, uncommitted, on `claude/prototype-v2`) ported wireframe 04 onto
the real engine without a spec. Jay's review:
- **The real entry was skipped.** It skipped the sign-in and the hiring interview. It also had
  reviewer Skip and Restart buttons in the kid's UI.
- **Testing got stuck.** It over-cached: a refresh while testing resumed a stuck state.
- **"Something else…" didn't work.** The AI couldn't really pick a hero that wasn't on the list.
- **A found bug was lost.** The kid fell through the floor, kept going, then reported the silent
  coins. After fixing the coins, the floor was never fixed and the day just stopped.
- **Not Unity-like or configurable enough,** though it still needs to feel comfortable for kids.
- **Rough UI/UX:**
  - no icons with hover descriptions;
  - no dropdowns or real sliders;
  - some buttons do nothing;
  - panels can't be dragged;
  - the Inspector isn't laid out cleanly.
- **The chat:**
  - premade answers should be one interactive question card, not bubbles;
  - a speaker's lines should be one bubble;
  - typing can be an answer, a question, or a request for the AI to act;
  - it needs a working indicator while the AI answers.

## Decisions

### Round 1: architecture (2026-09-28)

1. **The course is authored quest files, run by one quest engine, and voiced by AI.**
   - **Quest files hold the structure:** each shift's beats, what counts as done, the branches, and
     the concepts it teaches.
   - **The engine** runs the beats and keeps the state, so a rule like "don't lose a found bug"
     lives in one place.
   - **The AI makes the conversation natural.** It isn't reading a script. It works inside the
     quest's beats through well-defined agents, subagents and skills, so it is predictable.
2. **Found problems become tickets.** Everything a kid finds goes on a ticket board. The first day
   fixes the kid's pick; the rest become later shifts, run by their departments. Nothing found is
   ever lost.
3. **Panels dock like Unity's, with a reset.**
   - Drag a panel's tab to move it; drag the edges to resize.
   - A Layout menu has "Default layout".
   - Every panel also opens from a Window menu, so nothing *needs* dragging (WCAG: dragging is
     never required).
4. **A custom hero comes from the whole art library.** For "Something else…", the AI searches every
   sprite the course has and offers its three best matches. It says honestly which are close
   guesses.

### Round 2: the AI team, testing, Sunday (2026-09-28)

5. **The AI team is a Director, the characters, and shared tools.**
   - **The Director** is never seen. It reads the quest and the kid's progress, and decides what
     happens next.
   - **Each studio character** is a persona that talks: the mentor, the lead programmer, the sound
     designer, and so on.
   - **Shared subagents do the work:**
     - the **Builder** changes the game;
     - the **Art scout** searches the library;
     - the **Checker** confirms a fix really works.
   - **Skills hold the shared rules:** kid-level language, Unity words, privacy.
6. **An early request is done, then tied back.** If a kid asks for something the Builder can do
   before the quest is ready for it ("add a dragon" on day one), the Builder does it. The AI isn't
   held back. The character then links it to the quest ("Cool dragon! Now, that floor…"), and it
   goes on the ticket board as done.
7. **Testing and resets:**
   - **A dev panel on localhost only:** jump to any beat, reset, fake events, see the quest state.
     Kids never see it.
   - **An "always start fresh" setting:** every reload starts at sign-in with a new tester, so no
     cached state gets in the way.
   - **Reset or rewind a kid from the teacher view,** on the real server too.
   - **Scripted playthroughs in a real browser,** covering every quest path, run as part of
     `npm test`.
8. **Sunday runs from sign-in to the kid's own game:**
   1. sign-in;
   2. the hiring interview;
   3. the first day (fix your pick, which files the other tickets);
   4. one or two more shifts from the ticket board;
   5. guided time on their own game;
   6. the feedback form.

### Round 3: the editor (2026-09-28)

9. **The Inspector is Unity-faithful, at kid size.**
   - **Component foldouts:** Transform, Sprite Renderer, Box Collider 2D, Audio Source, and scripts.
     Each has its on/off checkbox.
   - **Real field types:**
     - number fields with sliders;
     - dropdowns;
     - object pickers with a thumbnail (Sprite, AudioClip);
     - colour pickers.
   - **A tooltip on every field** (hover or tap), in kid words plus the Unity name.
   - **Add Component,** revealed when a quest reaches it.
10. **The code is a Script panel that quests open.**
    - The real Phaser code lives in the Project window's Scripts folder from day one, read-only at
      first.
    - Engineering quests open it for "which line did that?" checks.
    - Later quests let kids tweak values in it.
11. **The Project window is the asset browser.**
    - It shows folders and thumbnails from the art library.
    - Drag a sprite, or tap it then tap the target, onto a part or into an Inspector slot.
    - The Art scout's results land here.
    - Cards and tickets get their own tabs.
12. **The top has a menu bar plus a toolbar.**
    - **The menu bar** is cut down from Unity's: File, Edit, GameObject, Window, Help. It only has
      items that work.
    - **The toolbar** has Play/Pause/Step centred, plus Undo/Redo, Layout and Sound.
    - Every toolbar button has an icon, a word and a tooltip.

### Round 4: chat, interview, look (2026-09-28)

13. **Chat is a dockable panel,** like any other. By default it sits in the right column under the
    Inspector, and it can be moved or resized. Its tab names the character talking, and the
    question card and text box sit at its bottom.
14. **The interview keeps wireframe 07's scene, as a real chat.**
    - The scene stays: the lobby, the silhouette, the clipboard and the tablet.
    - The director is AI-voiced, choices come as the question card, and the kid can type anything.
    - It asks for first name and last initial and runs the try-this moments.
    - *Superseded while building (Jay, 2026-09-28): no handle at all, and no question card in the
      interview: the director asks open questions and the kid types. See §3.2.*
15. **The look: DESIGN.md's structure stays, and the colour is re-explored.**
    - **Kept:** the Unity layout, the kid sizes, the icon set, and the finishing (tooltips; hover,
      pressed and disabled states; real controls; clean Inspector rows).
    - **Re-explored:** the palette is bland. Jed liked the old app's colours. The options were
      compared side by side: https://claude.ai/artifact/7oqQwLrX1uxT4XME8Le2di
    - **Chosen: League Navy, in shades of that one navy** (Jay: "use different shades of that navy
      blue for accents"). Everything is the old app's hue (213°) at different lightness. Orange is
      the only other hue. The old app's own values are kept where they fit on the ramp.

      | Role | Colour |
      |---|---|
      | ground / wells | #0a1728 |
      | frame | #0c1e34 |
      | panels | #0f2440 |
      | raised rows | #13304f |
      | hover | #1c3c63 |
      | kid's messages | #22406a |
      | selection | #1b4b78 |
      | soft lines | #223a58 |
      | ink | #eaf1f8 |
      | secondary ink | #c6d5e7 |
      | quiet ink | #92a6bf |
      | League orange | #f5820a, the call to action |

      Every ink passes AA on every surface; the lowest is 5.35:1 for quiet ink on raised rows.
      DESIGN.md's colours are rewritten from this once Jay confirms it.

### Round 5: their game, Sunday's shifts, authoring, interview (2026-09-28)

16. **The intern's level becomes theirs,** open tickets and all. Every later shift fixes or adds
    something in it. When free building opens, they can also start a new game from a template.
17. **After the first day, the kid picks the next shift from their tickets.** Each department's
    shift is written once and works in any order. **For Sunday, that means all four departments'
    first shifts must exist** (Engineering, Audio, Art, Design), because any of them can be picked.
18. **The AI writes the quests, inside a system whose output is predictable** (Jay). What this
    means in practice is round 6's first question.
19. **The interview runs all of wireframe 07's beats** (about 3 minutes), including the growth
    snapshot, which is the research baseline.

### Round 6: authoring, own-game time, feedback, teacher view (2026-09-28)

20. **Quests are AI-written in two ways.**
    - **Core quests are written ahead of time.** An authoring agent drafts each quest file against a
      strict schema. A validator and a scripted playthrough check it, and Jay skims and approves it.
      At class time, the characters only voice and react inside the approved file.
    - **Side quests are generated live** from the same template, with the same beat types, checks
      and slots. They grow from a kid's own ideas and leftover tickets. The checks are always code.
21. **Own-game time is suggestions plus "ask anything".**
    - The mentor offers 2–3 ideas as a question card, using the tools the kid just learned.
    - The Builder does whatever they ask.
    - Each change shows up in the Inspector and the code, so the kid can see what happened.
    - Tickets they didn't get to stay on the board.
22. **The feedback, at the end of the session:**
    - **The plan's kid survey, as the mentor's last shift:** fun (faces), the best part, anything
      boring or confusing, whether they got lost, whether they'd come back next week, and whether
      the AI got something wrong.
    - **A question on mentor characters:** would named characters with faces be more fun?
    - **A recall check:** "Tap the Inspector" and "Tap where you'd press Play", on a Unity-style
      picture.
    - **An observer form for Jay:** engagement, stuck points, "whoa" moments, and anything that
      broke.
23. **The teacher view for Sunday:**
    - **who's who:** first name and initial, with the kid's badge;
    - **where each kid is:** quest, beat, time there, and a stuck flag;
    - **reset or rewind a kid;**
    - **a live feed** of what kids type to the AI and what it did.

### Round 7: deploy and priorities (2026-09-28)

24. **Two addresses:** rename `game-dev` to `game-dev-v1`, and add `game-dev-v2` (Jay).
25. **The priority order in spec §6 is approved as proposed.**
