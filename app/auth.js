/* auth.js — "is this one of ours?", for a deployment that is on the open internet.
 *
 * Locally there is nothing to protect: the server runs on a laptop and the AI provider is a free
 * local model. Hosted, both of those change. /api/ai relays to a PAID key, and a public URL with an
 * open relay is a free Claude proxy for whoever finds it — they never see the key, they just spend
 * it. Nothing else about the app is a credential, so without a gate the URL is the password, and a
 * URL gets pasted into chats, homework and Discord.
 *
 * ---------------------------------------------------------------------------------------------
 * THREE WAYS IN, FOR THREE DIFFERENT GROUPS
 *
 *   codeserver  STUDENTS. The League's own CodeServer, which works like GitHub and has its own
 *               OAuth. This is the main door. Its accounts ARE the roll: the school issues them,
 *               so there is no separate list to keep and no age problem, because no student is
 *               being asked to sign up to somebody else's service.
 *
 *   google      TEACHERS, on @jointheleague.org. A rule rather than a list — anyone the school
 *               gave an account to is in, and the day the school switches it off they are out.
 *
 *   github      THE RARE ONE. A named allowlist, for outside collaborators. Not a student route:
 *               GitHub's terms require users to be 13 and a good number of them are younger.
 *
 *   testers     TEMPORARY, AND IT WILL BE DELETED. A name box and one password shared by everybody,
 *               for the September 2026 beta sessions — four or five children, on a call, on a URL
 *               nobody else has. It exists because the CodeServer's OAuth is not finished and the
 *               testers are booked. Eric's instruction, verbatim: "anything they type in is a
 *               username, give them a password, same password for everybody. It's not important
 *               right now."
 *
 *               It is not a security control and is not pretending to be one. Its actual job is to
 *               give each child a STABLE IDENTITY so their game is still there at the second
 *               session — which Jed named as the single most important thing to have working
 *               before the testers arrive. The password only keeps a crawler off the AI relay.
 *
 *               Turn it on by setting TESTER_PASSWORD. Unset it and the door is gone.
 *
 * THE SIGN-IN PAGE IS ALWAYS THE FRONT DOOR, including on a laptop. It used to appear only once a
 * provider was configured, which meant the page nobody could get past in production was also the
 * page nobody ever saw in development — a good way for it to rot. Now it is in the flow every time,
 * and what changes is only what a button DOES: the real OAuth dance when configured, an instant
 * sign-in when running locally with nothing set up, and a "this is a preview" message under
 * `npm run demo:login`. See the modes above ready().
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THE SESSION IS A SIGNED COOKIE AND NOT A SESSION STORE
 *
 * This is meant to run on Vercel, where every request may land on a different short-lived
 * instance. Anything kept in memory is gone by the next request — the same reason the rate limiter
 * in server.js stops meaning anything once it is hosted. So the cookie IS the session: a payload
 * and an HMAC of that payload, verified on the way back in. Nothing to store, nothing to expire,
 * identical on one server or fifty. Node's crypto does the whole job, so this adds no dependency.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT IS CHECKED, AND WHAT IS DELIBERATELY NOT
 *
 * Google's id_token signature is NOT re-verified, and that is a decision rather than an omission:
 * this server fetched it directly from Google's token endpoint over TLS, in exchange for a code and
 * our client secret. Google's own documentation says a token obtained that way can skip signature
 * verification, because the secure channel is what the signature would otherwise prove. (An
 * id_token arriving from a BROWSER would need full JWKS verification. None does here.)
 *
 * Its CLAIMS are checked, because those say who the token is for rather than where it came from:
 * `iss`, `aud`, `exp`, `email_verified`, and `hd` — the hosted domain, which is the whole access
 * rule for teachers. A personal gmail has no `hd` at all, so it is refused by default rather than
 * by accident.
 */
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || '';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 14);
/* Set by Vercel on every deployment; NODE_ENV covers anywhere else it is run for real. The only
   thing this decides is whether an UNCONFIGURED app is allowed to let people in — see BYPASS. */
