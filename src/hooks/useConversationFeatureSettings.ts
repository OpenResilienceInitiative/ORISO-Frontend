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
		return resolveConversationFeatureSettings(tenant, {
			permissionPolicies: {}
		});
	}
	return resolveConversationFeatureSettings(tenant, policy.settings);
};
