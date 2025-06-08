import { v4 as uuidv4 } from 'uuid';
import { FieldData } from './firebase';
import { PolygonPoint } from '../components/map/types';



/**
 * Converts a Google Maps polygon to a FieldData object for storing in Firestore
 */
export const polygonToFieldData = (
  polygon: google.maps.Polygon,
  index: number
): Omit<FieldData, 'userId' | 'createdAt' | 'updatedAt'> => {
  // Get the path of the polygon
  const path = polygon.getPath();
  const points: PolygonPoint[] = [];
  
  // Convert each LatLng to a PolygonPoint
  for (let i = 0; i < path.getLength(); i++) {
    const latLng = path.getAt(i);
    points.push({
      lat: latLng.lat(),
      lng: latLng.lng()
    });
  }
  
  // Calculate area and perimeter
  const area = google.maps.geometry.spherical.computeArea(path);
  const areaInHectares = area / 10000; // Convert to hectares
  
  let perimeter = 0;
  for (let i = 0; i < path.getLength(); i++) {
    const p1 = path.getAt(i);
    const p2 = path.getAt((i + 1) % path.getLength());
    perimeter += google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
  }
  const perimeterInKm = perimeter / 1000; // Convert to kilometers
  
  // Get field ID if it exists, otherwise generate a new UUID
  const fieldId = polygon.get('fieldId') || uuidv4();
  
  // Get field properties
  return {
    id: fieldId,
    points: points,
    area: areaInHectares,
    perimeter: perimeterInKm,
    measurements: [], // We don't currently store specific measurements
    name: polygon.get('fieldName') || `Field ${index + 1}`,
    color: polygon.get('fillColor') || '#3388ff',
    strokeColor: polygon.get('strokeColor') || '#3388ff',
    strokeWeight: polygon.get('strokeWeight') || 2,
    fillOpacity: polygon.get('fillOpacity') || 0.2,
    fieldImages: polygon.get('fieldImages') || [],
    mainImageIndex: polygon.get('fieldMainImageIndex') || 0
  };
};

/**
 * Converts a FieldData object from Firestore to a Google Maps Polygon
 */
export const fieldDataToPolygon = (
  fieldData: FieldData, 
  map: google.maps.Map | null
): google.maps.Polygon => {
  // Convert points to LatLng
  const path = fieldData.points.map(point => {
    return new google.maps.LatLng(point.lat, point.lng);
  });
  
  // Create the polygon
  const polygon = new google.maps.Polygon({
    map,
    paths: path,
    strokeColor: fieldData.strokeColor,
    strokeWeight: fieldData.strokeWeight,
    fillColor: fieldData.color,
    fillOpacity: fieldData.fillOpacity,
    editable: false,
    draggable: false
  });
  
  // Set custom properties
  polygon.set('fieldId', fieldData.id);
  polygon.set('fieldName', fieldData.name);
  polygon.set('strokeColor', fieldData.strokeColor);
  polygon.set('fillColor', fieldData.color);
  polygon.set('strokeWeight', fieldData.strokeWeight);
  polygon.set('fillOpacity', fieldData.fillOpacity);
  
  // Set field images if available
  if (fieldData.fieldImages && fieldData.fieldImages.length > 0) {
    polygon.set('fieldImages', fieldData.fieldImages);
    polygon.set('fieldMainImageIndex', fieldData.mainImageIndex || 0);
  }
  
  return polygon;
};

/**
 * Centers the map on a field
 */
export const centerMapOnField = (
  map: google.maps.Map, 
  fieldData: FieldData
) => {
  if (!fieldData.points || fieldData.points.length === 0) {
    return;
  }
  
  // Create bounds to contain all points
  const bounds = new google.maps.LatLngBounds();
  
  // Add each point to the bounds
  fieldData.points.forEach(point => {
    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
  });
  
  // Center the map on the bounds
  map.fitBounds(bounds);
}; 