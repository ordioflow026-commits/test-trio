import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ZegoProvider } from './contexts/ZegoContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import CallScreen from './screens/CallScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function SessionChecker({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;
    const presenceChannel = supabase.channel('app_presence', { config: { presence: { key: user.id } } });

    presenceChannel.on('presence', { event: 'sync' }, () => {
       const state = presenceChannel.presenceState();
       window.dispatchEvent(new CustomEvent('app_presence_sync', { detail: Object.keys(state) }));
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isSubscribed) {
        try { await presenceChannel.track({ id: user.id }); } catch(e){}
      }
    });

    return () => { isSubscribed = false; supabase.removeChannel(presenceChannel); };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    
    // Emergency Timeout to prevent infinite blue screen
    const emergencyTimeout = setTimeout(() => {
      if (isMounted) setIsChecking(false);
    }, 3000);

    const loadUser = async (session: any) => {
      if (!session?.user) {
        if (isMounted) { setUser(null); setIsChecking(false); }
        return;
      }
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (isMounted) {
          if (profile) {
            setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
            if (window.location.pathname === '/') navigate('/main', { replace: true });
          } else {
            setUser(null);
          }
          setIsChecking(false);
        }
      } catch (err) {
        if (isMounted) setIsChecking(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { if (isMounted) setIsChecking(false); }
      else loadUser(session);
    }).catch(() => { if (isMounted) setIsChecking(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') loadUser(session);
      else if (event === 'SIGNED_OUT') {
        if (isMounted) { setUser(null); setIsChecking(false); navigate('/', { replace: true }); }
      }
    });

    return () => { isMounted = false; clearTimeout(emergencyTimeout); subscription.unsubscribe(); };
  }, [navigate, setUser]);

  if (isChecking) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><Loader2 className="w-12 h-12 text-[#00b4d8] animate-spin" /></div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <BrowserRouter>
          <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
            <SelectionProvider>
              <SessionChecker>
                <ZegoProvider>
                  <Routes>
                    <Route path="/" element={<LoginScreen />} />
                    <Route path="/main" element={<MainScreen />} />
                    <Route path="/call" element={<CallScreen />} />
                    <Route path="/chat" element={<ChatDetailScreen />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </ZegoProvider>
              </SessionChecker>
            </SelectionProvider>
          </div>
        </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
