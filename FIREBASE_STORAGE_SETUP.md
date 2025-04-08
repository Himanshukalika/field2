# Firebase Storage Setup Guide

## 1. Enable Firebase Storage

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. In the left sidebar, click on "Storage"
4. Click "Get Started" if you haven't enabled Storage yet
5. Choose a location for your storage bucket (preferably the same region as your app)
6. Start in test mode for development (you can update security rules later)
7. Click "Done"

## 2. Update Security Rules

1. In the Firebase Console, go to Storage > Rules
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{userId}/{fieldId}/{imageId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024 // 5MB max
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

These rules ensure:
- Only authenticated users can access their own images
- Images are limited to 5MB
- Only image files are allowed
- Each user's images are stored in their own folder

## 3. Update Environment Variables

Add these variables to your `.env.local` file:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

## 4. Install Required Dependencies

```bash
npm install firebase
```

## 5. Storage Structure

The storage structure will be:
```
/users
  /{userId}
    /{fieldId}
      /{imageId}
```

This structure:
- Separates images by user
- Groups images by field
- Allows multiple images per field
- Makes it easy to manage permissions

## 6. Usage in Code

The code is already set up to use Firebase Storage. Here's how it works:

1. When uploading an image:
   - Image is converted to base64
   - Stored in Firebase Storage
   - URL is saved with the field data

2. When loading fields:
   - Field data is loaded from Firestore
   - Associated images are loaded from Storage
   - Images are displayed in the UI

## 7. Best Practices

1. Image Optimization:
   - Images are automatically compressed before upload
   - Maximum size is limited to 5MB
   - Only image files are allowed

2. Security:
   - Each user can only access their own images
   - Images are stored in user-specific folders
   - File types are restricted to images

3. Performance:
   - Images are loaded on demand
   - Base64 conversion is done client-side
   - Storage rules prevent unauthorized access

## 8. Troubleshooting

Common issues and solutions:

1. "Permission Denied" errors:
   - Check if user is authenticated
   - Verify storage rules are correct
   - Ensure user ID matches folder structure

2. "File too large" errors:
   - Check if image is under 5MB
   - Consider compressing image before upload
   - Verify storage rules size limit

3. "Invalid file type" errors:
   - Ensure file is an image
   - Check file extension
   - Verify content type is correct

## 9. Maintenance

Regular maintenance tasks:

1. Monitor storage usage:
   - Check storage usage in Firebase Console
   - Set up alerts for high usage
   - Consider implementing cleanup for unused images

2. Update security rules:
   - Review rules periodically
   - Update based on new requirements
   - Test rules thoroughly

3. Backup strategy:
   - Consider implementing image backup
   - Set up versioning if needed
   - Document recovery procedures 