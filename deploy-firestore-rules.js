/**
 * Script to help deploy Firestore rules
 * To use:
 * 1. Install the Firebase CLI: npm install -g firebase-tools
 * 2. Login to Firebase: firebase login
 * 3. Run this script: node deploy-firestore-rules.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Deploying Firestore Rules...');

// Make sure the files exist
if (!fs.existsSync('firestore.rules')) {
  console.error('firestore.rules file not found!');
  process.exit(1);
}

if (!fs.existsSync('firebase.json')) {
  console.error('firebase.json file not found!');
  process.exit(1);
}

try {
  // Execute the Firebase deploy command for just the Firestore rules
  execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
  
  console.log('\nFirestore rules deployed successfully!');
  console.log('\nIf you encounter a permission error in the app, follow these steps:');
  console.log('1. Go to the Firebase Console: https://console.firebase.google.com/');
  console.log('2. Select your project');
  console.log('3. Navigate to Firestore Database');
  console.log('4. Go to the Rules tab');
  console.log('5. Paste the following rules:');
  console.log(`
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /fields/{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }
  `);
  console.log('6. Click "Publish"');
  
} catch (error) {
  console.error('Error deploying Firestore rules:', error.message);
  console.log('\nYou can deploy the rules manually:');
  console.log('1. Go to the Firebase Console: https://console.firebase.google.com/');
  console.log('2. Select your project');
  console.log('3. Navigate to Firestore Database');
  console.log('4. Go to the Rules tab');
  console.log('5. Paste the following rules:');
  console.log(`
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /fields/{document=**} {
          allow read, write: if request.auth != null;
        }
      }
    }
  `);
  console.log('6. Click "Publish"');
} 