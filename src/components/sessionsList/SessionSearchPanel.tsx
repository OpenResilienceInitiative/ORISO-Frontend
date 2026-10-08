import * as React from 'react';
import clsx from 'clsx';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';
import type { SessionSearchPersonRole } from './sessionSearchPeople';
import './sessionsList.styles';

/** JOB3: "only load max 10 latest users", then paginate automatically. */
export const SESSION_SEARCH_PAGE_SIZE = 10;

const visiblePeopleKeyOf = (people: { id: string }[]) =>
	people.map((person) => person.id).join('|');

/**
 * Search refinement panel (organism) — the dropdown attached to the session
 * list search pill. Figma: "CARX — Teamberatung Case Handover", Section 07
 * "Search Bar | Organisms" (node 4121-12160) and Section 00 behaviour notes.
 *
 * Tabs: People (checkbox multi-select), By type (radio), Counselling centre
 * (topic radio — a person must never have two topics selected at once, hence
 * single-select), plus an independent "Archive only" toggle tab.
 *
 * Purely controlled; confirm semantics (checkmark / Enter) live with the
 * caller because the confirm affordance sits in the search pill itself.
 */

export type SessionSearchTab = 'people' | 'type' | 'centre';

export interface SessionSearchPersonOption {
	id: string;
	name: string;
	/** e.g. "Berater:in | Mainz 30232" */
	subtitle: string;
	/** Clients and counsellors are separate roles (#1195 JOB5). */
	role?: SessionSearchPersonRole;
	/** Stable key for the generated animal avatar; falls back to `id`. */
	avatarSeed?: string;
}

/** A counselling centre the signed-in counsellor belongs to (#1195 JOB1). */
export interface SessionSearchAgencyOption {
	id: string;
	label: string;
	/** Optional context, e.g. "Mainz 30232". */
	subtitle?: string;
}

export interface SessionSearchTopicOption {
	id: string;
	/** Topic name, e.g. "Schulden" */
	label: string;
	/** Optional department/agency context, e.g. "Mainz 30232" */
	subtitle?: string;
}

export interface SessionSearchTypeOption {
	id: string;
	label: string;
}

export interface SessionSearchPanelLabels {
	refineHint: string;
	tabPeople: string;
	tabType: string;
	tabCentre: string;
	tabArchiveOnly: string;
	emptyPeople: string;
	emptyTypes: string;
	emptyTopics: string;
}

interface SessionSearchPanelProps {
	labels: SessionSearchPanelLabels;
	activeTab: SessionSearchTab;
	onTabChange: (tab: SessionSearchTab) => void;
	archiveOnly: boolean;
	onArchiveOnlyChange: (archiveOnly: boolean) => void;
	people: SessionSearchPersonOption[];
	selectedPersonIds: string[];
	onPersonToggle: (id: string) => void;
	types: SessionSearchTypeOption[];
	selectedTypeId: string | null;
	onTypeSelect: (id: string | null) => void;
	topics: SessionSearchTopicOption[];
	selectedTopicId: string | null;
	onTopicSelect: (id: string | null) => void;
	/**
	 * JOB1 — a counsellor belonging to two agencies filters along both, so this
	 * axis is multi-select and sits above the single-select topic list.
	 */
	agencies?: SessionSearchAgencyOption[];
	selectedAgencyIds?: string[];
	onAgencyToggle?: (id: string) => void;
}

const iconFill = (active: boolean) =>
	active
		? 'var(--m3-primary, #a5000a)'
		: 'var(--m3-on-surface-variant, #444748)';

