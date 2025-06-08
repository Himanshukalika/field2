'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons';
import { v4 as uuidv4 } from 'uuid';
import { saveDistanceMeasurement } from '../../lib/firebase';
import { useAuth } from '@/app/context/AuthContext';

// Add the distance label styles
const styles = {
  distanceLabelStyle: {
    background: 'rgba(0, 170, 0, 0.8)',
    color: 'white',
    padding: '3px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    border: '1px solid white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  }
};

// Define the location marker path (same as in MapComponent)
const LOCATION_MARKER_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";
const MARKER_ROTATION = 180; // Rotation in degrees
const DEFAULT_MARKER_SCALE = 5.0;

interface DistanceMeasurementProps {
  map: google.maps.Map | null;
  onUpdate: (distance: number, measurePoints: google.maps.LatLngLiteral[]) => void;
  measurePoints: google.maps.LatLngLiteral[];
  setMeasurePoints: React.Dispatch<React.SetStateAction<google.maps.LatLngLiteral[]>>;
  distance: number;
  setDistance: React.Dispatch<React.SetStateAction<number>>;
  isMeasuring: boolean;
  setIsMeasuring: React.Dispatch<React.SetStateAction<boolean>>;
  isActive: boolean;
  onExit: () => void;
  selectedMeasurement?: any;
  onClearSelectedMeasurement?: () => void;
  onPositionUpdate?: (position: {lat: number, lng: number}) => void;
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({
  map,
  onUpdate,
  measurePoints,
  setMeasurePoints,
  distance,
  setDistance,
  isMeasuring,
  setIsMeasuring,
  isActive,
  onExit,
  selectedMeasurement,
  onClearSelectedMeasurement,
  onPositionUpdate
}) => {
  const { user } = useAuth();
  const [isHovering, setIsHovering] = useState(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<google.maps.LatLngLiteral[][]>([]);
  const [redoStack, setRedoStack] = useState<google.maps.LatLngLiteral[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [pathClosed, setPathClosed] = useState(false);
  const [areaInSqMeters, setAreaInSqMeters] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [measurementName, setMeasurementName] = useState('');
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const edgeMarkersRef = useRef<google.maps.Marker[]>([]);
  const dragMarkersRef = useRef<google.maps.Marker[]>([]);
  const distanceLabelsRef = useRef<google.maps.Marker[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const draggingRef = useRef<boolean>(false);
  const localPointsRef = useRef<google.maps.LatLngLiteral[]>([]);
  const activeEdgeMarkerRef = useRef<google.maps.Marker | null>(null);
  
  // Update local points reference when measurePoints changes
  useEffect(() => {
    localPointsRef.current = [...measurePoints];
  }, [measurePoints]);

  // Clear all red drag markers from the map
  const clearRedMarkers = () => {
    // Remove all drag markers
    dragMarkersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    dragMarkersRef.current = [];
    
    // Reset all white vertex marker opacities
    markersRef.current.forEach(marker => {
      marker.setOpacity(1);
    });
    
    // Reset all edge marker opacities
    edgeMarkersRef.current.forEach(marker => {
      marker.setOpacity(1);
    });
    
    // Reset active edge marker reference
    activeEdgeMarkerRef.current = null;
  };

  // Function to clear distance labels
  const clearDistanceLabels = () => {
    distanceLabelsRef.current.forEach(label => {
      // Check if it's our custom overlay (has setMap method but not a standard marker)
      if (label && typeof (label as any).setMap === 'function') {
        (label as any).setMap(null);
      }
    });
    distanceLabelsRef.current = [];
  };

  // Clear all edge markers from the map
  const clearEdgeMarkers = () => {
    edgeMarkersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    edgeMarkersRef.current = [];
  };

  // Clear all markers from the map
  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    
    clearRedMarkers();
    clearDistanceLabels();
    clearEdgeMarkers();
  };

  // Create edge markers between vertices
  const updateEdgeMarkers = () => {
    if (!mapRef.current) return;
    
    // Thoroughly clean up existing edge markers
    edgeMarkersRef.current.forEach(marker => {
      // Make sure we remove any associated drag markers too
      const dragMarker = marker.get('dragMarker');
      if (dragMarker) {
        dragMarker.setMap(null);
      }
      
      // Remove the marker itself
      marker.setMap(null);
    });
    edgeMarkersRef.current = [];
    
    const points = localPointsRef.current;
    if (points.length < 2) return;
    
    // Create an edge marker between each pair of vertices
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // Use Google Maps LatLng objects for more accurate calculations
      const p1LatLng = new google.maps.LatLng(p1.lat, p1.lng);
      const p2LatLng = new google.maps.LatLng(p2.lat, p2.lng);
      
      // Find the exact midpoint along the polyline path
      // This ensures the edge marker stays precisely on the line regardless of zoom
      let midpointLatLng;
      
      try {
        // Try to use the geometry library for precise calculations
        const heading = google.maps.geometry.spherical.computeHeading(p1LatLng, p2LatLng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(p1LatLng, p2LatLng);
        midpointLatLng = google.maps.geometry.spherical.computeOffset(p1LatLng, distance/2, heading);
      } catch (error) {
        // Fall back to simple averaging if geometry library fails
        console.warn('Geometry library error, using fallback calculation', error);
        midpointLatLng = new google.maps.LatLng(
          (p1.lat + p2.lat) / 2,
          (p1.lng + p2.lng) / 2
        );
      }
      
      // Convert to LatLngLiteral
      const midpoint = {
        lat: midpointLatLng.lat(),
        lng: midpointLatLng.lng()
      };
      
      // Create edge marker at midpoint with same style as field system
      const marker = new google.maps.Marker({
        position: midpoint,
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4, // Match field system size
          fillColor: 'white',
          fillOpacity: 0.6,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
        },
        draggable: false,
        zIndex: 1 // Lower than vertex markers
      });
      
      // Store the edge index in the marker
      marker.set('edgeIndex', i);
      
      // Add click handler to create draggable red marker, matching field system behavior
      marker.addListener('click', () => {
        // First clear all existing red markers
        clearRedMarkers();
        
        // Store this as the active edge marker
        activeEdgeMarkerRef.current = marker;
        
        // Get edge index
        const edgeIndex = marker.get('edgeIndex');
        if (typeof edgeIndex !== 'number') return;
        
        // Create a red location marker for dragging (matching field system)
        const position = marker.getPosition();
        if (!position || !mapRef.current) return;
        
        // Hide the original circle marker
        marker.setOpacity(0);
        
        // Create the red location marker for dragging
        const dragMarker = new google.maps.Marker({
          position: position,
          map: mapRef.current,
          icon: {
            path: LOCATION_MARKER_PATH,
            fillColor: '#FF0000',
            fillOpacity: 0.2,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            scale: DEFAULT_MARKER_SCALE,
            anchor: new google.maps.Point(12, 22),
            rotation: MARKER_ROTATION
          },
          draggable: true,
          crossOnDrag: false,
          zIndex: 10
        });
        
        // Store original data for reference
        marker.set('dragMarker', dragMarker);
        marker.set('originalPosition', position);
        marker.set('originalPoints', [...localPointsRef.current]);
        
        // Track if vertex has been inserted yet
        let vertexInserted = false;
        let insertedIndex = -1;
        
        // Add drag event listener
        dragMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          
          // Set dragging state
          draggingRef.current = true;
          
          // Insert new vertex at the drag position if not already done
          if (!vertexInserted) {
            // Create a copy of current points
            const updatedPoints = [...localPointsRef.current];
            
            // Insert the new vertex after the edge index
            updatedPoints.splice(edgeIndex + 1, 0, {
              lat: e.latLng.lat(),
              lng: e.latLng.lng()
            });
            
            // Update local reference
            localPointsRef.current = updatedPoints;
            
            // Mark as inserted and store the index
            vertexInserted = true;
            insertedIndex = edgeIndex + 1;
            
            // Update parent state
            setMeasurePoints(updatedPoints);
            
            // Update the polyline right away
            ensurePolyline(updatedPoints);
          } else {
            // Update the position of the inserted vertex
            if (insertedIndex >= 0) {
              const updatedPoints = [...localPointsRef.current];
              updatedPoints[insertedIndex] = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
              };
              
              // Update local reference
              localPointsRef.current = updatedPoints;
              
              // Update the polyline
              ensurePolyline(updatedPoints);
              
              // Update distance labels during drag
              updateDistanceLabels(updatedPoints);
            }
          }
        });
        
        // Add dragend event listener
        dragMarker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          
          // Keep track of the final position before cleaning up
          const finalPosition = dragMarker.getPosition();
          
          // Wait a short moment before resetting dragging state to allow click events to process
          setTimeout(() => {
            draggingRef.current = false;
          }, 50);
          
          if (finalPosition && insertedIndex >= 0) {
            // Create a permanent vertex at this position
            const updatedPoints = [...localPointsRef.current];
            
            // Ensure the position is up to date
            updatedPoints[insertedIndex] = {
              lat: finalPosition.lat(),
              lng: finalPosition.lng()
            };
            
            // Update local reference
            localPointsRef.current = updatedPoints;
            
            // Update parent state
            setMeasurePoints(updatedPoints);
            
            // Force recreation of all markers to prevent ghost markers
            clearMarkers();
            
            // Create all vertex markers again
            updatedPoints.forEach((point, idx) => {
              const newMarker = createMeasureMarker(point, idx);
              if (newMarker) {
                markersRef.current.push(newMarker);
              }
            });
            
            // Update edge markers
            updateEdgeMarkers();
            
            // Update distance labels
            updateDistanceLabels(updatedPoints);
            
            // Calculate and update total distance
            const newDistance = calculateTotalDistance(updatedPoints);
            setDistance(newDistance);
            onUpdate(newDistance, updatedPoints);
          }
          
          // Remove the drag marker
          dragMarker.setMap(null);
          
          // Clean up the drag operation
          activeEdgeMarkerRef.current = null;
        });
        
        // Add to our collection of drag markers for cleanup
        dragMarkersRef.current.push(dragMarker);
      });
      
      edgeMarkersRef.current.push(marker);
    }
  };

  // Ensure we have a valid polyline to work with
  const ensurePolyline = (points?: google.maps.LatLngLiteral[]) => {
    if (!mapRef.current) return;
    
    // Use provided points or existing measure points
    const pathPoints = points || localPointsRef.current;
    
    // If polyline already exists, just update its path
    if (polylineRef.current) {
      polylineRef.current.setPath(pathPoints);
      return;
    }
    
    // Create a new polyline if one doesn't exist
    polylineRef.current = new google.maps.Polyline({
      path: pathPoints,
      geodesic: true,
      strokeColor: "#00AA00",
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: mapRef.current,
    });
  };

  // Calculate distance between two points
  const calculateDistance = (
    p1: google.maps.LatLngLiteral,
    p2: google.maps.LatLngLiteral
  ) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d; // Distance in meters
  };

  // Calculate total distance along the polyline
  const calculateTotalDistance = (points: google.maps.LatLngLiteral[]) => {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += calculateDistance(points[i], points[i + 1]);
    }
    return totalDistance;
  };

  // Calculate area of a polygon
  const calculatePolygonArea = useCallback((points: google.maps.LatLngLiteral[]) => {
    if (!points || points.length < 3) return 0;
    
    try {
      // Create a polygon path from the points
      const path = points.map(point => new google.maps.LatLng(point.lat, point.lng));
      
      // Use Google Maps geometry library to calculate area
      return google.maps.geometry.spherical.computeArea(path);
    } catch (error) {
      console.error("Error calculating area:", error);
      return 0;
    }
  }, []);

  // Display a red marker for dragging instead of the white circle
  const showRedMarker = (marker: google.maps.Marker, index: number) => {
    // Save current state to undo stack before modifying
    if (localPointsRef.current.length > 0) {
      saveToUndoStack([...localPointsRef.current]);
    }
    
    // First clear any existing red markers
    clearRedMarkers();
    
    // Reset all white marker opacities explicitly
    markersRef.current.forEach(m => {
      m.setOpacity(1);
    });
    
    const position = marker.getPosition();
    if (!position || !mapRef.current) return;
    
    // Create the red location marker
    const dragMarker = new google.maps.Marker({
      position: position,
      map: mapRef.current,
      icon: {
        path: LOCATION_MARKER_PATH,
        fillColor: '#FF0000',
        fillOpacity: 0.2,
        strokeColor: '#FFFFFF',
        strokeWeight: 1,
        scale: DEFAULT_MARKER_SCALE,
        anchor: new google.maps.Point(12, 22),
        rotation: MARKER_ROTATION
      },
      draggable: true,
      crossOnDrag: false,
      zIndex: 10
    });
    
    // Store the drag marker reference in the vertex marker
    marker.set('dragMarker', dragMarker);
    
    // Store the vertex index for reference
    dragMarker.set('vertexIndex', index);
    
    // Hide the original circle marker
    marker.setOpacity(0);
    
    // Add to our collection of drag markers
    dragMarkersRef.current.push(dragMarker);
    
    // Add event listeners to the drag marker
    dragMarker.addListener("drag", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      
      // Get the current points from our local reference
      const updatedPoints = [...localPointsRef.current];
      
      // Ensure the index is still valid
      if (index < updatedPoints.length) {
        // Update the point at the dragged index
        updatedPoints[index] = { 
          lat: e.latLng.lat(), 
          lng: e.latLng.lng() 
        };
        
        // Update the original marker position (even while invisible)
        marker.setPosition(e.latLng);
        
        // Update local reference
        localPointsRef.current = updatedPoints;
        
        // Update the polyline path during dragging for smoother experience
        if (polylineRef.current) {
          polylineRef.current.setPath(updatedPoints);
        }
        
        // Update distance labels and edge markers during dragging
        updateDistanceLabels(updatedPoints);
        updateEdgeMarkers();
      }
    });
    
    dragMarker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
      draggingRef.current = false;
      setActiveDragIndex(null);
      
      const newPosition = dragMarker.getPosition();
      if (newPosition) {
        // Get positions directly from all visible markers
        const updatedPoints = getPointsFromMarkers();
        
        // Make sure the index is still valid
        if (index < updatedPoints.length) {
          // Ensure the dragged point has the latest position
          updatedPoints[index] = { 
            lat: parseFloat(newPosition.lat().toFixed(8)), 
            lng: parseFloat(newPosition.lng().toFixed(8)) 
          };
          
          // Update the position of the original white marker
          marker.setPosition(newPosition);
          marker.setOpacity(1);
          
          // Remove the red marker
          dragMarker.setMap(null);
          dragMarkersRef.current = dragMarkersRef.current.filter(m => m !== dragMarker);
          
          // Update local reference first
          localPointsRef.current = [...updatedPoints];
          
          // Update the parent state
          setMeasurePoints(updatedPoints);
          
          // Update polyline path
          ensurePolyline(updatedPoints);
          
          // Force recreation of all markers to ensure no ghost markers
          clearMarkers();
          updatedPoints.forEach((point, idx) => {
            const newMarker = createMeasureMarker(point, idx);
            if (newMarker) {
              markersRef.current.push(newMarker);
            }
          });
          
          // Update edge markers
          updateEdgeMarkers();
          
          // Calculate and update distance
          const newDistance = calculateTotalDistance(updatedPoints);
          setDistance(newDistance);
          onUpdate(newDistance, updatedPoints);
        }
      }
    });
    
    return dragMarker;
  };

  // Sync markers with points
  const syncMarkersWithPoints = () => {
    const points = localPointsRef.current;
    if (!points || points.length === 0) return;
    
    // First make sure we have the right number of markers
    if (markersRef.current.length !== points.length) {
      // If not, clear and recreate all markers
      clearMarkers();
      points.forEach((point, index) => {
        const marker = createMeasureMarker(point, index);
        if (marker) {
          markersRef.current.push(marker);
        }
      });
    } else {
      // Otherwise, just update positions one by one
      for (let i = 0; i < markersRef.current.length; i++) {
        const marker = markersRef.current[i];
        const vertexIndex = marker.get('vertexIndex');
        
        if (typeof vertexIndex === 'number' && vertexIndex < points.length) {
          const point = points[vertexIndex];
          const position = new google.maps.LatLng(point.lat, point.lng);
          marker.setPosition(position);
        }
      }
    }
  };

  // Create distance labels for each segment
  const updateDistanceLabels = (points: google.maps.LatLngLiteral[]) => {
    if (!mapRef.current || points.length < 2) return;
    
    // Clear existing labels
    clearDistanceLabels();
    
    // Create a label for each segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // Use Google Maps LatLng objects for more accurate calculations
      const p1LatLng = new google.maps.LatLng(p1.lat, p1.lng);
      const p2LatLng = new google.maps.LatLng(p2.lat, p2.lng);
      
      // Calculate midpoint using geometry library for more accuracy
      let midpoint;
      try {
        // Try to use the spherical geometry library for accurate midpoint calculation
        const distance = google.maps.geometry.spherical.computeDistanceBetween(p1LatLng, p2LatLng);
        const heading = google.maps.geometry.spherical.computeHeading(p1LatLng, p2LatLng);
        const midpointLatLng = google.maps.geometry.spherical.computeOffset(p1LatLng, distance/2, heading);
        
        midpoint = {
          lat: midpointLatLng.lat(),
          lng: midpointLatLng.lng()
        };
      } catch (error) {
        // Fallback to simple averaging if geometry library isn't available
        midpoint = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2
      };
      }
      
      // Calculate segment length to adjust offset
      const segmentDistance = calculateDistance(p1, p2);
      let distanceText = '';
      
      // Calculate offset for label using geometry library when possible
      let offsetPoint;
      try {
        // Use the perpendicular offset with geometry library
        const heading = google.maps.geometry.spherical.computeHeading(p1LatLng, p2LatLng);
        const perpHeading = heading + 90; // Perpendicular heading
        
        // Base offset distance in meters (instead of degrees)
        let offsetDistanceMeters = 25; // Default offset in meters
        
        // Adjust offset distance based on segment length
        if (segmentDistance > 1000) {
          offsetDistanceMeters = 40;
        } else if (segmentDistance < 100) {
          offsetDistanceMeters = 15;
        }
        
        // Adjust offset based on map zoom level
        if (mapRef.current) {
          const zoom = mapRef.current.getZoom();
          if (zoom !== undefined) {
            const zoomScaleFactor = Math.pow(1.3, 15 - zoom);
            offsetDistanceMeters *= zoomScaleFactor;
          }
        }
        
        // Calculate the offset position accurately using the geometry library
        const offsetLatLng = google.maps.geometry.spherical.computeOffset(
          new google.maps.LatLng(midpoint.lat, midpoint.lng), 
          offsetDistanceMeters, 
          perpHeading
        );
        
        offsetPoint = {
          lat: offsetLatLng.lat(),
          lng: offsetLatLng.lng()
        };
      } catch (error) {
        // Fallback to simple trig-based offset if geometry fails
        // Calculate angle of the line
      const dx = p2.lng - p1.lng;
      const dy = p2.lat - p1.lat;
      const angle = Math.atan2(dy, dx);
      
        // Calculate perpendicular angle
      const perpAngle = angle + Math.PI / 2;
      
        // Base offset distance in degrees
        let offsetDistance = 0.0005;
      
        // Adjust based on segment length
      if (segmentDistance > 1000) {
          offsetDistance = 0.0008;
      } else if (segmentDistance < 100) {
          offsetDistance = 0.0003;
      }
      
        // Adjust based on zoom
      if (mapRef.current) {
        const zoom = mapRef.current.getZoom();
        if (zoom !== undefined) {
          const zoomScaleFactor = Math.pow(1.3, 15 - zoom);
          offsetDistance *= zoomScaleFactor;
        }
      }
      
        // Calculate offset point using simple trigonometry
        offsetPoint = {
        lat: midpoint.lat + Math.sin(perpAngle) * offsetDistance,
        lng: midpoint.lng + Math.cos(perpAngle) * offsetDistance
      };
      }
      
      // Format distance for display
      if (segmentDistance < 1000) {
        distanceText = `${segmentDistance.toFixed(3)}m`;
      } else {
        distanceText = `${(segmentDistance / 1000).toFixed(2)}km`;
      }
      
      // Use custom overlay instead of marker for better styling
      class DistanceLabelOverlay extends google.maps.OverlayView {
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
      
      // Create and add the custom overlay
      const labelOverlay = new DistanceLabelOverlay(offsetPoint, distanceText);
      labelOverlay.setMap(mapRef.current);
      
      // Store reference for later cleanup
      distanceLabelsRef.current.push(labelOverlay as unknown as google.maps.Marker);
    }
  };

  // Update all UI elements based on new points
  const updateUI = (points: google.maps.LatLngLiteral[]) => {
    if (!points || points.length === 0) return;
    
    // Update local reference
    localPointsRef.current = [...points];
    
    // Update polyline
    ensurePolyline(points);
    
    // Update distance labels
    updateDistanceLabels(points);
    
    // Update edge markers
    updateEdgeMarkers();
    
    // Don't update markers during drag operations
    if (!draggingRef.current) {
      syncMarkersWithPoints();
    }
  };

  // Get all points from markers (ensures accurate positions)
  const getPointsFromMarkers = (): google.maps.LatLngLiteral[] => {
    const points: google.maps.LatLngLiteral[] = [];
    
    // Create an array of the right size first
    for (let i = 0; i < markersRef.current.length; i++) {
      points.push({ lat: 0, lng: 0 });
    }
    
    // Then fill it with marker positions at the right indices
    markersRef.current.forEach(marker => {
      const vertexIndex = marker.get('vertexIndex');
      if (typeof vertexIndex === 'number' && vertexIndex < points.length) {
        // If the marker has a drag marker, use its position
        const dragMarker = marker.get('dragMarker');
        if (dragMarker && dragMarker.getMap()) {
          const position = dragMarker.getPosition();
          if (position) {
            points[vertexIndex] = {
              lat: position.lat(),
              lng: position.lng()
            };
            return;
          }
        }
        
        // Otherwise use the marker's own position
        const position = marker.getPosition();
        if (position) {
          points[vertexIndex] = {
            lat: position.lat(),
            lng: position.lng()
          };
        }
      }
    });
    
    return points;
  };

  // Create a marker for a measurement point
  const createMeasureMarker = (
    position: google.maps.LatLngLiteral,
    index: number
  ) => {
    if (!mapRef.current) return null;

    const marker = new google.maps.Marker({
      position,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: '#FFFFFF',
        fillOpacity: 0.5,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
      },
      draggable: false, // No longer directly draggable - will use red marker instead
      zIndex: 2
    });

    // Store the vertex index directly in the marker for easier reference
    marker.set('vertexIndex', index);

    // Add click handler to show draggable red marker
    marker.addListener("click", () => {
      // First clear any existing red markers
      clearRedMarkers();
      
      draggingRef.current = true;
      setActiveDragIndex(index);
      
      // Create a snapshot of the current points for the local reference
      localPointsRef.current = getPointsFromMarkers();
      
      // Show the red marker for dragging
      showRedMarker(marker, index);
    });

    return marker;
  };

  // Add a measurement point
  const addMeasurePoint = (latLng: google.maps.LatLngLiteral) => {
    // Save current state to undo stack before adding new point
    if (localPointsRef.current.length > 0) {
      saveToUndoStack([...localPointsRef.current]);
    }
    
    // Save position for next app start
    if (onPositionUpdate) {
      onPositionUpdate(latLng);
    }
    
    // Calculate the new index for this point
    const newIndex = localPointsRef.current.length;
    
    // Update local reference first
    const newPoints = [...localPointsRef.current, latLng];
    localPointsRef.current = newPoints;
    
    // Then update parent state
    setMeasurePoints(newPoints);
    
    // Calculate and update distance
    const newDistance = calculateTotalDistance(newPoints);
    setDistance(newDistance);
    onUpdate(newDistance, newPoints);
    
    // Add marker and update polyline
    const marker = createMeasureMarker(latLng, newIndex);
    if (marker) {
      markersRef.current.push(marker);
    }
    
    ensurePolyline(newPoints);
    
    // Update distance labels when adding points
    if (newPoints.length >= 2) {
      updateDistanceLabels(newPoints);
      updateEdgeMarkers();
    }
  };

  // Reset measurement
  const resetMeasurement = () => {
    // Clear local reference
    localPointsRef.current = [];
    
    // Update parent state
    setMeasurePoints([]);
    setDistance(0);
    onUpdate(0, []);
    
    // Reset undo/redo stacks
    setUndoStack([]);
    setRedoStack([]);
    setCanUndo(false);
    setCanRedo(false);
    
    // Reset area calculation
    setPathClosed(false);
    setAreaInSqMeters(0);
    
    // Clear polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    
    // Clear markers
    clearMarkers();
    
    // Reset drag state
    draggingRef.current = false;
    setActiveDragIndex(null);
    
    // Stop measuring mode
    setIsMeasuring(false);
    onExit();
  };

  // Toggle measurement mode
  const toggleMeasuring = () => {
    if (isMeasuring) {
      // Stop measuring
      if (clickListenerRef.current && map) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      onExit();
    } else {
      // Start measuring, but only if we have a map
      if (map) {
        ensurePolyline();
        clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            addMeasurePoint({
              lat: e.latLng.lat(),
              lng: e.latLng.lng(),
            });
          }
        });
      }
    }
    setIsMeasuring(!isMeasuring);
  };

  // Setup and cleanup effects
  useEffect(() => {
    // Keep track of the current map
    mapRef.current = map;
    
    // If we have measure points, restore them when the map is available
    if (map && localPointsRef.current.length > 0) {
      // Clear any existing markers first
      clearMarkers();
      
      // Create markers for existing points
      localPointsRef.current.forEach((point, index) => {
        const marker = createMeasureMarker(point, index);
        if (marker) {
          markersRef.current.push(marker);
        }
      });
      
      // Ensure the polyline is set up with the existing points
      ensurePolyline();
      
      // Create distance labels
      updateDistanceLabels(localPointsRef.current);
      
      // Create edge markers
      updateEdgeMarkers();
    }
    
    // If in measuring mode, set up the click listener
    if (map && isMeasuring && !clickListenerRef.current) {
      ensurePolyline();
      clickListenerRef.current = map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          addMeasurePoint({
            lat: e.latLng.lat(),
            lng: e.latLng.lng(),
          });
        }
      });
    }
    
    // Add zoom changed listener to update markers and labels during zoom
    let zoomListener: google.maps.MapsEventListener | null = null;
    if (map) {
      zoomListener = map.addListener("zoom_changed", () => {
        // Only update if we have measurement points
        if (localPointsRef.current.length >= 2) {
          // Update edge markers after a small delay to allow the map to finish rendering
          setTimeout(() => {
            updateEdgeMarkers();
            updateDistanceLabels(localPointsRef.current);
          }, 50);
        }
      });
    }
    
    // Cleanup function
    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      
      // Clean up zoom listener
      if (zoomListener) {
        google.maps.event.removeListener(zoomListener);
      }
      
      // Clean up polyline and markers if the component unmounts
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      
      clearMarkers();
      clearDistanceLabels();
      clearEdgeMarkers();
      
      // Clear active references
      activeEdgeMarkerRef.current = null;
    };
  }, [map, isMeasuring]);

  // Synchronize with isActive from parent component
  useEffect(() => {
    if (isActive !== isMeasuring) {
      setIsMeasuring(isActive);
    }
  }, [isActive, isMeasuring, setIsMeasuring]);

  // When measure points are updated externally, update the UI
  useEffect(() => {
    if (measurePoints && !draggingRef.current) {
      // Only update UI if we're not in the middle of dragging
      updateUI(measurePoints);
    }
  }, [measurePoints]);

  // Function to save the current state to the undo stack
  const saveToUndoStack = useCallback((points: google.maps.LatLngLiteral[]) => {
    setUndoStack(prev => [...prev, [...points]]);
    setRedoStack([]); // Clear redo stack after a new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  // Handle undo action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    // Get the previous state
    const prevState = undoStack[undoStack.length - 1];
    
    // Save current state to redo stack
    const currentState = [...localPointsRef.current];
    setRedoStack(prev => [...prev, currentState]);
    setCanRedo(true);
    
    // Update points with previous state
    localPointsRef.current = [...prevState];
    setMeasurePoints(prevState);
    
    // Calculate and update distance
    const newDistance = calculateTotalDistance(prevState);
    setDistance(newDistance);
    onUpdate(newDistance, prevState);
    
    // Check if the path is closed after undo
    if (prevState.length >= 2) {
      const firstPoint = prevState[0];
      const lastPoint = prevState[prevState.length - 1];
      const isPathClosed = (firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng);
      
      setPathClosed(isPathClosed);
      
      // Recalculate area if path is closed
      if (isPathClosed) {
        const area = calculatePolygonArea(prevState);
        setAreaInSqMeters(area);
      } else {
        setAreaInSqMeters(0);
      }
    } else {
      setPathClosed(false);
      setAreaInSqMeters(0);
    }
    
    // Update the UI
    updateUI(prevState);
    
    // Update the undo stack
    setUndoStack(prev => prev.slice(0, -1));
    setCanUndo(undoStack.length > 1);
  }, [undoStack, setMeasurePoints, calculateTotalDistance, setDistance, onUpdate, updateUI, calculatePolygonArea]);

  // Handle redo action
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    // Get the next state
    const nextState = redoStack[redoStack.length - 1];
    
    // Save current state to undo stack
    const currentState = [...localPointsRef.current];
    setUndoStack(prev => [...prev, currentState]);
    setCanUndo(true);
    
    // Update points with next state
    localPointsRef.current = [...nextState];
    setMeasurePoints(nextState);
    
    // Calculate and update total distance
    const newDistance = calculateTotalDistance(nextState);
    setDistance(newDistance);
    onUpdate(newDistance, nextState);
    
    // Check if the path is closed after redo
    if (nextState.length >= 2) {
      const firstPoint = nextState[0];
      const lastPoint = nextState[nextState.length - 1];
      const isPathClosed = (firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng);
      
      setPathClosed(isPathClosed);
      
      // Recalculate area if path is closed
      if (isPathClosed) {
        const area = calculatePolygonArea(nextState);
        setAreaInSqMeters(area);
      } else {
        setAreaInSqMeters(0);
      }
    } else {
      setPathClosed(false);
      setAreaInSqMeters(0);
    }
    
    // Update the UI
    updateUI(nextState);
    
    // Update the redo stack
    setRedoStack(prev => prev.slice(0, -1));
    setCanRedo(redoStack.length > 1);
  }, [redoStack, setMeasurePoints, calculateTotalDistance, setDistance, onUpdate, updateUI, calculatePolygonArea]);
  
  // Function to close the measurement path (connect first and last points)
  const handleClosePath = useCallback(() => {
    if (localPointsRef.current.length < 3) return;
    
    // Get the first and last vertices
    const firstPoint = localPointsRef.current[0];
    const lastPoint = localPointsRef.current[localPointsRef.current.length - 1];
    
    // Check if the path is already closed (first point = last point)
    if (firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng) {
      return; // Path is already closed, do nothing
    }
    
    // Save current state to undo stack before modifying
    saveToUndoStack([...localPointsRef.current]);
    
    // Add the first vertex to the end to close the path
    const newPoints = [...localPointsRef.current, { ...firstPoint }];
    
    // Update local reference
    localPointsRef.current = newPoints;
    
    // Update parent state
    setMeasurePoints(newPoints);
    
    // Calculate and update distance
    const newDistance = calculateTotalDistance(newPoints);
    setDistance(newDistance);
    onUpdate(newDistance, newPoints);
    
    // Calculate area when path is closed
    const area = calculatePolygonArea(newPoints);
    setAreaInSqMeters(area);
    setPathClosed(true);
    
    // Add marker and update polyline
    const marker = createMeasureMarker(firstPoint, newPoints.length - 1);
    if (marker) {
      markersRef.current.push(marker);
    }
    
    // Update the UI
    ensurePolyline(newPoints);
    updateDistanceLabels(newPoints);
    updateEdgeMarkers();
  }, [onUpdate, setMeasurePoints, saveToUndoStack, createMeasureMarker, calculateTotalDistance, 
      updateDistanceLabels, updateEdgeMarkers, ensurePolyline, setDistance, calculatePolygonArea]);

  // Helper function to format area for display
  const formatArea = (areaSqMeters: number) => {
    if (areaSqMeters >= 10000) {
      // Convert to hectares if area is large enough
      return `${(areaSqMeters / 10000).toFixed(2)} ha`;
    } else {
      // Keep as square meters for smaller areas
      return `${areaSqMeters.toFixed(2)} m²`;
    }
  };

  // Check if path is closed and update area state
  const checkPathClosedAndUpdateArea = useCallback((points: google.maps.LatLngLiteral[]) => {
    if (points.length >= 3) {
      const firstPoint = points[0];
      const lastPoint = points[points.length - 1];
      const isPathClosed = (firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng);
      
      setPathClosed(isPathClosed);
      
      if (isPathClosed) {
        const area = calculatePolygonArea(points);
        setAreaInSqMeters(area);
      } else {
        setAreaInSqMeters(0);
      }
    } else {
      setPathClosed(false);
      setAreaInSqMeters(0);
    }
  }, [calculatePolygonArea]);

  // Handle saving a distance measurement
  const handleSaveMeasurement = async () => {
    if (!user) {
      alert('Please log in to save measurements');
      return;
    }

    if (localPointsRef.current.length < 2) {
      alert('Please add at least 2 points to save a measurement');
      return;
    }

    // Show dialog to enter measurement name
    setShowNameDialog(true);
  };

  // Function to actually save the measurement after name is provided
  const saveCurrentMeasurement = async () => {
    if (!user) {
      console.error("Attempted to save without a user logged in");
      return;
    }
    
    try {
      setIsSaving(true);
      console.log("Starting save of measurement...");
      
      // Generate a unique ID if one doesn't exist
      const measurementId = uuidv4();
      console.log("Generated measurement ID:", measurementId);
      
      // Create measurement data object with null instead of undefined for area
      const measurementData = {
        id: measurementId,
        points: localPointsRef.current,
        distance: distance,
        name: measurementName || `Measurement ${new Date().toLocaleDateString()}`,
        isClosed: pathClosed,
        area: pathClosed ? areaInSqMeters : null // Use null instead of undefined
      };
      
      console.log("Prepared measurement data:", measurementData);
      console.log("Points count:", localPointsRef.current.length);
      console.log("Is path closed:", pathClosed);
      console.log("Area value:", pathClosed ? areaInSqMeters : "null");
      
      // Save to Firestore
      console.log("Calling saveDistanceMeasurement function...");
      const savedId = await saveDistanceMeasurement(measurementData);
      console.log("Save complete, received ID:", savedId);
      
      // Hide the name dialog
      setShowNameDialog(false);
      
      // Show success notification
      setShowSaveNotification(true);
      setTimeout(() => {
        setShowSaveNotification(false);
      }, 3000);
      
      // Store the current points for the final polyline
      const savedPoints = [...localPointsRef.current];
      
      // Use the existing clearMarkers function to remove all markers
      clearMarkers();
      
      // Remove existing polyline
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      
      // Create a final non-interactive polyline that will persist
      if (map && savedPoints.length > 1) {
        const savedPolyline = new google.maps.Polyline({
          path: savedPoints,
          geodesic: true,
          strokeColor: "#00AA00", 
          strokeOpacity: 1.0,
          strokeWeight: 3,
          clickable: false,
          map: map
        });
        
        // Find an appropriate location for the label (middle of the path)
        let centerPointIdx = Math.floor(savedPoints.length / 2);
        let centerPoint;
        
        if (savedPoints.length % 2 !== 0) {
          centerPoint = savedPoints[centerPointIdx];
        } else {
          const p1 = savedPoints[centerPointIdx - 1];
          const p2 = savedPoints[centerPointIdx];
          
          try {
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
            // Fall back to simple averaging
            centerPoint = {
              lat: (p1.lat + p2.lat) / 2,
              lng: (p1.lng + p2.lng) / 2
            };
          }
        }
        
        // Create and add a label overlay for the measurement name
        class NameLabelOverlay extends google.maps.OverlayView {
          private position: google.maps.LatLngLiteral;
          private content: string;
          private div: HTMLDivElement | null = null;
          
          constructor(position: google.maps.LatLngLiteral, content: string) {
            super();
            this.position = position;
            this.content = content;
          }
          
          onAdd() {
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
        
        // Add the name label to the map
        if (centerPoint) {
          const nameLabel = new NameLabelOverlay(centerPoint, measurementData.name);
          nameLabel.setMap(map);
        }
      }
      
      // Clear local points reference to prevent recreation of markers
      localPointsRef.current = [];
      
      // Clear measurement points in state
      setMeasurePoints([]);
      
      // Disable dragging functionality
      draggingRef.current = false;
      setActiveDragIndex(null);
      
      // Remove click listeners
      if (clickListenerRef.current && map) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      
      // Set measuring mode to false
      setIsMeasuring(false);
      
      // Exit measurement mode
      onExit();
      
    } catch (error) {
      console.error('Error saving measurement:', error);
      alert('Error saving measurement. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Top panel with controls when measuring is active */}
      {isMeasuring && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-500 shadow-lg z-50">
          <div className="w-full flex justify-between items-center p-2">
            <button
              onClick={() => {
                resetMeasurement();
                onExit();
              }}
              className="p-1 text-white hover:bg-white/20 rounded transition-colors"
              title="Cancel measurement"
            >
              <FontAwesomeIcon icon={faTimes} className="text-xl" />
            </button>
            
            {/* Empty center div to maintain layout */}
            <div className="flex-1"></div>
            
            <div className="flex-1 text-right">
              <button
                onClick={handleSaveMeasurement}
                disabled={localPointsRef.current.length < 2 || !user}
                className={`py-1 px-4 text-white ${
                  localPointsRef.current.length < 2 || !user
                    ? "bg-gray-400 cursor-not-allowed"
                    : "hover:bg-white/20 rounded transition-colors"
                }`}
              >
                <span className="font-medium">SAVE</span>
              </button>
    </div>
          </div>
        </div>
      )}
      
      {/* Add info panel for selected measurement */}
      {!isMeasuring && selectedMeasurement && (
        <>
          <div className="absolute top-0 left-0 right-0 bg-yellow-500 shadow-lg z-50">
            <div className="w-full flex justify-between items-center p-2">
              <button
                onClick={() => {
                  // Call the parent function to clear selected measurement
                  if (onClearSelectedMeasurement) {
                    onClearSelectedMeasurement();
                  }
                }}
                className="p-1 text-white hover:bg-white/20 rounded transition-colors"
                title="Close measurement details"
              >
                <FontAwesomeIcon icon={faTimes} className="text-xl" />
              </button>
              
              {/* Display measurement name in center */}
              <div className="flex-1 text-center">
                <span className="font-medium text-white">{selectedMeasurement.name || 'Unnamed Measurement'}</span>
              </div>
              
              <div className="flex-1"></div>
            </div>
          </div>
          
          {/* Black transparent panel showing selected measurement stats */}
          <div className="absolute top-12 left-0 right-0 bg-black/50 shadow-lg z-20 p-2">
            <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
              {(selectedMeasurement.area !== undefined && selectedMeasurement.area !== null && selectedMeasurement.area > 0) && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-100">Area:</span>
                  <span className="text-green-400 font-medium">
                    {selectedMeasurement.area < 10000 
                      ? `${selectedMeasurement.area.toFixed(2)}m²` 
                      : `${(selectedMeasurement.area / 10000).toFixed(2)}ha`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-100">Distance:</span>
                <div className="flex-1 text-center">
                  <span className="font-semibold text-white">
                    {(selectedMeasurement.distance !== undefined && selectedMeasurement.distance !== null)
                      ? (selectedMeasurement.distance < 1000 
                        ? `${selectedMeasurement.distance.toFixed(3)}m` 
                        : `${(selectedMeasurement.distance / 1000).toFixed(2)}km`)
                      : "N/A"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-100">Vertices:</span>
                <span className="text-purple-400 font-medium">
                  {selectedMeasurement.points ? selectedMeasurement.points.length : 0}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Name input dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Measurement</h3>
            <input
              type="text"
              value={measurementName}
              onChange={(e) => setMeasurementName(e.target.value)}
              placeholder="Enter a name for this measurement"
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNameDialog(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentMeasurement}
                disabled={isSaving}
                className={`px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 ${
                  isSaving ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Save success notification */}
      {showSaveNotification && (
        <div className="fixed top-14 left-0 right-0 bg-green-500 text-white p-2 z-50 text-center">
          <p className="text-sm">Measurement saved successfully</p>
        </div>
      )}
      
      {/* Black transparent panel showing measurement stats */}
      {isMeasuring && (
        <div className="absolute top-12 left-0 right-0 bg-black/50 shadow-lg z-20 p-2">
          <div className="container mx-auto flex justify-center items-center gap-6 text-sm">
            {pathClosed && areaInSqMeters > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-100">Area:</span>
                <span className="text-green-400 font-medium">
                  {formatArea(areaInSqMeters)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-100">Distance:</span>
              <div className="flex-1 text-center">
                <span className="font-semibold text-white">
                  {distance < 1000 
                    ? `${distance.toFixed(3)}m` 
                    : `${(distance / 1000).toFixed(2)}km`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-100">Vertices:</span>
              <span className="text-purple-400 font-medium">
                {measurePoints.length}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Undo/Redo panel at the bottom */}
      {isMeasuring && localPointsRef.current.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 bg-black/80 shadow-lg z-50 p-2 w-full block">
          <div className="flex justify-between items-center max-w-full px-1 sm:px-2 mx-2">
            {/* Left side: placeholder for layout balance */}
            <div className="w-10"></div>
            
            {/* Center: Undo/Redo buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                  canUndo
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                title="Undo"
              >
                <FontAwesomeIcon icon={faUndo} />
              </button>
              
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                  canRedo
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                title="Redo"
              >
                <FontAwesomeIcon icon={faRedo} />
              </button>
            </div>
            
            {/* Right side: Close Path button */}
            <div>
              <button
                onClick={handleClosePath}
                disabled={localPointsRef.current.length < 3}
                className={`flex items-center px-2 py-2 rounded-md shadow transition-colors ${
                  localPointsRef.current.length >= 3
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
                title="Close Path"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DistanceMeasurement; 