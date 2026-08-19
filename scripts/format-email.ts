// Pure formatting helpers for the digest email, kept separate from the
// network calls in send-digest.ts so they're unit-testable without hitting
// any API.

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Minimal Markdown -> HTML for the small subset the digest agent actually
// produces: ## headings, - bullet lists, [text](url) links, and paragraphs.
// Not a general-purpose Markdown renderer.
export function markdownToHtml(markdown: string): string {
	const withLinks = (line: string) =>
		escapeHtml(line).replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			(_match, text: string, url: string) => `<a href="${url}">${text}</a>`,
		);

	const lines = markdown.trim().split('\n');
	const html: string[] = [];
	let inList = false;

	const closeList = () => {
		if (inList) {
			html.push('</ul>');
			inList = false;
		}
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === '') {
			closeList();
			continue;
		}
		if (trimmed.startsWith('## ')) {
			closeList();
			html.push(`<h2>${withLinks(trimmed.slice(3))}</h2>`);
		} else if (trimmed.startsWith('- ')) {
			if (!inList) {
				html.push('<ul>');
				inList = true;
			}
			html.push(`<li>${withLinks(trimmed.slice(2))}</li>`);
		} else {
			closeList();
			html.push(`<p>${withLinks(trimmed)}</p>`);
		}
	}
	closeList();

	return html.join('\n');
}

export function formatPacificDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
}

export interface DigestEmail {
	to: string;
	from: { address: string; name: string };
	subject: string;
	html: string;
	text: string;
}

export function buildDigestEmail(
	digestMarkdown: string,
	date: Date,
): DigestEmail {
	return {
		to: 'zeke@sikelianos.com',
		from: { address: 'digest@ziki.boo', name: 'GitHub Digest' },
		subject: `GitHub Digest — ${formatPacificDate(date)}`,
		html: markdownToHtml(digestMarkdown),
		text: digestMarkdown,
	};
}
