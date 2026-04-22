import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, LogOut, Loader2, Lock, Unlock, SquareArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media';
type ViewMode = 'sync' | 'free';

interface SlotData {
  type: ContentType;
  url?: string;
}

interface Props {
  onExit: () => void;
  isHost?: boolean;
  roomId?: string;
}

export default function TripleScreenRoom({ onExit, isHost = false, roomId }: Props) {
  const { t, dir } = useLanguage();
  const [currentSlot, setCurrentSlot] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string }[]>([]);
  
  const [slots, setSlots] = useState<SlotData[]>([
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' }
  ]);
  const [loading, setLoading] = useState(false);

  const canInteract = isHost || viewMode === 'free';

  const slideLeft = () => {
    if (canInteract) {
      setCurrentSlot(prev => Math.max(0, prev - 1));
      broadcastState(Math.max(0, currentSlot - 1), slots, viewMode);
    }
  };
  
  const slideRight = () => {
    if (canInteract) {
      setCurrentSlot(prev => Math.min(2, prev + 1));
      broadcastState(Math.min(2, currentSlot + 1), slots, viewMode);
    }
  };

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (roomId && canInteract) {
      try {
        await supabase.channel(`room_${roomId}`).send({
          type: 'broadcast',
          event: 'room_state',
          payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode }
        });
      } catch (err) {
        console.error('Failed to broadcast room state:', err);
      }
    }
  };

  useEffect(() => {
    if (roomId) {
      const channel = supabase.channel(`room_${roomId}`)
        .on('broadcast', { event: 'room_state' }, (payload) => {
          if (!isHost || viewMode === 'free') {
             if (payload.payload.slots) setSlots(payload.payload.slots);
             if (payload.payload.viewMode) setViewMode(payload.payload.viewMode);
             
             // If in sync mode, force the slot to match the host
             if (payload.payload.viewMode === 'sync' && payload.payload.currentSlot !== undefined) {
               setCurrentSlot(payload.payload.currentSlot);
             }
             // If free mode, optionally let users stay on their current slot, but we'll sync it anyway for simplicity if it changed via a broadcast.
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomId, isHost, viewMode]);

  const updateSlot = async (index: number, data: SlotData) => {
    if (!canInteract) return;
    const newSlots = [...slots];
    newSlots[index] = data;
    setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const toggleViewMode = () => {
    if (!isHost) return;
    const newMode = viewMode === 'sync' ? 'free' : 'sync';
    setViewMode(newMode);
    broadcastState(currentSlot, slots, newMode);
  };

  const renderSlotContent = (slot: SlotData, index: number) => {
    if (slot.type === 'empty') {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          {canInteract ? (
            <>
              <button
                onClick={() => updateSlot(index, { type: 'menu' })}
                className="w-28 h-28 rounded-full bg-transparent border-2 border-[#00b4d8] flex items-center justify-center hover:bg-[#00b4d8]/10 hover:scale-105 transition-all duration-300 group shadow-[0_0_20px_rgba(0,180,216,0.3)]"
              >
                <Plus className="w-12 h-12 text-[#00b4d8] transition-colors" strokeWidth={1.5} />
              </button>
              <p className="mt-6 text-[#00b4d8] font-mono tracking-widest uppercase text-[15px] font-semibold">{t('addContent') || 'ADD CONTENT'}</p>
            </>
          ) : (
            <p className="text-slate-400 font-mono tracking-widest uppercase text-sm">Waiting for content...</p>
          )}
        </div>
      );
    }

    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-6">
          <div className="flex justify-between items-center w-full mb-8">
            <h3 className="text-xl font-bold text-white font-mono uppercase tracking-wider">{t('addContent') || 'ADD CONTENT'}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-2 bg-slate-800/50 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full">
            {[
              { id: 'web', icon: Globe, label: t('webPage'), color: 'from-cyan-500 to-blue-500' },
              { id: 'youtube', icon: Youtube, label: t('youtubeVideo'), color: 'from-red-500 to-orange-500' },
              { id: 'whiteboard', icon: PenTool, label: t('whiteboard'), color: 'from-purple-500 to-pink-500' },
              { id: 'media', icon: ImageIcon, label: t('mediaGallery'), color: 'from-green-500 to-emerald-500' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'youtube') {
                    const url = prompt('Enter YouTube Video URL:');
                    if (url) {
                      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
                      const videoId = match ? match[1] : null;
                      if (videoId) {
                        updateSlot(index, { type: 'youtube', url: videoId });
                      } else {
                        alert('Invalid YouTube URL');
                      }
                    }
                  } else {
                    updateSlot(index, { type: item.id as ContentType });
                  }
                }}
                className="flex flex-col items-center justify-center p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 transition-all duration-300 hover:scale-105 group relative overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                <item.icon className="w-10 h-10 text-slate-300 group-hover:text-white mb-4 transition-colors relative z-10" />
                <span className="text-sm font-bold text-slate-400 group-hover:text-white transition-colors relative z-10">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group">
        {canInteract && (
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-red-500/20 border border-red-500/50 rounded-full hover:bg-red-500/40 text-red-400 hover:text-red-200 transition-colors backdrop-blur-md">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
        
        {slot.type === 'web' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 rounded-none p-8">
            <Globe className="w-20 h-20 text-cyan-500/50 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">{t('webPage')}</h2>
            <p className="text-slate-400 text-center max-w-sm">Web browser placeholder.</p>
          </div>
        )}
        {slot.type === 'youtube' && (
          <div className="w-full h-full bg-black flex items-center justify-center">
            {slot.url ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${slot.url}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <Youtube className="w-20 h-20 text-red-500/50 mb-6" />
                <p className="text-slate-400 text-center">No video selected</p>
              </div>
            )}
          </div>
        )}
        {slot.type === 'whiteboard' && (
          <div className="w-full h-full p-4 pt-4 pb-4">
            <Whiteboard />
          </div>
        )}
        {slot.type === 'media' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 rounded-none p-8">
            <ImageIcon className="w-20 h-20 text-green-500/50 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">{t('mediaGallery')}</h2>
            <p className="text-slate-400 text-center max-w-sm">Media gallery grid placeholder.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-transparent z-20 flex items-center justify-between px-6">
        
        {/* Left: Room ID */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-white font-mono font-bold tracking-widest text-[15px] opacity-90 uppercase">
            ROOM: {roomId || '8N4HS8HL'}
          </span>
        </div>
        
        {/* Center: Sync/Free Toggle (Only visible and usable by Host) */}
        <div className="flex-1 flex justify-center">
             <button 
                onClick={toggleViewMode}
                disabled={!isHost}
                className={`flex items-center gap-2 px-5 py-1.5 rounded-full border transition-all duration-300 focus:outline-none disabled:cursor-default ${
                  viewMode === 'sync' 
                    ? 'bg-transparent border-red-500/50 text-red-400' 
                    : 'bg-transparent border-emerald-500/50 text-emerald-400'
                }`}
              >
                {viewMode === 'sync' ? (
                   <>
                     <Lock className="w-4 h-4" />
                     <span className="text-[13px] font-semibold tracking-wide">Sync View</span>
                   </>
                ) : (
                   <>
                     <Unlock className="w-4 h-4" />
                     <span className="text-[13px] font-semibold tracking-wide">Free View</span>
                   </>
                )}
              </button>
        </div>

        {/* Right: Exit Room */}
        <button 
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 bg-transparent text-white hover:text-slate-300 transition-colors"
        >
          <SquareArrowRight className="w-5 h-5" />
          <span className="text-[15px] font-bold">Exit Room</span>
        </button>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 w-full flex flex-col">
          {/* Main Visual Carousel / Active Screen */}
          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            {canInteract && (
              <>
                <button 
                  onClick={slideLeft}
                  disabled={currentSlot === 0}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                    currentSlot === 0 
                      ? 'opacity-0 pointer-events-none' 
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>

                <button 
                  onClick={slideRight}
                  disabled={currentSlot === 2}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                    currentSlot === 2 
                      ? 'opacity-0 pointer-events-none' 
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            {/* Slider track */}
            <div 
              className="absolute top-0 left-0 h-full flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{ width: '300%', transform: `translateX(-${currentSlot * 33.333}%)` }}
            >
              {slots.map((slot, index) => (
                <div key={index} className="w-1/3 h-full">
                  <div className="w-full h-full pt-16"> 
                    {renderSlotContent(slot, index)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Bottom Participant Bar */}
          <div className="h-[90px] w-full bg-[#1e293b]/60 border-t border-slate-700/50 backdrop-blur-md flex items-center px-6 relative z-30">
              
              <div className="flex items-center h-full gap-4 relative z-10 w-full">
                  {/* Local User (YOU) */}
                  <div className="w-14 h-14 rounded-2xl bg-[#0f172a] border-2 border-[#00b4d8] shadow-[0_0_15px_rgba(0,180,216,0.3)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00b4d8] font-bold text-[11px] tracking-wider">YOU</span>
                  </div>
                  
                  {/* Remote Participants would map here */}
                  {participants.map(p => (
                     <div key={p.id} className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-slate-300 font-bold text-xs uppercase">{p.name.substring(0,2)}</span>
                     </div>
                  ))}
              </div>
              
              {/* Centered Status Message */}
              {participants.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[#00b4d8] font-mono tracking-widest text-[13px] opacity-80">Waiting for someone to join...</span>
                </div>
              )}
          </div>
      </div>
    </div>
  );
}
