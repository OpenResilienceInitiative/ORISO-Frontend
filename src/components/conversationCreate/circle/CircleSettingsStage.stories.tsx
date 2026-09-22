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
			page(canvasElement).getByRole('button', { name: 'Hilfe' })
		).toBeVisible();
		await expect(
			within(listbox).queryByRole('option', { name: 'Hilfe' })
		).toBeNull();
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
			page(canvasElement).getByRole('button', { name: 'Hilfe' })
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

/*
 * Backend stand-in for the wired create flow: the create POST answers with a
 * room, the session refresh returns the Series behind it. Installed per story
 * on top of the preview's own fetch mock and removed again afterwards.
 */
const mockCreateBackend = () => {
	const previous = globalThis.fetch;
	const calls: string[] = [];
	globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input instanceof Request ? input.url : input);
		// fetchData calls `fetch(Request)` with no init; the method lives on
		// the Request (same as `.storybook/preview.tsx`).
		const method = (
			init?.method ||
			(input instanceof Request ? input.method : undefined) ||
			'GET'
		).toUpperCase();
		const json = (body: unknown) =>
			new Response(JSON.stringify(body), {
				status: 201,
				headers: { 'content-type': 'application/json' }
			});
		if (
			method === 'POST' &&
			/\/service\/users\/chat\/(v2\/)?new/.test(url)
		) {
			calls.push('create');
			return json({ matrixRoomId: '!story-room:matrix.storybook.test' });
		}
		if (url.includes('/service/users/sessions/room')) {
			calls.push('refresh');
			return new Response(
				JSON.stringify({
					sessions: [
						{
							chat: {
								id: 4711,
								matrixRoomId:
									'!story-room:matrix.storybook.test'
							}
						}
					]
				}),
				{ status: 200, headers: { 'content-type': 'application/json' } }
			);
		}
		return previous(input, init);
	};
	return {
		calls,
		restore: () => {
			globalThis.fetch = previous;
		}
	};
};

const createAndOpenShareDialog = async (canvasElement: HTMLElement) => {
	const create = within(canvasElement).getByRole('button', {
		name: 'Erstellen'
	});
	await waitFor(() => expect(create).toBeEnabled());
	await userEvent.click(create);
	const dialog = await page(canvasElement).findByRole(
		'dialog',
		{ name: 'Gesprächskreis angelegt' },
		{ timeout: 8000 }
	);
	await waitFor(() => expect(dialog).toBeVisible());
	return dialog;
};

/**
 * #1499 item 5, wired: "Erstellen" on the real form creates the circle and
 * the share dialog opens with the invite link on THIS host (window.location
 * origin, never a configured production URL). The story stops with the
 * dialog open.
 */
export const CreateOpensShareDialog: Story = {
	name: 'Create → share dialog (wired) · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: COLLEAGUES },
	beforeEach: () => mockCreateBackend().restore,
	play: async ({ canvasElement }) => {
		const dialog = await createAndOpenShareDialog(canvasElement);
		await expect(
			within(dialog).getByLabelText('Einladungs-Link')
		).toHaveValue(`${window.location.origin}/login?gcid=4711`);
		await expect(within(dialog).getByText('Sucht')).toBeVisible();
	}
};

/** The dialog stays until "Fertig"; closing it ends the create flow. */
export const CreateThenCloseShareDialog: Story = {
	name: 'Create → share dialog → Fertig (wired) · 1440',
	globals: desktop1440Globals,
	args: { layout: 'desktop', people: COLLEAGUES },
	beforeEach: () => mockCreateBackend().restore,
	play: async ({ canvasElement }) => {
		const dialog = await createAndOpenShareDialog(canvasElement);
		await userEvent.click(
			within(dialog).getByRole('button', { name: 'Fertig' })
		);
		await waitFor(() =>
			expect(page(canvasElement).queryByRole('dialog')).toBeNull()
		);
	}
};
