import { useContext, useSyncExternalStore } from 'react';
import { ActiveSessionContext } from '../globalState';
import type { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';
import type { AgencyConversationPolicy } from '../globalState/interfaces/ConversationFeatureSettings';
import {
	resolveConversationAgencyId,
	resolveConversationFeatureSettings
} from '../utils/conversationFeatureSettings';
import {
	getAuthenticatedTenantId,
	subscribeToAuthenticatedTenant
} from '../utils/authenticatedTenant';

/** Read the open session's authority once; individual message rows never fetch settings. */
export const useConversationFeatureSettings = (
	tenant: Partial<TenantDataSettingsInterface> | undefined
) => {
	const context = useContext(ActiveSessionContext);
	const policy = context?.agencyFeaturePolicy;
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	return resolveFeaturesForAgencyPolicy(
		tenant,
		policy,
		resolveConversationAgencyId(context?.activeSession?.item),
		tenantId
	);
};

/**
 * Whether the open conversation's agency has answered (or failed): until
 * then its features read as off although they may be on. A request to
 * start a call waits for this instead of reading "off" as a refusal
 * (FE#1050).
 */
export const useConversationFeatureSettingsSettled = () => {
	const context = useContext(ActiveSessionContext);
	const policy = context?.agencyFeaturePolicy;
	const tenantId = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedTenantId
	);
	if (!policy) return true;
	if (policy.state === 'loading') return false;
	// Without an agency the answer is final ("unavailable"); one for
	// another agency or Träger is about to be replaced.
	if (policy.agencyId === null) return true;
	return (
		policy.agencyId ===
			resolveConversationAgencyId(context?.activeSession?.item) &&
		(policy.tenantId === undefined || policy.tenantId === tenantId)
	);
};

/** Pure core of the hook: a stale, loading or failed agency answer grants nothing. */
export const resolveFeaturesForAgencyPolicy = (
	tenant: Partial<TenantDataSettingsInterface> | undefined,
	policy: AgencyConversationPolicy | undefined,
	currentAgencyId: number | undefined,
	tenantId: unknown
) => {
	if (!policy) return resolveConversationFeatureSettings(tenant);
	const isCurrent =
		policy.agencyId === currentAgencyId &&
		(policy.tenantId === undefined || policy.tenantId === tenantId);
	if (!isCurrent || policy.state !== 'ready') {
		// No agency answer yet (or not for this agency): grant nothing. The
		// empty map would otherwise read the unset team-chat policy as on.
		return {
			...resolveConversationFeatureSettings(tenant, {
				permissionPolicies: {}
			}),
			featureTeamDiscussionEnabled: false
		};
	}
	return resolveConversationFeatureSettings(tenant, policy.settings);
};