const IS_HOSTED = !!(process.env.VERCEL || process.env.NODE_ENV === 'production');
const COOKIE = 'league_session';
const STATE_COOKIE = 'league_oauth_state';
/* A companion to the session cookie holding nothing but the identity, and deliberately NOT
   HttpOnly so the page can read it before it has asked the server anything.

   It is not a credential and grants nothing — the session cookie is still the only thing that
   authenticates, and it stays HttpOnly. This exists because sync.js has to answer "does the work in
   this browser belong to whoever is signed in now?" SYNCHRONOUSLY, at script-load time, before
   project.js reads localStorage. Finding out by fetch is too late: the app has already been built
   from the previous student's data by the time the answer arrives, and anything that saves in the
   meantime writes it straight back. See the takeover check in sync.js. */
const WHO_COOKIE = 'league_who';

const list = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/* Teachers. Domains rather than addresses, plus an escape hatch for the occasional person outside
   it — a visiting instructor, a parent helper. */
const DOMAINS = list(process.env.ALLOWED_DOMAIN);
const EXTRA = list(process.env.ALLOWED_EMAILS);
/* Outside collaborators, by name or — better — by numeric id. See the note in `github.permit`. */
const GH_ALLOW = list(process.env.ALLOWED_GITHUB);
/* The CodeServer's own accounts are the roll, so this is normally empty and everyone it vouches
   for is let in. Set it to pilot the deployment with a handful of students first. */
const CS_ALLOW = list(process.env.ALLOWED_CODESERVER);

/* The temporary beta door. One password, any name. See the note at the top of the file — and
   DEPLOY.md, which says to unset this the day the CodeServer's OAuth works. */
const TESTER_PASSWORD = String(process.env.TESTER_PASSWORD || '');
/* A name typed by an eleven-year-old on a call, turned into something safe to use as a storage key.
   Lower case, one dash for any run of punctuation, and a length limit — because this string ends up
   in a Redis key and in a cookie, and "Jonathan's Game!!" should not be able to reach either. */
function testerSlug(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s) ? s : '';
}

