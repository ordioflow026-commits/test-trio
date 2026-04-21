import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, LogOut, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media';

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
  const [slots, setSlots] = useState<SlotData[]>([
    { type: 'empty' },
    { type: 'empty' },
    { type: 'empty' }
  ]);
  const [loading, setLoading] = useState(false);

  const slideLeft = () => setCurrentSlot(prev => Math.max(0, prev - 1));
  const slideRight = () => setCurrentSlot(prev => Math.min(2, prev + 1));

  useEffect(() => {
    if (roomId) {
      // Subscribe to slot changes
      const channel = supabase.channel(`room_${roomId}`)
        .on('broadcast', { event: 'slot_update' }, (payload) => {
          if (!isHost) {
            setSlots(payload.payload.slots);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomId, isHost]);

  const updateSlot = async (index: number, data: SlotData) => {
    const newSlots = [...slots];
    newSlots[index] = data;
    setSlots(newSlots);

    if (roomId && isHost) {
      try {
        // Broadcast slot update
        await supabase.channel(`room_${roomId}`).send({
          type: 'broadcast',
          event: 'slot_update',
          payload: { slots: newSlots }
        });
      } catch (err) {
        console.error('Failed to broadcast slot update:', err);
      }
    }
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
            <p className="text-slate-500 font-mono tracking-widest uppercase text-sm">Waiting for host...</p>
          )}
        </div>
      );
    }

    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto p-6">
          <div className="flex justify-between items-center w-full mb-8">
            <h3 className="text-xl font-bold text-white font-mono uppercase tracking-wider">{t('addContent')}</h3>
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
                      // Extract video ID
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

    // Placeholders for actual content
    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group">
        {isHost && (
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-red-500/20 border border-red-500/50 rounded-full hover:bg-red-500/40 text-red-400 hover:text-red-200 transition-colors backdrop-blur-md">
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
        
        {slot.type === 'web' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8">
            <Globe className="w-20 h-20 text-cyan-500/50 mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">{t('webPage')}</h2>
            <p className="text-slate-400 text-center max-w-sm">Web browser placeholder. In a real app, this would be an iframe.</p>
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
          <div className="w-full h-full p-4 pt-20 pb-20">
            <Whiteboard />
          </div>
        )}
        {slot.type === 'media' && (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80 border border-slate-700/50 rounded-3xl p-8">
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
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 to-transparent z-20 flex items-center justify-between px-6 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          <span className="text-white font-mono font-bold tracking-widest text-sm opacity-80 uppercase">Live Room</span>
        </div>
        <button 
          onClick={onExit}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/50 rounded-full text-slate-300 hover:text-red-400 transition-all duration-300 backdrop-blur-md"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-bold">{t('exitRoom')}</span>
        </button>
      </div>

      {/* Navigation Arrows */}
      {isHost && (
        <>
          <button 
            onClick={slideLeft}
            disabled={currentSlot === 0}
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full backdrop-blur-md transition-all duration-300 ${
              currentSlot === 0 
                ? 'opacity-0 pointer-events-none' 
                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
            }`}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button 
            onClick={slideRight}
            disabled={currentSlot === 2}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full backdrop-blur-md transition-all duration-300 ${
              currentSlot === 2 
                ? 'opacity-0 pointer-events-none' 
                : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-110 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
            }`}
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Carousel Track */}
      <div className="flex-1 relative w-full h-full">
        <div 
          className="absolute top-0 left-0 h-full flex transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ 
            width: '300%', 
            transform: `translateX(-${currentSlot * 33.333}%)` 
          }}
        >
          {slots.map((slot, index) => (
            <div key={index} className="w-1/3 h-full p-6 pt-24 pb-12">
              <div className="w-full h-full bg-[#0F1520] rounded-[2.5rem] border border-slate-800/80 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative">
                {/* Slot Indicator */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/40 rounded-full border border-white/5 backdrop-blur-md z-10">
                  <span className="text-slate-500 font-mono text-xs font-bold tracking-widest uppercase">Slot 0{index + 1}</span>
                </div>
                
                {renderSlotContent(slot, index)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Indicators */}
      {isHost && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlot(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlot === idx ? 'w-8 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
