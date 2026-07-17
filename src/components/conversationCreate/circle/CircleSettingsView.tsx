import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
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
	TOPIC_LENGTHS
} from '../../groupChat/createChatHelpers';
import { FormatCard } from '../FormatCard';
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
}

interface CircleSettingsViewProps {
	agencyOptions: { value: string; label: string }[];
	selectedAgency: number | null;
	onAgencyChange: (agencyId: number) => void;
	activeLanguages: string[];
	translationAvailable: boolean;
	prefill?: CircleSettingsPrefill;
	topicOptions?: { value: string; label: string }[];
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
	topicOptions
}: CircleSettingsViewProps) => {
	const { t: translate } = useTranslation();
	const { submit, isSubmitting, hasError, clearError } =
		useCreateChatSubmit();
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
				storedDefaults?.authorContent ||
				buildInitialAuthorContent(activeLanguages)
		);
	useEffect(() => {
		setAuthorContent((current) =>
			syncGroupChatAuthorContentLanguages(current, activeLanguages)
		);
	}, [activeLanguages]);

	const timezone =
		Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

	const isTopicValid =
		topic.trim().length >= TOPIC_LENGTHS.MIN &&
		topic.trim().length < TOPIC_LENGTHS.MAX;
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
				hintMessageTranslations:
					authorContent.hintMessageTranslations,
				groupChatRulesTranslations:
					authorContent.groupChatRulesTranslations,
				consultantIds: []
			}),
			{
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
						{translate('groupChat.circle.createLabel')}
					</button>
				</div>
			</div>
		</div>
	);
};
