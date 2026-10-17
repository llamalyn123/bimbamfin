// Core calendar sync, shared by sync-deadlines (student-triggered) and
// cron-sync (scheduled). Always scoped to ONE userId: every read and write
// filters on user_id, so it is safe even with the service-role client.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./common.ts";
import { DEFAULT_TZ, expandOccurrences, parseICS, splitCourse } from "./ics.ts";

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-SG", {
    timeZone: DEFAULT_TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));

const EXAM_WORDS = /\b(exams?|examination|finals?|mid-?terms?)\b/i;

/**
 * Policy: a school calendar is a TIMETABLE.
 *  - exam slots      -> "exam" (exam countdown; never shown in Due soon)
 *  - timed sessions  -> classes (calendar / Next class)
 *  - anything else (all-day or zero-length markers) -> skipped
 * Real deadlines come only from the course outline, the Telegram bot, or the student.
 */
function classify(ev: ReturnType<typeof parseICS>[number], title: string): "exam" | "class" | "skip" {
  const text = `${title} ${ev.summary ?? ""}`;
  if (EXAM_WORDS.test(text)) return "exam";
  if (ev.rrule || ev.recurrenceId !== undefined) return "class";
  if (ev.allDay || !ev.start) return "skip";
  if (ev.end && ev.end.getTime() - ev.start.getTime() < 10 * 60_000) return "skip";
  return "class";
}

const MAX_BYTES = 2_000_000;
const PAST_DAYS = 1;
const FUTURE_DAYS = 150;
const NEW_STATUS = Deno.env.get("DEADLINE_STATUS_DEFAULT") ?? "pending";

/** https only, no localhost / raw IPs / internal hostnames. webcal:// is accepted. */
export function normaliseUrl(raw: string): string {
  const s = String(raw).trim().replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new AppError(400, "BAD_URL", "That doesn't look like a calendar link.");
  }
  if (u.protocol !== "https:") throw new AppError(400, "BAD_URL", "Calendar links must start with https:// or webcal://");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")
  ) {
    throw new AppError(400, "BAD_URL", "That calendar address isn't allowed.");
  }
  return u.toString();
}

