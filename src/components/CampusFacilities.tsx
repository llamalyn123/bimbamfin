import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { invokeEdge } from '../lib/edge';
import { prepareImage, type PickedImage } from '../lib/image';

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
  const [image, setImage] = useState<PickedImage | null>(null);
  const [previews, setPreviews] = useState<(BookingPreview & { keep: boolean })[] | null>(null);
  const [adding, setAdding] = useState(false);
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

  // the student's own bookings (added from confirmations or "Add a booking")
  type MyBooking = { id: string; title: string; event_date: string; end_date: string | null; location: string | null };
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [showPast, setShowPast] = useState(false);
  const loadBookings = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase
      .from('events')
      .select('id,title,event_date,end_date,location')
      .eq('source', 'booking')
      .eq('created_by', currentUser.id)
      .order('event_date', { ascending: true })
      .limit(100);
    setBookings((data ?? []) as MyBooking[]);
  };
  useEffect(() => {
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
  const isPast = (b: MyBooking) => new Date(b.end_date || b.event_date).getTime() < Date.now();
  const upcoming = bookings.filter((b) => !isPast(b));
  const past = bookings.filter(isPast).reverse();
  const removeBooking = async (b: MyBooking) => {
    if (!window.confirm(`Remove "${b.title}" from Bimbam? This doesn't cancel it on ${uni}'s booking site.`)) return;
    const { error: err } = await supabase.from('events').delete().eq('id', b.id);
    if (err) return showToast(`Couldn't remove: ${err.message}`);
    setBookings((bs) => bs.filter((x) => x.id !== b.id));
    showToast('Booking removed');
    refreshFromSupabase();
  };
  const bookingName = (t: string) => t.replace(/^Booking:\s*/i, '');
  const bookingWhen = (b: MyBooking) => {
    const s = new Date(b.event_date);
    const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return { day, time: b.end_date ? `${t(s)}–${t(new Date(b.end_date))}` : t(s) };
  };
  const daysAway = (iso: string) => {
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const n = Math.round((startOf(new Date(iso)) - startOf(new Date())) / 86_400_000);
    return n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
  };

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

  const closePaste = () => {
    setPasteOpen(false);
    setText('');
    setImage(null);
    setPreviews(null);
    setError(null);
  };

  const pickImage = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const readOne = async (t: string, img: PickedImage | null) => {
    const body: Record<string, unknown> = { kind: 'booking' };
    if (t.trim()) body.text = t.trim();
    if (img) body.image = { data: img.data, media_type: img.media_type };
    const { data, error: err } = await invokeEdge('extract-event', body);
    if (err) throw new Error(err.message);
    return (data?.events || []) as BookingPreview[];
  };

  const readBooking = async () => {
    setReading(true);
    setError(null);
    try {
      const list = await readOne(text, image);
      if (!list.length) return setError("Couldn't find a booking date and time in that confirmation.");
      setPreviews(list.map((p) => ({ ...p, keep: true })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  /** Drop box: screenshots, PDFs or saved emails (.eml/.txt/.html). Read straight away; several files at once is fine. */
  const takeFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).slice(0, 5);
    if (!list.length) return;
    setPasteOpen(true);
    setPreviews(null);
    setError(null);
    setReading(true);
    const found: BookingPreview[] = [];
    const problems: string[] = [];
    for (const f of list) {
      try {
        if (/\.(eml|txt|html?)$/i.test(f.name) || f.type.startsWith('text/')) {
          let t = await f.text();
          if (/\.html?$/i.test(f.name) || /<html/i.test(t)) t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
          t = t.replace(/=\r?\n/g, '').replace(/[ \t]+/g, ' ').slice(0, 19_000);
          found.push(...(await readOne(t, null)));
        } else {
          const img = await prepareImage(f);
          if (list.length === 1) setImage(img);
          found.push(...(await readOne('', img)));
        }
      } catch (e) {
        problems.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setReading(false);
    if (found.length) setPreviews(found.map((p) => ({ ...p, keep: true })));
    if (problems.length) setError(problems.join(' · '));
    else if (!found.length) setError("Couldn't find a booking date and time in that confirmation.");
  };
  const [dragging, setDragging] = useState(false);
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      takeFiles(e.dataTransfer.files);
    }
  };

  const addBookings = async () => {
    if (!previews || !currentUser?.id) return;
    const chosen = previews.filter((p) => p.keep);
    if (!chosen.length) return;
    setAdding(true);
    let ok = 0;
    let dupes = 0;
    for (const p of chosen) {
      // Same room at the same time already saved? Skip it (stops double entries when a confirmation is dropped twice).
      const same = bookings.some((b) => b.title === p.title && new Date(b.event_date).getTime() === new Date(p.event_date).getTime());
      if (same) {
        dupes++;
        continue;
      }
      const { data, error: err } = await supabase
        .from('events')
        .insert({
          title: p.title,
          event_date: p.event_date,
          end_date: p.end_date,
          location: p.location || '',
          source: 'booking',
          created_by: currentUser.id
        })
        .select('id')
        .single();
      if (err) {
        showToast(`Couldn't add "${p.title}": ${err.message}`);
        continue;
      }
      await supabase.from('user_event_interest').insert({
        user_id: currentUser.id,
        event_id: data.id,
        reminder_set: remind !== 'none',
        reminder_timing: remind === 'none' ? null : remind,
        registered: true
      });
      ok++;
    }
    setAdding(false);
    if (ok || dupes)
      showToast(
        [ok ? `${ok} booking${ok === 1 ? '' : 's'} added to your calendar` : '', dupes ? `${dupes} already saved, skipped` : ''].filter(Boolean).join(' · ')
      );
    closePaste();
    loadBookings();
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

      <label
        {...dropProps}
        className={`flex flex-col sm:flex-row items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${
          dragging ? 'border-[#D4A94F] bg-[#FFFBEB]' : 'border-gray-300 hover:border-[#D4A94F]'
        }`}
      >
        <span className="material-symbols-outlined text-[26px] text-[#D4A94F]">move_to_inbox</span>
        <span className="text-sm text-gray-700">
          <b>Drop booking confirmations here</b> or click to choose
          <span className="block text-xs text-gray-500">Screenshots, PDFs or saved emails (.eml). Several at once is fine. Only place, date and time are kept.</span>
        </span>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,.eml,.txt,.html,.htm"
          className="sr-only"
          onChange={(e) => {
            takeFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      <section aria-label="Your bookings" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#7C3AED]">meeting_room</span>
            Your bookings
            {upcoming.length > 0 && <span className="text-xs font-semibold text-gray-500">({upcoming.length} upcoming)</span>}
          </h3>
          {past.length > 0 && (
            <button type="button" onClick={() => setShowPast((v) => !v)} className="text-xs font-semibold text-gray-500 hover:text-gray-900">
              {showPast ? 'Hide past' : `Show past (${past.length})`}
            </button>
          )}
        </div>
        {upcoming.length === 0 && !showPast ? (
          <p className="text-xs text-gray-500">No upcoming bookings. Drop a confirmation above and it shows up here and on your calendar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...upcoming, ...(showPast ? past : [])].map((b) => {
              const w = bookingWhen(b);
              const old = isPast(b);
              return (
                <li
                  key={b.id}
                  className={`p-3 rounded-xl border border-gray-200 bg-gray-50 border-l-4 border-l-[#7C3AED] flex items-center gap-3 ${old ? 'opacity-60' : ''}`}
                >
                  <div className="flex flex-col items-center justify-center w-14 shrink-0 text-center">
                    <span className="text-[10px] font-bold uppercase text-[#7C3AED]">{w.day.split(' ')[0]}</span>
                    <span className="text-lg font-bold text-gray-900 leading-none">{new Date(b.event_date).getDate()}</span>
                    <span className="text-[10px] text-gray-500">{new Date(b.event_date).toLocaleDateString([], { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{bookingName(b.title)}</p>
                    <p className="text-xs text-gray-600">
                      {w.time}
                      {!old && <span className="ml-2 font-semibold text-[#7C3AED]">{daysAway(b.event_date)}</span>}
                      {old && <span className="ml-2">Done</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBooking(b)}
                    aria-label={`Remove ${bookingName(b.title)}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={closePaste}>
          <div
            role="dialog"
            aria-label="Add a booking"
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900">Add a booking</h2>
            {!previews ? (
              <>
                <p className="text-xs text-gray-500">
                  Paste your booking confirmation, or add a screenshot of it. Tables work, and so do several bookings at once.
                  Only the place, date and time are kept; booking references and the rest are discarded.
                </p>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder="Paste the confirmation here"
                  aria-label="Booking confirmation text"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-[#D4A94F]"
                />
                {image ? (
                  <div className="flex items-center gap-3 p-2 rounded-xl border border-gray-200">
                    {image.preview ? (
                      <img src={image.preview} alt="" className="w-14 h-14 object-cover rounded-lg" />
                    ) : (
                      <span className="material-symbols-outlined text-[28px] text-gray-500">picture_as_pdf</span>
                    )}
                    <span className="text-sm text-gray-800 truncate flex-1">{image.name}</span>
                    <button type="button" onClick={() => setImage(null)} className="text-xs text-gray-500 hover:text-red-600">
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    {...dropProps}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed text-sm font-semibold text-gray-700 cursor-pointer ${
                      dragging ? 'border-[#D4A94F] bg-[#FFFBEB]' : 'border-gray-300 hover:border-[#D4A94F]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    Drop or add a screenshot, PDF or saved email
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.eml,.txt,.html,.htm"
                      className="sr-only"
                      onChange={(e) => {
                        const fs = e.target.files;
                        if (fs && fs.length === 1 && /^(image\/|application\/pdf)/.test(fs[0].type)) pickImage(fs[0]);
                        else takeFiles(fs);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closePaste} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={reading || (!image && text.trim().length < 30)}
                    onClick={readBooking}
                    className="px-4 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
                  >
                    {reading ? 'Reading…' : 'Read booking'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500">
                  Found {previews.length} booking{previews.length === 1 ? '' : 's'}. Check each date against the original, untick any you don't want.
                </p>
                {previews.map((p, i) => (
                  <label key={i} className={`rounded-xl border p-3 flex gap-3 cursor-pointer ${p.keep ? 'border-[#D4A94F]' : 'border-gray-200 opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={p.keep}
                      onChange={(e) => setPreviews((ps) => ps!.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                      className="mt-1 w-4 h-4"
                    />
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-semibold text-gray-900">{p.title}</span>
                      {p.location && <span className="text-sm text-gray-700">{p.location}</span>}
                      <span className="text-sm text-gray-900">
                        {new Date(p.event_date).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {p.end_date ? `–${new Date(p.end_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                      </span>
                      {p.date_evidence && <span className="text-xs text-gray-500">From the confirmation: “{p.date_evidence}”</span>}
                      {p.warnings.map((w) => (
                        <span key={w} className="text-xs text-[#92400E]">⚠ {w}</span>
                      ))}
                    </span>
                  </label>
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
                  <button type="button" onClick={() => setPreviews(null)} className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold">
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={adding || !previews.some((p) => p.keep)}
                    onClick={addBookings}
                    className="px-4 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] text-sm font-bold disabled:opacity-50"
                  >
                    {adding ? 'Adding…' : `Add ${previews.filter((p) => p.keep).length}`}
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
