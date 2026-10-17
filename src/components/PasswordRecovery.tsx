import React, { useEffect, useState } from 'react';
import { supabase, openedFromRecoveryLink } from '../lib/supabase';
import { PasswordField } from './PasswordField';
import { Capy } from './Capy';

/**
 * Shown after a student opens the "reset your password" email link.
 * Supabase signs them in for this one purpose; they choose a new password here.
 */
export const PasswordRecovery: React.FC = () => {
  const [open, setOpen] = useState(openedFromRecoveryLink);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setOpen(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!open) return null;

  const save = async () => {
    setError(null);
    if (pw.length < 6) return setError('Use at least 6 characters.');
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(err.message.includes('session') ? 'This reset link has expired. Ask for a new one from the sign-in screen.' : err.message);
    setDone(true);
    // Remove the one-time tokens from the address bar
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Choose a new password" className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Capy size={48} mood={done ? 'sparkle' : 'happy'} react outfit="none" />
          <div>
            <h2 className="text-lg font-bold text-[#0E0E12]">{done ? 'Password updated' : 'Choose a new password'}</h2>
            <p className="text-xs text-[#64748B]">{done ? "You're signed in. Use the new password next time." : 'Capy found your account. Pick a new password below.'}</p>
          </div>
        </div>
        {!done ? (
          <>
            <PasswordField value={pw} onChange={setPw} placeholder="New password (min 6 characters)" autoComplete="new-password" label="New password" />
            <PasswordField value={pw2} onChange={setPw2} placeholder="Type it again" autoComplete="new-password" label="Confirm new password" />
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <button type="button" onClick={save} disabled={busy} className="w-full py-2.5 rounded-xl bg-[#0E0E12] text-white text-sm font-semibold disabled:opacity-60">
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setOpen(false)} className="w-full py-2.5 rounded-xl bg-[#D4A94F] text-[#0E0E12] text-sm font-bold">
            Continue to Bimbam
          </button>
        )}
      </div>
    </div>
  );
};
