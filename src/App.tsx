import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ZegoProvider } from './contexts/ZegoContext';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import CallScreen from './screens/CallScreen';
import ChatDetailScreen from './screens/ChatDetailScreen';
import { supabase } from './lib/supabase';
import { Loader2, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function SessionChecker({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useUser();
  const [isChecking, setIsChecking] = useState(true);
  const [toast, setToast] = useState<{show: boolean, msg: string, senderName: string} | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    let isSubscribed = true;
    const presenceChannel = supabase.channel('app_presence', { config: { presence: { key: user.id } } });

    presenceChannel.on('presence', { event: 'sync' }, () => {
       const state = presenceChannel.presenceState();
       let activeIds = Object.keys(state);
       (window as any).currentOnlineUsers = activeIds;
       window.dispatchEvent(new CustomEvent('app_presence_sync', { detail: activeIds }));
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && isSubscribed) {
        try { await presenceChannel.track({ id: user.id }); } catch(e){}
      }
    });

    return () => { isSubscribed = false; supabase.removeChannel(presenceChannel); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const notificationsChannel = supabase.channel('global_notifications');

    notificationsChannel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
        if (payload.new.receiver_id === user.id) {
          if (location.pathname === '/chat') return;
          
          let content = payload.new.content;
          if (content.startsWith('Audio: ')) content = '🎵 Audio notification';
          else if (content.startsWith('File: ')) content = '📎 Attachment';
          else {
            const reactMatch = content.match(/(.*?) \[REACT\|(.*?)\]$/);
            if (reactMatch) {
              content = reactMatch[1] + ' ' + reactMatch[2]; // e.g. "message ❤️" 
            }
          }

          const { data: profile } = await supabase.from('profiles').select('name').eq('id', payload.new.sender_id).maybeSingle();
          const senderName = profile?.name || 'Unknown';
          
          setToast({ show: true, msg: content, senderName });
          setTimeout(() => setToast(null), 4000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    let isMounted = true;
    
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
  return (
    <>
      <AnimatePresence>
        {toast && toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-4 right-4 z-[100] bg-slate-800 border border-slate-700 shadow-xl rounded-2xl p-4 flex items-center gap-3 cursor-pointer"
            onClick={() => { setToast(null); navigate('/main'); }}
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-[15px] truncate">{toast.senderName}</div>
              <div className="text-slate-400 text-[13px] truncate">{toast.msg}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setToast(null); }} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
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
