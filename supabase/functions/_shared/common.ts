// Shared helpers for Bimbam edge functions.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@1";
import { strFromU8, unzipSync } from "npm:fflate@0.8";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const LANGUAGES: Record<string, string> = {
  en: "English",
  zh: "Simplified Chinese",
  ta: "Tamil",
  de: "German",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Error shape the app relies on: { error: { code, message, ...extra } } */
export function fail(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return json({ error: { code, message, ...extra } }, status);
}

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Supabase client that acts AS the signed-in student, so every query and
 * storage download is filtered by RLS. One student can never read another
 * student's sources or notes, even if the request is tampered with.
 */
export async function getUserClient(
  req: Request,
): Promise<{ supabase: SupabaseClient; user: User }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AppError(401, "UNAUTHENTICATED", "Please sign in again.");
  return { supabase, user: data.user };
}

/** Rolling 24h limit per student. Logs the attempt if allowed. */
export async function useQuota(
  supabase: SupabaseClient,
  userId: string,
  kind: "note" | "quiz" | "event" | "explain" | "update" | "discuss" | "telegram" | "case",
): Promise<{ limit: number; remaining: number }> {
  const defaults = { note: 5, quiz: 15, event: 20, explain: 40, update: 20, discuss: 60, telegram: 40, case: 60 };
  const limit = Number(Deno.env.get(`DAILY_${kind.toUpperCase()}_LIMIT`) ?? defaults[kind]);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count, error } = await supabase
    .from("generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", since);
  if (error) throw error;

  const used = count ?? 0;
  if (used >= limit) {
    throw new AppError(
      429,
      "RATE_LIMITED",
      {
        note: `You've used today's ${limit} note generations. Your existing notes are all still here.`,
        quiz: `You've used today's ${limit} quizzes. Your notes are still here to review.`,
        event: `You've added ${limit} events from emails today. You can still add events by hand.`,
        explain: `You've used today's ${limit} "Go deeper" requests. Your notes are still here.`,
        update: `You've pasted ${limit} announcements today. You can still edit items by hand.`,
        discuss: `You've reached today's ${limit} discussion messages. Your notes are still here to review.`,
        telegram: `You've reached today's ${limit} Telegram requests. Try again tomorrow.`,
        case: `You've reached today's ${limit} case-study messages. Your case is still saved.`,
      }[kind],
    );
  }

  const { error: insErr } = await supabase
    .from("generation_log")
    .insert({ user_id: userId, kind });
  if (insErr) throw insErr;

  return { limit, remaining: limit - used - 1 };
}

// deno-lint-ignore no-explicit-any
type ContentBlock = Record<string, any>;

type AIOpts = {
  system: string;
  content: ContentBlock[]; // Claude-style blocks: text / document / image
  tool: { name: string; description: string; input_schema: ContentBlock };
  maxTokens: number;
  purpose: "note" | "quiz" | "event";
};

const BUSY_MSG = "The AI service is busy right now. Your saved notes are unchanged — try again in a minute.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Provider switch. Set the AI_PROVIDER secret to "gemini", "claude" or "openai".
 *   "openai" = ANY OpenAI-compatible LLM (OpenAI, APIYI, DeepSeek, Groq, OpenRouter, Mistral,
 *              Together, xAI, Qwen, Kimi...). Needs AI_BASE_URL, AI_API_KEY, AI_MODEL.
 * Two (or more) providers: list them in order, e.g. AI_PROVIDER = "openai,gemini".
 * The first one is used; if it's busy, down, or misconfigured (bad key/model), the next one answers.
 * Content problems (file can't be read, too long) are NOT retried elsewhere: they'd fail there too.
 * If unset: openai when AI_API_KEY exists, else Claude when ANTHROPIC_API_KEY exists, else Gemini.
 * All return the same shape, so the rest of the code never changes.
 */
const PROVIDERS = {
  claude: callClaude,
  openai: callOpenAICompat,
  gemini: callGemini,
} as const;
type ProviderName = keyof typeof PROVIDERS;

export function providerChain(): ProviderName[] {
  const raw = Deno.env.get("AI_PROVIDER") ??
    (Deno.env.get("AI_API_KEY") ? "openai" : Deno.env.get("ANTHROPIC_API_KEY") ? "claude" : "gemini");
  const list = raw.toLowerCase().split(/[\s,>|]+/).filter((p): p is ProviderName => p in PROVIDERS);
  return [...new Set(list.length ? list : (["gemini"] as ProviderName[]))];
}

// deno-lint-ignore no-explicit-any
export async function callAI(opts: AIOpts): Promise<{ input: any; model: string }> {
  try {
    return await callChain(opts);
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== "TRUNCATED") throw e;
    // The reply ran out of room (long notes, non-English scripts, model "thinking"): retry once with much more room
    console.error(`AI reply cut off at ${opts.maxTokens} tokens; retrying with more room`);
    try {
      return await callChain({ ...opts, maxTokens: Math.min(opts.maxTokens * 3, 12000) });
    } catch (e2) {
      if (e2 instanceof AppError && e2.code === "TRUNCATED") {
        throw new AppError(502, "BAD_OUTPUT", "Capy's answer got too long to finish. Try again, or pick one section or term instead of the whole note.");
      }
      throw e2;
    }
  }
}

