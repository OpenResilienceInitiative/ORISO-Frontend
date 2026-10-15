import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DisplayFilterDialog, SESSION_COLUMNS } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	setKindSetting
} from './displayFilterTypes';
import {
	REQUEST_KINDS,
	SESSION_KINDS,
	STORY_LABELS,
	TIMELINE_KINDS
} from './displayFilterStoryData';
import { ORISO_M3_FIGMA_URL } from '../storybookDesignLinks';
import {
	desktop1440Globals,
	phone320Globals,
	phone390Globals,
	phone390LandscapeGlobals
} from '../message/messageStoryShell';

/**
 * The display-filter dialog (#1377, spec §3): per kind two switches — show
 * and pill — the auto-read rule and a reset to the profile defaults. Built on
 * the house `M3Dialog` so it reads as one design with every other sheet.
 */
const meta = {
	title: 'Components/Dialog/DisplayFilterDialog',
	component: DisplayFilterDialog,
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: ORISO_M3_FIGMA_URL },
		docs: {
			description: {
				component:
					'Per-section display filter. "In der Liste" decides whether a kind appears in the list at all; "Als Pille" whether it gets a chip (kinds without a pill are bundled under Sonstiges). "Sonstiges" is the catch-all and can never be hidden. Presentational — the store (slice 2) owns the value.'
			}
		}
	},
	args: {
		open: true,
		onClose: () => undefined,
		onReset: () => undefined,
		onChange: () => undefined,
		kinds: TIMELINE_KINDS,
		value: EMPTY_DISPLAY_FILTER,
		labels: STORY_LABELS
	}
} satisfies Meta<typeof DisplayFilterDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const Controlled = (
	args: React.ComponentProps<typeof DisplayFilterDialog> & {
		initialValue?: DisplayFilterValue;
	}
) => {
	// Mirrors the slice-2 store contract: the section override is a key that
	// either exists or not (`null`); `canReset` is that presence, never
	// inferred from the value's contents (an empty override still exists).
	const [override, setOverride] = useState<DisplayFilterValue | null>(
		args.initialValue ?? null
	);
	return (
		<DisplayFilterDialog
			{...args}
			value={override ?? args.value}
			canReset={override !== null}
			onChange={setOverride}
			onReset={() => setOverride(null)}
			onOpenProfile={() => undefined}
		/>
	);
};

/** Everything shown with a pill — the shipped default. Reset is disabled. */
export const Default: Story = {
	render: (args) => <Controlled {...args} />
};

const CUSTOMISED: DisplayFilterValue = {
	...setKindSetting(
		setKindSetting(EMPTY_DISPLAY_FILTER, 'drafts', { show: false }),
		'system',
		{ pill: false }
	),
	autoReadHidden: true
};

/** Drafts hidden (pill greyed out), System without a pill, auto-read on. */
export const Customised: Story = {
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const draftsPill = dialog.getByRole('button', {
			name: 'Pille: Entwürfe'
		});
		await expect(draftsPill).toBeDisabled();
		await expect(
			dialog.getByRole('checkbox', { name: 'In der Liste: Sonstiges' })
		).toBeDisabled();
		await expect(
			dialog.getByRole('button', {
				name: 'Zurücksetzen'
			})
		).toBeEnabled();
	}
};

/** Unticking "In der Liste" greys out the pill switch of that kind at once. */
export const HideAKind: Story = {
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const showCalls = dialog.getByRole('checkbox', {
			name: 'In der Liste: Anrufe'
		});
		const pillCalls = dialog.getByRole('button', {
			name: 'Pille: Anrufe'
		});
		await expect(pillCalls).toBeEnabled();
		await userEvent.click(showCalls);
		await expect(showCalls).not.toBeChecked();
		await expect(pillCalls).toBeDisabled();
		await expect(pillCalls).toHaveTextContent('Aus');
	}
};

/** Anfragen: no auto-read switch (an unseen enquiry is a waiting client). */
export const RequestsWithoutAutoRead: Story = {
	args: {
		showAutoRead: false,
		kinds: [
			{ id: 'nearby', label: 'In meiner Nähe', unreadCount: 3 },
			{ id: 'liveChat', label: 'Live-Chats', unreadCount: 0 },
			{ id: 'other', label: 'Sonstiges', unreadCount: 0 }
		],
		labels: { ...STORY_LABELS, title: 'Anzeige-Filter · Anfragen' }
	},
	render: (args) => <Controlled {...args} />
};

/** A newer app version saved these settings: everything inert, hint shown. */
export const ReadOnly: Story = {
	args: { readOnly: true },
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />
};

