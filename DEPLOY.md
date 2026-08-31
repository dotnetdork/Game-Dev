# Deploying to Vercel

The short version: set the Root Directory to `app`, add the environment variables below, push.
Everything else is already in the repo (`app/vercel.json`, `app/api/index.js`).

The long version is worth reading once, because two of the decisions here are about money and one
is about children's accounts.

---

## Before anything else: cap the spend

**Anthropic Console → Limits → set a monthly workspace limit.**

Do this first, and do it whatever else you decide. Everything below reduces the chance of your key
being used by someone who should not be using it. The spend cap is the only thing that bounds the
damage when something gets through anyway — a shared laptop left signed in, a student who thinks
it's funny, a bug in this code.

`/api/ai` relays to a paid key. Nobody can read the key: it lives in `process.env` on the server
and never reaches the browser. But an open relay does not need to leak a key to cost you money —
it just needs to be reachable.

---

## 1. Create the Vercel project

1. Vercel → **Add New… → Project** → import `dotnetdork/CodeQuest`.
2. **Root Directory: `app`.** This matters. The repo root has no `package.json`.
3. Framework preset: **Other**. There is no build step; `app/vercel.json` routes every request to
   the Express app.
4. Do not deploy yet — add the variables below first, or the first deploy will boot without a gate.

## 2. Environment variables

Vercel → Project → Settings → Environment Variables. Add to **Production** (and Preview, if you
want preview deployments to work — see the note about redirect URIs at the bottom).

### Required — the AI relay

| Variable | Value |
|---|---|
| `AI_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | your key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` |
| `CODER_MODEL` | `anthropic:claude-sonnet-5` |
| `TUTOR_MODEL` | `anthropic:claude-sonnet-5` |
| `QUIZ_MODEL` | `anthropic:claude-sonnet-5` |
| `GRADER_MODEL` | `anthropic:claude-sonnet-5` |

**Ollama cannot work here.** The default `AI_PROVIDER=ollama` points at `localhost:11434`, which on
Vercel is the serverless function itself. If you leave it, every AI request fails with "not
reachable". This is the single most likely thing to go wrong on a first deploy.

### Required — sessions

| Variable | Value |
|---|---|
| `SESSION_SECRET` | 64 hex characters, generated below |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The server refuses to start if this is shorter than 32 characters. Changing it signs everybody out,
which is also how you sign everybody out on purpose.

### Sign-in

Three providers, all optional, all off until configured. **Configure at least one** — with none of
them set the site is open to the internet and so is the relay.

The rule is in `app/auth.js`: any provider being configured turns the gate on for the whole app.
A *partly* configured provider is a boot failure rather than a silent hole.

#### Students — League CodeServer

| Variable | Value |
|---|---|
| `CODESERVER_CLIENT_ID` | from the CodeServer OAuth app |
| `CODESERVER_CLIENT_SECRET` | from the CodeServer OAuth app |
| `CODESERVER_AUTH_URL` | e.g. `https://code.jointheleague.org/login/oauth/authorize` |
| `CODESERVER_TOKEN_URL` | e.g. `https://code.jointheleague.org/login/oauth/access_token` |
| `CODESERVER_USER_URL` | e.g. `https://code.jointheleague.org/api/v1/user` |
| `CODESERVER_SCOPE` | optional, default `read:user user:email` |
| `CODESERVER_NAME` | optional, default `League` — the button reads "Continue with <this>" |
| `ALLOWED_CODESERVER` | optional — leave empty |

Callback URL to register: `https://YOUR-DOMAIN/auth/codeserver/callback`

The endpoints are configuration rather than constants because the CodeServer is the League's own
service and is still being built — point them at the real thing when it exists.

`ALLOWED_CODESERVER` is normally **empty on purpose**: the CodeServer's accounts *are* the roll, so
anyone it vouches for is a student. Set it to a comma-separated list of logins or ids only if you
want to pilot with a handful of students first.

The profile response is read defensively — `login` / `username` / `preferred_username` for the name
and `id` / `sub` for the id — so whichever shape it lands on should work without a change here.

