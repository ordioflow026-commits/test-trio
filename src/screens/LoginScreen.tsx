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

  useEffect(() => {
    if (error) {
      setShowSnackbar(true);
      const timer = setTimeout(() => setShowSnackbar(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
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
      // 1. The Trigger
      alert('Starting registration...');
      console.log('Step 1 [TRIGGER]: Starting registration...', { fullName, phone });

      const parsedPhone = parsePhoneNumber(phone);
      const countryCode = parsedPhone?.country || 'Unknown';
      
      // 2. Auth Action
      const numericPhone = phone.replace(/\D/g, '');
      const email = `${numericPhone}@test.com`;
      const password = 'password123456';

      console.log('Step 2 [AUTH]: Proceeding with email ->', email);

      // Attempt signup directly based on prompt rules
      let { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      // Handle fallback silently if user already exists so we can still test the flow
      if (authError && authError.message.includes('already registered')) {
        console.log('Step 2B [AUTH FALLBACK]: User already registered, signing in...');
        const signInRes = await supabase.auth.signInWithPassword({ email, password });
        authData = signInRes.data;
        authError = signInRes.error;
      }

      if (authError) {
        console.error('Step 2 [AUTH ERROR]:', authError.message);
        alert('Signup Error: ' + authError.message);
        setLoading(false);
        return;
      }

      console.log('Step 2 [AUTH SUCCESS]: Authenticated successfully.', authData.user);

      // Securely fetch active user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user?.id) {
        console.error('Step 2.5 [GET USER ERROR]:', userError);
        alert('Auth Error: Failed to fetch secure user session. ' + (userError?.message || 'Empty ID'));
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      // 3. Database Action (The Profile)
      console.log('Step 3 [DATABASE]: Initiating profile insert for User ID ->', userId);

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ 
          id: userId, 
          name: fullName, 
          phone: phone, 
          country_code: countryCode 
        }]);

      // Note: If you have already inserted them once, .insert() will fail with duplicate key.
      // We will catch that specific error and run an update just to ensure testing isn't permanently blocked,
      // but otherwise throw the error to the alert exactly as requested.
      if (profileError) {
        if (profileError.code === '23505') { // postgres unique_violation
            console.log('Step 3B [DB OVERRIDE]: Profile existed, running update instead of insert.');
            const { error: updateError } = await supabase
               .from('profiles')
               .update({ name: fullName, phone: phone, country_code: countryCode })
               .eq('id', userId);
            
            if (updateError) {
              console.error('Step 3 [UPDATE ERROR]:', updateError);
              alert('Profile Save Error: ' + updateError.message);
              setLoading(false);
              return;
            }
        } else {
            console.error('Step 3 [INSERT ERROR]:', profileError);
            alert('Profile Save Error: ' + profileError.message);
            setLoading(false);
            return;
        }
      }

      // 4. Verification
      console.log('Step 4 [SUCCESS]: All steps completed. Profile inserted/saved. Navigating...');
      alert('SUCCESS! You are registered.');

      // Save session globally
      setUser({ id: userId, fullName, phone });
      
      // Navigate on success
      navigate('/main');
    } catch (err: any) {
      console.error('Unexpected Supabase Error:', err);
      alert('Unexpected Error: ' + err.message);
      setError(err.message || 'An error occurred during login. Please check your connection.');
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
          <img src="/trio_sync_logo.svg" alt="TrioSync Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-blue-500/20" />
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

          <form onSubmit={handleLogin} className="space-y-6">
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
