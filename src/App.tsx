import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import DummyCallScreen from './screens/DummyCallScreen';
import ChatScreen from './screens/ChatScreen';
import { useEffect, useState, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';

function AppRoutes() {
  const { user, setUser } = useUser();
  const [isInitializing, setIsInitializing] = useState(true);
  const presenceChannel = useRef<any>(null);

  useEffect(() => {
    // Check Supabase auth session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          if (!user) {
            const email = session.user.email || '';
            const phoneStr = email.split('@')[0];
            
            if (phoneStr) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone', `+${phoneStr}`)
                .maybeSingle();
                
              if (profile) {
                setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
              } else {
                const { data: profileFallback } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('phone', phoneStr)
                  .maybeSingle();
                  
                if (profileFallback) {
                  setUser({ id: profileFallback.id, fullName: profileFallback.name, phone: profileFallback.phone });
                }
              }
            }
          }
        } else {
          if (user) setUser(null);
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    checkSession();

    // Permissions Request Check immediately on launch
    const requestInitialPermissions = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const checkPerm = await Contacts.checkPermissions();
          if (checkPerm.contacts !== 'granted') {
            await Contacts.requestPermissions();
          }
        } else if (navigator.mediaDevices) {
          // Trigger browser popup early
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (error) {
        console.warn("User dismissed or denied permissions initially", error);
      }
    };
    
    requestInitialPermissions();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && user) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Setup Supabase Presence Tracking when User exists
    if (!user) {
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
        presenceChannel.current = null;
      }
      return;
    }

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const newState = channel.presenceState();
      // Store overall online globally if needed, or other screens can listen
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presenceStatus = await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
        presenceChannel.current = null;
      }
    };
  }, [user]);

  if (isInitializing) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/main" replace /> : <LoginScreen />} />
      <Route path="/main" element={user ? <MainScreen /> : <Navigate to="/" replace />} />
      <Route path="/call" element={user ? <DummyCallScreen /> : <Navigate to="/" replace />} />
      <Route path="/chat" element={user ? <ChatScreen /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <HashRouter>
          <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
            <AppRoutes />
          </div>
        </HashRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
