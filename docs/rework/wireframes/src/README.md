# Wireframe sources

`03-shift-silent-coins.html` one level up is **built** from here; edit the template, then rebuild.
(00–02 were written directly as single files and have no template.)

| File | What it is |
|---|---|
| `03-shift-silent-coins.template.html` | the shift's markup and script, with `{{CSS}}` `{{ICONS}}` `{{LOGO}}` slots |
| `04-first-day.template.html` | the first day as the first shift (`briefs/first-run.md` v3); replaces 01/02 as the first run. `node docs/rework/wireframes/src/build.js 04-first-day` |
| `base.css` `icons.svg` `logo.txt` | shared styles, the icon sprite, the League wordmark as a data URI |
| `build.js` | fills the slots and writes the self-contained HTML; `{{SFX}}` inlines four Kenney CC0 sounds from `app/public/assets/` (the list is at the top of the file) |
| `03-gate-test.js` | plays the whole shift in a real browser and checks every gate |

```sh
node docs/rework/wireframes/src/build.js 03-shift-silent-coins
node docs/rework/wireframes/src/03-gate-test.js "$PWD/docs/rework/wireframes/03-shift-silent-coins.html" /tmp/wf03
.claude/skills/impeccable/scripts/impeccable detect docs/rework/wireframes/03-shift-silent-coins.html
```

The gate tests (`03-gate-test.js`, `04-gate-test.js`) need Playwright, which is not an app
dependency: point `PW` at an install (`PW=$(npm root -g)/playwright`) or have `playwright`
resolvable. With only `playwright-core` installed and no downloaded browsers, set `PW_CHANNEL=msedge`
(or `chrome`) to drive the browser already on the machine; on Windows pass the page as
`"/F:/…/03-shift-silent-coins.html"` so the `file://` URL is well formed. 04 should end on
`Step 9 · What’s next | quest open: true` and `errors []`. The second argument is a folder
for its screenshots. It should end with `quest done: 6/6`, `spam triggered on rapid answers: true`
and `errors []`, and report `options shuffle: true`. Answers are shuffled on every render, so the test
picks them by their words; keep it that way when adding steps. The detector should exit 0.
