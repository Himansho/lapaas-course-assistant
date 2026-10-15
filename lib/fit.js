// Deterministic fit summary. No AI is involved: every line is written from
// knowledge-base entries and cites them. Text in “curly quotes” must appear in
// the cited entries (checked by tests/fit.test.js).
import { chipFor, hasEntry } from './kb.js';

export const INTAKE = [
  {
    key: 'role',
    question: 'Which best describes you right now?',
    options: [
      { id: 'college', label: 'College student', short: 'College student' },
      { id: 'final_year', label: 'Final-year student', short: 'Final-year student' },
      { id: 'fresher', label: 'Recent graduate / fresher', short: 'Fresher' },
      { id: 'professional', label: 'Working professional', short: 'Working professional' },
      { id: 'freelancer', label: 'Freelancer / marketer', short: 'Freelancer / marketer' },
      { id: 'business', label: 'Business owner', short: 'Business owner' },
    ],
  },
  {
    key: 'goal',
    question: 'What’s your main goal?',
    options: [
      { id: 'job', label: 'Get a job or internship in AI', short: 'goal: AI job/internship' },
      { id: 'portfolio', label: 'Build portfolio projects', short: 'goal: portfolio projects' },
      { id: 'product', label: 'Build my own product or startup idea', short: 'goal: own product' },
      { id: 'freelance', label: 'Freelance / sell AI services', short: 'goal: freelance / AI services' },
      { id: 'automate', label: 'Automate work in my business', short: 'goal: automate my business' },
      { id: 'understand', label: 'Understand how AI works', short: 'goal: understand AI' },
    ],
  },
  {
    key: 'coding',
    question: 'How much coding experience do you have?',
    options: [
      { id: 'none', label: 'None', short: 'coding: none' },
      { id: 'little', label: 'A little (basic HTML / Python)', short: 'coding: a little' },
      { id: 'comfortable', label: 'Comfortable (I’ve built apps)', short: 'coding: comfortable' },
    ],
  },
  {
    key: 'ai',
    question: 'What have you done with AI so far?',
    options: [
      { id: 'chat_tools', label: 'Only used ChatGPT-type tools', short: 'AI: chat tools' },
      { id: 'nocode', label: 'Tried no-code or automation tools (like n8n)', short: 'AI: no-code tools' },
      { id: 'built_api', label: 'Built something with AI APIs (in code)', short: 'AI: built with APIs' },
    ],
  },
  {
    key: 'time',
    question: 'How much time can you give each week?',
    options: [
      { id: 'lt3', label: 'Under 3 hours', short: 'under 3 hrs/week' },
      { id: '3to6', label: '3–6 hours', short: '3–6 hrs/week' },
      { id: 'gt6', label: 'More than 6 hours', short: '6+ hrs/week' },
    ],
  },
];

const OPTION = new Map(INTAKE.map((q) => [q.key, new Map(q.options.map((o) => [o.id, o]))]));

/** Returns a clean profile object, or null if any answer is missing or unknown. */
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const clean = {};
  for (const q of INTAKE) {
    const value = profile[q.key];
    if (typeof value !== 'string' || !OPTION.get(q.key).has(value)) return null;
    clean[q.key] = value;
  }
  return clean;
}

/** Like validateProfile, but keeps whatever answers are valid (for partial profiles). */
export function partialProfile(profile) {
  if (!profile || typeof profile !== 'object') return {};
  const clean = {};
  for (const q of INTAKE) {
    const value = profile[q.key];
    if (typeof value === 'string' && OPTION.get(q.key).has(value)) clean[q.key] = value;
  }
  return clean;
}

export function profileSummary(profile) {
  const p = partialProfile(profile);
  return INTAKE.filter((q) => p[q.key])
    .map((q) => OPTION.get(q.key).get(p[q.key]).short)
    .join(' · ');
}

const STUDENT_ROLES = new Set(['college', 'final_year', 'fresher']);

