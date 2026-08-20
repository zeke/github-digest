# github-digest

I used to open GitHub every morning and scroll through a pile of notifications
trying to figure out what actually needed me. Most of it didn't. So I built a
little agent that does the scrolling for me and just emails me the parts that
matter: unread notifications, PRs waiting on my review, issues assigned to me,
and anything new on repos I've starred.

It's also a demo of [Flue](https://flueframework.com), the agent framework
it's built on. One tool, one agent, one script, run on a schedule by GitHub
Actions. No server to host, no dashboard to check. The email either lands in
my inbox or it doesn't need to.

## Example

A real digest email, screenshotted straight from my inbox:

![Example digest email showing Needs your attention (Pull Requests and Issues) and Highlights sections](./docs/example-digest.jpg)

## How it works

I wanted this repo to double as a tour of Flue's core pieces, not just a
working script. Here's what happens on every run, in order.

1. **A trigger fires.** GitHub Actions runs on a schedule (or I trigger it
   manually) and invokes a plain Node script — no server, no `app.ts`, just
   [`start()`](https://flueframework.com/docs/guide/workflows/) booting the
   Flue runtime for the life of one script.
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
