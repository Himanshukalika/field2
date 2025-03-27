'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileImport, faDrawPolygon, faRuler, faMapMarker } from '@fortawesome/free-solid-svg-icons';

interface CreateMenuProps {
  showMenu: boolean;
  onToggleMenu: () => void;
  onOptionSelect: (option: 'import' | 'field' | 'distance' | 'marker') => void;
}

const CreateMenu: React.FC<CreateMenuProps> = ({
  showMenu,
  onToggleMenu,
  onOptionSelect
}) => {
  // Function to handle option selection and auto-close menu
  const handleOptionSelect = (option: 'import' | 'field' | 'distance' | 'marker') => {
    onOptionSelect(option);
    // Auto-close the menu after selecting an option
    onToggleMenu();
  };

  return (
    <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
      {showMenu && (
        <div className="bg-white rounded-lg shadow-lg mb-2 overflow-hidden animate-slideUp">
          <button
            className="flex items-center px-4 py-3 hover:bg-gray-100 w-full transition-colors text-left"
            onClick={() => handleOptionSelect('import')}
          >
            <FontAwesomeIcon icon={faFileImport} className="mr-3 text-gray-600" />
            <span>Import KML/GeoJSON</span>
          </button>
          <button
            className="flex items-center px-4 py-3 hover:bg-gray-100 w-full transition-colors text-left"
            onClick={() => handleOptionSelect('field')}
          >
            <FontAwesomeIcon icon={faDrawPolygon} className="mr-3 text-green-600" />
            <span>Draw New Field</span>
          </button>
          <button
            className="flex items-center px-4 py-3 hover:bg-gray-100 w-full transition-colors text-left"
            onClick={() => handleOptionSelect('distance')}
          >
            <FontAwesomeIcon icon={faRuler} className="mr-3 text-blue-600" />
            <span>Measure Distance</span>
          </button>
          <button
            className="flex items-center px-4 py-3 hover:bg-gray-100 w-full transition-colors text-left"
            onClick={() => handleOptionSelect('marker')}
          >
            <FontAwesomeIcon icon={faMapMarker} className="mr-3 text-red-600" />
            <span>Add Marker</span>
          </button>
        </div>
      )}
      <button
        onClick={onToggleMenu}
        className={`rounded-full shadow-lg p-4 transition-all duration-300 transform ${
          showMenu ? 'bg-red-500 text-white rotate-45' : 'bg-green-500 text-white'
        }`}
        style={{ width: '60px', height: '60px' }}
      >
        <FontAwesomeIcon icon={faPlus} className="text-2xl" />
      </button>
    </div>
  );
};

export default CreateMenu; 