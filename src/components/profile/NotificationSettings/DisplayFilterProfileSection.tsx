import * as React from 'react';
import { useContext, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { Switch } from '../../Switch';
import { M3Checkbox } from '../../M3Checkbox';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../../../globalState/helpers/stateHelpers';
import { useTenant } from '../../../globalState/provider/TenantProvider';
import { useDisplayFilter } from '../../../hooks/useDisplayFilter';
import {
	DisplayFilterKindOption,
	DisplayFilterValue
} from '../../displayFilter/displayFilterTypes';
import { DisplayFilterKindTable } from '../../displayFilter/DisplayFilterKindTable';
import { useDisplayFilterLabels } from '../../displayFilter/useDisplayFilterLabels';
import {
	SESSION_KIND_ICONS,
	TIMELINE_KIND_ICONS,
	sessionKindLabel,
	timelineKindLabel
} from '../../displayFilter/kindOptions';
import {
	DisplayFilter,
	DisplayFilterSection
} from '../../../utils/displayFilter/model';
import {
	REQUEST_KIND_ORDER,
	SESSION_KIND_ORDER
} from '../../../utils/displayFilter/sessions';
import {
	TIMELINE_KIND_ORDER,
	isTimelineKindPartiallyHidden
} from '../../../utils/displayFilter/timeline';
import {
	KNOWN_EVENT_TYPES,
	getEventDescriptor
} from '../../notificationsCenter/eventDescriptors';
import '../../displayFilter/displayFilter.styles.scss';

/**
 * Profile › Notifications › Display filters (#1377 slice 6, spec §4/§5):
 * the per-section DEFAULTS (`global[section]`) side by side, the Zeitstrahl
 * per-event-type fine-tuning (#593, `hiddenEventTypes`), and the limited
 * "apply to other lists" action. A list's own override (its filter button)
 * is untouched here; the hint says so while one exists.
 */
export const DisplayFilterProfileSection = () => {
	const { t } = useTranslation();
	const baseId = useId();
	const tenant = useTenant();
	const { userData } = useContext(UserDataContext);
	const canSupervise =
		!!userData &&
		!hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
	const showGroups = tenant?.settings?.featureGroupChatV2Enabled === true;
	const showInternalGroups =
		tenant?.settings?.featureSupervisionEnabled === true;

	const timeline = useDisplayFilter('timeline');
	const sessions = useDisplayFilter('sessions');
	const requests = useDisplayFilter('requests');
	const timelineLabels = useDisplayFilterLabels('timeline');
	const sessionsLabels = useDisplayFilterLabels('sessions');
	const requestsLabels = useDisplayFilterLabels('requests');
	const readOnly = !timeline.canWrite;

	const timelineKinds = useMemo<DisplayFilterKindOption[]>(
		() =>
			TIMELINE_KIND_ORDER.map((kind) => ({
				id: kind,
				label: timelineKindLabel(t, kind),
				icon: TIMELINE_KIND_ICONS[kind],
				partial: isTimelineKindPartiallyHidden(timeline.global, kind)
			})),
		[t, timeline.global]
	);
	const sessionKinds = useMemo<DisplayFilterKindOption[]>(
		() =>
			SESSION_KIND_ORDER.filter((kind) => {
				switch (kind) {
					case 'internalGroup':
						return showInternalGroups;
					case 'circle':
					case 'futureTimeline':
						return showGroups;
					case 'supervision':
						return canSupervise;
					default:
						return true;
				}
			}).map((kind) => ({
				id: kind,
				label: sessionKindLabel(t, kind),
				icon: SESSION_KIND_ICONS[kind],
				showOnly: kind === 'futureTimeline'
			})),
		[canSupervise, showGroups, showInternalGroups, t]
	);
	const requestKinds = useMemo<DisplayFilterKindOption[]>(
		() =>
			REQUEST_KIND_ORDER.map((kind) => ({
				id: kind,
				label: sessionKindLabel(t, kind),
				icon: SESSION_KIND_ICONS[kind]
			})),
		[t]
	);

	/** Event types of the Zeitstrahl grouped by family, registry order. */
	const eventTypesByFamily = useMemo(() => {
		const groups = new Map<string, string[]>();
		KNOWN_EVENT_TYPES.forEach((type) => {
			const family = getEventDescriptor(type).family;
			groups.set(family, [...(groups.get(family) ?? []), type]);
		});
		return TIMELINE_KIND_ORDER.filter((kind) => groups.has(kind)).map(
			(kind) => ({ kind, types: groups.get(kind) ?? [] })
		);
	}, []);

	const writeGlobal = (
		section: DisplayFilterSection,
		current: DisplayFilter,
		next: DisplayFilterValue
	) => {
		const target =
			section === 'timeline'
				? timeline
				: section === 'sessions'
					? sessions
					: requests;
		target.setGlobal({ ...current, ...next });
	};

	const setEventTypeHidden = (type: string, hidden: boolean) => {
		const current = new Set(timeline.global.hiddenEventTypes ?? []);
		if (hidden) {
			current.add(type);
		} else {
			current.delete(type);
		}
		timeline.setGlobal({
			...timeline.global,
			hiddenEventTypes: Array.from(current)
		});
	};

	/**
	 * Spec §4: only what more than one section can interpret travels —
	 * `autoReadHidden` to timeline and sessions, the `liveChat` kind to
	 * sessions and requests. Everything else is per section by construction.
	 */
	const applyToOtherLists = (source: DisplayFilterSection) => {
		const from =
			source === 'timeline'
				? timeline.global
				: source === 'sessions'
					? sessions.global
					: requests.global;
		if (source !== 'requests') {
			if (source !== 'timeline') {
				timeline.setGlobal({
					...timeline.global,
					autoReadHidden: from.autoReadHidden
				});
			}
			if (source !== 'sessions') {
				sessions.setGlobal({
					...sessions.global,
					autoReadHidden: from.autoReadHidden
				});
			}
		}
		if (source !== 'timeline') {
			// An absent entry IS the default: the target's own customised
			// live-chat entry is removed, not left as it was.
			const liveChat = from.kinds.liveChat;
			const withLiveChat = (kinds: DisplayFilter['kinds']) => {
				const { liveChat: _dropped, ...rest } = kinds;
				return liveChat ? { ...rest, liveChat } : rest;
			};
			if (source !== 'sessions') {
				sessions.setGlobal({
					...sessions.global,
					kinds: withLiveChat(sessions.global.kinds)
				});
			}
			if (source !== 'requests') {
				requests.setGlobal({
					...requests.global,
					kinds: withLiveChat(requests.global.kinds)
				});
			}
		}
	};

	const renderSection = (
		section: DisplayFilterSection,
		kinds: DisplayFilterKindOption[],
		filter: ReturnType<typeof useDisplayFilter>,
		labels: ReturnType<typeof useDisplayFilterLabels>,
		showAutoRead: boolean
	) => {
		const sectionId = `${baseId}-${section}`;
		return (
			<section
				className="displayFilterProfile__section"
				aria-labelledby={`${sectionId}-title`}
				data-cy={`display-filter-profile-${section}`}
			>
				<h6
					className="displayFilterProfile__sectionTitle"
					id={`${sectionId}-title`}
				>
					{t(`notifications.displayFilter.sections.${section}`)}
				</h6>
				{filter.override !== null && (
					<p className="displayFilterProfile__hint" role="status">
						{t('notifications.displayFilter.overrideActive')}
					</p>
				)}
				<DisplayFilterKindTable
					kinds={kinds}
					value={filter.global}
					onChange={(next) =>
						writeGlobal(section, filter.global, next)
					}
					readOnly={readOnly}
					labels={labels.dialogLabels}
					idPrefix={sectionId}
					dataCyPrefix={`display-filter-profile-${section}`}
				/>
				{showAutoRead && (
					<div className="displayFilterDialog__autoRead">
						<div className="displayFilterDialog__autoReadText">
							<span
								className="displayFilterDialog__autoReadTitle"
								id={`${sectionId}-autoread`}
							>
								{labels.dialogLabels.autoRead}
							</span>
							<span
								className="displayFilterDialog__autoReadDescription"
								id={`${sectionId}-autoread-desc`}
							>
								{labels.dialogLabels.autoReadDescription}
							</span>
						</div>
						<Switch
							checked={filter.global.autoReadHidden}
							disabled={readOnly}
							aria-labelledby={`${sectionId}-autoread`}
							aria-describedby={`${sectionId}-autoread-desc`}
							data-cy={`display-filter-profile-${section}-autoread`}
							onChange={(checked) =>
								writeGlobal(section, filter.global, {
									kinds: filter.global.kinds,
									autoReadHidden: checked
								})
							}
						/>
					</div>
				)}
				<button
					type="button"
					className="displayFilterDialog__profileLink"
					disabled={readOnly}
					title={t(
						'notifications.displayFilter.applyToAllDescription'
					)}
					data-cy={`display-filter-profile-${section}-apply-all`}
					onClick={() => applyToOtherLists(section)}
				>
					{t('notifications.displayFilter.applyToAll')}
				</button>
			</section>
		);
	};

	return (
		<div className="displayFilterProfile" data-cy="display-filter-profile">
			<Headline
				text={t('notifications.displayFilter.profileTitle')}
				semanticLevel="5"
			/>
			<Text
				text={t('notifications.displayFilter.profileDescription')}
				type="standard"
				className="tertiary"
			/>
			{readOnly && (
				<p className="displayFilterDialog__readOnly" role="status">
					{timelineLabels.dialogLabels.readOnlyHint}
				</p>
			)}
			<div className="displayFilterProfile__sections">
				{renderSection(
					'timeline',
					timelineKinds,
					timeline,
					timelineLabels,
					true
				)}
				{renderSection(
					'sessions',
					sessionKinds,
					sessions,
					sessionsLabels,
					true
				)}
				{renderSection(
					'requests',
					requestKinds,
					requests,
					requestsLabels,
					false
				)}
			</div>

			<details
				className="displayFilterProfile__eventTypes"
				data-cy="display-filter-profile-event-types"
			>
				<summary className="displayFilterProfile__eventTypesSummary">
					{t('notifications.displayFilter.eventTypesTitle')}
				</summary>
				<p className="displayFilterProfile__hint">
					{t('notifications.displayFilter.eventTypesDescription')}
				</p>
				{eventTypesByFamily.map(({ kind, types }) => (
					<fieldset
						key={kind}
						className="displayFilterProfile__eventTypeGroup"
					>
						<legend className="displayFilterProfile__eventTypeGroupTitle">
							{timelineKindLabel(t, kind)}
						</legend>
						{types.map((type) => {
							const title = t(
								getEventDescriptor(type).titleTemplate
							);
							const hidden =
								timeline.global.hiddenEventTypes?.includes(
									type
								) === true;
							return (
								<div
									key={type}
									className="displayFilterProfile__eventType"
								>
									<M3Checkbox
										checked={!hidden}
										disabled={readOnly}
										label={t(
											'notifications.displayFilter.eventTypeShow',
											{ type: title }
										)}
										dataCy={`display-filter-event-type-${type}`}
										onChange={(checked) =>
											setEventTypeHidden(type, !checked)
										}
									/>
								</div>
							);
						})}
					</fieldset>
				))}
			</details>
		</div>
	);
};
