# Setup (once)

Do the parts in order. Menu names are what the sites show at the time of writing; Google and Vercel rename things now and then, so if a name differs slightly, look for the nearest match.

**Before anything: sync every device.** Your notes live in each browser's own storage and in Google Drive. A new web address starts with empty browser storage (it re-downloads from Drive). So on the laptop and the phone, open the *current* site, tap sync, and wait for the sync icon to show ● (synced). Only then continue.

---

## 1. GitHub: put the new files in, set up branches

1. Unzip the update over your project folder, keeping the folder structure (`api/`, `mobile/`, `tests/`, `.github/workflows/` are new folders).
2. Create a branch and commit (replace the name if you like):
   ```
   git switch -c v1.0.0
   git add -A
   git commit -m "v1.0.0"
   git push -u origin v1.0.0
   ```
3. On github.com open the repository > the yellow banner *Compare & pull request* > **Create pull request**. Wait for the check **Tests** to turn into a green tick (about a minute; Actions tab shows progress). If it is red, open it, read the failing line, and tell me.
4. Do **not** merge yet: Vercel (part 2) will give you a preview of this branch first.
5. Optional but recommended: repository **Settings > Rules > Rulesets > New ruleset > New branch ruleset**. Name `main`; Enforcement *Active*; Target branches > *Add target* > *Include default branch*; tick **Require a pull request before merging** and **Require status checks to pass** (add the check named `test`). Save. From then on nothing reaches `main` without green tests.

You should see: a pull request with a green tick next to *Tests / test*.

## 2. Vercel: host the site

1. Go to vercel.com > **Sign Up** > *Continue with GitHub* (Hobby plan: free, for personal non-commercial use).
2. **Add New... > Project** > find `Notes-App` under *Import Git Repository* > **Import**. If it is missing, *Adjust GitHub App Permissions* and allow that repository.
3. Project name: choose it now, it becomes your address (`https://<name>.vercel.app`). Something short like `km-notes`; if taken, Vercel adds letters, and the address it finally shows is the one to use everywhere below.
4. *Framework Preset*: **Other**. Leave *Build Command* and *Output Directory* empty (there is no build step). **Deploy**.
5. When it finishes you get the address. Open it: the app should load (without login yet).
6. Production branch: **Project > Settings > Git**: *Production Branch* must be `main`.
7. Environment variables, **Project > Settings > Environment Variables**. Add two, and for each untick *Preview* and *Development* so only **Production** is ticked:
   - `SITE_URL` = `https://<name>.vercel.app` (no slash at the end)
   - `GOOGLE_CLIENT_SECRET` = the secret from Google (part 3, step 3). Turn on *Sensitive* if offered.
8. Variables only apply to new deployments: later, after part 3, go to **Deployments**, the newest *Production* one, **... > Redeploy**.

Until the pull request is merged, your pull-request branch has its own preview address (shown in a Vercel comment on the pull request). Open it on the phone and check that the app looks and behaves as before. Then **merge the pull request**: Vercel now deploys `main` as Production.

## 3. Google Cloud: allow the new address

console.cloud.google.com, with the project you already use for the app.

1. **APIs & Services > Credentials**, click your existing **Web application** OAuth client (its Client ID starts with `58518608488-`, the same one that is in `core.js`; do not create a new one, existing Drive data stays yours).
2. Under **Authorized JavaScript origins > Add URI**: `https://<name>.vercel.app`. Under **Authorized redirect URIs > Add URI**: `https://<name>.vercel.app/api/auth`. **Save**. (Keep the old GitHub Pages entries: they make the fallback keep working. Changes can take a few minutes to apply.)
3. On the same page copy the **Client secret** into the Vercel variable `GOOGLE_CLIENT_SECRET` (part 2, step 7). If no secret is shown, use *Add secret* and copy the new one. Never paste it anywhere else.
4. **Important, publishing status.** Open **Google Auth Platform > Audience** (older console: *OAuth consent screen*). If *Publishing status* is **Testing**, Google makes sign-ins expire after **7 days**, which defeats "permanent". Click **Publish app** (*In production*). Our only Drive permission, `drive.file`, is the narrow one that does not need Google's review (as far as I know; the page will say if it asks for a review). You may see a warning screen "Google hasn't verified this app" the first time: *Advanced > Go to ... (unsafe)* is correct, it is your own app.
5. Back in Vercel: Redeploy (part 2, step 8).

## 4. Switch the laptop

1. Open `https://<name>.vercel.app`. Click the sync icon in the top bar (or press `Esc`, then `s`). The browser goes to Google (consent screen: Allow) and comes back to the app. You should see ● after a few seconds, and your notes appear (downloaded from Drive).
2. From now on there are no sign-in popups: the login stays in a secure cookie for up to 400 days and is renewed every time you use the app.
3. Install it as an app: Chrome menu **⋮ > Cast, save and share > Install page as app** (or the install icon at the right of the address bar). The old installed copy (from GitHub Pages) is a separate app: right-click it > *Uninstall* once you are happy with the new one.
4. The service worker updates by itself next time you open the site with internet.
5. Leave GitHub Pages as it is. If Vercel ever has a problem, the Pages address still works (it uses the old popup sign-in).

If the sign-in page says "redirect_uri_mismatch": the address in part 3, step 2 differs from the real one (check `https`, spelling, no slash). If it comes back and sync shows `!`, tap sync again; if it persists, tell me what the message says.

## 5. Android signing key and settings

The key proves "this APK is from me", and Android refuses to update an app signed with a different key. **It is generated once and never lives in the repository.** Because the repository is public, we do not generate it in GitHub Actions either.

