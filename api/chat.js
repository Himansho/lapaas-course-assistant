// POST /api/chat
//   { type: "fit", profile }                    -> deterministic fit summary (no AI)
//   { type: "faq", id }                         -> knowledge-base answer for a chip (no AI)
//   { type: "ask", message, profile?, history? } -> Gemini answer checked by the guard,
//                                                  else keyword fallback, else "can't verify"
// GET /api/chat -> intake questions, default chips and links for the widget.
import { getMeta, getEntry, search, sourceTag, chipFor } from '../lib/kb.js';
import { INTAKE, DEFAULT_CHIPS, buildFit, validateProfile, partialProfile, profileSummary } from '../lib/fit.js';
import { checkAnswer } from '../lib/guard.js';
import { askGemini, hasKey } from '../lib/gemini.js';
import { readJsonBody, clientIp, sendJson } from '../lib/http.js';
import { findTerms, glossaryLabel } from '../lib/glossary.js';

const MAX_MESSAGE = 400;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_TEXT = 600;

export const CANT_VERIFY =
  'From the information I have, I can’t confirm that, so I won’t guess. The Lapaas team can help: tap “Ask the Lapaas team on WhatsApp”.';
export const OFF_TOPIC =
  'I can only help with questions about the Lapaas AI Product Engineering course, like what it covers, who it suits, price, access or format.';

// Simple in-memory limit on AI calls per visitor IP (per server instance).
// When it is reached, answers still come from the knowledge base.
const AI_WINDOW_MS = 10 * 60 * 1000;
const AI_MAX_PER_WINDOW = 20;
const aiCalls = new Map();

function allowAi(ip) {
  const now = Date.now();
  const recent = (aiCalls.get(ip) || []).filter((t) => now - t < AI_WINDOW_MS);
  if (recent.length >= AI_MAX_PER_WINDOW) {
    aiCalls.set(ip, recent);
    return false;
  }
  recent.push(now);
  aiCalls.set(ip, recent);
  if (aiCalls.size > 5000) aiCalls.clear();
  return true;
}

function log(event, data) {
  console.log(JSON.stringify({ evt: event, at: new Date().toISOString(), ...data }));
}

const cleanText = (value, max) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, text: cleanText(t.text, MAX_HISTORY_TEXT) }))
    .filter((t) => t.text);
}

const ROUTING_ONLY = new Set(['contact-whatsapp']);

/**
 * Picks the knowledge-base entries for a fallback answer. A message with
 * several questions ("…kar sakta hoon? Fees kitni hai?") gets one entry per
 * part (max 2); otherwise the single best match.
 */
function fallbackEntries(message, matches) {
  const parts = message
    .split(/[?？]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 3);
  if (parts.length >= 2) {
    const picked = [];
    for (const part of parts) {
      const best = search(part, { limit: 1 })[0];
      if (best && !picked.includes(best.entry)) picked.push(best.entry);
      if (picked.length === 2) break;
    }
    if (picked.length) return picked;
  }
  return matches[0] ? [matches[0].entry] : [];
}

function relatedChips(matches, exclude) {
  return matches
    .map((m) => m.entry.id)
    .filter((id) => !exclude.has(id))
    .slice(0, 3)
    .map(chipFor);
}

function entryReply(entry, mode, extra = {}) {
  return {
    type: 'answer',
    mode,
    status: entry.status === 'verified' ? 'answered' : 'not_stated',
    answer: entry.answer,
    sources: [sourceTag(entry)],
    unverified: entry.status !== 'verified',
    ...extra,
  };
}

export function config() {
  const meta = getMeta();
  return {
    intake: INTAKE.map((q) => ({ key: q.key, question: q.question, options: q.options.map(({ id, label }) => ({ id, label })) })),
    default_chips: DEFAULT_CHIPS.map(chipFor),
    links: { course: meta.course_cta_url, whatsapp: meta.whatsapp_url, whatsapp_number: meta.whatsapp_number },
    kb_checked: meta.checked,
    ai_enabled: hasKey(),
    simple_label: glossaryLabel(),
  };
}