/* ---------------------------------------------------------------------------------------------
   THE PROVIDERS

   One shape for all three, because the OAuth dance is the same every time and only two things
   differ: how you turn a token into a person (`identify`), and whether that person is allowed
   (`permit`). Writing the flow once means the state check, the one-shot cookie and the error paths
   cannot drift apart between providers — which is exactly where this kind of code goes wrong.

   The CodeServer's endpoints are configuration rather than constants because it is the League's own
   service: it can move, and it is not finished yet.
--------------------------------------------------------------------------------------------- */
const PROVIDERS = {
  codeserver: {
    /* What the button says, after "Continue with". Just "League" — this is the students' own
       account and the one they use everywhere else, so it wants the name they know rather than the
       name of the machine it happens to run on. */
    label: process.env.CODESERVER_NAME || 'League',
    id: process.env.CODESERVER_CLIENT_ID || '',
    secret: process.env.CODESERVER_CLIENT_SECRET || '',
    authUrl: process.env.CODESERVER_AUTH_URL || '',
    tokenUrl: process.env.CODESERVER_TOKEN_URL || '',
    userUrl: process.env.CODESERVER_USER_URL || '',
    scope: process.env.CODESERVER_SCOPE || 'read:user user:email',
    ready: function () { return !!(this.id && this.secret && this.authUrl && this.tokenUrl && this.userUrl); },
    missing: function () {
      const m = [];
      if (!this.id) m.push('CODESERVER_CLIENT_ID');
      if (!this.secret) m.push('CODESERVER_CLIENT_SECRET');
      if (!this.authUrl) m.push('CODESERVER_AUTH_URL');
      if (!this.tokenUrl) m.push('CODESERVER_TOKEN_URL');
      if (!this.userUrl) m.push('CODESERVER_USER_URL');
      return m;
    },
    /* It works like GitHub, so the profile is read with a bearer token. The field names are guessed
       generously because the service is still being built: whichever of these it turns out to use,
       this reads it rather than failing. */
    identify: async function (tok) {
      const r = await fetch(this.userUrl, {
        headers: { Authorization: 'Bearer ' + tok.access_token, Accept: 'application/json', 'User-Agent': 'league-gamedev' }
      });
      if (!r.ok) return null;
      const u = await r.json();
      if (!u) return null;
      const login = String(u.login || u.username || u.preferred_username || u.name || '').toLowerCase();
      const id = String(u.id || u.sub || login || '');
      if (!id) return null;
      return { id: id, login: login, email: String(u.email || (login && login + '@codeserver') || '').toLowerCase(), name: u.name || u.login || login };
    },
    permit: function (p) { return CS_ALLOW.length ? (CS_ALLOW.indexOf(p.id) >= 0 || CS_ALLOW.indexOf(p.login) >= 0) : true; },
    denied: 'notlisted'
  },

  google: {
    label: 'Google',
    id: process.env.GOOGLE_CLIENT_ID || '',
    secret: process.env.GOOGLE_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    ready: function () { return !!(this.id && this.secret && (DOMAINS.length || EXTRA.length)); },
    missing: function () {
      const m = [];
      if (!this.id) m.push('GOOGLE_CLIENT_ID');
      if (!this.secret) m.push('GOOGLE_CLIENT_SECRET');
      if (!DOMAINS.length && !EXTRA.length) m.push('ALLOWED_DOMAIN (or ALLOWED_EMAILS)');
      return m;
    },
    /* A hint to Google's account chooser, not a security control — the real check is `hd` below.
       It saves a teacher with three Google accounts from picking the wrong one. */
    extraAuthParams: function () { return { hd: DOMAINS[0] || '', prompt: 'select_account' }; },
    identify: async function (tok) {
      if (!tok.id_token) return null;
      const parts = String(tok.id_token).split('.');
      if (parts.length !== 3) return null;
      const c = JSON.parse(unb64u(parts[1]).toString('utf8'));
      const issOk = c.iss === 'accounts.google.com' || c.iss === 'https://accounts.google.com';
      if (!issOk || c.aud !== this.id) return null;
      if (!c.exp || Date.now() / 1000 > c.exp) return null;
      if (c.email_verified === false) return null;
      return { id: String(c.sub || ''), login: '', email: String(c.email || '').toLowerCase(), name: c.name || c.given_name || '', hd: c.hd || '' };
    },
    permit: function (p) {
      if (EXTRA.indexOf(p.email) >= 0) return true;
      const domain = String(p.hd || (p.email.split('@')[1] || '')).toLowerCase();
      return !!domain && DOMAINS.indexOf(domain) >= 0;
    },
    denied: 'domain'
  },

  github: {
    label: 'GitHub',
    id: process.env.GITHUB_CLIENT_ID || '',
    secret: process.env.GITHUB_CLIENT_SECRET || '',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    /* `user:email` and nothing else. The public profile needs no scope at all; this is only so a
       private primary address can be recorded, and the allowlist never depends on it. Asking for
       the least is the point — this token could read repositories if it were allowed to. */
    scope: 'user:email',
    /* THE LIST IS THE SWITCH. Google is enabled by having a domain; this is enabled by having an
       explicit allowlist, and an empty one turns the provider off rather than letting the whole of
       GitHub in. An allowlist that fails open is not an allowlist. */
    ready: function () { return !!(this.id && this.secret && GH_ALLOW.length); },
    missing: function () {
      const m = [];
      if (!this.id) m.push('GITHUB_CLIENT_ID');
      if (!this.secret) m.push('GITHUB_CLIENT_SECRET');
      if (!GH_ALLOW.length) m.push('ALLOWED_GITHUB (an empty allowlist lets nobody in — unset the GitHub vars to disable it instead)');
      return m;
    },
    extraAuthParams: function () { return { allow_signup: 'false' }; },
    identify: async function (tok) {
      const H = { Authorization: 'Bearer ' + tok.access_token, Accept: 'application/vnd.github+json', 'User-Agent': 'league-gamedev' };
      const r = await fetch('https://api.github.com/user', { headers: H });
      if (!r.ok) return null;
      const u = await r.json();
      if (!u || !u.login || !u.id) return null;
      let email = String(u.email || '').toLowerCase();
      if (!email) {
        try {
          const er = await fetch('https://api.github.com/user/emails', { headers: H });
          if (er.ok) {
            const all = await er.json();
            const primary = Array.isArray(all) && all.filter((x) => x && x.primary && x.verified)[0];
            if (primary) email = String(primary.email).toLowerCase();
          }
        } catch (e) { /* optional: never part of the decision */ }
      }
      return { id: String(u.id), login: String(u.login).toLowerCase(), email: email || String(u.login).toLowerCase() + '@github', name: u.name || u.login };
    },
    /* MATCH ON THE NUMERIC ID WHERE ONE IS GIVEN. A GitHub login can be changed by its owner, and
       the abandoned name then becomes claimable by somebody else — so a list of names is a list
       that can quietly come to mean different people. The id never changes. Names are still
       accepted because they are what a human can write down, but DEPLOY.md says to prefer the id. */
    permit: function (p) { return GH_ALLOW.indexOf(p.id) >= 0 || GH_ALLOW.indexOf(p.login) >= 0; },
    denied: 'notlisted'
  }
};

