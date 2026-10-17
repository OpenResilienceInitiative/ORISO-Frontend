import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { DisplayFilterDialog, SESSION_COLUMNS } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	setKindSetting
} from './displayFilterTypes';
import {
	REQUEST_KINDS,
	REQUEST_STORY_LABELS,
	SESSION_KINDS,
	SESSION_STORY_LABELS,
	STORY_LABELS,
	TIMELINE_KINDS
} from './displayFilterStoryData';
import { emailSettingForKind } from './emailSettingForKind';
import type { DisplayFilterEmailColumn } from './DisplayFilterKindTable';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';
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
					'Per-section display filter (redesign 2026-10-15). A legend names the columns: "In der Liste" (Zeitstrahl: the kind appears at all), "Im Filter" (a filter button above the list), "Browser" (pop-up on this device, with a tone or silent; Gespräche/Anfragen) and "E-Mail" (the profile\'s stored e-mail notice, or "nicht verfügbar"). Filter-only buttons get their own section. Every choice is the same split-button picker with the house menu. Presentational — the store owns the value, `useDisplayFilterEmailColumn` the e-mail column.'
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

/** The profile's `profile.notifications.noEmail.info` (de). */
const NO_EMAIL_REASON = 'Sie haben noch keine E-Mail-Adresse hinzugefügt.';
/** `notifications.displayFilter.emailMasterOff` (de). */
const EMAILS_OFF_REASON =
	'E-Mail-Benachrichtigungen sind in Ihrem Profil ausgeschaltet';

/**
 * A story stand-in for `useDisplayFilterEmailColumn`: the same kind →
 * profile-switch mapping (counsellor), the stored values kept in memory.
 * The real save path is covered by `displayFilterEmail.test.tsx`.
 */
const useStoryEmail = (
	section: DisplayFilterSection | undefined,
	onEmailChange?: (kindId: string, next: boolean) => void,
	/** Set: every cell is unavailable, for this reason (no address, master off). */
	unavailableReason?: string
): DisplayFilterEmailColumn | undefined => {
	const [stored, setStored] = useState<Record<string, boolean>>({});
	if (!section) return undefined;
	return {
		cell: (kindId) =>
			!unavailableReason &&
			emailSettingForKind(section, kindId, 'consultant')
				? { checked: stored[kindId] ?? true }
				: null,
		unavailableReason,
		onChange: (kindId, next) => {
			setStored((current) => ({ ...current, [kindId]: next }));
			onEmailChange?.(kindId, next);
		}
	};
};

const Controlled = (
	args: React.ComponentProps<typeof DisplayFilterDialog> & {
		initialValue?: DisplayFilterValue;
		emailSection?: DisplayFilterSection;
		onEmailChange?: (kindId: string, next: boolean) => void;
		emailUnavailableReason?: string;
	}
) => {
	const email = useStoryEmail(
		args.emailSection,
		args.onEmailChange,
		args.emailUnavailableReason
	);
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
			email={email ?? args.email}
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
			name: 'Im Filter: Entwürfe'
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
			name: 'Im Filter: Anrufe'
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

/**
 * A newer app version saved these settings: everything inert, hint shown —
 * the E-Mail column too, although it writes the profile.
 */
const readOnlyArgs = { readOnly: true, emailSection: 'timeline' as const };
export const ReadOnly: Story = {
	args: readOnlyArgs,
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(
			await dialog.findByRole('button', { name: 'E-Mail: Nachrichten' })
		).toBeDisabled();
		await expect(
			dialog.getByRole('button', { name: 'E-Mail wählen: Nachrichten' })
		).toBeDisabled();
	}
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
			canvas.getByRole('columnheader', { name: 'Browser' })
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
			canvas.getByRole('button', {
				name: 'Browser-Benachrichtigung: Live-Chat'
			})
		).toBeTruthy();
	}
};

