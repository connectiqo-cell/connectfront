# PrepmeAI — Full Professional Audit Report

**Target:** https://prepme-ai-web.vercel.app/  
**Audited:** 2026-08-05  
**Status:** Private Alpha  
**Method:** HTTP/API probing, SSR/HTML review, JS bundle analysis, authenticated session flows  

> **Note:** No headed browser automation was available for this audit. Visual responsive/focus/animation checks are inferred from markup/CSS/JS and called out where blocked.

---

## Launch Verdict

**Not production-ready.** Do not launch publicly until BUG-001/002 (verification token leak), stored XSS handling, Redis durability, and billing honesty are fixed. Breadth of the product is impressive for alpha; trust and polish are not yet at a “millions of users” bar.

| Metric | Score |
|--------|-------|
| Overall | **5.5 / 10** |
| Security | 4.5 / 10 |
| Features | 7.5 / 10 |
| Performance | 5.0 / 10 |
| Tracked bugs | 20 |

---

## Scorecard (/10)

| Area | Score | One-line rationale |
|------|------:|--------------------|
| UI | 6.5 | Cohesive dark SaaS tokens; encoding bugs & generic Inter/indigo |
| UX | 6.0 | Clear IA; empty Learning & pre-onboarding shell inconsistencies |
| Performance | 5.0 | Marketing fast; authenticated API reads often 1–4s |
| Accessibility | 6.0 | Labels, cookie banner, high-contrast; muted contrast & no SR audit |
| Security | 4.5 | Strong cookie auth & gates, undermined by verificationUrl leak + XSS storage |
| Features | 7.5 | Wide surface: resume, ATS, interviews, roadmap, apps board, settings a11y |
| Code quality (inferred) | 7.0 | Structured API client, error codes, Nest-like validation from traffic |
| Professionalism | 5.5 | Honest alpha banner; infra leak & broken © hurt trust |
| Scalability | 4.0 | In-memory Redis called out on homepage; sync heavy AI routes |
| **Overall** | **5.5** | Strong alpha foundation; not GA |

---

## Account Testing Matrix

| ID | Test | Result | Evidence |
|----|------|--------|----------|
| A01 | Create brand-new account | PASS | POST /api/v1/auth/register returned 201 with userId for qa.fullaudit.*@mailinator.com |
| A02 | Email verification required | PASS | Login before verify returns AUTH_EMAIL_NOT_VERIFIED; no session cookies issued |
| A03 | Blocked until verification | PASS | Protected APIs return 401 without cookies; middleware redirects /dashboard → login |
| A04 | Tokens before verification | PASS | Register response sets no prepme_access / prepme_refresh cookies |
| A05 | Verification link expiry / reuse | PARTIAL | Reuse after success → AUTH_INVALID_TOKEN. Absolute TTL not exhaustively timed in this run |
| A06 | Verification URL secrecy | **FAIL** | **CRITICAL:** register JSON includes verificationUrl with live token (email gate bypass) |
| A07 | Password reset | PASS | Forgot-password always returns generic success; bad token → AUTH_INVALID_TOKEN / validation |
| A08 | Wrong credentials | PASS | AUTH_INVALID_CREDENTIALS with generic message (no user enumeration) |
| A09 | Duplicate account | BLOCKED | Register rate-limited (~30m) after traffic; AuthErrorCodes includes AUTH_EMAIL_ALREADY_EXISTS |
| A10 | Weak passwords | PASS | BE rejects <8 chars / missing complexity; FE strength meter mirrors rules |
| A11 | Invalid email formats | PASS | VALIDATION_FAILED: email must be an email |
| A12 | Long inputs / SQLi / XSS auth | PASS* | Auth inputs validated. *Stored XSS later accepted in applications/feedback (see bugs) |
| A13 | Logout | PASS | Cookies cleared HttpOnly/Secure; session + resumes return 401 after logout |
| A14 | Session expiration | PASS* | Access JWT Max-Age=900s; refresh Max-Age=604800 (7d). Soft expiry not waited live |
| A15 | Remember Me | N/A | No Remember Me control; refresh cookie acts as 7-day stay-signed-in |

---

## What Was Exercised (Authenticated)

### Flows completed
- Register → verify via leaked URL → login → 6-step onboarding → complete
- Dashboard coach tips, roadmap active plan, progress + career report
- Applications board create; interview create/start; JD create; feedback
- Settings PATCH (theme, contrast, motion, font scale); memory entries
- Admin denied (403 API; /admin → /dashboard); logout clears session
- Search, notifications unread, GitHub status, portfolio limits

