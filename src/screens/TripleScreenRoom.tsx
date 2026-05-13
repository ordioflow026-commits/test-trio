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
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

type ContentType = 'empty' | 'menu' | 'web' | 'youtube' | 'whiteboard' | 'notes' | 'media' | 'camera' | 'screen_share' | 'document' | 'mic' | 'live';
type ViewMode = 'sync' | 'free';
type LockState = 'none' | 'green' | 'yellow' | 'red' | 'white';

interface SlotData { type: ContentType; url?: string; lock?: LockState; }
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
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty', lock: 'none' }, { type: 'empty', lock: 'none' }, { type: 'empty', lock: 'none' }]);
  const [displayRoomName, setDisplayRoomName] = useState<string>(roomName || roomId || ''); 
  const isAr = language === 'ar';
  const stateRef = useRef({ slots, currentSlot, viewMode });
  const hostWasPresent = useRef(false);

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
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        const appID = Number(import.meta.env.VITE_ZEGO_APP_ID);
        const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET;
        if (!appID || !serverSecret) throw new Error("Missing Zego Config");

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, `audio_${roomId}`, user?.id || Date.now().toString(), myName);
        
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

        await zg.loginRoom(`audio_${roomId}`, kitToken, { userID: user?.id || 'u', userName: myName });
        
        const localStream = await zg.createStream({ custom: { audio: { source: mediaStream } } });
        localStreamRef.current = localStream;
        zg.startPublishingStream(`stream_${user?.id}`, localStream);
        
        setIsVoiceActive(true);
        updatePresence(true);
      } catch (err) {
        console.error("Mic Access Failed:", err);
        alert(isAr ? 'تعذر الوصول للميكروفون، يرجى منح الصلاحيات.' : 'Mic access failed. Please grant permissions.');
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
          });
          setParticipants(activeUsers);
      }).subscribe(async (status) => {
         if (status === 'SUBSCRIBED') await updatePresence(isVoiceActive);
      });
      return () => { supabase.removeChannel(channel); };
    }
  }, [roomId, user, isVoiceActive]);

  const updateSlot = (index: number, data: SlotData) => {
    const newSlots = [...slots];
    newSlots[index] = { ...data, lock: slots[index].lock };
    setSlots(newSlots);
    if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot, viewMode, senderId: user?.id } });
  };

  const setSlotLock = (index: number, lock: LockState) => {
    if (!isHost) return;
    const newSlots = [...slots]; newSlots[index].lock = lock; setSlots(newSlots);
    if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot, viewMode, senderId: user?.id } });
    setOpenLockMenu(null);
  };

  const renderSlotContent = (slot: SlotData, index: number) => {
    const editable = isHost || (viewMode === 'free' && slot.lock === 'none');
    const lockState = slot.lock || 'none';
    
    if (slot.type === 'empty') return (
      <div className="flex flex-col items-center justify-center h-full">
        {editable ? <button onClick={() => updateSlot(index, { type: 'menu' })} className="w-24 h-24 rounded-full border-2 border-cyan-500/50 bg-cyan-500/10 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-all"><Plus className="w-10 h-10"/></button> : <span className="text-cyan-500/50 font-bold">{isAr ? 'في انتظار المضيف...' : 'Waiting for Host...'}</span>}
      </div>
    );

    // 💡 استرجاع تصميم القائمة الجميل مع الفئات وزر الإنترنت
    if (slot.type === 'menu') return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-5xl mx-auto p-4 overflow-y-auto relative group pointer-events-auto" dir={dir}>
          <div className="flex justify-center items-center w-full mb-8 pt-10 relative">
            <h3 className="text-3xl font-extrabold text-white">{isAr ? 'إضافة محتوى' : 'Add Content'}</h3>
            <button onClick={() => updateSlot(index, { type: 'empty' })} className={`absolute ${dir === 'rtl' ? 'left-4' : 'right-4'} top-0 p-4 bg-slate-800 rounded-2xl text-slate-400 hover:text-red-400 transition-all`}><X className="w-6 h-6" /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full pb-24">
             <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-cyan-400 font-bold uppercase tracking-wider">{isAr ? 'الإنترنت والمشاهدة' : 'Internet'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setShowWebModal(index)} className="p-6 bg-black/20 border border-white/5 hover:border-cyan-500/40 rounded-2xl transition-all"><Globe className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Web</span></button>
                <button onClick={() => setShowYoutubeModal(index)} className="p-6 bg-black/20 border border-white/5 hover:border-red-500/40 rounded-2xl transition-all"><Youtube className="w-8 h-8 text-red-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">YouTube</span></button>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-purple-400 font-bold uppercase tracking-wider">{isAr ? 'الشرح والتعليم' : 'Education'}</h4>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-4 bg-black/20 border border-white/5 hover:border-purple-500/40 rounded-2xl transition-all"><PenTool className="w-6 h-6 text-purple-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Board</span></button>
                <button onClick={() => updateSlot(index, { type: 'notes' })} className="p-4 bg-black/20 border border-white/5 hover:border-blue-500/40 rounded-2xl transition-all"><FileText className="w-6 h-6 text-blue-400 mx-auto mb-2" /><span className="text-[10px] text-white block text-center font-bold">Notes</span></button>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-emerald-400 font-bold uppercase tracking-wider">{isAr ? 'الملفات والعرض' : 'Files'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => updateSlot(index, { type: 'media' })} className="p-6 bg-black/20 border border-white/5 hover:border-emerald-500/40 rounded-2xl transition-all"><ImageIcon className="w-8 h-8 text-emerald-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Media</span></button>
                <button onClick={() => updateSlot(index, { type: 'document' })} className="p-6 bg-black/20 border border-white/5 hover:border-teal-500/40 rounded-2xl transition-all"><BookOpen className="w-8 h-8 text-teal-400 mx-auto mb-2" /><span className="text-xs text-white block text-center font-bold">Docs</span></button>
              </div>
            </div>
            <div className="bg-slate-900/80 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4">
              <h4 className="text-amber-400 font-bold uppercase tracking-wider">{isAr ? 'الاتصال الحي' : 'Live'}</h4>
              <button onClick={() => updateSlot(index, { type: 'live' })} className="w-full h-full p-4 bg-black/20 border border-white/5 hover:border-amber-500/40 rounded-2xl transition-all flex flex-col items-center justify-center">
                <Video className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <span className="text-xs text-white block text-center font-bold">{isAr ? 'بث مباشر (صوت وصورة)' : 'Live Stream'}</span>
              </button>
            </div>
          </div>
        </div>
    );

    return (
      <div className="w-full h-full relative pointer-events-auto">
        {editable && <button onClick={() => updateSlot(index, { type: 'empty' })} className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50 hover:bg-red-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>}
        
        {isHost && (
           <button onClick={() => setSlotLock(index, lockState === 'none' ? 'red' : 'none')} className={`absolute top-4 ${dir === 'rtl' ? 'right-4' : 'left-4'} z-50 p-2 rounded-full border transition-all ${lockState !== 'none' ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'}`} title={isAr ? "قفل الشاشة" : "Lock Screen"}>
              {lockState !== 'none' ? <Lock className="w-5 h-5"/> : <Unlock className="w-5 h-5"/>}
           </button>
        )}

        {slot.type === 'web' && <div className="w-full h-full bg-slate-900 relative overflow-hidden">{slot.url ? <iframe src={slot.url} className="w-full h-full border-0 bg-white pointer-events-auto" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" /> : <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none"><Globe className="w-20 h-20 text-cyan-500/50 mb-6 animate-pulse" /><h2 className="text-2xl text-white font-bold">{isAr ? 'في انتظار الرابط...' : 'Waiting for URL...'}</h2></div>}</div>}
        {slot.type === 'youtube' && <SyncYouTubePlayer videoId={slot.url} roomId={roomId as string} isHost={isHost} canInteract={editable} isActive={currentSlot === index}/>}
        {slot.type === 'whiteboard' && <Whiteboard roomId={roomId} canInteract={editable}/>}
        {slot.type === 'media' && <SyncMediaViewer url={slot.url} roomId={roomId} isHost={isHost} canInteract={editable} onUploadSuccess={(url) => updateSlot(index, { type: 'media', url })}/>}
        {slot.type === 'notes' && <Notebook roomId={roomId} canInteract={editable}/>}
        {slot.type === 'document' && <UniversalViewer roomId={roomId} canInteract={editable}/>}
        {slot.type === 'live' && <LiveMeeting roomId={roomId as string} userName={myName}/>}
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

      {/* 💡 الشريط العلوي مع زر تغيير الحالة (Sync/Free) */}
      <div className="h-16 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-[100] pointer-events-auto border-b border-white/5">
        <button onClick={onExit} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors"><LogOut className="w-5 h-5"/></button>
        
        <div className="flex items-center gap-3">
          {isHost && (
            <button 
              onClick={() => { const m = viewMode === 'sync' ? 'free' : 'sync'; setViewMode(m); if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'room_state', payload: { slots, currentSlot, viewMode: m, senderId: user?.id } }); }} 
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
              title={isAr ? "تحكم في حركة الزوار" : "Control Visitors Navigation"}
            >
              {viewMode === 'sync' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-xs font-bold uppercase hidden sm:block">{viewMode}</span>
            </button>
          )}

          <button onClick={toggleVoiceChat} className={`flex items-center gap-2 px-5 py-2 rounded-full border-2 transition-all ${isVoiceActive ? 'border-green-500 bg-green-500/10 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {isVoiceActive ? <SoundWave/> : <MicOff className="w-4 h-4"/>}
            <span className="text-xs font-bold uppercase">{isAr ? 'تحدث' : 'Voice'}</span>
          </button>
        </div>

        <button onClick={async () => { if (navigator.share) { try { await navigator.share({ title: `انضم لغرفتي`, text: `Join my room "${displayRoomName}"\nhttps://app.com/room/${roomId}?name=${encodeURIComponent(displayRoomName)}` }); } catch(e){} } else { alert('Copied!'); } }} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/30 transition-all"><Share2 className="w-5 h-5"/></button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
        <div className="absolute top-0 left-0 h-full flex transition-transform duration-700 ease-in-out w-[300%]" style={{ transform: `translateX(-${currentSlot * 33.333333}%)` }}>
          {slots.map((s, i) => (
            <div key={i} className="w-1/3 h-full pt-4 pointer-events-none">
                <div className="w-full h-full pointer-events-auto">
                   {renderSlotContent(s, i)}
                </div>
            </div>
          ))}
        </div>
        {currentSlot > 0 && <button onClick={() => setCurrentSlot(currentSlot - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full pointer-events-auto z-50 transition-colors shadow-lg"><ChevronLeft/></button>}
        {currentSlot < 2 && <button onClick={() => setCurrentSlot(currentSlot + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full pointer-events-auto z-50 transition-colors shadow-lg"><ChevronRight/></button>}
      </div>

      <div className="h-[90px] bg-slate-900/90 border-t border-slate-700 p-4 flex items-center gap-4 overflow-x-auto no-scrollbar pointer-events-auto">
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

      {showYoutubeModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/50 p-6 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{isAr ? 'إضافة فيديو يوتيوب' : 'Add YouTube Video'}</h3>
            <input type="text" value={youtubeInput} onChange={(e) => setYoutubeInput(e.target.value)} placeholder={isAr ? 'ضع رابط الفيديو هنا...' : 'Paste video link here...'} className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-red-500 outline-none mb-6" dir="ltr" />
            <div className="flex justify-end gap-3"><button onClick={() => {setShowYoutubeModal(null); setYoutubeInput('');}} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { if(youtubeInput.trim()) { updateSlot(showYoutubeModal, { type: 'youtube', url: youtubeInput }); setShowYoutubeModal(null); setYoutubeInput(''); } }} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg">{isAr ? 'إضافة' : 'Add'}</button></div>
          </div>
        </div>
      )}

      {showWebModal !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-slate-700/50 p-6 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-4">{isAr ? 'تصفح موقع ويب' : 'Browse Website'}</h3>
            <input type="url" value={webInput} onChange={(e) => setWebInput(e.target.value)} placeholder="https://example.com" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none mb-6" dir="ltr" />
            <div className="flex justify-end gap-3"><button onClick={() => {setShowWebModal(null); setWebInput('');}} className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button><button onClick={() => { let url = webInput.trim(); if(url) { if(!url.startsWith('http')) url = 'https://' + url; updateSlot(showWebModal, { type: 'web', url: url }); setShowWebModal(null); setWebInput(''); } }} className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg">{isAr ? 'فتح الموقع' : 'Open'}</button></div>
          </div>
        </div>
      )}

      <button onClick={() => { setIsChatOpen(true); setUnreadCount(0); }} className={`fixed bottom-28 ${dir === 'rtl' ? 'left-4' : 'right-4'} z-[80] p-4 bg-cyan-600 hover:bg-cyan-500 rounded-full shadow-lg text-white transition-transform hover:scale-110 active:scale-95`} title={isAr ? "الدردشة" : "Chat"}>
        <MessageCircle className="w-6 h-6"/>
        {unreadCount > 0 && !isChatOpen && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-slate-900 animate-bounce">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      <RoomChat roomId={roomId} isHost={isHost} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} onNewMessage={() => { if (!isChatOpen) setUnreadCount(prev => prev + 1); }} />
    </div>
  );
}
