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
- Quote any value with a colon, e.g. summary: "Fun: goal, feedback, reward."

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

## Prose
Standard Markdown (headings, lists, **bold**, images, > quotes) renders normally. Plain code
blocks are syntax-highlighted with the same theme as the Code tab.

For an aside, use a `tip` div — it renders as a callout:

    <div class="tip">Sprites are just pictures the game can move around.</div>

Syntax may still evolve; content converts easily if it does.
