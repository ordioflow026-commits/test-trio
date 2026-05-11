import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, Lock, Unlock, LogOut, Video, Share2, Layers, BookOpen, FolderOpen, Camera, Mic, MicOff, FileText, MonitorUp, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import Whiteboard from '../components/Whiteboard';
import SyncYouTubePlayer from '../components/SyncYouTubePlayer';
import SyncMediaViewer from '../components/SyncMediaViewer';
import Notebook from '../components/Notebook';
import UniversalViewer from '../components/UniversalViewer';
import RoomChat from '../components/RoomChat';
import LiveMeeting from '../components/LiveMeeting';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'notes' | 'media' | 'camera' | 'screen_share' | 'document' | 'mic' | 'live';
type ViewMode = 'sync' | 'free';
type LockState = 'none' | 'green' | 'yellow' | 'red' | 'white';

interface SlotData { type: ContentType; url?: string; lock?: LockState; }
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; roomName?: string; onNameSync?: (id: string, name: string) => void; }

// 🎵 مكون الترددات الصوتية الجمالي
const SoundWave = ({ color = "bg-[#00b4d8]" }: { color?: string }) => (
  <div className="flex items-center gap-[3px] h-4">
    <div className={`w-1 rounded-full ${color} animate-soundwave-1`}></div>
    <div className={`w-1 rounded-full ${color} animate-soundwave-2`}></div>
    <div className={`w-1 rounded-full ${color} animate-soundwave-3`}></div>
    <div className={`w-1 rounded-full ${color} animate-soundwave-4`}></div>
  </div>
);

