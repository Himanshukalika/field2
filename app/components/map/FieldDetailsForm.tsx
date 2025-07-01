'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUpload, faImage, faCheck, faPlus, faTrash, faMapMarkerAlt, faPrint, faArrowLeft, faEdit, faSave } from '@fortawesome/free-solid-svg-icons';
import { getFieldOwnerDetails } from '../../lib/firebase';

interface FieldDetailsFormProps {
  isOpen: boolean;
  onClose: () => void;
  fieldId: string | null;
  fieldName: string;
  fieldCoordinates?: { lat: number; lng: number }[];
  onSave: (fieldData: FieldFormData) => Promise<void>;
}

interface Partner {
  name: string;
  fathersName: string;
  share: string;
  mobile: string;
  alternativeNumber: string;
  emailId: string;
  whatsappNumber: string;
  permanentAddress: string;
  temporaryAddress: string;
}

export interface FieldFormData {
  ownerPhoto: string | null;
  name: string;
  fathersName: string;
  permanentAddress: string;
  temporaryAddress: string;
  propertyAddress: string;
  pincode: string;
  propertyGroup: string;
  govtPropertyType: string;
  govtPropertySubType: string;
  ownershipType: string;
  authorityName: string;
  partners: Partner[];
  colonyName: string;
  plotNumber: string;
  blockNumber: string;
  roadNumber: string;
  galiNumber: string;
  isCornerPlot: boolean;
  specialPlotType: string; // Add this new field
  plotFacing: string;
  documentType: string;
  dlcRate: string;
  dlcRateUnit: string;
  roadFront: string;
  roadFrontUnit: string;
  roadType: string;
  propertyArea: string;
  propertyAreaUnit: string;
  propertySideLength: string;
  northSideLength: string;
  southSideLength: string;
  eastSideLength: string;
  westSideLength: string;
  sideLengthUnit: string;
  khataNo: string;
  khasraNo: string;
  mobile: string;
  alternativeNumber: string;
  emailId: string;
  whatsappNumber: string;
  aadharNumber: string;
  aadharFrontPhoto: string | null;
  aadharBackPhoto: string | null;
  landRecordPhoto: string | null;
  bhunakshaPhoto: string | null;
  fieldId: string | null;
}

