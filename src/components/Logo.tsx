import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-xs',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-3xl',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div 
        className={`${sizeClasses[size]} bg-[#cc1111] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(204,17,17,0.3)] border-4 border-zinc-950 overflow-hidden`}
      >
        <span 
          className="text-white font-black tracking-tighter" 
          style={{ 
            fontFamily: 'var(--font-stencil)', 
            transform: 'scaleY(1.5)',
            textShadow: '2px 2px 0px rgba(0,0,0,0.3)'
          }}
        >
          CHUNKS
        </span>
      </div>
    </div>
  );
};
