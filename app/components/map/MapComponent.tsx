'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Circle, DrawingManager, Polygon } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faFileImport, faDrawPolygon, faRuler, faMapMarker, faPlus, faUndo, faRedo, faEdit, faCheck, faCog, faClose, faTimes } from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';
import PolygonToolsMenu from './PolygonToolsMenu';
import { useAuth } from '@/app/context/AuthContext';
import { saveField, getUserFields, deleteField, checkFirestorePermissions } from '../../lib/firebase';
import { polygonToFieldData, fieldDataToPolygon, centerMapOnField } from '../../lib/mapUtils';
import { v4 as uuidv4 } from 'uuid';
import { uploadFieldImage, deleteFieldImage, getFieldImageUrl } from '@/app/lib/storage';
import DistanceMeasurement from './DistanceMeasurement';

// Local utility function for className merging
function cn(...classNames: (string | undefined)[]) {
  return classNames.filter(Boolean).join(' ');
}

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

const libraries: ("places" | "drawing" | "geometry")[] = ["places", "drawing", "geometry"];

const polygonColor = '#00C853'; // Bright green color
const polygonFillOpacity = 0.3;
const strokeColor = '#00C853';
const strokeWeight = 2;

const LOCATION_MARKER_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

const mapStyles = {
  container: {
    width: '100%',
    height: 'calc(100vh - 48px)',
    position: 'relative' as const
  },
  mapWithBanner: {
    width: '100%',
    height: 'calc(100vh - 96px)', // Account for both navbar and yellow banner (48px each)
    position: 'relative' as const
  },
  map: {
    width: '100%',
    height: '100%'
  }
};

const defaultCenter = {
  lat: 27.197777, 
  lng: 75.713098,
};

const MARKER_ROTATION = 180; // Rotation in degrees

interface MapComponentProps {
  onAreaUpdate?: (newArea: number) => void;
  onPolygonUpdate?: (updatedPolygons: any[]) => void;
  className?: string;
}

// Add definition for FieldImage interface
interface FieldImages {
  [fieldIndex: number]: {
    images: string[]; // Array of base64 image strings
    mainImageIndex: number;
  }
}

// Update the PolygonToolsMenu props interface
interface PolygonToolsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeStrokeColor: (color: string) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeWeight: (weight: number) => void;
  onChangeFillOpacity: (opacity: number) => void;
  onChangeName: (name: string) => void;
  onDelete: () => void;
  onAddImage: (file: File) => void;
  onDeleteImage: (imageIndex: number) => void;
  onSetMainImage: (imageIndex: number) => void;
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldName: string;
  fieldImages: string[];
  mainImageIndex: number;
  selectedPolygonIndex: number | null;
}

