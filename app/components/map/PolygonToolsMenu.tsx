'use client';

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPalette, 
  faFill, 
  faTrash, 
  faBorderStyle,
  faTimes,
  faTag,
  faInfoCircle,
  faBrush,
  faCheck,
  faSave
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
  onAddImage?: (file: File) => void;
  onDeleteImage?: (imageIndex: number) => void;
  onSetMainImage?: (imageIndex: number) => void;
  onToggleEditable?: () => void;
  onToggleDraggable?: () => void;
  onApplyChanges?: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  fillOpacity: number;
  fieldName: string;
  fieldImages: string[];
  mainImageIndex: number;
  selectedPolygonIndex: number | null;
  isEditable?: boolean;
  isDraggable?: boolean;
}

// Color palette definition with color names
const colorPalette = [
  // Row 1
  [
    { hex: '#FFFFFF', name: 'White' },
    { hex: '#D3D3D3', name: 'Light Gray' },
    { hex: '#A9A9A9', name: 'Gray' },
    { hex: '#696969', name: 'Dark Gray' },
    { hex: '#000000', name: 'Black' },
    { hex: '#00008B', name: 'Dark Blue' },
    { hex: '#4682B4', name: 'Steel Blue' },
    { hex: '#FF8C00', name: 'Dark Orange' },
    { hex: '#006400', name: 'Dark Green' },
    { hex: '#8A2BE2', name: 'Blue Violet' },
    { hex: '#FF1493', name: 'Deep Pink' },
    { hex: '#228B22', name: 'Forest Green' },
  ],
  // Row 2
  [
    { hex: '#F5F5F5', name: 'White Smoke' },
    { hex: '#C0C0C0', name: 'Silver' },
    { hex: '#808080', name: 'Gray' },
    { hex: '#404040', name: 'Dim Gray' },
    { hex: '#000080', name: 'Navy' },
    { hex: '#1E90FF', name: 'Dodger Blue' },
    { hex: '#87CEEB', name: 'Sky Blue' },
    { hex: '#FFA500', name: 'Orange' },
    { hex: '#90EE90', name: 'Light Green' },
    { hex: '#9370DB', name: 'Medium Purple' },
    { hex: '#FF69B4', name: 'Hot Pink' },
    { hex: '#32CD32', name: 'Lime Green' },
  ],
  // Row 3
  [
    { hex: '#F8F8FF', name: 'Ghost White' },
    { hex: '#D8BFD8', name: 'Thistle' },
    { hex: '#A9A9A9', name: 'Dark Gray' },
    { hex: '#778899', name: 'Light Slate Gray' },
    { hex: '#191970', name: 'Midnight Blue' },
    { hex: '#4169E1', name: 'Royal Blue' },
    { hex: '#ADD8E6', name: 'Light Blue' },
    { hex: '#FFA07A', name: 'Light Salmon' },
    { hex: '#98FB98', name: 'Pale Green' },
    { hex: '#DDA0DD', name: 'Plum' },
    { hex: '#FFC0CB', name: 'Pink' },
    { hex: '#3CB371', name: 'Medium Sea Green' },
  ],
  // Row 4
  [
    { hex: '#FFFAFA', name: 'Snow' },
    { hex: '#E6E6FA', name: 'Lavender' },
    { hex: '#B0C4DE', name: 'Light Steel Blue' },
    { hex: '#708090', name: 'Slate Gray' },
    { hex: '#483D8B', name: 'Dark Slate Blue' },
    { hex: '#6495ED', name: 'Cornflower Blue' },
    { hex: '#B0E0E6', name: 'Powder Blue' },
    { hex: '#F4A460', name: 'Sandy Brown' },
    { hex: '#8FBC8F', name: 'Dark Sea Green' },
    { hex: '#BA55D3', name: 'Medium Orchid' },
    { hex: '#FFB6C1', name: 'Light Pink' },
    { hex: '#2E8B57', name: 'Sea Green' },
  ],
  // Row 5
  [
    { hex: '#FFFFF0', name: 'Ivory' },
    { hex: '#E0FFFF', name: 'Light Cyan' },
    { hex: '#87CEFA', name: 'Light Sky Blue' },
    { hex: '#4682B4', name: 'Steel Blue' },
    { hex: '#4B0082', name: 'Indigo' },
    { hex: '#0000FF', name: 'Blue' },
    { hex: '#00BFFF', name: 'Deep Sky Blue' },
    { hex: '#CD853F', name: 'Peru' },
    { hex: '#00FF00', name: 'Lime' },
    { hex: '#9932CC', name: 'Dark Orchid' },
    { hex: '#DB7093', name: 'Pale Violet Red' },
    { hex: '#008000', name: 'Green' },
  ],
  // Row 6
  [
    { hex: '#F0FFF0', name: 'Honeydew' },
    { hex: '#AFEEEE', name: 'Pale Turquoise' },
    { hex: '#1E90FF', name: 'Dodger Blue' },
    { hex: '#0000CD', name: 'Medium Blue' },
    { hex: '#800080', name: 'Purple' },
    { hex: '#0000CD', name: 'Medium Blue' },
    { hex: '#00008B', name: 'Dark Blue' },
    { hex: '#8B4513', name: 'Saddle Brown' },
    { hex: '#00FF7F', name: 'Spring Green' },
    { hex: '#9400D3', name: 'Dark Violet' },
    { hex: '#C71585', name: 'Medium Violet Red' },
    { hex: '#006400', name: 'Dark Green' },
  ],
];

