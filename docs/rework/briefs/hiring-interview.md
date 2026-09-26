# Brief: the hiring interview (first sign-in)

**Status: confirmed by Jay (2026-09-26), with one change: the handle is generated, Reddit-style.** It is wireframe `07-hiring-interview`. Sign-in changes are designed here only; `app/auth.js` changes wait for a separate plan.

It replaces the old sign-in page for a kid's first visit, and it takes over the get-to-know-you questions that used to end the first day (`first-run.md` v3 beat 8, now removed from wireframe 04).

## 1. Job and audience

- **Who:** a 10–13-year-old, new to computers, opening the course for the very first time on a school Chromebook. About 20 of them start at once in the same room.
- **Mood:** unsure what this is, and possibly nervous about "a test".
- **Mode:** Experience. The kid is inside a scene, not filling in a form.
- **The job, in the kid's terms:** "I got a job at a game studio." The interview must feel like a conversation with a character who is delighted to meet them.
- **The job, in the course's terms:** it creates the account and learns enough to adapt the course. It also records a hidden "before" snapshot, which an exit interview repeats at session 10.

## 2. Outcome and proof

In about 3 minutes the kid:
1. enters the one-time code the teacher gave them;
2. has a conversation with the interviewer;
3. makes a studio badge (a handle and a look, never their real name);
4. passes a tiny "first task";
5. hears **"You're hired!"**;
6. walks straight into the first day (wireframe 04), which greets them by their handle.

**Success looks like:** the kid smiles, answers without hesitating, and doesn't notice anything was measured. The teacher can match each account to a real student without the app ever holding a real name.

**What makes this specific to us:**
- The interview is itself a mini-game about making games. Every "question" is a tiny try-this moment in the studio's own engine style.
- The interviewer's clipboard notes are the learner card, visible to the kid ("I'm writing down: explorer!").

## 3. Selected direction

**Visual world:**
- **The editor's own world (DESIGN.md).** Unity greys, League orange as the one accent, 44px targets, the same conversation dock and dialogue answers the kid will use all course. The interview teaches the conversation pattern before the editor exists.
- **The new element is the interviewer:** a simple cartoon **silhouette** (flat, warm-grey, orange tie or lanyard, no face detail; a character look is still an open decision, so this stays deliberately generic). It sits on the studio's front desk: a flat, stylised office backdrop in the dock greys, behind a desk, beside a big chat bubble.

**Structure:** one scene, centre stage. The interviewer on the left, their speech bubble beside them, the kid's answers below as the usual 44px dialogue options, plus "say something else".

**The interviewer is alive:** idle breathing, a lean-in when the kid answers, a scribble on the clipboard when something is learned, a laugh at the running joke. Motion follows DESIGN.md (ease-out-expo, off under reduced motion).

**Sequence (about 3 minutes, 8 beats):**

