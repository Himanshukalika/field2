import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';

export const uploadFieldImage = async (
  file: File,
  userId: string,
  fieldId: string
): Promise<string> => {
  try {
    // Create a reference to the image location
    const storageRef = ref(storage, `users/${userId}/fields/${fieldId}/image.jpg`);
    
    // Upload the file
    await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

export const deleteFieldImage = async (userId: string, fieldId: string): Promise<void> => {
  try {
    const storageRef = ref(storage, `users/${userId}/fields/${fieldId}/image.jpg`);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
};

export const getFieldImageUrl = async (userId: string, fieldId: string): Promise<string | null> => {
  try {
    const storageRef = ref(storage, `users/${userId}/fields/${fieldId}/image.jpg`);
    return await getDownloadURL(storageRef);
  } catch (error) {
    // If the image doesn't exist, return null
    return null;
  }
}; 