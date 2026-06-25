import * as React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { SESSION_LIST_TAB_ARCHIVE } from '../session/sessionHelpers';
import {
	ArchiveFilterIcon,
	CreateChatFilterIcon,
	DraftFilterIcon,
	GroupFilterIcon,
	InternalGroupFilterIcon,
	LiveChatFilterIcon,
	NearbyFilterIcon,
	SessionToolbarFilterIconProps,
	SupervisionFilterIcon,
	UnreadFilterIcon
} from './SessionToolbarFilterIcons';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';

export type { SessionToolbarChipFilter } from './sessionToolbarFilters';

interface SessionsListToolbarProps {
	translate: (key: string) => string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPeopleResults?: SessionSearchPersonResult[];
	selectedPersonIds?: string[];
	onSelectedPersonIdsChange?: (ids: string[]) => void;
	activeChip: SessionToolbarChipFilter | null;
	onChipToggle: (chip: SessionToolbarChipFilter) => void;
	showConsultantActions: boolean;
	showSupervisionChip: boolean;
	/** Show the "Live-Chat" filter chip (tied to the sidebar availability toggle). */
	showLiveChatChip?: boolean;
	/** Show create/archive route chips. This is intentionally limited to Gespräch. */
	createGroupChatPath: string;
	archiveTabPath: string;
	/** Consultant list is showing archived sessions (`?sessionListTab=archive`). */
	archiveTabActive: boolean;
	/** Create-group-chat route is open. */
	createGroupChatActive: boolean;
	chipCounts?: Partial<Record<SessionToolbarChipFilter, number>>;
}

export interface SessionSearchPersonResult {
	id: string;
	name: string;
	subtitle: string;
}

const IconMenuDots = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className="sessionsListToolbar__iconSvg"
	>
		<path
			d="M12 8C11.45 8 10.9792 7.80417 10.5875 7.4125C10.1958 7.02083 10 6.55 10 6C10 5.45 10.1958 4.97917 10.5875 4.5875C10.9792 4.19583 11.45 4 12 4C12.55 4 13.0208 4.19583 13.4125 4.5875C13.8042 4.97917 14 5.45 14 6C14 6.55 13.8042 7.02083 13.4125 7.4125C13.0208 7.80417 12.55 8 12 8ZM12 14C11.45 14 10.9792 13.8042 10.5875 13.4125C10.1958 13.0208 10 12.55 10 12C10 11.45 10.1958 10.9792 10.5875 10.5875C10.9792 10.1958 11.45 10 12 10C12.55 10 13.0208 10.1958 13.4125 10.5875C13.8042 10.9792 14 11.45 14 12C14 12.55 13.8042 13.0208 13.4125 13.4125C13.0208 13.8042 12.55 14 12 14ZM12 20C11.45 20 10.9792 19.8042 10.5875 19.4125C10.1958 19.0208 10 18.55 10 18C10 17.45 10.1958 16.9792 10.5875 16.5875C10.9792 16.1958 11.45 16 12 16C12.55 16 13.0208 16.1958 13.4125 16.5875C13.8042 16.9792 14 17.45 14 18C14 18.55 13.8042 19.0208 13.4125 19.4125C13.0208 19.8042 12.55 20 12 20Z"
			fill="#444748"
		/>
	</svg>
);

const IconSearch = () => (
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className="sessionsListToolbar__iconSvg"
	>
		<path
			d="M19.6 21L13.3 14.7C12.8 15.1 12.225 15.4167 11.575 15.65C10.925 15.8833 10.2333 16 9.5 16C7.68333 16 6.14583 15.3708 4.8875 14.1125C3.62917 12.8542 3 11.3167 3 9.5C3 7.68333 3.62917 6.14583 4.8875 4.8875C6.14583 3.62917 7.68333 3 9.5 3C11.3167 3 12.8542 3.62917 14.1125 4.8875C15.3708 6.14583 16 7.68333 16 9.5C16 10.2333 15.8833 10.925 15.65 11.575C15.4167 12.225 15.1 12.8 14.7 13.3L21 19.6L19.6 21ZM9.5 14C10.75 14 11.8125 13.5625 12.6875 12.6875C13.5625 11.8125 14 10.75 14 9.5C14 8.25 13.5625 7.1875 12.6875 6.3125C11.8125 5.4375 10.75 5 9.5 5C8.25 5 7.1875 5.4375 6.3125 6.3125C5.4375 7.1875 5 8.25 5 9.5C5 10.75 5.4375 11.8125 6.3125 12.6875C7.1875 13.5625 8.25 14 9.5 14Z"
			fill="#444748"
		/>
	</svg>
);

