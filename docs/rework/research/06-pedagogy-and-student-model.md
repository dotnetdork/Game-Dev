# Pedagogy for the AI-driven studio course: breaking concepts down, making them stick, tracking skills

Research for the rework, 2026-09-25. Builds on `docs/rework/course-engine.md` (concept web, quest
outlines, director, characters, learner card) and `docs/rework/research/03-kid-ux-and-ai-building.md`
(reading level, Mayer principles, seductive details, worked examples then fading, choice chips,
"the prompt is the exercise", no XP during teaching). None of that is repeated here except where a
rule needs it.

**How reliable this is.** Web search worked; full-page fetches were not attempted at scale (they
were blocked for the previous research round). Labels:

- **[V]** = the claim appeared in a search-result snippet from the cited source (or an abstract/
  index page for it). Numbers marked [V] were in the snippet.
- **[K]** = from my own knowledge of the literature, not re-checked this session. Treat exact
  numbers with care.
- **[I]** = my inference / design recommendation.

---

## 1. Breaking concepts down for 10–13 year olds

### 1.1 Working memory at this age
- **[V]** Working-memory capacity grows through childhood and reaches adult levels in the mid-teens;
  a secondary summary puts it at roughly 2 chunks at age 5 rising about half a chunk a year to ~4
  by 14–15 (Cowan's "4 chunks" for adults when rehearsal/chunking is blocked).
  https://memory.psych.missouri.edu/assets/doc/articles/2016/cowan-pps-2016-working-memory-maturation.pdf ·
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3177168/ (the "0.5 chunks/year" figure came from a
  non-primary summary; treat it as indicative).
- **[K]** Novices can't chunk what they don't yet know, so every brand-new term costs a full slot.
  A kid new to computers is also spending slots on the UI itself (where to click, what the chat
  box does), which is why 03's "one screen, one job" matters for learning, not just usability.
- **[I]** Budget per quest step: at most **one new idea**, carried by at most **one new word**,
  shown next to something the kid can already see moving. Per session (45–60 min):
  **2–3 new technical terms, maximum.** Everything else that session is reuse.

### 1.2 How many new terms per session, and how words are actually learned
- **[V]** Beck, McKeown & Kucan's three tiers: Tier 1 everyday words; **Tier 2** high-utility
  words used across domains; **Tier 3** domain-specific words. They recommend **12+ encounters**
  before a word becomes active vocabulary, **in multiple contexts across multiple lessons.**
  https://www.structural-learning.com/post/vocabulary-tiers-teaching-tier-2-tier-3 ·
  https://www.researchgate.net/publication/243767339_Bringing_Words_to_Life_Robust_Vocabulary_Instruction
- **[V]** Incidental learning from context alone is weak: students learn **~15%** of unknown words
  met once while reading (Swanborn & de Glopper 1999, 20 experiments).
  https://eric.ed.gov/?id=EJ602665
- **[K]** "Robust" vocabulary instruction (Beck et al.) = a kid-friendly definition + several
  contexts + the learner *using* the word (judging examples/non-examples, generating their own
  use), spread over days. Explicit + use beats context alone. Programs typically target on the order
  of 5–10 words a *week*, not a lesson.
- **[I] Map the course's words onto the tiers:**
  - *Tier 3 (industry-specific, the Unity-transfer payload):* Inspector, Hierarchy, scene, sprite,
    collider, particle system, VFX, frame, frame rate, prefab, spawn, hitbox, tilemap, QA, build.
  - *Tier 2 (studio words that transfer everywhere):* feedback, prototype, iterate, playtest,
    balance, polish, scope, bug, priority, deadline. These are high value precisely because they
    are general — worth as much attention as the Tier 3 words.
  - *Polysemous traps:* **frame** (picture frame), **scene** (a film scene is close; OK),
    **build** (verb vs. noun "a build"), **asset**, **polish**, **Inspector** (police inspector).
    For each, name the everyday meaning and the studio meaning side by side once. The police
    inspector is a gift: "the Inspector inspects any object and tells you all its secrets — and,
    unlike a real inspector, lets you change them."
- **[I] Practical numbers:** 2–3 new terms per session; each term used by the character **3+
  times in its first session**, in at least two different situations; each term retrieved by the
  kid in **4+ later sessions** so it reaches ~12 encounters by week 10. With ~10 weekly sessions
  that caps the Tier 3 list at roughly **20–30 terms** for the whole course. Choose them hard.

### 1.3 Concreteness fading (feel it → see it → name it)
- **[V]** Fyfe, McNeil, Son & Goldstone 2014 systematic review: start with concrete
  representations and fade toward idealized/abstract ones. Benefits: concrete grounding for opaque
  symbols; embodied experience; a store of memorable images to fall back on; stripping away
  irrelevant surface detail. https://eric.ed.gov/?id=EJ1036777
- **[K]** Bruner's enactive → iconic → symbolic sequence is the same idea; the review found fading
  beat concrete-only and abstract-only in several math/science studies.
- **[I] The course's native three steps, which happen to map onto Unity exactly:**
  1. **Feel** (enactive): play two versions — a moon jump and a brick jump. No words yet beyond
     "which feels better for your game?"
  2. **See** (iconic): a dial/slider labelled *gravity* with a picture of a falling ball; the kid
     moves it and replays.
  3. **Name** (symbolic): the same value shown as a number in an **Inspector** panel on the
     player object: `Gravity Y: 300`. Later quests show only the Inspector row, not the slider.
  The final step is literally what the kid will see in Unity. That is the transfer bridge.

### 1.4 Analogies — useful, and a known source of misconceptions
- **[V]** Glynn's Teaching-With-Analogies: introduce target; recall analog; identify features;
  map similarities; **indicate where the analogy breaks down**; draw conclusions. Analogies are
  "double-edged swords": without explicit mapping, students latch onto surface similarities and
  form misconceptions that are hard to detect.
  https://www.researchgate.net/publication/234709009_The_Teaching-with-Analogies_Model_Build_Conceptual_Bridges_with_Mental_Models ·
  https://www.tandfonline.com/doi/full/10.1080/03057267.2024.2434797
- **[K]** Gentner's work on analogical encoding: *comparing two cases side by side* ("here are
  particles in two different games — what's the same?") produces transferable schemas better than
  studying one case, and much better than an analogy stated once.
- **[I] Rules:** analogies from the kid's world (flipbook for frames; stage crew for departments;
  recipe for a prefab; a snow globe for a particle system). **Each concept-web node stores its
  approved analogy and its "breaks where" line**, written by a person, so the AI doesn't improvise
  a wrong one ("gravity is like a magnet" is the classic bad one). Say the break out loud once:
  "a flipbook has pages you can flip back — a game makes each frame fresh, 60 times a second."

