---
title: Sound Design
xp: 200
ai: full
summary: Why the same jump feels different with a different noise.
---

Take one jump animation. Give it a soft *boing* and you have a cartoon. Give it a sharp *thud* and
you have someone heavy. Give it a metallic *clank* and you have a robot.

Nothing about the picture changed. Sound did all of that.

## Sound is feedback you can hear

You met **feedback** in Core Mechanics: everything a game does to tell you your action mattered.
Sound is the channel people add last and should probably add first, because it's the cheapest way
to make something feel real.

There's a reason for that. Your ears react faster than your eyes — noticeably faster. A sound that
lands on the exact frame of a hit makes the hit feel solid in a way a visual effect alone doesn't.

```run
// @goal: Play the sound late. Find the point where the hit stops feeling solid.
// @slider: soundDelayMs 0 200 10 0
console.log("the hit lands on frame 0");
console.log("the flash is drawn on that same frame");
console.log("the sound plays " + soundDelayMs + " ms later");
console.log(soundDelayMs === 0 ? "Together. The hit feels solid."
  : soundDelayMs <= 40 ? "Close enough that nobody notices."
  : "Far enough apart that the hit goes soft, and nobody will be able to say why.");
```

> Turn the sound off on a game you like and watch how quickly it stops feeling good.

## Short, sharp, and not annoying

Game sound effects follow rules that seem obvious once you hear them broken:

- **Short.** Most are under half a second. A long sound overlaps with the next one.
- **Sharp start.** No fade-in. The noise must begin the instant the thing happens.
- **Not too big.** It plays hundreds of times a session. Anything dramatic becomes unbearable by the
  twentieth repeat.

That last one is the trap. You pick a satisfying coin sound, hear it five times while testing, and
ship it. The player hears it four hundred times.

The usual fix in real games is **variation** — three slightly different versions picked at random,
so your ear never quite settles. That's why footsteps in good games don't drive you mad.

```quiz
question: Why do most game sound effects last less than half a second?
options:
  - They play constantly, and long sounds overlap and become tiring
  - Short files load faster
  - Phaser cannot play long sounds
  - Players cannot hear long sounds
answer: 0
feedback:
  - Right. It is about repetition, not file size — you will hear this sound hundreds of times.
  - Loading is a minor benefit, not the reason.
  - It can play long sounds fine; that is what music is.
  - They hear them perfectly well. That is the problem.
explain: A sound effect fires again and again. Short and unobtrusive survives repetition; dramatic does not.
```

## Music sets the room

<figure class="shot">
  <img src="/content/images/shots/minecraft-nether.jpg" alt="The Minecraft Nether: a cavernous red landscape of netherrack with lava falls and fire">
  <figcaption>The best-known example of music setting a room is this place. Minecraft's overworld
  music is warm and sparse; the Nether's is a drone with no melody and no rhythm you can hold onto.
  Same game, same controls, same player — and everyone describes walking in here as frightening. The
  picture is doing maybe half of that work.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

<figure class="shot aside">
  <img src="/content/images/shots/minecraft-creeper.png" alt="A Minecraft creeper, the green four-legged monster, seen close up">
  <figcaption>And the most efficient sound effect ever written: a short hiss. No music sting, no
  warning text, no health bar. Players learn it once and then panic every time. That is what a sound
  effect is <em>for</em>.
  <cite><b>Minecraft</b> — Xbox México, CC BY 3.0.</cite></figcaption>
</figure>

Music does a completely different job. A sound effect says *that happened*; music says *this is
what kind of place you are in*.

The clearest proof of this is a sound you already know. A creeper hiss is barely a sound at all —
it is short, quiet, and it will still make an experienced player spin round instantly, because the
game has spent hours teaching them what follows it.
It also explains why muting the music in a horror game makes it stop being frightening while the
monsters carry on behaving identically. Nothing about the rules changed. The room did.
Which means it can be much longer, much more compressed, and it should sit **underneath** the
effects rather than competing with them. If your jump sound gets lost under the soundtrack, the
music is too loud — not the effect too quiet.

Practical starting point: effects at full volume, music at about a third.

```run
// @goal: Set the music under the effects. Find where the jump sound gets lost.
// @slider: musicPercent 0 100 5 33
console.log("jump effect: 100%");
console.log("music:       " + musicPercent + "%");
console.log(musicPercent > 60
  ? "The music is competing. The jump gets lost — and it will feel like the EFFECT is too quiet."
  : "The effects sit on top, which is where they belong.");
```

