# Authoring the course

Everything here is editable without touching app code.

## course.yaml
Modules in order; each lists lesson ids that map to lessons/<id>.md.
`stars` is awarded when the whole module is completed.

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
    code: |
      // starter code, deliberately incomplete
      if (somethingIsTrue) win();
    ```

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

`reward:` **awards a real badge.** It is recorded against the student, shown in the trophy case in
the status bar, and cannot be bought with Stars — that is the whole point of it. Two rules:

- **Every reward name must be unique across the whole course.** Badges are stored by name, so a
  duplicate means the second lesson awards nothing while still promising it. `npm test` fails on
  this.
- Name it after the skill, not the lesson ("Bug Hunter badge", not "Lesson 14 badge").

Checking is the student's word for now — they press "I've done this". A future stage verifies it
against their actual project, and only this step changes.

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
