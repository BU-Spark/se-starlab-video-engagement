/**
 * app/hooks/index.ts
 *
 * This file serves as a central export point for all custom hooks in this directory.
 * This allows for cleaner imports in other parts of the application.
 *
 * For example:
 * import { useLocalStorage, useAnotherHook } from '@/app/hooks';
 */

export { default as useLocalStorage } from './useLocalStorage';
// Add other hooks here as they are created, e.g.:
// export { default as useAuth } from './useAuth';
// export { default as useForm } from './useForm';
export { default as useBlockRunner } from './useBlockRunner';
export { default as useSwipe } from './useSwipe';
export type { SwipeDirection } from './useSwipe';
export { default as useKiosk } from './useKiosk';
