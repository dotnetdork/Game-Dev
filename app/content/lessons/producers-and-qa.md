---
title: Producers & QA Testers
xp: 300
ai: full
summary: Shipping the game — and hunting the bugs.
---
- **Producer** — keeps the team on track: schedule, priorities, removing roadblocks.
- **QA tester** (Quality Assurance) — plays the game on purpose to *find bugs* before players do, then writes up exactly how to reproduce them.

Be a tester for a second. One of these lines has the bug that makes the score never change. Click it:

```quiz
type: findbug
prompt: The score is supposed to go up by 1, but it never changes. Which line is the bug?
code:
  - "function catchStar() {"
  - "  score = score;"
  - "  scoreText.setText('Score: ' + score);"
  - "}"
answer: 1
explain: "score = score; doesn't change anything. It should be score = score + 1."
```
