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
4. **Add the environment variables below before deploying** — on this same screen, in the
   Environment Variables section. The storage comes after the first deploy; see below for why.

**Do not press "Import .env".** The local file has `AI_PROVIDER=ollama` in it, which points at
`localhost:11434` — on Vercel that is the serverless function itself, and every AI request fails
with "not reachable". Paste the block from §2 instead.

A deploy with nothing configured is not dangerous, only useless: `server.js` calls `process.exit(1)`
when it finds itself hosted without a sign-in, so the function crashes and every request is a 500.
It fails closed. But there is no reason to do it.

## 1b. Attach a KV store — AFTER the first deploy

Storage attaches to a project, and the project does not exist until it has been created. So the
order is: create the project with its variables → deploy → attach the store → redeploy. Between the
first and second deploy the app works and is gated; it just has nowhere to save anyone's work, which
matters not at all before anyone is using it.

(You can also create the database first from the **team-level** Storage tab and use *Connect
Project* afterwards. Same result, one less redeploy, slightly more clicking.)

Vercel → **Storage → Create Database → Redis**, attached to this project. Vercel folded its own
"Vercel KV" into the Marketplace, where the provider is Upstash, so the button may read **Upstash
for Redis** instead. Either is fine, and so is a database created directly at upstash.com with its
two REST variables pasted in by hand: `app/store.js` reads both `KV_REST_API_*` and
`UPSTASH_REDIS_REST_*` and uses whichever is present.

Nothing to configure — attaching it injects the variables itself.

**Two things stop working without it**, and neither fails loudly in the browser:

- **Saved work.** Progress, the project and the design board are mirrored per student to this store.
  With no store they live in `localStorage` only, which is per browser per machine — a tester who
  comes back on a different laptop gets an empty course. This is the thing Jed asked for.
- **The rate limit on the paid relay.** It counts in this store. Without one it falls back to an
  in-memory counter, which on serverless counts only the requests that happen to land on the same
  short-lived instance.

The boot log says which you have: `saves: redis` or `saves: none`.

Free tier is far more than a class needs — a few kilobytes per student.

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
| `CODER_TOOLS` | `1` |
| `TUTOR_TOOLS` | `1` |

**The two `_TOOLS` variables are why the app has offline Phaser docs at all.** With them on, the
coder and the tutor look up the exact Phaser the student is running — 19,000 symbols, on disk — and
read the lesson the student is actually on. With them off, both answer from memory, and the tutor
tells students in so many words that it cannot read any docs. It does not look like a failure; it
looks like the AI being unhelpful. If they are unset the code now switches them on by itself, but a
dashboard entry saying `0` still wins, so check the dashboard rather than assuming.

Sign in and open `/api/info` on the deployed site to see what it actually has:

```json
{ "tools": { "coder": true, "tutor": true },
  "lookups": { "reference": true, "api": true, "apiSymbols": 19286, "apiVersion": "4.1.0" } }
```

`tools` is the switches above. `lookups` is whether the files behind them survived into the
deployment — a different failure, with a different cause, that looks identical from the chat panel.
Both must be true.

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

Four doors, all optional, all off until configured. **Configure at least one** — with none of them
set the app refuses to boot rather than serving the course and the relay to the internet.

The rule is in `app/auth.js`: any door being configured turns the gate on for the whole app. A
*partly* configured provider is a boot failure rather than a silent hole.

#### The beta testers — a name and one shared password

| Variable | Value |
|---|---|
| `TESTER_PASSWORD` | a long passphrase, generated below |

```bash
node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
```

This is the **temporary** door, and for the September 2026 beta it is the only one that works: the
CodeServer's OAuth is not finished. Any name, one password shared by everybody — which is what Eric
asked for, and it is deliberately not a security control. Its real job is to give each child a
**stable identity**, so the store knows whose game is whose and their work is still there the second
week.

It draws a box **above** the OAuth buttons on the sign-in page, and the box disappears the moment
this variable does. **Delete it the day a real provider works.**

Two things to know before the call:

- **Hand the names out and write them down.** The name *is* the identity, so two children given the
  same name share one save. Matching is forgiving — `Jonathan`, `jonathan` and `Jonathan!` all reach
  the same account, which helps a child who types it differently the second week and is exactly why
  two of them must not be given similar names.
