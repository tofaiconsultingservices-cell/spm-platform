<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SPM Platform — rules for every agent (Claude, Copilot, Grok, humans)

sanpedromotocare.com: landing + online store + customer portal + CRM for San Pedro Moto Care.
Stack: Next.js 16 (App Router), React 19, Tailwind 4, Firebase (Auth, Firestore, FCM), Stripe, Twilio, Gemini/Mistral. Deployed on Vercel from `master`.

## Where things live
| Area | Paths |
|---|---|
| Landing | `app/page.tsx`, `components/landing/*` |
| Store / inventory | `app/(public)/tienda`, `app/api/products`, `app/api/vendors`, `lib/firestore/*` |
| Customer portal | `app/(portal)/portal`, `components/portal/*` |
| CRM | `app/(crm)/crm/*`, `components/crm/*`, `app/api/crm/*` |
| Payments | `app/api/payments/*` (Stripe Checkout Sessions, OXXO) |
| Voice / WhatsApp | `app/api/voice/*`, `app/api/notifications/*` |
| Shared types | `types/index.ts` (ServiceType, statuses, labels) |
| Security | `firestore.rules`, `firestore.indexes.json`, `proxy.ts` |
| Tests | `tests/**` (Vitest + happy-dom) |
Background docs: `HANDOFF.md` (current state + next task), `TECHNICAL.md`, `PLATFORM.md`, `RELEASE.md`.

## How work arrives
Every task is a GitHub Issue made from a template. Work only on what the issue's **Acceptance criteria** ask. If something is unclear, comment on the issue with your question and stop — don't guess on payments, auth, Firestore rules, or customer data.

## Workflow
1. Branch from `master`: `agent/<issue-number>-<short-slug>` (humans: `feat/…`, `fix/…`).
2. Small commits, Conventional Commits: `feat(crm): …`, `fix(store): …`, `chore: …`.
3. Before opening a PR, run and pass:
   ```bash
   npm ci
   npm run typecheck
   npm run lint
   npm test
   ```
4. Open a PR that says `Closes #<issue>` and fills in the PR template. Never push to `master` directly. Never merge your own PR.

## Hard rules
- Never commit secrets or `.env*` files. New env vars go in the PR description and in `RELEASE.md` § Variables de entorno.
- Changes to `firestore.rules`, `app/api/payments/*`, `app/api/auth/*` or `proxy.ts` need the `needs-owner-review` label and a test.
- Keep UI text in Spanish (es-MX); add strings through `contexts/LanguageContext.tsx`, not hard-coded.
- Contact number on customer-facing pages: WhatsApp 81 3388-0010.
- New API routes get a test in `tests/api/`. Keep coverage ≥ 70% (CI enforces it).
- Don't add dependencies without saying why in the PR.
- Update `HANDOFF.md` § "Siguiente tarea" when you finish something it lists.
