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

  // 💡 الاعتماد الكلي على الذاكرة المحلية لسرعة فائقة وعدم اختفاء الغرف
  useEffect(() => {
    const saved = localStorage.getItem('trio_rooms_history');
    if (saved) {
      try {
        setRecentRooms(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse rooms', e);
      }
    }
  }, []);

  const saveToLocal = (rooms: RoomHistory[]) => { 
    setRecentRooms(rooms); 
    localStorage.setItem('trio_rooms_history', JSON.stringify(rooms)); 
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
      
      // حفظ في السيرفر للزوار
      await supabase.from('private_rooms').insert([{ id: roomId, host_id: hostId, name: roomName.trim(), pin: roomPin.trim() }]);
      
      // حفظ في الهاتف كمالك (لضمان بقائها في غرفي)
      const newRoom: RoomHistory = { id: roomId, name: roomName.trim(), type: 'created', link };
      const filteredRooms = recentRooms.filter(r => r.id !== roomId); // لمنع التكرار
      saveToLocal([newRoom, ...filteredRooms]);
      
      setGeneratedLink(link);
      setIsHost(true); 
      setCurrentRoomId(roomId); 
      setCurrentRoomName(roomName.trim()); 
      setView('share');
      setRoomName('');
      setRoomPin('');
    } catch { setError('حدث خطأ أثناء الإنشاء. تأكد من اتصالك.'); } finally { setLoading(false); }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinLink.trim()) return;
    setLoading(true); setError('');
    try {
      let roomCode = '';
      let extractedName = '';
      
      try {
        if (joinLink.includes('http')) {
          const url = new URL(joinLink);
          roomCode = url.pathname.split('/').pop()?.trim() || '';
          extractedName = url.searchParams.get('name') || '';
        } else {
          roomCode = joinLink.trim();
        }
      } catch { roomCode = joinLink.trim(); }

      if (!roomCode) throw new Error('الرابط غير صالح');
      
      const { data: roomData } = await supabase.from('private_rooms').select('name').eq('id', roomCode).maybeSingle();
      const name = roomData?.name || extractedName || `Room ${roomCode}`;
      
      const newRoom: RoomHistory = { id: roomCode, name, type: 'joined', link: joinLink };
      const filteredRooms = recentRooms.filter(r => r.id !== roomCode);
      saveToLocal([newRoom, ...filteredRooms]);
      
      setIsHost(false); 
      setCurrentRoomId(roomCode); 
      setCurrentRoomName(name); 
      setView('room'); 
      setJoinLink('');
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
    saveToLocal(recentRooms.filter(r => r.id !== room.id));
  };

  if (view === 'room') return <TripleScreenRoom onExit={() => setView('menu')} isHost={isHost} roomId={currentRoomId} roomName={currentRoomName} />;

  if (view === 'myRooms' || view === 'visitorRooms') {
    const isMyRooms = view === 'myRooms';
    const filteredRooms = recentRooms.filter(r => r.type === (isMyRooms ? 'created' : 'joined'));
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-900/50">
        <button onClick={() => setView('menu')} className="self-start p-2 text-slate-400 hover:text-white mb-6"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''}/></button>
        <div className="flex flex-col items-center mb-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border ${isMyRooms ? 'bg-blue-500/20 border-blue-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>{isMyRooms ? <Key className="text-blue-400 w-8 h-8" /> : <User className="text-emerald-400 w-8 h-8" />}</div>
          <h2 className="text-2xl font-bold text-white">{isMyRooms ? t('myRooms') : t('visitor')}</h2>
        </div>
        <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
          {filteredRooms.length === 0 ? (
            <div className="text-center text-slate-400 p-4 border border-slate-700/50 rounded-2xl bg-slate-800/30">لا توجد غرف مسجلة</div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} onClick={() => { setIsHost(room.type==='created'); setCurrentRoomId(room.id); setCurrentRoomName(room.name); setView('room'); }} className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl cursor-pointer hover:border-blue-500 transition-all group">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isMyRooms ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isMyRooms ? <Key className="w-5 h-5" /> : <User className="w-5 h-5" />}</div>
                   <span className="font-bold text-slate-200 line-clamp-1 text-left">{room.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                   <button onClick={(e) => handleDeleteRoom(e, room)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5" /></button>
                   <LogIn className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="flex-1 flex flex-col p-6 items-center animate-in fade-in duration-300">
         <button onClick={() => setView('menu')} className="self-start p-2 text-slate-400 mb-6 hover:bg-slate-800 rounded-full transition-all"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''} /></button>
         <div className="w-full max-w-sm bg-slate-800/40 border border-blue-500/30 p-6 rounded-[32px] shadow-2xl relative">
            <div className="flex flex-col items-center mb-6">
               <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/50 rotate-3"><Plus className="text-blue-400 w-8 h-8" /></div>
               <h2 className="text-2xl font-black text-white text-center">إنشاء غرفة جديدة</h2>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
               {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs flex items-center gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">اسم الغرفة (حروف و4 رموز الأقل)</label>
                  <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 text-white focus:border-blue-500 outline-none" required />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 ml-1">الرقم السري (8 رموز على الأقل)</label>
                  <div className="relative">
                    <input type={showPin ? "text" : "password"} value={roomPin} onChange={e => setRoomPin(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 text-white focus:border-blue-500 outline-none" required />
                    <button type="button" onClick={()=>setShowPin(!showPin)} className="absolute right-4 top-3.5 text-slate-500">{showPin ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
                  </div>
               </div>
               <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl mt-2 flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin"/> : 'إنشاء الغرفة'}</button>
            </form>
         </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button onClick={() => setView('menu')} className="self-start p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mb-6"><ArrowLeft className={dir === 'rtl' ? 'rotate-180' : ''}/></button>
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mb-4 border border-slate-600/50"><LogIn className="w-8 h-8 text-slate-300" /></div>
          <h2 className="text-2xl font-bold text-white">{t('joinPrivateRoom')}</h2>
        </div>
        <form onSubmit={handleJoin} className="space-y-4 w-full max-w-sm mx-auto relative">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 px-1">{t('enterRoomLink')}</label>
            <input type="text" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:border-blue-500 outline-none transition-all" placeholder="https://app.com/room/... أو الكود فقط" dir="ltr" />
          </div>
          <button type="submit" disabled={!joinLink || loading} className="w-full mt-6 bg-slate-700 text-white font-bold py-4 rounded-xl hover:bg-slate-600 transition-all flex items-center justify-center">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('join')}</button>
        </form>
      </div>
    );
  }

  if (view === 'share') return (
    <div className="flex-1 flex flex-col p-6 items-center justify-center">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30"><Check className="text-green-400 w-10 h-10" /></div>
      <h2 className="text-2xl font-bold text-white mb-2">{currentRoomName}</h2>
      <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-6"><span className="text-blue-100 font-mono text-sm truncate block text-center" dir="ltr">{generatedLink}</span></div>
      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-slate-800 text-slate-300 py-3.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2"><Copy className="w-4 h-4"/> {copied ? 'تم النسخ!' : 'نسخ'}</button>
        <button onClick={async () => { if(navigator.share) await navigator.share({title: currentRoomName, text: 'انضم لغرفتي الخاصة', url: generatedLink}); }} className="bg-blue-600/20 border border-blue-500 text-blue-400 py-3.5 rounded-xl flex items-center justify-center gap-2"><Share2 className="w-4 h-4"/> مشاركة...</button>
      </div>
      <button onClick={() => setView('room')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">دخول الغرفة</button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center p-6 bg-slate-900/20 gap-8">
       <div className="flex flex-col items-center mt-10"><div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center border border-slate-700/50 shadow-2xl mb-4 rotate-6"><Lock className="w-10 h-10 text-slate-400" /></div><p className="text-3xl font-black text-white tracking-tighter">{t('privateRoom')}</p></div>
       <div className="flex flex-col w-full max-w-xs gap-4">
          <button onClick={() => { setRoomName(''); setRoomPin(''); setView('create'); }} className="bg-blue-600 text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all"><Plus /> أنشئ غرفة</button>
          <button onClick={() => setView('join')} className="bg-slate-800 text-white py-5 rounded-[24px] font-black text-lg flex items-center justify-center gap-3 border border-slate-700/50 active:scale-95 transition-all"><LogIn /> انضم لرابط</button>
          <div className="grid grid-cols-2 gap-4"><button onClick={() => setView('myRooms')} className="bg-slate-800 text-white p-5 rounded-[24px] flex flex-col items-center font-bold border border-slate-700/50"><Key className="mb-2 text-blue-400" /> غرفي</button><button onClick={() => setView('visitorRooms')} className="bg-slate-800 text-white p-5 rounded-[24px] flex flex-col items-center font-bold border border-slate-700/50"><User className="mb-2 text-emerald-400" /> الزوار</button></div>
       </div>
    </div>
  );
}
