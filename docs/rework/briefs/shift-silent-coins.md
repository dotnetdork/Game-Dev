# Brief: a click-proof shift — "The silent coins" (Audio)

**Status: draft, 2026-09-25**, written to answer Jay's question: how does this teach when a kid could
spam-click through? Wireframe: `../wireframes/03-shift-silent-coins.html`. World: `DESIGN.md`
(the Unity-style editor). Loop: `../core-loop.md`.

## The job
A customer's game "feels dead." The sound designer (character TBD) hands the kid the ticket. The kid
plays it, notices nothing answers when you grab a coin, gives each action a sound, mixes it so it can
be heard, peeks at the C# a programmer would write for it and tweaks one value, and puts the fix
into their own game. **Concepts** (session 4 in `../curriculum-map.md`): feedback†,
sound effect, audio mixer and event, all owned (Unity: AudioSource, Audio Mixer). The C# step
introduces script and variable, which the map places in session 5.

## What makes it click-proof

| Mechanism | In this shift |
|---|---|
| **Progress needs evidence, not clicks** | You can't continue until you've actually **played** and grabbed coins (keyboard), **mixed** the sound so it's louder than the music, and **grabbed a coin in your own game**. |
| **Choices have consequences** | "What felt off?" — a wrong answer sends you back to play and listen. Put a buzz on the coin and it *sounds like getting hurt*; the sound designer says so and you decide whether to change it. |
| **Spam gets noticed** | Three rapid clicks trigger a stop: the mentor asks for a **prediction** before going on. |
| **It comes back later** | A later QA ticket ("the jump in your game is silent") asks the kid to choose the right kind of sound — the idea returns as a decision, scored by code. |
| **Code is a job, with a check** | A programmer drops by and shows `Coin.cs`. "Which line plays the coin sound?" — a wrong pick is explained and asked again. Then the kid changes `pitch` on line 8, presses **Save**, and grabs a coin: not a number, or out of range, is a Console error that changes nothing; a lower pitch is heard and explained but doesn't count; only a higher pitch, heard in the game, finishes the step. |
| **Feel → see → name** | Hear the silence, hear the fix, *then* the card: "Feedback — the game answers you." Real names on the card and in the Inspector. |

## Hands-on verbs used
Plays (keyboard) · notices · decides · makes (assigns sounds) · tunes (mixer sliders, with a target)
· reads and tweaks (real C#) · proves (the later ticket). **No AI call is needed anywhere in this shift** — all of it is authored
and checked by code.

## Accessibility
Every sound also shows as a visual pop ("DING!", "BZZT") so a muted classroom or a deaf kid still gets
the feedback; targets are 44px; keyboard only for playing.

## C# peek + tweak, and when it appears
The kid sees real Unity C# — `using UnityEngine;`, `public class Coin : MonoBehaviour`,
`OnTriggerEnter2D`, `source.PlayOneShot(coinSound);` — and edits **one** value. Nothing is compiled:
the app reads the number back out of line 8 and applies it to the game, rejecting anything it can't
use (see `00-direction.md`, "C#, peek and tweak"). The comment above `coinSound` names the sound the
kid put in the Inspector slot: the same thing in two views, which is how Unity really works (public
fields appear in the Inspector). **In the course, peek + tweak starts in session 5**
(`../curriculum-map.md` §4): the programmer's first visit opens `Coin.cs`, the script behind this
very fix, a week later. The wireframe carries the step here so it can be judged; in session 4 the
shift runs without it, and the Feedback card has no C# row.

## Not decided here
The characters' names and looks; the real sound set and art style; how many sounds a shelf offers.
