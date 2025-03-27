'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Circle, DrawingManager, Polygon } from '@react-google-maps/api';
import Navbar from './Navbar';
import MapControls from './MapControls';
import CreateMenu from './CreateMenu';
import ZoomControls from './ZoomControls';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faFileImport, faDrawPolygon, faRuler, faMapMarker, faPlus, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';

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
  map: {
    width: '100%',
    height: '100%'
  }
};

const defaultCenter = {
  lat: 27.342860470286933, 
  lng: 75.79046143662488,
};

const MARKER_ROTATION = 180; // Rotation in degrees

interface MapComponentProps {
  onAreaUpdate?: (newArea: number) => void;
  className?: string;
}

const MapComponent: React.FC<MapComponentProps> = ({ onAreaUpdate, className }) => {
  const [isClient, setIsClient] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Add new state variables for drawing
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [fieldPolygons, setFieldPolygons] = useState<google.maps.Polygon[]>([]);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  
  // Add a ref to track the currently active drag marker
  const activeVertexMarkerRef = useRef<google.maps.Marker | null>(null);

  // Create a ref to store the DistanceOverlay class
  const DistanceOverlayRef = useRef<any>(null);
  
  // Add states for undo/redo functionality
  const [undoStack, setUndoStack] = useState<google.maps.LatLng[][]>([]);
  const [redoStack, setRedoStack] = useState<google.maps.LatLng[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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
        
        div.innerHTML = `
          <div style="
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            text-align: center;
            min-width: 60px;
            transform: translate(-50%, -150%);
            box-shadow: 0 3px 6px rgba(0,0,0,0.3);
            white-space: nowrap;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.3);
          ">
            <input
              type="number"
              value="${numericValue}"
              step="${unit === 'km' ? '0.01' : '1'}"
              min="0"
              style="
                width: 50px;
                background: transparent;
                border: none;
                color: white;
                font-size: 14px;
                text-align: right;
                outline: none;
                padding: 0;
                font-weight: 600;
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

  // Add polygon complete handler
  const onPolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    // Add the new polygon to our state
    setFieldPolygons(prev => [...prev, polygon]);
    
    // Disable drawing mode after polygon is complete
    setIsDrawingMode(false);
    
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
        
        // Calculate distance
        const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        const distanceText = distance < 1000 
          ? `${Math.round(distance)}m`
          : `${(distance / 1000).toFixed(2)}km`;
        
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
            scale: 5,
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
          // If there's an existing active vertex marker, remove its drag marker
          if (activeVertexMarkerRef.current && activeVertexMarkerRef.current !== edgeMarker) {
            // Reset the previous active marker if it's not this one
            activeVertexMarkerRef.current.setOpacity(1);
            
            // Find and remove the previous drag marker if it exists
            const prevDragMarker = activeVertexMarkerRef.current.get('dragMarker');
            if (prevDragMarker) {
              prevDragMarker.setMap(null);
              activeVertexMarkerRef.current.set('dragMarker', null);
            }
          }
          
          const position = edgeMarker.getPosition();
          if (!position) return;
          
          // Create draggable red marker at the edge midpoint
          const dragMarker = new google.maps.Marker({
            position: position,
            map: map,
            icon: {
              path: LOCATION_MARKER_PATH,
              fillColor: '#FF0000',
              fillOpacity: 0.2,
              strokeColor: '#FFFFFF',
              strokeWeight: 1,
              scale: 5.0,
              anchor: new google.maps.Point(12, 22),
              rotation: MARKER_ROTATION
            },
            draggable: true,
            crossOnDrag: false,
            zIndex: 3
          });
          
          // Store the drag marker reference in the edge marker
          edgeMarker.set('dragMarker', dragMarker);
          
          // Set this as the active vertex marker
          activeVertexMarkerRef.current = edgeMarker;
          
          // Hide the original marker
          edgeMarker.setOpacity(0);
          
          // Add drag listener to insert and update new vertex
          dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            
            // Update the vertex position
            const index = edgeMarker.get('edgeIndex');
            if (typeof index === 'number') {
              // Update the vertex in the path
              path.setAt(index, e.latLng);
              
              // Update the original marker position too (even while invisible)
              edgeMarker.setPosition(e.latLng);
            
            // Update edge markers
            addEdgeMarkers();
            }
          });
          
          // Add dragend listener to clean up
          dragMarker.addListener('dragend', () => {
            // Clean up the temporary drag marker
            if (dragMarker) {
              dragMarker.setMap(null);
            }
            edgeMarker.set('dragMarker', null);
            edgeMarker.setOpacity(1);
            activeVertexMarkerRef.current = null;
            
            // Reset the edge marker state
            edgeMarker.set('vertexInserted', false);
            edgeMarker.set('insertedIndex', null);
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
          path: LOCATION_MARKER_PATH,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
          scale: 5.0,
          anchor: new google.maps.Point(12, 22),
        },
        draggable: true,
        zIndex: 2
      });

      // Store the vertex index directly in the marker for easier reference
      marker.set('vertexIndex', i);
      marker.set('parentPolygon', polygon);

      // Add drag listeners to update the polygon shape while dragging
      marker.addListener('dragstart', () => {
        // If there's an existing active vertex marker, remove the red styling
        if (activeVertexMarkerRef.current && activeVertexMarkerRef.current !== marker) {
          activeVertexMarkerRef.current.setIcon({
            path: LOCATION_MARKER_PATH,
            fillColor: '#FF0000',
            fillOpacity: 0.2,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            scale: 5.0,
            anchor: new google.maps.Point(12, 22),
          });
        }
        
        // Set this marker as the active one
        activeVertexMarkerRef.current = marker;
        
        // Make the dragged marker more prominent
        marker.setIcon({
          path: LOCATION_MARKER_PATH,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 5.0,
          anchor: new google.maps.Point(12, 22),
        });
      });

      marker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const index = marker.get('vertexIndex');
        if (typeof index === 'number') {
          path.setAt(index, e.latLng);
        addEdgeMarkers();
        }
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
          path: LOCATION_MARKER_PATH,
          fillColor: '#FF0000',
          fillOpacity: 0.2,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
          scale: 5.0,
          anchor: new google.maps.Point(12, 22),
        },
        draggable: true,
        zIndex: 2
      });

      // Store the vertex index directly in the marker
      marker.set('vertexIndex', index);
      marker.set('parentPolygon', polygon);

      marker.addListener('drag', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        // Use the stored vertex index
        const idx = marker.get('vertexIndex');
        if (typeof idx === 'number') {
          path.setAt(idx, e.latLng);
        addEdgeMarkers();
        }
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
    
    // Show the create menu again so user can create another field if desired
    setShowCreateMenu(true);
  }, [map]);

  // Create menu handlers - moved after onPolygonComplete
  const handleCreateOption = useCallback((option: 'import' | 'field' | 'distance' | 'marker') => {
    setShowCreateMenu(false);
    // Handle different creation options here
    switch (option) {
      case 'import':
        // Handle import
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
        break;
      case 'marker':
        // Handle marker placement
        break;
    }
  }, [map, isDrawingMode, onPolygonComplete, fieldPolygons]);

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
    gestureHandling: 'cooperative',
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
              scale: 5,
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
              scale: 5.0,
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
                draggable: true,
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
                        scale: 5.0,
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
                    // Save state before dragging vertex
                    saveToUndoStack([...window.tempVerticesRef]);
                    
                    // Delegate to the click handler to create the red marker
                    google.maps.event.trigger(newVertexMarker, 'click');
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
  }, [map, saveToUndoStack]);

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
          draggable: true,
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
              scale: 5.0,
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
            // Use the vertex index directly from the marker
            vertices[index] = e.latLng;
            
            // Update the original marker position too (even while invisible)
            marker.setPosition(e.latLng);
            
            if (tempPolyline) {
              const path = vertices.slice();
              if (vertices.length >= 3) {
                path.push(vertices[0]);
              }
              tempPolyline.setPath(path);
            }
            updateEdgeMarkers();
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
          saveToUndoStack([...vertices]);
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
  }, [map, isDrawingMode, onPolygonComplete, fieldPolygons, saveToUndoStack, updateEdgeMarkers]);

  // Use effect to setup auto-close polygon when drawing mode changes
  useEffect(() => {
    const cleanup = setupAutoClosePolygon();
    return cleanup;
  }, [setupAutoClosePolygon, isDrawingMode, fieldPolygons, saveToUndoStack, updateEdgeMarkers]);

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
      draggable: true,
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
          scale: 5.0,
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
        // Use the vertex index directly from the marker
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
  }, [map, updateEdgeMarkers, saveToUndoStack]);

  // Add a function to clear all red markers
  const clearAllRedMarkers = useCallback(() => {
    // Get all vertex markers
    let allMarkers: google.maps.Marker[] = [];
    
    // Add markers from active drawing
    if (window.tempMarkersRef) {
      allMarkers = [...allMarkers, ...window.tempMarkersRef];
    }
    
    // Add markers from completed polygons
    fieldPolygons.forEach(polygon => {
      const vertexMarkers = polygon.get('vertexMarkers') || [];
      const edgeMarkers = polygon.get('edgeMarkers') || [];
      allMarkers = [...allMarkers, ...vertexMarkers, ...edgeMarkers];
    });
    
    // Find and remove any drag markers
    allMarkers.forEach(marker => {
      const dragMarker = marker.get('dragMarker');
      if (dragMarker) {
        dragMarker.setMap(null);
        marker.set('dragMarker', null);
        marker.setOpacity(1);
      }
    });
    
    // Reset active vertex reference
    activeVertexMarkerRef.current = null;
  }, [fieldPolygons]);

  if (!isClient) {
    return <div className={cn("h-full w-full", className)} />;
  }

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      libraries={libraries}
    >
      <div className="flex flex-col h-screen w-full">
        <Navbar onPlaceSelect={handlePlaceSelect} />
        <div style={mapStyles.container}>
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
            
            {/* Display existing field polygons */}
            {fieldPolygons.map((polygon, index) => (
              <Polygon
                key={index}
                paths={polygon.getPath().getArray()}
                options={{
                  fillColor: polygonColor,  // Use the green color
                  fillOpacity: polygonFillOpacity,
                  strokeColor: strokeColor,  // Use the green color
                  strokeWeight: strokeWeight,
                  clickable: true, // Set to true to allow clicking through the polygon (to the map)
                  editable: false, // Default to non-editable
                  draggable: false, // Default to non-draggable
                  zIndex: 1,
                }}
                onClick={(e) => {
                  // Only if we're in drawing mode, prevent default and let the click pass through to the map
                  if (isDrawingMode) {
                    e.stop(); // Stop event propagation to prevent Google Maps default behavior
                    
                    // Manually forward the click to the map to add a vertex
                    if (e.latLng && map) {
                      google.maps.event.trigger(map, 'click', { 
                        latLng: e.latLng,
                        stop: () => {} // Dummy function to match event interface
                      });
                    }
                  }
                }}
              />
            ))}
          </GoogleMap>

          {/* Add undo/redo buttons */}
          {isDrawingMode && (
            <div className="absolute top-20 left-4 flex gap-2">
              <button
                onClick={() => {
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
                }}
                disabled={undoStack.length === 0}
                className={`rounded-full shadow-lg p-3 transition-all ${
                  undoStack.length > 0 ? 'bg-white text-gray-700 hover:bg-gray-100' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title="Undo"
              >
                <FontAwesomeIcon icon={faUndo} className="text-lg" />
              </button>
              <button
                onClick={() => {
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
                }}
                disabled={redoStack.length === 0}
                className={`rounded-full shadow-lg p-3 transition-all ${
                  redoStack.length > 0 ? 'bg-white text-gray-700 hover:bg-gray-100' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title="Redo"
              >
                <FontAwesomeIcon icon={faRedo} className="text-lg" />
              </button>
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
          onToggleMenu={() => setShowCreateMenu(!showCreateMenu)}
          onOptionSelect={handleCreateOption}
        />

        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
      </div>
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