export default function TripleScreenRoom({ onExit, isHost = false, roomId, roomName, onNameSync }: Props) {
  const { t, dir, language } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string, isVoiceActive: boolean }[]>([]);
  
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty', lock: 'none' }, { type: 'empty', lock: 'none' }, { type: 'empty', lock: 'none' }]);
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 
  
  const isAr = language === 'ar';
  const stateRef = useRef({ slots, currentSlot, viewMode });
  const hostWasPresent = useRef(false);

  // 🎤 حالات الصوت والخلفية
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const zcInstance = useRef<any>(null);

  const [isIdle, setIsIdle] = useState(false);
  const [openLockMenu, setOpenLockMenu] = useState<number | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState<number | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [showWebModal, setShowWebModal] = useState<number | null>(null);
  const [webInput, setWebInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const idleTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const canInteract = isHost || viewMode === 'free';
  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  useEffect(() => { stateRef.current = { slots, currentSlot, viewMode }; }, [slots, currentSlot, viewMode]);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 3000); 
  };

  useEffect(() => { resetIdleTimer(); return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); }; }, []);

  const handleExit = () => { 
    if (zcInstance.current) { try { zcInstance.current.destroy(); } catch (e) {} } 
    onExit(); 
  };

  const handleExitClick = async () => {
    if (isHost && channelRef.current) {
        try { await channelRef.current.send({ type: 'broadcast', event: 'room_closed' }); await new Promise(resolve => setTimeout(resolve, 300)); } catch (err) {}
    }
    handleExit();
  };

  // 💡 دالة تشغيل الصوت الخفية والآمنة
  const toggleVoiceChat = async () => {
    const newState = !isVoiceActive;
    setIsVoiceActive(newState);

    // تحديث حالة الحضور في قاعدة البيانات ليراها الجميع
    if (channelRef.current && user) {
      try { await channelRef.current.track({ name: myName, id: user.id, isHost, hostRoomName: isHost ? roomName : undefined, isVoiceActive: newState }); } catch(e) {}
    }

    if (!newState) {
      if (zcInstance.current) { try { zcInstance.current.destroy(); } catch (e) {} zcInstance.current = null; }
    } else {
      setTimeout(async () => {
        if (!audioContainerRef.current) return;
        try {
          const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
          const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;
          if (!appID || !serverSecret) { alert(isAr ? 'بيانات Zego مفقودة' : 'Zego config missing'); setIsVoiceActive(false); return; }

          const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, `audio_${roomId}`, user?.id || Date.now().toString(), myName);
          const zc = ZegoUIKitPrebuilt.create(kitToken);
          zcInstance.current = zc;
          
          zc.joinRoom({
            container: audioContainerRef.current,
            scenario: { mode: ZegoUIKitPrebuilt.GroupCall },
            showMyCameraToggleButton: false,
            showMyMicrophoneToggleButton: false,
            showAudioVideoSettingsButton: false,
            showScreenSharingButton: false,
            showTextChat: false,
            showUserList: false,
            showPreJoinView: false,
            showLeaveRoomConfirmDialog: false,
            turnOnCameraWhenJoining: false,
            turnOnMicrophoneWhenJoining: true,
            layout: 'Floating',
          });
        } catch (err) { setIsVoiceActive(false); }
      }, 100);
    }
  };

  useEffect(() => {
    if (roomId && user) {
      const channel = supabase.channel(`room_${roomId}`, { config: { presence: { key: user.id } } });
      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activeUsers: { id: string, name: string, isVoiceActive: boolean }[] = [];
          let hostFound = false;
          
          Object.keys(presenceState).forEach((key) => {
            const userData = presenceState[key][0] as any;
            if (userData.isHost) hostFound = true;
            if (key !== user.id) activeUsers.push({ id: key, name: userData.name || 'Guest', isVoiceActive: !!userData.isVoiceActive });
            if (!isHost && userData.isHost && userData.hostRoomName && userData.hostRoomName !== displayRoomName) {
               setDisplayRoomName(userData.hostRoomName);
               if (onNameSync && roomId) onNameSync(roomId, userData.hostRoomName);
            }
          });
          setParticipants(activeUsers);

          if (isHost) channel.send({ type: 'broadcast', event: 'room_state', payload: { ...stateRef.current, senderId: user.id } });
          else {
             if (hostFound) hostWasPresent.current = true;
             else if (hostWasPresent.current && !hostFound) { alert(isAr ? 'أنهى المضيف الجلسة.' : 'Host ended session.'); handleExit(); }
          }
        })
        .on('broadcast', { event: 'room_state' }, (payload) => {
          const { slots: s, currentSlot: c, viewMode: m, senderId } = payload.payload;
          if (senderId === user.id) return; 
          if (s) setSlots(s);
          if (m) setViewMode(m);
          if (c !== undefined) {
             if (isHost) setCurrentSlot(c);
             else {
                 const currentSlots = s || slots;
                 const whiteIndexes = currentSlots.map((slot, idx) => slot.lock === 'white' ? idx : -1).filter(idx => idx !== -1);
                 if (whiteIndexes.length > 0) setCurrentSlot(prev => whiteIndexes.includes(c) ? c : (whiteIndexes.includes(prev) ? prev : whiteIndexes[0]));
                 else setCurrentSlot(c);
             }
          }
        })
        .on('broadcast', { event: 'room_closed' }, () => { if (!isHost) handleExit(); })
        .subscribe(async (status) => { 
            if (status === 'SUBSCRIBED') await channel.track({ name: myName, id: user.id, isHost, hostRoomName: isHost ? roomName : undefined, isVoiceActive });
        });
      
      return () => { supabase.removeChannel(channel); channelRef.current = null; };
    }
  }, [roomId, isHost, user, myName, displayRoomName, isVoiceActive]); 

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (channelRef.current) { try { await channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode, senderId: user?.id } }); } catch (err) {} }
  };

  const updateSlot = (index: number, data: SlotData) => {
    if (!canEditSlot(index)) return;
    const newSlots = [...slots]; newSlots[index] = { ...data, lock: slots[index].lock }; setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const setSlotLock = (index: number, lock: LockState) => {
    if (!isHost) return;
    const newSlots = [...slots]; newSlots[index].lock = lock; setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode); setOpenLockMenu(null);
  };

  const canEditSlot = (index: number) => {
    if (isHost) return true;
    if (viewMode === 'sync') return false;
    return (slots[index].lock || 'none') === 'none';
  };

  const handleNavigation = (targetSlot: number) => {
    if (targetSlot === currentSlot) return;
    const targetLock = slots[targetSlot].lock || 'none';
    if (isHost) { setCurrentSlot(targetSlot); broadcastState(targetSlot, slots, viewMode); resetIdleTimer(); return; }
    if (viewMode === 'sync') return;
    if (targetLock === 'red' || targetLock === 'white') return; 
    setCurrentSlot(targetSlot);
    if (targetLock !== 'yellow') broadcastState(targetSlot, slots, viewMode);
    resetIdleTimer();
  };

  const getLeftTarget = () => {
    if (isHost) return currentSlot - 1;
    if (slots.some(s => s.lock === 'white') || viewMode === 'sync') return -1; 
    for (let i = currentSlot - 1; i >= 0; i--) { if (slots[i].lock !== 'red') return i; }
    return -1;
  };

  const getRightTarget = () => {
    if (isHost) return currentSlot + 1;
    if (slots.some(s => s.lock === 'white') || viewMode === 'sync') return -1;
    for (let i = currentSlot + 1; i <= 2; i++) { if (slots[i].lock !== 'red') return i; }
    return -1;
  };

  const leftTarget = getLeftTarget(); const rightTarget = getRightTarget();
  const canGoLeft = leftTarget >= 0 && leftTarget <= 2; const canGoRight = rightTarget >= 0 && rightTarget <= 2;

  const renderSlotContent = (slot: SlotData, index: number) => {
    const editable = canEditSlot(index);
    const lockState = slot.lock || 'none';
    const canInteractInside = editable || (!isHost && lockState === 'yellow');
    
    const lockColors = {
      'none': 'bg-slate-900/60 border-[#00b4d8]/40 text-white/50 hover:bg-[#00b4d8]/20 hover:text-white hover:border-[#00b4d8] shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
      'green': 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]',
      'yellow': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]',
      'red': 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
      'white': 'bg-white/20 border-white/50 text-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
    };

    const LockIndicator = () => {
       if (!isHost || (index === 2 && lockState === 'none' && slots[1].lock === 'none') || (index === 0 && lockState === 'none' && slots[2].lock === 'none')) return null; 
       const isMenuOpen = openLockMenu === index;
       const labels: Record<LockState, string> = dir === 'rtl' ? { none: 'إلغاء القفل', green: 'مرن وتفاعلي', yellow: 'تنبيه للمتابعة', red: 'إجبار المشاهدة', white: 'وضع الكواليس' } : { none: 'Unlock All', green: 'Flexible Mode', yellow: 'Stay Alert', red: 'Force View', white: 'Backstage Mode' };
       const baseColors: LockState[] = ['green', 'yellow', 'red', 'white'];
       const availableLocks: LockState[] = lockState === 'none' ? baseColors : baseColors.map(color => color === lockState ? 'none' : color);

       return (
         <div className={`absolute top-4 ${dir === 'rtl' ? 'right-4' : 'left-4'} md:top-6 md:${dir === 'rtl' ? 'right-6' : 'left-6'} z-[80] transition-all duration-500 ${isIdle && !isMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <div className="flex items-start gap-3">
               <button onClick={() => { if (viewMode === 'sync') { setSlotLock(index, lockState === 'white' ? 'none' : 'white'); setOpenLockMenu(null); } else setOpenLockMenu(isMenuOpen ? null : index); }} className={`w-8 h-8 rounded-full border flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 shrink-0 ${lockColors[lockState]} ${isMenuOpen ? 'ring-2 ring-[#00b4d8]' : ''}`}>
                 {lockState === 'none' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
               </button>
               {isMenuOpen && viewMode !== 'sync' && (
                   <div dir="ltr" className="flex flex-col gap-2 p-2 bg-[#0f172a]/95 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200 min-w-[140px]">
                       {availableLocks.map((l, i) => (
                           <button key={`${l}-${i}`} onClick={() => setSlotLock(index, l)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                               <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${lockColors[l]} group-hover:scale-110 transition-transform`}>{l === 'none' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}</div>
                               <span className="text-[10px] font-bold whitespace-nowrap text-slate-200">{labels[l]}</span>
                           </button>
                       ))}
                   </div>
               )}
           </div>
         </div>
       );
    };

    if (slot.type === 'empty') return (<div className="flex flex-col items-center justify-center h-full relative group"><LockIndicator />{editable ? <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-28 h-28 rounded-full border border-[#00b4d8]/50 bg-[#00b4d8]/10 flex items-center justify-center hover:bg-[#00b4d8]/20 transition-all shadow-xl"><Plus className="w-12 h-12 text-[#00b4d8]" /></button> : <p className="text-[#00b4d8] font-mono tracking-widest uppercase text-sm">{t('waitingForHost') || 'WAITING...'}</p>}</div>);
    
    if (slot.type === 'menu') return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-5xl mx-auto p-4 overflow-y-auto relative group" dir={dir}>
          <LockIndicator />
          <div className="flex justify-center items-center w-full mb-8 pt-10">
            <h3 className="text-3xl font-extrabold text-white">{isAr ? 'إضافة محتوى' : 'Add Content'}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-4 md:top-8 md:${dir === 'rtl' ? 'left-8' : 'right-8'} z-[100] p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all`}><X className="w-6 h-6" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full pb-24">
             <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-cyan-400 font-bold uppercase tracking-wider">{isAr ? 'الإنترنت والمشاهدة' : 'Internet'}</h4>
              <div className="grid grid-cols-2 gap-4"><button onClick={() => setShowWebModal(index)} className="p-6 bg-black/20 border border-white/5 hover:border-cyan-500/40 rounded-2xl transition-all"><Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Web</span></button><button onClick={() => setShowYoutubeModal(index)} className="p-6 bg-black/20 border border-white/5 hover:border-red-500/40 rounded-2xl transition-all"><Youtube className="w-8 h-8 text-red-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">YouTube</span></button></div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-purple-400 font-bold uppercase tracking-wider">{isAr ? 'الشرح والتعليم' : 'Education'}</h4>
              <div className="grid grid-cols-2 gap-3"><button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-4 bg-black/20 border border-white/5 hover:border-purple-500/40 rounded-2xl transition-all"><PenTool className="w-6 h-6 text-purple-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Board</span></button><button onClick={() => updateSlot(index, { type: 'notes' })} className="p-4 bg-black/20 border border-white/5 hover:border-blue-500/40 rounded-2xl transition-all"><FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Notes</span></button></div>
            </div>
          </div>
        </div>
    );
    
    return (
      <div className="flex flex-col items-center justify-center h-full w-full relative group">
        {!editable && lockState !== 'yellow' && <div className="absolute inset-0 z-[60] bg-transparent pointer-events-auto" />}
        <LockIndicator />
        {editable && <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><button onClick={() => updateSlot(index, { type: 'empty' })} className="p-3 bg-slate-900/60 border-2 border-[#00b4d8]/80 rounded-full text-red-400 shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-md transition-transform hover:scale-110 pointer-events-auto hover:bg-[#00b4d8]/20"><X className="w-6 h-6" /></button></div>}
        {slot.type === 'web' && <div className="w-full h-full bg-slate-900 relative overflow-hidden">{slot.url ? <iframe src={slot.url} className="w-full h-full border-0 bg-white pointer-events-auto" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" /> : <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none"><Globe className="w-20 h-20 text-cyan-500/50 mb-6 animate-pulse" /><h2 className="text-2xl text-white font-bold">{isAr ? 'في انتظار الرابط...' : 'Waiting for URL...'}</h2></div>}</div>}
        {slot.type === 'youtube' && <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">{slot.url ? <SyncYouTubePlayer videoId={slot.url} isHost={isHost} roomId={roomId as string} canInteract={canInteractInside} isActive={currentSlot === index} /> : <Youtube className="w-20 h-20 text-red-500/50" />}</div>}
        {slot.type === 'whiteboard' && <div className={`w-full h-full p-4 ${canInteractInside ? 'pointer-events-auto' : 'pointer-events-none'}`}><Whiteboard roomId={roomId} canInteract={canInteractInside} isLocalOnly={!editable} /></div>}
        {slot.type === 'media' && <div className="w-full h-full bg-black relative overflow-hidden"><SyncMediaViewer url={slot.url} canInteract={canInteractInside} isLocalOnly={!editable} onUploadSuccess={(url) => updateSlot(index, { type: 'media', url })} roomId={roomId} isHost={isHost} slotIndex={index} viewMode={viewMode} /></div>}
        {slot.type === 'notes' && <div className={`w-full h-full p-4 ${canInteractInside ? 'pointer-events-auto' : 'pointer-events-none'}`}><Notebook roomId={roomId} canInteract={canInteractInside} isLocalOnly={!editable} /></div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      {/* CSS للترددات الصوتية */}
      <style>{`
        @keyframes soundwave { 0%, 100% { height: 4px; } 50% { height: 16px; } }
        .animate-soundwave-1 { animation: soundwave 0.6s ease-in-out infinite; }
        .animate-soundwave-2 { animation: soundwave 0.7s ease-in-out infinite 0.1s; }
        .animate-soundwave-3 { animation: soundwave 0.5s ease-in-out infinite 0.2s; }
        .animate-soundwave-4 { animation: soundwave 0.8s ease-in-out infinite 0.3s; }
      `}</style>

      <div className="absolute top-0 left-0 right-0 h-16 z-[100] flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
        <button onClick={handleExitClick} className="p-2 bg-red-500/20 text-red-400 rounded-full transition-all shadow-lg"><LogOut className="w-5 h-5" /></button>
        
        <div className="flex justify-center gap-3">
          <button onClick={() => { if (!isHost) return; const m = viewMode === 'sync' ? 'free' : 'sync'; setViewMode(m); broadcastState(currentSlot, slots, m); }} disabled={!isHost} className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>{viewMode === 'sync' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}<span className="text-xs font-bold uppercase hidden sm:block">{viewMode}</span></button>
          
          <button 
             onClick={toggleVoiceChat} 
             className={`flex items-center gap-2 px-5 py-2 rounded-full border backdrop-blur-sm transition-all shadow-lg ${isVoiceActive ? 'border-green-500 bg-green-500/20 text-green-400 ring-2 ring-green-500/50' : 'border-slate-500 bg-slate-800/80 text-slate-300 hover:bg-slate-700'}`}
           >
             {isVoiceActive ? <SoundWave color="bg-green-400" /> : <MicOff className="w-4 h-4" />}
             <span className={`text-xs font-bold uppercase ${isVoiceActive ? 'text-green-400' : 'text-slate-300'}`}>{isAr ? 'تحدث' : 'Voice'}</span>
           </button>
        </div>

        <div className="flex items-center gap-3"><span className="text-white font-mono font-bold tracking-widest text-xs truncate max-w-[90px] uppercase opacity-70 hidden sm:block">{displayRoomName}</span><button onClick={async () => { if (navigator.share) { try { await navigator.share({ title: `انضم لغرفتي`, text: `Join my room "${displayRoomName}"\nhttps://app.com/room/${roomId}?name=${encodeURIComponent(displayRoomName)}` }); } catch(e){} } else { alert('Copied!'); } }} className="p-2.5 bg-blue-600 text-white rounded-full shadow-lg"><Share2 className="w-5 h-5" /></button></div>
      </div>
      
      <div className="flex-1 w-full flex flex-col relative" onMouseMove={resetIdleTimer} onTouchStart={resetIdleTimer} onClick={resetIdleTimer}>
          {canGoLeft && <div className={`absolute ${dir === 'rtl' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 z-[90] flex items-center justify-center group pointer-events-none`}><button onClick={() => { resetIdleTimer(); handleNavigation(leftTarget); }} onMouseEnter={resetIdleTimer} onTouchStart={resetIdleTimer} className={`p-3 bg-slate-900/60 border-2 border-[#00b4d8]/80 text-[#00b4d8] rounded-full transition-all duration-500 hover:bg-[#00b4d8]/80 hover:text-white hover:scale-110 pointer-events-auto shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-md ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><ChevronLeft className="w-8 h-8" /></button></div>}
          {canGoRight && <div className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 z-[90] flex items-center justify-center group pointer-events-none`}><button onClick={() => { resetIdleTimer(); handleNavigation(rightTarget); }} onMouseEnter={resetIdleTimer} onTouchStart={resetIdleTimer} className={`p-3 bg-slate-900/60 border-2 border-[#00b4d8]/80 text-[#00b4d8] rounded-full transition-all duration-500 hover:bg-[#00b4d8]/80 hover:text-white hover:scale-110 pointer-events-auto shadow-[0_4px_12px_rgba(0,0,0,0.3)] backdrop-blur-md ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><ChevronRight className="w-8 h-8" /></button></div>}

          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            <div dir="ltr" className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out w-[300%]" style={{ transform: `translateX(-${currentSlot * 33.333333}%)` }}>
               {slots.map((s, i) => (
                  <div key={i} className={`w-1/3 h-full pt-16 flex-shrink-0 relative ${currentSlot === i ? 'z-50' : 'z-0'}`}>
                     {currentSlot !== i && <div className="absolute inset-0 z-[999] bg-transparent cursor-default"></div>}
                     <div className={`w-full h-full ${currentSlot === i ? 'pointer-events-auto' : 'pointer-events-none'}`}>{renderSlotContent(s, i)}</div>
                  </div>
               ))}
            </div>
          </div>

          {/* 💡 شريط المستخدمين بالأسفل مع مؤشر التحدث الجمالي */}
          <div className="h-[90px] w-full bg-[#1e293b]/90 backdrop-blur-xl border-t border-slate-700/50 flex items-center px-4 relative z-30">
              <div className="flex items-center gap-5 w-full overflow-x-auto no-scrollbar pb-1">
                  
                  <div className="flex flex-col items-center gap-1.5 shrink-0 relative">
                     <div className={`w-[50px] h-[50px] rounded-[16px] bg-[#0f172a] border-2 flex items-center justify-center relative transition-colors ${isVoiceActive ? 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'border-[#00b4d8]'}`}>
                        <span className={`font-bold text-xl uppercase ${isVoiceActive ? 'text-green-400' : 'text-[#00b4d8]'}`}>{myInitial}</span>
                        {isVoiceActive && <div className="absolute -top-3 -right-3 bg-slate-900 rounded-full px-1.5 border border-slate-700"><SoundWave color="bg-green-400"/></div>}
                     </div>
                     <span className={`text-[10px] font-bold ${isVoiceActive ? 'text-green-400' : 'text-[#00b4d8]'}`}>{myName} (أنت)</span>
                  </div>

                  {participants.map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-1.5 shrink-0 relative">
                       <div className={`w-[50px] h-[50px] rounded-[16px] flex items-center justify-center relative transition-colors ${p.isVoiceActive ? 'bg-slate-800 border-2 border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.4)]' : 'bg-[#00b4d8] border-none'}`}>
                          <span className={`font-bold text-xl uppercase ${p.isVoiceActive ? 'text-green-400' : 'text-white'}`}>{p.name.charAt(0).toUpperCase()}</span>
                          {p.isVoiceActive && <div className="absolute -top-3 -right-3 bg-slate-900 rounded-full px-1.5 border border-slate-700"><SoundWave color="bg-green-400"/></div>}
                       </div>
                       <span className={`text-[10px] font-medium ${p.isVoiceActive ? 'text-green-400 font-bold' : 'text-white'}`}>{p.name}</span>
                    </div>
                  ))}
              </div>
          </div>
      </div>

      {/* 💡 صندوق Zego مخفي تماماً 100% ولا يحجب الشاشة */}
      <div className="fixed top-[-9999px] left-[-9999px] w-[1px] h-[1px] opacity-0 overflow-hidden pointer-events-none z-[-1]">
         <div ref={audioContainerRef} className="w-full h-full"></div>
      </div>

      {showYoutubeModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/50 p-6 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{isAr ? 'إضافة فيديو يوتيوب' : 'Add YouTube Video'}</h3>
            <input type="text" value={youtubeInput} onChange={(e) => setYoutubeInput(e.target.value)} placeholder={isAr ? 'ضع رابط الفيديو هنا...' : 'Paste video link here...'} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none mb-6" dir="ltr" />
            <div className="flex justify-end gap-3"><button onClick={() => {setShowYoutubeModal(null); setYoutubeInput('');}} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { if(youtubeInput.trim()) { updateSlot(showYoutubeModal, { type: 'youtube', url: youtubeInput }); setShowYoutubeModal(null); setYoutubeInput(''); } }} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold">{isAr ? 'إضافة' : 'Add'}</button></div>
          </div>
        </div>
      )}

      {showWebModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/50 p-6 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{isAr ? 'تصفح موقع ويب' : 'Browse Website'}</h3>
            <input type="url" value={webInput} onChange={(e) => setWebInput(e.target.value)} placeholder="https://example.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none mb-6" dir="ltr" />
            <div className="flex justify-end gap-3"><button onClick={() => {setShowWebModal(null); setWebInput('');}} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { let url = webInput.trim(); if(url) { if(!url.startsWith('http')) url = 'https://' + url; updateSlot(showWebModal, { type: 'web', url: url }); setShowWebModal(null); setWebInput(''); } }} className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold">{isAr ? 'فتح الموقع' : 'Open'}</button></div>
          </div>
        </div>
      )}

      <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className={`fixed bottom-28 ${dir === 'rtl' ? 'left-4' : 'right-4'} z-[80] p-4 bg-cyan-600 hover:bg-cyan-500 rounded-full shadow-lg text-white transition-transform hover:scale-110 active:scale-95`} title="الدردشة">
        <MessageCircle className="w-6 h-6"/>
        {unreadCount > 0 && !isChatOpen && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 animate-bounce">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      <RoomChat roomId={roomId} isHost={isHost} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onNewMessage={() => { if (!isChatOpen) setUnreadCount(prev => prev + 1); }} />
    </div>
  );
}
