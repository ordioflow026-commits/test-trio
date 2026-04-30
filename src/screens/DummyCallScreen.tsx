import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneOff, Video } from 'lucide-react';

export default function DummyCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const title = location.state?.title || 'Video Call';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-between py-20 px-6">
      <div className="flex flex-col items-center mt-10">
        <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <Video className="w-10 h-10 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{title} in progress...</h1>
        <p className="text-gray-400 text-lg">00:14</p>
      </div>

      <button
        onClick={() => navigate(-1)}
        className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 mb-10"
      >
        <PhoneOff className="w-8 h-8 text-white" />
      </button>
    </div>
  );
}
