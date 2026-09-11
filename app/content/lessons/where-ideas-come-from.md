---
title: Where Ideas Come From
xp: 200
ai: full
summary: Ideas are not lightning. They are two things you already know, stuck together.
---

Nobody sits down in front of a blank screen and invents a game out of nothing. That is not how any
of the games you have played were made, and believing it is how people end up staring at a blank
page deciding they are not creative.

Here is what actually happens. Somebody takes a thing that already exists and changes **one rule
about it**.

```run
// @goal: Two lists and a dial. Drag it — every one of these was somebody's real game.
// @slider: twist 0 7 1 3
const bases = ["a platformer", "a racing game", "a farming game", "a shooting game"];
const twists = [
  "but you only get one life, ever",
  "but the level is dark and all you have is a torch",
  "but everything you touch turns to gold",
  "but you play as the enemy",
  "but time rewinds five seconds every time you die",
  "but you cannot jump",
  "but the ground falls apart behind you",
  "but you have to teach somebody else to do it"
];
const base = bases[twist % bases.length];
console.log(base + " " + twists[twist]);
console.log("");
console.log("Sounds like a game? Several of those made their studios rich.");
```

## Every game you love is a remix

Not a copy — a remix. Somebody kept most of a thing and changed a bit of it:

- **Celeste** is a platformer where you get one dash. That is it. One extra move, and it became one
  of the best-reviewed games of its year.
- **Minecraft** is a survival game where the whole world is made of blocks you can take apart.
- **Fortnite** is a shooting game where you can build walls in the middle of a fight.
- **Vampire Survivors** is a game about shooting hundreds of monsters — with the shooting taken
  out. You just walk, and it fires by itself.

That last one is worth sitting with. The idea was **removing** something.

```quiz
question: What did the maker of Celeste actually add to the platformer that already existed?
options:
  - One new move, and then built everything around it
  - A completely new kind of game nobody had seen
  - Better graphics than other platformers
  - More levels than other platformers
answer: 0
feedback:
  - Right. One dash. The idea was small and the work went into making it feel perfect.
  - It is a platformer. You run and you jump, the same as Mario does.
  - The art is lovely, but a prettier platformer is not a new game.
  - Lots of levels is more work, not a different idea.
explain: The idea was one move. Everything good about that game comes from taking one small change seriously.
```

So the question is never "what game should I invent". It is "what do I keep, and what one thing do
I change".

## One verb

Here is the most useful test anybody will teach you this term. Every good game is **one verb done
well**.

Mario **jumps**. Minecraft **digs**. Portal **shoots doors**. Flappy Bird **flaps**. Tetris
**rotates**. Say the verb out loud and you know whether you have a game or a wish.

```run
// @goal: How many different things can the player DO? Drag it and see what company you are in.
// @slider: verbs 1 8 1 1
const known = [
  "Flappy Bird — flap. That is the entire game.",
  "Mario — run and jump. Two verbs, forty years.",
  "Celeste — run, jump, dash.",
  "Zelda — move, hit, block, use a thing.",
  "Minecraft — mine, place, craft, fight, eat.",
  "A studio with two hundred people in it.",
  "A studio with two hundred people and five years.",
  "Nobody. This is where school projects go to die."
];
console.log(verbs + " verb(s):  " + known[verbs - 1]);
console.log("");
console.log(verbs <= 2
  ? "Start here. You can always add a third one later."
  : "That is " + (verbs - 2) + " more than a first game needs.");
```

Notice that the games at the top of that list are not the simple ones. They are the famous ones.

## Three places to look for your one change

When you are hunting for a twist, you do not need inspiration. You need somewhere to look. There
are three, and they always work:

- **Change the rule.** What if you could not jump? What if you had one life? What if the coins
  chased *you*?
- **Change who you are.** The starter game has you playing a little person collecting coins. What
  if you were the coin? What if you were the ground?
- **Change what you can see.** What if the screen only showed a circle around you? What if the
  level was pitch dark until you touched something?

Every one of those is a real game somebody has shipped.

```quiz
question: Which of these is an actual idea you could start building tomorrow?
options:
  - 'A platformer where the platforms disappear one second after you land on them'
  - An open-world adventure with a huge map and lots of characters
  - A game like Fortnite but better
  - A really fun multiplayer game
answer: 0
feedback:
  - Right. It names one change to one thing, and you could build it this week.
  - That describes a size, not an idea — and a size no class can build.
  - '"Better" is not a change. Better how? That is the actual question.'
  - Everyone wants that. It does not tell you what to type on Monday.
explain: An idea you can build says what changes. If your pitch would fit a hundred different games, it is not an idea yet.
```

Your turn to have one. It does not have to be good yet — first ideas rarely are, and you will get
to change it at the end of this module.

```yourturn
title: Name the one thing you do
task: 'Write one line on your own board: the verb your game is about. Not the story, not the art — the thing the player actually does with their fingers.'
steps:
  - Open the **Design** tab. That is your board, and there is a sticky on it for every box of your one-sheet.
  - Click the **The one thing you do** sticky and type your verb over the grey prompt.
  - Now press **+** three times and write three twists — one from each of the three places above. Bad ones are fine; you only need one to survive.
  - Leave them in **Ideas, unsorted** for now. Next lesson you cut two of them.
reward: Idea Machine badge
check:
  - changed_at_least: 2
    hint: Nothing has changed yet — open the Design tab and write your verb on the "one thing you do" sticky.
example: The one thing you do is jump, but the platforms vanish a second after you land.
```

## Recap

- Ideas are **remixes**, not lightning. Keep most of a thing and change one rule about it.
- **Celeste** added one dash. **Vampire Survivors** removed the shooting. Small changes, taken
  seriously.
- Every good game is **one verb done well**. Say yours out loud.
- Stuck? Change the **rule**, change **who you are**, or change **what you can see**.
- A real idea says what changes. If your pitch fits a hundred games, it is not an idea yet.
