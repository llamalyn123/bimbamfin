import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase, EventItem } from '../lib/supabase';
import { invokeEdge, EdgeError } from '../lib/edge';
import { changeClass, changeDeadline, fmtWhen } from '../lib/changes';

type Preview = {
  title: string;
  event_date: string;
  end_date: string | null;
  location: string | null;
  registration_deadline: string | null;
  registration_url: string | null;
  organiser: string | null;
  description: string | null;
  interest_tags: string[];
  date_evidence: string | null;
  warnings: string[];
};

type PickedImage = { data: string; media_type: string; preview: string; name: string };

/** Phone photos are huge: shrink to max 1600px JPEG before sending. PDFs pass through. */
async function prepareImage(file: File): Promise<PickedImage> {
  const readAsDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Could not read the file.'));
      r.readAsDataURL(blob);
    });

  if (file.type === 'application/pdf') {
    if (file.size > 5_000_000) throw new Error('That PDF is too large (max 5 MB).');
    const url = await readAsDataUrl(file);
    return { data: url.split(',')[1], media_type: 'application/pdf', preview: '', name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo, screenshot or PDF.');

  const url = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't open that image. Try a screenshot instead."));
    el.src = url;
  });
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL('image/jpeg', 0.85);
  return { data: jpeg.split(',')[1], media_type: 'image/jpeg', preview: jpeg, name: file.name || 'image' };
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

