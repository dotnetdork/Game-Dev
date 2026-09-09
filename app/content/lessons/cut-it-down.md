---
title: Cut It Down
xp: 240
ai: full
checkpoint: true
summary: Rewrite your page now you know what a loop, a reward and a difficulty curve are.
---

```zone
title: Cut It Down
intro: Your page was written by somebody who knew less than you do now. Time to say it in the words you have learned — and to cut it to something you can actually build.
reward: Scope Cutter badge
brief: >
  Five lessons of Core Mechanics just happened: the core loop, feedback, difficulty and flow, risk
  and reward, progression. The student has the vocabulary now, and their page does not use any of
  it. Two jobs here. First, get the core loop out of them in three parts — you do X, the game
  answers with Y, and Z sets up the next go — and check the loop CLOSES. A loop with nothing
  setting up the next go is a game that stops after one turn, and finding that out on paper is free.
  Second, cut. They have almost certainly written down more game than ten weeks holds. Aim them at
  one verb, one obstacle, one reason to keep going, one way to lose, and make sure everything they
  cut lands in the not-building box rather than being deleted.
opener: >
  You have words now that you did not have when you wrote this page — loop, feedback, difficulty,
  risk. So let us start with the big one: what is the loop in your game? Say it as three things,
  one after the other.
slots:
  - My core loop
  - The one thing you do
  - How you lose
  - What makes it mine
  - What I am NOT building
  - What I cut, and when
prompts:
  My core loop: Three parts, one sentence. You do X, the game answers with Y, and Z sets up the next go.
  The one thing you do: Still one verb? If you have collected a second one, this is where it gets cut.
  How you lose: Now you know about difficulty and fairness — is losing the player's fault, or the game's?
  What makes it mine: One twist. If there are still three here, two of them belong in the box below.
  What I am NOT building: Everything you cut. Not a bin — a list you can build from next time.
  What I cut, and when: 'Write the date and what went. You will want to know later whether the cut was right.'
goals:
  - say: Write your core loop in three parts
    slot: My core loop
  - say: One verb, not two
    slot: The one thing you do
  - say: One twist, not three
    slot: What makes it mine
  - say: Say what you cut
    slot: What I cut, and when
  - say: Every box answered
    slot: '*'
```