#### Teachers — Google

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `ALLOWED_DOMAIN` | `jointheleague.org` |
| `ALLOWED_EMAILS` | optional, comma-separated, for people outside the domain |

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.
Authorised redirect URI: `https://YOUR-DOMAIN/auth/google/callback`

Access is decided by the `hd` (hosted domain) claim, so it is the *school's* account list doing the
work — nothing to maintain, and someone who leaves loses access when the school closes their
account. A personal gmail has no `hd` at all and is refused by default rather than by accident.

#### The rare one — GitHub

| Variable | Value |
|---|---|
| `GITHUB_CLIENT_ID` | from GitHub → Settings → Developer settings → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | same |
| `ALLOWED_GITHUB` | comma-separated — **prefer numeric ids** |

Callback URL: `https://YOUR-DOMAIN/auth/github/callback`

**Use numeric ids, not logins.** A GitHub login can be changed by its owner, and the abandoned name
then becomes claimable by somebody else — so a list of names is a list that can quietly come to mean
different people. Find an id with:

```bash
curl -s https://api.github.com/users/dotnetdork | grep '"id"'
```

Logins are still accepted because they are what a human can write down, but ids are the safe form.

**An empty `ALLOWED_GITHUB` disables GitHub sign-in entirely** rather than letting everyone in. That
is deliberate: an allowlist that fails open is not an allowlist.

This is not a student route. GitHub's terms require users to be 13, and a good number of the
students this course is written for are younger than that.

### Optional

| Variable | Effect |
|---|---|
| `SESSION_DAYS` | how long a sign-in lasts, default `14` |
| `PUBLIC_ORIGIN` | pins the callback origin if the auto-detected one is ever wrong |

## Showing the page to someone first

```bash
npm run demo:login --prefix app
```

Opens the sign-in page on <http://localhost:3210/login.html> with all three buttons rendered, no
OAuth apps to register and nothing to configure. Pressing a button says it is a preview rather than
bouncing off a real Google error page.

It fails closed: demo mode reports the gate as ON and can never create a session, so the app behind
the page stays locked. Left on by accident it locks the site rather than opening it — which is the
safe way round for a flag whose job is to fake a login screen.

## 3. Deploy

Push to `main`, or `vercel --prod` if you install the CLI. Then check, in this order:

1. `https://YOUR-DOMAIN/` redirects to `/login.html`
2. The logo, the Cinzel title and only the buttons you configured are on the page
3. Signing in with a school account lands you back on the app
4. Signing in with a personal account is refused with a readable message
5. The AI panel answers — this proves `ANTHROPIC_API_KEY` and `AI_PROVIDER` are right
6. Sign out, then `curl -i https://YOUR-DOMAIN/api/ai -X POST -d '{}' -H 'content-type: application/json'`
   returns **401**, not a reply

Step 6 is the one that actually matters. Do it after every change to the auth configuration.

---

## Things that will bite

**The rate limiter does not work on Vercel.** `server.js` keeps request counts in a `Map` in memory.
Serverless instances are short-lived and parallel, so the 40-per-10-minutes limit stops holding.
Sign-in is what is protecting the relay, not that. If you later want a real limit, it needs a
durable store (Vercel KV or Upstash).

**Function timeout.** `app/vercel.json` asks for 60s, which is the Hobby ceiling. Tool-enabled
requests take about 25s by the notes in `.env.example`, and the coder does a corrective retry when
it invents an asset key — so a slow request can approach that. If you see timeouts, leave
`CODER_TOOLS=0`.

**Everything is served by the function**, including 3,300 static files. That is on purpose: Vercel's
CDN cannot check a session cookie, so anything it served directly would bypass the gate. If it feels
slow with a class on it, the fix is to let the CDN serve `/assets` and `/vendor` — both are CC0 art
and vendored libraries with nothing to protect — and leave the rest on the function.

**Preview deployments get their own hostname**, and OAuth providers only redirect to URIs you have
registered. Either register the preview URLs too, set `PUBLIC_ORIGIN`, or accept that sign-in only
works on production.

**Student work lives in the browser.** `localStorage`, per device, as it does today. Deploying does
not give anyone a way to pick up their game on a different machine, and clearing site data still
loses it. That is worth saying out loud to a class before they rely on it.
