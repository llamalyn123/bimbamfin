import { useSyncExternalStore } from 'react';

/**
 * Background jobs (note and quiz generation). They live outside the screens,
 * so moving to another screen doesn't cancel them, and coming back shows "still working".
 * The AI work itself runs on the server, so the result is saved even if the phone locks.
 */
export type Job = { id: string; kind: 'note' | 'quiz'; label: string; startedAt: number };
const running = new Map<string, { job: Job; promise: Promise<unknown> }>();
const listeners = new Set<() => void>();
let snapshot: Job[] = [];
const emit = () => {
  snapshot = [...running.values()].map((r) => r.job);
  listeners.forEach((l) => l());
};
const sub = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function runJob<T>(job: Omit<Job, 'startedAt'>, fn: () => Promise<T>): Promise<T> {
  const existing = running.get(job.id);
  if (existing) return existing.promise as Promise<T>;
  const promise = fn().finally(() => {
    running.delete(job.id);
    emit();
  });
  running.set(job.id, { job: { ...job, startedAt: Date.now() }, promise });
  emit();
  return promise;
}

export const useJobs = () => useSyncExternalStore(sub, () => snapshot, () => snapshot);
export const useJob = (id: string) => useJobs().find((j) => j.id === id) ?? null;
export const useJobOfKind = (kind: Job['kind']) => useJobs().find((j) => j.kind === kind) ?? null;
