import * as React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { SESSION_LIST_TAB_ARCHIVE } from '../session/sessionHelpers';

export type SessionToolbarChipFilter =
	| 'neu'
	| 'oneToOne'
	| 'liveChat'
	| 'groups';

interface SessionsListToolbarProps {
	translate: (key: string) => string;
	searchValue: string;
	onSearchChange: (value: string) => void;
	activeChip: SessionToolbarChipFilter | null;
	onChipToggle: (chip: SessionToolbarChipFilter) => void;
	showConsultantActions: boolean;
	createGroupChatPath: string;
	archiveTabPath: string;
}

const IconKebab = () => (
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
			d="M12 20C11.45 20 10.9792 19.8042 10.5875 19.4125C10.1958 19.0208 10 18.55 10 18C10 17.45 10.1958 16.9792 10.5875 16.5875C10.9792 16.1958 11.45 16 12 16C12.55 16 13.0208 16.1958 13.4125 16.5875C13.8042 16.9792 14 17.45 14 18C14 18.55 13.8042 19.0208 13.4125 19.4125C13.0208 19.8042 12.55 20 12 20ZM12 14C11.45 14 10.9792 13.8042 10.5875 13.4125C10.1958 13.0208 10 12.55 10 12C10 11.45 10.1958 10.9792 10.5875 10.5875C10.9792 10.1958 11.45 10 12 10C12.55 10 13.0208 10.1958 13.4125 10.5875C13.8042 10.9792 14 11.45 14 12C14 12.55 13.8042 13.0208 13.4125 13.4125C13.0208 13.8042 12.55 14 12 14ZM12 8C11.45 8 10.9792 7.80417 10.5875 7.4125C10.1958 7.02083 10 6.55 10 6C10 5.45 10.1958 4.97917 10.5875 4.5875C10.9792 4.19583 11.45 4 12 4C12.55 4 13.0208 4.19583 13.4125 4.5875C13.8042 4.97917 14 5.45 14 6C14 6.55 13.8042 7.02083 13.4125 7.4125C13.0208 7.80417 12.55 8 12 8Z"
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
			fill="#1B1B1C"
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
			fill="#1B1B1C"
		/>
	</svg>
);

const IconCalendar = () => (
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
			d="M6 11C5.53333 11 5.13889 10.8389 4.81667 10.5167C4.49444 10.1945 4.33333 9.80004 4.33333 9.33337C4.33333 8.86671 4.49444 8.47226 4.81667 8.15004C5.13889 7.82782 5.53333 7.66671 6 7.66671C6.46667 7.66671 6.86111 7.82782 7.18333 8.15004C7.50556 8.47226 7.66667 8.86671 7.66667 9.33337C7.66667 9.80004 7.50556 10.1945 7.18333 10.5167C6.86111 10.8389 6.46667 11 6 11ZM3.33333 14.6667C2.96667 14.6667 2.65278 14.5362 2.39167 14.275C2.13056 14.0139 2 13.7 2 13.3334V4.00004C2 3.63337 2.13056 3.31949 2.39167 3.05837C2.65278 2.79726 2.96667 2.66671 3.33333 2.66671H4V1.33337H5.33333V2.66671H10.6667V1.33337H12V2.66671H12.6667C13.0333 2.66671 13.3472 2.79726 13.6083 3.05837C13.8694 3.31949 14 3.63337 14 4.00004V13.3334C14 13.7 13.8694 14.0139 13.6083 14.275C13.3472 14.5362 13.0333 14.6667 12.6667 14.6667H3.33333ZM3.33333 13.3334H12.6667V6.66671H3.33333V13.3334Z"
			fill="#1B1B1C"
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
			fill="#1C1B1F"
		/>
	</svg>
);

export const SessionsListToolbar = ({
	translate,
	searchValue,
	onSearchChange,
	activeChip,
	onChipToggle,
	showConsultantActions,
	createGroupChatPath,
	archiveTabPath
}: SessionsListToolbarProps) => {
	const searchId = React.useId();

	const chipClass = (chip: SessionToolbarChipFilter) =>
		clsx('sessionsListToolbar__chip', {
			'sessionsListToolbar__chip--active': activeChip === chip
		});

	return (
		<div className="sessionsListToolbar" data-cy="sessions-list-toolbar">
			<div className="sessionsListToolbar__search">
				<div className="sessionsListToolbar__searchInner">
					<button
						type="button"
						className="sessionsListToolbar__iconButton"
						aria-label={translate('sessionList.toolbar.menu.ariaLabel')}
					>
						<IconKebab />
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
							autoComplete="off"
							data-cy="sessions-list-search"
						/>
					</div>
					<div
						className="sessionsListToolbar__searchIconWrap"
						aria-hidden
					>
						<IconSearch />
					</div>
				</div>
			</div>

			<div
				className="sessionsListToolbar__chipsScroll"
				data-cy="sessions-list-chips"
			>
				<div className="sessionsListToolbar__chipsRow">
					{showConsultantActions && (
						<Link
							className="sessionsListToolbar__chip sessionsListToolbar__chip--iconOnly"
							to={createGroupChatPath}
							aria-label={translate(
								'sessionList.createChat.buttonTitle'
							)}
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
								'walkthrough_step_4'
							)}
							to={archiveTabPath}
							aria-label={translate(
								'sessionList.view.archive.tab'
							)}
							data-cy="sessions-list-chip-archive"
						>
							<IconArchive />
						</Link>
					)}
					<button
						type="button"
						className="sessionsListToolbar__chip sessionsListToolbar__chip--iconOnly"
						title={translate('sessionList.toolbar.calendar.title')}
						aria-label={translate('sessionList.toolbar.calendar.title')}
						data-cy="sessions-list-chip-calendar"
					>
						<IconCalendar />
					</button>
					<button
						type="button"
						className={clsx(
							'sessionsListToolbar__chip',
							'sessionsListToolbar__chip--iconOnly',
							{
								'sessionsListToolbar__chip--active':
									activeChip === 'groups'
							}
						)}
						onClick={() => onChipToggle('groups')}
						aria-pressed={activeChip === 'groups'}
						aria-label={translate('sessionList.toolbar.chips.groups')}
						data-cy="sessions-list-chip-groups-icon"
					>
						<span className="sessionsListToolbar__groupIconSlot">
							<IconGroup />
						</span>
					</button>
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
