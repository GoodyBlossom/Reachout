# ReachOut / GOTeam Lite

GOTeam Lite is a compact offline Android WebView package for the ReachOut frontend. It bundles the HTML, CSS, and JavaScript files directly inside the APK, so the app can open and run without a backend or internet connection.

## What The App Does

- Shows a mobile-friendly outreach follow-up interface.
- Lets a coordinator enter outreach details and choose a contacts spreadsheet.
- Displays sample outreach contacts, follow-up sequence steps, and dashboard metrics.
- Runs as a native Android WebView app named **GOTeam Lite** with package name `com.taskflowlite.app`.

## Run The Web App Locally

Open `public/index.html` in a browser, or serve the folder with any simple static server.

Example with Node.js:

```bash
npx serve public
```

The Android APK uses the same files copied into:

```text
android/app/src/main/assets/www
```

The WebView loads:

```text
file:///android_asset/www/index.html
```

## Build The APK

The app is a plain Android WebView wrapper. It does not use Expo, React Native, Capacitor, or a backend.

Build locally from the repository root:

```bash
cd android
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../GOTeam.apk
```

On Windows PowerShell:

```powershell
cd android
.\gradlew.bat assembleRelease
Copy-Item app\build\outputs\apk\release\app-release.apk ..\GOTeam.apk -Force
```

## Where To Find The APK

- Local build output copied to the project root: `GOTeam.apk`
- Raw Gradle output: `android/app/build/outputs/apk/release/app-release.apk`
- GitHub Release asset: `GOTeam.apk`

## Release Build

The GitHub Actions workflow builds a signed release APK, verifies its package metadata and signing, copies it to `GOTeam.apk`, creates a GitHub Release, and uploads the APK.
