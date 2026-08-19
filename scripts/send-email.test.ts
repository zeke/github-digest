import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DigestEmail } from './format-email.ts';
import { sendEmail } from './send-email.ts';

const email: DigestEmail = {
	to: 'zeke@sikelianos.com',
	from: { address: 'digest@ziki.boo', name: 'GitHub Digest' },
	subject: 'GitHub Digest — Aug 19, 2026',
	html: '<p>Nothing new today.</p>',
	text: 'Nothing new today.',
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('sendEmail', () => {
	it('POSTs the email to the Cloudflare Email Sending API', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			json: async () => ({ success: true, errors: [], result: { delivered: [email.to], permanent_bounces: [], queued: [] } }),
		});
		vi.stubGlobal('fetch', fetchMock);

		await sendEmail({ accountId: 'acct-123', apiToken: 'token-abc' }, email);

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.cloudflare.com/client/v4/accounts/acct-123/email/sending/send',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ authorization: 'Bearer token-abc' }),
				body: JSON.stringify(email),
			}),
		);
	});

	it('throws when Cloudflare reports failure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ success: false, errors: [{ code: 1000, message: 'Sender domain not verified' }], result: null }),
			}),
		);

		await expect(sendEmail({ accountId: 'acct-123', apiToken: 'token-abc' }, email)).rejects.toThrow(
			'Sender domain not verified',
		);
	});
});
