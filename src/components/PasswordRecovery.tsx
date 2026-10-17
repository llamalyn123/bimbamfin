import React, { useEffect, useState } from 'react';
import { supabase, openedFromRecoveryLink } from '../lib/supabase';
import { PasswordField } from './PasswordField';
import { Capy } from './Capy';

/**
 * Password reset, done safely:
 * a "reset password" email link signs the student in ONLY to choose a new password.
 * While that recovery session is active the app stays locked behind this screen
 * (even after a reload), and once the password is changed the student is signed out
 * and must sign in again with the new password.
 */
const FLAG = 'bimbam_recovery_pending';
const DONE = 'bimbam_pw_changed';

const ss = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  del: (k: string) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
};

if (openedFromRecoveryLink) ss.set(FLAG, '1');

/** True if this login came from a recovery link (Supabase marks it in the token's "amr" claim). */
const tokenIsRecovery = (accessToken?: string) => {
  try {
    const part = accessToken?.split('.')[1];
    if (!part) return false;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(json.amr) && json.amr.some((a: { method?: string }) => a?.method === 'recovery');
  } catch {
    return false;
  }
};

/** App-level gate: true while the student must still choose a new password. */
export const useRecoveryGate = () => {
  const [pending, setPending] = useState(() => openedFromRecoveryLink || ss.get(FLAG) === '1');
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const s = data.session;
      // Locked if this tab came from the reset link, or the login itself is a recovery login (e.g. opened in a new tab)
      if (s && (ss.get(FLAG) === '1' || tokenIsRecovery(s.access_token))) {
        ss.set(FLAG, '1');
        setPending(true);
      }
      else if (!s) {
        ss.del(FLAG);
        setPending(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        ss.set(FLAG, '1');
        setPending(true);
      }
      if (event === 'SIGNED_OUT') {
        ss.del(FLAG);
        setPending(false);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return pending;
};

/** Message for the sign-in screen after a successful reset (shown once). */
export const takePasswordChangedNotice = () => {
  const v = ss.get(DONE);
  if (v) ss.del(DONE);
  return v === '1';
};

const signOutAndReload = async (changed: boolean) => {
  ss.del(FLAG);
  if (changed) ss.set(DONE, '1');
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem('nocturne_auth_user');
  } catch {
    /* ignore */
  }
  window.location.replace(window.location.pathname);
};

/** Full-screen lock: nothing else in the app is reachable until a new password is saved. */
export const PasswordRecovery: React.FC = () => {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (pw.length < 6) return setError('Use at least 6 characters.');
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      return setError(
        /session|expired|invalid|jwt/i.test(err.message)
          ? 'This reset link has expired. Go back and ask for a new one.'
          : /same|different/i.test(err.message)
            ? 'Choose a password you have not used here before.'
            : err.message
      );
    }
    // Sign out everywhere this tab knows about, then sign in again with the new password
    await signOutAndReload(true);
  };

  return (
    <div className="h-dvh w-full flex items-center justify-center bg-[#F4F7FB] p-4">
      <div role="dialog" aria-modal="true" aria-label="Choose a new password" className="w-full max-w-sm bg-white rounded-2xl border border-[#C9D1DB] shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Capy size={48} mood="thinking" outfit="none" />
          <div>
            <h2 className="text-lg font-bold text-[#0E0E12]">Choose a new password</h2>
            <p className="text-xs text-[#64748B]">For your safety, set a new password first. Then sign in with it.</p>
          </div>
        </div>
        <PasswordField value={pw} onChange={setPw} placeholder="New password (min 6 characters)" autoComplete="new-password" label="New password" />
        <PasswordField value={pw2} onChange={setPw2} placeholder="Type it again" autoComplete="new-password" label="Confirm new password" />
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <button type="button" onClick={save} disabled={busy} className="w-full py-2.5 rounded-xl bg-[#0E0E12] text-white text-sm font-semibold disabled:opacity-60">
          {busy ? 'Saving…' : 'Save and sign in again'}
        </button>
        <button type="button" onClick={() => signOutAndReload(false)} disabled={busy} className="text-xs text-[#64748B] underline self-center">
          Cancel and sign out
        </button>
      </div>
    </div>
  );
};
