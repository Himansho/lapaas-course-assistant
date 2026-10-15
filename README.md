# "Is this course right for me?": an honest course-fit assistant

An embeddable chat assistant that helps a prospective student decide whether the **Lapaas AI Product Engineering** course (https://cohort.lapaas.com/) fits their background and goals. It asks 5 quick questions, gives an honest fit check, answers questions from a small verified knowledge base, and says **"I can't verify that"** instead of guessing.

> **Prototype by Himanshu Bartwal for the Lapaas internship assignment (round 2). Not an official Lapaas page or product.** Course facts are taken from the official course page and were last checked on 15 October 2026.

- **Live demo:** https://lapaas-course-assistant.vercel.app (landing section) · https://lapaas-course-assistant.vercel.app/chat.html (full-page chat)
- **Source code:** https://github.com/Himansho/lapaas-course-assistant
- **Built with:** plain JavaScript (no framework, no npm dependencies), one Vercel serverless function, Gemini API free tier.

## How it works

```
Any page ── <script src="https://lapaas-course-assistant.vercel.app/widget.js" defer></script>
              floating button + chat panel (Shadow DOM), or /chat.html inline
                    │  POST /api/chat
                    ▼
          Vercel serverless function (Node, no dependencies)
            fit → fit summary from the 5 answers         (fixed rules, no AI)
            faq → knowledge-base answer for a chip        (no AI)
            ask → Gemini + whole verified KB → strict JSON → server guard
                  └ fails / no key / quota → keyword search over the KB
                    └ no match → "I can't verify that" + WhatsApp next step
          Knowledge base: public/kb/knowledge-base.json (single source of truth)
```

### How the assistant avoids making things up

1. **The core flow uses no AI.** The 5 intake questions, the fit summary and the suggested-question chips are fixed rules (`lib/fit.js`) that only quote knowledge-base entries. A test checks all 972 possible answer combinations: every quote in the summary must appear in the entry it cites.
2. **AI only sees verified facts.** For typed questions, Gemini gets the whole knowledge base (36 entries) and strict rules, and must answer as JSON: `{status, answer, source_ids}`.
3. **The server checks every AI answer** (`lib/guard.js`) before showing it:
   - cited sources must exist, and an "answered" reply must cite at least one;
   - every number and ₹ amount must appear in the cited entries (so "6 months access" is rejected; the page says 3 months);
   - risky words (guarantee, placement, salary, refund, discount, lifetime, live class, free trial…) are only allowed if the cited entries contain them;
   - promises like "you will get a job" or "100% job guarantee" are always rejected unless clearly negated;
   - only links to the official page or WhatsApp, no emails;
   - if the topic is "not stated" on the page, the answer must say so.
4. **If a check fails, the visitor sees the verified knowledge-base answer instead**, tagged so the demo can show it.
5. **Every reply says where it came from.** `mode` is `kb` (fixed answer), `ai` (Gemini, passed the checks), `fallback` (Gemini unavailable) or `guard` (Gemini's draft was rejected). The widget shows "From the official course page", "AI answer, checked against the official page" or "Not stated on the official page".
6. Low temperature, 400-character input limit, last 6 turns of history, and a per-visitor limit on AI calls to protect the free quota. When the limit is hit, answers still come from the knowledge base.

### Plain language for students

- The fit summary explains the page’s words in everyday language (“In simple words, …”), while keeping the official quotes exact.
- When an answer uses jargon (RAG, MCP, MVP, API, deploy…), a **“Confusing words? Tap for simple meanings”** box appears under it. The meanings live in `public/kb/glossary.json`. They are general meanings, not course facts, are never cited as sources, and a test checks they contain no numbers, prices or course claims.
- The AI is told to write for a college student or fresher and to explain any technical term in plain words.

### Privacy

- The assistant never asks for a name, phone number or email, and stores nothing in a database.
- Questions it could not verify are written to the server log (anonymously, first 200 characters) as a "what to add to the course page" list.
- Typed questions are sent to Google's Gemini API to draft answers. On the free tier Google may use inputs to improve its products, so the widget asks visitors not to share personal details.

## Run it locally

Requires Node.js 20 or newer. There is nothing to install.

```bash
npm run dev
```

Open http://localhost:3000. Without a Gemini key the assistant works in **fallback mode**: the fit check and chips are unchanged, and typed questions are answered by keyword search over the knowledge base.

To turn on AI answers, copy `.env.example` to `.env` and add your own key from https://aistudio.google.com/ (free). `.env` is in `.gitignore` and must never be committed.

| Variable | Required | What it does |
|---|---|---|
| `GEMINI_API_KEY` | No (fallback mode without it) | Server-side key for the Gemini API. Never sent to the browser. |
| `GEMINI_MODEL` | No | Force a model. If empty, the app lists the models your key can use and picks the newest Gemini 3.x (or later) Flash or Flash-Lite model. Gemini 2.x is excluded on purpose. On a 404/403/429 it tries the next model. |

### Tests

```bash
npm test                                         # unit tests (no network, Gemini is mocked)
node tests/scenarios.js http://localhost:3000    # the test-sheet scenarios against a running app
```

## Deploy (Vercel Hobby, free)

1. Import this GitHub repository in Vercel (framework preset: **Other**, no build command). `vercel.json` serves `public/` and bundles the knowledge base with the functions.
2. In **Project → Settings → Environment Variables**, add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`), then redeploy.
3. Make sure the production URL opens without a login (no deployment protection on production).

## Embed it on any page

```html
<script src="https://lapaas-course-assistant.vercel.app/widget.js" defer></script>
```

The API address is worked out from the script's own `src`, so nothing else is needed. Options:

| Attribute | Example | Effect |
|---|---|---|
| `data-position` | `left` | Launcher on the left (default `right`) |
| `data-open` | `true` | Open the panel when the page loads |
| `data-label` | `Course fit check` | Launcher text |
| `data-mode` + `data-target` | `inline` + `#assistant` | Render inside an element instead of floating |

JavaScript API: `window.LapaasAssistant.open()`, `.close()`, `.toggle()`, `.restart()`.
Theme: by default the widget uses the course page’s own look (Inter + Plus Jakarta Sans; ink `#11110f`, paper `#f5f5ef`, lime `#b9f24b`), so it feels native when embedded there. No Lapaas logo or assets are used. To change it, set CSS custom properties on the host page, for example `--lca-accent`, `--lca-mark`, `--lca-ink`, `--lca-font`.

**On cohort.lapaas.com** the WhatsApp button already sits in the bottom-right corner, so embed with `data-position="left"`:

```html
<script src="https://lapaas-course-assistant.vercel.app/widget.js" data-position="left" defer></script>
```

Or use an iframe:

```html
<iframe src="https://lapaas-course-assistant.vercel.app/chat.html" title="Course fit check" style="width:100%;height:640px;border:0"></iframe>
```

The widget lives in a Shadow DOM, so the host page's CSS can't break it and it can't break the host page. It is keyboard accessible (Esc closes, focus moves into the panel and back), uses `aria-live` for new messages, respects `prefers-reduced-motion`, and goes full-screen on phones.

## Update the course facts

1. Edit `public/kb/knowledge-base.json` (the only source of truth). Use `"status": "not_stated"` for questions the official page doesn't answer.
2. Run `npm run kb:doc` to regenerate the readable `Course_Knowledge_Base.md` in the submission folder.
3. Run `npm test` and redeploy.

## Project structure

```
api/chat.js            fit / faq / ask endpoint (GET returns the intake config)
api/event.js           anonymous UI events → server log
lib/kb.js              loads the knowledge base, English + Hinglish keyword search
lib/fit.js             intake questions and fit-summary rules
lib/guard.js           checks on every AI answer
lib/gemini.js          Gemini REST client: model discovery, JSON schema, retries, busy-model cooldown
lib/glossary.js        plain-word meanings for jargon in answers
lib/http.js            small request/response helpers
public/index.html      landing section (headline, value proposition, 3 verified benefits, CTA)
public/styles.css      landing styles (course-page theme, motion, reduced-motion support)
public/landing.js      landing motion: chat preview, stage cycling, scroll reveal, simple-words cards
public/chat.html       full-page chat (share link / iframe)
public/widget.js       the embeddable widget (single file)
public/kb/knowledge-base.json
public/kb/glossary.json  simple meanings of technical terms (not course facts)
tests/                 unit tests + scenario runner
scripts/build-kb-doc.js  generates the knowledge-base document for the submission
dev-server.js          zero-dependency local server
```

## Known limitations

- Fallback-mode answers are the English knowledge-base text, even for Hinglish questions. With Gemini on, answers follow the visitor's language.
- The rate limit is in memory, per server instance. Fine for a pilot; a shared store would be needed at scale.
- The whole knowledge base goes into every prompt. That is the simplest reliable option at 36 entries; above roughly 100 entries, embeddings and retrieval would be the next step.
- Course facts can change. The knowledge base records the date it was checked, and should be re-checked whenever the course page changes.

---
Built by Himanshu Bartwal with Claude Code. Course facts belong to Lapaas and come from its public course page.
