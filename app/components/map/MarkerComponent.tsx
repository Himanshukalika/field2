'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, 
  faCheck, 
  faEdit,
  faTrash,
  faPlus,
  faUndo,
  faRedo,
  faSave
} from '@fortawesome/free-solid-svg-icons';
import { MarkerData, PolygonPoint } from './types';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  doc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface MarkerComponentProps {
  map: google.maps.Map | null;
  isActive: boolean;
  onExit: () => void;
  onPositionUpdate?: (position: {lat: number, lng: number}) => void;
}

// Defining a default marker path that doesn't require google API
const MARKER_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

const MarkerComponent: React.FC<MarkerComponentProps> = ({ map, isActive, onExit, onPositionUpdate }) => {
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<google.maps.Marker | null>(null);
  const [markerLabels, setMarkerLabels] = useState<Record<string, string>>({});
  const [labelEditMode, setLabelEditMode] = useState<boolean>(false);
  const [currentLabel, setCurrentLabel] = useState<string>('');
  const [undoStack, setUndoStack] = useState<google.maps.Marker[][]>([]);
  const [redoStack, setRedoStack] = useState<google.maps.Marker[][]>([]);
  const [markerPosition, setMarkerPosition] = useState<{lat: number, lng: number} | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const mapClickListener = useRef<google.maps.MapsEventListener | null>(null);
  const editLabelInputRef = useRef<HTMLInputElement>(null);

  // Create default marker icon when google API is available
  const getDefaultMarkerIcon = useCallback(() => {
    if (!window.google || !map) return null;
    
    return {
      path: MARKER_PATH,
      fillColor: '#F44336',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: 2,
      anchor: new google.maps.Point(12, 22)
    };
  }, [map]);

  // Function to generate a unique ID for each marker
  const generateMarkerId = useCallback(() => {
    return `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Load markers from Firebase on initial render
  useEffect(() => {
    if (!map || !isActive || !window.google) {
      console.log('Map load conditions not met:', { mapExists: !!map, isActive, googleExists: !!window.google });
      return;
    }
    
    const loadMarkersFromFirebase = async () => {
      console.log('Starting to load markers from Firebase');
      try {
        // Check if user is logged in
        if (!auth.currentUser) {
          console.log('Waiting for authentication...');
          
          // Add auth state change listener to load markers once user is authenticated
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
              console.log('User authenticated, loading markers now');
              unsubscribe(); // Unsubscribe to avoid multiple calls
              loadMarkers(user.uid);
            }
          });
          
          return;
        } else {
          // User is already logged in
          console.log('User already authenticated, loading markers directly');
          await loadMarkers(auth.currentUser.uid);
        }
      } catch (error) {
        console.error('Error in marker loading process:', error);
        toast.error('Failed to load markers');
      }
    };
    
    // Function to actually load markers once we have the user ID
    const loadMarkers = async (userId: string) => {
      console.log('Loading markers for user ID:', userId);
      
      try {
        if (!map || !window.google) {
          console.error('Map not available when loading markers');
          return;
        }
        
        const markersQuery = query(
          collection(db, 'markers'), 
          where('userId', '==', userId)
        );
        
        console.log('Executing Firestore query for markers...');
        const querySnapshot = await getDocs(markersQuery);
        console.log(`Found ${querySnapshot.size} markers in Firebase`);
        
        if (querySnapshot.empty) {
          console.log('No markers found for this user');
          return;
        }
        
        // Create markers from saved data
        const loadedMarkers: google.maps.Marker[] = [];
        const loadedLabels: Record<string, string> = {};
        
        querySnapshot.forEach((docSnapshot) => {
          console.log('Processing marker document:', docSnapshot.id);
          
          if (!map || !window.google) return;
          
          const markerData = docSnapshot.data() as MarkerData & { userId: string };
          console.log('Marker data:', JSON.stringify(markerData));
          
          const defaultIcon = getDefaultMarkerIcon();
          if (!defaultIcon) {
            console.error('Default icon not available');
            return;
          }
          
          // Create marker with correct position
          if (!markerData.position || typeof markerData.position.lat !== 'number' || typeof markerData.position.lng !== 'number') {
            console.error('Invalid marker position:', markerData.position);
            return;
          }
          
          console.log(`Creating marker at position: ${markerData.position.lat}, ${markerData.position.lng}`);
          const markerPosition = new google.maps.LatLng(markerData.position.lat, markerData.position.lng);
          
          // Create marker
          const marker = new google.maps.Marker({
            position: markerPosition,
            map: map,
            draggable: true,
            icon: {
              ...defaultIcon,
              fillColor: markerData.color || defaultIcon.fillColor
            },
            zIndex: 1000
          });
          
          console.log('Marker created and added to map');
          
          // Store marker ID and Firebase document ID
          marker.set('markerId', markerData.id);
          marker.set('firebaseId', docSnapshot.id);
          
          // Add click listener
          marker.addListener('click', () => {
            setSelectedMarker(marker);
            if (markerData.label) {
              setCurrentLabel(markerData.label);
            }
          });
          
          // Add dragend listener
          marker.addListener('dragend', () => {
            // We'll save this marker to Firebase after dragging
            const firebaseId = marker.get('firebaseId');
            const position = marker.getPosition();
            const markerId = marker.get('markerId');
            if (position && firebaseId && markerId) {
              // Use a simpler approach to avoid circular dependencies
              updateDoc(doc(db, 'markers', firebaseId.toString()), {
                position: { lat: position.lat(), lng: position.lng() },
                updatedAt: serverTimestamp()
              }).catch(err => console.error('Error updating marker position:', err));
            }
          });
          
          // Store label
          if (markerData.label) {
            loadedLabels[markerData.id] = markerData.label;
          }
          
          loadedMarkers.push(marker);
        });
        
        console.log(`Successfully created ${loadedMarkers.length} markers on the map`);
        
        if (loadedMarkers.length > 0) {
          setMarkers(loadedMarkers);
          setMarkerLabels(loadedLabels);
          
          // Center the map on the first marker if needed
          const firstMarker = loadedMarkers[0];
          const position = firstMarker.getPosition();
          if (position && map) {
            console.log('Centering map on first marker');
            // Optional: Center on first marker
            // map.setCenter(position);
          }
          
          // Force redraw of markers
          loadedMarkers.forEach(marker => {
            const position = marker.getPosition();
            if (position) {
              console.log('Refreshing marker position');
              marker.setPosition(position);
            }
          });
        }
      } catch (error) {
        console.error('Error loading markers from Firebase:', error);
        toast.error('Failed to load markers');
      }
    };
    
    loadMarkersFromFirebase();
    
    // Cleanup function
    return () => {
      console.log('Cleaning up marker loading effect');
    };
  }, [map, isActive, getDefaultMarkerIcon]);

  // Function to save a marker to Firebase
  const saveMarkerToFirebase = async (marker: google.maps.Marker) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        toast.error('You must be logged in to save markers');
        return;
      }
      
      const position = marker.getPosition();
      if (!position) return;
      
      const markerId = marker.get('markerId');
      const icon = marker.getIcon() as google.maps.Symbol;
      
      const color = (icon && typeof icon !== 'string' && icon.fillColor) 
        ? String(icon.fillColor) 
        : undefined;
      
      // Create marker data ensuring no undefined values
      const markerData: MarkerData & { userId: string, createdAt: any } = {
        id: markerId,
        position: { lat: position.lat(), lng: position.lng() },
        label: markerLabels[markerId] || '', // Use empty string instead of undefined
        color: color || '#F44336', // Use default color instead of undefined
        userId: userId,
        createdAt: serverTimestamp()
      };
      
      // Save to Firebase
      const docRef = await addDoc(collection(db, 'markers'), markerData);
      
      // Store Firebase document ID with the marker
      marker.set('firebaseId', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error saving marker to Firebase:', error);
      toast.error('Failed to save marker');
      return null;
    }
  };

  // Function to update a marker in Firebase
  const updateMarkerInFirebase = async (marker: google.maps.Marker) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      const firebaseId = marker.get('firebaseId');
      if (!firebaseId) {
        // If no Firebase ID, this is a new marker, save it
        return await saveMarkerToFirebase(marker);
      }
      
      const position = marker.getPosition();
      if (!position) return;
      
      const markerId = marker.get('markerId');
      const icon = marker.getIcon() as google.maps.Symbol;
      
      const color = (icon && typeof icon !== 'string' && icon.fillColor) 
        ? String(icon.fillColor) 
        : '#F44336'; // Default color
      
      // Ensure no undefined values
      const markerData = {
        position: { lat: position.lat(), lng: position.lng() },
        label: markerLabels[markerId] || '', // Empty string instead of null/undefined
        color: color,
        updatedAt: serverTimestamp()
      };
      
      // Update in Firebase
      await updateDoc(doc(db, 'markers', firebaseId), markerData);
    } catch (error) {
      console.error('Error updating marker in Firebase:', error);
      toast.error('Failed to update marker');
    }
  };

  // Function to delete a marker from Firebase
  const deleteMarkerFromFirebase = async (marker: google.maps.Marker) => {
    try {
      const firebaseId = marker.get('firebaseId');
      if (!firebaseId) return;
      
      // Delete from Firebase
      await deleteDoc(doc(db, 'markers', firebaseId));
    } catch (error) {
      console.error('Error deleting marker from Firebase:', error);
      toast.error('Failed to delete marker');
    }
  };

  // Modify addMarker to save to Firebase
  const addMarker = useCallback((position: google.maps.LatLng) => {
    if (!map || !window.google) return;
    
    const defaultIcon = getDefaultMarkerIcon();
    if (!defaultIcon) return;
    
    // Save current state to undo stack
    if (markers.length > 0) {
      setUndoStack(prev => [...prev, [...markers]]);
      setRedoStack([]);
    }
    
    // Save the position for the next app start
    if (onPositionUpdate && position) {
      onPositionUpdate({
        lat: position.lat(),
        lng: position.lng()
      });
    }
    
    const markerId = generateMarkerId();
    const marker = new google.maps.Marker({
      position,
      map,
      draggable: true,
      icon: defaultIcon,
      zIndex: 1000
    });
    
    // Store the marker ID with the marker
    marker.set('markerId', markerId);
    
    // Add default label
    const newLabel = `Marker ${markers.length + 1}`;
    setMarkerLabels(prev => ({
      ...prev,
      [markerId]: newLabel
    }));
    
    // Add click listener to select this marker
    marker.addListener('click', () => {
      setSelectedMarker(marker);
      const markerId = marker.get('markerId');
      if (markerId && markerLabels[markerId]) {
        setCurrentLabel(markerLabels[markerId]);
      }
    });
    
    // Add dragend listener to update label position
    marker.addListener('dragend', () => {
      // Save state for undo
      setUndoStack(prev => [...prev, [...markers]]);
      setRedoStack([]);
      
      // Update in Firebase
      updateMarkerInFirebase(marker);
    });
    
    const newMarkers = [...markers, marker];
    setMarkers(newMarkers);
    
    // Save to Firebase
    saveMarkerToFirebase(marker);
    
    // Select the newly created marker
    setSelectedMarker(marker);
    setCurrentLabel(newLabel);
  }, [map, markers, generateMarkerId, markerLabels, saveMarkerToFirebase, getDefaultMarkerIcon, updateMarkerInFirebase, onPositionUpdate]);

  // Modify handleDeleteMarker to update Firebase
  const handleDeleteMarker = useCallback(() => {
    if (!selectedMarker) return;
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, [...markers]]);
    setRedoStack([]);
    
    // Delete from Firebase
    deleteMarkerFromFirebase(selectedMarker);
    
    // Get the marker ID
    const markerId = selectedMarker.get('markerId');
    
    // Remove the marker from the map
    selectedMarker.setMap(null);
    
    // Remove from our state
    const newMarkers = markers.filter(marker => marker !== selectedMarker);
    setMarkers(newMarkers);
    
    // Remove the label if it exists
    if (markerId) {
      setMarkerLabels(prev => {
        const newLabels = { ...prev };
        delete newLabels[markerId];
        return newLabels;
      });
    }
    
    // Clear selection
    setSelectedMarker(null);
    setCurrentLabel('');
  }, [selectedMarker, markers, deleteMarkerFromFirebase]);

  // Modify handleSaveLabel to update Firebase
  const handleSaveLabel = useCallback(() => {
    if (!selectedMarker) return;
    
    const markerId = selectedMarker.get('markerId');
    if (markerId) {
      setMarkerLabels(prev => {
        const newLabels = {
          ...prev,
          [markerId]: currentLabel
        };
        
        // Update in Firebase
        updateMarkerInFirebase(selectedMarker);
        
        return newLabels;
      });
    }
    
    setLabelEditMode(false);
  }, [selectedMarker, currentLabel, updateMarkerInFirebase]);

  // Function to enter label edit mode
  const handleEditLabel = useCallback(() => {
    if (!selectedMarker) return;
    setLabelEditMode(true);
    
    // Focus the input field after a short delay
    setTimeout(() => {
      if (editLabelInputRef.current) {
        editLabelInputRef.current.focus();
      }
    }, 100);
  }, [selectedMarker]);

  // Function to handle undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !map || !window.google) return;
    
    const defaultIcon = getDefaultMarkerIcon();
    if (!defaultIcon) return;
    
    // Get the previous state
    const prevMarkers = undoStack[undoStack.length - 1];
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, [...markers]]);
    
    // Remove all current markers from the map
    markers.forEach(marker => marker.setMap(null));
    
    // Restore the previous markers
    const restoredMarkers: google.maps.Marker[] = [];
    prevMarkers.forEach(prevMarker => {
      if (!map) return;
      
      const position = prevMarker.getPosition();
      if (!position) return;
      
      const markerId = prevMarker.get('markerId');
      if (!markerId) return;
      
      // Create new marker
      const marker = new google.maps.Marker({
        position,
        map,
        draggable: true,
        icon: defaultIcon,
        zIndex: 1000
      });
      
      // Store the marker ID with the marker
      marker.set('markerId', markerId);
      
      // Add click listener to select this marker
      marker.addListener('click', () => {
        setSelectedMarker(marker);
        if (markerId && markerLabels[markerId]) {
          setCurrentLabel(markerLabels[markerId]);
        }
      });
      
      // Add dragend listener
      marker.addListener('dragend', () => {
        setUndoStack(prev => [...prev, [...restoredMarkers]]);
        setRedoStack([]);
        
        // Update in Firebase
        updateMarkerInFirebase(marker);
      });
      
      restoredMarkers.push(marker);
    });
    
    // Update markers state
    setMarkers(restoredMarkers);
    
    // Update undo stack
    setUndoStack(prev => prev.slice(0, -1));
    
    // Clear selection
    setSelectedMarker(null);
    setCurrentLabel('');
  }, [undoStack, markers, map, markerLabels, getDefaultMarkerIcon, updateMarkerInFirebase]);

  // Function to handle redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !map || !window.google) return;
    
    const defaultIcon = getDefaultMarkerIcon();
    if (!defaultIcon) return;
    
    // Get the next state
    const nextMarkers = redoStack[redoStack.length - 1];
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, [...markers]]);
    
    // Remove all current markers from the map
    markers.forEach(marker => marker.setMap(null));
    
    // Restore the next markers
    const restoredMarkers: google.maps.Marker[] = [];
    nextMarkers.forEach(nextMarker => {
      if (!map) return;
      
      const position = nextMarker.getPosition();
      if (!position) return;
      
      const markerId = nextMarker.get('markerId');
      if (!markerId) return;
      
      // Create new marker
      const marker = new google.maps.Marker({
        position,
        map,
        draggable: true,
        icon: defaultIcon,
        zIndex: 1000
      });
      
      // Store the marker ID with the marker
      marker.set('markerId', markerId);
      
      // Add click listener to select this marker
      marker.addListener('click', () => {
        setSelectedMarker(marker);
        if (markerId && markerLabels[markerId]) {
          setCurrentLabel(markerLabels[markerId]);
        }
      });
      
      // Add dragend listener
      marker.addListener('dragend', () => {
        setUndoStack(prev => [...prev, [...restoredMarkers]]);
        setRedoStack([]);
        
        // Update in Firebase
        updateMarkerInFirebase(marker);
      });
      
      restoredMarkers.push(marker);
    });
    
    // Update markers state
    setMarkers(restoredMarkers);
    
    // Update redo stack
    setRedoStack(prev => prev.slice(0, -1));
    
    // Clear selection
    setSelectedMarker(null);
    setCurrentLabel('');
  }, [redoStack, markers, map, markerLabels, getDefaultMarkerIcon, updateMarkerInFirebase]);

  // Modify handleColorChange to update Firebase
  const handleColorChange = useCallback((color: string) => {
    if (!selectedMarker || !window.google) return;
    
    // Update the icon color
    const currentIcon = selectedMarker.getIcon() as google.maps.Symbol;
    if (currentIcon && typeof currentIcon !== 'string') {
      const newIcon = {
        ...currentIcon,
        fillColor: color
      };
      selectedMarker.setIcon(newIcon);
    }
    
    // Save marker state for undo
    setUndoStack(prev => [...prev, [...markers]]);
    setRedoStack([]);
    
    // Update in Firebase
    updateMarkerInFirebase(selectedMarker);
  }, [selectedMarker, markers, updateMarkerInFirebase]);

  // Function to save all markers
  const saveAllMarkers = useCallback(async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to save markers');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save each marker
      for (const marker of markers) {
        await updateMarkerInFirebase(marker);
      }
      
      toast.success('All markers saved successfully');
    } catch (error) {
      console.error('Error saving markers:', error);
      toast.error('Failed to save markers');
    } finally {
      setIsSaving(false);
    }
  }, [markers, updateMarkerInFirebase]);

  // When marker mode is exited, make sure markers are saved
  const handleExit = useCallback(() => {
    // Save all markers to Firebase before exiting
    if (markers.length > 0) {
      saveAllMarkers();
    }
    
    // Disable click listener
    if (mapClickListener.current) {
      google.maps.event.removeListener(mapClickListener.current);
      mapClickListener.current = null;
    }
    
    // Deselect any selected marker
    setSelectedMarker(null);
    setLabelEditMode(false);
    
    // Exit marker mode
    onExit();
  }, [onExit, markers, saveAllMarkers]);

  // Initialize marker mode
  useEffect(() => {
    if (isActive && map && window.google) {
      // Add click listener to the map to add markers
      mapClickListener.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        addMarker(e.latLng);
      });
      
      // Update cursor style
      map.setOptions({
        draggableCursor: 'crosshair'
      });
    }
    
    return () => {
      // Clean up listener when component is unmounted or deactivated
      if (mapClickListener.current) {
        google.maps.event.removeListener(mapClickListener.current);
        mapClickListener.current = null;
      }
      
      // Reset cursor style
      if (map) {
        map.setOptions({
          draggableCursor: 'grab'
        });
      }
    };
  }, [isActive, map, addMarker]);

  // Function to update the selected marker position
  const updateMarkerPosition = useCallback(() => {
    if (!selectedMarker) {
      setMarkerPosition(null);
      return;
    }
    
    const position = selectedMarker.getPosition();
    if (position) {
      setMarkerPosition({
        lat: position.lat(),
        lng: position.lng()
      });
    } else {
      setMarkerPosition(null);
    }
  }, [selectedMarker]);

  // Update position when selected marker changes or is dragged
  useEffect(() => {
    updateMarkerPosition();

    if (selectedMarker && window.google) {
      const dragListener = selectedMarker.addListener('drag', updateMarkerPosition);
      
      return () => {
        if (window.google) {
          google.maps.event.removeListener(dragListener);
        }
      };
    }
  }, [selectedMarker, updateMarkerPosition]);

  // Create and display labels for markers directly on map
  useEffect(() => {
    if (!map || !window.google) return;
    
    // Clean up previous labels first
    const oldLabels = document.querySelectorAll('.marker-name-label');
    oldLabels.forEach(label => {
      label.parentElement?.removeChild(label);
    });
    
    // Create a custom overlay class for marker labels
    class MarkerLabelOverlay extends google.maps.OverlayView {
      private position: google.maps.LatLng;
      private content: string;
      private div: HTMLDivElement | null = null;
      
      constructor(position: google.maps.LatLng, content: string) {
        super();
        this.position = position;
        this.content = content;
        this.setMap(map);
      }
      
      onAdd() {
        // Create the label div
        const div = document.createElement('div');
        div.className = 'marker-name-label';
        div.style.position = 'absolute';
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        div.style.border = '1px solid #ccc';
        div.style.borderRadius = '3px';
        div.style.padding = '2px 5px';
        div.style.fontSize = '12px';
        div.style.fontWeight = 'bold';
        div.style.color = '#333';
        div.style.transform = 'translate(-50%, -130%)';
        div.style.pointerEvents = 'none';
        div.style.whiteSpace = 'nowrap';
        div.style.zIndex = '1000';
        div.style.textAlign = 'center';
        div.textContent = this.content;
        
        this.div = div;
        
        // Add the div to the overlay pane
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(div);
      }
      
      draw() {
        if (!this.div) return;
        
        // Position the div relative to the marker
        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(this.position);
        
        if (position) {
          // Position above the marker
          this.div.style.left = `${position.x}px`;
          this.div.style.top = `${position.y - 25}px`; // Position above the marker
        }
      }
      
      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }
    }
    
    // Create labels for each marker
    markers.forEach(marker => {
      const markerId = marker.get('markerId');
      if (!markerId || !markerLabels[markerId]) return;
      
      const position = marker.getPosition();
      if (!position) return;
      
      // Create and display label overlay
      new MarkerLabelOverlay(position, markerLabels[markerId]);
      
      // Update label position when marker is dragged
      marker.addListener('drag', () => {
        // Force a redraw of all labels by triggering a resize event
        const event = new Event('resize');
        window.dispatchEvent(event);
      });
    });
    
    // Add resize listener to redraw labels when map pans/zooms
    const resizeListener = window.addEventListener('resize', () => {
      // This forces redraw of all overlays
    });
    
    return () => {
      // Clean up listener
      window.removeEventListener('resize', resizeListener as unknown as EventListener);
      
      // Clean up labels
      const labels = document.querySelectorAll('.marker-name-label');
      labels.forEach(label => {
        label.parentElement?.removeChild(label);
      });
    };
  }, [map, markers, markerLabels]);

  if (!isActive) return null;

  return (
    <>
      {/* Header banner with title and controls */}
      <div className="fixed top-0 left-0 right-0 bg-yellow-500 z-50 h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExit}
            className="text-white"
          >
            <FontAwesomeIcon icon={faTimes} className="text-white" />
          </button>
          <h3 className="font-semibold text-white">Marker Mode</h3>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={saveAllMarkers}
            className="text-white font-bold"
            disabled={isSaving}
          >
            {isSaving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>
      
      {/* Position information panel */}
      <div className="fixed top-12 left-0 right-0 bg-black/50 z-50 h-8 flex items-center justify-center px-4 text-white text-sm">
        {markerPosition ? (
          <>
            <span className="mx-2">Latitude: {markerPosition.lat.toFixed(6)}</span>
            <span className="mx-2">Longitude: {markerPosition.lng.toFixed(6)}</span>
          </>
        ) : (
          <span>No marker selected</span>
        )}
      </div>
      
      {/* Marker controls when a marker is selected */}
      {selectedMarker && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-lg z-50 p-3 flex flex-col items-center shadow-lg">
          {labelEditMode ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                ref={editLabelInputRef}
                type="text"
                value={currentLabel}
                onChange={(e) => setCurrentLabel(e.target.value)}
                className="px-2 py-1 rounded-md border border-gray-300 text-black text-sm w-32"
                placeholder="Enter label"
              />
              <button
                onClick={handleSaveLabel}
                className="bg-green-500 p-2 rounded-full"
              >
                <FontAwesomeIcon icon={faCheck} className="text-white text-sm" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white text-sm">
                {selectedMarker.get('markerId') && markerLabels[selectedMarker.get('markerId')] 
                  ? markerLabels[selectedMarker.get('markerId')] 
                  : 'Marker'}
              </span>
              <button
                onClick={handleEditLabel}
                className="bg-blue-500 p-2 rounded-full"
              >
                <FontAwesomeIcon icon={faEdit} className="text-white text-sm" />
              </button>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* Color options */}
            <div className="flex gap-1">
              <button
                onClick={() => handleColorChange('#F44336')} // Red
                className="w-6 h-6 rounded-full bg-red-500 border-2 border-white"
              />
              <button
                onClick={() => handleColorChange('#4CAF50')} // Green
                className="w-6 h-6 rounded-full bg-green-500 border-2 border-white"
              />
              <button
                onClick={() => handleColorChange('#2196F3')} // Blue
                className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white"
              />
              <button
                onClick={() => handleColorChange('#FFC107')} // Yellow
                className="w-6 h-6 rounded-full bg-yellow-500 border-2 border-white"
              />
              <button
                onClick={() => handleColorChange('#9C27B0')} // Purple
                className="w-6 h-6 rounded-full bg-purple-500 border-2 border-white"
              />
            </div>
            
            {/* Delete button */}
            <button
              onClick={handleDeleteMarker}
              className="bg-red-500 p-2 rounded-full ml-2"
            >
              <FontAwesomeIcon icon={faTrash} className="text-white text-sm" />
            </button>
          </div>
        </div>
      )}
      
      {/* Undo/Redo controls */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 rounded-full z-50 p-2 flex items-center gap-2 shadow-lg">
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className={`p-2 rounded-full ${
            undoStack.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-500 text-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faUndo} className="text-sm" />
        </button>
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className={`p-2 rounded-full ${
            redoStack.length > 0 ? 'bg-blue-500 text-white' : 'bg-gray-500 text-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faRedo} className="text-sm" />
        </button>
      </div>
    </>
  );
};

export default MarkerComponent;

// Global type definition for the window object
declare global {
  interface Window {
    google: typeof google;
  }
} 