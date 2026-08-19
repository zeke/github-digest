# github-digest

A little agent that checks GitHub every morning for things you might have
missed — unread notifications, PRs waiting on your review, issues assigned to
you — and emails you a short digest.

It's a demo of the [Flue](https://flueframework.com) agent framework: one
tool, one agent, one script, run on a schedule by GitHub Actions. No server to
host, no dashboard to check. The email either lands in your inbox or it
doesn't need to.

## Example

> **Needs your action**
> - Review [Add retry logic](https://github.com/acme/api/pull/42) in `acme/api`
> - Respond on [Deploy failing on staging](https://github.com/acme/infra/issues/9), assigned to you
>
> **FYI**
> - `acme/api`: 3 new commits merged to main
> - `acme/docs`: your comment got a reply

## Run your own

This repo is meant to be forked. It uses Cloudflare AI Gateway (so no
Anthropic API key) and Cloudflare Email Sending (so no separate email
provider) — see [AGENTS.md](./AGENTS.md) for the full setup, including which
secrets to create and where.

## License

MIT
