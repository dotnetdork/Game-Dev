# Authoring the course

Everything here is editable without touching app code.

## course.yaml
Modules in order; each lists lesson ids that map to lessons/<id>.md.
`stars` is awarded when the whole module is completed.

**A lesson's id is a storage key.** `state.done`, its answers, its lab drafts and its practice
snapshots all hang off it, so it has to be lowercase letters, digits and single hyphens, unique
across the whole course, and have a matching `.md` on disk. `npm test` enforces all four. It used to
be the lesson's *position*, which is why reordering the course used to move every student's progress
onto whatever landed in the vacated slot; that is fixed, and the id is why.

## Checkpoints, and the building zones they open
**Every module ends in a checkpoint** — marked `checkpoint: true` in its front-matter, about the
student's *own* game rather than the course's. It is what makes the arc use → modify → **create**
instead of stopping at modify.

**A checkpoint is not a lesson.** Every other page in the course is something to read with things to
do embedded in it. A checkpoint is the opposite shape: a **building zone**, a full-window workspace
that opens over the app the way the lab bench does, with a board of the student's own answers on one
side and a helper bot in the room on the other. So its file contains no prose — just a ```zone
block declaring the workspace. The page behind is a door: title, one line, what the zone wants, and
the button.

The `checkpoint: true` flag changes three things:

- the outline draws that row with a chequered flag in the module's colour
- the page header says "Checkpoint · your own game" instead of "Lesson 4 of 4", and says how many
  stars the module is holding
- **its work counts towards finishing it** — the zone as one activity, or (for a checkpoint with no
  zone yet) its `yourturn` steps. In an ordinary lesson `yourturn` steps do not count, because a
  practice step reads the student's real game and lessons unlock in a straight line: one child stuck
  on their own game would wall off the course. A checkpoint is the one place that insists, which is
  the right place.

The stars gate needs no extra machinery. A lesson completes only when its activities are done, a
module's stars only land once every lesson in it is done, and the checkpoint is the last lesson.

Three rules `npm test` will fail you on, all because they fail silently otherwise: a checkpoint must
be its **module's last lesson** (anywhere else and the stars stop waiting for it, so the gate is
decoration), it must have a **```zone or a ```yourturn** (otherwise it insists on nothing), and
**every module must have one**.

### Two kinds of zone

`kind:` picks the furniture, because the two halves of the course need different rooms.

**`kind: sheet`** (the default) is a **board** of the student's own answers — one card per slot of
`design.md` — with tools above it and the helper beside it. It is for the modules where the work is
deciding: Game Engines, Game Ideation, Core Mechanics.

**`kind: build`** is **their real game running above their real code**, with the helper beside it.
It is for the modules where the work is building: Phaser Programming, Systems Architecture, Asset
Design. Its objectives run **in order** — one live at a time, the next unlocking when the last is
checked — and the helper hands each one out as a card in the conversation and briefs it against
their own file. The conversation is the quest log, which is why there is no fourth panel.

A build zone has no `slots:` and no `tools:` (`npm test` refuses both — they are the sign an author
meant `kind: sheet`), and its goals use `check:` instead of `slot:`.

    ```zone
    kind: build
    title: Build Your First Mechanic
    file: world.js            # which file the editor opens on
    brief: >
      What the module just taught, and where to push. This is the biggest lever you have on
      whether the guide is any use.
    goals:
      - say: Write a function for your mechanic
        brief: One sentence for the guide about what this objective is for.
        check:
          - function_added: true
          - parses: true

`check:` is the practice checker's own rule set, so everything documented under **Your turn** works
here — plus three added for zones: `function_added: true` (any new top-level name, for when the
student picks the name), `file_changed: <name>` (that one file differs from how it started, which
`changed_at_least` cannot express), and `published: true`. The "before" snapshot is taken when the
zone is first opened.

### Writing a ```zone

    ```zone
    title: Your One-Sheet
    intro: One line, shown on the door.
    reward: Designer badge          # optional; awarded when the zone is finished
    brief: >
      What the helper is here to do, and what the student has just been taught. This goes into the
      bot's prompt and is the single biggest lever on whether it is any use.
    opener: >
      The bot's first line, before it asks its first question.
    slots:
      - My game is
      - How you lose
    prompts:
      My game is: One sentence somebody could repeat back to you.
      How you lose: If you cannot lose, you cannot win. What goes wrong?
    goals:
      - say: Say how you lose
        slot: How you lose
      - say: Every box answered
        slot: '*'
    ```

