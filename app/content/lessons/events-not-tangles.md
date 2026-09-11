---
title: Events, Not Tangles
xp: 220
ai: full
summary: How parts of a game talk without everything knowing about everything.
---

Your score should not need to know the player exists.

That sounds like a strange thing to say. But the moment the score knows about the player, changing
one means changing both — and after a few weeks of that, changing anything means changing
everything.

## Calling things by name

The obvious way for two parts of a game to talk is for one to call the other:

```
function collectCoin() {
  score = score + 1;
  scoreText.setText("Score: " + score);
  playSound("coin");
  showSparkle(coin.x, coin.y);
  checkForLevelUp();
}
```

That works. And for a small game it's absolutely fine — don't let anyone tell you otherwise.

```run
// @goal: Add parts to the game, and count the connections each way.
// @slider: parts 2 8 1 5
// @demo: compare
// @feed: callingByName, announcing
const callingByName = parts * (parts - 1) / 2;   // everyone can call everyone
const announcing = parts;                        // everyone talks to one place
```

But look at what `collectCoin` now has to know about: the score, the text on screen, the sound
system, the particle effects, and the levelling rules. Five things. Collecting a coin is
suddenly the most connected function in your game.

## Why that gets tangled

Add a feature — say, a combo counter — and you edit `collectCoin` again. Now it knows about six
things.

Then you want combos on enemy kills too, so `killEnemy` needs the same five lines. Then you change
how sparkles work and have to find every place that makes one.

This is the tangle. Nothing here is *wrong* exactly; it just gets harder to change every week, and
eventually people stop wanting to touch it.

> The question isn't "does this work?" It's "what do I have to know about to change this?"

```quiz
question: Why is it a problem when `collectCoin()` directly calls the score, the sound, the sparkles and the level-up check?
options:
  - It has to know about five separate systems, so changing any of them means changing it too
  - It will run too slowly
  - Phaser does not allow it
  - Functions can only call one other function
answer: 0
feedback:
  - Right. The cost is not speed, it is how much you have to hold in your head to change anything.
  - Five function calls is nothing to a computer.
  - Phaser allows it. It is just harder to live with.
  - They can call as many as you like — that is the problem, not a rule.
explain: Direct calls create knowledge. The more each part knows about the others, the more places you must edit to change one thing.
```

<figure class="diagram">
  <img src="/content/images/events-vs-tangles.svg" alt="Left: five parts of a game all calling each other, making a tangle of crossing lines. Right: the same parts, each connected to one central announcement.">
  <figcaption>Same five parts, same game. The left needs eight connections and the right needs four — and the right one does not grow when you add a fifth part.</figcaption>
</figure>

## Announcing instead

The alternative is to have `collectCoin` **say what happened** and stop caring who is listening:

```
function collectCoin() {
  emit("coin:collected", { x: coin.x, y: coin.y });
}
```

Elsewhere, each system says what it cares about:

```
on("coin:collected", addToScore);
on("coin:collected", playCoinSound);
on("coin:collected", makeSparkle);
```

Now `collectCoin` knows about **nothing**. Adding a combo counter means adding one more listener —
you never touch the coin code again. Removing sparkles means deleting one line.

```run
// @goal: Add features that care about a coin. Watch what happens to the coin code.
// @slider: features 1 6 1 3
// @demo: compare
// @feed: linesInCollectCoin, systemsItKnowsAbout
const linesInCollectCoin = features;   // one line per thing that cares
const systemsItKnowsAbout = features;  // and it has to know each of them by name
```

This app works exactly this way. When you finish a lesson, the code that completes it doesn't call
the outline, the XP bar and the progress strip by name — it announces "a lesson finished" and those
three listen. Before that change, finishing a lesson accidentally wiped the answers that had just
triggered it, precisely because the finishing code was reaching into things it shouldn't have known
about.

## When announcing is the wrong answer

Now the honest part, because this idea is easy to over-apply.

Announcing has a real cost: **you can no longer see what happens next by reading the code.** With a
direct call, you follow it. With an event, you have to go and find every listener, and if there are
none, nothing happens and nothing tells you.

So use it where the connection is genuinely one-to-many, or where the two parts have no business
knowing about each other. For two things that are tightly related and always will be, a direct call
is clearer and you should just make the call.

| Use a direct call | Announce instead |
|---|---|
| The player asks its own body to jump | Something scored |
| A function calls its own helper | The player died |
| Two things that are one idea | The level was completed |

