'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLayerGroup,
  faEarth,
  faRoad,
  faMountain,
  faSatellite
} from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectMapType, setMapType } from '../../redux/features/mapSlice';

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

interface MapTypeMenuProps {
  currentType?: MapType; // Make optional since we'll use Redux
  onTypeChange?: (type: MapType) => void; // Make optional since we'll use Redux
}

const MapTypeMenu = ({ currentType, onTypeChange }: MapTypeMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);
  
  // Get map type from Redux if not provided as prop
  const reduxMapType = useAppSelector(selectMapType);
  const dispatch = useAppDispatch();
  
  // Use prop if provided, otherwise use Redux state
  const activeMapType = currentType || reduxMapType;

  const mapTypes = [
    { type: 'hybrid' as MapType, label: 'Hybrid', icon: faEarth },
    { type: 'satellite' as MapType, label: 'Satellite', icon: faSatellite },
    { type: 'roadmap' as MapType, label: 'Street', icon: faRoad },
    { type: 'terrain' as MapType, label: 'Terrain', icon: faMountain },
  ];

  const handleTypeChange = (type: MapType) => {
    // Use provided callback if available, otherwise dispatch Redux action
    if (onTypeChange) {
      onTypeChange(type);
    } else {
      dispatch(setMapType(type));
    }
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowMenu(!showMenu)}
        className="bg-black bg-opacity-60 w-12 h-12 rounded-lg flex items-center justify-center hover:bg-opacity-80 transition-colors "
      >
        <FontAwesomeIcon 
          icon={faLayerGroup} 
          className="h-5 w-5 text-white" 
        />
      </button>

      {showMenu && (
        <div className="absolute right-14 top-[-8] mt-2 bg-black bg-opacity-75 rounded-lg overflow-hidden w-40">
          {mapTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
                activeMapType === type ? 'bg-gray-800' : ''
              }`}
            >
              <FontAwesomeIcon icon={icon} className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapTypeMenu; 