/* demo-login.js — start the app with the sign-in page on, so it can be shown to someone.
 *
 *   npm run demo:login
 *
 * The sign-in page is invisible during normal development, and that is correct: auth is off until
 * it is configured, so a laptop checkout needs no accounts. The side effect is that showing the
 * page to anybody meant either registering three real OAuth apps or hand-exporting six environment
 * variables and remembering the right port. Neither is something to do in front of an audience.
 *
 * This sets DEMO_LOGIN, which makes auth.js report every provider as available so all three buttons
 * render, and makes pressing one say "this is a preview" instead of redirecting to a real Google
 * error page — which is what a fake client id actually produces.
 *
 * IT FAILS CLOSED. Demo mode reports the gate as ON and can never mint a session, because the
 * callback is never reached. The login page is all anybody sees. That is the safe way round for a
 * flag whose entire job is to fake a login screen: left on by accident, it locks the app rather
 * than opening it.
 *
 * A separate port from the dev server on purpose, so this can run beside `npm start` and neither
 * has to be stopped to look at the other.
 */
const crypto = require('crypto');
const path = require('path');

process.env.DEMO_LOGIN = '1';
process.env.PORT = process.env.PORT || '3210';
/* Never reused for a real session — nothing is signed in this mode — but auth.js requires one, and
   a fresh one per run means a stale demo cookie can never be mistaken for a valid session. */
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');

const url = 'http://localhost:' + process.env.PORT + '/login.html';
console.log('');
console.log('  LEAGUE Game Dev — sign-in page preview');
console.log('  ' + url);
console.log('');
console.log('  All three sign-in buttons are shown. None of them completes a sign-in: this mode has');
console.log('  no credentials and cannot create a session, so the app behind the page stays locked.');
console.log('  Ctrl+C to stop.');
console.log('');

require(path.join(__dirname, '..', 'server.js'));
