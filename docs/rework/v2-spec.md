# V2: the spec

**Status: approved by Jay, 2026-09-28** ("we may circle back later"). Written through discovery Q&A.

It sits on top of `prototype-plan.md` (what to build, and in what order). This file is *how V2
works*: the architecture, the course flow, and the interaction rules. The spec comes first; the
decision log it was built from (Jay's answers, rounds 1–9) is below it, numbered so the spec can
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
| `say` | key lines, said as one message; the meaning is kept, the AI voices them |
| `instruct` | what to do now, a row with an arrow and no bubble (D37) |
| `ask` | a question card |
| `do` | reveal a panel, point at it, open the Inspector or Script, start Play |
| `wait_for` | a game event, an Inspector set, a selection, Play or Stop, or an answer |
| `award` | a card, a star, a tool |
| `ticket` | file, close or reopen a ticket |
| `hints_after` | when the Hint button pulses (D40) |

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
| **Designer** (D42, D48) | a design round: every kid turn in it, and the round's wrap-up | `{ reply, doc, decided, card, idea }`; at the wrap, `tickets` | the design doc, only in the kid's words (the page checks) |
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
| 0:05 | **First day:** play the intern's level, file tickets, fix your pick, then the Play-mode mistake, then the rest of the board. All four departments' first shifts exist | quest `first-day` (wireframe 04's beats on the engine); `floor-is-a-picture` / Engineering, `silent-coins` / Audio, `greybox` / Art, `harmless-lava` / Design |
| 0:45 | **The design meeting, round 1** (D47): the idea, how you play, the goal, the fun, then the hero with the concept artist. Play as your hero | quest `first-day`, `studio/design.js` |
| 0:55 | **Build your design:** the doc's decisions as tickets; pick one, its department builds it with you, test it, the lead designer's playtest question | quest `doc-ticket` |
| 1:15 | **Own-game time:** design rounds 2 and 3, each filed and built the same way, plus ask anything | quest `own-game` |
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
15. **The look: DESIGN.md's structure stays, and the colour is re-explored.** (Amended by D28: each
    character has a hue of their own.)
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

### Round 8: after the first build's review (2026-09-28)

The review is `v2-review-2026-09-28.md`. Its §9 has the full wording of R1–R4; these are pointers
to it, numbered so the spec can cite them.

26. **R1: chat-first, and the code keeps the score.** The quest holds the goals, the evidence and
    the hint levels. The AI picks the words and the order inside them (review §4, option C).
27. **R2: shape heroes.** The AI builds the hero from drawn parts. There are no hero sprites.
28. **R3: every character has a full identity colour.** It never goes on buttons or focus rings.
    Orange stays the one call to action, and each hue passes AA on the navy it sits on. This
    amends D15.
29. **R4: inline Lucide icons, at stroke 1.75.**
30. **The Builder is needed for Sunday** (review §9, open question 2; Jay: "Needed for Sunday").

### Round 9: the chat and the transport (2026-09-29)

Jay's playthrough screenshot showed the Mentor's opening as four bubbles and a hint arriving as if
the Mentor had said it. He picked the options below from a list of ideas.

31. **One speaker, one message.** Lines said together land as one bubble after one typing beat, and
    each is written as one or two sentences that fit together. Lines caused by something the kid did
    are a new message. This replaces "one idea per bubble" (review §4, rule 4). The AI is held to
    the same length in `ai/agents/mentor.md`.
32. **Keys are drawn as keys.** Quest text and the AI write a keyboard key in square brackets
    (`[Space]`, `[←]`, `[A]`, `[Ctrl+Z]`), and the studio draws it as a keycap. Only real key names
    count; any other bracketed text stays text.
33. **Hints are not chat.** The Hint button opens the hint in a callout under the task line; pressing
    it again shows the next hint there. The callout closes on its ×, Esc, a click elsewhere, typing
    in the chat, or the task changing. When the kid has been stuck for `hints_after` seconds, the Hint
    button pulses once instead of a hint being posted for them. The Console still logs each hint.
34. **The chat holds conversation.** Speech is a bubble. What happened (tickets, stars, builds) is
    a row with an icon and a time and no bubble. Play, Stop, hints and most game events are logged in
    the Console only.
35. **Play, Pause and Stop are three buttons**, as in Unity and Unreal. Play stays lit while the game
    runs and carries on after a pause; Step still waits for the story.
36. **One bar, not two** (Jay, 2026-09-29: items in it were redundant). The menus sit left, with Play,
    Pause and Stop as icons in the centre, then Sound and a circle with the kid's initial on the right.
    Undo and Redo moved into Edit, and the layouts into Window. The GameObject menu is gone, and so
    are the menu items that repeated a button. The circle opens the kid's own menu: their name, their
    stars, tickets and cards, what they're working on, Clock out, and Sign out.
37. **Instructions are not talk** (Jay, 2026-09-29: "can you have instructions render differently
    than chat stuff?"). A quest step's `instruct:` is what to do now ("Press Play up top to test
    it"). It shows as a row with an arrow and no bubble, after the speaker's talk. The task line still
    names the step's goal, so an instruction adds how or what comes first rather than repeating it.
38. **The game's keys are on the game** (Jay, 2026-09-29: "I'd rather that not be in the chat"). The
    keys show as keycaps in a strip at the bottom centre of the Game view. It is up before the first
    Play, stays a moment after Play or a click in the game, then fades. It comes back whenever the
    game is running without the keyboard, as "Click the game, then". Clicks pass through it.
39. **Pointer callouts are off by default** (Jay, 2026-09-29: "hide them by default, we may have use
    for them later"). The quests still say where they would point (`point:`). `POINTERS` in
    editor.js turns them back on, and `?pointers=1` shows them for a look.
40. **Nothing is said on a timer.** The hint timer used to post the next hint every `hints_after`
    seconds, so a kid who didn't answer got a message every half-minute (Jay: "the robot will
    repetitively spam you"). Now it pulses the Hint button, once for each hint.

### Round 10: the design doc and the design meeting (2026-09-30)

After the Sept 29 UX call Jay committed (Slack, Sept 30) to the kid writing a game design document
that the Builder builds from, with questions only when needed. Jed's reply the same day settled the
order. Later that day, planning the meeting itself, Jay picked the options in D47–D50.

41. **The design doc is the source of truth.** Nine sections in Jed's gameplay-first order ("start
    with the things that make the game play, then move on to the next section"): the idea, how you
    play, the goal, what makes it fun, obstacles and enemies, your hero, world and look, sound and
    music, story and writing. Each is `empty`, `started` or `decided`, and the kid can edit any of it
    in the Design doc tab (`studio/project.js`). The Builder and every character see it.
42. **The doc is filled in the chat, in rounds.** Jed's loop: design → build → play → design again.
    The page owns which sections a round covers and in what order; the AI (`ai/agents/designer.md`)
    only talks, writes up what the kid said, and may propose a card. The page keeps only what is
    grounded in the kid's words, the interviewer's method (§3.2).
43. **A question card only when it is needed.** For a real choice from a closed set (which ticket,
    a checkpoint quiz, the playtest review), for a fork in the kid's own design (D48), or when the kid
    asks for help on an open question. Every open question carries an example so a kid knows how to
    answer without a menu. Never on a timer (D40).
44. **Departments file what the kid missed.** When the kid is done reporting, each problem they
    didn't find is filed by its own department, so a missed finding never stalls the day. One finding
    is still needed to get there.
45. **The interview is off for Sunday.** Sign Up asks the name; the interview's code stays, switched
    off (`STUDIO_INTERVIEW`).
46. **Jed, Sept 30.** The editor tools stay ("I think they are great"). The course game becomes the
    kid's game. The first hours are "Fun, Play, Build", and the course is 10–15 hours.
47. **The design meeting comes after the board and before the hero** (Jay: "After they complete all
    the beats, before the create a character"). It opens by naming the cards the kid earned fixing the
    board: those are pieces of what makes a game a game. Round 1 is the core (idea, how you play, the
    goal, the fun), about 5 minutes. Its last section is the hero, and the concept artist joins the
    meeting for it. Later rounds come after building: obstacles and world, then sound and story, then
    open-ended ("What would make it better?").
48. **Discovery first, then a card only for a fork.** Each section starts with an open question; the
    Mentor digs for the why. When the kid's answer leaves something the build must decide, the AI
    offers a card whose options come from the kid's own idea (a pizza running from forks: when a fork
    catches you, start over, lose a slice, or get knocked back). At most one card per section, never
    on its first question. After three turns a section is let go, so the meeting never stalls.
49. **The doc becomes tickets, and tickets get built** (Jay picked this over a pick card or a
    checklist). At the end of a round the doc's new decisions are filed as tickets by department:
    Design for the play, Art for the hero and the world, Audio for the sound. The kid picks one from
    the board, as on the first day, and that department builds it with them (`quests/doc-ticket.yaml`).
    The board is the running list of what they could do right now; there is no second list.
50. **Game design is taught four ways, never as a lecture.** (1) Each doc section, once decided,
    names its concept in one line and awards its card: Genre, Core loop, Goal, Reward, Player
    character, Challenge, Theme, Mood, Story (the lines are `CARDS` in `studio/quest.js`). (2) The
    meeting opens with the cards they already have. (3) After each doc ticket is built and tested, the
    lead designer asks one playtest question on a card (how hard was it? could you tell when it
    worked?), and the first "how hard" earns Balance. (4) The characters name a card the kid already
    has instead of explaining it again ("that's feedback, like the coin ding").

### Round 11: after the whole-app audit (2026-09-30)

Jay asked for an Impeccable critique and audit of the whole studio: teaching, the learner model, the
AI, and the screen. It scored 26/40 on design health and 13/20 on the technical audit. The report,
with its evidence and its plan in five tiers, is the Artifact
https://claude.ai/artifact/GRdzuPdNQBHJvNH6pEr8PS (the snapshot is in `.impeccable/critique/`). Jay's
answers to its questions:

51. **Safety and truth come first** (the audit's tier 1), ahead of the screen and the teaching:
    - a safety check before any AI call;
    - a design ticket closes only on a real build;
    - the AI's words match what the page actually changed;
    - the Builder can't drop the game's quest events;
    - the AI comes back after it fails.
52. **In own-game time the kid makes one choice, then the AI builds.** Before a build, the kid picks
    one setting that carries the concept (how fast, when, how many) on a card. Then the AI does the
    work. This is not withholding: the build still happens straight away, with a decision the kid made
    in it. It answers the research that an AI which builds whatever is typed can make kids feel
    productive without learning (Bastani et al. 2025).
53. **Typing first stays** (D43 holds). Suggestions in the design meeting still come only after
    "idk" or Hint, even though slow typers pay for each turn.
54. **Design rounds 2 and 3 move to week 2.** Day one is round 1, the hero and its tickets. Fast kids
    get more tickets and free building, so they don't run out. The reason is spacing, not a word cap.
    Jay: the curriculum map's budget "is not 100% a gatekeeper". The research agrees that the count
    matters less than whether each word comes back, recalled rather than re-shown, across sessions.
    Look-alike ideas taught together (goal, reward, challenge) blur, so they are contrasted on purpose.
    There is no week 2 in the code yet: this needs the session count from the audit's tier 4, so
    `own-game.yaml` changes when that is built. Until then §4's Sunday table still lists the rounds.

### Round 12: the profile, badges and cards, and the studio as an engine (2026-09-30)

Jay: "audit this for its functionality like an engine", "the profile dropdown needs a rework", "the
cards do not belong in project. Rename them from cards to badges. Then make cards…", and "add a
right click context menu… We should be able to drag and drop from the project browser too." Two
audits came first, both checked against the code: what the studio can do against Phaser 4 and
Unity, and Unity's context menus and drag-and-drop against what the studio has to click.

55. **Badges are what you did; cards are what you learned.** Both leave the Project window, which
    holds files, as Unity's does, and live in the kid's profile.
    - A *badge* marks a first: the first fix, finding a problem yourself, the first build with the
      AI, making your hero, the design meeting's first round, changing the code yourself, a clear
      board, the first clock-out. The code awards them, never the AI.
    - A *card* is one of the game ideas (quest.js `CARDS`), drawn as a trading card. The front has
      the idea's picture, its name and its one line. The back says where the kid earned it and
      either what Unity and Phaser call it (the engine ideas) or a real game that uses it (the design
      ideas). In the profile, the cards sit as a row of small cards. Tapping one opens it big over the
      studio, and tapping again flips it. Levels (word → idea → use, research 06) come later: nothing
      records yet whether an idea was used again.
56. **The profile is a panel, not a menu,** because it holds a summary, cards, settings and the way
    out. It keeps one way to each thing: no stat repeats a control. **Settings** live inside it:
    - Game sound (it was the speaker on the bar until Oct 1, when Jay had the speaker removed);
    - Studio sounds, separate from the game's;
    - Less motion;
    - Text size;
    - Tooltips;
    - Higher contrast.

    Each is remembered in this browser. The kid's circle shows **an animal or a bug** (Jay, Oct 1),
    picked from their first name so it's the same on every Chromebook. It isn't something they
    choose; one more control would be the opposite of "fewer controls, one way".
57. **A right-click menu holds actions that already exist somewhere else**, plus the few Unity ones
    that kids need. It is the browser's own menu in text: the chat, the code, the doc, a name box.
    The audit's per-target list is the plan: Hierarchy row, Scene part, Project tile, component
    header, dock tab. It opens with a two-finger tap, long-press, Shift+F10 or the menu key, and it
    is the studio's one menu engine (editor.js `popup`). Nothing is only in it.
58. **Dragging from the Project window works where Unity's does.** A sprite goes onto an Inspector
    slot (as now), onto a part in the Scene view, or onto its Hierarchy row, when it fits that part.
    A sound goes onto the Coins. Every drop goes through Undo.
59. **The engine gaps, in Jay's order** (prioritised, none cut):
    1. Create, Duplicate (Ctrl+D) and Delete for coins, platforms and lava, through Undo;
    2. Box Collider 2D with Is Trigger on every object, plus Bounce and Drag on Rigidbody 2D;
    3. score, and a win/lose screen;
    4. camera follow and a wider level;
    5. an Enemy object;
    6. Add Component from a list;
    7. more than one script, with files you can rename and create;
    8. music;
    9. a second level.

    Gaps 1 and 2 were built on Oct 1. These are the choices made then, for Jay to overturn:
    - **The lava is a list**, like a floor (`pieces`), so there can be more than one. Old saves are
      moved over (project.js `migrate`).
    - **Delete takes away one thing, never a whole part.** The story points at the Coins, the Lava
      and the rest by id, and a ticket whose part was gone could never be fixed. The last coin,
      block or lava stays. Unticking its Box Collider 2D makes it do nothing.
    - **Duplicate puts the copy beside the original, not on top of it** as Unity does: a copy
      exactly over the first looks as if nothing happened. Create puts one in the middle of the
      level. Both pick the new thing.
    - **A coin is a trigger.** With Is Trigger off it is solid: you stand on it and can't grab it,
      which is Unity's rule for a pickup.
    - **The Box Colliders on the Player, the lava and the coins start folded until the first day is
      done** (gate `colliders`), so the floor's is still the one to find.
