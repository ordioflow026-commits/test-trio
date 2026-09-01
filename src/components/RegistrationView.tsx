import React, { useState } from 'react';
import { motion } from 'motion/react';
import { DownloadCloud, CheckCircle2 } from 'lucide-react';
import { LANGUAGES, UserProfile } from '../types';

interface RegistrationViewProps {
  onComplete: (profile: UserProfile) => void;
}

export function RegistrationView({ onComplete }: RegistrationViewProps) {
  const [nickname, setNickname] = useState('');
  const [language, setLanguage] = useState(LANGUAGES[0].code);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleSetup = () => {
    if (!nickname.trim()) return;
    
    setIsDownloading(true);
    
    // Simulate language pack download
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setDownloadProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onComplete({
            id: Math.random().toString(36).substr(2, 9),
            nickname: nickname.trim(),
            language,
          });
        }, 500);
      }
    }, 150);
  };

  if (isDownloading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 p-6 text-center">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shadow-xl"
        >
          {downloadProgress >= 100 ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          ) : (
            <DownloadCloud className="w-10 h-10 text-zinc-400" />
          )}
        </motion.div>
        
        <div className="space-y-3 w-full max-w-xs">
          <h2 className="text-xl font-display font-medium text-white">
            {downloadProgress >= 100 ? 'Ready to go!' : 'Downloading AI Pack'}
          </h2>
          <p className="text-sm text-zinc-400">
            {downloadProgress >= 100 
              ? 'Language pack installed.' 
              : 'Installing on-device neural translation models for offline use.'}
          </p>
          
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mt-4">
            <motion.div 
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 font-mono text-right mt-2">{downloadProgress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 pt-12 pb-8 max-w-md mx-auto">
      <div className="flex-1 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-semibold text-white tracking-tight">Welcome to Localize</h1>
          <p className="text-zinc-400">Set up your offline translation profile.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="How should others call you?"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">Native Language</label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white appearance-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              We will download the offline AI translation pack for this language.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleSetup}
        disabled={!nickname.trim()}
        className="w-full bg-white text-black font-medium rounded-xl py-4 hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
      >
        Set Up Profile
      </button>
    </div>
  );
}
