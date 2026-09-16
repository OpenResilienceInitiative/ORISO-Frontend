import { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';
import { AgencySettingsInterface } from '../../globalState/interfaces/UserDataInterface';

/**
 * Which conversation formats a counsellor may create (Figma flow 8482-30552):
 * the create entry and the format picker are gated by what the Träger admins
 * enabled for the agency. If only one format is available the picker screen
 * is skipped; if none is available the create entry is hidden entirely.
 *
 * featureGroupChatV2Enabled is the master switch: false turns both formats
 * off. Each format also has its own flag (featureInternalGroupChatEnabled,
 * featureSelfHelpGroupsEnabled) that refines an enabled v2; where one is
 * missing it follows the master switch. A Beratungsstelle can only restrict
 * what the Träger allows (#1440).
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
 * effective values, i.e. Träger AND Beratungsstelle combined. A missing or
 * `null` value means "this agency adds no restriction".
 */
export type AgencyFormatSettings = AgencySettingsInterface;

/** One of the counsellor's agencies; `settings` is absent until loaded. */
export interface AgencyFormatSource {
	id: number;
	settings?: AgencyFormatSettings | null;
}

const FORMAT_FLAG: Record<
	ConversationFormat,
	'featureInternalGroupChatEnabled' | 'featureSelfHelpGroupsEnabled'
> = {
	internal: 'featureInternalGroupChatEnabled',
	circle: 'featureSelfHelpGroupsEnabled'
};

// Master switch on every level: featureGroupChatV2Enabled === false turns
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

// Same master switch for the agency; below it the per-format flag, and a
// missing or null value means "no restriction" — an agency whose values are
// not known yet never hides a format the Träger allows.
const agencyAllows = (
	agency: AgencyFormatSource,
	format: ConversationFormat
): boolean =>
	agency.settings?.featureGroupChatV2Enabled === false
		? false
		: (agency.settings?.[FORMAT_FLAG[format]] ?? true);

/**
 * The agencies of the counsellor that offer `format`: the Träger must allow
 * it, and the agency must not have switched it off. Used to narrow the
 * agency choice inside a format's create screen.
 */
export const getAgenciesOfferingFormat = (
	tenant: { settings?: FormatSettings } | null | undefined,
	agencies: AgencyFormatSource[],
	format: ConversationFormat
): number[] =>
	tenantAvailability(tenant)[format]
		? agencies
				.filter((agency) => agencyAllows(agency, format))
				.map((agency) => agency.id)
		: [];

/**
 * A format is offered when the Träger allows it AND at least one of the
 * counsellor's agencies allows it. With `targetAgencyId` only that agency
 * counts (a chat created for one specific Beratungsstelle). Without any known
 * agency the Träger's answer stands.
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
		tenantResult[format] &&
		(relevant.length === 0 ||
			relevant.some((agency) => agencyAllows(agency, format)));
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
