import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getKb, search, normalize } from '../lib/kb.js';

const kb = getKb();

test('knowledge base has at least 10 entries with the required fields', () => {
  assert.ok(kb.entries.length >= 10);
  const ids = new Set();
  for (const e of kb.entries) {
    for (const f of ['id', 'category', 'question', 'answer', 'status', 'source_url', 'checked']) {
      assert.ok(typeof e[f] === 'string' && e[f].trim(), `${e.id}: missing ${f}`);
    }
    assert.ok(Array.isArray(e.keywords) && e.keywords.length > 0, `${e.id}: needs keywords`);
    assert.match(e.status, /^(verified|not_stated)$/, `${e.id}: bad status`);
    assert.match(e.source_url, /^https:\/\/cohort\.lapaas\.com\//, `${e.id}: source must be the official page`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
  }
});

test('not-stated entries say so in their answer', () => {
  for (const e of kb.entries.filter((x) => x.status === 'not_stated')) {
    assert.match(e.answer, /^Not stated on the official page/, e.id);
  }
});

test('covers every topic the brief requires', () => {
  const cats = new Set(kb.entries.map((e) => e.category));
  for (const c of ['content', 'audience', 'prerequisites', 'outcomes', 'format', 'access', 'pricing', 'community', 'certificate', 'objections']) {
    assert.ok(cats.has(c), `missing category ${c}`);
  }
});

test('normalize handles case, punctuation, apostrophes and ₹ amounts', () => {
  assert.equal(normalize('Can’t I pay ₹2,999?'), 'cant i pay 2999');
});

const cases = [
  ['Do I need coding experience?', 'coding-needed'],
  ['Mujhe coding nahi aati, kya main kar paunga?', 'coding-needed'],
  ['fees kitni hai?', 'price-and-emi'],
  ['Is EMI available?', 'price-and-emi'],
  ['Is this live or recorded?', 'format-self-paced'],
  ['How long will I have access?', 'access-3-months'],
  ['Is access 6 months?', 'access-3-months'],
  ['Can I watch on phone and laptop both?', 'devices'],
  ['Is there a coupon code?', 'discounts'],
  ['Will I get a certificate?', 'certificate'],
  ['Will this get me a job?', 'jobs-and-outcomes'],
  ['Kya placement milega?', 'jobs-and-outcomes'],
  ['Can I ask Sahil my doubts?', 'community-ask-sahil'],
  ['Is it in Hindi?', 'language'],
  ['Do I have to pay for Claude or Cursor subscription?', 'paid-tools'],
  ['Refund milega kya agar pasand nahi aaya?', 'refund'],
  ['How many hours is the course in total?', 'total-hours'],
  ['Who is the mentor?', 'mentor'],
];

for (const [q, id] of cases) {
  test(`retrieval: "${q}" -> ${id}`, () => {
    const [top] = search(q);
    assert.ok(top, 'no match');
    assert.equal(top.entry.id, id, `got ${top.entry.id} (score ${top.score}, hits ${top.hits})`);
  });
}

test('retrieval returns nothing for unrelated questions', () => {
  assert.equal(search('Is it better than 100xEngineers?').length, 0);
  assert.equal(search('What is the capital of France?').length, 0);
});
