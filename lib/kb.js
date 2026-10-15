// Loads the verified knowledge base and provides keyword retrieval
// (English + Hinglish). Used by the fit summary, the FAQ chips and as the
// fallback when Gemini is unavailable or its answer is rejected.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATE_PATHS = [
  path.join(here, '..', 'public', 'kb', 'knowledge-base.json'),
  path.join(process.cwd(), 'public', 'kb', 'knowledge-base.json'),
];

// Words that carry no meaning for matching a question to an entry.
const STOPWORDS = new Set(
  (
    'a an the is are am was were be been do does did i me my mine you your we our it its this that these those ' +
    'to of in on at for with from by about as and or but if so than then there here what which who whom whose ' +
    'how when where why can could will would should shall may might must have has had not no yes any some ' +
    'course lapaas please tell know want get also just really much many more most very okay ok hi hello ' +
    'kya hai hain ka ki ke ko me mein main mujhe mera meri mere hum ham tum aap ye yeh wo woh is us se par pe ' +
    'bhi to toh na nahi nahin kar karna karke sakta sakti sakte hoga hogi hoon hu ho tha thi raha rahi kaise kitna'
  ).split(' '),
);

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadKb() {
  const file = CANDIDATE_PATHS.find((p) => existsSync(p));
  if (!file) throw new Error('knowledge-base.json not found');
  const kb = JSON.parse(readFileSync(file, 'utf8'));
  for (const e of kb.entries) {
    Object.defineProperty(e, '_keywords', { value: (e.keywords || []).map(normalize).filter(Boolean) });
    Object.defineProperty(e, '_qtokens', {
      value: [...new Set(normalize(e.question).split(' ').filter((t) => t.length > 2 && !STOPWORDS.has(t)))],
    });
  }
  return kb;
}

const KB = loadKb();
const BY_ID = new Map(KB.entries.map((e) => [e.id, e]));

export const getKb = () => KB;
export const getMeta = () => KB.meta;
export const getEntry = (id) => BY_ID.get(id) || null;
export const hasEntry = (id) => BY_ID.has(id);

/** Short, safe shape for API responses. */
export function sourceTag(entry) {
  return { id: entry.id, question: entry.question, status: entry.status };
}

export function chipFor(id) {
  const e = BY_ID.get(id);
  return e ? { id: e.id, label: e.chip || e.question } : null;
}

/**
 * Scores every entry against the query.
 * Multi-word keyword phrase found: 2 + number of words. Single keyword token: 2.
 * Each meaningful word shared with the entry's question: 1.
 */
export function search(query, { limit = 3, minScore = 2 } = {}) {
  const q = normalize(query);
  if (!q) return [];
  const padded = ` ${q} `;
  const tokens = q.split(' ');
  const tokenSet = new Set(tokens);
  const contentTokens = new Set(tokens.filter((t) => t.length > 2 && !STOPWORDS.has(t)));

  const results = [];
  for (const entry of KB.entries) {
    let score = 0;
    const hits = [];
    for (const kw of entry._keywords) {
      if (kw.includes(' ')) {
        if (padded.includes(` ${kw} `)) {
          score += 2 + kw.split(' ').length;
          hits.push(kw);
        }
      } else if (tokenSet.has(kw) || (kw.length >= 5 && tokens.some((t) => t.startsWith(kw)))) {
        score += 2;
        hits.push(kw);
      }
    }
    for (const t of entry._qtokens) if (contentTokens.has(t)) score += 1;
    if (score >= minScore) results.push({ entry, score, hits });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