## Why mute has to work

Now the part that matters more than any of the above, especially for a game played in a classroom.

**Sound must be off by default, and turning it off must be one obvious click.**

Thirty laptops all playing coin noises is a genuinely bad room to be in, and a student who can't
find the mute button will just close your game. This app already defaults to muted for exactly that
reason — look at the speaker icon in the Play tab.

A related rule worth taking seriously: never make a sound the *only* way something is communicated.
Some players are deaf, some have broken speakers, and most people playing in public have the sound
off. If a warning is only a noise, those players never get the warning.

```challenge
title: Lab — the silent game
task: Everything works and nothing makes a sound. Add sound to the moment that matters most — and make sure it is not the only way that moment is communicated.
hint: Look inside `collect()`. It changes the score and shows a flash. What about the third channel — is anything played?
solution: |
  // The goal: the collect moment must reach the player through more than one channel.
  const played = [];
  function playSound(name) { played.push(name); }
  let score = 0, flash = 0, ticks = 0;
  function collect() {
    score = score + 1;
    flash = 5;                       // seen
    playSound("coin");               // and heard
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 6 === 0) collect();
    if (flash > 0) flash = flash - 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = flash > 0 ? "#ffffff" : "#f5b02e";
    ctx.fillRect(140, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score, 10, 30);
    ctx.fillText("sounds played: " + played.length, 10, 52);
    if (score >= 3) {
      if (played.length >= 3) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Seen AND heard.", 10, 90); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Nothing was ever played.", 10, 90); }
      return;
    }
    if (ticks < 60) requestAnimationFrame(step);
  }
  step();
code: |
  // The goal: the collect moment must reach the player through more than one channel.
  const played = [];
  function playSound(name) { played.push(name); }
  let score = 0, flash = 0, ticks = 0;
  function collect() {
    score = score + 1;
    flash = 5;                       // seen... and that is all
  }
  function step() {
    ticks = ticks + 1;
    if (ticks % 6 === 0) collect();
    if (flash > 0) flash = flash - 1;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = flash > 0 ? "#ffffff" : "#f5b02e";
    ctx.fillRect(140, 90, 20, 20);
    ctx.fillStyle = "#eaf1f8"; ctx.font = "13px sans-serif";
    ctx.fillText("score " + score, 10, 30);
    ctx.fillText("sounds played: " + played.length, 10, 52);
    if (score >= 3) {
      if (played.length >= 3) { ctx.fillStyle = "#3ddc84"; ctx.fillText("Seen AND heard.", 10, 90); win(); }
      else { ctx.fillStyle = "#f5b02e"; ctx.fillText("Nothing was ever played.", 10, 90); }
      return;
    }
    if (ticks < 60) requestAnimationFrame(step);
  }
  step();
```

Sound is the cheapest feedback there is, and the easiest to lean on too hard — which is why it should never be the only signal.

```quiz
question: Why should a warning never be communicated by sound alone?
options:
  - Deaf players, broken speakers and muted games all miss it entirely
  - Sounds are expensive to make
  - Phaser cannot play warning sounds
  - Warnings are always visual in games
answer: 0
feedback:
  - Right. Plenty of players never hear it, and most people in public have the sound off.
  - Cost is not the issue.
  - It can play them fine.
  - Plenty of games make this exact mistake — which is why it is worth saying.
explain: Sound is one channel among several. Anything important needs at least one other, or some players never receive it.
```

Your game has one moment that matters more than the others. It should sound like something.

```yourturn
title: Give your game one good sound
task: Add a sound from the Store to the most important moment in your game.
steps:
  - Open the Store, filter to Sounds, and preview a few with the play button. Note the green key of one you like.
  - Open the Code tab and find the moment that matters most — the collect, the hit, the jump.
  - Play it there with `this.sound.play("the-key")`.
  - Press Run, then unmute using the speaker icon in the Play tab.
  - Do the thing ten times in a row. If it is annoying by the tenth, pick something quieter — the player will hear it hundreds of times.
reward: Sound Designer badge
```

## Recap

- Sound is **feedback you can hear**, and your ears react faster than your eyes.
- Effects: **short, sharp start, not too dramatic** — you will hear them hundreds of times.
- **Variation** stops repeated sounds becoming unbearable.
- Music sets the room and sits **underneath** the effects.
- **Muted by default, one click to change** — especially in a classroom.
- Never make sound the **only** way something is communicated.

goal: The moment that matters makes a sound, and it is not the only thing marking it.