const IconClose = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
			fill="#444748"
		/>
	</svg>
);

const IconPeople = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M5.85 17.1C6.7 16.45 7.65 15.9375 8.7 15.5625C9.75 15.1875 10.85 15 12 15C13.15 15 14.25 15.1875 15.3 15.5625C16.35 15.9375 17.3 16.45 18.15 17.1C18.7333 16.4167 19.1875 15.6417 19.5125 14.775C19.8375 13.9083 20 12.9833 20 12C20 9.78333 19.2208 7.89583 17.6625 6.3375C16.1042 4.77917 14.2167 4 12 4C9.78333 4 7.89583 4.77917 6.3375 6.3375C4.77917 7.89583 4 9.78333 4 12C4 12.9833 4.1625 13.9083 4.4875 14.775C4.8125 15.6417 5.26667 16.4167 5.85 17.1ZM12 13C11.0167 13 10.1875 12.6625 9.5125 11.9875C8.8375 11.3125 8.5 10.4833 8.5 9.5C8.5 8.51667 8.8375 7.6875 9.5125 7.0125C10.1875 6.3375 11.0167 6 12 6C12.9833 6 13.8125 6.3375 14.4875 7.0125C15.1625 7.6875 15.5 8.51667 15.5 9.5C15.5 10.4833 15.1625 11.3125 14.4875 11.9875C13.8125 12.6625 12.9833 13 12 13ZM12 22C10.6167 22 9.31667 21.7375 8.1 21.2125C6.88333 20.6875 5.825 19.975 4.925 19.075C4.025 18.175 3.3125 17.1167 2.7875 15.9C2.2625 14.6833 2 13.3833 2 12C2 10.6167 2.2625 9.31667 2.7875 8.1C3.3125 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.3125 8.1 2.7875C9.31667 2.2625 10.6167 2 12 2C13.3833 2 14.6833 2.2625 15.9 2.7875C17.1167 3.3125 18.175 4.025 19.075 4.925C19.975 5.825 20.6875 6.88333 21.2125 8.1C21.7375 9.31667 22 10.6167 22 12C22 13.3833 21.7375 14.6833 21.2125 15.9C20.6875 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6875 15.9 21.2125C14.6833 21.7375 13.3833 22 12 22Z"
			fill={active ? '#A5000A' : '#444748'}
		/>
	</svg>
);

const IconType = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M6 14H18V12H6V14ZM6 11H18V9H6V11ZM6 8H18V6H6V8ZM22 22L18 18H4C3.45 18 2.97917 17.8042 2.5875 17.4125C2.19583 17.0208 2 16.55 2 16V4C2 3.45 2.19583 2.97917 2.5875 2.5875C2.97917 2.19583 3.45 2 4 2H20C20.55 2 21.0208 2.19583 21.4125 2.5875C21.8042 2.97917 22 3.45 22 4V22ZM4 16H18.85L20 17.125V4H4V16Z"
			fill={active ? '#A5000A' : '#444748'}
		/>
	</svg>
);

