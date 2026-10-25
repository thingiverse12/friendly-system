interface SceneProps {
  className?: string;
  variant?: 'night' | 'dawn' | 'gold';
}

/**
 * Hand-built layered fjord landscape (no external images, keeps CSP strict and the bundle tiny).
 */
export function FjordScene({ className, variant = 'night' }: SceneProps) {
  const palettes = {
    night: { sky: ['#0B2A24', '#0F3B31'], sun: '#E9D8A6', far: '#17493C', mid: '#0E352C', near: '#08211C', water: '#0A2A24' },
    dawn: { sky: ['#F6ECD8', '#EBDCC2'], sun: '#D9B36A', far: '#C9D6CB', mid: '#A8C0B2', near: '#7E9C8C', water: '#8FAEA0' },
    gold: { sky: ['#EFE3C6', '#E4D3AC'], sun: '#B98A2F', far: '#D8CBAE', mid: '#C3B191', near: '#A08D6B', water: '#B7A585' },
  } as const;
  const palette = palettes[variant];
  const gradientId = `fjord-${variant}`;
  return (
    <svg
      className={className}
      viewBox="0 0 800 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]} />
          <stop offset="100%" stopColor={palette.sky[1]} />
        </linearGradient>
        <linearGradient id={`${gradientId}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.water} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.water} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width="800" height="420" fill={`url(#${gradientId})`} />
      <circle cx="612" cy="106" r="46" fill={palette.sun} opacity={variant === 'night' ? 0.55 : 0.8} />
      <path d="M0 250 118 152l74 60 96-84 108 106 84-64 116 96 104-70v90H0Z" fill={palette.far} opacity="0.85" />
      <path d="M0 292 92 214l96 70 92-58 112 86 96-56 122 88 90-58v80H0Z" fill={palette.mid} />
      <path d="M0 336 88 282l88 42 108-40 118 56 106-38 120 60 92-38v96H0Z" fill={palette.near} />
      <rect y="352" width="800" height="68" fill={`url(#${gradientId}-water)`} />
      <g stroke={palette.sun} strokeOpacity="0.35" strokeWidth="2">
        <path d="M560 366h96M600 380h72M574 394h88" />
      </g>
    </svg>
  );
}

export function LeafMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M32 10c6.5 7.5 10 13.5 10 19.5a10 10 0 0 1-20 0C22 23.5 25.5 17.5 32 10Z" fill="currentColor" />
      <path d="M32 24c3 3.6 4.6 6.5 4.6 9.2a4.6 4.6 0 0 1-9.2 0c0-2.7 1.6-5.6 4.6-9.2Z" fill="var(--leaf-cut, #0B2A24)" />
      <path d="M32 38v14" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 45c-4.5 0-8-2-10-5.5M32 49c4.5 0 8-2 10-5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`}>
      <span className="logo__mark" aria-hidden="true">
        <LeafMark size={26} />
      </span>
      <span className="logo__word">Sparly</span>
    </span>
  );
}

export function EmptyIllustration({ variant = 'goal' }: { variant?: 'goal' | 'trophy' | 'receipt' }) {
  return (
    <svg className="empty-illustration" viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="84" rx="42" ry="6" fill="currentColor" opacity="0.08" />
      {variant === 'goal' && (
        <>
          <path d="M28 76c0-18 14-30 32-30s32 12 32 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
          <circle cx="60" cy="34" r="13" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
          <circle cx="60" cy="34" r="4" fill="currentColor" opacity="0.6" />
          <path d="M60 21v-7M60 54v7M47 34h-7M80 34h-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        </>
      )}
      {variant === 'trophy' && (
        <>
          <path d="M44 24h32v18a16 16 0 0 1-32 0V24Z" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.5" />
          <path d="M44 28H34v4a10 10 0 0 0 10 10M76 28h10v4a10 10 0 0 1-10 10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.35" />
          <path d="M60 58v12M48 78h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
        </>
      )}
      {variant === 'receipt' && (
        <>
          <path d="M42 18h36v60l-9-6-9 6-9-6-9 6V18Z" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.45" />
          <path d="M50 32h20M50 42h20M50 52h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
        </>
      )}
    </svg>
  );
}
