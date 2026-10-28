import { endpoints } from '../resources/scripts/endpoints';
import {
	FETCH_ERRORS,
	FETCH_METHODS,
	FETCH_SUCCESS,
	fetchData
} from './fetchData';
import type {
	DirectLink,
	DirectLinkMedium
} from '../components/conversationCreate/directLink/directLink';

/** ORISO-UserService#1479, `DirectLinkDTO`. */
export interface DirectLinkDTO {
	id: number;
	token: string;
	url: string;
	name?: string | null;
	topicId: number;
	topicName?: string | null;
	agencyId?: number | null;
	medium: DirectLinkMedium;
	temporary: boolean;
	active: boolean;
	admission: 'DIRECT' | 'KNOCK';
	createDate?: string;
}

export interface CreateDirectLinkBody {
	medium: DirectLinkMedium;
	topicId: number;
	name?: string;
	temporary?: boolean;
	/** Only needed when the counsellor works for more than one Beratungsstelle. */
	agencyId?: number;
}

export interface UpdateDirectLinkBody {
	name?: string;
	topicId?: number;
	temporary?: boolean;
	active?: boolean;
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
}

export interface CallKnock {
	id: number;
	sessionId: number;
	status: CallKnockStatus;
	medium: DirectLinkMedium;
	requestedAt: string;
	decidedAt?: string | null;
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

/** The frontend model the Storybook components were built on (#1795). */
export const toDirectLink = (dto: DirectLinkDTO): DirectLink => ({
	id: String(dto.id),
	name: dto.name?.trim() || dto.topicName || '',
	topic: dto.topicName ?? '',
	medium: dto.medium,
	temporary: dto.temporary,
	active: dto.active,
	url: dto.url
});

export const apiGetDirectLinks = (): Promise<DirectLinkDTO[]> =>
	fetchData({
		url: endpoints.directLinks,
		method: FETCH_METHODS.GET,
		responseHandling: handled
	}).then((list) => (Array.isArray(list) ? list : []));

export const apiCreateDirectLink = (
	body: CreateDirectLinkBody
): Promise<DirectLinkDTO> =>
	fetchData({
		url: endpoints.directLinks,
		method: FETCH_METHODS.POST,
		bodyData: JSON.stringify(body),
		responseHandling: handled
	});

export const apiUpdateDirectLink = (
	id: string | number,
	body: UpdateDirectLinkBody
): Promise<DirectLinkDTO> =>
	fetchData({
		url: `${endpoints.directLinks}/${encodeURIComponent(String(id))}`,
		method: FETCH_METHODS.PATCH,
		bodyData: JSON.stringify(body),
		responseHandling: handled
	});

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

export const apiCancelOwnCallKnock = (knockId: number): Promise<void> =>
	fetchData({
		url: `${endpoints.ownCallKnocks}${knockId}`,
		method: FETCH_METHODS.DELETE,
		responseHandling: handled
	}).then(() => undefined);

/* "Create chat" lives in another view: it announces a new link so an open
   list (clock page or settings) shows it straight away. Same name and event
   as in FE#1911 (PR #1911), so the two PRs agree once both land. */
export const DIRECT_LINKS_CHANGED_EVENT = 'oriso:direct-links-changed';

export const notifyDirectLinksChanged = () =>
	window.dispatchEvent(new Event(DIRECT_LINKS_CHANGED_EVENT));
