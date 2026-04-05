import * as React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { SESSION_LIST_TAB_ARCHIVE } from '../session/sessionHelpers';

export type SessionToolbarChipFilter =
	| 'neu'
	| 'oneToOne'
	| 'liveChat'
	| 'groups'
	| 'supervision';

interface SessionsListToolbarProps {
	translate: (key: string) => string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPeopleResults?: SessionSearchPersonResult[];
	activeChip: SessionToolbarChipFilter | null;
	onChipToggle: (chip: SessionToolbarChipFilter) => void;
	showConsultantActions: boolean;
	showSupervisionChip: boolean;
	createGroupChatPath: string;
	archiveTabPath: string;
	/** Consultant list is showing archived sessions (`?sessionListTab=archive`). */
	archiveTabActive: boolean;
	/** Create-group-chat route is open. */
	createGroupChatActive: boolean;
}

export interface SessionSearchPersonResult {
	id: string;
	name: string;
	subtitle: string;
}

const IconBack = () => (
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
			d="M7.825 13L13.425 18.6L12 20L4 12L12 4L13.425 5.4L7.825 11H20V13H7.825Z"
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

const IconPlus = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className="sessionsListToolbar__chipIconSvg"
	>
		<path
			d="M7.33301 8.66671H3.33301V7.33337H7.33301V3.33337H8.66634V7.33337H12.6663V8.66671H8.66634V12.6667H7.33301V8.66671Z"
			fill="currentColor"
		/>
	</svg>
);

const IconArchive = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 16 16"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className="sessionsListToolbar__chipIconSvg"
	>
		<path
			d="M8 12L10.6667 9.33333L9.73333 8.4L8.66667 9.46667V6.66667H7.33333V9.46667L6.26667 8.4L5.33333 9.33333L8 12ZM3.33333 5.33333V12.6667H12.6667V5.33333H3.33333ZM3.33333 14C2.96667 14 2.65 13.8722 2.38333 13.6167C2.12778 13.35 2 13.0333 2 12.6667V4.35C2 4.19444 2.02222 4.04444 2.06667 3.9C2.12222 3.75556 2.2 3.62222 2.3 3.5L3.13333 2.48333C3.25556 2.32778 3.40556 2.21111 3.58333 2.13333C3.77222 2.04444 3.96667 2 4.16667 2H11.8333C12.0333 2 12.2222 2.04444 12.4 2.13333C12.5889 2.21111 12.7444 2.32778 12.8667 2.48333L13.7 3.5C13.8 3.62222 13.8722 3.75556 13.9167 3.9C13.9722 4.04444 14 4.19444 14 4.35V12.6667C14 13.0333 13.8667 13.35 13.6 13.6167C13.3444 13.8722 13.0333 14 12.6667 14H3.33333ZM3.6 4H12.4L11.8333 3.33333H4.16667L3.6 4Z"
			fill="currentColor"
		/>
	</svg>
);

