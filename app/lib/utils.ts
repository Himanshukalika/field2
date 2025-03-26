import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Use any[] instead of ClassValue[] to avoid type issues
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 