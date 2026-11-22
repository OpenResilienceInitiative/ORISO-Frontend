import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListSearchField } from './ListSearchField';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import { useTranslation } from 'react-i18next';
import { expect, within } from 'storybook/test';
import { DisplayFilterButton } from '../displayFilter/DisplayFilterButton';
import { SessionsListToolbar } from '../sessionsList/SessionsListToolbar';
import '../displayFilter/displayFilter.styles.scss';
import '../notificationsCenter/notificationsCenter.styles.scss';

const meta = {
	title: 'Molecules/ListSearchField',
	component: ListSearchField,
	tags: ['autodocs'],
	parameters: {
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Shared pill-shaped search field used on top of master lists (Activity Timeline, conversation list). Controlled component — filter semantics live with the caller; list filters (family chips, unread) compose on top of the query.'
			}
		}
	}
} satisfies Meta<typeof ListSearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

const ControlledField = (args: {
	placeholder: string;
	clearLabel: string;
	initialValue?: string;
}) => {
	const [value, setValue] = useState(args.initialValue ?? '');
	return (
		<div style={{ maxWidth: 400, padding: 16 }}>
			<ListSearchField
				value={value}
				onChange={setValue}
				placeholder={args.placeholder}
				clearLabel={args.clearLabel}
			/>
		</div>
	);
};

export const Empty: Story = {
	args: {
		value: '',
		onChange: () => {},
		placeholder: 'Aktivität durchsuchen…',
		clearLabel: 'Suche zurücksetzen'
	},
	render: (args) => <ControlledField {...args} />
};

export const WithQuery: Story = {
	args: Empty.args,
	render: (args) => <ControlledField {...args} initialValue="Entwurf" />
};

/* ---------------------------------------------------------------------------
 * #2226: the Activity search and the Conversations search side by side.
 * Both put the display-filter button in the same 48 px leading slot, so the
 * fields have the same height, padding and filter glyph.
 * ------------------------------------------------------------------------- */

const ActivitySearch = () => {
	const { t } = useTranslation();
	const [value, setValue] = useState('');
	const [open, setOpen] = useState(false);
	return (
		<div className="notificationsCenter">
			<div className="notificationsCenter__listColumn">
				<div className="sessionsListToolbar notificationsCenter__toolbar">
					<ListSearchField
						leading={
							<DisplayFilterButton
								label={t('notifications.displayFilter.button')}
								customisedLabel={t(
									'notifications.displayFilter.buttonCustomised'
								)}
								customised={false}
								open={open}
								controlsId="timeline-display-filter-dialog"
								onClick={() => setOpen(true)}
								compact
								data-cy="timeline-display-filter"
							/>
						}
						value={value}
						onChange={setValue}
						placeholder={t(
							'notifications.center.searchPlaceholder'
						)}
						clearLabel={t('sessionList.toolbar.search.clear')}
						menuLabel={t('sessionList.toolbar.search.toggle')}
					/>
				</div>
			</div>
		</div>
	);
};

const ConversationsSearch = () => {
	const { t } = useTranslation();
	const [value, setValue] = useState('');
	const [open, setOpen] = useState(false);
	return (
		<SessionsListToolbar
			translate={t}
			searchValue={value}
			onSearchChange={setValue}
			activeChip={null}
			onChipToggle={() => undefined}
			showConsultantActions={false}
			showCreateGroupChatAction={false}
			showSupervisionChip={false}
			createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
			archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
			archiveTabActive={false}
			createGroupChatActive={false}
			displayFilter={{
				label: t('notifications.displayFilter.button'),
				customisedLabel: t(
					'notifications.displayFilter.buttonCustomised'
				),
				customised: false,
				open,
				controlsId: 'sessions-display-filter-dialog',
				onOpen: () => setOpen(true)
			}}
		/>
	);
};

const SearchParityShell = () => (
	<div
		style={{
			display: 'grid',
			gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
			gap: 24,
			padding: 16,
			background: 'var(--m3-surface-container, #eae7e8)'
		}}
	>
		<section aria-label="Aktivität" data-cy="parity-activity">
			<ActivitySearch />
		</section>
		<section aria-label="Gespräche" data-cy="parity-conversations">
			<ConversationsSearch />
		</section>
	</div>
);

const box = (root: HTMLElement, selector: string) =>
	root.querySelector<HTMLElement>(selector)!.getBoundingClientRect();

const expectSameSearchField = async (canvasElement: HTMLElement) => {
	const activity = canvasElement.querySelector<HTMLElement>(
		'[data-cy="parity-activity"]'
	)!;
	const conversations = canvasElement.querySelector<HTMLElement>(
		'[data-cy="parity-conversations"]'
	)!;
	for (const selector of [
		'.sessionsListToolbar__searchInner',
		'.sessionsListToolbar__iconButton--filter',
		'.displayFilterButton',
		'.displayFilterButton svg',
		'.sessionsListToolbar__searchInput'
	]) {
		await expect(Math.round(box(activity, selector).height)).toBe(
			Math.round(box(conversations, selector).height)
		);
	}
	await expect(
		getComputedStyle(
			activity.querySelector('.sessionsListToolbar__searchInput')!
		).fontSize
	).toBe(
		getComputedStyle(
			conversations.querySelector('.sessionsListToolbar__searchInput')!
		).fontSize
	);
	// The filter button sits in the same slot in both lists.
	await expect(
		within(activity).getByRole('button', {
			name: /Ansicht einstellen|List settings/
		})
	).toBeInTheDocument();
};

export const SearchParityWithConversations: Story = {
	name: 'Search parity: Activity vs Conversations (#2226)',
	args: Empty.args,
	render: () => <SearchParityShell />,
	play: async ({ canvasElement }) => expectSameSearchField(canvasElement)
};

export const SearchParityWithConversationsPhone: Story = {
	name: 'Search parity at 390 px (#2226)',
	args: Empty.args,
	globals: { viewport: { value: 'phone390' } },
	render: () => <SearchParityShell />,
	play: async ({ canvasElement }) => expectSameSearchField(canvasElement)
};

export const SearchParityWithConversationsDarkEnglish: Story = {
	name: 'Search parity, dark, English (#2226)',
	args: Empty.args,
	globals: { scheme: 'dark', locale: 'en' },
	render: () => <SearchParityShell />,
	play: async ({ canvasElement }) => expectSameSearchField(canvasElement)
};
