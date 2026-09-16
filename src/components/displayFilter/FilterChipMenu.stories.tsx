import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { FilterChipMenu, FilterChipMenuLabels } from './FilterChipMenu';
import { DisplayFilterButton } from './DisplayFilterButton';
import { M3Snackbar } from '../m3Snackbar/M3Snackbar';
import {
	DisplayFilterKindOption,
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	OTHER_KIND_ID,
	setKindSetting
} from './displayFilterTypes';
import { SESSION_KIND_ICONS } from './kindOptions';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { phone390Globals } from '../message/messageStoryShell';
import '../sessionsList/sessionsList.styles.scss';

/** Gespräche kinds as the consultant sees them (Figma 1139:45736 order). */
const SESSION_KINDS: DisplayFilterKindOption[] = [
	{
		id: 'oneToOne',
		label: 'Mail',
		icon: SESSION_KIND_ICONS.oneToOne,
		unreadCount: 2
	},
	{
		id: 'liveChat',
		label: 'Live-Chat',
		icon: SESSION_KIND_ICONS.liveChat,
		unreadCount: 0
	},
	{
		id: 'internalGroup',
		label: 'Interner Gruppenchat',
		icon: SESSION_KIND_ICONS.internalGroup,
		unreadCount: 0
	},
	{
		id: 'circle',
		label: 'Gesprächskreis',
		icon: SESSION_KIND_ICONS.circle,
		unreadCount: 1
	},
	{
		id: 'supervision',
		label: 'Supervision',
		icon: SESSION_KIND_ICONS.supervision,
		unreadCount: 0
	},
	{
		id: OTHER_KIND_ID,
		label: 'Sonstiges',
		icon: SESSION_KIND_ICONS.other,
		unreadCount: 0
	}
];

const LABELS: FilterChipMenuLabels = {
	group: 'Gespräche filtern',
	deactivated: (chip) => `${chip} (vom Träger abgeschaltet)`
};

const Menu = ({
	kinds = SESSION_KINDS,
	initialValue = EMPTY_DISPLAY_FILTER,
	initialActive = null,
	onToggle,
	onDeactivatedClick
}: {
	kinds?: DisplayFilterKindOption[];
	initialValue?: DisplayFilterValue;
	initialActive?: string | null;
	onToggle?: (kindId: string) => void;
	onDeactivatedClick?: (kindId: string) => void;
}) => {
	const [active, setActive] = useState<string | null>(initialActive);
	const [notice, setNotice] = useState<string | null>(null);
	return (
		<div
			className="sessionsListToolbar"
			style={{ maxWidth: 520, padding: 16 }}
		>
			<FilterChipMenu
				kinds={kinds}
				value={initialValue}
				activeKindId={active}
				labels={LABELS}
				assetIcons
				onToggle={(kindId) => {
					onToggle?.(kindId);
					setActive((current) =>
						current === kindId ? null : kindId
					);
				}}
				onDeactivatedClick={(kindId) => {
					onDeactivatedClick?.(kindId);
					const kind = kinds.find((k) => k.id === kindId);
					setNotice(
						`${kind?.label} ist für Ihren Träger abgeschaltet. Bestehende Gespräche bleiben sichtbar, bis sie archiviert sind; neue können nicht angelegt werden.`
					);
				}}
				trailing={
					<DisplayFilterButton
						label="Anzeige-Filter"
						customised={false}
						customisedLabel="Filter angepasst"
						open={false}
						controlsId="display-filter-dialog"
						onClick={() => undefined}
					/>
				}
			/>
			<M3Snackbar
				open={notice !== null}
				message={notice}
				role="status"
				placement="inline"
				onClose={() => setNotice(null)}
				closeLabel="Schließen"
				autoHideDuration={null}
				testId="deactivated-notice"
			/>
		</div>
	);
};

const meta = {
	title: 'Organisms/FilterChipMenu',
	component: Menu,
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The chip menu of the list toolbars (#1377, Frank 2026-09-16). One chip per shown kind whose pill is on; unread items are a badge, not the reason the chip exists. The user picks icons vs. text and auto-sort in the display filter. Kinds the Träger switched off stay listed locked while rows exist.'
			}
		}
	}
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Icons, auto-sort on: Mail (2) and Gesprächskreis (1) lead the row. */
export const IconsAutoSorted: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chips = canvas
			.getAllByRole('button')
			.map((b) => b.getAttribute('aria-label'))
			.filter((name) => name !== 'Anzeige-Filter');
		await expect(chips).toEqual([
			'Mail (2)',
			'Gesprächskreis (1)',
			'Live-Chat',
			'Interner Gruppenchat',
			'Supervision',
			'Sonstiges'
		]);
	}
};