- **`slots`** are the cards on the board, in order, and they are **headings in `design.md`** — the
  student's own notes file. Matched on the squashed text, so `My game is` finds `## My game is...`.
  A slot the file has never had is created on first write.
- **`prompts`** is what an empty card says. Optional; without one the card falls back to the
  parenthesised hint in the file.
- **`goals`** are the rail along the top, and each one is a real check: `slot:` means that box has
  an answer in it, and `'*'` means all of them do. They tick themselves as the student works, and
  Finish stays disabled until they are all green. A goal naming a slot that is not in `slots` can
  never tick, so `npm test` refuses it.
- **`brief`** is worth more effort than anything else here. It is how the bot knows what the student
  has just learned and what to push on. Say what to ask about first.

Finishing runs a second gate: the `zone-check` agent reads the boxes and decides whether the answers
are *answers*. It passes unless a box is filler, the heading repeated back, or an answer to a
different question — and an unreachable server or an unparseable reply resolves in the student's
favour, exactly as the practice grader does.

### `design.md` is the truth
The board reads `design.md` when it opens and writes it on every edit. Nothing is stored twice, so a
student can open the file in the Code tab and read the same thing. An answered slot loses its
prompt, so the file becomes a design document as it fills in; headings the zone does not declare are
kept in place, because a later checkpoint adds some and the student adds their own.

Checkpoints later in the course consume it. `contains: {file: design.md, text: 'How you lose'}` in a
`yourturn` works the same as anywhere else — anchor on a heading the student is told to keep, not on
words they are inventing.

## The student's design notes — `design.md`
Every project ships with `design.md`: the student's **one-sheet**, six slots, filled in during the
Game Ideation module and revised by every checkpoint after it. It is the only file in a project that
is not code — the game runner, the linter, `loadCode`'s formatter and the `parses:` rule all skip it
(`isCodeFile` in js/project.js), and the AI can only write `.js`, so the Build panel cannot rewrite
it. **Building zones are its editor** (see above); the Code tab is where a student reads it.

A file rather than a Notes tab or a key in progress state, and the reason is one button: **Reset my
progress** sits under a heading called *Testing* and promises only to clear XP, Stars, assets and
lessons. Notes kept there would be destroyed by it, silently, and the one-sheet is the only thing in
a project a student cannot get back by reading the starter. As a file it survives that, survives
Reset-the-game (which restores code only, deliberately), and stays visible to the tutor and the
grader — `aiContext()` sends project files and nothing else.

## How the app reads all this
At boot the app makes one request, `GET /api/lessons`, which returns the module structure plus
every lesson's front-matter (title, xp, summary, ai). A lesson's **body** is fetched only when
that lesson is opened, and the next one is fetched in the background so the click never waits.

You do not need to restart the server after editing content. The index is cached against the
newest modification time under `content/`, so saving a lesson or course.yaml is enough — reload
the page and your change is there.

If a lesson id in course.yaml has no matching file, it still appears in the outline (marked
`missing`) rather than breaking the course, so a typo shows up as one bad row instead of a blank
app.

## Lesson front-matter
Each lessons/<id>.md starts with a YAML block:

    ---
    title: Sprites & Movement
    xp: 350
    ai: full          # full | guided | off  (controls the AI panel for this lesson)
    checkpoint: true  # optional; the module's own-game checkpoint. See "Checkpoints" above
    summary: One line shown under the title.
    ---
    # Markdown body

- ai: full = normal help · guided = student must say exactly what to change · off = AI disabled.

## Quoting — the one thing that bites everybody

This applies to front-matter AND to every `quiz` / `challenge` / `yourturn` block. **Wrap the
whole value in single quotes** if it:

- contains a colon followed by a space — `Add a tween: make it grow`
- starts with a backtick — `` `<=` means "at most" ``
- starts with a double quote — `"Number" describes the type`

