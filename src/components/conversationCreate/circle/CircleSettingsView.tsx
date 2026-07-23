import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PersonsIcon } from '../../../resources/img/icons/persons.svg';
import { ReactComponent as GroupIllustration } from '../../../resources/img/illustrations/active-createGroup.svg';
import { OrisoSelect } from '../../form/OrisoSelect';
import { OrisoTextField } from '../../form/OrisoTextField';
import {
	GroupChatSeriesFields,
	GroupChatSeriesFieldsValue
} from '../../groupChat/GroupChatSeriesFields';
import { GroupChatAuthorContentFields } from '../../groupChat/GroupChatAuthorContentFields';
import {
	GroupChatAuthorContentDraft,
	syncGroupChatAuthorContentLanguages
} from '../../groupChat/groupChatAuthorContent';
import {
	buildGroupChatSeriesRequest,
	getValidDateFormatForSelectedDate,
	getValidTimeFormatForSelectedTime,
	isGroupChatTopicLengthValid,
	TOPIC_LENGTHS
} from '../../groupChat/createChatHelpers';
import { FormatCard } from '../FormatCard';
import { M3SplitButton } from '../M3SplitButton';
import { InternalChatPerson } from '../internal/InternalChatCreateCard';
import { PersonChipGrid } from '../internal/PersonChipGrid';
import { PersonOption, PersonSelectMenu } from '../internal/PersonSelectMenu';
import { useCreateChatSubmit } from '../useCreateChatSubmit';
import {
	buildInitialAuthorContent,
	loadCircleDefaults,
	saveCircleDefaults
} from './circleDefaults';
import '../../groupChat/createChat.styles.scss';

/**
 * "Gesprächskreis Einstellungen" (Figma flow 8482-30552, second screen).
 * Configures welcome text, format, rules, intervals and language of the
 * moderated self-help circle. The last configuration of the agency is
 * offered as the default for the next circle; "Erstellen" stays disabled
 * until every needed config is made, then switches to the primary state.
 */

export interface CircleSettingsPrefill {
	topic?: string;
	startDate?: string;
	startTime?: string;
	duration?: number;
	repeatCount?: number;
	interval?: GroupChatSeriesFieldsValue['interval'];
	modality?: GroupChatSeriesFieldsValue['modality'];
	/** Edit mode: the persisted welcome text / rules to round-trip verbatim. */
	authorContent?: GroupChatAuthorContentDraft;
	/** Edit mode: the existing participants to preserve on update. */
	consultantIds?: string[];
	/** Edit mode: the agency the persisted series belongs to. */
	agencyId?: number | null;
}

interface CircleSettingsViewProps {
	agencyOptions: { value: string; label: string }[];
	selectedAgency: number | null;
	onAgencyChange: (agencyId: number) => void;
	activeLanguages: string[];
	translationAvailable: boolean;
	prefill?: CircleSettingsPrefill;
	topicOptions?: { value: string; label: string }[];
	people?: InternalChatPerson[];
	/**
	 * When set, the form updates this existing chat instead of creating one.
	 * The parent only mounts this view once the series has been loaded and the
	 * prefill built, so the useState initializers below hydrate every field.
	 */
	editChatId?: number | null;
}

const buildSeriesDefaults = (
	prefill?: CircleSettingsPrefill,
	stored?: ReturnType<typeof loadCircleDefaults>
): GroupChatSeriesFieldsValue => ({
	startDate:
		prefill?.startDate || getValidDateFormatForSelectedDate(new Date()),
	startTime:
		prefill?.startTime || getValidTimeFormatForSelectedTime(new Date()),
	duration: prefill?.duration ?? stored?.series.duration ?? 60,
	repeatCount: prefill?.repeatCount ?? stored?.series.repeatCount ?? 1,
	interval: prefill?.interval ?? stored?.series.interval ?? 'WEEKLY',
	modality: prefill?.modality ?? stored?.series.modality ?? 'TEXT'
});