/* ---- showing the page to somebody without wiring up three OAuth apps ----
   `npm run demo:login`. Every provider renders, and pressing one says so instead of bouncing off a
   real Google error page — which is what a half-configured client id actually does, and not
   something to do in front of an audience.

   It FAILS CLOSED, deliberately. Demo mode reports the gate as on and can never mint a session,
   because the callback is never reached. So a deployment left in this mode shows the sign-in page
   and lets nobody past it — the safe way round for a flag whose whole job is to fake a login. */
const DEMO = /^(1|true|yes|on)$/i.test(process.env.DEMO_LOGIN || '');

/* ---- the three modes, and why the gate is now always on ----
   The sign-in page used to be invisible during development: with nothing configured the gate was
   off entirely and `npm start` went straight to the app. That made the page something you had to go
   out of your way to see, which is how a page ends up broken without anyone noticing.

   So the gate is ALWAYS on, and what differs is what pressing a button does:

     configured  the real OAuth flow.
     BYPASS      unconfigured AND not hosted — any button signs you straight in. The login page is
                 there in the flow where it really is, one click and you are through.
     DEMO        `npm run demo:login` — buttons say "preview" and nobody gets in.

   BYPASS IS THE DANGEROUS ONE, so it is nailed to "not hosted". Unconfigured ON A HOST is a boot
   failure instead (see configProblem): the one arrangement that must never exist is a public URL
   where every button is a way in. */
/* The tester door counts as configured, which is the whole point of it: a hosted deployment with
   nothing but TESTER_PASSWORD and SESSION_SECRET set is a legitimate arrangement — it is the beta —
   and configProblem must let it boot rather than refusing as an open door. */
const TESTERS_ON = !!TESTER_PASSWORD;
const ANY_CONFIGURED = TESTERS_ON || Object.keys(PROVIDERS).some(function (k) { return PROVIDERS[k].ready(); });
const BYPASS = !DEMO && !ANY_CONFIGURED && !IS_HOSTED;

/* Not protecting anything in bypass mode — every button already lets anyone in — but the cookie
   still has to be signed with something. A constant rather than a random value so `node --watch`
   restarts do not sign you out twenty times an hour. It is never used when a real SESSION_SECRET
   is set, and bypass cannot happen on a host, so it can only ever sign a session on a laptop that
   was already letting anybody in. */
const DEV_SECRET = 'league-local-development-only-not-a-secret';
function secret() { return SECRET || (BYPASS ? DEV_SECRET : ''); }

function ready(key) {
  if (!PROVIDERS[key]) return false;
  if (DEMO || BYPASS) return true;                 // every button renders, none of them is real
  return !!(secret() && PROVIDERS[key].ready());
}
/* Always. The login page is now part of the app rather than a thing that appears in production. */
function enabled() { return true; }
function providerStatus() {
  const out = {};
  Object.keys(PROVIDERS).forEach(function (k) { out[k] = { on: ready(k), label: PROVIDERS[k].label }; });
  return out;
}
/* Reported on its own rather than inside providerStatus, because it is not an OAuth provider: the
   page draws a form for it, not a "Continue with" button. In BYPASS it is off — a laptop with
   nothing configured already lets you in with one click and does not need a password box too. */
function testersReady() { return !DEMO && !BYPASS && TESTERS_ON && !!secret(); }

/* Called from server.js at boot, because a half-configured gate is worse than none: it looks shut
   and is not. Every branch here is a way to end up serving the whole course to the internet
   because one variable was misspelt. */
