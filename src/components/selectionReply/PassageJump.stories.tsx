/**
 * Back to a quoted passage. Clicking a passage reply's quote scrolls the
 * timeline so the passage itself sits in view, also when it lies deep
 * inside one long paragraph, and also when its message is shown shortened
 * and has to open first. Browser checks for `jumpToPassage` (PR #2232).
 */
import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

import {
	findMessageBubble,
	findPassageRange,
	jumpToPassage
} from './passageRange';
import './selectionReply.styles.scss';

const PASSAGE = 'Der Termin beim Amtsgericht ist am 3. Dezember um 9 Uhr';
const FILLER = Array.from(
	{ length: 60 },
	(_, index) =>
		`Satz ${index + 1}: Ich schreibe Ihnen, weil sich seit dem Sommer vieles verändert hat.`
).join(' ');
const LONG_PARAGRAPH = `${FILLER} ${PASSAGE}. ${FILLER.slice(0, 300)}`;

function Timeline({ shortened }: { shortened: boolean }) {
	const [open, setOpen] = useState(!shortened);
	return (
		<div
			data-testid="scroller"
			role="region"
			aria-label="Verlauf"
			tabIndex={0}
			style={{
				height: 320,
				overflowY: 'auto',
				border: '1px solid #ccc',
				padding: 16,
				maxWidth: 480
			}}
		>
			<div data-message-id="$long">
				<div className="messageItem__message">
					<p>{open ? LONG_PARAGRAPH : `${FILLER.slice(0, 400)} …`}</p>
					{!open && (
						<button
							type="button"
							className="messageItem__expandBtn"
							aria-expanded="false"
							onClick={() => setOpen(true)}
						>
							Mehr anzeigen
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

const meta: Meta<typeof Timeline> = {
	title: 'Components/Chat/SelectionReply/Jump to passage',
	component: Timeline,
	parameters: { layout: 'padded' }
};
export default meta;
type Story = StoryObj<typeof Timeline>;

const expectPassageInView = async (canvasElement: HTMLElement) => {
	const scroller = canvasElement.querySelector<HTMLElement>(
		'[data-testid="scroller"]'
	)!;
	await waitFor(
		() => {
			const bubble = findMessageBubble(canvasElement, '$long')!;
			const range = findPassageRange(bubble, PASSAGE)!;
			expect(range).not.toBeNull();
			const passage = range.getBoundingClientRect();
			const view = scroller.getBoundingClientRect();
			expect(passage.top).toBeGreaterThanOrEqual(view.top);
			expect(passage.bottom).toBeLessThanOrEqual(view.bottom);
		},
		{ timeout: 3000 }
	);
};

/** The passage sits halfway down one long paragraph of an open message. */
export const DeepInOpenMessage: Story = {
	name: 'Passage tief in einem langen Absatz',
	args: { shortened: false },
	play: async ({ canvasElement }) => {
		// A web font arriving mid-scroll reflows the paragraph.
		await document.fonts.ready;
		jumpToPassage(canvasElement, '$long', PASSAGE);
		await expectPassageInView(canvasElement);
	}
};

/** The same passage in a shortened message: it opens, then scrolls there. */
export const DeepInShortenedMessage: Story = {
	name: 'Gekürzte Nachricht öffnet sich und zeigt die Stelle',
	args: { shortened: true },
	play: async ({ canvasElement }) => {
		// A web font arriving mid-scroll reflows the paragraph.
		await document.fonts.ready;
		jumpToPassage(canvasElement, '$long', PASSAGE);
		await expectPassageInView(canvasElement);
	}
};
