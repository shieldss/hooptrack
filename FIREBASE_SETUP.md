# HoopTrack Cloud Setup

HoopTrack remains fully usable offline until Firebase is configured. Player photos and generated graphics stay on each device and are never sent to Firebase.

## 1. Create the Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Add a **Web app** to that project. Do not enable Firebase Hosting for this app.
3. Copy the displayed Firebase web configuration into `firebase-config.js`. These are public web identifiers, not admin credentials.

## 2. Enable Google sign-in

1. In **Authentication**, choose **Get started**.
2. Open **Sign-in method**, enable **Google**, and select a support email.
3. Under **Settings** > **Authorized domains**, add `shieldss.github.io`.
4. For local testing, `localhost` is already usually present. Add any custom domain used to host HoopTrack.

## 3. Create Firestore

1. In **Firestore Database**, choose **Create database** in Production mode.
2. Select the Firebase project’s preferred region. This choice cannot be changed later.
3. Replace the generated rules with the rules below and publish them.

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 4. Verify

1. Deploy HoopTrack and open Settings > HoopTrack Cloud.
2. Choose **Sign in with Google**.
3. On the first sign-in from a device with data, choose **Import my data** to upload the existing local history, or **Start fresh** to leave it only on that device.
4. Sign in with the same Google account on a second device. The player profile, settings, leagues, games, notes, and achievements appear after sync.

## How sync works

- HoopTrack saves locally first, immediately, for every action.
- Cloud writes are grouped and debounced for about 20 seconds, and sync also runs when the app backgrounds or comes back online.
- Games are stored by their existing HoopTrack IDs. Deletes are synchronized as tombstones so they do not reappear from an older device.
- When the same record changes on two devices, the newest `updatedAt` value wins. Records that exist only on either device are preserved.
- Google account details are limited to the display name, email, and profile URL Firebase provides. OAuth tokens and passwords are not stored by HoopTrack.
