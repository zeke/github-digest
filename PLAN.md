# Plan: GitHub Digest

A small open-source demo of the [Flue](https://flueframework.com) agent framework: a
scheduled agent that checks GitHub for things you might have missed — unread
notifications (covers watched-repo activity), PRs awaiting your review, and
issues/PRs assigned to you — and emails a prioritized digest.

This file tracks the build plan and is deleted (or trimmed to a changelog) once
the project is stable. Ongoing project knowledge lives in `AGENTS.md`.

## Goals

- Very simple, readable demo of a Flue agent + tool.
- Runs on a schedule via GitHub Actions — no server to host.
- Model calls go through Cloudflare AI Gateway with Unified Billing (no
  Anthropic API key needed).
- Email sent via Cloudflare Email Sending (no Resend).
- Friendly for other people to fork and run themselves.

## Architecture

- `src/tools/github-activity.ts` — Octokit-backed Flue tool. Fetches unread
  notifications, review-requested PRs, and assigned issues/PRs.
- `src/agents/github-digest.ts` — `GithubDigest` agent. Model:
  `cloudflare-ai-gateway/claude-sonnet-5`. Mounts the tool. Instructions: fetch
  activity, produce a digest split into "needs your action" vs "FYI".
- `scripts/send-digest.ts` — plain Node script. Uses Flue's JS API
  (`start()`/`init()`) to run the agent once, then POSTs the result as an email
  via the Cloudflare Email Sending REST API.
- `.github/workflows/digest.yml` — runs `send-digest.ts` on a schedule, plus
  `workflow_dispatch` for manual/off-schedule runs.
- `.github/workflows/ci.yml` — lint, typecheck, test on push/PR.

## Scheduling and DST

Cron in GitHub Actions is UTC-only and doesn't shift with daylight saving. To
land at 8am Pacific year-round without hand-editing the file twice a year:

```yaml
on:
  schedule:
    - cron: '0 15 * * *'   # 8am PDT (UTC-7)
    - cron: '0 16 * * *'   # 8am PST (UTC-8)
  workflow_dispatch: {}
```

Both crons fire daily. A step computes the actual Pacific-time hour
(`TZ=America/Los_Angeles date +%H`) and only runs the send step when it equals
`08`. The cron line that doesn't match Pacific 8am on a given day is a no-op.
`workflow_dispatch` always sends, regardless of the hour, so it works as an
on-demand test.

## Cloudflare AI Gateway (Unified Billing)

Model specifier: `cloudflare-ai-gateway/claude-sonnet-5`. Flue/Pi's built-in
`cloudflare-ai-gateway` provider reads these env vars:

- `CLOUDFLARE_API_KEY` — an Authenticated Gateway "Run" token
- `CLOUDFLARE_ACCOUNT_ID` — `d37edcc2a3a79f5a6df92ad287430b02`
- `CLOUDFLARE_GATEWAY_ID` — the gateway's slug, e.g. `github-digest`

Setup requires the Cloudflare dashboard (no API scope for this in the
`wrangler` OAuth token):

1. Create an AI Gateway named `github-digest`.
2. Turn on Authenticated Gateway, generate a Run-scoped token.
3. Confirm Unified Billing has credits loaded (manual dashboard purchase —
   can't be scripted).

## Email

Cloudflare Email Sending REST API, from `digest@ziki.boo` to
`zeke@sikelianos.com`. `ziki.boo` is already enabled for sending. Needs a
Cloudflare API token scoped to `Email Sending: Edit`.

## Secrets (repo secrets via `gh secret set`)

| secret               | source                                          | mapped to              |
| -------------------- | ------------------------------------------------ | ----------------------- |
| `DIGEST_GITHUB_TOKEN` | GitHub classic PAT, `notifications` + `repo` read | Octokit auth            |
| `CF_AI_GATEWAY_TOKEN` | Cloudflare dashboard, Authenticated Gateway token | `CLOUDFLARE_API_KEY`    |
| `CF_ACCOUNT_ID`       | known value                                       | `CLOUDFLARE_ACCOUNT_ID` |
| `CF_AI_GATEWAY_ID`    | set when creating the gateway                     | `CLOUDFLARE_GATEWAY_ID` |
| `CF_EMAIL_TOKEN`      | Cloudflare dashboard, `Email Sending: Edit` token  | Email Sending API call  |

No `ANTHROPIC_API_KEY` — Unified Billing covers model cost.

## Tooling

- **Lint/format:** Biome.
- **Tests:** Vitest — pure-logic unit tests only (notification grouping,
  email body building, DST-gate hour check). No live API calls in CI.
- **Typecheck:** `tsc --noEmit`.
- **License:** MIT.

## Repo layout

```
.github/workflows/ci.yml
.github/workflows/digest.yml
src/agents/github-digest.ts
src/tools/github-activity.ts
scripts/send-digest.ts
scripts/dst-gate.test.ts (etc. — colocated *.test.ts files)
flue.config.ts
vite.config.ts
.env.example
AGENTS.md
README.md
LICENSE
```

## Build order

1. `flue init` scaffold, adapt for this project (Node target).
2. `github-activity` tool + unit tests for its formatting logic.
3. `github-digest` agent wired to the tool and the AI Gateway model.
4. `send-digest` script (agent run + Cloudflare email call) + unit tests for
   the email body builder.
5. Local end-to-end test with `flue run` / the script directly, using real
   credentials in a local `.env` (once tokens exist).
6. Biome + Vitest + `ci.yml`.
7. `digest.yml` with the DST gate.
8. README + AGENTS.md + LICENSE.
9. Cloudflare dashboard setup (AI Gateway, tokens) via devtools.
10. GitHub classic PAT via devtools.
11. Set all repo secrets, push, trigger `workflow_dispatch` as a live test.

Commit at each numbered step once it's working.
