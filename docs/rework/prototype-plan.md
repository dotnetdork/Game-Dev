# The working prototype: plan

Written 2026-09-26 from five investigations run the same day:
- a whole-course design critique (Nielsen score 24/40);
- an inventory of the old app's capabilities;
- a review of the plans, goals and gaps;
- web export and C#;
- game-design theory, and what makes games fun.

Their claims were spot-checked against the code before going in here. Line references are to this branch.

This file answers Jay's questions about the prototype. It is a plan, not a spec: each section ends
in what to build, and the open decisions are collected at the end.

**Standing facts this plan assumes:**
- **Hosting:** the app runs on the League's own server (Docker behind Caddy, `DEPLOY.md`), so Vercel limits do not apply.
- **Test telemetry:** it is deliberate, and it is stripped before release.
- **The AI:** it is not held back. Kids learn what AI can and can't do by building with it.
- **Age range:** kids 10–13 (`PRODUCT.md`). CLAUDE.md and the MCP description still say 11–14, which needs one fix.

---

## 1. What the plan already achieves, and what it doesn't yet

**Done well, and wireframed:**
- **Hands-on shifts.** Each follows feel → see → name: the kid feels the problem, sees what causes it, then gets the word for it.
- **Progress needs proof from play.** A step only opens on evidence, such as standing on the fixed tile or clearing the gap.
- **Real Unity panel names,** each with a kid subtitle.
- **A Play mode that undoes changes on Stop.**
- **Few new words per session.**
- **The kid's own game** gets something at the end of every shift.
- **One visual system** across all four wireframes.

**Not designed yet (the plans review, confirmed by grep):**
1. **The AI building anything.** No wireframe calls the AI, even though PRODUCT's core verb is "Directs".
2. **Adapting to the kid.** The learner card is seeded, but nothing reads it.
3. **The teacher's side.** No roles, no view of who is stuck.
4. **Anything the kid takes home.** "Publish my game" only saves a title in their own browser (`app/public/js/pages.js:329`).
5. **Enough content.** What's written fills about 20–35 minutes of a 60–90 minute session.
6. **Continuity.** The kid's game doesn't carry over between sessions:
   - the first-day colours are lost by session 2;
   - the silent-coins level is a different level from the others;
   - the department picked on the first day changes nothing afterwards.
7. **Creative freedom.** About 1.5 out of 5. The kid can't name the game, place anything, or set its goal, and anything typed in chat gets "tap one of the answers below".

Sections 2–11 close these.

---

## 2. The mentor and the agents, compared with the old assistant

The old app had one endpoint (`POST /api/ai`) and six agents:

| Old agent | What happens to it |
|---|---|
| **coder**: edits the game through JSON "ops", with four safety checks (claims a change it didn't send, a made-up Phaser API, a key that was never set up, art the kid doesn't own) and one retry | **Becomes the builder behind every character.** Keep the ops and the checks. Change its voice to concept words. Its rule "don't do the practice exercise" becomes "don't do this shift's hands-on step for them". |
| **tutor**: explains, hints first, reads errors out loud | Its behaviour moves into the mentor and character prompts |
| **design-coach**: writes on the design board, labelled guesses | **The Design department's character.** It's the closest thing to a character that can make changes |
| **quiz** + `cleanQuizQuestion` | Drop the agent. Its checker rules (3–4 distinct options, reject rather than repair) become the dialogue checker (`cleanTurn`) |
| **grader** + `cleanGrade` | **Keep as is**, for "what counts as done" checks that code alone can't judge |
| **lab-tutor** | Drop (labs are out) |

**Can the mentor do what the old assistant did?** Yes, once the builder is wired in behind it:
- **Build or change the game on request:** yes, through the builder.
- **Explain:** yes, in concept words.
- **Debug:** yes. The game's console output still reaches the prompt invisibly (`game-runner.js:255`).
- **Diff review goes, because kids no longer read code.** It is replaced by:
  - apply, then **undo** (the version strip, §10);
  - a **before/after replay**;
  - "press Play and see".

  This is also how kids learn the AI's limits. When the builder guesses wrong, they see it in play and undo it.