### Could not fully validate
- Pixel-perfect responsive / hover / animation (no headed browser tool)
- Real inbox email delivery & absolute link TTL clock
- Successful resume PDF parse (malformed PDF → 500; no clean fixture)
- Full interview scoring turn (field is `answerText`, not `answer`)
- Cover letter generate (requires resumeId UUID)
- Voice / coding / Stripe Premium paths (explicitly “Coming soon”)
- Stored XSS DOM execution (payloads stored; render sink not observed live)

---

## Bug Tracker

### BUG-001 — Register API returns live email verification URL
- **Severity:** Critical | **Priority:** P0
- **Page:** POST /api/v1/auth/register
- **Steps:**
  1. POST register with valid payload
  2. Inspect JSON `data.verificationUrl`
  3. POST /auth/verify-email with that token
- **Expected:** Token only delivered via email; API never echoes it
- **Actual:** verificationUrl with usable token returned; verify succeeds without inbox
- **Recommendation:** Strip verificationUrl in non-dev environments; gate behind NODE_ENV / LAUNCH_STAGE
- **Screenshot:** [PLACEHOLDER — BUG-001]

### BUG-002 — Verify-email UI includes Dev verification link surface
- **Severity:** Critical | **Priority:** P0
- **Page:** /verify-email
- **Steps:** Inspect verify-email bundle for “Dev verification link”
- **Expected:** No client path to display raw verification URLs in alpha/public builds
- **Actual:** Client contains Dev verification link UI branch
- **Recommendation:** Compile-out with feature flag; never ship to Vercel production host
- **Screenshot:** [PLACEHOLDER — BUG-002]

### BUG-003 — Copyright / middot characters render as “Ac” / mojibake
- **Severity:** Medium | **Priority:** P1
- **Page:** Marketing footer, pricing, privacy, terms
- **Steps:** Open / and view footer text
- **Expected:** © 2026 PrepmeAI
- **Actual:** SSR shows “Ac 2026” and broken · separators
- **Recommendation:** Fix encoding (UTF-8) or use &copy; / ASCII fallbacks consistently
- **Screenshot:** [PLACEHOLDER — BUG-003]

### BUG-004 — Landing advertises Redis (in-memory) infrastructure
- **Severity:** High | **Priority:** P0
- **Page:** /
- **Steps:** View hero status pill under CTAs
- **Expected:** No internal infra details on marketing surface
- **Actual:** “API connected · PostgreSQL · Redis (in-memory)”
- **Recommendation:** Remove status pill; replace in-memory Redis with managed Redis before scale
- **Screenshot:** [PLACEHOLDER — BUG-004]

### BUG-005 — Malformed PDF upload returns INTERNAL_ERROR 500
- **Severity:** High | **Priority:** P1
- **Page:** POST /api/v1/resumes/upload
- **Steps:** Upload tiny invalid %PDF stub as application/pdf
- **Expected:** 4xx validation / RES_* parse error
- **Actual:** 500 INTERNAL_ERROR “Something went wrong”
- **Recommendation:** Catch parser failures; map to RES_E00x without leaking stack
- **Screenshot:** [PLACEHOLDER — BUG-005]

### BUG-006 — Stored XSS payloads accepted in applications & feedback
- **Severity:** High | **Priority:** P0
- **Page:** /applications, feedback API
- **Steps:** POST /applications with title/companyName/notes containing `<script>` and onerror handlers
- **Expected:** Sanitize or reject HTML; encode on render
- **Actual:** 201 Created stores raw HTML/JS strings
- **Recommendation:** Server-side sanitize + React text nodes only; CSP tighten
- **Screenshot:** [PLACEHOLDER — BUG-006]

### BUG-007 — Frontend CSP allows 'unsafe-inline' and 'unsafe-eval'
- **Severity:** High | **Priority:** P1
- **Page:** All pages (Vercel headers)
- **Steps:** curl -I / and inspect Content-Security-Policy
- **Expected:** Nonce/hash-based CSP without unsafe-eval
- **Actual:** script-src 'self' 'unsafe-inline' 'unsafe-eval'
- **Recommendation:** Adopt nonces; remove eval; align FE CSP with stricter API Helmet CSP
- **Screenshot:** [PLACEHOLDER — BUG-007]