### 1.5 Narrative as a memory aid — with a warning
- **[V]** Mar et al. 2021 meta-analysis (75+ samples, 33,000+ participants): narratives are
  understood and recalled better than expository text; robust across moderators. Builds on
  Willingham's "stories are psychologically privileged."
  https://pubmed.ncbi.nlm.nih.gov/33410100/ ·
  https://kbsgk12project.kbs.msu.edu/wp-content/uploads/2011/02/Ask-the-Cognitive-Scientist.pdf
- **[K] The warning:** Adams, Mayer et al. 2012 ("Narrative games for learning", *J. Ed. Psych.*)
  found students learned *less* from the narrative adventure game *Crystal Island* than from a
  plain slideshow of the same content. The story competed with the content for attention. This is
  the seductive-details problem from 03 at the scale of the whole course.
- **[I] What resolves it:** the story must *be* the concept, not surround it. Willingham's
  structure (causality, conflict, complications, character) should carry the idea: the QA tester
  character *exists because* games have bugs; the conflict of the quest *is* the concept ("the
  jump feels floaty and the playtesters hate it"). Characters are named by role (the VFX artist,
  the gameplay programmer) so the role word gets an encounter every time the character speaks.
  Lore, jokes and cutscenes that don't carry a concept are cut or kept for after the build works.

### 1.6 Worked examples, in an AI-builds world
- 03 covers worked examples then fading. **[I]** Here the "worked example" is the mentor *building
  one thing while narrating the choice in concept words* ("I'll add a particle system — a little
  machine that spits out lots of tiny images. Watch the dust when you land."). Fade in three steps
  over successive quests: mentor decides and explains → kid picks from chips and mentor explains →
  kid names what they want in free text and the mentor only confirms. The fading step is also the
  measurement step (section 3).

### 1.7 Dual coding
- **[K]** Paivio's dual coding: words plus a matching image leave two memory traces; Mayer's
  multimedia principle (covered in 03) is the applied form.
- **[I]** Every term gets a **fixed icon and a fixed short clip** (the same particle-burst GIF
  every time "particles" appears). Consistency matters more than beauty: the icon becomes the cue.
  These go on a **concept card** the kid collects (see section 5 on collections).

### 1.8 The generation effect and elaborative interrogation
- **[V]** Bertsch et al. 2007 meta-analysis (86 studies, 445 effects): generating information
  beats reading it, d ≈ **0.40**. https://link.springer.com/article/10.3758/BF03193441
- **[V]** Kornell, Hays & Bjork 2009: even *failed* retrieval attempts, followed by feedback,
  improve later learning (the pretesting / errorful generation effect).
  https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Hays_Kornell_RBjork_inpress.pdf
- **[V]** Dunlosky et al. 2013 rate elaborative interrogation ("why would that be true?") as
  **moderate utility**; practice testing and distributed practice are the only two rated high.
  https://pubmed.ncbi.nlm.nih.gov/26173288/
- **[K]** Elaborative interrogation works best when learners have some prior knowledge to hang the
  "why" on — so ask *after* they've felt the thing, not before.
- **[I]** Patterns: **predict before build** ("what do you think happens if gravity goes to zero?");
  **guess the name** before it's given ("what would a studio call the person who makes explosions
  look cool?" → "a VFX artist"); **why after feel** ("why do you think the brick jump felt
  better for a platformer?"). Wrong guesses are fine and useful *if* feedback is immediate.

### 1.9 Embodied / enactive learning
- **[V]** Enactment effect: performing an action while learning beats hearing about it; a
  meta-analysis figure of Hedges' g ≈ 1.23 was reported in a search summary (source attribution
  in the snippet was unclear — treat as "large" rather than exact). Gestures must be meaningfully
  related, and performed by the learner.
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3536268/ ·
  https://en.wikipedia.org/wiki/Enactment_effect
