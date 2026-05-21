import React, { useState, useEffect, useRef } from 'react';
import { Video, Users, Gift, X, Send, Radio, Loader2, AlertCircle, Plus, Heart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

// Detached viewer component to safely mount/unmount Zego and prevent 1002011 errors on swipe
const LiveStreamViewer = ({ streamId, isHost, hostName }: { streamId: string, isHost: boolean, hostName: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const { user } = useUser();

  useEffect(() => {
    if (!containerRef.current || !user) return;
    let isMounted = true;

    const initLive = async () => {
      const appID = 21954096;
      const serverSecret = "214c0cd0d6b215fa94856c3b377f92e4".trim();
      const uniqueUserId = (user.id || 'u').replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) + '_live';
      const myName = user.fullName || 'User';

      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, streamId, uniqueUserId, myName);
      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      if (isMounted) {
        zp.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.LiveStreaming,
            config: { role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience },
          },
          showPreJoinView: false,
          turnOnMicrophoneWhenJoining: isHost,
          turnOnCameraWhenJoining: isHost,
          showMyCameraToggleButton: isHost,
          showMyMicrophoneToggleButton: isHost,
          showAudioVideoSettingsButton: isHost,
          showScreenSharingButton: false,
          showLeavingView: false,
          showTextChat: false, 
          layout: "Gallery"
        });
      }
    };

    initLive();

    return () => {
      isMounted = false;
      if (zpRef.current) {
        try { zpRef.current.destroy(); } catch (e) {}
        zpRef.current = null;
      }
    };
  }, [streamId, isHost, user]);

  return <div className="absolute inset-0 w-full h-full bg-black pointer-events-auto" ref={containerRef} />;
};

