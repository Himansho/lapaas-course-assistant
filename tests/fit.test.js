import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTAKE, buildFit, validateProfile, profileSummary } from '../lib/fit.js';
import { getEntry, normalize } from '../lib/kb.js';
import { checkAnswer } from '../lib/guard.js';

// Every combination of the 5 intake answers (6 x 6 x 3 x 3 x 3 = 972 profiles).
function* allProfiles() {
  const [role, goal, coding, ai, time] = INTAKE.map((q) => q.options.map((o) => o.id));
  for (const r of role) for (const g of goal) for (const c of coding) for (const a of ai) for (const t of time) {
    yield { role: r, goal: g, coding: c, ai: a, time: t };
  }
}

const quotes = (text) => [...text.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
const norm = (s) => normalize(s).replace(/\s+/g, ' ');

test('every profile gets a summary whose quotes and numbers come from the cited entries', () => {
  let count = 0;
  for (const profile of allProfiles()) {
    const fit = buildFit(profile);
    count++;
    assert.ok(fit.verdict.label);
    assert.ok(fit.points.length >= 4);
    for (const p of fit.points) {
      const entries = p.sources.map(getEntry);
      assert.ok(entries.every(Boolean), `unknown source in ${p.title}`);
      const cited = norm(entries.map((e) => e.answer).join(' '));
      for (const q of quotes(p.text)) {
        assert.ok(cited.includes(norm(q)), `quote not in cited entries: “${q}” (${p.sources})`);
      }
      // Reuse the AI guard on the fixed text: no number or risky claim outside the sources.
      const check = checkAnswer({ status: 'answered', answer: p.text, source_ids: p.sources }, { profileText: fit.profile_summary });
      assert.ok(check.ok, `${p.title}: ${check.reason} ${check.detail ?? ''}`);
    }
  }
  assert.equal(count, 972);
});

test('chips: 4 distinct, include price, skip what the summary already covered', () => {
  for (const profile of allProfiles()) {
    const fit = buildFit(profile);
    const ids = fit.chips.map((c) => c.id);
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids).size, 4);
    assert.ok(ids.includes('price-and-emi'));
    const cited = new Set(fit.points.flatMap((p) => p.sources));
    assert.ok(ids.filter((id) => id !== 'price-and-emi').every((id) => !cited.has(id)));
  }
});

test('verdict rules', () => {
  const base = { role: 'final_year', goal: 'portfolio', coding: 'none', ai: 'chat_tools', time: '3to6' };
  assert.equal(buildFit(base).verdict.level, 'strong');
  assert.equal(buildFit({ ...base, time: 'lt3' }).verdict.level, 'good_with_plan');
  assert.equal(buildFit({ ...base, goal: 'understand' }).verdict.level, 'good_with_plan');
  assert.equal(buildFit({ ...base, goal: 'understand', time: 'lt3' }).verdict.level, 'check_first');
  assert.equal(buildFit({ ...base, coding: 'comfortable', ai: 'built_api' }).verdict.level, 'good_with_plan');
});

test('job goal always carries the honest no-promise note', () => {
  const fit = buildFit({ role: 'fresher', goal: 'job', coding: 'little', ai: 'chat_tools', time: '3to6' });
  const text = fit.points.map((p) => p.text).join(' ');
  assert.match(text, /does not promise a job or placement/);
});

test('working professionals are told honestly they are not a named audience', () => {
  const fit = buildFit({ role: 'professional', goal: 'product', coding: 'little', ai: 'nocode', time: 'gt6' });
  assert.match(fit.points[0].text, /aren’t one of the groups named on the page/);
});

test('invalid profiles are rejected', () => {
  assert.equal(validateProfile({ role: 'college' }), null);
  assert.equal(validateProfile({ role: 'hacker', goal: 'job', coding: 'none', ai: 'chat_tools', time: 'lt3' }), null);
  assert.throws(() => buildFit({}));
});

test('profile summary contains no personal data, only the chosen options', () => {
  assert.equal(
    profileSummary({ role: 'final_year', goal: 'portfolio', coding: 'none', ai: 'chat_tools', time: '3to6', name: 'X' }),
    'Final-year student · goal: portfolio projects · coding: none · AI: chat tools · 3–6 hrs/week',
  );
});