async function fetchFeed(feedUrl: string): Promise<string> {
  let text: string;
  try {
    const res = await fetch(feedUrl, {
      headers: { Accept: "text/calendar, text/plain;q=0.9" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new AppError(422, "FEED_UNREACHABLE", `Your calendar link returned an error (${res.status}). Check it's the full subscribe link.`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new AppError(422, "FEED_TOO_LARGE", "That calendar is too large to sync.");
    text = new TextDecoder().decode(buf);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(422, "FEED_UNREACHABLE", "Couldn't reach your calendar link. Check it and try again.");
  }
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new AppError(422, "NOT_ICS", "That link isn't a calendar feed. Look for a 'subscribe' link or one ending in .ics.");
  }
  return text;
}

export type SyncResult = {
  added: number;
  updated: number;
  removed: number;
  classes: number;
  changes?: number;
  skipped?: number;
  last_synced_at: string;
};

export async function syncFeed(supabase: SupabaseClient, userId: string, rawUrl: string): Promise<SyncResult> {
  const feedUrl = normaliseUrl(rawUrl);
  const stamp = new Date().toISOString();
  const saveStatus = (status: "ok" | "error", error: string | null) =>
    supabase.from("calendar_feeds").upsert({
      user_id: userId, url: feedUrl, last_synced_at: stamp, last_status: status, last_error: error,
    });
  try {
    const result = await applyIcs(supabase, userId, await fetchFeed(feedUrl), "ics");
    await saveStatus("ok", null);
    return result;
  } catch (e) {
    await saveStatus("error", e instanceof AppError ? e.message : "Sync failed.");
    throw e;
  }
}

/**
 * Writes one calendar's contents for one student. `source` keeps different
 * calendars apart: "ics" = subscribed link, "ics-file" = uploaded file.
 */
export async function applyIcs(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  source: "ics" | "ics-file",
): Promise<SyncResult> {
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new AppError(422, "NOT_ICS", "That isn't a calendar file. Look for a file ending in .ics.");
  }
  const stamp = new Date().toISOString();
  const tag = source === "ics" ? "ics" : "icsf";
  const events = parseICS(text);
  const now = Date.now();
  const from = now - PAST_DAYS * 864e5;
  const to = now + FUTURE_DAYS * 864e5;

  // Modified single instances of recurring classes replace the original slot
  const overridden = new Set(
    events.filter((e) => e.recurrenceId !== undefined).map((e) => `${e.uid}|${e.recurrenceId}`),
  );

  const deadlineRows: Record<string, unknown>[] = [];
  const classRows: Record<string, unknown>[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const ev of events) {
    if (!ev.start || !ev.summary || ev.status === "CANCELLED") continue;
    const { title, course } = splitCourse(ev.summary);
    const kind = classify(ev, title);
    if (kind === "skip") { skipped++; continue; }

    if (kind === "class") {
      // Recurring = timetable -> `classes`
      const duration = ev.end ? ev.end.getTime() - ev.start.getTime() : 0;
      const starts = ev.rrule ? expandOccurrences(ev, from, to) : (
        ev.start.getTime() >= from && ev.start.getTime() <= to ? [ev.start] : []
      );
      for (const s of starts) {
        if (ev.rrule && overridden.has(`${ev.uid}|${s.getTime()}`)) continue;
        classRows.push({
          _moved: ev.recurrenceId !== undefined,
          user_id: userId,
          external_id: `${tag}:${ev.uid ?? ev.summary}|${s.toISOString()}`,
          course: course.slice(0, 100),
          title: title.slice(0, 300),
          starts_at: s.toISOString(),
          ends_at: new Date(s.getTime() + duration).toISOString(),
          location: ev.location?.slice(0, 200) ?? null,
          source,
        });
      }
      continue;
    }

    // Exam slot -> `deadlines` with type "exam" (countdown only)
    const t = ev.start.getTime();
    if (t < from || t > to) continue;
    const externalId = `${tag}:${ev.uid ?? `${ev.summary}|${ev.start.toISOString()}`}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    deadlineRows.push({
      user_id: userId,
      external_id: externalId,
      title: title.slice(0, 300),
      course: course.slice(0, 100),
      due_date: ev.start.toISOString(),
      type: "exam",
      source,
      last_updated: stamp,
    });
  }

  // ---- deadlines: insert new, update existing (keep their status), drop vanished future ones
  const { data: existing, error: exErr } = await supabase
    .from("deadlines")
    .select("id, external_id, due_date, title, course, manual_override")
    .eq("user_id", userId)
    .eq("source", source);
  if (exErr) throw exErr;
  const existingById = new Map((existing ?? []).map((e) => [e.external_id, e]));
  const newRows = deadlineRows.filter((r) => !existingById.has(r.external_id as string));
  // Items the student moved/cancelled by hand are never overwritten by a sync
  const changedRows = deadlineRows.filter((r) => {
    const old = existingById.get(r.external_id as string);
    return old && !old.manual_override;
  });
  const alerts: { user_id: string; kind: string; message: string }[] = [];
  for (const r of changedRows) {
    const old = existingById.get(r.external_id as string)!;
    if (Math.abs(new Date(old.due_date).getTime() - new Date(r.due_date as string).getTime()) > 60_000) {
      alerts.push({
        user_id: userId,
        kind: "moved",
        message: `${r.title} (${r.course}) moved: ${fmtWhen(old.due_date)} → ${fmtWhen(r.due_date as string)}`,
      });
    }
  }

  if (newRows.length) {
    const { error } = await supabase.from("deadlines").insert(newRows.map((r) => ({ ...r, status: NEW_STATUS })));
    if (error) throw error;
  }
  if (changedRows.length) {
    const { error } = await supabase.from("deadlines").upsert(changedRows, { onConflict: "user_id,external_id" });
    if (error) throw error;
  }
  const removedRows = (existing ?? [])
    .filter((e) => !seen.has(e.external_id) && !e.manual_override && new Date(e.due_date).getTime() > now);
  const toRemove = removedRows.map((e) => e.id);
  // Items that simply moved from "deadline" to "class" (better detection) aren't real removals
  const classUids = new Set(classRows.map((c) => String(c.external_id).split("|")[0]));
  for (const e of removedRows) {
    if (classUids.has(e.external_id)) continue;
    if (!EXAM_WORDS.test(String(e.title))) continue; // old non-exam calendar items: removed quietly
    alerts.push({
      user_id: userId,
      kind: "removed",
      message: `${e.title} (${e.course}, due ${fmtWhen(e.due_date)}) was removed from your school calendar`,
    });
  }
  if (toRemove.length) {
    const { error } = await supabase.from("deadlines").delete().in("id", toRemove);
    if (error) throw error;
  }

  // ---- classes: replace the upcoming window, re-applying the student's own overrides
  const { data: oldClasses } = await supabase
    .from("classes")
    .select("external_id, title, course, starts_at")
    .eq("user_id", userId)
    .eq("source", source)
    .gte("starts_at", new Date(now).toISOString());
  const { data: overrides } = await supabase
    .from("class_overrides")
    .select("external_id, action, new_starts_at, new_ends_at")
    .eq("user_id", userId);
  const overrideById = new Map((overrides ?? []).map((o) => [o.external_id, o]));
  const oldIds = new Set((oldClasses ?? []).map((c) => c.external_id));
  const newIds = new Set(classRows.map((c) => c.external_id as string));
  const soon = now + 21 * 864e5;

  if (oldIds.size > 0) {
    for (const c of oldClasses ?? []) {
      const t = new Date(c.starts_at).getTime();
      if (!newIds.has(c.external_id) && !overrideById.has(c.external_id) && t < soon) {
        alerts.push({
          user_id: userId,
          kind: "class_removed",
          message: `${c.course || c.title} on ${fmtWhen(c.starts_at)} was removed (cancelled or moved)`,
        });
      }
    }
    for (const c of classRows) {
      const t = new Date(c.starts_at as string).getTime();
      if (c._moved && !oldIds.has(c.external_id as string) && t < soon) {
        alerts.push({ user_id: userId, kind: "class_moved", message: `${c.course || c.title} rescheduled to ${fmtWhen(c.starts_at as string)}` });
      }
    }
  }

  const finalClasses = classRows
    .filter((c) => overrideById.get(c.external_id as string)?.action !== "cancel")
    .map(({ _moved, ...c }) => {
      const o = overrideById.get(c.external_id as string);
      return o?.action === "move" ? { ...c, starts_at: o.new_starts_at, ends_at: o.new_ends_at } : c;
    });

  const { error: delErr } = await supabase
    .from("classes")
    .delete()
    .eq("user_id", userId)
    .eq("source", source)
    .gte("starts_at", new Date(from).toISOString());
  if (delErr) throw delErr;
  for (let i = 0; i < finalClasses.length; i += 500) {
    const { error } = await supabase.from("classes").insert(finalClasses.slice(i, i + 500));
    if (error) throw error;
  }

  // Only alert on re-syncs (not the very first import), and cap the noise
  if (alerts.length && ((existing ?? []).length > 0 || oldIds.size > 0)) {
    await supabase.from("change_alerts").insert(alerts.slice(0, 20));
  }

  return {
    added: newRows.length,
    updated: changedRows.length,
    removed: toRemove.length,
    classes: finalClasses.length,
    changes: alerts.length,
    skipped,
    last_synced_at: stamp,
  };
}
