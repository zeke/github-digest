import { init } from '@flue/runtime';
import { start } from '@flue/runtime/node';
import { GithubDigest } from '../src/agents/github-digest.ts';
import { buildDigestEmail } from './format-email.ts';
import { sendEmail } from './send-email.ts';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

async function main() {
	// No persistent db: each run is a one-shot request/response, and GitHub
	// Actions runners are ephemeral anyway. See src/db.ts for the adapter
	// `flue run` uses for local interactive testing.
	await using flue = await start({ agents: [GithubDigest] });

	const now = new Date();
	const agent = init(GithubDigest, { id: `digest-${now.toISOString().slice(0, 10)}` });
	const receipt = await agent.dispatch("Produce today's digest.");
	const reply = await agent.read(receipt);

	const email = buildDigestEmail(reply.text, now);
	await sendEmail({ accountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'), apiToken: requireEnv('CF_EMAIL_TOKEN') }, email);

	console.log(`Sent: ${email.subject}`);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
