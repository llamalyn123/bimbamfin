import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';

export const LOGO_LIGHT =
  'https://xxlbvcwyicddkjbzbtvu.supabase.co/storage/v1/object/public/assets/Bim%20Bam-2.png';
export const LOGO_DARK =
  'https://xxlbvcwyicddkjbzbtvu.supabase.co/storage/v1/object/public/assets/Bimbam-dark.png';

/** Square brand tile that follows the app's Light / Dark / System theme. */
export const Logo: React.FC<{ size: string; className?: string }> = ({ size, className = '' }) => {
  const { resolvedTheme } = useApp();

  // Preload both so switching theme doesn't flash
  useEffect(() => {
    [LOGO_LIGHT, LOGO_DARK].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  return (
    <img
      src={resolvedTheme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
      alt="Bimbam"
      className={`${size} aspect-square object-cover rounded-2xl shrink-0 ${className}`}
    />
  );
};
