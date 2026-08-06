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
		internal: settings.featureInternalGroupChatEnabled ?? groupChatEnabled,
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

export type CreateStep = 'picker' | 'internal' | 'circle';

/**
 * Which step the create flow opens on. A duplicate occurrence only forces the
 * circle settings when the circle format is actually available for the agency —
 * otherwise a disabled format would render an empty settings screen. With a
 * single available format the picker is skipped; otherwise the picker shows.
 */
export const resolveInitialStep = (
	availability: ConversationFormatAvailability,
	availableFormats: ConversationFormat[],
	hasDuplicateOccurrence: boolean
): CreateStep => {
	if (hasDuplicateOccurrence && availability.circle) {
		return 'circle';
	}
	if (availableFormats.length === 1) {
		return availableFormats[0] === 'internal' ? 'internal' : 'circle';
	}
	return 'picker';
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