/**
 * Phone layout (Phone.dc.html): every kind is a card — icon and full name
 * on one line as its heading, then one row per column with its label left
 * and the picker right. Measured through bounding boxes, so a regression
 * shows as a number.
 */
const expectPhoneLayout = async (
	canvasElement: HTMLElement,
	width: number,
	columnLabels: string[]
) => {
	const doc = canvasElement.ownerDocument;
	const cardSelector =
		'.displayFilterDialog__table:not(.displayFilterDialog__table--quick) .displayFilterDialog__row';
	await waitFor(() =>
		expect(doc.querySelectorAll(cardSelector).length).toBeGreaterThan(0)
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
	for (const row of Array.from(
		doc.querySelectorAll<HTMLElement>('.displayFilterDialog__row')
	)) {
		const name = row.querySelector(
			'.displayFilterDialog__kindName'
		) as HTMLElement;
		const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
		// Full name on one line.
		await expect(name.getBoundingClientRect().height).toBeLessThan(
			lineHeight * 1.5
		);
		for (const control of Array.from(
			row.querySelectorAll<HTMLElement>(
				'.splitButton, .displayFilterDialog__cell input, .displayFilterDialog__unavailable'
			)
		)) {
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
	}
	for (const card of Array.from(
		doc.querySelectorAll<HTMLElement>(cardSelector)
	)) {
		// `waitFor`: the dialog fades in (opacity 0 on the first frame).
		for (const columnLabel of columnLabels) {
			await waitFor(() =>
				expect(within(card).getByText(columnLabel)).toBeVisible()
			);
		}
		// Label left, picker right, on one line.
		for (const cell of Array.from(
			card.querySelectorAll<HTMLElement>('.displayFilterDialog__cell')
		)) {
			const label = cell
				.querySelector('.displayFilterDialog__cellLabel')!
				.getBoundingClientRect();
			const control = cell.lastElementChild!.getBoundingClientRect();
			await expect(label.right).toBeLessThanOrEqual(control.left);
			await expect(label.top).toBeLessThan(control.bottom);
			await expect(control.top).toBeLessThan(label.bottom);
		}
	}
};

/** Section headings each area really has (derived from its kinds). */
const expectSections = async (
	canvasElement: HTMLElement,
	headings: string[],
	absent: string[] = []
) => {
	const dialog = within(canvasElement.ownerDocument.body);
	for (const heading of headings) {
		await expect(
			dialog.getByRole('heading', { level: 3, name: heading })
		).toBeTruthy();
	}
	for (const heading of absent) {
		await expect(
			dialog.queryByRole('heading', { level: 3, name: heading })
		).toBeNull();
	}
};

const SESSION_HEADINGS = [
	'Gesprächsarten',
	'Weitere Filter-Knöpfe',
	'Darstellung der Filter-Knöpfe'
];
const SESSION_LABELS = ['Im Filter', 'Browser', 'E-Mail'];
const TIMELINE_LABELS = ['In der Liste', 'Im Filter', 'E-Mail'];

const sessionsArgs = {
	fullScreen: true,
	kinds: SESSION_KINDS,
	columns: SESSION_COLUMNS,
	showAutoRead: true,
	labels: SESSION_STORY_LABELS,
	emailSection: 'sessions' as const
};

const requestsArgs = {
	fullScreen: true,
	kinds: REQUEST_KINDS,
	columns: SESSION_COLUMNS,
	showAutoRead: false,
	labels: REQUEST_STORY_LABELS,
	emailSection: 'requests' as const
};

const timelineArgs = {
	fullScreen: true,
	emailSection: 'timeline' as const
};

/** Gespräche on a 390px phone: cards with Im Filter / Browser / E-Mail. */
export const Phone390: Story = {
	globals: phone390Globals,
	args: sessionsArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectPhoneLayout(canvasElement, 390, SESSION_LABELS);
		await expectSections(canvasElement, SESSION_HEADINGS);
	}
};

/** Gespräche on the smallest supported phone. */
export const Phone320: Story = {
	globals: phone320Globals,
	args: sessionsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, SESSION_LABELS)
};

