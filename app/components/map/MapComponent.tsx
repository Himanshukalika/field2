'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Circle, DrawingManager, Polygon } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { throttle, debounce } from '../../utils/debounce';
import { 
  faDrawPolygon, 
  faTrash, 
  faTimes, 
  faCog, 
  faPlus, 
  faEdit,
  faLocationDot,
  faRuler,
  faFileImport,
  faUndo,
  faRedo,
  faCheck,
  faPalette, 
  faFill, 
  faBorderStyle,
  faTag,
  faImage,
  faInfoCircle,
  faBrush, 
  faArrowsAlt,
  faPencilAlt,
  faPen,
  faEllipsisV,
  faObjectGroup,
  faObjectUngroup,
  faFileAlt
} from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';
import PolygonToolsMenu from './PolygonToolsMenu';
import { useAuth } from '@/app/context/AuthContext';
import { saveField, getUserFields, deleteField, checkFirestorePermissions, getUserDistanceMeasurements, deleteDistanceMeasurement } from '../../lib/firebase';
import { polygonToFieldData, fieldDataToPolygon, centerMapOnField } from '../../lib/mapUtils';
import { v4 as uuidv4 } from 'uuid';
import { uploadFieldImage, deleteFieldImage, getFieldImageUrl } from '@/app/lib/storage';
import DistanceMeasurement from './DistanceMeasurement';
import MarkerComponent from './MarkerComponent';
import { collection, getAggregateFromServer, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { MarkerData } from './types';
import FieldImageGallery from './FieldImageGallery';
import FieldDetailsForm from './FieldDetailsForm';
import { saveFieldOwnerDetails, getFieldOwnerDetails } from '../../lib/firebase';
import { FieldFormData } from './FieldDetailsForm';

// Local utility function for className merging
function cn(...classNames: (string | undefined)[]) {
  return classNames.filter(Boolean).join(' ');
}

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

const libraries: ("places" | "drawing" | "geometry")[] = ["places", "drawing", "geometry"];

const polygonColor = '#00C853'; // Bright green color
const polygonFillOpacity = 0.1;
const strokeColor = '#00C853';
const strokeWeight = 1;

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
  onToggleEditable?: () => void;
  onToggleDraggable?: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldName: string;
  fieldImages: string[];
  mainImageIndex: number;
  selectedPolygonIndex: number | null;
  isEditable?: boolean;
  isDraggable?: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ onAreaUpdate, onPolygonUpdate, className }) => {
  // Add authentication hook
  const { user, login } = useAuth();
  
  const [isClient, setIsClient] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [lastPosition, setLastPosition] = useState<{lat: number, lng: number} | null>(null);
  
  // Function to save the last position to localStorage
  const saveLastPosition = useCallback((position: {lat: number, lng: number}) => {
    // Save to state
    setLastPosition(position);
    
    // Save to localStorage for persistence between sessions
    try {
      localStorage.setItem('lastMapPosition', JSON.stringify(position));
    } catch (error) {
      console.error('Error saving last position to localStorage:', error);
    }
  }, []);
  
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
  
  // Add state for tracking if the selected polygon is editable or draggable
  const [isSelectedPolygonEditable, setIsSelectedPolygonEditable] = useState(false);
  const [isSelectedPolygonDraggable, setIsSelectedPolygonDraggable] = useState(false);

  // New state for save/load functionality
  const [isSaving, setIsSaving] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);  // New state for edit mode save button
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [loadedFields, setLoadedFields] = useState<any[]>([]);

  const [measureDistanceMode, setMeasureDistanceMode] = useState<boolean>(false);
  const [measurePoints, setMeasurePoints] = useState<google.maps.LatLngLiteral[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [markerMode, setMarkerMode] = useState<boolean>(false);

  // Add a state to store loaded distance measurements
  const [loadedDistanceMeasurements, setLoadedDistanceMeasurements] = useState<any[]>([]);

  // Add a state to store the currently selected measurement
  const [selectedMeasurement, setSelectedMeasurement] = useState<any>(null);
  
  // Add state for distance measurement tools menu
  const [showDistanceTools, setShowDistanceTools] = useState(false);
  
  // Add states for distance measurement styles
  const [distanceStyles, setDistanceStyles] = useState({
    strokeColor: "#00AA00",
    fillColor: "#00AA00",
    strokeWeight: 3,
    fillOpacity: 0.1,
    name: ''
  });
  
  // Add states to store references to measurement polylines and polygons
  const [measurementPolylines, setMeasurementPolylines] = useState<Record<string, google.maps.Polyline>>({});
  const [measurementPolygons, setMeasurementPolygons] = useState<Record<string, google.maps.Polygon>>({});

  // Add state for advanced tools dropdown
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  
  // Add state for merge mode
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [polygonsToMerge, setPolygonsToMerge] = useState<number[]>([]);

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
            // Track already loaded field IDs to prevent duplicates
            const loadedFieldIds = new Set(fieldPolygons.map(polygon => polygon.get('fieldId')));
            
            // Create a batch of polygons to add at once (more efficient than multiple state updates)
            const newPolygons: google.maps.Polygon[] = [];
            
            // Implement lazy loading - only load fields that are within the current viewport or nearby
            const bounds = map.getBounds();
            const visibleFields = fields.filter(fieldData => {
              // If we don't have bounds yet, include all fields
              if (!bounds) return true;
              
              // Check if any point of the field is within the current viewport
              return fieldData.points.some((point: {lat: number, lng: number}) => 
                bounds.contains(new google.maps.LatLng(point.lat, point.lng))
              );
            });
            
            // Get remaining fields for later lazy loading
            const remainingFields = fields.filter(fieldData => 
              !visibleFields.some(vField => vField.id === fieldData.id)
            );
            
            // Store remaining fields for lazy loading when map moves
            setRemainingFieldsToLoad(remainingFields);
            
            // Automatically load visible fields without asking the user
            visibleFields.forEach(fieldData => {
              // Skip if this field is already loaded
              if (fieldData.id && loadedFieldIds.has(fieldData.id)) {
                console.log(`Field ${fieldData.id} already loaded, skipping`);
                return;
              }
              
              // Create the polygon but don't add to map yet
              const polygon = fieldDataToPolygon(fieldData, null); // Pass null instead of map
              
              // Store the field ID with the polygon for future reference
              if (fieldData.id) {
                polygon.set('fieldId', fieldData.id);
                loadedFieldIds.add(fieldData.id); // Mark as loaded
              }
              
              // Add to our batch
              newPolygons.push(polygon);
            });
            
            // Now add all polygons to the map and state at once
            if (newPolygons.length > 0) {
              // First add to map
              newPolygons.forEach(polygon => polygon.setMap(map));
              
              // Then update state once
              setFieldPolygons(prev => [...prev, ...newPolygons]);
              
              // No need to auto-zoom when loading fields
              // Keeping the default zoom level instead of zooming to fit all fields
            }
          }
        } catch (error) {
          console.error('Error auto-loading fields:', error);
        }
      };
      
      loadUserFields();
    }
  }, [user, map, isLoading, isDrawingMode, fieldPolygons.length]);

  // Add state for remaining fields to load
  const [remainingFieldsToLoad, setRemainingFieldsToLoad] = useState<any[]>([]);

  // Add an effect to load more fields when the map bounds change
  useEffect(() => {
    if (!map || remainingFieldsToLoad.length === 0) return;
    
    // Create a listener for when the map bounds change
    const boundsChangedListener = map.addListener('idle', () => {
      // Don't load more fields if we're in drawing mode
      if (isDrawingMode) return;
      
      const bounds = map.getBounds();
      if (!bounds) return;
      
      // Track already loaded field IDs
      const loadedFieldIds = new Set(fieldPolygons.map(polygon => polygon.get('fieldId')));
      
      // Find fields that are now visible
      const newVisibleFields = remainingFieldsToLoad.filter(fieldData => 
        fieldData.points.some((point: {lat: number, lng: number}) => 
          bounds.contains(new google.maps.LatLng(point.lat, point.lng))
        )
      );
      
      // If we have new visible fields, load them
      if (newVisibleFields.length > 0) {
        // Create a batch of polygons
        const newPolygons: google.maps.Polygon[] = [];
        
        newVisibleFields.forEach(fieldData => {
          // Skip if this field is already loaded
          if (fieldData.id && loadedFieldIds.has(fieldData.id)) return;
          
          // Create the polygon
          const polygon = fieldDataToPolygon(fieldData, null);
          
          // Store the field ID
          if (fieldData.id) {
            polygon.set('fieldId', fieldData.id);
          }
          
          // Add to batch
          newPolygons.push(polygon);
        });
        
        // Add polygons to map
        newPolygons.forEach(polygon => polygon.setMap(map));
        
        // Update state
        setFieldPolygons(prev => [...prev, ...newPolygons]);
        
        // Remove loaded fields from the remaining fields
        setRemainingFieldsToLoad(prev => 
          prev.filter(field => 
            !newVisibleFields.some(vField => vField.id === field.id)
          )
        );
      }
    });
    
    return () => {
      // Clean up listener when component unmounts
      google.maps.event.removeListener(boundsChangedListener);
    };
  }, [map, remainingFieldsToLoad, fieldPolygons, isDrawingMode]);

  // Use throttle function for performance optimization
  
  // Add an effect to optimize visibility of polygons
  useEffect(() => {
    if (!map || fieldPolygons.length === 0) return;
    
    // Create a throttled function to update polygon visibility
    const updatePolygonVisibility = throttle(() => {
      const bounds = map.getBounds();
      if (!bounds) return;
      
      // Update visibility of polygons based on current viewport
      fieldPolygons.forEach(polygon => {
        const path = polygon.getPath();
        let isVisible = false;
        
        // Check if any point of the polygon is within the viewport
        for (let i = 0; i < path.getLength(); i++) {
          if (bounds.contains(path.getAt(i))) {
            isVisible = true;
            break;
          }
        }
        
        // Set the map property based on visibility
        // This is more efficient than removing/adding the polygon
        if (isVisible && polygon.getMap() !== map) {
          polygon.setMap(map);
        } else if (!isVisible && polygon.getMap() === map) {
          // Only hide polygons if we have more than a certain threshold
          if (fieldPolygons.length > 20) {
            polygon.setMap(null);
          }
        }
      });
    }, 150); // Throttle to once every 150ms for better performance
    
    // Create a listener for when the map bounds change
    const boundsChangedListener = map.addListener('idle', updatePolygonVisibility);
    const dragListener = map.addListener('drag', updatePolygonVisibility);
    
    return () => {
      // Clean up listeners when component unmounts
      google.maps.event.removeListener(boundsChangedListener);
      google.maps.event.removeListener(dragListener);
    };
  }, [map, fieldPolygons]);

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
    polygon.set('fieldName', polygon.get('fieldName') || 'Area');
    
    // Save the last position where the field was created
    const polygonPath = polygon.getPath();
    if (polygonPath.getLength() > 0) {
      const center = polygonPath.getAt(0);
      saveLastPosition({
        lat: center.lat(),
        lng: center.lng()
      });
    }
    
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
          ? `${distance.toFixed(3)}m`
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
            map.setZoom(23); // Maximum zoom level for detailed view
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
        } catch (error) {
          console.error('Error logging in:', error);
          return;
        }
        } else {
        return;
      }
    }
    
    if (option === 'import') {
      // Handle import
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else if (option === 'field') {
      // Start drawing mode
          setIsDrawingMode(true);
    } else if (option === 'distance') {
      // Activate distance measurement mode
      if (isDrawingMode) {
        // Exit drawing mode if active
        setIsDrawingMode(false);
      }
      setMeasureDistanceMode(true);
    } else if (option === 'marker') {
      // Activate marker mode
      if (isDrawingMode) {
        // Exit drawing mode if active
        setIsDrawingMode(false);
      }
      if (measureDistanceMode) {
        // Exit measure distance mode if active
        setMeasureDistanceMode(false);
      }
      setMarkerMode(true);
    }
  }, [user, login, map, isDrawingMode, measureDistanceMode]);

  // Function to exit marker mode
  const handleExitMarkerMode = useCallback(() => {
    setMarkerMode(false);
  }, []);

  // Handle place selection from search
  const handlePlaceSelect = useCallback((location: google.maps.LatLng) => {
    if (map) {
      map.panTo(location);
      map.setZoom(23); // Maximum zoom level for detailed view
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
    maxZoom: 23, // Forcing maximum possible zoom level (beyond the official limit of 22)
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
            ? `${distance.toFixed(3)}m`
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
          // Create final polygon - IMPORTANT: Don't set editable or draggable to true initially
          const polygon = new google.maps.Polygon({
            map: map,
            paths: vertices,
            strokeColor: strokeColor,  // Use the green color
            strokeWeight: strokeWeight,
            fillColor: polygonColor,  // Use the green color
            fillOpacity: polygonFillOpacity,
            editable: false, // Set to false initially to prevent ghost fields
            draggable: false // Set to false initially to prevent ghost fields
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
    
    // Load last position from localStorage if available
    try {
      const savedPosition = localStorage.getItem('lastMapPosition');
      if (savedPosition) {
        const position = JSON.parse(savedPosition);
        setLastPosition(position);
      }
    } catch (error) {
      console.error('Error loading last position from localStorage:', error);
    }
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
    
    console.log("Polygon clicked:", index);
    
    // If in merge mode, handle polygon selection for merging
    if (isMergeMode) {
      // Handle polygon selection for merging directly
      const polygon = fieldPolygons[index];
      
      setPolygonsToMerge(prev => {
        // If already selected, remove it
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        }
        // Otherwise add it
        return [...prev, index];
      });
      
      return;
    }
    
    // First, reset all polygons to their default styling
    fieldPolygons.forEach((poly, polyIndex) => {
      if (polyIndex !== index) {
        poly.setOptions({
          strokeWeight: poly.get('strokeWeight') || strokeWeight,
          zIndex: polyIndex + 10
        });
      }
    });
    
    // Toggle selection if clicking the same polygon
    if (selectedPolygonIndex === index) {
      console.log("Deselecting polygon:", index);
      
      // Get the current polygon to reset its styling
      const polygon = fieldPolygons[index];
      
      // Store the original styling values from the polygon or use defaults
      const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
      
      // Reset the polygon's visual styling to original values
      polygon.setOptions({
        strokeWeight: originalStrokeWeight,
        zIndex: index + 10
      });
      
      // Just deselect the polygon
      setSelectedPolygonIndex(null);
      // Close the tools menu when deselecting
      setShowPolygonTools(false);
      // Clear selected field info
      setSelectedFieldInfo(null);
      // Reset editable/draggable state
      setIsSelectedPolygonEditable(false);
      setIsSelectedPolygonDraggable(false);
      
      // Make sure to reset any active editing state
      polygon.setEditable(false);
      polygon.setDraggable(false);
    } else {
      console.log("Selecting polygon:", index);
      
      // First, make sure any previously selected polygon is reset
      if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
        const prevPolygon = fieldPolygons[selectedPolygonIndex];
        
        // Get the original stroke weight for the previously selected polygon
        const originalStrokeWeight = prevPolygon.get('originalStrokeWeight') || strokeWeight;
        
        // Reset its styling and state
        prevPolygon.setOptions({
          strokeWeight: originalStrokeWeight,
          zIndex: selectedPolygonIndex + 10
        });
        
        // Ensure it's not editable or draggable
        prevPolygon.setEditable(false);
        prevPolygon.setDraggable(false);
      }
      
      // Select the new polygon
      setSelectedPolygonIndex(index);
      
      // Get the styling properties from the clicked polygon
      const polygon = fieldPolygons[index];
      
      // Store the original stroke weight before highlighting
      const currentStrokeWeight = polygon.get('strokeWeight') || strokeWeight;
      polygon.set('originalStrokeWeight', currentStrokeWeight);
      
      // Make the selected polygon stand out visually
      polygon.setOptions({
        strokeWeight: 4,
        zIndex: 1000
      });
      
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
        name: polygon.get('fieldName') || 'Area'
      });
      
      setPolygonStyles({
        strokeColor: polygon.get('strokeColor') || strokeColor,
        fillColor: polygon.get('fillColor') || polygonColor,
        strokeWeight: polygon.get('strokeWeight') || strokeWeight,
        fillOpacity: polygon.get('fillOpacity') || polygonFillOpacity,
        fieldName: polygon.get('fieldName') || 'Area',
      });
      
      // Set editable/draggable state
      setIsSelectedPolygonEditable(polygon.getEditable());
      setIsSelectedPolygonDraggable(polygon.getDraggable());
      
      // Don't automatically show tools when selecting a polygon
      // The user will need to click the tools button to show the menu
    }
  }, [isDrawingMode, isMergeMode, selectedPolygonIndex, fieldPolygons, strokeColor, polygonColor, strokeWeight, polygonFillOpacity]);

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
      console.log("Toggle editable for polygon index:", selectedPolygonIndex);
      const polygon = fieldPolygons[selectedPolygonIndex];
      const currentEditable = polygon.getEditable();
      
      // Get the original stroke weight before entering edit mode
      const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
      
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
      console.log("New editable state:", newEditable);
      
      // Important: Set the React state first
      setIsSelectedPolygonEditable(newEditable);
      
      // Reset the polygon's stroke weight to its original value when entering edit mode
      if (newEditable) {
        polygon.setOptions({
          strokeWeight: originalStrokeWeight
        });
        
        // Function to add edge markers with distance labels for the polygon
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
            
            // Calculate distance
            const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            const distanceText = distance < 1000 
              ? `${distance.toFixed(3)}m`
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
            angle = 0;
            
            // Create a simple distance label overlay directly (not using DistanceOverlayRef)
            class SimpleDistanceOverlay extends google.maps.OverlayView {
              private position: google.maps.LatLng | google.maps.LatLngLiteral;
              private content: string;
              private div: HTMLDivElement | null = null;
              
              constructor(position: google.maps.LatLng | google.maps.LatLngLiteral, content: string) {
                super();
                this.position = position;
                this.content = content;
              }
              
              onAdd() {
                // Create container div
                this.div = document.createElement('div');
                this.div.style.position = 'absolute';
                this.div.style.backgroundColor = 'transparent';
                this.div.style.color = 'white';
                this.div.style.padding = '0';
                this.div.style.fontSize = '14px';
                this.div.style.fontWeight = 'bold';
                this.div.style.textShadow = '0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black, 0px 0px 2px black';
                this.div.style.zIndex = '1000';
                this.div.style.userSelect = 'none';
                this.div.style.whiteSpace = 'nowrap';
                this.div.style.transform = 'translate(-50%, -50%)';
                this.div.style.fontFamily = 'Arial, sans-serif';
                this.div.style.textAlign = 'center';
                this.div.textContent = this.content;
                
                const panes = this.getPanes();
                panes?.overlayLayer.appendChild(this.div);
              }
              
              draw() {
                const overlayProjection = this.getProjection();
                if (!overlayProjection || !this.div) return;
                
                // Fix type error: Ensure position.lat and position.lng are numbers, not functions
                const lat = typeof this.position.lat === 'function' ? this.position.lat() : this.position.lat;
                const lng = typeof this.position.lng === 'function' ? this.position.lng() : this.position.lng;
                
                const position = overlayProjection.fromLatLngToDivPixel(
                  new google.maps.LatLng(lat, lng)
                );
                
                if (position) {
                  this.div.style.left = position.x + 'px';
                  this.div.style.top = position.y + 'px';
                }
              }
              
              onRemove() {
                if (this.div) {
                  this.div.parentNode?.removeChild(this.div);
                  this.div = null;
                }
              }
            }
            
            // Create and add the simple distance overlay
            const overlay = new SimpleDistanceOverlay(midpoint, distanceText);
            overlay.setMap(map);
            newEdgeMarkers.push(overlay as unknown as google.maps.OverlayView);
            
            // Create a clickable edge marker at midpoint
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
              draggable: false,
              zIndex: 2
            });
            
            newEdgeMarkers.push(edgeMarker);
          }
          
                  // Store the edge markers on the polygon for later cleanup
        polygon.set('edgeMarkers', newEdgeMarkers);
      };
      
      // Store the addEdgeMarkers function on the polygon for access by other functions
      polygon.set('addEdgeMarkers', addEdgeMarkers);
      
      // Add edge markers with distance labels
      addEdgeMarkers();
      
      // Update edge markers when polygon path changes
      google.maps.event.addListener(polygon.getPath(), 'set_at', addEdgeMarkers);
      google.maps.event.addListener(polygon.getPath(), 'insert_at', addEdgeMarkers);
      google.maps.event.addListener(polygon.getPath(), 'remove_at', addEdgeMarkers);
      }
      
      // When entering edit mode, hide the selection panel with Edit/Move buttons
      // by temporarily removing the selectedFieldInfo
      if (newEditable) {
        // Store the current field info before clearing it
        const currentInfo = selectedFieldInfo;
        polygon.set('savedFieldInfo', currentInfo);
        
        // Clear selectedFieldInfo which will hide the top yellow banner
        setSelectedFieldInfo(null);
        
        // Calculate the current measurements to display in the edit mode banner
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
        
        // After a small delay to let the panel hide, restore field info to show edit mode banner
        setTimeout(() => {
          setSelectedFieldInfo({
            area: areaInHectares,
            perimeter: perimeterInKm,
            name: polygon.get('fieldName') || 'Area'
          });
        }, 50);
        
        // Initialize undo/redo stacks for edit mode
        // Store the current path in a format that can be used for undo/redo
        const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
        
        // Save the initial state to the polygon for reference
        polygon.set('initialPath', currentPath);
        
        // Reset undo/redo stacks when entering edit mode
        setUndoStack([currentPath]);
        setRedoStack([]);
        setCanUndo(false);
        setCanRedo(false);
        
        // Store the current polygon path in the window.tempVerticesRef for undo/redo operations
        window.tempVerticesRef = currentPath;
        
        // Add path change listener for real-time updates
        const pathListener = google.maps.event.addListener(path, 'set_at', () => {
          updateFieldInfoRealTime(polygon);
        });
        
        // Add another listener for insert_at events (when vertices are added)
        const insertListener = google.maps.event.addListener(path, 'insert_at', () => {
          updateFieldInfoRealTime(polygon);
        });
        
        // Add another listener for remove_at events (when vertices are removed)
        const removeListener = google.maps.event.addListener(path, 'remove_at', () => {
          updateFieldInfoRealTime(polygon);
        });
        
        // Store listeners for cleanup
        polygon.set('pathListeners', [pathListener, insertListener, removeListener]);
        
      } else {
        // When exiting edit mode, restore the original field info from before editing
        const savedInfo = polygon.get('savedFieldInfo');
        if (savedInfo) {
          setSelectedFieldInfo(savedInfo);
        }
        
        // Make the selected polygon stand out visually again
        polygon.setOptions({
          strokeWeight: 4,
          zIndex: 1000
        });
        
        // Clear the undo/redo stacks when exiting edit mode
        setUndoStack([]);
        setRedoStack([]);
        setCanUndo(false);
        setCanRedo(false);
        
        // Remove path change listeners
        const pathListeners = polygon.get('pathListeners') || [];
        pathListeners.forEach((listener: google.maps.MapsEventListener) => {
          google.maps.event.removeListener(listener);
        });
        
        // Remove edge marker listeners
        google.maps.event.clearListeners(polygon.getPath(), 'set_at');
        google.maps.event.clearListeners(polygon.getPath(), 'insert_at');
        google.maps.event.clearListeners(polygon.getPath(), 'remove_at');
        
        // Remove all edge markers
        const edgeMarkers = polygon.get('edgeMarkers') || [];
        edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
          marker.setMap(null);
        });
        
        // Clear edge markers array
        polygon.set('edgeMarkers', []);
      }
        
      // Show/hide markers based on editable state
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      const edgeMarkers = polygon.get('edgeMarkers') || [];
  
      console.log("Number of vertex markers:", vertexMarkers.length);
      console.log("Number of edge markers:", edgeMarkers.length);
        
      if (newEditable) {
        console.log("Setting markers visible");
        
        // Create vertex markers if they don't exist
        if (vertexMarkers.length === 0) {
          console.log("No vertex markers found, creating new ones");
          // Create vertex markers for the polygon path
          const path = polygon.getPath();
          const newVertexMarkers: google.maps.Marker[] = [];
          
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
            
            // Store the vertex index
            marker.set('vertexIndex', i);
            marker.set('parentPolygon', polygon);
            
            // Add click handler to show a red marker
            marker.addListener('click', () => {
              // Clear any existing red markers first
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
              
              // Store drag marker reference
              marker.set('dragMarker', dragMarker);
              
              // Set this as active vertex marker
              activeVertexMarkerRef.current = marker;
              
              // Hide white marker
              marker.setOpacity(0);
              
              // Add drag listener
              dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
                if (!e.latLng) return;
                const idx = marker.get('vertexIndex');
                if (typeof idx === 'number') {
                  // Update vertex in polygon path
                  path.setAt(idx, e.latLng);
                  
                  // Update marker position
                  marker.setPosition(e.latLng);
                  
                  // If there's an addEdgeMarkers function, call it
                  const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
                  if (typeof addEdgeMarkersFn === 'function') {
                    addEdgeMarkersFn();
                  }
                  
                  // Update field info in real-time during drag
                  updateFieldInfoRealTime(polygon);
                }
              });
              
              // Add dragend listener
              dragMarker.addListener('dragend', () => {
                console.log("Vertex marker drag complete at index:", marker.get('vertexIndex'));
                
                // Update the final position
                const finalPosition = dragMarker.getPosition();
                if (finalPosition) {
                  const idx = marker.get('vertexIndex');
                  if (typeof idx === 'number') {
                    // Make sure the path is updated with final position
                    path.setAt(idx, finalPosition);
                    marker.setPosition(finalPosition);
                  }
                }
                
                // Save current state to undo stack for edit mode
                const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
                setUndoStack(prev => [...prev, currentPath]);
                setRedoStack([]);
                setCanUndo(true);
                setCanRedo(false);
                
                // Update window.tempVerticesRef for undo/redo operations
                window.tempVerticesRef = currentPath;
                
                // Clean up drag marker
                if (dragMarker) {
                  dragMarker.setMap(null);
                }
                
                // Reset white marker
                marker.set('dragMarker', null);
                marker.setOpacity(1);
                
                // Update edge markers with final positions
                const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
                if (typeof addEdgeMarkersFn === 'function') {
                  addEdgeMarkersFn();
                }
                
                // Clear active reference
                if (activeVertexMarkerRef.current === marker) {
                  activeVertexMarkerRef.current = null;
                }
              });
            });
            
            newVertexMarkers.push(marker);
          }
          
          // Store the newly created markers
          polygon.set('vertexMarkers', newVertexMarkers);
          
          // Create function to add/update edge markers
          const addEdgeMarkers = () => {
            console.log("Creating edge markers");
            // Remove existing edge markers
            const oldEdgeMarkers = polygon.get('edgeMarkers') || [];
            oldEdgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
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
              
              // Create edge marker
              const edgeMarker = new google.maps.Marker({
                position: midpoint,
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 5,
                  fillColor: '#FFFFFF',
                  fillOpacity: 0.5,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2,
                },
                draggable: false,
                zIndex: 2
              });
              
              // Store which edge this is for
              edgeMarker.set('edgeIndex', i);
              edgeMarker.set('parentPolygon', polygon);
              
              // Add click listener for drag functionality
              edgeMarker.addListener('click', () => {
                // Clear any existing red markers
                clearAllRedMarkers();
                
                const position = edgeMarker.getPosition();
                if (!position) return;
                
                // Create red marker
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
                
                // Store drag marker reference
                edgeMarker.set('dragMarker', dragMarker);
                
                // Set as active marker
                activeVertexMarkerRef.current = edgeMarker;
                
                // Hide white marker
                edgeMarker.setOpacity(0);
                
                                 // Add drag functionality
                 dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
                   if (!e.latLng) return;
                   const index = edgeMarker.get('edgeIndex');
                   
                   // Store information about whether we've already inserted the vertex
                   const vertexInserted = edgeMarker.get('vertexInserted');
                   
                   if (typeof index === 'number') {
                     if (!vertexInserted) {
                       console.log("First drag of edge marker - inserting new vertex at index:", index + 1);
                       // On first drag, insert a new vertex at drag position
                       path.insertAt(index + 1, e.latLng);
                       
                       // Create new vertex marker for this position
                       const newVertexMarker = new google.maps.Marker({
                         position: e.latLng,
                         map: null, // Don't show this now - we'll show the red marker
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
                       
                       // Add click handler to the new vertex marker (copy from other markers)
                       newVertexMarker.addListener('click', () => {
                         // Clear any existing red markers first
                         clearAllRedMarkers();
                         
                         const position = newVertexMarker.getPosition();
                         if (!position) return;
                         
                         // Create draggable red marker
                         const markerDragMarker = new google.maps.Marker({
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
                         
                         // Store drag marker reference
                         newVertexMarker.set('dragMarker', markerDragMarker);
                         
                         // Set this as active vertex marker
                         activeVertexMarkerRef.current = newVertexMarker;
                         
                         // Hide white marker
                         newVertexMarker.setOpacity(0);
                         
                         // Add drag listener
                         markerDragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
                           if (!e.latLng) return;
                           const idx = newVertexMarker.get('vertexIndex');
                           if (typeof idx === 'number') {
                             // Update vertex in polygon path
                             path.setAt(idx, e.latLng);
                             
                             // Update marker position
                             newVertexMarker.setPosition(e.latLng);
                             
                             // Update edge markers
                             addEdgeMarkers();
                           }
                         });
                         
                         // Add dragend listener
                         markerDragMarker.addListener('dragend', () => {
                           // Save current state to undo stack
                           const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
                           setUndoStack(prev => [...prev, currentPath]);
                           setRedoStack([]);
                           setCanUndo(true);
                           setCanRedo(false);
                           
                           // Update window.tempVerticesRef for undo/redo operations
                           window.tempVerticesRef = currentPath;
                           
                           // Clean up drag marker
                           if (markerDragMarker) {
                             markerDragMarker.setMap(null);
                           }
                           
                           // Reset white marker
                           newVertexMarker.set('dragMarker', null);
                           newVertexMarker.setOpacity(1);
                           
                           // Clear active reference
                           if (activeVertexMarkerRef.current === newVertexMarker) {
                             activeVertexMarkerRef.current = null;
                           }
                         });
                       });
                       
                       // Set vertex index
                       newVertexMarker.set('vertexIndex', index + 1);
                       newVertexMarker.set('parentPolygon', polygon);
                       
                       // Get current vertex markers
                       const vertexMarkers = polygon.get('vertexMarkers') || [];
                       
                       // Insert the new vertex marker at the correct position
                       vertexMarkers.splice(index + 1, 0, newVertexMarker);
                       
                       // Update vertex indices after insertion
                       for (let i = index + 2; i < vertexMarkers.length; i++) {
                         vertexMarkers[i].set('vertexIndex', i);
                       }
                       
                       // Update vertexMarkers in polygon
                       polygon.set('vertexMarkers', vertexMarkers);
                       
                       // Mark that we've inserted this vertex
                       edgeMarker.set('vertexInserted', true);
                       edgeMarker.set('insertedIndex', index + 1);
                       
                       // Store reference to the new vertex marker
                       edgeMarker.set('newVertexMarker', newVertexMarker);
                     }
                     
                     // Now update the position of the inserted vertex
                     const insertedIndex = edgeMarker.get('insertedIndex');
                     if (insertedIndex !== undefined) {
                       // Update the vertex position in path
                       path.setAt(insertedIndex, e.latLng);
                       
                       // Get the vertex marker and update its position too
                       const newVertexMarker = edgeMarker.get('newVertexMarker');
                       if (newVertexMarker) {
                         newVertexMarker.setPosition(e.latLng);
                       }
                       
                       // Update edge markers to reflect new vertex position
                       addEdgeMarkers();
                     }
                   }
                 });
                
                                 // Cleanup on dragend
                 dragMarker.addListener('dragend', () => {
                   console.log("Edge marker drag complete");
                   
                   // Save current state to undo stack
                   const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
                   setUndoStack(prev => [...prev, currentPath]);
                   setRedoStack([]);
                   setCanUndo(true);
                   setCanRedo(false);
                   
                   // Update window.tempVerticesRef for undo/redo operations
                   window.tempVerticesRef = currentPath;
                   
                   // Get the newly created vertex marker
                   const newVertexMarker = edgeMarker.get('newVertexMarker');
                   const insertedIndex = edgeMarker.get('insertedIndex');
                   
                   if (newVertexMarker && insertedIndex !== undefined) {
                     console.log("Setting up newly created vertex marker");
                     // Make the white marker visible at the final position
                     newVertexMarker.setMap(map);
                     
                     // Make sure the path actually has this vertex
                     const pathLength = path.getLength();
                     if (insertedIndex < pathLength) {
                       const finalPosition = path.getAt(insertedIndex);
                       newVertexMarker.setPosition(finalPosition);
                     }
                   }
                   
                   // Clean up drag marker
                   if (dragMarker) {
                     dragMarker.setMap(null);
                   }
                   
                   // Reset edge marker
                   if (edgeMarker && edgeMarker.getMap()) {
                     edgeMarker.set('dragMarker', null);
                     edgeMarker.setOpacity(1);
                   }
                   
                   // Reset tracking variables
                   edgeMarker.set('vertexInserted', false);
                   
                   // Update edge markers to reflect final position
                   addEdgeMarkers();
                   
                   // Clear active reference
                   activeVertexMarkerRef.current = null;
                 });
              });
              
              newEdgeMarkers.push(edgeMarker);
            }
            
            // Store the new edge markers
            polygon.set('edgeMarkers', newEdgeMarkers);
          };
          
          // Store the addEdgeMarkers function for future updates
          polygon.set('addEdgeMarkers', addEdgeMarkers);
          
          // Create initial edge markers
          addEdgeMarkers();
        } else {
          // Show existing vertex markers
          vertexMarkers.forEach((marker: google.maps.Marker) => {
            marker.setMap(map);
          });
          
          // Show existing edge markers
          edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
            marker.setMap(map);
          });
          
          // The addEdgeMarkers function might be needed to update markers
          const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
          if (typeof addEdgeMarkersFn === 'function') {
            addEdgeMarkersFn();
          }
        }
          } else {
        console.log("Setting markers invisible");
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
  }, [fieldPolygons, selectedPolygonIndex, map, clearAllRedMarkers, defaultMarkerScale, selectedFieldInfo]);

  const handleToggleDraggable = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      const currentDraggable = polygon.getDraggable();
      
      // Get the original stroke weight before entering drag mode
      const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
      
      // Toggle draggable state
      const newDraggable = !currentDraggable;
      
      // Set React state first
      setIsSelectedPolygonDraggable(newDraggable);
      
      // Reset the polygon's stroke weight to its original value when entering drag mode
      if (newDraggable) {
        polygon.setOptions({
          strokeWeight: originalStrokeWeight
        });
      }
      
      // When entering drag mode, hide the selection panel with Edit/Move buttons
      // by temporarily removing the selectedFieldInfo
      if (newDraggable) {
        // Store the current field info before clearing it
        const currentInfo = selectedFieldInfo;
        polygon.set('savedFieldInfo', currentInfo);
        
        // Clear selectedFieldInfo which will hide the top yellow banner
        setSelectedFieldInfo(null);
        
        // Calculate the current measurements for the edit mode banner
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
        
        // After a small delay to let the panel hide, restore field info to show edit mode banner
        setTimeout(() => {
          setSelectedFieldInfo({
            area: areaInHectares,
            perimeter: perimeterInKm,
            name: polygon.get('fieldName') || 'Area'
          });
        }, 50);
      } else {
        // When exiting drag mode, restore the original field info from before dragging
        const savedInfo = polygon.get('savedFieldInfo');
        if (savedInfo) {
          setSelectedFieldInfo(savedInfo);
        }
        
        // Make the selected polygon stand out visually again
        polygon.setOptions({
          strokeWeight: 4,
          zIndex: 1000
        });
      }
      
      // Make sure to temporarily hide this polygon to avoid flashing
      polygon.setMap(null);
      
      // Add a short delay to avoid visual glitches
      setTimeout(() => {
        // Add the polygon back to the map with the new draggable state
        polygon.setDraggable(newDraggable);
        polygon.setMap(map);
        
        // Add event listeners for real-time updates if draggable
        if (newDraggable) {
          // Add listener for drag events
          const dragListener = google.maps.event.addListener(polygon, 'drag', () => {
            updateFieldInfoRealTime(polygon);
          });
          
          // Store listener reference for cleanup
          polygon.set('dragListener', dragListener);
        } else {
          // Remove listeners when disabling drag
          const dragListener = polygon.get('dragListener');
          if (dragListener) {
            google.maps.event.removeListener(dragListener);
          }
        }
      }, 50);
    }
  }, [fieldPolygons, selectedPolygonIndex, map, selectedFieldInfo]);

  // Add a function to update field info in real-time during edits and drags
  const updateFieldInfoRealTime = useCallback((polygon: google.maps.Polygon) => {
    if (!polygon) return;
    
    const path = polygon.getPath();
    if (!path) return;
    
    // Calculate area
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
    
    // Update the field info
    setSelectedFieldInfo(prevInfo => {
      if (!prevInfo) return null;
      return {
        ...prevInfo,
        area: areaInHectares,
        perimeter: perimeterInKm
      };
    });
  }, []);

  const handleDeletePolygon = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      // Get the polygon to delete
      const polygon = fieldPolygons[selectedPolygonIndex];
      
      // Get the field ID if it exists
      const fieldId = polygon.get('fieldId');
      
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
      
      // Delete from Firebase if we have a field ID and the user is logged in
      if (fieldId && user) {
        // Delete the field from Firebase
        deleteField(fieldId).then(() => {
          console.log(`Field ${fieldId} deleted from database`);
          
          // Also remove from loaded fields if it exists there
          setLoadedFields(prev => prev.filter(field => field.id !== fieldId));
          
          // Show success notification
          const notificationElement = document.getElementById('save-notification');
          const notificationTextElement = document.getElementById('save-notification-text');
          if (notificationElement && notificationTextElement) {
            notificationTextElement.textContent = 'Field deleted successfully';
            notificationElement.style.display = 'block';
            
            // Hide after 3 seconds
            setTimeout(() => {
              notificationElement.style.display = 'none';
            }, 3000);
          }
        }).catch(error => {
          console.error('Error deleting field from database:', error);
          
          // Show error notification
          alert('Error deleting field from database. The field may reappear after refresh.');
        });
      }
    }
  }, [fieldPolygons, selectedPolygonIndex, user, setLoadedFields]);

  // Add a function to handle finishing the drawing and auto-save
  const handleFinishDrawing = useCallback(() => {
    // Check if we have at least 3 vertices to make a polygon
    if (window.tempVerticesRef && window.tempVerticesRef.length >= 3) {
      // Create a polygon from current vertices - IMPORTANT: Create without map first
      const polygon = new google.maps.Polygon({
        paths: window.tempVerticesRef, // Don't set map initially
        strokeColor: strokeColor,
        strokeWeight: strokeWeight,
        fillColor: polygonColor,
        fillOpacity: polygonFillOpacity,
        editable: false, // Always false to prevent Google's default editing behavior
        draggable: false
      });
      
      // Add to map after creation to prevent ghost fields
      polygon.setMap(map);
      
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
      const completedPolygon = onPolygonComplete(polygon);
      
      // Now automatically save the field if user is logged in
      if (user) {
        // Set a timeout to let the UI update first
        setTimeout(() => {
          // Save the newly created field
          try {
            // Convert to FieldData format
            const fieldData = polygonToFieldData(completedPolygon, fieldPolygons.length - 1);
            
            // Save silently in the background
            saveField(fieldData).then(fieldId => {
              // Update the polygon with the field ID
              completedPolygon.set('fieldId', fieldId);
              
              // Show success message
              const notificationElement = document.getElementById('save-notification');
              const notificationTextElement = document.getElementById('save-notification-text');
              if (notificationElement && notificationTextElement) {
                notificationTextElement.textContent = 'Field saved successfully';
                notificationElement.style.display = 'block';
                
                // Hide after 3 seconds
                setTimeout(() => {
                  notificationElement.style.display = 'none';
                }, 3000);
              }
            }).catch(error => {
              console.error('Error auto-saving field:', error);
            });
          } catch (error) {
            console.error('Error preparing field for auto-save:', error);
          }
        }, 500);
      }
    } else {
      // Show some feedback that we need at least 3 points
      alert("Please add at least 3 points to create a field");
    }
  }, [map, onPolygonComplete, polygonColor, polygonFillOpacity, strokeColor, strokeWeight, user, fieldPolygons.length]);

  // Add function to handle toggling merge mode
  const handleToggleMergeMode = useCallback(() => {
    // Toggle merge mode
    setIsMergeMode(prevMode => !prevMode);
    
    // Reset the list of polygons to merge when toggling
    setPolygonsToMerge([]);
    
    // Close advanced tools dropdown
    setShowAdvancedTools(false);
    
    // Reset any selected polygon when entering merge mode
    if (!isMergeMode) {
      if (selectedPolygonIndex !== null) {
        // Deselect the current polygon
        const polygon = fieldPolygons[selectedPolygonIndex];
        const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
        
        polygon.setOptions({
          strokeWeight: originalStrokeWeight,
          zIndex: selectedPolygonIndex + 10
        });
        
        polygon.setEditable(false);
        polygon.setDraggable(false);
        
        setSelectedPolygonIndex(null);
        setSelectedFieldInfo(null);
        setShowPolygonTools(false);
      }
    }
  }, [isMergeMode, selectedPolygonIndex, fieldPolygons, strokeWeight]);

  // Function to handle polygon selection in merge mode
  const handleSelectPolygonForMerge = useCallback((index: number) => {
    if (!isMergeMode) return;
    
    setPolygonsToMerge(prev => {
      // If already selected, remove it
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      // Otherwise add it
      return [...prev, index];
    });
    
    // Highlight or unhighlight the polygon
    const polygon = fieldPolygons[index];
    
    if (polygonsToMerge.includes(index)) {
      // Unhighlight - reset to original style
      const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
      polygon.setOptions({
        strokeWeight: originalStrokeWeight,
        strokeColor: polygon.get('strokeColor') || strokeColor,
        zIndex: index + 10
      });
    } else {
      // Highlight - store original stroke weight and set new style
      const currentStrokeWeight = polygon.get('strokeWeight') || strokeWeight;
      polygon.set('originalStrokeWeight', currentStrokeWeight);
      
      polygon.setOptions({
        strokeWeight: 4,
        strokeColor: '#FF9800', // Orange color for merge selection
        zIndex: 1000 + index
      });
    }
  }, [isMergeMode, fieldPolygons, polygonsToMerge, strokeWeight, strokeColor]);
  
  // Helper function to calculate the overlap between two bounds
  const calculateBoundsOverlap = useCallback((bounds1: google.maps.LatLngBounds, bounds2: google.maps.LatLngBounds): google.maps.LatLngBounds | null => {
    const ne1 = bounds1.getNorthEast();
    const sw1 = bounds1.getSouthWest();
    const ne2 = bounds2.getNorthEast();
    const sw2 = bounds2.getSouthWest();
    
    // Check if bounds overlap
    if (ne1.lng() < sw2.lng() || ne2.lng() < sw1.lng() || ne1.lat() < sw2.lat() || ne2.lat() < sw1.lat()) {
      return null; // No overlap
    }
    
    // Calculate overlap bounds
    const overlapBounds = new google.maps.LatLngBounds();
    overlapBounds.extend(new google.maps.LatLng(
      Math.min(ne1.lat(), ne2.lat()),
      Math.min(ne1.lng(), ne2.lng())
    ));
    overlapBounds.extend(new google.maps.LatLng(
      Math.max(sw1.lat(), sw2.lat()),
      Math.max(sw1.lng(), sw2.lng())
    ));
    
    return overlapBounds;
  }, []);
  
  // Helper function to calculate the approximate area of a bounds
  const calculateBoundsArea = useCallback((bounds: google.maps.LatLngBounds): number => {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const width = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(ne.lat(), sw.lng()),
      new google.maps.LatLng(ne.lat(), ne.lng())
    );
    const height = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(sw.lat(), sw.lng()),
      new google.maps.LatLng(ne.lat(), sw.lng())
    );
    return width * height;
  }, []);
  
  // Function to compute the convex hull of a set of points (Graham scan algorithm)
  const computeConvexHull = useCallback((points: google.maps.LatLng[]): google.maps.LatLng[] => {
    if (points.length <= 3) return points;
    
    // Find the point with the lowest y-coordinate (and leftmost if tied)
    let lowestPoint = points[0];
    for (let i = 1; i < points.length; i++) {
      if (points[i].lat() < lowestPoint.lat() || 
          (points[i].lat() === lowestPoint.lat() && points[i].lng() < lowestPoint.lng())) {
        lowestPoint = points[i];
      }
    }
    
    // Sort points by polar angle with respect to the lowest point
    const sortedPoints = [...points].sort((a, b) => {
      if (a === lowestPoint) return -1;
      if (b === lowestPoint) return 1;
      
      const angleA = Math.atan2(a.lat() - lowestPoint.lat(), a.lng() - lowestPoint.lng());
      const angleB = Math.atan2(b.lat() - lowestPoint.lat(), b.lng() - lowestPoint.lng());
      
      if (angleA < angleB) return -1;
      if (angleA > angleB) return 1;
      
      // If angles are the same, take the point that's further from lowestPoint
      const distA = (a.lat() - lowestPoint.lat()) ** 2 + (a.lng() - lowestPoint.lng()) ** 2;
      const distB = (b.lat() - lowestPoint.lat()) ** 2 + (b.lng() - lowestPoint.lng()) ** 2;
      
      return distB - distA;
    });
    
    // Remove duplicate points
    const uniquePoints = [sortedPoints[0]];
    for (let i = 1; i < sortedPoints.length; i++) {
      if (sortedPoints[i].lat() !== sortedPoints[i-1].lat() || 
          sortedPoints[i].lng() !== sortedPoints[i-1].lng()) {
        uniquePoints.push(sortedPoints[i]);
      }
    }
    
    // Graham scan algorithm
    if (uniquePoints.length <= 3) return uniquePoints;
    
    const hull = [uniquePoints[0], uniquePoints[1]];
    
    for (let i = 2; i < uniquePoints.length; i++) {
      while (hull.length >= 2 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], uniquePoints[i])) {
        hull.pop();
      }
      hull.push(uniquePoints[i]);
    }
    
    return hull;
  }, []);
  
  // Helper function for convex hull algorithm to determine if three points make a left turn
  const isLeftTurn = useCallback((p1: google.maps.LatLng, p2: google.maps.LatLng, p3: google.maps.LatLng): boolean => {
    const cross = (p2.lng() - p1.lng()) * (p3.lat() - p1.lat()) - 
                 (p2.lat() - p1.lat()) * (p3.lng() - p1.lng());
    return cross > 0;
  }, []);
  
  // Helper function to find the intersection point of two edges
  const findEdgeIntersection = useCallback(
    (p1: google.maps.LatLng, p2: google.maps.LatLng, p3: google.maps.LatLng, p4: google.maps.LatLng): google.maps.LatLng | null => {
      // Convert to cartesian coordinates for easier calculation
      const x1 = p1.lng(), y1 = p1.lat();
      const x2 = p2.lng(), y2 = p2.lat();
      const x3 = p3.lng(), y3 = p3.lat();
      const x4 = p4.lng(), y4 = p4.lat();
      
      // Calculate the denominator
      const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
      
      // If denominator is 0, lines are parallel
      if (denominator === 0) return null;
      
      // Calculate ua and ub
      const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
      const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;
      
      // If ua and ub are between 0-1, lines are intersecting
      if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
      
      // Calculate the intersection point
      const x = x1 + (ua * (x2 - x1));
      const y = y1 + (ua * (y2 - y1));
      
      return new google.maps.LatLng(y, x);
    }, []);
  
  // Helper function to combine polygon paths while preserving edges
  const combinePolygonPaths = useCallback((polygonPaths: google.maps.LatLng[][]): google.maps.LatLng[] => {
    if (polygonPaths.length === 0) return [];
    if (polygonPaths.length === 1) return polygonPaths[0];
    
    // Implementation of a polygon union algorithm that preserves original edges
    // Start with the first polygon
    let result = [...polygonPaths[0]];
    
    // For each additional polygon, merge it with the result
    for (let i = 1; i < polygonPaths.length; i++) {
      const currentPolygon = polygonPaths[i];
      
      // Find all intersection points between the current result and the new polygon
      const intersections: {point: google.maps.LatLng, edge1Index: number, edge2Index: number}[] = [];
      
      // Check each edge of the first polygon against each edge of the second polygon
      for (let j = 0; j < result.length - 1; j++) {
        const edge1Start = result[j];
        const edge1End = result[j + 1];
        
        for (let k = 0; k < currentPolygon.length - 1; k++) {
          const edge2Start = currentPolygon[k];
          const edge2End = currentPolygon[k + 1];
          
          // Check if these edges intersect
          const intersection = findEdgeIntersection(
            edge1Start, edge1End,
            edge2Start, edge2End
          );
          
          if (intersection) {
            intersections.push({
              point: intersection,
              edge1Index: j,
              edge2Index: k
            });
          }
        }
      }
      
      // If no intersections, the polygons don't overlap
      if (intersections.length === 0 || intersections.length < 2) {
        // Just add all points from both polygons if no proper overlap
        result = [...result, ...currentPolygon];
        continue;
      }
      
      // We need at least 2 intersection points to properly merge polygons
      if (intersections.length >= 2) {
        // Sort intersections by their position along the edges of the first polygon
        intersections.sort((a, b) => {
          if (a.edge1Index !== b.edge1Index) {
            return a.edge1Index - b.edge1Index;
          }
          
          // If on same edge, calculate distance from start of edge
          const edgeStart = result[a.edge1Index];
          const distA = google.maps.geometry.spherical.computeDistanceBetween(edgeStart, a.point);
          const distB = google.maps.geometry.spherical.computeDistanceBetween(edgeStart, b.point);
          return distA - distB;
        });
        
        // Create a new path that follows the outer boundary of both polygons
        const newPath: google.maps.LatLng[] = [];
        
        // For proper merging, we need to identify entry and exit points
        // We'll use the first and last intersection as our entry/exit points
        const entryPoint = intersections[0];
        const exitPoint = intersections[intersections.length - 1];
        
        // Start at the entry intersection point
        newPath.push(entryPoint.point);
        
        // Follow the first polygon from entry to exit
        let currentIndex = entryPoint.edge1Index + 1;
        while (currentIndex <= exitPoint.edge1Index) {
          if (currentIndex < result.length) {
            newPath.push(result[currentIndex]);
          }
          currentIndex++;
        }
        
        // Add the exit point
        newPath.push(exitPoint.point);
        
        // Now follow the second polygon from exit back to entry
        // We need to go in the reverse direction through the second polygon
        let polygon2Length = currentPolygon.length;
        
        // Calculate the correct path through the second polygon
        // This is the tricky part - we need to determine which way to go
        // We'll go from exit to entry in the appropriate direction
        
        // First, determine if we should go forward or backward through the second polygon
        // by checking which path is shorter
        const forwardPath: google.maps.LatLng[] = [];
        const backwardPath: google.maps.LatLng[] = [];
        
        // Forward path (exit to entry)
        currentIndex = exitPoint.edge2Index + 1;
        let tempIndex = currentIndex;
        while (tempIndex !== entryPoint.edge2Index) {
          if (tempIndex >= polygon2Length) tempIndex = 0;
          forwardPath.push(currentPolygon[tempIndex]);
          tempIndex++;
          // Safety check to prevent infinite loop
          if (forwardPath.length > polygon2Length * 2) break;
        }
        
        // Backward path (exit to entry)
        currentIndex = exitPoint.edge2Index;
        tempIndex = currentIndex;
        while (tempIndex !== entryPoint.edge2Index + 1) {
          if (tempIndex < 0) tempIndex = polygon2Length - 1;
          backwardPath.push(currentPolygon[tempIndex]);
          tempIndex--;
          // Safety check to prevent infinite loop
          if (backwardPath.length > polygon2Length * 2) break;
        }
        
        // Choose the shorter path
        const pathToUse = forwardPath.length <= backwardPath.length ? forwardPath : backwardPath;
        
        // Add the chosen path to our result
        pathToUse.forEach(point => newPath.push(point));
        
        // Close the loop by returning to the entry point
        if (newPath[0].lat() !== newPath[newPath.length - 1].lat() || 
            newPath[0].lng() !== newPath[newPath.length - 1].lng()) {
          newPath.push(newPath[0]);
        }
        
        // Update the result for the next iteration
        result = newPath;
      }
    }
    
    return result;
  }, [findEdgeIntersection]);
  
  // Helper function to check if polygons have significant overlap
  const checkForSignificantOverlap = useCallback((polygonPaths: google.maps.LatLng[][]): boolean => {
    if (polygonPaths.length < 2) return false;
    
    // Calculate bounding boxes for each polygon
    const bounds: google.maps.LatLngBounds[] = [];
    
    for (const path of polygonPaths) {
      const bound = new google.maps.LatLngBounds();
      for (const point of path) {
        bound.extend(point);
      }
      bounds.push(bound);
    }
    
    // Check for overlap between bounding boxes
    for (let i = 0; i < bounds.length; i++) {
      for (let j = i + 1; j < bounds.length; j++) {
        // Calculate overlap area
        const overlapBounds = calculateBoundsOverlap(bounds[i], bounds[j]);
        if (overlapBounds) {
          // Calculate the area of overlap relative to the smaller polygon
          const overlapArea = calculateBoundsArea(overlapBounds);
          const area1 = calculateBoundsArea(bounds[i]);
          const area2 = calculateBoundsArea(bounds[j]);
          const smallerArea = Math.min(area1, area2);
          
          // If overlap is more than 30% of the smaller polygon, consider it significant
          if (overlapArea / smallerArea > 0.3) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [calculateBoundsOverlap, calculateBoundsArea]);
  
  // Function to merge selected polygons
  const handleMergePolygons = useCallback(() => {
    if (polygonsToMerge.length < 2) {
      // Need at least 2 polygons to merge
      return;
    }
    
    try {
      // Get the polygons to merge
      const polygonsToMergeObjects = polygonsToMerge
        .map(index => fieldPolygons[index])
        .filter(Boolean); // Filter out any undefined values
      
      if (polygonsToMergeObjects.length < 2) return;
      
      // Create a more precise union of polygons that preserves edge positions
      // Instead of using a simple convex hull, we'll create a more accurate representation
      
      // First, collect all vertices from all polygons with their original positions
      const allVertices: google.maps.LatLng[] = [];
      const polygonPaths: google.maps.LatLng[][] = [];
      
      // Get all vertices from all polygons and preserve their paths
      polygonsToMergeObjects.forEach(polygon => {
        const path = polygon.getPath();
        const vertices: google.maps.LatLng[] = [];
        
        for (let i = 0; i < path.getLength(); i++) {
          const point = path.getAt(i);
          vertices.push(point);
          allVertices.push(point);
        }
        
        // Add the first point again to close the loop if needed
        if (vertices.length > 0 && 
            (vertices[0].lat() !== vertices[vertices.length - 1].lat() || 
             vertices[0].lng() !== vertices[vertices.length - 1].lng())) {
          vertices.push(vertices[0]);
        }
        
        polygonPaths.push(vertices);
      });
      
      // Always use the edge-preserving algorithm to maintain original field boundaries
      // except at the overlapping sections
      let mergedPath: google.maps.LatLng[] = combinePolygonPaths(polygonPaths);
      
      // Create a new polygon with the merged vertices
      const mergedPolygon = new google.maps.Polygon({
        paths: mergedPath,
        strokeColor: polygonsToMergeObjects[0].get('strokeColor') || strokeColor,
        strokeWeight: strokeWeight,
        fillColor: polygonsToMergeObjects[0].get('fillColor') || polygonColor,
        fillOpacity: polygonFillOpacity,
        editable: false,
        draggable: false,
        map: map
      });
      
      // Set properties for the new polygon
      mergedPolygon.set('fieldName', 'Merged Area');
      mergedPolygon.set('strokeColor', mergedPolygon.get('strokeColor'));
      mergedPolygon.set('fillColor', mergedPolygon.get('fillColor'));
      mergedPolygon.set('strokeWeight', strokeWeight);
      mergedPolygon.set('fillOpacity', polygonFillOpacity);
      
      // Add the new polygon to our state
      setFieldPolygons(prev => [...prev, mergedPolygon]);
      
      // Remove all the merged polygons
      polygonsToMergeObjects.forEach(polygon => {
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
        
        // Delete from Firebase if it has an ID
        const fieldId = polygon.get('fieldId');
        if (fieldId && user) {
          deleteField(fieldId).catch(error => {
            console.error('Error deleting merged field from Firestore:', error);
          });
        }
      });
      
      // Update the state - remove the merged polygons
      setFieldPolygons(prev => prev.filter((_, index) => !polygonsToMerge.includes(index)));
      
      // Save the merged polygon to Firebase if user is logged in
      if (user) {
        // Convert to FieldData format
        const fieldData = polygonToFieldData(mergedPolygon, fieldPolygons.length - 1);
        
        // Save to Firebase
        saveField(fieldData).then(fieldId => {
          // Update the polygon with the field ID
          mergedPolygon.set('fieldId', fieldId);
          
          // Show success notification
          const notificationElement = document.getElementById('save-notification');
          const notificationTextElement = document.getElementById('save-notification-text');
          if (notificationElement && notificationTextElement) {
            notificationTextElement.textContent = 'Merged field saved successfully';
            notificationElement.style.display = 'block';
            
            // Hide after 3 seconds
            setTimeout(() => {
              notificationElement.style.display = 'none';
            }, 3000);
          }
        }).catch(error => {
          console.error('Error saving merged field:', error);
          
          // Show error notification
          alert('Error saving merged field. The field may not persist after refresh.');
        });
      }
      
      // Exit merge mode
      setIsMergeMode(false);
      setPolygonsToMerge([]);
      
    } catch (error) {
      console.error('Error merging polygons:', error);
    }
  }, [
    polygonsToMerge, 
    fieldPolygons, 
    map, 
    strokeColor, 
    strokeWeight, 
    polygonColor, 
    polygonFillOpacity, 
    user, 
    combinePolygonPaths
  ]);

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
    const fieldName = polygon.get('fieldName') || 'Area';
    
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
      // Skip if polygon is not on the map
      if (!polygon.getMap()) return;
      
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
      // Skip if polygon is not on the map
      if (!polygon.getMap()) return;
      
      // Calculate polygon center
      const path = polygon.getPath();
      const bounds = new google.maps.LatLngBounds();
      path.forEach(point => bounds.extend(point));
      const center = bounds.getCenter();
      
      // Calculate polygon area
      const area = google.maps.geometry.spherical.computeArea(path);
      const areaInHectares = area / 10000; // Convert to hectares
      
      // Get field name
      const fieldName = polygon.get('fieldName') || 'Area';
      
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
        // Skip if polygon is not on the map
        if (!polygon.getMap()) return;
        
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
    // Handle undo for drawing mode
    if (isDrawingMode && window.tempVerticesRef && undoStack.length > 0) {
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
    // Handle undo for edit mode
    else if (isSelectedPolygonEditable && selectedPolygonIndex !== null && undoStack.length > 0) {
      const prevVertices = undoStack[undoStack.length - 1];
      const polygon = fieldPolygons[selectedPolygonIndex];
      const path = polygon.getPath();
      
      // Store current state in redo stack
      const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
      setRedoStack(prev => [...prev, currentPath]);
      
      // Apply the previous state to the polygon path
      const newPath = new google.maps.MVCArray();
      prevVertices.forEach(vertex => newPath.push(vertex));
      polygon.setPath(newPath);
      
      // Update window.tempVerticesRef for consistency
      window.tempVerticesRef = prevVertices;
      
      // Update the vertex markers positions
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      vertexMarkers.forEach((marker: google.maps.Marker, index: number) => {
        if (index < prevVertices.length) {
          marker.setPosition(prevVertices[index]);
        }
      });
      
      // Update edge markers
      const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
      if (typeof addEdgeMarkersFn === 'function') {
        addEdgeMarkersFn();
      }
      
      // Update the undo stack
      setUndoStack(undoStack.slice(0, -1));
      setCanUndo(undoStack.length > 1);
      setCanRedo(true);
    }
  }, [createVertexMarker, map, redoStack, undoStack, updateEdgeMarkers, isDrawingMode, isSelectedPolygonEditable, selectedPolygonIndex, fieldPolygons]);

  // Add the handleRedo function
  const handleRedo = useCallback(() => {
    // Handle redo for drawing mode
    if (isDrawingMode && window.tempVerticesRef && redoStack.length > 0) {
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
    // Handle redo for edit mode
    else if (isSelectedPolygonEditable && selectedPolygonIndex !== null && redoStack.length > 0) {
      const nextVertices = redoStack[redoStack.length - 1];
      const polygon = fieldPolygons[selectedPolygonIndex];
      const path = polygon.getPath();
      
      // Store current state in undo stack
      const currentPath = Array.from({ length: path.getLength() }, (_, i) => path.getAt(i));
      setUndoStack(prev => [...prev, currentPath]);
      
      // Apply the next state to the polygon path
      const newPath = new google.maps.MVCArray();
      nextVertices.forEach(vertex => newPath.push(vertex));
      polygon.setPath(newPath);
      
      // Update window.tempVerticesRef for consistency
      window.tempVerticesRef = nextVertices;
      
      // Update the vertex markers positions
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      vertexMarkers.forEach((marker: google.maps.Marker, index: number) => {
        if (index < nextVertices.length) {
          marker.setPosition(nextVertices[index]);
        }
      });
      
      // Update edge markers
      const addEdgeMarkersFn = polygon.get('addEdgeMarkers');
      if (typeof addEdgeMarkersFn === 'function') {
        addEdgeMarkersFn();
      }
      
      // Update the redo stack
      setRedoStack(redoStack.slice(0, -1));
      setCanUndo(true);
      setCanRedo(redoStack.length > 1);
    }
  }, [createVertexMarker, map, redoStack, undoStack, updateEdgeMarkers, isDrawingMode, isSelectedPolygonEditable, selectedPolygonIndex, fieldPolygons]);

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
    onToggleEditable={handleToggleEditable}
    onToggleDraggable={handleToggleDraggable}
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
    isEditable={isSelectedPolygonEditable}
    isDraggable={isSelectedPolygonDraggable}
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
      
      // Only save the currently selected polygon if in edit mode
      // This is faster than saving all polygons
      if (selectedPolygonIndex !== null && (isSelectedPolygonEditable || isSelectedPolygonDraggable)) {
        const polygon = fieldPolygons[selectedPolygonIndex];
        const fieldData = polygonToFieldData(polygon, selectedPolygonIndex);
          
          // Save to Firestore
          await saveField(fieldData);
          
          // Set the fieldId on the polygon for future updates
          polygon.set('fieldId', fieldData.id);
      } 
      // If not in edit mode, save all polygons (fallback for other save operations)
      else {
        // Convert all polygons to field data first, then save in parallel
        const fieldDataArray = fieldPolygons.map((polygon, index) => 
          polygonToFieldData(polygon, index)
      );
      
        // Save all at once in parallel
        await Promise.all(
          fieldDataArray.map(async (fieldData, index) => {
            // Save to Firestore
            await saveField(fieldData);
            
            // Set the fieldId on the polygon for future updates
            fieldPolygons[index].set('fieldId', fieldData.id);
          })
        );
      }
      
      // Show a quick notification for 1 second only
      const notificationElement = document.getElementById('save-notification');
      const notificationTextElement = document.getElementById('save-notification-text');
      if (notificationElement && notificationTextElement) {
        notificationTextElement.textContent = `Saved successfully`;
        notificationElement.style.display = 'block';
        notificationElement.className = 'fixed top-14 left-0 right-0 bg-green-500 text-white p-2 z-50 text-center';
        
        // Hide the notification after just 1 second
        setTimeout(() => {
          notificationElement.style.display = 'none';
        }, 1000);
      }
      
      setShowSaveOptions(false);
    } catch (error) {
      console.error('Error saving fields:', error);
      
      // Brief error notification
      const notificationElement = document.getElementById('save-notification');
      const notificationTextElement = document.getElementById('save-notification-text');
      if (notificationElement && notificationTextElement) {
        notificationTextElement.textContent = 'Error saving. Please try again.';
        notificationElement.style.display = 'block';
        notificationElement.className = 'fixed top-14 left-0 right-0 bg-red-500 text-white p-2 z-50 text-center';
        
        // Hide the notification after 1 second
        setTimeout(() => {
          notificationElement.style.display = 'none';
        }, 1000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [fieldPolygons, user, selectedPolygonIndex, isSelectedPolygonEditable, isSelectedPolygonDraggable]);

  // Expose handleSaveAllFields to window for use in DistanceMeasurement component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.handleSaveAllFields = handleSaveAllFields;
    }
    
    // Cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        delete window.handleSaveAllFields;
      }
    };
  }, [handleSaveAllFields]);
  
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
      
      // Also remove from fieldPolygons if it exists there
      const polygonIndex = fieldPolygons.findIndex(polygon => polygon.get('fieldId') === fieldId);
      if (polygonIndex !== -1) {
        setFieldPolygons(prev => prev.filter((_, index) => index !== polygonIndex));
      }
      
      alert('Field deleted successfully');
    } catch (error) {
      console.error('Error deleting field:', error);
      alert('Error deleting field. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [user, setLoadedFields, fieldPolygons, setFieldPolygons]);

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
              // Track already loaded field IDs to prevent duplicates
              const loadedFieldIds = new Set(fieldPolygons.map(polygon => polygon.get('fieldId')));
              
              // Create a batch of polygons to add at once (more efficient than multiple state updates)
              const newPolygons: google.maps.Polygon[] = [];
              
              // Automatically load all fields without asking
              fields.forEach(fieldData => {
                // Skip if this field is already loaded
                if (fieldData.id && loadedFieldIds.has(fieldData.id)) {
                  console.log(`Field ${fieldData.id} already loaded, skipping`);
                  return;
                }
                
                // Create the polygon but don't add to map yet
                const polygon = fieldDataToPolygon(fieldData, null); // Pass null instead of map
                
                // Store the field ID with the polygon for future reference
                if (fieldData.id) {
                  polygon.set('fieldId', fieldData.id);
                  loadedFieldIds.add(fieldData.id); // Mark as loaded
                }
                
                // Add to our batch
                newPolygons.push(polygon);
              });
              
              // Now add all polygons to the map and state at once
              if (newPolygons.length > 0) {
                // First add to map
                newPolygons.forEach(polygon => polygon.setMap(map));
                
                // Then update state once
                setFieldPolygons(prev => [...prev, ...newPolygons]);
                
                // No auto-zoom when loading fields - keep default zoom level
              }
            }
          } catch (error) {
            console.error('Error loading fields after authentication:', error);
          }
        }
      }
    };
    
    checkPermissionsAndLoadData();
  }, [user, map, fieldPolygons.length, isDrawingMode]);

  // Function to handle the measure distance option
  const handleMeasureDistance = () => {
    // Exit drawing mode if active
    if (isDrawingMode) {
      handleCancelDrawing();
    }
    
    // If the map is available, save the current center as the last position
    if (map) {
      const center = map.getCenter();
      if (center) {
        saveLastPosition({
          lat: center.lat(),
          lng: center.lng()
        });
      }
    }
    
    setMeasureDistanceMode(true);
    setShowPolygonTools(false);
  };

  // Function to exit measure distance mode
  const handleExitMeasureDistance = () => {
    setMeasureDistanceMode(false);
  };

  // Function to handle distance measurement updates
  const handleDistanceUpdate = (newDistance: number, newMeasurePoints: google.maps.LatLngLiteral[]) => {
    setDistance(newDistance);
    setMeasurePoints(newMeasurePoints);
  };

  // Add an effect to load saved distance measurements
  useEffect(() => {
    // Only load measurements if user is authenticated and the map is ready
    if (user && map && !isLoading) {
      const loadUserMeasurements = async () => {
        try {
          // Load distance measurements
          const measurements = await getUserDistanceMeasurements();
          
          if (measurements && measurements.length > 0) {
            setLoadedDistanceMeasurements(measurements);
            
            // Create arrays to store measurement polylines and polygons for reference
            const measurementPolylines: Record<string, google.maps.Polyline> = {};
            const measurementPolygons: Record<string, google.maps.Polygon> = {};
            
            // Get current map bounds to only display visible measurements
            const bounds = map.getBounds();
            
            // Filter measurements that are within the current viewport or nearby
            const visibleMeasurements = bounds 
              ? measurements.filter(measurement => 
                  measurement.points.some((point: {lat: number, lng: number}) => 
                    bounds.contains(new google.maps.LatLng(point.lat, point.lng))
                  )
                )
              : measurements.slice(0, 20); // If no bounds yet, load first 20 measurements
            
            // Store remaining measurements for lazy loading
            const remainingMeasurements = measurements.filter(
              m => !visibleMeasurements.includes(m)
            );
            setRemainingMeasurementsToLoad(remainingMeasurements);
            
            // Display each visible measurement as a polyline on the map
            visibleMeasurements.forEach(measurement => {
              if (measurement.points && measurement.points.length > 1) {
                // Create a polyline for each measurement
                const measurementLine = new google.maps.Polyline({
                  path: measurement.points,
                  geodesic: true,
                  strokeColor: "#00AA00", 
                  strokeOpacity: 1.0,
                  strokeWeight: 3,
                  clickable: true, // Make clickable so it can be selected
                  map: map
                });
                
                // Store the polyline reference for this measurement
                measurementPolylines[measurement.id] = measurementLine;
                
                // Store initial styling options on the polyline for reference
                measurementLine.set('initialOptions', {
                  strokeColor: "#00AA00",
                  strokeWeight: 3,
                  strokeOpacity: 1.0
                });
                
                // Add click handler to select this measurement
                measurementLine.addListener('click', () => {
                  // Highlight this measurement by increasing stroke weight
                  measurementLine.setOptions({
                    strokeWeight: 5,
                    strokeColor: "#00CC00"
                  });
                  
                  // Set as selected measurement
                  setSelectedMeasurement(measurement);
                  
                  // Update distance styles based on actual polyline properties
                  const initialPolylineOptions = measurementLine.get('initialOptions') || {
                    strokeColor: "#00AA00",
                    strokeWeight: 3,
                    strokeOpacity: 1.0
                  };
                  
                  const initialPolygonOptions = measurement.isClosed && measurementPolygons[measurement.id] 
                    ? (measurementPolygons[measurement.id].get('initialOptions') || {
                        strokeColor: "#00AA00",
                        strokeWeight: 2,
                        fillColor: "#00AA00",
                        fillOpacity: 0.1,
                        strokeOpacity: 0.8
                      })
                    : null;
                  
                  setDistanceStyles({
                    strokeColor: initialPolylineOptions.strokeColor,
                    fillColor: initialPolygonOptions ? initialPolygonOptions.fillColor : "#00AA00",
                    strokeWeight: initialPolylineOptions.strokeWeight,
                    fillOpacity: initialPolygonOptions ? initialPolygonOptions.fillOpacity : 0.1,
                    name: measurement.name || ''
                  });
                  
                  // Reset styling of all other measurement polylines
                  Object.entries(measurementPolylines).forEach(([id, polyline]) => {
                    if (id !== measurement.id) {
                      polyline.setOptions({
                        strokeWeight: 3,
                        strokeColor: "#00AA00"
                      });
                    }
                  });
                  
                  // Reset styling of all other measurement polygons
                  Object.entries(measurementPolygons).forEach(([id, polygon]) => {
                    if (id !== measurement.id) {
                      polygon.setOptions({
                        strokeWeight: 2,
                        strokeColor: "#00AA00",
                        fillOpacity: 0.1
                      });
                    }
                  });
                });
                
                // Find an appropriate point for the name label (middle of polyline)
                const points = measurement.points;
                let centerPointIdx = Math.floor(points.length / 2);
                let centerPoint;
                
                // If odd number of points, use the middle point
                if (points.length % 2 !== 0) {
                  centerPoint = points[centerPointIdx];
                } else {
                  // If even number of points, calculate midpoint between the two middle points
                  const p1 = points[centerPointIdx - 1];
                  const p2 = points[centerPointIdx];
                  
                  try {
                    // Try to use geometry library for precise midpoint calculation
                    const p1LatLng = new google.maps.LatLng(p1.lat, p1.lng);
                    const p2LatLng = new google.maps.LatLng(p2.lat, p2.lng);
                    const heading = google.maps.geometry.spherical.computeHeading(p1LatLng, p2LatLng);
                    const distance = google.maps.geometry.spherical.computeDistanceBetween(p1LatLng, p2LatLng);
                    const midpointLatLng = google.maps.geometry.spherical.computeOffset(p1LatLng, distance/2, heading);
                    
                    centerPoint = {
                      lat: midpointLatLng.lat(),
                      lng: midpointLatLng.lng()
                    };
                  } catch (error) {
                    // Fallback to simple averaging if geometry library isn't available
                    centerPoint = {
                      lat: (p1.lat + p2.lat) / 2,
                      lng: (p1.lng + p2.lng) / 2
                    };
                  }
                }
                
                // Create custom overlay class for the measurement name label
                class MeasurementNameOverlay extends google.maps.OverlayView {
                  private position: google.maps.LatLngLiteral;
                  private content: string;
                  private div: HTMLDivElement | null = null;
                  
                  constructor(position: google.maps.LatLngLiteral, content: string) {
                    super();
                    this.position = position;
                    this.content = content;
                  }
                  
                  onAdd() {
                    // Create container div
                    this.div = document.createElement('div');
                    this.div.style.position = 'absolute';
                    this.div.style.backgroundColor = 'transparent';
                    this.div.style.color = 'black';
                    this.div.style.padding = '0';
                    this.div.style.fontSize = '12px';
                    this.div.style.fontWeight = 'bold';
                    this.div.style.textShadow = '0px 0px 2px white, 0px 0px 2px white, 0px 0px 2px white, 0px 0px 2px white';
                    this.div.style.zIndex = '1000';
                    this.div.style.userSelect = 'none';
                    this.div.style.whiteSpace = 'nowrap';
                    this.div.style.transform = 'translate(-50%, -50%)';
                    this.div.style.fontFamily = 'Arial, sans-serif';
                    this.div.style.textAlign = 'center';
                    this.div.textContent = this.content;
                    
                    const panes = this.getPanes();
                    panes?.overlayLayer.appendChild(this.div);
                  }
                  
                  draw() {
                    const overlayProjection = this.getProjection();
                    if (!overlayProjection || !this.div) return;
                    
                    const position = overlayProjection.fromLatLngToDivPixel(
                      new google.maps.LatLng(this.position.lat, this.position.lng)
                    );
                    
                    if (position) {
                      this.div.style.left = position.x + 'px';
                      this.div.style.top = position.y + 'px';
                    }
                  }
                  
                  onRemove() {
                    if (this.div) {
                      this.div.parentNode?.removeChild(this.div);
                      this.div = null;
                    }
                  }
                }
                
                // Display the measurement name directly on the map
                if (centerPoint && measurement.name) {
                  const nameLabel = new MeasurementNameOverlay(
                    centerPoint,
                    measurement.name
                  );
                  nameLabel.setMap(map);
                }
                
                // If the measurement is closed and has an area, add a polygon fill
                if (measurement.isClosed && measurement.area) {
                  const polygon = new google.maps.Polygon({
                    paths: measurement.points,
                    strokeColor: "#00AA00",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#00AA00",
                    fillOpacity: 0.1,
                    clickable: true, // Make clickable so it can be selected
                    map: map
                  });
                  
                  // Store the polygon reference for this measurement
                  measurementPolygons[measurement.id] = polygon;
                  
                  // Store initial styling options on the polygon for reference
                  polygon.set('initialOptions', {
                    strokeColor: "#00AA00",
                    strokeWeight: 2,
                    fillColor: "#00AA00",
                    fillOpacity: 0.1,
                    strokeOpacity: 0.8
                  });
                  
                  // Add click handler to select this measurement
                  polygon.addListener('click', () => {
                    // Highlight this polygon
                    polygon.setOptions({
                      strokeWeight: 4,
                      strokeColor: "#00CC00",
                      fillOpacity: 0.2
                    });
                    
                    // Set as selected measurement
                    setSelectedMeasurement(measurement);
                    
                    // Update distance styles
                    const initialPolygonOptions = polygon.get('initialOptions') || {
                      strokeColor: "#00AA00",
                      strokeWeight: 2,
                      fillColor: "#00AA00",
                      fillOpacity: 0.1,
                      strokeOpacity: 0.8
                    };
                    
                    setDistanceStyles({
                      strokeColor: initialPolygonOptions.strokeColor,
                      fillColor: initialPolygonOptions.fillColor,
                      strokeWeight: initialPolygonOptions.strokeWeight,
                      fillOpacity: initialPolygonOptions.fillOpacity,
                      name: measurement.name || ''
                    });
                    
                    // Highlight the corresponding polyline
                    const polyline = measurementPolylines[measurement.id];
                    if (polyline) {
                      polyline.setOptions({
                        strokeWeight: 5,
                        strokeColor: "#00CC00"
                      });
                    }
                    
                    // Reset styling of all other measurement polylines
                    Object.entries(measurementPolylines).forEach(([id, polyline]) => {
                      if (id !== measurement.id) {
                        polyline.setOptions({
                          strokeWeight: 3,
                          strokeColor: "#00AA00"
                        });
                      }
                    });
                    
                    // Reset styling of all other measurement polygons
                    Object.entries(measurementPolygons).forEach(([id, otherPolygon]) => {
                      if (id !== measurement.id) {
                        otherPolygon.setOptions({
                          strokeWeight: 2,
                          strokeColor: "#00AA00",
                          fillOpacity: 0.1
                        });
                      }
                    });
                  });
                }
              }
            });
            
            // Store the references to measurement polylines and polygons globally
            // so they can be accessed for selection/deselection
            setMeasurementPolylines(measurementPolylines);
            setMeasurementPolygons(measurementPolygons);
          }
        } catch (error) {
          console.error('Error loading distance measurements:', error);
        }
      };
      
      loadUserMeasurements();
    }
  }, [user, map, isLoading]);

  // Add state for remaining measurements to load
  const [remainingMeasurementsToLoad, setRemainingMeasurementsToLoad] = useState<any[]>([]);

    // Add an effect to load more measurements when the map bounds change
  useEffect(() => {
    if (!map || remainingMeasurementsToLoad.length === 0) return;
    
    // Create a throttled function to load visible measurements
    const loadVisibleMeasurements = throttle(() => {
      const bounds = map.getBounds();
      if (!bounds) return;
      
      // Find measurements that are now visible
      const newVisibleMeasurements = remainingMeasurementsToLoad.filter(measurement => 
        measurement.points.some((point: {lat: number, lng: number}) => 
          bounds.contains(new google.maps.LatLng(point.lat, point.lng))
        )
      ).slice(0, 10); // Load max 10 measurements at a time to prevent lag
      
      // If we have new visible measurements, load them
      if (newVisibleMeasurements.length > 0) {
        // Process each new visible measurement
        newVisibleMeasurements.forEach(measurement => {
          if (measurement.points && measurement.points.length > 1) {
            // Create a polyline for the measurement
            const measurementLine = new google.maps.Polyline({
              path: measurement.points,
              geodesic: true,
              strokeColor: "#00AA00", 
              strokeOpacity: 1.0,
              strokeWeight: 3,
              clickable: true,
              map: map
            });
            
            // Store the polyline reference
            setMeasurementPolylines(prev => ({
              ...prev,
              [measurement.id]: measurementLine
            }));
            
            // If the measurement is closed and has an area, add a polygon fill
            if (measurement.isClosed && measurement.area) {
              const polygon = new google.maps.Polygon({
                paths: measurement.points,
                strokeColor: "#00AA00",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#00AA00",
                fillOpacity: 0.1,
                clickable: true,
                map: map
              });
              
              // Store the polygon reference
              setMeasurementPolygons(prev => ({
                ...prev,
                [measurement.id]: polygon
              }));
            }
          }
        });
        
        // Remove loaded measurements from the remaining measurements
        setRemainingMeasurementsToLoad(prev => 
          prev.filter(measurement => 
            !newVisibleMeasurements.includes(measurement)
          )
        );
      }
    }, 200); // Throttle to once every 200ms
    
    // Create listeners for map events
    const boundsChangedListener = map.addListener('idle', loadVisibleMeasurements);
    const dragEndListener = map.addListener('dragend', loadVisibleMeasurements);
    
    return () => {
      // Clean up listeners when component unmounts
      google.maps.event.removeListener(boundsChangedListener);
      google.maps.event.removeListener(dragEndListener);
    };
  }, [map, remainingMeasurementsToLoad]);

  // Add a function to handle measurement deletion
  const handleDeleteMeasurement = useCallback(async (measurementId: string) => {
    if (!user) return;
    
    if (confirm('Are you sure you want to delete this measurement?')) {
      try {
        setIsLoading(true);
        await deleteDistanceMeasurement(measurementId);
        
        // Remove from state
        setLoadedDistanceMeasurements(prev => 
          prev.filter(m => m.id !== measurementId)
        );
        
        // Reload the map to reflect changes
        window.location.reload();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error deleting measurement:', error);
        setIsLoading(false);
      }
    }
  }, [user]);

  // Add handlers for distance measurement styling
  const handleChangeDistanceStrokeColor = useCallback((color: string) => {
    if (selectedMeasurement && measurementPolylines[selectedMeasurement.id]) {
      try {
        // Update the polyline
        const polyline = measurementPolylines[selectedMeasurement.id];
        polyline.setOptions({ 
          strokeColor: color,
          strokeOpacity: 1.0 
        });
        
        // Update the polygon if it exists
        if (measurementPolygons[selectedMeasurement.id]) {
          const polygon = measurementPolygons[selectedMeasurement.id];
          polygon.setOptions({ 
            strokeColor: color,
            strokeOpacity: 0.8
          });
        }
        
        // Update the styles state
        setDistanceStyles(prev => ({ ...prev, strokeColor: color }));
      } catch (error) {
        console.error("Error updating stroke color:", error);
      }
    }
  }, [selectedMeasurement, measurementPolylines, measurementPolygons]);
  
  
  const handleChangeDistanceFillOpacity = useCallback((opacity: number) => {
    if (selectedMeasurement && measurementPolygons[selectedMeasurement.id]) {
      // Update the polygon
      const polygon = measurementPolygons[selectedMeasurement.id];
      polygon.setOptions({ fillOpacity: opacity });
      
      // Update the styles state
      setDistanceStyles(prev => ({ ...prev, fillOpacity: opacity }));
    }
  }, [selectedMeasurement, measurementPolygons]);
  
  const handleChangeDistanceName = useCallback((name: string) => {
    if (selectedMeasurement) {
      // Update the name in the state
      setDistanceStyles(prev => ({ ...prev, name: name }));
      
      // We would typically update this in the database, but for now just update local state
      setSelectedMeasurement((prev: any) => ({ ...prev, name: name }));
      
      // Here you would normally also update the name in the database
      // saveDistanceMeasurementName(selectedMeasurement.id, name);
    }
  }, [selectedMeasurement]);

  // Add a function to handle measurement selection clearing
  const clearSelectedMeasurement = useCallback(() => {
    setSelectedMeasurement(null);
  }, []);
  
  // Add map click listener to deselect measurement
  useEffect(() => {
    if (!map) return;
    
    // Create a map click listener to deselect the measurement
    const clickListener = map.addListener('click', () => {
      if (selectedMeasurement && !measureDistanceMode) {
        clearSelectedMeasurement();
        
        // Reset styling on polylines using the component state
        if (measurementPolylines && Object.keys(measurementPolylines).length > 0) {
          Object.values(measurementPolylines).forEach(polyline => {
            polyline.setOptions({
              strokeWeight: 3,
              strokeColor: "#00AA00"
            });
          });
        }
        
        // Reset styling on polygons using the component state
        if (measurementPolygons && Object.keys(measurementPolygons).length > 0) {
          Object.values(measurementPolygons).forEach(polygon => {
            polygon.setOptions({
              strokeWeight: 2,
              strokeColor: "#00AA00",
              fillOpacity: 0.1
            });
          });
        }
      }
      
      // Also deselect any selected field when clicking on the map
      // But only if we're not in edit mode or drag mode
      if (selectedPolygonIndex !== null && !isDrawingMode && !isSelectedPolygonEditable && !isSelectedPolygonDraggable) {
        // Get the current polygon to reset its styling
        const polygon = fieldPolygons[selectedPolygonIndex];
        
        // Store the original styling values from the polygon or use defaults
        const originalStrokeWeight = polygon.get('originalStrokeWeight') || strokeWeight;
        const originalZIndex = polygon.get('originalZIndex') || (selectedPolygonIndex + 10);
        
        // Reset the polygon's visual styling to original values
        polygon.setOptions({
          strokeWeight: originalStrokeWeight,
          zIndex: originalZIndex
        });
        
        // Ensure complete cleanup of selection state
        setSelectedPolygonIndex(null);
        setShowPolygonTools(false);
        setSelectedFieldInfo(null);
        setIsSelectedPolygonEditable(false);
        setIsSelectedPolygonDraggable(false);
        
        // Make sure to reset any active editing state
        polygon.setEditable(false);
        polygon.setDraggable(false);
        
        console.log("Field deselected by map click");
      }
    });
    
    // Clean up the listener when the component unmounts
    return () => {
      google.maps.event.removeListener(clickListener);
    };
  }, [map, selectedMeasurement, measureDistanceMode, clearSelectedMeasurement, measurementPolylines, measurementPolygons, selectedPolygonIndex, isDrawingMode, fieldPolygons, strokeWeight, isSelectedPolygonEditable, isSelectedPolygonDraggable]);

  // Add function to toggle distance measurement editable state
  const handleToggleDistanceEditable = useCallback(() => {
    if (selectedMeasurement && measurementPolylines[selectedMeasurement.id]) {
      const polyline = measurementPolylines[selectedMeasurement.id];
      const currentEditable = polyline.getEditable();
      polyline.setEditable(!currentEditable);
      
      if (measurementPolygons[selectedMeasurement.id]) {
        const polygon = measurementPolygons[selectedMeasurement.id];
        polygon.setEditable(!currentEditable);
      }
    }
  }, [selectedMeasurement, measurementPolylines, measurementPolygons]);

  // Load user's markers when the component loads
  useEffect(() => {
    // Only load markers if user is authenticated and the map is ready
    if (user && map && !isLoading) {
      const loadUserMarkers = async () => {
        try {
          console.log('Starting to load markers for user:', user.uid);
          
          // Query user's markers from Firestore
          const markersQuery = query(
            collection(db, 'markers'), 
            where('userId', '==', user.uid)
          );
          
          const querySnapshot = await getDocs(markersQuery);
          console.log(`Found ${querySnapshot.size} markers in Firebase`);
          
          if (querySnapshot.empty) {
            console.log('No markers found for this user');
            return;
          }

          // Create Google Maps markers from the Firebase data
          querySnapshot.forEach((docSnapshot) => {
            if (!map || !window.google) return;
            
            const markerData = docSnapshot.data() as MarkerData & { userId: string };
            console.log('Loading marker:', markerData);
            
            if (!markerData.position || typeof markerData.position.lat !== 'number' || typeof markerData.position.lng !== 'number') {
              console.error('Invalid marker position:', markerData.position);
              return;
            }
            
            // Create the marker
            const markerPosition = new google.maps.LatLng(markerData.position.lat, markerData.position.lng);
            
            // Create custom marker icon
            const customIcon = {
              path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
              fillColor: markerData.color || '#F44336',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              scale: 2,
              anchor: new google.maps.Point(12, 22)
            };
            
            const marker = new google.maps.Marker({
              position: markerPosition,
              map: map,
              icon: customIcon,
              draggable: false, // Not draggable in normal mode, only in marker mode
              zIndex: 1000
            });
            
            // Add label if exists
            if (markerData.label) {
              // Store the label data with the marker but don't create an InfoWindow
              marker.set('labelText', markerData.label);
            }
            
            // Store marker references for future use
            marker.set('markerId', markerData.id);
            marker.set('firebaseId', docSnapshot.id);
            
            console.log(`Created marker at position: ${markerData.position.lat}, ${markerData.position.lng}`);
          });
          
          console.log('Finished loading markers');
        } catch (error) {
          console.error('Error loading markers:', error);
        }
      };
      
      loadUserMarkers();
    }
  }, [user, map, isLoading]);

  const handleMarkerMode = () => {
    // Exit drawing mode if active
    if (isDrawingMode) {
      handleCancelDrawing();
    }
    
    // Exit distance measurement mode if active
    if (measureDistanceMode) {
      handleExitMeasureDistance();
    }
    
    // If the map is available, save the current center as the last position
    if (map) {
      const center = map.getCenter();
      if (center) {
        saveLastPosition({
          lat: center.lat(),
          lng: center.lng()
        });
      }
    }
    
    // Toggle marker mode
    setMarkerMode(prev => !prev);
    
    // Hide other menus
    setShowPolygonTools(false);
    setShowDistanceTools(false);
  };

  // Add a cleanup function to remove ghost fields
  useEffect(() => {
    if (!map || fieldPolygons.length <= 1) return;
    
    // Find and remove duplicate polygons (ghost fields)
    const cleanupGhostFields = () => {
      console.log("Running ghost field cleanup...");
      
      // Track field IDs we've seen
      const seenFieldIds = new Set<string>();
      const duplicateIndices: number[] = [];
      
      // Find duplicates
      fieldPolygons.forEach((polygon, index) => {
        const fieldId = polygon.get('fieldId');
        
        // If this field has an ID and we've seen it before, it's a duplicate
        if (fieldId) {
          if (seenFieldIds.has(fieldId)) {
            console.log(`Found duplicate field: ${fieldId} at index ${index}`);
            duplicateIndices.push(index);
          } else {
            seenFieldIds.add(fieldId);
          }
        }
      });
      
      // Remove duplicates if found (in reverse order to maintain correct indices)
      if (duplicateIndices.length > 0) {
        console.log(`Removing ${duplicateIndices.length} ghost fields`);
        
        // Sort in descending order to remove from end first
        duplicateIndices.sort((a, b) => b - a);
        
        // Create a new array without the duplicates
        const cleanedPolygons = [...fieldPolygons];
        
        duplicateIndices.forEach(index => {
          // Remove the polygon from the map
          const polygon = cleanedPolygons[index];
          
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
          
          // Remove from array
          cleanedPolygons.splice(index, 1);
        });
        
        // Update state with cleaned polygons
        setFieldPolygons(cleanedPolygons);
      }
    };
    
    // Run cleanup after a short delay to ensure all fields are loaded
    const timeoutId = setTimeout(cleanupGhostFields, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [map, fieldPolygons, setFieldPolygons]);

  // Function to exit edit mode without blinking
  const handleExitEditMode = useCallback(() => {
    if (selectedPolygonIndex !== null && selectedPolygonIndex < fieldPolygons.length) {
      const polygon = fieldPolygons[selectedPolygonIndex];
      
      // Disable edit and drag modes directly on the polygon
      polygon.setEditable(false);
      polygon.setDraggable(false);
      
      // Update React state
      setIsSelectedPolygonEditable(false);
      setIsSelectedPolygonDraggable(false);
      
      // Hide any vertex/edge markers
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      vertexMarkers.forEach((marker: google.maps.Marker) => {
        marker.setMap(null);
      });
      
      const edgeMarkers = polygon.get('edgeMarkers') || [];
      edgeMarkers.forEach((marker: google.maps.Marker | google.maps.OverlayView) => {
        marker.setMap(null);
      });
      
      // Completely deselect the field to hide all panels
      setSelectedPolygonIndex(null);
      setSelectedFieldInfo(null);
      setShowPolygonTools(false);
    }
  }, [fieldPolygons, selectedPolygonIndex]);

  // Function to save the field and exit edit mode
  const handleSaveAndExitEditMode = useCallback(async () => {
    try {
      // Set saving state to true
      setIsEditSaving(true);
      
      // First save the field
      await handleSaveAllFields();
      
      // Reset saving state immediately after saving completes
      setIsEditSaving(false);
      
      // Then exit edit mode
      handleExitEditMode();
      
    } catch (error) {
      console.error('Error while saving and exiting edit mode:', error);
      // Reset saving state
      setIsEditSaving(false);
      // Still try to exit edit mode even if saving fails
      handleExitEditMode();
    }
  }, [handleSaveAllFields, handleExitEditMode, setIsEditSaving]);

  // Add click handlers to all field polygons
  useEffect(() => {
    if (!map) return;
    
    // Add click handlers to all polygons
    fieldPolygons.forEach((polygon, index) => {
      // Remove any existing click listeners to prevent duplicates
      google.maps.event.clearListeners(polygon, 'click');
      
      // Add new click listener
      polygon.addListener('click', (e: google.maps.PolyMouseEvent) => {
        // Stop propagation to prevent map click
        if (e.domEvent) {
          e.domEvent.stopPropagation();
        }
        
        // Don't trigger selection/deselection if we're in edit mode for this polygon
        if (selectedPolygonIndex === index && (isSelectedPolygonEditable || isSelectedPolygonDraggable)) {
          // In edit mode, we just want to let the default Google Maps behavior work
          return;
        }
        
        // Call our handlePolygonClick function with this polygon's index
        handlePolygonClick(index);
      });
    });
    
    // Clean up listeners when component unmounts
    return () => {
      fieldPolygons.forEach(polygon => {
        google.maps.event.clearListeners(polygon, 'click');
      });
    };
  }, [fieldPolygons, map, handlePolygonClick, selectedPolygonIndex, isSelectedPolygonEditable, isSelectedPolygonDraggable]);

  // Add state for field details form
  const [showFieldDetailsForm, setShowFieldDetailsForm] = useState(false);

  // ... existing code ...
  {/* Form button - icon only */}
  <button
    onClick={() => {
      if (selectedPolygonIndex !== null) {
        const polygon = fieldPolygons[selectedPolygonIndex];
        const fieldId = polygon.get('fieldId');
        if (fieldId) {
          setShowFieldDetailsForm(true);
        } else {
          console.error("Field ID not found");
          alert("Cannot open form: Field ID not found");
        }
      }
    }}
    className="p-2 text-white hover:text-yellow-200 transition-colors"
    title="Field Form"
  >
    <FontAwesomeIcon icon={faFileAlt} className="text-lg" />
  </button>
  // ... existing code ...

  // ... existing code ...
  {/* Add the FieldDetailsForm */}
  {showFieldDetailsForm && selectedPolygonIndex !== null && (
    <FieldDetailsForm
      isOpen={showFieldDetailsForm}
      onClose={() => setShowFieldDetailsForm(false)}
      fieldId={fieldPolygons[selectedPolygonIndex].get('fieldId') || null}
      fieldName={fieldPolygons[selectedPolygonIndex].get('fieldName') || 'Unnamed Field'}
      onSave={async (formData: FieldFormData) => {
        try {
          await saveFieldOwnerDetails(formData);
          return Promise.resolve();
        } catch (error) {
          console.error("Error saving field details:", error);
          return Promise.reject(error);
        }
      }}
    />
  )}
  // ... existing code ...

  if (!isClient) {
    return <div className={cn("h-full w-full", className)} />;
  }

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      libraries={libraries}
    >
      <div className="flex flex-col h-screen w-full">
          {/* Add the area information banner for selected field */}
          {selectedFieldInfo && !isDrawingMode && !isSelectedPolygonEditable && !isSelectedPolygonDraggable && (
          <>
            <div className="fixed top-0 left-0 right-0 bg-yellow-500 shadow-lg z-[100]">
              <div className="w-full flex justify-between items-center p-2">
                <button
                  onClick={() => {
                    // Deselect the field
                    setSelectedPolygonIndex(null);
                    setSelectedFieldInfo(null);
                    setShowPolygonTools(false);
                  }}
                  className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                  title="Close field details"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-xl" />
                </button>
                
                {/* Field edit controls in center */}
                <div className="flex-1 flex justify-center items-center gap-4">
                  {/* Display field name */}
                  <div className="text-center">
                    <span className="font-medium text-white text-lg">{selectedFieldInfo?.name}</span>
                  </div>
                  
                  {/* Edit field shape button - icon only */}
                  <button
                    onClick={handleToggleEditable}
                    className={`p-2 transition-colors ${
                      isSelectedPolygonEditable 
                        ? "text-green-300" 
                        : "text-white hover:text-yellow-200"
                    }`}
                    title={isSelectedPolygonEditable ? "Finish Editing Vertices" : "Edit Field Shape"}
                  >
                    <FontAwesomeIcon icon={faPencilAlt} className="text-lg" />
                  </button>
                  
                  {/* Form button - icon only */}
                  <button
                    onClick={() => {
                      if (selectedPolygonIndex !== null) {
                        const polygon = fieldPolygons[selectedPolygonIndex];
                        const fieldId = polygon.get('fieldId');
                        if (fieldId) {
                          setShowFieldDetailsForm(true);
                        } else {
                          console.error("Field ID not found");
                          alert("Cannot open form: Field ID not found");
                        }
                      }
                    }}
                    className="p-2 text-white hover:text-yellow-200 transition-colors"
                    title="Field Form"
                  >
                    <FontAwesomeIcon icon={faFileAlt} className="text-lg" />
                  </button>
                  
                  {/* Delete field button - icon only */}
                  <button
                    onClick={handleDeletePolygon}
                    className="p-2 text-white hover:text-red-300 transition-colors"
                    title="Delete Field"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-lg" />
                  </button>
                  
                  {/* Advanced tool icon (three dots/ellipsis) with dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowAdvancedTools(!showAdvancedTools)}
                      className="p-2 text-white hover:text-yellow-200 transition-colors"
                      title="Advanced Tools"
                    >
                      <FontAwesomeIcon icon={faEllipsisV} className="text-lg" />
                    </button>
                    
                    {/* Advanced tools dropdown */}
                    {showAdvancedTools && (
                      <div className="absolute right-0 mt-1 bg-white rounded-md shadow-lg z-[102] w-40">
                        <div className="py-1">
                          {/* Move field option */}
                          <button
                            onClick={() => {
                              handleToggleDraggable();
                              setShowAdvancedTools(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm ${
                              isSelectedPolygonDraggable 
                                ? "text-green-600 font-medium" 
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            <div className="flex items-center">
                              <FontAwesomeIcon icon={faArrowsAlt} className="mr-2" />
                              {isSelectedPolygonDraggable ? "Disable Moving" : "Move Field"}
                            </div>
                          </button>
                          
                          {/* Merge fields option */}
                          <button
                            onClick={() => {
                              handleToggleMergeMode();
                              setShowAdvancedTools(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm ${
                              isMergeMode 
                                ? "text-green-600 font-medium" 
                                : "text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            <div className="flex items-center">
                              <FontAwesomeIcon icon={faObjectGroup} className="mr-2" />
                              {isMergeMode ? "Cancel Merge" : "Merge Fields"}
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tools button on right */}
                <div className="flex items-center">
                  <button
                    onClick={() => setShowPolygonTools(prev => !prev)}
                    className={`p-1 rounded-md transition-colors ${
                      showPolygonTools 
                        ? "bg-white/20 text-white" 
                        : "text-white hover:bg-white/20"
                    }`}
                    title={showPolygonTools ? "Close Field Tools" : "Open Field Tools"}
                  >
                    <FontAwesomeIcon icon={showPolygonTools ? faTimes : faCog} className="text-xl" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Black transparent panel showing field stats */}
            <div className="fixed top-12 left-0 right-0 bg-black/50 shadow-lg z-[99] p-2">
              <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-100">Area:</span>
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
          </>
        )}
        
        <Navbar 
          onPlaceSelect={handlePlaceSelect} 
          isDrawingMode={isDrawingMode}
          onCancelDrawing={handleCancelDrawing}
          onFinishDrawing={handleFinishDrawing}
          canFinishDrawing={window.tempVerticesRef && window.tempVerticesRef.length >= 3}
        />
        
        <div style={mapStyles.container}>
          
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
          
          {/* Add the merge mode banner */}
          {isMergeMode && (
            <div className="absolute top-0 left-0 right-0 bg-orange-500 shadow-lg z-20 p-2">
              <div className="container mx-auto flex justify-between items-center">
                <button
                  onClick={handleToggleMergeMode}
                  className="text-white hover:bg-white/20 rounded-full p-1.5"
                  title="Exit Merge Mode"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-base" />
                </button>
                
                <div className="flex-1 text-center">
                  <span className="font-medium text-white">
                    {polygonsToMerge.length === 0 
                      ? "Select fields to merge" 
                      : `Selected ${polygonsToMerge.length} field${polygonsToMerge.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMergePolygons}
                    disabled={polygonsToMerge.length < 2}
                    className={`text-white rounded px-2 py-1 text-sm ${
                      polygonsToMerge.length < 2 
                        ? "opacity-50 cursor-not-allowed" 
                        : "hover:bg-white/20"
                    }`}
                  >
                    MERGE & SAVE
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add the edit mode yellow banner */}
          {!isDrawingMode && selectedFieldInfo && (isSelectedPolygonEditable || isSelectedPolygonDraggable) && (
            <>
              <div className="fixed top-0 left-0 right-0 bg-yellow-500 shadow-lg z-[101] py-2 px-2">
                <div className="container mx-auto flex justify-between items-center px-2">
                  <button
                    onClick={handleExitEditMode}
                    className="text-white hover:bg-white/20 rounded-full p-1.5"
                    title="Exit Edit Mode"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-base" />
                  </button>
                  
                  <div className="flex-1 text-center">
                    <span className="font-medium text-white text-base">{selectedFieldInfo.name}</span>
                  </div>
                  
                  <button
                    onClick={handleSaveAndExitEditMode}
                    disabled={isEditSaving}
                    className="text-white hover:bg-white/20 rounded px-2 py-1 text-sm"
                  >
                    {isEditSaving ? (
                      <span className="animate-pulse">SAVING...</span>
                    ) : (
                      "SAVE"
                    )}
                  </button>
                </div>
              </div>
              
              {/* Second row with detailed measurements */}
              <div className="fixed top-[56px] left-0 right-0 bg-black/50 shadow-lg z-[101] py-1 px-2">
                <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Area:</span>
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-100">Vertices:</span>
                    <span className="text-purple-400 font-medium">
                      {selectedPolygonIndex !== null && fieldPolygons[selectedPolygonIndex] 
                        ? fieldPolygons[selectedPolygonIndex].getPath().getLength() 
                        : 0}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          <GoogleMap
            mapContainerStyle={mapStyles.map}
            center={lastPosition || defaultCenter}
            zoom={21}
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
              
              // IMPORTANT: Don't render React polygons for any selected polygon
              // This completely prevents ghost fields by only using the native Google Maps polygon
              if (selectedPolygonIndex === index) {
                return <React.Fragment key={index}></React.Fragment>;
              }
              
              return (
              <Polygon
                key={index}
                paths={polygon.getPath().getArray()}
                options={{
                    fillColor: polygon.get('fillColor') || polygonColor,
                    fillOpacity: polygon.get('fillOpacity') || polygonFillOpacity,
                    strokeColor: isMergeMode && polygonsToMerge.includes(index) 
                      ? '#FF9800' // Orange color for selected polygons in merge mode
                      : (polygon.get('strokeColor') || strokeColor),
                    strokeWeight: isMergeMode && polygonsToMerge.includes(index)
                      ? 4 // Thicker border for selected polygons in merge mode
                      : (polygon.get('strokeWeight') || strokeWeight),
                    clickable: true,
                    editable: false, // Never make React polygons editable
                    draggable: false, // Never make React polygons draggable
                    zIndex: isMergeMode && polygonsToMerge.includes(index)
                      ? (1000 + index) // Higher z-index for selected polygons in merge mode
                      : (index + 10), // Give higher z-index to more recently created polygons
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

          {/* We've moved the polygon tools buttons to the yellow banner */}

          {/* Add toggle button for distance measurement tools */}
          {selectedMeasurement && !selectedPolygonIndex && (
            <div className="absolute bottom-20 right-4 z-10">
              <button
                onClick={() => setShowDistanceTools(prev => !prev)}
                className="bg-white rounded-full shadow-lg p-3 transition-all hover:bg-gray-100 border-2 border-green-500"
                title={showDistanceTools ? "Close Distance Tools" : "Open Distance Tools"}
              >
                <FontAwesomeIcon 
                  icon={showDistanceTools ? faTimes : faCog} 
                  className="text-xl text-green-700" 
                />
              </button>
            </div>
          )}

          {/* Add the FieldImageGallery component */}
          <FieldImageGallery
            fieldImages={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
              ? fieldImages[selectedPolygonIndex].images 
              : []}
            mainImageIndex={selectedPolygonIndex !== null && fieldImages[selectedPolygonIndex] 
              ? fieldImages[selectedPolygonIndex].mainImageIndex 
              : 0}
            onAddImage={(file) => selectedPolygonIndex !== null && handleAddFieldImage(selectedPolygonIndex, file)}
            onDeleteImage={(imageIndex) => selectedPolygonIndex !== null && handleDeleteFieldImage(selectedPolygonIndex, imageIndex)}
            onSetMainImage={(imageIndex) => selectedPolygonIndex !== null && handleSetMainImage(selectedPolygonIndex, imageIndex)}
            fieldName={polygonStyles.fieldName}
            selectedPolygonIndex={selectedPolygonIndex}
          />

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
            strokeColor={polygonStyles.strokeColor}
            fillColor={polygonStyles.fillColor}
            strokeWeight={polygonStyles.strokeWeight}
            fillOpacity={polygonStyles.fillOpacity}
            fieldName={polygonStyles.fieldName}
            fieldImages={[]} // Empty array since we moved image functionality
            mainImageIndex={0}
            selectedPolygonIndex={selectedPolygonIndex}
            isEditable={isSelectedPolygonEditable}
            isDraggable={isSelectedPolygonDraggable}
          />
          
          {/* Add PolygonToolsMenu for distance measurements */}
          <PolygonToolsMenu 
            isOpen={showDistanceTools}
            onClose={() => setShowDistanceTools(false)}
            onChangeStrokeColor={(color) => {
              // Make a direct update with explicit options
              if (selectedMeasurement && measurementPolylines[selectedMeasurement.id]) {
                measurementPolylines[selectedMeasurement.id].setOptions({
                  strokeColor: color,
                  strokeOpacity: 1.0
                });
                
                // Update polygon if it exists
                if (measurementPolygons[selectedMeasurement.id]) {
                  measurementPolygons[selectedMeasurement.id].setOptions({
                    strokeColor: color,
                    strokeOpacity: 0.8
                  });
                }
                
                // Update local state
                setDistanceStyles({...distanceStyles, strokeColor: color});
              }
            }}
            onChangeFillColor={(color) => {
              // Make a direct update with explicit options
              if (selectedMeasurement && measurementPolygons[selectedMeasurement.id]) {
                measurementPolygons[selectedMeasurement.id].setOptions({
                  fillColor: color,
                  fillOpacity: distanceStyles.fillOpacity || 0.1
                });
                
                // Update local state
                setDistanceStyles({...distanceStyles, fillColor: color});
              }
            }}
            onChangeStrokeWeight={(weight) => {
              // Make a direct update with explicit options
              if (selectedMeasurement && measurementPolylines[selectedMeasurement.id]) {
                measurementPolylines[selectedMeasurement.id].setOptions({
                  strokeWeight: weight
                });
                
                // Update polygon if it exists
                if (measurementPolygons[selectedMeasurement.id]) {
                  measurementPolygons[selectedMeasurement.id].setOptions({
                    strokeWeight: weight
                  });
                }
                
                // Update local state
                setDistanceStyles({...distanceStyles, strokeWeight: weight});
              }
            }}
            onChangeFillOpacity={(opacity) => {
              // Make a direct update with explicit options
              if (selectedMeasurement && measurementPolygons[selectedMeasurement.id]) {
                measurementPolygons[selectedMeasurement.id].setOptions({
                  fillOpacity: opacity
                });
                
                // Update local state
                setDistanceStyles({...distanceStyles, fillOpacity: opacity});
              }
            }}
            onChangeName={(name) => {
              if (selectedMeasurement) {
                // Update local state
                setDistanceStyles({...distanceStyles, name: name});
                setSelectedMeasurement({...selectedMeasurement, name: name});
              }
            }}
            onDelete={() => selectedMeasurement && handleDeleteMeasurement(selectedMeasurement.id)}
            onAddImage={() => {}} // Not applicable for distance measurements
            onDeleteImage={() => {}} // Not applicable for distance measurements
            onSetMainImage={() => {}} // Not applicable for distance measurements
            strokeColor={distanceStyles.strokeColor}
            fillColor={distanceStyles.fillColor}
            strokeWeight={distanceStyles.strokeWeight}
            fillOpacity={distanceStyles.fillOpacity}
            fieldName={selectedMeasurement ? (selectedMeasurement.name || distanceStyles.name) : ''}
            fieldImages={[]} // No images for distance measurements
            mainImageIndex={0}
            selectedPolygonIndex={selectedMeasurement ? 0 : null} // Just use 0 as a placeholder when selected
          />
          
          {/* Add editable toggle button for distance measurements */}
          {showDistanceTools && selectedMeasurement && (
            <div className="absolute bottom-28 right-20 z-20">
              <button
                onClick={handleToggleDistanceEditable}
                className="bg-white rounded-full shadow-lg p-3 transition-all hover:bg-gray-100 border-2 border-blue-500"
                title="Toggle Editable State"
              >
                <FontAwesomeIcon 
                  icon={faEdit} 
                  className="text-xl text-blue-700" 
                />
              </button>
            </div>
          )}

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
                
                {/* Right side: Save & Finish buttons */}
                <div className="flex gap-2">
                  {/* Save button */}
                  <button
                    onClick={() => {
                      // When in drawing mode with active vertices, save the current drawing
                      if (window.tempVerticesRef && window.tempVerticesRef.length >= 3) {
                        handleFinishDrawing();
                      } 
                      // Otherwise save all existing fields
                      else {
                        handleSaveAllFields();
                      }
                    }}
                    className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                      fieldPolygons.length === 0 && (!window.tempVerticesRef || window.tempVerticesRef.length < 3)
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                    title={window.tempVerticesRef && window.tempVerticesRef.length >= 3 
                      ? "Save Current Drawing" 
                      : "Save All Fields"}
                  >
                    <FontAwesomeIcon icon={faFileImport} />
                  </button>
                  
                  {/* Finish button */}
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

          {/* Edit mode controls banner - similar to drawing mode banner */}
          {!isDrawingMode && selectedFieldInfo && isSelectedPolygonEditable && (
            <div className="fixed bottom-0 left-0 right-0 bg-black/80 shadow-lg z-50 p-2 w-full block">
              <div className="flex justify-between items-center max-w-full px-1 sm:px-2 mx-2">
                {/* Left side: Cancel button */}
                <div>
                  <button
                    onClick={handleExitEditMode}
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
                
                {/* Right side: Save button */}
                <div>
                  <button
                    onClick={handleSaveAndExitEditMode}
                    disabled={isEditSaving}
                    className="flex items-center gap-1 px-2 py-2 bg-green-500 text-white rounded-md shadow hover:bg-green-600 transition-colors"
                  >
                    {isEditSaving ? (
                      <>
                        <span className="animate-pulse mr-1">Saving...</span>
                      </>
                    ) : (
                    <FontAwesomeIcon icon={faCheck} />
                    )}
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

        {/* Map actions menu */}
        <CreateMenu
          showMenu={showCreateMenu}
          onToggleMenu={() => setShowCreateMenu(!showCreateMenu)}
          onOptionSelect={handleCreateOption}
        />

        {/* Add the ZoomControls component */}
        <ZoomControls 
          onZoomIn={() => map?.setZoom((map?.getZoom() || 0) + 1)}
          onZoomOut={() => map?.setZoom((map?.getZoom() || 0) - 1)}
        />
        
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

      {/* DistanceMeasurement Component */}
      <DistanceMeasurement 
        map={map}
        isActive={measureDistanceMode}
        onExit={handleExitMeasureDistance}
        onUpdate={handleDistanceUpdate}
        measurePoints={measurePoints}
        setMeasurePoints={setMeasurePoints}
        distance={distance}
        setDistance={setDistance}
        isMeasuring={measureDistanceMode}
        setIsMeasuring={setMeasureDistanceMode}
        selectedMeasurement={selectedMeasurement}
        onClearSelectedMeasurement={clearSelectedMeasurement}
        onPositionUpdate={saveLastPosition}
      />

      {/* MarkerComponent */}
      <MarkerComponent
        map={map}
        isActive={markerMode}
        onExit={handleExitMarkerMode}
        onPositionUpdate={saveLastPosition}
      />

      {/* Add the FieldDetailsForm */}
      {showFieldDetailsForm && selectedPolygonIndex !== null && (
        <FieldDetailsForm
          isOpen={showFieldDetailsForm}
          onClose={() => setShowFieldDetailsForm(false)}
          fieldId={fieldPolygons[selectedPolygonIndex].get('fieldId') || null}
          fieldName={fieldPolygons[selectedPolygonIndex].get('fieldName') || 'Unnamed Field'}
          fieldCoordinates={Array.from({ length: fieldPolygons[selectedPolygonIndex].getPath().getLength() }, 
            (_, i) => {
              const point = fieldPolygons[selectedPolygonIndex].getPath().getAt(i);
              return { lat: point.lat(), lng: point.lng() };
            }
          )}
          onSave={async (formData: FieldFormData) => {
            try {
              await saveFieldOwnerDetails(formData);
              return Promise.resolve();
            } catch (error) {
              console.error("Error saving field details:", error);
              return Promise.reject(error);
            }
          }}
        />
      )}
    </LoadScript>
  );
};

// Add TypeScript declarations for the window object to avoid errors
declare global {
  interface Window {
    tempPolylineRef: google.maps.Polyline | null;
    tempVerticesRef: google.maps.LatLng[];
    tempMarkersRef: google.maps.Marker[];
    tempEdgeMarkersRef: (google.maps.Marker | google.maps.OverlayView)[];
    handleSaveAllFields?: () => Promise<void>;
    measurementPolylines?: Record<string, google.maps.Polyline>;
    measurementPolygons?: Record<string, google.maps.Polygon>;
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