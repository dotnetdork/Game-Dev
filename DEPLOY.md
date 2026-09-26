# Deploying

The app runs on **the League's own server** (`apps.jointheleague.org`) as one Docker container
behind Caddy, at <https://game-dev.apps.jointheleague.org>.

The short version: put the environment variables below in `/opt/Game-Dev/.env` on the server, then
push to `main`. The deploy workflow does the rest.

The first beta test ran on Vercel. That is over, and Vercel will very likely never be used again. It
is not a constraint on anything. Some file headers still explain decisions made under its limits
(60-second functions, no disk); read those as history.

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

## 1. How a deploy happens

- **`docker-compose.yml`** (repo root) builds `app/Dockerfile`: `node:20-slim`, `npm ci --omit=dev`,
  `NODE_ENV=production`, `node server.js` on port 3000. Caddy labels route
  `game-dev.apps.jointheleague.org` to it and terminate TLS.
- **`.github/workflows/deploy.yml`** runs on every push to `main`. It SSHes to the server as the
  `deploy` user, whose key can run exactly one thing: the server's deploy script
  (`/opt/gamedev/deploy.sh`, via a `command=` restriction in that user's `authorized_keys`). What
  the workflow's `script:` line says is irrelevant to what runs.
- The server's copy of the repo lives at `/opt/Game-Dev`, and its `.env` sits beside
  `docker-compose.yml` (`env_file: .env`). **That file is the only place secrets live.**

**Don't copy your laptop's `.env` across.** It probably has `AI_PROVIDER=ollama` pointing at
`localhost:11434`, and inside the container `localhost` is the container itself, so every AI
request fails with "not reachable". Paste the block from §2 instead.

A deploy with no sign-in configured is not dangerous, only useless: `server.js` calls
`process.exit(1)` when it finds itself hosted without a sign-in, so the container restarts in a loop
and every request fails. It fails closed.

## 1b. Saved work

**Nothing to set up.** Each student's work is saved as one small JSON file in `app/.data/state`
inside the container. `docker-compose.yml` backs `app/.data` with the `gamedev_state` volume, so it
survives rebuilds and redeploys. The boot log says `saves: file`.

Two things depend on it, and neither fails loudly in the browser:

- **Saved work.** Progress, the project and the design board are copied per student to the server.
  Without it they live in `localStorage` only, which is per browser per machine, so a tester who
  comes back on a different laptop gets an empty course. This is the thing Jed asked for.
- **The rate limit on the paid relay.** It is counted in memory, which is correct for one process.

A Redis (Upstash, over REST) is only needed if the app ever runs as more than one process. Set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and the boot log says `saves: redis`.
`STATE_DIR=none` turns server-side saves off entirely, which is only useful for testing that path.

**Back up the volume** before anything that might delete it, such as `docker compose down -v` or
moving servers. It is every child's work.

## 2. Environment variables

In `/opt/Game-Dev/.env` on the server. A change takes effect on the next deploy (or
`docker compose up -d` on the server).

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
| `AI_TOTAL_BUDGET_MS` | `50000` |

`AI_TOTAL_BUDGET_MS` is the ceiling on one student's question, retries included. The server has no
platform timeout, so this is the only clock, and 50 seconds is about as long as a child will wait.

**The two `_TOOLS` variables are why the app has offline Phaser docs at all.** With them on, the
coder and the tutor look up the exact Phaser the student is running — 19,000 symbols, on disk — and
read the lesson the student is actually on. With them off, both answer from memory, and the tutor
tells students in so many words that it cannot read any docs. It does not look like a failure; it
looks like the AI being unhelpful. If they are unset the code now switches them on by itself, but a
`.env` line saying `0` still wins, so check the file rather than assuming.

Sign in and open `/api/info` on the deployed site to see what it actually has:

```json
{ "tools": { "coder": true, "tutor": true },
  "lookups": { "reference": true, "api": true, "apiSymbols": 19286, "apiVersion": "4.1.0" } }
```

`tools` is the switches above. `lookups` is whether the files behind them survived into the
deployment — a different failure, with a different cause, that looks identical from the chat panel.
Both must be true.

**Ollama needs a real address.** The default `OLLAMA_URL` is `localhost:11434`, which inside the
container is the container itself. If you leave `AI_PROVIDER=ollama` with that URL, every AI request
fails with "not reachable". Use Anthropic as above, or point `OLLAMA_URL` at a machine that actually
runs Ollama.

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

Push to `main` and wait for the `deploy` workflow to go green. Then check, in this order:

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
time", and it fails silently if saves are off (the boot log would say `saves: none`). **Step 7 is the one that protects the
key**; do it after every change to the sign-in configuration.

---

## Things that will bite

**The rate limit** is 40 AI requests per student per 10 minutes, keyed on the signed-in session. It
**fails open** by design: if a Redis is configured and unreachable, the request goes through,
because a child mid-sentence should not be told to slow down by a storage hiccup. Sign-in and the
spend cap are what actually bound the damage.

**Slow requests.** Tool-enabled requests can take a while. The coder does a corrective retry when
it invents an asset key, and each answer can make up to `AI_TOOL_ROUNDS` lookups. If questions feel
slow with a class on it, lower `AI_TOOL_ROUNDS` from 4 to 2 rather than turning `CODER_TOOLS` off:
turning tools off is how the tutor once ended up unable to read the app's own Phaser docs, which
costs far more accuracy than the wait costs anybody.

**Everything goes through the sign-in gate**, including the 3,300 static files under `/assets` and
`/vendor`. If that ever feels slow, Caddy can serve those two folders directly: they are CC0 art and
vendored libraries with nothing to protect.

**OAuth redirect URIs** must be registered for `https://game-dev.apps.jointheleague.org`. A
different hostname (a tunnel, a second server) needs its own registration, or `PUBLIC_ORIGIN`.

**Student work is mirrored, not merged.** With saves on, the project, the progress and
the design board follow whoever is signed in, so a tester can come back on a different machine and
find their game. What it does not do is merge: the same child signed in on two machines at once
will have one overwrite the other, newest write wins. Fine for a beta; say it out loud before a
class relies on it.

A browser only ever holds one student's work, and it knows whose. Sign in as somebody else on a
borrowed laptop and the previous child's work is dropped before the app reads it — and the server
refuses any upload whose stamp disagrees with the session sending it. Sharing a laptop is safe.
Sharing a *name* is not.