// deno-lint-ignore no-explicit-any
async function callChain(opts: AIOpts): Promise<{ input: any; model: string }> {
  const chain = providerChain();
  let last: unknown;
  for (let i = 0; i < chain.length; i++) {
    try {
      return await PROVIDERS[chain[i]](opts);
    } catch (e) {
      last = e;
      const code = e instanceof AppError ? e.code : "";
      const tryNext = code === "AI_UNAVAILABLE" || code === "CONFIG" || !(e instanceof AppError);
      if (!tryNext || i === chain.length - 1) throw e;
      console.error(`AI provider "${chain[i]}" failed (${code || (e as Error)?.message}); trying "${chain[i + 1]}"`);
    }
  }
  throw last;
}

// ---------------- Any OpenAI-compatible LLM ----------------
/** PDFs -> page-labelled text, so text-only models still get slide/page numbers to cite. */
async function pdfToText(b64: string): Promise<string> {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  let text: string | string[];
  try {
    const pdf = await getDocumentProxy(bin);
    ({ text } = await extractText(pdf, { mergePages: false }));
  } catch (e) {
    console.error("pdfToText:", e instanceof Error ? e.message : e);
    throw new AppError(422, "AI_REJECTED", "Couldn't read the text in this PDF. Try re-exporting it, or upload the slides as .pptx.");
  }
  const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `[page ${i + 1}]\n${String(t).trim()}`);
  const joined = pages.join("\n\n");
  if (joined.replace(/\[page \d+\]|\s/g, "").length < 40) {
    throw new AppError(422, "AI_REJECTED", "This PDF looks scanned (no selectable text). Export it again with text, or upload it as images.");
  }
  return joined.slice(0, 400_000);
}

