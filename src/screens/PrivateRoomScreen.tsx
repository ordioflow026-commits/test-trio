import React, { useState, useEffect } from 'react';
import { Lock, Plus, LogIn, Copy, ArrowLeft, Check, Link as LinkIcon, Key, User, Loader2, AlertCircle, Share2, Eye, EyeOff, Trash2, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import TripleScreenRoom from './TripleScreenRoom';

interface RoomHistory {
  id: string;
  name: string;
  type: 'created' | 'joined';
  link: string;
}

export default function PrivateRoomScreen() {
  const { t, dir } = useLanguage();
  const [view, setView] = useState<'menu' | 'create' | 'share' | 'join' | 'room' | 'myRooms' | 'visitorRooms' | 'recover'>('menu');
  const [roomName, setRoomName] = useState('');
  const [roomPin, setRoomPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentRooms, setRecentRooms] = useState<RoomHistory[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useUser();
  const [currentRoomId, setCurrentRoomId] = useState<string | undefined>();

  useEffect(() => {
    const savedRooms = localStorage.getItem('joined_rooms');
    if (savedRooms) setRecentRooms(JSON.parse(savedRooms));
  }, []);

  const saveRoomsToLocal = (rooms: RoomHistory[]) => {
    setRecentRooms(rooms);
    localStorage.setItem('joined_rooms', JSON.stringify(rooms));
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!roomName || !roomPin) return;
    setLoading(true); setError('');
    try {
      const roomId = Math.random().toString(36).substring(2, 10);
      const link = `https://app.com/room/${roomId}`;
      await supabase.from('private_rooms').insert([{ id: roomId, host_id: user?.id || 'anonymous', name: roomName, pin: roomPin }]);
      setGeneratedLink(link);
      const newRooms = [{ id: roomId, name: roomName, type: 'created' as const, link }, ...recentRooms];
      saveRoomsToLocal(newRooms);
      setIsHost(true); setCurrentRoomId(roomId); setView('share');
    } catch (err: any) { setError('Failed to create room'); } finally { setLoading(false); }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, room: RoomHistory) => {
    e.stopPropagation();
    const confirmDelete = window.confirm("هل أنت متأكد أنك تريد حذف هذه الغرفة نهائياً؟ سيتم قطع الاتصال عن الجميع.");
    if (!confirmDelete) return;

    try {
      if (room.type === 'created') {
        await supabase.from('private_rooms').delete().eq('id', room.id);
      }
      const updated = recentRooms.filter(r => r.id !== room.id);
      saveRoomsToLocal(updated);
    } catch (err) { console.error("Delete failed", err); }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName || !roomPin) return;
    setLoading(true); setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('private_rooms')
        .select('*')
        .eq('name', roomName)
        .eq('pin', roomPin)
        .maybeSingle();

      if (!data || fetchErr) {
        setError('لم يتم العثور على الغرفة. تأكد من الاسم والرقم السري.');
      } else {
        const type = data.host_id === user?.id ? 'created' : 'joined';
        const link = `https://app.com/room/${data.id}`;
        const newRooms = [{ id: data.id, name: data.name, type, link }, ...recentRooms.filter(r => r.id !== data.id)];
        saveRoomsToLocal(newRooms);
        alert('تم استعادة الغرفة بنجاح!');
        setView('menu');
      }
    } catch (err) { setError('حدث خطأ أثناء البحث.'); } finally { setLoading(false); }
  };

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!joinLink) return;
    setLoading(true); setError('');
    try {
      const roomCode = joinLink.split('/').pop() || 'Unknown';
      const { data: roomData } = await supabase.from('private_rooms').select('*').eq('id', roomCode).maybeSingle();
      const name = roomData?.name || `Room ${roomCode}`;
      const newRooms = [{ id: roomCode, name, type: 'joined' as const, link: joinLink }, ...recentRooms.filter(r => r.id !== roomCode)];
      saveRoomsToLocal(newRooms);
      setIsHost(false); setCurrentRoomId(roomCode); setView('room');
    } catch (err: any) { setError('Failed to join room'); } finally { setLoading(false); }
  };

  if (view === 'room') return <TripleScreenRoom onExit={() => setView('menu')} isHost={isHost} roomId={currentRoomId} />;

  if (view === 'myRooms' || view === 'visitorRooms') {
    const isMyRooms = view === 'myRooms';
    const filteredRooms = recentRooms.filter(r => r.type === (isMyRooms ? 'created' : 'joined'));
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-900/50">
        <button onClick={() => setView('menu')} className="self-start p-2 text-slate-400 mb-6"><ArrowLeft /></button>
        <div className="flex flex-col items-center mb-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border ${isMyRooms ? 'bg-blue-500/20 border-blue-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>{isMyRooms ? <Key className="text-blue-400 w-8 h-8" /> : <User className="text-emerald-400 w-8 h-8" />}</div>
          <h2 className="text-2xl font-bold text-white">{isMyRooms ? t('myRooms') : t('visitor')}</h2>
        </div>
        <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
          {filteredRooms.length === 0 ? (
            <div className="text-center text-slate-400 p-4 border border-slate-700/50 rounded-2xl bg-slate-800/30">لا توجد غرف مسجلة</div>
          ) : (
            filteredRooms.map(room => (
              <div key={room.id} onClick={() => { setIsHost(room.type==='created'); setCurrentRoomId(room.id); setView('room'); }} className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl cursor-pointer hover:border-blue-500 transition-all group">
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMyRooms ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{isMyRooms ? <Key className="w-5 h-5" /> : <User className="w-5 h-5" />}</div>
                   <span className="font-bold text-slate-200">{room.name}</span>
                </div>
                <div className="flex items-center gap-2">
                   {isMyRooms && <button onClick={(e) => handleDeleteRoom(e, room)} className="p-2 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 className="w-5 h-5" /></button>}
                   <LogIn className="w-5 h-5 text-slate-500" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === 'create' || view === 'recover') {
    const isRecover = view === 'recover';
    return (
      <div className="flex-1 flex flex-col p-6 bg-slate-900/50 animate-in fade-in">
        <button onClick={() => setView('menu')} className="p-2 text-slate-400 mb-6"><ArrowLeft /></button>
        <div className="flex flex-col items-center mb-8">
           <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">{isRecover ? <Search className="text-blue-400 w-8 h-8" /> : <Plus className="text-blue-400 w-8 h-8" />}</div>
           <h2 className="text-2xl font-bold text-white">{isRecover ? 'استعادة غرفة مفقودة' : t('createPrivateRoom')}</h2>
        </div>
        <form onSubmit={isRecover ? handleRecover : handleCreate} className="space-y-4 max-w-sm mx-auto w-full">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
          <input type="text" value={roomName} onChange={e => setRoomName(e.target.value)} enterKeyHint="next" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white" placeholder="اسم الغرفة" required />
          <div className="relative">
            <input type={showPin ? "text" : "password"} value={roomPin} onChange={e => setRoomPin(e.target.value)} enterKeyHint="go" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white" placeholder="الرقم السري" required />
            <button type="button" onClick={() => setShowPin(!showPin)} className="absolute right-3 top-3.5 text-slate-400">{showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center">{loading ? <Loader2 className="animate-spin" /> : (isRecover ? 'ابحث واستعد' : 'أنشئ الآن')}</button>
        </form>
      </div>
    );
  }

  if (view === 'share') return (
    <div className="flex-1 flex flex-col p-6 items-center justify-center">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30"><Check className="text-green-400 w-10 h-10" /></div>
      <h2 className="text-2xl font-bold text-white mb-2">{roomName}</h2>
      <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-6"><span className="text-blue-100 font-mono text-sm truncate block text-center" dir="ltr">{generatedLink}</span></div>
      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        <button onClick={() => { navigator.clipboard.writeText(generatedLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }} className="bg-slate-800 text-slate-300 py-3.5 rounded-xl border border-slate-700 flex items-center justify-center gap-2"><Copy className="w-4 h-4"/> {copied ? 'تم النسخ!' : 'نسخ'}</button>
        <button onClick={async () => { if(navigator.share) await navigator.share({title: roomName, text: 'انضم لغرفتي الخاصة', url: generatedLink}); }} className="bg-blue-600/20 border border-blue-500 text-blue-400 py-3.5 rounded-xl flex items-center justify-center gap-2"><Share2 className="w-4 h-4"/> مشاركة...</button>
      </div>
      <button onClick={() => setView('room')} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">دخول الغرفة</button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center p-6 bg-gradient-to-b from-transparent to-slate-900/50 gap-6 overflow-y-auto">
      <div className="flex flex-col items-center mt-8 mb-4">
        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center border border-slate-700/50 shadow-lg mb-4"><Lock className="w-10 h-10 text-slate-400" /></div>
        <p className="text-2xl font-bold text-slate-200">{t('privateRoom')}</p>
      </div>
      <div className="flex flex-col w-full max-w-xs gap-4">
        <button onClick={() => { setRoomName(''); setRoomPin(''); setView('create'); }} className="bg-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:scale-105 transition-transform"><Plus /> أنشئ غرفة خاصة</button>
        <button onClick={() => setView('join')} className="bg-slate-800 border border-slate-700 text-slate-300 py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform"><LogIn /> انضم لرابط</button>
        <div className="grid grid-cols-2 gap-4">
           <button onClick={() => setView('myRooms')} className="bg-blue-600/80 text-white p-4 rounded-2xl flex flex-col items-center font-bold text-sm"><Key className="mb-2" /> {t('myRooms')}</button>
           <button onClick={() => setView('visitorRooms')} className="bg-emerald-500/80 text-white p-4 rounded-2xl flex flex-col items-center font-bold text-sm"><User className="mb-2" /> {t('visitor')}</button>
        </div>
        <button onClick={() => { setRoomName(''); setRoomPin(''); setView('recover'); }} className="text-slate-500 text-xs font-medium hover:text-blue-400 transition-colors mt-2 underline underline-offset-4">فقدت غرفتك؟ ابحث عنها واستعدها هنا</button>
      </div>
    </div>
  );
}
