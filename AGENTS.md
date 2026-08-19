# AGENTS.md

Technical reference for working on this project. See [README.md](./README.md)
for what this project is and why it exists.

**Keep this file up to date.** Whenever you change the architecture, scripts,
secrets, or scheduling behavior, update the relevant section below in the same
change. This file is the source of truth for how the project actually works,
not a snapshot of how it worked when it was built.

## Stack

- [Flue](https://flueframework.com) (`@flue/runtime`, `@flue/cli`), Node target — no server, no `app.ts`.
- `@octokit/rest` for GitHub API calls.
- Model calls route through Cloudflare AI Gateway with Unified Billing (no direct Anthropic key).
- Email sent via the Cloudflare Email Sending REST API (no Resend).
- Biome for lint + format, Vitest for tests, `tsc --noEmit` for typechecking.
- Node >= 22.19.

## Layout

- `src/tools/github-activity.ts` — Octokit tool. `fetchGithubActivity()` hits the GitHub API (REST for notifications/search, GraphQL for starred-repo highlights); `formatGithubActivity()` is the pure mapping/formatting step, unit-tested in the colocated `.test.ts`.
- `src/agents/github-digest.ts` — the `GithubDigest` agent. Model: `cloudflare-ai-gateway/claude-sonnet-5`. Mounts the tool, instructs the model to fetch activity once and write the email body as Markdown.
- `scripts/format-email.ts` — pure functions: Markdown → HTML (the small subset the agent's prompt actually produces — headings, bullets, links), Pacific-date formatting, and the full email payload builder. Unit-tested.
- `scripts/send-email.ts` — the Cloudflare Email Sending API client. Unit-tested with a mocked `fetch`.
- `scripts/send-digest.ts` — the entrypoint. Boots Flue with `start()` (in-memory, no db — see below), runs the agent once, sends the email, exits.
- `src/db.ts` — sqlite adapter, used only when running agents interactively via `flue run` for local testing. `send-digest.ts` intentionally does not use it.

## Why no database in the production script

Each digest run is a single fire-and-forget request/response, and GitHub
Actions runners are ephemeral, so there's nothing to persist between runs.
`scripts/send-digest.ts` calls `start({ agents: [GithubDigest] })` with no `db`
option — state lives in memory for the run's duration only. `src/db.ts` still
exists for local interactive development: `flue run` uses it automatically so
you can continue a conversation across separate manual invocations while
iterating on the agent's prompt.

## Scheduling and DST

`.github/workflows/digest.yml` has two `schedule:` cron lines — `0 15 * * *`
and `0 16 * * *` UTC — because GitHub Actions cron is UTC-only and doesn't
shift with daylight saving. One of those two times is 8am Pacific on any given
day; the other is 7am or 9am. A step in the workflow computes the actual
Pacific hour (`TZ=America/Los_Angeles date +%H`) and only runs the send step
when it's `08`. This means the workflow effectively runs twice a day but sends
once. `workflow_dispatch` (manual trigger) bypasses the hour check entirely,
so it always sends — that's the way to test on demand:

```sh
gh workflow run digest.yml
```

or from the Actions tab in GitHub's UI.

## Secrets

Set with `gh secret set <name>` on the repo, or in Settings → Secrets and
variables → Actions.

| secret                 | value comes from                                                              | mapped to (env var the code reads) |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `DIGEST_GITHUB_TOKEN`   | GitHub classic PAT with `notifications` + `repo` (read) scope                  | `DIGEST_GITHUB_TOKEN`                |
| `CF_AI_GATEWAY_TOKEN`   | Cloudflare dashboard → AI Gateway → the gateway's Authenticated Gateway token   | `CLOUDFLARE_API_KEY`                 |
| `CF_ACCOUNT_ID`         | Cloudflare account ID (`wrangler whoami`)                                       | `CLOUDFLARE_ACCOUNT_ID`              |
| `CF_AI_GATEWAY_ID`      | the gateway's slug, e.g. `github-digest`                                       | `CLOUDFLARE_GATEWAY_ID`              |
| `CF_EMAIL_TOKEN`        | Cloudflare dashboard → API Tokens → custom token scoped to `Email Sending: Edit` | `CF_EMAIL_TOKEN`                     |

No `ANTHROPIC_API_KEY` — Cloudflare Unified Billing covers the model cost
against the Cloudflare account's prepaid AI Gateway credits.

### Why a classic GitHub PAT, not fine-grained

The `notifications` scope (needed to read unread notifications across every
repo you watch) only exists on classic personal access tokens. Fine-grained
PATs don't expose it. Classic PAT creation isn't scriptable via `gh api` —
create it at <https://github.com/settings/tokens>.

### Cloudflare AI Gateway setup (one-time, dashboard only)

`wrangler`'s OAuth token doesn't carry AI Gateway management scope, so this
can't be done via CLI:

1. Cloudflare dashboard → AI Gateway → create a gateway (this repo assumes the slug `github-digest`).
2. Gateway settings → turn on Authenticated Gateway → generate a token with `Run` permission. That's `CF_AI_GATEWAY_TOKEN`.
3. Confirm the account has Unified Billing credits loaded (AI Gateway → Credits Available → Manage). This is a real payment/top-up step and can't be scripted.

## Local development

```sh
npm install
cp .env.example .env   # fill in real values
npm run check:types
npm run lint
npm test
npx flue run src/agents/github-digest.ts --message "Produce today's digest."
npm run digest          # runs the real send-digest.ts end to end, including the email send
```

`flue run` is good for iterating on the agent's prompt/tool without sending a
real email. `npm run digest` is the actual production path — it will send a
real email to `zeke@sikelianos.com` if the Cloudflare Email Sending
credentials are valid.

## Highlights (starred-repo activity)

GitHub has no "follow a repo" feature distinct from starring or watching —
only starring, watching, and following *users* exist. Watched-repo activity
is already covered by notifications, so "highlights" means recent activity on
**starred** repos: a new release, or a push, in the last 24 hours (a release
wins over a plain push when both happened — see `mapHighlight()`).

This is fetched via one GraphQL query (`fetchStarredRepos()`), not the REST
search/notifications endpoints, because it needs `pushedAt` and the latest
release for every starred repo in a single round trip. Octokit's REST client
still exposes `.graphql()` for this — no extra dependency. Capped at the
first 100 starred repos (GraphQL's per-page max); not paginated further.

## Gotchas

- GitHub's notification `subject.url` field is an API URL
  (`api.github.com/repos/...`), not a browsable link, and pull request API
  URLs use `/pulls/` while the browsable URL uses `/pull/`. Both conversions
  live in `apiUrlToHtmlUrl()` in `src/tools/github-activity.ts` — don't
  duplicate this logic elsewhere.
- The Cloudflare Email Sending REST API's `from` object uses `address`, not
  `email` (that's the Workers-binding field name — this project doesn't use
  the binding since it's not a Worker).
- The `cloudflare-ai-gateway` Pi/Flue provider reads `CLOUDFLARE_API_KEY`,
  `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_GATEWAY_ID` from the environment —
  those exact names, not configurable per call. The workflow and `.env.example`
  map the more descriptively-named secrets onto these at the env level.
