import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { FilterChipRow } from './FilterChipRow';
import { FilterChip } from './FilterChip';
import { DisplayFilterButton } from './DisplayFilterButton';
import { TIMELINE_KINDS } from './displayFilterStoryData';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { phone390Globals } from '../message/messageStoryShell';
import '../sessionsList/sessionsList.styles.scss';

/**
 * The chip row under the list search field, extracted from the inline JSX of
 * `SessionsListToolbar` / `NotificationsCenter` (#1377 slice 1). Chips are
 * icon-only pills that expand with their label when active; the trailing slot
 * is pinned right and the chips scroll under it.
 */
const meta = {
	title: 'Molecules/FilterChipRow',
	component: FilterChipRow,
	tags: ['autodocs'],
	parameters: {
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'Scrolling chip group of the list toolbars with a pinned trailing slot for the display-filter button (#1377, spec §3). Uses the shared `sessionsListToolbar__chip*` rules so it renders identically to today’s toolbars.'
			}
		}
	}
} satisfies Meta<typeof FilterChipRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({
	trailing,
	initialActive = null,
	kinds = TIMELINE_KINDS.slice(0, 5)
}: {
	trailing?: React.ReactNode;
	initialActive?: string | null;
	kinds?: typeof TIMELINE_KINDS;
}) => {
	const [active, setActive] = useState<string | null>(initialActive);
	return (
		<div
			className="sessionsListToolbar"
			style={{ maxWidth: 420, padding: 16 }}
		>
			<FilterChipRow label="Filter" trailing={trailing}>
				{kinds.map((kind) => (
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
		</div>
	);
};

/** Rest state: every chip icon-only, badges for kinds with unread items. */
export const Default: Story = {
	args: { label: 'Filter', children: null },
	render: () => <Row />
};

/** One active chip expands with its label; clicking it again clears it. */
export const WithActiveChip: Story = {
	args: Default.args,
	render: () => <Row initialActive="messages" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const active = canvas.getByRole('button', { name: 'Nachrichten' });
		await expect(active).toHaveAttribute('aria-pressed', 'true');
		await userEvent.click(active);
		await expect(active).toHaveAttribute('aria-pressed', 'false');
	}
};

/** With the display-filter button pinned at the right end. */
export const WithDisplayFilterButton: Story = {
	args: Default.args,
	render: () => (
		<Row
			trailing={
				<DisplayFilterButton
					label="Anzeige-Filter"
					customised
					open={false}
					onClick={() => undefined}
				/>
			}
		/>
	)
};

/** Many chips overflow horizontally; the trailing button stays put. */
export const OverflowOnPhone: Story = {
	args: Default.args,
	globals: phone390Globals,
	render: () => (
		<Row
			kinds={TIMELINE_KINDS}
			trailing={
				<DisplayFilterButton
					label="Anzeige-Filter"
					customised={false}
					open={false}
					onClick={() => undefined}
				/>
			}
		/>
	)
};
