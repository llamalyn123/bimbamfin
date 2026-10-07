import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';

type Feed = { url: string; last_synced_at: string | null; last_status: string | null; last_error: string | null };

const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

const mask = (url: string) => {
  try {
    const u = new URL(url.replace(/^webcals?:/i, 'https:'));
    return `${u.hostname}/…`;
  } catch {
    return 'Saved link';
  }
};

/** More → Connected accounts: school calendar in, phone calendar out. */
export const ConnectedCalendars: React.FC = () => {
  const { currentUser, refreshFromSupabase, showToast } = useApp();

  const [feed, setFeed] = useState<Feed | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Upload a .ics file the university sent (one-off snapshot, no link needed)
  const importFile = async (file?: File | null) => {
    if (!file) return;
    setImportMsg(null);
    if (!/\.ics$/i.test(file.name) && file.type !== 'text/calendar') {
      return setImportMsg({ kind: 'error', text: 'Please choose a calendar file ending in .ics.' });
    }
    if (file.size > 2_000_000) {
      return setImportMsg({ kind: 'error', text: 'That file is too large (max 2 MB).' });
    }
    setImporting(true);
    const text = await file.text();
    const { data, error } = await invokeEdge('sync-deadlines', { ics_text: text });
    setImporting(false);
    if (error) return setImportMsg({ kind: 'error', text: error.message });
    const parts = [`${data.added} new`, `${data.updated} updated`];
    if (data.removed) parts.push(`${data.removed} removed`);
    if (data.classes) parts.push(`${data.classes} class sessions`);
    setImportMsg({ kind: 'ok', text: `Imported ${file.name}: ${parts.join(', ')}.` });
    await refreshFromSupabase();
  };

  const loadFeed = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('calendar_feeds')
      .select('url, last_synced_at, last_status, last_error')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    setFeed((data as Feed) || null);
  };

  useEffect(() => {
    loadFeed();
  }, [currentUser?.id]);

  const sync = async (feedUrl?: string) => {
    setBusy(true);
    setMessage(null);
    const { data, error } = await invokeEdge('sync-deadlines', feedUrl ? { feed_url: feedUrl } : {});
    setBusy(false);
    if (error) {
      setMessage({ kind: 'error', text: error.message });
    } else if (data?.throttled) {
      setMessage({ kind: 'ok', text: 'Already up to date.' });
    } else {
      const parts = [`${data.added} new`, `${data.updated} updated`];
      if (data.removed) parts.push(`${data.removed} removed`);
      if (data.classes) parts.push(`${data.classes} class sessions`);
      setMessage({ kind: 'ok', text: `Synced: ${parts.join(', ')}.` });
      setLinkInput('');
      await refreshFromSupabase();
    }
    await loadFeed();
  };

  const disconnect = async () => {
    if (!currentUser?.id) return;
    await supabase.from('calendar_feeds').delete().eq('user_id', currentUser.id);
    setFeed(null);
    setMessage({ kind: 'ok', text: 'Disconnected. Your existing deadlines are kept.' });
  };

  // ---- phone calendar (outgoing) ----
  const getToken = async (reset = false) => {
    if (!currentUser?.id) return null;
    if (reset) await supabase.from('calendar_export_tokens').delete().eq('user_id', currentUser.id);
    let { data } = await supabase.from('calendar_export_tokens').select('token').eq('user_id', currentUser.id).maybeSingle();
    if (!data) {
      const ins = await supabase.from('calendar_export_tokens').insert({ user_id: currentUser.id }).select('token').single();
      if (ins.error) {
        showToast(`Couldn't create your calendar link: ${ins.error.message}`);
        return null;
      }
      data = ins.data;
    }
    setExportToken(data.token);
    return data.token as string;
  };

  const httpsUrl = (tok: string) => `${SUPABASE_URL}/functions/v1/calendar-feed?token=${tok}`;
  const webcalUrl = (tok: string) => httpsUrl(tok).replace(/^https:\/\//, 'webcal://');

  const openApple = async () => {
    const tok = exportToken || (await getToken());
    if (tok) window.location.href = webcalUrl(tok);
  };
  const openGoogle = async () => {
    const tok = exportToken || (await getToken());
    if (tok) window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(tok))}`, '_blank');
  };
  const copyLink = async () => {
    const tok = exportToken || (await getToken());
    if (!tok) return;
    try {
      await navigator.clipboard.writeText(httpsUrl(tok));
      showToast('Link copied. Treat it like a password.');
    } catch {
      showToast("Couldn't copy. Try the Apple or Google button instead.");
    }
  };
  const resetLink = async () => {
    await getToken(true);
    showToast('New link created. The old one no longer works.');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-8">
      {/* School calendar in */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">School calendar (.ics)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            In eLearn or Canvas, open Calendar and copy the subscribe or calendar feed link. Links starting with webcal://
            work too.
          </p>
        </div>

        {feed ? (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-semibold text-gray-900">Connected · {mask(feed.url)}</p>
              <p className="text-gray-500">
                {feed.last_status === 'error' ? `Last sync failed: ${feed.last_error}` : `Last synced ${ago(feed.last_synced_at)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => sync()}
                className="px-3 py-1.5 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-xs font-bold disabled:opacity-50"
              >
                {busy ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-800"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder={feed ? 'Paste a new link to replace it' : 'https://… or webcal://…'}
            aria-label="School calendar link"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#D4A94F]"
          />
          <button
            type="button"
            disabled={busy || !linkInput.trim()}
            onClick={() => sync(linkInput.trim())}
            className="px-4 py-2 rounded-lg bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
          >
            {busy ? 'Connecting…' : feed ? 'Replace' : 'Connect'}
          </button>
        </div>

        {message && (
          <p role="status" className={`text-xs ${message.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
            {message.text}
          </p>
        )}
      </section>

      {/* Upload a calendar file */}
      <section className="space-y-3 border-t border-gray-100 pt-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">Upload a calendar file</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Got your timetable or deadlines as an <span className="font-semibold">.ics</span> file (e.g. by email)? Drop it here.
            It's a one-time import: when your university sends an updated file, upload it again and Bimbam updates what
            changed (your ticked-off items stay ticked).
          </p>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            importFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
            dragOver ? 'border-[#D4A94F] bg-amber-50' : 'border-gray-300 hover:border-[#D4A94F]'
          }`}
        >
          <span className="material-symbols-outlined text-[28px] text-[#D4A94F]">upload_file</span>
          <span className="text-sm font-semibold text-gray-900">
            {importing ? 'Importing…' : 'Drop your .ics file here, or click to choose'}
          </span>
          <span className="text-xs text-gray-500">Max 2 MB</span>
          <input
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {importMsg && (
          <p role="status" className={`text-xs ${importMsg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
            {importMsg.text}
          </p>
        )}
      </section>

      {/* Phone calendar out */}
      <section className="space-y-3 border-t border-gray-100 pt-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">Add to my phone calendar</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Your deadlines and saved events appear in your phone's calendar, with reminders a day and two hours before.
            Updates automatically. Google Calendar can take up to a day to refresh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openApple} className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold">
            Apple Calendar
          </button>
          <button type="button" onClick={openGoogle} className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold">
            Google Calendar
          </button>
          <button type="button" onClick={copyLink} className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold">
            Copy link
          </button>
        </div>
        <button type="button" onClick={resetLink} className="text-xs text-gray-500 underline">
          Reset link (use this if you shared it by mistake)
        </button>
      </section>
    </div>
  );
};
