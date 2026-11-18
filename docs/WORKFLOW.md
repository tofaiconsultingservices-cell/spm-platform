# How we run work on sanpedromotocare.com

One place for everything: **GitHub Issues + a GitHub Project board**. Agents and people get the same kind of task, follow the same rules (`AGENTS.md`), and ship through the same pipeline (PR → CI → review → merge → Vercel).

```
 Idea / bug ──► Issue (template) ──► status:ready ──► agent:claude label ──► PR ──► CI ✅ ──► you review ──► merge ──► Vercel deploys
                                        │                  or a person
                                        └─ status:blocked if the agent has questions
```

## One-time setup (≈15 min)
1. **Merge this PR**, then run **Actions → Sync labels → Run workflow**.
2. **Claude agent:** in Claude Code run `/install-github-app` for this repo (or install the Claude GitHub App), then add repo secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions).
3. **Board:** create a GitHub Project (Board view) named "SPM", link this repo, columns: Backlog · Ready · In progress · Blocked · Review · Done. Turn on the built-in workflows "Item added → Backlog", "PR merged → Done".
4. **Protect `master`:** Settings → Branches → require a PR, require the CI checks, require 1 approval. This is what keeps agents from shipping unreviewed code.
5. (Optional) **Copilot coding agent:** if you have it, assign an issue to Copilot — it reads the same `AGENTS.md`.

## Daily routine
| When | What |
|---|---|
| 7:45 AM | The **Plan del día** issue appears automatically: overdue, due today, P0/P1, blocked, PRs waiting. Close it when done. |
| Morning (10 min) | Answer every `status:blocked` question. Move 2–4 well-written issues to `status:ready` and add `agent:claude`. |
| During the day | Agents open PRs. Open the Vercel preview link on each PR, check it on your phone. |
| End of day (15 min) | Review PRs → approve/merge or comment `@claude change X`. Anything touching payments/auth/rules gets a careful look. |

## Writing a good agent task
An agent does exactly what the issue says, so the issue *is* the spec:
- **Goal:** one sentence of the business outcome ("Staff can see and update online-store orders").
- **Acceptance criteria:** checkable bullets, including the test.
- **Start here:** file paths from the map in `AGENTS.md`.
- **Out of scope:** what not to touch.
- Size: one PR, under a day of work. Split anything bigger.

## Talking to the agent
- On an issue: add label `agent:claude` → it implements and opens a PR.
- On a PR: comment `@claude the button should say "Agendar" and be orange` → it pushes a fix.
- Questions: `@claude how does adjustStock handle concurrent sales?` → it answers in a comment.

## First backlog (from HANDOFF.md / RELEASE.md)
| # | Task | Area | Prio | Who |
|---|---|---|---|---|
| 1 | Fix `scripts/seed-motocruz.ts` and commit inventory files (HANDOFF §4) | Store | P0 | Human (needs `.env.local` + live Firestore) |
| 2 | CRM `/crm/pedidos`: list + manage store orders (pendiente-pago → entregado) using `lib/firestore/store-orders.ts` | CRM | P1 | Agent |
| 3 | Move `tarea pendiente*.txt` into `docs/archive/` and clean repo root | Docs | P3 | Agent |
| 4 | CAPTCHA on quote form and login | Landing | P1 | Agent → `needs-owner-review` |
| 5 | Firebase App Check | Infra | P2 | Agent → `needs-owner-review` |
| 6 | Playwright E2E for quote → ticket → payment | Infra | P2 | Agent |
| 7 | Make lint blocking in CI (remove `\|\| true`) after fixing warnings | Infra | P2 | Agent |
| 8 | Sentry or Datadog error monitoring | Infra | P2 | Agent |
| 9 | Review/finish Christmas "Pro Rider" promo + helmet-raffle signup (draw Dec 24) — `components/landing/PromoSection.tsx` | Landing | P0 | Agent |
