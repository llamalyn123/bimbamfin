/** Human label for where a deadline came from. */
export const sourceLabel = (source: unknown) => {
  const s = String(source ?? '');
  if (s.startsWith('ics')) return 'School calendar';
  if (s === 'group') return 'Study group';
  if (s === 'manual' || s === 'Added by you' || !s) return 'Added by you';
  return s;
};
