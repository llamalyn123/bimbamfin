import { supabase } from './supabase';

export type EdgeError = { code: string; message: string; skipped?: { name: string; reason: string }[] };

/**
 * Calls a Supabase Edge Function as the signed-in student and normalises
 * errors to { code, message } so screens can show the message as-is.
 */
export async function invokeEdge<T = any>(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: EdgeError | null }> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return { data: data as T, error: null };

  try {
    // FunctionsHttpError keeps the Response in `context`
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === 'function') {
      const parsed = await ctx.json();
      if (parsed?.error?.message) return { data: null, error: parsed.error as EdgeError };
    }
  } catch {
    /* fall through */
  }
  return {
    data: null,
    error: { code: 'NETWORK', message: 'Could not reach Bimbam. Check your connection and try again.' }
  };
}
