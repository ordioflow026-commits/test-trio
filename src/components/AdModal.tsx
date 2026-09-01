import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PlayCircle, Loader2 } from 'lucide-react';

interface AdModalProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function AdModal({ onComplete, onCancel }: AdModalProps) {
  const [adState, setAdState] = useState<'loading' | 'playing' | 'rewarded'>('loading');
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (adState === 'loading') {
      const t = setTimeout(() => setAdState('playing'), 1500);
      return () => clearTimeout(t);
    }

    if (adState === 'playing') {
      if (timeLeft > 0) {
        const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearTimeout(t);
      } else {
        setAdState('rewarded');
        const t = setTimeout(() => onComplete(), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [adState, timeLeft, onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
    >
      {adState === 'loading' && (
        <div className="flex flex-col items-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Connecting to Ad Network (Online Required)...</p>
        </div>
      )}

      {adState === 'playing' && (
        <div className="w-full h-full relative bg-zinc-900 flex items-center justify-center">
          <div className="absolute top-12 right-6 flex items-center space-x-4 z-10">
            <div className="bg-black/50 backdrop-blur px-3 py-1 rounded-full text-white text-sm font-medium">
              Reward in {timeLeft}s
            </div>
            <button onClick={onCancel} className="w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex flex-col items-center text-zinc-600">
            <PlayCircle className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-display font-bold opacity-50">SPONSORED VIDEO AD</h2>
            <p className="text-sm mt-2 opacity-50">Simulated Ad Playback</p>
          </div>
          
          {/* Fake progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 5, ease: 'linear' }}
              className="h-full bg-white"
            />
          </div>
        </div>
      )}

      {adState === 'rewarded' && (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-4 rounded-2xl flex items-center flex-col shadow-[0_0_30px_rgba(16,185,129,0.2)]"
        >
          <div className="text-2xl mb-2 font-bold">+60 Seconds</div>
          <p className="text-sm">Time Wallet Recharged!</p>
        </motion.div>
      )}
    </motion.div>
  );
}
