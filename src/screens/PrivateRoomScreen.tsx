import React, { useState, useEffect } from 'react';
import { Lock, Plus, LogIn, Copy, ArrowLeft, Check, Key, User, Loader2, AlertCircle, Share2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import TripleScreenRoom from './TripleScreenRoom';

interface RoomHistory { id: string; name: string; type: 'created' | 'joined'; link: string; }

export default function PrivateRoomScreen() {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [view, setView] = useState<'menu' | 'create' | 'share' | 'join' | 'room' | 'myRooms' | 'visitorRooms'>('menu');
  const [roomName, setRoomName] = useState('');
  const [roomPin, setRoomPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [recentRooms, setRecentRooms] = useState<RoomHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | undefined>();
  const [currentRoomName, setCurrentRoomName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const syncRooms = async () => {
      setIsSyncing(true);
      const saved = localStorage.getItem('trio_rooms_history');
      let localRooms: RoomHistory[] = saved ? JSON.parse(saved) : [];
      setRecentRooms(localRooms);

      if (user?.id) {
        try {
          const { data, error } = await supabase.from('private_rooms').select('id, name').eq('host_id', user.id);
          if (!error && data && data.length > 0) {
            const serverRoomsMap = new Map<string, RoomHistory>();
            
            data.forEach(r => {
              serverRoomsMap.set(r.id, {
                id: r.id, name: r.name, type: 'created', link: `https://app.com/room/${r.id}?name=${encodeURIComponent(r.name)}`
              });
            });

            localRooms.forEach(localRoom => {
              if (localRoom.type === 'joined' || (!serverRoomsMap.has(localRoom.id) && localRoom.type === 'created')) {
                 serverRoomsMap.set(localRoom.id, localRoom);
              }
            });

            const combined = Array.from(serverRoomsMap.values());
            setRecentRooms(combined);
            localStorage.setItem('trio_rooms_history', JSON.stringify(combined));
          }
        } catch (err) {}
      }
      setIsSyncing(false);
    };
    
    syncRooms();
  }, [user]);

  const saveToLocal = (rooms: RoomHistory[]) => { 
    setRecentRooms(rooms); 
    localStorage.setItem('trio_rooms_history', JSON.stringify(rooms)); 
  };

  // 💡 أمان: تنظيف البيانات عند تغيير الشاشات
  const changeView = (newView: typeof view) => {
    setError('');
    setRoomName('');
    setRoomPin('');
    setJoinLink('');
    setShowPin(false);
    setView(newView);
  };

  const validateInputs = () => {
    const name = roomName.trim();
    const pin = roomPin.trim();
    if (name.length < 4 || !isNaN(Number(name))) {
      setError('اسم الغرفة يجب أن يكون 4 أحرف على الأقل وألا يتكون من أرقام فقط.');
      return false;
    }
    if (pin.length < 8) {
      setError('الرقم السري يجب أن لا يقل عن 8 أحرف أو أرقام.');
      return false;
    }
    return true;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!validateInputs()) return;
    setLoading(true); setError('');
    try {
      const roomId = Math.random().toString(36).substring(2, 10);
      const link = `https://app.com/room/${roomId}?name=${encodeURIComponent(roomName.trim())}`;
      
      const hostId = user?.id || 'anonymous';
      await supabase.from('private_rooms').insert([{ id: roomId, host_id: hostId, name: roomName.trim(), pin: roomPin.trim() }]);
      
      const newRoom: RoomHistory = { id: roomId, name: roomName.trim(), type: 'created', link };
      const updatedRooms = [newRoom, ...recentRooms.filter(r => r.id !== roomId)];
      saveToLocal(updatedRooms);
      
      setGeneratedLink(link);
      setIsHost(true); setCurrentRoomId(roomId); setCurrentRoomName(roomName.trim()); 
      
      // مسح الأرقام السرية من الذاكرة العشوائية للأمان
      setRoomName(''); setRoomPin(''); 
      setView('share');
    } catch { setError('حدث خطأ أثناء الإنشاء. تأكد من اتصالك.'); } finally { setLoading(false); }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinLink.trim()) return;
    setLoading(true); setError('');
    try {
      let roomCode = '';
      let extractedName = '';
      
      const urlMatch = joinLink.match(/https?:\/\/[^\s]+/);
      const processedLink = urlMatch ? urlMatch[0] : joinLink.trim();
      
      try {
        if (processedLink.includes('http')) {
          const url = new URL(processedLink);
          roomCode = url.pathname.split('/').pop()?.trim() || '';
          extractedName = url.searchParams.get('name') || '';
        } else {
          roomCode = processedLink.replace(/[^a-zA-Z0-9]/g, '');
        }
      } catch { 
        roomCode = processedLink.replace(/[^a-zA-Z0-9]/g, ''); 
      }

      if (!roomCode || roomCode.length < 4) {
        throw new Error('لم يتم العثور على رمز غرفة صحيح.');
      }
      
      const { data: roomData } = await supabase.from('private_rooms').select('name, host_id').eq('id', roomCode).maybeSingle();
      const name = roomData?.name || extractedName || `Room ${roomCode}`;
      
      const existingRoom = recentRooms.find(r => r.id === roomCode);
      const isActuallyHost = (roomData?.host_id && user?.id && roomData.host_id === user.id) || existingRoom?.type === 'created';
      const roomType = isActuallyHost ? 'created' : 'joined';
      
      const newRoom: RoomHistory = { id: roomCode, name, type: roomType, link: `https://app.com/room/${roomCode}?name=${encodeURIComponent(name)}` };
      const updatedRooms = [newRoom, ...recentRooms.filter(r => r.id !== roomCode)];
      saveToLocal(updatedRooms);
      
      setIsHost(isActuallyHost); 
      setCurrentRoomId(roomCode); 
      setCurrentRoomName(name); 
      setJoinLink(''); // أمان: إفراغ حقل الرابط
      setView('room'); 
    } catch (err: any) { setError(err.message || 'فشل الانضمام للغرفة'); } finally { setLoading(false); }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, room: RoomHistory) => {
    e.stopPropagation();
    if (room.type === 'created') {
      const confirmDelete = window.confirm("⚠️ تحذير: أنت مالك الغرفة. حذفها سيؤدي إلى تدميرها نهائياً. هل توافق؟");
      if (!confirmDelete) return;
      try { await supabase.from('private_rooms').delete().eq('id', room.id); } catch (err) {}
    } else {
      const confirmRemove = window.confirm("هل تريد إزالة هذه الغرفة من قائمة الزيارات الخاصة بك؟");
      if (!confirmRemove) return;
    }
    const filtered = recentRooms.filter(r => r.id !== room.id);
    saveToLocal(filtered);
  };

  const handleShareClick = async () => {
    const shareText = `مرحباً! انضم إلى غرفتي الخاصة "${currentRoomName}" 🚀\n\nاضغط على الرابط أدناه للدخول:\n${generatedLink}`;
    if(navigator.share) {
      try { await navigator.share({ title: currentRoomName, text: shareText }); } catch(err) {}
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true); setTimeout(()=>setCopied(false),2000);
    }
  };

  const handleRoomNameSync = (id: string, realName: string) => {
    setCurrentRoomName(realName);
    setRecentRooms(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, name: realName, link: `https://app.com/room/${id}?name=${encodeURIComponent(realName)}` } : r);
      localStorage.setItem('trio_rooms_history', JSON.stringify(updated));
      return updated;
    });
  };

  if (view === 'room') return <TripleScreenRoom onExit={() => changeView('menu')} isHost={isHost} roomId={currentRoomId} roomName={currentRoomName} onNameSync={handleRoomNameSync} />;

  if (view === 'myRooms' || view === 'visitorRooms') {
    const isMyRooms = view === 'myRooms';
    const filteredRooms = recentRooms.filter(r => r.type === (isMyRooms ? 'created' : 'joined'));
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-900/50 relative md:items-center">
        {isSyncing && <div className="absolute top-4 right-4"><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /></div>}
        
        <div className="w-full max-w-5xl">
          <button onClick={() => changeView('menu')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all mb-6"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''}/></button>
          
          <div className="flex flex-col items-center mb-10">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border shadow-lg ${isMyRooms ? 'bg-blue-500/20 border-blue-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>{isMyRooms ? <Key className="text-blue-400 w-8 h-8" /> : <User className="text-emerald-400 w-8 h-8" />}</div>
            <h2 className="text-3xl font-bold text-white tracking-wide">{isMyRooms ? t('myRooms') : t('visitor')}</h2>
          </div>

          {/* 💡 تجاوب الشاشات: شبكة (Grid) احترافية للتابلت والكمبيوتر */}
          {filteredRooms.length === 0 ? (
            <div className="text-center text-slate-400 p-8 border border-slate-700/50 rounded-2xl bg-slate-800/30 max-w-sm mx-auto">لا توجد غرف مسجلة</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              {filteredRooms.map(room => (
                <div key={room.id} onClick={() => { setIsHost(room.type==='created'); setCurrentRoomId(room.id); setCurrentRoomName(room.name); setView('room'); }} className="flex items-center justify-between p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-slate-800 hover:scale-[1.02] shadow-sm hover:shadow-xl transition-all duration-300 group">
                  <div className="flex items-center gap-4 overflow-hidden">
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner ${isMyRooms ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isMyRooms ? <Key className="w-5 h-5" /> : <User className="w-5 h-5" />}</div>
                     <span className="font-bold text-slate-200 truncate text-left text-lg">{room.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                     <button onClick={(e) => handleDeleteRoom(e, room)} className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all"><Trash2 className="w-5 h-5" /></button>
                     <div className="p-2.5 rounded-full bg-slate-700/50 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all"><LogIn className="w-5 h-5" /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="flex-1 flex flex-col p-6 items-center justify-center animate-in fade-in duration-300">
         <div className="w-full max-w-sm md:max-w-md bg-slate-800/40 border border-blue-500/30 p-8 rounded-[32px] shadow-2xl relative backdrop-blur-sm">
            <button onClick={() => changeView('menu')} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''} /></button>
            <div className="flex flex-col items-center mb-8 mt-2">
               <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-5 border border-blue-500/50 shadow-inner"><Plus className="text-blue-400 w-8 h-8" /></div>
               <h2 className="text-2xl font-bold text-white text-center tracking-wide">إنشاء غرفة جديدة</h2>
            </div>
            <form onSubmit={handleCreate} className="space-y-5">
               {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-center gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
               <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">اسم الغرفة</label>
                  <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="أدخل اسماً مميزاً" required />
               </div>
               <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">الرقم السري (للحماية)</label>
                  <div className="relative">
                    <input type={showPin ? "text" : "password"} value={roomPin} onChange={e => setRoomPin(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-5 py-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="8 رموز على الأقل" required />
                    <button type="button" onClick={()=>setShowPin(!showPin)} className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition-colors">{showPin ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
                  </div>
               </div>
               <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl mt-4 flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95 text-lg">{loading ? <Loader2 className="animate-spin w-6 h-6"/> : 'إنشاء الغرفة الآن'}</button>
            </form>
         </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex-1 flex flex-col p-6 items-center justify-center bg-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="w-full max-w-sm md:max-w-md">
          <button onClick={() => changeView('menu')} className="self-start p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mb-6"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''}/></button>
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-slate-800 border border-slate-700 shadow-xl rounded-full flex items-center justify-center mb-5"><LogIn className="w-8 h-8 text-slate-300" /></div>
            <h2 className="text-3xl font-bold text-white tracking-wide">{t('joinPrivateRoom')}</h2>
          </div>
          <form onSubmit={handleJoin} className="space-y-5 w-full bg-slate-800/30 p-8 rounded-[32px] border border-slate-700/50 backdrop-blur-sm">
            {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-center gap-3"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-400 px-1">{t('enterRoomLink')}</label>
              <input type="text" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="لصق الرابط أو الرمز هنا" dir="ltr" />
            </div>
            <button type="submit" disabled={!joinLink || loading} className="w-full mt-2 bg-slate-700 text-white font-bold py-4 rounded-2xl hover:bg-slate-600 transition-all flex items-center justify-center text-lg active:scale-95 disabled:opacity-50 disabled:active:scale-100">{loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t('join')}</button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'share') return (
    <div className="flex-1 flex flex-col p-6 items-center justify-center">
      <div className="w-full max-w-sm md:max-w-md bg-slate-800/40 p-8 rounded-[32px] border border-green-500/20 shadow-2xl flex flex-col items-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]"><Check className="text-green-400 w-10 h-10" /></div>
        <h2 className="text-3xl font-bold text-white mb-2 text-center">{currentRoomName}</h2>
        <p className="text-slate-400 mb-6 text-sm text-center">تم إنشاء غرفتك بنجاح ومحفوظة الآن</p>
        <div className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl p-5 mb-6"><span className="text-blue-200 font-mono text-sm truncate block text-center select-all" dir="ltr">{generatedLink}</span></div>
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-4 rounded-2xl border border-slate-600 flex items-center justify-center gap-2 font-bold transition-colors"><Copy className="w-5 h-5"/> {copied ? 'تم النسخ!' : 'نسخ'}</button>
          <button onClick={handleShareClick} className="bg-blue-600/20 border border-blue-500 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 py-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-colors"><Share2 className="w-5 h-5"/> مشاركة</button>
        </div>
        <button onClick={() => changeView('room')} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-blue-600/25">دخول الغرفة</button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900/20 gap-8 min-h-screen">
       <div className="flex flex-col items-center mb-4">
          <div className="w-24 h-24 bg-slate-800/80 rounded-full flex items-center justify-center border-2 border-slate-700/50 shadow-[0_0_30px_rgba(0,0,0,0.5)] mb-6 transition-transform hover:scale-105 duration-300">
             <Lock className="w-10 h-10 text-slate-300" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">{t('privateRoom')}</h1>
       </div>
       
       <div className="flex flex-col w-full max-w-sm md:max-w-md gap-4">
          <button onClick={() => changeView('create')} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-5 rounded-[24px] font-bold text-xl flex items-center justify-center gap-3 shadow-xl hover:shadow-blue-500/25 md:hover:scale-[1.02] active:scale-95 transition-all duration-300"><Plus className="w-6 h-6"/> أنشئ غرفة</button>
          <button onClick={() => changeView('join')} className="bg-slate-800 text-slate-200 hover:text-white py-5 rounded-[24px] font-bold text-xl flex items-center justify-center gap-3 border border-slate-700/50 shadow-md md:hover:scale-[1.02] active:scale-95 transition-all duration-300"><LogIn className="w-6 h-6"/> انضم لرابط</button>
          <div className="grid grid-cols-2 gap-4 mt-2">
             <button onClick={() => changeView('myRooms')} className="bg-slate-800/80 text-white p-6 rounded-[24px] flex flex-col items-center font-bold border border-slate-700/50 md:hover:bg-slate-700 hover:border-blue-500/50 transition-all duration-300 group"><Key className="mb-3 text-blue-400 group-hover:scale-110 transition-transform" /> غرفي</button>
             <button onClick={() => changeView('visitorRooms')} className="bg-slate-800/80 text-white p-6 rounded-[24px] flex flex-col items-center font-bold border border-slate-700/50 md:hover:bg-slate-700 hover:border-emerald-500/50 transition-all duration-300 group"><User className="mb-3 text-emerald-400 group-hover:scale-110 transition-transform" /> الزوار</button>
          </div>
       </div>
    </div>
  );
}
