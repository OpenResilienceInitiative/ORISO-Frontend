import { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';

/** Effective tenant policy is read-only here; account/device opt-ins remain separate. */
export const notificationChannelPolicy = (
	settings: Partial<TenantDataSettingsInterface> | undefined,
	conversationType: string | null | undefined
) => {
	const context =
		conversationType == null
			? 'AgencyCounselling'
			: conversationType === 'AGENCY_COUNSELLING'
				? 'AgencyCounselling'
				: conversationType === 'LIVE_CHAT'
					? 'LiveChat'
					: conversationType === 'SELF_HELP'
						? 'SelfHelp'
						: null;
	if (!context) return { emailAllowed: false, browserAllowed: false };
	const emailKey =
		`featureAskerEmail${context}Enabled` as keyof TenantDataSettingsInterface;
	const browserKey =
		`featureAskerBrowser${context}Enabled` as keyof TenantDataSettingsInterface;
	return {
		emailAllowed:
			settings?.featureAskerEmailEnabled !== false &&
			(settings?.[emailKey] === undefined
				? context !== 'LiveChat'
				: settings[emailKey] === true),
		browserAllowed: settings?.[browserKey] !== false
	};
};
