import * as React from 'react';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ListSearchField } from '../listSearchField/ListSearchField';
import { FilterChipRow } from './FilterChipRow';
import { FilterChip } from './FilterChip';
import { DisplayFilterButton } from './DisplayFilterButton';
import { DisplayFilterDialog } from './DisplayFilterDialog';
import {
	DisplayFilterValue,
	EMPTY_DISPLAY_FILTER,
	isDisplayFilterCustomised,
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
const Toolbar = ({ initialValue = EMPTY_DISPLAY_FILTER }) => {
	const [query, setQuery] = useState('');
	const [value, setValue] = useState<DisplayFilterValue>(initialValue);
	const [active, setActive] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const kindIds = useMemo(() => TIMELINE_KINDS.map((kind) => kind.id), []);
	const pills = visiblePillKinds(value, TIMELINE_KINDS, active);
	const customised = isDisplayFilterCustomised(value, kindIds);

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
						assetIcon={kind.id !== 'other'}
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
				open={open}
				onClose={() => setOpen(false)}
				kinds={TIMELINE_KINDS}
				value={value}
				customised={customised}
				onChange={setValue}
				onReset={() => setValue(EMPTY_DISPLAY_FILTER)}
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
			canvas.getByRole('button', { name: 'System' })
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Anzeige-Filter' })
		);
		await userEvent.click(
			body.getByRole('checkbox', { name: 'Pille: System' })
		);
		await userEvent.click(body.getByRole('button', { name: 'Fertig' }));
		await expect(
			canvas.queryByRole('button', { name: 'System' })
		).not.toBeInTheDocument();
		await expect(
			canvas
				.getByRole('button', { name: 'Anzeige-Filter' })
				.querySelector('.displayFilterButton__dot')
		).not.toBeNull();
	}
};

export const Phone: Story = {
	globals: phone390Globals
};
