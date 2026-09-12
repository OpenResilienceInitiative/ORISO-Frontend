/**
 * `InfoBanner` — the strip above the side room's timeline (supervision reason,
 * "start the chat" hint). It lives in `SidePanel.tsx` and is used by the real
 * session view (`session/SessionItemComponent.tsx`) as well as by the
 * `SidePanel` stories, but it had no story of its own: its one visible state
 * was reachable only through `Components/Session/SidePanel` → "with reason
 * banner".
 *
 * It is worth its own entry because it exists to fix a specific bug. The
 * predecessor (`session__supervisionReason`) was a flex **row**, so in a narrow
 * pane the title lost the width race against the text and broke letter by
 * letter — "S u p e r v i s i o n s g r u n d" down the left edge. The column
 * layout here is the fix, and the play functions measure it rather than
 * describe it.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { InfoBanner } from './SidePanel';
import { phone390Globals } from '../message/messageStoryShell';
import { APP_ORISO_CHAT_FIGMA_URL } from '../storybookDesignLinks';
import './sidePanel.styles.scss';

/** The side room is a narrow column; 320px is the panel at its narrowest. */
const NARROW_PANE = 320;

const Pane = ({
	width = 400,
	children
}: {
	width?: number;
	children: React.ReactNode;
}) => (
	<div
		data-cy="info-banner-pane"
		style={{
			width,
			maxWidth: '100%',
			padding: 12,
			background: '#f5f2f2',
			boxSizing: 'border-box'
		}}
	>
		{children}
	</div>
);

/**
 * The regression guard, in one place: the title is one line, and neither part
 * of the banner pushes past the pane it sits in.
 */
const expectNoLetterWrapping = async (canvasElement: HTMLElement) => {
	const banner = canvasElement.querySelector<HTMLElement>(
		'[data-cy="info-banner"]'
	)!;
	const title = banner.querySelector<HTMLElement>('.infoBanner__title')!;
	const pane = canvasElement.querySelector<HTMLElement>(
		'[data-cy="info-banner-pane"]'
	)!;

	await waitFor(() => {
		const lineHeight = Number.parseFloat(
			getComputedStyle(title).lineHeight
		);
		expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(
			lineHeight + 2
		);
	});
	// Column layout: the text starts below the title, not beside it.
	expect(getComputedStyle(banner).flexDirection).toBe('column');
	expect(banner.getBoundingClientRect().right).toBeLessThanOrEqual(
		pane.getBoundingClientRect().right + 1
	);
};

const meta = {
	title: 'Chat/Molecules/InfoBanner',
	component: InfoBanner,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Two-line info strip above a side-room timeline: bold title, then the text. Column layout on purpose — the earlier row layout broke the title letter by letter in a narrow pane (`session__supervisionReason`). Styles live in `sidePanel.styles.scss` (`.infoBanner`).'
			}
		}
	},
	args: {
		title: 'Supervisionsgrund',
		text: 'Wiederholte Vermeidung beim Thema Mahnbescheide; Fallbesprechung zur Gesprächsführung.'
	}
} satisfies Meta<typeof InfoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SupervisionReason: Story = {
	name: 'Supervision reason',
	render: (args) => (
		<Pane>
			<InfoBanner {...args} />
		</Pane>
	),
	play: ({ canvasElement }) => expectNoLetterWrapping(canvasElement)
};

export const StartChatHint: Story = {
	name: 'Start-the-chat hint (empty side room)',
	args: {
		title: 'Chat starten',
		text: 'Nutzen Sie das Nachrichtenfeld unten, um die erste Supervisionsnachricht zu senden.'
	},
	parameters: {
		docs: {
			description: {
				story: 'The second banner the session view renders: shown to a supervisor whose side room has no messages yet.'
			}
		}
	},
	render: (args) => (
		<Pane>
			<InfoBanner {...args} />
		</Pane>
	),
	play: ({ canvasElement }) => expectNoLetterWrapping(canvasElement)
};

export const NarrowPane: Story = {
	name: 'Narrow pane 320 — title stays on one line',
	parameters: {
		docs: {
			description: {
				story: 'The state the component exists for. At 320px the old row layout wrapped the title character by character; here the title keeps one line and the text wraps beneath it.'
			}
		}
	},
	render: (args) => (
		<Pane width={NARROW_PANE}>
			<InfoBanner {...args} />
		</Pane>
	),
	play: ({ canvasElement }) => expectNoLetterWrapping(canvasElement)
};

export const LongUnbrokenReason: Story = {
	name: 'Long unbroken reason — wraps inside the pane',
	args: {
		text: 'Fallbesprechungsschwerpunkt: Mahnbescheidbearbeitungsrückstände-Gesprächsführung'
	},
	parameters: {
		docs: {
			description: {
				story: 'A single word longer than the pane. `overflow-wrap: anywhere` on the text breaks it instead of widening the banner — a counsellor can type anything into the reason field.'
			}
		}
	},
	render: (args) => (
		<Pane width={NARROW_PANE}>
			<InfoBanner {...args} />
		</Pane>
	),
	play: async ({ canvasElement }) => {
		await expectNoLetterWrapping(canvasElement);
		const banner = canvasElement.querySelector<HTMLElement>(
			'[data-cy="info-banner"]'
		)!;
		expect(banner.scrollWidth).toBeLessThanOrEqual(banner.clientWidth + 1);
	}
};

export const Phone390: Story = {
	name: 'Phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'On a phone the side room is a full-width sheet; the banner then has the whole screen minus the sheet padding.'
			}
		}
	},
	render: (args) => (
		<Pane width={366}>
			<InfoBanner {...args} />
		</Pane>
	),
	play: ({ canvasElement }) => expectNoLetterWrapping(canvasElement)
};
