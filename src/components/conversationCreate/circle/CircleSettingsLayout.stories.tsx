import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals,
	tablet834Globals
} from '../../message/messageStoryShell';
import { CircleSettingsStage, COLLEAGUES } from './circleSettingsStage';

/**
 * #1499 follow-ups on the wired "Einstellungen für den Gesprächskreis" stage:
 *
 * - Phones (< 900px): the schedule card and the welcome/rules card read as
 *   one card — no rounded corners between them, same width, same insets.
 * - The repetition row is one control: the number of dates is the big value,
 *   the interval sits under it in small type ("10 mal" / "Wöchentlich" = ten
 *   dates, one per week). One date reads "einmalig" and the interval line
 *   turns inactive.
 */

const meta = {
	title: 'ConversationCreate/Circle settings layout and repeat',
	component: CircleSettingsStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	args: {
		layout: 'desktop',
		people: COLLEAGUES,
		activeLanguages: ['de', 'en', 'ru']
	}
} satisfies Meta<typeof CircleSettingsStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const rect = (element: Element | null) =>
	(element as HTMLElement).getBoundingClientRect();

const cards = (canvasElement: HTMLElement) => {
	const card = canvasElement.querySelector(
		'.circleSettings__card'
	) as HTMLElement;
	const author = canvasElement.querySelector(
		'.circleSettings__authorColumn'
	) as HTMLElement;
	return { card, author };
};

/** Both cards flush: same edges, touching, square where they meet. */
const expectOneContinuousCard = async (canvasElement: HTMLElement) => {
	const { card, author } = cards(canvasElement);
	const top = rect(card);
	const bottom = rect(author);
	await expect(Math.abs(top.left - bottom.left)).toBeLessThan(1);
	await expect(Math.abs(top.right - bottom.right)).toBeLessThan(1);
	await expect(Math.abs(bottom.top - top.bottom)).toBeLessThan(1);
	const cardStyle = getComputedStyle(card);
	const authorStyle = getComputedStyle(author);
	await expect(cardStyle.borderBottomLeftRadius).toBe('0px');
	await expect(cardStyle.borderBottomRightRadius).toBe('0px');
	await expect(authorStyle.borderTopLeftRadius).toBe('0px');
	await expect(authorStyle.borderTopRightRadius).toBe('0px');
};

export const CardsDesktop: Story = {
	name: 'Cards · two cards side by side · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		const { card, author } = cards(canvasElement);
		// Desktop is unchanged: two separate rounded cards, 24px apart.
		await expect(getComputedStyle(author).borderTopLeftRadius).toBe('28px');
		await expect(Math.round(rect(author).left - rect(card).right)).toBe(24);
	}
};

export const CardsMobile: Story = {
	name: 'Cards · one continuous card · 390',
	globals: phone390Globals,
	args: { layout: 'mobile' },
	play: async ({ canvasElement }) => expectOneContinuousCard(canvasElement)
};

/** Wider than the old 400px cap on the upper card — the width drift showed here. */
export const CardsTablet: Story = {
	name: 'Cards · one continuous card · 834',
	globals: tablet834Globals,
	args: { layout: 'mobile' },
	play: async ({ canvasElement }) => expectOneContinuousCard(canvasElement)
};

const repeatRow = (canvasElement: HTMLElement) =>
	canvasElement.querySelector('.scheduleRows__repeat') as HTMLElement;

const repeatLines = (canvasElement: HTMLElement) => {
	const row = repeatRow(canvasElement);
	return {
		count: row.querySelector('.scheduleRows__repeatCount')?.textContent,
		interval: row.querySelector('.scheduleRows__repeatInterval')
			?.textContent,
		intervalInactive: Boolean(
			row.querySelector('.scheduleRows__repeatInterval--inactive')
		)
	};
};

const step = async (canvasElement: HTMLElement, direction: 'up' | 'down') =>
	userEvent.click(
		repeatRow(canvasElement).querySelector(
			`.splitButton__step--${direction}`
		) as HTMLElement
	);

const pickInterval = async (canvasElement: HTMLElement, label: string) => {
	await userEvent.click(
		repeatRow(canvasElement).querySelector(
			'.splitButton__main'
		) as HTMLElement
	);
	const listbox = await within(canvasElement.ownerDocument.body).findByRole(
		'listbox'
	);
	await userEvent.click(within(listbox).getByRole('option', { name: label }));
};

const seriesPlay = async ({
	canvasElement
}: {
	canvasElement: HTMLElement;
}) => {
	repeatRow(canvasElement).scrollIntoView({ block: 'center' });
	await expect(repeatLines(canvasElement)).toEqual({
		count: '10 mal',
		interval: 'Wöchentlich',
		intervalInactive: false
	});

	// A step changes the number of dates, never the interval.
	await step(canvasElement, 'up');
	await waitFor(() =>
		expect(repeatLines(canvasElement).count).toBe('11 mal')
	);
	await expect(repeatLines(canvasElement).interval).toBe('Wöchentlich');

	// Choosing an interval keeps the number of dates.
	await pickInterval(canvasElement, 'Monatlich');
	await waitFor(() =>
		expect(repeatLines(canvasElement).interval).toBe('Monatlich')
	);
	await expect(repeatLines(canvasElement).count).toBe('11 mal');
};

export const RepeatSeriesDesktop: Story = {
	name: 'Repeat · 10 dates weekly · 1440',
	globals: desktop1440Globals,
	args: { prefill: { repeatCount: 10, interval: 'WEEKLY' } },
	play: seriesPlay
};

export const RepeatSeriesMobile: Story = {
	name: 'Repeat · 10 dates weekly · 390',
	globals: phone390Globals,
	args: {
		layout: 'mobile',
		prefill: { repeatCount: 10, interval: 'WEEKLY' }
	},
	play: seriesPlay
};

const oneOffPlay = async ({
	canvasElement
}: {
	canvasElement: HTMLElement;
}) => {
	repeatRow(canvasElement).scrollIntoView({ block: 'center' });
	// One date: "einmalig", and the interval slot is shown but inactive.
	await expect(repeatLines(canvasElement)).toEqual({
		count: 'einmalig',
		interval: 'Intervall',
		intervalInactive: true
	});

	await step(canvasElement, 'up');
	await waitFor(() => expect(repeatLines(canvasElement).count).toBe('2 mal'));
	await expect(repeatLines(canvasElement)).toMatchObject({
		interval: 'Wöchentlich',
		intervalInactive: false
	});

	await step(canvasElement, 'down');
	await waitFor(() =>
		expect(repeatLines(canvasElement).count).toBe('einmalig')
	);

	// The interval can be chosen first; it waits, inactive, for a second date.
	await pickInterval(canvasElement, 'Monatlich');
	await waitFor(() =>
		expect(repeatLines(canvasElement)).toEqual({
			count: 'einmalig',
			interval: 'Monatlich',
			intervalInactive: true
		})
	);
	await step(canvasElement, 'up');
	await waitFor(() =>
		expect(repeatLines(canvasElement)).toEqual({
			count: '2 mal',
			interval: 'Monatlich',
			intervalInactive: false
		})
	);
};

export const RepeatOneOffDesktop: Story = {
	name: 'Repeat · one date (einmalig) · 1440',
	globals: desktop1440Globals,
	args: { prefill: { repeatCount: 1, interval: 'WEEKLY' } },
	play: oneOffPlay
};

export const RepeatOneOffMobile: Story = {
	name: 'Repeat · one date (einmalig) · 390',
	globals: phone390Globals,
	args: { layout: 'mobile', prefill: { repeatCount: 1, interval: 'WEEKLY' } },
	play: oneOffPlay
};