export default function BroadcastScreen() {
  const { t, dir } = useLanguage();
  const { user } = useUser();
  const [viewState, setViewState] = useState<'feed' | 'setup'>('feed');
  const [liveStreams, setLiveStreams] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [topic, setTopic] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<{id: number, user: string, text: string}[]>([]);

  // Vertical swiping state
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);

  useEffect(() => {
    fetchLiveStreams();
  }, []);

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('live_streams').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setLiveStreams(data);
      } else {
        setLiveStreams([
          { id: 'mock1', host_name: 'Ahmed', topic: 'تطوير التطبيقات', viewers: 120, isMock: true },
          { id: 'mock2', host_name: 'Sarah', topic: 'نقاش مفتوح', viewers: 85, isMock: true }
        ]);
      }
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
        host_name: user?.fullName || 'أنا',
        topic: topic,
        field: 'عام',
        viewers: 0
      };

      await supabase.from('live_streams').insert([newStream]);
      
      setLiveStreams([newStream, ...liveStreams]);
      setIsHost(true);
      setCurrentIndex(0);
      setViewState('feed');
    } catch (err: any) {
      setError(err.message || 'Failed to go live');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    setComments(prev => [...prev, { id: Date.now(), user: user?.fullName || 'أنا', text: newComment }]);
    setNewComment('');
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartY(e.targetTouches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEndY(e.targetTouches[0].clientY);
  const handleTouchEnd = () => {
    if (!touchStartY || !touchEndY) return;
    const distance = touchStartY - touchEndY;
    const swipeThreshold = 50;

    if (distance > swipeThreshold && currentIndex < liveStreams.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setComments([]); 
      setIsHost(false); 
    } else if (distance < -swipeThreshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setComments([]);
      setIsHost(false);
    }
    setTouchStartY(0); setTouchEndY(0);
  };

  if (viewState === 'setup') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-[#0f172a] items-center justify-center animate-in fade-in duration-300" dir={dir}>
        <div className="w-full max-w-sm bg-slate-800/80 p-8 rounded-[32px] border border-slate-700 shadow-2xl relative">
          <button onClick={() => setViewState('feed')} className={`absolute top-6 ${dir === 'rtl' ? 'right-6' : 'left-6'} p-2 text-slate-400 hover:text-white bg-slate-900/50 rounded-full`}><X className="w-5 h-5"/></button>
          
          <div className="flex flex-col items-center mb-8 mt-4">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30 animate-pulse"><Radio className="w-10 h-10 text-blue-400" /></div>
            <h2 className="text-2xl font-bold text-white tracking-wide">{dir === 'rtl' ? 'بدء بث مباشر' : 'Go Live'}</h2>
          </div>

          <div className="space-y-4">
            {error && <div className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>}
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={dir === 'rtl' ? 'عنوان البث...' : 'Stream Topic...'} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-blue-500" dir={dir} />
            <button onClick={handleGoLive} disabled={!topic || loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2">
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Video className="w-5 h-5" /> {dir === 'rtl' ? 'ابدأ الآن' : 'Start Now'}</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentBroadcast = liveStreams[currentIndex];

  return (
    <div 
      className="flex-1 relative bg-black overflow-hidden flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      dir={dir}
    >
      {loading && liveStreams.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>
      ) : liveStreams.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a]">
           <Video className="w-16 h-16 text-slate-600 mb-4" />
           <p className="text-slate-400 mb-6 font-bold">{dir === 'rtl' ? 'لا توجد بثوث نشطة حالياً' : 'No active streams'}</p>
           <button onClick={() => setViewState('setup')} className="bg-blue-600 text-white px-6 py-3 rounded-full font-bold shadow-lg"><Plus className="w-5 h-5 inline mr-2"/> {dir === 'rtl' ? 'كُن أول من يبث' : 'Be the first to stream'}</button>
        </div>
      ) : (
        <>
          {currentBroadcast.isMock ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
               <Video className="w-20 h-20 text-slate-700 mb-4" />
               <p className="text-slate-500 font-bold">{dir === 'rtl' ? 'بث تجريبي (غير متصل بالخادم)' : 'Mock Stream'}</p>
            </div>
          ) : (
            <LiveStreamViewer key={currentBroadcast.id} streamId={currentBroadcast.id} isHost={isHost} hostName={currentBroadcast.host_name} />
          )}

          <div className="absolute top-0 inset-x-0 p-4 pt-safe sm:pt-8 flex justify-between items-start z-20 pointer-events-none bg-gradient-to-b from-black/60 to-transparent pb-10">
            <div className="flex flex-col gap-2 pointer-events-auto">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full pr-4 pl-1 py-1 border border-white/10 w-max">
                <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-inner">
                  {currentBroadcast.host_name?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold leading-tight">{currentBroadcast.host_name}</span>
                  <span className="text-slate-300 text-[10px]">{currentBroadcast.topic}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              <div className="bg-red-600/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> LIVE
              </div>
              <div className="bg-black/50 backdrop-blur-md text-white text-[11px] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> {currentBroadcast.viewers}
              </div>
            </div>
          </div>

          {!isHost && (
            <button onClick={() => setViewState('setup')} className="absolute top-20 right-4 z-30 p-3 bg-blue-600/80 backdrop-blur-md text-white rounded-full shadow-lg hover:bg-blue-500 transition-colors pointer-events-auto">
              <Video className="w-5 h-5" />
            </button>
          )}

          <div className="absolute bottom-0 inset-x-0 p-4 pb-safe sm:pb-8 flex justify-between items-end z-20 pointer-events-none gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-32">
            
            <div className="flex-1 max-w-[70%] flex flex-col gap-3 pointer-events-auto">
              <div className="h-48 overflow-y-auto flex flex-col justify-end gap-2 pb-2 mask-image-to-top no-scrollbar">
                {comments.map(c => (
                  <div key={c.id} className="bg-black/40 backdrop-blur-md rounded-2xl p-2 px-3 text-sm w-max max-w-full">
                    <span className="font-bold text-blue-400 me-2">{c.user}:</span>
                    <span className="text-white break-words drop-shadow-md">{c.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 flex items-center bg-black/40 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 focus-within:border-blue-500/50 transition-colors">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendComment()} placeholder={dir === 'rtl' ? 'أضف تعليقاً...' : 'Add comment...'} className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-400 py-1.5" dir={dir} />
                </div>
                <button onClick={handleSendComment} className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg"><Send className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180 -ml-1' : 'ml-1'}`} /></button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 pointer-events-auto mb-2">
              <button className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 group-hover:bg-red-500/20 transition-colors">
                  <Heart className="w-6 h-6 text-white group-hover:text-red-500 group-hover:fill-red-500 transition-all" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow-md">1.2K</span>
              </button>
              
              <button onClick={() => setComments(prev => [...prev, { id: Date.now(), user: user?.fullName || 'أنا', text: 'أرسل هدية 🎁' }])} className="flex flex-col items-center gap-1 group">
                <div className="w-12 h-12 bg-gradient-to-tr from-pink-500 to-rose-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.5)] group-hover:scale-110 transition-transform border border-white/20">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-[10px] font-bold drop-shadow-md">{dir === 'rtl' ? 'هدية' : 'Gift'}</span>
              </button>
            </div>
          </div>

          {liveStreams.length > 1 && (
             <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10 pointer-events-none">
                {liveStreams.map((_, idx) => (
                  <div key={idx} className={`w-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'h-4 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'h-1.5 bg-white/30'}`} />
                ))}
             </div>
          )}
        </>
      )}

      <style>{`
        .mask-image-to-top {
          mask-image: linear-gradient(to top, black 70%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 70%, transparent 100%);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
