import { useContext, useSyncExternalStore } from 'react';
import { ActiveSessionContext } from '../globalState';
import type { TenantDataSettingsInterface } from '../globalState/interfaces/TenantDataInterface';
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
	if (!policy) return resolveConversationFeatureSettings(tenant);
	const isCurrent =
		policy.agencyId ===
			resolveConversationAgencyId(context?.activeSession?.item) &&
		(policy.tenantId === undefined || policy.tenantId === tenantId);
	if (!isCurrent || policy.state !== 'ready') {
		return resolveConversationFeatureSettings(tenant, {
			permissionPolicies: {}
		});
	}
	return resolveConversationFeatureSettings(tenant, policy.settings);
};
