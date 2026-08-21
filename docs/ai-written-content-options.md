# Should the AI write the questions and challenges?

**For:** discussion
**From:** Jay
**Date:** 21 August 2026
**Decision needed:** how much of the course content the AI writes, and who checks it.

No technical vocabulary in this document. It is written to be read by someone who has
never seen the code.

---

## Where we are today

Every question and every challenge in the course is written by hand and stored in the
lesson files. There is one exception: after a student accepts a change the AI has made
to their game, the app sometimes asks a single question about that change. That one is
written by the AI, on the spot.

## Why this is worth deciding

Writing questions and challenges by hand is the slowest part of building the course.
Having the AI write them would be dramatically faster, and would mean students don't all
see the same thing. The catch is what happens when the AI gets one wrong.

## The thing to understand before choosing

The app already refuses to trust the AI anywhere it can check it. When the AI changes a
student's game, four separate checks run before the student sees anything:

- Does the artwork it used actually exist, or did it invent a name?
- Is that a real feature of the game engine, or something it made up?
- Will the keyboard code actually work, or crash on the first frame?
- Did it claim to change something without actually changing anything?

Any failure and the AI is told what it got wrong and asked to try again. Fail twice and
the change is refused, and the student's game is left alone.

**Questions are different.** "Is this the right answer?" cannot be checked by a program,
because it is a judgement, not a fact. So this is the one place that safety net does not
reach.

We have already seen what that costs. The question the AI asks today is checked for
whether a question came back, and whether it has a list of options — but not for whether
the marked answer is correct. If the AI miscounts, which small AI models do routinely,
**the app marks the wrong option green and tells the child they are wrong when they are
right.** Silently, with nothing looking broken. That specific hole is being closed
regardless of which option below is chosen. It is included here because it is the clearest
illustration of the risk, and it was found by reading the code rather than by anyone
noticing it in use.

---

## Option A — A person looks at it once, before any student does

The AI writes questions and challenges into the lesson files. A person skims them and
keeps the good ones. An automatic script confirms every challenge is genuinely broken to
begin with and genuinely fixable. They then become ordinary course content, no different
from anything written by hand.

**For**

- The AI still does the writing, so it is still far faster than by hand — twenty
  challenges in an afternoon rather than a week.
- Nothing unchecked ever reaches a child.
- The course can be proofread, which means it can be shown to a school and defended.
- When something is wrong it can be found and fixed, because every student sees the same
  thing.
- Students can still get variety: write five versions of each question and let the app
  pick one per student.

**Against**

- Someone has to do the skimming, and that someone is currently one developer.
- Adding content is a task rather than something that happens automatically.

---

## Option B — The AI writes it fresh, while the student waits

Every student gets questions and challenges written for them in the moment they open a
lesson.

**For**

- The most personal it can possibly be. Nobody sees the same course twice.
- No authoring work at all once it is built.

**Against**

- Nothing can be proofread, because nothing is fixed. We could not say with confidence
  what the course asks.
- A wrong answer key reaches a child directly, with nothing in between.
- A challenge might be impossible, or already solved before they start, or run forever.
  There are five separate things a challenge has to get right at once, which is precisely
  why a checking script exists for the hand-written ones.
- The student waits. On the local AI this is several seconds per question — tolerable for
  one person testing, a problem for a room of twenty-five thirteen-year-olds.
- If a student says "this question is broken," it cannot be reproduced, so it cannot be
  fixed.

---

## Option C — Split by what is at stake

Reviewed, fixed content for anything that awards points or unlocks the next lesson.
AI-written content only for extras: the question about the change they just made, or an
optional bonus question.

**For**

- A mistake costs a moment of confusion, never progress. Nothing a child earned is ever
  at risk.
- Keeps the one feature that genuinely cannot be written in advance — a question about
  *this student's own code*, which no author could have anticipated.

**Against**

- Two systems to maintain instead of one.
- The line between "this counts" and "this doesn't" has to be actively held, or it drifts
  and the guarantee quietly stops being true.

---

## A separate question, easily confused with the above

**How much should the AI know about the individual student?**

There is no login yet, so there is no student record anywhere. What the app does keep, on
the child's own machine, is their progress: which lessons they finished, their points, and
how many attempts each challenge took.

The useful and safe version is to keep a little more of that — whether a question was
right first time, whether they gave up and asked to be shown the answer, which error
messages keep coming back — and use it to pick a harder or easier version of an
already-approved question.

It stays on their own device and is never sent anywhere. Under our own privacy brief that
is the strongest position available: nothing is collected, so there is nothing to store,
disclose, or delete.

One limitation worth saying out loud rather than discovering later: without a login, "the
student" really means "this browser on this Chromebook." A different machine is a
different student. That is a reason to keep this modest until logins exist — not a reason
to skip it.

---

## Recommendation

**Option A, keeping the one existing live feature as it is** — the question about the
change the student just made, now with its answer properly checked before it is shown.

That combination keeps the speed benefit of having the AI write content, keeps the one
genuinely personal feature that no author could write in advance, and means nothing
reaches a child that a person has not read.

---

## Questions for the room

1. **Who is willing to skim AI-drafted questions?** Today that is one developer, and it
   is the real constraint on Option A. If a teacher would do it, Option A gets much
   stronger.
2. **Is a wrong answer key acceptable at all** — even on an optional bonus question that
   awards nothing?
3. **If we go with fixed, reviewed questions, is five versions per lesson enough variety?**
   Or is the real concern that students will share answers, which is a different problem
   with different answers?
4. **Will we ever need to show a school exactly what the course asks?** If yes, that rules
   out Option B on its own, before any of the rest is weighed.