Unquoted, all three are read as something other than text. A step written
`- Read update(), asking each one: does this need to happen again?` becomes an object instead of a
sentence, and the student sees the literal words `[object Object]`. A question starting with a
backtick makes the whole block fail to parse, and the card then renders **with no question and no
options at all** — which looks merely sparse, not broken. Both of these shipped.

    steps:
      - 'Add a tween: make something grow and shrink when it happens.'
    question: '`<=` means "at most" — what does `if (lives <= 0)` ask?'

`npm test` now catches all of it (`tools/check-lessons.js`), and the browser console warns while
you are writing. If a card looks emptier than you wrote it, that is the first thing to check.

## How a lesson gets completed
There is no "Complete lesson" button. A lesson finishes when its work is finished, so **what you
put in the lesson decides how it is completed**:

- Every quiz, every challenge, and every run cell that declares `@expect` counts as one activity.
  When all of them are resolved, the lesson completes itself and awards its XP.
- `yourturn` steps do **not** count — except in a checkpoint, where they do and are the point.
- A run cell **without** `@expect` does not count — nothing can tell whether the student achieved
  anything, so it stays a tinkering toy.
- A lesson with **no** activities at all completes on reading: the student has to reach the bottom
  and stay there ~20 seconds. The timer pauses when the tab is not visible.

A progress strip at the end of the lesson shows which of these is in play. If you want a lesson to
require real work, give it at least one quiz, challenge, or `@expect` run cell.

Answers persist per lesson, so a student who reloads mid-lesson gets their work back.

## Runnable cells (```run)
Editable JavaScript + Run button. Optional directives as // comment lines:
- // @goal: <text>       shows a goal banner
- // @expect: <text>     after Run, if output contains <text> it shows "Goal met!" and counts
                         toward completing the lesson
- // @slider: name min max step value   adds a live slider; `name` is set for you and re-runs on drag
- // @demo: <name>       puts a moving picture between the code and the output, driven by the same
                         sliders. Needs at least one @slider. See "Live pictures" below

### Live pictures (@demo)

A slider cell shows a student a NUMBER changing. For some ideas the number is the least interesting
part — "each frame gets 20 milliseconds" means nothing at ten, and neither does "gravity = 0.5".
What means something is watching the box lurch when you drag the frame rate to four. `@demo` adds a
canvas under the editor that the same sliders drive.

The demos live in `app/public/js/demos.js`, one per visual idea, and several lessons can share one —
`walk` drives three different cells in Sprites and Animation. Adding a NEW one means writing a draw
function, and that file's header is the contract. The rule worth knowing before you open it: a draw
function's source is lifted out and run inside a sandboxed iframe, so it cannot reference anything
next to it in the file.

Do not reach for one by default. A demo earns its place when the thing being taught is a MOVEMENT or
a FEEL — timing, gravity, animation, delay, the difference between passing through and stopping. For
a cell that is really arithmetic (how many megabytes, how many features), the printout is the honest
answer and a picture is decoration.

Behaviour is the same everywhere and you do not configure it: the picture loads paused showing its
first frame, starts when the student drags a slider or clicks it, and stops after ten seconds of
nobody touching it, when it scrolls off, or when the tab goes to the background.

`check-lessons.js` fails if a cell names a demo that is not in demos.js, or carries `@demo` with no
`@slider` — both of which would otherwise render as an ordinary run cell with no picture and no
error at all.
- // @predict: <question> >> <option> | *<option> | <option>
                         asks the student to commit to a guess BEFORE the code and the output are
                         visible. `*` marks the right one; options are shuffled at render

### Writing a good @predict

This is PRIMM's Predict stage, and it is the difference between a student watching output go past
and a student getting an answer to a question they asked. It is never graded and never blocks — a
wrong guess is the useful kind, and the cell opens either way.

Two rules, both learned the hard way:

**The answer must not be on the page.** The first one written here asked how long a frame gets at
60fps — and the paragraph directly below the cell says "one frame gets about 16 milliseconds". The
student reads the answer while deciding. Predict something only the *output* can settle.

**Ask about a relationship, not a fact.** "How long does one frame get?" is a lookup. "Drag the
frame rate down to 30 — what happens to the time each frame gets?" makes them reason about
`1000 / fps`, which is the line you actually want them reading. Facts are what the prose is for.

## Quizzes (```quiz) — checked locally, answer is 0-based