const MapComponent: React.FC<MapComponentProps> = ({ onAreaUpdate, onPolygonUpdate, className }) => {
  // Add authentication hook
  const { user, login } = useAuth();
  
  const [isClient, setIsClient] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Add states for polygon tools
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);
  const [showPolygonTools, setShowPolygonTools] = useState(false);
  const [polygonStyles, setPolygonStyles] = useState({
    strokeColor: strokeColor,
    fillColor: polygonColor,
    strokeWeight: strokeWeight,
    fillOpacity: polygonFillOpacity,
    fieldName: '',
  });
  
  // Add new state variables for drawing
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [fieldPolygons, setFieldPolygons] = useState<google.maps.Polygon[]>([]);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add a ref to track the currently active drag marker
  const activeVertexMarkerRef = useRef<google.maps.Marker | null>(null);

  // Create a ref to store the DistanceOverlay class
  const DistanceOverlayRef = useRef<any>(null);
  
  // Add states for undo/redo functionality
  const [undoStack, setUndoStack] = useState<google.maps.LatLng[][]>([]);
  const [redoStack, setRedoStack] = useState<google.maps.LatLng[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Add default marker scale state
  const [defaultMarkerScale, setDefaultMarkerScale] = useState(5.0);

  // Add new state for banner info
  const [bannerInfo, setBannerInfo] = useState({
    area: 0,
    perimeter: 0,
    vertices: 0
  });

  // Add state to track selected field area
  const [selectedFieldInfo, setSelectedFieldInfo] = useState<{area: number, perimeter: number, name: string} | null>(null);

  // Add state to track field images
  const [fieldImages, setFieldImages] = useState<FieldImages>({});

  // New state for save/load functionality
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [loadedFields, setLoadedFields] = useState<any[]>([]);

  // Add distance measurement state
  const [isMeasuringDistance, setIsMeasuringDistance] = useState(false);

  // ... existing code, add after undoStack initialization ...
  
  // Load user fields when component initializes and user is authenticated
  useEffect(() => {
    // Only load fields if user is authenticated and the map is ready
    // and there are no fields already loaded
    if (user && map && !isLoading && !isDrawingMode && fieldPolygons.length === 0) {
      const loadUserFields = async () => {
        try {
          // Load fields without showing any loading animation
          const fields = await getUserFields();
          
          if (fields && fields.length > 0) {
            // Automatically load all fields without asking the user
            // Convert and add each field to the map
            fields.forEach(fieldData => {
              const polygon = fieldDataToPolygon(fieldData, map);
              setFieldPolygons(prev => [...prev, polygon]);
            });
            
            // Set up a small delay to calculate the bounds
            setTimeout(() => {
              if (fields.length === 1) {
                // Center on the single field
                centerMapOnField(map, fields[0]);
              } else if (fields.length > 1) {
                // Create bounds to contain all fields
                const bounds = new google.maps.LatLngBounds();
                fields.forEach(field => {
                  field.points.forEach(point => {
                    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
                  });
                });
                map.fitBounds(bounds);
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error auto-loading fields:', error);
        }
      };
      
      loadUserFields();
    }
  }, [user, map, isLoading, isDrawingMode, fieldPolygons.length]);

  // Add a more direct function to update the banner
  const updateBannerInfo = useCallback(() => {
    if (!window.tempVerticesRef || window.tempVerticesRef.length < 2) {
      setBannerInfo({ area: 0, perimeter: 0, vertices: 0 });
      return;
    }

    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < window.tempVerticesRef.length; i++) {
      const p1 = window.tempVerticesRef[i];
      const p2 = window.tempVerticesRef[(i + 1) % window.tempVerticesRef.length];
      perimeter += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    }

    // Calculate area if we have at least 3 vertices
    let area = 0;
    if (window.tempVerticesRef.length >= 3) {
      area = google.maps.geometry.spherical.computeArea(window.tempVerticesRef);
    }

    setBannerInfo({
      area: area / 10000, // Convert to hectares
      perimeter: perimeter / 1000, // Convert to kilometers
      vertices: window.tempVerticesRef.length
    });
  }, []);

  // Update banner info when vertices change
  useEffect(() => {
    if (isDrawingMode && window.tempVerticesRef) {
      // Calculate perimeter
      let perimeter = 0;
      for (let i = 0; i < window.tempVerticesRef.length; i++) {
        const p1 = window.tempVerticesRef[i];
        const p2 = window.tempVerticesRef[(i + 1) % window.tempVerticesRef.length];
        perimeter += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
      }

      // Calculate area if we have at least 3 vertices
      let area = 0;
      if (window.tempVerticesRef.length >= 3) {
        area = google.maps.geometry.spherical.computeArea(window.tempVerticesRef);
      }

      setBannerInfo({
        area: area / 10000, // Convert to hectares
        perimeter: perimeter / 1000, // Convert to kilometers
        vertices: window.tempVerticesRef.length
      });
    } else {
      setBannerInfo({ area: 0, perimeter: 0, vertices: 0 });
    }
  }, [isDrawingMode, window.tempVerticesRef]);

  // Add effect to update banner info when vertices are dragged
  useEffect(() => {
    if (isDrawingMode && window.tempVerticesRef) {
      const updateBanner = () => {
        // Calculate perimeter
        let perimeter = 0;
        for (let i = 0; i < window.tempVerticesRef.length; i++) {
          const p1 = window.tempVerticesRef[i];
          const p2 = window.tempVerticesRef[(i + 1) % window.tempVerticesRef.length];
          perimeter += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        }

        // Calculate area if we have at least 3 vertices
        let area = 0;
        if (window.tempVerticesRef.length >= 3) {
          area = google.maps.geometry.spherical.computeArea(window.tempVerticesRef);
        }

        setBannerInfo({
          area: area / 10000, // Convert to hectares
          perimeter: perimeter / 1000, // Convert to kilometers
          vertices: window.tempVerticesRef.length
        });
      };

      // Add listeners to update banner when vertices change
      if (window.tempPolylineRef) {
        const path = window.tempPolylineRef.getPath();
        google.maps.event.addListener(path, 'set_at', updateBanner);
        google.maps.event.addListener(path, 'insert_at', updateBanner);
        google.maps.event.addListener(path, 'remove_at', updateBanner);
      }

      return () => {
        if (window.tempPolylineRef) {
          const path = window.tempPolylineRef.getPath();
          google.maps.event.clearListeners(path, 'set_at');
          google.maps.event.clearListeners(path, 'insert_at');
          google.maps.event.clearListeners(path, 'remove_at');
        }
      };
    }
  }, [isDrawingMode]);

  // Add effect to update banner info when polyline is updated (including during drag)
  useEffect(() => {
    if (!isDrawingMode || !map) return;

    // Define a listener to update on map events
    const updateMapListener = map.addListener('idle', updateBannerInfo);
    
    // Also update on drag events - these fire when markers are being dragged
    const dragStartListener = map.addListener('dragstart', updateBannerInfo);
    const dragListener = map.addListener('drag', updateBannerInfo);
    const dragEndListener = map.addListener('dragend', updateBannerInfo);
    
    // Add custom polyline listener
    let polylineUpdateInterval: NodeJS.Timeout | null = null;
    
    if (isDrawingMode) {
      // Check and update banner frequently during drawing mode (more frequent updates)
      polylineUpdateInterval = setInterval(() => {
        if (window.tempVerticesRef && window.tempVerticesRef.length > 0) {
          updateBannerInfo();
        }
      }, 50); // Update every 50ms for smoother updates
    }
    
    return () => {
      google.maps.event.removeListener(updateMapListener);
      google.maps.event.removeListener(dragStartListener);
      google.maps.event.removeListener(dragListener);
      google.maps.event.removeListener(dragEndListener);
      if (polylineUpdateInterval) {
        clearInterval(polylineUpdateInterval);
      }
    };
  }, [isDrawingMode, map, updateBannerInfo]);

  // Add a function to clear all red markers - moved up to avoid reference before declaration
  const clearAllRedMarkers = useCallback(() => {
    // Reset active vertex reference first
    if (activeVertexMarkerRef.current) {
      const dragMarker = activeVertexMarkerRef.current.get('dragMarker');
      if (dragMarker) {
        dragMarker.setMap(null);
        activeVertexMarkerRef.current.set('dragMarker', null);
        activeVertexMarkerRef.current.setOpacity(1);
      }
      activeVertexMarkerRef.current = null;
    }
    
    // Clear any other red markers in temporary vertex markers
    if (window.tempMarkersRef && Array.isArray(window.tempMarkersRef)) {
      window.tempMarkersRef.forEach(marker => {
        const dragMarker = marker.get('dragMarker');
        if (dragMarker) {
          dragMarker.setMap(null);
          marker.set('dragMarker', null);
          marker.setOpacity(1);
        }
      });
    }
    
    // Clear any red markers in temporary edge markers
    if (window.tempEdgeMarkersRef && Array.isArray(window.tempEdgeMarkersRef)) {
      window.tempEdgeMarkersRef.forEach(marker => {
        if (marker instanceof google.maps.Marker) {
          const dragMarker = marker.get('dragMarker');
          if (dragMarker) {
            dragMarker.setMap(null);
            marker.set('dragMarker', null);
            marker.setOpacity(1);
          }
        }
      });
    }
    
    // Clear drag markers from all polygon markers
    fieldPolygons.forEach(polygon => {
      // Check vertex markers
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      vertexMarkers.forEach((marker: google.maps.Marker) => {
        const dragMarker = marker.get('dragMarker');
        if (dragMarker) {
          dragMarker.setMap(null);
          marker.set('dragMarker', null);
          marker.setOpacity(1);
        }
      });
      
      // Check edge markers
      const edgeMarkers = polygon.get('edgeMarkers') || [];
      edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
        if (marker instanceof google.maps.Marker) {
          const dragMarker = marker.get('dragMarker');
          if (dragMarker) {
            dragMarker.setMap(null);
            marker.set('dragMarker', null);
            marker.setOpacity(1);
          }
        }
      });
    });
  }, [fieldPolygons]);

  // Define onPolygonComplete function early to avoid linter errors
  const onPolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    // Add the new polygon to our state
    setFieldPolygons(prev => [...prev, polygon]);
    
    // Store the initial styling properties
    polygon.set('strokeColor', polygon.get('strokeColor') || strokeColor);
    polygon.set('fillColor', polygon.get('fillColor') || polygonColor);
    polygon.set('strokeWeight', polygon.get('strokeWeight') || strokeWeight);
    polygon.set('fillOpacity', polygon.get('fillOpacity') || polygonFillOpacity);
    polygon.set('fieldName', polygon.get('fieldName') || `Field ${fieldPolygons.length + 1}`);
    
    // Custom field label will be added by the useEffect hook that watches fieldPolygons
    
    // Disable drawing mode after polygon is complete
    setIsDrawingMode(false);
    
    // Make sure the create menu doesn't automatically open
    setShowCreateMenu(false);
    
    // Make sure to reset any active vertex marker
    if (activeVertexMarkerRef.current) {
      const dragMarker = activeVertexMarkerRef.current.get('dragMarker');
      if (dragMarker) {
        dragMarker.setMap(null);
      }
      activeVertexMarkerRef.current = null;
    }
    
    // Create draggable vertex markers for the completed polygon
    const path = polygon.getPath();
    const vertexMarkers: google.maps.Marker[] = [];
    
    // Function to add/update edge markers for the polygon
    const addEdgeMarkers = () => {
      // Remove existing edge markers
      const oldMarkers = polygon.get('edgeMarkers') || [];
      oldMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
        marker.setMap(null);
      });

      // Create new edge markers
      const newEdgeMarkers: (google.maps.Marker | google.maps.OverlayView)[] = [];
      const path = polygon.getPath();
      
      for (let i = 0; i < path.getLength(); i++) {
        const p1 = path.getAt(i);
        const p2 = path.getAt((i + 1) % path.getLength());
        
        // Calculate midpoint
        const midLat = (p1.lat() + p2.lat()) / 2;
        const midLng = (p1.lng() + p2.lng()) / 2;
        const midpoint = new google.maps.LatLng(midLat, midLng);
        
        // Calculate initial distance
        const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        const distanceText = distance < 1000 
          ? `${Math.round(distance)}m`
          : `${(distance / 1000).toFixed(2)}km`;
        
        // Calculate appropriate circle scale based on distance
        let circleScale = defaultMarkerScale;
        
        // Dynamically adjust scale based on distance
        if (distance > 5000) { // More than 5km
          circleScale = 7;
        } else if (distance < 5) { // Less than 5m
          circleScale = 2;
        } else if (distance < 10) { // Less than 10m
          circleScale = 3;
        } else if (distance < 100) { // Less than 100m
          circleScale = 4;
        }
        
        // Calculate angle between points
        let angle = Math.atan2(
          p2.lng() - p1.lng(),
          p2.lat() - p1.lat()
        ) * (180 / Math.PI);

        // We're removing the angle rotation to keep labels straight
        angle = 0; // Always keep text straight

        // Handler for distance changes
        const handleDistanceChange = (newDistance: number) => {
          // Calculate the ratio of new distance to current distance
          const currentDistance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
          const ratio = newDistance / currentDistance;

          // Calculate new position for p2 by extending the line
          const lat = p1.lat() + (p2.lat() - p1.lat()) * ratio;
          const lng = p1.lng() + (p2.lng() - p1.lng()) * ratio;
          const newPosition = new google.maps.LatLng(lat, lng);

          // Update vertex position in polygon path
          const nextIndex = (i + 1) % path.getLength();
          path.setAt(nextIndex, newPosition);
          
          // Update vertex marker position if it exists
          const markers = polygon.get('vertexMarkers') || [];
          if (markers[nextIndex]) {
            markers[nextIndex].setPosition(newPosition);
          }

          // Update edge markers
          addEdgeMarkers();
        };

        // Create overlay with distance change handler if DistanceOverlayRef is available
        if (DistanceOverlayRef.current) {
          const overlay = new DistanceOverlayRef.current(
            midpoint,
            distanceText,
            angle,
            handleDistanceChange
          );
          overlay.setMap(map);
          newEdgeMarkers.push(overlay as google.maps.Marker | google.maps.OverlayView);
        }
        
        // Create a clickable edge marker at midpoint (not directly draggable)
        const edgeMarker = new google.maps.Marker({
          position: midpoint,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: circleScale,
            fillColor: '#FFFFFF',
            fillOpacity: 0.5,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          draggable: false, // Not directly draggable
          zIndex: 2
        });
        
        // Store which edge this marker is for
        edgeMarker.set('edgeIndex', i);
        edgeMarker.set('parentPolygon', polygon);
        
        // Add click listener to show draggable red marker
        edgeMarker.addListener('click', () => {
          // Clear any existing red markers first - ensures all previous markers are removed
          clearAllRedMarkers();
          
          const position = edgeMarker.getPosition();
          if (!position) return;
          
          // Create draggable red marker
          const dragMarker = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
              path: LOCATION_MARKER_PATH,
              fillColor: '#FF0000',
              fillOpacity: 0.2,
              strokeColor: '#FFFFFF',
              strokeWeight: 1,
              scale: defaultMarkerScale,
              anchor: new google.maps.Point(12, 22),
              rotation: MARKER_ROTATION
            },
            draggable: true,
            crossOnDrag: false,
            zIndex: 3
          });
          
          // Store the drag marker reference
          edgeMarker.set('dragMarker', dragMarker);
          
          // Set this as the active vertex marker
          activeVertexMarkerRef.current = edgeMarker;
          
          // Hide the white marker
          edgeMarker.setOpacity(0);
          
          // Add drag listener
          dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const index = edgeMarker.get('edgeIndex');
            if (typeof index === 'number') {
              // Update the vertex in the polygon path
              path.setAt(index, e.latLng);
              
              // Update the original marker position too (even while invisible)
              edgeMarker.setPosition(e.latLng);
            
            // Update edge markers
            addEdgeMarkers();
            }
          });
          
          // Add dragend listener to clean up
          dragMarker.addListener('dragend', () => {
            // Clean up the drag marker
            if (dragMarker) {
              dragMarker.setMap(null);
            }
            
            // Reset the marker if it still exists
            if (edgeMarker && edgeMarker.getMap()) {
            edgeMarker.set('dragMarker', null);
            edgeMarker.setOpacity(1);
            }
            
            // Clear the active reference if it's this marker
            if (activeVertexMarkerRef.current === edgeMarker) {
              activeVertexMarkerRef.current = null;
            }
          });
        });
        
        newEdgeMarkers.push(edgeMarker);
      }
      
      polygon.set('edgeMarkers', newEdgeMarkers);
    };
    
    // Store the addEdgeMarkers function with the polygon for later use
    polygon.set('addEdgeMarkers', addEdgeMarkers);
    
    // Create vertex markers
    for (let i = 0; i < path.getLength(); i++) {
      const vertex = path.getAt(i);
      const marker = new google.maps.Marker({
        position: vertex,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#FFFFFF',
          fillOpacity: 0.5,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        draggable: false,
        zIndex: 2
      });

      // Store the vertex index directly in the marker for easier reference
      marker.set('vertexIndex', i);
      marker.set('parentPolygon', polygon);

      // Add click handler to show draggable red marker
      marker.addListener('click', () => {
        // Clear any existing red markers first - thoroughly clean up before creating new ones
        clearAllRedMarkers();
        
        const position = marker.getPosition();
        if (!position) return;
        
        // Create draggable red marker
        const dragMarker = new google.maps.Marker({
          position: position,
          map: map,
          icon: {
            path: LOCATION_MARKER_PATH,
            fillColor: '#FF0000',
            fillOpacity: 0.2,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            scale: defaultMarkerScale,
            anchor: new google.maps.Point(12, 22),
            rotation: MARKER_ROTATION
          },
          draggable: true,
          crossOnDrag: false,
          zIndex: 3
        });
        
        // Store the drag marker reference
        marker.set('dragMarker', dragMarker);
        
        // Set this as the active vertex marker
        activeVertexMarkerRef.current = marker;
        
        // Hide the white marker
        marker.setOpacity(0);
        
        // Add drag listener
        dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
          const idx = marker.get('vertexIndex');
          if (typeof idx === 'number') {
            // Update the vertex in the polygon path
            path.setAt(idx, e.latLng);
            
            // Update the original marker position too (even while invisible)
            marker.setPosition(e.latLng);
            
            // Update edge markers
        addEdgeMarkers();
        }
        });
        
        // Add dragend listener to clean up
        dragMarker.addListener('dragend', () => {
          // Save state after moving vertex with red marker
          const newState = [...window.tempVerticesRef];
          setUndoStack(prev => [...prev, newState]);
          setRedoStack([]); // Clear redo stack after a new action
          // Force update canUndo/canRedo state immediately
          setCanUndo(true);
          setCanRedo(false);
          
          // Update the position of the original white marker
          const finalPosition = dragMarker?.getPosition();
          if (finalPosition) {
            marker.setPosition(finalPosition);
          }
          
          // Clean up the drag marker
          if (dragMarker) {
            dragMarker.setMap(null);
          }
          
          // Reset the marker if it still exists
          if (marker && marker.getMap()) {
            marker.set('dragMarker', null);
            marker.setOpacity(1);
          }
          
          // Clear the active reference if it's this marker
          if (activeVertexMarkerRef.current === marker) {
            activeVertexMarkerRef.current = null;
          }
        });
      });

      vertexMarkers.push(marker);
    }

    // Store vertex markers with the polygon for cleanup
    polygon.set('vertexMarkers', vertexMarkers);

    // Add listener to update vertex markers when polygon is modified
    google.maps.event.addListener(polygon.getPath(), 'insert_at', (index: number) => {
      const vertex = path.getAt(index);
      if (!vertex) return;
      
      const marker = new google.maps.Marker({
        position: vertex,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#FFFFFF',
          fillOpacity: 0.5,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        draggable: false,
        zIndex: 2
      });

      // Store the vertex index directly in the marker
      marker.set('vertexIndex', index);
      marker.set('parentPolygon', polygon);

      // Add click handler to show draggable red marker
      marker.addListener('click', () => {
        // Clear any existing red markers first - thoroughly clean up before creating new ones
        clearAllRedMarkers();
        
        const position = marker.getPosition();
        if (!position) return;
        
        // Create draggable red marker
        const dragMarker = new google.maps.Marker({
          position: position,
        map: map,
        icon: {
          path: LOCATION_MARKER_PATH,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
            scale: defaultMarkerScale,
            anchor: new google.maps.Point(12, 22),
            rotation: MARKER_ROTATION
        },
        draggable: true,
          crossOnDrag: false,
          zIndex: 3
        });
        
        // Store the drag marker reference
        marker.set('dragMarker', dragMarker);
        
        // Set this as the active vertex marker
        activeVertexMarkerRef.current = marker;
        
        // Hide the white marker
        marker.setOpacity(0);
        
        // Add drag listener
        dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const idx = marker.get('vertexIndex');
        if (typeof idx === 'number') {
            // Update the vertex in the polygon path
          path.setAt(idx, e.latLng);
            
            // Update the original marker position too (even while invisible)
            marker.setPosition(e.latLng);
            
            // Update edge markers
        addEdgeMarkers();
        }
        });
        
        // Add dragend listener to clean up
        dragMarker.addListener('dragend', () => {
          // Save state after moving vertex with red marker
          const newState = [...window.tempVerticesRef];
          setUndoStack(prev => [...prev, newState]);
          setRedoStack([]); // Clear redo stack after a new action
          // Force update canUndo/canRedo state immediately
          setCanUndo(true);
          setCanRedo(false);
          
          // Update the position of the original white marker
          const finalPosition = dragMarker?.getPosition();
          if (finalPosition) {
            marker.setPosition(finalPosition);
          }
          
          // Clean up the drag marker
          if (dragMarker) {
            dragMarker.setMap(null);
          }
          
          // Reset the marker if it still exists
          if (marker && marker.getMap()) {
            marker.set('dragMarker', null);
            marker.setOpacity(1);
          }
          
          // Clear the active reference if it's this marker
          if (activeVertexMarkerRef.current === marker) {
            activeVertexMarkerRef.current = null;
          }
        });
      });

      const markers = polygon.get('vertexMarkers') || [];
      markers.splice(index, 0, marker);
      polygon.set('vertexMarkers', markers);
      
      // Update all vertex indices after insertion
      for (let i = 0; i < markers.length; i++) {
        markers[i].set('vertexIndex', i);
      }
    });

    // Add listeners for other path modifications
    google.maps.event.addListener(polygon.getPath(), 'remove_at', (index: number) => {
      const markers = polygon.get('vertexMarkers') || [];
      // Remove the marker associated with this vertex
      if (index < markers.length) {
        markers[index].setMap(null);
        markers.splice(index, 1);
      }
      
      // Update all vertex indices after removal
      for (let i = 0; i < markers.length; i++) {
        markers[i].set('vertexIndex', i);
      }
      
      polygon.set('vertexMarkers', markers);
      addEdgeMarkers();
    });

    google.maps.event.addListener(polygon.getPath(), 'set_at', (index: number) => {
      const markers = polygon.get('vertexMarkers') || [];
      const vertex = path.getAt(index);
      if (vertex && index < markers.length) {
        markers[index].setPosition(vertex);
      }
      addEdgeMarkers();
    });

    // Add edge markers initially
    addEdgeMarkers();
    
    // Make the polygon non-editable by default
    polygon.setEditable(false);
    polygon.setDraggable(false);
    
    // Hide all vertex markers initially
    vertexMarkers.forEach((marker: google.maps.Marker) => {
      marker.setMap(null);
    });
    
    // Hide all edge markers initially
    const edgeMarkers = polygon.get('edgeMarkers') || [];
    edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
      marker.setMap(null);
    });
    
    // Remove this line to prevent auto-opening the create menu
    // setShowCreateMenu(true);
    
    return polygon;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, defaultMarkerScale]);

  // Add a helper function to store the current state in the undo stack
  const saveToUndoStack = useCallback((vertices: google.maps.LatLng[]) => {
    setUndoStack(prev => [...prev, [...vertices]]);
    setRedoStack([]);
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Map event handlers
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);

    // Create the DistanceOverlay class after Google Maps is loaded
    class DistanceOverlay extends google.maps.OverlayView {
      private position: google.maps.LatLng;
      private content: string;
      private div: HTMLDivElement | null;
      private angle: number;
      private onDistanceChange: (newDistance: number) => void;

      constructor(
        position: google.maps.LatLng, 
        content: string, 
        angle: number,
        onDistanceChange: (newDistance: number) => void
      ) {
        super();
        this.position = position;
        this.content = content;
        this.div = null;
        this.angle = angle;
        this.onDistanceChange = onDistanceChange;
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        
        // Extract the numeric value from content
        const numericValue = parseFloat(this.content.replace(/[^0-9.]/g, ''));
        const unit = this.content.includes('km') ? 'km' : 'm';
        
        // Calculate appropriate font size based on the distance value
        let fontSize = '14px';
        
        // Dynamically adjust size based on distance
        if (unit === 'km') {
          if (numericValue > 5) {
            fontSize = '16px';
          } else if (numericValue < 0.5) {
            fontSize = '12px';
          }
        } else { // meters
          if (numericValue > 1000) {
            fontSize = '16px';
          } else if (numericValue < 100) {
            fontSize = '12px';
          }
        }
        
        div.innerHTML = `
          <div style="
            color: white;
            font-size: ${fontSize};
            font-weight: 600;
            text-align: center;
            min-width: 60px;
            transform: translate(-50%, -150%);
            white-space: nowrap;
            cursor: pointer;
            text-shadow: 0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black;
          ">
            <input
              type="number"
              value="${numericValue}"
              step="${unit === 'km' ? '0.01' : '1'}"
              min="0"
              style="
                width: ${numericValue.toString().length * 10 + 20}px;
                background: transparent;
                border: none;
                color: white;
                font-size: ${fontSize};
                text-align: right;
                outline: none;
                padding: 0;
                margin-right: -4px;
                font-weight: 600;
                text-shadow: 0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black;
              "
            />${unit}
          </div>
        `;

        // Add input event listener
        const input = div.querySelector('input');
        if (input) {
          input.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (!isNaN(newValue)) {
              // Convert to meters if in km
              const meters = unit === 'km' ? newValue * 1000 : newValue;
              this.onDistanceChange(meters);
            }
          });

          // Prevent propagation of click events to avoid map clicks
          input.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        }

        this.div = div;
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(div);
      }

      draw() {
        if (!this.div) return;
        const overlayProjection = this.getProjection();
        const point = overlayProjection.fromLatLngToDivPixel(this.position);
        if (point) {
          this.div.style.left = point.x + 'px';
          this.div.style.top = point.y + 'px';
        }
      }

      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }
    }

    // Store the class in the ref
    DistanceOverlayRef.current = DistanceOverlay;
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Map controls handlers
  const handleToggleMapType = useCallback(() => {
    setMapType(prev => {
      switch (prev) {
        case 'hybrid': return 'satellite';
        case 'satellite': return 'roadmap';
        case 'roadmap': return 'terrain';
        case 'terrain': return 'hybrid';
        default: return 'hybrid';
      }
    });
  }, []);

  const handleLocationClick = useCallback(() => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = new google.maps.LatLng(
            position.coords.latitude,
            position.coords.longitude
          );
          setUserLocation(newLocation);
          if (map) {
            map.panTo(newLocation);
            map.setZoom(18);
          }
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsLocating(false);
          alert('Unable to get your location. Please check your location permissions.');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setIsLocating(false);
    }
  }, [map]);

  const handleToggleFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (!isFullscreen) {
      elem.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const handleZoomIn = useCallback(() => {
    if (map) {
      map.setZoom((map.getZoom() || 15) + 1);
    }
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (map) {
      map.setZoom((map.getZoom() || 15) - 1);
    }
  }, [map]);

  // Create menu handlers - moved after onPolygonComplete
  const handleCreateOption = useCallback(async (option: 'import' | 'field' | 'distance' | 'marker') => {
    setShowCreateMenu(false);
    
    // Check authentication for field drawing
    if (option === 'field' && !user) {
      // Show login dialog
      const confirmLogin = window.confirm("You need to be logged in to draw fields. Would you like to login now?");
      if (confirmLogin) {
        try {
          const loggedInUser = await login();
          if (!loggedInUser) {
            // User closed the login popup or login was cancelled
            console.log('Login was cancelled');
            return;
          }
          // After successful login, we don't immediately start drawing
          // The user can click the draw button again
          return;
        } catch (error) {
          console.error("Login failed:", error);
          alert("Login failed. Please try again later.");
          return;
        }
      } else {
        // User cancelled login
        return;
      }
    }
    
    // Handle different creation options here
    switch (option) {
      case 'import':
        // Handle importing KML/GeoJSON
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        break;
      case 'field':
        // Disable editing and hide all markers for previous fields
        fieldPolygons.forEach(polygon => {
          // Disable dragging and editing for the polygon
          polygon.setDraggable(false);
          polygon.setEditable(false);
          
          // Hide all vertex markers
          const vertexMarkers = polygon.get('vertexMarkers') || [];
          vertexMarkers.forEach((marker: google.maps.Marker) => {
            marker.setMap(null);
          });
          
          // Hide all edge markers
          const edgeMarkers = polygon.get('edgeMarkers') || [];
          edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
            marker.setMap(null);
          });
        });
        
        // Check if we're already in drawing mode with at least 3 vertices
        // This means we have an unfinished field that needs to be completed
        const isUnfinishedField = isDrawingMode && window.tempVerticesRef && 
          Array.isArray(window.tempVerticesRef) && window.tempVerticesRef.length >= 3;
        
        if (isUnfinishedField) {
          // Finish the current polygon by simulating a double click
          // This will call onPolygonComplete and create the polygon
          console.log("Completing unfinished field before starting a new one");
          
          // Create final polygon with existing vertices
          const polygon = new google.maps.Polygon({
            map: map,
            paths: window.tempVerticesRef,
            strokeColor: strokeColor,
            strokeWeight: strokeWeight,
            fillColor: polygonColor,
            fillOpacity: polygonFillOpacity,
            editable: true,
            draggable: true
          });
          
          // Clean up any existing polyline and markers
          if (window.tempPolylineRef) {
            window.tempPolylineRef.setMap(null);
            window.tempPolylineRef = null;
          }
          
          // Remove temporary markers
          if (window.tempMarkersRef) {
            window.tempMarkersRef.forEach((marker: google.maps.Marker) => marker.setMap(null));
            window.tempMarkersRef = [];
          }
          
          if (window.tempEdgeMarkersRef) {
            window.tempEdgeMarkersRef.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
              if (marker) {
                marker.setMap(null);
              }
            });
            window.tempEdgeMarkersRef = [];
          }
          
          // Call polygon complete
          onPolygonComplete(polygon);
          
          // Wait a bit before starting new field to ensure proper cleanup
          setTimeout(() => {
            // Make sure everything is cleaned up
            if (activeVertexMarkerRef.current) {
              const prevDragMarker = activeVertexMarkerRef.current.get('dragMarker');
              if (prevDragMarker) {
                prevDragMarker.setMap(null);
              }
              activeVertexMarkerRef.current = null;
            }
            
            // Reset drawing mode to trigger a fresh start
            setIsDrawingMode(false);
            setTimeout(() => setIsDrawingMode(true), 100);
          }, 200);
        } else {
          // Make sure previous drawing state is cleaned up completely
          // before starting a new drawing mode
          if (activeVertexMarkerRef.current) {
            // Find and remove any previous drag marker
            const prevDragMarker = activeVertexMarkerRef.current.get('dragMarker');
            if (prevDragMarker) {
              prevDragMarker.setMap(null);
            }
            activeVertexMarkerRef.current = null;
          }
          
          // Enable our custom drawing mode instead of using DrawingManager
          setIsDrawingMode(true);
        }
        break;
      case 'distance':
        // Handle distance measurement
        if (isMeasuringDistance) {
          setIsMeasuringDistance(false);
        } else {
          // If drawing, cancel it first
          if (isDrawingMode) {
            // Clear the drawing state without using handleCancelDrawing
            setIsDrawingMode(false);
            if (window.tempPolylineRef) {
              window.tempPolylineRef.setMap(null);
            }
            if (window.tempMarkersRef) {
              window.tempMarkersRef.forEach((marker: google.maps.Marker) => marker.setMap(null));
            }
          }
          
          // If editing a field, close the polygon tools
          if (showPolygonTools) {
            setShowPolygonTools(false);
          }
          
          setIsMeasuringDistance(true);
        }
        break;
      case 'marker':
        // Handle marker placement
        break;
    }
  }, [map, isDrawingMode, onPolygonComplete, fieldPolygons, defaultMarkerScale, user, login, isMeasuringDistance, showPolygonTools]);

  // Handle place selection from search
  const handlePlaceSelect = useCallback((location: google.maps.LatLng) => {
    if (map) {
      map.panTo(location);
      map.setZoom(18);
    }
  }, [map]);

  // Map options
  const mapOptions = useMemo(() => ({
    mapTypeId: mapType,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: false,
    scaleControl: true,
    rotateControl: false,
    panControl: false,
    scrollwheel: true,
    clickableIcons: false,
    disableDefaultUI: true,
    tilt: 0,
    gestureHandling: 'greedy',
    draggableCursor: 'grab',
    draggingCursor: 'move',
  }), [mapType]);

  // Add drawing manager load handler
  const onDrawingManagerLoad = useCallback((drawingManager: google.maps.drawing.DrawingManager) => {
    drawingManagerRef.current = drawingManager;
  }, []);

  // Add a modified version of updateEdgeMarkers outside setupAutoClosePolygon
  const updateEdgeMarkers = useCallback(() => {
    if (!map || !window.tempVerticesRef || !window.tempPolylineRef) return;

      // Remove existing edge markers
    if (window.tempEdgeMarkersRef) {
      window.tempEdgeMarkersRef.forEach(marker => {
        if (marker instanceof google.maps.Marker) {
          marker.setMap(null);
        } else {
          marker.setMap(null);
        }
      });
      window.tempEdgeMarkersRef = [];
    }

    const vertices = window.tempVerticesRef;

      // Add new edge markers if we have at least 2 vertices
      if (vertices.length >= 2) {
        for (let i = 0; i < vertices.length; i++) {
          const p1 = vertices[i];
          const p2 = vertices[(i + 1) % vertices.length];

          // Calculate midpoint
          const midLat = (p1.lat() + p2.lat()) / 2;
          const midLng = (p1.lng() + p2.lng()) / 2;
          const midpoint = new google.maps.LatLng(midLat, midLng);

          // Calculate initial distance
          const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
          const distanceText = distance < 1000 
            ? `${Math.round(distance)}m`
            : `${(distance / 1000).toFixed(2)}km`;

          // Calculate appropriate circle scale based on distance
          let circleScale = defaultMarkerScale;
          
          // Dynamically adjust scale based on distance
          if (distance > 5000) { // More than 5km
            circleScale = 7;
          } else if (distance < 5) { // Less than 5m
            circleScale = 2;
          } else if (distance < 10) { // Less than 10m
            circleScale = 3;
          } else if (distance < 100) { // Less than 100m
            circleScale = 4;
          }

          // Calculate angle between points
          let angle = Math.atan2(
            p2.lng() - p1.lng(),
            p2.lat() - p1.lat()
          ) * (180 / Math.PI);

          // We're removing the angle rotation to keep labels straight
          angle = 0; // Always keep text straight

        // Create overlay with distance change handler
        if (DistanceOverlayRef.current) {
          const overlay = new DistanceOverlayRef.current(
            midpoint, 
            distanceText, 
            angle,
            (newDistance: number) => {
              // Save state before changing distance
              if (vertices.length > 0) {
                saveToUndoStack([...vertices]);
              }
              
            // Calculate the ratio of new distance to current distance
            const currentDistance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            const ratio = newDistance / currentDistance;

            // Calculate new position for p2 by extending the line
            const lat = p1.lat() + (p2.lat() - p1.lat()) * ratio;
            const lng = p1.lng() + (p2.lng() - p1.lng()) * ratio;
            const newPosition = new google.maps.LatLng(lat, lng);

            // Update vertex position
            vertices[(i + 1) % vertices.length] = newPosition;
              if (window.tempMarkersRef[(i + 1) % vertices.length]) {
                window.tempMarkersRef[(i + 1) % vertices.length].setPosition(newPosition);
              }

            // Update polyline
              if (window.tempPolylineRef) {
              const path = vertices.slice();
              if (vertices.length >= 3) {
                path.push(vertices[0]);
              }
                window.tempPolylineRef.setPath(path);
            }

            // Update all edge markers
            updateEdgeMarkers();
            updateBannerInfo();
              
              // Save state after changing distance
              saveToUndoStack([...vertices]);
            }
          );
          overlay.setMap(map);
          window.tempEdgeMarkersRef.push(overlay as google.maps.Marker | google.maps.OverlayView);
        }

          // Create marker at midpoint
          const marker = new google.maps.Marker({
            position: midpoint,
            map: map,
            icon: {
            path: google.maps.SymbolPath.CIRCLE,
              scale: circleScale,
              fillColor: '#FFFFFF',
              fillOpacity: 0.5,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            },
          draggable: false,
            zIndex: 2
          });
        
        // Store the edge index in the marker
        marker.set('edgeIndex', i);

          let dragMarker: google.maps.Marker | null = null;

        const showRedMarker = (marker: google.maps.Marker) => {
          // First clear all existing red markers
          clearAllRedMarkers();
            
            const position = marker.getPosition();
          if (!position) return;
            
          // Create the red location marker
            dragMarker = new google.maps.Marker({
              position: position,
              map: map,
              icon: {
                path: LOCATION_MARKER_PATH,
                fillColor: '#FF0000',
              fillOpacity: 0.2,
                strokeColor: '#FFFFFF',
                strokeWeight: 1,
                scale: defaultMarkerScale,
                anchor: new google.maps.Point(12, 22),
                rotation: MARKER_ROTATION
              },
            draggable: true,
            crossOnDrag: false,
              zIndex: 3
            });
            
            // Store the drag marker reference in the vertex marker
            marker.set('dragMarker', dragMarker);
            
            // Set this as the active vertex marker
            activeVertexMarkerRef.current = marker;
            
          // Hide the original circle marker
            marker.setOpacity(0);
            
            // Store the original position and vertices
          marker.set('originalPosition', position);
            marker.set('originalVertices', [...vertices]);
            
          // For edge markers, we need to store which vertices this edge connects
          const edgeIndex = marker.get('edgeIndex');
          if (typeof edgeIndex === 'number') {
            // This is an edge marker
            dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
              if (!e.latLng || !window.tempPolylineRef) return;
              
              // Insert new vertex at the drag position
              if (!marker.get('vertexInserted')) {
                window.tempVerticesRef.splice(edgeIndex + 1, 0, e.latLng);
                marker.set('vertexInserted', true);
                marker.set('insertedIndex', edgeIndex + 1);
                
                // Create a hidden temporary marker to track this position
                const tempMarker = new google.maps.Marker({
                  position: e.latLng,
                  map: null, // Start hidden
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: '#FFFFFF',
                    fillOpacity: 0.5,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                  },
                  draggable: false
                });
                
                // Store the temporary marker
                marker.set('tempVertexMarker', tempMarker);
              } else {
                const insertedIndex = marker.get('insertedIndex');
                if (typeof insertedIndex === 'number') {
                  // Update vertex in the vertices array
                  window.tempVerticesRef[insertedIndex] = e.latLng;
                  
                  // Update the temporary marker position
                  const tempMarker = marker.get('tempVertexMarker');
                  if (tempMarker) {
                    tempMarker.setPosition(e.latLng);
                  }
                }
              }
              
              // Update the path
              const path = window.tempVerticesRef.slice();
              if (window.tempVerticesRef.length >= 3) {
                path.push(window.tempVerticesRef[0]);
              }
              window.tempPolylineRef.setPath(path);
              updateEdgeMarkers();
              updateBannerInfo();
            });

            dragMarker.addListener('dragend', () => {
              // Save state after adding/moving edge vertex
              const newState = [...window.tempVerticesRef];
              setUndoStack(prev => [...prev, newState]);
              setRedoStack([]); // Clear redo stack after a new action
              // Force update canUndo/canRedo state immediately
              setCanUndo(true);
              setCanRedo(false);
              
              // Create a new permanent vertex at the final position
              const insertedIndex = marker.get('insertedIndex');
              const tempMarker = marker.get('tempVertexMarker');
              
              if (typeof insertedIndex === 'number' && dragMarker) {
                const position = dragMarker.getPosition();
                if (position) {
                  // Use the temporary marker's position if available
                  const finalPosition = tempMarker ? tempMarker.getPosition() : position;
                  
                  // Create a new vertex marker with red location marker style instead of circle
                  const newVertexMarker = new google.maps.Marker({
                    position: finalPosition || position,
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 7,
                  fillColor: '#FFFFFF',
                  fillOpacity: 0.5,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2,
                },
                    draggable: false,
                zIndex: 2
              });
                  
                  // Add the same listeners to the new vertex
                  newVertexMarker.addListener('click', () => {
                    // Create a red marker for dragging when clicked - full implementation
                    const position = newVertexMarker.getPosition();
                    if (!position) return;
                    
                    // If there's an existing active vertex marker, remove its drag marker
                    if (activeVertexMarkerRef.current && activeVertexMarkerRef.current !== newVertexMarker) {
                      // Reset the previous active marker
                      activeVertexMarkerRef.current.setOpacity(1);
                      
                      // Find and remove the previous drag marker if it exists
                      const prevDragMarker = activeVertexMarkerRef.current.get('dragMarker');
                      if (prevDragMarker) {
                        prevDragMarker.setMap(null);
                        activeVertexMarkerRef.current.set('dragMarker', null);
                      }
                    }
                    
                    // Create new red drag marker
                    const redDragMarker = new google.maps.Marker({
                      position: position,
                      map: map,
                      icon: {
                        path: LOCATION_MARKER_PATH,
                        fillColor: '#FF0000',
                        fillOpacity: 0.2,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 1,
                        scale: defaultMarkerScale,
                        anchor: new google.maps.Point(12, 22),
                        rotation: MARKER_ROTATION
                      },
                      draggable: true,
                      crossOnDrag: false,
                      zIndex: 3
                    });
                    
                    // Store the drag marker reference in the white marker
                    newVertexMarker.set('dragMarker', redDragMarker);
                    
                    // Set this as the active vertex marker
                    activeVertexMarkerRef.current = newVertexMarker;
                    
                    // Hide the original white marker
                    newVertexMarker.setOpacity(0);
                    
                    // Add drag listener to update position
                    redDragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
                    if (!e.latLng) return;
                      
                      // Get the vertex index
                    const idx = newVertexMarker.get('vertexIndex');
                    if (typeof idx === 'number') {
                        // Update the vertex position in the global vertices array
                      window.tempVerticesRef[idx] = e.latLng;
                        
                        // Also update the white marker position (even while invisible)
                        newVertexMarker.setPosition(e.latLng);
                        
                        // Update the polyline
                    if (window.tempPolylineRef) {
                      const path = window.tempVerticesRef.slice();
                      if (window.tempVerticesRef.length >= 3) {
                        path.push(window.tempVerticesRef[0]);
                      }
                      window.tempPolylineRef.setPath(path);
                    }
                        
                        // Update the edge markers
                    updateEdgeMarkers();
                    updateBannerInfo();
                      }
                  });
                  
                    // Add dragend listener to clean up
                    redDragMarker.addListener('dragend', () => {
                      // Save state after dragging
                    saveToUndoStack([...window.tempVerticesRef]);
                      
                      // Clean up the drag marker
                      if (redDragMarker) {
                        redDragMarker.setMap(null);
                      }
                      
                      // Restore the white marker
                      newVertexMarker.set('dragMarker', null);
                      newVertexMarker.setOpacity(1);
                      activeVertexMarkerRef.current = null;
                    });
                  });
                  
                  newVertexMarker.addListener('dragstart', () => {
                    // Since marker is not draggable, this might not be needed,
                    // but we'll keep it for completeness
                    saveToUndoStack([...window.tempVerticesRef]);
                    showRedMarker(newVertexMarker);
                  });
                  
                  // Add dragend handler to ensure red marker is removed
                  newVertexMarker.addListener('dragend', () => {
                    // Find and remove any red drag marker
                    const currentDragMarker = newVertexMarker.get('dragMarker');
                    if (currentDragMarker) {
                      currentDragMarker.setMap(null);
                      newVertexMarker.set('dragMarker', null);
                    }
                    
                    // Make white marker visible again
                    newVertexMarker.setOpacity(1);
                    
                    // Clear active vertex reference
                    if (activeVertexMarkerRef.current === newVertexMarker) {
                      activeVertexMarkerRef.current = null;
                    }
                  });
                  
                  // Store the vertex index
                  newVertexMarker.set('vertexIndex', insertedIndex);

                  // Insert the new marker into vertexMarkers array
                  window.tempMarkersRef.splice(insertedIndex, 0, newVertexMarker);
                  
                  // Update all vertex indices after insertion
                  for (let i = 0; i < window.tempMarkersRef.length; i++) {
                    window.tempMarkersRef[i].set('vertexIndex', i);
                  }
                }
              }

              // Clean up the temporary markers
              if (tempMarker) {
                tempMarker.setMap(null);
                marker.set('tempVertexMarker', null);
              }

              // Clean up the temporary drag marker
              if (dragMarker) {
                dragMarker.setMap(null);
              }
              marker.set('dragMarker', null);
              marker.setOpacity(1);
              activeVertexMarkerRef.current = null;
              
              // Reset the edge marker state
              marker.set('vertexInserted', false);
              marker.set('insertedIndex', null);
            });
          }
        };

        // Add click listener to show red marker
        marker.addListener('click', () => {
          showRedMarker(marker);
        });

        window.tempEdgeMarkersRef.push(marker as google.maps.Marker | google.maps.OverlayView);
      }
    }
  }, [map, saveToUndoStack, defaultMarkerScale]);

  // Update the map click listener in setupAutoClosePolygon
  const setupAutoClosePolygon = useCallback(() => {
    if (!map) return () => {};
    
    // Create a temporary polyline to track vertices
    let tempPolyline: google.maps.Polyline | null = null;
    let vertices: google.maps.LatLng[] = [];
    let vertexMarkers: google.maps.Marker[] = [];
    let edgeMarkers: (google.maps.Marker | google.maps.OverlayView)[] = [];
    let mapClickListener: google.maps.MapsEventListener | null = null;
    let mapDblClickListener: google.maps.MapsEventListener | null = null;

    // Store references globally to access from createOption handler
    window.tempPolylineRef = tempPolyline;
    window.tempVerticesRef = vertices;
    window.tempMarkersRef = vertexMarkers;
    window.tempEdgeMarkersRef = edgeMarkers;

    const startDrawing = () => {
      // Clear any existing drawing state
              if (tempPolyline) {
        tempPolyline.setMap(null);
        tempPolyline = null;
      }
      
      // Clear any existing vertex markers
      vertexMarkers.forEach(marker => marker.setMap(null));
      vertexMarkers = [];
      
      // Clear any existing edge markers
              edgeMarkers.forEach(marker => {
                if (marker instanceof google.maps.Marker) {
                  marker.setMap(null);
                } else {
                  marker.setMap(null);
                }
              });
              edgeMarkers = [];
              
      // Clear vertices array
      vertices = [];
      
      // Remove any existing listeners
      if (mapClickListener) {
        google.maps.event.removeListener(mapClickListener);
        mapClickListener = null;
      }
      
      if (mapDblClickListener) {
        google.maps.event.removeListener(mapDblClickListener);
        mapDblClickListener = null;
      }
      
      // Reset undo/redo stacks
      setUndoStack([]);
      setRedoStack([]);
      setCanUndo(false);
      setCanRedo(false);
      
      // Disable editing for all existing fields when starting a new one
      fieldPolygons.forEach(polygon => {
        // Disable dragging and editing for the polygon
        polygon.setDraggable(false);
        polygon.setEditable(false);
        
        // Hide all vertex markers
        const polygonVertexMarkers = polygon.get('vertexMarkers') || [];
        polygonVertexMarkers.forEach((marker: google.maps.Marker) => {
          marker.setMap(null);
        });
        
        // Hide all edge markers
        const polygonEdgeMarkers = polygon.get('edgeMarkers') || [];
        polygonEdgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
          marker.setMap(null);
        });
      });
      
      // Create a new polyline to track vertices
      tempPolyline = new google.maps.Polyline({
        map: map,
        path: [],
        strokeColor: strokeColor,  // Use the green color
        strokeWeight: strokeWeight
      });
      
      // Update global references
      window.tempPolylineRef = tempPolyline;
      window.tempVerticesRef = vertices;
      window.tempMarkersRef = vertexMarkers;
      window.tempEdgeMarkersRef = edgeMarkers;
      
      // Add click listener to map
      mapClickListener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !tempPolyline) return;
        
        // Save current state to undo stack before adding new vertex
        if (vertices.length > 0) {
          saveToUndoStack([...vertices]);
        }
        
        vertices.push(e.latLng);
        window.tempVerticesRef = vertices; // Update global reference
        const vertexIndex = vertices.length - 1;
        
        // Update banner info after adding vertex
        updateBannerInfo();
        
        // Create a marker for this vertex with circle icon (during drawing)
        const marker = new google.maps.Marker({
          position: e.latLng,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#FFFFFF',
            fillOpacity: 0.5,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          draggable: false,
          zIndex: 2
        });

        // Store the vertex index directly in the marker for easier reference
        marker.set('vertexIndex', vertexIndex);

        let dragMarker: google.maps.Marker | null = null;

        const showRedMarker = (marker: google.maps.Marker) => {
          // First clear all existing red markers
          clearAllRedMarkers();
          
          const position = marker.getPosition();
          if (!position) return;
          
          // Create the red location marker
          dragMarker = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
              path: LOCATION_MARKER_PATH,
              fillColor: '#FF0000',
              fillOpacity: 0.2,
              strokeColor: '#FFFFFF',
              strokeWeight: 1,
              scale: defaultMarkerScale,
              anchor: new google.maps.Point(12, 22),
              rotation: MARKER_ROTATION
            },
            draggable: true,
            crossOnDrag: false,
            zIndex: 3
          });
          
          // Store the drag marker reference in the vertex marker
          marker.set('dragMarker', dragMarker);
          
          // Set this as the active vertex marker
          activeVertexMarkerRef.current = marker;
          
          // Hide the original marker
          marker.setOpacity(0);

          // Get the vertex index from the marker
          const index = marker.get('vertexIndex');
          if (typeof index !== 'number') return;

          // Add drag listeners to the red marker
          dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            window.tempVerticesRef[index] = e.latLng;
            
            // Update the original marker position too (even while invisible)
            marker.setPosition(e.latLng);
            
            if (window.tempPolylineRef) {
              const path = window.tempVerticesRef.slice();
              if (window.tempVerticesRef.length >= 3) {
                path.push(window.tempVerticesRef[0]);
              }
              window.tempPolylineRef.setPath(path);
            }
            updateEdgeMarkers();
            
            // Update banner info while dragging
            updateBannerInfo();
          });
          
          // Add dragend listener to update the white marker position
          dragMarker.addListener('dragend', () => {
            // Save state after moving vertex with red marker
            const newState = [...vertices];
            setUndoStack(prev => [...prev, newState]);
            setRedoStack([]); // Clear redo stack after a new action
            // Force update canUndo/canRedo state immediately
            setCanUndo(true);
            setCanRedo(false);
            
            // Update the position of the original white marker
            const finalPosition = dragMarker?.getPosition();
            if (finalPosition) {
              marker.setPosition(finalPosition);
            }
            
            // Clean up the drag marker
            if (dragMarker) {
              dragMarker.setMap(null);
            }
            marker.set('dragMarker', null);
            marker.setOpacity(1);
            activeVertexMarkerRef.current = null;
          });
        };

        // Add click listener to show red marker
        marker.addListener('click', () => {
          showRedMarker(marker);
        });

        // Also show red marker on dragstart
        marker.addListener('dragstart', () => {
          // Since marker is not draggable, this might not be needed,
          // but we'll keep it for completeness
          saveToUndoStack([...window.tempVerticesRef]);
          showRedMarker(marker);
        });
        
        // Add dragend handler to ensure red marker is removed
        marker.addListener('dragend', () => {
          // Find and remove any red drag marker
          const currentDragMarker = marker.get('dragMarker');
          if (currentDragMarker) {
            currentDragMarker.setMap(null);
            marker.set('dragMarker', null);
          }
          
          // Make white marker visible again
          marker.setOpacity(1);
          
          // Clear active vertex reference
          if (activeVertexMarkerRef.current === marker) {
            activeVertexMarkerRef.current = null;
          }
          
          // Save state after dragging
          saveToUndoStack([...vertices]);
        });
        
        vertexMarkers.push(marker);
        
        // Update polyline path
        const path = vertices.slice();
        if (vertices.length >= 3) {
          path.push(vertices[0]); // Close the polygon
        }
        tempPolyline.setPath(path);
        
        // Update edge markers
        updateEdgeMarkers();
        
        // Update undo/redo state
        setCanUndo(true);
        setCanRedo(false);
      });
      
      // Add double click listener to close the polygon
      mapDblClickListener = map.addListener('dblclick', (e: google.maps.MapMouseEvent) => {
        if (vertices.length >= 3) {
          // Create final polygon
          const polygon = new google.maps.Polygon({
            map: map,
            paths: vertices,
            strokeColor: strokeColor,  // Use the green color
            strokeWeight: strokeWeight,
            fillColor: polygonColor,  // Use the green color
            fillOpacity: polygonFillOpacity,
            editable: true,
            draggable: true
          });
          
          // Clean up
          if (tempPolyline) {
            tempPolyline.setMap(null);
            tempPolyline = null;
          }
          
          // Remove all temporary markers
          vertexMarkers.forEach(marker => marker.setMap(null));
          edgeMarkers.forEach(marker => marker.setMap(null));
          vertexMarkers = [];
          edgeMarkers = [];
          
          if (mapClickListener) {
            google.maps.event.removeListener(mapClickListener);
            mapClickListener = null;
          }
          
          if (mapDblClickListener) {
            google.maps.event.removeListener(mapDblClickListener);
            mapDblClickListener = null;
          }
          
          // Call the polygon complete handler
          onPolygonComplete(polygon);
        }
      });
    };
    
    // Start drawing when drawing mode is enabled
    if (isDrawingMode) {
      startDrawing();
    }
    
    // Clean up when drawing mode is disabled
    return () => {
      if (tempPolyline) {
        tempPolyline.setMap(null);
      }
      if (vertexMarkers.length > 0) {
        vertexMarkers.forEach(marker => marker.setMap(null));
      }
      if (edgeMarkers.length > 0) {
        edgeMarkers.forEach(marker => marker.setMap(null));
      }
      if (mapClickListener) {
        google.maps.event.removeListener(mapClickListener);
      }
      if (mapDblClickListener) {
        google.maps.event.removeListener(mapDblClickListener);
      }
    };
  }, [map, isDrawingMode, onPolygonComplete, fieldPolygons, saveToUndoStack, updateEdgeMarkers, defaultMarkerScale, updateBannerInfo]);

  // Use effect to setup auto-close polygon when drawing mode changes
  useEffect(() => {
    const cleanup = setupAutoClosePolygon();
    return cleanup;
  }, [setupAutoClosePolygon, isDrawingMode, fieldPolygons, saveToUndoStack, updateEdgeMarkers, defaultMarkerScale, updateBannerInfo]);

  // Call onAreaUpdate whenever the area changes
  useEffect(() => {
    if (onAreaUpdate && fieldPolygons.length > 0) {
      // Calculate total area of all polygons
      const totalArea = fieldPolygons.reduce((sum, polygon) => {
        const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
        return sum + (area / 10000); // Convert square meters to hectares
      }, 0);
      
      onAreaUpdate(totalArea);
    }
  }, [fieldPolygons, onAreaUpdate]);

  // Client-side effect
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Add a helper function to create vertex markers consistently - place this before the return statement
  const createVertexMarker = useCallback((vertex: google.maps.LatLng, index: number, map: google.maps.Map) => {
    const marker = new google.maps.Marker({
      position: vertex,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#FFFFFF',
        fillOpacity: 0.5,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
      draggable: false,
      zIndex: 2
    });
    
    // Store the vertex index
    marker.set('vertexIndex', index);
    
    let dragMarker: google.maps.Marker | null = null;

    const showRedMarker = (marker: google.maps.Marker) => {
      // First clear all existing red markers
      clearAllRedMarkers();
      
      const position = marker.getPosition();
      if (!position) return;
      
      // Create the red location marker
      dragMarker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
          path: LOCATION_MARKER_PATH,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
          scale: defaultMarkerScale,
          anchor: new google.maps.Point(12, 22),
          rotation: MARKER_ROTATION
        },
        draggable: true,
        crossOnDrag: false,
        zIndex: 3
      });
      
      // Store the drag marker reference in the vertex marker
      marker.set('dragMarker', dragMarker);
      
      // Set this as the active vertex marker
      activeVertexMarkerRef.current = marker;
      
      // Hide the original marker
      marker.setOpacity(0);

      // Get the vertex index from the marker
      const index = marker.get('vertexIndex');
      if (typeof index !== 'number') return;

      // Add drag listeners to the red marker
      dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        window.tempVerticesRef[index] = e.latLng;
        
        // Update the original marker position too (even while invisible)
        marker.setPosition(e.latLng);
        
        if (window.tempPolylineRef) {
          const path = window.tempVerticesRef.slice();
          if (window.tempVerticesRef.length >= 3) {
            path.push(window.tempVerticesRef[0]);
          }
          window.tempPolylineRef.setPath(path);
        }
        updateEdgeMarkers();
        
        // Update banner info while dragging
        updateBannerInfo();
      });
      
      // Add dragend listener to update the white marker position
      dragMarker.addListener('dragend', () => {
        // Save state after moving vertex with red marker
        const newState = [...window.tempVerticesRef];
        setUndoStack(prev => [...prev, newState]);
        setRedoStack([]); // Clear redo stack after a new action
        // Force update canUndo/canRedo state immediately
        setCanUndo(true);
        setCanRedo(false);
        
        // Update the position of the original white marker
        const finalPosition = dragMarker?.getPosition();
        if (finalPosition) {
          marker.setPosition(finalPosition);
        }
        
        // Clean up the drag marker
        if (dragMarker) {
          dragMarker.setMap(null);
        }
        marker.set('dragMarker', null);
        marker.setOpacity(1);
        activeVertexMarkerRef.current = null;
      });
    };

    // Add click listener to show red marker
    marker.addListener('click', () => {
      showRedMarker(marker);
    });

    // Also show red marker on dragstart
    marker.addListener('dragstart', () => {
      // Since marker is not draggable, this might not be needed,
      // but we'll keep it for completeness
      saveToUndoStack([...window.tempVerticesRef]);
      showRedMarker(marker);
    });
    
    // Add dragend handler to ensure red marker is removed
    marker.addListener('dragend', () => {
      // Find and remove any red drag marker
      const currentDragMarker = marker.get('dragMarker');
      if (currentDragMarker) {
        currentDragMarker.setMap(null);
        marker.set('dragMarker', null);
      }
      
      // Make white marker visible again
      marker.setOpacity(1);
      
      // Clear active vertex reference
      if (activeVertexMarkerRef.current === marker) {
        activeVertexMarkerRef.current = null;
      }
      
      // Save state after dragging
      saveToUndoStack([...window.tempVerticesRef]);
    });
    
    window.tempMarkersRef.push(marker);
    return marker;
  }, [map, updateEdgeMarkers, saveToUndoStack, defaultMarkerScale, updateBannerInfo]);

  // Add handler for polygon click
  const handlePolygonClick = useCallback((index: number) => {
    if (isDrawingMode) return;
    
    // Toggle selection if clicking the same polygon
    if (selectedPolygonIndex === index) {
      // Just deselect the polygon
      setSelectedPolygonIndex(null);
      // Close the tools menu when deselecting
      setShowPolygonTools(false);
      // Clear selected field info
      setSelectedFieldInfo(null);
    } else {
      // Select the new polygon
      setSelectedPolygonIndex(index);
      
      // Get the styling properties from the clicked polygon
      const polygon = fieldPolygons[index];
      
      // Calculate area
      const path = polygon.getPath();
      const area = google.maps.geometry.spherical.computeArea(path);
      const areaInHectares = area / 10000; // Convert to hectares
      
      // Calculate perimeter
      let perimeter = 0;
      for (let i = 0; i < path.getLength(); i++) {
        const p1 = path.getAt(i);
        const p2 = path.getAt((i + 1) % path.getLength());
        perimeter += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
      }
      const perimeterInKm = perimeter / 1000; // Convert to kilometers
      
      // Update field info
      setSelectedFieldInfo({
        area: areaInHectares,
        perimeter: perimeterInKm,
        name: polygon.get('fieldName') || `Field ${index + 1}`
      });
      
      setPolygonStyles({
        strokeColor: polygon.get('strokeColor') || strokeColor,
        fillColor: polygon.get('fillColor') || polygonColor,
        strokeWeight: polygon.get('strokeWeight') || strokeWeight,
        fillOpacity: polygon.get('fillOpacity') || polygonFillOpacity,
        fieldName: polygon.get('fieldName') || `Field ${index + 1}`,
      });
      
      // Don't automatically show tools when selecting a polygon
      // The user will need to click the tools button to show the menu
    }
  }, [isDrawingMode, selectedPolygonIndex, fieldPolygons, strokeColor, polygonColor, strokeWeight, polygonFillOpacity]);

  // Add handlers for polygon style changes
  const handleChangeStrokeColor = useCallback((color: string) => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      polygon.setOptions({ strokeColor: color });
      polygon.set('strokeColor', color);
      setPolygonStyles(prev => ({ ...prev, strokeColor: color }));
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  const handleChangeFillColor = useCallback((color: string) => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      polygon.setOptions({ fillColor: color });
      polygon.set('fillColor', color);
      setPolygonStyles(prev => ({ ...prev, fillColor: color }));
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  const handleChangeStrokeWeight = useCallback((weight: number) => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      polygon.setOptions({ strokeWeight: weight });
      polygon.set('strokeWeight', weight);
      setPolygonStyles(prev => ({ ...prev, strokeWeight: weight }));
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  const handleChangeFillOpacity = useCallback((opacity: number) => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      polygon.setOptions({ fillOpacity: opacity });
      polygon.set('fillOpacity', opacity);
      setPolygonStyles(prev => ({ ...prev, fillOpacity: opacity }));
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  const handleToggleEditable = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      const currentEditable = polygon.getEditable();
      
      // First hide all vertex/edge markers for all polygons
      fieldPolygons.forEach((poly, index) => {
        if (index !== selectedPolygonIndex) {
          poly.setEditable(false);
          poly.setDraggable(false);
          
          // Hide markers
          const vertexMarkers = poly.get('vertexMarkers') || [];
          vertexMarkers.forEach((marker: google.maps.Marker) => {
            marker.setMap(null);
          });
          
          const edgeMarkers = poly.get('edgeMarkers') || [];
          edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
            marker.setMap(null);
          });
        }
      });
      
      // Toggle editable state
      const newEditable = !currentEditable;
      polygon.setEditable(newEditable);
      
      // Show/hide markers based on editable state
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      const edgeMarkers = polygon.get('edgeMarkers') || [];
      
      if (newEditable) {
        // Show vertex markers
        vertexMarkers.forEach((marker: google.maps.Marker) => {
          marker.setMap(map);
        });
        
        // Show edge markers for edge click & drag functionality
        edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
          marker.setMap(map);
        });
        
        // The addEdgeMarkers function might be needed to update markers
        const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
        if (typeof addEdgeMarkersFn === 'function') {
          addEdgeMarkersFn();
        }
      } else {
        // Hide all markers
        vertexMarkers.forEach((marker: google.maps.Marker) => {
          marker.setMap(null);
        });
        
        edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
          marker.setMap(null);
        });
        
        // Clear any active drag markers
        clearAllRedMarkers();
      }
    }
  }, [fieldPolygons, selectedPolygonIndex, map]);

  const handleToggleDraggable = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      const currentDraggable = polygon.getDraggable();
      
      // Toggle draggable state
      polygon.setDraggable(!currentDraggable);
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  const handleDeletePolygon = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      // Get the polygon to delete
      const polygon = fieldPolygons[selectedPolygonIndex];
      
      // Clean up any markers associated with this polygon
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      vertexMarkers.forEach((marker: google.maps.Marker) => {
        marker.setMap(null);
      });
      
      const edgeMarkers = polygon.get('edgeMarkers') || [];
      edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
        marker.setMap(null);
      });
      
      // Remove the custom label overlay
      const overlay = polygon.get('labelOverlay') as any;
      if (overlay && typeof overlay.setMap === 'function') {
        overlay.setMap(null);
      }
      
      const labelDiv = polygon.get('labelDiv') as HTMLDivElement;
      if (labelDiv && labelDiv.parentElement) {
        labelDiv.parentElement.removeChild(labelDiv);
      }
      
      // Remove the polygon from the map
      polygon.setMap(null);
      
      // Update the state - create a new array without the deleted polygon
      setFieldPolygons(prev => prev.filter((_, index) => index !== selectedPolygonIndex));
      
      // Close the tools panel
      setShowPolygonTools(false);
      setSelectedPolygonIndex(null);
      
      // Clear selected field info
      setSelectedFieldInfo(null);
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  // Add a function to handle finishing the drawing
  const handleFinishDrawing = useCallback(() => {
    // Check if we have at least 3 vertices to make a polygon
    if (window.tempVerticesRef && window.tempVerticesRef.length >= 3) {
      // Create a polygon from current vertices
      const polygon = new google.maps.Polygon({
        map: map,
        paths: window.tempVerticesRef,
        strokeColor: strokeColor,
        strokeWeight: strokeWeight,
        fillColor: polygonColor,
        fillOpacity: polygonFillOpacity,
        editable: false,
        draggable: false
      });
      
      // Clean up temporary drawing objects
        if (window.tempPolylineRef) {
        window.tempPolylineRef.setMap(null);
        window.tempPolylineRef = null;
      }
      
      // Clean up temporary markers
      if (window.tempMarkersRef) {
        window.tempMarkersRef.forEach((marker: google.maps.Marker) => marker.setMap(null));
        window.tempMarkersRef = [];
      }
      
      if (window.tempEdgeMarkersRef) {
        window.tempEdgeMarkersRef.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
          if (marker) {
            marker.setMap(null);
          }
        });
        window.tempEdgeMarkersRef = [];
      }
      
      // Call onPolygonComplete to finish the process
      onPolygonComplete(polygon);
    } else {
      // Show some feedback that we need at least 3 points
      alert("Please add at least 3 points to create a field");
    }
  }, [map, onPolygonComplete, polygonColor, polygonFillOpacity, strokeColor, strokeWeight]);

  // Add a function to handle cancelling the drawing
  const handleCancelDrawing = useCallback(() => {
    // Clear any active red markers first
    clearAllRedMarkers();
    
    // Clean up temporary drawing objects
    if (window.tempPolylineRef) {
      window.tempPolylineRef.setMap(null);
      window.tempPolylineRef = null;
    }
    
    // Clean up temporary markers
    if (window.tempMarkersRef) {
      window.tempMarkersRef.forEach(marker => {
        // Clear any drag markers associated with these markers
        const dragMarker = marker.get('dragMarker');
        if (dragMarker) {
          dragMarker.setMap(null);
          marker.set('dragMarker', null);
        }
        marker.setMap(null);
      });
      window.tempMarkersRef = [];
    }
    
    if (window.tempEdgeMarkersRef) {
      window.tempEdgeMarkersRef.forEach(marker => {
        if (marker instanceof google.maps.Marker) {
          // Clear any drag markers associated with these markers
          const dragMarker = marker.get('dragMarker');
          if (dragMarker) {
            dragMarker.setMap(null);
            marker.set('dragMarker', null);
          }
          marker.setMap(null);
        } else {
          marker.setMap(null);
        }
      });
      window.tempEdgeMarkersRef = [];
    }
    
    // Reset vertices
    window.tempVerticesRef = [];
    
    // Exit drawing mode
    setIsDrawingMode(false);
    
    // Reset undo/redo stacks
    setUndoStack([]);
    setRedoStack([]);
    setCanUndo(false);
    setCanRedo(false);
    
    // Clear selected field info
    setSelectedFieldInfo(null);
  }, [clearAllRedMarkers]);

  // Add handler for field name changes
  const handleChangeName = useCallback((name: string) => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      polygon.set('fieldName', name);
      setPolygonStyles(prev => ({ ...prev, fieldName: name }));
      
      // Update custom label overlay content
      const overlay = polygon.get('labelOverlay') as any;
      if (overlay && typeof overlay.updateContent === 'function') {
        // Calculate area
        const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
        const areaInHectares = area / 10000; // Convert to hectares
        
        // Update content
        overlay.updateContent(name, areaInHectares);
      }
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  // Function to add field label to center of polygon
  const addFieldLabel = useCallback((polygon: google.maps.Polygon) => {
    if (!map) return;
    
    // Remove existing label if any
    const existingLabel = polygon.get('infoWindow') as google.maps.InfoWindow;
    if (existingLabel) {
      existingLabel.close();
    }
    
    // Calculate center of polygon
    const path = polygon.getPath();
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    const center = bounds.getCenter();
    
    // Calculate area
    const area = google.maps.geometry.spherical.computeArea(path);
    const areaInHectares = area / 10000; // Convert to hectares
    
    // Get field name
    const fieldName = polygon.get('fieldName') || 'Field';
    
    // Create an InfoWindow as the label
    const infoWindow = new google.maps.InfoWindow({
      position: center,
      disableAutoPan: true,
      content: `
        <div style="text-align: center; font-weight: bold;">
          <div>${fieldName}</div>
          <div style="font-size: 12px;">${areaInHectares.toFixed(2)} ha</div>
        </div>
      `
    });
    
    // Remove the close button and make it non-interactive
    infoWindow.addListener('domready', () => {
      const closeButtons = document.querySelectorAll('.gm-ui-hover-effect');
      closeButtons.forEach(button => {
        (button as HTMLElement).style.display = 'none';
      });
      
      // Find the content wrapper and remove the default InfoWindow styling
      const infoWindowContent = document.querySelector('.gm-style-iw-d');
      if (infoWindowContent) {
        (infoWindowContent as HTMLElement).style.overflow = 'visible';
        
        // Remove padding from the container
        const container = infoWindowContent.parentElement;
        if (container) {
          (container as HTMLElement).style.padding = '0';
        }
        
        // Remove the default shadow/background
        const background = container?.parentElement;
        if (background) {
          const children = background.children;
          for (let i = 0; i < children.length; i++) {
            if (i !== 0) { // Keep only the content, hide the shadows/background elements
              (children[i] as HTMLElement).style.display = 'none';
            }
          }
        }
      }
    });
    
    // Store the InfoWindow with the polygon and open it
    polygon.set('infoWindow', infoWindow);
    infoWindow.open(map);
  }, [map]);

  // Update field labels when needed
  const updateFieldLabels = useCallback(() => {
    fieldPolygons.forEach(polygon => {
      addFieldLabel(polygon);
    });
  }, [fieldPolygons, addFieldLabel]);

  // Add effect to update field labels
  useEffect(() => {
    if (!map || fieldPolygons.length === 0) return;
    
    // First, clean up any existing labels
    fieldPolygons.forEach((polygon) => {
      const existingLabel = polygon.get('labelDiv') as HTMLDivElement;
      if (existingLabel) {
        existingLabel.parentElement?.removeChild(existingLabel);
      }
      
      // Also close any existing InfoWindows if they exist
      const existingInfoWindow = polygon.get('infoWindow') as google.maps.InfoWindow;
      if (existingInfoWindow) {
        existingInfoWindow.close();
        polygon.set('infoWindow', null);
      }
    });
    
    // Create custom overlays for all polygons
    fieldPolygons.forEach((polygon, index) => {
      // Calculate polygon center
      const path = polygon.getPath();
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      const center = bounds.getCenter();
      
      // Calculate polygon area
      const area = google.maps.geometry.spherical.computeArea(path);
      const areaInHectares = area / 10000; // Convert to hectares
      
      // Get field name
      const fieldName = polygon.get('fieldName') || `Field ${index + 1}`;
      
      // Create a custom overlay
      class FieldLabelOverlay extends google.maps.OverlayView {
        private position: google.maps.LatLng;
        private fieldName: string;
        private area: number;
        private div: HTMLDivElement | null = null;
        
        constructor(position: google.maps.LatLng, fieldName: string, area: number) {
          super();
          this.position = position;
          this.fieldName = fieldName;
          this.area = area;
          this.setMap(map);
        }
        
        onAdd() {
          // Create the div to hold the label
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.backgroundColor = 'transparent';
          div.style.padding = '0';
          div.style.fontWeight = 'bold';
          div.style.textAlign = 'center';
          div.style.pointerEvents = 'none'; // Allow clicking through
          div.style.whiteSpace = 'nowrap';
          div.style.fontSize = '14px';
          div.style.fontFamily = 'Arial, sans-serif';
          div.style.textShadow = '0px 0px 2px white, 0px 0px 2px white, 0px 0px 2px white, 0px 0px 2px white'; // Text shadow to make text readable on any background
          div.innerHTML = `
            <div style="color: black;">${this.fieldName}</div>
            <div style="color: black; font-size: 12px;">${this.area.toFixed(2)} ha</div>
          `;
          
          this.div = div;
            
          // Add the div to the overlay layer
          const panes = this.getPanes();
          if (panes) {
            panes.overlayLayer.appendChild(div);
          }
          
          // Store a reference to the div with the polygon
          polygon.set('labelDiv', div);
          polygon.set('labelOverlay', this);
        }
        
        draw() {
          if (!this.div) return;
          
          // Position the div on the map
          const overlayProjection = this.getProjection();
          const position = overlayProjection.fromLatLngToDivPixel(this.position);
          
          if (position) {
            this.div.style.left = (position.x - (this.div.offsetWidth / 2)) + 'px';
            this.div.style.top = (position.y - (this.div.offsetHeight / 2)) + 'px';
          }
        }
        
        onRemove() {
          if (this.div) {
            this.div.parentNode?.removeChild(this.div);
            this.div = null;
          }
        }
        
        // Method to update content
        updateContent(fieldName: string, area: number) {
          this.fieldName = fieldName;
          this.area = area;
          
          if (this.div) {
            this.div.innerHTML = `
              <div style="color: black;">${this.fieldName}</div>
              <div style="color: black; font-size: 12px;">${this.area.toFixed(2)} ha</div>
            `;
          }
        }
        
        // Method to update position
        updatePosition(position: google.maps.LatLng) {
          this.position = position;
          this.draw();
        }
      }
      
      // Create a new label overlay
      new FieldLabelOverlay(center, fieldName, areaInHectares);
    });
    
    // Clean up function to remove overlays
    return () => {
      fieldPolygons.forEach((polygon) => {
        const overlay = polygon.get('labelOverlay') as google.maps.OverlayView;
        if (overlay) {
          overlay.setMap(null);
        }
        
        const div = polygon.get('labelDiv') as HTMLDivElement;
        if (div) {
          div.parentElement?.removeChild(div);
        }
      });
    };
  }, [fieldPolygons, map]);
  
  // Update label positions when the map is idle (after zoom/pan)
  useEffect(() => {
    if (!map) return;
    
    const listener = map.addListener('idle', () => {
      fieldPolygons.forEach((polygon) => {
        const overlay = polygon.get('labelOverlay') as any;
        if (overlay && typeof overlay.updatePosition === 'function') {
          // Recalculate center
          const path = polygon.getPath();
          const bounds = new google.maps.LatLngBounds();
          path.forEach(point => bounds.extend(point));
          const center = bounds.getCenter();
          
          // Update overlay position
          overlay.updatePosition(center);
        }
      });
    });
    
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [fieldPolygons, map]);

  // Add the handleUndo function  
  const handleUndo = useCallback(() => {
                  // Skip all state checks and directly execute handler with synchronous action
                  if (window.tempVerticesRef && undoStack.length > 0) {
                    // Immediately apply undo without waiting for state updates
                    const prevVertices = undoStack[undoStack.length - 1];
                    
                    // Store current state in redo array
                    const currentVertices = [...window.tempVerticesRef];
                    const newRedoStack = [...redoStack, currentVertices];
                    
                    // Update global vertices directly
                    window.tempVerticesRef = [...prevVertices];
                    
                    // Update polyline directly without waiting for state to update
                    if (window.tempPolylineRef) {
                      const path = prevVertices.slice();
                      if (prevVertices.length >= 3) {
                        path.push(prevVertices[0]);
                      }
                      window.tempPolylineRef.setPath(path);
                    }
                    
                    // Clear current markers
                    if (window.tempMarkersRef) {
                      window.tempMarkersRef.forEach(marker => marker.setMap(null));
                      window.tempMarkersRef = [];
                    }
                    
                    // Clear current edge markers
                    if (window.tempEdgeMarkersRef) {
                      window.tempEdgeMarkersRef.forEach(marker => {
                        if (marker) {
                          marker.setMap(null);
                        }
                      });
                      window.tempEdgeMarkersRef = [];
                    }
                    
                    // Create new markers immediately
                    if (map && prevVertices.length > 0) {
                      prevVertices.forEach((vertex, index) => {
                        createVertexMarker(vertex, index, map);
                      });
                    }
                    
                    // Update the stacks only after visual changes are complete
                    setUndoStack(undoStack.slice(0, -1));
                    setRedoStack(newRedoStack);
                    
                    // Recreate edge markers
                    updateEdgeMarkers();
                  }
  }, [createVertexMarker, map, redoStack, undoStack, updateEdgeMarkers]);

  // Add the handleRedo function
  const handleRedo = useCallback(() => {
                  // Skip all state checks and directly execute handler with synchronous action
                  if (window.tempVerticesRef && redoStack.length > 0) {
                    // Immediately apply redo without waiting for state updates
                    const nextVertices = redoStack[redoStack.length - 1];
                    
                    // Store current state in undo array
                    const currentVertices = [...window.tempVerticesRef];
                    const newUndoStack = [...undoStack, currentVertices];
                    
                    // Update global vertices directly
                    window.tempVerticesRef = [...nextVertices];
                    
                    // Update polyline directly without waiting for state to update
                    if (window.tempPolylineRef) {
                      const path = nextVertices.slice();
                      if (nextVertices.length >= 3) {
                        path.push(nextVertices[0]);
                      }
                      window.tempPolylineRef.setPath(path);
                    }
                    
                    // Clear current markers
                    if (window.tempMarkersRef) {
                      window.tempMarkersRef.forEach(marker => marker.setMap(null));
                      window.tempMarkersRef = [];
                    }
                    
                    // Clear current edge markers
                    if (window.tempEdgeMarkersRef) {
                      window.tempEdgeMarkersRef.forEach(marker => {
                        if (marker) {
                          marker.setMap(null);
                        }
                      });
                      window.tempEdgeMarkersRef = [];
                    }
                    
                    // Create new markers immediately
                    if (map && nextVertices.length > 0) {
                      nextVertices.forEach((vertex, index) => {
                        createVertexMarker(vertex, index, map);
                      });
                    }
                    
                    // Update the stacks only after visual changes are complete
                    setUndoStack(newUndoStack);
                    setRedoStack(redoStack.slice(0, -1));
                    
                    // Recreate edge markers
                    updateEdgeMarkers();
                  }
  }, [createVertexMarker, map, redoStack, undoStack, updateEdgeMarkers]);

  // Add handler for adding field images
  const handleAddFieldImage = useCallback(async (fieldIndex: number, file: File) => {
    if (!user || fieldIndex === null) return;

    try {
      // Show loading state with local URL
      const localUrl = URL.createObjectURL(file);
      setFieldImages(prev => ({
        ...prev,
        [fieldIndex]: {
          images: [localUrl],
          mainImageIndex: 0
        }
      }));

      // Upload to Firebase Storage
      const downloadURL = await uploadFieldImage(file, user.uid, fieldIndex.toString());
      
      // Update state with Firebase URL
      setFieldImages(prev => ({
        ...prev,
        [fieldIndex]: {
          images: [downloadURL],
          mainImageIndex: 0
        }
      }));
      
      // Update the polygon's properties
      const updatedPolygons = [...fieldPolygons];
      const polygon = updatedPolygons[fieldIndex];
      if (polygon) {
        polygon.set('fieldImages', [downloadURL]);
        polygon.set('fieldMainImageIndex', 0);
        setFieldPolygons(updatedPolygons);
        onPolygonUpdate?.(updatedPolygons);
      }

      // Clean up the local URL
      URL.revokeObjectURL(localUrl);
    } catch (error) {
      console.error('Error adding field image:', error);
      alert('Failed to add image. Please try again.');
      
      // Clean up on error
      setFieldImages(prev => {
        const newState = { ...prev };
        delete newState[fieldIndex];
        return newState;
      });
    }
  }, [fieldPolygons, user, onPolygonUpdate]);

  // Add handler for deleting field images
  const handleDeleteFieldImage = useCallback((fieldIndex: number, imageIndex: number) => {
    setFieldImages(prev => {
      const fieldData = prev[fieldIndex];
      if (!fieldData) return prev;
      
      const updatedImages = [...fieldData.images];
      updatedImages.splice(imageIndex, 1);
      
      // Adjust mainImageIndex if needed
      let mainImageIndex = fieldData.mainImageIndex;
      if (mainImageIndex >= updatedImages.length) {
        mainImageIndex = updatedImages.length > 0 ? 0 : 0;
      }
      
      const updatedFieldData = {
        images: updatedImages,
        mainImageIndex
      };
      
      // Update the polygon's properties
      if (fieldIndex < fieldPolygons.length) {
        const polygon = fieldPolygons[fieldIndex];
        polygon.set('fieldImages', updatedImages);
        polygon.set('fieldMainImageIndex', mainImageIndex);
      }
      
      if (updatedImages.length === 0) {
        const newState = { ...prev };
        delete newState[fieldIndex];
        return newState;
      }
      
      return {
        ...prev,
        [fieldIndex]: updatedFieldData
      };
    });
  }, [fieldPolygons]);

  // Add a new handler for setting the main image
  const handleSetMainImage = useCallback((fieldIndex: number, imageIndex: number) => {
    setFieldImages(prev => {
      const fieldData = prev[fieldIndex];
      if (!fieldData || imageIndex >= fieldData.images.length) return prev;
      
      const updatedFieldData = {
        ...fieldData,
        mainImageIndex: imageIndex
      };
      
      // Update the polygon's properties
      if (fieldIndex < fieldPolygons.length) {
        const polygon = fieldPolygons[fieldIndex];
        polygon.set('fieldMainImageIndex', imageIndex);
      }
      
      return {
        ...prev,
        [fieldIndex]: updatedFieldData
      };
    });
  }, [fieldPolygons]);

  // Update the loadFieldImages function to handle multiple images
  const loadFieldImages = useCallback(() => {
    const images: FieldImages = {};
    
    fieldPolygons.forEach((polygon, index) => {
      const fieldImages = polygon.get('fieldImages');
      if (fieldImages && Array.isArray(fieldImages) && fieldImages.length > 0) {
        const mainImageIndex = polygon.get('fieldMainImageIndex') || 0;
        images[index] = {
          images: fieldImages,
          mainImageIndex: mainImageIndex < fieldImages.length ? mainImageIndex : 0
        };
      }
    });
    
    setFieldImages(images);
  }, [fieldPolygons]);

  // Call loadFieldImages when field polygons change
  useEffect(() => {
    loadFieldImages();
  }, [loadFieldImages]);

  // ... existing code ...

  // Update the PolygonToolsMenu component props
  <PolygonToolsMenu 
    isOpen={showPolygonTools}
    onClose={() => setShowPolygonTools(false)}
    onChangeStrokeColor={handleChangeStrokeColor}
    onChangeFillColor={handleChangeFillColor}
    onChangeStrokeWeight={handleChangeStrokeWeight}
    onChangeFillOpacity={handleChangeFillOpacity}
    onChangeName={handleChangeName}
    onDelete={handleDeletePolygon}
    onAddImage={(file) => selectedPolygonIndex !== null && handleAddFieldImage(selectedPolygonIndex, file)}
    onDeleteImage={(imageIndex) => selectedPolygonIndex !== null && handleDeleteFieldImage(selectedPolygonIndex, imageIndex)}
    onSetMainImage={(imageIndex) => selectedPolygonIndex !== null && handleSetMainImage(selectedPolygonIndex, imageIndex)}
    strokeColor={polygonStyles.strokeColor}
    fillColor={polygonStyles.fillColor}
    strokeWeight={polygonStyles.strokeWeight}
    fillOpacity={polygonStyles.fillOpacity}
    fieldName={polygonStyles.fieldName}
    fieldImages={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
      ? fieldImages[selectedPolygonIndex].images 
      : []}
    mainImageIndex={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
      ? fieldImages[selectedPolygonIndex].mainImageIndex 
      : 0}
    selectedPolygonIndex={selectedPolygonIndex}
  />

  // ... existing code ...

  // Function to save all field polygons to Firestore
  const handleSaveAllFields = useCallback(async () => {
    if (!user) {
      alert('Please log in to save your fields');
      return;
    }

    try {
      setIsSaving(true);
      
      // Save each polygon to Firestore
      const savedIds = await Promise.all(
        fieldPolygons.map(async (polygon, index) => {
          // Convert polygon to FieldData format
          const fieldData = polygonToFieldData(polygon, index);
          
          // Save to Firestore
          await saveField(fieldData);
          
          // Set the fieldId on the polygon for future updates
          polygon.set('fieldId', fieldData.id);
          
          return fieldData.id;
        })
      );
      
      // Show temporary success message in banner
      const notificationElement = document.getElementById('save-notification');
      const notificationTextElement = document.getElementById('save-notification-text');
      if (notificationElement && notificationTextElement) {
        notificationTextElement.textContent = `Successfully saved ${savedIds.length} fields`;
        notificationElement.style.display = 'block';
        notificationElement.className = 'fixed top-14 left-0 right-0 bg-green-500 text-white p-2 z-50 text-center';
        
        // Hide the notification after 3 seconds
        setTimeout(() => {
          notificationElement.style.display = 'none';
        }, 3000);
      }
      
      setShowSaveOptions(false);
    } catch (error) {
      console.error('Error saving fields:', error);
      
      // Show error message in banner
      const notificationElement = document.getElementById('save-notification');
      const notificationTextElement = document.getElementById('save-notification-text');
      if (notificationElement && notificationTextElement) {
        notificationTextElement.textContent = 'Error saving fields. Please try again later.';
        notificationElement.style.display = 'block';
        notificationElement.className = 'fixed top-14 left-0 right-0 bg-red-500 text-white p-2 z-50 text-center';
        
        // Hide the notification after 3 seconds
        setTimeout(() => {
          notificationElement.style.display = 'none';
        }, 3000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [fieldPolygons, user]);
  
  // Function to save the currently selected field to Firestore
  const handleSaveCurrentField = useCallback(async () => {
    if (!user) {
      alert('Please log in to save your fields');
      return;
    }
    
    if (selectedPolygonIndex === null) {
      alert('Please select a field to save');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Get the selected polygon
      const polygon = fieldPolygons[selectedPolygonIndex];
      
      // Convert polygon to FieldData format
      const fieldData = polygonToFieldData(polygon, selectedPolygonIndex);
      
      // Save to Firestore
      await saveField(fieldData);
      
      // Set the fieldId on the polygon for future updates
      polygon.set('fieldId', fieldData.id);
      
      alert('Field saved successfully');
      setShowSaveOptions(false);
    } catch (error) {
      console.error('Error saving field:', error);
      alert('Error saving field. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  }, [fieldPolygons, selectedPolygonIndex, user]);
  
  // Function to load fields from Firestore - REMOVED as fields should stay on map until deleted
  // const handleLoadFields = useCallback(async () => {
  //   // Loading functionality removed
  // }, []);
  
  // Function to load a specific field from the loaded fields list - REMOVED as fields should stay on map
  // const handleLoadField = useCallback((fieldData: any) => {
  //   // Loading functionality removed
  // }, []);
  
  // Function to delete a field from Firestore
  const handleDeleteFieldFromFirestore = useCallback(async (fieldId: string) => {
    if (!user) {
      alert('Please log in to delete your fields');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this field? This cannot be undone.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Delete from Firestore
      await deleteField(fieldId);
      
      // Remove from loaded fields
      setLoadedFields(prev => prev.filter(field => field.id !== fieldId));
      
      alert('Field deleted successfully');
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Error deleting field. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Check Firebase permissions and load user data when user changes
  useEffect(() => {
    const checkPermissionsAndLoadData = async () => {
      if (user) {
        // Check permissions
        const hasPermissions = await checkFirestorePermissions();
        
        // Show notification if permissions are not available
        const notificationElement = document.getElementById('permission-notification');
        if (notificationElement) {
          notificationElement.style.display = hasPermissions ? 'none' : 'block';
        }
        
        if (!hasPermissions) {
          console.warn('Firebase permissions unavailable. Using local storage fallback.');
        }
        
        // Load user's fields if we have none loaded yet
        if (fieldPolygons.length === 0 && map && !isDrawingMode) {
          try {
            // Load fields without showing any loading animation
            const fields = await getUserFields();
            
            if (fields && fields.length > 0) {
              // Automatically load all fields without asking
              fields.forEach(fieldData => {
                const polygon = fieldDataToPolygon(fieldData, map);
                setFieldPolygons(prev => [...prev, polygon]);
              });
              
              // Fit map to show all fields
              setTimeout(() => {
                if (fields.length === 1) {
                  centerMapOnField(map, fields[0]);
                } else if (fields.length > 1) {
                  const bounds = new google.maps.LatLngBounds();
                  fields.forEach(field => {
                    field.points.forEach(point => {
                      bounds.extend(new google.maps.LatLng(point.lat, point.lng));
                    });
                  });
                  map.fitBounds(bounds);
                }
              }, 100);
            }
          } catch (error) {
            console.error('Error loading fields after authentication:', error);
          }
        }
      }
    };
    
    checkPermissionsAndLoadData();
  }, [user, map, fieldPolygons.length, isDrawingMode]);

  // Add handler for toggling distance measurement
  const handleToggleDistanceMeasurement = useCallback(() => {
    // If already measuring, turn it off
    if (isMeasuringDistance) {
      setIsMeasuringDistance(false);
      return;
    }

    // If drawing, cancel it first
    if (isDrawingMode) {
      handleCancelDrawing();
    }

    // If editing a field, close the polygon tools
    if (showPolygonTools) {
      setShowPolygonTools(false);
    }

    // Start measuring
    setIsMeasuringDistance(true);
  }, [isMeasuringDistance, isDrawingMode, showPolygonTools, handleCancelDrawing]);

  if (!isClient) {
    return <div className={cn("h-full w-full", className)} />;
  }

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
        libraries={libraries}
      >
        <div className="flex flex-col h-screen w-full">
          <Navbar 
            onPlaceSelect={handlePlaceSelect} 
            isDrawingMode={isDrawingMode}
            onCancelDrawing={handleCancelDrawing}
            onFinishDrawing={handleFinishDrawing}
            canFinishDrawing={window.tempVerticesRef && window.tempVerticesRef.length >= 3}
          />
          
          <div style={mapStyles.container}>
            {/* Add the area information banner for selected field */}
            {selectedFieldInfo && !isDrawingMode && (
              <div className="absolute top-0 left-0 right-0 bg-black/50 shadow-lg z-20 p-2">
                <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">{selectedFieldInfo.name}:</span>
                    <span className="text-green-400 font-medium">
                      {selectedFieldInfo.area.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Perimeter:</span>
                    <span className="text-blue-400 font-medium">
                      {selectedFieldInfo.perimeter.toFixed(2)} km
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Add the drawing mode banner */}
            {isDrawingMode && (
              <div className="absolute top-0 left-0 right-0 bg-black/50 shadow-lg z-20 p-2">
                <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Area:</span>
                    <span className="text-green-400 font-medium">
                      {bannerInfo.area.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Perimeter:</span>
                    <span className="text-blue-400 font-medium">
                      {bannerInfo.perimeter.toFixed(2)} km
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Vertices:</span>
                    <span className="text-purple-400 font-medium">
                      {bannerInfo.vertices}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <GoogleMap
              mapContainerStyle={mapStyles.map}
              center={defaultCenter}
              zoom={15}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            >
              {/* User location marker */}
              {userLocation && (
                <>
                  <Marker
                    position={userLocation}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 12,
                      fillColor: '#4285F4',
                      fillOpacity: 1,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 2,
                    }}
                    zIndex={1000}
                  />
                  <Circle
                    center={userLocation}
                    radius={20}
                    options={{
                      fillColor: '#4285F4',
                      fillOpacity: 0.2,
                      strokeColor: '#4285F4',
                      strokeOpacity: 0.5,
                      strokeWeight: 1,
                    }}
                  />
                </>
              )}
              
              {/* We're not using DrawingManager anymore for our custom implementation */}
              
              {/* Display existing field polygons - render in reverse order so later polygons are drawn on top */}
              {[...fieldPolygons].reverse().map((polygon, reversedIndex) => {
                // Calculate the original index from the reversed index
                const index = fieldPolygons.length - 1 - reversedIndex;
                return (
                <Polygon
                  key={index}
                  paths={polygon.getPath().getArray()}
                  options={{
                      fillColor: polygon.get('fillColor') || polygonColor,
                      fillOpacity: polygon.get('fillOpacity') || polygonFillOpacity,
                      strokeColor: polygon.get('strokeColor') || strokeColor,
                      strokeWeight: selectedPolygonIndex === index ? 4 : (polygon.get('strokeWeight') || strokeWeight),
                      clickable: true,
                      editable: polygon.getEditable(),
                      draggable: polygon.getDraggable(),
                      zIndex: selectedPolygonIndex === index ? 1000 : (index + 10), // Give higher z-index to more recently created polygons
                  }}
                  onClick={(e) => {
                      // If we're in drawing mode, let the click pass through
                    if (isDrawingMode) {
                        e.stop();
                      
                      // Manually forward the click to the map to add a vertex
                      if (e.latLng && map) {
                        google.maps.event.trigger(map, 'click', { 
                          latLng: e.latLng,
                          stop: () => {} // Dummy function to match event interface
                        });
                      }
                      } else {
                        // Otherwise, select this polygon
                        e.stop(); // Prevent the event from bubbling to polygons below
                        handlePolygonClick(index);
                    }
                  }}
                />
                );
              })}
            </GoogleMap>

            {/* Add toggle button for polygon tools */}
            {selectedPolygonIndex !== null && (
              <div className="absolute bottom-20 right-4 z-10">
                <button
                  onClick={() => setShowPolygonTools(prev => !prev)}
                  className="bg-white rounded-full shadow-lg p-3 transition-all hover:bg-gray-100 border-2 border-green-500"
                  title={showPolygonTools ? "Close Field Tools" : "Open Field Tools"}
                >
                  <FontAwesomeIcon 
                    icon={showPolygonTools ? faClose : faCog} 
                    className="text-xl text-green-700" 
                  />
                </button>
              </div>
            )}

            {/* Add the PolygonToolsMenu component */}
            <PolygonToolsMenu 
              isOpen={showPolygonTools}
              onClose={() => setShowPolygonTools(false)}
              onChangeStrokeColor={handleChangeStrokeColor}
              onChangeFillColor={handleChangeFillColor}
              onChangeStrokeWeight={handleChangeStrokeWeight}
              onChangeFillOpacity={handleChangeFillOpacity}
              onChangeName={handleChangeName}
              onDelete={handleDeletePolygon}
              onAddImage={(file) => selectedPolygonIndex !== null && handleAddFieldImage(selectedPolygonIndex, file)}
              onDeleteImage={(imageIndex) => selectedPolygonIndex !== null && handleDeleteFieldImage(selectedPolygonIndex, imageIndex)}
              onSetMainImage={(imageIndex) => selectedPolygonIndex !== null && handleSetMainImage(selectedPolygonIndex, imageIndex)}
              strokeColor={polygonStyles.strokeColor}
              fillColor={polygonStyles.fillColor}
              strokeWeight={polygonStyles.strokeWeight}
              fillOpacity={polygonStyles.fillOpacity}
              fieldName={polygonStyles.fieldName}
              fieldImages={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
                ? fieldImages[selectedPolygonIndex].images 
                : []}
              mainImageIndex={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
                ? fieldImages[selectedPolygonIndex].mainImageIndex 
                : 0}
              selectedPolygonIndex={selectedPolygonIndex}
            />

            {/* Drawing controls banner */}
            {isDrawingMode && (
              <div className="fixed bottom-0 left-0 right-0 bg-black/80 shadow-lg z-50 p-2 w-full block">
                <div className="flex justify-between items-center max-w-full px-1 sm:px-2 mx-2">
                  {/* Left side: Cancel button */}
                  <div>
                    <button
                      onClick={handleCancelDrawing}
                      className="flex items-center gap-1 px-2 py-2 bg-red-500 text-white rounded-md shadow hover:bg-red-600 transition-colors"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                  
                  {/* Center: Undo/Redo buttons */}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                        undoStack.length > 0
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                      title="Undo"
                    >
                      <FontAwesomeIcon icon={faUndo} />
                    </button>
                    
                    <button
                      onClick={handleRedo}
                  disabled={redoStack.length === 0}
                      className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                        redoStack.length > 0
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  title="Redo"
                >
                      <FontAwesomeIcon icon={faRedo} />
                  </button>
                  </div>
                  
                  {/* Right side: Finish button */}
                  <div>
                    <button
                      onClick={handleFinishDrawing}
                      disabled={window.tempVerticesRef.length < 3}
                      className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                        window.tempVerticesRef.length >= 3
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <FontAwesomeIcon icon={faCheck} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <MapControls
            currentMapType={mapType}
            onMapTypeChange={setMapType}
            onLocationClick={handleLocationClick}
            onToggleFullscreen={handleToggleFullscreen}
            isLocating={isLocating}
          />

          <CreateMenu
            showMenu={showCreateMenu}
            onToggleMenu={() => {
              // Deselect any selected field when toggling the create menu
              if (selectedPolygonIndex !== null) {
                setSelectedPolygonIndex(null);
                setShowPolygonTools(false);
                setSelectedFieldInfo(null);
              }
              setShowCreateMenu(!showCreateMenu);
            }}
            onOptionSelect={handleCreateOption}
          />

          <ZoomControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
          
          {/* Save/Load button group */}
          {user && (
            <div className="absolute bottom-32 right-4 z-10 flex flex-col gap-2">
              <div className="relative">
                <button
                  onClick={handleSaveAllFields}
                  disabled={isDrawingMode || fieldPolygons.length === 0}
                  className={`bg-white rounded-full shadow-lg p-3 transition-all hover:bg-gray-100 ${
                    isDrawingMode || fieldPolygons.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Save All Fields"
                >
                  <FontAwesomeIcon 
                    icon={faFileImport} 
                    className="text-xl text-blue-700" 
                  />
                </button>
                
                {/* Save options dropdown removed - now automatically saves all fields */}
              </div>
              
              {/* Load Fields button removed as drawn fields should remain on the map */}
            </div>
          )}
          
          {/* Load fields menu - Removed as drawn fields should remain on the map */}
          
          {/* Add hidden file input for importing files */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".kml,.geojson,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              // Handle file upload logic here
              if (e.target.files && e.target.files.length > 0) {
                // Process the file (implementation would depend on your requirements)
                console.log("File selected:", e.target.files[0].name);
                
                // Reset the input value to allow selecting the same file again
                e.target.value = '';
              }
            }}
          />
        </div>
        
        {/* Permission error message banner */}
        {user && (
          <div id="permission-notification" style={{ display: 'none' }} 
            className="fixed top-14 left-0 right-0 bg-amber-500 text-white p-2 z-50 text-center">
            <p className="text-sm">
              Unable to connect to cloud storage. Your fields will be saved locally on this device only.
            </p>
          </div>
        )}
        
        {/* Save notification banner */}
        <div id="save-notification" style={{ display: 'none' }} 
          className="fixed top-14 left-0 right-0 bg-green-500 text-white p-2 z-50 text-center">
          <p id="save-notification-text" className="text-sm">Notification message</p>
        </div>

        {/* Measure Distance Tool */}
        {map && (
          <DistanceMeasurement 
            map={map} 
            isActive={isMeasuringDistance} 
            onClose={() => setIsMeasuringDistance(false)} 
          />
        )}
      </LoadScript>
    </div>
  );
};

// Add TypeScript declarations for the window object to avoid errors
declare global {
  interface Window {
    tempPolylineRef: google.maps.Polyline | null;
    tempVerticesRef: google.maps.LatLng[];
    tempMarkersRef: google.maps.Marker[];
    tempEdgeMarkersRef: (google.maps.Marker | google.maps.OverlayView)[];
  }
}

// Initialize global variables
if (typeof window !== 'undefined') {
  window.tempPolylineRef = null;
  window.tempVerticesRef = [];
  window.tempMarkersRef = [];
  window.tempEdgeMarkersRef = [];
}

export default MapComponent;