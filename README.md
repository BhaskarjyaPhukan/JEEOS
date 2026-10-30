# JEE OS (Windows app)

Wraps the JEE OS study app (`app/index.html`) in Electron and builds a Windows .exe with GitHub Actions.

## Get the .exe with GitHub (no install needed)
1. Create a new GitHub repository and upload everything from this folder.
2. Open the **Actions** tab. The "Build Windows app" workflow runs automatically (about 3-5 minutes). If it doesn't start, open the workflow and click **Run workflow**.
3. Open the finished run and download **JEE-OS-Windows** from *Artifacts*. Unzip it:
   - `JEE-OS-Setup-1.0.0.exe`: installer with desktop shortcut
   - `JEE-OS-Portable-1.0.0.exe`: runs without installing

Windows SmartScreen may say "unknown publisher" because the app isn't code-signed. Click *More info*, then *Run anyway*.

## If the `.github` folder did not show up in your repository
The folder name starts with a dot, so GitHub's web uploader often skips it. Create the file by hand:
1. In your repository click **Add file**, then **Create new file**.
2. In the name box type exactly `.github/workflows/build.yml` (each `/` you type turns into a folder).
3. Open `build-workflow.yml` from this folder, copy everything in it and paste it into the editor.
4. Click **Commit changes**. The build starts by itself.

Also check that `package.json`, `main.js` and `preload.js` sit at the top level of the repository, not inside an extra folder.

## Releases
Every build is also published automatically on the repository's **Releases** page (named "JEE OS build N"), so you can download the .exe from there too.

## Build locally
    npm install
    npm run dist      # output in dist/
    npm start         # run without packaging

## Updating the app (automatic)
1. Replace `app/index.html` with the new version and commit. The workflow rebuilds and publishes a new release (version `1.0.N`, where N is the build number).
2. Every installed copy checks GitHub Releases on start and every 4 hours, downloads the new version in the background, and asks to restart. If you pick *Later*, it installs the next time you close the app.
3. You can also open **Settings, App updates, Check for updates** at any time.

Your data is kept because the update installs over the old version. **Never uninstall to update.**

Requirements:
- Install with **JEE-OS-Setup-x.y.z.exe**. The Portable version cannot update itself.
- Builds made on your own PC (`npm run dist`) do not auto-update. Use the GitHub build.
- The very first time, install the new Setup over your current app (no uninstall). From then on updates are automatic.

### Private repository: one-time token setup
The repository can stay private. The installed app needs a **read-only** token to see your releases:
1. GitHub, your profile picture, **Settings**, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, **Generate new token**.
2. Name it `JEE OS updates`. Choose the longest expiry offered. Under *Repository access* pick **Only select repositories** and choose this repository.
3. Under *Permissions*, *Repository permissions*, set **Contents** to **Read-only**. Nothing else. Generate and copy the token.
4. In the repository: **Settings**, **Secrets and variables**, **Actions**, **New repository secret**. Name: `UPDATE_TOKEN`. Value: the token. Save.
5. Re-run the build (Actions, Build Windows app, Run workflow) and install that version once.

Notes: the token is stored inside the installed app, so do not share the installer with anyone. If the token expires, updates stop working; make a new token, update the secret, rebuild, and install over the old app (your data is kept).

## Notes
- Your data (including report-card banners) is stored inside the app on that PC, like a browser's local storage. It does not sync with the browser version.
- Songs you add in the Focus music panel are stored inside the app on that PC as well (they are not part of the backup files).
- The window has no title bar: the minimise, maximise and close buttons sit inside the app header and follow the light or dark theme.
- Fonts load from Google Fonts when online and fall back to system fonts offline.