/** Anfragen on a 390px phone: no filter-only buttons, so no such section. */
export const PhoneRequests390: Story = {
	globals: phone390Globals,
	args: requestsArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectPhoneLayout(canvasElement, 390, SESSION_LABELS);
		await expectSections(
			canvasElement,
			['Anfragearten', 'Darstellung der Filter-Knöpfe'],
			['Weitere Filter-Knöpfe']
		);
	}
};

/** Anfragen on the smallest supported phone. */
export const PhoneRequests320: Story = {
	globals: phone320Globals,
	args: requestsArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, SESSION_LABELS)
};

/** Zeitstrahl on a 390px phone: In der Liste / Im Filter / E-Mail, no Browser. */
export const PhoneTimeline390: Story = {
	globals: phone390Globals,
	args: timelineArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectPhoneLayout(canvasElement, 390, TIMELINE_LABELS);
		await expectSections(
			canvasElement,
			['Ereignisarten', 'Darstellung der Filter-Knöpfe'],
			['Weitere Filter-Knöpfe']
		);
		await expect(
			within(canvasElement.ownerDocument.body).queryByText('Browser')
		).toBeNull();
	}
};

/** Zeitstrahl on the smallest supported phone. */
export const PhoneTimeline320: Story = {
	globals: phone320Globals,
	args: timelineArgs,
	render: (args) => <Controlled {...args} />,
	play: ({ canvasElement }) =>
		expectPhoneLayout(canvasElement, 320, TIMELINE_LABELS)
};

/** Desktop: the legend explains the columns, the header row labels them. */
const expectDesktop = async (canvasElement: HTMLElement, columns: string[]) => {
	const doc = canvasElement.ownerDocument;
	await waitFor(() =>
		expect(
			doc.querySelectorAll('.displayFilterDialog__row').length
		).toBeGreaterThan(0)
	);
	const dialog = within(doc.body);
	const legend = doc.querySelector(
		'.displayFilterDialog__legend'
	) as HTMLElement;
	await waitFor(() => expect(legend).toBeVisible());
	await expect(
		Array.from(legend.querySelectorAll('dt')).map((dt) => dt.textContent)
	).toEqual(columns);
	for (const column of ['Art', ...columns]) {
		await expect(
			dialog.getAllByRole('columnheader', { name: column })[0]
		).toBeVisible();
	}
	for (const label of Array.from(
		doc.querySelectorAll<HTMLElement>('.displayFilterDialog__cellLabel')
	)) {
		await expect(getComputedStyle(label).display).toBe('none');
	}
	// Kind names stay on one line ("Interner Gruppenchat").
	for (const name of Array.from(
		doc.querySelectorAll<HTMLElement>('.displayFilterDialog__kindName')
	)) {
		const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
		await expect(name.getBoundingClientRect().height).toBeLessThan(
			lineHeight * 1.5
		);
	}
	const body = doc.querySelector(
		'.displayFilterDialog .m3Dialog__body'
	) as HTMLElement;
	await expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth);
};

/** Gespräche on desktop: three sections, Im Filter / Browser / E-Mail. */
export const SessionsDesktop: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectDesktop(canvasElement, SESSION_LABELS);
		await expectSections(canvasElement, SESSION_HEADINGS);
		const dialog = within(canvasElement.ownerDocument.body);
		// Filter-only buttons: only "Im Filter", in their own section.
		const archive = dialog.getByRole('row', { name: /Archiviert/ });
		await expect(
			within(archive).getByRole('button', {
				name: 'Im Filter: Archiviert'
			})
		).toBeTruthy();
		await expect(within(archive).queryAllByRole('button')).toHaveLength(2);
	}
};

