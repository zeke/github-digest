import { describe, expect, it } from 'vitest';
import {
	buildDigestEmail,
	formatPacificDate,
	markdownToHtml,
} from './format-email.ts';

describe('markdownToHtml', () => {
	it('renders headings, bullet lists, and links', () => {
		const markdown = [
			'## Needs your action',
			'- [Fix bug](https://github.com/zeke/x/pull/1) in `zeke/x`',
		].join('\n');

		expect(markdownToHtml(markdown)).toBe(
			[
				'<h2>Needs your action</h2>',
				'<ul>',
				'<li><a href="https://github.com/zeke/x/pull/1">Fix bug</a> in `zeke/x`</li>',
				'</ul>',
			].join('\n'),
		);
	});

	it('renders ### as an h3, distinct from ##', () => {
		const markdown = [
			'## Needs your attention',
			'### Pull Requests',
			'- one item',
		].join('\n');
		expect(markdownToHtml(markdown)).toBe(
			[
				'<h2>Needs your attention</h2>',
				'<h3>Pull Requests</h3>',
				'<ul>',
				'<li>one item</li>',
				'</ul>',
			].join('\n'),
		);
	});

	it('renders plain lines as paragraphs', () => {
		expect(markdownToHtml('Nothing new today.')).toBe(
			'<p>Nothing new today.</p>',
		);
	});

	it('renders bold text', () => {
		expect(
			markdownToHtml('**cloudflare/cloudflare-docs** — review requested'),
		).toBe(
			'<p><strong>cloudflare/cloudflare-docs</strong> — review requested</p>',
		);
	});

	it('renders bold text inside a bullet alongside a link', () => {
		expect(
			markdownToHtml('- **Fix bug** in [zeke/x](https://github.com/zeke/x)'),
		).toBe(
			[
				'<ul>',
				'<li><strong>Fix bug</strong> in <a href="https://github.com/zeke/x">zeke/x</a></li>',
				'</ul>',
			].join('\n'),
		);
	});

	it('escapes HTML special characters', () => {
		expect(markdownToHtml('A <script> tag & friends')).toBe(
			'<p>A &lt;script&gt; tag &amp; friends</p>',
		);
	});

	it('closes a list when a blank line or new section follows', () => {
		const markdown = ['- one', '- two', '', '## Next'].join('\n');
		expect(markdownToHtml(markdown)).toBe(
			['<ul>', '<li>one</li>', '<li>two</li>', '</ul>', '<h2>Next</h2>'].join(
				'\n',
			),
		);
	});
});

describe('formatPacificDate', () => {
	it('formats a date in the America/Los_Angeles timezone', () => {
		// 2026-08-19T15:00:00Z is 8am PDT.
		expect(formatPacificDate(new Date('2026-08-19T15:00:00Z'))).toBe(
			'Aug 19, 2026',
		);
	});
});

describe('buildDigestEmail', () => {
	it('builds the full email payload', () => {
		const email = buildDigestEmail(
			'Nothing new today.',
			new Date('2026-08-19T15:00:00Z'),
		);
		expect(email).toEqual({
			to: 'zeke@sikelianos.com',
			from: { address: 'digest@ziki.boo', name: 'GitHub Digest' },
			subject: 'GitHub Digest — Aug 19, 2026',
			html: '<p>Nothing new today.</p>',
			text: 'Nothing new today.',
		});
	});
});
