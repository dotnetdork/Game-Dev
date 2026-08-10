---
title: Entities & Components — Thinking in Pieces
xp: 350
ai: full
summary: Build things out of small, reusable parts.
---
A powerful way to think about game objects: an **entity** is a "thing" in the game (a player, a coin), and **components** are the small pieces of data and behavior you snap onto it — a *position*, a *sprite*, a *velocity*, *health*.

Instead of one giant blob of code per object, you compose objects from parts. Add a "health" component and now it can be hurt; add "velocity" and it can move. This is called an **Entity-Component** approach.

```quiz
type: mcq
prompt: In entity-component thinking, what makes an enemy able to move?
options:
  - You rewrite the whole enemy from scratch
  - You give it a velocity component
  - You delete the scene
answer: 1
feedback:
  - "The point is to avoid rewriting — you add a piece."
  - "Right — snap on a velocity component and it can move."
  - "That would remove everything!"
```
