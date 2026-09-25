# Brief: a click-proof shift — "The silent coins" (Audio)

**Status: draft, 2026-09-25**, written to answer Jay's question: how does this teach when a kid could
spam-click through? Wireframe: `../wireframes/03-shift-silent-coins.html`. World: `DESIGN.md`
(the Unity-style editor). Loop: `../core-loop.md`.

## The job
A customer's game "feels dead." The sound designer (character TBD) hands the kid the ticket. The kid
plays it, notices nothing answers when you grab a coin, gives each action a sound, mixes it so it can
be heard, and puts the fix into their own game. **Concepts:** feedback (owned), sound effects and the
audio mixer (familiar; Unity: AudioSource, Audio Mixer).

## What makes it click-proof

| Mechanism | In this shift |
|---|---|
| **Progress needs evidence, not clicks** | You can't continue until you've actually **played** and grabbed coins (keyboard), **mixed** the sound so it's louder than the music, and **grabbed a coin in your own game**. |
| **Choices have consequences** | "What felt off?" — a wrong answer sends you back to play and listen. Put a buzz on the coin and it *sounds like getting hurt*; the sound designer says so and you decide whether to change it. |
| **Spam gets noticed** | Three rapid clicks trigger a stop: the mentor asks for a **prediction** before going on. |
| **It comes back later** | A later QA ticket ("the jump in your game is silent") asks the kid to choose the right kind of sound — the idea returns as a decision, scored by code. |
| **Feel → see → name** | Hear the silence, hear the fix, *then* the card: "Feedback — the game answers you." Real names on the card and in the Inspector. |

## Hands-on verbs used
Plays (keyboard) · notices · decides · makes (assigns sounds) · tunes (mixer sliders, with a target)
· proves (the later ticket). **No AI call is needed anywhere in this shift** — all of it is authored
and checked by code.

## Accessibility
Every sound also shows as a visual pop ("DING!", "BZZT") so a muted classroom or a deaf kid still gets
the feedback; targets are 44px; keyboard only for playing.

## Not decided here
The characters' names and looks; the real sound set and art style; how many sounds a shelf offers.
