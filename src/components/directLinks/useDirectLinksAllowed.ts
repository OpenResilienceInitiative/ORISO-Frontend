import { useMemo } from 'react';
import { useTenant } from '../../globalState';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import { getDirectLinkMedia } from '../conversationCreate/directLink/directLinkAvailability';

/**
 * #1894 (Frank, 28 Oct): "Meine Direktlinks" (clock entry) and Settings →
 * "Meine Links" exist only while "Direkteinladung erlauben" allows at least
 * one medium for this counsellor. Same source as the Direktlink card.
 * `enabled`: false for askers (no agency fetch, always false).
 */
export const useDirectLinksAllowed = (enabled: boolean): boolean => {
	const tenant = useTenant();
	const { agencies } = useCounsellorAgencyFormats(enabled);
	return useMemo(
		() =>
			enabled && getDirectLinkMedia(tenant as never, agencies).length > 0,
		[enabled, tenant, agencies]
	);
};
