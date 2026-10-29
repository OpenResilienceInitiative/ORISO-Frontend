import { isPracticeId, isPracticeRoomId } from '../practice/practiceIds';
import type { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';
import type { AgencySettingsInterface } from '../globalState/interfaces/UserDataInterface';
import {
	CONVERSATION_FEATURE_KEYS,
	type ConversationFeatureSettings
} from '../globalState/interfaces/ConversationFeatureSettings';

/** Invalid wire entries are not authority, even when their value happens to be true. */
export const readConversationPolicyValue = (
	policy: unknown
): boolean | undefined => {
	if (
		!policy ||
		typeof policy !== 'object' ||
		!('value' in policy) ||
		!('mode' in policy)
	)
		return undefined;
	return typeof policy.value === 'boolean' &&
		(policy.mode === 'ENFORCED' || policy.mode === 'SUGGESTED')
		? policy.value
		: undefined;
};

/** Agency policy values are already resolved by the server; never AND them with the parent again. */
export const resolveConversationFeatureSettings = (
	tenant: Partial<TenantDataSettingsInterface> | undefined,
	agency?: AgencySettingsInterface | null
): Partial<TenantDataSettingsInterface> & ConversationFeatureSettings => {
	const result: Partial<TenantDataSettingsInterface> &
		ConversationFeatureSettings = { ...tenant };
	for (const key of CONVERSATION_FEATURE_KEYS) {
		if (agency?.permissionPolicies != null) {
			// A present canonical map cannot silently fall back to raw values.
			const policy = Object.prototype.hasOwnProperty.call(
				agency.permissionPolicies,
				key
			)
				? agency.permissionPolicies[key]
				: undefined;
			result[key] = readConversationPolicyValue(policy) ?? false;
		} else {
			// Legacy flat responses were restrictions, never permission to lift a parent cap.
			const own = agency?.[key];
			if (result[key] === false || own === false) result[key] = false;
			else if (own === true) result[key] = true;
		}
	}
	return result;
};

/** Stored group ownership is exactly one ChatAgency relation, exposed as assignedAgencies. */
export const resolveConversationAgencyId = (
	item:
		| {
				agencyId?: number;
				matrixRoomId?: string;
				assignedAgencies?: ReadonlyArray<{ id?: number }>;
		  }
		| undefined
): number | undefined => {
	// Reserved practice IDs are valid only inside a reserved practice room.
	// They still require a matching response from the sandbox's fake REST API.
	const validId = (id: number | undefined) =>
		Number.isSafeInteger(id) &&
		(id > 0 || (isPracticeRoomId(item?.matrixRoomId) && isPracticeId(id)));
	if (validId(item?.agencyId)) return item.agencyId;
	const assignments = item?.assignedAgencies;
	if (assignments?.length !== 1) return undefined;
	const id = assignments[0]?.id;
	return validId(id) ? id : undefined;
};
