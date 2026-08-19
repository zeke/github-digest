# github-digest

A [Flue](https://flueframework.com) agent project.

## Setup

```sh
npm install
```

Then add a model provider API key to `.env` (any [provider Pi supports](https://pi.dev/docs/latest/providers#api-keys)).

## Talk to your agent

```sh
npx flue run src/agents/hello.ts --message "Say hello!"
```

Conversations are durable — pass `--id <id>` to continue one.

## Learn more

- [Flue docs](https://flueframework.com/docs/) — or `npx flue docs` from the terminal.
