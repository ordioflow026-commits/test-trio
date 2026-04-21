import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import DummyCallScreen from './screens/DummyCallScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function SessionChecker({ children }: { children: React.ReactNode }) {
  const { setUser } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadUser = async (session: any) => {
      if (!session?.user) {
        if (isMounted) {
          setUser(null);
          setIsChecking(false);
        }
        return;
      }
      
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (isMounted) {
          if (profile) {
            setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
            if (window.location.pathname === '/') {
              navigate('/main', { replace: true });
            }
          } else {
             // User exists in auth but no profile - maybe mid-signup, keep logged out until signup finish
             setUser(null);
          }
          setIsChecking(false);
        }
      } catch (err) {
        if (isMounted) setIsChecking(false);
      }
    };

    // 1. Initial Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (isMounted) setIsChecking(false);
      } else {
        loadUser(session);
      }
    });

    // 2. Listen for auth changes to persist session automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUser(session);
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null);
          setIsChecking(false);
          navigate('/', { replace: true });
        }
      }
    });

    return () => { 
      isMounted = false; 
      subscription.unsubscribe();
    };
  }, [navigate, setUser]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <LanguageProvider>
      <UserProvider>
        <BrowserRouter>
          <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
            <SessionChecker>
              <Routes>
                <Route path="/" element={<LoginScreen />} />
                <Route path="/main" element={<MainScreen />} />
                <Route path="/call" element={<DummyCallScreen />} />
                <Route path="/chat" element={<ChatDetailScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SessionChecker>
          </div>
        </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