/** Anfragen on desktop: no filter-only section (Anfragen has none). */
export const RequestsDesktop: Story = {
	globals: desktop1440Globals,
	args: { ...requestsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectDesktop(canvasElement, SESSION_LABELS);
		await expectSections(
			canvasElement,
			['Anfragearten', 'Darstellung der Filter-Knöpfe'],
			['Weitere Filter-Knöpfe']
		);
	}
};

/** Zeitstrahl on desktop: In der Liste / Im Filter / E-Mail, no Browser. */
export const TimelineDesktop: Story = {
	globals: desktop1440Globals,
	args: { ...timelineArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		await expectDesktop(canvasElement, TIMELINE_LABELS);
		await expectSections(
			canvasElement,
			['Ereignisarten', 'Darstellung der Filter-Knöpfe'],
			['Weitere Filter-Knöpfe']
		);
	}
};

/**
 * The Browser menu: the house menu, adapted — "Pop-up mit Ton" over the
 * tones, a divider, then "Pop-up ohne Ton" with its support line (the
 * stored mute). No "Aus": a per-kind "no pop-up" cannot be stored.
 */
export const BrowserMenuOpen: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const doc = canvasElement.ownerDocument;
		const dialog = within(doc.body);
		await userEvent.click(
			await dialog.findByRole('button', {
				name: 'Browser-Benachrichtigung: Interner Gruppenchat'
			})
		);
		const menu = await dialog.findByRole('menu', {
			name: 'Browser-Benachrichtigung: Interner Gruppenchat'
		});
		await expect(menu.closest('.chatMenuDropdown')).not.toBeNull();
		// The menu fades in.
		await waitFor(() =>
			expect(within(menu).getByText('Pop-up mit Ton')).toBeVisible()
		);
		const items = within(menu).getAllByRole('menuitemradio');
		await expect(items[0]).toHaveAttribute('aria-checked', 'true');
		await expect(items[0]).toHaveTextContent('Standard');
		await expect(within(menu).getByRole('separator')).toBeTruthy();
		const silent = within(menu).getByRole('menuitemradio', {
			name: /^Pop-up ohne Ton/
		});
		await expect(silent).toHaveTextContent('Nur das Fenster, kein Ton');
		await expect(
			within(menu).queryByRole('menuitemradio', { name: /^Aus/ })
		).toBeNull();
		// The divider comes right before the silent pop-up.
		await expect(silent.previousElementSibling?.getAttribute('role')).toBe(
			'separator'
		);
	}
};

/**
 * No stored e-mail setting for Live-Chat: the cell is text, not a control.
 * On desktop it stays a compact pill and is one Tab stop, so keyboard and
 * touch users can reach the reason: a tooltip on focus, hover and tap. The
 * reason is the cell's own text for screen readers, read once.
 */
export const EmailUnavailable: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Live-Chat/ });
		const cell = row.querySelector(
			'.displayFilterDialog__unavailable'
		) as HTMLElement;
		await expect(cell).toHaveTextContent('nicht verfügbar');
		await expect(cell).toHaveTextContent(
			'Für diese Art gibt es noch keine E-Mail'
		);
		await expect(
			within(row).queryByRole('button', { name: /^E-Mail/ })
		).toBeNull();
		// Keyboard: from the Live-Chat browser menu button, Tab lands on the
		// unavailable cell and its tooltip names the reason; the next Tab
		// goes on to the next row's first control.
		within(row)
			.getByRole('button', {
				name: 'Browser-Benachrichtigung: Live-Chat'
			})
			.focus();
		await userEvent.tab();
		await expect(canvasElement.ownerDocument.activeElement).toBe(cell);
		await expect(await dialog.findByRole('tooltip')).toHaveTextContent(
			'Für diese Art gibt es noch keine E-Mail'
		);
		await userEvent.tab();
		await expect(canvasElement.ownerDocument.activeElement).toBe(
			dialog.getByRole('button', {
				name: 'Im Filter: Interner Gruppenchat'
			})
		);
	}
};

