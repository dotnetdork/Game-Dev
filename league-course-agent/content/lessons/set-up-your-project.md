---
title: Set Up Your Project
xp: 400
ai: full
summary: Open the project and run it for the first time.
---

Let's make sure everything works before we start changing things. Open the **Play** tab and confirm the starter game runs. Then peek at the **Code** tab — you'll see `game.js` (the game) and `main.js` (which starts it).

```run
console.log("Checklist:");
["Play tab shows the game", "Code tab shows game.js", "Run button works"].forEach(function (item) {
  console.log(" [ ] " + item);
});
```
