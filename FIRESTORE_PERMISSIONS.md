# Fixing Firebase Permissions Error

If you're encountering the error "FirebaseError: Missing or insufficient permissions" when trying to save or load field data, you need to update your Firestore security rules. This document provides multiple solutions to fix this issue.

## What Causes This Error?

This error occurs when your Firestore database has restrictive security rules that prevent your application from reading or writing data. By default, Firebase has very strict security rules that deny all read and write operations.

## Solution 1: Update Rules via Firebase Console (Easiest)

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on "Firestore Database" in the left sidebar
4. Click on the "Rules" tab
5. Replace the existing rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /fields/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. Click "Publish"

This rule allows any authenticated user to read and write to the fields collection.

## Solution 2: Deploy Rules via Firebase CLI

If you prefer using the command line, you can deploy the rules with Firebase CLI:

1. Make sure you have the Firebase CLI installed:
   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```
   firebase login
   ```

3. Run the deployment script:
   ```
   node deploy-firestore-rules.js
   ```

## Solution 3: Initialize Firestore Database

If you haven't properly initialized your Firestore database, you might need to do that first:

1. In the Firebase Console, go to "Firestore Database"
2. Click "Create database" if you haven't already
3. Choose either "Start in production mode" or "Start in test mode"
   - Production mode will require you to set rules before using
   - Test mode will allow all reads and writes for 30 days (good for development)
4. Select a database location close to your users
5. Click "Enable"

## Using Local Storage Fallback

Your application has been updated with a local storage fallback. If Firestore permissions cannot be fixed, your data will be saved locally in your browser. You'll see a notification banner when this happens.

Key points about the local storage fallback:

- Data is only stored on your current device and browser
- Clearing browser data will delete all saved fields
- You can't access your fields from other devices
- No login is required for local storage (but we still check)

## Need More Help?

If you continue experiencing issues, check the browser console for more specific error messages (press F12 to open developer tools, then click on the "Console" tab).

For development purposes, you can set Firestore to test mode which allows unrestricted access for 30 days:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Warning:** Do not use these rules in production as they allow anyone to read and write to your database! 