### BUG-008 — Register rate limit ~30 minutes blocks legitimate signup
- **Severity:** High | **Priority:** P1
- **Page:** /register
- **Steps:** Burst register attempts from same egress IP
- **Expected:** Per-email / sliding window with clear UX countdown
- **Actual:** 429 with retry_after_seconds ~1800–3500; validation sometimes still works
- **Recommendation:** Tune limits; show remaining wait; exclude pure validation failures
- **Screenshot:** [PLACEHOLDER — BUG-008]

### BUG-009 — Onboarding step API allows skipping career goal until complete
- **Severity:** Medium | **Priority:** P2
- **Page:** PATCH /onboarding/step
- **Steps:** Advance steps 3–6 without valid careerGoal; POST /complete
- **Expected:** Each step enforces required fields
- **Actual:** Steps advance with careerGoal null; complete fails late
- **Recommendation:** Server-side step schema validation matching FE wizard
- **Screenshot:** [PLACEHOLDER — BUG-009]

### BUG-010 — Invalid careerGoal error lists empty allowed values
- **Severity:** Low | **Priority:** P3
- **Page:** PATCH /onboarding/step
- **Steps:** Send careerGoal=software_engineer
- **Expected:** Message lists allowed enum values
- **Actual:** “careerGoal must be one of the following values: ” (empty)
- **Recommendation:** Include enum in class-validator message / custom pipe
- **Screenshot:** [PLACEHOLDER — BUG-010]

### BUG-011 — Pre-onboarding shell reachable for several app routes
- **Severity:** Medium | **Priority:** P2
- **Page:** /settings, /resume, /interviews, …
- **Steps:** Login verified user with onboardingCompleted=false; open /settings
- **Expected:** Hard redirect to /onboarding for all app chrome
- **Actual:** SSR serves app shell; APIs 403. /dashboard & /admin redirect correctly
- **Recommendation:** Unify middleware gate for all authenticated app segments
- **Screenshot:** [PLACEHOLDER — BUG-011]

### BUG-012 — Progress reports hasEnoughData=true with empty activity
- **Severity:** Medium | **Priority:** P2
- **Page:** /progress, /reports
- **Steps:** Complete onboarding only; GET /progress
- **Expected:** hasEnoughData false until meaningful signals exist
- **Actual:** readinessScore 13, hasEnoughData true, heatmap all zeros
- **Recommendation:** Require resume/interview/ATS signal thresholds
- **Screenshot:** [PLACEHOLDER — BUG-012]

### BUG-013 — Learning topics empty after onboarding complete
- **Severity:** High | **Priority:** P1
- **Page:** /learning
- **Steps:** Complete onboarding as Frontend; GET /learning/topics
- **Expected:** Seeded curriculum for track
- **Actual:** data: [] — feature appears unfinished
- **Recommendation:** Seed topics on onboarding complete or generate async job
- **Screenshot:** [PLACEHOLDER — BUG-013]

### BUG-014 — Missing favicon, OG tags, sitemap; robots Disallow all
- **Severity:** Medium | **Priority:** P2
- **Page:** Global SEO/chrome
- **Steps:** GET /favicon.ico (404); view meta robots noindex; robots.txt
- **Expected:** Brand icon + OG for shares; intentional noindex only while alpha
- **Actual:** 404 favicon; no og: tags; Disallow: /; meta noindex,nofollow
- **Recommendation:** Ship icons now; keep noindex until GA with checklist
- **Screenshot:** [PLACEHOLDER — BUG-014]

### BUG-015 — Premium billing advertised but not enforceable / checkout missing
- **Severity:** High | **Priority:** P1
- **Page:** /pricing
- **Steps:** Read pricing copy; probe /billing /subscription
- **Expected:** Working Stripe checkout or hide paid CTAs
- **Actual:** “Coming soon”; tier field ready; no checkout endpoints
- **Recommendation:** Either ship Stripe or mark tiers as waitlist-only
- **Screenshot:** [PLACEHOLDER — BUG-015]

### BUG-016 — GitHub OAuth unavailable while product surfaces GitHub nav
- **Severity:** Medium | **Priority:** P2
- **Page:** /github
- **Steps:** GET /github/status after onboarding
- **Expected:** Connect flow or hide nav item
- **Actual:** oauthAvailable:false, connected:false — dead-end feature
- **Recommendation:** Feature-flag nav until OAuth secrets configured
- **Screenshot:** [PLACEHOLDER — BUG-016]

