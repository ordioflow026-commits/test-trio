import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Users, QrCode, X, Clock, Wallet, Radio, Ear, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { UserProfile, LANGUAGES } from '../types';

interface RoomViewProps {
  currentUser: UserProfile;
  isCreator: boolean;
  timeBalance: number;
  onLeave: () => void;
  onRechargeRequired: () => void;
  setTimeBalance: React.Dispatch<React.SetStateAction<number>>;
}

export function RoomView({ currentUser, isCreator, timeBalance, onLeave, onRechargeRequired, setTimeBalance }: RoomViewProps) {
  const [showQR, setShowQR] = useState(isCreator);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteSpeaker, setRemoteSpeaker] = useState<string | null>(null); // name of remote speaker
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPlayingTranslation, setIsPlayingTranslation] = useState(false);
  
  // Fake users for demo
  const [users, setUsers] = useState<UserProfile[]>([
    currentUser,
    ...(isCreator ? [] : [{ id: 'u1', nickname: 'Alex', language: 'es' }])
  ]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Simulate remote users joining
  useEffect(() => {
    if (isCreator && users.length === 1) {
      const joinTimer = setTimeout(() => {
        setUsers(prev => [...prev, { id: 'u1', nickname: 'Alex', language: 'es' }]);
        setShowQR(false); // Auto hide QR when someone joins
      }, 5000);
      return () => clearTimeout(joinTimer);
    }
  }, [isCreator, users.length]);

  // Handle push to talk logic
  const handleMicPress = () => {
    if (timeBalance <= 0) {
      onRechargeRequired();
      return;
    }
    if (remoteSpeaker || isTranslating || isPlayingTranslation) return; // Locked

    setIsSpeaking(true);
    
    // Start decreasing time
    timerRef.current = setInterval(() => {
      setTimeBalance(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsSpeaking(false);
          triggerSendSimulation();
          onRechargeRequired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleMicRelease = () => {
    if (!isSpeaking) return;
    setIsSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    
    triggerSendSimulation();
  };

  const triggerSendSimulation = () => {
    // We released the mic. In a real app, it sends via P2P.
    // For demo, we just show a brief "sending" state.
    // To make it fun, let's simulate the OTHER person speaking shortly after.
    setTimeout(() => {
      simulateRemoteIncoming('Alex');
    }, 3000);
  };

  const simulateRemoteIncoming = (speakerName: string) => {
    setRemoteSpeaker(speakerName);
    
    // Simulate them talking for 3 seconds
    setTimeout(() => {
      setRemoteSpeaker(null);
      setIsTranslating(true);
      
      // Simulate on-device translation for 1.5 seconds
      setTimeout(() => {
        setIsTranslating(false);
        setIsPlayingTranslation(true);
        
        // Simulate playing translated audio for 3 seconds
        setTimeout(() => {
          setIsPlayingTranslation(false);
        }, 3000);
      }, 1500);
    }, 3000);
  };

  const isLocked = remoteSpeaker !== null || isTranslating || isPlayingTranslation;
  
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getLangName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-6 pt-10 pb-4 flex items-center justify-between border-b border-zinc-900 bg-zinc-950 sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
            <Radio className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-white font-display font-medium">Local Room</h2>
            <p className="text-xs text-emerald-500 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              P2P Active
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isCreator && (
            <button 
              onClick={() => setShowQR(true)}
              className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={onLeave}
            className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-48">
        
        {/* Users List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <h3 className="text-sm font-medium uppercase tracking-wider">Connected ({users.length}/5)</h3>
            <Users className="w-4 h-4" />
          </div>
          
          <div className="space-y-2">
            {users.map(u => {
              const isMe = u.id === currentUser.id;
              const isThisUserSpeaking = remoteSpeaker === u.nickname || (isMe && isSpeaking);
              
              return (
                <div key={u.id} className={`p-4 rounded-2xl flex items-center justify-between border transition-all ${
                  isThisUserSpeaking 
                    ? 'bg-zinc-900 border-zinc-700 shadow-sm' 
                    : 'bg-zinc-900/50 border-zinc-800/50'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-medium relative">
                      {u.nickname.charAt(0).toUpperCase()}
                      {isThisUserSpeaking && (
                         <motion.div 
                           animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                           transition={{ repeat: Infinity, duration: 1.5 }}
                           className="absolute inset-0 rounded-full border-2 border-emerald-500"
                         />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium flex items-center">
                        {u.nickname} {isMe && <span className="ml-2 text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-sm">YOU</span>}
                      </p>
                      <p className="text-xs text-zinc-500">{getLangName(u.language)}</p>
                    </div>
                  </div>
                  
                  {isThisUserSpeaking && (
                    <motion.div 
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex space-x-1"
                    >
                      {[1,2,3].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: [8, 16, 8] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                          className="w-1 bg-emerald-500 rounded-full"
                        />
                      ))}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer / Control Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-12 pb-8 px-6">
        
        {/* Status indicator for receiving/translating */}
        <div className="absolute -top-6 left-0 right-0 flex justify-center pointer-events-none">
          <AnimatePresence>
            {isTranslating && (
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                className="bg-indigo-500 text-white text-xs font-medium px-4 py-1.5 rounded-full flex items-center shadow-lg"
              >
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Translating on-device...
              </motion.div>
            )}
            {isPlayingTranslation && (
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                className="bg-emerald-500 text-white text-xs font-medium px-4 py-1.5 rounded-full flex items-center shadow-lg"
              >
                <Ear className="w-3 h-3 mr-2" />
                Playing translation (Auto-delete after)
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center max-w-sm mx-auto bg-zinc-900 rounded-[2.5rem] p-6 border border-zinc-800 shadow-2xl relative overflow-hidden">
          
          <div className="flex justify-between w-full mb-8 items-center px-4 relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Time Wallet</span>
              <div className={`flex items-center space-x-1.5 ${timeBalance === 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono text-lg">{formatTime(timeBalance)}</span>
              </div>
            </div>
            
            <button 
              onClick={onRechargeRequired}
              className="flex items-center space-x-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-xl transition-colors border border-zinc-700"
            >
              <Wallet className="w-3.5 h-3.5 text-yellow-500" />
              <span>Recharge</span>
            </button>
          </div>

          <button
            onMouseDown={handleMicPress}
            onMouseUp={handleMicRelease}
            onMouseLeave={handleMicRelease}
            onTouchStart={handleMicPress}
            onTouchEnd={handleMicRelease}
            className={`
              relative w-32 h-32 rounded-full flex items-center justify-center transition-all z-10
              ${isLocked || timeBalance === 0 
                ? 'bg-zinc-800 border-4 border-zinc-700 opacity-50 cursor-not-allowed' 
                : isSpeaking 
                  ? 'bg-emerald-500 border-4 border-emerald-400 scale-95 shadow-[0_0_30px_rgba(16,185,129,0.5)]' 
                  : 'bg-zinc-800 border-4 border-zinc-700 hover:border-emerald-500/50 cursor-pointer shadow-lg'}
            `}
          >
            {isLocked || timeBalance === 0 ? (
              <MicOff className="w-10 h-10 text-zinc-500" />
            ) : (
              <Mic className={`w-10 h-10 ${isSpeaking ? 'text-white' : 'text-zinc-300'}`} />
            )}
          </button>
          
          <p className="text-zinc-500 text-xs mt-6 font-medium text-center relative z-10">
            {timeBalance === 0 
              ? 'Balance empty. Recharge to speak.' 
              : isLocked 
                ? 'Channel locked. Someone is speaking.'
                : 'Hold to speak. Releases to translate.'}
          </p>

          {/* Background animated ring when speaking */}
          {isSpeaking && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-emerald-500 z-0"
            />
          )}
        </div>
      </div>

      {/* QR Code Modal for Creator */}
      <AnimatePresence>
        {showQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center"
            >
              <h3 className="text-xl font-display font-bold text-black mb-2">Room Created</h3>
              <p className="text-zinc-500 text-sm mb-8">Have your friends scan this code to join the offline network instantly.</p>
              
              <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100 mb-8">
                <QRCode value="localize://join/12345" size={200} />
              </div>
              
              <button 
                onClick={() => setShowQR(false)}
                className="w-full bg-black text-white font-medium rounded-xl py-4 hover:bg-zinc-800 transition-colors"
              >
                Close & Wait
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
