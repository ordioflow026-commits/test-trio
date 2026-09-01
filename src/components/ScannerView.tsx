import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ScanLine, X } from 'lucide-react';

interface ScannerViewProps {
  onScanSuccess: () => void;
  onCancel: () => void;
}

export function ScannerView({ onScanSuccess, onCancel }: ScannerViewProps) {
  useEffect(() => {
    // Simulate successful scan after 2.5 seconds
    const timer = setTimeout(() => {
      onScanSuccess();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onScanSuccess]);

  return (
    <div className="flex flex-col h-full bg-black relative">
      <div className="absolute top-6 left-6 z-10">
        <button 
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center border border-zinc-800 text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Fake camera feed background */}
        <div className="absolute inset-0 bg-zinc-900 opacity-50" />
        
        <div className="relative z-10 w-64 h-64 border-2 border-zinc-700 rounded-3xl overflow-hidden shadow-2xl">
          {/* Scanning line animation */}
          <motion.div
            animate={{ y: [0, 256, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
          />
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ScanLine className="w-12 h-12 text-zinc-600/30" />
          </div>
        </div>
        
        <p className="relative z-10 text-white mt-8 font-medium">Scanning room code...</p>
        <p className="relative z-10 text-zinc-500 text-sm mt-2">Position the QR code within the frame</p>
      </div>
    </div>
  );
}
