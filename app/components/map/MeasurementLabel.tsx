'use client';

import React, { useState } from 'react';
import { OverlayView, Marker } from '@react-google-maps/api';
import { PolygonPoint } from './types';

interface MeasurementLabelProps {
  position: PolygonPoint;
  text: string;
  isEditing: boolean;
  onEditStart: () => void;
  onLengthChange: (newLength: number) => void;
  onCancel: () => void;
}

const MeasurementLabel: React.FC<MeasurementLabelProps> = ({
  position,
  text,
  isEditing,
  onEditStart,
  onLengthChange,
  onCancel
}) => {
  const [inputValue, setInputValue] = useState(text.replace(' m', '').replace(' km', ''));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const newLength = parseFloat(inputValue);
      if (!isNaN(newLength)) {
        onLengthChange(newLength);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleClick = (e: google.maps.MapMouseEvent) => {
    e.domEvent.stopPropagation();
    if (!isEditing) {
      onEditStart();
    }
  };

  if (isEditing) {
    return (
      <OverlayView
        position={position}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      >
        <div 
          className="measurement-input-container"
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            padding: '4px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="measurement-input"
            autoFocus
            style={{
              width: '70px',
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          />
          <span style={{ marginLeft: '4px', fontSize: '14px' }}>m</span>
        </div>
      </OverlayView>
    );
  }

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
        fontSize: '14px',
        fontWeight: 'bold',
        className: 'measurement-label',
      }}
      onClick={handleClick}
      options={{
        clickable: true
      }}
    />
  );
};

export default MeasurementLabel; 