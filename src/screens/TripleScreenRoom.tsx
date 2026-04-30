import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, Lock, Unlock, LogOut, Video, Share2, Layers, BookOpen, FolderOpen, Camera, Mic, FileText, MonitorUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media' | 'camera' | 'screen_share' | 'document' | 'mic';
type ViewMode = 'sync' | 'free';

interface SlotData { type: ContentType; url?: string; }
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; roomName?: string; onNameSync?: (id: string, name: string) => void; }

export default function TripleScreenRoom({ onExit, isHost = false, roomId, roomName, onNameSync }: Props) {
  const { t, dir, language } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string }[]>([]);
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }]);
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 
  
  const isAr = language === 'ar';

  const stateRef = useRef({ slots, currentSlot, viewMode });
  useEffect(() => {
    stateRef.current = { slots, currentSlot, viewMode };
  }, [slots, currentSlot, viewMode]);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<any>(null);
  
  // 💡 إضافة حساس لوجود المضيف
  const hostWasPresent = useRef(false);

  const zpRef = useRef<any>(null);
  const zegoJoined = useRef(false);
  const channelRef = useRef<any>(null);

  const canInteract = isHost || viewMode === 'free';
  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 3000); 
  };

  useEffect(() => {
    resetIdleTimer(); 
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const handleShare = async () => {
    const encodedName = encodeURIComponent(displayRoomName);
    const roomUrl = `https://app.com/room/${roomId}?name=${encodedName}`;
    const shareText = `${t('shareGreeting') || 'Join my room'} "${displayRoomName}" 🚀\n\n${t('clickToJoin') || 'Click below to enter:'}\n${roomUrl}`;
    
    if (navigator.share) {
      try { await navigator.share({ title: `انضم لغرفتي`, text: shareText }); } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareText);
      alert(t('copiedBtn') || 'Copied!');
    }
  };

  const handleExit = () => { 
    if (zpRef.current) { try { zpRef.current.destroy(); } catch (e) {} } 
    onExit(); 
  };

  // 💡 تأخير بسيط عند خروج المضيف لضمان وصول رسالة الخروج قبل تدمير الاتصال
  const handleExitClick = async () => {
    if (isHost && channelRef.current) {
        try {
          await channelRef.current.send({ type: 'broadcast', event: 'room_closed' });
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {}
    }
    handleExit();
  };

  useEffect(() => {
    if (roomId && user) {
      const channel = supabase.channel(`room_${roomId}`, { config: { presence: { key: user.id } } });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activeUsers: { id: string, name: string }[] = [];
          let hostFound = false;
          
          Object.keys(presenceState).forEach((key) => {
            const userData = presenceState[key][0] as any;
            
            if (userData.isHost) {
              hostFound = true;
            }

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

          if (isHost) {
             channelRef.current?.send({ 
                type: 'broadcast', 
                event: 'room_state', 
                payload: { ...stateRef.current, senderId: user.id }
             });
          } else {
             // 💡 حساس الطرد التلقائي: إذا كان المضيف موجوداً ثم اختفى فجأة، اطرد الزائر!
             if (hostFound) {
                 hostWasPresent.current = true;
             } else if (hostWasPresent.current && !hostFound) {
                 alert(isAr ? 'أنهى المضيف الجلسة. تم إغلاق الغرفة تلقائياً.' : 'The host has ended the session. Room closed.');
                 handleExit();
             }
          }
        })
        .on('broadcast', { event: 'room_state' }, (payload) => {
          const { slots: newSlots, currentSlot: newSlot, viewMode: newMode, senderId } = payload.payload;
          if (senderId === user.id) return; 

          if (newSlots) setSlots(newSlots);
          if (newMode) setViewMode(newMode);
          if (newSlot !== undefined) setCurrentSlot(newSlot);
        })
        .on('broadcast', { event: 'room_closed' }, () => {
          if (!isHost) {
             alert(isAr ? 'أنهى المضيف الجلسة وتم إغلاق الغرفة.' : 'The host has ended the session and closed the room.');
             handleExit();
          }
        })
        .subscribe(async (status) => { 
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

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (channelRef.current && canInteract) { 
      try { 
        await channelRef.current.send({ 
          type: 'broadcast', 
          event: 'room_state', 
          payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode, senderId: user?.id } 
        }); 
      } catch (err) {} 
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
      resetIdleTimer();
    }
  };
  
  const slideRight = () => {
    if (canInteract) {
      const newSlot = Math.min(2, currentSlot + 1);
      setCurrentSlot(newSlot);
      broadcastState(newSlot, slots, viewMode);
      resetIdleTimer(); 
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
        <div className="flex flex-col items-center justify-center h-full animate-in zoom-in-95 duration-500">
          {canInteract ? (
            <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-28 h-28 rounded-full border border-[#00b4d8]/50 bg-[#00b4d8]/10 flex items-center justify-center hover:bg-[#00b4d8]/20 transition-all shadow-xl"><Plus className="w-12 h-12 text-[#00b4d8]" /></button>
          ) : (
            <p className="text-[#00b4d8] font-mono tracking-widest uppercase text-sm">{t('waitingForHost') || 'WAITING FOR HOST...'}</p>
          )}
        </div>
      );
    }
    
    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-5xl mx-auto p-4 overflow-y-auto" dir={dir}>
          <div className="flex justify-between items-center w-full mb-8">
            <h3 className="text-3xl font-extrabold text-white">{isAr ? 'إضافة محتوى' : 'Add Content'}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className="p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all"><X className="w-6 h-6" /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-cyan-400 font-bold uppercase tracking-wider">{isAr ? 'الإنترنت والمشاهدة' : 'Internet & Media'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'web' })} className="p-6 bg-black/20 border border-white/5 hover:border-cyan-500/40 rounded-2xl transition-all"><Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Web</span></button>
                <button onClick={() => { const url = prompt('YouTube URL:'); if (url) updateSlot(index, { type: 'youtube', url }); }} className="p-6 bg-black/20 border border-white/5 hover:border-red-500/40 rounded-2xl transition-all"><Youtube className="w-8 h-8 text-red-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">YouTube</span></button>
              </div>
            </div>
            {/* Add Education group */}
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-purple-400 font-bold uppercase tracking-wider">{isAr ? 'الشرح والتعليم' : 'Education'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-6 bg-black/20 border border-white/5 hover:border-purple-500/40 rounded-2xl transition-all"><PenTool className="w-8 h-8 text-purple-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Whiteboard</span></button>
                <button onClick={() => updateSlot(index, { type: 'screen_share' })} className="p-6 bg-black/20 border border-white/5 hover:border-indigo-500/40 rounded-2xl transition-all"><MonitorUp className="w-8 h-8 text-indigo-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Screen</span></button>
              </div>
            </div>
            {/* Add Files group */}
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-emerald-400 font-bold uppercase tracking-wider">{isAr ? 'الملفات والعرض' : 'Files'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'media' })} className="p-6 bg-black/20 border border-white/5 hover:border-emerald-500/40 rounded-2xl transition-all"><ImageIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Media</span></button>
                <button onClick={() => updateSlot(index, { type: 'document' })} className="p-6 bg-black/20 border border-white/5 hover:border-teal-500/40 rounded-2xl transition-all"><FileText className="w-8 h-8 text-teal-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Docs</span></button>
              </div>
            </div>
            {/* Add Live Communication group */}
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-amber-400 font-bold uppercase tracking-wider">{isAr ? 'التواصل الحي' : 'Live'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'camera' })} className="p-6 bg-black/20 border border-white/5 hover:border-amber-500/40 rounded-2xl transition-all"><Camera className="w-8 h-8 text-amber-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Camera</span></button>
                <button onClick={() => updateSlot(index, { type: 'mic' })} className="p-6 bg-black/20 border border-white/5 hover:border-orange-500/40 rounded-2xl transition-all"><Mic className="w-8 h-8 text-orange-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Mic</span></button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group">
        {!canInteract && <div className="absolute inset-0 z-[60]" />}
        {canInteract && <div className="absolute top-4 right-4 z-[70] opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 transition-all shadow-lg"><X className="w-6 h-6" /></button></div>}
        {slot.type === 'web' && <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center"><Globe className="w-20 h-20 text-cyan-500/50 mb-6" /><h2 className="text-2xl text-white font-bold">Web Browser</h2></div>}
        {slot.type === 'youtube' && <div className="w-full h-full bg-black flex items-center justify-center">{slot.url ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${slot.url}?autoplay=1`} allowFullScreen className="w-full h-full border-0 pointer-events-auto"></iframe> : <Youtube className="w-20 h-20 text-red-500/50" />}</div>}
        {slot.type === 'whiteboard' && <div className="w-full h-full p-4 pointer-events-auto"><Whiteboard roomId={roomId} canInteract={canInteract} /></div>}
        {slot.type === 'media' && <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center"><ImageIcon className="w-20 h-20 text-green-500/50 mb-6" /><h2 className="text-2xl text-white font-bold">Gallery</h2></div>}
        {slot.type === 'camera' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white">Camera Active</div>}
        {slot.type === 'mic' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white">Mic Active</div>}
        {slot.type === 'document' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white">Document Active</div>}
        {slot.type === 'screen_share' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white">Screen Active</div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden" dir={dir}>
      <div ref={initHiddenAudio} className="fixed top-[-9999px] left-[-9999px] w-[100px] h-[100px] opacity-0 z-[-1]" />
      <div className="absolute top-0 left-0 right-0 h-16 z-[100] flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <button onClick={handleExitClick} className="p-2 bg-red-500/20 text-red-400 rounded-full transition-all shadow-lg"><LogOut className="w-5 h-5" /></button>
        <div className="flex justify-center"><button onClick={handleToggleMode} disabled={!isHost} className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>{viewMode === 'sync' ? <><Lock className="w-4 h-4" /><span className="text-xs font-bold">Sync</span></> : <><Unlock className="w-4 h-4" /><span className="text-xs font-bold">Free</span></>}</button></div>
        <div className="flex items-center gap-3"><span className="text-white font-mono font-bold tracking-widest text-xs truncate max-w-[120px]">{displayRoomName}</span><button onClick={handleShare} className="p-2.5 bg-blue-600 text-white rounded-full shadow-lg"><Share2 className="w-5 h-5" /></button></div>
      </div>

      <div className="flex-1 w-full flex flex-col relative" onMouseMove={resetIdleTimer} onTouchStart={resetIdleTimer} onClick={resetIdleTimer}>
          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            {canInteract && (
              <>
                {currentSlot > 0 && <button onClick={slideLeft} className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 text-white/50 rounded-full transition-all ${isIdle ? 'opacity-0' : 'opacity-100'}`}><ChevronLeft className="w-8 h-8" /></button>}
                {currentSlot < 2 && <button onClick={slideRight} className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-black/20 text-white/50 rounded-full transition-all ${isIdle ? 'opacity-0' : 'opacity-100'}`}><ChevronRight className="w-8 h-8" /></button>}
              </>
            )}
            <div className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out" style={{ width: '300%', transform: `translateX(${dir === 'rtl' ? currentSlot * 33.333 : -currentSlot * 33.333}%)` }}>
              {slots.map((slot, index) => (<div key={index} className="w-1/3 h-full pt-16">{renderSlotContent(slot, index)}</div>))}
            </div>
          </div>
          <div className="h-[90px] w-full bg-[#1e293b]/90 backdrop-blur-xl border-t border-slate-700/50 flex items-center px-4 relative z-30">
              <div className="flex items-center gap-4 w-full overflow-x-auto no-scrollbar pb-1">
                  <div className="flex flex-col items-center gap-1.5 shrink-0"><div className="w-[50px] h-[50px] rounded-[16px] bg-[#0f172a] border-2 border-[#00b4d8] flex items-center justify-center relative"><span className="text-[#00b4d8] font-bold text-xl uppercase">{myInitial}</span></div><span className="text-[#00b4d8] text-[10px] font-bold">{myName}</span></div>
                  {participants.map(p => (<div key={p.id} className="flex flex-col items-center gap-1.5 shrink-0"><div className="w-[50px] h-[50px] rounded-[16px] bg-[#00b4d8] flex items-center justify-center"><span className="text-white font-bold text-xl uppercase">{p.name.charAt(0).toUpperCase()}</span></div><span className="text-white text-[10px] font-medium">{p.name}</span></div>))}
              </div>
          </div>
      </div>
    </div>
  );
}
