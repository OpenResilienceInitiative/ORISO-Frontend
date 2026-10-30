export interface AppSettingsInterface {
	/**
	 * FE#1876, platform-wide (GET /service/settings): how the request dialog
	 * prefills the postcode. Missing means SMART.
	 */
	furtherCounsellingPostcodeMode?: 'SMART' | 'ALWAYS_EMPTY' | string;
	/** FE#1876: same-topic handling. Shown only; no client logic in v1. */
	topicDuplicateMode?: string;
	/** Feature flag to enable SSO on budibase */
	budibaseSSO?: boolean;
	/** App setting to get calendar link */
	calendarAppUrl?: string;
	/** App setting to get the link for tools service */
	budibaseUrl?: string;
	/** App setting to get the link for appointment service */
	calcomUrl?: string;
	/** Feature flag to enable walkthrough (false by default here & true in the theme repo) */
	enableWalkthrough?: boolean;
	/** Feature flag to enable the multi tenancy with a single domain ex: lands */
	multitenancyWithSingleDomainEnabled?: boolean;
	/** Feature flag to enable request to retrieve settings from the tenant service */
	useTenantService: boolean;
	/** Feature flag to enable cluster settings from the api instead of the config file */
	useApiClusterSettings: boolean;
	/** When the Feature flag multitenancyWithSingleDomainEnabled is used we need to know the main subdomain */
	mainTenantSubdomainForSingleDomainMultitenancy?: string;
	/** when enabled shows the overview page  */
	useOverviewPage?: boolean;
	/** feature flag for the documentation  */
	documentationEnabled?: boolean;
	/** Fallback support e-mail (platform admin, global settings); shown when a centre has no chat-reachable admin (#1915). */
	supportEmail?: string;
}
