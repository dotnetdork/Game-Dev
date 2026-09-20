/* console-panel.js — what a student's code printed, kept and counted.
 *
 * There are two consoles in this app: the one under Code and Play that shows a game's output, and
 * the one in the lesson lab. Their header comments each said they behaved the same as the other.
 * They did not, and the difference was visible to a student.
 *
 * BOTH collapse identical consecutive lines, because a console.log inside an animation frame fires
 * sixty times a second and would otherwise be the whole log. The lab rewrote the line on screen to
 * say "(3×)". The game console only incremented a number nobody ever saw — so a child watching one
 * line of output could not tell whether it had happened once or four hundred times, which in a loop
 * is exactly the thing they are trying to find out. The lab's behaviour is the right one and both
 * do it now.
 *
 * They also disagreed on how much to keep (60 against 80) for no reason anybody wrote down.
 *
 * WHAT IS SHARED IS THE BUFFER, not the painting. The two panels genuinely differ above the log:
 * the bench has a collapse with a line count and opens itself on any output, while the game's opens
 * only on an error. Those are different answers to different situations and forcing them together
 * would be inventing a shape neither wants. So this owns the list and the counting, and each caller
 * keeps its own DOM.
 */

/* How many lines either console keeps. One number, because two was an accident rather than a
   decision, and 80 is the more generous of the pair. */
const CONSOLE_MAX = 80;

/* A log that collapses repeats and never grows without bound.
 *
 *   onNew(entry)      a line that has not just been said — the caller draws it and may hang
 *                     anything it likes on `entry` (the lab keeps the element there)
 *   onRepeat(entry)   the same line again; `entry.n` is how many times now
 *   onEvict(entry)    pushed out of the far end, so the caller can remove its element
 *
 * Every callback is optional and none of them may throw usefully — a console that breaks the thing
 * it is reporting on is worse than no console. */
function makeLogBuffer(opts) {
  const o = opts || {};
  const max = o.max || CONSOLE_MAX;
  let lines = [];

  function push(level, text) {
    const lvl = ['log', 'warn', 'error'].indexOf(level) >= 0 ? level : 'log';
    const body = String(text);
    const last = lines[lines.length - 1];
    if (last && last.level === lvl && last.text === body) {
      last.n++;
      if (o.onRepeat) { try { o.onRepeat(last); } catch (e) { /* never break the run */ } }
      return last;
    }
    const entry = { level: lvl, text: body, n: 1 };
    lines.push(entry);
    if (o.onNew) { try { o.onNew(entry); } catch (e) { /* as above */ } }
    while (lines.length > max) {
      const gone = lines.shift();
      if (o.onEvict) { try { o.onEvict(gone); } catch (e) { /* as above */ } }
    }
    return entry;
  }

  function clear() { lines = []; }
  function all() { return lines; }
  function total() { return lines.reduce(function (t, l) { return t + l.n; }, 0); }

  /* The last few lines, plus any earlier errors that scrolled out of that window. An error at
     startup matters more to whoever is reading this than the sixtieth frame of ordinary logging,
     and this is what travels to the AI with a question about a broken game. */
  function recent(n) {
    const keep = n || 14;
    if (lines.length <= keep) return lines.slice();
    const tail = lines.slice(-keep);
    const missedProblems = lines.slice(0, -keep)
      .filter(function (l) { return l.level === 'error' || l.level === 'warn'; }).slice(-3);
    return missedProblems.concat(tail);
  }

  return { push: push, clear: clear, all: all, total: total, recent: recent };
}

/* The text a line shows, including its repeat count. Shared so the two panels cannot disagree about
   what "said four times" looks like. */
function consoleLineText(entry) {
  return entry.n > 1 ? entry.text + '   (' + entry.n + '×)' : entry.text;
}
/* And its classes, for the same reason. */
function consoleLineClass(entry) {
  return 'cl' + (entry.level === 'error' ? ' err' : (entry.level === 'warn' ? ' warn' : ''));
}
