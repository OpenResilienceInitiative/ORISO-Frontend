import { GroupChatInterval } from './createChatHelpers';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface GroupChatRepeatSource {
	repeatCount?: number | null;
	chatInterval?: GroupChatInterval | null;
	repetitive?: boolean | null;
}

/** The interval's name, e.g. "Wöchentlich" — one key for every surface. */
export const getGroupChatIntervalLabel = (
	interval: GroupChatInterval,
	translate: Translate
): string =>
	translate(`groupChat.create.interval.options.${interval.toLowerCase()}`);

/**
 * One wording for "how often" in Chat-Info and the share dialog, e.g.
 * "3 Termine, Alle zwei Wochen" or "einmalig".
 */
export const getGroupChatRepeatLabel = (
	source: GroupChatRepeatSource,
	translate: Translate
): string => {
	const repeatCount = source.repeatCount ?? 0;
	if (repeatCount > 1 && source.chatInterval) {
		return translate('groupChat.shareDialog.repeatValue', {
			count: repeatCount,
			interval: getGroupChatIntervalLabel(source.chatInterval, translate)
		});
	}
	// Legacy chats only carry `repetitive`, and those always ran weekly.
	if (source.repetitive && !source.chatInterval) {
		return translate('groupChat.info.settings.repetition.weekly');
	}
	return translate('groupChat.info.settings.repetition.single');
};
