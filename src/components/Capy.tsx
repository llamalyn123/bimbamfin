import React, { useId } from 'react';
import { Outfit, useWornOutfit } from '../lib/capyProgress';

export type CapyMood = 'happy' | 'thinking' | 'oops' | 'sparkle' | 'study' | 'nap';

/**
 * Capy: Bimbam's study buddy. A chill capybara with a yuzu on its head and a little
 * hand mirror that "reflects back" what the student actually understands
 * (Bimbam = mirror in Tamil; "no cap" = no lie).
 * When something needs checking (a mistake, or a question the materials don't cover),
 * Capy switches to detective mode: checked deerstalker hat and a magnifying glass.
 */
type CapyProps = {
  mood?: CapyMood;
  size?: number;
  className?: string;
  title?: string;
  /** Play the one-off reaction for this mood: hop (happy/sparkle) or hat-drop + pop (detective). */
  react?: boolean;
  /** Looking through the material: sways and sweeps the magnifier. */
  searching?: boolean;
  /** Wave hello with a paw. */
  wave?: boolean;
  /** Blink every few seconds (default on). */
  blink?: boolean;
  /** What Capy wears. 'auto' (default) = the outfit the student picked in Capy's wardrobe. */
  outfit?: Outfit | 'auto';
};

/** All motion is CSS (index.css, .capy-*) and switches off for "reduce motion" users. */
export const Capy: React.FC<CapyProps> = ({
  mood = 'happy',
  size = 36,
  className = '',
  title,
  react = false,
  searching = false,
  wave = false,
  blink = true,
  outfit = 'auto'
}) => {
  const wornOutfit = useWornOutfit();
  const pid = `capychk${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const detective = mood === 'oops' || mood === 'thinking';
  const studying = mood === 'study';
  const napping = mood === 'nap';
  // Outfits only on the everyday look (detective mode keeps its hat)
  const look: Outfit = detective ? 'none' : outfit === 'auto' ? wornOutfit : outfit;
  const label = title ?? (detective ? 'Capy, detective mode' : 'Capy');
  const motion = [
    'capy',
    react && (detective ? 'capy-pop' : 'capy-hop'),
    searching && 'capy-searching'
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label} className={`shrink-0 ${motion} ${className}`}>
      <title>{label}</title>
      {/* ears */}
      <ellipse cx="13" cy="17" rx="3.6" ry="3" fill="#7A4F25" />
      <ellipse cx="41" cy="17" rx="3.6" ry="3" fill="#7A4F25" />
      {/* head */}
      <rect x="4" y="16" width="46" height="38" rx="14" fill="#A8763E" />

      {detective ? (
        /* deerstalker hat (generic detective) */
        <g className="capy-hat">
          <defs>
            <pattern id={pid} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="#A08560" />
              <rect width="2" height="2" fill="#7E6646" />
              <rect x="2" y="2" width="2" height="2" fill="#7E6646" />
            </pattern>
          </defs>
          <path d="M3 22 q-2 -3 4 -4 l8 1 -2 5z" fill="#6E5A40" />
          <path d="M51 22 q2 -3 -4 -4 l-8 1 2 5z" fill="#6E5A40" />
          <path d="M10 22 q0 -19 17 -19 q17 0 17 19 z" fill={`url(#${pid})`} stroke="#5C4A33" strokeWidth="1.2" />
          <path d="M27 3 v19" stroke="#5C4A33" strokeWidth="0.9" opacity="0.7" />
          <path d="M10 22 h34" stroke="#5C4A33" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 3.5 q3 -3.2 6 0 M25.5 2.4 l-2 -2 M28.5 2.4 l2 -2" stroke="#5C4A33" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      ) : look === 'gradcap' ? (
        /* grad cap */
        <g>
          <path d="M16 15 v4.5 q11 4.5 22 0 V15" fill="#1F2937" />
          <path d="M8 12 L27 4.5 L46 12 L27 19.5 Z" fill="#111827" stroke="#374151" strokeWidth="0.8" />
          <circle cx="27" cy="12" r="1.3" fill="#D4A94F" />
          <path d="M27 12 L41 14.5 V22" stroke="#D4A94F" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M39.6 22 h2.8 l-0.5 3.5 h-1.8z" fill="#D4A94F" />
        </g>
      ) : (
        /* yuzu on head */
        <g>
          <circle cx="27" cy="11" r="7" fill="#FBBF24" />
          <path d="M27 4.5 q3 -3 6 -1" stroke="#16A34A" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="31" cy="4" rx="3" ry="1.6" fill="#22C55E" />
        </g>
      )}

      {/* snout + nostrils */}
      <rect x="9" y="33" width="36" height="19" rx="9" fill="#BF8A52" />
      <path d="M22 37.5 v3" stroke="#3E2610" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 37.5 v3" stroke="#3E2610" strokeWidth="2.2" strokeLinecap="round" />

      {/* mouth */}
      {mood === 'oops' ? (
        <path d="M24 45.5 q4 1.2 7.5 -1.5" stroke="#3E2610" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : mood === 'thinking' || studying || napping ? (
        <path d="M24 45.5 h6" stroke="#3E2610" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M23 45.5 q4 3 8 0" stroke="#3E2610" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}

      {/* eyes */}
      <g className={blink && !napping ? 'capy-eyes' : undefined}>
      {detective ? (
        <>
          <path d="M13 24 l6 1.2" stroke="#2B1A0B" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="16.5" cy="27.5" r="2" fill="#2B1A0B" />
          <circle cx="17.1" cy="26.9" r="0.6" fill="#fff" />
          <path d="M35 27 h6" stroke="#2B1A0B" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : look === 'sunglasses' ? (
        <>
          <rect x="10.5" y="23.5" width="11" height="7" rx="3" fill="#111827" />
          <rect x="32.5" y="23.5" width="11" height="7" rx="3" fill="#111827" />
          <path d="M21.5 26 h11" stroke="#111827" strokeWidth="1.6" />
          <path d="M12.5 25.5 l3 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <path d="M34.5 25.5 l3 0" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
        </>
      ) : napping ? (
        <>
          <path d="M13 27 q3 2.6 6 0" stroke="#2B1A0B" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M35 27 q3 2.6 6 0" stroke="#2B1A0B" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : studying ? (
        <>
          <path d="M14 29 h4.5" stroke="#2B1A0B" strokeWidth="2" strokeLinecap="round" />
          <path d="M36 29 h4.5" stroke="#2B1A0B" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : mood === 'sparkle' ? (
        <>
          <path d="M13 27.5 q3 -3.4 6 0" stroke="#2B1A0B" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M35 27.5 q3 -3.4 6 0" stroke="#2B1A0B" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M13 27 h6" stroke="#2B1A0B" strokeWidth="2" strokeLinecap="round" />
          <path d="M35 27 h6" stroke="#2B1A0B" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      </g>

      {/* blush */}
      <ellipse cx="9.5" cy="31" rx="2.4" ry="1.5" fill="#E58C7A" opacity="0.55" />
      <ellipse cx="44.5" cy="31" rx="2.4" ry="1.5" fill="#E58C7A" opacity="0.55" />

      {detective ? (
        /* magnifying glass */
        <g className="capy-lens">
          <rect x="47" y="51" width="4.5" height="12" rx="2.2" fill="#6B4423" transform="rotate(-25 49 57)" />
          <circle cx="53" cy="41" r="9.5" fill="#E0F2FE" fillOpacity="0.85" stroke="#D4A94F" strokeWidth="2.8" />
          <path d="M48.5 37 q1.6 -3.4 5.2 -3.8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text className="capy-mark" x="53" y="45.5" textAnchor="middle" fontSize="11" fontWeight="800" fill={mood === 'oops' ? '#B45309' : '#4F46E5'} fontFamily="system-ui, sans-serif">
            {mood === 'oops' ? '!' : '?'}
          </text>
          <ellipse cx="49" cy="55" rx="4" ry="3" fill="#7A4F25" />
        </g>
      ) : studying ? (
        /* open book */
        <g>
          <path d="M14 51 q7 -3 13 0 v10 q-6 -3 -13 0z" fill="#F8FAFC" stroke="#6366F1" strokeWidth="1.4" />
          <path d="M27 51 q6 -3 13 0 v10 q-7 -3 -13 0z" fill="#EEF2FF" stroke="#6366F1" strokeWidth="1.4" />
          <path d="M17 54 h7 M17 57 h6 M30 54 h7 M30 57 h6" stroke="#A5B4FC" strokeWidth="0.9" />
          <ellipse cx="13" cy="57" rx="3.5" ry="2.8" fill="#7A4F25" />
          <ellipse cx="41" cy="57" rx="3.5" ry="2.8" fill="#7A4F25" />
        </g>
      ) : napping ? (
        <g fill="#6366F1" fontFamily="system-ui, sans-serif" fontWeight="800" className="capy-zzz">
          <text x="47" y="22" fontSize="8">z</text>
          <text x="53" y="15" fontSize="10">z</text>
          <text x="58" y="7" fontSize="7">z</text>
        </g>
      ) : (
        /* hand mirror */
        <g>
          <rect x="51" y="51" width="4.5" height="11" rx="2.2" fill="#B8892F" />
          <ellipse cx="53.2" cy="42" rx="8" ry="10" fill="#E0F2FE" stroke="#D4A94F" strokeWidth="2.6" />
          <path d="M49 37 q1.5 -3.5 5 -4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="53" cy="56" rx="4" ry="3" fill="#7A4F25" />
        </g>
      )}

      {look === 'headband' && (
        <g>
          <path d="M5 23 q22 -7 44 0" stroke="#EF4444" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M47 21 l6 -4 M47 22 l7 1" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {look === 'headphones' && (
        <g>
          <path d="M5 26 q22 -30 44 0" stroke="#374151" strokeWidth="3" fill="none" />
          <rect x="1" y="21" width="7.5" height="12" rx="3.2" fill="#6366F1" stroke="#312E81" strokeWidth="0.8" />
          <rect x="45.5" y="21" width="7.5" height="12" rx="3.2" fill="#6366F1" stroke="#312E81" strokeWidth="0.8" />
        </g>
      )}

      {wave && (
        <g className="capy-wave">
          <rect x="2" y="33" width="6" height="16" rx="3" fill="#9A6A36" />
          <ellipse cx="5" cy="32.5" rx="4.6" ry="3.9" fill="#7A4F25" />
          <path d="M3 30.5 v1.6 M5 30 v1.8 M7 30.5 v1.6" stroke="#5C3A1A" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      )}

      {mood === 'sparkle' && (
        <g fill="#F5C542">
          <path d="M5 6 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3z" />
          <path d="M43 3 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z" />
          <path d="M60 24 l0.8 1.8 1.8 0.8 -1.8 0.8 -0.8 1.8 -0.8 -1.8 -1.8 -0.8 1.8 -0.8z" />
        </g>
      )}
    </svg>
  );
};

/** Mood for a tutor reply: mistake → detective "!", not covered → detective "?", clean streak → sparkle. */
export const capyMood = (
  reply: { corrections?: unknown[]; not_covered?: boolean } | undefined,
  cleanStreak = 0
): CapyMood => {
  if (!reply) return 'happy';
  if ((reply.corrections?.length ?? 0) > 0) return 'oops';
  if (reply.not_covered) return 'thinking';
  return cleanStreak >= 3 ? 'sparkle' : 'happy';
};
