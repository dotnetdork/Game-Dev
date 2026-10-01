/* ai/safety.js — what the studio does when a kid types something that is not about the game.
 *
 * The whole-app audit (2026-09-30, spec D51) found that nothing in the app handled a child saying they
 * were being hurt, or hurting themselves: the line went to the AI as a game request, or, with the AI
 * down, was written into their design doc or Ideas as a feature. The prompts said "answer briefly and
 * kindly, then point back at the task" (mentor.md), which is the right answer to "ur dumb" and the
 * wrong one to "my dad hits me".
 *
 * So this check is deterministic and comes BEFORE any AI. A model is not trusted to notice, and the
 * AI-down paths have no model at all. A match gets a fixed, kind reply that points to a grown-up in
 * the room, nothing is sent on to the AI, nothing is written into the doc, and the event is recorded
 * as its category only (telemetry 'concern'), never the words. The teacher hears it from the adult
 * the child was pointed at, and from the 'concern' count in the session report; the words stay
 * the child's.
 *
 * ONE LIST, TWO USERS. The browser checks first (studio/ui.js UI.concern, fetched from
 * GET /api/safety), because the studio's scripted paths run without calling the server at all. The
 * server checks again in /api/ai, in case the browser never got the list. Both read RULES below and
 * nothing else; a phrase added here is added everywhere.
 *
 * TUNED FOR FEW FALSE ALARMS. These are kids designing games, so "kill the zombies", "you die in the
 * lava" and "the hero gets hurt" are game design and must pass. The patterns are first person
 * ("myself", "me", "I want to die") or plainly not a game ("my address is"). A miss here is still
 * covered by the prompts' own rule (ai/skills/kid-communication.md, SAFETY); a false alarm costs a
 * kind sentence and a reask. */

const RULES = [
  // hurting themselves
  ['hurt', /\b(kill|hurt|cut|harm|hang)(ing)?\s+my\s*self\b/i],
  ['hurt', /\b(suicid(e|al)|self[-\s]?harm)\b/i],
  ['hurt', /\b(i|im|i'?m|i am)\s+(really\s+)?(want|wanna|going|gonna|wish)\s+(to\s+)?(die|be dead|end it all)\b/i],
  ['hurt', /\b(end|take)\s+my\s+(own\s+)?life\b/i],
  ['hurt', /\b(no|nothing|no reason)\s+to\s+live\b|\bdon'?t\s+want\s+to\s+(live|be alive)\b|\bkms\b/i],
  // being hurt by someone, or not safe
  ['harmed', /\b(someone|somebody|he|she|they|my\s+(dad|mom|mum|father|mother|step\s?dad|step\s?mom|uncle|aunt|brother|sister|cousin|teacher|coach|grandpa|grandma|parents?))\s+(keeps?\s+)?(hits?|beats?|hurts?|touch(es|ed)?|abuses?|abused|kicks?|punch(es)?)\s+me\b/i],
  ['harmed', /\b(i|im|i'?m|i am)\s+(being\s+)?(abused|bullied|hurt at home)\b/i],
  ['harmed', /\b(scared|afraid)\s+to\s+go\s+home\b|\bnot\s+safe\s+at\s+home\b/i],
  // sharing how to find them
  ['private', /\bmy\s+(home\s+)?(address|phone(\s+number)?|number|password|passcode)\s+(is|=)\b/i],
  ['private', /\bi\s+live\s+(at|on)\s+\d+/i],
  ['private', /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/],
  ['private', /\b[\w.+-]+@[\w-]+\.[\w.]+\b/],
  // not for a kids' studio
  ['adult', /\b(sex|sexy|porn\w*|nude|nudes|naked|boobs?|penis|vagina|dick)\b/i]
];

/* What the kid is told. Short, warm, and the same every time, because it must never be a model's
   improvisation. 988 is the US Suicide & Crisis Lifeline (call or text), and the League is in the US;
   the teacher in the room is named first because they can act today. */
const REPLY = {
  hurt: 'I’m really glad you told me. That sounds like a lot to carry. Please tell your teacher or another grown-up you trust, right now. You can also call or text 988, any time.',
  harmed: 'Thank you for telling me. That is not okay, and it is not your fault. Please tell your teacher or another grown-up you trust today. They can help in ways I can’t.',
  private: 'Let’s keep that private! Never put your address, phone number, email or passwords in the studio. Back to your game?',
  adult: 'Let’s keep the studio friendly for everyone. What else could happen in your game?'
};
const CATEGORIES = Object.keys(REPLY);

/* The first rule a line matches, as its category, or null. */
function concern(text) {
  const s = String(text || '').slice(0, 4000);
  if (!s.trim()) return null;
  for (let i = 0; i < RULES.length; i++) if (RULES[i][1].test(s)) return RULES[i][0];
  return null;
}

/* The list for the browser, as sources it can rebuild with new RegExp. */
function forBrowser() {
  return { rules: RULES.map(function (r) { return [r[0], r[1].source, r[1].flags]; }), reply: REPLY };
}

module.exports = { concern: concern, forBrowser: forBrowser, REPLY: REPLY, CATEGORIES: CATEGORIES };
