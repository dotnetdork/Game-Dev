/* sandbox-shims.js — the code that gets injected INTO a student's running frame.
 *
 * Two places run student code in a sandboxed iframe: the game (gameDoc in js/game-runner.js) and
 * the lesson lab (labDoc in js/lab.js). Both had to solve the same three problems, and both did,
 * separately:
 *
 *   catching what the code prints      so the console panel has something to show
 *   forwarding what it throws          so a crash reaches the student instead of vanishing
 *   pausing it from outside            by wrapping requestAnimationFrame, since we cannot reach in
 *
 * Each copy carried a comment saying the other existed. That is the shape of a thing about to
 * drift, and on 20 September it did: window.onerror was widened to carry the file and line number
 * in the game's copy and not in the lab's, so a lab error lost its location and nobody noticed,
 * because the two are never read side by side.
 *
 * So the parts that are the same are here, once. What is NOT shared is the message envelope, and
 * that is deliberate rather than laziness: the lab distinguishes `{log:...}` from `{err:...}`
 * because a thrown error fails the attempt and a console.error does not, while the game puts
 * everything through one `__gamelog`. Folding those together would make a child's console.error
 * fail their lab. Each caller supplies its own envelope; everything around it is shared.
 *
 * WHAT THESE FUNCTIONS RETURN IS SOURCE CODE, as a string, to be embedded in a <script> tag in a
 * srcdoc document. It runs in the frame, not here. That is why it is written in the old style with
 * `var` and no arrow functions, and why tools/check-sandbox.js exists — a syntax error in a string
 * cannot be caught by reading this file, and it would break every game and every lab at once.
 */

/* Turning console arguments into one line of text.
   Merged from the two versions, which each handled something the other dropped: the game's
   understood the %c/%s substitutions Phaser uses when it prints its banner, and the lab's
   JSON-stringified objects instead of showing "[object Object]" to a child trying to see what is
   in one. A student deserves both wherever they are. */
const SANDBOX_FORMAT = 'function f(a){'
  + 'a=[].slice.call(a);'
  + 'if(typeof a[0]==="string"&&/%[csdfoO]/.test(a[0])){'
  + 'var i=1;var o=a[0].replace(/%[csdfoO]/g,function(m){if(m==="%c"){i++;return "";}return String(a[i++]);});'
  + 'return (o+" "+a.slice(i).map(v).join(" ")).replace(/\\s+/g," ").trim();}'
  + 'return a.map(v).join(" ");}'
  + 'function v(x){if(typeof x==="string")return x;'
  + 'try{return JSON.stringify(x);}catch(e){return String(x);}}';

/* Everything the frame says, on its way out.
 *
 *   post     a JS expression building the message for one console line, from `lvl` and `txt`
 *   onError  a JS expression building the message for an UNCAUGHT error, from `msg`, `file`,
 *            `line`, `col`. Optional: without it, errors go out through `post` as level "error".
 *
 * Both are expressions rather than values because this is source being generated, not an object
 * being passed. They are written by us, never by a student — nothing here interpolates anything a
 * child typed. */
function sandboxConsoleShim(opts) {
  const post = opts.post;
  const onError = opts.onError || null;
  return '<' + 'script>(function(){'
    + SANDBOX_FORMAT
    + 'function send(m){try{parent.postMessage(m,"*");}catch(e){}}'
    + 'function s(lvl,txt){send(' + post + ');}'
    /* info and debug are folded into log rather than dropped. They were dropped in the game's copy,
       so a student who typed console.info saw nothing happen and reasonably concluded printing did
       not work. */
    + 'var c=console;["log","info","debug","warn","error"].forEach(function(n){'
    + 'var o=c[n]?c[n].bind(c):function(){};'
    + 'c[n]=function(){o.apply(c,arguments);s(n==="warn"?"warn":(n==="error"?"error":"log"),f(arguments));};});'
    /* window.onerror is handed (message, source, lineno, colno, error) and the original game copy
       bound only the first. The location is the single most useful thing in the whole message to a
       twelve-year-old looking for their typo, and it was being thrown away. */
    + 'window.onerror=function(msg,src,line,col){'
    + 'var file=String(src||"").split("/").pop();'
    + 'send(' + (onError || '(function(){return ' + post.replace(/\btxt\b/g, 'String(msg)').replace(/\blvl\b/g, '"error"') + ';})()') + ');'
    + 'return false;};'
    /* A rejected promise with no catch is silent in every browser. A student who writes an async
       load and gets it slightly wrong sees nothing at all, which is the worst kind of bug to meet
       when you are eleven. Neither copy had this until now. */
    + 'window.addEventListener("unhandledrejection",function(e){'
    + 'var r=e&&e.reason;s("error","Unhandled promise rejection: "+((r&&r.message)||r||"?"));});'
    + '})();<' + '/script>\n';
}

/* Pausing from outside a sandbox we cannot reach into.
   Both the game and every lab animate with requestAnimationFrame, so wrapping that one function
   freezes either without touching the student's code or needing an API they have not met. Held
   callbacks are handed back to the real rAF on resume.
   `ctl` is the control key the parent posts — the two use different ones so a message meant for the
   lab cannot pause a game running behind it. */
function sandboxPauseShim(ctl) {
  return '<' + 'script>(function(){'
    + 'var p=false,held=[],raf=window.requestAnimationFrame.bind(window);'
    + 'window.requestAnimationFrame=function(cb){if(p){held.push(cb);return 0;}return raf(cb);};'
    + 'window.addEventListener("message",function(e){var d=e&&e.data||{};'
    + 'if(d.' + ctl + '==="pause"){p=true;}'
    + 'else if(d.' + ctl + '==="resume"){p=false;var q=held;held=[];for(var i=0;i<q.length;i++){raf(q[i]);}}});'
    + '})();<' + '/script>\n';
}
