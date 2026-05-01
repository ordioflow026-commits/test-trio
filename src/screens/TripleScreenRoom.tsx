import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, Lock, Unlock, LogOut, Video, Share2, Layers, BookOpen, FolderOpen, Camera, Mic, FileText, MonitorUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import Whiteboard from '../components/Whiteboard';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'media' | 'camera' | 'screen_share' | 'document' | 'mic';
type ViewMode = 'sync' | 'free';
// 💡 تمت إضافة القفل الأبيض
type LockState = 'none' | 'green' | 'yellow' | 'red' | 'white';

interface SlotData { type: ContentType; url?: string; lock?: LockState; }
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; roomName?: string; onNameSync?: (id: string, name: string) => void; }

export default function TripleScreenRoom({ onExit, isHost = false, roomId, roomName, onNameSync }: Props) {
  const { t, dir, language } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string }[]>([]);
  
  const [slots, setSlots] = useState<SlotData[]>([
    { type: 'empty', lock: 'none' }, 
    { type: 'empty', lock: 'none' }, 
    { type: 'empty', lock: 'none' }
  ]);
  
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 
  
  const isAr = language === 'ar';
  const stateRef = useRef({ slots, currentSlot, viewMode });
  const hostWasPresent = useRef(false);

  useEffect(() => {
    stateRef.current = { slots, currentSlot, viewMode };
  }, [slots, currentSlot, viewMode]);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<any>(null);
  const zpRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const canInteract = isHost || viewMode === 'free';
  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 3000); 
  };

  useEffect(() => {
    resetIdleTimer(); 
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, []);

  const handleExit = () => { 
    if (zpRef.current) { try { zpRef.current.destroy(); } catch (e) {} } 
    onExit(); 
  };

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
            if (userData.isHost) hostFound = true;
            if (key !== user.id) activeUsers.push({ id: key, name: userData.name || 'Guest' });
            
            if (!isHost && userData.isHost && userData.hostRoomName) {
               if (userData.hostRoomName !== displayRoomName) {
                   setDisplayRoomName(userData.hostRoomName);
                   if (onNameSync && roomId) onNameSync(roomId, userData.hostRoomName);
               }
            }
          });
          setParticipants(activeUsers);

          if (isHost) {
             channel.send({ type: 'broadcast', event: 'room_state', payload: { ...stateRef.current, senderId: user.id } });
          } else {
             if (hostFound) hostWasPresent.current = true;
             else if (hostWasPresent.current && !hostFound) {
                 alert(isAr ? 'أنهى المضيف الجلسة.' : 'Host has ended the session.');
                 handleExit();
             }
          }
        })
        .on('broadcast', { event: 'room_state' }, (payload) => {
          const { slots: s, currentSlot: c, viewMode: m, senderId } = payload.payload;
          if (senderId === user.id) return; 
          
          if (s) setSlots(s);
          if (m) setViewMode(m);
          
          if (c !== undefined) {
             if (isHost) {
                 setCurrentSlot(c);
             } else {
                 // 💡 منطق الزوار الذكي لمعالجة "الكواليس"
                 const currentSlots = s || slots;
                 const whiteIndexes = currentSlots.map((slot, idx) => slot.lock === 'white' ? idx : -1).filter(idx => idx !== -1);
                 
                 if (whiteIndexes.length > 0) {
                     if (whiteIndexes.includes(c)) {
                         // إذا انتقل المضيف إلى شاشة بيضاء، اسحب الزوار إليها
                         setCurrentSlot(c);
                     } else {
                         // إذا انتقل المضيف للكواليس (شاشة غير بيضاء)، أبقِ الزوار في شاشتهم البيضاء الحالية
                         setCurrentSlot(prev => whiteIndexes.includes(prev) ? prev : whiteIndexes[0]);
                     }
                 } else {
                     setCurrentSlot(c); // السلوك الافتراضي إذا لم يكن هناك قفل أبيض
                 }
             }
          }
        })
        .on('broadcast', { event: 'room_closed' }, () => {
          if (!isHost) handleExit();
        })
        .subscribe(async (status) => { 
            if (status === 'SUBSCRIBED') {
                await channel.track({ name: myName, id: user.id, isHost, hostRoomName: isHost ? roomName : undefined });
            } 
        });
      
      return () => { supabase.removeChannel(channel); channelRef.current = null; };
    }
  }, [roomId, isHost, user, myName, displayRoomName]); 

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (channelRef.current) { 
      try { 
        await channelRef.current.send({ 
          type: 'broadcast', event: 'room_state', 
          payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode, senderId: user?.id } 
        }); 
      } catch (err) {} 
    }
  };

  const updateSlot = (index: number, data: SlotData) => {
    if (!canEditSlot(index)) return;
    const newSlots = [...slots]; 
    newSlots[index] = { ...data, lock: slots[index].lock }; 
    setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const toggleLock = (index: number) => {
    if (!isHost) return;
    const newSlots = [...slots];
    const currentLock = newSlots[index].lock || 'none';
    
    let nextLock: LockState;

    if (viewMode === 'sync') {
      // 💡 الغرفة مغلقة: التبديل فقط بين القفل الأبيض أو لا شيء
      nextLock = currentLock === 'white' ? 'none' : 'white';
    } else {
      // 💡 الغرفة مفتوحة: التبديل بين كل الألوان
      const nextLockMap: Record<LockState, LockState> = { 
        'none': 'green', 'green': 'yellow', 'yellow': 'red', 'red': 'white', 'white': 'none' 
      };
      nextLock = nextLockMap[currentLock];
    }

    newSlots[index].lock = nextLock;
    setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const canEditSlot = (index: number) => {
    if (isHost) return true;
    if (viewMode === 'sync') return false;
    return (slots[index].lock || 'none') === 'none';
  };

  const handleNavigation = (targetSlot: number) => {
    if (targetSlot === currentSlot) return;
    const targetLock = slots[targetSlot].lock || 'none';

    if (isHost) {
      setCurrentSlot(targetSlot);
      broadcastState(targetSlot, slots, viewMode);
      resetIdleTimer();
      return;
    }

    if (viewMode === 'sync') return;
    if (targetLock === 'red' || targetLock === 'white') return; 

    setCurrentSlot(targetSlot);
    if (targetLock === 'yellow') {
       // Local navigation
    } else {
       // Global navigation
       broadcastState(targetSlot, slots, viewMode);
    }
    resetIdleTimer();
  };

  // 💡 منع الزوار تماماً من التنقل إذا وجد قفل أبيض
  const getLeftTarget = () => {
    if (isHost) return currentSlot - 1;
    const hasWhiteLock = slots.some(s => s.lock === 'white');
    if (hasWhiteLock) return -1; 
    
    if (viewMode === 'sync') return -1;
    for (let i = currentSlot - 1; i >= 0; i--) {
        if (slots[i].lock !== 'red') return i;
    }
    return -1;
  };

  const getRightTarget = () => {
    if (isHost) return currentSlot + 1;
    const hasWhiteLock = slots.some(s => s.lock === 'white');
    if (hasWhiteLock) return -1;

    if (viewMode === 'sync') return -1;
    for (let i = currentSlot + 1; i <= 2; i++) {
        if (slots[i].lock !== 'red') return i;
    }
    return -1;
  };

  const leftTarget = getLeftTarget();
  const rightTarget = getRightTarget();
  
  const canGoLeft = leftTarget >= 0 && leftTarget <= 2;
  const canGoRight = rightTarget >= 0 && rightTarget <= 2;

  const renderSlotContent = (slot: SlotData, index: number) => {
    const editable = canEditSlot(index);
    const lockState = slot.lock || 'none';
    
    const lockColors = {
      'none': 'border-white/20 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/40',
      'green': 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]',
      'yellow': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]',
      'red': 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
      'white': 'bg-white/20 border-white/50 text-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
    };

    const LockIndicator = () => {
       if (!isHost) {
           // 💡 الزوار لا يرون الأقفال في الوضع المغلق، إلا إذا كان القفل أبيض
           if (viewMode === 'sync' && lockState !== 'white') return null;
           // الزوار لا يرون الأيقونات الفارغة أبداً
           if (lockState === 'none') return null;
       } else {
           // المضيف يخضع لظهور الأقفال التسلسلي
           if (index === 2 && lockState === 'none' && slots[1].lock === 'none') return null;
           if (index === 0 && lockState === 'none' && slots[2].lock === 'none') return null;
       }

       return (
         <div className={`absolute top-4 ${dir === 'rtl' ? 'right-4' : 'left-4'} md:top-6 md:${dir === 'rtl' ? 'right-6' : 'left-6'} z-[80] transition-all duration-500 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           {isHost ? (
              <button onClick={() => toggleLock(index)} className={`w-7 h-7 rounded-full border flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 ${lockColors[lockState]}`}>
                {lockState === 'none' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              </button>
           ) : (
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center backdrop-blur-md ${lockColors[lockState]}`}>
                <Lock className="w-3 h-3" />
              </div>
           )}
         </div>
       );
    };

    if (slot.type === 'empty') {
      return (
        <div className="flex flex-col items-center justify-center h-full relative group">
          <LockIndicator />
          {editable ? (
            <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-28 h-28 rounded-full border border-[#00b4d8]/50 bg-[#00b4d8]/10 flex items-center justify-center hover:bg-[#00b4d8]/20 transition-all shadow-xl"><Plus className="w-12 h-12 text-[#00b4d8]" /></button>
          ) : (
            <p className="text-[#00b4d8] font-mono tracking-widest uppercase text-sm">{t('waitingForHost') || 'WAITING FOR HOST...'}</p>
          )}
        </div>
      );
    }
    
    if (slot.type === 'menu') {
      return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-5xl mx-auto p-4 overflow-y-auto relative group" dir={dir}>
          <LockIndicator />
          <div className="flex justify-center items-center w-full mb-8 pt-10">
            <h3 className="text-3xl font-extrabold text-white">{isAr ? 'إضافة محتوى' : 'Add Content'}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 md:top-8 md:${dir === 'rtl' ? 'left-8' : 'right-8'} p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all`}><X className="w-6 h-6" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full pb-24">
             <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-cyan-400 font-bold uppercase tracking-wider">{isAr ? 'الإنترنت والمشاهدة' : 'Internet'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'web' })} className="p-6 bg-black/20 border border-white/5 hover:border-cyan-500/40 rounded-2xl transition-all"><Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Web</span></button>
                <button onClick={() => { const url = prompt('YouTube URL:'); if (url) updateSlot(index, { type: 'youtube', url }); }} className="p-6 bg-black/20 border border-white/5 hover:border-red-500/40 rounded-2xl transition-all"><Youtube className="w-8 h-8 text-red-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">YouTube</span></button>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-purple-400 font-bold uppercase tracking-wider">{isAr ? 'الشرح والتعليم' : 'Education'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-6 bg-black/20 border border-white/5 hover:border-purple-500/40 rounded-2xl transition-all"><PenTool className="w-8 h-8 text-purple-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Board</span></button>
                <button onClick={() => updateSlot(index, { type: 'screen_share' })} className="p-6 bg-black/20 border border-white/5 hover:border-indigo-500/40 rounded-2xl transition-all"><MonitorUp className="w-8 h-8 text-indigo-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Screen</span></button>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-emerald-400 font-bold uppercase tracking-wider">{isAr ? 'الملفات والعرض' : 'Files'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'media' })} className="p-6 bg-black/20 border border-white/5 hover:border-emerald-500/40 rounded-2xl transition-all"><ImageIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Media</span></button>
                <button onClick={() => updateSlot(index, { type: 'document' })} className="p-6 bg-black/20 border border-white/5 hover:border-teal-500/40 rounded-2xl transition-all"><FileText className="w-8 h-8 text-teal-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Docs</span></button>
              </div>
            </div>
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
        {!editable && <div className="absolute inset-0 z-[60] bg-transparent" />}
        <LockIndicator />
        {editable && <div className={`absolute top-4 ${dir === 'rtl' ? 'left-4' : 'right-4'} md:top-8 md:${dir === 'rtl' ? 'left-8' : 'right-8'} z-[70] transition-all duration-500 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 shadow-lg"><X className="w-6 h-6" /></button></div>}
        {slot.type === 'web' && <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center"><Globe className="w-20 h-20 text-cyan-500/50 mb-6" /><h2 className="text-2xl text-white font-bold">Web Browser</h2></div>}
        {slot.type === 'youtube' && <div className="w-full h-full bg-black flex items-center justify-center">{slot.url ? <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${slot.url}?autoplay=1`} allowFullScreen className={`w-full h-full border-0 ${editable ? 'pointer-events-auto' : 'pointer-events-none'}`}></iframe> : <Youtube className="w-20 h-20 text-red-500/50" />}</div>}
        {slot.type === 'whiteboard' && <div className={`w-full h-full p-4 ${editable ? 'pointer-events-auto' : 'pointer-events-none'}`}><Whiteboard roomId={roomId} canInteract={editable} /></div>}
        {slot.type === 'media' && <div className="w-full h-full bg-slate-900/80 flex flex-col items-center justify-center"><ImageIcon className="w-20 h-20 text-green-500/50 mb-6" /><h2 className="text-2xl text-white font-bold">Gallery</h2></div>}
        {slot.type === 'camera' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white uppercase tracking-widest">Camera Stream</div>}
        {slot.type === 'mic' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white uppercase tracking-widest">Audio Stream</div>}
        {slot.type === 'document' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white uppercase tracking-widest">Document Viewer</div>}
        {slot.type === 'screen_share' && <div className="w-full h-full bg-slate-900 flex items-center justify-center font-bold text-white uppercase tracking-widest">Screen Sharing</div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      <div className="absolute top-0 left-0 right-0 h-16 z-[100] flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <button onClick={handleExitClick} className="p-2 bg-red-500/20 text-red-400 rounded-full transition-all shadow-lg"><LogOut className="w-5 h-5" /></button>
        <div className="flex justify-center"><button onClick={() => { if (!isHost) return; const m = viewMode === 'sync' ? 'free' : 'sync'; setViewMode(m); broadcastState(currentSlot, slots, m); }} disabled={!isHost} className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>{viewMode === 'sync' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}<span className="text-xs font-bold uppercase">{viewMode}</span></button></div>
        <div className="flex items-center gap-3"><span className="text-white font-mono font-bold tracking-widest text-xs truncate max-w-[120px] uppercase opacity-70">{displayRoomName}</span><button onClick={async () => { if (navigator.share) { try { await navigator.share({ title: `انضم لغرفتي`, text: `Join my room "${displayRoomName}"\nhttps://app.com/room/${roomId}?name=${encodeURIComponent(displayRoomName)}` }); } catch(e){} } else { alert('Copied!'); } }} className="p-2.5 bg-blue-600 text-white rounded-full shadow-lg"><Share2 className="w-5 h-5" /></button></div>
      </div>
      
      <div className="flex-1 w-full flex flex-col relative" onMouseMove={resetIdleTimer} onTouchStart={resetIdleTimer} onClick={resetIdleTimer}>
          {canGoLeft && <button onClick={() => handleNavigation(leftTarget)} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 z-[90] p-3 bg-black/20 text-white/50 rounded-full transition-all duration-500 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-black/40 hover:text-white'}`}><ChevronLeft className="w-8 h-8" /></button>}
          {canGoRight && <button onClick={() => handleNavigation(rightTarget)} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 z-[90] p-3 bg-black/20 text-white/50 rounded-full transition-all duration-500 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-black/40 hover:text-white'}`}><ChevronRight className="w-8 h-8" /></button>}

          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            <div className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out w-[300%]" style={{ transform: `translateX(${dir === 'rtl' ? currentSlot * 33.333 : -currentSlot * 33.333}%)` }}>
               {slots.map((s, i) => (
                  <div key={i} className="w-1/3 h-full pt-16 flex-shrink-0">
                     {renderSlotContent(s, i)}
                  </div>
               ))}
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
