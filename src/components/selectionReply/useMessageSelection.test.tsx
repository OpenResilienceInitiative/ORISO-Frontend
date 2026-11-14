// @vitest-environment oriso-jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, cleanup, render } from '@testing-library/react';

import { useMessageSelection } from './useMessageSelection';
import type { MessageSelection } from './useMessageSelection';

let latest: MessageSelection | null = null;

function Timeline() {
	const layerRef = React.useRef<HTMLDivElement | null>(null);
	const { selection } = useMessageSelection(layerRef, {
		enabled: true,
		authorFor: () => 'Anna'
	});
	latest = selection;
	return (
		<div ref={layerRef}>
			<div data-message-id="$1">
				<div className="messageItem__message">
					<ol className="messageItem__passageReplies">
						<li>
							<p data-testid="answer">Antwort auf eine Stelle</p>
						</li>
					</ol>
					<span>
						<p data-testid="body">Ich wohne in Freiburg.</p>
					</span>
				</div>
			</div>
			<div data-message-id="$2">
				<div className="messageItem__message">
					<p data-testid="next">Und ich in Basel.</p>
				</div>
			</div>
		</div>
	);
}

const textOf = (testId: string) =>
	document.querySelector(`[data-testid="${testId}"]`)!.firstChild!;

const selectTextOf = async (testId: string, endTestId = testId) => {
	const node = textOf(testId);
	const range = document.createRange();
	range.setStart(node, 0);
	range.setEnd(textOf(endTestId), 7);
	const native = window.getSelection()!;
	native.removeAllRanges();
	native.addRange(range);
	vi.useFakeTimers();
	await act(async () => {
		node.parentElement!.dispatchEvent(
			new MouseEvent('mouseup', { bubbles: true })
		);
		vi.runAllTimers();
	});
	vi.useRealTimers();
};

describe('useMessageSelection', () => {
	afterEach(() => {
		cleanup();
		latest = null;
		window.getSelection()?.removeAllRanges();
	});

	it('offers a passage marked in the message text', async () => {
		render(<Timeline />);
		await selectTextOf('body');
		expect(latest?.passage).toMatchObject({
			eventId: '$1',
			text: 'Ich woh'
		});
	});

	it('drops the passage when the marking grows into another message', async () => {
		render(<Timeline />);
		await selectTextOf('body');
		expect(latest).not.toBeNull();
		await selectTextOf('body', 'next');
		expect(latest).toBeNull();
	});

	it('ignores text marked in the answers shown above the bubble', async () => {
		render(<Timeline />);
		await selectTextOf('answer');
		expect(latest).toBeNull();
	});
});
