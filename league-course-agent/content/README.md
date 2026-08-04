# Course content

Edit these files to build the course — no app code required.

## `course.yaml`
Defines modules and their lessons, in order. Each lesson id maps to
`lessons/<id>.md`. `stars` is awarded when the whole module is completed.

## Lessons — `lessons/<id>.md`
Each lesson is Markdown with a YAML **front-matter** block at the top:

```
---
title: Welcome
xp: 250
ai: full          # full | guided | off  (controls the AI panel for this lesson)
summary: One line shown under the title.
---

# Markdown body goes here
```

- `ai: full` = normal AI help; `guided` = student must say exactly what to change;
  `off` = AI disabled for that challenge.
- **Quote any value that contains a colon**, e.g. `summary: "Fun: challenge, feedback, reward."`
  (an unquoted colon breaks YAML).

## Runnable code
Use a fenced block tagged `run` to make an editable, runnable JavaScript cell
(sandboxed; output shows below it):

    ```run
    console.log("hello");
    ```

Standard Markdown (headings, lists, **bold**, images, `> quotes`, normal ```js code blocks) all render.
Quizzes, in-lesson challenges, and tutor checkpoints are coming once we finalize their syntax.

## Interactive widgets (provisional syntax)

These use fenced code blocks. The exact syntax may change once we finalize the widget format, but content is easy to convert.

Quiz — multiple choice (`answer` is 0-based):

    ```quiz
    type: mcq
    prompt: When does update() run?
    options:
      - Once at the start
      - Every frame
    answer: 1
    ```

Quiz — Parsons (list the lines in the CORRECT order; the app shuffles them for the student):

    ```quiz
    type: parsons
    prompt: Order these steps.
    lines:
      - First step
      - Second step
    ```


Reminder: quote any value containing a colon.
