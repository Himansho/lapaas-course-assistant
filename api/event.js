// POST /api/event: anonymous usage events, written to the server log only.
// No personal data: only the event name and a few whitelisted ids.
import { readJsonBody, sendJson } from '../lib/http.js';

const EVENTS = new Set([
  'open',
  'close',
  'intake_start',
  'intake_skip',
  'intake_complete',
  'chip',
  'ask',
  'cta_course',
  'cta_whatsapp',
]);
const FIELDS = ['verdict', 'role', 'goal', 'id', 'mode', 'status', 'where'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 204);
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: 'invalid_json' });
  }
  if (!body || !EVENTS.has(body.event)) return sendJson(res, 400, { error: 'unknown_event' });

  const data = {};
  for (const f of FIELDS) {
    const v = body.data?.[f];
    if (typeof v === 'string' && /^[\w-]{1,40}$/.test(v)) data[f] = v;
  }
  console.log(JSON.stringify({ evt: `ui_${body.event}`, at: new Date().toISOString(), ...data }));
  return sendJson(res, 204);
}
