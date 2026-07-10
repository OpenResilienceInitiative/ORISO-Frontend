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
	...form
}: GroupChatSeriesFormValue): groupChatSettings => ({
	...form,
	repetitive: repeatCount > 1,
	repeatCount,
	...(repeatCount > 1 ? { chatInterval } : {}),
	featureGroupChatV2Enabled: true
});

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