const IconGroup = () => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 14 14"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden
		className="sessionsListToolbar__groupIconSvg"
	>
		<path
			d="M5.53333 11.8667C6.03333 10.8556 6.7 10.1806 7.53333 9.84167C8.36667 9.50278 9.07778 9.33333 9.66667 9.33333C9.92222 9.33333 10.1722 9.35556 10.4167 9.4C10.6611 9.44444 10.9 9.5 11.1333 9.56667C11.4 9.14444 11.6111 8.68889 11.7667 8.2C11.9222 7.71111 12 7.2 12 6.66667C12 5.17778 11.4833 3.91667 10.45 2.88333C9.41667 1.85 8.15555 1.33333 6.66667 1.33333C5.17778 1.33333 3.91667 1.85 2.88333 2.88333C1.85 3.91667 1.33333 5.17778 1.33333 6.66667C1.33333 7.16667 1.39722 7.64444 1.525 8.1C1.65278 8.55556 1.84444 8.97778 2.1 9.36667C2.55556 9.14444 3.02778 8.97222 3.51667 8.85C4.00556 8.72778 4.5 8.66667 5 8.66667C5.35556 8.66667 5.69722 8.69722 6.025 8.75833C6.35278 8.81944 6.67778 8.9 7 9C6.74444 9.13333 6.50278 9.28889 6.275 9.46667C6.04722 9.64444 5.83333 9.83333 5.63333 10.0333C5.5 10.0111 5.38611 10 5.29167 10H5C4.64444 10 4.29167 10.0389 3.94167 10.1167C3.59167 10.1944 3.25556 10.3111 2.93333 10.4667C3.28889 10.8222 3.68611 11.1194 4.125 11.3583C4.56389 11.5972 5.03333 11.7667 5.53333 11.8667ZM4.06667 12.8083C3.25556 12.4583 2.55 11.9833 1.95 11.3833C1.35 10.7833 0.875 10.0778 0.525 9.26667C0.175 8.45555 0 7.58889 0 6.66667C0 5.74444 0.175 4.87778 0.525 4.06667C0.875 3.25556 1.35 2.55 1.95 1.95C2.55 1.35 3.25556 0.875 4.06667 0.525C4.87778 0.175 5.74444 0 6.66667 0C7.58889 0 8.45555 0.175 9.26667 0.525C10.0778 0.875 10.7833 1.35 11.3833 1.95C11.9833 2.55 12.4583 3.25556 12.8083 4.06667C13.1583 4.87778 13.3333 5.74444 13.3333 6.66667C13.3333 7.58889 13.1583 8.45555 12.8083 9.26667C12.4583 10.0778 11.9833 10.7833 11.3833 11.3833C10.7833 11.9833 10.0778 12.4583 9.26667 12.8083C8.45555 13.1583 7.58889 13.3333 6.66667 13.3333C5.74444 13.3333 4.87778 13.1583 4.06667 12.8083ZM3.35 6.98333C2.89444 6.52778 2.66667 5.97778 2.66667 5.33333C2.66667 4.68889 2.89444 4.13889 3.35 3.68333C3.80556 3.22778 4.35556 3 5 3C5.64444 3 6.19444 3.22778 6.65 3.68333C7.10556 4.13889 7.33333 4.68889 7.33333 5.33333C7.33333 5.97778 7.10556 6.52778 6.65 6.98333C6.19444 7.43889 5.64444 7.66667 5 7.66667C4.35556 7.66667 3.80556 7.43889 3.35 6.98333ZM5.70833 6.04167C5.90278 5.84722 6 5.61111 6 5.33333C6 5.05556 5.90278 4.81944 5.70833 4.625C5.51389 4.43056 5.27778 4.33333 5 4.33333C4.72222 4.33333 4.48611 4.43056 4.29167 4.625C4.09722 4.81944 4 5.05556 4 5.33333C4 5.61111 4.09722 5.84722 4.29167 6.04167C4.48611 6.23611 4.72222 6.33333 5 6.33333C5.27778 6.33333 5.51389 6.23611 5.70833 6.04167ZM8.48333 7.85C8.16111 7.52778 8 7.13333 8 6.66667C8 6.2 8.16111 5.80556 8.48333 5.48333C8.80556 5.16111 9.2 5 9.66667 5C10.1333 5 10.5278 5.16111 10.85 5.48333C11.1722 5.80556 11.3333 6.2 11.3333 6.66667C11.3333 7.13333 11.1722 7.52778 10.85 7.85C10.5278 8.17222 10.1333 8.33333 9.66667 8.33333C9.2 8.33333 8.80556 8.17222 8.48333 7.85Z"
			fill="currentColor"
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