function configProblem() {
  /* Demo mode has no credentials by design, so the missing-variable check would refuse to boot. */
  if (DEMO) return null;
  /* THE ONE ARRANGEMENT THAT MUST NEVER EXIST: a public URL where every sign-in button is a way in.
     On a laptop that is the convenience (BYPASS); on a host it would be an open door onto a paid
     API key, so it is a refusal to start instead. */
  if (IS_HOSTED && !ANY_CONFIGURED) {
    return 'this is a hosted deployment with no sign-in configured, which would let anybody in and '
      + 'spend the AI key. Configure at least one provider (see DEPLOY.md), or set DEMO_LOGIN=1 to '
      + 'show only the sign-in page.';
  }
  if (BYPASS) return null;
  const touched = Object.keys(PROVIDERS).filter(function (k) {
    const p = PROVIDERS[k];
    return !!(p.id || p.secret);
  });
  const anyList = DOMAINS.length || EXTRA.length || GH_ALLOW.length || CS_ALLOW.length;
  if (!touched.length && !anyList && !SECRET && !TESTERS_ON) return null;   // off on purpose

  /* A shared password on a public URL is guessable if it is short, and this one is the only thing
     between a crawler and the paid AI relay. Long enough that guessing it is not the easy route. */
  if (TESTERS_ON && TESTER_PASSWORD.length < 12) {
    return 'TESTER_PASSWORD is shorter than 12 characters. It is shared by every tester and sits on '
      + 'a public URL — make it a long passphrase: node -e "console.log(require(\'crypto\').randomBytes(9).toString(\'base64url\'))"';
  }

  const missing = [];
  touched.forEach(function (k) { PROVIDERS[k].missing().forEach(function (m) { missing.push(m); }); });
  if (!SECRET) missing.push('SESSION_SECRET');
  if (missing.length) return 'sign-in is partly configured but missing: ' + missing.join(', ');
  if (SECRET.length < 32) return 'SESSION_SECRET is shorter than 32 characters — generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
  if (!enabled()) return 'sign-in has credentials but no provider came out enabled — check the allowlists.';
  return null;
}

/* ---- signing ---------------------------------------------------------------------------------
   base64url so the value is cookie-safe without escaping, and timingSafeEqual so a wrong signature
   cannot be narrowed down a byte at a time by measuring how long the comparison took. */
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  return body + '.' + b64u(crypto.createHmac('sha256', secret()).update(body).digest());
}
function unsign(token) {
  if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const i = token.lastIndexOf('.');
  const body = token.slice(0, i);
  const want = crypto.createHmac('sha256', secret()).update(body).digest();
  let got;
  try { got = unb64u(token.slice(i + 1)); } catch (e) { return null; }
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  let data;
  try { data = JSON.parse(unb64u(body).toString('utf8')); } catch (e) { return null; }
  if (!data || typeof data.exp !== 'number' || Date.now() > data.exp) return null;
  return data;
}

/* Express 4 ships no cookie parser and this needs exactly one value, so reading it by hand is
   smaller than the dependency. */
function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    if (p.indexOf(name + '=') === 0) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}
/* Both cookies, always together, so the readable one can never name a different person from the one
   the session actually authenticates. Every place that signs somebody in goes through here. */
function setSession(res, payload) {
  setCookie(res, COOKIE, sign(payload), SESSION_DAYS * 86400);
  setCookie(res, WHO_COOKIE, payload.email, SESSION_DAYS * 86400, true);
}
function clearSession(res) {
  setCookie(res, COOKIE, '', 0);
  setCookie(res, WHO_COOKIE, '', 0, true);
}

function setCookie(res, name, value, maxAgeSec, readable) {
  /* HttpOnly: script cannot read it, so an XSS in a lesson widget cannot steal a session.
     SameSite=Lax: survives the redirect back from the provider, not sent on cross-site POSTs.
     Secure: dropped only on plain-HTTP localhost, where there is no TLS to require. */
  const secure = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? '; Secure' : '';
  const bits = [name + '=' + encodeURIComponent(value), 'Path=/', 'SameSite=Lax' + secure];
  /* `readable` is the one exception, and it carries a name rather than a credential — see
     WHO_COOKIE. Everything else stays HttpOnly. */
  if (!readable) bits.splice(2, 0, 'HttpOnly');
  if (maxAgeSec === 0) bits.push('Max-Age=0');
  else if (maxAgeSec) bits.push('Max-Age=' + maxAgeSec);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, bits.join('; ')) : bits.join('; '));
}

function currentUser(req) {
  /* No local pseudo-user any more. The gate is real in every mode, so being signed in always means
     holding a cookie this server signed — including on a laptop, where one click produces one. */
  const d = unsign(readCookie(req, COOKIE));
  return d && d.email ? d : null;
}

/* The redirect target must match what is registered with the provider EXACTLY, and on Vercel the
   host is only known per request (every preview deployment gets its own). Derived from the request
   rather than configured, honouring the proxy headers because Vercel terminates TLS in front of us
   and the request arrives as plain http. PUBLIC_ORIGIN pins it when that guess is wrong. */