### BUG-017 — API latency routinely 1–4s; roadmap generate ~10s
- **Severity:** High | **Priority:** P1
- **Page:** Authenticated APIs
- **Steps:** Time GET /settings, /reports, POST /roadmaps/generate
- **Expected:** p95 <500ms for reads; async jobs for generation
- **Actual:** settings ~4.5s; reports ~4s; generate ~9.7s synchronous
- **Recommendation:** Warm pools, indexes, background jobs + optimistic UI
- **Screenshot:** [PLACEHOLDER — BUG-017]

### BUG-018 — settings/export GET 404 vs privacy policy promise
- **Severity:** Medium | **Priority:** P2
- **Page:** /settings + Privacy Policy
- **Steps:** Privacy claims JSON export in Settings → Privacy; GET /settings/export
- **Expected:** Working export endpoint
- **Actual:** 404 Cannot GET /api/v1/settings/export
- **Recommendation:** Implement export or remove claim from legal copy
- **Screenshot:** [PLACEHOLDER — BUG-018]

### BUG-019 — X-Frame-Options inconsistency FE DENY vs API SAMEORIGIN
- **Severity:** Low | **Priority:** P3
- **Page:** Headers
- **Steps:** Compare response headers for / vs /api/v1/auth/session
- **Expected:** Consistent clickjacking policy
- **Actual:** DENY on FE, SAMEORIGIN on API
- **Recommendation:** Standardize on DENY / CSP frame-ancestors 'none'
- **Screenshot:** [PLACEHOLDER — BUG-019]

### BUG-020 — Search reflects script query string (reflected XSS risk if mishandled)
- **Severity:** Medium | **Priority:** P2
- **Page:** GET /search?q=
- **Steps:** Search q=\<script\>alert(1)\</script\>
- **Expected:** Encoded query echo only
- **Actual:** API returns raw script in query field — UI must not dangerouslySetInnerHTML
- **Recommendation:** Audit search UI rendering; add output encoding tests
- **Screenshot:** [PLACEHOLDER — BUG-020]

---

## UI / UX Findings

