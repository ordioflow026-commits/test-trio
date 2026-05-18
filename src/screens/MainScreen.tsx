import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Bell, User, Users, Lock, Radio, Globe, MessageSquare, Plus, LogIn, X, Phone, Video, PhoneOff, Edit3, Camera, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import ContactsScreen from './ContactsScreen';
import PrivateRoomScreen from './PrivateRoomScreen';
import BroadcastScreen from './BroadcastScreen';
import { useSelection } from '../contexts/SelectionContext';

function CallOverlay({ activeCall, onClose }: { activeCall: { isVideo: boolean; title: string; count: number }; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const initMedia = async () => {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: activeCall.isVideo, audio: true });
        activeStream = ms;
        setStream(ms);
        if (videoRef.current && activeCall.isVideo) { videoRef.current.srcObject = ms; }
      } catch (err) { console.error("Failed to access media devices:", err); }
    };
    initMedia();
    return () => { if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); } };
  }, [activeCall.isVideo]);

  return (
    <div className="absolute inset-0 bg-[#0B1120]/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-between pb-16 pt-24 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        {activeCall.isVideo && (
          <div className="absolute inset-0 z-0 bg-slate-900">
             <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-transparent to-[#0B1120]/60 pointer-events-none" />
          </div>
        )}
       <div className="flex flex-col items-center gap-6 mt-10 z-10 relative">
          {!activeCall.isVideo && (
            <div className="relative">
              <div className="absolute inset-0 bg-[#00b4d8] rounded-full blur-xl opacity-20 animate-pulse" />
              <div className="w-28 h-28 rounded-full bg-slate-800 flex items-center justify-center border-2 border-[#00b4d8] shadow-[0_0_30px_rgba(0,180,216,0.5)] z-10 relative"><Phone className="w-12 h-12 text-[#00b4d8]" fill="currentColor" /></div>
            </div>
          )}
          <div className="text-center drop-shadow-md">
             <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Calling...</h2>
             <p className="text-lg text-slate-300 font-medium bg-black/40 px-4 py-1 rounded-full backdrop-blur-md">{activeCall.title} ({activeCall.count} {activeCall.count === 1 ? 'Person' : 'People'})</p>
          </div>
       </div>
       <button onClick={onClose} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.5)] active:scale-95 z-10 relative">
         <PhoneOff className="w-8 h-8 text-white" fill="currentColor" />
       </button>
    </div>
  );
}

