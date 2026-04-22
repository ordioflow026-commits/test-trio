import React, { useState, useEffect } from 'react';
import { Video, Users, User, MonitorPlay, Gift, ChevronLeft, ChevronRight, X, MessageSquare, Bell, Send, Radio, Search, ArrowLeft, ArrowRight, Play, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { useSelection } from '../contexts/SelectionContext';
import { supabase } from '../lib/supabase';

export default function BroadcastScreen() {
  const { t, dir } = useLanguage();
  const { selectedContactIds } = useSelection();
  const [viewState, setViewState] = useState<'list' | 'setup' | 'room'>('list');
  const [isHost, setIsHost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSlot, setCurrentSlot] = useState(0);
  const [showGifts, setShowGifts] = useState(false);
  const [currentBroadcastIndex, setCurrentBroadcastIndex] = useState(0);
  const [donationAmount, setDonationAmount] = useState(5);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useUser();
  const [liveStreams, setLiveStreams] = useState<any[]>([]);

  useEffect(() => {
    fetchLiveStreams();
  }, []);

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_streams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch failed, falling back to mock data:', error);
        setLiveStreams(mockBroadcasts);
      } else if (data && data.length > 0) {
        setLiveStreams(data);
      } else {
        setLiveStreams(mockBroadcasts);
      }
    } catch (err) {
      console.error(err);
      setLiveStreams(mockBroadcasts);
    } finally {
      setLoading(false);
    }
  };

  // Setup Form State
  const [field, setField] = useState('education');
  const [topic, setTopic] = useState('');
  const [interaction, setInteraction] = useState('public');
  const [isPublic, setIsPublic] = useState(true);

  // Mock Comments
  const [comments, setComments] = useState([
    { id: 1, user: 'Ahmed', text: 'Great stream!' },
    { id: 2, user: 'Sarah', text: 'Hello everyone 👋' },
  ]);
  const [newComment, setNewComment] = useState('');

  const handleGoLive = async () => {
    if (!topic) return;
    setLoading(true);
    setError('');

    try {
      const streamId = Math.random().toString(36).substring(2, 10);
      const { error: insertError } = await supabase
        .from('live_streams')
        .insert([{
          id: streamId,
          host_id: user?.id || 'anonymous',
          host_name: user?.fullName || 'Anonymous',
          topic: topic,
          field: field,
          viewers: 0,
          image: `https://picsum.photos/seed/${field}/400/225`
        }]);

      if (insertError) {
        console.warn('Supabase insert failed:', insertError);
      }

      setIsHost(true);
      setViewState('room');
      // Refresh list in background
      fetchLiveStreams();
    } catch (err: any) {
      setError(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: Date.now(), user: 'You', text: newComment }]);
    setNewComment('');
  };

  const handleSendGift = () => {
    setComments([...comments, { id: Date.now(), user: 'You', text: `Sent a $${donationAmount} gift 🎁` }]);
    setShowGifts(false);
  };

  const nextSlot = () => setCurrentSlot((prev) => (prev < 2 ? prev + 1 : prev));
  const prevSlot = () => setCurrentSlot((prev) => (prev > 0 ? prev - 1 : prev));

  const mockBroadcasts = [
    { id: 1, host: 'Ahmed', topic: 'The Cold War', field: t('education'), viewers: '1.2k', image: 'https://picsum.photos/seed/history/400/225' },
    { id: 2, host: 'Sarah', topic: 'Flutter vs React Native', field: t('tech'), viewers: '850', image: 'https://picsum.photos/seed/tech/400/225' },
    { id: 3, host: 'Omar', topic: 'Elden Ring Gameplay', field: t('gaming'), viewers: '3.4k', image: 'https://picsum.photos/seed/gaming/400/225' },
    { id: 4, host: 'Laila', topic: 'Global Warming Effects', field: t('social'), viewers: '2.1k', image: 'https://picsum.photos/seed/nature/400/225' },
  ];

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      setTouchStart(e.targetTouches[0].clientY);
    } else {
      setTouchStart(e.clientY);
      setIsDragging(true);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      setTouchEnd(e.targetTouches[0].clientY);
    } else if (isDragging) {
      setTouchEnd(e.clientY);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (isHost || !touchStart || !touchEnd) {
      setTouchStart(0);
      setTouchEnd(0);
      return;
    }
    const distance = touchStart - touchEnd;
    if (distance > 50 && currentBroadcastIndex < liveStreams.length - 1) {
      setDirection(1);
      setCurrentBroadcastIndex(prev => prev + 1);
      setCurrentSlot(0);
    } else if (distance < -50 && currentBroadcastIndex > 0) {
      setDirection(-1);
      setCurrentBroadcastIndex(prev => prev - 1);
      setCurrentSlot(0);
    }
    setTouchStart(0);
    setTouchEnd(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isHost || isScrolling) return;
    if (e.deltaY > 50 && currentBroadcastIndex < liveStreams.length - 1) {
      setIsScrolling(true);
      setDirection(1);
      setCurrentBroadcastIndex(prev => prev + 1);
      setCurrentSlot(0);
      setTimeout(() => setIsScrolling(false), 800);
    } else if (e.deltaY < -50 && currentBroadcastIndex > 0) {
      setIsScrolling(true);
      setDirection(-1);
      setCurrentBroadcastIndex(prev => prev - 1);
      setCurrentSlot(0);
      setTimeout(() => setIsScrolling(false), 800);
    }
  };

  if (viewState === 'list') {
    const filtered = liveStreams.filter(b => b.topic.toLowerCase().includes(searchQuery.toLowerCase()) || b.field.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="flex-1 flex flex-col p-4 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in duration-300 overflow-y-auto">
        {/* Top Bar */}
        <div className="flex gap-3 items-center mb-6">
          <button 
            onClick={() => setViewState('setup')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all flex-shrink-0"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-sm hidden sm:inline">{t('startBroadcast')}</span>
          </button>
          
          <div className="flex-1 relative">
            <div className={`absolute top-1/2 -translate-y-1/2 ${dir === 'rtl' ? 'right-3' : 'left-3'}`}>
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchTopic')} 
              className={`w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 ${dir === 'rtl' ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-white placeholder-slate-400 focus:border-blue-500 outline-none transition-colors`}
              dir={dir}
            />
          </div>
        </div>

        <h2 className="text-lg font-bold text-white mb-4">{t('activeBroadcasts')}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-20">
          {loading ? (
            <div className="col-span-full flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {filtered.map(broadcast => (
                <div key={broadcast.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-colors group cursor-pointer" onClick={() => { setIsHost(false); setCurrentBroadcastIndex(liveStreams.findIndex(b => b.id === broadcast.id)); setViewState('room'); }}>
                  <div className="relative aspect-video">
                    <img src={broadcast.image} alt={broadcast.topic} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                      {t('live')}
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3" /> {broadcast.viewers}
                    </div>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 bg-blue-600/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm scale-75 group-hover:scale-100">
                        <Play className="w-5 h-5 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-white font-bold truncate">{broadcast.topic}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-slate-400 text-xs">{broadcast.host_name || broadcast.host}</p>
                      <span className="text-blue-400 text-[10px] bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">{broadcast.field}</span>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-10 text-slate-500">
                  {t('noRooms')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'setup') {
    return (
      <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in duration-300 overflow-y-auto">
        <button onClick={() => setViewState('list')} className="self-start flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
          {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span className="text-sm font-bold">{t('back')}</span>
        </button>

        <div className="flex flex-col items-center justify-center mt-2 mb-8">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Radio className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{t('broadcastSetup')}</p>
        </div>

        <div className="w-full max-w-md mx-auto flex flex-col gap-5 relative">
          {error && (
            <div className="absolute -top-12 left-0 right-0 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {/* Field Dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-400">{t('streamField')}</label>
            <select 
              value={field}
              onChange={(e) => setField(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              dir={dir}
            >
              <option value="education">{t('education')}</option>
              <option value="tech">{t('tech')}</option>
              <option value="gaming">{t('gaming')}</option>
              <option value="social">{t('social')}</option>
            </select>
          </div>

          {/* Topic Input */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-400">{t('streamTopic')}</label>
            <input 
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('streamTopic')}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              dir={dir}
            />
          </div>

          {/* Target Audience Indicator */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-400">Target Audience</label>
            <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-white flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-400" />
              <span>{selectedContactIds.length > 0 ? `Private to ${selectedContactIds.length} Selected contacts` : 'Public Stream'}</span>
            </div>
          </div>

          {/* Go Live Button */}
          <button 
            onClick={handleGoLive}
            disabled={!topic || loading}
            className="group relative w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-1 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 mt-4 disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="flex items-center justify-center gap-3 bg-slate-900/20 backdrop-blur-sm w-full h-full py-4 px-6 rounded-xl border border-white/10">
              {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Radio className="w-6 h-6 text-white animate-pulse" />}
              <span className="font-bold text-white text-lg tracking-wide">{t('goLive')}</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Live Stream Room (Triple-Screen Layout)
  const currentBroadcast = isHost ? { host_name: user?.fullName || 'You', topic: topic, viewers: '0' } : liveStreams[currentBroadcastIndex] || mockBroadcasts[0];

  const variants = {
    enter: (direction: number) => ({
      y: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      zIndex: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
      zIndex: 1,
    },
    exit: (direction: number) => ({
      y: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      zIndex: 0,
    })
  };

  return (
    <div 
      className="flex-1 relative bg-black overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onWheel={handleWheel}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentBroadcastIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            y: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          className="absolute inset-0 flex flex-col bg-black"
        >
          {/* Top Bar Overlays */}
          <div className="absolute top-0 inset-x-0 p-4 pt-safe sm:pt-8 flex justify-between items-start z-20 pointer-events-none">
            <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-wrap">
              <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.6)]">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                {t('live')}
              </div>
              <div className="bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/10">
                <Users className="w-3 h-3 inline me-1" /> {currentBroadcast.viewers}
              </div>
              <div className="bg-black/50 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full border border-white/10">
                {currentBroadcast.host_name || currentBroadcast.host}
              </div>
            </div>
          </div>

          {/* Triple Screen Carousel */}
          <div className="relative flex-1 overflow-hidden">
            <div 
              className="absolute inset-0 flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(${dir === 'rtl' ? currentSlot * 100 : -currentSlot * 100}%)` }}
            >
              {/* Screen 1: Main Stream */}
              <div className="w-full h-full flex-shrink-0 bg-slate-900 flex flex-col items-center justify-center relative">
                <Video className="w-24 h-24 text-slate-700 mb-4" />
                <p className="text-slate-500 font-bold">{t('mainStream')}</p>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
              </div>

              {/* Screen 2: Collaboration */}
              <div className="w-full h-full flex-shrink-0 bg-slate-800 flex flex-col items-center justify-center relative">
                <div className="grid grid-cols-2 gap-4 p-8 w-full max-w-lg">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-video bg-slate-700 rounded-xl flex items-center justify-center border border-slate-600 shadow-lg">
                      <User className="w-10 h-10 text-slate-500" />
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 font-bold mt-4">{t('collaboration')}</p>
              </div>

              {/* Screen 3: Media/Tools */}
              <div className="w-full h-full flex-shrink-0 bg-slate-900 flex flex-col items-center justify-center relative">
                <MonitorPlay className="w-24 h-24 text-slate-700 mb-4" />
                <p className="text-slate-500 font-bold">{t('mediaTools')}</p>
              </div>
            </div>

            {/* Navigation Arrows */}
            {isHost && (
              <>
                <div className="absolute inset-y-0 left-0 flex items-center px-2 z-10 pointer-events-none">
                  {((dir === 'ltr' && currentSlot > 0) || (dir === 'rtl' && currentSlot < 2)) && (
                    <button 
                      onClick={dir === 'ltr' ? prevSlot : nextSlot}
                      className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all pointer-events-auto border border-white/10"
                    >
                      <ChevronLeft className="w-8 h-8" />
                    </button>
                  )}
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 z-10 pointer-events-none">
                  {((dir === 'ltr' && currentSlot < 2) || (dir === 'rtl' && currentSlot > 0)) && (
                    <button 
                      onClick={dir === 'ltr' ? nextSlot : prevSlot}
                      className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-all pointer-events-auto border border-white/10"
                    >
                      <ChevronRight className="w-8 h-8" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom Overlays: Comments & Gifts */}
          <div className="absolute bottom-0 inset-x-0 p-4 pb-safe sm:pb-8 flex justify-between items-end z-20 pointer-events-none gap-4">
            
            {/* Comments Section */}
            <div className="flex-1 max-w-sm flex flex-col gap-2 pointer-events-auto">
              <div 
                className="h-48 overflow-y-auto flex flex-col justify-end gap-2 mask-image-to-top pb-2"
                onWheel={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0f172a]/80 backdrop-blur-sm rounded-xl p-2 px-3 border border-slate-700/50 text-sm max-w-full">
                    <span className="font-bold text-blue-400 me-2">{c.user}:</span>
                    <span className="text-white break-words">{c.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 bg-[#0f172a]/80 backdrop-blur-md rounded-full p-1 border border-slate-700/50 w-full transition-all focus-within:border-blue-500/50 focus-within:shadow-lg focus-within:shadow-blue-500/20">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                  placeholder={t('typeComment')}
                  className="flex-1 w-full bg-transparent text-white px-4 text-sm focus:outline-none placeholder-slate-400"
                  dir={dir}
                />
                <button onClick={handleSendComment} className="p-2.5 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors flex-shrink-0">
                  <Send className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Gift Box Feature (FAB) */}
            <div className="pointer-events-auto flex-shrink-0 relative z-30">
              <button 
                onClick={() => setShowGifts(true)} 
                className="w-14 h-14 bg-[#ff1d53] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,29,83,0.5)] hover:scale-105 transition-transform animate-bounce border-[3px] border-black/20"
              >
                <Gift className="w-7 h-7 text-white" fill="none" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          
          {/* Centered Gift Popup Modal */}
          <AnimatePresence>
            {showGifts && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-auto"
                onClick={() => setShowGifts(false)}
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-[#1e293b] border border-slate-700/80 p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col gap-6 w-full max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-white font-bold text-center leading-relaxed text-lg sm:text-xl">
                    {dir === 'rtl' ? 'ادعم صانع المحتوى لمزيد من الإبداع!' : 'Support the creator for more creativity!'}
                  </p>
                  
                  <div className="flex items-center justify-between bg-slate-900/50 rounded-2xl p-3 border border-slate-700/50">
                    <button onClick={() => setDonationAmount(Math.max(1, donationAmount - 1))} className="w-12 h-12 bg-slate-700/80 hover:bg-slate-600 rounded-xl text-white font-bold transition-colors text-2xl flex items-center justify-center">-</button>
                    <span className="text-white font-bold text-3xl px-4">${donationAmount}</span>
                    <button onClick={() => setDonationAmount(donationAmount + 1)} className="w-12 h-12 bg-slate-700/80 hover:bg-slate-600 rounded-xl text-white font-bold transition-colors text-2xl flex items-center justify-center">+</button>
                  </div>
                  
                  <button onClick={handleSendGift} className="w-full bg-[#ff1d53] text-white font-bold py-4 rounded-2xl hover:opacity-90 active:scale-95 transition-all text-lg shadow-[0_4px_15px_rgba(255,29,83,0.4)]">
                    {dir === 'rtl' ? 'إرسال الدعم' : 'Send Support'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
      
      {/* Custom CSS for fading out top of comments */}
      <style>{`
        .mask-image-to-top {
          mask-image: linear-gradient(to top, black 70%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, black 70%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