**`question:` is the question**, and it is the one key every quiz must have — it is the text
the student reads. (`prompt:` is the older name for it and still works, so the archived v1
lessons render. Write `question:` in anything new.)

    ```quiz
    question: Where does "the player pressed jump" get noticed?
    options:
      - In the read step, at the start of a frame
      - In the draw step
    answer: 0
    explain: Read, update, draw — input is read at the top of each frame.
    ```

**Write the right answer first — `answer: 0` — and don't worry about where it appears.**
The app shuffles the options before drawing them, so the authored position carries no
information. Every one of the 44 questions in the course was written `answer: 0`, which is the
natural way to write one: put the right answer down, then invent the wrong ones. Unshuffled,
that teaches "click the top one" inside three lessons — and since clicking an option now answers
it outright, it would be a free pass on the whole course.

Two things that follow from the shuffle:

- **Never refer to an option by position.** No "the first answer", no "all of the above", no
  "both A and B". They will not be in that order on screen.
- **`feedback:` is matched to `options:` by position** and is reordered with them, so a feedback
  line always travels with the option it explains. Give one per option or none at all —
  `check-lessons.js` fails a list that has slipped out of step.

The order a student sees is stable: it is seeded on the lesson and the question, not random, so
it is the same every time they open it and an already-answered card redraws correctly. Two
different students can see different orders.

`findbug` and `parsons` are **not** shuffled — in one the options are lines of code and the order
is the program, and in the other a scrambled order is the whole puzzle.

Types:
- type: mcq        options + answer + optional feedback[] per option
- type: predict    like mcq but shows read-only `code:` first (predict the output)
- type: parsons    lines: [...] in correct order; optional distractors: [{text, why}] (drag to order)
- type: fillblank  code with ___ becomes an input; answer may be a list; optional explain
- type: findbug    code: [lines...]; student clicks the buggy line; answer is the 0-based line index; explain

All five types follow the same retry rule, so write for it:
- **First wrong answer** marks only what the student picked and shows that option's own
  `feedback[]` line right underneath it. The correct answer is *not* revealed. Write `feedback[]`
  entries that say why that particular choice is wrong — they are now the main teaching moment.
- **Second wrong answer** reveals the answer and shows `explain`. Write `explain` as the
  explanation you would give a student who has already missed it twice, not as a restatement.
- Getting it right at any point resolves the question.

## Challenges (```challenge)
A small sandboxed canvas the student edits and runs. Every module should have one — by convention
it goes at the end of the module's last lesson under a `## Your challenge` heading.

    ```challenge
    title: Be the engine          # optional, shown in the card header
    task: What the student has to do.
    goal: What the screen looks like when it is right.   # optional, shown as "Goal"
    code: |
      // starter code, deliberately incomplete
      if (somethingIsTrue) win();
    ```

### Getting unstuck

There is **no hint system**. A ladder of authored hints was built and taken back out: it was a
second way to ask for help sitting beside the AI assistant, in a panel the student already knows
how to use from the lesson, with a rule about which one you had to spend first. Two overlapping
doors, one of them locked.

What a stuck student has instead:

- **The tutor**, in the bench, same panel and same manners as on the lesson. It explains and refuses
  to write the code, so leaning on it still leaves the work theirs. Free.
- **The worked answer**, offered by the bench itself after four failed runs. That one *is* the
  answer, so it halves the lesson's XP — halves, not zeroes; see `lessonXpFactor` in widgets.js.

`hint:` is still parsed and still carried by every lab, and nothing renders it today. Left in place
rather than stripped from 22 files: it is one sentence per lab saying what to look at, which is
exactly what a future in-editor nudge would need.

**Write the `goal:`.** `task:` describes the problem; `goal:` describes what finished looks like,
and without it the block tells a student what is broken and never what they are aiming for. Say
what they will *see* ("the box travels all the way across"), not what they should type.

Inside the sandbox the code gets `canvas` (300x200), `ctx` (its 2D context), and `win()` — call
`win()` and the challenge is complete. Nothing else is available; there is no Phaser here, so a
challenge works in any module, including the ones before Phaser is introduced.

Two rules that are easy to get wrong:
- **The starter code must not already win**, or the challenge completes itself on first Run.
- **Bound any loop.** A `setTimeout`/`requestAnimationFrame` loop whose exit condition depends on
  the value the student is supposed to change will spin forever while it is still 0. Count ticks
  and stop with a hint (see `why-javascript-phaser.md`).

