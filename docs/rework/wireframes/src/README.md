# Wireframe sources

`03-shift-silent-coins.html` one level up is **built** from here; edit the template, then rebuild.
(00–02 were written directly as single files and have no template.)

| File | What it is |
|---|---|
| `03-shift-silent-coins.template.html` | the shift's markup and script, with `{{CSS}}` `{{ICONS}}` `{{LOGO}}` slots |
| `base.css` `icons.svg` `logo.txt` | shared styles, the icon sprite, the League wordmark as a data URI |
| `build.js` | fills the slots and writes the self-contained HTML |
| `03-gate-test.js` | plays the whole shift in a real browser and checks every gate |

```sh
node docs/rework/wireframes/src/build.js 03-shift-silent-coins
node docs/rework/wireframes/src/03-gate-test.js "$PWD/docs/rework/wireframes/03-shift-silent-coins.html" /tmp/wf03
.claude/skills/impeccable/scripts/impeccable detect docs/rework/wireframes/03-shift-silent-coins.html
```

The gate test needs Playwright, which is not an app dependency: point `PW` at an install
(`PW=$(npm root -g)/playwright`) or have `playwright` resolvable. The second argument is a folder
for its screenshots. It should end with `quest done: 6/6`, `spam triggered on rapid answers: true`
and `errors []`. The detector should exit 0.
