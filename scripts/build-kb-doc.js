// Generates the readable knowledge-base document and the JSON copy for
// folder 02 from public/kb/knowledge-base.json (the single source of truth).
// Run: npm run kb:doc
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const kbPath = path.join(root, 'public', 'kb', 'knowledge-base.json');
const outDir = path.join(root, '..', '02_Course_Knowledge_Base');

if (!existsSync(outDir)) {
  console.error(`Folder not found: ${outDir}`);
  process.exit(1);
}

const kb = JSON.parse(readFileSync(kbPath, 'utf8'));
const { meta, entries } = kb;
const glossary = JSON.parse(readFileSync(path.join(root, 'public', 'kb', 'glossary.json'), 'utf8'));
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const statusLabel = (s) => (s === 'verified' ? 'Verified (official page)' : 'Not stated on the official page');

const coverage = [
  ['Course content', ['curriculum', 'tools', 'teaching-examples', 'what-is']],
  ['Audience', ['audience', 'students-benefits', 'business-owners', 'marketers-freelancers', 'working-professionals', 'not-for']],
  ['Prerequisites', ['coding-needed', 'weekly-time']],
  ['Learning outcomes', ['stages-deliverables', 'finish-with', 'jobs-and-outcomes']],
  ['Format', ['format-self-paced', 'when-can-i-start', 'weekly-time', 'total-hours', 'language']],
  ['Access', ['access-3-months', 'devices', 'access-extension']],
  ['Pricing', ['price-and-emi', 'whats-included', 'discounts']],
  ['Community', ['community-ask-sahil', 'contact-whatsapp']],
  ['Certificate', ['certificate', 'certificate-requirements']],
  ['Common objections', ['refund', 'tools-outdated', 'reviews-historical', 'paid-tools', 'free-preview', 'placement-support']],
];

const ids = new Set(entries.map((e) => e.id));
for (const [, list] of coverage) {
  for (const id of list) if (!ids.has(id)) throw new Error(`Coverage table names unknown id: ${id}`);
}

const table = (rows) => {
  const head = '| # | ID | Question | Answer | Status | Source | Checked |\n|---|---|---|---|---|---|---|';
  const body = rows
    .map((e, i) => {
      const src = e.also_see ? `${e.source_url} + ${e.also_see}` : e.source_url;
      return `| ${i + 1} | \`${e.id}\` | ${cell(e.question)} | ${cell(e.answer)} | ${statusLabel(e.status)} | ${src} | ${e.checked} |`;
    })
    .join('\n');
  return `${head}\n${body}`;
};

const verified = entries.filter((e) => e.status === 'verified');
const notStated = entries.filter((e) => e.status === 'not_stated');

const md = `# Course Knowledge Base: Lapaas AI Product Engineering

**Prepared by:** Himanshu Bartwal, for the Lapaas AI internship assignment (round 2). This is not an official Lapaas document.
**Primary source:** the official course page, ${meta.source_url}
**Also used:** the Lapaas refund policy linked from that page, ${meta.refund_policy_url}
**Checked:** first on ${meta.first_checked}, re-checked on ${meta.checked} (no changes found).

## How to read this

- **${entries.length} questions and answers**: ${verified.length} verified from the official page, ${notStated.length} that the page does **not** answer.
- Text in “curly quotes” is copied word for word from the official page. Every quote was checked automatically against the live page text on ${meta.checked}.
- **Verified (official page)**: the answer comes from the course page.
- **Not stated on the official page**: visitors ask this, but the page doesn't answer it. The assistant says it can't verify it and suggests asking the Lapaas team on WhatsApp.
- The assistant reads the same data from \`knowledge-base.json\` (copy in this folder). This document is generated from that file, so the two always match.

## Coverage of the brief's required topics

| Topic required by the brief | Entries |
|---|---|
${coverage.map(([topic, list]) => `| ${topic} | ${list.map((id) => `\`${id}\``).join(', ')} |`).join('\n')}

## Verified answers (${verified.length})

${table(verified)}

## Not stated on the official page (${notStated.length})

The assistant never guesses these. It says it can't verify the answer from the official course page and offers the Lapaas team on WhatsApp (${meta.whatsapp_number}).

${table(notStated)}

## Important wording notes

- **Refund:** the course page says “30-day money-back guarantee”, but the linked Lapaas refund policy is conditional. It asks for an email request with evidence of active participation and implementation, lists eligibility conditions and exclusions (for example, requests after course access has expired), and does not name this course. So the assistant quotes the page, explains that conditions apply, and never promises a refund.
- **Jobs and income:** the page makes no job, placement or income promise. It says “commercial results still depend on your execution, market and customer acquisition.” The assistant repeats this and never promises outcomes.
- **Reviews:** the page says its reviews come from the completed live cohort and are “not a promise of live classes”. The assistant says the course is self-paced.
- **Working professionals** are not one of the three audiences named on the page. The assistant says so honestly and judges fit by the visitor's goal.

## Learner-reported (unverified, not used by the assistant)

These come from Himanshu Bartwal's own experience as a Lapaas learner. They are **not** on the official page, may not apply to every learner or course version, and are **not** in the assistant's knowledge base.

- Before buying, his main doubt was “will I actually be able to build a product?” After the course he found that he could, and that it keeps getting easier as AI tools improve.
- Course videos played on only one device. Using another device meant asking Lapaas support on WhatsApp.

If a visitor asks about devices, the assistant uses the \`devices\` entry above: not stated on the official page, ask the Lapaas team.

## Simple words: plain meanings of technical terms (not course facts)

Many students and freshers don't know words like RAG, MCP or MVP. When an answer uses one of these words, the assistant shows a "Confusing words? Tap for simple meanings" box under it, and the AI is told to explain jargon in everyday words.

These are **general meanings written for this prototype**. They are not from the course page, make no claim about what the course includes, and are never cited as sources. A test checks that they contain no numbers, prices or course claims. Source file: \`public/kb/glossary.json\`.

| Term | Simple meaning |
|---|---|
${glossary.terms.map((t) => `| ${cell(t.term)} | ${cell(t.simple)} |`).join('\n')}
`;

writeFileSync(path.join(outDir, 'Course_Knowledge_Base.md'), md);
copyFileSync(kbPath, path.join(outDir, 'knowledge-base.json'));
console.log(`Wrote Course_Knowledge_Base.md and knowledge-base.json to ${outDir} (${entries.length} entries)`);