export const EventsScreen: React.FC = () => {
  const {
    events,
    userEventInterests,
    reminders,
    toggleEventRegister,
    toggleEventReminder,
    refreshFromSupabase,
    currentUser,
    showToast,
    t
  } = useApp();

  const [tag, setTag] = useState('All');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState<EdgeError | null>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);

  // Things the Telegram bot found, waiting for the student's OK
  const [inbox, setInbox] = useState<{ id: number; kind: 'event' | 'change'; payload: any; created_at: string }[]>([]);
  const loadInbox = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('inbox_items')
      .select('id, kind, payload, created_at')
      .eq('user_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);
    setInbox((data ?? []) as any);
  };
  useEffect(() => {
    loadInbox();
  }, [currentUser?.id]);
  const settle = async (id: number, status: 'added' | 'dismissed') => {
    await supabase.from('inbox_items').update({ status }).eq('id', id);
    setInbox((x) => x.filter((i) => i.id !== id));
  };
  const acceptInbox = async (item: { id: number; kind: 'event' | 'change'; payload: any }) => {
    const p = item.payload;
    if (item.kind === 'event') {
      await addPreview({ ...p, organiser: null, description: null, interest_tags: [] }, -1);
    } else {
      const err =
        p.type === 'deadline'
          ? await changeDeadline(p.id, p.action, p.new_start)
          : await changeClass({ id: p.id, external_id: p.external_id, starts_at: p.current_start, ends_at: null }, p.action, p.new_start, p.new_end);
      if (err) return showToast(`Couldn't apply: ${err}`);
      showToast('Updated');
      await refreshFromSupabase();
    }
    await settle(item.id, 'added');
  };
  const [dragOver, setDragOver] = useState(false);

  const pickFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      setPicked(await prepareImage(file));
    } catch (e: any) {
      setError({ code: 'BAD_IMAGE', message: e.message });
    }
  };

  // Upcoming only, soonest first
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.event_date).getTime() > Date.now() - 3 * 36e5)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()),
    [events]
  );
  const tags = ['All', ...Array.from(new Set(upcoming.flatMap((e) => e.interest_tags || []))).sort()];
  const shown = tag === 'All' ? upcoming : upcoming.filter((e) => (e.interest_tags || []).includes(tag));

  const findEvents = async () => {
    setIsReading(true);
    setError(null);
    setPreviews([]);
    const { data, error: err } = await invokeEdge('extract-event', {
      text: emailText,
      ...(picked ? { image: { data: picked.data, media_type: picked.media_type } } : {})
    });
    setIsReading(false);
    if (err) {
      setError(
        err.code === 'RATE_LIMITED' ? { ...err, message: `${err.message}` } : err
      );
      return;
    }
    setPreviews(data.events || []);
    setSkipped(data.skipped || []);
  };

  const addPreview = async (p: Preview, idx: number) => {
    if (!currentUser?.id) return;
    const { data, error: err } = await supabase
      .from('events')
      .insert({
        title: p.title,
        event_date: p.event_date,
        end_date: p.end_date,
        location: p.location || '',
        registration_deadline: p.registration_deadline,
        registration_url: p.registration_url,
        organiser: p.organiser,
        description: p.description,
        interest_tags: p.interest_tags,
        source: 'email',
        created_by: currentUser.id
      })
      .select('id')
      .single();
    if (err) return showToast(`Couldn't add event: ${err.message}`);
    await supabase.from('user_event_interest').insert({
      user_id: currentUser.id,
      event_id: data.id,
      reminder_set: true,
      reminder_timing: '1 day',
      registered: false
    });
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    showToast('Event added');
    await refreshFromSupabase();
  };

  const editPreview = (idx: number, field: keyof Preview, value: string) =>
    setPreviews((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const deleteOwn = async (ev: EventItem) => {
    const { error: err } = await supabase.from('events').delete().eq('id', ev.id);
    if (err) return showToast(`Couldn't delete: ${err.message}`);
    await refreshFromSupabase();
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEmailText('');
    setPreviews([]);
    setSkipped([]);
    setError(null);
    setPicked(null);
  };

  return (
    <div className="flex flex-col w-full pb-16 gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-[#0E0E12] tracking-tight font-bold">
            {t('events_header_title', 'Events')}
          </h1>
          <p className="font-body-md text-sm text-[#64748B]">Talks, workshops and things to register for.</p>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-[#FF4FA3] hover:bg-[#f0368f] text-white font-bold shadow-sm"
        >
          + Add from email or photo
        </button>
      </header>

      {inbox.length > 0 && (
        <section className="rounded-3xl border border-[#229ED9]/40 bg-white p-4 flex flex-col gap-2" aria-label="From Telegram, to review">
          <h2 className="text-sm font-bold text-[#0E0E12] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#229ED9]">send</span>
            From Telegram · review before adding
          </h2>
          {inbox.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border border-[#E2E8F0]">
              <div className="text-sm min-w-0">
                {it.kind === 'event' ? (
                  <>
                    <p className="font-semibold text-[#0E0E12]">{it.payload.title}</p>
                    <p className="text-xs text-[#64748B]">
                      {fmtWhen(it.payload.event_date)}
                      {it.payload.location ? ` · ${it.payload.location}` : ''}
                    </p>
                    {it.payload.date_evidence && <p className="text-xs text-[#64748B]">From the message: “{it.payload.date_evidence}”</p>}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-[#0E0E12]">{it.payload.title}</p>
                    <p className="text-xs text-[#1E293B]">
                      {it.payload.action === 'cancel'
                        ? `${fmtWhen(it.payload.current_start)} → Cancelled`
                        : `${fmtWhen(it.payload.current_start)} → ${fmtWhen(it.payload.new_start)}`}
                    </p>
                    {it.payload.quote && <p className="text-xs text-[#64748B]">From the message: “{it.payload.quote}”</p>}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => settle(it.id, 'dismissed')} className="px-3 py-1.5 rounded-xl border border-[#C9D1DB] text-xs font-semibold">
                  Dismiss
                </button>
                <button type="button" onClick={() => acceptInbox(it)} className="px-3 py-1.5 rounded-xl bg-[#229ED9] text-white text-xs font-bold">
                  {it.kind === 'event' ? 'Add' : 'Confirm'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tags.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => setTag(tg)}
              className={`px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                tag === tg ? 'bg-[#7C5CFF] text-white font-bold' : 'bg-white text-[#64748B] border border-[#C9D1DB] hover:bg-[#F8FAFC]'
              }`}
            >
              {tg === 'All' ? 'All' : tg.charAt(0).toUpperCase() + tg.slice(1)}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-3xl bg-[#FFF0F7] border border-[#FBCFE8] p-10 flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-[40px] text-[#FF4FA3]">celebration</span>
          <h2 className="font-headline-lg text-xl font-bold text-[#0E0E12]">No events yet</h2>
          <p className="text-sm text-[#64748B] max-w-sm">
            Paste an event email, or snap a poster or screenshot. Bimbam pulls out the date, venue and registration deadline.
          </p>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="mt-1 px-5 py-2.5 rounded-2xl bg-[#FF4FA3] hover:bg-[#f0368f] text-white font-bold"
          >
            + Add from email or photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((ev) => {
            const mine = ev.created_by && ev.created_by === currentUser?.id;
            const registered = Boolean(userEventInterests[ev.id]);
            const reminded = Boolean(reminders[ev.id]);
            return (
              <article key={ev.id} className="rounded-3xl bg-white border border-[#E9D5FF] p-5 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-[#F3F0FF] text-[#6D28D9] text-xs font-semibold">
                    {fmtDate(ev.event_date)}
                  </span>
                  {mine && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFF0F7] text-[#BE185D] text-[10px] font-semibold border border-[#FBCFE8]">
                      {ev.source === 'booking' ? 'Your booking' : 'From your email'}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">{ev.title}</h2>
                  {(ev.location || ev.organiser) && (
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {[ev.location, ev.organiser].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {(ev.description || ev.notes) && (
                    <p className="text-sm text-[#334155] mt-1.5">{ev.description || ev.notes}</p>
                  )}
                </div>
                {ev.registration_deadline && !registered && (
                  <span className="w-fit px-2.5 py-1 rounded-full bg-[#3A2A10] text-[#F2A93B] text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Register by {fmtDate(ev.registration_deadline)}
                  </span>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
                  {ev.registration_url && (
                    <a
                      href={ev.registration_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#7C5CFF] text-white text-xs font-bold"
                    >
                      Open registration
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEventRegister(ev.id)}
                    aria-pressed={registered}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                      registered ? 'bg-[#F3F0FF] border-[#7C5CFF] text-[#6D28D9]' : 'bg-white border-[#C9D1DB] text-[#0E0E12]'
                    }`}
                  >
                    {registered ? '✓ Registered' : "I've registered"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleEventReminder(ev.id)}
                    aria-pressed={reminded}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 ${
                      reminded ? 'bg-[#FFF0F7] border-[#FF4FA3] text-[#BE185D]' : 'bg-white border-[#C9D1DB] text-[#0E0E12]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{reminded ? 'notifications_active' : 'notifications'}</span>
                    {reminded ? 'Reminder on' : 'Remind me'}
                  </button>
                  {mine && (
                    <button
                      type="button"
                      onClick={() => deleteOwn(ev)}
                      className="ml-auto text-xs text-[#64748B] hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add from email sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={closeSheet}>
          <div
            role="dialog"
            aria-label="Add events from an email"
            className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-lg font-bold text-[#0E0E12]">Add events from an email or photo</h2>
              <button type="button" onClick={closeSheet} aria-label="Close" className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {previews.length === 0 && (
              <>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed cursor-pointer transition-colors ${
                    dragOver ? 'border-[#7C5CFF] bg-[#F3F0FF]' : 'border-[#C9D1DB] hover:border-[#7C5CFF]'
                  }`}
                >
                  {picked?.preview ? (
                    <img src={picked.preview} alt="Selected poster" className="w-16 h-16 object-cover rounded-xl border border-[#E2E8F0]" />
                  ) : (
                    <span className="material-symbols-outlined text-[32px] text-[#7C5CFF]">
                      {picked ? 'picture_as_pdf' : 'add_photo_alternate'}
                    </span>
                  )}
                  <span className="flex-1 text-sm text-[#334155]">
                    {picked ? (
                      <>
                        <span className="font-semibold">{picked.name}</span>
                        <br />
                        <span className="text-xs text-[#64748B]">Used once to read the event, then discarded.</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">Add a poster photo or screenshot</span>
                        <br />
                        <span className="text-xs text-[#64748B]">Tap to take a photo or choose one. You can also drop or paste an image.</span>
                      </>
                    )}
                  </span>
                  {picked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPicked(null);
                      }}
                      aria-label="Remove image"
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      pickFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
                    if (item) {
                      e.preventDefault();
                      pickFile(item.getAsFile());
                    }
                  }}
                  rows={6}
                  placeholder="…or paste the event email or newsletter text"
                  aria-label="Event email text"
                  className="w-full px-3 py-2 rounded-2xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#7C5CFF]"
                />
                <button
                  type="button"
                  disabled={isReading || (!picked && emailText.trim().length < 30)}
                  onClick={findEvents}
                  className="self-end px-5 py-2.5 rounded-2xl bg-[#7C5CFF] text-white font-bold disabled:opacity-50"
                >
                  {isReading ? (picked ? 'Reading the image…' : 'Reading the email…') : 'Find events'}
                </button>
              </>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
                {error.message}
                {error.code === 'RATE_LIMITED' && ' You can still add events by hand later.'}
              </div>
            )}

            {previews.map((p, idx) => (
              <div key={idx} className="rounded-2xl border border-[#E9D5FF] p-4 flex flex-col gap-2">
                <input
                  value={p.title}
                  onChange={(e) => editPreview(idx, 'title', e.target.value)}
                  aria-label="Event title"
                  className="font-bold text-[#0E0E12] border-b border-transparent focus:border-[#7C5CFF] focus:outline-none"
                />
                <p className="text-sm text-[#334155]">{fmtDate(p.event_date)}</p>
                {p.date_evidence && <p className="text-xs text-[#64748B]">{picked ? 'Read from the image' : 'From the email'}: “{p.date_evidence}”</p>}
                <input
                  value={p.location || ''}
                  onChange={(e) => editPreview(idx, 'location', e.target.value)}
                  placeholder="Location"
                  aria-label="Location"
                  className="text-sm border border-[#E2E8F0] rounded-lg px-2 py-1"
                />
                {p.registration_deadline && (
                  <p className="text-xs text-[#92400E]">Register by {fmtDate(p.registration_deadline)}</p>
                )}
                {p.warnings.map((w) => (
                  <p key={w} className="text-xs text-[#92400E] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    {w}
                  </p>
                ))}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setPreviews((prev) => prev.filter((_, i) => i !== idx))}
                    className="px-3 py-1.5 rounded-xl border border-[#C9D1DB] text-xs font-semibold"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={() => addPreview(p, idx)}
                    className="px-4 py-1.5 rounded-xl bg-[#FF4FA3] text-white text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}

            {skipped.length > 0 && <p className="text-xs text-[#64748B]">Skipped: {skipped.join('; ')}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
