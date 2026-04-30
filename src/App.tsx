import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { WifiOff, Phone, Video, MoreVertical, Globe } from 'lucide-react';
import { supabase } from './lib/supabase';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';

// Safe Component Imports
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import ChatScreen from './screens/ChatScreen';
import DummyCallScreen from './screens/DummyCallScreen';

function AppNavigator() {
  const { user, setUser } = useUser();
  const { language, setLanguage } = useLanguage();
  
  // No isInitializing blocker! App renders immediately.
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Contacts intentionally left out of this render level or forced to default, we just pass down
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    // Basic online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // SILENT BOOT - Massive Try/Catch prevents EVERYTHING from crashing the app
    const silentBoot = async () => {
      try {
        // Safe Supabase check
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!error && session?.user && !user) {
          const phoneStr = session.user.email?.split('@')[0];
          if (phoneStr) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('phone', `+${phoneStr}`).maybeSingle();
            if (profile) setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
          }
        }

        // Safe Native Capacitor API calls
        if (Capacitor.isNativePlatform()) {
          const perm = await Contacts.checkPermissions();
          if (perm.contacts !== 'granted') await Contacts.requestPermissions();
          const raw = await Contacts.getContacts({ projection: { name: true, phones: true } });
          setContacts(raw.contacts || []);
        }
      } catch (err) {
        // DO NOTHING to the UI, just log securely.
        console.error("SILENT BOOT CAUGHT A FATAL ERROR (Render Proceeds unharmed):", err);
      }
    };

    silentBoot();

    // Safe Subscription binding
    let authListener: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
         if (!newSession && user) setUser(null);
      });
      authListener = data.subscription;
    } catch (e) {
       console.error("Auth Listener Error:", e);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (authListener) authListener.unsubscribe();
    };
  }, []); // Run safely once

  const cycleLanguage = () => {
    if (language === 'EN') setLanguage('FR');
    else if (language === 'FR') setLanguage('DZ');
    else setLanguage('EN');
  };

  // IMMEDIATE UI RENDER (Zero Loading Spinners that can deadlock)
  return (
    <div className="max-w-md mx-auto bg-[#0b141a] text-[#e9edef] font-sans h-screen flex flex-col relative sm:border-x sm:border-[#202c33]">
      {!isOnline && (
        <div className="bg-[#202c33] text-[#8696a0] text-xs py-1.5 flex justify-center items-center gap-2 z-50">
          <WifiOff className="w-3 h-3" />
          <span>Connecting...</span>
        </div>
      )}

      {user && (
        <header className="bg-[#202c33] pt-4 px-4 shadow-sm z-10">
           <div className="flex justify-between items-center mb-4">
             <h1 className="text-[#8696a0] text-xl font-medium tracking-wide">TrioSync</h1>
             <div className="flex items-center gap-5 text-[#8696a0]">
               <button onClick={cycleLanguage} className="flex items-center gap-1 hover:text-[#e9edef] transition-colors">
                  <Globe className="w-4 h-4"/> <span className="text-xs font-bold">{language}</span>
               </button>
               <Video className="w-5 h-5 cursor-pointer hover:text-[#e9edef] transition-colors" />
               <Phone className="w-5 h-5 cursor-pointer hover:text-[#e9edef] transition-colors" />
               <MoreVertical className="w-5 h-5 cursor-pointer hover:text-[#e9edef] transition-colors" />
             </div>
           </div>
           
           <div className="flex font-semibold text-sm uppercase text-[#8696a0]">
             <button className="flex-1 pb-3 border-b-2 border-[#00a884] text-[#00a884]">Chats</button>
             <button className="flex-1 pb-3 border-b-2 border-transparent">Status</button>
             <button className="flex-1 pb-3 border-b-2 border-transparent">Calls</button>
           </div>
        </header>
      )}

      <main className="flex-1 overflow-y-auto w-full relative bg-[#0b141a]">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/main" replace /> : <LoginScreen />} />
          <Route path="/main" element={user ? <MainScreen /> : <Navigate to="/" replace />} />
          <Route path="/call" element={user ? <DummyCallScreen /> : <Navigate to="/" replace />} />
          <Route path="/chat" element={user ? <ChatScreen /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <BrowserRouter>
          <AppNavigator />
        </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
