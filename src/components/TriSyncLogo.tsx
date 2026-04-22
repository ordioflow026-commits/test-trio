import React from 'react';

interface TriSyncLogoProps {
  className?: string;
  iconSize?: number;
}

export default function TriSyncLogo({ className = '', iconSize = 48 }: TriSyncLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Tri-Sync Icon */}
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 100 100" 
        className="mb-3 drop-shadow-[0_0_12px_rgba(0,180,216,0.6)]"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Faint blue circle bg */}
        <circle cx="50" cy="50" r="44" stroke="#1e3a8a" strokeWidth="1.5" fill="none" opacity="0.5" />
        
        {/* Screens & Center knot group */}
        <g stroke="url(#cyanGradientId)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          
          {/* Top Screen */}
          <path d="M 36 22 L 64 22 C 68.4 22 72 25.6 72 30 L 72 32 C 72 36.4 68.4 40 64 40 L 36 40 C 31.6 40 28 36.4 28 32 L 28 30 C 28 25.6 31.6 22 36 22 Z" />
          
          {/* Bottom Right Screen */}
          <path d="M 36 22 L 64 22 C 68.4 22 72 25.6 72 30 L 72 32 C 72 36.4 68.4 40 64 40 L 36 40 C 31.6 40 28 36.4 28 32 L 28 30 C 28 25.6 31.6 22 36 22 Z" transform="rotate(120 50 50)" />
          
          {/* Bottom Left Screen */}
          <path d="M 36 22 L 64 22 C 68.4 22 72 25.6 72 30 L 72 32 C 72 36.4 68.4 40 64 40 L 36 40 C 31.6 40 28 36.4 28 32 L 28 30 C 28 25.6 31.6 22 36 22 Z" transform="rotate(240 50 50)" />

          {/* Central Knot Lines showing gap to the screens (stop short at y=46) */}
          <path d="M 50 60 C 58 54 42 54 50 46" />
          <path d="M 50 60 C 58 54 42 54 50 46" transform="rotate(120 50 50)" />
          <path d="M 50 60 C 58 54 42 54 50 46" transform="rotate(240 50 50)" />

        </g>
        
        <defs>
          <linearGradient id="cyanGradientId" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00f2fe" />
            <stop offset="1" stopColor="#0284c7" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Brand Text */}
      <h1 className="text-[1.75rem] font-black tracking-[0.1em] text-white flex items-center leading-none">
        <span className="text-white">Trio</span>
        <span className="text-[#00f2fe] tracking-normal capitalize ml-0.5">Sync</span>
      </h1>
    </div>
  );
}
