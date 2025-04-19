# Vercel Deployment Guide

This guide will help you resolve common issues when deploying this application to Vercel, especially related to Firebase authentication problems.

## Common Deployment Issues

If you're experiencing errors when deploying to Vercel, it's likely due to one of these two common issues:

1. **Missing Environment Variables**: Firebase configuration is not properly set in Vercel
2. **Unauthorized Domain**: Your Vercel domain is not registered in Firebase Authentication

## Solution Steps

### 1. Set Environment Variables in Vercel

All the Firebase configuration variables that are in your local `.env.local` file must be added to your Vercel project.

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your project, then go to "Settings" → "Environment Variables"
3. Add all the following environment variables from your `.env.local` file:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
```

4. Make sure all variable names start with `NEXT_PUBLIC_` so they're accessible on the client side
5. Click "Save" and redeploy your application

### 2. Authorize Your Vercel Domain in Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to "Authentication" → "Settings" → "Authorized domains"
4. Add your Vercel deployment URL (e.g., `your-project.vercel.app`) to the list of authorized domains
5. If you're using a custom domain, add that as well

## Verifying Your Configuration

### Test Environment Variables

To confirm your environment variables are properly set:

1. Add a temporary log statement in your code to check if variables are available:
```jsx
useEffect(() => {
  console.log('Firebase API Key exists:', !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  console.log('Firebase Auth Domain exists:', !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
}, []);
```

2. Check your browser console when the app loads to verify the values are present

### Test Firebase Authentication

1. After setting up environment variables and authorized domains, try logging in again
2. If you still see errors, check the browser console for specific error messages
3. Common error codes and their fixes:
   - `auth/unauthorized-domain`: Add your Vercel domain to Firebase authorized domains
   - `auth/configuration-not-found`: Check that all Firebase environment variables are correctly set in Vercel

## Additional Troubleshooting

If you continue to experience issues:

1. Verify that your Google Maps API key is also properly configured
2. Ensure there are no typos in your environment variable values
3. Check if your Firebase project has the proper authentication methods enabled (Google, Email/Password, etc.)
4. Try clearing your browser cache or using an incognito window

## After Deployment

After successfully deploying, remember to:

1. Test all authentication flows
2. Verify that map functionality works correctly
3. Test field saving and loading from Firestore
4. Check that all images load from Firebase Storage

If you encounter any specific errors not covered in this guide, check the browser console for error messages and update this document with the solutions. 