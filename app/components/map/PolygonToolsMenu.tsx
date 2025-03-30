'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPalette, 
  faFill, 
  faTrash, 
  faBorderStyle,
  faTimes,
  faTag,
  faEye,
  faMapMarked,
  faRuler
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
  onToggleDistanceLabels: () => void;
  onToggleFieldLabels: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldName: string;
  showDistanceLabels: boolean;
  showFieldLabels: boolean;
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
  onToggleDistanceLabels,
  onToggleFieldLabels,
  strokeColor,
  fillColor,
  strokeWeight,
  fillOpacity,
  fieldName,
  showDistanceLabels,
  showFieldLabels,
  selectedPolygonIndex
}) => {
  if (!isOpen || selectedPolygonIndex === null) {
    return null;
  }

  return (
    <div className="absolute bottom-20 right-20 bg-white rounded-lg shadow-lg w-80 overflow-hidden animate-slideIn z-10 border-2 border-green-500">
      <div className="flex justify-between items-center border-b border-green-200 px-4 py-3 bg-green-50">
        <h3 className="font-semibold text-green-800">{fieldName || `Field #${selectedPolygonIndex + 1}`}</h3>
        <button 
          onClick={onClose}
          className="text-green-600 hover:text-green-800"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      
      <div className="p-4">
        {/* Field Name */}
        <div className="mb-4">
          <label className="flex items-center mb-1 text-sm font-medium text-green-800">
            <FontAwesomeIcon icon={faTag} className="mr-2 text-green-600" />
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
          <label className="flex items-center mb-1 text-sm font-medium text-green-800">
            <FontAwesomeIcon icon={faBorderStyle} className="mr-2 text-green-600" />
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
          <label className="flex items-center mb-1 text-sm font-medium text-green-800">
            <FontAwesomeIcon icon={faFill} className="mr-2 text-green-600" />
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
          <label className="flex items-center mb-1 text-sm font-medium text-green-800">
            <FontAwesomeIcon icon={faBorderStyle} className="mr-2 text-green-600" />
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
          <label className="flex items-center mb-1 text-sm font-medium text-green-800">
            <FontAwesomeIcon icon={faFill} className="mr-2 text-green-600" />
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
        
        {/* Map Appearance Section */}
        <div className="mt-6 mb-3 border-t border-green-200 pt-4">
          <h4 className="text-sm font-medium text-green-800 mb-3 flex items-center">
            <FontAwesomeIcon icon={faMapMarked} className="mr-2 text-green-600" />
            Map Appearance
          </h4>
          
          {/* Toggle Distance Labels */}
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center text-sm text-gray-700">
              <FontAwesomeIcon icon={faRuler} className="mr-2 text-green-600" />
              Show Distance Labels
            </label>
            <button 
              onClick={onToggleDistanceLabels}
              className={`w-16 h-8 rounded-full relative ${showDistanceLabels ? 'bg-green-500' : 'bg-gray-300'} transition-colors`}
            >
              <span 
                className={`absolute w-6 h-6 bg-white rounded-full shadow transform transition-transform ${showDistanceLabels ? 'translate-x-8' : 'translate-x-1'} top-1`}
              ></span>
            </button>
          </div>
          
          {/* Toggle Field Labels */}
          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm text-gray-700">
              <FontAwesomeIcon icon={faTag} className="mr-2 text-green-600" />
              Show Field Labels
            </label>
            <button 
              onClick={onToggleFieldLabels}
              className={`w-16 h-8 rounded-full relative ${showFieldLabels ? 'bg-green-500' : 'bg-gray-300'} transition-colors`}
            >
              <span 
                className={`absolute w-6 h-6 bg-white rounded-full shadow transform transition-transform ${showFieldLabels ? 'translate-x-8' : 'translate-x-1'} top-1`}
              ></span>
            </button>
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