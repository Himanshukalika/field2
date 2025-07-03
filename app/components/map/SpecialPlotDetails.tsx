'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSquare, faLocationArrow, faTree, faRoad, faBuilding, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';

interface SpecialPlotDetailsProps {
  specialPlotType: string;
  isOpen: boolean;
  onClose: () => void;
}

const SpecialPlotDetails: React.FC<SpecialPlotDetailsProps> = ({
  specialPlotType,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  // Define plot type details with descriptions and visual representations
  const plotTypeDetails = {
    corner: {
      title: 'Corner Plot',
      description: 'A plot located at the intersection of two roads, providing better visibility and accessibility. Corner plots typically have road access from two sides.',
      advantages: [
        'Better visibility and accessibility',
        'Two-side road access',
        'Typically commands higher market value',
        'Better ventilation and natural light',
        'More design flexibility for construction'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-4 bg-gray-400 top-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 left-0"></div>
          <div className="w-3/4 h-3/4 bg-blue-200 border border-blue-400 rounded-md relative">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute -top-2 -left-2 text-red-500 text-lg" />
            <div className="absolute -top-6 -left-6 text-xs font-medium text-gray-700">Corner Plot</div>
          </div>
        </div>
      )
    },
    park_facing: {
      title: 'Park Facing',
      description: 'A plot that faces or is adjacent to a park or green space, offering better views, fresh air, and recreational opportunities nearby.',
      advantages: [
        'Scenic views of green space',
        'Better air quality and ventilation',
        'Access to recreational facilities',
        'Typically higher property value',
        'Less noise compared to road-facing plots'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-16 bg-green-200 bottom-0 flex items-center justify-center">
            <FontAwesomeIcon icon={faTree} className="text-green-600 mx-2" />
            <FontAwesomeIcon icon={faTree} className="text-green-700 mx-2" />
            <FontAwesomeIcon icon={faTree} className="text-green-600 mx-2" />
          </div>
          <div className="w-3/4 h-1/2 bg-blue-200 border border-blue-400 rounded-md relative">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 text-red-500 text-lg" />
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Park Facing Plot</div>
          </div>
        </div>
      )
    },
    double_corner: {
      title: 'Double Corner',
      description: 'A plot located at the intersection of three roads, providing exceptional visibility and accessibility with road access from three sides.',
      advantages: [
        'Premium visibility from multiple directions',
        'Three-side road access',
        'Significantly higher market value',
        'Maximum ventilation and natural light',
        'Excellent for commercial properties'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-4 bg-gray-400 top-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 left-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 right-0"></div>
          <div className="w-3/4 h-3/4 bg-blue-200 border border-blue-400 rounded-md relative">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute -top-2 -left-2 text-red-500 text-lg" />
            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute -top-2 -right-2 text-red-500 text-lg" />
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Double Corner Plot</div>
          </div>
        </div>
      )
    },
    two_side_open: {
      title: 'Two Side Open',
      description: 'A plot with two adjacent sides open to roads or passages, providing good ventilation, natural light, and accessibility.',
      advantages: [
        'Better ventilation and natural light',
        'Two-side road/passage access',
        'Higher value than regular plots',
        'More design options for construction',
        'Better visibility for commercial use'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-4 bg-gray-400 top-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 left-0"></div>
          <div className="w-3/4 h-3/4 bg-blue-200 border border-blue-400 rounded-md relative">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Two Side Open Plot</div>
          </div>
        </div>
      )
    },
    three_side_open: {
      title: 'Three Side Open',
      description: 'A premium plot with three sides open to roads or passages, offering excellent ventilation, natural light, and maximum accessibility.',
      advantages: [
        'Maximum ventilation and natural light',
        'Three-side access',
        'Premium property value',
        'Excellent for both residential and commercial use',
        'Multiple entrance options'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-4 bg-gray-400 top-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 left-0"></div>
          <div className="absolute w-4 h-full bg-gray-400 right-0"></div>
          <div className="w-3/4 h-3/4 bg-blue-200 border border-blue-400 rounded-md relative">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Three Side Open Plot</div>
          </div>
        </div>
      )
    },
    main_road_facing: {
      title: 'Main Road Facing',
      description: 'A plot that directly faces a main road, offering excellent visibility, accessibility, and commercial potential.',
      advantages: [
        'High visibility to passing traffic',
        'Easy accessibility',
        'Excellent for commercial properties',
        'Higher market value',
        'Better transportation connectivity'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-full h-12 bg-gray-400 bottom-0 flex items-center justify-center">
            <div className="w-4/5 h-1 bg-white"></div>
          </div>
          <div className="w-3/4 h-3/5 bg-blue-200 border border-blue-400 rounded-md relative">
            <FontAwesomeIcon icon={faMapMarkerAlt} className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 text-red-500 text-lg" />
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Main Road Facing Plot</div>
          </div>
        </div>
      )
    },
    cul_de_sac: {
      title: 'Cul-de-sac Plot',
      description: 'A plot located at the end of a dead-end street that typically forms a circular turnaround area, offering privacy and reduced traffic.',
      advantages: [
        'Enhanced privacy and security',
        'Less traffic and noise',
        'Safer for families with children',
        'Often has a wider frontage',
        'Community-oriented location'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center relative">
          <div className="absolute w-1/4 h-12 bg-gray-400 bottom-0 left-1/2 transform -translate-x-1/2"></div>
          <div className="w-3/4 h-3/4 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center">
            <div className="w-3/5 h-3/5 bg-blue-200 border border-blue-400 rounded-md relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700">Cul-de-sac Plot</div>
            </div>
          </div>
        </div>
      )
    },
    other: {
      title: 'Other Special Plot',
      description: 'A plot with unique characteristics or advantages not covered by standard categories.',
      advantages: [
        'Unique features specific to the property',
        'May have special zoning or usage rights',
        'Could have historical or cultural significance',
        'May offer unique views or access',
        'Potentially distinctive investment opportunity'
      ],
      visual: (
        <div className="w-full h-40 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center">
          <div className="w-3/4 h-3/4 bg-blue-200 border border-blue-400 rounded-md flex items-center justify-center">
            <div className="text-blue-600 font-medium">Custom Plot Features</div>
          </div>
        </div>
      )
    }
  };

  // Get the details for the current plot type
  const details = plotTypeDetails[specialPlotType as keyof typeof plotTypeDetails] || plotTypeDetails.other;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-semibold">{details.title}</h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-blue-700 rounded-full p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Visual Representation */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Visual Representation</h3>
            {details.visual}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Description</h3>
            <p className="text-gray-700">{details.description}</p>
          </div>

          {/* Advantages */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Advantages</h3>
            <ul className="list-disc pl-5 space-y-1">
              {details.advantages.map((advantage, index) => (
                <li key={index} className="text-gray-700">{advantage}</li>
              ))}
            </ul>
          </div>

          {/* Market Value Impact */}
          <div className="mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-3">Market Value Impact</h3>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <p className="text-gray-700">
                {specialPlotType === 'corner' && 'Corner plots typically command a 10-15% premium over regular plots due to better visibility and dual access.'}
                {specialPlotType === 'park_facing' && 'Park facing plots often sell for 15-20% more than similar properties without park views due to better aesthetics and quality of life.'}
                {specialPlotType === 'double_corner' && 'Double corner plots are rare and highly valued, often commanding 20-30% premium over regular plots.'}
                {specialPlotType === 'two_side_open' && 'Two side open plots typically sell for 8-12% more than regular plots due to better ventilation and accessibility.'}
                {specialPlotType === 'three_side_open' && 'Three side open plots are premium properties that can command 15-25% higher prices than standard plots.'}
                {specialPlotType === 'main_road_facing' && 'Main road facing plots have excellent commercial potential and typically sell for 15-25% more than interior plots.'}
                {specialPlotType === 'cul_de_sac' && 'Cul-de-sac plots offer privacy and safety, often selling for 5-10% more than similar plots on through streets.'}
                {specialPlotType === 'other' && 'The value impact of this special plot depends on its unique characteristics and local market conditions.'}
              </p>
            </div>
          </div>

          {/* Construction Considerations */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-3">Construction Considerations</h3>
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <p className="text-gray-700">
                {specialPlotType === 'corner' && 'Corner plots may require additional setbacks on both road-facing sides. They offer more design flexibility but may have higher fencing costs.'}
                {specialPlotType === 'park_facing' && 'Park facing plots should maximize views with larger windows and balconies facing the park. Consider privacy features for ground floor.'}
                {specialPlotType === 'double_corner' && 'Double corner plots require careful planning for multiple road-facing sides. Consider multiple entrances and strategic placement of utilities.'}
                {specialPlotType === 'two_side_open' && 'Two side open plots allow for cross-ventilation and multiple access points. Design should take advantage of both open sides.'}
                {specialPlotType === 'three_side_open' && 'Three side open plots offer maximum design flexibility. Consider multiple entrances and windows on all open sides for natural light.'}
                {specialPlotType === 'main_road_facing' && 'Main road facing plots may need noise reduction features. Consider setbacks, traffic patterns, and visibility for entrances.'}
                {specialPlotType === 'cul_de_sac' && 'Cul-de-sac plots often have wider frontage but less depth. Design should account for the curved front boundary and maximize privacy.'}
                {specialPlotType === 'other' && 'Construction considerations will depend on the specific characteristics of this special plot.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpecialPlotDetails; 