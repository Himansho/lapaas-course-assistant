# Test evidence

Raw responses saved by `tests/scenarios.js` on 15 October 2026. Each file is one full run of the test-sheet scenarios (5 required + extra checks) against the real `/api/chat` endpoint.

| File | Where | Notes |
|---|---|---|
| run1_fallback_no_key_… | local | no Gemini key: knowledge-base fallback only |
| run2_ai_before_fixes_… | local | Gemini on, before fixes 1–4 |
| run3_ai_after_fixes_… | local | after fixes 1–4 |
| run4_live_vercel_… | live (Vercel) | before fixes 5–6 |
| run5_live_vercel_final_… | live (Vercel) | final run |

The readable summary is the Test Sheet and Improvement Log in the submission folder `04_Testing_and_Feedback`.