/** Click a chip: it expands with its label (Figma opened=unread row). */
export const ActiveChipExpands: Story = {
	args: { onToggle: fn() },
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		const mail = canvas.getByRole('button', { name: 'Mail (2)' });
		await userEvent.click(mail);
		await expect(args.onToggle).toHaveBeenCalledWith('oneToOne');
		await expect(mail).toHaveAttribute('aria-pressed', 'true');
		await expect(mail.className).toContain(
			'sessionsListToolbar__chip--active'
		);
	}
};

/** Section order kept: auto-sort off. */
export const IconsSectionOrder: Story = {
	args: { initialValue: { ...EMPTY_DISPLAY_FILTER, autoSort: false } },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chips = canvas
			.getAllByRole('button')
			.map((b) => b.getAttribute('aria-label'))
			.filter((name) => name !== 'Anzeige-Filter');
		await expect(chips[0]).toBe('Mail (2)');
		await expect(chips[1]).toBe('Live-Chat');
	}
};

/** Icons + labels on every pill (the second of Frank's three views). */
export const IconsWithLabels: Story = {
	args: {
		initialValue: { ...EMPTY_DISPLAY_FILTER, view: 'labels' },
		initialActive: 'oneToOne'
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const live = canvas.getByRole('button', { name: 'Live-Chat' });
		await expect(live.className).toContain(
			'sessionsListToolbar__chip--labelled'
		);
		await expect(
			live.querySelector('.sessionsListToolbar__chipLabel')
		).not.toHaveAttribute('aria-hidden', 'true');
	}
};

/** Compact text pills (Figma 9947:31377), active one filled. */
export const TextCompact: Story = {
	args: {
		initialValue: {
			...EMPTY_DISPLAY_FILTER,
			view: 'text',
			autoSort: false
		},
		initialActive: 'supervision'
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const active = canvas.getByRole('button', { name: 'Supervision' });
		await expect(active).toHaveAttribute('aria-pressed', 'true');
		await expect(active.className).toContain(
			'sessionsListToolbar__chip--text'
		);
		// Only the pinned tune button keeps an icon; the kind chips are text.
		await expect(
			canvasElement.querySelectorAll(
				'.sessionsListToolbar__chipsRow .sessionsListToolbar__chipIconSvg'
			).length
		).toBe(0);
	}
};

/** Pill switched off in the filter: the chip is gone, the rest stays. */
export const PillOffRemovesChip: Story = {
	args: {
		initialValue: setKindSetting(EMPTY_DISPLAY_FILTER, 'supervision', {
			pill: false
		})
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('button', { name: 'Supervision' })
		).toBeNull();
		await expect(
			canvas.getByRole('button', { name: 'Live-Chat' })
		).toBeTruthy();
	}
};

/** Träger switched Gesprächskreis off while a circle still exists: locked chip, click explains. */
export const DeactivatedByTraeger: Story = {
	args: {
		kinds: SESSION_KINDS.map((kind) =>
			kind.id === 'circle'
				? { ...kind, availability: 'deactivated' as const }
				: kind.id === 'internalGroup'
					? { ...kind, availability: 'absent' as const }
					: kind
		),
		onDeactivatedClick: fn(),
		onToggle: fn()
	},
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByRole('button', { name: 'Interner Gruppenchat' })
		).toBeNull();
		const locked = canvas.getByRole('button', {
			name: 'Gesprächskreis (1) (vom Träger abgeschaltet)'
		});
		await expect(locked).toHaveAttribute('aria-disabled', 'true');
		await userEvent.click(locked);
		await expect(args.onDeactivatedClick).toHaveBeenCalledWith('circle');
		await expect(args.onToggle).not.toHaveBeenCalled();
		await expect(
			canvas.getByText(/Gesprächskreis ist für Ihren Träger abgeschaltet/)
		).toBeTruthy();
	}
};

/** Phone width: chips scroll under the pinned filter button. */
export const Phone: Story = {
	globals: phone390Globals
};
