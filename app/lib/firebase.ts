// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp,
  addDoc,
  FirestoreError,
  DocumentData
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Field } from '../components/map/types';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Check if Firebase config is properly defined
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`Firebase config missing required variables: ${missingVars.join(', ')}`);
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    // Add more detailed error logging
    if (error.code === 'auth/configuration-not-found') {
      console.error('Firebase configuration error: Make sure environment variables are set correctly on Vercel');
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error('Unauthorized domain: Add your app domain to Firebase authorized domains');
    }
    throw error;
  }
};

// Sign out
export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// Current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Interface for field data to be stored in Firestore
export interface FieldData extends Field {
  userId: string;
  createdAt: any;
  updatedAt: any;
  name: string;
  color: string;
  strokeColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldImages?: string[];
  mainImageIndex?: number;
}

// Function to check if Firestore rules are properly set
export const checkFirestorePermissions = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    // Try to read from the fields collection
    const fieldsCollection = collection(db, 'fields');
    const dummyQuery = query(fieldsCollection, where('userId', '==', user.uid));
    await getDocs(dummyQuery);
    
    return true;
  } catch (error: any) {
    console.error('Firestore permission check failed:', error);
    return false;
  }
};

// Save field data to Firestore (with fallback to local storage if permissions fail)
export const saveField = async (fieldData: Omit<FieldData, 'userId' | 'createdAt' | 'updatedAt'>) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to save field data');
    }

    const fieldsCollection = collection(db, 'fields');
    
    const now = serverTimestamp();
    const data: FieldData = {
      ...fieldData,
      userId: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    
    // For new fields where we don't have a doc reference
    // Use addDoc instead which lets Firestore generate the ID
    let fieldId = fieldData.id;
    if (!fieldId || fieldId.trim() === '') {
      const docRef = await addDoc(fieldsCollection, data);
      fieldId = docRef.id;
      data.id = fieldId;
    } else {
      // We have an existing ID, so use setDoc with that specific ID
      const fieldRef = doc(fieldsCollection, fieldId);
      await setDoc(fieldRef, data);
    }
    
    // Also save to localStorage as a fallback
    saveFieldToLocalStorage(data);
    
    return fieldId;
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn('Firestore permission error. Falling back to localStorage:', error);
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User must be logged in to save field data');
      }
      
      const now = new Date().toISOString();
      const data: FieldData = {
        ...fieldData,
        userId: user.uid,
        createdAt: now,
        updatedAt: now,
      };
      
      // Save to localStorage instead
      saveFieldToLocalStorage(data);
      return fieldData.id;
    } else {
      console.error('Error saving field data:', error);
      throw error;
    }
  }
};

// Get all fields for current user (with fallback to local storage if permissions fail)
export const getUserFields = async (): Promise<FieldData[]> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to get field data');
    }
    
    const fieldsCollection = collection(db, 'fields');
    const q = query(fieldsCollection, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    
    const fields: FieldData[] = [];
    querySnapshot.forEach((doc) => {
      fields.push(doc.data() as FieldData);
    });
    
    return fields;
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn('Firestore permission error. Falling back to localStorage:', error);
      return getFieldsFromLocalStorage();
    } else {
      console.error('Error getting user fields:', error);
      throw error;
    }
  }
};

// Get single field by ID (with fallback to local storage if permissions fail)
export const getFieldById = async (fieldId: string): Promise<FieldData | null> => {
  try {
    const fieldRef = doc(collection(db, 'fields'), fieldId);
    const fieldDoc = await getDoc(fieldRef);
    
    if (fieldDoc.exists()) {
      return fieldDoc.data() as FieldData;
    } else {
      return null;
    }
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn('Firestore permission error. Falling back to localStorage:', error);
      return getFieldFromLocalStorage(fieldId);
    } else {
      console.error('Error getting field by ID:', error);
      throw error;
    }
  }
};

// Delete field (with fallback to local storage if permissions fail)
export const deleteField = async (fieldId: string): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be logged in to delete field data');
    }
    
    const fieldRef = doc(collection(db, 'fields'), fieldId);
    // Verify ownership
    const fieldDoc = await getDoc(fieldRef);
    
    if (fieldDoc.exists() && fieldDoc.data().userId === user.uid) {
      await deleteDoc(fieldRef);
      
      // Also delete from localStorage
      deleteFieldFromLocalStorage(fieldId);
      
      return true;
    } else {
      throw new Error('Field not found or user does not have permission to delete');
    }
  } catch (error: any) {
    if (isPermissionError(error)) {
      console.warn('Firestore permission error. Falling back to localStorage:', error);
      return deleteFieldFromLocalStorage(fieldId);
    } else {
      console.error('Error deleting field:', error);
      throw error;
    }
  }
};

// Helper function to check if an error is a Firebase permission error
const isPermissionError = (error: any): boolean => {
  if (error && error.code === 'permission-denied') {
    return true;
  }
  
  if (error && error.message && (
    error.message.includes('Missing or insufficient permissions') || 
    error.message.includes('permission-denied')
  )) {
    return true;
  }
  
  return false;
};

// LocalStorage fallback functions
const FIELDS_STORAGE_KEY = 'field2_user_fields';

// Save field to localStorage
const saveFieldToLocalStorage = (fieldData: FieldData): void => {
  try {
    // Get existing fields
    const existingFields = getFieldsFromLocalStorage();
    
    // Find if this field already exists
    const existingIndex = existingFields.findIndex(field => field.id === fieldData.id);
    
    if (existingIndex !== -1) {
      // Update existing field
      existingFields[existingIndex] = fieldData;
    } else {
      // Add new field
      existingFields.push(fieldData);
    }
    
    // Save back to localStorage
    const user = auth.currentUser;
    if (user) {
      localStorage.setItem(`${FIELDS_STORAGE_KEY}_${user.uid}`, JSON.stringify(existingFields));
    }
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// Get all fields from localStorage
const getFieldsFromLocalStorage = (): FieldData[] => {
  try {
    const user = auth.currentUser;
    if (!user) return [];
    
    const fieldsJson = localStorage.getItem(`${FIELDS_STORAGE_KEY}_${user.uid}`);
    if (!fieldsJson) return [];
    
    return JSON.parse(fieldsJson) as FieldData[];
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
};

// Get a single field from localStorage
const getFieldFromLocalStorage = (fieldId: string): FieldData | null => {
  try {
    const fields = getFieldsFromLocalStorage();
    return fields.find(field => field.id === fieldId) || null;
  } catch (error) {
    console.error('Error reading field from localStorage:', error);
    return null;
  }
};

// Delete a field from localStorage
const deleteFieldFromLocalStorage = (fieldId: string): boolean => {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    const fields = getFieldsFromLocalStorage();
    const filteredFields = fields.filter(field => field.id !== fieldId);
    
    localStorage.setItem(`${FIELDS_STORAGE_KEY}_${user.uid}`, JSON.stringify(filteredFields));
    return true;
  } catch (error) {
    console.error('Error deleting field from localStorage:', error);
    return false;
  }
};

export { app, auth, db, storage }; 