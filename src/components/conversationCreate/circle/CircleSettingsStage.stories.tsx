import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';
import { CircleSettingsStage, COLLEAGUES } from './circleSettingsStage';

/**
 * #1499 items 3 and 4 on the wired stage: the real `CircleSettingsView`
 * ("Einstellungen für den Gesprächskreis") inside the consultant app frame at
 * 1440 and 390.
 *
 * - Co-moderator menu with nobody to pick: a disabled "Keine Person
 *   verfügbar" line and a "Hilfe" entry that opens the post-creation help.
 * - Welcome / rules editor: translate action in the language row (no longer
 *   floating over the field), every tenant language as a chip, and on desktop
 *   the two text boxes grow to fill the card.
 */

const meta = {
	title: 'ConversationCreate/Circle settings stage',
	component: CircleSettingsStage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/sessions/consultant/sessionView' }
	},
	args: {
		layout: 'desktop',
		people: [],
		activeLanguages: ['de', 'en', 'ru']
	}
} satisfies Meta<typeof CircleSettingsStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const openModeratorMenu = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	const picker = canvasElement.querySelector(
		'.circleSettings__moderatorPicker'
	) as HTMLElement;
	picker.scrollIntoView({ block: 'center' });
	await userEvent.click(
		within(picker).getByRole('button', {
			name: /Liste der Co-Moderator:innen/
		})
	);
	await expect(await page(canvasElement).findByRole('listbox')).toBeVisible();
	return canvas;
};

/** #1499 *3 — nobody to pick: the menu still says so, and offers help. */
export const CoModeratorEmptyDesktop: Story = {
	name: 'Co-moderator menu · nobody available · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: [] },
	play: async ({ canvasElement }) => {
		await openModeratorMenu(canvasElement);
		const listbox = page(canvasElement).getByRole('listbox');
		const empty = within(listbox).getByRole('option', {
			name: 'Keine Person verfügbar'
		});
		await expect(empty).toHaveAttribute('aria-disabled', 'true');
		await expect(
			within(listbox).getByRole('option', { name: 'Hilfe' })
		).toBeVisible();
	}
};

export const CoModeratorEmptyMobile: Story = {
	name: 'Co-moderator menu · nobody available · 390',
	globals: phone390Globals,
	args: { layout: 'mobile', people: [] },
	play: CoModeratorEmptyDesktop.play
};

/** "Hilfe" opens the explanation of the post-creation path. */
export const CoModeratorHelpDialog: Story = {
	name: 'Co-moderator help dialog · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: [] },
	play: async ({ canvasElement }) => {
		await openModeratorMenu(canvasElement);
		await userEvent.click(
			page(canvasElement).getByRole('option', { name: 'Hilfe' })
		);
		const dialog = await page(canvasElement).findByRole('dialog', {
			name: 'Co-Moderation später einladen'
		});
		await expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
		await expect(page(canvasElement).queryByRole('listbox')).toBeNull();
		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Verstanden' })
		);
		await waitFor(() =>
			expect(page(canvasElement).queryByRole('dialog')).toBeNull()
		);
	}
};

/** With colleagues the menu is unchanged: names, no empty line, no help. */
export const CoModeratorWithColleagues: Story = {
	name: 'Co-moderator menu · colleagues available · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: COLLEAGUES },
	play: async ({ canvasElement }) => {
		await openModeratorMenu(canvasElement);
		const listbox = page(canvasElement).getByRole('listbox');
		await expect(within(listbox).getAllByRole('option')).toHaveLength(3);
		await expect(
			within(listbox).queryByRole('option', { name: 'Hilfe' })
		).toBeNull();
	}
};

/* The navigation rail carries tabs too; count only the editor's languages. */
const languageTabs = (canvasElement: HTMLElement) =>
	within(
		canvasElement.querySelector('.createChat__languageTabs') as HTMLElement
	).getAllByRole('tab');

const rect = (element: Element | null) =>
	(element as HTMLElement).getBoundingClientRect();

/** #1499 *4 — translate action in the row, all languages, boxes fill. */
export const EditorDesktop: Story = {
	name: 'Welcome & rules editor · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: COLLEAGUES },
	play: async ({ canvasElement }) => {
		await expect(languageTabs(canvasElement)).toHaveLength(3);

		const bar = rect(
			canvasElement.querySelector('.createChat__languageBar')
		);
		const translate = rect(
			canvasElement.querySelector('.createChat__translateButton')
		);
		const welcome = rect(
			canvasElement.querySelector('.createChat__welcomeInput')
		);
		// In the row, not over the field.
		await expect(translate.top).toBeGreaterThanOrEqual(bar.top - 1);
		await expect(translate.bottom).toBeLessThanOrEqual(bar.bottom + 1);
		await expect(translate.bottom).toBeLessThanOrEqual(welcome.top);

		// Right card as tall as the schedule card, and the boxes took the room.
		const left = rect(canvasElement.querySelector('.circleSettings__card'));
		const right = rect(
			canvasElement.querySelector('.circleSettings__authorColumn')
		);
		await expect(Math.round(right.height)).toBe(Math.round(left.height));
		await expect(welcome.height).toBeGreaterThan(120);
		await expect(
			rect(canvasElement.querySelector('.ruleChipsEditor__input')).height
		).toBeGreaterThan(120);
	}
};

/** Mobile keeps the fixed boxes; only the icon moved into the row. */
export const EditorMobile: Story = {
	name: 'Welcome & rules editor · 390',
	globals: phone390Globals,
	args: { layout: 'mobile', people: COLLEAGUES },
	play: async ({ canvasElement }) => {
		const bar = rect(
			canvasElement.querySelector('.createChat__languageBar')
		);
		const translate = rect(
			canvasElement.querySelector('.createChat__translateButton')
		);
		await expect(translate.bottom).toBeLessThanOrEqual(bar.bottom + 1);
		await expect(
			Math.round(
				rect(canvasElement.querySelector('.createChat__welcomeInput'))
					.height
			)
		).toBe(120);
	}
};

/** A tenant that activated German only: one chip — a configuration, not a bug. */
export const EditorSingleLanguageTenant: Story = {
	name: 'Welcome & rules editor · tenant with DE only · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: COLLEAGUES, activeLanguages: ['de'] },
	play: async ({ canvasElement }) => {
		await expect(languageTabs(canvasElement)).toHaveLength(1);
	}
};
