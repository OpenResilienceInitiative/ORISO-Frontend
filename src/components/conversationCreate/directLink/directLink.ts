/**
 * #1795: a counsellor's direct link. One link per medium; it stays valid
 * until switched off, and every person who opens it gets their own
 * one-to-one conversation. Storybook design only, no API yet.
 */

import {
	GuestAccountMode,
	readGuestAccountMode
} from '../../guestAccountMode/guestAccountMode';
import type { InvitationAccess } from '../../directInvitation/invitationModel';

export type DirectLinkMedium = 'CHAT' | 'AUDIO' | 'VIDEO';

/** UserService `CounsellorDirectLinkService.NAME_MAX`. */
export const DIRECT_LINK_NAME_MAX = 100;

export const DIRECT_LINK_MEDIA: DirectLinkMedium[] = ['CHAT', 'AUDIO', 'VIDEO'];

export interface DirectLink {
	id: string;
	/** Editable after creation, e.g. "Flyer Schule". */
	name: string;
	topic: string;
	/** Set once the link comes from UserService (#1894). */
	topicId?: number;
	agencyId?: number;
	/** Fixed after creation. */
	medium: DirectLinkMedium;
	/**
	 * New people can get a temporary account (mode is not PERMANENT).
	 * Applies to new people only. Mirror of `guestAccountMode`.
	 */
	temporary: boolean;
	/** UserService#1662; absent from an older server, then read from `temporary`. */
	guestAccountMode?: GuestAccountMode;
	active: boolean;
	url: string;
	/** #2142: optional, informational date and time (ISO instant). */
	scheduledAt?: string;
	/** #2252: the appointment of a Direkteinladung (ISO instants). */
	appointment?: { id: string; start: string; end: string };
	/** #2252, with an appointment: minutes the link works after the end. */
	validityMinutes?: number;
	/** #2252, with an appointment: end + validity (or later after a renewal). */
	expiresAt?: string;
	expired?: boolean;
	/** #2252: the call waiting room opens then (start − 15 min). */
	callOpensAt?: string;
	/** #2252: who may come in. */
	access?: InvitationAccess;
	/** #2252: people wait for the counsellor before the call. */
	knock?: boolean;
	/** #2252: the appointment conversation, or the 1:1 it was created from. */
	sessionId?: number;
	/** #2252: created from a 1:1 ("Weitere Personen per Link einladen"). */
	joinsExistingSession?: boolean;
}

/** The link's guest account mode, also for a link from an older server. */
export const directLinkGuestAccountMode = (
	link: Pick<DirectLink, 'guestAccountMode' | 'temporary'>
): GuestAccountMode =>
	readGuestAccountMode(link.guestAccountMode, link.temporary);
