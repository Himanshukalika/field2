declare module 'clsx' {
  export type ClassValue = string | number | boolean | null | undefined | Record<string, any> | ClassValue[];
  export function clsx(...inputs: ClassValue[]): string;
}

declare module 'tailwind-merge' {
  export function twMerge(...inputs: string[]): string;
} 