import React from 'react';
import { PlusCircle, ScanLine, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';

interface HomeViewProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export function HomeView({ onCreateRoom, onJoinRoom }: HomeViewProps) {
  return (
    <div className="flex flex-col h-full p-6 pt-16 max-w-md mx-auto">
      
      <div className="flex-1 flex flex-col items-center justify-center space-y-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-zinc-800 mb-6">
            <WifiOff className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-display font-semibold text-white">Offline Ready</h1>
          <p className="text-zinc-400 text-sm max-w-[240px] mx-auto leading-relaxed">
            Connect directly to nearby devices. No internet required for translation.
          </p>
        </motion.div>

        <div className="w-full space-y-4">
          <button
            onClick={onCreateRoom}
            className="w-full group relative bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-5 flex items-center space-x-4 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <PlusCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-medium">Create Room</h3>
              <p className="text-xs text-zinc-500 mt-1">Generate a QR code for others</p>
            </div>
          </button>

          <button
            onClick={onJoinRoom}
            className="w-full group relative bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl p-5 flex items-center space-x-4 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
              <ScanLine className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-white font-medium">Scan Code to Join</h3>
              <p className="text-xs text-zinc-500 mt-1">Scan a friend's room QR code</p>
            </div>
          </button>
        </div>
      </div>
      
    </div>
  );
}