const ROLE_POINTS = {
  student: {
    title: 'Made for students & freshers',
    text: 'Students and freshers are one of the groups the course page speaks to directly. Its promise: “Graduate with proof, not just marks.” In simple words, you finish with projects you can show, not just grades. The page lists “Build a portfolio of working AI products” and “Turn projects into case studies and demos”.',
    sources: ['students-benefits'],
  },
  freelancer: {
    title: 'Freelancers & marketers are a named audience',
    text: 'The page’s line for you is “Sell useful outcomes, not more hours.” In simple words, charge clients for a result (like an automation that saves them time), not only for your hours. It lists “Add AI audits, pilots and automations” and “Automate funnels and client reporting”.',
    sources: ['marketers-freelancers'],
  },
  business: {
    title: 'Business owners are a named audience',
    text: 'The page’s line for you is “Run leaner with AI-augmented systems.” In simple words, use AI so a small team can do more. It lists “Automate operations, support and reporting” and “Prototype tools before hiring a large team”.',
    sources: ['business-owners'],
  },
  professional: {
    title: 'Working professionals: judge it by your goal',
    text: 'Working professionals aren’t one of the groups named on the page, but everyone gets the same course, so judge it by your goal. The page does speak to people who are “Worried your role will shrink” as routine work gets automated.',
    sources: ['working-professionals'],
  },
};

const GOAL_POINTS = {
  job: {
    title: 'For an AI job or internship',
    text: 'The page says the course helps you “Understand the stack behind AI job descriptions”, meaning the tools and skills AI jobs ask for, and build a portfolio of working AI products. Honest note: it does not promise a job or placement, and “commercial results still depend on your execution, market and customer acquisition.” In simple words, results depend on your own effort.',
    sources: ['students-benefits', 'jobs-and-outcomes'],
  },
  portfolio: {
    title: 'For portfolio projects',
    text: 'You build step by step, and each of the four stages ends with something you can show: first a checked idea with a rough first version, then a working app that saves real data, then AI that uses your own information and other tools, and finally your app live on the internet. The page calls that last one “A deployed product + improvement plan”. You finish with a portfolio people can inspect.',
    sources: ['stages-deliverables', 'finish-with'],
  },
  product: {
    title: 'For building your own product',
    text: 'The course follows the path a real product takes: Discover (pick the right problem), Build (make the app), Connect (add AI and other tools) and Ship (put it online and improve it). It ends with “A deployed product + improvement plan”, and it teaches using real products Sahil built, like Logoforge and Solopages.',
    sources: ['stages-deliverables', 'teaching-examples'],
  },
  freelance: {
    title: 'For freelancing and AI services',
    text: 'The page lists “Start freelancing with practical proof” for students and “Add AI audits, pilots and automations” for freelancers. Its business path is “A path from audit to pilot to retainer”: find a client’s problem, prove a small fix works, then get paid every month to keep it running. Honest note: “commercial results still depend on your execution, market and customer acquisition.”',
    sources: ['students-benefits', 'marketers-freelancers', 'finish-with'],
  },
  automate: {
    title: 'For automating your business',
    text: 'The page lists “Automate operations, support and reporting”. The course also shows how to “Connect AI to customer data, analytics, ads, WhatsApp and the tools where real work happens.” In simple words, making AI work inside the apps you already use. Agents & Automation is one of the nine curriculum areas.',
    sources: ['business-owners', 'curriculum'],
  },
  understand: {
    title: 'To understand how AI works',
    text: 'The course starts with the basics, where you “Understand models, tokens, context and cost”: how tools like ChatGPT work and what they cost to run. Honest caution: it’s a hands-on course. The page says it’s not for people who want theory without shipping, which means without building and launching real things.',
    sources: ['curriculum', 'not-for'],
    kind: 'caution',
  },
};

const CODING_POINTS = {
  none: {
    title: 'No coding background? You can still start',
    text: 'The course begins with the basics of AI, product and development, then moves step by step to building full apps. The page is honest that you “should still expect to practise and build alongside the lessons.” If you get stuck, you can contact Sahil and ask questions in the learner community.',
    sources: ['coding-needed', 'community-ask-sahil'],
  },
  little: {
    title: 'Your coding basics are a head start',
    text: 'You don’t need to be an expert: the course begins with the basics of AI, product and development. Expect to “practise and build alongside the lessons”.',
    sources: ['coding-needed'],
  },
  comfortable: {
    title: 'You already code',
    text: 'My guidance, not a course fact: since you already code, most of the new learning for you is likely the product thinking, RAG, MCP, agents and launch parts. Check the nine curriculum areas to see how much is new.',
    sources: ['curriculum'],
    kind: 'note',
  },
};

