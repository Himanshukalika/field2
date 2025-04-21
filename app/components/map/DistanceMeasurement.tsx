'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

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
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
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
    dragMarkersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    dragMarkersRef.current = [];
    
    // Reset all white marker opacities
    markersRef.current.forEach(marker => {
      marker.setOpacity(1);
    });
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
      
      // Calculate midpoint for edge marker placement
      const midpoint = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2
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
    
    // Check if measurement is closed (first and last points match)
    const isClosed = pathPoints.length >= 4 && 
      pathPoints[0].lat === pathPoints[pathPoints.length-1].lat && 
      pathPoints[0].lng === pathPoints[pathPoints.length-1].lng;
    
    // If we need to change from polyline to polygon (or vice versa) or if it doesn't exist yet
    if (!polylineRef.current || (isClosed && polylineRef.current instanceof google.maps.Polyline) || 
        (!isClosed && polylineRef.current instanceof google.maps.Polygon)) {
      
      // Clean up existing polyline if it exists
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      
      // Create the appropriate type based on whether it's closed
      if (isClosed) {
        // Create a polygon for closed shapes
        polylineRef.current = new google.maps.Polygon({
          paths: pathPoints,
          geodesic: true,
          strokeColor: "#00AA00",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          fillColor: "#00AA00",
          fillOpacity: 0.1,
          map: mapRef.current,
        });
      } else {
        // Create a polyline for open paths
        polylineRef.current = new google.maps.Polyline({
          path: pathPoints,
          geodesic: true,
          strokeColor: "#00AA00",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: mapRef.current,
        });
      }
    } else {
      // Just update the existing path
      if (polylineRef.current instanceof google.maps.Polygon) {
        (polylineRef.current as google.maps.Polygon).setPaths(pathPoints);
      } else {
        (polylineRef.current as google.maps.Polyline).setPath(pathPoints);
      }
    }
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

  // Display a red marker for dragging instead of the white circle
  const showRedMarker = (marker: google.maps.Marker, index: number) => {
    // First clear any existing red markers
    clearRedMarkers();
    
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
      
      // Calculate midpoint for label placement
      const midpoint = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2
      };
      
      // Calculate a perpendicular offset for the label to avoid overlap with the line
      // First get the angle of the line
      const dx = p2.lng - p1.lng;
      const dy = p2.lat - p1.lat;
      const angle = Math.atan2(dy, dx);
      
      // Calculate the perpendicular angle (90 degrees = PI/2 radians)
      const perpAngle = angle + Math.PI / 2;
      
      // Calculate segment length to adjust offset (longer segments get larger offsets)
      const segmentDistance = calculateDistance(p1, p2);
      let distanceText = '';
      
      // Base offset distance in degrees (approximately 30-50 meters depending on latitude)
      let offsetDistance = 0.0005; // Reduced offset distance (was 0.001)
      
      // Adjust offset distance based on segment length
      if (segmentDistance > 1000) {
        // For longer segments, increase offset but still keep it smaller
        offsetDistance = 0.0008; // Reduced from 0.0015
      } else if (segmentDistance < 100) {
        // For very short segments, use minimal offset
        offsetDistance = 0.0003; // Reduced from 0.0008
      }
      
      // Adjust offset based on map zoom level if map is available
      if (mapRef.current) {
        const zoom = mapRef.current.getZoom();
        if (zoom !== undefined) {
          // Scale factor based on zoom (higher zoom = smaller offset)
          // At zoom level 20 (very close), reduce the offset
          // At zoom level 10 (far out), increase the offset
          const zoomScaleFactor = Math.pow(1.3, 15 - zoom);
          offsetDistance *= zoomScaleFactor;
        }
      }
      
      // Calculate the offset position
      const offsetPoint = {
        lat: midpoint.lat + Math.sin(perpAngle) * offsetDistance,
        lng: midpoint.lng + Math.cos(perpAngle) * offsetDistance
      };
      
      // Format distance for display
      if (segmentDistance < 1000) {
        distanceText = `${Math.round(segmentDistance)}m`;
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
          this.div.style.color = 'white';
          this.div.style.fontSize = '12px'; // Reduced to match field labels
          this.div.style.fontWeight = 'bold';
          this.div.style.textShadow = 
              '1px 0 1px #000, -1px 0 1px #000, 0 1px 1px #000, 0 -1px 1px #000, ' + 
              '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000';
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
      draggingRef.current = true;
      setActiveDragIndex(index);
      
      // Create a snapshot of the current points for the local reference
      localPointsRef.current = getPointsFromMarkers();
      
      // Show the red marker for dragging
      showRedMarker(marker, index);
    });

    // Add double click handler to close the boundary if this is the last vertex
    marker.addListener("dblclick", () => {
      // Check if this is the last vertex
      if (index === localPointsRef.current.length - 1 && localPointsRef.current.length >= 3) {
        // Close the boundary by adding the first point to the end of the array
        const updatedPoints = [...localPointsRef.current];
        
        // Add the first point again to close the loop
        updatedPoints.push(localPointsRef.current[0]);
        
        // Update local reference
        localPointsRef.current = updatedPoints;
        
        // Update parent state
        setMeasurePoints(updatedPoints);
        
        // Update the polyline
        ensurePolyline(updatedPoints);
        
        // Update distance labels
        updateDistanceLabels(updatedPoints);
        
        // Update edge markers
        updateEdgeMarkers();
        
        // Calculate and update distance
        const newDistance = calculateTotalDistance(updatedPoints);
        setDistance(newDistance);
        onUpdate(newDistance, updatedPoints);
      }
    });

    return marker;
  };

  // Add a measurement point
  const addMeasurePoint = (latLng: google.maps.LatLngLiteral) => {
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
    
    // Cleanup function
    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
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

  return (
    <div className="absolute bottom-4 left-4 flex space-x-2">
      {/* Both icon buttons have been removed */}
    </div>
  );
};

export default DistanceMeasurement; 