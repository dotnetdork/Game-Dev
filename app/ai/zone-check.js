/* zone-check.js — validating what a building zone's two agents send back, before a student sees it.
 *
 * Same contract as quiz-check and grade-check, and for the same reason: a malformed reply from a
 * model is an ordinary event on the happy path, not an error condition. So nothing here throws, and
 * every function answers `null` for "could not vouch for this". The caller turns that into "nothing
 * happened" rather than into a message.
 *
 * Reject, never repair. A near-miss that gets patched up is a near-miss that ships.
 */

/* ---------- the coach's offered wording ----------
   The coach may end its reply with one line naming a box and a sentence to put in it:
 *
 *     SLOT: How you lose :: You fall, because you hesitated and the platform ran out of time.
 *
 * A trailing line rather than JSON mixed into prose, deliberately. `extractJSON` takes everything
 * from the first `{` to the last `}`, which is exactly wrong for a reply that is mostly sentences —
 * a brace in the prose swallows the lot. And the small models this has to run on are much better at
 * "put this on the last line" than at "emit valid JSON alongside your answer".
 *
 * `allowed` is the board the CLIENT sent, so a heading the student cannot see can never be written
 * to. That check is the whole security of this feature: without it the coach could name any heading
 * and the board would create it.
 */
function cleanSlotOffer(reply, allowed) {
  if (typeof reply !== 'string' || !Array.isArray(allowed) || !allowed.length) {
    return { reply: typeof reply === 'string' ? reply : '', slot: null };
  }
  const lines = reply.replace(/\r\n/g, '\n').split('\n');
  /* ANYWHERE in the reply, not only the last line.
     The prompt asks for the last line and models mostly oblige — but "mostly" is the whole problem:
     when one puts the line in the middle and keeps talking, a last-line-only parser leaves
     `SLOT: My game is :: A game where...` sitting in the chat as visible text and writes nothing to
     the board. That is the worst of both, and it is what shipped. Scanning the whole reply costs
     nothing and cannot do less than the strict version did.
     The first well-formed line wins; any others are stripped as prose but ignored, because one
     reply filling two boxes is a model that has stopped asking one question at a time. */
  let found = false, m = null;
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*SLOT\s*:/i.test(lines[i])) { kept.push(lines[i]); continue; }
    if (!found) { found = true; m = lines[i].match(/^\s*SLOT\s*:\s*(.+?)\s*::\s*(.+?)\s*$/i); }
    // and dropped, parsed or not
  }
  if (!found) return { reply: reply, slot: null };
  // Every SLOT: line comes out whether or not it parsed. Half a machine instruction shown to a
  // child is worse than no suggestion at all.
  const rest = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!m) return { reply: rest, slot: null };

  const want = norm(m[1]);
  const heading = allowed.filter(function (h) { return norm(h) === want; })[0];
  if (!heading) return { reply: rest, slot: null };        // not a box on their board

  const text = m[2].replace(/^["'“‘]+|["'”’]+$/g, '').trim();
  if (!text || text.length > 400) return { reply: rest, slot: null };
  /* A "suggestion" that is the heading again, or that is still the instruction, is not a suggestion.
     Both have been seen from small models handed a template. */
  if (norm(text) === want || /^<.*>$/.test(text)) return { reply: rest, slot: null };

  return { reply: rest, slot: { heading: heading, text: text } };
}

/* Squashed for comparison, because the heading a model copies back rarely matches byte for byte —
   "My game is..." loses its ellipsis, gains a capital, picks up a stray full stop. */
function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

/* ---------- the sign-off ----------
   `pass` must be a real boolean. Boolean("false") is true, and a model that answers with the string
   is common enough that accepting it would pass every zone ever refused.
   A refusal with no hint is downgraded to "could not vouch for it" rather than shown: telling a
   child they have not finished and not saying what to look at is the one outcome worse than
   letting a thin answer through. */
function cleanZoneVerdict(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.pass !== 'boolean') return null;
  if (raw.pass) return { pass: true };
  const hint = String(raw.hint == null ? '' : raw.hint).trim();
  if (!hint || hint.length > 300) return null;
  return { pass: false, hint: hint };
}

module.exports = { cleanSlotOffer: cleanSlotOffer, cleanZoneVerdict: cleanZoneVerdict };
