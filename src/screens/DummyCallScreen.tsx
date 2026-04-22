import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneOff, Video, Phone } from 'lucide-react';

export default function DummyCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const title = location.state?.title || 'Unknown';
  const type = location.state?.type || 'video'; // 'video' | 'audio'
  const count = location.state?.count || 1;

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-between py-24 px-6 animate-in fade-in zoom-in-95 duration-200">
      
      <div className="flex flex-col items-center gap-6 mt-10">
        <div className="relative">
          <div className="absolute inset-0 bg-[#00b4d8] rounded-full blur-xl opacity-20 animate-pulse" />
          <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center border-2 border-[#00b4d8] shadow-[0_0_30px_rgba(0,180,216,0.5)] z-10 relative">
            {type === 'video' ? (
              <Video className="w-12 h-12 text-[#00b4d8]" />
            ) : (
              <Phone className="w-12 h-12 text-[#00b4d8]" fill="currentColor" />
            )}
          </div>
        </div>
        <div className="text-center">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Calling...</h2>
            <p className="text-lg text-slate-300 font-medium">
              {title} {count > 1 ? `(${count} People)` : ''}
            </p>
        </div>
      </div>

      <button
        onClick={() => navigate(-1)}
        className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95 mb-10"
      >
        <PhoneOff className="w-8 h-8 text-white" fill="currentColor" />
      </button>
    </div>
  );
}
