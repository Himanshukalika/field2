'use client';

import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash, faTimes } from '@fortawesome/free-solid-svg-icons';
import FieldImageUploader from './FieldImageUploader';

interface FieldImageGalleryProps {
  fieldImages: string[];
  mainImageIndex: number;
  onAddImage: (file: File) => void;
  onDeleteImage: (imageIndex: number) => void;
  onSetMainImage: (imageIndex: number) => void;
  fieldName: string;
  selectedPolygonIndex: number | null;
}

const FieldImageGallery: React.FC<FieldImageGalleryProps> = ({
  fieldImages = [],
  mainImageIndex = 0,
  onAddImage,
  onDeleteImage,
  onSetMainImage,
  fieldName,
  selectedPolygonIndex
}) => {
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [expandedView, setExpandedView] = useState(false);

  if (selectedPolygonIndex === null) {
    return null;
  }

  const handleImageUpload = (image: File) => {
    onAddImage(image);
    setShowImageUploader(false);
  };

  const mainImage = fieldImages.length > mainImageIndex ? fieldImages[mainImageIndex] : undefined;

  return (
    <>
      <div className={`absolute left-3 bottom-24 overflow-hidden z-10 transition-all ${expandedView ? 'w-64 bg-white border-2 border-green-500 rounded-lg shadow-lg' : 'w-16 bg-transparent border-0 shadow-none'}`}>
        {expandedView ? (
          <>
            <div className="flex justify-between items-center border-b border-green-200 px-3 py-2 bg-green-50">
              <h3 className="font-semibold text-green-800 text-sm">
                {fieldName || `Field #${selectedPolygonIndex + 1}`} Images
              </h3>
              <button 
                onClick={() => setExpandedView(false)}
                className="text-green-600 hover:text-green-800"
              >
                <FontAwesomeIcon icon={faTimes} size="sm" />
              </button>
            </div>
            
            <div className="p-3">
              {mainImage ? (
                <div>
                  <div className="relative w-full h-32 mb-2">
                    <img 
                      src={mainImage} 
                      alt={fieldName || `Field ${selectedPolygonIndex + 1}`}
                      className="w-full h-full object-cover rounded border"
                    />
                  </div>
                  
                  {/* Thumbnail row for multiple images */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {fieldImages.map((image, index) => (
                      <div 
                        key={index}
                        className={`relative ${index === mainImageIndex ? 'ring-2 ring-green-500' : ''}`}
                      >
                        <img 
                          src={image} 
                          alt={`${fieldName || `Field ${selectedPolygonIndex + 1}`} image ${index + 1}`}
                          className="w-12 h-12 object-cover rounded cursor-pointer"
                          onClick={() => onSetMainImage(index)}
                        />
                        <button 
                          onClick={() => onDeleteImage(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600 text-xs"
                          title="Delete image"
                        >
                          <FontAwesomeIcon icon={faTrash} size="xs" />
                        </button>
                      </div>
                    ))}
                    {fieldImages.length < 5 && (
                      <button 
                        onClick={() => setShowImageUploader(true)}
                        className="w-12 h-12 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:bg-gray-50"
                        title="Add image"
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <img 
                    src="https://icones.pro/wp-content/uploads/2021/06/icone-d-image-rouge.png" 
                    alt="Image icon" 
                    className="w-20 h-20 mx-auto mb-2"
                    style={{ background: 'transparent' }}
                  />
                  <p className="text-gray-500 text-xs mb-2">No images yet</p>
                  <button 
                    onClick={() => setShowImageUploader(true)} 
                    className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center mx-auto text-xs"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-1" />
                    Add Image
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button 
            onClick={() => setExpandedView(true)}
            className="w-full h-16 flex flex-col items-center justify-center bg-transparent border-none outline-none"
            style={{ boxShadow: 'none' }}
            title="Field Images"
          >
            <img 
              src="https://icones.pro/wp-content/uploads/2021/06/icone-d-image-rouge.png" 
              alt="Image icon" 
              className="w-12 h-12"
              style={{ background: 'transparent' }}
            />
            {fieldImages.length > 0 && (
              <span className="text-xs text-green-800">{fieldImages.length}</span>
            )}
          </button>
        )}
      </div>

      {/* Field Image Uploader Dialog */}
      {showImageUploader && (
        <FieldImageUploader
          onImageUpload={handleImageUpload}
          onClose={() => setShowImageUploader(false)}
          currentImages={fieldImages}
          onDeleteImage={onDeleteImage}
          onSelectImage={onSetMainImage}
          selectedImageIndex={mainImageIndex}
        />
      )}
    </>
  );
};

export default FieldImageGallery; 