- **[I]** In a Chromebook app "enactive" means **the kid's own hand causes the concept**: they
  drag the dial, they press jump and feel the floatiness, they click a thing and its Inspector
  opens. Also role enactment: "for this quest you *are* the QA tester — find three bugs and file
  them." Doing the job is how the job title sticks.

---

## 2. Making it stick

### 2.1 Retrieval (the testing effect)
- **[V]** Adesope, Trevisan & Sundararajan 2017 meta-analysis: practice testing vs. other
  practice, g ≈ **0.61**. **Secondary-school students benefited more** than younger or older
  groups; **mixed formats** gave the strongest effect; **multiple-choice produced strong
  effects** (Rowland 2014 found the reverse for format). Rowland 2014: stronger with **more
  effortful** retrieval, with **feedback**, and the effect **grows with the retention interval**.
  https://journals.sagepub.com/doi/abs/10.3102/0034654316689306 · https://pubmed.ncbi.nlm.nih.gov/25150680/
- **[I]** Consequences: chips (recognition) are legitimate retrieval, so a first recall can be a
  choice; escalate to cued and then free recall as the concept matures; always give feedback.

### 2.2 Spacing
- **[V]** Cepeda et al. 2008 (1,350+ people, gaps up to 3.5 months, tests up to a year later):
  performance rises then slowly falls as the study gap grows; the **optimal gap is ~20–40% of the
  retention interval for a 1-week test, ~5–10% for a 1-year test.**
  https://pubmed.ncbi.nlm.nih.gov/19076480/
- **[I] What that means here.** Two retention targets: (a) the end-of-course showcase (week 10),
  (b) the Unity course, months later. For (b), with a ~6-month horizon, the Cepeda ridgeline puts
  the useful gap at roughly **2–5 weeks** — comfortably what a weekly course produces naturally.
  So: short gaps early (to get it learned at all), then 2–4 session gaps late.

### 2.3 Interleaving
- **[V]** Rohrer et al. 2020 RCT (787 7th-graders, 54 classes): interleaved practice → **61% vs
  38%** on an unannounced test a month later, d ≈ **0.83**.
  https://gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf
- **[K]** Interleaving helps chiefly because learners must *choose which concept applies* —
  discrimination. It helps most for similar, confusable items.
- **[I]** Game-dev has lots of confusable pairs: sprite vs. particle; collider vs. sprite outline;
  gameplay programmer vs. environment artist; frame vs. frame rate; bug vs. design problem. Build
  **"which department?"** and **"what's causing this?"** quests that mix causes, so the kid has to
  pick the concept, not just apply the one the quest is obviously about.

### 2.4 Desirable difficulties
- **[K]** Bjork: conditions that slow apparent learning (spacing, interleaving, retrieval,
  generation) improve long-term retention — but only if the learner can succeed with effort.
  An impossible difficulty is just a difficulty.
- **[I]** With 10–13-year-olds new to computers, keep success rate high (target **~80–85%** of
  retrievals succeed, with a hint ladder), and never make the difficulty block the fun part (the
  build). The kid should feel "I remembered!", not "I'm being tested."

### 2.5 Scheduling algorithms, and which fits
| Algorithm | Core rule | Fit here |
|---|---|---|
| **Leitner boxes** [K] | Card in box *n* reviewed every ~2ⁿ units; correct → up a box, wrong → back to box 1 | **Best fit.** Transparent, teacher-explainable, trivial JSON |
| **SM-2** (SuperMemo/Anki) [K] | EF starts 2.5; intervals 1 day, 6 days, then I×EF; EF += 0.1 − (5−q)(0.08 + (5−q)·0.02), floor 1.3 | Designed for daily flashcards and 0–5 self-grades; kids won't self-grade; overkill |
| **FSRS** [V] | Difficulty, Stability, Retrievability; R(t,S) = (1 + F·t/S)^decay, R = 0.9 when t = S; review when R hits desired retention (default 0.9); 19 trainable weights | State of the art for flashcards, needs lots of reviews to fit; the *idea* (review when predicted recall drops to a target) is worth stealing |
| **Half-life regression** (Duolingo) [V + K] | p = 2^(−Δ/h); h grows with correct answers, shrinks with errors, adjusted by item difficulty; −45% error vs. baselines, +12% daily engagement | The *model shape* (one number, half-life, per concept) is ideal; the *training* needs data we don't have |

Sources: FSRS https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm ·
https://borretti.me/article/implementing-fsrs-in-100-lines · HLR
https://research.duolingo.com/papers/settles.acl16.pdf · https://github.com/duolingo/halflife-regression

