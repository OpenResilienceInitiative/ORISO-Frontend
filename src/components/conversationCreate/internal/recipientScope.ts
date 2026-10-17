import type { Consultant } from '../../../api/apiGetAgencyConsultantList';

/**
 * Who a counsellor may pick for an internal chat (Functionality Access
 * setting `internalGroupChat.recipientScope`, ORISO-TenantService#321):
 * the counselling centre only, the whole Träger, or the whole platform.
 */
export type InternalChatRecipientScope = 'AGENCY' | 'TENANT' | 'PLATFORM';

const SCOPES: readonly InternalChatRecipientScope[] = [
	'AGENCY',
	'TENANT',
	'PLATFORM'
];

interface TenantWithRecipientScope {
	internalGroupChat?: { recipientScope?: { value?: unknown } | null } | null;
}

/**
 * The scope from the public tenant payload. A backend without the setting,
 * an empty setting or an unknown value reads as the narrowest scope (the
 * counselling centre), which is also what the UserService assumes.
 */
export const resolveRecipientScope = (
	tenant?: TenantWithRecipientScope | null
): InternalChatRecipientScope => {
	const value = tenant?.internalGroupChat?.recipientScope?.value;
	return SCOPES.find((scope) => scope === value) ?? 'AGENCY';
};

interface ScopeFilterInput {
	scope: InternalChatRecipientScope;
	colleagues: Consultant[];
	/** The counselling centre the chat is created for. */
	agencyId: number | null;
}

/**
 * Narrows a colleague directory to what the scope allows. The UserService
 * enforces the same rule and refuses anything else with a clear reason; this
 * keeps the picker from offering people it would refuse.
 *
 * - AGENCY: colleagues known to belong only to other centres are dropped. A
 *   colleague whose centres are not delivered is kept: nothing guarantees the
 *   directory fills them, and an empty picker would be worse than a clearly
 *   worded refusal.
 * - TENANT / PLATFORM: the directory as delivered. The directory the
 *   Frontend can read is the Träger's; a platform-wide directory does not
 *   exist yet, so PLATFORM lists the same people as TENANT for now.
 */
export const filterColleaguesForScope = ({
	scope,
	colleagues,
	agencyId
}: ScopeFilterInput): Consultant[] => {
	if (scope !== 'AGENCY') {
		return colleagues;
	}
	if (agencyId === null) {
		return [];
	}
	return colleagues.filter(
		(colleague) =>
			!colleague.agencies?.length ||
			colleague.agencies.some((agency) => agency.id === agencyId)
	);
};
