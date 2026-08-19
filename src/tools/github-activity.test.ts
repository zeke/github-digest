import { describe, expect, it } from 'vitest';
import {
	apiUrlToHtmlUrl,
	formatGithubActivity,
	repoFullNameFromApiUrl,
} from './github-activity.ts';

const since = new Date('2026-08-19T00:00:00Z');

describe('apiUrlToHtmlUrl', () => {
	it('converts an issue API URL to its browsable URL', () => {
		expect(
			apiUrlToHtmlUrl(
				'https://api.github.com/repos/zeke/github-digest/issues/12',
			),
		).toBe('https://github.com/zeke/github-digest/issues/12');
	});

	it('converts a pull request API URL, singularizing /pulls/ to /pull/', () => {
		expect(
			apiUrlToHtmlUrl(
				'https://api.github.com/repos/zeke/github-digest/pulls/12',
			),
		).toBe('https://github.com/zeke/github-digest/pull/12');
	});
});

describe('repoFullNameFromApiUrl', () => {
	it('extracts owner/repo from a repository API URL', () => {
		expect(
			repoFullNameFromApiUrl('https://api.github.com/repos/zeke/github-digest'),
		).toBe('zeke/github-digest');
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
					subject: {
						title: 'Something happened',
						url: 'https://api.github.com/repos/zeke/github-digest/issues/1',
					},
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
			starredRepos: [],
			since,
		});

		expect(result.notifications).toEqual([
			{
				title: 'Something happened',
				url: 'https://github.com/zeke/github-digest/issues/1',
				repo: 'zeke/github-digest',
				reason: 'subscribed',
				updatedAt: '2026-08-19T00:00:00Z',
			},
		]);
		expect(result.reviewRequested).toEqual([
			{
				title: 'Add feature',
				url: 'https://github.com/zeke/github-digest/pull/2',
				repo: 'zeke/github-digest',
				updatedAt: '2026-08-19T01:00:00Z',
			},
		]);
		expect(result.assigned).toEqual([]);
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
			starredRepos: [],
			since,
		});

		expect(result.notifications[0].url).toBe('');
	});

	it('highlights a starred repo with a release since the cutoff', () => {
		const result = formatGithubActivity({
			notifications: [],
			reviewRequested: [],
			assigned: [],
			starredRepos: [
				{
					nameWithOwner: 'flueai/flue',
					url: 'https://github.com/flueai/flue',
					pushedAt: '2026-08-18T00:00:00Z',
					latestRelease: {
						name: 'v2.1.0',
						tagName: 'v2.1.0',
						url: 'https://github.com/flueai/flue/releases/tag/v2.1.0',
						publishedAt: '2026-08-19T12:00:00Z',
					},
				},
			],
			since,
		});

		expect(result.highlights).toEqual([
			{
				title: 'New release: v2.1.0 — v2.1.0',
				url: 'https://github.com/flueai/flue/releases/tag/v2.1.0',
				repo: 'flueai/flue',
				reason: 'release',
				updatedAt: '2026-08-19T12:00:00Z',
			},
		]);
	});

	it('highlights a starred repo with only a recent push', () => {
		const result = formatGithubActivity({
			notifications: [],
			reviewRequested: [],
			assigned: [],
			starredRepos: [
				{
					nameWithOwner: 'zeke/dial-a-repo',
					url: 'https://github.com/zeke/dial-a-repo',
					pushedAt: '2026-08-19T06:00:00Z',
					latestRelease: null,
				},
			],
			since,
		});

		expect(result.highlights).toEqual([
			{
				title: 'New commits pushed',
				url: 'https://github.com/zeke/dial-a-repo/commits',
				repo: 'zeke/dial-a-repo',
				reason: 'push',
				updatedAt: '2026-08-19T06:00:00Z',
			},
		]);
	});

	it('skips starred repos with no activity since the cutoff', () => {
		const result = formatGithubActivity({
			notifications: [],
			reviewRequested: [],
			assigned: [],
			starredRepos: [
				{
					nameWithOwner: 'old/stale',
					url: 'https://github.com/old/stale',
					pushedAt: '2020-01-01T00:00:00Z',
					latestRelease: null,
				},
			],
			since,
		});

		expect(result.highlights).toEqual([]);
	});

	it('prefers a release over a push when both are recent', () => {
		const result = formatGithubActivity({
			notifications: [],
			reviewRequested: [],
			assigned: [],
			starredRepos: [
				{
					nameWithOwner: 'flueai/flue',
					url: 'https://github.com/flueai/flue',
					pushedAt: '2026-08-19T13:00:00Z',
					latestRelease: {
						name: null,
						tagName: 'v2.1.1',
						url: 'https://github.com/flueai/flue/releases/tag/v2.1.1',
						publishedAt: '2026-08-19T12:00:00Z',
					},
				},
			],
			since,
		});

		expect(result.highlights).toHaveLength(1);
		expect(result.highlights[0].reason).toBe('release');
		expect(result.highlights[0].title).toBe('New release: v2.1.1');
	});
});
