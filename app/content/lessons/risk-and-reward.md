---
title: Risk and Reward
xp: 200
ai: full
summary: The choice that makes a moment tense — push on, or take what you've got?
---

It's getting dark in Minecraft. You're deep in a cave, your bag is nearly full of iron, and you can
see a bit more glinting further in. Do you keep going, or head back before something finds you?

Nobody wrote a rule that says "feel tense now." That feeling comes from a **choice with something
at stake** — and it's one of the most powerful tools in game design.

## The shape of it

A risk-and-reward moment needs three things:

1. **Something to gain** if you push on.
2. **Something to lose** if it goes wrong.
3. **A real chance either way** — you genuinely don't know.

Take any one away and the tension vanishes. No gain and there's no reason to risk anything. No loss
and pushing on is obviously correct. No uncertainty and it isn't a choice at all, just a sum.

```run
// @goal: Take the uncertainty to 0%, then to 100%. Watch the decision stop being one.
// @slider: chanceItGoesWrong 0 100 10 40
const gain = 50, loss = 30;
const average = (gain * (100 - chanceItGoesWrong) - loss * chanceItGoesWrong) / 100;
console.log("push on: gain " + gain + ", or lose " + loss);
console.log("chance it goes wrong: " + chanceItGoesWrong + "%");
console.log(chanceItGoesWrong === 0 ? "Free. Everyone pushes on every time — that is not a decision."
  : chanceItGoesWrong === 100 ? "Certain loss. Nobody pushes on — also not a decision."
  : "On average you come out " + average.toFixed(0) + ". The closer that is to zero, the harder the choice.");
```

> If the right answer is always "yes", it isn't a decision. It's a delay.

## You already know a dozen of these

<figure class="art aside">
  <div class="art-row">
    <span class="art-cell"><img src="/assets/coinBronze.png" alt="A bronze coin"><b>safe</b></span>
    <span class="art-cell"><img src="/assets/coinSilver.png" alt="A silver coin"><b>a reach</b></span>
    <span class="art-cell"><img src="/assets/gemRed.png" alt="A red gem"><b>risky</b></span>
    <span class="art-op">·</span>
    <span class="art-cell"><img src="/assets/spikes.png" alt="A row of spikes"><b>why</b></span>
  </div>
  <figcaption>The same idea, told with art instead of numbers. A player reads this row before they
  read any label: bronze is on the path, the gem is somewhere you would rather not stand. Put the
  spikes where the player can see them <em>and</em> see the gem, and you have made a decision
  instead of a trap. <cite><b>Kenney</b> — Platformer Pack, public domain (CC0).</cite></figcaption>
</figure>

- **Minecraft at night** — more ore down there, but you're a long way from your chest.
- **Fortnite's storm** — that loot is good, but the circle is closing.
- **Mario's warp pipes** — skip ahead, but you'll be underlevelled and short of coins.
- **RuneScape's Wilderness** — better rewards, and other players can take everything you're carrying.

Different games, same machine every time: *more, if you're willing to risk what you have.*

## Why "what you're carrying" matters

<figure class="shot">
  <img src="/content/images/shots/minecraft-end.jpg" alt="The Minecraft End dimension: floating pale islands in a black void with tall obsidian pillars">
  <figcaption>The clearest risk-and-reward in any game most students have played. You arrive here
  carrying everything you own, and dying means losing all of it in a place you cannot easily get back
  to. Nothing about the monsters changed — what changed is <em>what you brought with you</em>. That is
  the whole lesson, and Minecraft charges you nothing to learn it.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

<figure class="shot aside pixel">
  <img src="/content/images/shots/asteroids-gameplay.png" alt="Asteroids: a small triangular ship among drifting rocks on a black screen">
  <figcaption>Asteroids charges you for greed too. Shooting a big rock breaks it into faster small
  ones, so every point you take makes the screen more dangerous. The reward <em>is</em> the risk.
  <cite><b>Asteroids</b> (1979) — Atari. Used for teaching commentary; see
  CREDITS.md.</cite></figcaption>
</figure>

Notice how many of those examples involve **losing something you already earned**.

That's deliberate, and it's the strongest version of the mechanic. Losing a chance at something new
stings a bit. Losing something you already worked for stings a *lot* — which is exactly why the
decision feels heavy.

Arcade games leaned on this harder than anything since, and they had a reason: every game ended in
a loss, and the only question was how much you had piled up first. Push on for one more wave and
you might double your score or lose the lot.
This is also why it has to be used carefully with younger players. A risk that can wipe out an
hour's work isn't tense, it's just cruel. Better to risk **this run's** progress than everything
ever.

```quiz
question: In your game, taking the dangerous path always gives more points and there's no real chance of losing anything. What's wrong with it?
options:
  - There's no risk, so it isn't a choice — everyone takes it every time
  - The reward is too small
  - It needs better graphics
  - Nothing, players like points
answer: 0
feedback:
  - Exactly. With nothing at stake, the "decision" has one obvious answer.
  - Making the reward bigger makes it even more obvious.
  - How it looks doesn't change whether it's a real decision.
  - They do — but a choice everyone makes the same way isn't interesting.
explain: A risk-and-reward choice needs something to lose. Without it, the best option is always obvious and nobody actually decides anything.
```