- **[I] Recommendation:** a Leitner ladder **measured in sessions attended** (not days — a kid who
  misses a week shouldn't come back to three overdue reviews), with an HLR-style half-life per
  concept so the director can rank "most at risk" concepts. Hand-set parameters; fit them later
  from telemetry once there are a few hundred kids.

### 2.6 Intervals for a weekly, ~10-session course
[I] One concept's life, if all goes well:

| Encounter | When | Form |
|---|---|---|
| 0 Teach | Session *n*, quest A | feel → see → name; character uses the word 3+ times |
| 1 | Same session, 10–30 min later (end of quest or the next quest) | recognition: chips, or "which of these did we just add?" |
| 2 | Session *n+1* (≈1 week) | cued recall inside a new quest |
| 3 | Session *n+2 or n+3* | free recall / use without a cue |
| 4 | Session *n+5 or n+6* | interleaved with a confusable concept |
| 5 | Showcase (week 10) | kid explains it to someone (the "new intern", a parent, the teacher) |

Failure at any step drops the concept back one or two rungs (not to zero — they did learn it once).
The within-session first retrieval matters: for brand-new learners the first gap should be short,
or there's nothing to space.

### 2.7 Retrieval *inside* gameplay, so it isn't a quiz
All [I] unless marked; these are the concrete forms the director can pick from.
1. **The prompt is the retrieval.** The recipe card of words (03) is shown the first time and
   **faded** after: next time the kid must produce "particles" themself to get the effect. A
   vague ask gets a clarifying question that offers the word as a chip (hint step), not a refusal.
2. **Bug reports from the QA character.** "Playtester says: 'I fell through the floor.' Which
   department should I send this to?" [Collider team] [Art team] [Sound team]. Recall + interleaving
   + role vocabulary, and it's plot.
3. **The new intern.** A naive character who asks the kid "what's an Inspector?" or gets it
   slightly wrong for the kid to correct. **[K]** The protégé effect (Chase, Chin, Oppezzo &
   Schwartz 2009, Betty's Brain): students work harder learning for a teachable agent than for
   themselves.
4. **Callbacks that need the old idea.** The sound designer's quest needs the *feedback* concept
   from three quests ago ("what should the player *feel* when they grab a coin?"). This is the
   course-engine's existing plan; the student model decides *which* callback.
5. **Predict, then play.** "Before I change it — will the jump get higher or lower?" A prediction
   is a retrieval of the model, and wrong predictions are memorable.
6. **Studio stand-up.** A 30-second opener each session: a character asks "what did we add last
   week?" with icon chips. Recognition first, then "anything else?" free text.
7. **Tool unlocks gated by use, not by quiz.** The particle-effect maker prize appears when the kid
   has asked for particles by name in a build — the unlock *is* the evidence.
8. **Spot-it in a real game.** Show a 5-second clip of a well-known style of game; "find the
   particles" / "where's the camera?" Near transfer with no quiz framing.
9. **Explain your game.** At milestones the kid writes (or picks) the "credits" or a "patch note"
   for their own game: "Added dust particles when landing. Lowered gravity." Retrieval dressed as a
   real studio artifact.

---

## 3. Tracking skills (student modelling)

### 3.1 The models
- **Bayesian Knowledge Tracing** [V + K]. Corbett & Anderson 1995: a two-state hidden Markov
  model per skill, parameters P(L0) prior, P(T) learn, P(G) guess, P(S) slip, updated after every
  response. https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing ·
  https://files.eric.ed.gov/fulltext/EJ1115329.pdf. **[K]** Update: posterior given correct =
  L(1−S) / [L(1−S) + (1−L)G]; given incorrect = LS / [LS + (1−L)(1−G)]; then L ← post + (1−post)T.
  Cognitive Tutors conventionally call a skill mastered at **P(L) ≥ 0.95**. BKT has no forgetting
  in its classic form.
- **N-consecutive-correct** [V]. Kelly, Wang, Thompson & Heffernan 2015 compared BKT to ASSISTments'
  "3 correct in a row"; later work showed N-CCR is an optimal mastery policy for BKT variants —
  i.e., the simple heuristic hides a BKT model.
  https://link.springer.com/chapter/10.1007/978-3-030-52240-7_16
- **Elo ratings** [V]. Pelánek 2016: Elo is "simple, robust, and effective" for adaptive
  education; one ability per learner (or per learner×skill) and one difficulty per item, both
  nudged after each response by K·(result − expected).
  https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf
- **Performance Factors Analysis** [V]. Pavlik, Cen & Koedinger 2009: logistic regression on
  counts of prior successes and failures per skill; competitive with BKT, weaker than DKT on big
  data. https://files.eric.ed.gov/fulltext/ED506305.pdf
- **Deep Knowledge Tracing** [V]. Khajah, Lindsey & Mozer 2016: BKT with known extensions
  (forgetting/recency, skill similarity, individual ability) performs **indistinguishably from
  DKT**; "knowledge tracing may be a domain that does not require depth."
  https://arxiv.org/abs/1604.02416

### 3.2 What the big systems do
- **Khan Academy** [V]: levels Attempted → **Familiar** (70–85% on an exercise) → **Proficient**
  (all correct) → **Mastered** (via unit tests / Mastery Challenges). **Mastery Challenges** are
  6 questions over 3 *previously learned* skills, unlocked no more than every 12 hours — a built-in
  spaced review. https://support.khanacademy.org/hc/en-us/articles/5548760867853 ·
  https://support.khanacademy.org/hc/en-us/articles/360037127892
- **Duolingo** [V]: HLR for word-level spacing (above); **Birdbrain**, an IRT/Elo-like logistic
  model estimating exercise difficulty and learner ability after every exercise, choosing items in
  a "Goldilocks" zone. https://spectrum.ieee.org/duolingo
- **Carnegie Learning MATHia** [V + K]: per-skill progress bars ("skillometers") driven by BKT;
  a workspace ends when all its skills reach mastery.
  https://support.carnegielearning.com/help-center/math/educators/mathia/getting-started-in-mathia/article/understanding-mastery-and-concept-builder-workspaces-in-mathia/
- **ALEKS** [V + K]: Knowledge Space Theory — knowledge is a structured space constrained by
  prerequisites; the system teaches items on the learner's "outer fringe" (ready to learn, all
  prerequisites known). https://www.aleks.com/about_aleks/publications_kst.
  **[I]** This is exactly the course engine's concept web + director: "next quest = something whose
  prerequisites are all at least *used*."

### 3.3 What's practical for this app
- **[I]** The constraints (serverless, no DB beyond per-student saves, ~20 kids per class, no
  training data at launch, a teacher who must understand it) rule out DKT and make fitted
  Elo/PFA premature (item difficulty needs many responses per item; 20 kids won't give it).
  **BKT-lite + a half-life for forgetting, with hand-set parameters, is the right size.** It's
  interpretable, runs in a few lines of plain JS inside the request that ends a quest, and the
  Khajah result says the "extended BKT" family is not leaving accuracy on the table.
- **Granularity (knowledge components).** [K] Koedinger's KLI framework: a KC should be the
  smallest unit that a single observable step can evidence. Too coarse ("physics") and mastery
  means nothing; too fine ("gravity value 300 vs 500") and nothing ever gets enough evidence.
  **[I]** One KC per concept-web node (~30–50 for the course), and within it **three facets that
  are cheap to observe separately:**
  - **word** — recognises / uses the term ("Inspector")
  - **idea** — can say what it does or pick the right one for a problem
  - **use** — asks for / applies it in their own game unprompted
  A kid can have the word without the idea (parroting) or the idea without the word (common for
  new-to-computers kids). Both matter for the Unity transfer.
- **Mastery threshold.** [I] Don't let a single session's streak count. "Secure" requires
  P(known) ≥ 0.9 **and** successful evidence in **≥ 2 different sessions**, at least one of them
  **unprompted** (free text or unasked use). This is N-CCR with spacing built in.

---

## 4. Stealth assessment and intrinsic integration

### 4.1 Stealth assessment and evidence-centred design
- **[V]** Shute coined *stealth assessment*: measurement woven unobtrusively into a game so
  inferences come from ordinary play, not tests. It rests on **evidence-centred design (ECD)**:
  a **competency model** (what we want to know about the learner), an **evidence model** (which
  observable behaviours count as evidence for which competency, and how strongly), and a **task
  model** (situations engineered to elicit those behaviours). Evidence rules are written before
  data are collected.
  https://myweb.fsu.edu/vshute/pdf/sa_handbook.pdf · https://myweb.fsu.edu/vshute/pdf/IJGCMS.pdf ·
  https://direct.mit.edu/books/oa-monograph/3700/Stealth-AssessmentMeasuring-and-Supporting
- **[V]** *Newton's Playground* / *Physics Playground*: players draw objects (ramps, levers,
  pendulums, springboards) to move a ball; drawing a working solution *requires* qualitative
  physics. 167 eighth/ninth graders, ~4 hours over 1.5 weeks: significant pre-post physics gains,
  in-game indicators related to learning, good psychometrics; three concurrent stealth
  assessments (physics, creativity, conscientiousness).
  https://eric.ed.gov/?id=EJ1024794 · https://myweb.fsu.edu/vshute/pdf/JER.pdf
- **[K]** Physics Playground's evidence model was a Bayesian network; the practical lesson for
  small teams is the *discipline*, not the network: name the observable, name the competency,
  name the strength.

**[I] ECD mapped onto the course engine:**
| ECD | Here | Who writes it |
|---|---|---|
| Competency model | the concept web (node × facet: word / idea / use) | people |
| Task model | quest outline: goal, and *what situation elicits the concept* | people |
| Evidence model | per quest, 2–4 **observables** with a strength, e.g. "kid picks the collider department for the fall-through bug" → idea, weak; "kid types 'particles' unprompted" → word+use, strong | people (in the outline), checked by code |
| Scoring | the student model update (section 6) | code |

The AI character *proposes* evidence events (quoting the kid's words and naming the observable);
a deterministic checker (like `quiz-check.js`, "reject, never repair") verifies the observable is
one the outline lists and, for word evidence, that the term literally appears in the kid's text.
The LLM never writes mastery numbers directly. This keeps the teacher's report honest.

### 4.2 Intrinsic integration
- **[V]** Habgood & Ainsworth 2011 (*J. Learning Sciences*), *Zombie Division*, ages 7–11: the
  maths (division) *is* the combat mechanic — you pick the divisor weapon that divides the number on
  the skeleton. The intrinsic version was compared with an extrinsic version (same game, maths as
  quizzes between levels) and a control; evidence favoured the intrinsic approach.
  https://www.tandfonline.com/doi/abs/10.1080/10508406.2010.508029 ·
  https://shura.shu.ac.uk/3556/1/Habgood_Ainsworth_final.pdf
- **[K]** Key numbers as I recall them: the intrinsic group learned more by delayed test, and in a
  free-choice study children spent roughly **seven times longer** playing the intrinsic version.
  Habgood's two design conditions: (1) the learning is delivered through the **core mechanic** the
  player interacts with most, and (2) it lives in the **flow** of play, not in pauses.
- **[V]** Clark, Tanner-Smith & Killingsworth 2016 meta-analysis: games beat non-game conditions
  (g ≈ 0.33), and *augmented game designs* beat standard ones (g ≈ 0.34) — design matters more
  than medium. https://pubmed.ncbi.nlm.nih.gov/26937054/
- **[I]** This course has an unusually easy path to intrinsic integration: **the core mechanic is
  directing the AI to change your game, and the concepts are the only levers that work.** To make
  the dust puff, you ask for particles; to stop falling through the floor, you think about
  colliders. The failure mode to avoid is the *extrinsic* version: a character stopping play to ask
  "quick question: what's a collider?". If a retrieval can't be phrased as something that changes
  the kid's game or moves the story, it's a quiz in costume.

---

## 5. Motivation for this age

### 5.1 Self-determination theory
- **[V]** Ryan, Rigby & Przybylski 2006: perceived in-game **autonomy** and **competence**
  predicted enjoyment and continued play; autonomy, competence and **relatedness** each
  independently predicted enjoyment and future play; intuitive controls feed competence.
  https://link.springer.com/article/10.1007/s11031-006-9051-8
- **[I]** Autonomy = it's *their* game (theme, genre, which quest next from 2–3 offered —
  the director's "glimpse"); competence = the game visibly gets better because of their decision;
  relatedness = characters who remember them and their game (the learner card), and in class,
  playing each other's games. Tweens reject the babyish (03, Gelman): competence feedback should
  sound like a colleague ("nice call — that's what a real gameplay programmer would do"), not a
  kindergarten teacher.

### 5.2 Rewards and the overjustification effect
- **[V]** Lepper, Greene & Nisbett 1973: preschoolers who *expected* a reward for drawing later drew
  less in free time than those given the same reward *unexpectedly* or none.
  https://www.researchgate.net/publication/281453299
- **[V]** Deci, Koestner & Ryan 1999 (128 studies): engagement-, completion- and
  performance-contingent rewards undermined free-choice intrinsic motivation (d ≈ −0.40, −0.36,
  −0.28), as did tangible and expected rewards overall.
  https://www.selfdeterminationtheory.org/SDT/documents/2001_DeciKoestnerRyan.pdf
- **[K]** Same meta-analysis: **unexpected** tangible rewards and **task-noncontingent** rewards
  did not undermine; **positive verbal feedback enhanced** intrinsic motivation. Cameron & Pierce
  dispute the size of the effect (https://pubmed.ncbi.nlm.nih.gov/10589298), but no one argues
  expected, controlling, pay-per-task rewards are good for interest.
- **[I] Designing prizes that don't kill motivation** (course-engine's prizes are tool powers,
  studio unlocks, desk/avatar cosmetics):
  - **Tool powers are the best prize type** — they're *informational* (you've grown, here's a
    grown-up tool) and they feed autonomy and competence rather than replacing the reason to play.
    Keep them.
  - **Make prizes surprising, not priced.** Avoid "finish 3 quests = 50 coins" contracts. Prefer
    "the VFX artist was so impressed she's lending you her particle maker" — unexpected, framed as
    recognition of *what they did*.
  - **Reward the concept-bearing act, not completion or time on task.** Completion- and
    engagement-contingent rewards were the most undermining in the meta-analysis.
  - **Cosmetics are fine as collectibles** but keep them out of the teaching moment (03 rule 9).
  - **Specific verbal feedback is free and helps**: name the concept in the praise.

### 5.3 Collections and badges
- **[V]** Abramovich, Schunn & Higashi 2013 (middle-school maths tutor): badges affected high and
  low performers differently; designers must consider learners' ability and motivations; they
  distinguish merit badges (skill) from video-game achievements.
  https://link.springer.com/article/10.1007/s11423-013-9289-2
- **[K]** Hanus & Fox 2015: a gamified class with badges and a leaderboard showed *lower* intrinsic
  motivation and exam scores than the same class without. Leaderboards for kids new to computers
  are a hazard: bottom-of-the-board kids disengage.
- **[I]** **The concept card deck is the collection** — one card per concept, with the icon, the
  kid-friendly definition, the studio role that owns it, the Unity name, and a thumbnail from *their*
  game where they used it. Cards "level up" (word → idea → use) visibly. This makes the collection
  a memory aid and a self-assessment tool, not just a trophy shelf. No leaderboards.

### 5.4 Curiosity and information gaps
- **[V]** Loewenstein 1994: curiosity arises when attention focuses on a *gap* between what one
  knows and wants to know; small, salient gaps drive it more than huge ones.
  https://psychologyfanatic.com/information-gap-theory/ (secondary)
- **[V]** Gruber, Gelman & Ranganath 2014: in high-curiosity states memory improves both for the
  answer *and for incidental material* encountered meanwhile, via hippocampus–dopamine
  interaction. https://pubmed.ncbi.nlm.nih.gov/25284006/
- **[V]** Hidi & Renninger 2006: interest develops from *triggered situational* → *maintained
  situational* → emerging individual → well-developed individual interest; well-designed
  environments trigger it and meaningful tasks and social contact maintain it.
  https://eric.ed.gov/?id=EJ736298
- **[I]** The director's teaser ("the sound designer wants to meet you soon…") is an information
  gap by design; make teasers **specific and near** ("…she's heard your coin sound is *silent*")
  rather than vague. Open each concept with a small visible gap ("why does this game feel so
  crunchy and yours doesn't?") and close it within the quest. Gruber's incidental-memory finding
  suggests **putting the new term inside the curious moment**, not before it.

---

## 6. Ranked design rules for this course

1. **The concept must be the lever.** Every concept is taught by being the thing the kid has to
   name or choose to make their game do what they want (intrinsic integration). If a check can't
   change the game or the story, cut it. *(Habgood & Ainsworth; Clark 2016)*
2. **Feel → see → name, every time.** Play the difference, then a labelled dial, then the value in
   an Inspector row with the Unity name. Later quests start at "name". *(Fyfe 2014; transfer)*
3. **Budget new words: ≤1 per quest step, 2–3 per session, ~20–30 Tier 3 terms per course**, plus
   the Tier 2 studio words; each used 3+ times in its first session and retrieved in 4+ later
   sessions. *(Cowan; Beck ~12 encounters; Swanborn 15%)*
4. **Every concept comes back at least four times, in widening gaps measured in sessions**: same
   session → next session → 2–3 later → 5–6 later → showcase. Drop back a rung on failure.
   *(Cepeda 2008; Adesope 2017)*
5. **Retrieval wears a costume**: bug reports, the intern who asks, predictions, stand-up recaps,
   patch notes, a faded recipe card. Recognition first, then cued, then free. Always immediate
   feedback. *(Rowland 2014; protégé effect)*
6. **Mix confusable concepts on purpose** — "which department fixes this?" quests with several
   possible causes, once each is individually familiar. *(Rohrer 2020)*
7. **Ask before telling**: predict before build, guess the job title before it's given, "why" after
   feeling. Wrong guesses are welcome when feedback follows at once. *(Bertsch 2007; Kornell 2009)*
8. **People write the evidence rules.** Each quest outline lists 2–4 observables with strength;
   the AI proposes evidence with the kid's own words quoted, a checker validates it, code updates
   the model. The LLM never sets mastery. *(Shute ECD; course-engine's checker)*
9. **Characters are named by role and own their words.** The VFX artist says "particles"; the QA
   tester says "bug report". Story carries concepts; lore that carries none is cut. *(Mar 2021;
   Adams 2012 warning)*
10. **Every analogy is pre-approved with its "breaks where" line**, stored in the concept web, and
    the break is said aloud once. *(Glynn TWA; Gentner)*
11. **Prizes are surprise recognitions of concept-bearing acts, preferably tool powers**; never
    price quest completion, never leaderboards; praise names the concept. *(Deci 1999; Lepper 1973;
    Hanus & Fox)*
12. **The concept card deck is the collection and the memory aid**: fixed icon, one-line
    definition, owner role, Unity name, a screenshot from *their* game; levels word → idea → use.
    *(dual coding; Abramovich 2013)*

---

## 7. Recommended student model (plain JavaScript over the per-student JSON save)

### 7.1 Design choices
- **One record per concept-web node**, three facet probabilities (word / idea / use) updated by a
  BKT-lite rule, plus **one half-life** (in sessions) for forgetting, HLR-style.
- **Time is counted in sessions attended**, with the calendar date kept only for the teacher view.
- **Evidence events carry a strength**, set by the quest outline's observable (people decide), which
  selects guess/slip parameters. Chips are weak evidence (high guess rate); unprompted free text
  is strong.
- **All parameters hand-set** and in one place; refit later from `telemetry.js` logs.
- **Deterministic, synchronous, microseconds** — fits inside the request that ends a quest (no
  background work, CLAUDE.md §6). No module-level state.

### 7.2 Fields per concept
```json
"concepts": {
  "particles": {
    "p":        { "word": 0.62, "idea": 0.48, "use": 0.20 },
    "halfLife": 1.0,            // sessions until predicted recall halves
    "rung":     2,              // 0 unseen · 1 taught · 2..5 review ladder · 6 secure
    "firstSession": 3,          // session index when taught
    "lastSession":  4,          // session index of last evidence
    "due":      6,              // session index of next planned retrieval
    "successSessions": [3, 4],  // distinct sessions with a successful retrieval
    "unprompted": 1,            // count of unprompted uses (free text / unasked build)
    "hints":    2,              // hints needed, lifetime
    "log": [                    // last 8 events only, for the teacher and for debugging
      { "s": 4, "facet": "word", "ok": true, "str": "strong", "q": "quest-dust-puff" }
    ]
  }
},
"session": 4                    // sessions attended so far
```

### 7.3 Update rule and resurfacing
```js
// student-model.js — plain script, no dependencies. Parameters are hand-set; see research-pedagogy.md.
const EVIDENCE = {                    // guess / slip per evidence strength
  weak:   { g: 0.35, s: 0.10 },       // picked the right chip among 3
  medium: { g: 0.15, s: 0.10 },       // cued recall, or correct after one hint
  strong: { g: 0.05, s: 0.10 },       // unprompted free text, or used in own build unasked
};
const LEARN = 0.15;                   // P(T): chance a practice opportunity teaches it
const PRIOR = 0.05;                   // P(L0) for a kid new to computers
const LADDER = [0, 0, 1, 2, 3, 5];    // sessions to wait after reaching rung i (rung 1 = same session)
const SECURE_P = 0.9, RESURFACE_BELOW = 0.7;

function blank(session) {
  return { p: { word: PRIOR, idea: PRIOR, use: PRIOR }, halfLife: 1, rung: 1,
           firstSession: session, lastSession: session, due: session,
           successSessions: [], unprompted: 0, hints: 0, log: [] };
}

// Predicted chance the kid can still recall it now (HLR shape: p = 2^(-Δ/h)).
function recall(c, session) {
  return Math.pow(2, -(session - c.lastSession) / c.halfLife);
}

// One evidence event, already validated by the checker against the quest outline.
function update(save, conceptId, ev) {           // ev = {facet, ok, strength, hinted, unprompted, quest}
  const s = save.session;
  const c = save.concepts[conceptId] ||= blank(s);
  const { g, s: slip } = EVIDENCE[ev.strength];
  // Forgetting first: shrink the facet toward the prior by how long it's been.
  const r = recall(c, s);
  let L = PRIOR + (c.p[ev.facet] - PRIOR) * r;
  // BKT posterior, then learning transition.
  const post = ev.ok ? L * (1 - slip) / (L * (1 - slip) + (1 - L) * g)
                     : L * slip / (L * slip + (1 - L) * (1 - g));
  c.p[ev.facet] = post + (1 - post) * LEARN;
  // Half-life: grows only on a success after a real gap (spacing; once per session); failure halves it.
  const gap = Math.max(0, s - c.lastSession);
  if (ev.ok && !ev.hinted && gap > 0) c.halfLife *= 2;
  else if (!ev.ok)         c.halfLife = Math.max(0.5, c.halfLife / 2);
  // Ladder.
  if (ev.ok) { if (!c.successSessions.includes(s)) c.successSessions.push(s);
               c.rung = c.rung === 1 ? 2 : Math.min(6, c.rung + (gap > 0 ? 1 : 0)); }
  else       { c.rung = Math.max(1, c.rung - 2); }
  if (ev.hinted) c.hints++;
  if (ev.unprompted && ev.ok) c.unprompted++;
  if (isSecure(c)) c.rung = 6;
  c.due = s + (LADDER[c.rung] ?? 8);
  c.lastSession = s;
  c.log = [...c.log, { s, facet: ev.facet, ok: ev.ok, str: ev.strength, q: ev.quest }].slice(-8);
  return c;
}

function isSecure(c) {
  return c.p.word >= SECURE_P && c.p.idea >= SECURE_P &&
         new Set(c.successSessions).size >= 2 && c.unprompted >= 1;
}

// What the director asks at the end of each quest: which old concepts to fold into the next ones.
function resurfaceCandidates(save, upcomingPrereqs = [], max = 2) {
  const s = save.session;
  return Object.entries(save.concepts)
    .filter(([, c]) => c.rung >= 1 && (c.due <= s || recall(c, s) < RESURFACE_BELOW))
    .map(([id, c]) => ({ id, score: (1 - recall(c, s)) + (upcomingPrereqs.includes(id) ? 0.5 : 0)
                                     + (c.rung === 6 ? -0.3 : 0) }))
    .sort((a, b) => b.score - a.score).slice(0, max).map(x => x.id);
}

// Ready to learn (ALEKS "outer fringe"): unseen concepts whose prerequisites are all used.
function readyToLearn(save, web) {
  return web.filter(n => !save.concepts[n.id] &&
    n.needs.every(id => (save.concepts[id]?.p.idea ?? 0) >= 0.6));
}
```

### 7.4 How the director uses it (per quest-end request)
1. Apply the checker-validated evidence events with `update`.
2. Next quests: **one** new concept from `readyToLearn` (autonomy: offer 2–3 as the "glimpse"),
   and **one or two** old concepts from `resurfaceCandidates`, preferring ones the new quest can
   *need* (callbacks) and pairing confusable concepts once both are at rung ≥ 3 (interleaving).
3. Choose the retrieval form by facet level: p < 0.5 → recognition (chips); 0.5–0.8 → cued
   (faded recipe card, hint available); > 0.8 → free recall / unprompted use / teach the intern.
4. Keep the success rate high: if the last two retrievals on a concept failed, re-teach it
   (worked example) instead of retesting.
5. Start of each session: `save.session++`, then a 30-second stand-up built from the top
   `resurfaceCandidates`.

### 7.5 Teacher view and honesty
- Per concept, show the class as counts per rung (unseen / taught / reviewing / secure) and the
  *evidence quotes* behind "secure", so a teacher can see *why* the model believes it.
- Kids see their card levels (word / idea / use), never a probability.
- Record the parameter version in the save so a later refit can re-score old logs.

### 7.6 Caveats
- The parameter values above are reasonable defaults [I], not fitted. The half-life multipliers
  (×2 after an unhinted success in a later session, unchanged within a session, ÷2 on failure) mimic HLR/FSRS behaviour
  qualitatively. After a pilot, compare predicted vs. actual recall on resurfaced concepts and
  adjust `LEARN`, the guess rates and the multipliers.
- The biggest validity risk isn't the maths, it's **evidence quality**: an LLM that is generous
  about "the kid understood". Hence rule 8 — observables written by people, verified by code, and
  word evidence requiring the term to literally appear in the kid's text.
