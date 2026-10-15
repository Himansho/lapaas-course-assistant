// Small HTTP helpers shared by the serverless functions and the dev server.
// Works with Vercel's Node runtime (req.body may be pre-parsed) and plain node:http.

export async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20000) throw new Error('body_too_large');
  }
  return raw ? JSON.parse(raw) : {};
}

export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

export function sendJson(res, status, json) {
  res.statusCode = status;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (json === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(json));
}