function origin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return proto + '://' + host;
}
const callbackUrl = (req, key) => origin(req) + '/auth/' + key + '/callback';
const safeNext = (v) => (typeof v === 'string' && v.charAt(0) === '/' && v.charAt(1) !== '/') ? v : '/';

/* An expiring counter, handed in by server.js so this file does not have to know where the store
   is — `mount(app, { limit: store.bump })`. Optional: with nothing passed, nothing is rationed. */
let LIMIT = null;
function mount(app, opts) {
  LIMIT = (opts && typeof opts.limit === 'function') ? opts.limit : null;
  Object.keys(PROVIDERS).forEach(function (key) {
    const P = PROVIDERS[key];

    app.get('/auth/' + key, function (req, res) {
      if (!ready(key)) return res.redirect('/login.html?e=off');
      /* Demo mode stops here: no redirect out, no session, just a line saying what this is. */
      if (DEMO) return res.redirect('/login.html?e=demo');
      /* Local development with nothing configured: any button is the door. The point is that the
         login page sits in the real flow — seen on every `npm start`, so it cannot rot unnoticed —
         without needing three OAuth apps registered to get past it. Cannot happen on a host: see
         BYPASS and configProblem. */
      if (BYPASS) {
        setSession(res, {
          email: 'developer@localhost',
          name: 'Local developer',
          via: key,
          exp: Date.now() + SESSION_DAYS * 86400000
        });
        return res.redirect(safeNext(req.query.next));
      }
      /* `state` is the CSRF protection for the callback: minted here, signed into a short-lived
         cookie, compared on the way back. Without it someone could hand a student a crafted
         callback URL and sign them into an account that is not theirs. The provider is inside the
         signed payload, so a state minted for one flow cannot be replayed into another's callback.
         It also carries where they were going, so signing in does not lose their place. */
      const state = sign({ p: key, n: crypto.randomBytes(16).toString('hex'), next: safeNext(req.query.next), exp: Date.now() + 10 * 60 * 1000 });
      setCookie(res, STATE_COOKIE, state, 600);
      const params = Object.assign({
        client_id: P.id,
        redirect_uri: callbackUrl(req, key),
        response_type: 'code',
        scope: P.scope,
        state: state
      }, P.extraAuthParams ? P.extraAuthParams() : {});
      res.redirect(P.authUrl + '?' + new URLSearchParams(params).toString());
    });

    app.get('/auth/' + key + '/callback', async function (req, res) {
      if (!ready(key)) return res.redirect('/login.html?e=off');
      /* The reason travels as a short code for login.html to word. Deliberately vague about WHICH
         check failed: a student needs to know to use their CodeServer account; nobody needs a
         description of the gate. */
      const fail = (why) => res.redirect('/login.html?e=' + encodeURIComponent(why));
      try {
        const state = String(req.query.state || '');
        const cookie = readCookie(req, STATE_COOKIE);
        setCookie(res, STATE_COOKIE, '', 0);                       // one use only
        const st = unsign(state);
        if (!state || !cookie || state !== cookie || !st || st.p !== key) return fail('expired');
        if (!req.query.code) return fail('cancelled');

        const r = await fetch(P.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: new URLSearchParams({
            code: String(req.query.code),
            client_id: P.id,
            client_secret: P.secret,
            redirect_uri: callbackUrl(req, key),
            grant_type: 'authorization_code'
          }).toString()
        });
        if (!r.ok) return fail(key);
        const tok = await r.json();
        if (!tok || (!tok.access_token && !tok.id_token)) return fail(key);

        const person = await P.identify(tok);
        if (!person || !person.email) return fail(key);
        if (!P.permit(person)) return fail(P.denied);

        setSession(res, {
          email: person.email,
          name: person.name || '',
          via: key,
          exp: Date.now() + SESSION_DAYS * 86400000
        });
        res.redirect(safeNext(st.next));
      } catch (e) {
        fail(key);
      }
    });
  });

  /* ---- the temporary beta door ----
     A form POST rather than a fetch, so it works with JavaScript off, the browser offers to
     remember it, and Enter in the password field submits — all free, and all things that matter on
     a locked-down school Chromebook.

     There is no account to look up. The name IS the identity: it goes through testerSlug and
     becomes `<slug>@tester`, which is what the per-student store is keyed on. Two children who
     both type "Jonathan" get the same save, so the names are handed out on the call. */
  app.post('/auth/testers', async function (req, res) {
    if (!testersReady()) return res.redirect('/login.html?e=off');
    const body = req.body || {};
    const slug = testerSlug(body.username);
    const given = String(body.password || '');
    const next = safeNext(body.next);

    if (!slug) return res.redirect('/login.html?e=noname&next=' + encodeURIComponent(next));

    /* ONE SHARED PASSWORD ON A PUBLIC URL is a thing worth guessing at, so guessing is rationed.
       Counted per IP rather than per name, because the name is free text and an attacker would
       simply vary it.

       DELIBERATELY LOOSE — 100 tries per address per ten minutes. The password carries about
       seventy bits, so a real attack needs billions of guesses and dies at any limit at all; the
       only thing a tight number would achieve is locking out a room of eleven-year-olds sharing one
       school Wi-Fi while they mistype it, halfway through a call Jed set up. Set to stop a bot, not
       to punish fumbling.

       It fails open if the counter is unreachable. The password is the control; this only makes
       attacking it expensive. */
    if (LIMIT) {
      const tries = await LIMIT('login:' + (req.ip || 'anon'), 600);
      if (tries > 100) return res.redirect('/login.html?e=slowdown&next=' + encodeURIComponent(next));
    }

    /* Hashed before comparing so timingSafeEqual gets two equal-length buffers whatever was typed;
       comparing the raw strings would throw on a length mismatch and leak the length by doing so. */
    const h = (s) => crypto.createHash('sha256').update(s).digest();
    if (!crypto.timingSafeEqual(h(given), h(TESTER_PASSWORD))) {
      return res.redirect('/login.html?e=badpass&next=' + encodeURIComponent(next));
    }

    setSession(res, {
      email: slug + '@tester',
      /* As typed, for the greeting — "Hi, Jonathan" rather than "Hi, jonathan". */
      name: String(body.username || '').trim().slice(0, 40),
      via: 'testers',
      exp: Date.now() + SESSION_DAYS * 86400000
    });
    res.redirect(next);
  });

  app.get('/auth/logout', function (req, res) {
    clearSession(res);
    res.redirect('/login.html?e=out');
  });

  /* So the app can show who is signed in, and so login.html renders only the buttons that exist. */
  app.get('/auth/me', function (req, res) {
    const u = currentUser(req);
    res.json(u
      ? { signedIn: true, email: u.email, name: u.name || '', via: u.via || '', local: !!u.local }
      : { signedIn: false, enabled: enabled(), providers: providerStatus(), testers: testersReady() });
  });
}

