import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';

type Facility = {
  id: number;
  name: string;
  building: string | null;
  description: string | null;
  booking_url: string | null;
  hours: Record<string, string> | null;
  sort: number;
};

type BookingPreview = {
  title: string;
  event_date: string;
  end_date: string | null;
  location: string | null;
  date_evidence: string | null;
  warnings: string[];
};

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TZ = 'Asia/Singapore';

/** Current day/minutes in Singapore, whatever the device time zone. */
const sgNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { day: DAYS.indexOf(get('weekday').toLowerCase().slice(0, 3)), mins: Number(get('hour')) * 60 + Number(get('minute')) };
};

const toMins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
};

/** "Open now · closes 11 pm" / "Closed · opens 8 am" from simple per-day hours. */
const openStatus = (hours: Record<string, string> | null): { open: boolean; text: string } | null => {
  if (!hours) return null;
  const { day, mins } = sgNow();
  const range = (d: number) => {
    const v = String(hours[DAYS[(d + 7) % 7]] ?? '').trim();
    if (!v || v === 'closed') return null;
    const [a, b] = v.split('-');
    if (!a || !b) return null;
    const start = toMins(a);
    let end = toMins(b);
    if (end <= start) end += 24 * 60; // overnight, e.g. 08:00-02:00
    return { start, end };
  };
  const today = range(day);
  const yest = range(day - 1);
  if (yest && yest.end > 24 * 60 && mins < yest.end - 24 * 60) {
    return { open: true, text: `Open now · closes ${fmtMins(yest.end - 24 * 60)}` };
  }
  if (today && mins >= today.start && mins < today.end) {
    return { open: true, text: today.end >= 24 * 60 && today.start === 0 ? 'Open 24 hours' : `Open now · closes ${fmtMins(today.end)}` };
  }
  if (today && mins < today.start) return { open: false, text: `Closed · opens ${fmtMins(today.start)}` };
  for (let i = 1; i <= 7; i++) {
    const r = range(day + i);
    if (r) return { open: false, text: `Closed · opens ${i === 1 ? 'tomorrow' : DAYS[(day + i) % 7]} ${fmtMins(r.start)}` };
  }
  return { open: false, text: 'Closed' };
};

