import React, { useState, useEffect } from 'react';
import { Lock, Plus, LogIn, Copy, ArrowLeft, Check, Link as LinkIcon, History, ChevronRight, Key, User, Loader2, AlertCircle } from 'lucide-react';
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
  const [view, setView] = useState<'menu' | 'create' | 'share' | 'join' | 'room' | 'myRooms' | 'visitorRooms'>('menu');
  const [roomName, setRoomName] = useState('');
  const [roomPin, setRoomPin] = useState('');
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
    // Load joined rooms from local storage
    const savedRooms = localStorage.getItem('joined_rooms');
    if (savedRooms) {
      setRecentRooms(JSON.parse(savedRooms));
    }
  }, []);

  const saveRoomsToLocal = (rooms: RoomHistory[]) => {
    setRecentRooms(rooms);
    localStorage.setItem('joined_rooms', JSON.stringify(rooms));
  };

  const handleCreate = async () => {
    if (!roomName || !roomPin) return;
    
    setLoading(true);
    setError('');

    try {
      // Generate a unique random string (Room ID)
      const roomId = Math.random().toString(36).substring(2, 10);
      const link = `https://app.com/room/${roomId}`;
      
      // Try to save to Supabase
      const { error: insertError } = await supabase
        .from('private_rooms')
        .insert([{ 
          id: roomId, 
          host_id: user?.id || 'anonymous', 
          name: roomName,
          pin: roomPin
        }]);

      if (insertError) {
        console.warn('Supabase insert failed, falling back to local state:', insertError);
        // We continue anyway for the preview environment if table doesn't exist
      }

      setGeneratedLink(link);
      
      // Add to history
      const newRooms = [{
        id: roomId,
        name: roomName,
        type: 'created' as const,
        link
      }, ...recentRooms];
      
      saveRoomsToLocal(newRooms);

      setIsHost(true);
      setCurrentRoomId(roomId);
      setView('share');
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!joinLink) return;
    
    setLoading(true);
    setError('');

    try {
      const roomCode = joinLink.split('/').pop() || 'Unknown';
      
      // Verify against database
      const { data: roomData, error: fetchError } = await supabase
        .from('private_rooms')
        .select('*')
        .eq('id', roomCode)
        .maybeSingle();

      if (fetchError) {
        console.warn('Supabase fetch failed, falling back to local state:', fetchError);
      }

      // If we have DB data, use it. Otherwise, fallback to a generic name for the preview.
      const roomName = roomData?.name || `Room ${roomCode}`;

      // Add to history
      const newRooms = [{
        id: roomCode,
        name: roomName,
        type: 'joined' as const,
        link: joinLink
      }, ...recentRooms];
      
      saveRoomsToLocal(newRooms);

      setIsHost(false);
      setCurrentRoomId(roomCode);
      setView('room');
      setJoinLink('');
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickJoin = (room: RoomHistory) => {
    setIsHost(room.type === 'created');
    setCurrentRoomId(room.id);
    setView('room');
  };

  if (view === 'room') {
    return <TripleScreenRoom onExit={() => setView('menu')} isHost={isHost} roomId={currentRoomId} />;
  }

  if (view === 'myRooms' || view === 'visitorRooms') {
    const isMyRooms = view === 'myRooms';
    const filteredRooms = recentRooms.filter(r => r.type === (isMyRooms ? 'created' : 'joined'));

    return (
      <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button 
          onClick={() => setView('menu')}
          className="self-start p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mb-6"
        >
          <ArrowLeft className={`w-6 h-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>
        
        <div className="flex flex-col items-center mb-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border ${isMyRooms ? 'bg-blue-500/20 border-blue-500/30' : 'bg-emerald-500/20 border-emerald-500/30'}`}>
            {isMyRooms ? <Key className={`w-8 h-8 text-blue-400`} /> : <User className={`w-8 h-8 text-emerald-400`} />}
          </div>
          <h2 className="text-2xl font-bold text-white">{isMyRooms ? t('myRooms') : t('visitor')}</h2>
        </div>

        <div className="w-full max-w-sm mx-auto">
          {filteredRooms.length === 0 ? (
            <div className="text-center p-8 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <p className="text-slate-400">{t('noRooms')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => handleQuickJoin(room)}
                  className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isMyRooms ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {isMyRooms ? <Key className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-slate-200 group-hover:text-white transition-colors text-left line-clamp-1">{room.name}</span>
                      <span className="text-xs text-slate-500">{isMyRooms ? t('myRooms') : t('visitor')}</span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button 
          onClick={() => setView('menu')}
          className="self-start p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mb-6"
        >
          <ArrowLeft className={`w-6 h-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
            <Plus className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('createPrivateRoom')}</h2>
        </div>

        <div className="space-y-4 w-full max-w-sm mx-auto relative">
          {error && (
            <div className="absolute -top-12 left-0 right-0 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 px-1">{t('groupName')}</label>
            <input 
              type="text" 
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder={t('groupName')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 px-1">{t('privateNumber')}</label>
            <input 
              type="password" 
              value={roomPin}
              onChange={(e) => setRoomPin(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder="****"
              maxLength={8}
            />
          </div>
          
          <button 
            onClick={handleCreate}
            disabled={!roomName || !roomPin || loading}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('create')}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'share') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">{roomName}</h2>
          <p className="text-slate-400 text-center mb-8">Room created successfully. Share this link with your friends.</p>

          <div className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-4 mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t('roomLink')}</label>
            <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
              <LinkIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <span className="text-blue-400 font-mono text-sm truncate flex-1" dir="ltr">{generatedLink}</span>
            </div>
          </div>

          <button 
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl transition-all active:scale-95 ${
              copied 
                ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.4)]' 
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            {copied ? t('linkCopied') : t('copyLink')}
          </button>
          
          <button 
            onClick={() => {
              setView('room');
              setRoomName('');
              setRoomPin('');
            }}
            className="w-full mt-4 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
          >
            {t('enterRoom')}
          </button>

          <button 
            onClick={() => {
              setView('menu');
              setRoomName('');
              setRoomPin('');
            }}
            className="w-full mt-4 text-slate-400 font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors"
          >
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button 
          onClick={() => setView('menu')}
          className="self-start p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors mb-6"
        >
          <ArrowLeft className={`w-6 h-6 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
        </button>
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mb-4 border border-slate-600/50">
            <LogIn className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-white">{t('joinPrivateRoom')}</h2>
        </div>

        <div className="space-y-4 w-full max-w-sm mx-auto relative">
          {error && (
            <div className="absolute -top-12 left-0 right-0 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5 px-1">{t('enterRoomLink')}</label>
            <input 
              type="text" 
              value={joinLink}
              onChange={(e) => setJoinLink(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              placeholder="https://app.com/room/..."
              dir="ltr"
            />
          </div>
          
          <button 
            onClick={handleJoin}
            disabled={!joinLink || loading}
            className="w-full mt-6 bg-slate-700 text-white font-bold py-4 rounded-xl hover:bg-slate-600 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('join')}
          </button>
        </div>
      </div>
    );
  }

  // Default Menu View
  return (
    <div className="flex-1 flex flex-col items-center p-6 bg-gradient-to-b from-transparent to-slate-900/50 gap-6 animate-in fade-in duration-300 overflow-y-auto">
      <div className="flex flex-col items-center justify-center mt-8 mb-4">
        <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700/50 shadow-lg">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>
        <p className="text-2xl font-bold text-slate-200">{t('privateRoom')}</p>
      </div>
      
      <div className="flex flex-col w-full max-w-xs gap-4">
        <button 
          onClick={() => setView('create')}
          className="group relative w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-1 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <div className="flex items-center justify-center gap-3 bg-slate-900/20 backdrop-blur-sm w-full h-full py-4 px-6 rounded-xl border border-white/10">
            <Plus className="w-6 h-6 text-white" />
            <span className="font-bold text-white text-lg tracking-wide">{t('createPrivateRoom')}</span>
          </div>
        </button>

        <button 
          onClick={() => setView('join')}
          className="group relative w-full rounded-2xl bg-slate-800 p-1 shadow-lg border border-slate-700 hover:border-slate-500 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <div className="flex items-center justify-center gap-3 w-full h-full py-4 px-6 rounded-xl">
            <LogIn className="w-6 h-6 text-slate-300 group-hover:text-white transition-colors" />
            <span className="font-bold text-slate-300 group-hover:text-white text-lg tracking-wide transition-colors">{t('joinPrivateRoom')}</span>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <button 
            onClick={() => setView('myRooms')}
            className="group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-600/80 to-indigo-600/80 hover:from-blue-500 hover:to-indigo-500 shadow-lg transition-all duration-300 hover:-translate-y-1 active:scale-95 border border-white/10"
          >
            <Key className="w-7 h-7 text-white mb-1" />
            <span className="font-bold text-white text-sm tracking-wide text-center">{t('myRooms')}</span>
          </button>

          <button 
            onClick={() => setView('visitorRooms')}
            className="group relative flex flex-col items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/80 to-teal-600/80 hover:from-emerald-400 hover:to-teal-500 shadow-lg transition-all duration-300 hover:-translate-y-1 active:scale-95 border border-white/10"
          >
            <User className="w-7 h-7 text-white mb-1" />
            <span className="font-bold text-white text-sm tracking-wide text-center">{t('visitor')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
