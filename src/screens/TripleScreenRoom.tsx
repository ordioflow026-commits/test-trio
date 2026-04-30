import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, Lock, Unlock, LogOut, Video, Share2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media';
type ViewMode = 'sync' | 'free';

interface SlotData { type: ContentType; url?: string; }
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; roomName?: string; onNameSync?: (id: string, name: string) => void; }

export default function TripleScreenRoom({ onExit, isHost = false, roomId, roomName, onNameSync }: Props) {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string }[]>([]);
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }]);
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 

  const zpRef = useRef<any>(null);
  const zegoJoined = useRef(false);
  const channelRef = useRef<any>(null);

  const canInteract = isHost || viewMode === 'free';
  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  const handleShare = async () => {
    const encodedName = encodeURIComponent(displayRoomName);
    const roomUrl = `https://app.com/room/${roomId}?name=${encodedName}`;
    const shareText = `مرحباً! انضم إلى غرفتي الخاصة "${displayRoomName}" 🚀\n\nاضغط على الرابط أدناه للدخول:\n${roomUrl}`;
    
    if (navigator.share) {
      try { await navigator.share({ title: `انضم لغرفتي`, text: shareText }); } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareText);
      alert('تم نسخ تفاصيل الغرفة والرابط بنجاح!');
    }
  };

  useEffect(() => {
    if (roomId && user) {
      const channel = supabase.channel(`room_${roomId}`, { config: { presence: { key: user.id } } });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activeUsers: { id: string, name: string }[] = [];
          
          Object.keys(presenceState).forEach((key) => {
            const userData = presenceState[key][0] as any;
            if (key !== user.id) {
              activeUsers.push({ id: key, name: userData.name || 'Guest' });
            }
            
            if (!isHost && userData.isHost && userData.hostRoomName) {
               if (userData.hostRoomName !== displayRoomName) {
                   setDisplayRoomName(userData.hostRoomName);
                   if (onNameSync && roomId) onNameSync(roomId, userData.hostRoomName);
               }
            }
          });
          setParticipants(activeUsers);
        }).on('broadcast', { event: 'room_state' }, (payload) => {
          if (!isHost) {
             if (payload.payload.slots) setSlots(payload.payload.slots);
             if (payload.payload.viewMode) setViewMode(payload.payload.viewMode);
             if (payload.payload.viewMode === 'sync' && payload.payload.currentSlot !== undefined) setCurrentSlot(payload.payload.currentSlot);
          }
        }).subscribe(async (status) => { 
            if (status === 'SUBSCRIBED') {
                await channel.track({ name: myName, id: user.id, isHost, hostRoomName: isHost ? roomName : undefined });
            } 
        });
      
      return () => { 
        supabase.removeChannel(channel); 
        channelRef.current = null;
      };
    }
  }, [roomId, isHost, user, myName, displayRoomName]); 

  const initHiddenAudio = async (element: HTMLDivElement | null) => {
    if (!element || !roomId || !user || zegoJoined.current) return;
    zegoJoined.current = true;
    try {
      const appID = 21954096;
      const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4";
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, roomId, user.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16), myName);
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;
      zp.joinRoom({
        container: element, scenario: { mode: ZegoUIKitPrebuilt.GroupCall },
        turnOnMicrophoneWhenJoining: true, turnOnCameraWhenJoining: false,
        showPreJoinView: false, showMyCameraToggleButton: false, showMyMicrophoneToggleButton: false,
        showAudioVideoSettingsButton: false, showLeavingButton: false, layout: 'Grid',
      });
    } catch (err) {}
  };

  const handleExit = () => { if (zpRef.current) { try { zpRef.current.destroy(); } catch (e) {} } onExit(); };

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (channelRef.current && canInteract) { 
      try { await channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode } }); } catch (err) {} 
    }
  };

  const updateSlot = async (index: number, data: SlotData) => {
    if (!canInteract) return;
    const newSlots = [...slots]; newSlots[index] = data; setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const slideLeft = () => {
    if (canInteract) {
      const newSlot = Math.max(0, currentSlot - 1);
      setCurrentSlot(newSlot);
      broadcastState(newSlot, slots, viewMode);
    }
  };
  
  const slideRight = () => {
    if (canInteract) {
      const newSlot = Math.min(2, currentSlot + 1);
      setCurrentSlot(newSlot);
      broadcastState(newSlot, slots, viewMode);
    }
  };

  const handleToggleMode = () => {
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
              <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-24 h-24 rounded-full border-2 border-[#00b4d8] flex items-center justify-center hover:bg-[#00b4d8]/20 transition-all md:hover:scale-105"><Plus className="w-10 h-10 text-[#00b4d8]" /></button>
              <p className="mt-4 text-[#00b4d8] font-mono tracking-widest text-sm font-bold">ADD CONTENT</p>
            </>
          ) : (
            <><Video className="w-14 h-14 text-[#00b4d8] mb-5" /><p className="text-[#00b4d8] font-mono tracking-[0.2em] uppercase text-[13px] font-semibold">WAITING FOR HOST...</p></>
          )}
        </div>
      );
    }
    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg md:max-w-3xl mx-auto p-6 transition-all duration-300">
          <div className="flex justify-between items-center w-full mb-8"><h3 className="text-xl font-bold text-white uppercase tracking-wider">ADD CONTENT</h3><button onClick={() => updateSlot(index, { type: 'empty' })} className="p-2 bg-slate-800/50 rounded-full text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button></div>
          {/* 💡 التجاوب: أعمدة أكثر على الكمبيوتر لتستغل العرض بأناقة */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full">
            {[ { id: 'web', icon: Globe, label: t('webPage'), color: 'from-cyan-500' }, { id: 'youtube', icon: Youtube, label: t('youtubeVideo'), color: 'from-red-500' }, { id: 'whiteboard', icon: PenTool, label: t('whiteboard'), color: 'from-purple-500' }, { id: 'media', icon: ImageIcon, label: t('mediaGallery'), color: 'from-green-500' } ].map((item) => (
              <button key={item.id} onClick={() => { if (item.id === 'youtube') { const url = prompt('Enter YouTube URL:'); if (url) { const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/); if (match) updateSlot(index, { type: 'youtube', url: match[1] }); } } else updateSlot(index, { type: item.id as ContentType }); }} className="flex flex-col items-center justify-center p-6 md:p-8 bg-slate-800/40 border border-slate-700/50 rounded-2xl relative overflow-hidden group hover:border-slate-500 transition-all md:hover:scale-105 shadow-lg">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 transition-opacity`} /><item.icon className="w-10 h-10 md:w-12 md:h-12 text-slate-300 group-hover:text-white mb-4 relative z-10 transition-colors" /><span className="text-sm md:text-base font-bold text-slate-400 group-hover:text-white relative z-10 transition-colors">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group">
        {canInteract && <div className="absolute top-4 right-4 md:top-8 md:right-8 z-10 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 md:p-4 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 hover:bg-red-500/40 hover:text-white transition-all"><X className="w-6 h-6 md:w-8 md:h-8" /></button></div>}
        {slot.type === 'web' && <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80"><Globe className="w-20 h-20 text-cyan-500/50 mb-6" /><h2 className="text-2xl font-bold text-white mb-2">{t('webPage')}</h2></div>}
        {slot.type === 'youtube' && <div className="w-full h-full bg-black flex items-center justify-center">{slot.url ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${slot.url}?autoplay=1`} allowFullScreen className="w-full h-full border-0"></iframe> : <Youtube className="w-20 h-20 text-red-500/50" />}</div>}
        {slot.type === 'whiteboard' && <div className="w-full h-full p-4 md:p-8"><Whiteboard /></div>}
        {slot.type === 'media' && <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/80"><ImageIcon className="w-20 h-20 text-green-500/50 mb-6" /><h2 className="text-2xl font-bold text-white mb-2">{t('mediaGallery')}</h2></div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      <div ref={initHiddenAudio} className="fixed top-[-9999px] left-[-9999px] w-[100px] h-[100px] opacity-0 z-[-1]" />
      
      {/* 💡 التجاوب: مساحات جانبية أفضل للشاشات الكبيرة */}
      <div className="absolute top-0 left-0 right-0 h-16 md:h-20 z-[100] flex items-center justify-between px-4 md:px-8 bg-gradient-to-b from-black/80 to-transparent">
        
        <button onClick={handleExit} className="p-2 md:p-2.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full transition-all backdrop-blur-sm shadow-lg">
          <LogOut className="w-5 h-5 md:w-6 md:h-6" />
        </button>

        <div className="flex justify-center">
             <button onClick={handleToggleMode} disabled={!isHost} className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>{viewMode === 'sync' ? <><Lock className="w-4 h-4" /><span className="text-xs md:text-sm font-bold tracking-wide">Sync</span></> : <><Unlock className="w-4 h-4" /><span className="text-xs md:text-sm font-bold tracking-wide">Free</span></>}</button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white font-mono font-bold tracking-widest text-xs md:text-sm opacity-80 uppercase hidden sm:inline-block hover:opacity-100 transition-opacity truncate max-w-[120px] md:max-w-[200px]">{displayRoomName}</span>
          <button 
            onClick={handleShare} 
            className="flex items-center justify-center p-2.5 md:p-3 bg-blue-600 text-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)] hover:shadow-[0_0_25px_rgba(37,99,235,0.8)] animate-pulse hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Share2 className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col">
          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            {canInteract && (
              <>
                <button onClick={slideLeft} disabled={currentSlot === 0} className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 text-white/50 hover:text-white hover:bg-black/50 backdrop-blur-md rounded-full transition-all disabled:opacity-0"><ChevronLeft className="w-8 h-8 md:w-10 md:h-10" /></button>
                <button onClick={slideRight} disabled={currentSlot === 2} className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 text-white/50 hover:text-white hover:bg-black/50 backdrop-blur-md rounded-full transition-all disabled:opacity-0"><ChevronRight className="w-8 h-8 md:w-10 md:h-10" /></button>
              </>
            )}
            <div className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out" style={{ width: '300%', transform: `translateX(-${currentSlot * 33.333}%)` }}>
              {slots.map((slot, index) => (<div key={index} className="w-1/3 h-full pt-16 md:pt-20">{renderSlotContent(slot, index)}</div>))}
            </div>
          </div>
          <div className="h-[90px] md:h-[100px] w-full bg-[#1e293b]/90 backdrop-blur-xl border-t border-slate-700/50 flex items-center px-4 md:px-8 relative z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
              {/* 💡 التجاوب: شريط الزوار أصبح يمرر أفقياً إذا زاد العدد ولا يخرب الشاشة */}
              <div className="flex items-center h-full gap-4 md:gap-6 w-full overflow-x-auto overflow-y-hidden pb-1" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                  <div className="flex flex-col items-center gap-1.5 translate-y-[2px] shrink-0">
                    <div className="w-[50px] h-[50px] md:w-[56px] md:h-[56px] rounded-[16px] bg-[#0f172a] border-2 border-[#00b4d8] shadow-[0_0_15px_rgba(0,180,216,0.4)] flex items-center justify-center relative transition-transform hover:scale-105"><span className="text-[#00b4d8] font-bold text-xl md:text-2xl uppercase">{myInitial}</span><div className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-[#3b82f6] rounded-full border-2 border-[#1e293b]" /></div>
                    <span className="text-[#00b4d8] text-[10px] md:text-xs font-bold truncate max-w-[60px] md:max-w-[70px] text-center">{myName}</span>
                  </div>
                  {participants.map(p => (
                     <div key={p.id} className="flex flex-col items-center gap-1.5 translate-y-[2px] animate-in zoom-in shrink-0">
                       <div className="w-[50px] h-[50px] md:w-[56px] md:h-[56px] rounded-[16px] bg-[#00b4d8] flex items-center justify-center relative shadow-md transition-transform hover:scale-105"><span className="text-white font-bold text-xl md:text-2xl uppercase">{p.name.charAt(0).toUpperCase()}</span><div className="absolute -bottom-1 -right-0.5 w-3.5 h-3.5 bg-[#00e676] rounded-full border-2 border-[#1e293b]" /></div>
                       <span className="text-white text-[10px] md:text-xs font-medium truncate max-w-[60px] md:max-w-[70px] text-center">{p.name}</span>
                     </div>
                  ))}
              </div>
          </div>
      </div>
      {/* إخفاء شريط التمرير الافتراضي للمتصفح ليبقى الشريط السفلي نظيفاً */}
      <style dangerouslySetInnerHTML={{__html: `::-webkit-scrollbar { display: none; }`}} />
    </div>
  );
}
