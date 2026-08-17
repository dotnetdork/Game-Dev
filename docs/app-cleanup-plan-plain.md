# Making the app faster and easier to use — the plain version

**What this is:** I measured the app in a real browser, on the screen sizes students actually use.
Here is what I found and what I'd fix, in order. No jargon.

---

## The short answer

The app looks good. That's not the problem, and I'm not proposing to change how it looks.

Three things are wrong, and all three are invisible until you put it on a school Chromebook:

1. **It downloads five times more than it needs to.**
2. **It only fits properly on a big screen.**
3. **Some of the small grey text is too faint to read.**

---

## 1. It downloads too much

Every time a student opens the app, it downloads **5 megabytes**. About 3 of those megabytes are
tools that only two screens use:

- A code-checker (1.2 MB) — only used on the Code tab.
- The list of every item in the Store (1 MB) — only used on the Store.
- A code-formatter (0.75 MB) — only used on the Code tab.
- An icon set (0.7 MB) — we use 71 icons out of thousands.

A student who opens a lesson and reads it downloads all of that and uses none of it.

There are three logos and pictures in the app that are also much bigger than they need to be. The
robot avatar is displayed at 20 pixels wide but the file is 480 pixels wide. Together those three
images are 144 KB and should be about 6 KB.

And the Store asks for **233 pictures at the same moment** you open it. That's the heaviest thing
the app ever does, and it's the thing most likely to choke a classroom Wi-Fi with 25 kids on it.

**The fix:** wait to download things until someone actually opens the screen that needs them. On
my machine this takes the app from 5 MB down to under 1 MB. On school Wi-Fi the difference is
much bigger than that.

**Effort:** a day or two. Nothing about the app looks or behaves differently.

---

## 2. It only fits on a big screen

The lesson panel, the code panel, the game, and the AI assistant all share one row. The two side
panels — the lesson list on the left and the AI on the right — always take exactly 600 pixels
between them, no matter how small the screen is.

Here's what's actually left over for the lesson, measured:

| Screen width | Room left for the lesson |
|---|---|
| 1920 (big monitor) | 1320 px — fine |
| 1366 (common Chromebook) | 766 px — tight |
| 1024 (older Chromebook) | 424 px — bad |
| 820 (small window) | 220 px — broken |

At 1024, a paragraph is about 42 characters wide — roughly six words per line — and the game shrinks
to under half size. At 820 the Learn / Code / Play buttons literally don't fit and get cut off.

There's a related, smaller problem in the other direction: on a big monitor the lesson text runs
92 characters per line. Comfortable reading is 45–75, and for 11–14-year-olds closer to 55–65. So
the text is too wide on a big screen and too narrow on a small one.

**The fix:** let the side panels get out of the way when the screen is small. The AI panel already
has a hide button and a little floating robot button to bring it back — it just never hides by
itself. Below a certain width, hide it automatically. Below a smaller width, make the lesson list
slide over the content instead of squeezing it. Then set one sensible reading width so the text is
comfortable everywhere.

**Effort:** the biggest of the three. Maybe three or four days. Still no change to how it looks —
only to how much room each part gets.

---

## 3. Some text is too faint

There's one grey I use for small labels — the "COURSE OUTLINE" and "AI ASSISTANT" headers, the
whole bottom bar, the little numbers next to quiz answers, the line/column readout in the editor.
It's used in 20 places.

The accessibility standard says text needs to be about 4.5 times brighter than what's behind it.
This grey measures between **2.8 and 4.0**. It fails everywhere it's used.

Nudging it two shades lighter (`#5f758f` → `#8b9db1`) passes everywhere and barely changes the
look. It's a one-line change.

While I'm in there, three smaller accessibility items:

- The button that hides the AI panel is 18 pixels square. The minimum is 24.
- The game volume slider has no name, so a screen reader just says "slider".
- The app has no page structure markers, so someone using a screen reader has to tab through all
  57 lesson buttons to reach the actual lesson. The lesson list itself is properly accessible —
  I fixed that earlier — but the frame around it isn't.

**Effort:** half a day. This is the cheapest work in the whole plan and the only part that's a
compliance question rather than a taste question.

---

## What I'd do, in order

| | What | Why first | Time |
|---|---|---|---|
| 1 | Stop downloading things nobody opened | Biggest win, zero risk of breaking anything | 1–2 days |
| 2 | Fix the faint text and the accessibility gaps | Cheap, and it's the answer if anyone asks | ½ day |
| 3 | Make the panels get out of the way on small screens | The real work | 3–4 days |
| 4 | Tidy up the sizes and spacings | Housekeeping — stops this drifting again | 1–2 days |

Roughly a week and a half. Steps 1 and 2 are worth doing on their own even if 3 and 4 never happen.

---

## What I'm not changing

- **The look.** Same colours, same layout style, same cards. This is all plumbing.
- **The lessons.** No content changes.
- **The AI system.** Untouched.
- **Phones.** The app isn't designed for a phone and making it work on one is a separate decision,
  not a bug fix. I'd stop at small laptop screens.

---

## One thing worth saying out loud

Nothing here is a mistake anyone made. The download problem comes directly from a decision that
was right — we keep every library on our own server so the app works on a filtered school network.
That was correct. We just kept *all* of them loading *all* the time instead of only when needed.

The layout problem is the same shape: it was designed once at one screen size and everything since
has been built on top of that, which is what you'd expect.