## Your turn (```yourturn)
The bridge from the lab to the student's own game: same technique, their code, by hand.

    ```yourturn
    title: Find the loop in your own game
    task: Your game has this exact loop in it. Go and find it.
    steps:
      - Open the Code tab and open game.js.
      - 'Add `console.log("frame")` as the first line of `update`.'
    reward: Engine Room badge
    ```

`reward:` **awards a real badge.** It is recorded against the student and shown in the trophy case
in the status bar. Two rules:

- **Every reward name must be unique across the whole course.** Badges are stored by name, so a
  duplicate means the second lesson awards nothing while still promising it. `npm test` fails on
  this.
- Name it after the skill, not the lesson ("Bug Hunter badge", not "Lesson 14 badge").

### Checking it — `check:` and `example:`

There is **no "Done" button.** There used to be, and it recorded that the student *said* they had
done it, so all twenty-two badges could be collected without opening the Code tab once. Pressing
**Check my work** now reads their actual project.

Two stages, in order:

1. **Your `check:` rules run first**, in the browser. Instant, offline, free, and not arguable.
2. **If they all pass, the grader reads the change** and decides whether it did what the task
   asked. Rules prove the mechanics; only a judgement can tell whether the goal was met.

A step with **no `check:` at all is fine** — it goes straight to the grader. Add rules where a
program can be certain, not everywhere.

    check:
      - called_in_update: movePlayer
        hint: "`movePlayer` is not being called inside `update()` yet."
      - parses: true
        hint: Something no longer parses — check the console.
    example: let coinsCollected = 0;

Every rule takes an optional `hint`, shown when that rule is the first to fail. Write it as the
next thing to try, not as a verdict. Without one the app falls back to a plain description, which
is correct but flat.

| Rule | True when |
|---|---|
| `contains: {file, text}` | that text appears in that file (omit `file` to search the whole project) |
| `matches: {file, regex}` | that pattern matches — remember YAML needs `\\` for a backslash |
| `config_changed: jumpPower` | that CONFIG number is different from when they started (a list means any of them) |
| `function_added: name` | a top-level function/const/let of that name exists now and did not before |
| `function_kept: name` | it still exists (guards against deleting working code) |
| `called_in_update: name` | that name appears **inside** `update()` — comments and strings skipped, so a commented-out call correctly fails |
| `new_file: true` | the project has a file it did not start with |
| `changed_at_least: 4` | at least that many lines differ from the snapshot |
| `parses: true` | every file still parses as JavaScript |

`example:` is shown only after a **third** failed try, and taking it is recorded — the same
bookkeeping a lab does when a student reveals the answer. Passing after seeing it still counts.

**Two things to get right, both about not punishing the correct answer:**

- **Do not demand a change when the task is a read.** `scenes-create-update` asks the student to
  check whether anything in `update()` belongs in `create()`. A student whose code was already
  clean has done the task by changing nothing, so `changed_at_least` there would fail the person
  who got it right. That block asserts only `parses: true`.
- **Do not pin down *how*.** `config_changed: [jumpPower, gravity]` is right for "make the player
  jump higher", because both are real answers. `config_changed: jumpPower` alone marks a student
  wrong for solving it with gravity.

The snapshot of "before" is taken the first time they press Check, not when the block renders — so
reading a lesson, going away, building something and coming back still counts.

Nothing here can tell a student they are wrong when the checker merely could not tell. An
unreachable server, a reply the server refuses to vouch for, or a broken rule in your own YAML all
resolve in the student's favour, and a broken rule is logged to the console for you rather than
shown to them.

## Pictures and diagrams
Put the file in `content/images/` and reference it **with a leading slash**:

    <figure class="diagram">
      <img src="/content/images/game-loop.svg" alt="What the picture shows, for a student who cannot see it.">
      <figcaption>What it means. This is teaching text, not a label — say the thing the picture is for.</figcaption>
    </figure>

**The leading slash is not optional.** A lesson's Markdown is fetched from `/content/lessons/` but
rendered into the page at `/`, so `![](loop.svg)` quietly resolves to `/loop.svg` and shows nothing
at all. `npm test` fails on a relative path and on a file that is not on disk.

