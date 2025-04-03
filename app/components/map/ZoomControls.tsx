'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const ZoomControls = ({ onZoomIn, onZoomOut }: ZoomControlsProps) => {
  return (
    <div className="absolute bottom-16 right-3 bg-black bg-opacity-60 rounded-lg">
      <button 
        onClick={onZoomIn}
        className="w-12 h-12 text-white border-b border-gray-700 flex items-center justify-center hover:bg-opacity-80 transition-colors"
      >
        <FontAwesomeIcon icon={faPlus} className="h-5 w-5" />
      </button>
      <button 
        onClick={onZoomOut}
        className="w-12 h-12 text-white flex items-center justify-center hover:bg-opacity-80 transition-colors"
      >
        <FontAwesomeIcon icon={faMinus} className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ZoomControls; 