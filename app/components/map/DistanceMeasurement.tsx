'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faRuler } from '@fortawesome/free-solid-svg-icons';

interface DistanceMeasurementProps {
  map: google.maps.Map | null;
  isActive: boolean;
  onClose: () => void;
}

const DistanceMeasurement: React.FC<DistanceMeasurementProps> = ({ map, isActive, onClose }) => {
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [segmentDistances, setSegmentDistances] = useState<number[]>([]);
  const [pointsCount, setPointsCount] = useState<number>(0);
  
  // Refs to store measurement objects
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const distanceLabelsRef = useRef<any[]>([]);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const dblClickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const startMarkerRef = useRef<google.maps.Marker | null>(null);
  const instructionWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const totalLabelRef = useRef<any | null>(null);

  // Define the DistanceLabelOverlay class inside the component
  // so it has access to the loaded Google Maps API
  const createDistanceLabelOverlay = (position: google.maps.LatLng, content: string, mapInstance: google.maps.Map) => {
    if (!window.google) return null;
    
    class DistanceLabelOverlay extends google.maps.OverlayView {
      position: google.maps.LatLng;
      content: string;
      map: google.maps.Map;
      div: HTMLDivElement | null = null;

      constructor(position: google.maps.LatLng, content: string, map: google.maps.Map) {
        super();
        this.position = position;
        this.content = content;
        this.map = map;
        this.setMap(map);
      }

      onAdd() {
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.zIndex = '100';
        div.className = 'distance-label';
        div.innerHTML = this.content;
        this.div = div;

        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(div);
      }

      draw() {
        if (!this.div) return;

        const overlayProjection = this.getProjection();
        const position = overlayProjection.fromLatLngToDivPixel(this.position);

        if (position) {
          this.div.style.left = (position.x - 25) + 'px';
          this.div.style.top = (position.y - 10) + 'px';
        }
      }

      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }

      setContent(content: string) {
        this.content = content;
        if (this.div) {
          this.div.innerHTML = content;
        }
      }
    }
    
    return new DistanceLabelOverlay(position, content, mapInstance);
  };

  // Initialize measurement mode
  useEffect(() => {
    if (!map || !isActive || !window.google) return;
    
    // Start fresh
    clearMeasurement();
    
    // Add custom style for distance labels
    const style = document.createElement('style');
    style.id = 'distance-measurement-styles';
    style.innerHTML = `
      .distance-label {
        padding: 2px 4px;
        background-color: transparent;
        color: #000000;
        font-weight: 500;
        font-size: 12px;
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
        text-shadow: 1px 1px 2px white, -1px -1px 2px white, 1px -1px 2px white, -1px 1px 2px white;
      }

      .total-distance-label {
        padding: 8px 12px;
        background-color: #e8f5e9;
        border: 1px solid #a5d6a7;
        border-radius: 6px;
        color: #2e7d32;
        font-weight: 600;
        font-size: 14px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
    `;
    document.head.appendChild(style);
    
    // Setup click listener
    clickListenerRef.current = google.maps.event.addListener(map, 'click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      addPoint(e.latLng);
    });
    
    // Setup double-click listener to finish
    dblClickListenerRef.current = google.maps.event.addListener(map, 'dblclick', () => {
      if (pointsCount > 1) {
        finishMeasurement();
      }
    });
    
    return () => {
      clearMeasurement();
      
      // Remove custom styles
      const styleElement = document.getElementById('distance-measurement-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [map, isActive]);
  
  // Add a measurement point
  const addPoint = (position: google.maps.LatLng) => {
    if (!map || !window.google) return;
    
    // Create marker for the point
    const marker = new google.maps.Marker({
      position: position,
      map: map,
      draggable: true,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        strokeColor: '#00C853',
        strokeWeight: 2
      },
      zIndex: 5
    });
    
    // Store the marker
    markersRef.current.push(marker);
    
    // If this is the first point, save it as start marker
    if (markersRef.current.length === 1) {
      startMarkerRef.current = marker;
    } 
    // If we have at least 2 points, draw a line between the last 2 points
    else if (markersRef.current.length >= 2) {
      const lastIndex = markersRef.current.length - 1;
      const prevPosition = markersRef.current[lastIndex - 1].getPosition();
      const currentPosition = markersRef.current[lastIndex].getPosition();
      
      if (prevPosition && currentPosition) {
        // Create a line between the points
        const line = new google.maps.Polyline({
          path: [prevPosition, currentPosition],
          geodesic: true,
          strokeColor: '#00C853',
          strokeOpacity: 1.0,
          strokeWeight: 5,
          map: map,
          zIndex: 3
        });
        
        // Store the line
        linesRef.current.push(line);
        
        // Calculate distance for this segment
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          prevPosition, 
          currentPosition
        );
        
        // Add to segment distances
        const newSegmentDistances = [...segmentDistances, distance];
        setSegmentDistances(newSegmentDistances);
        
        // Update total distance
        const newTotal = newSegmentDistances.reduce((sum, d) => sum + d, 0);
        setTotalDistance(newTotal);
        
        // Create a label for this segment
        const midPoint = new google.maps.LatLng(
          (prevPosition.lat() + currentPosition.lat()) / 2,
          (prevPosition.lng() + currentPosition.lng()) / 2
        );
        
        // Create custom overlay label
        const label = createDistanceLabelOverlay(
          midPoint,
          formatDistance(distance),
          map
        );
        
        if (label) {
          distanceLabelsRef.current.push(label);
        }
      }
    }
    
    // Add drag listeners to markers to update measurements
    google.maps.event.addListener(marker, 'drag', () => {
      updateLines();
    });
    
    google.maps.event.addListener(marker, 'dragend', () => {
      updateMeasurements();
    });
    
    // Update points count
    setPointsCount(markersRef.current.length);
  };
  
  // Update the lines when markers are dragged
  const updateLines = () => {
    if (!map || markersRef.current.length < 2 || !window.google) return;
    
    // Update each line based on its corresponding markers
    for (let i = 0; i < linesRef.current.length; i++) {
      const line = linesRef.current[i];
      const startMarker = markersRef.current[i];
      const endMarker = markersRef.current[i + 1];
      
      if (startMarker && endMarker) {
        const startPos = startMarker.getPosition();
        const endPos = endMarker.getPosition();
        
        if (startPos && endPos) {
          line.setPath([startPos, endPos]);
        }
      }
    }
  };
  
  // Update measurements after marker positions change
  const updateMeasurements = () => {
    if (!map || markersRef.current.length < 2 || !window.google) return;
    
    // Clear existing distance labels
    distanceLabelsRef.current.forEach(label => {
      if (label !== totalLabelRef.current) {
        label.setMap(null);
      }
    });
    
    distanceLabelsRef.current = distanceLabelsRef.current.filter(label => 
      label === totalLabelRef.current
    );
    
    // Calculate new distances
    const newSegmentDistances: number[] = [];
    let newTotalDistance = 0;
    
    for (let i = 0; i < markersRef.current.length - 1; i++) {
      const startMarker = markersRef.current[i];
      const endMarker = markersRef.current[i + 1];
      const startPos = startMarker.getPosition();
      const endPos = endMarker.getPosition();
      
      if (startPos && endPos) {
        // Update line
        linesRef.current[i].setPath([startPos, endPos]);
        
        // Calculate segment distance
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          startPos, endPos
        );
        newSegmentDistances.push(distance);
        newTotalDistance += distance;
        
        // Create new label
        const midPoint = new google.maps.LatLng(
          (startPos.lat() + endPos.lat()) / 2,
          (startPos.lng() + endPos.lng()) / 2
        );
        
        // Create custom overlay label
        const label = createDistanceLabelOverlay(
          midPoint,
          formatDistance(distance),
          map
        );
        
        if (label) {
          distanceLabelsRef.current.push(label);
        }
      }
    }
    
    // Update state
    setSegmentDistances(newSegmentDistances);
    setTotalDistance(newTotalDistance);
    
    // Update total label if it exists
    if (totalLabelRef.current) {
      totalLabelRef.current.setContent(`
        <div class="total-distance-label">
          <div>${formatDistance(newTotalDistance)}</div>
          <div style="font-size: 10px;">Total Distance</div>
        </div>
      `);
    }
  };
  
  // Format distance display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${meters.toFixed(1)} m`;
    } else {
      return `${(meters / 1000).toFixed(2)} km`;
    }
  };
  
  // Clear all measurement objects
  const clearMeasurement = () => {
    // Clear lines
    linesRef.current.forEach(line => line.setMap(null));
    linesRef.current = [];
    
    // Clear markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    startMarkerRef.current = null;
    
    // Clear distance labels
    distanceLabelsRef.current.forEach(label => {
      if (label && label.setMap) {
        label.setMap(null);
      }
    });
    distanceLabelsRef.current = [];
    totalLabelRef.current = null;
    
    // Clear instruction window
    if (instructionWindowRef.current) {
      instructionWindowRef.current.close();
      instructionWindowRef.current = null;
    }
    
    // Remove listeners
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    if (dblClickListenerRef.current) {
      google.maps.event.removeListener(dblClickListenerRef.current);
      dblClickListenerRef.current = null;
    }
    
    // Reset state
    setTotalDistance(0);
    setSegmentDistances([]);
    setPointsCount(0);
  };
  
  // Finish the measurement
  const finishMeasurement = () => {
    if (!map || markersRef.current.length < 2 || !window.google) return;
    
    // Remove click listener to prevent additional points
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    
    // Add total distance label at the last point
    const lastMarker = markersRef.current[markersRef.current.length - 1];
    const position = lastMarker.getPosition();
    
    if (position) {
      // Create a custom overlay for the total label
      const totalLabel = createDistanceLabelOverlay(
        position,
        `<div class="total-distance-label">
          <div>${formatDistance(totalDistance)}</div>
          <div style="font-size: 10px;">Total Distance</div>
        </div>`,
        map
      );
      
      if (totalLabel) {
        totalLabelRef.current = totalLabel;
        distanceLabelsRef.current.push(totalLabel);
      }
    }
  };
  
  // Handle cancel button click
  const handleCancel = () => {
    clearMeasurement();
    onClose();
  };
  
  if (!isActive) return null;
  
  return (
    <div className="absolute bottom-24 right-4 z-10 bg-white rounded-lg shadow-lg p-4 w-64 border-2 border-green-500">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium flex items-center">
          <FontAwesomeIcon icon={faRuler} className="text-green-600 mr-2" />
          Measure Distance
        </h3>
        <button 
          onClick={handleCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      
      <div className="text-sm text-gray-600 mb-3">
        Click on the map to place points. Double-click to finish.
      </div>
      
      {pointsCount >= 2 && (
        <div className="bg-green-50 p-2 rounded border border-green-200">
          <p className="text-center font-bold text-lg text-green-800">
            {formatDistance(totalDistance)}
          </p>
          <p className="text-center text-xs text-green-600">
            {pointsCount} points, {pointsCount - 1} segments
          </p>
        </div>
      )}
      
      <div className="flex justify-between mt-3">
        <button
          onClick={clearMeasurement}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
        >
          Clear
        </button>
        
        {pointsCount >= 2 && (
          <button
            onClick={finishMeasurement}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
};

export default DistanceMeasurement; 