const IconPeopleTab = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M5.85 17.1C6.7 16.45 7.65 15.9375 8.7 15.5625C9.75 15.1875 10.85 15 12 15C13.15 15 14.25 15.1875 15.3 15.5625C16.35 15.9375 17.3 16.45 18.15 17.1C18.7333 16.4167 19.1875 15.6417 19.5125 14.775C19.8375 13.9083 20 12.9833 20 12C20 9.78333 19.2208 7.89583 17.6625 6.3375C16.1042 4.77917 14.2167 4 12 4C9.78333 4 7.89583 4.77917 6.3375 6.3375C4.77917 7.89583 4 9.78333 4 12C4 12.9833 4.1625 13.9083 4.4875 14.775C4.8125 15.6417 5.26667 16.4167 5.85 17.1ZM12 13C11.0167 13 10.1875 12.6625 9.5125 11.9875C8.8375 11.3125 8.5 10.4833 8.5 9.5C8.5 8.51667 8.8375 7.6875 9.5125 7.0125C10.1875 6.3375 11.0167 6 12 6C12.9833 6 13.8125 6.3375 14.4875 7.0125C15.1625 7.6875 15.5 8.51667 15.5 9.5C15.5 10.4833 15.1625 11.3125 14.4875 11.9875C13.8125 12.6625 12.9833 13 12 13ZM12 22C10.6167 22 9.31667 21.7375 8.1 21.2125C6.88333 20.6875 5.825 19.975 4.925 19.075C4.025 18.175 3.3125 17.1167 2.7875 15.9C2.2625 14.6833 2 13.3833 2 12C2 10.6167 2.2625 9.31667 2.7875 8.1C3.3125 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.3125 8.1 2.7875C9.31667 2.2625 10.6167 2 12 2C13.3833 2 14.6833 2.2625 15.9 2.7875C17.1167 3.3125 18.175 4.025 19.075 4.925C19.975 5.825 20.6875 6.88333 21.2125 8.1C21.7375 9.31667 22 10.6167 22 12C22 13.3833 21.7375 14.6833 21.2125 15.9C20.6875 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6875 15.9 21.2125C14.6833 21.7375 13.3833 22 12 22Z"
			fill={iconFill(active)}
		/>
	</svg>
);

const IconTypeTab = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M6 14H18V12H6V14ZM6 11H18V9H6V11ZM6 8H18V6H6V8ZM22 22L18 18H4C3.45 18 2.97917 17.8042 2.5875 17.4125C2.19583 17.0208 2 16.55 2 16V4C2 3.45 2.19583 2.97917 2.5875 2.5875C2.97917 2.19583 3.45 2 4 2H20C20.55 2 21.0208 2.19583 21.4125 2.5875C21.8042 2.97917 22 3.45 22 4V22ZM4 16H18.85L20 17.125V4H4V16Z"
			fill={iconFill(active)}
		/>
	</svg>
);

