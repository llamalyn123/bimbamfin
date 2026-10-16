import React from 'react';
import type { Friend } from '../lib/capyProgress';

/** Little animal friends that sit with Capy (real capybaras are famous for this). Earned with 80%+ quiz scores. */
export const FriendIcon: React.FC<{ id: Friend; size?: number; locked?: boolean }> = ({ id, size = 22, locked = false }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    role="img"
    aria-label={locked ? 'Locked friend' : id}
    className={`shrink-0 ${locked ? 'opacity-30 grayscale' : 'capy-friend'}`}
  >
    {id === 'duckling' && (
      <>
        <ellipse cx="12" cy="16" rx="7" ry="5.5" fill="#FDE047" />
        <circle cx="13" cy="8.5" r="4.5" fill="#FDE047" />
        <path d="M17 8.5 l4 1 -4 1.4z" fill="#F97316" />
        <circle cx="14.5" cy="7.6" r="0.9" fill="#1F2937" />
        <path d="M7 15 q3 -2 5 1" stroke="#EAB308" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </>
    )}
    {id === 'bird' && (
      <>
        <ellipse cx="11" cy="14" rx="7" ry="6" fill="#60A5FA" />
        <ellipse cx="12.5" cy="16" rx="4" ry="3.2" fill="#DBEAFE" />
        <path d="M17.5 12 l4 1.5 -4 1z" fill="#F59E0B" />
        <circle cx="15" cy="11.5" r="0.9" fill="#1F2937" />
        <path d="M4 12 q-2 -3 1 -5 q1 3 3 4" fill="#3B82F6" />
        <path d="M10 20 v2 M13 20 v2" stroke="#F59E0B" strokeWidth="1" strokeLinecap="round" />
      </>
    )}
    {id === 'turtle' && (
      <>
        <ellipse cx="11" cy="15" rx="8" ry="5.5" fill="#16A34A" />
        <path d="M7 15 h8 M11 10.5 v9 M7.5 12 l7 6 M14.5 12 l-7 6" stroke="#15803D" strokeWidth="0.8" />
        <circle cx="20" cy="14" r="2.8" fill="#86EFAC" />
        <circle cx="20.8" cy="13.3" r="0.6" fill="#1F2937" />
        <ellipse cx="6" cy="20.5" rx="1.8" ry="1.2" fill="#86EFAC" />
        <ellipse cx="16" cy="20.5" rx="1.8" ry="1.2" fill="#86EFAC" />
      </>
    )}
    {id === 'kitten' && (
      <>
        <path d="M5 9 l2 -5 3 4z M19 9 l-2 -5 -3 4z" fill="#FB923C" />
        <ellipse cx="12" cy="13" rx="7.5" ry="6.5" fill="#FDBA74" />
        <circle cx="9.3" cy="12.5" r="1" fill="#1F2937" />
        <circle cx="14.7" cy="12.5" r="1" fill="#1F2937" />
        <path d="M11.3 15 l0.7 0.6 0.7 -0.6" stroke="#9A3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d="M4 14 h3 M17 14 h3" stroke="#9A3412" strokeWidth="0.6" />
      </>
    )}
  </svg>
);