async function toOpenAIContent(blocks: ContentBlock[]): Promise<ContentBlock[]> {
  const out: ContentBlock[] = [];
  for (const b of blocks) {
    if (b.type === "text") out.push({ type: "text", text: b.text });
    else if (b.type === "image" && b.source?.type === "base64") {
      out.push({ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
    } else if (b.type === "document" && b.source?.type === "base64") {
      if (b.source.media_type === "application/pdf") {
        out.push({ type: "text", text: `PDF CONTENT:\n${await pdfToText(b.source.data)}` });
      } else {
        out.push({ type: "text", text: new TextDecoder().decode(Uint8Array.from(atob(b.source.data), (c) => c.charCodeAt(0))) });
      }
    }
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function callOpenAICompat(opts: AIOpts): Promise<{ input: any; model: string }> {
  const apiKey = Deno.env.get("AI_API_KEY");
  const base = (Deno.env.get("AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = (opts.purpose !== "note" ? Deno.env.get("AI_QUIZ_MODEL") : undefined) ?? Deno.env.get("AI_MODEL");
  if (!apiKey || !model) throw new AppError(500, "CONFIG", "AI is not configured yet (AI_API_KEY and AI_MODEL).");

  const content = await toOpenAIContent(opts.content);
  const hasImage = content.some((c) => c.type === "image_url");
  // Plain text only? Send a string: some providers reject the array form.
  const userContent = hasImage ? content : content.map((c) => c.text).join("\n\n");

  const withTools = {
    model,
    max_tokens: opts.maxTokens * 2,
    temperature: 0.3,
    messages: [{ role: "system", content: opts.system }, { role: "user", content: userContent }],
    tools: [{ type: "function", function: { name: opts.tool.name, description: opts.tool.description, parameters: opts.tool.input_schema } }],
    tool_choice: { type: "function", function: { name: opts.tool.name } },
  };
  // Fallback for models without tool calling: ask for JSON matching the schema.
  const jsonOnly = {
    model,
    max_tokens: opts.maxTokens * 2,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${opts.system}\n\nReply with ONE JSON object only, no prose, matching this JSON Schema:\n${JSON.stringify(opts.tool.input_schema)}`,
      },
      { role: "user", content: userContent },
    ],
  };

  const parseJson = (raw: string) => {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
  };

  let body: ContentBlock = withTools;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new AppError(502, "TRUNCATED", "The answer was too long to finish.");
      }
      const call = choice?.message?.tool_calls?.[0]?.function?.arguments;
      const raw = typeof call === "string" ? call : call ? JSON.stringify(call) : String(choice?.message?.content ?? "");
      try {
        return { input: parseJson(raw), model: data.model ?? model };
      } catch {
        console.error("LLM returned non-JSON:", raw.slice(0, 500));
        if (body === withTools) {
          body = jsonOnly;
          continue;
        }
        throw new AppError(502, "BAD_OUTPUT", "The AI reply was incomplete. Please try again.");
      }
    }

    const errText = await res.text();
    console.error(`LLM API ${res.status} (${model}): ${errText}`);
    if (res.status === 401 || res.status === 403) throw new AppError(500, "CONFIG", "The AI key was rejected. Check the AI_API_KEY secret.");
    if (res.status === 404) throw new AppError(500, "CONFIG", "The AI model or address wasn't found. Check AI_MODEL and AI_BASE_URL.");
    if (res.status === 400 || res.status === 422) {
      // Tool calling or json mode unsupported -> try the other format once
      if (body === withTools && /tool|function/i.test(errText)) {
        body = jsonOnly;
        continue;
      }
      if (body === jsonOnly && /response_format|json/i.test(errText)) {
        delete body.response_format;
        continue;
      }
      if (hasImage && /image/i.test(errText)) {
        throw new AppError(422, "AI_REJECTED", "This AI model can't read images. Paste the text instead, or switch to a model that reads images.");
      }
      throw new AppError(422, "AI_REJECTED", "The AI couldn't process this. Try a smaller file or plain text.");
    }
    if (res.status === 413) throw new AppError(422, "AI_REJECTED", "That was too much material at once. Try splitting it.");
    if (attempt < 3) await sleep(res.status === 429 ? 6000 : 2500);
  }
  throw new AppError(503, "AI_UNAVAILABLE", BUSY_MSG);
}

// ---------------- Claude ----------------
// deno-lint-ignore no-explicit-any
async function callClaude(opts: AIOpts): Promise<{ input: any; model: string }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new AppError(500, "CONFIG", "AI is not configured yet.");
  const model = (opts.purpose !== "note" ? Deno.env.get("CLAUDE_QUIZ_MODEL") : undefined) ??
    Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5";

  const body = {
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.content }],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.stop_reason === "max_tokens") {
        throw new AppError(502, "TRUNCATED", "The answer was too long to finish.");
      }
      const block = data.content?.find((b: ContentBlock) => b.type === "tool_use");
      if (!block?.input) throw new AppError(502, "BAD_OUTPUT", "The AI reply was incomplete. Please try again.");
      return { input: block.input, model: data.model };
    }

    console.error(`Claude API ${res.status}: ${await res.text()}`);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === 1) {
      if (res.status === 400 || res.status === 413) {
        throw new AppError(422, "AI_REJECTED", "One of the files couldn't be read. Try re-exporting it as PDF.");
      }
      throw new AppError(503, "AI_UNAVAILABLE", BUSY_MSG);
    }
    await sleep(2000);
  }
  throw new AppError(503, "AI_UNAVAILABLE", BUSY_MSG);
}

// ---------------- Gemini ----------------
/** JSON Schema -> Gemini responseSchema (uppercase types, supported keys only). */
function toGeminiSchema(s: ContentBlock): ContentBlock {
  const out: ContentBlock = { type: String(s.type).toUpperCase() };
  if (s.description) out.description = s.description;
  if (s.enum) out.enum = s.enum;
  if (s.required) out.required = s.required;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v as ContentBlock)]),
    );
  }
  return out;
}

function toGeminiParts(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((b) => {
    if (b.type === "text") return { text: b.text };
    if ((b.type === "document" || b.type === "image") && b.source?.type === "base64") {
      return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
    }
    return { text: "" };
  });
}

// deno-lint-ignore no-explicit-any
async function callGemini(opts: AIOpts): Promise<{ input: any; model: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new AppError(500, "CONFIG", "AI is not configured yet.");
  const primary = (opts.purpose !== "note" ? Deno.env.get("GEMINI_QUIZ_MODEL") : undefined) ??
    Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  const fallback = Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.1-flash-lite";
  // Busy (503) or rate-limited (429)? Retry once, then try the lighter fallback model.
  const plan = primary === fallback ? [primary, primary, primary] : [primary, primary, fallback, fallback];

  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: toGeminiParts(opts.content) }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(opts.tool.input_schema),
      maxOutputTokens: opts.maxTokens * 3,
      temperature: 0.3,
    },
  };

  for (let attempt = 0; attempt < plan.length; attempt++) {
    const model = plan[attempt];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const cand = data.candidates?.[0];
      if (data.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") {
        throw new AppError(422, "AI_REJECTED", "The AI couldn't process these files. Try a different source.");
      }
      if (cand?.finishReason === "MAX_TOKENS") {
        throw new AppError(502, "TRUNCATED", "The answer was too long to finish.");
      }
      // deno-lint-ignore no-explicit-any
      const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      try {
        return { input: JSON.parse(text), model: data.modelVersion ?? model };
      } catch {
        console.error("Gemini returned non-JSON:", text.slice(0, 500));
        throw new AppError(502, "BAD_OUTPUT", "The AI reply was incomplete. Please try again.");
      }
    }

    console.error(`Gemini API ${res.status} (${model}): ${await res.text()}`);
    const retryable = res.status === 429 || res.status >= 500 || res.status === 404;
    if (!retryable) {
      if (res.status === 400 || res.status === 413) {
        throw new AppError(422, "AI_REJECTED", "One of the files couldn't be read. Try re-exporting it as PDF.");
      }
      throw new AppError(503, "AI_UNAVAILABLE", BUSY_MSG);
    }
    if (attempt < plan.length - 1) await sleep(res.status === 429 ? 6000 : 2500);
  }
  throw new AppError(503, "AI_UNAVAILABLE", BUSY_MSG);
}

/** Wraps a handler with CORS preflight + consistent error responses. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return fail(405, "METHOD", "Use POST.");
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof AppError) return fail(e.status, e.code, e.message);
      console.error(e);
      // Short technical hint (e.g. a missing column) so problems can be diagnosed from the app
      // deno-lint-ignore no-explicit-any
      const hint = String((e as any)?.message ?? e ?? "").replace(/\s+/g, " ").slice(0, 160);
      return fail(500, "INTERNAL", `Something went wrong on our side. Your saved data is unchanged.${hint ? ` (Details: ${hint})` : ""}`);
    }
  });
}

export function weekNumber(week: unknown): number {
  const m = String(week ?? "").match(/\d+/);
  return m ? Number(m[0]) : NaN;
}

export function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}


// ---------------- Office files (PowerPoint / Word) -> text ----------------
export const OFFICE_TYPES: Record<string, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const decodeXml = (t: string) =>
  t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

/** Paragraph-aware text from a DrawingML / WordprocessingML part. */
function xmlText(xml: string, para: RegExp, run: RegExp): string {
  return xml.split(para).map((p) => [...p.matchAll(run)].map((m) => decodeXml(m[1])).join("").trim())
    .filter(Boolean).join("\n");
}

/**
 * .pptx -> "[slide N]" blocks (with speaker notes), .docx -> plain paragraphs.
 * Images and charts inside the file are not read; the student is told so in the note's skipped list.
 */
export function officeToText(bytes: Uint8Array, ext: string): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new AppError(422, "AI_REJECTED", "That file couldn't be opened. Old .ppt/.doc files aren't supported: save as .pptx/.docx or PDF.");
  }
  if (ext === "docx") {
    const doc = files["word/document.xml"];
    if (!doc) throw new AppError(422, "AI_REJECTED", "That Word file looks empty or damaged.");
    return xmlText(strFromU8(doc), /<\/w:p>/, /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g).slice(0, 200_000);
  }
  const slideNo = (k: string) => +(k.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => slideNo(a) - slideNo(b));
  if (!slides.length) throw new AppError(422, "AI_REJECTED", "That PowerPoint has no readable slides.");
  const out: string[] = [];
  for (const k of slides) {
    const n = slideNo(k);
    const body = xmlText(strFromU8(files[k]), /<\/a:p>/, /<a:t>([^<]*)<\/a:t>/g);
    const notesXml = files[`ppt/notesSlides/notesSlide${n}.xml`];
    const notes = notesXml ? xmlText(strFromU8(notesXml), /<\/a:p>/, /<a:t>([^<]*)<\/a:t>/g).replace(/^\d+$/m, "").trim() : "";
    out.push(`[slide ${n}]\n${body || "(no text on this slide: picture or chart only)"}${notes ? `\nSpeaker notes: ${notes}` : ""}`);
  }
  return out.join("\n\n").slice(0, 200_000);
}
