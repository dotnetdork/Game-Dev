# Child-Privacy Brief — LEAGUE Game Dev Course

**Status:** working reference, not legal advice. The League's staff own all legal
collection, authorizations, and parental/school consent. This brief exists so the
*product* (the app) is built with safe defaults and so the naming/showcase decisions
are captured. Have counsel confirm the actual consent forms and sign-up flow.

**Audience:** ages ~10–15, which *includes under-13s* → **COPPA applies.**
**Date captured:** 2026-07-28

---

## The rules, in brief

### COPPA (under 13) — in force now
The FTC's 2025 amendments are fully effective (rule effective June 23 2025;
compliance deadline April 22 2026, now passed).

- **"Personal information" is broad:** full name; a screen/username *if it can be used
  to contact the child*; email; phone; address; geolocation; any photo/video/audio of
  the child; persistent identifiers; and (new in 2025) biometric identifiers and
  government-issued IDs.
- **Core obligations:** clear privacy policy; direct notice + **verifiable parental
  consent (VPC)** before collecting from an under-13; **data minimization**; a **written
  data-retention policy** (no indefinite retention) and a written security program;
  separate consent to disclose data to third parties for non-integral purposes; don't
  condition participation on collecting more than needed.
- **School authorization exception:** a school may consent in place of parents for
  under-13s **only** for a school-authorized *educational* purpose, with **no commercial
  use**, and only if the vendor gives the school proper notice. This does **not** cover
  **public display or marketing** — a public showcase or promotional use needs
  **parental** consent.

### Teens 13–15 — beyond COPPA
COPPA stops at 13, but the trend does not. California's Age-Appropriate Design Code
defines "child" as under 18 (though as of March 2026 the 9th Circuit left most of it
enjoined on First-Amendment grounds, except a geolocation restriction); several states
have AADC-style teen laws; the direction is toward banning targeted ads/profiling of
minors. **Practical stance:** apply data-minimization and privacy-by-default to all
minors up to 18; no ad targeting/profiling; never sell minors' data.

### Showing names publicly
No federal law flatly bans identifying a student, but the consistent best practice for
publishing minors' work online is **written parental consent** specifying where it
appears and how to withdraw it. "First name + last initial" is a reasonable
minimization, but it is still identifying when attached to a game, so it should sit
behind consent and carry no other identifiers.

---

## Decisions for this app (recorded)

- **Pseudonymous handles by default.** Every student gets a chosen handle; the public
  showcase shows the **handle**, not a real name.
- **Parental opt-in reveals first name + last initial.** A consent flag (fed by the
  League's consent process) is the only thing that switches the display from handle to
  "First L." No flag → handle stays.
- **Autopublish is allowed under the handle.** Publishing a game to the showcase under a
  pseudonym does not expose personal information, so it's an acceptable default. The
  *name*, not the act of publishing, is what the opt-in gates.
- **Never attach other identifiers** to a public entry: no photo, age, school, city, or
  contact info.

## Recommendations worth building

- **Per-game private/public toggle** (student- or teacher-controlled). Autopublish under
  the handle is a fine default, but a game can always be kept private — don't make it a
  trap.
- **Teacher/admin review + takedown path.** A game's *content* can leak personal info
  even under a pseudonym (a real name on a title screen, a selfie sprite). An
  unmoderated public feed of minors' content is the real risk; give staff a way to
  review and pull entries.
- **Consent flag in the data model.** The app needs a simple per-student flag
  ("real-name display: on/off") that the League's consent process sets; the app just
  reads it.
- **PII minimization by design.** The code-server "username / teacher token" model is a
  good posture — it avoids emails and real identities. Student games/repos private by
  default; publishing is a separate, consented action.
- **Keep AI calls server-side; never send student PII to model providers**
  (Ollama / OpenRouter / Anthropic). The League-org GitHub model (no child GitHub
  accounts) is a solid COPPA posture.
- **No third-party ad/analytics trackers** using persistent identifiers on kids' pages;
  honor the written retention/deletion policy (a way for parents/schools to review and
  delete a child's data and games).

---

## Sources

- FTC — Finalizes Changes to Children's Privacy Rule (Jan 2025):
  https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- Federal Register — Children's Online Privacy Protection Rule (Apr 22 2025):
  https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- Latham & Watkins — FTC Publishes Updates to COPPA Rule:
  https://www.lw.com/en/insights/ftc-publishes-updates-to-coppa-rule
- FTC — Complying with COPPA: Frequently Asked Questions:
  https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC — COPPA Guidance for Ed Tech Companies and Schools:
  https://www.ftc.gov/business-guidance/blog/2020/04/coppa-guidance-ed-tech-companies-schools-during-coronavirus
- Wiley — Injunction on California AADC Partially Vacated:
  https://www.wiley.law/alert-Injunction-on-California-AADC-Partially-Vacated-Key-Provisions-May-Take-Effect-on-April-2
- Kelley Drye — Kids and Teens Privacy: 2025 Look Back and 2026 Predictions (State Patchwork):
  https://www.khlaw.com/insights/kids-and-teens-privacy-2025-look-back-and-2026-predictions-part-ii-state-privacy-patchwork
- Student Press Law Center — Parental permissions for photos of minors:
  https://splc.org/2018/09/splcs-question-of-the-week-parental-permissions-for-photos-of-minors/