/** Counselling-centre tab icon (Counselling_Centre_400_24px asset). */
const IconCentreTab = ({ active }: { active: boolean }) => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M10.8908 17.6584L11.2527 17.8252C11.4871 17.934 11.7402 17.9884 11.9915 17.9884C12.2427 17.9884 12.4949 17.934 12.7293 17.8252L13.0921 17.6574C15.3224 16.6262 16.7295 14.4642 16.6911 12.1365C16.7567 11.3893 16.4633 10.6383 15.898 10.1152C15.1002 9.37646 13.8917 9.19175 12.8915 9.65582C12.5624 9.80863 12.2587 10.0074 11.9915 10.2427C11.7243 10.0074 11.4206 9.80862 11.0915 9.65582C10.0912 9.19269 8.88276 9.37737 8.08503 10.1152C7.51971 10.6383 7.22628 11.3893 7.2919 12.1365C7.25346 14.4643 8.66055 16.6261 10.8908 17.6584ZM9.38897 11.5252C9.53241 11.392 9.73023 11.3227 9.93178 11.3227C10.0518 11.3227 10.1736 11.348 10.2843 11.3995C10.6293 11.5589 10.9115 11.8186 11.0802 12.1298L11.1468 12.2527C11.3146 12.563 11.639 12.7561 11.9915 12.7561C12.344 12.7561 12.6683 12.563 12.8361 12.2527L12.9018 12.1308C13.0705 11.8195 13.3527 11.5599 13.6977 11.4005C13.9949 11.2627 14.3643 11.3142 14.593 11.527C14.7299 11.6536 14.7965 11.8205 14.7768 11.9864C14.7712 12.0333 14.7693 12.0802 14.7702 12.128C14.8133 13.7114 13.8383 15.1993 12.285 15.9173L11.9906 16.0533L11.6962 15.9173C10.1428 15.1983 9.16785 13.7105 9.21105 12.128C9.21292 12.0802 9.21011 12.0333 9.20448 11.9864C9.18573 11.8195 9.2521 11.6517 9.38897 11.5252Z"
			fill={iconFill(active)}
		/>
		<path
			d="M6.65622 21.4824C7.29184 21.5733 7.93777 21.6427 8.57622 21.6886C9.65154 21.7955 10.769 21.8471 11.9907 21.8471C13.2132 21.8471 14.3298 21.7946 15.4052 21.6886C16.0436 21.6427 16.6896 21.5733 17.3121 21.4843C18.3583 21.3502 19.3305 20.8599 20.1292 20.0602C20.8923 19.283 21.4014 18.2883 21.5992 17.185C21.9217 15.4722 21.9217 13.736 21.601 12.0382L21.4548 11.1944C21.1445 9.51913 20.3917 7.98541 19.2732 6.75445C18.1932 5.57977 17.0036 4.56351 15.7397 3.73669L14.4732 2.90324C12.9422 1.89637 11.04 1.8973 9.50805 2.90324L8.24337 3.73575C6.97682 4.5645 5.78817 5.57982 4.70337 6.75927C3.58869 7.98553 2.83588 9.51927 2.52369 11.2058L2.38307 12.0195C2.22182 12.8492 2.14307 13.6929 2.14307 14.6024C2.14307 15.5164 2.22369 16.3902 2.38025 17.1814C2.57807 18.2877 3.08619 19.2833 3.85774 20.0679C4.65087 20.8601 5.62314 21.3502 6.65622 21.4824ZM4.27216 12.3662L4.41466 11.544C4.66027 10.2193 5.25185 9.01179 6.12185 8.05371C7.09404 6.99622 8.16279 6.08309 9.29705 5.34051L10.5627 4.508C11.0033 4.21832 11.4973 4.07393 11.9914 4.07393C12.4845 4.07393 12.9786 4.21831 13.4192 4.508L14.6877 5.34238C15.8211 6.08393 16.8889 6.99706 17.8573 8.04982C18.7311 9.01169 19.3227 10.2201 19.5664 11.5337L19.7136 12.3811C19.993 13.8586 19.993 15.3567 19.7136 16.8343C19.7127 16.8372 19.7127 16.8409 19.7117 16.8437C19.5823 17.5675 19.2542 18.2153 18.7677 18.7103C18.2783 19.1997 17.6905 19.5015 17.0558 19.5831C16.4595 19.6684 15.8549 19.7331 15.2567 19.7753C15.2473 19.7762 15.2389 19.7771 15.2295 19.7781C14.2142 19.8793 13.1549 19.929 11.9924 19.929C10.83 19.929 9.77054 19.8793 8.75529 19.7781C8.74686 19.7771 8.73748 19.7762 8.72811 19.7753C8.12998 19.7331 7.52436 19.6675 6.91591 19.5812C6.29436 19.5015 5.70747 19.2006 5.22372 18.7168C4.73153 18.2153 4.40247 17.5674 4.27027 16.8268C4.13434 16.1406 4.0659 15.3924 4.0659 14.6021C4.06402 13.8175 4.13059 13.0928 4.27216 12.3662Z"
			fill={iconFill(active)}
		/>
	</svg>
);

/**
 * JOB6 — the hand-rolled `<span>` box is replaced by MUI's checkbox glyphs.
 * The icons (not `<Checkbox>` itself) are used deliberately: each row is a
 * `<button role="checkbox">`, and nesting MUI's real `<input type="checkbox">`
 * inside a button is invalid HTML and would break the row's keyboard semantics.
 */
const SelectionCheckbox = ({ selected }: { selected: boolean }) => {
	const Icon = selected ? CheckBoxIcon : CheckBoxOutlineBlankIcon;
	return (
		<Icon
			className={clsx(
				'sessionsListToolbar__personCheckbox',
				selected && 'sessionsListToolbar__personCheckbox--selected'
			)}
			fontSize="small"
			aria-hidden
		/>
	);
};

const SelectionRadio = ({ selected }: { selected: boolean }) => (
	<span
		className={clsx(
			'sessionsListToolbar__personRadio',
			selected && 'sessionsListToolbar__personRadio--selected'
		)}
		aria-hidden
	/>
);

/**
 * JOB4 — result rows carry the shared generated animal avatar instead of a
 * letter monogram, matching the green-marked reference in the report.
 */
