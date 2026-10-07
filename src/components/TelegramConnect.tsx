import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { TELEGRAM_BOT_USERNAME } from '../config';

type Link = { telegram_username: string | null; linked_at: string };
type Group = { chat_id: number; title: string | null };

/** Link Telegram (one-time code) + see/leave study/CCA groups. */
export const TelegramConnect: React.FC = () => {
  const { currentUser, showToast } = useApp();
  const [link, setLink] = useState<Link | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!currentUser?.id) return;
    const { data: l } = await supabase
      .from('telegram_links')
      .select('telegram_username, linked_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    setLink((l as Link) || null);
    const { data: m } = await supabase.from('telegram_group_members').select('chat_id').eq('user_id', currentUser.id);
    const ids = (m ?? []).map((r: any) => r.chat_id);
    if (ids.length) {
      const { data: g } = await supabase.from('telegram_groups').select('chat_id, title').in('chat_id', ids);
      setGroups((g ?? []) as Group[]);
    } else setGroups([]);
  };

  useEffect(() => {
    load();
  }, [currentUser?.id]);

  const connect = async () => {
    if (!currentUser?.id) return;
    setBusy(true);
    await supabase.from('telegram_link_tokens').delete().eq('user_id', currentUser.id);
    const { data, error } = await supabase
      .from('telegram_link_tokens')
      .insert({ user_id: currentUser.id })
      .select('token')
      .single();
    setBusy(false);
    if (error || !data) return showToast(`Couldn't create a link: ${error?.message}`);
    window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${data.token}`, '_blank');
    showToast('Tap Start in Telegram, then come back here');
  };

  const disconnect = async () => {
    if (!currentUser?.id) return;
    await supabase.from('telegram_links').delete().eq('user_id', currentUser.id);
    setLink(null);
    showToast('Telegram disconnected');
  };

  const leave = async (chatId: number) => {
    if (!currentUser?.id) return;
    await supabase.from('telegram_group_members').delete().eq('chat_id', chatId).eq('user_id', currentUser.id);
    setGroups((g) => g.filter((x) => x.chat_id !== chatId));
  };

  return (
    <section className="space-y-3 border-t border-gray-100 pt-6">
      <div>
        <h2 className="text-base font-bold text-gray-900">Telegram</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Forward CCA announcements or posters to the Bimbam bot to add them for review. Add the bot to a study group for
          shared deadlines (/due) and finding meeting times (/meet). It only reads commands, not your chats.
        </p>
      </div>

      {link ? (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold text-gray-900">Connected{link.telegram_username ? ` as @${link.telegram_username}` : ''}</p>
            <p className="text-gray-500">Chat with @{TELEGRAM_BOT_USERNAME} to forward messages.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-semibold">
              Refresh
            </button>
            <button type="button" onClick={disconnect} className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-semibold">
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[#229ED9] hover:bg-[#1b8cc2] text-white text-sm font-bold disabled:opacity-50"
          >
            {busy ? 'Opening…' : 'Connect Telegram'}
          </button>
          <button type="button" onClick={load} className="text-xs text-gray-500 underline">
            I've tapped Start, refresh
          </button>
          <p className="w-full text-[11px] text-gray-500">The link works once and expires after 15 minutes.</p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-900">Groups you joined</p>
          {groups.map((g) => (
            <div key={g.chat_id} className="flex items-center justify-between text-sm p-2 rounded-lg border border-gray-200">
              <span className="text-gray-800">{g.title || 'Telegram group'}</span>
              <button type="button" onClick={() => leave(g.chat_id)} className="text-xs text-gray-500 hover:text-red-700">
                Leave
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
