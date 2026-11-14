import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import {
	DIRECT_LINK_MEDIA,
	DirectLink,
	DirectLinkMedium
} from '../components/conversationCreate/directLink/directLink';
import type { InvitationAccess } from '../components/directInvitation/invitationModel';

/**
 * Counsellor direct links, ORISO-UserService#1479: the counsellor's own
 * links (create in "Create chat" #1908, list and edit #1894) and the
 * person's side (own conversation, knock first for calls).
 */

/** `DirectLinkDTO`. Loose on purpose: an entry the app cannot show is dropped. */
export interface DirectLinkDTO {
	id: number;
	token?: string;
	url: string;
	name?: string | null;
	topicId?: number;
	topicName?: string | null;
	agencyId?: number | null;
	medium: string;
	temporary: boolean;
	active: boolean;
	admission?: 'DIRECT' | 'KNOCK';
	createDate?: string;
	/** #2142: informational date and time, ISO instant. */
	scheduledAt?: string | null;
	/* #2252 Direkteinladung (UserService CP2). */
	appointment?: {
		id: string;
		startTime: string;
		endTime: string;
		status?: 'SCHEDULED' | 'CANCELLED';
	} | null;
	validityAfterEndMinutes?: number | null;
	expiresAt?: string | null;
	expired?: boolean | null;
	callOpensAt?: string | null;
	accessMode?: DirectInvitationAccessMode | null;
	knock?: boolean | null;
	sessionId?: number | null;
	joinsExistingSession?: boolean | null;
}

/** #2252: who may enter, as UserService spells it. */
export type DirectInvitationAccessMode =
	| 'GUESTS_ONLY'
	| 'ACCOUNTS_ONLY'
	| 'BOTH';

const ACCESS_MODES: Record<InvitationAccess, DirectInvitationAccessMode> = {
	guests: 'GUESTS_ONLY',
	accounts: 'ACCOUNTS_ONLY',
	both: 'BOTH'
};

export const toAccessMode = (
	access: InvitationAccess
): DirectInvitationAccessMode => ACCESS_MODES[access];

export const fromAccessMode = (
	mode: string | null | undefined
): InvitationAccess | undefined =>
	(Object.keys(ACCESS_MODES) as InvitationAccess[]).find(
		(access) => ACCESS_MODES[access] === mode
	);

/** #2252: start and end of an appointment, ISO instants. */
export interface DirectInvitationAppointmentInput {
	startTime: string;
	endTime: string;
}

/** #2252: the appointment and link settings both create bodies share. */
export interface DirectInvitationSettings {
	appointment?: DirectInvitationAppointmentInput;
	/** With an appointment only; 0..2880, default 1440. */
	validityAfterEndMinutes?: number;
	accessMode?: DirectInvitationAccessMode;
	knock?: boolean;
}

export interface CreateDirectLinkBody extends DirectInvitationSettings {
	medium: DirectLinkMedium;
	topicId: number;
	name?: string;
	temporary?: boolean;
	/** Only needed when the counsellor works for more than one Beratungsstelle. */
	agencyId?: number;
	/** #2142: informational date and time, ISO instant. */
	scheduledAt?: string;
}

/** `UpdateDirectLinkDTO`: absent fields stay unchanged. */
export interface DirectLinkUpdate extends DirectInvitationSettings {
	name?: string;
	topicId?: number;
	temporary?: boolean;
	active?: boolean;
	/** #2142: a new date and time; absent keeps the old one. */
	scheduledAt?: string;
	/** #2142: removes the date and time. */
	clearScheduledAt?: boolean;
}

export type CallKnockStatus = 'PENDING' | 'ADMITTED' | 'DECLINED' | 'CANCELLED';

/** `DirectLinkConversationDTO`: the person's own 1:1 conversation. */
export interface DirectLinkConversation {
	sessionId: number;
	matrixRoomId?: string | null;
	medium: DirectLinkMedium;
	admission: 'DIRECT' | 'KNOCK';
	created: boolean;
	/** Audio and video only. */
	knockId?: number | null;
	knockStatus?: CallKnockStatus | null;
	/** Let in once (#1479, 91f4c623): the person was admitted to this conversation before. */
	callAdmitted?: boolean | null;
	/** #2252: shared by everybody who opened the invitation. */
	appointmentConversation?: boolean | null;
	/** #2252: before this no knock is opened; ask again from then. */
	callOpensAt?: string | null;
}

/** `CreateSessionDirectInvitationDTO` (#2252): exactly one of appointmentId and appointment. */
export interface SessionDirectInvitationBody extends DirectInvitationSettings {
	appointmentId?: string;
	medium?: DirectLinkMedium;
	name?: string;
}

export interface CallKnock {
	id: number;
	sessionId: number;
	status: CallKnockStatus;
	medium: DirectLinkMedium;
	requestedAt: string;
	decidedAt?: string | null;
	/** The avatar the person picked (#2237). */
	avatarId?: string | null;
}

