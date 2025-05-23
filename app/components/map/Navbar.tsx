'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFilter, 
  faSquareCheck,
  faTimes,
  faUser,
  faSignOutAlt,
  faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import SearchBox from './SearchBox';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  onPlaceSelect: (location: google.maps.LatLng) => void;
  isDrawingMode?: boolean;
  onCancelDrawing?: () => void;
  onFinishDrawing?: () => void;
  canFinishDrawing?: boolean;
  onLogin?: () => void;
}

const Navbar = ({ 
  onPlaceSelect, 
  isDrawingMode = false, 
  onCancelDrawing, 
  onFinishDrawing,
  canFinishDrawing = false,
  onLogin = () => {}
}: NavbarProps) => {
  const { user, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleAuthAction = async () => {
    if (user) {
      setShowDropdown(!showDropdown);
    } else {
      try {
        await login();
        // No need to handle the returned user here
        // If login succeeds, the auth state will update automatically
        // If the user closes the popup, we just continue silently
      } catch (error: any) {
        // This will only catch unexpected errors, not user cancellations
        console.error('Login error:', error);
        
        // Display more specific error messages for production deployment issues
        if (error.code === 'auth/unauthorized-domain') {
          alert('Login failed: This domain is not authorized. Please refer to the VERCEL_DEPLOYMENT.md guide for instructions on adding this domain to Firebase.');
        } else if (error.code === 'auth/configuration-not-found') {
          alert('Login failed: Firebase configuration issue. Environment variables may be missing in your Vercel deployment. Please refer to the VERCEL_DEPLOYMENT.md guide.');
        } else if (error.code === 'auth/internal-error') {
          alert('Login failed: Firebase authentication service error. Please check your Vercel environment variables and Firebase configuration.');
        } else if (error.message && error.message.includes('Firebase configuration missing')) {
          alert('Login failed: Firebase configuration is missing. Please check your Vercel environment variables following the VERCEL_DEPLOYMENT.md guide.');
        } else {
          alert(`Login failed: ${error.message || 'Unknown error occurred'}. Please try again later.`);
        }
      }
    }
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await logout();
      setShowDropdown(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="bg-gradient-to-r from-[#DAA520] to-[#B8860B] text-white px-2 sm:px-4 py-2 flex items-center h-12 shadow-md w-full overflow-visible">
      {!isDrawingMode ? (
        <>
          <div className="flex-1 max-w-[70%] sm:max-w-[75%] md:max-w-[80%] mr-1 sm:mr-2">
      <SearchBox onPlaceSelect={onPlaceSelect} />
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <button className="hover:bg-white/20 p-1 sm:p-2 rounded transition-colors">
              <FontAwesomeIcon icon={faFilter} className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button className="hover:bg-white/20 p-1 sm:p-2 rounded transition-colors">
              <FontAwesomeIcon icon={faSquareCheck} className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            
            <div className="relative">
              <button 
                onClick={handleAuthAction}
                className={`${user ? 'bg-white/20' : 'bg-white/10 hover:bg-white/30'} py-1 px-2 sm:px-3 rounded transition-colors flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2`}
              >
                {user ? (
                  <>
                    {user.photoURL ? (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || 'User'} 
                        className="h-5 w-5 sm:h-6 sm:w-6 rounded-full" 
                      />
                    ) : (
                      <FontAwesomeIcon icon={faUser} className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    <span className="text-xs sm:text-sm font-medium truncate max-w-[50px] sm:max-w-[80px]">
                      {user.displayName?.split(' ')[0] || 'User'}
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="h-2 w-2 sm:h-3 sm:w-3 ml-1" />
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUser} className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm font-medium">Login</span>
                  </>
                )}
              </button>
              
              {showDropdown && user && (
                <div className="absolute right-0 mt-1 bg-white text-gray-800 rounded shadow-lg py-1 min-w-[160px] z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-semibold truncate">
                      {user.displayName || user.email || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {user.email}
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        // Drawing mode banner (yellow color comes from parent gradient)
        <div className="w-full flex justify-between items-center">
          <button
            onClick={onCancelDrawing}
            className="p-1 text-white hover:bg-white/20 rounded transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xl" />
        </button>
          <div className="flex-1 text-right">
            <button
              onClick={onFinishDrawing}
              disabled={!canFinishDrawing}
              className={`py-1 px-4 text-white transition-colors ${
                canFinishDrawing
                  ? "hover:bg-white/20 rounded"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="font-medium">SAVE</span>
        </button>
      </div>
        </div>
      )}
    </div>
  );
};

export default Navbar; 