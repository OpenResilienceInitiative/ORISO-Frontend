import { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';

/**
 * Which conversation formats a counsellor may create (Figma flow 8482-30552):
 * the create entry and the format picker are gated by what the Träger admins
 * enabled for the agency. If only one format is available the picker screen
 * is skipped; if none is available the create entry is hidden entirely.
 *
 * Dedicated per-format admin flags do not exist in the tenant settings yet —
 * until the backend adds them, both formats fall back to the existing
 * featureGroupChatV2Enabled flag so behaviour matches today's gate.
 */

type FormatSettings = Partial<TenantDataSettingsInterface> & {
	featureInternalGroupChatEnabled?: boolean;
	featureSelfHelpGroupsEnabled?: boolean;
	featureGroupChatTranslationEnabled?: boolean;
};

export interface ConversationFormatAvailability {
	internal: boolean;
	circle: boolean;
}

export type ConversationFormat = 'internal' | 'circle';

const settingsOf = (
	tenant?: { settings?: FormatSettings } | null
): FormatSettings => tenant?.settings ?? {};

export const getConversationFormatAvailability = (
	tenant?: { settings?: FormatSettings } | null
): ConversationFormatAvailability => {
	const settings = settingsOf(tenant);
	const groupChatEnabled = settings.featureGroupChatV2Enabled === true;
	return {
		internal:
			settings.featureInternalGroupChatEnabled ?? groupChatEnabled,
		circle: settings.featureSelfHelpGroupsEnabled ?? groupChatEnabled
	};
};

export const getAvailableFormats = (
	availability: ConversationFormatAvailability
): ConversationFormat[] => {
	const formats: ConversationFormat[] = [];
	if (availability.internal) {
		formats.push('internal');
	}
	if (availability.circle) {
		formats.push('circle');
	}
	return formats;
};

/**
 * The translate action is hidden when no translation API key is configured
 * in the background (Figma annotation). No dedicated tenant flag exists yet;
 * defaults to available so current behaviour is unchanged until the backend
 * exposes the signal.
 */
export const isGroupChatTranslationAvailable = (
	tenant?: { settings?: FormatSettings } | null
): boolean => settingsOf(tenant).featureGroupChatTranslationEnabled ?? true;
