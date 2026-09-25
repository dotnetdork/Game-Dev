# Blind comparison, round 2: the shift vs an old lesson — 2026-09-25

The fair test `12-blind-comparison.md` called for: **wireframe 03** (the click-proof "silent coins"
shift, now with C# peek + tweak) against the old app's **"Feedback" lesson**, the same concept,
including its lab and practice task. Two independent reviewers, the products unlabelled ("X" = the
old app, "Y" = a copy of wireframe 03 with its design notes, comments and reviewer text stripped),
the same tasks, told not to open the repo, and told to play games with real key presses.

**Fixed from round 1:** each reviewer had their own old-app server and save directory (no shared
account, no drifting state); Y was the click-proof shift, not the click-through.

**Limits of this round:**
1. **Blindness leaked again.** Both reviewers said the injected `CLAUDE.md` described X, and Y
   carries the League logo. Both said they set it aside; neither guessed which was newer.
2. **My setup error: Y's skip bar was live.** I hid the reviewer step bar with the `hidden` attribute,
   but the stylesheet's `display: flex` overrode it. Both reviewers found it and could click Next
   through every gate. Both scored it as a real weakness; reviewer 1's "resistance" verdict for X
   rests on it (they said Y would score 3, not 2, without it).
3. **My setup error: Y was clipped.** The stand-in page header pushed the 650px editor down to end at
   721px on a 657px screen, so the sound shelf was below the fold. In the product the editor is the
   whole window; the wireframe's own page has the same wrapper problem.
4. X ran with no AI model connected, which matters for one finding below.
5. Still AI reviewers, not kids.

## Scores

| | Reviewer 1: X | Reviewer 1: Y | Reviewer 2: X | Reviewer 2: Y |
|---|---|---|---|---|
| Nielsen (/40) | 25 | 26 | 25 | 27 |
| Comparable-only subtotal (/28) | 17 | **21** | 17 | **21** |
| Clarity of what to do (/4) | 2 | **3** | 2 | **3** |
| Hands-on doing (/4) | 2 | **4** | 2 | **4** |
| Resists mindless clicking (/4) | **3** | 2 | 2 | **3** (1 counting the skip bar) |
| Likely learning / retention (/4) | 2 | **3** | 2 | **3** |

**Against round 1**, the old app's substance lead is gone on this concept: hands-on went from X 3 /
Y 1–2 to X 2 / Y 4 in both reviews, and learning from X 3 / Y 2 to X 2 / Y 3. Click-resistance is
split, and the split is the skip bar (limit 2).

**Both agree:** Y is clearer (one obvious next step in about 10 seconds; ~350–450 words vs ~1,100–1,240)
and far more hands-on (play, diagnose, slot sounds, mix, find a line of C#, edit and save a value).
Y's words carry to Unity (Audio Source, Audio Mixer, `PlayOneShot`, Inspector slots), with Godot
and Unreal names on the card. X's lab really checks code, but it is JavaScript pitched too hard for
new 10-year-olds, and most of X's other "interaction" is watching demos.

## What each reviewer said would stick

- **X:** "feedback", the four channels (see / hear / move / change), "about a tenth of a second",
  "failure needs feedback too". General; little maps to Unity.
- **Y:** "feedback = the game answers you", match the sound to the action ("a jump goes up, so the
  sound goes up"), "the music can bury the effects", Audio Source/Mixer, `PlayOneShot`, pitch.

## Checked against the code

- **X's "Check my work" passes untouched starter code — true in this setup.** The lesson's practice
  has no `check:` rules, so the AI grader decides; when the grader can't answer, it awards the
  practice (`app/public/js/widgets.js:949`, "benefit of the doubt"). With no model connected it always
  passes. In a class with the AI up, the grader would judge. Adding `check:` rules to the lesson would
  close this, but `app/content/lessons/` is Jay's to change.
- **Y accepted a buzz on the jump — true, fixed** (c6d00b1): the sounds step now challenges a
  failure sound on the jump as well as the coin.
- **"Y's mixer advanced after one drag" — expected.** The gate is that the coin is grabbed while
  sound effects are louder than the music; one large drag can meet it. A coin grabbed with the music
  louder doesn't count (the gate script checks this).
- **X's lab rejecting a visible `fillStyle` flash, and a stale pass banner** — reported by reviewer 1,
  not checked.

## Open findings in Y (not fixed yet)

- **A wrong diagnosis costs a full two-coin replay.** Reviewer 2 thinks a bored kid quits here. A
  lighter penalty (replay until the first coin) would keep the point.
- **The lava jump took ~5 tries and a death shows nothing** — deliberate in the customer's silent
  game, but ironic in a lesson about feedback; worth a one-line hint after two deaths.
- **The return question says the jump is silent** after the kid gave it a sound. It's meant as a new
  bug weeks later; it needs to say so ("in your new level…").
- **The game shrinks to ~344px during the code step**, and the "THUD" pop is faint on the light sky.
- **"Say something else…" does nothing** (scripted), and "name TBD / face TBD" placeholders show.

## Reading it

On the same concept, with separate accounts and the click-proof shift, **the new shift wins on
clarity, hands-on doing and likely learning in both reviews**, and ties or loses on click-resistance
only because of a skip bar I left live. That answers round 1's open question in the shift's favour,
with the usual caution: it is one shift against one lesson, judged by AI reviewers who could tell
which product was the repo's own. The next real evidence is kids.
