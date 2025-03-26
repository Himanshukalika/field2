'use client';

interface FieldMeasurementsProps {
  area: number;
  perimeter: number;
  measurements?: {
    length: number;
    width: number;
  }[];
  isMovingPoint?: boolean;
  selectedPoint?: number;
  tempPoints?: { lat: number; lng: number }[];
  field?: { points: { lat: number; lng: number }[] };
}

const FieldMeasurements = ({ area, perimeter, measurements }: FieldMeasurementsProps) => {
  return (
    <div className="absolute top-15 left-3 z-50  gap-4 hidden ">
      <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg shadow-lg">
        <div className="text-sm font-medium">Area: {area.toFixed(2)} a</div>
      </div>
      <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg shadow-lg">
        <div className="text-sm font-medium">Perimeter: {perimeter.toFixed(2)} m</div>
      </div> 
      {measurements?.map((measurement, index) => (
        <div key={index} className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="text-sm font-medium">{measurement.length.toFixed(1)} m</div>
        </div>
      ))}
    </div>
  );
};

export default FieldMeasurements; 