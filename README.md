# GitHub Digest

This is a simple automation that emails me a daily summary of GitHub activity
for repos I'm watching.

It uses the [Flue](https://flueframework.com) framework, [Cloudflare AI
Gateway](https://developers.cloudflare.com/ai-gateway/), [Cloudflare Email
Service](https://developers.cloudflare.com/email-routing/), GitHub Actions,
and the GitHub API.

## Example

Here's an example screenshot of the email output:

![Example digest email showing Needs your attention (Pull Requests and Issues) and Highlights sections](./docs/example-digest.jpg)

## How it works

1. **A trigger fires.** GitHub Actions runs on a schedule (or I trigger it
   manually) and invokes `scripts/send-digest.ts`, a plain Node script — no
   server, no Cloudflare Worker, no `app.ts`, just
   [`start()`](https://flueframework.com/docs/guide/workflows/) booting the
   Flue runtime in-process for the life of that script, on the GitHub Actions
   runner.
2. **The script starts an agent.** `init()` gets a handle to the
   `GithubDigest` [agent](https://flueframework.com/docs/guide/building-agents/),
   a plain TypeScript function marked with `'use agent'`. `dispatch()` sends
   it a message: "Produce today's digest."
3. **The agent calls a tool.** `GithubDigest` mounts one
   [tool](https://flueframework.com/docs/guide/tools/), `github_activity`,
   with `useTool()`. The model decides to call it, Flue validates the input,
   runs the tool's code, and hands the result back.
4. **The tool hits the GitHub API.** Octokit fetches unread notifications,
   pull requests, assigned issues, and starred-repo activity. A pure function
   shapes all of it into one typed structure — no LLM involved yet.
5. **The model writes the digest.** `useModel('cloudflare-ai-gateway/claude-sonnet-5')`
   routes the actual inference call through [Cloudflare AI
   Gateway](https://developers.cloudflare.com/ai-gateway/) with Unified
   Billing, so this project needs zero Anthropic API keys, just a Cloudflare
   account. The model reads the tool's output and writes the email body as
   Markdown.
6. **The script reads the settled reply.** `agent.read(receipt)` waits for
   the durable result of that one exchange. Same call whether the model
   answered instantly or the process had to recover mid-run.
7. **The email goes out.** The script converts the Markdown to HTML and POSTs
   it to the Cloudflare Email Sending API. No email SDK, no Resend account.

See [AGENTS.md](./AGENTS.md#layout) for the file-by-file breakdown. Most of
what makes this work is Flue's hooks (`useModel`, `useTool`) and runtime
(`start`, `init`, `dispatch`), not custom plumbing.

## Run your own

Fork it. It uses Cloudflare AI Gateway and Cloudflare Email Sending, so there's
no Anthropic key and no separate email provider to sign up for — see
[AGENTS.md](./AGENTS.md) for the full setup, including which secrets to create
and where.

## License

MIT
