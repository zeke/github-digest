# github-digest

A little agent that checks GitHub every morning for things you might have
missed — unread notifications, PRs waiting on your review, issues assigned to
you — and emails you a short digest.

It's a demo of the [Flue](https://flueframework.com) agent framework: one
tool, one agent, one script, run on a schedule by GitHub Actions. No server to
host, no dashboard to check. The email either lands in your inbox or it
doesn't need to.

## Example

A real digest email, screenshotted straight from an inbox:

![Example digest email showing Needs your attention (Pull Requests and Issues) and Highlights sections](./docs/example-digest.jpg)

## How it works

This project is a small, complete tour of [Flue](https://flueframework.com)'s
core pieces. Here's what happens on every run, in order:

1. **A trigger fires.** GitHub Actions runs on a schedule (or you trigger it
   manually) and invokes a plain Node script — no server, no `app.ts`, just
   [`start()`](https://flueframework.com/docs/guide/workflows/) booting the
   Flue runtime for the duration of one script.
2. **The script starts an agent.** `init()` gets a handle to the
   `GithubDigest` [agent](https://flueframework.com/docs/guide/building-agents/)
   — a plain TypeScript function marked with `'use agent'` — and `dispatch()`
   sends it a message: "Produce today's digest."
3. **The agent calls a tool.** `GithubDigest` mounts one
   [tool](https://flueframework.com/docs/guide/tools/), `github_activity`,
   with `useTool()`. The model decides to call it; Flue validates the (empty)
   input, runs the tool's code, and hands the result back to the model.
4. **The tool hits the GitHub API.** Octokit fetches unread notifications,
   pull requests, assigned issues, and starred-repo activity, then a pure
   function shapes it all into one typed structure — no LLM involved yet.
5. **The model writes the digest.** `useModel('cloudflare-ai-gateway/claude-sonnet-5')`
   routes the actual inference call through [Cloudflare AI
   Gateway](https://developers.cloudflare.com/ai-gateway/) with Unified
   Billing, so the project needs zero Anthropic API keys — just a Cloudflare
   account. The model reads the tool's output and writes the email body as
   Markdown.
6. **The script reads the settled reply.** `agent.read(receipt)` awaits the
   durable result of that one exchange — the same call works whether the
   model answered instantly or the process had to recover mid-run.
7. **The email goes out.** The script converts the Markdown to HTML and POSTs
   it to the Cloudflare Email Sending API. No email provider SDK, no Resend
   account.

See [AGENTS.md](./AGENTS.md#layout) for the file-by-file breakdown — most of
what makes this work is Flue's hooks (`useModel`, `useTool`) and runtime
(`start`, `init`, `dispatch`), not custom plumbing.

## Run your own

This repo is meant to be forked. It uses Cloudflare AI Gateway (so no
Anthropic API key) and Cloudflare Email Sending (so no separate email
provider) — see [AGENTS.md](./AGENTS.md) for the full setup, including which
secrets to create and where.

## License

MIT
