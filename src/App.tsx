import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import DummyCallScreen from './screens/DummyCallScreen';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function SessionChecker({ children }: { children: React.ReactNode }) {
  const { setUser } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session) {
          if (isMounted) setIsChecking(false);
          return;
        }

        // Fetch profile using maybeSingle() to prevent throwing on missing data
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionData.session.user.id)
          .maybeSingle();

        if (isMounted) {
          if (profile) {
            setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
            setIsChecking(false);
            if (window.location.pathname === '/') {
              navigate('/main', { replace: true });
            }
          } else {
             // Session exists but profile missing. Force Logout -> Go to Login
             await supabase.auth.signOut();
             setUser(null);
             setIsChecking(false);
             navigate('/', { replace: true });
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    verifySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && isMounted) {
        setUser(null);
        navigate('/', { replace: true });
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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SessionChecker>
          </div>
        </BrowserRouter>
      </UserProvider>
    </LanguageProvider>
  );
}