| # | Beat | What the kid does | What it learns (learner card) | Growth snapshot? |
|---|---|---|---|---|
| 1 | **Code at the door** | Types the one-time code from the teacher's card (e.g. `TIGER-42`), on a studio door keypad | Nothing. It links the account to the teacher's roster row | — |
| 2 | **"Come in, sit down!"** | Meets the interviewer: "You're here about the game developer job?" (Yes! · Wait, what job? · I'm just here for the snacks). The snacks joke becomes the running joke | Tone: silly or earnest, for the characters' register | — |
| 3 | **"Which of these have you played?"** | Taps game pictures (Minecraft, Mario, Roblox, Fortnite, Among Us, Zelda, "none of these", "something else…"). The interviewer reflects back ("A builder AND a jumper!") | Favourite games, and so genres, for examples and customer games | — |
| 4 | **Two quick feels** | "Which feels better?": two tiny jumps side by side (floaty / snappy), then two coin sounds. The kid taps one of each | Kind of fun (sensation), and a first taste of feel, which S2 names | ✔ "Which jump feels better?" returns at the exit, where the kid can say *why* |
| 5 | **The locked door** | "You find a locked door in a game. What do you do?" (hunt for the key · smash it · sneak round · get a friend · build a way over) | Kind of fun: explore, challenge, cleverness, social, make | — |
| 6 | **Your badge** | The interviewer **generates a handle from what they just learned**, Reddit-style: a word from the kind of fun (Curious, Turbo, Sneaky, Crafty, Friendly…) plus a word from the games they picked (Miner, Jumper, Builder, Rider…) plus two digits, e.g. `SneakyJumper42`. **"Roll again"** makes a new one from the same answers, as often as they like; they keep the one they love. **There is no typing of a name here.** Then a badge colour and icon, and the picture password (3 of 9 pictures) | Handle and badge look (the display name everywhere, per the privacy brief); the picture password | — |
| 7 | **"Take a look at this"** (the portfolio moment) | The interviewer turns a monitor round: a real Unity-style editor screenshot. "Point to where you think you'd press Play." Then "…where you'd change how high the hero jumps." Taps on the image. Then, from word tiles: "Heard of any of these?" (sprite, collider, prefab, frame, *flarnish*) | Comfort with engines (and computers, from how they move: tapping speed, and typing vs tapping in "say something else") | ✔ Both taps (a location per target) and the word check, including the made-up decoy word, return at the exit |
| 8 | **The first task** | "One last thing: this coin is supposed to make a sound. Fix it?" One tap: pick a sound, hear it. "You're a natural." Then "What job sounds most fun?" (make the art · make the sounds · build the levels · make things work · all of it!) | Which job appeals, and so the first department's order | ✔ "How sure are you that you could make a game?" (five faces) is asked here and returns at the exit |
| — | **"You're hired!"** | Confetti-free: the interviewer stands, the badge prints and slides across the desk with the handle, the hired sound plays once (`ui.js` "hired"), and the desk opens into the studio | — | — |

- **Returning sign-in (not the interview):** pick your class → tap your badge → your picture password.
- **The picture password is chosen during beat 6:** 3 of 9 pictures, a pattern common in K–5 tools.
- No typed passwords for kids.

**Focal moment:** the badge printing and sliding across the desk: "Welcome to the team, Captain Byte."

## 4. Scope and boundaries

- **Fidelity:**
  - an interactive wireframe (`07-hiring-interview.template.html`), built like 03–06 with `base.css`, `ui.js` and the step notes;
  - playable end to end, including the feel tests with real motion and sound;
  - the returning-sign-in screen as a final reviewer step.
- **Leave untouched:** the first day's flow (04), which now simply starts after this.
- **Anti-goals:**
  - A form or a survey look: no progress bar, no "question 3 of 8", no text fields apart from the code and the optional "say something else".
  - Anything that feels like a test, or a wrong answer. Every answer is right. The Unity-screenshot taps are framed as "just a guess, we're curious".
  - Asking for real names, age, school, city or photos.
  - More than about 3 minutes, or a wall of text.

## 5. States and ranges

- **The code:**
  - wrong or expired: the door stays shut, and the interviewer says "Hmm, that code doesn't open the door. Check your card with your teacher";
  - already used: "This badge is already made. Sign in with your badge instead";
  - typed in lowercase or with spaces: forgiven.
- **"None of these" games:** the reflect-back still works ("A fresh start! I love it").
- **Skipped answers / "say something else":** typed text is reflected back and never required.
- **Sound off:** the feel test's coin sounds fall back to visible pops. The kid is told "turn your sound on for this one, or just pick the one that looks better".
- **Slow or fast kids:** no timers. The spam check (3 fast taps) stays off here: fast is fine.
- **Screen readers:** every bubble goes through the one announcer. The feel tests have text alternatives ("Jump A floats up slowly. Jump B snaps up fast"). The screenshot taps have a list alternative ("Pick the part you'd use to press Play").

## 6. Interaction and layout

- **Topology:** one scene, not the editor grid. The conversation dock pattern (bubble plus 44px options plus say field) is reused so it's familiar.
- **Layout at 1366×650:**
  - interviewer and desk take the left ~55%;
  - the conversation takes the right ~45%;
  - the feel tests and the screenshot appear on the desk's monitor, in the scene, not in a modal.
- **Feedback:**
  - the interviewer reacts to every answer: a pose change, a clipboard scribble with the learned word visible for a second ("explorer ✎");
  - UI sounds only at "code accepted", "badge made", "first task fixed" and "hired" (the `ui.js` rules).
- **Transition into the first day:** the scene slides away and the empty editor of wireframe 04 appears, mentor greeting by handle.

## 7. Constraints and open decisions

- **Privacy (`docs/child-privacy-brief.md`):**
  - the account holds a handle, a badge, the picture password, the learner card and the growth snapshot;
  - the teacher's roster (code → real student) stays with the teacher / League, not in the app.

  **Ask first:** accounts, one-time codes and picture passwords are auth changes (`app/auth.js`, CLAUDE.md "Ask first").
- **Persistence across iterations and tests:**
  - accounts and saves are keyed by a stable account id, not the handle;
  - saves carry a schema version with migrations (the existing `project.js` pattern), so a kid's progress survives app updates and later playtests;
  - the growth snapshot is versioned, so the exit interview compares like with like.
- **Research grounding for the growth snapshot:**
  - **Pre/post measurement** with identical items is the standard way to see change.
  - **Asking before teaching can itself help learning.** This is the "pretesting effect" (Richland, Kornell & Kao, 2009). **[K]** marks a claim to verify before the plan cites it.
  - **Limits:**
    - no control group, so growth can't be credited to the course alone;
    - self-reported "heard of it" is noisy, which is why there is a decoy word to catch yes-to-everything;
    - confidence faces measure self-efficacy, not skill.
  - Keep the items identical and few (5), and show kids their own growth at the exit ("On day one you guessed Play was here. Look at you now").
- **Open decisions:**
  - the interviewer's look beyond a silhouette (tied to the open character-design decision);
  - the game-picture set: logos can't be used, so use generic drawn icons labelled with the game names;
  - the exact handle word lists;
  - whether a teacher can re-issue a code;
  - the exit interview's own brief (session 10), which reuses beats 5, 7 and 8.
