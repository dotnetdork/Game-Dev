# Authoring the course

Everything here is editable without touching app code.

## course.yaml
Modules in order; each lists lesson ids that map to lessons/<id>.md.
`stars` is the module bonus, awarded when the whole module is completed. Lessons, practice steps and
labs pay Stars of their own as they happen — the amounts live in `STARS` in
`public/js/project.js`, not in content.

**A lesson's id is a storage key.** `state.done`, its answers, its lab drafts and its practice
snapshots all hang off it, so it has to be lowercase letters, digits and single hyphens, unique
across the whole course, and have a matching `.md` on disk. `npm test` enforces all four. It used to
be the lesson's *position*, which is why reordering the course used to move every student's progress
onto whatever landed in the vacated slot; that is fixed, and the id is why.

## The Design tab and `design.md`

There are no checkpoints. Every module used to end in one — a gated lesson that opened a full-window
board instead of a page, held the module's stars behind it, and ran objectives and a Finish button
inside. That is gone (2026-09-09). The board was the good half and the gate was the bad half: six
walls, each arriving as a different kind of thing from every lesson around it, and none of them
somewhere a student could go back to.

What replaced it is the **Design tab**, between Learn and Code. One board, always open, worked on
across the whole course. There is nothing to author: the tab exists, the board is the same for every
student, and its stickies come from the headings in their own `design.md`.

### What the board is

Every project ships with `design.md`: the student's **one-sheet**, six headings. The board is a
canvas of sticky notes over that file — one fixed sticky per heading, plus as many loose notes as
they like — laid out in three regions:

| Region | What it means |
|---|---|
| My game | the fixed stickies, one per heading of the one-sheet |
| Not building — next time | a loose note dropped in here joins `## What I am NOT building` |
| Ideas, unsorted | somewhere to put a thought that has no home yet |

Dragging a sticky from one region to another rewrites the file. That is the point: cutting scope is
a thing a student *does* rather than a thing a lesson describes.

The layout is fixed in `public/js/board.js` (`BOARD_REGIONS`), not authored per lesson. Add a `##`
heading to the starter's `design.md` and a sticky for it appears; nothing else has to know.

### Asking a lesson to use it

Write an ordinary `yourturn` that sends them to the tab, and check it with the same rules as any
other step — the board writes `design.md`, so `contains` and `matches` both see what they wrote:

```yaml
check:
  - contains:
      file: design.md
      text: 'TODO:'
    hint: Add a note on your board starting `TODO:` saying which boxes still need work.
```

Anchor on something the student is told to type (`TODO:`, `Before it ships:`) or on a heading they
are told to keep — never on words they are inventing. A loose note lands in the file as a list item
under `## Board notes`, so `contains` finds it wherever they dropped it on the canvas.

`changed_at_least` works too, and counts board edits like any other, because the board saves through
the same `saveProject`.

### Why a file and not a tab's own storage

`design.md` is the only file in a project that is not code — the game runner, the linter,
`loadCode`'s formatter and the `parses:` rule all skip it (`isCodeFile` in js/project.js), and the
AI can only write `.js`, so the Build panel cannot rewrite it.

A file rather than a key in progress state, and the reason is one button: **Reset my progress** sits
under a heading called *Testing* and promises only to clear XP, Stars, assets and lessons. Notes kept
there would be destroyed by it, silently, and the one-sheet is the only thing in a project a student
cannot get back by reading the starter. As a file it survives that, survives Reset-the-game (which
restores code only, deliberately), and stays visible to the tutor and the grader — `aiContext()`
sends project files and nothing else.

It is not in the Code tab's file tree. The board is its editor; a second row in that tree opening the
same writing as raw markdown would be a second place to look for one thing.

### The coach

On the Design tab the assistant panel's **Build** side is switched off — it edits game files and
there are none on that tab — and its **Tutor** side answers as the `design-coach` agent
(`ai/agents/design-coach.md`), which is given the board's boxes, its loose notes and the lesson the
student is on. It asks and they write; it never fills a box in. Editing that prompt changes how it
behaves, like every other agent.

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
- `yourturn` steps do **not** count. Insisting a student change their own game before the page
  will let them move on would wall off the course for anyone stuck on it.
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