/** Some event types of a family hidden in the profile → mixed checkbox (spec §5.1). */
export const PartiallyHidden: Story = {
	args: {
		kinds: TIMELINE_KINDS.map((kind) =>
			kind.id === 'system' ? { ...kind, partial: true } : kind
		)
	},
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(
			dialog.getByRole('checkbox', { name: 'In der Liste: System' })
		).toHaveAttribute('aria-checked', 'mixed');
	}
};

/** Q7: on phones the same M3 dialog opens full-screen — no bottom sheet. */
export const Phone: Story = {
	globals: phone390Globals,
	args: { fullScreen: true },
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />
};

/**
 * Short viewport (landscape phone, software keyboard open): the generic
 * `height <= 420px` rule lets the whole sheet scroll, which would push the
 * title, close control and actions off screen. Full screen keeps the M3
 * contract — the surface never scrolls, the body is the scroll region.
 */
export const PhoneLandscape: Story = {
	globals: phone390LandscapeGlobals,
	args: { fullScreen: true },
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		await waitFor(() =>
			expect(doc.querySelector('.m3Dialog--fullScreen')).not.toBeNull()
		);
		// The viewport must actually be short, otherwise the media rule under
		// test never fires and the assertions below prove nothing.
		await expect(doc.defaultView!.innerHeight).toBeLessThanOrEqual(420);
		const surface = doc.querySelector(
			'.m3Dialog--fullScreen .m3Dialog__surface'
		) as HTMLElement;
		const body = doc.querySelector(
			'.m3Dialog--fullScreen .m3Dialog__body'
		) as HTMLElement;
		await expect(getComputedStyle(surface).overflowY).toBe('hidden');
		await expect(getComputedStyle(body).overflowY).toBe('auto');
		// Eight kind rows do not fit in 390px: the body scrolls, the sheet not.
		await expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
		await expect(surface.scrollTop).toBe(0);
		body.scrollTop = body.scrollHeight;
		await expect(body.scrollTop).toBeGreaterThan(0);
		await expect(surface.scrollTop).toBe(0);
		// Header and actions stay inside the viewport while the body scrolls.
		const title = doc.querySelector(
			'.m3Dialog--fullScreen h2, .m3Dialog--fullScreen [class*="__title"]'
		) as HTMLElement;
		const done = within(doc.body).getByRole('button', { name: 'Fertig' });
		await expect(title.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			0
		);
		await expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			doc.defaultView!.innerHeight
		);
	}
};

/** Gespräche/Anfragen: "Ton" instead of "In der Liste" — mute a kind, keep it listed. */
export const SessionsWithSoundColumn: Story = {
	render: () => (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={() => undefined}
			onOpenProfile={() => undefined}
			kinds={[
				{ id: 'oneToOne', label: 'Mail', unreadCount: 2 },
				{ id: 'liveChat', label: 'Live-Chat', unreadCount: 0 },
				{ id: 'circle', label: 'Gesprächskreis', unreadCount: 1 },
				{ id: 'other', label: 'Sonstiges', unreadCount: 0 }
			]}
			value={{
				kinds: { liveChat: { show: true, pill: true, sound: 'none' } },
				autoReadHidden: false
			}}
			labels={{ ...STORY_LABELS, title: 'Ansicht · Gespräche' }}
			columns={{ show: false, sound: true }}
			showAutoRead={false}
			onChange={() => undefined}
		/>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement.ownerDocument.body);
		await expect(
			canvas.getByRole('columnheader', { name: 'Ton' })
		).toBeTruthy();
		await expect(
			canvas.queryByRole('columnheader', { name: 'In der Liste' })
		).toBeNull();
		// Tone is a picker per kind (proposal A): the main segment previews,
		// the menu segment opens the choice. Live-Chat is muted in the fixture.
		await expect(
			canvas.getByRole('button', { name: 'Ton anhören: Live-Chat' })
		).toHaveTextContent('Stumm');
		await expect(
			canvas.getByRole('button', { name: 'Ton anhören: Mail' })
		).toHaveTextContent('Standard');
		await expect(
			canvas.getByRole('button', { name: 'Ton wählen: Live-Chat' })
		).toBeTruthy();
	}
};

/**
 * Phone layout (2026-10-15): the three-column table squeezed the kind names
 * to one letter per line and pushed "Anzeigen" past the right edge on Dev.
 * Below the phone breakpoint every kind is a block — icon and full name on
 * one line, its pickers underneath, each with its own small column label.
 * Measured through bounding boxes, so a regression shows as a number.
 */
