// Plain-word meanings for technical terms, so students and freshers can
// follow the answers. These are general meanings, not course facts.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = [
  path.join(here, '..', 'public', 'kb', 'glossary.json'),
  path.join(process.cwd(), 'public', 'kb', 'glossary.json'),
].find((p) => existsSync(p));
if (!file) throw new Error('glossary.json not found');

const GLOSSARY = JSON.parse(readFileSync(file, 'utf8'));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Acronyms like "RAG" or "SaaS" match case-sensitively; normal words don't.
const TERMS = GLOSSARY.terms.map((t) => ({
  ...t,
  regexes: t.match.map(
    (m) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(m).replace(/[- ]/g, '[- ]')}(?![\\p{L}\\p{N}])`, /[A-Z]/.test(m) ? 'u' : 'iu'),
  ),
}));

export const glossaryLabel = () => GLOSSARY.meta.label;
export const glossaryTerms = () => GLOSSARY.terms.map(({ term, simple }) => ({ term, simple }));

/** Terms used in the text, in order of first appearance. */
export function findTerms(text, limit = 6) {
  const s = String(text ?? '');
  const hits = [];
  for (const t of TERMS) {
    let first = Infinity;
    for (const re of t.regexes) {
      const m = re.exec(s);
      if (m && m.index < first) first = m.index;
    }
    if (first !== Infinity) hits.push({ at: first, term: t.term, simple: t.simple });
  }
  return hits
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map(({ term, simple }) => ({ term, simple }));
}
