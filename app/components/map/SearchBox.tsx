'use client';

import { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faBars } from '@fortawesome/free-solid-svg-icons';
import { StandaloneSearchBox } from '@react-google-maps/api';

interface SearchBoxProps {
  onPlaceSelect: (location: google.maps.LatLng) => void;
}

const SearchBox = ({ onPlaceSelect }: SearchBoxProps) => {
  const [searchText, setSearchText] = useState('');
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePlaceChanged = () => {
    const places = searchBoxRef.current?.getPlaces();
    if (places && places.length > 0) {
      const place = places[0];
      if (place.geometry?.location) {
        onPlaceSelect(place.geometry.location);
        setSearchText('');
      }
    }
  };

  const handleSearchClick = () => {
    if (searchText.trim()) {
      handlePlaceChanged();
    } else {
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePlaceChanged();
    }
  };

  return (
    <div className="flex-1 flex items-center">
      <div className="w-full flex items-center bg-white rounded-lg h-8 sm:h-10">
        <button className="p-1 sm:p-2 hover:bg-gray-800 rounded-l-lg">
          <FontAwesomeIcon icon={faBars} className="h-4 w-4 sm:h-5 sm:w-5 text-black" />
        </button>
        <div className="flex-1">
          <StandaloneSearchBox
            onLoad={ref => {
              if (ref) searchBoxRef.current = ref;
            }}
            onPlacesChanged={handlePlaceChanged}
          >
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search Google Maps"
              className="w-full h-8 sm:h-10 px-2 sm:px-4 text-black placeholder-gray-400 outline-none text-xs sm:text-sm"
            />
          </StandaloneSearchBox>
        </div>
        <button 
          onClick={handleSearchClick}
          className="p-1 sm:p-2 hover:bg-gray-800 rounded-r-lg"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-4 w-4 sm:h-5 sm:w-5 text-black" />
        </button>
      </div>
    </div>
  );
};

export default SearchBox; 