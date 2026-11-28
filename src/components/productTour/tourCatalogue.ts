import { matchPath } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState/helpers/stateHelpers';
import type { UserDataInterface } from '../../globalState/interfaces';
import type { AgencyFormatSource } from '../conversationCreate/formatAvailability';
import { isTourAvailable } from './tourEngine';
import type { TourAudience, TourDefinition } from './types';

/**
 * What a tour's availability may depend on besides tenant flags: app
 * settings and the signed-in user. Resolved by the Help list, the "?"
 * launcher and the host alike, so the three never disagree.
 */
export interface TourAvailabilityContext {
	/** Tenant settings; unset flags count as ON (`TourCondition`). */
	flags?: Record<string, unknown>;
	userData?: UserDataInterface;
	/** Resolved agency format settings, shared with the create flow. */
	agencyFormats?: AgencyFormatSource[];
	agencyFormatsReady?: boolean;
}

/**
 * Gates a tour definition cannot express as data (definitions stay
 * function-free because ORISO-Admin shares the contract): an OR over
 * several flags, an unset flag that means OFF, a user preference. A tour
 * without an entry is gated by its `when` alone.
 */
export const tourAvailability: Record<
	string,
	(ctx: TourAvailabilityContext) => boolean
> = {};

/** The tour audience of a Frontend user, or none (anonymous live chat). */
export const audienceForUser = (
	userData?: UserDataInterface
): TourAudience | null => {
	if (!userData) return null;
	if (hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData)) {
		return 'consultant';
	}
	if (hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData)) {
		return 'asker';
	}
	return null;
};

/** Frontend tours this audience may start under the current settings. */
export const getAvailableTours = (
	tours: TourDefinition[],
	audience: TourAudience | null,
	ctx: TourAvailabilityContext = {}
): TourDefinition[] =>
	audience
		? tours.filter(
				(tour) =>
					tour.surface === 'frontend' &&
					tour.audiences.includes(audience) &&
					isTourAvailable(tour, { flags: ctx.flags }) &&
					(tourAvailability[tour.id]?.(ctx) ?? true)
			)
		: [];

/** The app page a tour starts on: its first step that names a route. */
export const tourHomePath = (tour: TourDefinition): string | undefined =>
	tour.steps.find((step) => step.route)?.route?.split('?')[0];

const isUnder = (pathname: string, base: string) => {
	const trimmed = base.replace(/\/+$/, '');
	return pathname === trimmed || pathname.startsWith(`${trimmed}/`);
};

/**
 * The tours that explain the current page come first; otherwise the
 * catalogue order (Frank's priority order) stays.
 */
export const orderToursForPage = (
	tours: TourDefinition[],
	pathname: string
): TourDefinition[] => {
	const fits = (tour: TourDefinition) => {
		const home = tourHomePath(tour);
		return !!home && isUnder(pathname, home);
	};
	return [...tours.filter(fits), ...tours.filter((tour) => !fits(tour))];
};

/** Paths on which a conversation fills the stage (chat, enquiry, circle). */
const CONVERSATION_PATHS = [
	'/sessions/consultant/sessionPreview/session/:sessionId/*',
	'/sessions/consultant/sessionView/session/:sessionId/*',
	'/sessions/consultant/sessionView/chat/:chatId/*',
	'/sessions/consultant/sessionPreview/:groupId/:sessionId/*',
	'/sessions/consultant/sessionView/:groupId/:sessionId/*',
	'/sessions/user/view/session/:sessionId/*',
	'/sessions/user/view/chat/:chatId/*',
	'/sessions/user/view/write/:sessionId/*',
	'/sessions/user/view/:groupId/:sessionId/*',
	'/groups/:chatId/entry'
];

/** The create-chat wizard lives under the session view but is no conversation. */
const NOT_A_CONVERSATION = [
	'/sessions/consultant/sessionView/createGroupChat/*'
];

export const isConversationOpenPath = (pathname: string): boolean =>
	!NOT_A_CONVERSATION.some((path) => matchPath(path, pathname)) &&
	CONVERSATION_PATHS.some((path) => matchPath(path, pathname));

/** Navigation items carry `nav-<slug>` tour anchors; slugs are stable names. */
const NAV_TOUR_TARGETS: Record<string, string> = {
	'/sessions/consultant/sessionPreview': 'nav-enquiries',
	'/sessions/consultant/sessionView': 'nav-sessions',
	'/sessions/user/view': 'nav-sessions',
	'/notifications': 'nav-activity',
	'/profile': 'nav-profile',
	'/booking/events': 'nav-calendar',
	'/tools': 'nav-tools',
	'/overview': 'nav-overview'
};

export const navTourTarget = (to: string): string | undefined =>
	NAV_TOUR_TARGETS[to];
