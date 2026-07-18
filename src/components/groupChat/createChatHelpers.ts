import { groupChatSettings } from '../../api/apiGroupChatSettings';

export type GroupChatInterval = NonNullable<groupChatSettings['chatInterval']>;
export type GroupChatModality = NonNullable<groupChatSettings['modality']>;

export interface GroupChatSeriesFormValue {
	topic: string;
	agencyId: number;
	startDate: string;
	startTime: string;
	duration: number;
	repeatCount: number;
	chatInterval: GroupChatInterval;
	modality: GroupChatModality;
	timezone: string;
	hintMessage: string;
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
	consultantIds: string[];
}

export const isGroupChatFeatureEnabled = (
	tenant?: {
		settings?: { featureGroupChatV2Enabled?: boolean };
	} | null
) => tenant?.settings?.featureGroupChatV2Enabled === true;

export const buildGroupChatSeriesRequest = ({
	repeatCount,
	chatInterval,
	groupChatRulesTranslations,
	...form
}: GroupChatSeriesFormValue): groupChatSettings => {
	const normalizedRules = groupChatRulesTranslations
		? Object.fromEntries(
				Object.entries(groupChatRulesTranslations).flatMap(
					([language, rules]) => {
						const normalized = rules
							.map((rule) => rule.trim())
							.filter(Boolean);
						return normalized.length
							? [[language, normalized]]
							: [];
					}
				)
			)
		: undefined;

	return {
		...form,
		...(normalizedRules && Object.keys(normalizedRules).length
			? { groupChatRulesTranslations: normalizedRules }
			: {}),
		repetitive: repeatCount > 1,
		repeatCount,
		...(repeatCount > 1 ? { chatInterval } : {}),
		featureGroupChatV2Enabled: true
	};
};

export const buildOneOffDuplicateFields = ({
	topic,
	start,
	duration,
	modality
}: {
	topic: string;
	start: string;
	duration: number;
	modality: GroupChatModality;
}) => {
	const plannedStart = new Date(start);
	if (Number.isNaN(plannedStart.getTime())) {
		throw new Error('A valid occurrence start is required for duplication');
	}
	return {
		topic,
		startDate: getValidDateFormatForSelectedDate(plannedStart),
		startTime: getValidTimeFormatForSelectedTime(plannedStart),
		duration,
		repeatCount: 1,
		interval: 'WEEKLY' as GroupChatInterval,
		modality
	};
};

export const TOPIC_LENGTHS = {
	MIN: 3,
	MAX: 50
};

/**
 * A chat name / topic is valid once it is at least MIN and at most MAX
 * characters long (trimmed). The upper bound is inclusive so a name that
 * hits the exact maxLength of the input is accepted rather than rejected.
 */
export const isGroupChatTopicLengthValid = (value: string): boolean => {
	const length = value.trim().length;
	return length >= TOPIC_LENGTHS.MIN && length <= TOPIC_LENGTHS.MAX;
};

export const durationSelectOptionsSet = [
	{
		value: '30',
		label: 'groupChat.create.durationSelect.option1'
	},
	{
		value: '60',
		label: 'groupChat.create.durationSelect.option2'
	},
	{
		value: '90',
		label: 'groupChat.create.durationSelect.option3'
	},
	{
		value: '120',
		label: 'groupChat.create.durationSelect.option4'
	},
	{
		value: '150',
		label: 'groupChat.create.durationSelect.option5'
	},
	{
		value: '180',
		label: 'groupChat.create.durationSelect.option6'
	}
];

const getTwoDigitFormat = (value: number) => {
	return ('0' + value).slice(-2);
};

export const getValidDateFormatForSelectedDate = (selectedDate): string => {
	return `${selectedDate.getFullYear()}-${getTwoDigitFormat(
		selectedDate.getMonth() + 1
	)}-${getTwoDigitFormat(selectedDate.getDate())}`;
};

export const getValidTimeFormatForSelectedTime = (selectedTime): string => {
	return `${getTwoDigitFormat(selectedTime.getHours())}:${getTwoDigitFormat(
		selectedTime.getMinutes()
	)}`;
};

/**
 * The subset of a group-chat session item (GroupChatItemInterface) needed to
 * pre-fill the edit form. Typed structurally so the mapper stays a pure,
 * trivially testable leaf util.
 */
export interface GroupChatEditSource {
	topic: string;
	duration: number;
	startDate: string;
	startTime?: string;
	startDateWithTime?: string;
	repetitive?: boolean;
	repeatCount?: number;
	chatInterval?: GroupChatInterval;
	modality?: GroupChatModality;
	hintMessage?: string;
	sourceLanguage?: string;
	hintMessageTranslations?: Record<string, string>;
	groupChatRulesTranslations?: Record<string, string[]>;
	participants?: { consultantId: string }[];
	assignedAgencies?: { id: number }[];
}

export interface GroupChatEditDraft {
	topic: string;
	agencyId: number | null;
	seriesFields: {
		startDate: string;
		startTime: string;
		duration: number;
		repeatCount: number;
		interval: GroupChatInterval;
		modality: GroupChatModality;
	};
	authorContent: {
		sourceLanguage: string;
		hintMessageTranslations: Record<string, string>;
		groupChatRulesTranslations: Record<string, string[]>;
	};
	consultantIds: string[];
}

/**
 * Turn a persisted group-chat series item into a fully-populated edit draft.
 *
 * The whole point is loss-free round-tripping: `updateChat` on the backend
 * rewrites topic, schedule AND author content (hintMessage + translations +
 * rules) from the submitted payload, so a schedule-only edit must resubmit the
 * existing content verbatim. Every field is therefore carried over; absent
 * translations fall back to a single-language map seeded from `hintMessage`.
 */
export const buildGroupChatEditDraft = (
	source: GroupChatEditSource,
	fallbackLanguage = 'de'
): GroupChatEditDraft => {
	const startSource = source.startDateWithTime || source.startDate;
	const start = new Date(startSource);
	if (Number.isNaN(start.getTime())) {
		throw new Error(
			'A valid series start is required to edit the schedule'
		);
	}

	const repeatCount =
		source.repeatCount && source.repeatCount > 0 ? source.repeatCount : 1;
	const sourceLanguage = source.sourceLanguage || fallbackLanguage;
	const hintMessageTranslations =
		source.hintMessageTranslations &&
		Object.keys(source.hintMessageTranslations).length
			? source.hintMessageTranslations
			: { [sourceLanguage]: source.hintMessage || '' };
	const groupChatRulesTranslations =
		source.groupChatRulesTranslations &&
		Object.keys(source.groupChatRulesTranslations).length
			? source.groupChatRulesTranslations
			: { [sourceLanguage]: [''] };

	return {
		topic: source.topic,
		agencyId: source.assignedAgencies?.[0]?.id ?? null,
		seriesFields: {
			startDate: getValidDateFormatForSelectedDate(start),
			startTime: getValidTimeFormatForSelectedTime(start),
			duration: source.duration,
			repeatCount,
			interval: source.chatInterval || 'WEEKLY',
			modality: source.modality || 'TEXT'
		},
		authorContent: {
			sourceLanguage,
			hintMessageTranslations,
			groupChatRulesTranslations
		},
		consultantIds: (source.participants || []).map(
			(participant) => participant.consultantId
		)
	};
};
