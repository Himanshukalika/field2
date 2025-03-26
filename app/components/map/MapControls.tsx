'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLocationCrosshairs,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import MapTypeMenu from './MapTypeMenu';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { 
  selectMapType, 
  setMapType, 
  toggleFullscreen, 
  setIsLocating,
  selectIsLocating
} from '../../redux/features/mapSlice';

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

interface MapControlsProps {
  currentMapType?: MapType; // Make optional since we'll use Redux
  onMapTypeChange?: (type: MapType) => void; // Make optional
  onLocationClick?: () => void; // Make optional
  onToggleFullscreen?: () => void; // Make optional
  isLocating?: boolean; // Make optional
}

const MapControls = ({ 
  currentMapType,
  onMapTypeChange,
  onLocationClick, 
  onToggleFullscreen,
  isLocating: propIsLocating
}: MapControlsProps) => {
  const dispatch = useAppDispatch();
  const reduxMapType = useAppSelector(selectMapType);
  const reduxIsLocating = useAppSelector(selectIsLocating);
  
  // Use props if provided, otherwise use Redux state
  const mapType = currentMapType || reduxMapType;
  const isLocating = propIsLocating !== undefined ? propIsLocating : reduxIsLocating;
  
  const handleLocationClick = () => {
    if (onLocationClick) {
      onLocationClick();
    } else {
      dispatch(setIsLocating(true));
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // Handle user location here - would need access to the map
            dispatch(setIsLocating(false));
          },
          (error) => {
            console.error('Error getting location:', error);
            dispatch(setIsLocating(false));
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
        dispatch(setIsLocating(false));
      }
    }
  };
  
  const handleToggleFullscreen = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        elem.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      dispatch(toggleFullscreen());
    }
  };

  return (
    <div className="absolute right-3 top-16 flex flex-col gap-2">
      <MapTypeMenu 
        currentType={mapType}
        onTypeChange={onMapTypeChange}
      />
      <button 
        onClick={handleLocationClick}
        disabled={isLocating}
        className={`${
          isLocating ? 'bg-gray-500' : 'bg-[#FF4C4C] hover:bg-[#FF3C3C]'
        } w-12 h-12 rounded-lg flex items-center justify-center transition-colors`}
      >
        <FontAwesomeIcon 
          icon={faLocationCrosshairs} 
          className={`h-5 w-5 text-white ${isLocating ? 'animate-pulse' : ''}`} 
        />
      </button>
      <button 
        onClick={handleToggleFullscreen}
        className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors"
      >
        <FontAwesomeIcon icon={faExpand} className="h-5 w-5 text-white" />
      </button>
    </div>
  );
};

export default MapControls; 