/* Every call names the statuses it expects: without a `responseHandling`
   an unexpected status would send the whole app to the error page. The
   response itself comes back on failure, so a caller can tell a switched-off
   link (410) from anything else. */
const handled = [FETCH_SUCCESS.CONTENT, FETCH_ERRORS.CATCH_ALL_WITH_RESPONSE];

/** The backend answers 410 `DIRECT_LINK_INACTIVE` for a switched-off link. */
export const isInactiveDirectLinkError = (error: unknown): boolean =>
	typeof (error as Response)?.status === 'number' &&
	(error as Response).status === 410;

const reasonOf = async (error: unknown): Promise<string | null> => {
	if (!(error instanceof Response)) return null;
	try {
		const body = await error.clone().json();
		return typeof body?.reason === 'string' ? body.reason : null;
	} catch {
		return null;
	}
};

/**
 * #2252: 410 `DIRECT_LINK_EXPIRED`, an invitation whose validity ended or
 * whose token "Neuen Link senden" replaced. Check it before
 * `isInactiveDirectLinkError`, which matches every 410.
 */
export const isExpiredDirectLinkError = async (
	error: unknown
): Promise<boolean> =>
	(error as Response)?.status === 410 &&
	(await reasonOf(error)) === 'DIRECT_LINK_EXPIRED';

/** #2252: the only way in a 403 leaves open, else `null`. */
export const directInvitationAccessError = async (
	error: unknown
): Promise<InvitationAccess | null> => {
	if ((error as Response)?.status !== 403) return null;
	switch (await reasonOf(error)) {
		case 'DIRECT_INVITATION_GUESTS_ONLY':
			return 'guests';
		case 'DIRECT_INVITATION_ACCOUNTS_ONLY':
			return 'accounts';
		default:
			return null;
	}
};

/**
 * That 410 with its reason: the invite page calls such a link paused, and a
 * knock says the same (`isPausedInvite` also matches `INVITE_LINK_PAUSED`).
 */
export const isPausedDirectLinkError = async (
	error: unknown
): Promise<boolean> => {
	if (!(error instanceof Response) || error.status !== 410) return false;
	try {
		const body = await error.clone().json();
		return body?.reason === 'DIRECT_LINK_INACTIVE';
	} catch {
		return false;
	}
};

/* The server answers a relative URL when APP_BASE_URL is unset; a copied
   link must still open from another device. */
const absoluteUrl = (url: string) =>
	/^https?:\/\//i.test(url)
		? url
		: new URL(url, window.location.origin).toString();

/** The tile model of the Storybook components (#1795); `null` for an entry it cannot show. */
export const toDirectLink = (dto: DirectLinkDTO): DirectLink | null => {
	if (
		!dto ||
		dto.id == null ||
		!dto.url ||
		!DIRECT_LINK_MEDIA.includes(dto.medium as DirectLinkMedium)
	) {
		return null;
	}
	const topic = dto.topicName ?? '';
	return {
		id: String(dto.id),
		name: dto.name?.trim() || topic,
		topic,
		topicId: dto.topicId,
		agencyId: dto.agencyId ?? undefined,
		medium: dto.medium as DirectLinkMedium,
		temporary: !!dto.temporary,
		active: !!dto.active,
		url: absoluteUrl(dto.url),
		...(dto.scheduledAt ? { scheduledAt: dto.scheduledAt } : {}),
		...invitationFields(dto)
	};
};

/* #2252: only what the server sent, so a link from before stays as it was. */
const invitationFields = (dto: DirectLinkDTO): Partial<DirectLink> => {
	const fields: Partial<DirectLink> = {};
	const appointment = dto.appointment;
	if (
		appointment?.startTime &&
		appointment.endTime &&
		appointment.status !== 'CANCELLED'
	) {
		fields.appointment = {
			id: String(appointment.id),
			start: appointment.startTime,
			end: appointment.endTime
		};
	}
	if (typeof dto.validityAfterEndMinutes === 'number')
		fields.validityMinutes = dto.validityAfterEndMinutes;
	if (dto.expiresAt) fields.expiresAt = dto.expiresAt;
	if (typeof dto.expired === 'boolean') fields.expired = dto.expired;
	if (dto.callOpensAt) fields.callOpensAt = dto.callOpensAt;
	const access = fromAccessMode(dto.accessMode);
	if (access) fields.access = access;
	if (typeof dto.knock === 'boolean') fields.knock = dto.knock;
	if (typeof dto.sessionId === 'number') fields.sessionId = dto.sessionId;
	if (typeof dto.joinsExistingSession === 'boolean')
		fields.joinsExistingSession = dto.joinsExistingSession;
	return fields;
};