const IconScheduled = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M12.0001 22C10.7501 22 9.57927 21.7625 8.4876 21.2875C7.39593 20.8125 6.44593 20.1708 5.6376 19.3625C4.82926 18.5541 4.1876 17.6041 3.7126 16.5125C3.2376 15.4208 3.0001 14.25 3.0001 13C3.0001 11.75 3.2376 10.5791 3.7126 9.48748C4.1876 8.39581 4.82926 7.44581 5.6376 6.63748C6.44593 5.82914 7.39593 5.18748 8.4876 4.71248C9.57927 4.23748 10.7501 3.99998 12.0001 3.99998C13.2501 3.99998 14.4209 4.23748 15.5126 4.71248C16.6043 5.18748 17.5543 5.82914 18.3626 6.63748C19.1709 7.44581 19.8126 8.39581 20.2876 9.48748C20.7626 10.5791 21.0001 11.75 21.0001 13C21.0001 14.25 20.7626 15.4208 20.2876 16.5125C19.8126 17.6041 19.1709 18.5541 18.3626 19.3625C17.5543 20.1708 16.6043 20.8125 15.5126 21.2875C14.4209 21.7625 13.2501 22 12.0001 22ZM14.8001 17.2L16.2001 15.8L13.0001 12.6V7.99998H11.0001V13.4L14.8001 17.2ZM5.6001 2.34998L7.0001 3.74998L2.7501 7.99998L1.3501 6.59998L5.6001 2.34998ZM18.4001 2.34998L22.6501 6.59998L21.2501 7.99998L17.0001 3.74998L18.4001 2.34998ZM12.0001 20C13.9501 20 15.6043 19.3208 16.9626 17.9625C18.3209 16.6041 19.0001 14.95 19.0001 13C19.0001 11.05 18.3209 9.39581 16.9626 8.03748C15.6043 6.67914 13.9501 5.99998 12.0001 5.99998C10.0501 5.99998 8.39593 6.67914 7.0376 8.03748C5.67926 9.39581 5.0001 11.05 5.0001 13C5.0001 14.95 5.67926 16.6041 7.0376 17.9625C8.39593 19.3208 10.0501 20 12.0001 20Z"
			fill={active ? '#A5000A' : '#444748'}
		/>
	</svg>
);

const IconPinned = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M5 21V5C5 4.45 5.19583 3.97917 5.5875 3.5875C5.97917 3.19583 6.45 3 7 3H17C17.55 3 18.0208 3.19583 18.4125 3.5875C18.8042 3.97917 19 4.45 19 5V21L12 18L5 21ZM7 17.95L12 15.8L17 17.95V5H7V17.95Z"
			fill={active ? '#A5000A' : '#444748'}
		/>
	</svg>
);

const IconArchivedTab = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M12 18L16 14L14.6 12.6L13 14.2V10H11V14.2L9.4 12.6L8 14L12 18ZM5 8V19H19V8H5ZM5 21C4.45 21 3.975 20.8083 3.575 20.425C3.19167 20.025 3 19.55 3 19V6.525C3 6.29167 3.03333 6.06667 3.1 5.85C3.18333 5.63333 3.3 5.43333 3.45 5.25L4.7 3.725C4.88333 3.49167 5.10833 3.31667 5.375 3.2C5.65833 3.06667 5.95 3 6.25 3H17.75C18.05 3 18.3333 3.06667 18.6 3.2C18.8833 3.31667 19.1167 3.49167 19.3 3.725L20.55 5.25C20.7 5.43333 20.8083 5.63333 20.875 5.85C20.9583 6.06667 21 6.29167 21 6.525V19C21 19.55 20.8 20.025 20.4 20.425C20.0167 20.8083 19.55 21 19 21H5ZM5.4 6H18.6L17.75 5H6.25L5.4 6Z"
			fill={active ? '#A5000A' : '#444748'}
		/>
	</svg>
);

type FilterChipConfig = {
	id: SessionToolbarChipFilter;
	labelKey: string;
	fallback: string;
	Icon: React.ComponentType<SessionToolbarFilterIconProps>;
	dataCy: string;
};

