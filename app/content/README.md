# Authoring the course

Everything here is editable without touching app code.

## course.yaml
Modules in order; each lists lesson ids that map to lessons/<id>.md.
`stars` is awarded when the whole module is completed.

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

## Runnable cells (```run)
Editable JavaScript + Run button. Optional directives as // comment lines:
- // @goal: <text>       shows a goal banner
- // @expect: <text>     after Run, if output contains <text> it shows "Goal met!"
- // @slider: name min max step value   adds a live slider; `name` is set for you and re-runs on drag

## Quizzes (```quiz) — checked locally, answer is 0-based
- type: mcq        options + answer + optional feedback[] per option
- type: predict    like mcq but shows read-only `code:` first (predict the output)
- type: parsons    lines: [...] in correct order; optional distractors: [{text, why}] (drag to order)
- type: fillblank  code with ___ becomes an input; answer may be a list; optional explain
- type: findbug    code: [lines...]; student clicks the buggy line; answer is the 0-based line index; explain

Standard Markdown (headings, lists, **bold**, images, > quotes, plain code blocks) renders normally.
Syntax may still evolve; content converts easily if it does.