export const SessionsListToolbar = ({
	translate,
	searchValue,
	onSearchChange,
	searchPeopleResults = [],
	activeChip,
	onChipToggle,
	showConsultantActions,
	showSupervisionChip,
	createGroupChatPath,
	archiveTabPath,
	archiveTabActive,
	createGroupChatActive
}: SessionsListToolbarProps) => {
	const searchId = React.useId();
	const [isSearchViewOpen, setIsSearchViewOpen] = React.useState(false);
	const [searchTab, setSearchTab] = React.useState<
		'people' | 'type' | 'scheduled' | 'pinned' | 'archived'
	>('people');
	const [selectedPersonId, setSelectedPersonId] = React.useState<
		string | null
	>(null);

	const filteredPeople = React.useMemo(() => {
		const needle = searchValue.trim().toLowerCase();
		if (!needle) {
			return searchPeopleResults.slice(0, 8);
		}
		return searchPeopleResults.filter((entry) =>
			`${entry.name} ${entry.subtitle}`.toLowerCase().includes(needle)
		);
	}, [searchPeopleResults, searchValue]);
	const tr = React.useCallback(
		(key: string, fallback: string) => {
			const translated = translate(key);
			return translated && translated !== key ? translated : fallback;
		},
		[translate]
	);

	const chipClass = (chip: SessionToolbarChipFilter) =>
		clsx('sessionsListToolbar__chip', {
			'sessionsListToolbar__chip--active': activeChip === chip
		});
	const hasTypedQuery = searchValue.trim().length > 0;
	const showSearchDropdown = isSearchViewOpen && hasTypedQuery;

	return (
		<div className="sessionsListToolbar" data-cy="sessions-list-toolbar">
			<div className="sessionsListToolbar__search">
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
						<IconBack />
					</button>
					<div className="sessionsListToolbar__searchFieldWrap">
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
							autoComplete="off"
							data-cy="sessions-list-search"
						/>
					</div>
					{hasTypedQuery ? (
						<button
							type="button"
							className="sessionsListToolbar__searchActionButton"
							onClick={() => {
								onSearchChange('');
								setSelectedPersonId(null);
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
											selectedPersonId === person.id;
										return (
											<button
												type="button"
												key={person.id}
												className="sessionsListToolbar__personRow"
												onClick={() => {
													setSelectedPersonId(
														(prev) =>
															prev === person.id
																? null
																: person.id
													);
													onSearchChange(person.name);
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
							className={clsx(
								'sessionsListToolbar__chip',
								'sessionsListToolbar__chip--iconOnly',
								{
									'sessionsListToolbar__chip--active':
										createGroupChatActive
								}
							)}
							to={createGroupChatPath}
							aria-label={translate(
								'sessionList.createChat.buttonTitle'
							)}
							aria-current={
								createGroupChatActive ? 'page' : undefined
							}
							data-cy="sessions-list-chip-create"
						>
							<IconPlus />
						</Link>
					)}
					{showConsultantActions && (
						<Link
							className={clsx(
								'sessionsListToolbar__chip',
								'sessionsListToolbar__chip--iconOnly',
								'walkthrough_step_4',
								{
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
							<IconArchive />
						</Link>
					)}
					{showSupervisionChip && (
						<button
							type="button"
							className={clsx(
								'sessionsListToolbar__chip',
								'sessionsListToolbar__chip--iconOnly',
								{
									'sessionsListToolbar__chip--active':
										activeChip === 'supervision'
								}
							)}
							onClick={() => onChipToggle('supervision')}
							aria-pressed={activeChip === 'supervision'}
							aria-label={translate(
								'sessionList.toolbar.chips.supervision'
							)}
							data-cy="sessions-list-chip-supervision-icon"
						>
							<span className="sessionsListToolbar__groupIconSlot">
								<IconGroup />
							</span>
						</button>
					)}
					<button
						type="button"
						className={chipClass('neu')}
						onClick={() => onChipToggle('neu')}
						aria-pressed={activeChip === 'neu'}
						data-cy="sessions-list-chip-neu"
					>
						<span className="sessionsListToolbar__chipLabel">
							{translate('sessionList.toolbar.chips.neu')}
						</span>
					</button>
					<button
						type="button"
						className={chipClass('oneToOne')}
						onClick={() => onChipToggle('oneToOne')}
						aria-pressed={activeChip === 'oneToOne'}
						data-cy="sessions-list-chip-one-to-one"
					>
						<span className="sessionsListToolbar__chipLabel">
							{translate('sessionList.toolbar.chips.oneToOne')}
						</span>
					</button>
					<button
						type="button"
						className={chipClass('liveChat')}
						onClick={() => onChipToggle('liveChat')}
						aria-pressed={activeChip === 'liveChat'}
						data-cy="sessions-list-chip-live-chat"
					>
						<span className="sessionsListToolbar__chipLabel">
							{translate('sessionList.toolbar.chips.liveChat')}
						</span>
					</button>
					<button
						type="button"
						className={chipClass('groups')}
						onClick={() => onChipToggle('groups')}
						aria-pressed={activeChip === 'groups'}
						data-cy="sessions-list-chip-groups-text"
					>
						<span className="sessionsListToolbar__chipLabel">
							{translate('sessionList.toolbar.chips.groups')}
						</span>
					</button>
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