const OVERLAP_POINT = {
  title: 'Check for overlap first',
  text: 'You already code well and have built with AI APIs. Look through the nine curriculum areas on the official page to judge whether enough of it is new for you.',
  sources: ['curriculum'],
  kind: 'caution',
};

const TIME_POINTS = {
  lt3: {
    title: 'Plan your weekly time',
    text: 'The page says “Plan for several hours each week to watch, practise and finish the project work.” You get 3 months of access, so with under 3 hours a week, make a weekly plan before you join.',
    sources: ['weekly-time', 'access-3-months'],
    kind: 'caution',
  },
  '3to6': {
    title: 'Your time matches what the page asks',
    text: 'The page asks for people who “can commit a few focused hours each week”. You get 3 months of access, so a steady weekly routine helps.',
    sources: ['weekly-time', 'access-3-months'],
  },
  gt6: {
    title: 'You have the time',
    text: 'You can give more than the “few focused hours each week” the page asks for. You get 3 months of access.',
    sources: ['weekly-time', 'access-3-months'],
  },
};

const VERDICTS = [
  { level: 'strong', label: 'Looks like a strong fit' },
  { level: 'good_with_plan', label: 'Likely a good fit, with one thing to plan for' },
  { level: 'check_first', label: 'Worth checking first' },
];

const GOAL_CHIPS = {
  job: ['jobs-and-outcomes', 'placement-support', 'stages-deliverables'],
  portfolio: ['stages-deliverables', 'teaching-examples', 'certificate'],
  product: ['teaching-examples', 'tools', 'curriculum'],
  freelance: ['tools', 'finish-with', 'certificate'],
  automate: ['tools', 'teaching-examples', 'curriculum'],
  understand: ['curriculum', 'not-for', 'tools'],
};
const TAIL_CHIPS = ['price-and-emi', 'format-self-paced', 'community-ask-sahil', 'refund', 'certificate', 'access-3-months'];

export const DEFAULT_CHIPS = [
  'coding-needed',
  'stages-deliverables',
  'price-and-emi',
  'format-self-paced',
  'jobs-and-outcomes',
  'community-ask-sahil',
];

function point(p, kind = 'point') {
  return { title: p.title, text: p.text, sources: [...p.sources], kind: p.kind || kind };
}

/** Builds the fit summary for a complete, validated profile. */
export function buildFit(profileInput) {
  const profile = validateProfile(profileInput);
  if (!profile) throw new Error('invalid_profile');

  const roleKey = STUDENT_ROLES.has(profile.role) ? 'student' : profile.role;
  const points = [point(ROLE_POINTS[roleKey]), point(GOAL_POINTS[profile.goal]), point(CODING_POINTS[profile.coding])];

  let concerns = 0;
  if (profile.goal === 'understand') concerns += 1;
  if (profile.coding === 'comfortable' && profile.ai === 'built_api') {
    points.push(point(OVERLAP_POINT));
    concerns += 1;
  }
  points.push(point(TIME_POINTS[profile.time]));
  if (profile.time === 'lt3') concerns += 1;

  const verdict = VERDICTS[Math.min(concerns, 2)];

  const cited = new Set(points.flatMap((p) => p.sources));
  const priority = [...GOAL_CHIPS[profile.goal], ...(profile.time === 'lt3' ? ['total-hours'] : []), ...TAIL_CHIPS];
  let chips = [...new Set(priority)].filter((id) => !cited.has(id)).slice(0, 4);
  if (!chips.includes('price-and-emi')) chips = [...chips.slice(0, 3), 'price-and-emi'];

  for (const id of [...cited, ...chips]) if (!hasEntry(id)) throw new Error(`fit rule cites unknown entry: ${id}`);

  return {
    verdict,
    intro: 'Here’s my honest answer, using only facts from the official course page:',
    points,
    chips: chips.map(chipFor),
    profile_summary: profileSummary(profile),
  };
}
