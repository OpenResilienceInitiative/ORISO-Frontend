import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { DisplayFilterDialog } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	isDisplayFilterCustomised,
	setKindSetting
} from './displayFilterTypes';
import { STORY_LABELS, TIMELINE_KINDS } from './displayFilterStoryData';
import { ORISO_M3_FIGMA_URL } from '../storybookDesignLinks';
import { phone390Globals } from '../message/messageStoryShell';

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
					'Per-section display filter. "Anzeigen" decides whether a kind appears in the list at all; "Pille" whether it gets a chip while it has unread items. "Sonstiges" is the catch-all and can never be hidden. Presentational — the store (slice 2) owns the value.'
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
	const [value, setValue] = useState<DisplayFilterValue>(
		args.initialValue ?? args.value
	);
	const kindIds = args.kinds.map((kind) => kind.id);
	return (
		<DisplayFilterDialog
			{...args}
			value={value}
			customised={isDisplayFilterCustomised(value, kindIds)}
			onChange={setValue}
			onReset={() => setValue(EMPTY_DISPLAY_FILTER)}
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
			dialog.getByRole('checkbox', { name: 'Anzeigen: Sonstiges' })
		).toBeDisabled();
		await expect(
			dialog.getByRole('button', {
				name: 'Auf meine Standards zurücksetzen'
			})
		).toBeEnabled();
	}
};

/** Unticking "Anzeigen" greys out the pill switch of that kind at once. */
export const HideAKind: Story = {
	render: (args) => <Controlled {...args} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		const showCalls = dialog.getByRole('checkbox', {
			name: 'Anzeigen: Anrufe'
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

export const Phone: Story = {
	globals: phone390Globals,
	render: (args) => <Controlled {...args} initialValue={CUSTOMISED} />
};
