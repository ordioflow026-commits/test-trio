import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Globe, Youtube, PenTool, Image as ImageIcon, X, Lock, Unlock, LogOut, Video, Share2, Layers, BookOpen, FolderOpen, Camera, Mic, MicOff, FileText, MonitorUp, MessageCircle, Hand, Check } from 'lucide-react';
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
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'notes' | 'media' | 'camera' | 'screen_share' | 'document' | 'mic' | 'live';
type ViewMode = 'sync' | 'free';
type LockState = 'none' | 'green' | 'yellow' | 'red' | 'white' | 'black';

interface SlotData { type: ContentType; url?: string; lock?: LockState; allowedUsers?: string[]; }
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; roomName?: string; onNameSync?: (id: string, name: string) => void; }

const SoundWave = ({ color = "bg-green-400" }: { color?: string }) => (
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
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty', lock: 'none', allowedUsers: [] }, { type: 'empty', lock: 'none', allowedUsers: [] }, { type: 'empty', lock: 'none', allowedUsers: [] }]);
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 
  const isAr = language === 'ar';
  const stateRef = useRef({ slots, currentSlot, viewMode });

  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const zgRef = useRef<ZegoExpressEngine | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const [isIdle, setIsIdle] = useState(false);
  const [openLockMenu, setOpenLockMenu] = useState<number | null>(null);
  const [showYoutubeModal, setShowYoutubeModal] = useState<number | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [showWebModal, setShowWebModal] = useState<number | null>(null);
  const [webInput, setWebInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [knockRequest, setKnockRequest] = useState<{ userName: string, userId: string, slotIndex: number } | null>(null);
  const idleTimerRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  useEffect(() => { stateRef.current = { slots, currentSlot, viewMode }; }, [slots, currentSlot, viewMode]);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsIdle(true), 3000); 
  };

  const toggleVoiceChat = async () => {
    if (isVoiceActive) {
      if (zgRef.current) {
        if (localStreamRef.current) zgRef.current.destroyStream(localStreamRef.current);
        zgRef.current.logoutRoom(`audio_${roomId}`);
        zgRef.current = null;
      }
      setIsVoiceActive(false);
      updatePresence(false);
      Object.values(remoteAudioRefs.current).forEach(audio => { audio.srcObject = null; audio.remove(); });
      remoteAudioRefs.current = {};
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const appID = 21954096;
        const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4";
        const safeUserId = (user?.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, `audio_${roomId}`, safeUserId, myName);
        const zg = new ZegoExpressEngine(appID, `wss://webliveroom${appID}-api.zego.im/ws`);
        zgRef.current = zg;

        zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
          if (updateType === 'ADD') {
            for (const sInfo of streamList) {
              const stream = await zg.startPlayingStream(sInfo.streamID);
              const audio = new Audio();
              audio.srcObject = stream;
              audio.autoplay = true;
              document.body.appendChild(audio);
              remoteAudioRefs.current[sInfo.streamID] = audio;
            }
          } else if (updateType === 'DELETE') {
              for (const sInfo of streamList) {
                  zg.stopPlayingStream(sInfo.streamID);
                  if (remoteAudioRefs.current[sInfo.streamID]) {
                      remoteAudioRefs.current[sInfo.streamID].remove();
                      delete remoteAudioRefs.current[sInfo.streamID];
                  }
              }
          }
        });

        await zg.loginRoom(`audio_${roomId}`, kitToken, { userID: safeUserId, userName: myName });
        const localStream = await zg.createStream({ camera: { audio: true, video: false } });
        localStreamRef.current = localStream;
        zg.startPublishingStream(`stream_${safeUserId}`, localStream);
        setIsVoiceActive(true);
        updatePresence(true);
      } catch (err) {
        console.error("Mic Access Failed:", err);
        alert(isAr ? 'تعذر الوصول للميكروفون.' : 'Mic access failed.');
        setIsVoiceActive(false);
      }
    }
  };

  const updatePresence = async (voiceState: boolean) => {
    if (channelRef.current && user) {
      await channelRef.current.track({ name: myName, id: user.id, isHost, hostRoomName: isHost ? roomName : undefined, isVoiceActive: voiceState });
    }
  };

  useEffect(() => {
    if (roomId && user) {
      const channel = supabase.channel(`room_${roomId}`, { config: { presence: { key: user.id } } });
      channelRef.current = channel;
      channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activeUsers: any[] = [];
          Object.keys(presenceState).forEach((key) => {
            const userData = presenceState[key][0] as any;
            if (key !== user.id) activeUsers.push({ id: key, name: userData.name || 'Guest', isVoiceActive: !!userData.isVoiceActive });
            if (!isHost && userData.isHost && userData.hostRoomName && userData.hostRoomName !== displayRoomName) {
               setDisplayRoomName(userData.hostRoomName);
               if (onNameSync && roomId) onNameSync(roomId, userData.hostRoomName);
            }
          });
          setParticipants(activeUsers);
      }).subscribe(async (status) => {
         if (status === 'SUBSCRIBED') await updatePresence(isVoiceActive);
      });
      
      channel.on('broadcast', { event: 'room_state' }, (payload) => {
          const { slots: s, currentSlot: c, viewMode: m, senderId } = payload.payload;
          if (senderId === user.id) return; 
          if (s) setSlots(s);
          if (m) setViewMode(m);
          if (c !== undefined) {
              const currentSlots = s || slots;
              const whiteIndexes = currentSlots.map((slot, idx) => slot.lock === 'white' ? idx : -1).filter(idx => idx !== -1);
              
              if (!isHost) {
                  if (whiteIndexes.length > 0) setCurrentSlot(prev => whiteIndexes.includes(c) ? c : (whiteIndexes.includes(prev) ? prev : whiteIndexes[0]));
                  else setCurrentSlot(c);
              } else {
                  const currentViewMode = m || viewMode;
                  if (currentViewMode === 'free') {
                      setCurrentSlot(c);
                  }
              }
          }
      });

      channel.on('broadcast', { event: 'room_knock' }, (payload) => {
          if (isHost) {
              setKnockRequest(payload.payload);
              setTimeout(() => setKnockRequest(null), 15000); // تختفي بعد 15 ثانية إن لم يُرد
          }
      });

      return () => { supabase.removeChannel(channel); };
    }
  }, [roomId, user, isVoiceActive, displayRoomName, viewMode]);

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (channelRef.current) { try { await channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode, senderId: user?.id } }); } catch (err) {} }
  };

  const canEditSlot = (index: number) => {
    if (isHost) return true;
    if (viewMode === 'sync') return false;
    return (slots[index].lock || 'none') === 'none';
  };

  const updateSlot = (index: number, data: SlotData) => {
    if (!canEditSlot(index)) return; 
    const newSlots = [...slots]; newSlots[index] = { ...data, lock: slots[index].lock }; setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const setSlotLock = (index: number, lock: LockState) => {
    if (!isHost) return;
    const newSlots = [...slots]; newSlots[index].lock = lock; 
    if (lock === 'black' && !newSlots[index].allowedUsers) newSlots[index].allowedUsers = [];
    setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
    setOpenLockMenu(null); // القائمة تغلق دائماً الآن لأن إدارة الزوار منفصلة
  };

  const toggleUserAccess = (index: number, userId: string) => {
    if (!isHost) return;
    const newSlots = [...slots];
    const currentAllowed = newSlots[index].allowedUsers || [];
    if (currentAllowed.includes(userId)) {
        newSlots[index].allowedUsers = currentAllowed.filter(id => id !== userId);
    } else {
        newSlots[index].allowedUsers = [...currentAllowed, userId];
    }
    setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  const handleAcceptKnock = () => {
    if (!knockRequest) return;
    const newSlots = [...slots];
    const currentAllowed = newSlots[knockRequest.slotIndex].allowedUsers || [];
    if (!currentAllowed.includes(knockRequest.userId)) {
        newSlots[knockRequest.slotIndex].allowedUsers = [...currentAllowed, knockRequest.userId];
        setSlots(newSlots);
        broadcastState(currentSlot, newSlots, viewMode);
    }
    setKnockRequest(null);
  };

  const sendKnock = async (index: number) => {
    if (channelRef.current && user) {
        await channelRef.current.send({ type: 'broadcast', event: 'room_knock', payload: { userName: myName, userId: user.id, slotIndex: index } });
        alert(isAr ? 'تم إرسال طلبك للمضيف. يرجى الانتظار.' : 'Request sent to host. Please wait.');
    }
  };

  const handleNavigation = (targetSlot: number) => {
    if (targetSlot === currentSlot) return;
    const targetLock = slots[targetSlot].lock || 'none';
    
    if (isHost) { setCurrentSlot(targetSlot); broadcastState(targetSlot, slots, viewMode); resetIdleTimer(); return; }
    
    if (viewMode === 'sync' || targetLock === 'red' || targetLock === 'white') return; 
    if (targetLock === 'black' && !(slots[targetSlot].allowedUsers || []).includes(user?.id || '')) return;

    setCurrentSlot(targetSlot);
    if (targetLock !== 'yellow') broadcastState(targetSlot, slots, viewMode);
    resetIdleTimer();
  };

  const getLeftTarget = () => {
    if (isHost) return currentSlot > 0 ? currentSlot - 1 : -1;
    if (viewMode === 'sync') return -1; 
    if (slots[currentSlot].lock === 'red') return -1;
    for (let i = currentSlot - 1; i >= 0; i--) { 
        const s = slots[i];
        const allowedInBlack = s.lock !== 'black' || (s.allowedUsers || []).includes(user?.id || '');
        if (s.lock !== 'red' && s.lock !== 'white' && allowedInBlack) return i; 
    }
    return -1;
  };

  const getRightTarget = () => {
    if (isHost) return currentSlot < 2 ? currentSlot + 1 : -1;
    if (viewMode === 'sync') return -1;
    if (slots[currentSlot].lock === 'red') return -1;
    for (let i = currentSlot + 1; i <= 2; i++) { 
        const s = slots[i];
        const allowedInBlack = s.lock !== 'black' || (s.allowedUsers || []).includes(user?.id || '');
        if (s.lock !== 'red' && s.lock !== 'white' && allowedInBlack) return i; 
    }
    return -1;
  };

  const renderSlotContent = (slot: SlotData, index: number) => {
    const editable = canEditSlot(index);
    const lockState = slot.lock || 'none';
    const canInteractInside = editable || (!isHost && lockState === 'yellow');
    const isAllowedInBlack = isHost || lockState !== 'black' || (slot.allowedUsers || []).includes(user?.id || '');
    
    const lockColors = {
      'none': 'bg-slate-900/60 border-[#00b4d8]/40 text-white/50 hover:bg-[#00b4d8]/20 hover:text-white',
      'green': 'bg-green-500/20 border-green-500/50 text-green-400',
      'yellow': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
      'red': 'bg-red-500/20 border-red-500/50 text-red-400',
      'white': 'bg-white/20 border-white/50 text-white',
      'black': 'bg-black/90 border-slate-600 text-slate-300 shadow-xl'
    };

    const LockIndicator = () => {
       if (!isHost || (index === 2 && lockState === 'none' && slots[1].lock === 'none') || (index === 0 && lockState === 'none' && slots[2].lock === 'none')) return null; 
       const isMenuOpen = openLockMenu === index;
       const labels: Record<LockState, string> = dir === 'rtl' ? { none: 'إلغاء القفل', green: 'مرن وتفاعلي', yellow: 'تنبيه للمتابعة', red: 'إجبار المشاهدة', white: 'وضع الكواليس', black: 'غرفة خاصة' } : { none: 'Unlock', green: 'Flexible', yellow: 'Alert', red: 'Force View', white: 'Backstage', black: 'Private Room' };
       let baseLocks: LockState[] = viewMode === 'sync' ? ['white', 'black'] : ['green', 'yellow', 'red', 'white', 'black'];
       let availableLocks: LockState[] = lockState === 'none' ? baseLocks : ['none', ...baseLocks.filter(l => l !== lockState)];

       return (
         <div className={`absolute top-4 ${dir === 'rtl' ? 'right-4' : 'left-4'} md:top-6 md:${dir === 'rtl' ? 'right-6' : 'left-6'} z-[80] transition-all duration-500 ${isIdle && !isMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <button onClick={() => setOpenLockMenu(isMenuOpen ? null : index)} className={`w-8 h-8 rounded-full border flex items-center justify-center backdrop-blur-md transition-all hover:scale-110 shrink-0 shadow-lg ${lockColors[lockState]} ${isMenuOpen ? 'ring-2 ring-[#00b4d8]' : ''}`}>
             {lockState === 'none' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
           </button>
           {isMenuOpen && (
               <div dir={dir} className={`absolute top-10 ${dir === 'rtl' ? 'right-0' : 'left-0'} flex flex-col gap-1 p-2 bg-[#0f172a]/95 border border-slate-700/50 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200 min-w-[150px] z-[100]`}>
                   {availableLocks.map(l => (
                       <button key={l} onClick={() => setSlotLock(index, l)} className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group ${l === 'black' && lockState === 'black' ? 'bg-white/5 ring-1 ring-slate-600' : ''}`}>
                           <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${lockColors[l]}`}>{l === 'none' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}</div>
                           <span className="text-[11px] font-bold whitespace-nowrap text-slate-200">{labels[l]}</span>
                       </button>
                   ))}
               </div>
           )}
         </div>
       );
    };

    // 💡 لوحة الإدارة الزجاجية المستقلة للقفل الأسود
    const BlackLockPanel = () => {
        if (!isHost || lockState !== 'black') return null;
        return (
            <div className={`absolute bottom-8 ${dir === 'rtl' ? 'left-8' : 'right-8'} z-[70] w-56 bg-[#0f172a]/80 backdrop-blur-md border border-slate-700/50 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden ${isIdle ? 'opacity-0 pointer-events-none translate-y-6' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-slate-800/80 p-3 border-b border-slate-700/50 flex items-center justify-between">
                   <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">{isAr ? 'الزوار المسموح لهم' : 'Allowed Visitors'}</span>
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                </div>
                <div className="max-h-[180px] overflow-y-auto no-scrollbar p-2 flex flex-col gap-1">
                    {participants.length === 0 && <span className="text-xs text-slate-500 italic text-center py-4">{isAr ? 'لا يوجد زوار' : 'No visitors'}</span>}
                    {participants.map(p => (
                        <label key={p.id} className="flex items-center gap-3 text-sm text-slate-200 p-2.5 hover:bg-white/10 rounded-xl cursor-pointer transition-all active:scale-95 group">
                            <div className="relative flex items-center justify-center">
                                <input type="checkbox" checked={(slot.allowedUsers || []).includes(p.id)} onChange={() => toggleUserAccess(index, p.id)} className="peer appearance-none w-5 h-5 border-2 border-slate-500 rounded bg-slate-800 checked:bg-cyan-500 checked:border-cyan-500 transition-colors" />
                                <Check className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                            <span className="truncate flex-1 group-hover:text-white transition-colors">{p.name}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    if (!isAllowedInBlack) {
        return (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center z-50 pointer-events-auto border-2 border-slate-800 rounded-3xl">
                <Lock className="w-16 h-16 text-slate-700 mb-6" />
                <h2 className="text-2xl text-white font-bold mb-2">{isAr ? 'جلسة خاصة' : 'Private Session'}</h2>
                <p className="text-slate-500 text-xs mb-8">{isAr ? 'بانتظار موافقة المضيف...' : 'Waiting for host approval...'}</p>
                <button onClick={() => sendKnock(index)} className="px-6 py-3 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:border-cyan-500 rounded-2xl text-white font-bold flex items-center gap-3 transition-all shadow-lg active:scale-95 group">
                    <Hand className="w-5 h-5 text-amber-400 group-hover:-translate-y-1 transition-transform" />
                    {isAr ? 'طلب دخول للمضيف' : 'Request Entry'}
                </button>
            </div>
        );
    }

    if (slot.type === 'empty') {
        return (
            <div className="flex flex-col items-center justify-center h-full relative group">
                <LockIndicator />
                {editable ? (
                    <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-24 h-24 rounded-full border-2 border-cyan-500/50 bg-cyan-500/10 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-all shadow-xl">
                        <Plus className="w-10 h-10"/>
                    </button>
                ) : (
                    <span className="text-cyan-500/50 font-bold">{isAr ? 'في انتظار المضيف...' : 'Waiting...'}</span>
                )}
                <BlackLockPanel />
            </div>
        );
    }

    if (slot.type === 'menu') {
        if (!editable) {
            return (
                <div className="flex flex-col items-center justify-center h-full relative group">
                    <LockIndicator />
                    <span className="text-cyan-500/50 font-bold">{isAr ? 'في انتظار إضافة محتوى...' : 'Waiting for content...'}</span>
                    <BlackLockPanel />
                </div>
            );
        }
        
        return (
            <div className="flex flex-col items-center justify-start h-full w-full max-w-5xl mx-auto p-4 overflow-y-auto relative bg-[#0A0E14] pointer-events-auto" dir={dir}>
              <LockIndicator />
              <div className="flex justify-center items-center w-full mb-8 pt-10 relative">
                <h3 className="text-3xl font-extrabold text-white">{isAr ? 'إضافة محتوى' : 'Add Content'}</h3>
                <button onClick={() => updateSlot(index, { type: 'empty' })} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-0 p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all`}><X className="w-6 h-6" /></button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full pb-20">
                 <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                  <h4 className="text-cyan-400 font-bold uppercase">{isAr ? 'الإنترنت والمشاهدة' : 'Internet'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowWebModal(index)} className="p-6 bg-black/20 border border-white/5 rounded-2xl hover:border-cyan-500 transition-all"><Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Web</span></button>
                    <button onClick={() => setShowYoutubeModal(index)} className="p-6 bg-black/20 border border-white/5 rounded-2xl hover:border-red-500 transition-all"><Youtube className="w-8 h-8 text-red-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">YouTube</span></button>
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                  <h4 className="text-purple-400 font-bold uppercase">{isAr ? 'الشرح والتعليم' : 'Education'}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-4 bg-black/20 border border-white/5 rounded-2xl hover:border-purple-500 transition-all"><PenTool className="w-6 h-6 text-purple-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Board</span></button>
                    <button onClick={() => updateSlot(index, { type: 'notes' })} className="p-4 bg-black/20 border border-white/5 rounded-2xl hover:border-blue-500 transition-all"><FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Notes</span></button>
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                  <h4 className="text-emerald-400 font-bold uppercase tracking-wider">{isAr ? 'الملفات والعرض' : 'Files'}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => updateSlot(index, { type: 'media' })} className="p-6 bg-black/20 border border-white/5 rounded-2xl hover:border-emerald-500 transition-all"><ImageIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Media</span></button>
                    <button onClick={() => updateSlot(index, { type: 'document' })} className="p-6 bg-black/20 border border-white/5 rounded-2xl hover:border-teal-500 transition-all"><BookOpen className="w-8 h-8 text-teal-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Docs</span></button>
                  </div>
                </div>
                <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
                  <h4 className="text-amber-400 font-bold uppercase tracking-wider">{isAr ? 'الاتصال الحي' : 'Live'}</h4>
                  <button onClick={() => updateSlot(index, { type: 'live' })} className="w-full h-full p-4 bg-black/20 border border-white/5 hover:border-amber-500/40 rounded-2xl transition-all flex flex-col items-center justify-center">
                    <Video className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <span className="text-xs text-white block text-center font-bold">{isAr ? 'بث مباشر' : 'Live Stream'}</span>
                  </button>
                </div>
              </div>
              <BlackLockPanel />
            </div>
        );
    }

    return (
      <div className="w-full h-full relative pointer-events-auto group">
        {!isHost && lockState === 'red' && <div className="absolute inset-0 z-[60] bg-transparent pointer-events-auto" />}
        <LockIndicator />
        {editable && <button onClick={() => updateSlot(index, { type: 'empty' })} className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50 hover:bg-red-500 hover:text-white transition-all duration-500 ${isIdle && !openLockMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><X className="w-5 h-5"/></button>}
        
        {slot.type === 'web' && <div className="w-full h-full bg-slate-900 relative overflow-hidden">{slot.url ? <iframe src={slot.url} className="w-full h-full border-0 bg-white" /> : <div className="w-full h-full flex flex-col items-center justify-center"><Globe className="w-20 h-20 text-cyan-500/50 mb-6 animate-pulse" /><h2 className="text-2xl text-white font-bold">{isAr ? 'في انتظار الرابط...' : 'Waiting...'}</h2></div>}</div>}
        {slot.type === 'youtube' && <SyncYouTubePlayer videoId={slot.url} roomId={roomId as string} isHost={isHost} canInteract={canInteractInside} isActive={currentSlot === index}/>}
        {slot.type === 'whiteboard' && <Whiteboard roomId={roomId} canInteract={canInteractInside} isLocalOnly={!editable}/>}
        {slot.type === 'media' && <SyncMediaViewer url={slot.url} roomId={roomId} isHost={isHost} canInteract={canInteractInside} isLocalOnly={!editable} onUploadSuccess={(url) => updateSlot(index, { type: 'media', url })}/>}
        {slot.type === 'notes' && <Notebook roomId={roomId} canInteract={canInteractInside} isLocalOnly={!editable}/>}
        {slot.type === 'document' && <UniversalViewer roomId={roomId} canInteract={canInteractInside} isLocalOnly={!editable}/>}
        {slot.type === 'live' && <LiveMeeting roomId={roomId as string} userName={myName}/>}
        
        <BlackLockPanel />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden" dir={dir}>
      <style>{`
        @keyframes soundwave { 0%, 100% { height: 4px; } 50% { height: 16px; } }
        .animate-soundwave-1 { animation: soundwave 0.6s ease-in-out infinite; }
        .animate-soundwave-2 { animation: soundwave 0.7s ease-in-out infinite 0.1s; }
        .animate-soundwave-3 { animation: soundwave 0.5s ease-in-out infinite 0.2s; }
        .animate-soundwave-4 { animation: soundwave 0.8s ease-in-out infinite 0.3s; }
      `}</style>

      {/* 💡 إشعار طرق الباب التفاعلي للمضيف */}
      {knockRequest && isHost && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[200] bg-slate-900/95 border border-slate-700 text-white px-4 py-3 rounded-3xl shadow-[0_10px_40px_rgba(8,145,178,0.3)] flex items-center gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Hand className="w-5 h-5 text-amber-400 animate-bounce" />
            <span className="text-sm font-bold">{knockRequest.userName} <span className="text-slate-400 font-normal">{isAr ? 'يطلب الدخول' : 'requests entry'}</span></span>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
            <button onClick={handleAcceptKnock} className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white rounded-xl transition-colors shadow-sm" title={isAr ? "قبول" : "Accept"}><Check className="w-5 h-5"/></button>
            <button onClick={() => setKnockRequest(null)} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-colors shadow-sm" title={isAr ? "رفض" : "Reject"}><X className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      <div className={`h-16 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-[100] pointer-events-auto border-b border-white/5 transition-all duration-500 ${isIdle && !openLockMenu ? 'opacity-30' : 'opacity-100'}`}>
        <button onClick={onExit} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors"><LogOut className="w-5 h-5"/></button>
        <div className="flex items-center gap-3">
          {isHost && (
            <button onClick={() => { const m = viewMode === 'sync' ? 'free' : 'sync'; setViewMode(m); if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots, currentSlot, viewMode: m, senderId: user?.id } }); }} className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>
              {viewMode === 'sync' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-xs font-bold uppercase hidden sm:block">{viewMode}</span>
            </button>
          )}
          <button onClick={toggleVoiceChat} className={`flex items-center gap-2 px-5 py-2 rounded-full border-2 transition-all ${isVoiceActive ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {isVoiceActive ? <SoundWave/> : <MicOff className="w-4 h-4"/>}
            <span className="text-xs font-bold uppercase">{isAr ? 'تحدث' : 'Voice'}</span>
          </button>
        </div>
        <button onClick={async () => { if (navigator.share) { try { await navigator.share({ title: `انضم لغرفتي`, text: `Join my room "${displayRoomName}"\nhttps://app.com/room/${roomId}?name=${encodeURIComponent(displayRoomName)}` }); } catch(e){} } else { alert('Copied!'); } }} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all"><Share2 className="w-5 h-5"/></button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]" onMouseMove={resetIdleTimer} onTouchStart={resetIdleTimer} onClick={resetIdleTimer}>
        <div className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out w-[300%]" style={{ transform: `translateX(-${currentSlot * 33.333333}%)` }}>
          {slots.map((s, i) => (
            <div key={i} className={`w-1/3 h-full pt-4 pointer-events-none`}>
                <div className="w-full h-full pointer-events-auto">
                   {renderSlotContent(s, i)}
                </div>
            </div>
          ))}
        </div>
        {getLeftTarget() !== -1 && <button onClick={() => { resetIdleTimer(); handleNavigation(getLeftTarget()); }} className={`absolute ${dir === 'rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full pointer-events-auto z-50 transition-all duration-500 shadow-lg ${isIdle && !openLockMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><ChevronLeft/></button>}
        {getRightTarget() !== -1 && <button onClick={() => { resetIdleTimer(); handleNavigation(getRightTarget()); }} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full pointer-events-auto z-50 transition-all duration-500 shadow-lg ${isIdle && !openLockMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}><ChevronRight/></button>}
      </div>

      <div className={`h-[95px] bg-slate-900/95 border-t border-slate-700/50 p-3 flex items-center overflow-hidden pointer-events-auto transition-all duration-500 ${isIdle && !openLockMenu ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className="flex-1 flex items-center gap-4 overflow-x-auto no-scrollbar py-2 px-2">
            <div className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${isVoiceActive ? 'border-green-400 bg-green-400/5' : 'border-cyan-500 bg-cyan-500/5'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${isVoiceActive ? 'bg-green-400 text-slate-900' : 'bg-cyan-500 text-white shadow-lg'}`}>{myInitial}</div>
              <span className="text-[10px] text-white font-bold">{myName} (أنت)</span>
            </div>
            {participants.map(p => (
              <div key={p.id} className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${p.isVoiceActive ? 'border-green-400 bg-green-400/5' : 'border-slate-700 bg-slate-800'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${p.isVoiceActive ? 'bg-green-400 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{p.name[0].toUpperCase()}</div>
                <span className="text-[10px] text-white font-medium">{p.name}</span>
              </div>
            ))}
          </div>
          <div className={`shrink-0 ${dir === 'rtl' ? 'mr-10' : 'ml-10'} relative px-2`}>
            <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className="w-14 h-14 bg-cyan-600 hover:bg-cyan-500 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all hover:scale-110 active:scale-95 border-2 border-cyan-400/30">
              <MessageCircle className="w-7 h-7"/>
              {unreadCount > 0 && !isChatOpen && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 animate-bounce shadow-lg">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
      </div>

      <RoomChat roomId={roomId} isHost={isHost} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onNewMessage={() => { if (!isChatOpen) setUnreadCount(prev => prev + 1); }} />

      {showYoutubeModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/50 p-6 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{isAr ? 'إضافة فيديو يوتيوب' : 'Add YouTube Video'}</h3>
            <input type="text" value={youtubeInput} onChange={(e) => setYoutubeInput(e.target.value)} placeholder="https://youtube.com/..." className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none mb-6" dir="ltr" />
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
    </div>
  );
}
