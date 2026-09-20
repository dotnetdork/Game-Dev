/* dom.js — the two helpers every other file assumes are already there.
 *
 * Moved here by the Phase 6 split in docs/architecture-audit-2026-09-15.md, and `esc` moved the
 * furthest: it lived in pages.js, which is loaded thirteen script tags AFTER project.js — whose
 * mdToSafeHTML falls back to esc() when DOMPurify is missing. That fallback is the app's last line
 * of defence against markup in a model's reply reaching innerHTML, and it was depending on a file
 * about rendering the Store. It worked, because both are function declarations and the call happens
 * at runtime; it worked by luck rather than by arrangement.
 *
 * Loaded first, so nothing below it has to wonder.
 */
const $ = function (id) { return document.getElementById(id); };

/* Escape before anything authored, stored or generated is put near innerHTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
