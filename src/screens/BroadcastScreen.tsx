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
}

const LiveStreamViewer = React.memo(({ streamId, isHost, hostName }: LiveStreamViewerProps) => {
  const { user } = useUser();
  const zpRef = useRef<any>(null);
  const joinedRef = useRef(false);

  const myMeeting = async (element: HTMLDivElement | null) => {
    if (!element) {
      if (zpRef.current) {
        try { zpRef.current.destroy(); } catch (e) {}
        zpRef.current = null;
      }
      joinedRef.current = false;
      return;
    }

    if (joinedRef.current || !user?.id) return;
    joinedRef.current = true;

    const appID = 21954096;
    const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4".trim();
    
    const randomStr = Math.random().toString(36).substring(2, 10);
    const uniqueUserId = `u_${user.id.substring(0, 5)}_${Date.now().toString().slice(-4)}_${randomStr}`;
    const myName = user.fullName || 'User';

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, streamId, uniqueUserId, myName);
    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    zp.joinRoom({
      container: element,
      scenario: { 
        mode: ZegoUIKitPrebuilt.VideoConference,
      },
      showPreJoinView: false,
      turnOnMicrophoneWhenJoining: isHost,
      turnOnCameraWhenJoining: isHost,
      showMyCameraToggleButton: false,
      showMyMicrophoneToggleButton: false,
      showAudioVideoSettingsButton: false,
      showScreenSharingButton: false,
      showLeavingView: false,
      showLeaveButton: false,
      showBottomMenuBar: false,
      // 💡 CRITICAL FIX: Forcefully empty the array of bottom buttons so Zego cannot render them
      bottomMenuBarConfig: {
        maxCount: 0,
        buttons: [],
      },
      showTextChat: false,
      showUserList: false,
      showNonVideoUser: false, 
      layout: "Auto"
    });
  };

  return <div className="absolute inset-0 w-full h-full bg-black pointer-events-auto z-0" ref={myMeeting} />;
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

    // 💡 FIX: Request permissions explicitly before creating the stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      setError(dir === 'rtl' ? 'يرجى السماح للتطبيق باستخدام الكاميرا والميكروفون أولاً.' : 'Please allow camera and mic access first.');
      setLoading(false);
      return;
    }

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
    <div className="fixed top-0 left-0 w-screen h-screen z-[99999] bg-black overflow-hidden flex flex-col" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} dir={dir}>
      
      {/* 💡 THE RED ARROW EXIT BUTTON */}
      <button onClick={handleExitRoom} className={`absolute top-[max(1.5rem,env(safe-area-inset-top))] ${dir === 'rtl' ? 'right-4' : 'left-4'} z-50 p-2.5 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-colors pointer-events-auto shadow-[0_0_10px_rgba(239,68,68,0.3)] border border-red-500/20`}>
          <ChevronLeft className={`w-6 h-6 text-red-500 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
      </button>

      {!activeStream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]"><Video className="w-16 h-16 text-slate-600 mb-4" /><p className="text-slate-400 font-bold">{dir === 'rtl' ? 'انتهى البث' : 'Stream ended'}</p></div>
      ) : (
        <>
          <LiveStreamViewer key={activeStream.id} streamId={activeStream.id} isHost={isHost} hostName={activeStream.host_name} />

          {/* Top Info Bar */}
          <div className={`absolute top-[max(1.5rem,env(safe-area-inset-top))] inset-x-0 p-4 pt-14 flex justify-between items-start z-20 pointer-events-none bg-gradient-to-b from-black/60 to-transparent pb-10 ${dir === 'rtl' ? 'pl-4' : 'pr-4'}`}>
            <div className="flex flex-col gap-2 pointer-events-auto">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full pr-4 pl-1 py-1 border border-white/10 w-max">
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                  {activeStream.host_name?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold leading-tight">{activeStream.host_name}</span>
                  <span className="text-slate-300 text-[10px]">{activeStream.topic}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 pointer-events-auto mt-[-3rem]">
              <div className="bg-red-600/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> LIVE
              </div>
              <div className="bg-black/50 backdrop-blur-md text-white text-[11px] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5 mt-2">
                <Users className="w-3 h-3" /> {activeStream.viewers || 0}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 inset-x-0 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex justify-between items-end z-20 pointer-events-none gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32">
            <div className="flex-1 max-w-[70%] flex flex-col gap-3 pointer-events-auto">
              <div className="h-48 overflow-y-auto flex flex-col justify-end gap-2 pb-2 mask-image-to-top no-scrollbar">
                {comments.map(c => (
                  <div key={c.id} className="bg-black/40 backdrop-blur-md rounded-2xl p-2 px-3 text-sm w-max max-w-full">
                    <span className="font-bold text-blue-400 me-2">{c.user}:</span>
                    <span className="text-white break-words drop-shadow-md">{c.text}</span>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex items-center bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 focus-within:border-blue-500/50 transition-colors">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendComment()} placeholder={dir === 'rtl' ? 'أضف تعليقاً...' : 'Add comment...'} className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-400 py-1.5" dir={dir} />
                </div>
                <button onClick={handleSendComment} className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"><Send className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180 -ml-1' : 'ml-1'}`} /></button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pointer-events-auto mb-2">
              <button onClick={handleLike} disabled={hasLiked} className="flex flex-col items-center gap-1 group disabled:opacity-80">
                <div className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border transition-colors ${hasLiked ? 'bg-red-500/20 border-red-500/50' : 'bg-black/40 border-white/10 group-hover:bg-red-500/20'}`}>
                  <Heart className={`w-6 h-6 transition-all ${hasLiked ? 'text-red-500 fill-red-500 scale-110' : 'text-white group-hover:text-red-500 group-hover:fill-red-500'}`} />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow-md">{likesCount}</span>
              </button>
              <button onClick={() => {}} className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.5)] group-hover:scale-110 transition-transform border border-white/20">
                  <Gift className="w-6 h-6 text-white" />
                </div>
              </button>
            </div>
          </div>

          {liveStreams.length > 1 && (
             <div className={`absolute ${dir === 'rtl' ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10 pointer-events-none`}>
                {liveStreams.map((_, idx) => {
                  const isSelected = _.id === activeStream.id;
                  return <div key={_.id} className={`w-1.5 rounded-full transition-all duration-300 ${isSelected ? 'h-4 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'h-1.5 bg-white/30'}`} />;
                })}
             </div>
          )}
        </>
      )}

      {/* 💡 CSS rule to completely nuke the Zego bottom bar if their SDK ignores the config */}
      <style>{`
        .mask-image-to-top {
          mask-image: linear-gradient(to top, black 70%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 70%, transparent 100%);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* Ultimate override to hide Zego's default controls */
        #zego-video-container > div > div:last-child {
           display: none !important;
           opacity: 0 !important;
           visibility: hidden !important;
           pointer-events: none !important;
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(roomOverlay, document.body) : roomOverlay;
}
