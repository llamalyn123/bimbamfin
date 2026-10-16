import React, { useState } from 'react';
import { CapyError } from './CapyStates';
import { invokeEdge } from '../lib/edge';
import { Capy } from './Capy';

type Issue = { quote: string; type: string; rule: string; hint: string; alternatives: string[] };
type Polish = { summary: string; strengths: string[]; issues: Issue[] };
type Recheck = { fixed: boolean; comment: string };

const TYPE_LABEL: Record<string, string> = {
  grammar: 'Grammar',
  tense: 'Tense',
  article: 'a / an / the',
  agreement: 'Agreement',
  punctuation: 'Punctuation',
  run_on: 'Run-on sentence',
  fragment: 'Incomplete sentence',
  word_choice: 'Word choice',
  formality: 'Too informal',
  clarity: 'Clarity',
  spelling: 'Spelling'
};

/**
 * "Polish my English": language coaching that keeps the writing the student's own.
 * 1. Each issue quoted + the rule explained (no corrected sentence).
 * 2. Thesaurus-style word options for weak words only.
 * 3. "Try your fix": the student rewrites the bit themselves and Capy re-checks it.
 */
export const PolishEnglish: React.FC<{ noteId: string; language: string }> = ({ noteId, language }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Polish | null>(null);
  const [tries, setTries] = useState<Record<number, string>>({});
  const [checks, setChecks] = useState<Record<number, Recheck | 'busy'>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setTries({});
    setChecks({});
    const { data, error: err } = await invokeEdge<Polish>('discuss', { note_id: noteId, mode: 'polish', language, text });
    setBusy(false);
    if (err || !data) return setError(err?.message ?? 'Something went wrong.');
    setResult(data);
  };

  const recheck = async (i: number, it: Issue) => {
    const attempt = (tries[i] ?? '').trim();
    if (!attempt) return;
    setChecks((c) => ({ ...c, [i]: 'busy' }));
    const { data, error: err } = await invokeEdge<Recheck>('discuss', {
      note_id: noteId,
      mode: 'recheck',
      language,
      quote: it.quote,
      issue_type: it.type,
      rule: it.rule,
      attempt
    });
    setChecks((c) => ({ ...c, [i]: err || !data ? { fixed: false, comment: err?.message ?? "Couldn't check right now." } : data }));
  };

  const copy = async (w: string) => {
    try {
      await navigator.clipboard.writeText(w);
      setCopied(w);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const fixedCount = Object.values(checks).filter((c) => c !== 'busy' && c.fixed).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[#64748B]">
        Paste your own English writing. Capy explains each language issue and the rule behind it, then you write the fix and Capy checks it. It never rewrites your sentences.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="Paste a paragraph or two of your writing in English."
        aria-label="Your writing to polish"
        className="w-full px-3 py-2 rounded-xl border border-[#C9D1DB] text-sm focus:outline-none focus:border-[#D4A94F]"
      />
      {error && <CapyError compact message={error} />}
      <button
        type="button"
        onClick={run}
        disabled={busy || text.trim().length < 40}
        className="self-end px-5 py-2 rounded-xl bg-[#D4A94F] hover:bg-[#c7993a] text-[#0E0E12] font-bold disabled:opacity-50 flex items-center gap-2"
      >
        {busy && <Capy size={22} mood="thinking" searching />}
        {busy ? 'Capy is reading your English…' : 'Check my English'}
      </button>

      {result && (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex gap-2 items-start">
            <Capy size={34} mood={result.issues.length === 0 ? 'sparkle' : 'oops'} react />
            <p className="text-[#1E293B]">
              <span className="block text-[10px] font-bold text-[#8B5E2F]">Capy</span>
              {result.summary}
            </p>
          </div>

          {result.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700">What works</p>
              <ul className="list-disc pl-5 text-[#334155]">
                {result.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.issues.length > 0 && (
            <p className="text-xs text-[#64748B]">
              {fixedCount} of {result.issues.length} fixed by you
            </p>
          )}

          {result.issues.map((it, i) => {
            const chk = checks[i];
            const done = chk && chk !== 'busy' && chk.fixed;
            return (
              <div key={i} className={`px-3 py-2.5 rounded-xl border ${done ? 'border-emerald-300 bg-emerald-50' : 'border-[#C7D2FE] bg-[#F8FAFF]'} flex flex-col gap-1.5`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#3730A3] text-[11px] font-bold">{TYPE_LABEL[it.type] ?? 'Check this'}</span>
                  {done && <span className="text-[11px] font-bold text-emerald-700">✓ Fixed</span>}
                </div>
                <p className="text-[#64748B] italic">“{it.quote}”</p>
                <p className="text-[#1E293B]">
                  <b className="text-xs text-[#3730A3]">Rule: </b>
                  {it.rule}
                </p>
                {it.hint && (
                  <p className="text-[#334155]">
                    <b className="text-xs text-[#92400E]">Hint: </b>
                    {it.hint}
                  </p>
                )}
                {it.alternatives.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-[#64748B]">Word options:</span>
                    {it.alternatives.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => copy(w)}
                        title="Copy"
                        className="px-2 py-0.5 rounded-full border border-[#C9D1DB] bg-white text-xs text-[#0E0E12] hover:border-[#D4A94F]"
                      >
                        {copied === w ? 'Copied ✓' : w}
                      </button>
                    ))}
                  </div>
                )}
                {!done && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <textarea
                      value={tries[i] ?? ''}
                      onChange={(e) => setTries((t) => ({ ...t, [i]: e.target.value }))}
                      rows={2}
                      placeholder="Try your fix: rewrite this bit yourself"
                      aria-label={`Your fix for issue ${i + 1}`}
                      className="w-full px-3 py-1.5 rounded-lg border border-[#C9D1DB] text-sm bg-white focus:outline-none focus:border-[#D4A94F] resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => recheck(i, it)}
                      disabled={chk === 'busy' || !(tries[i] ?? '').trim()}
                      className="self-end px-3 py-1 rounded-lg bg-[#0E0E12] text-white text-xs font-semibold disabled:opacity-40"
                    >
                      {chk === 'busy' ? 'Checking…' : 'Check my fix'}
                    </button>
                  </div>
                )}
                {chk && chk !== 'busy' && (
                  <div className="flex items-start gap-2">
                    <Capy size={24} mood={chk.fixed ? 'sparkle' : 'thinking'} react />
                    <p className={chk.fixed ? 'text-emerald-800' : 'text-[#92400E]'}>{chk.comment}</p>
                  </div>
                )}
              </div>
            );
          })}

          <p className="text-[11px] text-[#64748B]">
            Language coaching only. Every sentence stays yours. Check your course's rules on using AI for assessed work.
          </p>
        </div>
      )}
    </div>
  );
};
