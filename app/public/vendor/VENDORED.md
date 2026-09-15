# Vendored libraries

These are third-party libraries copied into the repo instead of loaded from a CDN.

**Why:** the app runs on school-managed Chromebooks behind content filters. A blocked CDN
used to mean either the app wouldn't boot or *every student's game* wouldn't run (Phaser was
fetched from jsdelivr inside each game iframe). Vendoring makes the app work with no external
network access at all — only `/api/ai` talks to anything outside the server.

**Do not edit these files.** To change a version, refresh it as below.

## Versions

| Library | Version | Used for |
|---|---|---|
| CodeMirror | 5.65.16 | the Code tab editor + addons (lint, hint, fold, search, dialog) |
| JSHint | 2.13.6 | inline linting inside CodeMirror |
| Prettier | 2.8.8 | `formatJS()` when a file is opened |
| js-yaml | 4.1.0 | `course.yaml`, lesson front-matter, quiz/challenge widget blocks |
| marked | 12.0.2 | lesson Markdown + AI chat replies |
| DOMPurify | 3.1.6 | sanitizing everything `marked` produces before it reaches innerHTML |
| Phaser | 4.2.1 | the game engine, loaded inside the game iframe |

The same version is a **devDependency** as well, and for a different reason: `npm run build:docs`
reads `node_modules/phaser/types/phaser.json` — Phaser's own doclet dump — to generate the offline
API reference the Docs tab serves. Nothing from it is shipped to the browser; the vendored file
above is still what the game loads. Keep the two version numbers the same or the reference will
describe an engine the students are not running.

| @mdi/font | 7.4.47 | all UI icons (`css/` + `fonts/` must stay siblings) |

## Refreshing

Install the pinned versions somewhere outside the project, then copy the files in. They are
deliberately **not** dependencies of `the app package` — the app's own dependency list
stays just `express` + `dotenv`.

```bash
mkdir -p /tmp/vend && cd /tmp/vend && npm init -y
npm install codemirror@5.65.16 jshint@2.13.6 prettier@2.8.8 js-yaml@4.1.0 \
  marked@12.0.2 dompurify@3.1.6 phaser@3.80.1 @mdi/font@7.4.47
```

Then copy each file to the path shown in this directory, keeping the layout — CodeMirror
addons reference each other by relative path, and the MDI stylesheet loads its fonts from
`../fonts/`.

If you bump a version, update the table above and re-test: the Code tab (lint + autocomplete
+ fold + Ctrl-F), a lesson with a quiz and a challenge, and a game that plays sound.
