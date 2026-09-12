# Deploying Game Dev

Written for the September 2026 beta: a handful of testers, on a public URL, for two sessions a week
apart. `auth.js` and `store.js` both point here from their boot errors, so this is the page you
land on when something refuses to start.

Two things have to be true before testers arrive, and Jed named both on the 9 September call:

1. **They can all sign in.** Otherwise the URL is the password, and a URL gets pasted into chats.
2. **Their work is still there next time.** *"They're not going to want to log back in and all
   their work be gone. That's going to totally bum them out."*

Everything below is in service of those two.

---

## 1. The store, first

Do this before the first deploy. Without it the app runs, signs people in, and silently loses
everything the moment a student opens it on another machine — which is the exact failure the beta
exists to avoid. The server prints a warning on every boot when it is missing.

In the Vercel dashboard: **Storage → Create Database → KV**, attach it to this project.

That is the whole job. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` itself and
`store.js` reads them. An Upstash database created directly works too — it sets `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN`, and both spellings are accepted.

There is no schema and nothing to migrate: one JSON blob per student, holding the same three keys
the browser already keeps (`leagueProject`, `leagueProgress`, `leagueBoard`). The key is a hash of
the sign-in identity rather than the identity itself, so the dashboard never shows a list of
children's names.

**Free tier is far more than this needs.** Five testers with a few small files each is kilobytes.

---

## 2. Environment variables

Set these in **Settings → Environment Variables**, for Production *and* Preview.

| Variable | What it is |
|---|---|
| `SESSION_SECRET` | **Required.** Signs the session cookie. At least 32 characters. |
| `TESTER_PASSWORD` | The temporary beta door. At least 12 characters. Unset it to remove the door. |
| `ANTHROPIC_API_KEY` | The AI relay. This is the thing the sign-in gate is protecting. |
| `PUBLIC_ORIGIN` | Optional. Pins the OAuth redirect when the guessed host is wrong. |

Generate the two secrets:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

```bash
node -e "console.log('TESTER_PASSWORD=' + require('crypto').randomBytes(9).toString('base64url'))"
```

The tester password is shared by everybody and sits on a public URL, so it is the only thing between
a crawler and a paid API key. The server refuses to start if it is under 12 characters.

---

## 3. The temporary sign-in

`TESTER_PASSWORD` puts a name box and a password box **above** the OAuth buttons on the login page.
Any name, one shared password — Eric's instruction, and deliberately not a security control. Its job
is to give each child a **stable identity** so the store knows whose game is whose.

**Hand the names out on the call and write them down.** The name is the identity: two children who
both type `Jonathan` share one save. Slug rules are forgiving — `Jonathan`, `jonathan` and
`Jonathan!` all land on `jonathan@tester` — which helps a child who types it differently the second
week, and is exactly why two children must not be given similar names.

A browser remembers whose work it is holding. If a second tester signs in on a borrowed laptop, the
first one's work is dropped before the app reads it, and the server refuses an upload whose stamp
disagrees with the session presenting it. Sharing a laptop is safe; sharing a *name* is not.

**Delete `TESTER_PASSWORD` the day the CodeServer's OAuth works.** The box disappears with it.

---

## 4. Deploy

```bash
vercel --prod
```

`vercel.json` routes everything to `api/index.js`, which wraps `server.js`. There is no build step:
no bundler, and the browser libraries are vendored in the repo on purpose, because school networks
filter CDNs.

---

## 5. Check it, in this order

1. Open the URL signed out. You should get the sign-in page, not the app.
2. Sign in with a test name. You should land in lesson one.
3. Change something — edit `game.js`, earn some XP — and wait about five seconds.
4. **Open the same URL in a private window, sign in with the same name.** Your change should be
   there. This is the check that matters; it is the one that proves session two will work.
5. Ask the tutor a question, to confirm the AI key is wired up.
6. Sign in with a *different* name in the same browser. You should get a clean, empty course — not
   the first name's game.

If step 4 fails, the store is not attached. The boot log says so on every start:
`· saves: none` instead of `· saves: redis`.

---

## Refusals to start, and what they mean

**"this is a hosted deployment with no sign-in configured"** — no provider and no
`TESTER_PASSWORD`. Every button would be a way in, so it refuses rather than serving the course and
the API key to the internet. Set `TESTER_PASSWORD`, or configure a real provider.

**"sign-in is partly configured but missing: …"** — a client id without its secret, or a provider
without `SESSION_SECRET`. A half-configured gate looks shut and is not.

**"TESTER_PASSWORD is shorter than 12 characters"** — see above; it is load-bearing.

**"SESSION_SECRET is shorter than 32 characters"** — the command to generate one is in the message.

---

## The real doors, later

Three OAuth providers are already built and wired; each is off until its variables are set.

- **`codeserver`** — the students' own League accounts, and the main door when it is finished.
  Needs `CODESERVER_CLIENT_ID`, `CODESERVER_CLIENT_SECRET`, `CODESERVER_AUTH_URL`,
  `CODESERVER_TOKEN_URL`, `CODESERVER_USER_URL`. Leave `ALLOWED_CODESERVER` unset to admit everyone
  it vouches for; set it to pilot with a few students first.
- **`google`** — teachers. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `ALLOWED_DOMAIN=jointheleague.org`.
  The League manages this key.
- **`github`** — outside collaborators only, never students: GitHub requires users to be 13.
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and an explicit `ALLOWED_GITHUB` list — prefer numeric
  ids over logins, because a login can be given up and claimed by somebody else.

The redirect URL to register with each is `https://<your-domain>/auth/<provider>/callback`.

Switching a student from the tester door to a real account gives them a different identity and
therefore a different save. If that matters for somebody's work, move it before the door changes.
