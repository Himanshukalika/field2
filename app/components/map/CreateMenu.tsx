'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileImport, faDrawPolygon, faRuler, faLocationDot } from '@fortawesome/free-solid-svg-icons';

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
    <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
      {showMenu && (
        <div className="bg-white rounded-lg shadow-lg mb-2 overflow-hidden animate-popIn max-w-[200px]">
          <button
            className="flex items-center px-3 py-2 hover:bg-gray-100 w-full transition-colors text-left border-b border-gray-100 text-sm"
            onClick={() => handleOptionSelect('import')}
          >
            <div className="bg-gray-100 rounded-full p-1.5 mr-2">
              <FontAwesomeIcon icon={faFileImport} className="text-gray-600 text-xs" />
            </div>
            <span>Import KML/GeoJSON</span>
          </button>
          <button
            className="flex items-center px-3 py-2 hover:bg-gray-100 w-full transition-colors text-left border-b border-gray-100 text-sm"
            onClick={() => handleOptionSelect('field')}
          >
            <div className="bg-green-100 rounded-full p-1.5 mr-2">
              <FontAwesomeIcon icon={faDrawPolygon} className="text-green-600 text-xs" />
            </div>
            <span>Draw New Field</span>
          </button>
          <button
            className="flex items-center px-3 py-2 hover:bg-gray-100 w-full transition-colors text-left border-b border-gray-100 text-sm"
            onClick={() => handleOptionSelect('distance')}
          >
            <div className="bg-blue-100 rounded-full p-1.5 mr-2">
              <FontAwesomeIcon icon={faRuler} className="text-blue-600 text-xs" />
            </div>
            <span>Measure Distance</span>
          </button>
          <button
            className="flex items-center px-3 py-2 hover:bg-gray-100 w-full transition-colors text-left text-sm"
            onClick={() => handleOptionSelect('marker')}
          >
            <div className="bg-red-100 rounded-full p-1.5 mr-2">
              <FontAwesomeIcon icon={faLocationDot} className="text-red-600 text-xs" />
            </div>
            <span>Add Marker</span>
          </button>
        </div>
      )}
      <button
        onClick={onToggleMenu}
        className={`rounded-full shadow-lg p-3 transition-all duration-300 transform ${
          showMenu ? 'bg-red-500 text-white rotate-45 scale-110' : 'bg-green-500 text-white hover:scale-110'
        }`}
        style={{ width: '50px', height: '50px' }}
      >
        <FontAwesomeIcon icon={faPlus} className="text-xl" />
      </button>
    </div>
  );
};

export default CreateMenu; 