import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { NotificationsCenter } from './NotificationsCenter';
import { installNotificationDraftFixture } from './notificationDraftFixture';
import { TIMELINE_WIDTH_STORAGE_KEY } from './timelineListWidth';
import { withDisplayFilterStore } from '../displayFilter/displayFilterStoryStore';
import {
	feedItem,
	minutesAgo,
	withTimelineData
} from '../../../.storybook/notificationTimelineFixture';

/*
 * Frank, 2026-11-16: on a ~1000 px wide desktop window Activity was one
 * full-width list and a click jumped into the conversation, while
 * Conversations already showed list | preview there. Activity now splits
 * where Conversations splits (900 px), keeps the compressed rail, and shows
 * which pane has the focus.
 */

const feed = [
	feedItem({
		id: 'split-invite',
		eventType: 'appointment.scheduled',
		createdAt: minutesAgo(3),
		readAt: null
	}),
	feedItem({
		id: 'split-reply',
		eventType: 'thread.reply.new',
		createdAt: minutesAgo(9),
		readAt: minutesAgo(1)
	}),
	feedItem({
		id: 'split-appointment',
		eventType: 'appointment.scheduled',
		createdAt: minutesAgo(30),
		readAt: minutesAgo(1)
	})
];

const withSavedWidth = (width: string | null) => () => {
	const previous = localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY);
	if (width === null) localStorage.removeItem(TIMELINE_WIDTH_STORAGE_KEY);
	else localStorage.setItem(TIMELINE_WIDTH_STORAGE_KEY, width);
	const restoreDrafts = installNotificationDraftFixture([]);
	return () => {
		restoreDrafts();
		if (previous === null)
			localStorage.removeItem(TIMELINE_WIDTH_STORAGE_KEY);
		else localStorage.setItem(TIMELINE_WIDTH_STORAGE_KEY, previous);
	};
};

const meta = {
	title: 'Organisms/NotificationsCenter/Split layout',
	component: NotificationsCenter,
	decorators: [withDisplayFilterStore, withTimelineData(feed)],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/notifications' },
		docs: {
			description: {
				component:
					'From 900 px Activity shows list | preview like Conversations. A click on a card shows its content on the right; only the side pill opens the conversation. The preview gets the red focus ring once you click into it, and the selected card steps back to the accent colour.'
			}
		}
	},
	globals: { viewport: { value: 'desktop1024' }, scheme: 'light' },
	beforeEach: withSavedWidth(null)
} satisfies Meta<typeof NotificationsCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

const root = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('.notificationsCenter')!;

export const SplitAtSmallDesktop: Story = {
	play: async ({ canvasElement }) => {
		const detail = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.notificationsCenter__detail'
			);
			expect(element).not.toBeNull();
			return element!;
		});
		expect(getComputedStyle(detail).display).not.toBe('none');
		const cards = canvasElement.querySelectorAll<HTMLButtonElement>(
			'.notificationsCenter__card'
		);
		await waitFor(() =>
			expect(cards[0]).toHaveClass('notificationsCenter__card--active')
		);
		// A click selects; it does not leave Activity.
		await userEvent.click(cards[2]);
		await waitFor(() =>
			expect(cards[2]).toHaveClass('notificationsCenter__card--active')
		);
		expect(
			canvasElement.querySelector('.notificationsCenter__detail')
		).not.toBeNull();
		expect(
			canvasElement.querySelector('.notificationsCenter__expander')
		).not.toBeNull();
	}
};

/**
 * Frank, 2026-11-17: the gutters of "Gespräche". 24 px above the search and
 * the detail card, and 24 px between the last card and the detail card, with
 * the grip centred in that gap (it was 16 px above and 42 px between).
 */
export const GuttersMatchConversations: Story = {
	play: async ({ canvasElement }) => {
		const column = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.notificationsCenter__listColumn'
			);
			expect(element).not.toBeNull();
			return element!;
		});
		const box = (selector: string) =>
			canvasElement
				.querySelector<HTMLElement>(selector)!
				.getBoundingClientRect();
		const left = box('.notificationsCenter').left;
		const top = box('.notificationsCenter').top;
		const columnRight = column.getBoundingClientRect().right;
		await waitFor(() =>
			expect(
				Math.round(box('.notificationsCenter__toolbar').top - top)
			).toBe(24)
		);
		expect(
			Math.round(box('.notificationsCenter__detailCard').top - top)
		).toBe(24);
		expect(
			Math.round(box('.notificationsCenter__toolbar').left - left)
		).toBe(12);
		// The last card and the detail card: 12 px each side of the edge.
		const card = box(
			'.notificationsCenter__card:not(.notificationsCenter__card--active)'
		);
		expect(Math.round(columnRight - card.right)).toBe(12);
		expect(
			Math.round(
				box('.notificationsCenter__detailCard').left - columnRight
			)
		).toBe(12);
		// The grip sits on the edge, in the middle of the 24 px gap.
		const grip = box('.sessionsList__resizeHandlePill');
		expect(Math.round(grip.left + grip.width / 2 - columnRight)).toBe(0);
	}
};

export const PreviewFocusTonesCardDown: Story = {
	play: async ({ canvasElement }) => {
		const card = await waitFor(() => {
			const active = canvasElement.querySelector<HTMLElement>(
				'.notificationsCenter__card--active'
			);
			expect(active).not.toBeNull();
			return active!;
		});
		const pill = canvasElement.querySelector<HTMLElement>(
			'.notificationsCenter__expander'
		)!;
		// White glyph on the primary pill while the list has the focus.
		expect(getComputedStyle(pill).color).toBe('rgb(255, 255, 255)');
		await userEvent.click(
			canvasElement.querySelector<HTMLElement>(
				'.notificationsCenter__detailCard'
			)!
		);
		await waitFor(() =>
			expect(root(canvasElement)).toHaveClass(
				'notificationsCenter--detailFocused'
			)
		);
		// Accent pill: the glyph turns primary red (the fill fades, the
		// glyph colour does not, so this holds in a background tab too).
		expect(getComputedStyle(pill).color).toBe('rgb(165, 0, 10)');
		// Back in the list, the selected card is primary again.
		await userEvent.click(card);
		await waitFor(() =>
			expect(root(canvasElement)).not.toHaveClass(
				'notificationsCenter--detailFocused'
			)
		);
	}
};

export const CompressedRailAtSmallDesktop: Story = {
	beforeEach: withSavedWidth('80'),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.sessionRailPill')
			).toHaveLength(feed.length)
		);
		expect(
			canvasElement
				.querySelector('.notificationsCenter__listColumn')!
				.getBoundingClientRect().width
		).toBe(80);
	}
};

export const EmptyPageShowsBothPanes: Story = {
	decorators: [withDisplayFilterStore, withTimelineData([])],
	play: async ({ canvasElement }) => {
		const page = await waitFor(() => {
			const element = canvasElement.querySelector<HTMLElement>(
				'.notificationsCenter--emptySplit'
			);
			expect(element).not.toBeNull();
			return element!;
		});
		await expect(
			within(page).getByText(/Kurz durchatmen/)
		).toBeInTheDocument();
		const handle = page.querySelector('.sessionsList__resizeHandle--end')!;
		expect(getComputedStyle(handle, '::before').content).not.toBe('none');
	}
};
