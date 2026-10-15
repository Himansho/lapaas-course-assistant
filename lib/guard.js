// Server-side checks on every AI answer before a visitor sees it.
// If any check fails, the caller throws the answer away and uses the
// knowledge-base fallback instead.
import { getEntry, getMeta } from './kb.js';

export const STATUSES = ['answered', 'not_in_kb', 'off_topic'];
const MAX_ANSWER_CHARS = 1200;

// Words that must not appear unless the cited entries contain them.
const RISKY = [
  { name: 'guarantee', re: /guarant/i, root: 'guarant' },
  { name: 'placement', re: /placement/i, root: 'placement' },
  { name: 'salary', re: /salar(y|ies)|\blpa\b|\bctc\b/i, root: 'salary' },
  { name: 'income', re: /\bincome\b|\bearn(s|ing|ings)?\b|\bkamai\b/i, root: 'income' },
  { name: 'refund', re: /refund|money[- ]back|paise? wapas/i, root: 'refund' },
  { name: 'discount', re: /discount|coupon|promo code|scholarship/i, root: 'discount' },
  { name: 'lifetime', re: /lifetime|forever|unlimited access/i, root: 'lifetime' },
  { name: 'live class', re: /live (class|classes|batch|session|sessions|cohort)/i, root: 'live' },
  { name: 'internship', re: /internship/i, root: 'internship' },
  { name: 'free trial', re: /free (trial|lesson|class|demo|preview|access)|for free|free of cost/i, root: 'free' },
];

