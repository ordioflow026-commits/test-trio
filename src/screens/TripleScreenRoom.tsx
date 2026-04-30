import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, LogOut, Loader2, Video, Lock, Unlock, Upload } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media' | 'camera';

interface SlotData {
  type: ContentType;
  url?: string;
}

interface Props {
  onExit: () => void;
  isHost?: boolean;
  roomId?: string;
}

const LiveVideo = ({ stream, muted = true }: { stream: MediaStream | null, muted?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />;
};

export default function TripleScreenRoom({ onExit, isHost = false, roomId }: Props) {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(0);
  const [slots, setSlots] = useState<SlotData[]>([
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' }
  ]);
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [visitorsCanNavigate, setVisitorsCanNavigate] = useState(false);

  useEffect(() => {
    // Attempt to load strict room state from Supabase on mount
    const fetchRoomState = async () => {
      if (!roomId) return;
      try {
        const { data, error } = await supabase
          .from('private_rooms')
          .select('slots, current_slot, visitors_can_navigate')
          .eq('id', roomId)
          .maybeSingle();

        if (data && !error) {
          // Default columns might be null
          if (data.slots && Array.isArray(data.slots)) setSlots(data.slots);
          if (data.current_slot !== undefined && data.current_slot !== null) setCurrentSlot(data.current_slot);
          if (data.visitors_can_navigate !== undefined && data.visitors_can_navigate !== null) setVisitorsCanNavigate(data.visitors_can_navigate);
        }
      } catch (err) {
        console.warn('Could not fetch room state from DB. Falling back to local/realtime:', err);
      }
    };

    fetchRoomState();
  }, [roomId]);

  const stateRef = useRef({ slots, currentSlot, visitorsCanNavigate });
  useEffect(() => {
    stateRef.current = { slots, currentSlot, visitorsCanNavigate };
  }, [slots, currentSlot, visitorsCanNavigate]);

  const broadcastSync = async (overrides: Partial<{slots: SlotData[], currentSlot: number, visitorsCanNavigate: boolean}> = {}) => {
    if (!isHost || !roomId) return;
    
    const payload = {
      slots: overrides.slots || stateRef.current.slots,
      currentSlot: overrides.currentSlot !== undefined ? overrides.currentSlot : stateRef.current.currentSlot,
      visitorsCanNavigate: overrides.visitorsCanNavigate !== undefined ? overrides.visitorsCanNavigate : stateRef.current.visitorsCanNavigate,
    };

    try {
      // 1. Broadcast immediately (Realtime)
      await supabase.channel(`room_${roomId}`).send({
        type: 'broadcast',
        event: 'room_sync',
        payload
      });

      // 2. IMPORTANT: Save permanently into Supabase DB (Persistence)
      await supabase
        .from('private_rooms')
        .update({
          slots: payload.slots,
          current_slot: payload.currentSlot,
          visitors_can_navigate: payload.visitorsCanNavigate
        })
        .eq('id', roomId);
        
    } catch (err) {
      console.error('Sync error:', err);
    }
  };

  const slideLeft = () => {
    const newSlot = Math.max(0, currentSlot - 1);
    setCurrentSlot(newSlot);
    if (isHost) broadcastSync({ currentSlot: newSlot });
  };
  
  const slideRight = () => {
    const newSlot = Math.min(2, currentSlot + 1);
    setCurrentSlot(newSlot);
    if (isHost) broadcastSync({ currentSlot: newSlot });
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showControls) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [showControls, currentSlot]);

  useEffect(() => {
    // Get local camera stream for the user
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setMyStream(stream);
      }).catch(err => {
        console.error("Camera access error:", err);
      });

    return () => {
      if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (roomId) {
      // Create a unique user ID or use the logged in one
      const userId = user?.id || `guest_${Math.floor(Math.random() * 1000)}`;
      const userName = user?.email ? user.email.split('@')[0] : `Guest ${userId.substring(0, 4)}`;

      // Subscribe to slot changes and presence
      const channel = supabase.channel(`room_${roomId}`, {
        config: { presence: { key: userId } }
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const currentUsers: any[] = [];
          for (const id in state) {
            currentUsers.push(state[id][0]);
          }
          setVisitors(currentUsers.filter((u: any) => !u.isHost));
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (isHost) {
            // Push current state to new joiners
            broadcastSync();
          }
        })
        .on('broadcast', { event: 'room_sync' }, ({ payload }) => {
          if (!isHost) {
            setSlots(payload.slots);
            setVisitorsCanNavigate(payload.visitorsCanNavigate);
            if (!payload.visitorsCanNavigate) {
              setCurrentSlot(payload.currentSlot);
            }
          }
        })
        .on('broadcast', { event: 'slot_update' }, (payload) => {
          if (!isHost) {
            setSlots(payload.payload.slots);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              id: userId,
              name: userName,
              isHost: isHost
            });
          }
        });

      return () => {
        if (myStream) myStream.getTracks().forEach(t => t.stop());
        supabase.removeChannel(channel);
      };
    }
  }, [roomId, isHost, user]);

  const updateSlot = async (index: number, data: SlotData) => {
    const newSlots = [...slots];
    newSlots[index] = data;
    setSlots(newSlots);
    if (isHost) broadcastSync({ slots: newSlots });
  };

  const renderSlotContent = (slot: SlotData, index: number) => {
    if (slot.type === 'empty') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          {isHost ? (
            <>
              <button
                onClick={() => updateSlot(index, { type: 'menu' })}
                className="w-24 h-24 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center hover:bg-blue-500/20 hover:scale-110 transition-all duration-300 group shadow-[0_0_30px_rgba(59,130,246,0.1)] hover:shadow-[0_0_50px_rgba(59,130,246,0.3)]"
              >
                <Plus className="w-12 h-12 text-blue-400 group-hover:text-blue-300 transition-colors" />
              </button>
              <p className="mt-6 text-blue-400/70 font-mono tracking-widest uppercase text-sm">{t('addContent')}</p>
            </>
          ) : (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#1c4776] to-[#0A192F]">
               <div className="flex flex-col items-center justify-center px-4 animate-pulse">
                  <Video className="w-14 h-14 text-[#00e5ff] mb-6 opacity-90 stroke-[1.5px]" />
                  <p className="text-[#00e5ff] font-mono tracking-widest uppercase text-[12px] font-bold tracking-[0.2em] opacity-90 text-center">WAITING FOR HOST...</p>
               </div>
            </div>
          )}
        </div>
      );
    }

    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto p-6 overflow-y-auto">
          <div className="flex justify-between items-center w-full mb-6">
            <h3 className="text-xl font-bold text-white font-mono uppercase tracking-wider">{t('addContent')}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-2 bg-slate-800/50 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full">
            {[
              { id: 'camera', icon: Video, label: t('liveCamera'), color: 'from-purple-500 to-indigo-500' },
              { id: 'web', icon: Globe, label: t('enterUrl'), color: 'from-cyan-500 to-blue-500' },
              { id: 'youtube', icon: Youtube, label: t('youtubeVideo'), color: 'from-red-500 to-orange-500' },
              { id: 'whiteboard', icon: PenTool, label: t('whiteboard'), color: 'from-purple-500 to-pink-500' },
              { id: 'upload', icon: Upload, label: t('uploadFile'), color: 'from-orange-500 to-amber-500' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'upload') {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,application/pdf';
                    input.onchange = async (e: any) => {
                      const file = e.target.files[0];
                      if (!file) return;

                      // Limit to ~5MB for base64 Sync to avoid crashing the DB row size
                      if (file.size > 5 * 1024 * 1024) {
                        alert(t('invalidUrl') + ' - File must be less than 5MB');
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const base64Url = ev.target?.result as string;
                        updateSlot(index, { type: 'web', url: base64Url });
                      };
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  } else if (item.id === 'youtube') {
                    const url = prompt(t('youtubeVideo') + '?');
                    if (url) {
                      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                      const videoId = match ? match[1] : null;
                      if (videoId) {
                        updateSlot(index, { type: 'youtube', url: videoId });
                      } else {
                        alert(t('invalidUrl'));
                      }
                    }
                  } else if (item.id === 'web') {
                    const url = prompt(t('enterUrl') + ' (https://...)');
                    if (url) {
                      if(url.startsWith('http')) {
                        updateSlot(index, { type: 'web', url: url });
                      } else {
                        alert(t('invalidUrl'));
                      }
                    }
                  } else {
                    updateSlot(index, { type: item.id as ContentType });
                  }
                }}
                className="flex flex-col items-center justify-center p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <item.icon className="w-8 h-8 text-slate-300 group-hover:text-white mb-3 transition-colors relative z-10" />
                <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors relative z-10 text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group bg-black">
        {isHost && (
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-red-500/80 border border-red-500/50 rounded-full hover:bg-red-500 text-white transition-colors backdrop-blur-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        {slot.type === 'camera' && (
          <div className="w-full h-full relative">
            {isHost ? (
              <LiveVideo stream={myStream} muted={true} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-[#111827]">
                <Video className="w-20 h-20 text-indigo-500/50 mb-6 animate-pulse" />
                <h2 className="text-2xl font-bold text-white mb-2">{t('hostCamera')}</h2>
                <p className="text-slate-400 text-center max-w-sm">{t('receivingBroadcast')}</p>
              </div>
            )}
            <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-bold text-white tracking-widest uppercase">{t('live')}</span>
            </div>
          </div>
        )}
        {slot.type === 'web' && (
          <div className="w-full h-full bg-white relative">
            {slot.url ? (
               slot.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || slot.url.startsWith('data:image/') ? (
                 <img src={slot.url} className="w-full h-full object-contain bg-[#111827]" alt="Content" />
               ) : (
                 <iframe 
                   src={slot.url} 
                   className="w-full h-full border-none bg-white" 
                   title="Web Content"
                   sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                 />
               )
            ) : (
              <div className="flex flex-col items-center justify-center bg-slate-900 w-full h-full p-8 shadow-inner">
                <Globe className="w-20 h-20 text-cyan-500/50 mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">{t('fileViewer')}</h2>
                <p className="text-slate-400 text-center max-w-sm">{t('noVideoSelected')}</p>
              </div>
            )}
          </div>
        )}
        {slot.type === 'youtube' && (
          <div className="w-full h-full bg-black flex items-center justify-center">
            {slot.url ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${slot.url}?autoplay=1`}
                title="YouTube Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <Youtube className="w-20 h-20 text-red-500/50 mb-6" />
                <p className="text-slate-400 text-center">{t('noVideoSelected')}</p>
              </div>
            )}
          </div>
        )}
        {slot.type === 'whiteboard' && (
          <div className="w-full h-full p-2 pt-16 bg-white overflow-hidden md:rounded-[2rem] rounded-3xl">
            <Whiteboard />
          </div>
        )}
        {slot.type === 'media' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-700/50 p-8">
            <ImageIcon className="w-20 h-20 text-green-500/50 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">{t('mediaGallery') || 'Media'}</h2>
            <p className="text-slate-400 text-center max-w-sm">Gallery grid placeholder.</p>
          </div>
        )}
      </div>
    );
  };

  const toggleNavigationLock = () => {
    const newState = !visitorsCanNavigate;
    setVisitorsCanNavigate(newState);
    broadcastSync({ visitorsCanNavigate: newState });
  };

  const getCanNavigate = () => isHost || visitorsCanNavigate;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#050B14]/80 to-transparent z-40 flex items-center justify-between px-6 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          <span className="text-white font-mono font-bold tracking-widest text-[13px] opacity-90 uppercase">
            ROOM: {roomId || '8N4HS8HL'}
          </span>
          
          {/* Host Lock Toggle */}
          {isHost && (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleNavigationLock(); }}
              className={`pointer-events-auto ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-300 ${
                visitorsCanNavigate 
                  ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30' 
                  : 'bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500/30'
              }`}
            >
              {visitorsCanNavigate ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span className="text-xs font-bold">{visitorsCanNavigate ? t('freeView') : t('syncView')}</span>
            </button>
          )}
        </div>
        <button 
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[12px] text-white transition-all duration-300 backdrop-blur-md shadow-lg"
        >
          <LogOut className="w-4 h-4 opacity-80" />
          <span className="text-sm font-semibold tracking-wide">Exit Room</span>
        </button>
      </div>

      {/* Main Track for Screens */}
      <div 
        className="flex-1 relative w-full overflow-hidden flex flex-col pt-20 pb-[100px] group"
        onClick={() => setShowControls(true)}
      >

        {/* Navigation Arrows */}
        <button 
          onClick={(e) => { e.stopPropagation(); slideLeft(); }}
          disabled={currentSlot === 0 || !getCanNavigate()}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-40 p-4 rounded-full backdrop-blur-md transition-all duration-300 ${
            currentSlot === 0 || !showControls || !getCanNavigate()
              ? 'opacity-0 pointer-events-none' 
              : 'opacity-100 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
          }`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); slideRight(); }}
          disabled={currentSlot === 2 || !getCanNavigate()}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-40 p-4 rounded-full backdrop-blur-md transition-all duration-300 ${
            currentSlot === 2 || !showControls || !getCanNavigate()
              ? 'opacity-0 pointer-events-none' 
              : 'opacity-100 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
          }`}
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Carousel Container */}
        <div 
          className="absolute top-0 left-0 h-full flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] w-[300%]"
          style={{ transform: `translateX(-${currentSlot * 33.333}%)` }}
        >
          {slots.map((slot, index) => (
            <div key={index} className={`w-1/3 h-full ${!isHost && slot.type === 'empty' ? 'p-0' : 'p-4 md:p-6 pb-2'}`}>
              <div className={`w-full h-full overflow-hidden relative ${!isHost && slot.type === 'empty' ? 'bg-[#0A192F]' : 'bg-[#0F1520] md:rounded-[2rem] rounded-3xl border-2 border-slate-800/80 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'}`}>
                {renderSlotContent(slot, index)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VISITORS BAR AT THE BOTTOM */}
      <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-[#0A2040]/30 backdrop-blur-[20px] border-t border-white/5 flex items-center px-6 overflow-x-auto gap-5 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.4)] scrollbar-hide">
        
        {/* Current User (YOU) - Visitor Style Avatar */}
        <div className="flex flex-col items-center w-[60px] flex-shrink-0 gap-1.5 animate-in zoom-in duration-300">
           <div className="w-[56px] h-[56px] rounded-[14px] bg-[#08101A] border-[2px] border-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.4)] flex items-center justify-center relative overflow-hidden">
             {isHost && <LiveVideo stream={myStream} muted={true} />}
           </div>
           <span className="text-[10px] text-white font-bold tracking-[0.1em] uppercase">YOU</span>
        </div>

        {/* Display all connected visitors */}
        {visitors.map((v, i) => (
          <div key={i} className="flex flex-col items-center w-[60px] flex-shrink-0 gap-1.5 animate-in zoom-in duration-300">
             <div className="w-[56px] h-[56px] rounded-[14px] bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-2xl shadow-lg relative">
                 {v.name ? v.name.charAt(0).toUpperCase() : 'G'}
                 <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#00e5ff] rounded-full border-2 border-[#12233b]"></div>
             </div>
             <span className="text-[10px] text-slate-300 truncate w-full text-center mt-1">
                {v.name || 'Guest 8b3c'}
             </span>
          </div>
        ))}
        
        {visitors.length === 0 && isHost && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm font-mono tracking-wide">
            {t('waitingForSomeone')}
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Icon
function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
