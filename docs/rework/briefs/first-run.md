# Brief: the first run — "Your first day at the studio"

**Status: v3, confirmed by Jay 2026-09-25 ("fine for now") — Jay's decisions from the first-day critique; wireframe:
`../wireframes/04-first-day.html` (built from `../wireframes/src/`).** v2 (confirmed the same day,
wireframes `01` and `02`) was a demo the kid watched: about 13 taps, two of them real, no keyboard,
and choices that changed nothing (critique 22/40, `.impeccable/critique/`). Jay's own question about
it — "what is the student even supposed to do here?" — is what `../core-loop.md` answers with shifts.

**v3 in one line: the first day *is* the first shift.** The kid clocks in, presses Play on the
intern's broken game, finds what's wrong by playing it, fixes it with their own hands, and the level
they fixed becomes their game.

Jay's decisions (2026-09-25):
- **The first day is the first shift** (not a demo with a mini-shift bolted on).
- **No nickname step.** The kid is greeted by their sign-in name: the tester username today,
  OAuth later (`app/auth.js`, the header at :20–35).
- **One quick hero pick** after the fix; the chosen hero is the one they play as from then on.
- **The two fun questions move to the end of the day**, asked while the kid's game runs.
- **The kid picks which problem to fix**, and the pick sets their first department and who shows up.

## 1. Who arrives and why
A 10–13-year-old signing in for the first time, possibly new to computers. In the story: **their
first day as the new developer at a game studio.** Mode: Experience. The mentor (the studio's AI,
openly and proudly) runs it.

## 2. What success looks like
In about five minutes the kid has **played a game with the keyboard, found a real problem by playing
it, fixed it by hand, made the classic Play-mode mistake themselves, and played their own game with a
hero they chose.** They know where the game, the parts, the knobs and the mentor live. Proof: hands
on the keyboard in the first minute, and a coin grabbed in their own game before five.

## 3. The beats (~5 minutes)

The engine still **builds itself around the kid**: each beat opens one dock, in its final place,
and the mentor names it in one sentence (feel → see → name).

1. **Clock in.** Nearly empty editor, the mentor's dock only. "Welcome to the studio, {sign-in
   name}! Our last intern left a game half-finished. Let's see how bad it is." The **Game view**
   opens with the intern's grey game.
2. **Press Play.** **Play** appears in the toolbar with a cue; the only way on is to press it. Keys
   show on the game. The game is grey, silent, a floor tile you fall straight through, and lava that
   doesn't hurt. **Gate: the kid plays until they hit a problem** (fall through the floor, or grab a
   coin and hear nothing).
3. **What needs fixing first?** Stop. Four answers, shuffled, each a thing they could see or feel,
   each labelled with its department: *I fell through the floor* (Engineering) · *Grabbing a coin
   makes no sound* (Audio) · *Everything is grey* (Art) · *Touching the lava does nothing* (Design).
   **The pick sets the first department** and that department's head runs the fix. All four branches
   are built in the wireframe.
4. **Fix it by hand**, one job per department, each tested in play:
   - **Art:** colour the coin and the lava in the Inspector (Sprite Renderer → Color), then find the
     coin in play. *Colour tells players what matters.*
   - **Audio:** pick the coin a sound (real CC0 sounds), then grab a coin and hear it; a pop shows it
     for a muted room.
   - **Design:** turn on *Hurts player* for the lava, step in it once and get sent back, then jump
     past it to the far coin.
   - **Engineering (the floor):** The lead programmer: "That floor tile is just a
   picture. Nothing tells the game it's solid." The **Hierarchy** opens with the level's parts; the
   kid finds *Floor tile (broken)* and taps it; the **Inspector** opens; the kid turns on **Solid**
   (Unity: Box Collider 2D, a familiar word here, owned in session 5). **Gate: Play, and walk across
   the fixed tile.**
5. **The Play-mode mistake — the kid's own.** "While it's running, make the coin bigger." The kid
   taps *Coin*, drags **Size** during Play, and the coin grows. "Now press Stop." It snaps back. "It
   changed back! Changes made while playing don't stick. Every developer does that once." **Gate:
   Size changed during Play, then Stop pressed.**
6. **It's yours.** "This level is fixed. It's yours now: {name}'s Game." One pick: **your hero**
   (cat · robot · knight · slime, shuffled). The pick is echoed as the kid's own line and the hero
   replaces the intern's grey box.
7. **Play your game** (the peak). Their hero, their keys. **Gate: grab a coin in your own game.** The
   first earned things arrive: a **star** and the **Play mode** card.
8. **Get to know you** (moved here). While their game runs behind: "You find a locked door. What do
   you do?" (hunt for the key · smash it · sneak round the back · get a friend) and "Which game could
   you play all day?" (options, no typing required) with a reflect-back. Both feed the learner card;
   neither changes the screen.
9. **What's next.** The **Quest** dock appears with their first department and a teaser; the
   **Project** drawer shows one card; the stars bar shows one star.

## 4. Scope and boundaries
One flow, 9 beats, in the engine look (`DESIGN.md`) at 1366×650, with all four fix branches built. **Anti-goals:** forms; surveys or tests; more than one sentence at a time;
asking for a real name, age or school; drag being the only way to do something; a tour of panels;
any option that leads to the same outcome as its alternatives without saying so.

## 5. States
Doesn't find a problem (after ~30 s of play the mentor points: "Try walking over that floor") ·
doesn't spot Play (the mentor points at it after a pause) · picks a non-Engineering fix (that
department's own fix and character, then the same beats from 5 on) · returning kid ("welcome back", straight to
their desk) · AI unavailable (every beat has authored lines; nothing here needs an AI call) · muted
room (nothing in the first day depends on hearing, except noticing the silent coin, which is one of
four problems).

## 6. The learner card (seeded here, grows as they go)
- **Picks (closed tags):** first department (from the fix pick), hero, kinds of fun (locked door),
  favourite games.
- **Noticed:** reading and clicking comfort; pace; which problem they hit first; how long they
  played before hitting one.
- **Skills:** the first-day concepts enter at "new": game engine, Play mode, Hierarchy (and the
  Inspector and "solid" as familiar).
- **Never:** real name, birthday, school, location, photos, voice, stored chat transcripts. The kid
  and teacher can see and reset the card. The sign-in name is shown, not stored in the card.

## 7. Not to be invented by the wireframe
The mentor's and department heads' names, looks and voices · the exact locked-door and favourite-game
options (content) · the intern's game's final art.
