#!/usr/bin/env node

/**
 * This script checks if all required Firebase environment variables are set.
 * Run it before deploying to Vercel to ensure your config is complete.
 * 
 * Usage: node verify-env.js
 */

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
];

// Get environment variables from .env.local file
require('dotenv').config({ path: '.env.local' });

console.log('Checking environment variables for Vercel deployment...\n');

let missingVars = [];

// Check each required variable
requiredVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.error(`❌ Missing: ${varName}`);
  } else {
    // Print obscured value for sensitive variables
    const value = process.env[varName];
    const obscuredValue = value.substring(0, 3) + '...' + value.substring(value.length - 3);
    console.log(`✅ Found: ${varName} (${obscuredValue})`);
  }
});

// Summary
console.log('\n--- Summary ---');
if (missingVars.length > 0) {
  console.error(`❌ Missing ${missingVars.length} required variables for Vercel deployment.`);
  console.error('Please add these variables to your Vercel project settings:');
  missingVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
  console.error('\nSee VERCEL_DEPLOYMENT.md for detailed instructions.');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
  console.log('Make sure you add all these variables to your Vercel project settings.');
  console.log('See VERCEL_DEPLOYMENT.md for detailed instructions.');
} 