1. Open **Google Cloud Shell** (the `>_` icon at the top right of console.cloud.google.com). It has Java already.
2. Run (choose a long password; write it down):
   ```
   keytool -genkeypair -v -keystore notes.jks -alias notes -keyalg RSA -keysize 2048 -validity 10000
   ```
   Answer the questions (name etc. can be anything). When asked for the key password, press Enter to use the same password.
3. Print the fingerprint (needed in part 6) and the base64 text:
   ```
   keytool -list -v -keystore notes.jks -alias notes | grep SHA1
   base64 -w0 notes.jks
   ```
4. **Back it up now**: in Cloud Shell choose **⋮ > Download** > `notes.jks` and keep it with the password in your password manager and one more place. If this file or password is lost, the app can never be updated; you would have to uninstall and install a new one.
5. GitHub repository > **Settings > Secrets and variables > Actions**:
   - tab **Secrets > New repository secret**, four times: `KEYSTORE_BASE64` (the long base64 text), `KEYSTORE_PASSWORD`, `KEY_ALIAS` (= `notes`), `KEY_PASSWORD` (the same password as the store).
   - tab **Variables > New repository variable**: `APP_URL` = `https://<name>.vercel.app`.
6. In Cloud Shell, delete the key: `rm notes.jks` (you have it downloaded).

## 6. Google Cloud: the Android client

1. **APIs & Services > Credentials > Create credentials > OAuth client ID**.
2. *Application type*: **Android**. Name `Notes Android`. *Package name*: `io.github.km915.notes` (exactly; this id is fixed forever). *SHA-1 certificate fingerprint*: the SHA1 line from part 5, step 3. **Create**.
3. Nothing to copy: the app asks Google using the Web client ID (already in `core.js`); Google checks the package name and SHA-1 against this Android client.

## 7. Build and install the APK

1. GitHub > **Actions** tab > left list **Build Android app** > **Run workflow** (branch `main`) > green button. It takes roughly 5 to 10 minutes. The first run may fail on something I could not test from here (I could not build Android where I work): open the failing step, copy the red lines to me.
2. When it is green, open the run. At the bottom **Artifacts > notes-apk** downloads a zip containing `app-release.apk`. (The run's log also prints the signing fingerprint: it must match part 5, step 3.)
3. Get the APK onto the phone (download the zip in the phone's browser, or send it from the laptop), unzip it with the Files app, tap `app-release.apk`. Android asks to allow installing from this source: allow it for that one app. If Play Protect says "unknown developer", tap **Install anyway**.
4. Open **Notes**. It asks "Allow Notes to send you notifications?": **Allow**. Tap the sync icon: Android's own account list appears, choose your account, Allow. You should see "Synced", and your notes.

You never need to install another APK for ordinary updates: the app opens the website, which updates itself.

## 8. Phone settings that keep reminders reliable

1. **Settings > Apps > Notes > Battery** (or *App battery usage*): choose **Unrestricted** (wording differs by brand: "No restrictions", "Don't optimise"). On Xiaomi/Oppo/Vivo/Samsung also look for *Autostart*, *Sleeping apps* / *Never sleeping apps* and add Notes.
2. **Settings > Apps > Notes > Notifications**: on; the category *Task reminders* on, with sound/pop-up.
3. Don't swipe Notes away with "Force stop" from the app settings: that cancels all reminders until you open it again. Swiping it out of the recent-apps list is fine.
4. Open the app now and then (it refreshes the reminder list from your latest tasks).

## 9. Real-phone checklist (what the author could not test)

In the app: menu (`⋯`) > **Reminders: check and send a test**. Then press the home button and wait 10 seconds.

- [ ] A notification "Test reminder" pops up with two buttons *Mark as done* and *Reschedule*. (If not: part 8, and tell me the toast text.)
- [ ] Make a task starting in 3 minutes, lock the phone: the notification arrives on time, with the screen off.
- [ ] *Mark as done* on a real task: the app flashes open, the task shows done, the app goes back to where you were.
- [ ] *Reschedule*: the app opens on that task with the start-time dial open; change the time; the new reminder fires at the new time.
- [ ] Restart the phone with a task due in 30 minutes: the notification still arrives (without opening the app).
- [ ] Add a task on the laptop; open the phone app: after it syncs the reminder exists (menu check shows N tasks planned).
- [ ] Turn off Wi-Fi/data, open the app: it opens (offline) and reminders still fire.
- [ ] Leave the phone idle overnight with a task at 07:00: it arrives (Doze check; allow up to ~9 minutes of delay).
- [ ] After a day, tap sync: still no sign-in screen (permanent login).

## 10. If something goes wrong; keeping an eye on things

- **A bad web change is live**: Vercel > **Deployments** > an older *Production* deployment > **... > Promote to Production** (instant, no rebuild; on the free plan Vercel may allow rolling back only to the previous deployment). Then fix on a branch. Or on GitHub open the merged pull request > **Revert**, which makes a new pull request that undoes it.
- **The login server is down or misconfigured**: the app shows `!`, notes keep working offline; GitHub Pages remains as the fallback.
- **Where to look**: Vercel > Project > **Logs** (errors from `api/auth.js`; it never logs tokens), GitHub > **Actions** (red = failed tests or build), Google Cloud > **APIs & Services > Credentials** (clients) and myaccount.google.com/permissions (what access the app has; removing "Notes" there signs every device out).
- **Limits to know** (free plans): Vercel Hobby allows personal, non-commercial use and a large monthly allowance (far above what one person's syncing uses); GitHub Actions is free without a time limit for public repositories.
- **Sign-out on one device**: menu > *Sign out of Google on this device*.
