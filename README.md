# ReachOut — Church Outreach Follow-up Platform

ReachOut is a double-sided system designed to automate personalized WhatsApp follow-up messages for church visitors/contacts collected during weekly physical evangelism. It consists of:
1. An **offline-first simulation frontend** (interactive prototype running fully locally).
2. A **Node.js Express backend sync server** integrated with Supabase PostgreSQL and Google Sheets.
3. A **native Android WebView wrapper** that bundles the client-side files inside the APK to run on mobile.

---

## 1. Running the Web Application Locally

To test the application locally in developer mode:

### Prerequisites
* [Node.js](https://nodejs.org) (v18.0.0 or higher) installed on your system.

### Installation
1. Open a terminal/command prompt in the project root directory.
2. Install the backend dependencies:
   ```bash
   npm install
   ```
   *(On Windows, if PowerShell execution policy blocks standard npm scripts, run: `npm.cmd install`)*

### Configuration
1. Copy the `.env.example` file and rename it to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Meta WhatsApp API credentials and Google Cloud Platform service account JSON private keys.

### Start the Server
Run the local server:
```bash
npm start
```
The console will output: `ReachOut AI Backend Server listening on http://localhost:3000`. You can now open your browser and navigate to `http://localhost:3000` to interact with the frontend.

---

## 2. Building the Android APK

The project includes a lightweight, native Android WebView wrapper project configured in the `/android` directory. The web files are bundled locally inside the APK to allow offline simulation runtimes.

### Prerequisites
To build the APK locally, your machine requires:
* **Java Development Kit (JDK 17 or higher)** installed and the `JAVA_HOME` environment variable configured.
* **Android SDK / command-line tools** or **Android Studio** installed.

### Build via Command Line (Windows)
Run the automated build script defined in `package.json`:
```bash
npm run apk:build
```
*(On Windows, if blocked by script execution policies, run: `npm.cmd run apk:build`)*

This script will:
1. Change directory into the native Android folder.
2. Compile the project using the Gradle wrapper (`.\gradlew assembleRelease`).
3. Automatically copy the compiled release package directly to the project root as `release.apk`.

### Build via Android Studio
1. Launch **Android Studio**.
2. Select **Open Project** and open the `android` folder in the project directory.
3. Wait for Gradle to download dependencies and sync the project.
4. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)** in the top menu bar.

---

## 3. Finding the APK File

* **Automated Script Output:** If you run `npm run apk:build`, the final build package will be placed directly in the **project root folder** as **`release.apk`**.
* **Gradle Build Outputs Directory:** If compiled via Android Studio or raw gradle commands, you can find the output APK at:
  ```
  [project_root]/android/app/build/outputs/apk/release/app-release-unsigned.apk
  ```

---

## 4. Technical Wrapping & Network Notes

* **No CDN Files (Bundled Assets):**
  Make sure all CSS, JS, images, and assets are local files bundled inside the APK. Do not load CDN files.
  *The frontend files (`index.html` and `app.js`) are fully self-contained inside the `android/app/src/main/assets/www` directory. The layout uses standard system font fallbacks (`sans-serif` and `serif`) to remain functional offline without fetching fonts from the internet.*

* **Internet Permissions:**
  The WebView app may use internet APIs, so keep Android INTERNET permission enabled.
  *This is configured in `AndroidManifest.xml` via `<uses-permission android:name="android.permission.INTERNET" />`, enabling the app to communicate with your online Node.js webhook server and database in production.*