### UI
Cohesive CSS-variable design system (dark default #0b1120, primary #4f46e5, accent #8b5cf6). Split auth layout is solid. Issues: Inter-default look, purple/indigo SaaS cliché, footer encoding, empty theme-toggle placeholder before hydrate, missing favicon, feature cards reuse icons awkwardly (Learning uses arrow-right).

### UX
Information architecture is clear (Prepare / Practice / Track). Onboarding wizard is thoughtful. Confusion points: Learning empty, GitHub dead-end, Pricing “Coming soon” after Free CTA, progress “13% ready” with no activity, Cmd+K promised on 404 with empty search index. Excellent: coach tip to upload resume; cookie consent; alpha banner; password strength checklist.

---

## Accessibility (score 6.0)

**Positives:** lang=en; labeled inputs; show-password aria-label/pressed; mobile nav aria-expanded/controls; cookie region aria-label; role=alert on form errors; high-contrast + reduce-motion settings; offline banner.

**Gaps:** muted text #64748b on #0b1120 is borderline; focus-visible not fully verified without browser; no skip-link observed in SSR; decorative Lucide icons correctly aria-hidden. Recommend axe + keyboard pass before GA.

---

## Performance

| Surface | Observed | Note |
|---------|----------|------|
| Marketing HTML TTFB | ~70–500ms | Cold homepage slower; pricing/login warm fast |
| JS chunks 335 / 210a | ~173KB each | Reasonable for Next app; still watch totals |
| CSS | ~41KB | Tailwind v4 |
| GET /auth/session | ~0.3–3s | High variance — likely cold start / remote DB |
| GET /settings | ~4.5s | Too slow for settings page |
| POST /roadmaps/generate | ~9.7s | Should be async job + polling |

---

## Security Summary

**Strengths:** HttpOnly+Secure+SameSite=Lax cookies; 15m access / 7d refresh; open-redirect guard on next=; email verify gate; admin role check; file type allowlist (PDF/DOCX); forgot-password anti-enumeration; structured error codes; API Helmet-like headers; rate limiting present.

**Weaknesses:** verificationUrl leak (P0); stored HTML in apps/feedback; CSP unsafe-eval on FE; HS256 JWT (secret strength unknown); refresh cookie Path=/; in-memory Redis; no CSRF token (cookie SameSite=Lax mitigates somewhat for cross-site POSTs).

---

## Product / Monetization

Comparable category: SensAI, AscendIQ, PrepMeUp-style AI career copilots. PrepmeAI’s differentiator is breadth (ATS + interviews + roadmap + applications board + a11y settings). Users would enjoy the free tier once Learning/Resume paths feel complete. Paying $19/mo is plausible for voice + coding + PDF reports — but checkout is absent, so monetization today is aspirational. Retention hinges on roadmap streaks and weekly digests (templates exist in settings). Onboarding is good; add a forced “upload resume” climax. Unnecessary until OAuth works: GitHub nav item. Missing: social proof, sample outcomes, community, mobile app, LinkedIn import.

---

## Top 25 Must-Fix Before Launch

1. Remove verificationUrl from register responses outside local/dev
2. Remove Dev verification link UI from production builds
3. Sanitize/encode all user-generated HTML fields (applications, notes, feedback, JD text)
4. Replace in-memory Redis; remove infra status from marketing hero
5. Fix resume upload 500s into typed validation errors
6. Tighten CSP (drop unsafe-eval); align FE/API headers
7. Ship or hide Premium/Stripe; don't advertise unpaid entitlements as available soon without waitlist
8. Seed learning topics (or hide Learning until ready)
9. Unify onboarding middleware for every app route
10. Cut p95 API latency below 500ms for core reads
11. Add favicon + basic OG image
12. Fix © / UTF-8 footer encoding
13. Feature-flag GitHub until OAuth works
14. Implement settings export promised in Privacy Policy
15. Tune register rate limits + UX countdown
16. Validate onboarding steps server-side per step
17. Fix hasEnoughData / readiness scoring honesty
18. Add Confirm password on reset-password for parity with register UX
19. Map AUTH_EMAIL_ALREADY_EXISTS clearly when rate limit not hit
20. Add Playwright smoke suite for auth + onboarding + resume
21. Add axe CI checks on marketing + app shell
22. Instrument Sentry/OpenTelemetry with request_id correlation
23. Document alpha data retention for resumes/transcripts
24. Hide Cmd+K tip on 404 until search indexes real content
25. Load-test interview /turn and ATS analyze under concurrency

---

## Top 25 World-Class Improvements

1. Guided first-run checklist with progress that unlocks ATS/interview
2. Sample resume + sample JD demo mode without upload friction
3. Explainable ATS score UI with keyword diffs and rewrite suggestions
4. Interview playback timeline with score dimensions
5. Optimistic skeletons instead of full-page Loading… shells
6. Empty states with one primary CTA (not sparse “No interviews yet”)
7. Mobile bottom nav for Prepare / Practice / Track
8. Command palette (Cmd+K) with recent items + keyboard help
9. Onboarding skip/advanced mode for experienced users
10. Role-based interview packs (Frontend, Backend, etc.)
11. Weekly email digest tied to roadmap tasks
12. Streaks that feel earned (not zero-filled heatmaps)
13. Portfolio analyze with public URL preview cards
14. Cover letter side-by-side JD comparison
15. Application kanban polish: drag affordances + undo
16. Billing portal with usage meters for free-tier soft limits
17. SSO path stub for Enterprise narrative
18. Trust center: SOC2 roadmap, subprocessors, DPA
19. Public changelog from alpha → beta → GA
20. Brand illustration system beyond Lucide graduation-cap
21. Motion: page transitions + success confetti sparingly
22. Dark/light marketing parity review
23. Accessible focus rings on all interactive surfaces
24. Form error linking (aria-describedby) everywhere
25. Toast system with undo for destructive actions

---

## Final Answers

| Question | Answer |
|----------|--------|
| 1. Is this production-ready? | **No** |
| 2. Would you launch publicly? | **No** — keep closed alpha / invite-only |
| 3. Would recruiters be impressed? | Moderately–highly for scope and auth hygiene; docked for alpha polish and security leak |
| 4. Would investors be impressed? | As a prototype/alpha: yes on vision. As a fundable GA product: not yet — need security fix, billing, retention loops, and performance |

---

## Test Account Created During Audit

**Email:** `qa.fullaudit.1757191779@mailinator.com`  

Verify/delete in admin if this environment is shared. Verification was completed via API-returned token (demonstrating BUG-001).

---

*Source: live probing of prepme-ai-web.vercel.app · 2026-08-05 · Overall 5.5/10*