const PersonAvatar = ({ seed }: { seed: string }) => (
	<span
		className="sessionsListToolbar__personAvatar"
		data-testid="session-search-person-avatar"
	>
		<AnimalAvatar avatar={generateAvatarForUser(seed)} size={40} />
	</span>
);

export const SessionSearchPanel = ({
	labels,
	activeTab,
	onTabChange,
	archiveOnly,
	onArchiveOnlyChange,
	people,
	selectedPersonIds,
	onPersonToggle,
	types,
	selectedTypeId,
	onTypeSelect,
	topics,
	selectedTopicId,
	onTopicSelect,
	agencies = [],
	selectedAgencyIds = [],
	onAgencyToggle
}: SessionSearchPanelProps) => {
	/**
	 * JOB3 — the list shows the 10 most recent people from the visible timeline
	 * and reveals the next 10 whenever the sentinel scrolls into view.
	 */
	const [visibleCount, setVisibleCount] = React.useState(
		SESSION_SEARCH_PAGE_SIZE
	);
	const sentinelRef = React.useRef<HTMLDivElement | null>(null);
	const visiblePeople = people.slice(0, visibleCount);
	const hasMorePeople = visibleCount < people.length;

	/*
	 * Keyed on the roster's contents, not the array identity: the session list
	 * re-derives `people` whenever a message arrives, and resetting on identity
	 * would snap a scrolled list back to the first page.
	 */
	const peopleKey = visiblePeopleKeyOf(people);
	React.useEffect(() => {
		setVisibleCount(SESSION_SEARCH_PAGE_SIZE);
	}, [peopleKey, activeTab]);

	React.useEffect(() => {
		const node = sentinelRef.current;
		if (!node || typeof IntersectionObserver === 'undefined') {
			return undefined;
		}
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				setVisibleCount((prev) =>
					Math.min(prev + SESSION_SEARCH_PAGE_SIZE, people.length)
				);
			}
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, [people.length, hasMorePeople]);

	const contentTabs: {
		id: SessionSearchTab;
		label: string;
		Icon: React.ComponentType<{ active: boolean }>;
	}[] = [
		{ id: 'people', label: labels.tabPeople, Icon: IconPeopleTab },
		{ id: 'type', label: labels.tabType, Icon: IconTypeTab },
		{ id: 'centre', label: labels.tabCentre, Icon: IconCentreTab }
	];

	return (
		<div
			className="sessionsListToolbar__searchModal"
			data-cy="session-search-panel"
		>
			<div className="sessionsListToolbar__searchRefineHint">
				{labels.refineHint}
			</div>
			<div
				className="sessionsListToolbar__searchModalTabs"
				role="tablist"
				aria-label={labels.refineHint}
			>
				{contentTabs.map(({ id, label, Icon }) => {
					const isActive = activeTab === id;
					return (
						<button
							type="button"
							key={id}
							role="tab"
							aria-selected={isActive}
							className={clsx(
								'sessionsListToolbar__searchModalTab',
								isActive &&
									'sessionsListToolbar__searchModalTab--active'
							)}
							onClick={() => onTabChange(id)}
							data-cy={`session-search-tab-${id}`}
						>
							<span className="sessionsListToolbar__searchModalTabIcon">
								<Icon active={isActive} />
							</span>
							<span className="sessionsListToolbar__searchModalTabLabel">
								{label}
							</span>
						</button>
					);
				})}
				<button
					type="button"
					className={clsx(
						'sessionsListToolbar__searchModalTab',
						'sessionsListToolbar__searchModalTab--toggle',
						archiveOnly &&
							'sessionsListToolbar__searchModalTab--active'
					)}
					onClick={() => onArchiveOnlyChange(!archiveOnly)}
					aria-pressed={archiveOnly}
					data-cy="session-search-tab-archive-only"
				>
					<span className="sessionsListToolbar__searchModalTabIcon">
						<SelectionCheckbox selected={archiveOnly} />
					</span>
					<span className="sessionsListToolbar__searchModalTabLabel">
						{labels.tabArchiveOnly}
					</span>
				</button>
			</div>
			<div className="sessionsListToolbar__searchModalBody">
				{activeTab === 'people' &&
					(people.length > 0 ? (
						<div
							className="sessionsListToolbar__searchResultsScroll"
							data-testid="session-search-results-scroll"
						>
							{visiblePeople.map((person) => {
								const isSelected = selectedPersonIds.includes(
									person.id
								);
								return (
									<button
										type="button"
										key={person.id}
										role="checkbox"
										aria-checked={isSelected}
										className="sessionsListToolbar__personRow"
										onClick={() =>
											onPersonToggle(person.id)
										}
										data-cy={`session-search-person-${person.id}`}
									>
										<PersonAvatar
											seed={
												person.avatarSeed || person.id
											}
										/>
										<div className="sessionsListToolbar__personMeta">
											<div className="sessionsListToolbar__personName">
												{person.name}
											</div>
											<div className="sessionsListToolbar__personSubtitle">
												{person.subtitle}
											</div>
										</div>
										<SelectionCheckbox
											selected={isSelected}
										/>
									</button>
								);
							})}
							{hasMorePeople && (
								<div
									ref={sentinelRef}
									className="sessionsListToolbar__searchSentinel"
									data-testid="session-search-sentinel"
									aria-hidden
								/>
							)}
						</div>
					) : (
						<div className="sessionsListToolbar__searchEmpty">
							{labels.emptyPeople}
						</div>
					))}
				{activeTab === 'type' &&
					(types.length > 0 ? (
						<div role="radiogroup" aria-label={labels.tabType}>
							{types.map((type) => {
								const isSelected = selectedTypeId === type.id;
								return (
									<button
										type="button"
										key={type.id}
										role="radio"
										aria-checked={isSelected}
										className="sessionsListToolbar__personRow"
										onClick={() =>
											onTypeSelect(
												isSelected ? null : type.id
											)
										}
										data-cy={`session-search-type-${type.id}`}
									>
										<div className="sessionsListToolbar__personMeta">
											<div className="sessionsListToolbar__personName">
												{type.label}
											</div>
										</div>
										<SelectionRadio selected={isSelected} />
									</button>
								);
							})}
						</div>
					) : (
						<div className="sessionsListToolbar__searchEmpty">
							{labels.emptyTypes}
						</div>
					))}
				{activeTab === 'centre' && agencies.length > 0 && (
					<div
						className="sessionsListToolbar__searchAgencyGroup"
						role="group"
						aria-label={labels.tabCentre}
					>
						{agencies.map((agency) => {
							const isSelected = selectedAgencyIds.includes(
								agency.id
							);
							return (
								<button
									type="button"
									key={agency.id}
									role="checkbox"
									aria-checked={isSelected}
									className="sessionsListToolbar__personRow"
									onClick={() => onAgencyToggle?.(agency.id)}
									data-cy={`session-search-agency-${agency.id}`}
									data-testid={`session-search-agency-${agency.id}`}
								>
									<div className="sessionsListToolbar__personMeta">
										<div className="sessionsListToolbar__personName">
											{agency.label}
										</div>
										{agency.subtitle && (
											<div className="sessionsListToolbar__personSubtitle">
												{agency.subtitle}
											</div>
										)}
									</div>
									<SelectionCheckbox selected={isSelected} />
								</button>
							);
						})}
					</div>
				)}
				{activeTab === 'centre' &&
					(topics.length > 0 ? (
						<div role="radiogroup" aria-label={labels.tabCentre}>
							{topics.map((topic) => {
								const isSelected = selectedTopicId === topic.id;
								return (
									<button
										type="button"
										key={topic.id}
										role="radio"
										aria-checked={isSelected}
										className="sessionsListToolbar__personRow"
										onClick={() =>
											onTopicSelect(
												isSelected ? null : topic.id
											)
										}
										data-cy={`session-search-topic-${topic.id}`}
									>
										<div className="sessionsListToolbar__personMeta">
											<div className="sessionsListToolbar__personName">
												{topic.label}
											</div>
											{topic.subtitle && (
												<div className="sessionsListToolbar__personSubtitle">
													{topic.subtitle}
												</div>
											)}
										</div>
										<SelectionRadio selected={isSelected} />
									</button>
								);
							})}
						</div>
					) : (
						<div className="sessionsListToolbar__searchEmpty">
							{labels.emptyTopics}
						</div>
					))}
			</div>
		</div>
	);
};