const FILTER_CHIPS: FilterChipConfig[] = [
	{
		id: 'unread',
		labelKey: 'sessionList.toolbar.chips.unread',
		fallback: 'Unread',
		Icon: UnreadFilterIcon,
		dataCy: 'sessions-list-chip-unread'
	},
	{
		id: 'drafts',
		labelKey: 'sessionList.toolbar.chips.drafts',
		fallback: 'Drafts',
		Icon: DraftFilterIcon,
		dataCy: 'sessions-list-chip-drafts'
	},
	{
		id: 'nearby',
		labelKey: 'sessionList.toolbar.chips.nearby',
		fallback: 'Nearby',
		Icon: NearbyFilterIcon,
		dataCy: 'sessions-list-chip-nearby'
	},
	{
		id: 'liveChat',
		labelKey: 'sessionList.toolbar.chips.liveChat',
		fallback: 'Live Chat',
		Icon: LiveChatFilterIcon,
		dataCy: 'sessions-list-chip-live-chat'
	},
	{
		id: 'internalGroup',
		labelKey: 'sessionList.toolbar.chips.internalGroup',
		fallback: 'Internal group chat',
		Icon: InternalGroupFilterIcon,
		dataCy: 'sessions-list-chip-internal-group'
	},
	{
		id: 'supervision',
		labelKey: 'sessionList.toolbar.chips.supervision',
		fallback: 'Supervision',
		Icon: SupervisionFilterIcon,
		dataCy: 'sessions-list-chip-supervision'
	},
	{
		id: 'groups',
		labelKey: 'sessionList.toolbar.chips.groups',
		fallback: 'Conversation circle',
		Icon: GroupFilterIcon,
		dataCy: 'sessions-list-chip-groups'
	}
];

const CountBadge = ({ count }: { count?: number }) => {
	if (!count || count <= 0) {
		return null;
	}

	return (
		<span className="sessionsListToolbar__chipBadge">
			{count > 99 ? '99+' : count}
		</span>
	);
};

const FilterChip = ({
	chip,
	active,
	count,
	label,
	onClick
}: {
	chip: FilterChipConfig;
	active: boolean;
	count?: number;
	label: string;
	onClick: () => void;
}) => {
	const Icon = chip.Icon;

	return (
		<button
			type="button"
			className={clsx('sessionsListToolbar__chip', {
				'sessionsListToolbar__chip--active': active,
				'sessionsListToolbar__chip--iconOnly': !active
			})}
			onClick={onClick}
			aria-pressed={active}
			aria-label={label}
			data-cy={chip.dataCy}
		>
			<Icon
				className="sessionsListToolbar__chipIconSvg"
				hasIndicator={
					chip.id === 'unread' && Boolean(count && count > 0)
				}
			/>
			<span
				className="sessionsListToolbar__chipLabel"
				aria-hidden={!active}
			>
				{label}
			</span>
			<CountBadge count={count} />
		</button>
	);
};

