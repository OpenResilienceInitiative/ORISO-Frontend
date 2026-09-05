// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
	findTimelineScrollContainer,
	scrollTimelineToNewest
} from './scrollToNewest';

const build = (html: string) => {
	document.body.innerHTML = html;
	return document.body;
};

describe("findTimelineScrollContainer (T16: the composer's scroll-to-newest arrow)", () => {
	it('finds the main chat timeline of the card the composer sits in', () => {
		build(
			'<div class="session"><div class="session__content" id="tl"></div><div class="messageSubmit__wrapper"><button id="from"></button></div></div>'
		);
		expect(
			findTimelineScrollContainer(document.getElementById('from'))?.id
		).toBe('tl');
	});

	it('finds the side panel timeline when the composer is in the panel', () => {
		build(
			'<div class="session"><div class="session__content" id="main"></div>' +
				'<div class="sidePanel"><div class="sidePanel__timeline" id="side"></div><button id="from"></button></div></div>'
		);
		expect(
			findTimelineScrollContainer(document.getElementById('from'))?.id
		).toBe('side');
	});

	it('returns null without a chat card around the composer', () => {
		build('<div><button id="from"></button></div>');
		expect(
			findTimelineScrollContainer(document.getElementById('from'))
		).toBeNull();
		expect(findTimelineScrollContainer(null)).toBeNull();
	});
});

describe('scrollTimelineToNewest', () => {
	it('scrolls the found timeline to its end and reports success', () => {
		build(
			'<div class="session"><div class="session__content" id="tl"></div><button id="from"></button></div>'
		);
		const timeline = document.getElementById('tl')!;
		Object.defineProperty(timeline, 'scrollHeight', { value: 4200 });
		expect(scrollTimelineToNewest(document.getElementById('from'))).toBe(
			true
		);
		expect(timeline.scrollTop).toBe(4200);
	});

	it('reports false when there is nothing to scroll', () => {
		build('<button id="from"></button>');
		expect(scrollTimelineToNewest(document.getElementById('from'))).toBe(
			false
		);
	});
});
