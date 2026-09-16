import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DisplayFilterDialog } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	setKindSetting
} from './displayFilterTypes';
import { STORY_LABELS, TIMELINE_KINDS } from './displayFilterStoryData';
import { ORISO_M3_FIGMA_URL } from '../storybookDesignLinks';
import {
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
		const draftsPill = dialog.getByRole('checkbox', {
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
		const pillCalls = dialog.getByRole('checkbox', {
			name: 'Pille: Anrufe'
		});
		await expect(pillCalls).toBeEnabled();
		await userEvent.click(showCalls);
		await expect(showCalls).not.toBeChecked();
		await expect(pillCalls).toBeDisabled();
		await expect(pillCalls).not.toBeChecked();
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
			labels={{ ...STORY_LABELS, title: 'Anzeige-Filter · Gespräche' }}
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
		const live = canvas.getByRole('checkbox', {
			name: 'Ton: Live-Chat'
		}) as HTMLInputElement;
		await expect(live.checked).toBe(false);
	}
};
