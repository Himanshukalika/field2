'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faBars } from '@fortawesome/free-solid-svg-icons';
import { StandaloneSearchBox } from '@react-google-maps/api';
import './map.css';

interface SearchBoxProps {
  onPlaceSelect: (location: google.maps.LatLng) => void;
}

const SearchBox = ({ onPlaceSelect }: SearchBoxProps) => {
  const [searchText, setSearchText] = useState('');
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fix for mobile devices to ensure the input is properly focused
  useEffect(() => {
    const fixMobileInput = () => {
      // Fix caret color and ensure text is visible on mobile
      if (inputRef.current) {
        inputRef.current.style.caretColor = 'black';
      }
    };

    fixMobileInput();
    window.addEventListener('resize', fixMobileInput);
    return () => window.removeEventListener('resize', fixMobileInput);
  }, []);

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
    <div className="flex-1 flex items-center max-w-full" ref={containerRef}>
      <div className="w-full flex items-center bg-white rounded-lg h-10 overflow-visible relative z-20 search-box-container">
        <button className="min-w-[40px] p-2 hover:bg-gray-200 rounded-l-lg flex-shrink-0">
          <FontAwesomeIcon icon={faBars} className="h-5 w-5 text-black" />
        </button>
        <div className="flex-1 min-w-0">
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
              className="w-full h-10 px-2 text-black placeholder-gray-400 outline-none text-sm"
              style={{
                caretColor: 'black',
                WebkitAppearance: 'none'
              }}
            />
          </StandaloneSearchBox>
        </div>
        <button 
          onClick={handleSearchClick}
          className="min-w-[40px] p-2 hover:bg-gray-200 rounded-r-lg flex-shrink-0"
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} className="h-5 w-5 text-black" />
        </button>
      </div>
    </div>
  );
};

export default SearchBox; 