const expectPhoneLayout = async (
	canvasElement: HTMLElement,
	width: number,
	columnLabels: string[]
) => {
	const doc = canvasElement.ownerDocument;
	await waitFor(() =>
		expect(
			doc.querySelectorAll('.displayFilterDialog__row').length
		).toBeGreaterThan(0)
	);
	// The viewport must really be the phone, or nothing below is proven.
	await expect(doc.defaultView!.innerWidth).toBe(width);
	const surface = doc
		.querySelector('.displayFilterDialog .m3Dialog__surface')!
		.getBoundingClientRect();
	// Full screen on a phone: the sheet is the viewport, no side band.
	await expect(Math.round(surface.left)).toBe(0);
	await expect(Math.round(surface.right)).toBe(width);
	const body = doc.querySelector(
		'.displayFilterDialog .m3Dialog__body'
	) as HTMLElement;
	// Nothing scrolls sideways.
	await expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
	const bodyBox = body.getBoundingClientRect();
	const rows = Array.from(
		doc.querySelectorAll<HTMLElement>('.displayFilterDialog__row')
	);
	for (const row of rows) {
		const name = row.querySelector(
			'.displayFilterDialog__kindText > span'
		) as HTMLElement;
		const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
		// Full name on one line.
		await expect(name.getBoundingClientRect().height).toBeLessThan(
			lineHeight * 1.5
		);
		const controls = Array.from(
			row.querySelectorAll<HTMLElement>(
				'.splitButton, .displayFilterDialog__cell input'
			)
		);
		for (const control of controls) {
			const box = control.getBoundingClientRect();
			await expect(box.left).toBeGreaterThanOrEqual(bodyBox.left);
			await expect(box.right).toBeLessThanOrEqual(bodyBox.right);
		}
		// Picker labels ("Standard", "Dynamisch") are not cut off.
		for (const label of Array.from(
			row.querySelectorAll<HTMLElement>('.splitButton__label')
		)) {
			await expect(label.scrollWidth).toBeLessThanOrEqual(
				label.clientWidth
			);
		}
		// The shared header row no longer lines up: each control carries
		// its own visible column label.
		// `waitFor`: the dialog fades in (opacity 0 on the first frame).
		for (const columnLabel of columnLabels) {
			await waitFor(() =>
				expect(within(row).getByText(columnLabel)).toBeVisible()
			);
		}
	}
};

const sessionsArgs = {
	fullScreen: true,
	kinds: SESSION_KINDS,
	columns: SESSION_COLUMNS,
	showAutoRead: true,
	labels: { ...STORY_LABELS, title: 'Ansicht · Gespräche' }
};

const requestsArgs = {
	fullScreen: true,
	kinds: REQUEST_KINDS,
	columns: SESSION_COLUMNS,
	showAutoRead: false,
	labels: { ...STORY_LABELS, title: 'Ansicht · Anfragen' }
};

/** Gespräche on a 390px phone (Ton + Anzeigen). */
export const Phone390: Story = {
	globals: phone390Globals,
	args: sessionsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 390, ['Ton', 'Anzeigen'])
};

/** Gespräche on the smallest supported phone. */
export const Phone320: Story = {
	globals: phone320Globals,
	args: sessionsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, ['Ton', 'Anzeigen'])
};

/** Anfragen on a 390px phone. */
export const PhoneRequests390: Story = {
	globals: phone390Globals,
	args: requestsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 390, ['Ton', 'Anzeigen'])
};

/** Anfragen on the smallest supported phone. */
export const PhoneRequests320: Story = {
	globals: phone320Globals,
	args: requestsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, ['Ton', 'Anzeigen'])
};

/** Zeitstrahl on a 390px phone (In der Liste + Anzeigen). */
export const PhoneTimeline390: Story = {
	globals: phone390Globals,
	args: { fullScreen: true },
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 390, ['In der Liste', 'Anzeigen'])
};

/** Zeitstrahl on the smallest supported phone. */
export const PhoneTimeline320: Story = {
	globals: phone320Globals,
	args: { fullScreen: true },
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, ['In der Liste', 'Anzeigen'])
};

/** Gespräche on desktop: the table layout is unchanged above the phone breakpoint. */
export const SessionsDesktop: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		await waitFor(() =>
			expect(
				doc.querySelectorAll('.displayFilterDialog__row').length
			).toBeGreaterThan(0)
		);
		// The shared header row labels the columns; the per-cell labels stay hidden.
		const header = within(doc.body).getByRole('columnheader', {
			name: 'Ton'
		});
		await expect(header.getBoundingClientRect().height).toBeGreaterThan(0);
		for (const label of Array.from(
			doc.querySelectorAll<HTMLElement>('.displayFilterDialog__cellLabel')
		)) {
			await expect(getComputedStyle(label).display).toBe('none');
		}
	}
};
