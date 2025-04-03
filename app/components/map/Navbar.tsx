'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilter, 
  faSquareCheck,
  faTimes 
} from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';

interface NavbarProps {
  onPlaceSelect: (location: google.maps.LatLng) => void;
  isDrawingMode?: boolean;
  onCancelDrawing?: () => void;
  onFinishDrawing?: () => void;
  canFinishDrawing?: boolean;
}

const Navbar = ({ 
  onPlaceSelect, 
  isDrawingMode = false, 
  onCancelDrawing, 
  onFinishDrawing,
  canFinishDrawing = false
}: NavbarProps) => {
  return (
    <div className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-white px-2 sm:px-4 py-2 flex items-center h-12 shadow-md">
      {!isDrawingMode ? (
        <>
          <SearchBox onPlaceSelect={onPlaceSelect} />
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="hover:bg-white/20 p-1 sm:p-2 rounded transition-colors">
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button className="hover:bg-white/20 p-1 sm:p-2 rounded transition-colors">
              <FontAwesomeIcon icon={faSquareCheck} className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </>
      ) : (
        // Drawing mode banner (yellow color comes from parent gradient)
        <div className="w-full flex justify-between items-center">
          <button
            onClick={onCancelDrawing}
            className="p-1 text-white hover:bg-white/20 rounded transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-lg sm:text-xl" />
          </button>
          <div className="flex-1 text-right">
            <button
              onClick={onFinishDrawing}
              disabled={!canFinishDrawing}
              className={`py-1 px-2 sm:px-4 text-white transition-colors ${
                canFinishDrawing
                  ? "hover:bg-white/20 rounded"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="font-medium text-sm sm:text-base">SAVE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar; 