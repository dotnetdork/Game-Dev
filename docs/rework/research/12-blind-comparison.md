# Blind comparison: old app vs new template — 2026-09-25

Asked for by Jay after pointing out that the first comparison (`11-critique-new-template.md`, 26 vs
20) was biased: unequal targets, the designer's own agents grading his design, a template built to
the same rubric, a primed reviewer. This round: **two independent reviewers**, the products
unlabelled ("X" = the old app, live at localhost; "Y" = a copy of `wireframes/02-first-run-engine.html`
with its design notes stripped), neutral audience context only, the same tasks for both, told not to
open the repo.

**Limits of this round:** (1) blindness leaked — the harness gives every agent the repo's
`CLAUDE.md`, so at least one reviewer knew X was the repo's app; (2) the two reviewers shared X's test
account at the same time, so each saw drifting state (lessons already done, other chats); (3) Y is
**wireframe 02**, the click-through — the click-proof shift (`wireframes/03`) was not in this round;
(4) both are still AI reviewers, not kids.

## Scores

| | Reviewer 1: X | Reviewer 1: Y | Reviewer 2: X | Reviewer 2: Y |
|---|---|---|---|---|
| Nielsen (/40) | 28 | 25 | 27 | 26 |
| Comparable-only subtotal | 14/20 | **16/20** | 16/24 | **19/24** |
| Clarity of what to do (/4) | 2 | **3** | 2 | **3** |
| Hands-on doing (/4) | **3** | 2 | **3** | 1 |
| Resists mindless clicking (/4) | **2** | 1 | **2** | 0 |
| Likely learning / retention (/4) | **3** | 2 | **3** | 2 |

**Both reviewers agree:** Y is better at **clarity and guidance** (one obvious next step, big
buttons, ~8 controls and ~84 words on the first screen vs X's ~34 controls and ~280 words). X is
better at **substance**: a real code edit, a real playable game, a live Inspector, a practice check
that verifies, and more concrete game ideas a kid would remember (loop, frame, fps, lag, sprite sheet,
gravity). Y can be finished in **12 blind clicks in 24 seconds**, its choices are ignored (pick a cat,
get a robot), and its game can't be played at the peak.

## What each reviewer said a kid would remember

- **X:** game loop, 60 frames a second, lag, frame, sprite / sprite sheet / tilemap, gravity adds to
  speed, "change a number in config.js and the game changes."
- **Y:** the Play button, "changes during Play don't stick", Hierarchy, Inspector, player/coin/lava,
  "a studio has art, audio, design and engineering."

## Found in the old app (worth fixing regardless)

The practice steps say "Game tab" but the tab is **Play**, and config.js says "press Run" · the
"Check my work" result lands below the fold · a lesson completes on quizzes alone, without the
practice task · quizzes reveal the answer after two wrong guesses · no "start here", and it can open
mid-course · the Design board opens at 47% zoom, unreadable · the model name shows in the AI panel.

## Reading it

The honest result: **the new template's presentation beats the old app's, and the old app's
substance beats the new template's.** Wireframe 02 was a click-through, so its "hands-on" and
"click-proof" scores were near zero — exactly Jay's objection. Wireframe 03 was built to fix that (real
play, real edits, gates that need evidence), but it has not been through a blind comparison. The fair
next test is **wireframe 03 against an old lesson's practice task**, same tasks, reviewers on
separate accounts — and, in the end, kids.
