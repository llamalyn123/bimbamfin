import React, { useState } from 'react';

/** Password input with a show/hide eye, so students can check what they typed. */
export const PasswordField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  label?: string;
  id?: string;
}> = ({ value, onChange, placeholder, autoComplete = 'current-password', label = 'Password', id }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">
        lock
      </span>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={label}
        className="w-full pl-9 pr-11 py-2.5 rounded-xl border border-[#C9D1DB] text-xs sm:text-sm text-[#0E0E12] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#0E0E12] hover:bg-slate-100"
      >
        <span className="material-symbols-outlined text-[18px]">{show ? 'visibility_off' : 'visibility'}</span>
      </button>
    </div>
  );
};