/* Everything except the sign-in flow, the page it redirects to, and that page's own branding.
   401 JSON for /api so a fetch gets a readable answer instead of a login page parsed as JSON;
   a redirect for everything else so a deep link survives signing in. */
function requireAuth(req, res, next) {
  if (!enabled()) return next();
  const p = req.path;
  /* ---- what is NOT behind the gate, and why ----
     /img            the login page's own branding. Gating it made the logo on the sign-in screen
                     redirect to the sign-in screen and draw as a broken image.
     /vendor         the vendored libraries — Phaser, CodeMirror, the fonts.
     /assets         the Kenney art and audio.

     The last two are not a convenience, they are REQUIRED. The student's game runs in an iframe with
     sandbox="allow-scripts" and no allow-same-origin, which gives it an OPAQUE ORIGIN. Every request
     it makes for a script or a sprite is therefore cross-site, and the session cookie is SameSite=Lax
     — so the browser does not attach it. Gated, those requests arrive signed-out, get redirected to
     the login page, and the frame receives HTML where it asked for JavaScript: "Phaser is not
     defined", and every sprite missing.

     Nothing is given away by this. server.js already serves both paths CORS-open for exactly this
     frame, and says why: they are CC0 art and open-source libraries, identical for every student and
     secret from nobody. What the gate is actually protecting is /api (the paid AI relay), /content
     (the authored course) and /js (the app itself). */
  if (p.indexOf('/auth/') === 0 || p === '/login.html' || p === '/favicon.ico'
      || p.indexOf('/img/') === 0 || p.indexOf('/vendor/') === 0 || p.indexOf('/assets/') === 0) return next();
  if (currentUser(req)) return next();
  if (p.indexOf('/api/') === 0) return res.status(401).json({ error: 'Not signed in.', signIn: '/auth/login' });
  res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl || '/'));
}

module.exports = { mount, requireAuth, currentUser, enabled, ready, providerStatus, testersReady, configProblem };