const FieldDetailsForm: React.FC<FieldDetailsFormProps> = ({
  isOpen,
  onClose,
  fieldId,
  fieldName,
  fieldCoordinates,
  onSave
}) => {
  const [formData, setFormData] = useState<FieldFormData>({
    ownerPhoto: null,
    name: '',
    fathersName: '',
    permanentAddress: '',
    temporaryAddress: '',
    propertyAddress: '',
    pincode: '',
    propertyGroup: 'agriculture',
    govtPropertyType: '',
    govtPropertySubType: '',
    ownershipType: 'individual',
    authorityName: '',
    partners: [{ name: '', fathersName: '', share: '', mobile: '', alternativeNumber: '', emailId: '', whatsappNumber: '', permanentAddress: '', temporaryAddress: '' }],
    colonyName: '',
    plotNumber: '',
    blockNumber: '',
    roadNumber: '',
    galiNumber: '',
    isCornerPlot: false,
    specialPlotType: '', // Initialize the new field
    plotFacing: '',
    documentType: 'govt.zammbandi',
    dlcRate: '',
    dlcRateUnit: 'sqm',
    roadFront: '',
    roadFrontUnit: 'running_foot',
    roadType: 'main_road',
    propertyArea: '',
    propertyAreaUnit: 'square_meter',
    propertySideLength: '',
    northSideLength: '',
    southSideLength: '',
    eastSideLength: '',
    westSideLength: '',
    sideLengthUnit: 'm',
    khataNo: '',
    khasraNo: '',
    mobile: '',
    alternativeNumber: '',
    emailId: '',
    whatsappNumber: '',
    aadharNumber: '',
    aadharFrontPhoto: null,
    aadharBackPhoto: null,
    landRecordPhoto: null,
    bhunakshaPhoto: null,
    fieldId: fieldId
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [printView, setPrintView] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load existing field details when the form is opened
  useEffect(() => {
    const loadFieldDetails = async () => {
      if (fieldId && isOpen) {
        setIsLoading(true);
        try {
          const details = await getFieldOwnerDetails(fieldId);
          
          // Format center coordinate for display if available
          let propertyAddressWithCoordinates = '';
          if (fieldCoordinates && fieldCoordinates.length > 0) {
            // Calculate center coordinate
            let centerLat = 0;
            let centerLng = 0;
            
            fieldCoordinates.forEach(coord => {
              centerLat += coord.lat;
              centerLng += coord.lng;
            });
            
            centerLat /= fieldCoordinates.length;
            centerLng /= fieldCoordinates.length;
            
            // Format the center coordinate - only show coordinates
            propertyAddressWithCoordinates = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
          }
          
          if (details) {
            setFormData({
              ...details,
              propertyAddress: details.propertyAddress || propertyAddressWithCoordinates,
              fieldId: fieldId
            });
            
            // If this is an existing record, set to view mode by default
            setEditMode(false);
          } else {
            setFormData(prev => ({
              ...prev,
              propertyAddress: propertyAddressWithCoordinates,
              fieldId: fieldId
            }));
            
            // For new records, keep edit mode
            setEditMode(true);
          }
        } catch (error) {
          console.error("Error loading field details:", error);
          
          // Still update the property address with center coordinate if available
          if (fieldCoordinates && fieldCoordinates.length > 0) {
            // Calculate center coordinate
            let centerLat = 0;
            let centerLng = 0;
            
            fieldCoordinates.forEach(coord => {
              centerLat += coord.lat;
              centerLng += coord.lng;
            });
            
            centerLat /= fieldCoordinates.length;
            centerLng /= fieldCoordinates.length;
            
            // Format the center coordinate - only show coordinates
            const propertyAddressWithCoordinates = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
            
            setFormData(prev => ({
              ...prev,
              propertyAddress: propertyAddressWithCoordinates,
              fieldId: fieldId
            }));
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // For new fields, still include center coordinate if available
        if (fieldCoordinates && fieldCoordinates.length > 0) {
          // Calculate center coordinate
          let centerLat = 0;
          let centerLng = 0;
          
          fieldCoordinates.forEach(coord => {
            centerLat += coord.lat;
            centerLng += coord.lng;
          });
          
          centerLat /= fieldCoordinates.length;
          centerLng /= fieldCoordinates.length;
          
          // Format the center coordinate - only show coordinates
          const propertyAddressWithCoordinates = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
          
          setFormData(prev => ({
            ...prev,
            propertyAddress: propertyAddressWithCoordinates
          }));
        }
        setIsLoading(false);
        
        // Always start in edit mode for new records
        setEditMode(true);
      }
    };

    loadFieldDetails();
  }, [fieldId, isOpen, fieldCoordinates]);

  // Close the modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Reset success message after showing
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (saveSuccess) {
      timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [saveSuccess]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Special handling for Aadhar number to add hyphens
    if (name === 'aadharNumber') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, '');
      // Limit to 12 digits
      const truncated = digitsOnly.slice(0, 12);
      // Format with hyphens after every 4 digits
      let formatted = '';
      for (let i = 0; i < truncated.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formatted += '-';
        }
        formatted += truncated[i];
      }
      setFormData(prev => ({ ...prev, [name]: formatted }));
    } 
    // Special handling for road type to set default road width
    else if (name === 'roadType') {
      let defaultRoadWidth = '';
      
      // Set default road width based on road type
      switch(value) {
        case 'main_road':
          defaultRoadWidth = '60';
          break;
        case 'highway':
          defaultRoadWidth = '100';
          break;
        case 'colony_road':
          defaultRoadWidth = '30';
          break;
        case 'service_road':
          defaultRoadWidth = '40';
          break;
        case 'sector_road':
          defaultRoadWidth = '45';
          break;
        case 'gali':
          defaultRoadWidth = '15';
          break;
        case 'bypass':
          defaultRoadWidth = '80';
          break;
        case 'ring_road':
          defaultRoadWidth = '80';
          break;
        case 'state_highway':
          defaultRoadWidth = '80';
          break;
        case 'village_road':
          defaultRoadWidth = '20';
          break;
        default:
          defaultRoadWidth = '';
      }
      
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        roadFront: defaultRoadWidth || prev.roadFront
      }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePartnerChange = (index: number, field: keyof Partner, value: string) => {
    const updatedPartners = [...formData.partners];
    updatedPartners[index] = {
      ...updatedPartners[index],
      [field]: value
    };
    setFormData(prev => ({ ...prev, partners: updatedPartners }));
  };

  const addPartner = () => {
    setFormData(prev => ({
      ...prev,
      partners: [...prev.partners, { name: '', fathersName: '', share: '', mobile: '', alternativeNumber: '', emailId: '', whatsappNumber: '', permanentAddress: '', temporaryAddress: '' }]
    }));
  };

  const removePartner = (index: number) => {
    if (formData.partners.length > 1) {
      const updatedPartners = [...formData.partners];
      updatedPartners.splice(index, 1);
      setFormData(prev => ({ ...prev, partners: updatedPartners }));
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'ownerPhoto' | 'aadharFrontPhoto' | 'aadharBackPhoto' | 'landRecordPhoto' | 'bhunakshaPhoto'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({
        ...prev,
        [field]: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Optimize data before saving - remove unnecessary fields for govt properties
      const optimizedData = { ...formData };
      if (formData.propertyGroup === 'govt') {
        // Clear out personal data fields to reduce data size for govt properties
        optimizedData.ownerPhoto = null;
        optimizedData.aadharFrontPhoto = null;
        optimizedData.aadharBackPhoto = null;
        optimizedData.landRecordPhoto = null;
      }
      
      // Check if we have images to upload
      const hasImages = 
        (optimizedData.ownerPhoto && optimizedData.ownerPhoto.startsWith('data:image')) ||
        (optimizedData.aadharFrontPhoto && optimizedData.aadharFrontPhoto.startsWith('data:image')) ||
        (optimizedData.aadharBackPhoto && optimizedData.aadharBackPhoto.startsWith('data:image')) ||
        (optimizedData.landRecordPhoto && optimizedData.landRecordPhoto.startsWith('data:image')) ||
        (optimizedData.bhunakshaPhoto && optimizedData.bhunakshaPhoto.startsWith('data:image'));
      
      // Show loading message
      if (hasImages) {
        // This will be shown while images are uploading
        alert("Images are being uploaded to server. Please wait...");
      }
      
      // Save the optimized data (images will be uploaded to Firebase Storage)
      await onSave(optimizedData);
      setSaveSuccess(true);
      
      // Switch to print view instead of closing
      setPrintView(true);
    } catch (error) {
      console.error("Error saving field details:", error);
      alert("Failed to save field details. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  // Render print view if form was successfully submitted or in view mode for existing records
  if (printView || (!isLoading && !editMode)) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] overflow-y-auto p-0 sm:p-2 md:p-6">
        <div 
          ref={modalRef}
          className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative my-2 mx-auto"
        >
          {/* Print-specific styles */}
          <style type="text/css" media="print">
            {`
              @page { size: auto; margin: 15mm; }
              body { background-color: white; }
              img { max-width: 100%; page-break-inside: avoid; }
              .print-image { max-height: 200px; object-fit: contain; }
              .print-section { page-break-inside: avoid; }
              .no-break { page-break-inside: avoid; }
            `}
          </style>
          
          {/* Header */}
          <div className="bg-blue-600 p-3 sm:p-4 text-white flex justify-between items-center sticky top-0 z-10">
            <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate">Property Details - {fieldName}</h2>
            <div className="flex items-center">
              {!printView && (
                <button 
                  onClick={() => setEditMode(true)}
                  className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0 mr-2"
                  title="Edit Details"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
              )}
              <button 
                onClick={handlePrint}
                className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0 mr-2"
                title="Print Details"
              >
                <FontAwesomeIcon icon={faPrint} />
              </button>
              <button 
                onClick={() => {
                  setPrintView(false);
                  onClose();
                }}
                className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Print view content */}
            <div className="print:text-black">
              <div className="text-center mb-6 print:mb-4">
                <h1 className="text-xl font-bold">{fieldName} - Property Details</h1>
                <p className="text-gray-500">{formData.propertyAddress}</p>
              </div>

              {/* Property Category */}
              <div className="mb-6 print:mb-4">
                <h2 className="text-lg font-semibold border-b pb-1 mb-2">Property Category</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Category:</span>{' '}
                    {formData.propertyGroup === 'agriculture' ? 'Agriculture' : 
                     formData.propertyGroup === 'commercial' ? 'Commercial' :
                     formData.propertyGroup === 'residential' ? 'Residential' :
                     formData.propertyGroup === 'industrial' ? 'Industrial' : 'Government'}
                  </div>
                  {formData.propertyGroup === 'govt' && (
                    <>
                      <div>
                        <span className="font-medium">Govt Property Type:</span>{' '}
                        {formData.govtPropertyType === 'water' ? 'Water' :
                         formData.govtPropertyType === 'roads' ? 'Roads' :
                         formData.govtPropertyType === 'electric' ? 'Electric' :
                         formData.govtPropertyType === 'hospital' ? 'Hospital' :
                         formData.govtPropertyType === 'mining' ? 'Mining' :
                         formData.govtPropertyType === 'forest' ? 'Forest' :
                         formData.govtPropertyType === 'department_office' ? 'Department Office' : ''}
                      </div>
                      {formData.govtPropertySubType && (
                        <div>
                          <span className="font-medium">Subcategory:</span>{' '}
                          {formData.govtPropertySubType.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </div>
                      )}
                    </>
                  )}
                  {formData.isCornerPlot && (
                    <div>
                      <span className="font-medium">Special Plot Type:</span>{' '}
                      {formData.specialPlotType === 'corner' ? 'Corner Plot' :
                       formData.specialPlotType === 'park_facing' ? 'Park Facing' :
                       formData.specialPlotType === 'double_corner' ? 'Double Corner' :
                       formData.specialPlotType === 'two_side_open' ? 'Two Side Open' :
                       formData.specialPlotType === 'three_side_open' ? 'Three Side Open' :
                       formData.specialPlotType === 'main_road_facing' ? 'Main Road Facing' :
                       formData.specialPlotType === 'cul_de_sac' ? 'Cul-de-sac Plot' :
                       formData.specialPlotType === 'other' ? 'Other' : 'Yes'}
                    </div>
                  )}
                  {formData.plotFacing && (
                    <div>
                      <span className="font-medium">Plot Facing:</span>{' '}
                      {formData.plotFacing === 'east' ? 'East' :
                       formData.plotFacing === 'west' ? 'West' :
                       formData.plotFacing === 'north' ? 'North' :
                       formData.plotFacing === 'south' ? 'South' :
                       formData.plotFacing === 'north_east' ? 'North-East' :
                       formData.plotFacing === 'north_west' ? 'North-West' :
                       formData.plotFacing === 'south_east' ? 'South-East' :
                       formData.plotFacing === 'south_west' ? 'South-West' : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Information */}
              {formData.propertyGroup !== 'govt' && (
                <div className="mb-6 print:mb-4 print-section">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Owner Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Owner Photo */}
                    {formData.ownerPhoto && (
                      <div className="col-span-1 sm:col-span-2 flex flex-col items-center mb-3 no-break">
                        <span className="font-medium mb-2">Owner Photo</span>
                        <img 
                          src={formData.ownerPhoto} 
                          alt="Owner" 
                          className="h-40 object-contain border border-gray-300 rounded-md print-image"
                        />
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium">Ownership Type:</span>{' '}
                      {formData.ownershipType === 'individual' ? 'Individual' : 
                       formData.ownershipType === 'partnership' ? 'Partnership' : 'Organization/Company'}
                    </div>
                    
                    {formData.ownershipType !== 'partnership' && (
                      <>
                        <div>
                          <span className="font-medium">{formData.ownershipType === 'organization' ? 'Organization Name' : 'Name'}:</span>{' '}
                          {formData.name}
                        </div>
                        {formData.ownershipType === 'individual' && (
                          <div>
                            <span className="font-medium">Father's Name:</span>{' '}
                            {formData.fathersName}
                          </div>
                        )}
                        {formData.ownershipType === 'organization' && (
                          <div>
                            <span className="font-medium">Authority Name:</span>{' '}
                            {formData.authorityName}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Partnership details if applicable */}
                  {formData.ownershipType === 'partnership' && (
                    <div className="mt-2">
                      <h3 className="font-medium">Partners:</h3>
                      {formData.partners.map((partner, index) => (
                        <div key={index} className="ml-4 mt-2 pb-2 border-b border-gray-100 last:border-b-0">
                          <div><span className="font-medium">Name:</span> {partner.name}</div>
                          {partner.fathersName && <div><span className="font-medium">Father's Name:</span> {partner.fathersName}</div>}
                          <div><span className="font-medium">Share:</span> {partner.share}</div>
                          {partner.mobile && <div><span className="font-medium">Mobile:</span> {partner.mobile}</div>}
                          {partner.alternativeNumber && <div><span className="font-medium">Alternative Number:</span> {partner.alternativeNumber}</div>}
                          {partner.whatsappNumber && <div><span className="font-medium">WhatsApp:</span> {partner.whatsappNumber}</div>}
                          {partner.emailId && <div><span className="font-medium">Email:</span> {partner.emailId}</div>}
                          {partner.permanentAddress && <div><span className="font-medium">Permanent Address:</span> {partner.permanentAddress}</div>}
                          {partner.temporaryAddress && <div><span className="font-medium">Temporary Address:</span> {partner.temporaryAddress}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Contact Information */}
              {formData.propertyGroup !== 'govt' && formData.ownershipType !== 'partnership' && (
                <div className="mb-6 print:mb-4">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Contact Information</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.mobile && (
                      <div>
                        <span className="font-medium">Mobile:</span> {formData.mobile}
                      </div>
                    )}
                    {formData.alternativeNumber && (
                      <div>
                        <span className="font-medium">Alternative Number:</span> {formData.alternativeNumber}
                      </div>
                    )}
                    {formData.whatsappNumber && (
                      <div>
                        <span className="font-medium">WhatsApp:</span> {formData.whatsappNumber}
                      </div>
                    )}
                    {formData.emailId && (
                      <div>
                        <span className="font-medium">Email:</span> {formData.emailId}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Address Information */}
              {formData.propertyGroup !== 'govt' && formData.ownershipType !== 'partnership' && (
                <div className="mb-6 print:mb-4">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Address Information</h2>
                  {formData.permanentAddress && (
                    <div className="mb-2">
                      <span className="font-medium">Permanent Address:</span> {formData.permanentAddress}
                    </div>
                  )}
                  {formData.temporaryAddress && (
                    <div>
                      <span className="font-medium">Temporary Address:</span> {formData.temporaryAddress}
                    </div>
                  )}
                </div>
              )}

              {/* Property Details */}
              <div className="mb-6 print:mb-4">
                <h2 className="text-lg font-semibold border-b pb-1 mb-2">Property Details</h2>
                
                {/* Selected Polygon Area - Moved to top of Property Details in print view */}
                {fieldCoordinates && fieldCoordinates.length > 2 && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200 print:bg-white print:border-gray-300">
                    <h3 className="font-medium text-gray-700 mb-2">Selected Polygon Area</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(() => {
                        // Calculate area using Google Maps geometry library
                        try {
                          // Create a path from the coordinates
                          const path = fieldCoordinates.map(coord => new google.maps.LatLng(coord.lat, coord.lng));
                          
                          // Calculate area in square meters
                          const areaInSqMeters = google.maps.geometry.spherical.computeArea(path);
                          
                          // Convert to different units
                          const areaInHectares = areaInSqMeters / 10000;
                          const areaInSqFeet = areaInSqMeters * 10.764;
                          const areaInSqYards = areaInSqMeters * 1.196;
                          
                          return (
                            <>
                              <div>
                                <span className="font-medium">Hectares:</span>{' '}
                                <span>{areaInHectares.toFixed(4)} ha</span>
                              </div>
                              <div>
                                <span className="font-medium">Square Meters:</span>{' '}
                                <span>{areaInSqMeters.toFixed(2)} m²</span>
                              </div>
                              <div>
                                <span className="font-medium">Square Feet:</span>{' '}
                                <span>{areaInSqFeet.toFixed(2)} ft²</span>
                              </div>
                              <div>
                                <span className="font-medium">Square Yards:</span>{' '}
                                <span>{areaInSqYards.toFixed(2)} yd²</span>
                              </div>
                            </>
                          );
                        } catch (error) {
                          console.error("Error calculating area:", error);
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Coordinates:</span> {formData.propertyAddress}
                  </div>
                  {formData.pincode && (
                    <div>
                      <span className="font-medium">Pincode:</span> {formData.pincode}
                    </div>
                  )}

                  {/* Urban Property Details */}
                  {formData.propertyGroup !== 'agriculture' && formData.propertyGroup !== 'govt' && (
                    <>
                      {formData.colonyName && (
                        <div>
                          <span className="font-medium">Colony Name:</span> {formData.colonyName}
                        </div>
                      )}
                      {formData.plotNumber && (
                        <div>
                          <span className="font-medium">Plot Number:</span> {formData.plotNumber}
                        </div>
                      )}
                      {formData.blockNumber && (
                        <div>
                          <span className="font-medium">Block Number:</span> {formData.blockNumber}
                        </div>
                      )}
                      {formData.roadNumber && (
                        <div>
                          <span className="font-medium">Road Number:</span> {formData.roadNumber}
                        </div>
                      )}
                      {formData.galiNumber && (
                        <div>
                          <span className="font-medium">Gali Number:</span> {formData.galiNumber}
                        </div>
                      )}
                    </>
                  )}

                  {/* Agriculture Property Details */}
                  {formData.propertyGroup === 'agriculture' && (
                    <>
                      {formData.khataNo && (
                        <div>
                          <span className="font-medium">Khata No:</span> {formData.khataNo}
                        </div>
                      )}
                      {formData.khasraNo && (
                        <div>
                          <span className="font-medium">Khasra No:</span> {formData.khasraNo}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Property Measurements */}
              {formData.propertyGroup !== 'govt' && (
                <div className="mb-6 print:mb-4">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Property Measurements</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {formData.roadFront && (
                      <div>
                        <span className="font-medium">Road Front:</span> {formData.roadFront} 
                        {formData.roadFrontUnit === 'running_foot' ? ' ft' : ' m'}
                        {formData.roadType && (
                          <span> ({formData.roadType.replace(/_/g, ' ')})</span>
                        )}
                      </div>
                    )}
                    {formData.propertyArea && (
                      <div>
                        <span className="font-medium">Property Area:</span> {formData.propertyArea} 
                        {formData.propertyAreaUnit === 'square_foot' ? ' ft²' : 
                         formData.propertyAreaUnit === 'square_meter' ? ' m²' :
                         formData.propertyAreaUnit === 'square_yard' ? ' yd²' : ' km²'}
                      </div>
                    )}
                    {formData.dlcRate && (
                      <div>
                        <span className="font-medium">DLC Rate:</span> ₹{formData.dlcRate}/
                        {formData.dlcRateUnit === 'sqm' ? 'm²' : 
                         formData.dlcRateUnit === 'sqft' ? 'ft²' :
                         formData.dlcRateUnit === 'sqyd' ? 'yd²' : 'ha'}
                      </div>
                    )}
                  </div>

                  {/* Side Measurements */}
                  {(formData.northSideLength || formData.southSideLength || formData.eastSideLength || formData.westSideLength) && (
                    <div className="mt-3">
                      <h3 className="font-medium">Side Measurements:</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-4">
                        {formData.northSideLength && (
                          <div>
                            <span className="font-medium">North:</span> {formData.northSideLength} {formData.sideLengthUnit}
                          </div>
                        )}
                        {formData.southSideLength && (
                          <div>
                            <span className="font-medium">South:</span> {formData.southSideLength} {formData.sideLengthUnit}
                          </div>
                        )}
                        {formData.eastSideLength && (
                          <div>
                            <span className="font-medium">East:</span> {formData.eastSideLength} {formData.sideLengthUnit}
                          </div>
                        )}
                        {formData.westSideLength && (
                          <div>
                            <span className="font-medium">West:</span> {formData.westSideLength} {formData.sideLengthUnit}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document Information */}
              {formData.propertyGroup !== 'govt' && (
                <div className="mb-6 print:mb-4">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Document Information</h2>
                  <div>
                    <span className="font-medium">Document Type:</span>{' '}
                    {formData.documentType === 'govt.zammbandi' ? 'Govt. Zammbandi' :
                     formData.documentType === 'panchayat_pata' ? 'Panchayat Pata' :
                     formData.documentType === 'nagarpalika_pata' ? 'Nagarpalika Pata' :
                     formData.documentType === 'development_authority' ? 'Development Authority (JDA/BDA/KDA)' :
                     formData.documentType === 'govt_approved_society' ? 'Government Approved Society' :
                     formData.documentType === 'riico' ? 'RIICO' :
                     'Government Land Category Convert Document'}
                  </div>
                  {formData.aadharNumber && (
                    <div className="mt-2">
                      <span className="font-medium">Aadhar Number:</span> {formData.aadharNumber}
                    </div>
                  )}
                  
                  {/* Document Images */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Aadhar Front */}
                    {formData.aadharFrontPhoto && (
                      <div className="flex flex-col items-center no-break">
                        <span className="font-medium mb-1">Aadhar Card (Front)</span>
                        <img 
                          src={formData.aadharFrontPhoto} 
                          alt="Aadhar Front" 
                          className="max-h-40 object-contain border border-gray-300 rounded-md print-image"
                        />
                      </div>
                    )}
                    
                    {/* Aadhar Back */}
                    {formData.aadharBackPhoto && (
                      <div className="flex flex-col items-center no-break">
                        <span className="font-medium mb-1">Aadhar Card (Back)</span>
                        <img 
                          src={formData.aadharBackPhoto} 
                          alt="Aadhar Back" 
                          className="max-h-40 object-contain border border-gray-300 rounded-md print-image"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Land Records */}
              {formData.propertyGroup !== 'govt' && (formData.landRecordPhoto || formData.bhunakshaPhoto) && (
                <div className="mb-6 print:mb-4 print-section">
                  <h2 className="text-lg font-semibold border-b pb-1 mb-2">Land Records</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Land Record Photo */}
                    {formData.landRecordPhoto && (
                      <div className="flex flex-col items-center no-break">
                        <span className="font-medium mb-1">Land Record Document</span>
                        <img 
                          src={formData.landRecordPhoto} 
                          alt="Land Record" 
                          className="max-h-52 object-contain border border-gray-300 rounded-md print-image"
                        />
                      </div>
                    )}
                    
                    {/* Bhunaksha Photo */}
                    {formData.bhunakshaPhoto && (
                      <div className="flex flex-col items-center no-break">
                        <span className="font-medium mb-1">Bhunaksha Image</span>
                        <img 
                          src={formData.bhunakshaPhoto} 
                          alt="Bhunaksha" 
                          className="max-h-52 object-contain border border-gray-300 rounded-md print-image"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Footer with date */}
              <div className="mt-8 pt-4 border-t text-sm text-gray-500">
                <p>Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="mt-6 flex justify-end gap-3 print:hidden">
              {!printView && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
                >
                  <FontAwesomeIcon icon={faEdit} />
                  Edit
                </button>
              )}
              {printView && (
                <button
                  type="button"
                  onClick={() => setPrintView(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Back to Form
                </button>
              )}
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-md flex items-center gap-2 hover:bg-blue-700"
              >
                <FontAwesomeIcon icon={faPrint} />
                Print
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintView(false);
                  onClose();
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render form view for editing
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] overflow-y-auto p-0 sm:p-2 md:p-6">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative my-2 mx-auto"
      >
        {/* Header */}
        <div className="bg-blue-600 p-3 sm:p-4 text-white flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate">{fieldName}</h2>
          <div className="flex items-center">
            {!isLoading && fieldId && (
              <button 
                onClick={() => setEditMode(false)}
                className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0 mr-2"
                title="View Details"
              >
                <FontAwesomeIcon icon={faCheck} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {/* Success message */}
        {saveSuccess && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 sm:p-4 mb-2 sm:mb-4">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faCheck} className="mr-2" />
              <p>Field details saved successfully!</p>
            </div>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoading ? (
          <div className="p-4 sm:p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
            <p>Loading field details...</p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-3 sm:p-4 md:p-6">
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              {/* Property Category - Show for all ownership types */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Property Category</h3>
                <div className="mb-4">
                  <select
                    name="propertyGroup"
                    value={formData.propertyGroup}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="agriculture">Agriculture</option>
                    <option value="commercial">Commercial</option>
                    <option value="residential">Residential</option>
                    <option value="industrial">Industrial</option>
                    <option value="govt">Govt</option>
                  </select>
                </div>
                
                {/* Government Property Type - Only visible when Govt is selected */}
                {formData.propertyGroup === 'govt' && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Government Property Type</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center">
                        <input
                          id="govt-water"
                          type="radio"
                          name="govtPropertyType"
                          value="water"
                          checked={formData.govtPropertyType === 'water'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-water" className="ml-2 block text-sm text-gray-700">
                          Water
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-roads"
                          type="radio"
                          name="govtPropertyType"
                          value="roads"
                          checked={formData.govtPropertyType === 'roads'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-roads" className="ml-2 block text-sm text-gray-700">
                          Roads
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-electric"
                          type="radio"
                          name="govtPropertyType"
                          value="electric"
                          checked={formData.govtPropertyType === 'electric'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-electric" className="ml-2 block text-sm text-gray-700">
                          Electric
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-hospital"
                          type="radio"
                          name="govtPropertyType"
                          value="hospital"
                          checked={formData.govtPropertyType === 'hospital'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-hospital" className="ml-2 block text-sm text-gray-700">
                          Hospital
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-mining"
                          type="radio"
                          name="govtPropertyType"
                          value="mining"
                          checked={formData.govtPropertyType === 'mining'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-mining" className="ml-2 block text-sm text-gray-700">
                          Mining
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-forest"
                          type="radio"
                          name="govtPropertyType"
                          value="forest"
                          checked={formData.govtPropertyType === 'forest'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-forest" className="ml-2 block text-sm text-gray-700">
                          Forest
                        </label>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          id="govt-department-office"
                          type="radio"
                          name="govtPropertyType"
                          value="department_office"
                          checked={formData.govtPropertyType === 'department_office'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="govt-department-office" className="ml-2 block text-sm text-gray-700">
                          Department Office
                        </label>
                      </div>
                    </div>

                    {/* Subcategory selection based on selected government property type */}
                    {formData.govtPropertyType && (
                      <div className="mt-4 border-t border-gray-200 pt-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Subcategory</h5>
                        <select
                          name="govtPropertySubType"
                          value={formData.govtPropertySubType}
                          onChange={handleInputChange}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select Subcategory</option>
                          
                          {/* Water subcategories */}
                          {formData.govtPropertyType === 'water' && (
                            <>
                              <option value="river">River</option>
                              <option value="lake">Lake</option>
                              <option value="pond">Pond</option>
                              <option value="canal">Canal</option>
                              <option value="dam">Dam</option>
                              <option value="reservoir">Reservoir</option>
                              <option value="watershed">Watershed</option>
                              <option value="water_treatment">Water Treatment Plant</option>
                            </>
                          )}
                          
                          {/* Roads subcategories */}
                          {formData.govtPropertyType === 'roads' && (
                            <>
                              <option value="national_highway">National Highway</option>
                              <option value="state_highway">State Highway</option>
                              <option value="district_road">District Road</option>
                              <option value="village_road">Village Road</option>
                              <option value="city_road">City Road</option>
                              <option value="expressway">Expressway</option>
                              <option value="bypass">Bypass</option>
                              <option value="bridge">Bridge</option>
                              <option value="flyover">Flyover</option>
                            </>
                          )}
                          
                          {/* Electric subcategories */}
                          {formData.govtPropertyType === 'electric' && (
                            <>
                              <option value="power_plant">Power Plant</option>
                              <option value="substation">Substation</option>
                              <option value="transmission_line">Transmission Line</option>
                              <option value="distribution_center">Distribution Center</option>
                              <option value="solar_plant">Solar Plant</option>
                              <option value="wind_farm">Wind Farm</option>
                              <option value="hydro_power">Hydro Power Station</option>
                              <option value="thermal_power">Thermal Power Station</option>
                            </>
                          )}
                          
                          {/* Hospital subcategories */}
                          {formData.govtPropertyType === 'hospital' && (
                            <>
                              <option value="district_hospital">District Hospital</option>
                              <option value="community_health_center">Community Health Center</option>
                              <option value="primary_health_center">Primary Health Center</option>
                              <option value="sub_center">Sub Center</option>
                              <option value="medical_college">Medical College</option>
                              <option value="specialty_hospital">Specialty Hospital</option>
                              <option value="dispensary">Dispensary</option>
                              <option value="ayush_center">AYUSH Center</option>
                            </>
                          )}
                          
                          {/* Mining subcategories */}
                          {formData.govtPropertyType === 'mining' && (
                            <>
                              <option value="coal_mine">Coal Mine</option>
                              <option value="stone_mine">Stone Mine</option>
                              <option value="sand_mine">Sand Mine</option>
                              <option value="mineral_mine">Mineral Mine</option>
                              <option value="metal_mine">Metal Mine</option>
                              <option value="clay_mine">Clay Mine</option>
                              <option value="gravel_mine">Gravel Mine</option>
                              <option value="quarry">Quarry</option>
                            </>
                          )}
                          
                          {/* Forest subcategories */}
                          {formData.govtPropertyType === 'forest' && (
                            <>
                              <option value="reserved_forest">Reserved Forest</option>
                              <option value="protected_forest">Protected Forest</option>
                              <option value="village_forest">Village Forest</option>
                              <option value="wildlife_sanctuary">Wildlife Sanctuary</option>
                              <option value="national_park">National Park</option>
                              <option value="biosphere_reserve">Biosphere Reserve</option>
                              <option value="tiger_reserve">Tiger Reserve</option>
                              <option value="community_forest">Community Forest</option>
                            </>
                          )}
                          
                          {/* Department Office subcategories */}
                          {formData.govtPropertyType === 'department_office' && (
                            <>
                              <option value="collectorate">Collectorate</option>
                              <option value="tehsil_office">Tehsil Office</option>
                              <option value="panchayat_office">Panchayat Office</option>
                              <option value="police_station">Police Station</option>
                              <option value="court">Court</option>
                              <option value="education_dept">Education Department</option>
                              <option value="revenue_dept">Revenue Department</option>
                              <option value="agriculture_dept">Agriculture Department</option>
                              <option value="forest_dept">Forest Department</option>
                              <option value="pwd">Public Works Department</option>
                              <option value="health_dept">Health Department</option>
                              <option value="irrigation_dept">Irrigation Department</option>
                            </>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
       

              {/* Property Measurements Section */}
              <div>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Property Details</h3>
                  
                  {/* Selected Polygon Area Section - Moved to top of Property Details */}
                  {fieldCoordinates && fieldCoordinates.length > 2 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Polygon Area</h4>
                      <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(() => {
                            // Calculate area using Google Maps geometry library
                            const calculateArea = () => {
                              try {
                                // Create a path from the coordinates
                                const path = fieldCoordinates.map(coord => new google.maps.LatLng(coord.lat, coord.lng));
                                
                                // Calculate area in square meters
                                const areaInSqMeters = google.maps.geometry.spherical.computeArea(path);
                                
                                // Convert to different units
                                const areaInHectares = areaInSqMeters / 10000;
                                const areaInSqFeet = areaInSqMeters * 10.764;
                                const areaInSqYards = areaInSqMeters * 1.196;
                                
                                return {
                                  sqMeters: areaInSqMeters.toFixed(2),
                                  hectares: areaInHectares.toFixed(4),
                                  sqFeet: areaInSqFeet.toFixed(2),
                                  sqYards: areaInSqYards.toFixed(2)
                                };
                              } catch (error) {
                                console.error("Error calculating area:", error);
                                return {
                                  sqMeters: "0.00",
                                  hectares: "0.0000",
                                  sqFeet: "0.00",
                                  sqYards: "0.00"
                                };
                              }
                            };
                            
                            const areas = calculateArea();
                            
                            return (
                              <>
                                <div>
                                  <span className="font-medium text-gray-700">Hectares:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">{areas.hectares} ha</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Square Meters:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">{areas.sqMeters} m²</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Square Feet:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">{areas.sqFeet} ft²</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-700">Square Yards:</span>
                                  <span className="ml-2 text-blue-700 font-semibold">{areas.sqYards} yd²</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Coordinates
                    </label>
                    <div className="flex">
                      <textarea
                        name="propertyAddress"
                        value={formData.propertyAddress}
                        readOnly
                        className="w-full h-12 p-2 border border-gray-300 rounded-l-md bg-gray-50 cursor-not-allowed"
                        placeholder="Property coordinates"
                        rows={2}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          // Extract coordinates from the format (lat, lng)
                          const coordsMatch = formData.propertyAddress.match(/\(([^,]+),\s*([^)]+)\)/);
                          if (coordsMatch && coordsMatch.length === 3) {
                            const lat = coordsMatch[1];
                            const lng = coordsMatch[2];
                            // Open Google Maps in a new tab
                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                          } else {
                            alert('Invalid coordinates format. Cannot open in Google Maps.');
                          }
                        }}
                        className="flex items-center justify-center px-4 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                        title="Open in Google Maps"
                      >
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                        <span className="ml-2 hidden sm:inline">Navigate</span>
                      </button>
                    </div>
                  </div>

                  
                  
                  
                
                  
                  {/* Special/Corner   - Available for all property types */}
                  <div className="mb-4 mt-4">
                    <div className="flex items-center">
                      <input
                        id="corner-plot"
                        type="checkbox"
                        name="isCornerPlot"
                        checked={formData.isCornerPlot}
                        onChange={(e) => setFormData(prev => ({ ...prev, isCornerPlot: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label htmlFor="corner-plot" className="ml-2 block text-sm font-medium text-gray-700">
                        This is a Special/Corner Plot
                      </label>
                    </div>
                    
                    {/* Show special plot type options when isCornerPlot is checked */}
                    {formData.isCornerPlot && (
                      <div className="mt-3 ml-6 p-3 bg-gray-50 rounded-md border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">How is this plot special?</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center">
                            <input
                              id="special-corner"
                              type="radio"
                              name="specialPlotType"
                              value="corner"
                              checked={formData.specialPlotType === 'corner'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-corner" className="ml-2 block text-sm text-gray-700">
                              Corner Plot
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-park-facing"
                              type="radio"
                              name="specialPlotType"
                              value="park_facing"
                              checked={formData.specialPlotType === 'park_facing'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-park-facing" className="ml-2 block text-sm text-gray-700">
                              Park Facing
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-double-corner"
                              type="radio"
                              name="specialPlotType"
                              value="double_corner"
                              checked={formData.specialPlotType === 'double_corner'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-double-corner" className="ml-2 block text-sm text-gray-700">
                              Double Corner
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-two-side-open"
                              type="radio"
                              name="specialPlotType"
                              value="two_side_open"
                              checked={formData.specialPlotType === 'two_side_open'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-two-side-open" className="ml-2 block text-sm text-gray-700">
                              Two Side Open
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-three-side-open"
                              type="radio"
                              name="specialPlotType"
                              value="three_side_open"
                              checked={formData.specialPlotType === 'three_side_open'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-three-side-open" className="ml-2 block text-sm text-gray-700">
                              Three Side Open
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-main-road-facing"
                              type="radio"
                              name="specialPlotType"
                              value="main_road_facing"
                              checked={formData.specialPlotType === 'main_road_facing'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-main-road-facing" className="ml-2 block text-sm text-gray-700">
                              Main Road Facing
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-cul-de-sac"
                              type="radio"
                              name="specialPlotType"
                              value="cul_de_sac"
                              checked={formData.specialPlotType === 'cul_de_sac'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-cul-de-sac" className="ml-2 block text-sm text-gray-700">
                              Cul-de-sac Plot
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="special-other"
                              type="radio"
                              name="specialPlotType"
                              value="other"
                              checked={formData.specialPlotType === 'other'}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-blue-600 border-gray-300"
                            />
                            <label htmlFor="special-other" className="ml-2 block text-sm text-gray-700">
                              Other
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
               
                  
                  {/* Plot Facing Section - Add this new section */}
                  <div className="mb-4">
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Plot Facing
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex items-center">
                        <input
                          id="facing-east"
                          type="radio"
                          name="plotFacing"
                          value="east"
                          checked={formData.plotFacing === 'east'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-east" className="ml-2 block text-sm text-gray-700">
                          East
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-west"
                          type="radio"
                          name="plotFacing"
                          value="west"
                          checked={formData.plotFacing === 'west'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-west" className="ml-2 block text-sm text-gray-700">
                          West
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-north"
                          type="radio"
                          name="plotFacing"
                          value="north"
                          checked={formData.plotFacing === 'north'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-north" className="ml-2 block text-sm text-gray-700">
                          North
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-south"
                          type="radio"
                          name="plotFacing"
                          value="south"
                          checked={formData.plotFacing === 'south'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-south" className="ml-2 block text-sm text-gray-700">
                          South
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-north-east"
                          type="radio"
                          name="plotFacing"
                          value="north_east"
                          checked={formData.plotFacing === 'north_east'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-north-east" className="ml-2 block text-sm text-gray-700">
                          North-East
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-north-west"
                          type="radio"
                          name="plotFacing"
                          value="north_west"
                          checked={formData.plotFacing === 'north_west'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-north-west" className="ml-2 block text-sm text-gray-700">
                          North-West
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-south-east"
                          type="radio"
                          name="plotFacing"
                          value="south_east"
                          checked={formData.plotFacing === 'south_east'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-south-east" className="ml-2 block text-sm text-gray-700">
                          South-East
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="facing-south-west"
                          type="radio"
                          name="plotFacing"
                          value="south_west"
                          checked={formData.plotFacing === 'south_west'}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-600 border-gray-300"
                        />
                        <label htmlFor="facing-south-west" className="ml-2 block text-sm text-gray-700">
                          South-West
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Urban Property Details - Only visible for commercial, residential, industrial */}
                  {formData.propertyGroup !== 'agriculture' && formData.propertyGroup !== 'govt' && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Urban Property Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Colony Name
                          </label>
                          <input
                            type="text"
                            name="colonyName"
                            value={formData.colonyName}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter colony name"
                          />
                        </div>
                        
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Plot Number
                          </label>
                          <input
                            type="text"
                            name="plotNumber"
                            value={formData.plotNumber}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter plot number"
                          />
                        </div>
                        
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Block Number
                          </label>
                          <input
                            type="text"
                            name="blockNumber"
                            value={formData.blockNumber}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter block number"
                          />
                        </div>
                        
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Road Number
                          </label>
                          <input
                            type="text"
                            name="roadNumber"
                            value={formData.roadNumber}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter road number"
                          />
                        </div>
                        
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Gali Number
                          </label>
                          <input
                            type="text"
                            name="galiNumber"
                            value={formData.galiNumber}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter gali number"
                          />
                        </div>
                        

                      </div>
                    </div>
                  )}
                  
                  {/* Agriculture Property Details - Only visible when Agriculture is selected */}
                  {formData.propertyGroup === 'agriculture' && (
                    <div className="mb-4 mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Agriculture Property Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Khata No
                          </label>
                          <input
                            type="text"
                            name="khataNo"
                            value={formData.khataNo}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter Khata Number"
                          />
                        </div>
                        
                        <div>
                          <label className="block mb-1 text-xs font-medium text-gray-700">
                            Khasra No
                          </label>
                          <input
                            type="text"
                            name="khasraNo"
                            value={formData.khasraNo}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Enter Khasra Number"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Property measurement fields - Not visible for govt properties */}
                  {formData.propertyGroup !== 'govt' && (
                    <>
                      {/* Road Front */}
                      <div className="mb-4">
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Road Front
                        </label>
                        <div className="mb-2">
                          <select
                            name="roadType"
                            value={formData.roadType}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                          >
                            <option value="main_road">Main Road</option>
                            <option value="highway">Highway / National Highway</option>
                            <option value="colony_road">Colony Road</option>
                            <option value="service_road">Service Road</option>
                            <option value="sector_road">Sector Road</option>
                            <option value="gali">Gali / Street</option>
                            <option value="bypass">Bypass Road</option>
                            <option value="ring_road">Ring Road</option>
                            <option value="state_highway">State Highway</option>
                            <option value="village_road">Village Road</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="flex">
                          <input
                            type="number"
                            name="roadFront"
                            value={formData.roadFront}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-l-md"
                            placeholder="Enter road front"
                          />
                          <select
                            name="roadFrontUnit"
                            value={formData.roadFrontUnit}
                            onChange={handleInputChange}
                            className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600"
                          >
                            <option value="running_foot">ft</option>
                            <option value="running_meter">m</option>
                          </select>
                        </div>
                      </div>
                      
                      {/* Property Area */}
                      <div className="mb-4">
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Property Area
                        </label>
                        <div className="flex">
                          <input
                            type="number"
                            name="propertyArea"
                            value={formData.propertyArea}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-l-md"
                            placeholder="Enter property area"
                          />
                          <select
                            name="propertyAreaUnit"
                            value={formData.propertyAreaUnit}
                            onChange={handleInputChange}
                            className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600"
                          >
                            <option value="square_foot">ft²</option>
                            <option value="square_meter">m²</option>
                            <option value="square_yard">yd²</option>
                            <option value="square_km">km²</option>
                          </select>
                        </div>
                      </div>

                      {/* Property DLC Rate */}
                      <div className="mb-4">
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          Property DLC Rate
                        </label>
                        <div className="flex">
                          <input
                            type="number"
                            name="dlcRate"
                            value={formData.dlcRate}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-l-md"
                            placeholder="Enter DLC rate"
                          />
                          <select
                            name="dlcRateUnit"
                            value={formData.dlcRateUnit}
                            onChange={handleInputChange}
                            className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600"
                          >
                            <option value="sqm">₹/m²</option>
                            <option value="sqft">₹/ft²</option>
                            <option value="sqyd">₹/yd²</option>
                            <option value="ha">₹/ha</option>
                          </select>
                        </div>
                      </div>

                      {/* Side-wise Length Measurements */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Side-wise Length Measurements</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* North Side */}
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              North Side Length
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                name="northSideLength"
                                value={formData.northSideLength}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded-l-md"
                                placeholder="North side length"
                              />
                              <select
                                name="sideLengthUnit"
                                value={formData.sideLengthUnit}
                                onChange={handleInputChange}
                                className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600"
                              >
                                <option value="m">m</option>
                                <option value="ft">ft</option>
                              </select>
                            </div>
                          </div>
                          
                          {/* South Side */}
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              South Side Length
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                name="southSideLength"
                                value={formData.southSideLength}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded-l-md"
                                placeholder="South side length"
                              />
                              <span className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600">
                                {formData.sideLengthUnit}
                              </span>
                            </div>
                          </div>
                          
                          {/* East Side */}
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              East Side Length
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                name="eastSideLength"
                                value={formData.eastSideLength}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded-l-md"
                                placeholder="East side length"
                              />
                              <span className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600">
                                {formData.sideLengthUnit}
                              </span>
                            </div>
                          </div>
                          
                          {/* West Side */}
                          <div>
                            <label className="block mb-1 text-xs font-medium text-gray-700">
                              West Side Length
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                name="westSideLength"
                                value={formData.westSideLength}
                                onChange={handleInputChange}
                                className="w-full p-2 border border-gray-300 rounded-l-md"
                                placeholder="West side length"
                              />
                              <span className="bg-gray-100 border border-gray-300 border-l-0 rounded-r-md flex items-center px-3 text-gray-600">
                                {formData.sideLengthUnit}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

<div className="mb-4">
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Pincode
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter pincode"
                      maxLength={6}
                    />
                  </div>
                  
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Basic Info */}
                {formData.propertyGroup !== 'govt' && (
                <div>
                  {/* Ownership Type */}
                  <div className="mb-4">
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Ownership Type
                    </label>
                    <select
                      name="ownershipType"
                      value={formData.ownershipType}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="individual">Individual</option>
                      <option value="partnership">Partnership</option>
                      <option value="organization">Organization/Company</option>
                    </select>
                  </div>

                  {/* Partnership Details - Only visible when Partnership is selected */}
                  {formData.ownershipType === 'partnership' && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Partnership Details</h4>
                      
                      {formData.partners.map((partner, index) => (
                        <div key={index} className="mb-3 pb-3 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Partner {index + 1}</span>
                            {formData.partners.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => removePartner(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <FontAwesomeIcon icon={faTrash} />
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="block mb-1 text-xs font-medium text-gray-700">
                                Partner Name
                              </label>
                              <input
                                type="text"
                                value={partner.name}
                                onChange={(e) => handlePartnerChange(index, 'name', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Partner's name"
                                required={formData.ownershipType === 'partnership'}
                              />
                            </div>
                            
                            <div>
                              <label className="block mb-1 text-xs font-medium text-gray-700">
                                Father's Name
                              </label>
                              <input
                                type="text"
                                value={partner.fathersName}
                                onChange={(e) => handlePartnerChange(index, 'fathersName', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Father's name"
                              />
                            </div>
                            
                            <div>
                              <label className="block mb-1 text-xs font-medium text-gray-700">
                                Share Percentage
                              </label>
                              <input
                                type="text"
                                value={partner.share}
                                onChange={(e) => handlePartnerChange(index, 'share', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="e.g. 50%"
                                required={formData.ownershipType === 'partnership'}
                              />
                            </div>

                            {/* Contact Information */}
                            <div className="mt-2">
                              <h5 className="text-xs font-medium text-gray-700 mb-2 border-t pt-2">Contact Information</h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block mb-1 text-xs font-medium text-gray-700">
                                    Mobile Number
                                  </label>
                                  <input
                                    type="tel"
                                    value={partner.mobile}
                                    onChange={(e) => handlePartnerChange(index, 'mobile', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="Mobile number"
                                  />
                                </div>
                                <div>
                                  <label className="block mb-1 text-xs font-medium text-gray-700">
                                    Alternative Number
                                  </label>
                                  <input
                                    type="tel"
                                    value={partner.alternativeNumber}
                                    onChange={(e) => handlePartnerChange(index, 'alternativeNumber', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="Alternative number"
                                  />
                                </div>
                                <div>
                                  <label className="block mb-1 text-xs font-medium text-gray-700">
                                    WhatsApp Number
                                  </label>
                                  <input
                                    type="tel"
                                    value={partner.whatsappNumber}
                                    onChange={(e) => handlePartnerChange(index, 'whatsappNumber', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="WhatsApp number"
                                  />
                                </div>
                                <div>
                                  <label className="block mb-1 text-xs font-medium text-gray-700">
                                    Email ID
                                  </label>
                                  <input
                                    type="email"
                                    value={partner.emailId}
                                    onChange={(e) => handlePartnerChange(index, 'emailId', e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    placeholder="Email address"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Address Information */}
                            <div className="mt-2">
                              <h5 className="text-xs font-medium text-gray-700 mb-2 border-t pt-2">Address Information</h5>
                              <div>
                                <label className="block mb-1 text-xs font-medium text-gray-700">
                                  Permanent Address
                                </label>
                                <textarea
                                  value={partner.permanentAddress}
                                  onChange={(e) => handlePartnerChange(index, 'permanentAddress', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md"
                                  placeholder="Permanent address"
                                  rows={2}
                                />
                              </div>
                              <div className="mt-2">
                                <label className="block mb-1 text-xs font-medium text-gray-700">
                                  Temporary Address
                                </label>
                                <textarea
                                  value={partner.temporaryAddress}
                                  onChange={(e) => handlePartnerChange(index, 'temporaryAddress', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md"
                                  placeholder="Temporary address"
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={addPartner}
                        className="mt-2 flex items-center text-blue-600 text-sm hover:text-blue-800"
                      >
                        <FontAwesomeIcon icon={faPlus} className="mr-1" />
                        Add Partner
                      </button>
                    </div>
                  )}

                  {/* Only show name and father's name for individual and organization */}
                  {formData.ownershipType !== 'partnership' && (
                    <>
                      <div className="mb-4">
                        <label className="block mb-1 text-sm font-medium text-gray-700">
                          {formData.ownershipType === 'organization' ? 'Organization Name' : 'Name'}
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          placeholder={formData.ownershipType === 'organization' ? "Organization's name" : "Owner's name"}
                          required={formData.propertyGroup !== 'govt'}
                        />
                      </div>
                      
                      {formData.ownershipType === 'individual' && (
                        <div className="mb-4">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Father's Name
                          </label>
                          <input
                            type="text"
                            name="fathersName"
                            value={formData.fathersName}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Father's name"
                            required={formData.propertyGroup !== 'govt'}
                          />
                        </div>
                      )}

                      {formData.ownershipType === 'organization' && (
                        <div className="mb-4">
                          <label className="block mb-1 text-sm font-medium text-gray-700">
                            Authority Name
                          </label>
                          <input
                            type="text"
                            name="authorityName"
                            value={formData.authorityName}
                            onChange={handleInputChange}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            placeholder="Authority name"
                            required={formData.propertyGroup !== 'govt'}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
                )}
              </div>

              {/* Contact Information - Only show for individual and organization */}
              {formData.ownershipType !== 'partnership' && formData.propertyGroup !== 'govt' && (
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Contact Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Mobile number"
                        required={formData.propertyGroup !== 'govt'}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Alternative Number
                      </label>
                      <input
                        type="tel"
                        name="alternativeNumber"
                        value={formData.alternativeNumber}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Alternative number"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        name="whatsappNumber"
                        value={formData.whatsappNumber}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="WhatsApp number"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Email ID
                      </label>
                      <input
                        type="email"
                        name="emailId"
                        value={formData.emailId}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Email address"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Address Information - Only show for individual and organization */}
              {formData.ownershipType !== 'partnership' && formData.propertyGroup !== 'govt' && (
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Address Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Permanent Address (ID Address)
                      </label>
                      <textarea
                        name="permanentAddress"
                        value={formData.permanentAddress}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Permanent address"
                        rows={2}
                        required={formData.propertyGroup !== 'govt'}
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">
                        Temporary Address (Residential Address)
                      </label>
                      <textarea
                        name="temporaryAddress"
                        value={formData.temporaryAddress}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Temporary address"
                        rows={2}
                      />
                    </div>

                  </div>
                </div>
              )}

            {/* Aadhar Information */}
            {formData.propertyGroup !== 'govt' && (
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Aadhar Information</h3>
                <div className="mb-4">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Aadhar Number
                  </label>
                  <input
                    type="text"
                    name="aadharNumber"
                    value={formData.aadharNumber}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    placeholder="XXXX-XXXX-XXXX"
                    maxLength={14}
                    required={formData.propertyGroup !== 'govt'}
                  />
                </div>

                {/* Aadhar Card Photos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {/* Front */}
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Aadhar Card (Front)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 h-32 flex flex-col items-center justify-center relative">
                      {formData.aadharFrontPhoto ? (
                        <img 
                          src={formData.aadharFrontPhoto} 
                          alt="Aadhar Front" 
                          className="max-h-28 max-w-full object-contain"
                        />
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-xl mb-2" />
                          <p className="text-xs text-gray-500">Click to upload front side</p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'aadharFrontPhoto')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Back */}
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Aadhar Card (Back)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 h-32 flex flex-col items-center justify-center relative">
                      {formData.aadharBackPhoto ? (
                        <img 
                          src={formData.aadharBackPhoto} 
                          alt="Aadhar Back" 
                          className="max-h-28 max-w-full object-contain"
                        />
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-xl mb-2" />
                          <p className="text-xs text-gray-500">Click to upload back side</p>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'aadharBackPhoto')}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Owner Photo - Moved below Aadhar Information */}
            {formData.propertyGroup !== 'govt' && (
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Owner Photo</h3>
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center mb-2 overflow-hidden relative">
                    {formData.ownerPhoto ? (
                      <img 
                        src={formData.ownerPhoto} 
                        alt="Owner" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FontAwesomeIcon icon={faImage} className="text-gray-400 text-3xl sm:text-4xl" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'ownerPhoto')}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => document.getElementById('ownerPhoto')?.click()}
                    className="text-sm text-blue-600 hover:underline flex items-center"
                  >
                    <FontAwesomeIcon icon={faUpload} className="mr-1" />
                    Upload Photo
                  </button>
                  <input
                    id="ownerPhoto"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'ownerPhoto')}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Document Type and Upload */}
            {formData.propertyGroup !== 'govt' && (
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Land Records</h3>
                {/* Document Type Selection */}
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Document Type
                  </label>
                  <select
                    name="documentType"
                    value={formData.documentType}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md mb-4"
                    required={formData.propertyGroup !== 'govt'}
                  >
                    <option value="govt.zammbandi">Govt. Zammbandi</option>
                    <option value="panchayat_pata">Panchayat Pata</option>
                    <option value="nagarpalika_pata">Nagarpalika Pata</option>
                    <option value="development_authority">Development Authority (JDA/BDA/KDA)</option>
                    <option value="govt_approved_society">Government Approved Society</option>
                    <option value="riico">Rajasthan State Industrial Development and Investment Corporation Ltd. (RIICO)</option>
                    <option value="land_convert_document">Government Land Category Convert Document</option>
                  </select>
                </div>

                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Government Land Record ({formData.documentType === 'govt.zammbandi' ? 'Jamabandi Photo' : 'Document Upload'})
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 h-40 flex flex-col items-center justify-center relative">
                  {formData.landRecordPhoto ? (
                    <img 
                      src={formData.landRecordPhoto} 
                      alt="Land Record" 
                      className="max-h-36 max-w-full object-contain"
                    />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-xl mb-2" />
                      <p className="text-sm text-gray-500">Click to upload land record document</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'landRecordPhoto')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Bhunaksha Image Section */}
            {formData.propertyGroup !== 'govt' && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-3 border-b pb-2">Bhunaksha Image</h3>
                <div className="mb-2">
                  <p className="text-sm text-gray-600">
                    Upload a clear image of the Bhunaksha (land map) for this property. This helps in verifying property boundaries.
                  </p>
                </div>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 h-40 flex flex-col items-center justify-center relative">
                  {formData.bhunakshaPhoto ? (
                    <img 
                      src={formData.bhunakshaPhoto} 
                      alt="Bhunaksha Image" 
                      className="max-h-36 max-w-full object-contain"
                    />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} className="text-gray-400 text-xl mb-2" />
                      <p className="text-sm text-gray-500">Click to upload Bhunaksha image</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'bhunakshaPhoto')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (fieldId) {
                    setEditMode(false); // Switch to view mode if it's an existing record
                  } else {
                    onClose(); // Just close if it's a new record
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 sm:px-6 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 sm:px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                <FontAwesomeIcon icon={faSave} />
                {isSubmitting ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FieldDetailsForm; 