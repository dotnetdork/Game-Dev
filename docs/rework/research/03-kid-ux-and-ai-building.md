# UX for ages 10–14, and kids building games with AI

Research for the rework (`../00-direction.md`), 2026-09-24. Gathered by a research agent and kept
as returned, lightly edited.

**How reliable this is.** Web search worked; fetching full pages was blocked for almost every domain
(nngroup.com, arxiv.org, code.org and others), so claims come from search-result extracts. **[V]** =
stated in a source found; **[V-2nd]** = secondary/blog source; **[I]** = inference.

## Part 1 — UX for 10–14 year olds

### Reading and text density
- **[V]** NN/g teen studies (100 teens, 210 sites, 13 years): teens "make mistakes and give up
  quickly" — weak reading skills, simple strategies, low patience, overconfidence. They strongly
  prefer sites that are easy to scan or show concepts visually. NN/g: small meaningful chunks, white
  space, **6th-grade reading level or lower**.
  https://www.nngroup.com/articles/usability-of-websites-for-teenagers/ ·
  https://www.nngroup.com/reports/teenagers-on-the-web/
- **[V]** Younger teens read worse than older teens; 10–12s fall in NN/g's *children* band (3–12,
  156 guidelines). https://www.nngroup.com/reports/children-on-the-web/
- **[V]** Children have smaller working memory; limit what they must hold in their heads; give
  "clear, specific instructions." In one NN/g test a game showed the controls but never said how to
  win. https://www.nngroup.com/articles/kids-cognition/
- **[I]** One idea per step, ~1–3 short sentences plus a visual or running demo; anything longer
  behind "tell me more."

### Learning science that shapes the UI (Mayer, Sweller)
- **[V] Seductive details:** interesting but irrelevant material hurts learning — Rey 2012
  meta-analysis (39 effects): small-to-medium harm to retention, medium harm to transfer;
  Sundararajan & Adesope 2020 (68 effects) confirmed. https://eric.ed.gov/?id=EJ986386 ·
  https://link.springer.com/article/10.1007/s10648-025-10099-z. Decorative panels, XP counters and
  file trees on screen during a lesson count.
