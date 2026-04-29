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
interface Props { onExit: () => void; isHost?: boolean; roomId?: string; }

export default function TripleScreenRoom({ onExit, isHost = false, roomId }: Props) {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [currentSlot, setCurrentSlot] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('sync');
  const [participants, setParticipants] = useState<{ id: string, name: string }[]>([]);
  const [slots, setSlots] = useState<SlotData[]>([{ type: 'empty' }, { type: 'empty' }, { type: 'empty' }]);

  const zpRef = useRef<any>(null);
  const zegoJoined = useRef(false);
  const canInteract = isHost || viewMode === 'free';
  const myName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const myInitial = myName.charAt(0).toUpperCase();

  const handleShare = async () => {
    const roomUrl = `https://app.com/room/${roomId}`;
    if (navigator.share) {
      try { await navigator.share({ title: `انضم لغرفتي`, text: `أنا في غرفتي الخاصة الآن، انضم إلي!`, url: roomUrl }); } catch (err) {}
    } else {
      navigator.clipboard.writeText(roomUrl);
      alert('تم نسخ الرابط بنجاح!');
    }
  };

  useEffect(() => {
    if (roomId && user) {
      const channel = supabase.channel(`room_${roomId}`, { config: { presence: { key: user.id } } });
      channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activeUsers: { id: string, name: string }[] = [];
          Object.keys(presenceState).forEach((key) => {
            if (key !== user.id) {
              const userData = presenceState[key][0] as any;
              activeUsers.push({ id: key, name: userData.name || 'Guest' });
            }
          });
          setParticipants(activeUsers);
        }).on('broadcast', { event: 'room_state' }, (payload) => {
          if (!isHost || viewMode === 'free') {
             if (payload.payload.slots) setSlots(payload.payload.slots);
             if (payload.payload.viewMode) setViewMode(payload.payload.viewMode);
             if (payload.payload.viewMode === 'sync' && payload.payload.currentSlot !== undefined) setCurrentSlot(payload.payload.currentSlot);
          }
        }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ name: myName, id: user.id }); });
      return () => { supabase.removeChannel(channel); };
    }
  }, [roomId, isHost, viewMode, user, myName]);

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
        showAudioVideoSettingsButton: false, layout: 'Grid',
      });
    } catch (err) {}
  };

  const handleExit = () => { if (zpRef.current) { try { zpRef.current.destroy(); } catch (e) {} } onExit(); };

  const broadcastState = async (slotIndex: number, newSlots: SlotData[], mode: ViewMode) => {
    if (roomId && canInteract) { try { await supabase.channel(`room_${roomId}`).send({ type: 'broadcast', event: 'room_state', payload: { slots: newSlots, currentSlot: slotIndex, viewMode: mode } }); } catch (err) {} }
  };

  const updateSlot = async (index: number, data: SlotData) => {
    if (!canInteract) return;
    const newSlots = [...slots]; newSlots[index] = data; setSlots(newSlots);
    broadcastState(currentSlot, newSlots, viewMode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0E14] flex flex-col overflow-hidden font-sans" dir={dir}>
      <div ref={initHiddenAudio} className="fixed top-[-9999px] left-[-9999px] w-[100px] h-[100px] opacity-0 z-[-1]" />
      
      {/* 💡 الشريط العلوي المحسن: يضمن ظهور كل الأزرار على جميع الشاشات */}
      <div className="absolute top-0 left-0 right-0 h-16 z-[100] flex items-center justify-between px-4 bg-gradient-to-b from-black/80 to-transparent">
        
        {/* زر الخروج - يسار */}
        <button onClick={handleExit} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full transition-all backdrop-blur-sm">
          <LogOut className="w-5 h-5" />
        </button>

        {/* وضع المزامنة - وسط */}
        <div className="flex justify-center">
             <button onClick={() => isHost && setViewMode(viewMode === 'sync' ? 'free' : 'sync')} disabled={!isHost} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-sm ${viewMode === 'sync' ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>{viewMode === 'sync' ? <><Lock className="w-3.5 h-3.5" /><span className="text-[11px] font-bold">Sync</span></> : <><Unlock className="w-3.5 h-3.5" /><span className="text-[11px] font-bold">Free</span></>}</button>
        </div>

        {/* زر المشاركة ورقم الغرفة - يمين */}
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-bold tracking-widest text-[11px] opacity-80 uppercase hidden sm:inline-block">ID: {roomId}</span>
          <button 
            onClick={handleShare} 
            className="flex items-center justify-center p-2.5 bg-blue-600 text-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)] animate-pulse hover:bg-blue-500 active:scale-95 transition-all"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

      </div>

      <div className="flex-1 w-full flex flex-col">
          <div className="flex-1 relative w-full overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#113a5a] to-[#008ba3]">
            <div className="absolute top-0 left-0 h-full flex transition-transform duration-500" style={{ width: '300%', transform: `translateX(-${currentSlot * 33.333}%)` }}>{slots.map((slot, index) => (<div key={index} className="w-1/3 h-full pt-16">{index === 0 && slot.type==='empty' ? <div className="flex flex-col items-center justify-center h-full"><button onClick={() => updateSlot(index, { type: 'menu' })} className="w-24 h-24 rounded-full border-2 border-[#00b4d8] flex items-center justify-center hover:bg-[#00b4d8]/20 transition-all"><Plus className="w-10 h-10 text-[#00b4d8]" /></button><p className="mt-4 text-[#00b4d8] font-mono tracking-widest text-sm font-bold">ADD CONTENT</p></div> : <div className="w-full h-full flex items-center justify-center text-white/20">Empty</div>}</div>))}</div>
          </div>
          <div className="h-[90px] w-full bg-[#1e293b]/80 backdrop-blur-md border-t border-slate-700/50 flex items-center px-6 relative z-30">
              <div className="flex items-center h-full gap-4 w-full">
                  <div className="flex flex-col items-center gap-1 translate-y-[5px]">
                    <div className="w-[50px] h-[50px] rounded-[16px] bg-[#0f172a] border-[1.5px] border-[#00b4d8] shadow-[0_0_10px_rgba(0,180,216,0.3)] flex items-center justify-center relative"><span className="text-[#00b4d8] font-bold text-xl uppercase">{myInitial}</span><div className="absolute -bottom-1 -right-0.5 w-3 h-3 bg-[#3b82f6] rounded-full border-2 border-[#1e293b]" /></div>
                    <span className="text-[#00b4d8] text-[10px] font-bold truncate max-w-[60px] text-center">{myName}</span>
                  </div>
                  {participants.map(p => (
                     <div key={p.id} className="flex flex-col items-center gap-1 translate-y-[5px] animate-in zoom-in">
                       <div className="w-[50px] h-[50px] rounded-[16px] bg-[#00b4d8] flex items-center justify-center relative shadow-md"><span className="text-white font-bold text-xl uppercase">{p.name.charAt(0).toUpperCase()}</span><div className="absolute -bottom-1 -right-0.5 w-3 h-3 bg-[#00e676] rounded-full border-2 border-[#1e293b]" /></div>
                       <span className="text-white text-[10px] font-medium truncate max-w-[60px] text-center">{p.name}</span>
                     </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
}