// Positive promises that are always rejected unless clearly negated.
const PROMISES = [
  /\b(guarantee[sd]?|assured?|pakk[ai]|confirm(ed)?|definitely|surely|100\s*%)\s+(a\s+|an\s+|the\s+|of\s+)?(job|placement|internship|income|salary|refund|selection)/gi,
  /\b(job|placement|internship|income|salary|refund)s?\s+(is\s+|are\s+|will be\s+)?(guaranteed|assured|pakk[ai]|confirmed|certain)/gi,
  /\b(you(\s+will|'ll|’ll)|you are going to)\s+(definitely\s+|surely\s+)?(get|land|earn|receive|secure)\s+(a\s+|an\s+|your\s+)?(full\s+)?(job|placement|internship|income|salary|refund|lakh)/gi,
  /\bjob\s+(pakki|milegi hi|mil jayegi)/gi,
];
const NEGATION = /\b(no|not|never|nor|without|doesn'?t|does not|don'?t|do not|isn'?t|is not|can'?t|cannot|won'?t|nahi|nahin)\b|n['’]t\b|नहीं/i;

// When every cited entry is "not_stated", the answer must say so.
const NOT_VERIFIED_CUE =
  /not stated|isn['’]?t stated|is not stated|not mentioned|doesn['’]?t (say|state|mention|list)|does not (say|state|mention|list)|can['’]?t (verify|confirm)|cannot (verify|confirm)|can not (verify|confirm)|unable to (verify|confirm)|not (on|in) the (official )?page|nahi (likha|bataya|diya|hai)|nahin (likha|bataya)|mention nahi|verify nahi|confirm nahi|pata nahi|ask the lapaas team|lapaas team se|नहीं/i;

const ALLOWED_URL_HOSTS = ['cohort.lapaas.com', 'lapaas.com', 'www.lapaas.com', 'wa.me'];

const NUMBER_WORDS = {
  two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60',
  ninety: '90', hundred: '100', thousand: '1000', lakh: '100000', crore: '10000000',
};

const lower = (s) => String(s ?? '').toLowerCase();

/** Removes "1." / "2)" list markers at line starts so they aren't checked as facts. */
export function stripListMarkers(text) {
  return String(text ?? '').replace(/^\s*(\d{1,2}[.)]|[-*•])\s+/gm, '');
}

/** Digits in a text, with thousands separators removed: "₹2,999" -> "2999". */
export function extractNumbers(text) {
  const out = [];
  const re = /\d+(?:[.,]\d+)*/g;
  let m;
  while ((m = re.exec(String(text ?? '')))) out.push(m[0].replace(/,/g, ''));
  return out;
}

/**
 * Removes "3–6 hrs" style phrases when those numbers come from the visitor's
 * own profile, so echoing their weekly time doesn't count as a new fact.
 */
function removeProfileHours(text, profileText) {
  const profileNums = new Set(extractNumbers(profileText));
  if (!profileNums.size) return text;
  return text.replace(
    /(\d+)(?:\s*(?:[–-]|to)\s*(\d+))?\s*\+?\s*(hours?|hrs?|ghante|ghanta)/gi,
    (match, a, b) => (profileNums.has(a) && (!b || profileNums.has(b)) ? ' ' : match),
  );
}

function urlsIn(text) {
  return String(text ?? '').match(/https?:\/\/[^\s)"'<>]+/gi) || [];
}

/**
 * @param {{status:string, answer:string, source_ids:string[]}} result  parsed AI output
 * @param {{profileText?:string}} ctx
 * @returns {{ok:true, sources:object[]}|{ok:false, reason:string, detail?:string}}
 */
export function checkAnswer(result, ctx = {}) {
  if (!result || typeof result !== 'object') return fail('not_an_object');
  const { status, answer } = result;
  const ids = Array.isArray(result.source_ids) ? result.source_ids : [];

  if (!STATUSES.includes(status)) return fail('bad_status', String(status));
  if (typeof answer !== 'string' || !answer.trim()) return fail('empty_answer');
  if (answer.length > MAX_ANSWER_CHARS) return fail('too_long');
  if (!ids.every((id) => typeof id === 'string')) return fail('bad_source_ids');

  const sources = [];
  for (const id of new Set(ids)) {
    const entry = getEntry(id);
    if (!entry) return fail('unknown_source', id);
    sources.push(entry);
  }
  if (status === 'answered' && sources.length === 0) return fail('answered_without_source');

  const citedText = sources.map((e) => `${e.question}\n${e.answer}`).join('\n');
  const citedLower = lower(citedText);
  const meta = getMeta();
  const body = stripListMarkers(answer);

  // 1. Numbers and ₹ amounts must come from the cited entries (or the visitor's own weekly-time answer).
  const phoneDigits = meta.whatsapp_number.replace(/\D/g, '');
  const allowedNumbers = new Set([
    ...extractNumbers(`${citedText}\n${meta.whatsapp_number}`),
    phoneDigits,
    phoneDigits.replace(/^91/, ''),
  ]);
  const checkedBody = removeProfileHours(body, ctx.profileText || '');
  for (const n of extractNumbers(checkedBody)) {
    if (!allowedNumbers.has(n)) return fail('number_not_in_sources', n);
  }
  const words = lower(checkedBody).match(/\b[a-z]+\b/g) || [];
  for (const w of words) {
    const digit = NUMBER_WORDS[w];
    if (digit && !new RegExp(`\\b${w}\\b`).test(citedLower) && !allowedNumbers.has(digit)) {
      return fail('number_not_in_sources', w);
    }
  }

  // 2. Risky claims only if the cited entries mention them.
  for (const r of RISKY) {
    if (r.re.test(body) && !r.re.test(citedText)) return fail('risky_term_not_in_sources', r.name);
  }

  // 3. Promises of jobs, income or refunds are rejected unless clearly negated.
  for (const re of PROMISES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body))) {
      const before = body.slice(Math.max(0, m.index - 40), m.index);
      const sentenceStart = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'));
      const window = `${before.slice(sentenceStart + 1)} ${m[0]}`;
      if (!NEGATION.test(window)) return fail('promise', m[0]);
    }
  }

  // 4. Only links to the official page, the refund policy or WhatsApp. No emails.
  for (const url of urlsIn(answer)) {
    let host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return fail('bad_url', url);
    }
    if (!ALLOWED_URL_HOSTS.includes(host)) return fail('url_not_allowed', host);
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(answer)) return fail('email_in_answer');

  // 5. If any cited entry is "not stated" (or nothing matched), the answer must say it can't be verified.
  //    (Found in testing: citing a not-stated entry together with a verified one must not hide the gap.)
  if (sources.some((e) => e.status === 'not_stated') && !NOT_VERIFIED_CUE.test(answer)) {
    return fail('not_stated_without_cue');
  }
  if (status === 'not_in_kb' && !NOT_VERIFIED_CUE.test(answer)) return fail('not_in_kb_without_cue');

  return { ok: true, sources };
}

function fail(reason, detail) {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}
