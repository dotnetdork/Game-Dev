---
title: From Project to Playable
xp: 200
ai: full
summary: Builds, platforms, and how a game gets onto somebody else's machine.
---

You have made something. It runs on your screen. Getting it onto your friend's screen is a
completely separate job — and it's the one where most projects quietly die.

## What a build actually is

While you're working, your game is a pile of files: code, pictures, sounds, all sitting in folders
where you can edit them.

Nobody else wants a pile of files. A **build** is what you get when you take that pile and turn it
into one thing another person can actually open:

- Squash the code together and strip out the comments.
- Shrink the pictures and pack them up.
- Bundle it into whatever shape the target platform expects.

The build is not your project. It's a *copy*, arranged for a stranger.

## Why Windows wants an .exe

A Windows machine won't run a folder of JavaScript. It runs programs — `.exe` files — which contain
machine instructions plus everything the program needs.

So a build for Windows has to wrap your game up with a whole engine inside it. That's why a small
game can produce a 60 MB file: most of it is the engine and its libraries, not your work.

Consoles are stricter still. To ship on a Switch or PlayStation you need approved hardware, a
signed agreement, and a certification process. That's not a technical wall so much as a business
one, and it's a real reason indie developers start elsewhere.

```quiz
question: Your finished Phaser game is a folder of code and pictures. Why can't you just send that folder to a friend to double-click?
options:
  - Their computer needs it in a shape it knows how to open
  - Folders cannot be copied between computers
  - The files are too large to send
  - Games can only run on the computer that made them
answer: 0
feedback:
  - Right. A build repackages the pile into something the target platform can actually open.
  - Folders copy fine — the problem is what to do with them afterwards.
  - Size is not the issue; shape is.
  - They can run anywhere, once packaged for that "anywhere".
explain: A build turns a working folder into the shape a particular platform expects — an .exe, an app, or a web page.
```

## Why the web doesn't

Here's the good news about the choice you've already made. A browser **already knows** how to run
JavaScript, show pictures and play sounds. It is the runtime.

So a web build is just: files on a server, and a link. No installer, no download, no approval, no
`.exe`. Someone clicks the link and they're playing.

That's why this course uses Phaser. Not because it's the most powerful engine — it isn't — but
because the distance between "it works on my machine" and "my cousin is playing it" is one link.

## The trade-off you are choosing

Nothing is free. Here's the honest comparison:

| | Web (Phaser) | Native (Unity, Unreal) |
|---|---|---|
| Getting it to people | A link | Download and install |
| Works on | Anything with a browser | What you built it for |
| Speed | Good, not maximum | Full use of the machine |
| Works offline | Only with extra work | Yes |
| Sell it in a shop | Hard | That's what stores are for |
| Time to first player | Minutes | Days |

For a first game — and for a lot of real games — the top row wins and the rest doesn't matter yet.

```challenge
title: Lab — the game that only runs here
task: This game depends on something that only exists on the machine it was written on. Find the assumption and make it work anywhere.
hint: Look at `assetPath`. Would that address mean anything on somebody else's computer?
solution: |
  // The goal: every asset path must be one another machine could actually follow.
  const assetPath = "assets/player.png";        // relative to the game — works anywhere
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText("loading: " + assetPath, 10, 20);
  const looksLocal = assetPath.indexOf(":") >= 0 || assetPath.indexOf("C\u005c") >= 0 || assetPath.charAt(0) === "/";
  if (looksLocal) {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("That address only exists on one computer.", 10, 60);
    ctx.fillText("It will fail for everybody else.", 10, 80);
  } else {
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(130, 100, 24, 24);
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("Relative path — this works on any machine.", 10, 60);
    win();
  }
code: |
  // The goal: every asset path must be one another machine could actually follow.
  const assetPath = "C:/Users/me/Desktop/mygame/assets/player.png";
  ctx.clearRect(0, 0, 300, 200);
  ctx.fillStyle = "#eaf1f8"; ctx.font = "12px sans-serif";
  ctx.fillText("loading: " + assetPath, 10, 20);
  const looksLocal = assetPath.indexOf(":") >= 0 || assetPath.indexOf("C\u005c") >= 0 || assetPath.charAt(0) === "/";
  if (looksLocal) {
    ctx.fillStyle = "#f5b02e";
    ctx.fillText("That address only exists on one computer.", 10, 60);
    ctx.fillText("It will fail for everybody else.", 10, 80);
  } else {
    ctx.fillStyle = "#2fd0b6"; ctx.fillRect(130, 100, 24, 24);
    ctx.fillStyle = "#3ddc84";
    ctx.fillText("Relative path — this works on any machine.", 10, 60);
    win();
  }
```

"It works on my machine" is the oldest joke in software, and this is usually why: something in the
project quietly depends on where it happens to be sitting.

```quiz
question: What is the biggest practical advantage of building your game for the web?
options:
  - Someone can play it by clicking a link, with nothing to install
  - It will run faster than a native game
  - It can be sold in console stores more easily
  - It works offline by default
answer: 0
feedback:
  - Right — the distance between finished and played is a single link.
  - Native builds get more out of the machine; web trades some speed for reach.
  - Console stores are much harder to reach, not easier.
  - Offline needs extra work on the web; native gets it for free.
explain: The web's advantage is reach. No installer, no approval, no download — just a link.
```

```yourturn
title: Write down how someone else would play your game
task: Answer this in your own project, as a comment. If you cannot answer it yet, that is worth knowing now rather than in three weeks.
steps:
  - Open the Code tab and open config.js.
  - At the top, add a comment block titled "How to play this".
  - Write who you want to play it, and how they would get to it.
  - Look through your code for anything that would only work on your machine — a file path, a name only you would know.
  - If you find one, fix it now. It is much cheaper than finding it on the day you want to show someone.
reward: Shipper badge
```

## Recap

- A **build** is a copy of your project, repackaged for a stranger's machine.
- Windows wants an **.exe** with the whole engine wrapped inside it; consoles want approval too.
- The **web** needs neither — the browser is already the runtime, so a build is files and a link.
- The trade: web gives up some speed and offline for enormous reach.
- **"Works on my machine"** is usually a path or a setting that only exists where you built it.
