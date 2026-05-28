import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Video, Users, Gift, X, Send, Radio, Loader2, AlertCircle, Search, ChevronLeft, Heart, Trash2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

interface LiveStreamViewerProps {
  streamId: string;
  isHost: boolean;
  hostName: string;
  onLeave: () => void;
}

const LiveStreamViewer = React.memo(({ streamId, isHost, hostName, onLeave }: LiveStreamViewerProps) => {
  const { user } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !user?.id) return;

    const appID = 1823159648;
    const serverSecret = "b53364d7eb4f7975c7389248d516e8d8".trim();
    
    const randomStr = Math.random().toString(36).substring(2, 10);
    const uniqueUserId = `u_${user.id.substring(0, 5)}_${randomStr}`;
    const myName = user.fullName || 'User';

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, streamId, uniqueUserId, myName);
    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    zp.joinRoom({
      container: containerRef.current,
      scenario: { 
        mode: ZegoUIKitPrebuilt.LiveStreaming,
        config: { role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience }
      },
      showPreJoinView: false,
      turnOnMicrophoneWhenJoining: isHost,
      turnOnCameraWhenJoining: isHost,
      showMyCameraToggleButton: isHost,
      showMyMicrophoneToggleButton: isHost,
      showAudioVideoSettingsButton: isHost,
      showScreenSharingButton: isHost,
      showLeavingView: true,
      // @ts-ignore
      showLeaveButton: true,
      showBottomMenuBar: true,
      onLeaveRoom: () => onLeave()
    });

    return () => {
      if (zpRef.current) {
        try { zpRef.current.destroy(); } catch (e) {}
      }
    };
  }, [streamId, isHost, user?.id]);

  return <div className="absolute inset-0 w-full h-full pointer-events-auto z-0" ref={containerRef} />;
});

