'use client';

import { NextPage } from 'next';
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppSelector, useAppDispatch } from './redux/hooks';
import { selectTotalArea, updateTotalArea } from './redux/features/mapSlice';

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
  const totalArea = useAppSelector(selectTotalArea);
  const dispatch = useAppDispatch();

  const handleAreaUpdate = useCallback((newArea: number) => {
    dispatch(updateTotalArea(newArea));
  }, [dispatch]);

  return (
    <main className="min-h-screen" suppressHydrationWarning>
      <MapComponent onAreaUpdate={handleAreaUpdate} />
      {totalArea > 0 && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg">
          <p>Total Area: {totalArea.toFixed(2)} hectares</p>
        </div>
      )}
    </main>
  );
};

export default Home;
