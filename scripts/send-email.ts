import type { DigestEmail } from './format-email.ts';

export interface CloudflareEmailConfig {
	accountId: string;
	apiToken: string;
}

interface CloudflareEmailResponse {
	success: boolean;
	errors: Array<{ code: number; message: string }>;
	result: {
		delivered: string[];
		permanent_bounces: string[];
		queued: string[];
	} | null;
}

// Sends via the Cloudflare Email Sending REST API. The `from` domain
// (ziki.boo) must already be onboarded: `npx wrangler email sending enable`.
export async function sendEmail(
	config: CloudflareEmailConfig,
	email: DigestEmail,
): Promise<void> {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${config.apiToken}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(email),
		},
	);

	const data = (await response.json()) as CloudflareEmailResponse;
	if (!data.success) {
		throw new Error(
			`Cloudflare Email Sending failed: ${JSON.stringify(data.errors)}`,
		);
	}
}
