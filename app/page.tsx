'use client';

import { NextPage } from 'next';
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import MapComponent with no SSR
const MapComponent = dynamic(
  () => import('./components/map/MapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">Initializing map...</div>
      </div>
    )
  }
);

const Home: NextPage = () => {
  const [area, setArea] = useState<number>(0);

  const handleAreaUpdate = useCallback((newArea: number) => {
    setArea(newArea);
  }, []);

  return (
    <main className="min-h-screen" suppressHydrationWarning>
      <MapComponent onAreaUpdate={handleAreaUpdate} />
      {area > 0 && (
        <div className="fixed hidden bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg">
          <p>Total Area: {area.toFixed(2)} hectares</p>
        </div>
      )}
    </main>
  );
};

export default Home;
