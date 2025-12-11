import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <svg 
      viewBox="0 0 128 128" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Drop Shadow for Depth */}
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
        <feOffset dx="1" dy="2" result="offsetblur" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.2" />
        </feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Main Pill Shape - Angled */}
      <g transform="rotate(-15 64 64)" filter="url(#shadow)">
        {/* Left/Bottom Half - Z Deep Teal */}
        <path 
          d="M28 64 L28 64 A 36 36 0 0 0 64 100 L 64 28 A 36 36 0 0 0 28 64 Z" 
          fill="#204D4C" 
        />
        
        {/* Right/Top Half - Z Green / Gradient effect hint */}
        <path 
          d="M64 100 L 64 100 A 36 36 0 0 0 100 64 L 100 64 A 36 36 0 0 0 64 28 Z" 
          fill="#51A090" 
        />
      </g>
      
      {/* Chat Bubble Overlay */}
      <g transform="translate(68, 15)">
        {/* Bubble Body */}
        <path 
          d="M10 0 H 46 A 14 14 0 0 1 60 14 V 42 A 14 14 0 0 1 46 56 H 24 L 8 70 V 56 H 10 A 10 10 0 0 1 0 46 V 10 A 10 10 0 0 1 10 0 Z" 
          fill="#FFFFFF" 
          stroke="#204D4C" 
          strokeWidth="3"
        />
        
        {/* Chat Dots - Z Sky/Green */}
        <circle cx="18" cy="28" r="3.5" fill="#51A090" />
        <circle cx="30" cy="28" r="3.5" fill="#51A090" />
        <circle cx="42" cy="28" r="3.5" fill="#51A090" />
      </g>
    </svg>
  );
};