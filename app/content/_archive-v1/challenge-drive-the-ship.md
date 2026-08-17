---
title: "Challenge: Drive the Ship"
xp: 450
ai: guided
summary: Make the player move with the arrow keys.
---
**Challenge.** Open the **Code** tab and make the ship move left and right with the arrow keys, then test it in **Play**.

The AI is in **guided** mode here: it will make the change, but only if you tell it *exactly* what you want. Be specific about which key does what and how fast.

```quiz
type: mcq
prompt: Which request to the AI is specific enough to work well?
options:
  - "Make the ship move somehow"
  - "When the right arrow is down, set the ship's x velocity to 300; when left is down, set it to -300"
  - "Make it good"
answer: 1
feedback:
  - "Too vague — the AI has to guess."
  - "Perfect — exact keys, exact values."
  - "The AI can't tell what 'good' means."
```

Then finish the challenge below to earn your XP.

## Your challenge

```challenge
title: Lab — the ship that won't move
task: The ship isn't moving. Give it a speed so it drives right and reaches the flag — it wins automatically when it gets there.
symptoms:
  - The ship is being told to move at a speed of zero
  - The ship is drawn in the wrong place
  - The flag is missing, so there is nothing to reach
answer: 0
hint: Look at the line with `speed` on it. What is it set to, and what does `x = x + speed` do when speed is 0?
solution: |
  let x = 20;
  const speed = 3;            // any number above 0 makes it move
  function frame() {
    x = x + speed;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(272, 78, 8, 44);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 92, 30, 16);
    if (x >= 262) win();
    else requestAnimationFrame(frame);
  }
  frame();
code: |
  let x = 20;
  const speed = 0;            // change this so the ship moves
  function frame() {
    x = x + speed;
    ctx.clearRect(0, 0, 300, 200);
    ctx.fillStyle = "#f5b02e"; ctx.fillRect(272, 78, 8, 44);
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(x, 92, 30, 16);
    if (x >= 262) win();
    else requestAnimationFrame(frame);
  }
  frame();
```