const PolygonToolsMenu: React.FC<PolygonToolsMenuProps> = ({
  isOpen,
  onClose,
  onChangeStrokeColor,
  onChangeFillColor,
  onChangeStrokeWeight,
  onChangeFillOpacity,
  onChangeName,
  onDelete,
  onAddImage,
  onDeleteImage,
  onSetMainImage,
  onToggleEditable,
  onToggleDraggable,
  onApplyChanges = onClose,
  strokeColor,
  fillColor,
  strokeWeight,
  fillOpacity,
  fieldName,
  fieldImages = [],
  mainImageIndex = 0,
  selectedPolygonIndex,
  isEditable,
  isDraggable
}) => {
  const [activeColorPicker, setActiveColorPicker] = useState<'stroke' | 'fill' | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [menuPosition, setMenuPosition] = useState<'bottom' | 'right'>('right');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Track initial values to detect changes
  const [initialValues, setInitialValues] = useState({
    strokeColor,
    fillColor,
    strokeWeight,
    fillOpacity,
    fieldName,
  });

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setMenuPosition(window.innerWidth < 640 ? 'bottom' : 'right');
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // Reset initial values when selection changes
  useEffect(() => {
    setInitialValues({
      strokeColor,
      fillColor,
      strokeWeight,
      fillOpacity,
      fieldName,
    });
    setHasChanges(false);
  }, [selectedPolygonIndex]);

  // Check for changes to enable/disable Apply button
  useEffect(() => {
    const changed = 
      initialValues.strokeColor !== strokeColor ||
      initialValues.fillColor !== fillColor ||
      initialValues.strokeWeight !== strokeWeight ||
      initialValues.fillOpacity !== fillOpacity ||
      initialValues.fieldName !== fieldName;
    
    setHasChanges(changed);
  }, [strokeColor, fillColor, strokeWeight, fillOpacity, fieldName, initialValues]);

  if (!isOpen || selectedPolygonIndex === null) {
    return null;
  }

  // Get color name from hex code
  const getColorName = (hexCode: string): string => {
    for (const row of colorPalette) {
      for (const color of row) {
        if (color.hex.toLowerCase() === hexCode.toLowerCase()) {
          return color.name;
        }
      }
    }
    return 'Custom Color';
  };

  const handleColorSelect = (color: { hex: string, name: string }) => {
    if (activeColorPicker === 'stroke') {
      onChangeStrokeColor(color.hex);
    } else if (activeColorPicker === 'fill') {
      onChangeFillColor(color.hex);
    }
    setActiveColorPicker(null);
  };

  // Get current color names
  const strokeColorName = getColorName(strokeColor);
  const fillColorName = getColorName(fillColor);

  const menuPositionClasses = menuPosition === 'bottom' 
    ? "fixed bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-lg"
    : "absolute bottom-40 right-4 sm:right-20 max-h-[80vh] overflow-y-auto";

  return (
    <>
      <div className={`bg-white shadow-lg animate-slideIn z-20 border-2 border-green-500 ${menuPositionClasses}`}>
        <div className="flex justify-between items-center border-b border-green-200 px-4 py-3 bg-green-50 sticky top-0">
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
              
          {/* Color Controls - Grid layout for larger screens */}
          <div className={`${isMobile ? 'space-y-4' : 'grid grid-cols-2 gap-4'} mb-4`}>
              {/* Stroke Color */}
            <div>
                <label className="flex items-center mb-1 text-sm font-medium text-green-800">
                  <FontAwesomeIcon icon={faBorderStyle} className="mr-2 text-green-600" />
                  Border Color
                </label>
              <div className="flex items-center">
                <div 
                  className="w-10 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: strokeColor }}
                  onClick={() => setActiveColorPicker(activeColorPicker === 'stroke' ? null : 'stroke')}
                />
                <span className="ml-3 flex-1 text-sm">{strokeColorName}</span>
                </div>
              </div>
              
              {/* Stroke Weight */}
            <div>
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
            
            {/* Fill Color */}
            <div>
              <label className="flex items-center mb-1 text-sm font-medium text-green-800">
                <FontAwesomeIcon icon={faFill} className="mr-2 text-green-600" />
                Fill Color
              </label>
              <div className="flex items-center">
                <div 
                  className="w-10 h-10 rounded border cursor-pointer"
                  style={{ backgroundColor: fillColor }}
                  onClick={() => setActiveColorPicker(activeColorPicker === 'fill' ? null : 'fill')}
                />
                <span className="ml-3 flex-1 text-sm">{fillColorName}</span>
              </div>
            </div>
              
              {/* Fill Opacity */}
            <div>
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
          </div>

          {/* Color Palette */}
          {activeColorPicker && (
            <div className="mb-4 p-2 border rounded bg-gray-50">
              <div className={`grid ${isMobile ? 'grid-cols-8' : 'grid-cols-12'} gap-1`}>
                {colorPalette.map((row, rowIndex) => (
                  <React.Fragment key={rowIndex}>
                    {row.map((color, colIndex) => (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => handleColorSelect(color)}
                        title={color.name}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          
          {/* Toggle Controls - Grid layout for larger screens */}
          <div className={`${isMobile ? 'space-y-3' : 'grid grid-cols-2 gap-4'}`}>
            {/* Toggle Editable */}
            {onToggleEditable && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-green-800">
                  Enable Vertex Editing
                </label>
                <button 
                  onClick={onToggleEditable}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${isEditable ? 'bg-green-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isEditable ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            )}
            
            {/* Toggle Draggable */}
            {onToggleDraggable && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-green-800">
                  Enable Field Dragging
                </label>
                      <button 
                  onClick={onToggleDraggable}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${isDraggable ? 'bg-green-600' : 'bg-gray-300'}`}
                      >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isDraggable ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
            )}
                  </div>
                  
          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className={isMobile ? "space-y-3" : "flex justify-center"}>
              {/* Apply Changes Button */}
              <button
                onClick={onApplyChanges}
                disabled={!hasChanges}
                className={`py-2 px-6 rounded-md flex items-center justify-center ${
                  hasChanges 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FontAwesomeIcon icon={faSave} className="mr-2" />
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PolygonToolsMenu; 