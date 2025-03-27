'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPalette, 
  faFill, 
  faTrash, 
  faBorderStyle,
  faTimes,
  faTag
} from '@fortawesome/free-solid-svg-icons';

interface PolygonToolsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeStrokeColor: (color: string) => void;
  onChangeFillColor: (color: string) => void;
  onChangeStrokeWeight: (weight: number) => void;
  onChangeFillOpacity: (opacity: number) => void;
  onChangeName: (name: string) => void;
  onDelete: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldName: string;
  selectedPolygonIndex: number | null;
}

const PolygonToolsMenu: React.FC<PolygonToolsMenuProps> = ({
  isOpen,
  onClose,
  onChangeStrokeColor,
  onChangeFillColor,
  onChangeStrokeWeight,
  onChangeFillOpacity,
  onChangeName,
  onDelete,
  strokeColor,
  fillColor,
  strokeWeight,
  fillOpacity,
  fieldName,
  selectedPolygonIndex
}) => {
  if (!isOpen || selectedPolygonIndex === null) {
    return null;
  }

  return (
    <div className="absolute top-20 right-4 bg-white rounded-lg shadow-lg w-80 overflow-hidden animate-slideIn">
      <div className="flex justify-between items-center border-b px-4 py-3">
        <h3 className="font-semibold">{fieldName || `Field #${selectedPolygonIndex + 1}`}</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      
      <div className="p-4">
        {/* Field Name */}
        <div className="mb-4">
          <label className="flex items-center mb-1 text-sm font-medium">
            <FontAwesomeIcon icon={faTag} className="mr-2 text-gray-600" />
            Field Name
          </label>
          <input 
            type="text" 
            value={fieldName}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Enter field name"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        
        {/* Stroke Color */}
        <div className="mb-3">
          <label className="flex items-center mb-1 text-sm font-medium">
            <FontAwesomeIcon icon={faBorderStyle} className="mr-2 text-gray-600" />
            Border Color
          </label>
          <div className="flex">
            <input 
              type="color" 
              value={strokeColor}
              onChange={(e) => onChangeStrokeColor(e.target.value)}
              className="w-10 h-10 rounded border overflow-hidden cursor-pointer"
            />
            <input 
              type="text" 
              value={strokeColor}
              onChange={(e) => onChangeStrokeColor(e.target.value)}
              className="flex-1 ml-2 px-3 py-2 border rounded"
            />
          </div>
        </div>
        
        {/* Fill Color */}
        <div className="mb-3">
          <label className="flex items-center mb-1 text-sm font-medium">
            <FontAwesomeIcon icon={faFill} className="mr-2 text-gray-600" />
            Fill Color
          </label>
          <div className="flex">
            <input 
              type="color" 
              value={fillColor}
              onChange={(e) => onChangeFillColor(e.target.value)}
              className="w-10 h-10 rounded border overflow-hidden cursor-pointer"
            />
            <input 
              type="text" 
              value={fillColor}
              onChange={(e) => onChangeFillColor(e.target.value)}
              className="flex-1 ml-2 px-3 py-2 border rounded"
            />
          </div>
        </div>
        
        {/* Stroke Weight */}
        <div className="mb-3">
          <label className="flex items-center mb-1 text-sm font-medium">
            <FontAwesomeIcon icon={faBorderStyle} className="mr-2 text-gray-600" />
            Border Width
          </label>
          <div className="flex items-center">
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={strokeWeight}
              onChange={(e) => onChangeStrokeWeight(Number(e.target.value))}
              className="flex-1 mr-2"
            />
            <span className="w-8 text-center">{strokeWeight}px</span>
          </div>
        </div>
        
        {/* Fill Opacity */}
        <div className="mb-3">
          <label className="flex items-center mb-1 text-sm font-medium">
            <FontAwesomeIcon icon={faFill} className="mr-2 text-gray-600" />
            Fill Opacity
          </label>
          <div className="flex items-center">
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={fillOpacity}
              onChange={(e) => onChangeFillOpacity(Number(e.target.value))}
              className="flex-1 mr-2"
            />
            <span className="w-8 text-center">{Math.round(fillOpacity * 100)}%</span>
          </div>
        </div>
        
        {/* Delete Button */}
        <div className="mt-6">
          <button 
            onClick={onDelete}
            className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faTrash} className="mr-2" />
            Delete Field
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolygonToolsMenu; 