import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneOff, Video, Phone, Mic, MicOff, VideoOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

export default function DummyCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const title = location.state?.title || 'Unknown';
  const type = location.state?.type || 'video'; // 'video' | 'audio'
  const count = location.state?.count || 1;
  const targetId = location.state?.targetId;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hardware Access
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const initMedia = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ 
          video: type === 'video', 
          audio: true 
        });
        activeStream = ms;
        setStream(ms);
        if (videoRef.current && type === 'video') {
          videoRef.current.srcObject = ms;
        }

        // Send calling signal if targeting a single person
        if (targetId && user) {
           supabase.channel(`signal_${targetId}`).send({
             type: 'broadcast',
             event: 'incoming_call',
             payload: {
               fromUserId: user.id,
               fromName: user.fullName || 'Someone',
               type,
               isVideo: type === 'video'
             }
           });
        }
      } catch (err) {
        console.error("Failed to access media devices:", err);
      }
    };
    
    initMedia();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [type, targetId, user]);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
      setMicMuted(!stream.getAudioTracks()[0].enabled);
    }
  };

  const toggleVideo = () => {
    if (stream && type === 'video') {
      stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
      setVideoOff(!stream.getVideoTracks()[0].enabled);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-between overflow-hidden relative animate-in fade-in zoom-in-95 duration-200" dir="ltr">
      
      {/* Target Info */}
      <div className="absolute top-16 left-0 w-full flex flex-col items-center z-20 pointer-events-none drop-shadow-md">
         <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Calling...</h2>
         <p className="text-lg text-slate-300 font-medium">
           {title} {count > 1 ? `(${count} People)` : ''}
         </p>
      </div>

      {type === 'video' ? (
        <div className="absolute inset-0 z-0 bg-slate-900">
           {/* Local Video Stream */}
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className={`w-full h-full object-cover transition-opacity duration-300 ${videoOff ? 'opacity-0' : 'opacity-100'}`}
           />
           {videoOff && (
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700">
                   <VideoOff className="w-10 h-10 text-slate-500" />
                 </div>
              </div>
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-transparent to-[#0B1120]/60 pointer-events-none" />
        </div>
      ) : (
        <div className="flex-1 w-full flex flex-col items-center justify-center relative z-10">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00b4d8] rounded-full blur-xl opacity-20 animate-pulse" />
            <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center border-2 border-[#00b4d8] shadow-[0_0_40px_rgba(0,180,216,0.5)] z-10 relative">
              <Phone className="w-12 h-12 text-[#00b4d8]" fill="currentColor" />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-20 w-full pb-10 flex flex-col items-center gap-6 mt-auto">
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${micMuted ? 'bg-slate-700/80 text-white' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}
          >
            {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.5)] ring-4 ring-red-500/30 active:scale-95"
          >
            <PhoneOff className="w-8 h-8 text-white" fill="currentColor" />
          </button>

          {type === 'video' ? (
             <button 
               onClick={toggleVideo}
               className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${videoOff ? 'bg-slate-700/80 text-white' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}
             >
               {videoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
             </button>
          ) : (
            <div className="w-14 h-14" /> // Spacer
          )}
        </div>
      </div>
    </div>
  );
}
