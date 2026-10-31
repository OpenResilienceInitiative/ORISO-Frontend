import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { NotificationsCenter } from './NotificationsCenter';
import { installNotificationDraftFixture } from './notificationDraftFixture';
import { TIMELINE_WIDTH_STORAGE_KEY } from './timelineListWidth';
import { withDisplayFilterStore } from '../displayFilter/displayFilterStoryStore';
import {
	feedItem,
	minutesAgo,
	withTimelineData
} from '../../../.storybook/notificationTimelineFixture';

const feed = Array.from({ length: 20 }, (_, index) =>
	feedItem({
		id: `rail-event-${index}`,
		eventType: index % 2 ? 'thread.reply.new' : 'appointment.scheduled',
		createdAt: minutesAgo(index + 2),
		readAt: index % 3 ? minutesAgo(1) : null
	})
);
const loadOlder = fn(async () => {});
const meta = {
	title: 'Organisms/NotificationsCenter/Desktop rail',
	component: NotificationsCenter,
	decorators: [withDisplayFilterStore, withTimelineData(feed)],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/notifications' },
		docs: {
			description: {
				component:
					'Desktop Activity rail reuses the conversation pills and resize handle. Width is saved in this browser. Drag, double-click or hold the handle to switch; Home/End resize and Up/Down scroll. Below 1200px the normal grouped cards remain.'
			}
		}
	},
	globals: { viewport: { value: 'desktop1440' }, scheme: 'light' },
	beforeEach: () => {
		const previous = localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY);
		localStorage.setItem(TIMELINE_WIDTH_STORAGE_KEY, '80');
		const restoreDrafts = installNotificationDraftFixture([]);
		loadOlder.mockClear();
		return () => {
			restoreDrafts();
			if (previous === null)
				localStorage.removeItem(TIMELINE_WIDTH_STORAGE_KEY);
			else localStorage.setItem(TIMELINE_WIDTH_STORAGE_KEY, previous);
		};
	}
} satisfies Meta<typeof NotificationsCenter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SavedIconRail: Story = {
	play: async ({ canvasElement }) => {
		const root = canvasElement.querySelector('.notificationsCenter')!;
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(root.querySelectorAll('.sessionRailPill')).toHaveLength(20)
		);
		expect(
			root
				.querySelector('.notificationsCenter__listColumn')!
				.getBoundingClientRect().width
		).toBe(80);
		const pills =
			root.querySelectorAll<HTMLButtonElement>('.sessionRailPill');
		expect(pills[0].getBoundingClientRect().width).toBe(48);
		expect(
			pills[0].querySelector('.sessionRailPill__mark--unread')
		).not.toBeNull();
		expect(
			pills[1].querySelector('.sessionRailPill__mark--unread')
		).toBeNull();
		await userEvent.hover(pills[1]);
		await waitFor(() =>
			expect(within(document.body).getByRole('tooltip')).toBeVisible()
		);
		const tooltip = within(document.body).getByRole('tooltip');
		expect(tooltip).toHaveTextContent('Neue Thread-Antwort');
		expect(tooltip).toHaveTextContent('Es gibt eine neue Antwort');
		expect(tooltip).toHaveTextContent('vor 3 Min.');
		await userEvent.unhover(pills[1]);
		await userEvent.click(pills[2]);
		await waitFor(() =>
			expect(pills[2]).toHaveAttribute('aria-current', 'true')
		);
		expect(
			root.querySelector('.notificationsCenter__detail')
		).toHaveTextContent('Termin vor Ort geplant');
		const handle = canvas.getByRole('separator');
		handle.focus();
		await userEvent.keyboard('{ArrowDown}');
		await waitFor(() =>
			expect(
				root.querySelector('.notificationsCenter__list')!.scrollTop
			).toBeGreaterThan(0)
		);
		await userEvent.keyboard('{End}');
		await waitFor(() =>
			expect(root.querySelector('.sessionRailPill')).toBeNull()
		);
		expect(localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY)).toBe('600');
		expect(
			root.querySelectorAll('.notificationsCenter__card')
		).toHaveLength(20);
		const last = root.querySelector(
			'.notificationsCenter__listRow--last .notificationsCenter__card'
		)!;
		expect(getComputedStyle(last).borderBottomLeftRadius).toBe('32px');
		await userEvent.keyboard('{Home}');
		await waitFor(() =>
			expect(root.querySelectorAll('.sessionRailPill')).toHaveLength(20)
		);
		expect(localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY)).toBe('80');
		handle.blur();
	}
};

const normalBelowDesktop: Story['play'] = async ({ canvasElement }) => {
	await waitFor(() =>
		expect(
			canvasElement.querySelectorAll('.notificationsCenter__card')
		).toHaveLength(20)
	);
	expect(canvasElement.querySelector('.sessionRailPill')).toBeNull();
	expect(canvasElement.querySelector('[role="separator"]')).toBeNull();
	expect(localStorage.getItem(TIMELINE_WIDTH_STORAGE_KEY)).toBe('80');
};
export const TabletKeepsNormalCards: Story = {
	globals: { viewport: { value: 'tablet820' } },
	play: normalBelowDesktop
};
export const PhoneKeepsNormalCards: Story = {
	globals: { viewport: { value: 'phone390' } },
	play: normalBelowDesktop
};
export const RetryInRail: Story = {
	decorators: [
		withTimelineData(feed, undefined, {
			olderNotificationsError: true,
			loadOlderNotifications: loadOlder
		})
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const retry = await canvas.findByRole('button', {
			name: /erneut versuchen/i
		});
		await userEvent.click(retry);
		await waitFor(() => expect(loadOlder).toHaveBeenCalledTimes(1));
		expect(retry.getBoundingClientRect().width).toBe(48);
	}
};
