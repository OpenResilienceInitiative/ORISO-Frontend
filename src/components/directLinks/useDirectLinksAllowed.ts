import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../../globalState';
import { useCounsellorAgencyFormats } from '../../hooks/useCounsellorAgencyFormats';
import { getDirectLinkMedia } from '../conversationCreate/directLink/directLinkAvailability';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';

const NO_MEDIA: readonly DirectLinkMedium[] = [];

/** Where a counsellor lands when direct links are off (Routing's default). */
export const COUNSELLOR_START_PATH = '/sessions/consultant/sessionPreview';
export const MY_LINKS_SETTINGS_PATH = '/profile/einstellungen/meine-links';
export const SETTINGS_OVERVIEW_PATH = '/profile/einstellungen';

/**
 * #1894 (Frank, 28 Oct): "Meine Direktlinks" (clock entry) and Settings →
 * "Meine Links" exist only while "Direkteinladung erlauben" allows at least
 * one medium for this counsellor. Same source as the Direktlink card.
 * `ready` is false while the agencies' own settings are still loading.
 * `enabled`: false for askers (no agency fetch, never allowed).
 */
export const useDirectLinksAvailability = (enabled: boolean) => {
	const tenant = useTenant();
	const { agencies, isLoading } = useCounsellorAgencyFormats(enabled);
	return useMemo(() => {
		const media = enabled
			? getDirectLinkMedia(tenant as never, agencies)
			: NO_MEDIA;
		return {
			allowed: media.length > 0,
			media,
			ready: !enabled || (Boolean(tenant) && !isLoading)
		};
	}, [enabled, tenant, agencies, isLoading]);
};

/**
 * #2279: the media themselves. An invitation bound to an appointment takes
 * the Art's medium, which "Direkteinladung erlauben" may not allow.
 */
export const useDirectLinkMedia = (
	enabled: boolean
): readonly DirectLinkMedium[] => useDirectLinksAvailability(enabled).media;

/** For hiding entries: the short show-then-hide while loading is accepted. */
export const useDirectLinksAllowed = (enabled: boolean): boolean =>
	useDirectLinksAvailability(enabled).allowed;

/**
 * Sends a counsellor away from a direct-links page once the availability is
 * known to allow no medium; never while it is still loading.
 */
export const useDirectLinksRedirect = (
	enabled: boolean,
	matches: (pathname: string) => boolean,
	to: string
) => {
	const { allowed, ready } = useDirectLinksAvailability(enabled);
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const leave = enabled && ready && !allowed && matches(pathname);
	useEffect(() => {
		if (leave) navigate(to, { replace: true });
	}, [leave, navigate, to]);
	return leave;
};