const readable = (value: unknown): DirectLink => {
	const link = toDirectLink(value as DirectLinkDTO);
	if (!link) {
		throw new Error('Unreadable direct link');
	}
	return link;
};

/** The caller's own links, newest first, switched-off ones included. */
export const apiGetOwnDirectLinks = async (): Promise<DirectLink[]> => {
	let value: unknown;
	try {
		value = await fetchData({
			url: endpoints.directLinks,
			method: FETCH_METHODS.GET,
			responseHandling: [FETCH_ERRORS.EMPTY, FETCH_ERRORS.CATCH_ALL]
		});
	} catch (error) {
		if (error instanceof Error && error.message === FETCH_ERRORS.EMPTY) {
			return [];
		}
		throw error;
	}
	return (Array.isArray(value) ? value : [])
		.map(toDirectLink)
		.filter((link): link is DirectLink => link !== null);
};

export const apiCreateDirectLink = async (
	body: CreateDirectLinkBody
): Promise<DirectLink> =>
	readable(
		await fetchData({
			url: endpoints.directLinks,
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify(body),
			responseHandling: handled
		})
	);

export const apiUpdateDirectLink = async (
	linkId: string,
	update: DirectLinkUpdate
): Promise<DirectLink> =>
	readable(
		await fetchData({
			url: endpoints.directLink(linkId),
			method: FETCH_METHODS.PATCH,
			bodyData: JSON.stringify(update),
			// CONTENT: without it fetchData hands back the raw Response.
			responseHandling: handled
		})
	);

/**
 * #2252 "Neuen Link senden": a new token for the same appointment; the old
 * one answers 410 `DIRECT_LINK_EXPIRED` from now on.
 */
export const apiRenewDirectInvitation = async (
	linkId: string,
	validityAfterEndMinutes?: number
): Promise<DirectLink> =>
	readable(
		await fetchData({
			url: endpoints.directLinkRenewal(linkId),
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify(
				validityAfterEndMinutes === undefined
					? {}
					: { validityAfterEndMinutes }
			),
			responseHandling: handled
		})
	);

/**
 * #2252 "Weitere Personen per Link einladen": an invitation into an existing
 * 1:1 conversation, bound to one of its appointments.
 */
export const apiCreateSessionDirectInvitation = async (
	sessionId: number,
	body: SessionDirectInvitationBody
): Promise<DirectLink> =>
	readable(
		await fetchData({
			url: endpoints.sessionDirectInvitations(sessionId),
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify(body),
			responseHandling: handled
		})
	);

/**
 * #2252 "Neuen Link anfragen": tells the counsellor. Only a person already in
 * the invitation's conversation may ask (404 otherwise); works with an
 * expired or replaced token.
 */
export const apiRequestDirectInvitationRenewal = async (
	token: string
): Promise<void> => {
	// 204 on success; every other answer (404, 409, 503) is passed on.
	await fetchData({
		url: endpoints.inviteLinkRenewalRequests(token),
		method: FETCH_METHODS.POST,
		responseHandling: handled
	});
};

/**
 * Opens (or reopens) the signed-in person's own conversation with the link's
 * counsellor. For audio and video it also knocks; opening it again while
 * waiting keeps the same knock.
 */
export const apiStartDirectLinkConversation = (
	token: string
): Promise<DirectLinkConversation> =>
	fetchData({
		url: `${endpoints.inviteLinksBase}${encodeURIComponent(token)}/conversations`,
		method: FETCH_METHODS.POST,
		responseHandling: handled
	});

export const apiGetOwnCallKnock = (knockId: number): Promise<CallKnock> =>
	fetchData({
		url: `${endpoints.ownCallKnocks}${knockId}`,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	});

/**
 * The person's admission in one conversation, else their latest knock there
 * (#1479, "let in once"); `null` when they never knocked (404).
 */
export const apiGetOwnCallKnockForSession = async (
	sessionId: number
): Promise<CallKnock | null> => {
	try {
		return await fetchData({
			url: `${endpoints.ownCallKnocks.replace(/\/$/, '')}?sessionId=${encodeURIComponent(String(sessionId))}`,
			method: FETCH_METHODS.GET,
			responseHandling: handled
		});
	} catch (error) {
		if ((error as Response)?.status === 404) return null;
		throw error;
	}
};

export const apiCancelOwnCallKnock = (knockId: number): Promise<void> =>
	fetchData({
		url: `${endpoints.ownCallKnocks}${knockId}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: handled
	}).then(() => undefined);

/* "Create chat" lives in another view: it announces a new link so an open
   list (clock page or settings) shows it straight away. */
export const DIRECT_LINKS_CHANGED_EVENT = 'oriso:direct-links-changed';

export const notifyDirectLinksChanged = () =>
	window.dispatchEvent(new Event(DIRECT_LINKS_CHANGED_EVENT));