const emailChange = fn();

/** Changing an e-mail cell hands the kind and the new value to the e-mail column. */
export const EmailChange: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => <Controlled {...args} onEmailChange={emailChange} />,
	play: async ({ canvasElement }) => {
		emailChange.mockClear();
		const dialog = within(canvasElement.ownerDocument.body);
		const picker = await dialog.findByRole('button', {
			name: 'E-Mail: Mail-Beratung'
		});
		await expect(picker).toHaveTextContent('An');
		await userEvent.click(
			dialog.getByRole('button', { name: 'E-Mail wählen: Mail-Beratung' })
		);
		const menu = await dialog.findByRole('menu', {
			name: 'E-Mail wählen: Mail-Beratung'
		});
		await expect(
			within(menu)
				.getAllByRole('menuitemradio')
				.map((item) => item.textContent)
		).toEqual(['An', 'Aus']);
		await userEvent.click(
			within(menu).getByRole('menuitemradio', { name: 'Aus' })
		);
		await expect(emailChange).toHaveBeenCalledWith('oneToOne', false);
		await waitFor(() => expect(picker).toHaveTextContent('Aus'));
	}
};

/**
 * No e-mail address yet: the profile shows only "add an address", so every
 * E-Mail cell is "nicht verfügbar" with the profile's reason — no switch.
 */
const noAddressArgs = {
	...sessionsArgs,
	fullScreen: false,
	emailUnavailableReason: NO_EMAIL_REASON
};
export const EmailNoAddress: Story = {
	globals: desktop1440Globals,
	args: noAddressArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Mail-Beratung/ });
		await expect(row).toHaveTextContent(NO_EMAIL_REASON);
		await expect(
			dialog.queryByRole('button', { name: 'E-Mail: Mail-Beratung' })
		).toBeNull();
	}
};

/**
 * The profile's master e-mail switch is off: delivery needs it, so no cell
 * claims "An" — every cell is unavailable with that reason, and the dialog
 * never flips the master itself.
 */
const masterOffArgs = {
	...sessionsArgs,
	fullScreen: false,
	emailUnavailableReason: EMAILS_OFF_REASON
};
export const EmailMasterOff: Story = {
	globals: desktop1440Globals,
	args: masterOffArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Supervision/ });
		await expect(row).toHaveTextContent(EMAILS_OFF_REASON);
		await expect(
			dialog.queryByRole('button', { name: 'E-Mail: Supervision' })
		).toBeNull();
	}
};

/**
 * `enableNewNotifications` off: the profile routes the legacy screens, so
 * `useDisplayFilterEmailColumn` returns no column and the dialog has none.
 */
const legacyArgs = {
	...sessionsArgs,
	fullScreen: false,
	emailSection: undefined
};
export const EmailLegacyNotifications: Story = {
	globals: desktop1440Globals,
	args: legacyArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await dialog.findByRole('row', { name: /Mail-Beratung/ });
		await expect(
			dialog.queryByRole('columnheader', { name: 'E-Mail' })
		).toBeNull();
	}
};

/** `notifications.displayFilter.browserOff` (de). */
const BROWSER_OFF_REASON = 'Pop-ups sind in Ihrem Profil ausgeschaltet';

/**
 * Pop-ups switched off in the profile (master switch, or every banner of the
 * area): no pop-up can show, so every Browser cell is "nicht verfügbar"
 * with that reason. The dialog never flips the switch itself.
 */
