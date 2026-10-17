# Notes

Personal notes + calendar/to-do app. Plain JavaScript, no framework, no build step. Works in a browser (laptop, installable as an app), and as an Android app that opens the same website. Syncs one file (`notes.json`) to your own Google Drive. Everything used is free.

Live address: your Vercel address (see SETUP.md). Fallback: https://km915.github.io/Notes-App/

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css`, `manifest.json`, `icon.png` | The page, its look, the install info, the icon |
| `core.js` | Settings (`VER`, Google client ID), themes, data `D`, small helpers. Loads 1st |
| `notes.js` | Folders and notes screen. 2nd |
| `calendar.js` | Calendar, day/week/month, task form. 3rd |
| `sync.js` | Google sign-in and Drive sync. 4th |
| `native.js` | Only active inside the Android app: native sign-in, reminders. 5th |
| `app.js` | Keyboard, menu, start-up. Loads last |
| `sw.js` | Service worker: lets the site open offline |
| `api/auth.js` | The login server (one Vercel function). Holds the Google "refresh token" in a secure cookie |
| `mobile/` | Makes the Android project (`prepare.mjs`) from the website address; nothing generated is committed |
| `tests/` | Automatic tests (`npm test` inside `tests/`) |
| `.github/workflows/` | `test.yml` (tests on every push), `android.yml` (builds the APK, run by hand) |
| `CHANGELOG.md` | What changed in each version, Roadmap, Known limits |
| `SETUP.md` | One-time click-by-click setup (Vercel, Google, Android signing) |

The script files share one global scope (plain `<script>` tags), so **the order in `index.html` matters**.

## How the pieces connect

```
 laptop browser ──┐                          ┌── Google Drive (notes.json)
                  ├── Vercel site + api/auth ┤
 Android app ─────┘   (static files + login) └── Google sign-in (refresh token stays in a cookie)
   (opens the same site; reminders are scheduled on the phone itself)
```

The Android app contains no copy of the site. It opens your Vercel address, so **a web change reaches the phone as soon as it is deployed**. A new APK is only needed for the things listed under "Things that need a new APK" in `CHANGELOG.md` (Known limits).

## How we work

**Environments** (the same code in different places):
- *Development*: your laptop. Open the folder with any static server (for example `python3 -m http.server`) or just push to a branch. No login server there, so sign-in uses the Google popup.
- *Preview*: Vercel builds every branch and pull request at its own temporary address. Good for looking at a change on your phone before it matters. No login server (the secret and `SITE_URL` are set for Production only), so sign-in uses the popup.
- *Production*: the `main` branch, at your real address.

**Deployment vs release.** *Deploying* = putting code on a web address. Vercel does it automatically when `main` changes (this is the "CD" part: continuous delivery). *Releasing* = deciding that people get a version: update `VER` in `core.js` and `CHANGELOG.md`, and for a new APK run the Android workflow. Web changes deploy and release at once; APKs are released by hand.

**CI** (continuous integration) = the tests run automatically on every push and pull request (`test.yml`). A red cross means: do not merge.

**Branches.** `main` always works. Make a branch for each change (`git switch -c fix-month-view`), push it, open a pull request, wait for the green tick and the Vercel preview link, merge. Optional: GitHub > Settings > Rules > Rulesets can require this (SETUP.md part 1).

**Secrets.** Anything that would let someone else act as you lives only in GitHub *Secrets* or Vercel *Environment Variables*, never in a file:

| Secret | Where | What it is |
|---|---|---|
| `GOOGLE_CLIENT_SECRET` | Vercel | Lets the login server talk to Google |
| `SITE_URL` | Vercel | The only address allowed to call the login server |
| `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | GitHub secrets | The key that signs the APK. **Lose it and the installed app can never be updated** |

The Google client ID in `core.js` and the SHA-1 fingerprint are public by design. The repository is public, so GitHub Actions logs are public too: no step may print a secret.

**Versions.** `VER` in `core.js` (shown in the menu) matches the newest `CHANGELOG.md` entry: `1.0.0`, then `1.0.1` for fixes, `1.1.0` for features, `2.0.0` for something big. The APK's own number (`1.0.<run number>`) just counts builds.

**What to test.** Run `npm test` in `tests/` before every pull request (the pipeline does it too).
- Behaviour that must never change by accident: the laptop trace (`desktop.golden.txt`). If you *meant* to change laptop behaviour, regenerate the trace and say so in the pull request.
- Every new feature gets a test next to the existing ones, in the style of the others.
- The tests run in a simulated browser. They cannot tell you how a real phone behaves: SETUP.md part 9 is the by-hand checklist.

## Running the tests

```
cd tests
npm ci
npm test
```

Needs Node 22. To run one file: `node run.js phone`.
