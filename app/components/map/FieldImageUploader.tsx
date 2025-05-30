'use client';

import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faTrash, faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';

interface FieldImageUploaderProps {
  onImageUpload: (image: File) => void;
  onClose: () => void;
  currentImages?: string[];
  onDeleteImage?: (index: number) => void;
  onSelectImage?: (index: number) => void;
  selectedImageIndex?: number;
}

const FieldImageUploader: React.FC<FieldImageUploaderProps> = ({
  onImageUpload,
  onClose,
  currentImages = [],
  onDeleteImage,
  onSelectImage,
  selectedImageIndex = 0
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(
    currentImages.length > 0 ? selectedImageIndex : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Basic validation - accept only images
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // File size validation - limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Reset viewing index when previewing a new upload
    setViewingImageIndex(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadClick = () => {
    if (selectedFile) {
      onImageUpload(selectedFile);
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const canAddMoreImages = currentImages.length < 5;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">
            <img 
              src="https://icones.pro/wp-content/uploads/2021/06/icone-d-image-rouge.png" 
              alt="Image icon" 
              className="w-10 h-10 inline-block mr-2"
              style={{ background: 'transparent' }}
            />
            Field Images ({currentImages.length}/5)
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="p-4">
          {/* Thumbnail gallery for existing images */}
          {currentImages.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {currentImages.map((image, index) => (
                  <div 
                    key={index} 
                    className={`relative cursor-pointer ${viewingImageIndex === index ? 'ring-2 ring-green-500' : ''}`}
                    onClick={() => setViewingImageIndex(index)}
                  >
                    <img 
                      src={image} 
                      alt={`Field image ${index + 1}`} 
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    {onDeleteImage && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteImage(index);
                          if (viewingImageIndex === index) {
                            setViewingImageIndex(currentImages.length > 1 ? 0 : null);
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 text-xs"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    )}
                  </div>
                ))}
                {canAddMoreImages && !selectedFile && (
                  <div 
                    className="w-16 h-16 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:bg-gray-50"
                    onClick={() => setViewingImageIndex(null)}
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-gray-400" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main image display/upload area */}
          {viewingImageIndex !== null && viewingImageIndex < currentImages.length ? (
            <div className="mb-4">
              <div className="relative">
                <img 
                  src={currentImages[viewingImageIndex]} 
                  alt={`Field image ${viewingImageIndex + 1}`} 
                  className="w-full h-48 object-cover rounded-lg"
                />
                {onSelectImage && (
                  <button 
                    onClick={() => {
                      onSelectImage(viewingImageIndex);
                      onClose();
                    }}
                    className="absolute bottom-2 right-2 bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 text-sm"
                  >
                    Set as main image
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">Image {viewingImageIndex + 1} of {currentImages.length}</p>
            </div>
          ) : (
            <div className="mb-4">
              {previewUrl ? (
                <div className="relative">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button 
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (currentImages.length > 0) {
                        setViewingImageIndex(0);
                      }
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              ) : canAddMoreImages ? (
                <div 
                  className={`rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer ${
                    isDragging ? 'bg-green-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <img 
                    src="https://icones.pro/wp-content/uploads/2021/06/icone-d-image-rouge.png" 
                    alt="Image icon" 
                    className="w-20 h-20 mb-2"
                    style={{ background: 'transparent' }}
                  />
                  <p className="text-gray-500 mb-1">Drag and drop an image here</p>
                  <p className="text-gray-400 text-sm">or click to browse</p>
                  <p className="text-gray-400 text-xs mt-2">{currentImages.length}/5 images used</p>
                </div>
              ) : (
                <div className="rounded-lg h-48 flex flex-col items-center justify-center bg-transparent">
                  <img 
                    src="https://icones.pro/wp-content/uploads/2021/06/icone-d-image-rouge.png" 
                    alt="Image icon" 
                    className="w-20 h-20 mb-2"
                    style={{ background: 'transparent' }}
                  />
                  <p className="text-red-500">Maximum 5 images per field</p>
                  <p className="text-gray-400 text-sm">Delete existing images to add more</p>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
            {previewUrl && (
              <button
                onClick={handleUploadClick}
                disabled={!selectedFile || !canAddMoreImages}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  selectedFile && canAddMoreImages
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <FontAwesomeIcon icon={faUpload} />
                Upload Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldImageUploader; 