import {
	readConversationPolicyValue,
	resolveConversationFeatureSettings
} from '../../utils/conversationFeatureSettings';
import { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';
import { AgencySettingsInterface } from '../../globalState/interfaces/UserDataInterface';

/**
 * Which conversation formats a counsellor may create (Figma flow 8482-30552):
 * the create entry and the format picker are gated by what the Träger admins
 * enabled for the agency. If only one format is available the picker screen
 * is skipped; if none is available the create entry is hidden entirely.
 *
 * Canonical agency policies already resolve the parent recommendation or
 * enforcement. Explicit Internal/SelfHelp policies outrank the legacy V2
 * transition fallback. Flat-only legacy responses keep their old hard caps.
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

/**
 * The group-chat settings of one Beratungsstelle, as the public agency
 * response (`GET /service/agencies/{ids}`) delivers them: already the
 * canonical policy values, or the older flat restriction-only projection.
 * A valid legacy response may omit settings; an unavailable response is distinct.
 */
export type AgencyFormatSettings = AgencySettingsInterface;

/** One of the counsellor's agencies; `settings` is absent until loaded. */
export interface AgencyFormatSource {
	id: number;
	settings?: AgencyFormatSettings | null;
	unavailable?: boolean;
}

// Legacy fallback master switch: featureGroupChatV2Enabled === false turns
// both formats off whatever the format flags say; the format flags only
// refine an enabled v2.
const tenantAvailability = (
	tenant?: { settings?: FormatSettings } | null
): ConversationFormatAvailability => {
	const settings = settingsOf(tenant);
	if (settings.featureGroupChatV2Enabled === false) {
		return { internal: false, circle: false };
	}
	const groupChatEnabled = settings.featureGroupChatV2Enabled === true;
	return {
		internal: settings.featureInternalGroupChatEnabled ?? groupChatEnabled,
		circle: settings.featureSelfHelpGroupsEnabled ?? groupChatEnabled
	};
};

// Canonical policies are resolved by the server. Confirmed legacy responses
// retain tenant hard caps; unavailable authority closes both formats.
const effectiveAvailability = (
	tenant: { settings?: FormatSettings } | null | undefined,
	agency: AgencyFormatSource
): ConversationFormatAvailability => {
	if (agency.unavailable) return { internal: false, circle: false };
	const policies = agency.settings?.permissionPolicies;
	if (policies != null) {
		if (typeof policies !== 'object' || Array.isArray(policies))
			return { internal: false, circle: false };
		// Explicit modern formats outrank the V2 transition fallback.
		const allowed = (
			key:
				| 'featureInternalGroupChatEnabled'
				| 'featureSelfHelpGroupsEnabled'
		) => {
			const policy = Object.prototype.hasOwnProperty.call(policies, key)
				? policies[key]
				: policies.featureGroupChatV2Enabled;
			return readConversationPolicyValue(policy) === true;
		};
		return {
			internal: allowed('featureInternalGroupChatEnabled'),
			circle: allowed('featureSelfHelpGroupsEnabled')
		};
	}
	return tenantAvailability({
		settings: resolveConversationFeatureSettings(
			settingsOf(tenant),
			agency.settings
		)
	});
};

/**
 * The agencies whose effective policy offers `format`. Used to narrow the
 * agency choice inside a format's create screen.
 */
export const getAgenciesOfferingFormat = (
	tenant: { settings?: FormatSettings } | null | undefined,
	agencies: AgencyFormatSource[],
	format: ConversationFormat
): number[] =>
	agencies
		.filter((agency) => effectiveAvailability(tenant, agency)[format])
		.map((agency) => agency.id);

/**
 * A format is offered when at least one counsellor agency's resolved policy
 * allows it. With `targetAgencyId` only that agency
 * counts (a chat created for one specific Beratungsstelle). A target that is
 * not in `agencies` offers nothing. Without any known agency the Träger's
 * answer stands.
 */
export const getConversationFormatAvailability = (
	tenant?: { settings?: FormatSettings } | null,
	agencies: AgencyFormatSource[] = [],
	targetAgencyId?: number | null
): ConversationFormatAvailability => {
	const tenantResult = tenantAvailability(tenant);
	const relevant =
		targetAgencyId == null
			? agencies
			: agencies.filter((agency) => agency.id === targetAgencyId);
	const offered = (format: ConversationFormat) =>
		agencies.length === 0
			? tenantResult[format]
			: relevant.some(
					(agency) => effectiveAvailability(tenant, agency)[format]
				);
	return {
		internal: offered('internal'),
		circle: offered('circle')
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
