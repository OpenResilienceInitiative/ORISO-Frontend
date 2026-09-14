import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { FilterChipRow } from './FilterChipRow';
import { FilterChip } from './FilterChip';
import { DisplayFilterButton } from './DisplayFilterButton';
import { DisplayFilterDialog } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	isDisplayFilterCustomised,
	reconcileActiveKind,
	visiblePillKinds
} from './displayFilterTypes';
import { STORY_LABELS, TIMELINE_KINDS } from './displayFilterStoryData';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { phone390Globals } from '../message/messageStoryShell';
import '../sessionsList/sessionsList.styles.scss';

/**
 * The finished UX of #1377 slice 1 in one place: search field, user-gated
 * chip row and the display-filter button that opens the dialog. State lives
 * in the story; in the app it comes from the slice-2 store.
 */
const Toolbar = ({
	initialValue = null,
	fullScreen = false
}: {
	/** The section override; `null` = none (profile defaults apply). */
	initialValue?: DisplayFilterValue | null;
	fullScreen?: boolean;
}) => {
	const [query, setQuery] = useState('');
	// Store contract (spec §4/§7): the override is a key that exists or not.
	const [override, setOverride] = useState<DisplayFilterValue | null>(
		initialValue
	);
	const value = override ?? EMPTY_DISPLAY_FILTER;
	const [active, setActive] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const pills = visiblePillKinds(value, TIMELINE_KINDS, active);
	// The options (not just ids) so profile-owned partial hiding counts too.
	const customised = isDisplayFilterCustomised(value, TIMELINE_KINDS);

	return (
		<div
			className="sessionsListToolbar"
			style={{ maxWidth: 440, padding: 16, display: 'grid', gap: 12 }}
		>
			<ListSearchField
				value={query}
				onChange={setQuery}
				placeholder="Aktivität durchsuchen…"
				clearLabel="Suche zurücksetzen"
			/>
			<FilterChipRow
				label="Zeitstrahl filtern"
				trailing={
					<DisplayFilterButton
						label="Anzeige-Filter"
						customised={customised}
						customisedLabel="Filter angepasst"
						open={open}
						controlsId="display-filter-dialog"
						onClick={() => setOpen(true)}
					/>
				}
			>
				{pills.map((kind) => (
					<FilterChip
						key={kind.id}
						label={kind.label}
						icon={kind.icon!}
						assetIcon
						count={kind.unreadCount}
						active={active === kind.id}
						onClick={() =>
							setActive((current) =>
								current === kind.id ? null : kind.id
							)
						}
						data-cy={`chip-${kind.id}`}
					/>
				))}
			</FilterChipRow>
			<DisplayFilterDialog
				id="display-filter-dialog"
				fullScreen={fullScreen}
				open={open}
				onClose={() => setOpen(false)}
				kinds={TIMELINE_KINDS}
				value={value}
				canReset={override !== null}
				onChange={(next) => {
					setOverride(next);
					setActive((current) => reconcileActiveKind(next, current));
				}}
				onReset={() => {
					// Same reconciliation as onChange: the reset can drop the
					// pill of the active kind (override on, profile default off).
					setOverride(null);
					setActive((current) =>
						reconcileActiveKind(EMPTY_DISPLAY_FILTER, current)
					);
				}}
				onOpenProfile={() => undefined}
				labels={STORY_LABELS}
			/>
		</div>
	);
};

const meta = {
	title: 'Organisms/DisplayFilterToolbar',
	component: Toolbar,
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Composition of the slice-1 pieces: chips render only for kinds with pill enabled and unread items (spec §5.1); the button opens the dialog; unticking a pill removes its chip immediately.'
			}
		}
	}
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: pills for Anfragen (2), Nachrichten (5), Entwürfe (1), System (12). */
export const Default: Story = {};

/** Open the dialog, switch off the System pill → the chip is gone; the dot appears. */
export const TogglePillRemovesChip: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		await expect(
			canvas.getByRole('button', { name: 'System (12)' })
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anzeige-Filter' })
		);
		await userEvent.click(
			body.getByRole('checkbox', { name: 'Pille: System' })
		);
		await userEvent.click(body.getByRole('button', { name: 'Fertig' }));
		// MUI keeps the canvas `aria-hidden` until the dialog has faded out.
		await waitFor(() =>
			expect(body.queryByRole('dialog')).not.toBeInTheDocument()
		);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Anzeige-Filter' })
			).toBeVisible()
		);
		await expect(
			canvas.queryByRole('button', { name: 'System (12)' })
		).not.toBeInTheDocument();
		await expect(
			canvas
				.getByRole('button', { name: 'Anzeige-Filter' })
				.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	}
};

/** Trigger and dialog are linked: `aria-controls` points at a real element. */
export const TriggerControlsDialog: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		const trigger = canvas.getByRole('button', { name: 'Anzeige-Filter' });
		await userEvent.click(trigger);
		const controls = trigger.getAttribute('aria-controls');
		await expect(controls).toBe('display-filter-dialog');
		await expect(
			canvasElement.ownerDocument.getElementById(controls as string)
		).not.toBeNull();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		await userEvent.click(body.getByRole('button', { name: 'Fertig' }));
	}
};

/** Switching off the pill of the ACTIVE kind also clears the selection (no orphaned filter). */
export const PillOffClearsActiveKind: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const body = within(canvasElement.ownerDocument.body);
		const messages = canvas.getByRole('button', {
			name: 'Nachrichten (5)'
		});
		await userEvent.click(messages);
		await expect(messages).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anzeige-Filter' })
		);
		await userEvent.click(
			body.getByRole('checkbox', { name: 'Pille: Nachrichten' })
		);
		await userEvent.click(body.getByRole('button', { name: 'Fertig' }));
		await waitFor(() =>
			expect(body.queryByRole('dialog')).not.toBeInTheDocument()
		);
		await expect(
			canvas.queryByRole('button', { name: 'Nachrichten (5)' })
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole('button', { pressed: true })
		).not.toBeInTheDocument();
	}
};

export const Phone: Story = {
	globals: phone390Globals,
	args: { fullScreen: true }
};
