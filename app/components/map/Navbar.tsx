'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilter, 
  faSquareCheck
} from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';

interface NavbarProps {
  onPlaceSelect: (location: google.maps.LatLng) => void;
}

const Navbar = ({ onPlaceSelect }: NavbarProps) => {
  return (
    <div className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-white px-4 py-2 flex items-center h-12 shadow-md">
      <SearchBox onPlaceSelect={onPlaceSelect} />
      <div className="flex items-center gap-4">
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faFilter} className="h-5 w-5" />
        </button>
        <button className="hover:bg-white/20 p-2 rounded transition-colors">
          <FontAwesomeIcon icon={faSquareCheck} className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Navbar; 