**The agent layout.** Each call is short and scoped, and code keeps the score:
- **Director.** Runs at the end of each quest and picks what comes next from the concept web and the learner card. It uses a deterministic scheduler; the AI only adds flavour.
- **Character agents,** one prompt each, in a new `app/ai/characters/` folder (lead programmer, sound designer, artist, designer, producer, QA lead, plus a narrative-designer guest). They improvise lines within the authored beats. The checker rejects bad turns, and the scripted line is the fallback.
- **Builder.** The old coder: one call per request, with its checks.
- **Playtest bots.** Scripted AI "players" that play the kid's level (§5, §6).

**What's missing and must be built new:** the director and scheduler, character personas, a Hierarchy
and per-object properties (today `CONFIG` is global only), and the skill tracker.

**Worth fixing on the way:**
- The 8,000-token output ceiling applies to every agent.
- The whole game is sent on every request.
- `describeWhere()` (`ai.js:695`) describes tabs the rework removes.

---

## 3. The kid's own game: their choices are not limited

The critique's finding is the plan's biggest correction. **The kid's game must be theirs from session 1 and grow every week.**

**Continuity**
- **One saved game state carries across sessions.** The first-day fix, colours, hero, jump feel and sounds all stay in the game and show up on the desk.
- **The first-day department pick reorders later shifts,** so no kid repeats their first fix. For example, a kid who picked Audio gets a different Audio job in session 4. The floaty-jump opener and the end-of-day teaser depend on the pick.

**Ways for the kid to author the game, with no new panels**
1. **Name the game on the first day.** Offer three generated names plus typing. The name becomes the project name in the toolbar.
2. **Studio time at the end of every shift (5–15 minutes).** Every tool the kid has earned is live in their own game. The only check is "it still plays".
3. **A Scene view from session 3.** Place, move and duplicate things, so the level stops being the intern's. This also closes the biggest gap with Unity (§7).
4. **The chat box becomes an idea inbox.** "I want a dragon that shoots lasers" goes to the builder right then:
   - the builder does what it can;
   - it labels its guesses;
   - it says what it couldn't do and why.

   Anything bigger becomes a ticket on the Studio board, so a later shift can make the kid the customer.
5. **Every preset picker gets a last option: "Something else…".** The kid describes what they want, and the AI picks the nearest art or sound and labels it as a guess.
6. **"Your game" steps are open by default.** The check is that the mechanic works in play, not that it matches a preset.
7. **From session 3, the kid picks their game's goal and kind of fun.** Later customer tickets bend towards it.
8. **Free build, late in the course (already noted by Jay).** Sessions 9–10 give over most of their time to it.

The builder's safety checks, undo and "art you own" still apply. Kids aren't limited in what they can ask for; they're limited to what the engine and the art library can actually do. Hitting that limit is itself part of learning what AI can and can't do.

---

## 4. Ten weeks of content, so it doesn't get boring

**Every session follows the same running order.** It lives in the Quest dock, one level above today's checklist, and gives the class a shared "where are you":

| Step | Minutes | What it is |
|---|---|---|
| Stand-up | 3–5 | The kid **plays their game** while a character asks one question about last week (not a quiz before they can touch anything) |
| Main shift | 15–25 | The session's new idea: feel → see → name |
| Customer tickets | 10–20 | 1–3 small jobs on earlier ideas, which is how each concept comes back 4+ times |
| Studio time | 10–25 | Their own game, everything earned so far, the builder on hand |
| Show a friend | 3–5 | Hand the Chromebook to a neighbour, who plays in tester mode |

That fills 45–80 minutes. Fast kids get more tickets and more studio time, and slow kids do fewer tickets. Nobody sits idle.

**Variety: each department gets its own main verb and view.** Not every shift should be "play a coin platformer, pick what felt off, fix it in the Inspector":

