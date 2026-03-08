import React from 'react';

interface MosaicLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'color' | 'white' | 'dark';
  showText?: boolean;
  textPosition?: 'right' | 'bottom';
}

export const MosaicLogo: React.FC<MosaicLogoProps> = ({
  className = "",
  size = 'md',
  variant = 'color',
  showText = false,
  textPosition = 'right'
}) => {

  // Size configurations
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-lg', subtext: 'text-xs' },
    md: { icon: 'w-10 h-10', text: 'text-xl', subtext: 'text-xs' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl', subtext: 'text-sm' },
    xl: { icon: 'w-16 h-16', text: 'text-3xl', subtext: 'text-base' },
  };

  // Color palettes
  const palettes = {
    color: {
      tiles: ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'], // Blue, Emerald, Amber, Purple
      text: '#0f172a',
      subtext: '#64748b'
    },
    white: {
      tiles: ['rgba(255,255,255,1)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.4)'],
      text: '#ffffff',
      subtext: 'rgba(255,255,255,0.7)'
    },
    dark: {
      tiles: ['#1e293b', '#334155', '#475569', '#64748b'],
      text: '#0f172a',
      subtext: '#64748b'
    }
  };

  const palette = palettes[variant];
  const sizeConfig = sizes[size];

  const containerClass = textPosition === 'bottom'
    ? 'flex flex-col items-center gap-2'
    : 'flex items-center gap-3';

  return (
    <div className={`${containerClass} select-none ${className}`}>
      {/* Logo Icon - Mosaic Tiles */}
      <div className={`${sizeConfig.icon} relative flex-shrink-0`}>
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Background circle (optional subtle effect) */}
          <defs>
            <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.1"/>
              <stop offset="50%" stopColor="white" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="white" stopOpacity="0.1"/>
            </linearGradient>
          </defs>

          {/* Top Left Tile - Blue */}
          <rect x="5" y="5" width="43" height="43" rx="8" fill={palette.tiles[0]}>
            <animate attributeName="opacity" values="1;0.9;1" dur="3s" repeatCount="indefinite"/>
          </rect>

          {/* Top Right Tile - Emerald */}
          <rect x="52" y="5" width="43" height="43" rx="8" fill={palette.tiles[1]}>
            <animate attributeName="opacity" values="0.9;1;0.9" dur="3s" repeatCount="indefinite"/>
          </rect>

          {/* Bottom Left Tile - Amber */}
          <rect x="5" y="52" width="43" height="43" rx="8" fill={palette.tiles[2]}>
            <animate attributeName="opacity" values="0.95;0.85;0.95" dur="3s" repeatCount="indefinite"/>
          </rect>

          {/* Bottom Right Tile - Purple */}
          <rect x="52" y="52" width="43" height="43" rx="8" fill={palette.tiles[3]}>
            <animate attributeName="opacity" values="0.85;0.95;0.85" dur="3s" repeatCount="indefinite"/>
          </rect>

          {/* Subtle shimmer overlay */}
          <rect x="5" y="5" width="90" height="90" rx="12" fill="url(#shimmer)" opacity="0.3"/>
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className={`flex flex-col ${textPosition === 'bottom' ? 'items-center' : 'items-start'}`}>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-bold tracking-tight ${sizeConfig.text}`}
              style={{ color: palette.text }}
            >
              Mosaic
            </span>
            <span
              className={`font-semibold ${sizeConfig.text}`}
              style={{ color: palette.tiles[0] }}
            >
              ERP
            </span>
          </div>
          <span
            className={`${sizeConfig.subtext} tracking-wide`}
            style={{ color: palette.subtext }}
          >
            Insurance Management System
          </span>
        </div>
      )}
    </div>
  );
};

// Alternative: Horizontal stripe logo (like MIG's style)
export const MosaicLogoStripe: React.FC<MosaicLogoProps> = ({
  className = "",
  size = 'md',
  variant = 'color',
  showText = false
}) => {

  const sizes = {
    sm: { width: 'w-24', height: 'h-6', text: 'text-sm' },
    md: { width: 'w-32', height: 'h-8', text: 'text-base' },
    lg: { width: 'w-40', height: 'h-10', text: 'text-lg' },
    xl: { width: 'w-48', height: 'h-12', text: 'text-xl' },
  };

  const colors = variant === 'white'
    ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff']
    : ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];

  const textColor = variant === 'white' ? '#ffffff' : '#0f172a';
  const sizeConfig = sizes[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Colorful stripe bar */}
      <div className={`${sizeConfig.height} flex rounded-full overflow-hidden`} style={{ width: '48px' }}>
        {colors.map((color, i) => (
          <div
            key={i}
            className="flex-1 h-full"
            style={{ backgroundColor: color, opacity: variant === 'white' ? 1 - (i * 0.2) : 1 }}
          />
        ))}
      </div>

      {showText && (
        <div className="flex items-baseline gap-1">
          <span className={`font-bold ${sizeConfig.text}`} style={{ color: textColor }}>
            Mosaic
          </span>
          <span className={`font-semibold ${sizeConfig.text}`} style={{ color: colors[0] }}>
            ERP
          </span>
        </div>
      )}
    </div>
  );
};

// Minimal version - just the tiles
export const MosaicIcon: React.FC<{ size?: number; variant?: 'color' | 'white' | 'dark' }> = ({
  size = 32,
  variant = 'color'
}) => {
  const colors = {
    color: ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'],
    white: ['#fff', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.4)'],
    dark: ['#1e293b', '#334155', '#475569', '#64748b']
  };

  const palette = colors[variant];

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="43" height="43" rx="8" fill={palette[0]}/>
      <rect x="52" y="5" width="43" height="43" rx="8" fill={palette[1]}/>
      <rect x="5" y="52" width="43" height="43" rx="8" fill={palette[2]}/>
      <rect x="52" y="52" width="43" height="43" rx="8" fill={palette[3]}/>
    </svg>
  );
};

export default MosaicLogo;
