import React from 'react';

interface TriSyncLogoProps {
  className?: string;
  iconSize?: number;
}

export default function TriSyncLogo({ className = '', iconSize = 48 }: TriSyncLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* New Tri-Sync Logo matching the user's design */}
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 100 100" 
        className="mb-3 drop-shadow-[0_0_15px_rgba(0,180,216,0.5)]"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* App's Cyan to Dark Blue Gradient */}
          <linearGradient id="appGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {/* Outer Circle */}
        <circle cx="50" cy="50" r="42" stroke="url(#appGradient)" strokeWidth="4.5" />

        {/* 3 Interlocking Loops (Trefoil variation) */}
        <g stroke="url(#appGradient)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Loop 1 (Top) */}
          <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" />
          {/* Loop 2 (Bottom Right) */}
          <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" transform="rotate(120 50 50)" />
          {/* Loop 3 (Bottom Left) */}
          <path d="M 43 55 L 43 22 A 7 7 0 0 1 57 22 L 57 45" transform="rotate(240 50 50)" />
        </g>
      </svg>
      
      {/* Brand Text */}
      <h1 className="text-[1.75rem] font-black tracking-[0.1em] flex items-center leading-none">
        <span className="text-white">Trio</span>
        <span className="text-[#00E5FF] tracking-normal capitalize ml-0.5">Sync</span>
      </h1>
    </div>
  );
}