export const CircleSettingsView = ({
	agencyOptions,
	selectedAgency,
	onAgencyChange,
	activeLanguages,
	translationAvailable,
	prefill,
	topicOptions,
	people = [],
	editChatId
}: CircleSettingsViewProps) => {
	const { t: translate } = useTranslation();
	const { submit, isSubmitting, hasError, clearError } =
		useCreateChatSubmit();
	const isEditMode = editChatId != null;
	const storedDefaults = useMemo(
		() => loadCircleDefaults(selectedAgency),
		[selectedAgency]
	);

	const [topic, setTopic] = useState(prefill?.topic || '');
	const [seriesFields, setSeriesFields] =
		useState<GroupChatSeriesFieldsValue>(() =>
			buildSeriesDefaults(prefill, storedDefaults)
		);
	const [authorContent, setAuthorContent] =
		useState<GroupChatAuthorContentDraft>(
			() =>
				prefill?.authorContent ||
				storedDefaults?.authorContent ||
				buildInitialAuthorContent(activeLanguages)
		);
	const [consultantIds, setConsultantIds] = useState<string[]>(
		() => prefill?.consultantIds ?? []
	);
	const [moderatorMenuOpen, setModeratorMenuOpen] = useState(false);
	const moderatorButtonRef = useRef<HTMLDivElement | null>(null);
	const peopleById = useMemo(
		() => new Map(people.map((person) => [person.id, person])),
		[people]
	);
	const moderatorOptions = useMemo<PersonOption[]>(() => {
		const vacatedSelected = consultantIds
			.filter((id) => !peopleById.has(id))
			.map((id) => ({ id, label: id, selected: true, vacated: true }));
		return [
			...vacatedSelected,
			...people.map((person) => ({
				id: person.id,
				label: person.label,
				selected: consultantIds.includes(person.id),
				vacated: person.vacated
			}))
		];
	}, [consultantIds, people, peopleById]);
	const moderatorChips = useMemo(
		() =>
			consultantIds.map((id) => ({
				id,
				label: peopleById.get(id)?.label ?? id
			})),
		[consultantIds, peopleById]
	);
	const toggleModerator = (id: string) =>
		setConsultantIds((current) =>
			current.includes(id)
				? current.filter((consultantId) => consultantId !== id)
				: [...current, id]
		);

	useEffect(() => {
		setAuthorContent((current) =>
			syncGroupChatAuthorContentLanguages(current, activeLanguages)
		);
	}, [activeLanguages]);

	// Re-sync the schedule and author content when the counsellor switches
	// agency, so the fields reflect the last saved configuration of the newly
	// selected agency (Figma: defaults are per agency). Skipped on the initial
	// render and in edit mode, where the loaded series owns the fields.
	const prevAgencyRef = useRef(selectedAgency);
	useEffect(() => {
		if (isEditMode) {
			return;
		}
		if (prevAgencyRef.current === selectedAgency) {
			return;
		}
		prevAgencyRef.current = selectedAgency;
		setSeriesFields(buildSeriesDefaults(prefill, storedDefaults));
		setAuthorContent(
			storedDefaults?.authorContent ||
				buildInitialAuthorContent(activeLanguages)
		);
	}, [isEditMode, selectedAgency, storedDefaults, prefill, activeLanguages]);

	const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

	const isTopicValid = isGroupChatTopicLengthValid(topic);
	const isReady =
		isTopicValid &&
		selectedAgency !== null &&
		!!seriesFields.startDate &&
		!!seriesFields.startTime &&
		seriesFields.repeatCount >= 1 &&
		seriesFields.repeatCount <= 365 &&
		!isSubmitting;

	const handleCreate = () => {
		if (!isReady || selectedAgency === null) {
			return;
		}
		submit(
			buildGroupChatSeriesRequest({
				topic: topic.trim(),
				agencyId: selectedAgency,
				startDate: seriesFields.startDate,
				startTime: seriesFields.startTime,
				duration: seriesFields.duration,
				repeatCount: seriesFields.repeatCount,
				chatInterval: seriesFields.interval,
				modality: seriesFields.modality,
				timezone,
				hintMessage:
					authorContent.hintMessageTranslations[
						authorContent.sourceLanguage
					] || '',
				sourceLanguage: authorContent.sourceLanguage,
				hintMessageTranslations: authorContent.hintMessageTranslations,
				groupChatRulesTranslations:
					authorContent.groupChatRulesTranslations,
				consultantIds
			}),
			{
				groupChatId: editChatId ?? undefined,
				onSuccess: () =>
					saveCircleDefaults(selectedAgency, {
						series: {
							duration: seriesFields.duration,
							repeatCount: seriesFields.repeatCount,
							interval: seriesFields.interval,
							modality: seriesFields.modality
						},
						authorContent
					})
			}
		);
	};

	return (
		<div className="circleSettings">
			<div className="circleSettings__intro">
				<h2 className="circleSettings__title">
					{translate('groupChat.circle.settingsTitle')}
				</h2>
				<p className="circleSettings__subtitle">
					{translate('groupChat.circle.settingsSubtitle')}
				</p>
			</div>
			<div className="circleSettings__columns">
				<FormatCard
					className="circleSettings__card"
					title={translate('groupChat.circle.title')}
					subtitle={translate('groupChat.circle.subtitle')}
					avatar={<PersonsIcon />}
					media={<GroupIllustration />}
				>
					{topicOptions?.length ? (
						<OrisoSelect
							id="circleTopic"
							label={translate('groupChat.circle.topicLabel')}
							options={topicOptions}
							value={topic}
							onChange={(event) => setTopic(event.target.value)}
						/>
					) : (
						<OrisoTextField
							id="circleTopic"
							label={translate('groupChat.circle.topicLabel')}
							value={topic}
							fullWidth
							inputProps={{ maxLength: TOPIC_LENGTHS.MAX }}
							onChange={(event) => setTopic(event.target.value)}
						/>
					)}
					{agencyOptions.length > 1 && (
						<OrisoSelect
							id="circleAgency"
							label={translate(
								'groupChat.create.agencySelect.label'
							)}
							options={agencyOptions}
							value={selectedAgency?.toString() || ''}
							onChange={(event) =>
								onAgencyChange(parseInt(event.target.value))
							}
						/>
					)}
					<GroupChatSeriesFields
						value={seriesFields}
						onChange={setSeriesFields}
					/>
					<div className="circleSettings__moderators">
						<p>{translate('groupChat.circle.moderatorsLabel')}</p>
						<PersonChipGrid
							entries={moderatorChips}
							onRemove={toggleModerator}
							removeLabel={(label) =>
								translate('groupChat.circle.removeModerator', {
									name: label
								})
							}
						/>
						<div className="circleSettings__moderatorPicker">
							<M3SplitButton
								ref={moderatorButtonRef}
								id="circleModeratorButton"
								label={
									consultantIds.length > 0
										? translate(
												'groupChat.circle.moderatorCount',
												{ count: consultantIds.length }
											)
										: translate(
												'groupChat.circle.addModerator'
											)
								}
								selected={consultantIds.length > 0}
								open={moderatorMenuOpen}
								onLeadingClick={() =>
									setModeratorMenuOpen((current) => !current)
								}
								onTrailingClick={() =>
									setModeratorMenuOpen((current) => !current)
								}
								trailingAriaLabel={translate(
									'groupChat.circle.toggleModeratorList'
								)}
							/>
							{moderatorMenuOpen && (
								<PersonSelectMenu
									options={moderatorOptions}
									onToggle={toggleModerator}
									anchorRef={moderatorButtonRef}
									onClose={() => setModeratorMenuOpen(false)}
									labelledBy="circleModeratorButton"
									toggleLabel={(label, selected) =>
										translate(
											selected
												? 'groupChat.circle.deselectModerator'
												: 'groupChat.circle.selectModerator',
											{ name: label }
										)
									}
								/>
							)}
						</div>
					</div>
				</FormatCard>
				<div className="circleSettings__authorColumn">
					<GroupChatAuthorContentFields
						activeLanguages={activeLanguages}
						value={authorContent}
						onChange={setAuthorContent}
						translationAvailable={translationAvailable}
					/>
					{hasError && (
						<p role="alert" className="circleSettings__error">
							{translate(
								'groupChat.createError.overlay.headline'
							)}
							<button type="button" onClick={clearError}>
								{translate(
									'groupChat.createError.overlay.buttonLabel'
								)}
							</button>
						</p>
					)}
					<button
						type="button"
						className={`circleSettings__createButton${
							isReady
								? ' circleSettings__createButton--primary'
								: ''
						}`}
						disabled={!isReady}
						onClick={handleCreate}
					>
						{translate(
							isEditMode
								? 'groupChat.circle.saveLabel'
								: 'groupChat.circle.createLabel'
						)}
					</button>
				</div>
			</div>
		</div>
	);
};
