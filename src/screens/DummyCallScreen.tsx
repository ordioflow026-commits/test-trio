import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Users, SwitchCamera, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';

export default function DummyCallScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const title = location.state?.title || 'Video Call';
  const participants = location.state?.participants || [];
  const roomId = location.state?.roomId || 'unknown';
  const isVideoMode = location.state?.isVideo ?? true;
  const contactName = location.state?.contactName || 'Unknown Contact';
  const initials = location.state?.initials || '';
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const rtcPeerConnection = useRef<RTCPeerConnection | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLocalLarge, setIsLocalLarge] = useState(false);
  const [connectionState, setConnectionState] = useState('Connecting...');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, []);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let channel = supabase.channel(roomId);

    async function setupStream() {
      try {
        if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints: MediaStreamConstraints = isVideoMode 
          ? { video: { facingMode }, audio: true }
          : { video: false, audio: true };

        const userMedia = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = userMedia;
        setStream(userMedia);
        
        if (localVideoRef.current && isVideoMode) {
          localVideoRef.current.srcObject = userMedia;
        }

        // WebRTC Setup
        const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const peerConnection = new RTCPeerConnection(configuration);
        rtcPeerConnection.current = peerConnection;

        userMedia.getTracks().forEach(track => {
          peerConnection.addTrack(track, userMedia);
        });

        peerConnection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current && isVideoMode) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setConnectionState('Connected');
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { type: 'candidate', candidate: event.candidate, senderId: user?.id }
            });
          }
        };

        // Supabase Realtime Signaling
        channel.on('broadcast', { event: 'webrtc_signal' }, async ({ payload }) => {
          if (payload.senderId === user?.id) return; // ignore our own signals

          if (payload.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { type: 'answer', answer, senderId: user?.id }
            });
          } else if (payload.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } else if (payload.type === 'candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        }).subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            // we create an offer if we joined
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            channel.send({
              type: 'broadcast',
              event: 'webrtc_signal',
              payload: { type: 'offer', offer, senderId: user?.id }
            });
          }
        });

      } catch (err) {
        console.error("Error accessing media devices.", err);
      }
    }
    setupStream();

    return () => {
      supabase.removeChannel(channel);
      if (rtcPeerConnection.current) rtcPeerConnection.current.close();
      if (currentStream) currentStream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode, roomId, isVideoMode]); // Re-run when facing mode changes

  useEffect(() => {
    const timerInt = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timerInt);
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-hidden">
      {/* Background and PIP Layout */}
      <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
        {isVideoMode ? (
          <>
            {/* The Local Video Feed */}
            <div 
              className={`transition-all duration-500 ease-in-out cursor-pointer flex items-center justify-center bg-black ${
                isLocalLarge 
                  ? "absolute inset-0 z-0" 
                  : "absolute top-28 right-6 w-32 bottom-auto left-auto h-48 rounded-2xl overflow-hidden border-2 border-slate-600 shadow-2xl z-20 hover:scale-105"
              }`}
              onClick={(e) => {
                // If it's small, clicking it makes it large (swaps it)
                if (!isLocalLarge) {
                  e.stopPropagation();
                  setIsLocalLarge(true);
                } else {
                  // If it's large, clicking the large screen can also swap it for ease of use
                  setIsLocalLarge(false);
                }
              }}
            >
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <div className={`bg-slate-700 rounded-full flex items-center justify-center ${isLocalLarge ? "w-32 h-32 shadow-lg" : "w-16 h-16"}`}>
                    <VideoIcon className={`text-slate-500 ${isLocalLarge ? "w-12 h-12" : "w-6 h-6"}`} />
                  </div>
                </div>
              )}
            </div>

            {/* The Remote Dummy Feed */}
            <div 
              className={`transition-all duration-500 ease-in-out cursor-pointer flex flex-col items-center justify-center bg-slate-800 ${
                !isLocalLarge 
                  ? "absolute inset-0 z-0" 
                  : "absolute top-28 right-6 w-32 bottom-auto left-auto h-48 rounded-2xl overflow-hidden border-2 border-slate-600 shadow-2xl z-20 hover:scale-105"
              }`}
              onClick={(e) => {
                // If it's small, clicking it makes it large (swaps it)
                if (isLocalLarge) {
                  e.stopPropagation();
                  setIsLocalLarge(false);
                } else {
                  // If it's large, clicking the large screen can also swap it
                  setIsLocalLarge(true);
                }
              }}
            >
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover absolute inset-0 z-0 ${remoteStream ? 'opacity-100' : 'opacity-0'}`} 
              />
              
              {!remoteStream && (
                <div className="z-10 flex flex-col items-center">
                  <div className={`bg-slate-700 rounded-full flex items-center justify-center shadow-[#00a884] animate-pulse ${
                    !isLocalLarge ? "w-48 h-48 mb-6 shadow-[0_0_80px_rgba(0,168,132,0.6)]" : "w-16 h-16 mb-2 shadow-[0_0_30px_rgba(0,168,132,0.4)]"
                  }`}>
                    <span className={`text-white font-bold tracking-tighter select-none ${!isLocalLarge ? "text-7xl" : "text-2xl"}`}>{initials}</span> 
                  </div>
                  {!isLocalLarge && <h2 className="text-3xl font-bold text-white mb-2">{contactName}</h2>}
                  {!isLocalLarge ? (
                    <p className="text-slate-400 text-lg flex items-center gap-2">
                       {!isOnline ? <><WifiOff className="w-5 h-5"/> Waiting for Network</> : connectionState}
                    </p>
                  ) : (
                    <span className="text-xs text-white truncate px-2 w-full text-center">{contactName}</span>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Voice Mode ONLY */
          <div className="flex flex-col items-center mt-20 z-10 w-full px-6 text-center">
            <div className={`w-40 h-40 bg-slate-700/80 rounded-full flex items-center justify-center mb-6 shadow-[#00a884] ${connectionState === 'Connected' ? 'shadow-[0_0_20px_rgba(0,168,132,0.6)]' : 'shadow-[0_0_60px_rgba(0,168,132,0.6)] animate-pulse'}`}>
               <span className="text-6xl text-white font-bold tracking-tighter cursor-default select-none">{initials}</span> 
            </div>
            <h2 className="text-4xl font-bold text-white mb-2 truncate max-w-full leading-tight">{contactName}</h2>
            <p className="text-[#00a884] text-xl font-medium tracking-wide flex items-center gap-2 justify-center">
              {!isOnline ? <><WifiOff className="w-5 h-5"/> Waiting for Network</> : connectionState}
            </p>
          </div>
        )}
      </div>

      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex flex-col items-center bg-gradient-to-b from-black/80 to-transparent pt-12">
        {isVideoMode && <h1 className="text-2xl font-bold text-white tracking-wide">{title}</h1>}
        <p className="text-xl text-slate-300 font-mono mt-2">{formatTime(elapsedTime)}</p>
        <div className="flex gap-2 mt-4">
          <span className="bg-slate-800/60 backdrop-blur text-xs px-3 py-1 rounded-full text-slate-300 border border-slate-700">Room: {roomId}</span>
          <span className="bg-slate-800/60 backdrop-blur text-xs px-3 py-1 rounded-full text-slate-300 border border-slate-700 flex items-center gap-1">
             <Users className="w-3 h-3" /> {participants.length || 1}
          </span>
        </div>
      </div>

      {/* Floating Remote Participants placeholders */}
      {location.state?.isGroup && participants.length > 0 && (
         <div className="absolute top-36 left-4 z-10 flex flex-col gap-3">
             {participants.slice(0, 3).map((p: any, i: number) => (
               <div key={i} className="w-24 h-32 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-600 shadow-xl relative animate-in fade-in slide-in-from-left">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-slate-500 font-semibold text-xs text-center px-2 truncate w-full">{p || 'Waiting...'}</span>
                  </div>
               </div>
             ))}
             {participants.length > 3 && (
               <div className="w-24 h-12 bg-slate-800 rounded-xl border-2 border-slate-600 flex items-center justify-center">
                 <span className="text-white text-xs font-bold">+{participants.length - 3} more</span>
               </div>
             )}
         </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-8 z-10 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex justify-center items-center gap-6 max-w-sm mx-auto">
          
          <button 
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isAudioMuted ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white hover:bg-slate-600 backdrop-blur'}`}
          >
            {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button
            onClick={endCall}
            className="w-20 h-20 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-transform active:scale-95"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>

          {isVideoMode && (
            <>
              <button 
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white hover:bg-slate-600 backdrop-blur'}`}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
              </button>

              <button 
                onClick={flipCamera}
                className="w-14 h-14 rounded-full flex items-center justify-center bg-slate-700/80 text-white hover:bg-slate-600 transition-all backdrop-blur"
              >
                <SwitchCamera className="w-6 h-6" />
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
