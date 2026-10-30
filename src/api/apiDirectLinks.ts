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
}

export interface CreateDirectLinkBody {
	medium: DirectLinkMedium;
	topicId: number;
	name?: string;
	temporary?: boolean;
	/** Only needed when the counsellor works for more than one Beratungsstelle. */
	agencyId?: number;
}

/** `UpdateDirectLinkDTO`: absent fields stay unchanged. */
export interface DirectLinkUpdate {
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
	/** Let in once (#1479, 91f4c623): the person was admitted to this conversation before. */
	callAdmitted?: boolean | null;
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
		url: absoluteUrl(dto.url)
	};
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