```challenge
title: Lab — the tangle
task: One function reaches directly into four systems, so every change touches it. Make it announce what happened instead, and let the systems listen.
hint: There is already an `on()` and an `emit()` below. Try making `collectCoin` emit one event, and registering the four systems as listeners instead.
solution: |
  // The goal: collectCoin must know about NOTHING. It announces; others listen.
  const listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function emit(name, d) { (listeners[name] || []).forEach(function (f) { f(d); }); }
  let score = 0, sounds = 0, sparkles = 0, combo = 0;
  let knows = 0;                       // how many systems collectCoin refers to
  on("coin:collected", function () { score = score + 1; });
  on("coin:collected", function () { sounds = sounds + 1; });
  on("coin:collected", function () { sparkles = sparkles + 1; });
  on("coin:collected", function () { combo = combo + 1; });
  function collectCoin() {
    emit("coin:collected", {});        // knows about nothing at all
  }
  for (let i = 0; i < 5; i++) collectCoin();
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText("score " + score + "   sounds " + sounds, 10, 30);
  ctx.fillText("sparkles " + sparkles + "   combo " + combo, 10, 50);
  ctx.fillText("systems collectCoin knows about: " + knows, 10, 80);
  if (knows === 0 && score === 5 && combo === 5) {
    ctx.fillStyle = "#3ddc84"; ctx.fillText("Untangled — and everything still happens.", 10, 120); win();
  } else {
    ctx.fillStyle = "#f5b02e"; ctx.fillText("Still reaching into " + knows + " systems.", 10, 120);
  }
code: |
  // The goal: collectCoin must know about NOTHING. It announces; others listen.
  const listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function emit(name, d) { (listeners[name] || []).forEach(function (f) { f(d); }); }
  let score = 0, sounds = 0, sparkles = 0, combo = 0;
  let knows = 4;                       // how many systems collectCoin refers to
  function addToScore()  { score = score + 1; }
  function playSound()   { sounds = sounds + 1; }
  function makeSparkle() { sparkles = sparkles + 1; }
  function bumpCombo()   { combo = combo + 1; }
  function collectCoin() {
    addToScore();                      // it has to know about every single one of these
    playSound();
    makeSparkle();
    bumpCombo();
  }
  for (let i = 0; i < 5; i++) collectCoin();
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText("score " + score + "   sounds " + sounds, 10, 30);
  ctx.fillText("sparkles " + sparkles + "   combo " + combo, 10, 50);
  ctx.fillText("systems collectCoin knows about: " + knows, 10, 80);
  if (knows === 0 && score === 5 && combo === 5) {
    ctx.fillStyle = "#3ddc84"; ctx.fillText("Untangled — and everything still happens.", 10, 120); win();
  } else {
    ctx.fillStyle = "#f5b02e"; ctx.fillText("Still reaching into " + knows + " systems.", 10, 120);
  }
```

Announcing beats reaching in for one reason: the announcer does not have to know who is listening, so adding a fifth listener changes nothing that already works.

```quiz
question: What is the main downside of announcing instead of calling directly?
options:
  - You cannot see what happens next just by reading the code
  - It is much slower
  - It only works in Phaser
  - Only one thing can listen
answer: 0
feedback:
  - Right. You gain flexibility and lose the ability to follow the thread by eye.
  - The speed difference is negligible.
  - It is a general idea, not a Phaser feature.
  - Many things can listen — that is the whole point.
explain: Events trade readability for flexibility. If nothing is listening, nothing happens and nothing warns you.
```

You do not have to untangle a whole game to feel the difference. One connection is enough.

```yourturn
title: Untangle one connection in your game
task: Find one place where two parts of your game know too much about each other.
steps:
  - Open the Code tab and find a function that calls three or more different things.
  - Ask honestly whether those parts really need to know about each other, or just happen to be called together.
  - If they do not, have the function announce what happened instead, and move the work into listeners.
  - If they do — if they are genuinely one idea — leave the direct call alone. Knowing when NOT to do this matters as much as doing it.
  - Press Run and check nothing changed for the player.
reward: Untangler badge
```

## Recap

- Direct calls create **knowledge**: the more each part knows about the others, the more places you
  edit to change one thing.
- **Announcing** lets one part say what happened without knowing who cares.
- Adding a listener is a one-line change; editing a tangle is not.
- The cost is real: **you can no longer follow the thread by reading**.
- Use it for one-to-many and for parts that shouldn't know each other. For two things that are one
  idea, just make the call.

goal: The function announces what happened, and the systems react on their own.