const browserOffArgs = {
	...sessionsArgs,
	fullScreen: false,
	browserUnavailableReason: BROWSER_OFF_REASON
};
export const BrowserMasterOff: Story = {
	globals: desktop1440Globals,
	args: browserOffArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Mail-Beratung/ });
		await expect(row).toHaveTextContent(BROWSER_OFF_REASON);
		await expect(row).toHaveTextContent(BROWSER_OFF_REASON);
		// Pointer: hovering the compact cell shows the reason.
		await userEvent.hover(
			row.querySelector(
				'.displayFilterDialog__unavailable'
			) as HTMLElement
		);
		await expect(await dialog.findByRole('tooltip')).toHaveTextContent(
			BROWSER_OFF_REASON
		);
		await expect(
			within(row).queryByRole('button', { name: /Ton anhören/ })
		).toBeNull();
	}
};

/** `erstantwort.notificationChoice.browserSilenced` (de). */
const BROWSER_MUTED_NOTICE =
	'Browser-Benachrichtigungen sind in Ihren Benachrichtigungseinstellungen stummgeschaltet.';

/**
 * Muted (do not disturb, account mute, device silenced): a notice, not a
 * lock — the state is often temporary and the column edits durable
 * preferences, so every Browser cell stays editable.
 */
const browserMutedArgs = {
	...sessionsArgs,
	fullScreen: false,
	browserMutedNotice: BROWSER_MUTED_NOTICE
};
export const BrowserMuted: Story = {
	globals: desktop1440Globals,
	args: browserMutedArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(
			await dialog.findByText(BROWSER_MUTED_NOTICE)
		).toHaveAttribute('role', 'status');
		const row = dialog.getByRole('row', { name: /Mail-Beratung/ });
		await expect(
			within(row).getByRole('button', { name: /Ton anhören/ })
		).toBeEnabled();
	}
};

const supervisionEmailChange = fn();

/**
 * Frank 2026-10-15: Supervision's e-mail cell is the profile's
 * Fachaustausch switch (`feedbackNotificationEnabled`) — an enabled picker.
 */
export const SupervisionEmail: Story = {
	globals: desktop1440Globals,
	args: { ...sessionsArgs, fullScreen: false },
	render: (args) => (
		<Controlled {...args} onEmailChange={supervisionEmailChange} />
	),
	play: async ({ canvasElement }) => {
		supervisionEmailChange.mockClear();
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Supervision/ });
		await expect(
			row.querySelector('.displayFilterDialog__unavailable')
		).toBeNull();
		const picker = within(row).getByRole('button', {
			name: 'E-Mail: Supervision'
		});
		await expect(picker).toBeEnabled();
		await userEvent.click(
			within(row).getByRole('button', {
				name: 'E-Mail wählen: Supervision'
			})
		);
		const menu = await dialog.findByRole('menu', {
			name: 'E-Mail wählen: Supervision'
		});
		await userEvent.click(
			within(menu).getByRole('menuitemradio', { name: 'Aus' })
		);
		await expect(supervisionEmailChange).toHaveBeenCalledWith(
			'supervision',
			false
		);
		await waitFor(() => expect(picker).toHaveTextContent('Aus'));
	}
};

/**
 * Phone: every unavailable Browser and E-Mail cell shows its reason as
 * small secondary text under "nicht verfügbar" — no tooltip to reach.
 */
const phoneUnavailableArgs = {
	...sessionsArgs,
	emailUnavailableReason: EMAILS_OFF_REASON,
	browserUnavailableReason: BROWSER_OFF_REASON
};
export const PhoneUnavailableReasons: Story = {
	globals: phone390Globals,
	args: phoneUnavailableArgs,
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const row = await dialog.findByRole('row', { name: /Mail-Beratung/ });
		const browser = within(row).getByText(BROWSER_OFF_REASON);
		const email = within(row).getByText(EMAILS_OFF_REASON);
		// After the sheet's slide-in.
		await waitFor(() => expect(browser).toBeVisible());
		await expect(email).toBeVisible();
		// Readable size, not clipped to a sliver.
		await expect(email.getBoundingClientRect().height).toBeGreaterThan(10);
		await expect(email.getBoundingClientRect().width).toBeGreaterThan(80);
	}
};
