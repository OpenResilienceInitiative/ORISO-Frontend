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
	MailFilterIcon,
	SessionToolbarFilterIconProps,
	SupervisionFilterIcon,
	UnreadFilterIcon
} from './SessionToolbarFilterIcons';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';
import {
	SessionSearchPanel,
	SessionSearchTab,
	SessionSearchTopicOption,
	SessionSearchTypeOption
} from './SessionSearchPanel';

export type { SessionToolbarChipFilter } from './sessionToolbarFilters';
export type {
	SessionSearchTab,
	SessionSearchTopicOption,
	SessionSearchTypeOption
} from './SessionSearchPanel';

interface SessionsListToolbarProps {
	translate: (key: string, options?: Record<string, unknown>) => string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPeopleResults?: SessionSearchPersonResult[];
	selectedPersonIds?: string[];
	onSelectedPersonIdsChange?: (ids: string[]) => void;
	/** Topic options for the "Counselling centre" tab (radio single-select). */
	searchTopicResults?: SessionSearchTopicOption[];
	selectedTopicId?: string | null;
	onSelectedTopicIdChange?: (id: string | null) => void;
	/** Chat-type options for the "By type" tab (radio single-select). */
	searchTypeResults?: SessionSearchTypeOption[];
	selectedTypeId?: string | null;
	onSelectedTypeIdChange?: (id: string | null) => void;
	/** "Archive only" toggle in the search panel tab row. */
	searchArchiveOnly?: boolean;
	onSearchArchiveOnlyChange?: (archiveOnly: boolean) => void;
	/** Confirm the current search selection (checkmark button / Enter). */
	onSearchConfirm?: () => void;
	activeChip: SessionToolbarChipFilter | null;
	onChipToggle: (chip: SessionToolbarChipFilter) => void;
	showConsultantActions: boolean;
	showCreateGroupChatAction: boolean;
	showSupervisionChip: boolean;
	/** Show the "Live-Chat" filter chip (tied to the sidebar availability toggle). */
	showLiveChatChip?: boolean;
	/** Show group-session filters only when their tenant modules are enabled. */
	showGroupChip?: boolean;
	showInternalGroupChip?: boolean;
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

export const IconMenuDots = () => (
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

export const IconSearch = () => (
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

export const IconClose = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M6.4 19L5 17.6L10.6 12L5 6.4L6.4 5L12 10.6L17.6 5L19 6.4L13.4 12L19 17.6L17.6 19L12 13.4L6.4 19Z"
			fill="#444748"
		/>
	</svg>
);

export const IconCheck = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M9.55 18L3.85 12.3L5.275 10.875L9.55 15.15L18.725 5.975L20.15 7.4L9.55 18Z"
			fill="#ffffff"
		/>
	</svg>
);

type FilterChipConfig = {
	id: SessionToolbarChipFilter;
	labelKey: string;
	Icon: React.ComponentType<SessionToolbarFilterIconProps>;
	dataCy: string;
};

const FILTER_CHIPS: FilterChipConfig[] = [
	{
		id: 'unread',
		labelKey: 'sessionList.toolbar.chips.unread',
		Icon: UnreadFilterIcon,
		dataCy: 'sessions-list-chip-unread'
	},
	{
		id: 'drafts',
		labelKey: 'sessionList.toolbar.chips.drafts',
		Icon: DraftFilterIcon,
		dataCy: 'sessions-list-chip-drafts'
	},
	{
		id: 'nearby',
		labelKey: 'sessionList.toolbar.chips.nearby',
		Icon: MailFilterIcon,
		dataCy: 'sessions-list-chip-nearby'
	},
	{
		id: 'liveChat',
		labelKey: 'sessionList.toolbar.chips.liveChat',
		Icon: LiveChatFilterIcon,
		dataCy: 'sessions-list-chip-live-chat'
	},
	{
		id: 'internalGroup',
		labelKey: 'sessionList.toolbar.chips.internalGroup',
		Icon: InternalGroupFilterIcon,
		dataCy: 'sessions-list-chip-internal-group'
	},
	{
		id: 'supervision',
		labelKey: 'sessionList.toolbar.chips.supervision',
		Icon: SupervisionFilterIcon,
		dataCy: 'sessions-list-chip-supervision'
	},
	{
		id: 'groups',
		labelKey: 'sessionList.toolbar.chips.groups',
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
	searchTopicResults = [],
	selectedTopicId = null,
	onSelectedTopicIdChange,
	searchTypeResults = [],
	selectedTypeId = null,
	onSelectedTypeIdChange,
	searchArchiveOnly = false,
	onSearchArchiveOnlyChange,
	onSearchConfirm,
	activeChip,
	onChipToggle,
	showConsultantActions,
	showCreateGroupChatAction,
	showSupervisionChip,
	showLiveChatChip = false,
	showGroupChip = false,
	showInternalGroupChip = false,
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
	const [searchTab, setSearchTab] =
		React.useState<SessionSearchTab>('people');
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

	const filteredTopics = React.useMemo(() => {
		const needle = searchValue.trim().toLowerCase();
		if (!needle) {
			return searchTopicResults;
		}
		return searchTopicResults.filter((topic) =>
			`${topic.label} ${topic.subtitle || ''}`
				.toLowerCase()
				.includes(needle)
		);
	}, [searchTopicResults, searchValue]);

	const hasTypedQuery = searchValue.trim().length > 0;
	const hasSelectedPeople = selectedPersonIds.length > 0;
	const hasSearchSelection =
		hasSelectedPeople ||
		Boolean(selectedTopicId) ||
		Boolean(selectedTypeId) ||
		searchArchiveOnly;
	/** Figma Section 07: checkmark hidden while nothing was typed/selected. */
	const canConfirmSearch = hasTypedQuery || hasSearchSelection;
	const confirmSearch = React.useCallback(() => {
		if (!canConfirmSearch) {
			return;
		}
		onSearchConfirm?.();
		setIsSearchViewOpen(false);
	}, [canConfirmSearch, onSearchConfirm]);
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
				if (chip.id === 'groups') {
					return showGroupChip;
				}
				if (chip.id === 'internalGroup') {
					return showInternalGroupChip;
				}
				return true;
			}),
		[
			showGroupChip,
			showInternalGroupChip,
			showLiveChatChip,
			showSupervisionChip
		]
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
			label={translate(chip.labelKey)}
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
						aria-label={
							showSearchDropdown
								? translate('sessionList.toolbar.search.close')
								: translate('sessionList.toolbar.search.toggle')
						}
						onClick={() => setIsSearchViewOpen((prev) => !prev)}
					>
						{showSearchDropdown ? <IconClose /> : <IconMenuDots />}
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
										aria-label={translate(
											'sessionList.toolbar.search.removeSelectedPerson',
											{ name: person.name }
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
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									confirmSearch();
								}
							}}
							autoComplete="off"
							data-cy="sessions-list-search"
							ref={searchInputRef}
						/>
					</div>
					{showSearchDropdown && canConfirmSearch ? (
						<button
							type="button"
							className="sessionsListToolbar__searchConfirmButton"
							onClick={confirmSearch}
							aria-label={translate(
								'sessionList.toolbar.search.confirm'
							)}
							data-cy="sessions-list-search-confirm"
						>
							<IconCheck />
						</button>
					) : hasTypedQuery || hasSelectedPeople ? (
						<button
							type="button"
							className="sessionsListToolbar__searchActionButton"
							onClick={() => {
								onSearchChange('');
								setSelectedPersonIds([]);
								onSelectedTopicIdChange?.(null);
								onSelectedTypeIdChange?.(null);
								setIsSearchViewOpen(false);
							}}
							aria-label={translate(
								'sessionList.toolbar.search.clear'
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
					<SessionSearchPanel
						labels={{
							refineHint: translate(
								'sessionList.toolbar.search.refineHint'
							),
							tabPeople: translate(
								'sessionList.toolbar.search.tabs.people'
							),
							tabType: translate(
								'sessionList.toolbar.search.tabs.type'
							),
							tabCentre: translate(
								'sessionList.toolbar.search.tabs.centre'
							),
							tabArchiveOnly: translate(
								'sessionList.toolbar.search.tabs.archiveOnly'
							),
							emptyPeople: translate(
								'sessionList.toolbar.search.emptyPeople'
							),
							emptyTypes: translate(
								'sessionList.toolbar.search.emptyTypes'
							),
							emptyTopics: translate(
								'sessionList.toolbar.search.emptyTopics'
							)
						}}
						activeTab={searchTab}
						onTabChange={setSearchTab}
						archiveOnly={searchArchiveOnly}
						onArchiveOnlyChange={(next) =>
							onSearchArchiveOnlyChange?.(next)
						}
						people={filteredPeople}
						selectedPersonIds={selectedPersonIds}
						onPersonToggle={(personId) => {
							setSelectedPersonIds((prev) =>
								prev.includes(personId)
									? prev.filter((id) => id !== personId)
									: [...prev, personId]
							);
							onSearchChange('');
							setIsSearchViewOpen(true);
							requestAnimationFrame(() =>
								searchInputRef.current?.focus()
							);
						}}
						types={searchTypeResults}
						selectedTypeId={selectedTypeId}
						onTypeSelect={(id) => onSelectedTypeIdChange?.(id)}
						topics={filteredTopics}
						selectedTopicId={selectedTopicId}
						onTopicSelect={(id) => onSelectedTopicIdChange?.(id)}
					/>
				)}
			</div>

			<div
				className="sessionsListToolbar__chipsScroll"
				data-cy="sessions-list-chips"
				style={{ display: showSearchDropdown ? 'none' : undefined }}
			>
				<div className="sessionsListToolbar__chipsRow">
					{showCreateGroupChatAction && (
						<Link
							className={clsx('sessionsListToolbar__chip', {
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
							data-tour-target="groupchat-create-button"
						>
							<CreateChatFilterIcon className="sessionsListToolbar__chipIconSvg" />
							<span className="sessionsListToolbar__chipLabel">
								{translate('sessionList.toolbar.chips.create')}
							</span>
						</Link>
					)}
					{filterChipsBeforeArchive.map(renderFilterChip)}
					{showConsultantActions && (
						<Link
							className={clsx('sessionsListToolbar__chip', {
								'sessionsListToolbar__chip--iconOnly':
									!archiveTabActive,
								'sessionsListToolbar__chip--active':
									archiveTabActive
							})}
							data-tour-target="sessions-archive-tab"
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
								{translate('sessionList.toolbar.chips.archive')}
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
