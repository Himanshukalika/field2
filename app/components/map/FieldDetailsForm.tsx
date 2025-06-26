'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUpload, faImage, faCheck, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  ownershipType: string;
  authorityName: string;
  partners: Partner[];
  colonyName: string;
  plotNumber: string;
  blockNumber: string;
  roadNumber: string;
  galiNumber: string;
  isCornerPlot: boolean;
  documentType: string;
  dlcRate: string;
  dlcRateUnit: string;
  roadFront: string;
  roadFrontUnit: string;
  propertyArea: string;
  propertyAreaUnit: string;
  propertySideLength: string;
  northSideLength: string;
  southSideLength: string;
  eastSideLength: string;
  westSideLength: string;
  sideLengthUnit: string;

  mobile: string;
  alternativeNumber: string;
  emailId: string;
  whatsappNumber: string;
  aadharNumber: string;
  aadharFrontPhoto: string | null;
  aadharBackPhoto: string | null;
  landRecordPhoto: string | null;
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
    propertyAddress: fieldName || '',
    pincode: '',
    propertyGroup: 'agriculture',
    govtPropertyType: '',
    ownershipType: 'individual',
    authorityName: '',
    partners: [{ name: '', fathersName: '', share: '', mobile: '', alternativeNumber: '', emailId: '', whatsappNumber: '', permanentAddress: '', temporaryAddress: '' }],
    colonyName: '',
    plotNumber: '',
    blockNumber: '',
    roadNumber: '',
    galiNumber: '',
    isCornerPlot: false,
    documentType: 'govt.zammbandi',
    dlcRate: '',
    dlcRateUnit: 'sqm',
    roadFront: '',
    roadFrontUnit: 'running_foot',
    propertyArea: '',
    propertyAreaUnit: 'square_meter',
    propertySideLength: '',
    northSideLength: '',
    southSideLength: '',
    eastSideLength: '',
    westSideLength: '',
    sideLengthUnit: 'm',
    mobile: '',
    alternativeNumber: '',
    emailId: '',
    whatsappNumber: '',
    aadharNumber: '',
    aadharFrontPhoto: null,
    aadharBackPhoto: null,
    landRecordPhoto: null,
    fieldId: fieldId
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);

  // Load existing field details when the form is opened
  useEffect(() => {
    const loadFieldDetails = async () => {
      if (fieldId && isOpen) {
        setIsLoading(true);
        try {
          const details = await getFieldOwnerDetails(fieldId);
          
          // Format center coordinate for display if available
          let propertyAddressWithCoordinates = fieldName || '';
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
            
            // Format the center coordinate
            const coordText = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
            propertyAddressWithCoordinates = `${fieldName || ''}\nCenter Coordinate: ${coordText}`;
          }
          
          if (details) {
            setFormData({
              ...details,
              propertyAddress: details.propertyAddress || propertyAddressWithCoordinates,
              fieldId: fieldId
            });
          } else {
            setFormData(prev => ({
              ...prev,
              propertyAddress: propertyAddressWithCoordinates,
              fieldId: fieldId
            }));
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
            
            // Format the center coordinate
            const coordText = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
            const propertyAddressWithCoordinates = `${fieldName || ''}\nCenter Coordinate: ${coordText}`;
            
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
          
          // Format the center coordinate
          const coordText = `(${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`;
          const propertyAddressWithCoordinates = `${fieldName || ''}\nCenter Coordinate: ${coordText}`;
          
          setFormData(prev => ({
            ...prev,
            propertyAddress: propertyAddressWithCoordinates
          }));
        }
        setIsLoading(false);
      }
    };

    loadFieldDetails();
  }, [fieldId, isOpen, fieldName, fieldCoordinates]);

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
    } else {
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
    field: 'ownerPhoto' | 'aadharFrontPhoto' | 'aadharBackPhoto' | 'landRecordPhoto'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSave(formData);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error saving field details:", error);
      alert("Failed to save field details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] overflow-y-auto p-0 sm:p-2 md:p-6">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative my-2 mx-auto"
      >
        {/* Header */}
        <div className="bg-blue-600 p-3 sm:p-4 text-white flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate">{fieldName}</h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-full p-2 flex-shrink-0"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
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
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Owner Photo */}
                <div className="flex flex-col items-center">
                  <label className="block mb-2 text-sm font-medium text-gray-700 self-start">
                    Owner Photo
                  </label>
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

                {/* Basic Info */}
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
                          required
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
                            required
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
                            required
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
                
              </div>

              {/* Contact Information - Only show for individual and organization */}
              {formData.ownershipType !== 'partnership' && (
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
                        required
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
              {formData.ownershipType !== 'partnership' && (
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
                        required
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

              {/* Property Measurements Section */}
              <div>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Property Details</h3>
                  
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
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Property Address (Polygon Location)
                    </label>
                    <textarea
                      name="propertyAddress"
                      value={formData.propertyAddress}
                      onChange={handleInputChange}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Property address"
                      rows={2}
                      required
                    />
                  </div>
                  
                  {/* Special/Corner Plot - Available for all property types */}
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
                  
                  {/* DLC Rate */}
                  
                  
                  {/* Road Front */}
                  <div className="mb-4">
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Road Front
                    </label>
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

                  
                  

                </div>
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
              </div>
              

              {/* Aadhar Information */}
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
                    required
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

              {/* Document Type and Upload */}
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
                    required
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
            </div>

            {/* Submit Button */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 sm:px-6 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 sm:px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                disabled={isSubmitting}
              >
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