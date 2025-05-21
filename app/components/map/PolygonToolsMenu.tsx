'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPalette, 
  faFill, 
  faTrash, 
  faBorderStyle,
  faTimes,
  faTag,
  faImage,
  faPlus,
  faInfoCircle,
  faBrush
} from '@fortawesome/free-solid-svg-icons';
import FieldImageUploader from './FieldImageUploader';

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

type TabType = 'basic' | 'style' | 'images';

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
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('basic');

  if (!isOpen || selectedPolygonIndex === null) {
    return null;
  }

  const handleImageUpload = (image: File) => {
    if (onAddImage) {
      onAddImage(image);
    }
    setShowImageUploader(false);
  };

  const handleDeleteImage = (imageIndex: number) => {
    if (onDeleteImage) {
      onDeleteImage(imageIndex);
    }
  };

  const handleSetMainImage = (imageIndex: number) => {
    if (onSetMainImage) {
      onSetMainImage(imageIndex);
    }
  };

  const mainImage = fieldImages.length > mainImageIndex ? fieldImages[mainImageIndex] : undefined;

  return (
    <>
      <div className="absolute bottom-60 right-4 sm:right-20 bg-white rounded-lg shadow-lg w-[90vw] max-w-md overflow-hidden animate-slideIn z-10 border-2 border-green-500">
        <div className="flex justify-between items-center border-b border-green-200 px-4 py-3 bg-green-50">
          <h3 className="font-semibold text-green-800">{fieldName || `Field #${selectedPolygonIndex + 1}`}</h3>
          <button 
            onClick={onClose}
            className="text-green-600 hover:text-green-800"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === 'basic' 
                ? 'border-b-2 border-green-500 text-green-700 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('basic')}
          >
            <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
            Basic
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === 'style' 
                ? 'border-b-2 border-green-500 text-green-700 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('style')}
          >
            <FontAwesomeIcon icon={faBrush} className="mr-2" />
            Style
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === 'images' 
                ? 'border-b-2 border-green-500 text-green-700 font-medium' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('images')}
          >
            <FontAwesomeIcon icon={faImage} className="mr-2" />
            Images {fieldImages.length > 0 && `(${fieldImages.length})`}
          </button>
        </div>
        
        <div className="p-4">
          {/* Basic Tab Content */}
          {activeTab === 'basic' && (
            <>
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
              
              {/* Toggle Editable */}
              {onToggleEditable && (
                <div className="mb-3 flex items-center justify-between">
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
                <div className="mb-3 flex items-center justify-between">
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
              
              {/* Delete Button */}
              <div className="mt-4">
                <button 
                  onClick={onDelete}
                  className="w-full py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center"
                >
                  <FontAwesomeIcon icon={faTrash} className="mr-2" />
                  Delete Field
                </button>
              </div>
            </>
          )}

          {/* Style Tab Content */}
          {activeTab === 'style' && (
            <>
              {/* Stroke Color */}
              <div className="mb-4">
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
              <div className="mb-4">
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
              <div className="mb-4">
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
              <div className="mb-4">
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
            </>
          )}

          {/* Images Tab Content */}
          {activeTab === 'images' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-green-800">
                  Field Images ({fieldImages.length}/5)
                </h4>
                <button 
                  onClick={() => setShowImageUploader(true)}
                  disabled={fieldImages.length >= 5}
                  className={`text-xs px-2 py-1 rounded-md flex items-center ${
                    fieldImages.length >= 5 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faPlus} className="mr-1" />
                  Add Image
                </button>
              </div>
              
              {mainImage ? (
                <div>
                  <div className="relative w-full h-48 mb-3">
                    <img 
                      src={mainImage} 
                      alt={fieldName || `Field ${selectedPolygonIndex + 1}`}
                      className="w-full h-full object-cover rounded border"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded">
                      <button 
                        onClick={() => setShowImageUploader(true)}
                        className="bg-white text-green-600 p-2 rounded-full mr-2 hover:bg-green-100"
                      >
                        <FontAwesomeIcon icon={faImage} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Thumbnail row for multiple images */}
                  {fieldImages.length > 1 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {fieldImages.map((image, index) => (
                        <div 
                          key={index}
                          className={`relative ${index === mainImageIndex ? 'ring-2 ring-green-500' : ''}`}
                        >
                          <img 
                            src={image} 
                            alt={`${fieldName || `Field ${selectedPolygonIndex + 1}`} image ${index + 1}`}
                            className="w-16 h-16 object-cover rounded cursor-pointer"
                            onClick={() => handleSetMainImage(index)}
                          />
                          {onDeleteImage && (
                            <button 
                              onClick={() => handleDeleteImage(index)}
                              className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 text-xs"
                              title="Delete image"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FontAwesomeIcon icon={faImage} className="text-gray-300 text-5xl mb-3" />
                  <p className="text-gray-500 mb-4">No images uploaded yet</p>
                  <button 
                    onClick={() => setShowImageUploader(true)} 
                    className="py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center mx-auto"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Upload Field Image
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Field Image Uploader Dialog */}
      {showImageUploader && (
        <FieldImageUploader
          onImageUpload={handleImageUpload}
          onClose={() => setShowImageUploader(false)}
          currentImages={fieldImages}
          onDeleteImage={handleDeleteImage}
          onSelectImage={handleSetMainImage}
          selectedImageIndex={mainImageIndex}
        />
      )}
    </>
  );
};

export default PolygonToolsMenu; 