# Brief: a shift — "The floaty jump" (Engineering)

**Status: draft, 2026-09-25.** Scope decided by Jay: **jump and gravity only**; the frame and a
slow-motion dial become their own short shift later. Wireframe: `../wireframes/05-shift-floaty-jump.html`
(built from `../wireframes/src/`). World: `DESIGN.md`. Loop: `../core-loop.md`. Session 2 in
`../curriculum-map.md`.

## The job
A customer's hero "jumps like it's on the moon": it floats up slowly, drifts far too high and bonks
the spikes on the cave ceiling. The lead programmer hands the kid the ticket. The kid plays it, says
what feels wrong, **predicts** what turning gravity up will do, then tunes **Gravity** and **Jump
height** in the Inspector until the hero clears the gap without touching the ceiling. Then they tune
their own hero from day one to feel how *they* like — moon, normal or heavy — as long as it still
gets over the lava.

**Concepts** (session 2): **Inspector** (owned: "click a thing and see all its knobs") and
**Gravity** (owned: "the game pretends things fall; it's a number you can tune"). Unity: the
Inspector; Rigidbody 2D Gravity Scale [unverified], a jump force in the player's script. **Returns:**
Play mode (tuning during Play is undone on Stop, as on day one) and the Hierarchy (select the Player).

## What makes it click-proof

| Mechanism | In this shift |
|---|---|
| **Progress needs evidence** | Play until the floaty jump bonks the ceiling or misses; after tuning, **land on the far side in play without touching the spikes**. The curriculum map's evidence: a value inside a target band, then clearing the gap in play (range + play event). |
| **Predict first** | "If we turn gravity up, will the hero fall faster or slower?" The answer is recorded before the kid touches a slider (the map's gravity evidence). A wrong prediction is explained, then the kid finds out by playing. |
| **See the change before playing** | While stopped, a dotted arc shows where the jump will go, and it moves as the sliders move. Feel it, see it, then name it. |
| **Play mode comes back** | Tune during Play and press Stop, and the values snap back: "Remember your first day?" A planned return of an owned concept, not a lecture. |
| **Choices have consequences** | In their own game the kid picks the feel. Any feel counts as long as the hero makes the jump; the feel goes on the learner card. |
| **It comes back later** | A later ticket: "my hero can't reach the ledge." Which knob, which way? A decision, scored by code. |

## Hands-on verbs used
Plays · notices · predicts · tunes (two real sliders, with a target) · decides (their own feel) ·
proves (the later ticket). **No AI call is needed**: every line is written and every gate is code.

## Accessibility
Nothing depends on hearing. Sliders have 44px hit areas, their values are shown as numbers and read
out, and the arc is a helper, not the only feedback: playing is the proof. Keyboard only for
playing.

## Not decided here
The characters' names and looks; the customer's game's final art; the exact slider ranges (the
wireframe uses ranges tuned so the target band is findable in under a minute).
