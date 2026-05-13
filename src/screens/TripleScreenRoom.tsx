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
        // SYNCHRONOUS MIC REQUEST TO BYPASS BROWSER BLOCK
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
        
        // USE THE PRE-AUTHORIZED MEDIA STREAM
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

    if (slot.type === 'menu') return (
      <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-4 h-full overflow-y-auto">
        <button onClick={() => updateSlot(index, { type: 'whiteboard' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-cyan-500 transition-all"><PenTool className="text-cyan-400"/>Board</button>
        <button onClick={() => updateSlot(index, { type: 'notes' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-purple-400 transition-all"><FileText className="text-purple-400"/>Notes</button>
        <button onClick={() => updateSlot(index, { type: 'media' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-green-400 transition-all"><ImageIcon className="text-green-400"/>Media</button>
        <button onClick={() => updateSlot(index, { type: 'document' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-amber-400 transition-all"><BookOpen className="text-amber-400"/>Docs</button>
        <button onClick={() => updateSlot(index, { type: 'live' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-red-500 transition-all col-span-2"><Video className="text-red-500"/>Live Stream</button>
        <button onClick={() => updateSlot(index, { type: 'youtube' })} className="p-6 bg-slate-800 rounded-3xl flex flex-col items-center gap-3 text-white border border-slate-700 hover:border-red-600 transition-all col-span-2"><Youtube className="text-red-600"/>YouTube</button>
        <button onClick={() => updateSlot(index, { type: 'empty' })} className="absolute top-4 right-4 p-2 bg-slate-700 rounded-full text-white"><X/></button>
      </div>
    );

    return (
      <div className="w-full h-full relative pointer-events-auto">
        {editable && <button onClick={() => updateSlot(index, { type: 'empty' })} className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50"><X className="w-5 h-5"/></button>}
        {isHost && (
           <button onClick={() => setSlotLock(index, lockState === 'none' ? 'red' : 'none')} className={`absolute top-4 ${dir === 'rtl' ? 'right-4' : 'left-4'} z-50 p-2 rounded-full border transition-all ${lockState !== 'none' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              {lockState !== 'none' ? <Lock className="w-5 h-5"/> : <Unlock className="w-5 h-5"/>}
           </button>
        )}
        {slot.type === 'whiteboard' && <Whiteboard roomId={roomId} canInteract={editable}/>}
        {slot.type === 'notes' && <Notebook roomId={roomId} canInteract={editable}/>}
        {slot.type === 'media' && <SyncMediaViewer url={slot.url} roomId={roomId} isHost={isHost} canInteract={editable} onUploadSuccess={(url) => updateSlot(index, { type: 'media', url })}/>}
        {slot.type === 'document' && <UniversalViewer roomId={roomId} canInteract={editable}/>}
        {slot.type === 'live' && <LiveMeeting roomId={roomId as string} userName={myName}/>}
        {slot.type === 'youtube' && <SyncYouTubePlayer videoId={slot.url} roomId={roomId as string} isHost={isHost} canInteract={editable} isActive={currentSlot === index}/>}
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

      <div className="h-16 flex items-center justify-between px-4 bg-black/40 backdrop-blur-md z-[100] pointer-events-auto">
        <button onClick={onExit} className="p-2 bg-red-500/10 text-red-500 rounded-xl"><LogOut/></button>
        <button onClick={toggleVoiceChat} className={`flex items-center gap-2 px-5 py-2 rounded-full border-2 transition-all ${isVoiceActive ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slate-700 bg-slate-800 text-slate-400'}`}>
          {isVoiceActive ? <SoundWave/> : <MicOff className="w-4 h-4"/>}
          <span className="text-xs font-bold uppercase">{isAr ? 'تحدث' : 'Voice'}</span>
        </button>
        <button className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30"><Share2/></button>
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
        {currentSlot > 0 && <button onClick={() => setCurrentSlot(currentSlot - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full pointer-events-auto z-50"><ChevronLeft/></button>}
        {currentSlot < 2 && <button onClick={() => setCurrentSlot(currentSlot + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 text-white rounded-full pointer-events-auto z-50"><ChevronRight/></button>}
      </div>

      <div className="h-[90px] bg-slate-900/90 border-t border-slate-700 p-4 flex items-center gap-4 overflow-x-auto no-scrollbar pointer-events-auto">
        <div className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${isVoiceActive ? 'border-green-400 bg-green-400/5' : 'border-cyan-500 bg-cyan-500/5'}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${isVoiceActive ? 'bg-green-400 text-slate-900' : 'bg-cyan-500 text-white'}`}>{myInitial}</div>
          <span className="text-[10px] text-white font-bold">{myName}</span>
        </div>
        {participants.map(p => (
          <div key={p.id} className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${p.isVoiceActive ? 'border-green-400 bg-green-400/5' : 'border-slate-700 bg-slate-800'}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${p.isVoiceActive ? 'bg-green-400 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{p.name[0].toUpperCase()}</div>
            <span className="text-[10px] text-white font-medium">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
