# Branding assets (self-hosting)

The app currently references League branding straight from
`https://images.jointheleague.org/logos/`. That works, but it depends on that
server being reachable. To self-host instead, download these files into this
folder (`public/img/`) and then change every `https://images.jointheleague.org/logos/`
reference to `img/`:

In `public/index.html`:
- `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png`  (in <head>)
- `logo_JTL_horiz.png`  (top-bar logo)
- `bolt.png`  (XP icon in the footer)
- `clearRobotRing4.png`  (AI Assistant avatar)

In `public/manifest.webmanifest`:
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

Download URLs (right-click → Save, or `curl -O` on your own machine):
- https://images.jointheleague.org/logos/favicon-16x16.png
- https://images.jointheleague.org/logos/favicon-32x32.png
- https://images.jointheleague.org/logos/apple-touch-icon.png
- https://images.jointheleague.org/logos/android-chrome-192x192.png
- https://images.jointheleague.org/logos/android-chrome-512x512.png
- https://images.jointheleague.org/logos/logo_JTL_horiz.png
- https://images.jointheleague.org/logos/bolt.png
- https://images.jointheleague.org/logos/clearRobotRing4.png

Alternatives to try if a choice doesn't look right on the dark theme:
- Top-bar logo: `logo_white.png` (white version, made for dark backgrounds) or `logo_w_orangebg.png`.
- AI avatar / mascot: `clearRobot3Color1.png`.
