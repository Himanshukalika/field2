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

type MapType = 'hybrid' | 'satellite' | 'roadmap' | 'terrain';

interface MapTypeMenuProps {
  currentType: MapType;
  onTypeChange: (type: MapType) => void;
}

const MapTypeMenu = ({ currentType, onTypeChange }: MapTypeMenuProps) => {
  const [showMenu, setShowMenu] = useState(false);

  const mapTypes = [
    { type: 'hybrid' as MapType, label: 'Hybrid', icon: faEarth },
    { type: 'satellite' as MapType, label: 'Satellite', icon: faSatellite },
    { type: 'roadmap' as MapType, label: 'Street', icon: faRoad },
    { type: 'terrain' as MapType, label: 'Terrain', icon: faMountain },
  ];

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
              onClick={() => {
                onTypeChange(type);
                setShowMenu(false);
              }}
              className={`w-full text-white p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
                currentType === type ? 'bg-gray-800' : ''
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