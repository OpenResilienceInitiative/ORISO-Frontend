// @vitest-environment oriso-jsdom
import * as React from 'react';
import { describe, expect, it } from 'vite-plus/test';
import { render } from '@testing-library/react';

import { MessageHtml } from './MessageHtml';

const Bubble = ({ html, tick }: { html: string; tick: number }) => (
	<div data-tick={tick}>
		<MessageHtml html={html} />
	</div>
);

describe('MessageHtml', () => {
	it('keeps the same DOM text when the message re-renders unchanged, so a text selection survives', () => {
		const { container, rerender } = render(
			<Bubble html="<p>Ein Brief vom Amtsgericht</p>" tick={1} />
		);
		const textNode = container.querySelector('p')!.firstChild!;
		const selection = window.getSelection()!;
		const range = document.createRange();
		range.setStart(textNode, 4);
		range.setEnd(textNode, 9);
		selection.removeAllRanges();
		selection.addRange(range);

		rerender(<Bubble html="<p>Ein Brief vom Amtsgericht</p>" tick={2} />);

		expect(container.querySelector('p')!.firstChild).toBe(textNode);
		expect(selection.toString()).toBe('Brief');
	});

	it('shows new content when the message changes', () => {
		const { container, rerender } = render(
			<Bubble html="<p>alt</p>" tick={1} />
		);
		rerender(<Bubble html="<p>neu</p>" tick={2} />);
		expect(container.textContent).toBe('neu');
	});
});
