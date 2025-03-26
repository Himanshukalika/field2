import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store/store';

// Define types for your state
export interface MapState {
  mapType: 'hybrid' | 'satellite' | 'roadmap' | 'terrain';
  isFullscreen: boolean;
  isDrawingMode: boolean;
  showCreateMenu: boolean;
  isLocating: boolean;
  totalArea: number;
  canUndo: boolean;
  canRedo: boolean;
  selectedOption: 'import' | 'field' | 'distance' | 'marker' | null;
}

// Define initial state
const initialState: MapState = {
  mapType: 'hybrid',
  isFullscreen: false,
  isDrawingMode: false,
  showCreateMenu: false,
  isLocating: false,
  totalArea: 0,
  canUndo: false,
  canRedo: false,
  selectedOption: null,
};

// Create the slice
export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setMapType: (state, action: PayloadAction<'hybrid' | 'satellite' | 'roadmap' | 'terrain'>) => {
      state.mapType = action.payload;
    },
    toggleFullscreen: (state) => {
      state.isFullscreen = !state.isFullscreen;
    },
    setDrawingMode: (state, action: PayloadAction<boolean>) => {
      state.isDrawingMode = action.payload;
    },
    toggleCreateMenu: (state) => {
      state.showCreateMenu = !state.showCreateMenu;
    },
    setCreateMenu: (state, action: PayloadAction<boolean>) => {
      state.showCreateMenu = action.payload;
    },
    setIsLocating: (state, action: PayloadAction<boolean>) => {
      state.isLocating = action.payload;
    },
    updateTotalArea: (state, action: PayloadAction<number>) => {
      state.totalArea = action.payload;
    },
    setCanUndo: (state, action: PayloadAction<boolean>) => {
      state.canUndo = action.payload;
    },
    setCanRedo: (state, action: PayloadAction<boolean>) => {
      state.canRedo = action.payload;
    },
    selectCreateMenuOption: (state, action: PayloadAction<'import' | 'field' | 'distance' | 'marker'>) => {
      // FIRST: Always ensure the menu is closed immediately
      state.showCreateMenu = false;
      
      // THEN: Set the selected option and handle specific behaviors
      state.selectedOption = action.payload;
      
      if (action.payload === 'field') {
        state.isDrawingMode = true;
      }
    },
  },
});

// Export actions
export const {
  setMapType,
  toggleFullscreen,
  setDrawingMode,
  toggleCreateMenu,
  setCreateMenu,
  setIsLocating,
  updateTotalArea,
  setCanUndo,
  setCanRedo,
  selectCreateMenuOption,
} = mapSlice.actions;

// Export selectors
export const selectMapType = (state: RootState) => state.map.mapType;
export const selectIsFullscreen = (state: RootState) => state.map.isFullscreen;
export const selectIsDrawingMode = (state: RootState) => state.map.isDrawingMode;
export const selectShowCreateMenu = (state: RootState) => state.map.showCreateMenu;
export const selectIsLocating = (state: RootState) => state.map.isLocating;
export const selectTotalArea = (state: RootState) => state.map.totalArea;
export const selectCanUndo = (state: RootState) => state.map.canUndo;
export const selectCanRedo = (state: RootState) => state.map.canRedo;
export const selectSelectedOption = (state: RootState) => state.map.selectedOption;

// Export reducer
export default mapSlice.reducer; 