- The server refuses to start if the password is under 12 characters. It is shared, it sits on a
  public URL, and it is the only thing between a crawler and the paid key. Guessing is rationed to
  100 tries per address per ten minutes.

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

## Signing in on your own laptop

With **nothing** configured, `npm start` is in bypass: the sign-in page still appears — so it
cannot rot unseen — but every button is a door and one click is through. That is the default on a
fresh clone and needs no setup.

Setting `TESTER_PASSWORD` in `app/.env` **turns bypass off**, because something is now configured.
That is deliberate: it lets you see exactly what the testers will see. The trade is that the OAuth
buttons go dead locally and you sign in through the box instead — any name, plus that password.

So, locally, pick one:

| You want | `app/.env` |
|---|---|
| One click through any button | no `TESTER_PASSWORD`, no `SESSION_SECRET` |
| What the testers will see | both set (the secret is required alongside it) |

Bypass can never happen on a host: it is nailed to "not hosted", and an unconfigured deployment is
a refusal to boot rather than an open door.

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
2. The logo, the Cinzel title, and only the doors you configured are on the page
3. Signing in lands you back on the app
4. The AI panel answers — this proves `ANTHROPIC_API_KEY` and `AI_PROVIDER` are right
5. **Change something — edit `game.js`, earn some XP — wait five seconds. Then open the same URL in
   a private window and sign in with the same name. Your change should be there.**
6. Sign in with a *different* name in the same browser: you should get a clean, empty course, not
   the first name's game
7. Sign out, then `curl -i https://YOUR-DOMAIN/api/ai -X POST -d '{}' -H 'content-type: application/json'`
   returns **401**, not a reply

**Step 5 is the one the beta depends on** — it is the whole of "their work is still there next
time", and it fails silently if the KV store is not attached. **Step 7 is the one that protects the
key**; do it after every change to the sign-in configuration.

---

## Things that will bite

**The rate limit needs the KV store to be real.** 40 AI requests per student per 10 minutes, keyed
on the signed-in session and counted in the store. Attach the store and it holds across instances;
without one it falls back to an in-memory counter that a serverless platform resets whenever it
feels like it. It also **fails open** by design — if the store is unreachable the request goes
through, because a child mid-sentence should not be told to slow down by a storage hiccup. Sign-in
and the spend cap are still what actually bound the damage.

**Function timeout.** `app/vercel.json` asks for 60s, which is the Hobby ceiling. Tool-enabled
requests take longer — the 25s in `.env.example` is measured against a local model, and the coder
does a corrective retry when it invents an asset key — so a slow request can approach that.

The obvious lever is to turn `CODER_TOOLS` off, and this document used to say so. **Don't** — that
is how the deployed tutor ended up unable to read the app's own Phaser docs, which costs far more
accuracy than the timeout costs anybody. Lower `AI_TOOL_ROUNDS` from 4 to 2 instead: it caps how
many lookups one answer may make, which is what actually sets the worst case.

**Everything is served by the function**, including 3,300 static files. That is on purpose: Vercel's
CDN cannot check a session cookie, so anything it served directly would bypass the gate. If it feels
slow with a class on it, the fix is to let the CDN serve `/assets` and `/vendor` — both are CC0 art
and vendored libraries with nothing to protect — and leave the rest on the function.

**Preview deployments get their own hostname**, and OAuth providers only redirect to URIs you have
registered. Either register the preview URLs too, set `PUBLIC_ORIGIN`, or accept that sign-in only
works on production.

**Student work is mirrored, not merged.** With the KV store attached, the project, the progress and
the design board follow whoever is signed in, so a tester can come back on a different machine and
find their game. What it does not do is merge: the same child signed in on two machines at once
will have one overwrite the other, newest write wins. Fine for a beta; say it out loud before a
class relies on it.

A browser only ever holds one student's work, and it knows whose. Sign in as somebody else on a
borrowed laptop and the previous child's work is dropped before the app reads it — and the server
refuses any upload whose stamp disagrees with the session sending it. Sharing a laptop is safe.
Sharing a *name* is not.
