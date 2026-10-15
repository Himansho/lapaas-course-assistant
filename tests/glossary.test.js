import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTerms, glossaryTerms } from '../lib/glossary.js';
import { respond } from '../api/chat.js';

test('glossary meanings are general words only: no numbers, prices or course claims', () => {
  for (const t of glossaryTerms()) {
    assert.doesNotMatch(t.simple, /\d|₹|lapaas|sahil|this course|the course/i, `${t.term} must stay a general meaning`);
  }
});

test('finds jargon in order and respects acronym case', () => {
  const terms = findTerms('Build a RAG app, then deploy your MVP with an API.').map((t) => t.term);
  assert.deepEqual(terms, ['RAG', 'Deploy', 'MVP', 'API']);
  assert.deepEqual(findTerms('I want a rag doll'), [], 'lowercase "rag" is not the acronym');
  assert.deepEqual(findTerms('full stack and full-stack').map((t) => t.term), ['Full-stack']);
});

test('answers and fit summaries carry simple meanings for their jargon', async () => {
  const realLog = console.log;
  console.log = () => {};
  try {
    const faq = await respond({ type: 'faq', id: 'curriculum' });
    assert.ok(faq.json.simple.some((t) => t.term === 'RAG'));
    const fit = await respond({ type: 'fit', profile: { role: 'fresher', goal: 'portfolio', coding: 'none', ai: 'chat_tools', time: '3to6' } });
    assert.ok(fit.json.simple.length > 0);
  } finally {
    console.log = realLog;
  }
});
