import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { Globe, Loader2, User, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useUser } from '../contexts/UserContext';

export default function LoginScreen() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const navigate = useNavigate();
  const { t, toggleLanguage, language, dir } = useLanguage();
  const { setUser } = useUser();

  // Initial Check: in LoginScreen, check for an existing session as soon as the app starts.
  useEffect(() => {
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
         const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

         if (profile) {
           setUser({ id: profile.id, fullName: profile.name, phone: profile.phone });
           navigate('/main', { replace: true });
         }
      }
    };
    checkExistingSession();
  }, [navigate, setUser]);

  useEffect(() => {
    if (error) {
      setShowSnackbar(true);
      const timer = setTimeout(() => setShowSnackbar(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError(language === 'en' ? 'Please enter your display name' : 'الرجاء إدخال اسم العرض');
      return;
    }

    if (!phone || !isValidPhoneNumber(phone)) {
      setError(language === 'en' ? 'Please enter a valid phone number' : 'الرجاء إدخال رقم هاتف صحيح');
      return;
    }

    setLoading(true);

    try {
      // 1. Clean Start
      await supabase.auth.signOut(); // This clears the session from storage automatically

      // 2. Smart Auth
      const numericPhone = phone.replace(/\D/g, '');
      const email = `${numericPhone}@test.com`;
      const password = 'password123456';

      let { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError && (authError.message.includes('already registered') || authError.message.includes('already exists'))) {
        const signInRes = await supabase.auth.signInWithPassword({
          email,
          password
        });
        authData = signInRes.data;
        authError = signInRes.error;
      }

      if (authError) {
        alert('Auth Error: ' + authError.message);
        setLoading(false);
        return;
      }

      const userId = authData?.user?.id;
      if (!userId) {
        alert('Auth Error: Could not get User ID');
        setLoading(false);
        return;
      }

      // 3. Exact Database Upsert
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          name: fullName, 
          phone: phone 
        });

      if (dbError) {
        alert('Profile Error: ' + dbError.message);
        setLoading(false);
        return;
      }

      // 4. Success
      setUser({ id: userId, fullName: fullName, phone: phone });
      navigate('/main', { replace: true });

    } catch (err: any) {
      alert('Unexpected Error: ' + err.message);
      setError(err.message || 'Error during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col relative overflow-y-auto" dir={dir}>
      {/* Red Error Snackbar */}
      <div className={`fixed top-4 left-4 right-4 z-50 transition-all duration-300 transform ${showSnackbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg shadow-red-500/20 flex items-center gap-3 max-w-md mx-auto">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
      {/* Header */}
      <div className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 100 100" className="w-12 h-12 drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="trioGradientLog" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#2563EB" />
              </linearGradient>
              <path id="trio-loop-log" d="M 42 44 L 42 16 A 8 8 0 0 1 58 16 L 58 53.24 Z" />
              <clipPath id="trio-clip-log"><rect x="50" y="0" width="50" height="100" /></clipPath>
            </defs>
            <circle cx="50" cy="50" r="42" stroke="url(#trioGradientLog)" strokeWidth="3.5" fill="none" />
            <g fill="none" strokeLinejoin="round">
              <use href="#trio-loop-log" stroke="#1e293b" strokeWidth="9" />
              <use href="#trio-loop-log" stroke="url(#trioGradientLog)" strokeWidth="4.5" />
              <use href="#trio-loop-log" transform="rotate(120 50 50)" stroke="#1e293b" strokeWidth="9" />
              <use href="#trio-loop-log" transform="rotate(120 50 50)" stroke="url(#trioGradientLog)" strokeWidth="4.5" />
              <use href="#trio-loop-log" transform="rotate(240 50 50)" stroke="#1e293b" strokeWidth="9" />
              <use href="#trio-loop-log" transform="rotate(240 50 50)" stroke="url(#trioGradientLog)" strokeWidth="4.5" />
              <use href="#trio-loop-log" clipPath="url(#trio-clip-log)" stroke="#1e293b" strokeWidth="9" />
              <use href="#trio-loop-log" clipPath="url(#trio-clip-log)" stroke="url(#trioGradientLog)" strokeWidth="4.5" />
            </g>
          </svg>
          <span className="text-xl font-bold text-white tracking-wide">TrioSync</span>
        </div>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-all"
        >
          <Globe className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-sm text-slate-200">{language === 'en' ? 'AR' : 'EN'}</span>
        </button>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-20">
        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700/50 backdrop-blur-sm">
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
              <User className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{t('welcome')}</h1>
            <p className="text-slate-400 text-sm">Secure Communication Platform</p>
          </div>

          <form onSubmit={handleStart} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t('fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('enterName')}
                className="w-full px-5 py-4 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                dir={dir}
              />
            </div>

            <div>
              <div className="phone-input-container" dir="ltr">
                <PhoneInput
                  international
                  addInternationalOption={false}
                  defaultCountry="AF"
                  value={phone}
                  onChange={(val) => setPhone(val || '')}
                  className="w-full px-5 py-4 rounded-xl bg-slate-900/50 border border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Error is now shown in the snackbar, but keeping a subtle hint here if needed, or we can just remove it */}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 mt-8 tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                'Start'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
