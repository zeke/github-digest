import { defineTool } from '@flue/runtime';
import { Octokit } from '@octokit/rest';
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
	highlights: v.array(activityItemSchema),
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

// GitHub has no "follow a repo" feature distinct from starring or watching —
// watched-repo activity is already covered by notifications, so "highlights"
// means recent activity on starred repos: a new release, or a push since the
// last digest, whichever is more recent.
export interface StarredRepo {
	nameWithOwner: string;
	url: string;
	pushedAt: string;
	latestRelease: {
		name: string | null;
		tagName: string;
		url: string;
		publishedAt: string;
	} | null;
}

interface RawActivity {
	notifications: RawNotification[];
	reviewRequested: RawSearchItem[];
	assigned: RawSearchItem[];
	starredRepos: StarredRepo[];
	since: Date;
}

// GitHub's notification `subject.url` is an API URL, e.g.
// https://api.github.com/repos/owner/repo/pulls/123 — turn it into the
// browsable URL a human (or the digest email) can click.
export function apiUrlToHtmlUrl(apiUrl: string): string {
	return apiUrl
		.replace('https://api.github.com/repos/', 'https://github.com/')
		.replace('/pulls/', '/pull/');
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
		url: notification.subject.url
			? apiUrlToHtmlUrl(notification.subject.url)
			: '',
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

// A starred repo is a highlight if it has a release or a push at or after
// `since`. A release takes priority over a plain push when both happened.
function mapHighlight(repo: StarredRepo, since: Date): ActivityItem | null {
	const release = repo.latestRelease;
	if (release && new Date(release.publishedAt) >= since) {
		return {
			title: `New release: ${release.tagName}${release.name ? ` — ${release.name}` : ''}`,
			url: release.url,
			repo: repo.nameWithOwner,
			reason: 'release',
			updatedAt: release.publishedAt,
		};
	}
	if (new Date(repo.pushedAt) >= since) {
		return {
			title: 'New commits pushed',
			url: `${repo.url}/commits`,
			repo: repo.nameWithOwner,
			reason: 'push',
			updatedAt: repo.pushedAt,
		};
	}
	return null;
}

// Pure formatting step, kept separate from the network call so it's testable
// without hitting the GitHub API.
export function formatGithubActivity(raw: RawActivity): GithubActivity {
	return {
		notifications: raw.notifications.map(mapNotification),
		reviewRequested: raw.reviewRequested.map(mapSearchItem),
		assigned: raw.assigned.map(mapSearchItem),
		highlights: raw.starredRepos
			.map((repo) => mapHighlight(repo, raw.since))
			.filter((item) => item !== null),
	};
}

interface StarredReposResponse {
	viewer: {
		starredRepositories: {
			nodes: Array<{
				nameWithOwner: string;
				url: string;
				pushedAt: string;
				releases: {
					nodes: Array<{
						name: string | null;
						tagName: string;
						url: string;
						publishedAt: string;
					}>;
				};
			}>;
		};
	};
}

// Capped at the first 100 starred repos (GraphQL's per-page max) — plenty
// for a daily digest without paginating through someone's entire star list.
async function fetchStarredRepos(client: Octokit): Promise<StarredRepo[]> {
	const response = await client.graphql<StarredReposResponse>(`
		query {
			viewer {
				starredRepositories(first: 100, orderBy: { field: STARRED_AT, direction: DESC }) {
					nodes {
						nameWithOwner
						url
						pushedAt
						releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) {
							nodes { name tagName url publishedAt }
						}
					}
				}
			}
		}
	`);
	return response.viewer.starredRepositories.nodes.map((node) => ({
		nameWithOwner: node.nameWithOwner,
		url: node.url,
		pushedAt: node.pushedAt,
		latestRelease: node.releases.nodes[0] ?? null,
	}));
}

export async function fetchGithubActivity(
	client: Octokit,
	since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
): Promise<GithubActivity> {
	const [notifications, reviewRequested, assigned, starredRepos] =
		await Promise.all([
			client.rest.activity.listNotificationsForAuthenticatedUser({
				all: false,
			}),
			client.rest.search.issuesAndPullRequests({
				q: 'review-requested:@me is:open is:pr',
			}),
			client.rest.search.issuesAndPullRequests({ q: 'assignee:@me is:open' }),
			fetchStarredRepos(client),
		]);
	return formatGithubActivity({
		notifications: notifications.data,
		reviewRequested: reviewRequested.data.items,
		assigned: assigned.data.items,
		starredRepos,
		since,
	});
}

export const githubActivity = defineTool({
	name: 'github_activity',
	description:
		'Fetch unread GitHub notifications (includes watched-repo activity), open pull requests awaiting your review, issues/PRs assigned to you, and highlights (new releases or pushes on starred repos in the last 24 hours).',
	output: githubActivitySchema,
	async run() {
		const client = new Octokit({ auth: process.env.DIGEST_GITHUB_TOKEN });
		const output = await fetchGithubActivity(client);
		return { output };
	},
});