export default function MainScreen() {
  const navigate = useNavigate();
  const [activeMainTab, setActiveMainTab] = useState('home');
  const [activeSubTab, setActiveSubTab] = useState('contacts');
  const { t, dir, language, toggleLanguage } = useLanguage();
  const { isSelectionMode, selectedContactIds, clearSelection } = useSelection();
  const { user, setUser } = useUser();
  const [userData, setUserData] = useState({ fullName: 'Guest', phone: '' });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<{ isVideo: boolean; title: string; count: number } | null>(null);

  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null); // 💡 New State for actual file
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`signal_${user.id}`).on('broadcast', { event: 'incoming_call' }, (payload) => {
         const { fromName, isVideo } = payload.payload;
         setActiveCall({ isVideo, title: `${fromName} is calling...`, count: 1 });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserData({ fullName: parsed.fullName || 'Guest', phone: parsed.phone || '' });
        setAvatarUrl(parsed.avatar || null);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const savedNotifs = localStorage.getItem('trio_notifications');
    let currentNotifs = savedNotifs ? JSON.parse(savedNotifs) : [];
    const welcomeAdded = localStorage.getItem('trio_welcome_added');
    if (!welcomeAdded) {
      const welcomeMessage = { id: 'welcome_' + Date.now(), text: 'مرحباً بك في التطبيق! يسعدنا انضمامك إلينا، يمكنك الآن البدء بإنشاء غرفتك الخاصة أو الانضمام لغرف الآخرين.', read: false, date: new Date().toISOString() };
      currentNotifs = [welcomeMessage, ...currentNotifs];
      localStorage.setItem('trio_welcome_added', 'true');
      localStorage.setItem('trio_notifications', JSON.stringify(currentNotifs));
    }
    setNotifications(currentNotifs);
  }, []);

  const openNotificationsTab = () => {
     setActiveMainTab('notifications');
     const updated = notifications.map(n => ({ ...n, read: true }));
     setNotifications(updated);
     localStorage.setItem('trio_notifications', JSON.stringify(updated));
  };

  // 💡 Robust Profile Handlers with Supabase Storage
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file); // Save file to state
      setAvatarUrl(URL.createObjectURL(file)); // Show instant local preview
    }
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      let finalAvatarUrl = avatarUrl;

      // 1. Upload Avatar to Supabase Storage if a new file was selected
      if (avatarFile && user?.id) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments') // Using existing bucket
          .upload(`${user.id}/${fileName}`, avatarFile);
          
        if (!uploadError) {
          const { data } = supabase.storage.from('chat-attachments').getPublicUrl(`${user.id}/${fileName}`);
          finalAvatarUrl = data.publicUrl;
        }
      }

      // 2. Update Supabase Database (Profiles Table)
      if (user?.id) {
        await supabase.from('profiles').update({ 
          name: editName,
          avatar_url: finalAvatarUrl // Optional: if column exists
        }).eq('id', user.id);
      }

      // 3. Update Local Storage & State with the short URL
      setUserData(prev => ({ ...prev, fullName: editName }));
      setAvatarUrl(finalAvatarUrl);
      setAvatarFile(null); // Clear pending file

      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.fullName = editName;
        parsed.avatar = finalAvatarUrl; // Save short URL instead of huge base64
        localStorage.setItem('user', JSON.stringify(parsed));
        if (setUser) setUser(parsed); // Sync context
      }
      
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col font-sans" dir={dir}>
      <header className="bg-[#0F172A]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between h-20 px-4 w-full">
          <div className="w-24 sm:w-32 flex items-center gap-2">
            <svg viewBox="0 0 100 100" className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="trioGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="100%" stopColor="#2563EB" />
                </linearGradient>
                <path id="trio-loop" d="M 42 44 L 42 16 A 8 8 0 0 1 58 16 L 58 53.24 Z" />
                <clipPath id="trio-clip"><rect x="50" y="0" width="50" height="100" /></clipPath>
              </defs>
              <circle cx="50" cy="50" r="42" stroke="url(#trioGradient)" strokeWidth="3.5" fill="none" />
              <g fill="none" strokeLinejoin="round">
                <use href="#trio-loop" stroke="#0F172A" strokeWidth="9" />
                <use href="#trio-loop" stroke="url(#trioGradient)" strokeWidth="4.5" />
                <use href="#trio-loop" transform="rotate(120 50 50)" stroke="#0F172A" strokeWidth="9" />
                <use href="#trio-loop" transform="rotate(120 50 50)" stroke="url(#trioGradient)" strokeWidth="4.5" />
                <use href="#trio-loop" transform="rotate(240 50 50)" stroke="#0F172A" strokeWidth="9" />
                <use href="#trio-loop" transform="rotate(240 50 50)" stroke="url(#trioGradient)" strokeWidth="4.5" />
                <use href="#trio-loop" clipPath="url(#trio-clip)" stroke="#0F172A" strokeWidth="9" />
                <use href="#trio-loop" clipPath="url(#trio-clip)" stroke="url(#trioGradient)" strokeWidth="4.5" />
              </g>
            </svg>
            <span className="text-sm font-bold text-white tracking-wide hidden sm:block">TrioSync</span>
          </div>

          <div className="flex items-center justify-center bg-slate-800/80 rounded-full p-1.5 border border-blue-900/50 shadow-inner gap-1 sm:gap-2">
            <button onClick={() => setActiveMainTab('home')} className={`p-3 rounded-full transition-all duration-300 border ${activeMainTab === 'home' ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]' : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'}`}>
              <Home className="w-6 h-6" />
            </button>
            <button onClick={openNotificationsTab} className={`relative p-3 rounded-full transition-all duration-300 border ${activeMainTab === 'notifications' ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]' : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'}`}>
              <Bell className="w-6 h-6" />
              {notifications.some(n => !n.read) && <span className={`absolute top-2.5 ${dir === 'rtl' ? 'left-2.5' : 'right-2.5'} w-2.5 h-2.5 bg-red-500 border-2 border-[#0F172A] rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]`}></span>}
            </button>
            <button onClick={() => setActiveMainTab('profile')} className={`p-3 rounded-full transition-all duration-300 border ${activeMainTab === 'profile' ? 'bg-blue-700 border-blue-500 text-white shadow-[0_0_15px_rgba(29,78,216,0.5)]' : 'border-blue-500/50 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20'}`}>
              <User className="w-6 h-6" />
            </button>
          </div>

          <div className="w-24 sm:w-32 flex justify-end">
            <button onClick={toggleLanguage} className="flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors bg-slate-800/50 py-1.5 px-3 sm:p-2 rounded-2xl border border-blue-900/50 hover:border-blue-600">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
              <span className="text-[9px] sm:text-[10px] font-bold tracking-wider">{language === 'en' ? 'AR' : 'EN'}</span>
            </button>
          </div>
        </div>

        {activeMainTab === 'home' && (
          <div className="flex justify-around items-center p-4 bg-[#0F172A]/50 border-t border-blue-900/30 gap-3">
            {[{ id: 'contacts', label: t('contacts'), icon: Users }, { id: 'privateRoom', label: t('privateRoom'), icon: Lock }, { id: 'broadcast', label: t('broadcast'), icon: Radio }].map((tab) => {
              const Icon = tab.icon; const isActive = activeSubTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { setActiveSubTab(tab.id); if (tab.id === 'contacts') { window.dispatchEvent(new CustomEvent('fetch-contacts')); } }} className={`flex-1 flex flex-col items-center justify-center py-3 px-1 rounded-2xl transition-all duration-300 border ${isActive ? 'bg-blue-700 text-white shadow-[0_8px_16px_rgba(29,78,216,0.4)] scale-105 border-blue-500' : 'bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-blue-400 border-blue-500/50'}`}>
                  <Icon className={`w-5 h-5 mb-1.5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
                  <span className={`text-[11px] font-bold tracking-wide ${isActive ? 'text-white' : ''}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {isSelectionMode && (
        <div className="bg-[#00b4d8] text-white px-4 py-3 flex items-center justify-between z-20 shadow-md">
          <div className="flex items-center gap-3"><button onClick={clearSelection}><X className="w-6 h-6" /></button><span className="font-semibold text-lg">{selectedContactIds.length} {t('selected') || 'Selected'}</span></div>
        </div>
      )}

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeMainTab === 'home' && (
          <>{activeSubTab === 'contacts' && <ContactsScreen />} {activeSubTab === 'privateRoom' && <PrivateRoomScreen />} {activeSubTab === 'broadcast' && <BroadcastScreen />}</>
        )}

        {activeMainTab === 'notifications' && (
          <div className="flex-1 flex flex-col p-6 bg-gradient-to-b from-transparent to-slate-900/50 overflow-y-auto animate-in fade-in duration-300">
            <div className="flex flex-col items-center mb-8 mt-4">
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-700/50 shadow-lg"><Bell className="w-10 h-10 text-cyan-400" /></div>
              <h2 className="text-2xl font-bold text-white tracking-wide">{t('notifications') || 'Notifications'}</h2>
            </div>
            <div className="w-full max-w-2xl mx-auto space-y-3 pb-20">
              {notifications.length === 0 ? (
                <div className="text-center p-8 bg-slate-800/30 rounded-3xl border border-slate-700/50"><p className="text-slate-400">{t('allCaughtUp') || "You're all caught up!"}</p></div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex gap-4 items-start shadow-md hover:bg-slate-800 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 border border-cyan-500/30"><Bell className="w-5 h-5 text-cyan-400" /></div>
                    <div className="flex-1">
                       <p className="text-slate-200 text-[15px] leading-relaxed font-medium">{n.text}</p>
                       <span className="text-xs text-slate-500 mt-2 block" dir="ltr">{new Date(n.date).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeMainTab === 'profile' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-transparent to-slate-900/50 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-slate-800/40 p-8 rounded-[32px] border border-slate-700/50 shadow-2xl flex flex-col items-center relative backdrop-blur-sm">
              
              {!isEditingProfile ? (
                 <button onClick={() => { setEditName(userData.fullName); setIsEditingProfile(true); }} className={`absolute top-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-full transition-colors`} title={isAr ? "تعديل" : "Edit"}>
                   <Edit3 className="w-5 h-5" />
                 </button>
              ) : (
                 <button onClick={() => { setIsEditingProfile(false); setAvatarFile(null); setAvatarUrl(JSON.parse(localStorage.getItem('user') || '{}').avatar || null); }} className={`absolute top-6 ${dir === 'rtl' ? 'left-6' : 'right-6'} p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition-colors`} title={isAr ? "إلغاء" : "Cancel"}>
                   <X className="w-5 h-5" />
                 </button>
              )}

              <div className="relative mb-6 group">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                  <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center border-4 border-slate-900 overflow-hidden relative">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-slate-300" />
                    )}
                    
                    {isEditingProfile && (
                      <div onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-8 h-8 text-white mb-1" />
                        <span className="text-[10px] text-white font-bold">{isAr ? 'تغيير الصورة' : 'Change'}</span>
                      </div>
                    )}
                  </div>
                </div>
                {!isEditingProfile && <div className={`absolute bottom-1 ${dir === 'rtl' ? 'left-1' : 'right-1'} w-6 h-6 bg-green-500 border-4 border-slate-900 rounded-full`}></div>}
              </div>

              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarChange} />

              {!isEditingProfile ? (
                <>
                  <h2 className="text-3xl font-bold text-white tracking-tight mb-2 text-center">{userData.fullName}</h2>
                  <p className="text-lg text-blue-400 font-medium tracking-wider" dir="ltr">{userData.phone}</p>
                </>
              ) : (
                <div className="w-full space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 px-1">{isAr ? 'الاسم الكامل' : 'Full Name'}</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 px-1">{isAr ? 'رقم الهاتف (غير قابل للتعديل)' : 'Phone Number (Read-only)'}</label>
                    <input type="text" value={userData.phone} disabled className="w-full bg-slate-900/30 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-500 outline-none cursor-not-allowed" dir="ltr" />
                  </div>
                  <button onClick={handleSaveProfile} disabled={isSavingProfile || !editName.trim()} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-6 transition-all active:scale-95 shadow-lg hover:shadow-blue-500/25 disabled:opacity-50">
                    {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> {isAr ? 'حفظ التغييرات' : 'Save Changes'}</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {activeCall && <CallOverlay activeCall={activeCall} onClose={() => setActiveCall(null)} />}
    </div>
  );
}
