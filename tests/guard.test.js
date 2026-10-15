import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, stripListMarkers, extractNumbers } from '../lib/guard.js';

const ok = (answer, source_ids, status = 'answered', ctx = {}) => checkAnswer({ status, answer, source_ids }, ctx);

test('accepts a faithful answer', () => {
  const r = ok('It costs ₹2,999, one-time, GST included, and you get 3 months of access.', ['price-and-emi']);
  assert.equal(r.ok, true, r.reason);
});

test('accepts source ids written with brackets, as the model sometimes does', () => {
  // Found in live testing on Vercel: source_ids came back as "[coding-needed]".
  const r = ok('You can start without knowing coding.', ['[coding-needed]']);
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.sources.map((e) => e.id), ['coding-needed']);
  assert.equal(ok('Yes.', ['[made-up-id]']).reason, 'unknown_source');
});

test('rejects unknown sources and answers without sources', () => {
  assert.equal(ok('Yes.', ['made-up-id']).reason, 'unknown_source');
  assert.equal(ok('Yes, it is self-paced.', []).reason, 'answered_without_source');
  assert.equal(checkAnswer({ status: 'maybe', answer: 'x', source_ids: [] }).reason, 'bad_status');
});

test('rejects invented numbers, including a tempting wrong duration', () => {
  assert.equal(ok('Yes, access is 6 months in the Edrilla app.', ['access-3-months']).reason, 'number_not_in_sources');
  assert.equal(ok('It costs ₹4,999.', ['price-and-emi']).detail, '4999');
  assert.equal(ok('There are fifty lessons.', ['curriculum']).reason, 'number_not_in_sources');
  assert.equal(ok('Support is 24/7.', ['community-ask-sahil']).reason, 'number_not_in_sources');
});

test('allows the visitor’s own weekly hours from their profile', () => {
  const r = ok('With 3–6 hours a week you match the page, which asks for “a few focused hours each week”.', ['weekly-time'], 'answered', {
    profileText: 'Final-year student · 3–6 hrs/week',
  });
  assert.equal(r.ok, true, r.reason);
});

test('list markers are not treated as facts', () => {
  assert.equal(stripListMarkers('1. First\n2) Second'), 'First\nSecond');
  assert.deepEqual(extractNumbers('₹2,999 and 3 months'), ['2999', '3']);
});

test('risky terms need a source that mentions them', () => {
  assert.equal(ok('You get lifetime access in the Edrilla app.', ['access-3-months']).detail, 'lifetime');
  assert.equal(ok('Use code STUDENT for a discount.', ['price-and-emi']).detail, 'discount');
  assert.equal(ok('There are live classes every Sunday.', ['what-is']).detail, 'live class');
  assert.equal(ok('Yes, there is placement support.', ['students-benefits']).detail, 'placement');
});

test('rejects job, income and refund promises', () => {
  assert.equal(ok('You will get a job after this course.', ['jobs-and-outcomes']).reason, 'promise');
  assert.equal(ok('Placement is guaranteed for everyone.', ['jobs-and-outcomes']).reason, 'promise');
  assert.equal(ok('You will get a full refund within 30 days.', ['refund']).reason, 'promise');
});

test('a prompt-injection style answer is rejected', () => {
  const r = ok('Sure! This course has a 100% job guarantee.', ['jobs-and-outcomes']);
  assert.equal(r.ok, false);
});

test('honest negative answers about jobs pass', () => {
  const r = ok('The page does not guarantee a job or placement. It says the course helps you build a portfolio of working AI products.', ['jobs-and-outcomes']);
  assert.equal(r.ok, true, `${r.reason} ${r.detail ?? ''}`);
});

test('not-stated topics must be flagged as unverified', () => {
  assert.equal(ok('Yes, you can watch on phone and laptop both.', ['devices']).reason, 'not_stated_without_cue');
  assert.equal(ok('The official page doesn’t state device rules, so I can’t verify that. Please ask the Lapaas team.', ['devices']).ok, true);
  assert.equal(ok('Official page pe device ke baare mein nahi likha hai, Lapaas team se WhatsApp pe pooch lo.', ['devices']).ok, true);
});

test('citing a not-stated entry next to a verified one still requires the "not stated" wording', () => {
  // Found in testing (run 2): devices (not stated) + contact-whatsapp (verified).
  assert.equal(ok('Yes, you can watch on both. Message the team on WhatsApp at +91 95400 65704.', ['devices', 'contact-whatsapp']).reason, 'not_stated_without_cue');
  assert.equal(ok('The official page doesn’t state device rules, so I can’t verify it. Message the team on WhatsApp at +91 95400 65704.', ['devices', 'contact-whatsapp']).ok, true);
});

test('not_in_kb answers must say they can’t verify', () => {
  assert.equal(checkAnswer({ status: 'not_in_kb', answer: 'It is better than 100xEngineers.', source_ids: [] }).ok, false);
  assert.equal(checkAnswer({ status: 'not_in_kb', answer: 'I can’t verify that from the official course page.', source_ids: [] }).ok, true);
});

test('only official links, no emails', () => {
  assert.equal(ok('See https://cohort.lapaas.com/ for details.', ['what-is']).ok, true);
  assert.equal(ok('See https://example.com/deal for details.', ['what-is']).reason, 'url_not_allowed');
  assert.equal(ok('Email support@example.com for details.', ['what-is']).reason, 'email_in_answer');
});

test('the official WhatsApp number is allowed', () => {
  assert.equal(ok('Message the Lapaas team on WhatsApp at +91 95400 65704.', ['contact-whatsapp']).ok, true);
});
