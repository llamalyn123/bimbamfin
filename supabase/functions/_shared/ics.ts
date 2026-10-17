// Minimal, dependency-free iCalendar (.ics) parser + writer
// (Canvas, Brightspace/eLearn, Moodle, Google Calendar, Outlook).

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number };

export type ICalEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  status?: string;
  start?: Date;
  end?: Date;
  allDay?: boolean;
  startWall?: Wall;
  tz?: string | null; // null = UTC ("Z") time
  rrule?: Record<string, string>;
  exdates: Set<number>;
  recurrenceId?: number; // set on a modified single instance of a recurring event
  durationMs?: number;
};

export const DEFAULT_TZ = Deno.env.get("DEFAULT_TZ") ?? "Asia/Singapore";

function unfold(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function validTz(tz?: string): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null; // e.g. Outlook's "Singapore Standard Time"
  }
}

/** Offset (ms) of `tz` from UTC at instant `utcMs`. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` -> UTC Date. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off = tzOffsetMs(guess, tz);
  let t = guess - off;
  const off2 = tzOffsetMs(t, tz);
  if (off2 !== off) t = guess - off2;
  return new Date(t);
}

function wallToDate(w: Wall, tz: string | null): Date {
  return tz ? zonedToUtc(w.y, w.mo, w.d, w.h, w.mi, w.s, tz) : new Date(Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s));
}

function addDays(w: Wall, n: number): Wall {
  const t = new Date(Date.UTC(w.y, w.mo - 1, w.d + n));
  return { ...w, y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 0 = Monday ... 6 = Sunday */
function weekdayMon(w: Wall): number {
  return (new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay() + 6) % 7;
}

type Parsed = { date: Date; allDay: boolean; wall: Wall; tz: string | null };

function parseDate(v: string, params: Record<string, string>): Parsed | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const tz = validTz(params.TZID) ?? DEFAULT_TZ;
  if (h === undefined) {
    // All-day item: treat as due at 23:59 local time that day
    const wall = { y: +y, mo: +mo, d: +d, h: 23, mi: 59, s: 0 };
    return { date: wallToDate(wall, tz), allDay: true, wall, tz };
  }
  const wall = { y: +y, mo: +mo, d: +d, h: +h, mi: +mi, s: +(s ?? 0) };
  if (z) return { date: wallToDate(wall, null), allDay: false, wall, tz: null };
  return { date: wallToDate(wall, tz), allDay: false, wall, tz };
}

export function parseICS(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  let cur: ICalEvent | null = null;
  let nested = 0; // VALARM etc. inside an event

  for (const line of unfold(text).split("\n")) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") { cur = { exdates: new Set() }; nested = 0; continue; }
    if (upper === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (upper.startsWith("BEGIN:")) { nested++; continue; }
    if (upper.startsWith("END:")) { nested = Math.max(0, nested - 1); continue; }
    if (nested > 0) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const [name, ...paramParts] = line.slice(0, idx).split(";");
    const value = line.slice(idx + 1).trim();
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const [k, ...rest] = p.split("=");
      params[k.toUpperCase()] = rest.join("=").replace(/^"|"$/g, "");
    }

    switch (name.toUpperCase()) {
      case "UID": cur.uid = value; break;
      case "SUMMARY": cur.summary = unescapeText(value); break;
      case "DESCRIPTION": cur.description = unescapeText(value); break;
      case "LOCATION": cur.location = unescapeText(value); break;
      case "URL": cur.url = value; break;
      case "STATUS": cur.status = value.toUpperCase(); break;
      case "RRULE":
        cur.rrule = Object.fromEntries(value.split(";").map((kv) => {
          const [k, v] = kv.split("=");
          return [k.toUpperCase(), (v ?? "").toUpperCase()];
        }));
        break;
      case "EXDATE":
        for (const part of value.split(",")) {
          const d = parseDate(part.trim(), params);
          if (d) cur.exdates.add(d.date.getTime());
        }
        break;
      case "RECURRENCE-ID": {
        const d = parseDate(value, params);
        if (d) cur.recurrenceId = d.date.getTime();
        break;
      }
      case "DTSTART": {
        const d = parseDate(value, params);
        if (d) { cur.start = d.date; cur.allDay = d.allDay; cur.startWall = d.wall; cur.tz = d.tz; }
        break;
      }
      case "DTEND": {
        const d = parseDate(value, params);
        if (d) cur.end = d.date;
        break;
      }
      case "DURATION": {
        // Some exports give DURATION (e.g. PT1H30M) instead of DTEND
        const m = value.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
        if (m) {
          const [, w, d, h, mi, sec] = m.map((x) => Number(x || 0));
          cur.durationMs = ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + sec) * 1000;
        }
        break;
      }
    }
  }
  // Resolve DURATION into an end time
  for (const ev of events) {
    if (!ev.end && ev.start && ev.durationMs) ev.end = new Date(ev.start.getTime() + ev.durationMs);
  }
  return events;
}

