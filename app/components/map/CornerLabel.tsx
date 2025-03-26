'use client';

import React from 'react';
import { Marker } from '@react-google-maps/api';
import { PolygonPoint } from './types';

interface CornerLabelProps {
  position: PolygonPoint;
  text: string;
}

const CornerLabel: React.FC<CornerLabelProps> = ({ position, text }) => {
  return (
    <Marker
      position={position}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
        fillOpacity: 0,
        strokeOpacity: 0,
      }}
      label={{
        text: text,
        color: '#000000',
        fontSize: '16px',
        fontWeight: 'bold',
        className: 'corner-label',
      }}
      zIndex={1001}
    />
  );
};

export default CornerLabel; 