export const SessionsListToolbar = ({
	translate,
	searchValue,
	onSearchChange,
	searchPeopleResults = [],
	selectedPersonIds = [],
	onSelectedPersonIdsChange,
	activeChip,
	onChipToggle,
	showConsultantActions,
	showSupervisionChip,
	showLiveChatChip = false,
	createGroupChatPath,
	archiveTabPath,
	archiveTabActive,
	createGroupChatActive,
	chipCounts = {}
}: SessionsListToolbarProps) => {
	const searchId = React.useId();
	const searchRootRef = React.useRef<HTMLDivElement | null>(null);
	const searchInputRef = React.useRef<HTMLInputElement | null>(null);
	const [isSearchViewOpen, setIsSearchViewOpen] = React.useState(false);
	const [searchTab, setSearchTab] = React.useState<
		'people' | 'type' | 'scheduled' | 'pinned' | 'archived'
	>('people');
	const setSelectedPersonIds = React.useCallback(
		(updater: string[] | ((prev: string[]) => string[])) => {
			if (!onSelectedPersonIdsChange) {
				return;
			}
			if (typeof updater === 'function') {
				onSelectedPersonIdsChange(updater(selectedPersonIds));
				return;
			}
			onSelectedPersonIdsChange(updater);
		},
		[onSelectedPersonIdsChange, selectedPersonIds]
	);

	const filteredPeople = React.useMemo(() => {
		const needle = searchValue.trim().toLowerCase();
		if (selectedPersonIds.length > 0 && !needle) {
			return searchPeopleResults.filter((entry) =>
				selectedPersonIds.includes(entry.id)
			);
		}
		if (!needle) {
			return searchPeopleResults.slice(0, 8);
		}
		return searchPeopleResults.filter((entry) =>
			`${entry.name} ${entry.subtitle}`.toLowerCase().includes(needle)
		);
	}, [searchPeopleResults, searchValue, selectedPersonIds]);
	const tr = React.useCallback(
		(key: string, fallback: string) => {
			const translated = translate(key);
			return translated && translated !== key ? translated : fallback;
		},
		[translate]
	);
	const selectedPeople = React.useMemo(
		() =>
			selectedPersonIds
				.map((id) =>
					searchPeopleResults.find((entry) => entry.id === id)
				)
				.filter(
					(entry): entry is SessionSearchPersonResult =>
						entry !== undefined
				),
		[selectedPersonIds, searchPeopleResults]
	);

	const hasTypedQuery = searchValue.trim().length > 0;
	const hasSelectedPeople = selectedPersonIds.length > 0;
	const showSearchDropdown = isSearchViewOpen;
	const reopenSearchIfActive = React.useCallback(() => {
		setIsSearchViewOpen(true);
	}, []);

	React.useEffect(() => {
		const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
			if (!searchRootRef.current) {
				return;
			}
			const target = event.target as Node | null;
			if (target && !searchRootRef.current.contains(target)) {
				setIsSearchViewOpen(false);
			}
		};

		document.addEventListener('mousedown', handleOutsidePointer);
		document.addEventListener('touchstart', handleOutsidePointer);

		return () => {
			document.removeEventListener('mousedown', handleOutsidePointer);
			document.removeEventListener('touchstart', handleOutsidePointer);
		};
	}, []);

	const visibleFilterChips = React.useMemo(
		() =>
			FILTER_CHIPS.filter((chip) => {
				if (chip.id === 'liveChat') {
					return showLiveChatChip;
				}
				if (chip.id === 'supervision') {
					return showSupervisionChip;
				}
				return true;
			}),
		[showLiveChatChip, showSupervisionChip]
	);
	const archiveInsertIndex = Math.max(
		visibleFilterChips.findIndex((chip) => chip.id === 'internalGroup'),
		0
	);
	const filterChipsBeforeArchive = showConsultantActions
		? visibleFilterChips.slice(0, archiveInsertIndex)
		: visibleFilterChips;
	const filterChipsAfterArchive = showConsultantActions
		? visibleFilterChips.slice(archiveInsertIndex)
		: [];
	const renderFilterChip = (chip: FilterChipConfig) => (
		<FilterChip
			key={chip.id}
			chip={chip}
			active={activeChip === chip.id}
			count={chipCounts[chip.id]}
			label={tr(chip.labelKey, chip.fallback)}
			onClick={() => onChipToggle(chip.id)}
		/>
	);

	return (
		<div className="sessionsListToolbar" data-cy="sessions-list-toolbar">
			<div className="sessionsListToolbar__search" ref={searchRootRef}>
				<div
					className={clsx('sessionsListToolbar__searchInner', {
						'sessionsListToolbar__searchInner--attached':
							showSearchDropdown
					})}
				>
					<button
						type="button"
						className="sessionsListToolbar__iconButton"
						aria-label={tr(
							'sessionList.toolbar.search.toggle',
							'Open or close search results'
						)}
						onClick={() => setIsSearchViewOpen((prev) => !prev)}
					>
						<IconMenuDots />
					</button>
					<div className="sessionsListToolbar__searchFieldWrap">
						{selectedPeople.length > 0 && (
							<div className="sessionsListToolbar__searchInlinePills">
								{selectedPeople.map((person) => (
									<button
										type="button"
										key={`inline-pill-${person.id}`}
										className="sessionsListToolbar__searchInlinePill"
										onClick={() => {
											setSelectedPersonIds((prev) =>
												prev.filter(
													(id) => id !== person.id
												)
											);
											requestAnimationFrame(() =>
												searchInputRef.current?.focus()
											);
										}}
										aria-label={tr(
											'sessionList.toolbar.search.removeSelectedPerson',
											`Remove ${person.name}`
										)}
									>
										<span className="sessionsListToolbar__searchInlinePillText">
											{person.name}
										</span>
										<span
											className="sessionsListToolbar__searchInlinePillRemove"
											aria-hidden
										>
											×
										</span>
									</button>
								))}
							</div>
						)}
						<label htmlFor={searchId} className="sr-only">
							{translate('sessionList.toolbar.search.label')}
						</label>
						<input
							id={searchId}
							type="search"
							className="sessionsListToolbar__searchInput"
							placeholder={translate(
								'sessionList.toolbar.search.placeholder'
							)}
							value={searchValue}
							onChange={(e) => onSearchChange(e.target.value)}
							onFocus={() => setIsSearchViewOpen(true)}
							onClick={reopenSearchIfActive}
							autoComplete="off"
							data-cy="sessions-list-search"
							ref={searchInputRef}
						/>
					</div>
					{hasTypedQuery || hasSelectedPeople ? (
						<button
							type="button"
							className="sessionsListToolbar__searchActionButton"
							onClick={() => {
								onSearchChange('');
								setSelectedPersonIds([]);
								setIsSearchViewOpen(false);
							}}
							aria-label={tr(
								'sessionList.toolbar.search.clear',
								'Clear search'
							)}
						>
							<IconClose />
						</button>
					) : (
						<div
							className="sessionsListToolbar__searchIconWrap"
							aria-hidden
						>
							<IconSearch />
						</div>
					)}
				</div>
				{showSearchDropdown && (
					<div className="sessionsListToolbar__searchModal">
						<div className="sessionsListToolbar__searchModalTabs">
							{[
								['people', 'People'],
								['type', 'Type'],
								['scheduled', 'Scheduled'],
								['pinned', 'Pinned'],
								['archived', 'Archived']
							].map(([id, label]) => {
								const isActive = searchTab === id;
								return (
									<button
										type="button"
										key={id}
										className={clsx(
											'sessionsListToolbar__searchModalTab',
											searchTab === id &&
												'sessionsListToolbar__searchModalTab--active'
										)}
										onClick={() =>
											setSearchTab(
												id as
													| 'people'
													| 'type'
													| 'scheduled'
													| 'pinned'
													| 'archived'
											)
										}
									>
										<span className="sessionsListToolbar__searchModalTabIcon">
											{id === 'people' && (
												<IconPeople active={isActive} />
											)}
											{id === 'type' && (
												<IconType active={isActive} />
											)}
											{id === 'scheduled' && (
												<span className="sessionsListToolbar__searchModalTabIconWithDot">
													<IconScheduled
														active={isActive}
													/>
													<span className="sessionsListToolbar__searchModalTabDot" />
												</span>
											)}
											{id === 'pinned' && (
												<IconPinned active={isActive} />
											)}
											{id === 'archived' && (
												<IconArchivedTab
													active={isActive}
												/>
											)}
										</span>
										<span className="sessionsListToolbar__searchModalTabLabel">
											{tr(
												`sessionList.toolbar.search.tabs.${id}`,
												label
											)}
										</span>
									</button>
								);
							})}
						</div>
						<div className="sessionsListToolbar__searchModalBody">
							{searchTab === 'people' ? (
								filteredPeople.length > 0 ? (
									filteredPeople.map((person) => {
										const isSelected =
											selectedPersonIds.includes(
												person.id
											);
										return (
											<button
												type="button"
												key={person.id}
												className="sessionsListToolbar__personRow"
												onClick={() => {
													setSelectedPersonIds(
														(prev) =>
															prev.includes(
																person.id
															)
																? prev.filter(
																		(id) =>
																			id !==
																			person.id
																	)
																: [
																		...prev,
																		person.id
																	]
													);
													onSearchChange('');
													setIsSearchViewOpen(true);
													requestAnimationFrame(() =>
														searchInputRef.current?.focus()
													);
												}}
											>
												<div className="sessionsListToolbar__personAvatar">
													{person.name
														.split(' ')
														.map((part) =>
															part
																.trim()
																.charAt(0)
														)
														.join('')
														.slice(0, 2)
														.toUpperCase() || 'U'}
												</div>
												<div className="sessionsListToolbar__personMeta">
													<div className="sessionsListToolbar__personName">
														{person.name}
													</div>
													<div className="sessionsListToolbar__personSubtitle">
														{person.subtitle}
													</div>
												</div>
												<div
													className={clsx(
														'sessionsListToolbar__personCheckbox',
														isSelected &&
															'sessionsListToolbar__personCheckbox--selected'
													)}
												/>
											</button>
										);
									})
								) : (
									<div className="sessionsListToolbar__searchEmpty">
										{tr(
											'sessionList.toolbar.search.emptyPeople',
											'No matching people found.'
										)}
									</div>
								)
							) : (
								<div className="sessionsListToolbar__searchEmpty">
									{tr(
										'sessionList.toolbar.search.emptyTab',
										'No results for this tab yet.'
									)}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			<div
				className="sessionsListToolbar__chipsScroll"
				data-cy="sessions-list-chips"
				style={{ display: showSearchDropdown ? 'none' : undefined }}
			>
				<div className="sessionsListToolbar__chipsRow">
					{showConsultantActions && (
						<Link
							className={clsx('sessionsListToolbar__chip', {
								'sessionsListToolbar__chip--iconOnly':
									!createGroupChatActive,
								'sessionsListToolbar__chip--active':
									createGroupChatActive
							})}
							to={createGroupChatPath}
							aria-label={translate(
								'sessionList.createChat.buttonTitle'
							)}
							aria-current={
								createGroupChatActive ? 'page' : undefined
							}
							data-cy="sessions-list-chip-create"
						>
							<CreateChatFilterIcon className="sessionsListToolbar__chipIconSvg" />
							<span
								className="sessionsListToolbar__chipLabel"
								aria-hidden={!createGroupChatActive}
							>
								{tr(
									'sessionList.toolbar.chips.create',
									'Create'
								)}
							</span>
						</Link>
					)}
					{filterChipsBeforeArchive.map(renderFilterChip)}
					{showConsultantActions && (
						<Link
							className={clsx(
								'sessionsListToolbar__chip',
								'walkthrough_step_4',
								{
									'sessionsListToolbar__chip--iconOnly':
										!archiveTabActive,
									'sessionsListToolbar__chip--active':
										archiveTabActive
								}
							)}
							to={archiveTabPath}
							aria-label={translate(
								'sessionList.view.archive.tab'
							)}
							aria-current={archiveTabActive ? 'page' : undefined}
							data-cy="sessions-list-chip-archive"
						>
							<ArchiveFilterIcon className="sessionsListToolbar__chipIconSvg" />
							<span
								className="sessionsListToolbar__chipLabel"
								aria-hidden={!archiveTabActive}
							>
								{tr(
									'sessionList.toolbar.chips.archive',
									'Archived'
								)}
							</span>
						</Link>
					)}
					{filterChipsAfterArchive.map(renderFilterChip)}
				</div>
			</div>
		</div>
	);
};

export const buildArchiveTabPath = () =>
	`/sessions/consultant/sessionView?sessionListTab=${SESSION_LIST_TAB_ARCHIVE}`;

export const buildCreateGroupChatPath = (sessionListTabQuery?: string) =>
	`/sessions/consultant/sessionView/createGroupChat${
		sessionListTabQuery
			? `?sessionListTab=${encodeURIComponent(sessionListTabQuery)}`
			: ''
	}`;
