import { configureStore } from '@reduxjs/toolkit';
import mapReducer from '../features/mapSlice';

export const store = configureStore({
  reducer: {
    map: mapReducer,
  },
  // Add middleware or other store enhancers here if needed
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 