const safeUrl = (u: string | null) => {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export const CampusFacilities: React.FC = () => {
  const { currentUser, refreshFromSupabase, showToast } = useApp();
  const uni = currentUser?.university;

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [favs, setFavs] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // booking paste
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<BookingPreview | null>(null);
  const [remind, setRemind] = useState('30 min');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id || !uni || uni === 'independent') return setLoading(false);
    (async () => {
      const [{ data: f }, { data: fv }] = await Promise.all([
        supabase.from('facilities').select('*').eq('university', uni).order('sort'),
        supabase.from('facility_favourites').select('facility_id').eq('user_id', currentUser.id)
      ]);
      setFacilities((f ?? []) as Facility[]);
      setFavs(new Set((fv ?? []).map((r: any) => r.facility_id)));
      setLoading(false);
    })();
    // re-evaluate "open now" every minute
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [currentUser?.id, uni]);

  const sorted = useMemo(
    () => [...facilities].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.sort - b.sort),
    [facilities, favs]
  );

  const toggleFav = async (id: number) => {
    if (!currentUser?.id) return;
    const isFav = favs.has(id);
    setFavs((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(id) : next.add(id);
      return next;
    });
    const { error: err } = isFav
      ? await supabase.from('facility_favourites').delete().eq('user_id', currentUser.id).eq('facility_id', id)
      : await supabase.from('facility_favourites').insert({ user_id: currentUser.id, facility_id: id });
    if (err) showToast(`Couldn't save favourite: ${err.message}`);
  };

  const readBooking = async () => {
    setReading(true);
    setError(null);
    const { data, error: err } = await invokeEdge('extract-event', { text, kind: 'booking' });
    setReading(false);
    if (err) return setError(err.message);
    setPreview((data.events || [])[0] || null);
    if (!data.events?.length) setError("Couldn't find a booking date and time in that message.");
  };

  const addBooking = async () => {
    if (!preview || !currentUser?.id) return;
    const { data, error: err } = await supabase
      .from('events')
      .insert({
        title: preview.title,
        event_date: preview.event_date,
        end_date: preview.end_date,
        location: preview.location || '',
        source: 'booking',
        created_by: currentUser.id
      })
      .select('id')
      .single();
    if (err) return showToast(`Couldn't add: ${err.message}`);
    await supabase.from('user_event_interest').insert({
      user_id: currentUser.id,
      event_id: data.id,
      reminder_set: remind !== 'none',
      reminder_timing: remind === 'none' ? null : remind,
      registered: true
    });
    showToast('Booking added to your calendar');
    setPasteOpen(false);
    setText('');
    setPreview(null);
    await refreshFromSupabase();
  };

  if (!uni || uni === 'independent') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-600">
        Campus facilities appear when you sign in with your school email (e.g. @smu.edu.sg).
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 font-display">Campus facilities</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Booking links and opening hours. Availability is shown on {uni}'s own booking site.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPasteOpen(true)}
          className="px-3 py-2 rounded-lg bg-white border border-gray-300 text-xs font-semibold text-gray-900 hover:border-[#D4A94F] flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">event_available</span>
          Add a booking
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-600">No facilities listed for {uni} yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((f) => {
            const status = openStatus(f.hours);
            const url = safeUrl(f.booking_url);
            const fav = favs.has(f.id);
            return (
              <div key={f.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{f.name}</p>
                    {f.building && <p className="text-xs text-gray-500">{f.building}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFav(f.id)}
                    aria-pressed={fav}
                    aria-label={fav ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
                    className={fav ? 'text-[#D4A94F]' : 'text-gray-400 hover:text-[#D4A94F]'}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: fav ? "'FILL' 1" : "'FILL' 0" }}>
                      star
                    </span>
                  </button>
                </div>
                {status ? (
                  <p className={`text-xs font-semibold flex items-center gap-1 ${status.open ? 'text-emerald-700' : 'text-gray-500'}`}>
                    <span className="material-symbols-outlined text-[14px]">{status.open ? 'schedule' : 'do_not_disturb_on'}</span>
                    {status.text}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Hours not listed</p>
                )}
                {f.description && <p className="text-xs text-gray-600">{f.description}</p>}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="self-end text-xs font-bold text-[#363FEF] flex items-center gap-1 hover:underline"
                  >
                    Book on {uni} site
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pasteOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setPasteOpen(false)}>
          <div
            role="dialog"
            aria-label="Add a booking"
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900">Add a booking</h2>
            {!preview ? (
              <>
                <p className="text-xs text-gray-500">
                  Paste your booking confirmation. Only the place, date and time are kept; booking references and the rest
                  of the message are discarded.
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  aria-label="Booking confirmation text"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#D4A94F]"
                />
                {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setPasteOpen(false)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reading || text.trim().length < 30}
                    onClick={readBooking}
                    className="px-4 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
                  >
                    {reading ? 'Reading…' : 'Read booking'}
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-1.5">
                <p className="font-semibold text-gray-900">{preview.title}</p>
                {preview.location && <p className="text-sm text-gray-700">{preview.location}</p>}
                <p className="text-sm text-gray-900">
                  {new Date(preview.event_date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {preview.end_date ? `–${new Date(preview.end_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                </p>
                {preview.date_evidence && <p className="text-xs text-gray-500">From the message: “{preview.date_evidence}”</p>}
                {preview.warnings.map((w) => (
                  <p key={w} className="text-xs text-[#92400E]">⚠ {w}</p>
                ))}
                <label className="text-xs font-semibold text-gray-900 flex items-center gap-2 mt-1">
                  Remind me
                  <select value={remind} onChange={(e) => setRemind(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-xs font-normal">
                    <option value="30 min">30 min before</option>
                    <option value="1 hour">1 hour before</option>
                    <option value="1 day">1 day before</option>
                    <option value="none">No reminder</option>
                  </select>
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setPreview(null)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold">
                    Back
                  </button>
                  <button type="button" onClick={addBooking} className="px-4 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold">
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
