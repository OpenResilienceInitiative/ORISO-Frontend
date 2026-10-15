/**
 * The E-Mail column of the display-filter dialog (FE#1377 redesign): which
 * stored e-mail switch of the profile stands behind a kind. Resolved through
 * the profile's own switch lists, so a kind can only point at a setting that
 * the profile page also shows and saves — one source of truth, no new fields.
 * A kind without a clearly matching switch gets `null` ("nicht verfügbar").
 */
import {
	ADVICE_SEEKER_SWITCHES,
	CONSULTANT_SWITCHES,
	NotificationSwitch
} from '../profile/EmailNotifications/notificationMatrix';
import type { DisplayFilterSection } from '../../utils/displayFilter/model';

export type EmailSettingRole = 'consultant' | 'asker';

/** Kind id → profile switch id, per section. Unlisted kinds have no e-mail. */
const SWITCH_BY_KIND: Record<
	DisplayFilterSection,
	Partial<Record<string, string>>
> = {
	sessions: {
		// Messages from advice seekers in a counselling conversation.
		oneToOne: 'newMessage',
		appointments: 'appointment'
		// liveChat, internalGroup, circle, supervision, other: no stored
		// switch (internalChatNotificationEnabled is not in this API yet).
	},
	requests: {
		nearby: 'newEnquiry'
	},
	timeline: {
		requests: 'newEnquiry',
		messages: 'newMessage',
		handover: 'reassignment',
		system: 'serviceNotice',
		appointments: 'appointment'
	}
};

export const emailSettingForKind = (
	section: DisplayFilterSection,
	kindId: string,
	role: EmailSettingRole
): NotificationSwitch | null => {
	const switchId = SWITCH_BY_KIND[section][kindId];
	if (!switchId) return null;
	const switches =
		role === 'consultant' ? CONSULTANT_SWITCHES : ADVICE_SEEKER_SWITCHES;
	return switches.find((entry) => entry.id === switchId) ?? null;
};