## Let the player see the odds

The worst version of this mechanic is the one where the player can't tell how risky something is.
That's not tension, it's a coin flip — and losing a coin flip just feels unfair.

Good games telegraph it. The cave gets darker. The music changes. The enemy is visibly bigger. You
can *see* that you're pushing your luck, so when it goes wrong it feels like your decision rather
than the game's.

**Rule of thumb:** the player should be able to guess roughly how dangerous something is before
they commit to it.

Here's a choice that isn't one.

```challenge
title: Lab — the choice that isn't a choice
task: The risky chest gives more points and costs nothing. Give it a real downside so the decision actually means something.
hint: Look at `openRisky()`. It only ever adds points. What if it sometimes took some away, or ended the run?
solution: |
  // The goal: opening the risky chest must be a real gamble, not a better version of the safe one.
  let score = 0, lives = 2, log = "";
  const riskyOutcomes = [];
  function openSafe() { score = score + 1; log = "Safe: +1"; riskyOutcomes.push("safe"); }
  function openRisky() {
    if (Math.random() < 0.4) {            // a real chance of losing something
      lives = lives - 1; log = "Risky: trapped! -1 life"; riskyOutcomes.push("lost");
    } else {
      score = score + 4; log = "Risky: +4"; riskyOutcomes.push("won");
    }
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(40, 70, 50, 50);
    ctx.fillStyle = "#d64545"; ctx.fillRect(210, 70, 50, 50);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
    ctx.fillText("safe", 52, 100); ctx.fillText("risky", 220, 100);
    ctx.fillText("Score " + score + "   Lives " + lives, 10, 20);
    ctx.fillText(log, 10, 180);
  }
  // Open the risky chest many times. If every single outcome is identical, it was never a risk.
  for (let i = 0; i < 200; i++) openRisky();
  const outcomes = new Set(riskyOutcomes);
  draw();
  if (outcomes.size > 1) {
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("A real gamble: " + outcomes.size + " different outcomes", 10, 160);
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Risky always does the same thing — that is not a choice", 10, 160);
  }
code: |
  // The goal: opening the risky chest must be a real gamble, not a better version of the safe one.
  let score = 0, lives = 2, log = "";
  const riskyOutcomes = [];
  function openSafe() { score = score + 1; log = "Safe: +1"; riskyOutcomes.push("safe"); }
  function openRisky() {
    score = score + 4;                    // always better. always. why would anyone pick safe?
    log = "Risky: +4";
    riskyOutcomes.push("won");
  }
  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(40, 70, 50, 50);
    ctx.fillStyle = "#d64545"; ctx.fillRect(210, 70, 50, 50);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
    ctx.fillText("safe", 52, 100); ctx.fillText("risky", 220, 100);
    ctx.fillText("Score " + score + "   Lives " + lives, 10, 20);
    ctx.fillText(log, 10, 180);
  }
  // Open the risky chest many times. If every single outcome is identical, it was never a risk.
  for (let i = 0; i < 200; i++) openRisky();
  const outcomes = new Set(riskyOutcomes);
  draw();
  if (outcomes.size > 1) {
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("A real gamble: " + outcomes.size + " different outcomes", 10, 160);
    win();
  } else {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("Risky always does the same thing — that is not a choice", 10, 160);
  }
```

A choice with no downside is not a choice. The moment it can cost you something, the player has to actually think.

```quiz
question: Which of these is the strongest version of a risk?
options:
  - Risking points you already collected this run
  - Risking a small chance at a bonus you never had
  - Risking nothing at all
  - Risking everything you have ever earned in the game
answer: 0
feedback:
  - Right — losing something you worked for is what makes it feel weighty, while keeping the damage to one run.
  - Losing a chance at something you never had barely registers.
  - Then it isn't a risk.
  - That's a real mechanic in some games, but for a young player it usually just makes them stop playing.
explain: The sting comes from losing something already earned — but keep it to the current run, or failure stops being worth risking at all.
```

Your game probably has no decisions in it at all — just things to collect. One real choice changes that.

```yourturn
title: Add one real decision
task: Give your player one moment where they choose between safe and greedy, and both answers are defensible.
steps:
  - Open the Code tab and think about what your player collects or achieves.
  - Add a second option worth more — a harder-to-reach coin, a faster route, a bigger enemy worth more points.
  - Give it a genuine cost. Not certain failure — a real chance of losing something they already have this run.
  - Make the danger visible before they commit. Different colour, closer to a hazard, something.
  - Press Run and play it five times. If you picked the same option every time, the balance is off.
reward: Risk Designer badge
```

## Recap

- A risk-and-reward moment needs **something to gain**, **something to lose**, and **real
  uncertainty**.
- Risking what you have already earned hits hardest — keep it to the current run.
- **Telegraph the danger.** Players should be able to guess the odds before committing.
- If everyone picks the same option every time, it isn't a choice yet.

goal: The risky chest can cost you something, so taking it is an actual decision.