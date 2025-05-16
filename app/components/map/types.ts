export interface PolygonPoint {
  lat: number;
  lng: number;
}

export interface Field {
  id: string;
  points: PolygonPoint[];
  area: number;
  perimeter: number;
  measurements: { length: number; width: number; }[];
}

export interface MarkerData {
  id: string;
  position: PolygonPoint;
  label?: string;
  color?: string;
}

export type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

export const libraries: ("drawing" | "geometry" | "places")[] = ["drawing", "geometry", "places"];

export const mapStyles = {
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

export const defaultCenter = {
  lat: 27.342860470286933, 
  lng: 75.79046143662488,
};

export interface MapComponentProps {
  onAreaUpdate?: (area: number) => void;
}

// Define marker path as a string constant
export const MARKER_PATH = "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z"; 