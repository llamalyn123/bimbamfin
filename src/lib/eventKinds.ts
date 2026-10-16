import type { EventItem } from './supabase';

/** Admin/academic deadlines that arrive as "events" (course registration, add/drop, bidding, applications…). */
const DEADLINE_TITLE =
  /\b(registration|register|add\s*\/\s*drop|bidding|bids?|appeals?|withdraw(al)?|closing|closes|deadline|due|submission|submit|applications?|apply|last day|enrol+ment|enrol+|sign[- ]?ups?|cut-?off)\b/i;

export const isDeadlineEvent = (e: Pick<EventItem, 'title'> & { interest_tags?: string[] | null; source?: string | null }) =>
  e.source !== 'booking' && e.source !== 'group' && ((e.interest_tags || []).includes('deadline') || DEADLINE_TITLE.test(e.title || ''));

/** Tags for the Events filter: deadline-type events go under "Deadlines" (not "Career"). */
export const eventTags = (e: EventItem & { interest_tags?: string[] | null }) => {
  const tags = e.interest_tags || [];
  return isDeadlineEvent(e) ? ['deadline', ...tags.filter((t) => t !== 'deadline' && t !== 'career')] : tags;
};

export const tagLabel = (t: string) =>
  t === 'All' ? 'All' : t === 'deadline' ? 'Deadlines' : t === 'ai' ? 'AI' : t.charAt(0).toUpperCase() + t.slice(1);