const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/**
 * Occurrence start times of an event within [fromMs, toMs].
 * Supports FREQ=DAILY/WEEKLY with INTERVAL, COUNT, UNTIL, BYDAY and EXDATE —
 * enough for university timetables. Other rules fall back to the first instance.
 */
export function expandOccurrences(ev: ICalEvent, fromMs: number, toMs: number): Date[] {
  if (!ev.start || !ev.startWall) return [];
  const inWindow = (t: number) => t >= fromMs && t <= toMs && !ev.exdates.has(t);
  const r = ev.rrule;
  if (!r || (r.FREQ !== "WEEKLY" && r.FREQ !== "DAILY")) {
    return inWindow(ev.start.getTime()) ? [ev.start] : [];
  }

  const interval = Math.max(1, Number(r.INTERVAL) || 1);
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = Infinity;
  if (r.UNTIL) {
    const u = parseDate(r.UNTIL, {});
    if (u) until = u.date.getTime();
  }

  const out: Date[] = [];
  let produced = 0;
  const startMs = ev.start.getTime();
  const consider = (w: Wall): boolean => {
    const t = wallToDate(w, ev.tz ?? null).getTime();
    if (t < startMs) return true; // before series start: skip, keep going
    if (t > until || t > toMs) return false;
    produced++;
    if (produced > count) return false;
    if (inWindow(t)) out.push(new Date(t));
    return true;
  };

  const MAX_STEPS = 2000;
  if (r.FREQ === "DAILY") {
    for (let i = 0, steps = 0; steps < MAX_STEPS; i += interval, steps++) {
      if (!consider(addDays(ev.startWall, i))) break;
    }
    return out;
  }

  // WEEKLY
  const days = (r.BYDAY ? r.BYDAY.split(",") : [DAY_CODES[weekdayMon(ev.startWall)]])
    .map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, "")))
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const monday = addDays(ev.startWall, -weekdayMon(ev.startWall));
  outer:
  for (let week = 0, steps = 0; steps < MAX_STEPS; week += interval, steps++) {
    for (const d of days) {
      if (!consider(addDays(monday, week * 7 + d))) break outer;
    }
  }
  return out;
}

/** "Essay 2 [IS112 G1]" -> { title: "Essay 2", course: "IS112 G1" } (Canvas style). */
export function splitCourse(summary: string): { title: string; course: string } {
  const bracket = summary.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  if (bracket) return { title: bracket[1].trim() || summary, course: bracket[2].trim() };
  const code = summary.match(/\b([A-Z]{2,4}\s?-?\d{3,4}[A-Z]?)\b/);
  if (code) return { title: summary, course: code[1].replace(/[\s-]/g, "") };
  return { title: summary, course: "General" };
}

export function detectType(text: string): string {
  const t = text.toLowerCase();
  if (/\b(presentation|pitch|demo)\b/.test(t)) return "presentation";
  if (/\b(exams?|examination|finals|mid-?terms?)\b/.test(t)) return "exam";
  if (/\bquiz(zes)?\b/.test(t)) return "quiz";
  if (/\b(project|proposal|report)\b/.test(t)) return "project";
  return "assignment";
}

// ---------------- writer (for the outgoing phone-calendar feed) ----------------

function escapeText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export type OutEvent = {
  uid: string;
  start: Date;
  end?: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  alarms?: string[]; // ISO durations before start, e.g. "-P1D", "-PT2H"
};

export function buildICS(name: string, events: OutEvent[]): string {
  const stamp = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bimbam//Student Companion//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end ?? e.start)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    for (const a of e.alarms ?? []) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.summary)}`, `TRIGGER:${a}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