- **SVG is the format to reach for.** It stays sharp at any width, it is a text file you can edit
  and diff, and it needs no build step. Match the app's colours by hand — an external SVG cannot
  read the page's CSS variables (there is only the one dark theme, so there is one set to match).
- `class="diagram"` gets the panel background, border and full block width. Add `narrow` for a small
  diagram that would look silly blown up, and use `class="shot"` instead for a photo or screenshot,
  which gets no panel behind it.
- **A caption is required in practice.** The picture and the caption teach together; a picture with
  no caption is decoration.
- **Animate only when the movement IS the idea** — a loop going round, an arc, a shake. Wrap the
  moving part in a group and hide it under `prefers-reduced-motion` (see `game-loop.svg`), and make
  sure the diagram still reads correctly once it is hidden.
- Remote images are blocked by the security policy, so the file has to live in this repo. Game and
  engine screenshots are almost all copyrighted — an original diagram of how the thing *works* is
  both legally safe and the better teaching anyway.

For an aside, use a `tip` div — it renders as a callout:

    <div class="tip">Sprites are just pictures the game can move around.</div>

## Showing a real game

A screenshot or a few seconds of footage. Use `class="shot"` for a still and `class="clip"` for
video, and **credit it in a `<cite>`** — `npm test` fails without one:

    <figure class="shot">
      <img src="/content/images/celeste-dash.png" alt="The player mid-dash, with a trail of afterimages behind them.">
      <figcaption>Three frames of afterimage is all it takes to make a dash feel fast.
        <cite><b>Celeste</b> — Maddy Makes Games, 2018. Screenshot used to discuss its game feel.</cite>
      </figcaption>
    </figure>

    <figure class="clip">
      <video src="/content/images/screen-shake.webm" autoplay loop muted playsinline></video>
      <figcaption>The same hit, with and without shake.
        <cite>Recorded from the course's own starter game.</cite>
      </figcaption>
    </figure>

- **Video, not GIF.** A five-second GIF is often several megabytes; the same clip as `.webm` is
  tens of kilobytes, and this runs on school wi-fi with twenty-five students booting at once.
  `muted` is required — `npm test` checks for it, and browsers block unmuted autoplay anyway.
- Clips stop and grow controls for a student whose machine asks for reduced motion, so write them
  to make sense as a still frame too.
- Keep stills under ~200 KB. Crop to the thing you are talking about rather than showing a whole
  screen at full resolution.

### Where the pictures may come from

Four sources, and it is worth knowing which one you are using:

1. **Ours.** The starter game, the labs, a student's published game (with the consent the privacy
   brief describes). No question at all.
2. **Openly licensed or public-domain games.** Plenty exist, and the licence usually asks only for
   the credit you are writing anyway.
3. **An official press kit.** Many studios publish screenshots explicitly cleared for editorial
   use. If a game has one, use it — it is the cleanest possible footing.
4. **A screenshot of a commercial game, used to discuss that game.** This is the interesting one.

On (4), one distinction is worth being precise about, because it is easy to get backwards:
**crediting the author is not what makes it lawful.** Attribution and permission are separate
things — a credit line does not grant a licence.

What does the work is **fair use**: a small excerpt, used for teaching and commentary, in a way
that does not substitute for the original. A course that shows one screenshot of a platformer in
order to explain how its jump feels is close to the textbook shape of that — educational purpose,
transformative use, a tiny portion of the work, and nobody skips buying the game because they saw
a still of it. The credit still matters, because a use with no attribution is much harder to
defend as commentary, and because it is the right thing to do.

So: **the risk here is genuinely low, and the reason is fair use rather than the credit.** Prefer
(1) to (3) when there is a choice, because they need no argument at all. Since this is the League's
material rather than any one author's, it is worth one line to whoever handles the organisation's
legal questions — the same route the child-privacy brief went down — so the position is recorded
rather than assumed.

## Prose
Standard Markdown (headings, lists, **bold**, images, > quotes) renders normally. Plain code
blocks are syntax-highlighted with the same theme as the Code tab.

For an aside, use a `tip` div — it renders as a callout:

    <div class="tip">Sprites are just pictures the game can move around.</div>

Syntax may still evolve; content converts easily if it does.
