'use client';

interface AreaDisplayProps {
  area: number;
}

const AreaDisplay = ({ area }: AreaDisplayProps) => {
  if (area <= 0) return null;

  return (
    <div className="hidden absolute top-3 right-3 z-50 bg-black bg-opacity-70 text-white p-3 rounded-lg shadow-lg">
      <div className="text-sm font-medium hidden">Area: {area.toFixed(2)} hectares</div>
    </div>
  );
};

export default AreaDisplay; 