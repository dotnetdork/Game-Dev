---
title: Why We Use JavaScript + Phaser
xp: 300
ai: full
summary: The right tool for a browser, a Chromebook, and you.
---
For this course, JavaScript + Phaser is the sweet spot: it runs in **any web browser** (including your Chromebook) with nothing to install, it's a **real** language used across the whole web, and Phaser makes 2D games quick to build.

3D engines like Unreal are amazing but need powerful computers. We're doing **2D** — which is where almost every game designer starts anyway.

```quiz
type: mcq
prompt: A big reason JavaScript + Phaser fits this class is...
options:
  - It needs a powerful gaming PC
  - It runs in the browser with no install, even on a Chromebook
  - It only makes 3D games
answer: 1
feedback:
  - "Nope — that's the opposite of why we picked it."
  - "Exactly — browser-based means it just works here."
  - "We're building 2D games with it."
```

## Your challenge

```challenge
title: Be the engine
task: An engine calls your `update()` about 60 times a second — that is most of what an engine does for you. Add one line inside `update()` that moves the box 4 pixels right each time it runs, and it will reach the flag on its own.
code: |
  let x = 10;
  let ticks = 0;

  function update() {
    // add one line here: move x right by 4

    draw();
    ticks = ticks + 1;
    if (x >= 250) { win(); return; }
    if (ticks > 300) { stuck(); return; }
    setTimeout(update, 16);
  }

  function draw() {
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e";
    ctx.fillRect(262, 70, 6, 60);
    ctx.fillStyle = "#2fd0b6";
    ctx.fillRect(x, 85, 30, 30);
  }

  function stuck() {
    ctx.fillStyle = "#f5b02e";
    ctx.font = "14px Consolas";
    ctx.fillText("The box isn't moving yet.", 20, 40);
  }

  update();
```