async function answerQuestion(body, ctx) {
  const message = cleanText(body.message, MAX_MESSAGE);
  if (!message) return { status: 400, json: { error: 'empty_message' } };

  const profileText = profileSummary(partialProfile(body.profile));
  const matches = search(message);
  let reason;

  if (body.noAi === true) {
    reason = 'forced_fallback';
  } else if (!hasKey()) {
    reason = 'no_key';
  } else if (!allowAi(ctx.ip || 'unknown')) {
    reason = 'rate_limited';
  } else {
    const ai = await askGemini({ message, profileText, history: cleanHistory(body.history) });
    if (ai.ok) {
      const check = checkAnswer(ai.result, { profileText });
      if (check.ok) {
        const { status, answer } = ai.result;
        const sources = check.sources;
        // The contact entry only routes to the team; it doesn't make an unverified answer verified.
        const content = sources.filter((e) => !ROUTING_ONLY.has(e.id));
        const anyNotStated = content.some((e) => e.status === 'not_stated');
        const replyStatus = status === 'answered' ? (anyNotStated ? 'not_stated' : 'answered') : status;
        const reply = {
          type: 'answer',
          mode: 'ai',
          model: ai.model,
          status: replyStatus,
          partial: anyNotStated && content.some((e) => e.status === 'verified'),
          answer: status === 'off_topic' ? OFF_TOPIC : answer.trim(),
          sources: sources.map(sourceTag),
          unverified: replyStatus === 'not_stated' || replyStatus === 'not_in_kb',
          related: relatedChips(matches, new Set(sources.map((e) => e.id))),
        };
        log('ask', { mode: 'ai', status: replyStatus, sources: sources.map((e) => e.id), model: ai.model });
        if (reply.unverified) log('unverified_question', { q: message.slice(0, 200) });
        return { status: 200, json: reply };
      }
      reason = `guard:${check.reason}${check.detail ? `:${check.detail}` : ''}`;
    } else {
      reason = `ai:${ai.reason}`;
    }
  }

  const mode = reason.startsWith('guard:') ? 'guard' : 'fallback';
  const picked = fallbackEntries(message, matches);
  let reply;
  if (picked.length === 1) {
    reply = entryReply(picked[0], mode, {
      reason,
      related: relatedChips(matches, new Set([picked[0].id])),
    });
  } else if (picked.length > 1) {
    // Two-part question ("coding nahi aati… fees kitni hai?"): answer each part from its own entry.
    const anyNotStated = picked.some((e) => e.status === 'not_stated');
    reply = {
      type: 'answer',
      mode,
      status: anyNotStated ? 'not_stated' : 'answered',
      partial: anyNotStated && picked.some((e) => e.status === 'verified'),
      answer: picked.map((e) => e.answer).join('\n\n'),
      sources: picked.map(sourceTag),
      unverified: anyNotStated,
      reason,
      related: relatedChips(matches, new Set(picked.map((e) => e.id))),
    };
  } else {
    reply = {
      type: 'answer',
      mode,
      status: 'not_in_kb',
      answer: CANT_VERIFY,
      sources: [],
      unverified: true,
      reason,
      related: [],
    };
  }
  log('ask', { mode, status: reply.status, sources: reply.sources.map((s) => s.id), reason });
  if (reply.unverified) log('unverified_question', { q: message.slice(0, 200) });
  return { status: 200, json: reply };
}

/** Adds plain-word meanings for any jargon in an answer (general meanings, not course facts). */
function withSimple(out) {
  if (out.json?.type === 'answer') out.json.simple = findTerms(out.json.answer);
  return out;
}

/** Pure request handler, used by the HTTP wrapper, the dev server and the tests. */
export async function respond(body, ctx = {}) {
  if (!body || typeof body !== 'object') return { status: 400, json: { error: 'invalid_body' } };

  switch (body.type) {
    case 'fit': {
      const profile = validateProfile(body.profile);
      if (!profile) return { status: 400, json: { error: 'invalid_profile' } };
      const fit = buildFit(profile);
      log('intake_complete', { verdict: fit.verdict.level, role: profile.role, goal: profile.goal });
      const simple = findTerms(fit.points.map((p) => p.text).join(' '), 8);
      return { status: 200, json: { type: 'fit', mode: 'kb', ...fit, simple } };
    }
    case 'faq': {
      const entry = typeof body.id === 'string' ? getEntry(body.id) : null;
      if (!entry) return { status: 404, json: { error: 'unknown_id' } };
      log('faq', { id: entry.id });
      return withSimple({ status: 200, json: entryReply(entry, 'kb', { related: [] }) });
    }
    case 'ask':
      return withSimple(await answerQuestion(body, ctx));
    default:
      return { status: 400, json: { error: 'unknown_type' } };
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 204);
  if (req.method === 'GET') return sendJson(res, 200, config());
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' });
  }
  try {
    const out = await respond(body, { ip: clientIp(req) });
    return sendJson(res, out.status, out.json);
  } catch (err) {
    log('error', { message: String(err?.message || err).slice(0, 200) });
    return sendJson(res, 500, { error: 'server_error' });
  }
}