| Department | Verb | View |
|---|---|---|
| Engineering | tune and fix | Inspector, Console |
| Design | build and place | Scene view, level chunks |
| Art | paint and recolour | sprite colours, silhouette test |
| Animation & VFX | put frames in order, add effects | Animation strip, particles |
| Audio | sound and mix | Audio Mixer, eyes-closed test |
| QA | reproduce, report, check the fix | bug report and replay |
| Production | prioritise and cut | ticket board (Door Problem) |

Other ways to keep it fresh:
- **Customer games in other genres:** top-down, runner, puzzle.
- **Other framings:** a rush job, a boss visit, a milestone review with playtester reviews, QA on a classmate's game.
- **Sometimes the kid points at the problem in the game view** instead of picking from three options.

**What each session gets.** These additions come from the plans review, each reusing the shift runner, tickets or studio time:

- **S1:**
  - hiring interview (Jay's note);
  - first day;
  - the three departments not picked, as quick tickets (all four are already built in 04);
  - name the game;
  - studio time.
- **S2:**
  - floaty jump;
  - **write the slow-motion frame shift** (it teaches one of S2's three words and has no shift yet);
  - a ledge and a moon-level ticket;
  - a partner "just clears the gap" challenge.
- **S3:**
  - paper-prototype warm-up (offline, §5);
  - core-loop cards and a lose rule;
  - Scene view, placing obstacles;
  - the first playtest swap.
- **S4:**
  - silent coins;
  - the eyes-closed test;
  - a "silent jump" ticket;
  - sound their own game.
- **S5:**
  - fell through the floor;
  - the unfair spike (§5);
  - a frame-step tunnelling bug;
  - the first C# peek.
- **S6:**
  - art pass;
  - "fix one, fix fifty" (prefabs);
  - paint a second room;
  - camera follow;
  - teach-test-twist level order;
  - the Alpha review.
- **S7:**
  - put animation frames in order;
  - explosion builder;
  - "juice it" A/B test;
  - the 10,000-particles slowdown moment.
- **S8:**
  - the Door Problem as four short visits;
  - Beta reviews from three bot players;
  - `Door.cs` for keen kids.
- **S9:**
  - "which department fixes this?" tickets;
  - write a bug report;
  - balance tuning;
  - QA a classmate's game;
  - free build.
- **S10:**
  - Build Settings → a link;
  - credits;
  - title screen;
  - the pitch;
  - teach the new intern;
  - launch party;
  - free build.

**The authoring load.** Only 4 of about 30 activities are wireframed. Tickets are cheap (one ticket
template, many short authored entries). The expensive ones are the new shift types, one per
department verb.

---

## 5. Game development beyond the technical, and what makes games fun

**The areas of game development, with real job titles:**

| Area | Job titles |
|---|---|
| Game design | Game / Systems / Combat / Economy Designer, Creative Director |
| Level design | Level / World / Encounter Designer |
| Narrative | Narrative Designer, Writer |
| Art | Concept / 2D / 3D / Environment / Technical Artist, Art Director |
| Animation & VFX | Animator, VFX Artist |
| Audio | Sound Designer, Composer, Audio Director |
| Programming | Gameplay / Engine / Tools / AI / Network Programmer |
| UX/UI and game feel | UX Designer, UI Designer, Games User Researcher |
| Production | Producer, Project Manager |
| QA and playtesting | QA Tester, QA Lead, User Researcher |
| Publishing | Community Manager, Marketing |
| Business | Monetisation Designer, Live-Ops Producer |
| Accessibility | Accessibility Lead |
| Localization | Localization Producer / Tester |

Sources: ESMA careers, Hitmarker, Microsoft game-industry careers.

**What makes games fun: how strong each idea is.** Full citations are in the research report; this is the summary.

| Idea | How strong | How the course uses it |
|---|---|---|
| **Competence, autonomy, relatedness** (Self-Determination Theory; Ryan, Rigby, Przybylski 2010) | **The strongest research support.** Enjoyment and wanting to play again track feeling capable and having real choices | The structure: real choices, tuning, a game of their own, showing a friend. No word for it on screen |
| **Kinds of fun** (LeBlanc's 8: sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission) | Useful designer vocabulary, not science | **A new owned word in S1** (below) |
| **MDA** (mechanics → dynamics → aesthetics) | A shared vocabulary, not a tested model | Only in the director's notes |
| **Flow and difficulty** (Csikszentmihalyi; Chen 2007) | Flow is well established; "difficulty curve" is craft wisdom | Balance in S9, shown as a bored / fun / quit strip |
| **Koster: fun is learning patterns** | An essay | Why teach → test → twist works |
| **Juice** (Jonasson & Purho 2012; Nijman 2013) | Tested (Hicks et al. 2019): it makes a game more appealing, but too much hides the player | S7 "juice it", keep at most 3 effects |
| **Interesting decisions** (Meier) | A heuristic | Risk and reward (S3); picking which review to act on (S8) |
| **Teach → develop → twist → conclude** (Nintendo, Hayashida) | The director's own account of his method | S6 level order; the S8 door is the twist |
| **Failure that feels fair** (Juul) | A small survey, and it fits "feeling capable" | S5's unfair spike |
| **Nested loops** (Griesemer: 3 seconds inside 30 inside 3 minutes; "30 seconds of fun" is a misquote) | Designer testimony | On the back of the core-loop card |
| **Player types** (Bartle) | **Not validated** | **Never used to label kids or players.** Say "players want different fun" instead |

**How 10–13 year olds learn game design.** A review of 68 studies found that most measured engagement rather than learning, and that open-ended tasks without support can backfire. This supports guided shifts over a blank canvas. The closest precedent is Gamestar Mechanic: play to learn the design words, then design with them. Fullerton's playcentric loop fits the course: set an experience goal → prototype → playtest → compare → revise. Paper prototyping works in middle-school classrooms.

**Where non-technical game development goes (within the word budget).** Only S1, S2 and S7 have a free studio-word slot, and words introduced in S8–S10 can't come back four times. So:

- **Owned (new):**
  - **Kind of fun**, S1: "what the player should feel". The kid picks one or two kinds for their game. It comes back in S3 (which loop change serves it), S4 (music mood), S6 (art style), S8 (reviews) and S10 (the pitch).
  - **Optional: Balance**, S2, taught by the floaty jump's "clears the gap, not the ceiling". It comes back in S3, S6, S8 and S9. The alternative for this slot is Game feel, which overlaps with Feedback and Juice. Pick one or leave the slot empty.
  - **Juice** moves from a technical word to a studio word (it has no engine name). S7 then has 2 technical words plus 1 studio word, and the owned total stays the same.
- **Familiar (new or extended):**
  - **Game design doc** (S1–S3, see below).
  - **Risk and reward** (S3).
  - **Paper prototype** (S3).
  - **Accessibility** (S4: "every sound has a picture". The pops already are this).
  - **Fair failure / forgiving hitbox** (S5).
  - **Teach-test-twist** (S6, on the level-design card).
  - **Players want different fun** (S8).
  - **Story:** the narrative designer's guest line in the Door Problem (S8, "why is the door locked?") and a one-line hero goal.
  - **Balance** (S9, if not owned in S2).
  - **Pitch** (S10).
  - **Studio roles:** gains narrative designer, community manager and localization.
  - **A fair price** (an S10 card: cosmetics vs loot boxes, the FTC fine against Epic).
- **Director-only background, never on a card:** MDA, Self-Determination Theory, flow, Koster, Schell's lenses, player-type models.

**The game design doc, "My Game":**
- It is the first tile in the Project drawer.
- Tapping it opens its back in the Inspector, exactly like a concept card. It is not a new panel and not a form to fill in.
- **Its fields, one per line:** Hook · Hero · What you do · Win / Lose · Core loop · Kind of fun · Look & sound.
- **Each line is written by a shift's result,** in the kid's words. AI suggestions appear as labelled guesses the kid can change.
- **It comes back:**
  - the stand-up reads from it;
  - Alpha and Beta check the game against it;
  - it becomes the S10 pitch and credits page, and the gallery blurb.
- **It revives the old Design board's intent. ⚠ It is the one new surface in this section. Look at it before it's built.**

**The paper-prototype warm-up** (S3, run by the teacher, no screens): dice and index cards. The kid makes a one-rule game, a partner plays it, the kid changes one rule, and they play again. Then "Is it fun?" on screen.

---

## 6. Unity familiarity by session 10

The course's layout today is about 55–60% of Unity's default layout. Each step below swaps a
course-only control for the real Unity one, with tapping always kept as an alternative to dragging:

| S | Unity piece that arrives |
|---|---|
| 1 | Game view, Hierarchy, Inspector, Play |
| 2 | Pause and Step (the frame shift); the Stats frame counter; from here the **Inspector stays docked** and shows "nothing selected" when empty |
| 3 | **Scene tab** beside Game; click a thing in the view to select it; the Move tool |
| 4 | Project gets real folders (Assets › Sounds); drag a sound into a slot on the Coin itself; the Audio Mixer as its own tab |
| 5 | **Console tab** beside Project; `Scripts/Coin.cs` in Project; Transform X/Y; **each component's on/off checkbox** replaces the invented "Solid" and "Hurts player" switches |
| 6 | **Add Component**; Sprites and Prefabs folders; prefab rows shown blue in the Hierarchy |
| 7 | Animation window tab; Particle System as a component |
| 8 | Rotate and Scale tools; **+ Create** in the Hierarchy; parent/child |
| 9 | The Console as the QA surface |
| 10 | **Build Settings → Build**; the **graduation layout**: kid subtitles fade out, docks move to Unity's default positions, the mentor shrinks to a tab |

Most of these concepts are already on the familiar list, so no new owned words are needed. The Project drawer's
concept cards move to a "Cards" tab so that Project means files, as in Unity.

---

## 7. Logins

**What already exists** (`app/auth.js`, reused unchanged):
- a signed-cookie session (14 days, HMAC, HttpOnly);
- a gate that is always on;
- a refusal to start when sign-in is only half configured.

There are four ways in:
- **CodeServer OAuth:** planned for students, not finished.
- **Google:** teachers, on the League domain.
- **GitHub:** an allowlist.
- **The tester door:** any name plus one shared password, marked temporary.

**For the prototype:**
- **Students:** keep the tester door for playtests, but have kids type a **handle** rather than a name (the sign-in page suggests one). The handle is the display name everywhere. CodeServer OAuth replaces the tester door when it is ready.
- **Add a role (student / teacher) and a handle to the session.** Teachers sign in with Google. This is what unlocks the teacher view and publish approval. It touches `auth.js`'s session code, which is ask-first.
- **Optional:** class codes, so a teacher's view shows only their class.

---

## 8. Saved progress

**What already exists:**
- the kid's work is saved as three browser keys (project, progress, design board);
- a copy of each student's work goes to the server, keyed by a hash of their identity;
- an owner check, so one child's work can't be saved under another's sign-in;
- save versions that upgrade old saves, and a quarantine for unreadable ones.

**On the League server the copy is now a file on the `gamedev_state` volume** (fixed today: before, hosted saves were silently off unless Redis was set up).

**For the prototype:**
- **Add a `leagueCard` save key** for the learner card: skills, returns, prizes, finished quests. It needs a merge rule (keep the highest level per concept; combine the lists).
- **Shift progress:** save it per quest and step, so a kid can leave mid-shift and pick up where they left off.
- **A "Saved ✓" indicator** in the status bar.
- **Reset stars to 0.** They start at 400 today so they can be spent in the Store (`progress.js:37`), and the rework says stars are never a price.
- **The kid's game** keeps its format (`leagueProject`), plus per-object properties for the Hierarchy.

---

## 9. Tracking during testing, and the end-of-test survey

**Tracking.** The old pipeline stays:
- events go to the server's standard output;
- `npm run session:watch` follows them live over SSH and saves `app/logs/session-<date>.jsonl`;
- `npm run session:report` summarises them.

Test telemetry is on for playtests (typed messages included) and stripped before release.

**New events to add,** so each prediction in the explainer can be checked:

| Event | Answers |
|---|---|
| `beat` (quest, step, entered or done, time taken) | How long did it take to reach first play? Where do kids get stuck? |
| `choice` (step, option id, right or wrong) | Which wrong answers are popular? |
| `return` (concept, right or wrong, session) | Did the concept stick when it came back? |
| `play` (started, stopped, how long) | How much do they play compared with read? |
| `build` (request, what changed, undone?) | Do they build with the AI? This was the playtest-1 failure |
| `stuck` (stalled N seconds on a gate, spam stop) | Feeds the teacher view |
| `studio` (minutes, tools used) | Do they use their freedom? |
| `boot` (game started successfully) | Currently only failures are logged |

**Teacher view (a simple page, teacher role only):**
- one row per kid: where they are, how long they've been there, and a stuck flag;
- per concept: how many kids are new, learning, solid or strong on it.

The server can now keep this up to date in the background.

**End-of-test survey: two to three minutes, inside the app, after the last session of a playtest.**

**The kid version:**
- It appears as the last "shift": the mentor asks and the kid taps answers.
- Answers are faces and short options, not a form.
- Answers are stored as option ids.

1. How fun was working at the studio? 😞 😐 🙂 😄 🤩
2. What was the best part? (tap one: making my own game · fixing customer games · the characters · building with the AI · the sounds · something else…)
3. What was boring or confusing? (tap any, or "nothing")
4. Did you ever not know what to do? (never · once or twice · a lot)
5. Would you want to keep working at the studio next week? (yes · maybe · no)
6. Did the AI ever get something wrong? What did you do? (fixed it · undid it · asked again · gave up · it never did)
7. **Recall check:** show a Unity screenshot and ask "Tap the Inspector" and "Tap where you'd press Play". This measures whether the course prepares kids for Unity, which is the whole point.
8. Say one thing you'd add to the studio (optional, typed).

**The teacher / observer version:** a short form in the teacher view, one per session:
- engagement, 1–5;
- kids idle or off task;
- the moments that got a "whoa";
- where the class got stuck;
- anything that broke.

**A parent follow-up is optional:** did they talk about it at home, and did they show you their game?

---

## 10. Where finished games go (web play, and the C# question)

**C# doesn't need to be converted to JavaScript, because the game already is JavaScript.** The game is Phaser. The C# a kid sees is a view generated from the game, and a small translator reads their edits back into the game's values.

The translator is plain JS, about 500–1,000 lines, added in layers as the sessions need them:
- **Tweak (S5–S9):** read the numbers back, and reject anything else with a Unity-style Console message.
- **Arrange (S8):** a small parser for `if` and whitelisted calls.
- **Write one line (S10):** one whitelisted call becomes its JS equivalent.

**Why not real C#?**
- **.NET in the browser:** 7–30 MB downloads on Chromebooks.
- **Real Unity WebGL builds:** the editor doesn't run on ChromeOS.
- **A compile service on the League server:** now possible, but it would run kids' and AI-written code on the server, only to end up in the same browser game anyway.

**Publishing:**
- **"Ship it" (S10, the Build Settings prize):** freezes a copy of the game (files, the art keys it uses, the Phaser version) as its own record, so later edits don't change it.
- **A separate play address,** e.g. `play.apps.jointheleague.org`, on the same server:
  - it serves approved games, `/vendor/phaser` and `/assets`, with no sign-in and no app cookies;
  - kids' and AI-written code runs there away from logins. That separate address is also the real fix `game-runner.js:16` asks for;
  - its headers allow the League site to embed games.
- **The player page** is the same page builder without the development shims. It adds an end card: "Made by ‹handle› at The League of Amazing Programmers — build your own →".
- **Gallery page and embeddable player,** plus link previews for sharing and an optional "See the C# behind it" panel for parents.
- **Before anything is public:**
  - a teacher approves each game and can take it down;
  - games carry the handle only;
  - there's a check of in-game text for real names;
  - no trackers.
- **Marketing use needs signed parental consent.** School permission doesn't cover advertising. Keep a consent flag in the student record, fed by the League.
- **Tiers:**
  - **private link:** for parents, right away;
  - **class gallery:** teacher-approved;
  - **public / advertising:** approval plus consent.

---

## 11. Consistency fixes before the prototype (from the critique)

1. **The Hierarchy is always tappable.** Selecting a row opens the Inspector, including in the silent-coins shift.
2. **Edits happen only while stopped.** The silent-coins shift currently edits during play, which contradicts the first day.
3. **One progress model:** stars, milestones and departments done, written down once. In the current wireframes they disagree (Art is a first-day pick, but the desk says it "unlocks at Alpha").
4. **The same bubble colours and the same status-bar markers** in every shift.
5. **Keyboard focus comes back** to the control after the Inspector or Hierarchy is redrawn.
6. **Every line is read out:** chat lines, Console messages and short play-event text all go through the one screen-reader announcer.
7. **The desk becomes a studio, not a menu:**
   - Play is live there;
   - the stand-up happens while the game runs;
   - the Hierarchy stays;
   - cards go in a grid tab;
   - it shows a "last time" before/after.
8. **Other missing states:**
   - Undo (the version strip);
   - leave and resume;
   - a "clock out" wrap-up at the end of a session;
   - "what do I do?" hint again;
   - sound on/off.
9. **Built fluid,** so browser zoom works (the Zoom Rule). The wireframes' fixed scale is not carried over.

---

## 12. Additions that don't add clutter

Each one reuses something that already exists:
- **The running order:** the Quest dock.
- **Tickets:** the shift runner.
- **Studio time:** the editor.
- **"My Game":** a card tile.
- **The version strip as the only undo:** the status bar.
- **The tester-mode playtest swap:** Play mode.
- **The before/after replay:** plays by itself at "Name it".
- **Card backs** show a screenshot from the kid's own game.
- **The graduation layout** removes chrome.
- **Build** is an earned tool.
- **The teacher's stuck signal** comes from telemetry, so there's no new button for kids.

Only two are real additions:
- the "My Game" tile;
- **read-aloud** for the mentor's latest line.

Both are flagged for Jay.

---

## 13. Build order

1. **Foundations:**
   - the shared editor components (one script that all shifts use);
   - Hierarchy and per-object properties;
   - the `leagueCard` save key;
   - shift progress saves;
   - "Saved ✓";
   - the version strip / undo.
2. **The kid's game:**
   - carries over between sessions;
   - naming it;
   - studio time;
   - the builder behind the mentor (reusing the coder and its checks);
   - the chat as an idea inbox.
3. **Content engine:**
   - the director and scheduler;
   - the ticket template;
   - character prompts;
   - `cleanTurn`.
4. **Sessions 1–3, playable end to end:**
   - the first day plus its tickets;
   - floaty jump plus the frame shift;
   - "Is it fun?" with the Scene view;
   - the "kind of fun" card;
   - "My Game".
5. **Test instrumentation:**
   - the new events;
   - the teacher view;
   - the survey.

   **Then playtest.**
6. **Sessions 4–10** on the department verb templates, including the Unity reveals.
7. **Publishing:**
   - Ship it;
   - the separate play address;
   - approval;
   - consent;
   - the gallery.

---

## Open decisions for Jay

1. **"My Game" tile** in the Project drawer: yes or no, after seeing a mock-up.
2. **Studio-word slots:**
   - is Kind of fun owned in S1?
   - Balance or Game feel in S2, or leave the slot empty?
   - Juice as a studio word?
3. **Department pick:** does it reorder the whole course, or only the next few shifts?
4. **Publishing:**
   - is advertising use a marketing use needing parental consent (yes, per the privacy brief), and who collects it?
   - the play subdomain name;
   - teacher approval every time, or only for public?
5. **Roles in `auth.js`** (ask-first): OK to add role and handle to the session?
6. **Read-aloud** for the mentor's line: add it or not?
7. **Age range:** fix CLAUDE.md and the MCP description to 10–13?
8. **Who checks the Unity names and C# calls** (14 still unverified) before cards reach kids?
