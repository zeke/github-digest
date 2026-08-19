import { describe, expect, it } from 'vitest';
import { apiUrlToHtmlUrl, formatGithubActivity, repoFullNameFromApiUrl } from './github-activity.ts';

describe('apiUrlToHtmlUrl', () => {
	it('converts an issue API URL to its browsable URL', () => {
		expect(apiUrlToHtmlUrl('https://api.github.com/repos/zeke/github-digest/issues/12')).toBe(
			'https://github.com/zeke/github-digest/issues/12',
		);
	});

	it('converts a pull request API URL, singularizing /pulls/ to /pull/', () => {
		expect(apiUrlToHtmlUrl('https://api.github.com/repos/zeke/github-digest/pulls/12')).toBe(
			'https://github.com/zeke/github-digest/pull/12',
		);
	});
});

describe('repoFullNameFromApiUrl', () => {
	it('extracts owner/repo from a repository API URL', () => {
		expect(repoFullNameFromApiUrl('https://api.github.com/repos/zeke/github-digest')).toBe('zeke/github-digest');
	});

	it('falls back when the URL does not match the expected shape', () => {
		expect(repoFullNameFromApiUrl('not-a-url')).toBe('unknown/unknown');
	});
});

describe('formatGithubActivity', () => {
	it('maps notifications and search items into ActivityItems', () => {
		const result = formatGithubActivity({
			notifications: [
				{
					subject: { title: 'Something happened', url: 'https://api.github.com/repos/zeke/github-digest/issues/1' },
					repository: { full_name: 'zeke/github-digest' },
					reason: 'subscribed',
					updated_at: '2026-08-19T00:00:00Z',
				},
			],
			reviewRequested: [
				{
					title: 'Add feature',
					html_url: 'https://github.com/zeke/github-digest/pull/2',
					repository_url: 'https://api.github.com/repos/zeke/github-digest',
					updated_at: '2026-08-19T01:00:00Z',
				},
			],
			assigned: [],
		});

		expect(result).toEqual({
			notifications: [
				{
					title: 'Something happened',
					url: 'https://github.com/zeke/github-digest/issues/1',
					repo: 'zeke/github-digest',
					reason: 'subscribed',
					updatedAt: '2026-08-19T00:00:00Z',
				},
			],
			reviewRequested: [
				{
					title: 'Add feature',
					url: 'https://github.com/zeke/github-digest/pull/2',
					repo: 'zeke/github-digest',
					updatedAt: '2026-08-19T01:00:00Z',
				},
			],
			assigned: [],
		});
	});

	it('handles a notification with no subject URL', () => {
		const result = formatGithubActivity({
			notifications: [
				{
					subject: { title: 'Repo-level notification', url: null },
					repository: { full_name: 'zeke/github-digest' },
					reason: 'watching',
					updated_at: '2026-08-19T00:00:00Z',
				},
			],
			reviewRequested: [],
			assigned: [],
		});

		expect(result.notifications[0].url).toBe('');
	});
});
