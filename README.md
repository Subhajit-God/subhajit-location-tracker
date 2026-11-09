# SUBHAJIT LOCATION TRACKER

A free-tier, consent-based location-sharing Progressive Web App (PWA).

## Important platform limitation

This project is a **PWA only**. A web page cannot guarantee continuous GPS tracking after Android suspends the browser, closes the tab, or kills the process. The provider must keep the app/page active for dependable 30-second updates. Android battery optimization and browser permissions can also pause updates. The app displays the last update time and stale status so the viewer is not misled.

A reliable always-on Android background service requires a native Android application with a foreground service and persistent notification; that is deliberately not included in this PWA-only build.

## Free services

- GitHub Pages: static HTTPS hosting (free for public repositories).
- Firebase Authentication: email/password sign-in, subject to Spark plan limits.
- Cloud Firestore: latest location and history, subject to free quotas.
- Leaflet + OpenStreetMap: map display. Follow OpenStreetMap tile usage policy; do not bulk-download tiles.
- No paid map API is required.

Free-tier availability and quotas can change. No paid billing should be enabled for this setup.

## 1. Create Firebase project

1. Open https://console.firebase.google.com/ and create a project.
2. Keep Google Analytics disabled if you do not need it.
3. In **Build > Authentication > Get started > Sign-in method**, enable **Email/Password**.
4. In **Authentication > Users**, create two users:
   - Provider account: choose an email address for SUBHAJIT and a new unique password.
   - Viewer account: choose a different email address for INFO_SUBHAJIT and a different unique password.
5. Do not reuse passwords previously posted in a chat. Never put passwords in source code.
6. Open **Project settings > General > Your apps > Add app > Web**. Register the app and copy the Firebase web config.
7. Open `firebase-config.js` and replace the placeholders in `FIREBASE_CONFIG`.
8. Set `ROLE_EMAILS.provider` and `ROLE_EMAILS.viewer` to the exact email addresses created above. These are identifiers, not passwords.

Firebase web config is not a password, but Firestore Security Rules are essential. Do not rely on hiding the config.

## 2. Create Firestore

1. Firebase Console > Build > Firestore Database > Create database.
2. Choose production mode.
3. Select a nearby region. The region cannot easily be changed later.
4. Open **Authentication > Users** and copy each user's UID.
5. Open `firestore.rules`. Replace `REPLACE_PROVIDER_UID` and `REPLACE_VIEWER_UID` with the corresponding UIDs.
6. Publish the rules in Firestore > Rules.

The provider can create/update the current location and add history. The viewer can read the location and history but cannot write or change the provider's status. Both accounts are restricted to the one tracker document.

## 3. Seven-day history retention

The app writes one history entry for each successful location update. It displays only entries from the last seven days. When the provider opens the app, it attempts to delete older entries in batches of up to 300.

Important: this is **best-effort cleanup**, not guaranteed automatic deletion. Firestore TTL may require billing and is intentionally not used. If strict automatic deletion is required, use a scheduled backend with a supported free allowance or manually clean up old records. Keep history collection size within the Firestore free quota.

## 4. Run locally on Windows

Geolocation requires a secure context. `localhost` is treated as secure by modern browsers.

1. Install Python 3 from https://www.python.org/downloads/ (or use an existing Python installation).
2. Extract this ZIP.
3. Open the extracted folder in File Explorer.
4. Click the address bar, type `cmd`, and press Enter.
5. Run:

   ```bat
   py -m http.server 8000
   ```

6. Open `http://localhost:8000` in a browser.
7. Configure Firebase before signing in.

## 5. Deploy free with GitHub Pages

1. Create a GitHub account at https://github.com/.
2. Create a **public** repository named `subhajit-location-tracker`.
3. Upload the contents of this project folder (not the ZIP itself).
4. In GitHub, open **Settings > Pages**.
5. Under Build and deployment, select **Deploy from a branch**.
6. Select branch `main`, folder `/ (root)`, and save.
7. Wait for the published HTTPS URL, usually `https://YOUR-USERNAME.github.io/subhajit-location-tracker/`.
8. In Firebase Console > Authentication > Settings > Authorized domains, add `YOUR-USERNAME.github.io` if it is not already present.
9. Open the HTTPS site on Android Chrome and use the browser menu > **Install app** or **Add to Home screen**.

Every time you change files, commit and push the changes to GitHub. GitHub Pages republishes the site.

## 6. First login and test

1. Open the deployed site.
2. Select SUBHAJIT · Location provider.
3. Enter the provider Firebase email and password.
4. Press **Start sharing** and grant location permission.
5. Keep the app open while testing updates.
6. On a second device/browser, sign in as INFO_SUBHAJIT.
7. Confirm the map and timestamp update.
8. Press Emergency stop on the provider device. The viewer should show sharing stopped.
9. Test the automatic timer and confirm it stops sharing.

The viewer QR code opens the viewer page only. It does not authenticate the scanner or disclose a password.

## 7. App capabilities and limitations

- Start/stop location sharing with explicit permission.
- Provider-controlled automatic stop timer.
- Latest location, accuracy and update timestamp.
- Viewer map, directions link and seven-day history display.
- Stale-location indicator.
- Distance calculation only after the viewer grants one-time location permission.
- Battery percentage only where the browser supports the Battery Status API; many browsers do not.
- QR code contains only the viewer page URL.
- PWA shell can open offline, but authentication and live location data require internet.
- 30-second interval is a target, not a guaranteed schedule. Browser geolocation watch updates when the device reports a position; it is not a precise timer.

## 8. Troubleshooting

**"Setup required"**: check `firebase-config.js` for unfilled placeholders and reload.

**Unauthorized / permission denied**: check both UIDs in `firestore.rules`, publish rules, and confirm the signed-in email matches the selected role.

**Firebase auth domain error**: add the GitHub Pages hostname to Firebase Authentication authorized domains.

**Map tiles missing**: check internet access and OpenStreetMap tile service availability.

**Location permission denied**: use HTTPS, allow location in browser site settings, and enable Android location services.

**No background updates**: expected PWA limitation. Keep the page active. A PWA cannot provide a guaranteed Android background location foreground service.

## Privacy and safety

Use this only for your own device or with the explicit, informed consent of the person sharing location. The provider must be able to see when sharing is active and stop it at any time. Do not publish passwords, service-account keys, or private credentials in GitHub. If a password was exposed, change it before using the app.
