import { Octokit } from '@octokit/rest';
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

// Schema-first: this is the single source of truth for an activity item's
// shape. It also gives the tool free runtime validation of its own output.
const activityItemSchema = v.object({
	title: v.string(),
	url: v.string(),
	repo: v.string(),
	reason: v.optional(v.string()),
	updatedAt: v.string(),
});

const githubActivitySchema = v.object({
	notifications: v.array(activityItemSchema),
	reviewRequested: v.array(activityItemSchema),
	assigned: v.array(activityItemSchema),
});

export type ActivityItem = v.InferOutput<typeof activityItemSchema>;
export type GithubActivity = v.InferOutput<typeof githubActivitySchema>;

// Minimal shapes for the fields we read off Octokit's responses.
interface RawNotification {
	subject: { title: string; url: string | null };
	repository: { full_name: string };
	reason: string;
	updated_at: string;
}

interface RawSearchItem {
	title: string;
	html_url: string;
	repository_url: string;
	updated_at: string;
}

interface RawActivity {
	notifications: RawNotification[];
	reviewRequested: RawSearchItem[];
	assigned: RawSearchItem[];
}

// GitHub's notification `subject.url` is an API URL, e.g.
// https://api.github.com/repos/owner/repo/pulls/123 — turn it into the
// browsable URL a human (or the digest email) can click.
export function apiUrlToHtmlUrl(apiUrl: string): string {
	return apiUrl.replace('https://api.github.com/repos/', 'https://github.com/').replace('/pulls/', '/pull/');
}

// Search API items carry a `repository_url` like
// https://api.github.com/repos/owner/repo instead of a repo name.
export function repoFullNameFromApiUrl(apiUrl: string): string {
	const match = /repos\/([^/]+\/[^/]+)/.exec(apiUrl);
	return match ? match[1] : 'unknown/unknown';
}

function mapNotification(notification: RawNotification): ActivityItem {
	return {
		title: notification.subject.title,
		url: notification.subject.url ? apiUrlToHtmlUrl(notification.subject.url) : '',
		repo: notification.repository.full_name,
		reason: notification.reason,
		updatedAt: notification.updated_at,
	};
}

function mapSearchItem(item: RawSearchItem): ActivityItem {
	return {
		title: item.title,
		url: item.html_url,
		repo: repoFullNameFromApiUrl(item.repository_url),
		updatedAt: item.updated_at,
	};
}

// Pure formatting step, kept separate from the network call so it's testable
// without hitting the GitHub API.
export function formatGithubActivity(raw: RawActivity): GithubActivity {
	return {
		notifications: raw.notifications.map(mapNotification),
		reviewRequested: raw.reviewRequested.map(mapSearchItem),
		assigned: raw.assigned.map(mapSearchItem),
	};
}

export async function fetchGithubActivity(client: Octokit): Promise<GithubActivity> {
	const [notifications, reviewRequested, assigned] = await Promise.all([
		client.rest.activity.listNotificationsForAuthenticatedUser({ all: false }),
		client.rest.search.issuesAndPullRequests({ q: 'review-requested:@me is:open is:pr' }),
		client.rest.search.issuesAndPullRequests({ q: 'assignee:@me is:open' }),
	]);
	return formatGithubActivity({
		notifications: notifications.data,
		reviewRequested: reviewRequested.data.items,
		assigned: assigned.data.items,
	});
}

export const githubActivity = defineTool({
	name: 'github_activity',
	description:
		'Fetch unread GitHub notifications (includes watched-repo activity), open pull requests awaiting your review, and issues/PRs assigned to you.',
	output: githubActivitySchema,
	async run() {
		const client = new Octokit({ auth: process.env.DIGEST_GITHUB_TOKEN });
		const output = await fetchGithubActivity(client);
		return { output };
	},
});