export default function BroadcastScreen() {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [viewState, setViewState] = useState<'list' | 'setup' | 'room'>('list');
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [activeStream, setActiveStream] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [topic, setTopic] = useState('');
  const [field, setField] = useState('Education');
  const [isHost, setIsHost] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{id: string, user: string, text: string}[]>([]);

  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase.channel('public:live_streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setLiveStreams(prev => {
            if (prev.find(s => s.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setLiveStreams(prev => prev.filter(stream => stream.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!activeStream || !user?.id) {
      setComments([]); 
      return;
    }

    const roomChannel = supabase.channel(`room_${activeStream.id}`, {
      config: { 
        broadcast: { ack: false },
        presence: { key: user.id } 
      },
    });

    roomChannel
      .on('broadcast', { event: 'new_comment' }, (payload) => {
        setComments(prev => [...prev, payload.payload].slice(-50));
      })
      .on('broadcast', { event: 'like_update' }, (payload) => {
        setActiveStream(prev => prev ? { ...prev, liked_by: payload.payload.liked_by } : null);
        setLiveStreams(prev => prev.map(s => s.id === activeStream.id ? { ...s, liked_by: payload.payload.liked_by } : s));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = roomChannel.presenceState();
        const viewersCount = Object.keys(state).length;
        
        setActiveStream(prev => prev ? { ...prev, viewers: viewersCount } : null);
        setLiveStreams(prev => prev.map(s => s.id === activeStream.id ? { ...s, viewers: viewersCount } : s));
        
        if (isHost && activeStream.id) {
          supabase.from('live_streams').update({ viewers: viewersCount }).eq('id', activeStream.id).then();
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomChannel.track({ user_id: user.id });
        }
      });

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [activeStream?.id, isHost]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    if (viewState === 'list') fetchLiveStreams();
  }, [viewState]);

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('live_streams').select('*').order('created_at', { ascending: false });
      if (!error && data) setLiveStreams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoLive = async () => {
    if (!topic) return;
    setLoading(true); setError('');

    try {
      const streamId = `live_${Math.random().toString(36).substring(2, 10)}`;
      const newStream = {
        id: streamId,
        host_id: user?.id || 'anonymous',
        host_name: user?.fullName || 'Me',
        topic: topic,
        field: field,
        viewers: 0,
        liked_by: []
      };

      const { error: insertError } = await supabase.from('live_streams').insert([newStream]);
      if (insertError) throw insertError;
      
      setIsHost(true);
      setActiveStream(newStream);
      setViewState('room');
    } catch (err: any) {
      setError(err.message || 'Failed to go live');
    } finally {
      setLoading(false);
    }
  };

  const handleExitRoom = async () => {
    if (isHost && activeStream) {
      try {
        await supabase.from('live_streams').delete().eq('id', activeStream.id);
        setLiveStreams(prev => prev.filter(s => s.id !== activeStream.id));
      } catch(e) {}
    }
    setIsHost(false);
    setActiveStream(null);
    setViewState('list');
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !activeStream) return;
    const commentData = { id: `${Date.now()}_${Math.random()}`, user: user?.fullName || 'User', text: newComment };
    setComments(prev => [...prev, commentData].slice(-50));
    setNewComment('');
    await supabase.channel(`room_${activeStream.id}`).send({ type: 'broadcast', event: 'new_comment', payload: commentData });
  };

  const handleLike = async () => {
    if (!activeStream || !user?.id) return;
    const currentLikes = activeStream.liked_by || [];
    if (currentLikes.includes(user.id)) return;
    
    const newLikes = [...currentLikes, user.id];
    
    setActiveStream({ ...activeStream, liked_by: newLikes });
    setLiveStreams(prev => prev.map(s => s.id === activeStream.id ? { ...s, liked_by: newLikes } : s));
    
    supabase.channel(`room_${activeStream.id}`).send({
      type: 'broadcast',
      event: 'like_update',
      payload: { liked_by: newLikes }
    });
    
    await supabase.from('live_streams').update({ liked_by: newLikes }).eq('id', activeStream.id);
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartY(e.targetTouches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEndY(e.targetTouches[0].clientY);
  const handleTouchEnd = () => {
    if (!touchStartY || !touchEndY || liveStreams.length <= 1 || !activeStream) return;
    const distance = touchStartY - touchEndY;
    const swipeThreshold = 50;
    const currentIdx = liveStreams.findIndex(s => s.id === activeStream.id);

    if (currentIdx === -1) return;

    if (distance > swipeThreshold && currentIdx < liveStreams.length - 1) {
      if (isHost) handleExitRoom(); 
      const nextStream = liveStreams[currentIdx + 1];
      setIsHost(user?.id === nextStream.host_id);
      setActiveStream(nextStream);
    } else if (distance < -swipeThreshold && currentIdx > 0) {
      if (isHost) handleExitRoom(); 
      const prevStream = liveStreams[currentIdx - 1];
      setIsHost(user?.id === prevStream.host_id);
      setActiveStream(prevStream);
    }
    setTouchStartY(0); setTouchEndY(0);
  };

  if (viewState === 'list') {
    const filtered = liveStreams.filter(b => b.topic.toLowerCase().includes(searchQuery.toLowerCase()) || (b.field && b.field.toLowerCase().includes(searchQuery.toLowerCase())));
    return (
      <div className="flex-1 flex flex-col p-4 bg-gradient-to-b from-transparent to-slate-900/50 overflow-y-auto animate-in fade-in duration-300" dir={dir}>
        <div className="flex gap-3 items-center mb-6">
          <button onClick={() => setViewState('setup')} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg flex-shrink-0 transition-transform active:scale-95">
            <Radio className="w-5 h-5 animate-pulse" />
          </button>
          <div className="flex-1 relative">
            <div className={`absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-3' : 'left-3'}`}>
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={dir === 'rtl' ? 'البحث عن طريق الموضوع...' : 'Search by topic...'} className={`w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-white placeholder-slate-400 focus:border-blue-500 outline-none transition-colors`} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-4">{dir === 'rtl' ? 'البثوث النشطة' : 'Active Broadcasts'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-20">
          {loading ? (
            <div className="col-span-full flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-500 font-bold">{dir === 'rtl' ? 'لا توجد بثوث حقيقية حالياً' : 'No active streams at the moment'}</div>
          ) : (
            filtered.map((broadcast) => {
              const isItemHost = user?.id === broadcast.host_id;
              return (
                <div key={broadcast.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-colors group cursor-pointer relative" onClick={() => { setIsHost(isItemHost); setActiveStream(broadcast); setViewState('room'); }}>
                  {isItemHost && (
                    <button onClick={async (e) => { 
                      e.stopPropagation(); 
                      await supabase.from('live_streams').delete().eq('id', broadcast.id);
                      setLiveStreams(prev => prev.filter(s => s.id !== broadcast.id)); 
                    }} className="absolute top-2 right-2 z-20 p-2 bg-red-600/90 hover:bg-red-500 text-white rounded-full shadow-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                  )}
                  <div className="relative aspect-video bg-slate-900">
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-800 to-slate-900"><Video className="w-10 h-10 text-slate-600 group-hover:scale-110 transition-transform duration-500"/></div>
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE</div>
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1"><Users className="w-3 h-3" /> {broadcast.viewers || 0}</div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-white font-bold truncate">{broadcast.topic}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-slate-400 text-xs">{broadcast.host_name}</p>
                      <span className="text-blue-400 text-[10px] bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">{broadcast.field || 'General'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'setup') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-[#0f172a] items-center justify-center animate-in fade-in duration-300" dir={dir}>
        <div className="w-full max-w-sm bg-slate-800/80 p-8 rounded-[32px] border border-slate-700 shadow-2xl relative">
          <button onClick={() => setViewState('list')} className={`absolute top-6 ${dir === 'rtl' ? 'right-6' : 'left-6'} p-2 text-slate-400 hover:text-white bg-slate-900/50 rounded-full`}><X className="w-5 h-5"/></button>
          <div className="flex flex-col items-center mb-8 mt-4">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30 shadow-lg"><Radio className="w-10 h-10 text-blue-400" /></div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{dir === 'rtl' ? 'إعداد البث' : 'Broadcast Setup'}</h2>
          </div>
          <div className="space-y-4">
            {error && <div className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>}
            <div className="space-y-2">
                <label className="text-slate-400 text-xs font-bold">{dir === 'rtl' ? 'المجال' : 'Field'}</label>
                <select value={field} onChange={e => setField(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500">
                    <option value="Education">{dir === 'rtl' ? 'تعليم' : 'Education'}</option>
                    <option value="Politics">{dir === 'rtl' ? 'سياسة' : 'Politics'}</option>
                    <option value="Tech">{dir === 'rtl' ? 'تكنولوجيا' : 'Tech'}</option>
                    <option value="Gaming">{dir === 'rtl' ? 'ألعاب' : 'Gaming'}</option>
                </select>
            </div>
            <div className="space-y-2">
                <label className="text-slate-400 text-xs font-bold">{dir === 'rtl' ? 'الموضوع' : 'Topic'}</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={dir === 'rtl' ? 'عنوان البث...' : 'Stream Topic...'} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" dir={dir} />
            </div>
            <button onClick={handleGoLive} disabled={!topic || loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2 mt-6">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Radio className="w-5 h-5 animate-pulse" /> {dir === 'rtl' ? 'بدء البث الحقيقي' : 'Go Live Now'}</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasLiked = activeStream?.liked_by?.includes(user?.id);
  const likesCount = activeStream?.liked_by?.length || 0;

  const roomOverlay = (
    <div className="fixed top-0 left-0 w-screen h-screen z-[99999] bg-black overflow-hidden flex flex-col" dir={dir}>
      {!activeStream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]">
          <Video className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-slate-400 font-bold">{dir === 'rtl' ? 'انتهى البث' : 'Stream ended'}</p>
        </div>
      ) : (
        <LiveStreamViewer 
          key={activeStream.id} 
          streamId={activeStream.id} 
          isHost={isHost} 
          hostName={activeStream.host_name} 
          onLeave={handleExitRoom} 
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(roomOverlay, document.body) : roomOverlay;
}
