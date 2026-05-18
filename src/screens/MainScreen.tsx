import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Bell, User, Users, Lock, Radio, Globe, X, Phone, PhoneOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabase';
import ContactsScreen from './ContactsScreen';
import PrivateRoomScreen from './PrivateRoomScreen';
import BroadcastScreen from './BroadcastScreen';
import { useSelection } from '../contexts/SelectionContext';

function CallOverlay({ activeCall, onClose }: { activeCall: { isVideo: boolean; title: string; count: number }; onClose: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  
  React.useEffect(() => {
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
  const { user } = useUser();
  const [userData, setUserData] = useState({ fullName: 'Guest', phone: '' });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeCall, setActiveCall] = useState<{ isVideo: boolean; title: string; count: number } | null>(null);

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
      } catch (e) {}
    }
  }, []);

  // Smart Welcome Logic
  useEffect(() => {
    const savedNotifs = localStorage.getItem('trio_notifications');
    let currentNotifs = savedNotifs ? JSON.parse(savedNotifs) : [];
    const welcomeAdded = localStorage.getItem('trio_welcome_added');
    
    if (!welcomeAdded) {
      const welcomeMessage = {
        id: 'welcome_' + Date.now(),
        text: 'مرحباً بك في التطبيق! يسعدنا انضمامك إلينا، يمكنك الآن البدء بإنشاء غرفتك الخاصة أو الانضمام لغرف الآخرين.',
        read: false,
        date: new Date().toISOString()
      };
      currentNotifs = [welcomeMessage, ...currentNotifs];
      localStorage.setItem('trio_welcome_added', 'true');
      localStorage.setItem('trio_notifications', JSON.stringify(currentNotifs));
    }
    setNotifications(currentNotifs);
  }, []);

  // Open Notifications Full Screen & Mark Read
  const openNotificationsTab = () => {
     setActiveMainTab('notifications');
     const updated = notifications.map(n => ({ ...n, read: true }));
     setNotifications(updated);
     localStorage.setItem('trio_notifications', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col font-sans" dir={dir}>
      <header className="bg-[#0F172A]/90 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-20 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between h-20 px-4 w-full">
          <div className="w-24 sm:w-32 flex items-center gap-2">
            <img src="/trio_sync_logo.svg" alt="TrioSync Logo" className="w-8 h-8 rounded-lg shadow-md shadow-blue-500/20" />
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

        {/* Dedicated Notifications Screen */}
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
                       <p className="text-slate-200 text-[15px] leading-relaxed font-medium text-start">{n.text}</p>
                       <span className="text-xs text-slate-500 mt-2 block text-start" dir="ltr">{new Date(n.date).toLocaleDateString(dir === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeMainTab === 'profile' && (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 bg-gradient-to-b from-transparent to-slate-900/50">
            <div className="relative mb-6">
              <div className="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full p-1 shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center border-4 border-slate-900"><User className="w-12 h-12 text-slate-300" /></div>
              </div>
              <div className={`absolute bottom-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-8 h-8 bg-green-500 border-4 border-slate-900 rounded-full`}></div>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">{userData.fullName}</p>
            <p className="text-md mt-2 text-blue-400 font-medium" dir="ltr">{userData.phone}</p>
          </div>
        )}
      </main>

      {activeCall && <CallOverlay activeCall={activeCall} onClose={() => setActiveCall(null)} />}
    </div>
  );
}