- **[V] Segmenting** (learner-paced chunks), **signaling** ("look here" cues), **modality**
  (graphics + narration beat graphics + text), **redundancy** (don't duplicate narration as text),
  **personalization** (conversational beats formal).
  https://www.devlinpeck.com/content/mayers-principles-of-multimedia-learning ·
  https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12197
- **[V] Worked examples, then fade guidance** (expertise-reversal effect).
  https://link.springer.com/rwe/10.1007/978-1-4419-1428-6_20
- **[I]** Classrooms are noisy and headphones aren't guaranteed, so narration is optional. The
  practical form of the modality principle: **show the mechanic moving, label it with a few words.**

### Navigation and "what do I do next"
- **[V]** Kids rely on consistent patterns and respond better to visual cues than long instructions.
  https://www.nngroup.com/articles/childrens-websites-usability-issues/
- **[V]** Teens are goal-oriented and expect things to just work.
- **[V]** Gelman, *Design for Kids*: 10–12s are "growing up" — they reject anything babyish. FRESH for
  tweens: **Fast, Rewarding, Easy, Safe, Human.** https://rosenfeldmedia.com/books/design-for-kids/ ·
  https://alistapart.com/blog/post/designing-social-tools-for-tweens
- **[I]** The engine-studio layout puts 7+ regions in front of a small working memory. Show one
  primary region at a time plus a persistent **single "Next"**; power tools (console, files) behind a
  "pro" toggle. Gelman's point supports keeping the look grown-up while the structure gets simpler.

### Onboarding
- **[V-2nd]** Duolingo lets people finish a lesson before sign-up ("gradual engagement"); blogs
  report ~20% more daily actives (not primary).
  https://goodux.appcues.com/blog/duolingo-user-onboarding
- **[I]** No panel tour. A playable game that responds to the kid within ~60 seconds; introduce each
  panel when it's first needed.

### Feedback and reward
- **[V-2nd]** Kids expect a visible response within ~0.5 s or they click again.
  https://www.aufaitux.com/blog/ui-ux-designing-for-children/
- **[I]** For game-makers the best reward is watching their game change; Stars/XP are secondary and
  are seductive details during a lesson.

### Chromebook and trackpad
- **[V]** Fine trackpad gestures such as dragging are hard for young kids; NN/g recommends ~2×2 cm
  targets for young kids vs 1×1 cm for adults.
  https://www.nngroup.com/articles/children-ux-physical-development/
- **[V]** The 11.6-inch 1366×768 Chromebook is the long-standing K-12 standard.
  https://ctl.net/blogs/insights/11-6-vs-12-2-chromebooks-understanding-the-impact-on-student-learning
- **[I]** Design for ~1280×650 usable; no drag-to-resize, no right-click, big targets.

## Part 2 — Kids directing AI to build

### Evidence
- **[V] Kazemitabaar et al., CHI 2023** — 69 novices aged 10–17 learning Python, half with Codex:
  1.15× more tasks completed, 1.8× higher scores, less frustration; no worse on one-week retention
  (59% vs 50%, n.s.); stronger prior Scratch skills benefited more.
  https://dl.acm.org/doi/10.1145/3544548.3580919
- **[V] Kazemitabaar et al., Koli Calling 2023** — 33 learners 10–17: **"AI single prompt"** use (one
  prompt generates the whole solution) trended *negatively* with post-test scores; **hybrid** use
  trended *positively*. Over-reliance = copying output unchanged. https://arxiv.org/abs/2309.14049
- **[V] Macau / ETH Zurich, CHI 2026** — children 7–11 with an AI game tool spent most time
  playtesting and debugging and "rarely visit[ed] their code." Fix: ask them to explain what changed,
  compare implementations, make small manual edits.
  https://gamesbeat.com/new-research-reveals-trade-off-behind-ai-vibe-coding-tools-speed-vs-understanding-exclusive/
- **[V] Khanmigo** — U of Toronto study, 18 Tennessee middle schools 2024–26: 96% tried it, but the
  median student used it in only 17% of sessions where they erred; when it refused to give answers,
  students largely stopped. Khan says ~15% use it regularly; the 2026 redesign makes it **proactive
  and built into the workflow**. https://hechingerreport.org/proof-points-khanmigo-math-ai-tutor/ ·
  https://blog.khanacademy.org/how-khan-academy-is-building-a-better-ai-tutor-our-most-recent-learnings/
  **[I]** A pure Socratic refuser gets ignored; a pure do-everything builder bypasses learning. What
  works: a builder that *does build*, after the kid has made a concept-bearing decision.
- **[V] Newman et al., CHI 2024** ("I want it to talk like Darth Vader") — children 7–13 kept creative
  control by adapting or rejecting AI suggestions; a generic voice was a barrier.
  https://dl.acm.org/doi/10.1145/3613904.3642492
- **[V] ChatScratch, CHI 2024 (6–12)** — obstacles: "artist's block," limited asset creativity, weak
  guidance. Fixes: **structured visual storyboards before building**; guidance that points to the
  part needed rather than writing everything. https://arxiv.org/abs/2402.04975
- **[V] Resnick / MIT** — AI should support projects, passion, peers, play; some AI uses "constrain
  learner agency." https://mres.medium.com/ai-and-creative-learning-concerns-opportunities-and-choices-63b27f16d4d0
- **[V] Precedents:** Rosebud AI (kids describe a game, "Rosie" builds and explains it; automatic
  **history checkpoint** on every change) https://lab.rosebud.ai/blog/kids-making-games-with-ai ·
  Code.org AI tutor in Web Lab · MIT RAISE Day of AI · CodeHS teacher-toggled AI per assignment with
  transcript review.

### Safety and COPPA
- **[V]** Amended COPPA Rule effective June 23, 2025; **compliance required by April 22, 2026**:
  broader personal information, separate parental consent before sharing with third parties,
  tighter security, commentary on consent for AI training.
  https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- **[I]** Before shipping: check what student text reaches the model provider and whether it is kept
  or trained on. (The app's own position: `docs/child-privacy-brief.md`.)

### Patterns for a kid-facing build chat (all [I] unless noted)
1. **Concept-shaped choices, not a blank box.** "How floaty should your jump be? [Moon] [Normal]
   [Heavy]" → "Now say it your way." Chips = low floor; free text = high ceiling. Blank boxes invite
   single-prompt use (Koli 2023) and artist's block (ChatScratch).
2. **Clarify vague requests in the concept's own terms.** "Cool how? Faster enemies, more of them, or
   they chase you?" Each question is a small lesson.
3. **Show the plan before building.** "I'll make you fall twice as fast. Build it?"
4. **Say what changed in kid words**, and replay the game automatically.
5. **One-click undo with visible checkpoints** (Rosebud).
6. **Debug by describing:** "What did you expect? What happened instead?" before fixing.
7. **Occasional tiny "your turn" edits** — the hybrid pattern that correlated with better scores.
   *(Note for this project: the direction says no code for now, so the "edit" is a dial or a choice,
   not a line of code.)*
8. **Proactive assistant** — offers the next step (Khanmigo redesign).

### Making "describe it to the AI" teach the concept
- **[I]** **The prompt is the exercise.** To get a good result the kid must name the concept's
  variables (speed, gravity, spawn rate, what happens on touch). Show a "recipe card" of those words.
  Vague prompts get a clarifying question; precise ones get a build. Ask for a prediction before the
  Build button, then show the concept in the running game at once: words → mechanic → feel.

## Top 10 rules for the redesign (ranked)

1. **One screen, one job, one obvious "Next."** Collapse the 7-region studio to one primary view plus
   a persistent next step; console, files, XP behind a pro mode. (NN/g working memory; Mayer coherence)
2. **~3 sentences per step, max; show, don't tell.** Running demos instead of paragraphs; 6th-grade
   reading level. (NN/g; Mayer)
3. **The kid makes a concept decision before the AI builds.** Choice chips + "say it your way"; never
   a blank box, never a one-shot "make my game." (Koli 2023; ChatScratch)
4. **Playable within 60 seconds; teach each panel when first needed.** No tours, no sign-up wall
   first. (Duolingo [secondary]; Gelman FRESH)
5. **Every AI change says what changed and runs the game immediately.** (Macau/ETH; instant feedback)
6. **Undo that always works** — automatic checkpoints, one-click revert. (Rosebud)
7. **The AI clarifies vague requests with the concept's vocabulary**, and debugs by asking expected
   vs. actual.
8. **Proactive, not preachy.** Suggests the next step, builds after the kid decides, never refuses
   for Socratic purity. (Khanmigo data and redesign)
9. **No decoration during learning.** No XP, stars or mascot chatter while a concept is taught;
   celebrate after the build works. (Rey 2012; Sundararajan 2020)
10. **Chromebook-first physical design:** 1366×768, large targets, no drag/right-click/resize
    required; COPPA (April 2026) on data sent to the model. (NN/g; FTC)
