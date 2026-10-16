export type GreetingTimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Computes greeting time slot according to student's local device time:
 * - 05:00–11:59 -> morning
 * - 12:00–16:59 -> afternoon
 * - 17:00–21:59 -> evening
 * - 22:00–04:59 -> night
 */
export function getGreetingTimeSlot(date: Date = new Date()): GreetingTimeSlot {
  const hours = date.getHours();
  if (hours >= 5 && hours < 12) {
    return 'morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'afternoon';
  }
  if (hours >= 17 && hours < 22) {
    return 'evening';
  }
  return 'night';
}

/**
 * Extracts first word of profiles.full_name for the logged-in user.
 * If missing, empty, or whitespace, returns null.
 * Strictly never returns placeholders like "Alex".
 */
export function extractFirstName(fullName?: string | null): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord || null;
}

/**
 * Formats localized greeting using the UI translation table:
 * If name is present: "Good morning, {name}", "Alex，早上好", etc.
 * If name is missing: "Good morning", "早上好", "Still up?", "还没睡吗？"
 */
export function getLocalizedGreeting(
  timeSlot: GreetingTimeSlot,
  name: string | null | undefined,
  t: (key: string, fallback?: string) => string
): string {
  const cleanName = name?.trim();
  const hasName = Boolean(cleanName);

  const key = hasName ? `greeting_${timeSlot}` : `greeting_${timeSlot}_anon`;

  const fallbacks: Record<string, string> = {
    greeting_morning: 'Good morning, {name}',
    greeting_morning_anon: 'Good morning',
    greeting_afternoon: 'Good afternoon, {name}',
    greeting_afternoon_anon: 'Good afternoon',
    greeting_evening: 'Good evening, {name}',
    greeting_evening_anon: 'Good evening',
    greeting_night: 'Still up, {name}?',
    greeting_night_anon: 'Still up?'
  };

  const template = t(key, fallbacks[key] || 'Good morning');
  if (hasName) {
    return template.replace('{name}', cleanName!);
  }
  return template;
}
